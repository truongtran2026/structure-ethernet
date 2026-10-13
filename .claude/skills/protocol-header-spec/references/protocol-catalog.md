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
| headers-tunnel.js | `esp` | ESP header: SPI(32) + Sequence(32) + IV (varBytes 0–16, theo thuật toán) | 8 | 24 | RFC 4303, RFC 4106 (GCM), RFC 3602 (CBC) |
| headers-tunnel.js | `esp-trailer` | ESP trailer: Padding (varBytes 0–255) + Pad Length(8) + Next Header(8) | 2 | 257 | RFC 4303 §2.4–2.6 |
| headers-tunnel.js | `esp-icv` | Integrity Check Value (varBytes, theo thuật toán) | 0 | 32 | RFC 4303 §2.8, RFC 2404, RFC 4868 |
| headers-gfp.js | `gfp-core` | GFP Core header: PLI 16 + cHEC 16 | 4 | | ITU-T G.7041 §6.1.1 |
| headers-gfp.js | `gfp-payload-hdr` | GFP Payload type header: PTI 3, PFI 1, EXI 4, UPI 8, tHEC 16 | 4 | | G.7041 §6.1.2.1 |
| headers-gfp.js | `gfp-ext-linear` | GFP Linear extension header: CID 8, Spare 8, eHEC 16 | 4 | | G.7041 §6.1.2.1.3.2 |
| headers-gfp.js | `gfp-pfcs` | GFP payload FCS (CRC-32, khi PFI = 1) | 4 | | G.7041 §6.1.2.2.1 |
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
| MPLS & VPN | `mpls-l2vpn` | Ethernet{…0x8847} · Label stack{transport, PW label S=1} · pw-cw · Inner Ethernet{eth-mac, vlan-8021q, ethertype, ipv4, payload} · fcs. Gộp VPWS + VPLS (cùng khuôn dạng trên dây; khác control plane ghi trong `detail`) |
| Tunnel & Overlay | `gre-ipv4` | Ethernet · Outer IPv4(proto=47) · gre(proto=0x0800) · Inner IPv4 · payload · fcs |
| (đã bỏ) | `gre-key-seq` | Trùng với biến thể "Key + Sequence" của `gre` trong `gre-ipv4` — không tạo stack riêng cho biến thể của một header |
| Tunnel & Overlay | `gre-ipsec-transport` | Ethernet · IPv4(proto=50) · group "ESP – vùng xác thực"{esp, group "Vùng mã hoá"{gre, Inner IPv4, payload, esp-trailer(NH=47)}} · esp-icv · fcs. compareTo `gre-ipv4`. Mặc định AES-GCM-128: IV 8, ICV 16, căn 4 byte |
| Tunnel & Overlay | `gre-ipsec-tunnel` | Ethernet · New IPv4(proto=50) · group "ESP – vùng xác thực"{esp, group "Vùng mã hoá"{GRE-IPv4(proto=47), gre, Inner IPv4, payload, esp-trailer(NH=4)}} · esp-icv · fcs. compareTo `gre-ipv4` |
| Tunnel & Overlay | `gretap` | Ethernet · Outer IPv4 · gre(proto=0x6558) · Inner Ethernet{eth-mac, ethertype, ipv4, payload} · fcs |
| Tunnel & Overlay | `vxlan` | Ethernet · Outer IPv4(17) · UDP(dport 4789) · vxlan · Inner Ethernet{…} · fcs |
| Ethernet qua truyền dẫn | `gfp-f-eth` | gfp-core · gfp-payload-hdr(PTI 000, PFI 1, EXI 0000, UPI 0x01) · Ethernet MAC frame{eth-mac, ethertype, ipv4, payload, eth-fcs} (không preamble/SFD/IFG) · gfp-pfcs. compareTo `eth2-ipv4` (preamble bị bỏ; GFP được thêm). Role: GFP = encap, khung MAC = passenger. detail nêu: cHEC dùng tìm khung (không có cờ như HDLC), scrambler x⁴³+1 trên vùng tải, idle frame (PLI = 0), PFI = 0 thì không có pFCS |
| Ethernet qua truyền dẫn | `gfp-f-eth-cid` | như `gfp-f-eth` nhưng EXI 0001 + gfp-ext-linear (CID) — nhiều luồng khách chung một VCG. compareTo `gfp-f-eth` |
| Truy nhập | `pppoe-session` | Ethernet{eth-mac, ethertype=0x8864} · pppoe · ppp-proto(0x0021) · ipv4 · payload · fcs |

Mọi stack có `compareTo: "eth2-ipv4"` (trừ chính nó và hai stack GRE over IPsec so với `gre-ipv4`) để UI tô đậm header được thêm.
Inner Ethernet trong L2VPN/VXLAN/GRETAP **không có FCS riêng** — ghi rõ trong `note`.

## Giới hạn kích thước (data/eth-limits.js → `window.ETH_LIMITS`, GD10)

Không phải header/stack — dữ liệu cho Máy tính (#calc). Mọi mục dạng `{ value, unit, standard, note }`.
- `frame`: minFrame 64, minClientData 46, maxBasic 1518, maxQTagged 1522, maxQinQ 1526, maxEnvelope 2000 (802.3as),
  envelopeEncapMax 482, preambleSfd 8, ifg 12, jumboMtu 9000 / jumboFrame 9216 (phi chuẩn, tuỳ hãng).
- `zones[]` `{ id, from, to, label, standard, note }`: runt / standard / envelope / jumbo — để tô vùng thanh L.
- `ipv4` (totalLengthMax, minMtu 68, minReassembly 576, fragOffsetUnit 8, fragOffsetMax, dfBit), `ipv6` (minMtu 1280,
  minReassembly 1500, payloadLengthMax, fragmentation), `tcp` (MSS mặc định 536/1220, overhead 40/60, clamping), `pmtud`.
- `mtuHints[]` `{ id, stack, value, unit, standard, note }`: chỉ ràng buộc chuẩn không suy được từ overhead STACKS (PPPoE 1492 RFC 2516, 1500 RFC 4638).
- `scenarios.rateLimit` `{ title, summary, items{…} }`: srTCM/trTCM, MEF bandwidth profile, policer vs shaper, CBS ≈ CIR × RTT (thực hành), C-4.
Validator header/stack không kiểm file này; chỉ cần `node --check`.
