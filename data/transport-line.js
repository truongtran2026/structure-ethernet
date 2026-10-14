// Mảng Truyền dẫn – GD12: giao diện đường truyền coherent OIF 400ZR / 800ZR – "từ khung tới bước sóng".
// Schema: .claude/skills/transport-frame-spec/references/transport-schema.md (mục 6 "Giao diện đường truyền (GD12)")
// Nguồn (đọc nguyên văn + ảnh hình render từ PDF):
//   OIF-400ZR-02.0 (IA 400ZR 2.0, 11/2022): §5–6 (giao diện host Bảng 2), §8.1 (425 000 000 kbit/s), §8.5–8.6 (khung,
//     Hình 8/9/10), §8.6.1 (AM Hình 11/12, Bảng 4), §8.6.2 (PAD), §8.6.3 (OH Hình 14/15), §8.7 (MFAS), §8.8 (GMP,
//     Bảng 5/6/7, Hình 17), §8.9.2 (STAT Hình 18), §9 (khung → SC-FEC Hình 21–25), §10 (C-FEC: staircase (255,239) +
//     Hamming (128,119), pad 6 × 119, scrambler, CI), §11 (DP-16QAM Bảng 10), §12 (khung DSP, FAW/TS/pilot),
//     §12.5 (Hình 39, Bảng 16 tốc độ từng bước), §13 (mã ứng dụng Bảng 17, kênh Bảng 18), §15 (lưới Bảng 41–44).
//   OIF-800ZR-01.0 (IA 800ZR 1.0): §3 (client Bảng 1), §4.2 (gán client → 100G ZR instance Bảng 2), §4.3 (khung 100G ZR
//     Hình 5, AM Hình 6/Bảng 3, BOH Hình 7, MAP Hình 8, PT Bảng 4, MSI Bảng 5, STAT/CSTAT Bảng 6/7), §4.4 (ghép xen 128 bit
//     Hình 9), §4.5 (GMP; Phụ lục A Bảng 31), §5 (CRC + pad Hình 15, scrambler, OFEC §5.6–5.8, DP-16QAM Bảng 14,
//     khung DSP §5.10 Hình 22), §5.12 (Bảng 20 tốc độ), §6 (Bảng 21–22), §8 (lưới 150 GHz Bảng 30).
//   ITU-T G.709.1 (03/2024): khung FlexO §8.1, FlexO-x §8.4 (x × 64 hàng × 10 280 cột), BOH §9.2 (byte 1–40), PT Bảng 9-1.
// CHƯA XÁC MINH (không có văn bản G.709.3 / G.709.6): cấu trúc FlexO-4-DSH (G.709.3) mà 400ZR IA §8.5 nói "cùng vùng OH";
//   FlexO-8e-DO-16QAM, mẫu AM FA1/FA2 §9.1, CRC/pad §12.4.1, OFEC §12.4.5 của G.709.6 – data chỉ ghi lại những gì 800ZR IA
//   chép ra; FEC/điều chế của OTUCn/FlexO qua transponder (cột so sánh "flexo").
// Nạp độc lập (không đọc TMUX/TFRAMES của file khác lúc nạp): validator nạp các file theo tên (transport-line.js nạp TRƯỚC
//   transport-otn.js nơi có 100gbe/200gbe/400gbe). Lab "otn" (transport-otn.js) dùng zr400/zr800/800gbe ở đây.
window.TFRAMES = window.TFRAMES || {};
window.TMUX = window.TMUX || {};
window.TLABS = window.TLABS || [];

