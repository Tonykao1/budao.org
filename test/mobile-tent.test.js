const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "mobile-tent-tests-secret-at-least-32-characters";
process.env.GITHUB_TOKEN = "test-token";
process.env.GITHUB_PUBLISH_BRANCH = "main";

const { validateRoute } = require("../api/_security/route-schema");
const routesApi = require("../api/routes");
const publish = require("../api/publish-route-v2");
const location = require("../mobile-tent-location");

function signedCookie(id, username) {
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org",
    aud: "budao-admin",
    sub: id,
    username,
    role: "publisher",
    slot: "IMS",
    exp: Math.floor(Date.now() / 1000) + 300
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.BUDAO_SESSION_SECRET)
    .update(payload).digest("base64url");
  return "budao_admin_session=" + payload + "." + signature;
}

function response() {
  return {
    headers: {}, statusCode: 0, body: null,
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

function ownedRoute(id, leaderId, title, date) {
  return {
    id, routeId: id,
    leaderId, leader: leaderId.replace("leader-", ""),
    title, date, time: "09:00", timezone: "Asia/Shanghai",
    image: "", qrCode: ""
  };
}

test("mobile editor includes required route data, preview, photos, and safe login", () => {
  const html = fs.readFileSync(path.join(root, "mobile-tent.html"), "utf8");
  const js = fs.readFileSync(path.join(root, "mobile-tent.js"), "utf8");
  const css = fs.readFileSync(path.join(root, "mobile-tent.css"), "utf8");
  const fieldNames = ["title", "calendarType", "date", "time", "timezone",
    "country", "city", "region", "meetingPlace", "duration", "distance", "elevation",
    "difficulty", "suitableFor", "equipmentMinimum", "participantRequirements",
    "surface", "description"];
  for (const name of fieldNames) {
    assert.ok(html.includes('name="' + name + '"'), name + " is missing from mobile form");
  }
  assert.match(html, /name="password" type="password"/);
  assert.doesNotMatch(html, /name="location"/);
  assert.match(html, /id="locationPreview"/);
  assert.match(html, /src="\/mobile-tent-location\.js"/);
  for (const name of ["country", "city", "region", "surface"]) {
    assert.match(html, new RegExp('name="' + name + '"[^>]*\\brequired\\b'));
  }
  assert.match(js, /payload\.location = locationCore\.compose\(payload\)/);
  assert.match(js, /"country", "city", "region", "surface", "meetingPlace"/);
  assert.match(js, /locationCore\.parseLegacy\(source\.location\)/);
  assert.match(html, /id="routePicker"/);
  assert.match(html, /id="coverFile" accept="image\/\*"/);
  assert.match(html, /id="qrFile" accept="image\/\*"/);
  assert.match(html, /id="previewButton"/);
  assert.match(html, /id="publishButton"/);
  assert.match(js, /\/api\/auth\/login/);
  assert.match(js, /\/api\/auth\/session/);
  assert.match(js, /\/api\/routes\?scope=mine-all/);
  assert.match(js, /routeForm\.reset\(\);\s*routePicker\.value = selectedRoute \? routeId\(selectedRoute\) : "";/);
  assert.match(js, /\/api\/upload-route-image/);
  assert.match(js, /\/api\/publish-route-v2/);
  assert.match(js, /const previewOnly = \/\\.vercel\\.app\$/);
  assert.match(js, /if \(previewOnly\) \{/);
  assert.match(html, /id="environmentNote"/);
  assert.match(js, /window\.localStorage\.setItem\(draftKey\(\), JSON\.stringify\(readFields\(\)\)\)/);
  assert.doesNotMatch(js, /localStorage\.setItem\([^)]*password/);
  assert.match(css, /@media\(max-width:390px\)/);
});

test("mobile form fields obey existing publishing whitelist", () => {
  const html = fs.readFileSync(path.join(root, "mobile-tent.html"), "utf8");
  const names = Array.from(html.matchAll(/<(?:input|select|textarea)\b[^>]*\bname="([^"]+)"/g))
    .map((match) => match[1])
    .filter((name) => name !== "username" && name !== "password");
  const payload = { title: "Valid route" };
  for (const name of names) payload[name] = name === "calendarType" ? "budao" : "text";
  payload.title = "Valid route";
  const result = validateRoute(payload);
  assert.equal(result.error, undefined, "mobile input must match publishing allowlist");
  assert.equal(names.length, new Set(names).size, "route fields must not repeat");
});

test("all-owned route view never includes other leaders and legacy view remains one route", () => {
  const data = [
    ownedRoute("tony-1", "leader-tony", "First", "2026-12-01"),
    ownedRoute("tony-2", "leader-tony", "Second", "2026-12-02"),
    ownedRoute("moses-1", "leader-moses", "Other", "2026-12-03")
  ];
  const publisher = { id: "leader-tony", username: "tony" };
  const all = routesApi.privateRoutesForLeader(data, publisher, true);
  assert.equal(all.length, 2);
  assert.ok(all.every((route) => route.leaderId === publisher.id && route.slot === ""));
  assert.equal(routesApi.privateRoutesForLeader(data, publisher).length, 1);
});

test("GET mine-all is authenticated, not a public route catalog", async () => {
  const data = [
    ownedRoute("tony-1", "leader-tony", "First", "2026-12-01"),
    ownedRoute("tony-2", "leader-tony", "Second", "2026-12-02"),
    ownedRoute("moses-1", "leader-moses", "Other", "2026-12-03")
  ];
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true, status: 200,
    json: async () => ({
      sha: "test-sha",
      content: Buffer.from(JSON.stringify(data)).toString("base64")
    })
  });
  try {
    const anonymous = response();
    await routesApi({ method: "GET", url: "/api/routes?scope=mine-all", headers: {} }, anonymous);
    assert.equal(anonymous.statusCode, 401);

    const own = response();
    await routesApi({
      method: "GET",
      url: "/api/routes?scope=mine-all",
      headers: { cookie: signedCookie("leader-tony", "tony") }
    }, own);
    assert.equal(own.statusCode, 200);
    assert.deepEqual(own.body.map((item) => item.routeId).sort(), ["tony-1", "tony-2"]);
    assert.equal(own.headers["cache-control"], "no-store, no-cache, must-revalidate, max-age=0");
  } finally {
    global.fetch = originalFetch;
  }
});

test("editing a known owned ID survives a new title and date", () => {
  const data = [
    ownedRoute("tony-1", "leader-tony", "Original", "2026-12-01"),
    ownedRoute("moses-1", "leader-moses", "Other", "2026-12-01")
  ];
  const user = { id: "leader-tony", username: "tony" };
  const existing = publish.findExistingRoute(data, user, {
    routeId: "tony-1", id: "tony-1", title: "Renamed", date: "2027-01-01"
  });
  assert.equal(existing.routeId, "tony-1");
  assert.equal(publish.findExistingRoute(data, user, {
    routeId: "moses-1", title: "Forgeries", date: "2027-01-02"
  }), null, "other leader's ID must never be editable by this leader");
  assert.equal(publish.findExistingRoute(data, user, {
    routeId: "old-local-draft-id", title: "Original", date: "2026-12-01"
  }).routeId, "tony-1", "older Tent client must still match by title and date");
});

test("QR processing keeps entire image while cover can crop to 16:9", () => {
  const js = fs.readFileSync(path.join(root, "mobile-tent.js"), "utf8");
  assert.match(js, /kind === "cover"/);
  assert.match(js, /const scale = Math\.min\(1, 1400 \/ Math\.max\(sourceW, sourceH\)\)/);
  assert.match(js, /context\.drawImage\(image, 0, 0, canvas\.width, canvas\.height\)/);
  assert.match(js, /if \(selectedRoute && selectedRoute\.qrCode\)/);
});

test("country / province / city produce exactly one canonical uneditable location", () => {
  const china = { country: " 中国 ", city: " 北京 ", region: " 顺义 " };
  assert.equal(location.compose(china), "中国 · 北京 · 顺义");
  assert.equal(location.compose({ country: "美国", city: "加州", region: "奥克兰" }),
    "美国 · 加州 · 奥克兰");
  assert.equal(location.compose({ country: "中国", city: "", region: "顺义" }), "");
  assert.equal(location.compose({ country: "中国", city: "北·京", region: "顺义" }), "");
  assert.equal(location.compose({ country: "中国", city: "北京", region: "顺义·后沙峪" }), "");
  assert.equal(location.compose({ country: "中国", city: "北京\\n天津", region: "顺义" }), "");
  assert.equal(location.compose({ country: "中国", city: "北京", region: "顺义", location: "spoofed" }),
    "中国 · 北京 · 顺义");
  assert.deepEqual(location.parseLegacy("中国 · 北京 · 顺义"),
    { country: "中国", city: "北京", region: "顺义" });
  assert.equal(location.parseLegacy("中国北京顺义"), null);
  assert.equal(location.parseLegacy("中国 · 北京 · 顺义 · 后沙峪"), null);
});
