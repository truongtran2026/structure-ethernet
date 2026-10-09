// Vercel Routing Middleware: trang đăng nhập + phiên cookie + đăng xuất cho toàn bộ site tĩnh.
// Tài khoản/mật khẩu lấy từ biến môi trường BASIC_AUTH_USER / BASIC_AUTH_PASSWORD (không lưu trong code).
// Chưa đặt biến → chặn hết (an toàn mặc định).
//
// Phiên: cookie "<hết hạn>.<chữ ký>", chữ ký = HMAC-SHA256(khóa = mật khẩu, nội dung = user|hết hạn).
// Đổi mật khẩu trên Vercel ⇒ mọi phiên cũ tự mất hiệu lực.

export const config = { matcher: "/:path*" };

const COOKIE = "se_session";
const MAX_AGE = 7 * 24 * 3600; // 7 ngày
const enc = new TextEncoder();

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sign(secret, message) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function makeToken(user, pass) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  return `${exp}.${await sign(pass, `${user}|${exp}`)}`;
}

async function isValidToken(token, user, pass) {
  const [exp, sig] = (token || "").split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await sign(pass, `${user}|${exp}`));
}

function readCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

// Chỉ cho chuyển hướng về đường dẫn nội bộ, chặn open redirect ("//evil.com", "http://…").
function safeNext(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/";
}

function redirect(location, cookie) {
  const headers = { Location: location, "Cache-Control": "no-store" };
  if (cookie) headers["Set-Cookie"] = cookie;
  return new Response(null, { status: 303, headers });
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function loginPage(next, error, status = 200) {
  const html = `<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Đăng nhập · Cấu trúc Header Ethernet</title>
<style>
:root{--bg:#f5f6f8;--surface:#fff;--border:#dde1e7;--text:#1b2230;--muted:#5f6b7c;--accent:#2856d6;--err:#b42318;--err-bg:#fdecea;color-scheme:light}
@media (prefers-color-scheme:dark){:root{--bg:#11151c;--surface:#1a2029;--border:#2c3440;--text:#e6e9ee;--muted:#9aa5b4;--accent:#7b9dff;--err:#ff8a80;--err-bg:#3a1d1b;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:16px;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif}
.card{width:100%;max-width:360px;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:28px 24px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
.mark{display:flex;gap:3px;margin-bottom:14px}.mark i{display:block;width:7px;height:22px;border-radius:2px}
h1{font-size:1.2rem;margin:0 0 4px}p{margin:0 0 20px;color:var(--muted);font-size:.9rem}
label{display:block;font-size:.85rem;margin:12px 0 4px;color:var(--muted)}
input{width:100%;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font:inherit}
input:focus{outline:2px solid var(--accent);outline-offset:1px}
button{width:100%;margin-top:20px;padding:10px;border:0;border-radius:8px;background:var(--accent);color:#fff;font:inherit;font-weight:600;cursor:pointer}
.err{background:var(--err-bg);color:var(--err);padding:8px 12px;border-radius:8px;font-size:.88rem;margin-bottom:8px}
</style></head><body>
<form class="card" method="post" action="/login">
  <div class="mark" aria-hidden="true"><i style="background:#3b6fd8"></i><i style="background:#8250d8;width:4px"></i><i style="background:#2f9445"></i><i style="background:#d0475a;width:4px"></i></div>
  <h1>Cấu trúc Header Ethernet</h1>
  <p>Đăng nhập để xem nội dung.</p>
  ${error ? `<div class="err" role="alert">${escapeHtml(error)}</div>` : ""}
  <input type="hidden" name="next" value="${escapeHtml(next)}">
  <label for="u">Tài khoản</label><input id="u" name="username" autocomplete="username" required autofocus>
  <label for="p">Mật khẩu</label><input id="p" name="password" type="password" autocomplete="current-password" required>
  <button type="submit">Đăng nhập</button>
</form></body></html>`;
  return new Response(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Frame-Options": "DENY" },
  });
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (!user || !pass) {
    return new Response("Trang chưa được cấu hình tài khoản đăng nhập.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const secure = url.protocol === "https:" ? "; Secure" : "";

  if (url.pathname === "/logout") {
    return redirect("/login", `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`);
  }

  const loggedIn = await isValidToken(readCookie(request, COOKIE), user, pass);

  if (url.pathname === "/login") {
    if (request.method === "POST") {
      let form;
      try {
        form = await request.formData();
      } catch {
        return loginPage("/", "Dữ liệu đăng nhập không hợp lệ.", 400);
      }
      const next = safeNext(String(form.get("next") || "/"));
      const okUser = safeEqual(String(form.get("username") || ""), user);
      const okPass = safeEqual(String(form.get("password") || ""), pass);
      if (okUser && okPass) {
        const token = await makeToken(user, pass);
        return redirect(next, `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`);
      }
      return loginPage(next, "Sai tài khoản hoặc mật khẩu.", 401);
    }
    return loggedIn ? redirect(safeNext(url.searchParams.get("next"))) : loginPage(safeNext(url.searchParams.get("next")));
  }

  if (loggedIn) return; // phiên hợp lệ → Vercel trả file tĩnh như bình thường

  // Chưa đăng nhập: điều hướng trang → về trang đăng nhập; tài nguyên (js/css/data) → 401.
  const wantsHtml = (request.headers.get("accept") || "").includes("text/html");
  if (request.method === "GET" && wantsHtml) {
    return redirect(`/login?next=${encodeURIComponent(url.pathname + url.search)}`);
  }
  return new Response("Cần đăng nhập.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
