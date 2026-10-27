#!/usr/bin/env node
// Kiểm tra dữ liệu mảng Đấu nối (data/conn-*.js) theo references/connector-schema.md mục 4.
// Dùng: node validate-connectors.mjs <thư mục project>   (mặc định: thư mục hiện tại)
// Thoát mã 1 nếu có lỗi. In bảng tóm tắt Body/Pinout/Cable theo family.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(process.argv[2] || ".");
const dataDir = path.join(root, "data");
const FAMILIES = ["serial", "telecom", "usb", "video"];
const OUTLINES = ["dsub", "rj", "usb-a", "usb-b", "usb-b-ss", "usb-mini-b", "usb-micro-b",
  "usb-micro-b-ss", "usb-c", "bnc", "m34", "terminal",
  // v2 Video (VGA DE-15 dùng "dsub" vỏ E, 3 hàng)
  "hdmi-a", "hdmi-c", "hdmi-d", "dp", "mini-dp", "dvi"];
const DIRS = ["in", "out", "io", "pwr", "gnd", "shield", "nc", "diff"];
const KINDS = ["cable", "adapter", "loopback", "balun"];
const ROLES = ["DTE", "DCE", "host", "device", "NT", "TE", "source", "sink", null]; // source/sink: v2 Video

const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

if (!fs.existsSync(dataDir)) {
  console.error(`Không thấy thư mục ${dataDir}`);
  process.exit(1);
}

// Nạp từng file trong context riêng để phát hiện id trùng giữa các file
// (trên trình duyệt Object.assign sẽ ghi đè im lặng).
const files = fs.readdirSync(dataDir).filter((f) => /^conn-.*\.js$/.test(f)).sort();
const BODIES = {}, PINOUTS = {}, CABLES = [];
const origin = { body: {}, pinout: {} };
for (const f of files) {
  const ctx = { window: {} };
  vm.createContext(ctx);
  try {
    vm.runInContext(fs.readFileSync(path.join(dataDir, f), "utf8"), ctx, { filename: f });
  } catch (e) {
    err(`[${f}] lỗi cú pháp/chạy: ${e.message}`);
    continue;
  }
  const w = ctx.window;
  for (const [store, dst, kind] of [[w.CONN_BODIES, BODIES, "body"], [w.CONN_PINOUTS, PINOUTS, "pinout"]]) {
    if (store === undefined) continue;
    if (typeof store !== "object" || Array.isArray(store)) { err(`[${f}] CONN_${kind.toUpperCase()}S phải là object`); continue; }
    for (const [k, v] of Object.entries(store)) {
      if (k in dst) err(`${kind} "${k}": id trùng (${origin[kind][k]} và ${f})`);
      dst[k] = v;
      origin[kind][k] = f;
    }
  }
  if (w.CONN_CABLES !== undefined) {
    if (!Array.isArray(w.CONN_CABLES)) err(`[${f}] CONN_CABLES phải là mảng`);
    else for (const c of w.CONN_CABLES) CABLES.push(Object.assign({ __file: f }, c));
  }
}

const has = (o, k) => o && Object.prototype.hasOwnProperty.call(o, k);

