/*
 * calc.js — "Máy tính tốc độ" (view #calc).
 *  1) Phần thuần (RateCalc, xuất cả module.exports để test bằng Node) — mọi con số lấy từ TMUX/TFRAMES/STACKS
 *     qua logic sẵn có của lab (TransViz.lab: maxCount, stepsUp, fill, account…) và EthViz.buildModel:
 *       unitInfo, chains (chuỗi ghép lên từng khung đích), fitMax (U chứa tối đa bao nhiêu X),
 *       gfp (tốc độ Ethernet mang qua GFP-F) + gfpTargets (vừa/không vừa VCG/ODUflex/OPU), stackEff.
 *  2) Phần giao diện (CalcView, chỉ khi có document).
 */
(function (root) {
  'use strict';

  function L() { return root.TransViz && root.TransViz.lab; }
  function nm(M, id) { return L() ? L().nameOf(M, id) : id; }
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }

  // ---------- đơn vị ----------
  /** Thông tin một đơn vị: tốc độ, byte/125 µs (đơn vị theo byte), khung (chu kỳ, kích thước), VCG, bể TS. */
  function unitInfo(M, F, id) {
    var u = M[id];
    if (!u) return null;
    var lab = L();
    var out = { id: id, name: nm(M, id), fullName: u.name, kind: u.kind, family: u.family, kbps: lab.unitKbps(M, id),
      bytes: lab.isByteUnit(M, id) ? u.bytesPer125us : null, summary: u.summary || '', desc: u.desc || '', standard: u.standard || '' };
    var f = u.frame && F && F[u.frame];
    if (f && f.grid) {
      out.frame = { id: f.id, name: f.name, periodUs: f.periodUs, rows: f.grid.rows, cols: f.grid.cols, cellBits: f.grid.cellBits,
        bits: f.grid.rows * f.grid.cols * f.grid.cellBits, rateKbps: f.rateKbps, multiframe: f.multiframe ? f.multiframe.frames : 0,
        framesPerSec: 1e6 / f.periodUs };
    }
    if (u.members) out.members = { of: u.members.of, count: u.members.count, payloadOf: u.members.payloadOf };
    if (u.tribSlots) out.pool = lab.poolInfo(M, id);
    return out;
  }

  /** Gốc (khung đích) để xét chuỗi ghép: gốc của mọi lab (theo thứ tự lab), không trùng. */
  function rootsOf(M, labs) {
    var out = [];
    (labs || []).forEach(function (l) { (l.roots || []).forEach(function (r) { if (M[r] && out.indexOf(r) < 0) out.push(r); }); });
    return out;
  }

  /**
   * Chuỗi ghép từ đơn vị id lên từng khung đích R: [{ root, vcg, steps: [{ u, name, kbps, ohKbps, ohLabel, count,
   * mapping, fit (số id chứa được ở cấp này), effPct (tải id / tốc độ cấp này khi đầy) }] }].
   * Đi trực tiếp theo accepts (stepsUp) hoặc qua VCG (stepsUpVcg) như lab "Đóng gói từng bước".
   */
  function chains(M, labs, id) {
    var lab = L(), out = [];
    rootsOf(M, labs).forEach(function (R) {
      if (R === id) return;
      var routes = [];
      if (lab.pathDown(M, R, id)) routes.push(null);
      else lab.vcgsFor(M, id).forEach(function (c) { if (lab.vcgMax(M, R, c.v) > 0) routes.push(c.v); });
      routes.forEach(function (v) {
        var steps = v ? lab.stepsUpVcg(M, R, id, v) : lab.stepsUp(M, R, id);
        if (!steps || steps.length < 2) return;
        var clientK = steps[1].carriedKbps != null ? steps[1].carriedKbps : lab.unitKbps(M, id);
        var mem = v && M[v].members;
        out.push({ root: R, vcg: v, clientKbps: clientK, steps: steps.map(function (s, i) {
          var fit, eff;
          if (!v) { fit = lab.maxCount(M, s.u, id); eff = s.kbps ? fit * clientK / s.kbps * 100 : 0; }
          else if (i === 0) { fit = 1; eff = 100; }
          else if (s.vcgStep === 'vcg') { fit = 1; eff = clientK / s.kbps * 100; }
          else {
            var mc = lab.maxCount(M, s.u, mem.of);
            fit = Math.floor(mc / mem.count);
            eff = mc ? clientK * mc / (mem.count * s.kbps) * 100 : 0;
          }
          return { u: s.u, name: nm(M, s.u), kbps: s.kbps, bytes: lab.isByteUnit(M, s.u) ? s.bytes : null,
            count: s.count || 0, ohKbps: s.ohKbps || 0, ohLabel: i ? lab.ohLabel({ overhead: s.overhead }) : '',
            ohName: s.overhead && s.overhead.name || '', mapping: s.mapping || '', slots: s.slots || 0, justKbps: s.justKbps || 0,
            vcgStep: s.vcgStep || '', fit: fit, effPct: eff };
        }) });
      });
    });
    return out;
  }

  /** Các X mà R chứa được (≥ 1), sắp theo level. */
  function fitCandidates(M, R) {
    var lab = L();
    return Object.keys(M).filter(function (X) {
      if (X === R) return false;
      return lab.maxCount(M, R, X) > 0 || lab.vcgMax(M, R, X) > 0;
    }).sort(function (a, b) { return (M[a].level || 0) - (M[b].level || 0) || (a < b ? -1 : 1); });
  }

  /**
   * R chứa tối đa bao nhiêu X: { max, via: 'tree'|'vcg', vcg, clientKbps (mỗi X), usedKbps, totalKbps, effPct,
   *   spareKbps (= tổng − tải X), breakdown? (lab fill + account: overhead, chèn, còn trống — chỉ khi X là client) }.
   */
  function fitMax(M, R, X, opts) {
    var lab = L();
    opts = opts || {};
    if (!M[R] || !M[X]) return null;
    var res = { root: R, unit: X, totalKbps: lab.unitKbps(M, R), via: 'tree', vcg: null };
    var n = lab.maxCount(M, R, X), clientK;
    if (n > 0) {
      var st = lab.stepsUp(M, R, X);
      clientK = st && st[1] && st[1].carriedKbps != null ? st[1].carriedKbps : lab.unitKbps(M, X);
    } else if (M[X].members) {
      n = lab.vcgMax(M, R, X); res.via = 'vcg'; res.vcg = X; clientK = lab.unitKbps(M, X);
    } else {
      var best = null;
      lab.vcgsFor(M, X).forEach(function (c) { var k = lab.vcgMax(M, R, c.v); if (!best || k > best.k) best = { v: c.v, k: k }; });
      n = best ? best.k : 0; res.via = 'vcg'; res.vcg = best && best.v;
      clientK = best ? lab.vcgNeedKbps(M, best.v, X) : lab.unitKbps(M, X);
    }
    res.max = n;
    // maxPorts (OPUCn) ràng buộc: n = số đặt trực tiếp vào TS; nested = số tối đa qua ODU lồng (vd ODU4 chứa 80 ODU0)
    if (res.via === 'tree' && n > 0 && lab.portsBinding && lab.portsBinding(M, R, X)) {
      res.direct = n; res.nested = lab.maxCountNested(M, R, X);
      var seen = {}, queue = [R], pool = null;
      while (queue.length && !pool) {
        var cu = queue.shift(); if (seen[cu] || !M[cu]) continue; seen[cu] = 1;
        if (M[cu].tribSlots && M[cu].tribSlots.maxPorts) pool = cu;
        (M[cu].accepts || []).forEach(function (a) { queue.push(a.of); });
      }
      if (pool) {
        res.poolUnit = pool; res.maxPorts = M[pool].tribSlots.maxPorts;
        (M[pool].accepts || []).forEach(function (a) {
          if (!a.slots || a.of === X) return;
          var m = lab.maxCountNested(M, a.of, X);
          if (m > 1 && (!res.nestedVia || m > res.nestedVia.m)) res.nestedVia = { u: a.of, m: m };
        });
      }
    }
    res.clientKbps = clientK;
    res.usedKbps = n * clientK;
    res.effPct = res.totalKbps ? res.usedKbps / res.totalKbps * 100 : 0;
    res.spareKbps = res.totalKbps - res.usedKbps;
    // kế toán chi tiết như lab (lấp đầy rồi tính) — chỉ cho client đi thẳng theo cây, giới hạn kích thước
    if (n > 0 && res.via === 'tree' && lab.isClient(M, X) && n <= (opts.maxFill || 20000)) {
      try {
        var t = lab.newRoot(M, R);
        var placed = lab.fill(M, t, [], X);
        var a = lab.account(M, t);
        res.breakdown = { placed: placed, clientKbps: a.clientKbps, overheadKbps: a.overheadKbps, justificationKbps: a.justificationKbps,
          emptyKbps: a.emptyKbps, totalKbps: a.totalKbps };
      } catch (e) { /* bỏ qua chi tiết */ }
    }
    return res;
  }

  // ---------- Ethernet qua GFP-F ----------
  /**
   * Hằng số mặc định (IEEE 802.3 / ITU-T G.7041). Lấy từ dữ liệu header khi có (gfpBytesFrom), không thì dùng số này.
   * Trên đường Ethernet mỗi khung chiếm L + 8 (preamble/SFD) + 12 (IFG tối thiểu); GFP-F bỏ preamble/IFG,
   * thêm core header 4 + payload header 4 (+ extension, + pFCS tuỳ chọn).
   */
  var GFP_DEF = { preamble: 8, ifg: 12, core: 4, type: 4, ext: 4, pfcs: 4 };
  function gfpBytesFrom(H) {
    var g = function (id, d) { return H && H[id] && H[id].fixedBytes > 0 ? H[id].fixedBytes : d; };
    return { preamble: g('phy-preamble', GFP_DEF.preamble), ifg: GFP_DEF.ifg, core: g('gfp-core', GFP_DEF.core), type: g('gfp-payload-hdr', GFP_DEF.type),
      ext: g('gfp-ext-linear', GFP_DEF.ext), pfcs: g('gfp-pfcs', GFP_DEF.pfcs) };
  }
  /**
   * Tốc độ cần khi mang Ethernet (tốc độ đường truyền rateKbps, khung L byte gồm MAC header…FCS) qua GFP-F:
   * need = rate × (L + gfpOH) / (L + preamble + IFG). L = 1518, OH 8 → tỉ lệ 1526/1538.
   */
  function gfp(L0, rateKbps, opts) {
    opts = opts || {};
    var b = opts.bytes || GFP_DEF;
    var oh = b.core + b.type + (opts.ext ? b.ext : 0) + (opts.pfcs ? b.pfcs : 0);
    var wire = L0 + b.preamble + b.ifg;
    var ratio = (L0 + oh) / wire;
    return { L: L0, ohBytes: oh, gfpFrame: L0 + oh, wireBytes: wire, ratio: ratio, rateKbps: rateKbps, needKbps: rateKbps * ratio,
      macKbps: rateKbps * L0 / wire, framesPerSec: rateKbps * 1000 / (wire * 8) };
  }
  function isGfp(a) { return /GFP/i.test(String(a && a.mapping || '')); }
  /** Ethernet client trong dữ liệu đi qua GFP-F: [{ id, name, kbps }]. */
  function gfpClients(M) {
    var ids = [];
    Object.keys(M).forEach(function (k) { (M[k].accepts || []).forEach(function (a) { if (isGfp(a) && M[a.of] && ids.indexOf(a.of) < 0) ids.push(a.of); }); });
    return ids.map(function (id) { return { id: id, name: nm(M, id), kbps: L().unitKbps(M, id) }; }).sort(function (a, b) { return a.kbps - b.kbps; });
  }
  /**
   * Vật chứa GFP-F (VCG, OPU, ODUflex… — mọi đơn vị có phương án ánh xạ GFP): dung lượng tải = tốc độ − overhead
   * của phương án; fits = needKbps ≤ dung lượng. Sắp theo dung lượng.
   */
  function gfpTargets(M, needKbps) {
    var lab = L(), out = [];
    Object.keys(M).forEach(function (P) {
      var opts = (M[P].accepts || []).filter(isGfp);
      if (!opts.length) return;
      var a = opts[0];
      var cap = lab.unitKbps(M, P) - lab.ohKbps(a);
      out.push({ id: P, name: nm(M, P), kind: M[P].kind, family: M[P].family, capKbps: cap, mapping: a.mapping || '',
        clients: opts.map(function (x) { return nm(M, x.of); }), fits: needKbps <= cap + 1e-9, fillPct: cap > 0 ? needKbps / cap * 100 : Infinity });
    });
    return out.sort(function (x, y) { return x.capKbps - y.capKbps; });
  }

  // ---------- hiệu suất stack IP ----------
  /**
   * Hiệu suất tải của stack với payload P byte: đặt mọi header lớp payload (field varBytes) = P (kẹp trong [min, max]
   * của dữ liệu). { frameBytes, payloadBytes, overheadBytes, effPct, wireBytes, P, clamped, headers: [...] }.
   */
  function stackEff(EV, stack, P, headers, stacks) {
    if (!EV || !stack) return null;
    var m0 = EV.buildModel(stack, {}, headers, stacks);
    var state = { varBytes: {} }, clamped = null, n = 0;
    m0.headers.forEach(function (h) {
      if (h.layer !== 'payload' || !h.header) return;
      (function walk(list) {
        (list || []).forEach(function (d) {
          if (d.children) { walk(d.children); return; }
          if (!d.varBytes) return;
          var v = Math.max(0, Math.round(+P || 0));
          if (d.varBytes.min != null && v < d.varBytes.min) { v = d.varBytes.min; clamped = v; }
          if (d.varBytes.max != null && v > d.varBytes.max) { v = d.varBytes.max; clamped = v; }
          (state.varBytes[h.path] = state.varBytes[h.path] || {})[d.id] = v;
          n++;
        });
      })(h.header.fields);
    });
    var m = EV.buildModel(stack, state, headers, stacks);
    var t = m.totals;
    return { stack: stack.id, P: +P, clamped: clamped, payloadFields: n, frameBytes: t.frameBytes, payloadBytes: t.payloadBytes,
      overheadBytes: t.overheadBytes, effPct: t.frameBytes ? t.payloadBytes / t.frameBytes * 100 : 0, wireBytes: t.wireBytes,
      headers: m.headers.map(function (h) { return { name: h.label || h.name, short: h.short || h.name, bytes: h.bits / 8, layer: h.layer, wire: !!h.wire, role: h.role || null }; }) };
  }

  var api = { unitInfo: unitInfo, rootsOf: rootsOf, chains: chains, fitCandidates: fitCandidates, fitMax: fitMax,
    GFP_DEF: GFP_DEF, gfpBytesFrom: gfpBytesFrom, gfp: gfp, gfpClients: gfpClients, gfpTargets: gfpTargets, stackEff: stackEff };
  root.RateCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // =====================================================================
  // Giao diện (chỉ trình duyệt)
  // =====================================================================
  if (typeof document === 'undefined') return;

  var STORE_KEY = 'fs.calc.v1';
  var cv = { active: false, built: false, st: null };
  var FAM = { pdh: 'PDH', sdh: 'SDH', otn: 'OTN' };

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function sSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  function TV() { return root.TransViz; }
  function MUX() { return root.TMUX || {}; }
  function n(x, d) { return TV() ? TV().fmtNum(x, d == null ? 2 : d) : String(x); }
  function rate(k) { return TV() ? TV().fmtRate(k) : n(k) + ' kbit/s'; }
  function pct(x) { return isFinite(x) ? n(x, 1) + '%' : '–'; }
  function bar(p) { var w = Math.max(0, Math.min(100, p)); return '<span class="effbar" aria-hidden="true"><span style="width:' + w + '%"></span></span>'; }
  function stat(label, value, sub) {
    return '<div class="stat"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + value + '</div>' + (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
  }
  function save() { sSet(STORE_KEY, cv.st); }
  function loadSt() {
    var s = sGet(STORE_KEY);
    if (!s || typeof s !== 'object') s = {};
    var M = MUX(), ids = Object.keys(M);
    if (!M[s.unit]) s.unit = M['stm-1'] ? 'stm-1' : ids[0];
    if (!M[s.root]) s.root = M['stm-1'] ? 'stm-1' : (ids.filter(function (k) { return M[k].accepts && M[k].accepts.length; })[0] || ids[0]);
    if (!M[s.client]) s.client = null;
    s.L = Math.min(9618, Math.max(64, Math.round(+s.L || 1518)));
    if (typeof s.eth !== 'string') s.eth = '';
    s.custom = +s.custom > 0 ? +s.custom : 1000;
    s.ext = !!s.ext; s.pfcs = !!s.pfcs;
    var S = root.STACKS || [];
    if (!S.some(function (x) { return x.id === s.stack; })) s.stack = S[0] ? S[0].id : null;
    s.P = Math.max(0, Math.round(+s.P >= 0 && s.P !== '' && s.P != null ? +s.P : 1000));
    if (typeof s.q !== 'string') s.q = '';
    return s;
  }

  /** <option> các đơn vị nhóm theo family; filter: hàm lọc id; q: chuỗi tìm. */
  function unitOptions(sel, filter, q) {
    var M = MUX(), groups = {};
    q = String(q || '').trim().toLowerCase();
    Object.keys(M).forEach(function (id) {
      if (filter && !filter(id)) return;
      var u = M[id];
      if (q && (id + ' ' + u.name + ' ' + (u.kind || '')).toLowerCase().indexOf(q) < 0 && id !== sel) return;
      (groups[u.family || 'khác'] = groups[u.family || 'khác'] || []).push(id);
    });
    return Object.keys(groups).sort(function (a, b) { return (FAM[a] ? Object.keys(FAM).indexOf(a) : 9) - (FAM[b] ? Object.keys(FAM).indexOf(b) : 9); }).map(function (f) {
      var list = groups[f].sort(function (a, b) { return (M[a].level || 0) - (M[b].level || 0) || (a < b ? -1 : 1); });
      return '<optgroup label="' + esc(FAM[f] || f) + '">' + list.map(function (id) {
        return '<option value="' + esc(id) + '"' + (id === sel ? ' selected' : '') + '>' + esc(nm(M, id)) + ' — ' + esc(rate(L().unitKbps(M, id))) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }

  function build() {
    var M = MUX(), s = cv.st, S = root.STACKS || [];
    var hasT = Object.keys(M).length > 0 && !!L();
    var clients = hasT ? gfpClients(M) : [];
    var html =
      '<section class="stack-head"><div class="head-top"><span class="eyebrow">Công cụ · tính từ dữ liệu</span>' +
      '<h1 class="stack-title">Máy tính tốc độ</h1>' +
      '<p class="stack-summary">Tốc độ, chuỗi ghép kênh, số nhánh tối đa, Ethernet qua GFP-F và hiệu suất tải của stack IP — cùng quy tắc với phòng thí nghiệm ghép kênh.</p></div></section>';
    if (hasT) {
      html +=
        '<section class="card calc-card" aria-labelledby="c1-t"><div class="section-title"><h2 id="c1-t">1. Đơn vị: tốc độ &amp; chuỗi ghép lên khung đích</h2></div>' +
        '<div class="calc-form"><label><span>Tìm</span><input type="search" data-cin="q" value="' + esc(s.q) + '" placeholder="vd E1, VC-12, ODU2…" autocomplete="off"></label>' +
        '<label><span>Đơn vị</span><select data-cin="unit">' + unitOptions(s.unit, null, s.q) + '</select></label></div>' +
        '<div data-cout="unit"></div></section>' +
        '<section class="card calc-card" aria-labelledby="c2-t"><div class="section-title"><h2 id="c2-t">2. Khung/đơn vị chứa tối đa bao nhiêu nhánh</h2></div>' +
        '<div class="calc-form"><label><span>Chứa (đích)</span><select data-cin="root">' + unitOptions(s.root, function (id) { return M[id].accepts && M[id].accepts.length && !M[id].members; }) + '</select></label>' +
        '<label><span>Nhánh (client)</span><select data-cin="client"></select></label></div>' +
        '<div data-cout="fit"></div></section>';
      if (clients.length) {
        html += '<section class="card calc-card" aria-labelledby="c3-t"><div class="section-title"><h2 id="c3-t">3. Ethernet qua GFP-F</h2></div>' +
          '<div class="calc-form"><label><span>Khung Ethernet L (byte, 64–9618)</span><input type="number" min="64" max="9618" step="1" data-cin="L" value="' + s.L + '"></label>' +
          '<label><span>Tốc độ Ethernet</span><select data-cin="eth">' + clients.map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (c.id === s.eth ? ' selected' : '') + '>' + esc(c.name) + ' — ' + esc(rate(c.kbps)) + '</option>';
          }).join('') + '<option value=""' + (s.eth ? '' : ' selected') + '>Tự nhập…</option></select></label>' +
          '<label data-cshow="custom"' + (s.eth ? ' hidden' : '') + '><span>Mbit/s</span><input type="number" min="0.001" step="any" data-cin="custom" value="' + s.custom + '"></label>' +
          '<label class="calc-chk"><input type="checkbox" data-cin="ext"' + (s.ext ? ' checked' : '') + '> Extension header (+' + gfpBytesFrom(root.HEADERS).ext + ' B)</label>' +
          '<label class="calc-chk"><input type="checkbox" data-cin="pfcs"' + (s.pfcs ? ' checked' : '') + '> pFCS (+' + gfpBytesFrom(root.HEADERS).pfcs + ' B)</label></div>' +
          '<div data-cout="gfp"></div></section>';
      }
    }
    if (S.length && root.EthViz) {
      html += '<section class="card calc-card" aria-labelledby="c4-t"><div class="section-title"><h2 id="c4-t">' + (hasT ? '4' : '1') + '. Hiệu suất tải của stack IP</h2></div>' +
        '<div class="calc-form"><label><span>Stack</span><select data-cin="stack">' + S.map(function (st) {
          return '<option value="' + esc(st.id) + '"' + (st.id === s.stack ? ' selected' : '') + '>' + esc(st.name || st.id) + '</option>';
        }).join('') + '</select></label>' +
        '<label><span>Payload P (byte)</span><input type="number" min="0" step="1" data-cin="P" value="' + s.P + '"></label></div>' +
        '<div data-cout="stack"></div></section>';
    }
    $('#view-calc').innerHTML = html;
    cv.built = true;
    fillClients();
    update();
  }

  function fillClients() {
    var sel = $('#view-calc [data-cin="client"]');
    if (!sel) return;
    var M = MUX(), cands = fitCandidates(M, cv.st.root);
    if (cands.indexOf(cv.st.client) < 0) {
      // mặc định: client nhỏ nhất (không còn accepts) hoặc đơn vị đầu
      cv.st.client = cands.filter(function (x) { return L().isClient(M, x); })[0] || cands[0] || null;
    }
    sel.innerHTML = cands.map(function (id) {
      return '<option value="' + esc(id) + '"' + (id === cv.st.client ? ' selected' : '') + '>' + esc(nm(M, id)) + ' — ' + esc(rate(L().unitKbps(M, id))) + '</option>';
    }).join('');
  }

  function update() {
    var o;
    if ((o = $('#view-calc [data-cout="unit"]'))) o.innerHTML = renderUnit();
    if ((o = $('#view-calc [data-cout="fit"]'))) o.innerHTML = renderFit();
    if ((o = $('#view-calc [data-cout="gfp"]'))) o.innerHTML = renderGfp();
    if ((o = $('#view-calc [data-cout="stack"]'))) o.innerHTML = renderStack();
    save();
  }

  function renderUnit() {
    var M = MUX(), info = unitInfo(M, root.TFRAMES || {}, cv.st.unit);
    if (!info) return '<p class="muted">Chọn một đơn vị.</p>';
    var cards = stat('Tốc độ', esc(rate(info.kbps)), esc(n(info.kbps, 3)) + ' kbit/s') +
      (info.bytes != null ? stat('Byte mỗi 125 µs', esc(n(info.bytes, 3)), '× 64 kbit/s = tốc độ') : '');
    if (info.frame) {
      var fb = info.frame.bits / 8;
      cards += stat('Chu kỳ khung', esc(n(info.frame.periodUs, 3)) + ' µs', esc(n(info.frame.framesPerSec, 1)) + ' khung/s' + (info.frame.multiframe ? ' · đa khung ' + info.frame.multiframe : '')) +
        stat('Kích thước khung', esc(info.frame.cellBits === 8 ? n(fb, 0) + ' byte' : n(info.frame.bits, 0) + ' bit'), esc(info.frame.rows + ' × ' + info.frame.cols) + (info.frame.cellBits === 1 ? ' bit' : ' ô'));
    }
    if (info.members) cards += stat('Thành viên', esc(info.members.count + ' × ' + nm(M, info.members.of)), 'tải: ' + esc(nm(M, info.members.payloadOf)));
    if (info.pool) cards += stat('Tributary slot', esc(info.pool.n + ' TS'), esc(rate(info.pool.kbps)) + ' mỗi TS');
    var html = '<div class="stats">' + cards + '</div>' +
      (info.summary ? '<p class="note calc-note">' + esc(info.summary) + '</p>' : '');
    var ch = chains(M, root.TLABS || [], cv.st.unit);
    if (!ch.length) return html + '<p class="muted">Không có chuỗi ghép từ ' + esc(info.name) + ' lên khung đích nào của các phòng thí nghiệm' + (M[cv.st.unit].accepts && M[cv.st.unit].accepts.length ? ' (đây là đơn vị chứa — xem mục 2).' : '.') + '</p>';
    html += '<h3 class="calc-h3">Chuỗi ghép lên khung đích (' + ch.length + ')</h3>';
    html += ch.map(function (c, k) {
      var last = c.steps[c.steps.length - 1];
      return '<details class="calc-chain"' + (k === 0 ? ' open' : '') + '><summary><b>' + esc(nm(M, c.root)) + '</b>' + (c.vcg ? ' <span class="chip">qua ' + esc(nm(M, c.vcg)) + '</span>' : '') +
        ' <span class="muted">— tối đa ' + esc(n(last.fit, 0)) + ' · hiệu suất ' + esc(pct(last.effPct)) + '</span></summary>' +
        '<div class="tbl-wrap"><table class="values lab-table calc-table"><thead><tr><th>Cấp</th><th class="num">Tốc độ</th><th>Overhead bước này</th><th class="num">Chứa</th><th class="num">Tải ' + esc(info.name) + '</th></tr></thead><tbody>' +
        c.steps.map(function (s, i) {
          var oh = i ? (s.ohLabel ? esc(s.ohLabel) + (s.ohName ? ' <span class="muted">' + esc(s.ohName) + '</span>' : '') : '<span class="muted">0</span>') : '<span class="muted">client</span>';
          if (s.justKbps > 0) oh += '<div class="muted">chèn/dư ' + esc(rate(s.justKbps)) + '</div>';
          if (s.mapping) oh += '<div class="muted">' + esc(s.mapping) + '</div>';
          return '<tr><td>' + (i ? (s.count ? esc(s.count) + '× → ' : '') : '') + '<b>' + esc(s.name) + '</b>' + (s.bytes != null ? ' <span class="muted">' + esc(n(s.bytes, 2)) + ' B/125 µs</span>' : '') + '</td>' +
            '<td class="num">' + esc(rate(s.kbps)) + '</td><td>' + oh + '</td><td class="num">' + esc(n(s.fit, 0)) + '</td>' +
            '<td class="num barcell">' + bar(s.effPct) + ' ' + esc(pct(s.effPct)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="muted calc-small">“Chứa” = số ' + esc(info.name) + (c.vcg ? ' (mỗi cái một ' + esc(nm(M, c.vcg)) + ')' : '') + ' tối đa ở cấp đó; “Tải” = phần tốc độ dành cho ' + esc(info.name) + (c.clientKbps !== L().unitKbps(M, cv.st.unit) ? ' (tốc độ thực mang ' + esc(rate(c.clientKbps)) + ')' : '') + ' khi lấp đầy.</p></details>';
    }).join('');
    return html;
  }

  function renderFit() {
    var M = MUX(), R = cv.st.root, X = cv.st.client;
    if (!X) return '<p class="muted">' + esc(nm(M, R)) + ' không chứa được đơn vị nào khác.</p>';
    var r = fitMax(M, R, X);
    if (!r) return '';
    var html = '<div class="stats">' +
      stat('Tối đa', esc(n(r.max, 0)) + ' × ' + esc(nm(M, X)), r.via === 'vcg' && r.vcg && r.vcg !== X ? 'qua ' + esc(nm(M, r.vcg)) : (r.via === 'vcg' ? 'theo số thành viên' : 'theo cây ghép')) +
      stat('Tải ' + nm(M, X), esc(rate(r.usedKbps)), esc(n(r.max, 0)) + ' × ' + esc(rate(r.clientKbps))) +
      stat('Hiệu suất', esc(pct(r.effPct)), 'trên ' + esc(rate(r.totalKbps))) +
      stat('Còn lại', esc(rate(r.spareKbps)), 'overhead + chèn + chỗ trống') + '</div>';
    if (r.nested) {
      html += '<p class="calc-small"><b>Trực tiếp vào TS: ' + esc(n(r.direct, 0)) + '</b> <span class="muted">(giới hạn ' + esc(n(r.maxPorts, 0)) + ' cổng nhánh của ' + esc(nm(M, r.poolUnit)) + ' — nhiều TS hơn số cổng)</span>' +
        '<br><b>Qua ' + esc(r.nestedVia ? nm(M, r.nestedVia.u) : 'ODU lớn hơn') + ' (lồng): ' + esc(n(r.nested, 0)) + '</b> <span class="muted">(đặt ' + esc(nm(M, X)) + ' trong một ODU lớn rồi ghép ODU đó vào ' + esc(nm(M, r.poolUnit)) + ')</span></p>';
    }
    var b = r.breakdown;
    if (b) {
      var parts = [['Tải khách hàng', b.clientKbps, 'k-payload'], ['Overhead các cấp', b.overheadKbps, 'k-poh'], ['Chèn / bù tốc độ', b.justificationKbps, 'k-stuff'], ['Còn trống', b.emptyKbps, 'k-reserved']];
      html += '<div class="calc-stackbar" role="img" aria-label="Phân bổ dung lượng">' + parts.map(function (p) {
        var w = b.totalKbps ? p[1] / b.totalKbps * 100 : 0;
        return w > 0.05 ? '<span class="' + p[2] + '" style="width:' + w + '%" title="' + esc(p[0] + ': ' + rate(p[1]) + ' (' + pct(w) + ')') + '"></span>' : '';
      }).join('') + '</div>' +
      '<ul class="plain calc-legend">' + parts.map(function (p) {
        return '<li><span class="swatch ' + p[2] + '"></span> ' + esc(p[0]) + ': <b>' + esc(rate(p[1])) + '</b> <span class="muted">(' + esc(pct(b.totalKbps ? p[1] / b.totalKbps * 100 : 0)) + ')</span></li>';
      }).join('') + '</ul>' +
      (b.emptyKbps > 1e-6 ? '<p class="muted calc-small">Còn trống: dung lượng chưa dùng được cho ' + esc(nm(M, X)) + ' (vd TS lẻ, phương án khác).</p>' : '');
    } else if (r.via === 'vcg') {
      html += '<p class="muted calc-small">Đi qua VCAT: mỗi ' + esc(nm(M, r.vcg || X)) + ' gồm ' + esc(M[r.vcg || X].members.count) + ' × ' + esc(nm(M, M[r.vcg || X].members.of)) + ' — xem chi tiết trong phòng thí nghiệm SDH.</p>';
    }
    return html;
  }

  function ethRate() {
    var M = MUX();
    return cv.st.eth && M[cv.st.eth] ? L().unitKbps(M, cv.st.eth) : Math.max(0, +cv.st.custom || 0) * 1000;
  }
  function renderGfp() {
    var M = MUX(), k = ethRate(), bytes = gfpBytesFrom(root.HEADERS);
    var g = gfp(cv.st.L, k, { bytes: bytes, ext: cv.st.ext, pfcs: cv.st.pfcs });
    var html = '<div class="stats">' +
      stat('Tỉ lệ GFP-F', esc(g.gfpFrame + '/' + g.wireBytes), '= ' + esc(n(g.ratio * 100, 3)) + '% · (L+' + g.ohBytes + ')/(L+' + (bytes.preamble + bytes.ifg) + ')') +
      stat('Tốc độ mang qua GFP-F', esc(rate(g.needKbps)), 'từ ' + esc(rate(k)) + ' trên dây') +
      stat('Khung/giây', esc(n(g.framesPerSec, 0)), 'mỗi khung ' + esc(g.wireBytes) + ' B trên dây') +
      stat('Thông lượng MAC', esc(rate(g.macKbps)), 'L/(L+' + (bytes.preamble + bytes.ifg) + ')') + '</div>' +
      '<p class="muted calc-small">Ethernet trên dây: L + ' + bytes.preamble + ' B preamble/SFD + ' + bytes.ifg + ' B IFG. GFP-F bỏ preamble/IFG, thêm core header ' + bytes.core + ' B + payload header ' + bytes.type + ' B' +
      (cv.st.ext ? ' + extension ' + bytes.ext + ' B' : '') + (cv.st.pfcs ? ' + pFCS ' + bytes.pfcs + ' B' : '') + ' (G.7041). Idle frame lấp phần còn lại.</p>';
    var tg = gfpTargets(M, g.needKbps);
    if (tg.length) {
      html += '<div class="tbl-wrap"><table class="values lab-table calc-table"><thead><tr><th>Vật chứa GFP-F</th><th class="num">Dung lượng tải</th><th>Vừa?</th><th class="num">Lấp</th></tr></thead><tbody>' +
        tg.map(function (t) {
          return '<tr class="' + (t.fits ? '' : 'is-off') + '"><td><b>' + esc(t.name) + '</b> <span class="muted">' + esc((FAM[t.family] || t.family || '') + ' · ' + t.mapping) + '</span></td>' +
            '<td class="num">' + esc(rate(t.capKbps)) + '</td><td>' + (t.fits ? '<span class="vcg-ok">✓ vừa</span>' : '<span class="vcg-bad">✗ không vừa</span>') + '</td>' +
            '<td class="num barcell">' + (t.fits ? bar(t.fillPct) + ' ' : '') + esc(pct(t.fillPct)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="muted calc-small">Dung lượng tải = tốc độ vật chứa − overhead của phương án GFP trong dữ liệu (VCG: số thành viên × C-n).</p>';
    }
    return html;
  }

  function renderStack() {
    var S = root.STACKS || [], st = S.filter(function (x) { return x.id === cv.st.stack; })[0];
    if (!st) return '';
    var r;
    try { r = stackEff(root.EthViz, st, cv.st.P, root.HEADERS, S); } catch (e) { return '<div class="alert alert--error">' + esc(e.message) + '</div>'; }
    if (!r) return '';
    if (!r.payloadFields) return '<p class="muted">Stack này không có phần payload độ dài thay đổi.</p>';
    var html = '<div class="stats">' +
      stat('Kích thước frame', esc(n(r.frameBytes, 0)) + ' B', r.wireBytes ? '+ ' + esc(n(r.wireBytes, 0)) + ' B chỉ trên dây (preamble/SFD)' : 'không tính preamble/SFD') +
      stat('Payload', esc(n(r.payloadBytes, 0)) + ' B', r.clamped != null ? 'đã kẹp về ' + esc(r.clamped) + ' theo dữ liệu' : '') +
      stat('Header overhead', esc(n(r.overheadBytes, 0)) + ' B', esc(pct(100 - r.effPct)) + ' frame') +
      stat('Hiệu suất tải', esc(pct(r.effPct)), 'payload / frame') + '</div>';
    html += '<div class="calc-stackbar" role="img" aria-label="Các header theo byte">' + r.headers.filter(function (h) { return !h.wire && h.bytes > 0; }).map(function (h) {
      return '<span class="layer-' + esc(h.layer) + '" style="width:' + (h.bytes / r.frameBytes * 100) + '%" title="' + esc(h.name + ': ' + h.bytes + ' B') + '"></span>';
    }).join('') + '</div>' +
      '<p class="muted calc-small">' + r.headers.filter(function (h) { return h.bytes > 0; }).map(function (h) {
        return '<span class="calc-hdr"><span class="swatch layer-' + esc(h.layer) + '"></span> ' + esc(h.short) + ' ' + esc(n(h.bytes, 0)) + ' B' + (h.wire ? ' (dây)' : '') + '</span>';
      }).join(' · ') + '</p>';
    return html;
  }

  // ---------- sự kiện ----------
  function onInput(e) {
    if (!cv.active) return;
    var el = e.target, k = el.getAttribute && el.getAttribute('data-cin');
    if (!k) return;
    var s = cv.st, M = MUX();
    if (k === 'q') {
      s.q = el.value;
      var sel = $('#view-calc [data-cin="unit"]'), q = s.q.trim().toLowerCase();
      var hit = function (id) { return (id + ' ' + M[id].name + ' ' + (M[id].kind || '')).toLowerCase().indexOf(q) >= 0; };
      if (q && !hit(s.unit)) {
        // đơn vị đang chọn không khớp → chọn kết quả đầu tiên trong danh sách đã lọc
        sel.innerHTML = unitOptions(null, null, s.q);
        if (sel.options.length) s.unit = sel.options[0].value;
      }
      sel.innerHTML = unitOptions(s.unit, null, s.q);
    } else if (k === 'unit') s.unit = el.value;
    else if (k === 'root') { s.root = el.value; fillClients(); }
    else if (k === 'client') s.client = el.value;
    else if (k === 'L') { var v = Math.round(+el.value); if (!(v >= 64 && v <= 9618)) { el.setAttribute('aria-invalid', 'true'); return; } el.removeAttribute('aria-invalid'); s.L = v; }
    else if (k === 'eth') { s.eth = el.value; var c = $('#view-calc [data-cshow="custom"]'); if (c) c.hidden = !!s.eth; }
    else if (k === 'custom') { if (!(+el.value > 0)) return; s.custom = +el.value; }
    else if (k === 'ext' || k === 'pfcs') s[k] = !!el.checked;
    else if (k === 'stack') s.stack = el.value;
    else if (k === 'P') { if (!(+el.value >= 0) || el.value === '') return; s.P = Math.round(+el.value); }
    update();
  }

  function init() {
    var v = document.getElementById('view-calc');
    if (!v) throw new Error('Thiếu #view-calc trong index.html');
    v.addEventListener('input', onInput);
    v.addEventListener('change', onInput);
  }
  function show() {
    cv.active = true;
    cv.st = loadSt();
    build();
    document.getElementById('detail').innerHTML =
      '<div class="detail-card"><span class="eyebrow">Máy tính tốc độ</span><h2>Cách đọc</h2>' +
      '<p>Mọi số tính từ dữ liệu <code>TMUX</code> / <code>STACKS</code> bằng đúng logic của phòng thí nghiệm ghép kênh (số tối đa, chuỗi đóng gói, kế toán overhead).</p>' +
      '<dl class="kv"><dt>Tốc độ</dt><dd>byte/125 µs × 64 kbit/s (SDH) hoặc rateKbps (PDH, OTN, Ethernet)</dd>' +
      '<dt>Hiệu suất</dt><dd>tải khách hàng ÷ tốc độ cấp đang xét</dd>' +
      '<dt>GFP-F</dt><dd>tốc độ cần = tốc độ Ethernet × (L + 8) / (L + 20)</dd>' +
      '<dt>Stack IP</dt><dd>payload ÷ kích thước frame (không tính preamble/SFD, IFG)</dd></dl></div>';
  }
  function hide() { cv.active = false; }

  root.CalcView = { init: init, show: show, hide: hide };
})(typeof window !== 'undefined' ? window : globalThis);
