// Mảng Truyền dẫn – GD9: FlexE (Flex Ethernet) theo OIF FlexE IA 2.2 + FlexE-aware vào ODUflex (G.709 §17.12).
// Schema: .claude/skills/transport-frame-spec/references/transport-schema.md (mục "Mở rộng OTN (GD3)", "Mở rộng FlexE (GD9)")
// Nguồn (đọc nguyên văn; vị trí bit đọc từ ảnh render trang PDF):
//   OIF-FLEXE-02.2 (IA FlexE 2.2, 10/2021): §5.1–5.2 (client 10, 40, m × 25G; tốc độ 66/64 × MAC), §6.1 (nhóm, số PHY/instance),
//     §6.3–6.4 (tốc độ 66B của 100G/200G/400GBASE-R), §6.5 (pad P1/P2, ghép xen instance, Hình 13–15), §6.6 (instance
//     không trang bị, Hình 16), §6.7 (tốc độ client sau thích ứng), §6.8 (lịch 5G, sub-calendar, 25G, Hình 18–19),
//     §6.9 (khung overhead, khe không khả dụng, Hình 21–25), §7.3 (xử lý OH: OMF, C, Map, Instance number Hình 26,
//     lịch A/B, CR/CA, kênh quản lý, SMC, Group number, RPF, CRC-16), §7.4 (mux, khối lỗi Hình 30), §8 (FlexE qua mạng truyền tải).
//   ITU-T G.709/Y.1331 (06/2020): Bảng 7-2/7-3 (ODUflex/OPUflex FlexE-aware), Bảng 7-4, Bảng 7-7 (ODTU4.ts, ODTUCn.ts),
//     Bảng 7-9 dòng ODUflex(FlexE) (Note → công thức 19-1a/20-1a), §17.11 (FlexE Client → OPUflex(IMP)), §17.12 (FlexE aware,
//     Hình 17-20…17-22), Bảng 15-9 (PT 0x1D, 0x1E), §19.6 (19-1a), §20.5 (20-1a).
// CHƯA XÁC MINH: nội dung giao thức của kênh quản lý (IA §7.3.5: 'application specific'); thứ tự bit truyền trong từng trường
//   nhiều bit (hình IA đánh số bit 0–63 theo thứ tự truyền; riêng Instance number ghi rõ LSB..MSB ở Hình 26).
// File này KHÔNG đọc TMUX của file khác lúc nạp. Unit oduflex-flexe-aware-* (family otn) chưa có đường vào OPU4/OPUCn
//   (cần thêm phương án slots ở opu4 – transport-otn.js – và opuc1/2/4 – transport-b100g.js; xem báo cáo H1).
window.TFRAMES = window.TFRAMES || {};
window.TMUX = window.TMUX || {};
window.TLABS = window.TLABS || [];

