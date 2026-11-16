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
  assert.match(source, /查看联系方式/);
  assert.match(source, /action: "CONTACT"/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test("prayer panel masks the large entrance characters with a translucent frosted surface", () => {
  const sharedCss = fs.readFileSync(path.join(__dirname, "../tent-style.css"), "utf8");
  const prayerCss = fs.readFileSync(path.join(__dirname, "../tent-prayer.css"), "utf8");
  const html = fs.readFileSync(path.join(__dirname, "../tent.html"), "utf8");

  assert.match(
    sharedCss,
    /\.presence\.entrance-open:not\(\.route-open\):not\(\.word-open\):not\(\.prayer-open\) \.tent-entrance/,
    "The entrance must not remain visible while the prayer room is open"
  );
  assert.match(prayerCss, /\.prayer-room\s*\{[^}]*background:\s*linear-gradient\([^}]*rgba\(/s);
  assert.match(prayerCss, /\.prayer-room\s*\{[^}]*backdrop-filter:\s*blur\(/s);
  assert.match(prayerCss, /\.prayer-room\s*\{[^}]*-webkit-backdrop-filter:\s*blur\(/s);
  assert.match(html, /href="tent-style\.css\?v=20261116-prayer-glass"/);
  assert.match(html, /href="tent-prayer\.css\?v=20261116-prayer-glass"/);
});
