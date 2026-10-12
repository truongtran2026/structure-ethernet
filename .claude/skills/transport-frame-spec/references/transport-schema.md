# Hợp đồng dữ liệu mảng Truyền dẫn (PDH / SDH / OTN)

Hợp đồng giữa dữ liệu `data/transport-*.js` và giao diện. Khác mảng IP (chuỗi header 1 chiều),
khung truyền dẫn là **lưới 2 chiều** (hàng × cột ô) và có **cây ghép kênh**. Sửa file này trước khi
đổi schema, rồi báo cả transport-expert lẫn frontend-dev.

Nạp như dữ liệu IP: script thường, tự đăng ký vào biến toàn cục; nạp sau `data/stacks.js`.

```js
window.TFRAMES = window.TFRAMES || {};   // khung: id → Frame
window.TMUX    = window.TMUX    || {};   // đơn vị ghép kênh: id → Unit
window.TLABS   = window.TLABS   || [];   // các phòng thí nghiệm ghép kênh
```

## 1. Frame (khung 2 chiều)

```js
{
  id: "stm-1",
  name: "STM-1",
  family: "sdh",                       // pdh | sdh | otn
  category: "Khung STM-N",             // nhóm con trong thanh bên trái (dưới family)
  order: 10,                           // thứ tự trong category
  standard: "ITU-T G.707 §6.1",
  summary: "…",                        // 1 câu tiếng Việt
  detail: "…",                         // 3–6 câu: cấu trúc, vai trò, điều cần nhớ
  grid: { rows: 9, cols: 270, cellBits: 8 },   // ô = 1 byte (cellBits 8); PDH có thể dùng cellBits 1
  periodUs: 125,                       // chu kỳ khung (µs)
  rateKbps: 155520,                    // validator: rows*cols*cellBits*1000/periodUs
  multiframe: { frames: 4, note: "…" },       // (tuỳ chọn) đa khung
  unit: "stm-1",                       // (tuỳ chọn) id trong TMUX tương ứng, để lab mở được khung
  regions: [ /* Region[] — PHẢI phủ kín lưới, không chồng nhau */ ]
}
```

### Region (vùng trên lưới, lồng được)

```js
{
  id: "rsoh",                          // duy nhất trong frame
  name: "Regenerator Section Overhead",
  abbr: "RSOH",                        // nhãn ngắn vẽ trong ô
  kind: "soh",                         // xem bảng kind bên dưới (quyết định màu)
  rect: { r: 0, c: 0, h: 3, w: 9, step: 1 },   // 0-based; step = bước cột (ghép xen byte, mặc định 1)
  desc: "…",                           // tiếng Việt: chức năng
  values: [{ v: "0xF6", m: "…" }],     // (tuỳ chọn)
  bitFields: [{ name: "…", abbr: "…", bits: 4, desc: "…" }],  // (tuỳ chọn) chia bit; tổng = số ô × cellBits
  repeat: "×3N",                       // (tuỳ chọn) chú thích lặp ở STM-N
  perFrame: [                          // (tuỳ chọn) nghĩa thay đổi theo khung trong đa khung (cần frame.multiframe)
    { frames: [0, 2, 4], abbr: "FAS", name: "…", desc: "…", bitFields: [/* tổng = số ô × cellBits */] }
  ],
  children: [ /* Region[] — nếu có, PHẢI phủ kín đúng các ô của cha */ ]
}
```

`perFrame`: mỗi phần tử áp cho các khung (0-based) trong `frames`; mọi chỉ số < `multiframe.frames`.
Nên phủ đủ mọi khung của đa khung (khung không có nghĩa riêng thì dùng `name`/`desc` của region).
`periodUs` được phép là số thập phân (PDH: E2 = 848 bit / 8448 kbit/s ≈ 100,379 µs) — ghi bằng biểu thức
`848 * 1000 / 8448` để chính xác. `cellBits: 1` cho khung tính theo bit (E2/E3/E4).

`rect` với `step > 1` mô tả cột ghép xen: vùng gồm các cột `c, c+step, …, c+(w-1)*step`,
hàng `r … r+h-1`. Dùng cho TUG-3 trong VC-4, TU-12 trong TUG-2…

