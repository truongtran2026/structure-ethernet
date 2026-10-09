// Vercel Routing Middleware: bắt đăng nhập (HTTP Basic Auth) trước mọi file của trang.
// Tài khoản/mật khẩu lấy từ biến môi trường Vercel BASIC_AUTH_USER / BASIC_AUTH_PASSWORD,
// không lưu trong code. Chưa đặt biến → chặn hết (an toàn mặc định).

export const config = { matcher: "/:path*" };

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function unauthorized(message) {
  return new Response(message, {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Structure Ethernet", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export default function middleware(request) {
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) return unauthorized("Trang chưa được cấu hình tài khoản đăng nhập.");

  const header = request.headers.get("authorization") || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    let decoded = "";
    try {
      decoded = new TextDecoder().decode(Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)));
    } catch {
      return unauthorized("Thông tin đăng nhập không hợp lệ.");
    }
    const i = decoded.indexOf(":");
    if (i >= 0 && safeEqual(decoded.slice(0, i), user) && safeEqual(decoded.slice(i + 1), pass)) {
      return; // hợp lệ → cho Vercel trả file tĩnh như bình thường
    }
  }
  return unauthorized("Cần đăng nhập để xem trang này.");
}
