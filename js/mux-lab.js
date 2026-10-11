/*
 * mux-lab.js — Phòng thí nghiệm ghép kênh: ghép "từ bé đến lớn" bằng tay.
 *  - chọn khung đích (lab.roots), cây ô trống dựng theo TMUX.accepts;
 *  - kéo thả (HTML5 DnD) hoặc bấm-chọn rồi bấm ô (cảm ứng/bàn phím) từ palette;
 *    thả đơn vị bậc thấp → tự dựng chuỗi trung gian, báo overhead từng bước; sai → từ chối kèm giải thích;
 *  - chọn phương án accepts riêng cho từng nút (vd TUG-3: 7×TUG-2 hoặc 1×TU-3);
 *  - bộ đếm theo loại, "Lấp đầy", bảng overhead theo cấp + cột chồng; chế độ "Đóng gói từng bước".
 * Mọi quy tắc lấy từ dữ liệu (TransViz.lab trong tmodel.js) — thêm PDH/OTN chỉ cần thêm dữ liệu.
 */
(function () {
  'use strict';

  var STORE_PREFIX = 'fs.lab.v1.';
  var BIG_TREE = 400; // cây lớn hơn → các hộp sâu mặc định thu gọn

  var lb = { active: false, lab: null, st: null, armed: null, drag: null, msg: null, lastPath: null, sel: null, confirmClear: false };

  function TV() { return window.TransViz; }
  function L() { return window.TransViz.lab; }
  function MUX() { return window.TMUX || {}; }
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function storeGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function storeSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* đầy/riêng tư */ } }
  function nm(id) { return L().nameOf(MUX(), id); }
  function n(x, d) { return TV().fmtNum(x, d == null ? 2 : d); }
  function pkey(p) { return p.join('.'); }
  function parsePath(s) { return s === '' || s == null ? [] : String(s).split('.').map(Number); }

  // ---------- trạng thái ----------
  function loadSt(lab) {
    var s = storeGet(STORE_PREFIX + lab.id) || {};
    if (!s.trees || typeof s.trees !== 'object') s.trees = {};
    if (!s.collapsed || typeof s.collapsed !== 'object') s.collapsed = {};
    if ((lab.roots || []).indexOf(s.root) < 0) s.root = (lab.roots || [])[0];
    if (!s.step || typeof s.step !== 'object') s.step = { client: null, n: 1 };
    return s;
  }
  function save() { if (lb.lab) storeSet(STORE_PREFIX + lb.lab.id, lb.st); }
  function tree() {
    var r = lb.st.root;
    var t = lb.st.trees[r];
    if (!t || t.u !== r) t = lb.st.trees[r] = L().newNode(MUX(), r);
    return t;
  }

  // ---------- vào/ra ----------
  function init() {
    if (!window.TransViz || !window.TransViz.lab) throw new Error('Không nạp được js/tmodel.js');
    var v = document.getElementById('view-lab');
    v.addEventListener('click', onClick);
    v.addEventListener('change', onChange);
    v.addEventListener('dragstart', onDragStart);
    v.addEventListener('dragend', function () { lb.drag = null; clearOver(); });
    v.addEventListener('dragover', onDragOver);
    v.addEventListener('dragleave', function (e) { var t = e.target.closest && e.target.closest('[data-drop]'); if (t) t.classList.remove('is-over', 'is-bad'); });
    v.addEventListener('drop', onDrop);
    v.addEventListener('keydown', function (e) {
      // bàn phím: Enter/Space trên ô trống/hộp khi đang cầm một đơn vị → thả
      var t = e.target.closest && e.target.closest('[data-drop]');
      if (!t || t !== e.target || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      if (lb.armed) doPlace(parsePath(t.getAttribute('data-drop')), lb.armed);
      else { lb.msg = { ok: false, html: 'Chọn một đơn vị ở bảng bên trái trước (bấm vào nó), rồi Enter tại ô muốn thả.' }; render(); }
    });
    document.addEventListener('keydown', function (e) { if (lb.active && e.key === 'Escape' && lb.armed) { lb.armed = null; render(); } });
    document.getElementById('detail').addEventListener('click', function (e) {
      if (!lb.active) return;
      var a = e.target.closest && e.target.closest('[data-lunit]');
      if (a) { e.preventDefault(); showUnit(a.getAttribute('data-lunit')); }
    });
  }
  function show(id) {
    var lab = (window.TLABS || []).filter(function (l) { return l.id === id; })[0];
    lb.active = true;
    if (!lab) { document.getElementById('view-lab').innerHTML = '<div class="empty"><h1>Không có phòng thí nghiệm “' + esc(id) + '”</h1></div>'; return; }
    lb.lab = lab; lb.st = loadSt(lab); lb.msg = null; lb.armed = null; lb.sel = null; lb.lastPath = null;
    render();
  }
  function hide() { lb.active = false; }

  // ---------- vẽ ----------
  function render() {
    var lab = lb.lab, t = tree(), M = MUX();
    document.getElementById('alerts').innerHTML = window.AppNav ? window.AppNav.loadAlertsHtml() : '';
    var roots = (lab.roots || []).filter(function (r) { return M[r]; });
    var v = document.getElementById('view-lab');
    var scrollY = window.scrollY;
    v.innerHTML =
      '<section class="stack-head"><div class="head-top"><span class="eyebrow">Phòng thí nghiệm · ' + esc((lab.family || '').toUpperCase()) + '</span>' +
        '<h1 class="stack-title">' + esc(lab.name) + '</h1>' + (lab.intro ? '<p class="stack-summary">' + esc(lab.intro) + '</p>' : '') + '</div>' +
        '<div class="toolbar" role="toolbar" aria-label="Khung đích"><span class="toolbar-label">Khung đích</span><div class="seg-group">' +
        roots.map(function (r) {
          var on = r === lb.st.root;
          return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-lroot="' + esc(r) + '" aria-pressed="' + on + '">' + esc(nm(r)) + '</button>';
        }).join('') + '</div>' +
        '<span class="muted lab-rate">' + esc(TV().fmtRate(L().unitBytes(M, lb.st.root) * 64)) + ' · ' + esc(n(L().unitBytes(M, lb.st.root), 0)) + ' byte/125 µs</span>' +
        '<button type="button" class="btn-ghost' + (lb.confirmClear ? ' is-danger' : '') + '" data-laction="clear">' + (lb.confirmClear ? 'Bấm lần nữa để xoá hết' : 'Xoá hết') + '</button>' +
        '</div></section>' +
      '<div class="lab-grid">' +
        '<section class="card lab-pal" aria-label="Bảng đơn vị">' + renderPalette() + '</section>' +
        '<section class="card lab-work" aria-label="Khung đang ghép">' +
          '<div class="section-title"><h2>Cây ghép kênh</h2><span class="muted">kéo đơn vị vào ô trống · hoặc bấm đơn vị rồi bấm ô</span></div>' +
          '<div class="lab-msg" aria-live="polite">' + renderMsg() + '</div>' +
          '<div class="lab-tree">' + renderBox(t, lb.st.root, [], 0, null, countNodes(t) > BIG_TREE) + '</div>' +
        '</section>' +
      '</div>' +
      '<section class="card" aria-label="Tổng kết">' + renderTotals(t) + '</section>' +
      '<section class="card" aria-label="Bộ đếm theo loại">' + renderCounters(t) + '</section>' +
      '<section class="card" aria-label="Đóng gói từng bước">' + renderSteps() + '</section>';
    if (lb.sel) showUnit(lb.sel, true); else renderDetailIntro();
    window.scrollTo(0, scrollY);
    var fresh = v.querySelector('.is-new');
    if (fresh && fresh.scrollIntoView) { var r = fresh.getBoundingClientRect(); if (r.top < 0 || r.bottom > window.innerHeight) fresh.scrollIntoView({ block: 'nearest' }); }
  }

  function renderMsg() {
    var m = lb.msg;
    var armed = lb.armed ? '<div class="alert alert--info">Đang cầm <b>' + esc(nm(lb.armed)) + '</b> — bấm một ô trống hoặc một hộp để thả (Esc để bỏ).</div>' : '';
    if (!m) return armed;
    return armed + '<div class="alert ' + (m.ok ? 'alert--ok' : 'alert--error') + '">' + m.html + '</div>';
  }

  function renderPalette() {
    var M = MUX(), root = lb.st.root;
    var items = (lb.lab.palette || []).filter(function (id) { return M[id]; });
    items.sort(function (a, b) { return (M[a].level || 0) - (M[b].level || 0); });
    return '<div class="section-title"><h2>Đơn vị</h2><span class="muted">từ bé đến lớn</span></div>' +
      '<div class="pal-list">' + items.map(function (id) {
        var u = M[id], client = L().isClient(M, id);
        var max = L().maxCount(M, root, id);
        var size = client ? TV().fmtRate(u.rateKbps) : n(u.bytesPer125us, 0) + ' B';
        return '<button type="button" class="pal-item k-' + (client ? 'client' : u.kind) + (lb.armed === id ? ' is-armed' : '') + (max ? '' : ' is-na') +
          '" draggable="true" data-lpal="' + esc(id) + '" aria-pressed="' + (lb.armed === id) + '" title="' +
          esc((u.summary || '') + (max ? ' — tối đa ' + max + ' trong ' + nm(root) : ' — không ghép được vào ' + nm(root))) + '">' +
          '<span class="pal-name">' + esc(nm(id)) + '</span><span class="pal-size">' + esc(size) + '</span></button>';
      }).join('') + '</div>' +
      '<p class="muted pal-hint">Số byte là mỗi 125 µs (1 byte/125 µs = 64 kbit/s). Thả E1 thẳng vào TUG-2, TUG-3, VC-4… — các bước trung gian tự dựng.</p>';
  }

  function countNodes(t) { var c = 0; (function w(x) { if (!x) return; c++; x.kids.forEach(w); })(t); return c; }

  /** Đếm client trong cây con: { e1: 3, … }. */
  function clientsIn(node) {
    var out = {}, M = MUX();
    (function w(x) { if (!x) return; if (L().isClient(M, x.u)) out[x.u] = (out[x.u] || 0) + 1; x.kids.forEach(w); })(node);
    return out;
  }
  function clientsTxt(c) { return Object.keys(c).map(function (k) { return c[k] + ' ' + nm(k); }).join(' + '); }

  function ohTxt(node) {
    var u = MUX()[node.u];
    if (!u || !u.accepts || node.opt < 0) return '';
    var a = u.accepts[node.opt], b = (a.overhead && a.overhead.bytes) || 0;
    return b ? '+' + n(b, 0) + ' B' : '';
  }
  function ohTitle(node) {
    var u = MUX()[node.u];
    if (!u || !u.accepts || node.opt < 0) return u ? u.summary || '' : '';
    var a = u.accepts[node.opt];
    var oh = a.overhead || {};
    return nm(node.u) + ' = ' + a.count + '×' + nm(a.of) + (oh.bytes ? ' + ' + oh.bytes + ' B ' + (oh.name || 'overhead') : '') +
      (a.mapping ? ' · ánh xạ ' + a.mapping : '') + (oh.desc && oh.desc !== oh.name ? '\n' + oh.desc : '') + (a.note ? '\n' + a.note : '');
  }

  /**
   * Một "hộp": gộp chuỗi bắt buộc 1×… thành một dòng (STM-1 › AUG-1 › AU-4 › VC-4), rồi vẽ các ô con.
   * node có thể null (ô trống của đơn vị su).
   */
  function renderBox(node, su, path, depth, idxLabel, big) {
    var M = MUX();
    var isNew = lb.lastPath && pkey(lb.lastPath).indexOf(pkey(path)) === 0 && lb.lastPath.length >= path.length;
    if (!node) {
      var canOpen = M[su] && M[su].accepts && M[su].accepts.length;
      return '<div class="lab-slot" data-drop="' + pkey(path) + '" role="button" tabindex="0" title="Ô trống ' + esc(nm(su)) + ' — thả đơn vị vào đây">' +
        '<span class="slot-name">' + esc(nm(su)) + (idxLabel ? ' <small>#' + idxLabel + '</small>' : '') + '</span><span class="slot-hint">trống</span>' +
        (canOpen && (M[su].accepts.length > 1) ? '<button type="button" class="slot-open" data-linst="' + pkey(path) + '" title="Tạo ' + esc(nm(su)) + ' để chọn phương án">chọn phương án</button>' : '') +
        '</div>';
    }
    // chuỗi 1×
    var chain = [{ node: node, path: path }];
    var cur = node, cp = path;
    while (cur.opt >= 0 && M[cur.u].accepts[cur.opt].count === 1 && cur.kids[0]) {
      cp = cp.concat(0); cur = cur.kids[0];
      chain.push({ node: cur, path: cp });
    }
    var last = chain[chain.length - 1];
    var lu = M[last.node.u];
    var leafClient = L().isClient(M, last.node.u);
    var pk = pkey(path);
    var collapsedDefault = big && depth >= 2;
    var collapsed = lb.st.collapsed[pk] != null ? lb.st.collapsed[pk] : collapsedDefault;
    var compact = leafClient && depth > 0;

    var head = chain.map(function (c, i) {
      var u = M[c.node.u];
      var multi = u && u.accepts && u.accepts.length > 1;
      var oh = ohTxt(c.node);
      return (i ? '<span class="ch-sep" aria-hidden="true">›</span>' : '') +
        '<span class="ch-item k-' + (L().isClient(M, c.node.u) ? 'client' : u.kind) + '">' +
          '<button type="button" class="ch-name" data-lsel="' + esc(c.node.u) + '" title="' + esc(ohTitle(c.node)) + '">' + esc(nm(c.node.u)) + '</button>' +
          (oh ? '<span class="ch-oh" title="' + esc(ohTitle(c.node)) + '">' + esc(oh) + '</span>' : '') +
          (multi && c.node.opt >= 0 ? optSelect(c.node, c.path) : '') +
        '</span>';
    }).join('');

    var cls = 'lab-box' + (compact ? ' is-compact' : '') + (depth === 0 ? ' is-root' : '') + (isNew && lb.lastPath && pkey(lb.lastPath) === pkey(last.path) ? ' is-new' : '');
    var tools = (path.length ? '<button type="button" class="box-x" data-lremove="' + pk + '" title="Gỡ ' + esc(nm(node.u)) + ' khỏi ô này" aria-label="Gỡ">×</button>' : '');
    if (compact) {
      return '<div class="' + cls + '" data-drop="' + pk + '">' + (idxLabel ? '<span class="box-idx">#' + idxLabel + '</span>' : '') +
        '<span class="box-chain">' + head + '</span>' + tools + '</div>';
    }

    var body = '';
    var summary = '';
    if (last.node.opt < 0 && lu && lu.accepts) {
      body = '<div class="opt-pick"><span class="muted">Chọn cách lấp ' + esc(nm(last.node.u)) + ':</span> ' + lu.accepts.map(function (a, i) {
        return '<button type="button" class="var-chip" data-lopt="' + pkey(last.path) + '" data-lval="' + i + '" title="' + esc((a.overhead && a.overhead.bytes ? '+' + a.overhead.bytes + ' B ' + (a.overhead.name || '') : 'không thêm overhead') + (a.note ? ' — ' + a.note : '')) + '">' +
          a.count + '×' + esc(nm(a.of)) + '</button>';
      }).join(' ') + '<span class="muted"> · hoặc thả thẳng đơn vị vào hộp này</span></div>';
    } else if (lu && lu.accepts) {
      var a = lu.accepts[last.node.opt];
      var filled = last.node.kids.filter(Boolean).length;
      var cl = clientsIn(last.node);
      summary = '<span class="box-sum">' + filled + '/' + a.count + ' ' + esc(nm(a.of)) + (clientsTxt(cl) ? ' · ' + esc(clientsTxt(cl)) : '') + '</span>';
      if (!collapsed) {
        body = '<div class="box-kids' + (a.count > 4 ? ' is-many' : '') + '">' + last.node.kids.map(function (k, i) {
          return renderBox(k, a.of, last.path.concat(i), depth + 1, a.count > 1 ? String(i + 1) : null, big);
        }).join('') + '</div>';
      }
    }
    var canCollapse = lu && lu.accepts && last.node.opt >= 0;
    return '<div class="' + cls + '" data-drop="' + pk + '">' +
      '<div class="box-head">' +
        (canCollapse ? '<button type="button" class="caret" data-lcollapse="' + pk + '" data-lstate="' + (collapsed ? 1 : 0) + '" aria-expanded="' + !collapsed + '" title="Thu gọn/bung">' + (collapsed ? '▸' : '▾') + '</button>' : '') +
        (idxLabel ? '<span class="box-idx">#' + idxLabel + '</span>' : '') +
        '<span class="box-chain">' + head + '</span>' + summary + tools +
      '</div>' + body + '</div>';
  }

  function optSelect(node, path) {
    var u = MUX()[node.u];
    return '<select class="ch-opt" data-loptsel="' + pkey(path) + '" title="Phương án lấp ' + esc(nm(node.u)) + ' (đổi sẽ xoá nội dung bên trong)">' +
      u.accepts.map(function (a, i) { return '<option value="' + i + '"' + (i === node.opt ? ' selected' : '') + '>' + a.count + '×' + esc(nm(a.of)) + '</option>'; }).join('') +
      '</select>';
  }

  // ---------- tổng kết ----------
  function renderTotals(t) {
    var M = MUX(), acc = L().account(M, t);
    var total = acc.totalBytes;
    var segs = [
      { k: 'client', label: 'Tải khách hàng', b: acc.clientBytes },
      { k: 'stuff', label: 'Chèn/bù tốc độ (stuff)', b: acc.justification },
      { k: 'oh', label: 'Overhead các cấp', b: acc.overheadBytes },
      { k: 'empty', label: 'Chưa dùng', b: acc.empty }
    ];
    var bar = '<div class="sbar" role="img" aria-label="' + esc(segs.map(function (s) { return s.label + ' ' + n(s.b / total * 100) + '%'; }).join(', ')) + '">' +
      segs.filter(function (s) { return s.b > 1e-9; }).map(function (s) {
        var pct = s.b / total * 100;
        return '<span class="sbar-seg sb-' + s.k + '" style="flex-grow:' + s.b + '" title="' + esc(s.label + ': ' + n(s.b) + ' byte/125 µs = ' + TV().fmtRate(s.b * 64) + ' (' + n(pct) + '%)') + '">' +
          '</span>';
      }).join('') + '</div>' +
      '<div class="legend">' + segs.map(function (s) {
        return '<span class="lg-item"><span class="lg-sw sb-' + s.k + '"></span>' + esc(s.label) + ' <b>' + esc(n(s.b / total * 100, 1)) + '%</b></span>';
      }).join('') + '</div>';
    // cột chồng theo cấp: mỗi cấp một thanh = overhead cấp đó (so với khung)
    var maxOh = Math.max.apply(null, acc.overhead.map(function (o) { return o.bytes; }).concat([1]));
    var rows = acc.overhead.map(function (o) {
      var pct = o.bytes / total * 100;
      return '<tr><td><button type="button" class="link-btn" data-lsel="' + esc(o.u) + '">' + esc(nm(o.u)) + '</button></td><td class="num">' + o.count + '</td>' +
        '<td>' + (o.bytesEach ? esc(n(o.bytesEach, 0) + ' B') + (o.ohName ? ' <span class="muted">' + esc(o.ohName) + '</span>' : '') : '<span class="muted">0</span>') + '</td>' +
        '<td class="num">' + esc(n(o.bytes, 0)) + '</td><td class="num">' + esc(n(o.bytes * 64, 0)) + '</td>' +
        '<td class="barcell"><span class="hbar-track"><span class="hbar" style="width:' + (o.bytes / maxOh * 100) + '%"></span></span><span class="num">' + esc(n(pct)) + '%</span></td></tr>';
    }).join('');
    var extra = [
      ['Chèn bù tốc độ (justification)', acc.justification, 'Container lớn hơn tín hiệu khách hàng một chút (vd C-12 34 B mang E1 = 32 B/125 µs).'],
      ['Chưa dùng (ô trống)', acc.empty, 'Dung lượng chưa lấp.'],
      ['Tải khách hàng', acc.clientBytes, clientsTxt(acc.clients) || 'chưa có']
    ].map(function (r) {
      return '<tr class="tr-sum"><td colspan="3">' + esc(r[0]) + ' <span class="muted">' + esc(r[2]) + '</span></td><td class="num">' + esc(n(r[1])) + '</td><td class="num">' + esc(n(r[1] * 64)) + '</td><td class="num">' + esc(n(r[1] / total * 100)) + '%</td></tr>';
    }).join('');
    return '<div class="section-title"><h2>Tổng kết ' + esc(nm(t.u)) + '</h2><span class="muted">byte mỗi 125 µs · 1 byte/125 µs = 64 kbit/s</span></div>' +
      '<div class="stats">' +
        '<div class="stat"><div class="stat-label">Tốc độ khung đích</div><div class="stat-value">' + esc(TV().fmtRate(acc.totalKbps)) + '</div><div class="stat-sub">' + esc(n(total, 0)) + ' byte/125 µs</div></div>' +
        '<div class="stat"><div class="stat-label">Tải khách hàng thực mang</div><div class="stat-value">' + esc(TV().fmtRate(acc.clientKbps)) + '</div><div class="stat-sub">' + esc(clientsTxt(acc.clients) || 'chưa thả gì') + '</div></div>' +
        '<div class="stat"><div class="stat-label">Hiệu suất</div><div class="stat-value">' + esc(n(acc.efficiency)) + '%</div><div class="stat-sub">tải khách hàng / tốc độ khung</div></div>' +
        '<div class="stat"><div class="stat-label">Tổng overhead</div><div class="stat-value">' + esc(n(acc.overheadBytes, 0)) + ' B</div><div class="stat-sub">' + esc(TV().fmtRate(acc.overheadBytes * 64)) + '</div></div>' +
      '</div>' + bar +
      '<h3 class="lab-h3">Overhead theo cấp</h3>' +
      '<div class="tbl-wrap"><table class="values lab-table"><thead><tr><th>Cấp</th><th class="num">Số lượng</th><th>Overhead mỗi cái</th><th class="num">Byte/125 µs</th><th class="num">kbit/s</th><th>% khung</th></tr></thead><tbody>' +
        rows + extra +
        '<tr class="tr-total"><td colspan="3"><b>Tổng</b></td><td class="num"><b>' + esc(n(total, 0)) + '</b></td><td class="num"><b>' + esc(n(total * 64, 0)) + '</b></td><td class="num">100%</td></tr>' +
      '</tbody></table></div>';
  }

  function renderCounters(t) {
    var M = MUX(), root = lb.st.root, c = L().counts(t);
    var items = (lb.lab.palette || []).filter(function (id) { return M[id] && L().maxCount(M, root, id) > 0; });
    items.sort(function (a, b) { return (M[a].level || 0) - (M[b].level || 0); });
    return '<div class="section-title"><h2>Bộ đếm theo loại</h2><span class="muted">đã dùng / còn chứa được theo phương án đang chọn / tối đa của ' + esc(nm(root)) + '</span></div>' +
      '<div class="counters">' + items.map(function (id) {
        var used = c[id] || 0, cap = L().capacityNow(M, t, root, id), max = L().maxCount(M, root, id);
        var pct = cap ? used / cap * 100 : 0;
        return '<div class="ctr"><div class="ctr-top"><b>' + esc(nm(id)) + '</b><span class="ctr-num">' + used + '/' + cap +
          (cap !== max ? ' <span class="muted" title="Tối đa nếu đổi phương án">(tối đa ' + max + ')</span>' : '') + '</span></div>' +
          '<div class="ctr-bar"><span style="width:' + pct + '%"></span></div>' +
          '<button type="button" class="btn-ghost btn-sm" data-lfill="' + esc(id) + '"' + (used >= cap ? ' disabled' : '') + ' title="Lấp mọi chỗ còn trống bằng ' + esc(nm(id)) + '">Lấp đầy</button></div>';
      }).join('') + '</div>';
  }

  // ---------- đóng gói từng bước ----------
  function renderSteps() {
    var M = MUX(), root = lb.st.root;
    var clients = (lb.lab.palette || []).filter(function (id) { return M[id] && L().isClient(M, id) && L().pathDown(M, root, id); });
    if (!clients.length) return '';
    var cl = clients.indexOf(lb.st.step.client) >= 0 ? lb.st.step.client : clients[0];
    var steps = L().stepsUp(M, root, cl) || [];
    var k = Math.max(1, Math.min(lb.st.step.n || 1, steps.length));
    var clientB = L().unitBytes(M, cl);
    var list = steps.slice(0, k).map(function (s, i) {
      var u = s.unit, oh = s.overhead || {};
      var max = L().maxCount(M, s.u, cl);
      var eff = s.bytes ? max * clientB / s.bytes * 100 : 0;
      var fr = u.frame && window.TFRAMES && window.TFRAMES[u.frame];
      return '<li class="step' + (i === k - 1 ? ' is-cur' : '') + '">' +
        '<span class="step-n">' + (i + 1) + '</span>' +
        '<div class="step-body"><div class="step-head"><button type="button" class="link-btn" data-lsel="' + esc(s.u) + '"><b>' + esc(nm(s.u)) + '</b></button>' +
          '<span class="muted">' + (u.rateKbps ? esc(TV().fmtRate(u.rateKbps)) + ' = ' + esc(n(s.bytes)) + ' B/125 µs' : esc(n(s.bytes, 0)) + ' B/125 µs · ' + esc(TV().fmtRate(s.bytes * 64))) + '</span>' +
          (fr ? '<a class="btn-ghost btn-sm" href="#t/' + esc(fr.id) + '">▦ Xem lưới</a>' : '') + '</div>' +
          (i ? '<div class="step-desc">= ' + s.count + '×' + esc(nm(s.from)) +
            (oh.bytes ? ' <span class="pill-oh">+' + n(oh.bytes, 0) + ' B ' + esc(oh.name || 'overhead') + '</span>' : ' <span class="muted">(không thêm overhead)</span>') +
            (s.justification > 0 ? ' <span class="pill-stuff">+' + n(s.justification) + ' B chèn bù tốc độ</span>' : '') +
            (s.mapping ? ' <span class="muted">· ánh xạ ' + esc(s.mapping) + '</span>' : '') + '</div>' : '<div class="step-desc">Tín hiệu khách hàng — điểm bắt đầu.</div>') +
          (i ? '<div class="step-eff">Đầy ' + max + ' ' + esc(nm(cl)) + ' → tải khách hàng chiếm <b>' + esc(n(eff, 1)) + '%</b><span class="effbar"><span style="width:' + eff + '%"></span></span></div>' : '') +
        '</div></li>';
    }).reverse().join('');
    return '<div class="section-title"><h2>Đóng gói từng bước</h2><span class="muted">từ tín hiệu khách hàng đi lên ' + esc(nm(root)) + '</span></div>' +
      '<div class="toolbar"><span class="toolbar-label">Khách hàng</span><div class="seg-group">' + clients.map(function (id) {
        var on = id === cl;
        return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-lstepc="' + esc(id) + '" aria-pressed="' + on + '">' + esc(nm(id)) + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="btn-ghost" data-lstep="up"' + (k >= steps.length ? ' disabled' : '') + '>↑ Lên một cấp</button>' +
      '<button type="button" class="btn-ghost" data-lstep="all"' + (k >= steps.length ? ' disabled' : '') + '>Hiện hết</button>' +
      '<button type="button" class="btn-ghost" data-lstep="reset"' + (k <= 1 ? ' disabled' : '') + '>Về đầu</button>' +
      '<span class="muted">bước ' + k + '/' + steps.length + '</span></div>' +
      '<ol class="steps">' + list + '</ol>';
  }

  // ---------- panel chi tiết ----------
  function renderDetailIntro() {
    var lab = lb.lab;
    document.getElementById('detail').innerHTML = '<div class="detail-card"><span class="eyebrow">Phòng thí nghiệm</span><h2>' + esc(lab.name) + '</h2>' +
      (lab.intro ? '<p>' + esc(lab.intro) + '</p>' : '') + '</div>' +
      '<div class="detail-empty"><h2>Cách dùng</h2><ol>' +
      '<li>Chọn <b>khung đích</b> (vd STM-1).</li>' +
      '<li><b>Kéo</b> một đơn vị (E1, E3, TU-12…) vào ô trống hoặc vào một hộp. Trên điện thoại: bấm đơn vị rồi bấm ô.</li>' +
      '<li>Thả bậc thấp vào bậc cao: các bước trung gian tự dựng, thông báo nêu overhead từng bước.</li>' +
      '<li>Hộp có nhiều phương án (VC-4, TUG-3) có ô chọn — đổi phương án sẽ xoá nội dung bên trong hộp đó.</li>' +
      '<li>Bấm tên một đơn vị để xem chi tiết ở đây. Trạng thái tự lưu trong trình duyệt.</li></ol></div>';
  }

  function showUnit(id, quiet) {
    var M = MUX(), u = M[id];
    if (!u) return;
    lb.sel = id;
    var client = L().isClient(M, id);
    var fr = u.frame && window.TFRAMES && window.TFRAMES[u.frame];
    var acc = (u.accepts || []).map(function (a) {
      var oh = a.overhead || {};
      return '<li><b>' + a.count + '×<a href="#" data-lunit="' + esc(a.of) + '">' + esc(nm(a.of)) + '</a></b>' +
        (oh.bytes ? ' + ' + n(oh.bytes, 0) + ' B ' + esc(oh.name || 'overhead') : ' <span class="muted">(không thêm overhead)</span>') +
        (a.mapping ? ' <span class="chip">' + esc(a.mapping) + '</span>' : '') +
        (oh.desc && oh.desc !== oh.name ? '<br><span class="muted">' + esc(oh.desc) + '</span>' : '') +
        (a.note ? '<br><span class="muted">' + esc(a.note) + '</span>' : '') + '</li>';
    }).join('');
    var parents = Object.keys(M).filter(function (k) { return (M[k].accepts || []).some(function (a) { return a.of === id; }); });
    document.getElementById('detail').innerHTML = '<div class="detail-card"><span class="eyebrow">Đơn vị ghép · ' + esc(u.kind) + '</span>' +
      '<h2>' + esc(u.name) + '</h2>' + (u.summary ? '<p class="lead">' + esc(u.summary) + '</p>' : '') +
      '<dl class="kv">' +
        '<dt>Kích thước</dt><dd>' + (client ? esc(TV().fmtRate(u.rateKbps)) + ' <span class="muted">(≈ ' + esc(n(u.rateKbps / 64)) + ' B/125 µs)</span>'
          : esc(n(u.bytesPer125us, 0)) + ' byte/125 µs = ' + esc(TV().fmtRate(u.bytesPer125us * 64))) + '</dd>' +
        (u.standard ? '<dt>Chuẩn</dt><dd>' + esc(u.standard) + '</dd>' : '') +
        (parents.length ? '<dt>Nằm trong</dt><dd>' + parents.map(function (p) { return '<a href="#" data-lunit="' + esc(p) + '">' + esc(nm(p)) + '</a>'; }).join(', ') + '</dd>' : '') +
      '</dl>' + (u.desc ? '<p>' + esc(u.desc) + '</p>' : '') +
      (acc ? '<h3>Cách lấp (phương án)</h3><ul class="plain unit-acc">' + acc + '</ul>' : '<p class="muted">Tín hiệu khách hàng — điểm bắt đầu của cây ghép.</p>') +
      (fr ? '<p><a class="btn-ghost btn-link" href="#t/' + esc(fr.id) + '">▦ Xem lưới byte ' + esc(fr.name) + '</a></p>' : '') + '</div>';
    if (!quiet && window.matchMedia && window.matchMedia('(max-width: 1240px)').matches) {
      var d = document.getElementById('detail'); if (d.scrollIntoView) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- hành động ----------
  function doPlace(path, X) {
    var M = MUX(), t = tree();
    var res = L().place(M, t, path, X);
    if (!res.ok) {
      lb.msg = { ok: false, html: '<b>Không thả được ' + esc(nm(X)) + ':</b> ' + esc(res.reason) };
      lb.lastPath = null;
    } else {
      // mô tả từng bước từ X đi lên vị trí thả, kèm overhead thêm ở mỗi bước
      var steps = [];
      for (var i = res.path.length - 1; i >= path.length; i--) {
        var nd = L().getNode(t, res.path.slice(0, i));
        if (!nd) continue;
        var a = M[nd.u].accepts[nd.opt], oh = (a.overhead && a.overhead.bytes) || 0;
        var just = L().isClient(M, a.of) ? L().unitBytes(M, nd.u) - oh - a.count * L().unitBytes(M, a.of) : 0;
        steps.push('<b>' + esc(nm(nd.u)) + '</b>' + (oh ? ' <span class="pill-oh">+' + n(oh, 0) + ' B ' + esc((a.overhead && a.overhead.name) || '') + '</span>' : '') +
          (just > 0 ? ' <span class="pill-stuff">+' + n(just / a.count) + ' B chèn</span>' : ''));
      }
      lb.msg = { ok: true, html: 'Đã thêm <b>' + esc(nm(X)) + '</b>' + (steps.length ? ': ' + esc(nm(X)) + ' → ' + steps.join(' → ') : '') };
      lb.lastPath = res.path;
    }
    save(); render();
  }

  function onClick(e) {
    if (!lb.active) return;
    var t = e.target; if (!t.closest) return;
    var b;
    if (lb.confirmClear && !t.closest('[data-laction="clear"]')) lb.confirmClear = false;
    if ((b = t.closest('[data-lroot]'))) { lb.st.root = b.getAttribute('data-lroot'); lb.msg = null; lb.lastPath = null; save(); render(); return; }
    if ((b = t.closest('[data-laction="clear"]'))) {
      if (!lb.confirmClear) { lb.confirmClear = true; render(); return; }
      lb.confirmClear = false;
      lb.st.trees[lb.st.root] = L().newNode(MUX(), lb.st.root); lb.st.collapsed = {};
      lb.msg = { ok: true, html: 'Đã xoá hết ' + esc(nm(lb.st.root)) + '.' }; lb.lastPath = null;
      save(); render(); return;
    }
    if ((b = t.closest('[data-lpal]'))) { var id = b.getAttribute('data-lpal'); lb.armed = lb.armed === id ? null : id; render(); return; }
    if ((b = t.closest('[data-lfill]'))) {
      var X = b.getAttribute('data-lfill');
      var cnt = L().fill(MUX(), tree(), [], X);
      lb.msg = cnt ? { ok: true, html: 'Đã lấp thêm <b>' + cnt + ' ' + esc(nm(X)) + '</b>.' } : { ok: false, html: 'Không còn chỗ cho ' + esc(nm(X)) + ' — ' + esc(L().explainReject(MUX(), lb.st.root, X, tree())) };
      lb.lastPath = null; save(); render(); return;
    }
    if ((b = t.closest('[data-lremove]'))) {
      e.stopPropagation();
      var p = parsePath(b.getAttribute('data-lremove'));
      var nd = L().getNode(tree(), p);
      L().remove(tree(), p);
      lb.msg = { ok: true, html: 'Đã gỡ ' + esc(nd ? nm(nd.u) : '') + '.' }; lb.lastPath = null;
      save(); render(); return;
    }
    if ((b = t.closest('[data-linst]'))) {
      e.stopPropagation();
      L().instantiate(MUX(), tree(), parsePath(b.getAttribute('data-linst')));
      save(); render(); return;
    }
    if ((b = t.closest('[data-lopt]'))) {
      L().setOption(MUX(), tree(), parsePath(b.getAttribute('data-lopt')), +b.getAttribute('data-lval'));
      lb.lastPath = null; save(); render(); return;
    }
    if ((b = t.closest('[data-lcollapse]'))) {
      lb.st.collapsed[b.getAttribute('data-lcollapse')] = b.getAttribute('data-lstate') !== '1';
      save(); render(); return;
    }
    if ((b = t.closest('[data-lstepc]'))) { lb.st.step = { client: b.getAttribute('data-lstepc'), n: 1 }; save(); render(); return; }
    if ((b = t.closest('[data-lstep]'))) {
      var a = b.getAttribute('data-lstep');
      lb.st.step.n = a === 'up' ? (lb.st.step.n || 1) + 1 : a === 'all' ? 99 : 1;
      save(); render(); return;
    }
    if (t.closest('.ch-opt')) return;
    // bấm tên đơn vị: nếu đang cầm thì thả, ngược lại xem chi tiết
    if (!lb.armed && (b = t.closest('[data-lsel]'))) { showUnit(b.getAttribute('data-lsel')); return; }
    if (lb.armed && (b = t.closest('[data-drop]'))) { doPlace(parsePath(b.getAttribute('data-drop')), lb.armed); return; }
    if ((b = t.closest('[data-lsel]'))) { showUnit(b.getAttribute('data-lsel')); return; }
  }

  function onChange(e) {
    if (!lb.active) return;
    var s = e.target;
    if (s.matches && s.matches('[data-loptsel]')) {
      L().setOption(MUX(), tree(), parsePath(s.getAttribute('data-loptsel')), +s.value);
      lb.msg = { ok: true, html: 'Đã đổi phương án — nội dung cũ bên trong đã được xoá.' }; lb.lastPath = null;
      save(); render();
    }
  }

  // kéo thả HTML5
  function onDragStart(e) {
    var b = e.target.closest && e.target.closest('[data-lpal]');
    if (!b) return;
    lb.drag = b.getAttribute('data-lpal');
    try { e.dataTransfer.setData('text/plain', lb.drag); e.dataTransfer.effectAllowed = 'copy'; } catch (er) { /* IE */ }
  }
  function clearOver() {
    Array.prototype.forEach.call(document.querySelectorAll('#view-lab .is-over, #view-lab .is-bad'), function (x) { x.classList.remove('is-over', 'is-bad'); });
  }
  function onDragOver(e) {
    var t = e.target.closest && e.target.closest('[data-drop]');
    if (!t || !lb.drag) return;
    e.preventDefault();
    var p = parsePath(t.getAttribute('data-drop'));
    var nd = L().getNode(tree(), p), su = nd ? nd.u : L().slotUnit(MUX(), tree(), p);
    var ok = L().reaches(MUX(), su, lb.drag) && (nd ? nd.u !== lb.drag : true);
    if (!t.classList.contains('is-over') && !t.classList.contains('is-bad')) { clearOver(); t.classList.add(ok ? 'is-over' : 'is-bad'); }
    try { e.dataTransfer.dropEffect = ok ? 'copy' : 'none'; } catch (er) { /* bỏ qua */ }
  }
  function onDrop(e) {
    var t = e.target.closest && e.target.closest('[data-drop]');
    var X = lb.drag;
    try { X = e.dataTransfer.getData('text/plain') || X; } catch (er) { /* bỏ qua */ }
    clearOver();
    if (!t || !X || !MUX()[X]) return;
    e.preventDefault();
    e.stopPropagation();
    lb.drag = null;
    doPlace(parsePath(t.getAttribute('data-drop')), X);
  }

  window.MuxLab = { init: init, show: show, hide: hide };
})();
