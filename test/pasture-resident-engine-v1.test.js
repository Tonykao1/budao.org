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

test('resident sheep is painted before the scene night tint and the tint color is restored afterwards',()=>{
  const engine=read('pasture-resident-core.js');
  assert.match(engine,/isSceneTintFill/, 'resident engine must recognize the pasture full-scene tint pass');
  assert.match(engine,/const sceneTint=ctx\.fillStyle/, 'resident paint must save the original night/twilight tint');
  assert.match(engine,/ctx\.fillStyle=sceneTint/, 'resident paint must restore the original night/twilight tint before the full-scene fill');
  assert.doesNotMatch(engine,/requestAnimationFrame\(render\)/, 'resident engine must not race the core with its own permanent render loop');
});

test('resident placement uses the feet point: grass edges and the log bridge are valid, river water is not',()=>{
  const engine=read('pasture-resident-core.js');
  assert.match(engine,/RIVER_POLYGON/, 'river water must be represented by the actual river polygon');
  assert.match(engine,/BRIDGE_RECT/, 'log bridge must be an explicit walkable surface');
  assert.match(engine,/function pointInPolygon\(/, 'terrain decision must use point-in-polygon geometry');
  assert.match(engine,/function walkableFootPoint\(/, 'placement must test the sheep feet point');
  assert.doesNotMatch(engine,/right=x\+21\*s|left=x-2\*s/, 'the whole sheep bounding box must no longer block river-edge placement');
});

test('approved mp3 bleat is cut at the user-approved 1.00 second point',()=>{
  const engine=read('pasture-resident-core.js');
  const match=engine.match(/BLEAT_STOP_MS\s*=\s*(\d+)/);
  assert.ok(match, 'bleat must have an explicit stop point');
  assert.equal(Number(match[1]),1000, 'bleat stop point must be exactly 1000ms');
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
