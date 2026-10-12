# Danh mục mảng Truyền dẫn

Chuẩn: **ETSI/ITU-T** (E1 2,048M, SDH qua AU-4). ANSI/SONET không thuộc phạm vi.
Id cố định để transport-expert và frontend-dev làm song song. Thêm mục mới: sửa bảng trước.

## Lộ trình

| Giai đoạn | Nội dung | Trạng thái |
| --- | --- | --- |
| GD1 | SDH: khung + đơn vị ghép + lab SDH | xong 2026-10-11 (review G.707 01/2007 ĐẠT vòng 2) |
| GD1b | Ghép chuỗi liền kề VC-4-4c/16c/64c/256c | xong 2026-10-11 (review: sửa trích dẫn §11.1, WIS 64B/66B) |
| GD2 | PDH: E1 (khung, đa khung CRC-4), E2/E3/E4 (chèn bit), lab PDH → SDH | xong 2026-10-11 (review G.704/742/751/707: bit đúng, sửa 3 mô tả) |
| GD3 | OTN: OTU1/2/2e/3/4, ODUk/OPUk OH, FEC, ODU0/flex, TS 1,25G, lab OTN | xong 2026-10-11 (review G.709 02/2012 + Amd.4: 2 vòng, vá 3 trích dẫn; QA ĐẠT) |
| GD4 | Ethernet qua SDH: GFP-F (mảng IP), VCAT/LCAS (VC-n-Xv), lab SDH nhận Ethernet; tồn đọng GD3 | xong 2026-10-12 (review G.707 01/2007, G.7042 03/2006, G.7041 08/2016: 2 vòng ĐẠT; QA ĐẠT) |
| GD5 | ODUflex(GFP) + Ethernet GFP-F vào OTN; tồn đọng GD4 (đóng gói từng bước EoS, CẦN KIỂM cũ); sửa M1/M0 STM-N | xong 2026-10-12 (review G.709 02/2012, G.707 01/2007 ảnh Hình 9-3…9-7: 2 vòng; QA ĐẠT) |
| Sau | OTUCn/FlexO (cần G.709 ≥ 2016 — chưa tải được); FlexE; máy tính tốc độ; quiz | chờ |

## GD5 — ODUflex(GFP) + Ethernet GFP-F vào OTN (thêm vào `data/transport-otn.js`) — G.709 (02/2012) §7, §12.2.5, §17.4, §19; Bảng 7-8, 7-9

ODUflex(GFP) = n × ODUk.ts (Bảng 7-8): ODU2.ts = 1 249 177,230; ODU3.ts = 1 254 470,354; ODU4.ts = 1 301 467,133 kbit/s
(n 1–8 dùng ODU2.ts, 9–32 ODU3.ts, 33–80 ODU4.ts). OPUflex = ODUflex × 238/239, chở GFP-F (PT 0x05).
Số TS: Bảng 7-9 dòng ODUflex(GFP) = n / n / n ở OPU2/3/4 (công thức Ceiling ở NOTE 1–3 chỉ cho ODUflex(CBR)); Phụ lục XI.1: ODUflex co giãn phải chiếm cùng số TS trên mọi tuyến HO.

### Unit (TMUX), family `otn` trừ khi ghi khác

| id | kind | rateKbps | accepts | Vào OPU (slots) |
| --- | --- | --- | --- | --- |
| `eth-10g-gfpf` | client (family sdh như eth-1g-gfpf, đặt trong transport-eos.js) | 10000000 | — | — |
| `eth-40g-gfpf` | client (như trên) | 40000000 | — | — |
| `oduflex-gfp-1` | odu, leafOk | 1 × ODU2.ts | 1×eth-1g-gfpf GFP-F `fit`, carriedKbps ×1526/1538, overhead kbps = ODU OH | OPU2 1, OPU3 1, OPU4 1 |
| `oduflex-gfp-8` | odu, leafOk | 8 × ODU2.ts | 1×eth-10g-gfpf | OPU2 8, OPU3 8, OPU4 8 |
| `oduflex-gfp-32` | odu, leafOk | 32 × ODU3.ts | 1×eth-40g-gfpf | OPU3 32, OPU4 32 (không vào OPU2) |

