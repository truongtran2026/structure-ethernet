// Mảng Truyền dẫn – GD7: OTUCn (B100G: OTUC/ODUC/OPUC, n = 1, 2, 4; tributary slot 5G) + FlexO (G.709.1).
// Schema: .claude/skills/transport-frame-spec/references/transport-schema.md (mục "Mở rộng OTN (GD3)")
// Nguồn (đọc nguyên văn, kèm ảnh hình chuẩn):
//   ITU-T G.709/Y.1331 (06/2020): tốc độ Bảng 7-1…7-4, 7-6, 7-7; số TS Bảng 7-9 (cột "# 5G TS – OPUCn");
//     ghép ODTUGCn §7.4 (Hình 7-8, Bảng 7-10, NOTE 3); khung OTUCn §11.3, ODUCn §12.1; OH Hình 15-4, 15-6, 15-12, 15-13;
//     FA OH §15.6, OTU OH §15.7 (SM #1…#n, GCC0, RES), ODU OH §15.8 (PM/TCM #1…#n, EXP 4 byte, RES), OPU OH §15.9;
//     PT 0x22 Bảng 15-9 (dòng "ODU multiplex structure supporting ODTUCn.ts"); OTUCn-AIS §16.4.2;
//     TS 5G §20.1 (Hình 20-1…20-3, Bảng 20-1), ODTUCn §20.2–20.3, MSI/OMFI/JOH §20.4 (Hình 20-7…20-10),
//     GMP ODUk → ODTUCn.ts §20.5 (công thức 20-1a/20-1b); OTUCn-M Phụ lục H.
//   ITU-T G.709.1/Y.1331.1 (03/2024): khung FlexO §8.1 (Hình 8-1), đa khung §8.2, tốc độ Bảng 8-1/8-2, FlexO-x §8.4,
//     OH §9 (BOH Hình 9-2…9-5, EOH Hình 9-9, RSTAT Hình 9-11, PT Bảng 9-1), BMP OTUCn → FlexO-n §10.1 (Hình 10-2).
// CHƯA XÁC MINH: nội dung AM (interface specific, G.709.1 §9.1 'outside the scope'; chuẩn giao diện G.709.3/.5/.6); mã APS/PCC của ODUCn (G.873.1/G.873.2);
//   cách ghép xen n lát OTUC trong OTUCn trên giao diện không phải FlexO (G.709 §11.3: "interface specific").
// Nạp được trước hoặc sau data/transport-otn.js (không đọc TMUX của file khác lúc nạp); lab "otn" (định nghĩa trong
// transport-otn.js) có roots otuc*/flexo-* nên trang PHẢI nạp file này (index.html: frontend thêm, nên đặt sau transport-otn.js).
window.TFRAMES = window.TFRAMES || {};
window.TMUX = window.TMUX || {};
window.TLABS = window.TLABS || [];

