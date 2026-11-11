'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),zlib=require('node:zlib');
const read=p=>fs.readFileSync(p,'utf8');
const parts=Array.from({length:20},(_,i)=>read('pasture-card-art/parts/part-'+String(i).padStart(2,'0')+'.txt'));
test('production uses all 20 untouched archived approved art segments',()=>{
 const source=parts.join('');
 assert.equal(source.length,4786904);
 const encoded=source.match(/const ORIGINAL=`([A-Za-z0-9+/=]+)`;/);
 assert.ok(encoded);
 const original=zlib.gunzipSync(Buffer.from(encoded[1],'base64')).toString('utf8');
 const target={window:{}};
 vm.runInNewContext(read('pasture-card-art/approved-engine.js'),target,{timeout:15000});
 const render=target.window.PastureApprovedSixCard.upgradeApprovedCard(original);
 const originalData=original.match(/^const DATA=.*$/m);
 assert.ok(originalData);
 assert.equal(render.match(/^const DATA=.*$/m)?.[0],originalData[0]);
 assert.match(render,/id="flipBtn"/);
 assert.match(render,/const six=window.BudaoSix/);
 assert.match(render,/7,488/);
 assert.match(render,/7,000/);
 const core={module:{exports:{}}};
 vm.runInNewContext(read('pasture-card-art/six-dim-core.js'),core);
 assert.equal(core.module.exports.CAPACITY,7488);
 assert.equal(core.module.exports.PUBLIC_LIMIT,7000);
});
test('formal pasture only unlocks approved card entry; all other features remain locked',()=>{
 const html=read('tonglu.html'),js=read('pasture-live.js'),viewer=read('pasture-card-viewer.js');
 assert.match(html,/id="budaoCardBtn" role="button" tabindex="0"/);
 assert.match(html,/id="pastureApprovedCardLayer"/);
 assert.match(html,/pasture-card-launcher\.js/);
 for(const id of ['returnNow','grassBookBtn','windNewsBtn','partnersBtn','mailBtn','boxEntryBtn'])
  assert.match(html,new RegExp('pasture-feature-locked" id="'+id+'"'));
 assert.match(js,/querySelectorAll\('\.pasture-feature-locked'\)/);
 assert.match(viewer,/upgradeApprovedCard\(original\)/);
 assert.match(viewer,/shim/);
 assert.match(viewer,/const pieces=await Promise\.all/);
 assert.match(viewer,/credentials:'same-origin'/);
 assert.doesNotMatch(viewer,/action:'activateCard'|activateCard\(|issueCard\(/);
});
test('production card viewer and controls scripts parse and keep server status separate',()=>{
 for(const filename of ['pasture-card-launcher.js','pasture-card-viewer.js'])
  assert.doesNotThrow(()=>new vm.Script(read(filename),{filename}));
 const html=read('pasture-card-viewer.html');
 assert.match(html,/id="approvedCardFrame"/);
 assert.match(html,/id="cardReceiptToggle"/);
 assert.match(html,/id="approvedCardDock"/);
 assert.match(html,/pasture-card-art\/approved-engine\.js/);
 assert.match(html,/pasture-card-viewer\.js/);
 assert.doesNotMatch(read('tonglu.html'),/src="\/pasture-card-viewer.html"/); // lazy only
});
