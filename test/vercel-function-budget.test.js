const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");

test("Hobby deployment stays within twelve serverless functions", () => {
  const apiRoot = path.join(root, "api");
  const functions = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith("_")) continue;
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(js|ts)$/.test(entry.name)) functions.push(path.relative(apiRoot, full));
    }
  }
  walk(apiRoot);
  assert.ok(functions.length <= 12, `expected <= 12 functions, found ${functions.length}: ${functions.join(", ")}`);
});

test("public prayer routes are rewritten to fixed prayer path operations", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const rewrites = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));
  for (const name of ["submit", "list", "action", "purge"]) {
    assert.equal(rewrites.get(`/api/prayer-${name}`), `/api/prayer/${name}`);
  }
});

test("caller query parameters cannot change the fixed prayer operation", () => {
  const routerPath = path.join(root, "api/prayer/[operation].js");
  assert.ok(fs.existsSync(routerPath), "dedicated prayer path router is missing");
  const router = require(routerPath);
  assert.equal(router.operationFromRequest({ url: "/api/prayer-list?operation=submit&budaoModule=prayer-submit" }), "list");
  assert.equal(router.operationFromRequest({ url: "/api/prayer/list?operation=submit&budaoModule=prayer-submit" }), "list");
});

test("disabled legacy publish endpoint is consolidated to preserve the function budget", () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  const rewrites = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));
  assert.equal(fs.existsSync(path.join(root, "api/publish.js")), false);
  assert.equal(rewrites.get("/api/publish"), "/api/publish-route");
});
