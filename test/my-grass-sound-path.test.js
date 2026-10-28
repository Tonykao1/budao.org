'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-v1.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-immersive-v04.css'),'utf8');
function section(start,end){
 const i=source.indexOf(start),j=source.indexOf(end,i);
 assert.ok(i>=0&&j>i,'Required sound-path section exists');
 return source.slice(i,j);
}
const math=vm.runInNewContext(section('function soundPathModel(value){','function soundPathView(){')+';({soundPathModel,soundTime})');
const journey={
 status:'completed',durationMs:22000,
 segments:[
  {verse:1,verseId:'JAS.1.1',startMs:0,endMs:8000},
  {verse:2,verseId:'JAS.1.2',startMs:8000,endMs:17000},
  {verse:3,verseId:'JAS.1.3',startMs:17000,endMs:22000}
 ]
};
test('sound road uses recorded verse timings, not equal-width decorative tracks',()=>{
 const model=math.soundPathModel(journey);
 assert.equal(model.total,22000);
 assert.ok(Math.abs(model.segments[0].width-8000/22000*100)<0.0001);
 assert.ok(Math.abs(model.segments[1].width-9000/22000*100)<0.0001);
 assert.equal(model.segments[0].left,0);
 assert.equal(model.segments[1].left,8000/22000*100);
 assert.ok(model.segments[1].width>model.segments[2].width);
 assert.equal(math.soundTime(17000),'00:17');
});
test('no invented road if recording incomplete or boundaries invalid',()=>{
 assert.equal(math.soundPathModel(null),null);
 assert.equal(math.soundPathModel({...journey,status:'recording'}),null);
 assert.equal(math.soundPathModel({...journey,durationMs:0,segments:[{...journey.segments[0],endMs:0}]}),null);
 assert.equal(math.soundPathModel({...journey,segments:[journey.segments[0],{...journey.segments[1],startMs:7500},journey.segments[2]]}),null);
});
test('clicking a sound mark seeks only an existing recorded start, without altering archives',()=>{
 const seek=section('async function seekSoundVerse(ms){','async function togglePlayback(){');
 assert.match(seek,/model\.segments\.some\(s=>s\.start===ms\)/);
 assert.match(seek,/player\.currentTime=ms\/1000/);
 assert.match(seek,/await player\.play\(\)/);
 assert.match(seek,/scope!==owner/);
 assert.doesNotMatch(seek,/deleteAudio|saveEntry|putAudio|writeJson/);
 const pathView=section('function soundPathView(){','function voiceReunionEntries(){');
 assert.match(pathView,/data-action="sound-seek"/);
 assert.match(pathView,/start\/total\*100/);
});
test('voice reunions only name actual same-chapter overlapping private history',()=>{
 const context={
  entries:[
   {id:'old-a',readingJourney:{status:'completed',book:'雅',chapter:1,translation:'CUV',startVerse:2,endVerse:4,completedAt:'2025-01-01'},reading:{audioId:'a'}},
   {id:'old-b',readingJourney:{status:'completed',book:'雅',chapter:2,translation:'CUV',startVerse:1,endVerse:3},reading:{audioId:'b'}},
   {id:'old-c',readingJourney:{status:'completed',book:'雅',chapter:1,translation:'ESV',startVerse:2,endVerse:3},reading:{audioId:'c'}},
   {id:'old-d',readingJourney:{status:'completed',book:'雅',chapter:1,translation:'CUV',startVerse:5,endVerse:8},reading:{audioId:'d'}},
   {id:'old-e',readingJourney:{status:'completed',book:'雅',chapter:1,translation:'CUV',startVerse:1,endVerse:2},reading:{audioId:null}}
  ],
  draft:{id:'current',readingJourney:{book:'雅',chapter:1,translation:'CUV',startVerse:1,endVerse:3}}
 };
 const fn=vm.runInNewContext(section('function voiceReunionEntries(){','function voiceYearRingView(){')+';voiceReunionEntries',context);
 const found=fn();
 assert.equal(found.length,1);
 assert.equal(found[0].id,'old-a');
});
test('year-ring and road remain right-page-only with no new dropdown or social publishing',()=>{
 const stage=section('function stageReading(){','const LIGHTS=Object.freeze(');
 assert.match(stage,/soundPathView\(\)\+voiceYearRingView\(\)/);
 assert.match(stage,/gs-voice-dsp/);
 assert.match(css,/\.gs-sound-marker\.is-audible/);
 assert.match(css,/\.gs-yearring-seal/);
 assert.doesNotMatch(section('function soundPathView(){','function stageReading(){'),/data-action="publish"|<select/);
});
