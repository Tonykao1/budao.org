const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8')}

test('resident sheep is rendered and interacted with inside the pasture core canvas',()=>{
  const liveHtml=read('pasture-live.html');
  const liveJs=read('pasture-live.js');
  const core=read('tonglu-core.html');

  assert.doesNotMatch(liveHtml,/id="residentCanvas"/, 'outer resident canvas must be removed');
  assert.match(liveJs,/tonglu-resident-v1/, 'shell must send resident identity into the pasture core');
  assert.doesNotMatch(liveJs,/function drawSheep\(/, 'shell must not render resident sheep itself');

  assert.match(core,/tonglu-resident-v1/, 'pasture core must receive resident identity');
  assert.match(core,/function drawResidentSheep\(/, 'pasture core must render the resident sheep');
  assert.match(core,/function residentSheepHit\(/, 'pasture core must own exact-pixel hit testing');
  assert.match(core,/PIXEL_HAND_OPEN/, 'pasture core must own the five-finger shepherd hand cursor');
  assert.match(core,/baaa01\.mp3/, 'pasture core must own the approved sheep bleat');
});

test('first-entry sheep identity remains a real visual maker before entering the flock',()=>{
  const liveJs=read('pasture-live.js');
  assert.match(liveJs,/id=\\"pastureSheepPreview\\"/, 'maker must include a live sheep preview');
  assert.match(liveJs,/data-sheep-body/, 'maker must expose visual wool choices');
  assert.match(liveJs,/data-sheep-head/, 'maker must expose visual face choices');
  assert.match(liveJs,/data-sheep-mark/, 'maker must expose visual marking choices');
  assert.match(liveJs,/这就是我 · 进入牧场/, 'maker must end with identity confirmation');
});
