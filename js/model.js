/*
 * model.js — phần TÍNH TOÁN thuần (không đụng DOM).
 * buildModel(stack, state, headers, stacks) → cây đã tính sẵn kích thước & offset.
 * layoutBits(headerNode, isOpen, width) → các hàng của sơ đồ bit kiểu RFC.
 * Chạy được cả trong trình duyệt (window.EthViz) lẫn Node (module.exports) để QA kiểm số liệu.
 */
(function (root) {
  'use strict';

  var LAYERS = ['phy', 'l2', 'l2_5', 'l3', 'l4', 'tunnel', 'payload', 'trailer'];

  function has(obj, key) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
  }

  /** Đếm số lần mỗi header id xuất hiện trong cây của một stack (dùng cho compareTo). */
  function countHeaders(tree, counts) {
    counts = counts || {};
    (tree || []).forEach(function (sn) {
      if (!sn) return;
      if (sn.children) countHeaders(sn.children, counts);
      else if (sn.header) counts[sn.header] = (counts[sn.header] || 0) + 1;
    });
    return counts;
  }

  /** Độ dài (byte) của trường varBytes: state → StackNode.varBytes → default → min, kẹp trong [min,max]. */
  function resolveVarBytes(def, sn, varState) {
    var vb = def.varBytes || {};
    var n;
    if (varState && has(varState, def.id)) n = varState[def.id];
    else if (sn.varBytes && has(sn.varBytes, def.id)) n = sn.varBytes[def.id];
    else if (vb.default != null) n = vb.default;
    else n = vb.min || 0;
    n = Math.round(Number(n) || 0);
    if (vb.min != null && n < vb.min) n = vb.min;
    if (vb.max != null && n > vb.max) n = vb.max;
    return Math.max(0, n);
  }


  /** Gom node optional (mọi cấp) và field varBytes của một header def. */
  function collectControls(defs, out) {
    out = out || { optionals: [], vars: [] };
    (defs || []).forEach(function (d) {
      if (d.optional) out.optionals.push(d.id);
      if (d.varBytes) out.vars.push(d);
      if (d.children) collectControls(d.children, out);
    });
    return out;
  }

  function clampVar(def, n) {
    var vb = def.varBytes || {};
    n = Math.round(Number(n) || 0);
    if (vb.min != null && n < vb.min) n = vb.min;
    if (vb.max != null && n > vb.max) n = vb.max;
    return Math.max(0, n);
  }

  /**
   * Trạng thái điều khiển mà một variant ngụ ý:
   *  enabled[id] = bool cho MỌI node optional (thiếu trong variant.enable → tắt),
   *  varBytes[id] = byte cho mọi field varBytes (thiếu → default ?? min).
   */
  function variantState(headerDef, variant) {
    var c = collectControls(headerDef && headerDef.fields);
    var enable = (variant && variant.enable) || [];
    var vb = (variant && variant.varBytes) || {};
    var enabled = {}, varBytes = {};
    c.optionals.forEach(function (id) { enabled[id] = enable.indexOf(id) >= 0; });
    c.vars.forEach(function (d) {
      var n = has(vb, d.id) ? vb[d.id] : (d.varBytes.default != null ? d.varBytes.default : (d.varBytes.min || 0));
      varBytes[d.id] = clampVar(d, n);
    });
    return { enabled: enabled, varBytes: varBytes };
  }

  /** Variant khớp đúng cấu hình (enabledMap/varBytesMap đầy đủ) hoặc null. */
  function matchVariant(headerDef, enabledMap, varBytesMap) {
    var list = (headerDef && headerDef.variants) || [];
    for (var i = 0; i < list.length; i++) {
      var vs = variantState(headerDef, list[i]);
      var ok = Object.keys(vs.enabled).every(function (id) { return !!(enabledMap && enabledMap[id]) === vs.enabled[id]; }) &&
        Object.keys(vs.varBytes).every(function (id) { return varBytesMap && Number(varBytesMap[id]) === vs.varBytes[id]; });
      if (ok) return list[i];
    }
    return null;
  }

  /** Cấu hình hiện hành (state > StackNode > mặc định) của header, dạng map đầy đủ. */
  function effectiveControls(h, sn, en, varState) {
    var c = collectControls(h.fields);
    var enabled = {}, varBytes = {};
    c.optionals.forEach(function (id) {
      enabled[id] = has(en, id) ? !!en[id] : (sn.enable || []).indexOf(id) >= 0;
    });
    c.vars.forEach(function (d) { varBytes[d.id] = resolveVarBytes(d, sn, varState); });
    return { enabled: enabled, varBytes: varBytes };
  }

  /**
   * Dựng node field/group của một header.
   * ctx.pos = bit hiện tại trong header (chỉ tăng với field đang có mặt).
   * parentPresent = false khi group cha optional đang tắt → con cũng không có mặt.
   */
  function buildFieldNodes(defs, ctx, parentPresent, depth, parentPath) {
    return (defs || []).map(function (def) {
      var isGroup = Array.isArray(def.children);
      var optional = def.optional ? String(def.optional) : null;
      var enabled = !optional || ctx.isEnabled(def.id);
      var present = parentPresent && enabled;
      var node = {
        kind: isGroup ? 'group' : 'field',
        id: def.id,
        path: ctx.headerPath + '/' + def.id,
        parentPath: parentPath,
        headerPath: ctx.headerPath,
        def: def,
        name: def.name || def.id,
        abbr: def.abbr || null,
        depth: depth,
        optional: optional,
        enabled: enabled,
        present: present,
        reserved: !!def.reserved,
        // giá trị `set` chỉ hiển thị khi field có mặt (field/group optional đang tắt → ẩn)
        setValue: ctx.set && has(ctx.set, def.id) ? String(ctx.set[def.id]) : null,
        value: null,
        flagFor: null,
        offsetInHeader: present ? ctx.pos : null,
        offsetBit: null,
        isVar: false,
        containsVar: false
      };
      if (isGroup) {
        node.children = buildFieldNodes(def.children, ctx, present, depth + 1, node.path);
        // kích thước "nếu bật": cộng các con không optional hoặc đang bật
        node.sizeIfOn = node.children.reduce(function (s, c) {
          return s + (c.optional && !c.enabled ? 0 : c.sizeIfOn);
        }, 0);
        node.containsVar = node.children.some(function (c) { return c.isVar || c.containsVar; });
      } else if (def.varBytes) {
        node.isVar = true;
        node.varRange = { min: def.varBytes.min, max: def.varBytes.max, def: def.varBytes.default };
        node.varLen = resolveVarBytes(def, ctx.sn, ctx.varState);
        node.sizeIfOn = node.varLen * 8;
      } else {
        node.sizeIfOn = Number(def.bits) || 0;
      }
      node.bits = present ? node.sizeIfOn : 0;
      node.value = present ? node.setValue : null;
      if (present && !isGroup) ctx.pos += node.bits;
      ctx.index[node.path] = node;
      return node;
    });
  }

  /** Có StackNode nào (ở mọi cấp) khai báo thuộc tính `added` tường minh không. */
  function hasExplicitAdded(tree) {
    return (tree || []).some(function (sn) {
      return sn && (has(sn, 'added') || (Array.isArray(sn.children) && hasExplicitAdded(sn.children)));
    });
  }

  function walkFields(nodes, fn) {
    (nodes || []).forEach(function (n) { fn(n); if (n.children) walkFields(n.children, fn); });
  }

  /**
   * Cờ điều khiển: field optional có điều kiện dạng "<tên> = 1" (vd. GRE key: "K = 1")
   * → tìm field lá cùng header có abbr/id/name khớp <tên> (không phân biệt hoa thường)
   * và cho cờ đó hiển thị 1/0 theo công tắc. Không tìm thấy thì bỏ qua.
   */
  function deriveControlFlags(fieldNodes) {
    var leaves = [];
    walkFields(fieldNodes, function (n) { if (n.kind === 'field') leaves.push(n); });
    walkFields(fieldNodes, function (opt) {
      if (!opt.optional) return;
      var m = /^\s*([A-Za-z0-9_.\-]+)\s*=\s*1\s*$/.exec(opt.optional);
      if (!m) return;
      var key = m[1].toLowerCase();
      var flag = leaves.filter(function (f) {
        if (f === opt || f.optional) return false;
        return [f.abbr, f.id, f.name].some(function (x) { return x != null && String(x).toLowerCase() === key; });
      })[0];
      if (!flag || !flag.present) return;
      flag.value = opt.present ? '1' : '0';
      flag.flagFor = opt.path;
    });
  }

  function setAbsoluteOffsets(nodes, headerStart) {
    nodes.forEach(function (n) {
      n.offsetBit = (headerStart == null || n.offsetInHeader == null) ? null : headerStart + n.offsetInHeader;
      if (n.children) setAbsoluteOffsets(n.children, headerStart);
    });
  }

  /** Kiểm tra nhẹ dữ liệu header để cảnh báo (không chặn hiển thị). */
  function checkHeader(h, sn, warnings, label) {
    var ids = {};
    var fixedBits = 0;
    (function walk(list) {
      (list || []).forEach(function (d) {
        ids[d.id] = true;
        if (d.children) { if (!d.optional) walk(d.children); else walkIds(d.children); }
        else if (!d.optional && !d.varBytes) fixedBits += Number(d.bits) || 0;
      });
    })(h.fields);
    function walkIds(list) { (list || []).forEach(function (d) { ids[d.id] = true; if (d.children) walkIds(d.children); }); }
    if (h.fixedBytes != null && fixedBits !== h.fixedBytes * 8) {
      warnings.push(label + ': tổng bit bắt buộc = ' + fixedBits + ' nhưng fixedBytes = ' + h.fixedBytes + ' (' + h.fixedBytes * 8 + ' bit).');
    }
    ['set', 'varBytes'].forEach(function (k) {
      Object.keys(sn[k] || {}).forEach(function (id) {
        if (!ids[id]) warnings.push(label + ': "' + k + '" trỏ tới id không có: ' + id);
      });
    });
    (sn.enable || []).forEach(function (id) {
      if (!ids[id]) warnings.push(label + ': "enable" trỏ tới id không có: ' + id);
    });
  }

  /**
   * buildModel(stack, state, headers, stacks)
   *  state.enabled[headerPath][fieldId] = bool   (ghi đè `enable` của StackNode)
   *  state.varBytes[headerPath][fieldId] = byte  (ghi đè varBytes)
   */
  function buildModel(stack, state, headers, stacks, opts) {
    opts = opts || {};
    state = state || {};
    headers = headers || root.HEADERS || {};
    stacks = stacks || root.STACKS || [];
    var enabledState = state.enabled || {};
    var varStateAll = state.varBytes || {};
    var errors = [];
    var warnings = [];
    var index = {};
    var headerList = [];
    var cursor = 0; // bit hiện tại trong frame (không tính phần wire)

    // Nhãn "+ thêm": ưu tiên cờ `added` tường minh của StackNode; chỉ khi stack không có node
    // nào khai báo `added` mới dùng cách đếm số lần xuất hiện header so với stack compareTo (dự phòng).
    var base = null;
    if (stack.compareTo && stack.compareTo !== stack.id) {
      base = stacks.filter(function (s) { return s && s.id === stack.compareTo; })[0] || null;
    }
    var explicitAdded = hasExplicitAdded(stack.tree);
    var baseCounts = base && !explicitAdded ? countHeaders(base.tree) : null;
    var seenCounts = {};

    // inAdded = true khi một group tổ tiên được đánh dấu added (mọi header con coi là thêm)
    function buildStackNodes(list, parentPath, depth, inAdded) {
      return (list || []).map(function (sn, i) {
        var path = parentPath + '/' + i;
        if (sn && Array.isArray(sn.children)) return buildGroup(sn, path, parentPath, depth, inAdded);
        return buildHeader(sn || {}, path, parentPath, depth, inAdded);
      });
    }

    function buildGroup(sn, path, parentPath, depth, inAdded) {
      var startBit = cursor;
      var node = {
        kind: 'sgroup', path: path, parentPath: parentPath, depth: depth,
        name: sn.group || 'Nhóm', note: sn.note || null, sn: sn
      };
      index[path] = node;
      var selfAdded = explicitAdded && sn.added === true;
      node.children = buildStackNodes(sn.children, path, depth + 1, inAdded || selfAdded);
      // group được coi là "thêm" nếu tự đánh dấu, thuộc group thêm, hoặc mọi con đều là phần thêm
      node.added = !!(inAdded || selfAdded || (node.children.length && node.children.every(function (c) { return c.added; })));
      node.bits = cursor - startBit;
      node.wire = node.children.length > 0 && node.children.every(function (c) { return c.wire; });
      if (node.wire) node.bits = node.children.reduce(function (s, c) { return s + c.bits; }, 0);
      node.offsetBit = node.wire ? null : startBit;
      node.layer = dominantLayer(node.children);
      return node;
    }

    function buildHeader(sn, path, parentPath, depth, inAdded) {
      var h = sn.header ? headers[sn.header] : null;
      var node = {
        kind: 'header', path: path, parentPath: parentPath, depth: depth, sn: sn,
        headerId: sn.header || null, label: sn.label || null, note: sn.note || null,
        wire: !!sn.wire, set: sn.set || null
      };
      index[path] = node;
      if (!h) {
        node.missing = true;
        node.name = sn.header || '(không rõ)';
        node.layer = 'payload';
        node.bits = 0;
        node.children = [];
        node.offsetBit = null;
        node.error = sn.header
          ? 'Không tìm thấy header "' + sn.header + '" trong dữ liệu (file data có thể chưa nạp).'
          : 'StackNode thiếu cả "header" lẫn "group".';
        errors.push(stack.id + ' › ' + node.error);
        return node;
      }
      node.header = h;
      node.name = h.name || sn.header;
      node.short = h.short || node.name;
      node.layer = LAYERS.indexOf(h.layer) >= 0 ? h.layer : 'payload';
      var en = enabledState[path] || {};
      var eff = effectiveControls(h, sn, en, varStateAll[path] || null);
      var active = matchVariant(h, eff.enabled, eff.varBytes);
      node.variants = (h.variants || []).map(function (v) {
        return { id: v.id, name: v.name, bytes: v.bytes, note: v.note || null, set: v.set || null, def: v };
      });
      node.activeVariantId = active ? active.id : null;
      if (node.variants.length) {
        var vbytes = node.variants.map(function (v) { return v.bytes; });
        node.variantRange = { min: Math.min.apply(null, vbytes), max: Math.max.apply(null, vbytes) };
      }
      // set của variant đang khớp ưu tiên hơn set của StackNode (vd. ihl, data-offset, cờ c/k/s)
      var mergedSet = (sn.set || (active && active.set)) ? Object.assign({}, sn.set || {}, (active && active.set) || {}) : null;
      node.set = mergedSet;
      var ctx = {
        headerPath: path, sn: sn, set: mergedSet, pos: 0, index: index,
        varState: varStateAll[path] || null,
        isEnabled: function (id) {
          if (has(en, id)) return !!en[id];
          return (sn.enable || []).indexOf(id) >= 0;
        }
      };
      node.children = buildFieldNodes(h.fields, ctx, true, 0, path);
      deriveControlFlags(node.children);
      node.bits = ctx.pos;
      node.offsetBit = node.wire ? null : cursor;
      setAbsoluteOffsets(node.children, node.offsetBit);
      if (!node.wire) cursor += node.bits;

      if (explicitAdded) {
        node.added = !!(inAdded || sn.added === true);
      } else {
        seenCounts[sn.header] = (seenCounts[sn.header] || 0) + 1;
        node.added = !!baseCounts && seenCounts[sn.header] > (baseCounts[sn.header] || 0);
      }
      checkHeader(h, sn, warnings, stack.id + ' › ' + (sn.label || node.name));
      headerList.push(node);
      return node;
    }

    var nodes = buildStackNodes(stack.tree, stack.id, 0, false);
    markAddedLabels(nodes, false);

    var frameBits = 0, payloadBits = 0, wireBits = 0, headerCount = 0;
    headerList.forEach(function (n) {
      if (n.wire) { wireBits += n.bits; return; }
      frameBits += n.bits;
      if (n.layer === 'payload') payloadBits += n.bits;
      else headerCount += 1;
    });
    var overheadBits = frameBits - payloadBits;

    // "Tăng thêm so với stack gốc": kích thước frame mặc định của stack compareTo (wire không tính)
    var compare = null;
    if (base && !opts.noCompare) {
      var bm = buildModel(base, {}, headers, stacks, { noCompare: true });
      compare = {
        id: base.id, name: base.name || base.id,
        frameBytes: bm.totals.frameBytes,
        deltaBytes: frameBits / 8 - bm.totals.frameBytes
      };
    }

    return {
      stack: stack,
      nodes: nodes,
      index: index,
      headers: headerList,
      errors: errors,
      warnings: warnings,
      totals: {
        frameBits: frameBits, frameBytes: frameBits / 8,
        payloadBytes: payloadBits / 8,
        overheadBytes: overheadBits / 8,
        overheadPct: frameBits ? (overheadBits / frameBits) * 100 : 0,
        wireBytes: wireBits / 8,
        headerCount: headerCount,
        compare: compare
      },
      addedSource: explicitAdded ? 'explicit' : (baseCounts ? 'count' : null)
    };
  }

  /**
   * addedLabel = true chỉ ở node "thêm" cao nhất (cha không phải phần thêm) → hiển thị nhãn
   * "+ thêm" một lần cho cả group, không lặp ở từng header con.
   */
  function markAddedLabels(nodes, parentAdded) {
    nodes.forEach(function (n) {
      n.added = !!n.added;
      n.addedLabel = n.added && !parentAdded;
      if (n.kind === 'sgroup') markAddedLabels(n.children, n.added);
    });
  }

  /** Layer chiếm nhiều bit nhất trong các con (để tô màu nhóm stack khi thu gọn). */
  function dominantLayer(children) {
    var acc = {};
    var best = null;
    (function walk(list) {
      list.forEach(function (c) {
        if (c.kind === 'sgroup') return walk(c.children);
        if (c.layer) {
          acc[c.layer] = (acc[c.layer] || 0) + (c.bits || 1);
          if (!best || acc[c.layer] > acc[best]) best = c.layer;
        }
      });
    })(children);
    return best || 'l2';
  }

  /**
   * Thu thập "đơn vị vẽ" của header theo trạng thái thu gọn:
   * - group đang ĐÓNG → MỘT đơn vị mang tên group (gộp mọi field con);
   * - group đang mở → đi tiếp vào con;
   * - field varBytes (hoặc group đóng chứa varBytes) → đơn vị "band" vẽ thành dải riêng.
   */
  function collectUnits(nodes, isOpen, out) {
    out = out || [];
    nodes.forEach(function (n) {
      if (!n.present) return;
      if (n.kind === 'group') {
        if (isOpen(n)) collectUnits(n.children, isOpen, out);
        else out.push({ node: n, bits: n.bits, collapsed: true, band: n.containsVar });
      } else {
        out.push({ node: n, bits: n.bits, collapsed: false, band: n.isVar });
      }
    });
    return out;
  }

  /**
   * Chia đơn vị thành các hàng `width` bit (mặc định 32) như sơ đồ RFC.
   * Một đơn vị dài hơn phần còn lại của hàng được cắt: phần đầu ở hàng hiện tại, phần sau
   * sang hàng kế (cell.cont = true → hiển thị "(tiếp)"). Band chiếm trọn một hàng riêng.
   * Ô trống (pad) lấp chỗ khi band chen giữa hàng hoặc header không tròn 32 bit.
   */
  function layoutUnits(units, width) {
    var W = width || 32;
    var rows = [];
    var pos = 0;
    var cur = null;

    function openRow() {
      if (cur) return;
      var col = pos % W;
      cur = { type: 'bits', startBit: pos - col, cells: [] };
      if (col) cur.cells.push({ pad: true, col: 0, span: col });
      rows.push(cur);
    }
    function closeRow() {
      if (!cur) return;
      var col = pos % W;
      if (col) cur.cells.push({ pad: true, col: col, span: W - col });
      cur = null;
    }

    units.forEach(function (u) {
      if (u.band) {
        closeRow();
        rows.push({ type: 'band', startBit: pos, node: u.node, bits: u.bits, collapsed: u.collapsed });
        pos += u.bits;
        return;
      }
      var remaining = u.bits;
      var first = true;
      while (remaining > 0) {
        openRow();
        var col = pos % W;
        var take = Math.min(remaining, W - col);
        cur.cells.push({ node: u.node, col: col, span: take, cont: !first, more: remaining > take, collapsed: u.collapsed });
        pos += take;
        remaining -= take;
        first = false;
        if (pos % W === 0) cur = null;
      }
    });
    closeRow();
    return rows;
  }

  /** isOpen nhận node; trả về các hàng sơ đồ bit cho một header node. */
  function layoutBits(headerNode, isOpen, width) {
    return layoutUnits(collectUnits(headerNode.children || [], isOpen), width);
  }

  var api = {
    LAYERS: LAYERS,
    buildModel: buildModel,
    collectUnits: collectUnits,
    layoutUnits: layoutUnits,
    layoutBits: layoutBits,
    countHeaders: countHeaders,
    variantState: variantState,
    matchVariant: matchVariant
  };
  root.EthViz = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
