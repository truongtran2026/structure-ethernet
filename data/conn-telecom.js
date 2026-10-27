// Mảng Đấu nối — Viễn thông/mạng: thân 8P8C, 6P, cặp BNC; sơ đồ chân Ethernet T568A/B (+PoE),
// E1 RJ48C 120 Ω, E1 BNC 75 Ω, điện thoại RJ11/RJ14; cáp thẳng/chéo, cáp chéo/loopback E1, balun.
// Schema: .claude/skills/connector-pinout-spec/references/connector-schema.md
// Thân 8p8c còn được data/conn-serial.js dùng cho console RJ45.
(function () {
  // 8P8C / 6P: nhìn vào lỗ ổ cắm (jack), khe lẫy ở DƯỚI → chân 1 bên TRÁI.
  const rjPins = (n, w, x0, step, y) =>
    Array.from({ length: n }, (_, i) => ({ pin: String(i + 1), x: x0 + i * step, y }));

  // Màu dây T568A / T568B và số cặp (đánh số cặp theo TIA: 1 xanh dương, 2 cam, 3 xanh lá, 4 nâu).
  const T568B = {
    1: ["trắng-cam", "2"], 2: ["cam", "2"], 3: ["trắng-xanh lá", "3"], 4: ["xanh dương", "1"],
    5: ["trắng-xanh dương", "1"], 6: ["xanh lá", "3"], 7: ["trắng-nâu", "4"], 8: ["nâu", "4"]
  };
  const T568A = {
    1: ["trắng-xanh lá", "3"], 2: ["xanh lá", "3"], 3: ["trắng-cam", "2"], 4: ["xanh dương", "1"],
    5: ["trắng-xanh dương", "1"], 6: ["cam", "2"], 7: ["trắng-nâu", "4"], 8: ["nâu", "4"]
  };
  // Màu thật ở đầu b của cáp chéo Gigabit khi đầu a bấm T568B (1→3, 2→6, 3→1, 6→2, 4→7, 5→8, 7→4, 8→5).
  const GIG_CROSS_B = {
    1: ["trắng-xanh lá", "3"], 2: ["xanh lá", "3"], 3: ["trắng-cam", "2"], 4: ["trắng-nâu", "4"],
    5: ["nâu", "4"], 6: ["cam", "2"], 7: ["xanh dương", "1"], 8: ["trắng-xanh dương", "1"]
  };
  // Gán tín hiệu cơ sở = 10BASE-T/100BASE-TX phía MDI (card mạng PC/router; switch là MDI-X).
  const ETH_BASE = {
    1: ["TD+", "Transmit Data +", "diff", "Cặp phát (+) của 10/100BASE-TX phía MDI (PC, router). Switch (MDI-X) dùng chân này để thu."],
    2: ["TD−", "Transmit Data −", "diff", "Cặp phát (−), xoắn với chân 1."],
    3: ["RD+", "Receive Data +", "diff", "Cặp thu (+) phía MDI. Chú ý: cặp thu nằm ở 3 và 6, không phải 3 và 4."],
    4: ["(không dùng)", "Unused / PoE Mode B", "nc", "10/100BASE-TX không dùng; PoE Mode B (Alternative B) cấp nguồn (+) ở đây."],
    5: ["(không dùng)", "Unused / PoE Mode B", "nc", "10/100BASE-TX không dùng; PoE Mode B cấp nguồn (+), cùng cặp với chân 4."],
    6: ["RD−", "Receive Data −", "diff", "Cặp thu (−), xoắn với chân 3 — hai chân thu tách nhau bởi cặp 4-5."],
    7: ["(không dùng)", "Unused / PoE Mode B", "nc", "10/100BASE-TX không dùng; PoE Mode B dùng làm đường về (−)."],
    8: ["(không dùng)", "Unused / PoE Mode B", "nc", "10/100BASE-TX không dùng; PoE Mode B dùng làm đường về (−), cùng cặp với chân 7."],
    S: ["Shield", "Vỏ chống nhiễu (cáp STP/FTP)", "shield", "Vỏ kim loại ổ/phích bọc giáp; nối màn chắn cáp. Cáp UTP và ổ nhựa không có."]
  };
  const ethPins = (colors) =>
    ["1", "2", "3", "4", "5", "6", "7", "8", "S"].map((p) => {
      const [signal, name, dir, desc] = ETH_BASE[p];
      const c = colors[p];
      return { pin: p, signal, name, dir, color: c ? c[0] : null, pair: c ? c[1] : null, desc };
    });
  const ETH_VARIANTS = [
    {
      id: "mdix",
      name: "10/100BASE-TX phía MDI-X (switch, hub)",
      note: "Cùng ổ 8P8C nhưng switch đảo vai trò: thu ở 1-2, phát ở 3-6. Vì vậy PC ↔ switch dùng cáp thẳng.",
      pins: {
        "1": { signal: "RD+", desc: "MDI-X: thu (+)." }, "2": { signal: "RD−", desc: "MDI-X: thu (−)." },
        "3": { signal: "TD+", desc: "MDI-X: phát (+)." }, "6": { signal: "TD−", desc: "MDI-X: phát (−)." }
      }
    },
    {
      id: "1000base-t",
      name: "1000BASE-T (Gigabit, cả 4 cặp)",
      note: "IEEE 802.3 Cl.40: 4 cặp đều phát và thu đồng thời (song công trên từng cặp, khử tiếng vọng), PAM-5. Cáp thiếu/đứt 1 cặp mà cổng vẫn lên 100M là nhờ tính năng \"downshift\" của hãng PHY — chuẩn không quy định, nhiều cổng sẽ không lên link.",
      pins: {
        "1": { signal: "BI_DA+", dir: "diff", desc: "Cặp A (+), hai chiều." }, "2": { signal: "BI_DA−", dir: "diff", desc: "Cặp A (−)." },
        "3": { signal: "BI_DB+", dir: "diff", desc: "Cặp B (+), hai chiều." }, "6": { signal: "BI_DB−", dir: "diff", desc: "Cặp B (−)." },
        "4": { signal: "BI_DC+", dir: "diff", desc: "Cặp C (+), hai chiều." }, "5": { signal: "BI_DC−", dir: "diff", desc: "Cặp C (−)." },
        "7": { signal: "BI_DD+", dir: "diff", desc: "Cặp D (+), hai chiều." }, "8": { signal: "BI_DD−", dir: "diff", desc: "Cặp D (−)." }
      }
    },
    {
      id: "poe-a",
      name: "PoE Mode A / Alternative A (802.3af/at, nguồn trên cặp dữ liệu)",
      note: "PSE đặt điện áp chung (common mode) lên cặp 1-2 và 3-6 qua điểm giữa biến áp. Phía MDI: 1-2 dương, 3-6 âm; phía MDI-X ngược lại. PD phải chịu được cả hai cực tính (cầu diode).",
      pins: {
        "1": { signal: "TD+ / V+", desc: "Dữ liệu + nguồn: VPort dương (Alternative A, MDI)." },
        "2": { signal: "TD− / V+", desc: "Dữ liệu + nguồn: VPort dương, cùng cặp chân 1." },
        "3": { signal: "RD+ / V−", desc: "Dữ liệu + nguồn: VPort âm (Alternative A, MDI)." },
        "6": { signal: "RD− / V−", desc: "Dữ liệu + nguồn: VPort âm, cùng cặp chân 3." }
      }
    },
    {
      id: "poe-b",
      name: "PoE Mode B / Alternative B (802.3af/at, nguồn trên cặp rảnh)",
      note: "Chỉ dùng được khi 10/100 (cặp 4-5, 7-8 rảnh) hoặc dùng chung với dữ liệu ở 1000BASE-T. Thường gặp 4-5 dương, 7-8 âm, nhưng IEEE 802.3bt Table 145-3 cho phép Alternative B ở CẢ HAI cực tính — cực tính có thể ngược, PD phải chịu được cả hai (cầu diode).",
      pins: {
        "4": { signal: "V+", dir: "pwr", desc: "Nguồn PoE dương (Alternative B)." },
        "5": { signal: "V+", dir: "pwr", desc: "Nguồn PoE dương, cùng cặp chân 4." },
        "7": { signal: "V−", dir: "pwr", desc: "Nguồn PoE âm (đường về)." },
        "8": { signal: "V−", dir: "pwr", desc: "Nguồn PoE âm, cùng cặp chân 7." }
      }
    },
    {
      id: "poe-4pair",
      name: "PoE 4 cặp (802.3bt Type 3/4, ≤ 60/90 W tại PSE)",
      note: "Cấp đồng thời Alternative A và B. Type 4 tới 90 W ở PSE (~71 W tại PD). Cáp kém (dây CCA, tiết diện nhỏ) nóng lên khi bó nhiều sợi. Cực tính hiển thị là cách thường gặp; 802.3bt Table 145-3 cho phép Alternative B ở cả hai cực tính — PD phải chịu cả hai.",
      pins: {
        "1": { signal: "TD+ / V+", desc: "Dữ liệu + nguồn (bộ A)." }, "2": { signal: "TD− / V+", desc: "Dữ liệu + nguồn (bộ A)." },
        "3": { signal: "RD+ / V−", desc: "Dữ liệu + nguồn (bộ A)." }, "6": { signal: "RD− / V−", desc: "Dữ liệu + nguồn (bộ A)." },
        "4": { signal: "V+", dir: "pwr", desc: "Nguồn bộ B dương (ở 1000BASE-T kèm dữ liệu BI_DC+)." },
        "5": { signal: "V+", dir: "pwr", desc: "Nguồn bộ B dương (kèm BI_DC−)." },
        "7": { signal: "V−", dir: "pwr", desc: "Nguồn bộ B âm (kèm BI_DD+)." },
        "8": { signal: "V−", dir: "pwr", desc: "Nguồn bộ B âm (kèm BI_DD−)." }
      }
    }
  ];

  window.CONN_BODIES = Object.assign(window.CONN_BODIES || {}, {
    "8p8c": {
      id: "8p8c",
      name: "Modular 8P8C (\"RJ45\")",
      aka: ["RJ45", "RJ-45", "8P8C", "đầu mạng", "hạt mạng", "RJ48", "RJ48C"],
      family: "telecom",
      standard: "IEC 60603-7 (thân modular 8 vị trí); FCC Part 68 Subpart F (tên RJ45S/RJ48)",
      summary: "Đầu modular 8 vị trí 8 tiếp điểm — dùng cho Ethernet, E1/T1 (RJ48C), console nối tiếp.",
      detail:
        "\"RJ45\" trong FCC gốc là ổ 8P2C cho modem có điện trở lập trình; ngày nay gọi chung đầu 8P8C là RJ45. " +
        "Thân này chỉ là hình cơ khí: cùng một ổ 8P8C có thể là cổng mạng, cổng E1 (RJ48C) hay cổng console — cắm nhầm có thể làm hỏng cổng (PoE vào console). " +
        "Phích (plug) bấm bằng kìm; ổ (jack) có 8 lò xo tiếp điểm. Loại bọc giáp (STP/FTP) có vỏ kim loại = chân S.",
      genders: {
        male: { name: "Phích cắm (plug, \"hạt mạng\")", note: "Đầu cáp, có lẫy nhựa. Cầm phích: tiếp điểm hướng về mình, lẫy phía sau, dây đi xuống → chân 1 bên TRÁI." },
        female: { name: "Ổ cắm (jack, receptacle)", note: "Trên thiết bị hoặc nhân mạng (keystone), có khe nhận lẫy." }
      },
      face: {
        outline: "rj",
        w: 120, h: 80,
        viewOf: "female",
        orientation:
          "Nhìn thẳng vào lỗ ổ cắm (jack), khe lẫy ở phía DƯỚI, tiếp điểm ở phía trên: chân 1 bên TRÁI → chân 8 bên PHẢI. " +
          "Phích nhìn vào đầu cắm (lẫy ở dưới) là ảnh gương: chân 1 bên PHẢI.",
        pins: rjPins(8, 120, 18, 12, 16).concat([{ pin: "S", x: 6, y: 44 }]),
        keys: [{ x: 42, y: 60, w: 36, h: 16, label: "khe lẫy" }]
      },
      pinCount: 9
    },
    "6p": {
      id: "6p",
      name: "Modular 6P (\"RJ11/RJ12/RJ25\")",
      aka: ["RJ11", "RJ-11", "RJ12", "RJ14", "RJ25", "6P2C", "6P4C", "6P6C", "đầu thoại"],
      family: "telecom",
      standard: "IEC 60603-7 (modular); FCC Part 68 / USOC (tên RJ11, RJ14, RJ25)",
      summary: "Đầu modular 6 vị trí — điện thoại analog (RJ11 1 đường, RJ14 2 đường, RJ25 3 đường).",
      detail:
        "Hẹp hơn 8P8C (khoảng 9,6 mm so với 11,7 mm). Số tiếp điểm lắp thực tế khác nhau: 6P2C (RJ11), 6P4C (RJ14), 6P6C (RJ12/RJ25). " +
        "Phích 6P cắm được vào ổ 8P8C nhưng sẽ làm cong lò xo chân 1 và 8 của ổ — tránh làm.",
      genders: {
        male: { name: "Phích cắm (plug)", note: "Đầu dây điện thoại." },
        female: { name: "Ổ cắm (jack)", note: "Trên tường, máy điện thoại, modem ADSL." }
      },
      face: {
        outline: "rj",
        w: 96, h: 70,
        viewOf: "female",
        orientation: "Nhìn vào lỗ ổ cắm, khe lẫy ở DƯỚI: chân 1 bên TRÁI → chân 6 bên PHẢI (cùng quy ước với 8P8C).",
        pins: rjPins(6, 96, 18, 12, 16),
        keys: [{ x: 33, y: 52, w: 30, h: 14, label: "khe lẫy" }]
      },
      pinCount: 6
    },
    "bnc2": {
      id: "bnc2",
      name: "Cặp BNC 75 Ω (TX + RX)",
      aka: ["BNC", "đầu BNC E1", "coax E1", "75 ohm"],
      family: "telecom",
      standard: "IEC 61169-8 (BNC); ITU-T G.703 §9 (giao diện 2048 kbit/s đồng trục)",
      summary: "Hai đầu BNC rời: một cho chiều phát, một cho chiều thu — giao diện E1 không cân bằng 75 Ω.",
      detail:
        "Mỗi BNC có 2 \"chân\": lõi (tâm) và vỏ ngoài. Ở đây gộp 2 BNC thành một thân 4 chân để vẽ đủ một cổng E1. " +
        "BNC 75 Ω và 50 Ω cắm lẫn được nhưng khác trở kháng (lõi cái 75 Ω thường không có chất cách điện quanh tâm) — dùng 50 Ω cho E1 gây phản xạ.",
      genders: {
        male: { name: "Đầu đực (plug, có ống xoay khoá)", note: "Đầu cáp đồng trục." },
        female: { name: "Đầu cái (jack, có 2 chốt khoá)", note: "Trên thiết bị / DDF." }
      },
      face: {
        outline: "bnc",
        w: 140, h: 70,
        viewOf: "female",
        orientation:
          "Hình vẽ đặt BNC phát (TX) bên TRÁI, thu (RX) bên PHẢI để dễ đọc; trên thiết bị thật vị trí tuỳ hãng — luôn đọc nhãn TX/RX (hoặc OUT/IN) in cạnh đầu.",
        pins: [
          { pin: "TX", x: 35, y: 35 }, { pin: "TXS", x: 35, y: 10 },
          { pin: "RX", x: 105, y: 35 }, { pin: "RXS", x: 105, y: 10 }
        ]
      },
      pinCount: 4
    }
  });

  window.CONN_PINOUTS = Object.assign(window.CONN_PINOUTS || {}, {
    "eth-t568b": {
      id: "eth-t568b",
      body: "8p8c",
      name: "Ethernet bấm T568B",
      family: "telecom",
      standard: "TIA-568.2-D (màu T568B); IEEE 802.3 Cl.14/25/40 (10BASE-T, 100BASE-TX, 1000BASE-T); IEEE 802.3af/at/bt (PoE)",
      role: null,
      gender: "female",
      summary: "Thứ tự màu phổ biến nhất khi bấm cáp: cặp cam ở 1-2, cặp xanh lá ở 3-6.",
      detail:
        "T568A và T568B chỉ khác màu: đổi chỗ cặp cam và cặp xanh lá. Về điện hai kiểu như nhau — cáp thẳng chỉ cần HAI đầu cùng kiểu. " +
        "Tín hiệu hiển thị mặc định là 10/100BASE-TX phía MDI (card mạng); chọn biến thể để xem MDI-X, Gigabit, PoE. " +
        "Lỗi kinh điển \"split pair\": bấm 1-2-3-4-5-6-7-8 theo cặp liền (cam, xanh lá, xanh dương, nâu) — vẫn thông mạch nhưng chân 3 và 6 không cùng cặp xoắn, nhiễu xuyên kênh lớn, chạy chập chờn. " +
        "Gỡ xoắn không quá 13 mm ở đầu bấm (Cat 5e/6).",
      pins: ethPins(T568B),
      groups: [
        { name: "Cặp 2 (cam)", pins: ["1", "2"] }, { name: "Cặp 3 (xanh lá)", pins: ["3", "6"] },
        { name: "Cặp 1 (xanh dương)", pins: ["4", "5"] }, { name: "Cặp 4 (nâu)", pins: ["7", "8"] },
        { name: "Vỏ", pins: ["S"] }
      ],
      variants: ETH_VARIANTS
    },
    "eth-t568a": {
      id: "eth-t568a",
      body: "8p8c",
      name: "Ethernet bấm T568A",
      family: "telecom",
      standard: "TIA-568.2-D (màu T568A); IEEE 802.3 Cl.14/25/40; IEEE 802.3af/at/bt (PoE)",
      role: null,
      gender: "female",
      summary: "Thứ tự màu T568A: cặp xanh lá ở 1-2, cặp cam ở 3-6 — tương thích ngược với dây thoại USOC (cặp 1, 2 ở giữa).",
      detail:
        "Tín hiệu theo chân giống hệt T568B; chỉ màu dây khác. TIA-568 chấp nhận cả hai kiểu; thường được nói là TIA ưu tiên T568A cho lắp đặt mới " +
        "(CẦN KIỂM: chưa đối chiếu nguyên văn TIA-568.2-D), nhưng thực tế T568B phổ biến hơn. Một đầu A + một đầu B = cáp chéo 10/100.",
      pins: ethPins(T568A),
      groups: [
        { name: "Cặp 3 (xanh lá)", pins: ["1", "2"] }, { name: "Cặp 2 (cam)", pins: ["3", "6"] },
        { name: "Cặp 1 (xanh dương)", pins: ["4", "5"] }, { name: "Cặp 4 (nâu)", pins: ["7", "8"] },
        { name: "Vỏ", pins: ["S"] }
      ],
      variants: ETH_VARIANTS
    },
    "eth-gig-cross-b": {
      id: "eth-gig-cross-b",
      body: "8p8c",
      name: "Đầu b cáp chéo Gigabit (màu riêng, không phải T568A/B)",
      family: "telecom",
      standard: "IEEE 802.3 Cl.40.8 (chức năng chéo 1000BASE-T: A↔B, C↔D); màu suy ra từ đầu a bấm T568B (TIA-568.2-D)",
      role: null,
      gender: "female",
      summary: "Thứ tự màu khi bấm đầu thứ hai của cáp chéo Gigabit: như T568A nhưng cặp xanh dương và nâu đổi chỗ (4-5 nâu, 7-8 xanh dương).",
      detail:
        "Tách riêng để không dạy bấm sai: nếu bấm đầu này theo T568A thì cặp C/D không được đảo. " +
        "Thứ tự màu chân 1→8: trắng-xanh lá, xanh lá, trắng-cam, trắng-nâu, nâu, cam, xanh dương, trắng-xanh dương. " +
        "Chú ý chân 7 là xanh dương (đặc) và 8 là trắng-xanh dương: giữ đúng thứ tự này để dây đi từ chân 4 (xanh dương, BI_DC+) đầu a tới chân 7 (BI_DD+) đầu b — + tới +. " +
        "Tín hiệu theo chân giống mọi đầu 8P8C Ethernet; chỉ màu dây khác. Chỉ dùng cùng đầu a bấm T568B (cáp eth-crossover-1000).",
      pins: ethPins(GIG_CROSS_B),
      groups: [
        { name: "Cặp 3 (xanh lá)", pins: ["1", "2"] }, { name: "Cặp 2 (cam)", pins: ["3", "6"] },
        { name: "Cặp 4 (nâu)", pins: ["4", "5"] }, { name: "Cặp 1 (xanh dương)", pins: ["7", "8"] },
        { name: "Vỏ", pins: ["S"] }
      ],
      variants: ETH_VARIANTS
    },
    "e1-rj48c": {
      id: "e1-rj48c",
      body: "8p8c",
      name: "E1/T1 120 Ω trên RJ48C (phía thiết bị đầu cuối)",
      family: "telecom",
      standard: "FCC Part 68 / ANSI T1.403 (RJ48C); ITU-T G.703 §9 (E1 2048 kbit/s, cặp đối xứng 120 Ω)",
      role: "TE",
      gender: "female",
      summary: "Cổng E1/T1 đối xứng trên ổ 8P8C: thu ở 1-2, phát ở 4-5 (nhìn từ router/thiết bị khách hàng).",
      detail:
        "E1 cân bằng 120 Ω: mỗi chiều một cặp xoắn, mã HDB3, biên độ danh định 3 V đỉnh (G.703). " +
        "Quy ước chân: 1 = RX ring, 2 = RX tip, 4 = TX ring, 5 = TX tip — đúng cho router/thiết bị khách hàng (CPE, \"TE\") theo tài liệu Cisco và phần lớn hãng; " +
        "phía mạng (NT/NTU, smartjack) dùng cùng chân nhưng ĐẢO chiều (1-2 phát về CPE, 4-5 thu). Hai thiết bị cùng kiểu CPE nối nhau cần cáp chéo E1. " +
        "CẦN KIỂM: chân 3, 6 — có hãng nối màn chắn/đất, có hãng bỏ trống; đọc tài liệu thiết bị. " +
        "Nối sang BNC 75 Ω phải dùng balun (biến áp), không nối dây thẳng được.",
      pins: [
        { pin: "1", signal: "RX ring", name: "Receive Ring (R)", dir: "in", desc: "Thu, dây ring của cặp thu (cực tính trong cặp không quan trọng với HDB3 nhưng nên giữ đúng)." },
        { pin: "2", signal: "RX tip", name: "Receive Tip (T)", dir: "in", desc: "Thu, dây tip của cặp thu; xoắn với chân 1." },
        { pin: "3", signal: "RX shield", name: "Receive shield (tuỳ chọn)", dir: "shield", desc: "Màn chắn cặp thu hoặc bỏ trống — tuỳ hãng (CẦN KIỂM)." },
        { pin: "4", signal: "TX ring", name: "Transmit Ring (R1)", dir: "out", desc: "Phát, dây ring của cặp phát." },
        { pin: "5", signal: "TX tip", name: "Transmit Tip (T1)", dir: "out", desc: "Phát, dây tip; xoắn với chân 4 (đúng cặp giữa của 8P8C)." },
        { pin: "6", signal: "TX shield", name: "Transmit shield (tuỳ chọn)", dir: "shield", desc: "Màn chắn cặp phát hoặc bỏ trống — tuỳ hãng (CẦN KIỂM)." },
        { pin: "7", signal: "NC", name: "Không dùng", dir: "nc", desc: "Không dùng." },
        { pin: "8", signal: "NC", name: "Không dùng", dir: "nc", desc: "Không dùng." },
        { pin: "S", signal: "Shield", name: "Vỏ kim loại ổ", dir: "shield", desc: "Vỏ ổ bọc giáp (nếu có), nối đất khung." }
      ],
      groups: [
        { name: "Cặp thu", pins: ["1", "2"] }, { name: "Cặp phát", pins: ["4", "5"] },
        { name: "Màn chắn", pins: ["3", "6", "S"] }
      ],
      variants: [
        {
          id: "nt",
          name: "Phía mạng (NT/NTU, smartjack)",
          note: "Cùng chân, chiều ngược: NT phát về khách hàng ở 1-2 và thu ở 4-5. Vì vậy CPE ↔ NT nối cáp thẳng.",
          pins: {
            "1": { signal: "TX ring", dir: "out", desc: "NT phát về CPE (ring)." },
            "2": { signal: "TX tip", dir: "out", desc: "NT phát về CPE (tip)." },
            "4": { signal: "RX ring", dir: "in", desc: "NT thu từ CPE (ring)." },
            "5": { signal: "RX tip", dir: "in", desc: "NT thu từ CPE (tip)." }
          }
        }
      ]
    },
    "e1-bnc": {
      id: "e1-bnc",
      body: "bnc2",
      name: "E1 75 Ω không cân bằng (2 BNC)",
      family: "telecom",
      standard: "ITU-T G.703 §9 (2048 kbit/s, cặp đồng trục 75 Ω, biên độ danh định 2,37 V đỉnh)",
      role: "TE",
      gender: "female",
      summary: "Cổng E1 đồng trục: một BNC phát (TX/OUT), một BNC thu (RX/IN); lõi mang tín hiệu HDB3, vỏ là đất.",
      detail:
        "Theo G.703, vỏ ngoài cáp đồng trục nối đất ở cổng ra; ở cổng vào có thể nối đất hoặc không (tuỳ chọn, thường có cầu nối/jumper trên thiết bị). " +
        "Biên độ 2,37 V (75 Ω) thay vì 3 V (120 Ω). Đấu DDF: TX thiết bị này phải tới RX thiết bị kia — nhãn trên DDF thường ghi theo hướng thiết bị, dễ nhầm, kiểm bằng đèn LOS. " +
        "Chuyển sang 120 Ω RJ48C/cặp xoắn: cần balun.",
      pins: [
        { pin: "TX", signal: "TX", name: "Transmit (lõi BNC phát)", dir: "out", desc: "Lõi BNC phát, tín hiệu HDB3 ra." },
        { pin: "TXS", signal: "TX GND", name: "Vỏ BNC phát", dir: "gnd", desc: "Vỏ ngoài BNC phát, nối đất ở cổng ra (G.703)." },
        { pin: "RX", signal: "RX", name: "Receive (lõi BNC thu)", dir: "in", desc: "Lõi BNC thu, tín hiệu HDB3 vào." },
        { pin: "RXS", signal: "RX GND", name: "Vỏ BNC thu", dir: "gnd", desc: "Vỏ ngoài BNC thu; nối đất tuỳ chọn ở cổng vào." }
      ],
      groups: [{ name: "Phát", pins: ["TX", "TXS"] }, { name: "Thu", pins: ["RX", "RXS"] }]
    },
    "phone-rj11": {
      id: "phone-rj11",
      body: "6p",
      name: "Điện thoại analog RJ11 / RJ14 / RJ25 (USOC)",
      family: "telecom",
      standard: "USOC / FCC Part 68 Subpart F (RJ11C, RJ14C, RJ25C)",
      role: null,
      gender: "female",
      summary: "Đường dây 1 ở cặp giữa (3-4), đường 2 ở 2-5, đường 3 ở 1-6 — cặp lồng nhau từ trong ra ngoài.",
      detail:
        "Mỗi đường dây thuê bao là một cặp tip/ring, cấp ~48 V DC từ tổng đài (khi nhấc máy còn ~6–10 V), chuông ~75–90 V AC. " +
        "Cặp lồng nhau từ giữa ra (kiểu USOC) nên phích RJ11 cắm vào ổ RJ14/RJ25 vẫn nhận đường 1. " +
        "Màu dây theo USOC cũ: 3 đỏ (ring 1), 4 xanh lá (tip 1), 2 đen (tip 2), 5 vàng (ring 2), 1 trắng, 6 xanh dương. " +
        "Không tự ý chạm hai dây khi có chuông (điện áp cao).",
      pins: [
        { pin: "1", signal: "T3", name: "Tip đường 3", dir: "io", color: "trắng", pair: "3", desc: "Tip đường 3 (chỉ RJ25, 6P6C)." },
        { pin: "2", signal: "T2", name: "Tip đường 2", dir: "io", color: "đen", pair: "2", desc: "Tip đường 2 (RJ14, RJ25)." },
        { pin: "3", signal: "R1", name: "Ring đường 1", dir: "io", color: "đỏ", pair: "1", desc: "Ring đường 1 — RJ11 chỉ dùng chân 3 và 4." },
        { pin: "4", signal: "T1", name: "Tip đường 1", dir: "io", color: "xanh lá", pair: "1", desc: "Tip đường 1." },
        { pin: "5", signal: "R2", name: "Ring đường 2", dir: "io", color: "vàng", pair: "2", desc: "Ring đường 2 (RJ14, RJ25)." },
        { pin: "6", signal: "R3", name: "Ring đường 3", dir: "io", color: "xanh dương", pair: "3", desc: "Ring đường 3 (chỉ RJ25)." }
      ],
      groups: [
        { name: "Đường 1 (RJ11)", pins: ["3", "4"] }, { name: "Đường 2 (RJ14)", pins: ["2", "5"] },
        { name: "Đường 3 (RJ25)", pins: ["1", "6"] }
      ]
    }
  });

  const straight8 = (note) => ["1", "2", "3", "4", "5", "6", "7", "8"].map((p) => ({ a: p, b: p, note: note ? note(p) : undefined }));

  window.CONN_CABLES = (window.CONN_CABLES || []).concat([
    {
      id: "eth-straight",
      name: "Cáp mạng thẳng (straight-through) T568B ↔ T568B",
      family: "telecom",
      kind: "cable",
      a: { pinout: "eth-t568b", gender: "male", label: "Đầu 1 (vd. PC)" },
      b: { pinout: "eth-t568b", gender: "male", label: "Đầu 2 (vd. switch)" },
      wires: straight8((p) => `${T568B[p][0]} — chân ${p} sang chân ${p}`).concat([{ a: "S", b: "S", note: "vỏ – vỏ, qua dây thoát (drain) nếu là cáp bọc giáp" }]),
      use: "Nối thiết bị MDI (PC, router) với MDI-X (switch, hub); và mọi trường hợp khi cổng có Auto-MDI-X.",
      standard: "TIA-568.2-D",
      vendor: false,
      detail:
        "1-1 cả 8 chân, hai đầu cùng kiểu màu (B–B hoặc A–A). Phát ở chân 1-2 của PC tới chân 1-2 của switch — nơi switch (MDI-X) thu. " +
        "Kiểm bằng máy test: đèn 1…8 sáng lần lượt hai bên.",
      warnings: [
        "Một đầu A, một đầu B KHÔNG phải cáp thẳng — đó là cáp chéo 10/100.",
        "Nối liền cặp màu theo thứ tự 1-2-3-4-5-6-7-8 (split pair) vẫn thông mạch nhưng chạy kém."
      ]
    },
    {
      id: "eth-crossover-100",
      name: "Cáp mạng chéo 10/100 (T568B ↔ T568A)",
      family: "telecom",
      kind: "cable",
      a: { pinout: "eth-t568b", gender: "male", label: "Đầu T568B" },
      b: { pinout: "eth-t568a", gender: "male", label: "Đầu T568A" },
      wires: [
        { a: "1", b: "3", note: "trắng-cam: TD+ → RD+" },
        { a: "2", b: "6", note: "cam: TD− → RD−" },
        { a: "3", b: "1", note: "trắng-xanh lá: RD+ ← TD+" },
        { a: "6", b: "2", note: "xanh lá: RD− ← TD−" },
        { a: "4", b: "4", note: "xanh dương (không dùng ở 10/100)" },
        { a: "5", b: "5", note: "trắng-xanh dương" },
        { a: "7", b: "7", note: "trắng-nâu" },
        { a: "8", b: "8", note: "nâu" },
        { a: "S", b: "S", note: "vỏ – vỏ" }
      ],
      use: "Nối hai thiết bị cùng loại MDI–MDI (PC–PC, router–router) hoặc MDI-X–MDI-X (switch–switch) khi cổng không có Auto-MDI-X.",
      standard: "TIA-568.2-D (màu); IEEE 802.3 Cl.14/25 (MDI/MDI-X)",
      vendor: false,
      detail:
        "Bấm một đầu T568B, đầu kia T568A — theo màu là dây nối thẳng, theo số chân là 1↔3, 2↔6. Chỉ đảo cặp phát/thu của 10/100; " +
        "hai cặp xanh dương, nâu đi thẳng nên với Gigabit cặp C/D không được đảo (thường vẫn chạy vì PHY 1000BASE-T tự nhận đảo cặp/cực tính — CẦN KIỂM mức bắt buộc trong IEEE 802.3 Cl.40; xem cáp chéo 1000).",
      warnings: ["Hầu hết thiết bị từ khoảng 2005 có Auto-MDI-X — cáp thẳng là đủ; chỉ chế cáp chéo cho thiết bị cũ."]
    },
    {
      id: "eth-crossover-1000",
      name: "Cáp mạng chéo Gigabit (đảo cả 4 cặp)",
      family: "telecom",
      kind: "cable",
      a: { pinout: "eth-t568b", gender: "male", label: "Đầu T568B" },
      b: { pinout: "eth-gig-cross-b", gender: "male", label: "Đầu chéo Gigabit (màu riêng: T568A với cặp xanh dương ↔ nâu đổi chỗ)" },
      wires: [
        { a: "1", b: "3", note: "trắng-cam: BI_DA+ → BI_DB+" },
        { a: "2", b: "6", note: "cam: BI_DA− → BI_DB−" },
        { a: "3", b: "1", note: "trắng-xanh lá: BI_DB+ → BI_DA+" },
        { a: "6", b: "2", note: "xanh lá: BI_DB− → BI_DA−" },
        { a: "4", b: "7", note: "xanh dương: BI_DC+ → BI_DD+ (đầu b: chân 7)" },
        { a: "5", b: "8", note: "trắng-xanh dương: BI_DC− → BI_DD− (đầu b: chân 8)" },
        { a: "7", b: "4", note: "trắng-nâu: BI_DD+ → BI_DC+ (đầu b: chân 4)" },
        { a: "8", b: "5", note: "nâu: BI_DD− → BI_DC− (đầu b: chân 5)" },
        { a: "S", b: "S", note: "vỏ – vỏ" }
      ],
      use: "Cáp chéo đầy đủ cho 1000BASE-T giữa hai cổng cùng loại không có Auto-MDI-X (hiếm).",
      standard: "IEEE 802.3 Cl.40.8 (MDI/MDI-X 1000BASE-T: A↔B, C↔D)",
      vendor: false,
      detail:
        "Đầu b dùng sơ đồ riêng eth-gig-cross-b (không phải T568A): 1 trắng-xanh lá, 2 xanh lá, 3 trắng-cam, 4 trắng-nâu, 5 nâu, 6 cam, 7 xanh dương, 8 trắng-xanh dương. " +
        "Kiểm bằng lời: cặp A đầu a (1-2) tới cặp B đầu b (3-6) và ngược lại; cặp C (4-5) tới cặp D (7-8) và ngược lại; + tới +, − tới −. " +
        "Thực tế PHY 1000BASE-T thường tự nhận đảo cặp/cực tính (CẦN KIỂM mức bắt buộc trong IEEE 802.3 Cl.40) và Auto-MDI-X là tuỳ chọn phổ biến, " +
        "nên cáp này chủ yếu có giá trị học tập.",
      warnings: ["Màu đầu b khác cả T568A lẫn T568B — đánh dấu cáp để khỏi bị dùng nhầm làm cáp thẳng."]
    },
    {
      id: "e1-rj48c-cross",
      name: "Cáp chéo E1 RJ48C (1↔4, 2↔5)",
      family: "telecom",
      kind: "cable",
      a: { pinout: "e1-rj48c", gender: "male", label: "Thiết bị E1 thứ nhất (CPE)" },
      b: { pinout: "e1-rj48c", gender: "male", label: "Thiết bị E1 thứ hai (CPE)" },
      wires: [
        { a: "1", b: "4", note: "RX ring ← TX ring" },
        { a: "2", b: "5", note: "RX tip ← TX tip" },
        { a: "4", b: "1", note: "TX ring → RX ring" },
        { a: "5", b: "2", note: "TX tip → RX tip" }
      ],
      use: "Nối trực tiếp hai router/thiết bị E1 cùng kiểu CPE (back-to-back, phòng lab), không qua NTU.",
      standard: "Thực hành phổ biến (Cisco: \"T1/E1 crossover cable\"); chân theo RJ48C",
      vendor: false,
      detail:
        "Mỗi cặp phát (4-5) tới cặp thu (1-2) đầu kia, giữ tip–tip, ring–ring. Dùng cặp xoắn: 1-2 một cặp, 4-5 một cặp — nếu bấm bằng cáp mạng T568B thì 1-2 là cặp cam, 4-5 là cặp xanh dương. " +
        "Một bên phải cấp clock (clock source internal), bên kia lấy clock từ đường (line).",
      warnings: ["Cáp chéo Ethernet (1↔3, 2↔6) KHÔNG dùng được cho E1."]
    },
    {
      id: "e1-rj48c-loopback",
      name: "Nút loopback E1 RJ48C",
      family: "telecom",
      kind: "loopback",
      a: { pinout: "e1-rj48c", gender: "male", label: "Phích cắm vào cổng E1" },
      wires: [
        { a: "4", a2: "1", note: "TX ring → RX ring" },
        { a: "5", a2: "2", note: "TX tip → RX tip" }
      ],
      use: "Kiểm cổng E1/T1 của router: cắm vào, cổng phải lên (không LOS) và nhận lại chính khung mình phát.",
      standard: "Thực hành phổ biến (Cisco T1/E1 loopback plug)",
      vendor: false,
      detail: "Một phích 8P8C, hai đoạn dây ngắn: 1↔4 và 2↔5. Đặt clock source internal khi test, vì không có đầu xa cấp clock.",
      warnings: ["Không cắm nhầm nút loopback E1 vào cổng Ethernet PoE."]
    },
    {
      id: "e1-bnc-loopback",
      name: "Loopback E1 BNC (TX → RX)",
      family: "telecom",
      kind: "loopback",
      a: { pinout: "e1-bnc", gender: "male", label: "Đoạn coax 75 Ω, 2 đầu BNC đực" },
      wires: [
        { a: "TX", a2: "RX", note: "lõi TX → lõi RX" },
        { a: "TXS", a2: "RXS", note: "vỏ – vỏ (vỏ cáp đồng trục)" }
      ],
      use: "Kiểm cổng E1 75 Ω hoặc vòng lặp tại DDF: một đoạn cáp đồng trục ngắn nối thẳng BNC TX sang BNC RX.",
      standard: "ITU-T G.703 §9 (giao diện); thực hành vòng lặp tại DDF",
      vendor: false,
      detail: "Thường là một sợi coax 75 Ω ngắn hai đầu BNC đực, hoặc thanh nối U trên DDF. Đặt clock internal khi test.",
      warnings: ["Dùng cáp 75 Ω (RG-59, RG-179…), không dùng cáp 50 Ω RG-58."]
    },
    {
      id: "e1-balun",
      name: "Balun E1 120 Ω (RJ48C) ↔ 75 Ω (BNC)",
      family: "telecom",
      kind: "balun",
      a: { pinout: "e1-rj48c", gender: "male", label: "Phía 120 Ω (cắm vào cổng RJ48C của router)" },
      b: { pinout: "e1-bnc", gender: "female", label: "Phía 75 Ω (nối cáp coax tới DDF)" },
      wires: [
        { a: "4", b: "TXS", note: "TX ring → cuộn sơ cấp biến áp phát → vỏ BNC TX" },
        { a: "5", b: "TX", note: "TX tip → cuộn sơ cấp biến áp phát → lõi BNC TX" },
        { a: "1", b: "RXS", note: "RX ring ← cuộn biến áp thu ← vỏ BNC RX" },
        { a: "2", b: "RX", note: "RX tip ← cuộn biến áp thu ← lõi BNC RX" }
      ],
      components: [
        { type: "transformer", value: "1,26 : 1 (120 Ω : 75 Ω)", between: ["a:5", "b:TX"], note: "Biến áp chiều phát: cân bằng 120 Ω ↔ không cân bằng 75 Ω; tỉ số vòng √(120/75) ≈ 1,26" },
        { type: "transformer", value: "1,26 : 1 (120 Ω : 75 Ω)", between: ["a:2", "b:RX"], note: "Biến áp chiều thu, giống chiều phát" }
      ],
      use: "Nối cổng E1 120 Ω (RJ48C trên router) vào DDF/thiết bị truyền dẫn E1 75 Ω (BNC).",
      standard: "ITU-T G.703 §9 (120 Ω và 75 Ω); sơ đồ balun theo thực hành hãng",
      vendor: false,
      detail:
        "Biến áp vừa chuyển trở kháng vừa chuyển cân bằng ↔ không cân bằng; dây nối hai phía KHÔNG thông mạch một chiều (cách ly galvanic). " +
        "Balun đi thẳng chiều: TX của router ra BNC TX của balun; tới DDF phải nối BNC TX balun vào RX của thiết bị truyền dẫn. " +
        "CẦN KIỂM: cực tính tip/ring ↔ lõi/vỏ khác nhau giữa các hãng balun; HDB3 không phụ thuộc cực tính nên vẫn chạy.",
      warnings: ["Không nối dây thẳng RJ48C sang BNC không qua biến áp: lệch trở kháng và nối đất một dây của cặp cân bằng."]
    }
  ]);
})();
