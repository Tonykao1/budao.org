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
 assert.match(seek,/await waitSoundMetadata\(player\)/);
 assert.match(seek,/player\.currentTime=target\/1000/);
 assert.match(seek,/token!==soundSeekToken/);
 assert.match(seek,/await player\.play\(\)/);
 assert.match(seek,/scope!==owner/);
 assert.doesNotMatch(seek,/deleteAudio|saveEntry|putAudio|writeJson/);
 const pathView=section('function soundPathView(){','function voiceReunionEntries(){');
 assert.match(pathView,/data-action="sound-seek"/);
 assert.match(pathView,/s\.left\.toFixed\(4\)/);
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


test('calibration maps saved verse clock to playable media clock and back without changing the archive',()=>{
 const piece=section('function soundMediaDurationMs(player){','async function seekSoundVerse(ms){');
 const sandbox={soundPathModel:math.soundPathModel,draft:{readingJourney:journey},Number,Promise,setTimeout,clearTimeout};
 const result=vm.runInNewContext(piece+';({soundMediaDurationMs,soundJourneyToMediaMs,soundMediaToJourneyMs})',sandbox);
 const audio={duration:20,readyState:1};
 assert.equal(result.soundMediaDurationMs(audio),20000);
 assert.ok(Math.abs(result.soundJourneyToMediaMs(8000,audio)-7272.7272727)<.01);
 assert.ok(Math.abs(result.soundMediaToJourneyMs(7272.7272727,audio)-8000)<.01);
 assert.equal(result.soundJourneyToMediaMs(22000,audio),20000);
 assert.equal(result.soundMediaToJourneyMs(20000,audio),22000);
 assert.equal(result.soundJourneyToMediaMs(8000,{duration:Infinity}),null);
 assert.equal(journey.segments[1].startMs,8000,'original journey boundary untouched');
});
test('sound path progress shows real moving playhead, current verse, clock and pause without false glow',()=>{
 const piece=section('function updateSoundPathProgress(ms,playing){','async function togglePlayback(){');
 const makeNode=(verse,marker=true)=>{
  const states=new Set();const attrs={};
  return {dataset:{verse:String(verse)},attrs,
   classList:{toggle(k,on){if(on)states.add(k);else states.delete(k)},contains(k){return marker&&k==='gs-sound-marker'},has(k){return states.has(k)}},
   setAttribute(k,v){attrs[k]=v},removeAttribute(k){delete attrs[k]}};
 };
 const nodes=[makeNode(1),makeNode(2),makeNode(3),makeNode(1,false),makeNode(2,false),makeNode(3,false)];
 const current={textContent:''},clock={textContent:''},lane={styles:{},states:new Set(),style:{setProperty(k,v){lane.styles[k]=v}},classList:{toggle(k,on){if(on)lane.states.add(k);else lane.states.delete(k)}}};
 const root={querySelectorAll(){return nodes},querySelector(s){return s==='.gs-sound-current'?current:s==='.gs-sound-clock'?clock:s==='.gs-sound-lane'?lane:null}};
 const sandbox={draft:{readingJourney:journey},soundPathModel:math.soundPathModel,soundTime:math.soundTime,root,Number,Math};
 const tick=vm.runInNewContext(piece+';updateSoundPathProgress',sandbox);
 tick(8000,true);
 assert.equal(nodes[1].attrs['aria-current'],'true');
 assert.equal(nodes[0].attrs['aria-current'],undefined);
 assert.equal(current.textContent,'第 2 节 · 00:08—00:17');
 assert.equal(clock.textContent,'00:08 / 00:22');
 assert.equal(lane.styles['--sound-progress'],'36.3636%');
 assert.ok(lane.states.has('is-moving'));
 tick(10000,false);
 assert.equal(nodes[1].attrs['aria-current'],undefined);
 assert.ok(!lane.states.has('is-moving'));
 assert.equal(clock.textContent,'00:10 / 00:22');
 tick(22000,false);
 assert.equal(clock.textContent,'00:22 / 00:22');
 assert.equal(nodes[2].attrs['aria-current'],undefined);
});
test('range validation rejects misleading nonzero starts and time gaps',()=>{
 const bogus=[journey.segments[0],{...journey.segments[1],startMs:8100},journey.segments[2]];
 assert.equal(math.soundPathModel({...journey,segments:bogus}),null);
 assert.equal(math.soundPathModel({...journey,segments:[{...journey.segments[0],startMs:1},...journey.segments.slice(1)]}),null);
 assert.equal(math.soundPathModel({...journey,segments:journey.segments.map((s,i)=>i===2?{...s,verse:7}:s)}),null);
 assert.equal(math.soundPathModel({...journey,durationMs:23000}),null);
});
test('async player restoration respects current resident and reuses active audio across redraw',()=>{
 const restore=section('async function restoreAudio(id){','async function deleteAudio(id){');
 assert.match(restore,/token!==audioRestoreToken/);
 assert.match(restore,/scope!==owner/);
 assert.match(restore,/host!==\$\('#gsAudioHost'\)/);
 assert.match(restore,/audioRestorePending\?\.id===id/);
 assert.match(restore,/player\.dataset\.ownerScope=owner/);
 const render=section('function render(){','function audioDatabase(){');
 assert.match(render,/host\.replaceChildren\(activePlayer\)/);
 assert.match(render,/soundMediaToJourneyMs\(activePlayer\.currentTime\*1000,activePlayer\)/);
 const clear=section('function clearPlayer(){','async function restoreAudio(id){');
 assert.match(clear,/audioRestoreToken\+\+/);
});
test('left page receives calibrated verse clock with no modifications to scripture renderer',()=>{
 const bridge=section('function broadcastReadingAudioProgress(state,player){','function releaseDenoiseMonitor(){');
 assert.match(bridge,/soundMediaToJourneyMs/);
 assert.match(bridge,/currentTime:calibrated==null/);
 const ui=section('function soundPathView(){','function voiceReunionEntries(){');
 assert.match(ui,/gs-sound-playhead/);
 assert.match(ui,/gs-sound-clock/);
 assert.match(css,/\.gs-sound-lane\.is-moving \.gs-sound-playhead i/);
});
