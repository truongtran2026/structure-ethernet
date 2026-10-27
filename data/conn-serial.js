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

  // M/34: khối Winchester MRAC-34 = 4 CỘT so le nửa bước (9/8/9/8 = 34), trục dài thẳng đứng,
  // nhìn mặt cắm đầu ĐỰC. Cột 1 và 3 ở hàng chẵn 0,2,…,16; cột 2 và 4 ở hàng lẻ 1,3,…,15.
  // Nguồn: catalogue Winchester MRAC (pccomponents.com/datasheets/WINC-MRAC.pdf tr.4, 13: hình vẽ nhìn
  // phía hàn của đầu cái = nhìn mặt cắm đầu đực); pinouts.ru m34m.gif / m34f.gif.
  const M34_COLS = [
    ["B", "F", "L", "R", "V", "Z", "DD", "JJ", "NN"], // cột 1 (trái), hàng chẵn
    ["D", "J", "N", "T", "X", "BB", "FF", "LL"],      // cột 2, hàng lẻ
    ["A", "E", "K", "P", "U", "Y", "CC", "HH", "MM"], // cột 3, hàng chẵn
    ["C", "H", "M", "S", "W", "AA", "EE", "KK"]       // cột 4 (phải), hàng lẻ
  ];
  const m34Pins = [];
  M34_COLS.forEach((col, c) =>
    col.forEach((p, j) => m34Pins.push({ pin: p, x: 35 + c * 30, y: 45 + (2 * j + (c % 2)) * 15 })));

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
      standard: "ISO 2593 (đầu nối 34 chân cho V.35); bố trí chân theo catalogue Winchester MRAC-34 (khối dùng cho ISO 2593)",
      summary: "Khối đầu nối chữ nhật to, 34 chân đặt tên bằng chữ cái, hai vít khoá lớn — giao diện V.35 của modem/CSU-DSU.",
      detail:
        "Chân đặt tên bằng chữ cái A…Z rồi AA…NN, bỏ các chữ dễ nhầm (G, I, O, Q; GG, II). " +
        "Đầu DTE (cáp từ router) thường là ĐỰC, cổng trên modem/DCE là CÁI. Router thường có cổng nén (Cisco 60 chân, Smart Serial) và cáp chuyển ra M/34. " +
        "Bố trí theo catalogue Winchester MRAC-34 (khối dùng cho ISO 2593): 4 cột so le nửa bước, 9/8/9/8 chân; đọc theo hàng từng cặp " +
        "B·A / D·C / F·E / J·H / L·K / N·M / R·P / T·S / V·U / X·W / Z·Y / BB·AA / DD·CC / FF·EE / JJ·HH / LL·KK / NN·MM. " +
        "Catalogue vẽ nhìn phía hàn của đầu cái (\"Male inserts are opposite\") — trùng với nhìn mặt cắm đầu đực. " +
        "Khi hàn vẫn đọc chữ in nổi trên khối nhựa.",
      genders: {
        male: { name: "Đầu đực (chân cắm)", note: "Thường ở đầu cáp phía DTE (router)." },
        female: { name: "Đầu cái (lỗ cắm)", note: "Thường trên modem/CSU-DSU (DCE)." }
      },
      face: {
        outline: "m34",
        w: 160, h: 330,
        viewOf: "male",
        orientation:
          "Nhìn MẶT CẮM đầu ĐỰC, trục dài thẳng đứng, chốt dẫn hướng/vít khoá ở hai đầu ngắn (trên, dưới), hàng A-B ở TRÊN. " +
          "4 cột so le nửa bước, trái → phải: cột 1 B F L R V Z DD JJ NN; cột 2 D J N T X BB FF LL; cột 3 A E K P U Y CC HH MM; cột 4 C H M S W AA EE KK " +
          "(cột 1, 3 ở hàng chẵn; cột 2, 4 lệch xuống nửa bước). Đầu cái nhìn mặt cắm là ảnh gương (cột trái → phải: C…, A…, D…, B…).",
        pins: m34Pins,
        keys: [
          { x: 60, y: 6, w: 40, h: 20, label: "vít/chốt" },
          { x: 60, y: 304, w: 40, h: 20, label: "vít/chốt" }
        ]
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
        "Cisco không có DCD trên RJ45; chân 7 là DSR (vào) trên cả cổng console lẫn AUX. Ở AUX nối modem bằng rollover + đầu chuyển DB-25 đực CAB-MMOD " +
        "(ổ 1→5, 2→8, 3→3, 4/5→7, 6→2, 7→20, 8→4), router 7 → rollover → ổ 2 → DB-25 chân 8: DSR của router nhận DCD của modem là do đầu chuyển đi dây, " +
        "không phải do chân 7 đổi chức năng (conserver.com/consoles/Cisco/ciscocons.html). " +
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
        "Dữ liệu (SD, RD) và xung nhịp (SCT, SCR, SCTE) là cặp vi sai ±0,55 V trên tải 100 Ω (V.35 Appendix 4); RTS/CTS/DSR/DCD/DTR là mức V.28 như RS-232. " +
        "DCE (modem/CSU-DSU) cấp xung nhịp phát SCT và thu SCR; DTE có thể trả về SCTE (đồng hồ ngoài) để bù trễ khi cáp dài. " +
        "Nối hai router back-to-back: một đầu cáp DCE (Cisco: \"clock rate\" trên đầu DCE). " +
        "V.35 (1968) §10a chỉ liệt kê mạch 101–107, 109, 114, 115 (cân bằng: 103, 104, 114, 115); DTR 108 (H) và SCTE 113 (U/W) theo ISO 2593/thực hành hãng. " +
        "Chân J, K dùng tuỳ hãng: Cisco chỉ gán K = LT, Juniper ghi K = Test Mode; pinouts.ru ghi J = Local Loopback, K = Local Test; ADTRAN (trích đoạn) ghi J = RI. " +
        "L, M, N, Z, BB…NN để trống (pinouts.ru, Cisco) — đọc tài liệu thiết bị trước khi hàn các chân này. " +
        "Cực tính A/B do V.35 quy định (Appendix 4 mục 2c): \"A terminal is positive to the B terminal when binary 0 is transmitted\", ngược lại khi phát 1; " +
        "0,55 V ±20 %, nguồn 100 Ω ±50 %, tải 100 Ω ±10 %. Nhãn +/− giữa các hãng ngược nhau (pinouts.ru P = TxD−, S = TxD+; Cisco CAB-V35MT/FC P = SD+, S = SD−, R = RD+, T = RD−; " +
        "Juniper ghi (A)/(B)) — chỉ A/B là tên chuẩn, đừng hàn theo dấu +/−. " +
        "Chuyển V.35 ↔ RS-232/RS-485/G.703 cần bộ chuyển giao diện có IC, không chế bằng dây.",
      pins: [
        { pin: "A", signal: "FG", name: "Frame Ground (Chassis)", dir: "shield", v24: "101", desc: "Đất khung / màn chắn cáp." },
        { pin: "B", signal: "SG", name: "Signal Ground", dir: "gnd", v24: "102", desc: "Đất tín hiệu." },
        { pin: "C", signal: "RTS", name: "Request To Send", dir: "out", v24: "105", desc: "DTE xin phát (V.28)." },
        { pin: "D", signal: "CTS", name: "Clear To Send", dir: "in", v24: "106", desc: "DCE cho phép phát (V.28)." },
        { pin: "E", signal: "DSR", name: "Data Set Ready", dir: "in", v24: "107", desc: "DCE sẵn sàng (V.28)." },
        { pin: "F", signal: "DCD", name: "Data Carrier Detect (RLSD)", dir: "in", v24: "109", desc: "DCE báo đường lên (V.28)." },
        { pin: "H", signal: "DTR", name: "Data Terminal Ready", dir: "out", v24: "108/2", desc: "DTE sẵn sàng (V.28)." },
        { pin: "J", signal: "(tuỳ hãng)", name: "Vendor-specific", dir: "nc", desc: "Tuỳ hãng: pinouts.ru ghi Local Loopback, ADTRAN (trích đoạn) ghi RI; Cisco không gán. Đọc tài liệu thiết bị." },
        { pin: "K", signal: "LT / TM (tuỳ hãng)", name: "Local Test (Cisco) / Test Mode (Juniper)", dir: "nc", desc: "Tuỳ hãng: Cisco ghi LT, Juniper ghi Test Mode, pinouts.ru ghi Local Test — chiều và mạch V.24 khác nhau theo hãng." },
        { pin: "L", signal: "(chưa gán)", name: "Unassigned", dir: "nc", desc: "Để trống (pinouts.ru, Cisco)." },
        { pin: "M", signal: "(chưa gán)", name: "Unassigned", dir: "nc", desc: "Để trống (pinouts.ru, Cisco)." },
        { pin: "N", signal: "(chưa gán)", name: "Unassigned", dir: "nc", desc: "Để trống (pinouts.ru, Cisco)." },
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
        desc: p === "NN" ? "Để trống (pinouts.ru, Cisco); một tài liệu ADTRAN ghi TM — CHƯA XÁC MINH." : "Không gán trong V.35 cơ bản."
      }))),
      groups: [
        { name: "Dữ liệu (cân bằng)", pins: ["P", "S", "R", "T"] },
        { name: "Xung nhịp (cân bằng)", pins: ["U", "W", "V", "X", "Y", "AA"] },
        { name: "Điều khiển (V.28)", pins: ["C", "D", "E", "F", "H"] },
        { name: "Tuỳ hãng", pins: ["J", "K"] },
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
      groups: [{ name: "Cặp dữ liệu", pins: ["1", "2"] }, { name: "Đất", pins: ["3"] }],
      noLoop:
        "RS-485 2 dây là bán song công: phát và thu dùng CHUNG một cặp A/B, không có cặp TX riêng để vòng về RX — nối A với B chỉ là chập đường dây. " +
        "Cách thử: nối hai cổng (hai bộ chuyển USB-RS485) A–A, B–B, GND–GND, có kết cuối 120 Ω, rồi gửi ở bên này nhận ở bên kia; " +
        "hoặc dùng chế độ 4 dây (RS-422/RS-485 full duplex: nối TX+ → RX+, TX− → RX−) nếu thiết bị hỗ trợ. " +
        "Một số bộ chuyển 2 dây để bộ thu luôn bật nên tự nghe lại chính mình (echo) khi phát — thấy chữ dội lại KHÔNG chứng minh đường dây tốt."
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
      loopFor: ["RS-232 bất đồng bộ, mọi tốc độ (300 … 115 200 bit/s)", "Có hoặc không bắt tay phần cứng RTS/CTS, DTR/DSR"],
      test:
        "Cắm nút vào cổng COM (hoặc đầu USB-serial), mở PuTTY/Tera Term/minicom đúng cổng, TẮT local echo, gõ ký tự: thấy chữ hiện lại = TXD→RXD tốt; " +
        "không thấy gì = đứt chân 2/3, sai cổng hoặc driver. Bật flow control RTS/CTS vẫn phải gõ được (chân 7→8). " +
        "Kiểm chân điều khiển: phần mềm test cổng (vd. trên Linux `statserial`, Windows các công cụ COM port tester) bật/tắt DTR thì DSR, DCD, RI đổi theo; bật/tắt RTS thì CTS đổi theo.",
      standard: "Thực hành phổ biến (loopback plug kiểu PC)",
      vendor: false,
      detail:
        "Một đầu DE-9 cái, các cầu: 2-3, 7-8, 4-6-1-9. Một đầu ra (DTR) kéo được 3 đầu vào — trong khả năng của mạch RS-232. " +
        "Tự kiểm: TXD 3 (out) → RXD 2 (in); RTS 7 (out) → CTS 8 (in); DTR 4 (out) → DSR 6, DCD 1, RI 9 (in). Mọi chân ra đều về chân vào, không chân ra nào chập chân ra.",
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
        "Đầu chuyển DB-25 Cisco 29-0810-01 không cầu DSR–DCD; cầu 6–1 chỉ gặp ở một số đầu DE-9 bên thứ ba (APACN 24490-59) (conserver.com).",
      warnings: ["Cisco còn có đầu chuyển DB-25 ĐỰC kiểu \"modem\" (cho cổng AUX) với sơ đồ khác — không dùng thay cho nhau."]
    },
    // ---------- v3: nút loopback cho từng cách gán chân ----------
    {
      id: "loopback-db25-dte",
      name: "Nút loopback DB-25 phía DTE (test cổng COM 25 chân)",
      family: "serial",
      kind: "loopback",
      a: { pinout: "rs232-db25-dte", gender: "female", label: "Đầu DB-25 cái cắm vào cổng DTE 25 chân (đực)" },
      wires: [
        { a: "2", a2: "3", note: "TXD → RXD" },
        { a: "4", a2: "5", note: "RTS → CTS" }
      ],
      bridges: [{ end: "a", pins: ["20", "6", "8", "22"], note: "DTR → DSR, DCD, RI (RI 22 tuỳ chọn)" }],
      use: "Kiểm cổng nối tiếp DB-25 kiểu DTE (PC đời cũ, terminal, máy in nối tiếp, card đa cổng): dữ liệu phát phải quay về, bắt tay tự thoả.",
      loopFor: ["RS-232 bất đồng bộ, mọi tốc độ", "Có hoặc không bắt tay phần cứng RTS/CTS, DTR/DSR"],
      test:
        "Như nút DE-9: terminal (PuTTY/minicom) mở đúng cổng, tắt local echo, gõ thấy chữ dội lại; bật/tắt DTR thì DSR/DCD/RI đổi, bật/tắt RTS thì CTS đổi. " +
        "Không kiểm được chế độ đồng bộ (xung nhịp 15/17/24) và kênh phụ bằng nút này.",
      standard: "Thực hành phổ biến (loopback plug DB-25); số chân theo TIA-232-F",
      vendor: false,
      detail:
        "Một đầu DB-25 cái, cầu 2-3, 4-5, 20-6-8(-22). Chú ý số chân khác hẳn DE-9 (DB-25: 2 = TXD, 3 = RXD, 20 = DTR). " +
        "Tự kiểm: TXD 2 (out) → RXD 3 (in); RTS 4 (out) → CTS 5 (in); DTR 20 (out) → DSR 6, DCD 8, RI 22 (in). " +
        "Để trống có chủ ý: kênh phụ (14 STXD, 19 SRTS), xung nhịp đồng bộ 24 (TCE), lệnh thử 18 (LL), 21 (RL), chọn tốc độ 23 — các chân này là lệnh/xung cho modem, " +
        "nút loop thông dụng không nối; validator sẽ liệt kê chúng là \"chân out không quay về\" — đó là chủ ý, không phải lỗi.",
      warnings: ["Không nối chân 7 (GND) hay chân 1 (đất bảo vệ) vào cầu nào.", "Đừng dùng sơ đồ DE-9 (2-3, 7-8, 4-6-1-9) cho DB-25 — chân 7 là GND, sẽ chập RTS xuống đất."]
    },
    {
      id: "loopback-db25-dce",
      name: "Nút loopback DB-25 phía DCE (test cổng modem 25 chân)",
      family: "serial",
      kind: "loopback",
      a: { pinout: "rs232-db25-dce", gender: "male", label: "Đầu DB-25 đực cắm vào cổng DCE (cái) của modem/CSU-DSU/thiết bị chế độ DCE" },
      wires: [
        { a: "3", a2: "2", note: "RXD (DCE phát) → TXD (DCE thu)" },
        { a: "5", a2: "4", note: "CTS (DCE phát) → RTS (DCE thu)" },
        { a: "6", a2: "20", note: "DSR (DCE phát) → DTR (DCE thu)" }
      ],
      use: "Kiểm cổng DB-25 của thiết bị đóng vai DCE (modem ngoài, CSU/DSU, cổng 'DCE' của bộ chuyển giao diện): dữ liệu thiết bị phát ra chân 3 quay về chân 2.",
      loopFor: ["RS-232 bất đồng bộ phía DCE", "Bắt tay: CTS → RTS, DSR → DTR (mỗi đầu ra chỉ tới một đầu vào)"],
      test:
        "Chỉ có ý nghĩa khi thiết bị DCE có chế độ tự kiểm/terminal riêng (menu test, đèn TD/RD): sau khi cắm, đèn TD và RD phải nháy cùng nhau khi thiết bị phát; " +
        "thiết bị thấy DTR (chân 20) lên ngay khi nó bật DSR. Modem thường không tự phát dữ liệu — khi đó dùng chức năng loop nội (AL/DL, V.54) của modem thay cho nút này.",
      standard: "Suy ra từ TIA-232-F (đảo vai trò của nút DTE); không phải sơ đồ chuẩn hoá",
      vendor: false,
      detail:
        "Tên tín hiệu luôn theo góc nhìn DTE, nên ở cổng DCE chân 3 (RXD) là ĐẦU RA, chân 2 (TXD) là ĐẦU VÀO. " +
        "Tự kiểm: RXD 3 (out) → TXD 2 (in); CTS 5 (out) → RTS 4 (in); DSR 6 (out) → DTR 20 (in). " +
        "KHÔNG cầu 6-8-20-22 như nút DTE: ở DCE, DSR 6, DCD 8 và RI 22 đều là đầu ra — cầu chúng với nhau là chập đầu ra với đầu ra. " +
        "Vì vậy DCD 8, RI 22, xung nhịp 15/17, kênh phụ 12/13/16 và TM 25 để trống (validator liệt kê là chủ ý). " +
        "CẦN KIỂM: chưa tìm được sơ đồ loop DCE DB-25 công bố của hãng để đối chiếu; sơ đồ này suy từ chiều mạch V.24.",
      warnings: ["Không cầu các chân DSR (6), DCD (8), RI (22), CTS (5) với nhau ở phía DCE — đều là đầu ra."]
    },
    {
      id: "loopback-rj45-cisco",
      name: "Nút loopback RJ45 console kiểu Cisco (3↔6, 1↔8, 2↔7)",
      family: "serial",
      kind: "loopback",
      a: { pinout: "rs232-rj45-cisco", gender: "male", label: "Phích 8P8C cắm vào cổng console/AUX RJ45" },
      wires: [
        { a: "3", a2: "6", note: "TXD → RXD" },
        { a: "1", a2: "8", note: "RTS → CTS" },
        { a: "2", a2: "7", note: "DTR → DSR" }
      ],
      use: "Kiểm cổng console/AUX RJ45 kiểu Cisco và đầu nối RJ45 kiểu đối xứng: mỗi chân ra nối sang chân đối xứng của nó.",
      loopFor: ["Console/AUX RJ45 kiểu Cisco (và hãng dùng cùng sơ đồ: Juniper, Aruba…), 9600 8N1 hoặc tốc độ đã đặt"],
      test:
        "Trên router: `show line aux 0` (hoặc `show line console 0`) — phần trạng thái modem phải thấy CTS và DSR lên khi đường bật RTS/DTR. " +
        "Cổng console router không có ‘terminal’ để xem dội lại: router đọc lại chính dòng nó in ra như lệnh, có thể sinh vòng lặp thông báo lỗi — chỉ cắm ngắn để thử, rồi rút. " +
        "Cách hữu ích hơn: cắm nút cùng sơ đồ vào ổ RJ45 của đầu chuyển (xem loopback-rj45-cisco-adapter) hoặc qua đầu nối thẳng RJ45 (coupler) ở đầu cáp rollover để thử cả chuỗi PC → đầu chuyển → rollover.",
      standard: "Suy ra từ sơ đồ console RJ45 tài liệu Cisco (\"Cabling Guide for Console and AUX Ports\")",
      vendor: true,
      detail:
        "Sơ đồ console Cisco đối xứng nên loop chính là cáp rollover gập đôi: 3↔6, 1↔8, 2↔7 (4, 5 GND để trống). " +
        "Tự kiểm: TXD 3 (out) → RXD 6 (in); RTS 1 (out) → CTS 8 (in); DTR 2 (out) → DSR 7 (in). " +
        "KHÁC nút loop Ethernet (1↔3, 2↔6) và nút loop E1 (1↔4, 2↔5): cắm nhầm nút loop Ethernet vào console thì TXD 3 chập RTS 1, RXD 6 chập DTR 2 — không dội lại được. " +
        "CẦN KIỂM: lệnh `show line` hiển thị trạng thái CTS/DSR cho dòng console (chắc chắn với AUX, chưa xác minh với console trên mọi dòng IOS).",
      warnings: ["Không cắm nút này vào cổng Ethernet PoE: PSE chuẩn không thấy chữ ký 25 kΩ nên không cấp, nhưng với PoE thụ động 4 cặp (1,2,4,5 = +; 3,6,7,8 = −, cấp thẳng không dò) dây 1↔8, 2↔7 nối + sang − — chập nguồn (sơ đồ 4 cặp từng hãng chưa xác minh). Kiểu thụ động 4,5 = + / 7,8 = − thì không chập nhưng vẫn kéo V− sang cặp 1-2."]
    },
    {
      id: "loopback-rj45-cisco-adapter",
      name: "Nút loopback ở ổ RJ45 của đầu chuyển console (thử cổng COM + đầu chuyển)",
      family: "serial",
      kind: "loopback",
      a: { pinout: "rs232-rj45-cisco-adapter", gender: "male", label: "Phích 8P8C cắm vào ổ RJ45 của đầu chuyển RJ45-DB9/DB25" },
      wires: [
        { a: "3", a2: "6", note: "TXD PC → RXD PC" },
        { a: "1", a2: "8", note: "RTS PC → CTS PC" },
        { a: "2", a2: "7", note: "DTR PC → DSR PC" }
      ],
      use: "Kiểm phía PC của bộ cáp console: cổng COM/USB-serial + đầu chuyển RJ45-DB9 — chưa cần router.",
      loopFor: ["Đầu chuyển console RJ45-DE9 / RJ45-DB25 kiểu Cisco + cổng COM của PC, mọi tốc độ"],
      test:
        "Cắm đầu chuyển vào PC, cắm nút vào ổ RJ45 của đầu chuyển; PuTTY mở cổng COM (9600 8N1, tắt local echo), gõ phải thấy chữ dội lại. " +
        "Thấy dội lại = cổng COM và đầu chuyển tốt → nếu cắm router vẫn không vào được thì lỗi ở cáp rollover, cổng console hay tốc độ. " +
        "Muốn thử thêm cáp rollover: nối đầu xa rollover vào nút này qua một đầu nối thẳng RJ45 cái–cái (coupler); kết quả phải giống hệt.",
      standard: "Suy ra từ sơ đồ đầu chuyển terminal adapter (tài liệu Cisco)",
      vendor: true,
      detail:
        "Cùng một nút vật lý với loopback-rj45-cisco (3↔6, 1↔8, 2↔7) — vì sơ đồ đối xứng nên nhãn phía PC hay phía router đều cho cùng cặp chân. " +
        "Tự kiểm theo nhãn phía PC: TXD 3 (PC phát) → RXD 6 (PC thu) ✓; RTS 1 → CTS 8 ✓; DTR 2 → DSR 7 ✓. " +
        "Qua đầu chuyển DE-9: PC 3 → ổ 3 → nút → ổ 6 → PC 2 (RXD) ✓; PC 7 → ổ 1 → ổ 8 → PC 8 (CTS) ✓; PC 4 → ổ 2 → ổ 7 → PC 6 (DSR) ✓. " +
        "Qua coupler + rollover: ổ 3 → rollover → 6 → nút → 3 → rollover → ổ 6 ✓ (rollover đảo 3↔6 hai lần).",
      warnings: ["Coupler RJ45 phải là loại nối thẳng 1-1 (loại bán cho cáp mạng)."]
    },
    {
      id: "loopback-rj45-tia561",
      name: "Nút loopback RJ45 theo EIA/TIA-561 (6→5, 8→7, 3→1+2)",
      family: "serial",
      kind: "loopback",
      a: { pinout: "rs232-rj45-tia561", gender: "male", label: "Phích 8P8C cắm vào cổng RS-232 RJ45 kiểu EIA/TIA-561" },
      wires: [
        { a: "6", a2: "5", note: "TXD → RXD" },
        { a: "8", a2: "7", note: "RTS → CTS" }
      ],
      bridges: [{ end: "a", pins: ["3", "1", "2"], note: "DTR → DSR/RI, DCD" }],
      use: "Kiểm cổng RS-232 RJ45 kiểu EIA/TIA-561 (terminal server, Sun/Digi, một số máy chủ): dữ liệu và bắt tay quay về chính cổng.",
      loopFor: ["RS-232 bất đồng bộ trên RJ45 EIA/TIA-561, mọi tốc độ", "Có hoặc không bắt tay phần cứng"],
      test:
        "Terminal server: mở phiên vào cổng (reverse telnet/SSH tới cổng đó, hoặc lệnh test cổng của hãng), gõ thấy chữ dội lại; trạng thái cổng thấy DSR/DCD/CTS lên. " +
        "Trên máy Linux có cổng RJ45 kiểu này: minicom/`statserial` như với DE-9.",
      standard: "Suy ra từ gán chân EIA/TIA-561",
      vendor: false,
      detail:
        "Tự kiểm: TXD 6 (out) → RXD 5 (in); RTS 8 (out) → CTS 7 (in); DTR 3 (out) → DSR/RI 1, DCD 2 (in). GND 4 để trống. " +
        "Khác nút loop Cisco (3↔6, 1↔8, 2↔7): cắm nút Cisco vào cổng EIA/TIA-561 thì DTR 3 chập TXD 6 (ra–ra), DSR/RI 1 nối RTS 8, DCD 2 nối CTS 7 (vào–vào), RXD 5 bỏ trống — không dội lại. Mỗi cách gán chân RJ45 cần nút riêng.",
      warnings: ["Đánh dấu rõ nút này: nhìn bên ngoài giống hệt nút loop Cisco/Ethernet/E1 nhưng nối khác."]
    },
    {
      id: "loopback-v35",
      name: "Nút loopback V.35 M/34 (phía DTE)",
      family: "serial",
      kind: "loopback",
      a: { pinout: "v35-m34", gender: "female", label: "Đầu M/34 cái cắm vào đầu cáp V.35 DTE (đực)" },
      wires: [
        { a: "P", a2: "R", note: "SD A → RD A" },
        { a: "S", a2: "T", note: "SD B → RD B" },
        { a: "C", a2: "D", note: "RTS → CTS" },
        { a: "U", a2: "V", note: "SCTE A → SCR A" },
        { a: "U", a2: "Y", note: "SCTE A → SCT A" },
        { a: "W", a2: "X", note: "SCTE B → SCR B" },
        { a: "W", a2: "AA", note: "SCTE B → SCT B" }
      ],
      bridges: [{ end: "a", pins: ["H", "E", "F"], note: "DTR → DSR, DCD" }],
      use: "Kiểm cổng serial V.35 của router (đầu cáp DTE) khi không có modem/CSU-DSU: dữ liệu phát quay về đầu thu, giữ A với A, B với B.",
      loopFor: ["V.35 đồng bộ, 56 kbit/s … 2 Mbit/s (HDLC, PPP, Frame Relay)", "Cổng tự phát xung nhịp (xem test) — không có DCE cấp xung"],
      test:
        "Router Cisco: đặt đóng gói HDLC (mặc định), cắm nút; `show interfaces serial0/0` phải thấy \"line protocol is up (looped)\" — keepalive HDLC nhận lại chính mình; " +
        "`show controllers serial0/0` cho biết loại cáp (DTE/DCE) và có xung nhịp không. Thử thêm: `ping` địa chỉ của chính cổng (gói đi ra dây rồi quay về). " +
        "Không lên: không có xung nhịp — cổng DTE thuần cần SCT/SCR từ DCE. Không dùng cáp DCE với nút này (đầu cáp DCE cũng là M/34 cái nên không cắm vừa; ở DCE các chân E/F, V/Y là đầu ra nên cầu H-E-F, U-V-Y sẽ chập ra với ra). " +
        "Cho cổng DTE tự phát xung trên SCTE (U/W) để vòng về SCR/SCT qua nút — Cisco: lệnh interface `transmit-clock-internal` (CHƯA XÁC MINH theo từng dòng IOS); không có thì dùng lệnh `loopback` trong interface (loop nội, không kiểm dây).",
      standard: "Thực hành phổ biến; mạch theo ITU-T V.35/V.24, chân theo ISO 2593",
      vendor: false,
      detail:
        "Tự kiểm: SD A P (out) → RD A R (in), SD B S (out) → RD B T (in) — giữ A–A, B–B (đảo A/B là đảo bit, HDLC không đồng bộ được cờ 7E); " +
        "RTS C (out) → CTS D (in); DTR H (out) → DSR E, DCD F (in); SCTE U/W (out) → SCR V/X và SCT Y/AA (in): xung DTE trả về lại làm xung phát và thu của chính nó. " +
        "Mỗi cặp cân bằng đi bằng một cặp xoắn ngắn. Chân A (đất khung), B (đất tín hiệu), J, K và chân trống không nối. " +
        "CẦN KIỂM: (1) cổng DTE có tự phát SCTE khi không có SCT từ DCE hay không phụ thuộc phần cứng — nếu không, mạch xung U/W → V/X/Y/AA không có gì để vòng và cổng không lên; " +
        "(2) đối chiếu với sơ đồ nút loop V.35 do hãng công bố (Cisco/Black Box) — chưa tìm được bản gốc.",
      warnings: [
        "Không nối P↔T hoặc S↔R (A sang B): dây vẫn thông nhưng tín hiệu bị đảo.",
        "Không nối chéo xung nhịp SCT/SCR (Y/AA, V/X) với nhau — cả hai đều là đầu vào ở DTE."
      ]
    }
  ]);
})();
