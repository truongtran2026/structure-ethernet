# Danh mục mảng Đấu nối (phạm vi v1 — 2026-10-27)

Người dùng chọn: Nối tiếp/console, Viễn thông/mạng, USB. **Không** có Video (HDMI/DP/DVI/VGA — để sau).
Chỉ chuyển đổi thụ động. Id cố định để connector-expert và frontend-dev làm song song.

## Body

| File | id | Tên | outline | Chân |
| --- | --- | --- | --- | --- |
| conn-serial.js | `de9` | D-sub 9 (DE-9, "DB9") | dsub (E) | 9 + S |
| conn-serial.js | `db25` | D-sub 25 (DB-25) | dsub (B) | 25 + S |
| conn-serial.js | `m34` | Winchester M/34 (ISO 2593, V.35) | m34 | 34 (A…NN, bỏ chữ dễ nhầm) |
| conn-serial.js | `term3` | Cầu đấu 3 chân (RS-485 2 dây: A, B, GND) | terminal | 3 |
| conn-telecom.js | `8p8c` | Modular 8P8C ("RJ45") | rj | 8 (+ S nếu bọc giáp) |
| conn-telecom.js | `6p` | Modular 6P ("RJ11/RJ12/RJ25": 6P2C/6P4C/6P6C) | rj | 6 |
| conn-telecom.js | `bnc2` | Cặp BNC 75 Ω (TX + RX, hai đầu BNC rời) | bnc | 4 (TX tâm, TX vỏ, RX tâm, RX vỏ) |
| conn-usb.js | `usb-a` | USB Standard-A (2.0) | usb-a | 4 + S |
| conn-usb.js | `usb-a-ss` | USB 3.x Standard-A (SuperSpeed) | usb-a | 9 + S |
| conn-usb.js | `usb-b` | USB Standard-B (2.0) | usb-b | 4 + S |
| conn-usb.js | `usb-b-ss` | USB 3.x Standard-B | usb-b-ss | 9 + S |
| conn-usb.js | `usb-mini-b` | USB Mini-B | usb-mini-b | 5 + S |
| conn-usb.js | `usb-micro-b` | USB Micro-B | usb-micro-b | 5 + S |
| conn-usb.js | `usb-micro-b-ss` | USB 3.x Micro-B | usb-micro-b-ss | 10 + S |
| conn-usb.js | `usb-c` | USB Type-C (receptacle 24 chân) | usb-c | 24 (A1–A12, B1–B12) + S |

## Pinout

| File | id | body | Chuẩn |
| --- | --- | --- | --- |
| conn-serial.js | `rs232-de9` | de9 | TIA-574; TIA-232-F (DTE) |
| conn-serial.js | `rs232-db25-dte` | db25 | TIA-232-F (DTE) |
| conn-serial.js | `rs232-db25-dce` | db25 | TIA-232-F (DCE, modem) |
| conn-serial.js | `rs232-rj45-cisco` | 8p8c | Cổng console Cisco (vendor); đối xứng giống ý tưởng Yost nhưng khác sơ đồ chân; không phải EIA/TIA-561 |
| conn-serial.js | `rs232-rj45-cisco-adapter` | 8p8c | Ổ RJ45 của đầu chuyển console Cisco (vendor), nhãn theo phía PC/terminal sau cáp rollover (thêm 2026-10-27, kiểm duyệt R3: dùng nhãn cổng console ở đầu chuyển cho ra "8 CTS → 8 CTS" dễ hiểu nhầm là vào→vào) |
| conn-serial.js | `rs232-rj45-tia561` | 8p8c | EIA/TIA-561 |
| conn-serial.js | `v35-m34` | m34 | ITU-T V.35 (tín hiệu), ISO 2593 (đầu nối), DTE |
| conn-serial.js | `rs485-2w` | term3 | TIA-485-A (2 dây, nhầm A/B giữa hãng) |
| conn-telecom.js | `eth-t568b` | 8p8c | TIA-568.2-D (màu T568B); 10/100BASE-TX, 1000BASE-T (variants), PoE Mode A/B (variants, IEEE 802.3af/at/bt) |
| conn-telecom.js | `eth-t568a` | 8p8c | TIA-568.2-D (màu T568A) |
| conn-telecom.js | `eth-gig-cross-b` | 8p8c | Đầu b cáp chéo Gigabit: màu như T568A nhưng cặp xanh dương ↔ nâu đổi chỗ (IEEE 802.3 Cl.40.8) (thêm 2026-10-27, kiểm duyệt R3: đầu b dùng `eth-t568a` thì trang chân dạy bấm sai màu chân 4/5/7/8) |
| conn-telecom.js | `e1-rj48c` | 8p8c | RJ48C (FCC Part 68 / ANSI T1.403) cho E1/T1 120 Ω (G.703) — ghi rõ chiều RX/TX theo NT hay thiết bị |
| conn-telecom.js | `e1-bnc` | bnc2 | ITU-T G.703 §9 (E1 75 Ω không cân bằng, 2 BNC TX/RX) |
| conn-telecom.js | `phone-rj11` | 6p | USOC RJ11/RJ14 (tip/ring line 1, 2) |
| conn-usb.js | `usb2-a` | usb-a | USB 2.0 §6.5.2 Table 6-1 |
| conn-usb.js | `usb3-a` | usb-a-ss | USB 3.1 Legacy Cable and Connector Spec Rev 1.0 §5.3.1.3 Table 5-2 |
| conn-usb.js | `usb2-b` | usb-b | USB 2.0 §6.5.2 Table 6-1 |
| conn-usb.js | `usb3-b` | usb-b-ss | USB 3.1 Legacy Cable and Connector Spec Rev 1.0 §5.3.2.2 Table 5-3 |
| conn-usb.js | `usb2-mini-b` | usb-mini-b | USB 2.0 ECN Mini-B |
| conn-usb.js | `usb2-micro-b` | usb-micro-b | USB Micro-USB Cables and Connectors 1.01 (ID pin, OTG) |
| conn-usb.js | `usb3-micro-b` | usb-micro-b-ss | USB 3.1 Legacy Cable and Connector Spec Rev 1.0 §5.3.3.2 Table 5-4 |
| conn-usb.js | `usb-c-rcpt` | usb-c | USB Type-C Cable and Connector Spec Release 2.0 (Table 3-4, 3-5) |

