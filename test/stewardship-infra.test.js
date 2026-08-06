const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { getDatabaseUrl, sanitizeDatabaseError } = require("../db/client");
const {
  STEWARD_CODE_ALPHABET,
  createUniqueStewardCode,
  generateStewardCode,
  isStewardCode
} = require("../auth/stewardship/steward-code");
const {
  createSessionTokenRecord,
  generateSessionToken,
  hashSessionToken
} = require("../auth/stewardship/session-token");
const {
  canConsumeChallenge,
  challengeExpiry,
  generateChallenge,
  hashChallenge
} = require("../auth/stewardship/challenge");
const { getWebAuthnConfig, requireSecret } = require("../auth/stewardship/config");

test("stewardship schema and initial migration exist", () => {
  const schema = fs.readFileSync(path.join(__dirname, "..", "db", "schema.js"), "utf8");
  const migration = fs.readFileSync(path.join(__dirname, "..", "db", "migrations", "0001_stewardship_identity.sql"), "utf8");
  for (const table of [
    "stewardship_users",
    "passkey_credentials",
    "webauthn_challenges",
    "stewardship_sessions",
    "pending_intents",
    "recovery_contacts",
    "recovery_codes",
    "stewardship_audit_events"
  ]) {
    assert.match(schema + migration, new RegExp(table));
  }
});

test("database configuration fails closed without exposing connection details", () => {
  assert.throws(() => getDatabaseUrl({}), /Database is not configured/);
  assert.deepEqual(sanitizeDatabaseError({ code: "DATABASE_NOT_CONFIGURED" }), {
    ok: false,
    error: "database_not_configured"
  });
});

test("webauthn config defaults to Budao production origins", () => {
  const config = getWebAuthnConfig({});
  assert.equal(config.rpId, "budao.org");
  assert.equal(config.rpName, "易彼益");
  assert.deepEqual(config.allowedOrigins, ["https://budao.org", "https://www.budao.org"]);
});

test("required stewardship secrets fail closed when absent or weak", () => {
  assert.throws(() => requireSecret("STEWARDSHIP_SESSION_SECRET", {}), /Required secret/);
  assert.throws(() => requireSecret("STEWARDSHIP_SESSION_SECRET", { STEWARDSHIP_SESSION_SECRET: "short" }), /Required secret/);
});

test("steward code format is non-ambiguous and permanent-looking", () => {
  const code = generateStewardCode();
  assert.match(code, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
  assert.equal(/[0O1IL]/.test(code), false);
  assert.equal(code.includes("EB-"), false);
  for (const char of code.replaceAll("-", "")) assert.equal(STEWARD_CODE_ALPHABET.includes(char), true);
});

test("steward code collision retry relies on unique constraint feedback", async () => {
  let attempts = 0;
  const code = await createUniqueStewardCode(async (candidate) => {
    attempts += 1;
    assert.equal(isStewardCode(candidate), true);
    if (attempts === 1) {
      const error = new Error("duplicate key value violates unique constraint");
      error.code = "23505";
      throw error;
    }
  });
  assert.equal(isStewardCode(code), true);
  assert.equal(attempts, 2);
});

test("session token is high entropy and only the hash is storage-ready", () => {
  const token = generateSessionToken();
  assert.ok(token.length >= 64);
  const tokenHash = hashSessionToken(token, "a".repeat(40));
  assert.notEqual(tokenHash, token);
  assert.match(tokenHash, /^[A-Za-z0-9_-]+$/);
  const record = createSessionTokenRecord("b".repeat(40));
  assert.ok(record.token);
  assert.ok(record.tokenHash);
  assert.notEqual(record.token, record.tokenHash);
});

test("challenge supports expiry and one-time consumption state", () => {
  const challenge = generateChallenge();
  assert.ok(challenge.length >= 40);
  const hash = hashChallenge(challenge, "c".repeat(40));
  assert.notEqual(hash, challenge);

  const now = new Date("2026-01-01T00:00:00.000Z");
  const expiresAt = challengeExpiry(now, 300);
  assert.equal(canConsumeChallenge({ expiresAt, consumedAt: null }, now), true);
  assert.equal(canConsumeChallenge({ expiresAt, consumedAt: new Date() }, now), false);
  assert.equal(canConsumeChallenge({ expiresAt: now, consumedAt: null }, now), false);
});

test("health endpoint never returns sensitive environment details on missing database", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  const health = require("../api/stewardship/health");
  const res = {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await health({ method: "GET" }, res);
  assert.equal(res.statusCode, 503);
  assert.deepEqual(res.body, { ok: false, error: "database_not_configured" });
  assert.equal(JSON.stringify(res.body).includes("DATABASE_URL"), false);
  if (previousDatabaseUrl) process.env.DATABASE_URL = previousDatabaseUrl;
});