Thêm phương án ánh xạ trực tiếp GFP-F (PT 0x05, §17.4): `opu2` ← 1×eth-10g-gfpf `fit` (so sánh: 10GBASE-R CBR
không vừa OPU2, khung MAC qua GFP-F thì vừa); `opu3` ← 1×eth-40g-gfpf `fit`.
Kiểm trước (orchestrator): tỉ lệ TS danh định g1/g8/g32 trong OPU2 = 1,00/8,00/32,13; OPU3 = 1,00/7,96/31,99; OPU4 = 0,96/7,68/30,84
→ theo tốc độ chỉ cần 1/8/31 ở OPU4, nhưng chuẩn giữ n TS (Bảng 7-9) — điểm học. (Sửa 2026-10-12: bản đầu catalog ghi nhầm 31, transport-expert phản bác đúng.) Desc nêu HAO (G.7044) thay đổi n không gián đoạn — chỉ mô tả.

### Lab
`otn`: palette thêm `eth-1g-gfpf`, `eth-10g-gfpf`, `eth-40g-gfpf`, `oduflex-gfp-1`, `oduflex-gfp-8`, `oduflex-gfp-32`.
Điểm học: 10GbE CBR (10gbe) → chỉ OTU2e/ODU2e; 10GbE khung MAC (GFP-F) → OPU2 trực tiếp hoặc ODUflex(GFP) 8 TS;
ODUflex(GFP) 32 TS vẫn chiếm 32 TS ở OPU4 dù theo tốc độ chỉ cần ~30,84 (khác ODU3 chiếm 31 TS).

### Tồn đọng
- UI: "Đóng gói từng bước" có chuỗi Ethernet → GFP-F → VCG (SDH) và → ODUflex(GFP)/OPUk (OTN); hộp rỗng do người dùng tạo
  cũng nhận được khi thả đơn vị thường.
- Dữ liệu cũ còn `// CẦN KIỂM`: transport-sdh.js (ô X/Δ hàng 1 và hàng 3 RSOH, phân bổ X hàng 1 STM-N — đối chiếu G.707 01/2007
  Hình 9-6/9-7, bản text có ở scratchpad g707/g707.txt); headers-l2.js XID 0xAF/0xBF (IEEE 802.2 §5.4 — reviewer).

## GD4 — Ethernet qua SDH: VCAT/LCAS (file mới `data/transport-eos.js`) — G.707 §11.2–11.4, G.7042, G.7041

GFP-F (khung) nằm ở mảng IP (`data/headers-gfp.js`, xem protocol-catalog.md). Ở đây là phần truyền dẫn:
ghép chuỗi ẢO — các VC thành viên của một VCG đi **độc lập** qua mạng (mỗi thành viên một AU-4/TU-3/TU-12
bất kỳ, không cần liền kề), đầu thu bù trễ vi sai nhờ MFI và sắp lại theo SQ.

### Unit (TMUX), family `sdh`

| id | kind | rateKbps | members | accepts |
| --- | --- | --- | --- | --- |
| `eth-10m-gfpf` | client | 10000 | — | — (Ethernet 10 Mbit/s, chỉ khung MAC qua GFP-F) |
| `eth-100m-gfpf` | client | 100000 | — | — |
| `eth-1g-gfpf` | client | 1000000 | — | — |
| `vc-12-5v` | vcg | 5 × 2176 | 5 × vc-12 (payloadOf c-12) | 1×eth-10m-gfpf GFP-F `fit`, `carriedKbps` |
| `vc-12-46v` | vcg | 46 × 2176 | 46 × vc-12 | 1×eth-100m-gfpf `fit`, `carriedKbps` |
| `vc-3-2v` | vcg | 2 × 48384 | 2 × vc-3 (payloadOf c-3) | KHÔNG nhận eth-100m-gfpf ở tốc độ đường dây (96 768 < 99 220) — không có accepts, desc giải thích (thực tế dùng được khi chấp nhận giới hạn tốc độ) |
| `vc-3-21v` | vcg | 21 × 48384 | 21 × vc-3 | 1×eth-1g-gfpf |
| `vc-4-7v` | vcg | 7 × 149760 | 7 × vc-4 (payloadOf c-4) | 1×eth-1g-gfpf |

