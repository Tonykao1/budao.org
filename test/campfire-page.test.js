"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const exists = (file) => fs.existsSync(path.join(root, file.replace(/^\//, "")));
const html = read("yhzd.html");
const script = read("campfire.js");
const css = read("campfire.css");
const archive = JSON.parse(read("data/campfire-archive.json"));

test("营火之地主体只展示步道照片、评论与回顾", () => {
  assert.match(html, /<html lang="zh-CN">/);
  assert.match(html, /<main id="camp-main"/);
  assert.match(html, /<h1>营火/);
  for (const id of ["camp-gallery", "camp-voices", "camp-history", "camp-contribute"]) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
  }
  assert.match(html, /沿途影像/);
  assert.match(html, /走过的人，这样说/);
  assert.match(html, /时光里的步道/);
  assert.match(html, /只珍藏步道的故事/);
  const main = html.split("<main")[1]?.split("</main>")[0] || "";
  assert.doesNotMatch(main, /房角石|天使之家|安然期颐|牧场|童行|外部公益机构/);
  assert.ok(exists("/test.html"));
  assert.match(html, /<dialog id="camp-lightbox"/);
  assert.match(html, /aria-live="polite"/);
});

test("34 条原版留言全部保留并且不虚构评论归属", () => {
  assert.equal(archive.version, 2);
  assert.equal(archive.quotes.length, 34);
  assert.equal(new Set(archive.quotes).size, 34);
  assert.ok(archive.quotes.every((q) => typeof q === "string" && q.trim().length > 0));
  assert.match(archive.quotes.join("\n"), /Grateful for this\./);
  assert.match(archive.quotes.join("\n"), /我相信人与人的每一次相遇都是奇迹/);
  assert.ok(archive.featuredQuoteIndexes.every((i) => Number.isInteger(i) && i >= 0 && i < archive.quotes.length));
  assert.equal(new Set(archive.featuredQuoteIndexes).size, archive.featuredQuoteIndexes.length);
  assert.ok(Array.isArray(archive.albums));
  const march = archive.albums.find((album) => album.id === "261031");
  assert.ok(march, "261031 活动应有相册记录");
  assert.equal(march.date, "2026-10-31");
  assert.equal(march.title, "鹿皮关·领袖行军");
  assert.equal(march.published, true);
  assert.equal(march.photos.length, 10);
  assert.ok(march.photos.every((photo) => photo.approved === true && photo.alt && photo.caption));
  for (const [i, photo] of march.photos.entries()) {
    assert.equal(photo.src, `/campfire-photos/261031/261031-${String(i + 1).padStart(2, "0")}.jpg`);
    assert.ok(exists(photo.src), `261031 photo ${i + 1} must exist in the repo`);
  }
  const autumn = archive.albums.find((album) => album.id === "261024");
  assert.ok(autumn, "261024 浅山赏秋应有相册");
  assert.equal(autumn.date, "2026-10-24");
  assert.equal(autumn.title, "浅山赏秋");
  assert.equal(autumn.published, true);
  assert.equal(autumn.photos.length, 2);
  assert.ok(autumn.photos.every((photo) => photo.approved === true && photo.alt && photo.caption));
  for (const [i, photo] of autumn.photos.entries()) {
    assert.equal(photo.src, `/campfire-photos/261024/261024-${String(i + 1).padStart(2, "0")}.jpg`);
    assert.ok(exists(photo.src), `261024 photo ${i + 1} must exist in the repo`);
  }
  const mountain = archive.albums.find((album) => album.id === "261010");
  assert.ok(mountain, "261010 蟒山·国度·同行应有相册");
  assert.equal(mountain.date, "2026-10-10");
  assert.equal(mountain.title, "蟒山·国度·同行");
  assert.equal(mountain.published, true);
  assert.equal(mountain.photos.length, 6);
  assert.ok(mountain.photos.every((photo) => photo.approved === true && photo.alt && photo.caption));
  for (const [i, photo] of mountain.photos.entries()) {
    assert.equal(photo.src, `/campfire-photos/261010/261010-${String(i + 1).padStart(2, "0")}.jpg`);
    assert.ok(exists(photo.src), `261010 photo ${i + 1} must exist in the repo`);
  }
  const baodi = archive.albums.find((album) => album.id === "261003");
  assert.ok(baodi, "261003 麦浪之约应有预备相册");
  assert.equal(baodi.date, "2026-10-03");
  assert.equal(baodi.title, "天津·宝坻·麦浪之约");
  assert.equal(baodi.published, false, "未取得本期明确公开许可前不得上线");
  assert.equal(baodi.photos.length, 5);
  assert.ok(baodi.photos.every((photo) => photo.approved === false && photo.alt && photo.caption));
  for (const [i, photo] of baodi.photos.entries()) {
    assert.equal(photo.src, `/campfire-photos/261003/261003-${String(i + 1).padStart(2, "0")}.jpg`);
  }
  for (const album of archive.albums) {
    if (!album.published) continue;
    assert.ok(album.photos.some((photo) => photo.approved && exists(photo.src)), "Published albums need a real approved photo");
  }
});

test("画廊明确区分现场照片与往期封面，没有错误宣传", () => {
  assert.match(script, /item\.approved !== true/);
  assert.match(script, /album\.published !== true/);
  assert.match(script, /\/route-history\.json/);
  assert.match(script, /\/routes\.json/);
  assert.match(script, /route\.image/);
  assert.match(script, /item\.status === "cancelled"/);
  assert.match(script, /路线封面|线路封面/);
  assert.match(script, /"moment"/);
  assert.match(script, /"cover"/);
  assert.match(script, /replaceChildren/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML\s*=/);
  assert.doesNotMatch(script, /\/api\/(?:publish|submit|prayer)/);
  assert.match(html, /线路封面不等同于当天活动实拍/);
  assert.match(css, /@media\(max-width:700px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
});

test("引导链接仅是步道日历与分享历史照片的联系入口", () => {
  for (const target of ["campfire.js", "campfire.css", "data/campfire-archive.json"]) assert.ok(exists(target));
  assert.match(html, /mailto:hello@budao\.org/);
  assert.match(html, /照片与留言须经本人或相关权利人同意/);
});
