// Mảng Truyền dẫn – GD10 phần A: kịch bản MÔ PHỎNG ÁNH XẠ (AMP / BMP / GMP / GFP-F / IMP / chèn bit PDH).
// Schema: .claude/skills/transport-frame-spec/references/transport-schema.md, mục "Mô phỏng ánh xạ (GD10)".
// Nguồn (đọc nguyên văn):
//   ITU-T G.709/Y.1331 (06/2020): §17.2 + Hình 17-1…17-5 + Bảng 17-1…17-3 (AMP/BMP CBR2G5/10G/10G3), §17.4 (GFP vào OPUk),
//     §17.7 + công thức 17-1…17-6 (GMP CBR), §17.7.1 + Bảng 17-4 + §17.7.1.1 (1000BASE-X TTT → OPU0), §17.7.5 + Bảng 17-12
//     (100GBASE-R → OPU4, m = 640), §17.11 (IMP), §19.3/§19.4/§19.6 (ODTU2.ts, TSOH, GMP ODU → OPU2), Bảng 7-2/7-3/7-7,
//     Bảng 15-9 (PT), Annex D (D.1 sigma-delta D-10/D-11, D.2 công thức D-12…D-16, D.3 Bảng D.2 II/DI, Bảng D.1 tham số).
//   ITU-T G.7041/Y.1303 (08/2016): §6.1.1 (core header 4 byte), §6.1.2 (payload header), §6.2.1 (GFP Idle 4 byte),
//     §7.1.1–7.1.2 (Ethernet MAC: DA…FCS vào GFP, bỏ preamble/SFD/IPG).
//   ITU-T G.707/Y.1322 (01/2007): §10.6 (GFP vào C-n, C2 = 0x1B), §11.2 (VC-4-Xv), Appendix XIV (thứ tự rải byte vào VCG).
//   G.709 06/2020 §17.13, §17.13.2, Hình 17-23…17-25, Bảng 17-16…17-18 (BMP 400GBASE-R → OPUflex, căn 2 bit khối 66B, khối RC) – GD13.
//   ITU-T G.742 (11/88) §3–§5 (E2: 4 E1 ghép xen bit, chèn dương), G.703 (dung sai ±50/±30 ppm).
//   OIF FlexE IA 2.2 (OIF-FLEXE-02.2): §5.2.1.2 (thích ứng tốc độ client bằng chèn/xoá Idle theo IEEE 802.3 82.2.3.6), §6.7, §6.8.
// Quy ước toạ độ: row/col theo ĐÁNH SỐ CỦA CHUẨN (1-based; OTN: cột 15–16 là OPU OH, 17–3824 là OPU payload).
// File này KHÔNG đọc TMUX/TFRAMES lúc nạp (validator nạp theo thứ tự tên file) – mọi tốc độ ghi bằng biểu thức từ chuẩn.
window.TMAPS = window.TMAPS || [];

