const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "altar-v1-test-secret-at-least-32-bytes";

test("Tony is steward and other leaders are not", () => {
  const authPath = require.resolve("../api/_security/auth");
  delete require.cache[authPath];
  const auth = require(authPath);
  assert.equal(typeof auth.isSteward, "function");
  assert.equal(auth.isSteward({ username: "tony", role: "publisher" }), true);
  assert.equal(auth.isSteward({ username: "moses", role: "publisher" }), false);
  assert.equal(auth.isSteward({ username: "TONY", role: "publisher" }), true);
});

test("session source exposes steward capability from server auth", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "api", "auth", "session.js"), "utf8");
  assert.match(source, /isSteward/);
  assert.match(source, /capabilities\s*:\s*\{\s*steward\s*:/);
});

test("altar supervision pure state supports pause lock needs_changes restore with audit", () => {
  const store = require("../api/_altar/store");
  assert.equal(typeof store.defaultAltarState, "function");
  let state = store.defaultAltarState();
  state = store.applySupervisionAction(state, { routeId: "r1", action: "pause", actor: "tony", timestamp: "2026-10-05T10:00:00.000Z", reason: "review" });
  assert.equal(store.routeSupervision(state, "r1").status, "paused");
  assert.equal(state.audit.length, 1);
  state = store.applySupervisionAction(state, { routeId: "r1", action: "lock", actor: "tony", timestamp: "2026-10-05T10:01:00.000Z" });
  assert.equal(store.routeSupervision(state, "r1").locked, true);
  state = store.applySupervisionAction(state, { routeId: "r1", action: "needs_changes", actor: "tony", timestamp: "2026-10-05T10:02:00.000Z" });
  assert.equal(store.routeSupervision(state, "r1").status, "needs_changes");
  state = store.applySupervisionAction(state, { routeId: "r1", action: "restore", actor: "tony", timestamp: "2026-10-05T10:03:00.000Z" });
  const restored = store.routeSupervision(state, "r1");
  assert.equal(restored.status, "active");
  assert.equal(restored.locked, false);
  assert.equal(state.audit.length, 4);
  assert.equal(store.routeSupervision(state, "missing").status, "active");
});

test("public route projection can exclude supervised routes without mutating canonical data", () => {
  const routesApi = require("../api/routes");
  const canonical = [
    { routeId: "paused", date: "2026-10-10", time: "09:00", timezone: "Asia/Shanghai", title: "Paused" },
    { routeId: "active", date: "2026-10-11", time: "09:00", timezone: "Asia/Shanghai", title: "Active" }
  ];
  const projected = routesApi.projectPublicRoutes(canonical, new Date("2026-10-09T00:00:00Z"), {
    paused: { status: "paused", locked: false },
    active: { status: "active", locked: false }
  });
  assert.deepEqual(projected.map((r) => r.routeId), ["active"]);
  assert.equal(canonical[0].slot, undefined);
});

test("Tent creates a humble altar cornerstone from steward capability, not username", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "tent-word.js"), "utf8");
  assert.match(source, /altar-cornerstone/);
  assert.match(source, /label\.textContent\s*=\s*["']祭坛["']/);
  assert.match(source, /capabilities\s*&&\s*session\.capabilities\.steward\s*===\s*true/);
  assert.doesNotMatch(source, /username\s*===\s*["']tony["']/i);
  assert.match(source, /right:50px/);
  assert.match(source, /bottom:40px/);
  assert.match(source, /window\.location\.href\s*=\s*["']\/altar\.html["']/);
});

test("altar page uses the protected consolidated routes function", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "altar.html"), "utf8");
  const js = fs.readFileSync(path.join(__dirname, "..", "altar-app.js"), "utf8");
  const routesApi = fs.readFileSync(path.join(__dirname, "..", "api", "routes.js"), "utf8");
  assert.match(html, /祭坛/);
  assert.match(js, /\/api\/routes\?scope=altar/);
  assert.match(routesApi, /scope\s*===\s*["']altar["']/);
  assert.match(routesApi, /isSteward/);
  assert.match(routesApi, /needs_changes/);
  assert.match(routesApi, /pause/);
  assert.match(routesApi, /lock/);
  assert.match(routesApi, /restore/);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "api", "altar", "routes.js")), false);
  assert.equal(fs.existsSync(path.join(__dirname, "..", "api", "altar", "action.js")), false);
});
