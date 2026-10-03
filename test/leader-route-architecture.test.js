const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "leader-route-test-secret-at-least-32-bytes";

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
