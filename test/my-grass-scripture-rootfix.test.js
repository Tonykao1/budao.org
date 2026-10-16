const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const reading=()=>fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');

test('chapter navigation does not force the legacy whole-chapter checkbox back on',()=>{
 const ui=reading();
 assert.doesNotMatch(ui,/if\(whole&&!whole\.checked\)\{whole\.checked=true/);
});

test('generated scripture is cleared at the navigation boundary before legacy unsaved-text checks run',()=>{
 const ui=reading();
 assert.match(ui,/button\.matches\('\[data-nav="apply"\]'\)&&!session/);
 assert.match(ui,/text\.dataset\.scriptureSource\|\|text\.dataset\.scriptureState==='ready'/);
 assert.match(ui,/text\.value='';delete text\.dataset\.scriptureSource/);
 assert.match(ui,/dispatchInput\(text\)/);
});

test('ESV reader waits for the Bible hydrator and surfaces its error state',()=>{
 const ui=reading();
 assert.match(ui,/chapterFromExistingEsv/);
 assert.match(ui,/正在载入 ESV 经文/);
 assert.match(ui,/scriptureState==='error'/);
 assert.match(ui,/lastStageKey='';schedule\(80\);return/);
});

test('reader rendering is signature-guarded against MutationObserver self-renders',()=>{
 const ui=reading();
 assert.match(ui,/lastReaderSignature/);
 assert.match(ui,/signature!==lastReaderSignature/);
});
