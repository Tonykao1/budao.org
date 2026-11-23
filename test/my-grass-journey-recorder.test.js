'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-v1.js'),'utf8');
test('recorder listens for verse-driven journey start and advance intent events',()=>{
 assert.match(source,/mygrass:journey-start-request/);
 assert.match(source,/mygrass:journey-advance-request/);
});
test('recorder owns end intent and broadcasts authenticated journey state',()=>{
 assert.match(source,/mygrass:journey-end-request/);
 assert.match(source,/mygrass:journey-state/);
});
test('new journeys do not depend on manual scripture audio verification',()=>{
 assert.match(source,/startReadingJourney/);
 assert.match(source,/advanceReadingJourney/);
 assert.match(source,/completeReadingJourney/);
});
test('ending a reading archives the completed journey instead of leaving only a fragile draft',()=>{
 const ended=source.slice(source.indexOf('journeyRecorder.onstop='),source.indexOf('function advanceJourney('));
 assert.match(ended,/await putAudio\(audioId,blob\)/);
 assert.match(ended,/journey=C\.completeReadingJourney/);
 assert.match(ended,/saveEntry\(\)/);
 assert.ok(ended.indexOf('await putAudio(audioId,blob)')<ended.indexOf('saveEntry()'));
});
