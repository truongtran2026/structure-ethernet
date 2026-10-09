// Header lớp vật lý / lớp 2: Preamble, MAC, EtherType/Length, LLC/SNAP, VLAN tag, PBB I-Tag, PPPoE, PPP, FCS.
// Schema: .claude/skills/protocol-header-spec/references/data-schema.md
window.HEADERS = window.HEADERS || {};

(function () {
// Tạo group MAC (OUI + NIC-specific) cho Destination / Source, id có tiền tố để không trùng.
function __macGroup(prefix, name, roleDesc, igDesc) {
  return {
    id: prefix + "-mac",
    name: name,
    desc: roleDesc,
    children: [
      {
        id: prefix + "-oui",
        name: "Organizationally Unique Identifier (OUI)",
        abbr: "OUI",
        desc: "3 octet đầu của địa chỉ MAC, do IEEE RA cấp cho nhà sản xuất (vd. 00:00:0C = Cisco). " +
          "Octet đầu tiên chứa hai bit đặc biệt I/G và U/L; ở đây octet đầu được vẽ theo thứ tự hiển thị chuẩn bit 7→0, " +
          "nên I/G (bit 0, bit được truyền ĐẦU TIÊN trên dây vì Ethernet truyền LSB trước) nằm cuối octet, U/L (bit 1) đứng ngay trước.",
        children: [
          {
            id: prefix + "-oui-b7-2",
            name: "OUI – octet 1, bit 7..2",
            abbr: "OUI[7:2]",
            bits: 6,
            desc: "6 bit cao của octet đầu tiên, thuộc phần OUI do IEEE cấp."
          },
          {
            id: prefix + "-ul",
            name: "Universal/Local bit",
            abbr: "U/L",
            bits: 1,
            desc: "Cho biết địa chỉ được quản lý toàn cầu (0 – địa chỉ gốc do nhà sản xuất ghi) hay quản trị cục bộ (1 – do admin/phần mềm đặt, vd. MAC ảo của VM, HSRP/VRRP không dùng bit này).",
            values: [
              { v: "0", m: "Universally administered (UAA) – MAC gốc của NIC" },
              { v: "1", m: "Locally administered (LAA) – MAC tự đặt" }
            ]
          },
          {
            id: prefix + "-ig",
            name: "Individual/Group bit",
            abbr: "I/G",
            bits: 1,
            desc: igDesc,
            values: [
              { v: "0", m: "Individual – unicast" },
              { v: "1", m: "Group – multicast/broadcast" }
            ]
          },
          {
            id: prefix + "-oui-rest",
            name: "OUI – octet 2..3",
            abbr: "OUI[2:3]",
            bits: 16,
            desc: "Hai octet còn lại của OUI."
          }
        ]
      },
      {
        id: prefix + "-nic",
        name: "NIC-specific (Network Interface Controller specific)",
        abbr: "NIC",
        bits: 24,
        desc: "3 octet cuối do nhà sản xuất tự gán, duy nhất cho từng card mạng trong cùng OUI."
      }
    ]
  };
}

Object.assign(window.HEADERS, {
  "phy-preamble": {
    id: "phy-preamble",
    name: "Preamble + Start Frame Delimiter",
    short: "Preamble/SFD",
    layer: "phy",
    standard: "IEEE 802.3 §3.2.1–3.2.2",
    summary: "Chuỗi bit đồng bộ đồng hồ và đánh dấu điểm bắt đầu frame Ethernet trên dây.",
    detail: "Preamble gồm 7 octet 10101010 (0x55) giúp bộ thu khoá đồng hồ bit; SFD 10101011 (0xD5) báo octet tiếp theo là Destination MAC. " +
      "Đây là phần của lớp vật lý: không được tính vào kích thước frame tối thiểu 64 byte / tối đa 1518 byte và không được Wireshark hiển thị. " +
      "Cộng thêm Inter-Packet Gap 12 byte, mỗi frame chiếm thêm 20 byte \"chi phí\" trên đường truyền.",
    fixedBytes: 8,
    fields: [
      {
        id: "preamble",
        name: "Preamble",
        bits: 56,
        desc: "7 octet 0x55 (10101010 lặp lại) để bộ thu đồng bộ tần số/pha đồng hồ trước khi dữ liệu thật đến.",
        values: [{ v: "0x55 × 7", m: "Mẫu 1010… cố định" }],
        example: "55 55 55 55 55 55 55"
      },
      {
        id: "sfd",
        name: "Start Frame Delimiter",
        abbr: "SFD",
        bits: 8,
        desc: "Octet 0xD5 (10101011) – hai bit 1 cuối báo hiệu frame bắt đầu ngay sau đó (Destination MAC).",
        values: [{ v: "0xD5", m: "10101011 – bắt đầu frame" }],
        example: "0xD5"
      }
    ]
  },

  "eth-mac": {
    id: "eth-mac",
    name: "Destination + Source MAC Address",
    short: "MAC DA/SA",
    layer: "l2",
    standard: "IEEE 802.3 §3.2.3–3.2.4, IEEE Std 802 §8",
    summary: "Địa chỉ MAC đích và nguồn 48 bit, cho biết frame gửi tới ai và từ ai trong miền lớp 2.",
    detail: "Switch đọc Destination MAC để chuyển tiếp (tra bảng MAC) và học Source MAC vào bảng MAC theo cổng vào. " +
      "Mỗi MAC = OUI (24 bit, nhà sản xuất) + NIC-specific (24 bit). Bit I/G của Destination phân biệt unicast/multicast; " +
      "FF:FF:FF:FF:FF:FF là broadcast. Lưu ý: octet được truyền LSB trước, nên I/G là bit đầu tiên ra dây.",
    fixedBytes: 12,
    fields: [
      __macGroup(
        "dst",
        "Destination MAC Address",
        "Địa chỉ MAC đích (6 octet). Switch tra địa chỉ này trong bảng MAC để chọn cổng ra; không tìm thấy hoặc là multicast/broadcast thì flood.",
        "Bit 0 của octet đầu: 0 = địa chỉ unicast, 1 = địa chỉ nhóm (multicast, vd. 01:00:5E:xx IPv4 multicast, 01:80:C2:00:00:00 STP; broadcast FF:FF:FF:FF:FF:FF)."
      ),
      __macGroup(
        "src",
        "Source MAC Address",
        "Địa chỉ MAC nguồn (6 octet) của thiết bị gửi. Switch học địa chỉ này vào bảng MAC gắn với cổng nhận frame.",
        "Trong Source MAC bit I/G luôn phải bằng 0 – nguồn không thể là địa chỉ nhóm."
      )
    ]
  },

  "ethertype": {
    id: "ethertype",
    name: "EtherType",
    short: "EtherType",
    layer: "l2",
    standard: "IEEE 802.3 §3.2.6, IEEE Std 802 §9.2, IANA/IEEE RA EtherType registry",
    summary: "Mã 16 bit cho biết giao thức nào nằm ngay sau (IPv4, IPv6, VLAN tag, MPLS, PPPoE…).",
    detail: "Trường này nằm sau MAC nguồn (hoặc sau VLAN tag) trong frame Ethernet II. Giá trị ≥ 0x0600 (1536) được hiểu là EtherType; " +
      "≤ 0x05DC (1500) là Length của frame 802.3. Đây là \"điểm chuyển giao\" giữa lớp 2 và lớp trên: thiết bị nhận dựa vào nó để chọn bộ giải mã tiếp theo. " +
      "Khi có VLAN tag, EtherType thật của payload bị đẩy ra sau tag.",
    fixedBytes: 2,
    fields: [
      {
        id: "type",
        name: "EtherType",
        abbr: "Type",
        bits: 16,
        desc: "Xác định giao thức của dữ liệu theo sau. Phải ≥ 0x0600; giá trị nhỏ hơn hoặc bằng 0x05DC sẽ bị hiểu là trường Length (802.3).",
        values: [
          { v: "0x0800", m: "IPv4" },
          { v: "0x0806", m: "ARP" },
          { v: "0x86DD", m: "IPv6" },
          { v: "0x8100", m: "802.1Q C-Tag (VLAN)" },
          { v: "0x88A8", m: "802.1ad S-Tag (QinQ / Provider Bridge)" },
          { v: "0x88E7", m: "802.1ah I-Tag (Provider Backbone Bridge, MAC-in-MAC)" },
          { v: "0x8847", m: "MPLS unicast" },
          { v: "0x8848", m: "MPLS multicast (upstream-assigned label)" },
          { v: "0x8863", m: "PPPoE Discovery (PADI/PADO/PADR/PADS/PADT)" },
          { v: "0x8864", m: "PPPoE Session" },
          { v: "0x6558", m: "Transparent Ethernet Bridging (dùng trong GRE/GRETAP)" },
          { v: "0x88CC", m: "LLDP" },
          { v: "0x8809", m: "Slow Protocols (LACP, OAM 802.3ah)" },
          { v: "0x88F7", m: "PTP (IEEE 1588) over Ethernet" },
          { v: "0x88E5", m: "MACsec (802.1AE)" },
          { v: "0x8902", m: "CFM / Y.1731 (802.1ag)" },
          { v: "0x9100", m: "QinQ đời cũ (không chuẩn, tiền 802.1ad)" }
        ],
        example: "0x0800"
      }
    ]
  },

  "eth-length": {
    id: "eth-length",
    name: "Length (IEEE 802.3)",
    short: "Length",
    layer: "l2",
    standard: "IEEE 802.3 §3.2.6",
    summary: "Độ dài (byte) của phần dữ liệu MAC client trong frame 802.3 nguyên bản, không gồm padding.",
    detail: "Cùng vị trí với EtherType nhưng mang giá trị ≤ 1500 (0x05DC). Khi gặp Length, bộ thu biết lớp trên được xác định bởi header 802.2 LLC theo sau " +
      "(DSAP/SSAP), không phải bởi EtherType. Khoảng 0x05DD–0x05FF không được định nghĩa. Dạng frame này còn gặp ở STP/BPDU, IS-IS, CDP (qua SNAP).",
    fixedBytes: 2,
    fields: [
      {
        id: "length",
        name: "Length",
        bits: 16,
        desc: "Số byte dữ liệu thật (LLC + payload) trong frame, không tính padding thêm vào để đủ 64 byte. Hợp lệ 0–1500.",
        values: [
          { v: "0x0000–0x05DC", m: "Length hợp lệ (0–1500 byte)" },
          { v: "0x05DD–0x05FF", m: "Không xác định" },
          { v: "≥ 0x0600", m: "Không phải Length mà là EtherType" }
        ],
        example: "0x0026 (38 byte – Configuration BPDU; RST BPDU = 0x0027)"
      }
    ]
  },

  "llc": {
    id: "llc",
    name: "IEEE 802.2 Logical Link Control",
    short: "LLC",
    layer: "l2",
    standard: "IEEE 802.2 (ISO/IEC 8802-2) §3",
    summary: "Header LLC 3 byte xác định Service Access Point (giao thức lớp trên) cho frame 802.3 dùng trường Length.",
    detail: "DSAP/SSAP đóng vai trò như EtherType nhưng chỉ 8 bit nên không gian giá trị nhỏ; vì vậy IEEE thêm SNAP (DSAP=SSAP=0xAA) để mang EtherType/PID đầy đủ. " +
      "Control 1 octet (0x03 = UI, LLC Type 1 không kết nối) là dạng thường gặp; LLC Type 2 với khung I/S dùng Control 2 octet (hiếm, ở đây chỉ mô tả dạng 1 octet). " +
      "Ví dụ: STP BPDU dùng 0x42/0x42/0x03, IS-IS dùng 0xFE/0xFE/0x03.",
    fixedBytes: 3,
    fields: [
      {
        id: "sap",
        name: "Service Access Points",
        desc: "Cặp địa chỉ SAP đích/nguồn xác định giao thức lớp trên ở hai đầu.",
        children: [
          {
            id: "dsap",
            name: "Destination Service Access Point",
            abbr: "DSAP",
            bits: 8,
            desc: "SAP đích – giao thức lớp trên sẽ nhận dữ liệu. Bit thấp nhất là I/G (0 = SAP cá nhân, 1 = SAP nhóm).",
            values: [
              { v: "0xAA", m: "SNAP" },
              { v: "0x42", m: "Spanning Tree BPDU" },
              { v: "0xFE", m: "ISO Network Layer (IS-IS, CLNP)" },
              { v: "0xE0", m: "Novell IPX" },
              { v: "0xF0", m: "NetBIOS" },
              { v: "0x06", m: "IP (hiếm dùng)" },
              { v: "0xFF", m: "Global SAP" }
            ],
            example: "0x42"
          },
          {
            id: "ssap",
            name: "Source Service Access Point",
            abbr: "SSAP",
            bits: 8,
            desc: "SAP nguồn – giao thức lớp trên gửi dữ liệu. Bit thấp nhất là C/R (0 = Command, 1 = Response). Thường bằng DSAP.",
            values: [
              { v: "0xAA", m: "SNAP" },
              { v: "0x42", m: "Spanning Tree BPDU" },
              { v: "0xFE", m: "ISO Network Layer" }
            ],
            example: "0x42"
          }
        ]
      },
      {
        id: "control",
        name: "Control",
        abbr: "Ctrl",
        bits: 8,
        desc: "Loại PDU LLC. Hầu hết lưu lượng dùng 0x03 = Unnumbered Information (UI) – dịch vụ không kết nối, không xác nhận.",
        values: [
          { v: "0x03", m: "UI – Unnumbered Information (LLC Type 1)" },
          { v: "0xAF / 0xBF", m: "XID" }, // CẦN KIỂM: XID/TEST có bit P/F nên có 2 giá trị; đối chiếu IEEE 802.2 §5.4
          { v: "0xE3 / 0xF3", m: "TEST" }
        ],
        example: "0x03"
      }
    ]
  },

  "snap": {
    id: "snap",
    name: "Subnetwork Access Protocol",
    short: "SNAP",
    layer: "l2",
    standard: "IEEE Std 802 §10.3 (RFC 1042 cho IP)",
    summary: "Phần mở rộng 5 byte sau LLC (AA-AA-03) mang OUI + Protocol ID để mã hoá giao thức lớp trên trong frame 802.3.",
    detail: "Khi OUI = 00-00-00, PID chính là một EtherType (RFC 1042: IP qua mạng 802 dùng 0x0800). " +
      "Khi OUI là của một hãng, PID do hãng đó định nghĩa – vd. Cisco 00-00-0C với PID 0x2000 (CDP), 0x2004 (DTP), 0x010B (PVST+).",
    fixedBytes: 5,
    fields: [
      {
        id: "oui",
        name: "Organizationally Unique Identifier",
        abbr: "OUI",
        bits: 24,
        desc: "Tổ chức định nghĩa ý nghĩa của PID. 00-00-00 nghĩa là PID là EtherType chuẩn.",
        values: [
          { v: "0x000000", m: "PID là EtherType (RFC 1042)" },
          { v: "0x0080C2", m: "IEEE 802.1 (vd. PID cho bridged Ethernet)" },
          { v: "0x00000C", m: "Cisco (CDP, VTP, DTP, PVST+)" }
        ],
        example: "0x00000C"
      },
      {
        id: "pid",
        name: "Protocol Identifier",
        abbr: "PID",
        bits: 16,
        desc: "Mã giao thức lớp trên, ý nghĩa phụ thuộc OUI.",
        values: [
          { v: "0x0800", m: "IPv4 (với OUI 000000)" },
          { v: "0x0806", m: "ARP (với OUI 000000)" },
          { v: "0x2000", m: "CDP (với OUI 00000C)" },
          { v: "0x2003", m: "VTP (với OUI 00000C)" },
          { v: "0x2004", m: "DTP (với OUI 00000C)" },
          { v: "0x010B", m: "PVST+ BPDU (với OUI 00000C)" }
        ],
        example: "0x2000"
      }
    ]
  },

  "vlan-8021q": {
    id: "vlan-8021q",
    name: "IEEE 802.1Q VLAN Tag (C-Tag)",
    short: "802.1Q",
    layer: "l2",
    standard: "IEEE 802.1Q-2018 §9.6",
    summary: "Tag 4 byte chèn sau MAC nguồn để gán frame vào một VLAN (VID) và mức ưu tiên (PCP).",
    detail: "Tag gồm TPID 0x8100 (đặt đúng vị trí EtherType để thiết bị nhận biết có tag) và TCI = PCP(3) + DEI(1) + VID(12). " +
      "Trên trunk, switch gắn tag khi gửi và gỡ tag khi chuyển ra cổng access. Frame tối thiểu vẫn 64 byte nên payload tối thiểu giảm còn 42 byte; " +
      "frame tối đa tăng lên 1522 byte. DEI trước đây gọi là CFI.",
    fixedBytes: 4,
    fields: [
      {
        id: "tpid",
        name: "Tag Protocol Identifier",
        abbr: "TPID",
        bits: 16,
        desc: "Báo hiệu frame có C-Tag 802.1Q. Nằm đúng chỗ EtherType nên thiết bị không hiểu VLAN sẽ coi như một EtherType lạ.",
        values: [{ v: "0x8100", m: "Customer VLAN Tag (C-Tag)" }],
        example: "0x8100"
      },
      {
        id: "tci",
        name: "Tag Control Information (TCI)",
        abbr: "TCI",
        desc: "16 bit điều khiển của tag: mức ưu tiên PCP, cờ DEI và số VLAN (VID).",
        children: [
          {
            id: "pcp",
            name: "Priority Code Point",
            abbr: "PCP",
            bits: 3,
            desc: "Mức ưu tiên lớp 2 (CoS 0–7, 802.1p) để switch xếp hàng QoS. Thường map từ/ra DSCP ở biên L3.",
            values: [
              { v: "1", m: "BK – Background (thấp nhất)" },
              { v: "0", m: "BE – Best Effort (mặc định)" },
              { v: "2", m: "EE – Excellent Effort" },
              { v: "3", m: "CA – Critical Applications" },
              { v: "4", m: "VI – Video" },
              { v: "5", m: "VO – Voice" },
              { v: "6", m: "IC – Internetwork Control" },
              { v: "7", m: "NC – Network Control" }
            ],
            example: "0"
          },
          {
            id: "dei",
            name: "Drop Eligible Indicator",
            abbr: "DEI",
            bits: 1,
            desc: "1 = frame được phép bị loại trước khi nghẽn (vd. lưu lượng vượt CIR bị policer đánh dấu). Trước 802.1Q-2011 bit này là CFI (Canonical Format Indicator).",
            values: [
              { v: "0", m: "Không ưu tiên loại bỏ" },
              { v: "1", m: "Drop eligible" }
            ],
            example: "0"
          },
          {
            id: "vid",
            name: "VLAN Identifier",
            abbr: "VID",
            bits: 12,
            desc: "Số VLAN mà frame thuộc về (1–4094). Switch chỉ chuyển frame giữa các cổng cùng VLAN.",
            values: [
              { v: "0x000", m: "Priority tag – không thuộc VLAN nào, chỉ mang PCP" },
              { v: "0x001", m: "VLAN 1 – VLAN mặc định trên nhiều switch" },
              { v: "0xFFF", m: "Dự trữ, không dùng" }
            ],
            example: "100"
          }
        ]
      }
    ]
  },

  "vlan-8021ad": {
    id: "vlan-8021ad",
    name: "IEEE 802.1ad Service VLAN Tag (S-Tag)",
    short: "802.1ad",
    layer: "l2",
    standard: "IEEE 802.1Q-2018 §9.6 (gốc IEEE 802.1ad-2005)",
    summary: "Tag VLAN của nhà cung cấp dịch vụ (S-Tag) đặt ngoài C-Tag của khách hàng trong QinQ.",
    detail: "Cấu trúc giống hệt C-Tag nhưng TPID là 0x88A8. Nhà mạng gán một S-VID cho mỗi khách hàng/dịch vụ và giữ nguyên C-Tag bên trong, " +
      "nhờ vậy khách hàng dùng VLAN của mình độc lập (tối đa 4094 × 4094 tổ hợp). Một số thiết bị cũ dùng TPID 0x9100 hoặc 0x8100 cho tag ngoài. " +
      "Trong PBB, tag cùng định dạng này được gọi là B-Tag (Backbone VLAN).",
    fixedBytes: 4,
    fields: [
      {
        id: "tpid",
        name: "Tag Protocol Identifier",
        abbr: "TPID",
        bits: 16,
        desc: "Báo hiệu đây là S-Tag (Service tag) của Provider Bridge.",
        values: [
          { v: "0x88A8", m: "S-Tag / B-Tag chuẩn 802.1ad" },
          { v: "0x9100", m: "Tag ngoài kiểu cũ (không chuẩn)" },
          { v: "0x8100", m: "Một số thiết bị dùng lại TPID của C-Tag cho tag ngoài" }
        ],
        example: "0x88A8"
      },
      {
        id: "tci",
        name: "Tag Control Information (TCI)",
        abbr: "TCI",
        desc: "16 bit điều khiển của S-Tag: PCP, DEI và S-VID.",
        children: [
          {
            id: "pcp",
            name: "Priority Code Point",
            abbr: "PCP",
            bits: 3,
            desc: "Mức ưu tiên trong mạng nhà cung cấp, có thể độc lập với PCP của khách hàng trong C-Tag.",
            values: [
              { v: "0", m: "Best Effort" },
              { v: "5", m: "Voice" },
              { v: "7", m: "Network Control" }
            ],
            example: "0"
          },
          {
            id: "dei",
            name: "Drop Eligible Indicator",
            abbr: "DEI",
            bits: 1,
            desc: "1 = frame có thể bị loại trước khi nghẽn trong mạng nhà cung cấp (thường do policer đánh dấu khi vượt CIR).",
            example: "0"
          },
          {
            id: "vid",
            name: "Service VLAN Identifier",
            abbr: "S-VID",
            bits: 12,
            desc: "VLAN của nhà cung cấp, thường mỗi khách hàng hoặc mỗi dịch vụ một S-VID (1–4094).",
            values: [
              { v: "0x000", m: "Không dùng cho S-Tag" },
              { v: "0xFFF", m: "Dự trữ" }
            ],
            example: "200"
          }
        ]
      }
    ]
  },

  "pbb-itag": {
    id: "pbb-itag",
    name: "IEEE 802.1ah Backbone Service Instance Tag (I-Tag)",
    short: "I-Tag",
    layer: "l2",
    standard: "IEEE 802.1Q-2018 §9.7 (gốc IEEE 802.1ah-2008)",
    summary: "Tag 6 byte của Provider Backbone Bridge (MAC-in-MAC) mang I-SID 24 bit định danh dịch vụ khách hàng.",
    detail: "Trong PBB, frame khách hàng (gồm cả C-MAC) được bọc trong header backbone: B-DA, B-SA, B-Tag (0x88A8) và I-Tag (0x88E7). " +
      "I-SID 24 bit cho tới ~16 triệu instance dịch vụ, khắc phục giới hạn 4094 S-VLAN của QinQ; lõi chỉ học B-MAC nên bảng MAC không bùng nổ. " +
      "Ngay sau I-Tag là C-DA, C-SA của frame khách hàng.",
    fixedBytes: 6,
    fields: [
      {
        id: "tpid",
        name: "I-Tag Protocol Identifier",
        abbr: "TPID",
        bits: 16,
        desc: "EtherType báo hiệu Backbone Service Instance Tag.",
        values: [{ v: "0x88E7", m: "802.1ah I-Tag" }],
        example: "0x88E7"
      },
      {
        id: "itag-tci",
        name: "I-Tag Control Information",
        abbr: "I-TCI",
        desc: "32 bit điều khiển: ưu tiên, cờ loại bỏ, cờ UCA, bit dự trữ và I-SID.",
        children: [
          {
            id: "i-pcp",
            name: "Backbone Service Instance Priority Code Point",
            abbr: "I-PCP",
            bits: 3,
            desc: "Mức ưu tiên của frame khách hàng mang trong backbone (tương tự PCP).",
            example: "0"
          },
          {
            id: "i-dei",
            name: "Backbone Service Instance Drop Eligible Indicator",
            abbr: "I-DEI",
            bits: 1,
            desc: "Cờ cho phép loại frame khi nghẽn (tương tự DEI).",
            example: "0"
          },
          {
            id: "uca",
            name: "Use Customer Addresses",
            abbr: "UCA",
            bits: 1,
            desc: "Cho biết C-DA/C-SA được bọc ngay sau I-Tag có phải là địa chỉ MAC khách hàng hay không; dùng khi kết nối qua CBP / PBBN phân cấp. Thường = 0.",
            example: "0"
          },
          {
            id: "res1",
            name: "Reserved 1",
            abbr: "Res1",
            bits: 1,
            reserved: true,
            desc: "1 bit dự trữ, gửi bằng 0; bên nhận bỏ qua giá trị.",
            example: "0"
          },
          {
            id: "res2",
            name: "Reserved 2",
            abbr: "Res2",
            bits: 2,
            reserved: true,
            desc: "2 bit dự trữ, gửi bằng 0; nếu bên nhận thấy ≠ 0 thì frame bị loại.",
            example: "00"
          },
          {
            id: "isid",
            name: "Backbone Service Instance Identifier",
            abbr: "I-SID",
            bits: 24,
            desc: "Định danh dịch vụ khách hàng trong backbone (tới 2^24 ≈ 16 triệu). BEB dùng I-SID để chọn VSI và bảng C-MAC tương ứng.",
            example: "10000"
          }
        ]
      }
    ]
  },

  "pppoe": {
    id: "pppoe",
    name: "PPPoE Header",
    short: "PPPoE",
    layer: "l2",
    standard: "RFC 2516 §4",
    summary: "Header 6 byte cho phép chạy phiên PPP trên Ethernet (BRAS/BNG ↔ CPE), gồm mã gói và Session ID.",
    detail: "PPPoE có hai giai đoạn: Discovery (EtherType 0x8863: PADI → PADO → PADR → PADS, kết thúc bằng PADT) để chọn Access Concentrator và nhận Session ID; " +
      "rồi Session (EtherType 0x8864, Code = 0x00) mang khung PPP. 8 byte overhead (PPPoE 6 + PPP Protocol 2) là lý do MTU PPPoE thường là 1492.",
    fixedBytes: 6,
    fields: [
      {
        id: "ver-type",
        name: "Version / Type",
        desc: "Octet đầu gồm phiên bản và loại PPPoE; theo RFC 2516 cả hai đều bằng 1 (octet = 0x11).",
        children: [
          {
            id: "ver",
            name: "Version",
            abbr: "VER",
            bits: 4,
            desc: "Phiên bản PPPoE, phải bằng 0x1.",
            values: [{ v: "0x1", m: "RFC 2516" }],
            example: "1"
          },
          {
            id: "type",
            name: "Type",
            bits: 4,
            desc: "Loại PPPoE, phải bằng 0x1.",
            values: [{ v: "0x1", m: "RFC 2516" }],
            example: "1"
          }
        ]
      },
      {
        id: "code",
        name: "Code",
        bits: 8,
        desc: "Loại gói PPPoE. Trong giai đoạn Session luôn là 0x00; các giá trị khác dùng cho Discovery.",
        values: [
          { v: "0x00", m: "Session Data" },
          { v: "0x09", m: "PADI – Initiation (broadcast tìm AC)" },
          { v: "0x07", m: "PADO – Offer" },
          { v: "0x19", m: "PADR – Request" },
          { v: "0x65", m: "PADS – Session-confirmation" },
          { v: "0xA7", m: "PADT – Terminate" }
        ],
        example: "0x00"
      },
      {
        id: "session-id",
        name: "Session ID",
        bits: 16,
        desc: "Định danh phiên do AC cấp trong PADS; cùng cặp MAC tạo khoá duy nhất cho phiên. Bằng 0x0000 trong PADI/PADO/PADR.",
        values: [
          { v: "0x0000", m: "Chưa có phiên (Discovery)" },
          { v: "0xFFFF", m: "Dự trữ" }
        ],
        example: "0x1A2B"
      },
      {
        id: "length",
        name: "Length",
        bits: 16,
        desc: "Độ dài payload PPPoE (byte), không tính header Ethernet và header PPPoE; trong Session bao gồm cả trường PPP Protocol.",
        example: "1478"
      }
    ]
  },

  "ppp-proto": {
    id: "ppp-proto",
    name: "PPP Protocol Field",
    short: "PPP",
    layer: "l2",
    standard: "RFC 1661 §2, RFC 1662 (IANA PPP DLL Protocol Numbers)",
    summary: "Trường 2 byte của khung PPP cho biết gói bên trong là IP, IPv6 hay gói điều khiển LCP/NCP.",
    detail: "Trong PPPoE không có cờ 0x7E, Address/Control và FCS của PPP-HDLC; chỉ còn trường Protocol rồi tới dữ liệu. " +
      "Giá trị 0x0xxx–0x3xxx là giao thức lớp mạng, 0x8xxx–0xBxxx là NCP tương ứng (IPCP, IPV6CP), 0xCxxx là LCP và xác thực (PAP/CHAP).",
    fixedBytes: 2,
    fields: [
      {
        id: "protocol",
        name: "Protocol",
        bits: 16,
        desc: "Mã giao thức của gói PPP được bọc bên trong.",
        values: [
          { v: "0x0021", m: "IPv4" },
          { v: "0x0057", m: "IPv6" },
          { v: "0x0281", m: "MPLS unicast" },
          { v: "0x8021", m: "IPCP – cấp IPv4/DNS" },
          { v: "0x8057", m: "IPV6CP" },
          { v: "0xC021", m: "LCP – thiết lập liên kết, MRU, echo" },
          { v: "0xC023", m: "PAP" },
          { v: "0xC223", m: "CHAP" }
        ],
        example: "0x0021"
      }
    ]
  },

  "eth-fcs": {
    id: "eth-fcs",
    name: "Frame Check Sequence",
    short: "FCS",
    layer: "trailer",
    standard: "IEEE 802.3 §3.2.9",
    summary: "CRC-32 ở cuối frame để phát hiện lỗi bit trên đường truyền.",
    detail: "Bên gửi tính CRC-32 trên toàn bộ frame từ Destination MAC đến hết payload/padding (không gồm Preamble/SFD). " +
      "Bên nhận tính lại; sai thì loại frame âm thầm (đếm CRC/FCS error) – Ethernet không truyền lại, việc đó dành cho lớp trên (vd. TCP). " +
      "Mỗi lần switch thay đổi frame (gắn/gỡ VLAN tag) phải tính lại FCS. Ethernet bên trong tunnel (EoMPLS, VXLAN, GRETAP) không mang FCS riêng.",
    fixedBytes: 4,
    fields: [
      {
        id: "fcs",
        name: "Frame Check Sequence (CRC-32)",
        abbr: "FCS",
        bits: 32,
        desc: "Giá trị CRC-32 (đa thức 0x04C11DB7) tính trên DA…payload. Dùng để phát hiện lỗi, không sửa lỗi.",
        example: "0x1C2D3E4F"
      }
    ]
  }
});
})();
