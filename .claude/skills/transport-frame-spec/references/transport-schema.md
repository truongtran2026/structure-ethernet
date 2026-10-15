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
  colBase: 15,                         // (tuỳ chọn, mặc định 1) số cột CHUẨN của cột lưới đầu (khung chỉ vẽ phần OPU: lưới cột 1 = cột 15 của OTUk); UI cộng (colBase−1) khi hiển thị
  multiframe: { frames: 4, note: "…" },       // (tuỳ chọn) đa khung
  unit: "stm-1",                       // (tuỳ chọn) id trong TMUX tương ứng, để lab mở được khung
  opuNote: "…",                        // (tuỳ chọn, chuỗi VN 1–2 câu) khung OTN có vùng OPU OH: nói rõ cột 15–16 vẽ theo ánh xạ nào và các ánh xạ khác bố trí khác (AMP/BMP, GMP, GFP-F, ghép ODU)
  opuSim: "amp-stm16-opu1",               // (tuỳ chọn) id TMAPS cùng kiểu ánh xạ với OPU OH vẽ ở khung; "" = không liên kết (đừng để UI đoán theo server: OPU2 có cả AMP lẫn GMP)
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
  lineKbps: 212500000,            // (tuỳ chọn) tốc độ đường dây khi khác rateKbps (vd sau FEC/256B/257B); quiz/calc dùng cho câu 'tốc độ đường dây'
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

## 5. Mô phỏng ánh xạ (GD10) — `data/transport-mapping.js` → `window.TMAPS = []`

Mỗi phần tử là một kịch bản cho trang `#sim`. File KHÔNG đọc TMUX/TFRAMES lúc nạp (validator nạp theo tên file);
mọi tốc độ ghi bằng biểu thức từ chuẩn. Validator transport không kiểm TMAPS — dùng
`_workspace/I1_transport-expert_tmaps-check.cjs`.

```js
{
  id: "amp-stm16-opu1", order: 10,
  method: "AMP" | "BMP" | "GMP" | "GFP-F" | "IMP" | "PDH-bit",
  name, standard, summary, note,                      // note ghi CÔNG THỨC để tính lại mọi con số
  steps: ["…"],                                       // 3–6 câu cho người mới
  client: "stm-16", server: "opu1",                   // id có trong TMUX
  frames: ["opu1-amp", "otu1"],                       // id TFRAMES cho nút "Xem khung" (có thể rỗng)
  clientKbps, serverPayloadKbps,                      // danh định (GMP 1GbE: sau TTT 15/16; ODTU2.1: OPU2/8; IMP: dung lượng các khe)
  ppm: { client: 45, server: 20, locked?: true, note },   // locked = BMP: server bám client, không bù
  frame: {
    rows, cols, cellBits,                             // lưới VÙNG TẢI (ô = byte 8 / bit 1 / khối 66B 66)
    firstCol,                                         // số cột chuẩn của cột lưới đầu tiên (OTN 17)
    ohCols?: [15, 16],                                // cột OH (ngoài lưới) nên vẽ bên trái để thấy JC/NJO/PSI
    colStep?: 8,                                      // lưới là 1 TS ghép xen: cột chuẩn = firstCol + (c − 1) × colStep
    multiframe?: 8,                                   // GMP theo đa khung: perFrame/P/periodUs tính cho cả đa khung
    interleave?: 7,                                   // VCAT: cột c thuộc thành viên ((c − 1) mod X) + 1
    periodUs, note?
  },
  oh: [ { row | rows: [đầu, cuối], col | cols: [đầu, cuối], abbr, note } ],   // ô OH đáng chú ý (PSI, RES, FAS…)
  fixedStuff: [ { rows: [đầu, cuối], cols: [đầu, cuối], note } ],          // DẢI bao gồm hai đầu, số chuẩn
  just: {                                             // AMP / BMP / PDH-bit (BMP được BỎ – xem "BMP không JC" dưới)
    njo?: { row, col, note }, pjo: { row, col, note, tributary? },
    jc: { rows: [1, 2, 3], col, bits: [7, 8], vote: "2/3", note },         // rows là DANH SÁCH hàng
    fixedJc?: "00",                                   // BMP
    table: [ { jc, njo?, pjo, meaning } ]
  },
  gmp: { m, M, n, cnBits: 14, P, word, jc: { cm: {rows, col}, cnd: {rows, col} }, cndUsed, cndRange?,
         cmNom, cmMin, cmMax, CmMin, CmMax,           // cm thực (float) và Cm nguyên = floor/ceil
         c8Nom?, appliesTo: "khung kế tiếp", iiDi: [ { change, ii, di, invert: "IUIU…", meaning } ],
         formula, sigmaDelta },
  gfp: { coreHdr: 4, payloadHdr: 4, extHdr: 0, fcs: 0, fcsOpt: 4, idleBytes: 4, minEth: 64, maxEth: 1518, maxEthTagged: 1522,
         preambleSfd: 8, ifg: 12, type, idleHex, rule, capacityBytesPerFrame,
         fullLoad: { L1518, L64 },                    // tỉ lệ tải GFP / dung lượng ở 100% tải Ethernet
         bytesPerFrameFullLoad: { L1518, L64 } },
  imp: { block: 66, idle, unit, where, nominalDeletePerFrame, nominalPpm, otn?: { … ODUflex(IMP) } },
  block66?: {                                         // GD13: dòng khối 66B đặt trên lưới BYTE (BMP §17.13; ô vẫn 8 bit vì 15 232 × 8 / 66 không nguyên)
    bits: 66, align: 2, startBits: [1, 3, 5, 7],      // align = 66 mod 8; startBits = bit (1 = MSB) chứa bit đầu sync header
    perFrame,                                         // = rows × cols × cellBits / 66 (≈ 1846,30 với 4 × 3808 byte)
    cycleFrames, cycleBlocks,                         // số khung nhỏ nhất để ranh giới khối trùng ranh giới khung (33 khung = 60 928 khối)
    scrambler, rule,
    rc?: { Z, rc0, rc1, everyBlocks: Z × 20479, perFrame: perFrame / 20480, periodUs: Z × 20480 × 66 / clientKbps, rc0Hex, rc1Hex, note },
    chain?: [ { label, kbps, ratio?: [num, den] } ]   // từ lineKbps client (PMA) tới tốc độ server: kbps = trước × num/den
  },
  budget: [ { kind: "data"|"pjo"|"fs"|"gmp"|"gfp"|"block"|"oh"|"jc", cells, note } ],   // Σ cells = rows × cols
  sim: {
    entity: "byte" | "bit" | "từ 80 byte" | "khối 66B", entityBits,
    perFrame: { nom, min, max },                      // số đơn vị client ĐẾN trong một khung (đa khung) ở danh định / biên ppm
    carry: { fixed, min, max },                       // khung mang được: fixed luôn mang; min…max nhờ chèn/GMP
    locked: false, packet?: true,                     // packet: GFP-F – client là gói, perFrame = tải 100% khung 1518
    idleAdjust?: true, perTributary?: true            // IMP: phần lệch xoá/chèn bằng Idle; PDH: số liệu cho MỘT nhánh
  }
}
```

