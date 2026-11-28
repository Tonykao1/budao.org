"use strict";

// Release gate: read-only; no network, credentials, database or production writes.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");

function imageType(bytes) {
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" &&
      bytes.toString("ascii", 8, 12) === "WEBP" &&
      bytes.readUInt32LE(4) + 8 === bytes.length) return "webp";
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 &&
      bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return "jpg";
  return null;
}

function verify(archive, quality, readAsset) {
  const errors = [];
  const ids = new Set(), sources = new Set(), derivatives = new Set();
  let albums = 0, photos = 0;
  if (archive.version !== 2 || !Array.isArray(archive.albums)) {
    return { errors: ["invalid archive schema"], albums, photos };
  }
  if (quality.version !== 1 || !quality.scores || typeof quality.scores !== "object") {
    return { errors: ["invalid hero quality schema"], albums, photos };
  }
  const checkImage = (src, expected) => {
    try {
      if (imageType(readAsset(src)) !== expected) errors.push("invalid image signature/length: " + src);
    } catch {
      errors.push("missing or unreadable asset: " + src);
    }
  };
  for (const album of archive.albums) {
    if (!album || typeof album.id !== "string" || !album.id.trim()) {
      errors.push("missing album ID"); continue;
    }
    if (ids.has(album.id)) errors.push("duplicate album ID: " + album.id);
    ids.add(album.id);
    if (album.published !== true) continue;
    albums++;
    if (typeof album.title !== "string" || !album.title.trim() ||
        typeof album.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(album.date)) {
      errors.push("invalid published album metadata: " + album.id);
    }
    if (!Array.isArray(album.photos) || !album.photos.length) {
      errors.push("empty published album: " + album.id); continue;
    }
    for (const photo of album.photos) {
      if (!photo || photo.approved !== true) {
        errors.push("unapproved photo in published album: " + album.id); continue;
      }
      photos++;
      const src = photo.src;
      if (typeof src !== "string" ||
          !/^\/campfire-photos\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.(jpg|jpeg|webp)$/.test(src)) {
        errors.push("invalid asset path in " + album.id); continue;
      }
      if (sources.has(src)) errors.push("duplicate photo path: " + src);
      sources.add(src);
      if (typeof photo.alt !== "string" || !photo.alt.trim() ||
          typeof photo.caption !== "string" || !photo.caption.trim()) {
        errors.push("missing alt or caption: " + src);
      }
      const derivative = src.replace("/campfire-photos/", "/campfire-watermarked/").replace(/\.[^.]+$/, ".webp");
      if (derivatives.has(derivative)) errors.push("duplicate watermark path: " + derivative);
      derivatives.add(derivative);
      const score = quality.scores[src];
      if (!Number.isInteger(score) || score < 0 || score > 100) errors.push("missing/invalid hero score: " + src);
      checkImage(src, src.endsWith(".webp") ? "webp" : "jpg");
      checkImage(derivative, "webp");
    }
  }
  if (!albums || !photos) errors.push("no published photos");
  return { errors, albums, photos };
}

const readJson = file => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
test("release gate: every published Campfire photo has original, watermark, metadata and score", () => {
  const result = verify(readJson("data/campfire-archive.json"),
    readJson("data/campfire-hero-quality.json"), src => fs.readFileSync(path.join(root, src.slice(1))));
  assert.equal(result.errors.length, 0, result.errors.join("\n"));
  console.log("Campfire release inventory: " + result.albums + " albums / " + result.photos + " approved photos");
});

test("release gate rejects missing, unapproved, duplicate and malformed assets", () => {
  const src = "/campfire-photos/fixture/fixture-01.jpg";
  const derivative = "/campfire-watermarked/fixture/fixture-01.webp";
  const jpg = Buffer.from([255,216,255,217]);
  const webp = Buffer.from([82,73,70,70,4,0,0,0,87,69,66,80]);
  const assets = new Map([[src,jpg],[derivative,webp]]);
  const read = key => { if (!assets.has(key)) throw Error("missing"); return assets.get(key); };
  const photo = {src, approved:true, alt:"fixture", caption:"fixture"};
  const album = {id:"fixture",date:"2026-01-01",title:"fixture",published:true,photos:[photo]};
  const archive = {version:2,albums:[album]};
  const quality = {version:1,scores:{[src]:80}};
  assert.deepEqual(verify(archive,quality,read).errors,[]);
  assets.delete(derivative);
  assert.ok(verify(archive,quality,read).errors.some(e=>e.includes("missing or unreadable")));
  assets.set(derivative,Buffer.from("not an image"));
  assert.ok(verify(archive,quality,read).errors.some(e=>e.includes("invalid image")));
  assets.set(derivative,webp);
  assert.ok(verify(archive,{version:1,scores:{}},read).errors.some(e=>e.includes("hero score")));
  assert.ok(verify({...archive,albums:[{...album,photos:[photo,photo]}]},quality,read).errors.some(e=>e.includes("duplicate photo")));
  assert.ok(verify({...archive,albums:[{...album,photos:[{...photo,approved:false}]}]},quality,read).errors.some(e=>e.includes("unapproved")));
});