| kind | Ý nghĩa (màu) |
| --- | --- |
| `fas` | Đồng bộ khung (A1/A2, FAS, MFAS, bit đồng bộ PDH) |
| `soh` | Section overhead (RSOH/MSOH, OTU OH) |
| `pointer` | Con trỏ (H1/H2/H3, V1–V4) |
| `poh` | Path overhead (VC POH, ODU OH) |
| `opu-oh` | Payload overhead / justification control (OPU OH, JC, PSI, C-bit PDH) |
| `payload` | Tải tin (C-n, OPU payload, khe thời gian) |
| `stuff` | Fixed stuff / chèn cố định |
| `fec` | FEC |
| `reserved` | Dự trữ, quốc gia (X), phụ thuộc môi trường (Δ) |
| `tributary` | Vùng thuộc một nhánh con (TUG-3 #1, TU-12 #k…) — dùng để tô ghép xen |

## 2. Unit (đơn vị trong cây ghép kênh)

```js
{
  id: "tug-2",
  name: "TUG-2",
  family: "sdh",
  kind: "tug",                    // client | container | vc | tu | tug | au | aug | stm | odu | opu | otu
  level: 30,                      // thứ tự từ bé đến lớn (để lab sắp palette)
  bytesPer125us: 108,             // kích thước trung bình mỗi 125 µs (SDH) — rateKbps = bytes × 64
  rateKbps: 2048,                 // cho đơn vị không chia được theo byte (PDH, Ethernet…) — chọn đúng một trong hai
  leafOk: true,                   // (tuỳ chọn, chỉ khi có accepts) dùng được như client nguyên khối (không cần lấp con);
                                  // lab mặc định là nguyên khối, người dùng có thể chọn phương án accepts để xem bên trong
  frame: "tug-2",                 // (tuỳ chọn) id TFRAMES để mở lưới
  standard: "ITU-T G.707 §7.1",
  summary: "…",                   // 1 câu
  desc: "…",                      // 2–4 câu
  accepts: [                      // cách lấp đơn vị này — các PHƯƠNG ÁN thay thế nhau, chọn đúng một
    { of: "tu-12", count: 3,
      overhead: { bytes: 0, name: "", desc: "" },      // overhead ở bước này: bytes/125 µs (đơn vị byte)
                                                       // hoặc kbps (đơn vị tốc độ, vd E2: { kbps: 256 })
      mapping: "",                                     // (tuỳ chọn) kiểu ánh xạ: asynchronous, byte-sync, GMP, AMP, BMP…
      note: "…" }
  ]
}
```

### Mở rộng OTN (GD3)

```js
{
  id: "opu2", kind: "opu", rateKbps: 238 / 237 * 9953280,
  tribSlots: { n: 8, kbps: 238 / 237 * 9953280 / 8, size: "1,25G", note: "PT 21" },  // (tuỳ chọn) bể TS
  accepts: [
    { of: "stm-64", count: 1, fit: "le", mapping: "AMP", note: "…" },     // fit "le": count × con ≤ cha − overhead
    { of: "odu0", count: 8, slots: 1, mapping: "GMP", note: "…" },         // slots: số TS mỗi con chiếm
    { of: "odu1", count: 4, slots: 2, mapping: "AMP", note: "…" },
    { of: "oduflex-fc800", count: 1, slots: 7, mapping: "GMP", note: "…" }
  ]
}
```

- `tribSlots` + các phương án có `slots` tạo thành **bể TS**: lab coi tất cả phương án có `slots` của
  cùng unit là MỘT lựa chọn "ghép TS" và cho **trộn** các loại con, miễn tổng `slots` ≤ `tribSlots.n`.
  `count` = ⌊n / slots⌋ (số tối đa khi chỉ dùng một loại). Phương án không có `slots` vẫn là lựa chọn riêng.
- `tribSlots.maxPorts` (tuỳ chọn, GD7): số con tối đa trong bể TS (OPUCn: 10n cổng nhánh dù có 20n TS) — lab từ chối khi đủ số con dù còn TS.
- `fit: "le"` (chỉ cho cha theo tốc độ): count × con + overhead.kbps ≤ cha (ánh xạ có chèn/khoảng trống,
  vd STM-16 vào OPU1, 100GbE vào OPU4). Không có `fit` thì phải bằng đúng như PDH.
- `carriedKbps` (tuỳ chọn trên phương án): tốc độ thực sự mang sau transcode (1GbE TTT, 40GbE 1024B/1027B);
  validator và lab dùng số này thay tốc độ con.

### Mở rộng VCAT (GD4)

```js
{ id: "vc-4-7v", kind: "vcg", family: "sdh", rateKbps: 7 * 149760,
  members: { of: "vc-4", count: 7, payloadOf: "c-4" },   // thành viên đi độc lập; dung lượng = count × payloadOf
  accepts: [{ of: "eth-1g-gfpf", count: 1, fit: "le", carriedKbps: 1000000 * 1526 / 1538, mapping: "GFP-F" }] }
```
VCG không phải con của unit nào: lab rải thành viên vào vị trí trống kiểu `members.of` trong khung đích.
Validator: `members.of` có `accepts` chứa `payloadOf`; `rateKbps = count × tốc độ payloadOf`.

### Mở rộng FlexE (GD9)

```js
// Khung: ô = MỘT khối 64B/66B (cellBits 66); hàng = 1 khối OH + 1023 vòng lịch 20 khe
F["flexe-inst100"] = { family: "flexe", grid: { rows: 8, cols: 20461, cellBits: 66 }, multiframe: { frames: 32 }, … }
// khe lịch s (0–19) là region step 20 phủ cả 8 hàng: rect { r: 0, c: 1 + s, h: 8, w: 1023, step: 20 }
{ id: "flexe-inst100", kind: "flexe", family: "flexe", rateKbps: 103125000 * 16383 / 16384,
  tribSlots: { n: 20, kbps: rate * 20460 / 20461 / 20, size: "5G" },            // bể khe lịch 5G — dùng lại luật bể TS
  accepts: [{ of: "flexe-client-25g", count: 4, slots: 5, carriedKbps: 25e6 * 66 / 64 * 16383 / 16384 * 20460 / 20461 }] }
{ id: "flexe-grp-4x100", kind: "flexe", tribSlots: { n: 80, … } }               // nhóm = lịch PHẲNG 20n khe
{ id: "400gbase-r-flexe", kind: "phy", accepts: [{ of: "flexe-grp-4x100", count: 1, overhead: { kbps: AM + pad } }] }
```
- `family: "flexe"` (category "FlexE"); unit kind `flexe` (instance, nhóm) và `phy` (PHY Ethernet mang nhóm).
- Client FlexE: `rateKbps` = 66/64 × MAC; phương án `slots` ghi `carriedKbps` = tốc độ sau thích ứng Idle
  (× 16383/16384 × 20460/20461) — đúng bằng `slots × tribSlots.kbps`, nên luật bể TS hiện có kiểm được.
- Nhóm n instance vẽ một bể phẳng 20n khe (client > 100G trải nhiều instance, IA §6.8); không có phương án
  "n × instance" vì nó sẽ cấm client vượt 100G (sai với chuẩn).
- `oduflex-flexe-aware-*` (family `otn`, kind `odu`): tốc độ 103 125 000 × 240/238 × n/20 (G.709 Bảng 7-2);
  chỉ n = 20 có `accepts` (1 × flexe-inst100, `fit: "le"`, `leafOk`).

Một unit không có `accepts` là điểm đầu (client). Các con của cùng một phương án là độc lập:
VC-4 nhận 3×TUG-3, mỗi TUG-3 tự chọn phương án riêng (7×TUG-2 hoặc 1×TU-3).

## 3. Lab

```js
{
  id: "sdh",
  name: "Ghép kênh SDH",
  family: "sdh",
  roots: ["stm-1", "stm-4", "stm-16", "stm-64", "stm-256"],   // khung đích người dùng chọn
  palette: ["e1", "e3", "e4", "c-12", "vc-12", "tu-12", "tug-2", "c-3", "vc-3", "tu-3", "tug-3", "c-4", "vc-4"],
  intro: "…"                      // 2–3 câu hướng dẫn
}
```

## 4. Bất biến (validator `scripts/validate-transport.mjs`)

1. Frame: `rateKbps` = rows × cols × cellBits × 1000 / periodUs.
2. Region con nằm trong cha; các region con phủ **kín và không chồng** đúng tập ô của cha
   (kiểm bằng bitmap từng ô, hỗ trợ `step`). Region gốc phủ kín toàn lưới.
3. `bitFields` (nếu có): tổng bit = số ô × cellBits.
4. Unit: với mỗi phương án `accepts`:
   - cha và con đều theo byte → `parent.bytesPer125us = count × child.bytesPer125us + overhead.bytes`;
   - cha theo byte, con theo tốc độ → `count × child.rateKbps ≤ (parent.bytesPer125us − overhead.bytes) × 64`;
   - cha theo tốc độ (ghép PDH) → `parent.rateKbps = count × tốc độ con + overhead.kbps` (danh định; chèn bit
     bù sai lệch, ghi trong desc).
   - Con có `accepts` mà không `leafOk` thì không phải client.
   - `fit: "le"` → `≤` thay vì `=`; `slots` → cần `tribSlots`, `count = min(⌊n/slots⌋, maxPorts)`, (carriedKbps ?? tốc độ con) ≤ slots × tribSlots.kbps; con phải là client hoặc leafOk.
5. Mọi `of`, `frame`, `unit`, `roots`, `palette` trỏ tới id có thật; id duy nhất; `desc`/`summary` không rỗng.
6. Mọi frame có `unit` thì kích thước khớp (unit theo tốc độ: `frame.rateKbps = unit.rateKbps`): `rows × cols × cellBits / 8 × 125 / periodUs = unit.bytesPer125us`
   (bỏ qua nếu unit có rateKbps).
7. `perFrame`: chỉ số khung hợp lệ, bitFields đủ bit.

Chạy: `node .claude/skills/transport-frame-spec/scripts/validate-transport.mjs .`
