// Header nhóm tunnel / MPLS: mpls-label, pw-cw, gre, vxlan.
// Nguồn: RFC 3032, RFC 5462, RFC 4385, RFC 4448, RFC 2784, RFC 2890, RFC 7348.
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
});
