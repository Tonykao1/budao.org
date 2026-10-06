const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function runtimeSource() {
  return read('pasture-resident-runtime-core.js');
}

test('stable pasture loads resident runtime without rewriting tonglu composition', () => {
  const sky = read('pasture-sky-engine.js');
  const loader = read('pasture-resident-runtime.js');
  assert.match(sky, /pasture-resident-runtime\.js/);
  assert.match(sky, /window\.top!==window/);
  assert.match(sky, /environmentLayer/);
  assert.match(loader, /pasture-resident-runtime-core\.js/);
  assert.match(loader, /pasture-resident-hit-layer\.js/);
  assert.equal(fs.existsSync('pasture-resident-runtime-core.js'), true, 'resident runtime core is missing');
});

test('guest sees no feature controls; authenticated resident sees seven locked controls', () => {
  const runtime = runtimeSource();
  assert.match(runtime, /pastureResidentControls/);
  assert.match(runtime, /hidden\s*=\s*!authenticated|hidden=!authenticated/);
  for (const label of ['归回自己','我的牧草','风闻有你','同路伙伴','信箱','步道卡','小匣']) {
    assert.match(runtime, new RegExp(label));
  }
  assert.match(runtime, /aria-disabled/);
  assert.match(runtime, /pasture-feature-locked/);
  assert.doesNotMatch(runtime, /我的羊|你的羊|拥有一只属于自己的羊/);
});

test('resident auth covers email code, session boot, logout and sheep creation', () => {
  const runtime = runtimeSource();
  assert.match(runtime, /\/api\/pasture-auth/);
  assert.match(runtime, /requestCode/);
  assert.match(runtime, /verifyCode/);
  assert.match(runtime, /saveSheep/);
  assert.match(runtime, /action:\s*['"]logout['"]/);
  assert.match(runtime, /credentials:\s*['"]include['"]/);
  assert.match(runtime, /email_unavailable/);
  assert.match(runtime, /这就是我[^\n]*进入牧场/);
});

test('resident is the 44+1 sheep, falls from the sky once, and remains deterministically findable', () => {
  const runtime = runtimeSource();
  assert.match(runtime, /__tongluFlockCount\s*=\s*resident\?45:44/);
  assert.match(runtime, /1750/);
  assert.match(runtime, /-26/);
  assert.match(runtime, /pasture-resident-/);
  assert.match(runtime, /flockDateKey/);
  assert.match(runtime, /resident\.id/);
  assert.match(runtime, /localStorage/);
  assert.match(runtime, /portrait/);
  assert.match(runtime, /landscape/);
});

test('daily resident position sync is server-first and local storage is cache fallback only',()=>{
  const loader=read('pasture-resident-runtime.js');
  assert.match(loader,/pasture-resident-position-sync\.js/);
  const sync=read('pasture-resident-position-sync.js');
  assert.match(sync,/async function loadDailyResidentPosition\(dateKey,mode\)/);
  assert.match(sync,/action:'getDailySheepPosition'/);
  assert.match(sync,/(?:runtime\(\)|rt)\.call/);
  assert.match(sync,/localStorage\.getItem/);
  assert.match(sync,/catch[\s\S]*loadCachedPosition/);
  assert.match(sync,/async function saveDailyResidentPosition\(dateKey,mode,layout\)/);
  assert.match(sync,/action:'saveDailySheepPosition'/);
  assert.match(sync,/localStorage\.setItem/);
  assert.match(sync,/pointerup/);
  assert.match(sync,/PastureResidentPositionSync/);
});

test('find-sheep interaction uses visible pixels, a five-finger pixel hand, and only the supplied baa audio', () => {
  const runtime = runtimeSource();
  assert.match(runtime, /function residentHit/);
  assert.match(runtime, /hitRect/);
  assert.match(runtime, /transparent gaps|visible pixels/i);
  assert.match(runtime, /PIXEL_HAND_OPEN/);
  for (const x of ['10','17','24','31','38']) assert.match(runtime, new RegExp(`x=%22${x}%22`));
  assert.match(runtime, /baaa01\.mp3/);
  assert.doesNotMatch(runtime, /AudioContext|webkitAudioContext|createOscillator|OscillatorNode/);
  assert.equal(fs.existsSync('pasture-preview/assets/baaa01.mp3'), true, 'approved baa audio is missing');
});

test('portrait interaction crosses the iframe safely using an exact-pixel SVG hit layer', () => {
  const hit = read('pasture-resident-hit-layer.js');
  assert.match(hit, /pastureResidentHitSvg/);
  assert.match(hit, /createElementNS\([^\n]*['"]svg['"]/);
  assert.match(hit, /pointerEvents:\s*['"]none['"]/);
  assert.match(hit, /pointerEvents\s*=\s*['"]all['"]/);
  assert.match(hit, /setPointerCapture/);
  assert.match(hit, /releasePointerCapture/);
  assert.match(hit, /updateHitLayer/);
  assert.match(hit, /hitRects/);
  assert.match(hit, /portraitFrame/);
});
