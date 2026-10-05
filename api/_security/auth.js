const crypto = require("node:crypto");

const COOKIE_NAME = "budao_admin_session";
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const LEGACY_SLOTS = ["IMS", "BACBC", "HD"];
const USER_ENV_KEYS = ["BUDAO_ADMIN_USERS_JSON", "BUDAO_LEADER_USERS_JSON"];
const LOGIN_ALIASES = {
  "hd@budao.org": {
    sourceEmail: "ims@budao.org",
    id: "publisher-hd",
    username: "hd",
    slot: "HD"
  }
};

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

  const slot = normalizeLegacySlot(claims && claims.slot) || "IMS";
  const legacySlotIdentity = !(claims && claims.username);
  const username = legacySlotIdentity ? normalizeUsername(slot) : normalizeUsername(claims.username);

  if (!claims || claims.iss !== "budao.org" || claims.aud !== "budao-admin" ||
      claims.role !== "publisher" || typeof claims.sub !== "string" || claims.sub.length > 160 ||
      !username || !Number.isInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { id: claims.sub, username, role: claims.role, slot, legacySlotIdentity };
}

function isSteward(publisher) {
  return Boolean(publisher && normalizeUsername(publisher.username) === "tony" && publisher.role === "publisher");
}

function authenticateCredentials(identifier, password) {
  const users = configuredUsers();
  const normalizedIdentifier = String(identifier || "").trim().toLowerCase();
  const directUser = users.find((candidate) =>
    candidate.username === normalizedIdentifier ||
    (candidate.email && candidate.email.toLowerCase() === normalizedIdentifier)
  );
  const alias = directUser ? null : LOGIN_ALIASES[normalizedIdentifier];
  const user = directUser || (alias ? users.find((candidate) => candidate.email && candidate.email.toLowerCase() === alias.sourceEmail) : null);
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
  return {
    id: alias ? alias.id : user.id,
    username: alias ? alias.username : user.username,
    role: "publisher",
    slot: alias ? alias.slot : user.slot || "IMS"
  };
}

function authConfigurationStatus() {
  const sources = USER_ENV_KEYS.map(readConfiguredUserSource);
  const provided = sources.filter((source) => source.provided);
  const usersValid = provided.length > 0 && provided.every((source) => source.valid) && configuredUsers().length > 0;

  const secret = process.env.BUDAO_SESSION_SECRET;
  return {
    usersValid,
    sessionSecretValid: typeof secret === "string" && secret.length >= 32
  };
}

function configuredUsers() {
  return USER_ENV_KEYS.flatMap((key) => readConfiguredUserSource(key).users);
}

function readConfiguredUserSource(key) {
  const raw = process.env[key];
  if (!raw) return { provided: false, valid: true, users: [] };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { provided: true, valid: false, users: [] };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { provided: true, valid: false, users: [] };
  }

  const users = parsed.map(normalizeConfiguredUser).filter(Boolean);
  return { provided: true, valid: users.length === parsed.length, users };
}

function normalizeConfiguredUser(user) {
  if (!user || typeof user.id !== "string" || !user.id || user.id.length > 160 || !validPasswordHash(user.passwordHash)) {
    return null;
  }

  const email = typeof user.email === "string" && user.email.length <= 254 ? user.email.trim() : "";
  const username = normalizeUsername(user.username || (email ? email.split("@")[0] : ""));
  if (!username) return null;

  const slot = normalizeLegacySlot(user.slot) || "IMS";
  return { id: user.id, username, email, passwordHash: user.passwordHash, slot };
}

function normalizeUsername(value) {
  const username = String(value || "").trim().toLowerCase();
  return /^[a-z][a-z0-9._-]{0,63}$/.test(username) ? username : "";
}

function normalizeLegacySlot(value) {
  const slot = String(value || "").trim().toUpperCase();
  return LEGACY_SLOTS.includes(slot) ? slot : "";
}

function validPasswordHash(value) {
  if (typeof value !== "string" || value.length > 256) return false;
  const pieces = value.split("$");
  if (pieces.length !== 3 || pieces[0] !== "scrypt") return false;
  try {
    return Buffer.from(pieces[1], "base64url").length > 0 && Buffer.from(pieces[2], "base64url").length === 32;
  } catch (error) {
    return false;
  }
}

function createSessionCookie(user, secure = true) {
  const secret = process.env.BUDAO_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("auth_not_configured");
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org",
    aud: "budao-admin",
    sub: user.id,
    username: normalizeUsername(user.username || user.id),
    role: "publisher",
    slot: normalizeLegacySlot(user.slot) || "IMS",
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
  authConfigurationStatus,
  authenticateCredentials,
  clearSessionCookie,
  createSessionCookie,
  getAuthenticatedPublisher,
  isSteward,
  normalizeUsername
};