(function () {
  var F = window.TFRAMES, M = window.TMUX, L = window.TLABS;
  var IA = "OIF FlexE IA 2.2 (OIF-FLEXE-02.2, 10/2021)", G709 = "ITU-T G.709/Y.1331 (06/2020)";
  var CAT = "FlexE";

  function R(id, abbr, name, kind, rect, desc, extra) {
    var o = { id: id, name: name, abbr: abbr, kind: kind,
      rect: { r: rect[0], c: rect[1], h: rect[2], w: rect[3], step: rect[4] || 1 }, desc: desc };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }
  function vn(x, d) { return x.toLocaleString("vi-VN", { maximumFractionDigits: d === undefined ? 3 : d }).replace(/\./g, " "); }
  function mbps(x) { return vn(x / 1000, 3) + " Mbit/s"; }
  function gbps(x) { return vn(x / 1e6, 3) + " Gbit/s"; }

  // ---------- Tốc độ (kbit/s) – IA §6.3, §6.4, §6.7 ----------
  var ETH100 = 103125000;                      // dòng 66B của 100GBASE-R (kể cả AM)
  var INST = ETH100 * 16383 / 16384;           // ≈ 103 118 705,750 – một 100G FlexE instance (trừ AM 1/16K, §6.3)
  var CAL = INST * 20460 / 20461;              // phần dành cho lịch 20 khe (trừ 1 khối OH mỗi 20 461 khối)
  var SLOT = CAL / 20;                         // ≈ 5 155 683,299 – một khe lịch 5G
  var OH_KBPS = INST - CAL;                    // ≈ 5 039,77 – khối overhead FlexE
  var NBLK = 20461;                            // khối 66B mỗi hàng: 1 OH + 1023 × 20
  var PER = 8 * NBLK * 66 * 1000 / INST;       // ≈ 104,767 µs – khung overhead 8 khối (§6.9: '104.77 µs')
  function macK(g) { return g * 1e6; }
  function line66(g) { return macK(g) * 66 / 64; }                     // §5.2.1.1: 66/64 × MAC
  function adapted(g) { return line66(g) * 16383 / 16384 * 20460 / 20461; }   // §6.7

  // =====================================================================
  // Khung overhead FlexE – một 100G instance: 8 hàng × 20 461 khối 66B (IA §6.9, §7.3, Hình 21, 23, 25, 26)
  // =====================================================================
  var SH_CTL = { name: "Sync header", abbr: "SH = 10", bits: 2, desc: "Mào đồng bộ 2 bit của khối 64B/66B: 10 = khối điều khiển (control block). Hai bit này không bị xáo trộn (scrambler bỏ qua)." };
  var SH_DATA = { name: "Sync header", abbr: "SH = 01", bits: 2, desc: "01 = khối dữ liệu: khối OH 2 và 3 được mã hoá như khối dữ liệu 66B (§6.9)." };
  var SH_ANY = { name: "Sync header", abbr: "ss", bits: 2, desc: "Mào đồng bộ hợp lệ bất kỳ (01 hoặc 10): kênh quản lý mang được mọi khối 66B hợp lệ theo IEEE 802.3 Hình 82-5, trừ ordered set có O code 0x5 (dành cho OH FlexE, §6.9)." };
  var C_BIT = function (k) {
    return { name: "Calendar configuration in use (bản " + k + "/3)", abbr: "C", bits: 1,
      desc: "Lịch đang dùng: 0 = lịch A, 1 = lịch B. Gửi 3 bản ở khối 1, 2, 3 (cách nhau ≈ 1,35 triệu bit) và đầu thu bầu đa số – C phải đọc được cả khi CRC sai vì hai đầu phải đổi lịch đúng cùng một khung OH (§7.3.2). Đổi lịch có hiệu lực từ khối dữ liệu đầu tiên sau khối 1 của khung OH kế tiếp." };
  };
  var B1_BITS = [SH_CTL,
    { name: "Block type", abbr: "0x4B", bits: 8, desc: "Kiểu khối điều khiển 0x4B = ordered set (IEEE 802.3 Hình 82-5)." },
    C_BIT(1),
    { name: "Overhead Multiframe Indicator", abbr: "OMF", bits: 1, desc: "= 0 ở 16 khung OH đầu, = 1 ở 16 khung OH sau của đa khung 32 (instance 100G). Đầu thu khoá đa khung khi thấy OMF đổi 0→1 hoặc 1→0 ở hai khung liên tiếp có CRC đúng – mỗi đa khung có hai cơ hội (§7.3.1)." },
    { name: "Remote PHY Fault", abbr: "RPF", bits: 1, desc: "= 1 báo cho shim đầu xa rằng PHY này đang lỗi ở hướng thu (mất tín hiệu, mất khoá khối/khung OH, PCS_status = FALSE…) – thay chức năng RS báo lỗi xa vì không có lớp RS theo tốc độ PHY (§7.3.8, §7.5.2). Trên 200G/400GBASE-R chỉ instance đầu của PHY mang RPF; nút FlexE-aware chuyển tiếp, không xử lý." },
    { name: "Synchronization Configuration", abbr: "SC", bits: 1, desc: "= 1: khối OH 6 của instance đầu tiên dành cho kênh đồng bộ (SMC – PTP/SSM); = 0: khối 6 thuộc kênh quản lý shim-to-shim (§7.3.5). Cấu hình tĩnh. Bit này là RES trong FlexE 1.0; ở instance không phải đầu tiên của 200G/400G là RES." },
    { name: "FlexE Group Number", abbr: "Group number", bits: 20, desc: "Số nhóm 20 bit (1 … 0xFFFFD) để phát hiện nối nhầm: mọi instance trang bị trong nhóm mang cùng số; 0x00000 = instance không trang bị (Hình 16), 0xFFFFE dùng cho phát hiện láng giềng (FLEXE-ND), 0xFFFFF đánh dấu khối pad P1 (Hình 15) (§7.3.6)." },
    { name: "O code", abbr: "0x5", bits: 4, desc: "Mã 'O' riêng của FlexE = 0x5 – khác ordered set chuỗi (sequence) của Ethernet và ordered set báo hiệu của Fibre Channel, nên nhận ra được độc lập với dữ liệu client (§6.9)." },
    { name: "Zero", abbr: "0x000_0000", bits: 28, desc: "Bit 36–63 = trường cố định 0x000_0000 của khuôn ordered set Clause 82 (0x4B | D1 | D2 | D3 | O0 | 0x000_0000 – IEEE 802.3 Hình 82-5; IA Hình 23, 25). O0 là trường 4 bit riêng (= 0x5, bit 32–35)." }];
  var B2_RES = { name: "Reserved", abbr: "RES", bits: 47, desc: "Dự trữ, phát 0 trước xáo trộn; đầu thu bỏ qua (§7.3.7)." };
  var INST_NO = { name: "FlexE Instance Number", abbr: "Instance #", bits: 8, desc: "Định danh instance trong nhóm (bit 9–16, LSB..MSB – Hình 26): 100GBASE-R → số PHY 1–254; 200GBASE-R → bit 9 = 0/1 (instance trong PHY) + 7 bit số PHY 1–126; 400GBASE-R → bit 9–10 = chỉ số 0–3 + 6 bit số PHY 1–62. Không đổi khi nhóm đang chạy; đầu thu nhận khi hai khung OH liên tiếp (CRC đúng) cùng giá trị (§6.1, §7.3.3)." };
  function b2Bits(k) {
    return [SH_DATA, C_BIT(2),
      { name: "FlexE Map bit " + (8 * k) + "–" + (8 * k + 7), abbr: "Map " + (8 * k) + "–" + (8 * k + 7), bits: 8,
        desc: "8 bit của bản đồ thành viên 256 bit: bit i = 1 nếu instance số i thuộc nhóm (instance không trang bị không được đánh dấu). Gửi đủ trên mọi instance để đầu thu kiểm cấu hình hai đầu khớp (§7.3.3)." },
      INST_NO, B2_RES];
  }
  var B3_TAIL = [
    { name: "Calendar Switch Request", abbr: "CR", bits: 1, desc: "Đầu phát (mux) đổi CR sang lịch dự phòng khi đã nạp xong lịch mới – xin đổi lịch (§7.3.4)." },
    { name: "Calendar Switch Acknowledge", abbr: "CA", bits: 1, desc: "Đầu thu (demux) gửi ngược CA = CR khi sẵn sàng; mux thường chỉ đổi 3 bit C sau khi nhận CA. Mux đặt bộ định thời (gợi ý 1 s); hết giờ mà chưa có CA thì xử lý tuỳ ứng dụng – hoặc vẫn đổi lịch, hoặc báo cảnh báo và chờ can thiệp (§7.3.4)." },
    { name: "Reserved", abbr: "RES", bits: 13, desc: "Dự trữ, phát 0." },
    { name: "CRC-16", abbr: "CRC-16", bits: 16, desc: "CRC x¹⁶ + x¹² + x⁵ + 1 (khởi tạo 0) tính trên D1–D3 của khối 1, 8 byte của khối 2 và 6 byte đầu của khối 3 (tổng 136 bit). Bit x¹⁵ truyền trước – ngược thứ tự bit Ethernet thường lệ, giống FCS. Map, lịch A/B, Instance number chỉ được nhận từ khung OH có CRC đúng (§7.3.9)." }];
  function b3Bits(k) {
    var cal = k < 20;
    return [SH_DATA, C_BIT(3),
      { name: cal ? "Client carried Calendar A slot " + k : "Reserved", abbr: cal ? "Lịch A khe " + k : "RES", bits: 16,
        desc: cal ? "Số hiệu client (16 bit) mà lịch A gán cho khe " + k + " của instance này: 0x0000 = khe chưa dùng (vẫn khả dụng); 0xFFFF = khe KHÔNG KHẢ DỤNG (FlexE-aware, mạng truyền tải bỏ khe này); giá trị khác = một client. Kích thước client = số khe cùng số hiệu trên cả nhóm (§7.3.4)." : "Khung OH 20–31 của đa khung: trường lịch A dự trữ (instance 100G chỉ có 20 khe)." },
      { name: cal ? "Client carried Calendar B slot " + k : "Reserved", abbr: cal ? "Lịch B khe " + k : "RES", bits: 16,
        desc: cal ? "Như lịch A nhưng cho cấu hình B. Gửi liên tục cả hai lịch nên không mất đồng bộ vì một bản tin hỏng; lịch đầy đủ đi hết một đa khung ≈ 3,35 ms (§7.3.4)." : "Khung OH 20–31: trường lịch B dự trữ." }].concat(B3_TAIL);
  }
  function mcBits(label, d) { return [SH_ANY, { name: label, abbr: label, bits: 64, desc: d }]; }
  var B2_PF = range(0, 31).map(function (k) {
    return { frames: [k], abbr: "Map " + (8 * k) + "–" + (8 * k + 7), name: "Khung OH " + k + ": FlexE Map bit " + (8 * k) + "–" + (8 * k + 7),
      desc: "Khung OH thứ " + k + " (OMF = " + (k < 16 ? 0 : 1) + ") mang 8 bit Map số " + (8 * k) + "–" + (8 * k + 7) + "; 32 khung × 8 = 256 bit cho instance số 0–255.", bitFields: b2Bits(k) };
  });
  var B3_PF = range(0, 19).map(function (k) {
    return { frames: [k], abbr: "Khe " + k, name: "Khung OH " + k + ": lịch A/B của khe " + k,
      desc: "Khung OH thứ " + k + " mang số hiệu client của khe " + k + " trong lịch A và lịch B (theo đúng thứ tự khe xuất hiện trên đường truyền).", bitFields: b3Bits(k) };
  }).concat([{ frames: range(20, 31), abbr: "RES", name: "Khung OH 20–31: trường lịch dự trữ",
    desc: "Instance 100G chỉ có 20 khe nên 12 khung OH cuối của đa khung để trống trường lịch (Hình 25).", bitFields: b3Bits(20) }]);
  var B1_PF = [
    { frames: range(0, 15), abbr: "OMF = 0", name: "Khung OH 0–15 (OMF = 0)", desc: "Nửa đầu đa khung 32: OMF = 0." },
    { frames: range(16, 31), abbr: "OMF = 1", name: "Khung OH 16–31 (OMF = 1)", desc: "Nửa sau đa khung 32: OMF = 1." }];

  function slotRegion(s) {
    return R("s" + s, "Khe " + s, "Calendar slot " + s + " (5G)", "tributary", [0, 1 + s, 8, 1023, 20],
      "Khe lịch " + s + ": khối thứ " + (s + 1) + " trong mỗi vòng 20 khối, lặp 1023 lần giữa hai khối OH (cột " + (s + 2) + ", " + (s + 22) + ", … , " + (s + 20442) + " ở mỗi hàng) → 8 184 khối mỗi khung OH ≈ " + mbps(SLOT) + ". Mang các khối 66B của client được gán khe này theo lịch đang dùng (A hoặc B); khe chưa dùng hoặc không khả dụng mang khối lỗi Ethernet (SH 10, kiểu 0x1E, tám ký tự /E/ – Hình 30) để không bao giờ bị hiểu nhầm là dữ liệu (§7.4). Khe không khả dụng (0xFFFF) luôn nằm cuối sub-calendar: FlexE-aware bỏ hẳn khe 15–19 khi chỉ mang 75 % (Hình 22).");
  }

  F["flexe-inst100"] = {
    id: "flexe-inst100", name: "FlexE – khung overhead một 100G instance (8 × 20 461 khối 66B)", family: "flexe", category: CAT, order: 10,
    standard: IA + " §6.8, §6.9 (Hình 18, 21, 22, 23, 25), §7.3 (Hình 26), §7.4 (Hình 30); tốc độ §6.3/§6.4",
    summary: "Một 100G FlexE instance ≈ 103,119 Gbit/s: cứ 1 khối overhead 66B lại tới 1023 vòng lịch 20 khe 5G; 8 khối OH tạo khung OH ≈ 104,77 µs, 32 khung OH tạo đa khung ≈ 3,35 ms.",
    detail: "FlexE (Flex Ethernet) chèn một lớp 'shim' vào giữa PCS của Ethernet: các client MAC (10, 40, m × 25G) được mã 64B/66B rồi phân khối 66B vào một lịch (calendar) khe 5G; lịch trải trên 1…n instance 100G mang bởi 100G/200G/400GBASE-R (50G instance trên 50GBASE-R không vẽ ở đây). Mỗi ô của lưới là MỘT khối 66 bit; mỗi hàng = 1 khối OH (cột 1) + 1023 lần lặp lịch 20 khe (cột 2–20 461) – chuỗi đúng thứ tự truyền, hàng 1 → 8. Instance chiếm toàn bộ khối 66B của 100GBASE-R trừ alignment marker (16383/16384 × 103,125 Gbit/s); trên 200G/400GBASE-R có thêm pad P1/P2 (2 khối mỗi 163 830 khối) để instance có cùng tốc độ danh định, rồi 2 hoặc 4 instance ghép xen từng khối 66B (§6.5, Hình 13–15). Khối OH 1 là ordered set (SH 10, kiểu 0x4B, O code 0x5) làm mốc căn khung và sắp lại các instance (khoá khung khi gặp lại sau (1023 × 20 + 1) × 8 khối, mất khoá sau 5 lần sai); khối 2–3 là khối dữ liệu mang Map, số instance, lịch A/B, CR/CA, CRC-16; khối 4–8 là kênh quản lý section, shim-to-shim và kênh đồng bộ. Khung OH ≈ 104,77 µs nên bù lệch giữa các PHY được tới khoảng ±52 µs (§7.5). Qua OTN có 3 kiểu (IA §8; G.709 §17.11, §17.12): unaware – từng PHY đi như Ethernet thường (vd. 100GbE → OPU4), shim chịu lệch lớn; termination – thiết bị truyền tải kết cuối nhóm, chỉ mang từng client trong ODUflex(IMP,s); aware – không kết cuối nhóm nhưng bỏ khe không khả dụng và instance không trang bị rồi ánh xạ phần còn lại vào ODUflex(FlexE-aware), PT 0x1E.",
    grid: { rows: 8, cols: NBLK, cellBits: 66 }, periodUs: PER, rateKbps: INST, unit: "flexe-inst100",
    multiframe: { frames: 32, note: "Đa khung OH 32 khung (instance 100G; 50G là 16): OMF = 0 ở khung 0–15, 1 ở khung 16–31. Khung k mang FlexE Map bit 8k…8k+7 (256 bit) và, với k = 0…19, số hiệu client của khe k trong lịch A và B. Lịch đầy đủ đi hết một đa khung ≈ 3,35 ms (§7.3.1, §7.3.3, §7.3.4)." },
    regions: [
      R("oh", "OH", "FlexE overhead (cột 1, 8 khối/khung)", "soh", [0, 0, 8, 1],
        "8 khối overhead của khung OH, mỗi khối cách khối trước 20 × 1023 khối dữ liệu (= 20 461 vị trí khối). Overhead chiếm 1/20 461 ≈ " + mbps(OH_KBPS) + " của instance. Chèn cùng vị trí tương đối trên mọi instance của nhóm để demux căn các sub-calendar (§6.9, §7.4).", {
          children: [
            R("oh-ctl", "OH 1–3", "Khối OH 1–3: căn khung + cấu hình", "soh", [0, 0, 3, 1],
              "Ba khối mang toàn bộ thông tin điều khiển FlexE (24 bit của ordered set không đủ nên trải trên khung OH và đa khung OH, §6.9).", {
                children: [
                  R("b1", "0x4B·O=5", "Khối OH 1 – ordered set căn khung", "fas", [0, 0, 1, 1],
                    "Mốc căn khung (Hình 23, 25): SH 10, kiểu khối 0x4B, D1–D3 mang C, OMF, RPF, SC và FlexE Group Number 20 bit, O code 0x5. Đầu thu tìm khối này để khoá khung OH, sau đó đọc D1–D3 cùng 7 khối nằm sau 20 461, 40 922, …, 143 227 vị trí khối (§7.3.1).",
                    { bitFields: B1_BITS, perFrame: B1_PF, values: [{ v: "0x4B", m: "Block type (ordered set)" }, { v: "0x5", m: "O code FlexE" }] }),
                  R("b2", "Map·Inst#", "Khối OH 2 – FlexE Map + Instance number", "soh", [1, 0, 1, 1],
                    "Khối dữ liệu (SH 01): bản sao thứ 2 của C, 8 bit FlexE Map (đổi theo khung trong đa khung), FlexE Instance Number 8 bit, 47 bit dự trữ (Hình 25, 26).",
                    { bitFields: b2Bits(0), perFrame: B2_PF }),
                  R("b3", "Cal A/B·CRC", "Khối OH 3 – lịch A/B + CR/CA + CRC-16", "soh", [2, 0, 1, 1],
                    "Khối dữ liệu (SH 01): bản sao thứ 3 của C, số hiệu client của một khe trong lịch A và lịch B (khe = số khung trong đa khung), CR, CA, 13 bit dự trữ, CRC-16 (Hình 25).",
                    { bitFields: b3Bits(0), perFrame: B3_PF })
                ] }),
            R("oh-mc", "OH 4–8", "Khối OH 4–8: kênh quản lý + đồng bộ", "soh", [3, 0, 5, 1],
              "Năm khối tuỳ chọn, mang khối 66B hợp lệ bất kỳ; không dùng thì phát khối Idle Ethernet (SH 10, kiểu 0x1E, 8 ký tự /I/ = 0x00 – Hình 27). Kênh quản lý KHÔNG gộp qua nhóm: mỗi PHY có kênh riêng, nằm ở instance đầu của PHY; các instance khác của 200G/400GBASE-R để khối 4–8 dự trữ (SH 01 + toàn 0) (§7.3.5). Định dạng giao thức trên kênh là tuỳ ứng dụng (vd. LLDP tới 01-80-C2-00-00-0E) – CHƯA XÁC MINH chi tiết.", {
                children: [
                  R("mc-sec", "MC section", "Khối OH 4–5 – Management Channel: Section", "soh", [3, 0, 2, 1],
                    "Kênh quản lý đoạn: từ shim tới nút FlexE-aware kế bên (router ↔ thiết bị truyền tải không kết cuối nhóm, hoặc tới shim đầu xa). ≈ 1,222 Mbit/s mỗi PHY 100G/200G/400G (1,260 Mbit/s tính cả SH). Nút FlexE-aware kết cuối kênh này và chèn kênh mới ở đầu ra (§7.3.5, §8.3).", {
                      children: [
                        R("b4", "MC-S 1", "Khối OH 4 – Section MC (1/2)", "soh", [3, 0, 1, 1], "Nửa đầu kênh quản lý section: 64 bit mỗi khung OH.", { bitFields: mcBits("Section MC", "Dữ liệu kênh quản lý section (khối dữ liệu hoặc điều khiển hợp lệ).") }),
                        R("b5", "MC-S 2", "Khối OH 5 – Section MC (2/2)", "soh", [4, 0, 1, 1], "Nửa sau kênh quản lý section.", { bitFields: mcBits("Section MC", "Dữ liệu kênh quản lý section.") })
                      ] }),
                  R("b6", "MC-S2S / SMC", "Khối OH 6 – Shim-to-shim MC hoặc Synchronization Messaging Channel", "soh", [5, 0, 1, 1],
                    "SC = 0: thuộc kênh shim-to-shim (khối 6–8, ≈ 1,833 Mbit/s). SC = 1: kênh đồng bộ SMC mang bản tin PTP/SSM (G.8264, IEEE 1588) mã 66B, chỉ ở instance đầu của PHY đầu tiên trong nhóm; mốc tem thời gian PTP = đầu đa khung OH đứng trước khối /S/ của bản tin (§7.3.5). SMC chỉ dùng cho kịch bản gộp PHY đơn giản điểm–điểm.",
                    { bitFields: mcBits("S2S MC / SMC", "Kênh shim-to-shim (SC = 0) hoặc kênh đồng bộ (SC = 1).") }),
                  R("mc-s2s", "MC shim-shim", "Khối OH 7–8 – Management Channel: Shim-to-shim", "soh", [6, 0, 2, 1],
                    "Kênh quản lý đầu-cuối giữa hai shim kết cuối nhóm, đi xuyên qua nút FlexE-aware. 2 khối (≈ 1,222 Mbit/s) khi SC = 1, 3 khối kể cả khối 6 (≈ 1,833 Mbit/s) khi SC = 0 (§7.3.5).", {
                      children: [
                        R("b7", "MC-S2S", "Khối OH 7 – Shim-to-shim MC", "soh", [6, 0, 1, 1], "64 bit kênh shim-to-shim mỗi khung OH.", { bitFields: mcBits("Shim-to-shim MC", "Dữ liệu kênh shim-to-shim.") }),
                        R("b8", "MC-S2S", "Khối OH 8 – Shim-to-shim MC", "soh", [7, 0, 1, 1], "64 bit kênh shim-to-shim mỗi khung OH.", { bitFields: mcBits("Shim-to-shim MC", "Dữ liệu kênh shim-to-shim.") })
                      ] })
                ] })
          ] }),
      R("cal", "Lịch 20 × 1023", "Sub-calendar 20 khe 5G × 1023 vòng (cột 2–20 461)", "payload", [0, 1, 8, 20460],
        "Vùng dữ liệu 20 460 khối mỗi hàng: lịch 20 khe lặp 1023 lần (Hình 21) ≈ " + gbps(CAL) + " = 20 × " + mbps(SLOT) + ". Mỗi khe 5G nhận khối 66B của client được gán; client 25G = 5 khe, 100G = 20 khe. Nhóm n instance có lịch logic 20n khe, số thứ tự logic = 20 × số instance + số khe; khối được phân 20 khối một lần cho sub-calendar của từng instance (Hình 18) – một client có thể trải khe trên nhiều instance (§6.8, §7.4). Thiết bị có thể chỉ hỗ trợ khe 25G = 5 khe 5G liên tiếp (0–4, 5–9, 10–14, 15–19; Hình 19).", {
          children: range(0, 19).map(slotRegion) })
    ]
  };

  // =====================================================================
  // TMUX – client FlexE, instance, nhóm, PHY (family flexe)
  // =====================================================================
  function U(o, fam) { o.family = fam || "flexe"; M[o.id] = o; }
  var CLIENTS = [10, 25, 40, 50, 100, 150, 200, 300, 400];
  CLIENTS.forEach(function (g, i) {
    var s = g / 5;
    U({ id: "flexe-client-" + g + "g", name: "FlexE Client " + g + "G", kind: "client", level: 1 + i, rateKbps: line66(g),
      standard: IA + " §5.2.1.1, §6.7, §7.2; " + G709 + " Bảng 7-3 (OPUflex(IMP,s))",
      summary: "Client MAC " + g + " Gbit/s mã 64B/66B: " + mbps(line66(g)) + " (= 66/64 × " + g + "G); chiếm " + s + " khe 5G.",
      desc: "Dòng khối 66B (IEEE 802.3 Hình 82-5, ký tự Start căn biên 8 byte) của một MAC " + g + "G – có thể sinh trong hệ thống (NPU) hoặc chuyển từ một PHY Ethernet cùng tốc độ (§7.2). Vào shim, client được thích ứng tốc độ bằng thêm/bớt Idle xuống " + mbps(adapted(g)) + " (× 16383/16384 × 20460/20461, thấp hơn ≈ 0,011 % – không mất gói) để vừa đúng " + s + " khe lịch (§5.2.1.2, §6.7)." +
        (g === 10 || g === 40 ? " Tốc độ " + g + "G không phải bội 25G: chỉ dùng được với thiết bị hỗ trợ khe 5G (thiết bị chỉ hỗ trợ khe 25G không nhận; Idle không đủ bù chênh lệch lớn, ví dụ 10G vào khe 25G cần bộ đệm khung MAC – §5.2.1.2 Note)." : "") +
        (g > 100 ? " Lớn hơn một instance 100G: cần nhóm có ít nhất " + Math.ceil(s / 20) + " instance; các khe trải qua nhiều instance/PHY (§6.8)." : "") +
        " Qua OTN khi kết cuối FlexE (§8.2): client vào ODUflex(IMP,s) với s = " + s + ", OPUflex = " + s + " × 5 156 250 kbit/s (G.709 Bảng 7-3, §17.11; GD11)." });
  });

  function slotOpts(nSlots) {
    return CLIENTS.filter(function (g) { return g / 5 <= nSlots; }).map(function (g) {
      var s = g / 5;
      return { of: "flexe-client-" + g + "g", count: Math.floor(nSlots / s), slots: s, carriedKbps: adapted(g), mapping: "Lịch 5G (khối 66B, Idle insert/delete)",
        note: s + " khe × " + mbps(SLOT) + " = " + mbps(s * SLOT) + " = tốc độ client sau thích ứng (" + mbps(line66(g)) + " × 16383/16384 × 20460/20461)." };
    });
  }
  var POOL_NOTE = "Lịch 5G: khối OH chiếm 1/20 461 ngoài các khe";

  U({ id: "flexe-inst100", name: "100G FlexE Instance", kind: "flexe", level: 50, rateKbps: INST, frame: "flexe-inst100",
    standard: IA + " §6.3, §6.5, §6.8, §6.9; Hình 21, 25",
    summary: "100G FlexE instance ≈ " + gbps(INST) + ": lịch 20 khe 5G (" + mbps(SLOT) + "/khe) + khối overhead; cũng là nhóm nhỏ nhất dùng instance 100G (1 × 100GBASE-R; nhóm 1 × 50GBASE-R còn nhỏ hơn).",
    desc: "Đơn vị thông tin 100G gồm dung lượng mang client và overhead của nó (§5.1). 100GBASE-R mang 1 instance, 200GBASE-R mang 2, 400GBASE-R mang 4; nhóm 1 × 100GBASE-R có lịch đúng 20 khe. Khe trống (0x0000) và khe không khả dụng (0xFFFF) mang khối lỗi Ethernet. Thả client vào để thấy mỗi client chiếm số khe = tốc độ / 5G; client 25G có thể bị ràng buộc gom 5 khe liên tiếp nếu thiết bị chỉ hỗ trợ khe 25G (§6.8).",
    tribSlots: { n: 20, kbps: SLOT, size: "5G", note: POOL_NOTE },
    accepts: slotOpts(20) });

  [{ id: "flexe-grp-2x100", n: 2, lv: 60, phys: "2 × 100GBASE-R hoặc 1 × 200GBASE-R" },
   { id: "flexe-grp-4x100", n: 4, lv: 70, phys: "4 × 100GBASE-R, 2 × 200GBASE-R hoặc 1 × 400GBASE-R" }].forEach(function (o) {
    var nts = 20 * o.n;
    U({ id: o.id, name: "Nhóm FlexE " + o.n + " × 100G", kind: "flexe", level: o.lv, rateKbps: o.n * INST,
      standard: IA + " §6.1, §6.8 (Hình 18), §7.4 (Hình 29)",
      summary: "Nhóm " + o.n + " instance 100G (" + o.phys + "): lịch logic " + nts + " khe 5G ≈ " + gbps(nts * SLOT) + ".",
      desc: "Nhóm FlexE gộp (bond) " + o.n + " instance 100G thành một lịch logic dài " + nts + " khe; khe được đánh số 20 × số instance + khe 0–19 và phân 20 khối một lần cho sub-calendar từng instance (Hình 18). Một client có thể dùng khe ở nhiều instance nên client lớn hơn 100G (150G, 200G" + (o.n >= 4 ? ", 300G, 400G" : "") + ") đi được; ngược lại có thể chia kênh nhỏ (10G, 25G…) hoặc chạy dưới tốc độ PHY. Lab vẽ lịch phẳng " + nts + " khe (không vẽ ranh giới instance). Mọi PHY trong nhóm cùng tốc độ và cùng đồng hồ; trên thực tế thường 4–8 PHY (§6.1). Mang bởi " + o.phys + " – tốc độ instance như nhau nhờ pad P1/P2 trên 200G/400GBASE-R (§6.5).",
      tribSlots: { n: nts, kbps: SLOT, size: "5G", note: POOL_NOTE + " (" + o.n + " sub-calendar × 20)" },
      accepts: slotOpts(nts) });
  });

  // PHY mang nhóm FlexE – tốc độ dòng 66B tương đương (trước chuyển mã 256B/257B + RS-FEC của 200G/400G).
  var AM200 = 206250000 / 20480, AM400 = 412500000 / 20480;
  U({ id: "100gbase-r-flexe", name: "100GBASE-R (FlexE)", kind: "phy", level: 80, rateKbps: ETH100,
    standard: IA + " §5.2.1.5.2, §6.3; IEEE 802.3 Clause 82",
    summary: "PHY 100GBASE-R mang 1 instance 100G: dòng 66B 103,125 Gbit/s, trong đó 1/16 384 là alignment marker.",
    desc: "Instance chiếm mọi vị trí khối 66B giữa các alignment marker (AM) của PCS (§6.5). Các lớp dưới PCS (CAUI, RS-FEC tuỳ chọn, PMA, PMD) dùng nguyên như Ethernet (§5.2). Số hiệu PHY 1–254 (0, 255 dự trữ), trùng số hiệu instance (§6.1). Qua mạng truyền tải không biết FlexE (§8.1, FlexE-unaware), PHY này đi như 100GbE thường (vd. 100GbE → OPU4 GMP) – shim phải chịu lệch lớn (tới ~10 µs).",
    accepts: [{ of: "flexe-inst100", count: 1, overhead: { kbps: ETH100 / 16384, name: "Alignment marker PCS (1/16 384)", desc: "AM của 20 PCS lane chiếm 1/16K không gian dòng 66B, không dùng để mang khối FlexE (§6.3)." },
      note: "103 125 000 × 16383/16384 = " + mbps(INST) + " cho instance." }] });
  [{ id: "200gbase-r-flexe", n: 2, rate: 206250000, am: AM200, grp: "flexe-grp-2x100", phyNo: "1–126", lv: 81 },
   { id: "400gbase-r-flexe", n: 4, rate: 412500000, am: AM400, grp: "flexe-grp-4x100", phyNo: "1–62", lv: 82 }].forEach(function (o) {
    var pad = o.rate - o.am - o.n * INST;
    U({ id: o.id, name: (o.rate / 1031250) + "GBASE-R (FlexE)", kind: "phy", level: o.lv, rateKbps: o.rate,
      standard: IA + " §5.2.1.5.3, §6.4, §6.5 (Hình 13, 14, 15), §6.6 (Hình 16); IEEE 802.3 Clause 119",
      summary: "PHY " + (o.rate / 1031250) + "GBASE-R mang " + o.n + " instance 100G ghép xen từng khối 66B (dòng 66B tương đương " + gbps(o.rate) + ").",
      desc: o.n + " instance 100G ghép xen từng khối 66B, căn thẳng hàng: " + o.n + " khối OH đầu khung của các instance đi liền nhau rồi tới " + o.n + " × 20 × 1023 khối dữ liệu (§6.5, Hình 13). Mỗi instance thêm 2 khối pad (P1 = ordered set 0x4B, O code 0x5, Group number 0xF_FFFF – Hình 15; P2 = khối lỗi Ethernet) mỗi 163 830 khối để bù khác biệt AM 1/20K của " + (o.rate / 1031250) + "G so với 1/16K của 100G – nhờ vậy instance trên mọi loại PHY cùng tốc độ " + mbps(INST) + ". Sau shim, khối 66B được chuyển mã 256B/257B, xáo trộn, RS-FEC (tốc độ đường truyền thực cao hơn số ở đây). Số PHY " + o.phyNo + "; số instance = số PHY ở bit cao + chỉ số trong PHY ở bit thấp (Hình 26). Instance cao nhất của PHY có thể 'không trang bị' (Group number 0x00000; không có trong Map; các khối còn lại: IA §6.6 ghi là khối lỗi Ethernet (error control block), còn G.709 §17.12 NOTE 4 ghi là LF trong mọi khối trừ khối OH đầu – hai nguồn mô tả khác nhau) – vd. nhóm 1 × 400GBASE-R chỉ dùng 300G khi mạng truyền tải chỉ có 300G (§6.6). Instance đầu của PHY luôn trang bị vì mang RPF và kênh quản lý.",
      accepts: [{ of: o.grp, count: 1, overhead: { kbps: o.am + pad, name: "AM (1/20 480) + pad P1/P2 (2 khối / 163 832 mỗi instance)",
        desc: "AM ≈ " + mbps(o.am) + "; pad ≈ " + mbps(pad) + ". Dòng 66B × 20479/20480 × 163830/163832 / " + o.n + " = đúng 103 125 000 × 16383/16384 (§6.4, §6.5)." },
        note: o.n + " instance × " + mbps(INST) + " = " + mbps(o.n * INST) + "." }] });
  });

  // =====================================================================
  // ODUflex cho FlexE-aware (G.709 06/2020 §17.12; Bảng 7-2, 7-3, 7-9 dòng ODUflex(FlexE) → công thức 19-1a/20-1a)
  // family otn: là ODUflex của phân cấp OTN, ghép vào TS của OPU3/OPU4/OPUCn như các ODUflex khác.
  // =====================================================================
  var TS5G = 238 / 226 * 99532800 / 20;                    // ODTUCn.ts danh định (Bảng 7-7)
  var TS4 = 47.5 / 3824 * 239 / 227 * 99532800;            // ODTU4.ts danh định
  var TS3 = 119 / 3824 * 239 / 236 * 39813120;             // ODTU3.ts danh định
  function tsNeed(rate, ts) { return Math.ceil(rate * (1 + 100e-6 + 0.00006) / (ts * (1 - 20e-6))); }   // 19-1a / 20-1a
  [5, 10, 15, 20].forEach(function (n, i) {
    var odu = ETH100 * 240 / 238 * n / 20, opu = ETH100 * 240 / 239 * n / 20, sig = INST * n * 1024 / NBLK;
    var nC = tsNeed(odu, TS5G), n4 = tsNeed(odu, TS4), n3 = tsNeed(odu, TS3);
    var u = { id: "oduflex-flexe-aware-" + n, name: "ODUflex(FlexE-aware) n = " + n, kind: "odu", level: 46 + i, rateKbps: odu,
      standard: G709 + " §17.12 (Hình 17-20…17-22), Bảng 7-2/7-3/7-4, Bảng 7-9 + công thức 19-1a/20-1a, PT 0x1E (Bảng 15-9); " + IA + " §8.3",
      summary: "ODUflex mang " + n + " khe 5G của một nhóm FlexE không kết cuối (FlexE-aware): " + mbps(odu) + " = 103 125 000 × 240/238 × " + n + "/20; cần " + nC + " TS 5G (OPUCn), " + n4 + " TS 1,25G (OPU4)" + (n3 <= 32 ? ", " + n3 + " TS (OPU3)" : "") + ".",
      desc: "FlexE-aware (§17.12): mạng truyền tải biết đó là PHY FlexE nhưng không kết cuối nhóm. p instance 100G (1 ≤ p ≤ m ≤ 252) được 'crunch' – bỏ khối của " + "20 − ni khe không khả dụng ở cuối mỗi sub-calendar, ni ∈ {0, 5, 10, 15, 20} (bước 25G; IA yêu cầu mỗi instance trang bị có ≥ 1 khe khả dụng, instance không còn khe nào phải khai báo không trang bị và không thuộc p – nên trong p thực tế ni ≥ 5, IA §6.9 sau Hình 21, §8.3) – thêm ni − 1 khối đệm sau khối OH, rồi ghép xen thành tín hiệu FlexEp-n dài 1024 × n khối mỗi chu kỳ OH (n = n1 + … + np = " + n + "), ≈ " + mbps(sig) + ". Tín hiệu được xáo trộn (1 + x³⁹ + x⁵⁸) và ánh xạ BGMP vào OPUflex " + mbps(opu) + " (= 103 125 000 × 240/239 × " + n + "/20): khối chèn 16 byte theo sigma-delta tất định, C128 = 948/949, s = 3373/23384. PSI[3] = p, PSI[4…3+p] = n1…np; PT 0x1E. Instance không trang bị bị bỏ ở đầu vào và chèn lại ở đầu ra; khe không khả dụng được khôi phục bằng khối lỗi (IA §8.3). Số TS: OPUCn " + nC + " TS 5G (≈ " + vn(odu * 1.00016 / (TS5G * 0.99998), 3) + " theo 20-1a), OPU4 " + n4 + " TS (" + vn(odu * 1.00016 / (TS4 * 0.99998), 3) + "), OPU3 " + (n3 <= 32 ? n3 + " TS" : "không vừa (cần " + n3 + " > 32)") + " – Bảng 7-9 chỉ ghi 'Note' nên số này tính theo công thức. Tập (p, n) hỗ trợ là tuỳ nhà sản xuất (§17.12 NOTE 3)." +
        (n === 20 ? " n = 20 với p = 1 là một instance đầy đủ: lab cho mở ra để thấy instance (lịch 20 khe) bên trong; ODUflex vẫn lớn hơn instance vì thêm 19 khối đệm mỗi chu kỳ OH và khối chèn BGMP." : " Với n < 20 lab coi ODUflex này là khối nguyên (không mở được bên trong) – instance đã bị bỏ bớt khe.") };
    if (n === 20) {
      u.leafOk = true;
      u.accepts = [{ of: "flexe-inst100", count: 1, fit: "le", mapping: "BGMP 16 byte (PT 0x1E)",
        overhead: { kbps: odu - opu, name: "ODUflex OH + OPUflex OH (16 cột)", desc: "ODUflex/OPUflex = 239/238 như mọi ODUflex; OPUflex OH gồm PSI (PT 0x1E, p, n1…np), JC1–JC3 (Cm 14 bit + II/DI + CRC-8) và 4 byte RES." },
        note: "Instance " + mbps(INST) + " → FlexE1-20 (thêm 19 khối đệm mỗi 20 461 khối) " + mbps(sig) + " ≤ OPUflex " + mbps(opu) + "; phần dư là khối chèn 16 byte (4 hoặc 3 khối/khung theo C128)." }];
    }
    U(u, "otn");
  });

  // =====================================================================
  // Lab FlexE
  // =====================================================================
  L.push({
    id: "flexe", name: "Ghép FlexE (lịch 5G)", family: "flexe",
    roots: ["flexe-inst100", "flexe-grp-2x100", "flexe-grp-4x100", "100gbase-r-flexe", "200gbase-r-flexe", "400gbase-r-flexe"],
    palette: CLIENTS.map(function (g) { return "flexe-client-" + g + "g"; }),
    intro: "Chọn một instance 100G, một nhóm FlexE hoặc một PHY rồi thả client: mỗi client chiếm (tốc độ / 5G) khe lịch – 10G 2 khe, 25G 5 khe, 100G 20 khe. Khe trống vẫn được phát (khối lỗi Ethernet). Client 150G, 200G không vào được một instance 100G nhưng vào nhóm 2 × 100G; 300G, 400G cần nhóm 4 × 100G – lịch logic 20n khe trải qua nhiều instance/PHY. Chọn PHY 200G/400GBASE-R để thấy thêm AM và pad P1/P2. Qua OTN: unaware mang cả PHY như Ethernet; termination mang từng client trong ODUflex(IMP); aware bỏ khe không khả dụng rồi mang phần còn lại trong ODUflex(FlexE-aware) (thử ở lab OTN)."
  });
})();
