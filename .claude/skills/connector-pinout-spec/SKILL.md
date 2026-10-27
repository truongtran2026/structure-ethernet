---
name: connector-pinout-spec
description: "Cách soạn và kiểm tra dữ liệu mảng Đấu nối: thân đầu nối điện (D-sub DE-9/DB-25, M/34 V.35, 8P8C/6P modular, BNC, USB A/B/Mini/Micro/C), sơ đồ chân theo chuẩn (RS-232 TIA-574/TIA-232, EIA/TIA-561, console Cisco, V.35, RS-485, T568A/B, PoE, RJ48C E1, G.703 75 Ω, USB 2.0/3.x/Type-C) và cáp/đầu chuyển thụ động (null-modem, rollover, crossover, loopback, balun, OTG). Dùng khi thêm/sửa/kiểm duyệt data/conn-*.js. Không dùng cho header giao thức (protocol-header-spec), khung truyền dẫn (transport-frame-spec) hay giao diện (header-visualizer-ui)."
---

# Soạn dữ liệu đầu nối và sơ đồ chân

Người học dùng trang này để **hàn thật**. Một chân đánh số sai hoặc một hình vẽ bị lật gương là
người đọc hàn sai cả sợi cáp. Vì vậy hai thứ phải tuyệt đối đúng: số chân ↔ tín hiệu, và hướng nhìn.

## Tài liệu phải đọc
- `references/connector-schema.md` — hợp đồng Body / Pinout / Cable và bất biến.
- `references/connector-catalog.md` — id cố định, phạm vi.

## Quy trình
1. Mỗi Body: lấy hình mặt cắm từ chuẩn (hoặc datasheet nhà sản xuất đầu nối nếu chuẩn không vẽ),
   xác định chân 1 nằm đâu khi nhìn **mặt cắm của giới tính `viewOf`**, ghi `orientation` bằng lời.
   Toạ độ chỉ cần tương đối đúng (hàng, thứ tự, so le D-sub), không cần đúng mm.
2. Mỗi Pinout: liệt kê đủ mọi chân của Body; `dir` nhìn từ thiết bị mang pinout (DTE/DCE/host…).
3. Mỗi Cable: viết `wires` theo số chân, rồi tự kiểm bằng lời: "TXD phía A (out) phải tới RXD phía B (in)".
   Đầu ra nối đầu ra là lỗi. Đất nối đất.
4. Chạy `node .claude/skills/connector-pinout-spec/scripts/validate-connectors.mjs .` tới khi 0 lỗi.
5. Ghi `CẦN KIỂM:` trong `detail` cho điểm chưa chắc (vd. chiều RX/TX của RJ48C theo NT hay CPE)
   để reviewer xác minh — không đoán im lặng.

## Bài học
- "DB9" là tên quen gọi sai: vỏ cỡ E → DE-9. Dùng `aka` cho tên quen gọi.
- DE-9 RS-232 (TIA-574) có chân 2 = RXD, 3 = TXD (ngược với DB-25: 2 = TXD, 3 = RXD).
- Console Cisco RJ45 không phải EIA/TIA-561; cáp rollover đảo 1↔8 … 8↔1. Đánh dấu `vendor: true`.
- RS-485: nhãn A/B giữa các hãng ngược nhau (chuẩn TIA-485: A = −, B = +; nhiều hãng in ngược) — ghi warning.
- USB-C ↔ USB-A: cáp hợp chuẩn phải có Rp 56 kΩ lên VBUS ở phía C; sai trị số làm thiết bị C kéo dòng quá mức.
- Chuyển đổi cần IC (USB↔RS-232, RS-232↔RS-485, mức TTL) không làm Cable; chỉ ghi trong `detail`.
- Hình USB (đã lật gương ở lần đầu, validator không bắt được): receptacle nhìn mặt trước — A (lưỡi nhựa trên) 1→4 trái→phải;
  Mini/Micro-B (cạnh rộng trên) 1→5; Micro-B 3.x 1→10 (khối 2.0 trái, SS phải); B: 2 1 / 3 4; bướu Std-B 3.x 5→9;
  hàng SS Std-A 9…5 trái→phải (chân 5 phía chân 4). Plug là ảnh gương. Luôn render hình chuẩn (PDF) để đối chiếu.
- Bảng chân USB 3.x nằm trong "USB 3.1 Legacy Cable and Connector Spec", không phải USB 3.2 ch.5.
