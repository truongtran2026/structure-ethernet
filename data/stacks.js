// Các loại frame hoàn chỉnh (stack), header liệt kê từ ngoài vào trong.
// Quy ước payload: mọi stack dùng 64 byte dữ liệu ứng dụng (payload.data = 64) để người học so sánh
// overhead giữa các loại frame trên cùng một lượng dữ liệu. Vì payload là dữ liệu thô (không có header lớp 4), IPv4 mang nó đặt Protocol = 253 (thử nghiệm, RFC 3692).
// 64 byte đủ để mọi frame đạt tối thiểu 64 byte. Ngoại lệ: ieee8023-llc dùng BPDU thật 35 byte (có padding).
window.STACKS = window.STACKS || [];
(function () {
  var DATA = 64;

  function payload(note) {
    return { header: "payload", label: "Payload (dữ liệu ứng dụng)", note: note || "Ví dụ 64 byte dữ liệu ứng dụng.", varBytes: { data: DATA } };
  }
  function fcs(note) {
    return {
      header: "eth-fcs",
      note: note || "CRC-32 tính trên toàn frame từ Destination MAC tới hết payload (không gồm preamble/SFD).",
    };
  }
  // Header Ethernet II: MAC + EtherType
  function ethII(group, type, note, typeNote, macNote) {
    return {
      group: group,
      note: note,
      children: [
        { header: "eth-mac", note: macNote },
        { header: "ethertype", set: { type: type }, note: typeNote },
      ],
    };
  }
  // Đánh dấu node (header/group) là phần được THÊM so với stack compareTo.
  function added(node) {
    node.added = true;
    return node;
  }
  var NO_FCS = "Khung Ethernet bên trong KHÔNG mang FCS riêng — chỉ có FCS của frame ngoài cùng trên link.";

  window.STACKS.push(
    // ───────────────────────── Ethernet cơ bản ─────────────────────────
    {
      id: "eth2-ipv4",
      name: "Ethernet II + IPv4",
      category: "Ethernet cơ bản",
      summary: "Frame Ethernet II phổ biến nhất: MAC đích/nguồn, EtherType 0x0800, gói IPv4 và FCS.",
      detail:
        "Đây là frame gốc để so sánh với mọi loại frame khác. Header Ethernet II chỉ 14 byte: 6 byte MAC đích, " +
        "6 byte MAC nguồn và 2 byte EtherType cho biết lớp trên là IPv4 (0x0800). " +
        "Trên dây còn có Preamble + SFD 8 byte trước frame và khoảng trống IFG 12 byte sau frame, nhưng chúng không tính vào kích thước frame. " +
        "Frame tối thiểu 64 byte, tối đa 1518 byte (MTU 1500) tính từ MAC đích tới FCS.",
      tree: [
        { header: "phy-preamble", wire: true, note: "7 byte Preamble + 1 byte SFD để đồng bộ bit; chỉ có trên dây, không tính vào frame." },
        ethII("Ethernet II header", "0x0800", "14 byte: ai gửi, gửi cho ai, và lớp trên là gì.", "0x0800 = IPv4 → header kế tiếp là IPv4."),
        { header: "ipv4", set: { protocol: "253", src: "192.168.1.10", dst: "192.168.1.20", ttl: "64" }, note: "Gói IPv4 20 byte (không có options). Payload ở đây là dữ liệu thô, không gắn giao thức lớp 4 cụ thể, nên Protocol = 253 (giá trị dành cho thử nghiệm, RFC 3692) cho nhất quán; thực tế sẽ là 6 (TCP), 17 (UDP)… — xem các stack bên dưới." },
        payload("Ví dụ 64 byte dữ liệu (lớp 4 trở lên). Payload Ethernet (IPv4 + dữ liệu) phải ≥ 46 byte, nếu thiếu sẽ được đệm."),
        fcs(),
      ],
    },
    {
      id: "eth2-ipv6",
      name: "Ethernet II + IPv6",
      category: "Ethernet cơ bản",
      compareTo: "eth2-ipv4",
      summary: "Giống Ethernet II + IPv4 nhưng EtherType 0x86DD và header IPv6 cố định 40 byte.",
      detail:
        "Lớp 2 không đổi; chỉ EtherType chuyển từ 0x0800 sang 0x86DD để báo lớp trên là IPv6. " +
        "Header IPv6 dài cố định 40 byte (so với 20 byte của IPv4 không options) do địa chỉ 128 bit, " +
        "nhưng đơn giản hơn: không có checksum, không phân mảnh tại router, tuỳ chọn đưa vào extension header. " +
        "Vì vậy cùng 64 byte dữ liệu, frame IPv6 dài hơn 20 byte.",
      tree: [
        ethII("Ethernet II header", "0x86DD", "Giống hệt Ethernet II của IPv4, chỉ khác EtherType.", "0x86DD = IPv6."),
        { added: true, header: "ipv6", set: { "next-header": "59", "hop-limit": "64", src: "2001:db8::10", dst: "2001:db8::5" }, note: "Header IPv6 cố định 40 byte; Next Header = 59 (No Next Header, RFC 8200) vì payload ở đây là dữ liệu thô, không có header lớp trên." },
        payload(),
        fcs(),
      ],
    },
    {
      id: "eth2-ipv4-tcp",
      name: "Ethernet II + IPv4 + TCP",
      category: "Ethernet cơ bản",
      compareTo: "eth2-ipv4",
      summary: "Frame mang segment TCP: IPv4 Protocol = 6, thêm header TCP 20 byte.",
      detail:
        "So với Ethernet II + IPv4, thêm header TCP (20 byte khi không có options) giữa IPv4 và dữ liệu. " +
        "Trường Protocol của IPv4 bằng 6 để báo lớp 4 là TCP. " +
        "TCP thêm port, số thứ tự, ACK, cờ và window để truyền tin cậy, có điều khiển luồng — đó là lý do header dài hơn UDP. " +
        "Ví dụ là kết nối HTTPS: client port động → server port 443.",
      tree: [
        ethII("Ethernet II header", "0x0800", "MAC + EtherType IPv4.", "0x0800 = IPv4."),
        { header: "ipv4", set: { protocol: "6", src: "192.168.1.10", dst: "203.0.113.80", ttl: "64" }, note: "Protocol = 6 → lớp kế tiếp là TCP." },
        { added: true, header: "tcp", set: { "src-port": "51514", "dst-port": "443" }, note: "Port nguồn là port động của client; port đích 443 (HTTPS)." },
        payload(),
        fcs(),
      ],
    },
    {
      id: "eth2-ipv4-udp",
      name: "Ethernet II + IPv4 + UDP",
      category: "Ethernet cơ bản",
      compareTo: "eth2-ipv4",
      summary: "Frame mang datagram UDP: IPv4 Protocol = 17, thêm header UDP 8 byte.",
      detail:
        "So với Ethernet II + IPv4, thêm header UDP 8 byte: port nguồn, port đích, độ dài và checksum. " +
        "Trường Protocol của IPv4 bằng 17 để báo lớp 4 là UDP. " +
        "UDP không thiết lập kết nối, không đảm bảo tin cậy nên header rất gọn — phù hợp DNS, VoIP, và làm nền cho tunnel như VXLAN. " +
        "Ví dụ là một truy vấn DNS tới port 53.",
      tree: [
        ethII("Ethernet II header", "0x0800", "MAC + EtherType IPv4.", "0x0800 = IPv4."),
        { header: "ipv4", set: { protocol: "17", src: "192.168.1.10", dst: "8.8.8.8", ttl: "64" }, note: "Protocol = 17 → lớp kế tiếp là UDP." },
        { added: true, header: "udp", set: { "src-port": "50000", "dst-port": "53" }, note: "Port đích 53 = DNS." },
        payload(),
        fcs(),
      ],
    },
    {
      id: "ieee8023-llc",
      name: "IEEE 802.3 + LLC",
      category: "Ethernet cơ bản",
      compareTo: "eth2-ipv4",
      summary: "Frame 802.3 \"thuần\": trường 2 byte sau MAC là Length (≤ 1500), lớp trên được xác định bằng LLC.",
      detail:
        "Khác Ethernet II ở chỗ 2 byte sau MAC là Length (độ dài dữ liệu, ≤ 0x05DC) thay vì EtherType (≥ 0x0600); " +
        "thiết bị phân biệt hai loại frame bằng chính giá trị này. " +
        "Vì Length không cho biết giao thức lớp trên, phải thêm header LLC 3 byte (DSAP, SSAP, Control). " +
        "Ví dụ dùng DSAP/SSAP = 0x42 của Spanning Tree (BPDU) — ứng dụng 802.3/LLC còn gặp nhiều nhất ngày nay. " +
        "Không có header IP: LLC mang thẳng dữ liệu giao thức. Riêng stack này không dùng 64 byte dữ liệu chung " +
        "mà dùng Configuration BPDU thật 35 byte; frame ngắn hơn 64 byte nên được đệm (padding) — Length không tính phần đệm.",
      tree: [
        {
          group: "802.3 MAC header",
          note: "14 byte như Ethernet II, nhưng trường cuối là Length.",
          children: [
            { header: "eth-mac", note: "Ví dụ: MAC đích là địa chỉ multicast của STP 01:80:C2:00:00:00." },
            { added: true, header: "eth-length", set: { length: "0x0026 (38)" }, note: "Length = LLC 3 + Configuration BPDU 35 = 38 byte (≤ 1500 nên là Length, không phải EtherType). RST BPDU 36 byte → 0x0027." },
          ],
        },
        { added: true, header: "llc", set: { dsap: "0x42", ssap: "0x42", control: "0x03" }, note: "DSAP/SSAP 0x42 = Spanning Tree; Control 0x03 = UI (không kết nối)." },
        { header: "payload", label: "Payload (Configuration BPDU)", varBytes: { data: 35 }, note: "Configuration BPDU STP 35 byte (IEEE 802.1D). MAC 12 + Length 2 + LLC 3 + BPDU 35 + FCS 4 = 56 byte < 64, nên sau BPDU có 8 byte đệm (padding) để frame đủ 64 byte; Length không tính phần đệm." },
        fcs(),
      ],
    },
    {
      id: "ieee8023-snap",
      name: "IEEE 802.3 + LLC + SNAP",
      category: "Ethernet cơ bản",
      compareTo: "eth2-ipv4",
      summary: "802.3 có LLC = AA/AA/03 và header SNAP 5 byte để mang lại EtherType (OUI + PID).",
      detail:
        "Khi dùng frame 802.3 mà vẫn muốn mang các giao thức định danh bằng EtherType, LLC đặt DSAP = SSAP = 0xAA và Control = 0x03, " +
        "rồi thêm SNAP 5 byte: OUI 3 byte + Protocol ID 2 byte. " +
        "OUI = 00-00-00 nghĩa là PID chính là EtherType (vd. 0x0800 = IPv4); OUI của hãng (vd. Cisco 00-00-0C) thì PID do hãng định nghĩa (CDP = 0x2000). " +
        "So với Ethernet II tốn thêm 8 byte (LLC + SNAP), nên IP trên Ethernet thực tế dùng Ethernet II.",
      tree: [
        {
          group: "802.3 MAC header",
          note: "Trường sau MAC là Length.",
          children: [
            { header: "eth-mac" },
            { added: true, header: "eth-length", set: { length: "0x0048 (72)" }, note: "Length = LLC 3 + SNAP 5 + dữ liệu 64 = 72 byte." },
          ],
        },
        { added: true, header: "llc", set: { dsap: "0xAA", ssap: "0xAA", control: "0x03" }, note: "AA/AA/03 báo hiệu có header SNAP phía sau." },
        { added: true, header: "snap", set: { oui: "00-00-00", pid: "0x0800" }, note: "OUI 00-00-00 → PID là EtherType; 0x0800 = IPv4 (RFC 1042)." },
        payload("Ví dụ 64 byte dữ liệu (ở đây là gói IPv4, gộp chung làm payload để tập trung vào LLC/SNAP)."),
        fcs(),
      ],
    },

    // ───────────────────────── VLAN ─────────────────────────
    {
      id: "dot1q",
      name: "802.1Q VLAN tag",
      category: "VLAN",
      compareTo: "eth2-ipv4",
      summary: "Chèn tag 802.1Q 4 byte (TPID 0x8100 + TCI) giữa MAC nguồn và EtherType.",
      detail:
        "So với Ethernet II, thêm đúng 4 byte VLAN tag ngay sau MAC nguồn: TPID 0x8100 nằm đúng vị trí EtherType cũ nên " +
        "thiết bị nhận biết frame có tag, sau đó là TCI (PCP 3 bit + DEI 1 bit + VID 12 bit). " +
        "EtherType thật (0x0800) bị đẩy ra sau tag. Frame tối đa tăng lên 1522 byte. " +
        "Tag được thêm/bỏ tại cổng trunk/access của switch; FCS phải tính lại khi chèn tag.",
      tree: [
        {
          group: "Ethernet header + 802.1Q tag",
          note: "18 byte: MAC (12) + VLAN tag (4) + EtherType (2).",
          children: [
            { header: "eth-mac" },
            { added: true, header: "vlan-8021q", label: "802.1Q C-Tag", set: { tpid: "0x8100", pcp: "0", dei: "0", vid: "100" }, note: "VLAN 100; TPID 0x8100 nằm đúng chỗ EtherType của Ethernet II." },
            { header: "ethertype", set: { type: "0x0800" }, note: "EtherType thật của payload, bị đẩy ra sau tag." },
          ],
        },
        { header: "ipv4", set: { protocol: "253", src: "192.168.100.10", dst: "192.168.100.20" } },
        payload(),
        fcs("CRC-32 tính lại khi switch chèn/bỏ tag."),
      ],
    },
    {
      id: "qinq",
      name: "802.1ad QinQ (S-Tag + C-Tag)",
      category: "VLAN",
      compareTo: "eth2-ipv4",
      summary: "Hai tag chồng nhau: S-Tag 0x88A8 của nhà cung cấp bọc ngoài C-Tag 0x8100 của khách hàng.",
      detail:
        "So với Ethernet II, thêm 8 byte: S-Tag (Service tag, TPID 0x88A8) của nhà cung cấp và C-Tag (Customer tag, TPID 0x8100) của khách hàng. " +
        "Nhà cung cấp chỉ chuyển mạch theo S-VID nên khách hàng giữ nguyên dải VLAN riêng của mình. " +
        "Tag ngoài cùng nằm gần MAC nhất. Một số thiết bị cũ dùng TPID 0x9100 hoặc 0x8100 cho tag ngoài.",
      tree: [
        {
          group: "Ethernet header + S-Tag + C-Tag",
          note: "22 byte: MAC (12) + S-Tag (4) + C-Tag (4) + EtherType (2).",
          children: [
            { header: "eth-mac" },
            { added: true, header: "vlan-8021ad", label: "802.1ad S-Tag (nhà cung cấp)", set: { tpid: "0x88A8", pcp: "0", dei: "0", vid: "200" }, note: "S-VLAN 200: định danh dịch vụ/khách hàng trong mạng nhà cung cấp." },
            { added: true, header: "vlan-8021q", label: "802.1Q C-Tag (khách hàng)", set: { tpid: "0x8100", pcp: "0", dei: "0", vid: "100" }, note: "C-VLAN 100 của khách hàng, được nhà cung cấp mang trong suốt." },
            { header: "ethertype", set: { type: "0x0800" } },
          ],
        },
        { header: "ipv4", set: { protocol: "253", src: "192.168.100.10", dst: "192.168.100.20" } },
        payload(),
        fcs(),
      ],
    },
    {
      id: "pbb",
      name: "802.1ah PBB (MAC-in-MAC)",
      category: "VLAN",
      compareTo: "eth2-ipv4",
      summary: "Bọc toàn bộ frame khách hàng trong header backbone: B-DA/B-SA, B-Tag và I-Tag mang I-SID 24 bit.",
      detail:
        "PBB thêm một header Ethernet backbone hoàn chỉnh trước frame của khách hàng: B-DA/B-SA (MAC của BEB), " +
        "B-Tag (TPID 0x88A8, chọn B-VLAN) và I-Tag 6 byte (TPID 0x88E7, I-SID 24 bit định danh dịch vụ). " +
        "Lõi mạng chỉ học MAC của các BEB chứ không học MAC khách hàng, nên bảng MAC nhỏ và dịch vụ mở rộng tới 16 triệu I-SID. " +
        "Frame khách hàng giữ nguyên MAC và C-Tag; S-Tag của khách thường được BEB bỏ đi và ánh xạ sang I-SID (không vẽ ở đây). " +
        "Toàn frame chỉ có một FCS ở cuối.",
      tree: [
        {
          added: true,
          group: "Backbone header (PBB)",
          note: "22 byte: B-DA/B-SA (12) + B-Tag (4) + I-Tag (6) do Backbone Edge Bridge thêm vào.",
          children: [
            { header: "eth-mac", label: "B-DA / B-SA", note: "MAC của BEB đích/nguồn trong mạng backbone." },
            { header: "vlan-8021ad", label: "B-Tag", set: { tpid: "0x88A8", vid: "300" }, note: "B-VLAN 300 trong lõi backbone." },
            { header: "pbb-itag", label: "I-Tag", set: { tpid: "0x88E7", isid: "10000", uca: "0" }, note: "TPID 0x88E7; I-SID (24 bit) định danh dịch vụ khách hàng, ví dụ 10000." },
          ],
        },
        {
          group: "Customer frame (C-DA/C-SA…)",
          note: "Frame khách hàng được mang nguyên vẹn, không có FCS riêng.",
          children: [
            { header: "eth-mac", label: "C-DA / C-SA", note: "MAC gốc của khách hàng." },
            { header: "vlan-8021q", label: "C-Tag", set: { tpid: "0x8100", vid: "100" }, note: "C-VLAN của khách hàng." },
            { header: "ethertype", set: { type: "0x0800" } },
            { header: "ipv4", set: { protocol: "253", src: "192.168.100.10", dst: "192.168.100.20" } },
            payload(),
          ],
        },
        fcs("FCS duy nhất, tính trên toàn frame backbone."),
      ],
    },

    // ───────────────────────── MPLS & VPN ─────────────────────────
    {
      id: "mpls-ipv4",
      name: "MPLS (1 nhãn) + IPv4",
      category: "MPLS & VPN",
      compareTo: "eth2-ipv4",
      summary: "Chèn một nhãn MPLS 4 byte giữa Ethernet và IPv4; EtherType đổi thành 0x8847.",
      detail:
        "So với Ethernet II + IPv4, thêm một Label Stack Entry 4 byte (\"lớp 2.5\") và EtherType đổi từ 0x0800 sang 0x8847. " +
        "LSR chuyển gói theo nhãn (LDP/SR cấp) thay vì tra bảng định tuyến IP. " +
        "Chỉ có một nhãn nên S = 1; MPLS không có trường báo giao thức bên trong — egress LSR biết giao thức nhờ binding nhãn ↔ FEC do chính nó quảng bá, không phải đoán (RFC 3032 §2.2). " +
        "LSR trung gian có thể nhìn nibble đầu sau nhãn đáy (4 = IPv4, 6 = IPv6) chỉ để băm ECMP (RFC 4928). " +
        "Với PHP, nhãn bị pop ở hop áp chót và gói đến egress là IPv4 thuần.",
      tree: [
        ethII("Ethernet II header", "0x8847", "MAC của hai LSR kề nhau (đổi ở mỗi hop).", "0x8847 = MPLS unicast → header kế tiếp là nhãn MPLS."),
        { added: true, header: "mpls-label", label: "MPLS label (LDP)", set: { label: "24001", tc: "0", s: "1", ttl: "63" }, note: "Nhãn duy nhất nên S = 1; TTL chép từ IP (64) rồi trừ 1." },
        { header: "ipv4", set: { protocol: "253", src: "10.1.1.1", dst: "10.2.2.2", ttl: "64" }, note: "Gói IPv4 nguyên vẹn; LSR ở giữa không đọc header này." },
        payload(),
        fcs(),
      ],
    },
    {
      id: "mpls-l3vpn",
      name: "MPLS L3VPN (2 nhãn)",
      category: "MPLS & VPN",
      compareTo: "eth2-ipv4",
      summary: "Hai nhãn MPLS: nhãn transport đưa gói tới PE đích, nhãn VPN chỉ VRF của khách hàng.",
      detail:
        "So với Ethernet II + IPv4, thêm chồng 2 nhãn (8 byte) và EtherType 0x8847. " +
        "Nhãn ngoài (transport, LDP/RSVP/SR) được swap qua từng P router để tới PE đích; nhãn trong (VPN, do MP-BGP quảng bá) " +
        "chỉ PE đích hiểu, dùng để chọn VRF. Nhờ vậy nhiều khách hàng dùng trùng dải IP riêng vẫn tách biệt. " +
        "Chỉ nhãn VPN ở đáy có S = 1. Gói IPv4 bên trong là gói của khách hàng, không có header IP bọc ngoài.",
      tree: [
        ethII("Ethernet II header", "0x8847", "MAC giữa hai router kề nhau trong lõi MPLS.", "0x8847 = MPLS unicast."),
        {
          added: true,
          group: "MPLS label stack",
          note: "2 nhãn × 4 byte, đọc từ ngoài vào trong.",
          children: [
            { header: "mpls-label", label: "Transport label (outer)", set: { label: "24001", tc: "0", s: "0", ttl: "63" }, note: "Nhãn LDP/SR tới loopback PE đích; S = 0 vì còn nhãn phía sau." },
            { header: "mpls-label", label: "VPN label (inner)", set: { label: "30", tc: "0", s: "1", ttl: "63" }, note: "Nhãn VPN do MP-BGP (VPNv4) cấp; PE đích dùng để chọn VRF. Nhãn đáy nên S = 1." },
          ],
        },
        { header: "ipv4", label: "IPv4 của khách hàng", set: { protocol: "253", src: "172.16.1.10", dst: "172.16.2.20", ttl: "63" }, note: "Gói IP khách hàng (địa chỉ riêng, có thể trùng giữa các VRF)." },
        payload(),
        fcs(),
      ],
    },
    {
      id: "mpls-l2vpn-vpws",
      name: "MPLS L2VPN VPWS (EoMPLS)",
      category: "MPLS & VPN",
      compareTo: "eth2-ipv4",
      summary: "Pseudowire điểm–điểm: nhãn transport + nhãn PW + Control Word, bên trong là nguyên khung Ethernet khách hàng.",
      detail:
        "So với Ethernet II + IPv4, thêm nhãn transport, nhãn PW (S = 1) và Control Word 4 byte, sau đó là nguyên khung Ethernet của khách hàng " +
        "(MAC, VLAN tag, EtherType, IPv4) — thêm 30 byte: Ethernet lõi 14 + 8 byte nhãn + 4 byte CW, cộng 4 byte VLAN tag vốn có của khung khách (khung khách được mang nguyên vẹn). " +
        "PE chỉ ánh xạ attachment circuit (cổng/VLAN) ↔ pseudowire, không học MAC và không đọc IP khách. " +
        "Control Word (nibble đầu 0000) tránh việc LSR làm ECMP nhầm khung Ethernet thành gói IP. " +
        "Khung Ethernet bên trong không có FCS riêng — chỉ có FCS của frame ngoài.",
      tree: [
        added(ethII("Ethernet II header (lõi MPLS)", "0x8847", "MAC giữa hai router kề nhau trong lõi.", "0x8847 = MPLS unicast.")),
        {
          added: true,
          group: "MPLS label stack",
          note: "Nhãn transport + nhãn pseudowire.",
          children: [
            { header: "mpls-label", label: "Transport label (outer)", set: { label: "24001", s: "0", ttl: "254" }, note: "Đưa gói tới PE đầu kia; S = 0." },
            { header: "mpls-label", label: "PW label (inner)", set: { label: "299776", s: "1", ttl: "255" }, note: "Nhãn pseudowire do LDP (targeted) cấp; xác định attachment circuit ở PE đích. S = 1." },
          ],
        },
        { added: true, header: "pw-cw", set: { seq: "0" }, note: "Control Word 4 byte; Sequence = 0 nghĩa là không dùng sequencing." },
        {
          group: "Inner Ethernet frame (khách hàng)",
          note: NO_FCS,
          children: [
            { header: "eth-mac", label: "MAC khách hàng", note: "MAC gốc của thiết bị khách hàng, PE không đổi." },
            { header: "vlan-8021q", set: { tpid: "0x8100", vid: "100" }, note: "VLAN tag của khách (tuỳ chế độ raw/tagged có thể bị bỏ)." },
            { header: "ethertype", set: { type: "0x0800" } },
            { header: "ipv4", set: { protocol: "253", src: "192.168.100.10", dst: "192.168.100.20" } },
            payload(),
          ],
        },
        fcs("FCS của frame ngoài cùng trên link lõi MPLS."),
      ],
    },
    {
      id: "mpls-vpls",
      name: "MPLS L2VPN VPLS",
      category: "MPLS & VPN",
      compareTo: "eth2-ipv4",
      summary: "Cùng khuôn dạng với VPWS nhưng PE hoạt động như switch ảo, học MAC và nối nhiều site qua lưới pseudowire.",
      detail:
        "Trên dây VPLS giống hệt VPWS: Ethernet lõi (0x8847) · nhãn transport · nhãn PW · Control Word (tuỳ chọn) · khung Ethernet khách. " +
        "Khác biệt nằm ở control plane: mỗi PE có một VSI (virtual switch) học MAC nguồn của khung bên trong và gắn với PW nhận được, " +
        "các PE nối full mesh pseudowire (LDP RFC 4762 hoặc BGP RFC 4761). " +
        "Split horizon: khung nhận từ một PW lõi không bao giờ được chuyển sang PW lõi khác, thay cho STP để chống loop. " +
        "Khung broadcast/unknown unicast bị nhân bản ra mọi PW (ingress replication).",
      tree: [
        added(ethII("Ethernet II header (lõi MPLS)", "0x8847", "MAC giữa hai router kề nhau trong lõi.", "0x8847 = MPLS unicast.")),
        {
          added: true,
          group: "MPLS label stack",
          note: "Nhãn transport + nhãn PW của VSI.",
          children: [
            { header: "mpls-label", label: "Transport label (outer)", set: { label: "24001", s: "0", ttl: "254" }, note: "Tới PE đích; S = 0." },
            { header: "mpls-label", label: "PW label (VSI)", set: { label: "299808", s: "1", ttl: "255" }, note: "Xác định VSI và PW nguồn — PE đích học MAC nguồn gắn với PW này. S = 1." },
          ],
        },
        { added: true, header: "pw-cw", set: { seq: "0" }, note: "Control Word tuỳ chọn với VPLS (thỏa thuận qua LDP); nhiều triển khai bật để tránh lỗi ECMP." },
        {
          group: "Inner Ethernet frame (khách hàng)",
          note: NO_FCS + " MAC nguồn của khung này là thứ VSI học.",
          children: [
            { header: "eth-mac", label: "MAC khách hàng", note: "VSI học MAC nguồn ↔ PW; tra MAC đích để chọn PW/AC ra." },
            { header: "vlan-8021q", set: { tpid: "0x8100", vid: "100" }, note: "VLAN tag của khách (tagged mode)." },
            { header: "ethertype", set: { type: "0x0800" } },
            { header: "ipv4", set: { protocol: "253", src: "192.168.100.10", dst: "192.168.100.30" } },
            payload(),
          ],
        },
        fcs("FCS của frame ngoài cùng trên link lõi MPLS."),
      ],
    },

    // ───────────────────────── Tunnel & Overlay ─────────────────────────
    {
      id: "gre-ipv4",
      name: "GRE over IPv4 (IPv4 trong GRE)",
      category: "Tunnel & Overlay",
      compareTo: "eth2-ipv4",
      summary: "Gói IPv4 gốc được bọc trong GRE 4 byte và một header IPv4 ngoài (Protocol 47).",
      detail:
        "So với Ethernet II + IPv4, thêm header IPv4 ngoài (20 byte, Protocol = 47) và GRE 4 byte — overhead 24 byte nên MTU tunnel thường đặt 1476. " +
        "IPv4 ngoài mang địa chỉ hai đầu tunnel, mạng ở giữa chỉ định tuyến theo nó. " +
        "GRE Protocol Type = 0x0800 cho đầu kia biết bên trong là IPv4. " +
        "Không có mã hoá: GRE thường kết hợp IPsec khi cần bảo mật.",
      tree: [
        ethII("Ethernet II header", "0x0800", "MAC của link vật lý underlay.", "0x0800 = IPv4 (IPv4 ngoài)."),
        { added: true, header: "ipv4", label: "Outer IPv4 (tunnel)", set: { protocol: "47", src: "203.0.113.1", dst: "198.51.100.2", ttl: "255" }, note: "Địa chỉ hai đầu tunnel; Protocol = 47 → header kế tiếp là GRE." },
        { added: true, header: "gre", set: { c: "0", k: "0", s: "0", "protocol-type": "0x0800" }, note: "GRE cơ bản 4 byte; Protocol Type 0x0800 → bên trong là IPv4." },
        { header: "ipv4", label: "Inner IPv4 (gói gốc)", set: { protocol: "253", src: "10.0.1.10", dst: "10.0.2.20", ttl: "63" }, note: "Gói IP gốc giữa hai mạng LAN." },
        payload(),
        fcs(),
      ],
    },
    {
      id: "gre-key-seq",
      name: "GRE có Key + Sequence Number",
      category: "Tunnel & Overlay",
      compareTo: "eth2-ipv4",
      summary: "Như GRE over IPv4 nhưng bật K và S: header GRE dài 12 byte với Key và Sequence Number.",
      detail:
        "Giống GRE over IPv4, nhưng cờ K = 1 và S = 1 nên GRE thêm Key (4 byte) và Sequence Number (4 byte), tổng 12 byte; overhead lên 32 byte. " +
        "Key cho phép nhiều tunnel giữa cùng cặp endpoint (vd. mỗi VRF một key) và phải khớp ở hai đầu. " +
        "Sequence Number giúp bên nhận phát hiện gói đến sai thứ tự. " +
        "Thứ tự trường optional luôn là Checksum → Key → Sequence; ở đây C = 0 nên không có Checksum.",
      tree: [
        ethII("Ethernet II header", "0x0800", "MAC của link vật lý underlay.", "0x0800 = IPv4 (IPv4 ngoài)."),
        { added: true, header: "ipv4", label: "Outer IPv4 (tunnel)", set: { protocol: "47", src: "203.0.113.1", dst: "198.51.100.2", ttl: "255" }, note: "Protocol = 47 → GRE." },
        {
          added: true,
          header: "gre",
          enable: ["key", "seq"],
          set: { c: "0", k: "1", s: "1", "protocol-type": "0x0800", key: "1001", seq: "1" },
          note: "K = 1, S = 1 → thêm Key và Sequence Number; GRE dài 12 byte.",
        },
        { header: "ipv4", label: "Inner IPv4 (gói gốc)", set: { protocol: "253", src: "10.0.1.10", dst: "10.0.2.20", ttl: "63" } },
        payload(),
        fcs(),
      ],
    },
    {
      id: "gretap",
      name: "GRETAP (Ethernet over GRE)",
      category: "Tunnel & Overlay",
      compareTo: "eth2-ipv4",
      summary: "GRE mang nguyên khung Ethernet (Protocol Type 0x6558) để nối L2 qua mạng IP.",
      detail:
        "So với GRE over IPv4, Protocol Type đổi thành 0x6558 (Transparent Ethernet Bridging) và bên trong là cả khung Ethernet " +
        "(MAC + EtherType + IPv4), không chỉ gói IP. " +
        "So với Ethernet II + IPv4, thêm 38 byte: Ethernet ngoài 14 + IPv4 ngoài 20 + GRE 4 (khung Ethernet gốc được mang nguyên vẹn bên trong). " +
        "Hai đầu tunnel hoạt động như hai cổng của một switch: học MAC, chuyển broadcast. " +
        "Khung Ethernet bên trong không có FCS riêng.",
      tree: [
        added(ethII("Outer Ethernet header (underlay)", "0x0800", "MAC của link vật lý underlay.", "0x0800 = IPv4 (IPv4 ngoài).")),
        { added: true, header: "ipv4", label: "Outer IPv4 (tunnel)", set: { protocol: "47", src: "203.0.113.1", dst: "198.51.100.2", ttl: "255" }, note: "Protocol = 47 → GRE." },
        { added: true, header: "gre", set: { c: "0", k: "0", s: "0", "protocol-type": "0x6558" }, note: "0x6558 = Transparent Ethernet Bridging → bên trong là khung Ethernet." },
        {
          group: "Inner Ethernet frame (khách hàng)",
          note: NO_FCS,
          children: [
            { header: "eth-mac", label: "MAC bên trong", note: "MAC của host ở hai site L2 được nối." },
            { header: "ethertype", set: { type: "0x0800" } },
            { header: "ipv4", set: { protocol: "253", src: "192.168.50.10", dst: "192.168.50.20" } },
            payload(),
          ],
        },
        fcs(),
      ],
    },
    {
      id: "vxlan",
      name: "VXLAN (Ethernet over UDP)",
      category: "Tunnel & Overlay",
      compareTo: "eth2-ipv4",
      summary: "VTEP bọc khung Ethernet vào VXLAN/UDP 4789/IPv4; VNI 24 bit định danh segment overlay.",
      detail:
        "So với Ethernet II + IPv4, thêm cả một lớp underlay: Ethernet ngoài + IPv4 ngoài (Protocol 17) + UDP (port đích 4789) + VXLAN 8 byte, " +
        "rồi mới đến khung Ethernet gốc — overhead 50 byte, nên underlay cần MTU ≥ 1550. " +
        "Dùng UDP để tận dụng ECMP: port nguồn là hash của khung bên trong. " +
        "VNI 24 bit thay cho VLAN ID 12 bit, cho ~16 triệu segment trong data center. " +
        "Khung Ethernet bên trong không có FCS riêng, VLAN tag của khách thường bị VTEP bỏ và ánh xạ sang VNI.",
      tree: [
        added(ethII("Outer Ethernet header (underlay)", "0x0800", "MAC giữa VTEP và router/switch underlay kế tiếp.", "0x0800 = IPv4 ngoài.")),
        { added: true, header: "ipv4", label: "Outer IPv4 (tunnel)", set: { protocol: "17", src: "10.255.0.1", dst: "10.255.0.2", ttl: "64" }, note: "Địa chỉ VTEP nguồn/đích; Protocol = 17 → UDP." },
        { added: true, header: "udp", label: "Outer UDP", set: { "src-port": "49152", "dst-port": "4789" }, note: "Port đích 4789 (IANA) → VXLAN; port nguồn là hash của khung trong để chia tải ECMP." },
        { added: true, header: "vxlan", set: { flags: "0x08", vni: "10100" }, note: "Cờ I = 1, VNI 10100 xác định segment L2." },
        {
          group: "Inner Ethernet frame (khách hàng)",
          note: NO_FCS,
          children: [
            { header: "eth-mac", label: "MAC máy ảo/host", note: "MAC gốc của VM/host trong segment overlay." },
            { header: "ethertype", set: { type: "0x0800" } },
            { header: "ipv4", set: { protocol: "253", src: "172.16.10.11", dst: "172.16.10.12" } },
            payload(),
          ],
        },
        fcs(),
      ],
    },

    // ───────────────────────── Truy nhập ─────────────────────────
    {
      id: "pppoe-session",
      name: "PPPoE Session",
      category: "Truy nhập",
      compareTo: "eth2-ipv4",
      summary: "Frame PPPoE giai đoạn session: EtherType 0x8864, header PPPoE 6 byte và PPP Protocol 0x0021 trước gói IPv4.",
      detail:
        "So với Ethernet II + IPv4, EtherType đổi thành 0x8864 và thêm 8 byte: header PPPoE 6 byte (Ver/Type, Code = 0x00, Session ID, Length) " +
        "và trường PPP Protocol 2 byte (0x0021 = IPv4). " +
        "Session ID do BRAS/BNG cấp ở giai đoạn Discovery (EtherType 0x8863) và định danh phiên của thuê bao. " +
        "Do tốn 8 byte, MTU PPPoE thường là 1492 và MSS TCP được kẹp xuống 1452.",
      tree: [
        ethII("Ethernet II header", "0x8864", "MAC của CPE và BRAS/BNG.", "0x8864 = PPPoE Session stage."),
        { added: true, header: "pppoe", set: { code: "0x00", "session-id": "0x0011", length: "86" }, note: "Code 0x00 = dữ liệu session; Session ID do BRAS cấp; Length = PPP Protocol 2 + IPv4 20 + dữ liệu 64 = 86 byte (không tính header PPPoE)." },
        { added: true, header: "ppp-proto", set: { protocol: "0x0021" }, note: "0x0021 = IPv4 (0x0057 = IPv6, 0xC021 = LCP)." },
        { header: "ipv4", set: { protocol: "253", src: "100.64.10.5", dst: "203.0.113.80" } },
        payload(),
        fcs(),
      ],
    }
  );
})();
