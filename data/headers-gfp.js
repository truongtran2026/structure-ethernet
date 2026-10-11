// Header GFP (Generic Framing Procedure): gfp-core, gfp-payload-hdr, gfp-ext-linear, gfp-pfcs.
// Nguồn: ITU-T G.7041/Y.1303 (GFP) §6 (cấu trúc khung), §7.1 (ánh xạ Ethernet MAC frame — GFP-F).
// Schema: .claude/skills/protocol-header-spec/references/data-schema.md
window.HEADERS = window.HEADERS || {};
Object.assign(window.HEADERS, {
  "gfp-core": {
    id: "gfp-core",
    name: "GFP Core Header",
    short: "GFP Core",
    layer: "l2",
    standard: "ITU-T G.7041 §6.1.1",
    summary: "4 byte đầu mọi khung GFP: độ dài vùng tải (PLI) và CRC-16 bảo vệ nó (cHEC) — dùng để tìm ranh giới khung.",
    detail:
      "GFP không có cờ đầu/cuối khung như HDLC (0x7E): bên thu tìm khung bằng cách trượt từng byte, coi 4 byte là PLI + cHEC và kiểm CRC-16; " +
      "khớp liên tiếp thì đã đồng bộ, và PLI cho biết khung kế tiếp bắt đầu ở đâu. " +
      "Nhờ vậy không cần chèn byte (byte stuffing), độ dài khung xác định trước — hợp với đường truyền SDH/OTN tốc độ cao. " +
      "Trước khi phát, cả 4 byte core header được XOR với 0xB6AB31E0 để tránh chuỗi toàn 0 (giữ cân bằng DC, đủ chuyển mức cho khôi phục xung nhịp). " +
      "Core header KHÔNG đi qua scrambler x⁴³+1 — scrambler đó chỉ áp cho vùng tải.",
    fixedBytes: 4,
    fields: [
      {
        id: "pli",
        name: "Payload Length Indicator",
        abbr: "PLI",
        bits: 16,
        desc:
          "Số byte của vùng tải (payload area) ngay sau core header: payload header + extension header + thông tin khách + pFCS. " +
          "Không tính chính core header 4 byte; vì vậy khung GFP dài PLI + 4 byte.",
        values: [
          { v: "0", m: "Idle frame — khung rỗng 4 byte chỉ có core header, chèn vào khi không có dữ liệu để lấp đầy tốc độ của container" },
          { v: "1–3", m: "Dành cho control frame (ngoài idle, chưa định nghĩa loại nào)" },
          { v: "4–65535", m: "Khung khách (client frame); vùng tải tối thiểu 4 byte = payload header" }
        ],
        example: "110"
      },
      {
        id: "chec",
        name: "Core Header Error Control",
        abbr: "cHEC",
        bits: 16,
        desc:
          "CRC-16 tính trên 2 byte PLI, đa thức sinh g(x) = x¹⁶ + x¹² + x⁵ + 1. " +
          "Vừa là \"chữ ký\" để tìm ranh giới khung, vừa sửa được lỗi 1 bit và phát hiện lỗi nhiều bit trong core header. " +
          "Idle frame có PLI = 0 và cHEC = 0, sau khi XOR với 0xB6AB31E0 thành B6 AB 31 E0 trên đường truyền.",
        example: "0x31E0 (idle, sau XOR)"
      }
    ]
  },

  "gfp-payload-hdr": {
    id: "gfp-payload-hdr",
    name: "GFP Payload Type Header",
    short: "GFP Type",
    layer: "l2",
    standard: "ITU-T G.7041 §6.1.2.1",
    summary: "4 byte đầu vùng tải: cho biết đây là dữ liệu hay quản lý (PTI), có pFCS không (PFI), có extension header không (EXI) và khách là gì (UPI).",
    detail:
      "Type field 16 bit gồm PTI + PFI + EXI + UPI, được bảo vệ bởi tHEC (CRC-16) ngay sau. " +
      "UPI đóng vai trò giống EtherType: bên thu đọc UPI để biết bỏ khung khách ra theo kiểu gì (Ethernet, PPP/IP, MPLS…). " +
      "Payload header nằm trong vùng tải nên bị scramble bằng x⁴³+1 cùng dữ liệu khách. " +
      "Idle frame không có payload header (PLI = 0).",
    fixedBytes: 4,
    fields: [
      {
        id: "type",
        name: "Type field",
        desc: "16 bit mô tả nội dung vùng tải: loại khung (PTI), có pFCS (PFI), loại extension header (EXI) và loại tải khách (UPI).",
        children: [
          {
            id: "pti",
            name: "Payload Type Identifier",
            abbr: "PTI",
            bits: 3,
            desc: "Phân biệt khung mang dữ liệu khách với khung quản lý khách (vd. báo mất tín hiệu khách CSF tới đầu xa).",
            values: [
              { v: "000", m: "Client data frame — mang dữ liệu khách" },
              { v: "100", m: "Client management frame — quản lý (vd. CSF: Client Signal Fail; 0x03 DCI, 0x04 FDI, 0x05 RDI)" },
              { v: "101", m: "Management communications frame (MCF): kênh quản lý MCC qua liên kết GFP" },
              { v: "khác", m: "Dự trữ" }
            ],
            example: "000"
          },
          {
            id: "pfi",
            name: "Payload FCS Indicator",
            abbr: "PFI",
            bits: 1,
            desc: "Báo có trường pFCS (CRC-32, 4 byte) ở cuối vùng tải hay không. Tuỳ chọn (PFI); với Ethernet thường tắt vì khung MAC đã có FCS.",
            values: [
              { v: "0", m: "Không có pFCS" },
              { v: "1", m: "Có pFCS 4 byte cuối vùng tải" }
            ],
            example: "1"
          },
          {
            id: "exi",
            name: "Extension Header Identifier",
            abbr: "EXI",
            bits: 4,
            desc: "Cho biết loại extension header theo sau payload header (nếu có).",
            values: [
              { v: "0000", m: "Null — không có extension header (point-to-point, một khách)" },
              { v: "0001", m: "Linear — thêm 4 byte có CID để nhiều khách chung một kênh" },
              { v: "0010", m: "Ring — dành cho topo vòng (để nghiên cứu sau, chưa định nghĩa)" },
              { v: "khác", m: "Dự trữ" }
            ],
            example: "0000"
          },
          {
            id: "upi",
            name: "User Payload Identifier",
            abbr: "UPI",
            bits: 8,
            desc:
              "Loại tải khách — ý nghĩa phụ thuộc PTI. Với PTI = 000, UPI nói khách là gì và kiểu ánh xạ (frame-mapped GFP-F hay transparent GFP-T); " +
              "với PTI = 100, UPI nói loại bản tin quản lý.",
            values: [
              { v: "0x01", m: "PTI 000: Ethernet MAC frame, frame-mapped (GFP-F) — PTI 100: CSF mất tín hiệu khách" },
              { v: "0x02", m: "PTI 000: PPP frame-mapped (gồm IP/MPLS qua PPP) — PTI 100: CSF mất đồng bộ ký tự khách" },
              { v: "0x06", m: "PTI 000: GFP-T (khách 8B/10B 1000BASE-X, chuyển mã 64B/65B)" },
              { v: "0x0D", m: "PTI 000: MPLS (frame-mapped)" },
              { v: "0x0E", m: "Không dùng (trước đây MPLS multicast)" },
              { v: "0x10", m: "PTI 000: IPv4 (frame-mapped)" },
              { v: "0x11", m: "PTI 000: IPv6 (frame-mapped)" },
              { v: "0x03–0x05", m: "PTI 100: DCI / FDI / RDI (G.7041 Bảng 6-4)" },
              { v: "0x00, 0xFF", m: "Dự trữ" },
              { v: "khác", m: "Mã khác của Bảng 6-3 (FC, ESCON, RPR, DVB ASI…) hoặc dự trữ" }
            ],
            example: "0x01"
          }
        ]
      },
      {
        id: "thec",
        name: "Type Header Error Control",
        abbr: "tHEC",
        bits: 16,
        desc: "CRC-16 (g(x) = x¹⁶ + x¹² + x⁵ + 1) bảo vệ Type field 16 bit; sửa được lỗi 1 bit, phát hiện lỗi nhiều bit.",
        example: "0x…"
      }
    ]
  },

  "gfp-ext-linear": {
    id: "gfp-ext-linear",
    name: "GFP Linear Extension Header",
    short: "GFP Ext",
    layer: "l2",
    standard: "ITU-T G.7041 §6.1.2.1.3.2 (Hình 6-7)",
    summary: "4 byte thêm khi EXI = 0001: Channel ID (CID) để nhiều luồng khách độc lập chia chung một kênh GFP.",
    detail:
      "Extension header kiểu linear cho phép ghép kênh theo khung: mỗi khung GFP mang CID của khách nó thuộc về, " +
      "nên tối đa 256 luồng khách có thể chia chung một VCG/ODU (point-to-point). " +
      "Gồm CID 8 bit, Spare 8 bit và eHEC (CRC-16) bảo vệ hai byte đó. " +
      "Nằm ngay sau payload type header, trong vùng tải nên cũng bị scramble x⁴³+1.",
    fixedBytes: 4,
    fields: [
      {
        id: "cid",
        name: "Channel Identifier",
        abbr: "CID",
        bits: 8,
        desc: "Số hiệu luồng khách (0–255) mà khung này thuộc về; bên thu dùng CID để chuyển khung ra đúng cổng/khách.",
        example: "5"
      },
      {
        id: "spare",
        name: "Spare",
        bits: 8,
        reserved: true,
        desc: "Dự trữ cho tương lai, đặt bằng 0.",
        example: "0x00"
      },
      {
        id: "ehec",
        name: "Extension Header Error Control",
        abbr: "eHEC",
        bits: 16,
        desc: "CRC-16 (g(x) = x¹⁶ + x¹² + x⁵ + 1) bảo vệ CID + Spare; phát hiện lỗi nhiều bit. Sửa lỗi 1 bit là tuỳ chọn; lỗi không sửa được thì loại khung (§6.1.2.1.4).",
        example: "0x…"
      }
    ]
  },

  "gfp-pfcs": {
    id: "gfp-pfcs",
    name: "GFP Payload Frame Check Sequence",
    short: "pFCS",
    layer: "trailer",
    standard: "ITU-T G.7041 §6.1.2.2.1 (pFCS), §6.1.2.2.1.1 (CRC-32)",
    summary: "CRC-32 tuỳ chọn ở cuối vùng tải GFP (chỉ có khi PFI = 1), bảo vệ phần thông tin khách.",
    detail:
      "pFCS tính trên payload information field — tức phần khách (với GFP-F là cả khung MAC kể cả FCS Ethernet), " +
      "không gồm payload header và extension header (đã có tHEC/eHEC riêng). " +
      "Dùng cùng đa thức CRC-32 như FCS Ethernet. " +
      "Tuỳ chọn (PFI); với Ethernet thường tắt vì khung MAC đã có FCS, nên nhiều thiết bị để PFI = 0 và bỏ pFCS để tiết kiệm 4 byte.",
    fixedBytes: 4,
    fields: [
      {
        id: "pfcs",
        name: "Payload FCS (CRC-32)",
        abbr: "pFCS",
        bits: 32,
        desc: "CRC-32 (đa thức 0x04C11DB7, như Ethernet) tính trên phần thông tin khách; sai thì bên thu báo lỗi/loại khung.",
        example: "0x5A6B7C8D"
      }
    ]
  }
});
