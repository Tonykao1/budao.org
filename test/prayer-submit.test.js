const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

process.env.NODE_ENV = "test";
process.env.BUDAO_PRAYER_DATA_KEY = Buffer.alloc(32, 11).toString("base64url");

const submitModule = require("../api/_security/prayer-submit-handler");
const { createPrayerRequest } = require("../api/_security/prayer-store");

function request(body, overrides = {}) {
  return {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://budao.test",
      host: "budao.test",
      ...(overrides.headers || {})
    },
    ...overrides,
    headers: {
      "content-type": "application/json",
      origin: "https://budao.test",
      host: "budao.test",
      ...(overrides.headers || {})
    }
  };
}

function response() {
  return {
    headers: {}, statusCode: 0, body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function handlerHarness(overrides = {}) {
  const records = [];
  const handler = submitModule.createPrayerSubmitHandler({
    dataKey: process.env.BUDAO_PRAYER_DATA_KEY,
    createPrayer: async (record) => {
      records.push(record);
      return { created: true };
    },
    randomReceipt: () => "receipt_test_value",
    consumeRate: () => true,
    ...overrides
  });
  return { handler, records };
}

test("public prayer endpoint only accepts JSON POST from the same origin", async () => {
  const { handler, records } = handlerHarness();

  let res = response();
  await handler(request({}, { method: "GET" }), res);
  assert.equal(res.statusCode, 405);

  res = response();
  await handler(request({}, { headers: { "content-type": "text/plain" } }), res);
  assert.equal(res.statusCode, 415);

  res = response();
  await handler(request({ body: "请记念", idempotencyKey: "1234567890abcdef" }, {
    headers: { origin: "https://evil.test" }
  }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(records.length, 0);
});

test("valid anonymous prayer is encrypted with leader-only privacy by default", async () => {
  const { handler, records } = handlerHarness();
  const res = response();
  await handler(request({
    body: "请为我的家人记念",
    idempotencyKey: "1234567890abcdef"
  }), res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { ok: true, receipt: "receipt_test_value" });
  assert.equal(res.headers["cache-control"], "no-store");
  assert.equal(records.length, 1);
  assert.equal(records[0].visibility, "LEADERS_ONLY");
  assert.equal(records[0].wantsReply, false);
  assert.equal(records[0].contactCiphertext, null);
  assert.equal(JSON.stringify(records[0]).includes("请为我的家人记念"), false);
  assert.equal(records[0].idempotencyKeyHash.length, 64);
});

test("reply contact is encrypted and trusted-team scope requires explicit input", async () => {
  const { handler, records } = handlerHarness();
  const res = response();
  await handler(request({
    body: "愿有人同行",
    visibility: "TRUSTED_TEAM",
    wantsReply: true,
    contact: "quiet@example.test",
    idempotencyKey: "abcdef1234567890"
  }), res);

  assert.equal(res.statusCode, 201);
  assert.equal(records[0].visibility, "TRUSTED_TEAM");
  assert.equal(records[0].wantsReply, true);
  assert.equal(typeof records[0].contactCiphertext, "string");
  assert.equal(JSON.stringify(records[0]).includes("quiet@example.test"), false);
});

test("invalid body, missing reply contact and malformed idempotency key do not write", async () => {
  const { handler, records } = handlerHarness();
  const inputs = [
    { body: " ", idempotencyKey: "1234567890abcdef" },
    { body: "愿".repeat(1001), idempotencyKey: "1234567890abcdef" },
    { body: "请记念", wantsReply: true, contact: "", idempotencyKey: "1234567890abcdef" },
    { body: "请记念", idempotencyKey: "short" }
  ];
  for (const input of inputs) {
    const res = response();
    await handler(request(input), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(records.length, 0);
});

test("honeypot submissions receive a quiet receipt without persistence", async () => {
  const { handler, records } = handlerHarness();
  const res = response();
  await handler(request({
    body: "automated",
    website: "https://spam.test",
    idempotencyKey: "1234567890abcdef"
  }), res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.equal(records.length, 0);
});

test("shared submission throttling rejects excess requests before persistence", async () => {
  const { handler, records } = handlerHarness({ consumeRate: async () => false });
  const res = response();
  await handler(request({ body: "请记念", idempotencyKey: "1234567890abcdef" }), res);
  assert.equal(res.statusCode, 429);
  assert.equal(records.length, 0);
});

test("database and encryption configuration failures return a generic unavailable response", async () => {
  for (const overrides of [
    { dataKey: "invalid" },
    { createPrayer: async () => { throw new Error("database contained sensitive detail"); } }
  ]) {
    const { handler } = handlerHarness(overrides);
    const res = response();
    await handler(request({ body: "请记念", idempotencyKey: "1234567890abcdef" }), res);
    assert.equal(res.statusCode, 503);
    assert.deepEqual(res.body, { ok: false, reason: "prayer_service_unavailable" });
    assert.equal(JSON.stringify(res.body).includes("sensitive"), false);
  }
});

test("prayer store turns a repeated idempotency hash into a successful duplicate", async () => {
  const valuesSeen = [];
  const db = {
    insert() {
      return {
        values(value) {
          valuesSeen.push(value);
          return {
            onConflictDoNothing() {
              return { returning: async () => valuesSeen.length === 1 ? [{ id: crypto.randomUUID() }] : [] };
            }
          };
        }
      };
    }
  };

  assert.deepEqual(await createPrayerRequest(db, { idempotencyKeyHash: "a".repeat(64) }), { created: true });
  assert.deepEqual(await createPrayerRequest(db, { idempotencyKeyHash: "a".repeat(64) }), { created: false });
});
