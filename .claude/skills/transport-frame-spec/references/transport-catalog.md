# Danh mục mảng Truyền dẫn

Chuẩn: **ETSI/ITU-T** (E1 2,048M, SDH qua AU-4). ANSI/SONET không thuộc phạm vi.
Id cố định để transport-expert và frontend-dev làm song song. Thêm mục mới: sửa bảng trước.

## Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| GD1 | SDH: khung + đơn vị ghép + lab SDH | xong 2026-10-11 (review G.707 01/2007 ĐẠT vòng 2) |
| GD1b | Ghép chuỗi liền kề VC-4-4c/16c/64c/256c | xong 2026-10-11 (review: sửa trích dẫn §11.1, WIS 64B/66B) |
| GD2 | PDH: E1 (khung, đa khung CRC-4), E2/E3/E4 (chèn bit), lab PDH → SDH | chờ |
| GD3 | OTN: OTU1/2/2e/3/4, ODUk/OPUk OH, FEC, ODU0/flex, TS 1,25G, lab OTN | chờ |
| Sau | OTUCn/FlexO; Ethernet qua truyền dẫn (GFP-F, VCAT/LCAS, GMP, FlexE); máy tính tốc độ; quiz | chờ |

## GD1 — SDH (file `data/transport-sdh.js`)

### Frame (TFRAMES)

| id | category | Lưới (hàng×cột byte) | Chu kỳ | Ghi chú |
| --- | --- | --- | --- | --- |
| `stm-1` | Khung STM-N | 9×270 | 125 µs | Chi tiết từng byte RSOH, AU-4 pointer, MSOH; VC-4 (POH J1…N1 + C-4) với bitFields cho K1, K2, S1, H1/H2 |
| `stm-4` | Khung STM-N | 9×1080 | 125 µs | Mức nhóm (A1 ×12…); sinh bằng hàm từ N |
| `stm-16` | Khung STM-N | 9×4320 | 125 µs | như trên |
| `stm-64` | Khung STM-N | 9×17280 | 125 µs | như trên |
| `stm-256` | Khung STM-N | 9×69120 | 125 µs | như trên |
| `vc-4` | Container bậc cao | 9×261 | 125 µs | POH (1 cột: J1,B3,C2,G1,F2,H4,F3,K3,N1, bitFields cho G1, C2) + C-4 (260 cột) |
| `vc-4-tug3` | Container bậc cao | 9×261 | 125 µs | VC-4 chứa 3×TUG-3: POH + 2 cột fixed stuff + 3 TUG-3 ghép xen (step 3) |
| `tug-3` | Container bậc thấp | 9×86 | 125 µs | 2 cột fixed stuff (NPI đã bỏ khỏi chuẩn) + 7 TUG-2 ghép xen (step 7) |
| `tu-3` | Container bậc thấp | 9×86 | 125 µs | H1/H2/H3 + fixed stuff + VC-3 (9×85 với POH) |
| `tug-2` | Container bậc thấp | 9×12 | 125 µs | 3 TU-12 ghép xen (step 3) |
| `tu-12` | Container bậc thấp | 9×4 | 125 µs | Byte V1/V2/V3/V4 (theo khung trong đa khung 500 µs) + 35 byte VC-12; đa khung 4; bitFields V5 |

Mỗi frame có `unit` trỏ TMUX tương ứng (stm-1…, vc-4, tug-3, tu-3, tug-2, tu-12).

### Unit (TMUX) — kích thước byte/125 µs phải khớp số học

| id | kind | bytesPer125us / rateKbps | accepts |
| --- | --- | --- | --- |
| `e1` | client | 2048 kbps | — |
| `e3` | client | 34368 kbps | — |
| `e4` | client | 139264 kbps | — |
| `c-12` | container | 34 | 1×e1 (asynchronous) |
| `vc-12` | vc | 35 | 1×c-12 + POH 1 (V5,J2,N2,K4 / 500 µs) |
| `tu-12` | tu | 36 | 1×vc-12 + pointer 1 (V1–V4 / 500 µs) |
| `tug-2` | tug | 108 | 3×tu-12 |
| `c-3` | container | 756 | 1×e3 |
| `vc-3` | vc | 765 | 1×c-3 + POH 9 |
| `tu-3` | tu | 774 | 1×vc-3 + pointer 3 (H1–H3) + fixed stuff 6 |
| `tug-3` | tug | 774 | 7×tug-2 + 18 (fixed stuff) · hoặc 1×tu-3 |
| `c-4` | container | 2340 | 1×e4 |
| `vc-4` | vc | 2349 | 1×c-4 + POH 9 · hoặc 3×tug-3 + POH 9 + fixed stuff 18 |
| `au-4` | au | 2358 | 1×vc-4 + pointer 9 |
| `aug-1` | aug | 2358 | 1×au-4 |
| `aug-4` / `aug-16` / `aug-64` / `aug-256` | aug | 4× cấp dưới | 4×aug cấp dưới |
| `stm-1` | stm | 2430 | 1×aug-1 + SOH 72 |
| `stm-4` / `stm-16` / `stm-64` / `stm-256` | stm | 2430×N | 1×aug-N + SOH 72N |

### GD1b — Ghép chuỗi liền kề VC-4-Xc (X = 4, 16, 64, 256) — G.707 §8.1.7 / §8.2

Byte/125 µs (validator kiểm):

| X | c-4-Xc | vc-4-Xc (= C + POH 9 + FS 9·(X−1)) | au-4-Xc (= VC + pointer 9·X) | = aug-X |
| --- | --- | --- | --- | --- |
| 4 | 9360 | 9396 | 9432 | aug-4 |
| 16 | 37440 | 37584 | 37728 | aug-16 |
| 64 | 149760 | 150336 | 150912 | aug-64 |
| 256 | 599040 | 601344 | 603648 | aug-256 |

- Unit `c-4-4c`, `vc-4-4c`, `au-4-4c` … `au-4-256c` (kind container / vc / au).
- `aug-X` thêm phương án `{ of: "au-4-Xc", count: 1 }` bên cạnh `4×aug cấp dưới`.
- Client lấp đầy C-4-Xc (rateKbps = dung lượng C-4-Xc, khách gói kiểu POS/ATM/GFP):
  `pos-4c` 599040, `pos-16c` 2396160, `10gbase-w` 9584640 (10GBASE-W WAN PHY, IEEE 802.3 cl.50, vào VC-4-64c), `pos-256c` 38338560.
- Frame: `vc-4-4c` (9×1044: POH + 3 cột FS + C-4-4c) và hàm sinh cho 16c/64c/256c (mức nhóm);
  `au-4-xc-ptr` không cần frame riêng — mô tả chỉ thị ghép chuỗi (H1H2 = 1001SS11 11111111) trong desc unit au-4-Xc.
- Lab `sdh`: palette thêm `pos-4c`, `pos-16c`, `10gbase-w`, `pos-256c`, `vc-4-4c`, `vc-4-16c`, `vc-4-64c`.
- Ghép chuỗi ảo (VC-n-Xv, VCAT/LCAS) thuộc giai đoạn "Ethernet qua truyền dẫn", không làm ở đây.

### Lab (TLABS)

`sdh`: roots stm-1…stm-256; palette e1, e3, e4, c-12, vc-12, tu-12, tug-2, c-3, vc-3, tu-3, tug-3, c-4, vc-4, au-4, aug-1, aug-4.
