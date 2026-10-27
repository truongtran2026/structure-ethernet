/*
 * nav.js — vỏ ứng dụng dùng chung cho mọi mảng:
 *  - thanh bên trái dạng cây: IP / Ethernet · Truyền dẫn (PDH/SDH/OTN) · Phòng thí nghiệm ghép kênh;
 *    thu gọn/bung từng mảng/nhóm, LƯU trạng thái + mục đang xem (localStorage) để mở lại đúng như cũ;
 *  - ô tìm kiếm lọc toàn cây (tự bung nhóm có kết quả, không ghi đè trạng thái đã lưu);
 *  - định tuyến hash: #<stackId> (mảng IP, giữ tương thích), #t/<frameId>, #lab/<labId>, #quiz/<chủ đề>, #calc, #sim/<kịch bản>, #line/<chuỗi>,
 *    #conn/<pinout|cable|convert>;
 *  - giao diện sáng/tối, nút menu trên di động.
 * Các mảng đăng ký view: window.IPView, window.TransView, window.MuxLab, window.QuizView, window.CalcView, window.MapSimView, window.LineView, window.ConnView — mỗi view có init/show/hide.
 */
(function () {
  'use strict';

  var NAV_KEY = 'fs.nav.v1';
  var THEMES = ['auto', 'light', 'dark'];
  var THEME_LABEL = { auto: '◐ Tự động', light: '☀ Sáng', dark: '☾ Tối' };
  var FAMILY = {
    pdh: { name: 'PDH', hint: 'Phân cấp cận đồng bộ (E1…E4)', order: 1 },
    sdh: { name: 'SDH', hint: 'Phân cấp số đồng bộ (STM-N)', order: 2 },
    otn: { name: 'OTN', hint: 'Mạng truyền tải quang (OTUk/ODUk)', order: 3 },
    flexe: { name: 'FlexE', hint: 'Flexible Ethernet (OIF FlexE IA): instance 100G, khe lịch 5G', order: 4 }
  };
  var CONTAINER = { ip: 'view-ip', t: 'view-t', lab: 'view-lab', quiz: 'view-quiz', calc: 'view-calc', sim: 'view-sim', line: 'view-line', conn: 'view-conn' };
  var APP_NAME = 'Frame Structure';

  var nav = { domains: [], items: {}, route: null, query: '', store: { open: {}, last: null, scroll: 0 }, theme: 'auto' };

  // ---------- tiện ích ----------
  function $(sel, el) { return (el || document).querySelector(sel); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function storeGet(key) { try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function storeSet(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* riêng tư… */ } }
  function saveNav() { storeSet(NAV_KEY, nav.store); }
  function num(n) { return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''); }

  // ---------- định tuyến ----------
  /** "#t/stm-1" → { view:'t', id:'stm-1' }; "#gre-ipv4" → { view:'ip', id:'gre-ipv4' }. */
  function parseHash(h) {
    var s = decodeURIComponent(String(h || '').replace(/^#/, ''));
    if (!s) return null;
    if (s === 'calc') return { view: 'calc', id: 'calc' };
    var m = /^(t|lab|quiz|sim|line|conn)\/(.+)$/.exec(s);
    return m ? { view: m[1], id: m[2] } : { view: 'ip', id: s };
  }
  function hashOf(r) { if (r.view === 'calc') return '#calc'; return '#' + (r.view === 'ip' ? '' : r.view + '/') + encodeURIComponent(r.id).replace(/%2F/g, '/'); }
  function keyOf(r) { return r.view + ':' + r.id; }
  function valid(r) { return !!(r && nav.items[keyOf(r)]); }

  function firstRoute() {
    for (var i = 0; i < nav.domains.length; i++) {
      var it = firstItem(nav.domains[i]);
      if (it) return it.route;
    }
    return null;
  }
  function firstItem(node) {
    if (node.items && node.items.length) return node.items[0];
    for (var i = 0; node.groups && i < node.groups.length; i++) { var it = firstItem(node.groups[i]); if (it) return it; }
    return null;
  }

  function go(r, replace) {
    var prev = nav.route;
    if (!valid(r)) r = firstRoute();
    if (!r) { // không có dữ liệu nào: để mảng IP hiện thông báo "chưa có dữ liệu"
      if (window.IPView) { showContainer('ip'); window.IPView.show(null); }
      return;
    }
    var h = hashOf(r);
    if (h !== location.hash) {
      var done = false;
      if (replace && history.replaceState) {
        try { history.replaceState(null, '', location.href.split('#')[0] + h); done = true; } catch (e) { /* vd trang có <base> khác thư mục */ }
      }
      if (!done) { nav.route = r; location.hash = h; }
    }
    nav.route = r;
    nav.store.last = h;
    saveNav();
    showContainer(r.view);
    var v = viewOf(r.view);
    try { v.show(r.id); } catch (e) {
      $('#alerts').innerHTML = '<div class="alert alert--error"><strong>Lỗi hiển thị:</strong> ' + esc(e && e.message) + '</div>';
      if (window.console) console.error(e);
    }
    var it = nav.items[keyOf(r)];
    document.title = (it ? it.label + ' · ' : '') + APP_NAME + ' — Cấu trúc khung';
    markActive();
    document.body.classList.remove('nav-open');
    var mb = $('#menu-btn'); if (mb) mb.setAttribute('aria-expanded', 'false');
    if (!prev || keyOf(prev) !== keyOf(r)) window.scrollTo(0, 0);
  }

  function viewOf(name) { return { ip: window.IPView, t: window.TransView, lab: window.MuxLab, quiz: window.QuizView, calc: window.CalcView, sim: window.MapSimView, line: window.LineView, conn: window.ConnView }[name]; }
  function showContainer(view) {
    Object.keys(CONTAINER).forEach(function (k) {
      var el = document.getElementById(CONTAINER[k]);
      if (el) el.hidden = k !== view;
    });
    Object.keys(CONTAINER).forEach(function (k) { if (k !== view && viewOf(k) && viewOf(k).hide) viewOf(k).hide(); });
    if (view !== 'ip') $('#alerts').innerHTML = '';
  }

  // ---------- dựng cây dữ liệu ----------
  function addItem(route, label, meta, search, tip) {
    var it = { route: route, label: label, meta: meta || '', search: normQ(search), tip: tip || '' };
    nav.items[keyOf(route)] = it;
    return it;
  }

  function buildDomains() {
    nav.domains = []; nav.items = {};
    // IP / Ethernet
    var stacks = window.IPView ? window.IPView.stacks() : [];
    if (stacks.length) {
      var heads = window.HEADERS || {};
      var cats = [], byCat = {};
      stacks.forEach(function (st) {
        var c = st.category || 'Khác';
        if (!byCat[c]) { byCat[c] = { key: 'c:ip:' + c, name: c, items: [] }; cats.push(byCat[c]); }
        var bytes = '';
        try { bytes = num(window.EthViz.buildModel(st, {}, heads, stacks).totals.frameBytes) + ' B'; } catch (e) { bytes = '!'; }
        var hay = [st.id, st.name, st.summary, st.category];
        (function walk(list) {
          (list || []).forEach(function (sn) {
            if (!sn) return;
            if (sn.children) { hay.push(sn.group); walk(sn.children); return; }
            hay.push(sn.header, sn.label);
            var h = heads[sn.header];
            if (h) {
              hay.push(h.name, h.short);
              // tên field/group để tìm được "route distinguisher", "route target"…
              (function fields(fs) { (fs || []).forEach(function (f) { if (f) { hay.push(f.name, f.abbr); fields(f.children); } }); })(h.fields);
            }
          });
        })(st.tree);
        byCat[c].items.push(addItem({ view: 'ip', id: st.id }, st.name || st.id, bytes, hay.join(' \u0001 '),
          'Kích thước frame mặc định (cấu hình gốc của stack, không tính preamble/SFD)'));
      });
      nav.domains.push({ key: 'd:ip', name: 'IP / Ethernet', icon: '⧉', groups: cats, count: stacks.length });
    }
    // Truyền dẫn
    var FR = window.TFRAMES || {}, TV = window.TransViz;
    var frames = Object.keys(FR).map(function (k) { return FR[k]; }).filter(function (f) { return f && f.id && f.grid; });
    if (frames.length && window.TransView) {
      var fams = {};
      frames.forEach(function (f) {
        var fk = f.family || 'khác';
        var fam = fams[fk] || (fams[fk] = { key: 'f:' + fk, name: (FAMILY[fk] || { name: fk.toUpperCase() }).name,
          hint: (FAMILY[fk] || {}).hint, order: (FAMILY[fk] || { order: 9 }).order, groups: [], byCat: {} });
        var c = f.category || 'Khác';
        if (!fam.byCat[c]) { fam.byCat[c] = { key: 'c:t:' + fk + ':' + c, name: c, items: [], frames: [] }; fam.groups.push(fam.byCat[c]); }
        fam.byCat[c].frames.push(f);
      });
      var famList = Object.keys(fams).map(function (k) { return fams[k]; }).sort(function (a, b) { return a.order - b.order; });
      famList.forEach(function (fam) {
        fam.groups.forEach(function (g) {
          g.frames.sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
          g.items = g.frames.map(function (f) {
            var meta = TV ? TV.fmtRate(f.rateKbps) : '';
            return addItem({ view: 't', id: f.id }, f.name || f.id, meta,
              [f.id, f.name, f.summary, f.category, f.family, f.unit].join(' '), (f.grid.rows + ' × ' + f.grid.cols) + (f.grid.cellBits === 1 ? ' bit' : ' ô') + ', chu kỳ ' + (TV ? TV.fmtNum(f.periodUs, 2) : f.periodUs) + ' µs');
          });
        });
      });
      nav.domains.push({ key: 'd:t', name: 'Truyền dẫn', icon: '▦', groups: famList, count: frames.length });
    }
    // Phòng thí nghiệm
    var labs = (Array.isArray(window.TLABS) ? window.TLABS : []).filter(function (l) { return l && l.id; });
    if (labs.length && window.MuxLab) {
      nav.domains.push({ key: 'd:lab', name: 'Phòng thí nghiệm ghép kênh', icon: '⚗', count: labs.length,
        items: labs.map(function (l) {
          return addItem({ view: 'lab', id: l.id }, l.name || l.id, (l.family || '').toUpperCase(),
            [l.id, l.name, l.intro, l.family].concat(l.roots || [], l.palette || []).join(' '), l.intro);
        }) });
    }
    // Từ khung tới bước sóng (TLINE)
    var lines = [];
    if (window.LineView) { try { lines = window.LineView.items() || []; } catch (e) { lines = []; } }
    if (lines.length) {
      nav.domains.push({ key: 'd:line', name: 'Từ khung tới bước sóng', icon: '〰', count: lines.length,
        items: lines.map(function (x) {
          return addItem({ view: 'line', id: x.id }, x.name, '', 'từ khung tới bước sóng giao diện đường truyền coherent fec gbd ký hiệu điều chế dwdm ghz ' + x.id + ' ' + x.name + ' ' + (x.hint || ''), x.hint || '');
        }) });
    }
    // Mô phỏng ánh xạ (TMAPS)
    var sims = [];
    if (window.MapSimView) { try { sims = window.MapSimView.items() || []; } catch (e) { sims = []; } }
    if (sims.length) {
      nav.domains.push({ key: 'd:sim', name: 'Mô phỏng ánh xạ', icon: '▶', count: sims.length,
        items: sims.map(function (x) {
          return addItem({ view: 'sim', id: x.id }, x.name, x.method, 'mô phỏng ánh xạ mapping ' + x.method + ' ' + x.id + ' ' + x.name + ' ' + (x.hint || ''), x.hint || '');
        }) });
    }
    // Đấu nối (CONN_*): mục Chuyển đổi đứng đầu, rồi họ → Sơ đồ chân / Cáp & chuyển đổi
    var cm = null;
    if (window.ConnView) { try { cm = window.ConnView.navModel(); } catch (e) { cm = null; } }
    if (cm && cm.families.length) {
      var cGroups = cm.families.map(function (f) {
        var sub = [];
        if (f.pinouts.length) sub.push({ key: 'c:conn:' + f.key + ':p', name: 'Sơ đồ chân', items: f.pinouts.map(function (x) {
          return addItem({ view: 'conn', id: x.id }, x.name, x.meta, x.search, x.tip); }) });
        if (f.cables.length) sub.push({ key: 'c:conn:' + f.key + ':c', name: 'Cáp & chuyển đổi', items: f.cables.map(function (x) {
          return addItem({ view: 'conn', id: x.id }, x.name, x.meta, x.search, x.tip); }) });
        if (f.loops && f.loops.length) sub.push({ key: 'c:conn:' + f.key + ':l', name: 'Nút loopback (kiểm tra cổng)', items: f.loops.map(function (x) {
          return addItem({ view: 'conn', id: x.id }, x.name, x.meta, x.search, x.tip); }) });
        return { key: 'f:conn:' + f.key, name: f.name, groups: sub };
      });
      nav.domains.push({ key: 'd:conn', name: 'Đấu nối', icon: '⇄', count: cm.count, groups: cGroups,
        items: [addItem({ view: 'conn', id: 'convert' }, cm.convert.name, '', cm.convert.search, cm.convert.tip)] });
    }
    // Ôn tập (chủ đề có câu hỏi) + Máy tính tốc độ
    var topics = [];
    if (window.QuizView) { try { topics = window.QuizView.items() || []; } catch (e) { topics = []; } }
    if (topics.length) {
      nav.domains.push({ key: 'd:quiz', name: 'Ôn tập', icon: '✎', count: topics.length,
        items: topics.map(function (t) {
          return addItem({ view: 'quiz', id: t.id }, t.name, '', 'ôn tập quiz trắc nghiệm câu hỏi ' + t.id + ' ' + t.name + ' ' + (t.hint || ''), t.hint || '');
        }) });
    }
    if (window.CalcView) {
      nav.domains.push({ key: 'd:calc', name: 'Công cụ', icon: '∑', count: 1,
        items: [addItem({ view: 'calc', id: 'calc' }, 'Máy tính tốc độ', '', 'máy tính tốc độ calc hiệu suất overhead gfp ethernet tối đa mtu mss phân mảnh policer cir khai báo',
          'Tốc độ, chuỗi ghép, số nhánh tối đa, GFP-F, hiệu suất stack')] });
    }
  }

  // ---------- vẽ cây ----------
  function isOpen(key) { return nav.store.open[key] !== false; } // mặc định mở

  /** Chuẩn hoá chuỗi tìm: chữ thường, gạch nối/gạch dưới/khoảng trắng coi như một dấu cách ("route-target" = "route target"). */
  function normQ(s) { return String(s || '').toLowerCase().replace(/[\s\-_]+/g, ' '); }

  function matches(it, q) { return !q || it.search.indexOf(q) >= 0 || normQ(it.label).indexOf(q) >= 0; }

  /** Vẽ một nút nhóm (mảng / họ / category). Trả về '' nếu không còn mục nào sau khi lọc. */
  function renderGroup(node, depth, q) {
    var inner = '';
    // mục trực tiếp đứng trước nhóm con (vd. "Chuyển đổi" đầu mảng Đấu nối)
    if (node.items) {
      var lis = node.items.filter(function (it) { return matches(it, q); }).map(renderItem).join('');
      if (lis) inner += '<ul class="tn-list">' + lis + '</ul>';
    }
    if (node.groups) inner += node.groups.map(function (g) { return renderGroup(g, depth + 1, q); }).join('');
    if (!inner) return '';
    var open = q ? true : isOpen(node.key);
    var id = 'tn-' + node.key.replace(/[^\w-]+/g, '_');
    return '<div class="tn tn--d' + depth + (open ? ' is-open' : '') + '">' +
      '<button type="button" class="tn-head" data-nav-key="' + esc(node.key) + '" aria-expanded="' + open + '" aria-controls="' + id + '"' +
        (node.hint ? ' title="' + esc(node.hint) + '"' : '') + '>' +
        '<span class="tn-caret" aria-hidden="true">' + (open ? '▾' : '▸') + '</span>' +
        (node.icon ? '<span class="tn-icon" aria-hidden="true">' + esc(node.icon) + '</span>' : '') +
        '<span class="tn-name">' + esc(node.name) + '</span>' +
        (node.count != null ? '<span class="tn-count">' + node.count + '</span>' : '') +
      '</button>' +
      '<div class="tn-body" id="' + id + '"' + (open ? '' : ' hidden') + '>' + inner + '</div></div>';
  }

  function renderItem(it) {
    return '<li><a class="nav-item" href="' + esc(hashOf(it.route)) + '" data-route="' + esc(keyOf(it.route)) + '">' +
      '<span class="nav-name">' + esc(it.label) + '</span>' +
      (it.meta ? '<span class="nav-meta" title="' + esc(it.tip) + '">' + esc(it.meta) + '</span>' : '') + '</a></li>';
  }

  function renderNav() {
    var q = normQ(nav.query).trim();
    var html = nav.domains.map(function (d) { return renderGroup(d, 0, q); }).join('');
    if (!html) html = '<p class="muted nav-empty">' + (nav.domains.length ? 'Không có kết quả cho “' + esc(nav.query) + '”.' : 'Chưa có dữ liệu.') + '</p>';
    $('#nav').innerHTML = html;
    markActive();
  }

  function markActive() {
    var key = nav.route ? keyOf(nav.route) : null;
    Array.prototype.forEach.call(document.querySelectorAll('#nav .nav-item'), function (a) {
      var on = a.getAttribute('data-route') === key;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  function toggleGroup(key) {
    if (nav.query.trim()) return; // đang lọc: nhóm luôn bung, không đổi trạng thái lưu
    nav.store.open[key] = !isOpen(key);
    saveNav();
    renderNav();
    var b = document.querySelector('#nav [data-nav-key="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
    if (b) b.focus();
  }

  // ---------- theme ----------
  function applyTheme(t) {
    nav.theme = t;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    var b = $('#theme-btn');
    if (b) { b.textContent = THEME_LABEL[t]; b.title = 'Giao diện: ' + THEME_LABEL[t] + ' — bấm để đổi'; }
  }

  // ---------- sự kiện ----------
  function bind() {
    document.addEventListener('click', function (e) {
      var t = e.target; if (!t.closest) return;
      var b;
      if ((b = t.closest('#theme-btn'))) {
        var t2 = THEMES[(THEMES.indexOf(nav.theme) + 1) % THEMES.length];
        applyTheme(t2); storeSet('ethviz.theme', t2); return;
      }
      if ((b = t.closest('#menu-btn'))) {
        var on = document.body.classList.toggle('nav-open');
        b.setAttribute('aria-expanded', String(on));
        if (on) $('#search').focus();
        return;
      }
      if (t.closest('#scrim')) { document.body.classList.remove('nav-open'); return; }
      if ((b = t.closest('#nav [data-nav-key]'))) { toggleGroup(b.getAttribute('data-nav-key')); return; }
      if ((b = t.closest('#nav .nav-item'))) {
        // cùng mục → không đổi hash, chỉ đóng menu di động
        if (nav.route && b.getAttribute('data-route') === keyOf(nav.route)) { e.preventDefault(); document.body.classList.remove('nav-open'); }
      }
    });
    $('#search').addEventListener('input', function (e) { nav.query = e.target.value; renderNav(); });
    $('#nav').addEventListener('keydown', function (e) {
      var b = e.target.closest && e.target.closest('[data-nav-key]');
      if (!b || nav.query.trim()) return;
      var k = b.getAttribute('data-nav-key');
      if ((e.key === 'ArrowLeft' && isOpen(k)) || (e.key === 'ArrowRight' && !isOpen(k))) { e.preventDefault(); toggleGroup(k); }
    });
    var sb = $('#sidebar'), tm = null;
    if (sb) sb.addEventListener('scroll', function () {
      clearTimeout(tm);
      tm = setTimeout(function () { nav.store.scroll = sb.scrollTop; saveNav(); }, 200);
    });
    window.addEventListener('hashchange', function () {
      var r = parseHash(location.hash);
      if (!r || !valid(r)) return;
      if (!nav.route || keyOf(r) !== keyOf(nav.route)) go(r, true);
    });
  }

  // ---------- khởi động ----------
  function showFatal(html) {
    var b = $('#boot');
    if (b) { b.hidden = false; b.innerHTML = '<div class="alert alert--error"><strong>Không khởi động được.</strong> ' + html + '</div>'; }
  }

  function boot() {
    var t = storeGet('ethviz.theme');
    applyTheme(THEMES.indexOf(t) >= 0 ? t : 'auto');
    var saved = storeGet(NAV_KEY);
    if (saved && typeof saved === 'object') {
      nav.store.open = saved.open && typeof saved.open === 'object' ? saved.open : {};
      nav.store.last = typeof saved.last === 'string' ? saved.last : null;
      nav.store.scroll = +saved.scroll || 0;
    }
    if (!window.IPView) { showFatal('Không nạp được <code>js/app.js</code>.'); return; }
    ['IPView', 'TransView', 'MuxLab', 'QuizView', 'CalcView', 'MapSimView', 'LineView', 'ConnView'].forEach(function (name) {
      var v = window[name];
      if (!v || !v.init) return;
      try { v.init(); } catch (e) {
        if (name === 'IPView') throw e;
        window[name] = null; // mảng phụ lỗi → ẩn mảng, mảng IP vẫn chạy
        (window.__ethvizLoad = window.__ethvizLoad || { failed: [], errors: [] }).errors.push(name + ': ' + e.message);
      }
    });
    buildDomains();
    $('#app').hidden = false;
    var bootEl = $('#boot'); if (bootEl) bootEl.hidden = true;
    bind();
    renderNav();
    var sb = $('#sidebar'); if (sb && nav.store.scroll) sb.scrollTop = nav.store.scroll;
    // ưu tiên: hash trong URL → mục xem lần trước → mục đầu tiên
    var r = parseHash(location.hash);
    if (!valid(r)) r = parseHash(nav.store.last);
    go(valid(r) ? r : firstRoute(), true);
  }

  function safeBoot() {
    try { boot(); } catch (err) {
      showFatal('Lỗi: ' + esc(err && err.message) + '. Mở Console (F12) để xem chi tiết.');
      if (window.console) console.error(err);
    }
  }

  /** HTML cảnh báo script không nạp được (dùng chung cho mọi view). */
  function loadAlertsHtml() {
    var L = window.__ethvizLoad || {}, out = '';
    (L.failed || []).forEach(function (src) {
      out += '<div class="alert alert--warn"><strong>Không nạp được <code>' + esc(src) + '</code>.</strong> File chưa tồn tại hoặc sai đường dẫn.</div>';
    });
    (L.errors || []).forEach(function (msg) { out += '<div class="alert alert--error"><strong>Lỗi script:</strong> ' + esc(msg) + '</div>'; });
    return out;
  }

  window.AppNav = {
    go: function (hash) { var r = parseHash(hash); if (valid(r)) go(r); },
    has: function (hash) { return valid(parseHash(hash)); },
    loadAlertsHtml: loadAlertsHtml,
    storeGet: storeGet, storeSet: storeSet, esc: esc
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeBoot);
  else setTimeout(safeBoot, 0);
})();
