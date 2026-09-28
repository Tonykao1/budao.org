const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("tent adds a quiet prayer entrance beneath step and word", () => {
  const html = fs.readFileSync(path.join(__dirname, "../tent.html"), "utf8");
  assert.match(html, /data-tent-path="prayer"[\s\S]*?<span>祷<\/span>/);
  assert.ok(html.indexOf('data-tent-path="prayer"') > html.indexOf('data-tent-path="word"'));
  assert.match(html, /class="prayer-room"/);
  assert.match(html, /新收到[\s\S]*代祷中[\s\S]*已完成/);
});

test("prayer entrance shares the step and word title and caption sizing", () => {
  const sharedCss = fs.readFileSync(path.join(__dirname, "../tent-style.css"), "utf8");
  const prayerCss = fs.readFileSync(path.join(__dirname, "../tent-prayer.css"), "utf8");

  assert.match(sharedCss, /\.path-choice span\s*\{[^}]*font-size:/s);
  assert.match(sharedCss, /\.path-choice small\s*\{[^}]*font-size:/s);
  assert.doesNotMatch(
    prayerCss,
    /\.prayer-path-choice\s+(?:span|small)\s*\{[^}]*font-size:/s,
    "祷与说明文字不可使用独立字号"
  );
});

test("prayer room client uses only protected APIs and ritual action labels", () => {
  const source = fs.readFileSync(path.join(__dirname, "../tent-prayer.js"), "utf8");
  assert.match(source, /\/api\/prayer-list/);
  assert.match(source, /\/api\/prayer-action/);
  assert.match(source, /承接祷告/);
  assert.match(source, /已经守望/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});
