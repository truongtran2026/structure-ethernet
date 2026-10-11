/*
 * transport-view.js — xem khung truyền dẫn (PDH/SDH/OTN) dạng LƯỚI BYTE 2 chiều.
 * Đọc window.TFRAMES/TMUX/TLABS; tính toán trong js/tmodel.js (TransViz); không hardcode tên khung.
 *  - lưới: mỗi ô một byte, tô màu theo kind; region thu gọn = một khối mang tên; bung → con → từng byte;
 *  - khung rộng (> 300 cột): nén các cột giống nhau thành dải "cột a–b", có nút bung;
 *  - cây region bên dưới lưới, đồng bộ hover/chọn; panel chi tiết với tốc độ riêng của vùng, bitFields.
 */
(function () {
  'use strict';

  var STORE_PREFIX = 'fs.t.v1.';
  var ZOOMS = [
    { id: 'fit', label: 'Vừa khung', hint: 'Co ô cho vừa bề ngang (nhìn toàn cảnh)' },
    { id: 's', label: 'Nhỏ', cw: 7, rh: 16 },
    { id: 'm', label: 'Vừa', cw: 15, rh: 24 },
    { id: 'l', label: 'Lớn', cw: 26, rh: 32 }
  ];
  var AUTO_COMPRESS_COLS = 300;   // rộng hơn → mặc định nén cột
  var MAX_PLAIN_COLS = 2000;      // không cho tắt nén khi lưới rộng hơn
  var MF_BUTTONS_MAX = 32;       // đa khung dài hơn → bộ chọn gọn (ô số + trước/sau + nhóm khung)
  var MAX_BAND_EXPAND = 1500;     // dải rộng hơn không cho bung từng cột
  var BAND_W = 46;

  var tv = { active: false, frame: null, fm: null, state: null, hl: null, focusId: null };

  function T() { return window.TransViz; }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\\s]/g, '\\$&'); }
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function storeGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  function n(x, d) { return T().fmtNum(x, d); }
  /** Khung tính theo bit (cellBits ≠ 8, vd E2/E3/E4) → luôn ghi bit. */
  function bitMode() { return !!(tv.fm && tv.fm.cellBits !== 8); }
  function bytesTxt(b) { return !bitMode() && Number.isInteger(b) ? n(b, 0) + ' byte' : n(b * 8, 0) + ' bit'; }
  function unitWord() { return bitMode() ? 'bit' : 'byte'; }
  /** Chu kỳ khung: thập phân gọn (100,38 µs; 125 µs). */
  function periodTxt(us) { return n(us, Number.isInteger(us) ? 0 : 2) + ' µs'; }
  /** Nhãn/tên/mô tả hiệu lực của region theo khung đang chọn trong đa khung. */
  function eff(node) { return T().effRegion(node.region, tv.state ? tv.state.mf : null); }
  /** "0, 2, 4 … 14" / "1–15" — rút gọn danh sách khung. */
  function framesTxt(fr) {
    var a = (fr || []).slice().sort(function (x, y) { return x - y; });
    if (a.length <= 3) return a.join(', ');
    var d = a[1] - a[0], even = a.every(function (v, i) { return !i || v - a[i - 1] === d; });
    if (even && d === 1) return a[0] + '–' + a[a.length - 1];
    if (even) return a[0] + ', ' + a[1] + ', ' + a[2] + ' … ' + a[a.length - 1] + (d === 2 ? (a[0] % 2 ? ' (lẻ)' : ' (chẵn)') : '');
    return a.join(', ');
  }

  // ---------- trạng thái ----------
  function defaultState() { return { level: 1, open: {}, selected: null, zoom: 'm', compress: null, bands: {}, mf: null }; }
  function loadState(id) {
    var s = storeGet(STORE_PREFIX + id), d = defaultState();
    if (!s || typeof s !== 'object') return d;
    Object.keys(d).forEach(function (k) { if (!has(s, k)) s[k] = d[k]; });
    return s;
  }
  function save() { if (tv.frame) storeSet(STORE_PREFIX + tv.frame.id, tv.state); }

  function isOpen(node) {
    if (!node || !node.children.length) return false;
    if (has(tv.state.open, node.id)) return !!tv.state.open[node.id];
    return node.depth < tv.state.level;
  }
  function compressOn() {
    if (tv.fm.cols > MAX_PLAIN_COLS) return true;
    return tv.state.compress == null ? tv.fm.cols > AUTO_COMPRESS_COLS : !!tv.state.compress;
  }

  // ---------- vào/ra ----------
  function init() {
    if (!T()) throw new Error('Không nạp được js/tmodel.js');
    var root = document.getElementById('view-t');
    root.addEventListener('click', onClick);
    root.addEventListener('mouseover', onOver);
    root.addEventListener('mouseleave', function () { setHl(null); });
    root.addEventListener('keydown', onKey);
    root.addEventListener('change', function (e) {
      var el = e.target;
      if (el.matches && (el.matches('[data-tmfnum]') || el.matches('[data-tmfsel]'))) setMf(el.value);
    });
    document.getElementById('detail').addEventListener('click', function (e) {
      if (!tv.active) return;
      var a = e.target.closest && e.target.closest('[data-tgoto]');
      if (a) { e.preventDefault(); select(a.getAttribute('data-tgoto'), true); return; }
      var m = e.target.closest && e.target.closest('[data-tmf]');
      if (m) { var v = m.getAttribute('data-tmf'); tv.state.mf = v === 'all' ? null : +v; save(); render(); }
    });
    window.addEventListener('resize', function () {
      if (tv.active && tv.state && tv.state.zoom === 'fit') { clearTimeout(tv.rz); tv.rz = setTimeout(renderGrid, 120); }
    });
  }

  function show(id) {
    var FR = window.TFRAMES || {};
    var f = FR[id];
    tv.active = true;
    if (!f) { document.getElementById('view-t').innerHTML = '<div class="empty"><h1>Không có khung “' + esc(id) + '”</h1></div>'; return; }
    tv.frame = f;
    tv.fm = T().buildFrame(f);
    tv.state = loadState(f.id);
    if (tv.state.selected && !tv.fm.byId[tv.state.selected]) tv.state.selected = null;
    var nmf = T().perFrameCount(tv.fm);
    if (tv.state.mf != null && !(tv.state.mf >= 0 && tv.state.mf < nmf)) tv.state.mf = null;
    tv.focusId = null;
    render();
  }
  function hide() { tv.active = false; }

  // ---------- vẽ ----------
  function render() {
    var view = document.getElementById('view-t');
    var alerts = window.AppNav ? window.AppNav.loadAlertsHtml() : '';
    if (tv.fm.errors.length) alerts += '<div class="alert alert--warn"><strong>Dữ liệu khung có vấn đề:</strong> ' + esc(tv.fm.errors.join('; ')) + '</div>';
    document.getElementById('alerts').innerHTML = alerts;
    view.innerHTML =
      '<section class="stack-head">' + renderHead() + '</section>' +
      '<section class="card tg-card" aria-label="Lưới ' + unitWord() + '">' +
        '<div class="section-title"><h2>Lưới ' + unitWord() + (tv.state.mf != null ? ' · khung ' + tv.state.mf : '') + '</h2><span class="muted" id="tg-hint"></span></div>' +
        '<div class="tg-scroll" id="tg-scroll"></div>' + renderLegend() +
      '</section>' +
      '<section class="card" aria-labelledby="tt-title">' +
        '<div class="section-title"><h2 id="tt-title">Cây vùng (region)</h2><span class="muted">▸ bung · ▾ thu gọn · đồng bộ với lưới</span></div>' +
        '<div id="ttree" class="tree" role="tree" aria-labelledby="tt-title"></div>' +
      '</section>';
    renderGrid();
    renderTree();
    renderDetail();
  }

  function stat(label, value, sub, tip) {
    return '<div class="stat"' + (tip ? ' title="' + esc(tip) + '"' : '') + '><div class="stat-label">' + esc(label) +
      '</div><div class="stat-value">' + esc(value) + '</div><div class="stat-sub">' + esc(sub || '') + '</div></div>';
  }

  function renderHead() {
    var f = tv.frame, s = tv.fm.stats, TV = T();
    var fam = (f.family || '').toUpperCase();
    var maxD = tv.fm.maxDepth;
    var levels = [];
    for (var i = 0; i <= maxD; i++) {
      levels.push({ n: i, label: i === 0 ? 'Thu gọn tất cả' : (i === maxD ? 'Bung tất cả' : 'Cấp ' + (i + 1)),
        hint: i === 0 ? 'Chỉ các khu vực lớn' : (i === maxD ? 'Tới từng byte/nhóm byte nhỏ nhất' : 'Bung tới cấp ' + (i + 1)) });
    }
    var seg = function (items, cur, attr) {
      return '<div class="seg-group">' + items.map(function (L) {
        var on = cur === L.n || cur === L.id;
        return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" ' + attr + '="' + esc(L.n != null ? L.n : L.id) +
          '" aria-pressed="' + on + '"' + (L.hint ? ' title="' + esc(L.hint) + '"' : '') + '>' + esc(L.label) + '</button>';
      }).join('') + '</div>';
    };
    var comp = compressOn(), forced = tv.fm.cols > MAX_PLAIN_COLS;
    var perSec = 1e6 / f.periodUs;
    return '<div class="head-top"><span class="eyebrow">Truyền dẫn · ' + esc(fam) + ' · ' + esc(f.category || '') + '</span>' +
        '<h1 class="stack-title">' + esc(f.name || f.id) + '</h1>' +
        (f.summary ? '<p class="stack-summary">' + esc(f.summary) + '</p>' : '') + '</div>' +
      '<div class="stats">' +
        stat('Lưới', s.rows + ' × ' + n(s.cols, 0), tv.fm.cellBits === 8 ? 'hàng × cột byte' : tv.fm.cellBits === 1 ? 'hàng × cột bit' : 'hàng × cột ô ' + tv.fm.cellBits + ' bit') +
        (bitMode() ? stat('Bit mỗi khung', n(s.bits, 0), '= ' + n(s.bytes, 2) + ' byte')
          : stat('Byte mỗi khung', n(s.bytes, 2), n(s.bytes * 8, 0) + ' bit')) +
        stat('Chu kỳ', periodTxt(f.periodUs), n(perSec, 2) + ' khung/giây', n(f.periodUs, 6) + ' µs') +
        stat('Tốc độ', TV.fmtRate(f.rateKbps), n(f.rateKbps, 3) + ' kbit/s', 'byte/khung × 8 × số khung mỗi giây') +
        stat('Overhead', n(s.overheadPct, 2) + '%', bytesTxt(s.overheadBytes) + ' không phải tải tin/nhánh',
          'Ô có kind khác payload/tributary ở cấp chi tiết nhất') +
        (f.multiframe ? stat('Đa khung', (f.multiframe.frames || '?') + ' khung', f.multiframe.frames ? periodTxt(f.multiframe.frames * f.periodUs) : '', f.multiframe.note) : '') +
      '</div>' +
      (f.detail || f.multiframe ? '<details class="stack-detail"><summary>Giải thích khung này</summary>' +
        (f.detail ? '<p>' + esc(f.detail) + '</p>' : '') +
        (f.multiframe && f.multiframe.note ? '<p><b>Đa khung:</b> ' + esc(f.multiframe.note) + '</p>' : '') +
        (f.standard ? '<p class="muted">Chuẩn: ' + esc(f.standard) + '</p>' : '') + '</details>' : '') +
      '<div class="toolbar" role="toolbar" aria-label="Điều khiển lưới">' +
        '<span class="toolbar-label">Cấp hiển thị</span>' + seg(levels, tv.state.level, 'data-tlevel') +
        '<span class="toolbar-label">Cỡ ô</span>' + seg(ZOOMS, tv.state.zoom, 'data-tzoom') +
        '<button type="button" class="btn-ghost' + (comp ? ' is-on' : '') + '" data-taction="compress" aria-pressed="' + comp + '"' +
          (forced ? ' disabled title="Lưới quá rộng (' + tv.fm.cols + ' cột) — luôn nén"' : ' title="Gộp các cột giống nhau ở mọi hàng thành một dải"') + '>' +
          (comp ? '☑' : '☐') + ' Nén cột</button>' +
        '<button type="button" class="btn-ghost" data-taction="reset" title="Xoá trạng thái thu gọn/chọn/cỡ ô của khung này">Khôi phục mặc định</button>' +
      '</div>' + renderMfBar();
  }

  /** Thanh chọn khung trong đa khung (chỉ khi có region perFrame). */
  function renderMfBar() {
    var N = T().perFrameCount(tv.fm);
    if (!N) return '';
    var cur = tv.state.mf;
    var btn = function (v, label, tip) {
      var on = v === cur;
      return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-tmf="' + (v == null ? 'all' : v) + '" aria-pressed="' + on + '" title="' + esc(tip) + '">' + esc(label) + '</button>';
    };
    var items = [btn(null, 'Tất cả', 'Nhãn chung, không theo khung')];
    if (N > MF_BUTTONS_MAX) return renderMfCompact(N, cur, items[0]);
    for (var k = 0; k < N; k++) items.push(btn(k, String(k), 'Khung ' + k + ' trong đa khung ' + N + ' khung' + (k % 2 ? ' (lẻ)' : ' (chẵn)')));
    return '<div class="toolbar mf-bar" role="toolbar" aria-label="Khung trong đa khung">' +
      '<span class="toolbar-label">Khung trong đa khung</span><div class="seg-group">' + items.join('') + '</div>' +
      '<span class="muted">' + (cur == null ? 'ô có nghĩa đổi theo khung đánh dấu ⟳ — chọn một khung để xem nghĩa riêng' : 'đang xem khung ' + cur + '/' + (N - 1) + ' (0-based)') + '</span></div>';
  }

  /**
   * Bộ chọn gọn cho đa khung dài (> MF_BUTTONS_MAX khung, vd OTU4 OMFI 80, K4 32×…): ô số + trước/sau +
   * danh sách các nhóm khung có nghĩa riêng (mỗi phần tử perFrame một mục, nhảy tới khung đầu của nhóm).
   */
  function renderMfCompact(N, cur, allBtn) {
    var groups = [];
    tv.fm.list.forEach(function (x) {
      (x.region.perFrame || []).forEach(function (p) {
        if (!p || !(p.frames || []).length) return;
        var first = Math.min.apply(null, p.frames);
        groups.push({ first: first, label: framesTxt(p.frames) + ' — ' + (p.abbr || p.name || x.region.abbr || x.region.id) + ' (' + (x.region.abbr || x.region.id) + ')', has: cur != null && p.frames.indexOf(cur) >= 0 });
      });
    });
    groups.sort(function (a, b) { return a.first - b.first; });
    var prev = cur == null ? N - 1 : (cur + N - 1) % N, next = cur == null ? 0 : (cur + 1) % N;
    return '<div class="toolbar mf-bar mf-compact" role="toolbar" aria-label="Khung trong đa khung">' +
      '<span class="toolbar-label">Khung trong đa khung (' + N + ')</span><div class="seg-group">' + allBtn +
        '<button type="button" class="seg-btn" data-tmf="' + prev + '" title="Khung trước" aria-label="Khung trước">‹</button>' +
        '<label class="mf-num"><span class="sr-only">Số khung</span><input type="number" min="0" max="' + (N - 1) + '" step="1" data-tmfnum value="' + (cur == null ? '' : cur) + '" placeholder="0–' + (N - 1) + '"></label>' +
        '<button type="button" class="seg-btn" data-tmf="' + next + '" title="Khung sau" aria-label="Khung sau">›</button></div>' +
      (groups.length ? '<label class="mf-jump"><span class="sr-only">Khung có nghĩa riêng</span><select data-tmfsel title="Các nhóm khung có nghĩa riêng (⟳)">' +
        '<option value="">Khung có nghĩa riêng…</option>' + groups.map(function (g) {
          return '<option value="' + g.first + '"' + (g.has ? ' selected' : '') + '>' + esc(g.label) + '</option>';
        }).join('') + '</select></label>' : '') +
      '<span class="muted">' + (cur == null ? 'nhãn chung — nhập số khung hoặc chọn nhóm khung' : 'đang xem khung ' + cur + '/' + (N - 1) + ' (0-based)') + '</span></div>';
  }
  /** Đặt khung đang xem từ ô số/ô chọn (giá trị ngoài 0…N−1 bị kẹp; rỗng = nhãn chung). */
  function setMf(v) {
    var N = T().perFrameCount(tv.fm);
    if (v === '' || v == null || isNaN(+v)) tv.state.mf = null;
    else tv.state.mf = Math.max(0, Math.min(N - 1, Math.round(+v)));
    save(); render();
  }

  function kindCls(node) {
    var c = 'k-' + node.kind;
    if (node.kind === 'tributary') {
      // các nhánh ghép xen cạnh nhau: luân phiên 3 sắc độ để mắt tách được
      var sib = node.parent >= 0 ? tv.fm.list[node.parent].children : tv.fm.list.filter(function (x) { return x.parent < 0; }).map(function (x) { return x.idx; });
      var k = 0;
      for (var i = 0; i < sib.length; i++) { if (sib[i] === node.idx) break; if (tv.fm.list[sib[i]].kind === 'tributary') k++; }
      c += ' trib-' + (k % 3);
    }
    return c;
  }

  function renderLegend() {
    var kinds = {};
    tv.fm.list.forEach(function (x) { kinds[x.kind] = true; });
    var L = T().KIND_LABEL;
    return '<div class="legend">' + Object.keys(L).filter(function (k) { return kinds[k]; }).map(function (k) {
      return '<span class="lg-item"><span class="lg-sw k-' + k + '"></span>' + esc(L[k]) + '</span>';
    }).join('') + '<span class="lg-item"><span class="lg-sw lg-band"></span>Dải cột nén</span></div>';
  }

  function zoomDims(dcols) {
    var z = ZOOMS.filter(function (x) { return x.id === tv.state.zoom; })[0] || ZOOMS[2];
    if (z.id !== 'fit') return { cw: z.cw, rh: z.rh, bw: z.cw < 10 ? 30 : BAND_W };
    var box = document.getElementById('tg-scroll');
    var avail = Math.max(200, (box ? box.clientWidth : 800) - 40);
    var bands = dcols.filter(function (d) { return d.band; }).length, plain = dcols.length - bands;
    var cw = Math.floor((avail - bands * 30 - dcols.length) / Math.max(plain, 1));
    cw = Math.max(2, Math.min(28, cw));
    return { cw: cw, rh: cw < 8 ? 16 : Math.max(18, Math.min(30, cw + 8)), bw: 30 };
  }

  function renderGrid() {
    var box = document.getElementById('tg-scroll');
    if (!box || !tv.fm) return;
    var fm = tv.fm, TV = T();
    var cells = TV.displayCells(fm, isOpen);
    var comp = compressOn();
    var dcols = TV.columnRuns(fm, cells, comp, tv.state.bands, 3);
    if (dcols.length > 4000) { tv.state.bands = {}; dcols = TV.columnRuns(fm, cells, true, {}, 3); }
    var pieces = TV.mergePieces(fm, cells, dcols);
    var dim = zoomDims(dcols);
    var tmpl = '36px ' + dcols.map(function (d) { return d.band ? dim.bw + 'px' : dim.cw + 'px'; }).join(' ');

    // thước cột
    var every = dim.cw < 6 ? 30 : dim.cw < 12 ? 10 : dim.cw < 20 ? 5 : 1;
    var ruler = bitMode() ? '<span class="tg-corner" style="grid-row:1;grid-column:1" title="hàng \\ bit (cột = vị trí bit trong hàng)">bit</span>'
      : '<span class="tg-corner" style="grid-row:1;grid-column:1" title="hàng \\ cột">h\\c</span>';
    dcols.forEach(function (d, i) {
      var col = i + 2;
      if (d.band) {
        ruler += '<button type="button" class="tg-rc tg-rc--band" style="grid-row:1;grid-column:' + col + '" data-tband="' + d.c0 + '"' +
          ' title="Cột ' + (d.c0 + 1) + '–' + (d.c1 + 1) + (d.period
            ? ' (' + (d.c1 - d.c0 + 1) + ' cột lặp lại đúng mẫu ' + d.period + ' cột ngay trước — ghép xen, ' + ((d.c1 - d.c0 + 1) / d.period) + ' lần nữa)'
            : ' (' + (d.c1 - d.c0 + 1) + ' cột giống nhau)') + ' — bấm để bung">' +
          (d.c0 + 1) + '–' + (d.c1 + 1) + '</button>';
      } else if (d.runStart != null && d.runStart === d.c0 && comp) {
        ruler += '<button type="button" class="tg-rc tg-rc--fold" style="grid-row:1;grid-column:' + col + '" data-tunband="' + d.c0 + '" title="Nén lại dải bắt đầu ở cột ' + (d.c0 + 1) + '">⊟</button>';
      } else if ((d.c0 + 1) % every === 0 || d.c0 === 0) {
        ruler += '<span class="tg-rc" style="grid-row:1;grid-column:' + col + '">' + (d.c0 + 1) + '</span>';
      }
    });
    var rowsH = '';
    for (var r = 0; r < fm.rows; r++) rowsH += '<span class="tg-rh" style="grid-row:' + (r + 2) + ';grid-column:1">' + (r + 1) + '</span>';

    var body = pieces.map(function (p) {
      if (p.owner < 0) return '<span class="tp tp--hole" style="grid-row:' + (p.r + 2) + ' / span ' + p.h + ';grid-column:' + (p.dc + 2) + ' / span ' + p.w + '"></span>';
      var node = fm.list[p.owner];
      var collapsed = node.children.length > 0;
      var anc = TV.ancestry(fm, node.idx).map(function (i) { return fm.list[i].id; }).join(' ');
      var wpx = 0, bandIn = false;
      for (var x = 0; x < p.w; x++) { var dc = dcols[p.dc + x]; wpx += dc.band ? dim.bw : dim.cw; if (dc.band) bandIn = true; }
      var hpx = p.h * dim.rh;
      var ef = eff(node), pf = !!node.region.perFrame;
      var label = ef.abbr + (pf && tv.state.mf == null ? ' ⟳' : '');
      var fitsH = wpx >= label.length * 6.4 + 6 && hpx >= 13;
      var fitsV = !fitsH && hpx >= label.length * 6.4 + 6 && wpx >= 13;
      var c0 = dcols[p.dc].c0, c1 = dcols[p.dc + p.w - 1].c1;
      var tip = (collapsed ? 'Nhóm ' : '') + ef.abbr + (ef.name !== ef.abbr ? ' — ' + ef.name : '') +
        (pf ? (tv.state.mf == null ? ' · nghĩa đổi theo khung trong đa khung' : ' · khung ' + tv.state.mf) : '') +
        ' · ' + T().rectText(node.region.rect) + ' · ' + bytesTxt(node.bytes) + ' · ' + TV.fmtRate(node.kbps) +
        (bandIn ? ' · khối này gồm cột ' + (c0 + 1) + '–' + (c1 + 1) + ' (đã nén)' : '') + (collapsed ? ' — bấm để bung' : '');
      return '<button type="button" class="tp ' + kindCls(node) + (collapsed ? ' is-collapsed' : '') + (pf ? ' has-pf' : '') + (bandIn ? ' has-band' : '') + (wpx > 360 ? ' is-wide' : '') +
        (tv.state.selected === node.id ? ' is-sel' : '') + '" style="grid-row:' + (p.r + 2) + ' / span ' + p.h + ';grid-column:' + (p.dc + 2) + ' / span ' + p.w + '"' +
        ' data-rg="' + esc(node.id) + '" data-anc="' + esc(anc) + '"' + (collapsed ? ' data-texpand="1"' : '') + ' title="' + esc(tip) + '" tabindex="-1">' +
        (fitsH || fitsV ? '<span class="tp-l' + (fitsV ? ' is-vert' : '') + '">' + (collapsed && fitsH && wpx > label.length * 6.4 + 20 ? '⊞ ' : '') + esc(label) + '</span>' : '') +
        '</button>';
    }).join('');

    box.innerHTML = '<div class="tg" style="grid-template-columns:' + tmpl + ';grid-template-rows:22px repeat(' + fm.rows + ',' + dim.rh + 'px);--cw:' + dim.cw + 'px;--rh:' + dim.rh + 'px">' +
      ruler + rowsH + body + '</div>';
    var hint = document.getElementById('tg-hint');
    if (hint) {
      var bands = dcols.filter(function (d) { return d.band; }).length;
      var hasPtr = fm.list.some(function (x) { return x.kind === 'pointer'; });
      hint.textContent = fm.rows + ' hàng × ' + fm.cols + (bitMode() ? ' bit' : ' cột') + (bands ? ' · ' + bands + ' dải cột đang nén (bấm số cột ở thước để bung)' : '') +
        ' · bấm khối ⊞ để bung' + (hasPtr ? ' · VC trong lưới vẽ ở vị trí cố định để dễ học (thực tế trôi theo con trỏ)' : '');
    }
    applyHl();
  }

  // ---------- cây region ----------
  function renderTree() {
    var el = document.getElementById('ttree');
    if (!el) return;
    var tops = tv.fm.list.filter(function (x) { return x.parent < 0; });
    el.innerHTML = tops.map(function (x) { return treeNode(x, 1); }).join('') || '<p class="muted">Khung chưa có region.</p>';
    var target = (tv.focusId && rowEl(tv.focusId)) || (tv.state.selected && rowEl(tv.state.selected)) || el.querySelector('.row');
    if (target) {
      target.setAttribute('tabindex', '0');
      if (tv.focusId && rowEl(tv.focusId)) { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }
    }
  }
  function rowEl(id) { return document.querySelector('#ttree .row[data-trg="' + cssEsc(id) + '"]'); }

  function treeNode(x, level) {
    var open = isOpen(x), canOpen = x.children.length > 0;
    var sel = tv.state.selected === x.id;
    return '<div class="node tnode' + (open ? ' is-open' : '') + '">' +
      '<div class="row row--treg' + (sel ? ' is-sel' : '') + '" role="treeitem" aria-level="' + level + '"' + (canOpen ? ' aria-expanded="' + open + '"' : '') +
        ' aria-selected="' + sel + '" tabindex="-1" data-trg="' + esc(x.id) + '">' +
        (canOpen ? '<button type="button" class="caret" data-taction="toggle" tabindex="-1" aria-hidden="true">' + (open ? '▾' : '▸') + '</button>'
          : '<span class="caret caret--none" aria-hidden="true"></span>') +
        '<span class="swatch ' + kindCls(x) + '" aria-hidden="true"></span>' +
        '<span class="row-name"><span class="nm">' + esc(eff(x).abbr) + '</span>' +
          (eff(x).name !== eff(x).abbr ? '<span class="abbr">' + esc(eff(x).name) + '</span>' : '') +
          (x.region.perFrame ? '<span class="badge badge--range" title="Nghĩa thay đổi theo khung trong đa khung">⟳ theo khung</span>' : '') +
          '<span class="dash">–</span><b class="sz">' + esc(bytesTxt(x.bytes)) + '</b>' +
          '<span class="chip">' + esc(T().KIND_LABEL[x.kind] || x.kind) + '</span>' +
          (x.region.repeat ? '<span class="badge badge--range">' + esc(x.region.repeat) + '</span>' : '') +
        '</span>' +
        '<span class="row-meta">' + esc(T().rectText(x.region.rect) + ' · ' + T().fmtRate(x.kbps)) + '</span>' +
      '</div>' +
      (open ? '<div class="node-body" role="group">' + x.children.map(function (i) { return treeNode(tv.fm.list[i], level + 1); }).join('') + '</div>' : '') +
      '</div>';
  }

  // ---------- panel chi tiết ----------
  function dl(rows) {
    return '<dl class="kv">' + rows.filter(Boolean).map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>';
  }

  function renderDetail() {
    var el = document.getElementById('detail');
    var x = tv.state.selected && tv.fm.byId[tv.state.selected];
    el.innerHTML = '<div class="detail-card">' + (x ? detailRegion(x) : detailFrame()) + '</div>' + (x ? '' : help());
  }

  function help() {
    return '<div class="detail-empty"><h2>Cách dùng</h2><ol>' +
      '<li>Mỗi ô của lưới là một ' + unitWord() + '; màu theo loại (đồng bộ, SOH, con trỏ, POH, tải tin…).</li>' +
      (T().perFrameCount(tv.fm) ? '<li>Khung có <b>đa khung</b>: chọn “Khung 0 … ' + (T().perFrameCount(tv.fm) - 1) + '” để xem nghĩa riêng của các ô đánh dấu ⟳ ở từng khung.</li>' : '') +
      '<li><b>Cấp hiển thị</b>: thu gọn thành vài khối lớn hoặc bung tới từng byte (khung PDH E2–E4: từng bit); bấm khối ⊞ để bung riêng khối đó.</li>' +
      '<li>Khung rộng được <b>nén cột</b>: các cột giống hệt nhau gộp thành một dải; bấm số cột ở thước để bung.</li>' +
      '<li>Rê chuột lên một nhánh ghép xen (TUG/TU) để thấy mọi cột của nó sáng lên.</li>' +
      '<li>Chọn một khối hoặc một dòng ở cây để xem vị trí, số ' + unitWord() + ', tốc độ riêng và cấu trúc bit.</li></ol></div>';
  }

  function detailFrame() {
    var f = tv.frame, s = tv.fm.stats, MUX = window.TMUX || {};
    var u = f.unit && MUX[f.unit];
    var labs = (window.TLABS || []).filter(function (l) {
      return f.unit && ((l.roots || []).indexOf(f.unit) >= 0 || (l.palette || []).indexOf(f.unit) >= 0);
    });
    return '<span class="eyebrow">Khung · ' + esc((f.family || '').toUpperCase()) + '</span><h2>' + esc(f.name) + '</h2>' +
      (f.summary ? '<p class="lead">' + esc(f.summary) + '</p>' : '') +
      dl([
        ['Lưới', esc(s.rows + ' hàng × ' + s.cols + ' cột (ô ' + tv.fm.cellBits + ' bit)')],
        ['Kích thước', esc((bitMode() ? n(s.bits, 0) + ' bit' : n(s.bytes, 2) + ' byte') + ' / ' + periodTxt(f.periodUs))],
        ['Tốc độ', esc(T().fmtRate(f.rateKbps))],
        ['Overhead', esc(n(s.overheadPct, 2) + '% (' + bytesTxt(s.overheadBytes) + ')')],
        f.multiframe ? ['Đa khung', esc((f.multiframe.frames || '?') + ' khung' + (f.multiframe.note ? ' — ' + f.multiframe.note : ''))] : null,
        u ? ['Đơn vị ghép', esc(u.name) + (u.summary ? ' — ' + esc(u.summary) : '')] : null,
        f.standard ? ['Chuẩn', esc(f.standard)] : null
      ]) +
      (f.detail ? '<p>' + esc(f.detail) + '</p>' : '') +
      (labs.length ? '<p>' + labs.map(function (l) { return '<a class="btn-ghost btn-link" href="#lab/' + esc(l.id) + '">⚗ Mở “' + esc(l.name) + '”</a>'; }).join(' ') + '</p>' : '');
  }

  function detailRegion(x) {
    var rg = x.region, fm = tv.fm, e = eff(x), mf = tv.state.mf;
    var crumbs = T().ancestry(fm, x.idx).slice(0, -1).map(function (i) {
      var a = fm.list[i];
      return '<a href="#" data-tgoto="' + esc(a.id) + '">' + esc(eff(a).abbr) + '</a>';
    });
    var html = (crumbs.length ? '<nav class="crumbs">' + esc(tv.frame.name) + ' › ' + crumbs.join(' › ') + '</nav>' : '<nav class="crumbs">' + esc(tv.frame.name) + '</nav>') +
      '<span class="eyebrow"><span class="swatch ' + kindCls(x) + '"></span>' + esc(T().KIND_LABEL[x.kind] || x.kind) +
        (rg.perFrame ? ' · ' + (mf == null ? 'nghĩa đổi theo khung' : 'khung ' + mf) : '') + '</span>' +
      '<h2>' + esc(e.abbr) + (e.name !== e.abbr ? ' <span class="abbr">— ' + esc(e.name) + '</span>' : '') + '</h2>' +
      dl([
        ['Vị trí', esc(T().rectText(rg.rect))],
        [bitMode() ? 'Số bit' : 'Số byte', esc(bytesTxt(x.bytes) + ' mỗi khung (' + x.cells + ' ô)')],
        ['Tốc độ riêng', esc(T().fmtRate(x.kbps)) + ' <span class="muted">= ' + esc(x.cells + ' × ' + fm.cellBits + ' bit × ' + n(1e6 / tv.frame.periodUs, 2) + '/s') + '</span>'],
        rg.repeat ? ['Lặp ở STM-N', esc(rg.repeat)] : null,
        rg.rect.step > 1 ? ['Ghép xen', esc('mỗi ' + rg.rect.step + ' cột lấy 1 cột (' + (bitMode() ? 'bit' : 'byte') + '-interleave)')] : null
      ]) +
      (e.desc ? '<p>' + esc(e.desc) + '</p>' : '') +
      (e.pf && rg.desc && rg.desc !== e.desc ? '<p class="muted">Chung: ' + esc(rg.desc) + '</p>' : '');
    if (e.values && e.values.length) {
      html += '<h3>Giá trị đáng nhớ</h3><div class="tbl-wrap"><table class="values"><thead><tr><th>Giá trị</th><th>Ý nghĩa</th></tr></thead><tbody>' +
        e.values.map(function (v) { return '<tr><td><code>' + esc(v.v) + '</code></td><td>' + esc(v.m) + '</td></tr>'; }).join('') + '</tbody></table></div>';
    }
    if (e.bitFields && e.bitFields.length) html += bitTable(e.bitFields, mf != null && rg.perFrame ? 'Cấu trúc bit — khung ' + mf : 'Cấu trúc bit');
    if (rg.perFrame && rg.perFrame.length) {
      html += '<h3>Nghĩa theo từng khung</h3><div class="tbl-wrap"><table class="values pf-table"><thead><tr><th>Khung</th><th>Nhãn</th><th>Ý nghĩa</th></tr></thead><tbody>' +
        rg.perFrame.map(function (p) {
          var on = mf != null && (p.frames || []).indexOf(mf) >= 0;
          var first = (p.frames || [])[0];
          return '<tr' + (on ? ' class="is-cur"' : '') + '><td><button type="button" class="link-btn" data-tmf="' + first + '" title="Xem khung ' + first + '">' + esc(framesTxt(p.frames)) + '</button></td>' +
            '<td><b>' + esc(p.abbr || rg.abbr || '') + '</b>' + (p.bitFields ? '<br><code class="pf-bits">' + esc(p.bitFields.map(function (b) { return b.abbr || b.name; }).join(' ')) + '</code>' : '') + '</td>' +
            '<td>' + (p.name ? '<b>' + esc(p.name) + '</b><br>' : '') + '<span class="muted">' + esc(p.desc || '') + '</span></td></tr>';
        }).join('') + '</tbody></table></div>' +
        (mf != null ? '<p><button type="button" class="btn-ghost btn-sm" data-tmf="all">Xem nhãn chung (Tất cả)</button></p>' : '<p class="muted var-hint">Chọn khung ở thanh “Khung trong đa khung” hoặc bấm số khung trong bảng.</p>');
    }
    if (x.children.length) {
      html += '<h3>Gồm</h3><ul class="plain">' + x.children.map(function (i) {
        var c = fm.list[i];
        return '<li><a href="#" data-tgoto="' + esc(c.id) + '">' + esc(eff(c).abbr) + '</a> <span class="muted">' + esc(bytesTxt(c.bytes) + ' · ' + T().fmtRate(c.kbps)) + '</span></li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  function bitTable(bfs, title) {
    var pos = 1, total = bfs.reduce(function (s, b) { return s + b.bits; }, 0);
    return '<h3>' + esc(title) + '</h3>' + bitStrip(bfs) +
      '<div class="tbl-wrap"><table class="values"><thead><tr><th>Bit</th><th>Trường</th><th>Ý nghĩa</th></tr></thead><tbody>' +
      bfs.map(function (b) {
        var a = pos, z = pos + b.bits - 1; pos = z + 1;
        return '<tr><td><code>' + (a === z ? a : a + '–' + z) + '</code></td><td><b>' + esc(b.abbr || b.name) + '</b>' +
          (b.abbr && b.abbr !== b.name ? '<br><span class="muted">' + esc(b.name) + '</span>' : '') + '</td><td>' + esc(b.desc) + '</td></tr>';
      }).join('') + '</tbody></table></div><p class="muted var-hint">' +
      (total === 8 ? 'Bit đánh số 1–8 từ bit có trọng số lớn nhất (quy ước ITU-T).' : 'Bit đánh số từ 1 theo thứ tự truyền.') + '</p>';
  }

  /** Dải bit nhỏ minh hoạ bitFields (mỗi hàng 8 bit). */
  function bitStrip(bfs) {
    var total = bfs.reduce(function (s, b) { return s + b.bits; }, 0);
    var cols = Math.min(total, 8);
    return '<div class="bitstrip" style="grid-template-columns:repeat(' + cols + ',minmax(0,1fr))">' + bfs.map(function (b, i) {
      return '<span class="bs-cell bs-' + (i % 4) + '" style="grid-column:span ' + Math.min(b.bits, cols) + '" title="' + esc(b.name + ' — ' + b.bits + ' bit') + '">' +
        esc(b.abbr || b.name) + '<small>' + b.bits + '</small></span>';
    }).join('') + '</div>';
  }

  // ---------- tương tác ----------
  function select(id, reveal) {
    var x = tv.fm.byId[id];
    if (!x) return;
    tv.state.selected = id;
    if (reveal) {
      var p = x.parent;
      while (p >= 0) { tv.state.open[tv.fm.list[p].id] = true; p = tv.fm.list[p].parent; }
    }
    save();
    if (reveal) { renderGrid(); renderTree(); }
    else {
      Array.prototype.forEach.call(document.querySelectorAll('#view-t .is-sel'), function (e) { e.classList.remove('is-sel'); });
      Array.prototype.forEach.call(document.querySelectorAll('#view-t [data-rg="' + cssEsc(id) + '"], #ttree .row[data-trg="' + cssEsc(id) + '"]'), function (e) { e.classList.add('is-sel'); });
      Array.prototype.forEach.call(document.querySelectorAll('#ttree .row[aria-selected="true"]'), function (e) { e.setAttribute('aria-selected', 'false'); });
      var r = rowEl(id); if (r) r.setAttribute('aria-selected', 'true');
    }
    renderDetail();
    var row = rowEl(id);
    if (reveal && row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function toggle(id, force) {
    var x = tv.fm.byId[id];
    if (!x || !x.children.length) return;
    tv.state.open[id] = force == null ? !isOpen(x) : !!force;
    tv.focusId = id;
    save();
    renderGrid(); renderTree();
  }

  function setHl(id) { tv.hl = id; applyHl(); }
  /** Sáng mọi khối thuộc region (kể cả con, kể cả cột ghép xen) + khối đại diện nếu đang bị gộp. */
  function applyHl() {
    Array.prototype.forEach.call(document.querySelectorAll('#view-t .is-hl'), function (e) { e.classList.remove('is-hl'); });
    var id = tv.hl;
    if (!id || !tv.fm || !tv.fm.byId[id]) return;
    var els = document.querySelectorAll('#view-t [data-anc~="' + cssEsc(id) + '"]');
    if (!els.length) {
      var disp = T().displayMap(tv.fm, isOpen)[tv.fm.byId[id].idx];
      els = document.querySelectorAll('#view-t [data-rg="' + cssEsc(tv.fm.list[disp].id) + '"]');
    }
    Array.prototype.forEach.call(els, function (e) { e.classList.add('is-hl'); });
    var r = rowEl(id); if (r) r.classList.add('is-hl');
  }

  function onOver(e) {
    var t = e.target.closest && e.target.closest('[data-rg], [data-trg]');
    var id = t ? (t.getAttribute('data-rg') || t.getAttribute('data-trg')) : null;
    if (id !== tv.hl) setHl(id);
  }

  function onClick(e) {
    if (!tv.active) return;
    var t = e.target; if (!t.closest) return;
    var b;
    if ((b = t.closest('[data-tlevel]'))) { tv.state.level = +b.getAttribute('data-tlevel'); tv.state.open = {}; save(); render(); return; }
    if ((b = t.closest('[data-tmf]'))) {
      var v = b.getAttribute('data-tmf');
      tv.state.mf = v === 'all' ? null : +v; save(); render(); return;
    }
    if ((b = t.closest('[data-tzoom]'))) { tv.state.zoom = b.getAttribute('data-tzoom'); save(); render(); return; }
    if ((b = t.closest('[data-taction="compress"]'))) { tv.state.compress = !compressOn(); tv.state.bands = {}; save(); render(); return; }
    if ((b = t.closest('[data-taction="reset"]'))) { tv.state = defaultState(); save(); render(); return; }
    if ((b = t.closest('[data-tband]'))) {
      var c0 = +b.getAttribute('data-tband');
      var m = /(\d+)–(\d+)/.exec(b.textContent || '');
      if (m && +m[2] - +m[1] + 1 > MAX_BAND_EXPAND) {
        document.getElementById('tg-hint').textContent = 'Dải ' + m[0] + ' quá rộng để trải từng cột — hãy bung region (khối ⊞) hoặc chọn cấp chi tiết hơn.';
        return;
      }
      tv.state.bands[c0] = true; save(); renderGrid(); return;
    }
    if ((b = t.closest('[data-tunband]'))) { delete tv.state.bands[+b.getAttribute('data-tunband')]; save(); renderGrid(); return; }
    if ((b = t.closest('.tp[data-rg]'))) {
      var id = b.getAttribute('data-rg');
      if (b.hasAttribute('data-texpand')) { tv.state.selected = id; toggle(id, true); renderDetail(); }
      else select(id, false);
      return;
    }
    if ((b = t.closest('[data-taction="toggle"]'))) { toggle(b.closest('.row').getAttribute('data-trg')); return; }
    var row = t.closest('#ttree .row');
    if (row) { focusRow(row); select(row.getAttribute('data-trg'), false); }
  }

  function focusRow(row) {
    if (!row) return;
    Array.prototype.forEach.call(document.querySelectorAll('#ttree .row[tabindex="0"]'), function (r) { r.setAttribute('tabindex', '-1'); });
    row.setAttribute('tabindex', '0');
    row.focus();
    tv.focusId = row.getAttribute('data-trg');
  }

  function onKey(e) {
    var row = e.target.closest && e.target.closest('#ttree .row');
    if (!row) return;
    var rows = Array.prototype.slice.call(document.querySelectorAll('#ttree .row'));
    var i = rows.indexOf(row), id = row.getAttribute('data-trg'), x = tv.fm.byId[id];
    switch (e.key) {
      case 'ArrowDown': focusRow(rows[Math.min(i + 1, rows.length - 1)]); break;
      case 'ArrowUp': focusRow(rows[Math.max(i - 1, 0)]); break;
      case 'ArrowRight': if (x.children.length && !isOpen(x)) toggle(id, true); else focusRow(rows[i + 1] || row); break;
      case 'ArrowLeft':
        if (x.children.length && isOpen(x)) toggle(id, false);
        else if (x.parent >= 0) focusRow(rowEl(tv.fm.list[x.parent].id));
        break;
      case 'Enter': select(id, false); break;
      case ' ': toggle(id); break;
      default: return;
    }
    setHl(tv.focusId || id);
    e.preventDefault();
  }

  window.TransView = { init: init, show: show, hide: hide };
})();
