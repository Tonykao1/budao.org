const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "leader-route-test-secret-at-least-32-bytes";
process.env.GITHUB_TOKEN = "leader-route-test-token";
process.env.GITHUB_PUBLISH_BRANCH = "main";

function passwordHash(password, saltText) {
  const salt = Buffer.from(saltText);
  const hash = crypto.scryptSync(password, salt, 32).toString("base64url");
  return "scrypt$" + salt.toString("base64url") + "$" + hash;
}

function freshAuth(users) {
  process.env.BUDAO_ADMIN_USERS_JSON = JSON.stringify(users);
  const modulePath = require.resolve("../api/_security/auth");
  delete require.cache[modulePath];
  return require(modulePath);
}

function signedCookie(id, username) {
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org",
    aud: "budao-admin",
    sub: id,
    username,
    role: "publisher",
    slot: "IMS",
    exp: Math.floor(Date.now() / 1000) + 600
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.BUDAO_SESSION_SECRET).update(payload).digest("base64url");
  return "budao_admin_session=" + payload + "." + signature;
}

function request(body, cookie) {
  return {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://budao.test",
      host: "budao.test",
      cookie,
      "x-forwarded-for": "192.0.2.44"
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

test("leader usernames authenticate case-insensitively and session identity is leader-based", () => {
  const auth = freshAuth([
    { id: "leader-tony", username: "tony", passwordHash: passwordHash("shared-test-password", "tony-salt") }
  ]);

  const lower = auth.authenticateCredentials("tony", "shared-test-password");
  const mixed = auth.authenticateCredentials("Tony", "shared-test-password");
  const wrong = auth.authenticateCredentials("tony", "wrong-password");

  assert.equal(lower.id, "leader-tony");
  assert.equal(lower.username, "tony");
  assert.equal(lower.role, "publisher");
  assert.equal(mixed.id, "leader-tony");
  assert.equal(wrong, null);
});

test("public route projection chooses the next three events and assigns presentation slots by time", () => {
  const routesModulePath = require.resolve("../api/routes");
  delete require.cache[routesModulePath];
  const routesApi = require(routesModulePath);
  assert.equal(typeof routesApi.projectPublicRoutes, "function");

  const routes = [
    { routeId: "late", leaderId: "l4", date: "2026-10-05", time: "09:00", timezone: "Asia/Shanghai", title: "Late" },
    { routeId: "first", leaderId: "l1", date: "2026-10-03", time: "10:00", timezone: "Asia/Shanghai", title: "First" },
    { routeId: "third", leaderId: "l3", date: "2026-10-04", time: "08:00", timezone: "Asia/Shanghai", title: "Third" },
    { routeId: "second", leaderId: "l2", date: "2026-10-03", time: "15:00", timezone: "Asia/Shanghai", title: "Second" },
    { routeId: "past", leaderId: "old", date: "2026-10-01", time: "09:00", timezone: "Asia/Shanghai", title: "Past" }
  ];

  const projected = routesApi.projectPublicRoutes(routes, new Date("2026-10-03T00:00:00Z"));
  assert.deepEqual(projected.map((route) => route.routeId), ["first", "second", "third"]);
  assert.deepEqual(projected.map((route) => route.slot), ["IMS", "BACBC", "HD"]);
});

test("different leaders publish separate routes instead of overwriting a fixed slot", async () => {
  const rateLimit = require("../api/_security/rate-limit");
  rateLimit.resetForTests();
  const modulePath = require.resolve("../api/publish-route-v2");
  delete require.cache[modulePath];
  const publish = require(modulePath);

  let stored = Buffer.from("[]").toString("base64");
  global.fetch = async (_url, options) => {
    if (!options || options.method === "GET") {
      return { ok: true, status: 200, json: async () => ({ sha: "routes-sha", content: stored }) };
    }
    stored = JSON.parse(options.body).content;
    return { ok: true, status: 200, json: async () => ({ commit: { sha: "commit-sha" } }) };
  };

  const tony = response();
  await publish(request({ title: "Tony Route", date: "2026-10-04", time: "09:00", timezone: "Asia/Shanghai" }, signedCookie("leader-tony", "tony")), tony);
  assert.equal(tony.statusCode, 200);

  const moses = response();
  await publish(request({ title: "Moses Route", date: "2026-10-05", time: "09:00", timezone: "Asia/Shanghai" }, signedCookie("leader-moses", "moses")), moses);
  assert.equal(moses.statusCode, 200);

  const routes = JSON.parse(Buffer.from(stored, "base64").toString("utf8"));
  assert.equal(routes.length, 2);
  assert.deepEqual(routes.map((route) => route.leaderId).sort(), ["leader-moses", "leader-tony"]);
  assert.deepEqual(routes.map((route) => route.leader).sort(), ["moses", "tony"]);
});

test("route image uploads are namespaced by leader username", async () => {
  const rateLimit = require("../api/_security/rate-limit");
  rateLimit.resetForTests();
  const modulePath = require.resolve("../api/upload-route-image");
  delete require.cache[modulePath];
  const upload = require(modulePath);
  let putUrl = "";
  global.fetch = async (url) => {
    putUrl = String(url);
    return { ok: true, status: 200, json: async () => ({ content: { sha: "image" } }) };
  };
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  const res = response();
  await upload(request({ mimeType: "image/png", data: png }, signedCookie("leader-tony", "tony")), res);
  assert.equal(res.statusCode, 200);
  assert.match(putUrl, /\/route-assets\/tony\//);
});

test("Tent login is a username field and private route reads use scope=mine", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "tent.html"), "utf8");
  assert.match(source, /<span>Username<\/span>\s*<input name="email" type="text"/);
  assert.match(source, /scope=mine/);
});
