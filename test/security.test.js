const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "test-only-session-secret-at-least-32-bytes";
process.env.GITHUB_TOKEN = "test-token-never-logged";
process.env.GITHUB_PUBLISH_BRANCH = "main";
process.env.GITHUB_BRANCH = "main";

const salt = Buffer.from("fixed-test-salt");
const hash = crypto.scryptSync("unique-test-password", salt, 32).toString("base64url");
process.env.BUDAO_ADMIN_USERS_JSON = JSON.stringify([{
  id: "publisher-ims", email: "publisher@example.test",
  passwordHash: "scrypt$" + salt.toString("base64url") + "$" + hash, slot: "IMS"
}]);
process.env.STEWARDSHIP_OPERATOR_USER_ID = "publisher-ims";

const login = require("../api/auth/login");
const legacyPublish = require("../api/publish-route");
const publish = require("../api/publish-route-v2");
const disabledPublish = require("../api/publish");
const eebee = require("../api/eebee");
const { resetForTests } = require("../api/_security/rate-limit");
const { validateRoute } = require("../api/_security/route-schema");

function request(body, overrides = {}) {
  const { headers = {}, ...rest } = overrides;
  return {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://budao.test",
      host: "budao.test",
      "x-forwarded-for": "192.0.2.10",
      ...headers
    },
    ...rest
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

async function loginCookie() {
  const res = response();
  await login(request({ email: "publisher@example.test", password: "unique-test-password" }), res);
  assert.equal(res.statusCode, 200);
  return res.headers["set-cookie"].split(";")[0];
}

function signedPublisherCookie(sub = "publisher-ims", slot = "IMS") {
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org", aud: "budao-admin", sub, role: "publisher", slot,
    exp: Math.floor(Date.now() / 1000) + 600
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.BUDAO_SESSION_SECRET).update(payload).digest("base64url");
  return "budao_admin_session=" + payload + "." + signature;
}

test.beforeEach(() => resetForTests());
test.beforeEach(() => { delete global.__lastEebeeEmail; });

test("schema modules load", () => assert.equal(validateRoute({ title: "Safe route" }).value.title, "Safe route"));

test("anonymous users cannot publish", async () => {
  const res = response();
  await publish(request({ title: "No" }), res);
  assert.equal(res.statusCode, 401);
  const legacy = response();
  await legacyPublish(request({ title: "No" }), legacy);
  assert.equal(legacy.statusCode, 409);
  const tombstone = response();
  await disabledPublish(request({ title: "No" }), tombstone);
  assert.equal(tombstone.statusCode, 410);
});

test("ordinary or client-forged session cannot publish", async () => {
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org", aud: "budao-admin", sub: "ordinary", role: "user", slot: "IMS",
    exp: Math.floor(Date.now() / 1000) + 600
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.BUDAO_SESSION_SECRET).update(payload).digest("base64url");
  const res = response();
  await publish(request({ title: "No" }, { headers: { cookie: "budao_admin_session=" + payload + "." + signature } }), res);
  assert.equal(res.statusCode, 401);
});

test("unknown sensitive targets and overlong fields are rejected", async () => {
  const cookie = await loginCookie();
  for (const body of [
    { title: "No", branch: "main" },
    { title: "No", repository: "someone/else" },
    { title: "No", path: "api/pwn.js" },
    { title: "No", owner: "IMS@budao.org" },
    { title: "x".repeat(161) }
  ]) {
    const res = response();
    await publish(request(body, { headers: { cookie } }), res);
    assert.equal(res.statusCode, 400);
  }
});

test("oversized and wrong-content-type requests are rejected", async () => {
  let res = response();
  await publish(request(JSON.stringify({ title: "x", description: "x".repeat(50_000) })), res);
  assert.equal(res.statusCode, 413);
  res = response();
  await publish(request({ title: "x" }, { headers: { "content-type": "text/plain" } }), res);
  assert.equal(res.statusCode, 415);
});

test("valid publisher writes the shared routes branch and repeat content is idempotent", async () => {
  const cookie = await loginCookie();
  const calls = [];
  let storedContent = Buffer.from("[]").toString("base64");
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (!options || options.method === "GET") {
      return { ok: true, status: 200, json: async () => ({ sha: "abc", content: storedContent }) };
    }
    storedContent = JSON.parse(options.body).content;
    return { ok: true, status: 200, json: async () => ({ commit: { sha: "def" } }) };
  };
  const first = response();
  await publish(request({ title: "Authorized route" }, { headers: { cookie } }), first);
  assert.equal(first.statusCode, 200);
  const put = calls.find((call) => call.options && call.options.method === "PUT");
  assert.ok(put);
  const upstream = JSON.parse(put.options.body);
  assert.equal(upstream.branch, "main");
  assert.equal(put.url.includes("/contents/routes.json"), true);
  assert.equal(JSON.stringify(first.body).includes(process.env.GITHUB_TOKEN), false);

  const second = response();
  await publish(request({ title: "Authorized route" }, { headers: { cookie } }), second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(calls.filter((call) => call.options && call.options.method === "PUT").length, 1);
});

