# Bảng thuật ngữ giao diện (GD13)

Mọi chữ hiển thị trong `js/` và `index.html` theo bảng này. Thêm chữ mới: tra bảng trước, không tự đặt từ khác.

| Khái niệm | Dùng trong UI | Không dùng |
| --- | --- | --- |
| Tributary slot của OTN (ODTU/OPU) | Lần đầu trên một trang: **TS (khe nhánh)**; các lần sau: **TS** | "tributary slot", "khe thời gian", "time slot" |
| Khe của lịch FlexE (5G/25G) | **khe lịch** | "TS", "calendar slot", "khe thời gian" |
| Khe thời gian 64 kbit/s của PDH (E1 TS0…TS31) | **khe thời gian** (chỉ trong PDH) | dùng cho SDH/OTN |
| Overhead | Lần đầu: **overhead (OH)**; sau đó **OH**; tên mục/tiêu đề thẻ: "Overhead" viết hoa chữ đầu | "tiêu đề" cho OH truyền dẫn (chữ "tiêu đề" chỉ dùng cho tiêu đề trang/thẻ; header gói IP vẫn là "header") |
| Tín hiệu/tải được ánh xạ vào khung | **client** (vd "tải client", "tín hiệu client") | "khách hàng" trong mảng Truyền dẫn |
| Khách hàng của nhà mạng (QinQ, L2VPN, S-Tag/C-Tag) | **khách hàng** (nghĩa customer) | "client" trong mảng IP |
| Mã bộ câu của Ôn tập | **mã bộ câu** | "Seed" |
| Nút quay lại của trình duyệt | **nút Quay lại của trình duyệt** | "nút Back" |
| Trường của header | **trường** | "field" |
| Padding/Idle/FIFO/GFP/JC/NJO/PJO/PSI/RES | giữ nguyên tên chuẩn (viết hoa như chuẩn) | dịch nghĩa |

Quy ước khác
- Số: dấu cách ngăn nhóm nghìn (`15 232`), dấu phẩy thập phân (`0,295`).
- Đơn vị: `kbit/s`, `Gbit/s`, `µs`, `ppm`.
- Thuật ngữ chuẩn không có từ tiếng Việt quen dùng (Idle, FIFO, sync header, scrambler…) giữ nguyên tiếng Anh, không in nghiêng.
- Không để chữ UI tiếng Anh thường (Back, Next, Reset, Seed…). Kiểm bằng `_workspace/L3_frontend-dev_chrome.cjs`.
- Dữ liệu `data/*.js` do agent dữ liệu giữ: "khách hàng" ở đó mang nghĩa customer (QinQ, VPN), không phải client truyền dẫn.

Truy cập được (a11y) đi kèm
- Chữ cần tương phản ≥ 4,5:1, thành phần UI ≥ 3:1 ở cả sáng và tối. Nút bật (`.is-on`) dùng `color: var(--on-accent)` (trắng ở sáng, #0b1020 ở tối) trên nền `--accent`.
- Chữ màu nhấn trong mô phỏng (`.sim-k-*`) trộn màu nhấn với `--text` để đạt tương phản trên cả hai nền.
- Vùng bấm ≥ 24 px (liên kết trong khối chữ dùng `display:inline-block; min-height:24px`).
- `.sr-only` dùng clip chuẩn; phần tử chứa nó (`label`, `button`) được đặt `position: relative` (selector `:has(> .sr-only)`) để không làm nở vùng cuộn.
