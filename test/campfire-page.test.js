"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const file = (url) => path.join(root, url.replace(/^\//, ""));
const content = JSON.parse(read("data/campfire-content.json"));

test("campfire landing page has real, accessible ministry paths", () => {
  const html = read("yhzd.html");
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<main id="main"/);
  assert.match(html, /<h1>营火/);
  for (const id of ["our-heart", "ministries", "stories", "voices", "next-steps", "join"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  for (const href of ["/test.html", "/tongxing.html", "/lsxh.html", "/what.html", "/tonglu.html"]) {
    assert.ok(html.includes(href), "missing ministry destination: " + href);
    assert.ok(fs.existsSync(file(href)), "target page not found: " + href);
  }
  assert.match(html, /campfire\.css/);
  assert.match(html, /campfire\.js/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<noscript>/);
});

test("campfire stories are accurate reviewable static content with valid internal destinations", () => {
  assert.equal(content.version, 1);
  assert.ok(content.programs.length >= 4);
  assert.ok(content.stories.length >= 3);
  assert.ok(content.voices.length >= 3);
  const ids = new Set();
  for (const item of [...content.programs, ...content.stories]) {
    assert.ok(item.id && !ids.has(item.id), "duplicate or missing id: " + item.id);
    ids.add(item.id);
    assert.ok(item.title && item.description, "title/description required for " + item.id);
    assert.match(item.href, /^\/[a-zA-Z0-9/_-]+\.html$/);
    assert.ok(fs.existsSync(file(item.href)), "destination not found: " + item.href);
    if (item.image) {
      assert.match(item.image, /^\/images\/[a-zA-Z0-9._-]+\.(?:jpg|jpeg|png|webp)$/i);
      assert.ok(fs.existsSync(file(item.image)), "missing image: " + item.image);
      assert.ok(item.imageAlt, "image alt text required for " + item.id);
    }
  }
  assert.ok(content.archivedVoices.length > 0, "older messages should remain archived, not deleted");
  assert.ok(content.voices.every((voice) => typeof voice === "string" && voice.trim().length >= 2));
});

test("campfire works without editorial or calendar fetch, and uses no public submission endpoint", () => {
  const script = read("campfire.js");
  const css = read("campfire.css");
  assert.match(script, /FALLBACK_PROGRAMS/);
  assert.match(script, /FALLBACK_VOICES/);
  assert.match(script, /campfire-content\.json/);
  assert.match(script, /routes\.json/);
  assert.match(script, /route\.status === "scheduled"/);
  assert.match(script, /Asia\/Shanghai/);
  assert.match(script, /replaceChildren/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML\s*=/);
  assert.doesNotMatch(script, /\/api\/(?:publish|submit|prayer)/);
  assert.match(css, /@media \(max-width: 700px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
