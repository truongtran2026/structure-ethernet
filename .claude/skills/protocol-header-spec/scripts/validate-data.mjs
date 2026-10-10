#!/usr/bin/env node
// Kiểm tra dữ liệu header/stack theo references/data-schema.md.
// Dùng: node validate-data.mjs <thư mục project>   (mặc định: thư mục hiện tại)
// Thoát mã 1 nếu có lỗi. In bảng kích thước header để đối chiếu nhanh.
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = path.resolve(process.argv[2] || ".");
const dataDir = path.join(root, "data");
const LAYERS = ["phy", "l2", "l2_5", "l3", "l4", "tunnel", "payload", "trailer"];
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

if (!fs.existsSync(dataDir)) {
  console.error(`Không thấy thư mục ${dataDir}`);
  process.exit(1);
}

// Nạp file theo đúng thứ tự index.html: headers-* trước, stacks.js sau.
const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".js")).sort((a, b) => {
  const rank = (f) => (f.startsWith("headers") ? 0 : f === "stacks.js" ? 2 : 1);
  return rank(a) - rank(b) || a.localeCompare(b);
});
const ctx = { window: {} };
vm.createContext(ctx);
for (const f of files) {
  try {
    vm.runInContext(fs.readFileSync(path.join(dataDir, f), "utf8"), ctx, { filename: f });
  } catch (e) {
    err(`[${f}] lỗi cú pháp/chạy: ${e.message}`);
  }
}
const HEADERS = ctx.window.HEADERS || {};
const STACKS = ctx.window.STACKS || [];

function walk(nodes, visit, parentOptional = null) {
  for (const n of nodes || []) {
    const opt = n.optional || parentOptional;
    visit(n, opt);
    if (n.children) walk(n.children, visit, opt);
  }
}

const sizeTable = [];
for (const [key, h] of Object.entries(HEADERS)) {
  const where = `header "${key}"`;
  if (h.id !== key) err(`${where}: id "${h.id}" khác key`);
  if (!h.name) err(`${where}: thiếu name`);
  if (!LAYERS.includes(h.layer)) err(`${where}: layer "${h.layer}" không hợp lệ`);
  if (!h.summary) err(`${where}: thiếu summary`);
  if (!h.standard) warn(`${where}: thiếu standard`);
  if (!Array.isArray(h.fields) || !h.fields.length) { err(`${where}: không có fields`); continue; }

  const ids = new Set();
  let fixedBits = 0, optBits = 0, varMax = 0;
  const optionalIds = new Set();
  walk(h.fields, (n, opt) => {
    if (!n.id) err(`${where}: node "${n.name}" thiếu id`);
    else if (ids.has(n.id)) err(`${where}: id trùng "${n.id}"`);
    else ids.add(n.id);
    if (n.optional) optionalIds.add(n.id);
    if (!n.name) err(`${where}: node "${n.id}" thiếu name`);
    if (!n.desc) err(`${where}: node "${n.id}" thiếu desc`);
    if (n.children) {
      if (!n.children.length) err(`${where}: group "${n.id}" rỗng`);
      if (n.bits !== undefined) err(`${where}: group "${n.id}" không được có bits`);
      return;
    }
    const hasBits = n.bits !== undefined, hasVar = n.varBytes !== undefined;
    if (hasBits === hasVar) { err(`${where}: field "${n.id}" phải có đúng một trong bits / varBytes`); return; }
    if (hasBits) {
      if (!Number.isInteger(n.bits) || n.bits <= 0) err(`${where}: field "${n.id}" bits không hợp lệ`);
      else if (opt) optBits += n.bits;
      else fixedBits += n.bits;
    } else {
      const v = n.varBytes;
      if (!(v.min >= 0 && v.max >= v.min)) err(`${where}: field "${n.id}" varBytes min/max sai`);
      varMax += v.max || 0;
    }
  });
  h.__ids = ids;
  h.__optional = optionalIds;
  if (fixedBits !== (h.fixedBytes ?? 0) * 8)
    err(`${where}: tổng bit cố định = ${fixedBits} (${fixedBits / 8} byte) nhưng fixedBytes = ${h.fixedBytes}`);
  if (optBits % 8) err(`${where}: tổng bit optional = ${optBits}, không chia hết cho 8`);
  const maxCalc = fixedBits / 8 + optBits / 8 + varMax;
  if (h.maxBytes !== undefined && h.maxBytes !== maxCalc)
    warn(`${where}: maxBytes = ${h.maxBytes} nhưng tính được ${maxCalc}`);
  sizeTable.push([key, h.layer, h.fixedBytes, maxCalc]);

  // Biến thể: tự tính kích thước và so với `bytes`.
  const hasVariable = optionalIds.size > 0 || varMax > 0;
  if (hasVariable && key !== "payload" && !h.variants?.length)
    err(`${where}: có field optional/varBytes nhưng thiếu variants`);
  const vIds = new Set();
  for (const v of h.variants || []) {
    const vw = `${where} › variant "${v.id}"`;
    if (!v.id || vIds.has(v.id)) err(`${vw}: id thiếu hoặc trùng`);
    vIds.add(v.id);
    if (!v.name) err(`${vw}: thiếu name`);
    const on = new Set(v.enable || []);
    for (const id of on) if (!optionalIds.has(id)) err(`${vw}: enable "${id}" không phải node optional`);
    for (const id of Object.keys(v.set || {})) if (!ids.has(id)) err(`${vw}: set.${id} không có trong header`);
    let bits = 0;
    const sum = (nodes, present) => {
      for (const n of nodes) {
        const here = present && (!n.optional || on.has(n.id));
        if (n.children) { sum(n.children, here); continue; }
        if (!here) continue;
        if (n.bits) bits += n.bits;
        else if (n.varBytes) {
          const want = v.varBytes?.[n.id] ?? n.varBytes.default ?? n.varBytes.min;
          if (want < n.varBytes.min || want > n.varBytes.max) err(`${vw}: varBytes.${n.id}=${want} ngoài [${n.varBytes.min}, ${n.varBytes.max}]`);
          bits += want * 8;
        }
      }
    };
    sum(h.fields, true);
    for (const id of Object.keys(v.varBytes || {})) {
      let found = false;
      walk(h.fields, (n) => { if (n.id === id && n.varBytes) found = true; });
      if (!found) err(`${vw}: varBytes.${id} không phải field varBytes`);
    }
    if (bits / 8 !== v.bytes) err(`${vw}: bytes = ${v.bytes} nhưng tính được ${bits / 8}`);
  }
}

