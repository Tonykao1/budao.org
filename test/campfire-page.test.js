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
  assert.ok(baodi, "261003 麦浪之约应有相册");
  assert.equal(baodi.date, "2026-10-03");
  assert.equal(baodi.title, "天津·宝坻·麦浪之约");
  assert.equal(baodi.published, true);
  assert.equal(baodi.photos.length, 4, "两张餐食照片只保留一张");
  assert.ok(baodi.photos.every((photo) => photo.approved === true && photo.alt && photo.caption));
  for (const [i, photo] of baodi.photos.entries()) {
    assert.equal(photo.src, `/campfire-photos/261003/261003-${String(i + 1).padStart(2, "0")}.jpg`);
    assert.ok(exists(photo.src), `261003 photo ${i + 1} must exist in the repo`);
  }
  assert.equal(baodi.photos.filter((photo) => photo.alt.includes("螃蟹")).length, 1, "只保留一张餐食特写");
  assert.ok(baodi.photos.every((photo) => !/窗边|窗外/.test(photo.alt)), "舍弃窗边人物的餐食全景");
  const gucheng = archive.albums.find((album) => album.id === "260816");
  assert.ok(gucheng, "260816 故城记忆应有相册");
  assert.equal(gucheng.date, "2026-08-16");
  assert.equal(gucheng.title, "故城记忆");
  assert.equal(gucheng.published, true);
  assert.equal(gucheng.photos.length, 12);
  for (const [i, photo] of gucheng.photos.entries()) {
    assert.equal(photo.src, `/campfire-photos/260816/260816-${String(i + 1).padStart(2, "0")}.webp`);
    assert.equal(photo.approved, true);
    assert.ok(photo.alt && photo.caption, "每张现场照片应有客观描述和图注");
    assert.ok(exists(photo.src), `260816 photo ${i + 1} must exist in the repo`);
  }
  const publishedPhotoCount = archive.albums
    .filter((album) => album.published)
    .reduce((n, a) => n + a.photos.length, 0);
  assert.ok(publishedPhotoCount >= 34, "原有22张现场照片和260816的12张照片均应保留");
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

test("现场照片发布后获得永久水印，线路封面保持原图", () => {
  assert.match(script, /campfire-watermarked/);
  assert.match(script, /item\.kind === "moment"/);
  assert.match(script, /setCampfirePhoto\(img, item, shot\)/);
  assert.match(script, /setCampfirePhoto\(image, item, wrapper\)/);
  assert.match(script, /setCampfirePhoto\(image, item, image\.parentElement\)/);
  assert.match(css, /camp-watermark-fallback/);
  assert.match(html, /camp-lightbox-image-wrap/);
  const processor = read("scripts/campfire-watermark.py");
  assert.match(processor, /album\.get\("published"\) is not True/);
  assert.match(processor, /photo\.get\("approved"\) is not True/);
  assert.match(processor, /original = source_root \/ relative/);
  assert.match(processor, /campfire-watermarked/);
  assert.ok(exists("/assets/budao-footprint-watermark.svg"));
  assert.ok(exists("/.github/workflows/campfire-watermark.yml"));
});


