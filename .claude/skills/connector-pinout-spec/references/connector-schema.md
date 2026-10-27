# Hợp đồng dữ liệu mảng Đấu nối (connector)

Ba file dữ liệu (script thường, gán vào `window`, mở được qua file://, không `type=module`):
`data/conn-serial.js`, `data/conn-telecom.js`, `data/conn-usb.js`. Mỗi file **gộp** vào ba kho chung:

```js
window.CONN_BODIES  = Object.assign(window.CONN_BODIES  || {}, { /* id → Body */ });
window.CONN_PINOUTS = Object.assign(window.CONN_PINOUTS || {}, { /* id → Pinout */ });
window.CONN_CABLES  = (window.CONN_CABLES || []).concat([ /* Cable[] */ ]);
```

Thiếu cả ba file thì mảng "Đấu nối" tự ẩn (giống mảng Truyền dẫn). Phạm vi: **chỉ đầu nối điện**,
**chỉ chuyển đổi thụ động** (dây hàn, cầu nối, điện trở kéo, biến áp balun). Chuyển đổi cần IC
(USB↔RS-232, RS-232↔RS-485, USB-TTL…) không có mục Cable; được nhắc trong `detail` của pinout
dưới dạng "không chế bằng dây được, cần …".

## 1. Body — thân đầu nối vật lý

```js
"de9": {
  id: "de9",
  name: "D-sub 9 chân (DE-9)",
  aka: ["DB9", "DB-9", "cổng COM 9 chân"],    // tên thường gọi, để tìm kiếm
  family: "serial",                             // "serial" | "telecom" | "usb"
  standard: "IEC 60807-3 / MIL-DTL-24308 (thân D-sub)",
  summary: "1 câu.",
  detail: "Đoạn giải thích: cách nhận biết, kích thước vỏ, nhầm lẫn tên (DB9 vs DE9)…",
  genders: {                                    // các giới tính có thật của thân này
    male:   { name: "Đầu đực (chân cắm, plug)", note: "…" },
    female: { name: "Đầu cái (lỗ cắm, socket)", note: "…" }
  },
  face: {                                       // hình mặt cắm để UI vẽ SVG
    outline: "dsub",   // "dsub" | "rj" | "usb-a" | "usb-b" | "usb-b-ss" | "usb-mini-b" | "usb-micro-b"
                       // | "usb-micro-b-ss" | "usb-c" | "bnc" | "m34" | "terminal"
    shell: "E",        // (dsub) cỡ vỏ A/B/C/D/E; (khác) bỏ
    w: 100, h: 40,     // khung toạ độ (đơn vị tuỳ ý), gốc ở góc trên-trái
    viewOf: "male",    // pins[] dưới đây vẽ cho giới tính nào, NHÌN VÀO MẶT CẮM
    orientation: "Cạnh dài của hình thang ở trên",   // mô tả để người học xoay đúng
    pins: [ { pin: "1", x: 10, y: 12 }, … ],          // mọi chân của thân, toạ độ tâm chân
    keys: [ { x, y, w, h, label } ]                   // (tuỳ chọn) chốt/khe định hướng, gờ, lẫy RJ
  },
  pinCount: 9          // = face.pins.length (validator kiểm)
}
```

Quy ước nhìn (UI dựa vào đây, **không được sai**):
- `face.pins` vẽ cho giới tính `viewOf`, nhìn thẳng vào **mặt cắm**.
- Giới tính còn lại nhìn vào mặt cắm = **ảnh gương ngang** của `viewOf` (hai mặt cắm úp vào nhau).
- Nhìn từ **phía hàn** (mặt sau) của một giới tính = ảnh gương ngang mặt cắm của chính nó.
  Ví dụ DE-9 đực nhìn mặt cắm: hàng trên 1-2-3-4-5 từ TRÁI sang PHẢI; đầu cái nhìn mặt cắm: 5-4-3-2-1.
- RJ (8P8C/6P): `viewOf: "female"` (ổ cắm, nhìn vào lỗ, lẫy ở dưới), hoặc plug — ghi rõ trong `orientation`.
- USB-C đối xứng: ghi `orientation` (A1…A12 hàng trên, B12…B1 hàng dưới khi nhìn receptacle).

## 2. Pinout — một cách gán tín hiệu lên một thân

```js
"rs232-de9": {
  id: "rs232-de9",
  body: "de9",                        // id Body
  name: "RS-232 trên DE-9 (DTE, cổng COM PC)",
  family: "serial",
  standard: "TIA-574 (gán chân DE-9); TIA-232-F / ITU-T V.24, V.28 (tín hiệu, mức điện)",
  role: "DTE",                        // (tuỳ chọn) "DTE" | "DCE" | "host" | "device" | "NT" | "TE" | null
  gender: "male",                     // giới tính THƯỜNG GẶP của pinout này trên thiết bị (vd. PC: male)
  summary, detail,                    // detail: mức điện, tốc độ, khoảng cách, lỗi hay gặp, chuyển đổi cần IC
  pins: [
    { pin: "1", signal: "DCD", name: "Data Carrier Detect", dir: "in",
      v24: "109",                     // (tuỳ chọn) mã mạch ITU-T V.24 / tên khác
      color: null,                    // (tuỳ chọn) màu dây chuẩn (T568A/B, USB: "đỏ" VBUS…)
      pair: null,                     // (tuỳ chọn) số cặp xoắn / cặp vi sai ("1", "TX1"…)
      desc: "DCE báo đã có sóng mang…" }
  ],
  groups: [ { name: "Dữ liệu", pins: ["2","3"] }, … ],   // (tuỳ chọn) nhóm để tô màu: dữ liệu, điều khiển, nguồn, đất
  variants: [ { id, name, note, pins: { "4": { signal: "…", desc: "…" } } } ]  // (tuỳ chọn) biến thể gán chân
                                                                              // (vd. PoE Mode A/B, Gigabit vs 100M)
}
```

`dir` nhìn từ thiết bị **mang pinout này** (role): `"in" | "out" | "io" | "pwr" | "gnd" | "shield" | "nc" | "diff"`.
`pins` phải liệt kê **mọi chân** của Body (chân không dùng: `dir: "nc"`). Vỏ/khung kim loại: chân `"S"` (shell)
chỉ khi Body có `face.pins` chứa `"S"`.

## 3. Cable — cáp, đầu chuyển, cáp chế, nút loopback

```js
{
  id: "null-modem-de9-full",
  name: "Cáp null-modem DE-9 ↔ DE-9 (bắt tay đầy đủ)",
  family: "serial",
  kind: "cable",        // "cable" (2 đầu nối bằng dây) | "adapter" (khối chuyển liền) | "loopback" (1 đầu, tự nối)
                        // | "balun" (có biến áp/điện trở — ghi rõ linh kiện trong components)
  a: { pinout: "rs232-de9", gender: "female", label: "Phía PC 1" },
  b: { pinout: "rs232-de9", gender: "female", label: "Phía PC 2" },   // bỏ khi kind = "loopback"
  wires: [
    { a: "2", b: "3", note: "RXD ← TXD" },
    { a: "5", b: "5" },
    { a: "S", b: "S", note: "vỏ – vỏ" }
  ],
  bridges: [ { end: "a", pins: ["1","4","6"], note: "DCD-DTR-DSR nối với nhau" } ],  // (tuỳ chọn) cầu nối trong cùng một đầu
  components: [ { type: "resistor", value: "56 kΩ", between: ["b:A5","b:VBUS"], note: "Rp kéo lên CC" } ], // (tuỳ chọn)
  use: "Nối trực tiếp 2 DTE (PC–PC, PC–cổng console kiểu DTE).",
  standard: "…",        // (tuỳ chọn) nguồn cho sơ đồ dây (chuẩn hoặc tài liệu hãng)
  vendor: false,        // true khi sơ đồ là của hãng / thói quen, không phải chuẩn (vd. Cisco rollover)
  detail: "…",
  warnings: [ "…" ]     // (tuỳ chọn) điều phải tránh: chập VBUS, nhầm A/B RS-485…
}
```

## 4. Bất biến (validator `scripts/validate-connectors.mjs` kiểm)

1. id duy nhất trong mỗi kho; id Cable duy nhất trong mảng.
2. `family` ∈ {serial, telecom, usb}; `face.outline` ∈ danh sách mục 1; `dir` ∈ danh sách mục 2;
   `kind` ∈ {cable, adapter, loopback, balun}; gender ∈ khoá `genders` của Body.
3. Body: `pinCount === face.pins.length`; tên chân trong face không trùng; toạ độ nằm trong `w × h`.
4. Pinout: `body` tồn tại; tập `pins[].pin` **bằng đúng** tập chân của Body (không thiếu, không thừa, không trùng).
   `variants[].pins` chỉ tham chiếu chân có thật.
5. Cable: `a.pinout`/`b.pinout` tồn tại; mọi `wires[].a` là chân của pinout a, `wires[].b` là chân của pinout b;
   `bridges[].pins` là chân của đầu `end`; `kind = "loopback"` thì không có `b` và wires dùng `{a, a2}` (hai chân cùng đầu)
   hoặc chỉ dùng bridges; `kind = "balun"` phải có `components`.
6. Cảnh báo (không chặn): chân `gnd` của hai đầu cáp không được nối với nhau; chân `pwr` nối sang chân không phải `pwr`;
   Cable thiếu `use`.

## 5. Ghi chú nội dung

- Tiếng Việt, thuật ngữ gốc trong ngoặc (DTE/DCE, plug/receptacle, tip/ring…).
- Mỗi Pinout có `standard` thật (TIA-574, TIA-232-F, EIA/TIA-561, TIA-568.2-D, ITU-T V.35/ISO 2593, ITU-T G.703,
  ANSI T1.403 / RJ48C (FCC Part 68), USB 2.0 §6, USB 3.1 Legacy Cable and Connector Spec Rev 1.0 §5, USB Type-C Rev 2.x…). Sơ đồ của hãng
  (Cisco console, Yost) đánh `vendor: true` / ghi "theo tài liệu Cisco".
- Phân biệt rõ "chân số mấy" với "nhìn từ phía nào". Mọi Body có câu `orientation`.
