const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const core=fs.readFileSync('pasture-resident-core.js','utf8');
const live=fs.readFileSync('pasture-live.js','utf8');

test('first-created resident is the only production path that requests the cinematic arrival',()=>{
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

test('arrival is deliberately three-times wilder and still resolves into the real flock sheep',()=>{
  assert.match(core,/const ARRIVAL_DURATION_MS=4200/);
  assert.match(core,/const ARRIVAL_IMPACT_AT=\.72/);
  assert.match(core,/const ARRIVAL_CLOSEUP_UNIT=28/);
  assert.match(core,/const ARRIVAL_SPEED_LINE_COUNT=60/);
  assert.match(core,/const ARRIVAL_PARTICLE_COUNT=100/);
  assert.match(core,/const ARRIVAL_SHAKE_PEAK=21/);
  assert.match(core,/Array\.from\(\{length:ARRIVAL_PARTICLE_COUNT\}/);
  assert.match(core,/for\(let i=0;i<ARRIVAL_SPEED_LINE_COUNT;i\+\+\)/);
  assert.match(core,/function drawImpactFlash\(/);
  assert.match(core,/function arrivalShakeAmount\(/);
  assert.match(core,/squash/);
  assert.match(core,/bounce/);
  assert.match(core,/requestAnimationFrame\(arrivalFrame\)/);
  assert.match(core,/arrivalStart=0/);
  assert.match(core,/queueResidentPaint\(\)/);
});

test('impact uses only the approved sheep mp3 and does not introduce synthesized audio',()=>{
  assert.match(core,/if\(!arrivalImpactPlayed&&progress>=ARRIVAL_IMPACT_AT\)[\s\S]*playBleat\(\)/);
  assert.doesNotMatch(core,/createOscillator|OscillatorNode/);
  assert.match(core,/BLEAT_URL='\/pasture-assets\/baaa01\.mp3'/);
});

test('existing resident can rehearse arrival only on a vercel preview hostname without saving identity',()=>{
  assert.match(live,/function wantsArrivalReview\(/);
  assert.match(live,/hostname\.endsWith\('\.vercel\.app'\)/);
  assert.match(live,/sheepArrivalReview/);
  const boot=live.slice(live.indexOf('async function boot'));
  assert.match(boot,/if\(wantsArrivalReview\(\)\)return applyResident\(true\)/);
  assert.doesNotMatch(boot,/saveSheep/);
});
