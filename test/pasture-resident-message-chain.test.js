'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('verified sheep is resent when nested final frame reports readiness, even if load state races',()=>{
 const src=read('pasture-preview/pasture-resident-gate.js');
 const sent=[],listeners={};
 const frame={postMessage:(data)=>sent.push(data)};
 const scene={contentWindow:frame,contentDocument:{readyState:'loading'},addEventListener:()=>{}};
 const parent={location:{origin:'https://preview.example'},postMessage:(data)=>sent.push(data)};
 const win={parent,addEventListener:(event,listener)=>listeners[event]=listener};
 const cls={toggle:()=>{}};
 const document={
  body:{classList:cls},querySelector:q=>q==='.scene'?scene:null,
  querySelectorAll:()=>[],addEventListener:()=>{},dispatchEvent:()=>{}
 };
 const ctx={document,window:win,CustomEvent:class CustomEvent{},console};
 vm.runInNewContext(src,ctx);
 assert.equal(typeof win.PastureResidentGate.setResident,'function');
 const resident={id:'resident-1',sheep:{id:'sheep-1',appearanceVersion:2},cardActivated:false};
 win.PastureResidentGate.setResident(resident);
 assert.equal(sent.filter(e=>e.type==='pasture-resident-session-v1').length,0,'load race simulated');
 listeners.message({origin:parent.location.origin,source:frame,data:{type:'pasture-final-core-ready-v1'}});
 const forwarded=sent.filter(e=>e.type==='pasture-resident-session-v1');
 assert.equal(forwarded.length,1);
 assert.equal(forwarded[0].resident.id,'resident-1');
 assert.equal(forwarded[0].resident.sheep.id,'sheep-1');
 assert.ok(sent.some(e=>e.type==='pasture-resident-gate-ready-v1'));
 assert.ok(sent.some(e=>e.type==='pasture-pilot-core-ready-v1'));
 assert.equal(win.PastureResidentGate.canUseGrass(),false,'resident sheep does not grant My Grass');
});
test('server session is retransmitted when asynchronous function-zone gate becomes ready',()=>{
 const js=read('pasture-preview/pasture-resident-auth.js');
 assert.match(js,/e\.data\?\.type==='pasture-resident-gate-ready-v1'\)apply\(false\)/);
 assert.match(js,/e\.source!==live\?\.contentWindow/);
 assert.match(js,/credentials:'include'/);
});
test('every layer acknowledges sheep receipt and actual canvas painting, never simulates a card',()=>{
 const gate=read('pasture-preview/pasture-resident-gate.js'),
 bridge=read('pasture-preview/tonglu-final-bridge.html'),
 core=read('pasture-resident-core.js');
 assert.match(gate,/pasture-final-core-ready-v1/);
 assert.match(gate,/pasture-final-resident-status-v1/);
 assert.match(bridge,/tonglu-resident-applied-v1/);
 assert.match(bridge,/tonglu-resident-painted-v1/);
 assert.match(core,/Renderer\.draw\(ctx,x,y,s,pos\.flip,resident\.appearance\)/);
 assert.match(core,/__tongluResidentPaintCount/);
 assert.match(core,/tonglu-resident-painted-v1/);
 assert.match(core,/tonglu-resident-applied-v1/);
 assert.match(gate,/resident\?\.cardActivated===true/);
});
test('checkSheep=1 is an honest private read-only diagnosis, not an unlock or signup shortcut',()=>{
 const diag=read('pasture-preview/pasture-sheep-check.js');
 const entry=read('pasture-preview/index.html');
 assert.match(diag,/checkSheep/);
 assert.match(diag,/fetch\('\/api\/pasture-auth'/);
 assert.match(diag,/server:'检查中'/);
 assert.match(diag,/已登录但无羊记录/);
 assert.match(diag,/pasteur|pasture-pilot-resident-status-v1/);
 assert.match(diag,/auth\.apply\(false\)/);
 assert.doesNotMatch(diag,/saveSheep|activateCard|localStorage|sessionStorage/);
 assert.match(entry,/pasture-sheep-check\.js/);
});
test('client side chain modules are parseable',()=>{
 for(const p of ['pasture-preview/pasture-resident-auth.js','pasture-preview/pasture-resident-gate.js','pasture-preview/pasture-sheep-check.js','pasture-resident-core.js']){
  assert.doesNotThrow(()=>new vm.Script(read(p),{filename:p}));
 }
});
