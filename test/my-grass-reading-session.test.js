const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../pasture-preview/my-grass-core.js');
const B=require('../pasture-preview/my-grass-bible-v04.js');
const R=require('../pasture-preview/my-grass-reading-v1.js');

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

test('saved devotional entry keeps completed reading session separate from audio reading',()=>{
 const session=C.completeReadingSession(C.beginReadingSession({book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation:'圣经和合本（神版）'},'t1'),'t2');
 const entry=C.newEntry({scripture:{reference:'约 3:16',text:'神爱世人',translation:'圣经和合本（神版）'},readingSession:session,reading:{audioId:null},reflection:'领受'},'t3','e1');
 assert.equal(entry.readingSession.status,'completed');
 assert.deepEqual(entry.readingSession.verseIds,['JHN.3.16']);
 assert.equal(entry.reading.kind,'original-human-voice');
});

test('browser runtime can require a completed reading session for new archive entries',()=>{
 C.setReadingSessionRequired(true);
 C.setRuntimeReadingSession(null);
 assert.throws(()=>C.newEntry({scripture:{reference:'约 3',text:'本章文字',translation:'圣经和合本（神版）'},reflection:''},'t','new'),/完成本次阅读/);
 const session=C.completeReadingSession(C.beginReadingSession({book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation:'圣经和合本（神版）'},'a'),'b');
 C.setRuntimeReadingSession(session);
 const saved=C.newEntry({scripture:{reference:'约 3:16',text:'神爱世人',translation:'圣经和合本（神版）'},reflection:''},'t','ok');
 assert.equal(saved.readingSession.reference,'约 3:16');
 C.setRuntimeReadingSession(null);C.setReadingSessionRequired(false);
});

test('ESV numbered passage parser exposes clickable verse units without persisting them',()=>{
 const verses=R.parseEsvNumberedText('[16] For God so loved the world. [17] For God did not send his Son to condemn the world. (ESV)');
 assert.deepEqual(verses,[
  {verse:16,text:'For God so loved the world.'},
  {verse:17,text:'For God did not send his Son to condemn the world.'}
 ]);
});

test('reading chapter loader returns verse units for CUV and ESV',async()=>{
 const cuvFetch=async()=>({ok:true,status:200,json:async()=>({verses:[{verse:1,text:'太初有道。'},{verse:2,text:'这道太初与神同在。'}]})});
 const cuv=await R.loadReadingChapter('约',1,'cuv1919-shen-s',cuvFetch);
 assert.equal(cuv.reference,'约 1');
 assert.equal(cuv.verses.length,2);
 assert.equal(cuv.verses[0].id,'JHN.1.1');
 let requested='';
 const esvFetch=async url=>{requested=String(url);return {ok:true,status:200,json:async()=>({ok:true,canonical:'John 1',text:'[1] In the beginning was the Word. [2] He was in the beginning with God. (ESV)',copyright:'ESV'})}};
 const esv=await R.loadReadingChapter('约',1,'esv',esvFetch);
 assert.equal(requested,'/api/bible-esv?reference=John%201');
 assert.equal(esv.storage,'reference-only');
 assert.deepEqual(esv.verses.map(v=>v.id),['JHN.1.1','JHN.1.2']);
});

test('reading enhancement is chapter-first and exposes explicit verse completion controls',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
 const core=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-core.js'),'utf8');
 assert.match(ui,/data-action="verse-select"/);
 assert.match(ui,/完成本次阅读/);
 assert.match(ui,/从这一节开始/);
 assert.match(ui,/gs-nav-verses/);
 assert.match(ui,/gs-nav-verses/);
 assert.match(ui,/翻阅和滚动本身不会记作读过/);
 assert.match(core,/my-grass-reading-v1\.js/);
});

test('option A reading feedback stays quiet: one-step dark range, grass trace, tiny end sprout',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-immersive-v04.css'),'utf8');
 assert.match(css,/\.gs-verse\.is-range[\s\S]*rgba\(111,129,79,\.13\)[\s\S]*color:#382719!important[\s\S]*font-weight:700!important/);
 assert.match(css,/\.gs-verse\.is-range sup[\s\S]*#4f402e[\s\S]*font-weight:800!important/);
 assert.match(css,/\.gs-verse\.is-start:before[\s\S]*content:none!important/);
 assert.match(css,/\.gs-verse\.is-end:after[\s\S]*content:""!important[\s\S]*radial-gradient/);
 assert.match(css,/\.gs-reception-guide[\s\S]*background:transparent!important/);
});


test('chapter-first navigation hides legacy verse-range controls and isolates auto-loaded scripture before apply',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
 assert.match(ui,/\.gs-nav-verses[^\n]*style\.display='none'/);
 assert.match(ui,/button\.matches\('\[data-nav="apply"\]'\)&&!session/);
 assert.match(ui,/text\.dataset\.scriptureSource\|\|text\.dataset\.scriptureState==='ready'/);
 assert.match(ui,/text\.value='';delete text\.dataset\.scriptureSource/);
 assert.match(ui,/dispatchInput\(text\)/);
});

