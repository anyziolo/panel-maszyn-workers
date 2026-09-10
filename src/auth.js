// Logowanie / sesje - odpowiednik mechanizmu logowania z wersji Flask.
// Nie mamy tu Flask-session ani ciasteczek podpisywanych server-side
// frameworkiem, wiec robimy to sami: podpisany cookie (HMAC-SHA256 przez
// Web Crypto), format "payload.signature", payload = base64(json).

const COOKIE_NAME = "panel_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 dni

function base64UrlEncode(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function sign(data, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(sig));
}

export async function createSessionCookie(username, secret) {
  const payload = JSON.stringify({ u: username, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS });
  const payloadB64 = base64UrlEncode(new TextEncoder().encode(payload));
  const sig = await sign(payloadB64, secret);
  const value = `${payloadB64}.${sig}`;
  const maxAge = SESSION_TTL_SECONDS;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function parseCookies(request) {
  const header = request.headers.get("Cookie") || "";
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = val;
  }
  return out;
}

// Zwraca username jesli sesja jest poprawna i niewygasla, inaczej null.
// Uzywa porownania w stalym czasie dla podpisu (timing-safe).
export async function getSessionUser(request, secret) {
  const cookies = parseCookies(request);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const payloadB64 = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  let expectedSig;
  try {
    expectedSig = await sign(payloadB64, secret);
  } catch {
    return null;
  }
  if (!timingSafeEqual(sig, expectedSig)) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
  } catch {
    return null;
  }
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.u || null;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function checkCredentials(username, password, settings) {
  const { username: expectedUser, password: expectedPass } = settings.basicAuth;
  return (
    Boolean(username) &&
    Boolean(password) &&
    timingSafeEqual(String(username), String(expectedUser || "")) &&
    timingSafeEqual(String(password), String(expectedPass || ""))
  );
}

// Middleware-style helper: zwraca username jesli zalogowany, inaczej null.
export async function requireAuth(request, settings) {
  if (!settings.sessionSecret) return null;
  return getSessionUser(request, settings.sessionSecret);
}
