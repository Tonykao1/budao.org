const crypto = require("node:crypto");

const COOKIE_NAME = "budao_pasture_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 180;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const BODY_COLORS = Object.freeze(["#f4ecdc","#f2e3b3","#bfd8da","#dec9c8","#c7d5b5","#d8d7ce","#f1d7bf","#eee8dc"]);
const HEAD_COLORS = Object.freeze(["#8d836e","#917d62","#776d66","#866f70","#727a66","#716a64","#907461","#746d65"]);
const MARKINGS = Object.freeze(["NONE","FACE","BACK","SOCKS"]);

function configurationSecret(env = process.env) {
  const value = env.PASTURE_SESSION_SECRET || env.BUDAO_SESSION_SECRET;
  if (!value || value.length < 32) {
    const error = new Error("pasture_auth_not_configured");
    error.code = "PASTURE_AUTH_NOT_CONFIGURED";
    throw error;
  }
  return value;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(value) {
  const email = normalizeEmail(value);
  return email.length >= 5 && email.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function maskEmail(value) {
  const email = normalizeEmail(value);
  const [local, domain] = email.split("@");
  if (!local || !domain) return "";
  const prefix = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return prefix + "***@" + domain;
}

function hmac(label, value, env = process.env) {
  return crypto.createHmac("sha256", configurationSecret(env))
    .update(label + ":" + String(value))
    .digest("base64url");
}

function emailHash(email, env = process.env) {
  return hmac("pasture-email", normalizeEmail(email), env);
}

function codeHash(email, code, env = process.env) {
  return hmac("pasture-code", normalizeEmail(email) + ":" + String(code), env);
}

function tokenHash(token, env = process.env) {
  return hmac("pasture-session", token, env);
}

function createEmailCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

function createSessionToken() {
  return crypto.randomBytes(48).toString("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function readCookie(request, name = COOKIE_NAME) {
  const header = request && request.headers && request.headers.cookie;
  if (typeof header !== "string") return "";
  const prefix = name + "=";
  const item = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix));
  return item ? item.slice(prefix.length) : "";
}

function serializeSessionCookie(token, secure = true) {
  return [
    COOKIE_NAME + "=" + token,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=" + SESSION_TTL_SECONDS
  ].filter(Boolean).join("; ");
}

function clearSessionCookie(secure = true) {
  return [
    COOKIE_NAME + "=",
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=0"
  ].filter(Boolean).join("; ");
}

function validateSheep(input) {
  const bodyColor = String(input && input.bodyColor || "");
  const headColor = String(input && input.headColor || "");
  const marking = String(input && input.marking || "NONE").toUpperCase();
  if (!BODY_COLORS.includes(bodyColor) || !HEAD_COLORS.includes(headColor) || !MARKINGS.includes(marking)) {
    const error = new Error("invalid_sheep");
    error.code = "INVALID_SHEEP";
    throw error;
  }
  return { bodyColor, headColor, marking };
}

function publicUser(user, sheep) {
  if (!user) return null;
  return {
    id: user.id,
    emailMasked: user.emailMasked,
    createdAt: user.createdAt,
    sheep: sheep ? {
      id: sheep.id,
      bodyColor: sheep.bodyColor,
      headColor: sheep.headColor,
      marking: sheep.marking,
      createdAt: sheep.createdAt
    } : null
  };
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  EMAIL_CODE_TTL_MS,
  BODY_COLORS,
  HEAD_COLORS,
  MARKINGS,
  configurationSecret,
  normalizeEmail,
  validEmail,
  maskEmail,
  emailHash,
  codeHash,
  tokenHash,
  createEmailCode,
  createSessionToken,
  safeEqual,
  readCookie,
  serializeSessionCookie,
  clearSessionCookie,
  validateSheep,
  publicUser
};