`carriedKbps` cho Ethernet qua GFP-F = tốc độ × 1526 / 1538 (khung 1518 B: bỏ preamble+SFD 8 B và IFG 12 B,
thêm core header 4 + payload header 4; không pFCS) — ghi công thức trong note. Chỉ tốc độ đường dây
khung lớn nhất; khung nhỏ cần ít hơn (64 B: 72/84).
VCG không dùng `accepts` để nằm trong cây: lab rải `members.count` thành viên `members.of` vào các vị trí trống
(AU-4/TU-3/TU-12) của khung đích; dung lượng VCG = count × tốc độ `payloadOf`.

### Frame (TFRAMES), family `sdh`, category "VCAT/LCAS"

| id | Lưới | Chu kỳ | Ghi chú |
| --- | --- | --- | --- |
| `vcat-h4` | 16 hàng × 1 byte (mỗi hàng = byte H4 của một khung VC-4/VC-3 trong đa khung 16) | 16 × 125 = 2000 µs | HO VCAT/LCAS: bit 5–8 MFI-1 (0–15); bit 1–4 theo MFI-1: MFI-2 MSB/LSB, CTRL, GID, CRC-8, MST, RS-Ack, SQ MSB/LSB, dự trữ (G.707 §11.2 Bảng 11-1 không LCAS / §11.2.1 Bảng 11-2 có LCAS, Bảng 11-3 MST; LCAS G.7042). `multiframe` 16 không cần — mỗi hàng đã là một khung; desc nêu đa khung lớn 4096 × 16 (512 ms) |
| `vcat-k4` | 32 hàng × 1 bit (bit 2 của K4 qua 32 đa khung VC-12 500 µs) | 32 × 500 = 16000 µs | LO VCAT/LCAS: MFI 5 bit, SQ 6 bit, CTRL 4, GID 1, RS-Ack, MST, CRC-3 theo vị trí bit (G.707 §11.4 Hình 11-9/11-10, Bảng 11-5) |

### Lab

`sdh`: palette thêm `eth-10m-gfpf`, `eth-100m-gfpf`, `eth-1g-gfpf`, `vc-12-5v`, `vc-12-46v`, `vc-3-2v`, `vc-3-21v`, `vc-4-7v`.
Điểm học: thả GbE vào STM-4 → từ chối "VC-4-7v cần 7 VC-4, STM-4 chỉ có 4; VC-3-21v cần 21 VC-3, STM-4 có 12";
vào STM-16 → 7 thành viên rải vào 7 AU-4 trống bất kỳ, nhãn VCG#n·SQ k; gỡ một thành viên → (LCAS) dung lượng giảm,
hiện còn đủ/không đủ cho client.

### Tồn đọng GD3 (làm kèm)
- `transport-otn.js`: bitFields OMFI (bit 1 = 0, bit 2–8 đếm 0–79, §19.4.4) ở khung otu4 (cột 16 hàng 4 khi PT 21 — hiện ghi RES/OMFI).
- UI: ô chọn khung trong đa khung > 32 khung → bộ chọn gọn (ô số + trước/sau + danh sách khung có nghĩa riêng);
  trạng thái thu gọn trong bể TS khoá theo id ổn định chứ không theo vị trí.

