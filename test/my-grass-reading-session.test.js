const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../pasture-preview/my-grass-core.js');
const B=require('../pasture-preview/my-grass-bible-v04.js');

test('browsing a chapter creates no reading session; first verse click starts one',()=>{
 assert.equal(C.normalizeReadingSession(null),null);
 const s=C.beginReadingSession({book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation:'圣经和合本（神版）'},'2026-10-15T15:00:00.000Z');
 assert.equal(s.status,'reading');
 assert.equal(s.reference,'约 3:16');
 assert.equal(s.startVerseId,'JHN.3.16');
 assert.equal(s.endVerseId,'JHN.3.16');
 assert.equal(s.startedAt,'2026-10-15T15:00:00.000Z');
 assert.equal(s.completedAt,null);
});

test('reading end stays in the same chapter and cannot move before the starting verse',()=>{
 const s=C.beginReadingSession({book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation:'圣经和合本（神版）'},'t1');
 const next=C.setReadingSessionEnd(s,{book:'约',chapter:3,verse:18,verseId:'JHN.3.18'});
 assert.equal(next.reference,'约 3:16–18');
 assert.equal(next.endVerseId,'JHN.3.18');
 assert.throws(()=>C.setReadingSessionEnd(s,{book:'约',chapter:3,verse:15,verseId:'JHN.3.15'}),/起始节/);
 assert.throws(()=>C.setReadingSessionEnd(s,{book:'约',chapter:4,verse:1,verseId:'JHN.4.1'}),/同一章/);
});

test('completing one or more verses creates a durable reading session with stable verse IDs',()=>{
 let s=C.beginReadingSession({book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation:'English Standard Version (ESV)'},'t1');
 s=C.setReadingSessionEnd(s,{book:'约',chapter:3,verse:18,verseId:'JHN.3.18'});
 s=C.completeReadingSession(s,'t2');
 assert.equal(s.status,'completed');
 assert.equal(s.completedAt,'t2');
 assert.equal(s.reference,'约 3:16–18');
 assert.deepEqual(s.verseIds,['JHN.3.16','JHN.3.17','JHN.3.18']);
 const one=C.completeReadingSession(C.beginReadingSession({book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation:'圣经和合本（神版）'},'t1'),'t2');
 assert.deepEqual(one.verseIds,['JHN.3.16']);
});

test('saved devotional entry keeps the completed reading session separate from audio reading',()=>{
 const session=C.completeReadingSession(C.beginReadingSession({book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation:'圣经和合本（神版）'},'t1'),'t2');
 const entry=C.newEntry({scripture:{reference:'约 3:16',text:'神爱世人',translation:'圣经和合本（神版）'},readingSession:session,reading:{audioId:null},reflection:'领受'},'t3','e1');
 assert.equal(entry.readingSession.status,'completed');
 assert.deepEqual(entry.readingSession.verseIds,['JHN.3.16']);
 assert.equal(entry.reading.kind,'original-human-voice');
});

test('ESV numbered passage parser exposes clickable verse units without persisting them',()=>{
 const verses=B.parseEsvNumberedText('[16] For God so loved the world. [17] For God did not send his Son to condemn the world. (ESV)');
 assert.deepEqual(verses,[
  {verse:16,text:'For God so loved the world.'},
  {verse:17,text:'For God did not send his Son to condemn the world.'}
 ]);
});

test('reading chapter loader returns verse units for CUV and ESV',async()=>{
 const cuvFetch=async()=>({ok:true,status:200,json:async()=>({verses:[{verse:1,text:'太初有道。'},{verse:2,text:'这道太初与神同在。'}]})});
 const cuv=await B.loadReadingChapter('约',1,'cuv1919-shen-s',cuvFetch);
 assert.equal(cuv.reference,'约 1');
 assert.equal(cuv.verses.length,2);
 assert.equal(cuv.verses[0].id,'JHN.1.1');
 let requested='';
 const esvFetch=async url=>{requested=String(url);return {ok:true,status:200,json:async()=>({ok:true,canonical:'John 1',text:'[1] In the beginning was the Word. [2] He was in the beginning with God. (ESV)',copyright:'ESV'})}};
 const esv=await B.loadReadingChapter('约',1,'esv',esvFetch);
 assert.equal(requested,'/api/bible-esv?reference=John%201');
 assert.equal(esv.storage,'reference-only');
 assert.deepEqual(esv.verses.map(v=>v.id),['JHN.1.1','JHN.1.2']);
});

test('reading UI is chapter-first and exposes explicit verse start/end completion controls',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-v1.js'),'utf8');
 assert.match(ui,/data-action="verse-select"/);
 assert.match(ui,/完成本次阅读/);
 assert.match(ui,/从这一节开始/);
 assert.doesNotMatch(ui,/id="gsNavFrom"/);
 assert.doesNotMatch(ui,/id="gsNavTo"/);
});
