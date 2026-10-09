// Header lớp 3 / lớp 4 và payload: IPv4, IPv6, TCP, UDP, Payload.
// Schema: .claude/skills/protocol-header-spec/references/data-schema.md
window.HEADERS = window.HEADERS || {};

Object.assign(window.HEADERS, {
  "ipv4": {
    id: "ipv4",
    name: "Internet Protocol version 4",
    short: "IPv4",
    layer: "l3",
    standard: "RFC 791 §3.1, RFC 2474 (DSCP), RFC 3168 (ECN), RFC 6864 (ID)",
    summary: "Header IPv4 20–60 byte mang địa chỉ nguồn/đích 32 bit để định tuyến gói qua nhiều mạng.",
    detail: "Router đọc Destination Address để tra bảng định tuyến, giảm TTL mỗi hop và tính lại Header Checksum. " +
      "IHL (đơn vị từ 32 bit) cho biết độ dài header: 5 = 20 byte không option, tối đa 15 = 60 byte. " +
      "Nhóm Identification + Flags + Fragment Offset phục vụ phân mảnh khi gói lớn hơn MTU; DF=1 dùng cho Path MTU Discovery. " +
      "Trường Protocol là điểm chuyển giao sang lớp 4 (6 = TCP, 17 = UDP) hoặc tunnel (47 = GRE, 50 = ESP).",
    fixedBytes: 20,
    maxBytes: 60,
    fields: [
      {
        id: "ver-ihl",
        name: "Version / IHL",
        desc: "Octet đầu: phiên bản IP và độ dài header. Với IPv4 không option, octet này là 0x45.",
        children: [
          {
            id: "version",
            name: "Version",
            abbr: "Ver",
            bits: 4,
            desc: "Phiên bản giao thức IP, luôn là 4 với IPv4.",
            values: [{ v: "4", m: "IPv4" }],
            example: "4"
          },
          {
            id: "ihl",
            name: "Internet Header Length",
            abbr: "IHL",
            bits: 4,
            desc: "Độ dài header tính theo từ 32 bit (4 byte). Tối thiểu 5 (20 byte), tối đa 15 (60 byte).",
            values: [
              { v: "5", m: "20 byte – không có option" },
              { v: "15", m: "60 byte – 40 byte option" }
            ],
            example: "5"
          }
        ]
      },
      {
        id: "tos",
        name: "Type of Service / DS Field",
        abbr: "ToS",
        desc: "Octet phân loại dịch vụ: 6 bit DSCP cho QoS và 2 bit ECN báo nghẽn (định nghĩa lại octet ToS cũ của RFC 791).",
        children: [
          {
            id: "dscp",
            name: "Differentiated Services Code Point",
            abbr: "DSCP",
            bits: 6,
            desc: "Lớp dịch vụ QoS mà router dùng để xếp hàng/đánh rơi (Per-Hop Behavior).",
            values: [
              { v: "0", m: "CS0 / Best Effort" },
              { v: "10", m: "AF11" },
              { v: "26", m: "AF31" },
              { v: "34", m: "AF41 – video" },
              { v: "46", m: "EF – thoại" },
              { v: "48", m: "CS6 – điều khiển mạng (BGP, OSPF)" },
              { v: "56", m: "CS7" }
            ],
            example: "0"
          },
          {
            id: "ecn",
            name: "Explicit Congestion Notification",
            abbr: "ECN",
            bits: 2,
            desc: "Cho phép router đánh dấu nghẽn thay vì đánh rơi gói (RFC 3168).",
            values: [
              { v: "00", m: "Not-ECT – không hỗ trợ ECN" },
              { v: "01", m: "ECT(1)" },
              { v: "10", m: "ECT(0)" },
              { v: "11", m: "CE – Congestion Experienced" }
            ],
            example: "00"
          }
        ]
      },
      {
        id: "total-length",
        name: "Total Length",
        abbr: "Total Len",
        bits: 16,
        desc: "Tổng độ dài gói IP (header + dữ liệu) tính bằng byte, tối đa 65535. Trên Ethernet thường ≤ 1500 (MTU).",
        example: "1500"
      },
      {
        id: "fragmentation",
        name: "Fragmentation (Identification + Flags + Fragment Offset)",
        desc: "Các trường phục vụ phân mảnh và ghép lại gói khi vượt MTU.",
        children: [
          {
            id: "identification",
            name: "Identification",
            abbr: "ID",
            bits: 16,
            desc: "Mã định danh gói; mọi mảnh của cùng một gói gốc mang cùng ID để bên nhận ghép lại.",
            example: "0x1C46"
          },
          {
            id: "flags-frag",
            name: "Flags + Fragment Offset",
            desc: "16 bit gồm 3 bit cờ phân mảnh và 13 bit vị trí mảnh.",
            children: [
              {
                id: "flags",
                name: "Flags",
                desc: "3 bit cờ điều khiển phân mảnh: Reserved, DF, MF.",
                children: [
                  {
                    id: "flag-reserved",
                    name: "Reserved",
                    abbr: "R",
                    bits: 1,
                    reserved: true,
                    desc: "Bit dự trữ, phải bằng 0.",
                    example: "0"
                  },
                  {
                    id: "df",
                    name: "Don't Fragment",
                    abbr: "DF",
                    bits: 1,
                    desc: "1 = cấm phân mảnh; router gặp MTU nhỏ hơn sẽ bỏ gói và gửi ICMP \"Fragmentation Needed\" (cơ chế Path MTU Discovery).",
                    values: [
                      { v: "0", m: "Cho phép phân mảnh" },
                      { v: "1", m: "Không phân mảnh" }
                    ],
                    example: "1"
                  },
                  {
                    id: "mf",
                    name: "More Fragments",
                    abbr: "MF",
                    bits: 1,
                    desc: "1 = còn mảnh phía sau; mảnh cuối cùng (hoặc gói không phân mảnh) có MF = 0.",
                    values: [
                      { v: "0", m: "Mảnh cuối / không phân mảnh" },
                      { v: "1", m: "Còn mảnh tiếp theo" }
                    ],
                    example: "0"
                  }
                ]
              },
              {
                id: "frag-offset",
                name: "Fragment Offset",
                abbr: "Frag Offset",
                bits: 13,
                desc: "Vị trí của mảnh này trong dữ liệu gói gốc, tính theo đơn vị 8 byte. Mảnh đầu tiên có offset 0.",
                example: "0"
              }
            ]
          }
        ]
      },
      {
        id: "ttl",
        name: "Time to Live",
        abbr: "TTL",
        bits: 8,
        desc: "Mỗi router giảm 1; về 0 thì bỏ gói và gửi ICMP Time Exceeded – chống vòng lặp định tuyến (traceroute khai thác điều này).",
        values: [
          { v: "64", m: "Mặc định Linux/macOS" },
          { v: "128", m: "Mặc định Windows" },
          { v: "255", m: "Mặc định Cisco IOS, giao thức link-local (GTSM)" }
        ],
        example: "64"
      },
      {
        id: "protocol",
        name: "Protocol",
        abbr: "Proto",
        bits: 8,
        desc: "Giao thức của dữ liệu bên trong gói IP – điểm chuyển giao sang lớp 4 hoặc tunnel.",
        values: [
          { v: "1", m: "ICMP" },
          { v: "2", m: "IGMP" },
          { v: "4", m: "IPv4-in-IPv4 (IP-in-IP)" },
          { v: "6", m: "TCP" },
          { v: "17", m: "UDP" },
          { v: "41", m: "IPv6 encapsulation (6in4)" },
          { v: "47", m: "GRE" },
          { v: "50", m: "ESP (IPsec)" },
          { v: "51", m: "AH (IPsec)" },
          { v: "89", m: "OSPF" },
          { v: "103", m: "PIM" },
          { v: "112", m: "VRRP" },
          { v: "132", m: "SCTP" },
          { v: "137", m: "MPLS-in-IP" },
          { v: "253", m: "Dành cho thử nghiệm (RFC 3692)" },
          { v: "254", m: "Dành cho thử nghiệm (RFC 3692)" }
        ],
        example: "6"
      },
      {
        id: "header-checksum",
        name: "Header Checksum",
        abbr: "Checksum",
        bits: 16,
        desc: "Tổng bù một (one's complement) 16 bit chỉ trên header IP; router phải tính lại mỗi hop vì TTL thay đổi.",
        example: "0xB1E6"
      },
      {
        id: "addresses",
        name: "Source / Destination Address",
        desc: "Hai địa chỉ IPv4 32 bit của máy gửi và máy nhận cuối cùng (không đổi qua các router, trừ khi có NAT).",
        children: [
          {
            id: "src",
            name: "Source Address",
            abbr: "Src IP",
            bits: 32,
            desc: "Địa chỉ IPv4 của máy gửi.",
            example: "192.168.1.10"
          },
          {
            id: "dst",
            name: "Destination Address",
            abbr: "Dst IP",
            bits: 32,
            desc: "Địa chỉ IPv4 của máy nhận; router tra longest-prefix-match trên địa chỉ này.",
            example: "203.0.113.5"
          }
        ]
      },
      {
        id: "options",
        name: "Options + Padding",
        abbr: "Options",
        varBytes: { min: 0, max: 40, default: 0 },
        desc: "Tuỳ chọn (Record Route, Timestamp, Router Alert…) hiếm dùng; độ dài được đệm cho đủ bội số 4 byte và phản ánh trong IHL.",
        values: [
          { v: "7", m: "Record Route" },
          { v: "68", m: "Timestamp" },
          { v: "148", m: "Router Alert (RSVP, IGMP)" }
        ]
      }
    ],
    variants: [
      { id: "no-options", name: "Không option", enable: [], varBytes: { options: 0 }, set: { ihl: "5" }, bytes: 20,
        note: "Gần như mọi gói IPv4 thông thường." },
      { id: "router-alert", name: "Router Alert", enable: [], varBytes: { options: 4 }, set: { ihl: "6" }, bytes: 24,
        note: "Option 4 byte (RFC 2113) báo router xử lý gói đặc biệt, gặp ở IGMP, RSVP." },
      { id: "max-options", name: "Option tối đa", enable: [], varBytes: { options: 40 }, set: { ihl: "15" }, bytes: 60,
        note: "40 byte option, vd. Record Route 39 byte + 1 byte đệm; options luôn phải đệm tới bội số 4 byte." }
    ],
  },

  "ipv6": {
    id: "ipv6",
    name: "Internet Protocol version 6",
    short: "IPv6",
    layer: "l3",
    standard: "RFC 8200 §3, RFC 2474, RFC 3168, RFC 6437 (Flow Label)",
    summary: "Header IPv6 cố định 40 byte với địa chỉ 128 bit; tính năng mở rộng nằm trong Extension Header.",
    detail: "So với IPv4, IPv6 bỏ Header Checksum, bỏ phân mảnh tại router (chỉ máy nguồn phân mảnh qua Fragment Extension Header) và bỏ option trong header chính. " +
      "Next Header thay cho Protocol, có thể trỏ tới Extension Header (Hop-by-Hop 0, Routing 43, Fragment 44…) hoặc trực tiếp TCP/UDP. " +
      "Hop Limit thay cho TTL. MTU tối thiểu của đường truyền IPv6 là 1280 byte.",
    fixedBytes: 40,
    fields: [
      {
        id: "first-word",
        name: "Version / Traffic Class / Flow Label",
        desc: "Từ 32 bit đầu tiên: phiên bản, lớp lưu lượng (QoS) và nhãn luồng.",
        children: [
          {
            id: "version",
            name: "Version",
            abbr: "Ver",
            bits: 4,
            desc: "Phiên bản IP, luôn bằng 6.",
            values: [{ v: "6", m: "IPv6" }],
            example: "6"
          },
          {
            id: "traffic-class",
            name: "Traffic Class",
            abbr: "TC",
            desc: "8 bit tương đương octet DS của IPv4: DSCP + ECN.",
            children: [
              {
                id: "dscp",
                name: "Differentiated Services Code Point",
                abbr: "DSCP",
                bits: 6,
                desc: "Lớp dịch vụ QoS, cùng ý nghĩa với DSCP của IPv4.",
                values: [
                  { v: "0", m: "Best Effort" },
                  { v: "34", m: "AF41" },
                  { v: "46", m: "EF – thoại" },
                  { v: "48", m: "CS6" }
                ],
                example: "0"
              },
              {
                id: "ecn",
                name: "Explicit Congestion Notification",
                abbr: "ECN",
                bits: 2,
                desc: "Báo nghẽn tường minh (RFC 3168), như IPv4.",
                values: [
                  { v: "00", m: "Not-ECT" },
                  { v: "11", m: "CE – Congestion Experienced" }
                ],
                example: "00"
              }
            ]
          },
          {
            id: "flow-label",
            name: "Flow Label",
            bits: 20,
            desc: "Nhãn do máy nguồn gán cho một luồng; router/ECMP có thể dùng cùng địa chỉ để băm cân bằng tải mà không cần đọc header lớp 4. 0 = không gán.",
            example: "0x12345"
          }
        ]
      },
      {
        id: "payload-length",
        name: "Payload Length",
        abbr: "Payload Len",
        bits: 16,
        desc: "Độ dài phần sau header cố định 40 byte (gồm cả Extension Header), tính bằng byte. Khác IPv4: không tính header chính.",
        example: "1460"
      },
      {
        id: "next-header",
        name: "Next Header",
        abbr: "Next Hdr",
        bits: 8,
        desc: "Loại header ngay sau header IPv6: Extension Header hoặc giao thức lớp trên (dùng cùng bảng số với IPv4 Protocol).",
        values: [
          { v: "0", m: "Hop-by-Hop Options" },
          { v: "6", m: "TCP" },
          { v: "17", m: "UDP" },
          { v: "43", m: "Routing Header (SRv6 dùng SRH)" },
          { v: "44", m: "Fragment Header" },
          { v: "47", m: "GRE" },
          { v: "50", m: "ESP" },
          { v: "58", m: "ICMPv6 (ND, RA, ping)" },
          { v: "59", m: "No Next Header" },
          { v: "60", m: "Destination Options" }
        ],
        example: "6"
      },
      {
        id: "hop-limit",
        name: "Hop Limit",
        bits: 8,
        desc: "Giống TTL của IPv4: giảm 1 mỗi hop, về 0 thì bỏ gói và gửi ICMPv6 Time Exceeded. ND/RA bắt buộc dùng 255.",
        values: [
          { v: "64", m: "Mặc định nhiều hệ điều hành" },
          { v: "255", m: "Neighbor Discovery (bắt buộc)" }
        ],
        example: "64"
      },
      {
        id: "addresses",
        name: "Source / Destination Address",
        desc: "Hai địa chỉ IPv6 128 bit của máy gửi và máy nhận.",
        children: [
          {
            id: "src",
            name: "Source Address",
            abbr: "Src IP",
            bits: 128,
            desc: "Địa chỉ IPv6 của máy gửi (thường global unicast 2000::/3 hoặc link-local fe80::/10).",
            example: "2001:db8::10"
          },
          {
            id: "dst",
            name: "Destination Address",
            abbr: "Dst IP",
            bits: 128,
            desc: "Địa chỉ IPv6 của máy nhận (hoặc của segment kế tiếp nếu có Routing Header); có thể là multicast ff00::/8.",
            example: "2001:db8::5"
          }
        ]
      }
    ]
  },

  "tcp": {
    id: "tcp",
    name: "Transmission Control Protocol",
    short: "TCP",
    layer: "l4",
    standard: "RFC 9293 §3.1, RFC 3168 (ECE/CWR)",
    summary: "Header TCP 20–60 byte cung cấp kết nối tin cậy, có thứ tự, kiểm soát luồng giữa hai ứng dụng.",
    detail: "Cặp cổng nguồn/đích cùng địa chỉ IP xác định một kết nối (socket). Sequence/Acknowledgment Number đánh số từng byte để đảm bảo thứ tự và truyền lại khi mất. " +
      "Kết nối mở bằng bắt tay 3 bước SYN → SYN+ACK → ACK, đóng bằng FIN hoặc RST. " +
      "Data Offset (đơn vị từ 32 bit) cho biết độ dài header; option phổ biến: MSS, Window Scale, SACK, Timestamp.",
    fixedBytes: 20,
    maxBytes: 60,
    fields: [
      {
        id: "ports",
        name: "Source / Destination Port",
        desc: "Hai cổng 16 bit xác định ứng dụng ở hai đầu kết nối.",
        children: [
          {
            id: "src-port",
            name: "Source Port",
            abbr: "Src Port",
            bits: 16,
            desc: "Cổng của ứng dụng gửi; phía client thường là cổng tạm (ephemeral, 49152–65535).",
            example: "51514"
          },
          {
            id: "dst-port",
            name: "Destination Port",
            abbr: "Dst Port",
            bits: 16,
            desc: "Cổng của ứng dụng nhận; phía server thường là cổng well-known.",
            values: [
              { v: "20/21", m: "FTP data/control" },
              { v: "22", m: "SSH" },
              { v: "23", m: "Telnet" },
              { v: "25", m: "SMTP" },
              { v: "53", m: "DNS (zone transfer, phản hồi lớn)" },
              { v: "80", m: "HTTP" },
              { v: "179", m: "BGP" },
              { v: "443", m: "HTTPS" },
              { v: "646", m: "LDP (phiên)" },
              { v: "830", m: "NETCONF over SSH" }
            ],
            example: "443"
          }
        ]
      },
      {
        id: "seq",
        name: "Sequence Number",
        abbr: "Seq",
        bits: 32,
        desc: "Số thứ tự của byte dữ liệu đầu tiên trong segment. Khi SYN = 1, đây là Initial Sequence Number (ISN) chọn ngẫu nhiên.",
        example: "1000"
      },
      {
        id: "ack",
        name: "Acknowledgment Number",
        abbr: "Ack",
        bits: 32,
        desc: "Khi cờ ACK = 1: số thứ tự byte tiếp theo mà bên gửi đang chờ nhận (xác nhận tích luỹ mọi byte trước đó).",
        example: "2001"
      },
      {
        id: "offset-flags",
        name: "Data Offset / Reserved / Flags",
        desc: "16 bit gồm độ dài header, 4 bit dự trữ và 8 cờ điều khiển.",
        children: [
          {
            id: "data-offset",
            name: "Data Offset",
            abbr: "Offset",
            bits: 4,
            desc: "Độ dài header TCP tính theo từ 32 bit: 5 = 20 byte (không option), tối đa 15 = 60 byte.",
            values: [
              { v: "5", m: "20 byte – không option" },
              { v: "8", m: "32 byte – thường gặp (Timestamp)" },
              { v: "15", m: "60 byte – tối đa" }
            ],
            example: "5"
          },
          {
            id: "reserved",
            name: "Reserved",
            abbr: "Rsv",
            bits: 4,
            reserved: true,
            desc: "Dự trữ, phải bằng 0 (RFC 9293 để 4 bit; bit cuối từng được RFC 3540 dùng làm NS, nay đã bỏ).",
            example: "0000"
          },
          {
            id: "flags",
            name: "Control Flags",
            abbr: "Flags",
            desc: "8 cờ điều khiển trạng thái kết nối. Các tổ hợp hay gặp: SYN, SYN+ACK, ACK, PSH+ACK, FIN+ACK, RST.",
            children: [
              {
                id: "cwr",
                name: "Congestion Window Reduced",
                abbr: "CWR",
                bits: 1,
                desc: "Bên gửi báo đã giảm cửa sổ nghẽn sau khi nhận ECE (RFC 3168)."
              },
              {
                id: "ece",
                name: "ECN-Echo",
                abbr: "ECE",
                bits: 1,
                desc: "Báo lại cho bên gửi rằng gói đã bị router đánh dấu CE; trong SYN dùng để thoả thuận hỗ trợ ECN."
              },
              {
                id: "urg",
                name: "Urgent",
                abbr: "URG",
                bits: 1,
                desc: "Trường Urgent Pointer có ý nghĩa. Hầu như không dùng trong ứng dụng hiện đại."
              },
              {
                id: "ack-flag",
                name: "Acknowledgment",
                abbr: "ACK",
                bits: 1,
                desc: "Trường Acknowledgment Number hợp lệ. Bật trên mọi segment sau SYN đầu tiên."
              },
              {
                id: "psh",
                name: "Push",
                abbr: "PSH",
                bits: 1,
                desc: "Yêu cầu đẩy dữ liệu lên ứng dụng ngay, không chờ đầy bộ đệm."
              },
              {
                id: "rst",
                name: "Reset",
                abbr: "RST",
                bits: 1,
                desc: "Huỷ kết nối ngay lập tức (cổng đóng, kết nối không hợp lệ)."
              },
              {
                id: "syn",
                name: "Synchronize",
                abbr: "SYN",
                bits: 1,
                desc: "Mở kết nối và đồng bộ số thứ tự ban đầu (bước 1 và 2 của bắt tay 3 bước)."
              },
              {
                id: "fin",
                name: "Finish",
                abbr: "FIN",
                bits: 1,
                desc: "Bên gửi không còn dữ liệu, bắt đầu đóng kết nối một chiều."
              }
            ]
          }
        ]
      },
      {
        id: "window",
        name: "Window Size",
        abbr: "Window",
        bits: 16,
        desc: "Số byte bên nhận còn sẵn sàng nhận (kiểm soát luồng). Có option Window Scale thì giá trị thật = Window × 2^scale.",
        example: "64240"
      },
      {
        id: "checksum",
        name: "Checksum",
        bits: 16,
        desc: "Tổng bù một trên pseudo-header IP (địa chỉ, protocol, độ dài) + header TCP + dữ liệu. Bắt buộc.",
        example: "0x3A5F"
      },
      {
        id: "urgent-pointer",
        name: "Urgent Pointer",
        abbr: "Urg Ptr",
        bits: 16,
        desc: "Chỉ có nghĩa khi URG = 1: offset từ Sequence Number tới cuối dữ liệu khẩn. Thường bằng 0.",
        example: "0"
      },
      {
        id: "options",
        name: "Options + Padding",
        abbr: "Options",
        varBytes: { min: 0, max: 40, default: 0 },
        desc: "Tuỳ chọn TCP, đệm đủ bội số 4 byte, độ dài phản ánh trong Data Offset. Thường thấy trong SYN: MSS, SACK-Permitted, Timestamp, Window Scale.",
        values: [
          { v: "2", m: "MSS – Maximum Segment Size (vd. 1460)" },
          { v: "3", m: "Window Scale" },
          { v: "4", m: "SACK Permitted" },
          { v: "5", m: "SACK" },
          { v: "8", m: "Timestamps" },
          { v: "29", m: "TCP-AO (bảo vệ phiên BGP)" }
        ]
      }
    ],
    variants: [
      { id: "no-options", name: "Không option", enable: [], varBytes: { options: 0 }, set: { "data-offset": "5" }, bytes: 20,
        note: "Segment không dùng option, vd. segment RST, hoặc segment dữ liệu/ACK trên Windows (mặc định tắt Timestamps)." },
      { id: "mss-only", name: "Chỉ MSS", enable: [], varBytes: { options: 4 }, set: { "data-offset": "6" }, bytes: 24,
        note: "SYN chỉ thông báo MSS, gặp ở thiết bị nhúng hoặc stack TCP tối giản." },
      { id: "ack-timestamps", name: "ACK + Timestamps", enable: [], varBytes: { options: 12 }, set: { "data-offset": "8" }, bytes: 32,
        note: "NOP 1 + NOP 1 + Timestamps 10 = 12 byte option; phổ biến trên Linux cho segment ACK/dữ liệu sau handshake." },
      { id: "syn-linux", name: "SYN điển hình Linux", enable: [], varBytes: { options: 20 }, set: { "data-offset": "10" }, bytes: 40,
        note: "MSS 4 + SACK-permitted 2 + Timestamps 10 + NOP 1 + Window Scale 3 = 20 byte; gặp ở SYN của Linux." },
      { id: "max-options", name: "Option tối đa", enable: [], varBytes: { options: 40 }, set: { "data-offset": "15" }, bytes: 60,
        note: "Giới hạn 40 byte option (Data Offset = 15); hiếm gặp, vd. SACK 4 block (2 + 4×8 = 34 byte, đệm NOP lên 36) hoặc SACK 3 block + Timestamps." }
    ],
  },

  "udp": {
    id: "udp",
    name: "User Datagram Protocol",
    short: "UDP",
    layer: "l4",
    standard: "RFC 768",
    summary: "Header UDP 8 byte: truyền datagram không kết nối, không đảm bảo, chỉ có cổng, độ dài và checksum.",
    detail: "UDP không bắt tay, không đánh số thứ tự, không truyền lại – nhẹ và nhanh, phù hợp DNS, VoIP, streaming và đặc biệt các giao thức tunnel/overlay. " +
      "Trong VXLAN, cổng đích 4789 báo hiệu header VXLAN theo sau; cổng nguồn thường được băm từ frame bên trong để ECMP phân tải. " +
      "Checksum là tuỳ chọn với IPv4 (0 = không dùng) nhưng bắt buộc với IPv6 (trừ ngoại lệ RFC 6935).",
    fixedBytes: 8,
    fields: [
      {
        id: "ports",
        name: "Source / Destination Port",
        desc: "Hai cổng 16 bit xác định ứng dụng ở hai đầu.",
        children: [
          {
            id: "src-port",
            name: "Source Port",
            abbr: "Src Port",
            bits: 16,
            desc: "Cổng của ứng dụng gửi (có thể bằng 0 nếu không cần phản hồi). Với VXLAN/MPLS-over-UDP, thường là giá trị băm để tạo entropy cho ECMP.",
            example: "49152"
          },
          {
            id: "dst-port",
            name: "Destination Port",
            abbr: "Dst Port",
            bits: 16,
            desc: "Cổng của ứng dụng nhận – cho biết dữ liệu bên trong là giao thức gì.",
            values: [
              { v: "53", m: "DNS" },
              { v: "67/68", m: "DHCP server/client" },
              { v: "69", m: "TFTP" },
              { v: "123", m: "NTP" },
              { v: "161/162", m: "SNMP / SNMP trap" },
              { v: "500", m: "IKE (IPsec)" },
              { v: "514", m: "Syslog" },
              { v: "1701", m: "L2TP" },
              { v: "2152", m: "GTP-U (mobile core)" },
              { v: "3784", m: "BFD single-hop" },
              { v: "4500", m: "IPsec NAT-Traversal" },
              { v: "4789", m: "VXLAN" },
              { v: "6081", m: "Geneve" },
              { v: "6635", m: "MPLS-in-UDP" }
            ],
            example: "4789"
          }
        ]
      },
      {
        id: "length",
        name: "Length",
        bits: 16,
        desc: "Độ dài header UDP + dữ liệu, tính bằng byte; tối thiểu 8.",
        example: "1480"
      },
      {
        id: "checksum",
        name: "Checksum",
        bits: 16,
        desc: "Tổng bù một trên pseudo-header IP + header UDP + dữ liệu. Với IPv4, 0x0000 nghĩa là không tính checksum (VXLAN thường để 0).",
        values: [{ v: "0x0000", m: "Không dùng checksum (chỉ IPv4)" }],
        example: "0x0000"
      }
    ]
  },

  "payload": {
    id: "payload",
    name: "Payload / Data",
    short: "Payload",
    layer: "payload",
    standard: "—",
    summary: "Dữ liệu người dùng hoặc của lớp trên được các header bên ngoài vận chuyển.",
    detail: "Đây là phần mà mọi header phía trước tồn tại để phục vụ. Với Ethernet II không tag, phần sau EtherType phải ≥ 46 byte (42 nếu có một tag 802.1Q) để frame đạt tối thiểu 64 byte; " +
      "thiếu thì NIC đệm thêm padding. Phần sau EtherType tối đa 1500 byte với MTU chuẩn (jumbo frame tới ~9000). Mỗi header tunnel thêm vào sẽ làm giảm chỗ cho payload nếu MTU không đổi.",
    fixedBytes: 0,
    fields: [
      {
        id: "data",
        name: "Data",
        varBytes: { min: 0, max: 9000, default: 46 },
        desc: "Dữ liệu ứng dụng (HTTP, DNS…) hoặc gói của lớp trên. Kích thước thay đổi; mặc định 46 byte để minh hoạ frame tối thiểu.",
        example: "GET / HTTP/1.1…"
      }
    ]
  }
});
