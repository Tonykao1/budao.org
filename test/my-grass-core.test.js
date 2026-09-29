const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../pasture-preview/my-grass-core.js');
const base=path.join(__dirname,'..','pasture-preview');
const read=n=>fs.readFileSync(path.join(base,n),'utf8');
test('我的牧草 has exactly three stages, no separate 成言 module',()=>{
 assert.deepEqual([...core.PHASES],['reading','reflection','sharing']);
 const archive=fs.readFileSync(path.join(__dirname,'..','docs/my-grass/product-archive-v0.3.md'),'utf8');
 assert.match(archive,/一生的灵修与牧养成长档案/);
 assert.match(archive,/不开发独立的「成言｜整理」模块/);
});
test('source/translation and original human voice provenance are explicit; all voice consents are false by default',()=>{
 const e=core.newEntry({scripture:{reference:'诗篇 23:1',text:'用户自行录入的测试文本',translation:'测试来源',verifiedAgainstRecording:true},reflection:'用户真实默想',
 reading:{audioId:'local-recording-1',mimeType:'audio/webm',size:20000,durationSeconds:21}
 },'2026-09-29T00:00:00Z','entry1');
 assert.equal(e.scripture.enteredBy,'user');
 assert.equal(e.reading.kind,'original-human-voice');
 assert.equal(e.reading.audioId,'local-recording-1');
 for(const k of ['trainingConsent','syntheticVoiceConsent','publicationConsent'])assert.equal(e.reading[k],false);
 assert.deepEqual(Object.values(core.voicePermissions()),[false,false,false]);
});
test('entry requires actual Scripture text and reference, never silently invents a Bible translation',()=>{
 assert.throws(()=>core.newEntry({scripture:{reference:'',text:'some text'}},'t','a'),/出处/);
 assert.throws(()=>core.newEntry({scripture:{reference:'约 15:1',text:''}},'t','a'),/经文/);
 assert.equal(core.validateScripture({reference:'约 15:1',text:'  用户粘贴  '}).text,'用户粘贴');
});
test('private micro sharing is linked to verified source note and cannot auto-publish',()=>{
 const e=core.newEntry({scripture:{reference:'约 15:1',text:'测试所用的经文'},reflection:'我愿在今天更加认真地思考。'},'2026-09-29T00:00:00Z','entry1');
 const micro=core.makeMicro(e,'这是一句话。','m1');
 assert.equal(micro.entryId,'entry1');
 assert.equal(micro.originalReflectionId,'entry1');
 assert.equal(micro.visibility,'private');
 assert.equal(micro.status,'private-draft');
 assert.equal(micro.approvedForPublicDistribution,false);
 assert.equal(micro.syntheticAudioId,null);
 assert.throws(()=>core.makeMicro(e,'字'.repeat(81),'m2'),/80字/);
 assert.throws(()=>core.makeMicro(core.newEntry({scripture:{reference:'约 15:1',text:'t'},reflection:''},'t','x'),'a','m3'),/默想/);
});
test('rewriting an entry preserves its identifier and creation date and retains linked micro IDs',()=>{
 const e=core.newEntry({scripture:{reference:'诗篇 23:1',text:'source'},reflection:'old'},'2026-09-29T00:00:00Z','entry1');
 e.shareIds=['m1'];
 const update=core.reviseEntry(e,{scripture:{reference:'诗篇 23:1',text:'source'},reflection:'new'},'2026-09-29T10:00:00Z');
 assert.equal(update.id,e.id);assert.equal(update.createdAt,e.createdAt);assert.deepEqual(update.shareIds,['m1']);
});
test('same Scripture reference can gather memories from different life seasons without scoring users',()=>{
 const e1=core.newEntry({scripture:{reference:'诗篇 23:1',text:'t1'},reflection:'n1'},'2026-09-29T00:00:00Z','e1');
 const e2=core.newEntry({scripture:{reference:'诗篇 23:1',text:'t2'},reflection:'n2'},'2028-09-29T00:00:00Z','e2');
 const x=core.groupByReference([e1,e2]);
 assert.equal(x.length,1);assert.deepEqual(x[0].entries.map(e=>e.id),['e2','e1']);
});
test('six-dimensional card identity namespaces preview data for different assigned identities',()=>{
 const v={phase:'active',seriesId:'CSCZ-001',final:{suit:'spade',rank:'A',numberColor:'red',dice:1,side:'white',piece:'king'}};
 const a=core.scopeFromIdentity(v);
 assert.notEqual(a,core.scopeFromIdentity({...v,final:{...v.final,numberColor:'black'}}));
 assert.equal(core.scopeFromIdentity({phase:'guest'}),'unassigned-preview');
});
test('no AI voice training, remote upload or autopublish endpoint is present in first-stage client',()=>{
 const ui=read('my-grass-v1.js');
 const zone=read('function-zone.html');
 assert.match(ui,/getUserMedia/);assert.match(ui,/indexedDB/);
 assert.match(zone,/my-grass-v1\.css/);assert.match(zone,/my-grass-core\.js/);assert.match(zone,/my-grass-v1\.js/);
 assert.ok(!/\bfetch\s*\(\s*['"]\/api\//.test(ui));
 assert.ok(!ui.includes('speechSynthesis.speak('));
 assert.ok(!ui.includes('trainVoiceModel:true'));
});
