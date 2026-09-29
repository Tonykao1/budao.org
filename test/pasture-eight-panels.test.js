const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const vm=require('node:vm');
const base=path.join(__dirname,'..','pasture-preview');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const assembled=Array.from({length:20},(_,i)=>read('parts/part-'+String(i).padStart(2,'0')+'.txt')).join('');
const encoded=assembled.match(/const ORIGINAL=`([A-Za-z0-9+/=]+)`;/);
assert.ok(encoded,'original card archive must exist');
const original=zlib.gunzipSync(Buffer.from(encoded[1],'base64')).toString('utf8');
const start=assembled.indexOf('function upgradeApprovedCard(original){');
const end=assembled.indexOf('\nconst approvedSixCardHTML=upgradeApprovedCard(cardHTML);',start);
assert.ok(start>=0&&end>start);
const upgrade=new Function(assembled.slice(start,end)+'\nreturn upgradeApprovedCard;')();
const approved=upgrade(original);
test('original card pixels preserved, with consistent flip button and basic holder data after confirmation',()=>{
 const assetLine=h=>h.match(/^const DATA=.*$/m)?.[0];
 assert.equal(assetLine(approved),assetLine(original));
 assert.ok(approved.includes("flipped?'↺ 翻面':'↻ 翻面'"));
 assert.ok(!approved.includes('翻回书法面'));
 for(const str of ['持卡人基本资料','id="cardHolderName"','创始成终','确认日期','六维卡组','state.confirmedAt=Date.now()'])assert.ok(approved.includes(str),str);
});
test('assigned state refreshes pasture identity and respects private display prefs',()=>{
 assert.ok(assembled.includes('window.PastureBox?.applyPrefs?.()'));
 assert.ok(assembled.includes("state.phase==='active'&&state.final?'创始成终 · '+code(state.final):'六维身份待领取'"));
 assert.ok(assembled.includes("v.numberColor==='red'?'红字':'黑字'"));
 assert.ok(assembled.includes("window.getPastureHolderName="));
});
test('归回自己 is a working local pixel sheep view, not a failed remote canvas click',()=>{
 const zone=read('function-zone.html');
 assert.ok(zone.includes('id="selfView"'));
 assert.ok(zone.includes('id="selfSheepCanvas"'));
 assert.ok(zone.includes("document.body.classList.add('self-open')"));
 assert.ok(zone.includes("document.getElementById('selfCare').addEventListener('click'"));
 assert.ok(zone.includes("document.getElementById('selfFeed').addEventListener('click'"));
 const p=zone.indexOf('function openSelfSheep(){'),end=zone.indexOf("\n  returnNow.addEventListener('click',openSelfSheep);",p);
 assert.ok(p>=0&&end>p);
 assert.ok(!zone.slice(p,end).includes('if(!cv)return'));
});
test('all eight subpages have the approved card-style return control',()=>{
 const zone=read('function-zone.html'),loader=read('index.html');
 for(const id of ['selfClose','closeBook','closeWind','closeMail','closePartners'])assert.ok(zone.includes('#'+id));
 for(const k of ['self-open','grassbook-open','wind-open','mail-open','partners-open'])assert.ok(assembled.includes(k));
 for(const id of ['selfClose','closeBook','closeWind','closeMail','closePartners'])assert.ok(assembled.includes(id));
 assert.ok(assembled.includes("$('topExit').onclick=closeCurrentPage"));
 assert.ok(loader.includes('#shopClose,#boxClose{background:#f9f0d5!important'));
});
test('source scripts remain syntactically valid',()=>{
 const zone=read('function-zone.html');
 for(const [,script] of zone.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)){
  if(script.trim())assert.doesNotThrow(()=>new vm.Script(script));
 }
 assert.doesNotThrow(()=>new vm.Script(assembled.slice(start,assembled.indexOf('</script>',start)).replace(/\}\)\(\);\s*$/,'')));
});
