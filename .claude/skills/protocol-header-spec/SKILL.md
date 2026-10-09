---
name: protocol-header-spec
description: "Cách soạn và kiểm tra dữ liệu cấu trúc header mạng (Ethernet 802.3, VLAN 802.1Q/QinQ/PBB, MPLS, L2VPN/L3VPN, GRE, VXLAN, PPPoE, IPv4/IPv6, TCP/UDP) cho ứng dụng trực quan hoá: số bit/byte từng field, nhóm field, ý nghĩa, giá trị đáng nhớ. Dùng khi thêm/sửa/kiểm duyệt file data/*.js, thêm giao thức hoặc loại frame mới, hoặc đối chiếu field với RFC/IEEE. Không dùng cho việc sửa giao diện (dùng header-visualizer-ui)."
---

# Soạn dữ liệu header giao thức

Dữ liệu là phần người học tin tưởng tuyệt đối — một bit sai làm hỏng cả mô hình trong đầu họ.
Vì vậy ưu tiên **chính xác theo chuẩn** trước, **dễ học** sau, và cái gì cũng có thể kiểm bằng script.

## Tài liệu phải đọc

- `references/data-schema.md` — hợp đồng dữ liệu với giao diện. Không tự thêm thuộc tính ngoài schema;
  nếu cần, đề xuất sửa schema cho orchestrator.
- `references/protocol-catalog.md` — danh sách id header/stack cố định, kích thước mong đợi, chuẩn gốc.

## Quy trình

1. Đọc catalog, xác định header/stack mình phụ trách.
2. Với mỗi header: liệt kê field theo hình vẽ chuẩn (RFC: MSB trước, hàng 32 bit). Ghi `standard` có số mục.
3. Gom field thành group theo ý nghĩa (xem mục "Nhóm hoá"). Mục tiêu: thu gọn hết group thì một header
   còn ≤ 5 dòng.
4. Viết `desc` tiếng Việt cho mọi field/group (xem "Văn phong").
5. Chạy validator, sửa tới khi `OK`:
   ```
   node .claude/skills/protocol-header-spec/scripts/validate-data.mjs .
   ```
6. Tự soát với "Lỗi hay gặp" bên dưới trước khi báo xong.

## Nhóm hoá

- Gom theo chức năng người học hay nhắc tới bằng một cái tên: TCI (PCP+DEI+VID), Flags + Fragment Offset
  của IPv4, cờ GRE (C/R/K/S/… + Version), MAC = OUI + NIC-specific, TCP Flags.
- Field optional nằm trong group riêng có `optional` để UI bật/tắt một lần.
- Không gom chỉ để đủ số lượng; group một field là thừa.

## Văn phong `desc`

- Câu đầu: field này **làm gì** (chức năng). Câu sau: giá trị thường gặp, liên hệ thực tế
  (vd. "Router PE dùng nhãn này để chọn VRF").
- Thuật ngữ chuẩn giữ tiếng Anh, giải thích bằng tiếng Việt. Ngắn: 1–3 câu cho field, 2–5 câu cho `detail`.
- `values` chỉ liệt kê giá trị đáng nhớ (EtherType 0x0800/0x86DD/0x8100/0x88A8/0x8847/0x8848/0x8864/0x6558…,
  IP Protocol 1/6/17/47, PCP 0–7…), không chép cả bảng IANA.
- `set` trong stack dùng để hiện giá trị **trong ngữ cảnh** (EtherType = 0x8847 trong frame MPLS) — đây là
  thứ giúp người học thấy vì sao header kế tiếp lại là MPLS. Dùng nó ở mọi điểm "chuyển giao" giữa các lớp.

## Lỗi hay gặp (đã từng sai ở nhiều tài liệu)

- 802.1Q: TCI = PCP(3) + DEI(1) + VID(12). DEI trước đây là CFI.
- MPLS: Label(20) + TC(3) + S(1) + TTL(8). TC trước đây là EXP (RFC 5462). S=1 chỉ ở nhãn đáy.
- GRE (RFC 2784/2890): C(1) + Reserved0 có K,S nằm ở bit 2,3 + Reserved0(9) + Ver(3) + Protocol Type(16).
  Checksum present ⇒ thêm Checksum(16) + Reserved1(16).
- VXLAN: Flags(8, bit I = 0x08) + Reserved(24) + VNI(24) + Reserved(8). UDP dport 4789.
- PW Control Word (RFC 4448/4385): 0000(4) + Flags(4) + FRG(2) + Length(6) + Sequence Number(16).
- 802.1ah I-Tag: TPID 0x88E7(16) + I-PCP(3) + I-DEI(1) + UCA(1) + Res1(1) + Res2(2) + I-SID(24) = 6 byte; Res2 ≠ 0 ⇒ frame bị loại.
- 802.3 Length ≤ 1500 (0x05DC); EtherType ≥ 1536 (0x0600). Khoảng giữa không xác định.
- Frame tối thiểu 64 byte (không gồm preamble) ⇒ payload Ethernet II tối thiểu 46 byte (42 nếu có 1 tag 802.1Q).
- Inner Ethernet trong EoMPLS/VPLS/VXLAN/GRETAP **không mang FCS**.
- IPv4 IHL tính theo từ 32 bit; TCP Data Offset cũng vậy.

## Khi được gọi lại

Nếu file `data/*.js` đã có: đọc trước, chỉ sửa phần được yêu cầu hoặc phần reviewer báo lỗi,
không viết lại toàn bộ. Báo lại danh sách id đã đổi.