(function () {
  var F = window.TFRAMES, M = window.TMUX;
  var IA4 = "OIF-400ZR-02.0 (IA 400ZR, 11/2022)", IA8 = "OIF-800ZR-01.0 (IA 800ZR)", STD1 = "ITU-T G.709.1 (03/2024)";
  var CAT = "Giao diện đường truyền (ZR)";

  function R(id, abbr, name, kind, rect, desc, extra) {
    var o = { id: id, name: name, abbr: abbr, kind: kind,
      rect: { r: rect[0], c: rect[1], h: rect[2], w: rect[3], step: rect[4] || 1 }, desc: desc };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function vn(x, d) { return x.toLocaleString("vi-VN", { maximumFractionDigits: d === undefined ? 3 : d }).replace(/\./g, " "); }
  function gbps(x) { return vn(x / 1e6, 3) + " Gbit/s"; }
  function bf(name, abbr, bits, desc) { return { name: name, abbr: abbr, bits: bits, desc: desc }; }

  // =====================================================================
  // Tốc độ (kbit/s) – mọi số khớp IA 400ZR Bảng 16 / Hình 39 và IA 800ZR Bảng 20 / Bảng 31 (tính lại bằng node, sai < 0,001 kbit/s)
  // =====================================================================
  var LINE400 = 156250 * 383 * 8;                         // = 478 750 000 kbit/s ("156.25 Mbit/s × 383 × 8", Hình 39)
  var Z4 = {
    pma: 425000000,                                       // 400GBASE-R ở PMA (§8.1; = lineKbps của 400gbe)
    noFec: 425000000 * 514 / 544,                         // 401 562 500 – bỏ RS(544,514)
    client: 425000000 * 514 / 544 * 20479 / 20480,       // 401 542 892,456 – bỏ AM (Bảng 5, 6: fclient)
    frame: LINE400 * 28 / 29 * 119 / 128 * 5140 / 5488    // 402 489 753,310 – khung 400ZR không parity (Bảng 6: fserver)
  };
  Z4.payload = Z4.frame * 511 / 512;                      // 401 703 640,510 – tải khung (Bảng 6: fp,server)
  Z4.scfec = Z4.frame * 5485 / 5140;                      // 429 505 116,129 – + CRC32/MBAS + parity staircase (10 970 cột)
  Z4.pad = Z4.scfec * 5488 / 5485;                        // 429 740 032,328 – + 6 × 119 bit pad
  Z4.ham = Z4.pad * 128 / 119;                            // 462 241 379,310 – Hamming (128,119)
  Z4.faw = Z4.ham * 176204 / 175616;                      // 463 789 062,5   – + FAW/TS/RES (588 ký hiệu)
  Z4.line = Z4.faw * 32 / 31;                             // 478 750 000     – + pilot (1/32)
  Z4.gbd = Z4.line / 8 / 1e6;                             // 59,84375 GBd (8 bit / ký hiệu DP-16QAM)
  var PER4 = 256 * 10970 * 1000 / Z4.scfec;               // ≈ 6,539 µs (đa khung GMP 4 khung = 26,154 µs, Bảng 6 Tserver)

  var Z8 = {
    client100: 100000000 * 257 / 256 * 16383 / 16384,    // 100 384 497,643 – 100GBASE-R sau bỏ FEC + AM (Bảng 31)
    client100s: 100000000 * 257 / 256 * 20479 / 20480,   // 100 385 723,114 – mỗi dòng 100G của 200/400/800GE (Bảng 31)
    frame: 2 * Z4.frame                                   // 804 979 506,619 = 8 × 100 622 438,327 (Bảng 20, Bảng 31 fserver)
  };
  Z8.payload = Z8.frame * 511 / 512;                      // 803 407 281,021 = 8 × 100 425 910,128 (Bảng 31 fp,server)
  Z8.crc = Z8.frame * 1193472 / 1192480;                  // 805 649 152,794 – + CRC32 mỗi 4 hàng + 64 bit pad (Hình 15)
  Z8.ofec = Z8.crc * 128 / 111;                           // 929 036 860,880 – OFEC 3552 → 4096 bit
  Z8.faw = Z8.ofec * 513 / 512;                           // 930 851 385,999 – + FAW/TS/RES (172 368 / 172 032)
  Z8.line = Z8.faw * 64 / 63;                             // 945 626 804,824 – + pilot (175 104 / 172 368)
  Z8.gbd = Z8.line / 8 / 1e6;                             // 118,203350603 GBd
  var PER8 = 514 * 80 * 128 * 1000 / Z8.frame;            // ≈ 6,539 µs (= 512 × 10 280 bit)
  var PMA800 = 8 * Z8.client100s * 544 / 514 * 20480 / 20479;   // = 850 000 000 (suy ngược từ fclient, xem unit 800gbe)

  // Mã AM 400ZR (Bảng 4, thứ tự MSB-first): {CM0,CM1,CM2,UP0,CM3,CM4,CM5,UP1,UM0,UM1,UM2,UP2,UM3,UM4,UM5}
  var AM4 = [
    "59 52 64 6D A6 AD 9B 9B 80 8E CF 64 7F 71 30", "59 52 64 20 A6 AD 9B E6 5A 7B 7E 19 A5 84 81",
    "59 52 64 62 A6 AD 9B 7F 7C CF 6A 80 83 30 95", "59 52 64 5A A6 AD 9B 21 61 01 0B DE 9E FE F4",
    "59 52 64 87 A6 AD 9B 98 54 8A 4F 67 AB 75 B0", "59 52 64 4F A6 AD 9B 72 48 F2 8B 8D B7 0D 74",
    "59 52 64 BC A6 AD 9B 77 42 39 85 88 BD C6 7A", "59 52 64 44 A6 AD 9B 4C 6B 6E DA B3 94 91 25",
    "59 52 64 06 A6 AD 9B F9 87 CE AE 06 78 31 51", "59 52 64 D6 A6 AD 9B 45 8E 23 3C BA 71 DC C3",
    "59 52 64 5F A6 AD 9B 20 A9 D7 1B DF 56 28 E4", "59 52 64 36 A6 AD 9B 8E 44 66 1C 71 BB 99 E3",
    "59 52 64 18 A6 AD 9B DA 45 6F A9 25 BA 90 56", "59 52 64 28 A6 AD 9B 33 8C E9 C3 CC 73 16 3C",
    "59 52 64 0B A6 AD 9B 8D 53 DF 65 72 AC 20 9A", "59 52 64 2D A6 AD 9B 6A 65 5D 9E 95 9A A2 61"
  ];

  // =====================================================================
  // Khung 400ZR – 256 hàng × 10 970 bit, ô = 10 bit (đơn vị ghép xen 10b của AM/OH, Hình 11/14) → 256 × 1097 ô
  // =====================================================================
  (function () {
    // OH instance #1, 40 byte = 320 bit (Hình 15): byte 1 MFAS, 2 STAT, 3–6 GID/PID hoặc JC, 7–10 MAP, 11–12 CRC, 13–26 FCC, 27–28 OSMC, 29–40 RES.
    function ohFields(b34, b56) {
      return [
        bf("Multi-Frame Alignment Signal", "MFAS", 8, "Đếm 0x00–0xFF, tăng mỗi khung 400ZR (đa khung 256, theo G.709.1 §9.2.1); bit 7–8 = 00/01/10/11 đánh số 4 khung của đa khung GMP (§8.7, §8.8)."),
        bf("Remote PHY Fault", "RPF", 1, "STAT bit 1: = 1 khi đầu thu 400ZR phía xa phát hiện lỗi (báo ngược, theo G.709.1 §9.2.5.1) (§8.9.2, Hình 18)."),
        bf("Reserved", "RES", 4, "STAT bit 2–5: dự trữ."),
        bf("am_sf<0> (dự trữ)", "RES", 1, "STAT bit 6: chuyển tiếp bit am_sf<0> (dự trữ) của AM 400GBASE-R giữa hai bộ thu phát (§8.9.3)."),
        bf("Remote Degrade", "RD", 1, "STAT bit 7: chở am_sf<2> (RD) của 400GBASE-R từ router đầu này sang router đầu kia (§8.9.3, Hình 19)."),
        bf("Local/Link Degrade", "LD", 1, "STAT bit 8: am_sf<1> (LD) OR với trạng thái suy giảm RS(544,514) phía host – báo suy giảm tuyến cho router có khả năng 'soft reroute' (§8.9.3).")
      ].concat(b34, b56, [
        bf("PHY Member Map", "MAP", 32, "Byte 7–10: vùng MAP của FlexO – 400ZR không dùng (RES, xám ở Hình 15) vì không ghép nhiều PHY (§8.5)."),
        bf("CRC", "CRC", 16, "Byte 11–12: CRC-16 của FlexO – 400ZR không bắt buộc (RES)."),
        bf("Frame Communications Channel", "FCC", 112, "Byte 13–26: kênh quản lý – tuỳ chọn (RES) trong 400ZR."),
        bf("Synchronization Message", "OSMC", 16, "Byte 27–28: kênh SSM/PTP – tuỳ chọn (RES) trong 400ZR."),
        bf("Reserved", "RES", 96, "Byte 29–40: dự trữ, phát 0, bỏ qua khi thu.")
      ]);
    }
    var RES16 = [bf("Reserved", "RES", 16, "Byte 3–4: dự trữ ở khung này.")];
    var OH_PF = [
      { frames: [0], abbr: "MF 00", name: "Khung 1 của đa khung GMP (MFAS bit 7–8 = 00)",
        desc: "Byte 3–6 không mang JC. Ở khung MFAS bit 6–8 = 000, byte 3–5 là GID (20 bit + 4 bit RES) và byte 6 là PID – cả hai tuỳ chọn, 400ZR coi là RES; khung MFAS ..100 thì byte 3–6 là RES (Hình 15).",
        bitFields: ohFields([bf("Group ID bit 1–16", "GID", 16, "Định danh nhóm (tuỳ chọn, RES trong 400ZR).")],
          [bf("Group ID bit 17–20", "GID", 4, "4 bit cuối GID (tuỳ chọn)."), bf("Reserved", "RES", 4, "Dự trữ."),
           bf("PHY member Identification", "PID", 8, "Định danh thành viên PHY (tuỳ chọn, RES) – 400ZR không ghép nhiều PHY.")]) },
      { frames: [1], abbr: "JC4·JC1", name: "Khung 2 (MFAS bit 7–8 = 01): JC4 + JC1",
        desc: "Byte 5 = JC4 (4 bit RES + D1–D4 của ΣCnD), byte 6 = JC1 (C1–C8 của Cm) (§8.8.2).",
        bitFields: ohFields(RES16, [bf("Reserved", "RES", 4, "JC4 bit 1–4."),
          bf("ΣCnD D1–D4", "D1–D4", 4, "4 bit cao của ΣCnD 7 bit (D1 = MSB) – thông tin pha mịn n = 8,03125 bit (§8.8)."),
          bf("Cm C1–C8", "C1–C8", 8, "8 bit cao của Cm 14 bit (C1 = MSB): số khối m = 4 × 257 bit mang dữ liệu client trong đa khung kế tiếp.")]) },
      { frames: [2], abbr: "JC5·JC2", name: "Khung 3 (MFAS bit 7–8 = 10): JC5 + JC2",
        desc: "Byte 5 = JC5 (4 bit RES + D5–D7 + RES), byte 6 = JC2 (C9–C14, II, DI).",
        bitFields: ohFields(RES16, [bf("Reserved", "RES", 4, "JC5 bit 1–4."),
          bf("ΣCnD D5–D7", "D5–D7", 3, "3 bit thấp của ΣCnD (D7 = LSB)."), bf("Reserved", "RES", 1, "JC5 bit 8."),
          bf("Cm C9–C14", "C9–C14", 6, "6 bit thấp của Cm (C14 = LSB)."),
          bf("Increment Indicator", "II", 1, "Báo Cm tăng so với đa khung trước (GMP, G.709 Annex D)."),
          bf("Decrement Indicator", "DI", 1, "Báo Cm giảm so với đa khung trước.")]) },
      { frames: [3], abbr: "JC6·JC3", name: "Khung 4 (MFAS bit 7–8 = 11): JC6 + JC3",
        desc: "Byte 5 = JC6 (4 bit RES + CRC4 bảo vệ JC4/JC5), byte 6 = JC3 (CRC8 bảo vệ JC1/JC2) (§8.8.3, §8.8.4).",
        bitFields: ohFields(RES16, [bf("Reserved", "RES", 4, "JC6 bit 1–4."),
          bf("CRC4", "CRC4", 4, "g(x) = x⁴ + x + 1 trên 4 bit thấp của JC4 và JC5 (§8.8.4)."),
          bf("CRC8", "CRC8", 8, "g(x) = x⁸ + x³ + x² + 1 trên 16 bit JC1, JC2 (§8.8.3).")]) }
    ];

    var amLanes = AM4.map(function (enc, i) {
      var b = enc.split(" ");
      return R("am" + i, "am" + i, "AM lane " + i + " (120 bit, ghép xen 10b)", "fas", [0, i, 1, 12, 16],
        "Mẫu căn khung của lane logic " + i + " (16 lane × 120 bit): {CM0…CM5} chung cho mọi lane, UP/UM riêng từng lane (Bảng 4, byte MSB-first – ngược thứ tự bit LSB-first của IEEE 802.3). Lane i chiếm các nhóm 10 bit thứ i, i + 16, i + 32… của trường AM (Hình 11): nhóm 10 bit đầu của am0, rồi của am1 … am15, rồi nhóm thứ 2 của am0…", {
          values: [{ v: "0x" + b.join(" "), m: "am" + i + " = {CM0, CM1, CM2, UP0, CM3, CM4, CM5, UP1, UM0, UM1, UM2, UP2, UM3, UM4, UM5}" }],
          bitFields: [bf("Common marker CM0–CM2", "CM0–2", 24, "0x59 52 64 – chung cho 16 lane."),
            bf("Unique pad UP0", "UP0", 8, "0x" + b[3] + "."), bf("Common marker CM3–CM5", "CM3–5", 24, "0xA6 AD 9B."),
            bf("Unique pad UP1", "UP1", 8, "0x" + b[7] + "."), bf("Unique marker UM0–UM2", "UM0–2", 24, "0x" + b.slice(8, 11).join(" ") + " – riêng lane " + i + "."),
            bf("Unique pad UP2", "UP2", 8, "0x" + b[11] + "."), bf("Unique marker UM3–UM5", "UM3–5", 24, "0x" + b.slice(12, 15).join(" ") + ".")] });
    });
    var ohInst = [R("oh1", "OH #1", "OH instance #1 (320 bit, nhóm 10b thứ 1, 5, 9…)", "soh", [0, 384, 1, 32, 4],
      "Khối OH 40 byte DUY NHẤT được định nghĩa: MFAS, STAT và (trong 3 khung cuối của đa khung GMP 4 khung) JC1–JC6 mang Cm/ΣCnD của GMP (§8.6.3, §8.8.2, Hình 15). Chữ đen ở Hình 15 = bắt buộc (MFAS, STAT, JC), xám = tuỳ chọn (GID, PID, MAP, CRC, FCC, OSMC – để 0 và bỏ qua). Ô vẽ theo thứ tự truyền: nhóm 10 bit k của OH #1 nằm ở nhóm 4(k−1)+1 của trường OH 1280 bit (Hình 14); bitFields đọc theo thứ tự byte logic của OH #1.", {
        bitFields: OH_PF[1].bitFields, perFrame: OH_PF })].concat([2, 3, 4].map(function (k) {
      return R("oh" + k, "OH #" + k, "OH instance #" + k + " (320 bit) – dự trữ", "reserved", [0, 383 + k, 1, 32, 4],
        "Khối OH thứ " + k + " trong 4 × 320 bit ghép xen 10b: dự trữ cho chuẩn hoá sau, phát toàn 0, bỏ qua khi thu (§8.6.3). Các trường GMP/STAT chỉ có ở instance #1 – khác FlexO-4 nơi mỗi instance có BOH riêng.");
    }));

    F["zr400"] = {
      id: "zr400", name: "400ZR – khung 256 × 10 970 bit (có parity C-FEC)", family: "otn", category: CAT, order: 10,
      standard: IA4 + " §8.5–8.8 (Hình 8, 9, 10, 11, 14, 15; Bảng 4–7), §9 (Hình 21–25), §10, §12.5 (Bảng 16)",
      summary: "Khung 400ZR ≈ " + gbps(Z4.scfec) + ": 256 hàng × 10 970 bit, chu kỳ ≈ 6,539 µs; hàng 1 cột 1–5140 là AM + PAD + OH + 20 bit đệm, cột 10 281–10 970 là parity staircase FEC.",
      detail: "400ZR (OIF) đưa thẳng MỘT 400GBASE-R vào một bước sóng coherent DP-16QAM ~60 GBd, không qua ODU/OTU: bộ thu phát bóc RS(544,514) và AM của Ethernet, giữ dòng khối 256B/257B rồi GMP vào tải khung (§8.3, §8.8). Khung là ma trận bit 256 hàng × 10 280 cột (giống 400GBASE-R và FlexO-4-DSH; vùng OH như FlexO-4-DSH nhưng ít trường bắt buộc hơn, §8.5 – FlexO-4-DSH thuộc G.709.3, CHƯA XÁC MINH) cộng 690 cột parity (Hình 9/10). Hàng 1: AM 1920 bit (16 lane × 120 bit ghép xen 10b), PAD 1920 bit toàn 0, OH 1280 bit (4 × 320 bit ghép xen 10b), 20 bit đệm để tải bắt đầu đúng biên khối 257 bit; tải = 20 × 257 bit còn lại của hàng 1 + 255 hàng × 40 × 257 bit = 10 220 khối 257 bit. Đa khung GMP 4 khung (MFAS bit 7–8): m = 4 × 257 bit, Pm = 10 220, Cm danh định ≈ 10 215,91 (Bảng 6). Ô lưới = 10 bit (đơn vị ghép xen của AM/OH) nên 1097 cột ô; khối 257 bit và biên khối FEC không trùng biên ô nên chỉ mô tả trong desc.",
      grid: { rows: 256, cols: 1097, cellBits: 10 }, periodUs: PER4, rateKbps: Z4.scfec, unit: "zr400",
      multiframe: { frames: 4, note: "Đa khung GMP 4 khung theo MFAS bit 7–8 (00, 01, 10, 11 = khung 0…3 ở đây): Cm/ΣCnD của đa khung n gửi ở JC1–JC6 khung 2–4 (§8.8). MFAS đủ 8 bit đếm 0–255 (đa khung 256); GID/PID tuỳ chọn chỉ ở khung MFAS bit 6–8 = 000 (Hình 15)." },
      regions: [
        R("am", "AM", "Alignment Marker (bit 1–1920, 16 × 120 bit)", "fas", [0, 0, 1, 192],
          "Dấu căn khung 400ZR: 16 lane logic × 120 bit ghép xen từng 10 bit (Hình 11, 12; Bảng 4). Được bảo vệ bởi SC-FEC và bị xáo trộn; đầu thu căn khung SAU khi giải FEC + giải xáo trộn (SC-FEC đã căn theo hàng 10 970 bit) để tìm hàng là đầu khung 400ZR – chỉ cần một phần AM (§8.6.1). Cùng mã AM với 400GBASE-R (IEEE 802.3 Bảng 119-2, ở đây viết MSB-first – IA 400ZR Bảng 4 NOTE), nhưng là trường AM MỚI do 400ZR chèn vào đầu khung ở miền đồng hồ đường dây ±20 ppm, có SC-FEC bảo vệ; AM gốc của Ethernet đã bị bóc trước GMP (§8.3.1, §8.6.1).", { children: amLanes }),
        R("pad", "PAD", "PAD (bit 1921–3840)", "stuff", [0, 192, 1, 192],
          "1920 bit toàn 0, đầu thu bỏ qua (§8.6.2, Hình 13) – giữ chỗ để AM + PAD + OH = 5120 bit như cấu trúc FlexO."),
        R("oh", "OH", "Overhead (bit 3841–5120, 4 × 320 bit ghép xen 10b)", "soh", [0, 384, 1, 128],
          "Vùng OH 1280 bit = 4 khối 320 bit ghép xen từng 10 bit (Hình 14): chỉ khối #1 có nội dung (MFAS, STAT, JC1–JC6); khối #2–#4 dự trữ (§8.6.3, Hình 15).", { children: ohInst }),
        R("pad20", "Pad 20b", "Đệm 20 bit (bit 5121–5140)", "stuff", [0, 512, 1, 2],
          "4 × 5 bit đệm (Hình 10) để AM/PAD/OH cộng đệm = 5140 bit = 20 × 257 bit – tải bắt đầu đúng biên khối 257 bit (§8.6)."),
        R("pl1", "Payload", "Tải hàng 1 (bit 5141–10 280 = 20 × 257 bit)", "payload", [0, 514, 1, 514],
          "Phần tải đầu: 20 khối 257 bit. Toàn khung có 10 220 khối 257 bit; mỗi 4 khung (đa khung GMP) có 10 220 nhóm 4 × 257 bit, mỗi nhóm mang 1028 bit 400GBASE-R hoặc 1028 bit chèn (toàn 0) theo Cm (sigma-delta, Bảng 7; Hình 17: Cm = 10 216 → nhóm chèn ở vị trí 1, 2556, 5111, 7666)."),
        R("pl2", "Payload", "Tải hàng 2–256 (40 × 257 bit mỗi hàng)", "payload", [1, 0, 255, 1028],
          "Dòng khối 256B/257B của 400GBASE-R (đã bỏ RS-FEC và AM, chưa giải mã 257B) ánh xạ GMP: dữ liệu và thời gian trong suốt (cả preamble/IPG), không chèn/xoá Idle (§8.8, Hình 7). Tải danh định " + gbps(Z4.payload) + " (Bảng 6: fp,server) chở client " + gbps(Z4.client) + "."),
        R("fec", "FEC", "Parity C-FEC (cột 10 281–10 970, 690 bit/hàng)", "fec", [0, 1028, 256, 69],
          "Phần mở rộng FEC ngoài: cứ 119 hàng (119 × 10 280 bit tin) được chia thành 5 khối staircase FEC (512 × 510 bit, mã (255,239)), mỗi khối 244 664 bit tin + CRC32 + MBAS 6 bit (+ 34 bit 0 không truyền) → 16 384 bit parity; parity + 5 × 38 bit CRC/MBAS lấp 119 × 690 = 82 110 bit ở các cột này (§9, Hình 21, 24, 25). Biên khối parity ở cột 10 418, 10 556, 10 694, 10 832, 10 970; khối 119 hàng trôi so với khung 256 hàng nên không vẽ từng khối. Sau đó còn thêm 6 × 119 bit pad, xáo trộn, interleave chập (độ sâu 16) và mã Hamming (128,119) – các bước này KHÔNG nằm trong lưới (§10).")
      ]
    };
  })();

  // =====================================================================
  // Khung 800ZR – 8 × 100G ZR instance ghép xen 128 bit = 41 120 khối 128 bit (= 512 × 10 280 bit của IA Hình 9/15).
  // Lưới vẽ theo KHỐI: 514 hàng × 80 khối (cellBits 128) – cột c thuộc instance IID = (c mod 8) + 1; hàng 1 = 80 khối OH.
  // =====================================================================
  (function () {
    var MF = 8;
    function range(a, b) { var o = []; for (var i = a; i <= b; i++) o.push(i); return o; }
    // 1280 bit OH của một 100G ZR instance (Hình 5–7): AM 480 (FA1 ×16, FA2 ×16, RES 224) + EOH 480 + BOH 320 (40 byte).
    function instFields(iid, b3, b4, b5, b6) {
      var first = iid === 1;
      return [
        bf("FA1 × 16", "FA1", 128, "16 octet 0x09 (bit 1–128), phát MSB trước (§4.3.1, Hình 6, Bảng 3) – nội dung AM theo G.709.6 §9.1 (CHƯA XÁC MINH bản gốc)."),
        bf("FA2 × 16", "FA2", 128, "16 octet 0xD7 (bit 129–256)."),
        bf("AM reserved", "RES", 224, "Bit 257–480: dự trữ, phát 0. Căn khung được trên một phần trường AM."),
        bf("Extended Overhead", "EOH", 480, "Bit 481–960: 800ZR không dùng (phát 0); G.709.1 §9.3 dùng cho FlexOfec/Regen/FlexOsec (§4.3.2)."),
        bf("MFAS", "MFAS", 8, "BOH byte 1: đếm 0x00–0xFF, đồng bộ ở cả 8 instance; bit 6–8 chọn khung trong đa khung BOH 8 khung (§4.3.3.1)."),
        bf("Remote Fault", "RF", 1, "STAT bit 1: lỗi ở đầu thu phía xa (cả tuyến 800ZR), chép ở mọi instance (§4.3.3.8)."),
        bf("Maintenance", "MNT", 3, "STAT bit 2–4: 000 = bình thường, 101 = LCK (Bảng 6)."),
        bf("Reserved", "RES", 4, "STAT bit 5–8."),
        b3, b4, b5, b6,
        bf("MAP", "MAP", 32, "Byte 7–10: bản đồ thành viên 256 bit trên 8 khung; 800ZR luôn 8 instance IID 1–8 → MAP[1:8] = 0xFF, còn lại 0 (§4.3.3.4, Hình 8)."),
        bf("CRC-16", "CRC", 16, "Byte 11–12: CRC-16 bảo vệ byte 2–10 (không gồm MFAS, FCC1, OSMC) theo G.709.1 §9.2.5 (§4.3.3.5)."),
        bf(first ? "FCC1" : "Reserved", first ? "FCC1" : "RES", 112, "Byte 13–26: FCC1 ở instance #1, RES ở #2–#8 – 800ZR không dùng (vàng ở Hình 7), phát 0."),
        bf(first ? "OSMC" : "Reserved", first ? "OSMC" : "RES", 16, "Byte 27–28: OSMC ở instance #1, RES ở #2–#8 – 800ZR không dùng."),
        bf("Reserved", "RES", 96, "Byte 29–40: dự trữ.")
      ];
    }
    var R8 = function (n) { return bf("Reserved", "RES", 8, "BOH byte " + n + ": dự trữ ở khung này."); };
    var JC = {
      jc1: bf("JC1: Cm C1–C8", "JC1", 8, "8 bit cao của Cm 14 bit (số khối m = y × 257 bit mang client trong đa khung GMP kế tiếp)."),
      jc2: bf("JC2: C9–C14, II, DI", "JC2", 8, "6 bit thấp Cm + bit tăng (II) / giảm (DI)."),
      jc3: bf("JC3: CRC8", "JC3", 8, "CRC8 g(x) = x⁸ + x³ + x² + 1 trên JC1, JC2 (§4.5.5)."),
      jc4: bf("JC4: RES ×5 + CnD D1–D3", "JC4", 8, "Bit 1–5 RES, bit 6–8 = D1–D3 của ΣCnD 5 bit (§4.5.4)."),
      jc5: bf("JC5: RES ×5 + D4, D5, RES", "JC5", 8, "Bit 1–5 RES, bit 6–7 = D4–D5, bit 8 RES."),
      jc6: bf("JC6: RES ×5 + CRC3", "JC6", 8, "CRC3 g(x) = x³ + x² + 1 trên JC4/JC5 (§4.5.6).")
    };
    function perFrame(iid) {
      return [
        { frames: [0], abbr: "GID·IID", name: "Khung 1 (MFAS ..000): GID + IID",
          desc: "Byte 3–5: GID 20 bit = 0x1 (một PHY) + 4 bit RES; byte 6: IID = 0x0" + iid + " (§4.3.3.2, §4.3.3.3).",
          bitFields: instFields(iid, bf("GID bit 1–8", "GID", 8, "GID = 0x00001 (20 bit), chép ở mọi instance."), bf("GID bit 9–16", "GID", 8, "Phần giữa GID."),
            bf("GID bit 17–20 + RES", "GID·RES", 8, "4 bit cuối GID + 4 bit RES."), bf("Instance ID", "IID", 8, "= " + iid + " (0x0" + iid + ") – instance thứ " + iid + " của 800ZR.")) },
        { frames: [1, 5], abbr: "JC4·JC1", name: "Khung 2 và 6: JC4 + JC1",
          desc: "Byte 5 = JC4, byte 6 = JC1 (hàng 2 của đa khung GMP 4 khung). Byte 3 khung 2 là AVAIL (không dùng trong 800ZR).",
          bitFields: instFields(iid, bf("AVAIL / RES", "AVAIL·RES", 8, "Khung 2: AVAIL (G.709.1 §9.2.4.1, 800ZR không dùng); khung 6: RES."), R8(4), JC.jc4, JC.jc1) },
        { frames: [2, 6], abbr: "JC5·JC2", name: "Khung 3 và 7: JC5 + JC2", desc: "Byte 5 = JC5, byte 6 = JC2.",
          bitFields: instFields(iid, R8(3), R8(4), JC.jc5, JC.jc2) },
        { frames: [3], abbr: "JC6·JC3", name: "Khung 4: JC6 + JC3", desc: "Byte 5 = JC6, byte 6 = JC3.",
          bitFields: instFields(iid, R8(3), R8(4), JC.jc6, JC.jc3) },
        { frames: [7], abbr: "CSTAT·JC6·JC3", name: "Khung 8: CSTAT + JC6 + JC3",
          desc: "Byte 3 = CSTAT (trạng thái client mà instance mang, chép ở mọi instance của client đó, §4.3.3.9); byte 5 = JC6, byte 6 = JC3.",
          bitFields: instFields(iid, bf("CSTAT: CSF 1 + MNT 3 + RES 1 + am_sf<0> 1 + RD 1 + LD 1", "CSTAT", 8, "CSF = client hỏng; MNT 000/101 (LCK, Bảng 7); am_sf<0>, RD, LD chuyển tiếp bit trạng thái AM của client 200/400/800GE (§4.7.3)."),
            R8(4), JC.jc6, JC.jc3) },
        { frames: [4], abbr: "MSI·PT", name: "Khung 5: MSI + PT",
          desc: "Byte 5 = MSI (OCC 1 bit + TPID 7 bit, Bảng 5), byte 6 = PT = 0x40 (Bảng 4; 0x41 = PRBS thử).",
          bitFields: instFields(iid, R8(3), R8(4), bf("MSI: OCC 1 + TPID 7", "MSI", 8, "OCC = 1 nếu instance mang client; TPID = số client (8×100GE: 0…7; 4×200GE: 0,0,2,2,4,4,6,6; 2×400GE: 0,0,0,0,4,4,4,4; 1×800GE: 0) (§4.3.3.7)."),
            bf("Payload Type", "PT", 8, "0x40 = ghép 100/200/400/800GBASE-R (G.709.1 Bảng 9-1 'Reserved OIF 800ZR'); 0x41 = PRBS.")) }
      ];
    }
    var ohKids = range(1, 8).map(function (iid) {
      var pf = perFrame(iid);
      return R("oh-i" + iid, "OH #" + iid, "OH instance IID " + iid + " (10 khối 128 bit: cột " + iid + ", " + (iid + 8) + "…" + (iid + 72) + ")", "soh", [0, iid - 1, 1, 10, 8],
        "1280 bit OH của 100G ZR instance " + iid + ": AM 480 bit (FA1 ×16, FA2 ×16, RES), EOH 480 bit (không dùng), BOH 320 bit = 40 byte (MFAS, STAT, GID/IID, JC1–JC6, MSI, PT, CSTAT, MAP, CRC-16; FCC1/OSMC không dùng) (§4.3, Hình 5–7). Sau ghép xen 128 bit, khối thứ j của instance là khối (j − 1) × 8 + " + iid + " của khung 800ZR (§4.4, Hình 9).",
        { bitFields: pf[0].bitFields, perFrame: pf });
    });
    function plKids(r, c0, h, w, label) {
      return range(1, 8).map(function (iid) {
        return R("pl-" + label + "-i" + iid, "IID " + iid, "Tải instance " + iid + " (" + label + ")", "tributary", [r, c0 + iid - 1, h, w, 8],
          "Khối 128 bit của 100G ZR instance " + iid + ": GMP mang một dòng 100G 257B (100GBASE-R riêng, hoặc 1/2, 1/4, 1/8 của 200/400/800GE chia vòng từng khối 257 bit) – Bảng 2: client 100GE #k ở IID k; 200GE ở IID {1,2}, {3,4}…; 400GE ở {1–4}, {5–8}; 800GE ở 1–8.");
      });
    }
    F["zr800"] = {
      id: "zr800", name: "800ZR – khung 8 × 100G ZR instance (41 120 khối 128 bit)", family: "otn", category: CAT, order: 20,
      standard: IA8 + " §4.3–4.5 (Hình 5–10; Bảng 2–8, 31), §5.1–5.2 (Hình 15), §5.12 (Bảng 20); " + STD1 + " §8.4, §9.2",
      summary: "Khung 800ZR ≈ " + gbps(Z8.frame) + " (chưa gồm OFEC): 8 instance 100G ZR (mỗi cái 128 × 5140 bit như FlexO) ghép xen từng khối 128 bit = 512 × 10 280 bit, chu kỳ ≈ 6,539 µs.",
      detail: "800ZR dùng cấu trúc FlexO-8e / FlexO-8e-DO-16QAM (G.709.1, G.709.6) bỏ bớt OH (theo IA §4; văn bản G.709.6 CHƯA XÁC MINH). Mỗi 100G ZR instance là khung FlexO 128 hàng × 5140 bit: hàng 1 bit 1–1280 là AM/EOH/BOH, bit 1281–1285 PAD 5 bit, còn lại 2555 × 257 bit tải (§4.3); 8 instance căn khung/đa khung rồi ghép xen 128 bit thành 41 120 khối: 80 khối OH đầu rồi 41 040 khối tải (§4.4, Hình 9). Client: 8 × 100GBASE-R, 4 × 200GBASE-R, 2 × 400GBASE-R hoặc 1 × 800GBASE-R/800G-ETC-R (Bảng 1) – IA 800ZR chỉ định nghĩa một loại client mỗi lần; trộn loại nằm ngoài phạm vi IA (§3). Mỗi client chiếm y instance liên tiếp (y = 1, 2, 4, 8), GMP chung một Cm cho y instance: m = y × 257 bit, Pm = 10 220 trên đa khung 4 khung, Cm danh định 10 215,785 (100GE) / 10 215,910 (200/400/800GE) (Phụ lục A). Lưới vẽ theo khối 128 bit (514 hàng × 80 khối) thay cho 512 × 10 280 bit của IA – cùng 5 263 360 bit theo đúng thứ tự truyền, để thấy ghép xen: cột c thuộc IID (c mod 8) + 1. OFEC (thêm 128/111) không nằm trong khung: 116 hàng 10 280 bit (trôi so với khung) + CRC32 mỗi 4 hàng + 64 bit pad = 84 khối mã 14 208 bit (§5.1–5.2).",
      grid: { rows: 514, cols: 80, cellBits: 128 }, periodUs: PER8, rateKbps: Z8.frame, unit: "zr800",
      multiframe: { frames: MF, note: "BOH trải trên đa khung 8 khung (MFAS bit 6–8 = 000…111 = khung 0…7 ở đây); GMP dùng đa khung 4 khung (MFAS bit 7–8), JC ở khung 2–4 và 6–8 (§4.5.2). MFAS 8 bit của 8 instance đồng bộ." },
      regions: [
        R("oh", "OH", "OH 80 khối (8 instance × 10 khối 128 bit)", "soh", [0, 0, 1, 80],
          "Hàng đầu của khung ghép xen: 10 khối OH (1280 bit) của từng instance xen nhau từng khối 128 bit (§4.4). Khác 400ZR (một OH chung cho 400G), mỗi instance 100G có AM + BOH riêng; GMP/MSI/PT chép ở các instance cùng client.", { children: ohKids }),
        R("pl-first", "PAD5 + tải", "Khối tải đầu của 8 instance (PAD 5 bit + 123 bit tải)", "payload", [1, 0, 1, 8],
          "Khối 128 bit thứ 11 của mỗi instance (bit 1281–1408 của instance): 5 bit PAD toàn 0 để tải căn biên 257 bit, rồi 123 bit tải đầu tiên (§4.3, §4.5.1).", {
            bitFields: range(1, 8).reduce(function (a, iid) {
              return a.concat([bf("PAD instance " + iid, "PAD", 5, "Bit 1281–1285 của instance " + iid + ": phát 0, bỏ qua khi thu."),
                bf("Tải instance " + iid, "Payload", 123, "Bắt đầu 2555 × 257 bit tải GMP của instance " + iid + ".")]);
            }, []) }),
        R("pl-r2", "Payload", "Tải hàng 2 (khối 89–160)", "payload", [1, 8, 1, 72], "Tải ghép xen 128 bit – mỗi cột một instance.", { children: plKids(1, 8, 1, 9, "hàng 2") }),
        R("pl-main", "Payload", "Tải hàng 3–514 (40 960 khối)", "payload", [2, 0, 512, 80],
          "Tải 8 instance ghép xen 128 bit. Mỗi đa khung GMP 4 khung của một instance có 10 220 khối 257 bit; với client y instance, mỗi nhóm y × 257 bit (một khối 257 bit ở mỗi instance) mang dữ liệu hoặc chèn (toàn 0) theo Cm – Cm = 10 216 → chèn ở 1, 2556, 5111, 7666 (Bảng 8). Tải danh định " + gbps(Z8.payload) + " (Phụ lục A: 8 × fp,server).", { children: plKids(2, 0, 512, 10, "hàng 3–514") })
      ]
    };
  })();

  // =====================================================================
  // TMUX – client 800GbE + giao diện 400ZR / 800ZR (kind "otu": khung đường truyền mang client trực tiếp, không có ODU)
  // rateKbps = tốc độ của khung VẼ trong TFRAMES (400ZR có cột parity; 800ZR chưa có OFEC); lineKbps = tốc độ bit trên sợi
  // (sau toàn bộ FEC + FAW/TS/pilot) = 8 × tốc độ ký hiệu.
  // =====================================================================
  function U(o) { o.family = "otn"; M[o.id] = o; }

  U({ id: "800gbe", name: "800GBASE-R (800GbE, 64B/66B)", kind: "client", level: 8, rateKbps: 800000000 * 66 / 64, lineKbps: PMA800,
    standard: IA8 + " §3 (Bảng 1), §4.1, Phụ lục A (Bảng 31); IEEE Std 802.3df-2024 Clause 172 (PCS/RS-FEC), 173 (PMA)",
    summary: "800 Gigabit Ethernet: 825 Gbit/s ở dạng 64B/66B, 850 Gbit/s ở giao diện PMA (256B/257B + RS(544,514), 800GAUI-8).",
    desc: "Hai luồng PCS 400G (32 PCS lane, IEEE 802.3df Clause 172) mã 256B/257B + RS(544,514). 800ZR bóc FEC + AM, ghép vòng hai dòng 257B 400G thành một dòng 800G rồi chia vòng từng khối 257 bit ra 8 instance 100G ZR; thông tin còn lại = 8 × 100 000 000 × 257/256 × 20479/20480 = " + vn(8 * Z8.client100s, 3) + " kbit/s (Phụ lục A: fclient, dung sai ±50 ppm; 800G-ETC-R ±100 ppm). lineKbps 850 000 000 = fclient × 544/514 × 20480/20479 – suy ngược từ công thức của IA, IA không ghi trực tiếp; rateKbps 825 000 000 = 800 × 66/64 theo quy ước BASE-R như 400gbe. Chưa có ánh xạ 800GbE vào OTN trong G.709 06/2020 – chỉ đi qua 800ZR ở đây." });

  var OH4 = Z4.scfec - Z4.payload;
  U({ id: "zr400", name: "400ZR", kind: "otu", level: 98, rateKbps: Z4.scfec, lineKbps: Z4.line, frame: "zr400",
    standard: IA4 + " §8 (GMP Bảng 5–7), §9–12, §12.5 (Bảng 16), §13 (Bảng 17), §15 (Bảng 41–44)",
    summary: "400ZR: một 400GBASE-R → khung 400ZR " + gbps(Z4.scfec) + " (có parity staircase) → đường dây 478,75 Gbit/s = 59,84375 GBd DP-16QAM, lưới 100/75 GHz.",
    desc: "Giao diện coherent một bước sóng ≥ 80 km (khuếch đại, DWDM 100 GHz hoặc 75 GHz) hoặc một bước sóng không khuếch đại (ngân sách 11 dB) (Bảng 17). Không có ODU/OTU: 400GBASE-R bóc RS(544,514) + AM còn " + gbps(Z4.client) + " (dòng 257B), GMP vào tải khung 400ZR " + gbps(Z4.payload) + " (Cm ≈ 10 215,91 / 10 220), thêm AM/PAD/OH (× 512/511) = " + gbps(Z4.frame) + ", thêm CRC32/MBAS + parity staircase (× 5485/5140) = " + gbps(Z4.scfec) + " (rateKbps – khung vẽ). Tiếp theo (ngoài lưới): pad 6 × 119 bit, xáo trộn, interleave, Hamming (128,119), DP-16QAM 8 bit/ký hiệu, FAW/TS/RES và pilot 1/32 → 478 750 000 kbit/s (lineKbps) = 59,84375 GBd. C-FEC (staircase 255/239 × Hamming 128/119) thêm ~14,8 %, NCG ~10,8 dB, ngưỡng BER vào 1,25·10⁻² → ra 10⁻¹⁵ (§10). Đồng hồ đường dây ±20 ppm độc lập với host ±100 ppm (GMP hấp thụ) (§6.1).",
    accepts: [{ of: "400gbe", count: 1, fit: "le", carriedKbps: Z4.client, mapping: "GMP (m = 4 × 257 bit, n = 8,03125 bit)",
      overhead: { kbps: OH4, name: "AM + PAD + OH + đệm 20 bit (5140 bit/khung) + CRC32/MBAS + parity staircase (690 cột)",
        desc: "Khung 256 × 10 970 bit: tải 10 220 × 257 = 2 626 540 bit; phần còn lại 5140 bit AM/PAD/OH/đệm + 256 × 690 bit parity/CRC/MBAS. Tải = " + vn(Z4.payload, 3) + " kbit/s; GMP chèn khối 4 × 257 bit toàn 0 để bù phần client nhỏ hơn tải (~4 khối / đa khung)." },
      note: "425 000 000 × 514/544 × 20479/20480 = " + vn(Z4.client, 3) + " kbit/s (Bảng 5) ≤ tải " + vn(Z4.payload, 3) + " kbit/s (Bảng 6: fp,server); Cm danh định = 10 220 × " + vn(Z4.client, 3) + " / " + vn(Z4.payload, 3) + " ≈ 10 215,91, ±100/±20 ppm → Cm 10 214…10 218." }] });

  var OH8 = Z8.frame - Z8.payload;
  var oh8 = { kbps: OH8, name: "8 × (AM 480 + EOH 480 + BOH 320 bit + PAD 5 bit) mỗi khung",
    desc: "Mỗi instance: 4 khung × (1280 + 5) bit = 5140 bit OH trên 2 631 680 bit đa khung GMP (Phụ lục A: Oserver) → tải = 511/512 khung. OFEC không tính ở đây (lineKbps)." };
  function z8acc(of, count, y, carried, txt) {
    return { of: of, count: count, fit: "le", carriedKbps: carried, mapping: "GMP (m = " + y + " × 257 bit) vào " + y + " instance",
      overhead: oh8, note: count + " × " + vn(carried, 3) + " = " + vn(count * carried, 3) + " kbit/s ≤ tải " + vn(Z8.payload, 3) + " kbit/s. " + txt };
  }
  U({ id: "zr800", name: "800ZR", kind: "otu", level: 99, rateKbps: Z8.frame, lineKbps: Z8.line, frame: "zr800",
    standard: IA8 + " §3–5 (Bảng 1, 2, 5, 20, 21, 22, 30, 31); " + STD1 + " §8.4",
    summary: "800ZR: 8 × 100GbE / 4 × 200GbE / 2 × 400GbE / 1 × 800GbE → khung 800ZR " + gbps(Z8.frame) + " → OFEC → đường dây " + gbps(Z8.line) + " = 118,203 GBd DP-16QAM, lưới 150 GHz.",
    desc: "Giao diện coherent một bước sóng 80–120 km khuếch đại, DWDM 150 GHz (32 kênh, Bảng 30). Client Ethernet ≥ 100G, tổng ≤ 800G (Bảng 1) – IA 800ZR chỉ định nghĩa một loại client mỗi lần; trộn loại nằm ngoài phạm vi IA (§3), lab từ chối trộn theo phạm vi đó; mỗi client y00GE chiếm y instance 100G ZR liên tiếp, GMP với Cm chung (§4.2, Bảng 2). Khung 800ZR = 8 instance ghép xen 128 bit = " + gbps(Z8.frame) + " (rateKbps). Ngoài lưới: CRC32 mỗi 4 hàng + 64 bit pad (× 1 193 472 / 1 192 480), xáo trộn, OFEC 4 bộ mã song song (BCH(256,239) mở rộng, 3552 → 4096 bit, thêm 15,3 %), interleave, DP-16QAM, FAW/TS/RES (× 513/512) và pilot 1/64 (× 64/63) → " + gbps(Z8.line) + " (lineKbps) = 118,203350603 GBd (Bảng 20). Ngưỡng OFEC lý thuyết BER 2 % (ReSNR 12,71 dB) so với C-FEC 1,25 % (13,67 dB) của 400ZR.",
    accepts: [
      z8acc("100gbe", 8, 1, Z8.client100, "100GBASE-R bỏ RS-FEC + AM: 100 000 000 × 257/256 × 16383/16384 (Phụ lục A); khối 257B KHÔNG giải xáo trộn; client #k → IID k, TPID k − 1."),
      z8acc("200gbe", 4, 2, 2 * Z8.client100s, "200GBASE-R bỏ FEC + AM, giải xáo trộn, chia vòng 2 dòng 100G (mỗi dòng 100 000 000 × 257/256 × 20479/20480); client #1 → IID 1–2 … #4 → IID 7–8."),
      z8acc("400gbe", 2, 4, 4 * Z8.client100s, "400GBASE-R → 4 dòng 100G; client #1 → IID 1–4, #2 → IID 5–8 (TPID 0 và 4)."),
      z8acc("800gbe", 1, 8, 8 * Z8.client100s, "800GBASE-R / 800G-ETC-R: ghép vòng 2 luồng 400G rồi chia 8 dòng 100G vào IID 1–8 (TPID 0).")
    ] });

  // =====================================================================
  // TLINE – dữ liệu trang #line "Từ khung tới bước sóng" (schema: transport-schema.md mục 6)
  // Mỗi bước: kbps = kbps bước trước × ratio[0] / ratio[1] (bước đầu có kbps gốc); bước 'symbol' có gbd = kbps / bitsPerSymbol / 1e6;
  // bước 'optic' có ghz (độ rộng kênh). Kiểm: _workspace/K1_transport-expert_tline-check.cjs.
  // =====================================================================
  function S(o) { return o; }
  var CH400 = [
    S({ id: "pma", kind: "client", label: "400GBASE-R ở giao diện host (PMA, 400GAUI-8)", kbps: Z4.pma, unit: "400gbe",
      formula: "16 PCS lane × 26 562 500 = 425 000 000 kbit/s (256B/257B + RS(544,514) + AM), ±100 ppm",
      standard: IA4 + " §8.1, Bảng 2, Bảng 16 (cột 'Client-rate')",
      note: "Router/switch phát 400GbE như với module xám; 400ZR là một PHY 400GBASE-R (§5) – trong suốt mã và định thời (cả SyncE/FlexE)." }),
    S({ id: "nofec", kind: "adapt", label: "Bóc RS(544,514) của Ethernet", ratio: [514, 544], kbps: Z4.noFec,
      formula: "425 000 000 × 514/544 = 401 562 500 kbit/s", standard: IA4 + " §8.3.1, Hình 39, Bảng 16",
      note: "FEC Ethernet chỉ bảo vệ dây điện host ↔ module; trên sợi dùng C-FEC mạnh hơn. LD/RD (am_sf) được chuyển sang STAT." }),
    S({ id: "noam", kind: "adapt", label: "Bỏ AM 400GBASE-R (1 khối / 20 480)", ratio: [20479, 20480], kbps: Z4.client,
      formula: "401 562 500 × 20479/20480 = 401 542 892,456 kbit/s (fclient)", standard: IA4 + " §8.8, Bảng 5, Bảng 6",
      note: "Còn lại dòng khối 256B/257B đã giải xáo trộn của 400GBASE-R – thứ được ánh xạ. Không chèn/xoá Idle." }),
    S({ id: "gmp", kind: "frame", label: "GMP vào tải khung 400ZR (dung lượng tải)", ratio: [Z4.payload, Z4.client], kbps: Z4.payload, frame: "zr400",
      formula: "fp,server = 478,75 G × 28/29 × 119/128 × 5140/5488 × 511/512 = 401 703 640,510 kbit/s; Cm = 10 220 × fclient / fp,server ≈ 10 215,91",
      standard: IA4 + " §8.8, Bảng 6, Bảng 7, Hình 17",
      note: "Tải 4 khung = 10 220 nhóm 4 × 257 bit; ≈ 4 nhóm chèn mỗi đa khung (Cm 10 214…10 218 theo ±100/±20 ppm). Hai miền đồng hồ: host ±100 ppm, đường dây ±20 ppm." }),
    S({ id: "frame", kind: "frame", label: "+ AM/PAD/OH (20 × 257 bit mỗi 10 240) → khung 400ZR", ratio: [512, 511], kbps: Z4.frame, frame: "zr400",
      formula: "× 10 240/10 220 = × 512/511 → 402 489 753,310 kbit/s (fserver; 256 × 10 280 bit, ≈ 6,539 µs)",
      standard: IA4 + " §8.5–8.6, Hình 8, 10; Bảng 6", note: "AM 1920 + PAD 1920 + OH 1280 + đệm 20 bit = 5140 bit ở hàng 1 mỗi khung." }),
    S({ id: "scfec", kind: "fec", label: "+ CRC32/MBAS + parity staircase FEC (255,239)", ratio: [5485, 5140], kbps: Z4.scfec, frame: "zr400",
      formula: "× 10 970/10 280 = × 5485/5140 → 429 505 116,129 kbit/s (119 hàng → 5 khối SC-FEC 512 × 510 bit)",
      standard: IA4 + " §9, §10.1, Hình 21–25", note: "FEC ngoài cứng (HD) staircase tổng quát + bộ khử tương quan lỗi; CRC32 mỗi 244 664 bit để đánh dấu lỗi sau FEC." }),
    S({ id: "pad", kind: "fec", label: "+ 6 × 119 bit pad đồng bộ", ratio: [5488, 5485], kbps: Z4.pad,
      formula: "× 10 976/10 970 = × 5488/5485 → 429 740 032,328 kbit/s", standard: IA4 + " §10.2–10.4, Hình 27–32",
      note: "Rồi xáo trộn khung (x¹⁶ + x¹² + x³ + x + 1) và interleave chập độ sâu 16 theo khối 119 bit." }),
    S({ id: "hamming", kind: "fec", label: "Mã trong Hamming (128,119) mềm (SD)", ratio: [128, 119], kbps: Z4.ham,
      formula: "× 128/119 → 462 241 379,310 kbit/s", standard: IA4 + " §10.5",
      note: "C-FEC = staircase 239/255 × Hamming 119/128: mã tổng 0,871, thêm ≈ 14,8 %, NCG ≈ 10,8 dB; BER vào 1,25·10⁻² → ra 10⁻¹⁵ (§10)." }),
    S({ id: "map", kind: "dsp", label: "Ánh xạ DP-16QAM + FAW/TS/RES", ratio: [176204, 175616], kbps: Z4.faw,
      formula: "Mỗi từ mã 128 bit → 16 ký hiệu DP-16QAM (8 bit/ký hiệu: 2 bit I + 2 bit Q × 2 phân cực X/Y); 175 616 ký hiệu/phân cực mỗi siêu khung DSP + 588 ký hiệu FAW/TS/RES → × 176 204/175 616 = 463 789 062,5 kbit/s",
      standard: IA4 + " §11 (Bảng 10), §12.1–12.2, Hình 35, 36, 39",
      note: "Siêu khung DSP 181 888 ký hiệu = 49 khung con × 3712: FAW 22 ký hiệu, 76 RES, TS 11 ký hiệu đầu mỗi khung con. '3b/Sym' ở Hình 39 là lỗi in; đúng là 4 b/ký hiệu mỗi phân cực (1 404 928 / 351 232), tức 8 bit mỗi ký hiệu DP-16QAM. Mũi tên sau 'Insert Pilots' ở Hình 39 ghi 178176, đúng là 181 888 (= 176 204 × 32/31)." }),
    S({ id: "pilot", kind: "dsp", label: "+ Pilot QPSK (1 / 32 ký hiệu)", ratio: [32, 31], kbps: Z4.line,
      formula: "× 32/31 → 478 750 000 kbit/s = 156,25 Mbit/s × 383 × 8 (FAW/TS/RES + pilot = × 29/28)", standard: IA4 + " §12, §12.5, Hình 39, Bảng 16",
      note: "Pilot (PRBS10 ánh xạ QPSK ở 4 điểm ngoài) giúp khôi phục pha sóng mang; tốc độ bit đường dây 478,75 Gbit/s ±20 ppm." }),
    S({ id: "baud", kind: "symbol", label: "Tốc độ ký hiệu", gbd: Z4.gbd, bitsPerSymbol: 8,
      formula: "478 750 000 kbit/s / 8 bit = 59,84375 GBd (mỗi phân cực 4 bit/ký hiệu)", standard: IA4 + " §12.5",
      note: "Băng thông tín hiệu ~ tốc độ ký hiệu ≈ 60 GHz – vừa kênh 75 GHz." }),
    S({ id: "grid", kind: "optic", label: "Bước sóng DWDM", ghz: 100,
      formula: "Lưới cố định 100 GHz: 193,1 + n × 0,1 THz, n = −17…30 → 48 kênh 191,4–196,1 THz (mã ứng dụng 0x01); 75 GHz: 64 kênh 191,375–196,1 THz (0x03); lưới linh hoạt 193,1 + n × 0,00625 THz, khe 12,5 × m GHz",
      standard: IA4 + " §13 (Bảng 17, 18), §15 (Bảng 41–44)",
      note: "≥ 80 km (≤ 120 km) khuếch đại, giới hạn bởi nhiễu: OSNR chịu được 26 dB/0,1 nm (0x01); hoặc một bước sóng không khuếch đại, ngân sách 11 dB (0x02). Mặc định 193,7 THz." })
  ];
  var CH800 = [
    S({ id: "pma", kind: "client", label: "Client ở host: 800GBASE-R (800GAUI-8) hoặc 2 × 400G / 4 × 200G / 8 × 100G", kbps: PMA800, unit: "800gbe",
      formula: "800GBASE-R: 8 × 100 000 000 × 257/256 × 544/514 = 850 000 000 kbit/s (suy từ fclient × 544/514 × 20480/20479; IA không ghi trực tiếp)",
      standard: IA8 + " §3 (Bảng 1), §4.1; Phụ lục A",
      note: "IA 800ZR chỉ định nghĩa một loại client mỗi lần; trộn loại nằm ngoài phạm vi IA (§3). Client ≥ 100GE, tổng ≤ 800G; cả 4 phương án đều có tổng PMA 850 G (8 × 106,25 = 4 × 212,5 = 2 × 425 = 1 × 850). 800GE ±50 ppm; 100/200/400GE, 800G-ETC ±100 ppm." }),
    S({ id: "client", kind: "adapt", label: "Bóc RS(544,514) + AM → dòng 257B, chia 8 dòng 100G", ratio: [514 * 20479, 544 * 20480], kbps: 8 * Z8.client100s,
      formula: "8 × 100 000 000 × 257/256 × 20479/20480 = 803 085 784,912 kbit/s (100GE: 100 000 000 × 257/256 × 16383/16384 = 100 384 497,643 mỗi client)",
      standard: IA8 + " §4.1–4.2, Phụ lục A Bảng 31", note: "200/400/800GE được giải xáo trộn và chia vòng từng khối 257 bit; 100GE giữ nguyên (khối vốn đã xáo trộn)." }),
    S({ id: "gmp", kind: "frame", label: "GMP vào tải 8 instance 100G ZR", ratio: [Z8.payload, 8 * Z8.client100s], kbps: Z8.payload, frame: "zr800",
      formula: "8 × fp,server = 8 × 100 425 910,128 = 803 407 281,021 kbit/s; Cm danh định 10 215,910 / 10 220 (100GE: 10 215,785)",
      standard: IA8 + " §4.5, Bảng 8, Phụ lục A", note: "m = y × 257 bit, n = y × 8,03125 bit; JC1–JC6 chép ở y instance của client." }),
    S({ id: "frame", kind: "frame", label: "+ AM/EOH/BOH + PAD 5 bit, ghép xen 128 bit → khung 800ZR", ratio: [512, 511], kbps: Z8.frame, frame: "zr800",
      formula: "× 2 631 680/2 626 540 = × 512/511 → 804 979 506,619 kbit/s = 8 × 100 622 438,327 (= 2 × khung 400ZR); 512 × 10 280 bit, ≈ 6,539 µs",
      standard: IA8 + " §4.3–4.4, Hình 5, 9; Bảng 20, Bảng 31", note: "Cấu trúc FlexO-8e (G.709.1 §8.4: 8 × 64 hàng × 10 280)." }),
    S({ id: "crc", kind: "fec", label: "+ CRC32 mỗi 4 hàng + 64 bit pad", ratio: [1193472, 1192480], kbps: Z8.crc,
      formula: "116 hàng × 10 280 = 1 192 480 bit + 29 × 32 CRC + 64 pad = 1 193 472 = 84 × 14 208 bit → 805 649 152,794 kbit/s",
      standard: IA8 + " §5.1–5.2, Hình 15", note: "Nhóm 116 hàng trôi so với khung; rồi xáo trộn x¹⁶ + x¹² + x³ + x + 1 (reset mỗi nhóm)." }),
    S({ id: "ofec", kind: "fec", label: "OFEC (4 bộ mã song song, BCH(256,239) mở rộng)", ratio: [128, 111], kbps: Z8.ofec,
      formula: "Mỗi bộ mã 3552 → 4096 bit: × 128/111 → 929 036 860,880 kbit/s (mã 0,867; parity 17/111 = 15,3 %)",
      standard: IA8 + " §5.6–5.8, Hình 17–21", note: "Mã khối-chập, mỗi bit thuộc 2 từ mã thành phần (khoảng cách Hamming tối thiểu ≥ 42); 2 bộ interleave, mỗi bộ nhận 2 bộ mã. Ngưỡng BER lý thuyết 2 % (ReSNR 12,71 dB, §7.3.5)." }),
    S({ id: "map", kind: "dsp", label: "Ánh xạ DP-16QAM + FAW/TS/RES", ratio: [513, 512], kbps: Z8.faw,
      formula: "172 032 ký hiệu (8 bit) mỗi siêu khung + 22 FAW + 74 RES + 24 × 10 TS = 172 368 → × 513/512 = 930 851 385,999 kbit/s",
      standard: IA8 + " §5.9 (Bảng 14), §5.10, Hình 22", note: "Siêu khung DSP 175 104 ký hiệu = 24 khung con × 7296." }),
    S({ id: "pilot", kind: "dsp", label: "+ Pilot (1 / 64 ký hiệu)", ratio: [64, 63], kbps: Z8.line,
      formula: "2736 pilot / siêu khung: 175 104/172 368 = 64/63 → 945 626 804,824 kbit/s", standard: IA8 + " §5.10, §5.12 Bảng 20",
      note: "Pilot thưa hơn 400ZR (1/64 so với 1/32) – DSP tốt hơn, ít phí hơn." }),
    S({ id: "baud", kind: "symbol", label: "Tốc độ ký hiệu", gbd: Z8.gbd, bitsPerSymbol: 8,
      formula: "945 626 804,824 / 8 = 118 203 350,603 kBd ≈ 118,2 GBd", standard: IA8 + " §5.12 Bảng 20",
      note: "Gần gấp đôi 400ZR: cùng DP-16QAM, gấp đôi tốc độ ký hiệu nên cần kênh rộng gấp đôi." }),
    S({ id: "grid", kind: "optic", label: "Bước sóng DWDM", ghz: 150,
      formula: "193,1 + (n + 3) × 0,025 THz, n chia hết cho 6, n = 114…−72 → 32 kênh 150 GHz, 191,375–196,025 THz (tâm trùng các kênh 75 GHz chẵn của 400ZR)",
      standard: IA8 + " §6.1.1 (Bảng 22), §8.1 (Bảng 30)",
      note: "80–120 km khuếch đại, DWDM; OSNR chịu được 27 dB/12,5 GHz; ba mã ứng dụng 800ZR-A/B/C khác dải công suất phát (Bảng 21)." })
  ];
  window.TLINE = {
    standard: IA4 + "; " + IA8 + "; " + STD1,
    intro: "Một bước sóng coherent mang Ethernet đi qua chuỗi: client (bỏ FEC của Ethernet) → khung ZR (+ OH, GMP) → FEC mạnh của đường dây → ký hiệu DP-16QAM (8 bit mỗi ký hiệu: 4 bit/phân cực × 2) → thêm ký hiệu căn khung và pilot → tốc độ ký hiệu (GBd) → khe tần số DWDM. Mỗi con số tính lại được từ bước trước theo tỉ lệ ghi kèm.",
    chains: [
      { id: "400zr", name: "400ZR (OIF IA 2.0)", unit: "zr400", frame: "zr400", client: "400gbe", standard: IA4 + " §12.5 (Hình 39, Bảng 16)",
        summary: "1 × 400GBASE-R → 478,75 Gbit/s → 59,84 GBd DP-16QAM, kênh 100/75 GHz.", steps: CH400 },
      { id: "800zr", name: "800ZR (OIF IA 1.0)", unit: "zr800", frame: "zr800", client: "800gbe", standard: IA8 + " §5.12 (Bảng 20), Phụ lục A",
        summary: "1 × 800GbE (hoặc 2 × 400GbE / 4 × 200GbE / 8 × 100GbE) → 945,63 Gbit/s → 118,2 GBd DP-16QAM, kênh 150 GHz.", steps: CH800 }
    ],
    compareCols: [
      { id: "400zr", label: "400ZR" }, { id: "800zr", label: "800ZR" },
      { id: "flexo", label: "OTUCn qua FlexO (transponder OTN)" }
    ],
    compare: [
      { label: "Client", "400zr": "1 × 400GBASE-R (400GAUI-8)", "800zr": "8 × 100GE / 4 × 200GE / 2 × 400GE / 1 × 800GE – IA chỉ định nghĩa một loại client mỗi lần; trộn loại nằm ngoài phạm vi IA (§3)", flexo: "Mọi ODUk/ODUflex (100GbE, 400GbE, STM-N, FC…) qua OPUCn → OTUCn",
        source: IA4 + " Bảng 2; " + IA8 + " Bảng 1; ITU-T G.709 (06/2020) §20" },
      { label: "Lớp OTN (ODU/OTU)", "400zr": "Không – Ethernet GMP thẳng vào khung 400ZR", "800zr": "Không – Ethernet GMP thẳng vào 100G ZR instance", flexo: "Có: ODUk → OPUCn (TS 5G) → ODUCn/OTUCn (PM, TCM, GCC) → FlexO-n",
        source: IA4 + " §8.8; " + IA8 + " §4.5; " + STD1 + " §10.1" },
      { label: "Khung", "400zr": "256 × 10 280 bit (+ 690 cột parity), cấu trúc như FlexO-4-DSH (theo IA §8.5; văn bản G.709.3 CHƯA XÁC MINH)", "800zr": "8 × FlexO instance 128 × 5140 bit ghép xen 128 bit (FlexO-8e)", flexo: "n × FlexO instance 128 × 5140 bit; FlexO-x = x × 64 hàng × 10 280 (x = 1, 2, 4, 8)",
        source: IA4 + " §8.5; " + IA8 + " §4.3–4.4; " + STD1 + " §8.1, §8.4" },
      { label: "Tốc độ khung (chưa FEC đường dây)", "400zr": vn(Z4.frame, 3) + " kbit/s", "800zr": vn(Z8.frame, 3) + " kbit/s", flexo: "FlexO-4 = 4 × 105 643 510,782 = " + vn(4 * 491384 / 462961 * 99532800, 3) + " kbit/s (Bảng 8-1, chưa gồm FEC)",
        source: IA4 + " Bảng 6; " + IA8 + " Bảng 20; " + STD1 + " Bảng 8-1" },
      { label: "FEC", "400zr": "C-FEC: staircase HD (255,239) + Hamming SD (128,119), ~14,8 %, NCG ~10,8 dB", "800zr": "OFEC: BCH(256,239) mở rộng, mã khối-chập, 128/111 (15,3 %)", flexo: "Tuỳ giao diện FlexO-x(e)-<int> (G.709.1 03/2024: <int> = DSH hoặc DO): DSH (staircase + Hamming) hoặc DO (oFEC); 100G RS kiểu Ethernet (G.709.5) – chi tiết CHƯA XÁC MINH (không có văn bản G.709.3/.6)",
        source: IA4 + " §10; " + IA8 + " §5.7" },
      { label: "Ngưỡng BER trước FEC (lý thuyết)", "400zr": "1,25·10⁻² (ReSNR 13,67 dB)", "800zr": "2·10⁻² (ReSNR 12,71 dB)", flexo: "Theo FEC giao diện – CHƯA XÁC MINH",
        source: IA4 + " §10, §14.4.5; " + IA8 + " §7.3.5" },
      { label: "Tốc độ bit đường dây", "400zr": vn(Z4.line, 3) + " kbit/s", "800zr": vn(Z8.line, 3) + " kbit/s", flexo: "Tuỳ giao diện (G.709.3/.6) – CHƯA XÁC MINH",
        source: IA4 + " Bảng 16; " + IA8 + " Bảng 20" },
      { label: "Điều chế", "400zr": "DP-16QAM, 8 bit/ký hiệu, mã hoá pha tuyệt đối", "800zr": "DP-16QAM, 8 bit/ký hiệu", flexo: "FlexO-x-DO-16QAM… (G.709.6) – CHƯA XÁC MINH",
        source: IA4 + " §5, §11; " + IA8 + " §5.9" },
      { label: "Tốc độ ký hiệu", "400zr": "59,84375 GBd", "800zr": "118,203350603 GBd", flexo: "CHƯA XÁC MINH", source: IA4 + " §12.5; " + IA8 + " §5.12" },
      { label: "Kênh DWDM", "400zr": "100 GHz (48 kênh) hoặc 75 GHz (64 kênh); flexgrid 12,5 GHz × m", "800zr": "150 GHz (32 kênh)", flexo: "Tuỳ hệ thống DWDM",
        source: IA4 + " §15; " + IA8 + " §8" },
      { label: "Cự ly / ứng dụng", "400zr": "≥ 80 km (≤ 120 km) khuếch đại điểm–điểm; hoặc 1 bước sóng không khuếch đại 11 dB", "800zr": "80–120 km khuếch đại điểm–điểm (DCI)", flexo: "Metro/đường trục, qua ROADM, đa chặng – có giám sát OTN đầu–cuối",
        source: IA4 + " Bảng 17; " + IA8 + " §2, Bảng 21" },
      { label: "Giám sát / quản lý", "400zr": "Tối thiểu: MFAS, STAT (RPF, LD, RD), CRC32 đánh dấu lỗi", "800zr": "BOH: STAT (RF, MNT), CSTAT từng client, MSI, PT 0x40", flexo: "Đầy đủ OTN: TTI, BIP-8, BDI/BEI, 6 mức TCM, GCC, APS",
        source: IA4 + " §8.9; " + IA8 + " §4.3.3; ITU-T G.709 (06/2020) §15" }
    ]
  };
})();