// ---------- Body ----------
const bodyPins = {}; // id → Set chân
for (const [key, b] of Object.entries(BODIES)) {
  const where = `body "${key}"`;
  if (!b || typeof b !== "object") { err(`${where}: không phải object`); continue; }
  if (b.id !== key) err(`${where}: id "${b.id}" khác key`);
  for (const k of ["name", "standard", "summary", "detail"]) if (!b[k]) err(`${where}: thiếu ${k}`);
  if (!FAMILIES.includes(b.family)) err(`${where}: family "${b.family}" không hợp lệ`);
  if (!b.genders || typeof b.genders !== "object" || !Object.keys(b.genders).length) err(`${where}: thiếu genders`);
  else for (const [g, gv] of Object.entries(b.genders)) if (!gv?.name) err(`${where}: genders.${g} thiếu name`);
  const fc = b.face;
  if (!fc) { err(`${where}: thiếu face`); bodyPins[key] = new Set(); continue; }
  if (!OUTLINES.includes(fc.outline)) err(`${where}: face.outline "${fc.outline}" không hợp lệ`);
  if (fc.outline === "dsub" && !/^[A-E]$/.test(fc.shell || "")) err(`${where}: dsub cần face.shell A–E`);
  if (!(fc.w > 0 && fc.h > 0)) err(`${where}: face.w/h phải > 0`);
  if (!fc.viewOf || !has(b.genders, fc.viewOf)) err(`${where}: face.viewOf "${fc.viewOf}" không thuộc genders`);
  if (!fc.orientation) err(`${where}: thiếu face.orientation (hướng nhìn)`);
  const set = new Set();
  if (!Array.isArray(fc.pins) || !fc.pins.length) err(`${where}: face.pins rỗng`);
  for (const p of fc.pins || []) {
    const id = String(p.pin);
    if (p.pin === undefined || p.pin === "") { err(`${where}: chân thiếu tên`); continue; }
    if (typeof p.pin !== "string") err(`${where}: chân ${id} phải là chuỗi`);
    if (set.has(id)) err(`${where}: chân "${id}" trùng trong face.pins`);
    set.add(id);
    if (!(Number.isFinite(p.x) && Number.isFinite(p.y))) err(`${where}: chân ${id} thiếu toạ độ x/y`);
    else if (p.x < 0 || p.y < 0 || p.x > fc.w || p.y > fc.h) err(`${where}: chân ${id} (${p.x},${p.y}) ngoài khung ${fc.w}×${fc.h}`);
  }
  for (const k of fc.keys || [])
    if (k.x < 0 || k.y < 0 || k.x + (k.w || 0) > fc.w || k.y + (k.h || 0) > fc.h) warn(`${where}: key "${k.label || ""}" tràn khung`);
  if (b.pinCount !== (fc.pins || []).length) err(`${where}: pinCount ${b.pinCount} ≠ face.pins.length ${(fc.pins || []).length}`);
  bodyPins[key] = set;
}

// ---------- Pinout ----------
const pinInfo = {}; // pinout → Map(pin → {dir, signal})
for (const [key, p] of Object.entries(PINOUTS)) {
  const where = `pinout "${key}"`;
  if (!p || typeof p !== "object") { err(`${where}: không phải object`); continue; }
  if (p.id !== key) err(`${where}: id "${p.id}" khác key`);
  for (const k of ["name", "standard", "summary", "detail"]) if (!p[k]) err(`${where}: thiếu ${k}`);
  if (!FAMILIES.includes(p.family)) err(`${where}: family "${p.family}" không hợp lệ`);
  if (p.role !== undefined && !ROLES.includes(p.role)) err(`${where}: role "${p.role}" không hợp lệ`);
  const body = BODIES[p.body];
  const map = new Map();
  pinInfo[key] = map;
  if (!body) { err(`${where}: body "${p.body}" không tồn tại`); }
  else if (p.gender !== undefined && p.gender !== null && !has(body.genders, p.gender))
    err(`${where}: gender "${p.gender}" không thuộc genders của body "${p.body}"`);
  if (!Array.isArray(p.pins) || !p.pins.length) { err(`${where}: pins rỗng`); continue; }
  for (const pin of p.pins) {
    const id = String(pin.pin);
    if (map.has(id)) err(`${where}: chân "${id}" trùng`);
    map.set(id, pin);
    if (!DIRS.includes(pin.dir)) err(`${where}: chân ${id} dir "${pin.dir}" không hợp lệ`);
    if (!pin.signal) err(`${where}: chân ${id} thiếu signal`);
    if (!pin.name) warn(`${where}: chân ${id} thiếu name`);
    if (!pin.desc) warn(`${where}: chân ${id} thiếu desc`);
  }
  if (body) {
    const bp = bodyPins[p.body] || new Set();
    for (const id of map.keys()) if (!bp.has(id)) err(`${where}: chân "${id}" không có trên body "${p.body}"`);
    for (const id of bp) if (!map.has(id)) err(`${where}: thiếu chân "${id}" của body "${p.body}"`);
  }
  for (const g of p.groups || []) {
    if (!g.name) err(`${where}: group thiếu name`);
    for (const id of g.pins || []) if (!map.has(String(id))) err(`${where}: group "${g.name}" chứa chân "${id}" không có`);
  }
  const vids = new Set();
  for (const v of p.variants || []) {
    if (!v.id) err(`${where}: variant thiếu id`);
    if (vids.has(v.id)) err(`${where}: variant "${v.id}" trùng`);
    vids.add(v.id);
    if (!v.name) err(`${where}: variant "${v.id}" thiếu name`);
    for (const [id, ov] of Object.entries(v.pins || {})) {
      if (!map.has(id)) err(`${where}: variant "${v.id}" sửa chân "${id}" không có`);
      if (ov?.dir !== undefined && !DIRS.includes(ov.dir)) err(`${where}: variant "${v.id}" chân ${id} dir "${ov.dir}" không hợp lệ`);
    }
  }
}

