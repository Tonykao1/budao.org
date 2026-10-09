const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path){ return fs.readFileSync(path,'utf8'); }

test('production pasture keeps stable core behind the resident shell', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const rewrites = vercel.rewrites || [];
  assert.ok(rewrites.some(r => r.source === '/tonglu.html' && r.destination === '/pasture-live.html'));
  assert.ok(rewrites.some(r => r.source === '/tonglu-core.html' && /^https:\/\//.test(r.destination)));
  const html = read('pasture-live.html');
  assert.match(html, /tonglu-core\.html/);
});

test('pasture auth reuses eebee serverless function instead of creating a 13th function', () => {
  const vercel = JSON.parse(read('vercel.json'));
  const rewrites = vercel.rewrites || [];
  assert.ok(rewrites.some(r => r.source === '/api/pasture-auth' && r.destination === '/api/eebee?service=pasture'));
  assert.equal(fs.existsSync('api/pasture-auth.js'), false);
  const eebee = read('api/eebee.js');
  assert.match(eebee, /pasture-auth-handler/);
  assert.match(eebee, /service.*pasture/);
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
