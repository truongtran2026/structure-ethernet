// Mảng Truyền dẫn – GD4: Ethernet qua SDH – ghép chuỗi ảo VCAT + LCAS.
// Client Ethernet (qua GFP-F), nhóm ghép chuỗi ảo VC-n-Xv (VCG), kênh overhead H4 (bậc cao) và K4 bit 2 (bậc thấp).
// Schema: .claude/skills/transport-frame-spec/references/transport-schema.md ("Mở rộng VCAT (GD4)")
// Nguồn: ITU-T G.707/Y.1322 (01/2007) §11.2 (VCAT VC-3/VC-4), §11.4 (VCAT VC-12/VC-11/VC-2);
//        ITU-T G.7042/Y.1305 (LCAS); ITU-T G.7041/Y.1303 (GFP-F – khung nằm ở mảng IP).
// Không phụ thuộc thứ tự nạp: chỉ đăng ký TFRAMES/TMUX; palette lab "sdh" được thêm trực tiếp trong transport-sdh.js.
window.TFRAMES = window.TFRAMES || {};
window.TMUX = window.TMUX || {};
window.TLABS = window.TLABS || [];

(function () {
  var F = window.TFRAMES, M = window.TMUX;
  var CAT = "VCAT/LCAS";

  function R(id, abbr, name, kind, rect, desc, extra) {
    var o = { id: id, name: name, abbr: abbr, kind: kind,
      rect: { r: rect[0], c: rect[1], h: rect[2], w: rect[3], step: rect[4] || 1 }, desc: desc };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }

  // ---------- Mã điều khiển LCAS (G.7042 Bảng 1) – dùng chung H4/K4 ----------
  var CTRL_VALUES = [
    { v: "0000", m: "FIXED – không dùng LCAS (băng thông cố định); chế độ VCAT thuần" },
    { v: "0001", m: "ADD – thành viên sắp được thêm vào nhóm" },
    { v: "0010", m: "NORM – truyền bình thường" },
    { v: "0011", m: "EOS – End Of Sequence: thành viên có SQ lớn nhất, truyền bình thường" },
    { v: "0101", m: "IDLE – không thuộc nhóm hoặc sắp bị gỡ khỏi nhóm" },
    { v: "1111", m: "DNU – Do Not Use: không dùng tải, vì đầu thu báo FAIL cho thành viên này" }
  ];
  var CTRL_DESC = "Từ điều khiển LCAS 4 bit (G.7042): 0000 FIXED (không LCAS), 0001 ADD, 0010 NORM, 0011 EOS, 0101 IDLE, 1111 DNU; các mã khác chưa dùng. Đầu phát báo trạng thái của chính thành viên này; đầu thu dựa vào đó để biết thành viên có đang chở tải không.";
  var MFI1 = { name: "MFI-1 (multiframe indicator 1)", abbr: "MFI-1", bits: 4,
    desc: "Bit 5–8: chỉ thị đa khung thứ nhất, đếm 0–15 theo từng khung 125 µs (tăng 1 mỗi khung, đa khung 16 khung = 2 ms). Giá trị MFI-1 cho biết bit 1–4 của byte H4 này mang trường nào." };
  function h4(mfi, abbr, name, kind, desc, f14, values) {
    var ex = { bitFields: f14.concat([MFI1]) };
    if (values) ex.values = values;
    return R("h4-" + mfi, abbr, "MFI-1 = " + mfi + ": " + name, kind, [mfi, 0, 1, 1], desc, ex);
  }
  function b4(name, abbr, desc) { return [{ name: name, abbr: abbr, bits: 4, desc: desc }]; }

  // =====================================================================
  // vcat-h4 – byte H4 của VC-3/VC-4 thành viên trong đa khung 16 (G.707 §11.2.1; LCAS G.7042)
  // =====================================================================
  F["vcat-h4"] = {
    id: "vcat-h4", name: "H4 – overhead VCAT/LCAS bậc cao (VC-3/VC-4-Xv)", family: "sdh", category: CAT, order: 10,
    standard: "G.707 §11.2 (Bảng 11-1), §11.2.1 (Bảng 11-2, 11-3), §11.2.1.1 (gói điều khiển, CRC-8), §9.3.1.6 (H4); G.7042 §6.2",
    summary: "Byte H4 của mỗi VC-4/VC-3 thành viên qua 16 khung liên tiếp: bit 5–8 đếm MFI-1, bit 1–4 lần lượt chở MFI-2, CTRL, GID, CRC-8, MST, RS-Ack, SQ.",
    detail: "Trong VC-n-Xv mỗi thành viên có POH riêng và đi độc lập qua mạng, nên mỗi thành viên phải tự mang số khung (để đầu thu bù trễ vi sai) và số thứ tự (để ghép lại đúng thứ tự). Kênh này nằm ở byte H4: mỗi hàng của lưới là H4 của một khung 125 µs, 16 hàng = đa khung thứ nhất 2 ms. Bit 5–8 là MFI-1 (0–15); bit 1–4 đổi nghĩa theo MFI-1: MFI-2 (8 bit, 0–255) ở MFI-1 = 0–1, SQ (8 bit) ở MFI-1 = 14–15, các trường LCAS (CTRL, GID, CRC-8, MST, RS-Ack) ở các vị trí còn lại. MFI-1 × MFI-2 = 16 × 256 = 4096 khung = 512 ms là đa khung lớn. Không có LCAS thì các trường LCAS truyền 0 (CTRL = 0000 FIXED). Vì H4 dùng làm MFI cho VCAT, VC-4 thành viên không mang cấu trúc TUG (H4 không còn đếm đa khung TU-12).",
    grid: { rows: 16, cols: 1, cellBits: 8 }, periodUs: 16 * 125, rateKbps: 64,
    regions: [
      h4(0, "MFI-2 MSB", "MFI-2 nửa cao (bit 1–4 của trường MFI-2)", "fas",
        "Nửa cao của MFI-2 (chỉ thị đa khung thứ hai, 8 bit, 0–255). MFI-2 tăng 1 mỗi đa khung 16 khung; ghép MFI-2 với MFI-1 được bộ đếm 12 bit (4096 khung, 512 ms) để đầu thu so thời điểm đến của từng thành viên và bù trễ vi sai.",
        b4("MFI-2 nửa cao (bit 1–4 của MFI-2)", "MFI-2 MSB", "4 bit cao của MFI-2.")),
      h4(1, "MFI-2 LSB", "MFI-2 nửa thấp (bit 5–8 của trường MFI-2)", "fas",
        "Nửa thấp của MFI-2. Mọi thành viên của cùng VCG được đầu phát gửi với cùng giá trị MFI (cùng thời điểm); chênh lệch MFI ở đầu thu chính là trễ vi sai.",
        b4("MFI-2 nửa thấp (bit 5–8 của MFI-2)", "MFI-2 LSB", "4 bit thấp của MFI-2.")),
      h4(2, "CTRL", "LCAS control word", "poh",
        "Từ điều khiển LCAS của thành viên này (ADD/NORM/EOS/IDLE/DNU, hoặc FIXED khi không dùng LCAS).",
        b4("Control word", "CTRL", CTRL_DESC), CTRL_VALUES),
      h4(3, "GID", "Group Identification + dự trữ", "poh",
        "Bit 1–3 dự trữ (000), bit 4 = GID: mọi thành viên của cùng VCG mang cùng chuỗi bit giả ngẫu nhiên 2^15−1 qua các đa khung, giúp đầu thu phát hiện thành viên bị đấu nhầm sang nhóm khác.",
        [{ name: "Reserved", abbr: "000", bits: 3, desc: "Dự trữ, đặt 000." },
         { name: "Group Identification bit", abbr: "GID", bits: 1, desc: "Một bit của chuỗi PRBS 2^15−1, tiến 1 bit mỗi đa khung; giống nhau ở mọi thành viên cùng VCG." }]),
      h4(4, "Res", "Reserved", "reserved", "Dự trữ (bit 1–4 = 0000).", b4("Reserved", "0000", "Dự trữ, đặt 0000.")),
      h4(5, "Res", "Reserved", "reserved", "Dự trữ (bit 1–4 = 0000).", b4("Reserved", "0000", "Dự trữ, đặt 0000.")),
      h4(6, "CRC-8 (1)", "CRC-8 nửa đầu (bit 1–4 của CRC-8)", "poh",
        "Nửa đầu CRC-8 bảo vệ gói điều khiển LCAS (đa thức x^8 + x^2 + x + 1). Đầu thu bỏ qua gói có CRC sai, nên một lỗi bit không làm thay đổi cấu hình nhóm.",
        b4("CRC-8 nửa đầu (bit 1–4 của CRC-8)", "C1–C4", "4 bit đầu CRC-8.")),
      h4(7, "CRC-8 (2)", "CRC-8 nửa sau (bit 5–8 của CRC-8)", "poh",
        "Nửa sau CRC-8. Gói điều khiển LCAS bậc cao bắt đầu ở MFI-1 = 8 của đa khung này và kết thúc ở MFI-1 = 7 của đa khung kế (CRC-8 là phần cuối gói).",
        b4("CRC-8 nửa sau (bit 5–8 của CRC-8)", "C5–C8", "4 bit sau CRC-8.")),
      h4(8, "MST (1)", "Member Status nửa đầu (bit 1–4 của MST)", "poh",
        "Trạng thái thành viên do ĐẦU THU gửi ngược về đầu phát (qua mọi thành viên của chiều ngược lại): mỗi bit một thành viên, 0 = OK, 1 = FAIL. Mỗi đa khung mang 8 bit MST; 256 thành viên trải trên 32 đa khung (theo MFI-2), nên một thành viên được làm mới trạng thái mỗi 64 ms (G.707 Bảng 11-3 Note 1).",
        b4("MST nửa đầu (bit 1–4 của trường MST)", "MST", "Trạng thái 4 thành viên đầu trong nhóm 8 của đa khung này: 0 = OK, 1 = FAIL.")),
      h4(9, "MST (2)", "Member Status nửa sau (bit 5–8 của MST)", "poh",
        "4 bit MST còn lại. Đầu phát nhận FAIL sẽ chuyển thành viên đó sang DNU và tạm bỏ khỏi tải.",
        b4("MST nửa sau (bit 5–8 của trường MST)", "MST", "Trạng thái 4 thành viên tiếp theo: 0 = OK, 1 = FAIL.")),
      h4(10, "RS-Ack", "Re-Sequence Acknowledge", "poh",
        "Bit 4 = RS-Ack: đầu thu đảo bit này để xác nhận đã nhận đủ thay đổi số thứ tự (SQ) sau khi thêm/bớt thành viên; đầu phát chờ xác nhận này trước khi thực hiện thay đổi tiếp. Bit 1–3 dự trữ.",
        [{ name: "Reserved", abbr: "000", bits: 3, desc: "Dự trữ, đặt 0." },
         { name: "Re-Sequence Acknowledge", abbr: "RS-Ack", bits: 1, desc: "Đầu thu đảo giá trị (toggle) để báo đã thấy và chấp nhận chuỗi SQ mới." }]),
      h4(11, "Res", "Reserved", "reserved", "Dự trữ (bit 1–4 = 0000).", b4("Reserved", "0000", "Dự trữ, đặt 0000.")),
      h4(12, "Res", "Reserved", "reserved", "Dự trữ (bit 1–4 = 0000).", b4("Reserved", "0000", "Dự trữ, đặt 0000.")),
      h4(13, "Res", "Reserved", "reserved", "Dự trữ (bit 1–4 = 0000).", b4("Reserved", "0000", "Dự trữ, đặt 0000.")),
      h4(14, "SQ MSB", "Sequence indicator nửa cao (bit 1–4 của SQ)", "poh",
        "Nửa cao của SQ (8 bit, 0–255): số thứ tự của thành viên trong VCG. VC-4-Xv/VC-3-Xv có tối đa X = 256 thành viên, SQ = 0 … X−1; đầu thu ghép tải lại theo đúng thứ tự SQ.",
        b4("SQ nửa cao (bit 1–4 của SQ)", "SQ MSB", "4 bit cao số thứ tự thành viên.")),
      h4(15, "SQ LSB", "Sequence indicator nửa thấp (bit 5–8 của SQ)", "poh",
        "Nửa thấp của SQ. Không LCAS: SQ cố định khi cấu hình. Có LCAS: SQ đánh lại khi thêm/bớt thành viên, thành viên SQ lớn nhất mang CTRL = EOS.",
        b4("SQ nửa thấp (bit 5–8 của SQ)", "SQ LSB", "4 bit thấp số thứ tự thành viên."))
    ]
  };

  // =====================================================================
  // vcat-k4 – chuỗi 32 bit của K4 bit 2 (VC-12/VC-11/VC-2-Xv) (G.707 §11.4; LCAS G.7042)
  // =====================================================================
  function k4(id, abbr, name, kind, r, h, desc, bitFields, values) {
    var ex = { bitFields: bitFields };
    if (values) ex.values = values;
    return R(id, abbr, name, kind, [r, 0, h, 1], desc, ex);
  }
  F["vcat-k4"] = {
    id: "vcat-k4", name: "K4 bit 2 – overhead VCAT/LCAS bậc thấp (VC-12-Xv)", family: "sdh", category: CAT, order: 20,
    standard: "G.707 §11.4 (Hình 11-9), §11.4.1–11.4.1.1 (Hình 11-10, Bảng 11-5), §9.3.2.5 (K4 b2), §9.3.2.4 (MFAS K4 b1); G.7042 §6.2",
    summary: "Bit 2 của K4 qua 32 đa khung VC-12 (32 × 500 µs = 16 ms) tạo chuỗi 32 bit: MFI 5 bit, SQ 6 bit, CTRL 4, GID 1, dự trữ 4, RS-Ack 1, MST 8, CRC-3.",
    detail: "VC-12 chỉ có một byte K4 mỗi đa khung 500 µs, nên overhead VCAT/LCAS bậc thấp được gửi từng bit: bit 2 của K4 qua 32 đa khung liên tiếp ghép thành chuỗi 32 bit (16 ms), đồng bộ với chuỗi 32 bit của K4 bit 1 (nhãn mở rộng, có MFAS riêng). Mỗi hàng của lưới là một bit. MFI 5 bit (0–31) đếm chuỗi 16 ms → đa khung lớn 32 × 16 ms = 512 ms dùng để bù trễ vi sai. SQ 6 bit nên VC-12-Xv có tối đa X = 64 thành viên. Cả chuỗi 32 bit là một gói điều khiển LCAS, được CRC-3 bảo vệ. Không LCAS: bit 12–32 dự trữ = 0 (G.707 Hình 11-9).",
    grid: { rows: 32, cols: 1, cellBits: 1 }, periodUs: 32 * 500, rateKbps: 2,
    regions: [
      k4("k4-mfi", "MFI", "Multiframe Indicator (bit 1–5)", "fas", 0, 5,
        "Chỉ thị đa khung VCAT bậc thấp, 5 bit (0–31), tăng 1 mỗi chuỗi 16 ms. Đầu phát gửi cùng MFI trên mọi thành viên; chênh lệch MFI ở đầu thu = trễ vi sai giữa các thành viên.",
        [{ name: "Multiframe indicator", abbr: "MFI", bits: 5, desc: "Bộ đếm 0–31 (MSB trước); vòng 32 × 16 ms = 512 ms." }]),
      k4("k4-sq", "SQ", "Sequence Indicator (bit 6–11)", "poh", 5, 6,
        "Số thứ tự thành viên trong VCG, 6 bit (0–63) → tối đa 64 thành viên VC-12. Đầu thu sắp các C-12 theo SQ để dựng lại tải.",
        [{ name: "Sequence indicator", abbr: "SQ", bits: 6, desc: "0 … X−1 (MSB trước). Có LCAS: đánh lại khi thêm/bớt thành viên." }]),
      k4("k4-ctrl", "CTRL", "LCAS control word (bit 12–15)", "poh", 11, 4,
        "Từ điều khiển LCAS của thành viên: FIXED / ADD / NORM / EOS / IDLE / DNU.",
        [{ name: "Control word", abbr: "CTRL", bits: 4, desc: CTRL_DESC }], CTRL_VALUES),
      k4("k4-gid", "GID", "Group Identification (bit 16)", "poh", 15, 1,
        "Một bit của chuỗi PRBS 2^15−1, giống nhau ở mọi thành viên cùng VCG – phát hiện thành viên đấu nhầm nhóm.",
        [{ name: "Group Identification bit", abbr: "GID", bits: 1, desc: "Bit PRBS 2^15−1, tiến 1 bit mỗi chuỗi 16 ms." }]),
      k4("k4-res", "Res", "Reserved (bit 17–20)", "reserved", 16, 4,
        "Dự trữ, đặt 0000.",
        [{ name: "Reserved", abbr: "0000", bits: 4, desc: "Dự trữ cho chuẩn hoá sau." }]),
      k4("k4-rsack", "RS-Ack", "Re-Sequence Acknowledge (bit 21)", "poh", 20, 1,
        "Đầu thu đảo bit này để xác nhận đã nhận chuỗi SQ mới sau khi thêm/bớt thành viên.",
        [{ name: "Re-Sequence Acknowledge", abbr: "RS-Ack", bits: 1, desc: "Toggle khi đầu thu chấp nhận thay đổi SQ." }]),
      k4("k4-mst", "MST", "Member Status (bit 22–29)", "poh", 21, 8,
        "Trạng thái thành viên do đầu thu gửi ngược về: 8 bit mỗi chuỗi, 0 = OK, 1 = FAIL. 64 thành viên trải trên 8 chuỗi liên tiếp (theo MFI), nên một thành viên được làm mới trạng thái mỗi 128 ms (G.707 Bảng 11-5 Note).",
        [{ name: "Member status", abbr: "MST", bits: 8, desc: "Mỗi bit một thành viên: 0 = OK, 1 = FAIL. Đầu phát chuyển thành viên FAIL sang DNU." }]),
      k4("k4-crc", "CRC-3", "CRC-3 (bit 30–32)", "poh", 29, 3,
        "CRC-3 (đa thức x^3 + x + 1) tính trên 29 bit trước của chuỗi; đầu thu bỏ qua gói điều khiển lỗi CRC.",
        [{ name: "CRC-3", abbr: "CRC-3", bits: 3, desc: "Kiểm lỗi gói điều khiển LCAS bậc thấp." }])
    ]
  };

  // =====================================================================
  // TMUX – client Ethernet qua GFP-F + nhóm ghép chuỗi ảo (VCG)
  // =====================================================================
  function U(o) { o.family = "sdh"; M[o.id] = o; }
  // Ethernet qua GFP-F (G.7041 §7.1): bỏ preamble + SFD (8 B) và IFG (12 B), thêm core header 4 B + payload header 4 B, không pFCS.
  // Khung 1518 B: 1538 B trên dây Ethernet → 1526 B trong GFP-F. Tỉ lệ ở khung chuẩn 1518 B (khung 64 B: 72/84).
  var GFPF = 1526 / 1538;
  // Định dạng số thống nhất: dấu cách nghìn (như các số viết tay trong file).
  function nf(x) { return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  var GFP_NOTE = "Tốc độ mang = tốc độ Ethernet × 1526/1538 (khung 1518 B: bỏ preamble+SFD 8 B và IFG 12 B, thêm GFP core header 4 B + payload header 4 B, không pFCS) ở khung chuẩn 1518 B; khung 64 B chỉ cần 72/84 tốc độ đường dây. Khung VLAN/jumbo 9618 B cần hơn chút (9626/9638 ≈ 0,99875) nhưng mọi VCG chọn vẫn đủ (10M: 9 988 ≤ 10 880; 100M: 99 875 ≤ 100 096; 1G: 998 755 ≤ 1 016 064 kbit/s). Tỉ lệ tốc độ Ethernet mang được (G.7041 Phụ lục V Bảng V.2/V.3): VC-3-2v 97,5 % với khung 1518 B; VC-4-6v 90,6 %; VC-4-7v và VC-12-5v 100 %. Khung GFP-F xem mảng IP. C2 = 0x1B (HO) / V5 L = 101 + K4 nhãn mở rộng 0x0D (LO) cho GFP.";

  [["eth-10m-gfpf", "Ethernet 10 Mbit/s (GFP-F)", 10000, "10BASE-T"],
   ["eth-100m-gfpf", "Fast Ethernet 100 Mbit/s (GFP-F)", 100000, "100BASE-TX/FX"],
   ["eth-1g-gfpf", "1GbE khung MAC (GFP-F)", 1000000, "1000BASE-X/T"]].forEach(function (c, i) {
    U({ id: c[0], name: c[1], kind: "client", level: 1 + i / 10, rateKbps: c[2],
      standard: "IEEE 802.3; ITU-T G.7041 §7.1 (GFP-F khung MAC)",
      summary: "Cổng " + c[3] + " " + nf(c[2]) + " kbit/s chỉ chở khung MAC qua GFP-F (không mang preamble/IFG).",
      desc: "Ethernet đưa vào SDH (EoS) bằng GFP-F: mỗi khung MAC thành một khung GFP, bỏ preamble/SFD và khoảng nghỉ IFG nên tốc độ cần mang nhỏ hơn tốc độ đường dây (khung 1518 B: × 1526/1538 ≈ " + nf(c[2] * GFPF) + " kbit/s). Sau đó GFP được rải vào một nhóm ghép chuỗi ảo VC-n-Xv vừa đủ dung lượng thay vì phải dùng cả một VC-4 hay VC-4-4c." +
        (c[0] === "eth-1g-gfpf" ? " Trong OTN (G.709 §17.4, PT 0x05): GFP-F vào thẳng OPU0 (≈ 992 198 kbit/s ≤ 1 238 954) hoặc vào OPUflex của ODUflex(GFP) 1 TS." : "") });
  });

  // GD5: Ethernet 10G/40G chỉ mang khung MAC qua GFP-F – đích là OTN (OPU2/OPU3 trực tiếp hoặc ODUflex(GFP)), xem data/transport-otn.js.
  // GFP_NOTE ở trên nói về VCG SDH nên không gắn vào đây; tỉ lệ 1526/1538 giữ nguyên.
  [["eth-10g-gfpf", "10GbE khung MAC (GFP-F)", 10000000, "10GBASE-R", 2,
    "Đích OTN: GFP-F thẳng vào OPU2 (≈ 9 995 277 kbit/s, PT 0x05 – G.709 §17.4, G.Sup43 §6.2) hoặc vào ODUflex(GFP) 8 TS (8 × ODU2.ts, OPUflex ≈ 9 951 604 kbit/s; ±100 ppm: 9 950 609 – 9 952 599). Lưu ý khung jumbo 9618 B: cần ≈ 9 987 549 kbit/s (+100 ppm: 9 988 548) > OPUflex 8 TS nên ODUflex(GFP) 8 TS KHÔNG đủ 10GbE chạy kín line-rate khi khung lớn hơn ≈ 2,46 KB; GFP-F thẳng vào OPU2 (9 995 277) vẫn đủ (G.Sup43 §6.2). Khác client 10GbE CBR (10,3125 Gbit/s, cả luồng 64B/66B) chỉ vừa OPU2e. Qua SDH: C-4-64c chỉ 9 584 640 kbit/s, thiếu khi cổng chạy kín khung 1518 B (≈ 9 921 977) – lab SDH không dùng client này."],
   ["eth-40g-gfpf", "40GbE khung MAC (GFP-F)", 40000000, "40GBASE-R", 3,
    "Đích OTN: GFP-F thẳng vào OPU3 (≈ 40 150 519 kbit/s, PT 0x05) hoặc vào ODUflex(GFP) 32 TS (32 × ODU3.ts, OPUflex ≈ 39 975 089 kbit/s) – không vào được OPU2. Khác client 40GbE CBR phải chuyển mã 1024B/1027B rồi GMP vào OPU3 (PT 0x07)."]].forEach(function (c) {
    U({ id: c[0], name: c[1], kind: "client", level: c[4], rateKbps: c[2],
      standard: "IEEE 802.3; ITU-T G.7041 §7.1 (GFP-F khung MAC); ITU-T G.709 (02/2012) §17.4",
      summary: "Cổng " + c[3] + " " + nf(c[2]) + " kbit/s chỉ chở khung MAC qua GFP-F (không mang preamble/IFG, không trong suốt mức PCS).",
      desc: "Ethernet gói (dịch vụ EPL/EVPL) đưa vào khung truyền dẫn bằng GFP-F: mỗi khung MAC thành một khung GFP, bỏ preamble/SFD và IFG nên tốc độ cần mang nhỏ hơn tốc độ đường dây (khung 1518 B: × 1526/1538 ≈ " + nf(c[2] * GFPF) + " kbit/s; khung 64 B chỉ cần 72/84). " + c[5] + " Khung GFP-F xem mảng IP." });
  });

  // Desc chung cho VCG.
  var HO_NOTE = " Mỗi thành viên là một VC đầy đủ (POH riêng, con trỏ riêng), được định tuyến độc lập qua mạng – có thể nằm ở AU-4/TU-3 bất kỳ, khác STM, thậm chí khác tuyến – chỉ hai đầu cuối cần hiểu VCAT, nút trung gian đấu chéo như VC thường. Đầu thu dùng MFI (H4: MFI-1 4 bit × MFI-2 8 bit, chu kỳ 512 ms) để bù trễ vi sai, SQ để sắp lại thứ tự. Đầu thu phải bù được ít nhất 125 µs; đa khung 512 ms cho phép bù tới 256 ms (G.707 §11.2)."
  var LO_NOTE = " Mỗi VC-12 thành viên có POH riêng và con trỏ TU-12 riêng, đi độc lập qua mạng (TU-12 bất kỳ trong các VC-4 bất kỳ). Đầu thu dùng MFI 5 bit trong chuỗi K4 bit 2 (32 × 16 ms = 512 ms) để bù trễ vi sai, SQ 6 bit để sắp lại (tối đa 64 thành viên). Đầu thu phải bù ít nhất 125 µs; frame count đo được trễ vi sai tới 512 ms, bước 16 ms (G.707 §11.4)."
  var LCAS_NOTE = " Có LCAS (G.7042): thêm/bớt thành viên theo kế hoạch không gây lỗi (hitless) nhờ bắt tay CTRL ADD → NORM/EOS và IDLE, RS-Ack xác nhận SQ mới; thành viên hỏng được đầu thu báo MST = FAIL, đầu phát chuyển sang DNU – nhóm chạy tiếp với dung lượng giảm thay vì mất toàn bộ.";

  function vcg(o) {
    U({ id: o.id, name: o.name, kind: "vcg", level: o.level, rateKbps: o.n * o.pk, frame: o.frame,
      members: { of: o.of, count: o.n, payloadOf: o.pl },
      standard: o.std,
      summary: o.summary, desc: o.desc, accepts: o.accepts });
    if (!o.accepts) delete M[o.id].accepts;
  }

  vcg({ id: "vc-12-5v", name: "VC-12-5v", level: 13, n: 5, pk: 2176, of: "vc-12", pl: "c-12", frame: "vcat-k4",
    std: "ITU-T G.707 §11.4 (VC-12-Xv, X ≤ 64); G.7042 (LCAS)",
    summary: "Nhóm ghép chuỗi ảo 5 × VC-12: dung lượng C-12-5v = 5 × 2176 = 10 880 kbit/s, vừa Ethernet 10 Mbit/s.",
    desc: "5 VC-12 (5 TU-12 trong cùng hoặc khác VC-4) ghép thành một ống 10,88 Mbit/s cho cổng 10 Mbit/s; dùng 5/63 dung lượng VC-4 thay vì cả VC-3." + LO_NOTE + LCAS_NOTE,
    accepts: [{ of: "eth-10m-gfpf", count: 1, fit: "le", carriedKbps: 10000 * GFPF, mapping: "GFP-F",
      note: "10 000 × 1526/1538 ≈ 9 922 kbit/s ≤ 5 × 2176 = 10 880 kbit/s. " + GFP_NOTE }] });

  vcg({ id: "vc-12-46v", name: "VC-12-46v", level: 14, n: 46, pk: 2176, of: "vc-12", pl: "c-12", frame: "vcat-k4",
    std: "ITU-T G.707 §11.4 (VC-12-Xv, X ≤ 64); G.7042 (LCAS)",
    summary: "Nhóm ghép chuỗi ảo 46 × VC-12: 46 × 2176 = 100 096 kbit/s, vừa Fast Ethernet ở tốc độ đường dây.",
    desc: "46 VC-12 = 100,096 Mbit/s ≥ 99,22 Mbit/s cần cho 100 Mbit/s qua GFP-F (khung chuẩn 1518 B). Cần 46 TU-12 trống – một VC-4 chỉ có 63 TU-12, nên VCG này thường chiếm phần lớn một VC-4 hoặc trải trên nhiều VC-4. So với VC-3-2v (96,768 Mbit/s, thiếu một chút) đây là cách mang trọn 100 Mbit/s bằng bậc thấp." + LO_NOTE + LCAS_NOTE,
    accepts: [{ of: "eth-100m-gfpf", count: 1, fit: "le", carriedKbps: 100000 * GFPF, mapping: "GFP-F",
      note: "100 000 × 1526/1538 ≈ 99 220 kbit/s ≤ 46 × 2176 = 100 096 kbit/s (45 thành viên = 97 920, không đủ). " + GFP_NOTE }] });

  vcg({ id: "vc-3-2v", name: "VC-3-2v", level: 33, n: 2, pk: 48384, of: "vc-3", pl: "c-3", frame: "vcat-h4",
    std: "ITU-T G.707 §11.2 (VC-3-Xv, X ≤ 256); G.7042 (LCAS)",
    summary: "Nhóm ghép chuỗi ảo 2 × VC-3: 2 × 48 384 = 96 768 kbit/s – THIẾU cho Fast Ethernet ở tốc độ đường dây.",
    desc: "Fast Ethernet qua GFP-F cần ≈ 99 220 kbit/s với khung 1518 B, nhưng C-3-2v chỉ có 96 768 kbit/s (thiếu ≈ 2,5 %), nên lab không cho thả eth-100m-gfpf vào đây. Thực tế nhiều thiết bị vẫn dùng VC-3-2v cho 100 Mbit/s khi chấp nhận giới hạn tốc độ (đệm/điều tiết lưu lượng khi cổng chạy kín với khung lớn; khung nhỏ cần ít hơn nên không bị ảnh hưởng). Muốn mang trọn tốc độ đường dây thì dùng VC-12-46v hoặc VC-3-3v." + HO_NOTE + LCAS_NOTE });

  vcg({ id: "vc-3-21v", name: "VC-3-21v", level: 34, n: 21, pk: 48384, of: "vc-3", pl: "c-3", frame: "vcat-h4",
    std: "ITU-T G.707 §11.2 (VC-3-Xv, X ≤ 256); G.7042 (LCAS)",
    summary: "Nhóm ghép chuỗi ảo 21 × VC-3: 21 × 48 384 = 1 016 064 kbit/s, vừa Gigabit Ethernet.",
    desc: "21 VC-3 (mỗi VC-3 vào một TU-3; 1 VC-4 chứa 3 TU-3) = 1,016 Gbit/s ≥ 992 Mbit/s cần cho GbE qua GFP-F. Cần 7 VC-4 có cấu trúc TUG-3 (21 TU-3) – STM-4 chỉ có 12 TU-3 nên không đủ, STM-16 có 48. Hiệu suất ≈ 98 %, tương đương VC-4-7v nhưng chia được mịn hơn (bước 48 Mbit/s). Lưu ý: VC-3 còn đi được qua AU-3 (G.707); lab chỉ mô phỏng đường AU-4 → TUG-3." + HO_NOTE + LCAS_NOTE,
    accepts: [{ of: "eth-1g-gfpf", count: 1, fit: "le", carriedKbps: 1000000 * GFPF, mapping: "GFP-F",
      note: "1 000 000 × 1526/1538 ≈ 992 198 kbit/s ≤ 21 × 48 384 = 1 016 064 kbit/s (20 thành viên = 967 680, không đủ). " + GFP_NOTE }] });

  vcg({ id: "vc-4-7v", name: "VC-4-7v", level: 54, n: 7, pk: 149760, of: "vc-4", pl: "c-4", frame: "vcat-h4",
    std: "ITU-T G.707 §11.2 (VC-4-Xv, X ≤ 256); G.7042 (LCAS)",
    summary: "Nhóm ghép chuỗi ảo 7 × VC-4: 7 × 149 760 = 1 048 320 kbit/s – cách chuẩn mang Gigabit Ethernet qua SDH.",
    desc: "7 VC-4 = 1,048 Gbit/s ≥ 992 Mbit/s cần cho GbE qua GFP-F (hiệu suất ≈ 95 %). Ghép chuỗi liền kề không có cỡ phù hợp: VC-4-4c chỉ 599 Mbit/s, VC-4-16c 2,4 Gbit/s (lãng phí hơn một nửa) và phải nằm liền khối, căn biên AUG-16. VC-4-7v dùng 7 AU-4 trống bất kỳ – STM-4 chỉ có 4 AU-4 nên không đủ, STM-16 có 16." + HO_NOTE + LCAS_NOTE,
    accepts: [{ of: "eth-1g-gfpf", count: 1, fit: "le", carriedKbps: 1000000 * GFPF, mapping: "GFP-F",
      note: "1 000 000 × 1526/1538 ≈ 992 198 kbit/s ≤ 7 × 149 760 = 1 048 320 kbit/s (6 thành viên = 898 560, không đủ). " + GFP_NOTE }] });
})();
