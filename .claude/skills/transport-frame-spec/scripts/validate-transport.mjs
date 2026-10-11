#!/usr/bin/env node
// Kiểm tra dữ liệu mảng Truyền dẫn theo references/transport-schema.md.
// Dùng: node validate-transport.mjs <thư mục project>. Thoát mã 1 nếu có lỗi.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(process.argv[2] || ".");
const dataDir = path.join(root, "data");
const KINDS = ["fas", "soh", "pointer", "poh", "opu-oh", "payload", "stuff", "fec", "reserved", "tributary"];
const UNIT_KINDS = ["client", "container", "vc", "tu", "tug", "au", "aug", "stm", "odu", "opu", "otu", "pdh"];
const FAMILIES = ["pdh", "sdh", "otn"];
const errors = [], warns = [];
const err = (m) => errors.push(m), warn = (m) => warns.push(m);

const files = fs.existsSync(dataDir) ? fs.readdirSync(dataDir).filter((f) => /^transport-.*\.js$/.test(f)).sort() : [];
if (!files.length) { console.log("Chưa có data/transport-*.js"); process.exit(1); }
const ctx = { window: {}, console };
vm.createContext(ctx);
for (const f of files) {
  try { vm.runInContext(fs.readFileSync(path.join(dataDir, f), "utf8"), ctx, { filename: f }); }
  catch (e) { err(`[${f}] lỗi chạy: ${e.message}`); }
}
const FR = ctx.window.TFRAMES || {}, MUX = ctx.window.TMUX || {}, LABS = ctx.window.TLABS || [];

// Danh sách ô của một rect (hỗ trợ step).
function cells(rect, cols) {
  const out = [];
  const step = rect.step || 1;
  for (let i = 0; i < rect.h; i++)
    for (let j = 0; j < rect.w; j++) out.push((rect.r + i) * cols + rect.c + j * step);
  return out;
}
const validRect = (r) => r && [r.r, r.c, r.h, r.w].every(Number.isInteger) && r.h > 0 && r.w > 0 && (r.step === undefined || (Number.isInteger(r.step) && r.step > 0));

const table = [];
for (const [key, f] of Object.entries(FR)) {
  const where = `frame "${key}"`;
  if (f.id !== key) err(`${where}: id khác key`);
  if (!FAMILIES.includes(f.family)) err(`${where}: family "${f.family}" không hợp lệ`);
  for (const k of ["name", "category", "summary", "detail", "standard"]) if (!f[k]) err(`${where}: thiếu ${k}`);
  const g = f.grid || {};
  if (![g.rows, g.cols, g.cellBits].every((x) => Number.isInteger(x) && x > 0)) { err(`${where}: grid sai`); continue; }
  const bits = g.rows * g.cols * g.cellBits;
  const rate = (bits * 1000) / f.periodUs;
  if (Math.abs(rate - f.rateKbps) > 1e-6) err(`${where}: rateKbps = ${f.rateKbps} nhưng tính được ${rate}`);
  table.push([key, `${g.rows}×${g.cols}`, f.rateKbps]);

  const total = g.rows * g.cols;
  const ids = new Set();
  // Kiểm một nhóm region phủ kín đúng tập ô `parentCells`.
  const checkTiling = (regions, parentSet, label) => {
    const seen = new Map();
    for (const rg of regions) {
      const rw = `${where} › region "${rg.id}"`;
      if (!rg.id || ids.has(rg.id)) err(`${rw}: id thiếu/trùng`); else ids.add(rg.id);
      if (!rg.name) err(`${rw}: thiếu name`);
      if (!rg.desc) err(`${rw}: thiếu desc`);
      if (!KINDS.includes(rg.kind)) err(`${rw}: kind "${rg.kind}" không hợp lệ`);
      if (!validRect(rg.rect)) { err(`${rw}: rect sai`); continue; }
      const cs = cells(rg.rect, g.cols);
      const lastCol = rg.rect.c + (rg.rect.w - 1) * (rg.rect.step || 1);
      if (rg.rect.r + rg.rect.h > g.rows || lastCol >= g.cols) { err(`${rw}: rect vượt lưới`); continue; }
      for (const c of cs) {
        if (!parentSet.has(c)) { err(`${rw}: ô (${Math.floor(c / g.cols)},${c % g.cols}) nằm ngoài ${label}`); break; }
        if (seen.has(c)) { err(`${rw}: chồng với "${seen.get(c)}" tại ô (${Math.floor(c / g.cols)},${c % g.cols})`); break; }
        seen.set(c, rg.id);
      }
      if (rg.bitFields) {
        const sum = rg.bitFields.reduce((s, b) => s + (b.bits || 0), 0);
        if (sum !== cs.length * g.cellBits) err(`${rw}: bitFields = ${sum} bit, cần ${cs.length * g.cellBits}`);
        for (const b of rg.bitFields) if (!b.name || !b.desc || !(b.bits > 0)) err(`${rw}: bitField thiếu name/desc/bits`);
      }
      if (rg.children?.length) checkTiling(rg.children, new Set(cs), `region "${rg.id}"`);
    }
    if (seen.size !== parentSet.size) err(`${where}: các region trong ${label} phủ ${seen.size}/${parentSet.size} ô (thiếu ${parentSet.size - seen.size})`);
  };
  if (!f.regions?.length) err(`${where}: không có regions`);
  else checkTiling(f.regions, new Set(Array.from({ length: total }, (_, i) => i)), "lưới");
  if (f.unit && !MUX[f.unit]) err(`${where}: unit "${f.unit}" không có trong TMUX`);
  if (f.unit && MUX[f.unit]?.bytesPer125us !== undefined) {
    const b = (bits / 8) * (125 / f.periodUs);
    if (Math.abs(b - MUX[f.unit].bytesPer125us) > 1e-9) err(`${where}: ${b} byte/125µs ≠ unit "${f.unit}" ${MUX[f.unit].bytesPer125us}`);
  }
}

