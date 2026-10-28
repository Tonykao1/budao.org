'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('My Grass only performs fresh server entitlement check; shell card shade is closed',()=>{
 const page=read('pasture-preview/index.html'),gate=read('pasture-preview/pasture-resident-gate.js'),auth=read('pasture-preview/pasture-resident-auth.js');
 assert.match(page,/staleCaptureStart/);
 assert.match(page,/pasture-grass-request-from-shell-v1/);
 assert.match(page,/const grass=d\.getElementById\('grassBookBtn'\)/);
 assert.match(page,/if\(shade\.classList\.contains\('open'\)\)hideCard\(\)/);
 assert.match(gate,/button\.id==='grassBookBtn'/);
 assert.match(gate,/type:'pasture-grass-open-request-v1'/);
 assert.match(gate,/event\.source===window\.parent/);
 assert.match(auth,/document\.getElementById\('cardShade'\)\?\.classList\.remove\('open'\)/);
 assert.match(auth,/refreshCardEntitlement\(\{openGrass:true\}\)/);
 assert.match(auth,/const d=await call\(null,'GET'\)/);
 assert.match(auth,/if\(!user\.cardActivated\)/);
 assert.match(auth,/pasture-open-grass-after-check-v1/);
});
test('Card always consults verified issuance receipt; no local demo activation',()=>{
 const card=read('pasture-preview/card-activation.html'),handler=read('api/_security/pasture-auth-handler.js'),zone=read('pasture-preview/function-zone.html');
 assert.match(card,/const card=data\.card\|\|null/);
 assert.match(card,/data\.user\.cardActivated===true/);
 assert.match(card,/card\?\.status==='ISSUED'/);
 assert.match(handler,/cardStore\.residentCardReceipt\(resident\.id\)/);
 assert.match(zone,/window\.addEventListener\('pasture-open-grass-after-check-v1',openBook\)/);
 assert.match(zone,/frame\.src='\/pasture-preview\/card-activation\.html'/);
 assert.doesNotMatch(card,/localStorage\.setItem\(['"]budao\.card/);
});
test('preview loader and client navigation scripts parse',()=>{
 const html=read('pasture-preview/index.html');
 for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new vm.Script(match[1]));
 for(const file of ['pasture-preview/pasture-resident-gate.js','pasture-preview/pasture-resident-auth.js'])assert.doesNotThrow(()=>new vm.Script(read(file)));
});
