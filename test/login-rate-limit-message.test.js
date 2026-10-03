const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("Tent distinguishes rate limiting from service unavailability", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "tent-app.js"), "utf8");
  assert.match(source, /rate_limited/);
  assert.match(source, /尝试次数过多/);
  assert.match(source, /登录服务暂时不可用/);
});