for (const [key, u] of Object.entries(MUX)) {
  const where = `unit "${key}"`;
  if (u.id !== key) err(`${where}: id khác key`);
  if (!FAMILIES.includes(u.family)) err(`${where}: family sai`);
  if (!UNIT_KINDS.includes(u.kind)) err(`${where}: kind "${u.kind}" không hợp lệ`);
  for (const k of ["name", "summary", "desc"]) if (!u[k]) err(`${where}: thiếu ${k}`);
  const hasB = u.bytesPer125us !== undefined, hasR = u.rateKbps !== undefined;
  if (hasB === hasR) err(`${where}: cần đúng một trong bytesPer125us / rateKbps`);
  if (u.frame && !FR[u.frame]) err(`${where}: frame "${u.frame}" không tồn tại`);
  for (const [i, a] of (u.accepts || []).entries()) {
    const aw = `${where} › accepts[${i}] (${a.count}×${a.of})`;
    const ch = MUX[a.of];
    if (!ch) { err(`${aw}: không có unit "${a.of}"`); continue; }
    if (!(Number.isInteger(a.count) && a.count > 0)) { err(`${aw}: count sai`); continue; }
    const oh = a.overhead?.bytes || 0;
    if (!hasB) { err(`${aw}: unit có accepts phải tính theo bytesPer125us`); continue; }
    if (ch.bytesPer125us !== undefined) {
      const want = a.count * ch.bytesPer125us + oh;
      if (Math.abs(want - u.bytesPer125us) > 1e-9) err(`${aw}: ${a.count}×${ch.bytesPer125us} + OH ${oh} = ${want} ≠ ${u.bytesPer125us}`);
    } else {
      const cap = (u.bytesPer125us - oh) * 64;
      if (a.count * ch.rateKbps > cap) err(`${aw}: ${a.count}×${ch.rateKbps} kbps > dung lượng ${cap} kbps`);
    }
  }
}

for (const lab of LABS) {
  const where = `lab "${lab.id}"`;
  if (!lab.id || !lab.name || !lab.intro) err(`${where}: thiếu id/name/intro`);
  for (const id of [...(lab.roots || []), ...(lab.palette || [])]) if (!MUX[id]) err(`${where}: "${id}" không có trong TMUX`);
}

console.log(`Frame: ${Object.keys(FR).length}, Unit: ${Object.keys(MUX).length}, Lab: ${LABS.length}, File: ${files.join(", ")}`);
for (const [k, s, r] of table) console.log(`  ${k.padEnd(14)} ${s.padEnd(10)} ${r} kbps`);
if (warns.length) console.log(`\nCẢNH BÁO (${warns.length}):\n  - ` + warns.join("\n  - "));
if (errors.length) { console.log(`\nLỖI (${errors.length}):\n  - ` + errors.slice(0, 80).join("\n  - ")); process.exit(1); }
console.log("\nOK – dữ liệu truyền dẫn hợp lệ.");