## GD3 — OTN (file mới `data/transport-otn.js`; sửa nhỏ `data/transport-sdh.js`) — ITU-T G.709

Chuỗi: client → OPUk (ánh xạ) → ODUk (+ ODU OH) → OTUk (+ FA/OTU OH + FEC). Khung OTUk luôn 4 × 4080 byte:
cột 1–14 OH (hàng 1: FA OH cột 1–7, OTU OH cột 8–14; hàng 2–4: ODU OH), cột 15–16 OPU OH, cột 17–3824
OPU payload (3808 cột), cột 3825–4080 FEC RS(255,239) (256 cột). Tỉ lệ: OPUk payload : ODUk : OTUk =
3808 : 3824 : 4080 = 238 : 239 : 255. Tốc độ ghi bằng biểu thức (vd `255 / 237 * 9953280`), không làm tròn.

### Unit (TMUX) — theo tốc độ (rateKbps), family `otn`

| id | kind | rateKbps (biểu thức) | accepts |
| --- | --- | --- | --- |
| `1gbe` | client | 1250000 | — (1000BASE-X 8B/10B) |
| `10gbe` | client | 10312500 | — (10GBASE-R 64B/66B) |
| `40gbe` | client | 41250000 | — |
| `100gbe` | client | 103125000 | — |
| `fc-800` | client | 8500000 | — (Fibre Channel 8GFC) |
| `opu0` | opu | 238/239 × 1244160 | 1×1gbe GMP, `fit: "le"`, `carriedKbps` 1171875 (TTT 15/16) |
| `odu0` | odu | 1244160 | 1×opu0 + OH (kbps = hiệu) · `leafOk` |
| `opu1` | opu | 2488320 | 1×stm-16 AMP `fit: "le"` · hoặc TS: `tribSlots` n 2 (PT 20), odu0 `slots` 1 AMP |
| `odu1` / `otu1` | odu / otu | 239/238 × opu1 / 255/239 × odu1 | 1×cấp dưới + OH (otu: OH = 256 cột FEC; FA/OTU OH nằm sẵn ở hàng 1 cột 1–14 của khung ODU) · odu `leafOk` |
| `opu2` | opu | 238/237 × 9953280 | 1×stm-64 AMP/BMP `fit` · hoặc TS n 8 (PT 21): odu0 1 GMP, odu1 2 AMP, oduflex-fc800 7 GMP |
| `odu2` / `otu2` | | 239/238 × / 255/239 × | như trên |
| `opu2e` | opu | 238/237 × 10312500 | 1×10gbe BMP `fit` (G.709 §17.2.4, Bảng 7-2/7-3; chỉ khung OTU2e nằm ngoài G.709 — G.Sup43, IaDI) |
| `odu2e` / `otu2e` | | | như trên |
| `opu3` | opu | 238/236 × 39813120 | 1×stm-256 AMP `fit` · 1×40gbe GMP `fit`, `carriedKbps` = 41250000 × 64/66 × 1027/1024 · TS n 32: odu0 1, odu1 2 AMP, odu2 8 AMP, odu2e 9 GMP, oduflex-fc800 7 GMP |
| `odu3` / `otu3` | | | |
| `opu4` | opu | 238/227 × 99532800 | 1×100gbe GMP `fit` · TS n 80 (dung lượng TS tính trên 3800 cột, 8 cột fixed stuff 3817–3824): odu0 1, odu1 2, odu2 8, odu2e 8, odu3 31, oduflex-fc800 7 (đều GMP) |
| `odu4` / `otu4` | | | |
| `oduflex-fc800` | odu | 239/238 × 8500000 | 1×fc-800 BMP (ODUflex(CBR): OPUflex = tốc độ client) · `leafOk` |

