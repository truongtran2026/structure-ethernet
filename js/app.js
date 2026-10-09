/*
 * app.js — phần VẼ giao diện. Chỉ đọc model từ EthViz.buildModel; không hardcode giao thức.
 * Cấp thu gọn: stack-group (sgroup) → header → group field → field.
 */
(function () {
  'use strict';

  var LAYER_LABEL = {
    phy: 'Vật lý', l2: 'Lớp 2', l2_5: 'Lớp 2.5', l3: 'Lớp 3', l4: 'Lớp 4',
    tunnel: 'Tunnel', payload: 'Payload', trailer: 'Trailer'
  };
  var LEVELS = [
    { n: 0, label: 'Thu gọn tất cả', hint: 'Chỉ hiện các nhóm cấp stack và header' },
    { n: 1, label: 'Cấp header', hint: 'Bung nhóm stack, mỗi header một dòng' },
    { n: 2, label: 'Cấp nhóm field', hint: 'Bung header, các nhóm field gộp thành một khối' },
    { n: 3, label: 'Bung tất cả', hint: 'Hiện mọi field và bit' }
  ];
  var STORE_PREFIX = 'ethviz.v1.';
  var THEMES = ['auto', 'light', 'dark'];
  var THEME_LABEL = { auto: '◐ Tự động', light: '☀ Sáng', dark: '☾ Tối' };

  var app = {
    stacks: [], headers: {}, current: null, state: null, model: null, query: '',
    hl: null, focusPath: null
  };

  // ---------- tiện ích ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function attr(s) { return esc(s); }
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function cssEsc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }
  function num(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); }

  function storeGet(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function storeSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* bỏ qua: chế độ riêng tư… */ }
  }

  /** "4 byte" nếu tròn byte, ngược lại "12 bit". */
  function fmtBytes(bits) { return bits % 8 === 0 ? num(bits / 8) + ' byte' : bits + ' bit'; }
  /** "4 byte (32 bit)" hoặc "12 bit". */
  function fmtSize(bits) { return bits % 8 === 0 ? num(bits / 8) + ' byte (' + bits + ' bit)' : bits + ' bit'; }
  function byteRange(offsetBit, bits) {
    if (offsetBit == null || !bits) return '';
    if (offsetBit % 8 || bits % 8) return 'bit ' + offsetBit + '–' + (offsetBit + bits - 1);
    var a = offsetBit / 8, b = (offsetBit + bits) / 8 - 1;
    return a === b ? 'byte ' + a : 'byte ' + a + '–' + b;
  }
  function bitRange(offset, bits) {
    if (offset == null || !bits) return '';
    return bits === 1 ? 'bit ' + offset : 'bit ' + offset + '–' + (offset + bits - 1);
  }

  // ---------- trạng thái ----------
  function defaultState() { return { level: 1, open: {}, enabled: {}, varBytes: {}, selected: null }; }
  function loadState(id) {
    var s = storeGet(STORE_PREFIX + id);
    var d = defaultState();
    if (!s || typeof s !== 'object') return d;
    Object.keys(d).forEach(function (k) { if (!has(s, k)) s[k] = d[k]; });
    return s;
  }
  function saveState() { if (app.current) storeSet(STORE_PREFIX + app.current.id, app.state); }

  /** Mặc định mở/đóng theo cấp; state.open ghi đè cho từng node. */
  function isOpen(node) {
    if (!node) return false;
    if (has(app.state.open, node.path)) return !!app.state.open[node.path];
    var lv = app.state.level;
    if (node.kind === 'sgroup') return lv >= 1;
    if (node.kind === 'header') return lv >= 2;
    if (node.kind === 'group') return lv >= 3;
    return false;
  }
  function canOpen(node) {
    return node && (node.kind === 'sgroup' || node.kind === 'group' || (node.kind === 'header' && !node.missing));
  }
  function setOpen(node, open) { app.state.open[node.path] = !!open; }
  function openAncestors(node) {
    var p = node && app.model.index[node.parentPath];
    while (p) { setOpen(p, true); p = app.model.index[p.parentPath]; }
  }

  // ---------- khởi động ----------
  function boot() {
    var load = window.__ethvizLoad || { failed: [], errors: [] };
    var root = $('#app');
    if (!window.EthViz) {
      showFatal('Không nạp được <code>js/model.js</code>. Kiểm tra file có tồn tại cạnh <code>index.html</code>.');
      return;
    }
    app.headers = window.HEADERS || {};
    app.stacks = (Array.isArray(window.STACKS) ? window.STACKS : []).filter(function (s) { return s && s.id; });
    app.load = load;
    initTheme();
    root.hidden = false;
    var bootEl = $('#boot'); if (bootEl) bootEl.hidden = true;
    bindEvents();
    renderSidebar();
    if (!app.stacks.length) { renderEmpty(); return; }
    showStack(idFromHash() || app.stacks[0].id, true);
  }

  function showFatal(html) {
    var b = $('#boot');
    if (b) { b.hidden = false; b.innerHTML = '<div class="alert alert--error"><strong>Không khởi động được.</strong> ' + html + '</div>'; }
  }

  function idFromHash() {
    var id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    return app.stacks.some(function (s) { return s.id === id; }) ? id : null;
  }

  function showStack(id, replace) {
    var st = app.stacks.filter(function (s) { return s.id === id; })[0] || app.stacks[0];
    app.current = st;
    app.state = loadState(st.id);
    app.focusPath = null;
    if (('#' + st.id) !== location.hash) {
      if (replace && history.replaceState) history.replaceState(null, '', '#' + st.id);
      else location.hash = st.id;
    }
    document.body.classList.remove('nav-open');
    markActiveStack();
    render();
    var main = $('#main'); if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function rebuild() {
    try {
      app.model = EthViz.buildModel(app.current, app.state, app.headers, app.stacks);
    } catch (e) {
      app.model = null;
      app.buildError = e;
    }
  }

  // ---------- sidebar ----------
  function stackMatches(st, q) {
    if (!q) return true;
    var hay = [st.id, st.name, st.summary, st.category];
    (function walk(list) {
      (list || []).forEach(function (sn) {
        if (!sn) return;
        if (sn.children) { hay.push(sn.group); walk(sn.children); return; }
        hay.push(sn.header, sn.label);
        var h = app.headers[sn.header];
        if (h) hay.push(h.name, h.short);
      });
    })(st.tree);
    return hay.join(' \u0001 ').toLowerCase().indexOf(q) >= 0;
  }

  function renderSidebar() {
    var q = app.query.trim().toLowerCase();
    var cats = [];
    var byCat = {};
    app.stacks.forEach(function (st) {
      if (!stackMatches(st, q)) return;
      var c = st.category || 'Khác';
      if (!byCat[c]) { byCat[c] = []; cats.push(c); }
      byCat[c].push(st);
    });
    var html = cats.map(function (c) {
      return '<div class="nav-cat"><h3 class="nav-cat-title">' + esc(c) + '</h3><ul>' +
        byCat[c].map(function (st) {
          var bytes = '';
          try { bytes = num(EthViz.buildModel(st, {}, app.headers, app.stacks).totals.frameBytes) + ' B'; } catch (e) { bytes = '!'; }
          return '<li><a class="nav-item" href="#' + attr(encodeURIComponent(st.id)) + '" data-stack="' + attr(st.id) + '">' +
            '<span class="nav-name">' + esc(st.name || st.id) + '</span><span class="nav-meta" title="Kích thước frame mặc định (cấu hình gốc của stack, không tính preamble/SFD; chỉnh sửa trong trang không làm đổi số này)">' + esc(bytes) + '</span></a></li>';
        }).join('') + '</ul></div>';
    }).join('');
    if (!html) html = '<p class="muted nav-empty">' + (app.stacks.length ? 'Không có kết quả cho “' + esc(app.query) + '”.' : 'Chưa có stack nào.') + '</p>';
    $('#nav').innerHTML = html;
    markActiveStack();
  }

  function markActiveStack() {
    var nav = $('#nav'); if (!nav) return;
    Array.prototype.forEach.call(nav.querySelectorAll('.nav-item'), function (a) {
      var on = app.current && a.getAttribute('data-stack') === app.current.id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function renderEmpty() {
    $('#alerts').innerHTML = loadAlerts();
    $('#stack-head').innerHTML = '<div class="empty"><h1>Chưa có dữ liệu stack</h1>' +
      '<p>Ứng dụng đọc dữ liệu từ <code>data/headers-*.js</code> và <code>data/stacks.js</code>. ' +
      'Hiện chưa có stack nào được nạp — có thể các file dữ liệu chưa được tạo hoặc bị lỗi cú pháp.</p></div>';
    $('#framemap').innerHTML = '';
    $('#tree').innerHTML = '';
    $('#detail').innerHTML = renderHelp();
  }

  // ---------- render chính ----------
  function render() {
    rebuild();
    if (!app.model) {
      $('#alerts').innerHTML = loadAlerts() + '<div class="alert alert--error"><strong>Lỗi khi tính cấu trúc stack “' +
        esc(app.current.id) + '”:</strong> ' + esc(app.buildError && app.buildError.message) + '</div>';
      $('#stack-head').innerHTML = ''; $('#framemap').innerHTML = ''; $('#tree').innerHTML = '';
      $('#detail').innerHTML = renderHelp();
      return;
    }
    if (app.state.selected && !app.model.index[app.state.selected]) app.state.selected = null;
    $('#alerts').innerHTML = loadAlerts() + modelAlerts();
    $('#stack-head').innerHTML = renderHead();
    $('#framemap').innerHTML = renderFrameMap();
    $('#tree').innerHTML = app.model.nodes.map(function (n) { return renderNode(n, 1); }).join('') ||
      '<p class="muted">Stack này chưa có header nào.</p>';
    renderDetail();
    restoreFocus();
    applyHighlight(app.hl);
  }

  function loadAlerts() {
    var L = app.load || {};
    var out = '';
    (L.failed || []).forEach(function (src) {
      out += '<div class="alert alert--warn"><strong>Không nạp được <code>' + esc(src) + '</code>.</strong> ' +
        'File chưa tồn tại hoặc sai đường dẫn — các stack/header trong file này sẽ bị thiếu.</div>';
    });
    (L.errors || []).forEach(function (msg) {
      out += '<div class="alert alert--error"><strong>Lỗi script:</strong> ' + esc(msg) + '</div>';
    });
    return out;
  }

  function modelAlerts() {
    var m = app.model, out = '';
    if (m.errors.length) {
      out += '<div class="alert alert--error"><strong>Stack tham chiếu header không có:</strong><ul>' +
        m.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></div>';
    }
    if (m.warnings.length) {
      out += '<details class="alert alert--warn"><summary>' + m.warnings.length + ' cảnh báo dữ liệu</summary><ul>' +
        m.warnings.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul></details>';
    }
    return out;
  }

  function renderHead() {
    var st = app.current, t = app.model.totals;
    var base = st.compareTo && app.stacks.filter(function (s) { return s.id === st.compareTo; })[0];
    var levelBtns = LEVELS.map(function (L) {
      var on = app.state.level === L.n;
      return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-level="' + L.n + '" title="' + attr(L.hint) +
        '" aria-pressed="' + on + '">' + esc(L.label) + '</button>';
    }).join('');
    return '' +
      '<div class="head-top">' +
        (st.category ? '<span class="eyebrow">' + esc(st.category) + '</span>' : '') +
        '<h1 class="stack-title">' + esc(st.name || st.id) + '</h1>' +
        (st.summary ? '<p class="stack-summary">' + esc(st.summary) + '</p>' : '') +
      '</div>' +
      '<div class="stats">' +
        stat('Kích thước frame', num(t.frameBytes) + ' byte', t.wireBytes ? 'chưa tính ' + num(t.wireBytes) + ' byte preamble/SFD trên dây' : 'không tính phần chỉ có trên dây') +
        stat('Overhead (header + trailer)', num(t.overheadBytes) + ' byte', t.overheadPct.toFixed(1) + '% frame · gồm cả header gói bên trong',
          'Overhead = mọi byte không phải payload, gồm cả header của gói bên trong (vd. Inner IPv4 trong tunnel).') +
        (t.compare ? stat('Tăng thêm so với ' + t.compare.name, (t.compare.deltaBytes >= 0 ? '+' : '−') + num(Math.abs(t.compare.deltaBytes)) + ' byte',
          num(t.frameBytes) + ' − ' + num(t.compare.frameBytes) + ' byte (frame mặc định của stack gốc)',
          'Chi phí đóng gói thực: kích thước frame hiện tại trừ kích thước frame mặc định của "' + t.compare.name + '" (cùng cách tính, không tính phần chỉ có trên dây).') : '') +
        stat('Payload', num(t.payloadBytes) + ' byte', 'chỉnh độ dài ở panel chi tiết') +
        stat('Số header', String(t.headerCount), 'không tính payload') +
      '</div>' +
      renderVariantCard() +
      (st.detail ? '<details class="stack-detail"><summary>Giải thích stack này</summary><p>' + esc(st.detail) + '</p>' +
        (base ? '<p class="muted">So sánh với <a href="#' + attr(base.id) + '">' + esc(base.name) + '</a>: header được thêm có nhãn <span class="badge badge--add">+ thêm</span>.</p>' : '') +
        '</details>' : '') +
      '<div class="toolbar" role="toolbar" aria-label="Cấp hiển thị">' +
        '<span class="toolbar-label">Cấp hiển thị</span>' +
        '<div class="seg-group">' + levelBtns + '</div>' +
        '<button type="button" class="btn-ghost" data-action="reset" title="Xoá mọi thay đổi thu gọn/bật tắt/độ dài của stack này">Khôi phục mặc định</button>' +
      '</div>';
  }
  function stat(label, value, sub, tip) {
    return '<div class="stat"' + (tip ? ' title="' + attr(tip) + '"' : '') + '><div class="stat-label">' + esc(label) +
      (tip ? ' <span class="stat-tip" aria-hidden="true">ⓘ</span>' : '') + '</div><div class="stat-value">' + esc(value) +
      '</div><div class="stat-sub">' + esc(sub) + '</div></div>';
  }

  // ---------- frame map ----------
  function renderFrameMap() {
    var layers = {};
    function seg(n) {
      if (n.kind === 'sgroup' && isOpen(n)) {
        return '<div class="fm-group' + (n.added ? ' is-added' : '') + '" style="flex-grow:' + Math.max(n.bits / 8, 1) + '">' +
          (n.addedLabel ? '<span class="fm-add">+ thêm</span>' : '') +
          '<div class="fm-row">' + n.children.map(seg).join('') + '</div>' +
          '<div class="fm-cap" title="' + attr(n.name) + '"><span>' + esc(n.name) + ' · ' + esc(fmtBytes(n.bits)) + '</span></div></div>';
      }
      var bytes = n.bits / 8;
      if (!n.missing) layers[n.layer] = true;
      var name = n.kind === 'sgroup' ? n.name : (n.short || n.name);
      var cls = 'fm-seg layer-' + n.layer + (n.wire ? ' is-wire' : '') + (n.added ? ' is-added' : '') +
        (n.missing ? ' is-missing' : '') + (n.kind === 'sgroup' ? ' is-group' : '') +
        (app.state.selected === n.path ? ' is-sel' : '');
      var title = (n.kind === 'sgroup' ? 'Nhóm: ' : '') + (n.label ? n.label + ' — ' : '') + n.name + ' — ' +
        (n.missing ? 'thiếu dữ liệu' : fmtSize(n.bits)) + (n.wire ? ' (chỉ trên dây)' : '') +
        (n.offsetBit != null ? ' — ' + byteRange(n.offsetBit, n.bits) : '');
      return '<button type="button" class="' + cls + '" data-path="' + attr(n.path) + '" data-hl="' + attr(n.path) +
        '" style="flex-grow:' + Math.max(bytes, 0.5) + '" title="' + attr(title) + '">' +
        (n.addedLabel ? '<span class="fm-add">+ thêm</span>' : '') +
        '<span class="fm-name">' + esc(name) + '</span>' +
        '<span class="fm-size">' + (n.missing ? '?' : esc(num(bytes)) + ' B') + '</span></button>';
    }
    var body = app.model.nodes.map(seg).join('');
    var legend = Object.keys(LAYER_LABEL).filter(function (k) { return layers[k]; }).map(function (k) {
      return '<span class="lg-item"><span class="lg-sw layer-' + k + '"></span>' + esc(LAYER_LABEL[k]) + '</span>';
    }).join('');
    return '<div class="section-title"><h2>Bản đồ frame</h2><span class="muted">độ rộng tỉ lệ theo byte · bấm để xem chi tiết</span></div>' +
      '<div class="fm-scroll"><div class="fm">' + body + '</div></div>' +
      '<div class="legend">' + legend + '<span class="lg-item"><span class="lg-sw lg-wire"></span>Chỉ trên dây</span></div>';
  }

  // ---------- cây cấu trúc ----------
  function caret(node, open) {
    if (!canOpen(node)) return '<span class="caret caret--none" aria-hidden="true"></span>';
    return '<button type="button" class="caret" data-action="toggle" tabindex="-1" aria-hidden="true">' + (open ? '▾' : '▸') + '</button>';
  }

  function rowAttrs(node, level, open) {
    var sel = app.state.selected === node.path;
    return ' role="treeitem" aria-level="' + level + '"' + (canOpen(node) ? ' aria-expanded="' + open + '"' : '') +
      ' aria-selected="' + sel + '" tabindex="-1" data-path="' + attr(node.path) + '" data-hl="' + attr(node.path) + '"';
  }

  function renderNode(node, level) {
    if (node.kind === 'sgroup') return renderSGroup(node, level);
    if (node.kind === 'header') return renderHeader(node, level);
    return renderField(node, level);
  }

  function renderSGroup(n, level) {
    var open = isOpen(n);
    return '<div class="node node--sgroup layer-' + n.layer + (open ? ' is-open' : '') + '">' +
      '<div class="row row--sgroup' + sel(n) + '"' + rowAttrs(n, level, open) + '>' + caret(n, open) +
        '<span class="row-icon" aria-hidden="true">▤</span>' +
        '<span class="row-name"><span class="nm">' + esc(n.name) + '</span><span class="dash">–</span><b class="sz">' + esc(fmtBytes(n.bits)) + '</b>' +
        (n.addedLabel ? '<span class="badge badge--add">+ thêm</span>' : '') +
        (n.wire ? '<span class="badge badge--wire">chỉ trên dây</span>' : '') + '</span>' +
        '<span class="row-meta">' + esc(n.children.length + ' phần') + (n.offsetBit != null ? ' · ' + esc(byteRange(n.offsetBit, n.bits)) : '') + '</span>' +
      '</div>' +
      (open ? '<div class="node-body" role="group">' + (n.note ? '<p class="note">' + esc(n.note) + '</p>' : '') +
        n.children.map(function (c) { return renderNode(c, level + 1); }).join('') + '</div>' : '') +
      '</div>';
  }

  function sel(n) { return app.state.selected === n.path ? ' is-sel' : ''; }

  function renderHeader(n, level) {
    if (n.missing) {
      return '<div class="node node--header is-missing">' +
        '<div class="row row--header' + sel(n) + '"' + rowAttrs(n, level, false) + '>' + caret(n, false) +
        '<span class="row-name"><span class="nm">' + esc(n.name) + '</span><span class="badge badge--err">thiếu dữ liệu</span></span>' +
        '<span class="row-meta">' + esc(n.error) + '</span></div></div>';
    }
    var open = isOpen(n);
    var meta = [n.bits + ' bit'];
    var av = n.variants && n.variants.length ? variantOf(n, n.activeVariantId) : null;
    if (n.offsetBit != null) meta.push(byteRange(n.offsetBit, n.bits));
    return '<div class="node node--header layer-' + n.layer + (open ? ' is-open' : '') + (n.wire ? ' is-wire' : '') + '">' +
      '<div class="row row--header' + sel(n) + '"' + rowAttrs(n, level, open) + '>' + caret(n, open) +
        '<span class="swatch layer-' + n.layer + '" aria-hidden="true"></span>' +
        '<span class="row-name"><span class="nm">' + esc(n.name) + '</span><span class="dash">–</span><b class="sz">' + esc(fmtBytes(n.bits)) + '</b>' +
          (n.variantRange && n.variantRange.min !== n.variantRange.max ? '<span class="badge badge--range" title="Kích thước thay đổi theo biến thể">' + esc(n.variantRange.min + '–' + n.variantRange.max + ' B') + '</span>' : '') +
          (av ? '<span class="badge badge--var" title="Biến thể đang khớp">' + esc(av.name) + '</span>' : '') +
          (n.label ? '<span class="chip">' + esc(n.label) + '</span>' : '') +
          (n.addedLabel ? '<span class="badge badge--add">+ thêm</span>' : '') +
          (n.wire ? '<span class="badge badge--wire">chỉ trên dây</span>' : '') +
        '</span>' +
        '<span class="row-meta">' + esc(meta.join(' · ')) + '</span>' +
      '</div>' +
      (open ? '<div class="node-body node-body--header" role="group">' +
        (n.note ? '<p class="note">' + esc(n.note) + '</p>' : '') +
        renderVariantBar(n) + renderBitmap(n) +
        '<div class="fields">' + n.children.map(function (c) { return renderField(c, level + 1); }).join('') + '</div>' +
      '</div>' : '') +
      '</div>';
  }

  // ---------- biến thể ----------
  function variantOf(hn, id) {
    return (hn.variants || []).filter(function (v) { return v.id === id; })[0] || null;
  }
  function variantBytesTxt(v) { return num(v.bytes) + ' B'; }

  function renderVariantBar(n) {
    if (!n.variants || !n.variants.length) return '';
    var custom = n.activeVariantId == null;
    return '<div class="var-bar" role="group" aria-label="Biến thể của ' + attr(n.name) + '"><span class="var-bar-label">Biến thể</span>' +
      n.variants.map(function (v) {
        var on = v.id === n.activeVariantId;
        return '<button type="button" class="var-chip' + (on ? ' is-on' : '') + '" data-action="variant" data-hp="' + attr(n.path) +
          '" data-vid="' + attr(v.id) + '" aria-pressed="' + on + '" title="' + attr(v.note || '') + '">' + esc(v.name) +
          ' <span class="var-chip-sz">· ' + esc(variantBytesTxt(v)) + '</span></button>';
      }).join('') +
      (custom ? '<span class="var-chip is-on is-custom" title="Cấu hình hiện tại không trùng biến thể nào">Tuỳ chỉnh <span class="var-chip-sz">· ' + esc(num(n.bits / 8)) + ' B</span></span>' : '') +
      '</div>';
  }

  function renderVariantTable(n) {
    if (!n.variants || !n.variants.length) return '';
    return '<h3>Các biến thể</h3><p class="muted var-hint">Bấm một dòng để áp dụng cấu hình đó.</p>' +
      '<div class="tbl-wrap"><table class="values var-table"><thead><tr><th>Tên</th><th>Giá trị đặc trưng</th><th>Kích thước</th><th>Ghi chú</th></tr></thead><tbody>' +
      n.variants.map(function (v) {
        var on = v.id === n.activeVariantId;
        var sets = v.set ? Object.keys(v.set).map(function (k) { return '<code>' + esc(k + ' = ' + v.set[k]) + '</code>'; }).join(' ') : '<span class="muted">—</span>';
        return '<tr class="var-row' + (on ? ' is-active' : '') + '" tabindex="0" data-action="variant" data-hp="' + attr(n.path) + '" data-vid="' + attr(v.id) +
          '"><td><b>' + esc(v.name) + '</b></td><td>' + sets + '</td><td>' + esc(variantBytesTxt(v)) +
          '</td><td>' + esc(v.note || '') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  /** Header (kể cả trong sgroup) có biến thể, theo thứ tự xuất hiện. */
  function variantHeaders() {
    var out = [];
    (function walk(list) {
      list.forEach(function (n) {
        if (n.kind === 'sgroup') walk(n.children);
        else if (n.kind === 'header' && !n.missing && n.variants && n.variants.length) out.push(n);
      });
    })(app.model.nodes);
    return out;
  }

  /** Card nổi bật: mọi header có biến thể, chip bấm được ngay cả khi header đang thu gọn. */
  function renderVariantCard() {
    var hs = variantHeaders();
    if (!hs.length) return '';
    var rows = hs.map(function (n) {
      var custom = n.activeVariantId == null;
      var name = (n.short || n.name) + (n.label ? ' · ' + n.label : '');
      var chips = n.variants.map(function (v) {
        var on = v.id === n.activeVariantId;
        return '<button type="button" class="var-chip' + (on ? ' is-on' : '') + '" data-action="variant" data-reveal="1" data-hp="' + attr(n.path) +
          '" data-vid="' + attr(v.id) + '" aria-pressed="' + on + '" title="' + attr(v.note || '') + '">' + esc(v.name) +
          ' <span class="var-chip-sz">· ' + esc(variantBytesTxt(v)) + '</span></button>';
      }).join('') + (custom ? '<span class="var-chip is-on is-custom" title="Cấu hình hiện tại không trùng biến thể nào">Tuỳ chỉnh <span class="var-chip-sz">· ' + esc(num(n.bits / 8)) + ' B</span></span>' : '');
      return '<div class="vc-row" data-hl="' + attr(n.path) + '"><div class="vc-head"><b class="vc-name">' + esc(name) + '</b>' +
        '<span class="vc-size">hiện tại <b>' + esc(fmtBytes(n.bits)) + '</b></span></div>' +
        '<div class="var-bar vc-chips" role="group" aria-label="Biến thể của ' + attr(n.name) + '">' + chips + '</div></div>';
    }).join('');
    return '<section class="card var-card" aria-label="Biến thể kích thước header">' +
      '<div class="section-title"><h2>Biến thể kích thước header</h2></div>' +
      '<p class="vc-lead">Bấm một biến thể để xem header thay đổi thế nào — các bit cờ/IHL/Data Offset và kích thước frame cập nhật theo.</p>' +
      rows + '</section>';
  }

  /** Mở header + các nhóm chứa field mà variant.set chạm tới để thấy từng bit (vd C, K, S). */
  function revealVariant(hp, v) {
    var hn = app.model.index[hp];
    if (!hn) return;
    openAncestors(hn);
    setOpen(hn, true);
    Object.keys(v.set || {}).forEach(function (k) {
      var f = app.model.index[hp + '/' + k];
      if (!f) return;
      var p = app.model.index[f.parentPath];
      while (p && p.path !== hp) { setOpen(p, true); p = app.model.index[p.parentPath]; }
    });
  }

  function flashHeader(hp) {
    var els = document.querySelectorAll('.fm-seg[data-hl="' + cssEsc(hp) + '"], #tree .row--header[data-hl="' + cssEsc(hp) + '"]');
    Array.prototype.forEach.call(els, function (e) { e.classList.add('is-flash'); });
    setTimeout(function () {
      Array.prototype.forEach.call(document.querySelectorAll('.is-flash'), function (e) { e.classList.remove('is-flash'); });
    }, 1600);
  }

  function applyVariant(hp, vid, reveal) {
    var hn = app.model.index[hp];
    var v = hn && variantOf(hn, vid);
    if (!v) return;
    var vs = EthViz.variantState(hn.header, v.def);
    app.state.enabled[hp] = vs.enabled;
    app.state.varBytes[hp] = vs.varBytes;
    if (reveal) revealVariant(hp, v);
    saveState();
    render();
    if (reveal) {
      var wrap = document.querySelector('#tree .node--header .row--header[data-path="' + cssEsc(hp) + '"]');
      var bm = wrap && wrap.parentNode.querySelector('.bm-wrap');
      var target = bm || wrap;
      if (target && target.scrollIntoView) target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      flashHeader(hp);
    }
  }

  function renderField(n, level) {
    var open = n.kind === 'group' && isOpen(n);
    var hdr = app.model.index[n.headerPath];
    var size, meta;
    if (!n.present) {
      size = n.enabled ? 'nhóm cha đang tắt' : 'đang tắt';
      meta = 'nếu bật: ' + fmtBytes(n.sizeIfOn);
    } else {
      size = n.isVar ? fmtBytes(n.bits) + ' (thay đổi)' : fmtBytes(n.bits);
      meta = bitRange(n.offsetInHeader, n.bits);
    }
    var name = esc(n.name) + (n.abbr && n.abbr !== n.name ? ' <span class="abbr">(' + esc(n.abbr) + ')</span>' : '');
    var cls = 'node node--' + n.kind + ' layer-' + (hdr ? hdr.layer : 'l2') + (open ? ' is-open' : '') + (n.present ? '' : ' is-off');
    return '<div class="' + cls + '" style="--d:' + n.depth + '">' +
      '<div class="row row--' + n.kind + sel(n) + '"' + rowAttrs(n, level, open) + '>' + caret(n, open) +
        '<span class="row-name"><span class="nm">' + name + '</span>' +
          (n.kind === 'group' ? '<span class="dash">–</span><b class="sz">' + esc(size) + '</b>' : '<span class="sz-plain">' + esc(size) + '</span>') +
          (n.value != null ? '<span class="val">= ' + esc(n.value) + '</span>' : '') +
          (n.reserved ? '<span class="badge badge--res">dự trữ</span>' : '') +
        '</span>' +
        '<span class="row-meta">' + esc(meta) + '</span>' +
        (n.optional ? optToggle(n) : '') +
      '</div>' +
      (open ? '<div class="node-body" role="group">' + n.children.map(function (c) { return renderField(c, level + 1); }).join('') + '</div>' : '') +
      '</div>';
  }

  function optToggle(n) {
    return '<button type="button" class="opt" data-action="opt" data-hp="' + attr(n.headerPath) + '" data-id="' + attr(n.id) +
      '" aria-pressed="' + n.enabled + '" tabindex="-1" title="Trường tuỳ chọn, có mặt khi: ' + attr(n.optional) + '">' +
      '<span class="opt-cond">' + esc(n.optional) + '</span><span class="opt-sw" aria-hidden="true"></span>' +
      '<span class="sr-only">' + (n.enabled ? 'Đang bật' : 'Đang tắt') + '</span></button>';
  }

  // ---------- sơ đồ bit ----------
  function valuesInside(node) {
    var out = [];
    (function walk(list) {
      list.forEach(function (c) {
        if (!c.present) return;
        if (c.value != null) out.push((c.abbr || c.name) + '=' + c.value);
        if (c.children) walk(c.children);
      });
    })(node.children || []);
    return out.join(' ');
  }

  function renderBitmap(h) {
    var rows = EthViz.layoutBits(h, isOpen, 32);
    var hasCollapsed = rows.some(function (r) { return r.collapsed || (r.cells || []).some(function (c) { return c.collapsed; }); });
    if (!rows.length) return '<p class="muted">Header này không có bit nào ở cấu hình hiện tại.</p>';
    var ruler = '';
    for (var i = 0; i < 32; i++) {
      ruler += '<span class="bm-tick' + (i % 8 === 0 ? ' is-byte' : '') + '"><i>' + (i % 10 === 0 ? i / 10 : '') + '</i><i>' + (i % 10) + '</i></span>';
    }
    var body = rows.map(function (r) {
      var off = '<span class="bm-off" title="Byte bắt đầu của hàng trong header">+' + num(r.startBit / 8) + '</span>';
      if (r.type === 'band') {
        var n = r.node, bytes = r.bits / 8;
        var label = (n.abbr || n.name) + ' – ' + num(bytes) + ' byte' + (bytes === 0 ? ' (không có)' : '');
        return '<div class="bm-row">' + off + '<button type="button" class="bm-band layer-' + h.layer + (r.collapsed ? ' is-collapsed' : '') +
          (bytes === 0 ? ' is-empty' : '') + selCls(n) + '" data-path="' + attr(n.path) + '" data-hl="' + attr(n.path) + '"' +
          (r.collapsed ? ' data-expand="1"' : '') + ' title="' + attr(n.name + ' — độ dài thay đổi' + (n.varRange ? ' (' + n.varRange.min + '–' + n.varRange.max + ' byte)' : '')) + '">' +
          '<span class="bc-name">' + esc(label) + '</span><span class="bm-dots">… ' + esc(num(bytes)) + ' byte</span></button></div>';
      }
      var cells = r.cells.map(function (c) {
        var style = 'grid-column:' + (c.col + 1) + ' / span ' + c.span;
        if (c.pad) return '<span class="bc bc--pad" style="' + style + '" aria-hidden="true"></span>';
        var n = c.node;
        var label = c.collapsed ? n.name : (n.abbr || n.name);
        var val = c.collapsed ? valuesInside(n) : (n.value != null ? '= ' + n.value : '');
        var tip = (c.collapsed ? 'Nhóm ' : '') + n.name + ' — ' + fmtSize(n.bits) + ' — ' + bitRange(n.offsetInHeader, n.bits) +
          (c.cont ? ' (phần tiếp)' : '') + (c.collapsed ? ' — bấm để bung nhóm' : '');
        return '<button type="button" class="bc layer-' + h.layer + (c.collapsed ? ' is-collapsed' : '') + (c.cont ? ' is-cont' : '') +
          (n.reserved ? ' is-reserved' : '') + (c.span <= 2 ? ' is-tiny' : '') + selCls(n) + '" style="' + style + '" data-path="' + attr(n.path) +
          '" data-hl="' + attr(n.path) + '"' + (c.collapsed ? ' data-expand="1"' : '') + ' title="' + attr(tip) + '">' +
          '<span class="bc-name">' + (c.collapsed ? '<span class="bc-grp" aria-hidden="true">⊞</span>' : '') + esc(label) +
            (c.cont ? ' <span class="bc-cont">(tiếp)</span>' : '') + '</span>' +
          (val ? '<span class="bc-val">' + esc(val) + '</span>' : '') +
          '<span class="bc-bits">' + c.span + (c.cont || c.more ? '/' + n.bits : '') + '</span></button>';
      }).join('');
      return '<div class="bm-row">' + off + '<div class="bm-grid">' + cells + '</div></div>';
    }).join('');
    return '<div class="bm-wrap"><div class="bm" aria-label="Sơ đồ bit của ' + attr(h.name) + '">' +
      '<div class="bm-row bm-row--ruler"><span class="bm-off" aria-hidden="true">byte</span><div class="bm-grid bm-ruler" aria-hidden="true">' + ruler + '</div></div>' +
      body + '</div></div>' +
      '<p class="bm-hint muted">Mỗi hàng 32 bit (4 byte).' + (hasCollapsed ? ' Ô <span class="bc-grp">⊞</span> là một nhóm đang thu gọn — bấm để bung.' : '') + '</p>';
  }
  function selCls(n) { return app.state.selected === n.path ? ' is-sel' : ''; }

  // ---------- panel chi tiết ----------
  function renderHelp() {
    return '<div class="detail-empty"><h2>Cách dùng</h2><ol>' +
      '<li>Chọn một loại frame ở danh sách bên trái.</li>' +
      '<li>Dùng <b>Cấp hiển thị</b> để xem tổng thể (thu gọn) hoặc chi tiết (bung).</li>' +
      '<li>Bấm ▸ để bung từng nhóm, header hoặc nhóm field; bấm ô ⊞ trong sơ đồ bit để bung nhóm đó.</li>' +
      '<li>Chọn một dòng hoặc một ô để xem giải thích ở đây.</li>' +
      '<li>Bàn phím: ↑/↓ di chuyển, ←/→ thu/bung, Enter chọn, Space thu/bung.</li></ol></div>';
  }

  function renderDetail() {
    var el = $('#detail');
    var n = app.state.selected && app.model.index[app.state.selected];
    if (!n) {
      var st = app.current;
      el.innerHTML = '<div class="detail-card"><span class="eyebrow">Stack</span><h2>' + esc(st.name || st.id) + '</h2>' +
        (st.detail ? '<p>' + esc(st.detail) + '</p>' : '') + '</div>' + renderHelp();
      return;
    }
    var html = '';
    if (n.kind === 'sgroup') html = detailSGroup(n);
    else if (n.kind === 'header') html = detailHeader(n);
    else html = detailField(n);
    el.innerHTML = '<div class="detail-card">' + html + '</div>';
  }

  function dl(rows) {
    return '<dl class="kv">' + rows.filter(Boolean).map(function (r) {
      return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>';
    }).join('') + '</dl>';
  }

  function detailSGroup(n) {
    return '<span class="eyebrow">Nhóm header</span><h2>' + esc(n.name) + '</h2>' +
      dl([
        ['Kích thước', esc(fmtSize(n.bits))],
        n.offsetBit != null ? ['Vị trí trong frame', esc(byteRange(n.offsetBit, n.bits))] : null,
        ['Gồm', '<ul class="plain">' + n.children.map(function (c) {
          return '<li><a href="#" data-goto="' + attr(c.path) + '">' + esc(c.label || c.name) + '</a> <span class="muted">' + esc(c.missing ? 'thiếu' : fmtBytes(c.bits)) + '</span></li>';
        }).join('') + '</ul>']
      ]) + (n.note ? '<p>' + esc(n.note) + '</p>' : '');
  }

  function collectOptional(list, out) {
    list.forEach(function (c) { if (c.optional) out.push(c); if (c.children) collectOptional(c.children, out); });
    return out;
  }

  function detailHeader(n) {
    if (n.missing) {
      return '<span class="eyebrow">Header</span><h2>' + esc(n.name) + '</h2><div class="alert alert--error">' + esc(n.error) + '</div>';
    }
    var h = n.header;
    var opts = collectOptional(n.children, []);
    var vars = [];
    (function walk(list) { list.forEach(function (c) { if (c.isVar) vars.push(c); if (c.children) walk(c.children); }); })(n.children);
    return '<span class="eyebrow"><span class="swatch layer-' + n.layer + '"></span>Header · ' + esc(LAYER_LABEL[n.layer] || n.layer) + '</span>' +
      '<h2>' + esc(h.name) + (n.label ? ' <span class="chip">' + esc(n.label) + '</span>' : '') + '</h2>' +
      (n.added ? '<p><span class="badge badge--add">+ thêm</span> ' + (n.addedLabel ? 'so với stack gốc' : 'thuộc nhóm được thêm so với stack gốc') + '</p>' : '') +
      (h.summary ? '<p class="lead">' + esc(h.summary) + '</p>' : '') +
      dl([
        ['Kích thước', esc(fmtSize(n.bits))],
        ['Cố định / tối đa', esc((h.fixedBytes != null ? h.fixedBytes + ' byte' : '?') + (h.maxBytes ? ' / ' + h.maxBytes + ' byte' : ''))],
        n.wire ? ['Vị trí', 'Chỉ có trên dây — không tính vào kích thước frame'] : ['Vị trí trong frame', esc(byteRange(n.offsetBit, n.bits))],
        h.standard ? ['Chuẩn', esc(h.standard)] : null
      ]) +
      (n.note ? '<h3>Vai trò ở vị trí này</h3><p>' + esc(n.note) + '</p>' : '') +
      (h.detail ? '<h3>Hoạt động</h3><p>' + esc(h.detail) + '</p>' : '') +
      (opts.length ? '<h3>Phần tuỳ chọn</h3><ul class="plain">' + opts.map(function (o) {
        return '<li class="opt-line">' + optToggle(o) + ' <a href="#" data-goto="' + attr(o.path) + '">' + esc(o.name) + '</a> <span class="muted">' + esc(fmtBytes(o.sizeIfOn)) + '</span></li>';
      }).join('') + '</ul>' : '') +
      vars.map(varInput).join('') + renderVariantTable(n);
  }

  function varInput(f) {
    var r = f.varRange || {};
    return '<div class="var-box"><label>Độ dài <b>' + esc(f.name) + '</b> (byte)' +
      '<input type="number" data-action="var" data-hp="' + attr(f.headerPath) + '" data-id="' + attr(f.id) + '" value="' + f.varLen + '"' +
      (r.min != null ? ' min="' + r.min + '"' : '') + (r.max != null ? ' max="' + r.max + '"' : '') + ' step="1" inputmode="numeric"></label>' +
      '<span class="muted">' + (r.min != null ? 'từ ' + r.min : '') + (r.max != null ? ' đến ' + r.max : '') + ' byte</span></div>';
  }

  function detailField(n) {
    var h = app.model.index[n.headerPath];
    var crumbs = [];
    var p = app.model.index[n.parentPath];
    while (p && p.kind !== 'sgroup') { crumbs.unshift(p); if (p.kind === 'header') break; p = app.model.index[p.parentPath]; }
    var d = n.def || {};
    var pos = n.present ? bitRange(n.offsetInHeader, n.bits) + (n.offsetInHeader % 8 === 0 && n.bits % 8 === 0 ? ' · ' + byteRange(n.offsetInHeader, n.bits) : '') : '—';
    var abs = n.present && n.offsetBit != null ? bitRange(n.offsetBit, n.bits) + (n.offsetBit % 8 === 0 && n.bits % 8 === 0 ? ' · ' + byteRange(n.offsetBit, n.bits) : ' · trong byte ' + Math.floor(n.offsetBit / 8)) : (h && h.wire ? 'chỉ trên dây' : '—');
    var html = '<nav class="crumbs">' + crumbs.map(function (c) {
      return '<a href="#" data-goto="' + attr(c.path) + '">' + esc(c.kind === 'header' ? (c.label || c.name) : c.name) + '</a>';
    }).join(' › ') + '</nav>' +
      '<span class="eyebrow">' + (n.kind === 'group' ? 'Nhóm field' : 'Field') + '</span>' +
      '<h2>' + esc(n.name) + (n.abbr && n.abbr !== n.name ? ' <span class="abbr">(' + esc(n.abbr) + ')</span>' : '') + '</h2>' +
      dl([
        ['Kích thước', n.present ? esc(fmtSize(n.bits)) + (n.isVar ? ' — độ dài thay đổi' : '') : esc('đang tắt (nếu bật: ' + fmtSize(n.sizeIfOn) + ')')],
        ['Vị trí trong header', esc(pos)],
        ['Offset trong frame', esc(abs)],
        n.value != null ? ['Giá trị trong ngữ cảnh', '<code class="val">' + esc(n.value) + '</code>' +
          (n.flagFor && app.model.index[n.flagFor] ? ' <span class="muted">theo công tắc ' + esc(app.model.index[n.flagFor].name) + '</span>' : '')] : null,
        d.example != null ? ['Ví dụ', '<code>' + esc(d.example) + '</code>'] : null,
        n.reserved ? ['Dự trữ', 'Có — phải bằng 0 khi gửi'] : null,
        n.optional ? ['Có mặt khi', '<code>' + esc(n.optional) + '</code> ' + optToggle(n)] : null,
        h && h.header && h.header.standard ? ['Chuẩn', esc(h.header.standard)] : null
      ]) +
      (d.desc ? '<p>' + esc(d.desc) + '</p>' : '') +
      (n.isVar ? varInput(n) : '');
    if (Array.isArray(d.values) && d.values.length) {
      html += '<h3>Giá trị đáng nhớ</h3><div class="tbl-wrap"><table class="values"><thead><tr><th>Giá trị</th><th>Ý nghĩa</th></tr></thead><tbody>' +
        d.values.map(function (v) {
          var hit = n.value != null && String(v.v).toLowerCase() === String(n.value).toLowerCase();
          return '<tr' + (hit ? ' class="is-hit"' : '') + '><td><code>' + esc(v.v) + '</code></td><td>' + esc(v.m) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    if (n.kind === 'group') {
      html += '<h3>Gồm</h3><ul class="plain">' + n.children.map(function (c) {
        return '<li><a href="#" data-goto="' + attr(c.path) + '">' + esc(c.abbr || c.name) + '</a> <span class="muted">' +
          esc(c.present ? fmtBytes(c.bits) + ' · ' + bitRange(c.offsetInHeader, c.bits) : 'đang tắt') + '</span></li>';
      }).join('') + '</ul>';
    }
    return html;
  }

  // ---------- hành động ----------
  function select(path, opts) {
    opts = opts || {};
    var node = app.model.index[path];
    if (!node) return;
    app.state.selected = path;
    if (opts.reveal) {
      openAncestors(node);
      if (opts.open && canOpen(node)) setOpen(node, true);
      saveState();
      app.focusPath = path;
      render();
      var row = rowEl(path);
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
    saveState();
    // cập nhật nhẹ: chỉ class chọn + panel chi tiết
    Array.prototype.forEach.call(document.querySelectorAll('.is-sel'), function (e) { e.classList.remove('is-sel'); });
    Array.prototype.forEach.call(document.querySelectorAll('[aria-selected="true"]'), function (e) { e.setAttribute('aria-selected', 'false'); });
    Array.prototype.forEach.call(document.querySelectorAll('[data-hl="' + cssEsc(path) + '"]'), function (e) {
      e.classList.add('is-sel');
      if (e.getAttribute('role') === 'treeitem') e.setAttribute('aria-selected', 'true');
    });
    renderDetail();
    if (opts.showDetail && window.matchMedia && window.matchMedia('(max-width: 1100px)').matches) {
      $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function toggle(path, force) {
    var node = app.model.index[path];
    if (!canOpen(node)) return;
    setOpen(node, force == null ? !isOpen(node) : force);
    saveState();
    app.focusPath = path;
    render();
  }

  function setLevel(n) {
    app.state.level = n;
    app.state.open = {};
    saveState();
    render();
  }

  function setOptional(hp, id) {
    var node = app.model.index[hp + '/' + id];
    if (!node) return;
    app.state.enabled[hp] = app.state.enabled[hp] || {};
    app.state.enabled[hp][id] = !node.enabled;
    saveState();
    render();
  }

  function setVar(hp, id, val) {
    app.state.varBytes[hp] = app.state.varBytes[hp] || {};
    app.state.varBytes[hp][id] = Number(val) || 0;
    saveState();
    render();
  }

  function rowEl(path) { return document.querySelector('#tree .row[data-path="' + cssEsc(path) + '"]'); }

  function restoreFocus() {
    var tree = $('#tree');
    var rows = tree.querySelectorAll('.row');
    if (!rows.length) return;
    var target = (app.focusPath && rowEl(app.focusPath)) || (app.state.selected && rowEl(app.state.selected)) || rows[0];
    target.setAttribute('tabindex', '0');
    if (app.focusPath && rowEl(app.focusPath)) {
      try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); }
    }
  }

  function focusRow(row) {
    if (!row) return;
    Array.prototype.forEach.call(document.querySelectorAll('#tree .row[tabindex="0"]'), function (r) { r.setAttribute('tabindex', '-1'); });
    row.setAttribute('tabindex', '0');
    row.focus();
    app.focusPath = row.getAttribute('data-path');
  }

  // ---------- highlight ↔ ----------
  function applyHighlight(path) {
    Array.prototype.forEach.call(document.querySelectorAll('.is-hl'), function (e) { e.classList.remove('is-hl'); });
    if (!path) return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-hl="' + cssEsc(path) + '"]'), function (e) { e.classList.add('is-hl'); });
  }

  // ---------- giao diện: theme ----------
  function initTheme() {
    var t = storeGet('ethviz.theme');
    applyTheme(THEMES.indexOf(t) >= 0 ? t : 'auto');
  }
  function applyTheme(t) {
    app.theme = t;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    var b = $('#theme-btn');
    if (b) { b.textContent = THEME_LABEL[t]; b.title = 'Giao diện: ' + THEME_LABEL[t] + ' — bấm để đổi'; }
  }

  // ---------- sự kiện ----------
  function bindEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('change', onChange);
    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest && e.target.closest('[data-hl]');
      var p = t ? t.getAttribute('data-hl') : null;
      if (p !== app.hl) { app.hl = p; applyHighlight(p); }
    });
    document.addEventListener('mouseleave', function () { app.hl = null; applyHighlight(null); });
    $('#tree').addEventListener('keydown', onTreeKey);
    $('#tree').addEventListener('focusin', function (e) {
      var row = e.target.closest('.row');
      if (row) { app.hl = row.getAttribute('data-hl'); applyHighlight(app.hl); }
    });
    $('#search').addEventListener('input', function (e) { app.query = e.target.value; renderSidebar(); });
    window.addEventListener('hashchange', function () {
      var id = idFromHash();
      if (id && (!app.current || id !== app.current.id)) showStack(id, true);
    });
  }

  function onClick(e) {
    var t = e.target;
    if (!t.closest) return;
    var btn;
    if ((btn = t.closest('#theme-btn'))) { var t2 = THEMES[(THEMES.indexOf(app.theme) + 1) % THEMES.length]; applyTheme(t2); storeSet('ethviz.theme', t2); return; }
    if ((btn = t.closest('#menu-btn'))) {
      var on = document.body.classList.toggle('nav-open');
      btn.setAttribute('aria-expanded', String(on));
      if (on) $('#search').focus();
      return;
    }
    if (t.closest('#scrim')) { document.body.classList.remove('nav-open'); return; }
    if (!app.model) return;
    if ((btn = t.closest('[data-level]'))) { setLevel(Number(btn.getAttribute('data-level'))); return; }
    if ((btn = t.closest('[data-action="reset"]'))) {
      app.state = defaultState(); saveState(); render(); return;
    }
    if ((btn = t.closest('[data-action="variant"]'))) {
      e.preventDefault(); applyVariant(btn.getAttribute('data-hp'), btn.getAttribute('data-vid'), btn.hasAttribute('data-reveal')); return;
    }
    if ((btn = t.closest('[data-action="opt"]'))) {
      e.preventDefault(); e.stopPropagation();
      setOptional(btn.getAttribute('data-hp'), btn.getAttribute('data-id')); return;
    }
    if ((btn = t.closest('[data-goto]'))) { e.preventDefault(); select(btn.getAttribute('data-goto'), { reveal: true }); return; }
    if ((btn = t.closest('.fm-seg'))) { select(btn.getAttribute('data-path'), { reveal: true, open: true }); return; }
    if ((btn = t.closest('.bc, .bm-band'))) {
      var p = btn.getAttribute('data-path');
      if (btn.hasAttribute('data-expand')) { app.state.selected = p; toggle(p, true); }
      else select(p, { showDetail: true });
      return;
    }
    if ((btn = t.closest('[data-action="toggle"]'))) {
      var row = btn.closest('.row');
      toggle(row.getAttribute('data-path'));
      return;
    }
    var r = t.closest('#tree .row');
    if (r) { focusRow(r); select(r.getAttribute('data-path'), { showDetail: true }); }
  }

  function onChange(e) {
    var t = e.target;
    if (t.matches && t.matches('[data-action="var"]')) setVar(t.getAttribute('data-hp'), t.getAttribute('data-id'), t.value);
  }

  function onTreeKey(e) {
    var row = e.target.closest && e.target.closest('.row');
    if (!row) return;
    var rows = Array.prototype.slice.call(document.querySelectorAll('#tree .row'));
    var i = rows.indexOf(row);
    var path = row.getAttribute('data-path');
    var node = app.model.index[path];
    var open = isOpen(node);
    switch (e.key) {
      case 'ArrowDown': focusRow(rows[Math.min(i + 1, rows.length - 1)]); break;
      case 'ArrowUp': focusRow(rows[Math.max(i - 1, 0)]); break;
      case 'Home': focusRow(rows[0]); break;
      case 'End': focusRow(rows[rows.length - 1]); break;
      case 'ArrowRight':
        if (canOpen(node) && !open) toggle(path, true);
        else focusRow(rows[i + 1] && rows[i + 1].closest('.node') && row.closest('.node').contains(rows[i + 1]) ? rows[i + 1] : row);
        break;
      case 'ArrowLeft':
        if (canOpen(node) && open) toggle(path, false);
        else if (node.parentPath && rowEl(node.parentPath)) focusRow(rowEl(node.parentPath));
        break;
      case 'Enter': select(path, { showDetail: true }); break;
      case ' ': toggle(path); break;
      default: return;
    }
    e.preventDefault();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot);
  else safeBoot();

  function safeBoot() {
    try { boot(); } catch (err) {
      showFatal('Lỗi: ' + esc(err && err.message) + '. Mở Console (F12) để xem chi tiết.');
      if (window.console) console.error(err);
    }
  }
})();
