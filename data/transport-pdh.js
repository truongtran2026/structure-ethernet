// Mảng Truyền dẫn – GD2: PDH châu Âu (E1, E2, E3, E4) + cây ghép kênh PDH + lab PDH.
// Schema: .claude/skills/transport-frame-spec/references/transport-schema.md
// Nguồn: ITU-T G.703 (giao diện, tốc độ), G.704 §2.3 (khung E1, CRC-4), §5.1.3 (CAS TS16),
//        G.742 Table 1 (E2 8448 kbit/s), G.751 §1.4 Table 1 (E3 34 368 kbit/s), §1.5 Table 2 (E4 139 264 kbit/s).
// Phải nạp TRƯỚC data/transport-sdh.js (C-12/C-3/C-4 trong SDH nhận e1/e3/e4 định nghĩa ở đây).
window.TFRAMES = window.TFRAMES || {};
window.TMUX = window.TMUX || {};
window.TLABS = window.TLABS || [];

(function () {
  var F = window.TFRAMES, M = window.TMUX, L = window.TLABS;

  // Tạo region. rect = [r, c, h, w, step?] (0-based).
  function R(id, abbr, name, kind, rect, desc, extra) {
    var o = { id: id, name: name, abbr: abbr, kind: kind,
      rect: { r: rect[0], c: rect[1], h: rect[2], w: rect[3], step: rect[4] || 1 }, desc: desc };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  // =====================================================================
  // E1 – 2048 kbit/s (G.704 §2.3): 32 khe × 8 bit, 125 µs; đa khung CRC-4 16 khung
  // =====================================================================
  var FAS_BITS = function (cn) {
    return [
      { name: "Si = " + cn + " (CRC-4)", abbr: cn, bits: 1,
        desc: "Bit 1 khung chứa FAS: khi dùng CRC-4 mang bit " + cn + " của mã CRC-4 tính trên đa khung con (SMF, 8 khung = 2048 bit) TRƯỚC đó; không dùng CRC-4 thì là bit Si dành cho quốc tế (đặt 1)." },
      { name: "Frame Alignment Signal", abbr: "0011011", bits: 7,
        desc: "Tín hiệu đồng bộ khung cố định 0011011 ở bit 2–8, chỉ có trong khung chẵn. Đầu thu tìm mẫu này để xác định biên khung 125 µs (mất đồng bộ sau 3 lần FAS sai liên tiếp)." }
    ];
  };
  var NFAS_BITS = function (b1, b1desc) {
    return [
      { name: b1[0], abbr: b1[1], bits: 1, desc: b1desc },
      { name: "Fixed 1", abbr: "1", bits: 1, desc: "Bit 2 luôn = 1 để khung lẻ không bao giờ giả mạo được FAS (FAS có bit 2 = 0)." },
      { name: "Remote alarm", abbr: "A", bits: 1, desc: "Cảnh báo đầu xa (RAI): = 1 khi đầu thu bên này mất tín hiệu / mất đồng bộ khung – báo ngược cho đầu phát." },
      { name: "Spare bit Sa4", abbr: "Sa4", bits: 1, desc: "Bit dự phòng; có thể dùng làm kênh dữ liệu bản tin cho OAM (Note 4 ii). SSM là mã 4 bit có thể đặt ở bất kỳ bit nào trong Sa4–Sa8 (Note 4 iv, §2.3.4). Không dùng thì đặt 1 trên đường quốc tế." },
      { name: "Spare bits Sa5–Sa8", abbr: "Sa5–Sa8", bits: 4, desc: "Sa5–Sa7 cho sử dụng quốc gia; Sa4–Sa8 có thể dùng cho ứng dụng điểm-điểm hoặc SSM (§2.3.4); không dùng thì đặt 1 trên tuyến qua biên giới quốc tế (G.704 §2.3.2, Table 5A Note 4 iii)." }
    ];
  };
  var MF_NOTE = "Hai đa khung 16 khung độc lập: đa khung CRC-4 (theo bit 1 của TS0, gồm 2 đa khung con SMF I khung 0–7 và SMF II khung 8–15) và đa khung CAS (theo TS16, căn bằng 0000 ở khung 0). Lưới vẽ hai đa khung trùng pha cho dễ học; thực tế G.704 không bắt buộc chúng thẳng hàng.";

  var ts0PerFrame = [
    { frames: [0, 8], abbr: "C1·FAS", name: "Khung có FAS – bit C1", desc: "Khung chẵn: bit 1 = C1 (bit đầu của CRC-4), bit 2–8 = FAS 0011011.", bitFields: FAS_BITS("C1") },
    { frames: [2, 10], abbr: "C2·FAS", name: "Khung có FAS – bit C2", desc: "Khung chẵn: bit 1 = C2, bit 2–8 = FAS 0011011.", bitFields: FAS_BITS("C2") },
    { frames: [4, 12], abbr: "C3·FAS", name: "Khung có FAS – bit C3", desc: "Khung chẵn: bit 1 = C3, bit 2–8 = FAS 0011011.", bitFields: FAS_BITS("C3") },
    { frames: [6, 14], abbr: "C4·FAS", name: "Khung có FAS – bit C4", desc: "Khung chẵn: bit 1 = C4 (bit cuối của CRC-4), bit 2–8 = FAS 0011011.", bitFields: FAS_BITS("C4") },
    { frames: [1, 3, 7], abbr: "0·NFAS", name: "Khung không FAS – bit MFAS = 0", desc: "Khung lẻ: bit 1 là một bit của mẫu đồng bộ đa khung CRC-4 001011 (ở khung 1, 3, 5, 7, 9, 11); tại khung này = 0.",
      bitFields: NFAS_BITS(["CRC-4 MFAS bit", "MFAS=0"], "Bit đồng bộ đa khung CRC-4 = 0. Mẫu 001011 rải ở bit 1 các khung lẻ 1, 3, 5, 7, 9, 11 xác định khung 0 của đa khung CRC-4.") },
    { frames: [5, 9, 11], abbr: "1·NFAS", name: "Khung không FAS – bit MFAS = 1", desc: "Khung lẻ: bit 1 là bit MFAS = 1 (mẫu 001011: khung 5, 9, 11 mang 1).",
      bitFields: NFAS_BITS(["CRC-4 MFAS bit", "MFAS=1"], "Bit đồng bộ đa khung CRC-4 = 1 (khung 5, 9, 11 của mẫu 001011).") },
    { frames: [13, 15], abbr: "E·NFAS", name: "Khung không FAS – bit E", desc: "Khung 13 và 15: bit 1 là bit E (CRC-4 error indication) – báo ngược cho đầu xa rằng một SMF nhận được bị lỗi CRC-4 (G.704 chỉ quy định đổi một bit E từ 1 sang 0 cho mỗi SMF bị lỗi, trễ dưới 1 s; E = 0 cho tới khi đồng bộ khung và đa khung CRC-4; §2.3.3.4).",
      bitFields: NFAS_BITS(["CRC-4 error indication", "E"], "Bit E: = 0 khi đầu thu phát hiện lỗi CRC-4 ở một đa khung con nhận được; = 1 bình thường. Đầu xa đếm bit E để biết hiệu năng chiều ngược lại (giống REI trong SDH).") }
  ];

  var ts16PerFrame = [
    { frames: [0], abbr: "0000XYXX", name: "Khung 0 – đồng bộ đa khung CAS", desc: "TS16 khung 0: 0000 X Y X X. Bốn bit 0 đánh dấu khung 0 của đa khung CAS; vì vậy abcd 0000 không được dùng cho kênh 1–15 (nửa đầu TS16 các khung 1–15 có thể giả MFAS 0000; G.704 §5.1.3.2.2).",
      bitFields: [
        { name: "CAS multiframe alignment", abbr: "0000", bits: 4, desc: "Mẫu đồng bộ đa khung báo hiệu 0000 – xác định khung 0 để biết khung k mang abcd của kênh nào." },
        { name: "Spare", abbr: "X", bits: 1, desc: "Bit dự phòng (đặt 1 nếu không dùng)." },
        { name: "Multiframe remote alarm", abbr: "Y", bits: 1, desc: "Cảnh báo đầu xa đa khung: = 1 khi bên này mất đồng bộ đa khung CAS." },
        { name: "Spare", abbr: "XX", bits: 2, desc: "Hai bit dự phòng (đặt 1 nếu không dùng)." }
      ] }
  ];
  for (var k = 1; k <= 15; k++) {
    ts16PerFrame.push({ frames: [k], abbr: "abcd " + k + "|" + (k + 16), name: "Khung " + k + " – báo hiệu TS" + k + " và TS" + (k + 16),
      desc: "TS16 khung " + k + ": bit 1–4 = abcd của kênh thoại ở TS" + k + ", bit 5–8 = abcd của kênh ở TS" + (k + 16) + ". Mỗi kênh nhận 4 bit báo hiệu mỗi 2 ms (2 kbit/s).",
      bitFields: [
        { name: "Signalling TS" + k, abbr: "abcd", bits: 4, desc: "Bit báo hiệu a, b, c, d của kênh TS" + k + " (nhấc/đặt máy, quay số…). Không dùng b, c, d thì đặt b = 1, c = 0, d = 1." },
        { name: "Signalling TS" + (k + 16), abbr: "abcd", bits: 4, desc: "Bit báo hiệu a, b, c, d của kênh TS" + (k + 16) + "." }
      ] });
  }

  function tsKids(from, to) {
    var out = [];
    for (var t = from; t <= to; t++)
      out.push(R("ts" + t, "TS" + t, "Time slot " + t, "payload", [0, t, 1, 1],
        "Khe thời gian " + t + ": 8 bit mỗi 125 µs = một kênh 64 kbit/s (thoại PCM G.711 hoặc dữ liệu). Kênh thoại số " + (t < 16 ? t : t - 1) + " trong 30 kênh."));
    return out;
  }

  F["e1"] = {
    id: "e1", name: "E1 (2,048 Mbit/s)", family: "pdh", category: "Khung PDH", order: 10,
    standard: "ITU-T G.704 (10/98) §2.3, §5.1.3; G.703 (10/98) §6",
    summary: "Khung PDH sơ cấp 2,048 Mbit/s: 32 khe thời gian × 8 bit, lặp mỗi 125 µs; đa khung CRC-4 và CAS 16 khung.",
    detail: "Mỗi khung E1 có 256 bit chia 32 khe (TS0–TS31), mỗi khe 64 kbit/s. TS0 không mang tải: khung chẵn chứa tín hiệu đồng bộ khung FAS 0011011, khung lẻ (NFAS) chứa bit A cảnh báo đầu xa và các bit Sa. Bit 1 của TS0 trên 16 khung tạo đa khung CRC-4 (C1–C4 giám sát lỗi, MFAS 001011, bit E báo lỗi ngược). TS16 hoặc mang báo hiệu kênh liên kết CAS (đa khung 16, mỗi kênh 4 bit abcd) – khi đó còn 30 kênh thoại – hoặc mang báo hiệu kênh chung / dữ liệu (31 kênh). Bấm TS0, TS16 để xem nghĩa thay đổi theo từng khung trong đa khung.",
    grid: { rows: 1, cols: 32, cellBits: 8 }, periodUs: 125, rateKbps: 2048, unit: "e1",
    multiframe: { frames: 16, note: MF_NOTE },
    regions: [
      R("ts0", "TS0", "Time slot 0 – FAS / NFAS / CRC-4", "fas", [0, 0, 1, 1],
        "Khe 0 dành cho đồng bộ và giám sát: xen kẽ khung có FAS (chẵn) và khung không FAS (lẻ); bit 1 qua 16 khung tạo đa khung CRC-4. Nghĩa từng bit thay đổi theo khung – xem perFrame.", { perFrame: ts0PerFrame }),
      R("ts1-15", "TS1–15", "Time slots 1–15", "payload", [0, 1, 1, 15],
        "15 khe tải đầu (kênh thoại 1–15), mỗi khe 64 kbit/s.", { children: tsKids(1, 15) }),
      R("ts16", "TS16", "Time slot 16 – CAS (hoặc CCS / tải)", "soh", [0, 16, 1, 1],
        "Khe 16: với báo hiệu kênh liên kết (CAS) mang đa khung báo hiệu – khung 0 là MFAS 0000XYXX, khung k (1–15) mang abcd của TS k và TS k+16. Với báo hiệu kênh chung (CCS, vd. SS7, ISDN PRA D-channel) hoặc không báo hiệu, TS16 là một kênh 64 kbit/s bình thường.", { perFrame: ts16PerFrame }),
      R("ts17-31", "TS17–31", "Time slots 17–31", "payload", [0, 17, 1, 15],
        "15 khe tải sau (kênh thoại 16–30), mỗi khe 64 kbit/s.", { children: tsKids(17, 31) })
    ]
  };

  // =====================================================================
  // E2 / E3 / E4 – khung bit, ghép xen bit 4 nhánh, chèn dương (G.742, G.751)
  // Mỗi hàng của lưới là một "set" (nhóm) trong bảng cấu trúc khung của chuẩn.
  // =====================================================================
  // Tạo region bit nhánh của một (nhóm) hàng: 4 nhánh ghép xen bit (step 4).
  function tribBits(pfx, r, h, c0, n, label, tribName) {
    var kids = [];
    for (var j = 0; j < 4; j++)
      kids.push(R(pfx + "-t" + (j + 1), tribName + " #" + (j + 1), "Bit nhánh " + tribName + " #" + (j + 1), "tributary", [r, c0 + j, h, n / 4, 4],
        "Bit của nhánh " + tribName + " #" + (j + 1) + ": cứ 4 bit một (ghép xen bit vòng theo thứ tự nhánh), " + n / 4 + " bit mỗi hàng."));
    return R(pfx, "Tributary bits", "Bits from tributaries (" + label + ")", "payload", [r, c0, h, n],
      n + " bit/hàng mang dữ liệu 4 nhánh " + tribName + " ghép xen từng bit theo thứ tự nhánh 1, 2, 3, 4, 1, 2…", { children: kids });
  }
  function cjCols(pfx, r, nSets, tribName) {
    var kids = [];
    for (var j = 0; j < 4; j++)
      kids.push(R(pfx + "-" + (j + 1), "C" + (j + 1) + "n", "Justification control bits of tributary " + (j + 1), "opu-oh", [r, j, nSets, 1],
        "Bit điều khiển chèn C" + (j + 1) + "1…C" + (j + 1) + nSets + " của nhánh " + tribName + " #" + (j + 1) + " (bit thứ " + (j + 1) + " ở các hàng " + (r + 1) + "–" + (r + nSets) + "). Tất cả = 1 → khung này chèn dương cho nhánh #" + (j + 1) + "; tất cả = 0 → không chèn."));
    return R(pfx, "Cjn", "Justification control bits Cjn", "opu-oh", [r, 0, nSets, 4],
      nSets + " bit Cj cho mỗi nhánh, rải trên " + nSets + " hàng (cột j = nhánh j) để một lỗi bit cục bộ không làm hỏng cả bộ. Đầu thu biểu quyết đa số (" + Math.ceil(nSets / 2 + 0.5) + "/" + nSets + "): đa số 1 → bit cơ hội chèn của nhánh là bit chèn (bỏ đi); đa số 0 → bit đó là dữ liệu.", { children: kids });
  }
  function justOpp(pfx, r, tribName) {
    var kids = [];
    for (var j = 0; j < 4; j++)
      kids.push(R(pfx + "-" + (j + 1), "S" + (j + 1), "Justification opportunity – tributary " + (j + 1), "opu-oh", [r, 4 + j, 1, 1],
        "Bit cơ hội chèn của nhánh " + tribName + " #" + (j + 1) + ": mang dữ liệu nhánh khi Cj báo không chèn; là bit chèn (giá trị không xác định, đầu thu bỏ qua) khi Cj báo chèn dương."));
    return R(pfx, "S", "Bits from tributaries available for justification", "opu-oh", [r, 4, 1, 4],
      "4 bit cơ hội chèn, mỗi nhánh một bit (bit 5–8 của hàng cuối).", { children: kids });
  }

  function pdhFrame(o) {
    // o: id, name, order, std, rate, tribName, tribRate, cols, rows, fas, fasLen, nN, summary, detail, ratio, maxJ
    var cols = o.cols, rows = o.rows, nSets = rows - 1;
    var row0 = [
      R("fas", "FAS", "Frame alignment signal " + o.fas, "fas", [0, 0, 1, o.fasLen],
        "Tín hiệu đồng bộ khung dạng bó (bunched) " + o.fas + " ở " + o.fasLen + " bit đầu hàng 1. Mất đồng bộ khi 4 FAS liên tiếp sai; lấy lại khi thấy 3 FAS đúng liên tiếp.", { values: [{ v: o.fas, m: "mẫu FAS cố định" }] }),
      R("a", "A", "Alarm indication to the remote multiplex", "soh", [0, o.fasLen, 1, 1],
        "Bit A: chỉ phát khi phía phân kênh mất tín hiệu tổng hoặc mất đồng bộ khung (RDI của PDH); mất một nhánh thì chèn AIS vào khe nhánh đó, không phát A; mất nguồn cũng không (G.742 §10.2 Table 2; G.751 §1.4.5/§1.5.5)."),
      R("n", "N", "Bit" + (o.nN > 1 ? "s" : "") + " reserved for national use", "reserved", [0, o.fasLen + 1, 1, o.nN],
        (o.nN > 1 ? o.nN + " bit" : "Bit") + " dự trữ cho sử dụng quốc gia; trên đường số qua biên giới cố định = 1."),
      tribBits("tb1", 0, 1, o.fasLen + 1 + o.nN, cols - o.fasLen - 1 - o.nN, "hàng 1", o.tribName)
    ];
    var regs = row0.concat([
      cjCols("cj", 1, nSets, o.tribName),
      tribBits("tb2", 1, nSets - 1, 4, cols - 4, "hàng 2–" + nSets, o.tribName),
      justOpp("jo", rows - 1, o.tribName),
      tribBits("tb" + rows, rows - 1, 1, 8, cols - 8, "hàng " + rows, o.tribName)
    ]);
    F[o.id] = {
      id: o.id, name: o.name, family: "pdh", category: "Khung PDH", order: o.order,
      standard: o.std, summary: o.summary, detail: o.detail,
      grid: { rows: rows, cols: cols, cellBits: 1 }, periodUs: rows * cols * 1000 / o.rate, rateKbps: o.rate, unit: o.id,
      regions: regs
    };
  }

  var JUST_RULE = function (n, all1, all0) {
    return " Quy tắc chèn dương: tốc độ khung chia cho mỗi nhánh hơi lớn hơn tốc độ danh định của nhánh, nên bộ ghép đọc nhánh nhanh hơn tốc độ nhánh; do đó định kỳ bỏ đọc một bit (chèn bit vô nghĩa tại vị trí cơ hội chèn) để bộ đệm nhánh không cạn – bộ ghép \"chờ\" nhánh (G.742 §5, G.751 §1.4.4). Khung có chèn thì " + n + " bit Cj của nhánh = " + all1 + ", không chèn = " + all0 + "; đầu thu biểu quyết đa số (chịu được " + (n === 3 ? "1" : "2") + " bit Cj lỗi) để biết có bỏ bit cơ hội chèn hay không – quyết sai sẽ trượt bit và mất đồng bộ khung của nhánh.";
  };

  pdhFrame({ id: "e2", name: "E2 (8,448 Mbit/s)", order: 20, std: "ITU-T G.742 §3 (Table 1), §5",
    rate: 8448, tribName: "E1", cols: 212, rows: 4, fas: "1111010000", fasLen: 10, nN: 1,
    summary: "Khung PDH bậc 2: 848 bit (4 nhóm × 212 bit) ≈ 100,38 µs, ghép xen bit 4 E1 có chèn dương.",
    detail: "Khung E2 dài 848 bit, chia 4 nhóm (set I–IV), mỗi hàng lưới là một nhóm, mỗi ô là 1 bit. Nhóm I: FAS 1111010000, bit A, bit N, rồi 200 bit nhánh. Nhóm II–IV bắt đầu bằng 4 bit điều khiển chèn Cj (mỗi nhánh một bit); nhóm IV thêm 4 bit cơ hội chèn. Bit nhánh ghép xen từng bit theo vòng nhánh 1→4. Mỗi nhánh có 205 bit cố định + 1 bit cơ hội chèn mỗi khung (tối đa 206), tỉ số chèn danh định 0,424, tốc độ chèn tối đa 10 kbit/s mỗi nhánh. G.703 có giao diện 8448 kbit/s; SDH không có đường ánh xạ cho E2 (G.707 §10.1)." + JUST_RULE(3, "111", "000") });

  pdhFrame({ id: "e3", name: "E3 (34,368 Mbit/s)", order: 30, std: "ITU-T G.751 §1.4 (Table 1), §2",
    rate: 34368, tribName: "E2", cols: 384, rows: 4, fas: "1111010000", fasLen: 10, nN: 1,
    summary: "Khung PDH bậc 3: 1536 bit (4 nhóm × 384 bit) ≈ 44,69 µs, ghép xen bit 4 E2 có chèn dương.",
    detail: "Khung E3 dài 1536 bit, cùng bố cục với E2 nhưng mỗi nhóm 384 bit: nhóm I có FAS 1111010000, bit A (bit 11), bit N (bit 12) và 372 bit nhánh; nhóm II, III có Cj1, Cj2 + 380 bit nhánh; nhóm IV có Cj3, 4 bit cơ hội chèn và 376 bit nhánh. Mỗi nhánh E2 tối đa 378 bit/khung, tỉ số chèn danh định 0,436, tốc độ chèn tối đa 22,375 kbit/s. E3 vào SDH qua ánh xạ không đồng bộ vào C-3 (VC-3 → TU-3 → TUG-3)." + JUST_RULE(3, "111", "000") });

  pdhFrame({ id: "e4", name: "E4 (139,264 Mbit/s)", order: 40, std: "ITU-T G.751 §1.5 (Table 2), §3",
    rate: 139264, tribName: "E3", cols: 488, rows: 6, fas: "111110100000", fasLen: 12, nN: 3,
    summary: "Khung PDH bậc 4: 2928 bit (6 nhóm × 488 bit) ≈ 21,02 µs, ghép xen bit 4 E3 có chèn dương.",
    detail: "Khung E4 dài 2928 bit, 6 nhóm × 488 bit: nhóm I có FAS 12 bit 111110100000, bit A (bit 13), 3 bit N (bit 14–16) và 472 bit nhánh; nhóm II–V có Cj1–Cj4 + 484 bit nhánh; nhóm VI có Cj5, 4 bit cơ hội chèn và 480 bit nhánh. Mỗi nhánh E3 tối đa 723 bit/khung, tỉ số chèn danh định 0,419, tốc độ chèn tối đa ≈ 47,563 kbit/s. Có 5 bit Cj nên biểu quyết đa số 3/5 chịu được 2 bit lỗi. E4 vào SDH qua ánh xạ không đồng bộ vào C-4, chiếm trọn một VC-4." + JUST_RULE(5, "11111", "00000") });

  // =====================================================================
  // TMUX – cây ghép kênh PDH (theo tốc độ, chèn bit)
  // =====================================================================
  function U(o) { o.family = "pdh"; M[o.id] = o; }

  U({ id: "ds0", name: "DS0 / kênh 64 kbit/s", kind: "client", level: 0, rateKbps: 64, standard: "ITU-T G.703 (10/98) §1 (64 kbit/s), G.711",
    summary: "Kênh cơ sở 64 kbit/s: một khe thời gian (8 bit × 8000 lần/s).",
    desc: "Một kênh thoại PCM G.711 (lấy mẫu 8 kHz × 8 bit) hoặc kênh dữ liệu 64 kbit/s. Là viên gạch của mọi cấp PDH/SDH: mỗi byte lặp mỗi 125 µs = 64 kbit/s." });

  U({ id: "e1", name: "E1 (2,048 Mbit/s)", kind: "pdh", level: 1, rateKbps: 2048, leafOk: true, frame: "e1", standard: "ITU-T G.703 (10/98) §6, G.704 (10/98) §2.3, §5",
    summary: "Luồng PDH sơ cấp châu Âu 2,048 Mbit/s (32 khe 64 kbit/s, ±50 ppm).",
    desc: "Ghép đồng bộ 30 (hoặc 31) kênh 64 kbit/s vào 32 khe thời gian – không cần chèn bit vì các kênh cùng đồng hồ. TS0 dành cho đồng bộ khung/CRC-4, TS16 cho báo hiệu CAS. Trong lab SDH, E1 được thả nguyên khối và ánh xạ không đồng bộ vào C-12 (bù lệch đồng hồ bằng bit chèn).",
    accepts: [
      { of: "ds0", count: 30, overhead: { kbps: 128, name: "TS0 + TS16 (CAS)", desc: "TS0: FAS/NFAS, CRC-4, cảnh báo A, bit Sa (64 kbit/s); TS16: đa khung báo hiệu CAS (64 kbit/s)." },
        mapping: "TDM đồng bộ (khe thời gian)", note: "30 × 64 + 128 = 2048 kbit/s – E1 thoại có báo hiệu kênh liên kết (CAS)." },
      { of: "ds0", count: 31, overhead: { kbps: 64, name: "TS0", desc: "TS0: FAS/NFAS, CRC-4, cảnh báo A, bit Sa." },
        mapping: "TDM đồng bộ (khe thời gian)", note: "31 × 64 + 64 = 2048 kbit/s – báo hiệu kênh chung (CCS) đi trong một khe, hoặc E1 thuần dữ liệu." }
    ] });

  U({ id: "e2", name: "E2 (8,448 Mbit/s)", kind: "pdh", level: 2, rateKbps: 8448, leafOk: true, frame: "e2", standard: "ITU-T G.742 (11/88), G.703 (10/98) §7",
    summary: "Luồng PDH bậc 2 châu Âu 8,448 Mbit/s = 4 E1 ghép xen bit có chèn dương (±30 ppm).",
    desc: "Bốn E1 có đồng hồ độc lập (cận đồng bộ – plesiochronous) được ghép xen bit; mỗi nhánh có một bit cơ hội chèn mỗi khung, điều khiển bởi 3 bit Cj (biểu quyết đa số). SDH không có container cho E2 – E2 chỉ là cấp trung gian trong PDH.",
    accepts: [
      { of: "e1", count: 4, overhead: { kbps: 256, name: "FAS, A, N, Cj, bit chèn", desc: "Phần tốc độ ngoài 4 × 2048: FAS 10 bit, A, N, 12 bit Cj, và phần bit cơ hội chèn không mang dữ liệu (danh định)." },
        mapping: "ghép xen bit + chèn dương", note: "4 × 2048 + 256 = 8448 kbit/s (danh định). Tỉ số chèn danh định 0,424: khoảng 42% số khung có chèn cho mỗi nhánh." }
    ] });

  U({ id: "e3", name: "E3 (34,368 Mbit/s)", kind: "pdh", level: 3, rateKbps: 34368, leafOk: true, frame: "e3", standard: "ITU-T G.751 (11/88) §1.4, §2; G.703 (10/98) §8",
    summary: "Luồng PDH bậc 3 châu Âu 34,368 Mbit/s = 4 E2 = 16 E1 (±20 ppm).",
    desc: "Ghép xen bit 4 E2 có chèn dương (G.751). Muốn lấy một E1 ra phải tách ngược qua E3 → E2 → E1 (\"bậc thang ghép\") – điểm yếu lớn nhất của PDH. Vào SDH bằng ánh xạ không đồng bộ vào C-3 rồi VC-3 → TU-3 → TUG-3.",
    accepts: [
      { of: "e2", count: 4, overhead: { kbps: 576, name: "FAS, A, N, Cj, bit chèn", desc: "Phần tốc độ ngoài 4 × 8448: FAS 10 bit, A, N, 12 bit Cj và phần bit cơ hội chèn không mang dữ liệu (danh định)." },
        mapping: "ghép xen bit + chèn dương", note: "4 × 8448 + 576 = 34368 kbit/s (danh định); tỉ số chèn danh định 0,436." }
    ] });

  U({ id: "e4", name: "E4 (139,264 Mbit/s)", kind: "pdh", level: 4, rateKbps: 139264, leafOk: true, frame: "e4", standard: "ITU-T G.751 (11/88) §1.5, §3; G.703 (10/98) §9",
    summary: "Luồng PDH bậc 4 châu Âu 139,264 Mbit/s = 4 E3 = 64 E1 (±15 ppm).",
    desc: "Ghép xen bit 4 E3 có chèn dương, 5 bit Cj mỗi nhánh. Vào SDH bằng ánh xạ không đồng bộ vào C-4 rồi VC-4 → AU-4, chiếm trọn một STM-1 (chỉ 64 E1 so với 63 E1 khi ghép qua TU-12, nhưng không truy nhập được từng E1).",
    accepts: [
      { of: "e3", count: 4, overhead: { kbps: 1792, name: "FAS, A, N, Cj, bit chèn", desc: "Phần tốc độ ngoài 4 × 34368: FAS 12 bit, A, 3 bit N, 20 bit Cj và phần bit cơ hội chèn không mang dữ liệu (danh định)." },
        mapping: "ghép xen bit + chèn dương", note: "4 × 34368 + 1792 = 139264 kbit/s (danh định); tỉ số chèn danh định 0,419." }
    ] });

  // =====================================================================
  // TLABS
  // =====================================================================
  L.push({
    id: "pdh", name: "Ghép kênh PDH", family: "pdh",
    roots: ["e4", "e3", "e2", "e1"],
    palette: ["ds0", "e1", "e2", "e3"],
    intro: "Chọn luồng đích (E1…E4) rồi lắp từ dưới lên: 30 kênh 64 kbit/s + TS0 + TS16 → E1; 4 E1 → E2; 4 E2 → E3; 4 E3 → E4. Mỗi bước PDH thêm overhead (FAS, bit cảnh báo, bit điều khiển chèn) nên E4 = 139 264 kbit/s lớn hơn 64 × 2048 = 131 072 kbit/s. Các nhánh không cùng đồng hồ nên phải chèn bit – và muốn rẽ một E1 phải tách ngược qua từng bậc."
  });
})();