(function () {
  var T = window.TMAPS;
  var G709 = "ITU-T G.709/Y.1331 (06/2020)";

  // ---------- Tốc độ (kbit/s) theo Bảng 7-1…7-3 G.709 ----------
  var STM16 = 2488320;
  var OPU1 = 2488320, ODU1 = 239 / 238 * 2488320;                       // Bảng 7-3/7-2
  var OPU2 = 238 / 237 * 9953280, ODU2 = 239 / 237 * 9953280;
  var OPU2E = 238 / 237 * 10312500, ODU2E = 239 / 237 * 10312500;
  var ODU0 = 1244160, OPU0 = 238 / 239 * 1244160;
  var OPU4 = 238 / 227 * 99532800, ODU4 = 239 / 227 * 99532800;
  var BITS_ODU = 4 * 3824 * 8;                                           // bit / khung ODUk (cột 1–3824)
  function period(oduKbps) { return BITS_ODU * 1000 / oduKbps; }        // µs (bit / kbit/s = ms)
  // Biên số đơn vị client đến trong một khung khi client lệch ±pc ppm và server lệch ∓ps ppm (công thức 17-3/17-4).
  function lo(c, pc, ps) { return c * (1 - pc * 1e-6) / (1 + ps * 1e-6); }
  function hi(c, pc, ps) { return c * (1 + pc * 1e-6) / (1 - ps * 1e-6); }

  // JC của AMP/BMP (§17.2, Bảng 17-1/17-2/17-3) – vị trí theo Hình 17-1.
  var AMP_POS = {
    jc: { rows: [1, 2, 3], col: 16, bits: [7, 8], vote: "2/3", note: "3 byte JC giống nhau ở hàng 1–3 cột 16; chỉ bit 7–8 có nghĩa (bit 1–6 dự trữ). Đầu thu biểu quyết đa số 2/3 để một byte JC lỗi không làm trượt dữ liệu." },
    njo: { row: 4, col: 16, note: "Cơ hội chèn ÂM nằm trong OPU OH: bình thường là byte chèn; khi client nhanh hơn thì mang thêm 1 byte dữ liệu." },
    pjo: { row: 4, col: 17, note: "Cơ hội chèn DƯƠNG là byte đầu tiên của hàng 4 vùng tải: bình thường mang dữ liệu; khi client chậm hơn thì thành byte chèn." }
  };
  var AMP_TABLE = [
    { jc: "00", njo: "chèn", pjo: "dữ liệu", meaning: "Không bù: khung mang đúng số byte danh định (NJO bỏ, PJO là dữ liệu)." },
    { jc: "01", njo: "dữ liệu", pjo: "dữ liệu", meaning: "Chèn âm: client nhanh hơn → NJO cũng mang dữ liệu, khung mang thêm 1 byte." },
    { jc: "10", njo: "chèn", pjo: "dữ liệu", meaning: "Bộ ghép không bao giờ phát mã này; nếu thu được (do lỗi bit) thì hiểu như 00 (Bảng 17-3)." },
    { jc: "11", njo: "chèn", pjo: "chèn", meaning: "Chèn dương: client chậm hơn → PJO cũng là byte chèn, khung mang bớt 1 byte." }
  ];
  var BMP_TABLE = [
    { jc: "00", njo: "chèn", pjo: "dữ liệu", meaning: "BMP luôn phát 00: đồng hồ OPU lấy từ client nên không bao giờ cần bù (Bảng 17-2)." }
  ];

  // GMP – JC1…JC6 (§17.7, Annex D.3, Bảng D.2) – vị trí như khung opu4-100ge.
  var GMP_JC = {
    cm: { rows: [1, 2, 3], col: 16, note: "JC1 = C1–C8, JC2 = C9–C14 + II + DI, JC3 = CRC-8 trên JC1–JC2." },
    cnd: { rows: [1, 2, 3], col: 15, note: "JC4–JC5 = ΣCnD (D1–D10) + JC6 CRC-5; báo phần lẻ dưới một từ m bit để đầu thu khôi phục đồng hồ client mịn." }
  };
  var GMP_IIDI = [
    { change: "0", ii: 0, di: 0, invert: "UUUUUUUUUUUUUU", meaning: "Cm giữ nguyên: gửi lại đúng giá trị cũ." },
    { change: "+1", ii: 1, di: 0, invert: "IUIUIUIUIUIUIU", meaning: "Tăng 1: đảo các bit lẻ C1, C3, … C13 của Cm cũ." },
    { change: "−1", ii: 0, di: 1, invert: "UIUIUIUIUIUIUI", meaning: "Giảm 1: đảo các bit chẵn C2, C4, … C14 của Cm cũ." },
    { change: "+2", ii: 1, di: 0, invert: "UIIUUIIUUIIUUI", meaning: "Tăng 2: đảo theo mẫu Bảng D.2." },
    { change: "−2", ii: 0, di: 1, invert: "IUUIIUUIIUUIIU", meaning: "Giảm 2: đảo theo mẫu Bảng D.2." },
    { change: "> ±2", ii: 1, di: 1, invert: "giá trị mới", meaning: "Đổi lớn: C1–C14 chứa thẳng giá trị Cm mới, CRC-8 (JC3) xác nhận." }
  ];
  var SIGMA = "Vị trí j (1…P) mang dữ liệu nếu (j × Cm) mod P < Cm, ngược lại là chèn (Annex D, D-23/D-24) – bộ cộng tràn reset mỗi đầu khung, cộng Cm mỗi vị trí, tràn ≥ P thì trừ P và đánh dấu 'dữ liệu'.";

  // =====================================================================
  // 1. AMP – STM-16 → OPU1 (§17.2.1)
  // =====================================================================
  (function () {
    var per = period(ODU1), c = STM16 * per / 1000 / 8;     // = 15 232 byte/khung (STM-16 = OPU1 payload danh định)
    T.push({
      id: "amp-stm16-opu1", method: "AMP", order: 10,
      name: "STM-16 → OPU1 (AMP)", client: "stm-16", server: "opu1", frames: ["opu1-amp", "otu1"],
      standard: G709 + " §17.2, §17.2.1, Hình 17-1, Hình 17-2, Bảng 17-1/17-3; Bảng 7-3 (OPU1 ±20 ppm)",
      summary: "Ánh xạ không đồng bộ: OPU1 chạy đồng hồ riêng, mỗi khung có đúng 1 cơ hội chèn âm (NJO) và 1 cơ hội chèn dương (PJO) để hấp thụ lệch tần số tới ±65 ppm.",
      steps: [
        "STM-16 (2 488 320 kbit/s) đến bộ đệm; OPU1 phát theo đồng hồ nội riêng, độc lập với client.",
        "Mỗi khung OPU1 (≈ 48,971 µs) có 4 × 3808 = 15 232 byte tải. Ở tốc độ danh định đúng 15 232 byte STM-16 đến trong một khung: PJO mang dữ liệu, NJO bỏ trống, JC = 00.",
        "Client nhanh hơn → bộ đệm đầy dần; khi vượt ngưỡng, khung đó phát JC = 01 và NJO (hàng 4 cột 16) mang thêm 1 byte → 15 233 byte.",
        "Client chậm hơn → bộ đệm vơi; khung đó phát JC = 11 và PJO (hàng 4 cột 17) thành byte chèn → 15 231 byte.",
        "Đầu thu đọc 3 byte JC, biểu quyết 2/3 để biết NJO/PJO là dữ liệu hay chèn, rồi tái tạo đồng hồ STM-16 từ nhịp byte nhận được."
      ],
      clientKbps: STM16, serverPayloadKbps: OPU1,
      ppm: { client: 45, server: 20, note: "AMP chịu tổng lệch 65 ppm: client ±45 ppm khi OPU ±20 ppm (§17.2 NOTE 2). 1 byte/khung = 1/15 232 ≈ 65,65 ppm." },
      frame: { rows: 4, cols: 3808, cellBits: 8, firstCol: 17, ohCols: [15, 16], periodUs: per },
      oh: [{ row: 4, col: 15, abbr: "PSI", note: "PSI[0] = PT 0x02 (CBR không đồng bộ, Bảng 15-9)." }, { rows: [1, 3], col: 15, abbr: "RES", note: "Dự trữ." }],
      fixedStuff: [],
      just: { njo: AMP_POS.njo, pjo: AMP_POS.pjo, jc: AMP_POS.jc, table: AMP_TABLE },
      budget: [ { kind: "data", cells: 15231, note: "Byte dữ liệu cố định (mọi ô tải trừ PJO)." }, { kind: "pjo", cells: 1, note: "PJO hàng 4 cột 17." } ],
      sim: { entity: "byte", entityBits: 8, perFrame: { nom: c, min: lo(c, 45, 20), max: hi(c, 45, 20) },
        carry: { fixed: 15231, min: 15231, max: 15233 }, locked: false },
      note: "T = 4 × 3824 × 8 / ODU1 = 122 368 / (239/238 × 2 488 320) ms ≈ 48,971 µs. Byte client/khung = 2 488 320 × T / 8 = 15 232 (đúng bằng 4 × 3808 vì OPU1 payload danh định = STM-16). Biên: 15 232 × (1 − 45e-6)/(1 + 20e-6) ≈ 15 231,01 và 15 232 × (1 + 45e-6)/(1 − 20e-6) ≈ 15 232,99 – vừa khít khả năng 15 231…15 233 byte/khung, nên AMP chỉ chịu được ±65 ppm tổng."
    });
  })();

  // =====================================================================
  // 2. BMP – STM-16 → OPU1 (cùng khung, JC luôn 00)
  // =====================================================================
  (function () {
    var per = period(ODU1), c = STM16 * per / 1000 / 8;
    T.push({
      id: "bmp-stm16-opu1", method: "BMP", order: 20,
      name: "STM-16 → OPU1 (BMP)", client: "stm-16", server: "opu1", frames: ["opu1-amp", "otu1"],
      standard: G709 + " §17.2 (Bit-synchronous mapping), §17.2.1, Bảng 17-2",
      summary: "Ánh xạ đồng bộ bit: đồng hồ OPU1 được LẤY TỪ client, nên số byte mỗi khung luôn đúng 15 232 – không bao giờ chèn bù; so sánh trực tiếp với AMP cùng khung.",
      steps: [
        "Bộ ghép khôi phục đồng hồ STM-16 và nhân lên thành đồng hồ OPU1/ODU1/OTU1 (tỉ lệ cố định 239/238, 255/238).",
        "Vì OPU1 chạy theo client, mỗi khung luôn đến đúng 15 232 byte STM-16: PJO mang dữ liệu, NJO là chèn, JC cố định 00.",
        "Client lệch +15 ppm thì cả khung OTU1 cũng nhanh lên 15 ppm – lệch được 'đẩy' sang lớp OTN chứ không bù trong khung.",
        "Vì vậy client chỉ được lệch ±20 ppm (bằng dung sai OPU1); mất tín hiệu client thì OPU1 chuyển sang đồng hồ nội mà không gãy pha khung."
      ],
      clientKbps: STM16, serverPayloadKbps: OPU1,
      ppm: { client: 20, server: 20, locked: true, note: "BMP: server bám theo client (cùng ppm); client tối đa ±20 ppm (§17.2)." },
      frame: { rows: 4, cols: 3808, cellBits: 8, firstCol: 17, ohCols: [15, 16], periodUs: per },
      oh: [{ row: 4, col: 15, abbr: "PSI", note: "PSI[0] = PT 0x03 (CBR đồng bộ bit, Bảng 15-9)." }, { rows: [1, 3], col: 15, abbr: "RES", note: "Dự trữ." }],
      fixedStuff: [],
      just: { njo: AMP_POS.njo, pjo: AMP_POS.pjo, jc: AMP_POS.jc, fixedJc: "00", table: BMP_TABLE },
      budget: [ { kind: "data", cells: 15231, note: "Byte dữ liệu." }, { kind: "pjo", cells: 1, note: "PJO luôn là dữ liệu." } ],
      sim: { entity: "byte", entityBits: 8, perFrame: { nom: c, min: c, max: c }, carry: { fixed: 15232, min: 15232, max: 15232 }, locked: true },
      note: "Số byte/khung = 15 232 với mọi ppm vì T khung co giãn theo client: T = 15 232 × 8 / (2 488 320 × (1 + ppm)). Chu kỳ danh định ≈ 48,971 µs, đổi ±20 ppm theo client."
    });
  })();

  // =====================================================================
  // 3. BMP – 10GBASE-R → OPU2e (§17.2.4) – có 64 byte fixed stuff
  // =====================================================================
  (function () {
    var per = period(ODU2E), c = 10312500 * per / 1000 / 8;   // = 15 168
    T.push({
      id: "bmp-10gbase-r-opu2e", method: "BMP", order: 30,
      name: "10GBASE-R → OPU2e (BMP)", client: "10gbe", server: "opu2e", frames: ["otu2e"],
      standard: G709 + " §17.2.4, Hình 17-5; §17.2 NOTE 3; Bảng 7-3 (OPU2e = 238/237 × 10 312 500 kbit/s ±100 ppm); Bảng 15-9 (PT 0x03)",
      summary: "10GBASE-R 10,3125 Gbit/s đi trong suốt (cả khối 64B/66B) bằng BMP vào OPU2e ép xung; 16 cột fixed stuff 1905–1920 và JC luôn 00.",
      steps: [
        "Luồng 10GBASE-R (10 312 500 kbit/s ±100 ppm) được lấy đồng hồ để tạo OPU2e = 238/237 × 10 312 500 kbit/s.",
        "Mỗi khung (≈ 11,767 µs) có 15 232 ô tải, trong đó 64 byte fixed stuff ở cột 1905–1920 (4 hàng × 16 cột) không bao giờ mang dữ liệu.",
        "15 232 − 64 = 15 168 byte còn lại mang đúng 15 168 byte client mỗi khung: NJO luôn chèn, PJO luôn dữ liệu, JC = 00.",
        "Client lệch tới ±100 ppm thì OPU2e/OTU2e cũng lệch theo – vì thế OPU2e có dung sai ±100 ppm và không dùng được AMP (§17.2 NOTE 3)."
      ],
      clientKbps: 10312500, serverPayloadKbps: OPU2E,
      ppm: { client: 100, server: 100, locked: true, note: "OPU2e ±100 ppm bám client." },
      frame: { rows: 4, cols: 3808, cellBits: 8, firstCol: 17, ohCols: [15, 16], periodUs: per },
      oh: [{ row: 4, col: 15, abbr: "PSI", note: "PSI[0] = PT 0x03." }, { rows: [1, 3], col: 15, abbr: "RES", note: "Dự trữ." }],
      fixedStuff: [{ rows: [1, 4], cols: [1905, 1920], note: "64 byte FS (Hình 17-5): 16 cột × 4 hàng giữa vùng tải – đưa dung lượng hiệu dụng về đúng 15 168 byte = tốc độ 10GBASE-R." }],
      just: { njo: AMP_POS.njo, pjo: AMP_POS.pjo, jc: AMP_POS.jc, fixedJc: "00", table: BMP_TABLE },
      budget: [ { kind: "data", cells: 15167, note: "Byte dữ liệu (trừ PJO và FS)." }, { kind: "pjo", cells: 1, note: "PJO luôn dữ liệu." }, { kind: "fs", cells: 64, note: "Cột 1905–1920." } ],
      sim: { entity: "byte", entityBits: 8, perFrame: { nom: c, min: c, max: c }, carry: { fixed: 15168, min: 15168, max: 15168 }, locked: true },
      note: "T = 122 368 / (239/237 × 10 312 500) ms ≈ 11,767 µs; byte client/khung = 10 312 500 × T / 8 = 15 232 × 237/238 = 15 168 = 15 232 − 64 FS. So với STM-64 → OPU2 (§17.2.2, cùng vị trí FS 1905–1920): ở đó OPU2 có đồng hồ riêng và AMP bù ±1 byte/khung."
    });
  })();

  // =====================================================================
  // 3b. BMP – 400GBASE-R → OPUflex (§17.13, §17.13.2) – không JC/NJO/PJO, khối 66B căn 2 bit (GD13)
  // =====================================================================
  (function () {
    var X = 412500000, Y = 425000000, Z = 32;                  // Bảng 17-18 (400GBASE-R)
    var ODUF = 239 / 238 * X, per = period(ODUF), P = 15232;   // OPUflex tải = X (Bảng 7-3: OPUflex CBR = tốc độ client)
    var bpf = P * 8 / 66;                                       // khối 66B / khung ≈ 1846,30
    var ref = 528 / 544 * 20479 / 20480 * Y;                     // OTN reference signal (§17.13.2)
    T.push({
      id: "bmp-400gbase-r-opuflex", method: "BMP", order: 35,
      name: "400GBASE-R → OPUflex (BMP, khối 66B)", client: "400gbe", server: "oduflex-bmp-400g", frames: ["opuc-ts", "otuc"],
      standard: G709 + " §17.13 (BMP + căn 2 bit khối 66B), Hình 17-23, Bảng 17-16, 17-17; §17.13.2, Bảng 17-18 (X/Y/Z), Hình 17-24, 17-25; Bảng 7-3 (OPUflex CBR); Bảng 15-9 (PT 0x32)",
      summary: "400GbE vào ODUflex bằng BMP: đồng hồ OPUflex lấy từ client, OPU OH KHÔNG có JC/NJO/PJO (chỉ PSI + 7 byte RES). Trước đó bộ ánh xạ bỏ RS-FEC + AM, chuyển mã 256B/257B → 64B/66B và chèn 32 khối RC; dòng 66B xáo trộn đặt liền vào 4 × 3808 byte, mỗi khối bắt đầu ở bit 1/3/5/7 của byte.",
      steps: [
        "Ở giao diện PMA, 400GBASE-R là 16 lane × 26 562 500 = Y = 425 000 000 kbit/s (mã 256B/257B + RS(544,514) + AM). Bộ ánh xạ sửa lỗi rồi BỎ parity FEC và AM, chuyển mã 257B → 4 khối 66B: còn 528/544 × 20479/20480 × Y ≈ 412 479 858 kbit/s (tín hiệu tham chiếu OTN).",
        "Chèn Z = 32 khối RC (16 RC0 + 16 RC1) sau mỗi 32 × 20 479 khối client – lấp đúng chỗ AM vừa bỏ – được X = 528/544 × Y = 412 500 000 kbit/s ±100 ppm (Bảng 17-18).",
        "Xáo trộn 1 + x³⁹ + x⁵⁸ (như IEEE 802.3 §49.2.6; 2 bit sync header không xáo trộn) để chống nhận nhầm ranh giới khối 66B và chống khối 66B (kể cả sau xáo trộn OTU) giả mẫu FAS của OTU/ODU (§17.13).",
        "Đồng hồ OPUflex lấy từ client: OPUflex = X, ODUflex = 239/238 × X. Mỗi khung (≈ 0,2954 µs) nhận đúng 15 232 byte = 1846,30 khối 66B – không cần bù, nên OPU OH không có JC, NJO, PJO.",
        "Khối 66B đặt liền nhau, vắt qua ranh giới byte và khung; vì 66 = 8 × 8 + 2, bit đầu sync header luôn rơi vào bit 1, 3, 5 hoặc 7 ('căn 2 bit', Hình 17-23). Sau 33 khung (60 928 khối) mẫu ranh giới lặp lại.",
        "Đầu thu: tìm lại ranh giới khối 66B, giải xáo trộn, bỏ khối RC, rồi (ngoài OTN) chuyển mã lại 257B, chèn AM + FEC trước khi phát ra PMA. Mất client → chuỗi LF 0x4B (Bảng 17-17)."
      ],
      clientKbps: X, serverPayloadKbps: X,
      ppm: { client: 100, server: 100, locked: true, note: "BMP: OPUflex bám client (cùng ppm), giới hạn ±100 ppm theo Bảng 17-16/7-3; không có cơ chế bù nên không có 'tổng lệch' như AMP." },
      frame: { rows: 4, cols: 3808, cellBits: 8, firstCol: 17, ohCols: [15, 16], periodUs: per,
        note: "Lưới byte của vùng tải OPUflex (4 × 3808). 15 232 × 8 / 66 không nguyên nên KHÔNG vẽ ô 66B: ranh giới khối 66B (block66) phủ lên lưới byte – khối k (k = 0, 1, …) bắt đầu ở bit 66k của luồng tải, tức byte ⌊66k/8⌋ + 1, bit (66k mod 8) + 1." },
      oh: [
        { row: 4, col: 15, abbr: "PSI", note: "PSI[0] = PT 0x32 (400GBASE-R vào OPUflex, Bảng 15-9); PSI[2] bit 1 = CSF; PSI[1], 7 bit còn lại của PSI[2], PSI[3…255] = RES (Hình 17-23)." },
        { rows: [1, 3], col: 15, abbr: "RES", note: "Dự trữ (§17.13)." },
        { rows: [1, 4], col: 16, abbr: "RES", note: "Dự trữ – nơi AMP/BMP CBR2G5/10G đặt JC + NJO; ở §17.13 không có JC/NJO (7 byte RES tổng cộng ở cột 15–16)." }
      ],
      fixedStuff: [],
      // Không có `just`: BMP §17.13 "does not generate any justification control signals" (schema mục 5: BMP không just khi ppm.locked + block66).
      block66: {
        bits: 66, align: 2, startBits: [1, 3, 5, 7], perFrame: bpf, cycleFrames: 33, cycleBlocks: 33 * bpf,
        scrambler: "1 + x³⁹ + x⁵⁸ tự đồng bộ (IEEE 802.3 §49.2.6); 2 bit sync header đi qua không xáo trộn",
        rule: "66 = 8 × 8 + 2: mỗi khối dịch 2 bit so với biên byte → bit đầu sync header ở bit 1, 3, 5, 7 (bit 1 = MSB). Một khung = 121 856 bit = 1846 khối + 20 bit; mẫu lặp sau 33 khung = 4 021 248 bit = 60 928 khối.",
        rc: { Z: Z, rc0: Z / 2, rc1: Z / 2, everyBlocks: Z * 20479, perFrame: bpf / 20480, periodUs: Z * 20480 * 66 * 1000 / X,
          rc0Hex: "SH 10 + 00 FF FF 00 00 00 FF FF", rc1Hex: "SH 10 + 00 00 00 00 FF FF FF FF",
          note: "Khối RC: sync header 10 (khối điều khiển), byte vị trí 'block type' = 0x00 (không trùng loại khối nào, giữ khoảng cách Hamming 4). 32 khối RC liền nhau (16 RC0 rồi 16 RC1, Hình 17-25) sau mỗi 655 328 khối client → tỉ lệ 1/20 480 ≈ 0,090 khối RC/khung, một cụm ≈ 104,86 µs ≈ 354,96 khung." },
        chain: [
          { label: "400GBASE-R ở PMA (16 lane × 26 562 500; 256B/257B + RS-FEC + AM)", kbps: Y },
          { label: "Bỏ parity RS(544,514) + chuyển mã 257B → 4 × 66B (514/544 × 264/257 = 528/544)", kbps: Y * 528 / 544, ratio: [528, 544] },
          { label: "Bỏ alignment marker (× 20479/20480) = tín hiệu tham chiếu OTN", kbps: ref, ratio: [20479, 20480] },
          { label: "Chèn Z = 32 khối RC mỗi 32 × 20 479 khối (× 20480/20479) = X", kbps: X, ratio: [20480, 20479] },
          { label: "ODUflex = 239/238 × OPUflex (OPUflex tải = X)", kbps: ODUF, ratio: [239, 238] }
        ]
      },
      budget: [ { kind: "data", cells: P, note: "Toàn bộ 15 232 byte tải mang dòng khối 66B (≈ 1846,30 khối, khối RC tính như khối client). Không có PJO, NJO hay fixed stuff." } ],
      sim: { entity: "byte", entityBits: 8, perFrame: { nom: P, min: P, max: P }, carry: { fixed: P, min: P, max: P }, locked: true },
      note: "T = 122 368 / (239/238 × 412 500 000) ms ≈ 0,295408 µs; byte client/khung = 412 500 000 × T / 8 = 15 232 (vì OPUflex = X); ±100 ppm chỉ co giãn T (0,295379…0,295438 µs), số byte/khung luôn 15 232. serverPayloadKbps = OPUflex = X; TMUX không có unit OPUflex riêng nên server là oduflex-bmp-400g (rate = 239/238 × X ≈ 414 233 193,28). Chuỗi tốc độ: Y × 528/544 = 412 500 000 (bỏ FEC + chuyển mã); × 20479/20480 ≈ 412 479 858,40 (bỏ AM); × 20480/20479 = 412 500 000 (chèn RC). Khối 66B/khung = 15 232 × 8 / 66 ≈ 1846,303; RC/khung = 1846,303 / 20 480 ≈ 0,0902. ODUflex chiếm 80 TS 5G của OPUCn (Bảng 7-9; 20-1a: ⌈79,05⌉). So với bmp-10gbase-r-opu2e: ở đó còn JC/NJO/PJO (JC cố định 00) và 64 byte FS; ở §17.13 OH chỉ còn PSI + RES."
    });
  })();

  // =====================================================================
  // 4. GMP – 1000BASE-X (TTT) → OPU0 (§17.7.1, §17.7.1.1)
  // =====================================================================
  (function () {
    var per = period(ODU0), f = 1250000 * 15 / 16, c = f * per / 1000 / 8;   // m = 8 → Cm tính theo byte
    var P = 15232;
    T.push({
      id: "gmp-1gbe-opu0", method: "GMP", order: 40,
      name: "1000BASE-X (TTT) → OPU0 (GMP)", client: "1gbe", server: "opu0", frames: [],
      standard: G709 + " §17.7, công thức 17-1…17-6; §17.7.1, Bảng 17-4; §17.7.1.1 (TTT); Annex D; Bảng D.1 (OPU0: m = 8, P = 15 232)",
      summary: "GbE được chuyển mã TTT (8B/10B → GFP-T 64B/65B) còn 15/16 × 1,25 Gbit/s rồi GMP rải Cm ≈ 14 407 byte dữ liệu đều khắp 15 232 byte tải của OPU0.",
      steps: [
        "Cổng GbE (1000BASE-X) chạy 1,25 Gbit/s. Trước khi vào OTN, tín hiệu được nén mã (chuyển mã TTT) còn 1 171 875 kbit/s, tức 15/16, mà không mất dữ liệu hay định thời.",
        "Mỗi khung OPU0 dài khoảng 98,35 µs và có 15 232 byte tải. Trong thời gian đó client gửi tới khoảng 14 407 byte, nên khung mang 14 407 (đôi khi 14 408) byte dữ liệu. Khoảng 825 byte còn lại là byte chèn.",
        "Số byte dữ liệu của mỗi khung (gọi là Cm) được báo trước trong overhead (OH) của khung đi trước. Nhờ vậy đầu thu biết trước khung sau có bao nhiêu byte dữ liệu.",
        "Byte chèn không dồn vào một chỗ mà được rải đều khắp khung, trung bình cứ khoảng 18 byte lại có 1 byte chèn. Khác với AMP, ở đây không có cột chèn riêng.",
        "Khi đồng hồ client lệch (tới ±100 ppm), Cm chỉ nhích trong khoảng 14 405…14 410. Đầu thu theo dõi Cm để dựng lại đúng tốc độ client."
      ],
      clientKbps: f, serverPayloadKbps: OPU0,
      ppm: { client: 100, server: 20, note: "Bảng 17-4: 1000BASE-X (sau TTT) ±100 ppm; OPU0 ±20 ppm (Bảng 7-3)." },
      frame: { rows: 4, cols: 3808, cellBits: 8, firstCol: 17, ohCols: [15, 16], periodUs: per },
      oh: [{ row: 4, col: 15, abbr: "PSI", note: "PSI[0] = PT 0x07 (Ethernet PCS trong suốt: 1000BASE-X vào OPU0)." }, { row: 4, col: 16, abbr: "RES", note: "Dự trữ." }],
      fixedStuff: [],
      gmp: { m: 8, M: 1, n: 8, cnBits: 14, P: P, word: "1 byte", jc: GMP_JC, cndUsed: false,
        cmNom: c, cmMin: lo(c, 100, 20), cmMax: hi(c, 100, 20), CmMin: Math.floor(lo(c, 100, 20)), CmMax: Math.ceil(hi(c, 100, 20)),
        appliesTo: "khung kế tiếp", iiDi: GMP_IIDI,
        formula: "cm = f_client × T / m = (15/16 × 1 250 000) × T / 8 byte; T = 122 368 / 1 244 160 ms; Cm,min = floor(cm × (1 − 100e-6)/(1 + 20e-6)), Cm,max = ceiling(cm × (1 + 100e-6)/(1 − 20e-6)). Biên ≈ 14 405,58 … 14 409,04 → Cm 14 405…14 410. Cm = 14 bit trong JC1–JC2 (+ II/DI), JC3 = CRC-8. Công thức 17-6 bản 06/2020 in 'Cm,max = ceiling(cm,min)' – lỗi in; dùng ceiling(cm,max) như công thức 19-7 (§19.6) và Annex D.3. OPU0 chỉ có m = 8 nên CnD (n = 8) luôn 0 (Bảng D.1 'C8D: N/A'), JC4–JC6 = 0.",
        sigmaDelta: SIGMA },
      budget: [ { kind: "gmp", cells: P, note: "Toàn bộ 15 232 byte là vị trí GMP (dữ liệu hoặc chèn theo Cm)." } ],
      sim: { entity: "byte", entityBits: 8, perFrame: { nom: c, min: lo(c, 100, 20), max: hi(c, 100, 20) }, carry: { fixed: 0, min: 0, max: P }, locked: false },
      note: "Cách tính nhanh: byte client mỗi khung = 1 171 875 kbit/s × 98,354 µs / 8 ≈ 14 407,3 byte; phần lẻ 0,3 nghĩa là khoảng 3 khung trong 10 mang 14 408 byte. Byte chèn = 15 232 − 14 407 ≈ 825 (cứ 15 232 / 825 ≈ 18 byte có 1 chèn). Công thức chuẩn và ghi chú chi tiết (lỗi in công thức 17-6, CnD) ở mục 'Công thức' của khung chi tiết."
    });
  })();

  // =====================================================================
  // 5. GMP – 100GBASE-R → OPU4 (§17.7.5) – từ 80 byte, 8 cột FS
  // =====================================================================
  (function () {
    var per = period(ODU4), bits = 103125000 * per / 1000, c = bits / 640, P = 190;
    T.push({
      id: "gmp-100gbase-r-opu4", method: "GMP", order: 50,
      name: "100GBASE-R → OPU4 (GMP)", client: "100gbe", server: "opu4", frames: ["opu4-100ge", "otu4"],
      standard: G709 + " §17.7.5, Hình 17-15, Bảng 17-12 (m = 640, n = 8, CnD có); Annex D; Bảng D.1 (OPU4: P = 190, C8D 0…79)",
      summary: "100GbE vào OPU4 bằng GMP với 'từ' 80 byte: mỗi khung ≈ 188 trên 190 khối 80 byte mang dữ liệu, 2 khối là chèn; 8 cột cuối là fixed stuff.",
      steps: [
        "Cổng 100GbE gửi luồng khối 64B/66B ở 103,125 Gbit/s. Luồng được đưa nguyên vẹn vào OTN, không chuyển mã.",
        "Vùng tải OPU4 có 15 200 byte dùng được mỗi khung (32 byte cuối là byte chèn cố định). GMP chia chúng thành 190 'từ', mỗi từ 80 byte.",
        "Mỗi khung dài khoảng 1,17 µs, trong thời gian đó client gửi tới khoảng 188,15 từ. Vì vậy khung mang 188 từ dữ liệu (thỉnh thoảng 189), các từ còn lại là chèn.",
        "Số từ dữ liệu (Cm) của khung sau được báo trong overhead (OH) của khung này. Kèm theo là phần lẻ dưới 1 từ (0…79 byte), giúp đầu thu dựng lại đồng hồ client thật mịn.",
        "Khoảng 2 từ chèn được rải đều trong khung. Client lệch tới ±100 ppm thì Cm vẫn chỉ là 188 hoặc 189, nên không cần cột chèn riêng như AMP."
      ],
      clientKbps: 103125000, serverPayloadKbps: OPU4,
      ppm: { client: 100, server: 20, note: "Bảng 17-12: 100GBASE-R ±100 ppm; OPU4 ±20 ppm." },
      frame: { rows: 4, cols: 3808, cellBits: 8, firstCol: 17, ohCols: [15, 16], periodUs: per },
      oh: [{ row: 4, col: 15, abbr: "PSI", note: "PSI[0] = PT 0x07 (100GBASE-R vào OPU4)." }, { row: 4, col: 16, abbr: "RES", note: "Dự trữ (OMFI khi PT 21)." }],
      fixedStuff: [{ rows: [1, 4], cols: [3817, 3824], note: "32 byte FS (Hình 17-15): vùng GMP chỉ còn 4 × 3800 = 15 200 byte = 190 × 80." }],
      gmp: { m: 640, M: 80, n: 8, cnBits: 14, P: P, word: "80 byte liên tiếp", jc: GMP_JC, cndUsed: true, cndRange: [0, 79],
        cmNom: c, cmMin: lo(c, 100, 20), cmMax: hi(c, 100, 20), CmMin: Math.floor(lo(c, 100, 20)), CmMax: Math.ceil(hi(c, 100, 20)),
        c8Nom: bits / 8, appliesTo: "khung kế tiếp", iiDi: GMP_IIDI,
        formula: "cm = 103 125 000 × T / 640; T = 122 368 / (239/227 × 99 532 800) ms ≈ 1,16770 µs; c8 = 103 125 000 × T / 8 ≈ 15 052,32 byte; C8D = C8 − 80 × Cm (ΣC8D ở JC4–JC6). Biên ±100/±20 ppm ≈ 188,131 … 188,177 → Cm,min = floor = 188, Cm,max = ceiling = 189. Dung lượng GMP tối đa 190 × 640 / T ≈ 104 136 740 kbit/s. Bảng D.1 ghi B_server OPU4 = 8 × 15 200; ở đây T tính trực tiếp từ chu kỳ khung ODU4 (Bảng 7-4) nên không phụ thuộc cách hiểu đó.",
        sigmaDelta: "Từ 80 byte thứ j (1…190) là dữ liệu nếu (j × Cm) mod 190 < Cm (Annex D, D-23)." },
      budget: [ { kind: "gmp", cells: 15200, note: "190 từ GMP × 80 byte." }, { kind: "fs", cells: 32, note: "Cột 3817–3824." } ],
      sim: { entity: "từ 80 byte", entityBits: 640, perFrame: { nom: c, min: lo(c, 100, 20), max: hi(c, 100, 20) }, carry: { fixed: 0, min: 0, max: P }, locked: false },
      note: "Cách tính nhanh: bit client mỗi khung = 103 125 000 kbit/s × 1,1677 µs ≈ 120 419 bit = 15 052 byte; chia 80 byte/từ ≈ 188,15 từ (khớp mô tả khung opu4-100ge). 190 − 188 = 2 từ chèn mỗi khung; 0,15 từ lẻ (≈ 12 byte) được báo riêng để đầu thu dựng đồng hồ. Công thức chuẩn và biên ppm chi tiết ở mục 'Công thức' của khung chi tiết."
    });
  })();

  // =====================================================================
  // 6. GMP – ODU0 → ODTU2.1 → 1 TS của OPU2 (§19.6) – cấp ghép ODU
  // =====================================================================
  (function () {
    var per = period(ODU2), mf = 8 * per, c = ODU0 * mf / 1000 / 8, P = 15232;
    T.push({
      id: "gmp-odu0-odtu21", method: "GMP", order: 60,
      name: "ODU0 → ODTU2.1 → OPU2 TS (GMP)", client: "odu0", server: "opu2", frames: ["opu2-ts", "otu2"],
      standard: G709 + " §19.3 (ODTU2.ts 476 cột × 32 hàng), §19.3.5, §19.4 (TSOH), §19.6 (GMP ODUj → ODTUk.ts), Bảng 7-7 (ODTU2.1 = 1 249 409,620 kbit/s ±20 ppm), Annex D Bảng D.1",
      summary: "Ghép ODU0 vào một TS (khe nhánh) 1,25G của OPU2: GMP chạy theo ĐA KHUNG 8 (một TS = 476 cột × 4 hàng × 8 khung = 15 232 byte), Cm ≈ 15 168 byte.",
      steps: [
        "OPU2 được chia thành 8 khe (TS) 1,25G, xen kẽ theo cột: TS1 là các cột 17, 25, 33… ODU0 (1,244 Gbit/s) chỉ cần 1 TS.",
        "Một TS chỉ có 1904 byte trong mỗi khung OPU2, nên GMP gom 8 khung liền nhau (một đa khung, khoảng 97,5 µs) thành 15 232 byte để tính.",
        "Trong mỗi đa khung, ODU0 gửi tới khoảng 15 168 byte dữ liệu. 64 byte còn lại là byte chèn, rải đều trong TS.",
        "Số byte dữ liệu (Cm) của đa khung sau được ghi trong overhead (OH) riêng của TS (TSOH, cột 15–16). Với TS1, TSOH nằm ở khung đầu tiên của đa khung.",
        "ODU0 và OPU2 đều chỉ lệch tối đa ±20 ppm, nên Cm gần như cố định ở 15 167…15 169. Cơ chế vẫn giống hệt GMP cho client CBR."
      ],
      clientKbps: ODU0, serverPayloadKbps: OPU2 / 8,
      ppm: { client: 20, server: 20, note: "ODU0 ±20 ppm (Bảng 7-2), ODTU2.1 payload ±20 ppm (Bảng 7-7)." },
      frame: { rows: 4, cols: 476, cellBits: 8, firstCol: 17, colStep: 8, ohCols: [15, 16], multiframe: 8, periodUs: mf,
        note: "Lưới = 1 TS (476 cột, mỗi cột cách 8 cột OPU2: 17, 25, …, 3817) × 4 hàng, lặp qua 8 khung OPU2 → 15 232 vị trí; periodUs là chu kỳ đa khung 8." },
      oh: [{ row: 4, col: 15, abbr: "PSI", note: "PSI[0] = PT 0x21; PSI[2] = MSI của TS1 (ODTU2.ts, cổng nhánh)." }, { row: 4, col: 16, abbr: "RES", note: "Với GMP là dự trữ (NJO chỉ dùng cho ODTU12 AMP)." }],
      fixedStuff: [],
      gmp: { m: 8, M: 1, n: 8, cnBits: 14, P: P, word: "1 byte (m = 8 × ts, ts = 1)", jc: { cm: { rows: [1, 2, 3], col: 16, frameOfMultiframe: 1, note: "JC1–JC3 trong TSOH của TS1 – khung có MFAS bit 6–8 = 000." }, cnd: { rows: [1, 2, 3], col: 15, frameOfMultiframe: 1, note: "JC4–JC6 (ΣC8D, CRC-5)." } },
        cndUsed: false, cndRange: [0, 0],
        cmNom: c, cmMin: lo(c, 20, 20), cmMax: hi(c, 20, 20), CmMin: Math.floor(lo(c, 20, 20)), CmMax: Math.ceil(hi(c, 20, 20)),
        appliesTo: "đa khung kế tiếp", iiDi: GMP_IIDI,
        formula: "cm = ODU0 × T_mf / 8; T_mf = 8 × 122 368 / (239/237 × 9 953 280) ms ≈ 97,531 µs; P = 476 × 4 × 8 = 15 232. cm = 15 168,000 vì ODU0 / ODTU2.1 = 1 244 160 / 1 249 409,62 = 15 168/15 232. Biên ±40 ppm ≈ 15 167,39 … 15 168,61 → Cm 15 167…15 169. JC1–JC6 ở TSOH (hàng 1–3, cột 15–16) của khung có MFAS bit 6–8 = TS − 1 (TS1 → 000). m = n = 8 nên C8D không dùng (Bảng D.1 'ODTUk.1: N/A', §19.4.3.2): JC4–JC6 có mặt nhưng C8D luôn 0.",
        sigmaDelta: "Byte j (1…15 232, đếm theo hàng rồi theo khung trong đa khung) là dữ liệu nếu (j × Cm) mod 15 232 < Cm." },
      budget: [ { kind: "gmp", cells: 15232 / 8, note: "Mỗi khung OPU2: 476 × 4 = 1904 byte của TS1; × 8 khung = 15 232 vị trí GMP." } ],
      sim: { entity: "byte", entityBits: 8, perFrame: { nom: c, min: lo(c, 20, 20), max: hi(c, 20, 20) }, carry: { fixed: 0, min: 0, max: P }, locked: false },
      note: "Cách tính nhanh: byte ODU0 mỗi đa khung = 1 244 160 kbit/s × 97,531 µs / 8 = 15 168 byte, đúng bằng 15 232 − 64. Lưới vẽ MỘT khung OPU2 của TS1 (4 × 476 = 1904 ô); nhân 8 cho cả đa khung. Công thức chuẩn và biên ppm ở mục 'Công thức' của khung chi tiết."
    });
  })();

  // =====================================================================
  // 7. GFP-F – Ethernet 10G (khung MAC) → OPU2 (§17.4)
  // =====================================================================
  var GFP_ETH = { coreHdr: 4, payloadHdr: 4, extHdr: 0, fcs: 0, fcsOpt: 4, idleBytes: 4, minEth: 64, maxEth: 1518, maxEthTagged: 1522,
    preambleSfd: 8, ifg: 12, type: "0x0001 (PTI 000, PFI 0, EXI 0000, UPI 0x01 – Ethernet frame-mapped); PFI = 1 → 0x1001 có pFCS",
    idleHex: "00 00 00 00 trước XOR (PLI = 0, cHEC = 0); trên dây là B6 AB 31 E0 sau khi XOR core header (G.7041 §6.1.1, §6.2.1)",
    rule: "Byte GFP mỗi khung Ethernet = L + 8 (core 4 + payload header 4, + pFCS 4 nếu PFI = 1); trên dây Ethernet khung chiếm L + 20 (preamble/SFD 8 + IFG 12). Chỗ trống lấp bằng GFP Idle 4 byte." };
  (function () {
    var per = period(ODU2), P = 15232;
    T.push({
      id: "gfpf-10ge-opu2", method: "GFP-F", order: 70,
      name: "Ethernet 10G (khung MAC) → OPU2 (GFP-F)", client: "eth-10g-gfpf", server: "opu2", frames: ["otu2"],
      standard: G709 + " §17.4, Bảng 15-9 (PT 0x05); ITU-T G.7041 (08/2016) §6.1, §6.2.1, §7.1",
      summary: "Chỉ chở khung MAC (bỏ preamble/SFD/IFG): mỗi khung Ethernet thành một khung GFP-F, khoảng trống lấp bằng GFP Idle 4 byte; luồng byte GFP đổ thẳng vào 15 232 byte tải OPU2, khung GFP được phép vắt qua ranh giới khung OPU.",
      steps: [
        "Khung Ethernet đến (64…1518 byte): bỏ preamble + SFD (8 byte) và khoảng nghỉ IFG (≥ 12 byte) – chúng chỉ có nghĩa trên dây.",
        "Thêm core header 4 byte (PLI + cHEC) và payload header 4 byte (Type 0x0001 + tHEC) → khung GFP dài L + 8 byte.",
        "Không có khung chờ thì phát GFP Idle (4 byte, PLI = 0) để luồng GFP luôn đúng bằng dung lượng OPU2 ≈ 9 995 277 kbit/s.",
        "Luồng byte GFP lấp tuần tự 4 × 3808 byte mỗi khung OPU2 (≈ 12,191 µs); khung GFP dài cứ vắt sang khung OPU sau – đầu thu tìm ranh giới nhờ cHEC và PLI.",
        "Ở 100% tải khung 1518 byte, GFP chiếm 1526/1538 × 10 Gbit/s ≈ 99,27% OPU2; khung 64 byte chỉ ≈ 85,75% (IFG/preamble bị bỏ nhiều hơn) → phần còn lại là Idle."
      ],
      clientKbps: 10000000, serverPayloadKbps: OPU2,
      ppm: { client: 100, server: 20, note: "Khác CBR: lệch tần số không cần bù vì Idle co giãn tự nhiên; chỉ cần tải GFP ≤ dung lượng (bộ đệm khung + điều khiển luồng/policer ở cổng)." },
      frame: { rows: 4, cols: 3808, cellBits: 8, firstCol: 17, ohCols: [15, 16], periodUs: per },
      oh: [{ row: 4, col: 15, abbr: "PSI", note: "PSI[0] = PT 0x05 (GFP, Bảng 15-9)." }, { rows: [1, 3], col: 15, abbr: "RES", note: "Dự trữ (§17.4: 7 byte RES; §17.4.1 PT 0x09 mượn 7 byte này làm tải mở rộng)." }, { rows: [1, 4], col: 16, abbr: "RES", note: "Dự trữ." }],
      fixedStuff: [],
      gfp: Object.assign({}, GFP_ETH, {
        capacityBytesPerFrame: P,
        fullLoad: { L1518: 10000000 * 1526 / 1538 / OPU2, L64: 10000000 * 72 / 84 / OPU2 },
        bytesPerFrameFullLoad: { L1518: 10000000 * 1526 / 1538 * per / 1000 / 8, L64: 10000000 * 72 / 84 * per / 1000 / 8 } }),
      budget: [ { kind: "gfp", cells: P, note: "Toàn bộ 15 232 byte là luồng byte GFP (khung dữ liệu hoặc Idle)." } ],
      sim: { entity: "byte", entityBits: 8, perFrame: { nom: 10000000 * 1526 / 1538 * per / 1000 / 8, min: 0, max: 10000000 * 1526 / 1538 * per / 1000 / 8 }, carry: { fixed: P, min: P, max: P }, locked: false, packet: true },
      note: "T = 122 368 / (239/237 × 9 953 280) ms ≈ 12,1914 µs; dung lượng 15 232 byte/khung. 100% tải: khung 1518 → 10 000 000 × 1526/1538 × T / 8 ≈ 15 120,3 byte GFP/khung (≈ 99,27%, còn ≈ 112 byte = 28 Idle); khung 64 → 72/84 ≈ 85,75%. So sánh: 10GBASE-R CBR (10 312 500) không vừa OPU2 – phải dùng OPU2e (BMP) hoặc GFP-F như ở đây (bỏ mã 64B/66B, chỉ giữ khung MAC)."
    });
  })();

  // =====================================================================
  // 8. GFP-F – GbE (khung MAC) → VC-4-7v (VCAT, G.707 §10.6, §11.2)
  // =====================================================================
  (function () {
    var P = 7 * 2340, cap = 7 * 149760;
    T.push({
      id: "gfpf-1ge-vc4-7v", method: "GFP-F", order: 80,
      name: "Ethernet 1G (khung MAC) → VC-4-7v (GFP-F)", client: "eth-1g-gfpf", server: "vc-4-7v", frames: ["vcat-h4", "vc-4"],
      standard: "ITU-T G.707 (01/2007) §10.6 (GFP vào C-n, C2 = 0x1B), §11.2 (VC-4-Xv), Appendix XIV (thứ tự rải byte); ITU-T G.7041 (08/2016) §6.2.1, §7.1",
      summary: "Luồng GFP-F của GbE rải từng byte lần lượt qua 7 VC-4 thành viên (C-4-7v = 9 hàng × 1820 cột mỗi 125 µs); Idle lấp phần dư ≈ 5% ở tải đầy khung 1518.",
      steps: [
        "Khung Ethernet → khung GFP-F (L + 8 byte) như với OPU; không có khung thì phát GFP Idle.",
        "VC-4-7v có 7 × 2340 = 16 380 byte tải mỗi 125 µs (1 048 320 kbit/s) – lớn hơn 1 Gbit/s một chút.",
        "Byte GFP thứ 1 vào VC-4 #1 cột 1 hàng 1, byte 2 vào VC-4 #2 cột 1 hàng 1 … byte 8 quay lại VC-4 #1 cột 2 (Appendix XIV) – lưới 1820 cột ở đây là 7 thành viên xen từng cột.",
        "Mỗi thành viên có POH riêng (C2 = 0x1B GFP; H4 mang MFI/SQ cho VCAT) và đi đường riêng; đầu thu bù trễ vi sai rồi ghép lại theo SQ.",
        "Tải đầy khung 1518: 1 000 000 × 1526/1538 ≈ 992 198 kbit/s ≈ 94,65% VCG → ≈ 877 byte Idle mỗi 125 µs; khung 64: ≈ 81,8%."
      ],
      clientKbps: 1000000, serverPayloadKbps: cap,
      ppm: { client: 100, server: 4.6, note: "SDH: đồng hồ mạng ±4,6 ppm (G.813) – CHƯA XÁC MINH trong nguồn đã đọc; với GFP-F không ảnh hưởng vì Idle co giãn." },
      frame: { rows: 9, cols: 1820, cellBits: 8, firstCol: 1, periodUs: 125, interleave: 7,
        note: "C-4-7v: cột c thuộc thành viên VC-4 #((c − 1) mod 7) + 1, cột thứ ⌈c/7⌉ của C-4 thành viên đó (Appendix XIV). POH (cột 1 mỗi VC-4) không vẽ." },
      oh: [],
      fixedStuff: [],
      gfp: Object.assign({}, GFP_ETH, {
        capacityBytesPerFrame: P,
        fullLoad: { L1518: 1000000 * 1526 / 1538 / cap, L64: 1000000 * 72 / 84 / cap },
        bytesPerFrameFullLoad: { L1518: 1000000 * 1526 / 1538 * 125 / 1000 / 8, L64: 1000000 * 72 / 84 * 125 / 1000 / 8 } }),
      budget: [ { kind: "gfp", cells: P, note: "7 × 9 × 260 byte C-4 của 7 thành viên." } ],
      sim: { entity: "byte", entityBits: 8, perFrame: { nom: 1000000 * 1526 / 1538 * 125 / 1000 / 8, min: 0, max: 1000000 * 1526 / 1538 * 125 / 1000 / 8 }, carry: { fixed: P, min: P, max: P }, locked: false, packet: true },
      note: "Dung lượng 7 × 149 760 = 1 048 320 kbit/s = 16 380 byte/125 µs. Tải đầy: 1518 B → 1 000 000 × 1526/1538 × 125 µs / 8 ≈ 15 503,1 byte GFP (dư ≈ 876,9 byte Idle ≈ 219 Idle 4 byte); 64 B → 72/84 → 13 392,9 byte. VC-4-7v cũng là ví dụ 'carriedKbps' trong TMUX (1 000 000 × 1526/1538)."
    });
  })();

  // =====================================================================
  // 9. IMP – FlexE client 25G → 5 khe lịch của FlexE instance 100G (chèn/xoá Idle)
  // =====================================================================
  (function () {
    var inst = 103125000 * 16383 / 16384, per = 20461 * 66 * 1000 / inst;         // µs – một chu kỳ khối OH
    var c = 25781250 * per / 1000 / 66, P = 5 * 1023;
    var opf = 5 * 5156250, perO = 15232 * 8 * 1000 / opf;
    T.push({
      id: "imp-flexe25-inst100", method: "IMP", order: 90,
      name: "FlexE client 25G → 5 khe 5G (chèn/xoá Idle)", client: "flexe-client-25g", server: "flexe-inst100", frames: ["flexe-inst100"],
      standard: "OIF FlexE IA 2.2 (OIF-FLEXE-02.2) §5.2.1.2, §6.7, §6.8; " + G709 + " §17.11 (IMP – cùng cơ chế cho ODUflex), IEEE 802.3 cl. 82.2.3.6",
      summary: "Không có byte chèn hay Cm: client 64B/66B được khớp tốc độ bằng cách XOÁ hoặc CHÈN nguyên khối Idle giữa các gói, để vừa đúng 5 × 1023 vị trí khối của nó trong mỗi chu kỳ overhead FlexE.",
      steps: [
        "FlexE client 25G là luồng khối 66B ở 25 781 250 kbit/s (66/64 × 25 Gbit/s, ±100 ppm): gói Ethernet + các khối Idle giữa gói.",
        "Instance 100G chia lịch 20 khe 5G; client này được cấp 5 khe → mỗi chu kỳ khối OH (≈ 13,096 µs) có đúng 5 × 1023 = 5115 vị trí khối.",
        "Danh định client đến ≈ 5115,56 khối/chu kỳ (nhiều hơn chỗ ≈ 110 ppm, vì PHY mất chỗ cho alignment marker 1/16384 và khối OH 1/20461) → bộ ghép XOÁ khối Idle, trung bình ≈ 0,56 khối mỗi chu kỳ.",
        "Client chậm (−100 ppm) mà PHY nhanh (+100 ppm) thì thiếu khối → bộ ghép CHÈN khối Idle. Chỉ xoá/chèn được Idle nằm GIỮA hai gói – gói không bao giờ bị cắt.",
        "Đầu thu đọc lịch, gom khối của client và lại chèn/xoá Idle theo đồng hồ cổng ra; G.709 §17.11 (IMP) làm đúng việc này khi đưa client vào ODUflex(IMP)."
      ],
      clientKbps: 25781250, serverPayloadKbps: inst * 20460 / 20461 / 4,
      ppm: { client: 100, server: 100, note: "Client và PHY FlexE đều ±100 ppm (IA §6.7)." },
      frame: { rows: 5, cols: 1023, cellBits: 66, firstCol: 1, periodUs: per,
        note: "Hàng = 5 khe lịch của client (trong 20 khe của instance), cột = vòng lịch 1…1023 giữa hai khối OH; khối client lấp theo thứ tự lịch (vòng 1: khe a, b, c, d, e; vòng 2 …). Khối OH và 15 khe của client khác không vẽ." },
      oh: [{ abbr: "OH", note: "1 khối overhead FlexE đứng trước mỗi 1023 vòng lịch (không thuộc client)." }],
      fixedStuff: [],
      imp: { block: 66, idle: "chèn/xoá khối Idle (IEEE 802.3 cl. 82.2.3.6) và/hoặc xoá ordered set (82.2.3.9)",
        unit: "một khối 66B toàn Idle (8 ký tự /I/) – CHƯA XÁC MINH (không có IEEE 802.3 trong nguồn)",
        where: "chỉ ở khoảng trống giữa hai gói (IPG); gói liên tục dài thì phải đợi tới IPG kế tiếp – bộ đệm FIFO nhỏ",
        nominalDeletePerFrame: c - P, nominalPpm: (c / P - 1) * 1e6,
        otn: { id: "oduflex-imp-5", opuflexKbps: opf, oduflexKbps: opf * 239 / 238,
          frameUs: perO, blocksPerFrame: 15232 * 8 / 66, pt: "0x1D",
          note: "G.709 §17.11: OPUflex(IMP,s) = s × 5 156 250 kbit/s ±100 ppm (s = 5 → 25 781 250, đúng bằng client); ODUflex = × 239/238 ≈ 25 889 574,58. Khung OPUflex 4 × 3808 byte ≈ 4,7265 µs mang 15 232 × 8 / 66 ≈ 1846,30 khối 66B (khối vắt qua ranh giới khung, bit đầu sync header ở bit 1/3/5/7 của byte). Danh định không cần chèn/xoá; biên ±200 ppm ≈ ±0,37 khối/khung." } },
      budget: [ { kind: "block", cells: P, note: "5 khe × 1023 vòng = 5115 vị trí khối 66B của client mỗi chu kỳ OH." } ],
      sim: { entity: "khối 66B", entityBits: 66, perFrame: { nom: c, min: lo(c, 100, 100), max: hi(c, 100, 100) }, carry: { fixed: P, min: P, max: P }, locked: false, idleAdjust: true },
      note: "Instance = 103 125 000 × 16383/16384 kbit/s (bỏ AM); chu kỳ OH T = 20 461 × 66 / instance ≈ 13,0958 µs. Khối client/chu kỳ = 25 781 250 × T / 66 = 20 461/4 × 16384/16383 ≈ 5115,562 → phải xoá ≈ 0,562 khối Idle/chu kỳ (≈ 109,9 ppm, IA §6.7 'khoảng 0,011%'). Biên ±100/±100 ppm: ≈ 5114,54 … 5116,59 → có lúc phải chèn. serverPayloadKbps = dung lượng 5 khe = instance × 20460/20461 / 4."
    });
  })();

  // =====================================================================
  // 10. PDH-bit – E1 → E2 (G.742) – chèn dương từng bit
  // =====================================================================
  (function () {
    var per = 848 * 1000 / 8448, c = 2048 * per / 1000;      // bit E1 / khung E2
    T.push({
      id: "pdh-e1-e2", method: "PDH-bit", order: 100,
      name: "E1 → E2 (chèn bit dương, G.742)", client: "e1", server: "e2", frames: ["e2", "e1"],
      standard: "ITU-T G.742 (11/88) §2 (E2 ±30 ppm), §3 Bảng 1, §5; G.703 (E1 ±50 ppm)",
      summary: "Tổ tiên của AMP: mỗi khung E2 848 bit cho mỗi E1 205 bit cố định + 1 bit cơ hội chèn; tốc độ khung hơi nhanh hơn E1 nên khoảng 42% số khung phải chèn (bỏ trống) bit đó.",
      steps: [
        "Bốn E1 có đồng hồ riêng được ghép xen từng bit vào khung E2 848 bit (≈ 100,38 µs), 4 hàng × 212 bit.",
        "Mỗi nhánh có 205 bit cố định + 1 bit cơ hội chèn (hàng 4, bit 5 cho nhánh 1) mỗi khung; nhưng E1 chỉ đến ≈ 205,576 bit/khung.",
        "Vì vậy bộ ghép phải 'chờ': khoảng 42,4% số khung, bit cơ hội chèn là bit chèn vô nghĩa (Cj = 111); còn lại nó mang dữ liệu (Cj = 000).",
        "3 bit Cj của nhánh nằm ở hàng 2, 3, 4 (bit 1 cho nhánh 1); đầu thu biểu quyết đa số 2/3.",
        "Chỉ có chèn DƯƠNG (khác AMP OTN có cả NJO): tốc độ chèn tối đa 1 bit/khung ≈ 9,96 kbit/s mỗi nhánh."
      ],
      clientKbps: 2048, serverPayloadKbps: 8448 * 206 / 848,
      ppm: { client: 50, server: 30, note: "E1 ±50 ppm, E2 ±30 ppm (G.703)." },
      frame: { rows: 4, cols: 212, cellBits: 1, firstCol: 1, periodUs: per,
        note: "Cả khung E2 (4 nhánh xen bit). Bit nhánh 1: hàng 1 bit 13, 17, …; hàng 2–3 bit 5, 9, …; hàng 4 bit 9, 13, …; cơ hội chèn nhánh 1 = hàng 4 bit 5." },
      oh: [{ row: 1, cols: [1, 10], abbr: "FAS", note: "1111010000" }, { row: 1, col: 11, abbr: "A", note: "Cảnh báo xa." }, { row: 1, col: 12, abbr: "N", note: "Quốc gia." }],
      fixedStuff: [],
      just: { pjo: { row: 4, col: 5, tributary: 1, note: "Bit cơ hội chèn của nhánh 1 (nhánh j: hàng 4 bit 4 + j)." },
        jc: { rows: [2, 3, 4], col: 1, bits: [1], vote: "2/3", tributary: 1, note: "Cj1 của nhánh 1 ở bit 1 hàng 2–4 (nhánh j ở bit j)." },
        table: [
          { jc: "000", pjo: "dữ liệu", meaning: "Không chèn: bit cơ hội mang dữ liệu E1 → 206 bit nhánh trong khung." },
          { jc: "111", pjo: "chèn", meaning: "Chèn dương: bit cơ hội là bit vô nghĩa, đầu thu bỏ → 205 bit." }
        ] },
      budget: [ { kind: "oh", cells: 12, note: "FAS 10 + A + N." }, { kind: "jc", cells: 12, note: "Cj: 3 hàng × 4 nhánh." },
        { kind: "data", cells: 4 * 205, note: "205 bit cố định × 4 nhánh." }, { kind: "pjo", cells: 4, note: "1 bit cơ hội chèn × 4 nhánh." } ],
      sim: { entity: "bit", entityBits: 1, perTributary: true, perFrame: { nom: c, min: lo(c, 50, 30), max: hi(c, 50, 30) }, carry: { fixed: 205, min: 205, max: 206 }, locked: false },
      note: "T = 848 / 8448 ms ≈ 100,379 µs; bit E1/khung = 2048 × T ≈ 205,5758 → tỉ số chèn = 206 − 205,5758 ≈ 0,424 (G.742). Biên ≈ 205,5593 … 205,5922 luôn trong 205…206. serverPayloadKbps = 8448 × 206/848 ≈ 2052,1 kbit/s: dung lượng tối đa cho một nhánh."
    });
  })();
})();