// ---------- Cable ----------
const cableIds = new Set();
const pinOf = (cab, end) => pinInfo[cab[end]?.pinout];
for (const c of CABLES) {
  const where = `cable "${c.id}" [${c.__file}]`;
  if (!c.id) { err(`cable thiếu id: ${c.name} [${c.__file}]`); continue; }
  if (cableIds.has(c.id)) err(`${where}: id trùng`);
  cableIds.add(c.id);
  if (!c.name) err(`${where}: thiếu name`);
  if (!FAMILIES.includes(c.family)) err(`${where}: family "${c.family}" không hợp lệ`);
  if (!KINDS.includes(c.kind)) err(`${where}: kind "${c.kind}" không hợp lệ`);
  if (!c.use) warn(`${where}: thiếu use`);
  if (!c.detail) warn(`${where}: thiếu detail`);
  const loop = c.kind === "loopback";
  const ends = loop ? ["a"] : ["a", "b"];
  if (loop && c.b) err(`${where}: loopback không được có b`);
  let ok = true;
  for (const e of ends) {
    const side = c[e];
    if (!side) { err(`${where}: thiếu đầu ${e}`); ok = false; continue; }
    const po = PINOUTS[side.pinout];
    if (!po) { err(`${where}: ${e}.pinout "${side.pinout}" không tồn tại`); ok = false; continue; }
    const body = BODIES[po.body];
    if (body && side.gender !== undefined && !has(body.genders, side.gender))
      err(`${where}: ${e}.gender "${side.gender}" không thuộc genders của body "${po.body}"`);
    if (!side.gender) warn(`${where}: ${e} thiếu gender`);
  }
  if (c.kind === "balun" && !(Array.isArray(c.components) && c.components.length)) err(`${where}: balun phải có components`);
  if (!ok) continue;
  const A = pinOf(c, "a"), B = loop ? A : pinOf(c, "b");
  const wires = c.wires || [];
  if (!Array.isArray(wires)) { err(`${where}: wires phải là mảng`); continue; }
  if (!wires.length && !(c.bridges || []).length) err(`${where}: không có wires lẫn bridges`);
  const elec = c.kind !== "balun"; // balun đi qua biến áp: không kiểm cực/đất
  for (const w of wires) {
    const pa = String(w.a);
    const far = loop ? "a2" : "b";
    const pb = String(w[far]);
    if (loop && w.b !== undefined) err(`${where}: loopback dùng {a, a2}, không dùng b`);
    if (w[far] === undefined) { err(`${where}: wire thiếu ${far} (a=${pa})`); continue; }
    const ia = A.get(pa), ib = B.get(pb);
    if (!ia) err(`${where}: wire a="${pa}" không phải chân của ${c.a.pinout}`);
    if (!ib) err(`${where}: wire ${far}="${pb}" không phải chân của ${loop ? c.a.pinout : c.b.pinout}`);
    if (!ia || !ib) continue;
    const tag = `${where}: ${pa}(${ia.signal}) ↔ ${pb}(${ib.signal})`;
    if (elec) {
      const isG = (d) => d === "gnd" || d === "shield";
      if ((ia.dir === "gnd") !== (ib.dir === "gnd") && !(isG(ia.dir) && isG(ib.dir))) warn(`${tag}: đất nối sang chân không phải đất`);
      if ((ia.dir === "pwr") !== (ib.dir === "pwr")) warn(`${tag}: nguồn nối sang chân không phải nguồn`);
      // Dây nối hai chân nc (vd. cặp rảnh của cáp mạng 10/100) là bình thường; chỉ cảnh báo khi một bên nc.
      if ((ia.dir === "nc") !== (ib.dir === "nc")) warn(`${tag}: một đầu là chân nc`);
    }
    // Chiều tín hiệu: chỉ áp cho cable nối hai thiết bị và loopback (adapter/balun là khối chuyển trung gian).
    const extension = !loop && c.a.pinout === c.b.pinout && pa === pb;
    if ((c.kind === "cable" && !extension) || loop) {
      if ((ia.dir === "out" && ib.dir === "out") || (ia.dir === "in" && ib.dir === "in"))
        warn(`${tag}: ${ia.dir} nối ${ib.dir} — kiểm chiều TX→RX`);
    }
  }
  for (const br of c.bridges || []) {
    if (!ends.includes(br.end)) { err(`${where}: bridge end "${br.end}" không hợp lệ`); continue; }
    const P = pinOf(c, br.end);
    if (!Array.isArray(br.pins) || br.pins.length < 2) err(`${where}: bridge cần ≥ 2 chân`);
    for (const id of br.pins || []) if (!P.get(String(id))) err(`${where}: bridge đầu ${br.end} chứa chân "${id}" không có`);
  }
  for (const cp of c.components || []) {
    if (!cp.type) err(`${where}: component thiếu type`);
    for (const ref of cp.between || []) {
      const m = /^(a|b):(.+)$/.exec(ref);
      if (!m) { warn(`${where}: component between "${ref}" không theo dạng "a:chân"/"b:chân"`); continue; }
      if (!ends.includes(m[1])) { err(`${where}: component tham chiếu đầu ${m[1]} không có`); continue; }
      const P = pinOf(c, m[1]);
      const found = P.has(m[2]) || [...P.values()].some((x) => x.signal === m[2]);
      if (!found) err(`${where}: component between "${ref}" không khớp chân/tín hiệu nào`);
    }
  }
}

