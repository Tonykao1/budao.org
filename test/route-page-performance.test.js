const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "test.html"), "utf8");
const calendar = fs.readFileSync(path.join(root, "budao-calendar.js"), "utf8");
const api = fs.readFileSync(path.join(root, "api/routes.js"), "utf8");

test("public route photos and QR codes use the same-origin static assets", () => {
  const source = html.match(/function resolveImage\(value\)\{[\s\S]*?\n\}/);
  assert.ok(source, "missing image resolver");
  const resolveImage = vm.runInNewContext("(" + source[0] + ")", {});
  const raw = "https://raw.githubusercontent.com/Tonykao1/budao.org/main/";
  assert.equal(resolveImage(raw + "route-assets/tony/photo.jpg"), "/route-assets/tony/photo.jpg");
  assert.equal(resolveImage(raw + "route-assets/leo/qr.png"), "/route-assets/leo/qr.png");
  assert.equal(resolveImage(raw + "other/path.jpg"), raw + "other/path.jpg");
  assert.equal(resolveImage("https://other.example/photo.jpg"), "https://other.example/photo.jpg");
  assert.equal(resolveImage("/route-assets/tony/photo.jpg"), "/route-assets/tony/photo.jpg");
});

test("calendar and cards share one public routes request", () => {
  assert.match(calendar, /BudaoPublishedRoutesPromise/);
  assert.match(calendar, /loadPublishedRoutes\(\)/);
  assert.match(html, /window\.BudaoPublishedRoutesPromise/);
  assert.match(html, /publishedRoutesRequest/);
});

test("public route API performs independent Github reads concurrently", () => {
  assert.match(api, /const publicSupervision =/);
  assert.match(api, /readAltarState\(\)\.then/);
  assert.match(api, /const routes = await readRoutes\(\)/);
  assert.match(api, /const supervisionRoutes = await publicSupervision;/);
});
