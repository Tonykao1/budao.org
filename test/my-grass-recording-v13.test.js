const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..','pasture-preview');
const app=()=>fs.readFileSync(path.join(base,'my-grass-v1.js'),'utf8');
const css=()=>fs.readFileSync(path.join(base,'my-grass-immersive-v04.css'),'utf8');

test('integrated journey retains the physical recorder without separate record or link buttons',()=>{
 const src=app(),stage=src.slice(src.indexOf('function stageReading()'),src.indexOf('function stageReflection()'));
 assert.match(stage,/gs-recorder-console/);
 assert.match(stage,/gs-recorder-screen/);
 assert.match(stage,/data-action="play"/);
 assert.match(stage,/gs-journey-rec-indicator/);
 assert.doesNotMatch(stage,/data-action="record"/);
 assert.doesNotMatch(stage,/data-action="link-audio"/);
});

test('journey first verse requests the microphone and does not create a read record before recorder start',()=>{
 const src=app();
 assert.match(src,/mygrass:journey-start-request/);
 assert.match(src,/getUserMedia\(\{audio:true,video:false\}\)/);
 assert.match(src,/journeyRecorder\.onstart=/);
 assert.match(src,/journey=C\.startReadingJourney\(point,iso\(\)\)/);
});

test('new journey audio is born bound to its own verse timeline, with no manual link gate',()=>{
 const src=app();
 assert.match(src,/C\.completeReadingJourney\(journey,journeyFinalMs/);
 assert.match(src,/draft\.readingJourney=journey/);
 assert.match(src,/draft\.readingJourney\?\.status==='completed'/);
 assert.match(src,/readingJourney:draft\.readingJourney\|\|null/);
});

test('journey completion writes audio first, and failures never emit a false completed state',()=>{
 const src=app();
 assert.match(src,/await putAudio\(audioId,blob\)/);
 assert.match(src,/journey=C\.completeReadingJourney/);
 assert.match(src,/catch\(e\)\{journeyFail\('保存本次读经失败/);
});

test('physical recorder styling stays compact and uses a screen-plus-key layout',()=>{
 const style=css();
 assert.match(style,/\.gs-recorder-console\{/);
 assert.match(style,/\.gs-recorder-keys\{/);
 assert.match(style,/\.gs-recorder-key\{/);
 assert.match(style,/\.gs-recorder-screen\{/);
 assert.match(style,/\.gs-recorder-link\{/);
 assert.match(style,/data-state="recording"/);
});


test('right reading area is titled 今日读经 and broadcasts playback progress to scripture',()=>{
 const src=app();
 assert.match(src,/gs-recording-panel[^\n]*[\s\S]{0,220}<h3>今日读经<\/h3>/);
 assert.match(src,/mygrass:reading-audio-progress/);
 assert.match(src,/addEventListener\('timeupdate'/);
 assert.match(src,/addEventListener\('pause'/);
 assert.match(src,/addEventListener\('ended'/);
});

test('integrated recorder remains compact at the top of the approved right page',()=>{
 const style=css();
 assert.match(style,/\.gs-recording-panel\{[^}]*padding-top:0/);
 assert.match(style,/\.gs-recorder-console\{[\s\S]*?margin:0 0 7px/);
 assert.match(style,/\.gs-recorder-screen/);
});
