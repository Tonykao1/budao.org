const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path){ return fs.readFileSync(path,'utf8'); }

test('formal tonglu entry is the resident shell and preserves the prior pasture as local core', () => {
  const entry = read('tonglu.html');
  const core = read('tonglu-core.html');
  assert.match(entry, /pasture-live\.js/);
  assert.match(entry, /tonglu-core\.html/);
  assert.match(entry, /数字牧场/);
  assert.match(core, /tonglu-pasture-v20\.html\?v=20261005freeflock/);
  assert.match(core, /pasture-sky-engine\.js/);
  assert.doesNotMatch(core, /pasture-live\.js/);
  const vercel = JSON.parse(read('vercel.json'));
  const rewrites = vercel.rewrites || [];
  assert.equal(rewrites.some(r => r.source === '/tonglu.html'), false);
  assert.equal(rewrites.some(r => r.source === '/tonglu-core.html'), false);
});

test('pasture auth reuses the small publish compatibility function instead of creating a 13th function', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const rewrites = vercel.rewrites || [];
  assert.ok(rewrites.some(r => r.source === '/api/pasture-auth' && r.destination === '/api/publish-route?service=pasture'));
  assert.equal(fs.existsSync('api/pasture-auth.js'), false);
  const bridge = read('api/publish-route.js');
  assert.match(bridge, /pasture-auth-handler/);
  assert.match(bridge, /service.*pasture/);
  assert.match(bridge, /publisher_moved/);
});

test('production pasture exposes email auth and first-entry sheep identity flow', () => {
  const app = read('pasture-live.js');
  assert.match(app, /requestCode/);
  assert.match(app, /verifyCode/);
  assert.match(app, /saveSheep/);
  assert.match(app, /这只羊就是你/);
  assert.doesNotMatch(app, /属于自己的羊|我的羊|领养/);
});

test('find-sheep interaction is exact-pixel, five-fingered and uses only approved mp3', () => {
  const app = read('pasture-live.js');
  assert.match(app, /hitMask/);
  assert.match(app, /getImageData/);
  assert.match(app, /PIXEL_HAND_OPEN/);
  assert.match(app, /five-finger|five finger|五指/i);
  assert.match(app, /pasture-assets\/baaa01\.mp3/);
  assert.doesNotMatch(app, /AudioContext|webkitAudioContext|createOscillator/);
  assert.ok(fs.existsSync('pasture-assets/baaa01.mp3'));
});

test('production API stores residents without requiring main schema replacement', () => {
  const store = read('api/_security/pasture-auth-store.js');
  assert.match(store, /CREATE TABLE IF NOT EXISTS pasture_users/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS pasture_sessions/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS pasture_sheep/);
  assert.match(store, /neon\(/);
});
