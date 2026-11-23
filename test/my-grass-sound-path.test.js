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
const model=vm.runInNewContext(section('function soundPathModel(value){','function stageReading(){')+';soundPathModel');
const journey={status:'completed',durationMs:22000,segments:[
 {verse:1,verseId:'JAS.1.1',startMs:0,endMs:8000},
 {verse:2,verseId:'JAS.1.2',startMs:8000,endMs:17000},
 {verse:3,verseId:'JAS.1.3',startMs:17000,endMs:22000}
]};
test('remove both unproven visual modules; keep 1U recorder and 2U DSP intact',()=>{
 const stage=section('function stageReading(){','const LIGHTS=Object.freeze(');
 assert.match(stage,/gs-recorder-console/);
 assert.match(stage,/gs-voice-dsp/);
 assert.match(stage,/gs-dsp-denoise/);
 assert.match(stage,/gs-dsp-eq/);
 assert.match(stage,/gs-dsp-comp/);
 assert.match(stage,/gs-dsp-reverb/);
 assert.doesNotMatch(stage,/voiceYearRingView|gs-voice-yearring|gs-yearring|生命年轮|声迹|声音之路|soundPathView|gs-sound-/);
 assert.doesNotMatch(source,/function voiceYearRingView\(|function voiceReunionEntries\(|function soundPathView\(|function seekSoundVerse\(/);
 assert.doesNotMatch(css,/gs-yearring|gs-voice-yearring|gs-sound-/);
});
test('real verse timestamps remain available for the original left page, not a decorative timeline',()=>{
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
test('the left-page reader still receives calibrated playback time without scripture UI changes',()=>{
 const piece=section('function soundMediaDurationMs(player){','async function togglePlayback(){');
 const f=vm.runInNewContext(piece+';({soundMediaDurationMs,soundMediaToJourneyMs})',{soundPathModel:model,draft:{readingJourney:journey},Number,Math});
 assert.equal(f.soundMediaDurationMs({duration:20}),20000);
 assert.ok(Math.abs(f.soundMediaToJourneyMs(7272.7272727,{duration:20})-8000)<.01);
 assert.equal(f.soundMediaToJourneyMs(20000,{duration:20}),22000);
 assert.equal(f.soundMediaToJourneyMs(5000,{duration:Infinity}),null);
 assert.equal(journey.segments[1].startMs,8000,'original recording metadata is untouched');
 const broadcaster=section('function broadcastReadingAudioProgress(state,player){','function releaseDenoiseMonitor(){');
 assert.match(broadcaster,/soundMediaToJourneyMs/);
 assert.match(broadcaster,/mygrass:reading-audio-progress/);
});
test('audio export remains a real footer action, not dependent on discarded year rings',()=>{
 const render=section('function render(){','function audioDatabase(){');
 assert.match(render,/data-action="download-audio"/);
 assert.match(render,/保存原声/);
 assert.match(render,/data-action="export"/);
 assert.match(render,/data-action="'\+\(archiveOpen\?'return-stage':'archive'\)/);
 assert.match(source,/case 'download-audio':await exportAudio\(\);break/);
 const exportFn=section('async function exportAudio(){','async function copyMicro(id){');
 assert.match(exportFn,/await getAudio\(draft\.reading\.audioId\)/);
 assert.match(exportFn,/downloadBlob\(blob,/);
 assert.doesNotMatch(exportFn,/upload|putAudio\(/);
});
test('authentic existing private archive remains, false reunion showcase is removed',()=>{
 const archive=section('function insertArchiveText(){','function recordingSelectionReady(){');
 assert.match(archive,/C\.groupByReference\(entries\)/);
 assert.match(archive,/data-action="open-entry"/);
 const render=section('function render(){','function audioDatabase(){');
 assert.match(render,/gs-grid gs-archive-only/);
 assert.match(render,/insertArchiveText\(\)/);
 assert.doesNotMatch(render,/经文重逢|每一次真实的领受/);
 assert.match(css,/\.gs-grid\.gs-archive-only/);
});
test('audio privacy and resident-owned player survive redraw without changing DSP monitoring',()=>{
 const render=section('function render(){','function audioDatabase(){');
 assert.match(render,/host\.replaceChildren\(activePlayer\)/);
 const restore=section('async function restoreAudio(id){','async function deleteAudio(id){');
 assert.match(restore,/token!==audioRestoreToken/);
 assert.match(restore,/scope!==owner/);
 assert.match(source,/denoiseEnabled\|\|eqEnabled\|\|compEnabled\|\|reverbEnabled/);
 assert.doesNotMatch(render,/voiceYearRingView|voiceReunionEntries/);
});
