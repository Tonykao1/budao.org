'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('the real 20-part pasture shell removes the obsolete capture that rerouted My Grass to demo card',async()=>{
 const src=read('pasture-preview/index.html');
 const script=src.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(script,'the preview assembler is present');
 const error={textContent:'',style:{display:'none'}},written=[];
 const nodes={
  fill:{style:{}},status:{textContent:''},error
 };
 const doc={
  getElementById:id=>nodes[id]||(nodes[id]={style:{},textContent:''}),
  open(){},write:html=>written.push(html),close(){}
 };
 const files=Array.from({length:20},(_,i)=>read('pasture-preview/parts/part-'+String(i).padStart(2,'0')+'.txt'));
 const fetch=async url=>{
  const num=Number(url.match(/part-(\d+)\.txt/)?.[1]);
  return Number.isInteger(num)&&num>=0&&num<20
   ?{ok:true,text:async()=>files[num]}
   :{ok:false,status:404};
 };
 await vm.runInNewContext(script,{document:doc,fetch,console},{timeout:10000});
 assert.equal(error.textContent,'','assembler did not reject its actual source');
 assert.equal(written.length,1,'the 20-part source was assembled exactly once');
 const assembled=written[0];
 assert.ok(assembled.length>4_000_000,'the real legacy page was used, not a toy fixture');
 assert.doesNotMatch(assembled,/const protectedIds=\['returnNow','grassBookBtn','windNewsBtn','partnersBtn','mailBtn'\]/);
 assert.doesNotMatch(assembled,/card\.srcdoc=cardDoc;/);
 assert.match(assembled,/card\.src='\/pasture-preview\/card-activation\.html'/);
 assert.match(assembled,/function isActive\(\)\{return false\}/);
 assert.match(assembled,/const activated=main\.contentWindow\?\.PastureResidentGate\?\.canUseGrass\?\.\(\)===true/);
 assert.match(assembled,/function showCard\(\)\{card\.src='\/pasture-preview\/card-activation\.html'/);
 assert.match(assembled,/main\.srcdoc=source/,'the approved existing functional zone still mounts');
 assert.match(assembled,/window\.MyGrassBridge=Object\.freeze/,'isolated grass data bridge is preserved');
});

test('opening My Grass checks server first and dispatches only the grass event, not the card overlay',()=>{
 const gate=read('pasture-preview/pasture-resident-gate.js');
 const auth=read('pasture-preview/pasture-resident-auth.js');
 const zone=read('pasture-preview/function-zone.html');
 const card=read('pasture-preview/card-activation.html');
 const handler=read('api/_security/pasture-auth-handler.js');
 const store=read('api/_security/pasture-card-store.js');
 assert.match(gate,/if\(button\.id==='grassBookBtn'\)/);
 assert.match(gate,/type:'pasture-grass-open-request-v1'/);
 assert.match(auth,/type==='pasture-grass-open-request-v1'/);
 assert.match(auth,/refreshCardEntitlement\(\{openGrass:true\}\)/);
 assert.match(auth,/if\(!user\.cardActivated\)/);
 assert.match(auth,/gate\?\.canUseGrass\?\.\(\)===true/);
 assert.match(auth,/pasture-open-grass-after-check-v1/);
 assert.match(zone,/window\.addEventListener\('pasture-open-grass-after-check-v1',openBook\)/);
 assert.match(zone,/window\.PastureResidentGate\?\.canUseGrass\?\.\(\)!==true/);
 assert.match(zone,/pasture-close-card-for-grass-v1/);
 assert.match(zone,/pasture-close-grass-for-card-v1/);
 assert.match(card,/id="receipt"/);
 assert.match(card,/已激活 · 我的牧草已开放/);
 assert.match(card,/已发行 · 待完成激活/);
 assert.match(card,/data\.card\|\|null/);
 assert.match(handler,/residentCardReceipt\(resident\.id\)/);
 assert.match(store,/WHERE \(activated_by_user_id=\$\{userId\} AND status='ACTIVATED'\)/);
 assert.doesNotMatch(store,/SELECT[\s\S]*secret_digest[\s\S]*FROM pasture_cards/);
});
