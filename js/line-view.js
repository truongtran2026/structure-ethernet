/*
 * line-view.js — trang "Từ khung tới bước sóng" (#line/<chuỗi>), đọc window.TLINE (schema transport-schema.md mục 6).
 *  1) Phần thuần LineModel (xuất cả module.exports để kiểm bằng Node): dựng chuỗi bước (tốc độ, tỉ lệ so với bước
 *     trước, tỉ lệ dồn so với gốc, kiểm kbps = trước × ratio), phân rã tốc độ đường dây thành client / OH khung / FEC / DSP,
 *     ký hiệu (GBd) và kênh quang (GHz), điểm chòm sao QAM vuông (Gray minh hoạ).
 *  2) Phần giao diện LineView (chỉ khi có document): bộ chọn chuỗi, sơ đồ thẻ nối mũi tên, thanh tỉ lệ dung lượng,
 *     chòm sao DP-QAM tương tác, phổ trong kênh, bảng so sánh theo compareCols.
 * Không hardcode chuẩn cụ thể: mọi số, nhãn bước, tên điều chế lấy từ dữ liệu.
 */
(function (root) {
  'use strict';

  var KIND_ORDER = ['client', 'adapt', 'frame', 'fec', 'dsp', 'symbol', 'optic'];
  var KIND_LABEL = { client: 'Client', adapt: 'Thích ứng', frame: 'Khung', fec: 'FEC', dsp: 'DSP', symbol: 'Ký hiệu', optic: 'Bước sóng' };
  /** Nhãn nhóm trong thanh tỉ lệ dung lượng (phần tốc độ đường dây do bước loại đó thêm vào). */
  var SHARE_LABEL = { client: 'Dữ liệu client', adapt: 'Thích ứng', frame: 'OH khung + chèn GMP', fec: 'FEC (parity, pad, CRC)', dsp: 'DSP: ký hiệu căn khung + pilot' };
  var TOL = 1e-6; // sai số tương đối cho phép khi kiểm kbps = kbps trước × ratio

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function num(x) { return typeof x === 'number' && isFinite(x); }

  // ---------- phần thuần ----------
  function chainsOf(TL) { return (TL && Array.isArray(TL.chains) ? TL.chains : []).filter(function (c) { return c && c.id && Array.isArray(c.steps); }); }
  function chainById(TL, id) { return chainsOf(TL).filter(function (c) { return c.id === id; })[0] || null; }

  /** Tên điều chế ("DP-16QAM") tìm trong công thức/ghi chú của bước ký hiệu hoặc bảng so sánh. */
  function modulationOf(TL, chain) {
    var txt = (chain.steps || []).map(function (s) { return [s.label, s.formula, s.note].join(' '); }).join(' ');
    var m = /\b(DP-)?(\d+)QAM\b/.exec(txt) || /\b(DP-)?(\d+)QAM\b/.exec(JSON.stringify((TL && TL.compare) || []));
    if (!m) return null;
    return { name: m[0], dual: !!m[1], points: +m[2], bitsPerPol: Math.round(Math.log(+m[2]) / Math.LN2) };
  }

  /**
   * Dựng một chuỗi: mỗi bước có kbps (bước symbol/optic: kế thừa tốc độ bit của bước trước để vẽ), ratioVal,
   * pct (thay đổi so với bước trước), cum (so với gốc), err (lệch giữa kbps dữ liệu và trước × ratio).
   */
  function build(TL, chainId) {
    var c = chainById(TL, chainId);
    if (!c) return null;
    var steps = [], prev = null, base = null, problems = [];
    c.steps.forEach(function (s, i) {
      var st = { i: i, id: s.id || ('s' + i), kind: s.kind, label: s.label || s.id, raw: s,
        kbps: num(s.kbps) ? s.kbps : null, ratio: Array.isArray(s.ratio) && s.ratio.length === 2 ? s.ratio : null,
        gbd: num(s.gbd) ? s.gbd : null, bitsPerSymbol: num(s.bitsPerSymbol) ? s.bitsPerSymbol : null, ghz: num(s.ghz) ? s.ghz : null,
        unit: s.unit || null, frame: s.frame || null, formula: s.formula || '', standard: s.standard || '', note: s.note || '' };
      st.prevKbps = prev;
      if (st.kbps != null) {
        if (base == null) base = st.kbps;
        if (st.ratio && prev != null) {
          st.ratioVal = st.ratio[0] / st.ratio[1];
          st.expected = prev * st.ratioVal;
          st.err = Math.abs(st.kbps / st.expected - 1);
          if (st.err > TOL) problems.push('bước ' + st.id + ': kbps ' + st.kbps + ' ≠ trước × ratio ' + st.expected);
        } else if (prev != null) {
          st.ratioVal = st.kbps / prev;
          problems.push('bước ' + st.id + ': thiếu ratio');
        }
        st.cum = st.kbps / base;
        prev = st.kbps;
      }
      if (st.kind === 'symbol') {
        st.lineKbps = prev;
        if (st.gbd != null && st.bitsPerSymbol && prev != null) {
          st.gbdExpected = prev / st.bitsPerSymbol / 1e6;
          st.err = Math.abs(st.gbd / st.gbdExpected - 1);
          if (st.err > TOL) problems.push('bước ' + st.id + ': gbd ' + st.gbd + ' ≠ ' + st.gbdExpected);
        }
      }
      if (st.ratioVal != null) st.pct = (st.ratioVal - 1) * 100;
      steps.push(st);
    });
    var withK = steps.filter(function (s) { return s.kbps != null; });
    var line = withK.length ? withK[withK.length - 1].kbps : null;
    // client = tốc độ ở cuối đoạn đầu gồm các bước client/adapt (phần thông tin thật sự được chở)
    var clientIdx = -1;
    for (var i = 0; i < steps.length; i++) { if (steps[i].kind === 'client' || steps[i].kind === 'adapt') { if (steps[i].kbps != null) clientIdx = i; } else break; }
    var clientKbps = clientIdx >= 0 ? steps[clientIdx].kbps : base;
    var sym = steps.filter(function (s) { return s.kind === 'symbol'; })[0] || null;
    var opt = steps.filter(function (s) { return s.kind === 'optic'; })[0] || null;
    var m = {
      chain: c, steps: steps, baseKbps: base, clientKbps: clientKbps, clientIdx: clientIdx, lineKbps: line,
      shares: shares(steps, clientIdx, clientKbps, line), problems: problems,
      symbol: sym ? { gbd: sym.gbd, bitsPerSymbol: sym.bitsPerSymbol, lineKbps: sym.lineKbps } : null,
      optic: opt ? { ghz: opt.ghz } : null,
      modulation: modulationOf(TL, c)
    };
    m.byKind = groupShares(m.shares);
    m.overheadPct = clientKbps && line ? (line / clientKbps - 1) * 100 : null;
    m.spectralEff = opt && opt.ghz && clientKbps ? clientKbps / 1e6 / opt.ghz : null; // bit/s/Hz (client / độ rộng kênh)
    m.fill = opt && opt.ghz && sym && sym.gbd ? sym.gbd / opt.ghz : null;              // tốc độ ký hiệu / độ rộng kênh
    return m;
  }

  /**
   * Phân rã tốc độ đường dây: phần client + phần mỗi bước SAU đoạn client thêm vào (kbps − kbps trước).
   * Tổng các phần = tốc độ đường dây (bước cuối có kbps).
   */
  function shares(steps, clientIdx, clientKbps, line) {
    if (!(line > 0)) return [];
    var out = [{ id: '__client', kind: 'client', label: SHARE_LABEL.client, kbps: clientKbps, pct: clientKbps / line * 100 }];
    var prev = clientKbps;
    steps.forEach(function (s, i) {
      if (i <= clientIdx || s.kbps == null) return;
      var d = s.kbps - prev;
      out.push({ id: s.id, kind: s.kind, label: s.label, kbps: d, pct: d / line * 100 });
      prev = s.kbps;
    });
    return out;
  }
  function groupShares(list) {
    var by = {}, order = [];
    list.forEach(function (x) {
      if (!by[x.kind]) { by[x.kind] = { kind: x.kind, label: SHARE_LABEL[x.kind] || x.kind, kbps: 0, pct: 0, n: 0 }; order.push(x.kind); }
      by[x.kind].kbps += x.kbps; by[x.kind].pct += x.pct; by[x.kind].n++;
    });
    return order.map(function (k) { return by[k]; });
  }

  /** Mã Gray n bit của mức k (0 … 2^n − 1) dạng chuỗi. */
  function gray(k, n) { var g = k ^ (k >> 1), s = g.toString(2); while (s.length < n) s = '0' + s; return s; }
  /**
   * Chòm sao QAM vuông M điểm: lưới √M × √M, mức −(√M−1) … +(√M−1) bước 2; nhãn = bit I (Gray) + bit Q (Gray).
   * Chỉ là cách gán bit minh hoạ — bảng ánh xạ thật của chuẩn có thể khác.
   */
  function constellation(points) {
    var side = Math.round(Math.sqrt(points));
    if (side * side !== points || side < 2) return null;
    var nb = Math.round(Math.log(side) / Math.LN2), out = [];
    for (var qi = 0; qi < side; qi++) for (var ii = 0; ii < side; ii++) {
      out.push({ i: 2 * ii - (side - 1), q: 2 * qi - (side - 1), bits: gray(ii, nb) + gray(qi, nb), ii: ii, qi: qi });
    }
    return { side: side, bitsPerAxis: nb, bits: 2 * nb, points: out };
  }
  /** Điểm của chòm sao ứng với chuỗi bit (nửa đầu I, nửa sau Q). */
  function pointOf(con, bits) {
    for (var k = 0; k < con.points.length; k++) if (con.points[k].bits === bits) return con.points[k];
    return null;
  }

  var LineModel = { KIND_ORDER: KIND_ORDER, KIND_LABEL: KIND_LABEL, SHARE_LABEL: SHARE_LABEL, TOL: TOL,
    chainsOf: chainsOf, chainById: chainById, build: build, shares: shares, groupShares: groupShares,
    modulationOf: modulationOf, constellation: constellation, pointOf: pointOf, gray: gray };
  root.LineModel = LineModel;
  if (typeof module !== 'undefined' && module.exports) module.exports = LineModel;
  if (typeof document === 'undefined') return;

  // =====================================================================
  // Giao diện
  // =====================================================================
  var STORE = 'fs.line.v1';
  var lv = { active: false, id: null, m: null, st: { sel: {}, bits: '10110010' } };

  function TV() { return root.TransViz; }
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function n(x, d) { return TV() ? TV().fmtNum(x, d) : String(x); }
  function rate(k) { return TV() ? TV().fmtRate(k) : k + ' kbit/s'; }
  function pct(x, d) { return n(x, d == null ? 2 : d) + ' %'; }
  function signPct(x) { return (x >= 0 ? '+' : '−') + n(Math.abs(x), Math.abs(x) < 0.1 ? 3 : 2) + ' %'; }
  function load() {
    try { var s = JSON.parse(localStorage.getItem(STORE) || 'null'); if (s && typeof s === 'object') { lv.st.sel = s.sel && typeof s.sel === 'object' ? s.sel : {}; if (/^[01]+$/.test(s.bits || '')) lv.st.bits = s.bits; } } catch (e) { /* bỏ qua */ }
  }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(lv.st)); } catch (e) { /* bỏ qua */ } }

  /** "× 514/544" khi ratio là phân số nguyên gọn, còn lại "× 1,000400". */
  function ratioTxt(s) {
    if (!s.ratio) return '';
    var a = s.ratio[0], b = s.ratio[1];
    if (Number.isInteger(a) && Number.isInteger(b) && a < 1e8 && b < 1e8) return '× ' + n(a, 0) + '/' + n(b, 0);
    return '× ' + n(s.ratioVal, 6);
  }
  /** Lab có đơn vị `unit` (ưu tiên lab có gốc của chuỗi). */
  function labFor(unit, rootId) {
    var labs = Array.isArray(root.TLABS) ? root.TLABS : [], hit = null;
    labs.forEach(function (l) {
      if (hit) return;
      var inLab = (l.palette || []).indexOf(unit) >= 0 || (l.roots || []).indexOf(unit) >= 0;
      if (inLab && (!rootId || (l.roots || []).indexOf(rootId) >= 0)) hit = l;
    });
    return hit;
  }
  /** Ghi trạng thái lab (gốc + đơn vị cầm sẵn) rồi để liên kết #lab/… chạy (cùng cơ chế #sim → lab). */
  function seedLab(labId, rootId, arm) {
    try {
      var key = 'fs.lab.v1.' + labId, s = JSON.parse(localStorage.getItem(key) || 'null') || {};
      if (rootId) s.root = rootId;
      if (arm && arm !== rootId) s.arm = arm;
      localStorage.setItem(key, JSON.stringify(s));
    } catch (e) { /* không có localStorage: lab mở bình thường */ }
  }
  function unitName(id) { var M = root.TMUX || {}; return M[id] ? (TV() && TV().lab ? TV().lab.nameOf(M, id) : M[id].name) : id; }

  // ---------- vào/ra ----------
  function items() {
    return chainsOf(root.TLINE).map(function (c) { return { id: c.id, name: c.name || c.id, hint: c.summary || '' }; });
  }
  function init() {
    var v = document.getElementById('view-line');
    if (!v) throw new Error('Thiếu #view-line trong index.html');
    load();
    v.addEventListener('click', onClick);
    v.addEventListener('keydown', function (e) {
      var c = e.target.closest && e.target.closest('[data-lstep]');
      if (!c || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      var list = Array.prototype.slice.call(v.querySelectorAll('[data-lstep]')), i = list.indexOf(c);
      var j = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? Math.min(list.length - 1, i + 1) : Math.max(0, i - 1);
      e.preventDefault(); selectStep(list[j].getAttribute('data-lstep'), true);
    });
    document.getElementById('detail').addEventListener('click', function (e) {
      if (!lv.active) return;
      var a = e.target.closest && e.target.closest('[data-lseed]');
      if (a) seedLab(a.getAttribute('data-lseed'), a.getAttribute('data-lroot'), a.getAttribute('data-larm'));
    });
  }
  function show(id) {
    lv.active = true;
    var c = chainById(root.TLINE, id) || chainsOf(root.TLINE)[0];
    var v = document.getElementById('view-line');
    document.getElementById('alerts').innerHTML = root.AppNav ? root.AppNav.loadAlertsHtml() : '';
    if (!c) { v.innerHTML = '<div class="empty"><h1>Chưa có dữ liệu giao diện đường truyền</h1><p class="muted">Cần <code>data/transport-line.js</code> (window.TLINE).</p></div>'; return; }
    lv.id = c.id;
    lv.m = build(root.TLINE, c.id);
    render();
  }
  function hide() { lv.active = false; }

  // ---------- vẽ ----------
  function render() {
    var m = lv.m, c = m.chain, TL = root.TLINE;
    var v = document.getElementById('view-line');
    var warn = m.problems.length ? '<div class="alert alert--warn"><strong>Dữ liệu chuỗi không khớp:</strong> ' + esc(m.problems.join('; ')) + '</div>' : '';
    v.innerHTML =
      '<section class="stack-head"><div class="head-top"><span class="eyebrow">Truyền dẫn · Giao diện đường truyền</span>' +
        '<h1 class="stack-title">Từ khung tới bước sóng</h1>' +
        '<p class="stack-summary ln-intro">Router gửi Ethernet vào một module quang “coherent” cắm thẳng trên cổng. ' +
          'Module gói dữ liệu vào khung, thêm mã sửa lỗi (FEC) cho đường dài, rồi biến mỗi nhóm bit thành một <b>ký hiệu</b> ánh sáng (biên độ + pha, trên hai phân cực). ' +
          'Số ký hiệu mỗi giây (<b>GBd</b>) quyết định phổ tín hiệu rộng bao nhiêu, nên quyết định cần khe tần số DWDM (GHz) cỡ nào.</p>' +
        (TL.intro ? '<details class="stack-detail"><summary>Chuỗi tổng quát</summary><p>' + esc(TL.intro) + '</p>' + (TL.standard ? '<p class="muted">Nguồn: ' + esc(TL.standard) + '</p>' : '') + '</details>' : '') +
      '</div>' + pickerHtml() + '</section>' + warn +
      '<section class="card" aria-labelledby="ln-sum-t"><div class="section-title"><h2 id="ln-sum-t">' + esc(c.name) + '</h2><span class="muted">' + esc(c.summary || '') + '</span></div>' +
        statsHtml(m) + linksHtml(m) + '</section>' +
      '<section class="card" aria-labelledby="ln-flow-t"><div class="section-title"><h2 id="ln-flow-t">Dòng chảy từng bước</h2><span class="muted">bấm một bước để xem công thức · ← → chuyển bước</span></div>' +
        flowHtml(m) + '<div class="ln-stepdetail" id="ln-stepdetail" aria-live="polite">' + stepDetailHtml(m, curStep()) + '</div>' + kindLegend(m) + '</section>' +
      '<section class="card" aria-labelledby="ln-share-t"><div class="section-title"><h2 id="ln-share-t">Tỉ lệ dung lượng trên đường dây</h2><span class="muted">mỗi bit trên sợi là gì</span></div>' + shareHtml(m) + '</section>' +
      (m.modulation ? '<section class="card" aria-labelledby="ln-con-t"><div class="section-title"><h2 id="ln-con-t">Chòm sao ' + esc(m.modulation.name) + ': vì sao ' + esc(m.symbol && m.symbol.bitsPerSymbol || m.modulation.bitsPerPol * (m.modulation.dual ? 2 : 1)) + ' bit mỗi ký hiệu</h2></div>' + constHtml(m) + '</section>' : '') +
      (m.optic && m.symbol ? '<section class="card" aria-labelledby="ln-spec-t"><div class="section-title"><h2 id="ln-spec-t">Tín hiệu trong khe DWDM</h2></div>' + spectrumHtml(m) + '</section>' : '') +
      compareHtml(TL, c.id);
    renderDetail();
  }

  function pickerHtml() {
    var cs = chainsOf(root.TLINE);
    if (cs.length < 2) return '';
    return '<nav class="ln-pick seg-group" aria-label="Chọn giao diện">' + cs.map(function (c) {
      var on = c.id === lv.id;
      return '<a class="seg-btn' + (on ? ' is-on' : '') + '" href="#line/' + esc(c.id) + '"' + (on ? ' aria-current="page"' : '') + ' title="' + esc(c.summary || '') + '">' + esc(c.name || c.id) + '</a>';
    }).join('') + '</nav>';
  }

  function stat(label, value, sub, tip) {
    return '<div class="stat"' + (tip ? ' title="' + esc(tip) + '"' : '') + '><div class="stat-label">' + esc(label) + '</div><div class="stat-value">' + esc(value) + '</div><div class="stat-sub">' + esc(sub || '') + '</div></div>';
  }
  function statsHtml(m) {
    var s = m.steps, first = s[0];
    return '<div class="stats">' +
      stat('Vào (host)', rate(m.baseKbps), first ? first.label : '') +
      stat('Dữ liệu client chở', rate(m.clientKbps), m.clientIdx > 0 ? 'sau khi bỏ FEC/AM của Ethernet' : '') +
      stat('Đường dây', rate(m.lineKbps), m.overheadPct != null ? '+' + pct(m.overheadPct, 1) + ' so với client' : '', 'Tốc độ bit trên sợi sau mọi FEC, ký hiệu căn khung, pilot') +
      (m.symbol ? stat('Tốc độ ký hiệu', n(m.symbol.gbd, 3) + ' GBd', m.symbol.bitsPerSymbol + ' bit/ký hiệu' + (m.modulation ? ' (' + m.modulation.name + ')' : '')) : '') +
      (m.optic ? stat('Kênh DWDM', n(m.optic.ghz, 0) + ' GHz', m.spectralEff ? '≈ ' + n(m.spectralEff, 2) + ' bit/s/Hz dữ liệu client' : '', 'Hiệu suất phổ = tốc độ client ÷ độ rộng kênh') : '') +
      '</div>';
  }
  function linksHtml(m) {
    var c = m.chain, out = [];
    if (c.frame && root.TFRAMES && root.TFRAMES[c.frame]) out.push('<a class="btn-ghost btn-link" href="#t/' + esc(c.frame) + '">▦ Xem khung ' + esc(root.TFRAMES[c.frame].name) + '</a>');
    var lab = c.unit && labFor(c.unit, c.unit);
    if (lab) out.push('<a class="btn-ghost btn-link" data-lseed="' + esc(lab.id) + '" data-lroot="' + esc(c.unit) + '" data-larm="' + esc(c.client || '') + '" href="#lab/' + esc(lab.id) + '">⚗ Mở lab: ' + esc(unitName(c.unit)) + (c.client ? ' + ' + esc(unitName(c.client)) : '') + '</a>');
    if (root.AppNav && root.AppNav.has('#calc')) out.push('<a class="btn-ghost btn-link" href="#calc">∑ Máy tính tốc độ</a>');
    return out.length ? '<p class="ln-links">' + out.join(' ') + '</p>' : '';
  }

  function curStep() {
    var m = lv.m, id = lv.st.sel[lv.id];
    return m.steps.filter(function (s) { return s.id === id; })[0] || m.steps[0];
  }
  /** Giá trị chính của thẻ: tốc độ (bước có kbps), GBd (symbol), GHz (optic). */
  function cardValue(s) {
    if (s.kind === 'symbol' && s.gbd != null) return { v: n(s.gbd, 3) + ' GBd', sub: '÷ ' + s.bitsPerSymbol + ' bit/ký hiệu' };
    if (s.kind === 'optic' && s.ghz != null) return { v: n(s.ghz, 0) + ' GHz', sub: 'độ rộng kênh' };
    if (s.kbps != null) return { v: rate(s.kbps), sub: s.ratio ? ratioTxt(s) + ' (' + signPct(s.pct) + ')' : 'điểm xuất phát' };
    return { v: '–', sub: '' };
  }
  function flowHtml(m) {
    var cur = curStep();
    return '<ol class="ln-flow">' + m.steps.map(function (s, i) {
      var cv = cardValue(s), on = s.id === cur.id;
      return (i ? '<li class="ln-arrow" aria-hidden="true"><span>→</span></li>' : '') +
        '<li class="ln-cell"><button type="button" class="ln-card lk-' + esc(s.kind) + (on ? ' is-sel' : '') + '" data-lstep="' + esc(s.id) + '" aria-pressed="' + on + '"' + (on ? '' : ' tabindex="-1"') + '>' +
          '<span class="ln-kind">' + (i + 1) + ' · ' + esc(KIND_LABEL[s.kind] || s.kind) + '</span>' +
          '<span class="ln-label">' + esc(s.label) + '</span>' +
          '<span class="ln-val">' + esc(cv.v) + '</span>' +
          '<span class="ln-sub">' + esc(cv.sub) + '</span>' +
          (s.cum != null && i ? '<span class="ln-cum" title="Tốc độ bước này so với bước đầu">' + n(s.cum, 4) + ' × gốc</span>' : '') +
        '</button></li>';
    }).join('') + '</ol>';
  }
  function kindLegend(m) {
    var kinds = {};
    m.steps.forEach(function (s) { kinds[s.kind] = true; });
    return '<div class="legend">' + KIND_ORDER.filter(function (k) { return kinds[k]; }).map(function (k) {
      return '<span class="lg-item"><span class="lg-sw lk-' + k + '"></span>' + esc(KIND_LABEL[k]) + '</span>';
    }).join('') + '</div>';
  }
  function stepDetailHtml(m, s) {
    if (!s) return '';
    var rows = [];
    if (s.kbps != null) rows.push(['Tốc độ sau bước', esc(rate(s.kbps)) + ' <span class="muted">= ' + esc(n(s.kbps, 3)) + ' kbit/s</span>']);
    if (s.ratio && s.prevKbps != null) rows.push(['So với bước trước', esc(ratioTxt(s)) + ' = ' + esc(n(s.ratioVal, 6)) + ' <span class="muted">(' + esc(signPct(s.pct)) + '; từ ' + esc(rate(s.prevKbps)) + ')</span>']);
    if (s.cum != null && s.i) rows.push(['So với bước đầu', esc(n(s.cum, 6)) + ' ×']);
    if (s.kind === 'symbol' && s.gbd != null) rows.push(['Tốc độ ký hiệu', esc(n(s.gbd, 6)) + ' GBd <span class="muted">= ' + esc(rate(s.lineKbps)) + ' ÷ ' + s.bitsPerSymbol + ' bit/ký hiệu</span>']);
    if (s.kind === 'optic' && s.ghz != null) rows.push(['Độ rộng kênh', esc(n(s.ghz, 0)) + ' GHz' + (m.fill ? ' <span class="muted">— tín hiệu ≈ ' + esc(n(m.symbol.gbd, 1)) + ' GHz (≈ tốc độ ký hiệu) chiếm ' + esc(pct(m.fill * 100, 0)) + ' khe</span>' : '')]);
    if (s.err != null && s.err > TOL) rows.push(['Kiểm', '<span class="err-text">lệch ' + esc(n(s.err * 100, 4)) + ' % so với công thức</span>']);
    var btns = [];
    if (s.frame && root.TFRAMES && root.TFRAMES[s.frame]) btns.push('<a class="btn-ghost btn-sm" href="#t/' + esc(s.frame) + '">▦ Xem khung</a>');
    if (s.unit) {
      var lab = labFor(s.unit, m.chain.unit) || labFor(s.unit, null);
      if (lab) btns.push('<a class="btn-ghost btn-sm" data-lseed="' + esc(lab.id) + '" data-lroot="' + esc((lab.roots || []).indexOf(m.chain.unit) >= 0 ? m.chain.unit : '') + '" data-larm="' + esc(s.unit) + '" href="#lab/' + esc(lab.id) + '">⚗ Mở lab (' + esc(unitName(s.unit)) + ')</a>');
    }
    return '<div class="ln-sd lk-' + esc(s.kind) + '"><h3><span class="chip">' + (s.i + 1) + ' · ' + esc(KIND_LABEL[s.kind] || s.kind) + '</span> ' + esc(s.label) + '</h3>' +
      '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
      (s.formula ? '<p class="ln-formula"><b>Công thức:</b> ' + esc(s.formula) + '</p>' : '') +
      (s.note ? '<p>' + esc(s.note) + '</p>' : '') +
      (s.standard ? '<p class="muted calc-small">Nguồn: ' + esc(s.standard) + '</p>' : '') +
      (btns.length ? '<p class="ln-links">' + btns.join(' ') + '</p>' : '') + '</div>';
  }

  function shareHtml(m) {
    if (!m.shares.length) return '<p class="muted">Chuỗi không có tốc độ đường dây.</p>';
    var bar = '<div class="ln-bar" role="img" aria-label="' + esc(m.byKind.map(function (g) { return g.label + ' ' + n(g.pct, 1) + ' %'; }).join(', ')) + '">' +
      m.shares.map(function (x) {
        var w = Math.max(0, x.pct);
        return '<span class="ln-seg lk-' + esc(x.kind) + '" style="width:' + w.toFixed(4) + '%" title="' + esc(x.label + ': ' + rate(x.kbps) + ' (' + n(x.pct, 3) + ' %)') + '">' +
          (w >= 9 ? '<span>' + esc(n(x.pct, 1)) + ' %</span>' : '') + '</span>';
      }).join('') + '</div>';
    var groups = '<div class="ln-share-groups">' + m.byKind.map(function (g) {
      return '<div class="ln-sg"><span class="lg-sw lk-' + esc(g.kind) + '"></span><b>' + esc(g.label) + '</b> <span class="ln-sg-v">' + esc(pct(g.pct, 2)) + '</span><span class="muted"> · ' + esc(rate(g.kbps)) + '</span></div>';
    }).join('') + '</div>';
    var rows = m.shares.map(function (x) {
      return '<tr><td><span class="lg-sw lk-' + esc(x.kind) + '"></span> ' + esc(x.label) + '</td><td class="num">' + esc(rate(x.kbps)) + '</td><td class="num">' + esc(pct(x.pct, 3)) + '</td></tr>';
    }).join('');
    return bar + groups +
      '<p class="muted calc-small">Cả thanh = tốc độ đường dây ' + esc(rate(m.lineKbps)) + '. Phần FEC/Ethernet bị bóc ở host (trước khi vào khung) không nằm trên sợi nên không có trong thanh.</p>' +
      '<details class="ln-more"><summary>Bảng chi tiết từng phần</summary><div class="tbl-wrap"><table class="values"><thead><tr><th>Phần</th><th class="num">Tốc độ</th><th class="num">% đường dây</th></tr></thead><tbody>' + rows +
      '<tr><td><b>Tổng</b></td><td class="num"><b>' + esc(rate(m.shares.reduce(function (a, x) { return a + x.kbps; }, 0))) + '</b></td><td class="num">100 %</td></tr></tbody></table></div></details>';
  }

  // ---------- chòm sao ----------
  function constHtml(m) {
    var mod = m.modulation, con = constellation(mod.points);
    if (!con) return '<p class="muted">Điều chế ' + esc(mod.name) + ' không phải QAM vuông — không vẽ chòm sao.</p>';
    var pols = mod.dual ? 2 : 1, need = con.bits * pols;
    var bits = lv.st.bits;
    if (bits.length !== need) { bits = (bits + '0000000000000000').slice(0, need); lv.st.bits = bits; }
    var bitBtns = '<div class="ln-bits" role="group" aria-label="' + need + ' bit của một ký hiệu">' + bits.split('').map(function (b, i) {
      var pol = Math.floor(i / con.bits), k = i % con.bits, axis = k < con.bitsPerAxis ? 'I' : 'Q';
      return '<button type="button" class="ln-bit pol-' + pol + '" data-lbit="' + i + '" aria-pressed="' + (b === '1') + '" title="Bit ' + (i + 1) + ' → phân cực ' + (pol ? 'Y' : 'X') + ', trục ' + axis + '">' + b + '</button>' +
        (k === con.bits - 1 && pol < pols - 1 ? '<span class="ln-bits-sep" aria-hidden="true">|</span>' : '');
    }).join('') + '<button type="button" class="btn-ghost btn-sm" data-lrand="1">⟳ Ký hiệu ngẫu nhiên</button></div>';
    var panels = '';
    for (var p = 0; p < pols; p++) panels += constSvg(con, bits.substr(p * con.bits, con.bits), p, pols);
    var total = m.symbol && m.symbol.bitsPerSymbol;
    return '<p>Mỗi ký hiệu là <b>một</b> trạng thái ánh sáng trong một khoảng thời gian rất ngắn. ' + esc(mod.points) + ' điểm trên mặt phẳng I/Q (biên độ × pha) ' +
      'phân biệt được ' + esc(mod.points) + ' trạng thái = ' + con.bits + ' bit (' + con.bitsPerAxis + ' bit chọn cột I, ' + con.bitsPerAxis + ' bit chọn hàng Q)' +
      (mod.dual ? '; hai phân cực X và Y của cùng bước sóng gửi đồng thời hai điểm độc lập → <b>' + need + ' bit mỗi ký hiệu</b>' : '') + '.' +
      (total && total !== need ? ' <span class="muted">(Dữ liệu ghi ' + total + ' bit/ký hiệu.)</span>' : '') + '</p>' +
      bitBtns + '<div class="ln-const">' + panels + '</div>' +
      '<p class="muted calc-small">Bấm từng bit (hoặc “ngẫu nhiên”) để thấy điểm được chọn ở mỗi phân cực. Nhãn bit theo mã Gray minh hoạ (hai điểm cạnh nhau khác đúng 1 bit) — bảng ánh xạ bit thật của chuẩn có thể khác. ' +
      (m.symbol ? 'Với ' + esc(n(m.symbol.gbd, 3)) + ' GBd: ' + esc(n(m.symbol.gbd, 3)) + ' tỉ ký hiệu/giây × ' + m.symbol.bitsPerSymbol + ' bit = ' + esc(rate(m.symbol.lineKbps)) + '.' : '') + '</p>';
  }
  function constSvg(con, bits, pol, pols) {
    var S = 220, pad = 22, side = con.side, step = (S - 2 * pad) / side, half = S / 2;
    var pt = pointOf(con, bits);
    var x = function (i) { return pad + (i + (side - 1)) / 2 * step + step / 2; };
    var y = function (q) { return S - (pad + (q + (side - 1)) / 2 * step + step / 2); };
    var dots = con.points.map(function (p) {
      var on = pt && p.bits === pt.bits;
      return '<g class="ln-pt' + (on ? ' is-on' : '') + '"><circle cx="' + x(p.i).toFixed(1) + '" cy="' + y(p.q).toFixed(1) + '" r="' + (on ? 7 : 4.5) + '"></circle>' +
        '<text x="' + x(p.i).toFixed(1) + '" y="' + (y(p.q) + 17).toFixed(1) + '" text-anchor="middle">' + p.bits + '</text></g>';
    }).join('');
    var name = pols > 1 ? 'Phân cực ' + (pol ? 'Y' : 'X') : 'Ký hiệu';
    return '<figure class="ln-fig"><svg viewBox="0 0 ' + S + ' ' + S + '" class="ln-svg pol-' + pol + '" role="img" aria-label="' + esc(name + ': điểm ' + bits) + '">' +
      '<line class="ln-ax" x1="' + pad / 2 + '" y1="' + half + '" x2="' + (S - pad / 2) + '" y2="' + half + '"></line>' +
      '<line class="ln-ax" x1="' + half + '" y1="' + pad / 2 + '" x2="' + half + '" y2="' + (S - pad / 2) + '"></line>' +
      '<text class="ln-axl" x="' + (S - 4) + '" y="' + (half - 4) + '" text-anchor="end">I</text><text class="ln-axl" x="' + (half + 5) + '" y="' + (pad / 2 + 8) + '">Q</text>' +
      dots + '</svg><figcaption><b>' + esc(name) + '</b>: bit <code>' + esc(bits) + '</code>' + (pt ? ' → I = ' + (pt.i > 0 ? '+' : '') + pt.i + ', Q = ' + (pt.q > 0 ? '+' : '') + pt.q : '') + '</figcaption></figure>';
  }

  // ---------- phổ trong kênh ----------
  function spectrumHtml(m) {
    var ghz = m.optic.ghz, gbd = m.symbol.gbd, W = 520, H = 120, pad = 30;
    var scale = (W - 2 * pad) / Math.max(ghz, gbd) , cx = W / 2;
    var chW = ghz * scale, sgW = Math.min(gbd, ghz * 1.5) * scale;
    var x0 = cx - chW / 2, s0 = cx - sgW / 2;
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="ln-spec" role="img" aria-label="Kênh ' + esc(n(ghz, 0)) + ' GHz, tín hiệu khoảng ' + esc(n(gbd, 1)) + ' GHz">' +
      '<rect class="ln-ch" x="' + x0.toFixed(1) + '" y="18" width="' + chW.toFixed(1) + '" height="' + (H - 48) + '"></rect>' +
      '<path class="ln-sig" d="M' + (s0 - 6).toFixed(1) + ' ' + (H - 30) + ' L' + s0.toFixed(1) + ' 34 L' + (s0 + sgW).toFixed(1) + ' 34 L' + (s0 + sgW + 6).toFixed(1) + ' ' + (H - 30) + ' Z"></path>' +
      '<line class="ln-ax" x1="' + pad / 2 + '" y1="' + (H - 30) + '" x2="' + (W - pad / 2) + '" y2="' + (H - 30) + '"></line>' +
      '<text x="' + cx + '" y="13" text-anchor="middle" class="ln-axl">khe DWDM ' + esc(n(ghz, 0)) + ' GHz</text>' +
      '<text x="' + cx + '" y="' + (H / 2 + 6) + '" text-anchor="middle" class="ln-sigl">tín hiệu ≈ ' + esc(n(gbd, 1)) + ' GHz</text>' +
      '<text x="' + cx + '" y="' + (H - 12) + '" text-anchor="middle" class="ln-axl">tần số quang (tâm kênh)</text></svg>';
    return svg + '<p>Phổ một tín hiệu ' + esc(m.modulation ? m.modulation.name : '') + ' rộng xấp xỉ bằng tốc độ ký hiệu: ' + esc(n(gbd, 3)) + ' GBd → khoảng ' + esc(n(gbd, 0)) + ' GHz (cộng thêm một chút do bộ lọc định dạng xung, roll-off). ' +
      'Khe ' + esc(n(ghz, 0)) + ' GHz chừa phần còn lại làm khoảng bảo vệ giữa các kênh. Muốn nhiều bit hơn trong cùng khe thì phải tăng số bit mỗi ký hiệu (điều chế bậc cao, cần tín hiệu sạch hơn) chứ không tăng được GBd.</p>' +
      '<p class="muted calc-small">Hình minh hoạ tỉ lệ độ rộng, không phải phổ đo.</p>';
  }

  // ---------- so sánh ----------
  function compareHtml(TL, cur) {
    var cols = Array.isArray(TL.compareCols) ? TL.compareCols : [], rows = Array.isArray(TL.compare) ? TL.compare : [];
    if (!cols.length || !rows.length) return '';
    var cell = function (v) {
      var s = String(v == null ? '–' : v), unv = /CHƯA XÁC MINH/.test(s);
      return '<td' + (unv ? ' class="ln-unv"' : '') + '>' + esc(s.replace(/\s*[–-]?\s*CHƯA XÁC MINH\s*/g, ' ').trim() || '') + (unv ? ' <span class="badge badge--unv" title="Chưa có văn bản chuẩn để đối chiếu">chưa xác minh</span>' : '') + '</td>';
    };
    return '<section class="card" aria-labelledby="ln-cmp-t"><div class="section-title"><h2 id="ln-cmp-t">So sánh</h2><span class="muted">cột tô đậm = giao diện đang xem</span></div>' +
      '<div class="tbl-wrap"><table class="values ln-cmp"><thead><tr><th>Tiêu chí</th>' + cols.map(function (c) {
        return '<th class="' + (c.id === cur ? 'is-cur' : '') + '">' + esc(c.label || c.id) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function (r) {
        return '<tr><th scope="row">' + esc(r.label) + (r.source ? '<div class="muted ln-src">' + esc(r.source) + '</div>' : '') + '</th>' +
          cols.map(function (c) { return cell(has(r, c.id) ? r[c.id] : null).replace('<td', '<td data-col="' + esc(c.id) + '"' + (c.id === cur ? ' data-cur="1"' : '')); }).join('') + '</tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  function renderDetail() {
    var m = lv.m, c = m.chain;
    document.getElementById('detail').innerHTML = '<div class="detail-card"><span class="eyebrow">Từ khung tới bước sóng</span><h2>' + esc(c.name) + '</h2>' +
      (c.summary ? '<p class="lead">' + esc(c.summary) + '</p>' : '') + linksHtml(m) +
      (c.standard ? '<p class="muted">Nguồn: ' + esc(c.standard) + '</p>' : '') + '</div>' +
      '<div class="detail-empty"><h2>Cách đọc</h2><ol>' +
      '<li>Mỗi thẻ là một bước; số lớn là tốc độ <b>sau</b> bước đó, dòng dưới là tỉ lệ so với bước trước (phân số chính xác + % tăng/giảm).</li>' +
      '<li>Màu theo loại bước: ' + KIND_ORDER.map(function (k) { return '<span class="lg-sw lk-' + k + '"></span>' + esc(KIND_LABEL[k]); }).join(', ') + '.</li>' +
      '<li>Nhân dồn mọi tỉ lệ từ thẻ đầu sẽ ra tốc độ đường dây; chia cho số bit/ký hiệu ra GBd.</li>' +
      '<li>“Xem khung” mở lưới bit của khung; “Mở lab” mở phòng thí nghiệm với đơn vị đã cầm sẵn.</li></ol></div>';
  }

  // ---------- tương tác ----------
  function selectStep(id, focus) {
    lv.st.sel[lv.id] = id; save();
    var v = document.getElementById('view-line');
    Array.prototype.forEach.call(v.querySelectorAll('[data-lstep]'), function (b) {
      var on = b.getAttribute('data-lstep') === id;
      b.classList.toggle('is-sel', on); b.setAttribute('aria-pressed', String(on)); b.setAttribute('tabindex', on ? '0' : '-1');
      if (on && focus) b.focus();
    });
    var d = document.getElementById('ln-stepdetail');
    if (d) d.innerHTML = stepDetailHtml(lv.m, curStep());
  }
  function rerenderConst() {
    var sec = document.getElementById('ln-con-t');
    if (!sec) return;
    var card = sec.closest('.card');
    card.innerHTML = '<div class="section-title"><h2 id="ln-con-t">' + sec.innerHTML + '</h2></div>' + constHtml(lv.m);
  }
  function onClick(e) {
    if (!lv.active) return;
    var t = e.target; if (!t.closest) return;
    var b;
    if ((b = t.closest('[data-lstep]'))) { selectStep(b.getAttribute('data-lstep'), false); return; }
    if ((b = t.closest('[data-lbit]'))) {
      var i = +b.getAttribute('data-lbit'), a = lv.st.bits.split('');
      a[i] = a[i] === '1' ? '0' : '1'; lv.st.bits = a.join(''); save(); rerenderConst();
      var nb = document.querySelector('#view-line [data-lbit="' + i + '"]'); if (nb) nb.focus();
      return;
    }
    if (t.closest('[data-lrand]')) {
      var s = ''; for (var k = 0; k < lv.st.bits.length; k++) s += Math.random() < 0.5 ? '0' : '1';
      lv.st.bits = s; save(); rerenderConst(); return;
    }
    if ((b = t.closest('[data-lseed]'))) seedLab(b.getAttribute('data-lseed'), b.getAttribute('data-lroot'), b.getAttribute('data-larm')); // rồi để liên kết chạy
  }

  root.LineView = { init: init, show: show, hide: hide, items: items };
})(typeof window !== 'undefined' ? window : globalThis);
