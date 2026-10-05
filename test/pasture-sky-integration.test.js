const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'tonglu.html'), 'utf8');
const portrait = fs.readFileSync(path.join(root, 'tonglu-pasture-portrait.html'), 'utf8');
const sky = require('../pasture-sky-engine.js');
const stars = require('../pasture-stars.js');

test('landscape loads shared sky modules and removes legacy fixed stars and moon projection', () => {
  assert.match(main, /<script src="\/pasture-stars\.js"><\/script>/);
  assert.match(main, /<script src="\/pasture-sky-engine\.js"><\/script>/);
  assert.doesNotMatch(main, /function stars\(darkness,cloud\)/);
  assert.doesNotMatch(main, /function moonScreenPosition\(/);
  assert.doesNotMatch(main, /moonXY=moonScreenPosition/);
});

test('landscape celestial geometry uses the confirmed sea-sky boundary at y 96', () => {
  assert.match(main, /const LANDSCAPE_SKY_BOTTOM=96/);
  assert.match(main, /skyBottom:LANDSCAPE_SKY_BOTTOM/);
  const p = sky.projectHorizontal({altitudeDeg:.1,azimuthDeg:10,centerAzimuthDeg:10,width:480,skyTop:0,skyBottom:96});
  assert.ok(p && p.y < 96);
});

test('shared sky state is cached on a 30-60 second cadence while weather stays 10 minutes', () => {
  assert.match(main, /skyState=null/);
  assert.match(main, /setInterval\(refreshSkyState,45000\)/);
  assert.match(main, /setInterval\(refresh,600000\)/);
  assert.doesNotMatch(main, /setInterval\(refreshSkyState,120\)/);
});

test('computeSkyState preserves one Jerusalem-centered celestial identity set', () => {
  assert.equal(typeof sky.computeSkyState, 'function');
  const state = sky.computeSkyState({
    timeMs: Date.UTC(2026,9,5,12), latitude:39.9042, longitude:116.4074,
    cloudCover:20, weatherCode:0, stars
  });
  assert.ok(Number.isFinite(state.centerAzimuthDeg));
  assert.ok(Number.isFinite(state.sun.altitudeDeg));
  assert.ok(Number.isFinite(state.moon.altitudeDeg));
  assert.ok(Array.isArray(state.stars));
  assert.deepEqual(state.stars.map(s=>s.id), stars.map(s=>s.id));
});

test('parent sends the same skyState to portrait', () => {
  assert.match(main, /tonglu-environment-v1',state:\{\.\.\.state,skyState\}/);
});

test('portrait consumes shared sky engine and no longer owns separate astronomy', () => {
  assert.match(portrait, /<script src="\/pasture-sky-engine\.js"><\/script>/);
  assert.doesNotMatch(portrait, /function moonEphemeris\(/);
  assert.doesNotMatch(portrait, /function moonScreenPosition\(/);
  assert.match(portrait, /state\?\.skyState/);
});

test('portrait derives celestial bottom from the same top sky band geometry', () => {
  assert.match(portrait, /function portraitSkyBottom\(\)/);
  assert.match(portrait, /const skyBottom=portraitSkyBottom\(\)/);
  assert.doesNotMatch(portrait, /skyBand=portrait\?H\*\.28:100/);
});

test('neutral catalog colorIndex zero is rendered neutral, not falsely cool', () => {
  for (const source of [main, portrait]) {
    assert.match(source, /cool=Number\.isFinite\(ci\)&&ci<-\.05/);
    assert.match(source, /warm=Number\.isFinite\(ci\)&&ci>0?\.65/);
  }
});