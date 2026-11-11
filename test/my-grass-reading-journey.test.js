'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../pasture-preview/my-grass-core.js');
const p=n=>({book:'创',chapter:1,verse:n,verseId:'GEN.1.'+n,translation:'圣经和合本（神版）'});
test('journey starts with only an open current verse',()=>{
 const j=C.startReadingJourney(p(1),'2026-10-18T00:00:00Z');
 assert.equal(j.status,'recording');assert.deepEqual(j.segments.map(s=>[s.verse,s.startMs,s.endMs]),[[1,0,null]]);
});
test('next verse is continuous, skips and regressions rejected',()=>{
 const first=C.startReadingJourney(p(1),'2026-10-18T00:00:00Z');
 const second=C.advanceReadingJourney(first,p(2),8420);
 assert.deepEqual(second.segments.map(s=>[s.verse,s.startMs,s.endMs]),[[1,0,8420],[2,8420,null]]);
 assert.equal(C.advanceReadingJourney(second,p(2),8420),second);
 assert.throws(()=>C.advanceReadingJourney(second,p(8),9000));
 assert.throws(()=>C.advanceReadingJourney(second,p(3),8000));
 assert.throws(()=>C.advanceReadingJourney(second,{...p(3),chapter:2,verseId:'GEN.2.3'},9000));
});
test('completion derives actual range and preserves exact playback boundaries',()=>{
 let j=C.startReadingJourney(p(1),'2026-10-18T00:00:00Z');
 j=C.advanceReadingJourney(j,p(2),8420);
 j=C.completeReadingJourney(j,17500,'2026-10-18T00:01:00Z',{audioId:'a1',mimeType:'audio/webm',size:123,durationSeconds:17.5});
 assert.equal(j.reference,'创 1:1–2');assert.deepEqual(j.verseIds,['GEN.1.1','GEN.1.2']);
 assert.equal(j.durationMs,17500);assert.equal(j.segments[1].endMs,17500);
 assert.equal(C.journeyVerseAt(j,8419),1);assert.equal(C.journeyVerseAt(j,8420),2);
 assert.throws(()=>C.advanceReadingJourney(j,p(3),18000));
});
test('completion requires real audio metadata',()=>{
 const j=C.startReadingJourney(p(1),'2026-10-18T00:00:00Z');
 assert.throws(()=>C.completeReadingJourney(j,5000,'2026-10-18T00:00:05Z',{}));
});
test('completed journey persists as schema v2 and survives revision',()=>{
 let j=C.startReadingJourney(p(4),'2026-10-18T00:00:00Z');
 j=C.completeReadingJourney(j,4000,'2026-10-18T00:00:04Z',{audioId:'original',mimeType:'audio/webm',size:5,durationSeconds:4});
 const input={scripture:{reference:j.reference,text:'这是经文',translation:j.translation},readingJourney:j,reading:{audioId:'original'},reflection:'初次领受'};
 const entry=C.newEntry(input,'2026-10-18T00:00:04Z','entry-1');
 assert.equal(entry.version,2);assert.deepEqual(entry.readingJourney.segments,j.segments);
 const revised=C.reviseEntry(entry,{scripture:input.scripture,reading:{audioId:'original'},reflection:'更深的领受'},'2026-10-18T00:10:00Z');
 assert.deepEqual(revised.readingJourney,entry.readingJourney);
});
