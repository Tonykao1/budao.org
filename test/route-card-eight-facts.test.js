"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const page = fs.readFileSync(path.join(root, "test.html"), "utf8");
const records = JSON.parse(fs.readFileSync(path.join(root, "routes.json"), "utf8"));

function sourceBetween(start, end) {
  const from = page.indexOf("function " + start + "(");
  const to = page.indexOf("\nfunction " + end + "(", from + 1);
  assert.ok(from >= 0 && to > from, "route fact helper " + start + " exists");
  return page.slice(from, to);
}

function buildHarness() {
  const calls = [];
  const context = {
    escapeAttribute(value) {
      return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
    },
    escapeHtml(value) {
      return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    },
    parameterButton(type, value, label) {
      calls.push({ type, value, label });
      return '<button data-kind="' + type + '">' + String(label || value) + "</button>";
    }
  };
  vm.runInNewContext(sourceBetween("routeFact", "routeFactsHtml") +
    "\n" + sourceBetween("routeFactsHtml", "parameterButton") +
    "\nthis.routeFactsHtml=routeFactsHtml;", context);
  return { html: context.routeFactsHtml, calls };
}

function count(markup, re) {
  return Array.from(markup.matchAll(re)).length;
}

test("奥森南园 keeps all eight positions without inventing missing facts", () => {
  const route = records.find(r => r.title === "奥森南园");
  assert.ok(route, "the first externally published mobile route is still in fixtures");
  assert.deepEqual(
    ["elevation", "difficulty", "suitableFor", "equipmentMinimum"].map(x => route[x]),
    ["", "", "", ""]
  );
  const h = buildHarness();
  const markup = h.html(route);
  assert.equal(h.calls.length, 4, "only four known facts are clickable");
  assert.equal(count(markup, /<span class="route-fact-missing"/g), 4);
  assert.equal(count(markup, /<button /g), 4);
  for (const label of ["爬升待补充", "难度待补充", "适合人群待补充", "装备要求待补充"]) {
    assert.ok(markup.includes(label), label + " must be visible");
  }
  assert.ok(markup.includes("13:05"));
  assert.ok(markup.includes("2小时"));
  assert.ok(markup.includes("3公里"));
  assert.ok(markup.includes("健身跑道，公园路"));
  assert.doesNotMatch(markup, /undefined|null|NaN/);
});

test("a complete route retains exactly eight clickable parameter buttons", () => {
  const route = records.find(r =>
    ["time", "duration", "distance", "surface", "elevation", "difficulty",
      "suitableFor", "equipmentMinimum"].every(key => String(r[key] || "").trim()));
  assert.ok(route, "at least one published route has all eight facts");
  const h = buildHarness();
  const markup = h.html(route);
  assert.equal(h.calls.length, 8);
  assert.equal(count(markup, /<span class="route-fact-missing"/g), 0);
  assert.equal(count(markup, /<button /g), 8);
  assert.equal(h.calls.map(x => x.type).join(","),
    "time,duration,distance,surface,elevation,difficulty,suitableFor,equipmentMinimum");
});

test("all-empty facts remain eight labelled non-clickable fields, no fabricated numbers", () => {
  const h = buildHarness();
  const markup = h.html({});
  assert.equal(h.calls.length, 0);
  assert.equal(count(markup, /<span class="route-fact-missing"/g), 8);
  assert.equal(count(markup, /<button /g), 0);
  assert.doesNotMatch(markup, /0公里|0米|简单|无需装备|任意人群/);
});

test("slot layout is unchanged for pending routes; missing slots are visibly quieter", () => {
  assert.match(page, /const infoHtml = route\.pending \? "" : routeFactsHtml\(route\)/);
  assert.match(page, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(page, /\.route-info \.route-fact-missing\s*\{/);
  assert.match(page, /background:#faf9f6/);
  assert.match(page, /cursor:default/);
  assert.match(page, /grid\.querySelectorAll\("\.route-info button"\)/);
});