`stm-16`, `stm-64`, `stm-256` (transport-sdh.js): thêm `leafOk: true` để dùng làm client OTN.
Kiểm chứng trước (orchestrator): ODU1/TS OPU2 = 1,99996; ODU2/TS OPU3 = 7,9997; ODU2e/TS OPU3 = 8,29 → 9;
ODU3/TS OPU4 = 30,97 → 31; FC-800 ODUflex/TS = 6,83 (OPU2), 6,56 (OPU4) → 7.

### Frame (TFRAMES), family `otn`

| id | category | Lưới | Chu kỳ | Ghi chú |
| --- | --- | --- | --- | --- |
| `otu2` | Khung OTUk | 4×4080 byte | 4·4080·8·1000 / rate | Chi tiết từng byte (OPU OH kiểu AMP; otu4 dùng biến thể GMP): FAS (OA1×3 0xF6, OA2×3 0x28), MFAS (đa khung 256), SM (TTI/BIP-8/byte 3 bitFields BEI/BIAE·BDI·IAE·RES), GCC0, OTU RES/OSMC theo bản G.709 đang trích; ODU OH: RES, PM&TCM, TCM ACT, TCM1–6, FTFL, PM, EXP, GCC1/2, APS/PCC, RES; PM byte 3 bitFields; OPU OH chung (JC/RES, PSI, NJO); payload; FEC. `multiframe` 256 (TTI 64 byte, PSI 256). unit `otu2` |
| `otu1`, `otu2e`, `otu3`, `otu4` | Khung OTUk | 4×4080 | theo tốc độ | Sinh bằng hàm cùng bố cục `otu2`, đổi chu kỳ/tốc độ/ghi chú (OTU4: FEC bắt buộc §11.1, OPU OH kiểu GMP; OTU2e: G.Sup43, OPU2e BMP PT 0x03) |
| `opu1-amp` | Ánh xạ vào OPU | 4×3810 (cột 15–3824) | = OTU1 | OPU1 chở STM-16 AMP (§17.2): JC hàng 1–3 cột 16, NJO hàng 4 cột 16, PJO hàng 4 cột 17, PSI; bitFields JC; không gán `unit` (unit opu1 = chỉ payload) — unit `opu1`.frame trỏ tới |
| `opu2-ts` | Ánh xạ vào OPU | 4×3810 | = OTU2 | OPU2 PT 21, 8 TS 1,25G ghép xen theo cột (step 8 từ cột 17); OH JC theo TS xoay vòng MFAS mod 8 (`multiframe` 8, `perFrame`), PSI (PT + MSI), OMFI không dùng ở OPU2 |
| `opu4-100ge` | Ánh xạ vào OPU | 4×3810 | = OTU4 | OPU4 chở 100GbE GMP (§17.7.5): JC1–JC6 ở hàng 1–3 cột 15–16, PSI, payload 3800 cột + 8 cột fixed stuff 3817–3824 |

### Lab (TLABS)

- `otn`: "Ghép kênh OTN", family otn, roots `otu1`, `otu2`, `otu2e`, `otu3`, `otu4`; palette `1gbe`, `stm-16`,
  `fc-800`, `10gbe`, `stm-64`, `40gbe`, `stm-256`, `100gbe`, `odu0`, `odu1`, `oduflex-fc800`, `odu2`, `odu2e`, `odu3`.
- Điểm học chính: trộn ODU0/ODU1/ODU2/ODUflex trong cùng OPU theo tributary slot; từ chối có giải thích
  (vd "ODU2e cần 9 TS trong OPU3, còn 6 TS trống"; "10GbE không vào OPU2 — dùng OTU2e hoặc ODU2e");
  thấy vì sao 40GbE phải transcode mới vừa OPU3.

## GD2 — PDH + ánh xạ PDH → SDH (file `data/transport-pdh.js`; sửa nhỏ `data/transport-sdh.js`)

### Unit (TMUX) — theo tốc độ (rateKbps), ghép có chèn bit

