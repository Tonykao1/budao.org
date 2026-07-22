const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "test-only-session-secret-at-least-32-bytes";
process.env.GITHUB_TOKEN = "test-token-never-logged";
process.env.GITHUB_PUBLISH_BRANCH = "security/content-publishing";

const salt = Buffer.from("fixed-test-salt");
const hash = crypto.scryptSync("unique-test-password", salt, 32).toString("base64url");
process.env.BUDAO_ADMIN_USERS_JSON = JSON.stringify([{
  id: "publisher-ims", email: "publisher@example.test",
  passwordHash: "scrypt$" + salt.toString("base64url") + "$" + hash, slot: "IMS"
}]);

const login = require("../api/auth/login");
const publish = require("../api/publish-route");
const publishV2 = require("../api/publish-route-v2");
const disabledPublish = require("../api/publish");
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

test.beforeEach(() => resetForTests());

test("schema modules load", () => assert.equal(validateRoute({ title: "Safe route" }).value.title, "Safe route"));

test("anonymous users cannot publish", async () => {
  for (const handler of [publish, publishV2]) {
    const res = response();
    await handler(request({ title: "No" }), res);
    assert.equal(res.statusCode, 401);
  }
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

test("valid publisher writes only the controlled branch and repeat content is idempotent", async () => {
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
  assert.equal(upstream.branch, "security/content-publishing");
  assert.equal(put.url.includes("/contents/routes.json"), true);
  assert.equal(JSON.stringify(first.body).includes(process.env.GITHUB_TOKEN), false);

  const second = response();
  await publish(request({ title: "Authorized route" }, { headers: { cookie } }), second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(calls.filter((call) => call.options && call.options.method === "PUT").length, 1);
});

test("server configuration fails closed when publishing branch is main", async () => {
  const cookie = await loginCookie();
  const modulePath = require.resolve("../api/publish-route-v2");
  delete require.cache[modulePath];
  process.env.GITHUB_PUBLISH_BRANCH = "main";
  const mainPublisher = require(modulePath);
  const res = response();
  await mainPublisher(request({ title: "Never main" }, { headers: { cookie } }), res);
  assert.equal(res.statusCode, 503);
  process.env.GITHUB_PUBLISH_BRANCH = "security/content-publishing";
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
  for (const file of ["app.js", "tent-app.js", "tent.html"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.equal(/Budao2026|GITHUB_TOKEN|BUDAO_SESSION_SECRET/.test(source), false);
  }
});
