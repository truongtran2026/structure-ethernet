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
        rows: rows, cols: cols, cells: total, bytes: bytes,
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
    var c = 0;
    while (c < cols) {
      var e = c;
      if (compress) while (e + 1 < cols && same(c, e + 1)) e++;
      var len = e - c + 1;
      if (compress && len >= minRun && !(expanded && expanded[c])) out.push({ c0: c, c1: e, band: true });
      else for (var k = c; k <= e; k++) out.push({ c0: k, c1: k, band: false, runStart: len >= minRun ? c : null });
      c = e + 1;
    }
    return out;
  }

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

  // =====================================================================
  //  Logic phòng thí nghiệm ghép kênh (cây đơn vị theo TMUX.accepts)
  // =====================================================================
  // Node: { u: unitId, opt: số thứ tự phương án accepts (-1 = chưa chọn), kids: [Node|null] }
  // Client (không có accepts): { u, opt: -1, kids: [] }.

  function unitBytes(MUX, id) {
    var u = MUX[id];
    if (!u) return 0;
    return u.bytesPer125us != null ? u.bytesPer125us : (u.rateKbps || 0) / 64;
  }
  function isClient(MUX, id) { var u = MUX[id]; return !!u && !(u.accepts && u.accepts.length); }

  /** Có đi được từ đơn vị `from` xuống `to` qua accepts không (from === to tính là có). */
  function reaches(MUX, from, to, _memo) {
    var memo = _memo || (MUX.__reachMemo || (Object.defineProperty(MUX, '__reachMemo', { value: {}, enumerable: false }), MUX.__reachMemo));
    var key = from + '>' + to;
    if (memo[key] != null) return memo[key];
    memo[key] = false; // chặn vòng lặp
    var ok = from === to;
    var u = MUX[from];
    if (!ok && u && u.accepts) ok = u.accepts.some(function (a) { return reaches(MUX, a.of, to, memo); });
    memo[key] = ok;
    return ok;
  }
  function optReaches(MUX, unitId, optIdx, to) {
    var a = MUX[unitId] && MUX[unitId].accepts && MUX[unitId].accepts[optIdx];
    return !!a && reaches(MUX, a.of, to);
  }

  /** Tạo node mới; một phương án duy nhất → tự chọn; chuỗi 1×… tự dựng tiếp (để thấy ô trống). */
  function newNode(MUX, unitId, noAuto) {
    var n = { u: unitId, opt: -1, kids: [] };
    var u = MUX[unitId];
    if (!noAuto && u && u.accepts && u.accepts.length === 1) setOptionNode(MUX, n, 0);
    return n;
  }
  function setOptionNode(MUX, n, idx) {
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
    var a = parent && MUX[parent.u].accepts[parent.opt];
    return a ? a.of : null;
  }

  function setOption(MUX, tree, path, idx) {
    var n = getNode(tree, path);
    if (!n || !MUX[n.u].accepts || !MUX[n.u].accepts[idx]) return false;
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
    parent.kids[path[path.length - 1]] = null;
    return true;
  }

  /**
   * Đặt một đơn vị X vào node (đệ quy, ô trống đầu tiên khả dụng). Tạo chuỗi trung gian khi cần.
   * Trả về đường dẫn tới node X vừa đặt, hoặc null.
   */
  function placeIn(MUX, node, X, path) {
    var u = MUX[node.u];
    if (!u || !u.accepts) return null;
    if (node.opt < 0) {
      var idx = -1;
      u.accepts.some(function (a, i) { if (reaches(MUX, a.of, X)) { idx = i; return true; } return false; });
      if (idx < 0) return null;
      setOptionNode(MUX, node, idx);
    }
    var a = u.accepts[node.opt];
    if (!reaches(MUX, a.of, X)) return null;
    for (var i = 0; i < node.kids.length; i++) {
      var k = node.kids[i];
      if (k == null) {
        if (a.of === X) { node.kids[i] = newNode(MUX, X); return path.concat(i); }
        var fresh = newNode(MUX, a.of, true);
        var p = placeIn(MUX, fresh, X, path.concat(i));
        if (p) { node.kids[i] = fresh; return p; }
      } else if (k.u !== X) {
        var p2 = placeIn(MUX, k, X, path.concat(i));
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
      if (!reaches(MUX, su, X)) return { ok: false, reason: explainReject(MUX, su, X, null) };
      if (su === X) {
        var parent = getNode(tree, path.slice(0, -1));
        parent.kids[path[path.length - 1]] = newNode(MUX, X);
        return { ok: true, path: path.slice(), chain: [X] };
      }
      var fresh = newNode(MUX, su, true);
      var p = placeIn(MUX, fresh, X, path);
      if (!p) return { ok: false, reason: explainReject(MUX, su, X, null) };
      getNode(tree, path.slice(0, -1)).kids[path[path.length - 1]] = fresh;
      return { ok: true, path: p, chain: chainAlong(tree, path, p) };
    }
    if (target.u === X) return { ok: false, reason: MUX[X].name + ' đã có ở vị trí này — thả vào ô trống hoặc nút cha.' };
    if (!reaches(MUX, target.u, X)) return { ok: false, reason: explainReject(MUX, target.u, X, null) };
    var p3 = placeIn(MUX, target, X, path);
    if (!p3) return { ok: false, reason: explainReject(MUX, target.u, X, target) };
    return { ok: true, path: p3, chain: chainAlong(tree, path, p3) };
  }

  /** Các đơn vị trên đường từ `from` tới `to` (đường dẫn), gồm cả hai đầu. */
  function chainAlong(tree, from, to) {
    var out = [];
    for (var i = from.length; i <= to.length; i++) { var n = getNode(tree, to.slice(0, i)); if (n) out.push(n.u); }
    return out;
  }

  /** Lấp đầy mọi chỗ còn chứa được X dưới path. Trả về số X đã thêm. */
  function fill(MUX, tree, path, X) {
    var count = 0;
    function fillNode(node) {
      var u = MUX[node.u];
      if (!u || !u.accepts) return;
      if (node.opt < 0) {
        var idx = -1;
        u.accepts.some(function (a, i) { if (reaches(MUX, a.of, X)) { idx = i; return true; } return false; });
        if (idx < 0) return;
        setOptionNode(MUX, node, idx);
      }
      var a = u.accepts[node.opt];
      if (!reaches(MUX, a.of, X)) return;
      for (var i = 0; i < node.kids.length; i++) {
        var k = node.kids[i];
        if (k == null) {
          if (a.of === X) { node.kids[i] = newNode(MUX, X); count++; continue; }
          var fresh = newNode(MUX, a.of, true), before = count;
          fillNode(fresh);
          if (count > before) node.kids[i] = fresh;
        } else if (k.u !== X) fillNode(k);
      }
    }
    var target = getNode(tree, path);
    if (!target) {
      var su = slotUnit(MUX, tree, path);
      if (!su || !reaches(MUX, su, X)) return 0;
      if (su === X) { getNode(tree, path.slice(0, -1)).kids[path[path.length - 1]] = newNode(MUX, X); return 1; }
      var fresh = newNode(MUX, su, true);
      fillNode(fresh);
      if (count) getNode(tree, path.slice(0, -1)).kids[path[path.length - 1]] = fresh;
      return count;
    }
    fillNode(target);
    return count;
  }

  /** Số X tối đa một đơn vị chứa được (bỏ qua lựa chọn hiện tại). */
  function maxCount(MUX, unitId, X, _memo) {
    var memo = _memo || {};
    if (unitId === X) return 1;
    if (memo[unitId] != null) return memo[unitId];
    memo[unitId] = 0;
    var u = MUX[unitId], best = 0;
    (u && u.accepts || []).forEach(function (a) { best = Math.max(best, a.count * maxCount(MUX, a.of, X, memo)); });
    memo[unitId] = best;
    return best;
  }
  /** Số X còn có thể có (đã đặt + còn chỗ) theo các phương án đang chọn. */
  function capacityNow(MUX, node, slotU, X) {
    if (!node) return maxCount(MUX, slotU, X);
    if (node.u === X) return 1;
    var u = MUX[node.u];
    if (!u || !u.accepts) return 0;
    if (node.opt < 0) return maxCount(MUX, node.u, X);
    var of = u.accepts[node.opt].of, s = 0;
    node.kids.forEach(function (k) { s += capacityNow(MUX, k, of, X); });
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
   * Kế toán byte/125 µs: tổng = khung đích. Trả về
   * { totalBytes, clientKbps, clients{u:n}, overhead:[{u,name,count,bytesEach,bytes,ohName}],
   *   justification bytes, empty bytes, undecided bytes, efficiency }.
   * Bất biến: clientBytes + Σoverhead + justification + empty = totalBytes.
   */
  function account(MUX, tree) {
    var acc = { totalBytes: unitBytes(MUX, tree.u), clientKbps: 0, clientBytes: 0, clients: {},
      overheadBy: {}, justification: 0, empty: 0, emptyBy: {} };
    (function walk(n, slotU) {
      if (!n) { var b = unitBytes(MUX, slotU); acc.empty += b; acc.emptyBy[slotU] = (acc.emptyBy[slotU] || 0) + b; return; }
      var u = MUX[n.u];
      if (!u.accepts || !u.accepts.length) {
        acc.clientKbps += u.rateKbps || unitBytes(MUX, n.u) * 64;
        acc.clientBytes += unitBytes(MUX, n.u);
        acc.clients[n.u] = (acc.clients[n.u] || 0) + 1;
        return;
      }
      if (n.opt < 0) { var b2 = unitBytes(MUX, n.u); acc.empty += b2; acc.emptyBy[n.u] = (acc.emptyBy[n.u] || 0) + b2; return; }
      var a = u.accepts[n.opt], oh = (a.overhead && a.overhead.bytes) || 0;
      var o = acc.overheadBy[n.u] || (acc.overheadBy[n.u] = { u: n.u, name: u.name, level: u.level || 0, count: 0, bytes: 0, ohName: '', bytesEach: oh });
      o.count++; o.bytes += oh;
      if (a.overhead && a.overhead.name && o.ohName.indexOf(a.overhead.name) < 0) o.ohName += (o.ohName ? ' · ' : '') + a.overhead.name;
      // chèn/bù tốc độ: dung lượng của bước này lớn hơn tổng con (chỉ khi con là client)
      var kidsBytes = a.count * unitBytes(MUX, a.of);
      var slack = unitBytes(MUX, n.u) - oh - kidsBytes;
      if (slack > 1e-9 && isClient(MUX, a.of)) {
        // phần chèn chỉ tính cho con đã có; con trống tính vào empty (theo kích thước client)
        var filled = n.kids.filter(Boolean).length;
        acc.justification += slack * (a.count ? filled / a.count : 0);
        acc.empty += slack * (a.count ? (a.count - filled) / a.count : 0);
      }
      n.kids.forEach(function (k) { walk(k, a.of); });
    })(tree, tree.u);
    var list = Object.keys(acc.overheadBy).map(function (k) { return acc.overheadBy[k]; });
    list.sort(function (x, y) { return x.level - y.level; });
    acc.overhead = list;
    acc.overheadBytes = list.reduce(function (s, o) { return s + o.bytes; }, 0);
    acc.efficiency = acc.totalBytes ? acc.clientBytes / acc.totalBytes * 100 : 0;
    acc.totalKbps = acc.totalBytes * 64;
    return acc;
  }

  /** Đường ngắn nhất (BFS) từ rootId xuống X: [rootId, …, X], hoặc null. */
  function pathDown(MUX, rootId, X) {
    var prev = {}, q = [rootId], seen = {};
    seen[rootId] = true;
    while (q.length) {
      var cur = q.shift();
      if (cur === X) break;
      var u = MUX[cur];
      (u && u.accepts || []).forEach(function (a) {
        if (!seen[a.of]) { seen[a.of] = true; prev[a.of] = cur; q.push(a.of); }
      });
    }
    if (!seen[X]) return null;
    var out = [X];
    while (out[0] !== rootId) out.unshift(prev[out[0]]);
    return out;
  }

  /** Các bước đóng gói từ client đi lên tới gốc: [{ u, from, count, overhead, mapping, note }]. */
  function stepsUp(MUX, rootId, X) {
    var down = pathDown(MUX, rootId, X);
    if (!down) return null;
    var up = down.slice().reverse();
    return up.map(function (id, i) {
      var step = { u: id, unit: MUX[id], bytes: unitBytes(MUX, id) };
      if (i > 0) {
        var from = up[i - 1];
        var a = (MUX[id].accepts || []).filter(function (x) { return x.of === from; })[0] || {};
        step.from = from; step.count = a.count; step.overhead = a.overhead || { bytes: 0 };
        step.mapping = a.mapping; step.note = a.note;
        if (isClient(MUX, from)) step.justification = unitBytes(MUX, id) - (step.overhead.bytes || 0) - a.count * unitBytes(MUX, from);
      }
      return step;
    });
  }

  function acceptsText(MUX, unitId) {
    var u = MUX[unitId];
    return (u && u.accepts || []).map(function (a) { return a.count + '×' + nameOf(MUX, a.of); }).join(' hoặc ');
  }
  /** Tên ngắn: bỏ phần chú thích trong ngoặc ("E1 (2,048 Mbit/s)" → "E1"). */
  function nameOf(MUX, id) { return MUX[id] ? String(MUX[id].name).replace(/\s*\(.*\)\s*$/, '') : id; }

  /** Node đầu tiên trong cây con mà phương án đang chọn chặn X (phương án khác thì nhận được). */
  function blockingOption(MUX, node, X) {
    var found = null;
    (function walk(n) {
      if (!n || found) return;
      var u = MUX[n.u];
      if (!u || !u.accepts || n.opt < 0) return;
      if (!optReaches(MUX, n.u, n.opt, X)) {
        if (u.accepts.some(function (a, i) { return i !== n.opt && optReaches(MUX, n.u, i, X); })) found = n;
        return;
      }
      n.kids.forEach(walk);
    })(node);
    return found;
  }

  /** Có đơn vị nào chứa `id` không (gốc = không ai chứa). */
  function reachesAnyParent(MUX, id) {
    return Object.keys(MUX).some(function (k) { return (MUX[k].accepts || []).some(function (a) { return a.of === id; }); });
  }

  /** Giải thích vì sao không thả được X vào đơn vị `at` (node = node hiện có, có thể null). */
  function explainReject(MUX, at, X, node) {
    var U = MUX[at], XU = MUX[X];
    if (!U || !XU) return 'Không thả được.';
    var un = nameOf(MUX, at), xn = nameOf(MUX, X);
    if (!U.accepts || !U.accepts.length) return un + ' là tín hiệu khách hàng, không chứa đơn vị khác.';
    if (reaches(MUX, at, X) && node) {
      var b = blockingOption(MUX, node, X);
      if (b) {
        var BU = MUX[b.u];
        var alt = BU.accepts.map(function (a, i) { return i; }).filter(function (i) { return optReaches(MUX, b.u, i, X); })
          .map(function (i) { var a = BU.accepts[i]; return a.count + '×' + nameOf(MUX, a.of); });
        return (b === node ? '' : un + ' không còn chỗ cho ' + xn + ': ') + nameOf(MUX, b.u) + ' đang dùng phương án ' +
          BU.accepts[b.opt].count + '×' + nameOf(MUX, BU.accepts[b.opt].of) + '; ' + xn + ' cần ' + alt.join(' hoặc ') +
          ' — đổi phương án để thả.';
      }
      return un + ' đã đầy — không còn chỗ cho ' + xn + '.';
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
    lab: {
      unitBytes: unitBytes, isClient: isClient, reaches: reaches, newNode: newNode, getNode: getNode,
      slotUnit: slotUnit, setOption: setOption, instantiate: instantiate, remove: remove, place: place,
      fill: fill, maxCount: maxCount, capacityNow: capacityNow, counts: counts, account: account,
      pathDown: pathDown, stepsUp: stepsUp, explainReject: explainReject, acceptsText: acceptsText, nameOf: nameOf
    }
  };
  root.TransViz = Object.assign(root.TransViz || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
