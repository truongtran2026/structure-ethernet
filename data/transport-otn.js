// Mảng Truyền dẫn – GD3: OTN (khung OTUk, ODUk/OPUk overhead, FEC, ODU0/ODUflex, tributary slot 1,25G, lab OTN).
// GD5: ODUflex(GFP) 1/8/32 TS + Ethernet GFP-F vào OPU2/OPU3 (client eth-*-gfpf định nghĩa trong data/transport-eos.js).
// Schema: .claude/skills/transport-frame-spec/references/transport-schema.md (mục "Mở rộng OTN (GD3)")
// GD8: cập nhật theo ITU-T G.709/Y.1331 (06/2020) – đã đối chiếu nguyên văn (text + render hình/bảng PDF):
//   FA OH §15.6 (Hình 15-9), OTU OH §15.7 (Hình 15-12), ODU OH §15.8 (Hình 15-17…15-19), OPU OH §15.9 (Hình 15-26);
//   bảng: 7-1/7-2/7-3 (tốc độ), 7-8 (ODUflex(GFP,n,k)), 7-9 (số TS), 15-1 (BEI/BIAE OTU), 15-3 (OSMC), 15-4/15-5 (PM BEI/STAT),
//   15-7 (TCM STAT), 15-8 (APS/PCC theo MFAS), 15-9 (PT); khung §11–13, bảo trì §16, ánh xạ client §17 (CBR §17.2/17.7, GFP §17.4,
//   BMP §17.9), §18 để trống, ghép ODTU/TS §19 (MSI §19.4.1, OMFI §19.4.4, GMP §19.6), FEC Annex A, GMP Annex D, Phụ lục XI.
//   Thay đổi so với bản 02/2012 + Amd.4: FTFL (§15.8.2.5) và TCM ACT (§15.8.2.2.7) không còn – hai byte đó thành EXP;
//   OSMC đã nằm trong thân chuẩn (Bảng 15-3); VCAT OPUk-Xv (§18) bỏ; số hình/bảng §17/§19 đã đánh số lại.
//   G.873.1 (APS ODU, chỉ bố cục byte); ITU-T G.Sup43 (02/2011) cho OTU2e (IaDI, Bảng 8-1).
// CHƯA XÁC MINH: mã Request/State của APS/PCC (G.873.1).
// Nạp SAU data/transport-sdh.js (OPU1/2/3 nhận stm-16/64/256 định nghĩa ở đó).
window.TFRAMES = window.TFRAMES || {};
window.TMUX = window.TMUX || {};
window.TLABS = window.TLABS || [];