| id | kind | rateKbps | accepts | leafOk |
| --- | --- | --- | --- | --- |
| `ds0` | client | 64 | — (kênh 64 kbit/s / khe thời gian) | — |
| `e1` | pdh | 2048 | 30×ds0 + 128 kbps (TS0 + TS16 CAS) · hoặc 31×ds0 + 64 kbps (TS0, CCS/không CAS) | có |
| `e2` | pdh | 8448 | 4×e1 + 256 kbps (G.742: FAS, cảnh báo, Cj, cơ hội chèn) | có |
| `e3` | pdh | 34368 | 4×e2 + 576 kbps (G.751) | có |
| `e4` | pdh | 139264 | 4×e3 + 1792 kbps (G.751) | có |

`e1`, `e3`, `e4` HIỆN ĐÃ CÓ trong transport-sdh.js (kind client): **chuyển** định nghĩa sang
transport-pdh.js (giữ nguyên id, rateKbps; đổi kind thành `pdh`, thêm accepts + `leafOk: true`), xoá
bản cũ trong transport-sdh.js. Nạp transport-pdh.js TRƯỚC transport-sdh.js (index.html: frontend lo).
Như vậy lab SDH vẫn thả E1/E3/E4 như cũ (nguyên khối), và có thể mở xem bên trong.

### Frame (TFRAMES), family `pdh` trừ khi ghi khác

| id | category | Lưới | Chu kỳ | Ghi chú |
| --- | --- | --- | --- | --- |
| `e1` | Khung PDH | 1×32 byte | 125 µs | TS0 perFrame FAS (khung chẵn: Si + 0011011) / NFAS (khung lẻ: Si, 1, A, Sa4–Sa8); đa khung CRC-4 16 khung (Si = C1–C4 / MFAS 001011 + E); TS16 CAS (khung 0: 0000 X Y X X; khung 1–15: abcd của 2 kênh); TS1–15, TS17–31 |
| `e2` | Khung PDH | 4×212 bit | 848000/8448 µs | G.742: FAS 1111010000, A, N, bit nhánh ghép xen (step 4), Cj1–Cj3, cơ hội chèn |
| `e3` | Khung PDH | 4×384 bit | 1536000/34368 µs | G.751 §1.4 Bảng 1: FAS 1111010000, A, N, Cj, cơ hội chèn |
| `e4` | Khung PDH | 6×488 bit | 2928000/139264 µs | G.751 §1.5 Bảng 2: FAS 111110100000, A, N×3, Cj1–Cj5, cơ hội chèn |
| `vc-12-e1` | (family sdh) Ánh xạ PDH→SDH | 4×35 byte | 500 µs | VC-12 đa khung chở E1 không đồng bộ (G.707 §10.1.4.1): V5, J2, N2, K4, byte R cố định, C1/C2 (điều khiển chèn), S1/S2 (cơ hội chèn), byte dữ liệu; unit `vc-12` |
| `vc-3-e3` | (family sdh) Ánh xạ PDH→SDH | 9×85 byte | 125 µs | VC-3 chở E3 không đồng bộ (G.707 §10.1.2.2): POH + 3 khung con T1–T3, C1/C2, S1/S2; unit `vc-3` |
| `vc-4-e4` | (family sdh) Ánh xạ PDH→SDH | 9×261 byte | 125 µs | VC-4 chở E4 (G.707 §10.1.1.1): POH + 20 khối/hàng W X Y Y Y X Y Y Z …; unit `vc-4` |

### Lab (TLABS)

- `pdh`: "Ghép kênh PDH", family pdh, roots `e4`, `e3`, `e2`, `e1`; palette `ds0`, `e1`, `e2`, `e3`.
- `sdh`: palette thêm `e2` (để thấy E2 không có đường vào SDH — từ chối có giải thích) và giữ nguyên phần còn lại.

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

### GD1b — Ghép chuỗi liền kề VC-4-Xc (X = 4, 16, 64, 256) — G.707 §11.1 (con trỏ §8.1.2, §8.1.7)

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