test('ESV reader uses the shared passage loader directly and fixes attribution visibility',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
 assert.doesNotMatch(ui,/chapterFromExistingEsv/);
 assert.doesNotMatch(ui,/schedule\(80\)/);
 assert.match(ui,/await loadReadingChapter\(p\.book,p\.chapter,tid\)/);
 assert.match(ui,/function syncAttribution/);
 assert.match(ui,/attribution\.style\.display=show\?'block':'none'/);
});

test('approved reading layout keeps scripture dominant with one compact heading region',()=>{
 const shell=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-v1.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-immersive-v04.css'),'utf8');
 assert.match(shell,/class="gs-scripture-heading"/);
 assert.match(shell,/class="gs-scripture-reference"[^>]*data-field="reference"/);
 assert.match(shell,/data-field="translation"[^>]*hidden/);
 assert.match(shell,/data-field="scriptureText"[^>]*hidden/);
 assert.doesNotMatch(shell,/<label class="gs-field">译本<input/);
 assert.doesNotMatch(shell,/<label class="gs-field">经文<textarea/);
 assert.match(css,/\.gs-scripture-heading[\s\S]*display:flex/);
 assert.match(css,/\.gs-verse-reader[\s\S]*flex:1/);
});

test('ESV reading renders from the shared loader promise instead of polling hidden textarea',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
 assert.doesNotMatch(ui,/chapterFromExistingEsv/);
 assert.doesNotMatch(ui,/schedule\(80\)/);
 assert.match(ui,/await loadReadingChapter\(p\.book,p\.chapter,tid\)/);
});

test('concurrent ESV consumers share one in-memory request promise',async()=>{
 B.clearCache();
 let calls=0,release;
 const gate=new Promise(resolve=>{release=resolve});
 const fetcher=async()=>{
  calls++;
  await gate;
  return {ok:true,status:200,json:async()=>({ok:true,canonical:'Revelation 3',text:'[1] First. [2] Second. (ESV)',copyright:'ESV'})};
 };
 const first=B.loadEsvPassage('启 3',fetcher);
 const second=B.loadEsvPassage('启 3',fetcher);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1);
 release();
 const [a,b]=await Promise.all([first,second]);
 assert.equal(a.text,b.text);
 await B.loadEsvPassage('启 3',fetcher);
 assert.equal(calls,1);
 B.clearCache();
});

test('approved scripture header keeps title and current reference in one compact visual region',()=>{
 const shell=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-v1.js'),'utf8');
 const css=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-immersive-v04.css'),'utf8');
 assert.match(shell,/class="gs-scripture-heading"[\s\S]*<h3>今日经文<\/h3>[\s\S]*class="gs-scripture-reference"/);
 assert.match(shell,/class="gs-scripture-controls"[\s\S]*data-action="scripture-nav"[\s\S]*data-field="translation"/);
 assert.doesNotMatch(shell,/class="gs-scripture-toolbar"/);
 assert.match(css,/\.gs-scripture-heading\{[\s\S]*display:flex[\s\S]*border-bottom/);
 assert.match(css,/\.gs-scripture-heading h3\{[\s\S]*border:0!important/);
});

test('selected reading range uses one stronger text weight across the whole passage',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-immersive-v04.css'),'utf8');
 assert.match(css,/\.gs-verse\.is-range\{[\s\S]*color:#382719!important[\s\S]*font-weight:700!important/);
 assert.match(css,/\.gs-verse\.is-range sup\{[\s\S]*font-weight:800!important/);
 assert.doesNotMatch(css,/\.gs-verse\.is-start sup\{[^}]*font-weight:900!important/);
});

test('ESV scripture receives a larger reading size without changing CUV base size',()=>{
 const css=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-immersive-v04.css'),'utf8');
 assert.match(css,/#grassWorkspace\[data-scripture-translation="esv"\] \.gs-verse\{[\s\S]*font-size:clamp\(19px,1\.45vw,22px\)!important/);
});

test('scripture reader survives a reading-stage DOM rebuild during microphone recording',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
 assert.match(ui,/reader!==lastReaderNode\|\|signature!==lastReaderSignature/);
 assert.match(ui,/lastReaderNode=reader/);
 assert.match(ui,/function enhanceReadingStage\(\)[\s\S]*if\(activeChapter\)renderReader\(\)/);
});


test('scripture companion maps audio time to the selected verses by text weight',()=>{
 const R=require('../pasture-preview/my-grass-reading-v1.js');
 const verses=[{verse:1,text:'abcd'},{verse:2,text:'abcdefgh'},{verse:3,text:'abcdefghijkl'}];
 assert.equal(R.verseForAudioProgress(verses,0,24),1);
 assert.equal(R.verseForAudioProgress(verses,5,24),2);
 assert.equal(R.verseForAudioProgress(verses,13,24),3);
 assert.equal(R.verseForAudioProgress(verses,24,24),3);
 assert.equal(R.verseForAudioProgress(verses,5,0),null);
});

test('reading layer listens for linked-audio progress and keeps one quiet current verse',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
 assert.match(ui,/mygrass:reading-audio-progress/);
 assert.match(ui,/classList\.remove\('is-following'\)/);
 assert.match(ui,/classList\.add\('is-following'\)/);
 assert.match(ui,/detail\.state==='ended'/);
 assert.match(ui,/scrollIntoView/);
});
