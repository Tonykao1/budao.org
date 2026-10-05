const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "test-session-secret-that-is-long-enough";
process.env.BUDAO_PRAYER_DATA_KEY = Buffer.alloc(32, 17).toString("base64url");
process.env.BUDAO_PRAYER_LEADER_IDS = "leader-1";

const { createSessionCookie } = require("../api/_security/auth");
const { encryptPrayerPayload } = require("../api/_security/prayer-crypto");
const listModule = require("../api/_security/prayer-list-handler");
const actionModule = require("../api/_security/prayer-action-handler");

function cookie(slot = "IMS", id = "leader-1") {
  return createSessionCookie({ id, role: "publisher", slot }, false).split(";")[0];
}

function req(method, body, query = {}, headers = {}) {
  return { method, body, query, headers: { cookie: cookie(), "content-type": "application/json", ...headers } };
}

function res() {
  return { headers: {}, statusCode: 0, body: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; } };
}

test("prayer list requires an authenticated publisher and a valid status", async () => {
  const handler = listModule.createPrayerListHandler({ listPrayers: async () => [] });
  let response = res();
  await handler({ method: "GET", query: { status: "NEW" }, headers: {} }, response);
  assert.equal(response.statusCode, 401);
  response = res();
  await handler(req("GET", null, { status: "OTHER" }), response);
  assert.equal(response.statusCode, 400);
});

test("ordinary publishers are denied unless explicitly authorized as prayer leaders", async () => {
  const original = process.env.BUDAO_PRAYER_LEADER_IDS;
  process.env.BUDAO_PRAYER_LEADER_IDS = "another-leader";
  const handler = listModule.createPrayerListHandler({ listPrayers: async () => { throw new Error("must not run"); } });
  const response = res();
  await handler(req("GET", null, { status: "NEW" }), response);
  process.env.BUDAO_PRAYER_LEADER_IDS = original;
  assert.equal(response.statusCode, 401);
});

test("list decrypts only prayer body, omits contact and records content-free views", async () => {
  const encrypted = encryptPrayerPayload({ body: "请为家人守望" }, process.env.BUDAO_PRAYER_DATA_KEY);
  const audits = [];
  const handler = listModule.createPrayerListHandler({
    dataKey: process.env.BUDAO_PRAYER_DATA_KEY,
    listPrayers: async (user, status) => {
      assert.deepEqual({ id: user.id, role: user.role, slot: user.slot }, { id: "leader-1", role: "publisher", slot: "IMS" });
      assert.equal(status, "NEW");
      return [{ id: "p1", bodyCiphertext: encrypted.ciphertext, bodyNonce: encrypted.nonce,
        bodyTag: encrypted.tag, contactCiphertext: "secret", contactNonce: "secret", contactTag: "secret",
        visibility: "LEADERS_ONLY", status: "NEW", createdAt: new Date("2026-09-28T00:00:00Z"),
        assignedSlot: null, claimedAt: null, completedAt: null }];
    },
    auditViews: async (user, ids) => audits.push({ user, ids })
  });
  const response = res();
  await handler(req("GET", null, { status: "NEW" }), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.items[0], { id: "p1", body: "请为家人守望", visibility: "LEADERS_ONLY",
    status: "NEW", createdAt: "2026-09-28T00:00:00.000Z", assignedSlot: null, claimedAt: null, completedAt: null });
  assert.equal(audits.length, 1);
  assert.deepEqual({ id: audits[0].user.id, role: audits[0].user.role, slot: audits[0].user.slot }, { id: "leader-1", role: "publisher", slot: "IMS" });
  assert.deepEqual(audits[0].ids, ["p1"]);
  assert.equal(JSON.stringify(audits).includes("请为"), false);
  assert.equal(JSON.stringify(response.body).includes("secret"), false);
});

test("claim identity comes only from session and conflicts remain quiet", async () => {
  const prayerId = "1c1b58a9-1358-4d1f-946f-21ad41d59624";
  const calls = [];
  const handler = actionModule.createPrayerActionHandler({
    applyAction: async (user, prayerId, action) => { calls.push({ user, prayerId, action }); return { changed: true }; },
    auditAction: async () => {}
  });
  let response = res();
  await handler(req("POST", { prayerId, action: "CLAIM", assignedSlot: "HD", claimedBy: "attacker" }), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual({ id: calls[0].user.id, role: calls[0].user.role, slot: calls[0].user.slot }, { id: "leader-1", role: "publisher", slot: "IMS" });
  assert.equal(calls[0].prayerId, prayerId);
  assert.equal(calls[0].action, "CLAIM");

  const conflict = actionModule.createPrayerActionHandler({ applyAction: async () => ({ changed: false }), auditAction: async () => {} });
  response = res();
  await conflict(req("POST", { prayerId, action: "CLAIM" }), response);
  assert.equal(response.statusCode, 409);
});

test("complete uses the authenticated slot and successful actions are audited without content", async () => {
  const audits = [];
  const handler = actionModule.createPrayerActionHandler({
    applyAction: async (user, prayerId, action) => {
      assert.equal(user.slot, "IMS"); assert.equal(action, "COMPLETE"); return { changed: true };
    },
    auditAction: async (user, prayerId, action) => audits.push({ user, prayerId, action })
  });
  const response = res();
  await handler(req("POST", { prayerId: "1c1b58a9-1358-4d1f-946f-21ad41d59624", action: "COMPLETE" }), response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, { ok: true });
  assert.equal(JSON.stringify(audits).includes("body"), false);
});

test("admin endpoints expose only generic service errors", async () => {
  let response = res();
  await listModule.createPrayerListHandler({ listPrayers: async () => { throw new Error("database secret"); } })(req("GET", null, { status: "NEW" }), response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, { ok: false, reason: "prayer_service_unavailable" });
  response = res();
  await actionModule.createPrayerActionHandler({ applyAction: async () => { throw new Error("database secret"); } })(req("POST", { prayerId: crypto.randomUUID(), action: "CLAIM" }), response);
  assert.equal(response.statusCode, 503);
  assert.equal(JSON.stringify(response.body).includes("secret"), false);
});
