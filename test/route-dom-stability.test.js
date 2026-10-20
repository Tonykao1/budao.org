const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const cancel = fs.readFileSync(path.join(root, "route-cancellation-public.js"), "utf8");
const page = fs.readFileSync(path.join(root, "test.html"), "utf8");
const calendar = fs.readFileSync(path.join(root, "budao-calendar.js"), "utf8");

test("cancellation observer only watches added or removed route cards", () => {
  assert.match(cancel, /observer\.observe\(grid,\s*\{\s*childList:\s*true\s*\}\)/);
  assert.doesNotMatch(cancel, /observer\.observe\(grid,\s*\{[^}]*subtree:\s*true/);
});

test("cancellation notice is initialized once and only updates changed messages", () => {
  const occurrences = [...cancel.matchAll(/note\.innerHTML\s*=/g)];
  assert.equal(occurrences.length, 1);
  assert.match(cancel, /if\s*\(!note\)\s*\{[\s\S]*?note\.innerHTML/);
  assert.match(cancel, /message\.textContent\s*!==\s*nextMessage/);
});

test("cancelled countdown is stable, without per-second timer overwrites", () => {
  assert.match(page, /activeRoutes\[index\]\.status\s*===\s*"cancelled"/);
  assert.match(page, /setCountdownText\(event\.id,\s*"本次步道已取消"\)/);
  assert.match(calendar, /text === "本次步道已取消"/);
});

test("desktop timeline is chronological and upcoming image loads eagerly in any slot", () => {
  assert.match(page, /return leftStart - rightStart;/);
  assert.doesNotMatch(page, /const leftPast = leftStart < now/);
  assert.match(page, /loading="\\?\$\{isUpcoming \? "eager" : "lazy"\}"/);
});