Bất biến (script tự kiểm): client/server/frames tồn tại; `clientKbps` khớp TMUX (trừ TTT); Σ budget = rows × cols, ô fs = Σ fixedStuff;
`perFrame.min ≤ nom ≤ max`; `perFrame.nom = clientKbps × periodUs / 1000 / entityBits` (trừ BMP, GFP, PDH); biên ppm nằm trong
`carry.min…max` (IMP: lệch < 2 khối); GMP: `CmMin ≤ cmNom ≤ CmMax`, `CmMin = floor(cmMin)`, `CmMax = ceil(cmMax)`, `m = 8M`,
ô GMP × đa khung = P × M, sigma-delta (j × Cm) mod P < Cm cho đúng Cm vị trí dữ liệu.

**BMP không JC (GD13, G.709 §17.13 – "does not generate any justification control signals")**: `method: "BMP"` được bỏ hẳn `just`
khi đồng thời: `ppm.locked` và `sim.locked` true; có `block66` (dòng khối 66B, chọn tên này thay cho cờ `oh66`/`entity: "66B"` vì cần
mang số liệu căn 2 bit + RC + chuỗi tốc độ); `oh` không có ô JC/NJO/PJO (OPUflex OH = PSI + 7 byte RES); budget không có `pjo`/`jc`;
`perFrame.nom = carry.fixed` = mọi ô tải. `sim.entity` vẫn là "byte" (lưới byte) – khối 66B là lớp phủ (`block66`).
Server là ODUflex (TMUX không có unit OPUflex riêng): `serverPayloadKbps` = OPUflex = rate(ODUflex) × 238/239 và
`periodUs` = 122 368 bit / rate(ODUflex). Script kiểm `block66`: perFrame, startBits = {(66k mod 8) + 1}, cycleFrames nhỏ nhất,
rc (Z, 1/20 480, chu kỳ), chain (tích tỉ lệ; bước đầu = `lineKbps` client; có bước = clientKbps; bước cuối = rate server).

## 6. Giao diện đường truyền (GD12) — `data/transport-line.js`

OIF 400ZR (IA 2.0) và 800ZR (IA 1.0): Ethernet đi thẳng vào khung đường truyền coherent, không qua ODU/OTU.
File nạp độc lập (không đọc TMUX của file khác lúc nạp); lab `otn` (transport-otn.js) dùng `zr400`, `zr800`, `800gbe`.

