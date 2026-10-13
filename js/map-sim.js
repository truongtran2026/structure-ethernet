/*
 * map-sim.js — "Mô phỏng ánh xạ" (view #sim/<id>, #sim/compare): xem khung server được lấp bằng đơn vị client theo các cách
 * ánh xạ AMP / BMP / GMP / GFP-F / IMP / chèn bit PDH.
 *  1) Phần thuần (MapSim, xuất cả module.exports để test bằng Node): prep (chuẩn hoá kịch bản TMAPS thành lưới ô),
 *     prepToy (khung "đồ chơi" thu nhỏ, giữ nguyên luật), create + step (mô phỏng từng khung), describe (một dòng nhật ký).
 *  2) Phần giao diện (MapSimView): hai chế độ
 *     - Minh hoạ: băng chuyền client → bộ đệm FIFO có thanh mức → khung nhỏ lấp từng ô theo thứ tự truyền (canvas, rAF);
 *     - Thực tế: lưới vùng tải thật thu nhỏ có tỉ lệ + kính lúp + bộ đếm (như GD10);
 *     và trang so sánh AMP · BMP · GMP chạy song song.
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
    { key: 'oh', name: 'Overhead khung (FAS, PSI, RES…)' },
    { key: 'jc', name: 'Bit/byte điều khiển chèn (JC/Cj/Cm)' },
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
  /** Định dạng số kiểu Việt: dấu cách nghìn, dấu phẩy thập phân, bỏ số 0 thừa. */
  function fmtN(x, d) {
    d = d == null ? 2 : d;
    var neg = x < 0, s = Math.abs(+x || 0).toFixed(d);
    if (d > 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    var parts = s.split('.'), i = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (neg && +s ? '−' : '') + i + (parts[1] ? ',' + parts[1] : '');
  }
  function unitName(P) { return P.method === 'IMP' ? 'khối' : P.unit === 'bit' ? 'bit' : 'byte'; }

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
   *    ohOut: [ô OH ngoài lưới], errors, fifoC (mức bộ đệm gốc), band (độ rộng trễ quanh ngưỡng; thực tế 0) }.
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
      interleave: +fr.interleave || 0, errors: errs, ohOut: [], fifoC: 4, band: 0, ppmScale: 1 };
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
      P.fifoCap = 10;
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
      P.fifoCap = 8 * P.wb;
    }
    if (m === 'GFP-F') {
      var gf = sc.gfp || {};
      P.gfp = { core: +gf.coreHdr || 4, type: +gf.payloadHdr || 4, ext: +gf.extHdr || 0, fcs: +gf.fcs || 0, idle: +gf.idleBytes || 4,
        minEth: +gf.minEth || 64, maxEth: +gf.maxEth || 1518, pre: gf.preambleSfd != null ? +gf.preambleSfd : 8, ifg: gf.ifg != null ? +gf.ifg : 12 };
      P.wirePerFrame = P.periodUs ? ck * P.periodUs / 1000 / 8 : P.cap; // byte Ethernet trên dây (tốc độ đường) mỗi khung server
      P.bufBytes = 256 * 1024;
      P.fifoCap = P.bufBytes;
    }
    if (m === 'IMP') {
      var blk = (sc.imp && +sc.imp.block) || 66;
      P.block = blk;
      if (cellBits === blk) { P.blocksExact = P.cap; P.blockCols = cols; }
      else { P.blocksExact = cellsN * cellBits / blk; P.blockCols = Math.ceil(Math.ceil(P.blocksExact) / dRows); P.rNom = P.rNom * cellBits / blk; }
      P.impTarget = 8;
      P.fifoCap = 24;
    }
    return P;
  }
  function placeText(o) {
    var r = o.rows != null ? [].concat(o.rows).join('–') : o.row, c = o.cols != null ? [].concat(o.cols).join('–') : o.col;
    return (r != null ? 'hàng ' + r : '') + (c != null ? (r != null ? ', ' : '') + 'cột ' + c : '');
  }

  // ---------- khung "đồ chơi" (chế độ Minh hoạ) ----------
  /** Kích thước khung đồ chơi theo phương pháp: [hàng, cột] vùng tải. */
  var TOY_DIM = { 'AMP': [4, 16], 'BMP': [4, 16], 'GMP': [4, 16], 'GFP-F': [4, 24], 'IMP': [5, 8], 'PDH-BIT': [4, 32] };

  /**
   * Khung nhỏ cùng luật: giữ OH/NJO/PJO/JC/FS ở vị trí tương đối, chỉ thu nhỏ số cột (và hàng nếu > 5).
   * Ánh xạ cột: cột OH (trước firstCol) giữ nguyên; nửa đầu vùng tải giữ đúng chỉ số (PJO cột 17, bit chèn PDH cột 5…);
   * phần sau co theo tỉ lệ (FS cột 1905–1920 của 3808 → 1 cột giữa khung nhỏ).
   * Tốc độ client: giữ nguyên LƯỢNG LỆCH MỖI KHUNG như khung thật — ppm nhân ppmScale = (đơn vị thật / đơn vị đồ chơi mỗi khung),
   * nên số lần bù mỗi khung (và tỉ lệ chèn PDH, số Idle xoá mỗi khung IMP) giống khung thật.
   */
  function prepToy(sc) {
    var R = prep(sc), m = R.method, fr = sc.frame || {};
    var dim = TOY_DIM[m] || [4, 16];
    var rows = R.rows <= 5 ? R.rows : dim[0], cols = Math.min(R.cols, dim[1]);
    var col0 = R.col0, step = R.colStep, keep = Math.floor(cols / 2);
    function mc(c) {
      c = +c;
      if (c < col0) return c;
      var d = Math.round((c - col0) / step);
      if (d < keep) return col0 + d;
      return col0 + keep + Math.min(cols - keep - 1, Math.floor((d - keep) * (cols - keep) / Math.max(1, R.cols - keep)));
    }
    function mr(r) { return Math.max(1, Math.min(rows, +r)); }
    function mapList(v, f) {
      if (v == null) return v;
      if (typeof v === 'number') return f(v);
      if (Array.isArray(v)) {
        if (v.length === 2 && typeof v[0] === 'number' && typeof v[1] === 'number' && v[1] >= v[0]) return [f(v[0]), f(v[1])];
        var out = []; v.forEach(function (x) { var y = f(x); if (out.indexOf(y) < 0) out.push(y); }); return out.length === 2 ? [out[0], out[1], out[1]] : out;
      }
      var l = listOf(v, 9999), o2 = []; l.forEach(function (x) { var y = f(x); if (o2.indexOf(y) < 0) o2.push(y); }); return o2;
    }
    function mapPos(o) {
      if (!o) return o;
      var c = Object.assign({}, o);
      if (o.rows != null) c.rows = mapList(o.rows, mr); if (o.row != null) c.row = mr(o.row);
      if (o.cols != null) c.cols = mapList(o.cols, mc); if (o.col != null) c.col = mc(o.col);
      return c;
    }
    var d = Object.assign({}, sc, {
      frame: Object.assign({}, fr, { rows: rows, cols: cols, firstCol: col0, colStep: 1, multiframe: 1, interleave: 0 }),
      oh: (sc.oh || []).map(mapPos), fixedStuff: (sc.fixedStuff || []).map(mapPos),
      sim: Object.assign({}, sc.sim || {}, { perFrame: null, carry: null })
    });
    if (sc.just) d.just = Object.assign({}, sc.just, { njo: mapPos(sc.just.njo), pjo: mapPos(sc.just.pjo), jc: mapPos(sc.just.jc) });
    if (m === 'GMP') d.gmp = Object.assign({}, sc.gmp || {}, { M: Math.min(R.wb, 4), m: Math.min(R.wb, 4) * 8, P: null, cmNom: null });
    var P = prep(d), F = 1;
    P.band = 1;
    if (isJust(m)) {
      F = R.n0 / P.n0;
      P.rNom = P.locked ? P.n0 : P.n0 + (R.rNom - R.n0);
    } else if (m === 'GMP') {
      P.cmNom = R.cmNom * P.Pw / R.Pw; P.rNom = P.cmNom;
      // phóng đại theo tỉ lệ kích thước, nhưng giới hạn để biên ppm chỉ ăn ≤ 60 % khoảng trống P − cm (Cm không bao giờ vượt P)
      var tol = (((sc.ppm && +sc.ppm.client) || 0) + ((sc.ppm && +sc.ppm.server) || 0)) * 1e-6 * P.cmNom;
      var Fmax = tol > 0 ? 0.6 * (P.Pw - P.cmNom) / tol : Infinity;
      F = Math.max(1, Math.min(R.Pw / P.Pw, Fmax));
      P.toyFcap = F < R.Pw / P.Pw - 1e-9;
      var a = ((sc.ppm && +sc.ppm.client) || 0) * F * 1e-6, b = ((sc.ppm && +sc.ppm.server) || 0) * F * 1e-6;
      d.gmp.cmNom = P.cmNom; d.gmp.cmMin = P.cmNom * (1 - a) / (1 + b); d.gmp.cmMax = P.cmNom * (1 + a) / (1 - b);
      d.gmp.CmMin = Math.floor(d.gmp.cmMin); d.gmp.CmMax = Math.min(P.Pw, Math.ceil(d.gmp.cmMax));
    } else if (m === 'GFP-F') {
      F = R.cap / P.cap;
      P.wirePerFrame = R.wirePerFrame * P.cap / R.cap;
      P.bufBytes = 3 * P.cap; P.fifoCap = P.bufBytes;
    } else if (m === 'IMP') {
      F = R.blocksExact / P.cap;
      P.blocksExact = P.cap; P.blockCols = cols;
      P.rNom = P.cap + (R.rNom - R.blocksExact);
      P.impTarget = 4; P.fifoCap = 12;
    }
    P.ppmScale = F;
    P.toy = { F: F, real: R, realRows: R.dRows, realCols: R.cols, realCap: R.cap, rows: rows, cols: cols };
    P.errors = P.errors.filter(function (e) { return !/ngoài vùng GMP/.test(e); });
    return P;
  }

  // ---------- mô phỏng ----------
  /** Trạng thái mô phỏng mới. */
  function create(P, seed) {
    var S = { P: P, k: 0, acc: 0.5, cumSent: 0, cumArr: 0, cumNom: 0, plus: 0, minus: 0, hist: [], rnd: rng(seed || 12345), over: 0, sentU: 0, arrU: 0, nextArr: null };
    if (P.method === 'GMP') { S.acc = 0; S.prevCm = null; }
    if (P.method === 'GFP-F') { S.q = []; S.cur = null; S.budget = 0; S.nextL = 0; S.qBytes = 0; S.drops = 0; S.carried = 0; S.ethBytes = 0; S.parity = 0; S.idleBytes = 0; S.totBytes = 0; S.fid = 0; }
    if (P.method === 'IMP') {
      S.capAcc = 0; S.cliAcc = 0; S.q = []; S.target = P.impTarget || 8;
      for (var i = 0; i < S.target; i++) S.q.push({ t: T.BIDLE, pk: -1, del: false });
      S.ins = 0; S.del = 0; S.pkLeft = 0; S.gapLeft = 2; S.pkLen = 10; S.pkId = 0;
    }
    return S;
  }

  /** Tỉ lệ tốc độ client/server theo độ lệch ppm (nhân ppmScale của khung đồ chơi). */
  function ppmRatio(o, P) {
    var k = (P && P.ppmScale) || 1;
    return (1 + (+o.ppmC || 0) * k * 1e-6) / (1 + (+o.ppmS || 0) * k * 1e-6);
  }

  /**
   * Chạy một khung server (đa khung với GMP theo đa khung). o = { ppmC, ppmS, load (0–150 %), size (byte | 'mix') }.
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
   * AMP / BMP / chèn bit PDH: số đơn vị client đến trong khung r = rNom × tỉ lệ ppm (BMP: server bám client → r = danh định).
   * Bộ đệm: phần dư so với danh định phải nằm trong [−band, 1 + band); ra ngoài thì chọn mục JC bù (ưu tiên mục bình thường).
   * Thực tế band = 0 (bù ngay khi lệch 1 đơn vị); đồ chơi band = 1 để thấy bộ đệm trôi dần tới ngưỡng.
   */
  function stepJust(S, o) {
    var P = S.P, J = P.just, band = P.band || 0, C = P.fifoC || 4;
    var r = P.locked ? P.n0 : P.rNom * ppmRatio(o, P);
    var acc0 = S.acc, s0 = S.sentU, a0 = S.arrU;
    var avail = S.acc + r;
    var cands = J.usable.length ? J.usable.slice() : [{ jc: '', count: J.normal ? J.normal.count : 0, data: {} }];
    if (J.normal) cands.sort(function (a, b) { return (a === J.normal ? -1 : 0) - (b === J.normal ? -1 : 0); });
    var lo = -band, hi = 1 + band, pick = null, best = Infinity;
    cands.forEach(function (e) {
      var rest = avail - (P.fixedData + e.count);
      var dist = rest < lo ? lo - rest : rest >= hi ? rest - hi + 1e-9 : 0;
      if (dist < best - 1e-12) { best = dist; pick = e; }
    });
    var sent = P.fixedData + pick.count;
    S.acc = avail - sent;
    S.cumSent += sent; S.cumArr += r; S.cumNom += P.n0;
    S.sentU = s0 + sent; S.arrU = a0 + r;
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
    return { cells: cells, units: sent, nominal: P.n0, delta: delta, jc: pick.jc, entry: pick, opp: opp, buffer: S.acc, rate: r, outOfRange: best > 0, hist: delta,
      level: C + avail - P.n0, lo: C + lo, hi: C + hi, lvl0: C + acc0, lvl1: C + S.acc, s0: s0, a0: a0, a1: a0 + r };
  }

  /** GMP: Cm = ⌊bộ đệm⌋ (đơn vị từ M byte); từ j (1…P) mang dữ liệu nếu (j × Cm) mod P < Cm — rải đều kiểu sigma-delta. */
  function stepGmp(S, o) {
    var P = S.P, r = P.cmNom * ppmRatio(o, P), C = P.fifoC || 4, wb = P.wb;
    var acc0 = S.acc, s0 = S.sentU, a0 = S.arrU;
    var avail = S.acc + r;
    var Cm = Math.max(0, Math.min(P.Pw, Math.floor(avail + 1e-9)));
    S.acc = avail - Cm;
    S.cumSent += Cm; S.cumArr += r; S.cumNom += P.cmNom;
    S.sentU = s0 + Cm * wb; S.arrU = a0 + r * wb;
    var cells = new Uint8Array(P.base), Pw = P.Pw;
    for (var j = 1; j <= Pw; j++) {
      var isData = (j * Cm) % Pw < Cm;
      for (var b = 0; b < wb; b++) { var idx = P.order[(j - 1) * wb + b]; if (idx != null) cells[idx] = isData ? T.DATA : T.GSTUFF; }
    }
    for (var i = Pw * wb; i < P.order.length; i++) cells[P.order[i]] = T.GSTUFF;
    var change = S.prevCm == null ? 0 : Cm - S.prevCm;
    S.prevCm = Cm;
    return { cells: cells, units: Cm * wb, cm: Cm, cmNom: P.cmNom, cmRate: r, change: change, buffer: S.acc, nominal: P.cmNom * wb, hist: Cm - Math.round(P.cmNom),
      avail: avail, lvl0: (C + acc0) * wb, lvl1: (C + S.acc) * wb, s0: s0, a0: a0, a1: a0 + r * wb };
  }

  /** Cỡ khung Ethernet tiếp theo: số cố định hoặc 'mix' (IMIX 7:4:1 = 64/594/1518, kẹp theo minEth/maxEth). */
  function drawSize(S, o, g) {
    var sz = o.size;
    if (sz === 'mix' || sz == null) { var x = S.rnd() * 12; sz = x < 7 ? 64 : x < 11 ? 594 : 1518; }
    return Math.max(g.minEth, Math.min(g.maxEth, Math.round(+sz)));
  }

  /**
   * Khung Ethernet đến trong MỘT chu kỳ khung server: ngân sách byte trên dây = tải × tốc độ đường × chu kỳ (dao động ±15 %);
   * mỗi khung tốn L + preamble/SFD + IFG; thời điểm đến t ∈ [0, 1] = lúc byte cuối của khung tới (store-and-forward).
   */
  function genGfpArr(S, o, P) {
    var g = P.gfp, load = Math.max(0, Math.min(150, +o.load || 0)) / 100;
    if (!load) { S.budget = 0; return []; }
    // dao động ±15 % theo cặp đối xứng (u, 1 − u) để trung bình đúng bằng tải đặt
    var uj = S.ju != null ? 1 - S.ju : S.rnd(); S.ju = S.ju != null ? null : uj;
    var B0 = S.budget, add = load * P.wirePerFrame * ppmRatio(o, P) * (0.85 + 0.3 * uj);
    var used = 0, arr = [], hdr = g.core + g.type + g.ext + g.fcs;
    if (!S.nextL) S.nextL = drawSize(S, o, g);
    while (B0 + add - used >= S.nextL + g.pre + g.ifg) {
      used += S.nextL + g.pre + g.ifg;
      arr.push({ L: S.nextL, len: S.nextL + hdr, fid: ++S.fid, t: Math.max(0, Math.min(1, (used - B0) / add)), drop: false });
      S.nextL = drawSize(S, o, g);
    }
    S.budget = B0 + add - used;
    return arr;
  }

  /**
   * GFP-F: khung Ethernet đến theo thời gian trong chu kỳ, bỏ preamble/IFG, thêm header; lấp vùng tải theo thứ tự truyền;
   * hàng đợi rỗng thì GFP Idle 4 byte. Đến lúc bộ đệm đầy → rớt khung. Khung đến của chu kỳ sau tính trước (nextArr) để vẽ băng chuyền.
   */
  function stepGfp(S, o) {
    var P = S.P, g = P.gfp, bufMax = o.bufBytes || P.bufBytes || 256 * 1024;
    var arr = S.nextArr || genGfpArr(S, o, P);
    S.nextArr = genGfpArr(S, o, P);
    var q0 = S.qBytes + (S.cur && !S.cur.idle ? S.cur.len - S.cur.pos : 0);
    var N = P.order.length, cells = new Uint8Array(P.base), fids = new Int32Array(cells.length);
    fids.fill(-1);
    var carried = 0, eth = 0, idle = 0, hdrB = g.core + g.type + g.ext, ai = 0, arrived = 0, dropN = 0;
    function admit(a) {
      if (S.qBytes + a.len > bufMax) { a.drop = true; S.drops++; dropN++; }
      else { S.q.push(a); S.qBytes += a.len; arrived++; }
    }
    for (var i = 0; i < N; i++) {
      while (ai < arr.length && arr[ai].t * N <= i) admit(arr[ai++]);
      if (!S.cur) {
        if (S.q.length) { var a = S.q.shift(); S.qBytes -= a.len; S.cur = { L: a.L, pos: 0, len: a.len, idle: false, fid: a.fid, par: (S.parity = 1 - S.parity) }; }
        else S.cur = { pos: 0, len: g.idle, idle: true, fid: -1 };
      }
      var c = S.cur, t;
      if (c.idle) { t = T.GIDLE; idle++; }
      else if (c.pos < hdrB || c.pos >= hdrB + c.L) t = T.GFPH;
      else { t = c.par ? T.DATA : T.DATA2; eth++; }
      cells[P.order[i]] = t;
      fids[P.order[i]] = c.fid;
      if (++c.pos >= c.len) { if (!c.idle) carried++; S.cur = null; }
    }
    while (ai < arr.length) admit(arr[ai++]);
    S.carried += carried; S.ethBytes += eth; S.idleBytes += idle; S.totBytes += N;
    S.cumSent += eth;
    var q1 = S.qBytes + (S.cur && !S.cur.idle ? S.cur.len - S.cur.pos : 0);
    var qList = (S.cur && !S.cur.idle ? [{ fid: S.cur.fid, len: S.cur.len - S.cur.pos }] : []).concat(S.q.slice(0, 24).map(function (x) { return { fid: x.fid, len: x.len }; }));
    return { cells: cells, fids: fids, units: eth, frames: carried, arrived: arrived, dropped: dropN, idle: idle, idlePct: idle / N * 100,
      queueBytes: q1, queueFrames: S.q.length, drops: S.drops, q0: q0, q1: q1, qList: qList, arr: arr, nextArr: S.nextArr, bufMax: bufMax,
      hist: Math.round(eth / N * 100) };
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
    S.pkId++;
    if (!S.pkLeft) S.gapLeft = gapBlocks(S, o);
    return T.BDATA;
  }
  function gapBlocks(S, o) {
    var load = Math.max(0.001, Math.min(100, +o.load || 0) / 100);
    var g = S.pkLen * (1 - load) / load; // khoảng trống trung bình để đạt tải
    return Math.max(1, Math.round(g * (0.5 + S.rnd())));
  }
  /** Khối client đến trong một chu kỳ: ⌊rNom × ppm⌋ (tích luỹ phần lẻ), rải đều theo thời gian. */
  function genImpArr(S, o, P) {
    S.cliAcc += P.rNom * ppmRatio(o, P);
    var n = Math.floor(S.cliAcc + 1e-9), arr = [];
    S.cliAcc -= n;
    for (var i = 0; i < n; i++) { var t = nextClientBlock(S, o); arr.push({ t: t, pk: t === T.BDATA ? S.pkId : -1, at: (i + 0.5) / n, del: false }); }
    return arr;
  }

  /**
   * IMP: mỗi khung có cap vị trí khối; client đưa vào các khối đến trong chu kỳ.
   * Bộ đệm vượt mục tiêu → XOÁ khối Idle của client (không bao giờ xoá khối của gói); thiếu → CHÈN khối Idle trước một gói mới.
   */
  function stepImp(S, o) {
    var P = S.P;
    var arr = S.nextArr || genImpArr(S, o, P);
    S.nextArr = genImpArr(S, o, P);
    S.capAcc += P.blocksExact; var cap = Math.floor(S.capAcc + 1e-9); S.capAcc -= cap;
    var buf0 = S.q.length;
    for (var a = 0; a < arr.length; a++) S.q.push(arr[a]);
    S.cumArr += arr.length;
    var out = [], ins = 0, del = 0;
    var excess = S.q.length - cap - S.target;
    for (var d = S.q.length - 1; excess > 0 && d >= 0; d--) {
      if (S.q[d].t === T.BIDLE) { S.q[d].del = true; S.q.splice(d, 1); excess--; del++; }
    }
    while (out.length < cap) {
      // thiếu khối: chỉ chèn ở ranh giới gói (khối kế là Idle hoặc đầu gói) — không cắt giữa gói
      if (!S.q.length || (S.q.length < S.target && S.q[0].t !== T.BDATA)) { out.push({ t: T.BINS, pk: -1 }); ins++; continue; }
      out.push(S.q.shift());
    }
    S.ins += ins; S.del += del;
    var cells = new Uint8Array(P.base), pks = new Int32Array(cells.length);
    pks.fill(-1);
    var nOut = Math.min(out.length, P.order.length);
    for (var k = 0; k < nOut; k++) { cells[P.order[k]] = out[k].t; pks[P.order[k]] = out[k].pk; }
    var dataBlocks = 0; for (k = 0; k < out.length; k++) if (out[k].t === T.BDATA) dataBlocks++;
    S.cumSent += cap - ins;
    return { cells: cells, pks: pks, units: cap - ins, blocks: cap, data: dataBlocks, ins: ins, del: del, buffer: S.q.length, buf0: buf0,
      arrived: arr.length, arr: arr, nextArr: S.nextArr, qSnap: S.q.slice(0, 40).map(function (x) { return { t: x.t, pk: x.pk }; }), hist: ins - del };
  }

  /** Bảng đếm loại ô trong một khung. */
  function countTypes(cells) {
    var c = []; for (var t = 0; t < TYPE_INFO.length; t++) c.push(0);
    for (var i = 0; i < cells.length; i++) c[cells[i]]++;
    return c;
  }

  /** Số vị trí dữ liệu theo công thức sigma-delta (kiểm: đúng bằng Cm). */
  function gmpDataCount(Cm, Pw) { var n = 0; for (var j = 1; j <= Pw; j++) if ((j * Cm) % Pw < Cm) n++; return n; }
  /** Vị trí từ chèn (1-based) theo sigma-delta. */
  function gmpStuffPositions(Cm, Pw, max) { var out = []; for (var j = 1; j <= Pw && out.length < (max || Pw); j++) if ((j * Cm) % Pw >= Cm) out.push(j); return out; }

  /** Cm min/max trong dải dung sai ppm: lấy từ dữ liệu (CmMin/CmMax) hoặc tính (client ±a, server ±b). */
  function gmpRange(P) {
    var g = P.sc.gmp || {};
    if (g.CmMin != null && g.CmMax != null) return { min: +g.CmMin, max: +g.CmMax };
    var a = ((P.sc.ppm && +P.sc.ppm.client) || 0) * 1e-6, b = ((P.sc.ppm && +P.sc.ppm.server) || 0) * 1e-6;
    return { min: Math.floor(P.cmNom * (1 - a) / (1 + b)), max: Math.ceil(P.cmNom * (1 + a) / (1 - b)) };
  }

  /** II/DI theo mức đổi Cm (Bảng D.2) — từ dữ liệu gmp.iiDi. */
  function iiDiOf(P, change) {
    var key = change === 0 ? '0' : change === 1 ? '+1' : change === -1 ? '−1' : change === 2 ? '+2' : change === -2 ? '−2' : '> ±2';
    return ((P.sc.gmp && P.sc.gmp.iiDi) || []).filter(function (x) { return String(x.change) === key; })[0] || null;
  }

  /** Một dòng nhật ký tiếng Việt cho khung vừa chạy. */
  function describe(P, res) {
    var m = P.method, u = unitName(P), f = (P.mf > 1 ? 'Đa khung ' : 'Khung ') + res.k + ': ';
    if (isJust(m)) {
      var jn = m === 'PDH-BIT' ? 'Cj' : 'JC';
      var opp = res.opp.map(function (q) { return q.key.toUpperCase() + (q.data ? ' mang dữ liệu' : ' là chèn'); }).join(', ');
      if (P.locked) return f + 'đồng hồ server lấy từ client → đến đúng ' + fmtN(res.units, 0) + ' ' + u + ', bộ đệm đứng yên → ' + jn + ' = ' + res.jc + ' (' + opp + ').';
      if (res.delta > 0) return f + 'bộ đệm ' + fmtN(res.level, 1) + '/' + fmtN(res.hi, 0) + ' ' + u + ' vượt ngưỡng trên → ' + jn + ' = ' + res.jc + ', ' + opp + ' (+' + res.delta + ' ' + u + ').';
      if (res.delta < 0) return f + 'bộ đệm ' + fmtN(res.level, 1) + ' ' + u + ' dưới ngưỡng dưới ' + fmtN(res.lo, 0) + ' → ' + jn + ' = ' + res.jc + ', ' + opp + ' (−' + (-res.delta) + ' ' + u + ').';
      return f + 'bộ đệm ' + fmtN(res.level, 1) + ' ' + u + ' trong ngưỡng [' + fmtN(res.lo, 0) + ', ' + fmtN(res.hi, 0) + ') → ' + jn + ' = ' + res.jc + ', ' + opp + '.';
    }
    if (m === 'GMP') {
      var st = gmpStuffPositions(res.cm, P.Pw, 4), nSt = P.Pw - res.cm, w = P.wb > 1 ? 'từ' : 'byte';
      var ch = res.change ? ' (' + (res.change > 0 ? '+' : '−') + Math.abs(res.change) + (iiDiOf(P, res.change) ? ', II = ' + iiDiOf(P, res.change).ii + ' DI = ' + iiDiOf(P, res.change).di : '') + ')' : ' (giữ nguyên)';
      return f + 'chờ ' + fmtN(res.avail, 2) + ' ' + w + ' → Cm = ' + fmtN(res.cm, 0) + ch + '; ' + fmtN(nSt, 0) + ' ' + w + ' chèn' +
        (nSt ? ' ở ' + w + ' ' + st.join(', ') + (nSt > st.length ? ', …' : '') : '') + '.';
    }
    if (m === 'GFP-F') {
      var ok = res.arr.filter(function (a) { return !a.drop; }), dr = res.arr.filter(function (a) { return a.drop; });
      var list = ok.slice(0, 3).map(function (a) { return '#' + a.fid + ' ' + a.L + ' B'; }).join(', ') + (ok.length > 3 ? ', …' : '');
      return f + (res.arr.length ? 'đến ' + res.arr.length + ' khung Ethernet' + (ok.length ? ' (' + list + ')' : '') : 'không có khung Ethernet đến') +
        '; vùng tải: ' + fmtN(P.cap - res.idle, 0) + ' B khung GFP + ' + fmtN(res.idle, 0) + ' B Idle; hàng đợi ' + fmtN(res.q1, 0) + ' B' +
        (dr.length ? '; RỚT ' + dr.length + ' khung (' + dr.slice(0, 3).map(function (a) { return '#' + a.fid; }).join(', ') + ') vì bộ đệm đầy' : '') + '.';
    }
    if (m === 'IMP') {
      var dataIn = res.arr.filter(function (a) { return a.t === T.BDATA; }).length;
      var act = res.del ? 'XOÁ ' + res.del + ' khối Idle của client (bộ đệm vượt mục tiêu ' + P.impTarget + ')' :
        res.ins ? 'CHÈN ' + res.ins + ' khối Idle (bộ đệm thiếu, chèn ở ranh giới gói)' : 'không chèn/xoá';
      return f + 'đến ' + res.arr.length + ' khối (' + dataIn + ' của gói), khung có ' + res.blocks + ' chỗ → ' + act + '; bộ đệm ' + res.buffer + ' khối.';
    }
    return f + 'xong.';
  }
  /** Lớp màu cho dòng nhật ký: up = thêm dữ liệu / xoá Idle, down = chèn, bad = rớt. */
  function logKind(P, res) {
    var m = P.method;
    if (isJust(m)) return res.delta > 0 ? 'up' : res.delta < 0 ? 'down' : '';
    if (m === 'GMP') return res.change > 0 ? 'up' : res.change < 0 ? 'down' : '';
    if (m === 'GFP-F') return res.dropped ? 'bad' : '';
    if (m === 'IMP') return res.del ? 'up' : res.ins ? 'down' : '';
    return '';
  }

  var api = { T: T, TYPE_INFO: TYPE_INFO, rng: rng, listOf: listOf, prep: prep, prepToy: prepToy, create: create, step: step, countTypes: countTypes,
    gmpDataCount: gmpDataCount, gmpStuffPositions: gmpStuffPositions, gmpRange: gmpRange, ppmRatio: ppmRatio, methodOf: methodOf,
    describe: describe, logKind: logKind, fmtN: fmtN, unitName: unitName };
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
  /** "Nhìn vào đâu" — một câu theo phương pháp (chế độ Minh hoạ). */
  var METHOD_LOOK = {
    'AMP': 'Kéo "lệch clock client" sang +: bộ đệm đầy dần, chạm ngưỡng trên thì JC = 01 và ô NJO (cột OH) chở thêm 1 byte; kéo sang −: bộ đệm vơi, JC = 11 và PJO thành byte chèn (cam).',
    'BMP': 'Kéo ppm thoải mái: đồng hồ server được suy ra từ client nên mỗi khung đến đúng số byte — thanh bộ đệm đứng yên, JC luôn 00, NJO luôn chèn.',
    'GMP': 'Xem Cm (ô JC) đổi theo từng khung và các ô chèn hồng nhảy chỗ nhưng luôn rải đều; dòng dưới khung tính sigma-delta cho ô đang được lấp.',
    'GFP-F': 'Mỗi khung Ethernet là một khối màu có viền (ô tím đầu khối = header GFP 8 byte), ô xám = GFP Idle. Tăng tải → ít Idle; quá 100 % → bộ đệm đầy và khung bị rớt (đỏ).',
    'IMP': 'Khối 66B lấp theo thứ tự lịch (từng cột). Bộ đệm vượt mục tiêu → một khối Idle của client bị xoá (gạch đỏ trên băng chuyền); thiếu → chèn khối Idle (cam).',
    'PDH-BIT': 'Mỗi ô là 1 bit; 4 nhánh E1 xen bit (số 2/3/4 là bit nhánh khác). Theo dõi nhánh 1: Cj = 111 thì bit cơ hội chèn (hàng 4, cột 5) là bit chèn, Cj = 000 thì mang dữ liệu.'
  };
  var DURS = [[3000, 'Chậm (3 s/khung)'], [1500, 'Vừa (1,5 s/khung)'], [600, 'Nhanh (0,6 s/khung)'], [200, 'Rất nhanh (0,2 s/khung)']];
  var FILL_PART = 0.85;   // phần chu kỳ hoạt ảnh dùng để lấp ô; phần còn lại giữ khung đầy cho mắt kịp nhìn

  var sv = { active: false, id: null, page: 'one', mode: 'toy', sc: null, P: null, S: null, realP: null, last: null, lanes: [], timer: null, raf: 0,
    running: false, anim: { p: 1, t0: 0, playing: false }, st: null, colors: null, zoom: 0, sdKey: '', realLog: [] };

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
  function n(x, d) { return TV() ? TV().fmtNum(x, d == null ? 2 : d) : fmtN(x, d); }
  function rate(k) { return TV() ? TV().fmtRate(k) : n(k) + ' kbit/s'; }
  function sGet() { try { var v = localStorage.getItem(STORE_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function sSet() { try { localStorage.setItem(STORE_KEY, JSON.stringify(sv.st)); } catch (e) { /* bỏ qua */ } }
  function nameOfUnit(id) {
    var M = root.TMUX || {};
    if (M[id] && TV() && TV().lab) return TV().lab.nameOf(M, id);
    return M[id] ? M[id].name : id;
  }
  function now() { return root.performance && performance.now ? performance.now() : Date.now(); }
  function reducedMotion() { try { return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }

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

  /**
   * Bộ ba so sánh: AMP đầu tiên, BMP cùng client/server (nếu có), GMP từ 1 byte có tỉ lệ Cm/P gần 1 nhất mà khung đồ chơi
   * vẫn còn chỗ cho lệch ppm của làn so sánh (±45 ppm × phóng đại < khoảng trống P − cm).
   */
  var cmpCache = null;
  function compareSet() {
    if (cmpCache && cmpCache.src === root.TMAPS) return cmpCache.set;
    var L = sortedMaps(), amp = L.filter(function (x) { return methodOf(x) === 'AMP'; })[0], set = null;
    var gm = L.filter(function (x) { return methodOf(x) === 'GMP' && x.gmp && x.gmp.P; });
    if (amp && gm.length) {
      var bmps = L.filter(function (x) { return methodOf(x) === 'BMP'; });
      var bmp = bmps.filter(function (x) { return x.client === amp.client && x.server === amp.server; })[0] || bmps[0] || null;
      var fit = gm.map(function (x) { var P = prepToy(x); return { sc: x, P: P, room: P.Pw - P.cmNom * (1 + 45e-6 * P.ppmScale) }; })
        .filter(function (o) { return o.room > 0.5 && (+o.sc.gmp.M || 1) === 1; });
      var pool = fit.length ? fit : gm.map(function (x) { return { sc: x, P: prepToy(x) }; });
      pool.sort(function (a, b) { return Math.abs(a.P.cmNom / a.P.Pw - 1) - Math.abs(b.P.cmNom / b.P.Pw - 1); });
      set = [amp, bmp, pool[0].sc].filter(Boolean);
    }
    cmpCache = { src: root.TMAPS, set: set };
    return set;
  }

  // ---------- trạng thái người dùng ----------
  function loadSt() {
    var s = sGet() || {};
    if (typeof s !== 'object') s = {};
    s.per = s.per && typeof s.per === 'object' ? s.per : {};
    s.fps = [1, 3, 8, 20].indexOf(+s.fps) >= 0 ? +s.fps : 3;
    s.dur = DURS.map(function (d) { return d[0]; }).indexOf(+s.dur) >= 0 ? +s.dur : 1500;
    s.mode = s.mode === 'real' ? 'real' : 'toy';
    s.cmpPpm = +s.cmpPpm || 20;
    return s;
  }
  /** Tham số người dùng của kịch bản (tách theo chế độ: Minh hoạ có mặc định lệch ppm để thấy bù ngay). */
  function params() {
    var toy = sv.mode === 'toy', key = sv.id + (toy ? '|toy' : '');
    var fresh = !sv.st.per[key], p = sv.st.per[key] || (sv.st.per[key] = {});
    var sc = sv.sc, m = methodOf(sc), pc = (sc.ppm && +sc.ppm.client) || 0, ps = (sc.ppm && +sc.ppm.server) || 0;
    if (fresh && toy) {
      if (m === 'AMP') p.ppmC = Math.min(pc, 20);
      if (m === 'BMP') p.ppmS = Math.min(ps, 15);
      p.size = 64; p.load = 60;
    }
    p.ppmC = Math.max(-pc, Math.min(pc, +p.ppmC || 0));
    p.ppmS = Math.max(-ps, Math.min(ps, +p.ppmS || 0));
    var maxLoad = m === 'GFP-F' ? 150 : 100;
    if (!(p.load >= 0 && p.load <= maxLoad)) p.load = m === 'IMP' ? 60 : 50;
    if (p.size !== 'mix' && !(+p.size > 0)) p.size = 'mix';
    return p;
  }

  // ---------- màu ----------
  function readColors() {
    var cs = getComputedStyle(document.getElementById('view-sim'));
    var g = function (k, d) { return (cs.getPropertyValue(k) || '').trim() || d; };
    sv.colors = TYPE_INFO.map(function (t) { return g('--sim-' + t.key, '#999'); });
    sv.colors.grid = g('--sim-gridline', 'rgba(0,0,0,.15)');
    sv.colors.text = g('--text', '#222');
    sv.colors.muted = g('--muted', '#667');
    sv.colors.bad = g('--sim-bad', '#e03131');
    sv.colors.conv = g('--sim-conv', '#eef1f5');
    sv.colors.surface = g('--surface', '#fff');
    sv.colors.f = [0, 1, 2, 3, 4, 5].map(function (i) { return g('--sim-f' + i, '#8ab'); });
  }
  var lumCache = {};
  /** Chữ trên ô: tối trên nền sáng, trắng trên nền tối. */
  function inkOn(col) {
    if (lumCache[col] != null) return lumCache[col];
    var m = /^#([0-9a-f]{6})$/i.exec(col), v = '#111';
    if (m) { var x = parseInt(m[1], 16), l = 0.299 * (x >> 16) + 0.587 * ((x >> 8) & 255) + 0.114 * (x & 255); v = l < 140 ? '#fff' : '#111'; }
    return (lumCache[col] = v);
  }

  // =====================================================================
  // Dựng trang
  // =====================================================================
  function headHtml(sc, eyebrow, title, summary) {
    var fl = sc ? frameLinks(sc) : [], lab = sc ? labLink(sc) : null;
    return '<section class="stack-head"><div class="head-top"><span class="eyebrow">' + esc(eyebrow) + '</span>' +
      '<h1 class="stack-title">' + esc(title) + '</h1>' +
      '<p class="stack-summary">' + esc(summary) + '</p>' +
      (sc ? '<div class="sim-links">' +
        (sc.client ? '<span class="chip">client: ' + esc(nameOfUnit(sc.client)) + (sc.clientKbps ? ' · ' + esc(rate(+sc.clientKbps)) : '') + '</span>' : '') +
        (sc.server ? '<span class="chip">server: ' + esc(nameOfUnit(sc.server)) + (sc.serverPayloadKbps ? ' · tải ' + esc(rate(+sc.serverPayloadKbps)) : '') + '</span>' : '') +
        fl.map(function (f) { return '<a class="btn-ghost" href="#t/' + esc(f) + '">Xem khung ' + esc((root.TFRAMES[f] || {}).name || f) + '</a>'; }).join('') +
        (lab ? '<a class="btn-ghost" href="#lab/' + esc(lab.id) + '">Mở lab ' + esc(lab.name || lab.id) + '</a>' : '') +
      '</div>' + (sc.standard ? '<p class="muted calc-small">Chuẩn: ' + esc(sc.standard) + '</p>' : '') : '') + '</div></section>';
  }
  function pickerHtml() {
    var cur = sv.page === 'compare' ? 'compare' : sv.id;
    return '<nav class="sim-pick" aria-label="Chọn kịch bản">' +
      (compareSet() ? '<a class="sim-tab sim-tab--cmp' + (cur === 'compare' ? ' is-on' : '') + '" href="#sim/compare"' + (cur === 'compare' ? ' aria-current="page"' : '') + '><b>So sánh</b> AMP · BMP · GMP</a>' : '') +
      sortedMaps().map(function (x) {
        return '<a class="sim-tab' + (x.id === cur ? ' is-on' : '') + '" href="#sim/' + esc(x.id) + '"' + (x.id === cur ? ' aria-current="page"' : '') + '><b>' + esc(methodOf(x) === 'PDH-BIT' ? 'PDH' : methodOf(x)) + '</b> ' + esc(x.name || x.id) + '</a>';
      }).join('') + '</nav>';
  }
  function runButtons(extra) {
    return '<button type="button" class="btn-ghost sim-run" data-sact="run">▶ Chạy</button>' +
      '<button type="button" class="btn-ghost" data-sact="step">⏭ Từng khung</button>' +
      '<button type="button" class="btn-ghost" data-sact="reset">↺ Đặt lại</button>' + (extra || '');
  }
  function durSelect() {
    return '<label class="sim-field"><span>Tốc độ hoạt ảnh</span><select data-sin="dur">' + DURS.map(function (o) {
      return '<option value="' + o[0] + '"' + (sv.st.dur === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>';
  }
  function slider(key, label, min, max, stepv, val) {
    return '<label class="sim-field sim-slider"><span>' + esc(label) + ': <b data-sval="' + key + '">' + fmtSigned(key, val) + '</b></span>' +
      '<input type="range" min="' + min + '" max="' + max + '" step="' + stepv + '" value="' + val + '" data-sin="' + key + '"></label>';
  }
  function fmtSigned(key, v) { return key === 'load' ? v + ' %' : (v > 0 ? '+' : '') + v; }
  function sizeOptions(sel, toy) {
    var g = (sv.P && sv.P.gfp) || { minEth: 64, maxEth: 1518 };
    var sizes = (toy ? [64, 128, 256, 512, 1518] : [64, 128, 512, 1518]).filter(function (x) { return x >= g.minEth && x <= g.maxEth; });
    if (sizes.indexOf(g.maxEth) < 0) sizes.push(g.maxEth);
    return '<option value="mix"' + (sel === 'mix' ? ' selected' : '') + '>Ngẫu nhiên (IMIX 64/594/1518)</option>' +
      sizes.map(function (x) { return '<option value="' + x + '"' + (+sel === x ? ' selected' : '') + '>' + x + ' byte</option>'; }).join('');
  }

  /** Nhãn tỉ lệ khung đồ chơi + mức phóng đại ppm. */
  function scaleText(P) {
    if (!P || !P.toy) return '';
    var R = P.toy.real, u = unitName(P), m = P.method;
    var s = 'Khung đồ chơi ' + P.rows + ' × ' + P.cols + ' ' + u + ' thay cho ' + (R.mf > 1 ? R.mf + ' khung × ' : '') + R.rows + ' × ' + fmtN(R.cols, 0) + (R.colStep > 1 ? ' (1 TS)' : '') + '.';
    if (m === 'GFP-F') return s + ' Khung Ethernet giữ ĐÚNG cỡ thật (64…1518 byte) nên một khung dài vắt qua nhiều khung đồ chơi.';
    if (P.locked && isJust(m)) return s + ' BMP không bù nên ppm không làm gì cả.';
    if (P.toyFcap) return s + ' Lệch ppm phóng đại ×' + fmtN(P.ppmScale, 0) + ' — KHÔNG đúng tỉ lệ thực; giới hạn ở mức này vì khung nhỏ chỉ còn ' + fmtN(P.Pw - P.cmNom, 2) + ' từ trống (Cm không được vượt P).';
    return s + ' Lệch ppm phóng đại ×' + fmtN(P.ppmScale, 0) + ' — KHÔNG đúng tỉ lệ thực, nhưng giữ đúng số ' + (m === 'IMP' ? 'khối Idle chèn/xoá' : m === 'GMP' ? 'từ Cm thay đổi' : 'lần bù') + ' mỗi khung như khung thật.';
  }

  function guideHtml(m, toy) {
    var g = toy ? 'Nhìn từ trái sang phải: đơn vị client chạy trên băng chuyền vào bộ đệm (thanh mức), rồi được rót vào khung server theo thứ tự truyền từng ô (khung mờ = khung trước). ' +
      'Ô màu riêng là ô đặc biệt và nhấp nháy khi đổi trạng thái; nhật ký giải thích từng khung. ' :
      'Chế độ Thực tế: lưới là toàn bộ vùng tải chuẩn (thu nhỏ, mỗi ô vẽ gộp nhiều byte) — bù chỉ đổi 1 ô trong hàng chục nghìn, nên dùng kính lúp, bộ đếm và nhật ký. ';
    return '<div class="sim-guide"><b>Nhìn vào đâu.</b> ' + esc(g) + esc(toy ? (METHOD_LOOK[m] || '') : '') + '</div>';
  }

  /** Thanh chọn chế độ Minh hoạ / Thực tế. */
  function modeBar(P) {
    var toy = sv.mode === 'toy';
    return '<div class="sim-modebar"><div class="sim-seg" role="group" aria-label="Chế độ mô phỏng">' +
      '<button type="button" data-sact="mode" data-mode="toy" class="' + (toy ? 'is-on' : '') + '" aria-pressed="' + toy + '">Minh hoạ</button>' +
      '<button type="button" data-sact="mode" data-mode="real" class="' + (!toy ? 'is-on' : '') + '" aria-pressed="' + !toy + '">Thực tế</button></div>' +
      '<span class="sim-scale" data-sim="scale">' + esc(toy ? scaleText(P) : 'Số liệu chuẩn: kích thước khung, tốc độ và ppm thật.') + '</span></div>';
  }

  function controlsHtml(P, toy) {
    var sc = sv.sc, m = P.method, p = params();
    var pc = (sc.ppm && +sc.ppm.client) || 0, ps = (sc.ppm && +sc.ppm.server) || 0;
    return '<section class="card sim-card" aria-labelledby="sim-ctl-t"><div class="section-title"><h2 id="sim-ctl-t">Điều khiển</h2><span class="muted" data-sim="frameno"></span></div>' +
      '<div class="sim-controls">' + runButtons() +
        (toy ? durSelect() : '<label class="sim-field"><span>Tốc độ</span><select data-sin="fps">' + [[1, '1 khung/s'], [3, '3 khung/s'], [8, '8 khung/s'], [20, '20 khung/s']].map(function (o) {
          return '<option value="' + o[0] + '"' + (sv.st.fps === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>') +
        (m !== 'BMP' && pc ? slider('ppmC', 'Lệch clock client (ppm)', -pc, pc, 1, p.ppmC) : '') +
        (ps ? slider('ppmS', m === 'BMP' ? 'Lệch clock (client = server, ppm)' : 'Lệch clock server (ppm)', -ps, ps, 1, p.ppmS) : '') +
        (m === 'GFP-F' || m === 'IMP' ? slider('load', m === 'GFP-F' ? 'Tải Ethernet (%; > 100 = quá tải)' : 'Tải Ethernet (%)', 0, m === 'GFP-F' ? 150 : 100, 1, p.load) +
          '<label class="sim-field"><span>Cỡ khung Ethernet</span><select data-sin="size">' + sizeOptions(p.size, toy) + '</select></label>' : '') +
      '</div>' + (toy && P.ppmScale > 1 && m !== 'GFP-F' && !(P.locked && isJust(m)) ? '<p class="muted calc-small" data-sim="ppmfx"></p>' : '') + '</section>';
  }

  function build() {
    var sc = sv.sc, P = sv.P, m = P.method, toy = sv.mode === 'toy';
    var html = headHtml(sc, 'Mô phỏng ánh xạ · ' + (m === 'PDH-BIT' ? 'PDH chèn bit' : m), sc.name || sc.id, sc.summary || METHOD_HINT[m] || '') +
      pickerHtml() + modeBar(P) + guideHtml(m, toy) +
      (P.errors.length ? '<div class="alert alert--warn">' + P.errors.map(esc).join('<br>') + '</div>' : '') +
      controlsHtml(P, toy);
    if (toy) {
      html += '<section class="card sim-card sim-stagecard" aria-labelledby="sim-stage-t"><div class="section-title"><h2 id="sim-stage-t">Băng chuyền → bộ đệm → khung</h2><span class="muted" data-sim="gridcap"></span></div>' +
        '<div class="sim-stagewrap"><div class="sim-stage"><canvas class="sim-stagecv" data-sim="stage" role="img" aria-label="Hoạt ảnh: client vào bộ đệm rồi lấp khung server"></canvas>' +
        '<p class="sim-caption" data-sim="caption" aria-live="polite"></p>' + (m === 'GMP' ? '<p class="sim-sd" data-sim="sd"></p>' : '') + '</div>' +
        '<div class="sim-logbox"><h3>Nhật ký sự kiện</h3><ol class="sim-log" data-sim="log"></ol></div></div>' +
        '<ul class="sim-legend" data-sim="legend"></ul></section>';
    } else {
      html += '<section class="card sim-card" aria-labelledby="sim-grid-t"><div class="section-title"><h2 id="sim-grid-t">Vùng tải một khung server</h2><span class="muted" data-sim="gridcap"></span></div>' +
        '<div class="sim-gridwrap"><div class="sim-oh" data-sim="oh" aria-label="Overhead điều khiển ánh xạ"></div>' +
        '<div class="sim-canvas-wrap"><canvas class="sim-canvas" data-sim="grid" role="img" aria-label="Lưới vùng tải thu nhỏ"></canvas>' +
        '<div class="sim-axis muted" data-sim="axis"></div></div></div>' +
        '<div class="sim-zoomhead"><span><b>Kính lúp</b> <span class="muted" data-sim="zoomlbl"></span></span>' +
        '<input type="range" min="0" max="1000" step="1" value="' + Math.round(sv.zoom * 1000) + '" data-sin="zoom" aria-label="Vị trí kính lúp"></div>' +
        '<canvas class="sim-zoom" data-sim="zoom" role="img" aria-label="Phóng to từng ô"></canvas>' +
        '<ul class="sim-legend" data-sim="legend"></ul>' +
        '<div class="sim-logbox sim-logbox--wide"><h3>Nhật ký sự kiện</h3><ol class="sim-log" data-sim="log"></ol></div>' +
      '</section>';
    }
    html += '<section class="card sim-card" aria-labelledby="sim-cnt-t"><div class="section-title"><h2 id="sim-cnt-t">Bộ đếm</h2></div>' +
        '<div class="stats" data-sim="stats"></div>' +
        '<div class="sim-timeline"><span class="muted calc-small" data-sim="tlabel"></span><canvas class="sim-hist" data-sim="hist" role="img" aria-label="Dòng thời gian các khung gần nhất"></canvas></div>' +
      '</section>' +
      '<section class="card sim-card" aria-labelledby="sim-steps-t"><div class="section-title"><h2 id="sim-steps-t">Từng bước (theo chuẩn)</h2></div>' +
        (sc.steps && sc.steps.length ? '<ol class="sim-steps">' + sc.steps.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' : '<p class="muted">' + esc(METHOD_HINT[m] || '') + '</p>') +
        (sc.note ? '<p class="note calc-note">' + esc(sc.note) + '</p>' : '') +
      '</section>';
    $('#view-sim').innerHTML = html;
    readColors();
    renderDetail(sv.realP);
    updatePpmFx();
  }

  function buildCompare() {
    var set = compareSet();
    var html = headHtml(null, 'Mô phỏng ánh xạ · So sánh', 'So sánh AMP · BMP · GMP', 'Ba bộ ghép chạy song song với CÙNG một độ lệch clock client, cùng khung đồ chơi 4 × 16 byte, để thấy mỗi cách xử lý lệch tốc độ khác nhau thế nào.') +
      pickerHtml() +
      '<div class="sim-guide"><b>Nhìn vào đâu.</b> Kéo thanh ppm rồi so ba thanh bộ đệm: <b>AMP</b> để bộ đệm trôi tới ngưỡng rồi bù đúng 1 byte qua NJO/PJO (JC đổi); ' +
        '<b>BMP</b> lấy đồng hồ server từ client nên bộ đệm đứng yên, JC luôn 00; <b>GMP</b> mỗi khung báo Cm và rải ô chèn đều — bù mịn từng khung, bộ đệm gần như không đổi.</div>' +
      '<section class="card sim-card"><div class="section-title"><h2>Điều khiển chung</h2><span class="muted" data-sim="frameno"></span></div>' +
        '<div class="sim-controls">' + runButtons() + durSelect() + slider('cmpPpm', 'Lệch clock client (ppm, cả ba)', -45, 45, 1, sv.st.cmpPpm) + '</div>' +
        '<p class="muted calc-small">Đồng hồ server giữ danh định. Mỗi làn phóng đại ppm theo kích thước khung thật của nó (ghi ở đầu làn) nên số lần bù mỗi khung giống thực tế. ' +
        'G.709 không ánh xạ STM-16 vào OPU1 bằng GMP, nên làn GMP dùng kịch bản GMP từ 1 byte còn đủ chỗ trống cho lệch ppm' + (set[2] ? ' (' + esc(set[2].name) + ')' : '') + '.</p></section>' +
      '<div class="sim-cmpwrap"><div class="sim-cmp">' + set.map(function (sc, i) {
        return '<section class="card sim-lane" aria-label="' + esc(sc.name) + '"><div class="sim-lane-h"><b>' + esc(methodOf(sc)) + '</b> <a href="#sim/' + esc(sc.id) + '">' + esc(sc.name) + '</a></div>' +
          '<p class="muted calc-small" data-lane-sc="' + i + '"></p>' +
          '<canvas class="sim-stagecv" data-lane-cv="' + i + '" role="img" aria-label="Hoạt ảnh ' + esc(methodOf(sc)) + '"></canvas>' +
          '<p class="sim-caption" data-lane-st="' + i + '"></p><ol class="sim-log sim-minilog" data-lane-log="' + i + '"></ol></section>';
      }).join('') + '</div></div>';
    $('#view-sim').innerHTML = html;
    readColors();
    sv.lanes.forEach(function (L, i) { var e = $('#view-sim [data-lane-sc="' + i + '"]'); if (e) e.textContent = 'ppm ×' + fmtN(L.P.ppmScale, 0) + ' · ' + (L.P.locked ? 'server bám client' : 'đồng hồ riêng'); });
    document.getElementById('detail').innerHTML = '<div class="detail-card"><span class="eyebrow">So sánh</span><h2>AMP · BMP · GMP</h2>' +
      ['AMP', 'BMP', 'GMP'].map(function (k) { return '<p><b>' + k + '</b>: ' + esc(METHOD_HINT[k]) + '</p>'; }).join('') + '</div>';
  }

  function updatePpmFx() {
    var el = $('#view-sim [data-sim="ppmfx"]');
    if (!el || !sv.P || !sv.P.toy) return;
    var p = params(), k = sv.P.ppmScale, eff = ((ppmRatio(p, sv.P) - 1) * 100);
    el.textContent = 'Trên khung đồ chơi: lệch ' + fmtSigned('x', p.ppmC) + '/' + fmtSigned('x', p.ppmS) + ' ppm × ' + fmtN(k, 0) + ' → client ' + (eff >= 0 ? 'nhanh' : 'chậm') + ' hơn ' + fmtN(Math.abs(eff), 2) + ' %.';
  }

  /** Panel bên phải: ý nghĩa phương pháp + bảng JC / công thức GMP / tham số GFP / IMP (luôn theo số liệu chuẩn). */
  function renderDetail(P) {
    var sc = P.sc, m = P.method, h = '';
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
    h += '<h3>Hai chế độ</h3><p class="muted calc-small"><b>Minh hoạ</b>: khung nhỏ cùng luật, ppm phóng đại để thấy bù mỗi vài khung. <b>Thực tế</b>: lưới đúng kích thước chuẩn (thu nhỏ khi vẽ), kính lúp xem từng byte.</p></div>';
    document.getElementById('detail').innerHTML = h;
  }
  function jcPlace(jc) {
    var rows = [].concat(jc.rows || []).join(', '), bits = [].concat(jc.bits || []).join(', ');
    return 'hàng ' + rows + (jc.col ? ', cột ' + jc.col : '') + (bits ? ', bit ' + bits : '');
  }

  // =====================================================================
  // Làn mô phỏng (chế độ Minh hoạ + so sánh): trạng thái + chuỗi ô theo thứ tự truyền
  // =====================================================================
  function makeLane(sc) {
    var P = prepToy(sc), fr = sc.frame || {};
    var L = { sc: sc, P: P, ohCols: [] };
    if (P.method !== 'IMP' && Array.isArray(fr.ohCols)) L.ohCols = fr.ohCols.map(Number).filter(function (c) { return c < P.col0; }).sort(function (a, b) { return a - b; });
    // vị trí trong thứ tự lấp (để tính từ GMP j của ô)
    L.orderPos = new Int32Array(P.dRows * P.cols); L.orderPos.fill(-1);
    P.order.forEach(function (ix, k) { L.orderPos[ix] = k; });
    laneReset(L);
    return L;
  }
  function laneReset(L) { L.S = create(L.P, 12345); L.cur = null; L.prev = null; L.seq = null; L.prevSeq = null; L.log = []; }
  function laneAdvance(L, o) {
    var res = step(L.S, o);
    L.prev = L.cur; L.prevSeq = L.seq; L.cur = res;
    L.seq = buildSeq(L, res, L.prevSeq);
    L.log.unshift({ text: describe(L.P, res), kind: logKind(L.P, res) });
    if (L.log.length > 40) L.log.pop();
  }

  /** Ô OH (ngoài vùng tải) tại hàng r, cột chuẩn c: JC/NJO (AMP/BMP), JC1–6 (GMP), PSI/RES… */
  function ohCellInfo(sc, r, c) {
    var J = sc.just, g = sc.gmp, i;
    if (J && J.jc && +J.jc.col === c && (i = listOf(J.jc.rows, 99).indexOf(r)) >= 0) return { kind: 'jc', i: i };
    if (J && J.njo && +J.njo.row === r && +J.njo.col === c) return { kind: 'njo' };
    if (g && g.jc && g.jc.cm && +g.jc.cm.col === c && (i = listOf(g.jc.cm.rows, 99).indexOf(r)) >= 0) return { kind: 'cm', i: i };
    if (g && g.jc && g.jc.cnd && +g.jc.cnd.col === c && (i = listOf(g.jc.cnd.rows, 99).indexOf(r)) >= 0) return { kind: 'cnd', i: i };
    var hit = (sc.oh || []).filter(function (o) { return rowsOf(o, 99).indexOf(r) >= 0 && colsOf(o, 9999).indexOf(c) >= 0; })[0];
    return { kind: 'oh', abbr: hit ? hit.abbr || '' : '' };
  }
  /** Nhãn ô OH trong lưới (PDH: bit FAS từ note "1111010000"). */
  function inGridOhLabel(sc, r, c) {
    var o = (sc.oh || []).filter(function (x) { return rowsOf(x, 99).indexOf(r) >= 0 && colsOf(x, 9999).indexOf(c) >= 0; })[0];
    if (!o) return '';
    var cs = colsOf(o, 9999), k = cs.indexOf(c);
    if (/^[01]+$/.test(String(o.note || '')) && String(o.note).length === cs.length) return String(o.note).charAt(k);
    return k === 0 ? (o.abbr || '') : '';
  }

  var SPECIAL = {}; [T.JDATA, T.JSTUFF, T.GSTUFF, T.BINS, T.JC].forEach(function (t) { SPECIAL[t] = 1; });

  /**
   * Chuỗi ô theo THỨ TỰ TRUYỀN của một khung: mỗi hàng gồm cột OH (15, 16) rồi vùng tải; IMP theo cột (thứ tự lịch).
   * Mỗi ô: x, y (ô hiển thị), t (loại), id (số thứ tự đơn vị client — để màu chảy liên tục từ băng chuyền vào khung),
   * fid (khung Ethernet / gói), lab, fl (nhấp nháy vì đổi trạng thái so với khung trước).
   */
  function buildSeq(L, res, prevSeq) {
    var P = L.P, sc = P.sc, m = P.method, ohc = L.ohCols, nx = ohc.length + P.cols, items = [], byPos = new Array(nx * P.dRows);
    var uid = res.s0 || 0, wantId = isJust(m) || m === 'GMP', jcStr = String(res.jc || ''), lastF = -2;
    var njoOpp = res.opp ? res.opp.filter(function (q) { return q.key === 'njo'; })[0] : null;
    var oppByCell = {}; if (P.just) P.just.opp.forEach(function (q) { if (q.cell >= 0) oppByCell[q.cell] = q.key.toUpperCase(); });
    var jcRows = P.just && P.just.jc ? listOf(P.just.jc.rows, P.rows) : [];
    function push(it) { items.push(it); byPos[it.y * nx + it.x] = it; }
    function ohItem(y, k) {
      var r = (y % P.rows) + 1, inf = ohCellInfo(sc, r, ohc[k]), it = { x: k, y: y, t: T.OH, id: -1, fid: -1, lab: inf.abbr || '', oh: 1 };
      if (inf.kind === 'jc') { it.t = T.JC; it.lab = m === 'PDH-BIT' ? 'Cj' : 'JC'; it.val = jcStr; }
      else if (inf.kind === 'njo') { var dat = !!(njoOpp && njoOpp.data); it.t = dat ? T.JDATA : T.JSTUFF; it.lab = 'NJO'; if (dat) it.id = ++uid; }
      else if (inf.kind === 'cm') { it.t = T.JC; it.lab = inf.i === 0 ? 'Cm' : inf.i === 1 ? String(res.cm) : 'CRC'; it.val = String(res.cm); }
      else if (inf.kind === 'cnd') { it.lab = 'JC' + (4 + inf.i); }
      push(it);
    }
    function gridItem(y, gc) {
      var idx = y * P.cols + gc, t = res.cells[idx], c = P.col0 + gc, r = (y % P.rows) + 1;
      var it = { x: ohc.length + gc, y: y, t: t, id: -1, fid: -1, lab: '', cell: idx };
      if (res.fids) it.fid = res.fids[idx];
      else if (res.pks) it.fid = res.pks[idx];
      else if (wantId && (t === T.DATA || t === T.DATA2 || t === T.JDATA)) it.id = ++uid;
      if (oppByCell[idx] != null) it.lab = oppByCell[idx];
      else if (t === T.FS) it.lab = 'FS';
      else if (t === T.GSTUFF) it.lab = 'S';
      else if (t === T.GIDLE) it.lab = 'I';
      else if (t === T.BIDLE) it.lab = 'I';
      else if (t === T.BINS) it.lab = '+I';
      else if (t === T.GFPH && it.fid !== lastF) it.lab = '#' + it.fid;
      else if (t === T.BDATA && it.fid !== lastF) it.lab = 'P' + it.fid;
      else if (t === T.OH) it.lab = inGridOhLabel(sc, r, c);
      else if (t === T.JC) { var bi = jcRows.indexOf(r); it.lab = jcStr.charAt(bi >= 0 ? bi : 0) || ''; it.val = jcStr; }
      else if (t === T.OTHER && P.tributaries) it.lab = String(((c - 1) % P.tributaries) + 1);
      if (m === 'GMP' && L.orderPos[idx] >= 0) it.j = Math.floor(L.orderPos[idx] / P.wb) + 1;
      if (res.fids || res.pks) lastF = t === T.GIDLE || t === T.BIDLE || t === T.BINS ? -1 : it.fid;
      push(it);
    }
    var y, gc, k;
    if (P.colMajor) { for (gc = 0; gc < P.cols; gc++) for (y = 0; y < P.dRows; y++) gridItem(y, gc); }
    else for (y = 0; y < P.dRows; y++) { for (k = 0; k < ohc.length; k++) ohItem(y, k); for (gc = 0; gc < P.cols; gc++) gridItem(y, gc); }
    // số đơn vị đã rời bộ đệm sau i ô đầu (bộ đệm byte của AMP/BMP/GMP/PDH)
    var cum = new Int32Array(items.length + 1);
    for (var i = 0; i < items.length; i++) cum[i + 1] = cum[i] + (items[i].id > 0 ? 1 : 0);
    if (prevSeq) items.forEach(function (it) {
      var pv = prevSeq.byPos[it.y * nx + it.x];
      if (pv && (SPECIAL[it.t] || SPECIAL[pv.t]) && (pv.t !== it.t || (it.val != null && it.val !== pv.val))) it.fl = 1;
    });
    return { items: items, byPos: byPos, nx: nx, cum: cum };
  }

  /**
   * Dòng đều (AMP/BMP/GMP/PDH): số đơn vị đã rời bộ đệm (có phần lẻ của ô đang lấp) và tỉ lệ so với cả khung.
   * Đơn vị đến được rải theo tỉ lệ này (không theo thời gian) để ô OH — không lấy byte nào — không làm thanh mức rung:
   * BMP đứng yên tuyệt đối, AMP/GMP trôi tuyến tính từ mức đầu khung tới mức cuối khung.
   */
  function sentFrac(L, p) {
    var items = L.seq.items, nI = items.length, hp = Math.max(0, Math.min(nI, p * nI)), head = Math.floor(hp);
    var tot = L.seq.cum[nI], sent = L.seq.cum[head] + (head < nI && items[head].id > 0 ? hp - head : 0);
    return { sent: sent, frac: tot ? sent / tot : p };
  }
  /** Mức bộ đệm (đơn vị client) ở tiến độ p. */
  function fifoLevel(L, p) {
    var r = L.cur, m = L.P.method;
    if (m === 'GFP-F') return Math.max(0, r.q0 + (r.q1 - r.q0) * p);
    if (m === 'IMP') return Math.max(0, r.buf0 + (r.buffer - r.buf0) * p);
    return Math.max(0, r.lvl0 + (r.lvl1 - r.lvl0) * sentFrac(L, p).frac);
  }

  // ---------- vẽ làn ----------
  function layoutLane(L, W, compact) {
    var P = L.P, rows = P.dRows, cols = P.cols, nx = L.ohCols.length + cols, pad = 6, lbl = 22, o = { W: W };
    if (!compact && W >= 900) {
      o.horiz = true;
      o.convX = pad; o.convW = Math.round(W * 0.2); o.fifoX = o.convX + o.convW + 6; o.fifoW = Math.round(W * 0.16);
      o.gridX = o.fifoX + o.fifoW + 30 + lbl; o.gridY = 56;
      o.cs = Math.max(10, Math.min(44, Math.floor((W - o.gridX - pad) / nx)));
      o.tubeH = Math.max(18, Math.min(32, o.cs)); o.tubeY = Math.round(o.gridY + rows * o.cs / 2 - o.tubeH / 2);
      o.H = o.gridY + rows * o.cs + 10;
    } else {
      o.convX = pad; o.convW = Math.round((W - 2 * pad) * 0.52); o.fifoX = o.convX + o.convW + 10; o.fifoW = W - pad - o.fifoX;
      o.tubeY = 20; o.tubeH = compact ? 20 : 24;
      o.gridX = pad + lbl; o.gridY = o.tubeY + o.tubeH + 66;
      o.cs = Math.max(6, Math.min(compact ? 30 : 42, Math.floor((W - o.gridX - pad) / nx)));
      o.H = o.gridY + rows * o.cs + 8;
    }
    o.slotW = o.fifoW / Math.max(1, P.fifoCap);
    return o;
  }

  function unitColor(id) { var C = sv.colors; return Math.floor((id - 1) / 4) % 2 ? C[T.DATA2] : C[T.DATA]; }
  function fidColor(fid) { var f = sv.colors.f; return f[((fid % f.length) + f.length) % f.length]; }
  function cellColor(it) {
    var C = sv.colors;
    if (it.t === T.JDATA) return C[T.JDATA];
    if ((it.t === T.DATA || it.t === T.DATA2 || it.t === T.BDATA) && it.fid >= 0) return fidColor(it.fid);
    if ((it.t === T.DATA || it.t === T.DATA2) && it.id > 0) return unitColor(it.id);
    return C[it.t] || C[0];
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  /** Băng chuyền: đơn vị client chạy từ trái vào cửa bộ đệm. */
  function drawConveyor(ctx, L, o, p, head, t) {
    var C = sv.colors, P = L.P, r = L.cur, m = P.method, x0 = o.convX, w = o.convW, y = o.tubeY, h = o.tubeH, ent = x0 + w;
    ctx.fillStyle = C.conv; rrect(ctx, x0, y, w, h, 5); ctx.fill();
    ctx.save(); rrect(ctx, x0, y, w, h, 5); ctx.clip();
    var u, j, xx, unitPx;
    if (m === 'GFP-F' || m === 'IMP') {
      var list = [], k;
      (r.arr || []).forEach(function (a) { list.push({ a: a, T: m === 'IMP' ? a.at : a.t }); });
      (r.nextArr || []).forEach(function (a) { list.push({ a: a, T: 1 + (m === 'IMP' ? a.at : a.t) }); });
      if (m === 'GFP-F') {
        var pxPer = w / 1.9, bpx = pxPer / Math.max(1, P.wirePerFrame);
        // vạch băng chuyền chạy theo thời gian
        drawBelt(ctx, x0, y, w, h, (t / 40) % 14);
        for (k = 0; k < list.length; k++) {
          var a = list[k].a, rel = list[k].T - p, wd = Math.max(5, a.L * bpx);
          if (rel < 0) {
            if (a.drop && rel > -0.5) { ctx.globalAlpha = 1 + rel * 2; ctx.fillStyle = C.bad; ctx.fillRect(ent - Math.min(wd, 30), y + 3 - rel * 60, Math.min(wd, 30), h - 6); ctx.globalAlpha = 1; }
            continue;
          }
          if (rel > 1.95) continue;
          xx = ent - rel * pxPer;
          ctx.fillStyle = a.drop && rel < 0.15 ? C.bad : fidColor(a.fid); ctx.fillRect(xx - wd + 1, y + 3, wd - 2, h - 6);
          ctx.fillStyle = C[T.GFPH]; ctx.fillRect(xx - 3, y + 3, 2, h - 6);
          if (wd > 26) { ctx.fillStyle = inkOn(fidColor(a.fid)); ctx.font = '600 10px system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.fillText('#' + a.fid + ' ' + a.L + 'B', Math.max(x0 + 2, xx - wd + 4), y + h / 2 + 3.5); }
        }
      } else {
        unitPx = w / 14;
        var nPer = Math.max(1, (r.arr || []).length || P.rNom), pxP = unitPx * nPer;
        drawBelt(ctx, x0, y, w, h, (p * pxP) % 14);
        for (k = 0; k < list.length; k++) {
          var b = list[k].a, rl = list[k].T - p;
          if (rl < 0) { if (b.del && rl > -0.25) { var yy = y + 3 - rl * 120; ctx.globalAlpha = 1 + rl * 4; drawCross(ctx, ent - unitPx, yy, unitPx - 2, h - 6, C); ctx.globalAlpha = 1; } continue; }
          xx = ent - rl * pxP;
          if (xx < x0 - unitPx) continue;
          ctx.fillStyle = b.t === T.BDATA ? fidColor(b.pk) : C[T.BIDLE]; ctx.fillRect(xx - unitPx + 1, y + 3, unitPx - 2, h - 6);
          if (b.del) drawCross(ctx, xx - unitPx + 1, y + 3, unitPx - 2, h - 6, C);
        }
      }
    } else {
      // dòng đều: đơn vị thứ j tới cửa bộ đệm khi tổng đã vào vượt j
      unitPx = o.slotW;
      u = r.s0 + r.lvl0 + (r.a1 - r.a0) * sentFrac(L, p).frac;
      drawBelt(ctx, x0, y, w, h, (u * unitPx) % 14);
      for (j = Math.floor(u) + 1; ; j++) {
        xx = ent - (j - u) * unitPx;
        if (xx < x0) break;
        ctx.fillStyle = unitColor(j); ctx.fillRect(xx - unitPx + 1, y + 3, Math.max(1, unitPx - 2), h - 6);
      }
    }
    ctx.restore();
    // nhãn
    ctx.fillStyle = C.muted; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Client →', x0, y - 6);
    var rateTxt = m === 'GFP-F' ? 'tải ' + (sv.page === 'one' ? params().load : '') + ' %' :
      m === 'IMP' ? fmtN((r.arr || []).length, 0) + ' khối/khung' : fmtN(r.a1 - r.a0, 2) + ' ' + unitName(P) + '/khung';
    ctx.font = '11px system-ui, sans-serif'; ctx.fillText(rateTxt, x0, y + h + 13);
  }
  function drawBelt(ctx, x, y, w, h, off) {
    ctx.strokeStyle = sv.colors.grid; ctx.lineWidth = 1;
    for (var xx = x + w - off; xx > x; xx -= 14) { ctx.beginPath(); ctx.moveTo(xx + 0.5, y + h - 2); ctx.lineTo(xx + 0.5, y + h); ctx.stroke(); }
  }
  function drawCross(ctx, x, y, w, h, C) {
    ctx.fillStyle = C[T.BIDLE]; ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.bad; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); ctx.moveTo(x + w, y); ctx.lineTo(x, y + h); ctx.stroke();
  }

  /** Bộ đệm FIFO: ống nằm ngang, cửa ra bên phải; thanh mức + ngưỡng. */
  function drawFifo(ctx, L, o, p, head) {
    var C = sv.colors, P = L.P, r = L.cur, m = P.method, x = o.fifoX, y = o.tubeY, w = o.fifoW, h = o.tubeH, cap = P.fifoCap;
    var lvl = fifoLevel(L, p), full = lvl >= cap - 0.5 || (m === 'GFP-F' && r.dropped && p > 0.5);
    ctx.fillStyle = C.surface; rrect(ctx, x, y, w, h, 4); ctx.fill();
    ctx.save(); rrect(ctx, x, y, w, h, 4); ctx.clip();
    var s, xx;
    if (m === 'GFP-F') {
      var fillW = Math.min(1, lvl / cap) * w, used = 0;
      for (s = 0; s < r.qList.length && used < fillW; s++) {
        var sw = Math.min(fillW - used, Math.max(2, r.qList[s].len / cap * w));
        ctx.fillStyle = fidColor(r.qList[s].fid); ctx.fillRect(x + w - used - sw, y + 2, sw - 1, h - 4); used += sw;
      }
      if (used < fillW) { ctx.fillStyle = C[T.DATA]; ctx.fillRect(x + w - fillW, y + 2, fillW - used, h - 4); }
    } else if (m === 'IMP') {
      var nI = Math.min(cap, Math.round(lvl)), sl = o.slotW;
      for (s = 0; s < nI; s++) { var q = r.qSnap[s] || { t: T.BIDLE, pk: -1 }; ctx.fillStyle = q.t === T.BDATA ? fidColor(q.pk) : C[T.BIDLE]; ctx.fillRect(x + w - (s + 1) * sl + 1, y + 2, sl - 2, h - 4); }
    } else {
      var sl2 = o.slotW, nn = Math.floor(lvl), fr = lvl - nn, exitId = r.s0 + Math.floor(sentFrac(L, p).sent) + 1;
      for (s = 0; s < Math.min(nn, cap); s++) { ctx.fillStyle = unitColor(exitId + s); ctx.fillRect(x + w - (s + 1) * sl2 + (sl2 > 4 ? 1 : 0), y + 2, Math.max(1, sl2 - (sl2 > 4 ? 2 : 0)), h - 4); }
      if (fr > 0.02 && nn < cap) { ctx.fillStyle = unitColor(exitId + nn); ctx.globalAlpha = 0.55; ctx.fillRect(x + w - nn * sl2 - fr * sl2, y + 2, fr * sl2, h - 4); ctx.globalAlpha = 1; }
    }
    ctx.restore();
    ctx.strokeStyle = full ? C.bad : C.muted; ctx.lineWidth = full ? 2.5 : 1.2; rrect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 4); ctx.stroke();
    // ngưỡng
    ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
    function mark(level, txt, col) {
      var mx = x + w - level * o.slotW;
      if (mx < x || mx > x + w) return;
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.setLineDash([3, 2]); ctx.beginPath(); ctx.moveTo(mx, y - 3); ctx.lineTo(mx, y + h + 3); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col; ctx.fillText(txt, mx, y + h + 13);
    }
    if (isJust(m) && !P.locked) { mark(r.lo, 'dưới', C[T.JSTUFF]); mark(r.hi, 'trên', C[T.JDATA]); }
    if (m === 'IMP') mark(P.impTarget, 'mục tiêu', C[T.BINS]);
    ctx.fillStyle = C.muted; ctx.font = '600 11px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('Bộ đệm (FIFO)', x, y - 6);
    ctx.textAlign = 'right'; ctx.fillStyle = full ? C.bad : C.text; ctx.font = '600 11px system-ui, sans-serif';
    ctx.fillText(fmtN(lvl, m === 'GFP-F' || m === 'IMP' ? 0 : 1) + ' ' + unitName(P) + (full ? ' — ĐẦY' : ''), x + w, y - 6);
    ctx.textAlign = 'left';
  }

  /** Lưới khung: cột OH + vùng tải; ô đã truyền vẽ đậm, ô chưa tới vẽ mờ theo khung trước; con trỏ ghi tại ô head. */
  function drawCells(ctx, L, o, p, head, t) {
    var C = sv.colors, P = L.P, seq = L.seq, items = seq.items, cs = o.cs, gx = o.gridX, gy = o.gridY, ohN = L.ohCols.length;
    var font = Math.max(7, Math.min(12, Math.floor(cs * 0.36)));
    // tiêu đề cột
    ctx.fillStyle = C.muted; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
    L.ohCols.forEach(function (c, k) { ctx.fillText(String(c), gx + k * cs + cs / 2, gy - 4); });
    if (ohN) ctx.fillText('OH', gx + ohN * cs / 2, gy - 17);
    ctx.textAlign = 'left'; ctx.font = '600 12px system-ui, sans-serif'; ctx.fillStyle = C.text;
    var title = (P.mf > 1 ? 'Đa khung #' : 'Khung #') + L.cur.k + ' — lấp theo thứ tự truyền' + (P.colMajor ? ' (theo cột lịch)' : '');
    ctx.fillText(fitText(ctx, title, o.W - gx + 18), gx - 18, gy - 34);
    ctx.font = '10px system-ui, sans-serif'; ctx.fillStyle = C.muted;
    var sub = 'vùng tải: ' + P.cols + ' cột thay cho ' + fmtN(P.toy ? P.toy.realCols : P.cols, 0) + (P.colMajor ? ' · hàng = khe lịch' : '');
    ctx.fillText(fitText(ctx, sub, o.W - gx - ohN * cs - 4), gx + ohN * cs + 3, ohN ? gy - 17 : gy - 4);
    // nhãn hàng
    ctx.textAlign = 'right';
    for (var y = 0; y < P.dRows; y++) ctx.fillText(String(y + 1), gx - 4, gy + y * cs + cs / 2 + 3);
    ctx.textAlign = 'center';
    var pulse = 0.5 + 0.5 * Math.sin(t / 110);
    for (var i = 0; i < items.length; i++) {
      var it = items[i], x = gx + it.x * cs, yy = gy + it.y * cs, shown = i < head;
      var src = shown ? it : (L.prevSeq && L.prevSeq.byPos[it.y * seq.nx + it.x]) || null;
      if (!shown) ctx.globalAlpha = 0.22;
      var col = src ? cellColor(src) : C[T.EMPTY];
      ctx.fillStyle = col; ctx.fillRect(x + 0.5, yy + 0.5, cs - 1, cs - 1);
      if (src && cs >= 14) {
        var lab = src.lab;
        if (!lab && src.id > 0 && cs >= 24) lab = String(src.id % 1000);
        if (lab) {
          ctx.fillStyle = inkOn(col);
          var fs = src.oh || src.t === T.JC || src.lab ? font : Math.max(7, font - 2);
          ctx.font = (src.lab ? '600 ' : '') + fs + 'px system-ui, sans-serif';
          if (src.t === T.JC && src.val != null && src.oh && cs >= 26 && (src.lab === 'JC' || src.lab === 'Cj')) {
            ctx.fillText(src.lab, x + cs / 2, yy + cs / 2 - 2); ctx.fillText(src.val, x + cs / 2, yy + cs / 2 + fs - 1);
          } else ctx.fillText(fitText(ctx, lab, cs - 2), x + cs / 2, yy + cs / 2 + fs / 2 - 1);
        }
      }
      ctx.globalAlpha = 1;
      if (shown && it.fl) {
        ctx.strokeStyle = it.t === T.JSTUFF || it.t === T.GSTUFF || it.t === T.BINS ? C[T.JSTUFF] : C[T.JC];
        ctx.globalAlpha = 0.45 + 0.55 * pulse; ctx.lineWidth = 3; ctx.strokeRect(x + 1.5, yy + 1.5, cs - 3, cs - 3); ctx.globalAlpha = 1;
      }
    }
    // viền khối khung Ethernet / gói (GFP-F, IMP): đường dày ở ranh giới giữa hai khung khác nhau
    if (P.method === 'GFP-F' || P.method === 'IMP') {
      ctx.strokeStyle = C.text; ctx.lineWidth = 2;
      ctx.beginPath();
      for (i = 0; i < Math.min(head, items.length); i++) {
        var a = items[i]; if (a.fid < 0 || a.t === T.GIDLE) continue;
        var ax = gx + a.x * cs, ay = gy + a.y * cs;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var nb = seq.byPos[(a.y + d[1]) * seq.nx + (a.x + d[0])];
          var inside = a.x + d[0] >= ohN && a.x + d[0] < seq.nx && a.y + d[1] >= 0 && a.y + d[1] < P.dRows;
          if (inside && nb && nb.fid === a.fid && nb.t !== T.GIDLE) return;
          if (d[0] === 1) { ctx.moveTo(ax + cs, ay); ctx.lineTo(ax + cs, ay + cs); }
          if (d[0] === -1) { ctx.moveTo(ax, ay); ctx.lineTo(ax, ay + cs); }
          if (d[1] === 1) { ctx.moveTo(ax, ay + cs); ctx.lineTo(ax + cs, ay + cs); }
          if (d[1] === -1) { ctx.moveTo(ax, ay); ctx.lineTo(ax + cs, ay); }
        });
      }
      ctx.stroke();
    }
    // con trỏ ghi
    if (head < items.length) {
      var hi = items[head];
      ctx.strokeStyle = C.text; ctx.lineWidth = 2.5; ctx.strokeRect(gx + hi.x * cs + 1, gy + hi.y * cs + 1, cs - 2, cs - 2);
    }
    // vạch ngăn cột OH
    if (ohN) { ctx.strokeStyle = C.muted; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx + ohN * cs + 0.5, gy - 2); ctx.lineTo(gx + ohN * cs + 0.5, gy + P.dRows * cs + 2); ctx.stroke(); }
    ctx.textAlign = 'left';
  }
  function fitText(ctx, s, w) {
    if (ctx.measureText(s).width <= w) return s;
    while (s.length > 1 && ctx.measureText(s).width > w) s = s.slice(0, -1);
    return s;
  }
  function drawArrow(ctx, o) {
    var C = sv.colors; ctx.strokeStyle = C.muted; ctx.fillStyle = C.muted; ctx.lineWidth = 1.5;
    var x1 = o.fifoX + o.fifoW, y1 = o.tubeY + o.tubeH / 2;
    ctx.beginPath();
    if (o.horiz) { ctx.moveTo(x1 + 2, y1); ctx.lineTo(o.gridX - 26, y1); ctx.stroke(); tri(ctx, o.gridX - 26, y1, 0); }
    else { var xm = o.fifoX + o.fifoW - 10, y2 = o.gridY - 24; ctx.moveTo(xm, o.tubeY + o.tubeH + 16); ctx.lineTo(xm, y2); ctx.stroke(); tri(ctx, xm, y2 + 2, 1); }
  }
  function tri(ctx, x, y, down) {
    ctx.beginPath();
    if (down) { ctx.moveTo(x - 5, y - 6); ctx.lineTo(x + 5, y - 6); ctx.lineTo(x, y); }
    else { ctx.moveTo(x - 6, y - 5); ctx.lineTo(x - 6, y + 5); ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fill();
  }

  /** Vẽ một làn lên canvas; trả về chỉ số ô đang lấp. */
  function drawLane(cv, L, p, t, compact) {
    if (!cv || !L.cur) return 0;
    var W = Math.max(260, Math.floor(cv.parentNode.clientWidth || 600)), dpr = root.devicePixelRatio || 1;
    var o = layoutLane(L, W, compact);
    if (cv._w !== W || cv._h !== o.H || cv._dpr !== dpr) {
      cv.style.height = o.H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(o.H * dpr);
      cv._w = W; cv._h = o.H; cv._dpr = dpr;
    }
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, o.H);
    ctx.textBaseline = 'alphabetic';
    var n0 = L.seq.items.length, head = p >= 1 ? n0 : Math.max(0, Math.min(n0, Math.floor(p * n0)));
    drawConveyor(ctx, L, o, p, head, t);
    drawFifo(ctx, L, o, p, head);
    drawArrow(ctx, o);
    drawCells(ctx, L, o, p, head, t);
    return head;
  }

  // ---------- DOM theo khung (Minh hoạ) ----------
  function captionOf(L) {
    var P = L.P, r = L.cur, m = P.method, u = unitName(P);
    if (isJust(m)) {
      var jn = m === 'PDH-BIT' ? 'Cj' : 'JC';
      return jn + ' = <b>' + esc(r.jc) + '</b> · ' + r.opp.map(function (q) { return q.key.toUpperCase() + ' ' + (q.data ? '<span class="sim-k-jdata">dữ liệu</span>' : '<span class="sim-k-jstuff">chèn</span>'); }).join(' · ') +
        ' · khung mang <b>' + fmtN(r.units, 0) + '</b> ' + u + ' (danh định ' + fmtN(r.nominal, 0) + (r.delta ? ', ' + (r.delta > 0 ? '+' : '−') + Math.abs(r.delta) : '') + ')' +
        (P.locked ? ' · <i>BMP: đồng hồ server suy từ client → bộ đệm đứng yên, không bao giờ bù.</i>' : '');
    }
    if (m === 'GMP') return 'Cm = <b>' + r.cm + '</b>' + (r.change ? ' (' + (r.change > 0 ? '+' : '−') + Math.abs(r.change) + ')' : '') + ' từ dữ liệu, ' + (P.Pw - r.cm) + ' từ chèn trên P = ' + P.Pw + (P.wb > 1 ? ' (từ ' + P.wb + ' byte)' : '') + '.';
    if (m === 'GFP-F') return '<b>' + r.frames + '</b> khung GFP xong · Idle <b>' + fmtN(r.idle, 0) + '</b> B (' + fmtN(r.idlePct, 0) + ' %) · hàng đợi ' + fmtN(r.q1, 0) + '/' + fmtN(r.bufMax, 0) + ' B' + (r.drops ? ' · <span class="sim-k-bad">đã rớt ' + r.drops + ' khung</span>' : '');
    if (m === 'IMP') return '<b>' + r.blocks + '</b> chỗ khối · ' + r.data + ' khối gói · Idle <span class="sim-k-jdata">xoá ' + r.del + '</span> / <span class="sim-k-bins">chèn ' + r.ins + '</span> · bộ đệm ' + r.buffer + ' (mục tiêu ' + P.impTarget + ')';
    return '';
  }
  function logHtml(log, max) {
    return log.slice(0, max || 40).map(function (e) { return '<li' + (e.kind ? ' class="lk-' + e.kind + '"' : '') + '>' + esc(e.text) + '</li>'; }).join('');
  }
  function renderToyDom() {
    if (sv.page === 'compare') {
      sv.lanes.forEach(function (L, i) {
        var st = $('#view-sim [data-lane-st="' + i + '"]'), lg = $('#view-sim [data-lane-log="' + i + '"]');
        if (st) st.innerHTML = captionOf(L);
        if (lg) lg.innerHTML = logHtml(L.log, 4);
      });
      var fn = $('#view-sim [data-sim="frameno"]'); if (fn && sv.lanes[0]) fn.textContent = 'khung #' + sv.lanes[0].cur.k;
      return;
    }
    var L = sv.lanes[0];
    sv.S = L.S; sv.P = L.P;
    renderStats(L.cur);
    drawHist();
    renderLegend(L.cur.cells, true);
    var c = $('#view-sim [data-sim="caption"]'); if (c) c.innerHTML = captionOf(L);
    var lg2 = $('#view-sim [data-sim="log"]'); if (lg2) lg2.innerHTML = logHtml(L.log);
  }
  /** GMP: phép tính sigma-delta cho ô đang được lấp. */
  function updateSd(L, head) {
    var el = $('#view-sim [data-sim="sd"]');
    if (!el || !L.seq) return;
    // ô đang lấp; nếu là ô OH thì lấy ô vùng tải kế tiếp (sigma-delta chỉ áp cho vùng tải)
    var items = L.seq.items, i = Math.min(head, items.length - 1), k;
    for (k = i; k < items.length && items[k].j == null; k++);
    if (k >= items.length) for (k = i; k > 0 && items[k].j == null; k--);
    var it = items[k], key = L.cur.k + ':' + (it && it.j);
    if (key === sv.sdKey) return;
    sv.sdKey = key;
    if (!it || it.j == null) { el.textContent = ''; return; }
    var Cm = L.cur.cm, Pw = L.P.Pw, v = (it.j * Cm) % Pw;
    el.textContent = 'Ô đang lấp: từ j = ' + it.j + ' → (' + it.j + ' × ' + Cm + ') mod ' + Pw + ' = ' + v + (v < Cm ? ' < ' + Cm + ' → DỮ LIỆU' : ' ≥ ' + Cm + ' → CHÈN');
  }

  function drawToy(t) {
    var p = Math.min(1, sv.anim.p / FILL_PART);
    if (sv.page === 'compare') {
      sv.lanes.forEach(function (L, i) { drawLane($('#view-sim [data-lane-cv="' + i + '"]'), L, p, t, true); });
      return;
    }
    var L = sv.lanes[0], head = drawLane($('#view-sim [data-sim="stage"]'), L, p, t, false);
    if (L.P.method === 'GMP') updateSd(L, head);
  }

  // ---------- vòng hoạt ảnh (Minh hoạ) ----------
  function loop(t) {
    sv.raf = 0;
    if (!sv.active || (sv.page === 'one' && sv.mode === 'real')) return;
    var A = sv.anim;
    if (A.playing) {
      var p = (t - A.t0) / sv.st.dur;
      if (p >= 1) {
        if (sv.running) { advanceAll(); A.t0 = t; p = 0; }
        else { p = 1; A.playing = false; }
      }
      A.p = p;
    }
    drawToy(t);
    if (A.playing) sv.raf = requestAnimationFrame(loop);
  }
  function requestDraw() { if (!sv.raf && sv.active) sv.raf = requestAnimationFrame(loop); }
  function toyParams() { return sv.page === 'compare' ? { ppmC: +sv.st.cmpPpm || 0, ppmS: 0 } : params(); }
  function advanceAll() {
    var o = toyParams();
    sv.lanes.forEach(function (L) { laneAdvance(L, o); });
    renderToyDom();
  }
  function resetToy() {
    sv.lanes.forEach(laneReset);
    advanceAll();
    sv.anim = { p: 1, t0: 0, playing: false };
    sv.sdKey = '';
    requestDraw();
  }

  // =====================================================================
  // Chế độ Thực tế (lưới thật thu nhỏ, kính lúp)
  // =====================================================================
  function gridDims() { return { rows: sv.P.dRows, cols: sv.P.cols }; }

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
    var z = zoomRange(d);
    ctx.strokeStyle = C.text; ctx.lineWidth = 2;
    ctx.strokeRect(z.c0 / d.cols * cssW, z.r * rh + 1, Math.max(3, z.len / d.cols * cssW), rh - 2);
    $('#view-sim [data-sim="axis"]').textContent = axisText(d, bw, unitName(sv.P));
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
      var col = v > 0 ? (m === 'IMP' ? C[T.BINS] : C[T.JDATA]) : v < 0 ? (m === 'IMP' ? C[T.JDATA] : C[T.JSTUFF]) : C[T.DATA];
      var hh2 = v ? Math.max(3, Math.abs(v) / maxAbs * (h / 2 - 3)) : 2;
      ctx.fillStyle = col; ctx.fillRect(x + 1, v >= 0 ? mid - hh2 : mid, w - 2, hh2);
    });
    var lbl = { AMP: 'Dòng thời gian 64 khung: cột lên = thêm 1 byte dữ liệu (chèn âm), cột xuống = bớt 1 byte (chèn dương), vạch giữa = bình thường.',
      BMP: 'Dòng thời gian: BMP không bù — luôn ở vạch giữa.', GMP: 'Dòng thời gian: Cm − Cm danh định (làm tròn) mỗi khung.',
      'GFP-F': 'Dòng thời gian: % vùng tải mang dữ liệu Ethernet mỗi khung (phần còn lại là header + Idle).',
      IMP: 'Dòng thời gian: cột lên = chèn khối Idle, cột xuống = xoá khối Idle của client.', 'PDH-BIT': 'Dòng thời gian: cột xuống = bit cơ hội chèn là bit chèn (Cj = 111).' }[m];
    $('#view-sim [data-sim="tlabel"]').textContent = lbl || '';
  }

  function stat(label, value, sub, cls) {
    return '<div class="stat' + (cls ? ' ' + cls : '') + '"><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + value + '</div>' + (sub ? '<div class="stat-sub">' + sub + '</div>' : '') + '</div>';
  }

  function renderStats(res) {
    var P = sv.P, S = sv.S, m = P.method, u = unitName(P), h = '';
    var dev = S.cumSent - S.cumNom;
    if (isJust(m)) {
      h += stat(u + (P.tributaries ? ' nhánh 1' : ' client') + ' / khung', esc(n(res.units, 0)), 'danh định ' + esc(n(P.n0, 0)) + (res.delta ? ' (' + (res.delta > 0 ? '+' : '') + res.delta + ')' : '')) +
        stat((m === 'PDH-BIT' ? 'Cj' : 'JC') + ' khung này', '<code>' + esc(res.jc || '–') + '</code>', esc(res.entry && res.entry.meaning || '')) +
        stat('Chèn dương / âm', esc(S.plus) + ' / ' + esc(S.minus), 'tổng từ khi chạy') +
        stat('Lệch tích luỹ', (dev > 0 ? '+' : '') + esc(n(dev, 0)) + ' ' + u, 'so với ' + esc(n(P.n0, 0)) + ' × ' + S.k + ' khung') +
        stat('Bộ đệm', esc(n(res.lvl1, 2)) + ' ' + u, res.outOfRange ? '<span class="vcg-bad">vượt khả năng bù!</span>' : P.locked ? 'đứng yên (BMP)' : 'ngưỡng ' + esc(n(res.lo, 0)) + ' … ' + esc(n(res.hi, 0)));
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
    var st = $('#view-sim [data-sim="stats"]'); if (st) st.innerHTML = h;
    var fn = $('#view-sim [data-sim="frameno"]');
    if (fn) fn.textContent = (P.mf > 1 ? 'đa khung #' : 'khung #') + S.k + (P.periodUs ? ' · chu kỳ thật ' + n(P.periodUs, 3) + ' µs' : '');
    var gc = $('#view-sim [data-sim="gridcap"]');
    if (gc) gc.textContent = n(m === 'IMP' ? P.blocksExact : P.cap, m === 'IMP' && !P.toy ? 2 : 0) + ' ' + u + ' tải mỗi khung' + (P.toy ? ' (đồ chơi)' : '');
  }

  /** Ô OH (JC, NJO, Cm…) — vài phần tử DOM bên trái lưới (chế độ Thực tế). */
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

  function renderLegend(cells, toy) {
    var c = countTypes(cells), u = unitName(sv.P), m = sv.P.method;
    var extra = toy ? (isJust(m) || m === 'GMP' ? '<li class="sim-legnote"><span class="swatch sim-sw" style="background:' + esc(sv.colors[T.DATA]) + '"></span><span class="swatch sim-sw" style="background:' + esc(sv.colors[T.DATA2]) + '"></span> hai sắc xanh đổi mỗi 4 ' + u + ' client (số nhỏ = thứ tự ' + u + ') — để thấy dòng chảy từ băng chuyền vào khung</li>' :
      m === 'GFP-F' || m === 'IMP' ? '<li class="sim-legnote">' + sv.colors.f.map(function (x) { return '<span class="swatch sim-sw" style="background:' + esc(x) + '"></span>'; }).join('') + ' mỗi ' + (m === 'IMP' ? 'gói (Pn)' : 'khung Ethernet (#n)') + ' một màu, viền đậm bao quanh</li>' : '') : '';
    $('#view-sim [data-sim="legend"]').innerHTML = TYPE_INFO.map(function (t, i) {
      if (!c[i] && !legendAlways(i)) return '';
      if (toy && (i === T.DATA2 || (i === T.DATA && (m === 'GFP-F'))) ) return '';
      return '<li><span class="swatch sim-sw" style="background:' + esc(sv.colors[i]) + '"></span> ' + esc(t.name) + ': <b>' + esc(n(c[i], 0)) + '</b> ' + u + '</li>';
    }).join('') + extra;
  }
  function legendAlways(i) {
    var m = sv.P.method;
    if (isJust(m)) return i === T.DATA || i === T.JDATA || i === T.JSTUFF;
    if (m === 'GMP') return i === T.DATA || i === T.GSTUFF;
    if (m === 'GFP-F') return i === T.DATA || i === T.GFPH || i === T.GIDLE;
    if (m === 'IMP') return i === T.BDATA || i === T.BIDLE || i === T.BINS;
    return false;
  }

  function paintReal() {
    if (!sv.last || !sv.active || sv.mode !== 'real' || sv.page !== 'one') return;
    drawGrid(sv.last.cells); drawZoom(sv.last.cells); drawHist();
    renderStats(sv.last); renderOh(sv.last); renderLegend(sv.last.cells, false);
    var lg = $('#view-sim [data-sim="log"]'); if (lg) lg.innerHTML = logHtml(sv.realLog, 20);
  }
  function tickReal() {
    if (!sv.active || !sv.S) return;
    sv.last = step(sv.S, params());
    sv.realLog.unshift({ text: describe(sv.P, sv.last), kind: logKind(sv.P, sv.last) });
    if (sv.realLog.length > 20) sv.realLog.pop();
    if (root.requestAnimationFrame) root.requestAnimationFrame(paintReal); else paintReal();
  }
  function resetReal() {
    sv.S = create(sv.P, 12345);
    sv.realLog = [];
    tickReal();
  }

  // ---------- chạy / dừng ----------
  function isReal() { return sv.page === 'one' && sv.mode === 'real'; }
  function setRunning(on) {
    sv.running = !!on && sv.active;
    if (sv.timer) { clearInterval(sv.timer); sv.timer = null; }
    if (isReal()) { if (sv.running) sv.timer = setInterval(tickReal, 1000 / sv.st.fps); }
    else if (sv.running) {
      var A = sv.anim;
      if (!A.playing) { A.playing = true; A.t0 = now() - (A.p >= 1 ? sv.st.dur : A.p * sv.st.dur); }
      requestDraw();
    } else sv.anim.playing = false;
    var b = $('#view-sim [data-sact="run"]');
    if (b) { b.textContent = sv.running ? '⏸ Dừng' : '▶ Chạy'; b.setAttribute('aria-pressed', String(sv.running)); b.classList.toggle('is-on', sv.running); }
  }
  function stopAll() {
    sv.running = false;
    if (sv.timer) { clearInterval(sv.timer); sv.timer = null; }
    if (sv.raf) { cancelAnimationFrame(sv.raf); sv.raf = 0; }
    sv.anim.playing = false;
  }
  function stepOnce() {
    setRunning(false);
    if (isReal()) { tickReal(); return; }
    advanceAll();
    sv.anim.p = 0; sv.anim.t0 = now(); sv.anim.playing = true;
    requestDraw();
  }

  // ---------- sự kiện ----------
  function onClick(e) {
    if (!sv.active) return;
    var b = e.target.closest && e.target.closest('[data-sact]');
    if (b) {
      var a = b.getAttribute('data-sact');
      if (a === 'run') setRunning(!sv.running);
      else if (a === 'step') stepOnce();
      else if (a === 'reset') { var was = sv.running; setRunning(false); if (isReal()) resetReal(); else resetToy(); if (was) setRunning(true); }
      else if (a === 'mode') { var md = b.getAttribute('data-mode'); if (md !== sv.mode) { sv.st.mode = md; sSet(); show(sv.id); } }
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
      paintReal();
    }
  }
  function onInput(e) {
    if (!sv.active) return;
    var el = e.target, k = el.getAttribute && el.getAttribute('data-sin');
    if (!k) return;
    if (k === 'fps') { sv.st.fps = +el.value; sSet(); if (sv.timer) setRunning(true); return; }
    if (k === 'dur') { var p0 = sv.anim.p; sv.st.dur = +el.value; sSet(); if (sv.anim.playing) sv.anim.t0 = now() - p0 * sv.st.dur; return; }
    if (k === 'zoom') { sv.zoom = +el.value / 1000; paintReal(); return; }
    if (k === 'cmpPpm') { sv.st.cmpPpm = +el.value; var oc = $('#view-sim [data-sval="cmpPpm"]'); if (oc) oc.textContent = fmtSigned(k, sv.st.cmpPpm); sSet(); return; }
    var p = params();
    if (k === 'size') p.size = el.value === 'mix' ? 'mix' : +el.value;
    else { p[k] = +el.value; var o = $('#view-sim [data-sval="' + k + '"]'); if (o) o.textContent = fmtSigned(k, p[k]); }
    sSet();
    updatePpmFx();
    if (isReal() && !sv.timer) tickReal(); // đang dừng: chạy một khung để thấy ngay tác dụng
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
  function redraw() {
    if (!sv.active) return;
    if (isReal()) paintReal();
    else { var cvs = document.querySelectorAll('#view-sim canvas'); for (var i = 0; i < cvs.length; i++) cvs[i]._w = 0; if (sv.page === 'one') renderToyDom(); requestDraw(); }
  }
  function init() {
    var v = document.getElementById('view-sim');
    if (!v) throw new Error('Thiếu #view-sim trong index.html');
    v.addEventListener('click', onClick);
    v.addEventListener('input', onInput);
    v.addEventListener('change', onInput);
    var rt = null;
    root.addEventListener('resize', function () { if (!sv.active) return; clearTimeout(rt); rt = setTimeout(redraw, 120); });
    if (root.matchMedia) {
      var mq = root.matchMedia('(prefers-color-scheme: dark)');
      var re = function () { if (sv.active) { readColors(); lumCache = {}; redraw(); } };
      if (mq.addEventListener) mq.addEventListener('change', re);
    }
    // đổi giao diện sáng/tối bằng nút → đọc lại màu
    document.addEventListener('click', function (e) { if (sv.active && e.target.closest && e.target.closest('#theme-btn')) setTimeout(function () { readColors(); lumCache = {}; redraw(); }, 0); });
    // tab ẩn → dừng vẽ (rAF tự dừng); quay lại → vẽ tiếp
    document.addEventListener('visibilitychange', function () { if (sv.active && !document.hidden && !isReal()) { if (sv.anim.playing) sv.anim.t0 = now() - sv.anim.p * sv.st.dur; requestDraw(); } });
  }
  function show(id) {
    stopAll();
    sv.active = true;
    sv.st = sv.st || loadSt();
    if (id === 'compare' && compareSet()) {
      sv.page = 'compare'; sv.id = 'compare'; sv.sc = null;
      sv.lanes = compareSet().map(makeLane);
      sv.P = sv.lanes[0].P; sv.S = sv.lanes[0].S;
      buildCompare();
      resetToy();
      if (!reducedMotion()) setRunning(true);
      return;
    }
    var sc = byId(id) || sortedMaps()[0];
    if (!sc) { $('#view-sim').innerHTML = '<p class="muted">Chưa có dữ liệu ánh xạ (data/transport-mapping.js).</p>'; return; }
    sv.page = 'one';
    if (sv.id !== sc.id || !sv.realP) { sv.realP = prep(sc); sv.zoom = defaultZoom(sv.realP); }
    sv.id = sc.id; sv.sc = sc;
    sv.st.last = sc.id; sSet();
    sv.mode = sv.st.mode;
    if (sv.mode === 'real') {
      sv.lanes = []; sv.P = sv.realP;
      build(); resetReal();
    } else {
      sv.lanes = [makeLane(sc)]; sv.P = sv.lanes[0].P; sv.S = sv.lanes[0].S;
      build(); resetToy();
      if (!reducedMotion()) setRunning(true);
    }
  }
  function hide() { sv.active = false; stopAll(); }
  function items() {
    var list = sortedMaps().map(function (x) { return { id: x.id, name: x.name || x.id, method: methodOf(x) === 'PDH-BIT' ? 'PDH' : methodOf(x), hint: x.summary || '' }; });
    if (compareSet()) list.unshift({ id: 'compare', name: 'So sánh AMP · BMP · GMP', method: 'SO SÁNH', hint: 'Ba bộ ghép chạy song song cùng độ lệch clock' });
    return list;
  }

  root.MapSimView = { init: init, show: show, hide: hide, items: items, _state: sv };
})(typeof window !== 'undefined' ? window : globalThis);
