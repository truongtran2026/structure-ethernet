# Hợp đồng dữ liệu (data contract)

Đây là "hợp đồng" duy nhất giữa dữ liệu giao thức (`data/*.js`) và giao diện (`js/app.js`).
Mọi thay đổi schema phải sửa file này trước, rồi báo cho cả protocol-expert lẫn frontend-dev.

## 1. Cách nạp dữ liệu

Ứng dụng mở trực tiếp bằng `file://` (nhấp đúp `index.html`), nên **không dùng ES module / fetch**.
Mỗi file dữ liệu là script thường, tự đăng ký vào biến toàn cục:

```js
window.HEADERS = window.HEADERS || {};
Object.assign(window.HEADERS, {
  "vlan-8021q": { /* Header */ },
});

window.STACKS = window.STACKS || [];
window.STACKS.push({ /* Stack */ });
```

Thứ tự nạp trong `index.html`: `data/headers-*.js` → `data/stacks.js` → `js/app.js`.

## 2. Header (một khối header độc lập, tái sử dụng được)

```js
{
  id: "gre",                       // trùng với key trong window.HEADERS, kebab-case
  name: "GRE Header",              // tên chuẩn (tiếng Anh)
  short: "GRE",                    // nhãn ngắn cho thanh frame map
  layer: "tunnel",                 // phy | l2 | l2_5 | l3 | l4 | tunnel | payload | trailer
  standard: "RFC 2784, RFC 2890",  // nguồn chuẩn, có số mục nếu biết
  summary: "…",                    // 1 câu tiếng Việt: header này làm gì
  detail: "…",                     // 2–5 câu tiếng Việt: hoạt động, lưu ý khi học
  fixedBytes: 4,                   // kích thước khi KHÔNG bật trường optional nào (validator kiểm tra)
  maxBytes: 16,                    // (tuỳ chọn) kích thước khi bật mọi optional / option dài nhất
  fields: [ /* Node[] */ ]
}
```

## 3. Node trong header: Field hoặc Group

### Field (lá)
```js
{
  id: "vid",                 // duy nhất trong header
  name: "VLAN Identifier",   // tên chuẩn
  abbr: "VID",               // (tuỳ chọn) viết tắt hiển thị trong ô bit
  bits: 12,                  // số bit, số nguyên > 0
  desc: "…",                 // tiếng Việt: chức năng, cách dùng
  values: [                  // (tuỳ chọn) bảng giá trị đáng nhớ
    { v: "0x000", m: "Priority tag – không thuộc VLAN nào" },
    { v: "0xFFF", m: "Dự trữ" }
  ],
  example: "100",            // (tuỳ chọn) giá trị ví dụ
  reserved: true,            // (tuỳ chọn) trường dự trữ / phải bằng 0
  optional: "K = 1",         // (tuỳ chọn) chỉ có mặt khi điều kiện đúng; chuỗi = điều kiện hiển thị
  varBytes: { min: 0, max: 40, default: 0 } // CHỈ cho trường độ dài thay đổi; khi có thì bỏ `bits`
}
```

### Group (gói nhiều field/group con để thu gọn)
```js
{
  id: "tci",
  name: "Tag Control Information (TCI)",
  desc: "…",                 // tiếng Việt: nhóm này gộp những gì
  optional: "C = 1",         // (tuỳ chọn) cả nhóm là optional
  children: [ /* Node[] */ ]
}
```

Quy tắc nhóm: gom theo **ý nghĩa** (vd. TCI = PCP+DEI+VID, "Flags" của IPv4, MAC → OUI + NIC,
GRE "Checksum Present…Version" = khối cờ 16 bit). Mỗi header có ≥ 1 cấp group khi có hơn 4 field,
để người học thu gọn được. Không lồng quá 3 cấp group.

### Thứ tự bit
Liệt kê field theo **thứ tự xuất hiện trong header khi vẽ theo RFC (MSB trước, trái → phải)**.
Riêng octet đầu MAC: viết theo thứ tự hiển thị chuẩn (bit 7..0 của octet), I/G là bit thấp nhất
(bit truyền đầu tiên), U/L kế tiếp — ghi chú điều này trong `desc`.

## 4. Stack (một loại frame hoàn chỉnh)

```js
{
  id: "mpls-l3vpn",
  name: "MPLS L3VPN (2 nhãn)",
  category: "MPLS & VPN",          // xem danh mục trong protocol-catalog.md
  summary: "…",                    // 1 câu tiếng Việt
  detail: "…",                     // 3–6 câu: header nào được thêm/bớt so với Ethernet II và vì sao
  compareTo: "eth2-ipv4",          // (tuỳ chọn) stack gốc để UI đánh dấu header được THÊM
  tree: [ /* StackNode[] */ ]
}
```

### StackNode
```js
// Tham chiếu header
{
  header: "mpls-label",            // id trong window.HEADERS
  label: "Transport Label (outer)",// (tuỳ chọn) tên theo ngữ cảnh
  note: "…",                       // (tuỳ chọn) vai trò của header ở vị trí này
  set: { s: "0", label: "16001" }, // (tuỳ chọn) giá trị cụ thể trong ngữ cảnh: fieldId → chuỗi
  enable: ["key"],                 // (tuỳ chọn) id field/group optional được bật mặc định
  varBytes: { payload: 46 },       // (tuỳ chọn) độ dài mặc định cho trường varBytes: fieldId → bytes
  wire: true,                      // (tuỳ chọn) chỉ có trên dây (preamble/SFD), không tính vào kích thước frame
  added: true                      // (tuỳ chọn) header này được THÊM so với stack `compareTo`.
                                   // Stack có compareTo phải đánh dấu tường minh mọi header được thêm
                                   // (vd. Outer IPv4 + GRE trong gre-ipv4, không phải Inner IPv4).
                                   // Cũng dùng được trên node group: cả nhóm là phần thêm.
}

// Nhóm header (để thu gọn ở cấp cao nhất)
{
  group: "Outer Ethernet header",
  note: "…",
  children: [ /* StackNode[] */ ]
}
```

## 5. Bất biến mà validator kiểm tra

1. Mọi `header` trong stack tồn tại trong `window.HEADERS`.
2. Tổng bit các field không optional, không varBytes của header = `fixedBytes * 8`.
3. Tổng bit của mọi field optional cộng thêm phải là bội số của 8.
4. `id` field/group duy nhất trong header; `id` stack duy nhất.
5. Field có đúng một trong hai: `bits` (int > 0) hoặc `varBytes`.
6. `desc`/`summary` không rỗng; `set`/`enable`/`varBytes` của StackNode trỏ đến id có thật.
7. `layer` thuộc danh sách hợp lệ.

Chạy: `node .claude/skills/protocol-header-spec/scripts/validate-data.mjs .`