## Cable

| File | id | kind | a ↔ b |
| --- | --- | --- | --- |
| conn-serial.js | `de9-db25-dte` | adapter | rs232-de9 (F) ↔ rs232-db25-dte (M) — "đầu chuyển 9-25" kiểu AT |
| conn-serial.js | `modem-de9-db25` | cable | rs232-de9 (F) ↔ rs232-db25-dce (M) — cáp PC → modem (thêm 2026-10-27: pinout `rs232-db25-dce` cần ít nhất một cáp dùng tới, và đây là ví dụ DTE↔DCE "thẳng theo tên tín hiệu") |
| conn-serial.js | `null-modem-de9-full` | cable | rs232-de9 F ↔ F, bắt tay đầy đủ |
| conn-serial.js | `null-modem-de9-loopback` | cable | rs232-de9 F ↔ F, 3 dây + cầu nối bắt tay giả |
| conn-serial.js | `straight-de9` | cable | rs232-de9 M ↔ F (cáp nối dài, 1–1) |
| conn-serial.js | `loopback-de9` | loopback | rs232-de9 F (test cổng COM) |
| conn-serial.js | `cisco-rollover` | cable | rs232-rj45-cisco ↔ rs232-rj45-cisco (1↔8, …) |
| conn-serial.js | `cisco-console-de9` | adapter | rs232-rj45-cisco-adapter (jack) ↔ rs232-de9 (F) — đầu chuyển console RJ45-DB9 |
| conn-serial.js | `cisco-console-db25-dte` | adapter | rs232-rj45-cisco-adapter (jack) ↔ rs232-db25-dte (F, nối terminal/PC) |
| conn-telecom.js | `eth-straight` | cable | eth-t568b ↔ eth-t568b |
| conn-telecom.js | `eth-crossover-100` | cable | eth-t568b ↔ eth-t568a (10/100) |
| conn-telecom.js | `eth-crossover-1000` | cable | eth-t568b ↔ eth-gig-cross-b — đảo cả 4 cặp (1000BASE-T, nay ít cần nhờ Auto-MDI-X) |
| conn-telecom.js | `e1-rj48c-cross` | cable | e1-rj48c ↔ e1-rj48c (1↔4, 2↔5) |
| conn-telecom.js | `e1-rj48c-loopback` | loopback | e1-rj48c (1↔4, 2↔5 cùng đầu) |
| conn-telecom.js | `e1-bnc-loopback` | loopback | e1-bnc: TX tâm → RX tâm (thường bằng 1 đoạn coax + đầu nối BNC thẳng) |
| conn-telecom.js | `e1-balun` | balun | e1-rj48c ↔ e1-bnc (biến áp 120 Ω ↔ 75 Ω) |
| conn-usb.js | `usb-a-b` | cable | usb2-a ↔ usb2-b |
| conn-usb.js | `usb-a-micro-b` | cable | usb2-a ↔ usb2-micro-b (ID hở) |
| conn-usb.js | `usb-otg-micro` | adapter | usb2-micro-b (ID → GND) ↔ usb2-a (F) — đầu OTG |
| conn-usb.js | `usb3-a-b` | cable | usb3-a ↔ usb3-b |
| conn-usb.js | `usb-c-a` | cable | usb-c-rcpt ↔ usb2-a (điện trở Rp 56 kΩ lên VBUS) |
| conn-usb.js | `usb-c-micro-b` | cable | usb-c-rcpt ↔ usb2-micro-b (Rd 5,1 kΩ) |
| conn-usb.js | `usb-c-c-2` | cable | usb-c ↔ usb-c (USB 2.0, CC nối CC) |

Nếu chuẩn không cho phép một mục (vd. cáp USB-A ↔ USB-A nối VBUS/D±; USB 3.x chỉ có cáp A–A gỡ lỗi, Legacy §5.5.2 Table 5-9), không tạo; ghi vào `warnings` của mục gần nhất.
