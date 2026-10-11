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

test('first-entry sheep identity remains a real visual maker before entering the flock',()=>{
  const liveJs=read('pasture-live.js');
  assert.match(liveJs,/id=\"pastureSheepPreview\"/, 'maker must include a live sheep preview');
  assert.match(liveJs,/data-sheep-body/, 'maker must expose visual wool choices');
  assert.match(liveJs,/data-sheep-head/, 'maker must expose visual face choices');
  assert.match(liveJs,/data-sheep-mark/, 'maker must expose visual marking choices');
  assert.match(liveJs,/这就是我 · 进入牧场/, 'maker must end with identity confirmation');
});
