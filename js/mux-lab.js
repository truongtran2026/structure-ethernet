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
  var VCG_FILL_MAX = 400; // "Lấp đầy" bằng VCG: tối đa số VCG mỗi lần bấm

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
  /** Giá trị lựa chọn từ thuộc tính/ô chọn: 'ts' (bể TS) hoặc số. */
  function optVal(v) { return v === 'ts' ? 'ts' : +v; }
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
  function save() {
    if (!lb.lab) return;
    if (lb.st.trees[lb.st.root]) L().vcgSync(lb.st.trees[lb.st.root]); // sổ VCG khớp cây (LCAS, gỡ hộp cha…)
    storeSet(STORE_PREFIX + lb.lab.id, lb.st);
  }
  function tree() {
    var r = lb.st.root;
    var t = lb.st.trees[r];
    if (!t || t.u !== r || !Array.isArray(t.kids)) t = lb.st.trees[r] = L().newRoot(MUX(), r);
    if (!t.__ok) { L().ensureKeys(t); L().vcgSync(t); Object.defineProperty(t, '__ok', { value: true, enumerable: false }); }
    return t;
  }
  /** Khoá trạng thái thu gọn của vị trí path (ổn định khi gỡ con trong bể TS). */
  function ckey(path) { return L().stableKey(tree(), path); }
  /** Màu VCG g (dùng chung bảng màu với bể TS). */
  function vcgHue(g) { return tsHue(g - 1 + 3); }
  function isVcgItem(id) { var M = MUX(); return L().isVcg(M, id) || L().vcgsFor(M, id).length > 0; }
  /** Số tối đa trong khung gốc: đơn vị thường theo cây accepts, VCG/Ethernet theo số thành viên. */
  function maxIn(root, id) { var M = MUX(); return L().maxCount(M, root, id) || L().vcgMax(M, root, id); }

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
        '<span class="muted lab-rate">' + esc(TV().fmtRate(L().unitKbps(M, lb.st.root))) + (L().isByteUnit(M, lb.st.root) ? ' · ' + esc(n(L().unitBytes(M, lb.st.root), 0)) + ' byte/125 µs' : '') + '</span>' +
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
      renderVcgs(t) +
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

  function palSize(u) { return u.members ? u.members.count + '×' + nm(u.members.of) : u.bytesPer125us != null ? n(u.bytesPer125us, 0) + ' B' : TV().fmtRate(u.rateKbps); }
  function palItem(id, tip, na) {
    var M = MUX(), u = M[id], client = L().isClient(M, id);
    return '<button type="button" class="pal-item k-' + (client ? 'client' : u.kind) + (lb.armed === id ? ' is-armed' : '') + (na ? ' is-na' : '') +
      '" draggable="true" data-lpal="' + esc(id) + '" aria-pressed="' + (lb.armed === id) + '" title="' + esc((u.summary || '') + tip) + '">' +
      '<span class="pal-name">' + esc(nm(id)) + '</span><span class="pal-size">' + esc(palSize(u)) + '</span></button>';
  }
  /** Nhóm palette của lab khách (vd "Bên trong STM-N (SDH)"): chỉ hiện đơn vị khi cây có khung khách đang mở. */
  function guestGroups() {
    var M = MUX(), t = tree();
    return L().guestLabs(M, t).map(function (g) {
      var hosts = L().guestHosts(t, g), open = hosts.filter(function (h) { return h.open; });
      var gen = nm(g.roots[0]).replace(/\d+$/, 'N'), fam = (g.lab.family || g.lab.id).toUpperCase();
      g.hostsOpen = open.length; g.hostsAll = hosts.length; g.title = 'Bên trong ' + gen + ' (' + fam + ')'; g.gen = gen; g.fam = fam;
      g.ids = g.ids.filter(function (id) { return !isVcgItem(id); });
      g.ids.sort(function (a, b) { return (M[a].level || 0) - (M[b].level || 0); });
      return g;
    }).filter(function (g) { return g.ids.length; });
  }
  function renderGuestPalette() {
    var M = MUX(), t = tree();
    return guestGroups().map(function (g) {
      var folded = !!(lb.guestFold && lb.guestFold[g.lab.id]);
      var head = '<button type="button" class="pal-guest-h" data-lguest="' + esc(g.lab.id) + '" aria-expanded="' + !folded + '">' +
        '<span class="pal-guest-caret">' + (folded ? '▸' : '▾') + '</span> ' + esc(g.title) +
        '<span class="muted"> · ' + (g.hostsOpen ? g.hostsOpen + ' ' + esc(g.gen) + ' đang mở' : 'chưa mở') + '</span></button>';
      var body;
      if (!g.hostsOpen) {
        body = '<p class="muted pal-hint">Mở một ' + esc(g.gen) + ' trong cây (đổi ô chọn của nó từ “Nguyên khối” sang một phương án) để thả đơn vị ' + esc(g.fam) + ' vào.' +
          (g.hostsAll ? ' Hoặc thả thẳng đơn vị ' + esc(g.fam) + ' lên gốc: ' + esc(g.gen) + ' nguyên khối trong cây sẽ tự mở.' : '') + '</p>';
        if (!g.hostsAll) return '<div class="pal-guest is-dim">' + head + (folded ? '' : body) + '</div>';
      }
      var list = '<div class="pal-list">' + g.ids.map(function (id) {
        var ok = L().guestPlaceable(M, t, id);
        return palItem(id, ok ? ' — thả vào ' + g.gen + ' đang mở (hoặc thả lên gốc)' : ' — ' + g.gen + ' trong cây không chứa được', !ok || !g.hostsOpen);
      }).join('') + '</div>';
      return '<div class="pal-guest' + (g.hostsOpen ? '' : ' is-dim') + '">' + head + (folded ? '' : (g.hostsOpen ? '' : body) + list) + '</div>';
    }).join('');
  }

  function renderPalette() {
    var M = MUX(), root = lb.st.root;
    var items = (lb.lab.palette || []).filter(function (id) { return M[id]; });
    items.sort(function (a, b) { return (M[a].level || 0) - (M[b].level || 0); });
    return '<div class="section-title"><h2>Đơn vị</h2><span class="muted">từ bé đến lớn</span></div>' +
      '<div class="pal-list">' + items.map(function (id) {
        var max = maxIn(root, id);
        return palItem(id, max ? ' — tối đa ' + max + ' trong ' + nm(root) : ' — không ghép được vào ' + nm(root), !max);
      }).join('') + '</div>' + renderGuestPalette() +
      '<p class="muted pal-hint">' + palHint(root) +
      (items.some(function (id) { return M[id].members; }) ? ' <b>VCAT</b>: thả VCG (VC-n-Xv) hoặc Ethernet vào khung — các thành viên được rải vào VC trống bất kỳ (không cần liền kề), mỗi thành viên mang nhãn VCG#·SQ; gỡ một thành viên để thấy LCAS giảm băng thông.' : '') + '</p>';
  }
  /** Gốc có bể TS ở dưới (OTN) không. */
  function poolUnder(root) {
    var M = MUX(), seen = {}, q = [root];
    while (q.length) {
      var id = q.shift();
      if (seen[id] || !M[id]) continue;
      seen[id] = true;
      if (L().hasPool(M, id)) return true;
      (M[id].accepts || []).forEach(function (a) { if (L().autoOpen(M, id, a.of)) q.push(a.of); });
    }
    return false;
  }
  function palHint(root) {
    var M = MUX();
    if (M[root] && M[root].family === 'flexe') return 'Đơn vị tính theo kbit/s. Một instance FlexE có <b>20 khe lịch 5G</b> (một nhóm n instance: 20n khe phẳng); chọn “Ghép khe lịch” rồi thả client 10/25/40/50/100/… G — mỗi client chiếm số khe nguyên, tốc độ được <b>thích ứng Idle</b> (thêm/bớt Idle) cho vừa khe. Hết khe thì bị từ chối kèm số khe còn trống; gỡ client (×) trả lại khe.';
    if (poolUnder(root)) return 'Đơn vị tính theo kbit/s. OPU có <b>bể tributary slot (TS)</b>: chọn “Ghép TS” để trộn nhiều loại ODU, miễn còn đủ TS trống; ' +
      'thả tín hiệu khách hàng thẳng vào khung — các bước trung gian tự dựng. ODU và tín hiệu SDH mặc định <b>nguyên khối</b>; đổi phương án ở ô chọn để mở xem bên trong.';
    return (L().isByteUnit(M, root)
        ? 'Số byte là mỗi 125 µs (1 byte/125 µs = 64 kbit/s). Thả đơn vị bậc thấp thẳng vào hộp bậc cao — các bước trung gian tự dựng.'
        : 'Đơn vị PDH tính theo kbit/s: mỗi bậc ghép 4 nhánh bậc dưới + bit overhead/chèn. Thả bậc thấp vào bậc cao — các bậc giữa tự dựng.') +
      ' Luồng PDH (E1, E3…) mặc định là <b>nguyên khối</b>; đổi phương án ở ô chọn của nó để mở xem bên trong.';
  }

  var UNIT_KIND = { flexe: 'FlexE (instance / nhóm)', phy: 'PHY Ethernet' };
  function countNodes(t) { var c = 0; (function w(x) { if (!x) return; c++; x.kids.forEach(w); })(t); return c; }

  /** Đếm client trong cây con: { e1: 3, … }. */
  function clientsIn(node) {
    var out = {}, M = MUX();
    (function w(x, isRoot) { if (!x) return; if (!isRoot && L().isClient(M, x.u, x)) { out[x.u] = (out[x.u] || 0) + 1; return; } x.kids.forEach(function (k) { w(k, false); }); })(node, true);
    return out;
  }
  function clientsTxt(c) { return Object.keys(c).map(function (k) { return c[k] + ' ' + nm(k); }).join(' + '); }

  function ohTxt(node) {
    var u = MUX()[node.u];
    if (!u || !u.accepts || !L().chosen(node)) return '';
    if (L().isTs(node)) {
      var pi = L().poolInfo(MUX(), node.u);
      return pi && pi.outsideKbps ? '+' + TV().fmtRate(pi.outsideKbps) + (pi.word === 'TS' ? ' ngoài TS' : ' ' + pi.outsideName) : '';
    }
    return L().ohLabel(u.accepts[node.opt]);
  }
  /** Nhãn lựa chọn: "1×STM-64" / "Ghép TS (32 × 1,25G, trộn ODU)". */
  function choiceLabel(uid, c) {
    if (c !== 'ts') { var a = MUX()[uid].accepts[c]; return a.count + '×' + nm(a.of); }
    var pi = L().poolInfo(MUX(), uid);
    return pi.word === 'TS' ? 'Ghép TS (' + pi.n + ' × ' + (pi.size || TV().fmtRate(pi.kbps)) + ', trộn ODU)'
      : 'Ghép khe lịch (' + pi.n + ' × ' + (pi.size || TV().fmtRate(pi.kbps)) + ', trộn client)';
  }
  function choiceTip(uid, c) {
    if (c !== 'ts') { var a = MUX()[uid].accepts[c]; return (ohPhrase(a) || 'không thêm overhead') + (a.mapping ? ' · ' + a.mapping : '') + (a.fit === 'le' ? ' · có chèn/khoảng trống ánh xạ' : '') + (a.note ? ' — ' + a.note : ''); }
    var pi = L().poolInfo(MUX(), uid);
    var w = pi.word;
    return 'Bể ' + pi.n + (w === 'TS' ? ' tributary slot, mỗi TS ' : ' khe lịch, mỗi khe ') + TV().fmtRate(pi.kbps) + (pi.note ? ' (' + pi.note + ')' : '') + ': ' +
      L().slotOpts(MUX(), uid).map(function (s) { return nm(s.a.of) + ' ' + s.a.slots + ' ' + w + (s.a.mapping ? ' ' + s.a.mapping : ''); }).join(', ') +
      ' — trộn các loại, miễn tổng ' + w + ' ≤ ' + pi.n + '.';
  }
  /** "1–2" / "13–19, 29, 30" (1-based). */
  function tsList(ts) {
    var a = (ts || []).map(function (x) { return x + 1; }).sort(function (x, y) { return x - y; }), out = [], i = 0;
    while (i < a.length) {
      var j = i; while (j + 1 < a.length && a[j + 1] === a[j] + 1) j++;
      out.push(j - i >= 2 ? a[i] + '–' + a[j] : j > i ? a[i] + ', ' + a[j] : String(a[i]));
      i = j + 1;
    }
    return out.join(', ');
  }
  /** Màu con thứ i trong bể TS (góc vàng để các màu kề nhau tách bạch). */
  function tsHue(i) { return Math.round((i * 137.508 + 25) % 360); }
  /** Ghi chú transcode: "mang 40,117 Gbit/s" khi phương án cha có carriedKbps. */
  function carriedNote(pa, uid) {
    if (!pa || pa.carriedKbps == null) return '';
    var line = L().unitKbps(MUX(), uid);
    return '<span class="ch-tc" title="' + esc('Tốc độ đường dây ' + TV().fmtRate(line) + ' → tốc độ thực mang sau transcode ' + TV().fmtRate(pa.carriedKbps) + (pa.note ? ' (' + pa.note + ')' : '') + '. Dung lượng tính bằng tốc độ thực mang.') + '">' +
      esc(TV().fmtRate(line)) + ' → mang ' + esc(TV().fmtRate(pa.carriedKbps)) + '</span>';
  }
  /** "+9 B VC-4 POH" / "+256 kbit/s FAS…" ('' nếu không có). */
  function ohPhrase(a) {
    var lb2 = L().ohLabel(a);
    return lb2 ? lb2 + ' ' + ((a.overhead && a.overhead.name) || 'overhead') : '';
  }
  function ohTitle(node, isRoot) {
    var M = MUX(), u = M[node.u];
    if (!u) return '';
    if (!u.accepts || !L().chosen(node)) return (u.summary || '') + (u.leafOk && !isRoot ? '\nĐang dùng nguyên khối (client) — chọn phương án để mở xem bên trong.' : '');
    if (L().isTs(node)) return nm(node.u) + ' = ' + choiceTip(node.u, 'ts');
    var a = u.accepts[node.opt];
    var oh = a.overhead || {};
    var ph = ohPhrase(a);
    return nm(node.u) + ' = ' + a.count + '×' + nm(a.of) + (ph ? ' + ' + ph : '') +
      (a.mapping ? ' · ánh xạ ' + a.mapping : '') + (oh.desc && oh.desc !== oh.name ? '\n' + oh.desc : '') + (a.note ? '\n' + a.note : '');
  }

  /**
   * Một "hộp": gộp chuỗi bắt buộc 1×… thành một dòng (STM-1 › AUG-1 › AU-4 › VC-4), rồi vẽ các ô con.
   * node có thể null (ô trống của đơn vị su).
   */
  function renderBox(node, su, path, depth, idxLabel, big, ex) {
    var M = MUX();
    ex = ex || {};
    var isNew = lb.lastPath && pkey(lb.lastPath).indexOf(pkey(path)) === 0 && lb.lastPath.length >= path.length;
    if (!node) {
      var canOpen = M[su] && M[su].accepts && M[su].accepts.length;
      return '<div class="lab-slot" data-drop="' + pkey(path) + '" role="button" tabindex="0" title="Ô trống ' + esc(nm(su)) + ' — thả đơn vị vào đây">' +
        '<span class="slot-name">' + esc(nm(su)) + (idxLabel ? ' <small>#' + idxLabel + '</small>' : '') + '</span><span class="slot-hint">trống</span>' +
        (canOpen && !M[su].leafOk && (M[su].accepts.length > 1) ? '<button type="button" class="slot-open" data-linst="' + pkey(path) + '" title="Tạo ' + esc(nm(su)) + ' để chọn phương án">chọn phương án</button>' : '') +
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
    var leafClient = last.path.length > 0 && L().isClient(M, last.node.u, last.node);
    var pk = pkey(path), ck = ckey(path);
    var collapsedDefault = big && depth >= 2;
    var collapsed = lb.st.collapsed[ck] != null ? lb.st.collapsed[ck] : collapsedDefault;
    var mem = last.node.vcg, memRec = mem && (tree().vcgs || []).filter(function (r) { return r.g === mem.g; })[0];
    var compact = leafClient && depth > 0;

    var head = chain.map(function (c, i) {
      var u = M[c.node.u];
      var multi = u && u.accepts && L().choices(M, c.node.u).length > 1;
      var isRootN = !c.path.length;
      var cli = !isRootN && L().isClient(M, c.node.u, c.node);
      var canMono = u && u.leafOk && u.accepts && !isRootN; // PDH/ODU: chọn nguyên khối / phương án
      var oh = ohTxt(c.node);
      // phương án của cha chứa mắt xích này (để hiện tốc độ thực mang sau transcode)
      var pa = i ? L().optObj(M, chain[i - 1].node.u, chain[i - 1].node.opt) : ex.pa;
      return (i ? '<span class="ch-sep" aria-hidden="true">›</span>' : '') +
        '<span class="ch-item k-' + (cli ? 'client' : u.kind) + '">' +
          '<button type="button" class="ch-name" data-lsel="' + esc(c.node.u) + '" title="' + esc(ohTitle(c.node, isRootN)) + '">' + esc(nm(c.node.u)) + '</button>' +
          (oh ? '<span class="ch-oh" title="' + esc(ohTitle(c.node, isRootN)) + '">' + esc(oh) + '</span>' : '') +
          (cli ? carriedNote(pa, c.node.u) : '') +
          (canMono || (multi && L().chosen(c.node)) ? optSelect(c.node, c.path, canMono) : '') +
        '</span>';
    }).join('');

    var cls = 'lab-box' + (mem ? ' is-vcg' : '') + (compact ? ' is-compact' : '') + (depth === 0 ? ' is-root' : '') + (ex.ts ? ' is-tskid' : '') + (isNew && lb.lastPath && pkey(lb.lastPath) === pkey(last.path) ? ' is-new' : '');
    var tsStyle = ex.ts ? ' style="--tsh:' + ex.hue + '"' : '';
    if (mem) tsStyle = ' style="--tsh:' + vcgHue(mem.g) + '"';
    var idxHtml = idxLabel ? '<span class="box-idx' + (ex.ts ? ' ts-tag' : '') + '"' + tsStyle + (ex.ts ? ' title="Chiếm ' + ex.ts.length + ' ' + (ex.word || 'TS') + ': #' + esc(tsList(ex.ts)) + '"' : '') + '>#' + idxLabel +
      (ex.ts ? ' · ' + (ex.word || 'TS') + ' ' + esc(tsList(ex.ts)) : '') + '</span>' : '';
    var tools = (path.length ? '<button type="button" class="box-x" data-lremove="' + pk + '" title="Gỡ ' + esc(nm(node.u)) +
      (mem ? ' — LCAS: VCG#' + mem.g + ' bớt một thành viên' : ex.ts ? ' — trả lại ' + ex.ts.length + ' TS' : ' khỏi ô này') + '" aria-label="Gỡ">×</button>' : '');
    if (compact) {
      return '<div class="' + cls + '" data-drop="' + pk + '"' + tsStyle + '>' + idxHtml +
        '<span class="box-chain">' + head + '</span>' + tools + '</div>';
    }

    var body = '';
    var summary = '';
    if (mem) {
      summary = '<span class="vcg-tag"' + tsStyle + ' title="' + esc('Thành viên SQ ' + mem.sq + ' của VCG#' + mem.g + (memRec ? ' (' + nm(memRec.u) + ')' : '') + ' — tải ' +
        (memRec ? nm(MUX()[memRec.u].members.payloadOf) : '') + ' thuộc VCG, đi độc lập qua mạng; đầu thu sắp lại theo SQ, bù trễ nhờ MFI') + '">VCG#' + mem.g + ' · SQ ' + mem.sq + '</span>' +
        (memRec ? '<span class="box-sum">' + esc(nm(memRec.u)) + (memRec.client ? ' · ' + esc(nm(memRec.client)) : ' · chưa có client') + '</span>' : '');
    } else if (!L().chosen(last.node) && lu && lu.accepts && !leafClient) {
      body = '<div class="opt-pick"><span class="muted">Chọn cách lấp ' + esc(nm(last.node.u)) + ':</span> ' + L().choices(M, last.node.u).map(function (c) {
        return '<button type="button" class="var-chip" data-lopt="' + pkey(last.path) + '" data-lval="' + c + '" title="' + esc(choiceTip(last.node.u, c)) + '">' +
          esc(choiceLabel(last.node.u, c)) + '</button>';
      }).join(' ') + '<span class="muted"> · hoặc thả thẳng đơn vị vào hộp này</span></div>';
    } else if (lu && L().isTs(last.node)) {
      var pi = L().poolInfo(M, last.node.u), pn = last.node, free = L().tsFree(M, pn);
      var kc = {};
      pn.kids.forEach(function (k) { kc[k.u] = (kc[k.u] || 0) + 1; });
      summary = '<span class="box-sum">' + pi.word + ' ' + (pi.n - free) + '/' + pi.n + (pn.kids.length ? ' · ' + esc(clientsTxt(kc)) : '') + '</span>';
      if (!collapsed) {
        body = tsBar(pn, pi, last.path) +
          '<div class="box-kids ts-kids">' + pn.kids.map(function (k, i) {
            return renderBox(k, k.u, last.path.concat(i), depth + 1, String(i + 1), big, { ts: k.ts || [], word: pi.word, hue: tsHue(i), pa: L().slotOptFor(M, pn.u, k.u) });
          }).join('') +
          (free && !L().portsFull(M, pn) ? '<div class="lab-slot ts-free" data-drop="' + pkey(last.path) + '" role="button" tabindex="0" title="Thả ODU/tín hiệu vào bể ' + pi.word + ' của ' + esc(nm(pn.u)) + '">' +
            '<span class="slot-name">' + free + ' ' + pi.word + ' trống</span><span class="slot-hint">thả ' + esc(L().slotOpts(M, pn.u).map(function (s) { return nm(s.a.of) + ' (' + s.a.slots + ')'; }).join(', ')) + ' hoặc tín hiệu khách hàng</span>' +
            (lb.armed && L().reaches(M, pn.u, lb.armed) ? '<button type="button" class="slot-open" data-lfillat="' + pkey(last.path) + '" title="Lấp các ' + pi.word + ' trống bằng ' + esc(nm(lb.armed)) + '">lấp đầy bằng ' + esc(nm(lb.armed)) + '</button>' : '') +
            '</div>' : free ? '<div class="muted ts-full">' + esc(nm(pn.u)) + ' tối đa ' + L().maxPorts(M, pn.u) + ' cổng nhánh, đã dùng ' + pn.kids.length + '; còn ' + free + ' ' + pi.word + ' trống — gỡ bớt con (×) để nhường cổng.</div>' : '<div class="muted ts-full">' + esc(nm(pn.u)) + ' đã dùng hết ' + pi.n + ' ' + pi.word + ' — gỡ bớt con (×) để trả lại ' + pi.word + '.</div>') +
          '</div>';
      }
    } else if (lu && lu.accepts && last.node.opt >= 0) {
      var a = lu.accepts[last.node.opt];
      var filled = last.node.kids.filter(Boolean).length;
      var cl = clientsIn(last.node);
      summary = '<span class="box-sum">' + filled + '/' + a.count + ' ' + esc(nm(a.of)) + (clientsTxt(cl) ? ' · ' + esc(clientsTxt(cl)) : '') + '</span>';
      if (!collapsed) {
        body = '<div class="box-kids' + (a.count > 4 ? ' is-many' : '') + '">' + last.node.kids.map(function (k, i) {
          return renderBox(k, a.of, last.path.concat(i), depth + 1, a.count > 1 ? String(i + 1) : null, big, { pa: a });
        }).join('') + '</div>';
      }
    }
    var canCollapse = lu && lu.accepts && L().chosen(last.node);
    if (leafClient && !compact) summary = '<span class="box-sum">nguyên khối · ' + esc(TV().fmtRate(L().unitKbps(M, last.node.u))) + '</span>';
    return '<div class="' + cls + '" data-drop="' + pk + '">' +
      '<div class="box-head">' +
        (canCollapse ? '<button type="button" class="caret" data-lcollapse="' + esc(ck) + '" data-lstate="' + (collapsed ? 1 : 0) + '" aria-expanded="' + !collapsed + '" title="Thu gọn/bung">' + (collapsed ? '▸' : '▾') + '</button>' : '') +
        (idxLabel ? '<span class="box-idx">#' + idxLabel + '</span>' : '') +
        '<span class="box-chain">' + head + '</span>' + summary + tools +
      '</div>' + body + '</div>';
  }

  function optSelect(node, path, canMono) {
    return '<select class="ch-opt" data-loptsel="' + pkey(path) + '" title="Phương án lấp ' + esc(nm(node.u)) + ' (đổi sẽ xoá nội dung bên trong)">' +
      (canMono ? '<option value="-1"' + (!L().chosen(node) ? ' selected' : '') + '>Nguyên khối</option>' : '') +
      L().choices(MUX(), node.u).map(function (c) {
        return '<option value="' + c + '"' + (c === node.opt ? ' selected' : '') + ' title="' + esc(choiceTip(node.u, c)) + '">' + esc(choiceLabel(node.u, c)) + '</option>';
      }).join('') +
      '</select>';
  }

  /** Thanh n ô TS, tô theo con chiếm (xuống dòng được — OPU4 80 ô vẫn vừa màn hình hẹp). */
  function tsBar(pn, pi, path) {
    var owner = {};
    pn.kids.forEach(function (k, i) { (k.ts || []).forEach(function (s) { owner[s] = i; }); });
    var cells = '';
    for (var s = 0; s < pi.n; s++) {
      var i = owner[s];
      cells += i == null
        ? '<span class="ts-cell is-free" title="' + pi.word + ' #' + (s + 1) + ': trống">' + (s + 1) + '</span>'
        : '<span class="ts-cell" style="--tsh:' + tsHue(i) + '" title="' + pi.word + ' #' + (s + 1) + ': ' + esc(nm(pn.kids[i].u)) + ' #' + (i + 1) + '">' + (s + 1) + '</span>';
    }
    var free = L().tsFree(MUX(), pn);
    return '<div class="ts-wrap"><div class="ts-legend muted">Bể ' + pi.n + (pi.word === 'TS' ? ' tributary slot × ' : ' khe lịch × ') + esc(TV().fmtRate(pi.kbps)) + (pi.note ? ' · ' + esc(pi.note) : '') +
      ' · đã dùng ' + (pi.n - free) + ', trống ' + free + (L().maxPorts(MUX(), pn.u) < Infinity ? ' · cổng nhánh ' + pn.kids.length + '/' + L().maxPorts(MUX(), pn.u) : '') + ' · cấp ' + pi.word + ' trống thấp nhất, không cần liền kề</div>' +
      '<div class="ts-bar" data-drop="' + pkey(path) + '" role="img" aria-label="' + esc((pi.word === 'TS' ? 'Tributary slot: ' : 'Khe lịch: ') + (pi.n - free) + '/' + pi.n + ' đã dùng') + '">' + cells + '</div></div>';
  }

  // ---------- VCG (ghép chuỗi ảo) ----------
  /** Bảng VCG: thành viên/SQ ở đâu, dung lượng (LCAS k/n), client, hiệu suất. Rỗng nếu chưa có VCG. */
  function renderVcgs(t) {
    var M = MUX(), info = L().vcgInfo(M, t);
    if (!info.length) return '';
    var rows = info.map(function (v) {
      var hue = vcgHue(v.g), V = M[v.u];
      var status = !v.client ? '<span class="muted">chưa có client — thả ' + esc((V.accepts || []).map(function (a) { return nm(a.of); }).join('/') || 'Ethernet') + ' vào một thành viên</span>'
        : v.enough ? '<span class="vcg-ok">đủ</span> <span class="muted">cần ' + esc(TV().fmtRate(v.needKbps)) + '</span>'
        : '<span class="vcg-bad">không đủ</span> <span class="muted">cần ' + esc(TV().fmtRate(v.needKbps)) + ', chỉ mang được ' + esc(n(v.gotKbps / v.needKbps * 100, 1)) + '%</span>';
      return '<tr><td><span class="vcg-tag" style="--tsh:' + hue + '">VCG#' + v.g + '</span> <button type="button" class="link-btn" data-lsel="' + esc(v.u) + '">' + esc(nm(v.u)) + '</button></td>' +
        '<td><b' + (v.k < v.n ? ' class="vcg-bad"' : '') + '>' + v.k + '/' + v.n + '</b> ' + esc(nm(v.of)) +
          '<div class="vcg-mem muted">' + v.members.map(function (m) { return 'SQ ' + m.sq + ': ' + esc(m.loc); }).join('<br>') + '</div></td>' +
        '<td class="num">' + esc(TV().fmtRate(v.capKbps)) + (v.k < v.n ? '<br><span class="muted">/ ' + esc(TV().fmtRate(v.fullKbps)) + '</span>' : '') +
          '<br><span class="muted">' + v.k + ' × ' + esc(nm(V.members.payloadOf)) + '</span></td>' +
        '<td>' + (v.client ? '<button type="button" class="link-btn" data-lsel="' + esc(v.client) + '">' + esc(nm(v.client)) + '</button><br>' : '') + status + '</td>' +
        '<td class="num">' + (v.client ? esc(n(v.effPct, 1)) + '%' : '–') + '</td>' +
        '<td class="vcg-act">' + (v.k < v.n ? '<button type="button" class="btn-ghost btn-sm" data-lvcgadd="' + v.g + '" title="LCAS: thêm lại một thành viên (vào VC trống bất kỳ)">+ thành viên</button> ' : '') +
          '<button type="button" class="btn-ghost btn-sm" data-lvcgdel="' + v.g + '" title="Gỡ cả VCG — mọi thành viên trả lại ô trống">Gỡ VCG</button></td></tr>';
    }).join('');
    return '<section class="card" aria-label="Nhóm ghép chuỗi ảo"><div class="section-title"><h2>Ghép chuỗi ảo (VCG)</h2>' +
      '<span class="muted">thành viên đi độc lập, đầu thu sắp lại theo SQ · gỡ một thành viên = LCAS giảm băng thông</span></div>' +
      '<div class="tbl-wrap"><table class="values lab-table vcg-table"><thead><tr><th>VCG</th><th>Thành viên (SQ · vị trí)</th><th class="num">Dung lượng</th><th>Client</th><th class="num">Hiệu suất</th><th></th></tr></thead><tbody>' +
      rows + '</tbody></table></div></section>';
  }
  /** Câu tóm tắt một VCG: "VC-4-7v 7/7 VC-4 = 1,048 Gbit/s — GbE qua GFP-F cần 992,2 Mbit/s: đủ (hiệu suất 94,6%)". */
  function vcgLine(v) {
    var s = nm(v.u) + ' ' + v.k + '/' + v.n + ' ' + nm(v.of) + ' = ' + TV().fmtRate(v.capKbps);
    if (!v.client) return s + ' (chưa có client)';
    return s + ' — ' + nm(v.client) + ' qua GFP-F cần ' + TV().fmtRate(v.needKbps) + ': ' +
      (v.enough ? 'đủ (hiệu suất ' + n(v.effPct, 1) + '%)' : 'KHÔNG đủ, chỉ mang được ' + n(v.gotKbps / v.needKbps * 100, 1) + '% — LCAS giữ dịch vụ ở băng thông giảm');
  }
  function vcgOf(g) { return L().vcgInfo(MUX(), tree()).filter(function (v) { return v.g === g; })[0]; }
  /** Thả VCG hoặc Ethernet (chỉ đi qua VCG): thả vào thành viên = gán client; nơi khác = rải VCG vào khung. */
  function doPlaceVcg(path, X) {
    var M = MUX(), t = tree(), res;
    var target = L().getNode(t, path);
    if (!L().isVcg(M, X) && target && target.vcg) res = L().setVcgClient(M, t, target.vcg.g, X);
    else if (L().isVcg(M, X)) res = L().placeVcg(M, t, X, null, lb.lab.roots);
    else res = L().placeClientVcg(M, t, X, lb.lab.roots);
    if (!res.ok) { lb.msg = { ok: false, html: '<b>Không thả được ' + esc(nm(X)) + ':</b> ' + esc(res.reason) }; lb.lastPath = null; save(); render(); return; }
    var v = vcgOf(res.g);
    var where = v.members.map(function (m) { return 'SQ ' + m.sq + ' → ' + m.loc; });
    lb.msg = { ok: true, html: (res.paths && !res.reused ? 'Đã tạo <b>VCG#' + v.g + ' ' + esc(nm(v.u)) + '</b>: ' + v.n + ' ' + esc(nm(v.of)) + ' rải vào ô trống bất kỳ (' + esc(where.slice(0, 8).join('; ')) + (where.length > 8 ? '; …' : '') + '). '
        : 'Gán <b>' + esc(nm(X)) + '</b> cho VCG#' + v.g + '. ') + esc(vcgLine(v)) + '.' };
    lb.lastPath = v.members.length ? v.members[0].path : null;
    save(); render();
  }

  // ---------- tổng kết ----------
  function renderTotals(t) {
    var M = MUX(), acc = L().account(M, t);
    var total = acc.totalKbps, byteMode = acc.byteBased;
    var segs = [
      { k: 'client', label: 'Tải khách hàng', v: acc.clientKbps },
      { k: 'stuff', label: 'Chèn/bù tốc độ, khoảng trống ánh xạ', v: acc.justificationKbps },
      { k: 'oh', label: 'Overhead các cấp', v: acc.overheadKbps },
      { k: 'empty', label: 'Chưa dùng', v: acc.emptyKbps }
    ];
    function sizeTxt(k) { return TV().fmtRate(k) + (byteMode ? ' = ' + n(k / 64) + ' byte/125 µs' : ''); }
    var bar = '<div class="sbar" role="img" aria-label="' + esc(segs.map(function (s) { return s.label + ' ' + n(s.v / total * 100) + '%'; }).join(', ')) + '">' +
      segs.filter(function (s) { return s.v > 1e-9; }).map(function (s) {
        return '<span class="sbar-seg sb-' + s.k + '" style="flex-grow:' + s.v + '" title="' + esc(s.label + ': ' + sizeTxt(s.v) + ' (' + n(s.v / total * 100) + '%)') + '"></span>';
      }).join('') + '</div>' +
      '<div class="legend">' + segs.map(function (s) {
        return '<span class="lg-item"><span class="lg-sw sb-' + s.k + '"></span>' + esc(s.label) + ' <b>' + esc(n(s.v / total * 100, 1)) + '%</b></span>';
      }).join('') + '</div>';
    // mỗi cấp một thanh = overhead cấp đó (so với khung)
    var maxOh = Math.max.apply(null, acc.overhead.map(function (o) { return o.kbps; }).concat([1]));
    var byteCols = function (k) { return byteMode ? '<td class="num">' + esc(n(k / 64)) + '</td>' : ''; };
    var rows = acc.overhead.map(function (o) {
      var each = o.kbpsEach ? (o.unitBytes ? n(o.bytesEach, 0) + ' B' : TV().fmtRate(o.kbpsEach)) : '';
      return '<tr><td><button type="button" class="link-btn" data-lsel="' + esc(o.u) + '">' + esc(nm(o.u)) + '</button></td><td class="num">' + o.count + '</td>' +
        '<td>' + (each ? esc(each) + (o.ohName ? ' <span class="muted">' + esc(o.ohName) + '</span>' : '') : '<span class="muted">0</span>') + '</td>' +
        byteCols(o.kbps) + '<td class="num">' + esc(n(o.kbps, 0)) + '</td>' +
        '<td class="barcell"><span class="hbar-track"><span class="hbar" style="width:' + (o.kbps / maxOh * 100) + '%"></span></span><span class="num">' + esc(n(o.kbps / total * 100)) + '%</span></td></tr>';
    }).join('');
    var tcTxt = Object.keys(acc.transcoded).map(function (k) {
      var x = acc.transcoded[k];
      return x.count + ' ' + nm(k) + ': đường dây ' + TV().fmtRate(x.lineKbps) + ' → mang ' + TV().fmtRate(x.carriedKbps) +
        (x.idle ? ' (thích ứng Idle, ' + n((x.carriedKbps / x.lineKbps - 1) * 100, 3) + ' %)' : '');
    }).join('; ');
    var idleOnly = Object.keys(acc.transcoded).length > 0 && Object.keys(acc.transcoded).every(function (k) { return acc.transcoded[k].idle; });
    var freeTsTxt = acc.freeTs.map(function (f) { return nm(f.u) + ' ' + f.free + '/' + f.n + ' ' + L().slotWord(M, f.u); }).join(', ');
    var extra = [
      ['Chèn bù tốc độ / khoảng trống ánh xạ (justification)', acc.justificationKbps, 'Dung lượng bước ghép lớn hơn overhead + tổng nhánh (vd C-12 2176 kbit/s mang E1 2048 kbit/s; STM-64 AMP trong OPU2; phần TS dư so với ODU).'],
      ['Chưa dùng (ô trống' + (acc.freeTs.length ? ', ' + (acc.freeTs.every(function (f) { return L().slotWord(M, f.u) !== 'TS'; }) ? 'khe lịch' : 'TS') + ' trống' : '') + ')', acc.emptyKbps, 'Dung lượng chưa lấp.' + (freeTsTxt ? ' Chỗ trống: ' + freeTsTxt + ' = ' + TV().fmtRate(acc.emptyTsKbps) + '.' : '')],
      ['Tải khách hàng', acc.clientKbps, (clientsTxt(acc.clients) || 'chưa có') + (tcTxt ? ' · tính theo tốc độ thực mang sau ' + (idleOnly ? 'thích ứng Idle' : 'chuyển mã/GFP-F') + ' (' + tcTxt + ')' : '')]
    ].map(function (r) {
      return '<tr class="tr-sum"><td colspan="3">' + esc(r[0]) + ' <span class="muted">' + esc(r[2]) + '</span></td>' + byteCols(r[1]) +
        '<td class="num">' + esc(n(r[1])) + '</td><td class="num">' + esc(n(r[1] / total * 100)) + '%</td></tr>';
    }).join('');
    return '<div class="section-title"><h2>Tổng kết ' + esc(nm(t.u)) + '</h2><span class="muted">' +
        (byteMode ? 'kbit/s và byte mỗi 125 µs · 1 byte/125 µs = 64 kbit/s' : 'kbit/s · client + overhead + chèn + trống = tốc độ khung') + '</span></div>' +
      '<div class="stats">' +
        '<div class="stat"><div class="stat-label">Tốc độ khung đích</div><div class="stat-value">' + esc(TV().fmtRate(total)) + '</div><div class="stat-sub">' + esc(byteMode ? n(total / 64, 0) + ' byte/125 µs' : n(total, 0) + ' kbit/s') + '</div></div>' +
        '<div class="stat"><div class="stat-label">Tải khách hàng thực mang</div><div class="stat-value">' + esc(TV().fmtRate(acc.clientKbps)) + '</div><div class="stat-sub">' + esc(clientsTxt(acc.clients) || 'chưa thả gì') +
          (Math.abs(acc.clientLineKbps - acc.clientKbps) > 1e-6 ? ' · đường dây ' + esc(TV().fmtRate(acc.clientLineKbps)) + ' (transcode/GFP-F)' : '') + '</div></div>' +
        '<div class="stat"><div class="stat-label">Hiệu suất</div><div class="stat-value">' + esc(n(acc.efficiency)) + '%</div><div class="stat-sub">tải khách hàng / tốc độ khung</div></div>' +
        '<div class="stat"><div class="stat-label">Tổng overhead</div><div class="stat-value">' + esc(TV().fmtRate(acc.overheadKbps)) + '</div><div class="stat-sub">' + esc(byteMode ? n(acc.overheadKbps / 64, 0) + ' byte/125 µs' : 'cộng mọi cấp') + '</div></div>' +
      '</div>' + bar +
      '<h3 class="lab-h3">Overhead theo cấp</h3>' +
      '<div class="tbl-wrap"><table class="values lab-table"><thead><tr><th>Cấp</th><th class="num">Số lượng</th><th>Overhead mỗi cái</th>' +
        (byteMode ? '<th class="num">Byte/125 µs</th>' : '') + '<th class="num">kbit/s</th><th>% khung</th></tr></thead><tbody>' +
        rows + extra +
        '<tr class="tr-total"><td colspan="3"><b>Tổng</b></td>' + (byteMode ? '<td class="num"><b>' + esc(n(total / 64, 0)) + '</b></td>' : '') +
        '<td class="num"><b>' + esc(n(total, 0)) + '</b></td><td class="num">100%</td></tr>' +
      '</tbody></table></div>';
  }

  function renderCounters(t) {
    var M = MUX(), root = lb.st.root, c = L().counts(t, M);
    var items = (lb.lab.palette || []).filter(function (id) { return M[id] && maxIn(root, id) > 0; });
    items.sort(function (a, b) { return (M[a].level || 0) - (M[b].level || 0); });
    // đơn vị của khung khách đang mở (vd VC-4 trong STM-N nằm trong OTU): đếm trong các khung đang mở
    var guestIds = [];
    guestGroups().forEach(function (g) { if (g.hostsOpen) g.ids.forEach(function (id) { if (L().capacityNow(M, t, root, id) > 0) guestIds.push(id); }); });
    var isGuest = {}; guestIds.forEach(function (id) { isGuest[id] = true; });
    items = items.concat(guestIds);
    var vi = L().vcgInfo(M, t);
    return '<div class="section-title"><h2>Bộ đếm theo loại</h2><span class="muted">đã dùng / còn chứa được theo phương án đang chọn / tối đa của ' + esc(nm(root)) + '</span></div>' +
      '<div class="counters">' + items.map(function (id) {
        var used, cap, max = maxIn(root, id);
        if (isGuest[id]) { used = c[id] || 0; cap = max = L().capacityNow(M, t, root, id); }
        else if (isVcgItem(id)) {
          // VCG: số VCG loại này; Ethernet: số client đang được VCG mang
          used = vi.filter(function (v) { return L().isVcg(M, id) ? v.u === id : v.client === id; }).length;
          cap = Math.max(used, L().vcgCapNow(M, t, id));
        } else { used = c[id] || 0; cap = L().capacityNow(M, t, root, id); }
        var pct = cap ? used / cap * 100 : 0;
        return '<div class="ctr"><div class="ctr-top"><b>' + esc(nm(id)) + '</b><span class="ctr-num">' + used + '/' + cap +
          (cap !== max ? ' <span class="muted" title="Tối đa nếu đổi phương án">(tối đa ' + max + ')</span>' : '') +
          (L().portsBinding && !isGuest[id] && !isVcgItem(id) && L().portsBinding(M, root, id) ? ' <span class="muted" title="Giới hạn cổng nhánh (maxPorts) của bể TS; muốn nhiều hơn: đặt trong ODU lớn rồi ghép vào OPUC (qua ODU lồng tối đa ' + L().maxCountNested(M, root, id) + ')">trực tiếp vào TS</span>' : '') + '</span></div>' +
          '<div class="ctr-bar"><span style="width:' + pct + '%"></span></div>' +
          '<button type="button" class="btn-ghost btn-sm" data-lfill="' + esc(id) + '"' + (used >= cap ? ' disabled' : '') + ' title="Lấp mọi chỗ còn trống bằng ' + esc(nm(id)) + '">Lấp đầy</button></div>';
      }).join('') + '</div>';
  }

  // ---------- đóng gói từng bước ----------
  // Ánh xạ (mapping của accepts) -> stack khung ở mảng IP; chỉ hiện nút khi stack có trong dữ liệu.
  var MAPPING_STACK = { 'GFP-F': 'gfp-f-eth' };
  function stackExists(id) { return (window.STACKS || []).some(function (s) { return s && s.id === id; }); }
  /** Phân số xấp xỉ p/q (q <= 2000) của tỉ lệ r; chuỗi rỗng nếu không khớp chặt. */
  function ratioFrac(r) {
    for (var q = 1; q <= 2000; q++) { var p = Math.round(r * q); if (p > 0 && Math.abs(p / q - r) < 1e-9) return p + '/' + q; }
    return '';
  }
  /** Các cách đi xuống từ gốc tới client: trực tiếp (accepts) hoặc qua VCG. [{ vcg: id|null }] */
  function stepRoutes(M, root, id) {
    if (L().pathDown(M, root, id)) return [{ vcg: null }];
    return L().vcgsFor(M, id).filter(function (c) { return L().vcgMax(M, root, c.v) > 0; }).map(function (c) { return { vcg: c.v }; });
  }
  function renderSteps() {
    var M = MUX(), root = lb.st.root;
    var clients = (lb.lab.palette || []).filter(function (id) { return M[id] && id !== root && L().isClient(M, id) && stepRoutes(M, root, id).length; });
    if (!clients.length) return '';
    var cl = clients.indexOf(lb.st.step.client) >= 0 ? lb.st.step.client : clients[0];
    var routes = stepRoutes(M, root, cl);
    var route = routes.filter(function (r) { return r.vcg === (lb.st.step.vcg || null); })[0] || routes[0];
    var steps = (route.vcg ? L().stepsUpVcg(M, root, cl, route.vcg) : L().stepsUp(M, root, cl)) || [];
    var k = Math.max(1, Math.min(lb.st.step.n || 1, steps.length));
    // dung lượng tính bằng tốc độ thực mang (carriedKbps sau transcode) nếu bước đầu có
    var clientK = steps[1] && steps[1].carriedKbps != null ? steps[1].carriedKbps : L().unitKbps(M, cl);
    var mem = route.vcg && M[route.vcg].members;
    var list = steps.slice(0, k).map(function (s, i) {
      var u = s.unit, oh = s.overhead || {};
      var max = L().maxCount(M, s.u, cl), eff = s.kbps ? max * clientK / s.kbps * 100 : 0, effTxt;
      if (route.vcg && i) {
        // qua VCG: một VCG dùng n/mc đơn vị s.u (mc = số thành viên chứa được trong s.u)
        var mc = s.vcgStep === 'vcg' ? 0 : L().maxCount(M, s.u, mem.of);
        if (s.vcgStep === 'vcg') {
          eff = clientK / s.kbps * 100;
          effTxt = 'Tải khách hàng chiếm <b>' + esc(n(eff, 1)) + '%</b> dung lượng ' + esc(nm(s.u));
        } else {
          eff = clientK / (mem.count / mc * s.kbps) * 100;
          effTxt = 'Một ' + esc(nm(route.vcg)) + ' dùng ' + (s.vcgStep === 'members' ? mem.count + ' thành viên' : '≈ ' + esc(n(mem.count / mc, 2)) + ' ' + esc(nm(s.u))) +
            ' → tải khách hàng chiếm <b>' + esc(n(eff, 1)) + '%</b>';
        }
      } else effTxt = 'Đầy ' + max + ' ' + esc(nm(cl)) + ' → tải khách hàng chiếm <b>' + esc(n(eff, 1)) + '%</b>';
      var fr = u.frame && window.TFRAMES && window.TFRAMES[u.frame];
      var ohl = i ? L().ohLabel({ overhead: oh }) : '';
      var desc;
      if (!i) desc = '<div class="step-desc">Tín hiệu khách hàng — điểm bắt đầu.</div>';
      else {
        var from = s.vcgStep === 'members'
          ? 'VCG chia thành <b>' + s.count + '×' + esc(nm(s.u)) + '</b> <span class="muted">(SQ 0…' + (s.count - 1) + ', mỗi thành viên có POH và con trỏ riêng)</span>'
          : s.slots ? esc(nm(s.from)) + ' <span class="pill-ts">' + s.slots + ' ' + (s.pool.word || 'TS') + ' / ' + s.pool.n + ' (tối đa ' + s.count + ')</span>' : s.count + '×' + esc(nm(s.from));
        var ratio = s.carriedKbps != null && s.vcgStep === 'vcg' ? ratioFrac(s.carriedKbps / L().unitKbps(M, cl)) : '';
        var stk = s.mapping && MAPPING_STACK[s.mapping];
        desc = '<div class="step-desc">= ' + from +
          (s.carriedKbps != null ? ' <span class="pill-ts">' + (/GFP/.test(s.mapping || '') ? 'GFP-F (bỏ preamble/IFG): mang ' : s.pool && s.pool.word === 'khe lịch' ? 'thích ứng Idle: mang ' : 'transcode: mang ') + esc(TV().fmtRate(s.carriedKbps)) + (ratio ? ' (×' + ratio + ')' : '') + '</span>' : '') +
          (ohl ? ' <span class="pill-oh">' + esc(ohl) + (s.vcgStep === 'members' ? ' mỗi thành viên' : '') + ' ' + esc(oh.name || 'overhead') + '</span>' : ' <span class="muted">(không thêm overhead)</span>') +
          (s.vcgStep === 'members' && ohl ? ' <span class="pill-oh">tổng +' + esc(n(s.ohKbps * s.count / 64, 2)) + ' B/125 µs</span>' : '') +
          (s.justKbps > 0 ? ' <span class="pill-stuff">+' + esc(TV().fmtRate(s.justKbps)) + (L().isByteUnit(M, s.u) ? ' (' + n(s.justification) + ' B)' : '') + (s.fit === 'le' ? ' khoảng trống ánh xạ' : s.slots ? ' ngoài phần ' + ((s.pool && s.pool.word) || 'TS') + ' dùng / chèn' : ' chèn bù tốc độ') + '</span>' : '') +
          (s.mapping ? ' <span class="muted">· ánh xạ ' + esc(s.mapping) + '</span>' : '') +
          (stk && stackExists(stk) ? ' <a class="btn-ghost btn-sm" href="#' + esc(stk) + '">xem khung ' + esc(s.mapping) + '</a>' : '') + '</div>';
      }
      return '<li class="step' + (i === k - 1 ? ' is-cur' : '') + '">' +
        '<span class="step-n">' + (i + 1) + '</span>' +
        '<div class="step-body"><div class="step-head"><button type="button" class="link-btn" data-lsel="' + esc(s.u) + '"><b>' + esc(nm(s.u)) + '</b></button>' +
          '<span class="muted">' + (u.bytesPer125us != null ? esc(n(s.bytes, 0)) + ' B/125 µs · ' + esc(TV().fmtRate(s.kbps)) : esc(TV().fmtRate(s.kbps))) + (s.vcgStep === 'members' ? ' mỗi thành viên' : '') + '</span>' +
          (fr ? '<a class="btn-ghost btn-sm" href="#t/' + esc(fr.id) + '">▦ Xem lưới</a>' : '') + '</div>' +
          desc + (i ? '<div class="step-eff">' + effTxt + '<span class="effbar"><span style="width:' + Math.min(100, eff) + '%"></span></span></div>' : '') +
        '</div></li>';
    }).reverse().join('');
    return '<div class="section-title"><h2>Đóng gói từng bước</h2><span class="muted">từ tín hiệu khách hàng đi lên ' + esc(nm(root)) + '</span></div>' +
      '<div class="toolbar"><span class="toolbar-label">Khách hàng</span><div class="seg-group">' + clients.map(function (id) {
        var on = id === cl;
        return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-lstepc="' + esc(id) + '" aria-pressed="' + on + '">' + esc(nm(id)) + '</button>';
      }).join('') + '</div>' +
      (routes.length > 1 ? '<span class="toolbar-label">Nhóm ghép</span><div class="seg-group">' + routes.map(function (r) {
        var on = r === route;
        return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-lstepv="' + esc(r.vcg || '') + '" aria-pressed="' + on + '">' + esc(nm(r.vcg)) + '</button>';
      }).join('') + '</div>' : '') +
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
      '<li>FlexE: instance 100G có 20 khe lịch 5G (nhóm n instance: 20n khe); client chiếm số khe nguyên và được thích ứng Idle cho vừa khe; phần ngoài bể là khối overhead FlexE (1/20 461).</li>' +
      '<li>OTN: OPU có lựa chọn <b>“Ghép TS”</b> — bể tributary slot cho trộn ODU0/ODU1/ODU2/ODUflex…; mỗi con được cấp các TS trống thấp nhất (thanh ô màu). Thiếu TS thì bị từ chối kèm số TS còn trống; gỡ con (×) trả lại TS.</li>' +
      '<li>Ethernet qua SDH: thả <b>VCG</b> (VC-4-7v, VC-12-46v…) hoặc thả thẳng Ethernet — lab chọn VCG vừa với khung và rải thành viên vào VC trống bất kỳ (nhãn VCG#·SQ). Gỡ một thành viên (×) để thấy <b>LCAS</b>: dung lượng giảm, báo còn đủ/không đủ cho client.</li>' +
      '<li>Luồng PDH (E1, E2, E3, E4) mặc định là <b>nguyên khối</b> (client). Ô chọn của nó có “Nguyên khối (client)” và các phương án (vd 4×E2) — chọn để mở xem bên trong.</li>' +
      '<li>Bấm tên một đơn vị để xem chi tiết ở đây. Trạng thái tự lưu trong trình duyệt.</li></ol></div>';
  }

  function showUnit(id, quiet) {
    var M = MUX(), u = M[id];
    if (!u) return;
    lb.sel = id;
    var fr = u.frame && window.TFRAMES && window.TFRAMES[u.frame];
    var acc = (u.accepts || []).map(function (a) {
      var oh = a.overhead || {};
      return '<li><b>' + a.count + '×<a href="#" data-lunit="' + esc(a.of) + '">' + esc(nm(a.of)) + '</a></b>' +
        (a.slots ? ' <span class="pill-ts">' + a.slots + ' ' + L().slotWord(M, id) + ' mỗi cái</span>' + (L().effCount(M, id, a) < a.count ? ' <span class="muted">(tối đa ' + L().effCount(M, id, a) + ' do giới hạn cổng nhánh)</span>' : '') : '') +
        (a.fit === 'le' ? ' <span class="muted">(≤, có chèn/khoảng trống)</span>' : '') +
        (a.carriedKbps != null ? ' <span class="pill-ts">mang ' + esc(TV().fmtRate(a.carriedKbps)) + (/GFP/.test(a.mapping || '') ? ' sau GFP-F' : M[id].kind === 'flexe' ? ' sau thích ứng Idle' : ' sau transcode') + '</span>' : '') +
        (ohPhrase(a) ? ' ' + esc(ohPhrase(a)) : ' <span class="muted">(không thêm overhead)</span>') +
        (a.mapping ? ' <span class="chip">' + esc(a.mapping) + '</span>' : '') +
        (oh.desc && oh.desc !== oh.name ? '<br><span class="muted">' + esc(oh.desc) + '</span>' : '') +
        (a.note ? '<br><span class="muted">' + esc(a.note) + '</span>' : '') + '</li>';
    }).join('');
    var parents = Object.keys(M).filter(function (k) { return (M[k].accepts || []).some(function (a) { return a.of === id; }); });
    if (u.members) parents = [u.members.of].concat(parents); // VCG: rải vào các VC thành viên
    document.getElementById('detail').innerHTML = '<div class="detail-card"><span class="eyebrow">Đơn vị ghép · ' + esc(UNIT_KIND[u.kind] || u.kind) + '</span>' +
      '<h2>' + esc(u.name) + '</h2>' + (u.summary ? '<p class="lead">' + esc(u.summary) + '</p>' : '') +
      '<dl class="kv">' +
        '<dt>Kích thước</dt><dd>' + (u.bytesPer125us == null ? esc(TV().fmtRate(u.rateKbps)) + ' <span class="muted">(≈ ' + esc(n(u.rateKbps / 64)) + ' B/125 µs)</span>'
          : esc(n(u.bytesPer125us, 0)) + ' byte/125 µs = ' + esc(TV().fmtRate(u.bytesPer125us * 64))) + '</dd>' +
        (u.tribSlots ? '<dt>' + (u.kind === 'flexe' ? 'Khe lịch' : 'Tributary slot') + '</dt><dd>' + esc(u.tribSlots.n + ' × ' + TV().fmtRate(L().poolInfo(M, id).kbps) + (u.tribSlots.note ? ' · ' + u.tribSlots.note : '')) +
          ' <span class="muted">— các phương án có “' + L().slotWord(M, id) + ' mỗi cái” trộn được trong cùng ' + esc(nm(id)) + '</span></dd>' : '') +
        (u.members ? '<dt>Thành viên</dt><dd>' + u.members.count + ' × <a href="#" data-lunit="' + esc(u.members.of) + '">' + esc(nm(u.members.of)) + '</a>, tải mỗi cái ' +
          esc(nm(u.members.payloadOf)) + ' ' + esc(TV().fmtRate(L().unitKbps(M, u.members.payloadOf))) + ' <span class="muted">— ghép chuỗi ảo: thành viên đi độc lập, đặt vào VC trống bất kỳ</span></dd>' : '') +
        (u.leafOk ? '<dt>Dùng như</dt><dd>client nguyên khối (mặc định) hoặc mở theo một phương án bên dưới</dd>' : '') +
        (u.standard ? '<dt>Chuẩn</dt><dd>' + esc(u.standard) + '</dd>' : '') +
        (parents.length ? '<dt>Nằm trong</dt><dd>' + parents.map(function (p) { return '<a href="#" data-lunit="' + esc(p) + '">' + esc(nm(p)) + '</a>'; }).join(', ') + '</dd>' : '') +
      '</dl>' + (u.desc ? '<p>' + esc(u.desc) + '</p>' : '') +
      (acc ? '<h3>Cách lấp (phương án)</h3><ul class="plain unit-acc">' + acc + '</ul>' : '<p class="muted">Tín hiệu khách hàng — điểm bắt đầu của cây ghép.</p>') +
      (fr ? '<p><a class="btn-ghost btn-link" href="#t/' + esc(fr.id) + '">▦ Xem lưới ' + (fr.grid && fr.grid.cellBits === 1 ? 'bit ' : 'byte ') + esc(fr.name) + '</a></p>' : '') + '</div>';
    if (!quiet && window.matchMedia && window.matchMedia('(max-width: 1240px)').matches) {
      var d = document.getElementById('detail'); if (d.scrollIntoView) d.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ---------- hành động ----------
  function doPlace(path, X) {
    var M = MUX(), t = tree();
    if (isVcgItem(X) && !L().reaches(M, t.u, X)) return doPlaceVcg(path, X);
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
        if (L().isTs(nd)) {
          // bước vào bể TS: con chiếm k TS
          var kid = nd.kids[res.path[i]], pi = L().poolInfo(M, nd.u), sa = L().slotOptFor(M, nd.u, kid.u) || {};
          var spare = kid.ts.length * pi.kbps - L().childRate(M, sa, null);
          steps.push('<b>' + esc(nm(nd.u)) + '</b> <span class="pill-ts">' + kid.ts.length + ' ' + pi.word + ' (#' + esc(tsList(kid.ts)) + '), còn ' + L().tsFree(M, nd) + '/' + pi.n + ' trống</span>' +
            (spare > 1e-6 ? ' <span class="pill-stuff">+' + esc(TV().fmtRate(spare)) + ' chèn</span>' : ''));
          continue;
        }
        var a = M[nd.u].accepts[nd.opt], ph = ohPhrase(a);
        var just = L().unitKbps(M, nd.u) - L().ohKbps(a) - a.count * L().childRate(M, a, null);
        steps.push('<b>' + esc(nm(nd.u)) + '</b>' + (ph ? ' <span class="pill-oh">' + esc(ph) + '</span>' : '') +
          (a.carriedKbps != null ? ' <span class="pill-ts">transcode → ' + esc(TV().fmtRate(a.carriedKbps)) + '</span>' : '') +
          (just > 1e-9 ? ' <span class="pill-stuff">+' + esc(L().isByteUnit(M, nd.u) ? n(just / 64 / a.count) + ' B' : TV().fmtRate(just / a.count)) + (a.fit === 'le' ? ' khoảng trống ánh xạ' : ' chèn') + '</span>' : ''));
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
      lb.st.trees[lb.st.root] = L().newRoot(MUX(), lb.st.root); lb.st.collapsed = {};
      lb.msg = { ok: true, html: 'Đã xoá hết ' + esc(nm(lb.st.root)) + '.' }; lb.lastPath = null;
      save(); render(); return;
    }
    if ((b = t.closest('[data-lguest]'))) { var gid = b.getAttribute('data-lguest'); lb.guestFold = lb.guestFold || {}; lb.guestFold[gid] = !lb.guestFold[gid]; render(); return; }
    if ((b = t.closest('[data-lpal]'))) { var id = b.getAttribute('data-lpal'); lb.armed = lb.armed === id ? null : id; render(); return; }
    if ((b = t.closest('[data-lfill]'))) {
      var X = b.getAttribute('data-lfill');
      var cnt = 0;
      if (isVcgItem(X) && !L().reaches(MUX(), tree().u, X)) {
        // theo lô (tmodel.fillVcg): một bản sao cây, đếm chỗ trống một lần — STM-256 vẫn < 1 s
        cnt = L().fillVcg(MUX(), tree(), X, lb.lab.roots, VCG_FILL_MAX).count;
        lb.msg = cnt ? { ok: true, html: 'Đã thêm <b>' + cnt + ' ' + esc(nm(X)) + '</b>' + (L().isVcg(MUX(), X) ? '' : ' (mỗi cái một VCG)') + '.' } : { ok: false, html: 'Không còn chỗ cho ' + esc(nm(X)) + '.' };
        lb.lastPath = null; save(); render(); return;
      }
      cnt = L().fill(MUX(), tree(), [], X);
      lb.msg = cnt ? { ok: true, html: 'Đã lấp thêm <b>' + cnt + ' ' + esc(nm(X)) + '</b>.' } : { ok: false, html: 'Không còn chỗ cho ' + esc(nm(X)) + ' — ' + esc(L().explainReject(MUX(), lb.st.root, X, tree(), tree())) };
      lb.lastPath = null; save(); render(); return;
    }
    if ((b = t.closest('[data-lremove]'))) {
      e.stopPropagation();
      var p = parsePath(b.getAttribute('data-lremove'));
      var nd = L().getNode(tree(), p), pnd = L().getNode(tree(), p.slice(0, -1));
      var before = L().vcgInfo(MUX(), tree());
      L().remove(tree(), p);
      L().vcgSync(tree());
      // LCAS: VCG nào mất thành viên → báo dung lượng còn lại và còn đủ cho client không
      var after = L().vcgInfo(MUX(), tree()), lcas = [];
      before.forEach(function (bv) {
        var a2 = after.filter(function (x) { return x.g === bv.g; })[0];
        if (!a2) lcas.push('VCG#' + bv.g + ' (' + nm(bv.u) + ') hết thành viên — đã bỏ' + (bv.client ? ', ' + nm(bv.client) + ' mất dịch vụ' : ''));
        else if (a2.k < bv.k) lcas.push('LCAS: VCG#' + a2.g + ' còn ' + vcgLine(a2) + ' · SQ đánh lại 0…' + (a2.k - 1));
      });
      lb.msg = { ok: true, html: 'Đã gỡ ' + esc(nd ? nm(nd.u) : '') + (nd && nd.ts ? ' — trả lại ' + nd.ts.length + ' ' + (pnd ? L().slotWord(MUX(), pnd.u) : 'TS') + ' (#' + esc(tsList(nd.ts)) + ')' : '') + '.' +
        (lcas.length ? '<br>' + lcas.map(esc).join('<br>') : '') }; lb.lastPath = null;
      save(); render(); return;
    }
    if ((b = t.closest('[data-lvcgadd]'))) {
      var gA = +b.getAttribute('data-lvcgadd'), rA = L().addVcgMember(MUX(), tree(), gA);
      lb.msg = rA.ok ? { ok: true, html: 'LCAS: thêm thành viên SQ ' + rA.sq + ' cho VCG#' + gA + ' tại ' + esc(L().locText(MUX(), tree(), rA.path)) + '. ' + esc(vcgLine(vcgOf(gA))) + '.' }
        : { ok: false, html: esc(rA.reason) };
      lb.lastPath = rA.ok ? rA.path : null; save(); render(); return;
    }
    if ((b = t.closest('[data-lvcgdel]'))) {
      var gD = +b.getAttribute('data-lvcgdel'), vD = vcgOf(gD), cD = L().removeVcg(tree(), gD);
      lb.msg = { ok: true, html: 'Đã gỡ VCG#' + gD + (vD ? ' (' + esc(nm(vD.u)) + ')' : '') + ' — trả lại ' + cD + ' ' + esc(vD ? nm(vD.of) : '') + '.' }; lb.lastPath = null;
      save(); render(); return;
    }
    if ((b = t.closest('[data-lfillat]'))) {
      e.stopPropagation();
      var X2 = lb.armed, fp = parsePath(b.getAttribute('data-lfillat'));
      var c2 = X2 ? L().fill(MUX(), tree(), fp, X2) : 0;
      var pn = L().getNode(tree(), fp);
      lb.msg = c2 ? { ok: true, html: 'Đã lấp thêm <b>' + c2 + ' ' + esc(nm(X2)) + '</b> vào bể ' + L().slotWord(MUX(), pn.u) + ' ' + esc(nm(pn.u)) + '.' }
        : { ok: false, html: 'Không còn chỗ cho ' + esc(nm(X2)) + ' — ' + esc(L().explainReject(MUX(), pn.u, X2, pn, tree())) };
      lb.lastPath = null; save(); render(); return;
    }
    if ((b = t.closest('[data-linst]'))) {
      e.stopPropagation();
      L().instantiate(MUX(), tree(), parsePath(b.getAttribute('data-linst')));
      save(); render(); return;
    }
    if ((b = t.closest('[data-lopt]'))) {
      L().setOption(MUX(), tree(), parsePath(b.getAttribute('data-lopt')), optVal(b.getAttribute('data-lval')));
      lb.lastPath = null; save(); render(); return;
    }
    if ((b = t.closest('[data-lcollapse]'))) {
      lb.st.collapsed[b.getAttribute('data-lcollapse')] = b.getAttribute('data-lstate') !== '1';
      save(); render(); return;
    }
    if ((b = t.closest('[data-lstepv]'))) { lb.st.step = { client: lb.st.step.client, vcg: b.getAttribute('data-lstepv') || null, n: lb.st.step.n || 1 }; save(); render(); return; }
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
      var sp = parsePath(s.getAttribute('data-loptsel')), sv = optVal(s.value);
      var sn = L().getNode(tree(), sp);
      L().setOption(MUX(), tree(), sp, sv);
      lb.msg = { ok: true, html: sv < 0 ? 'Đã đưa ' + esc(sn ? nm(sn.u) : '') + ' về <b>nguyên khối</b> (client) — nội dung bên trong đã được xoá.'
        : 'Đã đổi phương án — nội dung cũ bên trong đã được xoá.' }; lb.lastPath = sv < 0 ? null : sp;
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
    var ok = isVcgItem(lb.drag) || (L().reaches(MUX(), su, lb.drag) && (nd ? nd.u !== lb.drag : true)) || (!p.length && L().guestPlaceable(MUX(), tree(), lb.drag));
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
