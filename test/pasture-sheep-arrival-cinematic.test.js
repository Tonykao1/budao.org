const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const core=fs.readFileSync('pasture-resident-core.js','utf8');
const live=fs.readFileSync('pasture-live.js','utf8');

test('first-created resident is the only path that requests the cinematic arrival',()=>{
  assert.match(live,/applyResident\(!!data\.created\)/);
  assert.match(core,/if\(e\.data\.arrival\)startArrivalCinematic\(\)/);
  assert.equal((core.match(/startArrivalCinematic\(\)/g)||[]).length,2);
});

test('arrival uses a temporary full-screen cinematic layer and the shared sheep renderer',()=>{
  assert.match(core,/function ensureArrivalCanvas\(/);
  assert.match(core,/arrivalCanvas\.style\.position='fixed'/);
  assert.match(core,/arrivalCanvas\.style\.pointerEvents='none'/);
  const arrivalDraw=core.slice(core.indexOf('function drawArrivalSheep'),core.indexOf('function arrivalFrame'));
  assert.match(arrivalDraw,/const c=arrivalCtx/);
  assert.match(arrivalDraw,/Renderer\.draw\(c,/);
  assert.match(core,/function destroyArrivalCanvas\(/);
});

test('arrival is deliberately oversized, multi-phase and ends by revealing the real flock sheep',()=>{
  assert.match(core,/const ARRIVAL_DURATION_MS=3800/);
  assert.match(core,/const ARRIVAL_IMPACT_AT=\.68/);
  assert.match(core,/const ARRIVAL_CLOSEUP_UNIT=11/);
  assert.match(core,/requestAnimationFrame\(arrivalFrame\)/);
  assert.match(core,/function arrivalFrame\(/);
  assert.match(core,/impactParticles/);
  assert.match(core,/arrivalShake/);
  assert.match(core,/arrivalStart=0/);
  assert.match(core,/queueResidentPaint\(\)/);
});

test('impact uses only the approved sheep mp3 and does not introduce synthesized audio',()=>{
  assert.match(core,/if\(!arrivalImpactPlayed&&progress>=ARRIVAL_IMPACT_AT\)[\s\S]*playBleat\(\)/);
  assert.doesNotMatch(core,/createOscillator|OscillatorNode/);
  assert.match(core,/BLEAT_URL='\/pasture-assets\/baaa01\.mp3'/);
});
