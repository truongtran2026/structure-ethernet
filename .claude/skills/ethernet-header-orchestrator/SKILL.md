---
name: ethernet-header-orchestrator
description: "Điều phối đội agent xây/cập nhật ứng dụng trực quan hoá cấu trúc header Ethernet (802.3, VLAN, QinQ, PBB, MPLS, L2VPN/L3VPN, VPLS, GRE, VXLAN, PPPoE, IP/TCP/UDP). Dùng khi người dùng yêu cầu dựng ứng dụng, thêm giao thức/loại frame mới, sửa dữ liệu header sai, đổi giao diện, chạy lại, cập nhật, bổ sung, kiểm tra lại, 'chỉ sửa phần dữ liệu MPLS', 'làm lại giao diện', 'cải thiện kết quả trước'. Câu hỏi kiến thức đơn thuần về header (vd. 'VLAN tag bao nhiêu byte?') thì trả lời trực tiếp, không cần skill này."
---

# Điều phối: Ethernet Header Visualizer

## Chế độ thực thi: hỗn hợp (giao việc subagent + vòng sinh–kiểm duyệt)

| Bước | Chế độ | Lý do |
| --- | --- | --- |
| 2. Sinh dữ liệu + UI | Subagent song song (một message, nhiều lệnh Agent) | Ba phần độc lập nhờ hợp đồng dữ liệu cố định |
| 3. Kiểm định dữ liệu | Script (orchestrator tự chạy) | Kết quả xác định, rẻ |
| 4. Kiểm duyệt giao thức | Sinh–kiểm duyệt, tối đa 2 vòng | Độ chính xác là giá trị cốt lõi |
| 5. QA tích hợp | Subagent | Kiểm độc lập một lần |

Nếu môi trường có công cụ `Workflow` và người dùng đồng ý, bước 2–5 có thể chuyển thành script `pipeline()`
với cùng agentType; mặc định dùng Agent.

## Đội

| Agent (`subagent_type`) | Kỹ năng | Đầu ra |
| --- | --- | --- |
| `protocol-expert` | protocol-header-spec | `data/headers-*.js`, `data/stacks.js` |
| `frontend-dev` | header-visualizer-ui | `index.html`, `css/style.css`, `js/model.js`, `js/app.js` |
| `protocol-reviewer` (chỉ đọc) | protocol-header-spec | danh sách phát hiện → `_workspace/03_protocol-reviewer_findings.md` |
| `qa-inspector` | cả hai | `_workspace/04_qa-inspector_report.md` |

### Chọn model theo loại việc (tối ưu token)

Frontmatter của agent là mặc định. Orchestrator truyền `model` (và `effort` nếu được hỗ trợ) khi gọi Agent
để ghi đè **theo loại việc**, không theo tầm quan trọng của agent. Nguyên tắc: việc nào đã có đáp án ghi sẵn
(danh sách lỗi, checklist, script) thì dùng model rẻ hơn; việc nào phải tự suy luận ra đáp án thì dùng opus.

| Loại việc | Agent | model | effort |
| --- | --- | --- | --- |
| Viết dữ liệu cho giao thức/loại frame MỚI | protocol-expert | opus | medium |
| Sửa dữ liệu theo danh sách lỗi đã ghi rõ "đúng phải là…" | protocol-expert | sonnet | low |
| Thay đổi cơ học trên dữ liệu (thêm cờ, đổi tên id, đồng bộ giá trị) | protocol-expert | sonnet | low |
| Kiểm duyệt nội dung giao thức | protocol-reviewer | opus | high |
| Kiểm lại vòng 2 (chỉ xác minh các mục đã sửa) | protocol-reviewer | opus | medium |
| Dựng giao diện lần đầu / dựng lại / đổi thuật toán trong `js/model.js` | frontend-dev | opus | medium |
| Chỉnh giao diện có phạm vi rõ (màu, nhãn, tooltip, bố cục, tính năng nhỏ) | frontend-dev | sonnet | medium |
| QA tích hợp theo checklist | qa-inspector | sonnet | low |
| QA có đánh giá trải nghiệm người học | qa-inspector | sonnet | medium |
| Kiểm cấu trúc dữ liệu, cú pháp | — (orchestrator tự chạy script) | không tốn token agent | — |

Haiku: chỉ dùng cho việc biến đổi văn bản hàng loạt không cần hiểu giao thức (vd. dịch `desc` sang
ngôn ngữ khác rồi validator kiểm). Không dùng Haiku cho nội dung bit/byte.
Khi lượt rẻ thất bại 2 lần (validator/reviewer vẫn báo lỗi) → gọi lại cùng việc bằng opus.