(function () {
  var F = window.TFRAMES, M = window.TMUX;
  var STD = "ITU-T G.709/Y.1331 (06/2020)", STD1 = "ITU-T G.709.1/Y.1331.1 (03/2024)";
  var CAT = "OTUCn / FlexO";

  function R(id, abbr, name, kind, rect, desc, extra) {
    var o = { id: id, name: name, abbr: abbr, kind: kind,
      rect: { r: rect[0], c: rect[1], h: rect[2], w: rect[3], step: rect[4] || 1 }, desc: desc };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  function frames(n, fn) { var a = []; for (var i = 0; i < n; i++) if (fn(i)) a.push(i); return a; }
  function vn(x, d) { return x.toLocaleString("vi-VN", { maximumFractionDigits: d === undefined ? 3 : d }).replace(/\./g, " "); }
  function mbps(x) { return vn(x / 1000, 3) + " Mbit/s"; }
  function gbps(x) { return vn(x / 1e6, 3) + " Gbit/s"; }

  // ---------- Tốc độ (kbit/s) – G.709 (06/2020) Bảng 7-1/7-2/7-3/7-7; G.709.1 Bảng 8-1 ----------
  var B = 99532800;                          // = 40 × STM-16 (cơ sở của OTU4 và OTUC)
  var OTUC = 239 / 226 * B;                  // ≈ 105 258 138,053 – OTUC = ODUC (không có vùng FEC)
  var ODUC = 239 / 226 * B;
  var OPUC = 238 / 226 * B;                  // ≈ 104 817 727,434 (OPUC payload)
  var TS5G = OPUC / 20;                      // = 190,4/3824 × ODUC ≈ 5 240 886,372 (ODTUCn.ts, Bảng 7-7)
  var FLEXO = 491384 / 462961 * B;           // ≈ 105 643 510,782 = 4112/4097 × OTUC (G.709.1 Bảng 8-1 NOTE 1)
  var ODU = {                                // ODUk dùng để ghi chú tỉ lệ TS (giống data/transport-otn.js)
    odu0: 1244160, odu1: 239 / 238 * 2488320, odu2: 239 / 237 * 9953280, odu2e: 239 / 237 * 10312500,
    odu3: 239 / 236 * 39813120, odu4: 239 / 227 * B, "oduflex-fc800": 239 / 238 * 8500000,
    "oduflex-gfp-1": 1 * 1249177.230, "oduflex-gfp-8": 8 * 1249177.230, "oduflex-gfp-32": 32 * 1254470.354
  };
  var OTUC_PER = 4 * 3824 * 8 * 1000 / OTUC;          // ≈ 1,163 µs (Bảng 7-4)
  var FLEXO_PER = 128 * 5140 * 1000 / FLEXO;          // ≈ 6,228 µs (G.709.1 Bảng 8-2)

  // =====================================================================
  // Bit field dùng chung (G.709 06/2020 Hình 15-13, 15-6; Bảng 15-1, 15-2, 15-5, 15-7)
  // =====================================================================
  var BEI_BIAE = { name: "Backward Error Indication / Backward Incoming Alignment Error", abbr: "BEI/BIAE", bits: 4,
    desc: "Báo ngược số vi phạm BIP-8 (0–8) đầu thu phát hiện trong lát này. Mã 1011 = BIAE (đầu thu đang thấy IAE, không đếm lỗi). Các mã khác hiểu là 0 lỗi. Với OTUCn, BEI/BIAE có ở cả n lát (BEI/BIAE #1…#n). Với SM, BIAE chỉ được xét ở lát #1 (§15.7.2.1.4 NOTE); với TCM (§15.8.2.2.4) không có NOTE tương đương – CHƯA XÁC MINH lát nào xét BIAE." };
  var BDI = { name: "Backward Defect Indication", abbr: "BDI", bits: 1,
    desc: "= 1 khi đầu thu lớp này đang có lỗi nặng (tín hiệu hỏng) – báo ngược cho đầu phát. OTUCn/ODUCn chỉ có MỘT BDI, nằm ở lát #1." };
  var SM3_C1 = [BEI_BIAE, BDI,
    { name: "Status (OTUCn SM)", abbr: "STAT", bits: 3,
      desc: "Trạng thái đoạn OTUCn (Bảng 15-2): 001 = đang dùng, không có IAE; 010 = đang dùng, có IAE (lệch khung đầu vào – bỏ qua lỗi BIP); 111 = OTUCn-AIS (toàn 1 trừ FA OH, §16.4.2); 000, 011–110 dự trữ. OTUk không có STAT ở SM mà có bit IAE + 2 bit RES – OTUCn thay chúng bằng STAT." }];
  var PM3_C1 = [{ name: "Backward Error Indication", abbr: "BEI", bits: 4, desc: "Số vi phạm BIP-8 của PM (0–8) mà đầu thu luồng ODUCn đếm được trên lát này, gửi ngược về đầu phát (BEI #1…#n)." }, BDI,
    { name: "Status (ODUCn PM)", abbr: "STAT", bits: 3, desc: "Trạng thái luồng (Bảng 15-5): 001 = tín hiệu bình thường; 101 = ODU-LCK; 111 = ODU-AIS; 110 = ODU-OCI với ODUk nhưng DỰ TRỮ với ODUCn (ODUCn không có OCI – §16.5.2 NOTE: ODUCn OCI is not defined); các mã khác dự trữ." }];
  var TCM3_C1 = [BEI_BIAE, BDI,
    { name: "Status (ODUCn TCM)", abbr: "STAT", bits: 3, desc: "Trạng thái TCM (Bảng 15-7): 000 = không có nguồn TC; 001 = đang dùng, không IAE; 010 = đang dùng, có IAE; 101 = ODU-LCK; 111 = ODU-AIS; 110 dự trữ với ODUCn (OCI chỉ có ở ODUk); 011, 100 dự trữ." }];
  var TTI_PF = [
    { frames: frames(256, function (k) { return k % 64 < 16; }), abbr: "SAPI", name: "TTI byte 0–15: SAPI",
      desc: "Byte TTI thứ (MFAS mod 64) thuộc SAPI – định danh điểm phát (byte 0 = 0x00, 15 ký tự T.50). Chỉ lát #1 mang TTI; ở lát #2…#n byte này là RES." },
    { frames: frames(256, function (k) { return k % 64 >= 16 && k % 64 < 32; }), abbr: "DAPI", name: "TTI byte 16–31: DAPI",
      desc: "Byte TTI thứ (MFAS mod 64) thuộc DAPI – định danh điểm thu. Sai SAPI/DAPI so với mong đợi → TIM. Chỉ lát #1." },
    { frames: frames(256, function (k) { return k % 64 >= 32; }), abbr: "Operator", name: "TTI byte 32–63: Operator specific",
      desc: "32 byte riêng của nhà khai thác, không tham gia so khớp TIM. Chỉ lát #1." }
  ];
  function BIP(layer) {
    return "BIP-8 " + layer + ": tính trên vùng OPU (cột 15–3824) của khung i CỦA CHÍNH LÁT NÀY, đặt vào khung i+2. OTUCn/ODUCn có n byte BIP-8 độc lập (BIP-8 #1…#n) – mỗi lát 100G tự giám sát lỗi, BEI #k báo ngược riêng cho lát k.";
  }
  function triple(pfx, layer, r, c, b3bits, b3desc, kind) {
    return [
      R(pfx + "-tti", "TTI", layer + " TTI (lát #1) / RES (lát #2…#n)", kind, [r, c, 1, 1],
        "Vết luồng " + layer + ": 1 byte mỗi khung, chuỗi 64 byte lặp 4 lần trong đa khung MFAS 256 (byte 0 ở MFAS 0x00, 0x40, 0x80, 0xC0). OTUCn/ODUCn chỉ có MỘT TTI – nằm ở lát #1; lát #2…#n để RES (toàn 0).", { perFrame: TTI_PF }),
      R(pfx + "-bip8", "BIP-8", layer + " BIP-8 (#1…#n)", kind, [r, c + 1, 1, 1], BIP(layer),
        { bitFields: [{ name: "BIP-8", abbr: "BIP-8", bits: 8, desc: "Bit i = chẵn lẻ chẵn của bit i mọi byte cột 15–3824 khung i của lát này, chèn ở khung i+2." }] }),
      R(pfx + "-b3", layer === "PM" ? "BEI·BDI·STAT" : "BEI/BIAE·BDI·STAT", layer + " byte 3", kind, [r, c + 2, 1, 1], b3desc, { bitFields: b3bits })
    ];
  }
  function tcm(i, r, c) {
    return R("tcm" + i, "TCM" + i, "Tandem Connection Monitoring #" + i, "poh", [r, c, 1, 3],
      "Giám sát kết nối nối tiếp mức " + i + " của ODUCn: theo dõi một đoạn luồng ODUCn đi qua nhiều mạng con OTSiA (TC-CMEP đặt ở cổng OTUCn biên mạng con, §15.8.2.2). Lát #1: TTI, BIP-8, BEI/BIAE·BDI·STAT; lát #2…#n: RES, BIP-8, BEI/BIAE + 4 bit RES (12 bit RES/lát, §15.8.2.2.9).", {
        children: triple("tcm" + i, "TCM" + i, r, c, TCM3_C1,
          "Lát #1: BEI/BIAE (bit 1–4), BDI (bit 5), STAT (bit 6–8). Lát #2…#n: BEI/BIAE (bit 1–4) + RES (bit 5–8) – BDI và STAT chỉ có một bản ở lát #1.", "poh") });
  }

  // PSI của OPUC (PT 0x22): PSI[0] PT (lát #1) / RES (lát #2…#n), PSI[1] RES, PSI[2…41] MSI (2 byte/TS), PSI[42…255] RES.
  var MSI_AV = [{ name: "TS availability", abbr: "Avail", bits: 1, desc: "Bit 1 của PSI[A.2B]: 1 = TS #A.B khả dụng (có trong OTUCn-M), 0 = không khả dụng (Hình 20-9; OTUCn-M Phụ lục H)." },
    { name: "Tributary port # (bit cao)", abbr: "Port MSB", bits: 7, desc: "Bit 2–8: 7 bit cao của số cổng nhánh 14 bit (0 = cổng #1 … 10n − 1 = cổng #10n). Toàn 0 khi TS chưa cấp." }];
  var MSI_OC = [{ name: "TS occupation", abbr: "Occ", bits: 1, desc: "Bit 1 của PSI[A.2B+1]: 1 = TS #A.B đã cấp cho một ODTUCn.ts, 0 = chưa cấp." },
    { name: "Tributary port # (bit thấp)", abbr: "Port LSB", bits: 7, desc: "Bit 2–8: 7 bit thấp của số cổng nhánh. Các TS cùng một ODUk mang cùng số cổng." }];
  var PSI_PF = [
    { frames: [0], abbr: "PT / RES", name: "PSI[0] – Payload Type (lát #1) / RES (lát #2…#n)",
      desc: "Lát #1: PT = 0x22 – cấu trúc ghép ODU hỗ trợ ODTUCn.ts (Bảng 15-9); OPUCn chỉ chở ODUk qua TS 5G, không ánh xạ client trực tiếp. Lát #2…#n: PSI[0] dự trữ (§20.4.2).",
      bitFields: [{ name: "Payload type", abbr: "PT", bits: 8, desc: "0x22 = 0010 0010 (lát #1)." }] },
    { frames: [1], abbr: "RES", name: "PSI[1] – Reserved", desc: "Dự trữ ở mọi lát, toàn 0." },
    { frames: frames(256, function (k) { return k >= 2 && k <= 41 && k % 2 === 0; }), abbr: "MSI Avail", name: "PSI[A.2B] – MSI: availability + port (bit cao)",
      desc: "MSI của TS #A.B (A = số lát, B = 1…20; B = PSI index / 2): bit 1 = TS khả dụng, bit 2–8 = 7 bit cao số cổng nhánh (Hình 20-8/20-9).", bitFields: MSI_AV },
    { frames: frames(256, function (k) { return k >= 3 && k <= 41 && k % 2 === 1; }), abbr: "MSI Occ", name: "PSI[A.2B+1] – MSI: occupation + port (bit thấp)",
      desc: "MSI của TS #A.B: bit 1 = TS đã cấp, bit 2–8 = 7 bit thấp số cổng nhánh.", bitFields: MSI_OC },
    { frames: frames(256, function (k) { return k >= 42; }), abbr: "RES", name: "PSI[42–255] – Reserved", desc: "Dự trữ, toàn 0 (216n − 1 byte RES tính cả PSI[1] và PSI[0] của lát #2…#n, §20.4.2)." }
  ];

  // GMP JC của ODTUCn.ts – khác GMP của OPUk: Cm 10 bit + CRC-6; ΣCnD 18 bit + CRC-9 (G.709 06/2020 §20.4.3.1, Hình 20-7).
  var JC_BITS = {
    jc1: [{ name: "ΣCnD bit D8–D9", abbr: "D8–D9", bits: 2, desc: "Bit 1–2 của JC1 mang D8, D9 của ΣC8D 18 bit (phần lẻ tích luỹ, n = 8 bit)." },
      { name: "Cm bit C1–C6", abbr: "C1–C6", bits: 6, desc: "6 bit cao của Cm 10 bit – số khối 16·M byte dữ liệu ODUk trong đa khung 20 khung tới (m = 128 × M bit, M = số TS)." }],
    jc2: [{ name: "ΣCnD bit D17–D18", abbr: "D17–D18", bits: 2, desc: "Bit 1–2 của JC2: D17, D18 (D18 là LSB) của ΣC8D." },
      { name: "Cm bit C7–C10", abbr: "C7–C10", bits: 4, desc: "4 bit thấp của Cm." },
      { name: "Increment Indicator", abbr: "II", bits: 1, desc: "Cặp II/DI cho biết Cm tăng/giảm so với lần trước (cơ chế như GMP Phụ lục D)." },
      { name: "Decrement Indicator", abbr: "DI", bits: 1, desc: "Bit giảm của cặp II/DI." }],
    jc3: [{ name: "CRC-9 (2 bit cuối)", abbr: "CRC-9", bits: 2, desc: "Bit 1–2 của JC3: phần cuối của CRC-9 bảo vệ ΣC8D (D1–D18 ở JC4–JC5 bit 2–8 và JC1–JC2 bit 1–2)." },
      { name: "CRC-6", abbr: "CRC-6", bits: 6, desc: "CRC-6 bảo vệ bit 3–8 của JC1–JC3 (Cm, II, DI)." }],
    jc4: [{ name: "Reserved", abbr: "RES", bits: 1, desc: "Bit 1 dự trữ." }, { name: "ΣCnD bit D1–D7", abbr: "D1–D7", bits: 7, desc: "D1 (MSB) … D7 của ΣC8D." }],
    jc5: [{ name: "Reserved", abbr: "RES", bits: 1, desc: "Bit 1 dự trữ." }, { name: "ΣCnD bit D10–D16", abbr: "D10–D16", bits: 7, desc: "D10 … D16 của ΣC8D." }],
    jc6: [{ name: "Reserved", abbr: "RES", bits: 1, desc: "Bit 1 dự trữ." }, { name: "CRC-9 (7 bit đầu)", abbr: "CRC-9", bits: 7, desc: "7 bit đầu của CRC-9 (2 bit còn lại ở JC3 bit 1–2)." }]
  };
  // cOff = cột 0-based của cột 15 (14 trong lưới otuc, 0 trong lưới opuc-ts).
  function jcRegions(cOff, tail) {
    var out = [];
    ["jc1", "jc2", "jc3"].forEach(function (id, i) {
      out.push(R(id, id.toUpperCase(), "GMP " + id.toUpperCase(), "opu-oh", [i, cOff + 1, 1, 1],
        "Byte " + id.toUpperCase() + " (hàng " + (i + 1) + ", cột 16) của TSOH: bit 3–8 thuộc nhóm Cm/II/DI/CRC-6, bit 1–2 thuộc nhóm ΣC8D/CRC-9." + tail, { bitFields: JC_BITS[id] }));
    });
    ["jc4", "jc5", "jc6"].forEach(function (id, i) {
      out.push(R(id, id.toUpperCase(), "GMP " + id.toUpperCase(), "opu-oh", [i, cOff, 1, 1],
        "Byte " + id.toUpperCase() + " (hàng " + (i + 1) + ", cột 15): bit 1 dự trữ, bit 2–8 thuộc ΣC8D (JC4–JC5) hoặc CRC-9 (JC6)." + tail, { bitFields: JC_BITS[id] }));
    });
    return out;
  }
  var OMFI_BITS = [{ name: "Fixed 000", abbr: "000", bits: 3, desc: "Bit 1–3 cố định 000." },
    { name: "OMFI counter 0–19", abbr: "OMFI 0–19", bits: 5, desc: "Bit 4–8 tăng 1 mỗi khung OPUCn, đếm 0…19 rồi quay về 0 – đa khung 20 khung để mỗi TS 5G có TSOH riêng một lần (MFAS 256 không chia hết cho 20, §15.6.2.2 NOTE 2). Chép giống nhau ở n lát; đầu thu chỉ cần xử lý một (§20.4.4 NOTE 2). Tuỳ chọn căn OMFI = 0 trùng MFAS = 0 mỗi 1280 khung." }];

  // =====================================================================
  // Khung OTUC – một lát 4 × 3824 byte của OTUCn (G.709 06/2020 §11.3, Hình 15-4, 15-6, 15-12, 20-7)
  // =====================================================================
  F["otuc"] = {
    id: "otuc", name: "OTUC – một lát 100G của OTUCn (4 × 3824 byte)", family: "otn", category: CAT, order: 10,
    standard: STD + " §11.3, §12.1, §15.6–15.9 (Hình 15-4, 15-6, 15-12, 15-13), §20.4 (Hình 20-7); tốc độ Bảng 7-1, chu kỳ Bảng 7-4",
    summary: "Một lát OTUC 105,258 Gbit/s: 4 × 3824 byte, chu kỳ ≈ 1,163 µs, KHÔNG có vùng FEC; OTUCn = n lát đồng bộ khung/đa khung.",
    detail: "OTUCn (n × 100G, 'beyond 100G') gồm n lát OTUC/ODUC/OPUC giống nhau, đồng bộ khung và đa khung, đánh số #1…#n; mỗi lát là khung 4 hàng × 3824 cột như ODUk nhưng không có 256 cột FEC: FEC tuỳ giao diện (vd. FlexO, G.709.1) và nằm ngoài định nghĩa OTUCn (Bảng 7-1 NOTE 3). Tỉ lệ OPUC payload : ODUC = OTUC = 3808 : 3824 = 238 : 239; OTUC = 239/226 × 99 532 800 kbit/s. Lát #1 mang overhead 'một bản' cho cả OTUCn (TTI, BDI, STAT của SM/PM/TCM, APS/PCC, PM&TCM, PT); trong SM/PM/TCMi, lát #2…#n chỉ có BIP-8 và BEI(/BIAE); TTI, BDI, STAT, APS/PCC, PM&TCM và PT chỉ ở lát #1 (lát #2…#n là RES). FA OH, GCC0/1/2, EXP, PSI/MSI, OMFI và TSOH có ở mọi lát (§15.6.1, §15.7.2.2, §15.8.2.3, §15.8.2.6, §15.8.2.7, §20.4.1.1; Hình 15-6) – lưới vẽ lát #1, desc ghi khác biệt ở lát #2…#n. So với OTUk bản 2012: TCM ACT và FTFL đã bỏ, thay bằng EXP (hàng 2 cột 4 và 14); OTUC không có OSMC (cột 13–14 hàng 1 là RES). Cách ghép xen n lát trên đường truyền là riêng từng giao diện (G.709.x) – với FlexO mỗi lát OTUC đi trong một FlexO instance (G.709.1 §10.1). OPUC OH cột 15–16 là TSOH của TS 5G (JC1–JC6), PSI và OMFI.",
    grid: { rows: 4, cols: 3824, cellBits: 8 }, periodUs: OTUC_PER, rateKbps: OTUC, unit: "otuc1",
    multiframe: { frames: 256, note: "Đa khung 256 theo MFAS (n byte MFAS mang cùng giá trị): TTI 64 byte lặp 4 lần, PSI 256 byte. TSOH của TS 5G (JC1–JC6) KHÔNG theo MFAS mà theo OMFI 20 khung – xem khung opuc-ts." },
    regions: [
      R("fa-oh", "FA OH", "Frame Alignment Overhead (#1…#n)", "fas", [0, 0, 1, 7],
        "Overhead đồng bộ khung (hàng 1, cột 1–7) – có ở cả n lát (FA OH #1…#n, §15.6.1) để đầu thu căn chỉnh và bù lệch (deskew) từng lát.", {
          children: [
            R("fas", "FAS", "Frame Alignment Signal", "fas", [0, 0, 1, 6], "OA1 OA1 OA1 OA2 OA2 OA2 = F6 F6 F6 28 28 28 (§15.6.2.1), giống OTUk.", {
              children: [
                R("oa1", "OA1", "OA1 ×3", "fas", [0, 0, 1, 3], "Byte đồng bộ 0xF6 = 1111 0110.", { values: [{ v: "0xF6", m: "11110110" }] }),
                R("oa2", "OA2", "OA2 ×3", "fas", [0, 3, 1, 3], "Byte đồng bộ 0x28 = 0010 1000.", { values: [{ v: "0x28", m: "00101000" }] })
              ] }),
            R("mfas", "MFAS", "MultiFrame Alignment Signal", "fas", [0, 6, 1, 1],
              "Bộ đếm đa khung 0–255, tăng mỗi khung; n byte MFAS #1…#n luôn cùng giá trị trong mỗi khung (§15.6.2.2) – đầu thu dùng để căn và bù lệch các lát. Đa khung 20 khung của TS 5G không theo MFAS mà theo OMFI.", {
                bitFields: [{ name: "Multiframe counter", abbr: "MFAS", bits: 8, desc: "Bit 1 MSB … bit 8 LSB; bit 3–8 = MFAS mod 64 (TTI)." }] })
          ] }),
      R("otuc-oh", "OTUC OH", "OTUC Overhead (#1…#n)", "soh", [0, 7, 1, 7],
        "Overhead đoạn OTUCn (hàng 1, cột 8–14), n bản OTU OH #1…#n (§15.7.1): SM, GCC0, RES. Không có FEC và không có OSMC (Hình 15-12: cột 13–14 RES ở mọi lát OTUCn).", {
          children: [
            R("sm", "SM", "Section Monitoring (#1…#n)", "soh", [0, 7, 1, 3],
              "Giám sát đoạn OTUCn giữa hai điểm 3R (cột 8–10). SM #1: TTI, BIP-8, BEI/BIAE·BDI·STAT; SM #2…#n: RES, BIP-8, BEI/BIAE + RES (Hình 15-13). OTUCn thay bit IAE + RES của OTUk bằng trường STAT 3 bit.", {
                children: triple("sm", "SM", 0, 7, SM3_C1,
                  "Lát #1: BEI/BIAE (bit 1–4), BDI (bit 5), STAT (bit 6–8, Bảng 15-2). Lát #2…#n: BEI/BIAE (bit 1–4) + RES (bit 5–8).", "soh") }),
            R("gcc0", "GCC0", "General Communication Channel 0 (#1…#n)", "soh", [0, 10, 1, 2],
              "Kênh truyền thông giữa hai đầu OTUCn (cột 11–12). n bản GCC0 #1…#n ghép thành MỘT kênh ≈ n × 13,768 Mbit/s (Hình 15-15); giao diện riêng hãng có thể chỉ dùng GCC0 #1 (≈ 13,768 Mbit/s, §15.7.2.2 NOTE). Băng thông = 2 byte mỗi khung ≈ 1,163 µs."),
            R("otuc-res", "RES", "Reserved (OTUC)", "reserved", [0, 12, 1, 2],
              "Cột 13–14 hàng 1: dự trữ, toàn 0 ở mọi lát OTUCn (Hình 15-12). Ở OTUk cột 13 là OSMC; OTUCn không định nghĩa OSMC ở đây (đồng bộ qua OSMC của FlexO, G.709.1 §9.2.8). Lưu ý: ghi chú §15.7.2.3 nhắc OSMC ở 'frame structure #1 … column 14' nhưng Hình 15-12 vẽ cột 13–14 là RES cho OTUCn và §15.7.2.4 chỉ định nghĩa OSMC cho OTUk/25/50 – data theo hình (RES).")
          ] }),
      R("oduc-oh", "ODUC OH", "ODUC Overhead (#1…#n)", "poh", [1, 0, 3, 14],
        "Overhead luồng ODUCn (hàng 2–4, cột 1–14), n bản ODU OH #1…#n (§15.8.1, Hình 15-6). ODUCn là luồng đầu-cuối giữa hai nút ghép/tách ODUk; TCM của ODUCn giám sát đoạn qua nhiều mạng con OTSiA (§15.8.2.2).", {
          children: [
            R("odu-res1", "RES", "Reserved (hàng 2 cột 1–2)", "reserved", [1, 0, 1, 2], "Dự trữ, toàn 0 ở mọi lát (lát #2…#n còn thêm cột 3)."),
            R("pm-tcm", "PM&TCM", "PM & TCM delay measurement (lát #1) / RES", "poh", [1, 2, 1, 1],
              "Byte đo trễ hai chiều (lát #1): mỗi bit DM là cờ đảo, đầu xa vòng lại, đầu phát đếm số khung tới khi thấy bit đảo quay về (§15.8.2.1.6). Lát #2…#n: RES.", {
                bitFields: [1, 2, 3, 4, 5, 6].map(function (i) { return { name: "Delay measurement TCM" + i, abbr: "DMt" + i, bits: 1, desc: "Bit đo trễ của TCM" + i + "." }; }).concat([
                  { name: "Delay measurement PM", abbr: "DMp", bits: 1, desc: "Bit đo trễ của luồng ODUCn (PM)." },
                  { name: "Reserved", abbr: "RES", bits: 1, desc: "Bit 8 dự trữ (§15.8.2.7)." }]) }),
            R("exp1", "EXP", "Experimental (byte 1/4)", "reserved", [1, 3, 1, 1],
              "Byte thử nghiệm (EXP #1…#n): hãng/nhà khai thác dùng trong mạng con của mình. Bản 06/2020 dùng chỗ của TCM ACT cũ (§15.8.2.2.7 để trống)."),
            tcm(6, 1, 4), tcm(5, 1, 7), tcm(4, 1, 10),
            R("exp2", "EXP", "Experimental (byte 2/4)", "reserved", [1, 13, 1, 1],
              "Byte thử nghiệm – bản 06/2020 dùng chỗ của FTFL cũ (§15.8.2.5 để trống, FTFL không còn trong G.709 2020)."),
            tcm(3, 2, 0), tcm(2, 2, 3), tcm(1, 2, 6),
            R("pm", "PM", "Path Monitoring (#1…#n)", "poh", [2, 9, 1, 3],
              "Giám sát luồng ODUCn đầu-cuối (hàng 3, cột 10–12). PM #1: TTI, BIP-8, BEI·BDI·STAT; PM #2…#n: RES, BIP-8, BEI + 4 bit RES (§15.8.2.1, §15.8.2.1.7).", {
                children: triple("pm", "PM", 2, 9, PM3_C1,
                  "Lát #1: BEI (bit 1–4), BDI (bit 5), STAT (bit 6–8). Lát #2…#n: BEI (bit 1–4) + RES (bit 5–8). Khi có tín hiệu bảo trì ODUCn (AIS, LCK) mọi trường PM trừ STAT không xác định.", "poh") }),
            R("exp3", "EXP", "Experimental (byte 3–4/4)", "reserved", [2, 12, 1, 2], "Hai byte thử nghiệm (hàng 3 cột 13–14), như EXP hàng 2; tổng 4 byte EXP (§15.8.2.6)."),
            R("gcc1", "GCC1", "General Communication Channel 1 (#1…#n)", "poh", [3, 0, 1, 2],
              "Kênh quản lý GCC1 (hàng 4, cột 1–2): n bản ghép thành một kênh ≈ n × 13,768 Mbit/s; GCC1 + GCC2 có thể gộp ≈ n × 27,525 Mbit/s (Hình 15-25)."),
            R("gcc2", "GCC2", "General Communication Channel 2 (#1…#n)", "poh", [3, 2, 1, 2],
              "Kênh quản lý GCC2 (hàng 4, cột 3–4), như GCC1."),
            R("aps-pcc", "APS/PCC", "APS/PCC (lát #1) / RES (lát #2…#n)", "poh", [3, 4, 1, 4],
              "Kênh bảo vệ tự động 4 byte (hàng 4, cột 5–8), chỉ ở lát #1. Với ODUCn dùng để phối hợp hai đầu trong bảo vệ tuyến tính (ODUk CL-SNCG/I – bit và giao thức theo G.873.1) và bảo vệ vòng (ODUk SRP – G.873.2) (§15.8.2.4). Không ghép theo MFAS bit 6–8 như ODUk. Lát #2…#n: RES. // CHƯA XÁC MINH: mã bit cụ thể (G.873.1/G.873.2)."),
            R("odu-res2", "RES", "Reserved (hàng 4 cột 9–14)", "reserved", [3, 8, 1, 6],
              "Dự trữ, toàn 0. Lát #2…#n: dự trữ từ cột 5 tới 14 (13 byte RES/lát, §15.8.2.7).")
          ] }),
      R("opuc-oh", "OPUC OH", "OPUC Overhead (#1…#n)", "opu-oh", [0, 14, 4, 2],
        "Overhead OPUC (cột 15–16) khi ghép ODUk (PT 0x22, Hình 20-7): hàng 1–3 là TSOH của TS 5G đang tới lượt theo OMFI (JC1–JC6 của ODTUCn.ts có TS cuối cùng là TS đó); hàng 4 cột 15 PSI, cột 16 OMFI.", {
          children: [
            R("tsoh", "TSOH", "Tributary Slot Overhead (hàng 1–3)", "opu-oh", [0, 14, 3, 2],
              "6 byte JC1–JC6 thuộc TS #A.(OMFI + 1) (A = số lát). ODTUCn.ts chỉ có MỘT bộ JC, đặt ở TSOH của TS cuối cùng được cấp cho nó (§20.2, §20.3.1); TSOH của các TS khác là RES. Khác GMP của OPUk: Cm chỉ 10 bit (m = 128 × M, đếm khối 16·M byte) + CRC-6, ΣC8D 18 bit + CRC-9.", {
                children: jcRegions(14, " Xem khung opuc-ts để thấy TSOH đổi TS theo OMFI.") }),
            R("psi", "PSI", "Payload Structure Identifier (#1…#n)", "opu-oh", [3, 14, 1, 1],
              "Bản tin PSI 256 byte theo MFAS, mỗi lát một bản (PSI #1…#n). PSI[0] = PT 0x22 ở lát #1 (RES ở lát #2…#n); PSI[1] RES; PSI[2…41] = MSI 40 byte cho 20 TS của lát (2 byte/TS); PSI[42…255] RES (§20.4.1, Hình 20-7/20-8).", { perFrame: PSI_PF }),
            R("omfi", "OMFI", "OPU Multi-Frame Identifier", "opu-oh", [3, 15, 1, 1],
              "Bộ đếm đa khung OPUCn 0–19 (bit 4–8), chọn TS nào được dùng TSOH ở khung này (Bảng 20-1). Có ở cả n lát với cùng giá trị (§20.4.4, Hình 20-10).", { bitFields: OMFI_BITS })
          ] }),
      R("opuc-payload", "OPUC payload", "OPUC Payload (4 × 3808 byte) – 20 TS 5G", "payload", [0, 16, 4, 3808],
        "Vùng tải 15 232 byte/khung/lát ≈ " + gbps(OPUC) + ". Chia 20 tributary slot 5G ghép xen theo KHỐI 16 BYTE (không phải từng byte như OPUk): khối 16 byte thứ i tính liên tục qua các hàng thuộc TS (i mod 20) + 1; mỗi hàng có 238 khối nên hàng sau lùi 2 TS. Mỗi TS ≈ " + mbps(TS5G) + " (Bảng 7-7). Xem khung opuc-ts.")
    ]
  };

  // =====================================================================
  // Khung OPUC – 20 TS 5G (lưới 4 × 3810 = cột 15–3824 của một lát; G.709 06/2020 §20.1, Hình 20-1…20-3, 20-7)
  // =====================================================================
  (function () {
    var BPR = 238;   // khối 16 byte mỗi hàng (3808 / 16)
    function tsOf(f, r, j) { return ((4 * f + r) * BPR + j) % 20 + 1; }
    // perFrame cho khối j hàng r: gom 20 khung OMFI theo số TS.
    function blockPF(r, j) {
      var by = {};
      for (var f = 0; f < 20; f++) { var t = tsOf(f, r, j); (by[t] = by[t] || []).push(f); }
      return Object.keys(by).map(function (t) {
        return { frames: by[t], abbr: "TS A." + t, name: "Khối thuộc TS #A." + t,
          desc: "Ở các khung OMFI = " + by[t].join(", ") + " khối 16 byte này thuộc TS #A." + t + " (A = số lát OPUC)." };
      });
    }
    function block(r, j) {
      var c0 = 2 + 16 * j, col = 17 + 16 * j;
      return R("r" + (r + 1) + "-b" + (j + 1), "TS" + tsOf(0, r, j), "Khối 16 byte #" + (j + 1) + " hàng " + (r + 1) + " (cột " + col + "–" + (col + 15) + ")", "tributary", [r, c0, 1, 16],
        "Khối 16 byte (cột " + col + "–" + (col + 15) + "): ở khung OMFI = 0 thuộc TS #A." + tsOf(0, r, j) + "; khung khác TS đổi theo bảng perFrame. Một ODTUCn.ts đặt 16 byte ODUk liền nhau vào một khối – căn từ 16 byte của ODUk được giữ nguyên (§20.5 NOTE 1).", { perFrame: blockPF(r, j) });
    }
    var rows = [];
    for (var r = 0; r < 4; r++) {
      var first = [], last = [];
      for (var j = 0; j < 20; j++) first.push(block(r, j));
      for (var k = 220; k < 238; k++) last.push(block(r, k));
      var s0 = tsOf(0, r, 0);
      rows.push(R("row" + (r + 1), "Hàng " + (r + 1), "Hàng " + (r + 1) + " – 238 khối 16 byte, bắt đầu TS #A." + s0 + " (khung OMFI = 0)", "payload", [r, 2, 1, 3808],
        "Hàng " + (r + 1) + " gồm 238 khối 16 byte = 11 vòng đủ 20 TS + 18 khối. Ở khung OMFI = 0 hàng bắt đầu bằng TS #A." + s0 + " (Hình 20-1); vì 238 mod 20 = 18 nên mỗi hàng sau lùi 2 TS, chu kỳ lặp 10 hàng = 2,5 khung.", {
          children: [
            R("row" + (r + 1) + "-v1", "Vòng 1", "Vòng 1 (khối 1–20, cột 17–336)", "payload", [r, 2, 1, 320], "Một vòng đủ 20 TS, mỗi TS một khối 16 byte.", { children: first }),
            R("row" + (r + 1) + "-v2", "Vòng 2–11", "Vòng 2–11 (khối 21–220, cột 337–3536)", "tributary", [r, 322, 1, 3200],
              "10 vòng tiếp theo lặp lại đúng thứ tự TS của vòng 1 hàng này (20 khối/vòng, mỗi TS 10 khối = 160 byte). Gộp lại để lưới gọn – không có TS nào khác ở đây."),
            R("row" + (r + 1) + "-v12", "Vòng 12", "Vòng 12 – 18 khối (cột 3537–3824)", "payload", [r, 3522, 1, 288],
              "Vòng dở dang 18 khối: 18 TS đầu của thứ tự hàng này; 2 TS còn lại chuyển sang đầu hàng sau.", { children: last })
          ] }));
    }
    var tsohPF = [];
    for (var f = 0; f < 20; f++) {
      var b = ("0000" + f.toString(2)).slice(-5);
      tsohPF.push({ frames: [f], abbr: "TSOH A." + (f + 1), name: "TSOH của TS #A." + (f + 1) + " (OMFI bit 4–8 = " + b + ")",
        desc: "Khung OMFI = " + f + ": JC1–JC6 thuộc TS #A." + (f + 1) + " (Bảng 20-1). Có nghĩa nếu TS #A." + (f + 1) + " là TS cuối của một ODTUCn.ts; nếu không, 6 byte này RES." });
    }
    F["opuc-ts"] = {
      id: "opuc-ts", name: "OPUC – 20 tributary slot 5G (PT 22)", family: "otn", category: CAT, order: 20,
      standard: STD + " §20.1 (Hình 20-1, 20-2, 20-3, Bảng 20-1), §20.2–20.5 (Hình 20-7…20-10); Bảng 7-6, 7-7, 7-9",
      summary: "Vùng OPUC (cột 15–3824 của một lát) chia 20 TS 5G ghép xen theo khối 16 byte; TSOH luân phiên theo OMFI (đa khung 20 khung).",
      detail: "OPUCn = n OPUC; mỗi OPUC có 20 TS 5G (TS #A.B: A = lát 1…n, B = 1…20), tổng 20n TS ≈ 5,241 Gbit/s mỗi TS. Khác OPUk (ghép xen từng byte/cột), TS 5G ghép xen theo khối 16 byte – khớp với khối 128 bit mà FlexO dùng để mang OTUC (G.709.1 §10.1.2). 3808 cột = 238 khối/hàng, không chia hết cho 20, nên vị trí TS trượt 2 TS mỗi hàng; trên đa khung 20 khung (80 hàng) mỗi TS có đúng 952 khối = 15 232 byte = một khung tải (§20.2: ODTUCn.ts payload 15 232 × ts byte). Lưới vẽ khung OMFI = 0 (giống khung 5, 10, 15); chọn khung để xem TS đổi. ODUk → ODTUCn.ts bằng GMP rồi vào ts TS bất kỳ (không cần liền nhau, chống phân mảnh; §20.3 NOTE 1); thứ tự TS trong OPUCn là n × (B − 1) + A vì các lát OPUC ghép xen 16 byte (Hình 20-3, 20-5). Số TS: ODU0, ODU1 1 TS (không lấp đầy TS), ODU2/ODU2e 2, ODU3 8, ODU4 20, ODUflex(CBR) theo công thức 20-1a (FC-800: 2), ODUflex(GFP) n TS 1,25G → ⌈n/4⌉ TS 5G (công thức 20-1b). OPUCn hỗ trợ tối đa 10n ODUk (cổng nhánh 1…10n, §20 và §20.4.1.1) dù có 20n TS.",
      grid: { rows: 4, cols: 3810, cellBits: 8 }, periodUs: OTUC_PER, rateKbps: 4 * 3810 * 8 * 1000 / OTUC_PER,
      multiframe: { frames: 20, note: "Đa khung OPUCn 20 khung theo OMFI bit 4–8 (0–19), chu kỳ ≈ 23,251 µs (Bảng 7-6): TSOH của TS #A.(OMFI + 1); vị trí TS trong payload trượt theo khung (lặp mỗi 5 khung). PSI vẫn theo MFAS 256 (xem khung otuc)." },
      regions: [
        R("oh", "OPUC OH", "OPUC Overhead (PT 22)", "opu-oh", [0, 0, 4, 2], "Cột 15–16 của lát OTUC: TSOH (JC1–JC6) theo OMFI, PSI, OMFI.", {
          children: [
            R("tsoh", "TSOH", "Tributary Slot Overhead (hàng 1–3)", "opu-oh", [0, 0, 3, 2],
              "6 byte JC của TS đang tới lượt (TS #A.(OMFI + 1)); chọn khung để xem.", { perFrame: tsohPF, children: jcRegions(0, "") }),
            R("psi", "PSI", "Payload Structure Identifier", "opu-oh", [3, 0, 1, 1],
              "PSI 256 byte theo MFAS (không theo OMFI của lưới này): PSI[0] = 0x22 ở lát #1; PSI[2…41] = MSI: TS #A.B dùng PSI[A.2B] (bit 1 availability, bit 2–8 cổng cao) và PSI[A.2B+1] (bit 1 occupation, bit 2–8 cổng thấp); cổng nhánh 14 bit đánh số 1…10n (Hình 20-8/20-9). bitFields dưới đây là byte PSI[A.2B]; byte lẻ PSI[A.2B+1] có Occupation thay Availability.", { bitFields: MSI_AV }),
            R("omfi", "OMFI", "OPU Multi-Frame Identifier", "opu-oh", [3, 1, 1, 1],
              "Hàng 4 cột 16: OMFI đếm 0–19 ở bit 4–8, cho biết TS nào đang dùng TSOH (§20.4.4).", { bitFields: OMFI_BITS })
          ] }),
        R("payload", "20 × TS 5G", "OPUC Payload – 20 TS ghép xen khối 16 byte", "payload", [0, 2, 4, 3808],
          "4 hàng × 238 khối 16 byte; khối thứ i (đếm liên tục từ hàng 1 khung OMFI = 0) thuộc TS #A.((i mod 20) + 1).", { children: rows })
      ]
    };
  })();

  // =====================================================================
  // Khung FlexO – 128 × 5140 bit (G.709.1 03/2024 §8.1, Hình 8-1, 9-2, 9-9, 10-2)
  // =====================================================================
  (function () {
    var MF = 8;
    function all(fn) { return frames(MF, fn); }
    var bohDesc1 = " (BOH của FlexO instance #1; instance #2…#x của cùng giao diện FlexO-x-<int>: FCC1 và OSMC là RES; OSMC chỉ dùng ở instance IID thấp nhất của cả nhóm (§9.2.8); FCC1 là kênh per FlexO-x(e)-<int> (§9.2.6) – Hình 9-2.)";
    F["flexo"] = {
      id: "flexo", name: "FlexO – khung một instance 100G (128 × 5140 bit)", family: "otn", category: CAT, order: 30,
      standard: STD1 + " §8.1–8.4 (Hình 8-1, 8-2; Bảng 8-1, 8-2), §9 (Hình 9-2…9-11; Bảng 9-1), §10.1 (BMP OTUCn → FlexO-n, Hình 10-2)",
      summary: "Khung FlexO instance ≈ 105,644 Gbit/s: 128 hàng × 5140 bit, chu kỳ ≈ 6,228 µs; hàng 1 có AM, EOH, BOH; còn lại là tải mang một lát OTUC.",
      detail: "FlexO (Flexible OTN, G.709.1) là giao diện chở OTUCn: OTUCn được tách thành n lát OTUC, mỗi lát vào một FlexO instance (BMP, §10.1.1); FlexO-n = n instance, đi qua m giao diện FlexO-x-<int> (x instance/giao diện, vd. x = 1 cho 100G, 4 cho 400G; x instance ghép xen z bit, §8.4). Khung instance (bắt nguồn từ cấu trúc FEC/lane của 100GBASE-R clause 91) gồm AM 480 bit, EOH 480 bit, BOH 320 bit ở hàng 1 và 656 640 bit tải. FEC KHÔNG nằm trong khung này: giao diện thêm FEC + đệm sau (RS FEC kiểu Ethernet ở G.709.5, FEC độ lợi cao ở G.709.3, giao diện 400G–800G ở G.709.6) – tốc độ FlexO-n trong Bảng 8-1 chưa gồm FEC. Đa khung 8 khung theo 3 bit thấp MFAS (bit 6–8): BOH 40 byte/khung trải trên 8 khung; 7 khung đầu có thêm 1280 bit fixed stuff ở hàng 65 để FlexO-n = 4112/4097 × OTUCn. Lát OTUC trôi tự do so với khung FlexO, chép theo khối 128 bit (≈ 42,86 khung OTUC mỗi đa khung FlexO, ~ một khung OTUC mỗi 24 hàng FlexO).",
      grid: { rows: 128, cols: 5140, cellBits: 1 }, periodUs: FLEXO_PER, rateKbps: FLEXO, unit: "flexo-1",
      multiframe: { frames: MF, note: "Đa khung FlexO 8 khung = MFAS bit 6–8 (khung 1…8 trong chuẩn = khung 0…7 ở đây). BOH (GID, IID, AVAIL, PT…) và fixed stuff đổi theo khung. MFAS đủ 8 bit đếm 0–255 cho các đa khung lớn hơn." },
      regions: [
        R("am", "AM", "Alignment Marker (bit 1–480)", "fas", [0, 0, 1, 480],
          "Cơ chế căn khung (480 bit đầu hàng 1): đánh dấu đầu khung trên từng lane vật lý để đầu thu bắt khung, sắp lại và bù lệch các lane – vai trò như FAS của OTUk. Mẫu AM cụ thể là riêng từng giao diện, nằm ngoài G.709.1 (§9.1 chỉ ghi 'interface specific and outside the scope'; chuẩn giao diện ở §6.1/§6.2/§8.4 gồm G.709.3, G.709.5, G.709.6 cho 400G–800G). // CHƯA XÁC MINH: giá trị bit AM."),
        R("eoh", "EOH", "Extended Overhead (bit 481–960, 60 byte)", "soh", [0, 480, 1, 480],
          "Overhead mở rộng 60 byte, mỗi khung đủ (không dùng đa khung 8): FlexOfec, Regen, FlexOsec, RES (Hình 9-9). Phần không dùng phát toàn 0. Bản 1.0–2.2 gọi là FlexO PAD.", {
            children: [
              R("eoh-fec", "FlexOfec", "FlexOfec (byte 1–4)", "soh", [0, 480, 1, 32], "Overhead cho FEC giao diện (§9.3.1).", {
                children: [
                  R("fba", "FBA", "Staircase FEC Block Alignment (byte 1)", "soh", [0, 480, 1, 8], "Byte căn khối staircase FEC (SC FEC) của G.709.3 (§9.3.1.1)."),
                  R("eoh-res1", "RES", "Reserved (byte 2–4)", "reserved", [0, 488, 1, 24], "Dự trữ, toàn 0.")
                ] }),
              R("eoh-regen", "Regen", "Regen overhead (byte 5–20)", "soh", [0, 512, 1, 128],
                "Overhead cho trạm lặp FlexO, kết cuối trên MỖI giao diện (§9.3.3) – giám sát từng chặng giữa hai bộ 3R.", {
                  children: [
                    R("rmfas", "RMFAS", "Regen MFAS (byte 5)", "fas", [0, 512, 1, 8], "Bộ đếm đa khung regen 0–255, chạy độc lập với MFAS của BOH (§9.3.3.1)."),
                    R("eoh-res2", "RES", "Reserved (byte 6–10)", "reserved", [0, 520, 1, 40], "Dự trữ, toàn 0."),
                    R("rtti", "RTTI", "Regen Trail Trace Identifier (byte 11)", "soh", [0, 560, 1, 8],
                      "Vết chặng regen 64 byte (cấu trúc như TTI G.709 §15.2), byte 0 ở RMFAS = xx00 0000; chỉ ở instance đầu của giao diện (instance #2…x: RES) (§9.3.3.3)."),
                    R("rstat", "RSTAT", "Regen Status (byte 12)", "soh", [0, 568, 1, 8], "Trạng thái chặng regen (§9.3.3.2, Hình 9-11).", {
                      bitFields: [
                        { name: "Remote fault", abbr: "RF", bits: 1, desc: "= 1: đầu thu FlexO phía xa đang lỗi tín hiệu – báo ngược (§9.3.3.2.1)." },
                        { name: "Reserved", abbr: "RES", bits: 5, desc: "Bit 2–6 dự trữ, đặt 0." },
                        { name: "Remote degrade", abbr: "RD", bits: 1, desc: "= 1: chặng này suy giảm (BER trước FEC) – báo NGƯỢC, chỉ phủ một chặng giao diện." },
                        { name: "Local degrade", abbr: "LD", bits: 1, desc: "= 1: suy giảm BER trước FEC – truyền XUÔI, có thể qua nhiều chặng regen." }] }),
                    R("fcc0", "FCC0", "FlexO regen Communication Channel (byte 13–20)", "soh", [0, 576, 1, 64],
                      "Kênh quản lý regen 8 byte/khung ≈ 10 Mbit/s, chỉ ở instance đầu (instance #2…x: RES) (§9.3.3.4).")
                  ] }),
              R("eoh-sec", "FlexOsec", "FlexOsec overhead (byte 21–52)", "soh", [0, 640, 1, 256],
                "Overhead mã hoá/xác thực tầng FlexO (§9.3.2, Phụ lục A): bảo mật đường truyền giữa hai giao diện FlexO qua sợi/hệ thống quang không an toàn.", {
                  children: [
                    R("at", "AT", "Authentication Tag (byte 21–36)", "soh", [0, 640, 1, 128], "Thẻ xác thực 128 bit tính trên (một phần) khung j của instance i, đặt ở khung j + 1 (§9.3.2.1)."),
                    R("kcc", "KCC", "Key exchange Communication Channel (byte 37)", "soh", [0, 768, 1, 8], "Kênh trao đổi khoá trong băng (tuỳ chọn); theo NOTE 2 §9.3.2.5 chỉ có ở instance đầu mỗi giao diện. Lưu ý: G.709.1 (03/2024) tự mâu thuẫn – Hình 9-9 vẽ KCC ở instance #2…x, còn §9.3.2.5 NOTE 2 nói chỉ instance đầu; data theo NOTE 2."),
                    R("eoh-res3", "RES", "Reserved (byte 38)", "reserved", [0, 776, 1, 8], "Dự trữ."),
                    R("ki-cst", "KI·CST", "Key Index + Cipher Suite Type (byte 39)", "soh", [0, 784, 1, 8], "Chỉ số khoá và loại bộ mã (§9.3.2.3, §9.3.2.4).", {
                      bitFields: [
                        { name: "Key index", abbr: "KI", bits: 2, desc: "Chọn 1 trong 4 khoá (00 = khoá #0 … 11 = khoá #3); đổi ở biên đa khung FlexOsec 4 khung, báo khoá dùng từ đa khung kế tiếp." },
                        { name: "Cipher suite type", abbr: "CST", bits: 6, desc: "000000 = không có nguồn FlexOsec; 000001 = GCM-AES-256 không mã hoá OH (Phụ lục A.1); 010101 / 111111 dành cho LCK / AIS (Bảng 9-3)." }] }),
                    R("eoh-res4", "RES", "Reserved (byte 40)", "reserved", [0, 792, 1, 8], "Dự trữ."),
                    R("fn", "FN", "Frame Number (byte 41–48)", "soh", [0, 800, 1, 64], "Số khung 64 bit, tăng mỗi khung (về 0 khi đổi khoá) – đồng bộ bộ đếm/IV của bộ mã hai đầu; 2 bit cuối tạo đa khung FlexOsec 4 khung (§9.3.2.2)."),
                    R("eoh-res5", "RES", "Reserved (byte 49–52)", "reserved", [0, 864, 1, 32], "Dự trữ.")
                  ] }),
              R("eoh-res6", "RES", "Reserved (byte 53–60)", "reserved", [0, 896, 1, 64], "Dự trữ, toàn 0.")
            ] }),
        R("boh", "BOH", "Basic Overhead (bit 961–1280, 40 byte/khung)", "soh", [0, 960, 1, 320],
          "Overhead cơ bản 40 byte mỗi khung, tổng 320 byte trên đa khung 8 (Hình 9-2): MFAS, STAT, quản lý nhóm (GID, IID, MAP), tải (PT, AVAIL, byte riêng ánh xạ), CRC-16, FCC1, OSMC, RES." + bohDesc1, {
            children: [
              R("b-mfas", "MFAS", "MFAS (byte 1)", "fas", [0, 960, 1, 8], "Đếm khung 0–255 (§9.2.1); bit 6–8 chọn khung trong đa khung 8.", {
                bitFields: [{ name: "MFAS bit 1–5", abbr: "MFAS 1–5", bits: 5, desc: "5 bit cao – cho đa khung lớn hơn (vd. 32 khung dùng bit 4–8 cho OSMC/PTP)." },
                  { name: "MFAS bit 6–8", abbr: "MF 0–7", bits: 3, desc: "Số khung trong đa khung 8 của BOH và fixed stuff." }] }),
              R("b-stat", "STAT", "Status (byte 2)", "soh", [0, 968, 1, 8], "Trạng thái instance (§9.2.3, Hình 9-5).", {
                bitFields: [{ name: "Remote fault", abbr: "RF", bits: 1, desc: "= 1: đầu thu FlexO phía xa lỗi tín hiệu (bản trước 2.5 gọi RPF)." },
                  { name: "Maintenance", abbr: "MNT", bits: 3, desc: "000 = bình thường; 111 = AIS; 101 = LCK; 100 dự trữ (mẫu squelch FlexOsec) (§9.2.3.3)." },
                  { name: "Reserved", abbr: "RES", bits: 4, desc: "Dự trữ, đặt 0." }] }),
              R("b3", "B3", "BOH byte 3", "soh", [0, 976, 1, 8], "Nghĩa đổi theo khung: GID (khung 1), AVAIL (khung 2), RES (khung 3–7), byte riêng ánh xạ (khung 8).", {
                perFrame: [
                  { frames: [0], abbr: "GID", name: "GID bit 1–8 (khung 1)", desc: "Phần đầu của định danh nhóm 20 bit (byte 3, 4 và nửa byte 5 khung 1, §9.2.2.1): kiểm giao diện thuộc đúng nhóm FlexO; 0 = instance chưa dùng (unequipped)." },
                  { frames: [1], abbr: "AVAIL", name: "OTUC availability (khung 2)", desc: "Không dùng; đặt 1 cho giao diện FlexO-1-RS 100G, trường hợp khác dự trữ (§9.2.4.1)." },
                  { frames: all(function (k) { return k >= 2 && k <= 6; }), abbr: "RES", name: "Reserved (khung 3–7)", desc: "Dự trữ, toàn 0." },
                  { frames: [7], abbr: "Client", name: "Client mapping specific (khung 8)", desc: "Byte riêng của ánh xạ client (§9.2.4.3); với BMP OTUCn không dùng – dự trữ (§10.1.4)." }] }),
              R("b4", "B4", "BOH byte 4", "soh", [0, 984, 1, 8], "GID (khung 1), RES (khung 2–8).", {
                perFrame: [
                  { frames: [0], abbr: "GID", name: "GID bit 9–16 (khung 1)", desc: "Phần giữa của GID 20 bit." },
                  { frames: all(function (k) { return k >= 1; }), abbr: "RES", name: "Reserved (khung 2–8)", desc: "Dự trữ, toàn 0." }] }),
              R("b5", "B5", "BOH byte 5", "soh", [0, 992, 1, 8], "Khung 1: 4 bit cuối GID + 4 bit RES; khung 2–8: byte riêng ánh xạ client.", {
                perFrame: [
                  { frames: [0], abbr: "GID·RES", name: "GID bit 17–20 + RES (khung 1)", desc: "Nửa đầu là 4 bit cuối của GID, nửa sau dự trữ (Hình 9-2).",
                    bitFields: [{ name: "GID bit 17–20", abbr: "GID", bits: 4, desc: "4 bit cuối của GID 20 bit." }, { name: "Reserved", abbr: "RES", bits: 4, desc: "Dự trữ." }] },
                  { frames: all(function (k) { return k >= 1; }), abbr: "Client", name: "Client mapping specific (khung 2–8)", desc: "Byte riêng ánh xạ (§9.2.4.3); BMP OTUCn: dự trữ (§10.1.4)." }] }),
              R("b6", "B6", "BOH byte 6", "soh", [0, 1000, 1, 8], "IID (khung 1), PT (khung 5), byte riêng ánh xạ (khung 2–4, 6–8).", {
                perFrame: [
                  { frames: [0], abbr: "IID", name: "Instance ID (khung 1)", desc: "Định danh instance 8 bit, duy nhất trong nhóm, cho biết thứ tự instance để sắp lại; 0 và 255 dự trữ; OTUC #k vào instance có IID tăng dần (§9.2.2.2, §10.1)." },
                  { frames: [4], abbr: "PT", name: "Payload Type (khung 5)", desc: "Kiểu tải (Bảng 9-1): 0x00 = BMP OTUCn → FlexO-n; 0x02 = GMP OTUCn → FlexO-n; 0x05 = GMP Ethernet → FlexO-ne; 0xFE = PRBS; 0x55/0xFF dành cho LCK/AIS.",
                    bitFields: [{ name: "Payload type", abbr: "PT", bits: 8, desc: "0x00 với ánh xạ BMP vẽ ở đây." }] },
                  { frames: [1, 2, 3, 5, 6, 7], abbr: "Client", name: "Client mapping specific", desc: "Byte riêng ánh xạ; BMP OTUCn: dự trữ." }] }),
              R("b-map", "MAP", "FlexO MAP (byte 7–10)", "soh", [0, 1008, 1, 32],
                "Bản đồ thành viên 256 bit trên 8 khung (32 bit/khung): bit = 1 nếu instance có IID tương ứng thuộc nhóm (bit 2 byte 7 khung 1 = IID #1 … bit 7 byte 10 khung 8 = IID #254; bit đầu và bit cuối dự trữ). Gửi đủ trên mọi thành viên (§9.2.2.3, Hình 9-4)."),
              R("b-crc", "CRC-16", "CRC-16 (byte 11–12)", "soh", [0, 1040, 1, 16],
                "CRC-16 (G(x) = x¹⁶ + x⁶ + x⁵ + x³ + 1) bảo vệ byte 2–10 của BOH khung này (không gồm MFAS, FCC1, OSMC) (§9.2.5).",
                { bitFields: [{ name: "CRC-16", abbr: "CRC-16", bits: 16, desc: "Bit đầu phát là hệ số x¹⁵." }] }),
              R("fcc1", "FCC1", "FlexO management Communication Channel (byte 13–26)", "soh", [0, 1056, 1, 112],
                "Kênh quản lý 14 byte/khung (112 byte/đa khung) ≈ 18 Mbit/s mỗi giao diện, chỉ ở instance đầu; không dùng thì phát 0 (§9.2.6)."),
              R("osmc", "OSMC", "OTN Synchronization Message Channel (byte 27–28)", "soh", [0, 1168, 1, 16],
                "Kênh đồng bộ 2 byte/khung (16 byte/đa khung) ≈ 2,56 Mbit/s mỗi giao diện 100G: SSM/PTP đóng GFP-F; chỉ ở instance có IID thấp nhất. Mốc tem thời gian PTP = đa khung 32 khung (MFAS bit 4–8 = 00000) (§9.2.8)."),
              R("b-res", "RES", "Reserved (byte 29–40)", "reserved", [0, 1184, 1, 96], "12 byte dự trữ mỗi khung, toàn 0 (§9.2.7).")
            ] }),
        R("pl1", "Payload", "Payload hàng 1 (bit 1281–5140)", "payload", [0, 1280, 1, 3860],
          "Tải bắt đầu ngay sau BOH; chia khối 128 bit căn từ đầu vùng tải, khối được phép vắt qua hàng (§10.1.2, Hình 10-3). Mỗi khối mang 16 byte liền nhau của lát OTUC (BMP, tốc độ OTUC × 4112/4097 = FlexO)."),
        R("pl2", "Payload", "Payload hàng 2–64", "payload", [1, 0, 63, 5140], "Tải: các khối 128 bit của lát OTUC, nối tiếp."),
        R("fs", "FS", "Fixed Stuff (hàng 65, bit 1–1280)", "stuff", [64, 0, 1, 1280],
          "1280 bit chèn cố định (toàn 0, đầu thu không kiểm) ở 7 khung đầu của đa khung 8; khung thứ 8 dùng chỗ này làm tải. 8 × 1280 bit OH + 7 × 1280 bit FS → tải 5 244 160 / 5 263 360 bit = 4097/4112 (§10.1.2).", {
            perFrame: [
              { frames: all(function (k) { return k <= 6; }), abbr: "FS", name: "Fixed stuff (khung 1–7)", desc: "1280 bit toàn 0 – khung có 5120 khối tải 128 bit." },
              { frames: [7], abbr: "Payload", name: "Tải (khung 8)", desc: "Khung 8 không có FS: 5130 khối tải 128 bit." }] }),
        R("pl3", "Payload", "Payload hàng 65 (bit 1281–5140)", "payload", [64, 1280, 1, 3860], "Tải phần còn lại của hàng 65."),
        R("pl4", "Payload", "Payload hàng 66–128", "payload", [65, 0, 63, 5140], "Tải: khối 128 bit của lát OTUC. Lát OTUC trôi tự do – đầu khung OTUC rơi ở vị trí bất kỳ (≈ 5 khung OTUC mỗi khung FlexO).")
      ]
    };
  })();

  // =====================================================================
  // TMUX – OPUCn / ODUCn / OTUCn / FlexO-n (n = 1, 2, 4)
  // =====================================================================
  function U(o) { o.family = "otn"; M[o.id] = o; }
  function ratio(id, d) { return vn(ODU[id] / TS5G, d === undefined ? 2 : d); }
  // Số TS 5G theo G.709 (06/2020) Bảng 7-9 cột "# 5G TS – OPUCn"; ODUflex(GFP) theo công thức 20-1b ⌈n/4⌉.
  var TSTAB = [
    { of: "odu0", slots: 1, note: "Bảng 7-9: 1 TS. ODU0 = " + ratio("odu0") + " TS – không lấp đầy TS 5G (Bảng 7-10 NOTE)." },
    { of: "odu1", slots: 1, note: "Bảng 7-9: 1 TS. ODU1 = " + ratio("odu1") + " TS – gần nửa TS bỏ trống." },
    { of: "odu2", slots: 2, note: "Bảng 7-9: 2 TS (ODU2 = " + ratio("odu2") + " TS)." },
    { of: "odu2e", slots: 2, note: "Bảng 7-9: 2 TS (ODU2e = " + ratio("odu2e") + " TS; ở OPU3 1,25G cần 9 TS)." },
    { of: "odu3", slots: 8, note: "Bảng 7-9: 8 TS (ODU3 = " + ratio("odu3") + " TS)." },
    { of: "odu4", slots: 20, note: "Bảng 7-9: 20 TS = trọn một lát OPUC (ODU4 = " + ratio("odu4", 4) + " TS; " + vn(ODU.odu4, 3) + " ≤ 20 × " + vn(TS5G, 3) + " = " + vn(20 * TS5G, 3) + " kbit/s)." },
    { of: "oduflex-fc800", slots: 2, note: "Bảng 7-9 dòng ODUflex(FC-800): 2 TS (" + ratio("oduflex-fc800") + " TS; công thức 20-1a)." },
    { of: "oduflex-gfp-1", slots: 1, note: "Công thức 20-1b: M = ⌈1/4⌉ = 1 TS (Bảng 7-9: ODUflex(GFP,n,k) – Note → 20-1b)." },
    { of: "oduflex-gfp-8", slots: 2, note: "Công thức 20-1b: M = ⌈8/4⌉ = 2 TS (" + ratio("oduflex-gfp-8") + " TS danh định)." },
    { of: "oduflex-gfp-32", slots: 8, note: "Công thức 20-1b: M = ⌈32/4⌉ = 8 TS (" + ratio("oduflex-gfp-32") + " TS danh định)." }
  ].concat([5, 10, 15, 20].map(function (n) {
    // GD9: ODUflex(FlexE-aware) = 103 125 000 × 240/238 × n/20 (Bảng 7-2); Bảng 7-9 ghi "Note" → M theo 20-1a (100 ppm, TS 20 ppm).
    var r = 103125000 * 240 / 238 * n / 20;
    return { of: "oduflex-flexe-aware-" + n, slots: n, note: "ODUflex(FlexE-aware) n = " + n + ": " + vn(r, 0) + " kbit/s; M = ⌈" + vn(r * 1.00016 / (TS5G * 0.99998), 3) + "⌉ = " + n + " TS 5G (G.709 06/2020 phương trình 20-1a; Bảng 7-9 dòng ODUflex(FlexE): Note; §17.12, PT 0x1E) – mỗi khe lịch FlexE 5G cần đúng 1 TS 5G." };
  }));
  var LIMIT = function (n) { return " OPUC" + n + " có " + 20 * n + " TS nhưng chỉ " + 10 * n + " cổng nhánh (MSI đánh số 1…" + 10 * n + ", §20.4.1.1; §20: 'up to 10n different ODUk'; §7.4 NOTE 3: không bắt buộc hỗ trợ 20n ODU0/ODU1/ODUflex) – lab chặn ở " + 10 * n + " con mỗi OPUC" + n + "."; };

  [1, 2, 4].forEach(function (n, i) {
    var lv = 60 + 10 * i;
    var opu = "opuc" + n, odu = "oduc" + n, otu = "otuc" + n, flx = "flexo-" + n;
    var nts = 20 * n;
    U({ id: opu, name: "OPUC" + n, kind: "opu", level: lv, rateKbps: n * OPUC, frame: "opuc-ts",
      standard: STD + " §20 (TS 5G, ODTUCn.ts, GMP); tốc độ Bảng 7-3; số TS Bảng 7-9",
      summary: "OPUC" + n + ": payload " + gbps(n * OPUC) + " (= " + n + " × 238/226 × 99 532 800); " + nts + " TS 5G, chỉ chở ODUk (PT 0x22).",
      desc: "OPUCn không ánh xạ client trực tiếp: mọi client (100GbE, 400GbE…) đi vào ODUk/ODUflex trước rồi ghép vào TS 5G bằng GMP (ODTUC" + n + ".ts). " + n + " lát × 20 TS = " + nts + " TS, mỗi TS ≈ " + mbps(TS5G) + ", ghép xen khối 16 byte; ODU0 và ODU1 vẫn tốn trọn 1 TS 5G." + LIMIT(n),
      tribSlots: { n: nts, kbps: TS5G, size: "5G", maxPorts: 10 * n, note: "PT 22: 20 TS/lát OPUC ghép xen khối 16 byte; TSOH theo OMFI bit 4–8 (đa khung 20)" },
      accepts: TSTAB.map(function (t) {
        return { of: t.of, count: Math.min(Math.floor(nts / t.slots), 10 * n), slots: t.slots, mapping: "GMP (ODTUC" + n + "." + t.slots + ")", note: t.note };
      }) });
    U({ id: odu, name: "ODUC" + n, kind: "odu", level: lv + 1, rateKbps: n * ODUC, frame: "otuc",
      standard: STD + " §12.1, §15.8 (ODU OH #1…#n); tốc độ Bảng 7-2",
      summary: "ODUC" + n + " = OPUC" + n + " + " + n + " × ODUC OH: " + gbps(n * ODUC) + ".",
      desc: "Luồng ODUCn gồm " + n + " lát ODUC đồng bộ; trong PM/TCMi, OH #2…#" + n + " chỉ có BIP-8 và BEI(/BIAE); TTI, BDI, STAT, APS/PCC, PM&TCM chỉ ở lát #1 (lát #2…#" + n + " là RES); GCC1/2, EXP, MSI/OMFI, TSOH có ở mọi lát (§15.8.2, §20.4.1.1). ODUCn kết cuối ở hai nút ghép/tách ODUk, không được ghép vào ODU khác.",
      accepts: [{ of: opu, count: 1, overhead: { kbps: n * (ODUC - OPUC), name: n + " × (ODUC OH + OPUC OH), cột 1–16",
        desc: "Mỗi lát 16 cột × 4 hàng = 64 byte/khung: ODUC OH hàng 2–4 cột 1–14, OPUC OH cột 15–16 và chỗ FA/OTUC OH hàng 1 cột 1–14. ODUC/OPUC = 3824/3808 = 239/238." },
        note: "OPUC" + n + " × 239/238 = ODUC" + n + " (" + mbps(n * OPUC) + " + " + mbps(n * (ODUC - OPUC)) + ")." }] });
    U({ id: otu, name: "OTUC" + n, kind: "otu", level: lv + 2, rateKbps: n * OTUC, frame: "otuc",
      standard: STD + " §11.3, §15.6–15.7; tốc độ Bảng 7-1 (NOTE 3: không gồm FEC)",
      summary: "OTUC" + n + " = ODUC" + n + " + FA/OTUC OH: " + gbps(n * OTUC) + " – không có FEC.",
      desc: "Khác OTUk: FA OH và OTUC OH (SM, GCC0) nằm sẵn ở hàng 1 cột 1–14 của mỗi lát ODUC nên OTUC" + n + " = ODUC" + n + " (cùng tốc độ); không có 256 cột FEC – FEC do giao diện thêm (vd. FlexO-" + n + " qua G.709.1). Cách ghép xen " + n + " lát trên đường truyền là riêng từng giao diện (§11.3).",
      accepts: [{ of: odu, count: 1, overhead: { kbps: 0, name: "FA OH + OTUC OH (hàng 1, cột 1–14 mỗi lát) – không tăng tốc độ",
        desc: "Đặt vào chỗ dành sẵn ở hàng 1 cột 1–14 của mỗi khung ODUC; không có vùng FEC nên tỉ lệ OTUC/ODUC = 1." },
        note: "OTUC" + n + " = ODUC" + n + " = " + n + " × 239/226 × 99 532 800 ≈ " + mbps(n * OTUC) + "." }] });
    U({ id: flx, name: "FlexO-" + n, kind: "otu", level: lv + 3, rateKbps: n * FLEXO, frame: "flexo",
      standard: STD1 + " §8.3 Bảng 8-1, §10.1 (BMP OTUCn → FlexO-n), §8.4 (FlexO-x)",
      summary: "FlexO-" + n + " = " + n + " FlexO instance ≈ " + gbps(n * FLEXO) + " (= 4112/4097 × OTUC" + n + ", chưa gồm FEC giao diện).",
      desc: "Giao diện chở OTUC" + n + ": mỗi lát OTUC vào một FlexO instance (IID tăng dần) bằng BMP – khối 128 bit, thêm AM + EOH + BOH và fixed stuff (G.709.1 §10.1). FlexO-" + n + " đi trên m = ⌈" + n + "/x⌉ giao diện FlexO-x-<int> (vd. " + (n === 1 ? "1 giao diện 100G" : n === 2 ? "2 × 100G hoặc 1 × FlexO-2 200G" : "4 × 100G hoặc 1 × FlexO-4 400G") + "); FEC (RS ở G.709.5, FEC mạnh hơn ở G.709.3, G.709.6 cho 400G–800G) và đệm được thêm ở giao diện, ngoài tốc độ này. Kind tạm dùng 'otu' (schema chưa có kind riêng cho FlexO).",
      accepts: [{ of: otu, count: 1, mapping: "BMP (128 bit, PT 0x00)",
        overhead: { kbps: n * (FLEXO - OTUC), name: "AM 480 + EOH 480 + BOH 320 bit mỗi khung + FS 1280 bit ở 7/8 khung",
          desc: "Mỗi đa khung 8 khung: 8 × 1280 bit OH + 7 × 1280 bit fixed stuff = 15 × 1280 bit trên 5 263 360 bit → tải 5 244 160 bit; FlexO/OTUC = 5 263 360 / 5 244 160 = 4112/4097." },
        note: "OTUC" + n + " " + mbps(n * OTUC) + " × 4112/4097 = " + mbps(n * FLEXO) + " (Bảng 8-1 NOTE 1)." }] });
  });
})();
