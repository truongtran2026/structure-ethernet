/*
 * tmodel.js — phần TÍNH TOÁN thuần cho mảng Truyền dẫn (không đụng DOM).
 *  1) Khung 2 chiều: làm phẳng cây region, tô ô, xác định vùng hiển thị theo trạng thái thu gọn,
 *     nén cột, gộp ô thành khối chữ nhật để vẽ.
 *  2) Logic phòng thí nghiệm ghép kênh: cây đơn vị theo TMUX.accepts, thả/lấp/kế toán overhead.
 * Xuất window.TransViz và module.exports (để test bằng Node).
 */
(function (root) {
  'use strict';

  var PAYLOAD_KINDS = { payload: true, tributary: true };
  var KIND_LABEL = {
    fas: 'Đồng bộ khung', soh: 'Section overhead', pointer: 'Con trỏ', poh: 'Path overhead',
    'opu-oh': 'Payload overhead', payload: 'Tải tin', stuff: 'Chèn cố định', fec: 'FEC',
    reserved: 'Dự trữ', tributary: 'Nhánh con'
  };

  // ---------- số & định dạng ----------
  /** Số kiểu Việt Nam: phân cách nghìn bằng khoảng trắng hẹp, thập phân bằng dấu phẩy. */
  function fmtNum(n, maxDec) {
    if (n == null || isNaN(n)) return '–';
    var d = maxDec == null ? 3 : maxDec;
    var s = Number(n).toFixed(d);
    if (d > 0) s = s.replace(/\.?0+$/, '');
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  }
  function fmtRate(kbps) {
    if (kbps == null) return '–';
    if (kbps >= 1e6) return fmtNum(kbps / 1e6, 3) + ' Gbit/s';
    if (kbps >= 1000) return fmtNum(kbps / 1000, 3) + ' Mbit/s';
    return fmtNum(kbps, 3) + ' kbit/s';
  }

  // ---------- khung 2 chiều ----------
  function rectCells(rect, cols) {
    var out = [], step = rect.step || 1;
    for (var i = 0; i < rect.h; i++)
      for (var j = 0; j < rect.w; j++) out.push((rect.r + i) * cols + rect.c + j * step);
    return out;
  }

  /** Mô tả vị trí rect (1-based như ITU-T). */
  function rectText(rect) {
    if (!rect) return '';
    var step = rect.step || 1;
    var rows = rect.h === 1 ? 'hàng ' + (rect.r + 1) : 'hàng ' + (rect.r + 1) + '–' + (rect.r + rect.h);
    var c0 = rect.c + 1, cl = rect.c + (rect.w - 1) * step + 1, cols;
    if (rect.w === 1) cols = 'cột ' + c0;
    else if (step === 1) cols = 'cột ' + c0 + '–' + cl;
    else cols = 'cột ' + c0 + ', ' + (c0 + step) + (rect.w > 2 ? ', … ' + cl : '') + ' (' + rect.w + ' cột, bước ' + step + ')';
    return rows + ', ' + cols;
  }

  /**
   * Làm phẳng cây region (preorder: cha đứng trước con) và tô ô lá.
   * Trả về { frame, rows, cols, list[], byId{}, leafOwner Int32Array, maxDepth, stats, errors[] }.
   */
  function buildFrame(frame) {
    var g = frame.grid || {};
    var rows = g.rows | 0, cols = g.cols | 0, cellBits = g.cellBits || 8;
    var total = rows * cols;
    var list = [], byId = {}, errors = [];
    var leafOwner = new Int32Array(total);
    for (var i = 0; i < total; i++) leafOwner[i] = -1;
    var maxDepth = 0;

    (function walk(regions, parent, depth) {
      (regions || []).forEach(function (rg) {
        if (!rg || !rg.rect) { errors.push('Region thiếu rect: ' + (rg && rg.id)); return; }
        var idx = list.length;
        var n = rg.rect.h * rg.rect.w;
        var node = {
          idx: idx, id: rg.id, region: rg, parent: parent, depth: depth, children: [],
          cells: n, bits: n * cellBits, bytes: n * cellBits / 8,
          kbps: n * cellBits * 1000 / frame.periodUs,
          kind: rg.kind, abbr: rg.abbr || rg.name || rg.id, name: rg.name || rg.abbr || rg.id
        };
        list.push(node);
        if (byId[rg.id]) errors.push('Trùng id region: ' + rg.id);
        byId[rg.id] = node;
        if (parent >= 0) list[parent].children.push(idx);
        if (rg.children && rg.children.length) {
          maxDepth = Math.max(maxDepth, depth + 1);
          walk(rg.children, idx, depth + 1);
        } else {
          var step = rg.rect.step || 1;
          for (var a = 0; a < rg.rect.h; a++) {
            var r = rg.rect.r + a;
            if (r >= rows) continue;
            for (var b = 0; b < rg.rect.w; b++) {
              var c = rg.rect.c + b * step;
              if (c >= cols) continue;
              leafOwner[r * cols + c] = idx;
            }
          }
        }
      });
    })(frame.regions, -1, 0);

    var uncovered = 0, ohCells = 0;
    for (var k = 0; k < total; k++) {
      var o = leafOwner[k];
      if (o < 0) { uncovered++; continue; }
      if (!PAYLOAD_KINDS[list[o].kind]) ohCells++;
    }
    if (uncovered) errors.push(uncovered + ' ô không thuộc region nào');
    var bytes = total * cellBits / 8;
    return {
      frame: frame, rows: rows, cols: cols, cellBits: cellBits, list: list, byId: byId,
      leafOwner: leafOwner, maxDepth: maxDepth, errors: errors,
      stats: {
        rows: rows, cols: cols, cells: total, bytes: bytes, bits: total * cellBits, cellBits: cellBits,
        periodUs: frame.periodUs, rateKbps: frame.rateKbps,
        overheadCells: ohCells, overheadBytes: ohCells * cellBits / 8,
        overheadPct: total ? ohCells / total * 100 : 0
      }
    };
  }

  /** Chuỗi tổ tiên (gồm chính nó) của region idx, từ gốc xuống. */
  function ancestry(fm, idx) {
    var out = [];
    while (idx >= 0) { out.unshift(idx); idx = fm.list[idx].parent; }
    return out;
  }

  /**
   * Region đại diện của từng region khi vẽ: chính nó nếu mọi tổ tiên đang mở,
   * ngược lại là tổ tiên cao nhất đang thu gọn. isOpen(node) → bool.
   */
  function displayMap(fm, isOpen) {
    var disp = new Int32Array(fm.list.length);
    fm.list.forEach(function (n) {
      var p = n.parent;
      if (p < 0) disp[n.idx] = n.idx;
      else if (disp[p] !== p) disp[n.idx] = disp[p];
      else disp[n.idx] = isOpen(fm.list[p]) ? n.idx : p;
    });
    return disp;
  }

  /** Mảng ô → region hiển thị. */
  function displayCells(fm, isOpen) {
    var disp = displayMap(fm, isOpen);
    var out = new Int32Array(fm.leafOwner.length);
    for (var i = 0; i < out.length; i++) out[i] = fm.leafOwner[i] < 0 ? -1 : disp[fm.leafOwner[i]];
    return out;
  }

  /**
   * Cột hiển thị. compress=true: các cột liên tiếp có cùng region hiển thị ở MỌI hàng gộp thành
   * một dải { c0, c1, band:true }; dải có c0 trong `expanded` thì trải ra từng cột.
   */
  function columnRuns(fm, cells, compress, expanded, minRun) {
    var rows = fm.rows, cols = fm.cols, out = [];
    minRun = minRun || 3;
    function same(a, b) {
      for (var r = 0; r < rows; r++) if (cells[r * cols + a] !== cells[r * cols + b]) return false;
      return true;
    }
    var c = 0, plain = [];
    while (c < cols) {
      var e = c;
      if (compress) while (e + 1 < cols && same(c, e + 1)) e++;
      var len = e - c + 1;
      if (compress && len >= minRun && !(expanded && expanded[c])) out.push({ c0: c, c1: e, band: true });
      else for (var k = c; k <= e; k++) out.push({ c0: k, c1: k, band: false, runStart: len >= minRun ? c : null });
      c = e + 1;
    }
    if (!compress) return out;
    // Nén theo CHU KỲ: đoạn dài các cột ghép xen (TS #1…#8 lặp lại mỗi 8 cột) → giữ chu kỳ đầu,
    // phần lặp lại gộp thành một dải { band, period }. Chỉ xét đoạn cột đơn ≥ PERIODIC_MIN_SEG.
    var res = [], i = 0;
    while (i < out.length) {
      if (out[i].band) { res.push(out[i]); i++; continue; }
      var j = i;
      while (j < out.length && !out[j].band && out[j].runStart == null) j++;
      if (j - i < PERIODIC_MIN_SEG) { for (; i < j; i++) res.push(out[i]); if (i < out.length && !out[i].band && out[i].runStart != null) res.push(out[i++]); continue; }
      periodic(out[i].c0, out[j - 1].c1, res);
      i = j;
    }
    return res;

    function periodic(s, e, dst) {
      var x = s;
      while (x <= e) {
        var best = null;
        for (var p = 2; p <= PERIODIC_MAX && x + p * PERIODIC_MIN_REPS - 1 <= e; p++) {
          var y = x + p;
          while (y <= e && same(y, y - p)) y++;
          var L = Math.floor((y - x - p) / p) * p; // phần lặp lại, tròn chu kỳ
          if (L >= p * (PERIODIC_MIN_REPS - 1) && (!best || L > best.L)) best = { p: p, L: L };
        }
        if (best && !(expanded && expanded[x + best.p])) {
          for (var q = 0; q < best.p; q++) dst.push({ c0: x + q, c1: x + q, band: false, runStart: null });
          dst.push({ c0: x + best.p, c1: x + best.p + best.L - 1, band: true, period: best.p });
          x += best.p + best.L;
        } else if (best) {
          // dải chu kỳ đang được bung: trải từng cột, cột đầu phần lặp mang runStart để nén lại
          for (var q2 = 0; q2 < best.p + best.L; q2++) dst.push({ c0: x + q2, c1: x + q2, band: false, runStart: q2 === best.p ? x + best.p : null });
          x += best.p + best.L;
        } else { dst.push({ c0: x, c1: x, band: false, runStart: null }); x++; }
      }
    }
  }
  var PERIODIC_MIN_SEG = 64, PERIODIC_MAX = 96, PERIODIC_MIN_REPS = 4;

  /**
   * Gộp ô cùng region thành khối chữ nhật (tham lam theo hàng rồi cột) trên lưới cột hiển thị.
   * Trả về [{ r, dc, h, w, owner }] — dc là chỉ số cột hiển thị.
   */
  function mergePieces(fm, cells, dcols) {
    var rows = fm.rows, W = dcols.length, cols = fm.cols;
    var own = new Int32Array(rows * W), seen = new Uint8Array(rows * W);
    for (var r = 0; r < rows; r++) for (var d = 0; d < W; d++) own[r * W + d] = cells[r * cols + dcols[d].c0];
    var out = [];
    for (var r2 = 0; r2 < rows; r2++) {
      for (var d2 = 0; d2 < W; d2++) {
        var i = r2 * W + d2;
        if (seen[i]) continue;
        var o = own[i], w = 1, h = 1;
        while (d2 + w < W && !seen[i + w] && own[i + w] === o) w++;
        grow: while (r2 + h < rows) {
          for (var x = 0; x < w; x++) {
            var j = (r2 + h) * W + d2 + x;
            if (seen[j] || own[j] !== o) break grow;
          }
          h++;
        }
        for (var y = 0; y < h; y++) for (var x2 = 0; x2 < w; x2++) seen[(r2 + y) * W + d2 + x2] = 1;
        out.push({ r: r2, dc: d2, h: h, w: w, owner: o });
      }
    }
    return out;
  }

  /** Tốc độ của một vùng gồm n ô. */
  function regionKbps(fm, node) { return node.kbps; }

  // ---------- nghĩa theo khung trong đa khung (Region.perFrame) ----------
  /** Phần tử perFrame áp cho khung k (0-based) của region, hoặc null. */
  function perFrameEntry(region, k) {
    if (k == null || !region || !region.perFrame) return null;
    for (var i = 0; i < region.perFrame.length; i++) {
      var p = region.perFrame[i];
      if (p && (p.frames || []).indexOf(k) >= 0) return p;
    }
    return null;
  }
  /** Nhãn/tên/mô tả/bitFields hiệu lực của region ở khung k (k null = chung, không theo khung). */
  function effRegion(region, k) {
    var p = perFrameEntry(region, k);
    return {
      abbr: (p && p.abbr) || region.abbr || region.name || region.id,
      name: (p && p.name) || region.name || region.abbr || region.id,
      desc: (p && p.desc) || region.desc,
      bitFields: (p && p.bitFields) || region.bitFields,
      values: (p && p.values) || region.values,
      pf: p
    };
  }
  /** Danh sách khung dùng perFrame của frame (rỗng nếu không có đa khung/perFrame). */
  function perFrameCount(fm) {
    var mf = fm.frame.multiframe;
    if (!mf || !(mf.frames > 1)) return 0;
    return fm.list.some(function (n) { return n.region.perFrame && n.region.perFrame.length; }) ? mf.frames : 0;
  }

  // =====================================================================
  //  Logic phòng thí nghiệm ghép kênh (cây đơn vị theo TMUX.accepts)
  // =====================================================================
  // Node: { u: unitId, opt: số thứ tự phương án accepts (-1 = chưa chọn), kids: [Node|null] }
  // Client: đơn vị không có accepts, HOẶC đơn vị leafOk (PDH: E1/E2/E3/E4) đang để "nguyên khối" (opt < 0).
  // Kế toán theo kbit/s xuyên suốt (đơn vị SDH: byte/125 µs × 64).
  //
  // Quy tắc "tự mở": khi tự dựng chuỗi trung gian, một đơn vị leafOk chỉ được tự mở ra (đi xuyên qua nó)
  // nếu cha của nó cũng leafOk (bên trong cây PDH), cha CÙNG family (ghép nội bộ một phân cấp: ODUk trong
  // OTUk / trong bể TS của OPU) hoặc nó là vị trí người dùng chỉ định. Tín hiệu của phân cấp khác ánh xạ vào
  // (E1 trong C-12, STM-16 trong OPU1) là client nguyên khối, không tự mở. Nhờ vậy thả E1 vào STM-1 vẫn đi
  // C-12 → VC-12 → TU-12 (không đi vòng C-4 → E4 → E3 → E2 → E1), trong lab PDH thả E1 vào E4 tự dựng
  // E3 → E2 → E1, còn thả STM-16 vào OTU3 đi ODU3 → OPU3 (TS) → ODU1 → OPU1 → STM-16.
  //
  // Bể tributary slot (OTN): unit có `tribSlots` + các phương án có `slots` gộp thành MỘT lựa chọn
  // "ghép TS" (opt = 'ts'). Node chế độ TS: { u, opt: 'ts', kids: [Node] } — kids dài thay đổi, không có
  // null; mỗi con có thêm `ts: [chỉ số TS 0-based]` (cấp TS trống thấp nhất, không cần liền kề) và loại
  // con = con.u (phương án tương ứng = phương án có slots với of === con.u).

  function hasAcc(u) { return !!(u && u.accepts && u.accepts.length); }
  function isTs(n) { return !!n && n.opt === 'ts'; }
  /** Đã chọn phương án (số hoặc 'ts'). */
  function chosen(n) { return !!n && (n.opt === 'ts' || n.opt >= 0); }
  /** Các phương án có slots của đơn vị: [{ i, a }] (rỗng nếu không có bể TS). */
  function slotOpts(MUX, uid) {
    var u = MUX[uid];
    if (!u || !u.tribSlots || !u.accepts) return [];
    var out = [];
    u.accepts.forEach(function (a, i) { if (a.slots) out.push({ i: i, a: a }); });
    return out;
  }
  function hasPool(MUX, uid) { return slotOpts(MUX, uid).length > 0; }
  /** Các lựa chọn hiển thị của đơn vị: chỉ số phương án không có slots, rồi 'ts' nếu có bể TS. */
  function choices(MUX, uid) {
    var u = MUX[uid];
    if (!hasAcc(u)) return [];
    var out = [];
    var pool = hasPool(MUX, uid);
    u.accepts.forEach(function (a, i) { if (!(pool && a.slots)) out.push(i); });
    if (pool) out.push('ts');
    return out;
  }
  /** Thông tin bể TS: { n, kbps (mỗi TS), size, note, capKbps, outsideKbps (dung lượng ngoài TS) }. */
  function poolInfo(MUX, uid) {
    var u = MUX[uid], t = u && u.tribSlots;
    if (!t) return null;
    var total = unitKbps(MUX, uid);
    var each = t.kbps || total / t.n;
    var out = total - t.n * each;
    return { n: t.n, kbps: each, size: t.size || '', note: t.note || '', capKbps: t.n * each, outsideKbps: out > 1e-6 ? out : 0 };
  }
  /** Phương án có slots ứng với loại con `of` trong bể TS của uid. */
  function slotOptFor(MUX, uid, of) {
    var s = slotOpts(MUX, uid).filter(function (x) { return x.a.of === of; })[0];
    return s ? s.a : null;
  }
  /** Chỉ số TS đã dùng trong node TS. */
  function tsUsed(n) {
    var used = {};
    (n.kids || []).forEach(function (k) { (k && k.ts || []).forEach(function (s) { used[s] = true; }); });
    return used;
  }
  function tsFree(MUX, n) {
    var p = poolInfo(MUX, n.u);
    return p ? p.n - Object.keys(tsUsed(n)).length : 0;
  }
  /** Cấp k TS trống thấp nhất (không cần liền kề); null nếu không đủ. */
  function allocTs(MUX, n, k) {
    var p = poolInfo(MUX, n.u), used = tsUsed(n), out = [];
    for (var s = 0; p && s < p.n && out.length < k; s++) if (!used[s]) out.push(s);
    return out.length === k ? out : null;
  }
  /** Phương án (đối tượng accepts) của một lựa chọn: số → accepts[i]; 'ts' → null. */
  function optObj(MUX, uid, opt) { return opt === 'ts' ? null : (MUX[uid] && MUX[uid].accepts && MUX[uid].accepts[opt]) || null; }
  /** Tốc độ con chiếm trong cha theo phương án a: carriedKbps (sau transcode) nếu con là client, ngược lại tốc độ con. */
  function childRate(MUX, a, node) {
    if (a && a.carriedKbps != null && isClient(MUX, a.of, node)) return a.carriedKbps;
    return unitKbps(MUX, a ? a.of : null);
  }
  function unitKbps(MUX, id) {
    var u = MUX[id];
    if (!u) return 0;
    return u.bytesPer125us != null ? u.bytesPer125us * 64 : (u.rateKbps || 0);
  }
  /** Kích thước theo byte/125 µs (đơn vị tốc độ: rateKbps / 64). */
  function unitBytes(MUX, id) { return unitKbps(MUX, id) / 64; }
  function isByteUnit(MUX, id) { return !!(MUX[id] && MUX[id].bytesPer125us != null); }
  /** Overhead của một phương án theo kbit/s (bytes × 64 hoặc kbps). */
  function ohKbps(a) {
    var o = a && a.overhead;
    if (!o) return 0;
    return o.bytes ? o.bytes * 64 : (o.kbps || 0);
  }
  /** Chuỗi overhead ngắn: "+9 B" hoặc "+256 kbit/s" ('' nếu không có). */
  function ohLabel(a) {
    var o = a && a.overhead;
    if (!o) return '';
    if (o.bytes) return '+' + fmtNum(o.bytes, 2) + ' B';
    if (o.kbps) return '+' + fmtNum(o.kbps, 3) + ' kbit/s';
    return '';
  }
  /**
   * Client? — node có thể bỏ trống (xét theo đơn vị): đơn vị không accepts → luôn client;
   * đơn vị leafOk → client khi node chưa chọn phương án (hoặc khi xét theo đơn vị, không node).
   */
  function isClient(MUX, id, node) {
    var u = MUX[id];
    if (!u) return false;
    if (!hasAcc(u)) return true;
    if (!u.leafOk) return false;
    return !node || node.opt < 0;
  }
  /** Đơn vị child có được tự mở ra (đi xuyên qua) khi nằm trong parent không. parent null = vị trí chỉ định. */
  function autoOpen(MUX, parentId, childId) {
    var c = MUX[childId];
    if (!c || !c.leafOk) return true;
    if (parentId == null) return true;
    var p = MUX[parentId];
    if (!p) return false;
    return !!p.leafOk || (!!p.family && p.family === c.family);
  }

  function memoOf(MUX, name) {
    if (!MUX[name]) Object.defineProperty(MUX, name, { value: {}, enumerable: false, configurable: true });
    return MUX[name];
  }
  /** Có đi được từ `from` (coi như đang mở) xuống `to` theo quy tắc tự mở không (from === to tính là có). */
  function reaches(MUX, from, to) {
    var memo = memoOf(MUX, '__reachMemo');
    var key = from + '>' + to;
    if (memo[key] != null) return memo[key];
    memo[key] = false; // chặn vòng lặp
    var ok = from === to;
    var u = MUX[from];
    if (!ok && u && u.accepts) ok = u.accepts.some(function (a) { return canReach(MUX, from, a.of, to); });
    memo[key] = ok;
    return ok;
  }
  /** Ô đơn vị `child` nằm trong `parent` có chứa được X không (chính nó là X, hoặc mở ra được và đi tới X). */
  function canReach(MUX, parentId, childId, X) {
    return childId === X || (autoOpen(MUX, parentId, childId) && reaches(MUX, childId, X));
  }
  /** Đi được về mặt cấu trúc (bỏ qua quy tắc tự mở) — dùng để giải thích. */
  function reachesFree(MUX, from, to) {
    var memo = memoOf(MUX, '__reachFreeMemo');
    var key = from + '>' + to;
    if (memo[key] != null) return memo[key];
    memo[key] = false;
    var ok = from === to;
    var u = MUX[from];
    if (!ok && u && u.accepts) ok = u.accepts.some(function (a) { return reachesFree(MUX, a.of, to); });
    memo[key] = ok;
    return ok;
  }
  /** Lựa chọn opt (số hoặc 'ts') của unitId có đi tới `to` không. */
  function optReaches(MUX, unitId, optIdx, to) {
    if (optIdx === 'ts') return slotOpts(MUX, unitId).some(function (s) { return canReach(MUX, unitId, s.a.of, to); });
    var a = MUX[unitId] && MUX[unitId].accepts && MUX[unitId].accepts[optIdx];
    return !!a && canReach(MUX, unitId, a.of, to);
  }
  /** Lựa chọn đầu tiên (theo thứ tự choices) đi tới X; -1 nếu không có. */
  function firstOpt(MUX, unitId, X) {
    var idx = -1;
    choices(MUX, unitId).some(function (c) { if (optReaches(MUX, unitId, c, X)) { idx = c; return true; } return false; });
    return idx;
  }

  /** Tạo node mới; một lựa chọn duy nhất (và không leafOk) → tự chọn; chuỗi 1×… tự dựng tiếp. */
  function newNode(MUX, unitId, noAuto) {
    var n = { u: unitId, opt: -1, kids: [] };
    var u = MUX[unitId];
    var ch = choices(MUX, unitId);
    if (!noAuto && u && !u.leafOk && ch.length === 1) setOptionNode(MUX, n, ch[0]);
    return n;
  }
  /** Node gốc của lab: gốc không bao giờ là client; một lựa chọn duy nhất → tự chọn. */
  function newRoot(MUX, unitId) {
    var n = newNode(MUX, unitId);
    var ch = choices(MUX, unitId);
    if (!chosen(n) && ch.length === 1) setOptionNode(MUX, n, ch[0]);
    return n;
  }
  function setOptionNode(MUX, n, idx) {
    if (idx === 'ts') { n.opt = 'ts'; n.kids = []; return n; } // bể TS: con thêm dần
    if (idx < 0) { n.opt = -1; n.kids = []; return n; } // về "nguyên khối"
    var a = MUX[n.u].accepts[idx];
    n.opt = idx;
    n.kids = [];
    for (var i = 0; i < a.count; i++) n.kids.push(null);
    // chuỗi bắt buộc 1×X (X không phải client) → dựng luôn để thấy cây ô trống
    if (a.count === 1 && !isClient(MUX, a.of)) n.kids[0] = newNode(MUX, a.of);
    return n;
  }

  function getNode(tree, path) {
    var n = tree;
    for (var i = 0; i < path.length; i++) { if (!n) return null; n = n.kids[path[i]]; }
    return n;
  }
  /** Đơn vị mà vị trí path phải chứa (kể cả ô trống). */
  function slotUnit(MUX, tree, path) {
    if (!path.length) return tree.u;
    var parent = getNode(tree, path.slice(0, -1));
    if (isTs(parent)) { var k = parent.kids[path[path.length - 1]]; return k ? k.u : null; }
    var a = parent && parent.opt >= 0 && MUX[parent.u].accepts[parent.opt];
    return a ? a.of : null;
  }

  /** Chọn phương án idx (số hoặc 'ts') cho node ở path; idx = -1 → nguyên khối (chỉ đơn vị leafOk, không phải gốc). */
  function setOption(MUX, tree, path, idx) {
    var n = getNode(tree, path);
    if (!n || !MUX[n.u] || !MUX[n.u].accepts) return false;
    if (idx === 'ts') {
      if (!hasPool(MUX, n.u)) return false;
      setOptionNode(MUX, n, 'ts');
      return true;
    }
    if (idx < 0) {
      if (!MUX[n.u].leafOk || !path.length) return false;
      setOptionNode(MUX, n, -1);
      return true;
    }
    if (!MUX[n.u].accepts[idx]) return false;
    setOptionNode(MUX, n, idx);
    return true;
  }
  /** Ô trống → node (để chọn phương án trước khi thả). */
  function instantiate(MUX, tree, path) {
    if (!path.length) return tree;
    var parent = getNode(tree, path.slice(0, -1));
    var i = path[path.length - 1];
    if (!parent || parent.kids[i]) return parent && parent.kids[i];
    parent.kids[i] = newNode(MUX, slotUnit(MUX, tree, path));
    return parent.kids[i];
  }
  function remove(tree, path) {
    if (!path.length) return false;
    var parent = getNode(tree, path.slice(0, -1));
    if (!parent) return false;
    // trong bể TS: bỏ hẳn con (trả lại TS); nơi khác: để ô trống
    if (isTs(parent)) parent.kids.splice(path[path.length - 1], 1);
    else parent.kids[path[path.length - 1]] = null;
    return true;
  }

  /**
   * Phương án có slots của bể uid đi tới X, theo thứ tự ưu tiên: nhận trực tiếp X trước (ODUflex vào thẳng
   * TS, không đi vòng ODU2 → OPU2), rồi ít TS nhất (STM-16 qua ODU1 2 TS thay vì ODU2 8 TS).
   */
  function poolCandidates(MUX, uid, X) {
    return slotOpts(MUX, uid).filter(function (s) { return canReach(MUX, uid, s.a.of, X); })
      .sort(function (x, y) { return ((x.a.of === X ? 0 : 1) - (y.a.of === X ? 0 : 1)) || (x.a.slots - y.a.slots) || (x.i - y.i); });
  }

  /**
   * Bể TS: thêm một con mới chứa được X (phương án có slots đầu tiên đi tới X và còn đủ TS trống).
   * build(kid, isDirect) đặt X vào con mới (trả về giá trị truthy nếu thành công). Trả về { kid, idx, r } hoặc null.
   */
  function poolAdd(MUX, node, X, build) {
    var opts = poolCandidates(MUX, node.u, X);
    for (var j = 0; j < opts.length; j++) {
      var a = opts[j].a;
      var ts = allocTs(MUX, node, a.slots);
      if (!ts) continue;
      var kid = a.of === X ? newNode(MUX, X) : newNode(MUX, a.of, true);
      var idx = node.kids.length;
      var r = build(kid, a.of === X, idx);
      if (!r) continue;
      kid.ts = ts;
      node.kids.push(kid);
      return { kid: kid, idx: idx, r: r };
    }
    return null;
  }

  /**
   * Đặt một đơn vị X vào node (đệ quy, ô trống đầu tiên khả dụng). Tạo chuỗi trung gian khi cần.
   * canOpen: được mở node leafOk đang nguyên khối (node mới tạo / vị trí người dùng chỉ định).
   * Trả về đường dẫn tới node X vừa đặt, hoặc null.
   */
  function placeIn(MUX, node, X, path, canOpen) {
    var u = MUX[node.u];
    if (!hasAcc(u)) return null;
    if (!chosen(node)) {
      if (u.leafOk && !canOpen) return null; // client nguyên khối: không tự mở
      var idx = firstOpt(MUX, node.u, X);
      if (idx === -1) return null;
      setOptionNode(MUX, node, idx);
    }
    if (isTs(node)) {
      // con đã có trước (đổ đầy container đã mở), rồi mới cấp TS cho con mới
      for (var t = 0; t < node.kids.length; t++) {
        var kt = node.kids[t];
        if (kt && kt.u !== X) { var pt = placeIn(MUX, kt, X, path.concat(t), false); if (pt) return pt; }
      }
      var add = poolAdd(MUX, node, X, function (kid, direct, i) {
        return direct ? path.concat(i) : placeIn(MUX, kid, X, path.concat(i), true);
      });
      return add ? add.r : null;
    }
    var a = u.accepts[node.opt];
    var slotOk = canReach(MUX, node.u, a.of, X);
    for (var i = 0; i < node.kids.length; i++) {
      var k = node.kids[i];
      if (k == null) {
        if (!slotOk) continue;
        if (a.of === X) { node.kids[i] = newNode(MUX, X); return path.concat(i); }
        var fresh = newNode(MUX, a.of, true);
        var p = placeIn(MUX, fresh, X, path.concat(i), true);
        if (p) { node.kids[i] = fresh; return p; }
      } else if (k.u !== X) {
        var p2 = placeIn(MUX, k, X, path.concat(i), false);
        if (p2) return p2;
      }
    }
    return null;
  }

  /**
   * Thả X vào vị trí path (ô trống hoặc node). Trả về { ok, path, chain, reason }.
   * chain = danh sách đơn vị từ vị trí thả xuống X (vd tug-2 → tu-12 → vc-12 → c-12 → e1).
   */
  function place(MUX, tree, path, X) {
    if (!MUX[X]) return { ok: false, reason: 'Không có đơn vị "' + X + '".' };
    var target = getNode(tree, path);
    var su = slotUnit(MUX, tree, path);
    if (!su) return { ok: false, reason: 'Vị trí không hợp lệ.' };
    if (!target) {
      var parent = getNode(tree, path.slice(0, -1));
      if (su === X) {
        parent.kids[path[path.length - 1]] = newNode(MUX, X);
        return { ok: true, path: path.slice(), chain: [X] };
      }
      if (!reaches(MUX, su, X)) return { ok: false, reason: explainReject(MUX, su, X, null) };
      var fresh = newNode(MUX, su, true);
      var p = placeIn(MUX, fresh, X, path, true);
      if (!p) return { ok: false, reason: explainReject(MUX, su, X, null) };
      parent.kids[path[path.length - 1]] = fresh;
      return { ok: true, path: p, chain: chainAlong(tree, path, p) };
    }
    if (target.u === X) return { ok: false, reason: nameOf(MUX, X) + ' đã có ở vị trí này — thả vào ô trống hoặc nút cha.' };
    var p3 = placeIn(MUX, target, X, path, true);
    if (!p3) return { ok: false, reason: explainReject(MUX, target.u, X, target) };
    return { ok: true, path: p3, chain: chainAlong(tree, path, p3) };
  }

  /** Các đơn vị trên đường từ `from` tới `to` (đường dẫn), gồm cả hai đầu. */
  function chainAlong(tree, from, to) {
    var out = [];
    for (var i = from.length; i <= to.length; i++) { var n = getNode(tree, to.slice(0, i)); if (n) out.push(n.u); }
    return out;
  }

  /** Lấp đầy mọi chỗ còn chứa được X dưới path. Không tự mở client nguyên khối đã có. Trả về số X đã thêm. */
  function fill(MUX, tree, path, X) {
    var count = 0;
    function fillNode(node, canOpen) {
      var u = MUX[node.u];
      if (!hasAcc(u)) return;
      if (!chosen(node)) {
        if (u.leafOk && !canOpen) return;
        var idx = firstOpt(MUX, node.u, X);
        if (idx === -1) return;
        setOptionNode(MUX, node, idx);
      }
      if (isTs(node)) {
        node.kids.forEach(function (k) { if (k && k.u !== X) fillNode(k, false); });
        // cấp TS cho con mới tới khi hết chỗ
        while (poolAdd(MUX, node, X, function (kid, direct) {
          if (direct) { count++; return true; }
          var before = count;
          fillNode(kid, true);
          return count > before;
        }));
        return;
      }
      var a = u.accepts[node.opt];
      var slotOk = canReach(MUX, node.u, a.of, X);
      for (var i = 0; i < node.kids.length; i++) {
        var k = node.kids[i];
        if (k == null) {
          if (!slotOk) continue;
          if (a.of === X) { node.kids[i] = newNode(MUX, X); count++; continue; }
          var fresh = newNode(MUX, a.of, true), before = count;
          fillNode(fresh, true);
          if (count > before) node.kids[i] = fresh;
        } else if (k.u !== X) fillNode(k, false);
      }
    }
    var target = getNode(tree, path);
    if (!target) {
      var su = slotUnit(MUX, tree, path);
      if (!su || !reaches(MUX, su, X)) return 0;
      if (su === X) { getNode(tree, path.slice(0, -1)).kids[path[path.length - 1]] = newNode(MUX, X); return 1; }
      var fresh = newNode(MUX, su, true);
      fillNode(fresh, true);
      if (count) getNode(tree, path.slice(0, -1)).kids[path[path.length - 1]] = fresh;
      return count;
    }
    fillNode(target, true);
    return count;
  }

  /** Số X tối đa một đơn vị (coi như đang mở) chứa được — theo quy tắc tự mở, bỏ qua lựa chọn hiện tại. */
  function maxCount(MUX, unitId, X) {
    var memo = memoOf(MUX, '__maxMemo');
    var key = unitId + '>' + X;
    if (unitId === X) return 1;
    if (memo[key] != null) return memo[key];
    memo[key] = 0;
    var u = MUX[unitId], best = 0;
    (u && u.accepts || []).forEach(function (a) {
      var m = a.of === X ? 1 : autoOpen(MUX, unitId, a.of) ? maxCount(MUX, a.of, X) : 0;
      best = Math.max(best, a.count * m);
    });
    memo[key] = best;
    return best;
  }
  /** Số X còn có thể có (đã đặt + còn chỗ) theo các phương án đang chọn. parentU: đơn vị cha (bỏ trống = gốc). */
  function capacityNow(MUX, node, slotU, X, parentU) {
    if (!node) {
      if (slotU === X) return 1;
      return autoOpen(MUX, parentU, slotU) ? maxCount(MUX, slotU, X) : 0;
    }
    if (node.u === X) return 1;
    var u = MUX[node.u];
    if (!hasAcc(u)) return 0;
    if (!chosen(node)) return u.leafOk && parentU != null ? 0 : maxCount(MUX, node.u, X);
    if (isTs(node)) {
      // con hiện có + số X còn thêm được bằng TS trống (phương án tốt nhất)
      var sum = 0, free = tsFree(MUX, node);
      node.kids.forEach(function (k) { sum += capacityNow(MUX, k, k.u, X, node.u); });
      var best = 0;
      slotOpts(MUX, node.u).forEach(function (s) {
        var m = s.a.of === X ? 1 : autoOpen(MUX, node.u, s.a.of) ? maxCount(MUX, s.a.of, X) : 0;
        best = Math.max(best, Math.floor(free / s.a.slots) * m);
      });
      return sum + best;
    }
    var of = u.accepts[node.opt].of, s = 0;
    node.kids.forEach(function (k) { s += capacityNow(MUX, k, of, X, node.u); });
    return s;
  }

  /** Đếm số node theo đơn vị. */
  function counts(tree) {
    var out = {};
    (function walk(n) {
      if (!n) return;
      out[n.u] = (out[n.u] || 0) + 1;
      n.kids.forEach(walk);
    })(tree);
    return out;
  }

  /**
   * Kế toán theo kbit/s: tổng = tốc độ khung đích. Trả về
   * { totalKbps, clientKbps, clients{u:n}, overhead:[{u,name,count,kbpsEach,kbps,bytesEach,bytes,ohName}],
   *   overheadKbps, justificationKbps, emptyKbps, efficiency, byteBased } + bí danh theo byte/125 µs
   *   (totalBytes, clientBytes, overheadBytes, justification, empty = kbps / 64).
   * Bất biến: client + Σoverhead + chèn/bù + trống = tốc độ khung đích.
   * Chèn/bù = dung lượng của bước − overhead − tổng con (vd C-12 2176 − E1 2048 = 128 kbit/s), chia theo
   * tỷ lệ con đã lấp; phần của con còn trống tính vào "trống".
   */
  function account(MUX, tree) {
    var acc = { totalKbps: unitKbps(MUX, tree.u), clientKbps: 0, clientLineKbps: 0, clients: {}, transcoded: {}, overheadBy: {},
      justificationKbps: 0, emptyKbps: 0, emptyBy: {}, emptyTsKbps: 0, freeTs: [], byteBased: isByteUnit(MUX, tree.u) };
    function addEmpty(id, k) { acc.emptyKbps += k; acc.emptyBy[id] = (acc.emptyBy[id] || 0) + k; }
    function ohEntry(n, u, oh, name, unitBytes) {
      var o = acc.overheadBy[n.u] || (acc.overheadBy[n.u] = { u: n.u, name: u.name, level: u.level || 0, count: 0, kbps: 0, kbpsEach: oh, ohName: '',
        unitBytes: unitBytes });
      o.count++; o.kbps += oh;
      if (name && o.ohName.indexOf(name) < 0) o.ohName += (o.ohName ? ' · ' : '') + name;
    }
    // pa = phương án của cha dùng để chứa n (để biết carriedKbps); null ở gốc
    (function walk(n, slotU, isRoot, pa) {
      if (!n) { addEmpty(slotU, pa ? childRate(MUX, pa, null) : unitKbps(MUX, slotU)); return; }
      var u = MUX[n.u];
      if (!u) return;
      if (!isRoot && isClient(MUX, n.u, n)) {
        var line = unitKbps(MUX, n.u), carried = pa ? childRate(MUX, pa, n) : line;
        acc.clientKbps += carried;
        acc.clientLineKbps += line;
        acc.clients[n.u] = (acc.clients[n.u] || 0) + 1;
        if (Math.abs(carried - line) > 1e-9) {
          var tc = acc.transcoded[n.u] || (acc.transcoded[n.u] = { u: n.u, count: 0, lineKbps: line, carriedKbps: carried });
          tc.count++;
        }
        return;
      }
      if (!chosen(n) || !hasAcc(u)) { addEmpty(n.u, unitKbps(MUX, n.u)); return; }
      if (isTs(n)) {
        // bể TS: dung lượng ngoài TS (vd 8 cột fixed stuff OPU4) = overhead; mỗi con chiếm k TS — phần
        // dư so với tốc độ con = chèn; TS trống = chưa dùng
        var pi = poolInfo(MUX, n.u);
        ohEntry(n, u, pi.outsideKbps, pi.outsideKbps ? 'ngoài TS (fixed stuff)' : '', false);
        var usedTs = 0;
        n.kids.forEach(function (k) {
          if (!k) return;
          var ka = slotOptFor(MUX, n.u, k.u) || { of: k.u };
          var share = (k.ts ? k.ts.length : (ka.slots || 0)) * pi.kbps;
          usedTs += k.ts ? k.ts.length : (ka.slots || 0);
          acc.justificationKbps += share - childRate(MUX, ka, k);
          walk(k, k.u, false, ka);
        });
        var freeN = pi.n - usedTs;
        if (freeN > 0) {
          addEmpty(n.u + ' TS', freeN * pi.kbps);
          acc.emptyTsKbps += freeN * pi.kbps;
          acc.freeTs.push({ u: n.u, free: freeN, n: pi.n, kbps: freeN * pi.kbps });
        }
        return;
      }
      var a = u.accepts[n.opt], oh = ohKbps(a);
      ohEntry(n, u, oh, a.overhead && a.overhead.name, !!(a.overhead && a.overhead.bytes));
      // chèn/bù tốc độ (hoặc khoảng trống ánh xạ khi fit "le"): phần mỗi ô con được chia lớn hơn tốc độ con
      if (a.count) {
        var share1 = (unitKbps(MUX, n.u) - oh) / a.count;
        n.kids.forEach(function (k) {
          var slack = share1 - childRate(MUX, a, k);
          if (slack <= 1e-9) return;
          if (k) acc.justificationKbps += slack; else addEmpty(a.of, slack);
        });
      }
      n.kids.forEach(function (k) { walk(k, a.of, false, a); });
    })(tree, tree.u, true, null);
    var list = Object.keys(acc.overheadBy).map(function (k) { return acc.overheadBy[k]; });
    list.sort(function (x, y) { return x.level - y.level; });
    list.forEach(function (o) { o.bytes = o.kbps / 64; o.bytesEach = o.kbpsEach / 64; });
    acc.overhead = list;
    acc.overheadKbps = list.reduce(function (s, o) { return s + o.kbps; }, 0);
    acc.efficiency = acc.totalKbps ? acc.clientKbps / acc.totalKbps * 100 : 0;
    // bí danh byte/125 µs (tương thích)
    acc.totalBytes = acc.totalKbps / 64; acc.clientBytes = acc.clientKbps / 64; acc.overheadBytes = acc.overheadKbps / 64;
    acc.justification = acc.justificationKbps / 64; acc.empty = acc.emptyKbps / 64;
    return acc;
  }

  /** Đường ngắn nhất (BFS) từ rootId xuống X theo quy tắc tự mở: [rootId, …, X], hoặc null. */
  function pathDown(MUX, rootId, X) {
    var prev = {}, q = [rootId], seen = {};
    seen[rootId] = true;
    while (q.length) {
      var cur = q.shift();
      if (cur === X) break;
      var u = MUX[cur];
      (u && u.accepts || []).forEach(function (a) {
        if (seen[a.of]) return;
        if (a.of !== X && !autoOpen(MUX, cur, a.of)) return;
        seen[a.of] = true; prev[a.of] = cur; q.push(a.of);
      });
    }
    if (!seen[X]) return null;
    var out = [X];
    while (out[0] !== rootId) out.unshift(prev[out[0]]);
    return out;
  }

  /**
   * Các bước đóng gói từ client đi lên tới gốc:
   * [{ u, unit, kbps, bytes, from, count, overhead, ohKbps, mapping, note, justKbps, justification }].
   */
  function stepsUp(MUX, rootId, X) {
    var down = pathDown(MUX, rootId, X);
    if (!down) return null;
    var up = down.slice().reverse();
    return up.map(function (id, i) {
      var step = { u: id, unit: MUX[id], kbps: unitKbps(MUX, id), bytes: unitBytes(MUX, id) };
      if (i > 0) {
        var from = up[i - 1];
        var a = (MUX[id].accepts || []).filter(function (x) { return x.of === from; })[0] || {};
        step.from = from; step.count = a.count; step.overhead = a.overhead || { bytes: 0 };
        step.ohKbps = ohKbps(a);
        step.mapping = a.mapping; step.note = a.note;
        step.slots = a.slots || 0; step.fit = a.fit || '';
        if (a.slots) step.pool = poolInfo(MUX, id);
        step.childKbps = a.of ? childRate(MUX, a, null) : 0;
        if (a.carriedKbps != null) step.carriedKbps = a.carriedKbps;
        var j = step.kbps - step.ohKbps - (a.count || 0) * step.childKbps;
        step.justKbps = j > 1e-9 ? j : 0;
        step.justification = step.justKbps / 64;
      }
      return step;
    });
  }

  /** Nhãn một lựa chọn: "1×STM-64" hoặc "ghép TS (ODU0, ODU1, ODUflex)". */
  function choiceText(MUX, unitId, c) {
    if (c === 'ts') {
      return 'ghép TS (' + slotOpts(MUX, unitId).map(function (s) { return nameOf(MUX, s.a.of); }).join(', ') + ')';
    }
    var a = MUX[unitId].accepts[c];
    return a.count + '×' + nameOf(MUX, a.of);
  }
  function acceptsText(MUX, unitId) {
    return choices(MUX, unitId).map(function (c) { return choiceText(MUX, unitId, c); }).join(' hoặc ');
  }
  /** Tên ngắn: bỏ phần chú thích trong ngoặc ("E1 (2,048 Mbit/s)" → "E1"). */
  function nameOf(MUX, id) { return MUX[id] ? String(MUX[id].name).replace(/\s*\(.*\)\s*$/, '') : id; }

  /** Node đầu tiên trong cây con mà phương án đang chọn chặn X (phương án khác thì nhận được). */
  function blockingOption(MUX, node, X) {
    var found = null;
    (function walk(n) {
      if (!n || found) return;
      var u = MUX[n.u];
      if (!u || !u.accepts || !chosen(n)) return;
      if (!optReaches(MUX, n.u, n.opt, X)) {
        if (choices(MUX, n.u).some(function (c) { return c !== n.opt && optReaches(MUX, n.u, c, X); })) found = n;
        return;
      }
      n.kids.forEach(walk);
    })(node);
    return found;
  }

  /**
   * Bể TS trong cây con không đủ TS trống cho X: trả về câu giải thích
   * ("ODU2e cần 9 TS trong OPU3, còn 6 TS trống") hoặc null.
   */
  function poolShortage(MUX, node, X) {
    var msg = null;
    (function walk(n) {
      if (!n || msg || !chosen(n)) return;
      if (isTs(n)) {
        var opts = poolCandidates(MUX, n.u, X);
        if (opts.length) {
          var a = opts[0].a, free = tsFree(MUX, n);
          if (a.slots > free) {
            var xn = nameOf(MUX, X), un = nameOf(MUX, n.u);
            msg = (a.of === X ? xn + ' cần ' + a.slots + ' TS' : xn + ' cần ' + nameOf(MUX, a.of) + ' (' + a.slots + ' TS)') +
              ' trong ' + un + ', còn ' + free + ' TS trống' + (free ? '' : ' (' + un + ' đã đầy)') + ' — gỡ bớt con để trả lại TS.';
            return;
          }
        }
      }
      n.kids.forEach(walk);
    })(node);
    return msg;
  }

  /**
   * Gợi ý đường đi khi X không vào được `at` và X chỉ đi qua bể TS / gốc khác (OTN):
   * "10GbE không vào OPU2 (…). 10GbE → OPU2e → ODU2e — dùng OTU2e hoặc ODU2e trong OPU3/OPU4." Null nếu không áp dụng.
   */
  function routeHint(MUX, at, X) {
    // mô tả `at`: đi xuống chuỗi bắt buộc 1× tới đơn vị có nhiều lựa chọn (OTU2 → ODU2 → OPU2)
    var d = at, guard = 0;
    while (guard++ < 20) {
      var ch = choices(MUX, d);
      if (ch.length !== 1 || ch[0] === 'ts') break;
      var a0 = MUX[d].accepts[ch[0]];
      if (a0.count !== 1 || !hasAcc(MUX[a0.of]) || !autoOpen(MUX, d, a0.of)) break;
      d = a0.of;
    }
    // đi lên từ X qua các cha duy nhất tới đơn vị nằm trong bể TS
    var cur = X, chain = [X];
    for (var g = 0; g < 20; g++) {
      var ps = parentsOf(MUX, cur);
      if (!ps.length) return null;
      var pools = ps.filter(function (p) { return !!slotOptFor(MUX, p, cur); });
      if (pools.length) {
        var roots = ps.filter(function (p) { return !pools.some(function (q) { return q === p; }) && !reachesAnyParent(MUX, p); });
        var xn = nameOf(MUX, X), cn = nameOf(MUX, cur);
        var use = roots.map(function (r) { return nameOf(MUX, r); });
        use.push(cn + ' trong ' + pools.map(function (p) { return nameOf(MUX, p); }).join('/'));
        return xn + ' không vào ' + nameOf(MUX, d) + ' (' + nameOf(MUX, d) + ' nhận ' + acceptsText(MUX, d) + ').' +
          (chain.length > 1 ? ' ' + chain.map(function (id) { return nameOf(MUX, id); }).join(' → ') + ' —' : '') +
          ' dùng ' + use.join(' hoặc ') + '.';
      }
      if (ps.length !== 1) return null;
      cur = ps[0]; chain.push(cur);
    }
    return null;
  }

  /** Có đơn vị nào chứa `id` không (gốc = không ai chứa). */
  function parentsOf(MUX, id) {
    return Object.keys(MUX).filter(function (k) { return (MUX[k].accepts || []).some(function (a) { return a.of === id; }); });
  }
  function reachesAnyParent(MUX, id) { return parentsOf(MUX, id).length > 0; }

  /** Giải thích vì sao không thả được X vào đơn vị `at` (node = node hiện có, có thể null). */
  function explainReject(MUX, at, X, node) {
    var U = MUX[at], XU = MUX[X];
    if (!U || !XU) return 'Không thả được.';
    var un = nameOf(MUX, at), xn = nameOf(MUX, X);
    if (!U.accepts || !U.accepts.length) return un + ' là tín hiệu khách hàng, không chứa đơn vị khác.';
    if (reaches(MUX, at, X) && node) {
      var ps = poolShortage(MUX, node, X);
      if (ps) return ps;
      var b = blockingOption(MUX, node, X);
      if (b) {
        var alt = choices(MUX, b.u).filter(function (c) { return optReaches(MUX, b.u, c, X); })
          .map(function (c) { return choiceText(MUX, b.u, c); });
        return (b === node ? '' : un + ' không còn chỗ cho ' + xn + ': ') + nameOf(MUX, b.u) + ' đang dùng phương án ' +
          choiceText(MUX, b.u, b.opt) + '; ' + xn + ' cần ' + alt.join(' hoặc ') +
          ' — đổi phương án để thả.';
      }
      return un + ' đã đầy — không còn chỗ cho ' + xn + '.';
    }
    if (!reaches(MUX, at, X)) {
      var hint = routeHint(MUX, at, X);
      if (hint) return hint;
    }
    if (!reaches(MUX, at, X) && reachesFree(MUX, at, X)) {
      // X chỉ nằm được bên trong một luồng leafOk (ghép PDH), không có ánh xạ riêng vào `at`
      var hosts = parentsOf(MUX, X).filter(function (p) { return MUX[p].leafOk && reaches(MUX, at, p); });
      var direct = Object.keys(MUX).filter(function (id) {
        return MUX[id].leafOk && reaches(MUX, at, id) && parentsOf(MUX, id).some(function (p) { return !MUX[p].leafOk; });
      }).sort(function (a, b) { return unitKbps(MUX, a) - unitKbps(MUX, b); });
      var hostTxt = hosts.map(function (h) {
        var a = MUX[h].accepts.filter(function (x) { return x.of === X; })[0];
        return nameOf(MUX, h) + ' (' + a.count + '×' + xn + ')';
      });
      var m = xn + ' không có đường ánh xạ vào ' + un + ': không container nào ở đây nhận trực tiếp ' + xn + '.';
      if (direct.length) m += ' Chỉ ' + direct.map(function (d) { return nameOf(MUX, d); }).join(', ') + ' được ánh xạ trực tiếp.';
      if (hostTxt.length) m += ' ' + xn + ' chỉ đi bên trong ' + hostTxt.join(' hoặc ') + ' theo ghép PDH — thả ' +
        hosts.map(function (h) { return nameOf(MUX, h); }).join('/') + ' rồi chọn phương án “' + MUX[hosts[0]].accepts.filter(function (x) { return x.of === X; })[0].count + '×' + xn + '” ở hộp đó để mở bên trong.';
      return m;
    }
    var msg = un + ' chỉ nhận ' + acceptsText(MUX, at) + '.';
    // chuỗi đi lên của X tới đơn vị đầu tiên chứa được cả `at` (nơi hai nhánh gặp nhau)
    var best = null;
    Object.keys(MUX).forEach(function (rid) {
      if (!MUX[rid].accepts || reachesAnyParent(MUX, rid)) return; // chỉ xét đơn vị gốc
      var p = pathDown(MUX, rid, X);
      if (p && (!best || p.length < best.length)) best = p;
    });
    if (best) {
      var up = best.slice().reverse(), cut = up.length;
      for (var i = 1; i < up.length; i++) if (up[i] !== at && reaches(MUX, up[i], at)) { cut = i + 1; break; }
      var part = up.slice(1, cut).map(function (id) { return nameOf(MUX, id); });
      if (part.length) msg += ' ' + xn + ' cần ' + part.join(' → ') + '.';
    } else {
      msg += ' ' + xn + ' không ghép được vào ' + un + '.';
    }
    return msg;
  }

  var api = {
    KIND_LABEL: KIND_LABEL, PAYLOAD_KINDS: PAYLOAD_KINDS,
    fmtNum: fmtNum, fmtRate: fmtRate, rectCells: rectCells, rectText: rectText,
    buildFrame: buildFrame, ancestry: ancestry, displayMap: displayMap, displayCells: displayCells,
    columnRuns: columnRuns, mergePieces: mergePieces, regionKbps: regionKbps,
    perFrameEntry: perFrameEntry, effRegion: effRegion, perFrameCount: perFrameCount,
    lab: {
      unitBytes: unitBytes, unitKbps: unitKbps, isByteUnit: isByteUnit, ohKbps: ohKbps, ohLabel: ohLabel,
      isClient: isClient, autoOpen: autoOpen, canReach: canReach, reaches: reaches, reachesFree: reachesFree,
      newNode: newNode, newRoot: newRoot, getNode: getNode,
      slotUnit: slotUnit, setOption: setOption, instantiate: instantiate, remove: remove, place: place,
      fill: fill, maxCount: maxCount, capacityNow: capacityNow, counts: counts, account: account,
      pathDown: pathDown, stepsUp: stepsUp, explainReject: explainReject, acceptsText: acceptsText, nameOf: nameOf, parentsOf: parentsOf,
      // bể tributary slot (OTN)
      isTs: isTs, chosen: chosen, choices: choices, choiceText: choiceText, optObj: optObj, slotOpts: slotOpts, hasPool: hasPool,
      poolInfo: poolInfo, slotOptFor: slotOptFor, tsFree: tsFree, tsUsed: tsUsed, childRate: childRate,
      poolShortage: poolShortage, routeHint: routeHint
    }
  };
  root.TransViz = Object.assign(root.TransViz || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
