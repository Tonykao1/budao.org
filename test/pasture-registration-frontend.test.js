const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('stable pasture loads resident runtime without rewriting tonglu composition', () => {
  const sky = read('pasture-sky-engine.js');
  assert.match(sky, /pasture-resident-runtime\.js/);
  assert.match(sky, /window\.top!==window/);
  assert.match(sky, /environmentLayer/);
  assert.equal(fs.existsSync('pasture-resident-runtime.js'), true, 'resident runtime is missing');
});

test('guest sees no feature controls; authenticated resident sees seven locked controls', () => {
  const runtime = read('pasture-resident-runtime.js');
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
  const runtime = read('pasture-resident-runtime.js');
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
  const runtime = read('pasture-resident-runtime.js');
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

test('find-sheep interaction uses visible pixels, a five-finger pixel hand, and only the supplied baa audio', () => {
  const runtime = read('pasture-resident-runtime.js');
  assert.match(runtime, /function residentHit/);
  assert.match(runtime, /hitRect/);
  assert.match(runtime, /transparent gaps|visible pixels/i);
  assert.match(runtime, /PIXEL_HAND_OPEN/);
  for (const x of ['10','17','24','31','38']) assert.match(runtime, new RegExp(`x=%22${x}%22`));
  assert.match(runtime, /baaa01\.mp3/);
  assert.doesNotMatch(runtime, /AudioContext|webkitAudioContext|createOscillator|OscillatorNode/);
  assert.equal(fs.existsSync('pasture-preview/assets/baaa01.mp3'), true, 'approved baa audio is missing');
});
