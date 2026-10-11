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
  children: [ /* Region[] — nếu có, PHẢI phủ kín đúng các ô của cha */ ]
}
```

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
  rateKbps: 2048,                 // CHỈ cho client không chia được theo byte (E1, E3, E4, Ethernet…)
  frame: "tug-2",                 // (tuỳ chọn) id TFRAMES để mở lưới
  standard: "ITU-T G.707 §7.1",
  summary: "…",                   // 1 câu
  desc: "…",                      // 2–4 câu
  accepts: [                      // cách lấp đơn vị này — các PHƯƠNG ÁN thay thế nhau, chọn đúng một
    { of: "tu-12", count: 3,
      overhead: { bytes: 0, name: "", desc: "" },      // overhead/chèn thêm ở bước này (bytes / 125 µs)
      mapping: "",                                     // (tuỳ chọn) kiểu ánh xạ: asynchronous, byte-sync, GMP, AMP, BMP…
      note: "…" }
  ]
}
```

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
   - con là unit theo byte → `parent.bytesPer125us = count × child.bytesPer125us + overhead.bytes`;
   - con là client (`rateKbps`) → `count × child.rateKbps ≤ (parent.bytesPer125us − overhead.bytes) × 64`.
5. Mọi `of`, `frame`, `unit`, `roots`, `palette` trỏ tới id có thật; id duy nhất; `desc`/`summary` không rỗng.
6. Mọi frame có `unit` thì kích thước khớp: `rows × cols × cellBits / 8 × 125 / periodUs = unit.bytesPer125us`
   (bỏ qua nếu unit có rateKbps).

Chạy: `node .claude/skills/transport-frame-spec/scripts/validate-transport.mjs .`
