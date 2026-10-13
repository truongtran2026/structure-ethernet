/*
 * quiz.js — "Ôn tập": câu hỏi trắc nghiệm TỰ SINH từ dữ liệu đã kiểm duyệt
 * (window.HEADERS/STACKS và TFRAMES/TMUX/TLABS). Không có câu hỏi viết tay.
 *
 *  1) Phần thuần (QuizGen, xuất cả module.exports để test bằng Node):
 *     buildPool(data) → mẫu câu theo chủ đề; generate(data, topic, n, seed) → bộ câu xác định theo seed.
 *     Mỗi câu: đúng 4 lựa chọn khác nhau, đúng 1 đáp án; mẫu nào có thể mơ hồ thì bỏ (xem các hàm tpl*).
 *  2) Phần giao diện (QuizView, chỉ khi có document): view #quiz/<chủ đề>, điểm + lịch sử + câu sai
 *     lưu localStorage (bọc try/catch), nút "Mở ở đây" nhảy tới stack/khung/lab tương ứng.
 */
(function (root) {
  'use strict';

  var TOPICS = [
    { id: 'all', name: 'Tất cả', hint: 'Trộn mọi chủ đề' },
    { id: 'ip', name: 'IP / Ethernet', hint: 'Header, field, stack, vai trò đóng gói' },
    { id: 'pdh', name: 'PDH', hint: 'E1…E4: khung, tốc độ, ghép kênh' },
    { id: 'sdh', name: 'SDH', hint: 'STM-N, VC, TU, TUG: khung, con trỏ, overhead' },
    { id: 'otn', name: 'OTN', hint: 'OTUk/ODUk/OPUk, tributary slot' },
    { id: 'flexe', name: 'FlexE', hint: 'Instance 100G, khe lịch 5G, nhóm, PHY mang FlexE' },
    { id: 'eos', name: 'Ethernet qua truyền dẫn', hint: 'GFP-F, VCAT, ODUflex(GFP)' }
  ];
  var TYPE_NAME = {
    'ip-bits': 'Độ dài field', 'ip-offset': 'Vị trí field', 'ip-value': 'Giá trị field',
    'ip-hbytes': 'Độ dài header', 'ip-added': 'Header thêm vào', 'ip-role': 'Vai trò đóng gói',
    't-cell': 'Ô trong khung', 't-bits': 'Bit trong byte', 'u-rate': 'Tốc độ',
    'u-max': 'Số nhánh tối đa', 'u-oh': 'Overhead bước ghép', 'u-ts': 'Tributary slot'
  };

  // ---------- số ngẫu nhiên theo seed ----------
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  /** mulberry32: rng() ∈ [0,1), cùng seed → cùng dãy. */
  function rngOf(seed) {
    var a = hashStr(seed) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(arr, rng) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function pickOne(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

  // ---------- định dạng ----------
  function fmtNum(n, d) {
    var TV = root.TransViz;
    if (TV && TV.fmtNum) return TV.fmtNum(n, d);
    return String(Math.round(n * 1000) / 1000).replace('.', ',');
  }
  function fmtRate(k) {
    var TV = root.TransViz;
    return TV && TV.fmtRate ? TV.fmtRate(k) : fmtNum(k, 3) + ' kbit/s';
  }
  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function uniq(a) { var s = {}, out = []; a.forEach(function (x) { if (!s[x]) { s[x] = 1; out.push(x); } }); return out; }

  // ---------- dữ liệu ----------
  function dataFrom(g) {
    g = g || root;
    return {
      H: g.HEADERS || {}, S: Array.isArray(g.STACKS) ? g.STACKS.filter(function (s) { return s && s.id; }) : [],
      F: g.TFRAMES || {}, M: g.TMUX || {}, LABS: Array.isArray(g.TLABS) ? g.TLABS : [],
      EV: g.EthViz || null, TV: g.TransViz || null
    };
  }

  // ---------- phân chủ đề ----------
  /** Stack thuộc mảng "Ethernet qua truyền dẫn" theo category của dữ liệu. */
  function stackIsEos(st) { return /truyền dẫn|transport/i.test(String(st.category || '')); }
  function isGfp(a) { return /GFP/i.test(String(a && a.mapping || '')); }
  /**
   * Đơn vị thuộc chủ đề Ethernet qua truyền dẫn: VCG; đơn vị chỉ nhận ánh xạ GFP (ODUflex(GFP));
   * client chỉ xuất hiện trong ánh xạ GFP (Ethernet GFP-F).
   */
  function unitIsEos(M, id) {
    var u = M[id];
    if (!u) return false;
    if (u.kind === 'vcg' || u.members) return true;
    var acc = u.accepts || [];
    if (acc.length) return acc.every(isGfp);
    var uses = [];
    Object.keys(M).forEach(function (k) { (M[k].accepts || []).forEach(function (a) { if (a.of === id) uses.push(a); }); });
    return uses.length > 0 && uses.every(isGfp);
  }
  function unitTopic(D, id) { return unitIsEos(D.M, id) ? 'eos' : (D.M[id] && D.M[id].family) || 'sdh'; }
  function frameTopic(D, f) {
    var eos = Object.keys(D.M).some(function (k) { return D.M[k].frame === f.id && unitIsEos(D.M, k); });
    return eos ? 'eos' : f.family;
  }

  // ---------- IP: duyệt field ----------
  /** Lá của header theo thứ tự: { def, id, name, label, optional, isVar, bits, path[] (tên group cha) }. */
  function headerLeaves(h) {
    var out = [];
    (function walk(list, parents, opt) {
      (list || []).forEach(function (d) {
        var o = opt || !!d.optional;
        if (Array.isArray(d.children)) { walk(d.children, parents.concat([d.name || d.id]), o); return; }
        out.push({ def: d, id: d.id, name: d.name || d.id, optional: o, isVar: !!d.varBytes, bits: d.bits || 0, parents: parents });
      });
    })(h.fields, [], false);
    // nhãn: tên field; trùng tên trong header → "Group › tên"; vẫn trùng → null (không dùng làm nhãn)
    var cnt = {};
    out.forEach(function (l) { cnt[l.name] = (cnt[l.name] || 0) + 1; });
    out.forEach(function (l) { l.label = cnt[l.name] === 1 ? l.name : (l.parents.length ? l.parents[l.parents.length - 1] + ' › ' + l.name : null); });
    var cnt2 = {};
    out.forEach(function (l) { if (l.label) cnt2[l.label] = (cnt2[l.label] || 0) + 1; });
    out.forEach(function (l) { if (l.label && cnt2[l.label] > 1) l.label = null; });
    return out;
  }
  /** Bố cục tối thiểu (không bật optional): offset bit của các lá có mặt, dừng ở field varBytes đầu tiên. */
  function minimalOffsets(h) {
    var pos = 0, out = [], stopped = false;
    headerLeaves(h).forEach(function (l) {
      if (l.optional) return;
      if (l.isVar) { stopped = true; return; }
      out.push({ leaf: l, offset: pos, fixed: !stopped });
      pos += l.bits;
    });
    return out;
  }
  /** Kích thước header (byte) theo biến thể: field không optional + optional được bật + varBytes của biến thể. */
  function headerBytes(h, variant) {
    var enable = (variant && variant.enable) || [];
    var vb = (variant && variant.varBytes) || {};
    var bits = 0;
    (function walk(list, on) {
      (list || []).forEach(function (d) {
        var here = on && (!d.optional || enable.indexOf(d.id) >= 0);
        if (Array.isArray(d.children)) { walk(d.children, here); return; }
        if (!here) return;
        if (d.varBytes) bits += 8 * (has(vb, d.id) ? vb[d.id] : (d.varBytes.default != null ? d.varBytes.default : (d.varBytes.min || 0)));
        else bits += d.bits || 0;
      });
    })(h.fields, true);
    return bits / 8;
  }
  /** Nhãn header trong lựa chọn: short (nếu duy nhất) hoặc name. */
  function headerLabeler(H) {
    var cnt = {};
    Object.keys(H).forEach(function (k) { var s = H[k].short || H[k].name; cnt[s] = (cnt[s] || 0) + 1; });
    return function (hid) { var h = H[hid]; if (!h) return hid; var s = h.short || h.name; return cnt[s] === 1 ? s : (h.name || hid); };
  }
  function countHeaders(tree, out) {
    out = out || {};
    (tree || []).forEach(function (sn) {
      if (!sn) return;
      if (Array.isArray(sn.children)) countHeaders(sn.children, out);
      else if (sn.header) out[sn.header] = (out[sn.header] || 0) + 1;
    });
    return out;
  }
  /** Giá trị "đơn" (một số: 0x.., thập phân, nhị phân) — không phải dải/danh sách/“khác”. */
  function simpleV(v) { return /^\s*(0x[0-9a-f]+|[0-9]+)\s*$/i.test(String(v)); }
  function numV(v) { var s = String(v).trim(); return /^0x/i.test(s) ? parseInt(s, 16) : parseInt(s, 10); }

  // ---------- chọn nhiễu ----------
  /** 3 nhiễu từ danh sách văn bản (theo thứ tự ưu tiên từng tầng), khác đáp án và khác nhau. */
  function textDistractors(answer, tiers, rng) {
    var seen = {}, out = [];
    seen[answer] = true;
    tiers.forEach(function (tier) {
      if (out.length >= 3) return;
      shuffle(uniq(tier.filter(function (t) { return t != null && t !== ''; })), rng).forEach(function (t) {
        if (out.length < 3 && !seen[t]) { seen[t] = true; out.push(t); }
      });
    });
    return out.length === 3 ? out : null;
  }
  /** 3 nhiễu số gần đáp án (theo tỉ lệ log) lấy từ pool; fmt định dạng — trùng chuỗi coi như trùng. */
  function numDistractors(ans, pool, fmt, rng) {
    var a = fmt(ans), seen = {}, cand = [];
    seen[a] = true;
    pool.forEach(function (v) {
      if (!(v > 0) && v !== 0) return;
      var s = fmt(v);
      if (seen[s]) return;
      seen[s] = true;
      var d = ans > 0 && v > 0 ? Math.abs(Math.log(v / ans)) : Math.abs(v - ans) + 50;
      cand.push({ v: v, s: s, d: d + rng() * 0.15 });
    });
    if (cand.length < 3) return null;
    cand.sort(function (x, y) { return x.d - y.d; });
    return shuffle(cand.slice(0, Math.min(6, cand.length)), rng).slice(0, 3).map(function (c) { return c.s; });
  }
  function assemble(q, answerText, distractors, rng) {
    if (!distractors || distractors.length !== 3) return null;
    var opts = shuffle([answerText].concat(distractors), rng);
    q.options = opts;
    q.answer = opts.indexOf(answerText);
    return q;
  }

  // ---------- chống lộ đáp án ----------
  /** Chuẩn hoá để so khớp: chữ thường, mọi dấu câu/khoảng trắng → một dấu cách, bọc dấu cách hai đầu (so khớp theo từ). */
  function norm(s) {
    return ' ' + String(s == null ? '' : s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim() + ' ';
  }
  function isPlainNumber(s) { return !/[^\d\s.,]/.test(String(s)); }
  /** Số chính của đáp án: nhóm số đầu tiên, giữ phần thập phân ("100 Mbit/s" → "100", "9,584 Gbit/s" → "9,584"). */
  function mainNumber(s) { var m = /\d+(?:[.,]\d+)?/.exec(String(s)); return m ? m[0] : null; }
  /** Các số đứng riêng trong tên đối tượng (không dính sau chữ cái: "ODU2", "IPv4" không tính; "STM-16", "40GbE", " 8 TS" có). */
  function standaloneNumbers(name) {
    var out = [], re = /(^|[^A-Za-z\d])(\d+(?:[.,]\d+)?)/g, m;
    while ((m = re.exec(String(name)))) out.push(m[2]);
    return out;
  }
  function numberInNames(ans, names) {
    var n = mainNumber(ans);
    if (!n) return false;
    return (names || []).some(function (nm) { return standaloneNumbers(nm).indexOf(n) >= 0; });
  }
  /**
   * Đề có lộ đáp án không? (1) đề (đã chuẩn hoá) chứa đáp án hoặc tên rút gọn của đáp án (q.alias),
   * đáp án thuần số bỏ qua; (2) số chính của đáp án xuất hiện trong tên đối tượng của đề (q.objNames).
   */
  function isLeaky(q) {
    var a = q.options[q.answer], P = norm(q.prompt);
    var names = [a].concat(q.alias || []);
    for (var i = 0; i < names.length; i++) {
      var s = names[i];
      if (s == null || isPlainNumber(s)) continue;
      var n = norm(s);
      if (n.length <= 3) continue; // ' x ' — quá ngắn để kết luận
      if (P.indexOf(n) >= 0) return true;
    }
    return !!(q.objNames && numberInNames(a, q.objNames));
  }
  /** Dựng câu từ mẫu và bỏ nếu lộ đáp án. */
  function makeQ(t, rng) {
    var q = t.make(rng);
    return q && !isLeaky(q) ? q : null;
  }

  // ---------- mẫu câu IP ----------
  function ipTemplates(D, out) {
    var H = D.H, S = D.S, hl = headerLabeler(H);
    var stacksOf = {};
    S.forEach(function (st) { Object.keys(countHeaders(st.tree)).forEach(function (hid) { (stacksOf[hid] = stacksOf[hid] || []).push(st); }); });
    function hTopic(hid) { var l = stacksOf[hid] || []; return l.length && l.every(stackIsEos) ? 'eos' : 'ip'; }
    function openStack(hid, extra) {
      var l = stacksOf[hid] || [], t = hTopic(hid);
      var st = l.filter(function (s) { return (t === 'eos') === stackIsEos(s); })[0] || l[0];
      return st ? Object.assign({ kind: 'ip', stack: st.id, header: hid, label: st.name || st.id }, extra || {}) : null;
    }
    function hName(h) { return h.name + (h.short && h.name.indexOf(h.short) < 0 ? ' (' + h.short + ')' : ''); }
    var allBits = [], allBytes = [];
    Object.keys(H).forEach(function (hid) {
      var h = H[hid];
      headerLeaves(h).forEach(function (l) { if (!l.isVar && l.bits) allBits.push(l.bits); });
      if (h.layer === 'payload') return;
      if (h.variants && h.variants.length) h.variants.forEach(function (v) { var b = headerBytes(h, v); if (b > 0) allBytes.push(b); });
      else if (h.fixedBytes > 0) allBytes.push(h.fixedBytes);
    });

    Object.keys(H).forEach(function (hid) {
      var h = H[hid], topic = hTopic(hid);
      if (h.layer === 'payload') return;
      var leaves = headerLeaves(h);
      // (1) độ dài field — chỉ field có tên phân biệt được, không varBytes
      leaves.forEach(function (l) {
        if (!l.label || l.isVar || !l.bits) return;
        out.push({ key: 'ip-bits|' + hid + '|' + l.id, topic: topic, type: 'ip-bits', make: function (rng) {
          var q = { prompt: 'Field “' + l.label + '” trong header ' + hName(h) + ' dài bao nhiêu bit?',
            explain: l.def.desc || '', open: openStack(hid, { field: l.id }),
            check: { header: hid, field: l.id } };
          return assemble(q, l.bits + ' bit', numDistractors(l.bits, allBits, function (v) { return v + ' bit'; }, rng), rng);
        } });
      });
      // (2) field bắt đầu ở bit k (cấu hình tối thiểu) — nhiễu là field khác của cùng header
      var lay = minimalOffsets(h).filter(function (x) { return x.leaf.label; });
      if (lay.length >= 4) {
        lay.forEach(function (x) {
          if (!x.fixed) return;
          out.push({ key: 'ip-offset|' + hid + '|' + x.leaf.id, topic: topic, type: 'ip-offset', make: function (rng) {
            var others = lay.filter(function (y) { return y !== x; });
            var d = textDistractors(x.leaf.label, [others.map(function (y) { return y.leaf.label; })], rng);
            if (!d) return null;
            var q = { prompt: 'Trong header ' + hName(h) + ' (cấu hình tối thiểu, không bật trường tuỳ chọn), field nào bắt đầu tại bit offset ' + x.offset + ' (bit 0 = bit đầu tiên của header)?',
              explain: x.leaf.label + ' chiếm bit ' + x.offset + '–' + (x.offset + x.leaf.bits - 1) + '. ' + (x.leaf.def.desc || ''),
              open: openStack(hid, { field: x.leaf.id }),
              alias: [x.leaf.name, x.leaf.def.abbr],
              check: { header: hid, offset: x.offset, field: x.leaf.id,
                byLabel: lay.reduce(function (m, y) { m[y.leaf.label] = y.leaf.id; return m; }, {}) } };
            return assemble(q, x.leaf.label, d, rng);
          } });
        });
      }
      // (3) ý nghĩa giá trị — chỉ giá trị đơn, không trùng trong field; nhiễu không cùng giá trị
      leaves.forEach(function (l) {
        if (!l.label || !l.def.values) return;
        var vals = l.def.values;
        vals.forEach(function (e) {
          if (!simpleV(e.v)) return;
          var n = numV(e.v);
          if (vals.filter(function (x) { return simpleV(x.v) && numV(x.v) === n; }).length !== 1) return;
          if (vals.filter(function (x) { return x.m === e.m; }).length !== 1) return;
          out.push({ key: 'ip-value|' + hid + '|' + l.id + '|' + e.v, topic: topic, type: 'ip-value', make: function (rng) {
            // tầng 1: giá trị khác của cùng field; tầng 2: giá trị (khác số) của field khác cùng header
            var t1 = vals.filter(function (x) { return x !== e && simpleV(x.v) && numV(x.v) !== n; }).map(function (x) { return x.m; });
            // tầng 2 bỏ nghĩa có nhắc tới chính field này (vd UPI "PTI 000: …" khi hỏi PTI) — có thể cũng đúng
            var t2 = [], refs = [l.def.abbr, l.name].filter(Boolean).map(function (s) { return String(s).toLowerCase(); });
            leaves.forEach(function (o) {
              if (o === l || !o.def.values) return;
              o.def.values.forEach(function (x) {
                var m = String(x.m).toLowerCase();
                if (simpleV(x.v) && numV(x.v) !== n && !refs.some(function (r) { return m.indexOf(r) >= 0; })) t2.push(x.m);
              });
            });
            var d = textDistractors(e.m, [t1, t2], rng);
            var q = { prompt: 'Field “' + l.label + '” của header ' + hName(h) + ' có giá trị ' + e.v + '. Giá trị này nghĩa là gì?',
              explain: l.def.desc || '', open: openStack(hid, { field: l.id }),
              check: { header: hid, field: l.id, v: e.v } };
            return assemble(q, e.m, d, rng);
          } });
        });
      });
      // (4) độ dài header (từng biến thể, hoặc fixedBytes khi không có biến thể)
      var vs = (h.variants && h.variants.length) ? h.variants : [null];
      vs.forEach(function (v) {
        var b = v ? headerBytes(h, v) : h.fixedBytes;
        if (!(b > 0)) return;
        if (v && h.variants.filter(function (x) { return x.name === v.name; }).length > 1) return;
        out.push({ key: 'ip-hbytes|' + hid + '|' + (v ? v.id : ''), topic: topic, type: 'ip-hbytes', make: function (rng) {
          var q = { prompt: 'Header ' + hName(h) + (v ? ', biến thể “' + v.name + '”,' : '') + ' dài bao nhiêu byte?',
            explain: (h.summary || '') + (v && v.note ? ' — ' + v.note : ''), open: openStack(hid),
            check: { header: hid, variant: v ? v.id : null } };
          return assemble(q, fmtNum(b, 2) + ' byte', numDistractors(b, allBytes, function (x) { return fmtNum(x, 2) + ' byte'; }, rng), rng);
        } });
      });
    });

    // (5) header được thêm so với compareTo; (6) header thuộc vai trò R
    var byId = {};
    S.forEach(function (st) { byId[st.id] = st; });
    var allHids = Object.keys(H);
    S.forEach(function (st) {
      var topic = stackIsEos(st) ? 'eos' : 'ip';
      var model = null;
      try { model = D.EV ? D.EV.buildModel(st, {}, H, S) : null; } catch (e) { model = null; }
      if (!model) return;
      var nodes = model.headers.filter(function (n) { return n.headerId && H[n.headerId]; });
      var cS = countHeaders(st.tree);
      var stName = st.name || st.id;
      var base = st.compareTo && byId[st.compareTo];
      if (base) {
        var cB = countHeaders(base.tree);
        var addedHid = {};
        nodes.forEach(function (n) { if (n.added) addedHid[n.headerId] = true; });
        var isAdded = function (hid) { return (cS[hid] || 0) > (cB[hid] || 0) && !!addedHid[hid]; };
        var notAdded = function (hid) { return (cS[hid] || 0) <= (cB[hid] || 0) && !addedHid[hid]; };
        Object.keys(cS).filter(isAdded).forEach(function (hid) {
          out.push({ key: 'ip-added|' + st.id + '|' + hid, topic: topic, type: 'ip-added', make: function (rng) {
            var t1 = Object.keys(cB).filter(notAdded), t2 = Object.keys(cS).filter(notAdded), t3 = allHids.filter(notAdded);
            var lab = function (l) { return l.map(hl); };
            var d = textDistractors(hl(hid), [lab(t1), lab(t2), lab(t3)], rng);
            var first = nodes.filter(function (n) { return n.headerId === hid && n.added; })[0];
            var q = { prompt: 'So với stack “' + (base.name || base.id) + '”, stack “' + stName + '” được THÊM header nào?',
              explain: (st.detail || st.summary || '') , open: { kind: 'ip', stack: st.id, path: first && first.path, label: stName },
              alias: [H[hid].short, H[hid].name],
              check: { stack: st.id, base: base.id, header: hid } };
            return assemble(q, hl(hid), d, rng);
          } });
        });
      }
      var roles = uniq(nodes.map(function (n) { return n.role; }).filter(Boolean));
      if (roles.length >= 2) {
        roles.forEach(function (r) {
          var inR = {};
          nodes.forEach(function (n) { if (n.role === r) inR[n.headerId] = true; });
          Object.keys(inR).forEach(function (hid) {
            out.push({ key: 'ip-role|' + st.id + '|' + r + '|' + hid, topic: topic, type: 'ip-role', make: function (rng) {
              var t1 = Object.keys(cS).filter(function (x) { return !inR[x]; });
              var t2 = allHids.filter(function (x) { return !inR[x] && H[x].layer !== 'payload'; });
              var d = textDistractors(hl(hid), [t1.map(hl), t2.map(hl)], rng);
              var info = D.EV.roleInfo(r);
              var first = nodes.filter(function (n) { return n.headerId === hid && n.role === r; })[0];
              var q = { prompt: 'Trong stack “' + stName + '”, header nào thuộc vai trò ' + info.long + '?',
                explain: info.desc + (st.roleNote ? ' — ' + st.roleNote : ''), open: { kind: 'ip', stack: st.id, path: first && first.path, label: stName },
                alias: [H[hid].short, H[hid].name],
                check: { stack: st.id, role: r, header: hid } };
              return assemble(q, hl(hid), d, rng);
            } });
          });
        });
      }
    });
  }

  // ---------- mẫu câu Truyền dẫn ----------
  function regionLabel(rg) {
    var a = rg.abbr, n = rg.name || rg.id;
    return a && a !== n ? a + ' — ' + n : n;
  }
  function bfLabel(b) { return b.abbr && b.abbr !== b.name ? b.abbr + ' — ' + b.name : (b.name || b.abbr); }

  function frameTemplates(D, out) {
    var TV = D.TV;
    if (!TV) return;
    var seenCell = {}, seenBf = {};
    var frames = Object.keys(D.F).map(function (k) { return D.F[k]; }).filter(function (f) { return f && f.id && f.grid; });
    var famOrder = { pdh: 1, sdh: 2, otn: 3, flexe: 4 };
    frames.sort(function (a, b) { return (famOrder[a.family] || 9) - (famOrder[b.family] || 9) || (a.order || 0) - (b.order || 0); });
    frames.forEach(function (f) {
      var topic = frameTopic(D, f), fm;
      try { fm = TV.buildFrame(f); } catch (e) { return; }
      if (fm.errors && fm.errors.length) return;
      var leaves = fm.list.filter(function (x) { return !x.children.length; });
      var leafLabels = uniq(leaves.map(function (x) { return regionLabel(x.region); }));
      var unitWord = f.grid.cellBits === 1 ? 'bit' : f.grid.cellBits === 8 ? 'ô (byte)' : 'ô (khối ' + f.grid.cellBits + 'B)';
      // (7) ô [hàng, cột] thuộc vùng nào — chỉ vùng lá, không perFrame, khung có ≥ 4 nhãn lá
      if (leafLabels.length >= 4) {
        leaves.forEach(function (x) {
          var rg = x.region;
          if (rg.perFrame || !rg.rect) return;
          var lab = regionLabel(rg);
          var k = [topic, f.grid.rows, f.grid.cols, f.grid.cellBits, JSON.stringify(rg.rect), lab].join('|');
          if (seenCell[k]) return;
          seenCell[k] = true;
          out.push({ key: 't-cell|' + f.id + '|' + rg.id, topic: topic, type: 't-cell', make: function (rng) {
            var cells = TV.rectCells(rg.rect, f.grid.cols);
            var cell = pickOne(cells, rng), r = Math.floor(cell / f.grid.cols), c = cell % f.grid.cols;
            var d = textDistractors(lab, [leafLabels], rng);
            var q = { prompt: 'Trong khung ' + f.name + ' (' + f.grid.rows + ' hàng × ' + f.grid.cols + ' cột), ' + unitWord + ' ở hàng ' + (r + 1) + ', cột ' + (c + 1) + ' thuộc vùng nào?',
              explain: lab + ': ' + (rg.desc || '') + ' (' + TV.rectText(rg.rect) + ')', open: { kind: 't', frame: f.id, region: rg.id, label: f.name },
              alias: [rg.abbr, rg.name],
              check: { frame: f.id, r: r, c: c } };
            return assemble(q, lab, d, rng);
          } });
        });
      }
      // (8) bit a–b của byte/vùng là gì — vùng có nhãn duy nhất trong khung, không perFrame
      var labCount = {};
      fm.list.forEach(function (x) { var l = regionLabel(x.region); labCount[l] = (labCount[l] || 0) + 1; });
      var abbrCount = {};
      fm.list.forEach(function (x) { var a = x.region.abbr; if (a) abbrCount[a] = (abbrCount[a] || 0) + 1; });
      var frameBfs = [];
      fm.list.forEach(function (x) { (x.region.bitFields || []).forEach(function (b) { frameBfs.push(bfLabel(b)); }); });
      fm.list.forEach(function (x) {
        var rg = x.region, bfs = rg.bitFields;
        if (!bfs || bfs.length < 2 || rg.perFrame) return;
        var rl = regionLabel(rg);
        if (labCount[rl] !== 1) return;
        var pos = 1;
        bfs.forEach(function (b) {
          var from = pos, to = pos + b.bits - 1;
          pos += b.bits;
          var lab = bfLabel(b);
          var k = [rl, from, to, lab, bfs.map(bfLabel).join(',')].join('|');
          if (seenBf[k]) return;
          seenBf[k] = true;
          out.push({ key: 't-bits|' + f.id + '|' + rg.id + '|' + from, topic: topic, type: 't-bits', make: function (rng) {
            var t1 = bfs.map(bfLabel), d = textDistractors(lab, [t1, frameBfs], rng);
            var alias = [b.abbr, b.name];
            var promptFor = function (ref) {
              return 'Trong khung ' + f.name + ', vùng ' + ref + ': ' + (from === to ? 'bit ' + from : 'bit ' + from + '–' + to) +
                ' (đánh số từ 1' + (pos - 1 === 8 ? ', bit 1 có trọng số lớn nhất' : ' theo thứ tự truyền') + ') là trường nào?';
            };
            var prompt = promptFor(rl);
            // tiêu đề vùng liệt kê tên trường (vd "V5 – BIP-2, REI, …") → thử gọi vùng bằng mã rút gọn duy nhất
            if (isLeaky({ prompt: prompt, options: [lab], answer: 0, alias: alias }) && rg.abbr && abbrCount[rg.abbr] === 1) prompt = promptFor(rg.abbr);
            var q = { prompt: prompt,
              explain: lab + ': ' + (b.desc || '') , open: { kind: 't', frame: f.id, region: rg.id, label: f.name },
              alias: alias,
              check: { frame: f.id, region: rg.id, from: from, to: to } };
            return assemble(q, lab, d, rng);
          } });
        });
      });
    });
  }

  function unitTemplates(D, out) {
    var M = D.M, TV = D.TV, L = TV && TV.lab;
    if (!L) return;
    var ids = Object.keys(M);
    var nm = function (id) { return L.nameOf(M, id); };
    var nameCnt = {};
    ids.forEach(function (id) { nameCnt[nm(id)] = (nameCnt[nm(id)] || 0) + 1; });
    var named = function (id) { return nameCnt[nm(id)] === 1; };
    var rateOf = function (id) { return L.unitKbps(M, id); };
    var topicPool = {};
    ids.forEach(function (id) { var t = unitTopic(D, id); (topicPool[t] = topicPool[t] || []).push(id); });
    var allRates = ids.map(rateOf).filter(function (k) { return k > 0; });
    /** Số "tròn" khi hiển thị (≤ 2 chữ số có nghĩa): 40 Gbit/s, 2,5 Gbit/s, 100 Mbit/s… */
    function isRoundRate(v) {
      return fmtRate(v).replace(/\s*[a-z]+\/s$/i, '').replace(/[^\d]/g, '').replace(/^0+|0+$/g, '').length <= 2;
    }
    /**
     * Tên đơn vị dùng trong đề, không để lộ số chính của đáp án: bỏ đoạn "(…)" chứa nó; nếu tên vẫn chứa
     * (vd "Fast Ethernet 100 Mbit/s") thì cắt số lượng đuôi, chỉ nhận khi tên rút gọn không trùng/lẫn đơn vị khác.
     * Không được → null (bỏ câu).
     */
    function objectName(id, ans) {
      var hasNum = function (s) { return numberInNames(ans, [s]) || norm(s).indexOf(norm(ans)) >= 0; };
      var n = nm(id);
      if (!hasNum(n)) return n;
      n = n.replace(/\s*\([^)]*\)/g, function (m) { return hasNum(m) ? '' : m; });
      if (!hasNum(n)) return n;
      var s = n.replace(/\s*[\d.,]+\s*(?:[MGk]bit\/s|TS)\s*$/, '').trim();
      if (!s || s === n || hasNum(s)) return null;
      var sn = norm(s);
      var clash = ids.some(function (o) { return o !== id && norm(nm(o)).indexOf(sn) >= 0; });
      return clash ? null : s;
    }

    // (9) tốc độ đơn vị
    ids.forEach(function (id) {
      var k = rateOf(id), t = unitTopic(D, id);
      if (!(k > 0) || !named(id)) return;
      out.push({ key: 'u-rate|' + id, topic: t, type: 'u-rate', make: function (rng) {
        var u = M[id], ans = fmtRate(k);
        var oname = objectName(id, ans);
        if (!oname) return null; // tên không thể che số của đáp án mà vẫn duy nhất → bỏ câu
        // nhiễu không được là số tròn gần đúng tên/đáp án (vd "40 Gbit/s" cho 40,143 Gbit/s)
        var keep = function (v) { return v === k || !(isRoundRate(v) && Math.abs(v / k - 1) <= 0.02); };
        var near = (topicPool[t] || []).map(rateOf).filter(keep), wide = near.concat(allRates.filter(keep));
        var d = numDistractors(k, near, fmtRate, rng) || numDistractors(k, wide, fmtRate, rng);
        var coded = u.kind === 'client' && /\b\d+B\/\d+B\b/.test(String(u.summary || ''));
        // rateKbps của client có lineKbps là dòng 64B/66B mang qua OTN, KHÔNG phải tốc độ đường dây → hỏi đúng tên.
        // Không có lineKbps: chỉ gọi "đường dây" khi dữ liệu nói rõ tín hiệu vật lý (Gbaud/lane/LAN PHY), còn lại hỏi "danh định".
        var lineCoded = coded && u.lineKbps == null && /Gbaud|\blane\b|LAN PHY/.test(String(u.summary || ''));
        var q = { prompt: coded && u.lineKbps != null
            ? 'Tốc độ dòng mã 64B/66B (sau thích ứng, mang vào OPUflex) của ' + oname + ' là bao nhiêu?'
            : lineCoded
              ? 'Tốc độ đường dây (sau mã hoá đường dây) của ' + oname + ' là bao nhiêu?'
              : 'Tốc độ danh định của ' + oname + ' là bao nhiêu?',
          explain: (u.summary || '') + (u.bytesPer125us != null ? ' (' + fmtNum(u.bytesPer125us, 3) + ' byte mỗi 125 µs × 64 kbit/s)' : ''),
          objNames: [oname],
          open: openUnit(D, id, null), check: { unit: id } };
        return assemble(q, fmtRate(k), d, rng);
      } });
    });

    // (9b) tốc độ đường dây thật (lineKbps, khi khác rateKbps): 50/200/400GbE…
    ids.forEach(function (id) {
      var k = +M[id].lineKbps, t = unitTopic(D, id);
      if (!(k > 0) || !named(id)) return;
      out.push({ key: 'u-rate|' + id + '|line', topic: t, type: 'u-rate', make: function (rng) {
        var u = M[id], ans = fmtRate(k), oname = objectName(id, ans);
        if (!oname) return null;
        var lines = ids.map(function (o) { return +M[o].lineKbps; }).filter(function (v) { return v > 0; });
        var keep = function (v) { return v === k || !(isRoundRate(v) && Math.abs(v / k - 1) <= 0.02); };
        var pool = lines.concat(ids.map(function (o) { return M[o].lineKbps != null ? rateOf(o) : 0; }), allRates).filter(function (v) { return v > 0 && keep(v); });
        var d = numDistractors(k, lines.concat(ids.map(function (o) { return M[o].lineKbps != null ? rateOf(o) : 0; })).filter(function (v) { return v > 0 && keep(v); }), fmtRate, rng) || numDistractors(k, pool, fmtRate, rng);
        var q = { prompt: 'Tốc độ đường dây của ' + oname + ' là bao nhiêu?',
          explain: (u.summary || '') + ' Tốc độ đường dây ' + ans + '; dòng 64B/66B mang vào OPUflex là ' + fmtRate(rateOf(id)) + '.',
          objNames: [oname], open: openUnit(D, id, null), check: { unit: id, line: true } };
        return assemble(q, ans, d, rng);
      } });
    });

    // (10) R chứa tối đa bao nhiêu X (logic lab maxCount; VCG theo số thành viên)
    var labRoots = {}, palette = {};
    D.LABS.forEach(function (l) { (l.roots || []).forEach(function (r) { labRoots[r] = true; }); (l.palette || []).forEach(function (p) { palette[p] = true; }); });
    var containers = ids.filter(function (id) {
      var u = M[id];
      return u.accepts && u.accepts.length && !u.members && (labRoots[id] || u.tribSlots || /^(vc|tug|aug|odu|opu)$/.test(u.kind));
    });
    var pairs = [];
    containers.forEach(function (R) {
      ids.forEach(function (X) {
        if (X === R || !named(X) || !named(R)) return;
        if (!(palette[X] || L.isClient(M, X))) return;
        var via = 'tree', n = L.maxCount(M, R, X);
        if (!n && M[X].members) { n = L.vcgMax(M, R, X); via = 'vcg'; }
        if (n >= 2 && L.portsBinding && L.portsBinding(M, R, X)) return; // maxPorts ràng buộc: số trực tiếp ≠ số qua đường lồng → câu hai nghĩa
        if (n >= 2) pairs.push({ R: R, X: X, n: n, via: via, topic: unitIsEos(M, X) || unitIsEos(M, R) ? 'eos' : (M[R].family || 'sdh') });
      });
    });
    pairs.forEach(function (p) {
      out.push({ key: 'u-max|' + p.R + '|' + p.X, topic: p.topic, type: 'u-max', make: function (rng) {
        var pool = pairs.filter(function (o) { return o.topic === p.topic; }).map(function (o) { return o.n; });
        (M[p.R].accepts || []).forEach(function (a) { pool.push(L.effCount(M, p.R, a)); });
        var fmtC = function (v) { return fmtNum(v, 0); };
        var d = numDistractors(p.n, pool, fmtC, rng) || numDistractors(p.n, pairs.map(function (o) { return o.n; }), fmtC, rng);
        var q = { prompt: 'Một ' + nm(p.R) + ' chứa tối đa bao nhiêu ' + nm(p.X) + '?',
          explain: p.via === 'vcg'
            ? nm(p.X) + ' gồm ' + M[p.X].members.count + ' × ' + nm(M[p.X].members.of) + '; ' + nm(p.R) + ' có ' + L.maxCount(M, p.R, M[p.X].members.of) + ' ' + nm(M[p.X].members.of) + '.'
            : chainText(L, M, p.R, p.X, p.n),
          open: openUnit(D, p.X, p.R), check: { R: p.R, X: p.X, via: p.via } };
        return assemble(q, fmtC(p.n), d, rng);
      } });
    });

    // (11) overhead ở một bước ghép A → B (B nhận đúng một phương án với A, overhead ≠ 0)
    var ohs = [];
    ids.forEach(function (B) {
      (M[B].accepts || []).forEach(function (a, i) {
        if (!M[a.of] || !named(B) || !named(a.of)) return;
        if (M[B].accepts.filter(function (x) { return x.of === a.of; }).length !== 1) return;
        var o = a.overhead || {};
        var isB = !!o.bytes, val = o.bytes || o.kbps || 0;
        if (!(val > 0)) return;
        ohs.push({ B: B, i: i, a: a, isB: isB, val: val, topic: unitIsEos(M, B) || unitIsEos(M, a.of) ? 'eos' : (M[B].family || 'sdh') });
      });
    });
    ohs.forEach(function (o) {
      out.push({ key: 'u-oh|' + o.B + '|' + o.i, topic: o.topic, type: 'u-oh', make: function (rng) {
        var fmtO = o.isB ? function (v) { return fmtNum(v, 3) + ' byte / 125 µs'; } : fmtRate;
        var same = ohs.filter(function (x) { return x.isB === o.isB; });
        var d = numDistractors(o.val, same.filter(function (x) { return x.topic === o.topic; }).map(function (x) { return x.val; }), fmtO, rng) ||
          numDistractors(o.val, same.map(function (x) { return x.val; }), fmtO, rng);
        var a = o.a;
        var q = { prompt: 'Bước ghép ' + a.count + ' × ' + nm(a.of) + ' → ' + nm(o.B) + ': overhead thêm ở bước này là bao nhiêu' + (o.isB ? ' (byte mỗi 125 µs)' : ' (tốc độ)') + '?',
          explain: (a.overhead.name ? a.overhead.name + '. ' : '') + (a.overhead.desc || a.note || M[o.B].summary || '') + (a.mapping ? ' Ánh xạ: ' + a.mapping + '.' : ''),
          open: openUnit(D, a.of, o.B), check: { B: o.B, i: o.i } };
        return assemble(q, fmtO(o.val), d, rng);
      } });
    });

    // (12) số TS mà X chiếm trong OPUk
    var tsl = [];
    ids.forEach(function (B) {
      if (!M[B].tribSlots) return;
      (M[B].accepts || []).forEach(function (a) {
        if (a.slots && M[a.of] && named(a.of)) tsl.push({ B: B, a: a, topic: unitIsEos(M, a.of) ? 'eos' : (M[B].family || 'otn') });
      });
    });
    var slotPool = uniq(tsl.map(function (x) { return x.a.slots; }).concat(ids.filter(function (B) { return M[B].tribSlots; }).map(function (B) { return M[B].tribSlots.n; })));
    tsl = tsl.filter(function (x) { return !(L.effCount && L.effCount(M, x.B, x.a) < x.a.count); }); // bỏ ODU0/ODU1... trong OPUCn (maxPorts ràng buộc)
    tsl.forEach(function (x) {
      out.push({ key: 'u-ts|' + x.B + '|' + x.a.of, topic: x.topic, type: 'u-ts', make: function (rng) {
        var t = M[x.B].tribSlots, fx = M[x.B].kind === 'flexe', fmtT = function (v) { return fmtNum(v, 0) + (fx ? ' khe' : ' TS'); };
        var d = numDistractors(x.a.slots, slotPool, fmtT, rng);
        var oname = objectName(x.a.of, fmtT(x.a.slots));
        if (!oname) return null;
        var q = { prompt: 'Trong ' + nm(x.B) + ' (' + t.n + (fx ? ' khe lịch' : ' tributary slot') + (t.size ? ' × ' + t.size : '') + '), một ' + oname + ' chiếm bao nhiêu ' + (fx ? 'khe lịch' : 'tributary slot') + '?',
          objNames: [oname],
          explain: (x.a.note || M[x.a.of].summary || '') + (x.a.mapping ? ' Ánh xạ: ' + x.a.mapping + '.' : '') + ' Tối đa ' + (L.effCount ? L.effCount(M, x.B, x.a) : x.a.count) + ' ' + nm(x.a.of) + ' khi chỉ dùng loại này.',
          open: openUnit(D, x.a.of, x.B), check: { B: x.B, of: x.a.of } };
        return assemble(q, fmtT(x.a.slots), d, rng);
      } });
    });
  }
  /**
   * Giải thích phép tính u-max: đi từ R xuống X theo nhánh cho maxCount lớn nhất (cùng logic lab),
   * nhân các count (accepts) dọc chuỗi. Vd "STM-4 = 4 × AUG-1; AUG-1 = 1 × AU-4; … ⇒ 4 × 1 × … = 12".
   */
  function chainText(L, M, R, X, n) {
    var nm = function (id) { return L.nameOf(M, id); };
    var steps = [], cur = R, guard = 40;
    while (cur !== X && guard-- > 0) {
      var want = L.maxCount(M, cur, X), pick = null;
      (M[cur].accepts || []).forEach(function (a) {
        if (pick) return;
        var m = a.of === X ? 1 : L.maxCount(M, a.of, X);
        if (m > 0 && L.effCount(M, cur, a) * m === want) pick = a;
      });
      if (!pick) break;
      steps.push({ from: cur, a: pick });
      cur = pick.of;
    }
    if (cur !== X || !steps.length) {
      var p = L.pathDown(M, R, X);
      return 'Theo cây ghép: ' + (p ? p.map(nm).join(' → ') : '') + '.';
    }
    var prod = steps.reduce(function (t, s) { return t * L.effCount(M, s.from, s.a); }, 1);
    return 'Nhân các count dọc chuỗi: ' +
      steps.map(function (s) { return nm(s.from) + ' = ' + L.effCount(M, s.from, s.a) + ' × ' + nm(s.a.of); }).join('; ') +
      ' ⇒ ' + steps.map(function (s) { return L.effCount(M, s.from, s.a); }).join(' × ') + ' = ' + fmtNum(prod, 0) +
      ' ' + nm(X) + (prod === n ? '' : ' (tối đa ' + fmtNum(n, 0) + ')') + '.';
  }
  /**
   * Đích "Mở ở đây" cho đơn vị: lab có gốc chứa được within (hoặc chính unit) + client unit;
   * không có lab thì mở lưới frame của unit.
   */
  function openUnit(D, unit, within) {
    var M = D.M, L = D.TV && D.TV.lab, target = within || unit;
    var best = null;
    D.LABS.forEach(function (l) {
      if (best) return;
      var roots = (l.roots || []).filter(function (r) { return M[r]; });
      var root = roots.indexOf(target) >= 0 ? target : roots.filter(function (r) { return L && (L.pathDown(M, r, target) || (M[target].members && L.vcgMax(M, r, target))); })[0];
      if (!root) return;
      var inPal = (l.palette || []).indexOf(unit) >= 0 && unit !== root;
      if (!inPal && (l.palette || []).indexOf(target) < 0 && roots.indexOf(target) < 0) return;
      best = { kind: 'lab', lab: l.id, root: root, client: inPal ? unit : null, label: l.name || l.id };
    });
    if (best) return best;
    var u = M[unit];
    if (u && u.frame && D.F[u.frame]) return { kind: 't', frame: u.frame, label: D.F[u.frame].name };
    return null;
  }

  // ---------- pool & sinh bộ câu ----------
  var poolCache = { key: null, pool: null };
  function buildPool(D) {
    var out = [];
    try { ipTemplates(D, out); } catch (e) { if (root.console) console.warn('quiz ip', e); }
    try { frameTemplates(D, out); } catch (e) { if (root.console) console.warn('quiz frame', e); }
    try { unitTemplates(D, out); } catch (e) { if (root.console) console.warn('quiz unit', e); }
    return out;
  }
  function poolOf(D) {
    var k = Object.keys(D.H).length + '|' + D.S.length + '|' + Object.keys(D.F).length + '|' + Object.keys(D.M).length;
    if (poolCache.D !== D || poolCache.key !== k) { poolCache = { D: D, key: k, pool: buildPool(D) }; }
    return poolCache.pool;
  }
  function inTopic(t, topic) { return topic === 'all' || t.topic === topic; }
  /** Số mẫu câu theo chủ đề (để ẩn chủ đề rỗng). */
  function topicCounts(D) {
    var c = {};
    poolOf(D).forEach(function (t) { c[t.topic] = (c[t.topic] || 0) + 1; c.all = (c.all || 0) + 1; });
    return c;
  }
  /**
   * Bộ n câu cho chủ đề theo seed: xáo mẫu trong từng dạng rồi lấy xen kẽ giữa các dạng
   * (dạng nào cũng có mặt); mẫu không dựng được câu rõ ràng (null) thì bỏ qua.
   */
  function generate(D, topic, n, seed) {
    var rng = rngOf('quiz|' + topic + '|' + seed);
    var pool = poolOf(D).filter(function (t) { return inTopic(t, topic); });
    var byType = {};
    pool.forEach(function (t) { (byType[t.type] = byType[t.type] || []).push(t); });
    var types = shuffle(Object.keys(byType).sort(), rng);
    var lists = types.map(function (ty) { return shuffle(byType[ty], rng); });
    var out = [], seen = {}, idx = lists.map(function () { return 0; });
    var usedPair = {}, deferred = [];
    // Giảm lặp: cặp (dạng, đối tượng chính = phần thứ 2 của key) chỉ dùng 1 lần ở lượt đầu;
    // mẫu bị hoãn chỉ được dùng ở lượt sau nếu vẫn thiếu câu.
    function pairOf(t) { return t.type + '|' + t.key.split('|')[1]; }
    function take(t) {
      var q = makeQ(t, rng);
      if (!q || seen[q.prompt]) return false;
      seen[q.prompt] = true;
      q.id = t.key; q.topic = t.topic; q.type = t.type; q.typeName = TYPE_NAME[t.type] || t.type;
      out.push(q);
      return true;
    }
    var guard = pool.length + 10;
    while (out.length < n && guard-- > 0) {
      var progressed = false;
      for (var i = 0; i < lists.length && out.length < n; i++) {
        while (idx[i] < lists[i].length) {
          var t = lists[i][idx[i]++], pk = pairOf(t);
          if (usedPair[pk]) { deferred.push(t); continue; }
          if (!take(t)) continue;
          usedPair[pk] = true;
          progressed = true;
          break;
        }
      }
      if (!progressed) break;
    }
    for (var j = 0; j < deferred.length && out.length < n; j++) take(deferred[j]);
    return out;
  }

  var api = {
    TOPICS: TOPICS, TYPE_NAME: TYPE_NAME,
    rngOf: rngOf, hashStr: hashStr, shuffle: shuffle,
    dataFrom: dataFrom, buildPool: buildPool, poolOf: poolOf, topicCounts: topicCounts, generate: generate, isLeaky: isLeaky, norm: norm, makeQ: makeQ,
    headerLeaves: headerLeaves, minimalOffsets: minimalOffsets, headerBytes: headerBytes, countHeaders: countHeaders,
    unitIsEos: unitIsEos, simpleV: simpleV, numV: numV, regionLabel: regionLabel, bfLabel: bfLabel
  };
  root.QuizGen = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // =====================================================================
  // Giao diện (chỉ trình duyệt)
  // =====================================================================
  if (typeof document === 'undefined') return;

  var STORE_KEY = 'fs.quiz.v1';
  var qv = { active: false, topic: 'all', sess: {}, store: null, D: null };

  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function sGet(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function sSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* riêng tư / đầy */ } }
  function topicName(id) { return (TOPICS.filter(function (t) { return t.id === id; })[0] || { name: id }).name; }

  function loadStore() {
    var s = sGet(STORE_KEY);
    if (!s || typeof s !== 'object') s = {};
    if (!s.stats || typeof s.stats !== 'object') s.stats = {};
    if (!s.wrong || typeof s.wrong !== 'object') s.wrong = {};
    if (!s.sess || typeof s.sess !== 'object') s.sess = {};
    if (s.n !== 10 && s.n !== 20) s.n = 10;
    return s;
  }
  function save() { sSet(STORE_KEY, qv.store); }
  function statOf(t) {
    var st = qv.store.stats[t];
    if (!st || typeof st !== 'object') st = qv.store.stats[t] = { right: 0, wrong: 0, runs: [] };
    if (!Array.isArray(st.runs)) st.runs = [];
    return st;
  }
  function wrongList(t) {
    if (t === 'all') {
      var all = [];
      Object.keys(qv.store.wrong).forEach(function (k) { if (Array.isArray(qv.store.wrong[k])) all = all.concat(qv.store.wrong[k]); });
      return all;
    }
    return Array.isArray(qv.store.wrong[t]) ? qv.store.wrong[t] : (qv.store.wrong[t] = []);
  }
  function newSeed() { return String(Math.floor(100000 + Math.random() * 900000)); }

  function startSession(topic, seed, review) {
    var qs;
    if (review) {
      qs = shuffle(wrongList(topic).slice(), rngOf('review|' + seed)).slice(0, 20);
    } else {
      qs = generate(qv.D, topic, qv.store.n, seed);
    }
    var s = { topic: topic, seed: seed, n: qs.length, review: !!review, qs: qs, ans: qs.map(function () { return null; }), i: 0, done: false, logged: false };
    qv.sess[topic] = s;
    qv.store.sess[topic] = { seed: seed, review: !!review, ans: s.ans, i: 0, n: qv.store.n, qs: review ? qs : null };
    save();
    return s;
  }
  /** Phiên của chủ đề: đang làm dở (bộ nhớ → localStorage) hoặc bộ mới. */
  function sessionOf(topic) {
    if (qv.sess[topic]) return qv.sess[topic];
    var p = qv.store.sess[topic];
    if (p && p.seed) {
      var qs = p.review && Array.isArray(p.qs) ? p.qs : generate(qv.D, topic, p.n === 20 ? 20 : 10, p.seed);
      if (qs.length && Array.isArray(p.ans) && p.ans.length === qs.length) {
        var s = { topic: topic, seed: p.seed, n: qs.length, review: !!p.review, qs: qs, ans: p.ans, i: Math.min(+p.i || 0, qs.length - 1), done: false, logged: !!p.logged };
        s.done = s.ans.every(function (a) { return a != null; }) && !!p.done;
        qv.sess[topic] = s;
        return s;
      }
    }
    return startSession(topic, newSeed(), false);
  }
  function persist(s) {
    qv.store.sess[s.topic] = { seed: s.seed, review: s.review, ans: s.ans, i: s.i, n: s.review ? s.n : qv.store.n, qs: s.review ? s.qs : null, done: s.done, logged: s.logged };
    save();
  }

  function answer(s, k) {
    var q = s.qs[s.i];
    if (!q || s.ans[s.i] != null) return;
    s.ans[s.i] = k;
    var ok = k === q.answer, st = statOf(q.topic);
    if (ok) st.right++; else st.wrong++;
    var wl = wrongList(q.topic);
    var at = -1;
    wl.forEach(function (x, j) { if (x && x.prompt === q.prompt) at = j; });
    if (ok && at >= 0) wl.splice(at, 1);
    if (!ok && at < 0) { wl.push(q); if (wl.length > 60) wl.shift(); }
    if (s.ans.every(function (a) { return a != null; }) && !s.logged) {
      s.logged = true;
      var sc = s.qs.filter(function (x, j) { return s.ans[j] === x.answer; }).length;
      var ts = statOf(s.topic);
      ts.runs.unshift({ seed: s.seed, n: s.n, score: sc, review: s.review, at: Date.now() });
      ts.runs = ts.runs.slice(0, 12);
    }
    persist(s);
    render();
  }

  // ---------- "Mở ở đây": ghi sẵn trạng thái chọn của view đích rồi chuyển hash ----------
  function seedIp(o) {
    var st = qv.D.S.filter(function (x) { return x.id === o.stack; })[0];
    if (!st || !qv.D.EV) return;
    var key = 'ethviz.v1.' + st.id, s = sGet(key);
    if (!s || typeof s !== 'object') s = { level: 1, open: {}, roleOpen: {}, enabled: {}, varBytes: {}, selected: null };
    var m;
    try { m = qv.D.EV.buildModel(st, s, qv.D.H, qv.D.S); } catch (e) { return; }
    var path = o.path;
    if (!path && o.header) {
      var hn = m.headers.filter(function (n) { return n.headerId === o.header; })[0];
      path = hn && hn.path;
      if (hn && o.field) path = m.index[hn.path + '/' + o.field] ? hn.path + '/' + o.field : hn.path;
    }
    var node = path && m.index[path];
    if (!node) return;
    s.selected = path;
    s.open = s.open && typeof s.open === 'object' ? s.open : {};
    s.roleOpen = s.roleOpen && typeof s.roleOpen === 'object' ? s.roleOpen : {};
    var p = node.kind === 'header' ? node : m.index[node.parentPath], headerNode = null;
    while (p) {
      s.open[p.path] = true; s.roleOpen[p.path] = true;
      if (p.kind === 'header') headerNode = p;
      p = p.parentPath ? m.index[p.parentPath] : null;
    }
    // chế độ Vai trò: mở cả đoạn vai trò chứa header
    if (headerNode && qv.D.EV.roleRuns) {
      qv.D.EV.roleRuns(m).forEach(function (r) { if (r.headers.some(function (h) { return h.path === headerNode.path; })) s.roleOpen[r.path] = true; });
    }
    sSet(key, s);
  }
  function seedFrame(o) {
    if (!o.region || !qv.D.TV) return;
    var f = qv.D.F[o.frame]; if (!f) return;
    var key = 'fs.t.v1.' + f.id, s = sGet(key);
    if (!s || typeof s !== 'object') s = { level: 1, open: {}, selected: null, zoom: 'm', compress: null, bands: {}, mf: null };
    if (!s.open || typeof s.open !== 'object') s.open = {};
    var fm = qv.D.TV.buildFrame(f), x = fm.byId[o.region];
    if (!x) return;
    s.selected = o.region;
    var p = x.parent;
    while (p >= 0) { s.open[fm.list[p].id] = true; p = fm.list[p].parent; }
    sSet(key, s);
  }
  function seedLab(o) {
    var key = 'fs.lab.v1.' + o.lab, s = sGet(key);
    if (!s || typeof s !== 'object') s = {};
    if (o.root) s.root = o.root;
    if (o.client) s.step = { client: o.client, n: 99 };
    sSet(key, s);
  }
  function openHere(o) {
    if (!o || !window.AppNav) return;
    var hash;
    try {
      if (o.kind === 'ip') { seedIp(o); hash = '#' + o.stack; }
      else if (o.kind === 't') { seedFrame(o); hash = '#t/' + o.frame; }
      else if (o.kind === 'lab') { seedLab(o); hash = '#lab/' + o.lab; }
    } catch (e) { /* không ghi được trạng thái → vẫn mở trang */ }
    if (!hash || !window.AppNav.has(hash)) return;
    window.AppNav.go(hash);
    setTimeout(function () {
      var el = document.querySelector('#view-ip .row.is-sel, #view-t .row.is-sel, #view-lab .step-list, #view-lab .lab-steps');
      if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 60);
  }

  // ---------- vẽ ----------
  var LETTERS = ['A', 'B', 'C', 'D'];
  function render() {
    if (!qv.active) return;
    var s = sessionOf(qv.topic), v = $('#view-quiz');
    var counts = topicCounts(qv.D);
    var topics = TOPICS.filter(function (t) { return counts[t.id]; });
    var wl = wrongList(qv.topic).length;
    var score = s.qs.filter(function (q, j) { return s.ans[j] === q.answer; }).length;
    var answered = s.ans.filter(function (a) { return a != null; }).length;
    var head =
      '<section class="stack-head"><div class="head-top"><span class="eyebrow">Ôn tập · tự sinh từ dữ liệu</span>' +
      '<h1 class="stack-title">Ôn tập — ' + esc(topicName(qv.topic)) + '</h1>' +
      '<p class="stack-summary">Câu hỏi trắc nghiệm sinh từ chính dữ liệu khung/đơn vị của ứng dụng. Mỗi câu có đúng một đáp án; trả lời xong xem giải thích và mở ngay chỗ tương ứng.</p></div>' +
      '<div class="toolbar quiz-bar" role="toolbar" aria-label="Chủ đề">' +
        '<span class="toolbar-label">Chủ đề</span><div class="seg-group">' +
        topics.map(function (t) {
          var on = t.id === qv.topic;
          return '<a class="seg-btn' + (on ? ' is-on' : '') + '" href="#quiz/' + esc(t.id) + '" title="' + esc(t.hint) + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(t.name) + '</a>';
        }).join('') + '</div></div>' +
      '<div class="toolbar quiz-bar">' +
        '<span class="toolbar-label">Số câu</span><div class="seg-group">' +
        [10, 20].map(function (n) { var on = qv.store.n === n; return '<button type="button" class="seg-btn' + (on ? ' is-on' : '') + '" data-qn="' + n + '" aria-pressed="' + on + '">' + n + '</button>'; }).join('') + '</div>' +
        '<label class="quiz-seed"><span class="toolbar-label">Seed</span><input type="text" inputmode="numeric" maxlength="12" value="' + esc(s.review ? '' : s.seed) + '" placeholder="' + (s.review ? 'ôn câu sai' : '') + '" data-qseed aria-label="Seed của bộ câu"></label>' +
        '<button type="button" class="btn-ghost" data-qact="seed">Dùng seed</button>' +
        '<button type="button" class="btn-ghost" data-qact="new">Bộ mới</button>' +
        (s.review ? '' : '<button type="button" class="btn-ghost" data-qact="redo">Làm lại bộ này</button>') +
        '<button type="button" class="btn-ghost" data-qact="review"' + (wl ? '' : ' disabled') + '>Ôn lại câu sai (' + wl + ')</button>' +
      '</div></section>';
    var body;
    if (!s.qs.length) {
      body = '<section class="card"><p class="muted">Chưa sinh được câu hỏi cho chủ đề này (dữ liệu chưa nạp?).</p></section>';
    } else if (s.done) {
      body = renderSummary(s, score);
    } else {
      body = renderQuestion(s, answered, score);
    }
    v.innerHTML = head + body;
    renderSide();
  }
  function renderQuestion(s, answered, score) {
    var q = s.qs[s.i], a = s.ans[s.i], done = a != null;
    var pct = Math.round(answered / s.n * 100);
    var html = '<section class="card quiz-card" aria-label="Câu hỏi">' +
      '<div class="quiz-prog"><span>Câu <b>' + (s.i + 1) + '</b>/' + s.n + (s.review ? ' · ôn câu sai' : ' · seed ' + esc(s.seed)) + '</span>' +
      '<span class="quiz-score">Đúng ' + score + '/' + answered + '</span>' +
      '<span class="quiz-track" aria-hidden="true"><i style="width:' + pct + '%"></i></span></div>' +
      '<div class="quiz-dots" role="tablist" aria-label="Danh sách câu">' + s.qs.map(function (x, j) {
        var st = s.ans[j] == null ? '' : s.ans[j] === x.answer ? ' is-ok' : ' is-bad';
        return '<button type="button" class="quiz-dot' + st + (j === s.i ? ' is-cur' : '') + '" data-qgo="' + j + '" aria-label="Câu ' + (j + 1) + '"' + (j === s.i ? ' aria-current="true"' : '') + '>' + (j + 1) + '</button>';
      }).join('') + '</div>' +
      '<div class="quiz-meta"><span class="chip">' + esc(q.typeName || '') + '</span><span class="chip">' + esc(topicName(q.topic)) + '</span></div>' +
      '<h2 class="quiz-q">' + esc(q.prompt) + '</h2>' +
      '<div class="quiz-opts" role="group" aria-label="Các lựa chọn">' + q.options.map(function (o, k) {
        var cls = '';
        if (done) cls = k === q.answer ? ' is-ok' : k === a ? ' is-bad' : ' is-dim';
        return '<button type="button" class="quiz-opt' + cls + '" data-qans="' + k + '"' + (done ? ' aria-disabled="true"' : '') + '>' +
          '<span class="quiz-letter">' + LETTERS[k] + '</span><span class="quiz-otext">' + esc(o) + '</span>' +
          (done && k === q.answer ? '<span class="quiz-mark" aria-label="Đáp án đúng">✓</span>' : done && k === a ? '<span class="quiz-mark" aria-label="Bạn chọn">✗</span>' : '') + '</button>';
      }).join('') + '</div>';
    if (done) {
      var ok = a === q.answer;
      html += '<div class="quiz-fb ' + (ok ? 'is-ok' : 'is-bad') + '" aria-live="polite"><strong>' + (ok ? 'Đúng!' : 'Chưa đúng — đáp án: ' + LETTERS[q.answer] + '. ' + esc(q.options[q.answer])) + '</strong>' +
        (q.explain ? '<p>' + esc(q.explain) + '</p>' : '') + '</div>';
    }
    html += '<div class="quiz-nav">' +
      '<button type="button" class="btn-ghost" data-qgo="' + (s.i - 1) + '"' + (s.i ? '' : ' disabled') + '>← Câu trước</button>' +
      (done && q.open ? '<button type="button" class="btn-ghost" data-qopen="1" title="Mở ' + esc(q.open.label || '') + '">Mở ở đây ↗ <span class="muted">' + esc(q.open.label || '') + '</span></button>' : '') +
      (s.i < s.n - 1 ? '<button type="button" class="btn-ghost' + (done ? ' is-on' : '') + '" data-qgo="' + (s.i + 1) + '">Câu tiếp →</button>'
        : '<button type="button" class="btn-ghost' + (done ? ' is-on' : '') + '" data-qact="finish"' + (s.ans.every(function (x) { return x != null; }) ? '' : ' disabled') + '>Xem kết quả</button>') +
      '</div><p class="muted quiz-keys">Phím: 1–4 hoặc A–D để chọn · Enter / → câu tiếp · ← câu trước</p></section>';
    return html;
  }
  function renderSummary(s, score) {
    var pct = s.n ? Math.round(score / s.n * 100) : 0;
    return '<section class="card quiz-card" aria-label="Kết quả">' +
      '<h2>Kết quả: ' + score + '/' + s.n + ' (' + pct + '%)</h2>' +
      '<p class="muted">' + (s.review ? 'Bộ ôn câu sai' : 'Seed ' + esc(s.seed) + ' — nhập lại seed này để làm đúng bộ câu cũ.') + '</p>' +
      '<ol class="quiz-sum">' + s.qs.map(function (q, j) {
        var ok = s.ans[j] === q.answer;
        return '<li class="' + (ok ? 'is-ok' : 'is-bad') + '"><button type="button" class="btn-link" data-qgo="' + j + '">' + (ok ? '✓ ' : '✗ ') + esc(q.prompt) + '</button>' +
          (ok ? '' : '<div class="muted">Đáp án: ' + esc(q.options[q.answer]) + '</div>') + '</li>';
      }).join('') + '</ol>' +
      '<div class="quiz-nav">' + (s.review ? '' : '<button type="button" class="btn-ghost" data-qact="redo">Làm lại bộ này</button>') +
      '<button type="button" class="btn-ghost is-on" data-qact="new">Bộ mới</button>' +
      '<button type="button" class="btn-ghost" data-qact="review"' + (wrongList(s.topic).length ? '' : ' disabled') + '>Ôn lại câu sai (' + wrongList(s.topic).length + ')</button></div></section>';
  }
  function renderSide() {
    var rows = TOPICS.map(function (t) {
      var st = qv.store.stats[t.id];
      var r = st ? st.right : 0, w = st ? st.wrong : 0;
      if (t.id === 'all') return '';
      var tot = r + w;
      return '<tr><td>' + esc(t.name) + '</td><td class="num">' + r + '</td><td class="num">' + w + '</td><td class="num">' + (tot ? Math.round(r / tot * 100) + '%' : '–') + '</td><td class="num">' + wrongList(t.id).length + '</td></tr>';
    }).join('');
    var runs = statOf(qv.topic).runs;
    $('#detail').innerHTML = '<div class="detail-card"><span class="eyebrow">Ôn tập</span><h2>Tiến độ theo chủ đề</h2>' +
      '<div class="tbl-wrap"><table class="values"><thead><tr><th>Chủ đề</th><th class="num">Đúng</th><th class="num">Sai</th><th class="num">%</th><th class="num">Câu sai lưu</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<h3>Các lượt gần đây — ' + esc(topicName(qv.topic)) + '</h3>' +
      (runs.length ? '<ul class="plain">' + runs.map(function (r) {
        return '<li><b>' + r.score + '/' + r.n + '</b> <span class="muted">' + (r.review ? 'ôn câu sai' : 'seed ' + esc(r.seed)) + ' · ' + esc(new Date(r.at).toLocaleString('vi-VN')) + '</span></li>';
      }).join('') + '</ul>' : '<p class="muted">Chưa có lượt nào.</p>') +
      '<p class="muted">Lưu trên trình duyệt này (localStorage). <button type="button" class="btn-link" data-qact="reset">Xoá tiến độ</button></p></div>' +
      '<div class="detail-empty"><h2>Cách dùng</h2><ol><li>Chọn chủ đề và số câu.</li><li>Trả lời bằng chuột hoặc phím 1–4.</li><li>Đọc giải thích, bấm <b>Mở ở đây</b> để xem đúng field/ô/đơn vị trong ứng dụng; quay lại bằng nút Back — bài đang làm được giữ.</li><li>Seed giống nhau → bộ câu giống nhau (gửi seed cho bạn học để cùng làm).</li></ol></div>';
  }

  // ---------- sự kiện ----------
  function onClick(e) {
    if (!qv.active) return;
    var t = e.target, b;
    if (!t.closest) return;
    var s = qv.sess[qv.topic];
    if (!s) return;
    if ((b = t.closest('[data-qans]'))) { answer(s, +b.getAttribute('data-qans')); return; }
    if ((b = t.closest('[data-qgo]'))) {
      var j = +b.getAttribute('data-qgo');
      if (j >= 0 && j < s.n) { s.i = j; s.done = false; persist(s); render(); focusQ(); }
      return;
    }
    if ((b = t.closest('[data-qopen]'))) { openHere(s.qs[s.i] && s.qs[s.i].open); return; }
    if ((b = t.closest('[data-qn]'))) {
      qv.store.n = +b.getAttribute('data-qn') === 20 ? 20 : 10;
      if (!s.review) startSession(qv.topic, s.seed, false); else save();
      render(); return;
    }
    if ((b = t.closest('[data-qact]'))) {
      var act = b.getAttribute('data-qact');
      if (act === 'new') startSession(qv.topic, newSeed(), false);
      else if (act === 'redo') startSession(qv.topic, s.seed, false);
      else if (act === 'review') { if (wrongList(qv.topic).length) startSession(qv.topic, newSeed(), true); }
      else if (act === 'finish') { s.done = true; persist(s); }
      else if (act === 'seed') {
        var inp = $('#view-quiz [data-qseed]'), val = inp ? String(inp.value).trim() : '';
        if (val) startSession(qv.topic, val.slice(0, 12), false);
      } else if (act === 'reset') {
        qv.store.stats = {}; qv.store.wrong = {}; save();
      }
      render(); return;
    }
  }
  function focusQ() { var h = $('#view-quiz .quiz-q'); if (h && h.scrollIntoView && window.innerWidth < 820) h.scrollIntoView({ block: 'nearest' }); }
  function onKey(e) {
    if (!qv.active || e.altKey || e.ctrlKey || e.metaKey) return;
    var tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') {
      if (e.key === 'Enter' && e.target.hasAttribute && e.target.hasAttribute('data-qseed')) { var b = $('#view-quiz [data-qact="seed"]'); if (b) b.click(); }
      return;
    }
    if (document.body.classList.contains('nav-open')) return;
    var s = qv.sess[qv.topic];
    if (!s || s.done || !s.qs.length) return;
    var k = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3 }[String(e.key).toLowerCase()];
    if (k != null && s.ans[s.i] == null) { e.preventDefault(); answer(s, k); return; }
    if ((e.key === 'Enter' || e.key === 'ArrowRight') && s.ans[s.i] != null && tg !== 'BUTTON' && tg !== 'A') {
      e.preventDefault();
      if (s.i < s.n - 1) { s.i++; persist(s); render(); }
      else if (s.ans.every(function (x) { return x != null; })) { s.done = true; persist(s); render(); }
      return;
    }
    if (e.key === 'ArrowLeft' && s.i > 0) { e.preventDefault(); s.i--; persist(s); render(); }
  }

  function init() {
    qv.D = dataFrom(root);
    qv.store = loadStore();
    var v = document.getElementById('view-quiz');
    if (!v) throw new Error('Thiếu #view-quiz trong index.html');
    v.addEventListener('click', onClick);
    document.getElementById('detail').addEventListener('click', function (e) {
      if (!qv.active) return;
      var b = e.target.closest && e.target.closest('[data-qact="reset"]');
      if (b) { qv.store.stats = {}; qv.store.wrong = {}; save(); render(); }
    });
    document.addEventListener('keydown', onKey);
  }
  function show(id) {
    qv.active = true;
    var c = topicCounts(qv.D);
    qv.topic = c[id] ? id : 'all';
    render();
  }
  function hide() { qv.active = false; }
  /** Mục cho thanh điều hướng: các chủ đề có câu hỏi. */
  function navItems() {
    var c = topicCounts(qv.D || dataFrom(root));
    return TOPICS.filter(function (t) { return c[t.id]; }).map(function (t) { return { id: t.id, name: t.name, hint: t.hint, count: c[t.id] }; });
  }

  root.QuizView = { init: init, show: show, hide: hide, items: navItems };
})(typeof window !== 'undefined' ? window : globalThis);
