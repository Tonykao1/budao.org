"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.BUDAO_SESSION_SECRET = "mobile-tent-publishing-tests-with-32-plus-characters";
process.env.GITHUB_TOKEN = "fake-token-for-local-fetch-mocks";
process.env.GITHUB_PUBLISH_BRANCH = "main";

const publish = require("../api/publish-route-v2");
const upload = require("../api/upload-route-image");
const routesApi = require("../api/routes");
const { routeWriteBlockReason } = require("../api/_security/route-write-target");
const { validateMobileRoutePublish } = require("../api/_security/mobile-route-publish");

function cookie(user = "tony", id = "leader-tony") {
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org", aud: "budao-admin", sub: id, username: user,
    role: "publisher", slot: "IMS", exp: Math.floor(Date.now() / 1000) + 600
  })).toString("base64url");
  const mac = crypto.createHmac("sha256", process.env.BUDAO_SESSION_SECRET)
    .update(payload).digest("base64url");
  return "budao_admin_session=" + payload + "." + mac;
}
function req(body, extra = {}) {
  return {
    method: "POST", url: "/api/publish-route-v2", body,
    headers: Object.assign({
      host: "budao.org", origin: "https://budao.org",
      cookie: cookie(), "content-type": "application/json",
      "x-budao-mobile-tent": "1"
    }, extra)
  };
}
function res() {
  return {
    statusCode: 0, body: null, headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { return this; }
  };
}
function route(overrides = {}) {
  return Object.assign({
    title: "掌上帐篷安全验收线路", date: "2027-12-11", time: "09:00",
    timezone: "Asia/Shanghai", calendarType: "budao",
    country: "中国", city: "北京", region: "顺义",
    location: "中国 · 北京 · 顺义", surface: "林间土路",
    meetingPlace: "天竺停车场南门",
    description: "手机填写与真实发布接口自动化验收",
    qrCode: ""
  }, overrides);
}
function githubFixture(initial = []) {
  const state = { routes: structuredClone(initial), sha: "data-sha-1", writes: 0, conflict: false, requests: [] };
  state.fetch = async (url, options = {}) => {
    const method = options.method || "GET";
    state.requests.push({ url: String(url), method, body: options.body });
    if (!String(url).includes("/contents/routes.json")) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    if (method === "PUT") {
      if (state.conflict) return { ok: false, status: 409, json: async () => ({}) };
      const data = JSON.parse(options.body);
      assert.equal(data.branch, "main", "test must only target mocked main");
      assert.equal(data.sha, state.sha, "optimistic GitHub write must be versioned");
      const next = JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
      assert.ok(Array.isArray(next));
      state.routes = next;
      state.writes += 1;
      state.sha = "data-sha-" + (state.writes + 1);
      return {
        ok: true, status: 200,
        json: async () => ({ commit: { sha: "test-commit-" + state.writes } })
      };
    }
    return {
      ok: true, status: 200,
      json: async () => ({
        sha: state.sha,
        content: Buffer.from(JSON.stringify(state.routes)).toString("base64")
      })
    };
  };
  return state;
}
async function withMockedGitHub(initial, action) {
  const previous = {
    fetch: global.fetch,
    vercelEnv: process.env.VERCEL_ENV,
    vercel: process.env.VERCEL,
    ref: process.env.VERCEL_GIT_COMMIT_REF
  };
  const state = githubFixture(initial);
  global.fetch = state.fetch;
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.VERCEL_GIT_COMMIT_REF = "main";
  try { await action(state); }
  finally {
    global.fetch = previous.fetch;
    if (previous.vercelEnv === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = previous.vercelEnv;
    if (previous.vercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = previous.vercel;
    if (previous.ref === undefined) delete process.env.VERCEL_GIT_COMMIT_REF;
    else process.env.VERCEL_GIT_COMMIT_REF = previous.ref;
  }
}

test("route write target disallows previews, unsafe branch and unknown Vercel environment", () => {
  assert.equal(routeWriteBlockReason("main", { VERCEL: "1", VERCEL_ENV: "preview" }), "preview_write_disabled");
  assert.equal(routeWriteBlockReason("main", { VERCEL: "1" }), "preview_write_disabled");
  assert.equal(routeWriteBlockReason("main", { VERCEL: "1", VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "feat/test" }), "publish_target_mismatch");
  assert.equal(routeWriteBlockReason("preview-branch", { VERCEL: "1", VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "main" }), "publish_target_mismatch");
  assert.equal(routeWriteBlockReason("main", { VERCEL: "1", VERCEL_ENV: "production",
    VERCEL_GIT_COMMIT_REF: "main" }), "");
});

test("mobile publish accepts canonical geography and rejects missing or forged parts", () => {
  assert.equal(validateMobileRoutePublish(route()), "");
  assert.equal(validateMobileRoutePublish(route({ surface: "" })), "missing_required_field");
  assert.equal(validateMobileRoutePublish(route({ country: "中国", location: "美国 · 北京 · 顺义" })), "invalid_location");
  assert.equal(validateMobileRoutePublish(route({ region: "顺义·天竺" })), "invalid_location");
  assert.equal(validateMobileRoutePublish(route({ date: "2027-02-30" })), "invalid_date");
  assert.equal(validateMobileRoutePublish(route({ time: "25:30" })), "invalid_time");
});

test("preview publishing, preview upload and preview route status do zero GitHub writes", async () => {
  await withMockedGitHub([], async (state) => {
    process.env.VERCEL_ENV = "preview";
    const p = res();
    await publish(req(route()), p);
    assert.equal(p.statusCode, 403);
    assert.equal(p.body.reason, "preview_write_disabled");
    const image = res();
    await upload({ ...req({ mimeType: "image/png", data: "AAAA" }),
      url: "/api/upload-route-image" }, image);
    assert.equal(image.statusCode, 403);
    assert.equal(image.body.reason, "preview_write_disabled");
    const status = res();
    await routesApi({ ...req({ routeId: "route-id", action: "cancel" }),
      url: "/api/routes?scope=mine" }, status);
    assert.equal(status.statusCode, 403);
    assert.equal(status.body.reason, "preview_write_disabled");
    assert.equal(state.requests.length, 0);
  });
});

test("new mobile route commits once, is owned by signer and appears in public calendar", async () => {
  await withMockedGitHub([], async (state) => {
    const out = res();
    await publish(req(route()), out);
    assert.equal(out.statusCode, 200);
    assert.equal(out.body.ok, true);
    assert.equal(out.body.commit, "test-commit-1");
    assert.equal(state.writes, 1);
    assert.equal(state.routes.length, 1);
    const saved = state.routes[0];
    assert.equal(saved.country, "中国");
    assert.equal(saved.city, "北京");
    assert.equal(saved.region, "顺义");
    assert.equal(saved.location, "中国 · 北京 · 顺义");
    assert.equal(saved.leaderId, "leader-tony");
    assert.equal(saved.leader, "tony");
    assert.ok(saved.routeId.startsWith("budao-leader-tony-"));

    const mine = res();
    await routesApi({ method: "GET", url: "/api/routes?scope=mine-all",
      headers: { cookie: cookie() } }, mine);
    assert.equal(mine.statusCode, 200);
    assert.deepEqual(mine.body.map((x) => x.routeId), [saved.routeId]);

    const calendar = res();
    await routesApi({ method: "GET", url: "/api/routes?scope=calendar", headers: {} }, calendar);
    assert.equal(calendar.statusCode, 200);
    assert.ok(calendar.body.some((x) => x.routeId === saved.routeId));

    const edit = res();
    await publish(req(route({
      id: saved.routeId, routeId: saved.routeId,
      title: "更名后的步道路线", date: "2027-12-12"
    })), edit);
    assert.equal(edit.statusCode, 200);
    assert.equal(edit.body.route.routeId, saved.routeId);
    assert.equal(state.writes, 2);
    assert.equal(state.routes.length, 1);
    assert.equal(state.routes[0].title, "更名后的步道路线");
  });
});

test("mobile publish rejects unauthorized user, forged geography and someone else's routeId", async () => {
  const other = { id: "moses-1", routeId: "moses-1", leaderId: "leader-moses",
    leader: "moses", title: "Other", date: "2027-12-01", time: "09:00" };
  await withMockedGitHub([other], async (state) => {
    const anonymous = res();
    await publish(req(route(), { cookie: "" }), anonymous);
    assert.equal(anonymous.statusCode, 401);

    const forged = res();
    await publish(req(route({ location: "美国 · 北京 · 顺义" })), forged);
    assert.equal(forged.statusCode, 400);
    assert.equal(forged.body.reason, "invalid_location");

    const foreign = res();
    await publish(req(route({ id: "moses-1", routeId: "moses-1" })), foreign);
    assert.equal(foreign.statusCode, 404);
    assert.equal(foreign.body.reason, "route_not_found");
    assert.equal(state.writes, 0);
  });
});

test("GitHub conflict reports failure and private route loading failure never masquerades as []", async () => {
  await withMockedGitHub([], async (state) => {
    state.conflict = true;
    const conflict = res();
    await publish(req(route()), conflict);
    assert.equal(conflict.statusCode, 409);
    assert.equal(conflict.body.reason, "commit_conflict");
    assert.equal(state.writes, 0);
    global.fetch = async () => { throw new Error("temporary API outage"); };
    const privateRead = res();
    await routesApi({ method: "GET", url: "/api/routes?scope=mine-all",
      headers: { cookie: cookie() } }, privateRead);
    assert.equal(privateRead.statusCode, 503);
    assert.equal(privateRead.body.reason, "routes_unavailable");
  });
});
