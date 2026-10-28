'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('final 44+1 core restores exact accepted spatial bleat and scale instead of playing raw demo audio',()=>{
 const engine=read('pasture-resident-core.js');
 assert.match(engine,/const BLEAT_URL='\/pasture-preview\/assets\/baaa01\.mp3'/);
 assert.equal(Number(engine.match(/const BLEAT_STOP_MS=(\d+)/)?.[1]),900);
 assert.match(engine,/function scaleAtY\(y\)/);
 assert.match(engine,/return\(\.32\+t\*\.84\)\*\.56/);
 assert.match(engine,/function sheepAudioSpace\(\)/);
 assert.match(engine,/volume=\.28\+\.72\*depth/);
 assert.match(engine,/Math\.max\(-\.9,Math\.min\(\.9,/);
 assert.match(engine,/createMediaElementSource/);
 assert.match(engine,/createGain\(\)/);
 assert.match(engine,/createStereoPanner\(\)/);
 assert.match(engine,/bleatGain\.gain\.value=space\.volume/);
 assert.match(engine,/bleatPan\.pan\.value=space\.pan/);
 assert.match(engine,/bleatStopTimer=setTimeout/);
 assert.doesNotMatch(engine,/createOscillator|OscillatorNode/);
 assert.ok(fs.statSync(path.join(__dirname,'../pasture-preview/assets/baaa01.mp3')).size>1000);
});
test('final resident cursor hitboxes, landscape, hand and album sources all exist',()=>{
 const engine=read('pasture-resident-core.js'),core=read('tonglu-core.html');
 assert.match(engine,/function residentSheepHit\(/);
 assert.match(engine,/getImageData/);
 assert.match(engine,/PIXEL_HAND_OPEN/);
 assert.match(engine,/PIXEL_HAND_CLOSED/);
 assert.match(engine,/walkableFootPoint/);
 assert.match(engine,/bridgeContains/);
 assert.match(engine,/RIVER_POLYGON/);
 assert.match(engine,/tonglu-resident-clear-v1/);
 assert.match(core,/__tongluCoreRedrawV1/);
 assert.match(core,/src="\/tonglu-pasture-v20.html\?v=20261005freeflock"/);
 assert.match(core,/pasture-sky-engine\.js/);
 assert.match(core,/pasture-stars\.js/);
 assert.match(core,/portraitResident/);
});
test('preview bridge preserves original verified resident gate and listens only to parent same-origin',()=>{
 const bridge=read('pasture-preview/tonglu-final-bridge.html');
 const entry=read('pasture-preview/index.html');
 const gate=read('pasture-preview/pasture-resident-gate.js');
 assert.match(entry,/\/pasture-preview\/tonglu-final-bridge\.html/);
 assert.match(bridge,/src="\/tonglu-core.html\?v=/);
 assert.match(bridge,/e\.source!==window\.parent/);
 assert.match(bridge,/e\.origin!==location\.origin/);
 assert.match(bridge,/e\.data\?\.type!=='pasture-resident-session-v1'/);
 assert.match(bridge,/type:'tonglu-resident-v1'/);
 assert.match(bridge,/type:'tonglu-resident-clear-v1'/);
 assert.match(bridge,/\/pasture-sheep-dna\.js/);
 assert.match(bridge,/\/pasture-sheep-renderer\.js/);
 assert.match(bridge,/\/pasture-resident-core\.js/);
 assert.match(gate,/resident\?\.cardActivated===true/);
 assert.match(gate,/RESIDENT_OPEN_FEATURES=new Set\(\['budaoCardBtn'\]\)/);
 assert.match(gate,/type:'pasture-resident-session-v1'/);
 assert.doesNotMatch(bridge,/localStorage|sessionStorage|activateCard|cardActivated=true/);
});
test('the bridge and final resident core have valid JS syntax',()=>{
 const html=read('pasture-preview/tonglu-final-bridge.html');
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)){
  assert.doesNotThrow(()=>new vm.Script(m[1]));
 }
 for(const p of ['pasture-resident-core.js','pasture-sheep-dna.js','pasture-sheep-renderer.js'])assert.doesNotThrow(()=>new vm.Script(read(p),{filename:p}));
});
