/*
 * conn-view.js — mảng "Đấu nối": sơ đồ chân (pinout), cáp & đầu chuyển (cable), công cụ Chuyển đổi.
 * Đọc window.CONN_BODIES / CONN_PINOUTS / CONN_CABLES theo
 * .claude/skills/connector-pinout-spec/references/connector-schema.md. Không hardcode tên đầu nối.
 *
 * Quy ước hướng nhìn (schema mục 1):
 *  - face.pins vẽ cho giới tính face.viewOf, nhìn thẳng vào MẶT CẮM;
 *  - giới tính còn lại nhìn mặt cắm = ảnh gương ngang (hai mặt cắm úp vào nhau);
 *  - nhìn từ PHÍA HÀN của một giới tính = ảnh gương ngang mặt cắm của chính nó.
 *  ⇒ lật gương ⇔ (giới tính ≠ viewOf) XOR (nhìn phía hàn).
 *
 * Phần thuần (ConnViz) xuất cả module.exports để kiểm bằng Node; phần vẽ là window.ConnView {init, show, hide, navModel}.
 */
(function (root) {
  'use strict';

  var STORE_KEY = 'fs.conn.v1';
  var FAMILY = {
    serial: { name: 'Nối tiếp / console', order: 1 },
    telecom: { name: 'Viễn thông / mạng', order: 2 },
    usb: { name: 'USB', order: 3 },
    video: { name: 'Video', order: 4 }
  };
  var KIND = {
    cable: { name: 'Cáp', short: 'cáp' },
    adapter: { name: 'Đầu chuyển (khối liền)', short: 'đầu chuyển' },
    loopback: { name: 'Nút thử vòng (loopback)', short: 'loopback' },
    balun: { name: 'Balun (biến áp / điện trở)', short: 'balun' }
  };
  var DIR = {
    'in': { sym: '←', label: 'Vào', hint: 'tín hiệu đi VÀO thiết bị' },
    out: { sym: '→', label: 'Ra', hint: 'tín hiệu đi RA khỏi thiết bị' },
    io: { sym: '↔', label: 'Hai chiều', hint: 'vào/ra tuỳ lúc' },
    diff: { sym: '⇄', label: 'Cặp vi sai', hint: 'một nửa của cặp vi sai' },
    pwr: { sym: '+', label: 'Nguồn', hint: 'cấp/nhận nguồn' },
    gnd: { sym: '⏚', label: 'Đất', hint: 'đất tín hiệu / đất nguồn' },
    shield: { sym: '▭', label: 'Vỏ / giáp', hint: 'vỏ kim loại, lưới chống nhiễu' },
    nc: { sym: '·', label: 'Không dùng', hint: 'không nối (NC)' }
  };
  var ROLE_HINT = {
    DTE: 'DTE — thiết bị đầu cuối dữ liệu (PC, cổng console)',
    DCE: 'DCE — thiết bị truyền dữ liệu (modem)',
    host: 'host — máy chủ USB',
    device: 'device — thiết bị USB',
    NT: 'NT — đầu cuối mạng (phía nhà mạng)',
    TE: 'TE — thiết bị đầu cuối',
    source: 'source — phía nguồn hình (card đồ hoạ, máy tính)',
    sink: 'sink — phía nhận hình (màn hình, TV)'
  };
  var GENDER_SHORT = { male: 'đầu đực', female: 'đầu cái' };
  // màu nhóm chân: mượn bảng màu layer (đã có biến thể sáng/tối, đủ tương phản)
  var GROUP_LAYERS = ['l2', 'l3', 'l4', 'tunnel', 'l2_5', 'trailer', 'l7', 'phy'];
  var DIR_LAYER = { 'in': 'l3', out: 'l2', io: 'tunnel', diff: 'tunnel', pwr: 'trailer', gnd: 'phy', shield: 'phy', nc: 'payload' };
  var BLADE = { rj: 1, 'usb-a': 1, 'usb-b': 1, 'usb-b-ss': 1, 'usb-mini-b': 1, 'usb-micro-b': 1, 'usb-micro-b-ss': 1, 'usb-c': 1,
    'hdmi-a': 1, 'hdmi-c': 1, 'hdmi-d': 1, dp: 1, 'mini-dp': 1 };
  // vỏ hình thang vát hai góc dưới: tỉ lệ cạnh vát theo chiều cao (HDMI A/C/D, Mini DP)
  var CHAMFER2 = { 'hdmi-a': 0.38, 'hdmi-c': 0.32, 'hdmi-d': 0.26, 'mini-dp': 0.3 };
  // màu dây (T568A/B, USB…): cụm dài trước để "xanh lá" không bị bắt thành "xanh"
  var WIRE_COLORS = [
    ['xanh lá', '#2f9e44'], ['xanh lục', '#2f9e44'], ['xanh dương', '#1c6fd6'], ['xanh lam', '#1c6fd6'], ['green', '#2f9e44'], ['blue', '#1c6fd6'],
    ['cam', '#f08c00'], ['orange', '#f08c00'], ['nâu', '#8b5a2b'], ['brown', '#8b5a2b'], ['đỏ', '#e03131'], ['red', '#e03131'],
    ['đen', '#2b2b2b'], ['black', '#2b2b2b'], ['vàng', '#e8b900'], ['yellow', '#e8b900'], ['tím', '#8e44ad'], ['violet', '#8e44ad'], ['purple', '#8e44ad'],
    ['xám', '#868e96'], ['grey', '#868e96'], ['gray', '#868e96'], ['hồng', '#e64980'], ['pink', '#e64980'],
    ['trắng', '#f4f5f7'], ['white', '#f4f5f7'], ['xanh', '#1c6fd6']
  ];

  // ---------- tiện ích ----------
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function r2(x) { return Math.round(x * 100) / 100; }

  // =====================================================================
  // Phần thuần: dữ liệu, hướng nhìn, ghép cáp
  // =====================================================================
  function db() {
    return {
      B: root.CONN_BODIES || {},
      P: root.CONN_PINOUTS || {},
      C: Array.isArray(root.CONN_CABLES) ? root.CONN_CABLES.filter(function (c) { return c && c.id && c.a; }) : []
    };
  }
  function pinoutList() {
    var d = db();
    return Object.keys(d.P).map(function (k) { return d.P[k]; }).filter(function (p) { return p && p.id && Array.isArray(p.pins); });
  }
  function bodyOf(p) { var d = db(); return p ? d.B[p.body] || null : null; }
  function pinoutById(id) { return db().P[id] || null; }
  function cableById(id) { var c = db().C; for (var i = 0; i < c.length; i++) if (c[i].id === id) return c[i]; return null; }
  function gendersOf(body) {
    var g = (body && body.genders) || {};
    return ['male', 'female'].filter(function (k) { return has(g, k); }).concat(Object.keys(g).filter(function (k) { return k !== 'male' && k !== 'female'; }));
  }

  /** Có lật gương ngang so với face.pins không. */
  function mirrored(body, gender, side) {
    var v = body && body.face ? body.face.viewOf : gender;
    return (gender !== v) !== (side === 'solder');
  }
  /** Toạ độ chân của một giới tính, nhìn từ mặt cắm (side 'mate') hoặc phía hàn ('solder'). */
  function facePins(body, gender, side) {
    var f = body.face, m = mirrored(body, gender, side);
    return (f.pins || []).map(function (p) { return { pin: String(p.pin), x: m ? f.w - p.x : p.x, y: p.y }; });
  }
  function faceKeys(body, gender, side) {
    var f = body.face, m = mirrored(body, gender, side);
    return (f.keys || []).map(function (k) { return { x: m ? f.w - k.x - (k.w || 0) : k.x, y: k.y, w: k.w || 0, h: k.h || 0, label: k.label || '' }; });
  }

  /** Chân của pinout sau khi áp biến thể (variant ghi đè từng trường). */
  function mergedPins(p, variantId) {
    var v = null;
    (p.variants || []).forEach(function (x) { if (x && x.id === variantId) v = x; });
    return (p.pins || []).map(function (pin) {
      var o = v && v.pins && v.pins[pin.pin];
      if (!o) return pin;
      var out = {}; Object.keys(pin).forEach(function (k) { out[k] = pin[k]; });
      Object.keys(o).forEach(function (k) { out[k] = o[k]; });
      out._var = true;
      return out;
    });
  }
  function pinMap(pins) { var m = {}; (pins || []).forEach(function (x) { m[String(x.pin)] = x; }); return m; }
  /** chân → { idx, name } của nhóm đầu tiên chứa nó. */
  function groupMap(p) {
    var m = {};
    (p.groups || []).forEach(function (g, i) { (g.pins || []).forEach(function (pin) { if (!m[pin]) m[pin] = { idx: i, name: g.name }; }); });
    return m;
  }
  /** Màu nhóm: tên nhóm nhắc màu dây ("Cặp 2 (cam)") thì dùng màu gần nhất, không thì theo thứ tự. */
  // chỉ bắt màu nằm trong ngoặc, vd "Cặp 2 (cam)", để không nhầm chữ thường ("camera", "shared")
  var NAME_LAYER = [[/\([^)]*(xanh l[áa]|green)/i, 'l3'], [/\([^)]*(xanh (dương|lam)|blue)/i, 'l2'], [/\([^)]*(cam|orange)/i, 'l4'],
    [/\([^)]*(nâu|brown)/i, 'payload'], [/\([^)]*(đỏ|red)/i, 'trailer'], [/\([^)]*(đen|black)/i, 'phy']];
  function groupLayer(name, idx) {
    for (var i = 0; i < NAME_LAYER.length; i++) if (NAME_LAYER[i][0].test(name || '')) return NAME_LAYER[i][1];
    return GROUP_LAYERS[idx % GROUP_LAYERS.length];
  }
  /** Lớp màu cho chân: theo nhóm nếu có, không thì theo hướng. */
  function layerOf(pin, gmap) {
    if (!pin) return 'payload';
    var g = gmap[pin.pin];
    if (g) return groupLayer(g.name, g.idx);
    return DIR_LAYER[pin.dir] || 'phy';
  }
  /** "A5" hoặc tên tín hiệu "VBUS" → id chân của pinout. */
  function resolvePin(p, ref) {
    if (!p || ref == null) return null;
    ref = String(ref);
    var pins = p.pins || [], i;
    for (i = 0; i < pins.length; i++) if (String(pins[i].pin) === ref) return String(pins[i].pin);
    var low = ref.toLowerCase();
    for (i = 0; i < pins.length; i++) if (String(pins[i].signal || '').toLowerCase() === low) return String(pins[i].pin);
    return null;
  }
  /** "b:A5" → { end:'b', pin:'A5' } (chân đã chuẩn hoá theo pinout của đầu đó). */
  function parseRef(c, ref) {
    var m = /^\s*([ab])\s*:\s*(.+)$/.exec(String(ref || ''));
    var end = m ? m[1] : 'a', raw = m ? m[2] : String(ref || '');
    var e = c[end]; if (!e) return null;
    var pin = resolvePin(pinoutById(e.pinout), raw);
    return pin ? { end: end, pin: pin } : null;
  }

  function cablesFor(pinoutId) {
    return db().C.filter(function (c) { return c.a.pinout === pinoutId || (c.b && c.b.pinout === pinoutId); });
  }
  /**
   * Công cụ Chuyển đổi: cáp/đầu chuyển nối pinout a với pinout b (cả hai chiều).
   * exact: khớp đúng pinout; loop: nút thử vòng khi a = b; body: cùng thân đầu nối nhưng khác cách gán chân.
   */
  function convertMatches(a, b) {
    var d = db(), out = { exact: [], loop: [], body: [] };
    var ba = d.P[a] && d.P[a].body, bb = d.P[b] && d.P[b].body;
    d.C.forEach(function (c) {
      if (!c.b) { if (a === b && c.a.pinout === a) out.loop.push({ cable: c, flip: false }); return; }
      if (c.a.pinout === a && c.b.pinout === b) { out.exact.push({ cable: c, flip: false }); return; }
      if (c.a.pinout === b && c.b.pinout === a) { out.exact.push({ cable: c, flip: true }); return; }
      var ca = d.P[c.a.pinout] && d.P[c.a.pinout].body, cb = d.P[c.b.pinout] && d.P[c.b.pinout].body;
      if (ca && cb && ((ca === ba && cb === bb) || (ca === bb && cb === ba))) out.body.push({ cable: c, flip: !(ca === ba && cb === bb) });
    });
    return out;
  }

  /** Chuỗi tìm kiếm cho nav: tên, aka của thân, tên tín hiệu, biến thể… */
  function bodyWords(body) {
    if (!body) return [];
    return [body.id, body.name, body.standard].concat(body.aka || []);
  }
  function pinoutSearch(p) {
    var b = bodyOf(p), hay = [p.id, p.name, p.summary, p.standard, p.role, (FAMILY[p.family] || {}).name, 'sơ đồ chân pinout'].concat(bodyWords(b));
    (p.pins || []).forEach(function (x) { hay.push(x.signal, x.name, x.v24, x.color); });
    (p.variants || []).forEach(function (v) {
      hay.push(v.name, v.note);
      Object.keys(v.pins || {}).forEach(function (k) { hay.push(v.pins[k].signal, v.pins[k].name); });
    });
    return hay.filter(Boolean).join(' \u0001 ');
  }
  function cableSearch(c) {
    var hay = [c.id, c.name, c.use, c.standard, c.detail, (KIND[c.kind] || {}).name, c.kind, 'cáp chuyển đổi cable adapter', c.vendor ? 'theo hãng vendor' : ''];
    ['a', 'b'].forEach(function (e) {
      if (!c[e]) return;
      var p = pinoutById(c[e].pinout);
      hay.push(c[e].label, p && p.name);
      hay = hay.concat(bodyWords(bodyOf(p)));
    });
    (c.wires || []).forEach(function (w) { hay.push(w.note); });
    (c.components || []).forEach(function (x) { hay.push(x.type, x.value, x.note); });
    return hay.filter(Boolean).join(' \u0001 ');
  }

  /** Mô hình cây điều hướng; nav.js dựng mục từ đây (giữ nav.js không biết schema đấu nối). */
  function navModel() {
    var d = db(), pins = pinoutList(), fams = {}, seen = {};
    if (!pins.length && !d.C.length) return null;
    function fam(k) {
      return fams[k] || (fams[k] = { key: k, name: (FAMILY[k] || { name: k }).name, order: (FAMILY[k] || { order: 9 }).order, pinouts: [], cables: [] });
    }
    pins.forEach(function (p) {
      if (p.id === 'convert' || seen[p.id]) return;
      seen[p.id] = 'pinout';
      var b = bodyOf(p);
      fam(p.family || (b && b.family) || 'khác').pinouts.push({ id: p.id, name: p.name || p.id, meta: p.role || '',
        search: pinoutSearch(p), tip: (b ? b.name + ' · ' : '') + (p.standard || '') });
    });
    d.C.forEach(function (c) {
      if (c.id === 'convert' || seen[c.id]) return; // id trùng pinout: bỏ (validator phải bắt)
      seen[c.id] = 'cable';
      fam(c.family || 'khác').cables.push({ id: c.id, name: c.name || c.id, meta: (KIND[c.kind] || { short: c.kind || '' }).short,
        search: cableSearch(c), tip: c.use || '' });
    });
    var list = Object.keys(fams).map(function (k) { return fams[k]; }).sort(function (x, y) { return x.order - y.order; });
    return {
      convert: { id: 'convert', name: 'Chuyển đổi (tìm cáp chế)', search: 'chuyển đổi converter adapter đầu chuyển cáp chế hàn tìm cáp nối hai đầu', tip: 'Chọn hai đầu → cáp/đầu chuyển thụ động có sẵn' },
      families: list,
      count: pins.length + d.C.length
    };
  }

  // =====================================================================
  // Hình học mặt cắm (toạ độ của chính face; vẽ SVG)
  // =====================================================================
  /** Bán kính chân: theo khoảng cách nhỏ nhất giữa hai chân (bỏ chân vỏ S). */
  function pinRadius(pins, w, h) {
    var pts = pins.filter(function (p) { return !p.shell; }), d = Infinity;
    for (var i = 0; i < pts.length; i++) for (var j = i + 1; j < pts.length; j++) {
      var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dd = Math.sqrt(dx * dx + dy * dy);
      if (dd > 0 && dd < d) d = dd;
    }
    if (!isFinite(d)) d = Math.min(w, h) / 2;
    return Math.max(0.8, Math.min(d * 0.4, Math.min(w, h) * 0.2));
  }
  function bbox(pins) {
    var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    pins.forEach(function (p) { if (p.shell) return; b.x0 = Math.min(b.x0, p.x); b.x1 = Math.max(b.x1, p.x); b.y0 = Math.min(b.y0, p.y); b.y1 = Math.max(b.y1, p.y); });
    return isFinite(b.x0) ? b : null;
  }
  function poly(pts, cls) { return '<polygon class="' + cls + '" points="' + pts.map(function (p) { return r2(p[0]) + ',' + r2(p[1]); }).join(' ') + '"/>'; }
  function rect(x, y, w, h, rx, cls) { return '<rect class="' + cls + '" x="' + r2(x) + '" y="' + r2(y) + '" width="' + r2(w) + '" height="' + r2(h) + '" rx="' + r2(rx) + '"/>'; }
  function circ(x, y, r, cls) { return '<circle class="' + cls + '" cx="' + r2(x) + '" cy="' + r2(y) + '" r="' + r2(r) + '"/>'; }
  /** Lưỡi nhựa mang tiếp điểm (USB): hình chữ nhật bao các chân. */
  function tongue(pins, r, rx) {
    if (tongue.off) return '';
    var b = bbox(pins); if (!b) return '';
    var px = r * 1.7, py = r * 2.0, h = b.y1 - b.y0 + 2 * py;
    return rect(b.x0 - px, b.y0 - py, b.x1 - b.x0 + 2 * px, h, rx ? Math.min(h / 2, rx) : r * 0.4, 'cf-ins');
  }

  /**
   * Vẽ khung mặt cắm. Trả về { vb:[x,y,w,h], outline, pins:[{pin,x,y}], r, shape }.
   * pinout (tuỳ chọn) chỉ dùng cho BNC để biết chân nào là tâm.
   */
  function faceGeom(body, gender, side, pinout) {
    var f = body.face || {}, w = +f.w || 100, h = +f.h || 40, o = f.outline;
    // chân vỏ: quyết định theo dir "shield" của pinout, KHÔNG theo tên chân (m34 có chân tên "S" là tín hiệu SD B)
    var pmS = pinout ? pinMap(pinout.pins) : null;
    var pins = facePins(body, gender, side).map(function (p) { p.shell = pmS ? !!(pmS[p.pin] && pmS[p.pin].dir === 'shield') : p.pin === 'S'; return p; });
    var keys = faceKeys(body, gender, side);
    tongue.off = !!(BLADE[o] && o !== 'rj' && keys.length); // USB: lưỡi nhựa đã có trong keys
    var r = pinRadius(pins, w, h), s = '', vb = [-2, -2, w + 4, h + 4];
    var inner = pins.filter(function (p) { return !p.shell; });
    var c;
    if (o === 'dsub') {
      // hình thang: cạnh dài ở phía hàng ngoài cùng có nhiều chân hơn (so hàng trên cùng với hàng dưới cùng,
      // để D-sub 3 hàng 5/5/5 như DE-15 vẫn đúng: bằng nhau → cạnh dài ở trên)
      var ys = inner.map(function (p) { return p.y; }), yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
      var top = inner.filter(function (p) { return p.y - yMin < r; }).length, bot = inner.filter(function (p) { return yMax - p.y < r; }).length;
      var k = h * 0.22, i = h * 0.07;
      var fx = h * 0.62, fy = h * 0.24;
      s += rect(-fx, -fy, w + 2 * fx, h + 2 * fy, h * 0.12, 'cf-flange');
      s += circ(-fx * 0.52, h / 2, h * 0.13, 'cf-hole') + circ(w + fx * 0.52, h / 2, h * 0.13, 'cf-hole');
      var wideTop = top >= bot;
      s += poly(wideTop ? [[0, 0], [w, 0], [w - k, h], [k, h]] : [[k, 0], [w - k, 0], [w, h], [0, h]], 'cf-shell');
      s += poly(wideTop ? [[i * 1.2, i], [w - i * 1.2, i], [w - k - i * 0.8, h - i], [k + i * 0.8, h - i]]
        : [[k + i * 0.8, i], [w - k - i * 0.8, i], [w - i * 1.2, h - i], [i * 1.2, h - i]], 'cf-ins');
      vb = [-fx - 2, -fy - 2, w + 2 * fx + 4, h + 2 * fy + 4];
    } else if (o === 'rj') {
      s += rect(0, 0, w, h, Math.min(w, h) * 0.05, 'cf-shell') + rect(w * 0.06, h * 0.08, w * 0.88, h * 0.84, Math.min(w, h) * 0.03, 'cf-ins');
      if (!keys.length) { // mặc định: khe lẫy ở phía không có tiếp điểm
        var b0 = bbox(pins), lw = w * 0.3, lh = h * 0.2;
        keys.push({ x: (w - lw) / 2, y: b0 && b0.y0 < h / 2 ? h - lh : 0, w: lw, h: lh, label: 'lẫy' });
      }
    } else if (o === 'usb-a') {
      s += rect(0, 0, w, h, Math.min(w, h) * 0.06, 'cf-shell') + tongue(pins, r);
    } else if (o === 'usb-b') {
      c = Math.min(w, h) * 0.22;
      s += poly([[c, 0], [w - c, 0], [w, c], [w, h], [0, h], [0, c]], 'cf-shell') + tongue(pins, r);
    } else if (o === 'usb-b-ss') {
      s += poly([[0.2 * w, 0], [0.8 * w, 0], [0.8 * w, 0.32 * h], [0.88 * w, 0.32 * h], [w, 0.45 * h], [w, h], [0, h], [0, 0.45 * h], [0.12 * w, 0.32 * h], [0.2 * w, 0.32 * h]], 'cf-shell') + tongue(pins, r);
    } else if (o === 'usb-mini-b' || o === 'usb-micro-b' || o === 'usb-micro-b-ss') {
      c = o === 'usb-mini-b' ? Math.min(h * 0.45, w * 0.15) : Math.min(h * 0.3, w * 0.1);
      s += poly([[0, 0], [w, 0], [w, h - c], [w - c, h], [c, h], [0, h - c]], 'cf-shell');
      if (o === 'usb-micro-b-ss') { // hai khối: micro-B 2.0 + phần SuperSpeed, tách ở khe rộng nhất
        var xs = inner.map(function (p) { return p.x; }).sort(function (a, b) { return a - b; }), gx = null, gap = 0;
        for (var q = 1; q < xs.length; q++) if (xs[q] - xs[q - 1] > gap) { gap = xs[q] - xs[q - 1]; gx = (xs[q] + xs[q - 1]) / 2; }
        var left = inner.filter(function (p) { return p.x < gx; }), right = inner.filter(function (p) { return p.x >= gx; });
        s += tongue(left, r) + tongue(right, r);
        if (gx != null) s += '<line class="cf-split" x1="' + r2(gx) + '" y1="' + r2(h * 0.05) + '" x2="' + r2(gx) + '" y2="' + r2(h * 0.95) + '"/>';
      } else s += tongue(pins, r);
    } else if (CHAMFER2[o]) {
      // HDMI A/C/D, Mini DP: hình thang, cạnh rộng ở trên, vát hai góc dưới; lưỡi nhựa mang tiếp điểm ở giữa
      c = Math.min(h * CHAMFER2[o], w * 0.2);
      s += poly([[0, 0], [w, 0], [w, h - c], [w - c, h], [c, h], [0, h - c]], 'cf-shell') + tongue(pins, r);
    } else if (o === 'dp') {
      // DisplayPort: chữ nhật vát MỘT góc (bất đối xứng ⇒ phải lật theo gương như chân)
      c = Math.min(h * 0.32, w * 0.2);
      var cn = dpCorner(body, keys, mirrored(body, gender, side));
      var pts = [[0, 0], [w, 0], [w, h], [0, h]], ci = { tl: 0, tr: 1, br: 2, bl: 3 }[cn];
      var cx = ci === 0 || ci === 3 ? 0 : w, cy = ci < 2 ? 0 : h, sx = cx ? -1 : 1, sy = cy ? -1 : 1;
      // thay góc bằng hai điểm vát theo chiều kim đồng hồ
      var cut = ci % 2 === 0 ? [[cx, cy + sy * c], [cx + sx * c, cy]] : [[cx + sx * c, cy], [cx, cy + sy * c]];
      pts.splice.apply(pts, [ci, 1].concat(cut));
      s += poly(pts, 'cf-shell') + tongue(pins, r);
    } else if (o === 'dvi') {
      s += dviOutline(inner, w, h, r, keys.length > 0);
    } else if (o === 'usb-c') {
      s += rect(0, 0, w, h, h / 2, 'cf-shell') + tongue(pins, r, h);
    } else if (o === 'bnc') {
      s += rect(0, 0, w, h, Math.min(w, h) * 0.08, 'cf-plate');
      bncPairs(inner, pinout).forEach(function (pr) {
        var d = pr.d;
        s += circ(pr.c.x, pr.c.y, d + r * 0.6, 'cf-shell') + circ(pr.c.x, pr.c.y, d, 'cf-ring') + circ(pr.c.x, pr.c.y, d * 0.62, 'cf-ins');
      });
    } else if (o === 'terminal') {
      s += rect(0, 0, w, h, Math.min(w, h) * 0.05, 'cf-ins');
      inner.forEach(function (p) { s += rect(p.x - r * 1.5, p.y - r * 1.5, r * 3, r * 3, r * 0.3, 'cf-cell'); });
    } else { // m34 và mặc định
      s += rect(0, 0, w, h, Math.min(w, h) * 0.06, 'cf-ins');
    }
    keys.forEach(function (k) {
      // khoá "góc vát" của DP chỉ để định góc + chú thích: không vẽ khung đè lên góc đã vát
      if (!(o === 'dp' && CHAMFER_RE.test(k.label))) s += rect(k.x, k.y, k.w, k.h, Math.min(k.w, k.h) * 0.15, tongue.off ? 'cf-key cf-key--ins' : 'cf-key');
      // nhãn chốt/lưỡi: chỉ in chữ khi vùng đó không chứa chân (không thì chữ nằm dưới chân, khó đọc); lời giải thích có trong orientation
      var covers = inner.some(function (p) { return p.x >= k.x && p.x <= k.x + k.w && p.y >= k.y && p.y <= k.y + k.h; });
      if (k.label && !covers) s += '<text class="cf-keyl" x="' + r2(k.x + k.w / 2) + '" y="' + r2(k.y + k.h / 2) + '" font-size="' + r2(Math.max(2, Math.min(k.h * 0.55, h * 0.09))) + '">' + esc(k.label) + '</text>';
    });
    var shape = o === 'terminal' ? 'screw' : (BLADE[o] ? 'blade' : 'round');
    if (o === 'dvi') dviBlade(inner, r);
    return { vb: vb, outline: s, pins: pins, r: r, shape: shape, w: w, h: h, keys: keys, outlineKind: o };
  }

  var CHAMFER_RE = /vát|chamfer/i;
  /**
   * Góc vát của DP ('tl'|'tr'|'br'|'bl') trên hình đang vẽ: theo key có nhãn "vát" (key đã được lật gương cùng chân);
   * không có key → mặc định dưới-phải ở hình gốc (viewOf, mặt cắm), lật trái/phải khi hình là ảnh gương.
   */
  function dpCorner(body, keys, mir) {
    var f = body.face || {}, w = +f.w || 100, h = +f.h || 40;
    var k = keys.filter(function (x) { return CHAMFER_RE.test(x.label); })[0];
    if (k) return (k.y + k.h / 2 < h / 2 ? 't' : 'b') + (k.x + k.w / 2 < w / 2 ? 'l' : 'r');
    return mir ? 'bl' : 'br';
  }
  /** Chân "C…" của DVI (vùng analog quanh lưỡi dẹt); chân gần tâm vùng nhất là lưỡi dẹt (C5). */
  function dviCPins(inner) {
    var cs = inner.filter(function (p) { return /^C\d+$/i.test(p.pin); });
    if (cs.length < 2) return { cs: cs, blade: null };
    var mx = 0, my = 0; cs.forEach(function (p) { mx += p.x / cs.length; my += p.y / cs.length; });
    var blade = cs.slice().sort(function (a, b) { return Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my); })[0];
    return { cs: cs, blade: blade };
  }
  /** Vỏ DVI: mặt bích + 2 lỗ vít, vỏ chữ D (vát hai góc dưới), lõi nhựa; vùng C1–C4 là khe chữ thập quanh lưỡi C5. */
  function dviOutline(inner, w, h, r, hasKeys) {
    var fx = h * 0.5, fy = h * 0.2, c = h * 0.28, i = h * 0.07, s = '';
    s += rect(-fx, -fy, w + 2 * fx, h + 2 * fy, h * 0.1, 'cf-flange');
    s += circ(-fx * 0.52, h / 2, h * 0.12, 'cf-hole') + circ(w + fx * 0.52, h / 2, h * 0.12, 'cf-hole');
    s += poly([[0, 0], [w, 0], [w, h - c], [w - c, h], [c, h], [0, h - c]], 'cf-shell');
    s += poly([[i, i], [w - i, i], [w - i, h - c - i * 0.4], [w - c - i * 0.4, h - i], [c + i * 0.4, h - i], [i, h - c - i * 0.4]], 'cf-ins');
    var d = dviCPins(inner);
    if (d.blade && d.cs.length > 1 && !hasKeys) { // dữ liệu đã vẽ khe bằng keys thì không vẽ chồng
      var o = d.cs.filter(function (p) { return p !== d.blade; });
      var x0 = Math.min.apply(null, o.map(function (p) { return p.x; })), x1 = Math.max.apply(null, o.map(function (p) { return p.x; }));
      var y0 = Math.min.apply(null, o.map(function (p) { return p.y; })), y1 = Math.max.apply(null, o.map(function (p) { return p.y; }));
      var b = d.blade, pad = r * 1.4, t = r * 1.1;
      // chữ thập: thanh ngang chứa lưỡi C5 + thanh đứng; bốn chân C quanh tâm
      s += rect(x0 - pad, b.y - t, x1 - x0 + 2 * pad, 2 * t, t * 0.4, 'cf-key cf-key--ins cf-cross') +
        rect(b.x - t, y0 - pad, 2 * t, y1 - y0 + 2 * pad, t * 0.4, 'cf-key cf-key--ins cf-cross');
    }
    return s;
  }
  /** Đánh dấu lưỡi dẹt C5 của DVI: chân vẽ thành thanh ngang (nửa dài hu, nửa dày hv theo đơn vị face). */
  function dviBlade(inner, r) {
    var d = dviCPins(inner); if (!d.blade || d.cs.length < 2) return;
    var o = d.cs.filter(function (p) { return p !== d.blade; });
    var span = Math.max.apply(null, o.map(function (p) { return p.x; })) - Math.min.apply(null, o.map(function (p) { return p.x; }));
    d.blade.flat = { hu: Math.max(r * 1.6, span * 0.42), hv: r * 0.55 };
  }

  /** BNC: ghép chân thành cặp (tâm, vỏ) theo khoảng cách gần nhất; tâm = chân không phải đất/vỏ. */
  function bncPairs(pins, pinout) {
    var pm = pinout ? pinMap(pinout.pins) : {}, left = pins.slice(), out = [];
    function isShell(p) { var x = pm[p.pin]; return x && (x.dir === 'gnd' || x.dir === 'shield'); }
    while (left.length) {
      var a = left.shift(), bi = -1, bd = Infinity;
      left.forEach(function (b, i) { var dd = Math.hypot(a.x - b.x, a.y - b.y); if (dd < bd) { bd = dd; bi = i; } });
      if (bi < 0) { out.push({ c: a, d: 6 }); break; }
      var b = left.splice(bi, 1)[0];
      out.push({ c: isShell(a) && !isShell(b) ? b : a, d: bd });
    }
    return out;
  }

  // =====================================================================
  // Phối cảnh cắm (hình nghiêng 3/4), phần hình học thuần
  // ---------------------------------------------------------------------
  // Trục cắm là X (ngang). Mỗi mặt cắm nằm trên mặt phẳng đứng (Y lên, Z hướng về người xem).
  //  - Mặt quay sang PHẢI (pháp tuyến n = +1) vẽ với chiều sâu lùi lên-phải;
  //    mặt quay sang TRÁI (n = -1) lùi lên-trái — như hai bức tường hành lang nhìn từ đầu hành lang,
  //    nên thấy được cả hai mặt cắm đang úp vào nhau.
  //  - Người đứng trước mặt n = +1 (nhìn về -X) có tay phải chỉ về -Z (xa) ⇒ trục u của hình
  //    "nhìn từ mặt cắm" chạy ra xa; với mặt n = -1 trục u chạy lại gần.
  //    Độ xa t = u - x0 (n = +1) hoặc x1 - u (n = -1), x0/x1 là mép viewBox của face (đối xứng quanh w/2).
  //  - Hai chân chạm nhau khi cắm có cùng (z, y) ⇒ cùng t, cùng v ⇒ trên màn hình đối xứng gương qua
  //    trục giữa hai mặt (cùng y, x_trái + x_phải = 2·C). Test kiểm đúng điều này cho mọi thân.
  // =====================================================================
  var PV = { k: 0.8, slope: 0.3, maxH: 116, maxL: 210, wideL: 280, body: 86, boot: 26, gap: 150, devLen: 72 };
  /** Tỉ lệ px / đơn vị face sao cho mặt không quá cao và chiều sâu vẽ không quá dài. */
  function perspScale(geo) {
    var vw = geo.vb[2], vh = geo.vb[3], maxL = vw / vh > 3 ? PV.wideL : PV.maxL;
    return Math.min(PV.maxH / vh, maxL / (PV.k * vw));
  }
  /**
   * Đặt hình "nhìn từ mặt cắm" của một mặt lên mặt phẳng nghiêng.
   * O = góc GẦN-TRÊN trên màn hình, n = +1/-1, s = tỉ lệ. m = ma trận SVG (a b c d e f) áp cho toạ độ face.
   */
  function perspFace(geo, n, O, s) {
    var x0 = geo.vb[0], y0 = geo.vb[1], x1 = x0 + geo.vb[2], ax = PV.k * s, ay = PV.slope * s;
    var m = n > 0 ? [ax, -ay, 0, s, O.x - ax * x0, O.y + ay * x0 - s * y0]
      : [ax, ay, 0, s, O.x - ax * x1, O.y - ay * x1 - s * y0];
    function P(u, v) { return { x: m[0] * u + m[2] * v + m[4], y: m[1] * u + m[3] * v + m[5] }; }
    return {
      n: n, s: s, m: m, P: P, O: O, geo: geo,
      L: ax * geo.vb[2], A: ay * geo.vb[2], H: s * geo.vb[3], ax: ax, ay: ay,
      center: P(x0 + geo.vb[2] / 2, y0 + geo.vb[3] / 2),
      pins: geo.pins.map(function (p) { var q = P(p.x, p.y); return { pin: p.pin, x: q.x, y: q.y, shell: p.shell, flat: p.flat }; })
    };
  }
  /** Giới tính trên thiết bị (ổ) và ở đầu cáp cho một pinout. */
  function perspGenders(body, pinout) {
    var gs = gendersOf(body), dev = pinout && gs.indexOf(pinout.gender) >= 0 ? pinout.gender : (body.face && body.face.viewOf) || gs[0];
    var plug = gs.filter(function (g) { return g !== dev; })[0] || dev;
    return { plug: plug, dev: dev };
  }
  /**
   * Bố cục cảnh "cầm đầu cáp cắm vào ổ": đầu cáp bên trái (mặt quay phải), ổ trên vỏ thiết bị bên phải.
   * Trả về { W, H, C, plug, dev, wall, ... } — toàn toạ độ màn hình, không phụ thuộc DOM.
   */
  function perspMating(body, plugG, devG, pinout) {
    var gp = faceGeom(body, plugG, 'mate', pinout), gd = faceGeom(body, devG, 'mate', pinout);
    var s = perspScale(gp), ax = PV.k * s, ay = PV.slope * s;
    var vw = gp.vb[2], vh = gp.vb[3], mt = 0.16 * vw, mv = 0.28 * vh;
    var A = ay * vw, L = ax * vw, H = s * vh;
    var Oy = 44 + A + ay * mt + s * mv;
    var Ox = 128 + PV.boot + PV.body, Fx = Ox + 2 * L + PV.gap;
    var plug = perspFace(gp, 1, { x: Ox, y: Oy }, s), dev = perspFace(gd, -1, { x: Fx, y: Oy }, s);
    // tường vỏ thiết bị: rộng hơn mặt ổ mt (sâu) và mv (cao) mỗi phía
    var NT = { x: Fx + ax * mt, y: Oy + ay * mt - s * mv }, WD = vw + 2 * mt, HW = s * (vh + 2 * mv);
    var wall = { NT: NT, WD: WD, HW: HW, dx: ax * WD, dy: ay * WD };
    var bottom = Math.max(Oy + H, NT.y + HW);
    return { W: NT.x + PV.devLen + 14, H: bottom + 108, C: (Ox + Fx) / 2, s: s, plug: plug, dev: dev, wall: wall, bottom: bottom, plugG: plugG, devG: devG };
  }
  /** Bố cục cảnh cáp hai đầu: đầu A bên trái (mặt quay trái), đầu B bên phải (mặt quay phải), dây nối hai thân. */
  function perspCableLayout(bA, gA, pA, bB, gB, pB) {
    var ga = faceGeom(bA, gA, 'mate', pA), gb = faceGeom(bB, gB, 'mate', pB);
    var sa = perspScale(ga), sb = perspScale(gb);
    var La = PV.k * sa * ga.vb[2], Lb = PV.k * sb * gb.vb[2], Aa = PV.slope * sa * ga.vb[2], Ab = PV.slope * sb * gb.vb[2];
    var Oy = 60 + Math.max(Aa, Ab), xA = 92 + La, cable = 200;
    var xB = xA + 2 * (PV.body + PV.boot) + cable;
    var fa = perspFace(ga, -1, { x: xA, y: Oy }, sa), fb = perspFace(gb, 1, { x: xB, y: Oy }, sb);
    var bottom = Math.max(Oy + fa.H, Oy + fb.H);
    return { W: xB + Lb + 92, H: bottom + 84 + 24, a: fa, b: fb, bottom: bottom };
  }

  // =====================================================================
  // Phần vẽ (trình duyệt)
  // =====================================================================
  // Mặc định "Phối cảnh cắm": người mới cần biết mặt nào là mặt nào trước khi đọc hình phẳng (đã lưu lựa chọn thì theo đó)
  var SIDES = ['persp', 'mate', 'solder'];
  var cv = { active: false, kind: null, id: null, sel: null, st: { side: 'persp', variant: {}, conv: {} } };

  function storeGet() { try { var v = localStorage.getItem(STORE_KEY); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(cv.st)); } catch (e) { /* bỏ qua */ } }
  function viewEl() { return document.getElementById('view-conn'); }
  function sideTxt(side) { return side === 'solder' ? 'nhìn từ phía hàn (mặt sau)' : side === 'persp' ? 'phối cảnh cắm' : 'nhìn từ mặt cắm'; }
  /** Góc nhìn dùng cho hình phẳng (phối cảnh → hình phẳng theo mặt cắm). */
  function flatSide(side) { return side === 'solder' ? 'solder' : 'mate'; }
  function genderName(body, g) { var x = body && body.genders && body.genders[g]; return x && x.name ? x.name : (GENDER_SHORT[g] || g); }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function attrQ(s) { return String(s).replace(/["\\]/g, '\\$&'); }

  /** Nhãn hướng của chân (mũi tên + chữ). */
  function dirHtml(pin) {
    var d = DIR[pin && pin.dir];
    if (!d) return '<span class="cdir">' + esc(pin && pin.dir || '–') + '</span>';
    return '<span class="cdir cdir--' + esc(pin.dir) + '" title="' + esc(d.hint) + '"><span aria-hidden="true">' + d.sym + '</span> ' + esc(d.label) + '</span>';
  }
  /** Ô màu dây: sọc nếu "trắng-X". */
  function parseColor(s) {
    if (!s) return null;
    var low = String(s).toLowerCase().trim();
    function find(t) { for (var i = 0; i < WIRE_COLORS.length; i++) if (t.indexOf(WIRE_COLORS[i][0]) >= 0) return WIRE_COLORS[i][1]; return null; }
    var m = /^(trắng|white)\s*[-\/–]\s*(.+)$/.exec(low);
    if (m) { var st = find(m[2]); if (st) return { base: '#f4f5f7', stripe: st }; }
    var b = find(low);
    return b ? { base: b, stripe: null } : null;
  }
  function swatch(color) {
    var c = parseColor(color); if (!c) return '';
    var bg = c.stripe ? 'repeating-linear-gradient(135deg,' + c.base + ' 0 3px,' + c.stripe + ' 3px 6px)' : c.base;
    return '<span class="cwsw" style="background:' + bg + '" aria-hidden="true"></span>';
  }

  /** SVG các chân của một mặt (trong toạ độ face). keyOf(pin) → { k, h } cho highlight. */
  function pinsSvg(g, pm, gmap, gender, label, keyOf, noText) {
    var r = g.r, out = '';
    g.pins.forEach(function (p) {
      var info = pm[p.pin] || { pin: p.pin, dir: 'nc' }, lay = layerOf(info, gmap), kk = keyOf(p.pin);
      var nm = 'Chân ' + p.pin + (info.signal ? ': ' + info.signal : '') + (info.name && info.name !== info.signal ? ' — ' + info.name : '') +
        (DIR[info.dir] ? ' (' + DIR[info.dir].label.toLowerCase() + ')' : '') + ', ' + label;
      var cls = 'cpin layer-' + lay + (info.dir === 'nc' ? ' is-nc' : '') + (info._var ? ' is-var' : '');
      var txt = String(p.pin), shp = '', fs;
      if (p.flat) { // lưỡi dẹt (DVI C5): thanh ngang; đầu cái là khe
        var fw = p.flat.hu * 2, fh = p.flat.hv * 2;
        shp = rect(p.x - fw / 2, p.y - fh / 2, fw, fh, fh * 0.3, 'cp-body') + (gender === 'female' ? rect(p.x - fw * 0.42, p.y - fh * 0.22, fw * 0.84, fh * 0.44, fh * 0.1, 'cp-slot') : '');
        fs = Math.min(fh * 1.6, r * 1.0);
      } else if (p.shell) {
        var sz = r * 1.5;
        shp = rect(p.x - sz / 2, p.y - sz / 2, sz, sz, sz * 0.2, 'cp-body cp-shellpin');
        fs = sz * 0.7;
      } else if (g.shape === 'blade') {
        var bw = r * 1.3, bh = r * 2.4;
        shp = rect(p.x - bw / 2, p.y - bh / 2, bw, bh, bw * 0.25, 'cp-body') + (gender === 'female' ? rect(p.x - bw * 0.22, p.y - bh * 0.36, bw * 0.44, bh * 0.72, bw * 0.1, 'cp-slot') : '');
        fs = Math.min(r * 1.0, bw * 1.75 / Math.max(1, txt.length));
      } else if (g.shape === 'screw') {
        shp = circ(p.x, p.y, r, 'cp-body') + '<line class="cp-slotl" x1="' + r2(p.x - r * 0.6) + '" y1="' + r2(p.y + r * 0.6) + '" x2="' + r2(p.x + r * 0.6) + '" y2="' + r2(p.y - r * 0.6) + '"/>';
        fs = r * (txt.length > 2 ? 0.7 : 0.95);
      } else {
        shp = circ(p.x, p.y, r, 'cp-body') + (gender === 'female' ? circ(p.x, p.y, r * 0.74, 'cp-hole') : '');
        fs = r * (txt.length <= 1 ? 1.15 : txt.length === 2 ? 0.95 : 0.72);
      }
      out += '<g class="' + cls + '" data-k="' + esc(kk.k) + '" data-h="' + esc(kk.h) + '" tabindex="0" role="button" aria-label="' + esc(nm) + '">' +
        '<title>' + esc(nm) + '</title>' + shp +
        (noText ? '' : '<text class="cp-txt" x="' + r2(p.x) + '" y="' + r2(p.y) + '" font-size="' + r2(fs) + '">' + esc(txt) + '</text>') + '</g>';
    });
    return out;
  }

  // ---------- phối cảnh cắm: vẽ ----------
  var perspUid = 0, lastFaces = [];
  function P2(p) { return r2(p.x) + ' ' + r2(p.y); }
  function pg(pts, cls) { return '<polygon class="' + cls + '" points="' + pts.map(function (p) { return r2(p.x) + ',' + r2(p.y); }).join(' ') + '"/>'; }
  function xy(x, y) { return { x: x, y: y }; }
  // cỡ chữ nhãn phối cảnh: ghi thẳng vào thuộc tính để test tính được hộp chữ bằng cùng con số
  var LBL_SIZE = [['cpv-lbl--g', 13], ['cpv-lbl--in', 15], ['cpv-lbl--k', 13], ['cpv-cap--s', 13], ['cpv-cap', 15], ['cpv-eye-l', 14], ['cpv-eye-s', 12], ['cend-tag', 18], ['cpv-lbl', 14]];
  function lblSize(cls) { for (var i = 0; i < LBL_SIZE.length; i++) if ((' ' + cls + ' ').indexOf(' ' + LBL_SIZE[i][0] + ' ') >= 0) return LBL_SIZE[i][1]; return 13; }
  /** Hộp bao ước lượng của một dòng chữ (rộng ≈ 0.62·cỡ chữ mỗi ký tự; y là đường chân chữ). */
  function textBox(x, y, str, size, anchor) {
    var w = String(str).length * 0.62 * size, x0 = anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x;
    return { x0: x0, x1: x0 + w, y0: y - 0.8 * size, y1: y + 0.25 * size };
  }
  function svgText(x, y, s, cls, anchor, size) {
    return '<text class="' + cls + '" x="' + r2(x) + '" y="' + r2(y) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + ' font-size="' + r2(size || lblSize(cls)) + '">' + esc(s) + '</text>';
  }
  /** Hộp bao của mọi <text> do svgText sinh ra trong một đoạn SVG (để chú thích sau tránh chữ trước). */
  function svgTextBoxes(svg) {
    var out = [], re = /<text class="([^"]+)" x="([-\d.]+)" y="([-\d.]+)"(?: text-anchor="(\w+)")? font-size="([\d.]+)">([^<]*)<\/text>/g, m;
    while ((m = re.exec(svg))) {
      if (/cpv-pt/.test(m[1])) continue;
      var t = m[6].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      out.push(textBox(+m[2], +m[3], t, +m[5], m[4]));
    }
    return out;
  }
  /** Cỡ chữ số chân trong phối cảnh. */
  function perspPinFont(F, p) {
    var t = String(p.pin), f = F.geo.r * F.s * (t.length > 2 ? 0.95 : t.length === 2 ? 1.15 : 1.35);
    if (p.shell) f *= 0.8;
    return Math.max(8.5, Math.min(15, f));
  }
  /**
   * Hộp bao trên màn hình của từng chân (thân chân sau phép nghiêng + chữ số chân).
   * hw = nửa bề ngang thân chân (để đường dẫn bắt đầu đúng mép chân).
   */
  function perspPinBoxes(F) {
    var g = F.geo, r = g.r;
    return F.pins.map(function (p) {
      var hu = r, hv = r; // nửa kích thước theo u, v trong toạ độ face
      if (p.flat) { hu = p.flat.hu; hv = p.flat.hv; } else if (p.shell) { hu = hv = r * 0.75; } else if (g.shape === 'blade') { hu = r * 0.65; hv = r * 1.2; }
      var hw = hu * F.ax, hh = hv * F.s + hu * F.ay, f = perspPinFont(F, p), tw = String(p.pin).length * 0.62 * f / 2;
      var bx = Math.max(hw, tw), by = Math.max(hh, f * 0.55);
      return { pin: p.pin, shell: p.shell, x: p.x, y: p.y, hw: hw, hh: hh, x0: p.x - bx, x1: p.x + bx, y0: p.y - by, y1: p.y + by };
    });
  }
  function boxHit(a, b, pad) { pad = pad || 0; return a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad; }
  /** Số hộp bị đường gấp khúc pts (các đoạn ngang/dọc) cắt qua. */
  function routeHits(pts, boxes) {
    var n = 0;
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i], seg = { x0: Math.min(a.x, b.x) - 1, x1: Math.max(a.x, b.x) + 1, y0: Math.min(a.y, b.y) - 1, y1: Math.max(a.y, b.y) + 1 };
      boxes.forEach(function (bx) { if (boxHit(seg, bx, 0.5)) n++; });
    }
    return n;
  }
  /**
   * Lối ra khỏi một mặt cho đường nối chân cùng số, bắt đầu ĐÚNG MÉP thân chân p (hộp pb).
   * dir = +1 nếu khe giữa nằm bên phải (đầu cáp), -1 nếu bên trái (ổ). Thử lần lượt:
   *  ngang về phía khe → lên làn trên → xuống làn dưới → lùi ra mép ngoài rồi lên/xuống làn.
   * Trả về mảng điểm, điểm cuối có x = xg (cột nối trong khe).
   */
  function guideExit(p, pb, dir, F, xg, laneTop, laneBot, boxes) {
    var outX = dir > 0 ? F.O.x - 8 : F.O.x + 8; // mép gần (ngoài cùng, xa khe) của mặt + lề
    var c = [
      [xy(p.x + dir * pb.hw, p.y), xy(xg, p.y)],
      [xy(p.x, p.y - pb.hh), xy(p.x, laneTop), xy(xg, laneTop)],
      [xy(p.x, p.y + pb.hh), xy(p.x, laneBot), xy(xg, laneBot)],
      [xy(p.x - dir * pb.hw, p.y), xy(outX, p.y), xy(outX, laneTop), xy(xg, laneTop)],
      [xy(p.x - dir * pb.hw, p.y), xy(outX, p.y), xy(outX, laneBot), xy(xg, laneBot)]
    ];
    var best = null;
    c.some(function (pts) { var h = routeHits(pts, boxes); if (!best || h < best.h) best = { pts: pts, h: h }; return h === 0; });
    return best.pts;
  }
  /** Đường nối chân q (đầu cáp, trái) ↔ r (ổ, phải) — hai lối ra gặp nhau ở cột xg trong khe. */
  function routeGuide(q, qb, r, rb, F, D, xg, laneTop, laneBot, boxes) {
    var a = guideExit(q, qb, 1, F, xg, laneTop, laneBot, boxes), b = guideExit(r, rb, -1, D, xg, laneTop, laneBot, boxes).reverse();
    var ya = a[a.length - 1].y, yb = b[0].y;
    var pts = Math.abs(ya - yb) < 0.01 ? a.slice(0, -1).concat(b.slice(1)) : a.concat(b);
    return { pts: pts, y: ya, joined: Math.abs(ya - yb) >= 0.01 };
  }
  function markers(id) {
    return '<defs><marker id="' + id + 'i" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path class="cpv-ah-in" d="M0 0 L10 5 L0 10 z"/></marker>' +
      '<marker id="' + id + 's" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path class="cpv-ah-sight" d="M0 0 L10 5 L0 10 z"/></marker></defs>';
  }
  /** Hình con mắt (lòng trắng + tròng lệch về hướng nhìn lx/ly). */
  function eyeShape(x, y, r, lx, ly) {
    return '<path class="cpv-eye-w" d="M' + r2(x - r) + ' ' + r2(y) + ' Q' + r2(x) + ' ' + r2(y - r * 0.95) + ' ' + r2(x + r) + ' ' + r2(y) + ' Q' + r2(x) + ' ' + r2(y + r * 0.95) + ' ' + r2(x - r) + ' ' + r2(y) + ' Z"/>' +
      circ(x + lx * r * 0.3, y + ly * r * 0.18, r * 0.42, 'cpv-eye-i') + circ(x + lx * r * 0.36, y + ly * r * 0.2, r * 0.18, 'cpv-eye-p');
  }
  /** Con mắt bấm được (data-cside → chuyển sang góc nhìn phẳng), kèm tia nhìn tới target. */
  function eyeBtn(id, x, y, side, label, sub, target, above) {
    var lx = target ? Math.sign(target.x - x) : 0, ly = target ? Math.sign(target.y - y) : 0;
    var title = (side === 'solder' ? 'Đứng sau đầu nối, phía dây' : 'Đứng trước mặt cắm') + ' (' + label + ') — bấm để xem hình phẳng ' + (side === 'solder' ? '“Nhìn từ phía hàn”' : '“Nhìn từ mặt cắm”');
    var sight = '';
    if (target) {
      var dx = target.x - x, dy = target.y - y, d = Math.hypot(dx, dy) || 1, st = 20;
      sight = '<path class="cpv-sight" d="M' + r2(x + dx / d * st) + ' ' + r2(y + dy / d * st) + ' L' + P2(target) + '" marker-end="url(#' + id + 's)"/>';
    }
    return sight + '<g class="cpv-eye" data-cside="' + side + '" role="button" tabindex="0" aria-label="' + esc(title) + '"><title>' + esc(title) + '</title>' +
      circ(x, y, 22, 'cpv-eye-hit') + eyeShape(x, y, 15, lx, ly) +
      svgText(x, above ? y - 40 : y + 33, label, 'cpv-eye-l', 'middle') + (sub ? svgText(x, above ? y - 24 : y + 50, sub, 'cpv-eye-s', 'middle') : '') + '</g>';
  }
  /** Mặt cắm đặt nghiêng: viền + thân chân qua ma trận; số chân vẽ đứng thẳng ở toạ độ đã chiếu (dễ đọc). */
  function perspFaceSvg(F, gender, pm, gmap, label, keyOf) {
    var g = F.geo, m = F.m.map(function (v) { return Math.round(v * 1000) / 1000; });
    // chữ chốt/lưỡi trong mặt bị nghiêng và có thể nằm sát chân → bỏ, thay bằng chú thích kéo ra ngoài mặt (keyCallout)
    var outline = g.outline.replace(/<text class="cf-keyl"[^>]*>[^<]*<\/text>/g, '');
    var s = '<g class="cpv-face" transform="matrix(' + m.join(' ') + ')">' + outline + pinsSvg(g, pm, gmap, gender, label, keyOf, true) + '</g>';
    F.pins.forEach(function (p) {
      s += '<text class="cpv-pt layer-' + layerOf(pm[p.pin], gmap) + '" x="' + r2(p.x) + '" y="' + r2(p.y) + '" font-size="' + r2(perspPinFont(F, p)) + '">' + esc(String(p.pin)) + '</text>';
    });
    return s;
  }
  /** y trên màn hình của mép ngang v = vEdge của mặt F tại hoành độ x (kẹp trong bề ngang mặt). */
  function edgeYAt(F, vEdge, x) {
    var g = F.geo, a = F.P(g.vb[0], vEdge), b = F.P(g.vb[0] + g.vb[2], vEdge);
    var t = Math.max(0, Math.min(1, (x - a.x) / ((b.x - a.x) || 1)));
    return a.y + (b.y - a.y) * t;
  }
  /**
   * Chú thích chốt/lưỡi (key đầu tiên có nhãn). Key ở nửa trên → nhãn phía trên mặt, nửa dưới → phía dưới.
   * Đường dẫn thẳng đứng (trên màn hình = cùng u trong face) đi từ MÉP key ra mép mặt; thử nhiều cột trong bề ngang
   * key và chọn cột không cắt chân nào. gapOut = khoảng cách nhãn ngoài mép mặt.
   * avoid (tuỳ chọn): mảng hộp cần tránh (đường chân 1, chữ khác) — nhãn được đẩy ra xa thêm; hộp nhãn được thêm vào avoid.
   */
  function keyCallout(F, gapOut, skipRj, avoid) {
    var g = F.geo; if (skipRj && g.outlineKind === 'rj') return '';
    var labelled = (g.keys || []).filter(function (x) { return x.label; }); if (!labelled.length) return '';
    var boxes = perspPinBoxes(F), ts = [], k = null, top, fy, best = null;
    for (var i = 0; i <= 50; i++) ts.push(i / 50);
    ts.sort(function (x, y) { return Math.abs(x - 0.5) - Math.abs(y - 0.5); });
    // key có nhãn đầu tiên kéo được đường dẫn ra mép mặt mà không cắt chân; key bị chân vây kín (vd. lưỡi C5 của DVI) thì bỏ qua
    labelled.some(function (kk) {
      var tp = kk.y + kk.h / 2 < g.vb[1] + g.vb[3] / 2, fyy = tp ? g.vb[1] : g.vb[1] + g.vb[3], ky = tp ? kk.y : kk.y + kk.h, hit = null;
      ts.some(function (t) {
        var u = kk.x + kk.w * t, a = F.P(u, ky), e = F.P(u, fyy), seg = { x0: a.x - 1, x1: a.x + 1, y0: Math.min(a.y, e.y), y1: Math.max(a.y, e.y) };
        if (!boxes.some(function (b) { return boxHit(seg, b, 1.5); })) { hit = { a: a, e: e, ok: true }; return true; }
        return false;
      });
      if (hit) { k = kk; top = tp; fy = fyy; best = hit; }
      return !!hit;
    });
    if (!k) return '';
    // mép mặt nghiêng: chữ nằm ngang nên lấy mép cao nhất (trên) / thấp nhất (dưới) trong bề rộng chữ
    var a = best.a, tw = k.label.length * 0.62 * lblSize('cpv-lbl--k') / 2 + 4;
    var e0 = edgeYAt(F, fy, a.x - tw), e1 = edgeYAt(F, fy, a.x + tw);
    var ly = top ? Math.min(e0, e1) - gapOut - 3 : Math.max(e0, e1) + gapOut + 10;
    if (avoid) {
      for (var step = 0; step < 30; step++) {
        var tb = textBox(a.x, ly, k.label, lblSize('cpv-lbl--k'), 'middle');
        if (!avoid.some(function (b) { return boxHit(tb, b, 2); })) break;
        ly += top ? -4 : 4;
      }
      avoid.push(textBox(a.x, ly, k.label, lblSize('cpv-lbl--k'), 'middle'));
    }
    return '<g class="cpv-callout"><path class="cpv-lead" d="M' + P2(a) + ' L' + r2(a.x) + ' ' + r2(top ? ly + 4 : ly - 13) + '"/>' + circ(a.x, a.y, 2.5, 'cpv-dot') +
      svgText(a.x, ly, k.label, 'cpv-lbl cpv-lbl--k', 'middle') + '</g>';
  }
  /** Lẫy gài RJ trên thân đầu cáp: cùng phía với khe lẫy của ổ (theo key của mặt). */
  function latchSvg(F, back) {
    var g = F.geo; if (g.outlineKind !== 'rj') return '';
    var k = (g.keys || [])[0], top = k ? k.y + k.h / 2 < g.h / 2 : false;
    var n = F.n, O = F.O, d = -n, len = Math.abs(back - O.x) * 0.62, x0 = (O.x + back) / 2 + d * len * -0.35;
    var p1, p2, p3, p4, lbl;
    if (top) {
      var by = O.y - F.A * 0.5, bx = x0 + n * F.L * 0.5;
      p1 = xy(bx, by + 2); p2 = xy(bx + d * len, by - 18); p3 = xy(bx + d * len, by - 11); p4 = xy(bx, by + 8);
      lbl = svgText(bx + d * len * 0.5, by - 22, 'lẫy gài (ấn để rút)', 'cpv-lbl cpv-lbl--k', 'middle');
    } else {
      var yy = O.y + F.H;
      p1 = xy(x0, yy - 2); p2 = xy(x0 + d * len, yy + 16); p3 = xy(x0 + d * len, yy + 9); p4 = xy(x0, yy - 8);
      lbl = svgText(x0 + d * len * 0.5, yy + 30, 'lẫy gài (ấn để rút)', 'cpv-lbl cpv-lbl--k', 'middle');
    }
    return '<g class="cpv-latch-g"><title>Lẫy gài nhựa: nằm cùng phía với khe lẫy trên ổ cắm</title>' + pg([p1, p2, p3, p4], 'cpv-latch') + lbl + '</g>';
  }
  /** Thân đầu cáp (hộp) phía sau mặt cắm + ống chống gập; trả về điểm cuối ống để nối dây cáp. */
  function plugBody(F) {
    var n = F.n, O = F.O, H = F.H, d = -n, back = O.x + d * PV.body;
    var yb = O.y + H * 0.5 - F.A * 0.25, hb = Math.min(H * 0.32, 22), hc = 7, be = xy(back + d * PV.boot, yb);
    var s = '<path class="cpv-boot" d="M' + r2(back) + ' ' + r2(yb - hb) + ' L' + r2(be.x) + ' ' + r2(yb - hc) + ' L' + r2(be.x) + ' ' + r2(yb + hc) + ' L' + r2(back) + ' ' + r2(yb + hb) + ' Z"/>';
    s += pg([O, xy(back, O.y), xy(back + n * F.L, O.y - F.A), xy(O.x + n * F.L, O.y - F.A)], 'cpv-top');
    s += pg([O, xy(back, O.y), xy(back, O.y + H), xy(O.x, O.y + H)], 'cpv-body');
    return { svg: s, bootEnd: be, back: back, yb: yb };
  }
  function cablePath(d, cls) { return '<path class="cpv-cable-o" d="' + d + '"/><path class="cpv-cable' + (cls ? ' ' + cls : '') + '" d="' + d + '"/>'; }

  /**
   * Cảnh "cầm đầu cáp cắm vào ổ": ctx = { b, pinout, pm, gmap, keyOf(pin)→{k,h}, plug, dev, plugCap, devCap }.
   * Đường nét đứt nối hai chân cùng số (chân 1 luôn hiện, chân khác hiện khi rê chuột).
   */
  function perspMatingSvg(ctx) {
    var Lay = perspMating(ctx.b, ctx.plug, ctx.dev, ctx.pinout), F = Lay.plug, D = Lay.dev, w = Lay.wall, id = 'cpv' + (++perspUid);
    lastFaces = [F, D];
    var NT = w.NT, FT = xy(NT.x - w.dx, NT.y - w.dy), NB = xy(NT.x, NT.y + w.HW), FB = xy(FT.x, FT.y + w.HW);
    var s = markers(id);
    // dây cáp đi ra phía sau đầu cáp, vòng xuống như đang cầm trên tay
    var pb = plugBody(F), be = pb.bootEnd;
    s += cablePath('M' + P2(be) + ' C' + r2(be.x - 60) + ' ' + r2(be.y) + ' ' + r2(40) + ' ' + r2(be.y + 20) + ' ' + r2(-4) + ' ' + r2(be.y + 74));
    s += pb.svg;
    // vỏ thiết bị: mặt trước, nóc, tường trái có ổ
    s += pg([NT, xy(NT.x + PV.devLen, NT.y), xy(NT.x + PV.devLen - w.dx, NT.y - w.dy), FT], 'cpv-devtop') +
      rect(NT.x, NT.y, PV.devLen, w.HW, 0, 'cpv-dev') + pg([NT, FT, FB, NB], 'cpv-wall');
    s += perspFaceSvg(F, ctx.plug, ctx.pm, ctx.gmap, 'đầu cáp (' + (GENDER_SHORT[ctx.plug] || ctx.plug) + ')', ctx.keyOf);
    s += perspFaceSvg(D, ctx.dev, ctx.pm, ctx.gmap, 'ổ trên thiết bị (' + (GENDER_SHORT[ctx.dev] || ctx.dev) + ')', ctx.keyOf);
    // đường dẫn chân cùng số
    var dm = {}; D.pins.forEach(function (q) { dm[q.pin] = q; });
    var first = ((ctx.pinout && ctx.pinout.pins) || []).map(function (x) { return String(x.pin); }).filter(function (pin) {
      return F.pins.some(function (q) { return q.pin === pin && !q.shell; });
    })[0];
    var bxF = perspPinBoxes(F), bxD = perspPinBoxes(D), all = bxF.concat(bxD);
    var boxOf = function (bx, pin) { for (var i = 0; i < bx.length; i++) if (bx[i].pin === pin) return bx[i]; return { hw: 0, hh: 0 }; };
    // làn vòng: ngay trên mép xa-trên của hai mặt / ngay dưới mép gần-dưới; cột nối xg sát tường vỏ (chừa chỗ cho nhãn)
    var laneTop = Math.min(F.O.y - F.A, D.O.y - D.A) - 7, laneBot = Math.max(F.O.y + F.H, D.O.y + D.H) + 7;
    var gapL = F.O.x + F.L, gapR = FT.x, xg = gapR - 10;
    var guides = '', firstLbl = '', avoid = [];
    F.pins.forEach(function (q) {
      var r = dm[q.pin]; if (!r) return;
      var isF = q.pin === first, others = all.filter(function (b) { return b.pin !== q.pin; });
      var rt = routeGuide(q, boxOf(bxF, q.pin), r, boxOf(bxD, q.pin), F, D, isF ? xg : (gapL + gapR) / 2, laneTop, laneBot, others);
      guides += '<path class="cpv-guide' + (isF ? ' is-first' : '') + '" data-k="' + esc(ctx.keyOf(q.pin).h) + '" d="M' + rt.pts.map(P2).join(' L') + '"/>';
      if (!isF) return;
      for (var i = 1; i < rt.pts.length; i++) {
        var a = rt.pts[i - 1], b = rt.pts[i];
        avoid.push({ x0: Math.min(a.x, b.x) - 1, x1: Math.max(a.x, b.x) + 1, y0: Math.min(a.y, b.y) - 1, y1: Math.max(a.y, b.y) + 1 });
      }
      // nhãn trong khe, sát phía trên đoạn ngang phía đầu cáp (phía dưới nếu đoạn đó là làn dưới), lệch trái cột nối
      var lt = 'chân ' + q.pin + ' ↔ ' + q.pin, ly = rt.y === laneBot ? rt.y + 16 : rt.y - 7, lx = xg - 6;
      firstLbl = svgText(lx, ly, lt, 'cpv-lbl cpv-lbl--g', 'end');
      avoid.push(textBox(lx, ly, lt, lblSize('cpv-lbl--g'), 'end'));
    });
    s += '<g class="cpv-guides">' + guides + '</g>' + firstLbl;
    // mũi tên hướng cắm, phía trên khe giữa hai mặt (trên làn trên)
    var ay = Math.min(F.O.y - F.A, FT.y) - 12, x1 = gapL - 6, x2 = gapR - 6;
    if (x2 - x1 < 40) { x1 = Lay.C - 30; x2 = Lay.C + 30; }
    s += '<path class="cpv-insert" d="M' + r2(x1) + ' ' + r2(ay) + ' L' + r2(x2) + ' ' + r2(ay) + '" marker-end="url(#' + id + 'i)"/>' +
      svgText((x1 + x2) / 2, ay - 9, 'hướng cắm', 'cpv-lbl cpv-lbl--in', 'middle');
    avoid.push(textBox((x1 + x2) / 2, ay - 9, 'hướng cắm', lblSize('cpv-lbl--in'), 'middle'), { x0: x1, x1: x2 + 6, y0: ay - 3, y1: ay + 3 });
    s += keyCallout(F, 12, true, avoid) + keyCallout(D, Lay.s * 0.28 * D.geo.vb[3] + 6, false, avoid);
    var latch = latchSvg(F, pb.back);
    s += latch;
    // đáy thật của cảnh: tính cả chú thích/lẫy nằm dưới mặt → nhãn, con mắt đặt dưới đó
    var lowest = Lay.bottom;
    avoid.forEach(function (b) { if (b.y1 > lowest && b.y0 > F.O.y) lowest = b.y1; });
    var lm = /class="cpv-lbl cpv-lbl--k" x="[-\d.]+" y="([-\d.]+)"/.exec(latch); if (lm) lowest = Math.max(lowest, +lm[1] + 4);
    var cx = F.O.x - PV.body / 2, by = lowest + 20;
    s += svgText(cx, by, ctx.plugCap[0], 'cpv-cap', 'middle') + svgText(cx, by + 18, ctx.plugCap[1], 'cpv-cap cpv-cap--s', 'middle');
    s += svgText(Lay.W - 8, by, ctx.devCap[0], 'cpv-cap', 'end') + svgText(Lay.W - 8, by + 18, ctx.devCap[1], 'cpv-cap cpv-cap--s', 'end');
    // hai con mắt
    var ey = lowest + 44;
    s += eyeBtn(id, Lay.C, ey, 'mate', 'Nhìn từ mặt cắm', 'đứng trước mặt cắm', xy(Lay.C, ey - 52)) +
      '<path class="cpv-sight" d="M' + r2(Lay.C - 12) + ' ' + r2(ey - 18) + ' L' + P2(xy(F.center.x + 12, F.center.y + F.H * 0.3)) + '" marker-end="url(#' + id + 's)"/>' +
      '<path class="cpv-sight" d="M' + r2(Lay.C + 12) + ' ' + r2(ey - 18) + ' L' + P2(xy(D.center.x - 12, D.center.y + D.H * 0.3)) + '" marker-end="url(#' + id + 's)"/>';
    var sy = Math.max(64, pb.yb - 60);
    s += eyeBtn(id, 66, sy, 'solder', 'Nhìn từ phía hàn', 'phía dây, sau đầu nối', xy(pb.back - 6, Math.max(sy + 6, F.O.y + 8)), true);
    Lay.H = ey + 64;
    var W = Lay.W, H = Lay.H;
    return '<svg class="cpv-svg" viewBox="0 0 ' + r2(W) + ' ' + r2(H) + '" role="group" aria-label="' + esc('Phối cảnh cắm: ' + ctx.plugCap[0] + ' cắm vào ' + ctx.devCap[0]) + '">' + s + '</svg>';
  }

  /** Cảnh cáp hai đầu: A (mặt quay trái) — dây — B (mặt quay phải). */
  function perspCableSvg(c, A, B) {
    var Lay = perspCableLayout(A.b, A.end.gender, A.p, B.b, B.end.gender, B.p), id = 'cpv' + (++perspUid), s = markers(id);
    var fa = Lay.a, fb = Lay.b, ba = plugBody(fa), bb = plugBody(fb), ea = ba.bootEnd, eb = bb.bootEnd;
    lastFaces = [fa, fb];
    var sag = Math.max(ea.y, eb.y) + 70;
    s += cablePath('M' + P2(ea) + ' C' + r2(ea.x + 90) + ' ' + r2(sag) + ' ' + r2(eb.x - 90) + ' ' + r2(sag) + ' ' + P2(eb));
    var cut = '';
    [[A, fa, ba], [B, fb, bb]].forEach(function (t) {
      var E = t[0], F = t[1], pb = t[2];
      s += pb.svg + latchSvg(F, pb.back);
      cut += perspFaceSvg(F, E.end.gender, E.pm, E.gmap, 'đầu ' + E.e.toUpperCase(), function (pin) { return { k: E.e + ':' + pin, h: E.e + ':' + pin }; });
      var cx = (F.O.x + pb.back) / 2;
      s += svgText(cx + F.n * F.L * 0.5, F.O.y - F.A - 34, E.e.toUpperCase(), 'cend-tag', 'middle');
      // nhãn ngắn: tên đầy đủ (label dài) đã có ở thẻ A/B phía trên và trong title
      var bn = E.b ? E.b.name : '';
      if (bn.length > 24) bn = bn.slice(0, 23) + '…';
      cut += '<g><title>' + esc(E.end.label || '') + '</title>' + svgText(cx, Lay.bottom + 50, 'Đầu ' + E.e.toUpperCase() + ' · ' + (GENDER_SHORT[E.end.gender] || E.end.gender), 'cpv-cap', 'middle') +
        svgText(cx, Lay.bottom + 67, bn, 'cpv-cap cpv-cap--s', 'middle') + '</g>';
      var mateX = F.n > 0 ? F.O.x + F.L + 48 : F.O.x - F.L - 48;
      cut += eyeBtn(id, mateX, F.center.y + 6, 'mate', 'Mặt cắm ' + E.e.toUpperCase(), 'nhìn từ đây', xy(F.center.x - F.n * -F.L * 0.42, F.center.y));
      var sx = pb.bootEnd.x - F.n * 40;
      cut += eyeBtn(id, sx, pb.yb - 58, 'solder', 'Phía hàn ' + E.e.toUpperCase(), 'nhìn từ đây', xy(pb.back - F.n * 4, pb.yb - 18));
    });
    // chú thích chốt/góc vát: đặt sau cùng, tránh mọi chữ đã có (nhãn con mắt, chú thích đầu A/B)
    var avoid = svgTextBoxes(s + cut);
    cut += keyCallout(fa, 12, true, avoid) + keyCallout(fb, 12, true, avoid);
    s += cut;
    return '<svg class="cpv-svg" viewBox="0 0 ' + r2(Lay.W) + ' ' + r2(Lay.H) + '" role="group" aria-label="Phối cảnh hai đầu cáp A và B, dây nối hai thân">' + s + '</svg>';
  }

  /** Hình nhỏ "bạn đang đứng ở đây": role 'plug' (đầu cáp) hoặc 'device' (ổ trên vỏ), side mate/solder. */
  /**
   * Hình dáng mặt cắm thu nhỏ đặt lên mặt nghiêng của hình nhỏ: ánh xạ affine khung vb của face → hình bình hành
   * q00 (u=x0,v=y0), q10 (u=x1,v=y0), q01 (u=x0,v=y1). Chỉ vẽ vỏ (bỏ chữ), để nhận ra HDMI/DP/DVI… ngay ở hình nhỏ.
   */
  function miniOutline(geo, q00, q10, q01) {
    if (!geo) return '';
    var vb = geo.vb, a = (q10.x - q00.x) / vb[2], b = (q10.y - q00.y) / vb[2], c = (q01.x - q00.x) / vb[3], d = (q01.y - q00.y) / vb[3];
    var e = q00.x - a * vb[0] - c * vb[1], f = q00.y - b * vb[0] - d * vb[1];
    var body = geo.outline.replace(/<text[^>]*>[^<]*<\/text>/g, '');
    return '<g class="cmini-shape" transform="matrix(' + [a, b, c, d, e, f].map(function (v) { return Math.round(v * 10000) / 10000; }).join(' ') + ')">' + body + '</g>';
  }
  function miniWhere(role, side, geo) {
    var mate = side !== 'solder', s = '', ex, ey, tx;
    var desc = (role === 'device' ? 'ổ trên vỏ thiết bị' : 'đầu cáp') + ', ' + (mate ? 'đứng trước mặt cắm' : (role === 'device' ? 'đứng phía sau tấm vỏ (bên trong máy, phía hàn)' : 'đứng sau đầu nối, phía dây (phía hàn)'));
    if (role === 'device') {
      s += pg([xy(66, 12), xy(106, 12), xy(98, 5), xy(58, 5)], 'cpv-devtop') + rect(66, 12, 40, 44, 0, 'cpv-dev') + pg([xy(66, 12), xy(58, 5), xy(58, 49), xy(66, 56)], 'cpv-wall') +
        pg([xy(64.5, 24), xy(59.5, 20), xy(59.5, 36), xy(64.5, 40)], 'cmini-face') + miniOutline(geo, xy(59.5, 20), xy(64.5, 24), xy(59.5, 36));
      if (mate) { ex = 24; ey = 30; tx = xy(54, 28); } else { ex = 114; ey = 30; tx = xy(108, 32); }
    } else {
      s += '<path class="cpv-cable-o" d="M30 36 C18 36 14 46 2 56"/><path class="cpv-cable cmini-cable" d="M30 36 C18 36 14 46 2 56"/>' +
        pg([xy(34, 24), xy(70, 24), xy(80, 17), xy(44, 17)], 'cpv-top') + rect(34, 24, 36, 22, 0, 'cpv-body') + rect(28, 30, 6, 12, 1, 'cpv-boot') +
        pg([xy(70, 24), xy(80, 17), xy(80, 39), xy(70, 46)], 'cmini-face') + miniOutline(geo, xy(70, 24), xy(80, 17), xy(70, 46));
      if (mate) { ex = 104; ey = 30; tx = xy(84, 29); } else { ex = 14; ey = 13; tx = xy(30, 26); }
    }
    var lx = Math.sign(tx.x - ex), ly = Math.sign(tx.y - ey);
    s += '<path class="cpv-sight cmini-sight" d="M' + r2(ex + lx * 9) + ' ' + r2(ey + ly * 4) + ' L' + P2(tx) + '"/>' + eyeShape(ex, ey, 7, lx, ly);
    s += svgText(Math.max(22, Math.min(98, ex)), ey > 40 ? ey - 12 : 64, 'bạn ở đây', 'cmini-t', 'middle');
    return '<svg class="cmini" viewBox="0 0 120 68" role="img" aria-label="' + esc('Bạn đang đứng ở đây: ' + desc) + '"><title>' + esc('Bạn đang đứng ở đây: ' + desc) + '</title>' + s + '</svg>';
  }

  // ---------- trang Sơ đồ chân ----------
  function renderPinout(p) {
    var b = bodyOf(p), side = cv.st.side, vid = cv.st.variant[p.id] || '';
    if (vid && !(p.variants || []).some(function (v) { return v.id === vid; })) vid = '';
    var pins = mergedPins(p, vid), pm = pinMap(pins), gmap = groupMap(p);
    var fam = FAMILY[p.family] || { name: p.family || '' };
    var h = '<section class="stack-head"><div><span class="eyebrow">Đấu nối · ' + esc(fam.name) + ' · Sơ đồ chân</span>' +
      '<h1 class="stack-title">' + esc(p.name || p.id) + '</h1>' +
      (p.summary ? '<p class="stack-summary">' + esc(p.summary) + '</p>' : '') + '</div>' +
      '<div class="stats">' +
        stat('Thân đầu nối', b ? b.name : '(thiếu “' + p.body + '”)', b && b.aka && b.aka.length ? 'còn gọi: ' + b.aka.join(', ') : '') +
        stat('Số chân', b ? String(b.pinCount || (b.face && b.face.pins || []).length) : '–', b && b.face && b.face.shell ? 'vỏ cỡ ' + b.face.shell : '') +
        stat('Vai trò', p.role || '–', p.role ? (ROLE_HINT[p.role] || '') : 'không gắn vai trò') +
        stat('Thường gặp', p.gender ? cap(GENDER_SHORT[p.gender] || p.gender) : '–', 'trên thiết bị') +
      '</div></section>';
    if (!b || !b.face) {
      return h + '<div class="alert alert--error"><strong>Thiếu thân đầu nối.</strong> Pinout tham chiếu body “' + esc(p.body) + '” không có trong dữ liệu.</div>' + pinTable(p, pins, gmap, vid);
    }
    h += toolbar(p, vid);
    var pg2 = perspGenders(b, p);
    if (side === 'persp') {
      var scene = perspPinoutScene(p, pins).svg;
      h += '<section class="card" aria-labelledby="cf-t"><div class="section-title"><h2 id="cf-t">Phối cảnh cắm</h2><span class="muted">rê/nhấn vào chân · bấm con mắt để xem hình phẳng</span></div>' +
        '<div class="cpv-wrap">' + scene + '</div>' + perspNote(b, pg2) + groupLegend(p, pins, gmap) + '</section>';
      h += pinTable(p, pins, gmap, vid);
      h += explain(p.detail, p.standard, b);
      h += usedBy(p);
      return h;
    }
    // hai giới tính cạnh nhau
    var figs = gendersOf(b).map(function (g) {
      var geo = faceGeom(b, g, side, p), lbl = GENDER_SHORT[g] || g;
      var svg = '<svg class="cface" viewBox="' + geo.vb.map(r2).join(' ') + '" role="group" aria-label="' + esc(cap(lbl) + ', ' + sideTxt(side)) + '">' +
        geo.outline + pinsSvg(geo, pm, gmap, g, lbl, function (pin) { return { k: 'p:' + pin, h: 'p:' + pin }; }) + '</svg>';
      var wide = geo.vb[2] / geo.vb[3] > 3; // mặt rất dẹt (USB-C, DB-25): mỗi hình một hàng cho đủ lớn
      return '<figure class="cfig' + (wide ? ' cfig--wide' : '') + '"><figcaption>' + miniWhere(g === pg2.dev ? 'device' : 'plug', side, faceGeom(b, g, 'mate', p)) + '<b>' + esc(genderName(b, g)) + '</b>' +
        (p.gender === g ? ' <span class="badge badge--add" title="Giới tính thường gặp của sơ đồ chân này trên thiết bị">thường gặp</span>' : '') +
        '<span class="cfig-side">' + esc((g === pg2.dev ? 'ổ trên thiết bị' : 'đầu cáp') + ' · ' + sideTxt(side)) + (mirrored(b, g, side) ? ' · ảnh gương của hình gốc' : '') + '</span></figcaption>' + svg +
        (b.genders[g] && b.genders[g].note ? '<p class="cfig-note muted">' + esc(b.genders[g].note) + '</p>' : '') + '</figure>';
    }).join('');
    h += '<section class="card" aria-labelledby="cf-t"><div class="section-title"><h2 id="cf-t">Mặt đầu nối</h2><span class="muted">rê/nhấn vào chân để xem</span></div>' +
      '<div class="cfigs">' + figs + '</div>' + orientNote(b, side) + groupLegend(p, pins, gmap) + '</section>';
    h += pinTable(p, pins, gmap, vid);
    h += explain(p.detail, p.standard, b);
    h += usedBy(p);
    return h;
  }

  function stat(label, value, sub) {
    return '<div class="stat"><div class="stat-label">' + esc(label) + '</div><div class="stat-value cstat-v">' + esc(value) + '</div>' + (sub ? '<div class="stat-sub">' + esc(sub) + '</div>' : '') + '</div>';
  }
  function toolbar(p, vid) {
    var s = '<div class="toolbar ctoolbar"><span class="toolbar-label" id="cside-l">Góc nhìn</span><div class="seg-group" role="group" aria-labelledby="cside-l">' +
      [['persp', 'Phối cảnh cắm', 'Hình nghiêng: đầu cáp cầm trên tay cắm vào ổ trên thiết bị'], ['mate', 'Nhìn từ mặt cắm', 'Hình phẳng: đứng trước mặt cắm'],
        ['solder', 'Nhìn từ phía hàn', 'Hình phẳng: đứng sau đầu nối, phía dây']].map(function (x) {
        var on = cv.st.side === x[0];
        return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-cside="' + x[0] + '" aria-pressed="' + on + '" title="' + esc(x[2]) + '">' + x[1] + '</button>';
      }).join('') + '</div>';
    if (p && p.variants && p.variants.length) {
      s += '<span class="toolbar-label" id="cvar-l">Biến thể</span><div class="cvars" role="group" aria-labelledby="cvar-l">' +
        [{ id: '', name: 'Cơ bản', note: 'Gán chân gốc' }].concat(p.variants).map(function (v) {
          var on = vid === v.id;
          return '<button type="button" class="var-chip' + (on ? ' is-on' : '') + '" data-cvar="' + esc(v.id) + '" aria-pressed="' + on + '"' + (v.note ? ' title="' + esc(v.note) + '"' : '') + '>' + esc(v.name || v.id) + '</button>';
        }).join('') + '</div>';
    }
    s += '</div>';
    if (p && vid) {
      var v = (p.variants || []).filter(function (x) { return x.id === vid; })[0];
      if (v && v.note) s += '<div class="alert alert--info cvar-note"><strong>' + esc(v.name) + ':</strong> ' + esc(v.note) + '</div>';
    }
    return s;
  }
  function orientNote(b, side) {
    var f = b.face, v = f.viewOf, other = gendersOf(b).filter(function (g) { return g !== v; })[0];
    return '<div class="corient"><p><strong>Hướng nhìn:</strong> ' + esc(f.orientation || '(dữ liệu chưa ghi hướng)') + '</p>' +
      '<p class="muted">Dữ liệu vẽ ' + esc(GENDER_SHORT[v] || v) + ' nhìn từ mặt cắm' +
      (other ? '; ' + esc(GENDER_SHORT[other] || other) + ' nhìn từ mặt cắm là ảnh gương ngang (hai mặt cắm úp vào nhau)' : '') +
      '. Nhìn từ phía hàn (mặt sau, nơi hàn dây) = ảnh gương ngang của mặt cắm cùng đầu' +
      (side === 'solder' ? ' — đang hiện góc này' : '') + '. Số chân không đổi, chỉ vị trí trái/phải đảo.</p></div>';
  }
  function groupLegend(p, pins, gmap) {
    var items = [];
    if ((p.groups || []).length) {
      p.groups.forEach(function (g, i) { items.push('<span class="clg layer-' + groupLayer(g.name, i) + '"><i></i>' + esc(g.name) + '</span>'); });
    } else {
      var seen = {};
      pins.forEach(function (x) { if (DIR[x.dir] && !seen[x.dir]) { seen[x.dir] = 1; items.push('<span class="clg layer-' + DIR_LAYER[x.dir] + '"><i></i>' + esc(DIR[x.dir].label) + '</span>'); } });
    }
    items.push('<span class="clg clg--shape"><svg viewBox="0 0 20 20" aria-hidden="true"><circle class="cp-body" cx="10" cy="10" r="7"/></svg>chân (đực)</span>');
    items.push('<span class="clg clg--shape"><svg viewBox="0 0 20 20" aria-hidden="true"><circle class="cp-body" cx="10" cy="10" r="7"/><circle class="cp-hole" cx="10" cy="10" r="5"/></svg>lỗ (cái)</span>');
    if (pins.some(function (x) { return x.dir === 'nc'; })) items.push('<span class="clg layer-payload clg--nc"><i></i>không dùng</span>');
    return '<div class="clegend">' + items.join('') + '</div>';
  }
  function pinTable(p, pins, gmap, vid) {
    var col = function (k) { return pins.some(function (x) { return x[k] != null && x[k] !== ''; }); };
    var cV = col('v24'), cC = col('color'), cP = col('pair');
    var roleTxt = p.role ? ' (từ ' + p.role + ')' : '';
    var head = '<tr><th>Chân</th><th>Tín hiệu</th><th>Tên</th><th title="Nhìn từ thiết bị mang sơ đồ chân này' + esc(p.role ? ' — ' + (ROLE_HINT[p.role] || p.role) : '') + '">Hướng' + esc(roleTxt) + '</th>' +
      (cV ? '<th title="Mã mạch ITU-T V.24 / tên khác">V.24</th>' : '') + (cC ? '<th>Màu dây</th>' : '') + (cP ? '<th>Cặp</th>' : '') + '<th>Mô tả</th></tr>';
    var rows = pins.map(function (x) {
      var g = gmap[x.pin], lay = layerOf(x, gmap), k = 'p:' + x.pin;
      return '<tr class="crow layer-' + lay + (x.dir === 'nc' ? ' is-nc' : '') + '" data-k="' + esc(k) + '" data-h="' + esc(k) + '">' +
        '<td class="cpin-no"><span class="cpsw" aria-hidden="true"></span><b>' + esc(x.pin) + '</b></td>' +
        '<td class="mono"><b>' + esc(x.signal || '–') + '</b>' + (x._var ? ' <span class="badge badge--var" title="Đổi theo biến thể đang chọn">biến thể</span>' : '') + '</td>' +
        '<td>' + esc(x.name || '') + (g ? '<div class="muted csub">' + esc(g.name) + '</div>' : '') + '</td>' +
        '<td>' + dirHtml(x) + '</td>' +
        (cV ? '<td class="mono">' + esc(x.v24 || '') + '</td>' : '') +
        (cC ? '<td>' + swatch(x.color) + esc(x.color || '') + '</td>' : '') +
        (cP ? '<td class="mono">' + esc(x.pair || '') + '</td>' : '') +
        '<td>' + esc(x.desc || '') + '</td></tr>';
    }).join('');
    return '<section class="card" aria-labelledby="cpt-t"><div class="section-title"><h2 id="cpt-t">Bảng chân</h2><span class="muted">' + esc(pins.length + ' chân' + (vid ? ' · biến thể đang chọn' : '')) + '</span></div>' +
      '<div class="tbl-wrap"><table class="values ctable"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div></section>';
  }
  function explain(detail, standard, body, extra) {
    if (!detail && !standard && !(body && (body.detail || body.standard)) && !extra) return '';
    return '<details class="stack-detail" open><summary>Giải thích</summary>' +
      (detail ? '<p>' + esc(detail) + '</p>' : '') + (extra || '') +
      (body && body.detail ? '<p><strong>' + esc(body.name) + ':</strong> ' + esc(body.detail) + '</p>' : '') +
      (standard ? '<p class="muted">Chuẩn: ' + esc(standard) + '</p>' : '') +
      (body && body.standard ? '<p class="muted">Thân đầu nối: ' + esc(body.standard) + '</p>' : '') + '</details>';
  }
  function usedBy(p) {
    var list = cablesFor(p.id);
    var body = list.length ? '<ul class="clinks">' + list.map(function (c) {
      return '<li><a href="#conn/' + esc(encodeURIComponent(c.id)) + '">' + esc(c.name || c.id) + '</a> <span class="chip">' + esc((KIND[c.kind] || { short: c.kind }).short) + '</span>' +
        (c.vendor ? ' <span class="badge badge--unv">theo hãng</span>' : '') + (c.use ? '<div class="muted csub">' + esc(c.use) + '</div>' : '') + '</li>';
    }).join('') + '</ul>' : '<p class="muted">Chưa có cáp nào dùng sơ đồ chân này trong dữ liệu.</p>';
    return '<section class="card" aria-labelledby="cub-t"><div class="section-title"><h2 id="cub-t">Cáp &amp; đầu chuyển dùng sơ đồ này</h2><span class="muted">' + list.length + '</span></div>' + body + '</section>';
  }

  // ---------- trang Cáp ----------
  function endInfo(c, e) {
    var x = c[e]; if (!x) return null;
    var p = pinoutById(x.pinout), b = bodyOf(p);
    return { e: e, end: x, p: p, b: b, pins: p ? p.pins : [], pm: p ? pinMap(p.pins) : {}, gmap: p ? groupMap(p) : {} };
  }
  function pinLabel(info, pin) {
    var x = info && info.pm[pin];
    return pin + (x && x.signal ? ' – ' + x.signal : '');
  }

  /** Sơ đồ dây: đầu A ở trên, đầu B ở dưới (loopback: chỉ A), dây cong nối chân. */
  function cableSvg(c, A, B, side) {
    var W = 520, MX = 18, FH = 150, GAP = 170, TOP = 44, BOTTOM = 46;
    var ends = [A, B].filter(function (x) { return x && x.b && x.b.face; });
    var lay = {}, y = TOP;
    ends.forEach(function (E, i) {
      var g = faceGeom(E.b, E.end.gender, side, E.p), vw = g.vb[2], vh = g.vb[3];
      var s = Math.min((W - 2 * MX) / vw, FH / vh);
      var ox = (W - vw * s) / 2 - g.vb[0] * s, oy = y - g.vb[1] * s;
      lay[E.e] = { g: g, s: s, ox: ox, oy: oy, top: y, bottom: y + vh * s };
      y += vh * s + (i === 0 ? (B ? GAP : 0) : 0);
    });
    if (!lay.a) return '<p class="alert alert--error">Không vẽ được: thiếu dữ liệu thân đầu nối.</p>';
    var H = y + (B ? BOTTOM : 84);
    function pos(e, pin) {
      var L = lay[e]; if (!L) return null;
      for (var i = 0; i < L.g.pins.length; i++) if (L.g.pins[i].pin === pin) return { x: L.ox + L.g.pins[i].x * L.s, y: L.oy + L.g.pins[i].y * L.s };
      return null;
    }
    var info = { a: A, b: B }, wiresByPin = {}, wires = '', extra = '';
    function touch(k, w) { (wiresByPin[k] = wiresByPin[k] || []).push(w); }
    (c.wires || []).forEach(function (w, i) {
      var wk = 'w' + i, ka, kb, p1, p2, d;
      if (c.b) { ka = 'a:' + w.a; kb = 'b:' + w.b; p1 = pos('a', String(w.a)); p2 = pos('b', String(w.b)); }
      else { ka = 'a:' + w.a; kb = 'a:' + w.a2; p1 = pos('a', String(w.a)); p2 = pos('a', String(w.a2)); }
      touch(ka, wk); touch(kb, wk);
      if (!p1 || !p2) return;
      if (c.b) {
        var my = (lay.a.bottom + lay.b.top) / 2;
        d = 'M' + r2(p1.x) + ' ' + r2(p1.y) + ' C' + r2(p1.x) + ' ' + r2(my) + ' ' + r2(p2.x) + ' ' + r2(my) + ' ' + r2(p2.x) + ' ' + r2(p2.y);
      } else {
        var ly = lay.a.bottom + 34 + (i % 3) * 18;
        d = 'M' + r2(p1.x) + ' ' + r2(p1.y) + ' C' + r2(p1.x) + ' ' + r2(ly) + ' ' + r2(p2.x) + ' ' + r2(ly) + ' ' + r2(p2.x) + ' ' + r2(p2.y);
      }
      // màu dây: màu chuẩn của chân đầu A, không có thì của chân đầu B (vd. C ↔ A: màu USB ở đầu A)
      var srcPin = A.pm[String(w.a)], dstPin = c.b ? B.pm[String(w.b)] : null;
      var col = parseColor(srcPin && srcPin.color) || parseColor(dstPin && dstPin.color), lc = layerOf(srcPin, A.gmap);
      var keys = esc(wk + ' ' + ka + ' ' + kb);
      wires += '<g class="cwire layer-' + lc + '" data-k="' + keys + '" data-h="' + wk + '">' +
        '<path class="cw-edge" d="' + d + '"/>' +
        '<path class="cw-main"' + (col ? ' style="stroke:' + col.base + '"' : '') + ' d="' + d + '"/>' +
        (col && col.stripe ? '<path class="cw-stripe" style="stroke:' + col.stripe + '" d="' + d + '"/>' : '') +
        '<path class="cw-hit" d="' + d + '"><title>' + esc(pinLabel(A, String(w.a)) + ' → ' + (c.b ? 'B ' + pinLabel(B, String(w.b)) : pinLabel(A, String(w.a2))) + (w.note ? ' · ' + w.note : '')) + '</title></path></g>';
    });
    // cầu nối trong cùng một đầu: vòng cung ra phía ngoài (A: lên trên, B: xuống dưới)
    (c.bridges || []).forEach(function (br, i) {
      var e = br.end === 'b' ? 'b' : 'a', L = lay[e]; if (!L) return;
      var bk = 'br' + i, ks = [bk], segs = '';
      var cy = e === 'a' && c.b ? L.top - 16 - (i % 2) * 10 : L.bottom + 16 + (i % 2) * 10;
      if (!c.b) cy = L.top - 16 - (i % 2) * 10;
      var ps = (br.pins || []).map(function (pin) { ks.push(e + ':' + pin); touch(e + ':' + pin, bk); return pos(e, String(pin)); });
      for (var j = 1; j < ps.length; j++) {
        var p1 = ps[j - 1], p2 = ps[j]; if (!p1 || !p2) continue;
        segs += 'M' + r2(p1.x) + ' ' + r2(p1.y) + ' C' + r2(p1.x) + ' ' + r2(cy) + ' ' + r2(p2.x) + ' ' + r2(cy) + ' ' + r2(p2.x) + ' ' + r2(p2.y) + ' ';
      }
      if (!segs) return;
      extra += '<g class="cbridge" data-k="' + esc(ks.join(' ')) + '" data-h="' + bk + '"><path class="cb-main" d="' + segs + '"/><path class="cw-hit" d="' + segs + '"><title>' +
        esc('Cầu nối ở đầu ' + e.toUpperCase() + ': ' + (br.pins || []).join('–') + (br.note ? ' · ' + br.note : '')) + '</title></path></g>';
    });
    // linh kiện: hộp nhãn trên dây
    (c.components || []).forEach(function (cp, i) {
      var ref = (cp.between || []).map(function (x) { return parseRef(c, x); });
      var ck = 'cp' + i, ks = [ck];
      var pts = ref.map(function (rf) { if (!rf) return null; ks.push(rf.end + ':' + rf.pin); touch(rf.end + ':' + rf.pin, ck); return pos(rf.end, rf.pin); });
      if (pts.length < 2 || !pts[0] || !pts[1]) return;
      var p1 = pts[0], p2 = pts[1], d, mx, my;
      if (ref[0].end === ref[1].end) {
        var L = lay[ref[0].end], up = ref[0].end === 'a' && c.b ? -1 : (c.b ? 1 : -1);
        var cy = up < 0 ? L.top - 30 : L.bottom + 30;
        d = 'M' + r2(p1.x) + ' ' + r2(p1.y) + ' C' + r2(p1.x) + ' ' + r2(cy) + ' ' + r2(p2.x) + ' ' + r2(cy) + ' ' + r2(p2.x) + ' ' + r2(p2.y);
        mx = (p1.x + p2.x) / 2; my = 0.125 * (p1.y + p2.y) + 0.75 * cy;
      } else {
        d = 'M' + r2(p1.x) + ' ' + r2(p1.y) + ' L' + r2(p2.x) + ' ' + r2(p2.y);
        // nhiều linh kiện nối hai đầu: so le dọc theo dây để hộp nhãn không chồng nhau
        var nX = (c.components || []).length, t = (i + 1) / (nX + 1);
        mx = p1.x + (p2.x - p1.x) * t; my = p1.y + (p2.y - p1.y) * t;
      }
      var lbl = (cp.type === 'resistor' ? 'R ' : cp.type === 'transformer' ? 'T ' : cp.type === 'capacitor' ? 'C ' : '') + (cp.value || cp.type || '');
      if (lbl.length > 16) lbl = lbl.slice(0, 15).trim() + '…'; // nhãn đầy đủ ở tooltip và bảng
      var bw = Math.max(30, lbl.length * 6.6 + 12);
      extra += '<g class="ccomp" data-k="' + esc(ks.join(' ')) + '" data-h="' + ck + '"><path class="cc-line" d="' + d + '"/>' +
        rect(mx - bw / 2, my - 10, bw, 20, 4, 'cc-box') + '<text class="cc-txt" x="' + r2(mx) + '" y="' + r2(my) + '">' + esc(lbl) + '</text>' +
        '<title>' + esc((cp.note || cp.type || '') + ' — ' + (cp.between || []).join(' ↔ ')) + '</title></g>';
    });
    var faces = '', pinsLayer = '';
    ends.forEach(function (E) {
      var L = lay[E.e];
      faces += '<g transform="translate(' + r2(L.ox) + ' ' + r2(L.oy) + ') scale(' + r2(L.s * 1000) / 1000 + ')">' + L.g.outline + '</g>';
      pinsLayer += '<g transform="translate(' + r2(L.ox) + ' ' + r2(L.oy) + ') scale(' + r2(L.s * 1000) / 1000 + ')">' +
        pinsSvg(L.g, E.pm, E.gmap, E.end.gender, 'đầu ' + E.e.toUpperCase(), function (pin) {
          var k = E.e + ':' + pin; return { k: [k].concat(wiresByPin[k] || []).join(' '), h: k };
        }) + '</g>';
      // nhãn A/B cạnh mặt
      var ly = E.e === 'a' ? L.top - 6 : L.bottom + 20;
      faces += '<text class="cend-tag" x="' + MX + '" y="' + r2(E.e === 'a' ? Math.max(16, L.top - 22) : ly) + '">' + E.e.toUpperCase() + '</text>';
    });
    return '<svg class="cwire-svg" viewBox="0 0 ' + W + ' ' + r2(H) + '" role="group" aria-label="Sơ đồ nối dây, ' + esc(sideTxt(side)) + '">' +
      faces + wires + extra + pinsLayer + '</svg>';
  }

  function renderCable(c) {
    var A = endInfo(c, 'a'), B = endInfo(c, 'b'), side = cv.st.side;
    var fam = FAMILY[c.family] || { name: c.family || '' }, kind = KIND[c.kind] || { name: c.kind || '' };
    var h = '<section class="stack-head"><div><span class="eyebrow">Đấu nối · ' + esc(fam.name) + ' · Cáp &amp; chuyển đổi</span>' +
      '<h1 class="stack-title">' + esc(c.name || c.id) + '</h1>' +
      '<div class="cbadges"><span class="chip">' + esc(kind.name) + '</span>' +
      (c.vendor ? '<span class="badge badge--unv cvendor" title="Sơ đồ dây theo tài liệu hãng / thói quen, không phải chuẩn">Theo hãng, không phải chuẩn</span>' : '') + '</div>' +
      (c.use ? '<p class="stack-summary"><strong>Dùng khi:</strong> ' + esc(c.use) + '</p>' : '') + '</div></section>';
    if (c.warnings && c.warnings.length) {
      h += '<div class="alert alert--warn cwarn" role="note"><strong>⚠ Lưu ý</strong><ul>' + c.warnings.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>';
    }
    var missing = [A, B].filter(function (x, i) { return (i === 0 || c.b) && x && (!x.p || !x.b); });
    if (missing.length) h += '<div class="alert alert--error"><strong>Thiếu dữ liệu đầu nối:</strong> ' + missing.map(function (x) { return esc(x.end.pinout); }).join(', ') + '</div>';
    h += '<div class="cends">' + [A, B].filter(Boolean).map(endCard).join('') + '</div>';
    h += toolbar(null, '');
    var fs = flatSide(side);
    if (side === 'persp' && A && A.b && A.b.face) h += cablePersp(c);
    var minis = [A, B].filter(function (x) { return x && x.b && x.b.face; }).map(function (E) {
      return '<span class="cwhere-i"><span class="cend-l">' + E.e.toUpperCase() + '</span>' + miniWhere('plug', fs, faceGeom(E.b, E.end.gender, 'mate', E.p)) + '</span>';
    }).join('');
    h += '<section class="card" aria-labelledby="cwd-t"><div class="section-title"><h2 id="cwd-t">Sơ đồ nối dây</h2><span class="muted">' + esc(cap(sideTxt(fs))) + ' · rê/nhấn vào dây hoặc chân</span></div>' +
      (minis ? '<div class="cwhere">' + minis + '<span class="muted csub">Mắt = chỗ bạn đứng khi nhìn mỗi đầu trong sơ đồ dưới' + (side === 'persp' ? ' (sơ đồ dây vẽ theo mặt cắm)' : '') + '.</span></div>' : '') +
      '<div class="cdiagram">' + cableSvg(c, A, B, fs) + '</div>' + cableLegend(c, A) + '</section>';
    h += wireTable(c, A, B);
    h += explain(c.detail, c.standard, null);
    return h;
  }
  /** Phối cảnh trang cáp: hai đầu A, B nối bằng dây; loopback (một đầu) vẽ cảnh cắm vào cổng cần thử. */
  /** Cảnh phối cảnh của trang sơ đồ chân → { svg, faces } (faces dùng cho test chồng chữ). */
  function perspPinoutScene(p, pins) {
    var b = bodyOf(p), pg2 = perspGenders(b, p);
    pins = pins || p.pins;
    var svg = perspMatingSvg({ b: b, pinout: p, pm: pinMap(pins), gmap: groupMap(p), plug: pg2.plug, dev: pg2.dev,
      keyOf: function (pin) { return { k: 'p:' + pin, h: 'p:' + pin }; },
      plugCap: ['Đầu cáp · ' + (GENDER_SHORT[pg2.plug] || pg2.plug), 'cầm trên tay, dây ra phía sau'],
      devCap: ['Ổ trên vỏ thiết bị · ' + (GENDER_SHORT[pg2.dev] || pg2.dev), p.role ? 'thiết bị ' + p.role : 'gắn trên thiết bị'] });
    return { svg: svg, faces: lastFaces };
  }
  /** Cảnh phối cảnh của trang cáp → { svg, faces, two }. */
  function perspCableScene(c) {
    var A = endInfo(c, 'a'), B = endInfo(c, 'b'), svg;
    if (B && B.b && B.b.face) return { svg: perspCableSvg(c, A, B), faces: lastFaces, two: true };
    var gs = gendersOf(A.b), dev = gs.filter(function (g) { return g !== A.end.gender; })[0] || A.end.gender;
    var isLoop = c.kind === 'loopback' || !c.b;
    svg = perspMatingSvg({ b: A.b, pinout: A.p, pm: A.pm, gmap: A.gmap, plug: A.end.gender, dev: dev,
      keyOf: function (pin) { return { k: 'a:' + pin, h: 'a:' + pin }; },
      plugCap: [(isLoop ? 'Nút thử vòng · ' : 'Đầu A · ') + (GENDER_SHORT[A.end.gender] || A.end.gender), isLoop ? 'dây nối vòng nằm bên trong' : 'đầu cáp'],
      devCap: [(isLoop ? 'Cổng cần thử · ' : 'Ổ trên thiết bị · ') + (GENDER_SHORT[dev] || dev), 'trên thiết bị'] });
    return { svg: svg, faces: lastFaces, two: false };
  }
  function cablePersp(c) {
    var sc = perspCableScene(c), svg = sc.svg, note;
    if (sc.two) {
      note = 'Mỗi mặt cắm vẽ như khi bạn cầm đầu đó và nhìn thẳng vào mặt cắm; số chân giống hình “Nhìn từ mặt cắm”. Rê chuột vào chân để tô sáng dây trong bảng.';
    } else {
      note = 'Cắm nút thử vòng vào cổng cần thử: đường nét đứt nối chân cùng số ở hai mặt (chân 1 chạm chân 1).';
    }
    return '<section class="card" aria-labelledby="cpv-t"><div class="section-title"><h2 id="cpv-t">Phối cảnh</h2><span class="muted">bấm con mắt để xem hình phẳng</span></div>' +
      '<div class="cpv-wrap">' + svg + '</div><p class="muted cpv-note">' + esc(note) + '</p></section>';
  }
  /** Lời giải thích dưới cảnh phối cảnh của trang sơ đồ chân. */
  function perspNote(b, g) {
    return '<div class="corient"><p><strong>Cách đọc:</strong> bên trái là đầu cáp (' + esc(GENDER_SHORT[g.plug] || g.plug) + ') cầm trên tay, dây ra phía sau; bên phải là ổ (' +
      esc(GENDER_SHORT[g.dev] || g.dev) + ') trên vỏ thiết bị. Hai mặt cắm quay vào nhau, đẩy theo mũi tên “hướng cắm”.</p>' +
      '<p class="muted">Mỗi mặt cắm hiện đúng như khi đứng trước nó nhìn vào; đường nét đứt nối hai chân cùng số — chân 1 của đầu cáp chạm chân 1 của ổ (rê chuột vào một chân để thấy đường của chân đó). ' +
      'Bấm con mắt “Nhìn từ mặt cắm” hoặc “Nhìn từ phía hàn” để chuyển sang hình phẳng có đánh dấu chỗ bạn đứng.' + (b.face && b.face.orientation ? ' Hướng trong dữ liệu: ' + esc(b.face.orientation) : '') + '</p></div>';
  }
  function endCard(E) {
    var p = E.p, g = E.end.gender;
    return '<div class="cend"><span class="cend-l">' + E.e.toUpperCase() + '</span><div>' +
      (E.end.label ? '<b>' + esc(E.end.label) + '</b><br>' : '') +
      (p ? '<a href="#conn/' + esc(encodeURIComponent(p.id)) + '">' + esc(p.name || p.id) + '</a>' : esc(E.end.pinout)) +
      '<div class="muted csub">' + esc(cap(genderName(E.b, g))) + (E.b ? ' · ' + esc(E.b.name) : '') + '</div></div></div>';
  }
  function cableLegend(c, A) {
    var s = '<div class="clegend">';
    if ((c.wires || []).some(function (w) { return parseColor(A.pm[String(w.a)] && A.pm[String(w.a)].color); })) s += '<span class="clg">màu dây theo màu chuẩn của chân đầu A</span>';
    else s += '<span class="clg">màu dây theo nhóm chân ở đầu A</span>';
    if ((c.bridges || []).length) s += '<span class="clg clg--bridge"><svg viewBox="0 0 24 10" aria-hidden="true"><path class="cb-main" d="M2 8 C2 1 22 1 22 8"/></svg>cầu nối trong cùng đầu</span>';
    if ((c.components || []).length) s += '<span class="clg"><span class="cc-mini">R</span>linh kiện</span>';
    return s + '</div>';
  }
  function wireTable(c, A, B) {
    var rows = (c.wires || []).map(function (w, i) {
      var wk = 'w' + i, ka = 'a:' + w.a, kb = c.b ? 'b:' + w.b : 'a:' + w.a2;
      var pa = A.pm[String(w.a)];
      return '<tr class="crow layer-' + layerOf(pa, A.gmap) + '" data-k="' + esc(wk + ' ' + ka + ' ' + kb) + '" data-h="' + wk + '">' +
        '<td class="cpin-no"><span class="cpsw" aria-hidden="true"></span>' + (pa && pa.color ? swatch(pa.color) : '') + '<b>' + esc(pinLabel(A, String(w.a))) + '</b></td>' +
        '<td aria-hidden="true" class="carrow">→</td>' +
        '<td><b>' + esc(c.b ? pinLabel(B, String(w.b)) : pinLabel(A, String(w.a2))) + '</b></td>' +
        '<td>' + esc(w.note || '') + '</td></tr>';
    });
    (c.bridges || []).forEach(function (br, i) {
      var e = br.end === 'b' ? 'b' : 'a', E = e === 'b' ? B : A;
      rows.push('<tr class="crow crow--bridge" data-k="' + esc(['br' + i].concat((br.pins || []).map(function (p) { return e + ':' + p; })).join(' ')) + '" data-h="br' + i + '">' +
        '<td colspan="3"><span class="chip">cầu nối đầu ' + e.toUpperCase() + '</span> <b>' + esc((br.pins || []).map(function (p) { return pinLabel(E, String(p)); }).join(' ⇿ ')) + '</b></td><td>' + esc(br.note || '') + '</td></tr>');
    });
    (c.components || []).forEach(function (cp, i) {
      var refs = (cp.between || []).map(function (x) { return parseRef(c, x); });
      rows.push('<tr class="crow crow--comp" data-k="' + esc(['cp' + i].concat(refs.filter(Boolean).map(function (r) { return r.end + ':' + r.pin; })).join(' ')) + '" data-h="cp' + i + '">' +
        '<td colspan="3"><span class="chip">' + esc(cp.type === 'resistor' ? 'điện trở' : cp.type === 'transformer' ? 'biến áp' : cp.type || 'linh kiện') + (cp.value ? ' ' + esc(cp.value) : '') + '</span> ' +
        esc(refs.map(function (r, j) { return r ? r.end.toUpperCase() + ' ' + pinLabel(r.end === 'b' ? B : A, r.pin) : (cp.between[j] + ' (?)'); }).join(' ↔ ')) + '</td><td>' + esc(cp.note || '') + '</td></tr>');
    });
    var hd = c.b ? '<th>Đầu A: chân – tín hiệu</th><th aria-hidden="true"></th><th>Đầu B: chân – tín hiệu</th>' : '<th>Chân – tín hiệu</th><th aria-hidden="true"></th><th>Nối về chân – tín hiệu (cùng đầu)</th>';
    return '<section class="card" aria-labelledby="cwt-t"><div class="section-title"><h2 id="cwt-t">Bảng nối dây</h2><span class="muted">' + (c.wires || []).length + ' dây</span></div>' +
      '<div class="tbl-wrap"><table class="values ctable"><thead><tr>' + hd + '<th>Ghi chú</th></tr></thead><tbody>' + (rows.join('') || '<tr><td colspan="4" class="muted">Không có dây.</td></tr>') + '</tbody></table></div></section>';
  }

  // ---------- công cụ Chuyển đổi ----------
  function pinoutOptions(sel) {
    var groups = {};
    pinoutList().forEach(function (p) { var b = bodyOf(p), f = p.family || (b && b.family) || 'khác'; (groups[f] = groups[f] || []).push(p); });
    return Object.keys(groups).sort(function (a, b) { return ((FAMILY[a] || { order: 9 }).order) - ((FAMILY[b] || { order: 9 }).order); }).map(function (f) {
      return '<optgroup label="' + esc((FAMILY[f] || { name: f }).name) + '">' + groups[f].map(function (p) {
        var b = bodyOf(p);
        return '<option value="' + esc(p.id) + '"' + (p.id === sel ? ' selected' : '') + '>' + esc((p.name || p.id) + (b ? ' · ' + (b.aka && b.aka[0] || b.name) : '')) + '</option>';
      }).join('') + '</optgroup>';
    }).join('');
  }
  function renderConvert() {
    var list = pinoutList();
    var a = cv.st.conv.a, b = cv.st.conv.b;
    if (!pinoutById(a)) a = list[0] && list[0].id;
    if (!pinoutById(b)) b = (list[1] || list[0] || {}).id;
    cv.st.conv.a = a; cv.st.conv.b = b;
    var h = '<section class="stack-head"><div><span class="eyebrow">Đấu nối · Công cụ</span><h1 class="stack-title">Chuyển đổi đầu nối</h1>' +
      '<p class="stack-summary">Chọn hai đầu cần nối → các cáp, đầu chuyển, cáp chế <b>thụ động</b> (dây hàn, cầu nối, điện trở, biến áp) có trong dữ liệu.</p></div></section>';
    h += '<section class="card cconv-form" aria-label="Chọn hai đầu"><label class="cconv-sel"><span>Đầu A</span><select data-cconv="a">' + pinoutOptions(a) + '</select></label>' +
      '<button type="button" class="btn-ghost cconv-swap" data-cswap title="Đổi chỗ A và B" aria-label="Đổi chỗ đầu A và đầu B">⇅ Đổi chỗ</button>' +
      '<label class="cconv-sel"><span>Đầu B</span><select data-cconv="b">' + pinoutOptions(b) + '</select></label></section>';
    if (!a || !b) return h + '<div class="empty"><p>Chưa có sơ đồ chân nào.</p></div>';
    var m = convertMatches(a, b), pa = pinoutById(a), pb = pinoutById(b);
    h += '<section class="card" aria-labelledby="cconv-r" aria-live="polite"><div class="section-title"><h2 id="cconv-r">Kết quả</h2><span class="muted">' +
      esc((pa.name || a) + ' ↔ ' + (pb.name || b)) + '</span></div>';
    if (m.exact.length) h += '<ul class="cresults">' + m.exact.map(function (x) { return resultItem(x, a); }).join('') + '</ul>';
    else h += '<div class="alert alert--warn"><strong>Không có cách chế thụ động trong dữ liệu.</strong> Hai đầu này không có cáp/đầu chuyển chỉ bằng dây' +
      (pa.family !== pb.family ? ' — khác loại giao tiếp, thường phải dùng mạch chuyển đổi có IC (vd. USB ↔ RS-232 cần chip chuyển đổi)' : ' — có thể cần mạch chuyển đổi có IC') + '.</div>' + icHints(pa, pb);
    if (m.loop.length) h += '<h3 class="csub-h">Nút thử vòng cho đầu này</h3><ul class="cresults">' + m.loop.map(function (x) { return resultItem(x, a); }).join('') + '</ul>';
    if (m.body.length) h += '<h3 class="csub-h">Cùng loại thân đầu nối nhưng khác cách gán chân</h3><p class="muted csub">Cắm vừa về cơ khí nhưng tín hiệu khác — chỉ tham khảo, đừng dùng thay.</p><ul class="cresults">' + m.body.map(function (x) { return resultItem(x, a); }).join('') + '</ul>';
    h += '</section>';
    return h;
  }
  /** Trích câu "cần …" trong detail của hai pinout (chuyển đổi cần IC được ghi ở đó theo schema). */
  function icHints(pa, pb) {
    var out = [];
    [pa, pb].forEach(function (p) {
      String(p.detail || '').split(/(?<=[.;])\s+/).forEach(function (s) {
        if (/cần\s/i.test(s) && /(IC|chip|mạch|bộ chuyển)/i.test(s) && out.indexOf(s) < 0) out.push(s);
      });
    });
    return out.length ? '<ul class="cic">' + out.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ul>' : '';
  }
  function resultItem(x, a) {
    var c = x.cable, A = endInfo(c, 'a'), B = endInfo(c, 'b');
    var g = function (E) { return E ? (E.end.label ? E.end.label + ': ' : '') + (E.b ? GENDER_SHORT[E.end.gender] || E.end.gender : E.end.gender) : ''; };
    var ends = B ? (x.flip ? g(B) + ' ↔ ' + g(A) : g(A) + ' ↔ ' + g(B)) : g(A);
    return '<li class="cresult"><a href="#conn/' + esc(encodeURIComponent(c.id)) + '"><b>' + esc(c.name || c.id) + '</b></a> ' +
      '<span class="chip">' + esc((KIND[c.kind] || { short: c.kind }).short) + '</span>' +
      (c.vendor ? ' <span class="badge badge--unv">Theo hãng, không phải chuẩn</span>' : '') +
      '<div class="muted csub">' + esc(ends) + (x.flip ? ' (dữ liệu ghi theo chiều ngược lại)' : '') + '</div>' +
      (c.use ? '<div class="csub">' + esc(c.use) + '</div>' : '') +
      (c.warnings && c.warnings.length ? '<div class="csub cwarn-t">⚠ ' + esc(c.warnings[0]) + (c.warnings.length > 1 ? ' (+' + (c.warnings.length - 1) + ')' : '') + '</div>' : '') + '</li>';
  }

  // ---------- panel chi tiết ----------
  function renderDetail() {
    var el = document.getElementById('detail'); if (!el) return;
    var s = '';
    if (cv.kind === 'pinout') s = detailPinout(pinoutById(cv.id));
    else if (cv.kind === 'cable') s = detailCable(cableById(cv.id));
    else s = '<div class="detail-card"><span class="eyebrow">Đấu nối</span><h2>Chuyển đổi</h2><p>Chỉ liệt kê cách nối <b>thụ động</b>. ' +
      'Nối hai chuẩn tín hiệu khác nhau (USB ↔ RS-232, RS-232 ↔ RS-485, USB ↔ TTL) cần mạch có IC, không chế bằng dây được.</p></div>';
    el.innerHTML = s + help();
  }
  function help() {
    return '<div class="detail-empty"><h2>Cách đọc</h2><ol>' +
      '<li><b>Phối cảnh cắm</b>: hình nghiêng đầu cáp cắm vào ổ, cho biết mặt nào là mặt cắm, mặt nào là phía hàn. Bấm con mắt để sang hình phẳng.</li>' +
      '<li><b>Mặt cắm</b> là mặt bạn nhìn khi sắp cắm; <b>phía hàn</b> là mặt sau, nơi hàn dây — hai hình là ảnh gương của nhau.</li>' +
      '<li>Đầu đực (chân) và đầu cái (lỗ) nhìn từ mặt cắm cũng là ảnh gương, vì khi cắm hai mặt úp vào nhau.</li>' +
      '<li>Hướng tín hiệu tính từ thiết bị mang sơ đồ chân (vd. DTE): “Ra” ở DTE là “Vào” ở DCE.</li>' +
      '<li>Rê chuột hoặc nhấn vào chân/dây để tô sáng hàng tương ứng trong bảng.</li></ol></div>';
  }
  function detailPinout(p) {
    if (!p) return '';
    var b = bodyOf(p), pins = mergedPins(p, cv.st.variant[p.id] || ''), pm = pinMap(pins), gmap = groupMap(p);
    var pin = cv.sel && cv.sel.indexOf('p:') === 0 ? pm[cv.sel.slice(2)] : null;
    if (!pin) {
      return '<div class="detail-card"><span class="eyebrow">Sơ đồ chân</span><h2>' + esc(p.name || p.id) + '</h2>' +
        '<dl class="kv"><dt>Thân</dt><dd>' + esc(b ? b.name : p.body) + '</dd>' + (p.role ? '<dt>Vai trò</dt><dd>' + esc(ROLE_HINT[p.role] || p.role) + '</dd>' : '') +
        '<dt>Chuẩn</dt><dd>' + esc(p.standard || '–') + '</dd></dl><p class="muted">Chọn một chân để xem chi tiết.</p></div>';
    }
    var g = gmap[pin.pin], d = DIR[pin.dir];
    var conn = cablesFor(p.id).map(function (c) {
      var hits = [];
      (c.wires || []).forEach(function (w) {
        if (c.a.pinout === p.id && String(w.a) === pin.pin) hits.push(c.b ? '→ B ' + pinLabel(endInfo(c, 'b'), String(w.b)) : '→ ' + pinLabel(endInfo(c, 'a'), String(w.a2)));
        if (!c.b && c.a.pinout === p.id && String(w.a2) === pin.pin) hits.push('← ' + pinLabel(endInfo(c, 'a'), String(w.a)));
        if (c.b && c.b.pinout === p.id && String(w.b) === pin.pin) hits.push('← A ' + pinLabel(endInfo(c, 'a'), String(w.a)));
      });
      return hits.length ? '<li><a href="#conn/' + esc(encodeURIComponent(c.id)) + '">' + esc(c.name || c.id) + '</a>: ' + esc(hits.join('; ')) + '</li>' : '';
    }).join('');
    return '<div class="detail-card"><div class="crumbs">' + esc(p.name || p.id) + '</div><h2>Chân ' + esc(pin.pin) + (pin.signal ? ' · ' + esc(pin.signal) : '') + '</h2>' +
      (pin.name ? '<p class="lead">' + esc(pin.name) + '</p>' : '') +
      '<dl class="kv"><dt>Hướng</dt><dd>' + dirHtml(pin) + (d ? ' <span class="muted">(' + esc(d.hint) + (p.role ? ', nhìn từ ' + esc(p.role) : '') + ')</span>' : '') + '</dd>' +
      (g ? '<dt>Nhóm</dt><dd>' + esc(g.name) + '</dd>' : '') +
      (pin.v24 ? '<dt>V.24</dt><dd>' + esc(pin.v24) + '</dd>' : '') +
      (pin.color ? '<dt>Màu dây</dt><dd>' + swatch(pin.color) + esc(pin.color) + '</dd>' : '') +
      (pin.pair ? '<dt>Cặp</dt><dd>' + esc(pin.pair) + '</dd>' : '') + '</dl>' +
      (pin.desc ? '<p>' + esc(pin.desc) + '</p>' : '') +
      (conn ? '<h3>Trong các cáp</h3><ul class="clinks">' + conn + '</ul>' : '') + '</div>';
  }
  function detailCable(c) {
    if (!c) return '';
    var A = endInfo(c, 'a'), B = endInfo(c, 'b'), sel = cv.sel || '';
    var m = /^w(\d+)$/.exec(sel), w = m ? (c.wires || [])[+m[1]] : null;
    if (w) {
      var pa = A.pm[String(w.a)], pb = c.b ? B.pm[String(w.b)] : A.pm[String(w.a2)];
      return '<div class="detail-card"><div class="crumbs">' + esc(c.name || c.id) + '</div><h2>Dây ' + (+m[1] + 1) + '</h2>' +
        '<dl class="kv"><dt>Từ</dt><dd>A ' + esc(pinLabel(A, String(w.a))) + (pa ? ' ' + dirHtml(pa) : '') + '</dd>' +
        '<dt>Tới</dt><dd>' + (c.b ? 'B ' + esc(pinLabel(B, String(w.b))) : esc(pinLabel(A, String(w.a2)))) + (pb ? ' ' + dirHtml(pb) : '') + '</dd>' +
        (pa && pa.color ? '<dt>Màu dây</dt><dd>' + swatch(pa.color) + esc(pa.color) + '</dd>' : '') + '</dl>' +
        (w.note ? '<p>' + esc(w.note) + '</p>' : '') +
        (pa && pb && pa.dir === 'out' && pb.dir === 'out' ? '<div class="alert alert--warn">Hai đầu đều là “Ra” — kiểm tra lại vai trò thiết bị hai đầu.</div>' : '') + '</div>';
    }
    var pm2 = /^([ab]):(.+)$/.exec(sel);
    if (pm2) {
      var E = pm2[1] === 'b' ? B : A, pin = E && E.pm[pm2[2]];
      if (pin) return '<div class="detail-card"><div class="crumbs">' + esc(c.name || c.id) + ' · đầu ' + pm2[1].toUpperCase() + '</div><h2>Chân ' + esc(pin.pin) + (pin.signal ? ' · ' + esc(pin.signal) : '') + '</h2>' +
        (pin.name ? '<p class="lead">' + esc(pin.name) + '</p>' : '') + '<dl class="kv"><dt>Hướng</dt><dd>' + dirHtml(pin) + '</dd></dl>' + (pin.desc ? '<p>' + esc(pin.desc) + '</p>' : '') +
        (E.p ? '<p><a href="#conn/' + esc(encodeURIComponent(E.p.id)) + '">Mở sơ đồ chân ' + esc(E.p.name || E.p.id) + '</a></p>' : '') + '</div>';
    }
    return '<div class="detail-card"><span class="eyebrow">' + esc((KIND[c.kind] || { name: c.kind }).name) + '</span><h2>' + esc(c.name || c.id) + '</h2>' +
      (c.vendor ? '<p><span class="badge badge--unv">Theo hãng, không phải chuẩn</span></p>' : '') +
      '<dl class="kv"><dt>Đầu A</dt><dd>' + esc(A.p ? A.p.name : c.a.pinout) + ' · ' + esc(GENDER_SHORT[c.a.gender] || c.a.gender) + '</dd>' +
      (B ? '<dt>Đầu B</dt><dd>' + esc(B.p ? B.p.name : c.b.pinout) + ' · ' + esc(GENDER_SHORT[c.b.gender] || c.b.gender) + '</dd>' : '') +
      '<dt>Số dây</dt><dd>' + (c.wires || []).length + '</dd>' + (c.standard ? '<dt>Nguồn</dt><dd>' + esc(c.standard) + '</dd>' : '') + '</dl>' +
      '<p class="muted">Chọn một dây hoặc một chân để xem chi tiết.</p></div>';
  }

  // ---------- tương tác ----------
  function setCls(cls, key) {
    var v = viewEl(); if (!v) return;
    Array.prototype.forEach.call(v.querySelectorAll('.' + cls), function (x) { x.classList.remove(cls); });
    if (!key) return;
    Array.prototype.forEach.call(v.querySelectorAll('[data-k~="' + attrQ(key) + '"]'), function (x) { x.classList.add(cls); });
  }
  function select(key, scroll) {
    cv.sel = cv.sel === key ? null : key;
    setCls('is-sel', cv.sel);
    renderDetail();
    if (scroll && cv.sel) {
      var row = viewEl().querySelector('tr[data-h="' + attrQ(cv.sel) + '"]');
      if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
    }
  }
  function render() {
    var v = viewEl(); if (!v) return;
    var alerts = window.AppNav ? window.AppNav.loadAlertsHtml() : '';
    var html;
    if (cv.kind === 'convert') html = renderConvert();
    else if (cv.kind === 'pinout') html = renderPinout(pinoutById(cv.id));
    else if (cv.kind === 'cable') html = renderCable(cableById(cv.id));
    else html = '<div class="empty"><h1>Không có mục “' + esc(cv.id) + '”</h1></div>';
    var al = document.getElementById('alerts'); if (al) al.innerHTML = alerts;
    v.innerHTML = html;
    if (cv.sel) setCls('is-sel', cv.sel);
    renderDetail();
  }

  function onClick(e) {
    if (!cv.active || !e.target.closest) return;
    var t;
    if ((t = e.target.closest('[data-cside]'))) { cv.st.side = t.getAttribute('data-cside'); save(); render(); return; }
    if ((t = e.target.closest('[data-cvar]'))) { cv.st.variant[cv.id] = t.getAttribute('data-cvar'); save(); render(); return; }
    if ((t = e.target.closest('[data-cswap]'))) { var a = cv.st.conv.a; cv.st.conv.a = cv.st.conv.b; cv.st.conv.b = a; save(); render(); return; }
    if ((t = e.target.closest('[data-h]'))) { select(t.getAttribute('data-h'), t.tagName !== 'TR'); }
  }
  function onOver(e) {
    if (!cv.active || !e.target.closest) return;
    var t = e.target.closest('[data-h]');
    setCls('is-hl', t ? t.getAttribute('data-h') : null);
  }
  function onKey(e) {
    if (!cv.active || (e.key !== 'Enter' && e.key !== ' ')) return;
    var eye = e.target.closest && e.target.closest('g[data-cside]');
    if (eye) { e.preventDefault(); cv.st.side = eye.getAttribute('data-cside'); save(); render(); return; }
    var t = e.target.closest && e.target.closest('g[data-h]');
    if (t) { e.preventDefault(); select(t.getAttribute('data-h'), true); }
  }

  function init() {
    var v = viewEl(); if (!v) throw new Error('Thiếu #view-conn trong index.html');
    var s = storeGet();
    if (s && typeof s === 'object') {
      cv.st.side = SIDES.indexOf(s.side) >= 0 ? s.side : 'persp';
      cv.st.variant = s.variant && typeof s.variant === 'object' ? s.variant : {};
      cv.st.conv = s.conv && typeof s.conv === 'object' ? s.conv : {};
    }
    v.addEventListener('click', onClick);
    v.addEventListener('mouseover', onOver);
    v.addEventListener('mouseleave', function () { setCls('is-hl', null); });
    v.addEventListener('focusin', onOver);
    v.addEventListener('keydown', onKey);
    v.addEventListener('change', function (e) {
      var t = e.target;
      if (cv.active && t.matches && t.matches('[data-cconv]')) { cv.st.conv[t.getAttribute('data-cconv')] = t.value; save(); render(); }
    });
  }
  function show(id) {
    cv.active = true;
    if (cv.id !== id) cv.sel = null;
    cv.id = id;
    cv.kind = id === 'convert' ? 'convert' : pinoutById(id) ? 'pinout' : cableById(id) ? 'cable' : null;
    render();
  }
  function hide() { cv.active = false; }

  var ConnViz = {
    mirrored: mirrored, facePins: facePins, faceKeys: faceKeys, mergedPins: mergedPins, groupMap: groupMap,
    resolvePin: resolvePin, parseRef: parseRef, cablesFor: cablesFor, convertMatches: convertMatches,
    navModel: navModel, faceGeom: faceGeom, parseColor: parseColor, pinoutSearch: pinoutSearch, cableSearch: cableSearch,
    perspFace: perspFace, perspMating: perspMating, perspCableLayout: perspCableLayout, perspGenders: perspGenders,
    perspPinoutScene: perspPinoutScene, perspCableScene: perspCableScene, perspPinBoxes: perspPinBoxes, textBox: textBox, lblSize: lblSize
  };
  root.ConnViz = ConnViz;
  if (typeof document !== 'undefined') root.ConnView = { init: init, show: show, hide: hide, navModel: navModel };
  if (typeof module !== 'undefined' && module.exports) module.exports = ConnViz;
})(typeof window !== 'undefined' ? window : globalThis);