test("火光与回响系统坚持匿名无计数、仅对实拍开放及管理员审核", () => {
  const client = read("campfire-interactions.js");
  const backend = read("api/_security/campfire-handler.js");
  const migration = read("db/migrations/20261106_campfire_interactions.sql");
  const apiRouter = read("api/publish-route.js");
  const vercel = JSON.parse(read("vercel.json"));
  const route = vercel.rewrites.find(r => r.source === "/api/campfire");
  assert.equal(route?.destination, "/api/publish-route?service=campfire");
  assert.match(apiRouter, /require\('\.\/_security\/campfire-handler'\)/);

  assert.match(html, /camp-conversation/);
  assert.match(html, /camp-comment-form/);
  assert.match(html, /camp-photo-spark/);
  assert.match(html, /campfire-privacy\.html/);
  assert.match(script, /item\.kind === "moment"/);
  assert.match(script, /campfire:photo-open/);
  assert.match(client, /commentId:c\.id/);
  assert.match(client, /photoId:photo\.image/);
  assert.match(client, /camp-moderation-list/);
  assert.doesNotMatch(client, /\.innerHTML\s*=/);

  assert.match(backend, /guestWritesEnabled/);
  assert.match(backend, /CAMPFIRE_GUEST_WRITES_ENABLED/);
  assert.match(backend, /requireSameOrigin/);
  assert.match(backend, /isSteward/);
  assert.match(backend, /status='APPROVED'/);
  assert.match(backend, /"PENDING"/);
  assert.match(backend, /ON CONFLICT \(visitor_hash,target_kind,target_id\) DO NOTHING/);
  assert.match(backend, /crypto\.createHmac/);
  assert.match(backend, /HttpOnly/);
  assert.match(backend, /SameSite=Lax/);
  assert.doesNotMatch(backend, /x-vercel-ip-(city|latitude|longitude)/i);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS campfire_comments/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS campfire_reactions/);
  assert.match(migration, /UNIQUE\(visitor_hash,target_kind,target_id\)/);
  assert.match(migration, /campfire_moderation_audit/);
  assert.ok(exists("/campfire-privacy.html"));
  assert.ok(exists("/campfire-interactions.js"));
});