const stackIds = new Set();
for (const s of STACKS) {
  const where = `stack "${s.id}"`;
  if (!s.id) { err(`stack thiếu id: ${s.name}`); continue; }
  if (stackIds.has(s.id)) err(`${where}: id trùng`);
  stackIds.add(s.id);
  for (const k of ["name", "category", "summary", "detail"]) if (!s[k]) err(`${where}: thiếu ${k}`);
  if (!Array.isArray(s.tree) || !s.tree.length) { err(`${where}: tree rỗng`); continue; }
  const ROLES = ["link", "delivery", "encap", "passenger"];
  const visit = (nodes, parentRole) => {
    for (const n of nodes) {
      if (n.role !== undefined && !ROLES.includes(n.role)) err(`${where}: role "${n.role}" không hợp lệ`);
      const role = n.role ?? parentRole;
      if (n.group) { if (!n.children?.length) err(`${where}: group "${n.group}" rỗng`); else visit(n.children, role); continue; }
      if (!role) err(`${where}: header "${n.header}"${n.label ? ` (${n.label})` : ""} thiếu role`);
      const h = HEADERS[n.header];
      if (!h) { err(`${where}: header "${n.header}" không tồn tại`); continue; }
      for (const fid of Object.keys(n.set || {}))
        if (!h.__ids?.has(fid)) err(`${where}: set.${fid} không có trong header "${n.header}"`);
      for (const fid of n.enable || [])
        if (!h.__optional?.has(fid)) err(`${where}: enable "${fid}" không phải node optional của "${n.header}"`);
      for (const fid of Object.keys(n.varBytes || {}))
        if (!h.__ids?.has(fid)) err(`${where}: varBytes.${fid} không có trong header "${n.header}"`);
    }
  };
  visit(s.tree);
  // Stack có compareTo phải đánh dấu tường minh header được thêm (StackNode.added).
  const hasAdded = (nodes) => nodes.some((n) => n.added === true || (n.children && hasAdded(n.children)));
  if (s.compareTo && !hasAdded(s.tree)) err(`${where}: có compareTo nhưng không node nào có added: true`);
}
for (const s of STACKS)
  if (s.compareTo && !stackIds.has(s.compareTo)) err(`stack "${s.id}": compareTo "${s.compareTo}" không tồn tại`);

console.log(`Header: ${Object.keys(HEADERS).length}, Stack: ${STACKS.length}, File: ${files.join(", ")}`);
console.log("\nKích thước header (byte):");
for (const [k, l, f, m] of sizeTable) console.log(`  ${k.padEnd(16)} ${l.padEnd(8)} cố định=${String(f).padStart(3)}  tối đa=${m}`);
if (warns.length) console.log(`\nCẢNH BÁO (${warns.length}):\n  - ` + warns.join("\n  - "));
if (errors.length) {
  console.log(`\nLỖI (${errors.length}):\n  - ` + errors.join("\n  - "));
  process.exit(1);
}
console.log("\nOK – dữ liệu hợp lệ.");
