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
    var out = { id: id, name: nm(M, id), fullName: u.name, kind: u.kind, family: u.family, kbps: lab.unitKbps(M, id), lineKbps: u.lineKbps > 0 ? +u.lineKbps : null,
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
      headers: m.headers.map(function (h) { return { id: h.header ? h.header.id : null, name: h.label || h.name, short: h.short || h.name, bytes: h.bits / 8, layer: h.layer, wire: !!h.wire, role: h.role || null }; }) };
  }

  // ---------- giới hạn khung Ethernet (ETH_LIMITS) ----------
  /** Giá trị số của một mục ETH_LIMITS (vd lim(EL,'frame','maxBasic', 1518)); mục value null → mặc định d. */
  function lim(EL, grp, key, d) {
    var g = EL && EL[grp], it = g && g[key];
    return it && typeof it.value === 'number' ? it.value : d;
  }
  /** Các vùng kích thước khung (runt/standard/envelope/jumbo) — mặc định nếu thiếu dữ liệu. */
  function zonesOf(EL) {
    var z = EL && Array.isArray(EL.zones) && EL.zones.length ? EL.zones : [
      { id: 'runt', from: 0, to: 63, label: 'Dưới tối thiểu (runt)' }, { id: 'standard', from: 64, to: 1522, label: 'Chuẩn' },
      { id: 'envelope', from: 1523, to: 2000, label: 'Envelope' }, { id: 'jumbo', from: 2001, to: 9216, label: 'Jumbo (phi chuẩn)' }];
    return z.slice().sort(function (a, b) { return a.from - b.from; });
  }
  /** Vùng chứa khung L byte; L vượt vùng cuối → { id:'over', … }. */
  function ethZone(EL, L0) {
    var zs = zonesOf(EL), last = zs[zs.length - 1];
    for (var i = 0; i < zs.length; i++) if (L0 >= zs[i].from && L0 <= zs[i].to) return zs[i];
    return L0 > last.to ? { id: 'over', from: last.to + 1, to: Infinity, label: 'Vượt jumbo thường gặp (' + last.to + ' B)', note: 'Hầu hết thiết bị không nhận khung lớn như vậy.' } : zs[0];
  }
  /** Kẹp L vào [khung tối thiểu, khung jumbo lớn nhất của vùng cuối]. */
  function clampL(EL, L0) {
    var zs = zonesOf(EL), lo = lim(EL, 'frame', 'minFrame', 64), hi = zs[zs.length - 1].to;
    return Math.min(hi, Math.max(lo, Math.round(+L0 || 0)));
  }

  // ---------- MTU đường đi, phân mảnh, MSS ----------
  function isIp(h) { return !!h && /^ipv[46]$/.test(String(h.id)); }
  /**
   * Phân tích stack (đã đặt payload = P) trên một liên kết có MTU = mtu byte (phần trong khung lớp 2: sau header Ethernet/VLAN,
   * trước FCS — tức mọi header role ≠ 'link'). Trả về:
   *  { linkBytes, packetBytes (phần tính vào MTU), frameBytes, fits, action: 'ok'|'fragment'|'drop-icmp'|'drop-l2'|'no-link',
   *    ip: { ver, hdr, preBytes } (IP quyết định phân mảnh = IP đầu tiên trong phần MTU), fragments: [{ i, offset, data, ipBytes, frameBytes, mf }],
   *    totalFrameBytes, totalWireBytes, effPct, maxPayload (P lớn nhất không phân mảnh), innerMtu, innerIp, mss, overheadInMtu, zone }.
   * Router chỉ phân mảnh IPv4 khi DF = 0; IPv6 / DF = 1 → rớt + ICMP; IP nằm sau một khung Ethernet khách (L2 tunnel) → rớt im lặng.
   */
  function pathMtu(EV, stack, P, mtu, opts, headers, stacks, EL) {
    opts = opts || {};
    var eff = stackEff(EV, stack, P, headers, stacks);
    if (!eff) return null;
    var hs = eff.headers.filter(function (h) { return !h.wire; });
    var link = hs.filter(function (h) { return h.role === 'link'; });
    var inMtu = hs.filter(function (h) { return h.role !== 'link'; });
    var sum = function (l) { return l.reduce(function (a, h) { return a + h.bytes; }, 0); };
    var linkBytes = sum(link), packet = sum(inMtu);
    var minFrame = lim(EL, 'frame', 'minFrame', 64), pre = lim(EL, 'frame', 'preambleSfd', 8) + lim(EL, 'frame', 'ifg', 12);
    var padFrame = function (b) { return link.length ? Math.max(minFrame, b) : b; };
    var out = { stack: stack.id, P: eff.payloadBytes, mtu: mtu, linkBytes: linkBytes, packetBytes: packet, frameBytes: eff.frameBytes,
      overheadInMtu: packet - eff.payloadBytes, fits: packet <= mtu, fragments: [], ip: null, innerIp: null, df: !!opts.df };
    out.maxPayload = Math.max(0, mtu - out.overheadInMtu);
    out.zone = ethZone(EL, eff.frameBytes);
    // IP đầu tiên trong phần MTU (quyết định phân mảnh) và IP cuối (gói của người dùng → MSS)
    var firstIp = -1, lastIp = -1, payIdx = -1;
    inMtu.forEach(function (h, i) { if (isIp(h)) { if (firstIp < 0) firstIp = i; lastIp = i; } if (h.layer === 'payload') payIdx = i; });
    var full = eff.headers.filter(function (h) { return !h.wire && h.role !== 'link'; }); // cùng thứ tự với inMtu
    if (lastIp >= 0) {
      var ipH = full[lastIp], innerPkt = sum(inMtu.slice(lastIp, (payIdx >= lastIp ? payIdx : inMtu.length - 1) + 1));
      var ver = ipH.id === 'ipv6' ? 6 : 4;
      out.innerIp = { ver: ver, hdr: ipH.bytes, name: ipH.short };
      out.innerMtu = mtu - (packet - innerPkt);
      out.mss = out.innerMtu - ipH.bytes - 20;
      out.mssRule = ver === 6 ? EL && EL.tcp && EL.tcp.mssOverheadV6 : EL && EL.tcp && EL.tcp.mssOverheadV4;
    }
    if (!link.length) { out.action = 'no-link'; }
    else if (out.fits) out.action = 'ok';
    else if (firstIp < 0) out.action = 'drop-l2';
    else {
      var preHs = inMtu.slice(0, firstIp);
      var l2tunnel = preHs.some(function (h) { return h.layer === 'l2' && h.role === 'passenger'; });
      var ip = inMtu[firstIp], v6 = ip.id === 'ipv6';
      out.ip = { ver: v6 ? 6 : 4, hdr: ip.bytes, preBytes: sum(preHs), name: ip.short };
      if (l2tunnel) out.action = 'drop-l2';
      else if (v6 || opts.df) out.action = 'drop-icmp';
      else {
        // phân mảnh IPv4 (RFC 791): dữ liệu mỗi mảnh (trừ mảnh cuối) là bội 8 byte, mỗi mảnh mang lại header IP
        var unit = lim(EL, 'ipv4', 'fragOffsetUnit', 8);
        var ipMtu = mtu - out.ip.preBytes, per = Math.floor((ipMtu - ip.bytes) / unit) * unit;
        var data = packet - out.ip.preBytes - ip.bytes;
        if (per <= 0) out.action = 'drop-icmp';
        else {
          out.action = 'fragment';
          for (var off = 0, i = 0; off < data; off += per, i++) {
            var d = Math.min(per, data - off);
            var ipB = ip.bytes + d;
            out.fragments.push({ i: i, offset: off, offsetField: off / unit, data: d, ipBytes: ipB, mf: off + d < data,
              frameBytes: padFrame(linkBytes + out.ip.preBytes + ipB) });
          }
        }
      }
    }
    if (out.action === 'fragment') {
      out.totalFrameBytes = out.fragments.reduce(function (a, f) { return a + f.frameBytes; }, 0);
      out.totalWireBytes = out.totalFrameBytes + pre * out.fragments.length;
    } else if (out.action === 'ok' || out.action === 'no-link') {
      out.totalFrameBytes = padFrame(eff.frameBytes); out.totalWireBytes = out.totalFrameBytes + (link.length ? pre : 0);
    } else { out.totalFrameBytes = 0; out.totalWireBytes = 0; }
    out.effPct = out.totalFrameBytes ? eff.payloadBytes / out.totalFrameBytes * 100 : 0;
    out.wireEffPct = out.totalWireBytes ? eff.payloadBytes / out.totalWireBytes * 100 : 0;
    // gợi ý MTU có ràng buộc riêng của chuẩn (vd PPPoE 1492)
    out.hints = (EL && Array.isArray(EL.mtuHints) ? EL.mtuHints : []).filter(function (h) { return h.stack === stack.id; });
    return out;
  }

  // ---------- cổng khai báo tốc độ (1G khai báo 150M…) ----------
  /** Giới hạn số thành viên X của VC-n-Xv đọc từ chuẩn ghi trong dữ liệu ("X ≤ 64"); mặc định 256 (G.707 §11.2). */
  function vcatMaxX(u) { var m = /X\s*≤\s*(\d+)/.exec(String(u && (u.standard || u.std) || '')); return m ? +m[1] : 256; }
  /**
   * Container nhỏ nhất ≥ tốc độ cần (cirKbps sau GFP-F với khung L byte):
   *  - 'eos'  : VC-n-Xv — dung lượng mỗi thành viên lấy từ các VCG trong TMUX (gfpTargets / members.count), X = ⌈cần / C-n⌉ ≤ giới hạn;
   *  - 'otn'  : đơn vị OTN nhận GFP-F trong dữ liệu (OPU0, ODUflex(GFP) n TS, OPU2…), nhỏ nhất vừa;
   *  - 'policer': không có container — cổng vật lý (portKbps) + policer/shaper CIR.
   * Kèm: thông lượng TCP thực (MSS / byte trên đường cổ chai), CBS ≈ CIR × RTT / 8.
   */
  function declaredRate(M, o, EL) {
    o = o || {};
    var lab = L(), cir = +o.cirKbps || 0, mtu = +o.mtu || 1500, L2 = 18; // MAC header 14 + FCS 4
    var Lf = mtu + L2, mss = mtu - (o.v6 ? 40 : 20) - 20, pre = lim(EL, 'frame', 'preambleSfd', 8) + lim(EL, 'frame', 'ifg', 12);
    var g = gfp(Lf, cir, { bytes: o.bytes || GFP_DEF });
    var res = { tech: o.tech, cirKbps: cir, portKbps: +o.portKbps || 0, mtu: mtu, mss: mss, L: Lf, gfp: g, needKbps: g.needKbps, candidates: [], pick: null, warn: [] };
    if (o.tech === 'eos' || o.tech === 'otn') {
      var tg = M && lab ? gfpTargets(M, g.needKbps) : [];
      if (o.tech === 'eos') {
        var seen = {};
        tg.forEach(function (t) {
          var u = M[t.id];
          if (!u.members || seen[u.members.of]) return;
          seen[u.members.of] = 1;
          var memCap = t.capKbps / u.members.count, memKbps = lab.unitKbps(M, u.members.of), maxX = vcatMaxX(u);
          var X = Math.max(1, Math.ceil(g.needKbps / memCap - 1e-9));
          res.candidates.push({ id: u.members.of, name: nm(M, u.members.of) + '-' + X + 'v', member: nm(M, u.members.of), X: X, maxX: maxX,
            ok: X <= maxX, capKbps: X * memCap, lineKbps: X * memKbps, memberCapKbps: memCap, vcg: t.id,
            fillPct: g.needKbps / (X * memCap) * 100, lower: X > 1 ? { name: nm(M, u.members.of) + '-' + (X - 1) + 'v', capKbps: (X - 1) * memCap } : null });
        });
      } else {
        tg.filter(function (t) { return t.family === 'otn'; }).forEach(function (t) {
          res.candidates.push({ id: t.id, name: t.name, ok: t.fits, capKbps: t.capKbps, lineKbps: lab.unitKbps(M, t.id), fillPct: t.fillPct, mapping: t.mapping });
        });
      }
      res.candidates.sort(function (a, b) { return (b.ok - a.ok) || a.capKbps - b.capKbps; });
      res.pick = res.candidates.filter(function (c) { return c.ok && c.capKbps >= g.needKbps - 1e-9; })[0] || null;
      if (res.pick) {
        res.bottleneckKbps = res.pick.capKbps;
        // trong container: mỗi gói MTU chiếm L + 8 (GFP core + type) byte, không preamble/IFG
        res.tcpKbps = res.pick.capKbps * mss / (Lf + g.ohBytes);
        res.ethKbps = res.pick.capKbps / g.ratio; // tốc độ Ethernet (tính cả preamble/IFG) container mang được
        res.wastePct = 100 - res.pick.fillPct;
      }
    } else {
      res.bottleneckKbps = cir;
      res.tcpKbps = cir * mss / Lf;           // policer đếm byte khung L2 (không preamble/IFG) — tuỳ hãng
      res.tcpKbpsL3 = cir * mss / mtu;        // nếu policer đếm byte IP
    }
    if (o.portKbps) res.lineTcpKbps = o.portKbps * mss / (Lf + pre);
    var rtt = Math.max(0, +o.rttMs || 0) / 1000;
    res.cbsBytes = cir * 1000 * rtt / 8;      // CBS ≈ CIR × RTT / 8 (quy tắc thực hành)
    res.cbsMinBytes = Lf;                     // tối thiểu: ≥ một khung lớn nhất (RFC 2697 §2)
    res.burstMs = o.portKbps > cir && res.cbsBytes ? res.cbsBytes * 8 / ((o.portKbps - cir) * 1000) * 1000 : 0; // thời gian burst tốc độ dây làm đầy bucket
    return res;
  }

  var api = { unitInfo: unitInfo, rootsOf: rootsOf, chains: chains, fitCandidates: fitCandidates, fitMax: fitMax,
    GFP_DEF: GFP_DEF, gfpBytesFrom: gfpBytesFrom, gfp: gfp, gfpClients: gfpClients, gfpTargets: gfpTargets, stackEff: stackEff,
    lim: lim, zonesOf: zonesOf, ethZone: ethZone, clampL: clampL, pathMtu: pathMtu, vcatMaxX: vcatMaxX, declaredRate: declaredRate };
  root.RateCalc = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // =====================================================================
  // Giao diện (chỉ trình duyệt)
  // =====================================================================
  if (typeof document === 'undefined') return;

  var STORE_KEY = 'fs.calc.v1';
  var cv = { active: false, built: false, st: null };
  var FAM = { pdh: 'PDH', sdh: 'SDH', otn: 'OTN', flexe: 'FlexE' };

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
    s.L = clampL(root.ETH_LIMITS, +s.L || 1518);
    if (typeof s.eth !== 'string') s.eth = '';
    s.custom = +s.custom > 0 ? +s.custom : 1000;
    s.ext = !!s.ext; s.pfcs = !!s.pfcs;
    var S = root.STACKS || [];
    if (!S.some(function (x) { return x.id === s.stack; })) s.stack = S[0] ? S[0].id : null;
    s.P = Math.max(0, Math.round(+s.P >= 0 && s.P !== '' && s.P != null ? +s.P : 1000));
    if (typeof s.q !== 'string') s.q = '';
    s.mtu = Math.min(65535, Math.max(68, Math.round(+s.mtu || 1500)));
    s.df = !!s.df;
    var rl = s.rl && typeof s.rl === 'object' ? s.rl : {};
    s.rl = { tech: ['eos', 'otn', 'policer'].indexOf(rl.tech) >= 0 ? rl.tech : 'eos', cir: +rl.cir > 0 ? +rl.cir : 150,
      port: +rl.port > 0 ? +rl.port : 1000, rtt: +rl.rtt >= 0 && rl.rtt !== '' && rl.rtt != null ? +rl.rtt : 20,
      mtu: Math.min(9216, Math.max(576, Math.round(+rl.mtu || 1500))), v6: !!rl.v6 };
    return s;
  }
  function EL() { return root.ETH_LIMITS || null; }
  function Lmax() { var z = zonesOf(EL()); return z[z.length - 1].to; }

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
      '<p class="stack-summary calc-purpose">Máy tính này trả lời các câu hỏi khi thiết kế một kết nối: <b>đơn vị truyền dẫn nào chứa được dịch vụ</b> (tốc độ, chuỗi ghép, số nhánh tối đa), ' +
      '<b>gói tin lớn bao nhiêu thì đi được</b> (giới hạn khung Ethernet theo chuẩn, MTU đường đi, phân mảnh, MSS nên đặt) và ' +
      '<b>khai báo tốc độ thì thực nhận bao nhiêu</b> (container VCAT/ODU, policer, thông lượng TCP, bucket). ' +
      'Mọi số lấy từ dữ liệu chuẩn của ứng dụng (TMUX, STACKS, ETH_LIMITS) và cùng quy tắc với phòng thí nghiệm ghép kênh; giá trị phi chuẩn (jumbo) được ghi rõ.</p></div></section>';
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
          '<div class="calc-form"><label><span>Khung Ethernet L (byte, ' + lim(EL(), 'frame', 'minFrame', 64) + '–' + Lmax() + ')</span><input type="number" min="' + lim(EL(), 'frame', 'minFrame', 64) + '" max="' + Lmax() + '" step="1" data-cin="L" value="' + s.L + '"></label>' +
          '<label><span>Tốc độ Ethernet</span><select data-cin="eth">' + clients.map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (c.id === s.eth ? ' selected' : '') + '>' + esc(c.name) + ' — ' + esc(rate(c.kbps)) + '</option>';
          }).join('') + '<option value=""' + (s.eth ? '' : ' selected') + '>Tự nhập…</option></select></label>' +
          '<label data-cshow="custom"' + (s.eth ? ' hidden' : '') + '><span>Mbit/s</span><input type="number" min="0.001" step="any" data-cin="custom" value="' + s.custom + '"></label>' +
          '<label class="calc-chk"><input type="checkbox" data-cin="ext"' + (s.ext ? ' checked' : '') + '> Extension header (+' + gfpBytesFrom(root.HEADERS).ext + ' B)</label>' +
          '<label class="calc-chk"><input type="checkbox" data-cin="pfcs"' + (s.pfcs ? ' checked' : '') + '> pFCS (+' + gfpBytesFrom(root.HEADERS).pfcs + ' B)</label></div>' +
          '<div data-cout="gfp"></div></section>';
      }
    }
    var sec = hasT ? (clients.length ? 4 : 3) : 1;
    if (S.length && root.EthViz) {
      html += '<section class="card calc-card" aria-labelledby="c4-t"><div class="section-title"><h2 id="c4-t">' + (sec++) + '. Stack IP: hiệu suất, MTU đường đi, phân mảnh, MSS</h2></div>' +
        '<div class="calc-form"><label><span>Stack</span><select data-cin="stack">' + S.map(function (st) {
          return '<option value="' + esc(st.id) + '"' + (st.id === s.stack ? ' selected' : '') + '>' + esc(st.name || st.id) + '</option>';
        }).join('') + '</select></label>' +
        '<label><span>Payload P (byte)</span><input type="number" min="0" step="1" data-cin="P" value="' + s.P + '"></label>' +
        '<label title="Kích thước tối đa phần nằm trong khung lớp 2 (sau header Ethernet/VLAN, trước FCS) trên liên kết hẹp nhất của đường đi"><span>MTU đường đi (byte)</span><input type="number" min="68" max="65535" step="1" data-cin="mtu" value="' + s.mtu + '"></label>' +
        '<label class="calc-chk"><input type="checkbox" data-cin="df"' + (s.df ? ' checked' : '') + '> IPv4 đặt DF = 1 (không cho phân mảnh)</label></div>' +
        '<div data-cout="stack"></div></section>';
    }
    html += '<section class="card calc-card" aria-labelledby="c5-t"><div class="section-title"><h2 id="c5-t">' + (sec++) + '. Cổng khai báo tốc độ (vd cổng 1G khai báo 150M)</h2></div>' +
      '<div class="calc-form">' +
      '<label><span>Công nghệ</span><select data-cin="rl.tech">' + [['eos', 'Ethernet qua SDH (GFP-F + VCAT)'], ['otn', 'Ethernet qua OTN (GFP-F vào ODU)'], ['policer', 'Mạng gói: policer / shaper']].map(function (o) {
        return '<option value="' + o[0] + '"' + (s.rl.tech === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') + '</select></label>' +
      '<label><span>Cổng vật lý (Mbit/s)</span><input type="number" min="1" step="any" data-cin="rl.port" value="' + s.rl.port + '"></label>' +
      '<label><span>Tốc độ khai báo CIR (Mbit/s)</span><input type="number" min="0.064" step="any" data-cin="rl.cir" value="' + s.rl.cir + '"></label>' +
      '<label><span>MTU IP (byte)</span><input type="number" min="576" max="9216" step="1" data-cin="rl.mtu" value="' + s.rl.mtu + '"></label>' +
      '<label><span>RTT (ms)</span><input type="number" min="0" step="any" data-cin="rl.rtt" value="' + s.rl.rtt + '"></label>' +
      '<label class="calc-chk"><input type="checkbox" data-cin="rl.v6"' + (s.rl.v6 ? ' checked' : '') + '> IPv6</label></div>' +
      '<div data-cout="rl"></div></section>';
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
    if ((o = $('#view-calc [data-cout="rl"]'))) o.innerHTML = renderRate();
    save();
  }

  /** Bước "ký hiệu" của chuỗi TLINE có unit = id (trang #line) – để ghi GBd cạnh tốc độ đường dây. */
  function lineSymbol(id) {
    var TL = root.TLINE, hit = null;
    ((TL && TL.chains) || []).forEach(function (c) {
      if (hit || c.unit !== id) return;
      hit = (c.steps || []).filter(function (s) { return s.kind === 'symbol' && s.gbd > 0; })[0] || null;
      if (hit) hit = { gbd: hit.gbd, bitsPerSymbol: hit.bitsPerSymbol, chain: c.id };
    });
    return hit;
  }

  function renderUnit() {
    var M = MUX(), info = unitInfo(M, root.TFRAMES || {}, cv.st.unit);
    if (!info) return '<p class="muted">Chọn một đơn vị.</p>';
    // lineKbps (nếu có) ≠ rateKbps: rateKbps là dòng 64B/66B mang vào OTN, lineKbps mới là tốc độ đường dây
    // khung đường truyền (kind otu có lineKbps, vd 400ZR/800ZR): rateKbps là tốc độ khung vẽ trong lưới, lineKbps sau mọi FEC/ký hiệu căn khung/pilot
    var lineFrame = info.lineKbps && info.kind === 'otu';
    var sym = lineSymbol(cv.st.unit);
    var cards = (info.lineKbps ? stat('Tốc độ đường dây', esc(rate(info.lineKbps)), esc(n(info.lineKbps, 3)) + ' kbit/s' +
        (sym ? ' · ' + esc(n(sym.gbd, 3)) + ' GBd × ' + sym.bitsPerSymbol + ' bit/ký hiệu' : '')) : '') +
      stat(lineFrame ? 'Khung (như lưới khung)' : info.lineKbps ? 'Dòng 64B/66B' : 'Tốc độ', esc(rate(info.kbps)), esc(n(info.kbps, 3)) + ' kbit/s') +
      (info.bytes != null ? stat('Byte mỗi 125 µs', esc(n(info.bytes, 3)), '× 64 kbit/s = tốc độ') : '');
    if (info.frame) {
      var fb = info.frame.bits / 8;
      cards += stat('Chu kỳ khung', esc(n(info.frame.periodUs, 3)) + ' µs', esc(n(info.frame.framesPerSec, 1)) + ' khung/s' + (info.frame.multiframe ? ' · đa khung ' + info.frame.multiframe : '')) +
        stat('Kích thước khung', esc(info.frame.cellBits === 8 ? n(fb, 0) + ' byte' : n(info.frame.bits, 0) + ' bit'), esc(info.frame.rows + ' × ' + info.frame.cols) + (info.frame.cellBits === 1 ? ' bit' : ' ô'));
    }
    if (info.members) cards += stat('Thành viên', esc(info.members.count + ' × ' + nm(M, info.members.of)), 'tải: ' + esc(nm(M, info.members.payloadOf)));
    if (info.pool) cards += info.kind === 'flexe' ? stat('Khe lịch', esc(info.pool.n + ' khe'), esc(rate(info.pool.kbps)) + ' mỗi khe')
      : stat('TS (khe nhánh)', esc(info.pool.n + ' TS'), esc(rate(info.pool.kbps)) + ' mỗi TS');
    var html = '<div class="stats">' + cards + '</div>' +
      (info.summary ? '<p class="note calc-note">' + esc(info.summary) + '</p>' : '') +
      (sym ? '<p><a class="btn-ghost btn-link" href="#line/' + esc(sym.chain) + '">〰 Xem từng bước từ khung tới bước sóng</a></p>' : '');
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
      var parts = [['Tải client', b.clientKbps, 'k-payload'], ['Overhead các cấp', b.overheadKbps, 'k-poh'], ['Chèn / bù tốc độ', b.justificationKbps, 'k-stuff'], ['Còn trống', b.emptyKbps, 'k-reserved']];
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
  // ---------- thanh vùng kích thước khung (ETH_LIMITS.zones) ----------
  var ZONE_W = { runt: 6, standard: 42, envelope: 18, jumbo: 34 };
  /** Thanh tô vùng chuẩn/envelope/jumbo, kim chỉ vị trí khung L byte (tuyến tính trong từng vùng). */
  function zoneBar(L0, caption) {
    var zs = zonesOf(EL()), tot = 0;
    zs.forEach(function (z) { tot += ZONE_W[z.id] || 15; });
    var x = 0, pos = 100, segs = zs.map(function (z) {
      var w = (ZONE_W[z.id] || 15) / tot * 100;
      if (L0 >= z.from && L0 <= z.to) pos = x + w * (z.to > z.from ? (L0 - z.from) / (z.to - z.from) : 0.5);
      var s = '<span class="zb-seg zb-' + esc(z.id) + '" style="width:' + w + '%" title="' + esc(z.label + ': ' + z.from + '–' + z.to + ' B' + (z.standard ? ' · ' + z.standard : '')) + '">' +
        '<span class="zb-lab">' + esc(z.label) + '</span><span class="zb-rng">' + z.from + '–' + z.to + '</span></span>';
      x += w; return s;
    }).join('');
    if (L0 < zs[0].from) pos = 0;
    return '<div class="zonebar" role="img" aria-label="' + esc((caption || 'Khung') + ' ' + L0 + ' byte: ' + ethZone(EL(), L0).label) + '">' + segs +
      '<span class="zb-mark" style="left:' + Math.max(0, Math.min(100, pos)) + '%"><span>' + esc(caption ? caption + ' ' : '') + n(L0, 0) + ' B</span></span></div>';
  }
  /** Cảnh báo theo vùng của khung L byte. */
  function zoneAlert(L0) {
    var z = ethZone(EL(), L0), lv = { runt: 'error', standard: 'ok', envelope: 'info', jumbo: 'warn', over: 'error' }[z.id] || 'info';
    var head = { runt: 'Không hợp lệ', standard: 'Đúng chuẩn', envelope: 'Envelope frame (chuẩn 802.3, cần thiết bị hỗ trợ)', jumbo: 'Jumbo – PHI CHUẨN', over: 'Vượt mọi giới hạn thường gặp' }[z.id] || z.label;
    var extra = '';
    if (z.id === 'jumbo' || z.id === 'over') {
      var jm = EL() && EL().frame && EL().frame.jumboFrame;
      extra = jm ? ' ' + esc(jm.note) : '';
    }
    if (z.id === 'envelope') extra = ' MTU IP vẫn ' + lim(EL(), 'frame', 'maxBasic', 1518) + ' − 18 = 1500: envelope chỉ cho thêm tag/nhãn đóng gói, không nâng dữ liệu client.';
    return '<div class="calc-zone calc-zone--' + lv + '"><b>' + esc(head) + ':</b> khung ' + esc(n(L0, 0)) + ' B thuộc vùng “' + esc(z.label) + '”. ' + esc(z.note || '') + extra +
      (z.standard ? ' <span class="muted">(' + esc(z.standard) + ')</span>' : '') + '</div>';
  }

  function renderGfp() {
    var M = MUX(), k = ethRate(), bytes = gfpBytesFrom(root.HEADERS);
    var g = gfp(cv.st.L, k, { bytes: bytes, ext: cv.st.ext, pfcs: cv.st.pfcs });
    var html = zoneBar(cv.st.L, 'L') + zoneAlert(cv.st.L) + '<div class="stats">' +
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
    var pm = null;
    try { pm = pathMtu(root.EthViz, st, cv.st.P, cv.st.mtu, { df: cv.st.df }, root.HEADERS, S, EL()); } catch (e) { pm = null; }
    var html = pm ? renderPath(pm, r) : '';
    html += '<div class="stats">' +
      stat(pm && pm.action === 'fragment' ? 'Frame nếu không phân mảnh' : 'Kích thước frame', esc(n(r.frameBytes, 0)) + ' B', r.wireBytes ? '+ ' + esc(n(r.wireBytes, 0)) + ' B chỉ trên dây (preamble/SFD)' : 'không tính preamble/SFD') +
      stat('Payload', esc(n(r.payloadBytes, 0)) + ' B', r.clamped != null ? 'đã kẹp về ' + esc(r.clamped) + ' theo dữ liệu' : '') +
      stat('Header overhead', esc(n(r.overheadBytes, 0)) + ' B', esc(pct(100 - r.effPct)) + ' frame') +
      (pm && pm.action !== 'ok' && pm.action !== 'no-link'
        ? stat('Hiệu suất thực', pm.action === 'fragment' ? esc(pct(pm.effPct)) : '0%', pm.action === 'fragment' ? 'qua ' + pm.fragments.length + ' mảnh (' + esc(n(pm.totalFrameBytes, 0)) + ' B khung)' : 'gói bị rớt')
        : stat('Hiệu suất tải', esc(pct(r.effPct)), 'payload / frame')) + '</div>';
    html += '<div class="calc-stackbar" role="img" aria-label="Các header theo byte">' + r.headers.filter(function (h) { return !h.wire && h.bytes > 0; }).map(function (h) {
      return '<span class="layer-' + esc(h.layer) + '" style="width:' + (h.bytes / r.frameBytes * 100) + '%" title="' + esc(h.name + ': ' + h.bytes + ' B') + '"></span>';
    }).join('') + '</div>' +
      '<p class="muted calc-small">' + r.headers.filter(function (h) { return h.bytes > 0; }).map(function (h) {
        return '<span class="calc-hdr"><span class="swatch layer-' + esc(h.layer) + '"></span> ' + esc(h.short) + ' ' + esc(n(h.bytes, 0)) + ' B' + (h.wire ? ' (dây)' : '') + '</span>';
      }).join(' · ') + '</p>';
    return html;
  }

  /** Mục MTU đường đi: kết luận (đi được / phân mảnh / rớt), MTU tối đa + MSS gợi ý, vùng kích thước khung, bảng mảnh. */
  function renderPath(pm, r) {
    var E = EL(), mtu = pm.mtu, html = '';
    var icmp4 = E && E.ipv4 && E.ipv4.dfBit, icmp6 = E && E.ipv6 && E.ipv6.fragmentation;
    if (pm.action === 'no-link') {
      html += '<div class="calc-zone calc-zone--info"><b>Không có liên kết Ethernet bên ngoài:</b> stack này (vd GFP-F) không đi trên một liên kết có MTU IP thông thường; ' +
        'phần trong khung là ' + esc(n(pm.packetBytes, 0)) + ' B.</div>';
    } else if (pm.action === 'ok') {
      html += '<div class="calc-zone calc-zone--ok"><b>Đi được nguyên gói:</b> phần trong khung lớp 2 = ' + esc(n(pm.packetBytes, 0)) + ' B ≤ MTU ' + esc(n(mtu, 0)) + ' B.</div>';
    } else if (pm.action === 'fragment') {
      html += '<div class="calc-zone calc-zone--warn"><b>Vượt MTU → router phân mảnh IPv4 thành ' + pm.fragments.length + ' mảnh</b> (gói ' + esc(n(pm.packetBytes, 0)) + ' B > MTU ' + esc(n(mtu, 0)) + ' B, DF = 0). ' +
        'Mỗi mảnh mang lại header ' + esc(pm.ip.name) + ' ' + pm.ip.hdr + ' B; dữ liệu mỗi mảnh (trừ mảnh cuối) là bội 8 byte. Mất một mảnh = mất cả gói. ' +
        '<span class="muted">(' + esc((E && E.ipv4 && E.ipv4.fragOffsetUnit && E.ipv4.fragOffsetUnit.standard) || 'RFC 791 §3.1') + ')</span></div>';
    } else if (pm.action === 'drop-icmp') {
      var v6 = pm.ip && pm.ip.ver === 6;
      html += '<div class="calc-zone calc-zone--error"><b>Rớt gói – ' + (v6 ? 'ICMPv6 Packet Too Big' : 'ICMP Fragmentation Needed (type 3 code 4)') + '</b> gửi về nguồn kèm MTU ' + esc(n(mtu, 0)) + ' B. ' +
        esc(v6 ? (icmp6 ? icmp6.note : 'Router IPv6 không phân mảnh.') : (icmp4 ? icmp4.note : 'DF = 1 nên router không được phân mảnh.')) +
        ' <span class="muted">(' + esc(v6 ? (icmp6 && icmp6.standard) || 'RFC 8200' : (icmp4 && icmp4.standard) || 'RFC 791, RFC 1191') + ')</span>' +
        (E && E.pmtud && E.pmtud.blackHole ? '<br><span class="muted">Nếu ICMP bị chặn: ' + esc(E.pmtud.blackHole.note) + '</span>' : '') + '</div>';
    } else if (pm.action === 'drop-l2') {
      html += '<div class="calc-zone calc-zone--error"><b>Rớt im lặng ở lớp 2:</b> khung lớn hơn MTU của liên kết; thiết bị chuyển mạch/PE của đường hầm lớp 2 không phân mảnh và không gửi ICMP. ' +
        'Phải nâng MTU lõi (≥ ' + esc(n(pm.packetBytes, 0)) + ' B) hoặc giảm MTU phía khách.</div>';
    }
    var cards = stat('MTU đường đi', esc(n(mtu, 0)) + ' B', 'phần sau header lớp 2, trước FCS') +
      stat('Payload tối đa không phân mảnh', esc(n(pm.maxPayload, 0)) + ' B', 'MTU − ' + esc(n(pm.overheadInMtu, 0)) + ' B header trong MTU');
    if (pm.innerIp) {
      cards += stat('MTU cho gói ' + pm.innerIp.name + ' người dùng', esc(n(pm.innerMtu, 0)) + ' B', pm.innerMtu < mtu ? 'MTU − ' + esc(n(mtu - pm.innerMtu, 0)) + ' B đóng gói' : 'không có tunnel') +
        stat('MSS gợi ý (TCP)', esc(n(pm.mss, 0)) + ' B', 'MTU người dùng − ' + pm.innerIp.hdr + ' (' + esc(pm.innerIp.name) + ') − 20 (TCP)');
    }
    html += '<div class="stats">' + cards + '</div>';
    var notes = [];
    if (pm.innerIp && pm.innerMtu < mtu) notes.push('Đặt MTU giao diện tunnel = ' + n(pm.innerMtu, 0) + ' B và bật MSS clamping = ' + n(pm.mss, 0) + ' B để TCP không bao giờ phải phân mảnh.');
    if (pm.mssRule) notes.push(pm.mssRule.note + ' (' + pm.mssRule.standard + ')');
    if (pm.innerIp && pm.innerIp.ver === 6 && pm.innerMtu < lim(E, 'ipv6', 'minMtu', 1280)) notes.push('MTU cho IPv6 < ' + lim(E, 'ipv6', 'minMtu', 1280) + ' B — vi phạm RFC 8200 §5: lớp dưới phải tự phân mảnh/ráp.');
    if (pm.innerIp && pm.innerIp.ver === 4 && pm.innerMtu < lim(E, 'ipv4', 'minMtu', 68)) notes.push('MTU < 68 B — IPv4 không hoạt động (RFC 791).');
    pm.hints.forEach(function (h) { notes.push('Gợi ý chuẩn: MTU ' + h.value + ' ' + h.unit + ' — ' + h.note + ' (' + h.standard + ')'); });
    if (notes.length) html += '<ul class="calc-notes">' + notes.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
    // kích thước khung so với chuẩn Ethernet (khi đi nguyên gói)
    if (pm.linkBytes && pm.action !== 'fragment') html += zoneBar(r.frameBytes, 'Khung') + zoneAlert(r.frameBytes);
    if (pm.action === 'fragment') {
      var shown = pm.fragments.length > 12 ? pm.fragments.slice(0, 10).concat([null], pm.fragments.slice(-1)) : pm.fragments;
      html += '<div class="tbl-wrap"><table class="values lab-table calc-table"><thead><tr><th>Mảnh</th><th class="num">Offset (byte)</th><th class="num">Fragment Offset</th><th class="num">Dữ liệu</th><th class="num">Gói IP</th><th>MF</th><th class="num">Khung</th></tr></thead><tbody>' +
        shown.map(function (f) {
          if (!f) return '<tr><td colspan="7" class="muted">…</td></tr>';
          return '<tr><td>' + (f.i + 1) + '</td><td class="num">' + esc(n(f.offset, 0)) + '</td><td class="num">' + f.offsetField + '</td><td class="num">' + esc(n(f.data, 0)) + ' B</td>' +
            '<td class="num">' + esc(n(f.ipBytes, 0)) + ' B</td><td>' + (f.mf ? '1' : '0') + '</td><td class="num">' + esc(n(f.frameBytes, 0)) + ' B</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="muted calc-small">Tổng ' + esc(n(pm.totalFrameBytes, 0)) + ' B khung (' + esc(n(pm.totalWireBytes, 0)) + ' B trên dây gồm preamble/IFG) cho ' + esc(n(pm.P, 0)) + ' B payload → hiệu suất ' + esc(pct(pm.effPct)) +
        ' (trên dây ' + esc(pct(pm.wireEffPct)) + '). Payload lớn hơn MTU không làm hiệu suất tốt hơn: nó chỉ bị cắt thành nhiều gói cỡ MTU.</p>';
    }
    return html;
  }

  /** Mục "Cổng khai báo tốc độ". */
  function renderRate() {
    var M = MUX(), rl = cv.st.rl, E = EL();
    var r = declaredRate(M, { tech: rl.tech, cirKbps: rl.cir * 1000, portKbps: rl.port * 1000, mtu: rl.mtu, rttMs: rl.rtt, v6: rl.v6, bytes: gfpBytesFrom(root.HEADERS) }, E);
    var sc = E && E.scenarios && E.scenarios.rateLimit, it = (sc && sc.items) || {};
    var html = sc ? '<p class="note calc-note">' + esc(sc.summary) + '</p>' : '';
    if (rl.cir > rl.port) html += '<div class="calc-zone calc-zone--error"><b>CIR lớn hơn tốc độ cổng</b> — không thể đạt; cổng vật lý ' + esc(rate(rl.port * 1000)) + ' là trần.</div>';
    var cards = '';
    if (rl.tech !== 'policer') {
      cards += stat('Tốc độ cần sau GFP-F', esc(rate(r.needKbps)), esc(rate(r.cirKbps)) + ' × (' + r.L + '+' + r.gfp.ohBytes + ')/(' + r.L + '+20)');
      if (r.pick) {
        cards += stat('Container gợi ý', esc(r.pick.name), 'tải ' + esc(rate(r.pick.capKbps)) + (r.pick.lineKbps ? ' · đường ' + esc(rate(r.pick.lineKbps)) : '')) +
          stat('Lấp đầy', esc(pct(r.pick.fillPct)), 'lãng phí ' + esc(pct(r.wastePct)));
      } else cards += stat('Container gợi ý', '–', 'không có đơn vị nào trong dữ liệu đủ lớn');
    } else {
      cards += stat('Cổng vật lý', esc(rate(r.portKbps)), 'burst vẫn ở tốc độ dây') + stat('Policer/shaper CIR', esc(rate(r.cirKbps)), 'giới hạn mềm ở lớp gói');
    }
    if (r.tcpKbps != null) cards += stat('Thông lượng TCP thực', esc(rate(r.tcpKbps)), 'MSS ' + r.mss + ' / ' + (rl.tech === 'policer' ? 'khung ' + r.L + ' B' : (r.L + r.gfp.ohBytes) + ' B GFP'));
    cards += stat('CBS / bộ đệm ≈ CIR × RTT', esc(n(r.cbsBytes / 1000, 1)) + ' kB', 'tối thiểu ≥ 1 khung (' + r.cbsMinBytes + ' B)' + (r.burstMs ? ' · đầy sau ' + n(r.burstMs, 1) + ' ms burst' : ''));
    html += '<div class="stats">' + cards + '</div>';
    if (r.candidates.length) {
      html += '<div class="tbl-wrap"><table class="values lab-table calc-table"><thead><tr><th>Container</th><th class="num">Dung lượng tải</th><th>Vừa?</th><th class="num">Lấp</th></tr></thead><tbody>' +
        r.candidates.map(function (c) {
          var okc = c.ok && c.capKbps >= r.needKbps - 1e-9;
          var why = !c.ok && c.maxX ? 'X = ' + c.X + ' > ' + c.maxX + ' (giới hạn chuẩn)' : (okc ? '✓ vừa' : '✗ không vừa');
          return '<tr class="' + (okc ? (c === r.pick ? 'is-pick' : '') : 'is-off') + '"><td><b>' + esc(c.name) + '</b>' + (c === r.pick ? ' <span class="chip">nhỏ nhất vừa</span>' : '') +
            (c.lower && okc ? '<div class="muted">' + esc(c.lower.name) + ' chỉ ' + esc(rate(c.lower.capKbps)) + ' — thiếu</div>' : '') + (c.mapping ? '<div class="muted">' + esc(c.mapping) + '</div>' : '') + '</td>' +
            '<td class="num">' + esc(rate(c.capKbps)) + '</td><td>' + (okc ? '<span class="vcg-ok">' + esc(why) + '</span>' : '<span class="vcg-bad">' + esc(why) + '</span>') + '</td>' +
            '<td class="num barcell">' + (okc ? bar(c.fillPct) + ' ' : '') + esc(pct(c.fillPct)) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p class="muted calc-small">' + (rl.tech === 'eos' ? 'VC-n-Xv: X = ⌈tốc độ cần / dung lượng C-n⌉; dung lượng C-n lấy từ các VCG trong dữ liệu (TMUX), giới hạn X theo G.707 §11.2/§11.4.' :
          'Đơn vị OTN nhận GFP-F trong dữ liệu; dung lượng = tốc độ − overhead phương án ánh xạ.') + '</p>';
    }
    var warn = [];
    if (rl.tech === 'otn') warn.push('OTN không cắt nhỏ hơn ODU0 (≈ 1,25 Gbit/s) ở lớp ODU: dịch vụ ' + rate(r.cirKbps) + ' vẫn chiếm trọn một ODU0/ODUflex(GFP) 1 TS — phần thừa lãng phí; muốn đúng ' + rate(r.cirKbps) + ' thì thêm policer/shaper ở thiết bị gói, hoặc gom nhiều dịch vụ vào một ODU qua thiết bị gói/SDH.');
    if (rl.tech === 'eos') {
      warn.push('Container là giới hạn CỨNG: cổng Ethernet vẫn nhận 1G, thiết bị EoS phải đệm/rớt phần vượt dung lượng ' + (r.pick ? r.pick.name : 'VCG') + ' (thực tế nên shape ở thiết bị client).');
      if (it.transportNote) warn.push(it.transportNote.note + ' (' + it.transportNote.standard + ')');
    }
    if (rl.tech === 'policer') {
      if (r.tcpKbpsL3) warn.push('Nếu policer đếm byte gói IP thay vì khung L2 thì thông lượng TCP ≈ ' + rate(r.tcpKbpsL3) + ' (tuỳ hãng).');
      if (it.policeVsShape) warn.push(it.policeVsShape.note + ' (' + it.policeVsShape.standard + ')');
      if (it.policerSrTcm) warn.push(it.policerSrTcm.note + ' (' + it.policerSrTcm.standard + ')');
    }
    if (it.cbsRule) warn.push(it.cbsRule.note + ' (' + it.cbsRule.standard + ')');
    if (r.lineTcpKbps) warn.push('So sánh: cổng ' + rate(r.portKbps) + ' không giới hạn cho TCP tối đa ≈ ' + rate(r.lineTcpKbps) + ' (MSS / (khung + 20 B preamble/IFG)).');
    html += '<ul class="calc-notes">' + warn.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
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
    else if (k === 'L') {
      var v = Math.round(+el.value), lo = lim(EL(), 'frame', 'minFrame', 64), hi = Lmax();
      if (!(v >= lo && v <= hi)) { el.setAttribute('aria-invalid', 'true'); el.title = 'L phải trong ' + lo + '–' + hi + ' byte (ngoài khoảng này thiết bị không nhận)'; return; }
      el.removeAttribute('aria-invalid'); el.title = ''; s.L = v;
    }
    else if (k === 'mtu') { var m = Math.round(+el.value); if (!(m >= 68 && m <= 65535)) { el.setAttribute('aria-invalid', 'true'); return; } el.removeAttribute('aria-invalid'); s.mtu = m; }
    else if (k === 'df') s.df = !!el.checked;
    else if (k.indexOf('rl.') === 0) {
      var f = k.slice(3);
      if (f === 'tech') s.rl.tech = el.value;
      else if (f === 'v6') s.rl.v6 = !!el.checked;
      else {
        var x = +el.value, okv = el.value !== '' && (f === 'rtt' ? x >= 0 : f === 'mtu' ? x >= 576 && x <= 9216 : x > 0);
        if (!okv) { el.setAttribute('aria-invalid', 'true'); return; }
        el.removeAttribute('aria-invalid'); s.rl[f] = f === 'mtu' ? Math.round(x) : x;
      }
    }
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
      '<dt>Hiệu suất</dt><dd>tải client ÷ tốc độ cấp đang xét</dd>' +
      '<dt>GFP-F</dt><dd>tốc độ cần = tốc độ Ethernet × (L + 8) / (L + 20)</dd>' +
      '<dt>Stack IP</dt><dd>payload ÷ kích thước frame (không tính preamble/SFD, IFG); vượt MTU → tính trên mọi mảnh</dd>' +
      '<dt>MTU</dt><dd>phần nằm trong khung lớp 2 (sau MAC/VLAN, trước FCS); MSS = MTU người dùng − IP − 20</dd>' +
      '<dt>Phân mảnh</dt><dd>IPv4 DF = 0: router chia mảnh bội 8 byte; IPv6 hoặc DF = 1: rớt + ICMP</dd>' +
      '<dt>Khai báo tốc độ</dt><dd>container nhỏ nhất ≥ CIR sau GFP-F; CBS ≈ CIR × RTT / 8</dd></dl></div>';
  }
  function hide() { cv.active = false; }

  root.CalcView = { init: init, show: show, hide: hide };
})(typeof window !== 'undefined' ? window : globalThis);
