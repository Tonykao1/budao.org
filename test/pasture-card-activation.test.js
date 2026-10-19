'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const gateSource=load('pasture-preview/pasture-resident-gate.js');
const grassSource=load('pasture-preview/my-grass-v1.js');
const cardHtml=load('pasture-preview/card-activation.html');
const serverHandler=load('api/_security/pasture-auth-handler.js');
const storeSource=load('api/_security/pasture-auth-store.js');
const domain=require('../api/_security/pasture-auth-domain');
const exampleId='e164c5e2-b1dd-4cd6-b4f2-ab23d7e67c31';

function fakeGate(){
 const handlers={},messages=[],events=[],ids=['budaoCardBtn','grassBookBtn','windNewsBtn','returnNow','boxEntryBtn'];
 const classList=()=>({add(){},remove(){},toggle(){}});
 const buttons=Object.fromEntries(ids.map(id=>[id,{id,textContent:id,classList:classList(),
  setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]}}]));
 const actions={contains:node=>ids.some(id=>buttons[id]===node)};
 const doc={
  body:{classList:classList()},
  querySelector(sel){return sel==='.actions'?actions:null},
  querySelectorAll(sel){return sel==='.pbtn'?Object.values(buttons):[]},
  addEventListener(name,handler){handlers[name]=handler},
  dispatchEvent(event){events.push(event)}
 };
 const root={
  parent:{location:{origin:'https://budao.test'},postMessage:(v)=>messages.push(v)}
 };
 vm.runInNewContext(gateSource,{document:doc,window:root,location:{hostname:'budao.test'},
  CustomEvent:function(type,opts){return {type,detail:opts.detail}}});
 function click(id){
  const button=buttons[id],result={blocked:false,immediate:false};
  handlers.click({target:{closest:()=>button},preventDefault(){result.blocked=true},
   stopPropagation(){},stopImmediatePropagation(){result.immediate=true}});
  return result;
 }
 return {api:root.PastureResidentGate,click,buttons,messages,events};
}
const sheep={id:'sheep-1'};
test('email-registered resident can only open the step card while My Grass is locked',()=>{
 const g=fakeGate();
 g.api.setResident({id:exampleId,sheep,cardActivated:false,emailMasked:'te***@example.com'});
 assert.equal(g.api.canUseGrass(),false);
 assert.equal(g.click('budaoCardBtn').blocked,false);
 for(const id of ['grassBookBtn','windNewsBtn','returnNow','boxEntryBtn']){
  assert.equal(g.click(id).blocked,true,id+' must be blocked');
 }
 assert.equal(g.messages.find(e=>e.label==='grassBookBtn')?.type,'pasture-card-required');
});
test('only explicit server-reported cardActivated true plus sheep releases My Grass',()=>{
 const g=fakeGate();
 g.api.setResident({id:exampleId,sheep,cardActivated:'true'});
 assert.equal(g.api.canUseGrass(),false);
 assert.equal(g.click('grassBookBtn').blocked,true);
 g.api.setResident({id:exampleId,cardActivated:true,sheep:null});
 assert.equal(g.api.canUseGrass(),false);
 g.api.setResident({id:exampleId,cardActivated:true,sheep});
 assert.equal(g.api.canUseGrass(),true);
 assert.equal(g.click('grassBookBtn').blocked,false);
 assert.equal(g.click('budaoCardBtn').blocked,false);
 assert.equal(g.click('windNewsBtn').blocked,true);
 assert.equal(g.events.at(-1).detail.cardActivated,true);
});
test('logout and identity changes revoke access without legacy localStorage bypass',()=>{
 const g=fakeGate();g.api.setResident({id:exampleId,cardActivated:true,sheep});
 g.api.clearResident();
 assert.equal(g.api.canUseGrass(),false);
 assert.equal(g.click('grassBookBtn').blocked,true);
 g.api.setResident({id:exampleId,sheep,cardActivated:false});
 assert.equal(g.api.canUseGrass(),false);
 assert.doesNotMatch(gateSource,/localStorage|__PASTURE_TEST_UNLOCK/);
});
test('database and public session have separate server-owned card activation status',()=>{
 const base={id:exampleId,emailMasked:'te***@example.com',createdAt:new Date()};
 assert.equal(domain.publicUser(base,sheep).cardActivated,false);
 assert.equal(domain.publicUser({...base,cardActivatedAt:new Date()},sheep).cardActivated,true);
 assert.match(load('db/schema.js'),/cardActivatedAt: timestamp\("card_activated_at"/);
 assert.match(storeSource,/ALTER TABLE pasture_users ADD COLUMN IF NOT EXISTS card_activated_at/);
 assert.match(serverHandler,/action === "activateCard"/);
 assert.match(serverHandler,/reason: "card_activation_pending"/);
 assert.doesNotMatch(serverHandler,/localStorage/);
});
test('no guessed password, fake unlock or persistence of submitted password',()=>{
 assert.match(cardHtml,/type="password"/);
 assert.match(cardHtml,/autocomplete="off"/);
 assert.match(cardHtml,/action:'activateCard'/);
 assert.match(cardHtml,/data\.user\?\.cardActivated===true/);
 assert.doesNotMatch(cardHtml,/BUDAO-2026|localStorage\.setItem|demo[-_]password/i);
 const zone=load('pasture-preview/function-zone.html');
 assert.match(zone,/src="\/pasture-preview\/card-activation\.html"/);
 assert.doesNotMatch(zone,/budao\.card\.activated\.v1/);
 assert.doesNotMatch(zone,/budao-card-open-mail/);
});
test('My Grass never loads the unassigned-preview scope and blocks client-only entry',()=>{
 assert.match(grassSource,/PastureResidentGate\?\.canUseGrass/);
 assert.match(grassSource,/pasture-resident-\x27\+id/);
 assert.match(grassSource,/if\(!current\)return false/);
 assert.match(grassSource,/if\(!residentAccess\(\)\|\|!draft\|\|!document\.body\.classList\.contains\('grassbook-open'\)\)return/);
 assert.match(grassSource,/pasture-resident-access-changed/);
 assert.match(grassSource,/if\(!draft\|\|!residentAccess\(\)\|\|scope!==residentScope\(\)\)/);
 assert.doesNotMatch(grassSource,/scopeFromIdentity\(cardIdentity\(\)\)/);
});
