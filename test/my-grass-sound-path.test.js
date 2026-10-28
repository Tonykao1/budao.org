'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-v1.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-immersive-v04.css'),'utf8');
const core=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-core.js'),'utf8');
function section(a,b){
 const i=source.indexOf(a),j=source.indexOf(b,i);
 assert.ok(i>=0&&j>i,'required section exists: '+a);
 return source.slice(i,j);
}
const model=vm.runInNewContext(section('function soundPathModel(value){','function voiceReunionEntries(){')+';soundPathModel');
const journey={status:'completed',durationMs:22000,segments:[
 {verse:1,verseId:'JAS.1.1',startMs:0,endMs:8000},
 {verse:2,verseId:'JAS.1.2',startMs:8000,endMs:17000},
 {verse:3,verseId:'JAS.1.3',startMs:17000,endMs:22000}
]};
test('redundant sound-road surface, styles and seeking actions are gone from the right page',()=>{
 const stage=section('function stageReading(){','const LIGHTS=Object.freeze(');
 assert.match(stage,/voiceYearRingView\(\)/);
 assert.match(stage,/gs-voice-dsp/);
 assert.doesNotMatch(stage,/soundPathView|gs-sound-|声音之路|sound-seek/);
 assert.doesNotMatch(source,/function soundPathView\(|function seekSoundVerse\(|function updateSoundPathProgress\(/);
 assert.doesNotMatch(source,/data-action="sound-seek"|case 'sound-seek'/);
 assert.doesNotMatch(css,/gs-sound-|SOUND ROAD CALIBRATION/);
 assert.match(css,/\.gs-yearring-head/);
 assert.match(css,/\.gs-yearring-seal/);
});
test('authenticated recording journey preserves real verse timing independently of any timeline UI',()=>{
 assert.match(core,/function startReadingJourney\(/);
 assert.match(core,/function advanceReadingJourney\(/);
 assert.match(core,/function completeReadingJourney\(/);
 assert.match(core,/function journeyVerseAt\(/);
 const result=model(journey);
 assert.equal(result.total,22000);
 assert.equal(result.segments[1].start,8000);
 assert.equal(result.segments[1].end,17000);
 assert.equal(model({...journey,status:'recording'}),null);
 assert.equal(model({...journey,durationMs:23000}),null);
 assert.equal(model({...journey,segments:[{...journey.segments[0],startMs:10},...journey.segments.slice(1)]}),null);
});
test('existing left-page playback follow receives calibrated clock rather than unbounded media time',()=>{
 const piece=section('function soundMediaDurationMs(player){','async function togglePlayback(){');
 const f=vm.runInNewContext(piece+';({soundMediaDurationMs,soundMediaToJourneyMs})',{soundPathModel:model,draft:{readingJourney:journey},Number,Math});
 assert.equal(f.soundMediaDurationMs({duration:20}),20000);
 assert.ok(Math.abs(f.soundMediaToJourneyMs(7272.7272727,{duration:20})-8000)<.01);
 assert.equal(f.soundMediaToJourneyMs(20000,{duration:20}),22000);
 assert.equal(f.soundMediaToJourneyMs(5000,{duration:Infinity}),null);
 assert.equal(journey.segments[1].startMs,8000,'saved original timestamps unchanged');
 const broadcast=section('function broadcastReadingAudioProgress(state,player){','function releaseDenoiseMonitor(){');
 assert.match(broadcast,/soundMediaToJourneyMs/);
 assert.match(broadcast,/mygrass:reading-audio-progress/);
});
test('private year rings only report real overlapping historical recordings',()=>{
 const sandbox={
  entries:[
   {id:'history',readingJourney:{status:'completed',book:'雅',chapter:1,translation:'CUV',startVerse:2,endVerse:4,completedAt:'2025-01-01'},reading:{audioId:'actual'}},
   {id:'no-file',readingJourney:{status:'completed',book:'雅',chapter:1,translation:'CUV',startVerse:2,endVerse:4},reading:{audioId:null}},
   {id:'other-chapter',readingJourney:{status:'completed',book:'雅',chapter:2,translation:'CUV',startVerse:1,endVerse:3},reading:{audioId:'other'}}
  ],
  draft:{id:'current',readingJourney:{book:'雅',chapter:1,translation:'CUV',startVerse:1,endVerse:3}}
 };
 const fn=vm.runInNewContext(section('function voiceReunionEntries(){','function voiceYearRingView(){')+';voiceReunionEntries',sandbox);
 assert.equal(fn().length,1);
 assert.equal(fn()[0].id,'history');
});
test('audio privacy, working DSP and active player continue across right-page redraw',()=>{
 const render=section('function render(){','function audioDatabase(){');
 assert.match(render,/host\.replaceChildren\(activePlayer\)/);
 assert.doesNotMatch(render,/updateSoundPathProgress|soundPathView/);
 const restore=section('async function restoreAudio(id){','async function deleteAudio(id){');
 assert.match(restore,/token!==audioRestoreToken/);
 assert.match(restore,/scope!==owner/);
 assert.match(source,/denoiseEnabled\|\|eqEnabled\|\|compEnabled\|\|reverbEnabled/);
 const stage=section('function stageReading(){','const LIGHTS=Object.freeze(');
 assert.doesNotMatch(stage,/<select/);
});
