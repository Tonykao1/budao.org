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

test('authenticated pasture restores the agreed pixel function-zone design instead of generic buttons', () => {
  const html = read('tonglu.html');
  const css = read('pasture-live.css');
  assert.match(html, /class="sky-zone"/);
  assert.match(html, /class="topline"/);
  assert.match(html, /class="identity pixel"/);
  assert.match(html, /class="actions"/);
  assert.match(html, /id="returnNow"/);
  assert.match(html, /id="grassBookBtn"/);
  assert.match(html, /id="windNewsBtn"/);
  assert.match(html, /id="partnersBtn"/);
  assert.match(html, /id="mailBtn"/);
  assert.match(html, /id="budaoCardBtn"/);
  assert.match(html, /id="boxEntryBtn"/);
  assert.match(html, /class="public-screen pixel"/);
  assert.match(css, /\.pixel\{/);
  assert.match(css, /\.topline\{/);
  assert.match(css, /\.pbtn\{/);
  assert.doesNotMatch(html, /resident-toolbar/);
});

test('first-time resident gets the V2 visual identity maker, not a form configurator', () => {
  const app = read('pasture-live.js');
  const css = read('pasture-sheep-maker-v2.css');
  assert.match(app, /pastureSheepPreview/);
  assert.match(app, /maker-screen-one/);
  assert.match(app, /maker-screen-four/);
  assert.match(app, /data-maker-dimension/);
  assert.match(app, /data-maker-option/);
  assert.match(app, /PastureSheepRenderer/);
  assert.match(app, /appearanceVersion:2/);
  assert.doesNotMatch(app, /<select\b/i);
  assert.doesNotMatch(app, /makerRects|drawMakerSheep/);
  assert.match(css, /\.maker-dimension\{/);
  assert.match(css, /\.maker-options-panel\{/);
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

test('production pasture exposes email auth and the V2 first-entry identity flow', () => {
  const app = read('pasture-live.js');
  assert.match(app, /requestCode/);
  assert.match(app, /verifyCode/);
  assert.match(app, /saveSheep/);
  assert.match(app, /maker-you">你/);
  assert.match(app, /appearanceVersion:2/);
  assert.doesNotMatch(app, /属于自己的羊|我的羊|领养|宠物/);
});

test('find-sheep interaction is exact-pixel and uses only approved mp3 inside core canvas', () => {
  const shell = read('pasture-live.js');
  const engine = read('pasture-resident-core.js');
  assert.doesNotMatch(read('pasture-live.html'), /residentCanvas/);
  assert.match(shell, /pasture-resident-core\.js/);
  assert.match(engine, /environmentLayer/);
  assert.match(engine, /maskCtx/);
  assert.match(engine, /getImageData/);
  assert.match(engine, /PIXEL_HAND_OPEN/);
  assert.match(engine, /pasture-assets\/baaa01\.mp3/);
  assert.doesNotMatch(engine, /createOscillator|OscillatorNode/);
  assert.ok(fs.existsSync('pasture-assets/baaa01.mp3'));
});

test('production API stores residents without requiring main schema replacement', () => {
  const store = read('api/_security/pasture-auth-store.js');
  assert.match(store, /CREATE TABLE IF NOT EXISTS pasture_users/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS pasture_sessions/);
  assert.match(store, /CREATE TABLE IF NOT EXISTS pasture_sheep/);
  assert.match(store, /appearance_v2/);
  assert.match(store, /neon\(/);
});
