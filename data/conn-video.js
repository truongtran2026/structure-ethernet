// Mảng Đấu nối — Video (v2): thân DE-15 (VGA), DVI, HDMI Type A/C/D, DisplayPort, Mini DisplayPort;
// sơ đồ chân VGA (VESA DDC/E-DDC), DVI-I (DDWG DVI 1.0), HDMI A/C/D (HDMI 1.4b/2.x), DP nguồn/nhận, Mini DP nguồn;
// cáp/đầu chuyển thụ động BẰNG DÂY (cùng loại tín hiệu: TMDS↔TMDS, analog↔analog).
// Nguồn: VESA E-DDC 1.2 (Bảng 7-1, §7.1.3: DE-15); DDWG Digital Visual Interface Rev 1.0 (1999) §5 "Physical Interconnect Specification"
// (gán chân §5.2.1 Bảng 5-1, 5-2; ổ Hình 5-3; plug Hình 5-5, 5-6; thứ tự cắm Bảng 5-3);
// HDMI Specification 1.3a §4.1.4 Bảng 4-3 (gán chân), §4.1.9.5-6 (receptacle/plug Type C), §4.1.10.5 Bảng 4-13 (cáp C↔A); Type D theo
// HDMI 1.4 + datasheet Multicomp MC002785 (CHƯA XÁC MINH theo chuẩn); VESA DisplayPort Standard 1.1a/1.2 §4 (bảng chân, cáp
// Hình 4-14, 4-23, 4-34, 4-35), DP Interoperability Guideline 1.1 §5.1.1.
// Đối chiếu hình: E-DDC Hình 7-1 + Winford BRKLD15HDM (DE-15); DVI Hình 5-3/5-6; HDMI 1.3a Hình 4-2, 4-8; MC002785 (Type D); DP 1.2 Hình 4-25, 4-41.
// Chưa xác minh: bảng chân Type D theo chuẩn HDMI, lane FRL HDMI 2.1, VESA DP Dual-Mode Type 1/2, kích thước ổ Mini DP, FAUX 720 Mbit/s.
// Schema: .claude/skills/connector-pinout-spec/references/connector-schema.md
(function () {
  var SHELL_DESC = "Vỏ kim loại. Trong cáp nối với lưới chống nhiễu tổng; không thay cho dây đất tín hiệu.";
  var PLUG_RCPT = function (plugNote, rcptNote) {
    return {
      male: { name: "Plug (đầu cáp, đực)", note: plugNote },
      female: { name: "Receptacle (ổ trên thiết bị, cái)", note: rcptNote }
    };
  };

  // ---------------------------------------------------------------- Body
  // D-sub HD 3 hàng, nhìn MẶT CẮM ĐẦU ĐỰC, cạnh dài ở TRÊN: hàng 1 (1–5) trái→phải; hàng 2 (6–10) lệch TRÁI nửa bước
  // (chân 6 ở dưới-trái chân 1); hàng 3 (11–15) thẳng cột với hàng 1. (Đầu cái: ảnh gương — khớp hình "VGA Port.svg".)
  var de15Pins = [];
  for (var i = 0; i < 5; i++) {
    de15Pins.push({ pin: String(1 + i), x: 40 + i * 14, y: 16 });
    de15Pins.push({ pin: String(6 + i), x: 33 + i * 14, y: 30 });
    de15Pins.push({ pin: String(11 + i), x: 40 + i * 14, y: 44 });
  }
  de15Pins.sort(function (a, b) { return +a.pin - +b.pin; });
  de15Pins.push({ pin: "S", x: 4, y: 30 });

  // DVI: đầu cái nhìn mặt trước — khối số 3×8 bên TRÁI (1–8 hàng trên trái→phải), khối analog bên PHẢI.
  var dviPins = [];
  for (var r = 0; r < 3; r++)
    for (var c = 0; c < 8; c++) dviPins.push({ pin: String(r * 8 + c + 1), x: 14 + c * 14, y: 14 + r * 16 });
  dviPins.push({ pin: "C1", x: 140, y: 18 }, { pin: "C2", x: 172, y: 18 }, { pin: "C3", x: 140, y: 42 },
    { pin: "C4", x: 172, y: 42 }, { pin: "C5", x: 156, y: 30 }, { pin: "S", x: 4, y: 30 });

  // Hai hàng lẻ/chẵn, receptacle nhìn mặt trước: chân 1 ở PHẢI hàng trên; chân chẵn lệch TRÁI nửa bước so với chân lẻ cùng số trước nó.
  function oddEvenRcpt(n, xRight, step, yTop, yBot) {
    var out = [];
    for (var p = 1; p <= n; p++) {
      var k = Math.floor((p - 1) / 2);
      out.push(p % 2 ? { pin: String(p), x: xRight - k * step, y: yTop } : { pin: String(p), x: xRight - step / 2 - k * step, y: yBot });
    }
    return out;
  }
  // Mini DP: hai hàng thẳng cột (lẻ trên, chẵn dưới), chân 1 và 2 cùng ở PHẢI.
  function oddEvenAligned(n, xRight, step, yTop, yBot) {
    var out = [];
    for (var p = 1; p <= n; p++) {
      var k = Math.floor((p - 1) / 2);
      out.push({ pin: String(p), x: xRight - k * step, y: p % 2 ? yTop : yBot });
    }
    return out;
  }
  var hdmiCPins = [];
  for (var q = 1; q <= 19; q++) hdmiCPins.push({ pin: String(q), x: 106 - (q - 1) * 5, y: 24 });

  var bodies = {
    "de15": {
      id: "de15",
      name: "D-sub 15 chân mật độ cao (DE-15, VGA)",
      aka: ["VGA", "HD15", "HD-15", "DB15", "DB-15", "DE15", "D-sub 15", "cổng VGA", "cổng RGB", "SVGA"],
      family: "video",
      standard: "IEC 60807-3 / MIL-DTL-24308 (thân D-sub mật độ cao, vỏ E); IBM PS/2 VGA (1987); VESA DDC / E-DDC (gán chân 9, 12, 15)",
      summary: "Thân D-sub vỏ cỡ E nhưng 15 chân xếp 3 hàng 5/5/5 — cổng VGA analog của card đồ hoạ, máy chiếu, màn hình.",
      detail:
        "Cùng cỡ vỏ với DE-9 (cổng COM) nhưng 3 hàng chân nhỏ hơn (bước ~2,29 mm) — đừng nhầm hai cổng khi chỉ nhìn vỏ. " +
        "\"DB15\" là tên gọi sai phổ biến: vỏ B là cỡ của DB-25; DA-15 (2 hàng, vỏ A) là cổng tay game/AUI Ethernet, khác hẳn. " +
        "Card đồ hoạ mang đầu CÁI, cáp mang đầu ĐỰC ở cả hai đầu. Khoá bằng vít 4-40 UNC. " +
        "Khi hàn: đầu đực nhìn từ phía hàn cho thứ tự giống đầu cái nhìn mặt cắm (chân 1 bên phải) — luôn đọc số in nhỏ ở mặt sau.",
      genders: {
        male: { name: "Đầu đực (chân cắm, plug)", note: "Hai đầu cáp VGA; đầu vào của đầu chuyển DVI-I→VGA là DVI, đầu ra là VGA cái." },
        female: { name: "Đầu cái (lỗ cắm, socket)", note: "Cổng trên card đồ hoạ, laptop, màn hình, máy chiếu." }
      },
      face: {
        outline: "dsub",
        shell: "E",
        w: 130, h: 60,
        viewOf: "male",
        orientation:
          "Nhìn thẳng vào MẶT CẮM đầu ĐỰC, cạnh dài hình thang ở TRÊN: hàng trên 1-2-3-4-5 trái→phải; hàng giữa 6-7-8-9-10 trái→phải, " +
          "lệch TRÁI nửa bước (chân 6 nằm dưới-trái chân 1); hàng dưới 11→15 trái→phải, thẳng cột với hàng trên (11 ngay dưới 1). " +
          "Đầu cái nhìn mặt cắm (cổng trên card) là ảnh gương: 5-4-3-2-1 / 10…6 / 15…11, chân 1 ở TRÊN-PHẢI, chân 6 ở dưới-phải chân 1 " +
          "(đối chiếu E-DDC 1.2 Hình 7-1, ảnh Winford BRKLD15HDM và \"VGA Port.svg\" — đầu cái).",
        pins: de15Pins
      },
      pinCount: 16
    },

    "dvi": {
      id: "dvi",
      name: "DVI (24 chân số + C1–C5 analog)",
      aka: ["DVI", "DVI-I", "DVI-D", "DVI-A", "DVI 24+5", "DVI 24+1", "DVI 18+5", "DVI 18+1", "cổng DVI"],
      family: "video",
      standard: "DDWG Digital Visual Interface Revision 1.0 (02/04/1999) §5 (Physical Interconnect: ổ Hình 5-3, plug Hình 5-5/5-6, thứ tự cắm Bảng 5-3)",
      summary: "Thân DVI: khối số 3 hàng × 8 chân (TMDS 2 link, DDC, hot plug) và khối analog 'chữ thập' C1–C5 cho RGB analog.",
      detail:
        "Một thân, ba kiểu: DVI-I (tích hợp số + analog, 24+5, ổ có khe chữ thập), DVI-D (chỉ số: 24+1 dual link hoặc 18+1 single link, " +
        "chỉ có lưỡi dẹt ngang, KHÔNG có 4 chân C1–C4) và DVI-A (chỉ analog, ít gặp — chủ yếu là đầu chuyển). " +
        "Đầu DVI-D không cắm được vào ổ DVI-A; đầu DVI-I không cắm được vào ổ DVI-D (vướng 4 chân C1–C4). " +
        "Single link bỏ 6 chân của link 2 (4, 5, 12, 13, 20, 21) → nhìn khối số thấy 2 cột trống ở giữa. " +
        "Vỏ hình D (cạnh dưới hai góc vát), khoá bằng 2 vít. Gán chân xem pinout dvi-i (biến thể DVI-D/DVI-A).",
      genders: PLUG_RCPT(
        "Đầu cáp: chân kim; có lưỡi dẹt ngang C5 (mọi kiểu) và 4 chân C1–C4 (DVI-I, DVI-A).",
        "Ổ trên card đồ hoạ/màn hình: lỗ; DVI-I có khe chữ thập, DVI-D chỉ có khe ngang."),
      face: {
        outline: "dvi",
        w: 196, h: 60,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào MẶT CẮM đầu CÁI (ổ trên card), cạnh dài (không vát) ở TRÊN: khối số bên TRÁI — hàng trên 1→8, hàng giữa 9→16, " +
          "hàng dưới 17→24, cả ba trái→phải; khối analog bên PHẢI: khe chữ thập, lưỡi C5 nằm ngang ở giữa, C1 trên-trái, C2 trên-phải, " +
          "C3 dưới-trái, C4 dưới-phải (đối chiếu \"DVI Connector Pinout.svg\" — đầu cái DVI-I nhìn mặt trước). " +
          "Đầu đực nhìn mặt cắm là ảnh gương: khối analog bên TRÁI, hàng trên 8→1, chân 1 ở TRÊN-PHẢI. " +
          "Đối chiếu DDWG DVI 1.0 Hình 5-3 (ổ), Hình 5-6 (plug) và \"DVI Connector Pinout.svg\".",
        pins: dviPins,
        keys: [
          { x: 136, y: 28, w: 40, h: 4, label: "lưỡi dẹt C5 (ngang)" },
          { x: 154, y: 12, w: 4, h: 36, label: "khe dọc (chỉ DVI-I/DVI-A)" }
        ]
      },
      pinCount: 30
    },

    "hdmi-a": {
      id: "hdmi-a",
      name: "HDMI Type A (Standard, 19 chân)",
      aka: ["HDMI", "HDMI A", "HDMI Type A", "HDMI chuẩn", "HDMI Standard", "cổng HDMI"],
      family: "video",
      standard: "HDMI Specification 1.3a/1.4b §4.1 (đầu nối Type A: receptacle/plug, gán chân); HDMI 2.1 (FRL dùng cùng đầu nối)",
      summary: "Ổ dẹt 19 chân (mở 14 × 4,55 mm) có hai góc vát ở cạnh dưới — cổng HDMI trên TV, PC, đầu thu, máy chơi game.",
      detail:
        "19 tiếp điểm xếp hai hàng so le trên lưỡi nhựa: hàng 10 chân số LẺ (1…19) ở phía cạnh rộng, hàng 9 chân số CHẴN (2…18) ở phía cạnh vát. " +
        "Mỗi cặp TMDS gồm +/− cùng một hàng và chân đất (shield) của cặp nằm giữa ở hàng kia (1-2-3, 4-5-6 …). " +
        "Tương thích điện với DVI-D single link (chỉ cần dây, xem cáp dvi-hdmi). Type B (29 chân, dual link) có trong chuẩn 1.0 nhưng chưa từng có sản phẩm. " +
        "Không có vít khoá: ma sát giữ, dễ lỏng khi treo cáp nặng.",
      genders: PLUG_RCPT(
        "Đầu cáp; lá tiếp xúc nằm trong lòng vỏ kim loại.",
        "Ổ trên TV/PC/đầu thu; lưỡi nhựa mang tiếp xúc ở giữa miệng ổ."),
      face: {
        outline: "hdmi-a",
        w: 160, h: 48,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, cạnh RỘNG ở TRÊN (hai góc vát ở dưới): hàng trên 10 chân LẺ đọc trái→phải 19-17-…-3-1, CHÂN 1 Ở PHẢI; " +
          "hàng dưới 9 chân CHẴN 18-16-…-4-2, chân 2 ở phải và lệch trái nửa bước so với chân 1. " +
          "Plug nhìn vào mặt cắm (cạnh rộng ở trên) là ảnh gương: 1-3-…-19 trái→phải, chân 1 ở TRÁI. " +
          "Đối chiếu: \"HDMI Connector Pinout.svg\" (receptacle) và hình receptacle/plug Type A của pinoutguide — hai nguồn khớp nhau. " +
          "Đối chiếu HDMI 1.3a Hình 4-2 (receptacle Type A).",
        pins: oddEvenRcpt(19, 140, 12, 18, 30).concat([{ pin: "S", x: 4, y: 24 }]),
        keys: [{ x: 24, y: 21, w: 122, h: 6, label: "lưỡi nhựa (tongue)" }]
      },
      pinCount: 20
    },

    "hdmi-c": {
      id: "hdmi-c",
      name: "HDMI Type C (Mini HDMI, 19 chân)",
      aka: ["Mini HDMI", "mini-HDMI", "HDMI C", "HDMI Type C", "HDMI mini"],
      family: "video",
      standard: "HDMI Specification 1.3a §4.1.4 Bảng 4-3 (gán chân); §4.1.9.5 Hình 4-8 (receptacle Type C); §4.1.9.6 Hình 4-9 (plug); §4.1.10.5 Bảng 4-13 (cáp C↔A)",
      summary: "Bản thu nhỏ (ổ 10,5 × 2,5 mm; plug 10,42 × 2,42 mm) cho máy ảnh, máy quay, card đồ hoạ nhỏ — 19 chân một hàng, gán chân KHÁC Type A.",
      detail:
        "Cùng 19 tín hiệu như Type A nhưng xếp MỘT HÀNG theo mẫu đất–(+)–(−): chân dương của mỗi cặp TMDS đổi chỗ với chân đất của nó " +
        "(A: 1 = Data2+, 2 = Data2 Shield → C: 1 = Data2 Shield, 2 = Data2+), DDC/CEC Ground ở chân 13 (A: 17), CEC ở chân 14 (A: 13), " +
        "chân 17 (A: 14) là Reserved/Utility ở HDMI 1.3a, thành HEAC+ từ HDMI 1.4 (HDMI 1.3a §4.1.10.5). Cáp A↔C vì vậy KHÔNG nối 1–1 — xem cáp hdmi-a-c.",
      genders: PLUG_RCPT("Đầu cáp Mini HDMI.", "Ổ trên máy ảnh, máy quay, tablet, một số card đồ hoạ."),
      face: {
        outline: "hdmi-c",
        w: 120, h: 40,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, cạnh RỘNG ở TRÊN (hai góc vát ở dưới): 19 chân một hàng, đọc trái→phải 19-18-…-2-1, CHÂN 1 Ở PHẢI. " +
          "Plug nhìn mặt cắm là ảnh gương: 1→19 trái→phải (khớp hình mini_hdmi_plug của pinoutguide). " +
          "Đối chiếu HDMI 1.3a Hình 4-8 (receptacle Type C).",
        pins: hdmiCPins.concat([{ pin: "S", x: 3, y: 20 }]),
        keys: [{ x: 10, y: 26, w: 102, h: 6, label: "lưỡi nhựa" }]
      },
      pinCount: 20
    },

    "hdmi-d": {
      id: "hdmi-d",
      name: "HDMI Type D (Micro HDMI, 19 chân)",
      aka: ["Micro HDMI", "micro-HDMI", "HDMI D", "HDMI Type D", "HDMI micro"],
      family: "video",
      standard: "HDMI Specification 1.4/1.4b §4.1 (Type D); bảng chân theo datasheet Multicomp MC002785 — CHƯA XÁC MINH theo chuẩn",
      summary: "Đầu nhỏ nhất (5,83 × 2,20 mm, cỡ gần Micro-USB) — Raspberry Pi 4/5, máy ảnh, điện thoại đời cũ; gán chân KHÁC cả A và C.",
      detail:
        "Hai hàng so le 10/9 giống Type A nhưng toàn bộ khối TMDS dịch +2 chân: Hot Plug Detect lên chân 1, Utility/HEAC+ chân 2, " +
        "Data2+ ở chân 3 … Clock− ở 14, CEC 15, DDC/CEC Ground 16, SCL 17, SDA 18, +5 V 19. " +
        "Rất dễ hỏng cơ khí: đừng treo cáp nặng vào ổ Micro HDMI, dùng cáp có đầu chuyển ngắn hoặc giá đỡ.",
      genders: PLUG_RCPT("Đầu cáp Micro HDMI.", "Ổ trên Raspberry Pi 4/5, máy ảnh, điện thoại/tablet đời cũ."),
      face: {
        outline: "hdmi-d",
        w: 80, h: 36,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, cạnh RỘNG ở TRÊN (hai góc vát ở dưới): hàng trên 10 chân LẺ 19-17-…-3-1 trái→phải, CHÂN 1 Ở PHẢI; " +
          "hàng dưới 9 chân CHẴN 18-…-4-2, chân 2 ở phải. Plug nhìn mặt cắm là ảnh gương: 1-3-…-19 trái→phải (khớp hình hdmi_micro_plug của pinoutguide). " +
          "Đối chiếu datasheet Multicomp MC002785 (Type D). Bảng chân Type D theo chuẩn HDMI 1.4: CHƯA XÁC MINH (dùng datasheet).",
        pins: oddEvenRcpt(19, 70, 6, 14, 22).concat([{ pin: "S", x: 3, y: 18 }]),
        keys: [{ x: 12, y: 16, w: 62, h: 4, label: "lưỡi nhựa" }]
      },
      pinCount: 20
    },

    "dp": {
      id: "dp",
      name: "DisplayPort (full-size, 20 chân)",
      aka: ["DP", "DisplayPort", "Display Port", "cổng DP", "DP++"],
      family: "video",
      standard: "VESA DisplayPort Standard 1.1a/1.2 §4 (receptacle/plug full-size, bảng chân phía nguồn và phía nhận)",
      summary: "Ổ 16,1 × 4,76 mm, MỘT góc vát (không đối xứng) — 20 chân; plug thường có lẫy cài phải bấm nút khi rút.",
      detail:
        "Một góc vát duy nhất để cắm một chiều. Gán chân phía NGUỒN (card đồ hoạ) và phía NHẬN (màn hình) KHÁC nhau: " +
        "ở phía nhận thứ tự 4 lane đảo ngược và cực ± đổi chỗ (Lane 3 ở chân 1/3, Lane 0 ở 10/12), để cáp DP chuẩn đi dây đảo 1↔12 … 12↔1 " +
        "mà vẫn ra đúng lane — xem pinout dp-source, dp-sink và cáp dp-dp. Chân 20 DP_PWR (3,3 V) có ở cả hai phía nhưng cáp chuẩn KHÔNG nối. " +
        "Ổ có logo DP++ (Dual-Mode) xuất được TMDS cho đầu chuyển HDMI/DVI kiểu 'passive' — đầu chuyển đó vẫn có IC, xem detail của dp-source.",
      genders: PLUG_RCPT(
        "Đầu cáp; thường có 2 móc lẫy kim loại ở mặt trên, bấm nút để rút.",
        "Ổ trên card đồ hoạ, laptop, màn hình."),
      face: {
        outline: "dp",
        w: 170, h: 54,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle (vd. ổ trên card đồ hoạ), cạnh THẲNG đủ ở TRÊN, GÓC VÁT ở DƯỚI-TRÁI: hai hàng tiếp điểm so le theo chiều sâu " +
          "(không phải hai mặt lưỡi — tiếp điểm DP nằm MỘT mặt lưỡi, bước 0,50 mm; hàng trên/dưới là hai hàng điểm tiếp xúc \"Mating Row Top/Bottom\"). " +
          "Hàng trên chân lẻ đọc trái→phải 19-17-…-3-1, CHÂN 1 Ở PHẢI; hàng dưới chân chẵn 20-18-…-4-2, chân 20 ở TRÁI cạnh góc vát, chân 2 lệch trái nửa bước so với chân 1. " +
          "Lưỡi nhựa nằm DƯỚI cả hai hàng. Plug nhìn mặt cắm là ảnh gương: góc vát ở dưới-PHẢI, chân 1 ở TRÁI. " +
          "Đối chiếu DP 1.2 Hình 4-25 (receptacle), Hình 4-41 và \"DisplayPort Connector.svg\"; ổ phía màn hình có cùng thân, chỉ khác gán tín hiệu.",
        pins: oddEvenRcpt(20, 144, 12, 20, 32).concat([{ pin: "S", x: 4, y: 26 }]),
        keys: [
          { x: 0, y: 40, w: 14, h: 14, label: "góc vát" },
          { x: 24, y: 40, w: 126, h: 6, label: "lưỡi nhựa (dưới cả hai hàng)" }
        ]
      },
      pinCount: 21
    },

    "mini-dp": {
      id: "mini-dp",
      name: "Mini DisplayPort (20 chân)",
      aka: ["Mini DP", "mDP", "MiniDP", "Mini DisplayPort", "Thunderbolt 1/2 (cùng thân)"],
      family: "video",
      standard: "VESA DisplayPort Standard 1.2 §4 (Mini DisplayPort receptacle/plug, bảng chân); ban đầu là đầu nối của Apple (2008)",
      summary: "Ổ 7,5 × 4,6 mm, hai góc vát ở cạnh dưới — laptop đời 2008–2016, card đồ hoạ nhiều cổng; cùng thân với Thunderbolt 1/2.",
      detail:
        "20 chân trên hai mặt lưỡi: 10 chân lẻ ở hàng trên, 10 chân chẵn ở hàng dưới. Gán chân KHÁC DP full-size " +
        "(chân 1 = GND, 2 = HPD, 3/5 = Lane 0 …) nên cáp Mini DP ↔ DP phải đi dây theo tên tín hiệu, không theo số chân. " +
        "Ổ Thunderbolt 1/2 dùng cùng thân và cắm được màn hình Mini DP; ngược lại ổ Mini DP thường KHÔNG chạy thiết bị Thunderbolt.",
      genders: PLUG_RCPT("Đầu cáp Mini DP.", "Ổ trên laptop/card đồ hoạ."),
      face: {
        outline: "mini-dp",
        w: 100, h: 60,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, cạnh thẳng ở TRÊN, HAI góc vát ở DƯỚI: hàng trên (mặt trên lưỡi) chân lẻ 19-17-…-3-1 trái→phải, CHÂN 1 Ở TRÊN-PHẢI; " +
          "hàng dưới chân chẵn 20-18-…-4-2, chân 2 ở DƯỚI-PHẢI, chân 20 ở DƯỚI-TRÁI. Plug nhìn mặt cắm là ảnh gương (chân 1 ở trên-trái). " +
          "Đối chiếu hình \"Mini DisplayPort (connector).PNG\" (Wikimedia, kích thước 7,50 × 4,60 mm của ổ). Kích thước ổ Mini DP: CHƯA XÁC MINH theo chuẩn.",
        pins: oddEvenAligned(20, 82, 7, 22, 38).concat([{ pin: "S", x: 3, y: 30 }]),
        keys: [{ x: 14, y: 26, w: 74, h: 8, label: "lưỡi nhựa (tiếp xúc hai mặt)" }]
      },
      pinCount: 21
    }
  };

  // ---------------------------------------------------------------- Pinout
  // VGA
  var vgaPins = [
    { pin: "1", signal: "RED", name: "Đỏ (analog)", dir: "out", pair: "R", desc: "Video đỏ 0,7 Vpp trên tải 75 Ω; đi bằng sợi đồng trục nhỏ, đất của sợi là chân 6." },
    { pin: "2", signal: "GREEN", name: "Lục (analog)", dir: "out", pair: "G", desc: "Video lục 0,7 Vpp / 75 Ω (có thể mang đồng bộ trên lục — sync-on-green — ở vài thiết bị); đất ở chân 7." },
    { pin: "3", signal: "BLUE", name: "Lam (analog)", dir: "out", pair: "B", desc: "Video lam 0,7 Vpp / 75 Ω; đất ở chân 8." },
    { pin: "4", signal: "ID2/RES", name: "ID2 (tuỳ chọn, phía host)", dir: "in", desc: "Phía host (E-DDC 1.2 Bảng 7-1): \"Monitor identification bit 2\", đầu vào tuỳ chọn. Phía màn hình chân này là Reserved – No connection (xem vga-de15-sink). Bit nhận dạng IBM 1987: xem biến thể." },
    { pin: "5", signal: "GND", name: "Đất", dir: "gnd", desc: "Đất chung (thường ghi là đất của HSync). Một số máy rất cũ dùng làm chân tự kiểm (self-test)." },
    { pin: "6", signal: "RED_RTN", name: "Đất đỏ", dir: "gnd", pair: "R", desc: "Đường về của tín hiệu đỏ (lưới sợi đồng trục đỏ)." },
    { pin: "7", signal: "GREEN_RTN", name: "Đất lục", dir: "gnd", pair: "G", desc: "Đường về của tín hiệu lục." },
    { pin: "8", signal: "BLUE_RTN", name: "Đất lam", dir: "gnd", pair: "B", desc: "Đường về của tín hiệu lam." },
    { pin: "9", signal: "+5V (KEY/PWR)", name: "+5 V DDC", dir: "pwr", desc: "VESA E-DDC §7.1.3: host cấp +5 V ±5 %, tối thiểu 50 mA, bảo vệ quá dòng ≤ 1 A, để màn hình đọc EEPROM EDID cả khi màn hình tắt; màn hình hút ≤ 50 mA khi tắt, ≤ 1 mA khi bật. Trên VGA IBM 1987 đây là vị trí chốt định hướng (key): đầu đực không có chân, đầu cái bịt lỗ." },
    { pin: "10", signal: "GND", name: "Đất (sync, DDC)", dir: "gnd", desc: "Đất cho VSync và DDC (đường về của SDA/SCL và +5 V chân 9)." },
    { pin: "11", signal: "ID0/RES", name: "ID0 (tuỳ chọn, phía host)", dir: "in", desc: "Phía host (E-DDC 1.2 Bảng 7-1): \"Monitor identification bit 0\", đầu vào tuỳ chọn. Phía màn hình là Reserved – No connection (vga-de15-sink)." },
    { pin: "12", signal: "SDA", name: "DDC data (I²C)", dir: "io", desc: "Dữ liệu I²C DDC2 để đọc EDID (địa chỉ 0xA0/0xA1). Trước là ID1. Trong DDC1 (cũ) màn hình phát EDID một chiều trên chân này theo nhịp VSync." },
    { pin: "13", signal: "HSYNC", name: "Đồng bộ ngang", dir: "out", desc: "Đồng bộ ngang mức TTL (hoặc đồng bộ tổng hợp — composite sync)." },
    { pin: "14", signal: "VSYNC", name: "Đồng bộ dọc", dir: "out", desc: "Đồng bộ dọc mức TTL. Trong DDC1 cũng là xung nhịp VCLK cho màn hình gửi EDID." },
    { pin: "15", signal: "SCL", name: "DDC clock (I²C)", dir: "out", desc: "Xung nhịp I²C DDC2 do card (master) phát. Trước là ID3." },
    { pin: "S", signal: "SHELL", name: "Vỏ", dir: "shield", desc: SHELL_DESC }
  ];

  // DVI-I
  function tmds(pin, sig, name, pair, dir, desc) { return { pin: pin, signal: sig, name: name, dir: dir || "out", pair: pair, desc: desc }; }
  var LINK2 = "Link 2 (chỉ dùng ở dual link, pixel clock > 165 MHz).";
  var dviPinsData = [
    tmds("1", "TMDS Data2−", "TMDS dữ liệu 2 (−)", "D2", "out", "Kênh đỏ link 1 (−). Chú ý DVI đặt (−) TRƯỚC (+): chân 1 = −, chân 2 = + (HDMI ngược lại)."),
    tmds("2", "TMDS Data2+", "TMDS dữ liệu 2 (+)", "D2", "out", "Kênh đỏ link 1 (+)."),
    { pin: "3", signal: "TMDS Data2/4 Shield", name: "Đất cặp 2/4", dir: "gnd", desc: "Đất (shield) dùng chung cho cặp Data2 và Data4." },
    tmds("4", "TMDS Data4−", "TMDS dữ liệu 4 (−)", "D4", "out", "Kênh lục link 2 (−). " + LINK2),
    tmds("5", "TMDS Data4+", "TMDS dữ liệu 4 (+)", "D4", "out", "Kênh lục link 2 (+). " + LINK2),
    { pin: "6", signal: "DDC Clock", name: "DDC SCL", dir: "out", desc: "Xung nhịp I²C DDC (nguồn là master) để đọc EDID." },
    { pin: "7", signal: "DDC Data", name: "DDC SDA", dir: "io", desc: "Dữ liệu I²C DDC." },
    { pin: "8", signal: "Analog VSync", name: "Đồng bộ dọc analog", dir: "out", desc: "VSync cho phần analog (DVI-I/DVI-A)." },
    tmds("9", "TMDS Data1−", "TMDS dữ liệu 1 (−)", "D1", "out", "Kênh lục link 1 (−)."),
    tmds("10", "TMDS Data1+", "TMDS dữ liệu 1 (+)", "D1", "out", "Kênh lục link 1 (+)."),
    { pin: "11", signal: "TMDS Data1/3 Shield", name: "Đất cặp 1/3", dir: "gnd", desc: "Đất cho cặp Data1 và Data3." },
    tmds("12", "TMDS Data3−", "TMDS dữ liệu 3 (−)", "D3", "out", "Kênh lam link 2 (−). " + LINK2),
    tmds("13", "TMDS Data3+", "TMDS dữ liệu 3 (+)", "D3", "out", "Kênh lam link 2 (+). " + LINK2),
    { pin: "14", signal: "+5V", name: "+5 V", dir: "pwr", desc: "Nguồn cấp +5 V để màn hình đọc EDID khi tắt; màn hình cũng dùng để kéo HPD lên." },
    { pin: "15", signal: "GND", name: "Đất", dir: "gnd", desc: "Đường về của +5 V và của đồng bộ analog (HSync C4, VSync 8)." },
    { pin: "16", signal: "Hot Plug Detect", name: "Phát hiện cắm nóng", dir: "in", desc: "Màn hình đưa mức cao (lấy từ +5 V chân 14 qua điện trở) khi đã cắm và sẵn sàng → card đọc EDID." },
    tmds("17", "TMDS Data0−", "TMDS dữ liệu 0 (−)", "D0", "out", "Kênh lam link 1 (−), mang cả HSync/VSync số."),
    tmds("18", "TMDS Data0+", "TMDS dữ liệu 0 (+)", "D0", "out", "Kênh lam link 1 (+)."),
    { pin: "19", signal: "TMDS Data0/5 Shield", name: "Đất cặp 0/5", dir: "gnd", desc: "Đất cho cặp Data0 và Data5." },
    tmds("20", "TMDS Data5−", "TMDS dữ liệu 5 (−)", "D5", "out", "Kênh đỏ link 2 (−). " + LINK2),
    tmds("21", "TMDS Data5+", "TMDS dữ liệu 5 (+)", "D5", "out", "Kênh đỏ link 2 (+). " + LINK2),
    { pin: "22", signal: "TMDS Clock Shield", name: "Đất cặp clock", dir: "gnd", desc: "Đất cho cặp clock." },
    tmds("23", "TMDS Clock+", "TMDS clock (+)", "CLK", "out", "Xung nhịp TMDS (= pixel clock, dùng chung cho cả hai link)."),
    tmds("24", "TMDS Clock−", "TMDS clock (−)", "CLK", "out", "Xung nhịp TMDS (−)."),
    { pin: "C1", signal: "Analog Red", name: "Đỏ analog", dir: "out", pair: "R", desc: "Đỏ 0,7 Vpp / 75 Ω — y hệt chân 1 của VGA." },
    { pin: "C2", signal: "Analog Green", name: "Lục analog", dir: "out", pair: "G", desc: "Lục 0,7 Vpp / 75 Ω." },
    { pin: "C3", signal: "Analog Blue", name: "Lam analog", dir: "out", pair: "B", desc: "Lam 0,7 Vpp / 75 Ω." },
    { pin: "C4", signal: "Analog HSync", name: "Đồng bộ ngang analog", dir: "out", desc: "HSync cho phần analog." },
    { pin: "C5", signal: "Analog GND", name: "Đất analog (lưỡi dẹt)", dir: "gnd", desc: "Lưỡi dẹt ngang: đường về chung của R, G, B analog." },
    { pin: "S", signal: "SHELL", name: "Vỏ", dir: "shield", desc: SHELL_DESC }
  ];
  function ncMap(list, desc) {
    var o = {};
    list.forEach(function (p) { o[p] = { signal: "—", dir: "nc", desc: desc }; });
    return o;
  }
  var dviSingle = ncMap(["4", "5", "12", "13", "20", "21"], "Single link: không có chân (vị trí trống).");
  var dviNoAnalog = ncMap(["8", "C1", "C2", "C3", "C4"], "DVI-D: không có phần analog (không có chân C1–C4; chân 8 không dùng).");
  dviNoAnalog.C5 = { signal: "(lưỡi dẹt)", dir: "nc", desc: "DVI-D vẫn có lưỡi dẹt ngang để định hướng; theo DDWG Bảng 5-3 C5 là \"analog ground, when present\" nên không phải tiếp điểm tín hiệu của DVI-D." };
  function merge() { var o = {}; for (var a = 0; a < arguments.length; a++) for (var k in arguments[a]) o[k] = arguments[a][k]; return o; }

  // HDMI: định nghĩa tín hiệu chung, rồi gán theo thứ tự chân của từng Type.
  function hdmiSig(key, role) {
    var src = role === "source";
    var T = function (sig, name, pair, desc) { return { signal: sig, name: name, dir: src ? "out" : "in", pair: pair, desc: desc }; };
    var G = function (sig, name, desc) { return { signal: sig, name: name, dir: "gnd", desc: desc }; };
    var TM = "Cặp vi sai TMDS (HDMI 1.x–2.0): kết cuối 50 Ω lên 3,3 V ở phía nhận, mã 8b/10b; HDMI 2.1 FRL dùng cùng chân, mã 16b/18b.";
    var map = {
      D2p: T("TMDS Data2+", "TMDS dữ liệu 2 (+)", "D2", TM + " HDMI 2.1: FRL lane 2 (+)."),
      D2s: G("TMDS Data2 Shield", "Đất cặp 2", "Đất (shield) của cặp Data2."),
      D2n: T("TMDS Data2−", "TMDS dữ liệu 2 (−)", "D2", "Cực (−) của cặp Data2."),
      D1p: T("TMDS Data1+", "TMDS dữ liệu 1 (+)", "D1", TM + " HDMI 2.1: FRL lane 1 (+)."),
      D1s: G("TMDS Data1 Shield", "Đất cặp 1", "Đất của cặp Data1."),
      D1n: T("TMDS Data1−", "TMDS dữ liệu 1 (−)", "D1", "Cực (−) của cặp Data1."),
      D0p: T("TMDS Data0+", "TMDS dữ liệu 0 (+)", "D0", TM + " HDMI 2.1: FRL lane 0 (+)."),
      D0s: G("TMDS Data0 Shield", "Đất cặp 0", "Đất của cặp Data0."),
      D0n: T("TMDS Data0−", "TMDS dữ liệu 0 (−)", "D0", "Cực (−) của cặp Data0."),
      CKp: T("TMDS Clock+", "TMDS clock (+)", "CLK", "Xung nhịp TMDS (HDMI 1.x–2.0). HDMI 2.1 FRL 4 lane: cặp này thành FRL lane 3 (+)."),
      CKs: G("TMDS Clock Shield", "Đất cặp clock", "Đất của cặp clock / FRL lane 3."),
      CKn: T("TMDS Clock−", "TMDS clock (−)", "CLK", "Cực (−) của cặp clock / FRL lane 3."),
      CEC: { signal: "CEC", name: "Consumer Electronics Control", dir: "io", desc: "Bus điều khiển một dây chung cho mọi thiết bị HDMI (điều khiển TV/đầu thu bằng một remote)." },
      UTIL: { signal: "Utility / HEAC+", name: "Utility (HEAC+)", dir: "io", pair: "HEAC", desc: "HDMI 1.0–1.3: dự trữ (không nối). HDMI 1.4+: HEAC+ — cặp với HPD cho ARC/eARC (âm thanh về) và HEC (Ethernet qua HDMI)." },
      SCL: { signal: "SCL", name: "DDC clock (I²C)", dir: src ? "out" : "in", desc: "Xung nhịp I²C DDC do nguồn phát: đọc EDID, HDCP, SCDC (HDMI 2.0+)." },
      SDA: { signal: "SDA", name: "DDC data (I²C)", dir: "io", desc: "Dữ liệu I²C DDC." },
      GND: { signal: "DDC/CEC Ground", name: "Đất DDC/CEC/HEAC", dir: "gnd", desc: "Đất cho DDC, CEC, +5 V và HEAC." },
      P5V: { signal: "+5V", name: "+5 V", dir: "pwr", desc: src ? "Nguồn cấp +5 V (tối thiểu 55 mA) để phía nhận đọc được EDID kể cả khi tắt." : "Nhận +5 V từ nguồn để cấp cho EEPROM EDID và kéo HPD lên; phía nhận không được hút quá 50 mA." },
      HPD: { signal: "Hot Plug Detect", name: "Phát hiện cắm nóng (HEAC−)", dir: src ? "in" : "out", pair: "HEAC", desc: "Phía nhận nối chân này lên +5 V (qua điện trở ~1 kΩ) khi sẵn sàng → nguồn đọc EDID. HDMI 1.4+: kiêm HEAC− (cặp với Utility)." }
    };
    var o = map[key];
    var r = {}; for (var k in o) r[k] = o[k];
    return r;
  }
  var HDMI_A_ORDER = ["D2p", "D2s", "D2n", "D1p", "D1s", "D1n", "D0p", "D0s", "D0n", "CKp", "CKs", "CKn", "CEC", "UTIL", "SCL", "SDA", "GND", "P5V", "HPD"];
  var HDMI_C_ORDER = ["D2s", "D2p", "D2n", "D1s", "D1p", "D1n", "D0s", "D0p", "D0n", "CKs", "CKp", "CKn", "GND", "CEC", "SCL", "SDA", "UTIL", "P5V", "HPD"];
  var HDMI_D_ORDER = ["HPD", "UTIL", "D2p", "D2s", "D2n", "D1p", "D1s", "D1n", "D0p", "D0s", "D0n", "CKp", "CKs", "CKn", "CEC", "GND", "SCL", "SDA", "P5V"];
  function hdmiPins(order, role) {
    var out = order.map(function (k, i) { var p = hdmiSig(k, role); p.pin = String(i + 1); return p; });
    out.push({ pin: "S", signal: "SHELL", name: "Vỏ", dir: "shield", desc: SHELL_DESC });
    // đưa "pin" lên đầu cho dễ đọc khi in
    return out.map(function (p) { var o = { pin: p.pin }; for (var k in p) if (k !== "pin") o[k] = p[k]; return o; });
  }
  function pinOfKey(order, key) { return String(order.indexOf(key) + 1); }
  function hdmiGroups(order) {
    var g = function (keys) { return keys.map(function (k) { return pinOfKey(order, k); }); };
    return [
      { name: "TMDS dữ liệu", pins: g(["D2p", "D2n", "D1p", "D1n", "D0p", "D0n"]) },
      { name: "TMDS clock", pins: g(["CKp", "CKn"]) },
      { name: "Đất (shield cặp)", pins: g(["D2s", "D1s", "D0s", "CKs"]) },
      { name: "DDC", pins: g(["SCL", "SDA"]) },
      { name: "Điều khiển (CEC, HPD, HEAC)", pins: g(["CEC", "UTIL", "HPD"]) },
      { name: "Nguồn/đất", pins: g(["P5V", "GND"]) }
    ];
  }
  function hdmiFrl(order) {
    var o = {};
    o[pinOfKey(order, "CKp")] = { signal: "FRL Lane 3+", desc: "HDMI 2.1 FRL 4 lane (≥ 24 Gbit/s): cặp clock trở thành lane dữ liệu 3; xung nhịp nhúng trong dữ liệu 16b/18b." };
    o[pinOfKey(order, "CKn")] = { signal: "FRL Lane 3−", desc: "HDMI 2.1 FRL lane 3 (−)." };
    return [{ id: "hdmi21-frl", name: "HDMI 2.1 FRL (4 lane)", note: "Fixed Rate Link 3×3/3×6 Gbit/s dùng 3 cặp dữ liệu; 4×6/4×8/4×10/4×12 Gbit/s dùng thêm cặp clock làm lane 3. Cáp phải đạt Ultra High Speed (48 Gbit/s).", pins: o }];
  }
  var HDMI_DETAIL_COMMON =
    "Mức điện TMDS: vi sai dòng ~10 mA, kết cuối 50 Ω lên AVcc 3,3 V ở phía nhận. Tốc độ: HDMI 1.3/1.4 tới 340 MHz (10,2 Gbit/s tổng), 2.0 tới 600 MHz (18 Gbit/s), " +
    "2.1 FRL tới 48 Gbit/s (4 lane × 12). Cáp: Standard (1.x), High Speed (10,2), Premium High Speed (18), Ultra High Speed (48). " +
    "Chuyển đổi cần IC (không chế bằng dây được): HDMI → VGA (bộ chuyển số→analog, DAC + bộ giải mã TMDS, thường lấy nguồn từ +5 V chân HDMI hoặc USB); " +
    "HDMI → DisplayPort (bộ chuyển giao thức, cần nguồn USB); USB-C → HDMI (DP Alt Mode + IC chuyển DP→HDMI, hoặc HDMI Alt Mode hiếm gặp).";

  // DisplayPort
  function dpSig(key, role) {
    var src = role === "source";
    var ML = function (lane, pol) {
      return { signal: "ML_Lane" + lane + " (" + pol + ")", name: "Main Link lane " + lane + " (" + (pol === "p" ? "+" : "−") + ")", dir: src ? "out" : "in", pair: "L" + lane,
        desc: "Cặp vi sai Main Link, ghép tụ (AC-coupled) ở phía phát. DP 1.x: 8b/10b, RBR 1,62 / HBR 2,7 / HBR2 5,4 / HBR3 8,1 Gbit/s mỗi lane; DP 2.x UHBR10/13.5/20 mã 128b/132b." +
          (src ? " DP++: mang TMDS khi có đầu chuyển (Lane 0 → TMDS Data2, Lane 1 → Data1, Lane 2 → Data0, Lane 3 → Clock)." : "") };
    };
    var map = {
      L0p: ML(0, "p"), L0n: ML(0, "n"), L1p: ML(1, "p"), L1n: ML(1, "n"), L2p: ML(2, "p"), L2n: ML(2, "n"), L3p: ML(3, "p"), L3n: ML(3, "n"),
      G: { signal: "GND", name: "Đất", dir: "gnd", desc: "Đất (cũng là đất/drain của cặp lân cận)." },
      CFG1: src
        ? { signal: "CONFIG1", name: "CONFIG1 (Cable Adapter Detect)", dir: "in", desc: "Nguồn đọc chân này để biết đầu cắm vào là màn hình/cáp DP hay đầu chuyển DP++ (Cable Adapter Detect) → chuyển sang xuất TMDS." }
        : { signal: "CONFIG1", name: "CONFIG1", dir: "nc", desc: "Phía nhận PHẢI nối đất qua linh kiện kéo xuống (pull-down), không được dựa vào đường đất trở kháng thấp (DP 1.1a Bảng 4-4 chú thích 1; DP 1.2 Bảng 4-5 chú thích 1; Interop Guideline 1.1 §5.1.1). Nguồn thấy mức thấp → biết đây là thiết bị DP; DP++ do đầu chuyển (cắm vào ổ nguồn) kéo chân 13 lên cao, không phải màn hình." },
      CFG2: src
        ? { signal: "CONFIG2", name: "CONFIG2 (CEC trong DP++)", dir: "io", desc: "Dự trữ trong chế độ DP; ở chế độ DP++ với đầu chuyển HDMI mang CEC." }
        : { signal: "CONFIG2", name: "CONFIG2", dir: "nc", desc: "Phía nhận PHẢI nối đất qua linh kiện kéo xuống (pull-down), không dựa vào đường đất trở kháng thấp (DP 1.1a Bảng 4-4 chú thích 1; DP 1.2 Bảng 4-5 chú thích 1)." },
      AUXp: { signal: "AUX_CH (p)", name: "AUX (+)", dir: "io", pair: "AUX", desc: "Kênh phụ hai chiều (bán song công): đọc DPCD/EDID, link training, HDCP, MST. 1 Mbit/s Manchester (FAUX 720 Mbit/s tuỳ chọn ở DP 1.2)." + (src ? " DP++: thành DDC SCL." : "") },
      AUXn: { signal: "AUX_CH (n)", name: "AUX (−)", dir: "io", pair: "AUX", desc: "Cực (−) kênh AUX." + (src ? " DP++: thành DDC SDA." : "") },
      HPD: { signal: "Hot Plug Detect", name: "Phát hiện cắm nóng", dir: src ? "in" : "out", desc: "Phía nhận giữ mức cao khi đã cắm; xung thấp ngắn (0,5–1 ms) là ngắt IRQ báo nguồn đọc DPCD." },
      RET: { signal: "RETURN", name: "Đất của DP_PWR", dir: "gnd", desc: "Đường về của DP_PWR (đất). Tên RETURN chỉ dùng cho DP full-size." },
      GM: { signal: "GND", name: "Đất", dir: "gnd", desc: "Mini DP chân 19: VESA đặt tên GND (DP 1.2 Bảng 4-10, 4-11), khác DP full-size nơi chân 19 là RETURN. Về điện cùng là đường về của DP_PWR." },
      PWR: { signal: "DP_PWR", name: "Nguồn 3,3 V", dir: "pwr", desc: "3,3 V ±10 %, tới 500 mA — có ở CẢ nguồn và phía nhận để nuôi đầu chuyển/cáp tích cực. Cáp DP thụ động KHÔNG được nối chân này (VESA DP 1.1+ §3.2.2): hai nguồn 3,3 V lệch nhau sẽ đẩy dòng vào nhau." }
    };
    var o = map[key], r = {}; for (var k in o) r[k] = o[k];
    return r;
  }
  var DP_SRC_ORDER = ["L0p", "G", "L0n", "L1p", "G", "L1n", "L2p", "G", "L2n", "L3p", "G", "L3n", "CFG1", "CFG2", "AUXp", "G", "AUXn", "HPD", "RET", "PWR"];
  var DP_SNK_ORDER = ["L3n", "G", "L3p", "L2n", "G", "L2p", "L1n", "G", "L1p", "L0n", "G", "L0p", "CFG1", "CFG2", "AUXp", "G", "AUXn", "HPD", "RET", "PWR"];
  var MDP_SRC_ORDER = ["G", "HPD", "L0p", "CFG1", "L0n", "CFG2", "G", "G", "L1p", "L3p", "L1n", "L3n", "G", "G", "L2p", "AUXp", "L2n", "AUXn", "GM", "PWR"];
  function dpPins(order, role) {
    var out = order.map(function (k, i) { var p = dpSig(k, role); var o = { pin: String(i + 1) }; for (var x in p) o[x] = p[x]; return o; });
    out.push({ pin: "S", signal: "SHELL", name: "Vỏ", dir: "shield", desc: SHELL_DESC });
    return out;
  }
  function dpGroups(order) {
    var pick = function (re) { var o = []; order.forEach(function (k, i) { if (re.test(k)) o.push(String(i + 1)); }); return o; };
    return [
      { name: "Main Link (4 lane)", pins: pick(/^L\d/) },
      { name: "AUX", pins: pick(/^AUX/) },
      { name: "Điều khiển (HPD, CONFIG)", pins: pick(/^(HPD|CFG)/) },
      { name: "Nguồn DP_PWR", pins: pick(/^(PWR|RET)$/) },
      { name: "Đất", pins: pick(/^GM?$/) }
    ];
  }
  var DP_CONVERT =
    "Chuyển đổi cần IC (không chế bằng dây được, không có mục Cable): " +
    "(1) DP → HDMI/DVI loại 'passive' chỉ chạy với ổ DP++: đầu chuyển vẫn có IC dịch mức (Main Link ghép tụ AC ↔ TMDS ghép DC, cần kéo lên 3,3 V) " +
    "và bộ đệm DDC/ID (địa chỉ 80h/81h), kéo lên chân 13/14, ổn áp từ DP_PWR (DP Interoperability Guideline 1.1, 2008); " +
    "phân loại Type 1 (165 MHz) / Type 2 (300 MHz) thuộc VESA DP Dual-Mode Standard (từ 2013) — CHƯA XÁC MINH; nối thẳng dây sẽ không có hình. " +
    "(2) DP → HDMI 'active' (ổ DP không có DP++ hoặc cần HDMI 2.0/2.1): IC chuyển giao thức (LSPCon/PCON). " +
    "(3) DP → VGA: IC chuyển DP → analog (DAC). (4) HDMI/DVI → DP: luôn cần IC chủ động (DP++ chỉ một chiều nguồn DP → màn hình HDMI). " +
    "(5) USB-C → DP/HDMI: DP Alt Mode trên USB-C cần bộ điều khiển PD thương lượng Alternate Mode qua CC; cáp USB-C ↔ DP 'thụ động' bên trong vẫn có IC PD/billboard.";

  var pinouts = {
    "vga-de15": {
      id: "vga-de15",
      body: "de15",
      name: "VGA trên DE-15 (phía nguồn — card đồ hoạ)",
      family: "video",
      standard: "VESA E-DDC 1.x / VESA DDC (chân 9 +5 V, 12 SDA, 15 SCL); IBM PS/2 VGA 1987 (RGB, sync, bit ID)",
      role: "source",
      gender: "female",
      summary: "RGB analog 0,7 Vpp / 75 Ω trên 3 sợi đồng trục, HSync/VSync mức TTL, DDC I²C đọc EDID, +5 V cho EEPROM màn hình.",
      detail:
        "Vai trò: phía NGUỒN (card đồ hoạ, laptop) — dir ghi từ phía card. Phía màn hình: xem vga-de15-sink (R/G/B, sync là vào; +5 V là nhận; chân 4/11 Reserved). " +
        "Mỗi màu R/G/B đi trên một sợi đồng trục 75 Ω, đường về riêng (6, 7, 8); sync và DDC đi dây thường. Cáp dài/kém (không đồng trục) gây bóng mờ (ghosting). " +
        "Ba thế hệ chân nhận dạng: IBM 1987 dùng bit ID0–ID3 (màn hình nối đất các chân 11, 12, 4, 15 theo loại); DDC1 dùng chân 12 làm dữ liệu một chiều theo nhịp VSync; " +
        "DDC2/E-DDC (hiện nay) dùng I²C trên 12 (SDA) và 15 (SCL), chân 9 cấp +5 V; chân 4 và 11: phía host là bit nhận dạng ID2/ID0 (tuỳ chọn), phía màn hình là Reserved. " +
        "Chuyển đổi cần IC: HDMI → VGA, DP → VGA, USB-C → VGA (DAC/bộ chuyển số→analog). Riêng DVI-I/DVI-A → VGA là dây thụ động (xem dvi-i-vga) " +
        "vì DVI-I mang sẵn RGB analog trên C1–C5.",
      pins: vgaPins,
      groups: [
        { name: "RGB analog", pins: ["1", "2", "3"] },
        { name: "Đất RGB", pins: ["6", "7", "8"] },
        { name: "Đồng bộ", pins: ["13", "14"] },
        { name: "DDC (EDID)", pins: ["12", "15", "9"] },
        { name: "Đất chung", pins: ["5", "10"] },
        { name: "Dự trữ (ID cũ)", pins: ["4", "11"] }
      ],
      variants: [
        {
          id: "ibm-vga-1987",
          name: "IBM VGA 1987 (bit ID, trước DDC)",
          note: "Màn hình báo loại (đơn sắc/màu, độ phân giải) bằng cách nối đất một số chân ID; card đọc các chân này như đầu vào.",
          pins: {
            "4": { signal: "ID2", dir: "in", desc: "Bit nhận dạng màn hình 2 (màn hình nối đất hoặc để hở)." },
            "9": { signal: "KEY", dir: "nc", desc: "Chốt định hướng: đầu đực không có chân, đầu cái bịt lỗ." },
            "11": { signal: "ID0", dir: "in", desc: "Bit nhận dạng màn hình 0." },
            "12": { signal: "ID1", dir: "in", desc: "Bit nhận dạng màn hình 1." },
            "15": { signal: "ID3", dir: "in", desc: "Bit nhận dạng 3 (IBM 8514/XGA; VGA gốc không dùng)." }
          }
        },
        {
          id: "ddc1",
          name: "VESA DDC1 (một chiều)",
          note: "Màn hình liên tục phát EDID trên chân 12, đồng bộ theo VSync; đã bị DDC2B (I²C) thay thế.",
          pins: {
            "12": { signal: "DATA (DDC1)", dir: "in", desc: "Dữ liệu EDID một chiều từ màn hình." },
            "14": { signal: "VSYNC / VCLK", desc: "VSync đồng thời là xung nhịp cho DDC1." },
            "15": { signal: "—", dir: "nc", desc: "Không dùng ở DDC1." }
          }
        }
      ]
    },

    "vga-de15-sink": {
      id: "vga-de15-sink",
      body: "de15",
      name: "VGA trên DE-15 (phía nhận — màn hình, máy chiếu)",
      family: "video",
      standard: "VESA E-DDC 1.2 Bảng 7-1 (cột Display), §7.1.3 (chân 9)",
      role: "sink",
      gender: "female",
      summary: "Cùng gán chân với vga-de15, chiều ngược lại: R/G/B và sync là vào, SCL vào, +5 V nhận từ host; chân 4 và 11 Reserved – không nối.",
      detail:
        "Vai trò: phía NHẬN (màn hình, máy chiếu) — dir ghi từ phía màn hình. Dùng làm đầu b của vga-cable. " +
        "RGB 0,7 Vpp kết cuối 75 Ω trong màn hình; SDA (12) hai chiều vì EEPROM EDID trả dữ liệu; SCL (15) do host phát nên là vào. " +
        "Chân 9: màn hình nhận +5 V từ host, hút ≤ 50 mA khi tắt và ≤ 1 mA khi bật (E-DDC §7.1.3). " +
        "Chân 4 và 11: cột Display của E-DDC Bảng 7-1 ghi Reserved – No connection (khác phía host là bit nhận dạng ID2/ID0).",
      pins: vgaPins.map(function (p) {
        var o = {}; for (var k in p) o[k] = p[k];
        if (o.pin === "1" || o.pin === "2" || o.pin === "3" || o.pin === "13" || o.pin === "14" || o.pin === "15") o.dir = "in";
        if (o.pin === "4") { o.signal = "RES"; o.name = "Dự trữ (không nối)"; o.dir = "nc"; o.desc = "E-DDC 1.2 Bảng 7-1 cột Display: Reserved – No connection."; }
        if (o.pin === "11") { o.signal = "RES"; o.name = "Dự trữ (không nối)"; o.dir = "nc"; o.desc = "E-DDC 1.2 Bảng 7-1 cột Display: Reserved – No connection."; }
        if (o.pin === "9") { o.desc = "Màn hình nhận +5 V từ host (E-DDC §7.1.3): hút ≤ 50 mA khi tắt, ≤ 1 mA khi bật; dùng nuôi EEPROM EDID."; }
        if (o.pin === "12") { o.desc = "Dữ liệu I²C DDC2: màn hình trả EDID, nên hai chiều."; }
        if (o.pin === "15") { o.desc = "Xung nhịp I²C DDC2 do host (master) phát; màn hình nhận."; }
        if (o.pin === "1" || o.pin === "2" || o.pin === "3") o.desc = o.desc.replace(/^Video/, "Video (vào, kết cuối 75 Ω)");
        return o;
      }),
      groups: [
        { name: "RGB analog", pins: ["1", "2", "3"] },
        { name: "Đất RGB", pins: ["6", "7", "8"] },
        { name: "Đồng bộ", pins: ["13", "14"] },
        { name: "DDC (EDID)", pins: ["12", "15", "9"] },
        { name: "Đất chung", pins: ["5", "10"] },
        { name: "Dự trữ", pins: ["4", "11"] }
      ]
    },

    "dvi-i": {
      id: "dvi-i",
      body: "dvi",
      name: "DVI-I (phía nguồn — card đồ hoạ)",
      family: "video",
      standard: "DDWG Digital Visual Interface Revision 1.0 §5.2.1 (Bảng 5-1 gán chân số, Bảng 5-2 kết hợp)",
      role: "source",
      gender: "female",
      summary: "TMDS 2 link (6 cặp dữ liệu + clock) + DDC + Hot Plug + RGB analog trên C1–C5; biến thể DVI-D single/dual và DVI-A.",
      detail:
        "Vai trò: phía NGUỒN (card đồ hoạ) — dir ghi từ phía card; màn hình cùng gán chân, chiều ngược lại. " +
        "Link 1 = Data0/1/2 (lam/lục/đỏ) + clock, tới 165 MHz pixel clock (1920×1200 @ 60 Hz giảm blanking); dual link thêm Data3/4/5, dùng chung clock, " +
        "mỗi link chở nửa số pixel (2560×1600 @ 60 Hz). Mức TMDS giống HDMI → DVI-D ↔ HDMI chỉ cần dây (xem cáp dvi-hdmi), " +
        "nhưng nguồn DVI không gửi âm thanh/InfoFrame; card hiện đại có thể gửi âm thanh qua DVI khi phát hiện màn hình HDMI (EDID), không phải chuẩn DVI. " +
        "DVI-I mang cả RGB analog trên C1–C5 → đầu chuyển DVI-I → VGA là thụ động (dvi-i-vga). Card chỉ có DVI-D thì không có analog: cần bộ chuyển có IC. " +
        "Chuyển đổi cần IC: DVI → DisplayPort (bộ chuyển chủ động); DVI dual link → HDMI 1.x (không có dual link trên HDMI, cần scaler); DP → DVI (xem dp-source).",
      pins: dviPinsData,
      groups: [
        { name: "TMDS link 1", pins: ["1", "2", "9", "10", "17", "18"] },
        { name: "TMDS link 2", pins: ["4", "5", "12", "13", "20", "21"] },
        { name: "TMDS clock", pins: ["23", "24"] },
        { name: "Đất (shield cặp)", pins: ["3", "11", "19", "22"] },
        { name: "DDC + Hot Plug", pins: ["6", "7", "16"] },
        { name: "Nguồn/đất", pins: ["14", "15"] },
        { name: "Analog", pins: ["C1", "C2", "C3", "C4", "C5", "8"] }
      ],
      variants: [
        { id: "dvi-d-single", name: "DVI-D single link (18+1)", note: "Chỉ số, 1 link: thiếu 6 chân link 2 và toàn bộ analog C1–C4.", pins: merge(dviSingle, dviNoAnalog) },
        { id: "dvi-d-dual", name: "DVI-D dual link (24+1)", note: "Chỉ số, 2 link; không có analog C1–C4.", pins: dviNoAnalog },
        {
          id: "dvi-a",
          name: "DVI-A (chỉ analog)",
          note: "Chỉ RGB analog + sync + DDC; thường chỉ gặp ở đầu chuyển. DDWG DVI 1.0 không định nghĩa tên \"DVI-A\": đây là cách gọi thực tế của công nghiệp, CHƯA XÁC MINH theo chuẩn.",
          pins: ncMap(["1", "2", "3", "4", "5", "9", "10", "11", "12", "13", "17", "18", "19", "20", "21", "22", "23", "24"], "DVI-A: không dùng TMDS.")
        }
      ]
    },

    "hdmi-a-pin": {
      id: "hdmi-a-pin",
      body: "hdmi-a",
      name: "HDMI Type A (phía nhận — TV/màn hình)",
      family: "video",
      standard: "HDMI Specification 1.4b §4.1 (gán chân Type A); HDMI 2.1 (FRL, eARC)",
      role: "sink",
      gender: "female",
      summary: "3 cặp TMDS dữ liệu + 1 cặp clock (mỗi cặp có chân đất riêng), DDC (EDID/HDCP/SCDC), CEC, +5 V, Hot Plug, Utility/HEAC.",
      detail:
        "Vai trò: phía NHẬN (TV, màn hình, máy chiếu) — dir ghi từ phía TV: TMDS là vào, SCL vào, HPD ra, +5 V nhận. " +
        "Ổ HDMI trên NGUỒN (PC, đầu thu) cùng gán chân, chiều ngược lại. Pinout này để làm đầu b của cáp dvi-hdmi, hdmi-a-c, hdmi-a-d (nguồn ở đầu kia). " +
        HDMI_DETAIL_COMMON,
      pins: hdmiPins(HDMI_A_ORDER, "sink"),
      groups: hdmiGroups(HDMI_A_ORDER),
      variants: hdmiFrl(HDMI_A_ORDER)
    },

    "hdmi-c-pin": {
      id: "hdmi-c-pin",
      body: "hdmi-c",
      name: "HDMI Type C — Mini (phía nguồn — máy ảnh, card nhỏ)",
      family: "video",
      standard: "HDMI Specification 1.3a §4.1.4 Bảng 4-3 (gán chân Type C); §4.1.10.5 Bảng 4-13 (cáp C↔A)",
      role: "source",
      gender: "female",
      summary: "Cùng 19 tín hiệu như Type A, xếp một hàng: đất–(+)–(−) cho mỗi cặp; CEC ở 14, đất DDC ở 13, Utility ở 17.",
      detail:
        "Vai trò: phía NGUỒN (máy ảnh, máy quay, card đồ hoạ nhỏ, tablet) — dir ghi từ phía nguồn: TMDS ra, SCL ra, HPD vào, +5 V cấp. " +
        "So với Type A: chân dương mỗi cặp TMDS đổi chỗ với chân đất của cặp (1↔2, 4↔5, 7↔8, 10↔11), DDC/CEC Ground chân 13 (A: 17), CEC chân 14 (A: 13), Utility chân 17 (A: 14); " +
        "SCL 15, SDA 16, +5 V 18, HPD 19 giữ nguyên. " + HDMI_DETAIL_COMMON,
      pins: hdmiPins(HDMI_C_ORDER, "source"),
      groups: hdmiGroups(HDMI_C_ORDER),
      variants: hdmiFrl(HDMI_C_ORDER)
    },

    "hdmi-d-pin": {
      id: "hdmi-d-pin",
      body: "hdmi-d",
      name: "HDMI Type D — Micro (phía nguồn — Raspberry Pi, máy ảnh)",
      family: "video",
      standard: "HDMI Specification 1.4/1.4b §4.1 (Type D); gán chân theo datasheet Multicomp MC002785 — CHƯA XÁC MINH theo chuẩn",
      vendor: true,
      role: "source",
      gender: "female",
      summary: "19 chân hai hàng; HPD ở chân 1, Utility 2, TMDS 3–14, CEC 15, đất 16, SCL 17, SDA 18, +5 V 19.",
      detail:
        "Vai trò: phía NGUỒN (Raspberry Pi 4/5, máy ảnh, điện thoại đời cũ) — dir ghi từ phía nguồn. " +
        "Khối TMDS giống Type A nhưng dịch +2 chân (A1 Data2+ → D3 … A12 Clock− → D14); khác cả A lẫn C ở mọi chân — cáp A↔D phải đi dây theo tên tín hiệu. " +
        HDMI_DETAIL_COMMON,
      pins: hdmiPins(HDMI_D_ORDER, "source"),
      groups: hdmiGroups(HDMI_D_ORDER),
      variants: hdmiFrl(HDMI_D_ORDER)
    },

    "dp-source": {
      id: "dp-source",
      body: "dp",
      name: "DisplayPort full-size — phía NGUỒN (card đồ hoạ, laptop)",
      family: "video",
      standard: "VESA DisplayPort Standard 1.1a/1.2 §4 (bảng chân receptacle phía nguồn); DP Interoperability Guideline 1.1 (DP++; Type 1/2 của Dual-Mode: CHƯA XÁC MINH)",
      role: "source",
      gender: "female",
      summary: "Lane 0 ở chân 1/3 … Lane 3 ở 10/12 (+ trước −), CONFIG1/2, AUX 15/17, HPD 18, RETURN 19, DP_PWR 20.",
      detail:
        "Vai trò: phía NGUỒN — dir từ phía card. Thứ tự lane phía nguồn: chân 1 = Lane 0 (+), 3 = Lane 0 (−), 4/6 = Lane 1, 7/9 = Lane 2, 10/12 = Lane 3; " +
        "mỗi cặp có chân GND ở giữa (2, 5, 8, 11). Phía nhận (dp-sink) đảo thứ tự lane và cực, nên cáp chuẩn nối 1↔12, 3↔10 … — xem cáp dp-dp. " +
        "Dùng 1, 2 hoặc 4 lane (Lane 0 luôn có). DP++ (Dual-Mode): khi CONFIG1 báo có đầu chuyển, nguồn xuất TMDS trên 4 lane và DDC trên AUX. " +
        DP_CONVERT,
      pins: dpPins(DP_SRC_ORDER, "source"),
      groups: dpGroups(DP_SRC_ORDER),
      variants: [
        {
          id: "dp-dual-mode",
          name: "DP++ (Dual-Mode) khi có đầu chuyển HDMI/DVI",
          note: "Theo DP Interoperability Guideline 1.1. Đầu chuyển vẫn phải có IC dịch mức (Main Link ghép AC → TMDS ghép DC) — không chế bằng dây được.",
          pins: {
            "1": { signal: "TMDS Data2+" }, "3": { signal: "TMDS Data2−" },
            "4": { signal: "TMDS Data1+" }, "6": { signal: "TMDS Data1−" },
            "7": { signal: "TMDS Data0+" }, "9": { signal: "TMDS Data0−" },
            "10": { signal: "TMDS Clock+" }, "12": { signal: "TMDS Clock−" },
            "13": { signal: "Cable Adapter Detect" }, "14": { signal: "CEC" },
            "15": { signal: "DDC SCL" }, "17": { signal: "DDC SDA" }
          }
        }
      ]
    },

    "dp-sink": {
      id: "dp-sink",
      body: "dp",
      name: "DisplayPort full-size — phía NHẬN (màn hình)",
      family: "video",
      standard: "VESA DisplayPort Standard 1.1a/1.2 §4 (bảng chân receptacle phía nhận)",
      role: "sink",
      gender: "female",
      summary: "Thứ tự lane đảo so với phía nguồn: Lane 3 ở chân 1 (−)/3 (+) … Lane 0 ở 10 (−)/12 (+); AUX, HPD, DP_PWR như phía nguồn.",
      detail:
        "Vai trò: phía NHẬN (màn hình) — dir từ phía màn hình: Main Link vào, HPD ra. Lane và cực đảo so với dp-source: chân 1 = Lane 3 (−), 3 = Lane 3 (+), " +
        "4/6 = Lane 2 (−/+), 7/9 = Lane 1 (−/+), 10/12 = Lane 0 (−/+). Lý do: cáp DP đi dây gương 1↔12 … 12↔1 (khối Main Link), " +
        "nhờ vậy cùng một bố trí trên PCB hai bên mà lane khớp. AUX (15/17), HPD (18), RETURN (19), DP_PWR (20) cùng số chân với phía nguồn. " +
        "Cáp nối AUX thẳng 15↔15, 17↔17 (đã đối chiếu DP 1.2 Hình 4-23). CONFIG1/2 phía nhận kéo xuống qua pull-down, không phải đầu ra. " +
        "Màn hình DP không nhận được TMDS từ nguồn HDMI/DVI qua dây: cần bộ chuyển chủ động HDMI → DP.",
      pins: dpPins(DP_SNK_ORDER, "sink"),
      groups: dpGroups(DP_SNK_ORDER)
    },

    "mini-dp-source": {
      id: "mini-dp-source",
      body: "mini-dp",
      name: "Mini DisplayPort — phía NGUỒN (laptop, card đồ hoạ)",
      family: "video",
      standard: "VESA DisplayPort Standard 1.2 §4 (Mini DisplayPort, bảng chân phía nguồn)",
      role: "source",
      gender: "female",
      summary: "GND 1, HPD 2, Lane 0 3/5, CONFIG1 4, CONFIG2 6, Lane 1 9/11, Lane 3 10/12, Lane 2 15/17, AUX 16/18, GND 19, DP_PWR 20.",
      detail:
        "Vai trò: phía NGUỒN — dir từ phía laptop. Gán chân khác hẳn DP full-size; tín hiệu y hệt (cùng Main Link, AUX, HPD, CONFIG, DP_PWR, DP++). " +
        "Phía nhận Mini DP (hiếm, vd. một số màn hình Apple) đảo lane: Lane 3 ở chân 3 (−)/5 (+), Lane 0 ở 10 (−)/12 (+). " +
        "Chân 19 Mini DP là GND (DP 1.2 Bảng 4-10, 4-11); chỉ DP full-size chân 19 mới tên RETURN. " +
        DP_CONVERT,
      pins: dpPins(MDP_SRC_ORDER, "source"),
      groups: dpGroups(MDP_SRC_ORDER)
    }
  };

  // ---------------------------------------------------------------- Cable
  // Nối theo khoá tín hiệu giữa hai thứ tự chân (dùng cho HDMI A↔C/D và DP).
  function wiresByKey(orderA, orderB, keys, noteFn) {
    return keys.map(function (k) {
      return { a: String(orderA.indexOf(k) + 1), b: String(orderB.indexOf(k) + 1), note: noteFn ? noteFn(k) : undefined };
    });
  }
  var HDMI_KEYS = ["D2p", "D2s", "D2n", "D1p", "D1s", "D1n", "D0p", "D0s", "D0n", "CKp", "CKs", "CKn", "CEC", "UTIL", "SCL", "SDA", "GND", "P5V", "HPD"];
  var HDMI_LABEL = { D2p: "Data2+", D2s: "Data2 Shield", D2n: "Data2−", D1p: "Data1+", D1s: "Data1 Shield", D1n: "Data1−", D0p: "Data0+", D0s: "Data0 Shield", D0n: "Data0−",
    CKp: "Clock+", CKs: "Clock Shield", CKn: "Clock−", CEC: "CEC", UTIL: "Utility/HEAC+", SCL: "SCL", SDA: "SDA", GND: "DDC/CEC Ground", P5V: "+5 V", HPD: "HPD/HEAC−" };
  function hdmiWires(orderB) {
    var w = wiresByKey(HDMI_A_ORDER, orderB, HDMI_KEYS, function (k) { return HDMI_LABEL[k]; }).map(function (x) {
      if (x.a !== x.b) x.note += " (khác số chân)";
      return x;
    });
    w.push({ a: "S", b: "S", note: "vỏ – lưới tổng – vỏ" });
    return w;
  }
  var HDMI_CABLE_WARN = [
    "Không đi dây 1–1 theo số chân giữa Type A và Type C/D — mọi tín hiệu phải nối theo TÊN (xem cột ghi chú).",
    "Mỗi cặp TMDS là một cặp xoắn có bọc riêng, drain nối chân Shield của cặp; trở kháng vi sai 100 Ω. Hàn dây rời không giữ được trở kháng → chỉ đạt tốc độ thấp, nên mua cáp làm sẵn."
  ];

  var DP_KEYS_MAIN = ["L0p", "L0n", "L1p", "L1n", "L2p", "L2n", "L3p", "L3n", "CFG1", "CFG2", "AUXp", "AUXn", "HPD", "RET"];
  var DP_NAME = { L0p: "Lane 0 (+)", L0n: "Lane 0 (−)", L1p: "Lane 1 (+)", L1n: "Lane 1 (−)", L2p: "Lane 2 (+)", L2n: "Lane 2 (−)", L3p: "Lane 3 (+)", L3n: "Lane 3 (−)",
    CFG1: "CONFIG1", CFG2: "CONFIG2", AUXp: "AUX (+)", AUXn: "AUX (−)", HPD: "HPD", RET: "RETURN (đất DP_PWR)" };

  var dpDpWires = wiresByKey(DP_SRC_ORDER, DP_SNK_ORDER, DP_KEYS_MAIN, function (k) { return DP_NAME[k]; })
    .concat([
      { a: "2", b: "11", note: "GND (đảo gương cùng khối Main Link)" },
      { a: "5", b: "8", note: "GND" },
      { a: "8", b: "5", note: "GND" },
      { a: "11", b: "2", note: "GND" },
      { a: "16", b: "16", note: "GND" },
      { a: "S", b: "S", note: "vỏ – lưới – vỏ" }
    ]);
  var mdpDpWires = wiresByKey(MDP_SRC_ORDER, DP_SNK_ORDER, DP_KEYS_MAIN.filter(function (k) { return k !== "RET"; }), function (k) { return DP_NAME[k]; })
    .concat([
      { a: "1", b: "11", note: "GND" },
      { a: "7", b: "8", note: "GND" },
      { a: "8", b: "2", note: "GND (DP 1.2 Hình 4-34/4-35)" },
      { a: "13", b: "5", note: "GND (DP 1.2 Hình 4-34/4-35)" },
      { a: "14", b: "16", note: "GND" },
      { a: "19", b: "19", note: "GND (Mini DP) ↔ RETURN (DP)" },
      { a: "S", b: "S", note: "vỏ – lưới – vỏ" }
    ]);

  var cables = [
    {
      id: "vga-cable",
      name: "Cáp VGA DE-15 đực ↔ đực",
      family: "video",
      kind: "cable",
      a: { pinout: "vga-de15", gender: "male", label: "Đầu cắm vào card đồ hoạ" },
      b: { pinout: "vga-de15-sink", gender: "male", label: "Đầu cắm vào màn hình/máy chiếu (nhận)" },
      wires: [
        { a: "1", b: "1", note: "RED — lõi đồng trục 75 Ω" },
        { a: "6", b: "6", note: "RED_RTN — lưới sợi đồng trục đỏ" },
        { a: "2", b: "2", note: "GREEN — lõi đồng trục" },
        { a: "7", b: "7", note: "GREEN_RTN — lưới" },
        { a: "3", b: "3", note: "BLUE — lõi đồng trục" },
        { a: "8", b: "8", note: "BLUE_RTN — lưới" },
        { a: "13", b: "13", note: "HSync" },
        { a: "14", b: "14", note: "VSync" },
        { a: "12", b: "12", note: "SDA (DDC)" },
        { a: "15", b: "15", note: "SCL (DDC)" },
        { a: "9", b: "9", note: "+5 V DDC" },
        { a: "5", b: "5", note: "GND" },
        { a: "10", b: "10", note: "GND (sync, DDC)" },
        { a: "S", b: "S", note: "vỏ – lưới tổng – vỏ" }
      ],
      use: "Nối card đồ hoạ/laptop với màn hình hoặc máy chiếu VGA.",
      standard: "VESA E-DDC (chân DDC/+5 V); nối 1–1 theo số chân",
      vendor: false,
      detail:
        "Cáp thẳng 1–1. R/G/B mỗi màu một sợi đồng trục 75 Ω (lõi → 1/2/3, lưới → 6/7/8); HSync, VSync, SDA, SCL, +5 V, GND là dây thường, " +
        "có lõi ferrite hai đầu để giảm nhiễu. Chân 4 và 11 (ID cũ) thường KHÔNG nối trong cáp hiện nay; vài cáp nối 11. " +
        "Cáp rẻ thiếu dây chân 12/15 hoặc 9 → màn hình không gửi được EDID, máy tính chỉ cho chọn độ phân giải mặc định. " +
        "Tự kiểm: đầu ra R/G/B/sync của card đi tới đầu vào cùng tên của màn hình (vga-de15 ghi dir từ phía card, vga-de15-sink từ phía màn hình); đất nối đất.",
      warnings: [
        "Không dùng cáp 'VGA' chỉ có dây thường (không đồng trục) cho độ phân giải cao: bóng mờ, nhoè.",
        "DE-15 không cắm lẫn được với DE-9 (cổng COM) dù cùng vỏ E — đếm số hàng chân trước khi cắm."
      ]
    },
    {
      id: "dvi-hdmi",
      name: "Cáp DVI-D (đực) ↔ HDMI Type A (đực)",
      family: "video",
      kind: "cable",
      a: { pinout: "dvi-i", gender: "male", label: "DVI-D đực — cắm vào card (nguồn)" },
      b: { pinout: "hdmi-a-pin", gender: "male", label: "HDMI A đực — cắm vào TV/màn hình (nhận)" },
      wires: [
        { a: "2", b: "1", note: "TMDS Data2+ (DVI 2 → HDMI 1)" },
        { a: "3", b: "2", note: "Data2 Shield" },
        { a: "1", b: "3", note: "TMDS Data2− (DVI 1 → HDMI 3)" },
        { a: "10", b: "4", note: "Data1+" },
        { a: "11", b: "5", note: "Data1 Shield" },
        { a: "9", b: "6", note: "Data1−" },
        { a: "18", b: "7", note: "Data0+" },
        { a: "19", b: "8", note: "Data0 Shield" },
        { a: "17", b: "9", note: "Data0−" },
        { a: "23", b: "10", note: "Clock+" },
        { a: "22", b: "11", note: "Clock Shield" },
        { a: "24", b: "12", note: "Clock−" },
        { a: "6", b: "15", note: "DDC clock → SCL" },
        { a: "7", b: "16", note: "DDC data ↔ SDA" },
        { a: "15", b: "17", note: "GND → DDC/CEC Ground" },
        { a: "14", b: "18", note: "+5 V" },
        { a: "16", b: "19", note: "Hot Plug Detect ← màn hình" },
        { a: "S", b: "S", note: "vỏ – lưới – vỏ" }
      ],
      use: "Nối card đồ hoạ có DVI-D/DVI-I với TV/màn hình HDMI (hoặc ngược lại, cáp hai chiều về điện) — chỉ single link.",
      standard: "HDMI Specification 1.4b §4.1 (tương thích DVI 1.0); DDWG DVI 1.0 §5.2.1 Bảng 5-1",
      vendor: false,
      detail:
        "Thụ động vì TMDS của DVI và HDMI cùng mức điện, cùng mã hoá: chỉ là nối dây theo tên tín hiệu. Chỉ link 1 (Data0–2 + clock): link 2 (4, 5, 12, 13, 20, 21) " +
        "và analog (C1–C5, 8) không nối; HDMI CEC (13) và Utility (14) không nối. Chú ý DVI đặt (−) trước (+) (chân 1 = Data2−) còn HDMI đặt (+) trước (chân 1 = Data2+). " +
        "Không có âm thanh nếu nguồn chỉ là DVI thuần; nhiều card hiện đại vẫn gửi âm thanh HDMI qua ổ DVI khi đọc EDID thấy màn hình HDMI. HDCP vẫn qua DDC. " +
        "Tự kiểm: TMDS ra của card (DVI out) → TMDS vào của TV (HDMI in); DDC clock card (out) → SCL TV (in); HPD do TV phát (out) → chân 16 card (in); +5 V → +5 V; đất → đất. " +
        "Dùng ngược (nguồn HDMI → màn hình DVI) được về điện vì cáp đối xứng tín hiệu; khi đó đọc chiều theo phía nguồn HDMI.",
      warnings: [
        "Không có dual link: màn hình 2560×1600 qua DVI dual link sẽ chỉ chạy độ phân giải thấp.",
        "Ổ DVI-D trên card không có analog — đầu chuyển DVI → VGA thụ động không chạy với ổ DVI-D."
      ]
    },
    {
      id: "dvi-i-vga",
      name: "Đầu chuyển DVI-I (đực) → VGA DE-15 (cái)",
      family: "video",
      kind: "adapter",
      a: { pinout: "dvi-i", gender: "male", label: "DVI-I/DVI-A đực — cắm vào card" },
      b: { pinout: "vga-de15", gender: "female", label: "VGA cái — cắm cáp VGA của màn hình" },
      wires: [
        { a: "C1", b: "1", note: "Red analog" },
        { a: "C2", b: "2", note: "Green analog" },
        { a: "C3", b: "3", note: "Blue analog" },
        { a: "C5", b: "6", note: "Đất analog → RED_RTN" },
        { a: "C5", b: "7", note: "Đất analog → GREEN_RTN" },
        { a: "C5", b: "8", note: "Đất analog → BLUE_RTN" },
        { a: "C4", b: "13", note: "HSync" },
        { a: "8", b: "14", note: "VSync" },
        { a: "6", b: "15", note: "DDC clock → SCL" },
        { a: "7", b: "12", note: "DDC data → SDA" },
        { a: "14", b: "9", note: "+5 V" },
        { a: "15", b: "5", note: "GND" },
        { a: "15", b: "10", note: "GND (sync, DDC)" },
        { a: "S", b: "S", note: "vỏ – vỏ" }
      ],
      use: "Lấy VGA từ ổ DVI-I của card đồ hoạ (card xuất analog trên C1–C5) cho màn hình/máy chiếu VGA.",
      standard: "DDWG DVI 1.0 §5.2.1 Bảng 5-1/5-2 (chân analog C1–C5, 6, 7, 8, 14, 15); VESA E-DDC (VGA)",
      vendor: false,
      detail:
        "Thụ động thật sự: DVI-I mang sẵn RGB analog trên C1–C3, HSync trên C4, VSync trên chân 8 và đất analog trên lưỡi C5 — đầu chuyển chỉ đi dây sang vị trí VGA. " +
        "Không dùng chân TMDS nào. Lưỡi C5 nối chung cả ba đường về R/G/B (6, 7, 8); chân 15 (đất +5 V/sync) nối 5 và 10. " +
        "Đầu chuyển có 4 chân C1–C4 nên KHÔNG cắm được vào ổ DVI-D (chỉ có khe ngang) — đó là cố ý: ổ DVI-D không có analog. " +
        "Tự kiểm (adapter, phía VGA là 'cổng nguồn mới'): C1 → 1, C2 → 2, C3 → 3, C4 → 13, 8 → 14; đất → đất; +5 V → +5 V.",
      warnings: [
        "Ổ DVI-D (card đời mới) không có tín hiệu analog — cần bộ chuyển có IC (DAC).",
        "Card DVI-I nhưng tắt xuất analog (một số đời) cũng sẽ không lên hình."
      ]
    },
    {
      id: "hdmi-a-c",
      name: "Cáp Mini HDMI (Type C) ↔ HDMI Type A",
      family: "video",
      kind: "cable",
      a: { pinout: "hdmi-a-pin", gender: "male", label: "HDMI A đực — TV/màn hình (nhận)" },
      b: { pinout: "hdmi-c-pin", gender: "male", label: "Mini HDMI đực — máy ảnh/card (nguồn)" },
      wires: hdmiWires(HDMI_C_ORDER),
      use: "Nối máy ảnh, máy quay, card đồ hoạ nhỏ (Mini HDMI) với TV/màn hình HDMI.",
      standard: "HDMI Specification 1.3a §4.1.10 (gán chân Type A, Type C; cáp Type A–Type C)",
      vendor: false,
      detail:
        "Cáp nối theo TÊN tín hiệu: Data2+ A1 ↔ C2, Data2 Shield A2 ↔ C1, Data2− A3 ↔ C3, … Clock+ A10 ↔ C11, Clock Shield A11 ↔ C10, Clock− A12 ↔ C12, " +
        "CEC A13 ↔ C14, Utility A14 ↔ C17, SCL 15 ↔ 15, SDA 16 ↔ 16, DDC/CEC Ground A17 ↔ C13, +5 V 18 ↔ 18, HPD 19 ↔ 19. " +
        "Tự kiểm: TMDS ra của máy ảnh (C, out) → TMDS vào của TV (A, in); SCL nguồn (out) → TV (in); HPD do TV phát (out) → nguồn (in); +5 V ↔ +5 V; đất ↔ đất.",
      warnings: HDMI_CABLE_WARN
    },
    {
      id: "hdmi-a-d",
      name: "Cáp Micro HDMI (Type D) ↔ HDMI Type A",
      family: "video",
      kind: "cable",
      a: { pinout: "hdmi-a-pin", gender: "male", label: "HDMI A đực — TV/màn hình (nhận)" },
      b: { pinout: "hdmi-d-pin", gender: "male", label: "Micro HDMI đực — Raspberry Pi/máy ảnh (nguồn)" },
      wires: hdmiWires(HDMI_D_ORDER),
      use: "Nối Raspberry Pi 4/5, máy ảnh, điện thoại có Micro HDMI với TV/màn hình HDMI.",
      standard: "HDMI Specification 1.4b §4.1 (gán chân Type A, Type D; cáp Type A–Type D)",
      vendor: false,
      detail:
        "Không chân nào trùng số: HPD A19 ↔ D1, Utility A14 ↔ D2, Data2+ A1 ↔ D3, Data2 Shield A2 ↔ D4, Data2− A3 ↔ D5 … Clock− A12 ↔ D14, " +
        "CEC A13 ↔ D15, DDC/CEC Ground A17 ↔ D16, SCL A15 ↔ D17, SDA A16 ↔ D18, +5 V A18 ↔ D19. " +
        "Tự kiểm: TMDS ra (D) → TMDS vào (A); HPD TV (out) → nguồn (in); +5 V ↔ +5 V; đất ↔ đất.",
      warnings: HDMI_CABLE_WARN.concat(["Ổ Micro HDMI rất yếu cơ khí — đừng để cáp nặng treo trên ổ."])
    },
    {
      id: "dp-dp",
      name: "Cáp DisplayPort ↔ DisplayPort (chuẩn VESA)",
      family: "video",
      kind: "cable",
      a: { pinout: "dp-source", gender: "male", label: "Đầu cắm vào card/laptop (nguồn)" },
      b: { pinout: "dp-sink", gender: "male", label: "Đầu cắm vào màn hình (nhận)" },
      wires: dpDpWires,
      use: "Nối card đồ hoạ/laptop (DP) với màn hình DP; cáp đối xứng, đầu nào cắm phía nào cũng được.",
      standard: "VESA DisplayPort Standard 1.2 Hình 4-23 (cáp chuẩn; CONFIG1/2 chân 13, 14 được nối; không nối DP_PWR). DP 1.1a Hình 4-14 KHÔNG nối chân 13/14",
      vendor: false,
      detail:
        "Khối Main Link (chân 1–12) đi dây GƯƠNG: 1↔12, 2↔11, 3↔10, 4↔9, 5↔8, 6↔7 và ngược lại. Vì phía nhận đã đảo lane và cực, " +
        "kết quả là Lane 0 (+) nguồn chân 1 → Lane 0 (+) màn hình chân 12, Lane 0 (−) 3 → 10, Lane 1 (+) 4 → 9, Lane 3 (−) 12 → 1 … — đúng lane, đúng cực. " +
        "Chân 13–19 nối thẳng (CONFIG1/2, AUX ±, GND 16, HPD, RETURN); lưu ý chân 13/14 chỉ được nối theo DP 1.2 Hình 4-23, còn DP 1.1a Hình 4-14 không nối. Chân 20 DP_PWR KHÔNG nối: hai thiết bị đều cấp 3,3 V ±10 %, nối lại sẽ đẩy dòng vào nhau " +
        "(lỗi 'pin 20' của cáp không chứng nhận — máy không khởi động hoặc màn hình không ngủ được). " +
        "Vì cáp đối xứng nên đổi đầu vẫn đúng: nhìn từ nguồn, mọi cáp DP thụ động đều là 'nguồn ↔ nhận'. " +
        "Tự kiểm: Main Link ra (nguồn) → vào (màn hình) cùng tên lane/cực; HPD màn hình (out) → nguồn (in); AUX io ↔ io; đất ↔ đất; DP_PWR bỏ trống.",
      warnings: [
        "Không nối chân 20 (DP_PWR) xuyên cáp.",
        "Không đi dây DP 1–1 theo số chân giữa dp-source và dp-sink nếu tự định nghĩa lại tên — chỉ đúng khi một đầu là bảng chân phía nguồn, đầu kia phía nhận như ở đây.",
        "Cặp Main Link cần trở kháng vi sai 100 Ω, chiều dài khớp; HBR2/HBR3/UHBR không thể đạt với dây hàn tay — nên mua cáp chứng nhận (DP8K, DP40/DP80)."
      ]
    },
    {
      id: "mini-dp-dp",
      name: "Cáp Mini DisplayPort (nguồn) → DisplayPort (màn hình)",
      family: "video",
      kind: "cable",
      a: { pinout: "mini-dp-source", gender: "male", label: "Mini DP đực — laptop/card (nguồn)" },
      b: { pinout: "dp-sink", gender: "male", label: "DP đực — màn hình (nhận)" },
      wires: mdpDpWires,
      use: "Nối laptop/card có Mini DP với màn hình DP full-size.",
      standard: "VESA DisplayPort Standard 1.2 §4 (Hình 4-34, 4-35; Bảng 4-10, 4-11)",
      vendor: false,
      detail:
        "Đi dây theo TÊN tín hiệu: Lane 0 (+) mDP 3 → DP 12, Lane 0 (−) 5 → 10, Lane 1 (+) 9 → 9, Lane 1 (−) 11 → 7, Lane 2 (+) 15 → 6, Lane 2 (−) 17 → 4, " +
        "Lane 3 (+) 10 → 3, Lane 3 (−) 12 → 1; CONFIG1 4 → 13, CONFIG2 6 → 14; AUX (+) 16 → 15, AUX (−) 18 → 17; HPD 2 → 18; GND 19 → RETURN 19. " +
        "DP_PWR (20 ↔ 20) KHÔNG nối. " +
        "Ghép GND theo DP 1.2 Hình 4-34/4-35: mDP 1↔DP 11, 7↔8, 8↔2, 13↔5, 14↔16, 19↔19. " +
        "Cáp thụ động dùng được hai chiều (Hình 4-34 và 4-35 cùng tập cặp dây, chỉ khác nhãn nguồn/nhận; DP 1.2 Bảng 4-11): nhãn 'nguồn/nhận' ở đây chỉ là quy ước đọc dir.",
      warnings: [
        "Không nối DP_PWR xuyên cáp.",
        "Đầu Mini DP cắm vào ổ Thunderbolt 1/2 vẫn chạy (Thunderbolt mang DP); ổ Mini DP thuần KHÔNG chạy thiết bị Thunderbolt."
      ]
    }
  ];

  window.CONN_BODIES = Object.assign(window.CONN_BODIES || {}, bodies);
  // v3 (luật 6): đường hình một chiều nguồn → nhận, không có nút loopback thụ động.
  var VID_TEST_SRC = "Cách thử phía nguồn: cắm màn hình biết chắc tốt, hoặc bộ giả EDID (EDID emulator/dummy plug) để card nhận là có màn hình; máy test cáp kiểm thông mạch. ";
  var VID_TEST_SINK = "Cách thử phía nhận: cấp hình từ một nguồn biết chắc tốt (laptop, máy phát mẫu hình/pattern generator) và xem màn hình báo 'không có tín hiệu' hay hiện hình. ";
  var VIDEO_NOLOOP = {
    "vga-de15":
      "VGA là analog một chiều: R/G/B và HSync/VSync chỉ đi từ card ra màn hình, không có đường thu để vòng về; DDC (I²C) do card làm chủ, cần EEPROM EDID ở đầu kia. " +
      "Nút 'dummy plug' VGA (điện trở 75 Ω trên R/G/B xuống đất) chỉ làm card tưởng có màn hình — là tải, không phải loopback. " + VID_TEST_SRC,
    "vga-de15-sink":
      "Phía màn hình VGA chỉ nhận R/G/B và đồng bộ, không phát gì ngược lại ngoài EDID trả lời qua DDC — không có cặp phát để vòng về thu. " + VID_TEST_SINK,
    "dvi-i":
      "TMDS (và analog C1–C5) chỉ đi một chiều nguồn → màn hình; chiều về duy nhất là DDC và Hot Plug Detect (mức tĩnh). Nối TMDS ra về đâu cũng không có bộ thu trên cùng cổng. " +
      VID_TEST_SRC,
    "hdmi-a-pin":
      "TMDS/FRL HDMI chỉ đi một chiều nguồn → màn hình; DDC, CEC, HPD là kênh điều khiển chậm, không phải đường thu. Cùng một ổ HDMI hoặc là nguồn hoặc là nhận — không vòng về chính nó được. " +
      VID_TEST_SRC + VID_TEST_SINK,
    "hdmi-c-pin":
      "Như HDMI Type A (cùng tín hiệu, khác chân): đường hình một chiều, không có bộ thu trên cổng phát. " + VID_TEST_SRC,
    "hdmi-d-pin":
      "Như HDMI Type A (cùng tín hiệu, khác chân): đường hình một chiều, không có bộ thu trên cổng phát. " + VID_TEST_SRC,
    "dp-source":
      "Main Link DisplayPort chỉ đi nguồn → nhận; AUX là kênh hai chiều bán song công do nguồn làm chủ (link training đọc DPCD của bộ nhận). " +
      "Vòng Main Link về chính nguồn thì không có DPCD/bộ nhận để huấn luyện link. " + VID_TEST_SRC,
    "dp-sink":
      "Phía nhận DisplayPort chỉ thu Main Link và trả lời AUX — không có đường phát để vòng về. " + VID_TEST_SINK,
    "mini-dp-source":
      "Như DisplayPort phía nguồn (cùng tín hiệu, đầu nhỏ): Main Link một chiều, AUX do nguồn làm chủ — không loop thụ động được. " + VID_TEST_SRC
  };
  Object.keys(VIDEO_NOLOOP).forEach(function (k) { if (pinouts[k]) pinouts[k].noLoop = VIDEO_NOLOOP[k]; });

  window.CONN_PINOUTS = Object.assign(window.CONN_PINOUTS || {}, pinouts);
  window.CONN_CABLES = (window.CONN_CABLES || []).concat(cables);
})();