test("server configuration fails closed without a publishing token", async () => {
  const cookie = await loginCookie();
  const modulePath = require.resolve("../api/publish-route-v2");
  delete require.cache[modulePath];
  const token = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  const unavailablePublisher = require(modulePath);
  const res = response();
  await unavailablePublisher(request({ title: "No token" }, { headers: { cookie } }), res);
  assert.equal(res.statusCode, 503);
  process.env.GITHUB_TOKEN = token;
  delete require.cache[modulePath];
});

test("publisher rate limit returns 429", async () => {
  const cookie = await loginCookie();
  global.fetch = async (_url, options) => !options || options.method === "GET"
    ? { ok: true, status: 200, json: async () => ({ sha: "abc", content: Buffer.from("[]").toString("base64") }) }
    : { ok: true, status: 200, json: async () => ({ commit: { sha: "def" } }) };
  let last;
  for (let index = 0; index < 11; index += 1) {
    last = response();
    await publish(request({ title: "Route " + index }, { headers: { cookie } }), last);
  }
  assert.equal(last.statusCode, 429);
});

test("client assets contain no hard-coded admin password or GitHub token", () => {
  for (const file of ["tent-app.js", "tent.html"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.equal(/Budao2026|GITHUB_TOKEN|BUDAO_SESSION_SECRET/.test(source), false);
  }
});

test("eebee only allows configured operator to create offerings", async () => {
  const cookie = await loginCookie();
  let stored = Buffer.from(JSON.stringify({ users: [], resources: [], offerings: [], applications: [], handovers: [], impacts: [] })).toString("base64");
  global.fetch = async (_url, options) => {
    if (!options || options.method === "GET") {
      return { ok: true, status: 200, json: async () => ({ sha: "eebee-sha", content: stored }) };
    }
    stored = JSON.parse(options.body).content;
    return { ok: true, status: 200, json: async () => ({ commit: { sha: "eebee-commit" } }) };
  };
  const res = response();
  await eebee(request({
    action: "saveOffering",
    title: "一件真实资源",
    description: "可以继续产生益处的资源。",
    reasonForOffering: "愿它继续被使用。",
    recipientExpectation: "愿承接者好好照顾。",
    status: "OPEN"
  }, { headers: { cookie } }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(JSON.parse(Buffer.from(stored, "base64").toString("utf8")).offerings[0].status, "OPEN");

  const forbidden = response();
  await eebee(request({ action: "saveOffering", title: "No" }, { headers: { cookie: signedPublisherCookie("someone-else") } }), forbidden);
  assert.equal(forbidden.statusCode, 403);
});

test("eebee email verification creates one stable code and secure session before duplicate applications", async () => {
  let data = {
    users: [],
    sessions: [],
    emailVerifications: [],
    resources: [{ id: "res_1", title: "背包", description: "一个背包", condition: "良好", category: "户外", images: [], createdByUserId: "publisher-ims", currentStewardUserId: "publisher-ims", createdAt: "now", updatedAt: "now" }],
    offerings: [{ id: "off_1", resourceId: "res_1", publisherUserId: "publisher-ims", reasonForOffering: "继续使用", recipientExpectation: "照顾它", status: "OPEN", publishedAt: "now", closedAt: "", createdAt: "now", updatedAt: "now" }],
    applications: [],
    handovers: [],
    impacts: []
  };
  let stored = Buffer.from(JSON.stringify(data)).toString("base64");
  global.fetch = async (_url, options) => {
    if (!options || options.method === "GET") {
      return { ok: true, status: 200, json: async () => ({ sha: "eebee-sha", content: stored }) };
    }
    stored = JSON.parse(options.body).content;
    data = JSON.parse(Buffer.from(stored, "base64").toString("utf8"));
    return { ok: true, status: 200, json: async () => ({ commit: { sha: "eebee-commit" } }) };
  };

  const directRegister = response();
  await eebee(request({ action: "register", displayName: "同行者" }), directRegister);
  assert.equal(directRegister.statusCode, 400);

  const requested = response();
  await eebee(request({ action: "requestEmailCode", email: "walker@example.test", displayName: "同行者", principlesAccepted: true }), requested);
  assert.equal(requested.statusCode, 200);
  assert.equal(requested.body.sent, true);
  assert.equal(global.__lastEebeeEmail.email, "walker@example.test");
  assert.equal(data.users.length, 0);

  const verify = response();
  await eebee(request({ action: "verifyEmailCode", email: "walker@example.test", displayName: "同行者", principlesAccepted: true, code: global.__lastEebeeEmail.code }), verify);
  assert.equal(verify.statusCode, 200);
  assert.match(verify.body.user.entrustedCode, /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/);
  const userCookie = verify.headers["set-cookie"].split(";")[0];
  assert.equal(userCookie.includes(data.users[0].id), false);
  assert.equal(data.sessions.length, 1);
  assert.ok(data.sessions[0].tokenHash);
  assert.equal(data.sessions[0].tokenHash.includes(userCookie.split("=")[1]), false);

  const first = response();
  await eebee(request({ action: "apply", offeringId: "off_1", reason: "我需要它同行", intendedUse: "会在步道中使用并照顾", offlineHandoverAccepted: true }, { headers: { cookie: userCookie } }), first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.duplicate, false);

  const second = response();
  await eebee(request({ action: "apply", offeringId: "off_1", reason: "重复申请", intendedUse: "重复计划", offlineHandoverAccepted: true }, { headers: { cookie: userCookie } }), second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.duplicate, true);
  assert.equal(data.users.length, 1);
  assert.equal(data.applications.length, 1);
});

test("eebee handover requires selection and completion before impact", async () => {
  const cookie = await loginCookie();
  let data = {
    users: [{ id: "user_1", eebeeCode: "EB-23456789AB", displayName: "同行者", contactNote: "", createdAt: "now", updatedAt: "now" }],
    resources: [{ id: "res_1", title: "背包", description: "一个背包", condition: "良好", category: "户外", images: [], createdByUserId: "publisher-ims", currentStewardUserId: "publisher-ims", createdAt: "now", updatedAt: "now" }],
    offerings: [{ id: "off_1", resourceId: "res_1", publisherUserId: "publisher-ims", reasonForOffering: "继续使用", recipientExpectation: "照顾它", status: "OPEN", publishedAt: "now", closedAt: "", createdAt: "now", updatedAt: "now" }],
    applications: [{ id: "app_1", offeringId: "off_1", applicantUserId: "user_1", applicantEebeeCode: "EB-23456789AB", reason: "需要", intendedUse: "照顾", additionalNote: "", offlineHandoverAccepted: true, status: "APPLIED", createdAt: "now", updatedAt: "now" }],
    handovers: [],
    impacts: []
  };
  let stored = Buffer.from(JSON.stringify(data)).toString("base64");
  global.fetch = async (_url, options) => {
    if (!options || options.method === "GET") {
      return { ok: true, status: 200, json: async () => ({ sha: "eebee-sha", content: stored }) };
    }
    stored = JSON.parse(options.body).content;
    data = JSON.parse(Buffer.from(stored, "base64").toString("utf8"));
    return { ok: true, status: 200, json: async () => ({ commit: { sha: "eebee-commit" } }) };
  };

  const blocked = response();
  await eebee(request({ action: "scheduleHandover", offeringId: "off_1", eventId: "budao-ims", eventTitle: "百望山" }, { headers: { cookie } }), blocked);
  assert.equal(blocked.statusCode, 409);

  const select = response();
  await eebee(request({ action: "selectApplication", applicationId: "app_1" }, { headers: { cookie } }), select);
  assert.equal(select.statusCode, 200);
  const schedule = response();
  await eebee(request({ action: "scheduleHandover", offeringId: "off_1", eventId: "budao-ims", eventTitle: "百望山" }, { headers: { cookie } }), schedule);
  assert.equal(schedule.statusCode, 200);

  const earlyImpact = response();
  await eebee(request({ action: "saveImpact", handoverId: data.handovers[0].id, recipientReflection: "感谢", publisherConfirmation: "完成" }, { headers: { cookie } }), earlyImpact);
  assert.equal(earlyImpact.statusCode, 409);

  const confirm = response();
  await eebee(request({ action: "confirmHandover", offeringId: "off_1" }, { headers: { cookie } }), confirm);
  assert.equal(confirm.statusCode, 200);
  const impact = response();
  await eebee(request({ action: "saveImpact", handoverId: data.handovers[0].id, recipientReflection: "感谢", publisherConfirmation: "完成" }, { headers: { cookie } }), impact);
  assert.equal(impact.statusCode, 200);
  assert.equal(data.impacts.length, 1);
});
