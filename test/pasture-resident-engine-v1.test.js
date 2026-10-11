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
  assert.match(engine,/PastureSheepRenderer/, 'resident engine must use the shared sheep renderer');
  assert.match(engine,/Renderer\.draw\(/, 'resident engine must render the resident sheep through shared geometry');
  assert.match(engine,/Renderer\.drawMask\(/, 'exact-pixel mask must come from the same shared geometry');
  assert.match(engine,/function residentSheepHit\(/, 'resident engine must own exact-pixel hit testing');
  assert.match(engine,/PIXEL_HAND_OPEN/, 'resident engine must own the five-finger shepherd hand cursor');
  assert.match(engine,/baaa01\.mp3/, 'resident engine must own the approved sheep bleat');
  assert.doesNotMatch(engine,/createOscillator|OscillatorNode/, 'resident engine must never synthesize a sheep sound');
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

test('resident sheep carries about forty percent more life without changing its grab geometry or saved position',()=>{
  const renderer=read('pasture-sheep-renderer.js');
  const engine=read('pasture-resident-core.js');
  assert.match(renderer,/RESIDENT_LIFE_BOOST\s*=\s*\.40/, 'resident life target must be explicitly locked at +40%');
  assert.match(renderer,/function residentLifeState\(/, 'shared renderer must derive repeatable resident micro-life states');
  assert.match(renderer,/blink|chew|earTwitch|breath/, 'resident life must include several quiet micro gestures');
  assert.match(renderer,/__tongluFlockCount\s*===\s*45/, 'extra life must apply only to the resident sheep in the 44+1 pasture context');
  assert.match(renderer,/role==='eye'|role === 'eye'/, 'blink must stay inside existing face geometry');
  assert.match(renderer,/role==='ear'|role === 'ear'/, 'ear response must stay inside existing ear geometry');
  assert.match(engine,/Renderer\.drawMask\(/, 'grab mask must remain the canonical shared geometry');
  assert.doesNotMatch(engine,/pos\.x\s*[+\-]=|pos\.y\s*[+\-]=/, 'life motion must never migrate the saved resident position');
  assert.doesNotMatch(engine,/requestAnimationFrame\(render\)/, 'extra life must reuse pasture redraws rather than add a permanent render loop');
});

test('approved mp3 bleat is 0.90 seconds and spatialized from sheep position',()=>{
  const engine=read('pasture-resident-core.js');
  const match=engine.match(/BLEAT_STOP_MS\s*=\s*(\d+)/);
  assert.ok(match, 'bleat must have an explicit stop point');
  assert.equal(Number(match[1]),900, 'bleat stop point must be exactly 900ms');
  assert.match(engine,/function sheepAudioSpace\(/, 'audio must derive distance and pan from the sheep position');
  assert.match(engine,/createMediaElementSource/, 'approved MP3 must be routed through Web Audio without synthesis');
  assert.match(engine,/createGain/, 'distance must control volume through a gain node');
  assert.match(engine,/createStereoPanner/, 'horizontal position must control stereo pan');
  assert.match(engine,/gain\.value/, 'computed distance must change output volume');
  assert.match(engine,/pan\.value/, 'computed horizontal position must change stereo pan');
  assert.match(engine,/setTimeout\([^\n]*bleat\.pause/, 'bleat playback must pause at the stop point');
  assert.doesNotMatch(engine,/createOscillator|OscillatorNode/, 'spatialization must not synthesize any sound');
});

test('first-entry sheep identity remains a visual maker before entering the flock',()=>{
  const liveJs=read('pasture-live.js');
  assert.match(liveJs,/id=\"pastureSheepPreview\"/, 'maker must include a live sheep preview');
  assert.match(liveJs,/data-maker-dimension/, 'maker must expose visual identity dimensions');
  assert.match(liveJs,/data-maker-option/, 'maker must expose visual options');
  assert.match(liveJs,/PastureSheepRenderer/, 'maker preview must share the flock renderer');
  assert.match(liveJs,/appearanceVersion:2/, 'maker must save the V2 sheep identity');
  assert.match(liveJs,/maker-you">你/, 'first maker screen must be the minimal identity cue');
  assert.match(liveJs,/maker-confirm','✓'/, 'maker must end with the minimal checkmark confirmation');
  assert.doesNotMatch(liveJs,/这就是我 · 进入牧场|捏一只羊/, 'legacy explanatory maker copy must not return');
});
