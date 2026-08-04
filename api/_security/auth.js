const crypto = require("node:crypto");

const COOKIE_NAME = "budao_admin_session";
const SESSION_TTL_SECONDS = 60 * 60;

function getAuthenticatedPublisher(request) {
  const secret = process.env.BUDAO_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;

  const token = readCookie(request, COOKIE_NAME);
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const expected = sign(parts[0], secret);
  if (!safeEqual(parts[1], expected)) return null;

  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch (error) {
    return null;
  }

  if (!claims || claims.iss !== "budao.org" || claims.aud !== "budao-admin" ||
      claims.role !== "publisher" || !["IMS", "BACBC"].includes(claims.slot) ||
      typeof claims.sub !== "string" || claims.sub.length > 160 ||
      !Number.isInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { id: claims.sub, role: claims.role, slot: claims.slot };
}

function authenticateCredentials(email, password) {
  const users = configuredUsers();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = users.find((candidate) => candidate.email.toLowerCase() === normalizedEmail);
  if (!user || typeof password !== "string" || password.length > 256) return null;

  const pieces = user.passwordHash.split("$");
  if (pieces.length !== 3 || pieces[0] !== "scrypt") return null;

  let actual;
  let expected;
  try {
    actual = crypto.scryptSync(password, Buffer.from(pieces[1], "base64url"), 32);
    expected = Buffer.from(pieces[2], "base64url");
  } catch (error) {
    return null;
  }

  if (expected.length !== actual.length || !crypto.timingSafeEqual(actual, expected)) return null;
  return { id: user.id, role: "publisher", slot: user.slot };
}

function configuredUsers() {
  let parsed;
  try {
    parsed = JSON.parse(process.env.BUDAO_ADMIN_USERS_JSON || "[]");
  } catch (error) {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  return parsed.filter((user) => user && typeof user.id === "string" && user.id.length <= 160 &&
    typeof user.email === "string" && user.email.length <= 254 &&
    typeof user.passwordHash === "string" && user.passwordHash.length <= 256 &&
    ["IMS", "BACBC"].includes(user.slot));
}

function createSessionCookie(user, secure = true) {
  const secret = process.env.BUDAO_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("auth_not_configured");
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org",
    aud: "budao-admin",
    sub: user.id,
    role: "publisher",
    slot: user.slot,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  }), "utf8").toString("base64url");
  const value = payload + "." + sign(payload, secret);
  return serializeCookie(COOKIE_NAME, value, SESSION_TTL_SECONDS, secure);
}

function clearSessionCookie(secure = true) {
  return serializeCookie(COOKIE_NAME, "", 0, secure);
}

function serializeCookie(name, value, maxAge, secure) {
  return [
    name + "=" + value,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Strict",
    "Max-Age=" + maxAge
  ].filter(Boolean).join("; ");
}

function readCookie(request, name) {
  const header = request.headers && request.headers.cookie;
  if (typeof header !== "string") return "";
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : "";
}

function sign(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  authenticateCredentials,
  clearSessionCookie,
  createSessionCookie,
  getAuthenticatedPublisher
};
