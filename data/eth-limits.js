// Giới hạn kích thước khung Ethernet / IP / TCP theo chuẩn — dùng cho Máy tính (#calc).
// Mỗi mục: { value, unit, standard, note }. Không lặp cấu trúc header (đã có trong headers-*.js);
// overhead tunnel (GRE, VXLAN, MPLS, PPPoE…) lấy từ STACKS. Chỉ ghi giới hạn/quy tắc không suy được từ header.
// Nguồn chính: IEEE 802.3-2022, IEEE 802.1Q-2022, RFC 791, 1122, 1191, 2516, 4638, 4821, 6691, 8200, 8201, 8899, 9293,
// RFC 2475, 2697, 2698, MEF 10.3.
window.ETH_LIMITS = {
  // ---------------- Khung Ethernet (tính từ Destination MAC tới hết FCS, không gồm preamble/SFD) ----------------
  frame: {
    minFrame: {
      value: 64, unit: "byte",
      standard: "IEEE 802.3-2022 §4.4.2 (minFrameSize = 512 bit)",
      note: "Khung ngắn hơn 64 byte là runt, bị loại. Thiếu dữ liệu thì MAC thêm Pad (§3.2.8) để đủ 64 byte.",
    },
    minClientData: {
      value: 46, unit: "byte",
      standard: "IEEE 802.3-2022 §3.2.7, §3.2.8",
      note: "Vùng MAC client data tối thiểu 46 byte (khung không tag): 6 + 6 + 2 + 46 + 4 = 64. Có Q-tag thì tối thiểu 42 byte.",
    },
    maxBasic: {
      value: 1518, unit: "byte",
      standard: "IEEE 802.3-2022 §4.4.2 (maxBasicFrameSize), §3.2.7",
      note: "Khung cơ bản (không tag): client data ≤ 1500 byte → MTU IP chuẩn 1500.",
    },
    maxQTagged: {
      value: 1522, unit: "byte",
      standard: "IEEE 802.3-2022 §3.5, §4.4.2 (maxBasicFrameSize + qTagPrefixSize 4)",
      note: "Thêm một tag 802.1Q (4 byte) giữa Source MAC và Length/Type; client data vẫn ≤ 1500 nên MTU IP vẫn 1500.",
    },
    maxQinQ: {
      value: 1526, unit: "byte",
      standard: "IEEE 802.1Q-2022 Clause 9 (S-TAG 0x88A8 + C-TAG 0x8100); IEEE 802.3-2022 §3.2.7 (envelope frame)", // CHƯA XÁC MINH (không có văn bản IEEE): số Clause 9 / Bảng 9-1 của 802.1Q-2022
      note: "QinQ (802.1ad, nay gộp vào 802.1Q) có hai tag = 8 byte → 1500 + 26 = 1526. 802.3 không có giá trị riêng " +
        "\"1526\": khung này thuộc loại envelope frame (≤ 2000 byte), nên thiết bị hỗ trợ 802.3as nhận được mà không cần jumbo.",
    },
    maxEnvelope: {
      value: 2000, unit: "byte",
      standard: "IEEE 802.3as-2006, nay là IEEE 802.3-2022 §3.2.7, §4.4.2 (maxEnvelopeFrameSize)",
      note: "Envelope frame cho phép tiền tố/hậu tố đóng gói (tag, nhãn…) nhưng dữ liệu client gốc vẫn ≤ 1500 byte. " +
        "Đây là giới hạn chuẩn lớn nhất của 802.3; trên mức này là jumbo (phi chuẩn).",
    },
    envelopeEncapMax: {
      value: 482, unit: "byte",
      standard: "IEEE 802.3-2022 §3.2.7 (client data envelope ≤ 1982 = 1500 + 482)",
      note: "Phần tiền tố + hậu tố đóng gói tối đa trong envelope frame. Không phải giấy phép tăng MTU IP lên 1982.",
    },
    preambleSfd: {
      value: 8, unit: "byte",
      standard: "IEEE 802.3-2022 §3.2.1 (Preamble 7 byte), §3.2.2 (SFD 1 byte)",
      note: "Không tính vào kích thước khung nhưng chiếm thời gian trên dây.",
    },
    ifg: {
      value: 12, unit: "byte",
      standard: "IEEE 802.3-2022 §4.4.2 (interPacketGap = 96 bit)", // CHƯA XÁC MINH: tên tham số trong §4.4.2
      note: "Khoảng lặng tối thiểu giữa hai khung. Overhead trên dây mỗi khung = 8 + 12 = 20 byte ngoài khung → khung 64 byte chiếm 84 byte thời gian.",
    },
    jumboMtu: {
      value: 9000, unit: "byte (MTU IP)",
      standard: "Phi chuẩn — IEEE 802.3 không định nghĩa jumbo frame",
      note: "Giá trị thực tế, tuỳ hãng: MTU 9000 phổ biến nhất trên máy chủ/NIC. Mọi thiết bị trên cùng miền L2 phải cấu hình giống nhau, " +
        "nếu không khung lớn bị rớt im lặng (không có ICMP ở lớp 2).",
    },
    jumboFrame: {
      value: 9216, unit: "byte (khung)",
      standard: "Phi chuẩn — giá trị thường gặp trên switch/router",
      note: "Thực tế, tuỳ hãng: nhiều switch cho khung tối đa 9216 byte (một số hãng 9100, 9198, 9600, 10240…). " +
        "Lấy giới hạn này của từng thiết bị trên đường đi, chọn nhỏ nhất.",
    },
  },

  // Vùng tô màu cho thanh L (kích thước khung, byte). UI kẹp L trong [64, jumbo max] và cảnh báo theo vùng.
  zones: [
    { id: "runt", from: 0, to: 63, label: "Dưới tối thiểu (runt)", standard: "IEEE 802.3-2022 §4.4.2", note: "Không hợp lệ — bị loại; MAC tự thêm Pad." },
    { id: "standard", from: 64, to: 1522, label: "Chuẩn (basic 1518 / Q-tag 1522)", standard: "IEEE 802.3-2022 §3.2.7, §4.4.2", note: "Mọi thiết bị Ethernet phải nhận." },
    { id: "envelope", from: 1523, to: 2000, label: "Envelope (802.3as)", standard: "IEEE 802.3-2022 §3.2.7, §4.4.2", note: "Chuẩn cho khung có thêm tag/nhãn đóng gói (QinQ, MPLS, PBB…); client data gốc vẫn ≤ 1500." },
    { id: "jumbo", from: 2001, to: 9216, label: "Jumbo (phi chuẩn)", standard: "Không có chuẩn IEEE", note: "Thực tế, tuỳ hãng; phải bật jumbo trên mọi thiết bị trên đường đi." },
  ],

  // ---------------- IPv4 ----------------
  ipv4: {
    totalLengthMax: {
      value: 65535, unit: "byte",
      standard: "RFC 791 §3.1 (Total Length 16 bit)",
      note: "Tổng chiều dài gói (header + dữ liệu) tối đa. Gói lớn hơn MTU đường đi phải phân mảnh hoặc bị rớt (DF = 1).",
    },
    minMtu: {
      value: 68, unit: "byte",
      standard: "RFC 791 §3.2 (Discussion – Fragmentation and Reassembly)",
      note: "Mọi module IP phải chuyển được gói 68 byte không phân mảnh thêm: header tối đa 60 + mảnh tối thiểu 8.",
    },
    minReassembly: {
      value: 576, unit: "byte",
      standard: "RFC 791 §3.1 (Total Length); RFC 1122 §3.3.2 (EMTU_R ≥ 576)",
      note: "Mọi host phải nhận được gói (sau ráp mảnh) 576 byte. Không gửi gói > 576 tới đích lạ trừ khi biết đích nhận được (hoặc dùng PMTUD).",
    },
    fragOffsetUnit: {
      value: 8, unit: "byte",
      standard: "RFC 791 §3.1 (Fragment Offset, đơn vị 8 octet)",
      note: "Mọi mảnh trừ mảnh cuối phải có phần dữ liệu là bội 8 byte. Dữ liệu mỗi mảnh = ⌊(MTU − IHL×4) / 8⌋ × 8; " +
        "mỗi mảnh mang lại header IP riêng (chỉ một số option được chép).",
    },
    fragOffsetMax: {
      value: 65528, unit: "byte",
      standard: "RFC 791 §3.1 (Fragment Offset 13 bit)",
      note: "Offset lớn nhất = 8191 × 8 = 65 528 byte.",
    },
    dfBit: {
      value: 1, unit: "bit",
      standard: "RFC 791 §3.1 (cờ DF); RFC 1191 §3",
      note: "DF = 1: router không được phân mảnh; gói > MTU bị rớt và gửi ICMP Destination Unreachable type 3 code 4 (Fragmentation Needed) — cơ sở của PMTUD.",
    },
  },

  // ---------------- IPv6 ----------------
  ipv6: {
    minMtu: {
      value: 1280, unit: "byte",
      standard: "RFC 8200 §5",
      note: "Mọi liên kết mang IPv6 phải có MTU ≥ 1280; liên kết nhỏ hơn phải tự phân mảnh/ráp ở lớp dưới IPv6.",
    },
    minReassembly: {
      value: 1500, unit: "byte",
      standard: "RFC 8200 §5",
      note: "Node phải nhận được gói phân mảnh có kích thước sau ráp tới 1500 byte.",
    },
    payloadLengthMax: {
      value: 65535, unit: "byte",
      standard: "RFC 8200 §3 (Payload Length 16 bit)",
      note: "Không gồm header cố định 40 byte → gói tối đa 65 575 byte. Jumbogram (RFC 2675) bỏ qua ở đây.",
    },
    fragmentation: {
      value: 0, unit: "router phân mảnh",
      standard: "RFC 8200 §4.5, §5",
      note: "Router IPv6 không phân mảnh: gói > MTU bị rớt và gửi ICMPv6 Packet Too Big (RFC 4443 §3.2, type 2). " +
        "Chỉ nguồn được phân mảnh, dùng Fragment header 8 byte; offset cũng theo đơn vị 8 byte.",
    },
  },

  // ---------------- TCP MSS ----------------
  tcp: {
    mssDefaultV4: {
      value: 536, unit: "byte",
      standard: "RFC 9293 §3.7.1; RFC 879",
      note: "Không nhận được option MSS thì giả định 536 = 576 − 20 (IPv4) − 20 (TCP).",
    },
    mssDefaultV6: {
      value: 1220, unit: "byte",
      standard: "RFC 9293 §3.7.1; RFC 8200 §8.3",
      note: "Mặc định cho IPv6 = 1280 − 40 − 20.",
    },
    mssOverheadV4: {
      value: 40, unit: "byte trừ khỏi MTU",
      standard: "RFC 9293 §3.7.1; RFC 6691 §2",
      note: "MSS = MTU − 20 (IPv4) − 20 (TCP). Tính theo header cố định, không trừ option (RFC 6691); bên gửi tự trừ phần option khi đóng gói. Ví dụ MTU 1500 → MSS 1460.",
    },
    mssOverheadV6: {
      value: 60, unit: "byte trừ khỏi MTU",
      standard: "RFC 8200 §8.3; RFC 9293 §3.7.1",
      note: "MSS = MTU − 40 (IPv6) − 20 (TCP); có extension header thì trừ thêm. Ví dụ MTU 1500 → MSS 1440.",
    },
    mssClamping: {
      value: null, unit: "—",
      standard: "Thực hành của hãng (không có RFC chuẩn hoá); bối cảnh: RFC 4459 §3.2, RFC 2923",
      note: "Router/BNG sửa option MSS trong gói SYN đi qua xuống MTU tunnel − 40 (vd PPPoE 1492 → 1452) để tránh phân mảnh/PMTUD hỏng. Chỉ tác dụng với TCP.",
    },
  },

  // ---------------- Dò MTU đường đi ----------------
  pmtud: {
    ipv4: {
      value: 68, unit: "byte (PMTU tối thiểu)",
      standard: "RFC 1191 §3, §4",
      note: "Nguồn đặt DF = 1; router không chuyển được gửi ICMP type 3 code 4 kèm Next-Hop MTU; nguồn giảm PMTU theo giá trị đó.",
    },
    ipv6: {
      value: 1280, unit: "byte (PMTU tối thiểu)",
      standard: "RFC 8201 §4; RFC 4443 §3.2",
      note: "Dựa vào ICMPv6 Packet Too Big; PMTU không bao giờ giảm dưới 1280.",
    },
    plpmtud: {
      value: null, unit: "—",
      standard: "RFC 4821 (TCP/SCTP); RFC 8899 (giao thức datagram, DPLPMTUD)",
      note: "Dò MTU bằng chính gói thăm dò của lớp truyền tải, không phụ thuộc ICMP — dùng khi ICMP bị firewall chặn.",
    },
    blackHole: {
      value: null, unit: "—",
      standard: "RFC 2923 §2.1",
      note: "Hố đen PMTUD: ICMP Fragmentation Needed/Packet Too Big bị chặn → gói lớn rớt im lặng, phiên TCP treo sau bắt tay. Khắc phục: MSS clamping, PLPMTUD, hạ MTU.",
    },
  },

  // Gợi ý MTU có ràng buộc chuẩn riêng (không chỉ là phép trừ overhead của stack). Overhead các stack khác lấy từ STACKS.
  mtuHints: [
    {
      id: "pppoe", stack: "pppoe-session",
      value: 1492, unit: "byte (MTU/MRU PPP)",
      standard: "RFC 2516 §7",
      note: "MRU không được thương lượng lớn hơn 1492 (1500 − 6 PPPoE − 2 PPP Protocol). MSS IPv4 tương ứng 1452.",
    },
    {
      id: "pppoe-rfc4638", stack: "pppoe-session",
      value: 1500, unit: "byte (MTU/MRU PPP)",
      standard: "RFC 4638 §4 (tag PPP-Max-Payload)",
      note: "Cho phép MRU > 1492 (thường 1500) nếu hai đầu thoả thuận tag PPP-Max-Payload và Ethernet bên dưới mang được payload Ethernet lớn hơn 1500 — baby giant (RFC 4638 §3). " +
        "Payload Ethernet cần 1508 = 1500 + 6 (PPPoE) + 2 (PPP Protocol): đây là phép tính, RFC không nêu con số này.",
    },
  ],

  // ---------------- Kịch bản ----------------
  scenarios: {
    rateLimit: {
      title: "Cổng 1G khai báo 150M",
      summary:
        "Cổng vật lý vẫn chạy 1 Gbit/s; 150M là tốc độ cam kết (CIR) áp bằng policer hoặc shaper ở lớp gói, " +
        "hoặc bằng dung lượng container khi đi qua truyền dẫn (VCAT/ODUflex). Burst trong cửa sổ ngắn vẫn ở tốc độ dây 1G.",
      items: {
        policerSrTcm: {
          value: null, unit: "—",
          standard: "RFC 2697 (srTCM: CIR, CBS, EBS)",
          note: "Token bucket một tốc độ: token nạp với tốc độ CIR vào bucket C (≤ CBS) và E (≤ EBS); gói đánh dấu xanh/vàng/đỏ, đỏ thường bị rớt. " +
            "§2: khuyến nghị CBS, EBS ≥ kích thước gói IP lớn nhất.",
        },
        policerTrTcm: {
          value: null, unit: "—",
          standard: "RFC 2698 (trTCM: CIR, CBS, PIR, PBS); RFC 4115",
          note: "Hai tốc độ: PIR/PBS giới hạn đỉnh, CIR/CBS phần cam kết. Ví dụ CIR 150 Mbit/s, PIR 200 Mbit/s.",
        },
        bandwidthProfile: {
          value: null, unit: "—",
          standard: "MEF 10.3 §12 (Bandwidth Profile at the UNI), §12.1, [R145]",
          note: "Mỗi Bandwidth Profile Flow có CIR, CIRmax, CBS, EIR, EIRmax, EBS, CF, CM, Envelope và Rank (mỗi Envelope có thêm CF0); " +
            "bộ CIR/CBS/EIR/EBS/CF/CM là của MEF 10.2. Khi CIR > 0, CBS phải ≥ EVC Maximum Service Frame Size ([R145]).",
        },
        policeVsShape: {
          value: null, unit: "—",
          standard: "RFC 2475 §2.3.3.3 (shaper), §2.3.3.4 (dropper)",
          note: "Policer rớt/đánh dấu ngay gói vượt bucket (không trễ thêm) → TCP bị mất gói, thông lượng dao động dưới CIR nếu CBS nhỏ. " +
            "Shaper xếp hàng gói vượt và phát ra đều theo CIR → thêm trễ nhưng ít rớt; nên shape ở phía gửi (CE) khớp với policer phía nhà mạng.",
        },
        cbsRule: {
          value: null, unit: "byte",
          standard: "Quy tắc thực hành (không phải chuẩn): CBS ≈ CIR × RTT / 8",
          note: "Bucket đủ chứa một cửa sổ TCP ở tốc độ CIR thì TCP đạt gần CIR. Ví dụ CIR 150 Mbit/s, RTT 20 ms → 150 000 000 × 0,02 / 8 = 375 000 byte. " +
            "Tối thiểu theo chuẩn chỉ là ≥ một khung lớn nhất (RFC 2697 §2); CBS quá nhỏ (vài khung) làm TCP rất kém.",
        },
        transportNote: {
          value: 149760, unit: "kbit/s (C-4)",
          standard: "ITU-T G.707 (C-4 = 260 × 9 × 8 bit × 8000/s)",
          note: "Đi qua SDH bằng VC-4-1v (EoS, GFP-F) thì dung lượng là 149 760 kbit/s, hơi dưới 150 Mbit/s và còn trừ overhead GFP " +
            "— cổng 1G chỉ được 'cắt' bằng container, phần thừa phải được policer/shaper hoặc bộ đệm của thiết bị EoS xử lý.",
        },
      },
    },
  },
};
