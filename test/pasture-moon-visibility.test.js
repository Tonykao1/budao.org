const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sky = require('../pasture-sky-engine.js');

test('daylight moon hides the dark side and softens the bright side', () => {
  assert.equal(typeof sky.moonVisualProfile, 'function');
  const day = sky.moonVisualProfile(20);
  assert.equal(day.darkAlpha, 0);
  assert.equal(day.brightAlpha, 0.45);
  const horizon = sky.moonVisualProfile(0);
  assert.equal(horizon.darkAlpha, 0);
  assert.equal(horizon.brightAlpha, 0.45);
});

test('moon appearance returns continuously through twilight and reaches full night by -12 degrees', () => {
  const a = sky.moonVisualProfile(0);
  const b = sky.moonVisualProfile(-3);
  const c = sky.moonVisualProfile(-6);
  const d = sky.moonVisualProfile(-9);
  const e = sky.moonVisualProfile(-12);
  assert.ok(a.brightAlpha < b.brightAlpha && b.brightAlpha < c.brightAlpha && c.brightAlpha < d.brightAlpha && d.brightAlpha < e.brightAlpha);
  assert.ok(a.darkAlpha < b.darkAlpha && b.darkAlpha < c.darkAlpha && c.darkAlpha < d.darkAlpha && d.darkAlpha < e.darkAlpha);
  assert.deepEqual(e, {brightAlpha:1,darkAlpha:1});
  const left = sky.moonVisualProfile(-5.999);
  const right = sky.moonVisualProfile(-6.001);
  assert.ok(Math.abs(left.brightAlpha-right.brightAlpha) < 0.01);
  assert.ok(Math.abs(left.darkAlpha-right.darkAlpha) < 0.01);
});

test('both pasture renderers consume the shared solar-altitude moon profile', () => {
  for (const file of ['tonglu.html','tonglu-pasture-portrait.html']) {
    const source = fs.readFileSync(path.join(__dirname,'..',file),'utf8');
    assert.match(source, /moonVisualProfile\(/, `${file} must use moonVisualProfile`);
    assert.match(source, /darkAlpha/, `${file} must apply dark-side alpha`);
    assert.match(source, /brightAlpha/, `${file} must apply bright-side alpha`);
  }
});
