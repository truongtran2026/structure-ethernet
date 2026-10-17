// Header BGP (control plane MP-BGP VPNv4): bgp-header, bgp-update, bgp-attr-origin, bgp-attr-as-path,
// bgp-attr-local-pref, bgp-mp-reach, bgp-vpnv4-nlri, bgp-attr-ext-comm.
// Nguồn: RFC 4271 (BGP-4), RFC 4760 (MP-BGP), RFC 4364 (BGP/MPLS IP VPN), RFC 8277 (nhãn trong NLRI, thay RFC 3107),
// RFC 4360 (Extended Communities), RFC 5668 (Extended Community 4-byte AS), RFC 6793 (ASN 4 byte), RFC 7606 (xử lý lỗi UPDATE).
// Schema: .claude/skills/protocol-header-spec/references/data-schema.md
window.HEADERS = window.HEADERS || {};
(function () {
  // Attribute Flags (RFC 4271 §4.3): O, T, P, E (bit cao → thấp) + 4 bit Unused.
  function attrFlags(o, t, p, e, hex, note) {
    return {
      id: "attr-flags",
      name: "Attribute Flags",
      desc:
        "Octet cờ đầu mỗi path attribute: loại thuộc tính (well-known/optional, transitive hay không), đã đi qua router không hiểu nó chưa (Partial) " +
        "và trường Length dài 1 hay 2 byte (Extended Length). Ở đây = " + hex + ": " + note + " (RFC 4271 §4.3).",
      children: [
        {
          id: "flag-o",
          name: "Optional bit",
          abbr: "O",
          bits: 1,
          desc: "0 = well-known (mọi BGP speaker phải hiểu: ORIGIN, AS_PATH, NEXT_HOP, LOCAL_PREF…); 1 = optional (có thể không hiểu: MP_REACH_NLRI, COMMUNITIES, EXTENDED_COMMUNITIES…).",
          values: [
            { v: "0", m: "Well-known" },
            { v: "1", m: "Optional" }
          ],
          example: o
        },
        {
          id: "flag-t",
          name: "Transitive bit",
          abbr: "T",
          bits: 1,
          desc: "Với optional: 1 = transitive (router không hiểu vẫn phải chuyển tiếp), 0 = non-transitive (không hiểu thì bỏ). Với well-known luôn = 1.",
          values: [
            { v: "0", m: "Non-transitive (vd. MP_REACH_NLRI 0x80/0x90)" },
            { v: "1", m: "Transitive (well-known luôn = 1; EXTENDED_COMMUNITIES 0xC0)" }
          ],
          example: t
        },
        {
          id: "flag-p",
          name: "Partial bit",
          abbr: "P",
          bits: 1,
          desc: "Chỉ có nghĩa với optional transitive: = 1 khi có router trên đường đi không hiểu thuộc tính này nhưng vẫn chuyển tiếp. Well-known và optional non-transitive luôn = 0.",
          example: p
        },
        {
          id: "flag-e",
          name: "Extended Length bit",
          abbr: "E",
          bits: 1,
          desc: "0 = trường Attribute Length dài 1 byte (giá trị ≤ 255); 1 = dài 2 byte. MP_REACH_NLRI thường đặt E = 1 vì có thể mang nhiều NLRI.",
          values: [
            { v: "0", m: "Length 1 byte" },
            { v: "1", m: "Length 2 byte" }
          ],
          example: e
        },
        {
          id: "flag-unused",
          name: "Unused",
          bits: 4,
          reserved: true,
          desc: "4 bit thấp không dùng: phải = 0 khi gửi, bên nhận bỏ qua (RFC 4271 §4.3).",
          example: "0000"
        }
      ]
    };
  }
  function typeCode(code, name) {
    return {
      id: "type-code",
      name: "Attribute Type Code",
      abbr: "Type",
      bits: 8,
      desc: "Mã loại thuộc tính; " + code + " = " + name + ". Cặp Flags + Type Code gọi chung là Attribute Type (2 byte).",
      values: [
        { v: "1", m: "ORIGIN" },
        { v: "2", m: "AS_PATH" },
        { v: "3", m: "NEXT_HOP" },
        { v: "4", m: "MULTI_EXIT_DISC (MED)" },
        { v: "5", m: "LOCAL_PREF" },
        { v: "14", m: "MP_REACH_NLRI (RFC 4760)" },
        { v: "15", m: "MP_UNREACH_NLRI (RFC 4760) — rút tuyến VPNv4" },
        { v: "16", m: "EXTENDED_COMMUNITIES (RFC 4360) — mang Route Target" }
      ],
      example: String(code)
    };
  }
  function attrLen(bits, example, desc) {
    return {
      id: "attr-len",
      name: "Attribute Length",
      abbr: "Len",
      bits: bits,
      desc: "Độ dài phần giá trị (Attribute Value) tính bằng byte, không gồm Flags/Type/Length. " + desc,
      example: example
    };
  }

  Object.assign(window.HEADERS, {
    "bgp-header": {
      id: "bgp-header",
      name: "BGP Message Header",
      short: "BGP Hdr",
      layer: "l7",
      standard: "RFC 4271 §4.1",
      summary: "19 byte đầu mọi bản tin BGP: Marker (16 byte toàn 1), độ dài cả bản tin và loại bản tin (OPEN, UPDATE…).",
      detail:
        "BGP là giao thức lớp ứng dụng chạy trên TCP cổng 179; TCP là luồng byte nên BGP cần Length để biết bản tin kết thúc ở đâu. " +
        "Một segment TCP có thể chứa nhiều bản tin BGP nối tiếp, hoặc một bản tin bị cắt qua nhiều segment. " +
        "Marker toàn 0xFF là dấu hiệu đồng bộ (bản BGP cũ dùng nó cho xác thực, BGP-4 hiện hành chỉ yêu cầu toàn 1). " +
        "Bản tin dài 19–4096 byte; RFC 8654 (Extended Message) cho phép tới 65535 khi hai bên cùng hỗ trợ.",
      fixedBytes: 19,
      fields: [
        {
          id: "marker",
          name: "Marker",
          bits: 128,
          desc: "16 byte phải toàn 1 (0xFF…FF), giữ để tương thích. Bên nhận thấy Marker sai thì gửi NOTIFICATION (Message Header Error) và đóng phiên.",
          example: "FFFF FFFF FFFF FFFF FFFF FFFF FFFF FFFF"
        },
        {
          id: "length",
          name: "Length",
          bits: 16,
          desc: "Tổng độ dài bản tin BGP tính bằng byte, gồm cả 19 byte header này. KEEPALIVE chỉ có header nên luôn = 19.",
          values: [
            { v: "19", m: "Tối thiểu (KEEPALIVE)" },
            { v: "23", m: "UPDATE rỗng = End-of-RIB của IPv4 unicast (RFC 4724)" },
            { v: "4096", m: "Tối đa (RFC 4271)" },
            { v: "65535", m: "Tối đa nếu thoả thuận Extended Message (RFC 8654); không áp dụng cho OPEN và KEEPALIVE (RFC 8654 §6)" }
          ],
          example: "84"
        },
        {
          id: "type",
          name: "Type",
          bits: 8,
          desc: "Loại bản tin. Quảng bá/rút tuyến (cả VPNv4) đều dùng UPDATE.",
          values: [
            { v: "1", m: "OPEN — mở phiên, thoả thuận capability (vd. MP-BGP AFI 1/SAFI 128)" },
            { v: "2", m: "UPDATE — quảng bá / rút tuyến" },
            { v: "3", m: "NOTIFICATION — báo lỗi rồi đóng phiên" },
            { v: "4", m: "KEEPALIVE — giữ phiên (RFC 4271 §10 gợi ý hold 90 s / keepalive 30 s = 1/3 hold; Cisco IOS mặc định 180/60)" },
            { v: "5", m: "ROUTE-REFRESH — xin peer gửi lại tuyến (RFC 2918)" }
          ],
          example: "2"
        }
      ]
    },

    "bgp-update": {
      id: "bgp-update",
      name: "BGP UPDATE (phần cố định)",
      short: "UPDATE",
      layer: "l7",
      standard: "RFC 4271 §4.3",
      summary: "Phần đầu bản tin UPDATE: danh sách tuyến IPv4 unicast bị rút và tổng độ dài các path attribute theo sau.",
      detail:
        "Bản tin UPDATE gồm: Withdrawn Routes Length + Withdrawn Routes + Total Path Attribute Length + Path Attributes + NLRI. " +
        "Hai trường Withdrawn và NLRI ở cuối chỉ dành cho IPv4 unicast; tuyến VPNv4 không nằm ở đó mà nằm trong thuộc tính MP_REACH_NLRI (quảng bá) " +
        "và MP_UNREACH_NLRI (rút) — RFC 4760. Vì vậy với VPNv4: Withdrawn Routes Length = 0 và phần NLRI cuối bản tin rỗng " +
        "(độ dài NLRI = Length − 23 − Withdrawn Routes Length − Total Path Attribute Length = 0).",
      fixedBytes: 4,
      fields: [
        {
          id: "withdrawn",
          name: "Withdrawn Routes",
          desc: "Các tuyến IPv4 unicast bị rút (chỉ IPv4 unicast). Với VPNv4 luôn rỗng.",
          children: [
            {
              id: "withdrawn-len",
              name: "Withdrawn Routes Length",
              bits: 16,
              desc: "Độ dài (byte) của trường Withdrawn Routes ngay sau. = 0 nghĩa là không rút tuyến IPv4 unicast nào.",
              example: "0"
            },
            {
              id: "withdrawn-routes",
              name: "Withdrawn Routes",
              varBytes: { min: 0, max: 4073, default: 0 },
              desc: "Danh sách (Length 1 byte tính bằng bit, Prefix) của tuyến IPv4 unicast bị rút, vd. 10.1.0.0/24 → 18 0A 01 00 (4 byte). Tối đa 4096 − 23 = 4073 byte.",
              example: "(rỗng)"
            }
          ]
        },
        {
          id: "total-path-attr-len",
          name: "Total Path Attribute Length",
          bits: 16,
          desc: "Tổng độ dài (byte) của mọi path attribute theo sau (ORIGIN, AS_PATH, LOCAL_PREF, MP_REACH_NLRI, EXTENDED_COMMUNITIES…). = 0: không có path attribute và không có NLRI; dùng khi chỉ rút tuyến IPv4 unicast, hoặc UPDATE rỗng = End-of-RIB (RFC 4271 §4.3; RFC 4724 §2).",
          example: "61"
        }
      ],
      variants: [
        { id: "no-withdraw", name: "Không rút tuyến", varBytes: { "withdrawn-routes": 0 }, set: { "withdrawn-len": "0" }, bytes: 4, note: "Trường hợp của mọi UPDATE VPNv4: tuyến VPN nằm trong MP_REACH/MP_UNREACH." },
        { id: "withdraw-24", name: "Rút 1 tuyến /24", varBytes: { "withdrawn-routes": 4 }, set: { "withdrawn-len": "4" }, bytes: 8, note: "IPv4 unicast rút 1 prefix /24: 1 byte độ dài (24) + 3 byte prefix." }
      ]
    },

    "bgp-attr-origin": {
      id: "bgp-attr-origin",
      name: "Path Attribute ORIGIN",
      short: "ORIGIN",
      layer: "l7",
      standard: "RFC 4271 §4.3, §5.1.1",
      summary: "Thuộc tính bắt buộc (well-known mandatory) cho biết tuyến được đưa vào BGP bằng cách nào: IGP, EGP hay INCOMPLETE.",
      detail:
        "Mọi UPDATE quảng bá tuyến phải có ORIGIN. Tuyến khai báo bằng lệnh network → IGP (0); tuyến redistribute (connected/static/OSPF vào VRF) thường → INCOMPLETE (2, hiện '?'). " +
        "Khi chọn đường tốt nhất, IGP < EGP < INCOMPLETE (nhỏ hơn được ưu tiên).",
      fixedBytes: 4,
      fields: [
        attrFlags("0", "1", "0", "0", "0x40", "well-known, transitive, Length 1 byte"),
        typeCode(1, "ORIGIN"),
        attrLen(8, "1", "ORIGIN luôn = 1."),
        {
          id: "origin",
          name: "ORIGIN",
          bits: 8,
          desc: "Nguồn gốc tuyến.",
          values: [
            { v: "0", m: "IGP — tuyến nội bộ AS (lệnh network); hiện 'i'" },
            { v: "1", m: "EGP — học từ giao thức EGP cũ; hiện 'e'" },
            { v: "2", m: "INCOMPLETE — cách khác (redistribute); hiện '?'" }
          ],
          example: "0"
        }
      ]
    },

    "bgp-attr-as-path": {
      id: "bgp-attr-as-path",
      name: "Path Attribute AS_PATH",
      short: "AS_PATH",
      layer: "l7",
      standard: "RFC 4271 §4.3, §5.1.2; RFC 6793",
      summary: "Thuộc tính bắt buộc ghi danh sách AS mà tuyến đã đi qua — chống vòng lặp giữa các AS. Rỗng khi gửi iBGP tuyến do chính AS sinh ra.",
      detail:
        "Mỗi segment = Segment Type (1 byte: 1 AS_SET, 2 AS_SEQUENCE) + Segment Length (1 byte: số AS) + danh sách ASN. " +
        "Khi hai bên đã thoả thuận ASN 4 byte (RFC 6793, capability 65) mỗi ASN chiếm 4 byte, ngược lại 2 byte. " +
        "PE gửi tuyến VPNv4 của khách cho PE/RR cùng AS (iBGP) với AS_PATH rỗng (Length = 0) nếu tuyến khách học bằng static/OSPF/connected; " +
        "nếu khách chạy eBGP với PE thì AS của khách nằm sẵn trong AS_PATH.",
      fixedBytes: 3,
      fields: [
        attrFlags("0", "1", "0", "0", "0x40", "well-known, transitive, Length 1 byte"),
        typeCode(2, "AS_PATH"),
        attrLen(8, "0", "= 0 với AS_PATH rỗng (iBGP, tuyến sinh trong AS)."),
        {
          id: "segments",
          name: "Path Segments",
          varBytes: { min: 0, max: 255, default: 0 },
          desc:
            "Chuỗi segment (Type 1 B, Length 1 B = số AS, rồi các ASN). Ví dụ AS_SEQUENCE 1 AS 4 byte: 02 01 00 00 FD E8 (AS 65000) = 6 byte. " +
            "Rỗng khi iBGP quảng bá tuyến do AS mình sinh ra.",
          example: "(rỗng)"
        }
      ],
      variants: [
        { id: "empty", name: "Rỗng (iBGP)", varBytes: { segments: 0 }, set: { "attr-len": "0" }, bytes: 3, note: "PE gửi tuyến VPNv4 của khách (static/connected/OSPF) tới PE/RR cùng AS." },
        { id: "seq-1as4", name: "1 AS (ASN 4 B)", varBytes: { segments: 6 }, set: { "attr-len": "6" }, bytes: 9, note: "AS_SEQUENCE chứa 1 ASN 4 byte, vd. tuyến khách học qua eBGP từ CE (AS 65000: 00 00 FD E8)." }
      ]
    },

    "bgp-attr-local-pref": {
      id: "bgp-attr-local-pref",
      name: "Path Attribute LOCAL_PREF",
      short: "LOCAL_PREF",
      layer: "l7",
      standard: "RFC 4271 §4.3, §5.1.5",
      summary: "Độ ưu tiên đường ra trong nội bộ AS (chỉ gửi qua iBGP): lớn hơn được chọn.",
      detail:
        "Well-known; bắt buộc trong mọi UPDATE gửi iBGP (gồm PE ↔ RR), không gửi sang eBGP (trừ confederation). " +
        "Sách hay gọi là 'discretionary' nhưng RFC 4271 §5 yêu cầu có mặt trong iBGP. " +
        "Mặc định 100 trên phần lớn hãng; tăng LOCAL_PREF ở một PE để mọi PE khác chọn đi qua PE đó (vd. site khách 2 đường, chọn chính/phụ).",
      fixedBytes: 7,
      fields: [
        attrFlags("0", "1", "0", "0", "0x40", "well-known, transitive, Length 1 byte"),
        typeCode(5, "LOCAL_PREF"),
        attrLen(8, "4", "LOCAL_PREF luôn = 4."),
        {
          id: "local-pref",
          name: "LOCAL_PREF",
          bits: 32,
          desc: "Số nguyên không dấu 32 bit; giá trị lớn hơn được ưu tiên trong bước chọn đường thứ hai (sau Weight của Cisco).",
          values: [{ v: "100", m: "Mặc định thường gặp" }],
          example: "100"
        }
      ]
    },

    "bgp-mp-reach": {
      id: "bgp-mp-reach",
      name: "Path Attribute MP_REACH_NLRI",
      short: "MP_REACH",
      layer: "l7",
      standard: "RFC 4760 §3; RFC 4364 §4.3.2, §4.3.4",
      summary: "Thuộc tính đa giao thức mang tuyến không phải IPv4 unicast — ở đây AFI 1/SAFI 128 (VPNv4) — kèm next hop là loopback PE quảng bá.",
      detail:
        "BGP-4 gốc chỉ mang IPv4 unicast; RFC 4760 thêm MP_REACH_NLRI (Type 14) để mang họ địa chỉ khác, xác định bằng cặp AFI/SAFI. " +
        "Hai PE phải thoả thuận capability Multiprotocol AFI 1/SAFI 128 trong OPEN thì mới trao đổi VPNv4. " +
        "Next Hop là địa chỉ VPN-IPv4 có RD = 0 + loopback của PE quảng bá (RFC 4364 §4.3.2): PE nhận dùng địa chỉ này để tìm nhãn transport (LDP/SR) tới PE kia. " +
        "Phần NLRI (tuyến VPNv4 có nhãn) nằm cuối thuộc tính — tách thành header bgp-vpnv4-nlri. " +
        "RFC 7606 §5.1: MP_REACH_NLRI phải được mã hoá là path attribute đầu tiên của UPDATE.",
      fixedBytes: 21,
      fields: [
        attrFlags("1", "0", "0", "1", "0x90", "optional non-transitive, Extended Length (Length 2 byte)"),
        typeCode(14, "MP_REACH_NLRI"),
        attrLen(16, "32", "Do E = 1 nên dài 2 byte. Gồm AFI…Reserved (17 byte) + toàn bộ NLRI; với 1 tuyến /24 = 17 + 15 = 32."),
        {
          id: "afi-safi",
          name: "AFI / SAFI",
          desc: "Cặp định danh họ địa chỉ: AFI 1 (IPv4) + SAFI 128 (MPLS-labeled VPN) = VPNv4.",
          children: [
            {
              id: "afi",
              name: "Address Family Identifier",
              abbr: "AFI",
              bits: 16,
              desc: "Họ địa chỉ (IANA). VPNv4 dùng AFI 1 vì prefix khách là IPv4; VPNv6 dùng AFI 2.",
              values: [
                { v: "1", m: "IPv4 (VPNv4 khi SAFI 128)" },
                { v: "2", m: "IPv6 (VPNv6 khi SAFI 128, RFC 4659)" },
                { v: "25", m: "L2VPN (VPLS/EVPN)" }
              ],
              example: "1"
            },
            {
              id: "safi",
              name: "Subsequent Address Family Identifier",
              abbr: "SAFI",
              bits: 8,
              desc: "Kiểu NLRI trong họ địa chỉ. SAFI 128 = MPLS-labeled VPN address (RFC 4364 §4.3.4): mỗi NLRI = nhãn + RD + prefix.",
              values: [
                { v: "1", m: "Unicast" },
                { v: "4", m: "Labeled unicast (BGP-LU, RFC 8277)" },
                { v: "128", m: "MPLS-labeled VPN (VPNv4/VPNv6)" },
                { v: "70", m: "EVPN (với AFI 25)" }
              ],
              example: "128"
            }
          ]
        },
        {
          id: "next-hop",
          name: "Next Hop",
          desc: "Next Hop Length + địa chỉ next hop. Với VPNv4, next hop là một địa chỉ VPN-IPv4: RD = 0 (8 byte 0) + IPv4 loopback của PE quảng bá — tổng 12 byte.",
          children: [
            {
              id: "nh-len",
              name: "Length of Next Hop Network Address",
              abbr: "NH Len",
              bits: 8,
              desc: "Độ dài next hop (byte). VPNv4 với next hop IPv4 = 12 (8 RD + 4 IPv4); VPNv6 với next hop IPv6 = 24 (hoặc 48 khi kèm link-local).",
              values: [
                { v: "12", m: "VPNv4: RD 0 + IPv4" },
                { v: "24", m: "VPNv6: RD 0 + IPv6 (RFC 4659)" }
              ],
              example: "12"
            },
            {
              id: "nh-rd",
              name: "Next Hop – Route Distinguisher",
              abbr: "RD = 0",
              bits: 64,
              desc: "RD của địa chỉ next hop luôn = 0 (8 byte 0x00) — chỉ để next hop có cùng dạng địa chỉ VPN-IPv4, không mang ý nghĩa VRF.",
              example: "0:0"
            },
            {
              id: "nh-ip",
              name: "Next Hop – IPv4",
              abbr: "Next Hop IPv4",
              bits: 32,
              desc: "Loopback của PE quảng bá: PE quảng bá dùng địa chỉ của chính nó làm BGP next hop (RFC 4364 §4.3.2). PE nhận đẩy nhãn transport tới địa chỉ này làm nhãn ngoài, nhãn VPN (trong NLRI) làm nhãn trong.",
              example: "10.0.0.2"
            }
          ]
        },
        {
          id: "reserved",
          name: "Reserved",
          bits: 8,
          reserved: true,
          desc: "1 byte dự trữ (trước đây là Number of SNPAs, RFC 2858). Phải = 0 khi gửi, bên nhận bỏ qua.",
          example: "0"
        }
      ]
    },

    "bgp-vpnv4-nlri": {
      id: "bgp-vpnv4-nlri",
      name: "VPN-IPv4 NLRI (labeled)",
      short: "VPNv4 NLRI",
      layer: "l7",
      standard: "RFC 4364 §4.1, §4.2, §4.3.4; RFC 8277 §2.2",
      summary: "Một tuyến VPNv4: nhãn VPN (3 byte) + Route Distinguisher (8 byte) + prefix IPv4 của khách. Đây chính là nơi PE đích quảng bá nhãn VPN.",
      detail:
        "Mỗi NLRI = Length (tính bằng BIT) + Label + RD + Prefix; nhiều NLRI có thể nối tiếp nhau trong cùng MP_REACH_NLRI nếu chung thuộc tính. " +
        "RD + prefix IPv4 tạo thành địa chỉ VPN-IPv4 12 byte (RFC 4364 §4.1): 10.1.1.0/24 của khách A và của khách B trở thành hai tuyến khác nhau nhờ RD khác nhau. " +
        "Label là nhãn VPN mà PE quảng bá cấp — PE kia đặt nó làm nhãn đáy (S = 1) khi gửi gói của khách tới prefix này (xem stack mpls-l3vpn). " +
        "Rút tuyến dùng MP_UNREACH_NLRI (Type 15) với cùng định dạng; khi đó trường Label không có ý nghĩa và nên đặt 0x800000 (RFC 8277 §2.4). " +
        "RD có 3 kiểu (Type 0/1/2) cùng dài 8 byte, khác cách chia Administrator / Assigned Number — chọn ở nút biến thể.",
      fixedBytes: 6,
      fields: [
        {
          id: "length",
          name: "Length",
          bits: 8,
          desc: "Độ dài phần còn lại của NLRI tính bằng BIT (không phải byte): 24 (nhãn) + 64 (RD) + độ dài prefix. Prefix /24 → 112; /32 → 120; /0 → 88.",
          values: [
            { v: "88", m: "Tuyến mặc định 0.0.0.0/0 trong VRF" },
            { v: "112", m: "Prefix /24" },
            { v: "120", m: "Prefix /32 (vd. loopback CE)" }
          ],
          example: "112"
        },
        {
          id: "label-field",
          name: "Label (nhãn VPN)",
          desc:
            "3 byte có cùng bố cục với 3 byte đầu của MPLS Label Stack Entry (không có TTL). Giá trị Label 20 bit CHÍNH LÀ nhãn VPN (nhãn trong) mà gói dữ liệu của khách sẽ mang trong mặt phẳng dữ liệu.",
          children: [
            {
              id: "label",
              name: "Label",
              bits: 20,
              desc: "Nhãn VPN do PE quảng bá cấp (theo VRF, theo prefix hoặc theo CE tuỳ cấu hình). PE nhận đẩy nhãn này xuống đáy chồng nhãn khi gửi tới prefix; PE đích nhìn nhãn để biết gói thuộc VRF/khách nào (tuỳ kiểu cấp nhãn: theo VRF thì tra VRF; theo prefix/CE thì biết ngay cổng ra) — RFC 4364 §4.3.2.",
              values: [
                { v: "0–15", m: "Nhãn dành riêng, không dùng làm nhãn VPN" },
                { v: "0x80000 (cả 3 byte = 0x800000)", m: "Giá trị Compatibility khi rút tuyến (RFC 8277 §2.4)" }
              ],
              example: "30"
            },
            {
              id: "rsv",
              name: "Rsrv",
              abbr: "Rsrv",
              bits: 3,
              reserved: true,
              desc: "3 bit nằm đúng chỗ TC/EXP của nhãn MPLS; trong NLRI không mang ý nghĩa QoS: nên = 0 khi gửi, bỏ qua khi nhận (RFC 8277 §2.2).",
              example: "000"
            },
            {
              id: "s",
              name: "Bottom of Stack",
              abbr: "S",
              bits: 1,
              desc: "= 1 ở nhãn cuối cùng trong NLRI. VPNv4 chỉ mang 1 nhãn nên S = 1 (khi thoả thuận Multiple Labels capability, RFC 8277, có thể mang nhiều nhãn).",
              example: "1"
            }
          ]
        },
        {
          id: "rd",
          name: "Route Distinguisher (RD)",
          desc:
            "8 byte ghép trước prefix để tuyến của các VRF khác nhau không đụng nhau trong bảng BGP (RFC 4364 §4.2). RD chỉ làm prefix DUY NHẤT — " +
            "nó KHÔNG quyết định tuyến được nhập vào VRF nào (việc đó do Route Target). RD không xuất hiện trong gói dữ liệu.",
          children: [
            {
              id: "rd-type",
              name: "Type Field",
              abbr: "RD Type",
              bits: 16,
              desc: "Kiểu RD, quyết định cách chia 6 byte Value thành Administrator + Assigned Number.",
              values: [
                { v: "0", m: "ASN 2 byte : số 4 byte (vd. 65000:100) — phổ biến nhất" },
                { v: "1", m: "IPv4 4 byte : số 2 byte (vd. 10.0.0.2:100) — RD duy nhất mỗi PE" },
                { v: "2", m: "ASN 4 byte : số 2 byte (vd. 4200000000:100)" }
              ],
              example: "0"
            },
            {
              id: "rd-t0",
              name: "Value – Type 0 (ASN 2 B : số 4 B)",
              optional: "RD Type = 0",
              choice: "rd-type",
              desc: "Administrator = ASN 2 byte (nên là AS của nhà cung cấp), Assigned Number 4 byte do nhà cung cấp tự đánh.",
              children: [
                { id: "rd0-admin", name: "Administrator (ASN 2 byte)", abbr: "ASN", bits: 16, desc: "Số AS 2 byte, thường là AS của nhà cung cấp dịch vụ.", example: "65000" },
                { id: "rd0-num", name: "Assigned Number (4 byte)", abbr: "Assigned", bits: 32, desc: "Số do nhà cung cấp gán, thường theo khách/VRF.", example: "100" }
              ]
            },
            {
              id: "rd-t1",
              name: "Value – Type 1 (IPv4 : số 2 B)",
              optional: "RD Type = 1",
              choice: "rd-type",
              desc: "Administrator = địa chỉ IPv4 4 byte (thường loopback PE), Assigned Number 2 byte. Hay dùng để mỗi PE có RD riêng (thuận lợi multihoming/ECMP qua RR).",
              children: [
                { id: "rd1-admin", name: "Administrator (IPv4)", abbr: "IPv4", bits: 32, desc: "Địa chỉ IPv4, thường là loopback (router-id) của PE.", example: "10.0.0.2" },
                { id: "rd1-num", name: "Assigned Number (2 byte)", abbr: "Assigned", bits: 16, desc: "Số do người quản trị địa chỉ IPv4 đó gán.", example: "100" }
              ]
            },
            {
              id: "rd-t2",
              name: "Value – Type 2 (ASN 4 B : số 2 B)",
              optional: "RD Type = 2",
              choice: "rd-type",
              desc: "Administrator = ASN 4 byte (RFC 6793), Assigned Number 2 byte.",
              children: [
                { id: "rd2-admin", name: "Administrator (ASN 4 byte)", abbr: "ASN", bits: 32, desc: "Số AS 4 byte.", example: "4200000000" },
                { id: "rd2-num", name: "Assigned Number (2 byte)", abbr: "Assigned", bits: 16, desc: "Số do nhà cung cấp gán.", example: "100" }
              ]
            }
          ]
        },
        {
          id: "prefix",
          name: "IPv4 Prefix",
          varBytes: { min: 0, max: 4, default: 3 },
          desc:
            "Prefix IPv4 của khách, chỉ mang đủ số byte để chứa độ dài prefix (làm tròn lên; bit thừa trong byte cuối = 0): /0 → 0 byte, /16 → 2, /24 → 3, /32 → 4. " +
            "Độ dài prefix = Length − 88.",
          example: "172.16.2 (172.16.2.0/24)"
        }
      ],
      variants: [
        { id: "t0-p0", name: "RD Type 0, /0", enable: ["rd-t0"], varBytes: { prefix: 0 }, set: { length: "88", "rd-type": "0" }, bytes: 12, note: "Tuyến mặc định 0.0.0.0/0 trong VRF." },
        { id: "t0-p16", name: "RD Type 0, /16", enable: ["rd-t0"], varBytes: { prefix: 2 }, set: { length: "104", "rd-type": "0" }, bytes: 14, note: "Prefix /16: chỉ 2 byte prefix." },
        { id: "t0-p24", name: "RD Type 0, /24", enable: ["rd-t0"], varBytes: { prefix: 3 }, set: { length: "112", "rd-type": "0" }, bytes: 15, note: "RD 65000:100 — kiểu ASN:nn quen thuộc." },
        { id: "t1-p24", name: "RD Type 1, /24", enable: ["rd-t1"], varBytes: { prefix: 3 }, set: { length: "112", "rd-type": "1" }, bytes: 15, note: "RD 10.0.0.2:100 — RD theo loopback PE." },
        { id: "t2-p24", name: "RD Type 2, /24", enable: ["rd-t2"], varBytes: { prefix: 3 }, set: { length: "112", "rd-type": "2" }, bytes: 15, note: "RD 4200000000:100 — AS 4 byte." },
        { id: "t0-p32", name: "RD Type 0, /32", enable: ["rd-t0"], varBytes: { prefix: 4 }, set: { length: "120", "rd-type": "0" }, bytes: 16, note: "Prefix /32 (host, loopback CE)." }
      ]
    },

    "bgp-attr-ext-comm": {
      id: "bgp-attr-ext-comm",
      name: "Path Attribute EXTENDED_COMMUNITIES (Route Target)",
      short: "Ext Comm (RT)",
      layer: "l7",
      standard: "RFC 4360 §2–5; RFC 5668 §2; RFC 4364 §4.3.1",
      summary: "Thuộc tính optional transitive mang các community 8 byte; ở đây là một Route Target — quyết định VRF nào nhập tuyến.",
      detail:
        "Mỗi extended community dài 8 byte: Type (1 B) + Sub-type (1 B) + Value 6 B; Length của thuộc tính = 8 × số community. " +
        "Route Target (Sub-type 0x02): PE quảng bá gắn RT export của VRF; PE nhận chỉ nhập tuyến vào VRF có RT import trùng — đó là cách vẽ topo VPN (full mesh, hub-and-spoke, extranet). " +
        "Phân biệt: RD (trong NLRI) chỉ để prefix duy nhất, RT (thuộc tính này) chọn VRF import/export; hai giá trị hay được đặt giống nhau (65000:100) nhưng là hai thứ khác hẳn. " +
        "Một tuyến có thể mang nhiều RT. Cả RD lẫn RT chỉ có trong control plane, không bao giờ nằm trong gói dữ liệu.",
      fixedBytes: 5,
      fields: [
        attrFlags("1", "1", "0", "0", "0xC0", "optional transitive, Length 1 byte"),
        typeCode(16, "EXTENDED_COMMUNITIES"),
        attrLen(8, "8", "= 8 × số extended community; 1 Route Target → 8."),
        {
          id: "ext-comm",
          name: "Extended Community (Route Target)",
          desc: "Một extended community 8 byte. Type cho biết dạng Global Administrator; Sub-type 0x02 cho biết đây là Route Target.",
          children: [
            {
              id: "ec-type",
              name: "Type (high)",
              abbr: "Type",
              bits: 8,
              desc:
                "Kiểu community. Bit cao nhất I (IANA authority), bit kế T (0 = transitive qua AS, 1 = non-transitive); 6 bit còn lại là kiểu. " +
                "Ba kiểu dùng cho RT đều là transitive.",
              values: [
                { v: "0x00", m: "Two-Octet AS Specific: ASN 2 B : số 4 B (RFC 4360 §3.1)" },
                { v: "0x01", m: "IPv4 Address Specific: IPv4 : số 2 B (RFC 4360 §3.2)" },
                { v: "0x02", m: "Four-Octet AS Specific: ASN 4 B : số 2 B (RFC 5668)" }
              ],
              example: "0x00"
            },
            {
              id: "ec-subtype",
              name: "Sub-type (low)",
              abbr: "Sub-type",
              bits: 8,
              desc: "Ý nghĩa của community trong kiểu đó.",
              values: [
                { v: "0x02", m: "Route Target (RFC 4360 §4)" },
                { v: "0x03", m: "Route Origin / Site of Origin (RFC 4360 §5)" }
              ],
              example: "0x02"
            },
            {
              id: "rt-t0",
              name: "Value – Type 0x00 (ASN 2 B : số 4 B)",
              optional: "Type = 0x00",
              choice: "rt-type",
              desc: "Global Administrator = ASN 2 byte, Local Administrator 4 byte. Vd. RT 65000:100.",
              children: [
                { id: "rt0-global", name: "Global Administrator (ASN 2 byte)", abbr: "ASN", bits: 16, desc: "Số AS 2 byte của nhà cung cấp.", example: "65000" },
                { id: "rt0-local", name: "Local Administrator (4 byte)", abbr: "Local", bits: 32, desc: "Số do nhà cung cấp gán cho VPN.", example: "100" }
              ]
            },
            {
              id: "rt-t1",
              name: "Value – Type 0x01 (IPv4 : số 2 B)",
              optional: "Type = 0x01",
              choice: "rt-type",
              desc: "Global Administrator = địa chỉ IPv4 4 byte, Local Administrator 2 byte. Vd. RT 10.0.0.2:100.",
              children: [
                { id: "rt1-global", name: "Global Administrator (IPv4)", abbr: "IPv4", bits: 32, desc: "Địa chỉ IPv4 (thường loopback của PE/thiết bị gán RT).", example: "10.0.0.2" },
                { id: "rt1-local", name: "Local Administrator (2 byte)", abbr: "Local", bits: 16, desc: "Số do người quản trị địa chỉ đó gán.", example: "100" }
              ]
            },
            {
              id: "rt-t2",
              name: "Value – Type 0x02 (ASN 4 B : số 2 B)",
              optional: "Type = 0x02",
              choice: "rt-type",
              desc: "Global Administrator = ASN 4 byte, Local Administrator 2 byte (RFC 5668). Vd. RT 4200000000:100.",
              children: [
                { id: "rt2-global", name: "Global Administrator (ASN 4 byte)", abbr: "ASN", bits: 32, desc: "Số AS 4 byte.", example: "4200000000" },
                { id: "rt2-local", name: "Local Administrator (2 byte)", abbr: "Local", bits: 16, desc: "Số do nhà cung cấp gán.", example: "100" }
              ]
            }
          ]
        }
      ],
      variants: [
        { id: "rt-as2", name: "RT 0x00 (ASN 2 B)", enable: ["rt-t0"], set: { "ec-type": "0x00", "ec-subtype": "0x02" }, bytes: 11, note: "RT 65000:100 — dạng phổ biến nhất." },
        { id: "rt-ipv4", name: "RT 0x01 (IPv4)", enable: ["rt-t1"], set: { "ec-type": "0x01", "ec-subtype": "0x02" }, bytes: 11, note: "RT 10.0.0.2:100." },
        { id: "rt-as4", name: "RT 0x02 (ASN 4 B)", enable: ["rt-t2"], set: { "ec-type": "0x02", "ec-subtype": "0x02" }, bytes: 11, note: "RT 4200000000:100 khi AS 4 byte (RFC 5668)." }
      ]
    }
  });
})();