Agent tùy chỉnh chỉ được nạp khi mở phiên mới. Nếu `subagent_type` báo "not found" (vừa tạo/sửa file
agent trong phiên này), gọi `general-purpose` với `model` theo bảng trên và mở đầu prompt bằng
"Đóng vai agent định nghĩa tại .claude/agents/<tên>.md (đọc và tuân theo toàn bộ)".

Hợp đồng chung: `.claude/skills/protocol-header-spec/references/data-schema.md` và `protocol-catalog.md`.

## Quy trình

### Bước 0: Xác định loại yêu cầu
- Chưa có `data/` và `js/` → chạy đủ bước 1–6.
- Có rồi, yêu cầu sửa một phần (vd. "thêm EVPN", "sửa GRE", "đổi màu") → chỉ chạy agent liên quan:
  dữ liệu → bước 2 (chỉ protocol-expert) + 3 + 4; giao diện → bước 2 (chỉ frontend-dev) + 5.
  Thêm giao thức mới: cập nhật `protocol-catalog.md` trước.
- Yêu cầu làm lại toàn bộ → đổi tên `_workspace/` thành `_workspace_<ngày-giờ>/` rồi chạy lại.

### Bước 1: Chuẩn bị
Tạo `_workspace/`, ghi yêu cầu người dùng vào `_workspace/00_input.md`. Nếu đổi phạm vi, sửa catalog.

### Bước 2: Sinh song song (một message, 3 lệnh Agent)
- `protocol-expert` A: `data/headers-l2.js` + `data/headers-l3l4.js`.
- `protocol-expert` B: `data/headers-tunnel.js` + `data/stacks.js` (dựa vào id trong catalog; header
  của A có thể chưa có khi B chạy validator — chấp nhận lỗi "không tồn tại" cho id thuộc A).
- `frontend-dev`: toàn bộ giao diện, tự kiểm bằng dữ liệu mẫu trong `_workspace/`.
Prompt mỗi agent ghi rõ: file được giao, file KHÔNG được động vào, đường dẫn hợp đồng, yêu cầu báo cáo.
Lưu báo cáo trả về vào `_workspace/02_<agent>_report.md`.

### Bước 3: Validator
`node .claude/skills/protocol-header-spec/scripts/validate-data.mjs .` — lỗi thì giao lại protocol-expert
(gửi nguyên output), tối đa 2 lần.

### Bước 4: Kiểm duyệt giao thức (tối đa 2 vòng)
Gọi `protocol-reviewer`, lưu kết quả vào `_workspace/03_protocol-reviewer_findings.md`. Có mục
NGHIÊM TRỌNG/SAI → gọi `protocol-expert` sửa theo file đó → reviewer kiểm lại. Sau 2 vòng còn tranh chấp:
giữ nguyên cả hai ý kiến kèm nguồn trong báo cáo cuối, không tự phân xử bằng phỏng đoán.

### Bước 5: QA tích hợp
Gọi `qa-inspector`. Lỗi → giao đúng agent sửa (tối đa 2 vòng) → QA lại phần đó.

### Bước 6: Báo cáo
Tóm tắt cho người dùng: cách mở ứng dụng, danh sách loại frame, kết quả validator/review/QA,
mục còn tồn đọng. Cập nhật bảng thay đổi trong `CLAUDE.md` nếu cấu trúc harness thay đổi.

## Xử lý lỗi
- Agent thất bại: thử lại một lần với prompt rõ hơn; lần hai vẫn lỗi → tiếp tục, ghi phần thiếu vào báo cáo.
- Lỗi không thử lại được (hết hạn mức, quyền bị từ chối): không thử lại; mở file dở dang kiểm thực tế
  tới đâu, ghi `_workspace/missing.md`, báo người dùng (kèm thời điểm hạn mức mở lại nếu biết).
- Orchestrator chỉ tự vá những gì kiểm chứng được (vd. lỗi cú pháp rõ ràng); không tự "điền" nội dung
  giao thức mà reviewer chưa xác nhận.
- Hai nguồn mâu thuẫn: không xoá, ghi cả hai kèm nguồn.

## Kịch bản kiểm thử

### Bình thường
"Dựng ứng dụng" trên thư mục trống → bước 2 tạo 4 file dữ liệu + 4 file UI → validator OK →
reviewer vòng 1 báo 3 lỗi → expert sửa → reviewer ĐẠT → QA ĐẠT → mở `index.html` thấy 18 loại frame.

### Lỗi
Reviewer báo GRE thiếu bit K/S → expert sửa nhưng validator báo tổng bit 28 ≠ 32 → giao lại kèm output
validator → lần 2 OK. Nếu lần 2 vẫn sai, báo cáo cuối ghi "GRE: dữ liệu chưa đạt" và để nguyên lỗi validator.
