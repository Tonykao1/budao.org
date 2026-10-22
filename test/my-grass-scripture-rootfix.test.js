const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const reading=()=>fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');

test('chapter navigation does not force the legacy whole-chapter checkbox back on',()=>{
 const ui=reading();
 assert.doesNotMatch(ui,/if\(whole&&!whole\.checked\)\{whole\.checked=true/);
});

test('generated scripture is cleared on chapter navigation when no journey is underway',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
 assert.match(ui,/button\.matches\('\[data-nav="apply"\]'\)&&!journey/);
 assert.match(ui,/delete text\.dataset\.scriptureSource/);
 assert.match(ui,/dispatchInput\(text\)/);
});

test('ESV chapter hydration uses the shared loader and still reports errors in the reader',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
 assert.match(ui,/async function hydrateChapter/);
 assert.match(ui,/await loadReadingChapter/);
 assert.match(ui,/catch\(error\)/);
 assert.match(ui,/current\.innerHTML=/);
});

test('reader rendering is signature-guarded against MutationObserver self-renders',()=>{
 const ui=reading();
 assert.match(ui,/lastReaderSignature/);
 assert.match(ui,/signature!==lastReaderSignature/);
});