(function () {
  var F = window.TFRAMES, M = window.TMUX, L = window.TLABS;
  var STD = "ITU-T G.709/Y.1331 (06/2020)";

  // Tạo region. rect = [r, c, h, w, step?] (0-based).
  function R(id, abbr, name, kind, rect, desc, extra) {
    var o = { id: id, name: name, abbr: abbr, kind: kind,
      rect: { r: rect[0], c: rect[1], h: rect[2], w: rect[3], step: rect[4] || 1 }, desc: desc };
    if (extra) for (var k in extra) o[k] = extra[k];
    return o;
  }
  // Danh sách chỉ số khung 0..n-1 thoả điều kiện.
  function frames(n, fn) { var a = []; for (var i = 0; i < n; i++) if (fn(i)) a.push(i); return a; }
  function vn(x, d) { return x.toLocaleString("vi-VN", { maximumFractionDigits: d === undefined ? 3 : d }).replace(/\./g, " "); }

  // ---------- Tốc độ (kbit/s) – G.709 Bảng 7-1/7-2/7-3, viết bằng biểu thức, không làm tròn ----------
  var RATE = {
    opu0: 238 / 239 * 1244160, odu0: 1244160,
    opu1: 2488320, odu1: 239 / 238 * 2488320, otu1: 255 / 238 * 2488320,
    opu2: 238 / 237 * 9953280, odu2: 239 / 237 * 9953280, otu2: 255 / 237 * 9953280,
    opu2e: 238 / 237 * 10312500, odu2e: 239 / 237 * 10312500, otu2e: 255 / 237 * 10312500,
    opu3: 238 / 236 * 39813120, odu3: 239 / 236 * 39813120, otu3: 255 / 236 * 39813120,
    opu4: 238 / 227 * 99532800, odu4: 239 / 227 * 99532800, otu4: 255 / 227 * 99532800,
    flexFc800: 239 / 238 * 8500000
  };

  // =====================================================================
  // Bit field / giá trị dùng chung
  // =====================================================================
  var BEI_BIAE = { name: "Backward Error Indication / Backward Incoming Alignment Error", abbr: "BEI/BIAE", bits: 4,
    desc: "Báo ngược số vi phạm BIP-8 (0–8) đầu thu phát hiện trong khung, để đầu phát biết hiệu năng chiều về. Mã 1011 = BIAE: đầu thu đang thấy IAE (lệch đa khung đầu vào) – khi đó không đếm lỗi BIP. 9–15 (trừ 1011) hiểu là 0 lỗi." };
  var BDI = { name: "Backward Defect Indication", abbr: "BDI", bits: 1,
    desc: "= 1 khi đầu thu ở lớp này đang có lỗi nặng (tín hiệu hỏng – LOS/LOF/LOM, AIS, TIM…) – báo ngược cho đầu phát (tương tự RDI của SDH)." };
  var STAT_PM = { name: "Status", abbr: "STAT", bits: 3,
    desc: "Trạng thái luồng ODU: 001 = tín hiệu bình thường; 101 = ODU-LCK (khoá, bảo trì); 110 = ODU-OCI (chưa đấu chéo – không có tín hiệu đi vào); 111 = ODU-AIS (lỗi phía trước); 000, 010, 011, 100 dự trữ." };
  var STAT_TCM = { name: "Status", abbr: "STAT", bits: 3,
    desc: "Trạng thái TCM: 000 = không có nguồn TC (TCM chưa bật); 001 = đang dùng, không IAE; 010 = đang dùng, có IAE; 011, 100 dự trữ; 101 = ODU-LCK; 110 = ODU-OCI; 111 = ODU-AIS." };
  var SM3_BITS = [BEI_BIAE, BDI,
    { name: "Incoming Alignment Error", abbr: "IAE", bits: 1, desc: "= 1 báo cho đầu thu phía sau rằng đầu vào của đoạn này đã bị lệch khung/đa khung (vd. sau chuyển mạch) – lỗi BIP trong khoảng này không phải do đường truyền." },
    { name: "Reserved", abbr: "RES", bits: 2, desc: "Dự trữ cho chuẩn hoá sau, đặt 00." }];
  var PM3_BITS = [{ name: "Backward Error Indication", abbr: "BEI", bits: 4, desc: "Số vi phạm BIP-8 của PM (0–8) đầu thu luồng phát hiện, gửi ngược về đầu phát. PM không có BIAE vì ODU path không có IAE." }, BDI, STAT_PM];
  var TCM3_BITS = [BEI_BIAE, BDI, STAT_TCM];

  var TTI_PF = [
    { frames: frames(256, function (k) { return k % 64 < 16; }), abbr: "SAPI", name: "TTI byte 0–15: SAPI (định danh điểm phát)",
      desc: "Byte TTI thứ (MFAS mod 64) thuộc SAPI – Source Access Point Identifier: byte 0 = 0x00, 15 byte sau là ký tự T.50 (mã quốc gia + mã nhà khai thác + mã điểm truy nhập)." },
    { frames: frames(256, function (k) { return k % 64 >= 16 && k % 64 < 32; }), abbr: "DAPI", name: "TTI byte 16–31: DAPI (định danh điểm thu)",
      desc: "Byte TTI thứ (MFAS mod 64) thuộc DAPI – Destination Access Point Identifier, cấu trúc như SAPI. Đầu thu so SAPI/DAPI với giá trị mong đợi; sai → TIM (Trace Identifier Mismatch)." },
    { frames: frames(256, function (k) { return k % 64 >= 32; }), abbr: "Operator", name: "TTI byte 32–63: Operator specific",
      desc: "32 byte cuối của TTI dành riêng cho nhà khai thác (vd. tên tuyến, cổng); không tham gia so khớp TIM." }
  ];

  // Ba byte của SM / PM / TCMi.
  function ohTriple(pfx, layer, r, c, byte3Bits, byte3Desc, bipDesc) {
    return [
      R(pfx + "-tti", "TTI", layer + " Trail Trace Identifier", pfx === "sm" ? "soh" : "poh", [r, c, 1, 1],
        "Vết luồng " + layer + ": 1 byte mỗi khung, 64 byte lặp theo đa khung (MFAS mod 64 cho biết byte thứ mấy; 256 khung chứa 4 lần TTI). Gồm SAPI 16 byte, DAPI 16 byte, 32 byte riêng nhà khai thác.", { perFrame: TTI_PF }),
      R(pfx + "-bip8", "BIP-8", layer + " BIP-8", pfx === "sm" ? "soh" : "poh", [r, c + 1, 1, 1], bipDesc,
        { bitFields: [{ name: "BIP-8", abbr: "BIP-8", bits: 8, desc: "Bit i = chẵn lẻ chẵn của bit i mọi byte vùng OPU (cột 15–3824) khung i, chèn vào khung i+2." }] }),
      R(pfx + "-b3", layer === "SM" ? "BEI·BDI·IAE" : "BEI·BDI·STAT", layer + " byte 3", pfx === "sm" ? "soh" : "poh", [r, c + 2, 1, 1], byte3Desc, { bitFields: byte3Bits })
    ];
  }
  var BIP_TXT = function (layer) {
    return "Giám sát lỗi " + layer + ": BIP-8 tính trên toàn vùng OPU (cột 15–3824, gồm OPU OH và payload) của khung i, đặt vào byte này ở khung i+2 (trễ 2 khung để kịp tính). Đầu thu so sánh, đếm số bit vi phạm (0–8) → gửi ngược bằng BEI.";
  };

  function tcm(i, r, c) {
    return R("tcm" + i, "TCM" + i, "Tandem Connection Monitoring #" + i, "poh", [r, c, 1, 3],
      "Giám sát kết nối nối tiếp mức " + i + ": cho phép giám sát một đoạn của luồng ODU (vd. đoạn qua mạng một nhà khai thác, hay đoạn được bảo vệ) độc lập với PM đầu-cuối. 6 mức TCM lồng nhau hoặc nối tiếp; mỗi mức có TTI, BIP-8 và byte BEI/BIAE·BDI·STAT giống PM.", {
        children: ohTriple("tcm" + i, "TCM" + i, r, c, TCM3_BITS,
          "Byte 3 của TCM" + i + ": BEI/BIAE (4 bit), BDI (1 bit), STAT (3 bit). STAT = 000 nghĩa là TCM" + i + " chưa được kích hoạt ở đoạn này.", BIP_TXT("đoạn TCM" + i)) });
  }

  // APS/PCC: ý nghĩa đổi theo MFAS bit 6–8 (MFAS mod 8).
  var APS_LAYER = ["ODUk path (PM), SNC/Ne, CL-SNCG/I, Client SNC/I, SRP-p", "TCM1", "TCM2", "TCM3", "TCM4", "TCM5", "TCM6 (kể cả ODU SRP-1)", "ODUk server layer trail (OTUk hoặc HO ODUk) – ODUk SNC/I"];
  var APS_ABBR = ["APS PM", "APS TCM1", "APS TCM2", "APS TCM3", "APS TCM4", "APS TCM5", "APS TCM6", "APS server"];
  var APS_BITS = [
    { name: "Request/State", abbr: "Req/State", bits: 4, desc: "Yêu cầu/trạng thái bảo vệ: Lockout, Forced Switch, Signal Fail, Signal Degrade, Manual Switch, Wait-to-Restore, Exercise, Reverse Request, Do Not Revert, No Request… (mã theo G.873.1 – CHƯA XÁC MINH mã Req/State)." },
    { name: "Protection type A", abbr: "A", bits: 1, desc: "A = 1: có kênh APS (giao thức APS dùng được); 0: không có kênh APS." },
    { name: "Protection type B", abbr: "B", bits: 1, desc: "B = 0: kiến trúc 1+1 (cầu cố định); 1: 1:n (cầu có chọn)." },
    { name: "Protection type D", abbr: "D", bits: 1, desc: "D = 0: chuyển mạch một chiều; 1: hai chiều." },
    { name: "Protection type R", abbr: "R", bits: 1, desc: "R = 0: không hoàn nguyên (non-revertive); 1: hoàn nguyên (revertive)." },
    { name: "Requested signal", abbr: "Req sig", bits: 8, desc: "Số hiệu tín hiệu được yêu cầu chuyển sang kênh bảo vệ (0 = null signal, 1…n = tín hiệu thường)." },
    { name: "Bridged signal", abbr: "Br sig", bits: 8, desc: "Số hiệu tín hiệu đang được bắc cầu (bridge) sang kênh bảo vệ." },
    { name: "Reserved", abbr: "RES", bits: 8, desc: "Dự trữ (G.873.1), đặt 0." }
  ];
  var APS_PF = APS_LAYER.map(function (lay, j) {
    return { frames: frames(256, function (k) { return k % 8 === j; }), abbr: APS_ABBR[j], name: "APS/PCC cho " + lay + " (MFAS bit 6–8 = " + ("00" + j.toString(2)).slice(-3) + ")",
      desc: "Khi MFAS mod 8 = " + j + ", 4 byte APS/PCC mang kênh bảo vệ tự động cho " + lay + " (G.709 §15.8.2.4, Bảng 15-8).", bitFields: APS_BITS };
  });

  // PSI: PSI[0] PT, PSI[1] RES, PSI[2] CSF (bit 1) + RES (bit 2–8) cho CBR/GMP, PSI[3–255] RES.
  // msi (tuỳ chọn) = { last, desc, bitFields }: khi ghép ODU (PT 20/21) PSI[2…last] là MSI (không có CSF), phần còn lại RES.
  var CSF_BITS = [
    { name: "Client Signal Fail", abbr: "CSF", bits: 1, desc: "= 1: client phía trước đã hỏng (Client Signal Fail). Dùng với ánh xạ CBR (AMP/BMP) và GMP; với GFP chỉ EPL loại 1 mang CSF, các loại khác đặt 0 (§17.1)." },
    { name: "Reserved", abbr: "RES", bits: 7, desc: "Bit 2–8 dự trữ, đặt 0." }];
  function psiPF(pt, ptDesc, msi) {
    var out = [
      { frames: [0], abbr: "PT", name: "PSI[0] – Payload Type", desc: "Kiểu tải PT = " + pt + ": " + ptDesc + " Đầu thu so với PT mong đợi; sai → PLM (Payload Mismatch).",
        bitFields: [{ name: "Payload type", abbr: "PT", bits: 8, desc: "Mã kiểu tải (G.709 §15.9.2.1.1, Bảng 15-9): 0x02 ánh xạ CBR không đồng bộ (AMP), 0x03 CBR đồng bộ bit (BMP), 0x05 GFP, 0x07 Ethernet chuyển mã/PCS (1000BASE-X vào OPU0, 40GBASE-R vào OPU3, 100GBASE-R vào OPU4), 0x09 GFP vào OPU2 mở rộng, 0x0F FC-800 vào OPUflex, 0x20 ghép ODU chỉ ODTUjk (AMP), 0x21 ghép ODU ODTUk.ts (GMP + AMP), 0x22 ghép ODU vào OPUCn (ODTUCn.ts), 0xFD NULL test, 0xFE PRBS…" }] },
      { frames: [1], abbr: "RES", name: "PSI[1] – Reserved", desc: "Byte dự trữ, đặt 0 (CSF không nằm ở đây mà ở PSI[2])." }];
    if (msi) {
      out.push({ frames: frames(256, function (k) { return k >= 2 && k <= msi.last; }), abbr: "MSI", name: "PSI[2–" + msi.last + "] – Multiplex Structure Identifier", desc: msi.desc, bitFields: msi.bitFields });
      out.push({ frames: frames(256, function (k) { return k > msi.last; }), abbr: "RES", name: "PSI[" + (msi.last + 1) + "–255] – Reserved", desc: "Dự trữ, đặt 0." });
    } else {
      out.push({ frames: [2], abbr: "CSF", name: "PSI[2] – CSF + Reserved", desc: "Bit 1 = CSF (Client Signal Fail), bit 2–8 dự trữ. Khi OPU ghép ODU (PT 20/21) PSI[2…] không còn là CSF mà là MSI.", bitFields: CSF_BITS });
      out.push({ frames: frames(256, function (k) { return k >= 3; }), abbr: "RES", name: "PSI[3–255] – Reserved", desc: "Dự trữ, đặt 0." });
    }
    return out;
  }
  // MSI (§19.4.1, Hình 19-19…19-24B)
  var MSI_OPU2 = [
    { name: "ODTU type", abbr: "Type", bits: 2, desc: "Loại ODTU của TS (OPU2, PT 21): 00 = ODTU12, 01 = dự trữ, 10 = ODTU2.ts, 11 = chưa cấp." },
    { name: "Tributary port number − 1", abbr: "Port−1", bits: 6, desc: "Bit 3–8: số cổng nhánh (tributary port) trừ 1 mà TS này thuộc về." }];
  var MSI_NOTE = " Bố cục MSI theo OPU (§19.4.1.3–19.4.1.6): OPU2/OPU3 PT 21 bit 1–2 = loại ODTU (OPU2: 00 ODTU12, 01 RES, 10 ODTU2.ts, 11 chưa cấp; OPU3: 00 ODTU13, 01 ODTU23, 10 ODTU3.ts, 11 chưa cấp), bit 3–8 = cổng nhánh − 1; OPU4: bit 1 = TS bị chiếm/không, bit 2–8 = cổng nhánh − 1 (cổng 1–80); OPU1 PT 20: PSI[2–3] bit 1–2 = 11 (ODTU01).";

  // AMP: byte JC (bit 7–8) + NJO/PJO.
  var JC_AMP_BITS = [
    { name: "Reserved", abbr: "RES", bits: 6, desc: "Bit 1–6 dự trữ (đặt 0)." },
    { name: "Justification Control", abbr: "JC", bits: 2,
      desc: "00: NJO = byte chèn, PJO = dữ liệu (bình thường); 01: NJO = dữ liệu, PJO = dữ liệu (chèn âm – client nhanh hơn); 11: NJO = byte chèn, PJO = byte chèn (chèn dương – client chậm hơn); 10: không phát (đầu thu AMP coi như 00). Đầu thu biểu quyết đa số 2/3 trên 3 byte JC." }
  ];
  // Ba byte JC của AMP (hàng 1–3, cột c), mỗi byte một region có bitFields.
  function ampJc(c, desc) {
    desc = desc + " AMP chịu client lệch tới ±45 ppm (tổng ±65 ppm cùng ±20 ppm của OPU). BMP (JC cố định 00): CBR2G5/10G/40G vào OPU1–3 với client ±20 ppm; CBR10G3 (10GBASE-R) vào OPU2e với ±100 ppm chỉ dùng BMP (OPU2e ±100 ppm nên không hỗ trợ AMP) (§17.2, NOTE 2–3).";
    return R("jc", "JC", "Justification Control ×3", "opu-oh", [0, c, 3, 1], desc, {
      children: [0, 1, 2].map(function (i) {
        return R("jc" + (i + 1), "JC", "JC byte " + (i + 1) + "/3", "opu-oh", [i, c, 1, 1],
          "Bản sao thứ " + (i + 1) + " của JC (hàng " + (i + 1) + "); đầu thu biểu quyết 2/3 trên bit 7–8 của ba byte.", { bitFields: JC_AMP_BITS });
      }) });
  }
  // GMP: JC1–JC3 (Cm, II, DI, CRC-8) – G.709 Annex D.
  var GMP_JC = [
    { id: "jc1", abbr: "JC1", name: "GMP JC1 – C1…C8", bits: [{ name: "Cm bit 1–8", abbr: "C1–C8", bits: 8, desc: "8 bit cao của Cm – số từ client (mỗi từ m bit) mang trong khung (đa khung) kế tiếp." }] },
    { id: "jc2", abbr: "JC2", name: "GMP JC2 – C9…C14, II, DI", bits: [
      { name: "Cm bit 9–14", abbr: "C9–C14", bits: 6, desc: "6 bit thấp của Cm (Cm tổng 14 bit)." },
      { name: "Increment Indicator", abbr: "II", bits: 1, desc: "Cặp II DI (Annex D §D.3, Bảng D.2): 00 = Cm không đổi; 10 = +1/+2 (đảo các bit Ci của Cm(t−1) theo Bảng D.2); 01 = −1/−2; 11 = thay đổi quá ±2, C1–C14 mang thẳng giá trị Cm(t). Bit này là II." },
      { name: "Decrement Indicator", abbr: "DI", bits: 1, desc: "Bit DI của cặp II DI (xem II): 01 = Cm giảm 1/2; 11 = Cm đổi quá ±2, C1–C14 mang thẳng Cm(t)." }] },
    { id: "jc3", abbr: "JC3", name: "GMP JC3 – CRC-8", bits: [{ name: "CRC-8", abbr: "CRC-8", bits: 8, desc: "CRC-8 (đa thức x⁸ + x³ + x² + 1) tính trên JC1–JC2, đầu thu dùng để kiểm Cm (Annex D §D.3)." }] }
  ];
  var JC456 = {
    JC4: [{ name: "Reserved", abbr: "RES", bits: 3, desc: "Dự trữ." }, { name: "D1–D5", abbr: "D1–D5", bits: 5, desc: "5 bit đầu của ΣCnD (D1 là MSB)." }],
    JC5: [{ name: "Reserved", abbr: "RES", bits: 3, desc: "Dự trữ." }, { name: "D6–D10", abbr: "D6–D10", bits: 5, desc: "5 bit sau của ΣCnD." }],
    JC6: [{ name: "Reserved", abbr: "RES", bits: 3, desc: "Dự trữ." }, { name: "CRC-5", abbr: "CRC-5", bits: 5, desc: "CRC-5 (đa thức x⁵ + x + 1) tính trên D1–D10." }]
  };
  // cOff = chỉ số cột (0-based) của cột 15 trong lưới (0 với lưới ánh xạ OPU, 14 với lưới khung OTU).
  function gmpJcRegions(pfx, extraDesc, cOff) {
    cOff = cOff || 0;
    var out = GMP_JC.map(function (j, i) {
      return R(pfx + j.id, j.abbr, j.name, "opu-oh", [i, cOff + 1, 1, 1],
        "Byte điều khiển chèn GMP " + j.abbr + " (hàng " + (i + 1) + ", cột 16)." + (extraDesc || ""), { bitFields: j.bits });
    });
    ["JC4", "JC5", "JC6"].forEach(function (n, i) {
      out.push(R(pfx + n.toLowerCase(), n, "GMP " + n + " – ΣCnD / CRC-5", "opu-oh", [i, cOff, 1, 1],
        "Byte " + n + " (hàng " + (i + 1) + ", cột 15): JC4–JC5 mang ΣCnD (D1–D10) – phần lẻ tích luỹ dưới mức byte để đầu thu khôi phục chính xác pha/tần số đồng hồ client (giảm jitter); JC6 mang CRC-5 bảo vệ D1–D10 (Annex D §D.4, Hình 17-15 cho OPU4, Hình 19-18C cho ODTUk.ts). 3 bit đầu dự trữ.", { bitFields: JC456[n] }));
    });
    return out;
  }

  // =====================================================================
  // Khung OTUk – 4 × 4080 byte, cùng bố cục cho mọi k (G.709 §11, §12, §13, §15)
  // =====================================================================
  function otuRegions(K, o) {
    var oK = "OTU" + K, dK = "ODU" + K, pK = "OPU" + K;
    return [
      // ---- Hàng 1, cột 1–7: FA OH ----
      R("fa-oh", "FA OH", "Frame Alignment Overhead", "fas", [0, 0, 1, 7],
        "Overhead đồng bộ khung (hàng 1, cột 1–7): FAS 6 byte + MFAS 1 byte. Không bị scramble (riêng FAS) để đầu thu bắt nhịp khung.", {
          children: [
            R("fas", "FAS", "Frame Alignment Signal (OA1×3, OA2×3)", "fas", [0, 0, 1, 6],
              "Tín hiệu đồng bộ khung OA1 OA1 OA1 OA2 OA2 OA2 = F6 F6 F6 28 28 28 (cùng giá trị A1/A2 của SDH). Là phần duy nhất của khung " + oK + " không bị scramble (đa thức 1 + x + x³ + x¹² + x¹⁶, §11.2). Mất FAS liên tục → OOF/LOF.", {
                children: [
                  R("oa1", "OA1", "Framing byte OA1", "fas", [0, 0, 1, 3], "Byte đồng bộ khung thứ nhất, cố định 0xF6 (11110110), 3 byte.", { values: [{ v: "0xF6", m: "11110110" }] }),
                  R("oa2", "OA2", "Framing byte OA2", "fas", [0, 3, 1, 3], "Byte đồng bộ khung thứ hai, cố định 0x28 (00101000), 3 byte.", { values: [{ v: "0x28", m: "00101000" }] })
                ] }),
            R("mfas", "MFAS", "MultiFrame Alignment Signal", "fas", [0, 6, 1, 1],
              "Bộ đếm đa khung 0–255, tăng 1 mỗi khung. Mọi overhead trải trên nhiều khung đều căn theo MFAS: TTI 64 byte (MFAS mod 64), PSI 256 byte (§15.9.2.1), APS/PCC theo MFAS bit 6–8, TSOH của OPU2/OPU3 theo MFAS bit 6–8 / 4–8. Mất căn đa khung → LOM.", {
                values: [{ v: "0x00…0xFF", m: "số thứ tự khung trong đa khung 256" }],
                bitFields: [{ name: "Multiframe counter", abbr: "MFAS", bits: 8, desc: "Bit 1 là MSB, bit 8 là LSB. Các bit thấp (bit 6–8 = MFAS mod 8, bit 3–8 = mod 64) dùng để chọn byte của các đa khung con." }] })
          ] }),
      // ---- Hàng 1, cột 8–14: OTU OH ----
      R("otu-oh", "OTU OH", oK + " Overhead", "soh", [0, 7, 1, 7],
        "Overhead đoạn OTU (hàng 1, cột 8–14): giám sát đoạn giữa hai điểm kết cuối OTU (giữa hai bộ 3R/transponder) – tương đương RSOH của SDH.", {
          children: [
            R("sm", "SM", "Section Monitoring", "soh", [0, 7, 1, 3],
              "Giám sát đoạn (cột 8–10): TTI, BIP-8, BEI/BIAE·BDI·IAE. Kết cuối tại mỗi điểm 3R.", {
                children: ohTriple("sm", "SM", 0, 7, SM3_BITS,
                  "Byte 3 của SM: BEI/BIAE (bit 1–4), BDI (bit 5), IAE (bit 6), RES (bit 7–8).", BIP_TXT("đoạn OTU")) }),
            R("gcc0", "GCC0", "General Communication Channel 0", "soh", [0, 10, 1, 2],
              "Kênh truyền thông chung giữa hai điểm kết cuối OTU (cột 11–12, 2 byte/khung, không định dạng sẵn) – dùng làm DCN/kênh quản lý giống DCC_R của SDH. Tốc độ ≈ " + vn(o.rate * 16 / (4 * 4080 * 8), 1) + " kbit/s ở " + oK + "."),
            R("osmc", "OSMC", "OTN Synchronisation Messaging Channel", "soh", [0, 12, 1, 1],
              "Kênh bản tin đồng bộ OTN (hàng 1 cột 13; §15.7.2.4, Hình 15-12): mang SSM, eSSM và PTP, đóng gói GFP-F (G.7041), GFP Idle chèn giữa các khung GFP. Tuỳ chọn (§15.7.2.4 NOTE 1), dùng trên giao diện SOTU/MOTU (điểm-điểm và mạng quang OTN; bản 2012 gọi OTM-0/OTM-nr; OSMC do Amd.4 01/2015 thêm vào, bản 06/2020 đã nằm trong thân chuẩn)." + (o.osmc ? " Băng thông ở " + oK + ": " + o.osmc + " kbit/s (Bảng 15-3)." : " OSMC áp dụng cho OTU1–4 (Bảng 15-3); OTU2e nằm ngoài G.709 nên không có băng thông quy định.")),
            R("otu-res", "RES", "Reserved (OTU)", "reserved", [0, 13, 1, 1],
              "Byte dự trữ của OTU OH (cột 14) cho chuẩn hoá quốc tế sau này, đặt 0x00.")
          ] }),
      // ---- Hàng 2–4, cột 1–14: ODU OH ----
      R("odu-oh", "ODU OH", dK + " Overhead", "poh", [1, 0, 3, 14],
        "Overhead luồng ODU (hàng 2–4, cột 1–14): giám sát đầu-cuối (PM), 6 mức TCM, kênh quản lý GCC1/2, bảo vệ APS/PCC, 4 byte EXP thử nghiệm – tương đương POH + MSOH của SDH. (Bản 02/2012 còn kênh TCM ACT ở hàng 2 cột 4 và kênh FTFL ở hàng 2 cột 14; bản 06/2020 bỏ cả hai, hai byte đó thành EXP.) Hàng 1 cột 1–7 là FA OH, áp dụng cả cho ODU" + K + "; khi ODUj được ghép vào ODTU thì chỉ cột 8–14 (chỗ OTU OH) là toàn 0 (§12.1 NOTE, §15.6.1, §19.5/19.6).", {
          children: [
            R("odu-res1", "RES", "Reserved (ODU, hàng 2)", "reserved", [1, 0, 1, 2], "Hai byte dự trữ hàng 2 cột 1–2, đặt 0x00 (§15.8.2.7: ODUk có 8 byte + 1 bit RES – hàng 2 cột 1–2, hàng 4 cột 9–14, và bit 8 của hàng 2 cột 3)."),
            R("pm-tcm", "PM&TCM", "PM & TCM (delay measurement)", "poh", [1, 2, 1, 1],
              "Byte đo trễ (hàng 2 cột 3; §15.8.2.1.6, §15.8.2.2.8): mỗi bit DM là một bit đảo chiều – đầu phát lật bit, đầu xa vòng lại, đầu phát đo số khung tới khi thấy bit lật quay về → trễ hai chiều của luồng ODU (DMp, bit 7) hoặc đoạn TCMi (DMti, bit 1–6); bit 8 dự trữ.", {
                bitFields: [1, 2, 3, 4, 5, 6].map(function (i) { return { name: "Delay measurement TCM" + i, abbr: "DMt" + i, bits: 1, desc: "Tín hiệu đo trễ của TCM" + i + "." }; }).concat([
                  { name: "Delay measurement PM", abbr: "DMp", bits: 1, desc: "Tín hiệu đo trễ của luồng ODU (PM)." },
                  { name: "Reserved", abbr: "RES", bits: 1, desc: "Bit 8 dự trữ, đặt 0 (§15.8.2.7)." }]) }),
            R("exp-r2c4", "EXP", "Experimental (byte 1/4)", "reserved", [1, 3, 1, 1],
              "Byte thử nghiệm thứ nhất trong 4 byte EXP (§15.8.2.6; hàng 2 cột 4 và 14, hàng 3 cột 13 và 14): không chuẩn hoá, hãng/nhà khai thác dùng trong mạng con của mình. Lịch sử (bản 02/2012): chỗ này là TCM ACT (kênh kích hoạt/khử kích hoạt TCM, vốn 'for further study', chưa định nghĩa nội dung); bản 06/2020 bỏ TCM ACT (§15.8.2.2.7 để trống) và dùng làm EXP."),
            tcm(6, 1, 4), tcm(5, 1, 7), tcm(4, 1, 10),
            R("exp-r2c14", "EXP", "Experimental (byte 2/4)", "reserved", [1, 13, 1, 1],
              "Byte thử nghiệm thứ hai trong 4 byte EXP (§15.8.2.6): không chuẩn hoá, dùng trong mạng con của hãng/nhà khai thác. Lịch sử (bản 02/2012): chỗ này là FTFL (Fault Type & Fault Location) – bản tin 256 byte theo MFAS, 128 byte chiều đi (forward, kèm AIS) và 128 byte chiều về (backward, kèm BDI), mỗi nửa gồm mã loại lỗi (0x00 không lỗi, 0x01 Signal Fail, 0x02 Signal Degrade) + định danh nhà khai thác (mã quốc gia ISO 3166 + ICC theo M.1400) + phần riêng nhà khai thác, giúp biết lỗi nằm ở mạng nhà khai thác nào. Bản 06/2020 đã bỏ FTFL (§15.8.2.5 để trống) nên byte này thành EXP."),
            tcm(3, 2, 0), tcm(2, 2, 3), tcm(1, 2, 6),
            R("pm", "PM", "Path Monitoring", "poh", [2, 9, 1, 3],
              "Giám sát luồng ODU đầu-cuối (hàng 3, cột 10–12): TTI, BIP-8, BEI·BDI·STAT. Kết cuối ở hai đầu luồng ODU" + K + " (nơi ánh xạ/giải ánh xạ client) – tương đương J1/B3/G1 của VC-4.", {
                children: ohTriple("pm", "PM", 2, 9, PM3_BITS,
                  "Byte 3 của PM: BEI (bit 1–4), BDI (bit 5), STAT (bit 6–8) – STAT cho biết ODU bình thường hay đang là tín hiệu bảo trì LCK/OCI/AIS.", BIP_TXT("luồng ODU")) }),
            R("exp", "EXP", "Experimental (byte 3–4/4)", "reserved", [2, 12, 1, 2],
              "Hai byte thử nghiệm (hàng 3 cột 13–14), cùng với hàng 2 cột 4 và cột 14 là tổng 4 byte EXP (§15.8.2.6): nhà sản xuất/nhà khai thác dùng tuỳ ý trong mạng con của mình, không chuẩn hoá, không cần chuyển tiếp ra ngoài mạng con, không đảm bảo liên vận hành."),
            R("gcc1", "GCC1", "General Communication Channel 1", "poh", [3, 0, 1, 2],
              "Kênh truyền thông chung 1 (2 byte) giữa các phần tử truy nhập được khung ODU – dùng cho quản lý/điều khiển."),
            R("gcc2", "GCC2", "General Communication Channel 2", "poh", [3, 2, 1, 2],
              "Kênh truyền thông chung 2 (2 byte), như GCC1, dùng cho quản lý/điều khiển."),
            R("aps-pcc", "APS/PCC", "Automatic Protection Switching / Protection Communication Channel", "poh", [3, 4, 1, 4],
              "Kênh báo hiệu bảo vệ tự động (4 byte, giao thức G.873.1): ghép theo MFAS bit 6–8 để mỗi lớp (PM, TCM1–6, SNC) có kênh APS riêng trên đa khung 8.", { perFrame: APS_PF, bitFields: APS_BITS }),
            R("odu-res2", "RES", "Reserved (ODU, hàng 4)", "reserved", [3, 8, 1, 6], "Sáu byte dự trữ hàng 4 cột 9–14, đặt 0x00.")
          ] }),
      // ---- Cột 15–16: OPU OH ----
      R("opu-oh", "OPU OH", pK + " Overhead", "opu-oh", [0, 14, 4, 2],
        o.gmp
          ? "Overhead của OPU kiểu GMP (cột 15–16, 4 hàng; " + o.ampEx + "): hàng 1–3 cột 16 là JC1–JC3, cột 15 là JC4–JC6; hàng 4 cột 15 là PSI, cột 16 là RES (client) hoặc OMFI (PT 21). OPU4 không có ánh xạ AMP (§17.7.5, Hình 17-15, §19.4.4)."
          : "Overhead của OPU (cột 15–16, 4 hàng): PSI ở hàng 4 cột 15 cho mọi ánh xạ; các byte còn lại tuỳ kiểu ánh xạ. Lưới vẽ kiểu AMP/BMP (vd. " + o.ampEx + "): RES + JC + NJO. Với GMP thì hàng 1–3 cột 15–16 là JC1–JC6; với ghép ODU (PT 20/21) là TSOH luân phiên theo TS.", {
          children: o.gmp
            ? gmpJcRegions("", " Cm cho khung kế tiếp; client 100GBASE-R.", 14).concat([
                R("psi", "PSI", "Payload Structure Identifier", "opu-oh", [3, 14, 1, 1],
                  "Định danh cấu trúc tải: bản tin 256 byte theo MFAS. PSI[0] = PT = 0x07 (100GBASE-R), PSI[1] RES, PSI[2] CSF + RES, PSI[3–255] RES; khi ghép ODU (PT 21) PSI[2…] là MSI." + MSI_NOTE, {
                    perFrame: psiPF("0x07", "ánh xạ 100GBASE-R vào OPU4 bằng GMP.") }),
                R("omfi", "RES/OMFI", "Reserved / OMFI", "opu-oh", [3, 15, 1, 1],
                  "Hàng 4 cột 16: RES (dự trữ, toàn 0) khi OPU4 chở client (vd. PT 0x07, 100GBASE-R) – khi đó bitFields dưới đây không áp dụng; là OMFI (OPU Multi-Frame Identifier) khi ghép ODU (PT 21), dùng thay MFAS vì 256 không chia hết cho 80; cho biết TS nào mang TSOH; tuỳ chọn căn OMFI = 0 trùng MFAS = 0 mỗi 1280 khung (G.709 §15.6.2.2 NOTE 1, Bảng 19-4 và Hình 19-27, §19.4.4 NOTE).", {
                    bitFields: [
                      { name: "OMFI bit 1 (cố định 0)", abbr: "0", bits: 1,
                        desc: "Bit 1 (MSB) của OMFI luôn = 0 (chỉ cần 7 bit để đếm tới 79). Khi OPU4 chở client thay vì ghép ODU, cả byte là RES." },
                      { name: "OPU multi-frame identifier", abbr: "OMFI 0–79", bits: 7,
                        desc: "Bit 2–8: số thứ tự khung trong đa khung OPU4 80 khung (0–79), tăng 1 mỗi khung OPU4 và về 0 sau 79. 80 TS × 1 lượt TSOH mỗi khung → mỗi TS có JC/OH riêng một lần trên 80 khung. Chỉ có nghĩa khi PT = 0x21." }
                    ] })
              ])
            : [
            R("opu-res", "RES", "Reserved (mapping-specific)", "opu-oh", [0, 14, 3, 1],
              "Hàng 1–3 cột 15: dự trữ trong ánh xạ AMP/BMP; GMP dùng làm JC4–JC6."),
            ampJc(15, o.jcNote || "Ba byte điều khiển chèn (hàng 1–3 cột 16) của ánh xạ AMP: bit 7–8 cho biết NJO/PJO khung này là dữ liệu hay byte chèn; biểu quyết đa số 2/3."),
            R("psi", "PSI", "Payload Structure Identifier", "opu-oh", [3, 14, 1, 1],
              "Định danh cấu trúc tải: bản tin 256 byte theo MFAS. PSI[0] = PT (kiểu tải), PSI[1] RES, PSI[2] = CSF (bit 1) + RES, PSI[3–255] RES; khi ghép ODU (PT 20/21) PSI[2…] là MSI, không còn CSF." + MSI_NOTE, {
                perFrame: psiPF(o.pt, o.ptDesc) }),
            R("njo", "NJO", "Negative Justification Opportunity", "opu-oh", [3, 15, 1, 1],
              o.bmp ? "Hàng 4 cột 16: với BMP (OPU2e) JC = 00 cố định nên NJO luôn là byte chèn. Byte PJO (hàng 4 cột 17, đầu payload) luôn là dữ liệu."
                    : "Cơ hội chèn âm (hàng 4 cột 16): mang 1 byte dữ liệu client khi JC = 01 (client nhanh hơn), ngược lại là byte chèn. Byte cơ hội chèn dương PJO nằm ở hàng 4 cột 17 (byte đầu payload).")
          ] }),
      // ---- Cột 17–3824: OPU payload ----
      R("opu-payload", "OPU" + K + " payload", pK + " Payload (4 × 3808 byte)", "payload", [0, 16, 4, 3808],
        "Vùng tải 4 × 3808 = 15 232 byte/khung (" + vn(RATE["opu" + o.key] / 1e6, 6) + " Gbit/s). " + o.payload),
      // ---- Cột 3825–4080: FEC ----
      R("fec", "FEC", oK + " FEC – RS(255,239)", "fec", [0, 3824, 4, 256],
        "Sửa lỗi trước (cột 3825–4080, 4 × 256 = 1024 byte): mỗi hàng chia thành 16 hàng con ghép xen byte (byte thứ j của hàng thuộc từ mã j mod 16); mỗi từ mã Reed-Solomon RS(255,239) gồm 239 byte thông tin (từ cột 1–3824) + 16 byte chẵn lẻ. Mỗi từ mã sửa được tới 8 byte lỗi (hoặc phát hiện 16), ghép xen 16 làm chịu được cụm lỗi tới 16 × 8 = 128 byte liên tiếp mỗi hàng. " + o.fec + " (G.709 Annex A)")
    ];
  }

  var otuSpecs = [
    { key: "1", order: 10, std: STD + " §11–13, §15, Annex A; tốc độ Bảng 7-1",
      ampEx: "STM-16 trong OPU1", osmc: "163,361", pt: "0x02 (ví dụ)", ptDesc: "ánh xạ CBR không đồng bộ (AMP) – vd. STM-16 trong OPU1.",
      payload: "Mang STM-16 (AMP/BMP, không có cột fixed stuff vì OPU1 = đúng 2 488 320 kbit/s) hoặc 2 × ODU0 qua 2 TS 1,25G (PT 20).",
      fec: "Nếu không dùng FEC thì vùng này phát toàn 0.",
      summary: "Khung OTU1 2,666 Gbit/s: 4 × 4080 byte, chu kỳ ≈ 48,97 µs; mang STM-16 hoặc 2 ODU0.",
      extra: "OTU1 = 255/238 × 2 488 320 kbit/s ≈ 2,666057 Gbit/s." },
    { key: "2", order: 20, std: STD + " §11–13, §15, Annex A; tốc độ Bảng 7-1",
      ampEx: "STM-64 trong OPU2", osmc: "656,203", pt: "0x02 (ví dụ)", ptDesc: "ánh xạ CBR không đồng bộ (AMP) – vd. STM-64 trong OPU2.",
      payload: "Ví dụ STM-64 (AMP/BMP, §17.2): 16 cột fixed stuff 1905–1920 + PJO ở hàng 4 cột 17 – nên OPU2 = 238/237 × 9 953 280. Hoặc 8 TS 1,25G (PT 21) chở ODU0/ODU1/ODUflex (xem khung opu2-ts).",
      fec: "Nếu không dùng FEC thì vùng này phát toàn 0.",
      summary: "Khung OTU2 10,709 Gbit/s: 4 × 4080 byte, chu kỳ ≈ 12,19 µs; FA OH, OTU OH, ODU OH, OPU OH, payload, FEC – chi tiết từng byte.",
      extra: "OTU2 = 255/237 × 9 953 280 kbit/s ≈ 10,709225 Gbit/s." },
    { key: "2e", order: 25, std: "Khung OTU2e nằm ngoài G.709 (" + STD + " §11.1 NOTE, Bảng 7-1 NOTE 2), dùng cho IaDI (ITU-T G.Sup43 (02/2011) Bảng 8-1); ODU2e/OPU2e và ánh xạ 10GBASE-R → OPU2e (BMP) thuộc G.709 Bảng 7-2/7-3, §17.2.4",
      ampEx: "10GBASE-R trong OPU2e (BMP)", bmp: true,
      pt: "0x03 (BMP)", ptDesc: "ánh xạ CBR đồng bộ bit (BMP) 10GBASE-R vào OPU2e (OPU2e ±100 ppm nên không hỗ trợ ánh xạ không đồng bộ, §17.2 NOTE 3, §17.2.4).",
      jcNote: "Ba byte JC (hàng 1–3 cột 16) của OPU2e: ánh xạ BMP nên JC = 00 cố định (NJO = byte chèn, PJO = dữ liệu), §17.2.4.",
      payload: "Mang trọn luồng 10GBASE-R 64B/66B 10,3125 Gbit/s (kể cả preamble, IPG, ordered set) bằng BMP – đồng hồ OPU2e khoá theo client, 16 cột fixed stuff như ánh xạ STM-64. Vì vậy OTU2e gọi là OTU2 'ép xung' (over-clocked).",
      fec: "FEC RS(255,239) như OTU2.",
      summary: "Khung OTU2e 11,096 Gbit/s (G.Sup43): bố cục OTU2 nhưng ép xung để chở trong suốt 10GbE LAN PHY.",
      extra: "OTU2e = 255/237 × 10 312 500 kbit/s ≈ 11,095728 Gbit/s; dung sai ±100 ppm. ODU2e, OPU2e và ánh xạ 10GBASE-R → OPU2e (BMP) thuộc thân chuẩn G.709 (Bảng 7-2/7-3, §17.2.4); chỉ khung OTU2e nằm ngoài G.709 (§11.1 NOTE, Bảng 7-1 NOTE 2) và dùng cho IaDI (G.Sup43 Bảng 8-1)." },
    { key: "3", order: 30, std: STD + " §11–13, §15, Annex A; tốc độ Bảng 7-1",
      ampEx: "STM-256 trong OPU3", osmc: "2 635,932", pt: "0x02 (ví dụ)", ptDesc: "ánh xạ CBR không đồng bộ (AMP) – vd. STM-256 trong OPU3.",
      payload: "Ví dụ STM-256 (AMP/BMP): 32 cột fixed stuff (1265–1280, 2545–2560) – nên OPU3 = 238/236 × 39 813 120. Hoặc 40GBASE-R chuyển mã 1024B/1027B (GMP), hoặc 32 TS 1,25G (PT 21).",
      fec: "Nếu không dùng FEC thì vùng này phát toàn 0.",
      summary: "Khung OTU3 43,018 Gbit/s: 4 × 4080 byte, chu kỳ ≈ 3,035 µs; mang STM-256, 40GbE hoặc 32 TS.",
      extra: "OTU3 = 255/236 × 39 813 120 kbit/s ≈ 43,018414 Gbit/s." },
    { key: "4", order: 40, std: STD + " §11–13, §15, Annex A; tốc độ Bảng 7-1",
      ampEx: "100GBASE-R trong OPU4; xem khung opu4-100ge", osmc: "6 851,101", gmp: true,
      payload: "Chỉ 3800 cột đầu (17–3816) mang tải; 8 cột 3817–3824 là fixed stuff – tốc độ danh định OPU4 payload (3808 cột) = 238/227 × 99 532 800 kbit/s, được chọn để 3800 cột hiệu dụng vừa 100GBASE-R và 80 TS. Mang 100GBASE-R (GMP, xem khung opu4-100ge) hoặc 80 TS 1,25G (PT 21).",
      fec: "Với OTU4 FEC RS(255,239) là bắt buộc (không được phát toàn 0), §11.1; biến thể OTU4-SC dùng Staircase FEC theo G.709.2 (không vẽ ở đây).",
      summary: "Khung OTU4 111,81 Gbit/s: 4 × 4080 byte, chu kỳ ≈ 1,168 µs; mang 100GbE hoặc 80 TS 1,25G.",
      extra: "OTU4 ≈ 111,809974 Gbit/s; FEC bắt buộc (§11.1). Ở OPU4 hàng 4 cột 16 là OMFI (bộ đếm đa khung 0–79) khi ghép ODU." }
  ];
  otuSpecs.forEach(function (o) {
    var id = "otu" + o.key, rate = RATE[id];
    o.rate = rate;
    F[id] = {
      id: id, name: "OTU" + o.key + " (" + vn(rate / 1e6, 3) + " Gbit/s)", family: "otn", category: "Khung OTUk", order: o.order,
      standard: o.std, summary: o.summary,
      detail: "Mọi OTUk dùng cùng một khung 4 hàng × 4080 cột byte, truyền theo hàng; chỉ tốc độ (và chu kỳ khung) khác nhau. Cột 1–14: hàng 1 là FA OH (FAS + MFAS, cột 1–7) và OTU OH (SM, GCC0, OSMC, RES, cột 8–14), hàng 2–4 là ODU OH; cột 15–16 là OPU OH; cột 17–3824 là payload OPU; cột 3825–4080 là FEC. Tỉ lệ OPU payload : ODU : OTU = 3808 : 3824 : 4080 = 238 : 239 : 255. Với k = 1…3, OTUk = 255/(239 − k) × tốc độ STM tương ứng; OTU4 = 255/227 × 99 532 800 kbit/s (= 40 × STM-16) và OTU2e = 255/237 × 10 312 500 kbit/s không theo công thức này (G.709 Bảng 7-1, §12.2.1). Đa khung 256 theo MFAS: TTI 64 byte, PSI 256 byte, APS/PCC theo MFAS mod 8. Bản G.709 06/2020 không còn kênh FTFL (256 byte) và TCM ACT của bản 02/2012: hai byte đó (hàng 2 cột 4 và 14) nay là EXP. " + o.extra,
      grid: { rows: 4, cols: 4080, cellBits: 8 }, periodUs: 4 * 4080 * 8 * 1000 / rate, rateKbps: rate, unit: id,
      multiframe: { frames: 256, note: "Đa khung 256 khung đánh số bằng MFAS (0–255). TTI của SM/PM/TCM lặp mỗi 64 khung (4 lần trong đa khung); PSI là bản tin 256 byte; APS/PCC đổi lớp theo MFAS bit 6–8. Bấm TTI, PSI, APS/PCC để xem nghĩa theo khung." },
      regions: otuRegions(o.key, o)
    };
  });

  // =====================================================================
  // Khung ánh xạ vào OPU – lưới 4 × 3810 (cột 15–3824 của khung OTUk; ô 0 = cột 15)
  // =====================================================================
  var MAP_CAT = "Ánh xạ vào OPU";
  function opuPeriod(k) { return 4 * 4080 * 8 * 1000 / RATE["otu" + k]; }

  // ---------- OPU1 chở STM-16 bằng AMP (§17.2) ----------
  (function () {
    var per = opuPeriod("1");
    F["opu1-amp"] = {
      id: "opu1-amp", name: "OPU1 chở STM-16 (AMP)", family: "otn", category: MAP_CAT, order: 10,
      standard: STD + " §17.2 (CBR2G5 vào OPU1, AMP), §15.9 (OPU OH)",
      summary: "Vùng OPU1 (cột 15–3824) chở một STM-16 bằng ánh xạ không đồng bộ AMP: 3 JC, NJO, PJO và PSI.",
      detail: "Lưới là phần OPU1 của khung OTU1 (cột 15–3824). STM-16 2 488 320 kbit/s đúng bằng tốc độ danh định OPU1 payload, nên không cần cột fixed stuff; lệch tần số của client so với đồng hồ OPU (AMP chịu client ±45 ppm, tổng ±65 ppm cùng ±20 ppm của OPU; BMP chỉ cho client ±20 ppm) được bù bằng 1 cơ hội chèn âm (NJO, hàng 4 cột 16) và 1 cơ hội chèn dương (PJO, hàng 4 cột 17) mỗi khung, điều khiển bởi 3 byte JC (biểu quyết 2/3). Với BMP (PT 0x03) đồng hồ OPU lấy từ client nên JC luôn 00. PSI[0] = 0x02 (AMP). Lưới vẽ client đi cố định – thực tế byte STM-16 không căn với khung OTU.",
      grid: { rows: 4, cols: 3810, cellBits: 8 }, periodUs: per, rateKbps: 4 * 3810 * 8 * 1000 / per,
      multiframe: { frames: 256, note: "PSI là bản tin 256 byte theo MFAS của khung OTU1." },
      regions: [
        R("oh", "OPU1 OH", "OPU1 Overhead (AMP)", "opu-oh", [0, 0, 4, 2], "Cột 15–16 của khung OTU1.", {
          children: [
            R("res", "RES", "Reserved", "reserved", [0, 0, 3, 1], "Hàng 1–3 cột 15: dự trữ trong ánh xạ AMP (đặt 0)."),
            ampJc(1, "Ba byte JC giống nhau (hàng 1–3 cột 16); bit 7–8 quyết định NJO và PJO của chính khung này là dữ liệu hay byte chèn."),
            R("psi", "PSI", "Payload Structure Identifier", "opu-oh", [3, 0, 1, 1], "PSI 256 byte theo MFAS; PSI[0] = PT = 0x02 (AMP), PSI[1] RES, PSI[2] = CSF (bit 1) + RES, PSI[3–255] RES. Khi OPU1 ghép ODU0 (PT 20) PSI[2–3] là MSI.", {
              perFrame: psiPF("0x02", "ánh xạ CBR2G5 (STM-16) không đồng bộ AMP; BMP dùng 0x03.") }),
            R("njo", "NJO", "Negative Justification Opportunity", "opu-oh", [3, 1, 1, 1],
              "Cơ hội chèn âm: JC = 01 → mang thêm 1 byte STM-16 (client nhanh hơn); JC = 00 hoặc 11 → byte chèn (bỏ qua).")
          ] }),
        R("payload", "STM-16", "OPU1 Payload – STM-16", "payload", [0, 2, 4, 3808], "4 × 3808 byte tải mang STM-16; không có fixed stuff.", {
          children: [
            R("d13", "D", "Data (hàng 1–3)", "payload", [0, 2, 3, 3808], "Byte dữ liệu STM-16 (hàng 1–3, cột 17–3824)."),
            R("pjo", "PJO", "Positive Justification Opportunity", "opu-oh", [3, 2, 1, 1],
              "Cơ hội chèn dương (hàng 4 cột 17): JC = 11 → byte chèn (client chậm hơn, bỏ một byte); JC = 00 hoặc 01 → dữ liệu."),
            R("d4", "D", "Data (hàng 4)", "payload", [3, 3, 1, 3807], "Byte dữ liệu STM-16 hàng 4 (cột 18–3824).")
          ] })
      ]
    };
  })();

  // ---------- OPU2 PT 21: 8 TS 1,25G (§19) ----------
  (function () {
    var per = opuPeriod("2"), ts = [];
    for (var i = 0; i < 8; i++)
      ts.push(R("ts" + (i + 1), "TS" + (i + 1), "Tributary Slot " + (i + 1), "tributary", [0, 2 + i, 4, 476, 8],
        "TS" + (i + 1) + " 1,25G: cột " + (17 + i) + ", " + (25 + i) + ", " + (33 + i) + " … (mỗi 8 cột một cột), 476 cột × 4 hàng = 1904 byte/khung ≈ " + vn(RATE.opu2 / 8 / 1e6, 4) + " Gbit/s. MSI (PSI[" + (2 + i) + "]) cho biết TS này đang chở ODU nào. Một ODU0 chiếm 1 TS, ODU1 2 TS, ODUflex(FC-800) 7 TS – TS của cùng một ODU không cần liền nhau."));
    var tsPF = [];
    for (var j = 0; j < 8; j++)
      tsPF.push({ frames: [j], abbr: "TSOH TS" + (j + 1), name: "TSOH của TS" + (j + 1) + " (MFAS bit 6–8 = " + ("00" + j.toString(2)).slice(-3) + ")",
        desc: "Khung có MFAS mod 8 = " + j + ": 6 byte này là overhead điều khiển chèn của ODTU dùng TS" + (j + 1) + " – GMP (ODU0, ODUflex): JC1–JC3 cột 16, JC4–JC6 cột 15; AMP (ODTU12 cho ODU1): JC ở cột 16, cột 15 dự trữ. Nếu TS" + (j + 1) + " không phải TS mang JC của ODTU thì các byte này dự trữ." });
    var njoPF = [];
    for (var n = 0; n < 8; n++)
      njoPF.push({ frames: [n], abbr: "NJO TS" + (n + 1), name: "NJO của TS" + (n + 1),
        desc: "Với ODTU12 (AMP): cơ hội chèn âm của ODU1 dùng TSOH ở khung này. Với GMP: dự trữ." });
    F["opu2-ts"] = {
      id: "opu2-ts", name: "OPU2 – 8 tributary slot 1,25G (PT 21)", family: "otn", category: MAP_CAT, order: 20,
      standard: STD + " §19 (TS 1,25G, ODTU12, ODTU2.ts), §15.9.2.1 (PSI), §19.4.1 (MSI), §19.4.3 (JOH), Annex D (GMP)",
      summary: "Vùng OPU2 (cột 15–3824) chia 8 tributary slot 1,25G ghép xen theo cột; TSOH luân phiên theo MFAS mod 8.",
      detail: "PT = 0x21: OPU2 chia payload 3808 cột thành 8 TS ghép xen từng cột (TS1 = cột 17, 25, 33…; TS8 = cột 24, 32…), mỗi TS 476 cột. ODU cấp thấp được ánh xạ vào ODTU rồi vào các TS: ODU1 → ODTU12 (AMP, 2 TS), ODU0 → ODTU2.1 (GMP, 1 TS), ODUflex → ODTU2.ts (GMP, ts TS). Overhead điều khiển chèn của mỗi TS (TSOH: hàng 1–3 cột 15–16 + hàng 4 cột 16) chỉ thuộc về TS đó trong khung có MFAS bit 6–8 = số TS − 1, tức đa khung 8. PSI[0] = 0x21, PSI[2–9] = MSI (mỗi byte một TS: bit 1–2 loại ODTU, bit 3–8 cổng nhánh − 1; §19.4.1). OPU2 không dùng OMFI (chỉ OPU4 có, vì 80 TS không chia hết 256). Lưới vẽ ODU cố định trong TS – thực tế ODTU trôi theo GMP/AMP.",
      grid: { rows: 4, cols: 3810, cellBits: 8 }, periodUs: per, rateKbps: 4 * 3810 * 8 * 1000 / per,
      multiframe: { frames: 8, note: "Đa khung TSOH 8 khung = MFAS bit 6–8 (MFAS mod 8). PSI vẫn chạy theo đa khung 256 của MFAS: PSI[0] = PT 0x21, PSI[1] RES, PSI[2–9] = MSI của TS1–TS8 (xem khung otu2)." },
      regions: [
        R("oh", "OPU2 OH", "OPU2 Overhead (PT 21)", "opu-oh", [0, 0, 4, 2], "Cột 15–16 của khung OTU2: TSOH luân phiên theo TS + PSI.", {
          children: [
            R("tsoh", "TSOH", "Tributary Slot Overhead (hàng 1–3)", "opu-oh", [0, 0, 3, 2],
              "6 byte JC của TS đang tới lượt (theo MFAS mod 8). Chọn khung để thấy TS nào.", {
                perFrame: tsPF,
                children: gmpJcRegions("", " Thuộc TS = (MFAS mod 8) + 1.") }),
            R("psi", "PSI", "Payload Structure Identifier", "opu-oh", [3, 0, 1, 1],
              "PSI 256 byte theo MFAS (đa khung 256, không phải đa khung 8 của lưới này): PSI[0] = 0x21, PSI[1] RES, PSI[2–9] = MSI cho TS1–TS8 (không có CSF), PSI[10–255] RES. Mỗi byte MSI: bit 1–2 = loại ODTU (00 ODTU12, 01 RES, 10 ODTU2.ts, 11 chưa cấp), bit 3–8 = số cổng nhánh − 1 (§19.4.1.5, Hình 19-23A/19-23B; vị trí MSI trong PSI Hình 19-18B/19-18C; PSI ở hàng 4 cột 15 theo Hình 15-26). bitFields dưới đây chỉ áp cho PSI[2–9] (PSI[0] là PT).", {
                bitFields: MSI_OPU2 }),
            R("njo", "NJO", "NJO (TSOH hàng 4)", "opu-oh", [3, 1, 1, 1],
              "Hàng 4 cột 16: NJO của ODTU12 (AMP) dùng TS đang tới lượt; với ODTU2.ts (GMP) là byte dự trữ.", { perFrame: njoPF })
          ] }),
        R("payload", "8 × TS", "OPU2 Payload – 8 TS ghép xen cột", "payload", [0, 2, 4, 3808],
          "3808 cột tải chia đều 8 TS, ghép xen từng cột theo vòng TS1→TS8.", { children: ts })
      ]
    };
  })();

  // ---------- OPU4 chở 100GBASE-R bằng GMP (§17.7.5) ----------
  (function () {
    var per = opuPeriod("4");
    F["opu4-100ge"] = {
      id: "opu4-100ge", name: "OPU4 chở 100GbE (GMP)", family: "otn", category: MAP_CAT, order: 30,
      standard: STD + " §17.7.5, Hình 17-15 + Bảng 17-12 (100GBASE-R vào OPU4, m = 640), Annex D (GMP), §19.4.4 (OPU4 80 TS)",
      summary: "Vùng OPU4 (cột 15–3824) chở 100GBASE-R bằng GMP: JC1–JC6, PSI, 3800 cột tải + 8 cột fixed stuff.",
      detail: "Luồng 100GBASE-R 64B/66B (103,125 Gbit/s, sau khi gom/sắp lại 20 PCS lane) được ánh xạ GMP vào 4 × 3800 byte tải; 8 cột 3817–3824 là fixed stuff. GMP chia tải thành các từ m bit và dùng thuật toán sigma-delta rải đều Cm từ dữ liệu + (tổng − Cm) từ chèn trong khung; Cm (14 bit, JC1–JC2) báo trước cho khung kế tiếp, ΣCnD (JC4–JC5) báo phần lẻ để khôi phục đồng hồ client mịn. Với 100GBASE-R, m = 640 bit (80 byte), Cm ≈ 188,154 từ/khung; 8 cột fixed stuff 3817–3824 (§17.7.5). PSI[0] = 0x07. Bố cục 80 TS của OPU4 khi PT 21 (không vẽ ở đây): 3800 cột tải của 4 hàng xếp nối tiếp thành 15 200 byte và chia vòng 80 TS theo từng byte – hàng 1 cột 17–96 là TS1–TS80, lặp lại; vì 3800 = 47,5 × 80 nên hàng 2 và 4 bắt đầu bằng TS41; mỗi TS có 190 byte/khung; TSOH và OMFI (hàng 4 cột 16, đếm 0–79) quay vòng theo đa khung 80.",
      grid: { rows: 4, cols: 3810, cellBits: 8 }, periodUs: per, rateKbps: 4 * 3810 * 8 * 1000 / per,
      multiframe: { frames: 256, note: "PSI là bản tin 256 byte theo MFAS của khung OTU4. JC1–JC6 cập nhật mỗi khung (GMP không cần đa khung khi OPU chở một client)." },
      regions: [
        R("oh", "OPU4 OH", "OPU4 Overhead (GMP)", "opu-oh", [0, 0, 4, 2], "Cột 15–16 của khung OTU4: JC1–JC6, PSI, RES.", {
          children: gmpJcRegions("", " Cm cho khung kế tiếp; client 100GBASE-R.").concat([
            R("psi", "PSI", "Payload Structure Identifier", "opu-oh", [3, 0, 1, 1], "PSI 256 byte theo MFAS; PSI[0] = PT = 0x07 (Ethernet PCS – 100GBASE-R GMP), PSI[1] RES, PSI[2] = CSF (bit 1) + RES, PSI[3–255] RES. Khi ghép ODU (PT 21) PSI[2…] là MSI: bit 1 = TS bị chiếm/không, bit 2–8 = cổng nhánh − 1 (cổng 1–80; toàn 0 khi bit 1 = 0) (§19.4.1.4, Hình 19-22A/19-22B; MSI chiếm PSI[2…81]).", {
              perFrame: psiPF("0x07", "ánh xạ 100GBASE-R vào OPU4 bằng GMP.") }),
            R("res", "RES", "Reserved", "reserved", [3, 1, 1, 1], "Hàng 4 cột 16: dự trữ với ánh xạ client (khi OPU4 ghép ODU, PT 21, đây là OMFI 0–79).")
          ]) }),
        R("payload", "100GBASE-R", "OPU4 Payload – 4 × 3800 byte (GMP)", "payload", [0, 2, 4, 3800],
          "15 200 byte/khung cho dữ liệu 100GBASE-R hoặc byte chèn GMP rải đều; dung lượng ≈ " + vn(RATE.opu4 * 3800 / 3808 / 1e6, 4) + " Gbit/s ≥ 103,125 Gbit/s."),
        R("fs", "FS", "Fixed Stuff (cột 3817–3824)", "stuff", [0, 3802, 4, 8],
          "8 cột × 4 hàng = 32 byte chèn cố định không mang dữ liệu – để OPU4 payload hiệu dụng = 3800 cột (ODU4 = 239/227 × 99 532 800 kbit/s)." )
      ]
    };
  })();

  // =====================================================================
  // TMUX – cây ghép kênh OTN (theo tốc độ kbit/s)
  // =====================================================================
  function U(o) { o.family = "otn"; M[o.id] = o; }

  // ---------- Client ----------
  U({ id: "1gbe", name: "1GbE (1000BASE-X)", kind: "client", level: 1, rateKbps: 1250000, standard: "IEEE 802.3 Clause 36; G.709 §17.7.1, §17.7.1.1 (chuyển mã TTT), §17.8.1",
    summary: "Gigabit Ethernet 1000BASE-X: 1,25 Gbaud mã 8B/10B.",
    desc: "Vào OTN qua ODU0: chuyển mã TTT (timing transparent transcoding) xuống 15/16 tốc độ đường dây = 1 171 875 kbit/s rồi GMP vào OPU0 – giữ được cả định thời và ký tự điều khiển." });
  U({ id: "fc-800", name: "FC-800 (8GFC)", kind: "client", level: 2, rateKbps: 8500000, standard: "INCITS FC-PI-4; G.709 §17.9 (OPUflex BMP)",
    summary: "Fibre Channel 8G: 8,5 Gbaud mã 8B/10B.",
    desc: "Không vừa ODU nào cố định một cách tiết kiệm, nên đi bằng ODUflex(CBR) có tốc độ = 239/238 × 8,5 Gbit/s, ánh xạ BMP (PT 0x0F); chiếm 7 TS 1,25G." });
  U({ id: "10gbe", name: "10GbE (10GBASE-R)", kind: "client", level: 3, rateKbps: 10312500, standard: "IEEE 802.3 Clause 49; G.709 §17.2.4 (OPU2e, BMP), §17.4 (GFP-F)",
    summary: "10 Gigabit Ethernet LAN PHY: 10,3125 Gbit/s mã 64B/66B.",
    desc: "Lớn hơn OPU2 (≈ 9,995 Gbit/s) nên KHÔNG vào OPU2 trọn vẹn: hoặc ép xung thành ODU2e/OPU2e (BMP trong suốt, G.709 §17.2.4), hoặc GFP-F chỉ mang khung MAC (G.Sup43 §6.2 = G.709 §17.4, OPU2 PT 0x05 – xem client 'Ethernet 10G (GFP-F)'). GFP-F vào OPU2 mở rộng (mượn 7 byte OPU OH) là G.709 §17.4.1 (PT 0x09)." });
  U({ id: "40gbe", name: "40GbE (40GBASE-R)", kind: "client", level: 4, rateKbps: 41250000, standard: "IEEE 802.3 Clause 82; G.709 §17.7.4",
    summary: "40 Gigabit Ethernet: 4 lane × 10,3125 Gbit/s = 41,25 Gbit/s mã 64B/66B.",
    desc: "41,25 Gbit/s lớn hơn OPU3 (≈ 40,15 Gbit/s) nên phải chuyển mã 64B/66B → 1024B/1027B (gộp 16 khối 66 bit thành 1027 bit) còn 40,117 Gbit/s rồi mới GMP vào OPU3." });
  U({ id: "100gbe", name: "100GbE (100GBASE-R)", kind: "client", level: 5, rateKbps: 103125000, standard: "IEEE 802.3 Clause 82; G.709 §17.7.5",
    summary: "100 Gigabit Ethernet: 103,125 Gbit/s mã 64B/66B (20 PCS lane).",
    desc: "Vừa thẳng OPU4 (3800 cột ≈ 104,13 Gbit/s) không cần chuyển mã, ánh xạ GMP – đây là lý do OPU4 có tỉ lệ 238/227 khác các OPUk khác." });

  // ---------- Hàm tạo ODU / OTU ----------
  function oduOH(k) { return { kbps: RATE["odu" + k] - RATE["opu" + k], name: "ODU" + k + " OH + OPU" + k + " OH (cột 1–16)",
    desc: "16 cột × 4 hàng = 64 byte/khung: ODU OH hàng 2–4 cột 1–14, OPU OH cột 15–16, và hàng 1 cột 1–14 (FA OH cột 1–7 áp dụng cả ODUk; chỉ cột 8–14, chỗ OTU OH, toàn 0 khi ODUj vào ODTU). Tỉ lệ ODU/OPU = 3824/3808 = 239/238." }; }
  function otuOH(k) { return { kbps: RATE["otu" + k] - RATE["odu" + k], name: "FEC 256 cột (+ FA OH/OTU OH ghi vào hàng 1 cột 1–14)",
    desc: "Tốc độ tăng do 256 cột FEC RS(255,239) (4 × 256 = 1024 byte/khung); FA OH (cột 1–7) và OTU OH (cột 8–14) chiếm chỗ có sẵn ở hàng 1 của khung ODU nên không làm tăng tốc độ. Tỉ lệ OTU/ODU = 4080/3824 = 255/239." }; }
  function mbps(x) { return vn(x / 1000, 3) + " Mbit/s"; }

  function oduUnit(k, level, extra) {
    U({ id: "odu" + k, name: "ODU" + k, kind: "odu", level: level, rateKbps: RATE["odu" + k], leafOk: true,
      standard: STD + " §12, §15.8; tốc độ Bảng 7-2" + (k === "2e" ? "; ODU2e theo Bảng 7-2/7-3, §17.2.4" : ""),
      summary: "Đơn vị dữ liệu quang ODU" + k + " = OPU" + k + " + ODU OH: " + mbps(RATE["odu" + k]) + ".",
      desc: "Luồng đầu-cuối được đấu chéo trong chuyển mạch ODU: OH có PM (TTI/BIP-8/BEI/BDI/STAT), 6 mức TCM, GCC1/2, APS/PCC, EXP (bản 02/2012 còn FTFL và TCM ACT, bản 06/2020 bỏ). " + extra,
      accepts: [{ of: "opu" + k, count: 1, overhead: oduOH(k), note: "OPU" + k + " × 239/238 = ODU" + k + " (" + mbps(RATE["opu" + k]) + " + " + mbps(RATE["odu" + k] - RATE["opu" + k]) + ")." }] });
  }
  function otuUnit(k, level, extra) {
    U({ id: "otu" + k, name: "OTU" + k, kind: "otu", level: level, rateKbps: RATE["otu" + k], frame: "otu" + k,
      standard: k === "2e" ? "Khung OTU2e ngoài G.709 (" + STD + " §11.1 NOTE, Bảng 7-1 NOTE 2); IaDI theo ITU-T G.Sup43 (02/2011) Bảng 8-1" : STD + " §11, §15.6–15.7, Annex A; tốc độ Bảng 7-1",
      summary: "Đơn vị truyền tải quang OTU" + k + " = ODU" + k + " + FA/OTU OH + FEC: " + mbps(RATE["otu" + k]) + ".",
      desc: "Khung 4 × 4080 byte truyền trên một bước sóng giữa hai điểm 3R: thêm FAS/MFAS, SM (TTI, BIP-8, BEI/BIAE, BDI, IAE), GCC0 và FEC RS(255,239), rồi scramble. " + extra,
      accepts: [{ of: "odu" + k, count: 1, overhead: otuOH(k), note: "ODU" + k + " × 255/239 = OTU" + k + " (" + mbps(RATE["odu" + k]) + " + FEC " + mbps(RATE["otu" + k] - RATE["odu" + k]) + ")." }] });
  }

  // ---------- ODU0 ----------
  U({ id: "opu0", name: "OPU0", kind: "opu", level: 10, rateKbps: RATE.opu0, standard: STD + " §13, §17.7.1; tốc độ Bảng 7-3",
    summary: "OPU0: payload " + mbps(RATE.opu0) + " (= 238/239 × 1 244 160), cho client ~1 Gbit/s.",
    desc: "OPU nhỏ nhất, sinh ra để chở 1GbE mà không phí cả ODU1. G.709 không định nghĩa OTU0 (Bảng 7-1 NOTE 2; chỉ có OTU0LL độ trễ thấp ở Annex G) – ODU0 được ghép vào TS 1,25G của OPU bậc cao.",
    accepts: [{ of: "1gbe", count: 1, fit: "le", carriedKbps: 1250000 * 15 / 16, mapping: "GMP (TTT 15/16)",
      note: "1000BASE-X sau chuyển mã TTT còn 1 171 875 kbit/s ≤ OPU0 ≈ 1 238 954 kbit/s; GMP rải byte chèn. PT 0x07." },
      { of: "eth-1g-gfpf", count: 1, fit: "le", carriedKbps: 1000000 * 1526 / 1538, mapping: "GFP-F (PT 0x05)",
        note: "Khung MAC 1GbE qua GFP-F: 1 000 000 × 1526/1538 ≈ 992 198 kbit/s ≤ OPU0 ≈ 1 238 954 kbit/s; GFP Idle lấp phần thừa (G.709 §17.4 cho GFP vào OPUk k = 0,1,2,3,4,flex). Khác phương án 1000BASE-X: không trong suốt mức PCS." }] });
  U({ id: "odu0", name: "ODU0", kind: "odu", level: 11, rateKbps: RATE.odu0, leafOk: true, standard: STD + " §12; tốc độ Bảng 7-2",
    summary: "ODU0 = 1 244 160 kbit/s (đúng một nửa STM-16) – vừa 1 TS 1,25G.",
    desc: "Đơn vị đấu chéo nhỏ nhất của OTN. Vào OPU1 bằng AMP (ODTU01, PT 20) hoặc vào OPU2/3/4 bằng GMP (ODTUk.1, PT 21), mỗi lần 1 TS. Không ghép 2 ODU0 để chở STM-16: tải OPU0 (≈ 1,239 Gbit/s) nhỏ hơn STM-16 và G.709 không có OPU0-Xv (bản 02/2012 chỉ có ghép chuỗi ảo OPUk-Xv với k = 1..3, §18.1.1; bản 06/2020 bỏ hẳn: §18 là 'Blank clause') – STM-16 luôn đi bằng ODU1.",
    accepts: [{ of: "opu0", count: 1, overhead: oduOH("0"), note: "OPU0 × 239/238 = 1 244 160 kbit/s." }] });

  // ---------- k = 1 ----------
  U({ id: "opu1", name: "OPU1", kind: "opu", level: 20, rateKbps: RATE.opu1, frame: "opu1-amp", standard: STD + " §13, §17.2, §19; tốc độ Bảng 7-3",
    summary: "OPU1: payload 2 488 320 kbit/s – đúng tốc độ STM-16; hoặc 2 TS 1,25G.",
    desc: "Mang STM-16 bằng AMP (PT 0x02) / BMP (0x03), hoặc chia 2 tributary slot 1,25G (PT 0x20, ghép xen cột) mỗi TS một ODU0 bằng AMP (ODTU01).",
    tribSlots: { n: 2, kbps: RATE.opu1 / 2, size: "1,25G", note: "PT 20: 2 TS ghép xen theo cột (TS1 cột lẻ 17, 19…; TS2 cột 18, 20…); TSOH theo MFAS bit 8" },
    accepts: [
      { of: "stm-16", count: 1, fit: "le", mapping: "AMP / BMP",
        note: "STM-16 2 488 320 = OPU1 2 488 320 kbit/s (danh định); AMP chịu client ±45 ppm (tổng ±65 ppm cùng ±20 ppm của OPU), BMP cho client ±20 ppm (§17.2 NOTE 2)." },
      { of: "odu0", count: 2, slots: 1, mapping: "AMP (ODTU01)", note: "ODU0 1 244 160 ≤ 1 TS = 1 244 160 kbit/s; 2 ODU0 lấp đầy OPU1." }
    ] });
  oduUnit("1", 21, "Mang 1 STM-16 hoặc 2 ODU0; vào OPU2 chiếm 2 TS (AMP), OPU3 2 TS (AMP), OPU4 2 TS (GMP). STM-16 (CBR2G5) chỉ ánh xạ vào OPU1 (§17.2) nên luôn thành một ODU1; 2 TS 1,25G nó chiếm thuộc MỘT ODTU (ODTU12/13 hoặc ODTU4.2) và được tách ra nguyên một ODU1 – không phải 2 ODU0. Với khe 2,5G kiểu cũ (PT 20) ODU1 chiếm 1 khe.");
  otuUnit("1", 22, "Giao diện 2,666 Gbit/s.");

  // ---------- ODUflex(CBR) cho FC-800 ----------
  U({ id: "oduflex-fc800", name: "ODUflex (FC-800)", kind: "odu", level: 25, rateKbps: RATE.flexFc800, leafOk: true, standard: STD + " §12.2.3, §17.9.1 (BMP vào OPUflex); tốc độ Bảng 7-2 (ODUflex CBR = 239/238 × client)",
    summary: "ODUflex(CBR) chở FC-800: " + mbps(RATE.flexFc800) + " = 239/238 × 8,5 Gbit/s.",
    desc: "ODU có tốc độ co giãn theo client CBR: OPUflex = đúng tốc độ client (BMP, không chèn), ODUflex = 239/238 × client. Chiếm ⌈tốc độ/TS⌉ tributary slot: 7 TS ở OPU2/OPU3/OPU4 (Bảng 7-9): số TS M = Ceiling(ODUflex × (1 + 100 ppm + 60 ppm) / (ODTUk.1 × (1 − 20 ppm))) (phương trình 19-1a, §19.6; Bảng 7-9 chỉ ghi tham chiếu phương trình này; dung sai 100 ppm: Bảng 7-2 NOTE 2–3).",
    accepts: [{ of: "fc-800", count: 1, mapping: "BMP (OPUflex, PT 0x0F)", overhead: { kbps: RATE.flexFc800 - 8500000, name: "ODU OH + OPUflex OH", desc: "16 cột × 4 hàng mỗi khung (ODU OH + OPU OH + chỗ FA/OTU OH): ODUflex = 239/238 × OPUflex." },
      note: "8 500 000 × 239/238 = " + vn(RATE.flexFc800, 1) + " kbit/s. Không có unit OPUflex riêng – OPUflex = client." }] });

  // ---------- ODUflex(GFP) – G.709 §12.2.5, Bảng 7-8, §17.4, §19.6; Phụ lục XI ----------
  // ODUflex(GFP) n TS = n × ODUk.ts (Bảng 7-8): n 1–8 → ODU2.ts, 9–32 → ODU3.ts, 33–80 → ODU4.ts.
  // ODUk.ts thấp hơn 1 TS 1,25G của HO OPUk 186 ppm (Phụ lục XI.2) để ODUflex +100 ppm / HO OPUk −20 ppm vẫn vừa.
  // Số TS chiếm = n ở MỌI HO OPU2/3/4 (Bảng 7-9 hàng ODUflex(GFP,n,k): n, n, n; phương trình 19-1b §19.6: M = n):
  // công thức Ceiling (19-1a) chỉ áp cho ODUj ≠ flex(GFP,n,k), vd. ODUflex(CBR).
  var ODU_TS = { 2: 1249177.230, 3: 1254470.354, 4: 1301467.133 };   // kbit/s, Bảng 7-8
  var GFPF = 1526 / 1538;   // Ethernet khung 1518 B qua GFP-F (G.7041 §7.1) – như data/transport-eos.js
  function flexGfp(n) { var k = n <= 8 ? 2 : n <= 32 ? 3 : 4; return { k: k, rate: n * ODU_TS[k] }; }
  var HAO_NOTE = " Đồng hồ ODUflex(GFP) lấy từ đồng hồ nội bộ (HO ODUk/OTUk, ODUCn/OTUCn hoặc đồng hồ thiết bị, ±100 ppm – Bảng 7-8; §12.2.5; ví dụ phát đồng hồ ở Phụ lục XI.3 và XV), không theo client: GFP-F tự chèn khung Idle để lấp OPUflex. OPUflex = ODUflex × 238/239 chở GFP-F trực tiếp (PT 0x05, §17.4) như mọi OPUk. Vào HO OPUk bằng GMP (ODTUk.ts, PT 21). Chọn ODUk.ts theo n để ODUflex chiếm ĐÚNG n TS trên mọi HO OPU2/3/4 dọc tuyến – giữ nguyên số TS khi khôi phục qua tuyến khác (Phụ lục XI.1–XI.2). HAO (G.7044, LCR + BWR) cho phép thêm/bớt ít nhất 1 TS mỗi lần đổi cỡ (Phụ lục XI.1) mà không gián đoạn dịch vụ – chỉ mô tả, lab không mô phỏng.";
  function flexGfpUnit(o) {
    var f = flexGfp(o.n), opuflex = f.rate * 238 / 239, carried = o.eth * GFPF;
    U({ id: "oduflex-gfp-" + o.n, name: "ODUflex(GFP) " + o.n + " TS", kind: "odu", level: o.level, rateKbps: f.rate, leafOk: true,
      standard: STD + " §12.2.5, §17.4, §19.6; tốc độ Bảng 7-8; số TS Bảng 7-9 + phương trình 19-1b; tham số GMP Bảng D.1, ODTUk.ts Bảng 19-8; Phụ lục XI; HAO: ITU-T G.7044",
      summary: "ODUflex(GFP) " + o.n + " TS = " + o.n + " × ODU" + f.k + ".ts = " + mbps(f.rate) + " (±100 ppm), chở " + o.client + " qua GFP-F.",
      desc: o.desc + HAO_NOTE,
      accepts: [{ of: o.of, count: 1, fit: "le", carriedKbps: carried, mapping: "GFP-F (OPUflex, PT 0x05)",
        overhead: { kbps: f.rate - opuflex, name: "ODU OH + OPUflex OH (cột 1–16)",
          desc: "16 cột × 4 hàng mỗi khung (ODU OH, OPU OH với PSI/PT = 0x05 và bit CSF, chỗ FA/OTU OH): ODUflex = 239/238 × OPUflex." },
        note: vn(o.eth, 0) + " × 1526/1538 ≈ " + vn(carried, 0) + " kbit/s ≤ OPUflex = " + o.n + " × " + vn(ODU_TS[f.k], 3) + " × 238/239 ≈ " + vn(opuflex, 0) + " kbit/s; phần thừa lấp bằng khung GFP Idle. Tỉ lệ 1526/1538: khung 1518 B bỏ preamble+SFD 8 B và IFG 12 B, thêm core header 4 B + payload header 4 B, không pFCS." }] });
  }
  flexGfpUnit({ n: 1, level: 13, of: "eth-1g-gfpf", eth: 1000000, client: "Gigabit Ethernet",
    desc: "ODUflex nhỏ nhất cho dịch vụ gói: 1 × ODU2.ts ≈ 1,249 Gbit/s, chiếm 1 TS ở OPU2, OPU3 và OPU4. So với ODU0 (chở 1000BASE-X trong suốt bằng TTT + GMP, giữ cả ký tự điều khiển) đây chỉ mang khung MAC qua GFP-F – không cần chuyển mã, nhưng không trong suốt mức PCS." });
  flexGfpUnit({ n: 8, level: 36, of: "eth-10g-gfpf", eth: 10000000, client: "10 Gigabit Ethernet",
    desc: "8 × ODU2.ts ≈ 9,993 Gbit/s – cỡ lớn nhất còn đi được qua OPU2 (lấp đủ 8 TS OPU2; 8 TS ở OPU3, OPU4). Khung MAC 10GbE (1518 B) qua GFP-F cần ≈ 9,922 Gbit/s nên vừa; với khung jumbo 9618 B cần ≈ 9,988 Gbit/s (+100 ppm: 9 988 548 kbit/s) > OPUflex 8 TS ≈ 9 951 604 kbit/s (−100 ppm: 9 950 609) nên KHÔNG đủ 10GbE line-rate khi khung > ≈ 2,46 KB (GFP-F thẳng vào OPU2, 9 995 277 kbit/s, vẫn đủ – G.Sup43 §6.2). 10GBASE-R CBR (10,3125 Gbit/s) không vừa – phải dùng ODU2e. Khác ODU2 thật sự: ODUflex có cỡ n linh hoạt (1–80 TS) và đổi cỡ không gián đoạn nhờ HAO; so với GFP-F thẳng vào OPU2 (cố định 1 ODU2) đó là ưu điểm chính." });
  flexGfpUnit({ n: 32, level: 44, of: "eth-40g-gfpf", eth: 40000000, client: "40 Gigabit Ethernet",
    desc: "n = 9–32 dùng ODU3.ts: 32 × ODU3.ts ≈ 40,143 Gbit/s – lấp đủ 32 TS OPU3, KHÔNG vào được OPU2 (chỉ 8 TS). Ở OPU4 vẫn chiếm 32 TS dù theo tốc độ chỉ cần ≈ 30,84 TS (ODU4.ts lớn hơn ODU3.ts): Bảng 7-9 ghi n cho mọi HO OPU và phương trình 19-1b (§19.6) cho M = n = 32 (ODTU4.M, Hình 19-37) – khác ODU3 (31 TS) và ODUflex(CBR) (tính theo công thức Ceiling). Đổi lại, số TS như nhau trên mọi chặng/tuyến khôi phục – điều kiện để HAO thêm/bớt TS (Phụ lục XI.1)." });

  // Ghi chú TS cho ODUflex(GFP) n vào HO OPUk có 1 TS = tsk kbit/s.
  function gfpTsNote(n, tsk) {
    var r = flexGfp(n).rate;
    return "ODUflex(GFP) " + vn(r, 0) + " kbit/s = " + vn(r / tsk, 2) + " TS danh định → chiếm " + n + " TS (Bảng 7-9 hàng ODUflex(GFP): n ở OPU2/3/4; GMP ODTUk." + n + ").";
  }

  // ---------- k = 2 ----------
  var ts2 = RATE.opu2 / 8;
  U({ id: "opu2", name: "OPU2", kind: "opu", level: 30, rateKbps: RATE.opu2, frame: "opu2-ts", standard: STD + " §13, §17.2, §19; tốc độ Bảng 7-3",
    summary: "OPU2: payload " + mbps(RATE.opu2) + " (= 238/237 × STM-64); hoặc 8 TS 1,25G.",
    desc: "Mang STM-64 bằng AMP/BMP (16 cột fixed stuff 1905–1920), hoặc 8 tributary slot 1,25G (PT 0x21) trộn ODU0 (1 TS, GMP), ODU1 (2 TS, AMP), ODUflex (n TS, GMP). 10GbE LAN (10,3125 Gbit/s) trong suốt không vừa – phải dùng OPU2e; còn khung MAC 10GbE qua GFP-F (PT 0x05) thì vừa thẳng OPU2.",
    tribSlots: { n: 8, kbps: ts2, size: "1,25G", note: "PT 21: 8 TS ghép xen cột, 476 cột/TS; TSOH theo MFAS bit 6–8" },
    accepts: [
      { of: "stm-64", count: 1, fit: "le", mapping: "AMP / BMP", note: "STM-64 9 953 280 kbit/s chiếm 3792 cột; 16 cột fixed stuff + NJO/PJO bù lệch." },
      { of: "odu0", count: 8, slots: 1, mapping: "GMP (ODTU2.1)", note: "ODU0 1 244 160 ≤ 1 TS ≈ " + vn(ts2, 1) + " kbit/s." },
      { of: "odu1", count: 4, slots: 2, mapping: "AMP (ODTU12)", note: "ODU1 ≈ 2 498 775 ≤ 2 TS ≈ " + vn(2 * ts2, 1) + " kbit/s (cần 1,99996 TS)." },
      { of: "oduflex-fc800", count: 1, slots: 7, mapping: "GMP (ODTU2.ts)", note: "ODUflex FC-800 ≈ 8 535 714 kbit/s = 6,83 TS → 7 TS." },
      { of: "eth-10g-gfpf", count: 1, fit: "le", carriedKbps: 10000000 * GFPF, mapping: "GFP-F (PT 0x05, §17.4)",
        note: "Khung MAC 10GbE qua GFP-F ≈ " + vn(10000000 * GFPF, 0) + " kbit/s ≤ OPU2 ≈ " + vn(RATE.opu2, 0) + " kbit/s (4 × 3808 byte tải, GFP Idle lấp phần thừa). So sánh: 10GBASE-R CBR 10 312 500 không vừa → ODU2e." },
      { of: "oduflex-gfp-1", count: 8, slots: 1, mapping: "GMP (ODTU2.1)", note: gfpTsNote(1, ts2) },
      { of: "oduflex-gfp-8", count: 1, slots: 8, mapping: "GMP (ODTU2.8)", note: gfpTsNote(8, ts2) + " Lấp kín OPU2. ODUflex(GFP) 32 TS không vào OPU2." }
    ] });
  oduUnit("2", 31, "Vào OPU3 chiếm 8 TS (AMP, ODTU23), OPU4 8 TS (GMP).");
  otuUnit("2", 32, "Giao diện 10,709 Gbit/s – OTN 10G phổ biến nhất.");

  // ---------- k = 2e (G.Sup43) ----------
  U({ id: "opu2e", name: "OPU2e", kind: "opu", level: 33, rateKbps: RATE.opu2e, standard: STD + " Bảng 7-2/7-3, §17.2.4 (10GBASE-R → OPU2e, BMP); G.Sup43 §7.1 ghi đã chuyển sang §17.2.4",
    summary: "OPU2e: payload " + mbps(RATE.opu2e) + " (= 238/237 × 10 312 500) – OPU2 ép xung cho 10GbE.",
    desc: "Bố cục như OPU2 chở STM-64 (16 cột fixed stuff) nhưng đồng hồ khoá theo 10GBASE-R (BMP) nên chở trong suốt toàn bộ luồng 64B/66B, kể cả preamble/IPG – điều GFP-F trong OPU2 không làm được.",
    accepts: [{ of: "10gbe", count: 1, fit: "le", mapping: "BMP", note: "10 312 500 kbit/s chiếm 3792/3808 cột tải; 16 cột còn lại là fixed stuff." }] });
  oduUnit("2e", 34, "Vào OPU3 chiếm 9 TS (GMP, 8,29 TS → 9), OPU4 8 TS (GMP). Đây là lý do 10GbE trong suốt có thể đi qua mạng OTN 40G/100G.");
  otuUnit("2e", 35, "Giao diện 11,096 Gbit/s (khung OTU2e nằm ngoài G.709, dùng cho IaDI theo G.Sup43).");

  // ---------- k = 3 ----------
  var ts3 = RATE.opu3 / 32;
  U({ id: "opu3", name: "OPU3", kind: "opu", level: 40, rateKbps: RATE.opu3, standard: STD + " §13, §17.2, §17.7.4, §19; tốc độ Bảng 7-3",
    summary: "OPU3: payload " + mbps(RATE.opu3) + " (= 238/236 × STM-256); hoặc 32 TS 1,25G.",
    desc: "Mang STM-256 (AMP/BMP, 32 cột fixed stuff), 40GbE chuyển mã 1024B/1027B (GMP, PT 0x07), hoặc 32 TS 1,25G ghép xen cột (PT 0x21, TSOH theo MFAS bit 4–8, 119 cột/TS).",
    tribSlots: { n: 32, kbps: ts3, size: "1,25G", note: "PT 21: 32 TS ghép xen cột, 119 cột/TS; TSOH theo MFAS bit 4–8" },
    accepts: [
      { of: "stm-256", count: 1, fit: "le", mapping: "AMP / BMP", note: "STM-256 39 813 120 kbit/s chiếm 3776 cột; 32 cột fixed stuff." },
      { of: "40gbe", count: 1, fit: "le", carriedKbps: 41250000 * 64 / 66 * 1027 / 1024, mapping: "GMP (1024B/1027B)",
        note: "41,25 Gbit/s > OPU3; chuyển mã 1024B/1027B còn " + vn(41250000 * 64 / 66 * 1027 / 1024, 1) + " kbit/s ≤ OPU3 ≈ " + vn(RATE.opu3, 1) + "." },
      { of: "odu0", count: 32, slots: 1, mapping: "GMP (ODTU3.1)", note: "1 TS ≈ " + vn(ts3, 1) + " kbit/s." },
      { of: "odu1", count: 16, slots: 2, mapping: "AMP (ODTU13)", note: "ODU1 ≤ 2 TS." },
      { of: "odu2", count: 4, slots: 8, mapping: "AMP (ODTU23)", note: "ODU2 ≈ 10 037 274 = 7,9997 TS → 8 TS." },
      { of: "odu2e", count: 3, slots: 9, mapping: "GMP (ODTU3.9)", note: "ODU2e ≈ 10 399 525 = 8,29 TS → 9 TS; 3 ODU2e dùng 27 TS, còn 5 TS." },
      { of: "oduflex-fc800", count: 4, slots: 7, mapping: "GMP (ODTU3.ts)", note: "≈ 6,80 TS → 7 TS." },
      { of: "eth-40g-gfpf", count: 1, fit: "le", carriedKbps: 40000000 * GFPF, mapping: "GFP-F (PT 0x05, §17.4)",
        note: "Khung MAC 40GbE qua GFP-F ≈ " + vn(40000000 * GFPF, 0) + " kbit/s ≤ OPU3 ≈ " + vn(RATE.opu3, 0) + " kbit/s. So sánh: 40GBASE-R trong suốt phải chuyển mã 1024B/1027B rồi GMP (PT 0x07)." },
      { of: "oduflex-gfp-1", count: 32, slots: 1, mapping: "GMP (ODTU3.1)", note: gfpTsNote(1, ts3) },
      { of: "oduflex-gfp-8", count: 4, slots: 8, mapping: "GMP (ODTU3.8)", note: gfpTsNote(8, ts3) },
      { of: "oduflex-gfp-32", count: 1, slots: 32, mapping: "GMP (ODTU3.32)", note: gfpTsNote(32, ts3) + " Lấp kín OPU3." }
    ] });
  oduUnit("3", 41, "Vào OPU4 chiếm 31 TS (GMP, 30,97 TS).");
  otuUnit("3", 42, "Giao diện 43,018 Gbit/s.");

  // ---------- k = 4 ----------
  var ts4 = RATE.opu4 * 3800 / 3808 / 80;
  U({ id: "opu4", name: "OPU4", kind: "opu", level: 50, rateKbps: RATE.opu4, frame: "opu4-100ge", standard: STD + " §13, §17.7.5, §19; tốc độ Bảng 7-3",
    summary: "OPU4: payload " + mbps(RATE.opu4) + " (= 238/227 × 99 532 800); 100GbE hoặc 80 TS 1,25G.",
    desc: "Chỉ 3800 cột mang tải (8 cột 3817–3824 fixed stuff). Mang 100GBASE-R (GMP) hoặc 80 TS 1,25G (PT 0x21): TS chia vòng từng byte trên 4 × 3800 byte (hàng 2, 4 bắt đầu từ TS41), 190 byte/TS/khung; OMFI ở hàng 4 cột 16 đếm 0–79 cho TSOH. Mọi ODU vào OPU4 đều dùng GMP (ODTU4.ts).",
    tribSlots: { n: 80, kbps: ts4, size: "1,25G", note: "PT 21: 80 TS trên 3800 cột, đa khung OMFI 80" },
    accepts: [
      { of: "100gbe", count: 1, fit: "le", mapping: "GMP", note: "103 125 000 ≤ 3800 cột ≈ " + vn(RATE.opu4 * 3800 / 3808, 1) + " kbit/s. PT 0x07." },
      { of: "odu0", count: 80, slots: 1, mapping: "GMP (ODTU4.1)", note: "1 TS ≈ " + vn(ts4, 1) + " kbit/s." },
      { of: "odu1", count: 40, slots: 2, mapping: "GMP (ODTU4.2)", note: "ODU1 = 1,92 TS → 2 TS." },
      { of: "odu2", count: 10, slots: 8, mapping: "GMP (ODTU4.8)", note: "ODU2 = 7,71 TS → 8 TS." },
      { of: "odu2e", count: 10, slots: 8, mapping: "GMP (ODTU4.8)", note: "ODU2e = 7,99 TS → 8 TS (khác OPU3 cần 9)." },
      { of: "odu3", count: 2, slots: 31, mapping: "GMP (ODTU4.31)", note: "ODU3 = 30,97 TS → 31 TS; 2 ODU3 dùng 62 TS." },
      { of: "oduflex-fc800", count: 11, slots: 7, mapping: "GMP (ODTU4.ts)", note: "≈ 6,56 TS → 7 TS." },
      { of: "oduflex-gfp-1", count: 80, slots: 1, mapping: "GMP (ODTU4.1)", note: gfpTsNote(1, ts4) },
      { of: "oduflex-gfp-8", count: 10, slots: 8, mapping: "GMP (ODTU4.8)", note: gfpTsNote(8, ts4) },
      { of: "oduflex-gfp-32", count: 2, slots: 32, mapping: "GMP (ODTU4.32)", note: gfpTsNote(32, ts4) + " Theo tốc độ chỉ cần 31 TS nhưng chuẩn cấp đủ 32 (Bảng 7-9: n; phương trình 19-1b M = n = 32) – khác ODU3 vào OPU4 chỉ 31 TS." }
    ] });
  oduUnit("4", 51, "Đơn vị 100G: mang 100GbE hoặc tổ hợp ODU thấp hơn trong 80 TS.");
  otuUnit("4", 52, "Giao diện 111,81 Gbit/s.");

  // =====================================================================
  // TLABS
  // =====================================================================
  L.push({
    id: "otn", name: "Ghép kênh OTN", family: "otn",
    // GD7: roots otuc*/flexo-* và các unit OPUCn/ODUCn định nghĩa trong data/transport-b100g.js (trang phải nạp file đó).
    roots: ["otu1", "otu2", "otu2e", "otu3", "otu4", "otuc1", "otuc2", "otuc4", "flexo-1", "flexo-2", "flexo-4"],
    palette: ["1gbe", "eth-1g-gfpf", "stm-16", "fc-800", "10gbe", "eth-10g-gfpf", "stm-64", "40gbe", "eth-40g-gfpf", "stm-256", "100gbe", "odu0", "oduflex-gfp-1", "odu1", "oduflex-fc800", "oduflex-gfp-8", "odu2", "odu2e", "oduflex-gfp-32", "odu3", "odu4"],
    intro: "Chọn OTUk đích rồi lắp từ dưới lên: client → OPUk (ánh xạ AMP/BMP/GMP) → ODUk (+ ODU OH) → OTUk (+ FEC). Chọn 'ghép TS' để trộn ODU0 / ODU1 / ODU2 / ODUflex trong cùng một OPU theo tributary slot 1,25G – miễn tổng TS không vượt (2, 8, 32 hoặc 80). Thử thả 10GbE vào OPU2 hay 40GbE chưa chuyển mã để thấy vì sao cần ODU2e và 1024B/1027B. So sánh với Ethernet chỉ mang khung MAC (GFP-F): 10G GFP-F vừa thẳng OPU2 hoặc ODUflex(GFP) 8 TS; ODUflex(GFP) 32 TS vào OPU3 nhưng không vào OPU2, và ở OPU4 vẫn chiếm 32 TS (ODU3 chỉ 31). Beyond 100G: OTUC1/2/4 chỉ chở ODUk qua TS 5G (20 TS mỗi lát 100G) – ODU0/ODU1 tốn trọn 1 TS 5G, ODU2 2 TS, ODU3 8 TS, ODU4 20 TS; OTUC4 chở 4 ODU4 hoặc 40 ODU2. FlexO-n bọc OTUCn thêm AM/EOH/BOH (FEC thêm ở giao diện)."
  });
})();
