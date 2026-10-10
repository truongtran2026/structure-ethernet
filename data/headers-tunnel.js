// Header nhóm tunnel / MPLS / IPsec: mpls-label, pw-cw, gre, vxlan, esp, esp-trailer, esp-icv.
// Nguồn: RFC 3032, RFC 5462, RFC 4385, RFC 4448, RFC 2784, RFC 2890, RFC 7348, RFC 4303, RFC 4106, RFC 3602, RFC 2404, RFC 4868.
window.HEADERS = window.HEADERS || {};
Object.assign(window.HEADERS, {
  "mpls-label": {
    id: "mpls-label",
    name: "MPLS Label Stack Entry",
    short: "MPLS",
    layer: "l2_5",
    standard: "RFC 3032 §2.1, RFC 5462 (EXP → TC)",
    summary: "Một mục 32 bit trong chồng nhãn MPLS; router LSR chuyển mạch gói chỉ dựa vào nhãn trên cùng.",
    detail:
      "MPLS chèn một hoặc nhiều Label Stack Entry giữa header lớp 2 và gói được mang (\"lớp 2.5\"). " +
      "Mỗi LSR tra nhãn trên cùng trong LFIB rồi swap/pop/push, không cần đọc header IP. " +
      "Chồng nhãn đọc từ ngoài vào trong; chỉ nhãn đáy (cuối cùng) có S = 1. " +
      "EtherType 0x8847 báo hiệu MPLS unicast, 0x8848 là MPLS với nhãn upstream-assigned (RFC 5332; trước đây gọi là “MPLS multicast”).",
    fixedBytes: 4,
    fields: [
      {
        id: "label",
        name: "Label",
        bits: 20,
        desc:
          "Giá trị nhãn dùng làm khoá tra bảng chuyển mạch (LFIB) tại LSR. " +
          "Nhãn 0–15 là nhãn đặc biệt; nhãn do LDP/RSVP-TE/BGP/SR cấp thường ≥ 16.",
        values: [
          { v: "0", m: "IPv4 Explicit NULL – egress pop rồi xử lý IPv4 (giữ TC)" },
          { v: "1", m: "Router Alert" },
          { v: "2", m: "IPv6 Explicit NULL" },
          { v: "3", m: "Implicit NULL – chỉ dùng trong báo hiệu (PHP), không xuất hiện trên dây" },
          { v: "7", m: "Entropy Label Indicator (RFC 6790)" },
          { v: "13", m: "GAL – Generic Associated Channel Label (RFC 5586)" },
          { v: "14", m: "OAM Alert (RFC 3429)" },
        ],
        example: "24001",
      },
      {
        id: "tc",
        name: "Traffic Class",
        abbr: "TC",
        bits: 3,
        desc:
          "Phân lớp QoS cho gói trong miền MPLS (8 mức, tương tự PCP/DSCP). " +
          "Trước RFC 5462 gọi là EXP (Experimental); PE thường ánh xạ DSCP → TC khi push nhãn.",
        values: [
          { v: "0", m: "Best effort" },
          { v: "5", m: "Thường dùng cho thoại/EF" },
          { v: "6–7", m: "Điều khiển mạng (control plane)" },
        ],
        example: "0",
      },
      {
        id: "s",
        name: "Bottom of Stack",
        abbr: "S",
        bits: 1,
        desc:
          "Đánh dấu nhãn cuối cùng của chồng nhãn. S = 1 chỉ ở nhãn đáy — sau nhãn này là payload " +
          "(IPv4/IPv6, Control Word, khung Ethernet…); S = 0 nghĩa là còn nhãn nữa phía sau.",
        values: [
          { v: "0", m: "Còn nhãn khác phía sau" },
          { v: "1", m: "Nhãn đáy (bottom of stack)" },
        ],
      },
      {
        id: "ttl",
        name: "Time to Live",
        abbr: "TTL",
        bits: 8,
        desc:
          "Giảm 1 tại mỗi LSR để chống vòng lặp, giống TTL của IP. " +
          "Ingress PE thường chép TTL từ IP (TTL propagation); nếu tắt propagation thì đặt 255 để ẩn hop MPLS khỏi traceroute.",
        example: "63",
      },
    ],
  },

  "pw-cw": {
    id: "pw-cw",
    name: "Pseudowire Control Word",
    short: "CW",
    layer: "l2_5",
    standard: "RFC 4385 §3, RFC 4448 §4.6",
    summary: "Từ điều khiển 4 byte đặt ngay sau nhãn PW, giúp LSR không nhầm khung Ethernet khách hàng thành gói IP.",
    detail:
      "Nibble đầu luôn bằng 0000 nên LSR làm ECMP theo \"đoán IP\" (nhìn nibble đầu = 4 hoặc 6) sẽ không băm nhầm " +
      "khung Ethernet có MAC bắt đầu bằng 4/6, tránh sắp xếp lại gói. " +
      "Với Ethernet PW (RFC 4448) CW là tuỳ chọn, thỏa thuận qua LDP; Flags/FRG/Length thường bằng 0. " +
      "Sequence Number cho phép phát hiện gói mất/đảo thứ tự, 0 nghĩa là không dùng.",
    fixedBytes: 4,
    fields: [
      {
        id: "control",
        name: "Control bits",
        desc: "16 bit đầu của Control Word: nibble nhận dạng 0000, cờ, bit phân mảnh và độ dài.",
        children: [
          {
            id: "nibble",
            name: "First nibble (0000)",
            abbr: "0000",
            bits: 4,
            reserved: true,
            desc:
              "Luôn bằng 0000 để phân biệt với gói IPv4 (4) / IPv6 (6) khi LSR nhìn vào byte sau nhãn đáy. " +
              "Giá trị 0001 dùng cho Associated Channel (PW-ACH, OAM/BFD), không phải dữ liệu.",
            values: [
              { v: "0000", m: "PW Control Word mang dữ liệu" },
              { v: "0001", m: "PW Associated Channel Header (OAM)" },
            ],
          },
          {
            id: "flags",
            name: "Flags",
            bits: 4,
            desc: "Cờ dành riêng cho từng loại PW; với Ethernet PW (RFC 4448) phải bằng 0.",
            example: "0000",
          },
          {
            id: "frg",
            name: "Fragmentation",
            abbr: "FRG",
            bits: 2,
            desc: "Bit phân mảnh PW (RFC 4623); 00 = gói không bị phân mảnh. Ethernet PW gần như luôn để 00.",
            values: [
              { v: "00", m: "Không phân mảnh" },
              { v: "01", m: "Mảnh đầu" },
              { v: "10", m: "Mảnh cuối" },
              { v: "11", m: "Mảnh giữa" },
            ],
          },
          {
            id: "length",
            name: "Length",
            bits: 6,
            desc:
              "Chỉ khác 0 khi payload PW ngắn hơn 64 byte và phải đệm để đủ khung Ethernet tối thiểu trên link; " +
              "khi đó ghi độ dài thật (CW + payload) để egress bỏ phần đệm.",
            example: "0",
          },
        ],
      },
      {
        id: "seq",
        name: "Sequence Number",
        bits: 16,
        desc:
          "Số thứ tự gói trên PW để phát hiện mất hoặc đảo thứ tự. " +
          "0 = không dùng sequencing; khi dùng thì đếm 1…65535 rồi quay về 1 (bỏ qua 0).",
        example: "0",
      },
    ],
  },

  gre: {
    id: "gre",
    name: "Generic Routing Encapsulation (GRE)",
    short: "GRE",
    layer: "tunnel",
    standard: "RFC 2784 §2, RFC 2890 §2",
    summary: "Header tunnel tối giản 4 byte cho biết giao thức bên trong; có thể thêm Checksum, Key, Sequence Number.",
    detail:
      "GRE đóng gói một gói bất kỳ (IPv4, IPv6, MPLS, khung Ethernet…) vào trong IP với IP Protocol = 47. " +
      "Header cơ bản chỉ 4 byte: khối cờ + Version và Protocol Type (EtherType của gói bên trong). " +
      "Mỗi cờ C/K/S bằng 1 sẽ thêm một trường 4 byte theo đúng thứ tự Checksum → Key → Sequence, nên GRE dài 4–16 byte. " +
      "Key thường dùng để phân biệt nhiều tunnel giữa cùng cặp endpoint (vd. NVGRE, tunnel per-VRF).",
    fixedBytes: 4,
    maxBytes: 16,
    fields: [
      {
        id: "flags-version",
        name: "Flags & Version",
        desc:
          "Khối 16 bit đầu: các cờ báo trường tuỳ chọn nào có mặt (C, K, S) và số phiên bản GRE. " +
          "RFC 2784 gọi bit 1–12 là Reserved0; RFC 2890 dùng bit 2 làm K và bit 3 làm S.",
        children: [
          {
            id: "c",
            name: "Checksum Present",
            abbr: "C",
            bits: 1,
            desc: "C = 1 thì có thêm Checksum (16) + Reserved1 (16) ngay sau Protocol Type.",
            values: [
              { v: "0", m: "Không có Checksum" },
              { v: "1", m: "Có Checksum + Reserved1" },
            ],
            example: "0",
          },
          {
            id: "r",
            name: "Reserved (bit 1)",
            abbr: "R",
            bits: 1,
            reserved: true,
            desc: "Bit dự trữ (trước đây là Routing Present trong RFC 1701), phải bằng 0.",
          },
          {
            id: "k",
            name: "Key Present",
            abbr: "K",
            bits: 1,
            desc: "K = 1 thì có trường Key 32 bit (RFC 2890).",
            values: [
              { v: "0", m: "Không có Key" },
              { v: "1", m: "Có Key" },
            ],
            example: "0",
          },
          {
            id: "s",
            name: "Sequence Number Present",
            abbr: "S",
            bits: 1,
            desc: "S = 1 thì có trường Sequence Number 32 bit (RFC 2890).",
            values: [
              { v: "0", m: "Không có Sequence Number" },
              { v: "1", m: "Có Sequence Number" },
            ],
            example: "0",
          },
          {
            id: "reserved0",
            name: "Reserved0",
            bits: 9,
            reserved: true,
            desc: "Dự trữ, bên gửi đặt 0. Bên nhận phải bỏ gói nếu bit 1–5 khác 0 (RFC 2784), trừ khi hỗ trợ RFC 1701.",
          },
          {
            id: "ver",
            name: "Version",
            abbr: "Ver",
            bits: 3,
            desc: "Phiên bản GRE, phải bằng 0. Giá trị 1 dùng cho Enhanced GRE của PPTP (RFC 2637).",
            values: [
              { v: "0", m: "GRE chuẩn (RFC 2784)" },
              { v: "1", m: "Enhanced GRE (PPTP)" },
            ],
            example: "0",
          },
        ],
      },
      {
        id: "protocol-type",
        name: "Protocol Type",
        bits: 16,
        desc:
          "EtherType của gói được mang bên trong GRE — cho đầu kia biết phải giải mã payload thành gì.",
        values: [
          { v: "0x0800", m: "IPv4" },
          { v: "0x86DD", m: "IPv6" },
          { v: "0x8847", m: "MPLS unicast" },
          { v: "0x6558", m: "Transparent Ethernet Bridging (GRETAP, NVGRE)" },
          { v: "0x88BE", m: "ERSPAN type II" },
        ],
        example: "0x0800",
      },
      {
        id: "checksum-group",
        name: "Checksum + Reserved1",
        optional: "C = 1",
        desc: "Chỉ có khi C = 1: checksum bảo vệ header GRE và payload, kèm 16 bit dự trữ cho đủ 4 byte.",
        children: [
          {
            id: "checksum",
            name: "Checksum",
            bits: 16,
            desc: "Checksum bù một (one's complement, như IP) tính trên header GRE và toàn bộ payload. Ít dùng trong thực tế.",
          },
          {
            id: "reserved1",
            name: "Reserved1",
            bits: 16,
            reserved: true,
            desc: "Dự trữ, đặt 0; chỉ có mặt cùng Checksum.",
          },
        ],
      },
      {
        id: "key",
        name: "Key",
        bits: 32,
        optional: "K = 1",
        desc:
          "Chỉ có khi K = 1: số định danh luồng/tunnel do hai đầu cấu hình, giúp phân biệt nhiều tunnel giữa cùng cặp IP. " +
          "NVGRE (RFC 7637) dùng 24 bit cao của Key làm VSID và 8 bit thấp làm FlowID.",
        example: "1001",
      },
      {
        id: "seq",
        name: "Sequence Number",
        bits: 32,
        optional: "S = 1",
        desc: "Chỉ có khi S = 1: số thứ tự tăng dần để bên nhận phát hiện gói đến sai thứ tự hoặc mất.",
        example: "1",
      },
    ],
    variants: [
      { id: "basic", name: "Cơ bản", enable: [], set: { c: "0", k: "0", s: "0" }, bytes: 4,
        note: "GRE cơ bản theo RFC 2784, phổ biến nhất (vd. tunnel site-to-site)." },
      { id: "key", name: "Key", enable: ["key"], set: { c: "0", k: "1", s: "0" }, bytes: 8,
        note: "Dùng Key để phân biệt nhiều tunnel cùng cặp endpoint (vd. mỗi VRF/tenant một key). NVGRE bắt buộc dạng này (C=0, K=1, S=0): 24 bit cao của Key là VSID, 8 bit thấp là FlowID." },
      { id: "seq", name: "Sequence", enable: ["seq"], set: { c: "0", k: "0", s: "1" }, bytes: 8,
        note: "Đánh số thứ tự để bên nhận phát hiện gói sai thứ tự hoặc mất." },
      { id: "checksum", name: "Checksum", enable: ["checksum-group"], set: { c: "1", k: "0", s: "0" }, bytes: 8,
        note: "Hiếm gặp vì tốn CPU tính checksum trên cả payload." },
      { id: "key-seq", name: "Key + Sequence", enable: ["key", "seq"], set: { c: "0", k: "1", s: "1" }, bytes: 12,
        note: "Tunnel có Key và đánh số thứ tự để phát hiện gói đến sai thứ tự (GRE không tự sắp xếp lại; bên nhận có thể bỏ hoặc đệm gói)." },
      { id: "checksum-key", name: "Checksum + Key", enable: ["checksum-group", "key"], set: { c: "1", k: "1", s: "0" }, bytes: 12,
        note: "Tunnel phân biệt bằng Key và có kiểm tra toàn vẹn; ít gặp." },
      { id: "checksum-seq", name: "Checksum + Sequence", enable: ["checksum-group", "seq"], set: { c: "1", k: "0", s: "1" }, bytes: 12,
        note: "Tunnel có checksum và số thứ tự nhưng không dùng Key; ít gặp." },
      { id: "full", name: "Đầy đủ C+K+S", enable: ["checksum-group", "key", "seq"], set: { c: "1", k: "1", s: "1" }, bytes: 16,
        note: "Bật mọi trường tuỳ chọn; gặp khi cần đủ kiểm tra toàn vẹn, phân biệt tunnel và thứ tự gói." },
    ],
  },

  vxlan: {
    id: "vxlan",
    name: "VXLAN Header",
    short: "VXLAN",
    layer: "tunnel",
    standard: "RFC 7348 §5",
    summary: "Header 8 byte mang VNI 24 bit, đặt sau UDP (port 4789) để đưa khung Ethernet qua mạng IP.",
    detail:
      "VXLAN là overlay L2-over-UDP: VTEP đóng gói nguyên khung Ethernet của máy ảo/host vào UDP/IP. " +
      "VNI 24 bit cho tới ~16 triệu segment, khắc phục giới hạn 4094 VLAN. " +
      "UDP source port thường là hash của khung bên trong để ECMP trong underlay chia tải tốt. " +
      "Tổng overhead ≈ 50 byte (14 Ethernet + 20 IPv4 + 8 UDP + 8 VXLAN) nên underlay cần MTU ≥ 1550.",
    fixedBytes: 8,
    fields: [
      {
        id: "flags",
        name: "Flags",
        bits: 8,
        desc:
          "8 bit cờ, trong đó chỉ bit I (0x08) có nghĩa: I = 1 báo VNI hợp lệ. Các bit còn lại dự trữ, đặt 0.",
        values: [{ v: "0x08", m: "I = 1 – VNI hợp lệ (giá trị chuẩn)" }],
        example: "0x08",
      },
      {
        id: "reserved1",
        name: "Reserved",
        bits: 24,
        reserved: true,
        desc: "Dự trữ, đặt 0 khi gửi và bỏ qua khi nhận. (VXLAN-GPE dùng một phần vùng này cho Next Protocol.)",
      },
      {
        id: "vni",
        name: "VXLAN Network Identifier",
        abbr: "VNI",
        bits: 24,
        desc:
          "Định danh segment L2 overlay (tương tự VLAN ID nhưng 24 bit). " +
          "VTEP dùng VNI để chọn bridge domain; trong EVPN-VXLAN, L3VNI đại diện cho VRF.",
        example: "10100",
      },
      {
        id: "reserved2",
        name: "Reserved",
        bits: 8,
        reserved: true,
        desc: "Dự trữ, đặt 0.",
      },
    ],
  },

  // ───────────── IPsec ESP (RFC 4303): header, trailer, ICV ─────────────
  esp: {
    id: "esp",
    name: "Encapsulating Security Payload (ESP) Header",
    short: "ESP",
    layer: "tunnel",
    standard: "RFC 4303 §2.1–2.3, RFC 4106 (AES-GCM), RFC 3602 (AES-CBC)",
    summary: "Phần đầu của gói ESP (IP Protocol 50): SPI chọn Security Association, Sequence Number chống phát lại, kèm IV của thuật toán mã hoá.",
    detail:
      "ESP bọc phần dữ liệu cần bảo vệ thành ba khối: header (SPI + Sequence Number + IV), phần đã mã hoá (payload + ESP trailer) và ICV ở cuối. " +
      "SPI + Sequence Number không mã hoá (bên nhận cần chúng để tìm khoá) nhưng nằm trong vùng ICV xác thực. " +
      "Theo RFC 4303, IV thuộc đầu trường Payload Data và cũng KHÔNG được mã hoá; ở đây tách IV thành field riêng để thấy rõ kích thước của nó theo từng thuật toán. " +
      "Không có trường độ dài hay \"next protocol\" ở đầu — giao thức bên trong chỉ biết sau khi giải mã, qua Next Header trong trailer.",
    fixedBytes: 8,
    maxBytes: 24,
    fields: [
      {
        id: "spi",
        name: "Security Parameters Index",
        abbr: "SPI",
        bits: 32,
        desc:
          "Số định danh Security Association (SA) do bên nhận chọn khi IKE thương lượng; bên nhận dùng SPI (kèm IP đích) để tìm khoá và thuật toán giải mã. " +
          "Mỗi chiều của tunnel có SPI riêng. Giá trị 1–255 do IANA dự trữ, 0 không xuất hiện trên dây.",
        values: [
          { v: "0", m: "Dự trữ – chỉ dùng nội bộ, không gửi trên dây" },
          { v: "1–255", m: "IANA dự trữ" },
        ],
        example: "0x00001001",
      },
      {
        id: "seq",
        name: "Sequence Number",
        bits: 32,
        desc:
          "Bộ đếm tăng 1 cho mỗi gói gửi trên SA, bắt đầu từ 1; bên nhận dùng cửa sổ chống phát lại (anti-replay window) để loại gói trùng/cũ. " +
          "Với Extended Sequence Number (ESN, 64 bit) chỉ 32 bit thấp được gửi trên dây, 32 bit cao vẫn đưa vào tính ICV.",
        example: "1",
      },
      {
        id: "iv",
        name: "Initialization Vector",
        abbr: "IV",
        varBytes: { min: 0, max: 16, default: 8 },
        desc:
          "Giá trị khởi tạo cho thuật toán mã hoá, gửi rõ (không mã hoá) ở đầu Payload Data theo RFC 4303; tách riêng ở đây để thấy kích thước. " +
          "Độ dài do thuật toán quyết định: AES-GCM/ChaCha20-Poly1305 dùng 8 byte, AES-CBC dùng 16 byte (bằng một block), ENCR_NULL không có IV.",
        example: "8 byte (AES-GCM)",
      },
    ],
    variants: [
      { id: "null", name: "ENCR_NULL (chỉ xác thực)", enable: [], varBytes: { iv: 0 }, bytes: 8,
        note: "Không mã hoá, chỉ xác thực (vd. ENCR_NULL + HMAC-SHA-256, RFC 2410): không có IV; payload vẫn đọc được bằng Wireshark." },
      { id: "aes-gcm", name: "AES-GCM-128/256", enable: [], varBytes: { iv: 8 }, bytes: 16,
        note: "AES-GCM (RFC 4106) — combined mode vừa mã hoá vừa xác thực, IV 8 byte; lựa chọn phổ biến nhất hiện nay. ChaCha20-Poly1305 (RFC 7634) cũng dùng IV 8 byte." },
      { id: "aes-cbc", name: "AES-CBC", enable: [], varBytes: { iv: 16 }, bytes: 24,
        note: "AES-CBC (RFC 3602): IV 16 byte = một block AES, đi kèm thuật toán xác thực riêng (HMAC-SHA1-96/HMAC-SHA-256-128)." },
    ],
  },

  "esp-trailer": {
    id: "esp-trailer",
    name: "ESP Trailer",
    short: "ESP Trl",
    layer: "tunnel",
    standard: "RFC 4303 §2.4–2.6",
    summary: "Phần đuôi nằm trong vùng mã hoá của ESP: Padding + Pad Length + Next Header cho biết bên trong là giao thức gì.",
    detail:
      "Padding làm cho (payload + padding + 2 byte cuối) chia hết cho block size của thuật toán (AES-CBC: 16 byte), " +
      "và trong mọi trường hợp phải để Pad Length + Next Header kết thúc thẳng hàng 4 byte (AES-GCM: căn 4 byte). " +
      "Toàn bộ trailer bị mã hoá cùng payload (trừ khi dùng ENCR_NULL, RFC 2410) nên người quan sát không thấy Next Header — đó là lý do ESP đặt \"next protocol\" ở cuối thay vì ở đầu. " +
      "Sau khi giải mã, bên nhận đọc Pad Length để cắt padding rồi dựa vào Next Header để giao phần còn lại cho GRE (47), IPv4 (4)…",
    fixedBytes: 2,
    maxBytes: 257,
    fields: [
      {
        id: "padding",
        name: "Padding",
        varBytes: { min: 0, max: 255, default: 2 },
        desc:
          "0–255 byte đệm để căn theo block mã hoá (CBC: 16 byte; GCM: 4 byte) và để hai trường cuối thẳng hàng 4 byte. " +
          "Nội dung mặc định là dãy 1, 2, 3… để bên nhận kiểm tra; có thể đệm thêm để che độ dài thật của gói.",
        example: "01 02",
      },
      {
        id: "pad-length",
        name: "Pad Length",
        bits: 8,
        desc: "Số byte Padding ngay phía trước (0–255), để bên nhận cắt bỏ padding sau khi giải mã.",
        example: "2",
      },
      {
        id: "next-header",
        name: "Next Header",
        bits: 8,
        desc:
          "Giao thức của dữ liệu được bảo vệ (giá trị IP Protocol của IANA). " +
          "Transport mode: giao thức lớp trên của gói gốc (GRE = 47, TCP = 6…); tunnel mode: 4 (cả gói IPv4) hoặc 41 (IPv6).",
        values: [
          { v: "4", m: "IPv4 – tunnel mode (cả gói IPv4 nằm bên trong)" },
          { v: "41", m: "IPv6 – tunnel mode" },
          { v: "47", m: "GRE – GRE over IPsec transport mode" },
          { v: "6", m: "TCP (transport mode)" },
          { v: "17", m: "UDP (transport mode)" },
          { v: "59", m: "No Next Header – gói giả (dummy) để che lưu lượng (TFC)" },
        ],
        example: "47",
      },
    ],
    variants: [
      { id: "no-pad", name: "Không padding", enable: [], varBytes: { padding: 0 }, set: { "pad-length": "0" }, bytes: 2,
        note: "Khi (payload + 2) đã chia hết cho kích thước căn chỉnh (vd. GCM với payload 90 byte → 92 chia hết 4). Ít gặp với dữ liệu ngẫu nhiên." },
      { id: "gcm-align4", name: "GCM – căn 4 byte", enable: [], varBytes: { padding: 2 }, set: { "pad-length": "2" }, bytes: 4,
        note: "AES-GCM chỉ yêu cầu căn 4 byte. Tính cho payload 64 byte mặc định của stack transport: GRE 4 + IPv4 20 + 64 = 88; 88 + 2 = 90 → đệm 2 thành 92 (chia hết 4). Stack tunnel: 20 + 88 + 2 = 110 → cũng đệm 2." },
      { id: "cbc-align16", name: "CBC – căn 16 byte", enable: [], varBytes: { padding: 6 }, set: { "pad-length": "6" }, bytes: 8,
        note: "AES-CBC yêu cầu căn theo block 16 byte. Tính cho payload 64 byte mặc định của stack transport: 88 + 2 = 90 → đệm 6 thành 96 (= 6 block). (Stack tunnel: 110 + 2 = 112 = 7 block, chỉ cần đệm 2.)" },
    ],
  },

  "esp-icv": {
    id: "esp-icv",
    name: "ESP Integrity Check Value (ICV)",
    short: "ICV",
    layer: "tunnel",
    standard: "RFC 4303 §2.8, RFC 2404, RFC 4868, RFC 4106",
    summary: "Mã xác thực ở cuối gói ESP, chứng minh header ESP + phần mã hoá không bị sửa và đến từ đúng peer.",
    detail:
      "ICV KHÔNG bao gồm header IP ngoài (khác với AH). Với HMAC (vd. AES-CBC + HMAC), ICV tính trên SPI, Sequence Number, IV và ciphertext (gồm cả trailer); " +
      "bên nhận kiểm ICV trước khi giải mã, nên gói giả mạo bị loại sớm mà không tốn công giải mã. " +
      "Với AES-GCM (AEAD), AAD chỉ gồm SPI + Sequence Number (ESN nếu dùng); IV là một phần của nonce (salt 4 byte + IV 8 byte) nên được bảo vệ gián tiếp; kiểm tag và giải mã diễn ra cùng một bước (RFC 4106 §4–5). " +
      "Độ dài phụ thuộc thuật toán: HMAC thường cắt ngắn (truncate) giá trị băm, ví dụ HMAC-SHA-256 cho 32 byte nhưng chỉ gửi 16 byte. " +
      "ICV không bị mã hoá và không có trường độ dài — hai bên biết kích thước nhờ SA đã thương lượng.",
    fixedBytes: 0,
    maxBytes: 32,
    fields: [
      {
        id: "icv",
        name: "Integrity Check Value",
        abbr: "ICV",
        varBytes: { min: 0, max: 32, default: 16 },
        desc:
          "Giá trị kiểm tra toàn vẹn do thuật toán xác thực sinh ra (HMAC cắt ngắn hoặc authentication tag của AES-GCM). " +
          "HMAC phủ SPI, Seq, IV và ciphertext (gồm trailer); GCM phủ ciphertext cộng AAD = SPI + Seq. " +
          "Bên nhận tự tính lại và so sánh; sai một bit là bỏ gói.",
        example: "16 byte (AES-GCM tag)",
      },
    ],
    variants: [
      { id: "none", name: "Không ICV", enable: [], varBytes: { icv: 0 }, bytes: 0,
        note: "Chỉ mã hoá, không xác thực (vd. AES-CBC không kèm HMAC). RFC 4303 chỉ cho phép confidentiality-only ở mức MAY, nhưng RFC 8221 §4 quy định \"Encryption without authentication is not effective and MUST NOT be used\"; AUTH_NONE là MUST NOT (bảng §6) trừ khi dùng AEAD như AES-GCM — khi đó ICV chính là tag GCM. Vì vậy chỉ mang tính minh hoạ." },
      { id: "hmac-sha1-96", name: "HMAC-SHA1-96", enable: [], varBytes: { icv: 12 }, bytes: 12,
        note: "HMAC-SHA1-96 (RFC 2404); từng là mặc định, nay chỉ còn để tương thích thiết bị cũ. (AES-GCM cũng cho phép ICV 8/12 byte – RFC 4106 §6.)" },
      { id: "icv-16", name: "AES-GCM / HMAC-SHA-256-128", enable: [], varBytes: { icv: 16 }, bytes: 16,
        note: "16 byte: authentication tag của AES-GCM (RFC 4106, ICV 16 byte – loại phổ biến) hoặc HMAC-SHA-256 cắt còn 128 bit (RFC 4868) đi kèm AES-CBC. Gộp một biến thể vì cùng kích thước." },
      { id: "hmac-sha512-256", name: "HMAC-SHA-512-256", enable: [], varBytes: { icv: 32 }, bytes: 32,
        note: "HMAC-SHA-512 cắt còn 256 bit (RFC 4868); mức SHOULD trong RFC 8221, dùng khi cần ICV dài hơn." },
    ],
  },
});