// ---------- Tóm tắt ----------
const count = Object.fromEntries(FAMILIES.map((f) => [f, { body: 0, pinout: 0, cable: 0 }]));
for (const b of Object.values(BODIES)) if (count[b?.family]) count[b.family].body++;
for (const p of Object.values(PINOUTS)) if (count[p?.family]) count[p.family].pinout++;
for (const c of CABLES) if (count[c.family]) count[c.family].cable++;
console.log(`File: ${files.join(", ") || "(không có data/conn-*.js)"}`);
console.log("\nFamily     Body  Pinout  Cable");
for (const f of FAMILIES) {
  const r = count[f];
  console.log(`  ${f.padEnd(9)}${String(r.body).padStart(4)}${String(r.pinout).padStart(8)}${String(r.cable).padStart(7)}`);
}
console.log(`  ${"tổng".padEnd(9)}${String(Object.keys(BODIES).length).padStart(4)}${String(Object.keys(PINOUTS).length).padStart(8)}${String(CABLES.length).padStart(7)}`);
console.log("\nBody: " + Object.values(BODIES).map((b) => `${b?.id}(${b?.pinCount})`).join(", "));
if (warns.length) console.log(`\nCẢNH BÁO (${warns.length}):\n  - ` + warns.join("\n  - "));
if (errors.length) {
  console.log(`\nLỖI (${errors.length}):\n  - ` + errors.join("\n  - "));
  process.exit(1);
}
console.log("\nOK – dữ liệu đấu nối hợp lệ.");
