# Danh mục mảng Đấu nối (phạm vi v1 — 2026-10-27)

Người dùng chọn: Nối tiếp/console, Viễn thông/mạng, USB (v1). **v2 (2026-10-27):** thêm Video (VGA/DVI/HDMI/DP) — file `data/conn-video.js`.
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

## v2 — Video (data/conn-video.js, family `video`)

Chỉ chuyển đổi thụ động **bằng dây** (cùng loại tín hiệu: TMDS↔TMDS, analog↔analog). Đầu chuyển có IC
(DP → HDMI dù quảng cáo "passive" — có bộ dịch mức/ID buffer DP++ type 1/2; HDMI → VGA; DP → VGA; USB-C Alt Mode → HDMI)
không có mục Cable, chỉ ghi trong `detail` (nói rõ IC gì và vì sao).

| Loại | id | Ghi chú |
| --- | --- | --- |
| Body | `de15` | D-sub 15 chân mật độ cao (DE-15 / "HD15", VGA), outline dsub 3 hàng 5/5/5, vỏ E |
| Body | `dvi` | DVI (24 chân số 3×8 + C1–C5 analog quanh lưỡi dẹt), outline dvi; DVI-D/DVI-A là biến thể chân có/không |
| Body | `hdmi-a` | HDMI Type A 19 chân (hàng trên lẻ 1…19, hàng dưới chẵn 2…18) |
| Body | `hdmi-c` | HDMI Type C (Mini) 19 chân — gán chân KHÁC Type A |
| Body | `hdmi-d` | HDMI Type D (Micro) 19 chân — gán chân KHÁC A và C |
| Body | `dp` | DisplayPort 20 chân (vỏ một góc vát) |
| Body | `mini-dp` | Mini DisplayPort 20 chân |
| Pinout | `vga-de15` | VESA DDC/EDID; VGA (R/G/B 75 Ω, HSync/VSync, DDC SDA/SCL, +5 V) — phía nguồn (card đồ hoạ) |
| Pinout | `vga-de15-sink` | VGA phía nhận (màn hình): dir theo cột Display của E-DDC 1.2 Bảng 7-1 (RGB/sync/SCL vào, chân 4/11 Reserved – không nối). Lý do thêm: đầu b của `vga-cable` không được dùng lại pinout source (sẽ thành out→out) |
| Pinout | `dvi-i` | DDWG DVI 1.0: TMDS 2 link + DDC + Hot Plug + analog C1–C5; variants dvi-d-single, dvi-d-dual, dvi-a |
| Pinout | `hdmi-a-pin` | HDMI 1.4/2.x Type A (TMDS D0–D2, clock, CEC, DDC, +5 V, HPD, Utility/HEAC) |
| Pinout | `hdmi-c-pin` | HDMI Type C |
| Pinout | `hdmi-d-pin` | HDMI Type D |
| Pinout | `dp-source` | VESA DisplayPort 1.x, receptacle phía nguồn (ML_Lane0–3, AUX, HPD, CONFIG1/2, DP_PWR) |
| Pinout | `dp-sink` | Receptacle phía nhận (thứ tự lane đảo — CẦN KIỂM theo VESA) |
| Pinout | `mini-dp-source` | Mini DP phía nguồn |
| Cable | `vga-cable` | vga-de15 M ↔ M (1–1; ID pins tuỳ) |
| Cable | `dvi-hdmi` | dvi-i (D) ↔ hdmi-a-pin: thụ động, chỉ TMDS single-link + DDC + HPD; không âm thanh nếu nguồn không gửi |
| Cable | `dvi-i-vga` | dvi-i (chỉ C1–C5 + DDC + sync) ↔ vga-de15: thụ động khi card xuất analog trên DVI-I/DVI-A |
| Cable | `hdmi-a-c` | hdmi-a-pin ↔ hdmi-c-pin (cáp Mini HDMI) |
| Cable | `hdmi-a-d` | hdmi-a-pin ↔ hdmi-d-pin (cáp Micro HDMI) |
| Cable | `dp-dp` | dp-source ↔ dp-sink (DP_PWR không nối xuyên; lane theo VESA) |
| Cable | `mini-dp-dp` | mini-dp-source ↔ dp-sink |

## v3 — Nút loopback cho mọi cổng (2026-10-28)

Mọi Pinout có ≥ 1 loopback hoặc `noLoop` (validator bắt). Loopback = 1 đầu, TX của cổng quay về RX của chính nó
(+ bắt tay giả nếu có). Ghi `loopFor` (tốc độ/chế độ) và `test` (cách thử: phần mềm/lệnh, kết quả mong đợi, cảnh báo
như loop-detect/err-disable trên switch, PoE).

| File | id | a (pinout) | Nối |
| --- | --- | --- | --- |
| conn-telecom.js | `eth-loop-100` | eth-t568b | 1↔3, 2↔6 (10BASE-T/100BASE-TX) |
| conn-telecom.js | `eth-loop-1000` | eth-t568b | 1↔3, 2↔6, 4↔7, 5↔8 (1000BASE-T; cũng dùng 2.5G/5G/10GBASE-T — CẦN KIỂM link thật có lên ở 1G) |
| conn-telecom.js | (đã có) `e1-rj48c-loopback`, `e1-bnc-loopback` | | E1/T1 |
| conn-telecom.js | `phone-rj11` | noLoop | thoại analog: không có TX/RX tách — dùng máy test/butt set |
| conn-telecom.js | `eth-t568a`, `eth-gig-cross-b` | noLoop | trỏ sang eth-loop-100 / eth-loop-1000 (nút nối theo số chân, không theo màu) |
| conn-serial.js | (đã có) `loopback-de9` | rs232-de9 | |
| conn-serial.js | `loopback-db25-dte` | rs232-db25-dte | 2↔3, 4↔5, 6↔8↔20 (+22 tuỳ chọn) |
| conn-serial.js | `loopback-db25-dce` | rs232-db25-dce | 3→2, 5→4, 6→20 (đã chỉnh 2026-10-27: KHÔNG cầu 6-8-20-22 như DTE vì ở DCE DSR/DCD/RI đều là đầu ra — cầu chúng là chập ra–ra; DCD/RI để trống) |
| conn-serial.js | `loopback-rj45-cisco` | rs232-rj45-cisco | 3↔6, 1↔8, 2↔7 |
| conn-serial.js | `loopback-rj45-tia561` | rs232-rj45-tia561 | TXD↔RXD, RTS↔CTS, DTR↔DSR/DCD |
| conn-serial.js | `loopback-v35` | v35-m34 | P→R, S→T, C→D, H→E+F, U→V+Y, W→X+AA (CẦN KIỂM: cổng DTE có tự phát SCTE khi không có DCE) |
| conn-serial.js | `rs485-2w` | noLoop | 2 dây bán song công: TX và RX chung cặp — không loop thụ động; dùng 2 cổng hoặc 4 dây |
| conn-serial.js | `loopback-rj45-cisco-adapter` | rs232-rj45-cisco-adapter | 3↔6, 1↔8, 2↔7 (cùng nút vật lý với loopback-rj45-cisco; thêm làm loop riêng vì cắm vào ổ đầu chuyển là cách thử cổng COM + đầu chuyển hữu ích nhất) |
| conn-usb.js | mọi pinout USB | noLoop | USB host–device có giao thức: không có nút loop thụ động; kiểm bằng thiết bị thật/tester; (USB 3.x loopback là chế độ giao thức khi compliance test) |
| conn-video.js | mọi pinout video | noLoop | đường hình một chiều nguồn → nhận: không loop; kiểm bằng màn hình/EDID emulator; DDC/HPD tuỳ |
