'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('the accepted v18 has 26 freely distributed adults across depth, not old fixed sheep',()=>{
 const v18=read('tonglu-pasture-v18.html');
 assert.match(v18,/budao-free-adult-/);
 assert.match(v18,/function flockScaleAtY\(y\)/);
 assert.match(v18,/cand\.y=160\+rand\(\)\*126/);
 assert.match(v18,/cand\.s=flockScaleAtY\(cand\.y\)/);
 assert.match(v18,/function flockForbidden/);
 assert.equal((v18.match(/m:'(?:wander|idle|graze)'/g)||[]).length,26);
});
test('the accepted v20 draws five or six lying adults each day without wandering',()=>{
 const v20=read('tonglu-pasture-v20.html');
 assert.match(v20,/function sheepRestBody/);
 assert.match(v20,/budao-rest-adult-/);
 assert.match(v20,/const restCount=5\+/);
 assert.match(v20,/o\.rest=restSet\.has\(i\)/);
 assert.match(v20,/if\(!o\.rest\)/);
 assert.match(v20,/if\(o\.rest\)\{rect/);
 assert.match(v20,/rest:!!o\.rest/);
});
test('18 freely distributed lambs include 1 or 2 lying, preserve the sheep of the resident',()=>{
 const scene=read('tonglu-core.html');
 assert.match(scene,/budao-free-lamb-/);
 assert.match(scene,/function lambScaleAtY/);
 assert.match(scene,/function drawDesktopRestingLamb/);
 assert.match(scene,/budao-lamb-rest-/);
 assert.match(scene,/const restTarget=1\+/);
 assert.match(scene,/o\.rest\?drawDesktopRestingLamb/);
 assert.match(scene,/Array\(17\)\.fill\('normal'\)\.concat\('blackwhite'\)/);
 const engine=read('pasture-resident-core.js');
 assert.match(engine,/function residentSheepHit/);
 assert.match(engine,/PIXEL_HAND_OPEN/);
 assert.match(engine,/PIXEL_HAND_CLOSED/);
 assert.match(engine,/baaa01\.mp3/);
 assert.match(engine,/let drag=null/);
 assert.match(engine,/getImageData/);
});
test('Preview and first-card user registration load the same locally restored final landscape',()=>{
 const scene=read('tonglu-core.html');
 const preview=read('pasture-preview/index.html');
 const first=read('admin/pasture-first-card.html');
 assert.match(scene,/src="\/tonglu-pasture-v20\.html\?v=20261005freeflock"/);
 assert.match(preview,/html=html\.replace\('https:\/\/budao\.org\/tonglu\.html','\/pasture-preview\/tonglu-final-bridge\.html'\)/);
 assert.match(first,/href="\/pasture-preview\/"/);
 assert.match(preview,/pasture-resident-auth\.js/);
 assert.match(preview,/pasture-hand-cursor\.js/);
});

test('approved astronomical sky and responsive portrait are present without losing the resident sheep',()=>{
 const scene=read('tonglu-core.html'),portrait=read('tonglu-pasture-portrait.html');
 const sky=read('pasture-sky-engine.js'),stars=read('pasture-stars.js');
 assert.match(scene,/src="\/pasture-sky-engine\.js"/);
 assert.match(scene,/src="\/pasture-stars\.js"/);
 assert.match(scene,/function drawCelestial/);
 assert.match(scene,/function refreshSkyState/);
 assert.match(scene,/function updateMeteor/);
 assert.match(scene,/skyState/);
 assert.match(scene,/portraitResident/);
 assert.match(read('pasture-resident-core.js'),/function paintResident/);
 assert.match(portrait,/src="\/pasture-sky-engine\.js"/);
 assert.match(portrait,/function drawSharedCelestial/);
 assert.match(portrait,/drawSharedCelestial\(now,cloud,c\)/);
 assert.match(portrait,/function drawResidentLamb/);
 assert.match(portrait,/residentArrivalNonce/);
 assert.match(sky,/computeSkyState/);
 assert.match(stars,/BudaoPastureStars/);
});
test('all restored pasture HTML entry points have parseable inline JavaScript',()=>{
 const vm=require('node:vm');
 for(const page of ['tonglu.html','tonglu-core.html','pasture-preview/tonglu-final-bridge.html','tonglu-pasture-portrait.html',
    'tonglu-pasture-v18.html','tonglu-pasture-v19.html','tonglu-pasture-v20.html']){
  const html=read(page);
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
  assert.ok(scripts.length>=1,page+' has executable inline script');
  for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script,{filename:page}),page);
 }
});
