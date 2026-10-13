/*
 * map-sim.js — "Mô phỏng ánh xạ" (view #sim/<id>): xem từng khung server được lấp bằng byte client theo các cách
 * ánh xạ AMP / BMP / GMP / GFP-F / IMP (và PDH-bit nếu dữ liệu có).
 *  1) Phần thuần (MapSim, xuất cả module.exports để test bằng Node): prep (chuẩn hoá kịch bản TMAPS thành lưới ô),
 *     create + step (mô phỏng từng khung, trả về mảng loại ô + bộ đếm). Không phụ thuộc DOM.
 *  2) Phần giao diện (MapSimView): canvas lưới thu nhỏ có tỉ lệ (gộp ô, không vẽ hàng chục nghìn phần tử DOM),
 *     kính lúp từng byte, chú giải màu, bộ đếm, dòng thời gian, nút Chạy/Dừng/Từng khung, thanh trượt ppm/tải.
 * Dữ liệu: window.TMAPS (data/transport-mapping.js), liên kết TMUX/TFRAMES/TLABS nếu có.
 */
(function (root) {
  'use strict';

  // ---------- loại ô ----------
  var T = { EMPTY: 0, DATA: 1, DATA2: 2, FS: 3, JDATA: 4, JSTUFF: 5, GSTUFF: 6, GFPH: 7, GIDLE: 8, BDATA: 9, BIDLE: 10, BINS: 11, OH: 12, JC: 13, OTHER: 14 };
  var TYPE_INFO = [
    { key: 'empty', name: 'Chưa dùng' },
    { key: 'data', name: 'Dữ liệu client' },
    { key: 'data2', name: 'Dữ liệu client (khung Ethernet kế tiếp)' },
    { key: 'fs', name: 'Chèn cố định (fixed stuff)' },
    { key: 'jdata', name: 'Cơ hội chèn mang DỮ LIỆU' },
    { key: 'jstuff', name: 'Cơ hội chèn mang CHÈN (bỏ)' },
    { key: 'gstuff', name: 'Chèn GMP (rải đều)' },
    { key: 'gfph', name: 'GFP header (core + payload) / FCS' },
    { key: 'gidle', name: 'GFP Idle' },
    { key: 'bdata', name: 'Khối 66B của gói' },
    { key: 'bidle', name: 'Khối Idle của client' },
    { key: 'bins', name: 'Khối Idle CHÈN thêm' },
    { key: 'oh', name: 'Overhead khung (FAS…)' },
    { key: 'jc', name: 'Bit/byte điều khiển chèn (JC/Cj)' },
    { key: 'other', name: 'Nhánh khác (gồm Cj, cơ hội chèn của chúng)' }
  ];

  // ---------- tiện ích ----------
  /** PRNG xác định (mulberry32) để mô phỏng lặp lại được. */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function isDataWord(s) { return /dữ liệu|du lieu|data/i.test(String(s || '')); }
  function methodOf(sc) { return String(sc && sc.method || '').toUpperCase(); }
  function isJust(m) { return m === 'AMP' || m === 'BMP' || m === 'PDH-BIT'; }

  /** Danh sách số (hàng/cột, đánh số chuẩn từ 1): số · [đầu, cuối] (dải gồm hai đầu) · [a, b, c…] · "a-b" · {from,to}. */
  function listOf(v, max) {
    var out = [], i;
    if (v == null || v === 'all' || v === '*') { for (i = 1; i <= max; i++) out.push(i); return out; }
    if (typeof v === 'number') return [v];
    if (typeof v === 'string') {
      v.split(/[,;]\s*/).forEach(function (p) {
        var m = /^\s*(\d+)\s*(?:[-–…]|\.\.)\s*(\d+)\s*$/.exec(p);
        if (m) { for (var k = +m[1]; k <= +m[2]; k++) out.push(k); } else if (/^\s*\d+\s*$/.test(p)) out.push(+p);
      });
      return out;
    }
    if (Array.isArray(v)) {
      // hai số [đầu, cuối] là dải (schema GD10); nhiều hơn hai số là danh sách
      if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && v[1] >= v[0]) { for (i = v[0]; i <= v[1]; i++) out.push(i); return out; }
      v.forEach(function (x) { out = out.concat(listOf(x, max)); });
      return out;
    }
    if (typeof v === 'object' && v.from != null) { for (i = +v.from; i <= +(v.to != null ? v.to : v.from); i++) out.push(i); }
    return out;
  }
  /** Hàng/cột của một mục (row | rows, col | cols). */
  function rowsOf(o, max) { return o.rows != null ? listOf(o.rows, max) : o.row != null ? [+o.row] : listOf(null, max); }
  function colsOf(o, max) { return o.cols != null ? listOf(o.cols, max) : o.col != null ? [+o.col] : []; }

  // ---------- chuẩn hoá kịch bản ----------
  /**
   * Chuẩn hoá một phần tử TMAPS thành lưới vùng tải:
   *  { sc, method, unit ('byte'|'bit'|'block'), cellBits, rows (hàng một khung), mf (số khung của đa khung), dRows (= rows × mf: hàng hiển thị),
   *    cols, col0 (cột chuẩn của cột lưới đầu), colStep, at(row, col, f) → chỉ số ô | −1, base (Uint8Array loại ô cố định),
   *    order (thứ tự lấp các ô tải: theo hàng; IMP khối 66B: theo cột = thứ tự lịch), cap, rNom (đơn vị client đến mỗi khung/đa khung ở ppm 0),
   *    ohOut: [ô OH ngoài lưới], errors }.
   */
  function prep(sc) {
    var m = methodOf(sc), fr = sc.frame || {}, sim = sc.sim || {}, errs = [];
    var rows = Math.max(1, +fr.rows || 1), cols = Math.max(1, +fr.cols || 1);
    var cellBits = +fr.cellBits || (m === 'PDH-BIT' ? 1 : 8);
    var unit = cellBits === 1 ? 'bit' : cellBits === 66 ? 'block' : 'byte';
    var J = sc.just || {};
    var col0 = +(fr.firstCol || fr.col0 || 0);
    if (!col0) col0 = J.pjo && J.njo && J.pjo.col === J.njo.col + 1 && J.pjo.col > 1 ? J.pjo.col : 1;
    var colStep = Math.max(1, +fr.colStep || 1), mf = Math.max(1, +fr.multiframe || 1);
    var dRows = rows * mf, cellsN = dRows * cols;
    var P = { sc: sc, method: m, unit: unit, cellBits: cellBits, rows: rows, mf: mf, dRows: dRows, cols: cols, col0: col0, colStep: colStep,
      interleave: +fr.interleave || 0, errors: errs, ohOut: [] };
    /** ô (hàng chuẩn r, cột chuẩn c, khung f của đa khung, mặc định 1) → chỉ số trong lưới, −1 nếu ngoài vùng tải. */
    function at(r, c, f) {
      var d = c - col0;
      if (r < 1 || r > rows || d < 0 || d % colStep) return -1;
      var gc = d / colStep;
      return gc < cols ? (((f || 1) - 1) * rows + r - 1) * cols + gc : -1;
    }
    P.at = at;
    var maxCol = col0 + (cols - 1) * colStep;
    var base = new Uint8Array(cellsN);
    function mark(o, type, outLabel) {
      var rs = rowsOf(o, rows), cs = colsOf(o, maxCol), hit = 0, miss = [];
      for (var f = 1; f <= mf; f++) rs.forEach(function (r) { cs.forEach(function (c) { var i = at(r, c, f); if (i >= 0) { base[i] = type; hit++; } else if (f === 1) miss.push([r, c]); }); });
      if (outLabel && (miss.length || !cs.length)) P.ohOut.push({ abbr: o.abbr || outLabel, note: o.note || '', where: placeText(o) });
      return hit;
    }
    (sc.fixedStuff || []).forEach(function (fs) { mark(fs, T.FS); });
    (sc.oh || []).forEach(function (o) { mark(o, T.OH, 'OH'); });
    var sim1 = !!sim.perTributary;
    if (isJust(m)) {
      var opp = [];
      ['njo', 'pjo'].forEach(function (k) {
        var p = J[k]; if (!p) return;
        opp.push({ key: k, row: +p.row, col: +p.col, cell: at(+p.row, +p.col), note: p.note || '' });
      });
      var table = (J.table || []).map(function (e) {
        var o = { jc: String(e.jc != null ? e.jc : ''), njo: e.njo, pjo: e.pjo, meaning: e.meaning || '' };
        o.never = /không bao giờ phát|không (được )?(tạo|sinh)|not generated|never sent/i.test(o.meaning);
        o.data = { njo: isDataWord(e.njo), pjo: isDataWord(e.pjo) };
        o.count = opp.reduce(function (a, q) { return a + (o.data[q.key] ? 1 : 0); }, 0);
        return o;
      });
      var usable = table.filter(function (e) { return !e.never; });
      if (J.fixedJc != null) usable = table.filter(function (e) { return e.jc === String(J.fixedJc); });
      var normal = (J.fixedJc != null ? usable[0] : null) || usable.filter(function (e) { return /^0+$/.test(e.jc); })[0] ||
        usable.filter(function (e) { return /bình thường|danh định|normal/i.test(e.meaning); })[0] || usable[0] || null;
      if (!table.length) errs.push('Thiếu just.table — mô phỏng không bù.');
      P.just = { opp: opp, table: table, usable: usable, normal: normal, jc: J.jc || null, fixedJc: J.fixedJc != null ? String(J.fixedJc) : null };
      opp.forEach(function (q) { if (q.cell >= 0) base[q.cell] = T.JDATA; });
      if (J.jc) {
        // JC/Cj nằm trong lưới (PDH) → tô; ngoài lưới (OTN: cột OH 16) → hộp OH bên trái
        var jcIn = 0;
        listOf(J.jc.rows, rows).forEach(function (r) { var i = at(r, +J.jc.col); if (i >= 0) { base[i] = T.JC; jcIn++; } });
        P.just.jcInGrid = jcIn > 0;
      }
    }
    // nhiều nhánh xen bit (PDH): chỉ mô phỏng nhánh 1; ô của nhánh j = ((cột − 1) mod N) + 1
    if (sim1) {
      var nTrib = 0;
      (sc.budget || []).forEach(function (b) { if (b.kind === 'pjo') nTrib += +b.cells || 0; });
      nTrib = nTrib || 4;
      P.tributaries = nTrib;
      for (var r = 1; r <= rows; r++) for (var gc = 0; gc < cols; gc++) {
        var c = col0 + gc * colStep, i = at(r, c);
        if (base[i] !== T.EMPTY) continue;
        base[i] = ((c - 1) % nTrib) + 1 === 1 ? T.EMPTY : T.OTHER;
      }
      // Cj / cơ hội chèn của nhánh khác: lệch cột theo số nhánh (nhánh j ở cột + j − 1) — đã là OTHER theo phép mod ở trên
    }
    P.base = base;
    // thứ tự lấp: theo hàng; IMP lưới khối 66B (hàng = khe lịch, cột = vòng lịch) → theo cột
    var order = [], colMajor = m === 'IMP' && cellBits === 66 && rows > 1;
    if (colMajor) { for (var cc = 0; cc < cols; cc++) for (var rr = 0; rr < dRows; rr++) { var ix = rr * cols + cc; if (base[ix] === T.EMPTY) order.push(ix); } }
    else for (var k = 0; k < cellsN; k++) if (base[k] === T.EMPTY || base[k] === T.JDATA) order.push(k);
    P.order = order; P.colMajor = colMajor;
    P.cap = order.length;
    // chu kỳ và tốc độ client theo đơn vị ô / khung (ưu tiên sim.perFrame.nom của dữ liệu)
    var spk = +sc.serverPayloadKbps || 0, ck = +sc.clientKbps || 0;
    P.periodUs = +fr.periodUs || (spk ? cellsN * cellBits / spk * 1000 : 0);
    var pf = sim.perFrame || {};
    P.rNom = pf.nom != null && !sim.packet ? +pf.nom : P.periodUs ? ck * P.periodUs / 1000 / cellBits : 0;
    P.locked = !!(sim.locked || (sc.ppm && sc.ppm.locked) || m === 'BMP');
    if (isJust(m)) {
      var inCnt = P.just.opp.filter(function (q) { return q.cell >= 0; }).length;
      P.fixedData = P.cap - inCnt;                                // ô tải luôn mang dữ liệu (nhánh đang xét)
      P.n0 = P.fixedData + (P.just.normal ? P.just.normal.count : 0);
      if (sim.carry && sim.carry.fixed != null && sim.carry.fixed !== P.fixedData && sim.carry.fixed !== P.n0)
        errs.push('Số ô dữ liệu cố định tính từ lưới (' + P.fixedData + ') khác sim.carry.fixed (' + sim.carry.fixed + ').');
      if (P.locked || !P.rNom) P.rNom = P.n0;
      P.carryMin = P.fixedData + Math.min.apply(null, P.just.usable.map(function (e) { return e.count; }).concat([P.n0 - P.fixedData]));
      P.carryMax = P.fixedData + Math.max.apply(null, P.just.usable.map(function (e) { return e.count; }).concat([P.n0 - P.fixedData]));
    }
    if (m === 'GMP') {
      var g = sc.gmp || {};
      P.wb = Math.max(1, +g.M || (+g.m ? +g.m / 8 : 1));          // byte mỗi từ GMP
      P.Pw = +g.P || +g.Pserver || Math.floor(P.cap / P.wb);
      if (P.Pw * P.wb > P.cap) { errs.push('P × M lớn hơn số ô tải của lưới — cắt bớt.'); P.Pw = Math.floor(P.cap / P.wb); }
      if (P.Pw * P.wb < P.cap) errs.push('Lưới còn ' + (P.cap - P.Pw * P.wb) + ' ô ngoài vùng GMP.');
      P.cmNom = g.cmNom != null ? +g.cmNom : P.rNom / (unit === 'byte' ? P.wb : 1);
      if (pf.nom == null) P.rNom = P.cmNom;
      P.cnBits = +g.cnBits || 14;
    }
    if (m === 'GFP-F') {
      var gf = sc.gfp || {};
      P.gfp = { core: +gf.coreHdr || 4, type: +gf.payloadHdr || 4, ext: +gf.extHdr || 0, fcs: +gf.fcs || 0, idle: +gf.idleBytes || 4,
        minEth: +gf.minEth || 64, maxEth: +gf.maxEth || 1518, pre: gf.preambleSfd != null ? +gf.preambleSfd : 8, ifg: gf.ifg != null ? +gf.ifg : 12 };
      P.wirePerFrame = P.periodUs ? ck * P.periodUs / 1000 / 8 : P.cap; // byte Ethernet trên dây (tốc độ đường) mỗi khung server
    }
    if (m === 'IMP') {
      var blk = (sc.imp && +sc.imp.block) || 66;
      P.block = blk;
      if (cellBits === blk) { P.blocksExact = P.cap; P.blockCols = cols; }
      else { P.blocksExact = cellsN * cellBits / blk; P.blockCols = Math.ceil(Math.ceil(P.blocksExact) / dRows); P.rNom = P.rNom * cellBits / blk; }
    }
    return P;
  }
  function placeText(o) {
    var r = o.rows != null ? [].concat(o.rows).join('–') : o.row, c = o.cols != null ? [].concat(o.cols).join('–') : o.col;
    return (r != null ? 'hàng ' + r : '') + (c != null ? (r != null ? ', ' : '') + 'cột ' + c : '');
  }

  // ---------- mô phỏng ----------
  /** Trạng thái mô phỏng mới. */
  function create(P, seed) {
    var S = { P: P, k: 0, acc: 0.5, cumSent: 0, cumArr: 0, cumNom: 0, plus: 0, minus: 0, hist: [], rnd: rng(seed || 12345), over: 0 };
    if (P.method === 'GMP') { S.acc = 0; S.prevCm = null; }
    if (P.method === 'GFP-F') { S.q = []; S.cur = null; S.budget = 0; S.nextL = 0; S.qBytes = 0; S.drops = 0; S.carried = 0; S.ethBytes = 0; S.parity = 0; S.idleBytes = 0; S.totBytes = 0; }
    if (P.method === 'IMP') { S.capAcc = 0; S.cliAcc = 0; S.q = []; S.target = 8; for (var i = 0; i < S.target; i++) S.q.push(T.BIDLE); S.ins = 0; S.del = 0; S.pkLeft = 0; S.gapLeft = 2; S.pkLen = 10; }
    return S;
  }

  /** Tỉ lệ tốc độ client/server theo độ lệch ppm. */
  function ppmRatio(o) { return (1 + (+o.ppmC || 0) * 1e-6) / (1 + (+o.ppmS || 0) * 1e-6); }

  /**
   * Chạy một khung server (đa khung với GMP theo đa khung). o = { ppmC, ppmS, load (0–100 %), size (byte | 'mix') }.
   * Trả về { k, cells (Uint8Array loại ô), units (đơn vị client mang trong khung), … tuỳ phương pháp }.
   */
  function step(S, o) {
    o = o || {};
    var P = S.P, m = P.method, res;
    if (isJust(m)) res = stepJust(S, o);
    else if (m === 'GMP') res = stepGmp(S, o);
    else if (m === 'GFP-F') res = stepGfp(S, o);
    else if (m === 'IMP') res = stepImp(S, o);
    else res = { cells: new Uint8Array(P.base), units: 0 };
    S.k++;
    res.k = S.k;
    S.hist.push(res.hist != null ? res.hist : 0);
    if (S.hist.length > 64) S.hist.shift();
    return res;
  }

  /**
   * AMP / BMP / chèn bit PDH: số đơn vị client đến trong khung r = rNom × tỉ lệ ppm (BMP: server bám client → r = danh định);
   * chọn mục JC sao cho phần còn lại trong bộ đệm nằm trong [0, 1) — ưu tiên mục bình thường.
   */
  function stepJust(S, o) {
    var P = S.P, J = P.just;
    var r = P.locked ? P.n0 : P.rNom * ppmRatio(o);
    var avail = S.acc + r;
    var cands = J.usable.length ? J.usable.slice() : [{ jc: '', count: J.normal ? J.normal.count : 0, data: {} }];
    if (J.normal) cands.sort(function (a, b) { return (a === J.normal ? -1 : 0) - (b === J.normal ? -1 : 0); });
    var pick = null, best = Infinity;
    cands.forEach(function (e) {
      var rest = avail - (P.fixedData + e.count);
      var dist = rest < 0 ? -rest : rest >= 1 ? rest - 1 + 1e-9 : 0;
      if (dist < best - 1e-12) { best = dist; pick = e; }
    });
    var sent = P.fixedData + pick.count;
    S.acc = avail - sent;
    S.cumSent += sent; S.cumArr += r; S.cumNom += P.n0;
    var delta = sent - P.n0;
    if (delta > 0) S.minus++; else if (delta < 0) S.plus++;   // thêm dữ liệu = chèn âm; bớt = chèn dương
    if (best > 0) S.over++;
    var cells = new Uint8Array(P.base);
    var opp = J.opp.map(function (q) {
      var isData = !!(pick.data && pick.data[q.key]);
      if (q.cell >= 0) cells[q.cell] = isData ? T.JDATA : T.JSTUFF;
      return { key: q.key, row: q.row, col: q.col, inGrid: q.cell >= 0, data: isData };
    });
    for (var i = 0; i < P.order.length; i++) { var c = P.order[i]; if (cells[c] === T.EMPTY) cells[c] = T.DATA; }
    return { cells: cells, units: sent, nominal: P.n0, delta: delta, jc: pick.jc, entry: pick, opp: opp, buffer: S.acc, rate: r, outOfRange: best > 0, hist: delta };
  }

  /** GMP: Cm = ⌊bộ đệm⌋ (đơn vị từ M byte); từ j (1…P) mang dữ liệu nếu (j × Cm) mod P < Cm — rải đều kiểu sigma-delta. */
  function stepGmp(S, o) {
    var P = S.P, r = P.cmNom * ppmRatio(o);
    var avail = S.acc + r;
    var Cm = Math.max(0, Math.min(P.Pw, Math.floor(avail + 1e-9)));
    S.acc = avail - Cm;
    S.cumSent += Cm; S.cumArr += r; S.cumNom += P.cmNom;
    var cells = new Uint8Array(P.base), Pw = P.Pw, wb = P.wb;
    for (var j = 1; j <= Pw; j++) {
      var isData = (j * Cm) % Pw < Cm;
      for (var b = 0; b < wb; b++) { var idx = P.order[(j - 1) * wb + b]; if (idx != null) cells[idx] = isData ? T.DATA : T.GSTUFF; }
    }
    for (var i = Pw * wb; i < P.order.length; i++) cells[P.order[i]] = T.GSTUFF;
    var change = S.prevCm == null ? 0 : Cm - S.prevCm;
    S.prevCm = Cm;
    return { cells: cells, units: Cm * wb, cm: Cm, cmNom: P.cmNom, cmRate: r, change: change, buffer: S.acc, nominal: P.cmNom * wb, hist: Cm - Math.round(P.cmNom) };
  }

  /** Cỡ khung Ethernet tiếp theo: số cố định hoặc 'mix' (IMIX 7:4:1 = 64/594/1518, kẹp theo minEth/maxEth). */
  function drawSize(S, o, g) {
    var sz = o.size;
    if (sz === 'mix' || sz == null) { var x = S.rnd() * 12; sz = x < 7 ? 64 : x < 11 ? 594 : 1518; }
    return Math.max(g.minEth, Math.min(g.maxEth, Math.round(+sz)));
  }

  /** GFP-F: khung Ethernet đến (tải %), bỏ preamble/IFG, thêm header; lấp vùng tải theo thứ tự; không có gì thì GFP Idle. */
  function stepGfp(S, o) {
    var P = S.P, g = P.gfp, load = Math.max(0, Math.min(100, +o.load || 0)) / 100;
    var bufMax = o.bufBytes || 256 * 1024;
    // ngân sách byte trên dây = tải × tốc độ đường × chu kỳ khung server (dao động ±15 % cho giống lưu lượng thật)
    if (load) S.budget += load * P.wirePerFrame * ppmRatio(o) * (0.85 + 0.3 * S.rnd()); else S.budget = 0;
    var arrived = 0;
    if (!S.nextL) S.nextL = drawSize(S, o, g);
    while (load && S.budget >= S.nextL + g.pre + g.ifg) {
      S.budget -= S.nextL + g.pre + g.ifg;
      var gl = S.nextL + g.core + g.type + g.ext + g.fcs;
      if (S.qBytes + gl > bufMax) S.drops++;
      else { S.q.push(S.nextL); S.qBytes += gl; arrived++; }
      S.nextL = drawSize(S, o, g);
    }
    var cells = new Uint8Array(P.base), carried = 0, eth = 0, idle = 0, hdrB = g.core + g.type + g.ext;
    for (var i = 0; i < P.order.length; i++) {
      if (!S.cur) {
        if (S.q.length) { var L0 = S.q.shift(); S.cur = { L: L0, pos: 0, len: L0 + hdrB + g.fcs, idle: false, par: (S.parity = 1 - S.parity) }; S.qBytes -= S.cur.len; }
        else S.cur = { pos: 0, len: g.idle, idle: true };
      }
      var c = S.cur, t;
      if (c.idle) { t = T.GIDLE; idle++; }
      else if (c.pos < hdrB || c.pos >= hdrB + c.L) t = T.GFPH;
      else { t = c.par ? T.DATA : T.DATA2; eth++; }
      cells[P.order[i]] = t;
      if (++c.pos >= c.len) { if (!c.idle) carried++; S.cur = null; }
    }
    S.carried += carried; S.ethBytes += eth; S.idleBytes += idle; S.totBytes += P.order.length;
    S.cumSent += eth;
    return { cells: cells, units: eth, frames: carried, arrived: arrived, idle: idle, idlePct: idle / P.order.length * 100,
      queueBytes: S.qBytes + (S.cur && !S.cur.idle ? S.cur.len - S.cur.pos : 0), queueFrames: S.q.length, drops: S.drops,
      hist: Math.round(eth / P.order.length * 100) };
  }

  /** Luồng khối 66B của client theo tải: gói ⌈(L + 8) / 8⌉ khối (preamble + dữ liệu + /T/) xen khối Idle. */
  function nextClientBlock(S, o) {
    if (S.pkLeft > 0) { S.pkLeft--; if (!S.pkLeft) S.gapLeft = gapBlocks(S, o); return T.BDATA; }
    if (S.gapLeft > 0) { S.gapLeft--; return T.BIDLE; }
    var load = Math.max(0, Math.min(100, +o.load || 0)) / 100;
    if (!load) return T.BIDLE;
    var L0 = o.size === 'mix' || o.size == null ? [64, 64, 64, 64, 64, 64, 64, 594, 594, 594, 594, 1518][Math.floor(S.rnd() * 12)] : +o.size;
    S.pkLen = Math.ceil((L0 + 8) / 8);
    S.pkLeft = S.pkLen - 1;
    if (!S.pkLeft) S.gapLeft = gapBlocks(S, o);
    return T.BDATA;
  }
  function gapBlocks(S, o) {
    var load = Math.max(0.001, Math.min(100, +o.load || 0) / 100);
    var g = S.pkLen * (1 - load) / load; // khoảng trống trung bình để đạt tải
    return Math.max(1, Math.round(g * (0.5 + S.rnd())));
  }

  /**
   * IMP: mỗi khung có cap vị trí khối; client đưa vào ⌊rNom × ppm⌋ khối (tích luỹ phần lẻ).
   * Bộ đệm vượt mục tiêu → XOÁ khối Idle của client (không bao giờ xoá khối của gói); thiếu → CHÈN khối Idle trước một gói mới.
   */
  function stepImp(S, o) {
    var P = S.P;
    S.capAcc += P.blocksExact; var cap = Math.floor(S.capAcc + 1e-9); S.capAcc -= cap;
    S.cliAcc += P.rNom * ppmRatio(o); var nIn = Math.floor(S.cliAcc + 1e-9); S.cliAcc -= nIn;
    for (var i = 0; i < nIn; i++) S.q.push(nextClientBlock(S, o));
    S.cumArr += nIn;
    var out = [], ins = 0, del = 0;
    var excess = S.q.length - cap - S.target;
    for (var d = S.q.length - 1; excess > 0 && d >= 0; d--) {
      if (S.q[d] === T.BIDLE) { S.q.splice(d, 1); excess--; del++; }
    }
    while (out.length < cap) {
      // thiếu khối: chỉ chèn ở ranh giới gói (khối kế là Idle hoặc đầu gói) — không cắt giữa gói
      if (!S.q.length || (S.q.length < S.target && S.q[0] !== T.BDATA)) { out.push(T.BINS); ins++; continue; }
      out.push(S.q.shift());
    }
    S.ins += ins; S.del += del;
    var cells = new Uint8Array(P.base);
    var nOut = Math.min(out.length, P.order.length);
    for (var k = 0; k < nOut; k++) cells[P.order[k]] = out[k];
    var dataBlocks = 0; for (k = 0; k < out.length; k++) if (out[k] === T.BDATA) dataBlocks++;
    S.cumSent += cap - ins;
    return { cells: cells, units: cap - ins, blocks: cap, data: dataBlocks, ins: ins, del: del, buffer: S.q.length, hist: ins - del };
  }

  /** Bảng đếm loại ô trong một khung. */
  function countTypes(cells) {
    var c = []; for (var t = 0; t < TYPE_INFO.length; t++) c.push(0);
    for (var i = 0; i < cells.length; i++) c[cells[i]]++;
    return c;
  }

  /** Số vị trí dữ liệu theo công thức sigma-delta (kiểm: đúng bằng Cm). */
  function gmpDataCount(Cm, Pw) { var n = 0; for (var j = 1; j <= Pw; j++) if ((j * Cm) % Pw < Cm) n++; return n; }

  /** Cm min/max trong dải dung sai ppm: lấy từ dữ liệu (CmMin/CmMax) hoặc tính (client ±a, server ±b). */
  function gmpRange(P) {
    var g = P.sc.gmp || {};
    if (g.CmMin != null && g.CmMax != null) return { min: +g.CmMin, max: +g.CmMax };
    var a = ((P.sc.ppm && +P.sc.ppm.client) || 0) * 1e-6, b = ((P.sc.ppm && +P.sc.ppm.server) || 0) * 1e-6;
    return { min: Math.floor(P.cmNom * (1 - a) / (1 + b)), max: Math.ceil(P.cmNom * (1 + a) / (1 - b)) };
  }

  var api = { T: T, TYPE_INFO: TYPE_INFO, rng: rng, listOf: listOf, prep: prep, create: create, step: step, countTypes: countTypes,
    gmpDataCount: gmpDataCount, gmpRange: gmpRange, ppmRatio: ppmRatio, methodOf: methodOf };
  root.MapSim = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // =====================================================================
  // Giao diện (chỉ trình duyệt)
  // =====================================================================
  if (typeof document === 'undefined') return;

  var STORE_KEY = 'fs.sim.v1';
  var METHOD_ORDER = ['PDH-BIT', 'AMP', 'BMP', 'GMP', 'GFP-F', 'IMP'];
  var METHOD_HINT = {
    'AMP': 'Asynchronous Mapping: client và server chạy clock riêng; lệch tốc độ bù bằng 1 byte NJO/PJO, báo bằng JC (đa số 2/3).',
    'BMP': 'Bit-synchronous Mapping: clock server suy từ clock client → không cần bù; NJO/PJO cố định, JC luôn bình thường.',
    'GMP': 'Generic Mapping Procedure: mỗi khung báo Cm = số từ dữ liệu; byte dữ liệu và byte chèn rải đều theo công thức sigma-delta.',
    'GFP-F': 'Frame-mapped GFP: mỗi khung MAC thành một khung GFP (header + payload); không có khung thì phát GFP Idle 4 byte.',
    'IMP': 'Idle Mapping Procedure: luồng khối 64B/66B đặt nối tiếp vào OPUflex; lệch tốc độ bù bằng chèn/xoá khối Idle giữa các gói.',
    'PDH-BIT': 'Chèn bit PDH: mỗi khung có một bit cơ hội chèn, báo bằng các bit điều khiển chèn (đa số).'
  };
  var sv = { active: false, id: null, P: null, S: null, last: null, timer: null, st: null, colors: null, zoom: 0, built: false };

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function maps() { return (Array.isArray(root.TMAPS) ? root.TMAPS : []).filter(function (x) { return x && x.id; }); }
  function sortedMaps() {
    var key = function (x) { return x.order != null ? +x.order : 1000 + METHOD_ORDER.indexOf(methodOf(x)) * 10; };
    return maps().slice().sort(function (a, b) { return key(a) - key(b); });
  }
  function byId(id) { return maps().filter(function (x) { return x.id === id; })[0] || null; }
  function TV() { return root.TransViz; }
  function n(x, d) { return TV() ? TV().fmtNum(x, d == null ? 2 : d) : (Math.round(x * 100) / 100).toString(); }
  function rate(k) { return TV() ? TV().fmtRate(k) : n(k) + ' kbit/s'; }
  function sGet() { try { var v = localStorage.getItem(STORE_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function sSet() { try { localStorage.setItem(STORE_KEY, JSON.stringify(sv.st)); } catch (e) { /* bỏ qua */ } }
  function unitName(P) { return P.method === 'IMP' ? 'khối' : P.unit === 'bit' ? 'bit' : 'byte'; }
  function nameOfUnit(id) {
    var M = root.TMUX || {};
    if (M[id] && TV() && TV().lab) return TV().lab.nameOf(M, id);
    return M[id] ? M[id].name : id;
  }

  /** Khung TFRAMES liên quan: sc.frameId → frame của server/client trong TMUX → id trùng. */
  function frameLinks(sc) {
    var M = root.TMUX || {}, F = root.TFRAMES || {}, out = [];
    [].concat(sc.frames || []).concat([sc.frameId, sc.serverFrame, M[sc.server] && M[sc.server].frame, sc.server, M[sc.client] && M[sc.client].frame, sc.client]).forEach(function (f) {
      if (f && F[f] && out.indexOf(f) < 0) out.push(f);
    });
    return out;
  }
  /** Lab có client hoặc server trong palette/gốc. */
  function labLink(sc) {
    var labs = Array.isArray(root.TLABS) ? root.TLABS : [], M = root.TMUX || {};
    var want = [sc.server, sc.client].filter(Boolean);
    var has = function (l, w) { return (l.palette || []).indexOf(w) >= 0 || (l.roots || []).indexOf(w) >= 0; };
    var hit = null;
    want.some(function (w) { hit = labs.filter(function (l) { return has(l, w); })[0] || null; return !!hit; });
    if (!hit && M[sc.server]) hit = labs.filter(function (l) { return l.family === M[sc.server].family; })[0];
    return hit || null;
  }

  // ---------- trạng thái người dùng ----------
  function loadSt() {
    var s = sGet() || {};
    if (typeof s !== 'object') s = {};
    s.per = s.per && typeof s.per === 'object' ? s.per : {};
    s.fps = [1, 3, 8, 20].indexOf(+s.fps) >= 0 ? +s.fps : 3;
    return s;
  }
  function params() {
    var p = sv.st.per[sv.id] || (sv.st.per[sv.id] = {});
    var sc = sv.P.sc, pc = (sc.ppm && +sc.ppm.client) || 0, ps = (sc.ppm && +sc.ppm.server) || 0;
    p.ppmC = Math.max(-pc, Math.min(pc, +p.ppmC || 0));
    p.ppmS = Math.max(-ps, Math.min(ps, +p.ppmS || 0));
    if (!(p.load >= 0 && p.load <= 100)) p.load = sv.P.method === 'IMP' ? 60 : 50;
    if (p.size !== 'mix' && !(+p.size > 0)) p.size = 'mix';
    return p;
  }

  // ---------- màu ----------
  function readColors() {
    var cs = getComputedStyle(document.getElementById('view-sim'));
    sv.colors = TYPE_INFO.map(function (t) { return (cs.getPropertyValue('--sim-' + t.key) || '').trim() || '#999'; });
    sv.colors.grid = (cs.getPropertyValue('--sim-gridline') || '').trim() || 'rgba(0,0,0,.15)';
    sv.colors.text = (cs.getPropertyValue('--text') || '').trim() || '#222';
  }

  // ---------- dựng trang ----------
  function build() {
    var sc = sv.P.sc, P = sv.P, m = P.method, p = params();
    var list = sortedMaps();
    var fl = frameLinks(sc), lab = labLink(sc);
    var pc = (sc.ppm && +sc.ppm.client) || 0, ps = (sc.ppm && +sc.ppm.server) || 0;
    var html =
      '<section class="stack-head"><div class="head-top"><span class="eyebrow">Mô phỏng ánh xạ · ' + esc(m === 'PDH-BIT' ? 'PDH chèn bit' : m) + '</span>' +
      '<h1 class="stack-title">' + esc(sc.name || sc.id) + '</h1>' +
      '<p class="stack-summary">' + esc(sc.summary || METHOD_HINT[m] || '') + '</p>' +
      '<div class="sim-links">' +
        (sc.client ? '<span class="chip">client: ' + esc(nameOfUnit(sc.client)) + (sc.clientKbps ? ' · ' + esc(rate(+sc.clientKbps)) : '') + '</span>' : '') +
        (sc.server ? '<span class="chip">server: ' + esc(nameOfUnit(sc.server)) + (sc.serverPayloadKbps ? ' · tải ' + esc(rate(+sc.serverPayloadKbps)) : '') + '</span>' : '') +
        fl.map(function (f) { return '<a class="btn-ghost" href="#t/' + esc(f) + '">Xem khung ' + esc((root.TFRAMES[f] || {}).name || f) + '</a>'; }).join('') +
        (lab ? '<a class="btn-ghost" href="#lab/' + esc(lab.id) + '">Mở lab ' + esc(lab.name || lab.id) + '</a>' : '') +
      '</div>' + (sc.standard ? '<p class="muted calc-small">Chuẩn: ' + esc(sc.standard) + '</p>' : '') + '</div></section>' +
      '<nav class="sim-pick" aria-label="Chọn kịch bản">' + list.map(function (x) {
        return '<a class="sim-tab' + (x.id === sc.id ? ' is-on' : '') + '" href="#sim/' + esc(x.id) + '"' + (x.id === sc.id ? ' aria-current="page"' : '') + '><b>' + esc(methodOf(x) === 'PDH-BIT' ? 'PDH' : methodOf(x)) + '</b> ' + esc(x.name || x.id) + '</a>';
      }).join('') + '</nav>' +
      (P.errors.length ? '<div class="alert alert--warn">' + P.errors.map(esc).join('<br>') + '</div>' : '') +
      '<section class="card sim-card" aria-labelledby="sim-ctl-t"><div class="section-title"><h2 id="sim-ctl-t">Điều khiển</h2><span class="muted" data-sim="frameno"></span></div>' +
      '<div class="sim-controls">' +
        '<button type="button" class="btn-ghost sim-run" data-sact="run">▶ Chạy</button>' +
        '<button type="button" class="btn-ghost" data-sact="step">⏭ Từng khung</button>' +
        '<button type="button" class="btn-ghost" data-sact="reset">↺ Đặt lại</button>' +
        '<label class="sim-field"><span>Tốc độ</span><select data-sin="fps">' + [[1, '1 khung/s'], [3, '3 khung/s'], [8, '8 khung/s'], [20, '20 khung/s']].map(function (o) {
          return '<option value="' + o[0] + '"' + (sv.st.fps === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
        (m !== 'BMP' && pc ? slider('ppmC', 'Lệch clock client (ppm)', -pc, pc, 1, p.ppmC) : '') +
        (ps ? slider('ppmS', m === 'BMP' ? 'Lệch clock (client = server, ppm)' : 'Lệch clock server (ppm)', -ps, ps, 1, p.ppmS) : '') +
        (m === 'GFP-F' || m === 'IMP' ? slider('load', 'Tải Ethernet (%)', 0, 100, 1, p.load) +
          '<label class="sim-field"><span>Cỡ khung Ethernet</span><select data-sin="size">' + sizeOptions(p.size) + '</select></label>' : '') +
      '</div></section>' +
      '<section class="card sim-card" aria-labelledby="sim-grid-t"><div class="section-title"><h2 id="sim-grid-t">Vùng tải một khung server</h2><span class="muted" data-sim="gridcap"></span></div>' +
        '<div class="sim-gridwrap"><div class="sim-oh" data-sim="oh" aria-label="Overhead điều khiển ánh xạ"></div>' +
        '<div class="sim-canvas-wrap"><canvas class="sim-canvas" data-sim="grid" role="img" aria-label="Lưới vùng tải thu nhỏ"></canvas>' +
        '<div class="sim-axis muted" data-sim="axis"></div></div></div>' +
        '<div class="sim-zoomhead"><span><b>Kính lúp</b> <span class="muted" data-sim="zoomlbl"></span></span>' +
        '<input type="range" min="0" max="1000" step="1" value="' + Math.round(sv.zoom * 1000) + '" data-sin="zoom" aria-label="Vị trí kính lúp"></div>' +
        '<canvas class="sim-zoom" data-sim="zoom" role="img" aria-label="Phóng to từng ô"></canvas>' +
        '<ul class="sim-legend" data-sim="legend"></ul>' +
      '</section>' +
      '<section class="card sim-card" aria-labelledby="sim-cnt-t"><div class="section-title"><h2 id="sim-cnt-t">Bộ đếm</h2></div>' +
        '<div class="stats" data-sim="stats"></div>' +
        '<div class="sim-timeline"><span class="muted calc-small" data-sim="tlabel"></span><canvas class="sim-hist" data-sim="hist" role="img" aria-label="Dòng thời gian các khung gần nhất"></canvas></div>' +
      '</section>' +
      '<section class="card sim-card" aria-labelledby="sim-steps-t"><div class="section-title"><h2 id="sim-steps-t">Từng bước</h2></div>' +
        (sc.steps && sc.steps.length ? '<ol class="sim-steps">' + sc.steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '<p class="muted">' + esc(METHOD_HINT[m] || '') + '</p>') +
        (sc.note ? '<p class="note calc-note">' + esc(sc.note) + '</p>' : '') +
      '</section>';
    $('#view-sim').innerHTML = html;
    readColors();
    renderDetail();
    sv.built = true;
  }

  function slider(key, label, min, max, stepv, val) {
    return '<label class="sim-field sim-slider"><span>' + esc(label) + ': <b data-sval="' + key + '">' + fmtSigned(key, val) + '</b></span>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + stepv + '" value="' + val + '" data-sin="' + key + '"></label>';
  }
  function fmtSigned(key, v) { return key === 'load' ? v + ' %' : (v > 0 ? '+' : '') + v; }
  function sizeOptions(sel) {
    var g = sv.P.gfp || { minEth: 64, maxEth: 1518 };
    var sizes = [64, 128, 512, 1518].filter(function (x) { return x >= g.minEth && x <= g.maxEth; });
    if (sizes.indexOf(g.maxEth) < 0) sizes.push(g.maxEth);
    return '<option value="mix"' + (sel === 'mix' ? ' selected' : '') + '>Ngẫu nhiên (IMIX 64/594/1518)</option>' +
      sizes.map(function (x) { return '<option value="' + x + '"' + (+sel === x ? ' selected' : '') + '>' + x + ' byte</option>'; }).join('');
  }

  /** Panel bên phải: ý nghĩa phương pháp + bảng JC / công thức GMP / tham số GFP / IMP. */
  function renderDetail() {
    var sc = sv.P.sc, P = sv.P, m = P.method, h = '';
    h += '<div class="detail-card"><span class="eyebrow">Mô phỏng ánh xạ</span><h2>' + esc(m === 'PDH-BIT' ? 'Chèn bit PDH' : m) + '</h2><p>' + esc(METHOD_HINT[m] || '') + '</p>';
    if (P.just && P.just.table.length) {
      h += '<h3>Bảng JC</h3><div class="tbl-wrap"><table class="values"><thead><tr><th>JC</th><th>NJO</th><th>PJO</th><th>Ý nghĩa</th></tr></thead><tbody>' +
        P.just.table.map(function (e) { return '<tr' + (e.never ? ' class="is-off"' : '') + '><td><code>' + esc(e.jc) + '</code></td><td>' + esc(e.njo) + '</td><td>' + esc(e.pjo) + '</td><td>' + esc(e.meaning) + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
      if (P.just.jc) h += '<p class="muted calc-small">JC ở ' + esc(jcPlace(P.just.jc)) + (P.just.jc.vote ? ' — biểu quyết ' + esc(P.just.jc.vote) : '') + '. ' + esc(P.just.jc.note || '') + '</p>';
      P.just.opp.forEach(function (q) { if (q.note) h += '<p class="muted calc-small"><b>' + esc(q.key.toUpperCase()) + '</b> (hàng ' + q.row + ', cột ' + q.col + '): ' + esc(q.note) + '</p>'; });
    }
    if (m === 'GMP') {
      var g = sc.gmp || {}, rg = gmpRange(P);
      h += '<dl class="kv"><dt>P (từ / ' + (P.mf > 1 ? 'đa khung ' + P.mf : 'khung') + ')</dt><dd>' + esc(n(P.Pw, 0)) + ' từ × ' + P.wb + ' byte' + (g.word ? ' (' + esc(g.word) + ')' : '') + '</dd>' +
        '<dt>Cm danh định</dt><dd>' + esc(n(P.cmNom, 3)) + '</dd><dt>Cm trong dải ppm</dt><dd>' + esc(n(rg.min, 0)) + ' … ' + esc(n(rg.max, 0)) + '</dd>' +
        (g.formula ? '<dt>Công thức</dt><dd>' + esc(g.formula) + '</dd>' : '') + '<dt>Rải đều</dt><dd>' + esc(g.sigmaDelta || 'từ j là dữ liệu nếu (j × Cm) mod P < Cm') + '</dd>' +
        (g.jcBytes ? '<dt>Cm truyền ở</dt><dd>' + esc([].concat(g.jcBytes).join(', ')) + ' (' + P.cnBits + ' bit)</dd>' : '') +
        (g.jc && g.jc.cm ? '<dt>Cm truyền ở</dt><dd>' + esc(jcPlace(g.jc.cm)) + ' (' + P.cnBits + ' bit) — ' + esc(g.jc.cm.note || '') + '</dd>' : '') +
        (g.jc && g.jc.cnd ? '<dt>ΣCnD</dt><dd>' + esc(jcPlace(g.jc.cnd)) + ' — ' + esc(g.jc.cnd.note || '') + (g.cndUsed === false ? ' (không dùng ở kịch bản này)' : '') + '</dd>' : '') +
        (g.appliesTo ? '<dt>Cm áp dụng cho</dt><dd>' + esc(g.appliesTo) + '</dd>' : '') + '</dl>';
      if (g.iiDi && g.iiDi.length) h += '<h3>Báo thay đổi Cm (II/DI)</h3><div class="tbl-wrap"><table class="values"><thead><tr><th>Đổi</th><th>II</th><th>DI</th><th>Ý nghĩa</th></tr></thead><tbody>' +
        g.iiDi.map(function (x) { return '<tr data-cmchg="' + esc(x.change) + '"><td>' + esc(x.change) + '</td><td>' + esc(x.ii) + '</td><td>' + esc(x.di) + '</td><td>' + esc(x.meaning) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if (m === 'GFP-F') {
      var f = P.gfp;
      h += '<dl class="kv"><dt>Core header</dt><dd>' + f.core + ' B (PLI + cHEC)</dd><dt>Payload header</dt><dd>' + f.type + ' B (Type + tHEC)</dd>' +
        (f.ext ? '<dt>Extension</dt><dd>' + f.ext + ' B</dd>' : '') + '<dt>pFCS</dt><dd>' + (f.fcs ? f.fcs + ' B' : 'không') + '</dd><dt>GFP Idle</dt><dd>' + f.idle + ' B (PLI = 0)</dd>' +
        '<dt>Khung Ethernet</dt><dd>' + f.minEth + '–' + f.maxEth + ' B (bỏ preamble ' + f.pre + ' + IFG ' + f.ifg + ')</dd>' +
        (sc.gfp && sc.gfp.type ? '<dt>Type</dt><dd>' + esc(sc.gfp.type) + '</dd>' : '') +
        (sc.gfp && sc.gfp.fullLoad ? '<dt>Tải đầy</dt><dd>khung 1518: ' + esc(n(sc.gfp.fullLoad.L1518 * 100, 2)) + '% · khung 64: ' + esc(n(sc.gfp.fullLoad.L64 * 100, 2)) + '% dung lượng</dd>' : '') + '</dl>' +
        (sc.gfp && sc.gfp.rule ? '<p class="muted calc-small">' + esc(sc.gfp.rule) + '</p>' : '');
    }
    if (m === 'IMP') {
      h += '<dl class="kv"><dt>Khối</dt><dd>' + P.block + ' bit (64B/66B)</dd><dt>Khối / khung server</dt><dd>' + esc(n(P.blocksExact, 3)) + '</dd>' +
        '<dt>Bù tốc độ</dt><dd>' + esc((sc.imp && sc.imp.idle) || 'chèn/xoá khối Idle') + '</dd>' +
        (sc.imp && sc.imp.where ? '<dt>Ở đâu</dt><dd>' + esc(sc.imp.where) + '</dd>' : '') +
        (sc.imp && sc.imp.nominalDeletePerFrame != null ? '<dt>Danh định</dt><dd>' + (sc.imp.nominalDeletePerFrame >= 0 ? 'xoá ' : 'chèn ') + esc(n(Math.abs(sc.imp.nominalDeletePerFrame), 3)) + ' khối/khung (' + esc(n(sc.imp.nominalPpm, 1)) + ' ppm)</dd>' : '') + '</dl>' +
        (sc.imp && sc.imp.otn && sc.imp.otn.note ? '<p class="muted calc-small"><b>Trong OTN:</b> ' + esc(sc.imp.otn.note) + '</p>' : '');
    }
    if (sc.ppm && sc.ppm.note) h += '<p class="muted calc-small"><b>Dung sai:</b> client ±' + esc(sc.ppm.client) + ' ppm, server ±' + esc(sc.ppm.server) + ' ppm. ' + esc(sc.ppm.note) + '</p>';
    if (sc.frame && sc.frame.note) h += '<p class="muted calc-small"><b>Lưới:</b> ' + esc(sc.frame.note) + '</p>';
    if (P.ohOut.length || (sc.oh || []).length) {
      h += '<h3>Overhead liên quan</h3><ul class="plain calc-small">' + (sc.oh || []).map(function (o) { return '<li><b>' + esc(o.abbr || 'OH') + '</b> ' + esc(placeText(o)) + (o.note ? ' — ' + esc(o.note) : '') + '</li>'; }).join('') + '</ul>';
    }
    h += '<h3>Màu</h3><p class="muted calc-small">Lưới thu nhỏ: mỗi ô vẽ gộp nhiều byte (tỉ lệ ghi trên lưới); loại hiếm (chèn, JC…) luôn hiện tối thiểu 1 vạch. Kéo kính lúp hoặc bấm lên lưới để xem từng byte.</p></div>';
    document.getElementById('detail').innerHTML = h;
  }
  function jcPlace(jc) {
    var rows = [].concat(jc.rows || []).join(', '), bits = [].concat(jc.bits || []).join(', ');
    return 'hàng ' + rows + (jc.col ? ', cột ' + jc.col : '') + (bits ? ', bit ' + bits : '');
  }

  // ---------- vẽ ----------
  function gridDims() {
    var P = sv.P;
    return { rows: P.dRows, cols: P.cols };
  }

  /** Vẽ lưới thu nhỏ: gộp `bw` ô liền nhau trên một hàng thành một ô hiển thị; loại hiếm vẽ thành vạch tối thiểu 1,5 px. */
  function drawGrid(cells) {
    var cv = $('#view-sim [data-sim="grid"]');
    if (!cv) return;
    var d = gridDims(), wrap = cv.parentNode, cssW = Math.max(240, wrap.clientWidth || 600);
    var dpr = root.devicePixelRatio || 1;
    var visCols = Math.max(1, Math.min(d.cols, Math.floor(cssW / 4)));
    var bw = Math.ceil(d.cols / visCols); visCols = Math.ceil(d.cols / bw);
    var rh = d.rows <= 2 ? 34 : d.rows <= 4 ? 26 : d.rows <= 9 ? 16 : Math.max(4, Math.floor(200 / d.rows));
    var cssH = rh * d.rows;
    cv.style.height = cssH + 'px';
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    var cw = cssW / visCols, C = sv.colors, cnt = new Array(TYPE_INFO.length);
    // loại hiếm (vài ô trong cả khung: PJO, JC…) vẽ tối thiểu 1,5 px để thấy được; loại có mặt ở nhiều ô hiển thị
    // (vd chèn GMP rải đều) vẽ đúng tỉ lệ — nếu không, lưới trông như một nửa là chèn
    var tot = countTypes(cells), rare = [];
    for (var q = 0; q < tot.length; q++) rare.push(tot[q] > 0 && tot[q] <= visCols * d.rows / 8);
    for (var r = 0; r < d.rows; r++) {
      for (var b = 0; b < visCols; b++) {
        var c0 = b * bw, c1 = Math.min(d.cols, c0 + bw), first = {};
        for (var t = 0; t < cnt.length; t++) cnt[t] = 0;
        for (var c = c0; c < c1; c++) { var ty = cells[r * d.cols + c] || 0; if (!cnt[ty]) first[ty] = c - c0; cnt[ty]++; }
        var maj = 0; for (t = 1; t < cnt.length; t++) if (cnt[t] > cnt[maj]) maj = t;
        var x = b * cw, y = r * rh;
        ctx.fillStyle = C[maj]; ctx.fillRect(x, y, cw + 0.5, rh);
        for (t = 0; t < cnt.length; t++) {
          if (t === maj || !cnt[t]) continue;
          var w = rare[t] ? Math.max(1.5, cnt[t] / (c1 - c0) * cw) : cnt[t] / (c1 - c0) * cw;
          ctx.fillStyle = C[t]; ctx.fillRect(x + first[t] / (c1 - c0) * cw, y, w, rh);
        }
      }
    }
    ctx.strokeStyle = C.grid; ctx.lineWidth = 1;
    for (r = 1; r < d.rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * rh + 0.5); ctx.lineTo(cssW, r * rh + 0.5); ctx.stroke(); }
    // khung kính lúp
    var z = zoomRange(d);
    ctx.strokeStyle = C.text; ctx.lineWidth = 2;
    ctx.strokeRect(z.c0 / d.cols * cssW, z.r * rh + 1, Math.max(3, z.len / d.cols * cssW), rh - 2);
    var unit = unitName(sv.P);
    $('#view-sim [data-sim="axis"]').textContent = axisText(d, bw, unit);
  }

  /** Chú thích trục lưới: kích thước, tỉ lệ gộp, cột chuẩn, đa khung / TS / VCAT / lịch FlexE. */
  function axisText(d, bw, unit) {
    var P = sv.P, parts = [];
    parts.push((P.mf > 1 ? P.mf + ' khung × ' + P.rows + ' hàng' : d.rows + ' hàng') + ' × ' + n(d.cols, 0) + ' ' + unit);
    parts.push('mỗi ô hiển thị = ' + bw + ' ' + unit);
    if (P.colStep > 1) parts.push('cột chuẩn ' + P.col0 + ', ' + (P.col0 + P.colStep) + ', ' + (P.col0 + 2 * P.colStep) + ' … ' + (P.col0 + (d.cols - 1) * P.colStep) + ' (1 TS, cách ' + P.colStep + ' cột)');
    else if (P.cellBits !== 66) parts.push('cột ' + P.col0 + '–' + (P.col0 + d.cols - 1) + ' của khung server');
    if (P.interleave) parts.push('cột xen ' + P.interleave + ' thành viên VCAT');
    if (P.colMajor) parts.push('hàng = khe lịch, cột = vòng lịch; khối lấp theo cột');
    return parts.join(' · ');
  }

  function zoomRange(d) {
    var len = Math.min(d.cols, 64), total = d.rows * d.cols;
    var start = Math.min(total - len, Math.round(sv.zoom * (total - len)));
    var r = Math.floor(start / d.cols), c0 = start % d.cols;
    if (c0 + len > d.cols) c0 = d.cols - len;
    return { r: r, c0: c0, len: len };
  }

  function drawZoom(cells) {
    var cv = $('#view-sim [data-sim="zoom"]');
    if (!cv) return;
    var d = gridDims(), z = zoomRange(d), cssW = Math.max(240, cv.parentNode.clientWidth || 600), dpr = root.devicePixelRatio || 1;
    var cw = cssW / z.len, h = 30;
    cv.style.height = h + 'px'; cv.width = Math.round(cssW * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var C = sv.colors;
    for (var i = 0; i < z.len; i++) {
      var ty = cells[z.r * d.cols + z.c0 + i] || 0;
      ctx.fillStyle = C[ty]; ctx.fillRect(i * cw + 0.5, 0.5, cw - 1, h - 1);
    }
    var unit = unitName(sv.P);
    $('#view-sim [data-sim="zoomlbl"]').textContent = 'hàng ' + (z.r + 1) + ', ' + unit + ' ' + (z.c0 + 1) + '–' + (z.c0 + z.len) + ' của vùng tải' +
      (sv.P.method === 'IMP' ? '' : ' (cột ' + (sv.P.col0 + z.c0) + '–' + (sv.P.col0 + z.c0 + z.len - 1) + ')') + ' — mỗi ô = 1 ' + unit;
  }

  function drawHist() {
    var cv = $('#view-sim [data-sim="hist"]');
    if (!cv || !sv.S) return;
    var hst = sv.S.hist, cssW = Math.max(240, cv.parentNode.clientWidth || 600), h = 46, dpr = root.devicePixelRatio || 1;
    cv.style.height = h + 'px'; cv.width = Math.round(cssW * dpr); cv.height = Math.round(h * dpr);
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var C = sv.colors, N = 64, w = cssW / N, m = sv.P.method;
    var maxAbs = 1; hst.forEach(function (v) { maxAbs = Math.max(maxAbs, Math.abs(v)); });
    var mid = m === 'GFP-F' ? h - 2 : h / 2;
    ctx.fillStyle = C.grid; ctx.fillRect(0, mid, cssW, 1);
    hst.forEach(function (v, i) {
      var x = (N - hst.length + i) * w;
      if (m === 'GFP-F') { var hh = v / 100 * (h - 4); ctx.fillStyle = C[T.DATA]; ctx.fillRect(x + 1, mid - hh, w - 2, hh); return; }
      var col = v > 0 ? C[T.JDATA] : v < 0 ? (m === 'IMP' ? C[T.BINS] : C[T.JSTUFF]) : C[T.DATA];
      var hh2 = v ? Math.max(3, Math.abs(v) / maxAbs * (h / 2 - 3)) : 2;
      ctx.fillStyle = col; ctx.fillRect(x + 1, v >= 0 ? mid - hh2 : mid, w - 2, hh2);
    });
    var lbl = { AMP: 'Dòng thời gian 64 khung: cột lên = thêm 1 byte dữ liệu (chèn âm), cột xuống = bớt 1 byte (chèn dương), vạch giữa = bình thường.',
      BMP: 'Dòng thời gian: BMP không bù — luôn ở vạch giữa.', GMP: 'Dòng thời gian: Cm − Cm danh định (làm tròn) mỗi khung.',
      'GFP-F': 'Dòng thời gian: % vùng tải mang dữ liệu Ethernet mỗi khung (phần còn lại là header + Idle).',
      IMP: 'Dòng thời gian: lên = xoá khối Idle, xuống = chèn khối Idle (số khối mỗi khung).', 'PDH-BIT': 'Dòng thời gian: thêm/bớt bit dữ liệu ở cơ hội chèn.' }[m];
    if (m === 'IMP') { /* chèn: v = ins − del > 0 → vẽ màu chèn ở trên; đổi chú thích cho khớp */ lbl = 'Dòng thời gian: cột lên = chèn khối Idle, cột xuống = xoá khối Idle của client.'; }
    $('#view-sim [data-sim="tlabel"]').textContent = lbl || '';
  }

  function stat(label, value, sub, cls) {
    return '<div class="stat' + (cls ? ' ' + cls : '') + '"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + value + '</div>' + (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
  }

  function renderStats(res) {
    var P = sv.P, S = sv.S, m = P.method, u = unitName(P), h = '';
    var dev = S.cumSent - S.cumNom;
    if (m === 'AMP' || m === 'BMP' || m === 'PDH-BIT') {
      h += stat(u + (P.tributaries ? ' nhánh 1' : ' client') + ' / khung', esc(n(res.units, 0)), 'danh định ' + esc(n(P.n0, 0)) + (res.delta ? ' (' + (res.delta > 0 ? '+' : '') + res.delta + ')' : '')) +
        stat('JC khung này', '<code>' + esc(res.jc || '–') + '</code>', esc(res.entry && res.entry.meaning || '')) +
        stat('Chèn dương / âm', esc(S.plus) + ' / ' + esc(S.minus), 'tổng từ khi chạy') +
        stat('Lệch tích luỹ', (dev > 0 ? '+' : '') + esc(n(dev, 0)) + ' ' + u, 'so với ' + esc(n(P.n0, 0)) + ' × ' + S.k + ' khung') +
        stat('Bộ đệm (phần lẻ)', esc(n(res.buffer, 3)) + ' ' + u, res.outOfRange ? '<span class="vcg-bad">vượt khả năng bù!</span>' : 'giữ trong [0, 1)');
    } else if (m === 'GMP') {
      var rg = gmpRange(P);
      h += stat('Cm ' + (P.mf > 1 ? 'đa khung' : 'khung') + ' này', esc(n(res.cm, 0)) + (res.change ? ' <small>(' + (res.change > 0 ? '+' : '−') + Math.abs(res.change) + ')</small>' : ''), 'danh định ' + esc(n(P.cmNom, 3)) + ' · dải ' + esc(n(rg.min, 0)) + '…' + esc(n(rg.max, 0))) +
        (P.wb > 1 ? stat('Từ dữ liệu / chèn', esc(n(res.cm, 0)) + ' / ' + esc(n(P.Pw - res.cm, 0)), 'mỗi từ ' + P.wb + ' byte · ' + esc(n(res.units, 0)) + ' byte dữ liệu')
          : stat('Byte dữ liệu / chèn', esc(n(res.units, 0)) + ' / ' + esc(n(P.cap - res.units, 0)), 'trên ' + esc(n(P.cap, 0)) + ' byte tải')) +
        stat('Cm trung bình', esc(n(S.k ? S.cumSent / S.k : 0, 3)), 'client đến ' + esc(n(S.cumArr / Math.max(1, S.k), 3)) + ' từ / ' + (P.mf > 1 ? 'đa khung' : 'khung')) +
        stat('Lệch so với danh định', (dev > 0 ? '+' : '') + esc(n(dev, 2)) + ' từ', 'tích luỹ ' + S.k + (P.mf > 1 ? ' đa khung' : ' khung') + ' (luôn < 1)') +
        stat('Bộ đệm (phần lẻ)', esc(n(res.buffer, 3)) + ' từ', 'ΣCnD mang phần lẻ (bit) cho đồng hồ');
    } else if (m === 'GFP-F') {
      h += stat('Khung Ethernet / khung server', esc(n(res.frames, 0)), 'đến ' + esc(n(res.arrived, 0)) + ' · tổng ' + esc(n(S.carried, 0))) +
        stat('Byte MAC trong khung', esc(n(res.units, 0)), esc(n(res.units / P.cap * 100, 1)) + '% vùng tải') +
        stat('GFP Idle', esc(n(res.idle, 0)) + ' B', esc(n(res.idlePct, 1)) + '% vùng tải') +
        stat('Hàng đợi', esc(n(res.queueBytes, 0)) + ' B', esc(res.queueFrames) + ' khung chờ') +
        stat('Rớt (đệm đầy)', esc(n(res.drops, 0)), res.drops ? '<span class="vcg-bad">tải vượt dung lượng</span>' : 'không');
    } else if (m === 'IMP') {
      h += stat('Khối 66B / khung', esc(n(res.blocks, 0)), esc(n(P.blocksExact, 3)) + ' trung bình') +
        stat('Khối dữ liệu', esc(n(res.data, 0)), 'không bao giờ bị xoá') +
        stat('Idle chèn / xoá', esc(res.ins) + ' / ' + esc(res.del), 'tổng ' + esc(S.ins) + ' / ' + esc(S.del)) +
        stat('Bộ đệm', esc(n(res.buffer, 0)) + ' khối', 'mục tiêu ' + S.target);
    }
    $('#view-sim [data-sim="stats"]').innerHTML = h;
    $('#view-sim [data-sim="frameno"]').textContent = (P.mf > 1 ? 'đa khung #' : 'khung #') + S.k + (sv.P.periodUs ? ' · chu kỳ ' + n(sv.P.periodUs, 3) + ' µs' : '');
    $('#view-sim [data-sim="gridcap"]').textContent = n(P.method === 'IMP' ? P.blocksExact : P.cap, P.method === 'IMP' ? 2 : 0) + ' ' + u + ' tải mỗi khung';
  }

  /** Ô OH (JC, NJO, Cm…) — vài phần tử DOM bên trái lưới. */
  function renderOh(res) {
    var P = sv.P, m = P.method, h = '';
    if (res.opp) {
      var bits = String(res.jc || ''), jn = P.just.jc ? listOf(P.just.jc.rows, P.rows).length : 0;
      h += '<div class="sim-ohbox sim-t-jc" title="' + esc(P.just.jc ? jcPlace(P.just.jc) : 'Justification Control') + '"><span>' + (m === 'PDH-BIT' ? 'Cj' : 'JC') + '</span><b>' + esc(bits || '–') + '</b><small>' + (jn ? '×' + jn + ' (đa số)' : '') + '</small></div>';
      res.opp.forEach(function (q) {
        h += '<div class="sim-ohbox ' + (q.data ? 'sim-t-jdata' : 'sim-t-jstuff') + '" title="hàng ' + q.row + ', cột ' + q.col + (q.inGrid ? ' (trong vùng tải)' : ' (cột OH)') + '"><span>' + esc(q.key.toUpperCase()) + '</span><b>' + (q.data ? 'dữ liệu' : 'chèn') + '</b><small>h' + q.row + ' c' + q.col + '</small></div>';
      });
    } else if (m === 'GMP') {
      var bin = res.cm.toString(2); while (bin.length < P.cnBits) bin = '0' + bin;
      h += '<div class="sim-ohbox sim-t-jc" title="Cm ' + P.cnBits + ' bit trong JC1–JC2 (áp dụng cho ' + esc((P.sc.gmp && P.sc.gmp.appliesTo) || 'khung kế tiếp') + ')"><span>Cm</span><b>' + esc(n(res.cm, 0)) + '</b><small><code>' + esc(bin) + '</code></small></div>';
    } else if (m === 'GFP-F') {
      h += '<div class="sim-ohbox sim-t-gfph"><span>GFP</span><b>' + esc(res.frames) + ' khung</b><small>' + esc(n(res.idlePct, 0)) + '% Idle</small></div>';
    } else if (m === 'IMP') {
      h += '<div class="sim-ohbox sim-t-bins"><span>Idle</span><b>+' + res.ins + ' / −' + res.del + '</b><small>chèn / xoá</small></div>';
    }
    P.ohOut.forEach(function (o) { h += '<div class="sim-ohbox sim-t-oh" title="' + esc(o.note) + '"><span>' + esc(o.abbr) + '</span><small>' + esc(o.where || '') + '</small></div>'; });
    $('#view-sim [data-sim="oh"]').innerHTML = h;
  }

  function renderLegend(cells) {
    var c = countTypes(cells), u = unitName(sv.P);
    $('#view-sim [data-sim="legend"]').innerHTML = TYPE_INFO.map(function (t, i) {
      if (!c[i] && !legendAlways(i)) return '';
      return '<li><span class="swatch sim-sw" style="background:' + esc(sv.colors[i]) + '"></span> ' + esc(t.name) + ': <b>' + esc(n(c[i], 0)) + '</b> ' + u + '</li>';
    }).join('');
  }
  function legendAlways(i) {
    var m = sv.P.method;
    if (m === 'AMP' || m === 'BMP' || m === 'PDH-BIT') return i === T.DATA || i === T.JDATA || i === T.JSTUFF;
    if (m === 'GMP') return i === T.DATA || i === T.GSTUFF;
    if (m === 'GFP-F') return i === T.DATA || i === T.GFPH || i === T.GIDLE;
    if (m === 'IMP') return i === T.BDATA || i === T.BIDLE || i === T.BINS;
    return false;
  }

  function paint() {
    if (!sv.last || !sv.active) return;
    drawGrid(sv.last.cells); drawZoom(sv.last.cells); drawHist();
    renderStats(sv.last); renderOh(sv.last); renderLegend(sv.last.cells);
  }

  function tick() {
    if (!sv.active || !sv.S) return;
    sv.last = step(sv.S, params());
    if (root.requestAnimationFrame) root.requestAnimationFrame(paint); else paint();
  }

  function setRunning(on) {
    if (sv.timer) { clearInterval(sv.timer); sv.timer = null; }
    if (on && sv.active) sv.timer = setInterval(tick, 1000 / sv.st.fps);
    var b = $('#view-sim [data-sact="run"]');
    if (b) { b.textContent = on ? '⏸ Dừng' : '▶ Chạy'; b.setAttribute('aria-pressed', String(!!on)); b.classList.toggle('is-on', !!on); }
  }

  function reset() {
    sv.S = create(sv.P, 12345);
    sv.last = step(sv.S, params());
    paint();
  }

  // ---------- sự kiện ----------
  function onClick(e) {
    if (!sv.active) return;
    var b = e.target.closest && e.target.closest('[data-sact]');
    if (b) {
      var a = b.getAttribute('data-sact');
      if (a === 'run') setRunning(!sv.timer);
      else if (a === 'step') { setRunning(false); tick(); }
      else if (a === 'reset') { reset(); }
      return;
    }
    var cv = e.target.closest && e.target.closest('[data-sim="grid"]');
    if (cv && sv.last) {
      // bấm lên lưới → đặt kính lúp tại đó
      var rc = cv.getBoundingClientRect(), d = gridDims();
      var r = Math.min(d.rows - 1, Math.floor((e.clientY - rc.top) / rc.height * d.rows));
      var c = Math.floor((e.clientX - rc.left) / rc.width * d.cols);
      var len = Math.min(d.cols, 64), total = d.rows * d.cols;
      sv.zoom = Math.max(0, Math.min(1, (r * d.cols + Math.max(0, c - len / 2)) / Math.max(1, total - len)));
      var zi = $('#view-sim [data-sin="zoom"]'); if (zi) zi.value = Math.round(sv.zoom * 1000);
      paint();
    }
  }
  function onInput(e) {
    if (!sv.active) return;
    var el = e.target, k = el.getAttribute && el.getAttribute('data-sin');
    if (!k) return;
    var p = params();
    if (k === 'fps') { sv.st.fps = +el.value; if (sv.timer) setRunning(true); }
    else if (k === 'zoom') { sv.zoom = +el.value / 1000; paint(); return; }
    else if (k === 'size') p.size = el.value === 'mix' ? 'mix' : +el.value;
    else { p[k] = +el.value; var o = $('#view-sim [data-sval="' + k + '"]'); if (o) o.textContent = fmtSigned(k, p[k]); }
    sSet();
    if (!sv.timer) tick(); // đang dừng: chạy một khung để thấy ngay tác dụng
  }

  function defaultZoom(P) {
    // AMP/BMP: đặt kính lúp quanh PJO nếu PJO trong vùng tải; còn lại: đầu vùng tải
    if (P.just) {
      var q = P.just.opp.filter(function (x) { return x.cell >= 0; })[0];
      if (q) { var total = P.rows * P.cols, len = Math.min(P.cols, 64); return Math.max(0, Math.min(1, q.cell / Math.max(1, total - len))); }
    }
    return 0;
  }

  // ---------- vòng đời view ----------
  function init() {
    var v = document.getElementById('view-sim');
    if (!v) throw new Error('Thiếu #view-sim trong index.html');
    v.addEventListener('click', onClick);
    v.addEventListener('input', onInput);
    v.addEventListener('change', onInput);
    var rt = null;
    root.addEventListener('resize', function () { if (!sv.active) return; clearTimeout(rt); rt = setTimeout(paint, 120); });
    if (root.matchMedia) {
      var mq = root.matchMedia('(prefers-color-scheme: dark)');
      var re = function () { if (sv.active) { readColors(); paint(); } };
      if (mq.addEventListener) mq.addEventListener('change', re);
    }
    // đổi giao diện sáng/tối bằng nút → đọc lại màu
    document.addEventListener('click', function (e) { if (sv.active && e.target.closest && e.target.closest('#theme-btn')) setTimeout(function () { readColors(); paint(); }, 0); });
  }
  function show(id) {
    var sc = byId(id) || maps()[0];
    if (!sc) { $('#view-sim').innerHTML = '<p class="muted">Chưa có dữ liệu ánh xạ (data/transport-mapping.js).</p>'; return; }
    setRunning(false);
    sv.active = true;
    sv.st = sv.st || loadSt();
    if (sv.id !== sc.id) { sv.id = sc.id; sv.P = prep(sc); sv.zoom = defaultZoom(sv.P); }
    sv.st.last = sc.id; sSet();
    build();
    reset();
  }
  function hide() { sv.active = false; setRunning(false); }
  function items() {
    return sortedMaps()
      .map(function (x) { return { id: x.id, name: x.name || x.id, method: methodOf(x) === 'PDH-BIT' ? 'PDH' : methodOf(x), hint: x.summary || '' }; });
  }

  root.MapSimView = { init: init, show: show, hide: hide, items: items, _state: sv };
})(typeof window !== 'undefined' ? window : globalThis);
