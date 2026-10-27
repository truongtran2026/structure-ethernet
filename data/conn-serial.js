// Mảng Đấu nối — Nối tiếp/console: thân DE-9, DB-25, M/34 (V.35), cầu đấu 3 chân;
// sơ đồ chân RS-232 (DE-9, DB-25 DTE/DCE), console RJ45 Cisco và EIA/TIA-561, V.35, RS-485 2 dây;
// cáp null-modem, nối dài, đầu chuyển 9-25, cáp modem, loopback, rollover, đầu chuyển console.
// Thân 8p8c (RJ45) định nghĩa trong data/conn-telecom.js.
// Schema: .claude/skills/connector-pinout-spec/references/connector-schema.md
(function () {
  // D-sub nhìn MẶT CẮM ĐẦU ĐỰC, cạnh dài hình thang ở TRÊN: hàng trên đánh số trái → phải,
  // hàng dưới tiếp theo trái → phải; hàng dưới lệch nửa bước (so le).
  const dsubPins = (top, bottom, x0, step, y1, y2) =>
    Array.from({ length: top }, (_, i) => ({ pin: String(i + 1), x: x0 + i * step, y: y1 }))
      .concat(Array.from({ length: bottom }, (_, i) => ({ pin: String(top + i + 1), x: x0 + step / 2 + i * step, y: y2 })));

  // M/34: các hàng chữ cái như hình in phổ biến của khối Winchester MRAC-34 (CẦN KIỂM với ISO 2593).
  const M34_ROWS = [
    ["A", "B"], ["C", "D", "E", "F"], ["H", "J", "K", "L", "M"], ["N", "P", "R", "S", "T"],
    ["U", "V", "W", "X", "Y"], ["Z", "AA", "BB", "CC", "DD"], ["EE", "FF", "HH", "JJ"], ["KK", "LL", "MM", "NN"]
  ];
  const m34Pins = [];
  M34_ROWS.forEach((row, r) =>
    row.forEach((p, j) => m34Pins.push({ pin: p, x: 90 + (j - (row.length - 1) / 2) * 30, y: 16 + r * 22 })));

  const DSUB_GENDERS = {
    male: { name: "Đầu đực (chân cắm, plug)", note: "Có chân kim. Cổng COM trên PC là đầu đực DE-9." },
    female: { name: "Đầu cái (lỗ cắm, socket)", note: "Có lỗ. Modem DB-25 và đầu cáp cắm vào PC thường là đầu cái." }
  };

  window.CONN_BODIES = Object.assign(window.CONN_BODIES || {}, {
    "de9": {
      id: "de9",
      name: "D-sub 9 chân (DE-9)",
      aka: ["DB9", "DB-9", "DE9", "D-sub 9", "cổng COM", "COM 9 chân", "RS232 9 chân"],
      family: "serial",
      standard: "IEC 60807-3 / MIL-DTL-24308 (thân D-sub); TIA-574 (dùng cho RS-232)",
      summary: "Thân D-sub vỏ cỡ E, 9 chân hai hàng 5/4 — cổng COM của PC, console nhiều thiết bị.",
      detail:
        "Tên đúng là DE-9: chữ thứ hai chỉ cỡ vỏ (E). \"DB9\" là tên gọi sai nhưng phổ biến — vỏ B là cỡ của DB-25. " +
        "Vỏ hình thang để không cắm ngược. Hàng trên 5 chân, hàng dưới 4 chân, so le. " +
        "Khoá bằng vít 4-40 UNC. Chân hàn hoặc bấm IDC; khi hàn luôn nhìn số in nhỏ cạnh từng chân ở mặt sau.",
      genders: DSUB_GENDERS,
      face: {
        outline: "dsub",
        shell: "E",
        w: 130, h: 54,
        viewOf: "male",
        orientation:
          "Nhìn thẳng vào MẶT CẮM của đầu ĐỰC, cạnh dài hình thang ở TRÊN: hàng trên 1-2-3-4-5 từ trái sang phải, hàng dưới 6-7-8-9 từ trái sang phải. " +
          "Đầu cái nhìn mặt cắm (hoặc đầu đực nhìn từ phía hàn) là ảnh gương: 5-4-3-2-1 / 9-8-7-6.",
        pins: dsubPins(5, 4, 25, 20, 18, 36).concat([{ pin: "S", x: 4, y: 27 }])
      },
      pinCount: 10
    },
    "db25": {
      id: "db25",
      name: "D-sub 25 chân (DB-25)",
      aka: ["DB25", "DB-25", "D-sub 25", "cổng COM 25 chân", "cổng máy in LPT"],
      family: "serial",
      standard: "IEC 60807-3 / MIL-DTL-24308 (thân D-sub); TIA-232-F (gán chân RS-232)",
      summary: "Thân D-sub vỏ cỡ B, 25 chân hai hàng 13/12 — RS-232 gốc, modem, cổng máy in song song.",
      detail:
        "Đây là đầu nối RS-232 gốc của TIA-232; DE-9 ra đời sau (PC/AT) và chỉ giữ 9 tín hiệu. " +
        "Cùng thân DB-25 cái trên PC cũ là cổng máy in song song (LPT, IEEE 1284) — KHÔNG phải RS-232; cắm nhầm thiết bị nối tiếp vào sẽ không chạy (có thể hỏng nếu mức ±12 V).",
      genders: DSUB_GENDERS,
      face: {
        outline: "dsub",
        shell: "B",
        w: 300, h: 54,
        viewOf: "male",
        orientation:
          "Nhìn thẳng vào MẶT CẮM của đầu ĐỰC, cạnh dài ở TRÊN: hàng trên 1→13 từ trái sang phải, hàng dưới 14→25 từ trái sang phải. " +
          "Đầu cái nhìn mặt cắm là ảnh gương: 13→1 / 25→14.",
        pins: dsubPins(13, 12, 18, 22, 18, 36).concat([{ pin: "S", x: 4, y: 27 }])
      },
      pinCount: 26
    },
    "m34": {
      id: "m34",
      name: "Winchester M/34 (V.35)",
      aka: ["M34", "M/34", "MRAC-34", "Winchester", "đầu V.35", "ISO 2593"],
      family: "serial",
      standard: "ISO 2593 (đầu nối 34 chân cho V.35)",
      summary: "Khối đầu nối chữ nhật to, 34 chân đặt tên bằng chữ cái, hai vít khoá lớn — giao diện V.35 của modem/CSU-DSU.",
      detail:
        "Chân đặt tên bằng chữ cái A…Z rồi AA…NN, bỏ các chữ dễ nhầm (G, I, O, Q; GG, II). " +
        "Đầu DTE (cáp từ router) thường là ĐỰC, cổng trên modem/DCE là CÁI. Router thường có cổng nén (Cisco 60 chân, Smart Serial) và cáp chuyển ra M/34. " +
        "CẦN KIỂM: vị trí các hàng chữ cái trên mặt cắm vẽ theo hình in phổ biến (A-B / C-F / H-M / N-T / U-Y / Z-DD / EE-JJ / KK-NN), chưa đối chiếu được hình gốc ISO 2593; " +
        "khi hàn hãy đọc chữ in nổi trên khối nhựa.",
      genders: {
        male: { name: "Đầu đực (chân cắm)", note: "Thường ở đầu cáp phía DTE (router)." },
        female: { name: "Đầu cái (lỗ cắm)", note: "Thường trên modem/CSU-DSU (DCE)." }
      },
      face: {
        outline: "m34",
        w: 180, h: 180,
        viewOf: "male",
        orientation:
          "Nhìn MẶT CẮM đầu ĐỰC, hàng A-B ở TRÊN: mỗi hàng đọc chữ cái từ trái sang phải. Đầu cái nhìn mặt cắm là ảnh gương. " +
          "CẦN KIỂM: bố trí hàng theo hình in phổ biến, chưa đối chiếu hình gốc ISO 2593.",
        pins: m34Pins
      },
      pinCount: 34
    },
    "term3": {
      id: "term3",
      name: "Cầu đấu vít 3 chân (RS-485 2 dây)",
      aka: ["terminal block", "cầu đấu", "domino", "Phoenix", "RS485 3 chân"],
      family: "serial",
      standard: "IEC 60947-7-1 (cầu đấu); gán chân theo nhãn in trên thiết bị",
      summary: "Cầu đấu vít (thường loại cắm rút) 3 vị trí: A, B, đất — giao diện RS-485 hay gặp trên PLC, đồng hồ đo, camera PTZ.",
      detail:
        "Không có chuẩn gán chân chung cho cầu đấu; thứ tự A-B-GND ở đây là phổ biến nhất, nhưng phải đọc nhãn in cạnh vít. " +
        "Loại cắm rút (pluggable) gồm header chân trên bo mạch và phích có vít kẹp dây.",
      genders: {
        male: { name: "Header trên bo mạch (chân cắm)", note: "Phần hàn trên thiết bị." },
        female: { name: "Phích cầu đấu có vít (kẹp dây)", note: "Phần rút ra để đấu dây." }
      },
      face: {
        outline: "terminal",
        w: 100, h: 40,
        viewOf: "female",
        orientation: "Nhìn từ phía luồn dây (miệng kẹp), vít ở trên: vị trí 1 bên TRÁI. Thứ tự in trên thiết bị có thể khác — đọc nhãn.",
        pins: [{ pin: "1", x: 20, y: 22 }, { pin: "2", x: 50, y: 22 }, { pin: "3", x: 80, y: 22 }]
      },
      pinCount: 3
    }
  });

  // --- RS-232 ---
  // [chân, signal, name, dir DTE, v24, desc]
  const DE9 = [
    ["1", "DCD", "Data Carrier Detect", "in", "109", "DCE (modem) báo đã bắt được sóng mang từ đầu xa."],
    ["2", "RXD", "Received Data", "in", "104", "Dữ liệu thu từ DCE. Ở DE-9 chân 2 là THU (ngược DB-25)."],
    ["3", "TXD", "Transmitted Data", "out", "103", "Dữ liệu phát ra DCE. Lúc nghỉ ở mức MARK (−3…−15 V)."],
    ["4", "DTR", "Data Terminal Ready", "out", "108/2", "DTE báo đã sẵn sàng; nhiều thiết bị dùng làm nguồn nuôi nhỏ."],
    ["5", "GND", "Signal Ground", "gnd", "102", "Đất tín hiệu chung — mọi mức điện so với chân này. Luôn phải nối."],
    ["6", "DSR", "Data Set Ready", "in", "107", "DCE báo đã sẵn sàng (bật nguồn, ở chế độ dữ liệu)."],
    ["7", "RTS", "Request To Send", "out", "105", "DTE xin phát; ở bắt tay phần cứng hiện đại nghĩa là \"DTE sẵn sàng nhận\" (RTR, mạch 133)."],
    ["8", "CTS", "Clear To Send", "in", "106", "DCE cho phép DTE phát (bắt tay phần cứng RTS/CTS)."],
    ["9", "RI", "Ring Indicator", "in", "125", "Modem báo có chuông gọi đến."],
    ["S", "Shield", "Vỏ kim loại", "shield", "101", "Vỏ D-sub; nối màn chắn cáp và đất khung (TIA-574 không có chân đất bảo vệ riêng)."]
  ];
  const DB25 = [
    ["1", "Shield", "Shield / Protective Ground", "shield", "101", "Màn chắn, đất bảo vệ (khung máy). Không dùng làm đất tín hiệu."],
    ["2", "TXD", "Transmitted Data", "out", "103", "Dữ liệu phát. Ở DB-25 chân 2 là PHÁT (ngược DE-9)."],
    ["3", "RXD", "Received Data", "in", "104", "Dữ liệu thu."],
    ["4", "RTS", "Request To Send", "out", "105", "Xin phát / sẵn sàng nhận (RTR 133)."],
    ["5", "CTS", "Clear To Send", "in", "106", "Cho phép phát."],
    ["6", "DSR", "DCE Ready (Data Set Ready)", "in", "107", "DCE sẵn sàng."],
    ["7", "GND", "Signal Ground", "gnd", "102", "Đất tín hiệu chung."],
    ["8", "DCD", "Received Line Signal Detector (DCD)", "in", "109", "Phát hiện sóng mang."],
    ["9", "+V test", "Reserved for testing (+)", "nc", "—", "Dành cho thử nghiệm (+ điện áp); không nối khi chế cáp."],
    ["10", "−V test", "Reserved for testing (−)", "nc", "—", "Dành cho thử nghiệm (− điện áp); không nối."],
    ["11", "(chưa gán)", "Unassigned", "nc", "—", "Chưa gán trong TIA-232-F (một số hãng dùng riêng)."],
    ["12", "SDCD", "Secondary Received Line Signal Detector / Data Signal Rate Selector (DCE)", "in", "122/112", "DCD kênh phụ; hoặc DCE báo tốc độ."],
    ["13", "SCTS", "Secondary Clear To Send", "in", "121", "CTS kênh phụ (kênh tốc độ thấp)."],
    ["14", "STXD", "Secondary Transmitted Data", "out", "118", "Dữ liệu phát kênh phụ."],
    ["15", "TC", "Transmitter Signal Element Timing (DCE source)", "in", "114", "Xung nhịp phát do DCE cấp (chế độ đồng bộ)."],
    ["16", "SRXD", "Secondary Received Data", "in", "119", "Dữ liệu thu kênh phụ."],
    ["17", "RC", "Receiver Signal Element Timing (DCE source)", "in", "115", "Xung nhịp thu do DCE cấp."],
    ["18", "LL", "Local Loopback", "out", "141", "DTE yêu cầu modem vòng lặp nội bộ."],
    ["19", "SRTS", "Secondary Request To Send", "out", "120", "RTS kênh phụ."],
    ["20", "DTR", "Data Terminal Ready", "out", "108/2", "DTE sẵn sàng."],
    ["21", "RL / SQ", "Remote Loopback / Signal Quality Detector", "out", "140/110", "DTE yêu cầu vòng lặp ở modem xa (140); bản cũ: DCE báo chất lượng tín hiệu (110, chiều vào)."],
    ["22", "RI", "Ring Indicator", "in", "125", "Báo chuông."],
    ["23", "DRS", "Data Signal Rate Selector (DTE/DCE)", "out", "111/112", "Chọn tốc độ (DTE → 111) hoặc DCE báo tốc độ (112)."],
    ["24", "TCE", "Transmitter Signal Element Timing (DTE source)", "out", "113", "Xung nhịp phát do DTE cấp (SCTE)."],
    ["25", "TM", "Test Mode", "in", "142", "DCE báo đang ở chế độ thử."],
    ["S", "Shell", "Vỏ kim loại", "shield", "—", "Vỏ D-sub, thường nối với chân 1."]
  ];
  const flip = (d) => (d === "in" ? "out" : d === "out" ? "in" : d);
  const mk = (rows, asDce) =>
    rows.map(([pin, signal, name, dir, v24, desc]) => ({ pin, signal, name, dir: asDce ? flip(dir) : dir, v24, desc }));

  const RS232_LEVEL =
    "Mức điện V.28/TIA-232: logic 1 (MARK) = −3…−15 V, logic 0 (SPACE) = +3…+15 V; cổng thường ±5…±12 V. " +
    "Tốc độ đến 20 kbit/s theo chuẩn (thực tế 115,2 kbit/s), cáp ~15 m. ";
  const NO_IC =
    "Không chế bằng dây được (cần IC): USB↔RS-232 (FTDI, CH340, PL2303 + MAX3232), RS-232↔mức TTL 3,3/5 V (MAX232/MAX3232), RS-232↔RS-485.";

  window.CONN_PINOUTS = Object.assign(window.CONN_PINOUTS || {}, {
    "rs232-de9": {
      id: "rs232-de9",
      body: "de9",
      name: "RS-232 trên DE-9 (DTE, cổng COM PC)",
      family: "serial",
      standard: "TIA-574 (gán chân DE-9); TIA-232-F / ITU-T V.24 (mạch), V.28 (mức điện)",
      role: "DTE",
      gender: "male",
      summary: "Cổng COM 9 chân: 2 = RXD (thu), 3 = TXD (phát), 5 = GND — đực trên PC.",
      detail:
        RS232_LEVEL +
        "Ba dây tối thiểu: TXD, RXD, GND. Các chân bắt tay (RTS/CTS, DTR/DSR/DCD) cần nối hoặc cầu giả khi phần mềm bật flow control. " +
        "Thiết bị đóng vai DCE trên DE-9 (modem ngoài 9 chân, một số UPS) dùng cùng số chân nhưng đảo chiều — thường là đầu cái. " +
        NO_IC,
      pins: mk(DE9, false),
      groups: [
        { name: "Dữ liệu", pins: ["2", "3"] }, { name: "Điều khiển", pins: ["1", "4", "6", "7", "8", "9"] },
        { name: "Đất", pins: ["5", "S"] }
      ]
    },
    "rs232-db25-dte": {
      id: "rs232-db25-dte",
      body: "db25",
      name: "RS-232 trên DB-25 (DTE: máy tính, terminal)",
      family: "serial",
      standard: "TIA-232-F §3 (gán chân DB-25); ITU-T V.24, V.28",
      role: "DTE",
      gender: "male",
      summary: "RS-232 gốc 25 chân phía DTE: 2 = TXD, 3 = RXD, 7 = GND, 20 = DTR; có kênh phụ và xung nhịp đồng bộ.",
      detail:
        RS232_LEVEL +
        "Phần lớn thiết bị chỉ dùng 2-3-4-5-6-7-8-20-22. Chân 15, 17, 24 là xung nhịp cho modem đồng bộ (dạng tiền thân của V.35). " +
        "Tên tín hiệu luôn đặt theo góc nhìn DTE: TXD là dữ liệu DTE phát, kể cả khi đo ở phía modem. " +
        NO_IC,
      pins: mk(DB25, false),
      groups: [
        { name: "Dữ liệu", pins: ["2", "3"] }, { name: "Điều khiển", pins: ["4", "5", "6", "8", "20", "22"] },
        { name: "Xung nhịp", pins: ["15", "17", "24"] }, { name: "Kênh phụ", pins: ["12", "13", "14", "16", "19"] },
        { name: "Thử nghiệm", pins: ["18", "21", "23", "25"] }, { name: "Đất", pins: ["1", "7", "S"] },
        { name: "Không dùng", pins: ["9", "10", "11"] }
      ]
    },
    "rs232-db25-dce": {
      id: "rs232-db25-dce",
      body: "db25",
      name: "RS-232 trên DB-25 (DCE: modem)",
      family: "serial",
      standard: "TIA-232-F §3 (gán chân DB-25); ITU-T V.24, V.28",
      role: "DCE",
      gender: "female",
      summary: "Cùng số chân với DTE nhưng chiều ngược: modem THU dữ liệu ở chân 2 (TXD) và PHÁT ở chân 3 (RXD).",
      detail:
        "Chuẩn thiết kế để DTE ↔ DCE nối cáp thẳng 1-1: chân 2 của PC (phát) tới chân 2 của modem (nhận). " +
        "Vì tên tín hiệu theo góc nhìn DTE, ở phía modem chân TXD là ĐẦU VÀO — đừng sửa nhãn. Cổng modem thường là đầu cái. " +
        RS232_LEVEL,
      pins: mk(DB25, true),
      groups: [
        { name: "Dữ liệu", pins: ["2", "3"] }, { name: "Điều khiển", pins: ["4", "5", "6", "8", "20", "22"] },
        { name: "Xung nhịp", pins: ["15", "17", "24"] }, { name: "Kênh phụ", pins: ["12", "13", "14", "16", "19"] },
        { name: "Thử nghiệm", pins: ["18", "21", "23", "25"] }, { name: "Đất", pins: ["1", "7", "S"] },
        { name: "Không dùng", pins: ["9", "10", "11"] }
      ]
    },
    "rs232-rj45-cisco": {
      id: "rs232-rj45-cisco",
      body: "8p8c",
      name: "Console RJ45 kiểu Cisco",
      family: "serial",
      standard: "Tài liệu Cisco (console port RJ-45, \"Cabling Guide for Console and AUX Ports\"); đối xứng giống ý tưởng Yost nhưng khác sơ đồ chân; mức điện TIA-232",
      role: "DTE",
      gender: "female",
      summary: "Cổng console RJ45 trên router/switch Cisco: 3 = TXD, 6 = RXD, 4-5 = GND; dùng cáp rollover tới PC.",
      detail:
        "Đây là sơ đồ của hãng, KHÔNG phải EIA/TIA-561: chân đối xứng qua giữa (1↔8 là RTS↔CTS, 2↔7 là DTR↔DSR, 3↔6 là TXD↔RXD, 4-5 GND), " +
        "nên cáp rollover (đảo 1↔8) nối hai cổng kiểu này thành null-modem. Ý tưởng đối xứng giống Yost nhưng KHÁC sơ đồ chân: " +
        "Yost DTE là 1 CTS, 2 DCD, 3 RD, 4-5 SG, 6 TD, 7 DTR, 8 RTS (yost.com) — Cisco là ảnh đảo 1↔8 của nó và dùng DSR thay DCD. " +
        "Cấu hình mặc định 9600 8N1, không flow control. Nhiều hãng khác dùng cùng sơ đồ (Juniper, Aruba…), nhưng một số (APC, một số Fortinet cũ) khác — đọc tài liệu. " +
        "Cisco không có DCD trên RJ45; cổng AUX dùng chân 7 cho DSR/DCD tuỳ đời máy (CẦN KIỂM theo model). " +
        NO_IC,
      pins: [
        { pin: "1", signal: "RTS", name: "Request To Send", dir: "out", v24: "105", desc: "Xin phát / sẵn sàng nhận." },
        { pin: "2", signal: "DTR", name: "Data Terminal Ready", dir: "out", v24: "108/2", desc: "Thiết bị Cisco báo sẵn sàng." },
        { pin: "3", signal: "TXD", name: "Transmitted Data", dir: "out", v24: "103", desc: "Router phát dữ liệu ra console." },
        { pin: "4", signal: "GND", name: "Signal Ground", dir: "gnd", v24: "102", desc: "Đất tín hiệu." },
        { pin: "5", signal: "GND", name: "Signal Ground", dir: "gnd", v24: "102", desc: "Đất tín hiệu (hai chân giữa cùng là đất)." },
        { pin: "6", signal: "RXD", name: "Received Data", dir: "in", v24: "104", desc: "Router nhận lệnh gõ từ terminal." },
        { pin: "7", signal: "DSR", name: "Data Set Ready", dir: "in", v24: "107", desc: "Terminal báo sẵn sàng." },
        { pin: "8", signal: "CTS", name: "Clear To Send", dir: "in", v24: "106", desc: "Cho phép phát." },
        { pin: "S", signal: "(không dùng)", name: "Vỏ ổ", dir: "nc", desc: "Ổ console thường bằng nhựa, không có vỏ chống nhiễu." }
      ],
      groups: [
        { name: "Dữ liệu", pins: ["3", "6"] }, { name: "Điều khiển", pins: ["1", "2", "7", "8"] }, { name: "Đất", pins: ["4", "5"] }
      ]
    },
    "rs232-rj45-cisco-adapter": {
      id: "rs232-rj45-cisco-adapter",
      body: "8p8c",
      name: "Ổ RJ45 của đầu chuyển console (sau cáp rollover, nhãn theo phía PC)",
      family: "serial",
      standard: "Tài liệu Cisco (RJ-45-to-DB-9 / RJ-45-to-DB-25 terminal adapter, dùng với cáp rollover); mức điện TIA-232",
      role: "DTE",
      gender: "female",
      summary: "Ổ RJ45 trên đầu chuyển RJ45-DB9/DB25: nhãn là tín hiệu của PC/terminal — 3 = TXD (PC phát), 6 = RXD (PC thu), 4-5 = GND.",
      detail:
        "Tách riêng khỏi sơ đồ cổng console (rs232-rj45-cisco) để tránh nhầm: tín hiệu tới ổ này đã đi qua cáp rollover (đảo 1↔8), " +
        "nên chân n của ổ nối với chân 9−n của cổng console router. Ghi nhãn theo phía PC thì mỗi chân của ổ đi thẳng sang chân CÙNG TÊN ở DE-9/DB-25 — " +
        "đầu chuyển chỉ là 'cổng COM của PC đổi sang RJ45'. Ví dụ chân 8 = CTS của PC, mang RTS của router (router chân 1 → rollover → chân 8). " +
        "Vì sơ đồ Cisco đối xứng, tên chân ở đây trùng với tên chân cổng console, nhưng ý nghĩa là phía PC. " +
        NO_IC,
      pins: [
        { pin: "1", signal: "RTS", name: "Request To Send (PC)", dir: "out", v24: "105", desc: "RTS của PC → qua rollover tới chân 8 (CTS) của router." },
        { pin: "2", signal: "DTR", name: "Data Terminal Ready (PC)", dir: "out", v24: "108/2", desc: "DTR của PC → qua rollover tới chân 7 (DSR) của router." },
        { pin: "3", signal: "TXD", name: "Transmitted Data (PC)", dir: "out", v24: "103", desc: "PC phát → qua rollover tới chân 6 (RXD) của router." },
        { pin: "4", signal: "GND", name: "Signal Ground", dir: "gnd", v24: "102", desc: "Đất tín hiệu (nối chân 5 của router qua rollover)." },
        { pin: "5", signal: "GND", name: "Signal Ground", dir: "gnd", v24: "102", desc: "Đất tín hiệu (nối chân 4 của router qua rollover)." },
        { pin: "6", signal: "RXD", name: "Received Data (PC)", dir: "in", v24: "104", desc: "PC thu: mang TXD của router (router chân 3 → rollover → chân 6)." },
        { pin: "7", signal: "DSR", name: "Data Set Ready (PC)", dir: "in", v24: "107", desc: "Về DSR của PC: mang DTR của router (router chân 2 → rollover → chân 7)." },
        { pin: "8", signal: "CTS", name: "Clear To Send (PC)", dir: "in", v24: "106", desc: "Về CTS của PC: mang RTS của router (router chân 1 → rollover → chân 8)." },
        { pin: "S", signal: "(không dùng)", name: "Vỏ ổ", dir: "nc", desc: "Đầu chuyển thường vỏ nhựa; vỏ kim loại DE-9 không nối với ổ RJ45." }
      ],
      groups: [
        { name: "Dữ liệu", pins: ["3", "6"] }, { name: "Điều khiển", pins: ["1", "2", "7", "8"] }, { name: "Đất", pins: ["4", "5"] }
      ]
    },
    "rs232-rj45-tia561": {
      id: "rs232-rj45-tia561",
      body: "8p8c",
      name: "RS-232 trên RJ45 theo EIA/TIA-561 (DTE)",
      family: "serial",
      standard: "EIA/TIA-561 (RS-232 trên đầu modular 8 vị trí); TIA-232-F",
      role: "DTE",
      gender: "female",
      summary: "Chuẩn RJ45 cho RS-232: 4 = GND, 5 = RXD, 6 = TXD — khác hẳn sơ đồ Cisco.",
      detail:
        "Dùng trên một số terminal server, thiết bị Sun/Digi, máy chủ. Chân 1 dùng chung cho DSR và RI (không tách được như DE-9); DCD có chân riêng (2). " +
        "Cáp rollover Cisco cắm vào cổng EIA/TIA-561 sẽ không chạy (TXD/RXD lệch chân) — cần cáp chế riêng. " +
        NO_IC,
      pins: [
        { pin: "1", signal: "DSR/RI", name: "Data Set Ready / Ring Indicator", dir: "in", v24: "107/125", desc: "DSR hoặc RI (gộp một chân)." },
        { pin: "2", signal: "DCD", name: "Data Carrier Detect", dir: "in", v24: "109", desc: "Phát hiện sóng mang." },
        { pin: "3", signal: "DTR", name: "Data Terminal Ready", dir: "out", v24: "108/2", desc: "DTE sẵn sàng." },
        { pin: "4", signal: "GND", name: "Signal Ground", dir: "gnd", v24: "102", desc: "Đất tín hiệu." },
        { pin: "5", signal: "RXD", name: "Received Data", dir: "in", v24: "104", desc: "Dữ liệu thu." },
        { pin: "6", signal: "TXD", name: "Transmitted Data", dir: "out", v24: "103", desc: "Dữ liệu phát." },
        { pin: "7", signal: "CTS", name: "Clear To Send", dir: "in", v24: "106", desc: "Cho phép phát." },
        { pin: "8", signal: "RTS", name: "Request To Send", dir: "out", v24: "105", desc: "Xin phát." },
        { pin: "S", signal: "Shield", name: "Vỏ ổ (nếu có)", dir: "shield", desc: "Vỏ kim loại nếu là ổ bọc giáp." }
      ],
      groups: [
        { name: "Dữ liệu", pins: ["5", "6"] }, { name: "Điều khiển", pins: ["1", "2", "3", "7", "8"] }, { name: "Đất", pins: ["4", "S"] }
      ]
    },
    "v35-m34": {
      id: "v35-m34",
      body: "m34",
      name: "V.35 trên M/34 (DTE)",
      family: "serial",
      standard: "ITU-T V.35 (tín hiệu dữ liệu/xung nhịp cân bằng), V.28 (điều khiển), V.24 (mạch); ISO 2593 (đầu nối)",
      role: "DTE",
      gender: "male",
      summary: "Giao diện đồng bộ tốc độ cao (56 k – 2 Mbit/s): dữ liệu và xung nhịp là cặp cân bằng A/B, điều khiển là RS-232 đơn.",
      detail:
        "Dữ liệu (SD, RD) và xung nhịp (SCT, SCR, SCTE) là cặp vi sai ±0,55 V trên tải 100 Ω (V.35 Phụ lục II); RTS/CTS/DSR/DCD/DTR là mức V.28 như RS-232. " +
        "DCE (modem/CSU-DSU) cấp xung nhịp phát SCT và thu SCR; DTE có thể trả về SCTE (đồng hồ ngoài) để bù trễ khi cáp dài. " +
        "Nối hai router back-to-back: một đầu cáp DCE (Cisco: \"clock rate\" trên đầu DCE). " +
        "Chân L, M, N, Z, BB…NN không gán trong V.35 cơ bản; các chân J–N và NN dùng tuỳ hãng: N (RL, 140), L (LL, 141), M (TM, 142); " +
        "J = LL theo pinouts.ru nhưng RI theo ADTRAN; NN = TM (ADTRAN) — chỉ là ghi chú, đọc tài liệu thiết bị trước khi hàn. " +
        "Tên dây A/B của cặp cân bằng: đừng đọc A là '+' — theo quy ước cặp cân bằng (V.11) A âm hơn B khi truyền bit 1; pinouts.ru ghi P = TxD−, S = TxD+. " +
        "CẦN KIỂM: nguyên văn cực tính A/B trong V.35 Phụ lục II. " +
        "Chuyển V.35 ↔ RS-232/RS-485/G.703 cần bộ chuyển giao diện có IC, không chế bằng dây.",
      pins: [
        { pin: "A", signal: "FG", name: "Frame Ground (Chassis)", dir: "shield", v24: "101", desc: "Đất khung / màn chắn cáp." },
        { pin: "B", signal: "SG", name: "Signal Ground", dir: "gnd", v24: "102", desc: "Đất tín hiệu." },
        { pin: "C", signal: "RTS", name: "Request To Send", dir: "out", v24: "105", desc: "DTE xin phát (V.28)." },
        { pin: "D", signal: "CTS", name: "Clear To Send", dir: "in", v24: "106", desc: "DCE cho phép phát (V.28)." },
        { pin: "E", signal: "DSR", name: "Data Set Ready", dir: "in", v24: "107", desc: "DCE sẵn sàng (V.28)." },
        { pin: "F", signal: "DCD", name: "Data Carrier Detect (RLSD)", dir: "in", v24: "109", desc: "DCE báo đường lên (V.28)." },
        { pin: "H", signal: "DTR", name: "Data Terminal Ready", dir: "out", v24: "108/2", desc: "DTE sẵn sàng (V.28)." },
        { pin: "J", signal: "RI", name: "Ring Indicator", dir: "in", v24: "125", desc: "Báo chuông (ít dùng). Tuỳ hãng: ADTRAN ghi RI, pinouts.ru ghi LL (Local Loopback)." },
        { pin: "K", signal: "LT", name: "Local Test", dir: "out", v24: "141", desc: "DTE yêu cầu vòng lặp nội bộ ở DCE (tuỳ thiết bị)." },
        { pin: "L", signal: "(chưa gán)", name: "Unassigned", dir: "nc", desc: "Không gán trong V.35 cơ bản (CẦN KIỂM tuỳ hãng)." },
        { pin: "M", signal: "(chưa gán)", name: "Unassigned", dir: "nc", desc: "Không gán; một số hãng dùng làm Test Mode (142)." },
        { pin: "N", signal: "(chưa gán)", name: "Unassigned", dir: "nc", desc: "Không gán; một số hãng dùng làm Remote Loopback (140)." },
        { pin: "P", signal: "SD A", name: "Send Data A", dir: "out", v24: "103", desc: "Dữ liệu phát, dây A của cặp cân bằng P/S (không phải '+': xem ghi chú cực tính)." },
        { pin: "R", signal: "RD A", name: "Receive Data A", dir: "in", v24: "104", desc: "Dữ liệu thu, dây A của cặp R/T." },
        { pin: "S", signal: "SD B", name: "Send Data B", dir: "out", v24: "103", desc: "Dữ liệu phát, dây B của cặp P/S. Chân tên \"S\" — không phải vỏ." },
        { pin: "T", signal: "RD B", name: "Receive Data B", dir: "in", v24: "104", desc: "Dữ liệu thu, dây B." },
        { pin: "U", signal: "SCTE A", name: "Serial Clock Transmit External A", dir: "out", v24: "113", desc: "Xung nhịp phát do DTE trả về, dây A (cặp U/W)." },
        { pin: "V", signal: "SCR A", name: "Serial Clock Receive A", dir: "in", v24: "115", desc: "Xung nhịp thu từ DCE, dây A (cặp V/X)." },
        { pin: "W", signal: "SCTE B", name: "Serial Clock Transmit External B", dir: "out", v24: "113", desc: "Xung nhịp phát do DTE trả về, dây B." },
        { pin: "X", signal: "SCR B", name: "Serial Clock Receive B", dir: "in", v24: "115", desc: "Xung nhịp thu, dây B." },
        { pin: "Y", signal: "SCT A", name: "Serial Clock Transmit A", dir: "in", v24: "114", desc: "Xung nhịp phát do DCE cấp, dây A (cặp Y/AA)." },
        { pin: "Z", signal: "(chưa gán)", name: "Unassigned", dir: "nc", desc: "Không gán." },
        { pin: "AA", signal: "SCT B", name: "Serial Clock Transmit B", dir: "in", v24: "114", desc: "Xung nhịp phát do DCE cấp, dây B." }
      ].concat(["BB", "CC", "DD", "EE", "FF", "HH", "JJ", "KK", "LL", "MM", "NN"].map((p) => ({
        pin: p, signal: "(chưa gán)", name: "Unassigned", dir: "nc",
        desc: p === "NN" ? "Không gán trong V.35 cơ bản; ADTRAN dùng làm TM (Test Mode, 142)." : "Không gán trong V.35 cơ bản."
      }))),
      groups: [
        { name: "Dữ liệu (cân bằng)", pins: ["P", "S", "R", "T"] },
        { name: "Xung nhịp (cân bằng)", pins: ["U", "W", "V", "X", "Y", "AA"] },
        { name: "Điều khiển (V.28)", pins: ["C", "D", "E", "F", "H", "J", "K"] },
        { name: "Đất", pins: ["A", "B"] }
      ]
    },
    "rs485-2w": {
      id: "rs485-2w",
      body: "term3",
      name: "RS-485 2 dây (bán song công)",
      family: "serial",
      standard: "TIA-485-A (mức điện); gán cầu đấu theo nhãn thiết bị",
      role: null,
      gender: "female",
      summary: "Một cặp vi sai A/B dùng chung cho phát và thu, nhiều thiết bị trên một đường bus (Modbus RTU, DMX, PTZ).",
      detail:
        "Bus vi sai: thu nhận được khi |VA − VB| ≥ 200 mV; tới 32 tải đơn vị, 1200 m ở tốc độ thấp. " +
        "Kết cuối 120 Ω ở HAI đầu bus (không ở giữa), đi dây kiểu chuỗi (daisy chain), không đi hình sao. " +
        "Cần một cặp điện trở phân cực (fail-safe bias) ở một điểm để bus nghỉ ở trạng thái xác định. " +
        "Chân đất chung (GND/SC) nên nối dù là tín hiệu vi sai — giữ điện áp chung trong −7…+12 V. " +
        "Không chế được RS-232 ↔ RS-485 bằng dây: cần bộ chuyển có IC (MAX485…) và điều khiển hướng phát.",
      pins: [
        { pin: "1", signal: "A (D−)", name: "Data A — đường đảo (inverting)", dir: "io", pair: "1", desc: "Theo TIA-485: A âm hơn B khi MARK (1). Nhiều hãng in \"A\" cho dây (+) — xem cảnh báo." },
        { pin: "2", signal: "B (D+)", name: "Data B — đường không đảo", dir: "io", pair: "1", desc: "Theo TIA-485: B dương hơn A khi MARK (1). Xoắn cùng cặp với A." },
        { pin: "3", signal: "GND (SC)", name: "Signal Common", dir: "gnd", desc: "Đất tham chiếu chung; nối bằng dây thứ ba hoặc màn chắn tuỳ thiết kế." }
      ],
      groups: [{ name: "Cặp dữ liệu", pins: ["1", "2"] }, { name: "Đất", pins: ["3"] }]
    }
  });

  window.CONN_CABLES = (window.CONN_CABLES || []).concat([
    {
      id: "de9-db25-dte",
      name: "Đầu chuyển DE-9 cái ↔ DB-25 đực (\"đầu chuyển 9-25\")",
      family: "serial",
      kind: "adapter",
      a: { pinout: "rs232-de9", gender: "female", label: "DE-9 cái — cắm vào cổng COM 9 chân của PC" },
      b: { pinout: "rs232-db25-dte", gender: "male", label: "DB-25 đực — trở thành cổng DTE 25 chân" },
      wires: [
        { a: "1", b: "8", note: "DCD" }, { a: "2", b: "3", note: "RXD" }, { a: "3", b: "2", note: "TXD" },
        { a: "4", b: "20", note: "DTR" }, { a: "5", b: "7", note: "GND" }, { a: "6", b: "6", note: "DSR" },
        { a: "7", b: "4", note: "RTS" }, { a: "8", b: "5", note: "CTS" }, { a: "9", b: "22", note: "RI" },
        { a: "S", b: "1", note: "vỏ DE-9 → chân 1 (shield) DB-25" }, { a: "S", b: "S", note: "vỏ – vỏ" }
      ],
      use: "Biến cổng COM 9 chân của PC thành cổng DTE 25 chân để dùng cáp/thiết bị DB-25 cũ (modem, máy in nối tiếp).",
      standard: "TIA-574 ↔ TIA-232-F (kiểu IBM PC/AT)",
      vendor: false,
      detail:
        "Nối theo TÊN tín hiệu, không theo số chân: 2↔3 và 3↔2 vì DE-9 và DB-25 đánh số TXD/RXD ngược nhau. " +
        "Không đổi vai trò DTE: không phải null-modem. Các tín hiệu DB-25 không có trên DE-9 (xung nhịp 15/17/24, kênh phụ) để trống.",
      warnings: ["Nhầm đầu chuyển 9-25 với đầu chuyển null-modem: hai loại trông giống hệt, đọc nhãn hoặc đo thông mạch chân 2."]
    },
    {
      id: "modem-de9-db25",
      name: "Cáp modem PC DE-9 cái ↔ DB-25 đực (DTE → DCE)",
      family: "serial",
      kind: "cable",
      a: { pinout: "rs232-de9", gender: "female", label: "Cắm vào PC (DTE)" },
      b: { pinout: "rs232-db25-dce", gender: "male", label: "Cắm vào modem (DCE, cổng cái)" },
      wires: [
        { a: "3", b: "2", note: "TXD: PC phát → modem nhận" }, { a: "2", b: "3", note: "RXD: modem phát → PC nhận" },
        { a: "7", b: "4", note: "RTS: PC → modem" }, { a: "8", b: "5", note: "CTS: modem → PC" },
        { a: "6", b: "6", note: "DSR: modem → PC" }, { a: "1", b: "8", note: "DCD: modem → PC" },
        { a: "4", b: "20", note: "DTR: PC → modem" }, { a: "9", b: "22", note: "RI: modem → PC" },
        { a: "5", b: "7", note: "GND – GND" }, { a: "S", b: "1", note: "vỏ → shield" }
      ],
      use: "Nối PC (cổng COM 9 chân) với modem ngoài, CSU/DSU hay thiết bị DCE có cổng DB-25 cái.",
      standard: "TIA-574 ↔ TIA-232-F",
      vendor: false,
      detail: "Cùng sơ đồ dây với đầu chuyển 9-25 nhưng ở dạng cáp; DTE ↔ DCE là quan hệ \"thẳng\" theo tên tín hiệu, không bắt chéo.",
      warnings: ["Không dùng cáp này để nối hai PC (DTE ↔ DTE) — cần null-modem."]
    },
    {
      id: "null-modem-de9-full",
      name: "Cáp null-modem DE-9 ↔ DE-9 (bắt tay đầy đủ)",
      family: "serial",
      kind: "cable",
      a: { pinout: "rs232-de9", gender: "female", label: "Phía PC 1" },
      b: { pinout: "rs232-de9", gender: "female", label: "Phía PC 2" },
      wires: [
        { a: "3", b: "2", note: "TXD → RXD" }, { a: "2", b: "3", note: "RXD ← TXD" },
        { a: "5", b: "5", note: "GND – GND" },
        { a: "7", b: "8", note: "RTS → CTS" }, { a: "8", b: "7", note: "CTS ← RTS" },
        { a: "4", b: "6", note: "DTR → DSR" }, { a: "4", b: "1", note: "DTR → DCD" },
        { a: "6", b: "4", note: "DSR ← DTR" }, { a: "1", b: "4", note: "DCD ← DTR" },
        { a: "S", b: "S", note: "vỏ – vỏ (màn chắn)" }
      ],
      use: "Nối trực tiếp hai DTE (PC–PC, PC–thiết bị có cổng COM kiểu DTE) khi phần mềm dùng bắt tay phần cứng.",
      standard: "Sơ đồ null-modem thông dụng (không thuộc chuẩn TIA; dựa trên vai trò mạch V.24)",
      vendor: false,
      detail:
        "Mỗi đầu ra của bên này tới đầu vào tương ứng bên kia: TXD→RXD, RTS→CTS, DTR→DSR+DCD. " +
        "Chân 4 mỗi đầu phải hàn 2 dây (tới chân 6 và 1 đầu kia). RI (9) để trống.",
      warnings: ["Không nối hai chân GND (5) tới chân dữ liệu; không nối DTR→DTR (đầu ra chập đầu ra)."]
    },
    {
      id: "null-modem-de9-loopback",
      name: "Cáp null-modem DE-9 ↔ DE-9 (3 dây + bắt tay giả)",
      family: "serial",
      kind: "cable",
      a: { pinout: "rs232-de9", gender: "female", label: "Phía thiết bị 1" },
      b: { pinout: "rs232-de9", gender: "female", label: "Phía thiết bị 2" },
      wires: [
        { a: "3", b: "2", note: "TXD → RXD" }, { a: "2", b: "3", note: "RXD ← TXD" },
        { a: "5", b: "5", note: "GND – GND" }, { a: "S", b: "S", note: "vỏ – vỏ" }
      ],
      bridges: [
        { end: "a", pins: ["7", "8"], note: "RTS-CTS: tự cho phép phát" },
        { end: "a", pins: ["4", "6", "1"], note: "DTR-DSR-DCD: tự báo sẵn sàng" },
        { end: "b", pins: ["7", "8"], note: "RTS-CTS" },
        { end: "b", pins: ["4", "6", "1"], note: "DTR-DSR-DCD" }
      ],
      use: "Nối hai DTE chỉ cần dữ liệu (console thiết bị, cấu hình qua terminal) khi phần mềm vẫn đòi tín hiệu bắt tay.",
      standard: "Sơ đồ null-modem thông dụng",
      vendor: false,
      detail:
        "Chỉ 3 dây xuyên cáp; mỗi đầu tự đánh lừa mình bằng cầu nối: RTS cấp ngay CTS, DTR cấp DSR và DCD. " +
        "Không có flow control thật — tốc độ cao dễ mất ký tự khi bên nhận bận.",
      warnings: ["Phải tắt flow control phần cứng thật ở cả hai bên nếu muốn tránh tràn đệm."]
    },
    {
      id: "straight-de9",
      name: "Cáp nối dài DE-9 đực ↔ DE-9 cái (1–1)",
      family: "serial",
      kind: "cable",
      a: { pinout: "rs232-de9", gender: "male", label: "Đầu đực (cắm vào cáp/thiết bị cái)" },
      b: { pinout: "rs232-de9", gender: "female", label: "Đầu cái (cắm vào cổng COM PC)" },
      wires: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "S"].map((p) => ({ a: p, b: p, note: p === "S" ? "vỏ – vỏ" : "chân " + p + " – chân " + p })),
      use: "Nối dài cổng COM, hoặc nối PC (DTE, đực) với thiết bị DCE dùng DE-9 cái (modem 9 chân, một số UPS).",
      standard: "TIA-574",
      vendor: false,
      detail: "Nối 1–1 đủ 9 chân + vỏ. Không đổi vai trò; hai PC nối bằng cáp này sẽ không chạy (TXD chập TXD).",
      warnings: ["Cáp DE-9 cái–cái nối 1–1 gần như luôn là cáp sai cho RS-232 (trừ null-modem): kiểm bằng đồng hồ trước khi dùng."]
    },
    {
      id: "loopback-de9",
      name: "Nút loopback DE-9 (test cổng COM)",
      family: "serial",
      kind: "loopback",
      a: { pinout: "rs232-de9", gender: "female", label: "Đầu cái cắm vào cổng COM" },
      wires: [
        { a: "3", a2: "2", note: "TXD → RXD" },
        { a: "7", a2: "8", note: "RTS → CTS" }
      ],
      bridges: [{ end: "a", pins: ["4", "6", "1", "9"], note: "DTR → DSR, DCD, RI" }],
      use: "Kiểm cổng COM/USB-serial: gõ ký tự trong terminal phải thấy dội lại; phần mềm test đọc được DSR/DCD/CTS/RI đổi theo DTR/RTS.",
      standard: "Thực hành phổ biến (loopback plug kiểu PC)",
      vendor: false,
      detail: "Một đầu DE-9 cái, các cầu: 2-3, 7-8, 4-6-1-9. Một đầu ra (DTR) kéo được 3 đầu vào — trong khả năng của mạch RS-232.",
      warnings: ["Không nối chân 5 (GND) vào cầu nào."]
    },
    {
      id: "cisco-rollover",
      name: "Cáp rollover (console Cisco) RJ45 ↔ RJ45",
      family: "serial",
      kind: "cable",
      a: { pinout: "rs232-rj45-cisco", gender: "male", label: "Đầu cắm cổng console thiết bị" },
      b: { pinout: "rs232-rj45-cisco", gender: "male", label: "Đầu cắm đầu chuyển RJ45-DB9/DB25 (hoặc console thứ hai)" },
      wires: [
        { a: "1", b: "8", note: "RTS → CTS" }, { a: "2", b: "7", note: "DTR → DSR" },
        { a: "3", b: "6", note: "TXD → RXD" }, { a: "4", b: "5", note: "GND – GND" },
        { a: "5", b: "4", note: "GND – GND" }, { a: "6", b: "3", note: "RXD ← TXD" },
        { a: "7", b: "2", note: "DSR ← DTR" }, { a: "8", b: "1", note: "CTS ← RTS" }
      ],
      use: "Cáp xanh dẹt đi kèm thiết bị Cisco: nối cổng console với đầu chuyển RJ45-DE9 (vào PC) hoặc với một cổng console khác.",
      standard: "Tài liệu Cisco (\"rollover cable\")",
      vendor: true,
      detail:
        "Đảo toàn bộ thứ tự: 1↔8, 2↔7, 3↔6, 4↔5. Cầm hai đầu cạnh nhau, lẫy cùng hướng: màu dây đầu này ngược thứ tự đầu kia. " +
        "Nhờ sơ đồ console đối xứng, rollover tự là null-modem giữa hai cổng kiểu Cisco.",
      warnings: [
        "Không dùng cáp rollover làm cáp mạng — sai cặp, không chạy và có thể đưa PoE vào cổng console.",
        "Cổng EIA/TIA-561 không dùng được rollover."
      ]
    },
    {
      id: "cisco-console-de9",
      name: "Đầu chuyển console RJ45 (cái) ↔ DE-9 (cái)",
      family: "serial",
      kind: "adapter",
      a: { pinout: "rs232-rj45-cisco-adapter", gender: "female", label: "Ổ RJ45 — nhận đầu cáp rollover (nhãn theo phía PC)" },
      b: { pinout: "rs232-de9", gender: "female", label: "DE-9 cái — cắm vào cổng COM PC" },
      wires: [
        { a: "8", b: "8", note: "CTS PC (mang RTS router qua rollover)" },
        { a: "7", b: "6", note: "DSR PC (mang DTR router)" },
        { a: "6", b: "2", note: "RXD PC (mang TXD router)" },
        { a: "5", b: "5", note: "GND" },
        { a: "4", b: "5", note: "GND" },
        { a: "3", b: "3", note: "TXD PC → qua rollover tới RXD router" },
        { a: "2", b: "4", note: "DTR PC → qua rollover tới DSR router" },
        { a: "1", b: "7", note: "RTS PC → qua rollover tới CTS router" }
      ],
      use: "Đầu \"terminal adapter\" RJ45-DB9: rollover + đầu này = cáp console từ router Cisco tới PC.",
      standard: "Tài liệu Cisco (RJ-45-to-DB-9 terminal adapter)",
      vendor: true,
      detail:
        "Phía RJ45 dùng sơ đồ rs232-rj45-cisco-adapter: nhãn là tín hiệu của PC (tín hiệu đã qua cáp rollover). Đầu chuyển chỉ đổi chân, " +
        "nối mỗi tín hiệu sang chân CÙNG TÊN trên DE-9 — vì hai đầu cùng mô tả một cổng PC nên hướng (out/in) hai đầu giống nhau là đúng. " +
        "Kiểm TX→RX toàn tuyến: router 3 (TXD, out) → rollover → ổ 6 → DE-9 2 (RXD PC, in) ✓; PC 3 (TXD, out) → ổ 3 → rollover → router 6 (RXD, in) ✓; " +
        "PC 7 (RTS) → ổ 1 → rollover → router 8 (CTS) ✓; router 1 (RTS) → rollover → ổ 8 → DE-9 8 (CTS PC) ✓; DTR↔DSR tương tự; GND 4, 5 → DE-9 5. " +
        "DCD (DE-9 chân 1) không nối — một số đầu chuyển cầu DSR-DCD.",
      warnings: ["Đầu chuyển này chỉ đúng khi đi kèm cáp rollover; cáp mạng thẳng sẽ cho TXD↔TXD."]
    },
    {
      id: "cisco-console-db25-dte",
      name: "Đầu chuyển console RJ45 (cái) ↔ DB-25 (cái, nối terminal)",
      family: "serial",
      kind: "adapter",
      a: { pinout: "rs232-rj45-cisco-adapter", gender: "female", label: "Ổ RJ45 — nhận đầu cáp rollover (nhãn theo phía terminal)" },
      b: { pinout: "rs232-db25-dte", gender: "female", label: "DB-25 cái — cắm vào terminal/PC 25 chân (DTE)" },
      wires: [
        { a: "8", b: "5", note: "CTS terminal (mang RTS router qua rollover)" },
        { a: "7", b: "6", note: "DSR terminal (mang DTR router)" },
        { a: "6", b: "3", note: "RXD terminal (mang TXD router)" },
        { a: "5", b: "7", note: "GND" },
        { a: "4", b: "7", note: "GND" },
        { a: "3", b: "2", note: "TXD terminal → qua rollover tới RXD router" },
        { a: "2", b: "20", note: "DTR terminal → qua rollover tới DSR router" },
        { a: "1", b: "4", note: "RTS terminal → qua rollover tới CTS router" }
      ],
      use: "Đầu \"terminal adapter\" RJ45-DB25 cái: rollover + đầu này nối console Cisco với terminal/PC có cổng DB-25 đực.",
      standard: "Tài liệu Cisco (RJ-45-to-DB-25 female DTE adapter)",
      vendor: true,
      detail:
        "Cùng logic với đầu chuyển DE-9 (phía RJ45 là rs232-rj45-cisco-adapter, nhãn theo phía terminal) nhưng theo số chân DB-25 (2 = TXD, 3 = RXD, 4 = RTS, 5 = CTS, 6 = DSR, 7 = GND, 20 = DTR). " +
        "Kiểm TX→RX toàn tuyến: router 3 (TXD, out) → rollover → ổ 6 → DB-25 3 (RXD terminal, in) ✓; terminal 2 (TXD, out) → ổ 3 → rollover → router 6 (RXD, in) ✓; " +
        "terminal 4 (RTS) → ổ 1 → rollover → router 8 (CTS) ✓; router 1 (RTS) → rollover → ổ 8 → DB-25 5 (CTS) ✓. " +
        "CẦN KIỂM: một số đầu chuyển Cisco cầu thêm DSR (6) với DCD (8) phía DB-25.",
      warnings: ["Cisco còn có đầu chuyển DB-25 ĐỰC kiểu \"modem\" (cho cổng AUX) với sơ đồ khác — không dùng thay cho nhau."]
    }
  ]);
})();