### Frame (TFRAMES), family `otn`, category "Giao diện đường truyền (ZR)"
| id | grid | Ghi chú |
| --- | --- | --- |
| `zr400` | 256 × 1097, **cellBits 10** (= 256 × 10 970 bit) | ô 10 bit = đơn vị ghép xen 10b của AM/OH (IA Hình 11, 14). Hàng 1: AM ô 0–191 (16 lane `am0…am15`: `rect {c: i, w: 12, step: 16}`), PAD 192–383, OH 384–511 (4 instance `{c: 384 + k, w: 32, step: 4}`; chỉ OH #1 có bitFields), đệm 20 bit 512–513, tải 514–1027; hàng 2–256 tải ô 0–1027; cột ô 1028–1096 parity C-FEC (kind `fec`). `multiframe.frames = 4` (đa khung GMP); `perFrame` của OH #1 đổi byte 3–6 (GID/PID ↔ JC4·JC1, JC5·JC2, JC6·JC3). `rateKbps` = khung CÓ parity staircase |
| `zr800` | 514 × 80, **cellBits 128** (= 41 120 khối 128 bit = 512 × 10 280 bit của IA) | lưới theo KHỐI ghép xen: cột c thuộc instance IID (c mod 8) + 1. Hàng 1 = 80 khối OH (`oh-i1…oh-i8`: `{c: iid − 1, w: 10, step: 8}`, bitFields 1280 bit AM/EOH/BOH, `perFrame` 8 khung BOH); hàng 2 cột 0–7 = khối tải đầu (PAD 5 bit + 123 bit); còn lại tải chia `tributary` theo instance (step 8). `rateKbps` = khung CHƯA có OFEC |

Ô `cellBits` > 8 hợp lệ (đã có 66 ở FlexE). bitFields được phép vắt qua biên ô (tổng = số ô × cellBits).

### Unit (TMUX), family `otn`
| id | kind | rateKbps | lineKbps | accepts |
| --- | --- | --- | --- | --- |
| `800gbe` | client | 800 000 000 × 66/64 | 850 000 000 (suy từ fclient IA 800ZR × 544/514 × 20480/20479) | – |
| `zr400` | `otu` | khung zr400 có parity = 478 750 000 × 28/29 × 119/128 × 5485/5488 | 478 750 000 (đường dây) | 1 × `400gbe`, `fit: "le"`, `carriedKbps` = 425 000 000 × 514/544 × 20479/20480, `overhead.kbps` = rate − tải (511/512 × khung không parity) |
| `zr800` | `otu` | 2 × khung 400ZR không parity = 8 × 100 622 438,327 | 945 626 804,824 | 4 phương án thay nhau (không trộn): 8 × `100gbe`, 4 × `200gbe`, 2 × `400gbe`, 1 × `800gbe`; `fit: "le"`, `carriedKbps` = tốc độ sau bỏ FEC + AM |

Quy ước ZR: `rateKbps` = tốc độ khung **vẽ** trong TFRAMES (validator §4.6 bắt bằng `frame.rateKbps`), `lineKbps` = tốc độ bit trên
sợi sau mọi FEC/FAW/pilot (= 8 × tốc độ ký hiệu DP-16QAM). Không cần kind mới (`otu` = khung đường truyền mang client).

### `window.TLINE` (trang `#line` "Từ khung tới bước sóng")
```js
window.TLINE = {
  standard, intro,
  chains: [{
    id: "400zr" | "800zr", name, unit: "zr400", frame: "zr400", client: "400gbe", standard, summary,
    steps: [{
      id, kind: "client" | "adapt" | "frame" | "fec" | "dsp" | "symbol" | "optic",
      label,                         // tên bước (VN)
      kbps,                          // tốc độ SAU bước (kbit/s) – bước đầu là gốc
      ratio: [num, den],             // kbps = kbps bước trước × num/den (mọi bước có kbps trừ bước đầu)
      gbd, bitsPerSymbol,            // chỉ kind "symbol": gbd = kbps bước trước / bitsPerSymbol / 1e6
      ghz,                           // chỉ kind "optic": độ rộng kênh DWDM chính (GHz)
      unit?, frame?,                 // id TMUX/TFRAMES để nút "Xem"
      formula, standard, note        // công thức tính lại được + § / Bảng / Hình của IA
    }]
  }],
  compareCols: [{ id: "400zr" | "800zr" | "flexo", label }],
  compare: [{ label, "400zr": "…", "800zr": "…", flexo: "…", source }]   // ô "CHƯA XÁC MINH" = chưa có văn bản G.709.3/.6
};
```
Validator transport không đọc TLINE — kiểm bằng `_workspace/K1_transport-expert_tline-check.cjs` (chuỗi tỉ lệ, GBd, khớp
IA 400ZR Bảng 16 và 800ZR Bảng 20, id tồn tại, compare đủ cột).
