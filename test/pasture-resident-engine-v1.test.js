const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8')}

test('resident sheep is rendered and interacted with inside the pasture core canvas',()=>{
  const liveHtml=read('pasture-live.html');
  const liveJs=read('pasture-live.js');
  const engine=read('pasture-resident-core.js');

  assert.doesNotMatch(liveHtml,/id="residentCanvas"/, 'outer resident canvas must be removed');
  assert.match(liveJs,/tonglu-resident-v1/, 'shell must send resident identity into the pasture core');
  assert.match(liveJs,/pasture-resident-core\.js/, 'shell must load the resident engine inside the core iframe');
  assert.doesNotMatch(liveJs,/function drawSheep\(/, 'shell must not render resident sheep itself');

  assert.match(engine,/environmentLayer/, 'resident engine must use the pasture core canvas');
  assert.match(engine,/tonglu-resident-v1/, 'resident engine must receive resident identity');
  assert.match(engine,/function drawResidentSheep\(/, 'resident engine must render the resident sheep');
  assert.match(engine,/function residentSheepHit\(/, 'resident engine must own exact-pixel hit testing');
  assert.match(engine,/PIXEL_HAND_OPEN/, 'resident engine must own the five-finger shepherd hand cursor');
  assert.match(engine,/baaa01\.mp3/, 'resident engine must own the approved sheep bleat');
  assert.doesNotMatch(engine,/AudioContext|createOscillator|webkitAudioContext/, 'resident engine must not synthesize audio');
});

test('resident sheep is repainted after each core clear without racing it with a permanent render loop',()=>{
  const engine=read('pasture-resident-core.js');
  assert.match(engine,/originalClearRect/, 'resident engine must hook the existing core clear pass');
  assert.match(engine,/queueMicrotask/, 'resident paint must happen in the same browser task before the next screen paint');
  assert.match(engine,/paintResident/, 'resident engine must expose one resident paint function');
  assert.doesNotMatch(engine,/requestAnimationFrame\(render\)/, 'resident engine must not race the core with its own permanent render loop');
});

test('approved mp3 bleat is cut off after the natural call body so no trailing tail can play',()=>{
  const engine=read('pasture-resident-core.js');
  assert.match(engine,/BLEAT_STOP_MS/, 'bleat must have an explicit stop point');
  assert.match(engine,/setTimeout\([^\n]*bleat\.pause/, 'bleat playback must pause at the stop point');
  assert.doesNotMatch(engine,/AudioContext|createOscillator|webkitAudioContext/, 'no synthetic tail is allowed');
});

test('first-entry sheep identity remains a real visual maker before entering the flock',()=>{
  const liveJs=read('pasture-live.js');
  assert.match(liveJs,/id=\"pastureSheepPreview\"/, 'maker must include a live sheep preview');
  assert.match(liveJs,/data-sheep-body/, 'maker must expose visual wool choices');
  assert.match(liveJs,/data-sheep-head/, 'maker must expose visual face choices');
  assert.match(liveJs,/data-sheep-mark/, 'maker must expose visual marking choices');
  assert.match(liveJs,/这就是我 · 进入牧场/, 'maker must end with identity confirmation');
});
