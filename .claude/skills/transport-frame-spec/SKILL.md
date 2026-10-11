---
name: transport-frame-spec
description: "Cách soạn và kiểm tra dữ liệu khung truyền dẫn PDH/SDH/OTN (lưới byte 2 chiều, overhead từng byte, con trỏ, POH) và cây ghép kênh (C-12 → VC-12 → TU-12 → TUG-2 → TUG-3 → VC-4 → AU-4 → AUG → STM-N; ODUk/ODUflex vào tributary slot) cho ứng dụng học cấu trúc khung. Dùng khi thêm/sửa/kiểm duyệt data/transport-*.js, thêm cấp tốc độ, đơn vị ghép hoặc lab ghép kênh. Không dùng cho header Ethernet/IP/MPLS (dùng protocol-header-spec) hay sửa giao diện (dùng header-visualizer-ui)."
---

# Soạn dữ liệu khung truyền dẫn

Dữ liệu truyền dẫn có thể **kiểm bằng số học**: mọi khung phủ kín lưới, mọi bước ghép cộng đúng
số byte. Người học dựa vào các con số này để hiểu vì sao STM-1 chứa đúng 63 E1, nên một byte lệch
là một khái niệm sai. Luôn để validator chứng minh, không tin trí nhớ.

## Tài liệu phải đọc

- `references/transport-schema.md` — hợp đồng dữ liệu (Frame, Region, Unit, Lab) và bất biến.
- `references/transport-catalog.md` — id cố định, kích thước, phạm vi từng giai đoạn.

## Quy trình

1. Đọc catalog phần giai đoạn được giao.
2. Với mỗi frame: vẽ trên giấy lưới hàng × cột theo hình chuẩn ITU-T (G.707 cho SDH, G.709 cho OTN,
   G.704/G.742/G.751 cho PDH), rồi chia region từ lớn đến nhỏ: khu vực → nhóm byte → từng byte.
   Ghép xen byte (TUG-3 trong VC-4, TU-12 trong TUG-2) dùng `rect.step`.
3. Với byte có cấu trúc bit đáng học (K1, K2, S1, H1/H2, V5, G1, C2…) thêm `bitFields`.
4. Với mỗi unit: ghi `accepts` để bước ghép tự cộng đúng byte; overhead ghi rõ tên + byte.
5. Dùng hàm sinh trong file JS cho các cấp lặp lại (STM-4…256, AUG-4…256) thay vì chép tay.
6. Chạy validator tới khi `OK`:
   ```
   node .claude/skills/transport-frame-spec/scripts/validate-transport.mjs .
   ```

## Nguyên tắc nội dung

- Thuật ngữ chuẩn giữ tiếng Anh (RSOH, MSOH, POH, NDF…), giải thích tiếng Việt, câu đầu là chức năng.
- Phân biệt rõ cái **cố định** (SOH ở cột 1–9) và cái **trôi theo con trỏ** (VC-4 trong AU-4): lưới
  vẽ VC ở vị trí cố định dễ học (VC-4 căn hàng 1 cột 10 ⇔ con trỏ AU-4 = 522; TU-12 ở con trỏ 0), `desc` phải nói rõ giá trị con trỏ tương ứng và thực tế VC trôi.
- Đa khung (VC-12 500 µs, OTN MFAS 256) mô tả trong `multiframe` và `desc`, không vẽ 4 lưới.
- Byte trống/dự trữ vẫn phải là region (kind `reserved`) để lưới phủ kín — ghi đúng ký hiệu chuẩn
  (X quốc gia, Δ phụ thuộc môi trường, * không xáo trộn).

## Lỗi hay gặp

- STM-1 SOH: RSOH hàng 1–3, AU pointer hàng 4, MSOH hàng 5–9, đều cột 1–9; A1 = 0xF6, A2 = 0x28.
- AU-4 pointer: H1 Y Y H2 1* 1* H3 H3 H3 (Y = 1001SS11, 1* = 0xFF). H1H2: NDF 4 bit, SS 2 bit, 10 bit giá trị (0–782, bit I/D xen kẽ).
- VC-4 POH: J1, B3, C2, G1, F2, H4, F3, K3, N1 (từ trên xuống).
- VC-12 POH theo đa khung: V5, J2, N2, K4; con trỏ TU-12: V1, V2, V3, V4.
- TUG-3 từ 7×TUG-2: 2 cột đầu (18 byte) đều là fixed stuff — NPI đã bị bỏ khỏi G.707 hiện hành (chỉ nhắc như lịch sử). VC-4 từ 3×TUG-3: POH + 2 cột fixed stuff.
- STM-N không phải lúc nào cũng 3N A1/A2: STM-256 chỉ có 64 A1 + 64 A2 (§9.2.2.1). STM-64/256 dùng M0 + M1 cho MS-REI. J0: 1 hoặc 16 byte (64 byte chỉ J1).
- AUG-N ghép xen theo khối N byte, không phải từng byte. Ghi số mục G.707 theo bản 01/2007 (vd khung cơ bản §6.2, SOH §9.2, TUG-3 §7.2.3).
- Một VC-4 chứa 63 VC-12 = 3 TUG-3 × 7 TUG-2 × 3 TU-12.
- Tốc độ: STM-1 155,52 Mbit/s; STM-N = N × 155,52.

## Khi được gọi lại

Đọc file hiện có, chỉ sửa phần được yêu cầu hoặc phần reviewer báo; chạy lại validator; báo id thay đổi.