test("星火同行把真实活动记忆与私人足迹分开，不公开计数或推断身份", () => {
  const s2s = read("campfire-sparks-to-steps.js");
  const api = read("api/_security/campfire-handler.js");
  const privacy = read("campfire-privacy.html");
  assert.match(html, /id="camp-sparks-to-steps"/);
  assert.match(html, /id="camp-footprints-panel"/);
  assert.match(html, /id="camp-album-memories"/);
  assert.match(html, /id="camp-share-memory"/);
  assert.match(html, /id="camp-walk-again-link"/);
  assert.match(html, /campfire-sparks-to-steps\.js/);
  assert.match(script, /albumId:string\(album\.id,80\)/);
  assert.match(script, /new URLSearchParams\(window\.location\.search\)\.get\("photo"\)/);
  assert.match(script, /item\.kind === "moment" && item\.image === photoId/);
  assert.match(api, /async function albumMemories/);
  assert.match(api, /status='APPROVED'/);
  assert.match(api, /photos\.get\(row\.photoId\)===albumId/);
  assert.match(api, /view"\)==="memories"/);
  assert.match(s2s, /window\.localStorage/);
  assert.match(s2s, /readSaved\(\)/);
  assert.match(s2s, /writeSaved\(\[\]\)/);
  assert.match(s2s, /navigator\.share/);
  assert.match(s2s, /new URL\("\/yhzd\.html"/);
  assert.match(s2s, /\/test\.html/);
  assert.doesNotMatch(s2s, /navigator\.geolocation|FingerprintJS|document\.cookie|innerHTML\s*=/i);
  assert.match(privacy, /不上传到服务器/);
  assert.match(css, /camp-s2s-three/);
  assert.match(css, /camp-album-memory/);
});


test("首屏每次进入展示不同同行的高分照片，二次点击进入对应影集", () => {
  const quality = JSON.parse(read("data/campfire-hero-quality.json"));
  assert.equal(quality.version, 1);
  assert.ok(quality.scores && typeof quality.scores === "object");
  const approved = archive.albums
    .filter((album) => album.published === true)
    .flatMap((album) => album.photos.filter((photo) => photo.approved === true));
  assert.ok(approved.length >= 3);
  for (const photo of approved) {
    assert.ok(Number.isInteger(quality.scores[photo.src]), "missing quality score: " + photo.src);
    assert.ok(quality.scores[photo.src] >= 0 && quality.scores[photo.src] <= 100);
  }
  const processor = read("scripts/campfire-watermark.py");
  const workflow = read(".github/workflows/campfire-watermark.yml");
  assert.match(processor, /hero_quality_score/);
  assert.match(processor, /ImageChops\.difference/);
  assert.match(processor, /campfire-hero-quality\.json/);
  assert.match(workflow, /git add -A campfire-watermarked\/ data\/campfire-hero-quality\.json/);

  assert.match(script, /function selectHeroPhotos\(\)/);
  assert.match(script, /item\.kind !== "moment" \|\| item\.heroEligible === false/);
  assert.match(script, /function heroPhotoScore\(item\)/);
  assert.match(script, /data\/campfire-hero-quality\.json/);
  assert.match(script, /previousHeroSelection/);
  assert.match(script, /window\.sessionStorage/);
  assert.match(script, /event\.persisted/);
  assert.match(script, /if \(armedIndex === index\)/);
  assert.match(script, /shot\.addEventListener\("click", activate\)/);
  assert.match(script, /scrollToHeroAlbum\(item\)/);
  assert.match(script, /setGalleryFilter\("moment"\)/);
  assert.match(script, /heading\.scrollIntoView/);
  assert.match(script, /heading\.dataset\.albumKey/);
  assert.match(css, /\.camp-album-heading/);
  assert.match(css, /\.camp-photo-card:nth-of-type/);
  assert.match(html, /再次点击进入对应影集/);
});


test("二次点击后的丝滑下卷拥有减速阻尼，并尊重用户的操作", () => {
  assert.match(script, /function glideToAlbum\(heading, reducedMotion\)/);
  assert.ok(script.includes("function dampedScrollProgress(value)"));
  assert.ok(script.includes("const launchEnd = 0.16;"));
  assert.ok(script.includes("const brakeStart = 0.38;"));
  assert.ok(script.includes("const ease = dampedScrollProgress(t)"));
  assert.match(script, /requestAnimationFrame\(tick\)/);
  assert.match(script, /heading\.getBoundingClientRect\(\)\.top/);
  assert.match(script, /getComputedStyle\(heading\)\.scrollMarginTop/);
  assert.ok(script.includes("window.scrollTo(0, nextY)"));
  assert.match(script, /window\.addEventListener\("wheel", cancel/);
  assert.match(script, /window\.addEventListener\("touchstart", cancel/);
  assert.match(script, /window\.addEventListener\("keydown", cancel/);
  assert.match(script, /html\.style\.scrollBehavior = oldScrollBehavior/);
  assert.match(script, /glideToAlbum\(heading, prefersReducedMotion\)/);
  assert.match(script, /if \(reducedMotion \|\| typeof window\.requestAnimationFrame !== "function"\)/);
});


test("较长阻尼区间持续减速并且精确停靠，无反弹或突跳", () => {
  const source = script.match(/  function dampedScrollProgress\(value\) \{[\s\S]*?\n  \}/)?.[0];
  assert.ok(source, "damping helper must exist");
  const ease = new Function("return " + source.trim())();
  const near = (a,b,tol=0.001) => assert.ok(Math.abs(a-b) < tol, a + " ≠ " + b);
  near(ease(0), 0, 1e-10);
  near(ease(1), 1, 1e-10);
  for (let i=1; i<=1000; i++) {
    const before = ease((i-1)/1000);
    const after = ease(i/1000);
    assert.ok(after >= before - 1e-10 && after <= 1 + 1e-10,
      "movement must be monotone with no overshoot");
  }
  // The last quarter should still move visibly: not become nearly static.
  assert.ok(1 - ease(0.75) > 0.09);
  assert.ok(1 - ease(0.75) < 0.15);
  // A C1-continuous velocity curve avoids a noticeable kick at phase changes.
  const delta=0.00001;
  for (const point of [0.16,0.38]) {
    const left=(ease(point)-ease(point-delta))/delta;
    const right=(ease(point+delta)-ease(point))/delta;
    assert.ok(Math.abs(left-right) < 0.001, "velocity jumps at " + point);
  }
  assert.ok(script.includes("Math.min(1750, Math.max(950, 720 + Math.abs(distance) * 0.16))"));
  assert.ok(script.includes("Math.abs(nextY - lastPaintedY) >= 0.45"));
  assert.ok(script.includes('document.addEventListener("visibilitychange", onVisibilityChange)'));
  assert.ok(script.includes('document.removeEventListener("visibilitychange", onVisibilityChange)'));
});
