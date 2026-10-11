# Giao diện mảng Truyền dẫn + điều hướng nhiều mảng

Đọc cùng `SKILL.md`. Dữ liệu theo `.claude/skills/transport-frame-spec/references/transport-schema.md`.
Không hardcode tên khung/đơn vị: mọi thứ đọc từ `TFRAMES`, `TMUX`, `TLABS`.

## 1. Điều hướng (thanh bên trái dạng cây)

```
▾ IP / Ethernet                 ← mọi STACKS, nhóm theo category như cũ
   ▾ Ethernet cơ bản …
▾ Truyền dẫn                    ← TFRAMES, nhóm theo family (PDH/SDH/OTN) rồi category, sắp theo order
   ▾ SDH
      ▾ Khung STM-N  …
▾ Phòng thí nghiệm ghép kênh    ← TLABS
```
- Mảng (domain) và nhóm đều thu gọn/bung được; trạng thái mở/đóng **và mục đang xem** lưu
  `localStorage` (bọc try/catch) để lần sau mở ra đúng như cũ.
- Family/mảng chưa có dữ liệu thì ẩn (vd PDH, OTN ở GD1).
- Ô tìm kiếm lọc toàn bộ cây; khi đang lọc, tự bung các nhóm chứa kết quả (không ghi đè trạng thái đã lưu).
- Định tuyến hash: `#<stackId>` (giữ tương thích), `#t/<frameId>`, `#lab/<labId>`.
- Tách code: `js/nav.js` (cây, tìm kiếm, định tuyến, lưu trạng thái) dùng chung cho mọi mảng.

## 2. Xem khung truyền dẫn (`js/tmodel.js` thuần + `js/transport-view.js`)

- Đầu trang: tên, summary, thẻ số liệu (lưới hàng×cột, byte/khung, chu kỳ, tốc độ, % overhead =
  ô không phải `payload`/`tributary`, đa khung nếu có).
- **Lưới byte**: mỗi ô một byte, tô màu theo `kind` (token CSS riêng, sáng/tối), thước cột/hàng.
  Khung rộng (> ~300 cột): **nén cột** — các cột liên tiếp có cùng vùng ở mọi hàng gộp thành một dải
  "cột a–b (n cột)", có nút bung. STM-1 phải xem được đủ 270 cột (cuộn ngang trong khung riêng).
- **Thu gọn theo cấp**: region thu gọn = một khối mang tên (vd "SOH"), bung → các con (RSOH,
  AU pointer, MSOH) → từng byte. Có nút cấp như mảng IP. Cây region bên dưới lưới, đồng bộ hover/chọn.
- Ghép xen (`rect.step`): tô từng cột của nhánh; hover một nhánh làm sáng mọi cột của nó.
- Panel chi tiết: tên, vị trí (hàng, cột; hoặc dải), số byte, tốc độ của riêng vùng
  (byte × 8 × 1000/periodUs kbps — vd byte D1–D3 = 192 kbit/s), `desc`, `values`, bảng `bitFields`.

## 3. Phòng thí nghiệm ghép kênh (`js/mux-lab.js`)

Mục tiêu: hiểu "ghép từ bé đến lớn" bằng tay.
- Chọn **khung đích** (roots, vd STM-1). Hiển thị cây ô trống theo `accepts`: STM-1 → AUG-1 → AU-4 → VC-4
  → [chọn phương án: C-4 | 3×TUG-3] → TUG-3 → [7×TUG-2 | TU-3] → TUG-2 → 3×TU-12 …
  Mỗi nút có ô (slot) trống để thả.
- **Kéo thả** từ palette (dùng HTML5 drag-and-drop + phương án bấm-chọn cho cảm ứng/bàn phím):
  - Thả đơn vị bậc thấp vào slot bậc cao: tự dựng chuỗi trung gian (thả E1 vào slot TUG-2 → tự tạo
    C-12 → VC-12 → TU-12), hiển thị từng bước và overhead thêm ở mỗi bước.
  - Không hợp lệ → từ chối, giải thích từ dữ liệu (vd "TUG-2 chỉ nhận TU-12; E3 cần C-3 → … → TU-3 → TUG-3").
  - Chọn phương án `accepts` khác nhau cho từng nút (một TUG-3 chứa TU-3, hai TUG-3 chứa TUG-2…).
- Bộ đếm: số nhánh đã dùng / tối đa theo loại (vd "VC-12: 21/63"), nút "Lấp đầy" theo loại.
- Bảng tổng: tốc độ khung đích, tốc độ client thực mang, overhead theo từng cấp (byte/125 µs và
  kbit/s), hiệu suất %. Biểu đồ cột chồng payload vs overhead theo cấp (theo skill dataviz nếu dùng).
- Chế độ "Đóng gói từng bước" (bottom-up): chọn client (E1), bấm "Lên một cấp" thấy C-12 → VC-12 → …,
  mỗi bước nêu overhead thêm (tên + byte) và mở được lưới `frame` của đơn vị đó.
- Trạng thái lab lưu localStorage theo lab; có "Xoá hết".
- Toàn bộ quy tắc lấy từ `TMUX.accepts` — thêm OTN/PDH sau này chỉ thêm dữ liệu.

## 4. Tách file

`index.html` nạp: data IP → `data/transport-*.js` → `js/model.js` (IP) → `js/tmodel.js` →
`js/nav.js` → `js/app.js` (IP view, giữ nguyên hành vi) → `js/transport-view.js` → `js/mux-lab.js` → khởi động.
Mỗi file một IIFE, giao tiếp qua `window.EthViz` / `window.TransViz` / `window.AppNav`.
Hàm thuần (tmodel, logic lab) xuất cả `module.exports` để test bằng Node (file test đuôi `.cjs`).
