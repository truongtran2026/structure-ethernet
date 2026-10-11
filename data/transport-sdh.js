// Mảng Truyền dẫn – GD1: SDH (ETSI/ITU-T, ghép qua AU-4).
// Khung STM-N, VC-4, TUG-3, TU-3, TUG-2, TU-12 + cây ghép kênh + lab SDH.
// Schema: .claude/skills/transport-frame-spec/references/transport-schema.md
// Nguồn: ITU-T G.707/Y.1322 (cấu trúc khung, con trỏ, POH), G.841 (APS K1/K2; G.783 mô tả chức năng thiết bị), G.781 (SSM S1).
window.TFRAMES = window.TFRAMES || {};
window.TMUX = window.TMUX || {};
window.TLABS = window.TLABS || [];

(function () {
  var F = window.TFRAMES, M = window.TMUX, L = window.TLABS;

  // ---------- Hàm tiện ích ----------
  // Tạo region. rect = [r, c, h, w, step?] (0-based).
  function R(id, abbr, name, kind, rect, desc, extra) {
    var o = { id: id, name: name, abbr: abbr, kind: kind,
      rect: { r: rect[0], c: rect[1], h: rect[2], w: rect[3], step: rect[4] || 1 }, desc: desc };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  // ---------- Bit field dùng chung ----------
  function ptrBits(kindName, ssVal, range) {
    return [
      { name: "New Data Flag", abbr: "NDF", bits: 4,
        desc: "Cờ dữ liệu mới. 0110 = bình thường; 1001 = giá trị con trỏ mới (VC dời vị trí đột ngột). Bộ thu chấp nhận khi đúng ít nhất 3/4 bit." },
      { name: "SS bits", abbr: "SS", bits: 2,
        desc: "Chỉ thị loại " + kindName + ": " + ssVal + ". Bộ thu không bắt buộc kiểm tra." },
      { name: "Pointer value (I/D)", abbr: "I D I D I D I D I D", bits: 10,
        desc: "Giá trị con trỏ " + range + ", là độ lệch từ vị trí 0 tới byte đầu VC. Các bit lẻ là I (Increment), bit chẵn là D (Decrement): khi chèn dương đảo 5 bit I, khi chèn âm đảo 5 bit D để báo cho đầu thu." }
    ];
  }
  var C2_VALUES = [
    { v: "0x00", m: "Unequipped – không mang tải" },
    { v: "0x01", m: "Reserved (G.707 01/2007, Note 3): không dùng cho thiết bị thiết kế sau 10/2000; trước đây là equipped-non-specific; thiết kế mới dùng 0x05" },
    { v: "0x05", m: "Experimental mapping" },
    { v: "0x02", m: "Cấu trúc TUG (mang TUG-3/TUG-2)" },
    { v: "0x03", m: "Locked TU-n" },
    { v: "0x04", m: "Ánh xạ không đồng bộ 34/45 Mbit/s vào C-3" },
    { v: "0x12", m: "Ánh xạ không đồng bộ 140 Mbit/s (E4) vào C-4" },
    { v: "0x13", m: "ATM" },
    { v: "0x16", m: "HDLC/PPP" },
    { v: "0x1B", m: "GFP" },
    { v: "0xFE", m: "Tín hiệu đo thử O.181" },
    { v: "0xFF", m: "VC-AIS (dùng cho TCM)" }
  ];
  var G1_BITS = [
    { name: "Remote Error Indication", abbr: "REI", bits: 4,
      desc: "Số khối lỗi B3 (0–8) đầu thu phát hiện, gửi ngược về đầu phát để giám sát hiệu năng hai chiều. Giá trị 9–15 coi như 0." },
    { name: "Remote Defect Indication", abbr: "RDI", bits: 1,
      desc: "= 1 khi đầu thu bị lỗi nặng (AU-AIS, LOP, TIM, UNEQ…) – báo cho đầu xa biết đường đi bị hỏng." },
    { name: "Reserved / Enhanced RDI", abbr: "E-RDI", bits: 2,
      desc: "Dự trữ; nếu dùng RDI nâng cao thì cùng bit RDI phân biệt lỗi server / connectivity / payload." },
    { name: "Spare", abbr: "Spare", bits: 1, desc: "Dự phòng, chưa định nghĩa." }
  ];

  // 9 byte POH của VC-3/VC-4 trong một cột; vcName = "VC-4" | "VC-3".
  function pohBytes(prefix, col, vcName) {
    var d = [
      ["j1", "J1", "Path Trace", "poh",
        "Vết luồng (trace) bậc cao: lặp liên tục chuỗi 16 byte (có CRC-7) hoặc 64 byte định danh điểm truy nhập, để đầu thu kiểm tra có nối đúng luồng không (lỗi → TIM). Byte J1 là byte đầu tiên của " + vcName + "; con trỏ trỏ vào đây."],
      ["b3", "B3", "Path BIP-8", "poh",
        "Giám sát lỗi luồng: BIP-8 tính trên toàn bộ " + vcName + " khung trước. Đếm lỗi để tính hiệu năng luồng end-to-end."],
      ["c2", "C2", "Signal Label", "poh",
        "Nhãn tín hiệu: cho biết " + vcName + " đang mang gì (TUG, E4 không đồng bộ, ATM, GFP…). 0x00 = không mang tải (UNEQ). Không khớp nhãn mong đợi → PLM."],
      ["g1", "G1", "Path Status", "poh",
        "Trạng thái luồng gửi ngược về đầu phát: REI (số lỗi B3) và RDI (lỗi nặng ở đầu thu) – giúp giám sát cả hai chiều từ một đầu."],
      ["f2", "F2", "Path User Channel", "poh",
        "Kênh người dùng 64 kbit/s cho liên lạc giữa các phần tử đầu cuối luồng."],
      ["h4", "H4", "Position / Multiframe Indicator", "poh",
        "Chỉ thị vị trí đa khung: với tải TUG-2/TU-12, 2 bit cuối đếm 0–3 để xác định khung nào trong đa khung 500 µs (V1/V2/V3/V4). Còn dùng làm MFI cho VCAT."],
      ["f3", "F3", "Path User Channel", "poh",
        "Kênh người dùng thứ hai 64 kbit/s."],
      ["k3", "K3", "APS / Data Link", "poh",
        "Bit 1–4: báo hiệu bảo vệ tự động (APS) mức luồng bậc cao; bit 5–6 dự trữ; bit 7–8: kênh dữ liệu luồng bậc cao."],
      ["n1", "N1", "Network Operator / TCM", "poh",
        "Giám sát kết nối nối tiếp (Tandem Connection Monitoring): cho phép mỗi nhà khai thác giám sát lỗi trên đoạn luồng của mình."]
    ];
    return d.map(function (x, i) {
      var extra = {};
      if (x[0] === "c2") { extra.values = C2_VALUES; extra.bitFields = [{ name: "Signal label", abbr: "C2", bits: 8, desc: "Mã nhãn tín hiệu 8 bit (xem bảng giá trị)." }]; }
      if (x[0] === "g1") extra.bitFields = G1_BITS;
      if (x[0] === "k3") extra.bitFields = [
        { name: "APS", abbr: "APS", bits: 4, desc: "Báo hiệu bảo vệ tự động mức luồng bậc cao." },
        { name: "Reserved", abbr: "Res", bits: 2, desc: "Dự trữ." },
        { name: "Data link", abbr: "DL", bits: 2, desc: "Kênh dữ liệu luồng bậc cao." }
      ];
      return R(prefix + x[0], x[1], x[2], x[3], [i, col, 1, 1], x[4], extra);
    });
  }

  // =====================================================================
  // STM-1 – chi tiết từng byte
  // =====================================================================
  var stm1Rsoh = [
    R("fas", "A1A2", "Frame Alignment (A1×3, A2×3)", "fas", [0, 0, 1, 6],
      "Đồng bộ khung: chuỗi cố định A1A1A1A2A2A2 = F6F6F6 2828 28 đánh dấu đầu khung STM-1 để đầu thu bắt nhịp khung 125 µs. Không bị scramble.", {
        children: [
          R("a1", "A1", "Framing byte A1", "fas", [0, 0, 1, 3],
            "Byte đồng bộ khung thứ nhất, giá trị cố định 0xF6 (11110110).", { values: [{ v: "0xF6", m: "11110110" }], repeat: "×3N (STM-256: ×64)" }),
          R("a2", "A2", "Framing byte A2", "fas", [0, 3, 1, 3],
            "Byte đồng bộ khung thứ hai, giá trị cố định 0x28 (00101000).", { values: [{ v: "0x28", m: "00101000" }], repeat: "×3N (STM-256: ×64)" })
        ] }),
    R("j0", "J0", "Regenerator Section Trace", "soh", [0, 6, 1, 1],
      "Vết đoạn lặp: 1 byte (giá trị 0–255) hoặc khung 16 byte (G.831, có CRC-7) định danh điểm phát (64 byte chỉ áp dụng cho J1), để đầu thu kiểm tra đúng sợi/cổng (lỗi → RS-TIM). Ở STM-N chỉ có 1 J0, các vị trí còn lại là Z0.", { repeat: "×1 (+ Z0 ×(N−1))" }),
    R("r1-x", "X*", "Reserved – national use (unscrambled)", "reserved", [0, 7, 1, 2],
      "Dự trữ cho sử dụng quốc gia (X). Thuộc hàng 1 của RSOH nên không bị scramble (*) – cần chú ý nội dung để không phá đồng bộ.", { repeat: "×2N" }), // CẦN KIỂM: ký hiệu chính xác ô [1,8] [1,9] trong hình G.707 bản hiện hành
    R("b1", "B1", "RS BIP-8", "soh", [1, 0, 1, 1],
      "Giám sát lỗi đoạn lặp: BIP-8 tính trên toàn bộ khung STM-N trước (sau scramble), đặt vào khung hiện tại trước khi scramble. Mỗi trạm lặp đều tính lại.", { repeat: "×1" }),
    R("r2-d1", "Δ", "Media-dependent", "reserved", [1, 1, 1, 2],
      "Byte Δ – phụ thuộc môi trường truyền dẫn (vd. dùng riêng cho vô tuyến SDH).", { repeat: "×2N" }),
    R("e1", "E1", "RS Orderwire", "soh", [1, 3, 1, 1],
      "Kênh nghiệp vụ thoại 64 kbit/s giữa các trạm lặp (orderwire) – kỹ thuật viên gọi nhau dọc tuyến.", { repeat: "×1" }),
    R("r2-d2", "Δ", "Media-dependent", "reserved", [1, 4, 1, 1],
      "Byte Δ – phụ thuộc môi trường truyền dẫn.", { repeat: "×N" }),
    R("r2-res", "—", "Reserved (international)", "reserved", [1, 5, 1, 1],
      "Dự trữ cho chuẩn hoá quốc tế sau này.", { repeat: "×N" }),
    R("f1", "F1", "RS User Channel", "soh", [1, 6, 1, 1],
      "Kênh người dùng 64 kbit/s dành cho nhà khai thác (vd. truyền dữ liệu/thoại tạm thời ở trạm lặp).", { repeat: "×1" }),
    R("r2-x", "X", "Reserved – national use", "reserved", [1, 7, 1, 2],
      "Dự trữ cho sử dụng quốc gia (X).", { repeat: "×2N" }),
    R("dccr", "D1–D3", "Regenerator Section DCC", "soh", [2, 0, 1, 3, 3],
      "Kênh truyền thông dữ liệu đoạn lặp DCC_R: 3 byte × 64 kbit/s = 192 kbit/s, mang bản tin quản lý (TMN/OSI hoặc IP) để NMS điều khiển, giám sát cả trạm lặp.", {
        children: [
          R("d1", "D1", "DCC_R byte 1", "soh", [2, 0, 1, 1], "Byte 1/3 của kênh quản lý DCC_R 192 kbit/s."),
          R("d2", "D2", "DCC_R byte 2", "soh", [2, 3, 1, 1], "Byte 2/3 của kênh quản lý DCC_R 192 kbit/s."),
          R("d3", "D3", "DCC_R byte 3", "soh", [2, 6, 1, 1], "Byte 3/3 của kênh quản lý DCC_R 192 kbit/s.")
        ] }),
    R("r3-d1", "Δ", "Media-dependent", "reserved", [2, 1, 1, 2],
      "Byte Δ – phụ thuộc môi trường truyền dẫn.", { repeat: "×2N" }),
    R("r3-d2", "Δ", "Media-dependent", "reserved", [2, 4, 1, 1],
      "Byte Δ – phụ thuộc môi trường truyền dẫn.", { repeat: "×N" }),
    R("r3-res1", "—", "Reserved (international)", "reserved", [2, 5, 1, 1],
      "Dự trữ cho chuẩn hoá quốc tế.", { repeat: "×N" }),
    R("r3-res2", "—", "Reserved (international)", "reserved", [2, 7, 1, 2],
      "Dự trữ cho chuẩn hoá quốc tế.", { repeat: "×2N" }) // CẦN KIỂM: ô [3,8] [3,9] để trống (quốc tế) hay X
  ];

  var stm1Ptr = [
    R("h1h2", "H1H2", "AU-4 pointer word (H1 + H2)", "pointer", [3, 0, 1, 2, 3],
      "Từ con trỏ 16 bit ghép từ H1 và H2: cho biết vị trí byte J1 (đầu VC-4) trong vùng tải. Giá trị 0–782, mỗi đơn vị = 3 byte.", {
        bitFields: ptrBits("AU-4/AU-3/TU-3", "10 (AU-4)", "0–782 (đơn vị 3 byte)"),
        children: [
          R("h1", "H1", "Pointer byte H1", "pointer", [3, 0, 1, 1],
            "Byte con trỏ 1: chứa NDF (4 bit), SS (2 bit) và 2 bit cao của giá trị con trỏ.", { repeat: "×N" }),
          R("h2", "H2", "Pointer byte H2", "pointer", [3, 3, 1, 1],
            "Byte con trỏ 2: 8 bit thấp của giá trị con trỏ.", { repeat: "×N" })
        ] }),
    R("y", "Y", "Y bytes", "pointer", [3, 1, 1, 2],
      "Byte Y = 1001SS11 (bit S không quy định – \"S bits unspecified\"), không mang thông tin con trỏ AU-4. Là vị trí H1 của AU-3 #2, #3 (AU-3 vẫn nằm trong G.707); 1* ngay sau H2 là vị trí H2 của AU-3 #2, #3.", { values: [{ v: "1001SS11", m: "SS không quy định" }], repeat: "×2N" }),
    R("ones", "1*", "All-ones bytes", "pointer", [3, 4, 1, 2],
      "Byte 1* = 0xFF (11111111), giữ chỗ, không mang thông tin.", { values: [{ v: "0xFF", m: "11111111" }], repeat: "×2N" }),
    R("h3", "H3", "Pointer action bytes", "pointer", [3, 6, 1, 3],
      "Cơ hội chèn âm (negative justification): khi đồng hồ tải nhanh hơn, 3 byte H3 chở dữ liệu VC-4 trong một khung. Bình thường để trống. Cơ hội chèn dương là 3 byte ngay sau H3 (đầu vùng tải hàng 4).", { repeat: "×3N" })
  ];

  var stm1Msoh = [
    R("b2", "B2", "MS BIP-24", "soh", [4, 0, 1, 3],
      "Giám sát lỗi đoạn ghép: BIP-24 (3 byte) tính trên khung STM-1 trước trừ RSOH (trước scramble). Trạm lặp không tính lại; chỉ thiết bị kết cuối đoạn ghép (ADM, DXC) xử lý.", { repeat: "×3N" }),
    R("k1", "K1", "APS byte K1", "soh", [4, 3, 1, 1],
      "Bảo vệ chuyển mạch tự động (APS) đoạn ghép: K1 gửi yêu cầu chuyển mạch và số kênh cần bảo vệ (MSP tuyến tính 1+1, 1:N; vòng MS-SPRing dùng định dạng khác). Nguồn định nghĩa bit: ITU-T G.841 (G.783 chỉ mô tả chức năng thiết bị).", {
        repeat: "×1",
        bitFields: [
          { name: "Request type", abbr: "Request", bits: 4,
            desc: "Loại yêu cầu: 1111 Lockout, 1110 Forced switch, 1101/1100 SF ưu tiên cao/thấp, 1011/1010 SD cao/thấp, 1000 Manual, 0110 Wait-to-restore, 0100 Exercise, 0010 Reverse request, 0001 Do not revert, 0000 No request." },
          { name: "Channel number", abbr: "Ch#", bits: 4,
            desc: "Số kênh yêu cầu bảo vệ: 0 = kênh null (bảo vệ), 1–14 = kênh làm việc, 15 = kênh lưu lượng phụ (1:N)." }
        ] }),
    R("r5-a", "—", "Reserved", "reserved", [4, 4, 1, 2], "Dự trữ cho chuẩn hoá quốc tế.", { repeat: "×2N" }),
    R("k2", "K2", "APS byte K2", "soh", [4, 6, 1, 1],
      "Byte APS thứ hai: xác nhận kênh đã bắc cầu, kiểu kiến trúc và chế độ; 3 bit cuối còn mang MS-AIS/MS-RDI.", {
        repeat: "×1",
        bitFields: [
          { name: "Bridged channel", abbr: "Ch#", bits: 4, desc: "Số kênh đang được bắc cầu sang tuyến bảo vệ (xác nhận K1)." },
          { name: "Architecture", abbr: "A", bits: 1, desc: "0 = 1+1; 1 = 1:N." },
          { name: "Mode / MS-RDI / MS-AIS", abbr: "Mode", bits: 3,
            desc: "111 = MS-AIS; 110 = MS-RDI (báo lỗi về đầu xa); 101 = chế độ hai chiều; 100 = một chiều; các mã khác dự trữ." }
        ] }),
    R("r5-b", "—", "Reserved", "reserved", [4, 7, 1, 2], "Dự trữ cho chuẩn hoá quốc tế.", { repeat: "×2N" }),
    R("dccm", "D4–D12", "Multiplex Section DCC", "soh", [5, 0, 3, 3, 3],
      "Kênh truyền thông dữ liệu đoạn ghép DCC_M: 9 byte × 64 kbit/s = 576 kbit/s, mang bản tin quản lý giữa các thiết bị kết cuối đoạn ghép (NMS ↔ NE). Ở STM-256 còn có DCC mở rộng.", {
        children: [4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n, i) {
          return R("d" + n, "D" + n, "DCC_M byte " + (i + 1), "soh", [5 + Math.floor(i / 3), (i % 3) * 3, 1, 1],
            "Byte " + (i + 1) + "/9 của kênh quản lý DCC_M 576 kbit/s.");
        }) }),
    R("r6-a", "—", "Reserved", "reserved", [5, 1, 3, 2], "Dự trữ cho chuẩn hoá quốc tế (hàng 6–8).", { repeat: "×2N" }),
    R("r6-b", "—", "Reserved", "reserved", [5, 4, 3, 2], "Dự trữ cho chuẩn hoá quốc tế (hàng 6–8).", { repeat: "×2N" }),
    R("r6-c", "—", "Reserved", "reserved", [5, 7, 3, 2], "Dự trữ cho chuẩn hoá quốc tế (hàng 6–8).", { repeat: "×2N" }),
    R("s1", "S1", "Synchronization Status", "soh", [8, 0, 1, 1],
      "Trạng thái đồng bộ (SSM): báo chất lượng nguồn đồng hồ mà tín hiệu này mang theo, để thiết bị chọn nguồn đồng bộ tốt nhất và tránh vòng định thời.", {
        repeat: "×1",
        bitFields: [
          { name: "Reserved", abbr: "Res", bits: 4, desc: "Bit 1–4: G.707 không định nghĩa (§9.2.2.13)." },
          { name: "SSM quality level", abbr: "SSM", bits: 4,
            desc: "Bit 5–8: mức chất lượng – 0010 PRC (G.811), 0100 SSU-A (G.812 transit), 1000 SSU-B (G.812 local), 1011 SEC (G.813), 1111 DNU (không dùng để đồng bộ), 0000 chất lượng không xác định." }
        ],
        values: [
          { v: "0x02", m: "QL-PRC" }, { v: "0x04", m: "QL-SSU-A" }, { v: "0x08", m: "QL-SSU-B" },
          { v: "0x0B", m: "QL-SEC" }, { v: "0x0F", m: "QL-DNU" }
        ] }),
    R("r9-a", "—", "Reserved", "reserved", [8, 1, 1, 4],
      "Dự trữ cho chuẩn hoá quốc tế (trước đây gọi Z1/Z2).", { repeat: "×4N" }),
    R("m1", "M1", "MS-REI", "soh", [8, 5, 1, 1],
      "Chỉ thị lỗi đầu xa đoạn ghép: số khối lỗi B2 đầu thu phát hiện (STM-1: 0–24), gửi ngược về đầu phát. Ở STM-64/256 dùng cặp M0 + M1 (xem khung STM-64/256).", { repeat: "×1 (STM-64/256: M0 + M1)" }),
    R("e2", "E2", "MS Orderwire", "soh", [8, 6, 1, 1],
      "Kênh nghiệp vụ thoại 64 kbit/s giữa các thiết bị kết cuối đoạn ghép (trạm lặp không truy nhập được).", { repeat: "×1" }),
    R("r9-x", "X", "Reserved – national use", "reserved", [8, 7, 1, 2], "Dự trữ cho sử dụng quốc gia (X).", { repeat: "×2N" })
  ];

  F["stm-1"] = {
    id: "stm-1", name: "STM-1", family: "sdh", category: "Khung STM-N", order: 10,
    standard: "ITU-T G.707 §6.2, §9.2",
    summary: "Khung cơ sở SDH 155,52 Mbit/s: 9 hàng × 270 cột byte, lặp mỗi 125 µs.",
    detail: "Khung STM-1 truyền theo hàng, từ trái sang phải, trên xuống dưới (2430 byte/125 µs). Cột 1–9 chứa overhead cố định: RSOH (hàng 1–3) do mọi trạm lặp xử lý, con trỏ AU-4 (hàng 4) và MSOH (hàng 5–9) do thiết bị kết cuối đoạn ghép xử lý. Cột 10–270 là vùng tải chứa một VC-4 (9×261) – VC-4 không cố định mà trôi theo giá trị con trỏ H1H2 để bù lệch đồng hồ. Mỗi byte lặp 8000 lần/s nên một byte overhead = 64 kbit/s. Toàn khung (trừ hàng 1 RSOH) được scramble trước khi phát.",
    grid: { rows: 9, cols: 270, cellBits: 8 }, periodUs: 125, rateKbps: 155520, unit: "stm-1",
    regions: [
      R("soh", "SOH", "Section Overhead + AU-4 pointer (cột 1–9)", "soh", [0, 0, 9, 9],
        "Khu overhead đoạn cố định ở 9 cột đầu: RSOH (hàng 1–3), con trỏ AU-4 (hàng 4 – thuộc AU-4, không phải SOH nhưng nằm cùng khu) và MSOH (hàng 5–9). Tổng SOH = 72 byte/khung.", {
          children: [
            R("rsoh", "RSOH", "Regenerator Section Overhead", "soh", [0, 0, 3, 9],
              "Overhead đoạn lặp (27 byte, hàng 1–3): đồng bộ khung, trace, giám sát lỗi B1, nghiệp vụ, DCC_R. Mọi trạm lặp (REG) đều kết cuối và tạo lại RSOH.", { children: stm1Rsoh }),
            R("au4ptr", "AU-4 PTR", "AU-4 Pointer", "pointer", [3, 0, 1, 9],
              "Con trỏ AU-4 (9 byte, hàng 4): H1 Y Y H2 1* 1* H3 H3 H3. H1H2 chỉ vị trí J1 của VC-4 trong vùng tải; H3 và 3 byte sau H3 là cơ hội chèn âm/dương để bù chênh lệch tần số.", { children: stm1Ptr }),
            R("msoh", "MSOH", "Multiplex Section Overhead", "soh", [4, 0, 5, 9],
              "Overhead đoạn ghép (45 byte, hàng 5–9): giám sát lỗi B2, bảo vệ APS (K1/K2), DCC_M, SSM (S1), REI (M1), nghiệp vụ E2. Đi xuyên qua trạm lặp, chỉ ADM/DXC/TM kết cuối.", { children: stm1Msoh })
          ] }),
      R("vc4", "VC-4", "Virtual Container 4 (vẽ căn hàng 1)", "payload", [0, 9, 9, 261],
        "VC-4 = POH (1 cột) + C-4 (260 cột), 2349 byte. Lưới vẽ VC-4 căn thẳng hàng 1–9, cột 10–270 cho dễ học (tương ứng giá trị con trỏ 522). Thực tế VC-4 trôi tự do: con trỏ = 0 thì J1 nằm ngay sau byte H3 cuối (hàng 4, cột 10) và VC-4 vắt sang khung kế tiếp.", {
          children: [
            R("vc4-poh", "POH", "VC-4 Path Overhead", "poh", [0, 9, 9, 1],
              "Overhead luồng bậc cao (9 byte, một cột): J1, B3, C2, G1, F2, H4, F3, K3, N1. Đi xuyên suốt từ đầu đến cuối luồng VC-4, không bị trạm trung gian thay đổi.", { children: pohBytes("", 9, "VC-4") }),
            R("c4", "C-4", "Container C-4", "payload", [0, 10, 9, 260],
              "Container C-4 (2340 byte ≈ 149,76 Mbit/s): mang E4 139,264 Mbit/s ánh xạ không đồng bộ, hoặc 3×TUG-3 (khi đó 2 cột đầu là fixed stuff – xem khung VC-4 chứa TUG-3), hoặc tải gói (ATM, GFP).")
          ] })
    ]
  };

  // =====================================================================
  // STM-N (N = 4, 16, 64, 256) – mức nhóm, sinh bằng hàm
  // Cột SOH được xếp theo nhóm: cột STM-1 thứ k (1..9) ↔ N cột liên tiếp [(k−1)N, kN−1].
  // =====================================================================
  function stmN(N, order) {
    var p = "", nm = "STM-" + N;
    // Nhóm N ô: byte ở vị trí depth d (1-based) + dự trữ phần còn lại.
    function byteGroup(id, abbr, name, r, k, desc, depth) {
      var c0 = (k - 1) * N, d = (depth || 1) - 1, ch = [];
      if (d > 0) ch.push(R(id + "-pre", "—", "Reserved", "reserved", [r, c0, 1, d], "Dự trữ (các vị trí chưa dùng trong nhóm cột này)."));
      ch.push(R(id, abbr, name, "soh", [r, c0 + d, 1, 1], desc));
      if (N - 1 - d > 0) ch.push(R(id + "-post", "—", "Reserved", "reserved", [r, c0 + d + 1, 1, N - 1 - d], "Dự trữ (các vị trí chưa dùng trong nhóm cột này)."));
      return R(id + "-g", abbr + " +", name + " + dự trữ", "soh", [r, c0, 1, N],
        "Nhóm " + N + " byte ứng với cột " + k + " của STM-1: chỉ 1 byte " + abbr + " có nghĩa, còn lại dự trữ. " + desc, { children: ch });
    }
    function grp(id, abbr, name, kind, r, k, nk, desc, extra) {
      return R(id, abbr, name, kind, [r, (k - 1) * N, 1, nk * N], desc, extra);
    }
    // Hàng 1: STM-256 có nhánh riêng (G.707 §9.2.2.1, §6.5): chỉ 64 A1 + 64 A2; phần còn lại dự trữ, CÓ scramble.
    var rowA, rowB, resDesc = "Byte dự trữ ở hàng 1 của STM-256 – KHÔNG nằm trong số byte không scramble, vẫn bị scramble (G.707 §6.5, §9.2.2.1).";
    if (N === 256) {
      rowA = [
        R("r1-res-a", "—", "Reserved (scrambled)", "reserved", [0, 0, 1, 704], resDesc),
        R("a1", "A1", "Framing A1 ×64", "fas", [0, 704, 1, 64], "Byte đồng bộ khung 0xF6, chỉ 64 byte ở cột 705–768 (S(1,3,193..256)); không scramble.", { values: [{ v: "0xF6", m: "11110110" }], repeat: "×64" }),
        R("a2", "A2", "Framing A2 ×64", "fas", [0, 768, 1, 64], "Byte đồng bộ khung 0x28, chỉ 64 byte ở cột 769–832 (S(1,4,1..64)); không scramble.", { values: [{ v: "0x28", m: "00101000" }], repeat: "×64" }),
        R("r1-res-b", "—", "Reserved (scrambled)", "reserved", [0, 832, 1, 704], resDesc)
      ];
      rowB = [R("r1-res-c", "—", "Reserved (scrambled)", "reserved", [0, 1792, 1, 512], resDesc)];
    } else {
      rowA = [
        grp("a1", "A1", "Framing A1 ×" + 3 * N, "fas", 0, 1, 3, "Byte đồng bộ khung 0xF6, lặp " + 3 * N + " lần.", { values: [{ v: "0xF6", m: "11110110" }] }),
        grp("a2", "A2", "Framing A2 ×" + 3 * N, "fas", 0, 4, 3, "Byte đồng bộ khung 0x28, lặp " + 3 * N + " lần.", { values: [{ v: "0x28", m: "00101000" }] })
      ];
      rowB = [grp("r1-x", "X*", "National use (unscrambled)", "reserved", 0, 8, 2, "Dự trữ quốc gia; hàng 1 RSOH (9N byte) không bị scramble.")]; // CẦN KIỂM: phân bổ X ở hàng 1 STM-N
    }
    var rsoh = [
      R("j0z0", "J0/Z0", "J0 + Z0 ×" + (N - 1), "soh", [0, 6 * N, 1, N],
        "Byte đầu là J0 (trace đoạn lặp); " + (N - 1) + " byte sau là Z0 – dự trữ cho phát triển (trước đây là byte định danh STM-1 trong STM-N).", {
          children: [
            R("j0", "J0", "Regenerator Section Trace", "soh", [0, 6 * N, 1, 1], "Vết đoạn lặp: 1 byte (0–255) hoặc khung 16 byte (G.831) định danh điểm phát để kiểm tra kết nối đúng (64 byte chỉ áp dụng J1)."),
            R("z0", "Z0", "Spare Z0", "reserved", [0, 6 * N + 1, 1, N - 1], "Byte Z0 – dự trữ cho chuẩn hoá quốc tế.")
          ] }),
      byteGroup("b1", "B1", "RS BIP-8", 1, 1, "BIP-8 trên toàn khung STM-" + N + " trước – giám sát lỗi đoạn lặp."),
      grp("r2-d1", "Δ", "Media-dependent", "reserved", 1, 2, 2, "Byte Δ phụ thuộc môi trường truyền dẫn."),
      byteGroup("e1", "E1", "RS Orderwire", 1, 4, "Kênh nghiệp vụ thoại 64 kbit/s đoạn lặp."),
      grp("r2-d2", "Δ", "Media-dependent", "reserved", 1, 5, 1, "Byte Δ phụ thuộc môi trường truyền dẫn."),
      grp("r2-res", "—", "Reserved", "reserved", 1, 6, 1, "Dự trữ cho chuẩn hoá quốc tế."),
      byteGroup("f1", "F1", "RS User Channel", 1, 7, "Kênh người dùng 64 kbit/s."),
      grp("r2-x", "X", "National use", "reserved", 1, 8, 2, "Dự trữ cho sử dụng quốc gia."),
      byteGroup("d1", "D1", "DCC_R byte 1", 2, 1, "Byte 1/3 kênh quản lý DCC_R 192 kbit/s."),
      grp("r3-d1", "Δ", "Media-dependent", "reserved", 2, 2, 2, "Byte Δ phụ thuộc môi trường truyền dẫn."),
      byteGroup("d2", "D2", "DCC_R byte 2", 2, 4, "Byte 2/3 kênh quản lý DCC_R 192 kbit/s."),
      grp("r3-d2", "Δ", "Media-dependent", "reserved", 2, 5, 1, "Byte Δ phụ thuộc môi trường truyền dẫn."),
      grp("r3-res1", "—", "Reserved", "reserved", 2, 6, 1, "Dự trữ cho chuẩn hoá quốc tế."),
      byteGroup("d3", "D3", "DCC_R byte 3", 2, 7, "Byte 3/3 kênh quản lý DCC_R 192 kbit/s."),
      grp("r3-res2", "—", "Reserved", "reserved", 2, 8, 2, "Dự trữ cho chuẩn hoá quốc tế." + (N >= 16 ? " Với STM-16/64/256, Q1 (FSI của FEC trong băng, tuỳ chọn) nằm ở S(3,9,3) – xem §9.2.4." : ""))
    ];
    rsoh = rowA.concat([rsoh[0]], rowB, rsoh.slice(1));
    var ptr = [
      grp("h1", "H1", "H1 ×" + N, "pointer", 3, 1, 1, "Byte H1 của " + N + " con trỏ AU-4 (mỗi AU-4 một byte). Với VC-4-Xc, H1 của AU-4 thứ 2…X mang chỉ thị ghép chuỗi (concatenation indication) 1001SS11."),
      grp("y", "Y", "Y ×" + 2 * N, "pointer", 3, 2, 2, "Byte Y = 1001SS11 (S không quy định), vị trí H1 của AU-3 #2, #3."),
      grp("h2", "H2", "H2 ×" + N, "pointer", 3, 4, 1, "Byte H2 của " + N + " con trỏ AU-4. Với VC-4-Xc, H2 thứ 2…X = 11111111 (concatenation indication)."),
      grp("ones", "1*", "1* ×" + 2 * N, "pointer", 3, 5, 2, "Byte 0xFF giữ chỗ."),
      grp("h3", "H3", "H3 ×" + 3 * N, "pointer", 3, 7, 3, "Cơ hội chèn âm: 3 byte H3 cho mỗi AU-4.")
    ];
    // MS-REI: STM-64/256 cấp hai byte M0 (MSB, bit 1 của M0 là bit cao nhất) + M1, đếm 0–24N (§9.2.2.14).
    var m1Group;
    if (N >= 64) {
      var mc0 = 5 * N;
      m1Group = R("m1-g", "M0M1 +", "MS-REI M0 + M1 + dự trữ", "soh", [8, mc0, 1, N],
        "Nhóm " + N + " byte ứng với cột 6 của STM-1: M0 (S(9,6,2)) + M1 (S(9,6,3)) cùng mang MS-REI, còn lại dự trữ. Bộ đếm 0–" + 24 * N + " khối lỗi B2; bit 1 của M0 là MSB. Chỉ phát M1 khi cần tương thích thiết bị cũ (STM-64).", {
          children: [
            R("m1-pre", "—", "Reserved", "reserved", [8, mc0, 1, 1], "Dự trữ (các vị trí chưa dùng trong nhóm cột này)."),
            R("m0", "M0", "MS-REI byte M0", "soh", [8, mc0 + 1, 1, 1], "Byte cao của bộ đếm MS-REI (bit 1 = MSB); cùng M1 cho đếm tới " + 24 * N + " khối lỗi B2."), // CHƯA XÁC MINH: toạ độ M0 = S(9,6,2) theo hình G.707, cần đối chiếu bản gốc
            R("m1", "M1", "MS-REI byte M1", "soh", [8, mc0 + 2, 1, 1], "Byte thấp của bộ đếm MS-REI (STM-64 cũ chỉ dùng M1 để tương thích ngược)."),
            R("m1-post", "—", "Reserved", "reserved", [8, mc0 + 3, 1, N - 3], "Dự trữ (các vị trí chưa dùng trong nhóm cột này).")
          ] });
    } else {
      m1Group = byteGroup("m1", "M1", "MS-REI", 8, 6, "Số khối lỗi B2 phát hiện ở đầu thu (0–" + 24 * N + "), gửi ngược. Với STM-" + N + " M1 nằm ở vị trí thứ 3 của nhóm cột 6.", 3);
    }
    var msoh = [
      grp("b2", "B2", "MS BIP-" + 24 * N, "soh", 4, 1, 3, "BIP-" + 24 * N + " (" + 3 * N + " byte) trên khung trước trừ RSOH – giám sát lỗi đoạn ghép."),
      byteGroup("k1", "K1", "APS K1", 4, 4, "Yêu cầu chuyển mạch bảo vệ APS (loại yêu cầu + số kênh)."),
      grp("r5-a", "—", "Reserved", "reserved", 4, 5, 2, "Dự trữ cho chuẩn hoá quốc tế."),
      byteGroup("k2", "K2", "APS K2", 4, 7, "Xác nhận APS, kiến trúc, chế độ; mang MS-AIS/MS-RDI."),
      grp("r5-b", "—", "Reserved", "reserved", 4, 8, 2, "Dự trữ cho chuẩn hoá quốc tế."),
      R("dccm", "D4–D12", "Multiplex Section DCC", "soh", [5, 0, 3, 3, 3 * N],
        "DCC_M 576 kbit/s: D4–D12 nằm ở byte đầu của các nhóm cột 1, 4, 7, hàng 6–8.", {
          children: [4, 5, 6, 7, 8, 9, 10, 11, 12].map(function (n, i) {
            return R("d" + n, "D" + n, "DCC_M byte " + (i + 1), "soh", [5 + Math.floor(i / 3), (i % 3) * 3 * N, 1, 1], "Byte " + (i + 1) + "/9 của DCC_M.");
          }) }),
      R("r6-a", "—", "Reserved", "reserved", [5, 1, 3, N === 256 ? 7 : 3 * N - 1], "Dự trữ (hàng 6–8)."),
      N === 256 ? R("dccm-ext", "D13–D156", "Extended DCC_M (STM-256)", "soh", [5, 8, 3, 48],
        "DCC_M mở rộng chỉ có ở STM-256: 144 byte × 64 kbit/s = 9216 kbit/s. D13–D60 ở S(6,1,9..56), D61–D108 ở S(7,1,9..56), D109–D156 ở S(8,1,9..56) (G.707 §9.2.2.9).") : null,
      N === 256 ? R("r6-a2", "—", "Reserved", "reserved", [5, 56, 3, 3 * N - 56], "Dự trữ (hàng 6–8).") : null,
      R("r6-b", "—", "Reserved", "reserved", [5, 3 * N + 1, 3, 3 * N - 1], "Dự trữ (hàng 6–8)."),
      R("r6-c", "—", "Reserved", "reserved", [5, 6 * N + 1, 3, 3 * N - 1], "Dự trữ (hàng 6–8)."),
      byteGroup("s1", "S1", "Synchronization Status", 8, 1, "Bản tin trạng thái đồng bộ SSM (bit 5–8: PRC/SSU-A/SSU-B/SEC/DNU)."),
      grp("r9-a", "—", "Reserved", "reserved", 8, 2, 4, "Dự trữ cho chuẩn hoá quốc tế."),
      m1Group,
      byteGroup("e2", "E2", "MS Orderwire", 8, 7, "Kênh nghiệp vụ thoại 64 kbit/s đoạn ghép."),
      grp("r9-x", "X", "National use", "reserved", 8, 8, 2, "Dự trữ cho sử dụng quốc gia.")
    ].filter(Boolean);
    var payload = R("aug", "AUG-" + N, "Payload: " + N + " × VC-4 ghép xen byte", "payload", [0, 9 * N, 9, 261 * N],
      "Vùng tải 9×" + 261 * N + " byte chứa AUG-" + N + ": " + N + " VC-4 ghép xen từng byte (mỗi VC-4 một cột trong mỗi chu kỳ " + N + " cột) – hoặc VC-4-Xc ghép chuỗi. Mỗi VC-4 trôi độc lập theo con trỏ AU-4 riêng ở hàng 4." +
      (N <= 16 ? " Lưới tô từng VC-4 #k theo cột (căn hàng 1 như STM-1)." : " Với N lớn lưới không tách từng VC-4."));
    if (N <= 16) {
      payload.children = [];
      for (var k = 0; k < N; k++)
        payload.children.push(R("vc4-" + (k + 1), "VC-4 #" + (k + 1), "VC-4 cột ghép xen #" + (k + 1), "tributary", [0, 9 * N + k, 9, 261, N],
          "VC-4 chiếm cột thứ " + (k + 1) + " trong mỗi nhóm " + N + " cột của vùng tải (bước " + N + "). Số AU-4 tăng từ trái sang phải theo cột (G.707 §7.3): STM-4 AU-4 #B ở cột B; STM-16 cột X = 1 + 4(C−1) + (B−1) + 16(X−1) với #k = 4(C−1) + B (B = chỉ số AUG-1 trong AUG-4, C = chỉ số AUG-4 trong AUG-16).")); 
    }
    F[nm.toLowerCase()] = {
      id: nm.toLowerCase(), name: nm, family: "sdh", category: "Khung STM-N", order: order,
      standard: "ITU-T G.707 §6.2, §9.2",
      summary: "Khung SDH " + (155.52 * N).toLocaleString("vi-VN") + " Mbit/s = " + N + " × STM-1 ghép xen byte; 9 hàng × " + 270 * N + " cột.",
      detail: "STM-" + N + " giữ chu kỳ 125 µs nhưng mỗi hàng rộng gấp " + N + " lần: " + 9 * N + " cột SOH + " + 261 * N + " cột tải. SOH được ghép xen byte từ " + N + " STM-1 nhưng " + (N === 256 ? "chỉ B2 và con trỏ lặp đủ (A1/A2 chỉ có 64 + 64 byte, §9.2.2.1)" : "chỉ các byte A1/A2/B2/con trỏ lặp đủ") + "; J0, B1, E1, F1, D1–D12, K1, K2, S1, M1, E2 chỉ có một bản, phần còn lại là dự trữ. Lưới này vẽ ở mức nhóm: mỗi nhóm " + N + " cột ứng với một cột SOH của STM-1." +
        (N === 256 ? " Hàng 1 của STM-256: chỉ 64 A1 (cột 705–768) và 64 A2 (cột 769–832) không scramble; mọi byte còn lại của hàng 1 từ S(1,4,65) trở đi — kể cả J0/Z0 — đều bị scramble; chỉ 128 byte A1/A2 không scramble (§6.5 Note 3). STM-256 còn có DCC_M mở rộng D13–D156 (9216 kbit/s)." : " Hàng 1 của RSOH (9N byte) không bị scramble.") +
        (N >= 16 ? " STM-16/64/256 có thể dùng FEC trong băng tuỳ chọn (byte P1/Q1, §9.2.4; STM-16 theo Appendix IX); Q1 (FSI) ở S(3,9,3)." : "") +
        (N >= 64 ? " STM-64/256 dùng cặp M0 + M1 cho MS-REI." : ""),
      grid: { rows: 9, cols: 270 * N, cellBits: 8 }, periodUs: 125, rateKbps: 155520 * N, unit: nm.toLowerCase(),
      regions: [
        R("soh", "SOH", "Section Overhead + AU-4 pointers (" + 9 * N + " cột)", "soh", [0, 0, 9, 9 * N],
          "Khu overhead cố định: RSOH hàng 1–3, " + N + " con trỏ AU-4 hàng 4, MSOH hàng 5–9; tổng SOH " + 72 * N + " byte.", {
            children: [
              R("rsoh", "RSOH", "Regenerator Section Overhead", "soh", [0, 0, 3, 9 * N], "Overhead đoạn lặp " + 27 * N + " byte, kết cuối ở mọi trạm lặp.", { children: rsoh }),
              R("au4ptr", "AU-4 PTR ×" + N, "AU-4 Pointers", "pointer", [3, 0, 1, 9 * N], N + " con trỏ AU-4 ghép xen byte: H1×N, Y×2N, H2×N, 1*×2N, H3×3N.", { children: ptr }),
              R("msoh", "MSOH", "Multiplex Section Overhead", "soh", [4, 0, 5, 9 * N], "Overhead đoạn ghép " + 45 * N + " byte, kết cuối ở ADM/DXC.", { children: msoh })
            ] }),
        payload
      ]
    };
  }
  stmN(4, 20); stmN(16, 30); stmN(64, 40); stmN(256, 50);

  // =====================================================================
  // VC-4 (mang C-4) và VC-4 mang 3×TUG-3
  // =====================================================================
  F["vc-4"] = {
    id: "vc-4", name: "VC-4", family: "sdh", category: "Container bậc cao", order: 10,
    standard: "ITU-T G.707 §9.3.1, §10.1.1.1",
    summary: "Container ảo bậc cao 9×261 byte: 1 cột POH + C-4 260 cột (≈150,3 Mbit/s).",
    detail: "VC-4 là đơn vị luồng bậc cao được đấu chéo trong mạng SDH. Cột đầu là POH 9 byte đi xuyên suốt luồng; 260 cột còn lại là C-4. Với E4 139,264 Mbit/s, mỗi hàng C-4 chia 20 khối 13 byte theo mẫu byte W/X/Y/Z (D dữ liệu, R fixed stuff, C bit điều khiển chèn, S bit cơ hội chèn, O bit overhead) để ánh xạ không đồng bộ. Khi lắp vào STM-1, VC-4 + con trỏ AU-4 thành AU-4 và trôi theo con trỏ.",
    grid: { rows: 9, cols: 261, cellBits: 8 }, periodUs: 125, rateKbps: 150336, unit: "vc-4",
    regions: [
      R("poh", "POH", "VC-4 Path Overhead", "poh", [0, 0, 9, 1],
        "Overhead luồng bậc cao: J1 (trace), B3 (BIP-8), C2 (nhãn tín hiệu), G1 (REI/RDI), F2, H4 (chỉ thị đa khung), F3, K3 (APS), N1 (TCM).", { children: pohBytes("", 0, "VC-4") }),
      R("c4", "C-4", "Container C-4", "payload", [0, 1, 9, 260],
        "Vùng tải 2340 byte/125 µs (149,76 Mbit/s). Ánh xạ không đồng bộ E4 (C2 = 0x12): mỗi hàng 20 khối × 13 byte, gồm byte dữ liệu, byte fixed stuff, 5 bit điều khiển chèn C và 1 bit cơ hội chèn S mỗi hàng (G.707 §10.1.1.1).", {
          values: [
            { v: "W", m: "8D – 8 bit dữ liệu" },
            { v: "X", m: "C + 5R + 2O – 1 bit điều khiển chèn, 5 bit fixed stuff, 2 bit overhead" },
            { v: "Y", m: "8R – 8 bit fixed stuff" },
            { v: "Z", m: "6D + S + R – 6 bit dữ liệu, 1 bit cơ hội chèn, 1 bit fixed stuff" }
          ] })
    ]
  };

  var tug3Cols = [];
  for (var t = 0; t < 3; t++)
    tug3Cols.push(R("tug3-" + (t + 1), "TUG-3 #" + (t + 1), "TUG-3 #" + (t + 1), "tributary", [0, 3 + t, 9, 86, 3],
      "TUG-3 thứ " + (t + 1) + " (9×86 = 774 byte) chiếm các cột " + (4 + t) + ", " + (7 + t) + ", " + (10 + t) + "… của VC-4 (bước 3). Mỗi TUG-3 tự chọn mang 1×TU-3 hoặc 7×TUG-2 – xem khung TUG-3 / TU-3."));
  F["vc-4-tug3"] = {
    id: "vc-4-tug3", name: "VC-4 (3×TUG-3)", family: "sdh", category: "Container bậc cao", order: 20,
    standard: "ITU-T G.707 §7.2.1",
    summary: "VC-4 cấu trúc TUG: POH + 2 cột fixed stuff + 3 TUG-3 ghép xen từng byte.",
    detail: "Khi C2 = 0x02, VC-4 mang 3 TUG-3. Cột 1 là POH, cột 2–3 là fixed stuff (18 byte), 258 cột còn lại chia cho 3 TUG-3 ghép xen byte: TUG-3 #1 ở cột 4, 7, 10…; #2 ở cột 5, 8, 11…; #3 ở cột 6, 9, 12…. Đây là đường ghép 63×E1 vào STM-1: 3 TUG-3 × 7 TUG-2 × 3 TU-12. Byte H4 trong POH cung cấp chỉ thị đa khung 500 µs cho các TU-12.",
    grid: { rows: 9, cols: 261, cellBits: 8 }, periodUs: 125, rateKbps: 150336, unit: "vc-4",
    regions: [
      R("poh", "POH", "VC-4 Path Overhead", "poh", [0, 0, 9, 1],
        "Overhead luồng VC-4 (C2 = 0x02 cấu trúc TUG; H4 đếm đa khung cho TU-12).", { children: pohBytes("", 0, "VC-4") }),
      R("fs", "FS", "Fixed stuff", "stuff", [0, 1, 9, 2],
        "Chèn cố định 2 cột (18 byte) để 3×86 = 258 cột TUG-3 vừa với 260 cột C-4. Không mang thông tin."),
      R("tug3s", "3×TUG-3", "3 TUG-3 ghép xen byte", "payload", [0, 3, 9, 258],
        "Vùng 258 cột chứa 3 TUG-3 ghép xen từng byte (bước 3 cột).", { children: tug3Cols })
    ]
  };

  // =====================================================================
  // VC-4-Xc (X = 4, 16, 64, 256) – ghép chuỗi liền kề, mức nhóm
  // 9 × 261X cột: POH 1 cột + fixed stuff (X−1) cột + C-4-Xc 260X cột.
  // =====================================================================
  [4, 16, 64, 256].forEach(function (X, i) {
    var nm = "VC-4-" + X + "c", cols = 261 * X;
    F["vc-4-" + X + "c"] = {
      id: "vc-4-" + X + "c", name: nm, family: "sdh", category: "Container bậc cao", order: 30 + 10 * i,
      standard: "ITU-T G.707 §11.1 (ghép chuỗi liền kề VC-4-Xc), §9.3.1 (POH)",
      summary: "VC-4-" + X + "c ghép chuỗi liền kề: 9×" + cols + " byte, 1 cột POH + " + (X - 1) + " cột fixed stuff + C-4-" + X + "c " + 260 * X + " cột.",
      detail: nm + " là một container liền khối (không phải " + X + " VC-4 độc lập): chỉ có MỘT POH ở cột đầu (J1…N1 như VC-4; B3 tính trên toàn " + nm + "), tiếp theo " + (X - 1) + " cột fixed stuff, rồi C-4-" + X + "c " + 260 * X + " cột (" + 9 * 260 * X + " byte ≈ " + (9 * 260 * X * 64 / 1000).toLocaleString("vi-VN") + " Mbit/s) mang tải gói (POS, ATM, GFP" + (X === 64 ? ", 10GBASE-W WAN PHY" : "") + ") dưới dạng một đường liền với tốc độ " + X + " lần C-4. Trong STM-" + X + ", " + nm + " + " + X + " con trỏ AU-4 (con trỏ #1 bình thường, " + (X - 1) + " con trỏ sau mang chỉ thị ghép chuỗi 1001SS11 11111111) tạo thành AU-4-" + X + "c và cả khối trôi theo con trỏ #1. Lưới vẽ căn hàng 1 ở mức nhóm cột.",
      grid: { rows: 9, cols: cols, cellBits: 8 }, periodUs: 125, rateKbps: 9 * cols * 64, unit: "vc-4-" + X + "c",
      regions: [
        R("poh", "POH", nm + " Path Overhead (1 cột duy nhất)", "poh", [0, 0, 9, 1],
          "Overhead luồng bậc cao duy nhất của " + nm + ": J1, B3 (tính trên toàn " + nm + "), C2, G1, F2, H4, F3, K3, N1 – cùng định dạng POH như VC-4.", { children: pohBytes("", 0, nm) }),
        R("fs", "FS", "Fixed stuff (" + (X - 1) + " cột)", "stuff", [0, 1, 9, X - 1],
          (X - 1) + " cột fixed stuff (" + 9 * (X - 1) + " byte) ngay sau POH – thay cho " + (X - 1) + " POH của các VC-4 thành phần, không mang thông tin."),
        R("c4xc", "C-4-" + X + "c", "Container C-4-" + X + "c", "payload", [0, X, 9, 260 * X],
          "Container C-4-" + X + "c: " + 9 * 260 * X + " byte/125 µs (" + (9 * 260 * X * 64 / 1000).toLocaleString("vi-VN") + " Mbit/s). Mang tải gói ánh xạ như POS, ATM, GFP" + (X === 64 ? "; 10GBASE-W (WAN PHY) khớp đúng dung lượng này (IEEE 802.3 Clause 50)" : "") + ".")
      ]
    };
  });

  // =====================================================================
  // TUG-3 (7×TUG-2) và TU-3
  // =====================================================================
  var tug2Cols = [];
  for (var g = 0; g < 7; g++)
    tug2Cols.push(R("tug2-" + (g + 1), "TUG-2 #" + (g + 1), "TUG-2 #" + (g + 1), "tributary", [0, 2 + g, 9, 12, 7],
      "TUG-2 thứ " + (g + 1) + " (9×12 = 108 byte) chiếm cột " + (3 + g) + ", " + (10 + g) + ", " + (17 + g) + "… của TUG-3 (bước 7). Mang 3×TU-12 (3 E1) – xem khung TUG-2."));
  F["tug-3"] = {
    id: "tug-3", name: "TUG-3 (7×TUG-2)", family: "sdh", category: "Container bậc thấp", order: 10,
    standard: "ITU-T G.707 §7.2.3 (TU-3 vào TUG-3: §7.2.2)",
    summary: "Nhóm đơn vị nhánh 3: 9×86 byte, 2 cột fixed stuff + 7 TUG-2 ghép xen byte.",
    detail: "TUG-3 có hai cách lấp: 1×TU-3 (cùng kích thước 9×86, xem khung TU-3) hoặc 7×TUG-2 như lưới này. Khi mang TUG-2, cả cột 1 và cột 2 (18 byte, gồm các vị trí H1/H2/H3 của TU-3) đều là fixed stuff (G.707 §7.2.3, Hình 7-8). Lưu ý: NPI (Null Pointer Indication) chỉ có ở bản G.707 cũ, đã bị bỏ khỏi bản hiện hành. 84 cột còn lại chia cho 7 TUG-2 ghép xen byte, bước 7 cột.",
    grid: { rows: 9, cols: 86, cellBits: 8 }, periodUs: 125, rateKbps: 49536, unit: "tug-3",
    regions: [
      R("oh", "FS", "Fixed stuff (cột 1–2)", "stuff", [0, 0, 9, 2],
        "18 byte fixed stuff của bước ghép 7×TUG-2 → TUG-3 (G.707 hiện hành không còn NPI).", {
          children: [
            R("npi", "FS", "Fixed stuff (vị trí H1/H2 của TU-3)", "stuff", [0, 0, 2, 1],
              "Hai byte ở vị trí H1/H2 của TU-3 là fixed stuff. Bản G.707 cũ ghi NPI (1001SS11 11100000) ở đây; bản hiện hành bỏ NPI."),
            R("npi-h3", "FS", "Fixed stuff (vị trí H3)", "stuff", [2, 0, 1, 1],
              "Vị trí H3 của TU-3; khi mang TUG-2 là fixed stuff."),
            R("fs1", "FS", "Fixed stuff cột 1", "stuff", [3, 0, 6, 1], "Chèn cố định hàng 4–9 của cột 1."),
            R("fs2", "FS", "Fixed stuff cột 2", "stuff", [0, 1, 9, 1], "Chèn cố định toàn bộ cột 2.")
          ] }),
      R("tug2s", "7×TUG-2", "7 TUG-2 ghép xen byte", "payload", [0, 2, 9, 84],
        "84 cột = 7 TUG-2 × 12 cột, ghép xen từng byte (bước 7).", { children: tug2Cols })
    ]
  };

  F["tu-3"] = {
    id: "tu-3", name: "TU-3", family: "sdh", category: "Container bậc thấp", order: 20,
    standard: "ITU-T G.707 §8.2, §10.1.2.2",
    summary: "Đơn vị nhánh 3: con trỏ H1/H2/H3 + fixed stuff (cột 1) + VC-3 9×85 – mang E3 34 Mbit/s.",
    detail: "TU-3 = VC-3 (765 byte) + con trỏ TU-3 3 byte + 6 byte fixed stuff = 774 byte, đúng bằng một TUG-3. Con trỏ H1H2 (giá trị 0–764, đơn vị 1 byte) chỉ vị trí J1 của VC-3; H3 là cơ hội chèn âm. Lưới vẽ VC-3 căn hàng 1, cột 2–86; thực tế VC-3 trôi theo con trỏ (con trỏ = 0 ⇒ J1 ngay sau H3 ở hàng 3; VC-3 căn hàng 1 như lưới vẽ ⇔ con trỏ TU-3 = 595, Hình 8-8). C-3 mang E3 34,368 Mbit/s ánh xạ không đồng bộ (C2 = 0x04).",
    grid: { rows: 9, cols: 86, cellBits: 8 }, periodUs: 125, rateKbps: 49536, unit: "tu-3",
    regions: [
      R("col1", "PTR+FS", "Con trỏ TU-3 + fixed stuff (cột 1)", "pointer", [0, 0, 9, 1],
        "Cột 1 của TU-3: 3 byte con trỏ H1, H2, H3 và 6 byte fixed stuff.", {
          children: [
            R("h1h2", "H1H2", "TU-3 pointer word", "pointer", [0, 0, 2, 1],
              "Từ con trỏ TU-3 (H1 + H2): chỉ vị trí J1 của VC-3, giá trị 0–764.", {
                bitFields: ptrBits("TU-3", "10", "0–764 (đơn vị 1 byte)"),
                children: [
                  R("h1", "H1", "Pointer byte H1", "pointer", [0, 0, 1, 1], "NDF + SS + 2 bit cao giá trị con trỏ."),
                  R("h2", "H2", "Pointer byte H2", "pointer", [1, 0, 1, 1], "8 bit thấp giá trị con trỏ.")
                ] }),
            R("h3", "H3", "Pointer action byte", "pointer", [2, 0, 1, 1],
              "Cơ hội chèn âm: mang 1 byte dữ liệu VC-3 khi cần chèn âm. Cơ hội chèn dương là byte ngay sau H3."),
            R("fs", "FS", "Fixed stuff", "stuff", [3, 0, 6, 1], "6 byte chèn cố định (hàng 4–9).")
          ] }),
      R("vc3", "VC-3", "Virtual Container 3 (vẽ căn hàng 1)", "payload", [0, 1, 9, 85],
        "VC-3 = POH 9 byte + C-3 756 byte = 765 byte. Lưới vẽ căn hàng 1 (J1 ở hàng 1 cột 2) ⇔ con trỏ TU-3 = 595 (offset 0 nằm ngay sau H3 hàng 3); thực tế trôi theo con trỏ TU-3.", {
          children: [
            R("vc3-poh", "POH", "VC-3 Path Overhead", "poh", [0, 1, 9, 1],
              "Overhead luồng VC-3: J1, B3, C2, G1, F2, H4, F3, K3, N1 – cùng định dạng POH bậc cao như VC-4.", { children: pohBytes("vc3-", 1, "VC-3") }),
            R("c3", "C-3", "Container C-3", "payload", [0, 2, 9, 84],
              "Container C-3: 756 byte/125 µs (48,384 Mbit/s). Mang E3 34,368 Mbit/s ánh xạ không đồng bộ (3 khung con, bit chèn C/S).")
          ] })
    ]
  };

  // =====================================================================
  // TUG-2 (3×TU-12) và TU-12
  // =====================================================================
  var V5_BITS = [
    { name: "BIP-2", abbr: "BIP-2", bits: 2, desc: "Giám sát lỗi VC-12: bit 1 kiểm chẵn các bit lẻ, bit 2 kiểm chẵn các bit chẵn của toàn VC-12 đa khung trước." },
    { name: "Remote Error Indication", abbr: "REI", bits: 1, desc: "= 1 khi đầu thu phát hiện lỗi BIP-2 – gửi ngược về đầu phát." },
    { name: "Remote Failure Indication", abbr: "RFI", bits: 1, desc: "Bit 4 của V5: RFI chỉ định nghĩa cho VC-11 byte-synchronous; với VC-12 bit này \"undefined\" (chưa định nghĩa) – G.707 §9.3.2.1." },
    { name: "Signal Label", abbr: "L1L2L3", bits: 3,
      desc: "Nhãn tín hiệu VC-12: 000 unequipped, 001 Reserved (bản cũ: equipped non-specific; thiết bị mới dùng 101 + K4), 010 asynchronous (E1 không đồng bộ), 011 bit-synchronous, 100 byte-synchronous, 101 nhãn mở rộng (xem K4), 110 tín hiệu thử O.181, 111 VC-AIS." },
    { name: "Remote Defect Indication", abbr: "RDI", bits: 1, desc: "= 1 khi đầu thu có lỗi nặng (TU-AIS, LOP…) – báo về đầu xa." }
  ];
  // Các region của một TU-12 có cột đầu c0, bước st (st = 1 trong khung TU-12, 3 trong TUG-2).
  function tu12Parts(pfx, c0, st) {
    return [
      R(pfx + "v", "V1–V4", "TU-12 pointer byte (V1/V2/V3/V4)", "pointer", [0, c0, 1, 1],
        "Byte con trỏ TU-12, đổi theo khung trong đa khung 500 µs: V1 (khung 1) + V2 (khung 2) = từ con trỏ NDF|SS=10|giá trị 0–139 chỉ vị trí V5; V3 (khung 3) = cơ hội chèn âm; V4 (khung 4) = dự trữ.", {
          values: [
            { v: "V1", m: "Khung 1: byte con trỏ cao (NDF, SS, 2 bit giá trị)" },
            { v: "V2", m: "Khung 2: byte con trỏ thấp (8 bit giá trị)" },
            { v: "V3", m: "Khung 3: cơ hội chèn âm; byte sau V3 là cơ hội chèn dương" },
            { v: "V4", m: "Khung 4: dự trữ" }
          ] }),
      R(pfx + "poh", "V5/J2/N2/K4", "VC-12 POH byte (V5, J2, N2, K4)", "poh", [0, c0 + st, 1, 1],
        "Byte POH VC-12, mỗi khung 125 µs một byte của đa khung: V5 (khung có V2 đứng trước khi con trỏ = 0) – BIP-2/REI/RFI/nhãn/RDI; J2 – trace luồng bậc thấp; N2 – TCM bậc thấp; K4 – nhãn mở rộng, APS bậc thấp, RDI nâng cao. bitFields dưới đây là của V5.", {
          bitFields: V5_BITS,
          values: [
            { v: "V5", m: "Giám sát lỗi (BIP-2), REI, RFI, signal label, RDI" },
            { v: "J2", m: "Trace luồng bậc thấp (16 byte có CRC-7)" },
            { v: "N2", m: "Tandem connection monitoring bậc thấp" },
            { v: "K4", m: "Nhãn mở rộng / VCAT, APS bậc thấp, E-RDI" }
          ] }),
      R(pfx + "c12a", "C-12", "C-12 (hàng 1)", "payload", [0, c0 + 2 * st, 1, 2, st],
        "Phần C-12 ở hàng 1 (2 byte)."),
      R(pfx + "c12b", "C-12", "C-12 (hàng 2–9)", "payload", [1, c0, 8, 4, st],
        "Phần C-12 hàng 2–9 (32 byte). Cùng 2 byte hàng 1 thành 34 byte/125 µs = 136 byte/đa khung, mang E1 2,048 Mbit/s ánh xạ không đồng bộ (byte R fixed stuff, bit điều khiển chèn C1/C2, bit cơ hội chèn S1/S2).")
    ];
  }

  var tu12Cols = [];
  for (var u = 0; u < 3; u++)
    tu12Cols.push(R("tu12-" + (u + 1), "TU-12 #" + (u + 1), "TU-12 #" + (u + 1), "tributary", [0, u, 9, 4, 3],
      "TU-12 thứ " + (u + 1) + " chiếm cột " + (u + 1) + ", " + (u + 4) + ", " + (u + 7) + ", " + (u + 10) + " của TUG-2 (bước 3) – 36 byte, mang 1 E1.", { children: tu12Parts("t" + (u + 1) + "-", u, 3) }));
  F["tug-2"] = {
    id: "tug-2", name: "TUG-2", family: "sdh", category: "Container bậc thấp", order: 30,
    standard: "ITU-T G.707 §7.2.6",
    summary: "Nhóm đơn vị nhánh 2: 9×12 byte = 3 TU-12 ghép xen từng byte (3 E1).",
    detail: "TUG-2 gom 3 TU-12 (mỗi TU-12 9×4) bằng ghép xen byte: cột 1, 4, 7, 10 của TU-12 #1; cột 2, 5, 8, 11 của #2; cột 3, 6, 9, 12 của #3. Không thêm overhead (108 = 3×36). Byte đầu của mỗi TU-12 là V1/V2/V3/V4 tuỳ khung trong đa khung 500 µs (do H4 của VC-4 chỉ thị).",
    grid: { rows: 9, cols: 12, cellBits: 8 }, periodUs: 125, rateKbps: 6912, unit: "tug-2",
    multiframe: { frames: 4, note: "Đa khung TU-12 500 µs: byte con trỏ lần lượt V1, V2, V3, V4; vị trí khung xác định bằng 2 bit cuối của H4 trong POH VC-4." },
    regions: tu12Cols
  };

  F["tu-12"] = {
    id: "tu-12", name: "TU-12", family: "sdh", category: "Container bậc thấp", order: 40,
    standard: "ITU-T G.707 §8.3, §10.1.4",
    summary: "Đơn vị nhánh 12: 9×4 byte mỗi 125 µs, đa khung 4 (500 µs); mang VC-12 / 1 E1 2,048 Mbit/s.",
    detail: "Mỗi khung 125 µs TU-12 có 36 byte: 1 byte con trỏ (V1, V2, V3, V4 theo thứ tự khung) + 35 byte VC-12. Trên đa khung 500 µs: 4 byte con trỏ + 140 byte VC-12 (4 byte POH V5/J2/N2/K4 + 136 byte C-12). Con trỏ V1V2 (0–139) chỉ vị trí V5. Lưới vẽ một khung tổng quát với con trỏ = 0: byte POH đứng ngay sau byte V (V5 sau V2, J2 sau V3, N2 sau V4, K4 sau V1).",
    grid: { rows: 9, cols: 4, cellBits: 8 }, periodUs: 125, rateKbps: 2304, unit: "tu-12",
    multiframe: { frames: 4, note: "500 µs = 4 khung: khung 1 V1…K4, khung 2 V2…V5, khung 3 V3…J2, khung 4 V4…N2 (khi con trỏ = 0). Vị trí khung xác định bằng H4 của VC-4." },
    regions: tu12Parts("", 0, 1)
  };

  // =====================================================================
  // Ánh xạ PDH → SDH (G.707 §10.1): E1 → VC-12, E3 → VC-3, E4 → VC-4 (không đồng bộ)
  // Đối chiếu hình 10-3, 10-5, 10-8 của G.707 (01/2007; cùng hình trong bản 10/2000).
  // =====================================================================
  var MAP_CAT = "Ánh xạ PDH → SDH";

  // ---------- E1 → VC-12 (G.707 §10.1.4.1, Hình 10-8) ----------
  var K4_BITS = [
    { name: "Extended signal label", abbr: "ESL", bits: 1, desc: "Bit 1: nhãn tín hiệu mở rộng – khi V5 L1L2L3 = 101, nhãn thật gửi dần qua chuỗi 32 bit của bit này." },
    { name: "LO virtual concatenation", abbr: "VCAT", bits: 1, desc: "Bit 2: kênh overhead ghép chuỗi ảo bậc thấp (VC-12-Xv, LCAS)." },
    { name: "LO path APS", abbr: "APS", bits: 2, desc: "Bit 3–4: báo hiệu bảo vệ tự động mức luồng bậc thấp." },
    { name: "Enhanced RDI", abbr: "E-RDI", bits: 3, desc: "Bit 5–7: RDI nâng cao (tuỳ chọn) – cùng bit RDI của V5 phân biệt lỗi server / connectivity / payload." },
    { name: "LO path data link", abbr: "DL", bits: 1, desc: "Bit 8: dự trữ cho kênh dữ liệu luồng bậc thấp." }
  ];
  var VC12_C_O = [
    { name: "Justification control C1", abbr: "C1", bits: 1, desc: "Một trong 3 bit C1 (khung 2, 3, 4) điều khiển S1: C1C1C1 = 000 → S1 là bit dữ liệu; 111 → S1 là bit chèn. Biểu quyết đa số 2/3." },
    { name: "Justification control C2", abbr: "C2", bits: 1, desc: "Một trong 3 bit C2 điều khiển S2 theo cùng quy tắc." },
    { name: "Overhead bits", abbr: "OOOO", bits: 4, desc: "Bit O – dự trữ cho kênh truyền thông overhead tương lai (8 bit O mỗi đa khung)." },
    { name: "Fixed stuff", abbr: "RR", bits: 2, desc: "Bit chèn cố định R, không mang thông tin." }
  ];
  F["vc-12-e1"] = {
    id: "vc-12-e1", name: "VC-12 mang E1 (không đồng bộ)", family: "sdh", category: MAP_CAT, order: 10,
    standard: "ITU-T G.707 §10.1.4.1 (Hình 10-8), §9.3.2 (POH VC-12)",
    summary: "VC-12 đa khung 500 µs (4 × 35 byte) chở một E1 2,048 Mbit/s ánh xạ không đồng bộ, có bit chèn C/S.",
    detail: "Mỗi hàng là một khung con 125 µs của đa khung VC-12 (140 byte/500 µs). Cột 1 là byte POH V5, J2, N2, K4; 34 cột còn lại là C-12 (136 byte). Trong C-12: 1023 bit dữ liệu D, 6 bit điều khiển chèn (C1, C2 mỗi loại 3 bit), 2 bit cơ hội chèn S1, S2, 8 bit overhead O, còn lại là bit chèn cố định R. E1 danh định cần 1024 bit mỗi 500 µs, nên dung lượng 1023–1025 bit (tuỳ S1, S2 có mang dữ liệu không) cho phép bù lệch tần số cả hai chiều (chèn dương/âm) – E1 chạy ±50 ppm vẫn vừa. Đầu thu biểu quyết đa số 3 bit C để quyết định S là dữ liệu hay bit chèn; giá trị bit S khi là bit chèn không xác định. Nhãn V5 L1L2L3 = 010 (asynchronous). VC-12 sau đó nằm trong TU-12 và trôi theo con trỏ V1V2 (lưới này không vẽ byte V1–V4).",
    grid: { rows: 4, cols: 35, cellBits: 8 }, periodUs: 500, rateKbps: 2240, unit: "vc-12",
    multiframe: { frames: 4, note: "Mỗi hàng của lưới là một khung 125 µs trong đa khung 500 µs; vị trí khung xác định bằng H4 của VC-4 (TU-12) và con trỏ V1V2 (V5)." },
    regions: [
      R("poh", "POH", "VC-12 POH (V5, J2, N2, K4)", "poh", [0, 0, 4, 1],
        "Overhead luồng bậc thấp: mỗi khung 125 µs một byte, đi xuyên suốt từ điểm ánh xạ E1 tới điểm tách E1.", {
          children: [
            R("v5", "V5", "V5 – BIP-2, REI, RFI, signal label, RDI", "poh", [0, 0, 1, 1],
              "Byte đầu VC-12 (con trỏ TU-12 V1V2 chỉ vào đây): giám sát lỗi BIP-2, báo lỗi ngược REI/RDI, nhãn tín hiệu L1L2L3 = 010 cho E1 không đồng bộ.", { bitFields: V5_BITS }),
            R("j2", "J2", "J2 – LO path trace", "poh", [1, 0, 1, 1],
              "Vết luồng bậc thấp: chuỗi 16 byte (có CRC-7) định danh điểm truy nhập, kiểm tra nối đúng luồng (lỗi → LP-TIM)."),
            R("n2", "N2", "N2 – LO tandem connection", "poh", [2, 0, 1, 1],
              "Giám sát kết nối nối tiếp bậc thấp (TCM, G.707 Annex E) cho từng đoạn của nhà khai thác."),
            R("k4", "K4", "K4 – extended label, VCAT, APS, E-RDI", "poh", [3, 0, 1, 1],
              "Nhãn mở rộng, ghép chuỗi ảo bậc thấp, APS bậc thấp, RDI nâng cao.", { bitFields: K4_BITS })
          ] }),
      R("c12", "C-12", "C-12 (136 byte/500 µs) mang E1", "payload", [0, 1, 4, 34],
        "Container C-12 với ánh xạ không đồng bộ E1: khung 1: R + 32 D + R; khung 2–3: byte C1C2OOOORR + 32 D + R; khung 4: byte C1C2RRRRRS1 + S2DDDDDDD + 31 D + R (G.707 §10.1.4.1, Hình 10-8).", {
          children: [
            R("f1-r1", "R", "Fixed stuff byte", "stuff", [0, 1, 1, 1], "Byte chèn cố định RRRRRRRR (khung 1, sau V5)."),
            R("f1-d", "32 D", "32 byte dữ liệu E1", "payload", [0, 2, 1, 32], "256 bit dữ liệu E1."),
            R("f1-r2", "R", "Fixed stuff byte", "stuff", [0, 34, 1, 1], "Byte chèn cố định cuối khung 1."),
            R("f2-co", "C1C2OOOORR", "Byte điều khiển chèn (khung 2)", "opu-oh", [1, 1, 1, 1],
              "Byte sau J2: bit C1, C2 (bộ thứ nhất), 4 bit O, 2 bit R.", { bitFields: VC12_C_O }),
            R("f2-d", "32 D", "32 byte dữ liệu E1", "payload", [1, 2, 1, 32], "256 bit dữ liệu E1."),
            R("f2-r", "R", "Fixed stuff byte", "stuff", [1, 34, 1, 1], "Byte chèn cố định cuối khung 2."),
            R("f3-co", "C1C2OOOORR", "Byte điều khiển chèn (khung 3)", "opu-oh", [2, 1, 1, 1],
              "Byte sau N2: bit C1, C2 (bộ thứ hai), 4 bit O, 2 bit R.", { bitFields: VC12_C_O }),
            R("f3-d", "32 D", "32 byte dữ liệu E1", "payload", [2, 2, 1, 32], "256 bit dữ liệu E1."),
            R("f3-r", "R", "Fixed stuff byte", "stuff", [2, 34, 1, 1], "Byte chèn cố định cuối khung 3."),
            R("f4-cs", "C1C2RRRRRS1", "Byte điều khiển chèn + S1 (khung 4)", "opu-oh", [3, 1, 1, 1],
              "Byte sau K4: bộ C1, C2 thứ ba, 5 bit R và bit cơ hội chèn S1.", {
                bitFields: [
                  { name: "Justification control C1", abbr: "C1", bits: 1, desc: "Bit C1 thứ ba (cùng khung 2, 3 biểu quyết 2/3 cho S1)." },
                  { name: "Justification control C2", abbr: "C2", bits: 1, desc: "Bit C2 thứ ba (biểu quyết 2/3 cho S2)." },
                  { name: "Fixed stuff", abbr: "RRRRR", bits: 5, desc: "Bit chèn cố định." },
                  { name: "Justification opportunity S1", abbr: "S1", bits: 1, desc: "Cơ hội chèn S1: là bit dữ liệu khi C1C1C1 = 000, là bit chèn (bỏ qua) khi = 111." }
                ] }),
            R("f4-s2", "S2DDDDDDD", "Byte S2 + 7 bit dữ liệu", "opu-oh", [3, 2, 1, 1],
              "Bit cơ hội chèn S2 rồi 7 bit dữ liệu.", {
                bitFields: [
                  { name: "Justification opportunity S2", abbr: "S2", bits: 1, desc: "Cơ hội chèn S2: dữ liệu khi C2C2C2 = 000, bit chèn khi = 111." },
                  { name: "Data", abbr: "DDDDDDD", bits: 7, desc: "7 bit dữ liệu E1." }
                ] }),
            R("f4-d", "31 D", "31 byte dữ liệu E1", "payload", [3, 3, 1, 31], "248 bit dữ liệu E1."),
            R("f4-r", "R", "Fixed stuff byte", "stuff", [3, 34, 1, 1], "Byte chèn cố định cuối khung 4.")
          ] })
    ]
  };

  // ---------- E3 → VC-3 (G.707 §10.1.2.2, Hình 10-5) ----------
  // Một hàng 84 byte của khung con: [R,3D]×4, R R, 3D, [R,3D]×4, R C, 3D, [R,3D]×4, R R, 3D, [R,3D]×4, R C, 3D.
  // Hàng 3 của khung con: byte C cuối (cột 80) là R, và 3D cuối thay bằng A (RRRRRRRS1), B (S2DDDDDDD), D.
  function e3RowTypes() {
    var t = [], i, p;
    function rd(n) { for (var q = 0; q < n; q++) t.push("R", "D", "D", "D"); }
    rd(4);
    var dbl = [["R", "R"], ["R", "C"], ["R", "R"], ["R", "C"]];
    for (p = 0; p < 4; p++) {
      t.push(dbl[p][0], dbl[p][1], "D", "D", "D");
      if (p < 3) rd(4);
    }
    return t; // 84 phần tử
  }
  var E3T = e3RowTypes();
  var C_BYTE_BITS = [
    { name: "Fixed stuff", abbr: "RRRRRR", bits: 6, desc: "Bit chèn cố định." },
    { name: "Justification control C1", abbr: "C1", bits: 1, desc: "Một trong 5 bit C1 của khung con – điều khiển S1. C1×5 = 00000: S1 là dữ liệu; 11111: S1 là bit chèn. Biểu quyết đa số (chịu 2 bit lỗi)." },
    { name: "Justification control C2", abbr: "C2", bits: 1, desc: "Một trong 5 bit C2 – điều khiển S2 theo cùng quy tắc." }
  ];
  function e3Sub(k) {
    var r0 = 3 * k, pf = "t" + (k + 1) + "-", kids = [], c = 0, nD = 0, nR = 0, nC = 0;
    // Cột payload 0..79 giống nhau ở cả 3 hàng (byte C tách theo hàng để có bitFields).
    while (c < 80) {
      var ty = E3T[c], w = 1;
      if (ty === "D") { w = 3; nD++;
        kids.push(R(pf + "d" + nD, "3D", "3 byte dữ liệu E3", "payload", [r0, 1 + c, 3, 3], "3 × 8 bit dữ liệu E3 ở mỗi hàng của khung con T" + (k + 1) + "."));
      } else if (ty === "R") { while (c + w < 80 && E3T[c + w] === "R") w++; nR++;
        kids.push(R(pf + "r" + nR, "R", "Fixed stuff", "stuff", [r0, 1 + c, 3, w], "Byte chèn cố định RRRRRRRR (" + w + " cột × 3 hàng)."));
      } else {
        for (var h = 0; h < 3; h++) { nC++;
          kids.push(R(pf + "c" + nC, "C", "Byte RRRRRRC1C2", "opu-oh", [r0 + h, 1 + c, 1, 1], "Byte chứa 1 bit C1 và 1 bit C2 (cùng 6 bit R).", { bitFields: C_BYTE_BITS }));
        }
      }
      c += w;
    }
    // Cột 80–83: hàng 1–2 = C, 3D; hàng 3 = R, A, B, D.
    for (var h2 = 0; h2 < 2; h2++) { nC++;
      kids.push(R(pf + "c" + nC, "C", "Byte RRRRRRC1C2", "opu-oh", [r0 + h2, 81, 1, 1], "Byte chứa 1 bit C1 và 1 bit C2 (cùng 6 bit R).", { bitFields: C_BYTE_BITS }));
    }
    kids.push(R(pf + "dz", "3D", "3 byte dữ liệu E3", "payload", [r0, 82, 2, 3], "3 × 8 bit dữ liệu ở hàng 1–2 của khung con."));
    kids.push(R(pf + "rz", "R", "Fixed stuff", "stuff", [r0 + 2, 81, 1, 1], "Byte chèn cố định (hàng 3 không có byte C ở vị trí này – mỗi khung con chỉ có 5 byte C)."));
    kids.push(R(pf + "a", "A", "Byte A = RRRRRRRS1", "opu-oh", [r0 + 2, 82, 1, 1], "7 bit R và bit cơ hội chèn S1.", {
      bitFields: [
        { name: "Fixed stuff", abbr: "RRRRRRR", bits: 7, desc: "Bit chèn cố định." },
        { name: "Justification opportunity S1", abbr: "S1", bits: 1, desc: "Dữ liệu khi C1 đa số 0, bit chèn (không xác định, bỏ qua) khi đa số 1. Với E3 đồng bộ bit/byte: S1 luôn là chèn cố định (C1 = 1)." }
      ] }));
    kids.push(R(pf + "b", "B", "Byte B = S2DDDDDDD", "opu-oh", [r0 + 2, 83, 1, 1], "Bit cơ hội chèn S2 và 7 bit dữ liệu.", {
      bitFields: [
        { name: "Justification opportunity S2", abbr: "S2", bits: 1, desc: "Dữ liệu khi C2 đa số 0, bit chèn khi đa số 1. Với E3 đồng bộ bit/byte: S2 luôn là dữ liệu (C2 = 0)." },
        { name: "Data", abbr: "DDDDDDD", bits: 7, desc: "7 bit dữ liệu E3." }
      ] }));
    kids.push(R(pf + "d-last", "D", "1 byte dữ liệu", "payload", [r0 + 2, 84, 1, 1], "Byte dữ liệu cuối khung con (8 bit)."));
    return R("t" + (k + 1), "T" + (k + 1), "Khung con T" + (k + 1) + " (hàng " + (r0 + 1) + "–" + (r0 + 3) + ")", "payload", [r0, 1, 3, 84],
      "Khung con T" + (k + 1) + ": 3 hàng × 84 byte = 1431 bit dữ liệu D, 5 bit C1 + 5 bit C2, 2 bit cơ hội chèn S1, S2, 573 bit chèn cố định R.", { children: kids });
  }
  F["vc-3-e3"] = {
    id: "vc-3-e3", name: "VC-3 mang E3 (không đồng bộ)", family: "sdh", category: MAP_CAT, order: 20,
    standard: "ITU-T G.707 §10.1.2.2 (Hình 10-5), §9.3.1 (POH)",
    summary: "VC-3 9×85 byte chở một E3 34,368 Mbit/s: POH + C-3 chia 3 khung con T1–T3, mỗi khung con có 5 bộ C1/C2 và S1, S2.",
    detail: "Ngoài cột POH (J1…N1, C2 = 0x04), C-3 có 9×84 byte chia 3 khung con 3 hàng. Mỗi khung con: 1431 bit dữ liệu, hai bộ 5 bit điều khiển chèn C1, C2, hai bit cơ hội chèn S1, S2 và 573 bit chèn cố định R. E3 danh định cần 34 368 × 125 / 3 = 1432 bit mỗi khung con, vừa giữa 1431 và 1433 – S1, S2 cho phép bù lệch cả hai phía. C1×5 = 00000 → S1 là dữ liệu, 11111 → S1 là bit chèn (C2 với S2 tương tự); biểu quyết đa số chống được 1–2 bit lỗi. Mỗi hàng 84 byte theo mẫu lặp: byte R rồi 3 byte dữ liệu, xen các cặp byte R R / R C. VC-3 sau đó vào TU-3 và trôi theo con trỏ H1H2 (lưới này vẽ VC-3 riêng).",
    grid: { rows: 9, cols: 85, cellBits: 8 }, periodUs: 125, rateKbps: 48960, unit: "vc-3",
    regions: [
      R("poh", "POH", "VC-3 Path Overhead", "poh", [0, 0, 9, 1],
        "Overhead luồng VC-3: J1, B3, C2 (= 0x04 – ánh xạ không đồng bộ 34/45 Mbit/s), G1, F2, H4, F3, K3, N1.", { children: pohBytes("", 0, "VC-3") }),
      R("c3", "C-3", "C-3 mang E3 (3 khung con)", "payload", [0, 1, 9, 84],
        "Container C-3 756 byte/125 µs chia 3 khung con T1, T2, T3 giống hệt nhau.", { children: [e3Sub(0), e3Sub(1), e3Sub(2)] })
    ]
  };

  // ---------- E4 → VC-4 (G.707 §10.1.1.1, Hình 10-3) ----------
  var E4SEQ = "WXYYYXYYYXYYYXYYYXYZ";
  var E4BYTE = {
    W: ["W", "Byte W = DDDDDDDD", "payload", "8 bit dữ liệu E4.", [{ v: "DDDDDDDD", m: "8 bit dữ liệu" }]],
    X: ["X", "Byte X = CRRRRROO", "opu-oh", "1 bit điều khiển chèn C + 5 bit R + 2 bit O. 5 byte X trên một hàng cho 5 bit C điều khiển bit S của hàng đó: CCCCC = 00000 → S là dữ liệu; 11111 → S là bit chèn; biểu quyết đa số chống 1–2 bit lỗi. Bit O dự trữ cho kênh overhead.", [{ v: "CRRRRROO", m: "C điều khiển chèn, R chèn cố định, O overhead" }]],
    Y: ["Y", "Byte Y = RRRRRRRR", "stuff", "8 bit chèn cố định.", [{ v: "RRRRRRRR", m: "chèn cố định" }]],
    Z: ["Z", "Byte Z = DDDDDDSR", "opu-oh", "6 bit dữ liệu + bit cơ hội chèn S + 1 bit R. S là dữ liệu hay bit chèn tuỳ 5 bit C của cùng hàng.", [{ v: "DDDDDDSR", m: "D dữ liệu, S cơ hội chèn, R chèn cố định" }]]
  };
  var e4Blocks = [];
  for (var bk = 0; bk < 20; bk++) {
    var ch = E4SEQ.charAt(bk), info = E4BYTE[ch], c0 = 1 + 13 * bk;
    e4Blocks.push(R("blk" + (bk + 1), ch + "+12D", "Khối " + (bk + 1) + " (" + ch + " + 12 byte dữ liệu)", "payload", [0, c0, 9, 13],
      "Khối " + (bk + 1) + "/20 của mỗi hàng: byte đầu " + ch + " + 12 byte dữ liệu (96 D).", {
        children: [
          R("blk" + (bk + 1) + "-" + ch.toLowerCase(), info[0], info[1], info[2], [0, c0, 9, 1], info[3], { values: info[4] }),
          R("blk" + (bk + 1) + "-d", "96D", "12 byte dữ liệu", "payload", [0, c0 + 1, 9, 12], "96 bit dữ liệu E4 mỗi hàng.")
        ] }));
  }
  F["vc-4-e4"] = {
    id: "vc-4-e4", name: "VC-4 mang E4 (không đồng bộ)", family: "sdh", category: MAP_CAT, order: 30,
    standard: "ITU-T G.707 §10.1.1.1 (Hình 10-2, 10-3), §9.3.1 (POH)",
    summary: "VC-4 9×261 byte chở một E4 139,264 Mbit/s: mỗi hàng C-4 chia 20 khối 13 byte, byte đầu khối là W/X/Y/Z.",
    detail: "Cột 1 là POH (C2 = 0x12). Mỗi hàng của C-4 (260 byte) chia 20 khối 13 byte; byte đầu khối theo thứ tự W X Y Y Y X Y Y Y X Y Y Y X Y Y Y X Y Z, 12 byte sau đều là dữ liệu. Mỗi hàng có 1934 bit dữ liệu cố định + 1 bit cơ hội chèn S (trong byte Z), điều khiển bởi 5 bit C (trong 5 byte X). Cả 9 hàng giống nhau: 17 406 bit dữ liệu + 9 bit S mỗi 125 µs; E4 danh định cần 17 408 bit, tức trung bình khoảng 2 trong 9 bit S mang dữ liệu. CCCCC = 00000 → S là dữ liệu, 11111 → S là bit chèn; biểu quyết đa số chịu được 1–2 bit C lỗi. VC-4 sau đó thành AU-4 và trôi theo con trỏ H1H2.",
    grid: { rows: 9, cols: 261, cellBits: 8 }, periodUs: 125, rateKbps: 150336, unit: "vc-4",
    regions: [
      R("poh", "POH", "VC-4 Path Overhead", "poh", [0, 0, 9, 1],
        "Overhead luồng VC-4: J1, B3, C2 (= 0x12 – ánh xạ không đồng bộ 140 Mbit/s), G1, F2, H4, F3, K3, N1.", { children: pohBytes("", 0, "VC-4") }),
      R("c4", "C-4", "C-4 mang E4 (20 khối/hàng)", "payload", [0, 1, 9, 260],
        "Container C-4 2340 byte; mỗi hàng 20 khối × 13 byte theo mẫu W X Y Y Y X Y Y Y X Y Y Y X Y Y Y X Y Z.", {
          values: [
            { v: "W", m: "DDDDDDDD – 8 bit dữ liệu" },
            { v: "X", m: "CRRRRROO – điều khiển chèn C, 5 R, 2 O" },
            { v: "Y", m: "RRRRRRRR – chèn cố định" },
            { v: "Z", m: "DDDDDDSR – 6 D, cơ hội chèn S, 1 R" }
          ],
          children: e4Blocks })
    ]
  };

  // =====================================================================
  // TMUX – cây ghép kênh SDH (ETSI, qua AU-4)
  // =====================================================================
  function U(o) { o.family = "sdh"; M[o.id] = o; }
  var noOH = { bytes: 0, name: "", desc: "" };

  // E1, E3, E4 (và DS0, E2) định nghĩa trong data/transport-pdh.js (nạp trước file này).

  U({ id: "c-12", name: "C-12", kind: "container", level: 10, bytesPer125us: 34, standard: "ITU-T G.707 §10.1.4",
    summary: "Container 12: 34 byte/125 µs (2,176 Mbit/s) chứa một E1.",
    desc: "Khối tải 136 byte trên đa khung 500 µs. Ánh xạ E1 không đồng bộ: ngoài bit dữ liệu có byte fixed stuff R, bit điều khiển chèn C1/C2 và bit cơ hội chèn S1/S2 để bù lệch tần số.",
    accepts: [{ of: "e1", count: 1, overhead: noOH, mapping: "asynchronous", note: "E1 2048 kbit/s ≤ dung lượng 2176 kbit/s; phần dư là stuff/bit điều khiển." }] });
  U({ id: "vc-12", name: "VC-12", kind: "vc", level: 11, bytesPer125us: 35, frame: "vc-12-e1", standard: "ITU-T G.707 §9.3.2",
    summary: "Container ảo 12 = C-12 + POH bậc thấp (V5, J2, N2, K4 trên đa khung 500 µs).",
    desc: "Đơn vị luồng bậc thấp được đấu chéo trong DXC 4/1. POH 1 byte/125 µs = 4 byte/đa khung: V5 (BIP-2, REI, RFI, nhãn, RDI), J2 (trace), N2 (TCM), K4 (nhãn mở rộng, APS).",
    accepts: [{ of: "c-12", count: 1, overhead: { bytes: 1, name: "VC-12 POH", desc: "V5, J2, N2, K4 – 1 byte mỗi khung 125 µs (4 byte/500 µs)." }, note: "34 + 1 = 35 byte." }] });
  U({ id: "tu-12", name: "TU-12", kind: "tu", level: 12, bytesPer125us: 36, frame: "tu-12", standard: "ITU-T G.707 §8.3",
    summary: "Đơn vị nhánh 12 = VC-12 + con trỏ TU-12 (V1–V4).",
    desc: "Con trỏ V1V2 cho phép VC-12 trôi trong TU-12 để bù lệch pha/tần số giữa luồng bậc thấp và VC-4; V3 là cơ hội chèn âm, V4 dự trữ.",
    accepts: [{ of: "vc-12", count: 1, overhead: { bytes: 1, name: "TU-12 pointer", desc: "V1, V2, V3, V4 – 1 byte mỗi khung (4 byte/500 µs)." }, note: "35 + 1 = 36 byte (9×4)." }] });
  U({ id: "tug-2", name: "TUG-2", kind: "tug", level: 20, bytesPer125us: 108, frame: "tug-2", standard: "ITU-T G.707 §7.2.6",
    summary: "Nhóm đơn vị nhánh 2: 3×TU-12 ghép xen byte (9×12).",
    desc: "Gom 3 TU-12 không thêm overhead. 7 TUG-2 tạo thành một TUG-3.",
    accepts: [{ of: "tu-12", count: 3, overhead: noOH, note: "3 × 36 = 108 byte; ghép xen byte bước 3 cột." }] });

  U({ id: "c-3", name: "C-3", kind: "container", level: 30, bytesPer125us: 756, standard: "ITU-T G.707 §10.1.2.2",
    summary: "Container 3: 9×84 = 756 byte/125 µs (48,384 Mbit/s) chứa E3.",
    desc: "Ánh xạ không đồng bộ E3 34,368 Mbit/s (hoặc DS3 45 Mbit/s): chia 3 khung con, mỗi khung con có bit điều khiển chèn C và cơ hội chèn S.",
    accepts: [{ of: "e3", count: 1, overhead: noOH, mapping: "asynchronous", note: "34368 kbit/s ≤ 48384 kbit/s." }] });
  U({ id: "vc-3", name: "VC-3", kind: "vc", level: 31, bytesPer125us: 765, frame: "vc-3-e3", standard: "ITU-T G.707 §9.3.1",
    summary: "Container ảo 3 = C-3 + POH 9 byte (9×85).",
    desc: "Dùng POH bậc cao (J1, B3, C2, G1, F2, H4, F3, K3, N1). Trong cấu trúc ETSI, VC-3 vào VC-4 qua TU-3/TUG-3.",
    accepts: [{ of: "c-3", count: 1, overhead: { bytes: 9, name: "VC-3 POH", desc: "J1, B3, C2, G1, F2, H4, F3, K3, N1 (1 cột)." }, note: "756 + 9 = 765 byte." }] });
  U({ id: "tu-3", name: "TU-3", kind: "tu", level: 32, bytesPer125us: 774, frame: "tu-3", standard: "ITU-T G.707 §8.2",
    summary: "Đơn vị nhánh 3 = VC-3 + con trỏ H1/H2/H3 + 6 byte fixed stuff (9×86).",
    desc: "Con trỏ TU-3 cho phép VC-3 trôi trong TUG-3. Cột 1: H1, H2, H3 + 6 byte fixed stuff.",
    accepts: [{ of: "vc-3", count: 1, overhead: { bytes: 9, name: "TU-3 pointer + fixed stuff", desc: "H1, H2, H3 (3 byte) + fixed stuff (6 byte) ở cột 1." }, note: "765 + 3 + 6 = 774 byte." }] });
  U({ id: "tug-3", name: "TUG-3", kind: "tug", level: 40, bytesPer125us: 774, frame: "tug-3", standard: "ITU-T G.707 §7.2.3 (TU-3 vào TUG-3: §7.2.2)",
    summary: "Nhóm đơn vị nhánh 3 (9×86): chứa 7×TUG-2 hoặc 1×TU-3.",
    desc: "3 TUG-3 ghép vào một VC-4. Mỗi TUG-3 độc lập chọn mang 21 E1 (7×TUG-2) hoặc 1 E3 (TU-3).",
    accepts: [
      { of: "tug-2", count: 7, overhead: { bytes: 18, name: "Fixed stuff", desc: "Fixed stuff 2 cột đầu (gồm vị trí H1/H2/H3 của TU-3): 2 cột × 9 hàng." }, note: "7 × 108 + 18 = 774 byte; TUG-2 ghép xen byte bước 7." },
      { of: "tu-3", count: 1, overhead: noOH, note: "TU-3 có đúng kích thước TUG-3 (774 byte)." }
    ] });

  U({ id: "c-4", name: "C-4", kind: "container", level: 50, bytesPer125us: 2340, standard: "ITU-T G.707 §10.1.1.1",
    summary: "Container 4: 9×260 = 2340 byte/125 µs (149,76 Mbit/s) chứa E4.",
    desc: "Ánh xạ không đồng bộ E4 139,264 Mbit/s: mỗi hàng 20 khối 13 byte, có bit điều khiển chèn C và một cơ hội chèn S mỗi hàng. Cũng dùng cho ATM, GFP (Ethernet).",
    accepts: [{ of: "e4", count: 1, overhead: noOH, mapping: "asynchronous", note: "139264 kbit/s ≤ 149760 kbit/s." }] });
  U({ id: "vc-4", name: "VC-4", kind: "vc", level: 51, bytesPer125us: 2349, frame: "vc-4", standard: "ITU-T G.707 §9.3.1",
    summary: "Container ảo 4 (9×261): C-4 + POH, hoặc 3×TUG-3 + POH + fixed stuff.",
    desc: "Luồng bậc cao chuẩn của SDH ETSI. Hoặc mang C-4 (E4/gói), hoặc cấu trúc TUG (C2 = 0x02) với 3 TUG-3 → tối đa 63 E1 hoặc 3 E3.",
    accepts: [
      { of: "c-4", count: 1, overhead: { bytes: 9, name: "VC-4 POH", desc: "J1, B3, C2, G1, F2, H4, F3, K3, N1." }, note: "2340 + 9 = 2349 byte." },
      { of: "tug-3", count: 3, overhead: { bytes: 27, name: "VC-4 POH + fixed stuff", desc: "POH 9 byte (cột 1) + fixed stuff 18 byte (cột 2–3)." }, note: "3 × 774 + 9 + 18 = 2349 byte; TUG-3 ghép xen byte bước 3." }
    ] });
  U({ id: "au-4", name: "AU-4", kind: "au", level: 52, bytesPer125us: 2358, standard: "ITU-T G.707 §8.1",
    summary: "Đơn vị quản lý 4 = VC-4 + con trỏ AU-4 9 byte.",
    desc: "Con trỏ AU-4 (H1 Y Y H2 1* 1* H3 H3 H3) nằm ở hàng 4, cột 1–9 của STM-1, chỉ vị trí J1 của VC-4 – cho phép VC-4 trôi để bù lệch đồng hồ giữa các nút.",
    accepts: [{ of: "vc-4", count: 1, overhead: { bytes: 9, name: "AU-4 pointer", desc: "H1, Y, Y, H2, 1*, 1*, H3, H3, H3." }, note: "2349 + 9 = 2358 byte." }] });
  U({ id: "aug-1", name: "AUG-1", kind: "aug", level: 60, bytesPer125us: 2358, standard: "ITU-T G.707 §7.1.2",
    summary: "Nhóm đơn vị quản lý 1 = 1×AU-4 (ETSI).",
    desc: "Trong cấu trúc ETSI, AUG-1 chứa đúng một AU-4 (không thêm byte). Thêm SOH 72 byte thành STM-1.",
    accepts: [{ of: "au-4", count: 1, overhead: noOH, note: "2358 byte." }] });

  var prevAug = "aug-1";
  [4, 16, 64, 256].forEach(function (n, i) {
    var id = "aug-" + n;
    U({ id: id, name: "AUG-" + n, kind: "aug", level: 61 + i, bytesPer125us: 2358 * n, standard: "ITU-T G.707 §7.1.1.2",
      summary: "Nhóm đơn vị quản lý " + n + " = 4×" + prevAug.toUpperCase() + " ghép xen khối " + n / 4 + " byte (" + n + " AU-4).",
      desc: "Ghép xen theo khối " + n / 4 + " byte (N = số AU-4 trong " + prevAug.toUpperCase() + (n === 4 ? ", nên trùng ghép xen từng byte" : "") + ") của 4 " + prevAug.toUpperCase() + " (hoặc mang một AU-4-" + n + "c chiếm trọn AUG-" + n + ", bắt đầu ở AU-4 #(k·" + n + "+1), §6.2.3). Thêm SOH " + 72 * n + " byte thành STM-" + n + ".",
      accepts: [
        { of: prevAug, count: 4, overhead: noOH, note: "4 × " + 2358 * n / 4 + " = " + 2358 * n + " byte." },
        { of: "au-4-" + n + "c", count: 1, overhead: noOH, note: "Phương án ghép chuỗi liền kề: 1 AU-4-" + n + "c = " + 2358 * n + " byte." }
      ] });
    prevAug = id;
  });

  // ---------- Ghép chuỗi liền kề VC-4-Xc (G.707 §11.1, §9.3.1, §8.1.2, §8.1.7, §6.2.3, §10.2.1/§10.3/§10.6) ----------
  [4, 16, 64, 256].forEach(function (X, i) {
    var cb = 9360 * (X / 4), vb = cb + 9 + 9 * (X - 1), ab = vb + 9 * X, sfx = X + "c";
    var cMbit = (cb * 64 / 1000).toLocaleString("vi-VN");
    var cl = { 4: ["pos-4c", "POS/ATM/GFP cổng 622 Mbit/s (tải 599,04 Mbit/s) trên STM-4c", 599040, "Packet over SONET/SDH (PPP/HDLC) hoặc ATM/GFP lấp đầy C-4-4c; ví dụ cổng POS OC-12c/STM-4c của router."],
      16: ["pos-16c", "POS/GFP cổng 2,5 Gbit/s (tải 2396,16 Mbit/s) trên STM-16c", 2396160, "Packet over SONET/SDH hoặc GFP lấp đầy C-4-16c; ví dụ cổng POS OC-48c/STM-16c của router lõi."],
      64: ["10gbase-w", "10GBASE-W (Ethernet 10G WAN PHY)", 9584640, "Ethernet 10G WAN PHY (IEEE 802.3 Clause 50) dùng khung SDH/SONET VC-4-64c; tốc độ payload 9,5846 Gbit/s khớp đúng dung lượng C-4-64c; WIS đặt trực tiếp luồng 64B/66B vào tải."],
      256: ["pos-256c", "POS/GFP cổng 40 Gbit/s (tải 38338,56 Mbit/s) trên STM-256c", 38338560, "Packet over SONET/SDH hoặc GFP lấp đầy C-4-256c; ví dụ cổng POS OC-768c/STM-256c."] }[X];
    U({ id: cl[0], name: cl[1], kind: "client", level: 5 + i, rateKbps: cl[2], standard: X === 64 ? "IEEE 802.3 Clause 50; ITU-T G.707 §11.1, Annex F" : "ITU-T G.707 §11.1 (ghép chuỗi liền kề)",
      summary: "Tín hiệu gói lấp đầy C-4-" + sfx + ": " + cl[2].toLocaleString("vi-VN") + " kbit/s.",
      desc: cl[3] });
    U({ id: "c-4-" + sfx, name: "C-4-" + sfx, kind: "container", level: 53 + i / 10, bytesPer125us: cb, standard: "ITU-T G.707 §11.1 (C-4-Xc); tải: §10.2.1 (ATM), §10.3 (HDLC/POS), §10.6 (GFP)",
      summary: "Container C-4-" + sfx + ": 9×" + 260 * X + " = " + cb + " byte/125 µs (" + cMbit + " Mbit/s).",
      desc: "Container liền khối bằng " + X + " lần C-4, mang một tín hiệu gói duy nhất (POS, ATM, GFP" + (X === 64 ? ", 10GBASE-W" : "") + ") tốc độ cao hơn một VC-4 mà không chia nhỏ." + (X === 64 ? " Cũng dùng cho POS OC-192c/STM-64c." : ""),
      accepts: [{ of: cl[0], count: 1, overhead: noOH, mapping: X === 64 ? "10GBASE-W WIS (64B/66B)" : "POS/ATM/GFP", note: cl[2] + " kbit/s ≤ " + cb * 64 + " kbit/s." }] });
    U({ id: "vc-4-" + sfx, name: "VC-4-" + sfx, kind: "vc", level: 53.05 + i / 10, bytesPer125us: vb, frame: "vc-4-" + sfx, standard: "ITU-T G.707 §11.1 (ghép chuỗi liền kề VC-4-Xc), §9.3.1 (POH)",
      summary: "Container ảo VC-4-" + sfx + " = C-4-" + sfx + " + POH 9 byte + fixed stuff " + 9 * (X - 1) + " byte.",
      desc: "Chỉ một POH ở cột đầu (J1…N1; B3 tính trên toàn VC-4-" + sfx + ") và " + (X - 1) + " cột fixed stuff, sau đó là C-4-" + sfx + ". Tương đương " + X + " VC-4 nhưng là một luồng duy nhất.",
      accepts: [{ of: "c-4-" + sfx, count: 1, overhead: { bytes: 9 + 9 * (X - 1), name: "POH + fixed stuff", desc: "POH 9 byte (cột 1) + fixed stuff " + 9 * (X - 1) + " byte (" + (X - 1) + " cột)." }, note: cb + " + " + (9 + 9 * (X - 1)) + " = " + vb + " byte." }] });
    U({ id: "au-4-" + sfx, name: "AU-4-" + sfx, kind: "au", level: 53.08 + i / 10, bytesPer125us: ab, standard: "ITU-T G.707 §8.1.7 (AU-4-Xc), §8.1.2 (chỉ thị ghép chuỗi con trỏ, Hình 8-3), §6.2.3, §7.3.1.3–6",
      summary: "Đơn vị quản lý AU-4-" + sfx + " = VC-4-" + sfx + " + " + X + " con trỏ AU-4 (" + 9 * X + " byte).",
      desc: "Con trỏ AU-4 #1 hoạt động bình thường; " + (X - 1) + " con trỏ sau mang chỉ thị ghép chuỗi (concatenation indication): H1H2 = 1001SS11 11111111. AU-4-" + sfx + " chiếm trọn một AUG-" + X + "; trong STM-N bắt đầu ở AU-4 #(k·" + X + "+1) (căn theo biên AUG-" + X + ", §6.2.3, §7.3.1.3–6). Cả khối VC-4-" + sfx + " trôi theo con trỏ #1 (một lần chỉnh con trỏ chèn/bỏ " + 3 * X + " byte, §11.1) và " + (X - 1) + " con trỏ kia chỉ báo 'đi theo'. POH duy nhất ở cột đầu VC-4-" + sfx + ", B3 tính trên toàn VC-4-" + sfx + ".",
      accepts: [{ of: "vc-4-" + sfx, count: 1, overhead: { bytes: 9 * X, name: "AU-4 pointers ×" + X, desc: "H1 Y Y H2 1* 1* H3 H3 H3 cho mỗi trong " + X + " AU-4; con trỏ #2…" + X + " mang chỉ thị ghép chuỗi 1001SS11 11111111." }, note: vb + " + " + 9 * X + " = " + ab + " byte." }] });
  });

  U({ id: "stm-1", name: "STM-1", kind: "stm", level: 70, bytesPer125us: 2430, frame: "stm-1", standard: "ITU-T G.707 §6.2, §9.2",
    summary: "Khung STM-1 155,52 Mbit/s = AUG-1 + SOH 72 byte.",
    desc: "SOH gồm RSOH 27 byte và MSOH 45 byte (con trỏ AU-4 đã tính trong AU-4). Chứa 1 VC-4 = 63 E1, 3 E3 hoặc 1 E4.",
    accepts: [{ of: "aug-1", count: 1, overhead: { bytes: 72, name: "SOH", desc: "RSOH 27 byte (hàng 1–3) + MSOH 45 byte (hàng 5–9), cột 1–9." }, note: "2358 + 72 = 2430 byte (9×270)." }] });
  [4, 16, 64, 256].forEach(function (n, i) {
    U({ id: "stm-" + n, name: "STM-" + n, kind: "stm", level: 71 + i, bytesPer125us: 2430 * n, frame: "stm-" + n, standard: "ITU-T G.707 §6.2, §9.2",
      summary: "Khung STM-" + n + " " + (155.52 * n).toLocaleString("vi-VN") + " Mbit/s = AUG-" + n + " + SOH " + 72 * n + " byte.",
      desc: "Chứa " + n + " VC-4 (= " + 63 * n + " E1). SOH ghép xen từ " + n + " STM-1 nhưng nhiều byte chỉ dùng một bản.",
      accepts: [{ of: "aug-" + n, count: 1, overhead: { bytes: 72 * n, name: "SOH", desc: "RSOH " + 27 * n + " byte + MSOH " + 45 * n + " byte." }, note: 2358 * n + " + " + 72 * n + " = " + 2430 * n + " byte (9×" + 270 * n + ")." }] });
  });

  // =====================================================================
  // TLABS
  // =====================================================================
  L.push({
    id: "sdh", name: "Ghép kênh SDH", family: "sdh",
    roots: ["stm-1", "stm-4", "stm-16", "stm-64", "stm-256"],
    palette: ["e1", "e2", "e3", "e4", "c-12", "vc-12", "tu-12", "tug-2", "c-3", "vc-3", "tu-3", "tug-3", "c-4", "vc-4", "au-4", "aug-1", "aug-4", "pos-4c", "pos-16c", "10gbase-w", "pos-256c", "vc-4-4c", "vc-4-16c", "vc-4-64c"],
    intro: "Chọn khung STM-N đích rồi lắp dần từ dưới lên: E1 → C-12 → VC-12 → TU-12 → TUG-2 → TUG-3 → VC-4 → AU-4 → AUG → STM-N. Mỗi bước hiện số byte overhead được thêm, để thấy vì sao một STM-1 chứa đúng 63 E1 (3 TUG-3 × 7 TUG-2 × 3 TU-12). Mỗi TUG-3 có thể chọn mang 7 TUG-2 hoặc 1 TU-3 (E3)."
  });
})();
