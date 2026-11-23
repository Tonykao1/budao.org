'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-immersive-v04.css'),'utf8');
test('scripture click sends one journey start then only consecutive advance intents',()=>{
 assert.match(ui,/mygrass:journey-start-request/);
 assert.match(ui,/mygrass:journey-advance-request/);
 assert.match(ui,/point\.verse!==journey\.endVerse\+1/);
});
test('left reading status offers persistent stop and safe inline continue-end confirmation',()=>{
 assert.match(ui,/gsReadingJourneyStatus/);
 assert.match(ui,/end-journey-ask/);
 assert.match(ui,/continue-journey/);
 assert.match(ui,/end-journey-confirm/);
});
test('no pale grass range remains as the reading indicator',()=>{
 assert.match(css,/\.gs-verse\.is-read/);
 assert.match(css,/\.gs-verse\.is-current/);
 assert.doesNotMatch(css,/\.gs-verse\.is-range\{/);
});
test('the confirmation timer updates in place without recreating the safe-choice buttons',()=>{
 assert.match(ui,/id="gsJourneyTimer"/);
 const tick=ui.slice(ui.indexOf('function onJourneyTick('),ui.indexOf('function onClick('));
 assert.doesNotMatch(tick,/renderReadingStatus\(\)/);
});
test('recorded playback verse uses the same unmistakable margin pointer as live reading',()=>{
 assert.match(css,/\.gs-verse\.is-following:before/);
 assert.match(ui,/C\.journeyVerseAt\(journey/);
});
test('opening a saved journey in a different chapter does not copy stale on-screen verses into its archived text',()=>{
 const completed=ui.slice(ui.indexOf('function onJourneyState('),ui.indexOf('function onJourneyTick('));
 assert.match(completed,/const matchingChapter=/);
 assert.match(completed,/if\(matchingChapter\)/);
});
test('chapter navigation after a completed journey never reads the retired reading-session state',()=>{
 const start=ui.indexOf('if(button.matches(\'[data-nav="apply"]\')&&journey)');
 const end=ui.indexOf('const action=button.dataset.action;',start);
 assert.ok(start>=0&&end>start);
 const guard=ui.slice(start,end);
 assert.doesNotMatch(guard,/session\.status/);
 assert.match(guard,/journeyPhase/);
});
