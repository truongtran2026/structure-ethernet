# Frame Structure (frame-structure.vercel.app)

Ứng dụng web tĩnh (mở `index.html` bằng nhấp đúp) giúp học cấu trúc khung: mảng IP/Ethernet (VLAN, QinQ,
PBB, MPLS, L2VPN/L3VPN, GRE, IPsec, VXLAN, PPPoE…) và mảng Truyền dẫn (PDH, SDH, OTN) kèm lab ghép kênh,
thu gọn/bung theo từng cấp tới từng bit/byte.

## Harness: Frame Structure

**Mục tiêu:** dữ liệu khung chính xác theo chuẩn (RFC/IEEE/ITU-T) + giao diện học tập thu gọn/bung theo cấp.

**Điều kiện gọi:** mọi yêu cầu xây, mở rộng, sửa dữ liệu hoặc giao diện của ứng dụng này (cả mảng IP lẫn Truyền dẫn) → dùng skill
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
| 2026-10-10 | Thêm StackNode `role` (link/delivery/encap/passenger) + `roleNote`; validator bắt buộc role | protocol-header-spec, data, UI | Người dùng muốn nhóm theo vai trò đóng gói (Outer IP / GRE / Inner) cho dễ nhớ |
| 2026-10-10 | Thêm header esp/esp-trailer/esp-icv + stack gre-ipsec-transport, gre-ipsec-tunnel (compareTo gre-ipv4) | data, catalog | Người dùng yêu cầu GRE over IPsec |
| 2026-10-09 | Thêm `effort` cho 4 agent; frontend-dev mặc định sonnet; bảng chọn model theo loại việc | agents, orchestrator | Tối ưu token: lần chạy đầu ~1/3 token Opus dùng cho việc sửa theo danh sách/cơ học |
| 2026-10-11 | Thêm agent transport-expert, skill transport-frame-spec (schema lưới 2D + cây ghép, validator số học), references/transport-ui.md; mở rộng reviewer/QA/frontend/orchestrator | Toàn bộ | Mở rộng sang Truyền dẫn PDH/SDH/OTN; đổi tên miền frame-structure.vercel.app |
| 2026-10-11 | GD1 SDH: data/transport-sdh.js (11 khung, 24 đơn vị, lab), giao diện cây điều hướng + lưới byte + lab kéo thả; skill thêm bài học G.707 (NPI bỏ, STM-256 64 A1/A2, M0/M1) | data, UI, transport-frame-spec | Giai đoạn 1 mảng Truyền dẫn |
| 2026-10-11 | GD1b: ghép chuỗi liền kề AU-4-4c/16c/64c/256c (+ client POS, 10GBASE-W); lab không cần sửa UI | data, catalog | Người dùng cần AU-4-Xc trong STM-4/16/64/256 |
| 2026-10-11 | GD2 PDH: schema perFrame, leafOk, ghép theo tốc độ (overhead.kbps); data/transport-pdh.js (E1–E4, 64k, lab PDH) + 3 khung ánh xạ PDH→SDH; UI đa khung, lưới bit, lab kbit/s | transport-frame-spec, data, UI | Giai đoạn 2 mảng Truyền dẫn |
| 2026-10-11 | GD3 OTN: data/transport-otn.js (8 khung, 23 đơn vị, lab OTN); schema thêm `tribSlots`/`slots` (bể TS trộn ODU), `fit: "le"`, `carriedKbps`; validator kiểm các luật mới; lab TS + nén cột theo chu kỳ | transport-frame-spec, data, UI | Giai đoạn 3 mảng Truyền dẫn |
| 2026-10-12 | GD4 Ethernet qua SDH: data/headers-gfp.js + stack gfp-f-eth/-cid (mảng IP); data/transport-eos.js (VCG kind `vcg`, `members`, frame vcat-h4/k4); validator kiểm VCG; lab rải thành viên VCG + LCAS, nhận VC rỗng tự dựng, lấp VCG theo lô; bộ chọn đa khung gọn | transport-frame-spec, protocol-header-spec (catalog), data, UI | Nối mảng IP với Truyền dẫn; OTUCn hoãn vì chưa tải được G.709 2016/2020 |
| 2026-10-12 | GD5: ODUflex(GFP) 1/8/32 TS (n/n/n theo Bảng 7-9), GFP-F thẳng vào OPU0/2/3; sửa M1/M0 STM-N về nhóm cột 4 (lỗi từ GD1, phát hiện nhờ render ảnh Hình 9-4…9-7); gợi ý từ chối theo phạm vi lab; đóng gói từng bước EoS; hết CẦN KIỂM | transport-catalog, data, UI | Nối Ethernet GFP-F với OTN; reviewer đọc được hình chuẩn bằng cách render PDF |
| 2026-10-12 | GD6: Ôn tập (#quiz, câu tự sinh từ dữ liệu, lọc lộ đáp án) + Máy tính tốc độ (#calc); lab OTN nhóm palette "Bên trong STM-N"; định dạng số dấu cách; ghi nhớ lỗi mất \ khi sửa regex qua bash Windows | UI, data, catalog | Phản hồi người dùng (POS trong STM-16 qua OTN, ODU1 vs 2×ODU0) + lộ trình |
| 2026-10-12 | GD7 OTUCn + FlexO: data/transport-b100g.js; schema tribSlots.maxPorts (validator: count = min(⌊n/slots⌋, maxPorts)); lab/quiz/calc phân biệt "trực tiếp 10n" với "lồng qua ODU4"; nguồn G.709 06/2020 tải trọn (vòng lặp tải lại) + trích bản dở bằng pymupdf khi bị ngắt | transport-frame-spec, data, UI | OTUCn từng bị hoãn vì không tải được G.709 ≥ 2016 |
| 2026-10-12 | GD8: khung OTUk/ODUk chuyển sang G.709 06/2020 (TCM ACT, FTFL → EXP; số mục/bảng/hình theo bản 2020; giữ câu lịch sử bản 2012) | data, transport-catalog | Thống nhất với OTUCn (GD7) đã vẽ theo bản 2020 |
| 2026-10-12 | GD9 FlexE (OIF IA 2.2): data/transport-flexe.js, family `flexe`, unit kind `flexe`/`phy`, khung OH 66B (cellBits 66), lab nhóm/instance/client, ODUflex(FlexE-aware) vào OPU3/4/OPUCn; UI "khe lịch"/"thích ứng Idle"; lộ trình thêm GD10 (mô phỏng AMP/BMP/GMP/GFP, máy tính MTU/MSS, cổng khai báo CIR) theo phản hồi người dùng | transport-frame-spec (validator FAMILIES/UNIT_KINDS), data, UI | Lộ trình + phản hồi người dùng |
