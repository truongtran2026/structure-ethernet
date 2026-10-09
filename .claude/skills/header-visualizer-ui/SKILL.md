---
name: header-visualizer-ui
description: "Cách xây và sửa giao diện web trực quan hoá cấu trúc header Ethernet/giao thức mạng: cây thu gọn/bung theo cấp (stack → nhóm → header → nhóm field → field), sơ đồ bit 32-bit kiểu RFC, thanh frame map theo byte, panel chi tiết field, bật/tắt field optional. Dùng khi tạo/sửa index.html, css/, js/app.js hoặc khi người dùng muốn đổi cách hiển thị, thêm tính năng xem. Không dùng để sửa nội dung giao thức (dùng protocol-header-spec)."
---

# Giao diện trực quan hoá header

Mục tiêu sư phạm: người học **nhìn tổng thể trước, bung chi tiết sau**. Mọi quyết định giao diện phục vụ
việc trả lời 3 câu hỏi: "frame này gồm những header nào?", "mỗi header bao nhiêu byte, nằm ở đâu?",
"bit này dùng làm gì?".

## Ràng buộc kỹ thuật

- HTML/CSS/JS thuần, **không build, không CDN, không fetch** — mở `index.html` bằng nhấp đúp (`file://`).
  Vì vậy dùng `<script>` thường, không `type="module"`.
- Đọc dữ liệu từ `window.HEADERS` và `window.STACKS` đúng theo
  `.claude/skills/protocol-header-spec/references/data-schema.md`. Không hardcode tên giao thức trong `app.js`
  — thêm giao thức mới chỉ cần thêm dữ liệu.
- Cấu trúc file: `index.html`, `css/style.css`, `js/app.js` (có thể tách `js/model.js` cho phần tính toán).
- Giao diện tiếng Việt; tên field giữ tiếng Anh như dữ liệu.

## Mô hình tính toán (tách khỏi phần vẽ)

Viết hàm thuần `buildModel(stack, state)` trả về cây đã tính sẵn:
- mỗi node có `bits`, `bytes`, `offsetBit` tuyệt đối trong frame, `offsetInHeader`;
- field optional chỉ tính khi được bật (`state.enabled[headerPath][fieldId]`, mặc định từ `enable` của StackNode);
- `varBytes` dùng độ dài từ StackNode.varBytes → `default` → `min`;
- StackNode `wire: true` hiển thị nhưng không tính vào offset/kích thước frame;
- tổng: kích thước frame, tổng overhead (mọi thứ trừ payload), số header.
Phần vẽ chỉ đọc model này. Tách như vậy để QA kiểm tra số liệu bằng Node mà không cần trình duyệt
(xuất `buildModel` ra `window.EthViz` và cả `module.exports` khi chạy trong Node).

## Bố cục

1. **Sidebar**: danh sách stack nhóm theo `category`, ô tìm kiếm (lọc theo tên/summary/tên header).
2. **Đầu trang stack**: tên, summary, các con số (frame bytes, overhead bytes, %), nút điều khiển cấp:
   "Thu gọn tất cả", "Cấp header", "Cấp nhóm field", "Bung tất cả".
3. **Frame map**: thanh ngang chia đoạn theo byte của từng header (độ rộng tỉ lệ, có min-width để header
   2 byte vẫn đọc được), màu theo `layer`, nhãn `short` + số byte. Header được THÊM so với `compareTo`
   có viền/nhãn "+ thêm". Click đoạn → cuộn tới và bung header đó.
4. **Cây cấu trúc**: mỗi node một dòng: caret ▸/▾, tên (+ `label` ngữ cảnh), kích thước "N byte (M bit)",
   khoảng offset "byte a–b". Bung header → hiện:
   - **Sơ đồ bit** kiểu RFC: thước bit 0..31 phía trên, mỗi hàng 32 bit, ô field rộng theo số bit,
     field dài hơn phần còn lại của hàng thì xuống hàng tiếp (ghi "(tiếp)"); field `varBytes` vẽ một dải
     "… N byte" riêng. Ô hiện `abbr`/`name` và giá trị `set` nếu có. Khi một group bị thu gọn, các field
     con gộp thành MỘT ô mang tên group — đây là điểm cốt lõi người dùng yêu cầu.
   - Danh sách node con (group/field) có thể thu gọn tiếp.
5. **Panel chi tiết** (phải trên desktop, dưới trên mobile): khi chọn field/group/header: tên, số bit/byte,
   vị trí trong header (bit x–y), offset tuyệt đối trong frame, `desc`, bảng `values`, giá trị trong ngữ cảnh
   (`set`), điều kiện optional + công tắc bật/tắt, `standard`.

## Màu theo layer

Định nghĩa token CSS cho `phy, l2, l2_5, l3, l4, tunnel, payload, trailer`, có biến thể sáng/tối
(`prefers-color-scheme`). Màu phải giữ đủ tương phản cho chữ trong ô bit. Dùng cùng màu ở frame map,
viền node cây và ô bit để mắt nối các phần với nhau.

## Tương tác & trạng thái

- Trạng thái mở/đóng lưu theo đường dẫn node (`stackId/0/2/tci`), lưu vào `localStorage` (bọc try/catch).
- Stack đang xem đồng bộ với `location.hash` (`#mpls-l3vpn`) để chia sẻ link.
- Hover ô bit ↔ highlight dòng tương ứng trong cây và ngược lại.
- Bàn phím: ↑/↓ di chuyển, ←/→ thu/bung, Enter chọn. Phần tử có `role`/`aria-expanded` hợp lý.

## Tự kiểm trước khi báo xong

1. `node -e` nạp `data/*.js` + `js/model.js` (hoặc phần model trong app.js) bằng `vm`, gọi `buildModel`
   cho mọi stack: không lỗi, tổng byte khớp tổng `fixedBytes` + optional bật + varBytes.
2. Không có lỗi cú pháp: `node --check js/*.js`.
3. Giao diện vẫn chạy khi một stack tham chiếu header thiếu (hiện ô báo lỗi thay vì trắng trang).

## Khi được gọi lại

Đọc code hiện có, sửa đúng chỗ được yêu cầu, giữ nguyên hợp đồng dữ liệu. Nếu cần đổi schema, dừng và
báo orchestrator thay vì tự đổi.
