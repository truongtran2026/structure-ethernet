# Structure Ethernet

Ứng dụng web tĩnh (mở `index.html` bằng nhấp đúp) giúp học cấu trúc header Ethernet và các biến thể
(VLAN, QinQ, PBB, MPLS, L2VPN/L3VPN, GRE, VXLAN, PPPoE…), thu gọn/bung theo từng cấp tới từng bit.

## Harness: Ethernet Header Visualizer

**Mục tiêu:** dữ liệu header chính xác theo chuẩn + giao diện học tập thu gọn/bung theo cấp.

**Điều kiện gọi:** mọi yêu cầu xây, mở rộng, sửa dữ liệu hoặc giao diện của ứng dụng này → dùng skill
`ethernet-header-orchestrator`. Câu hỏi kiến thức đơn thuần có thể trả lời trực tiếp.

**Lịch sử thay đổi:**
| Ngày | Thay đổi | Đối tượng | Lý do |
| --- | --- | --- | --- |
| 2026-10-09 | Dựng harness v2 lần đầu | Toàn bộ | - |
| 2026-10-09 | Thêm StackNode `added` vào schema + validator; I-Tag tách Res1/Res2 | protocol-header-spec | QA: nhãn "+ thêm" sai ở stack tunnel; reviewer: Res2 ≠ 0 thì frame bị loại |
| 2026-10-09 | Ghi cách gọi agent qua general-purpose khi agent chưa được nạp | ethernet-header-orchestrator | Agent tạo trong phiên chỉ được nạp ở phiên sau |
| 2026-10-09 | Thêm `Header.variants` vào schema; validator tự tính bytes từng biến thể và bắt buộc variants cho header có optional/varBytes | protocol-header-spec | Người dùng cần thấy "GRE 4/8/12/16 B" theo cấu hình |
| 2026-10-09 | Bỏ stack `gre-key-seq`; thêm quy tắc "Stack hay biến thể?" | protocol-header-spec, data | Trùng với biến thể Key + Sequence của GRE |
| 2026-10-09 | Gộp `mpls-l2vpn-vpws` + `mpls-vpls` thành `mpls-l2vpn` | data, catalog | Cùng chuỗi header trên dây; khác biệt control plane để trong `detail` |
| 2026-10-09 | Thêm `effort` cho 4 agent; frontend-dev mặc định sonnet; bảng chọn model theo loại việc | agents, orchestrator | Tối ưu token: lần chạy đầu ~1/3 token Opus dùng cho việc sửa theo danh sách/cơ học |
