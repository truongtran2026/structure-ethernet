# Danh mục header và stack (phạm vi phiên bản 1)

Id ở đây là cố định để protocol-expert và frontend-dev làm song song mà không lệch nhau.
Thêm giao thức mới: thêm dòng vào bảng trước, rồi mới viết dữ liệu.

## Header

| File | id | Tên | fixedBytes | maxBytes | Chuẩn |
| --- | --- | --- | --- | --- | --- |
| headers-l2.js | `phy-preamble` | Preamble + SFD | 8 | | IEEE 802.3 §3.2.1–3.2.2 |
| headers-l2.js | `eth-mac` | Destination + Source MAC | 12 | | IEEE 802.3 §3.2.3, IEEE 802 |
| headers-l2.js | `ethertype` | EtherType | 2 | | IEEE 802.3 §3.2.6, IANA |
| headers-l2.js | `eth-length` | Length (802.3) | 2 | | IEEE 802.3 §3.2.6 |
| headers-l2.js | `llc` | IEEE 802.2 LLC | 3 | | IEEE 802.2 |
| headers-l2.js | `snap` | SNAP | 5 | | IEEE 802 §10.3 |
| headers-l2.js | `vlan-8021q` | 802.1Q C-Tag | 4 | | IEEE 802.1Q §9.6 |
| headers-l2.js | `vlan-8021ad` | 802.1ad S-Tag | 4 | | IEEE 802.1Q (802.1ad) |
| headers-l2.js | `pbb-itag` | 802.1ah I-Tag (I-PCP 3, I-DEI 1, UCA 1, Res1 1, Res2 2, I-SID 24) | 6 | | IEEE 802.1Q (802.1ah) |
| headers-l2.js | `pppoe` | PPPoE Session header | 6 | | RFC 2516 |
| headers-l2.js | `ppp-proto` | PPP Protocol field | 2 | | RFC 1661 |
| headers-l2.js | `eth-fcs` | Frame Check Sequence | 4 | | IEEE 802.3 §3.2.9 |
| headers-tunnel.js | `mpls-label` | MPLS Label Stack Entry | 4 | | RFC 3032 |
| headers-tunnel.js | `pw-cw` | Pseudowire Control Word | 4 | | RFC 4385, RFC 4448 |
| headers-tunnel.js | `gre` | GRE | 4 | 16 | RFC 2784, RFC 2890 |
| headers-tunnel.js | `vxlan` | VXLAN | 8 | | RFC 7348 |
| headers-l3l4.js | `ipv4` | IPv4 | 20 | 60 | RFC 791 |
| headers-l3l4.js | `ipv6` | IPv6 | 40 | | RFC 8200 |
| headers-l3l4.js | `tcp` | TCP | 20 | 60 | RFC 9293 |
| headers-l3l4.js | `udp` | UDP | 8 | | RFC 768 |
| headers-l3l4.js | `payload` | Payload / Data | 0 (varBytes) | | — |

Ghi chú: `payload` chỉ có một field `data` dạng `varBytes`. IPv4/TCP options là field `options`
dạng `varBytes` (min 0, max 40). GRE optional: group `checksum-group` (Checksum 16 + Reserved1 16,
`optional: "C = 1"`), field `key` (32, `optional: "K = 1"`), field `seq` (32, `optional: "S = 1"`).

## Stack (data/stacks.js)

| Danh mục | id | Cấu trúc (từ ngoài vào trong) |
| --- | --- | --- |
| Ethernet cơ bản | `eth2-ipv4` | [wire: preamble] · Ethernet II header{eth-mac, ethertype=0x0800} · ipv4 · payload · fcs |
| Ethernet cơ bản | `eth2-ipv6` | Ethernet II{eth-mac, ethertype=0x86DD} · ipv6 · payload · fcs |
| Ethernet cơ bản | `eth2-ipv4-tcp` | Ethernet II · ipv4(proto=6) · tcp · payload · fcs |
| Ethernet cơ bản | `eth2-ipv4-udp` | Ethernet II · ipv4(proto=17) · udp · payload · fcs |
| Ethernet cơ bản | `ieee8023-llc` | 802.3 header{eth-mac, eth-length} · llc · payload · fcs |
| Ethernet cơ bản | `ieee8023-snap` | 802.3 header{eth-mac, eth-length} · llc(AA/AA/03) · snap · payload · fcs |
| VLAN | `dot1q` | Ethernet{eth-mac, vlan-8021q, ethertype} · ipv4 · payload · fcs |
| VLAN | `qinq` | Ethernet{eth-mac, vlan-8021ad (S-Tag), vlan-8021q (C-Tag), ethertype} · ipv4 · payload · fcs |
| VLAN | `pbb` | Backbone{eth-mac (B-DA/B-SA), vlan-8021ad (B-Tag), pbb-itag} · Customer frame{eth-mac, vlan-8021ad?, vlan-8021q, ethertype, ipv4, payload} · fcs |
| MPLS & VPN | `mpls-ipv4` | Ethernet{eth-mac, ethertype=0x8847} · mpls-label(S=1) · ipv4 · payload · fcs |
| MPLS & VPN | `mpls-l3vpn` | Ethernet{…0x8847} · Label stack{transport label S=0, VPN label S=1} · ipv4 · payload · fcs |
| MPLS & VPN | `mpls-l2vpn-vpws` | Ethernet{…0x8847} · Label stack{transport, PW label S=1} · pw-cw · Inner Ethernet{eth-mac, vlan-8021q, ethertype, ipv4, payload} · fcs |
| MPLS & VPN | `mpls-vpls` | Như VPWS; nhấn mạnh học MAC, PW mesh, split horizon trong `detail` |
| Tunnel & Overlay | `gre-ipv4` | Ethernet · Outer IPv4(proto=47) · gre(proto=0x0800) · Inner IPv4 · payload · fcs |
| Tunnel & Overlay | `gre-key-seq` | Như trên, `enable: ["key","seq"]` |
| Tunnel & Overlay | `gretap` | Ethernet · Outer IPv4 · gre(proto=0x6558) · Inner Ethernet{eth-mac, ethertype, ipv4, payload} · fcs |
| Tunnel & Overlay | `vxlan` | Ethernet · Outer IPv4(17) · UDP(dport 4789) · vxlan · Inner Ethernet{…} · fcs |
| Truy nhập | `pppoe-session` | Ethernet{eth-mac, ethertype=0x8864} · pppoe · ppp-proto(0x0021) · ipv4 · payload · fcs |

Mọi stack có `compareTo: "eth2-ipv4"` (trừ chính nó) để UI tô đậm header được thêm.
Inner Ethernet trong L2VPN/VXLAN/GRETAP **không có FCS riêng** — ghi rõ trong `note`.
