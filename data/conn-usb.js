// Mảng Đấu nối — USB: thân đầu nối (Standard-A/B, Mini-B, Micro-B, 3.x, Type-C), sơ đồ chân, cáp/đầu chuyển thụ động.
// Nguồn: USB 2.0 Specification §6 (Table 6-1, hình đầu nối Standard-A/B); USB 2.0 ECN "Mini-B connector";
// Universal Serial Bus Micro-USB Cables and Connectors Specification Rev 1.01; USB 3.1 Legacy Cable and Connector Specification Rev 1.0 (Std-A/Std-B/Micro-B 3.x §5.3, cáp §5.5);
// USB Type-C Cable and Connector Specification Release 2.0 (Fig 2-1, Table 3-4/3-5 gán chân, §3.4–3.6 cáp/đầu chuyển, Table 4-24/4-25 Rp/Rd).
// Schema: .claude/skills/connector-pinout-spec/references/connector-schema.md
// Quy ước hướng nhìn: mọi face vẽ RECEPTACLE (ổ cắm trên thiết bị, giới tính "female") nhìn thẳng vào miệng ổ.
// Plug (đầu cáp, "male") nhìn vào mặt cắm = ảnh gương ngang của hình này.
(function () {
  var SHELL_NOTE = "Vỏ kim loại (shield). Trong cáp nối với lưới chống nhiễu; không phải dây GND tín hiệu.";

  // ---------------------------------------------------------------- Body
  var bodies = {
    "usb-a": {
      id: "usb-a",
      name: "USB Standard-A (USB 2.0)",
      aka: ["USB-A", "USB Type-A", "USB A", "cổng USB máy tính"],
      family: "usb",
      standard: "USB 2.0 Specification §6.5.3 (Fig 6-7 receptacle Standard-A; plug Fig 6-9, §6.5.4)",
      summary: "Ổ chữ nhật dẹt 4 chân trên phía host (máy tính, hub, cốc sạc); plug A ở đầu cáp đi về host.",
      detail:
        "Miệng ổ khoảng 12 × 4,5 mm, bên trong có một lưỡi nhựa (tongue) mang 4 lá tiếp xúc. Chỉ cắm được một chiều. " +
        "Chân 1 (VBUS) và 4 (GND) dài hơn chân 2, 3 để nguồn/đất tiếp xúc trước dữ liệu khi cắm nóng. " +
        "Standard-A luôn là phía upstream của cáp (đi về host/DFP) — vì vậy không có cáp A–A nối VBUS/D± (USB 2.0); USB 3.x chỉ định nghĩa một cáp A–A dùng gỡ lỗi, trong đó VBUS, D+, D− KHÔNG nối, chỉ GND/drain và hai cặp SuperSpeed bắt chéo (5↔8, 6↔9) (USB 3.1 Legacy Cable and Connector Spec Rev 1.0 §5.5.2, Table 5-9). " +
        "Lưỡi nhựa thường màu trắng/đen cho USB 2.0; xanh dương (Pantone 300C) thường đánh dấu ổ USB 3.x (thói quen, không bắt buộc với 2.0).",
      genders: {
        male: { name: "Plug A (đầu cáp)", note: "Đầu cáp cắm vào host; phần nhựa mang tiếp xúc nằm ở nửa dưới vỏ khi chân lộ lên trên." },
        female: { name: "Receptacle A (ổ trên host)", note: "Ổ trên máy tính/hub/cốc sạc; lưỡi nhựa mang tiếp xúc ở mặt dưới lưỡi." }
      },
      face: {
        outline: "usb-a",
        w: 120, h: 50,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle A, lưỡi nhựa ở NỬA TRÊN (tiếp xúc ở mặt dưới lưỡi, hướng xuống khoảng trống). " +
          "Từ TRÁI sang PHẢI: 1 (VBUS) – 2 (D−) – 3 (D+) – 4 (GND) → VBUS ở bên TRÁI (USB 2.0 Fig 6-7, §6.5.3). " +
          "Plug nhìn vào mặt cắm (khối nhựa ở dưới, lá tiếp xúc lộ lên trên) là ảnh gương: 4 – 3 – 2 – 1 từ trái sang phải (Fig 6-9, §6.5.4).",
        pins: [
          { pin: "1", x: 30, y: 20 },
          { pin: "2", x: 50, y: 20 },
          { pin: "3", x: 70, y: 20 },
          { pin: "4", x: 90, y: 20 },
          { pin: "S", x: 5, y: 25 }
        ],
        keys: [{ x: 14, y: 8, w: 92, h: 16, label: "lưỡi nhựa (tongue)" }]
      },
      pinCount: 5
    },

    "usb-a-ss": {
      id: "usb-a-ss",
      name: "USB 3.x Standard-A (SuperSpeed)",
      aka: ["USB 3.0 A", "USB 3.1 A", "USB 3.2 A", "USB-A xanh", "SS Standard-A"],
      family: "usb",
      standard: "USB 3.1 Legacy Cable and Connector Specification Rev 1.0 §5.3.1.3 (Table 5-2, Fig 5-1 Standard-A)",
      summary: "Cùng vỏ với USB-A 2.0 nhưng thêm hàng 5 chân SuperSpeed nằm sâu trong lưỡi; cắm lẫn được với 2.0.",
      detail:
        "Kích thước miệng giống Standard-A 2.0 nên plug/receptacle 2.0 và 3.x cắm lẫn nhau, khi đó chỉ chạy USB 2.0. " +
        "Thêm 5 chân: 2 cặp vi sai SuperSpeed (SSTX±, SSRX±) và GND_DRAIN (đất cho dây drain của hai cặp có bọc). " +
        "Lưỡi nhựa thường màu xanh dương (Pantone 300C) — USB 3.x khuyến nghị đánh dấu, không phải điều kiện điện. " +
        "Tên chân có tiền tố StdA_: SSRX là bộ THU của chính cổng A (host), SSTX là bộ PHÁT.",
      genders: {
        male: { name: "Plug A SuperSpeed (đầu cáp)", note: "Có thêm hàng tiếp xúc SS ở mép trước phần nhựa." },
        female: { name: "Receptacle A SuperSpeed (ổ trên host)", note: "Hàng chân SS là lá đàn hồi nằm sâu hơn hàng 1–4." }
      },
      face: {
        outline: "usb-a",
        w: 120, h: 50,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, lưỡi nhựa ở nửa trên. Hàng SuperSpeed ở TRÊN, sát lưỡi nhựa: 9 – 8 – 7 – 6 – 5 từ trái sang phải. " +
          "Hàng USB 2.0 ở DƯỚI: 1 – 2 – 3 – 4 từ trái sang phải (VBUS bên trái). Như vậy chân 9 cùng phía chân 1, chân 5 cùng phía chân 4 " +
          "(USB 3.1 Legacy Cable and Connector Spec Rev 1.0, Fig 5-1 Detail Y). Plug nhìn vào mặt cắm là ảnh gương ngang.",
        pins: [
          { pin: "9", x: 24, y: 14 },
          { pin: "8", x: 42, y: 14 },
          { pin: "7", x: 60, y: 14 },
          { pin: "6", x: 78, y: 14 },
          { pin: "5", x: 96, y: 14 },
          { pin: "1", x: 30, y: 26 },
          { pin: "2", x: 50, y: 26 },
          { pin: "3", x: 70, y: 26 },
          { pin: "4", x: 90, y: 26 },
          { pin: "S", x: 5, y: 25 }
        ],
        keys: [{ x: 14, y: 6, w: 92, h: 26, label: "lưỡi nhựa xanh (tongue)" }]
      },
      pinCount: 10
    },

    "usb-b": {
      id: "usb-b",
      name: "USB Standard-B (USB 2.0)",
      aka: ["USB-B", "USB Type-B", "cổng USB máy in"],
      family: "usb",
      standard: "USB 2.0 Specification §6.5.3 (Fig 6-8 receptacle Standard-B)",
      summary: "Ổ gần vuông, hai góc trên vát, 4 chân — phía device (máy in, máy quét, hộp USB) dùng cho cáp A–B.",
      detail:
        "Miệng ổ khoảng 8,45 × 7,78 mm, hai góc vát ở trên giúp cắm đúng chiều. Lõi nhựa ở giữa mang 4 tiếp xúc: 2 ở mặt trên, 2 ở mặt dưới. " +
        "Standard-B luôn là phía downstream (device/UFP). Chân 1 và 4 dài hơn để nguồn/đất tiếp xúc trước.",
      genders: {
        male: { name: "Plug B (đầu cáp)", note: "Đầu cáp cắm vào device." },
        female: { name: "Receptacle B (ổ trên device)", note: "Ổ trên máy in, thiết bị ngoại vi." }
      },
      face: {
        outline: "usb-b",
        w: 80, h: 80,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle B, cạnh có hai góc vát ở TRÊN. Mặt trên lõi nhựa: 2 (trái) – 1 (phải); " +
          "mặt dưới: 3 (trái) – 4 (phải). Như vậy VBUS (1) nằm ngay trên GND (4) ở bên PHẢI; D− (2) trên D+ (3) ở bên trái. " +
          "Plug nhìn vào mặt cắm (gương): trên 1 – 2, dưới 4 – 3 (USB 2.0 Fig 6-8, §6.5.3).",
        pins: [
          { pin: "2", x: 30, y: 28 },
          { pin: "1", x: 50, y: 28 },
          { pin: "3", x: 30, y: 52 },
          { pin: "4", x: 50, y: 52 },
          { pin: "S", x: 5, y: 40 }
        ],
        keys: [{ x: 22, y: 32, w: 36, h: 16, label: "lõi nhựa" }]
      },
      pinCount: 5
    },

    "usb-b-ss": {
      id: "usb-b-ss",
      name: "USB 3.x Standard-B (SuperSpeed)",
      aka: ["USB 3.0 B", "USB 3.0 Type-B", "cổng USB 3.0 ổ cứng để bàn"],
      family: "usb",
      standard: "USB 3.1 Legacy Cable and Connector Specification Rev 1.0 §5.3.2.2 (Table 5-3, Fig 5-9 Standard-B)",
      summary: "Standard-B có thêm 'bướu' phía trên chứa 5 chân SuperSpeed; receptacle 3.x nhận được plug B 2.0, ngược lại thì không.",
      detail:
        "Phần dưới giống hệt Standard-B 2.0 (chân 1–4). Phần bướu nhô lên trên mang lõi nhựa thứ hai với 5 chân: StdB_SSTX±, GND_DRAIN, StdB_SSRX±. " +
        "Plug B 2.0 cắm vừa receptacle B 3.x (chạy 2.0); plug B 3.x KHÔNG cắm được vào receptacle B 2.0 vì bướu. " +
        "Tên chân tiền tố StdB_: SSTX là bộ PHÁT của chính device.",
      genders: {
        male: { name: "Plug B SuperSpeed (đầu cáp)", note: "Có bướu ở trên." },
        female: { name: "Receptacle B SuperSpeed (ổ trên device)", note: "Ổ có hốc bướu ở trên." }
      },
      face: {
        outline: "usb-b-ss",
        w: 80, h: 100,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, bướu SuperSpeed ở TRÊN. Hàng bướu: 5 – 6 – 7 – 8 – 9 từ trái sang phải. " +
          "Phần dưới như Standard-B 2.0: trên 2 – 1, dưới 3 – 4 (VBUS bên phải) " +
          "(USB 3.1 Legacy Cable and Connector Spec Rev 1.0, Fig 5-9). Plug nhìn vào mặt cắm là ảnh gương ngang.",
        pins: [
          { pin: "5", x: 20, y: 16 },
          { pin: "6", x: 30, y: 16 },
          { pin: "7", x: 40, y: 16 },
          { pin: "8", x: 50, y: 16 },
          { pin: "9", x: 60, y: 16 },
          { pin: "2", x: 30, y: 52 },
          { pin: "1", x: 50, y: 52 },
          { pin: "3", x: 30, y: 76 },
          { pin: "4", x: 50, y: 76 },
          { pin: "S", x: 5, y: 64 }
        ],
        keys: [
          { x: 14, y: 10, w: 52, h: 12, label: "lõi nhựa SS (bướu)" },
          { x: 22, y: 56, w: 36, h: 16, label: "lõi nhựa USB 2.0" }
        ]
      },
      pinCount: 10
    },

    "usb-mini-b": {
      id: "usb-mini-b",
      name: "USB Mini-B (5 chân)",
      aka: ["Mini USB", "mini-USB", "USB Mini-B 5 pin"],
      family: "usb",
      standard: "USB 2.0 ECN \"Mini-B connector\" (Fig 6-11 receptacle, Fig 6-15 plug; Table 6-1 sửa đổi)",
      summary: "Ổ hình thang nhỏ 5 chân (có chân ID) trên máy ảnh, ổ cứng di động, GPS đời cũ.",
      detail:
        "Miệng ổ khoảng 7 × 3 mm, hai cạnh bên có nấc. Thêm chân 4 = ID (nhận dạng OTG) so với Standard-B. " +
        "Mini-A và Mini-AB đã bị USB-IF bãi bỏ (2007), thay bằng Micro-USB; Mini-B vẫn gặp nhiều trên thiết bị công nghiệp, máy đo.",
      genders: {
        male: { name: "Plug Mini-B (đầu cáp)", note: "" },
        female: { name: "Receptacle Mini-B (ổ trên device)", note: "" }
      },
      face: {
        outline: "usb-mini-b",
        w: 100, h: 40,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, cạnh RỘNG của hình thang ở TRÊN. Từ trái sang phải: 1 (VBUS) – 2 (D−) – 3 (D+) – 4 (ID) – 5 (GND) " +
          "(ECN Mini-B, Fig 6-11). Plug nhìn vào mặt cắm (gương, cạnh rộng ở trên): 5 – 4 – 3 – 2 – 1 (Fig 6-15).",
        pins: [
          { pin: "1", x: 26, y: 18 },
          { pin: "2", x: 38, y: 18 },
          { pin: "3", x: 50, y: 18 },
          { pin: "4", x: 62, y: 18 },
          { pin: "5", x: 74, y: 18 },
          { pin: "S", x: 4, y: 20 }
        ],
        keys: [{ x: 20, y: 12, w: 60, h: 10, label: "lưỡi tiếp xúc" }]
      },
      pinCount: 6
    },

    "usb-micro-b": {
      id: "usb-micro-b",
      name: "USB Micro-B (5 chân)",
      aka: ["Micro USB", "micro-USB", "cổng sạc điện thoại Android đời cũ"],
      family: "usb",
      standard: "Universal Serial Bus Micro-USB Cables and Connectors Specification Rev 1.01",
      summary: "Ổ hình thang dẹt 5 chân (cao ~1,8 mm) — cổng sạc/dữ liệu điện thoại trước USB-C.",
      detail:
        "Miệng ổ khoảng 6,85 × 1,8 mm, hình thang (hai góc vát ở cạnh hẹp). Plug có hai lẫy móc giữ ở mặt trên, độ bền thiết kế 10 000 lần cắm. " +
        "Chân 4 = ID: plug Micro-B để hở (hoặc > 1 MΩ xuống GND), plug Micro-A nối ID xuống GND để báo 'tôi là host' (OTG). " +
        "Ổ Micro-AB (nhận cả plug Micro-A và Micro-B) vẫn là yêu cầu của OTG & EH 2.0 v1.1a §3.1.1 cho thiết bị OTG, nhưng thực tế điện thoại dùng ổ Micro-B + đầu OTG; " +
        "đầu chuyển hợp chuẩn là plug Micro-A → ổ Standard-A (Micro-USB 1.01 Fig 4-19).",
      genders: {
        male: { name: "Plug Micro-B (đầu cáp)", note: "Hai lẫy móc ở mặt cạnh rộng." },
        female: { name: "Receptacle Micro-B (ổ trên device)", note: "" }
      },
      face: {
        outline: "usb-micro-b",
        w: 100, h: 40,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, cạnh RỘNG của hình thang ở TRÊN (góc vát ở dưới). Từ trái sang phải: 1 (VBUS) – 2 (D−) – 3 (D+) – 4 (ID) – 5 (GND) " +
          "(Micro-USB 1.01, Fig 4-12). Plug nhìn vào mặt cắm (gương, cạnh rộng ở trên): 5 – 4 – 3 – 2 – 1 (Fig 4-7).",
        pins: [
          { pin: "1", x: 30, y: 16 },
          { pin: "2", x: 40, y: 16 },
          { pin: "3", x: 50, y: 16 },
          { pin: "4", x: 60, y: 16 },
          { pin: "5", x: 70, y: 16 },
          { pin: "S", x: 4, y: 20 }
        ],
        keys: [{ x: 24, y: 12, w: 52, h: 8, label: "lưỡi tiếp xúc" }]
      },
      pinCount: 6
    },

    "usb-micro-b-ss": {
      id: "usb-micro-b-ss",
      name: "USB 3.x Micro-B (10 chân)",
      aka: ["Micro USB 3.0", "Micro-B SuperSpeed", "cổng ổ cứng di động USB 3.0"],
      family: "usb",
      standard: "USB 3.1 Legacy Cable and Connector Specification Rev 1.0 §5.3.3.2 (Table 5-4, Fig 5-12 Micro-B)",
      summary: "Micro-B 2.0 ghép thêm một khối 5 chân SuperSpeed bên cạnh — ổ cứng di động, Galaxy S5/Note 3.",
      detail:
        "Gồm hai khối liền nhau: khối USB 2.0 (chân 1–5, giống hệt Micro-B) và khối SuperSpeed (chân 6–10: MicB_SSTX±, GND_DRAIN, MicB_SSRX±). " +
        "Plug Micro-B 2.0 cắm được vào khối 2.0 của receptacle 3.x (chạy 2.0). Plug Micro-B 3.x không vào ổ Micro-B 2.0.",
      genders: {
        male: { name: "Plug Micro-B SuperSpeed (đầu cáp)", note: "" },
        female: { name: "Receptacle Micro-B SuperSpeed (ổ trên device)", note: "" }
      },
      face: {
        outline: "usb-micro-b-ss",
        w: 160, h: 40,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle, cạnh rộng ở TRÊN. Khối USB 2.0 bên TRÁI: 1 – 2 – 3 – 4 – 5 (VBUS ngoài cùng bên trái); " +
          "khối SuperSpeed bên PHẢI: 6 – 7 – 8 – 9 – 10 — số liên tục 1 → 10 từ trái sang phải " +
          "(USB 3.1 Legacy Cable and Connector Spec Rev 1.0, Fig 5-12). Plug nhìn vào mặt cắm (gương): 10…6 | 5…1 (Fig 5-14).",
        pins: [
          { pin: "1", x: 20, y: 16 },
          { pin: "2", x: 30, y: 16 },
          { pin: "3", x: 40, y: 16 },
          { pin: "4", x: 50, y: 16 },
          { pin: "5", x: 60, y: 16 },
          { pin: "6", x: 90, y: 16 },
          { pin: "7", x: 100, y: 16 },
          { pin: "8", x: 110, y: 16 },
          { pin: "9", x: 120, y: 16 },
          { pin: "10", x: 130, y: 16 },
          { pin: "S", x: 154, y: 20 }
        ],
        keys: [
          { x: 14, y: 12, w: 52, h: 8, label: "khối USB 2.0" },
          { x: 84, y: 12, w: 52, h: 8, label: "khối SuperSpeed" }
        ]
      },
      pinCount: 11
    },

    "usb-c": {
      id: "usb-c",
      name: "USB Type-C (receptacle 24 chân)",
      aka: ["USB-C", "Type-C", "USB C"],
      family: "usb",
      standard: "USB Type-C Cable and Connector Specification Release 2.0, Fig 2-1 (mặt receptacle), Table 3-4 (gán chân receptacle đầy đủ), Table 3-5 (receptacle USB 2.0)",
      summary: "Đầu nối đối xứng, cắm ngửa sấp đều được: 2 hàng × 12 chân, dùng cho USB 2.0/3.x/USB4, PD, Alt Mode.",
      detail:
        "Miệng ổ hình chữ nhật bo tròn ~8,34 × 2,56 mm, lưỡi giữa mang 12 tiếp xúc mỗi mặt. " +
        "Receptacle đầy đủ 24 chân; receptacle chỉ USB 2.0 (thiết bị sạc, chuột…) thường chỉ hàn 16 chân (bỏ 8 chân SuperSpeed TX/RX) — " +
        "vẫn đúng chuẩn, footprint '16 pin USB-C'. Có loại 6 chân (chỉ VBUS, GND, CC1, CC2) chỉ để sạc. " +
        "Plug KHÔNG có đủ 24 chân như receptacle: plug USB 2.0 chỉ có một cặp D+/D− (A6/A7) và chân B5 là VCONN; " +
        "receptacle có D+/D− ở cả A6/A7 lẫn B6/B7 và hai chân CC1/CC2 để nhận plug ở cả hai chiều.",
      genders: {
        male: { name: "Plug C (đầu cáp)", note: "Vỏ ngoài là ống kim loại; tiếp xúc ở hai mặt trong của khe." },
        female: { name: "Receptacle C (ổ trên thiết bị)", note: "Lưỡi giữa mang tiếp xúc hai mặt." }
      },
      face: {
        outline: "usb-c",
        w: 260, h: 60,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào receptacle (lưỡi nằm ngang): hàng TRÊN A1 → A12 từ trái sang phải, hàng DƯỚI B12 → B1 từ trái sang phải " +
          "(A1 đối diện B12, A12 đối diện B1). Xoay 180° thì hàng A thành hàng B — đó là lý do plug cắm hai chiều được. " +
          "Plug nhìn vào mặt cắm: ảnh gương của hình này.",
        pins: [
          { pin: "A1", x: 20, y: 22 }, { pin: "A2", x: 40, y: 22 }, { pin: "A3", x: 60, y: 22 },
          { pin: "A4", x: 80, y: 22 }, { pin: "A5", x: 100, y: 22 }, { pin: "A6", x: 120, y: 22 },
          { pin: "A7", x: 140, y: 22 }, { pin: "A8", x: 160, y: 22 }, { pin: "A9", x: 180, y: 22 },
          { pin: "A10", x: 200, y: 22 }, { pin: "A11", x: 220, y: 22 }, { pin: "A12", x: 240, y: 22 },
          { pin: "B12", x: 20, y: 38 }, { pin: "B11", x: 40, y: 38 }, { pin: "B10", x: 60, y: 38 },
          { pin: "B9", x: 80, y: 38 }, { pin: "B8", x: 100, y: 38 }, { pin: "B7", x: 120, y: 38 },
          { pin: "B6", x: 140, y: 38 }, { pin: "B5", x: 160, y: 38 }, { pin: "B4", x: 180, y: 38 },
          { pin: "B3", x: 200, y: 38 }, { pin: "B2", x: 220, y: 38 }, { pin: "B1", x: 240, y: 38 },
          { pin: "S", x: 4, y: 30 }
        ],
        keys: [{ x: 12, y: 26, w: 236, h: 8, label: "lưỡi giữa (tongue)" }]
      },
      pinCount: 25
    }
  };

  // ---------------------------------------------------------------- Pinout
  var COLOR_NOTE = " (màu theo cột 'Typical Wiring Assignment' của USB 2.0 Table 6-1 — thông dụng, không bắt buộc)";
  function vbus(pin, role) {
    return { pin: pin, signal: "VBUS", name: "Nguồn bus +5 V", dir: "pwr", color: "đỏ",
      desc: (role === "host" ? "Host CẤP +5 V (USB 2.0: tối thiểu 4,75 V tại cổng; 500 mA, USB 3.x 900 mA)." :
        "Device NHẬN +5 V từ host (bus-powered) hoặc chỉ dùng để phát hiện đã cắm (self-powered).") + COLOR_NOTE };
  }
  function dm(pin) { return { pin: pin, signal: "D−", name: "Data −", dir: "io", color: "trắng", pair: "D",
    desc: "Nửa âm của cặp vi sai USB 2.0 (Low/Full/High-speed), bán song công — cùng một cặp dây thu và phát luân phiên." + COLOR_NOTE }; }
  function dp(pin) { return { pin: pin, signal: "D+", name: "Data +", dir: "io", color: "xanh lá", pair: "D",
    desc: "Nửa dương của cặp vi sai USB 2.0. Device Full/High-speed kéo D+ lên 3,3 V qua 1,5 kΩ để báo có mặt (Low-speed kéo D−)." + COLOR_NOTE }; }
  function gnd(pin) { return { pin: pin, signal: "GND", name: "Đất", dir: "gnd", color: "đen",
    desc: "Đất nguồn và đất tham chiếu tín hiệu." + COLOR_NOTE }; }
  function shell() { return { pin: "S", signal: "Shield", name: "Vỏ / lưới chống nhiễu", dir: "shield", desc: SHELL_NOTE }; }
  var SS_COLOR = " (chuẩn không quy định màu dây SuperSpeed — Legacy Table 5-6 chỉ đánh số cặp P1±, P2± và drain; màu do hãng cáp chọn)";

  var pinouts = {
    "usb2-a": {
      id: "usb2-a",
      body: "usb-a",
      name: "USB 2.0 Standard-A (cổng host)",
      family: "usb",
      standard: "USB 2.0 Specification §6.5.2 Table 6-1 (USB Connector Termination Assignment)",
      role: "host",
      gender: "female",
      summary: "4 chân: VBUS, D−, D+, GND. Receptacle A nằm trên host; host cấp nguồn VBUS.",
      detail:
        "Tốc độ: Low-speed 1,5 Mbit/s, Full-speed 12 Mbit/s, High-speed 480 Mbit/s trên cùng cặp D+/D− (trở kháng vi sai 90 Ω). " +
        "Cáp USB 2.0 dài tối đa ~5 m cho High/Full-speed. Cốc sạc 'dedicated charger' (BC 1.2) chập D+ với D− (≤ 200 Ω) để điện thoại biết được kéo dòng lớn. " +
        "Không chế bằng dây được sang RS-232/RS-485/TTL UART: cần IC chuyển đổi (FT232, CH340, CP2102…).",
      pins: [vbus("1", "host"), dm("2"), dp("3"), gnd("4"), shell()],
      groups: [
        { name: "Nguồn", pins: ["1"] },
        { name: "Dữ liệu USB 2.0", pins: ["2", "3"] },
        { name: "Đất / vỏ", pins: ["4", "S"] }
      ]
    },

    "usb3-a": {
      id: "usb3-a",
      body: "usb-a-ss",
      name: "USB 3.x Standard-A (cổng host SuperSpeed)",
      family: "usb",
      standard: "USB 3.1 Legacy Cable and Connector Specification Rev 1.0 §5.3.1.3 Table 5-2 (gán chân Standard-A)",
      role: "host",
      gender: "female",
      summary: "Chân 1–4 như USB 2.0; chân 5–9: StdA_SSRX−/+, GND_DRAIN, StdA_SSTX−/+.",
      detail:
        "SuperSpeed chạy song công trên hai cặp riêng (5 Gbit/s Gen 1, 10 Gbit/s Gen 2) song song với cặp USB 2.0 — " +
        "một cổng 3.x thực chất là hai bus (2.0 và SuperSpeed) chung đầu nối. TX/RX gọi theo chính cổng này: " +
        "StdA_SSTX là host phát, đi tới StdB_SSRX/MicB_SSRX của device. Ghép AC: tụ nối tiếp (75–265 nF) đặt ở phía PHÁT trên bo mạch, không ở trong cáp.",
      pins: [
        vbus("1", "host"), dm("2"), dp("3"),
        { pin: "4", signal: "GND", name: "Đất nguồn (GND_PWRrt)", dir: "gnd", color: "đen", desc: "Đất trả về của nguồn và USB 2.0." + COLOR_NOTE },
        { pin: "5", signal: "StdA_SSRX−", name: "SuperSpeed Receive −", dir: "in", pair: "SSRX", desc: "Cặp thu SuperSpeed của host (nhận từ SSTX của device)." + SS_COLOR },
        { pin: "6", signal: "StdA_SSRX+", name: "SuperSpeed Receive +", dir: "in", pair: "SSRX", desc: "Nửa dương cặp thu SuperSpeed của host." + SS_COLOR },
        { pin: "7", signal: "GND_DRAIN", name: "Đất drain tín hiệu", dir: "gnd", desc: "Nối dây drain của hai cặp SDP có bọc; đất tham chiếu cho tín hiệu SuperSpeed." },
        { pin: "8", signal: "StdA_SSTX−", name: "SuperSpeed Transmit −", dir: "out", pair: "SSTX", desc: "Cặp phát SuperSpeed của host (tới SSRX của device)." + SS_COLOR },
        { pin: "9", signal: "StdA_SSTX+", name: "SuperSpeed Transmit +", dir: "out", pair: "SSTX", desc: "Nửa dương cặp phát SuperSpeed của host." + SS_COLOR },
        shell()
      ],
      groups: [
        { name: "Nguồn", pins: ["1"] },
        { name: "Dữ liệu USB 2.0", pins: ["2", "3"] },
        { name: "SuperSpeed", pins: ["5", "6", "8", "9"] },
        { name: "Đất / vỏ", pins: ["4", "7", "S"] }
      ]
    },

    "usb2-b": {
      id: "usb2-b",
      body: "usb-b",
      name: "USB 2.0 Standard-B (cổng device)",
      family: "usb",
      standard: "USB 2.0 Specification §6.5.2 Table 6-1 (USB Connector Termination Assignment)",
      role: "device",
      gender: "female",
      summary: "Cùng 4 tín hiệu như Standard-A, nằm trên device; device nhận VBUS.",
      detail:
        "Số chân giống Standard-A (1 VBUS, 2 D−, 3 D+, 4 GND) nên cáp A–B nối thẳng 1–1. " +
        "Thiết bị tự cấp nguồn (self-powered) không được đẩy dòng ngược lên VBUS và không được kéo D+/D− lên khi VBUS không có.",
      pins: [vbus("1", "device"), dm("2"), dp("3"), gnd("4"), shell()],
      groups: [
        { name: "Nguồn", pins: ["1"] },
        { name: "Dữ liệu USB 2.0", pins: ["2", "3"] },
        { name: "Đất / vỏ", pins: ["4", "S"] }
      ]
    },

    "usb3-b": {
      id: "usb3-b",
      body: "usb-b-ss",
      name: "USB 3.x Standard-B (cổng device SuperSpeed)",
      family: "usb",
      standard: "USB 3.1 Legacy Cable and Connector Specification Rev 1.0 §5.3.2.2 Table 5-3 (gán chân Standard-B)",
      role: "device",
      gender: "female",
      summary: "Chân 1–4 như USB 2.0; chân 5–9: StdB_SSTX−/+, GND_DRAIN, StdB_SSRX−/+.",
      detail:
        "Chú ý: cùng số chân 5/6 nhưng ở A là SSRX, ở B là SSTX — nên cáp A–B vẫn nối thẳng 5–5, 6–6, 8–8, 9–9 " +
        "mà tín hiệu tự 'bắt chéo' TX→RX. Không cần dây chéo trong cáp.",
      pins: [
        vbus("1", "device"), dm("2"), dp("3"),
        { pin: "4", signal: "GND", name: "Đất nguồn (GND_PWRrt)", dir: "gnd", color: "đen", desc: "Đất trả về của nguồn và USB 2.0." + COLOR_NOTE },
        { pin: "5", signal: "StdB_SSTX−", name: "SuperSpeed Transmit −", dir: "out", pair: "SSTX", desc: "Cặp phát SuperSpeed của device (tới StdA_SSRX của host)." + SS_COLOR },
        { pin: "6", signal: "StdB_SSTX+", name: "SuperSpeed Transmit +", dir: "out", pair: "SSTX", desc: "Nửa dương cặp phát SuperSpeed của device." + SS_COLOR },
        { pin: "7", signal: "GND_DRAIN", name: "Đất drain tín hiệu", dir: "gnd", desc: "Nối dây drain của hai cặp SDP có bọc." },
        { pin: "8", signal: "StdB_SSRX−", name: "SuperSpeed Receive −", dir: "in", pair: "SSRX", desc: "Cặp thu SuperSpeed của device (từ StdA_SSTX của host)." + SS_COLOR },
        { pin: "9", signal: "StdB_SSRX+", name: "SuperSpeed Receive +", dir: "in", pair: "SSRX", desc: "Nửa dương cặp thu SuperSpeed của device." + SS_COLOR },
        shell()
      ],
      groups: [
        { name: "Nguồn", pins: ["1"] },
        { name: "Dữ liệu USB 2.0", pins: ["2", "3"] },
        { name: "SuperSpeed", pins: ["5", "6", "8", "9"] },
        { name: "Đất / vỏ", pins: ["4", "7", "S"] }
      ]
    },

    "usb2-mini-b": {
      id: "usb2-mini-b",
      body: "usb-mini-b",
      name: "USB 2.0 Mini-B (cổng device)",
      family: "usb",
      standard: "USB 2.0 ECN \"Mini-B connector\", Table 6-1 sửa đổi (chân 4 ID: 'not connected' trên plug Mini-B); USB OTG Supplement (chân ID)",
      role: "device",
      gender: "female",
      summary: "5 chân: VBUS, D−, D+, ID, GND — GND dời sang chân 5, chân 4 là ID.",
      detail:
        "Lỗi hay gặp khi hàn: Mini/Micro có GND ở chân 5 chứ không phải chân 4 như Standard-A/B. " +
        "Trên plug Mini-B chân ID để hở; trên thiết bị không hỗ trợ OTG chân ID không dùng.",
      pins: [
        vbus("1", "device"), dm("2"), dp("3"),
        { pin: "4", signal: "ID", name: "Nhận dạng OTG", dir: "in",
          desc: "Thiết bị OTG đọc chân này: hở (> 100 kΩ) = đang là device (plug B); nối GND (< 10 Ω) = phải làm host (plug A). Table 6-1 (ECN Mini-B) ghi chân 4 của plug Mini-B là 'not connected' — không có dây trong cáp thường." },
        gnd("5"), shell()
      ],
      groups: [
        { name: "Nguồn", pins: ["1"] },
        { name: "Dữ liệu USB 2.0", pins: ["2", "3"] },
        { name: "Nhận dạng", pins: ["4"] },
        { name: "Đất / vỏ", pins: ["5", "S"] }
      ]
    },

    "usb2-micro-b": {
      id: "usb2-micro-b",
      body: "usb-micro-b",
      name: "USB 2.0 Micro-B (cổng device / OTG)",
      family: "usb",
      standard: "Micro-USB Cables and Connectors Specification Rev 1.01 (gán chân Micro-B); USB OTG 2.0 Supplement (ID)",
      role: "device",
      gender: "female",
      summary: "5 chân: VBUS, D−, D+, ID, GND — giống Mini-B; chân ID quyết định vai trò OTG.",
      detail:
        "Điện thoại OTG: plug Micro-B (ID hở) → máy làm device; đầu OTG nối ID xuống GND → máy chuyển sang host và cấp VBUS. " +
        "Một số thiết bị dùng điện trở trên ID (ACA, 'Rid' 36,5 k/68 k/124 kΩ) để vừa làm host vừa sạc — nằm ngoài cáp thường. " +
        "Không chế bằng dây sang UART/RS-232: một số điện thoại có chế độ UART trên D+/D− nhưng đó là tính năng riêng của hãng.",
      pins: [
        vbus("1", "device"), dm("2"), dp("3"),
        { pin: "4", signal: "ID", name: "Nhận dạng OTG", dir: "in",
          desc: "Hở (Rid > 1 MΩ trong plug Micro-B) = device; nối GND (Rid < 10 Ω, plug Micro-A/đầu OTG) = host. Cáp thường không có dây ID." },
        gnd("5"), shell()
      ],
      groups: [
        { name: "Nguồn", pins: ["1"] },
        { name: "Dữ liệu USB 2.0", pins: ["2", "3"] },
        { name: "Nhận dạng", pins: ["4"] },
        { name: "Đất / vỏ", pins: ["5", "S"] }
      ]
    },

    "usb3-micro-b": {
      id: "usb3-micro-b",
      body: "usb-micro-b-ss",
      name: "USB 3.x Micro-B (cổng device SuperSpeed)",
      family: "usb",
      standard: "USB 3.1 Legacy Cable and Connector Specification Rev 1.0 §5.3.3.2 Table 5-4 (gán chân Micro-B)",
      role: "device",
      gender: "female",
      summary: "Chân 1–5 như Micro-B 2.0; chân 6–10: MicB_SSTX−/+, GND_DRAIN, MicB_SSRX−/+.",
      detail:
        "Cáp Standard-A ↔ Micro-B 3.x: StdA_SSRX (5,6) ↔ MicB_SSTX (6,7); StdA_SSTX (8,9) ↔ MicB_SSRX (9,10); GND_DRAIN 7 ↔ 8. " +
        "Ổ cứng di động 3.0 cắm cáp Micro-B 2.0 vẫn chạy nhưng chỉ 480 Mbit/s.",
      pins: [
        vbus("1", "device"), dm("2"), dp("3"),
        { pin: "4", signal: "ID", name: "Nhận dạng OTG", dir: "in", desc: "Như Micro-B 2.0: hở = device, nối GND = host." },
        gnd("5"),
        { pin: "6", signal: "MicB_SSTX−", name: "SuperSpeed Transmit −", dir: "out", pair: "SSTX", desc: "Cặp phát SuperSpeed của device." + SS_COLOR },
        { pin: "7", signal: "MicB_SSTX+", name: "SuperSpeed Transmit +", dir: "out", pair: "SSTX", desc: "Nửa dương cặp phát SuperSpeed của device." + SS_COLOR },
        { pin: "8", signal: "GND_DRAIN", name: "Đất drain tín hiệu", dir: "gnd", desc: "Nối dây drain của hai cặp SDP." },
        { pin: "9", signal: "MicB_SSRX−", name: "SuperSpeed Receive −", dir: "in", pair: "SSRX", desc: "Cặp thu SuperSpeed của device." + SS_COLOR },
        { pin: "10", signal: "MicB_SSRX+", name: "SuperSpeed Receive +", dir: "in", pair: "SSRX", desc: "Nửa dương cặp thu SuperSpeed của device." + SS_COLOR },
        shell()
      ],
      groups: [
        { name: "Nguồn", pins: ["1"] },
        { name: "Dữ liệu USB 2.0", pins: ["2", "3"] },
        { name: "Nhận dạng", pins: ["4"] },
        { name: "SuperSpeed", pins: ["6", "7", "9", "10"] },
        { name: "Đất / vỏ", pins: ["5", "8", "S"] }
      ]
    },

    "usb-c-rcpt": {
      id: "usb-c-rcpt",
      body: "usb-c",
      name: "USB Type-C receptacle (24 chân, đầy đủ)",
      family: "usb",
      standard: "USB Type-C Cable and Connector Specification Release 2.0 — Table 3-4 (receptacle đầy đủ), Table 3-5 (receptacle USB 2.0); Rp Table 4-24, Rd Table 4-25",
      role: null,
      gender: "female",
      summary: "A1–A12 / B12–B1: 4 GND, 4 VBUS, D+/D− lặp 2 lần, 2 cặp SuperSpeed mỗi mặt, CC1/CC2, SBU1/SBU2.",
      detail:
        "Vai trò không cố định theo đầu nối: cổng là DFP (nguồn/host), UFP (sink/device) hoặc DRP (đổi qua lại). Vai trò được định qua CC: " +
        "DFP kéo CC LÊN bằng Rp, UFP kéo CC XUỐNG bằng Rd = 5,1 kΩ. Rp báo dòng nguồn cấp được: lên 5 V — 56 kΩ (USB mặc định 500/900 mA), " +
        "22 kΩ (1,5 A), 10 kΩ (3 A); lên 3,3 V — 36 k / 12 k / 4,7 kΩ; hoặc nguồn dòng 80 / 180 / 330 µA. " +
        "DFP chỉ bật VBUS sau khi thấy Rd trên một CC (VBUS 'nguội' khi chưa cắm). " +
        "Xoay mặt cắm: plug chỉ có MỘT dây CC; nó chạm CC1 (A5) hay CC2 (B5) cho biết plug đang ngửa hay sấp, " +
        "từ đó bộ chọn (mux) dùng cặp TX1/RX1 hay TX2/RX2 cho SuperSpeed. D+/D− có ở cả A6/A7 và B6/B7, receptacle nối song song (A6–B6, A7–B7) trên bo mạch. " +
        "Chân CC còn lại (không nối CC của cáp) nối với chân VCONN của plug: cáp có chip đánh dấu (e-marker) kéo nó xuống Ra (800 Ω–1,2 kΩ), " +
        "DFP thấy Ra thì cấp VCONN (5 V) qua chân đó. " +
        "Receptacle USB 2.0 '16 chân' (bỏ A2, A3, A10, A11, B2, B3, B10, B11) vẫn hợp chuẩn; lỗi thiết kế kinh điển là chỉ gắn MỘT Rd 5,1 kΩ cho cả CC1 và CC2 — " +
        "phải có hai điện trở riêng, nếu không sạc bằng cáp C–C sẽ không lên nguồn. " +
        "Chỉ chế dây thụ động được cho USB 2.0/nguồn mặc định; USB PD, Alt Mode (DisplayPort), USB4 cần IC điều khiển.",
      pins: [
        { pin: "A1", signal: "GND", name: "Đất", dir: "gnd", desc: "Đất (4 chân A1, A12, B1, B12 nối chung)." },
        { pin: "A2", signal: "TX1+", name: "SuperSpeed TX cặp 1 +", dir: "out", pair: "TX1", desc: "Cặp phát SuperSpeed/USB4 số 1 (dùng khi plug chạm CC1)." },
        { pin: "A3", signal: "TX1−", name: "SuperSpeed TX cặp 1 −", dir: "out", pair: "TX1", desc: "Nửa âm cặp phát số 1." },
        { pin: "A4", signal: "VBUS", name: "Nguồn bus", dir: "pwr", desc: "VBUS (4 chân A4, A9, B4, B9 nối chung). 5 V mặc định; tới 20 V (48 V với EPR) khi thương lượng USB PD." },
        { pin: "A5", signal: "CC1", name: "Configuration Channel 1", dir: "io", desc: "Phát hiện cắm, chiều cắm, vai trò, mức dòng (Rp/Rd); kênh USB PD BMC." },
        { pin: "A6", signal: "D+", name: "USB 2.0 Data +", dir: "io", pair: "D", desc: "Cặp USB 2.0 (mặt A); nối song song với B6 trên bo mạch." },
        { pin: "A7", signal: "D−", name: "USB 2.0 Data −", dir: "io", pair: "D", desc: "Cặp USB 2.0 (mặt A); nối song song với B7." },
        { pin: "A8", signal: "SBU1", name: "Sideband Use 1", dir: "io", desc: "Kênh phụ cho Alt Mode (vd. DisplayPort AUX), USB4. Không dùng cho USB 2.0/3.x thuần." },
        { pin: "A9", signal: "VBUS", name: "Nguồn bus", dir: "pwr", desc: "VBUS." },
        { pin: "A10", signal: "RX2−", name: "SuperSpeed RX cặp 2 −", dir: "in", pair: "RX2", desc: "Cặp thu số 2 (dùng khi plug chạm CC2)." },
        { pin: "A11", signal: "RX2+", name: "SuperSpeed RX cặp 2 +", dir: "in", pair: "RX2", desc: "Nửa dương cặp thu số 2." },
        { pin: "A12", signal: "GND", name: "Đất", dir: "gnd", desc: "Đất." },
        { pin: "B1", signal: "GND", name: "Đất", dir: "gnd", desc: "Đất." },
        { pin: "B2", signal: "TX2+", name: "SuperSpeed TX cặp 2 +", dir: "out", pair: "TX2", desc: "Cặp phát số 2." },
        { pin: "B3", signal: "TX2−", name: "SuperSpeed TX cặp 2 −", dir: "out", pair: "TX2", desc: "Nửa âm cặp phát số 2." },
        { pin: "B4", signal: "VBUS", name: "Nguồn bus", dir: "pwr", desc: "VBUS." },
        { pin: "B5", signal: "CC2", name: "Configuration Channel 2", dir: "io", desc: "Như CC1; trên PLUG vị trí này là VCONN (xem biến thể 'plug')." },
        { pin: "B6", signal: "D+", name: "USB 2.0 Data +", dir: "io", pair: "D", desc: "Cặp USB 2.0 (mặt B), song song với A6 — để plug sấp vẫn chạm D+." },
        { pin: "B7", signal: "D−", name: "USB 2.0 Data −", dir: "io", pair: "D", desc: "Cặp USB 2.0 (mặt B), song song với A7." },
        { pin: "B8", signal: "SBU2", name: "Sideband Use 2", dir: "io", desc: "Kênh phụ thứ hai." },
        { pin: "B9", signal: "VBUS", name: "Nguồn bus", dir: "pwr", desc: "VBUS." },
        { pin: "B10", signal: "RX1−", name: "SuperSpeed RX cặp 1 −", dir: "in", pair: "RX1", desc: "Cặp thu số 1." },
        { pin: "B11", signal: "RX1+", name: "SuperSpeed RX cặp 1 +", dir: "in", pair: "RX1", desc: "Nửa dương cặp thu số 1." },
        { pin: "B12", signal: "GND", name: "Đất", dir: "gnd", desc: "Đất." },
        shell()
      ],
      groups: [
        { name: "Nguồn", pins: ["A4", "A9", "B4", "B9"] },
        { name: "Cấu hình (CC)", pins: ["A5", "B5"] },
        { name: "Dữ liệu USB 2.0", pins: ["A6", "A7", "B6", "B7"] },
        { name: "SuperSpeed / USB4", pins: ["A2", "A3", "A10", "A11", "B2", "B3", "B10", "B11"] },
        { name: "Sideband", pins: ["A8", "B8"] },
        { name: "Đất / vỏ", pins: ["A1", "A12", "B1", "B12", "S"] }
      ],
      variants: [
        {
          id: "plug-usb2",
          name: "Plug Type-C USB 2.0 (đầu cáp)",
          note: "Chân của PLUG đánh số giống receptacle (plug A1 chạm receptacle A1 khi cắm ngửa, chạm B1 khi cắm sấp). " +
            "Plug USB 2.0 chỉ có A1, A4, A5, A6, A7, A9, A12, B1, B4, B5, B9, B12: một dây CC, một cặp D+/D−, B5 là VCONN.",
          pins: {
            "A5": { signal: "CC", desc: "Dây CC duy nhất của cáp (chạy suốt cáp tới CC đầu kia trong cáp C–C)." },
            "B5": { signal: "VCONN", desc: "Cấp nguồn cho e-marker trong cáp; cáp thụ động không e-marker để hở; không chạy suốt cáp." },
            "B6": { signal: "—", desc: "Không có trên plug USB 2.0 (chỉ receptacle mới có cặp D± thứ hai)." },
            "B7": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "A2": { signal: "—", desc: "Không có trên plug USB 2.0 (plug full-featured mới có TX/RX)." },
            "A3": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "A10": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "A11": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "B2": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "B3": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "B10": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "B11": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "A8": { signal: "—", desc: "Không có trên plug USB 2.0." },
            "B8": { signal: "—", desc: "Không có trên plug USB 2.0." }
          }
        },
        {
          id: "plug-full",
          name: "Plug Type-C full-featured (USB 3.x/USB4)",
          note: "Có đủ TX1/RX1, TX2/RX2, SBU1/SBU2; vẫn chỉ một cặp D+/D− (A6/A7), một CC (A5), B5 = VCONN. Cáp full-featured bắt buộc có e-marker.",
          pins: {
            "A5": { signal: "CC", desc: "Dây CC của cáp." },
            "B5": { signal: "VCONN", desc: "Cấp nguồn cho e-marker (Ra xuống GND)." },
            "B6": { signal: "—", desc: "Không có trên plug." },
            "B7": { signal: "—", desc: "Không có trên plug." }
          }
        },
        {
          id: "rcpt-usb2-16",
          name: "Receptacle USB 2.0 '16 chân'",
          note: "Bỏ 8 chân SuperSpeed; vẫn đủ VBUS ×4, GND ×4, CC1, CC2, D± ×2, SBU1/2 (SBU thường không nối).",
          pins: {
            "A2": { signal: "—", desc: "Không có (receptacle chỉ USB 2.0)." },
            "A3": { signal: "—", desc: "Không có." },
            "A10": { signal: "—", desc: "Không có." },
            "A11": { signal: "—", desc: "Không có." },
            "B2": { signal: "—", desc: "Không có." },
            "B3": { signal: "—", desc: "Không có." },
            "B10": { signal: "—", desc: "Không có." },
            "B11": { signal: "—", desc: "Không có." }
          }
        }
      ]
    }
  };

  // ---------------------------------------------------------------- Cable
  var CPLUG = "Phía C: số chân là chân của PLUG (đánh số như receptacle; cắm sấp thì A↔B tự đổi). ";
  var cables = [
    {
      id: "usb-a-b",
      name: "Cáp USB 2.0 Standard-A ↔ Standard-B (cáp máy in)",
      family: "usb",
      kind: "cable",
      a: { pinout: "usb2-a", gender: "male", label: "Plug A — cắm vào host" },
      b: { pinout: "usb2-b", gender: "male", label: "Plug B — cắm vào device" },
      wires: [
        { a: "1", b: "1", note: "VBUS – VBUS (dây đỏ)" },
        { a: "2", b: "2", note: "D− – D− (dây trắng, xoắn với D+)" },
        { a: "3", b: "3", note: "D+ – D+ (dây xanh lá)" },
        { a: "4", b: "4", note: "GND – GND (dây đen)" },
        { a: "S", b: "S", note: "lưới chống nhiễu – vỏ hai đầu" }
      ],
      use: "Nối host (PC) với thiết bị có ổ Standard-B: máy in, máy quét, bộ chuyển đổi, nhạc cụ MIDI USB.",
      standard: "USB 2.0 §6 (Table 6-1; cáp tháo rời Standard-A ↔ Standard-B)",
      vendor: false,
      detail:
        "Nối thẳng 1–1. D+/D− phải là một cặp xoắn trở kháng vi sai 90 Ω; VBUS/GND tiết diện đủ cho 500 mA (thường 28–20 AWG). " +
        "Tự kiểm: host cấp VBUS (pwr) → device nhận VBUS (pwr); D± hai chiều nối D± cùng tên; GND–GND; không có cặp ra–ra.",
      warnings: [
        "Đừng chế cáp A ↔ A nối VBUS/D±: hai host cùng đẩy VBUS 5 V vào nhau có thể hỏng cổng — " + "không có cáp A–A nối VBUS/D± (USB 2.0); USB 3.x chỉ định nghĩa một cáp A–A dùng gỡ lỗi, trong đó VBUS, D+, D− KHÔNG nối, chỉ GND/drain và hai cặp SuperSpeed bắt chéo (5↔8, 6↔9) (USB 3.1 Legacy Cable and Connector Spec Rev 1.0 §5.5.2, Table 5-9). Muốn nối hai PC cần cáp 'bridge' có IC ở giữa.",
        "Đảo D+/D− thì thiết bị không nhận (không hỏng); đảo VBUS/GND thì hỏng."
      ]
    },
    {
      id: "usb-a-micro-b",
      name: "Cáp USB 2.0 Standard-A ↔ Micro-B (cáp sạc/dữ liệu điện thoại)",
      family: "usb",
      kind: "cable",
      a: { pinout: "usb2-a", gender: "male", label: "Plug A — cắm vào host/cốc sạc" },
      b: { pinout: "usb2-micro-b", gender: "male", label: "Plug Micro-B — cắm vào điện thoại/device" },
      wires: [
        { a: "1", b: "1", note: "VBUS (đỏ)" },
        { a: "2", b: "2", note: "D− (trắng)" },
        { a: "3", b: "3", note: "D+ (xanh lá)" },
        { a: "4", b: "5", note: "GND: chân 4 của A sang chân 5 của Micro-B (đen)" },
        { a: "S", b: "S", note: "lưới – vỏ" }
      ],
      use: "Sạc và truyền dữ liệu cho điện thoại, ổ cứng, mạch phát triển có cổng Micro-B.",
      standard: "Micro-USB Cables and Connectors Spec Rev 1.01 (cáp Standard-A ↔ Micro-B)",
      vendor: false,
      detail:
        "Chân ID (4) của plug Micro-B để HỞ (không nối dây; chuẩn cho phép Rid > 1 MΩ xuống GND) → thiết bị OTG biết mình là device. " +
        "Lỗi hàn hay gặp: nối GND sang chân 4 (ID) thay vì chân 5 — thiết bị OTG tưởng là host, không sạc/không kết nối. " +
        "Cáp 'chỉ sạc' giá rẻ chỉ có VBUS và GND (không có D±) — kết nối dữ liệu không được.",
      warnings: [
        "GND phía Micro-B là chân 5, không phải chân 4.",
        "Không nối ID xuống GND trong cáp thường (đó là đầu OTG)."
      ]
    },
    {
      id: "usb-otg-micro",
      name: "Đầu chuyển OTG: Micro-B (plug) → Standard-A (ổ cái)",
      family: "usb",
      kind: "adapter",
      a: { pinout: "usb2-micro-b", gender: "male", label: "Plug Micro-B — cắm vào điện thoại (sẽ làm host)" },
      b: { pinout: "usb2-a", gender: "female", label: "Receptacle A — cắm USB flash, chuột, bàn phím" },
      wires: [
        { a: "1", b: "1", note: "VBUS: điện thoại cấp 5 V ra ổ A" },
        { a: "2", b: "2", note: "D−" },
        { a: "3", b: "3", note: "D+" },
        { a: "5", b: "4", note: "GND" },
        { a: "S", b: "S", note: "vỏ – vỏ" }
      ],
      bridges: [{ end: "a", pins: ["4", "5"], note: "ID nối GND (Rid < 10 Ω) — đây chính là 'plug Micro-A' giả, báo điện thoại chuyển sang host" }],
      use: "Cho điện thoại/máy tính bảng hỗ trợ OTG đọc USB flash, dùng chuột/bàn phím, cáp USB-serial.",
      standard: "USB OTG Supplement (ID pin); Micro-USB Cables and Connectors Spec Rev 1.01",
      vendor: false,
      detail:
        "Khi điện thoại thấy ID = GND nó bật vai trò host và cấp VBUS (thường ≤ 500 mA, nhiều máy chỉ 100–300 mA) ra ổ A. " +
        "Chuẩn OTG gốc dùng plug Micro-A ở cáp; đầu chuyển Micro-B→A cái là dạng phổ biến (về mặt điện tương đương). " +
        "Ở đây cổng A cái đóng vai 'host port' của điện thoại nên dùng pinout usb2-a (host) là đúng chiều VBUS.",
      warnings: [
        "Điện thoại không hỗ trợ OTG thì không cấp VBUS — thiết bị cắm vào không sáng.",
        "Ổ cứng 2,5\" kéo > 500 mA có thể làm sụt nguồn; cần hub có nguồn riêng.",
        "Không cắm ổ A của đầu OTG vào cốc sạc bằng cáp A–A tự chế: VBUS hai nguồn đụng nhau."
      ]
    },
    {
      id: "usb3-a-b",
      name: "Cáp USB 3.x Standard-A ↔ Standard-B",
      family: "usb",
      kind: "cable",
      a: { pinout: "usb3-a", gender: "male", label: "Plug A SuperSpeed — host" },
      b: { pinout: "usb3-b", gender: "male", label: "Plug B SuperSpeed — device" },
      wires: [
        { a: "1", b: "1", note: "VBUS" },
        { a: "2", b: "2", note: "D− (cặp UTP USB 2.0)" },
        { a: "3", b: "3", note: "D+" },
        { a: "4", b: "4", note: "GND_PWRrt" },
        { a: "5", b: "5", note: "StdA_SSRX− ← StdB_SSTX− (cặp SDP, device phát → host thu)" },
        { a: "6", b: "6", note: "StdA_SSRX+ ← StdB_SSTX+" },
        { a: "7", b: "7", note: "GND_DRAIN – GND_DRAIN (dây drain hai cặp SDP)" },
        { a: "8", b: "8", note: "StdA_SSTX− → StdB_SSRX− (host phát → device thu)" },
        { a: "9", b: "9", note: "StdA_SSTX+ → StdB_SSRX+" },
        { a: "S", b: "S", note: "lưới bọc ngoài – vỏ" }
      ],
      use: "Ổ cứng gắn ngoài để bàn, hub, dock có ổ USB 3.x Standard-B.",
      standard: "USB 3.1 Legacy Cable and Connector Specification Rev 1.0 §5.5.1 Table 5-8 (cáp Standard-A ↔ Standard-B)",
      vendor: false,
      detail:
        "Số chân nối thẳng 1–1 nhưng tên tín hiệu tự bắt chéo: chân 5/6 là SSRX ở A và SSTX ở B; chân 8/9 là SSTX ở A và SSRX ở B. " +
        "Tự kiểm: StdA_SSTX (out) → StdB_SSRX (in) ✓; StdB_SSTX (out) → StdA_SSRX (in) ✓; không có out–out. " +
        "Cáp gồm 1 cặp UTP (D±), 2 cặp SDP có bọc + drain, VBUS, GND, lưới ngoài. Dài thực tế ≤ 3 m cho Gen 1.",
      warnings: [
        "Hai cặp SuperSpeed phải là cặp vi sai có bọc 90 Ω; dây rời thường chỉ chạy được USB 2.0.",
        "Plug B 3.x không cắm được vào ổ B 2.0 (vướng bướu)."
      ]
    },
    {
      id: "usb-c-a",
      name: "Cáp USB Type-C ↔ Standard-A (USB 2.0, legacy)",
      family: "usb",
      kind: "cable",
      a: { pinout: "usb-c-rcpt", gender: "male", label: "Plug C — cắm vào device/điện thoại (dùng biến thể 'Plug USB 2.0')" },
      b: { pinout: "usb2-a", gender: "male", label: "Plug A — cắm vào host/cốc sạc" },
      wires: [
        { a: "A4", b: "1", note: "VBUS (A4, A9, B4, B9 nối chung trong plug C)" },
        { a: "A7", b: "2", note: "D−" },
        { a: "A6", b: "3", note: "D+" },
        { a: "A1", b: "4", note: "GND (A1, A12, B1, B12 nối chung trong plug C)" },
        { a: "S", b: "S", note: "lưới – vỏ" }
      ],
      bridges: [
        { end: "a", pins: ["A4", "A9", "B4", "B9"], note: "4 chân VBUS của plug C nối chung" },
        { end: "a", pins: ["A1", "A12", "B1", "B12"], note: "4 chân GND của plug C nối chung" },
        { end: "a", pins: ["S", "A1"], note: "Vỏ (shield) và GND nối với nhau bên trong plug (Type-C R2.0 Table 3-13 note 5)" },
        { end: "b", pins: ["S", "4"], note: "Vỏ (shield) và GND nối với nhau bên trong plug (Type-C R2.0 Table 3-13 note 5)" }
      ],
      components: [
        { type: "resistor", value: "56 kΩ ±5 %", between: ["a:A5", "a:A4"], note: "Rp: kéo CC lên VBUS trong plug C — báo device 'nguồn USB mặc định' (≤ 500 mA USB 2.0)" }
      ],
      use: "Sạc/kết nối điện thoại, tai nghe… có cổng C với máy tính hoặc cốc sạc cổng A.",
      standard: "USB Type-C Cable and Connector Specification Release 2.0 §3.5.2 Table 3-13 (USB Type-C to USB 2.0 Standard-A); Rp Table 4-24",
      vendor: false,
      detail:
        CPLUG +
        "Phía A là host/nguồn nhưng cổng A không có CC; cáp phải tự đóng vai DFP bằng Rp 56 kΩ lên VBUS ở chân CC (A5) của plug C. " +
        "Device C thấy Rp 56 kΩ (≈ 0,42 V trên Rd 5,1 kΩ: 5 V × 5,1/61,1 — nằm trong dải vRd-USB 0,25–0,61 V của Table 4-36; 0,8 V là dải 1,5 A) hiểu là 'Default USB Power' và chỉ kéo dòng theo USB 2.0/BC 1.2. " +
        "Chân B5 (VCONN) của plug để hở; không có e-marker. B6/B7 không có trên plug. " +
        "Bản USB 3.x của cáp này thêm StdA_SSTX/RX ↔ cặp TX1/RX1 của plug C (vẫn Rp 56 kΩ). " +
        "Tự kiểm: VBUS(pwr)–VBUS(pwr); D+–D+, D−–D−; GND–GND; CC chỉ có điện trở, không có dây sang đầu A.",
      warnings: [
        "Rp PHẢI là 56 kΩ. Cáp đời đầu dùng 10 kΩ (báo 3 A) khiến device C kéo 3 A từ cổng A chỉ chịu 0,5–2,4 A → nóng, hỏng cổng/cốc sạc.",
        "Đừng nhầm với đầu chuyển OTG 'plug C → ổ A cái': ở đó phía C là host nên plug C phải có Rd 5,1 kΩ xuống GND, không phải Rp 56 kΩ (Type-C R2.0 §3.6.1).",
        "Không chế cáp A ↔ A, dù qua C: không có cáp A–A nối VBUS/D± (USB 2.0); USB 3.x chỉ định nghĩa một cáp A–A dùng gỡ lỗi, trong đó VBUS, D+, D− KHÔNG nối, chỉ GND/drain và hai cặp SuperSpeed bắt chéo (5↔8, 6↔9) (USB 3.1 Legacy Cable and Connector Spec Rev 1.0 §5.5.2, Table 5-9)."
      ]
    },
    {
      id: "usb-c-micro-b",
      name: "Cáp USB Type-C ↔ Micro-B (USB 2.0, legacy)",
      family: "usb",
      kind: "cable",
      a: { pinout: "usb-c-rcpt", gender: "male", label: "Plug C — cắm vào host C (laptop, điện thoại làm host, cốc sạc C)" },
      b: { pinout: "usb2-micro-b", gender: "male", label: "Plug Micro-B — cắm vào device đời cũ" },
      wires: [
        { a: "A4", b: "1", note: "VBUS" },
        { a: "A7", b: "2", note: "D−" },
        { a: "A6", b: "3", note: "D+" },
        { a: "A1", b: "5", note: "GND → chân 5 Micro-B" },
        { a: "S", b: "S", note: "lưới – vỏ" }
      ],
      bridges: [
        { end: "a", pins: ["A4", "A9", "B4", "B9"], note: "4 chân VBUS của plug C nối chung" },
        { end: "a", pins: ["A1", "A12", "B1", "B12"], note: "4 chân GND của plug C nối chung" },
        { end: "a", pins: ["S", "A1"], note: "Vỏ (shield) và GND nối với nhau bên trong plug (Type-C R2.0 Table 3-18 note 6)" },
        { end: "b", pins: ["S", "5"], note: "Vỏ (shield) và GND nối với nhau bên trong plug (Type-C R2.0 Table 3-18 note 6)" }
      ],
      components: [
        { type: "resistor", value: "5,1 kΩ ±20 %", between: ["a:A5", "a:A1"], note: "Rd: kéo CC xuống GND trong plug C — báo host C 'có device cắm', host mới bật VBUS" }
      ],
      use: "Nối thiết bị Micro-B (ổ cứng 2.0, tai nghe, mạch Arduino/ESP) với laptop/điện thoại chỉ có cổng C; sạc thiết bị Micro-B từ cốc sạc C.",
      standard: "USB Type-C Cable and Connector Specification Release 2.0 §3.5.7 Table 3-18 (USB Type-C to USB 2.0 Micro-B); Rd Table 4-25",
      vendor: false,
      detail:
        CPLUG +
        "Phía C là host/nguồn (DFP có Rp). Cáp đóng vai UFP bằng Rd 5,1 kΩ từ CC (A5) xuống GND. Không có Rd thì cổng C không bật VBUS — thiết bị Micro-B 'chết'. " +
        "Chân ID (4) phía Micro-B để hở → device. B5 (VCONN) để hở. " +
        "Tự kiểm: VBUS do host C cấp (pwr) → VBUS device (pwr); D±–D±; GND (A1…) → chân 5.",
      warnings: [
        "Dùng Rd 5,1 kΩ xuống GND, KHÔNG dùng Rp 56 kΩ lên VBUS (đó là cáp C–A). Lẫn hai loại thì cáp không hoạt động hoặc hai nguồn đụng nhau.",
        "GND phía Micro-B là chân 5.",
        "Đầu chuyển ngược 'Micro-B (ổ cái) → plug C' (cho cáp Micro-B cũ cắm vào điện thoại C) thì dùng Rp 56 kΩ lên VBUS (Type-C R2.0 §3.6.2)."
      ]
    },
    {
      id: "usb-c-c-2",
      name: "Cáp USB Type-C ↔ Type-C (USB 2.0, ≤ 3 A)",
      family: "usb",
      kind: "cable",
      a: { pinout: "usb-c-rcpt", gender: "male", label: "Plug C — đầu 1" },
      b: { pinout: "usb-c-rcpt", gender: "male", label: "Plug C — đầu 2" },
      wires: [
        { a: "A4", b: "A4", note: "VBUS" },
        { a: "A1", b: "A1", note: "GND" },
        { a: "A6", b: "A6", note: "D+" },
        { a: "A7", b: "A7", note: "D−" },
        { a: "A5", b: "A5", note: "CC – CC (dây CC duy nhất, chạy suốt cáp)" },
        { a: "S", b: "S", note: "lưới – vỏ" }
      ],
      bridges: [
        { end: "a", pins: ["A4", "A9", "B4", "B9"], note: "VBUS nối chung trong plug" },
        { end: "a", pins: ["A1", "A12", "B1", "B12"], note: "GND nối chung trong plug" },
        { end: "b", pins: ["A4", "A9", "B4", "B9"], note: "VBUS nối chung trong plug" },
        { end: "b", pins: ["A1", "A12", "B1", "B12"], note: "GND nối chung trong plug" },
        { end: "a", pins: ["S", "A1"], note: "Vỏ (shield) và GND nối với nhau bên trong plug (Type-C R2.0 Table 3-11 note 6)" },
        { end: "b", pins: ["S", "A1"], note: "Vỏ (shield) và GND nối với nhau bên trong plug (Type-C R2.0 Table 3-11 note 6)" }
      ],
      use: "Sạc và kết nối USB 2.0 giữa hai thiết bị C (laptop–điện thoại, cốc sạc PD–điện thoại).",
      standard: "USB Type-C Cable and Connector Specification Release 2.0 §3.4.2 Table 3-11 (cáp USB Type-C ↔ Type-C USB 2.0)",
      vendor: false,
      detail:
        CPLUG +
        "Cáp không có điện trở: Rp nằm trong cổng nguồn (DFP), Rd trong cổng thiết bị (UFP); dây CC nối thẳng để hai bên 'thấy' nhau. " +
        "Hai thiết bị DRP sẽ tự thương lượng ai làm nguồn. Cắm sấp/ngửa ở mỗi đầu độc lập — bộ điều khiển mỗi bên tự biết qua CC1/CC2. " +
        "VCONN (B5) không chạy suốt cáp; cáp thụ động 3 A không cần e-marker. Cáp 5 A (tới 100 W/240 W) BẮT BUỘC có e-marker (Ra trên VCONN). " +
        "Tự kiểm: CC–CC (io); VBUS–VBUS; GND–GND; D+–D+ (không đảo D± giữa hai đầu C).",
      warnings: [
        "Không đặt Rp hoặc Rd trong cáp C–C — làm hỏng phát hiện vai trò.",
        "Không nối B5 (VCONN) đầu này sang đầu kia.",
        "Muốn 5 A hoặc USB 3.x/USB4 phải có e-marker — không chế bằng dây thụ động được."
      ]
    }
  ];

  window.CONN_BODIES = Object.assign(window.CONN_BODIES || {}, bodies);
  // v3 (luật 6): USB không có nút loopback thụ động — lý do theo từng pinout.
  var USB2_WHY =
    "USB 2.0 không có cặp phát/thu riêng: D+/D− là MỘT cặp bán song công, host điều khiển mọi giao dịch theo giao thức (token/data/handshake) — " +
    "nối D+ với D− hay vòng về chính host không tạo ra 'thiết bị' nào, host chỉ thấy cổng trống. ";
  var USB3_WHY =
    "Cặp SuperSpeed có TX và RX riêng, nhưng nối SSTX → SSRX của chính host không cho link: LTSSM phải bắt tay (Rx.Detect, Polling, TS1/TS2) với một cổng đối diện; " +
    "\"Loopback\" của USB 3.x là MỘT TRẠNG THÁI GIAO THỨC do máy đo compliance yêu cầu, không phải nút cắm dây. ";
  var USB_TEST =
    "Cách thử: cắm thiết bị biết chắc tốt (USB flash, chuột) rồi xem Device Manager / `lsusb` / `dmesg`; đo VBUS bằng đồng hồ hoặc USB tester (≈ 5 V, dòng tải); " +
    "kiểm cáp bằng máy test cáp USB (thông mạch từng chân, nhận e-marker với USB-C).";
  var USB_NOLOOP = {
    "usb2-a": USB2_WHY + USB_TEST,
    "usb3-a": USB2_WHY + USB3_WHY + USB_TEST,
    "usb2-b": USB2_WHY + "Phía device (B) chỉ trả lời host, không tự phát. " + USB_TEST,
    "usb3-b": USB2_WHY + USB3_WHY + USB_TEST,
    "usb2-mini-b": USB2_WHY + "Chân ID chỉ báo vai trò OTG (nối GND = host A), không phải đường dữ liệu. " + USB_TEST,
    "usb2-micro-b": USB2_WHY + "Chân ID chỉ báo vai trò OTG (nối GND = host A), không phải đường dữ liệu. " + USB_TEST,
    "usb3-micro-b": USB2_WHY + USB3_WHY + USB_TEST,
    "usb-c-rcpt": USB2_WHY + USB3_WHY +
      "Thêm nữa, cổng nguồn USB-C chỉ bật VBUS khi thấy Rd 5,1 kΩ trên CC — nút dây không có Rd thì cổng thậm chí không cấp điện. " + USB_TEST
  };
  Object.keys(USB_NOLOOP).forEach(function (k) { if (pinouts[k]) pinouts[k].noLoop = USB_NOLOOP[k]; });

  window.CONN_PINOUTS = Object.assign(window.CONN_PINOUTS || {}, pinouts);
  window.CONN_CABLES = (window.CONN_CABLES || []).concat(cables);
})();
