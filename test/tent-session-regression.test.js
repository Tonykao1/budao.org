const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

process.env.BUDAO_SESSION_SECRET = "test-only-session-secret-at-least-32-bytes";

const { createSessionCookie } = require("../api/_security/auth");

test("publisher session lasts through a normal editing day", () => {
  const cookie = createSessionCookie({ id: "publisher-ims", role: "publisher", slot: "IMS" }, false);
  const maxAgeMatch = cookie.match(/Max-Age=(\d+)/);
  assert.ok(maxAgeMatch, "session cookie should include Max-Age");
  assert.ok(Number(maxAgeMatch[1]) >= 8 * 60 * 60, "publisher session should last at least 8 hours");

  const token = cookie.split(";")[0].split("=")[1];
  const payload = token.split(".")[0];
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  const remaining = claims.exp - Math.floor(Date.now() / 1000);
  assert.ok(remaining >= 8 * 60 * 60 - 2, "signed session expiry should match the longer cookie lifetime");
});

test("tent explains an expired session instead of showing a generic publish failure", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "tent-app.js"), "utf8");
  assert.match(source, /error\.reason === "unauthorized"/);
  assert.match(source, /登录已过期/);
  assert.match(source, /草稿已保留/);
});
