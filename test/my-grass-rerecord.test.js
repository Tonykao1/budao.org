'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-v1.js'),'utf8');
function harness({accept=true,insight=false,shares=false}={}){
 const originalJourney={
  status:'completed',book:'诗',chapter:23,startVerse:1,endVerse:4,
  reference:'诗 23:1–4',translation:'圣经和合本（神版）',durationMs:18000,
  audio:{audioId:'voice-old',size:20000}
 };
 const original={id:'existing-entry',scripture:{reference:'诗 23:1–4',text:'经文'},
  readingJourney:originalJourney,reading:{audioId:'voice-old',size:20000},insightRecord:insight?{insight_id:'insight1'}:null};
 const expressions=source.slice(source.indexOf('function cancelRerecord(){'),source.indexOf('async function startOrStopRecording(){'));
 assert.match(expressions,/function rerecordAudio/);
 const sandbox={window:{confirm:()=>accept},console,Date,Object,Array,JSON,Math};
 const wrapper="(()=>{"+
  "let scope='pasture-resident-11111111-2222-3333-4444-555555555555',"+
  "draft=JSON.parse(JSON.stringify(initial)),entries=[initial],"+
  "micros=[],rerecordOriginal=null,journey=draft.readingJourney,"+
  "journeyPhase='completed',journeyFinalMs=18000,journeyError='';"+
  "let clearCount=0,notice='',renderCount=0,runtime=null;"+
  "const getEntry=()=>entries[0],clearPlayer=()=>{clearCount++},"+
  "emitJourneyState=()=>{},render=()=>{renderCount++},tell=text=>{notice=text},"+
  "C={setRuntimeReadingJourney:v=>{runtime=v}};"+
  expressions+
  "return {start:rerecordAudio,cancel:cancelRerecord,"+
  "snapshot:()=>({draft,journey,journeyPhase,journeyFinalMs,rerecordOriginal,clearCount,renderCount,notice,runtime})};"+
  "})()";
 sandbox.initial={...original,shareIds:shares?['micro-one']:[]};
 return vm.runInNewContext(wrapper,sandbox);
}
test('completed reading provides replay AND rerecord/cancel within approved recorder',()=>{
 const stage=source.slice(source.indexOf('function stageReading()'),source.indexOf('function stageReflection()'));
 assert.match(stage,/data-action="play"/);
 assert.match(stage,/data-action="rerecord"/);
 assert.match(stage,/data-action="cancel-rerecord"/);
 assert.match(stage,/gs-recorder-rerecord/);
 assert.doesNotMatch(stage,/data-action="record"/);
});
test('confirmed rerecord keeps original audio, passage and entry unchanged until replacement',()=>{
 const h=harness();h.start();const v=h.snapshot();
 assert.equal(v.rerecordOriginal.audioId,'voice-old');
 assert.equal(v.rerecordOriginal.journey.startVerse,1);
 assert.equal(v.draft.reading.audioId,'voice-old');
 assert.equal(v.draft.readingJourney.status,'completed');
 assert.equal(v.journey,null);
 assert.equal(v.journeyPhase,'idle');
 assert.equal(v.clearCount,1);
 assert.match(v.notice,/旧音频仍安全保留/);
 h.cancel();const restored=h.snapshot();
 assert.equal(restored.rerecordOriginal,null);
 assert.equal(restored.draft.reading.audioId,'voice-old');
 assert.equal(restored.journey.status,'completed');
 assert.equal(restored.journeyPhase,'completed');
 assert.match(restored.notice,/原声及经节记录保持不变/);
});
test('declining, linked insights, and shared records cannot replace original',()=>{
 let h=harness({accept:false});h.start();assert.equal(h.snapshot().rerecordOriginal,null);
 h=harness({insight:true});h.start();assert.equal(h.snapshot().rerecordOriginal,null);
 assert.match(h.snapshot().notice,/正式领受/);
 h=harness({shares:true});h.start();assert.equal(h.snapshot().rerecordOriginal,null);
 assert.match(h.snapshot().notice,/关联牧草/);
});
test('changed reading range is accepted within same chapter and must be explicitly confirmed',()=>{
 const start=source.slice(source.indexOf('async function startJourney(point)'),source.indexOf('function advanceJourney(point)'));
 const advancing=source.slice(source.indexOf('function advanceJourney(point)'),source.indexOf('function pauseJourney()'));
 const finish=source.slice(source.indexOf('function finishJourney()'),source.indexOf("document.addEventListener('mygrass:journey-start-request'"));
 assert.match(start,/point\.translation!==original\.journey\.translation/);
 assert.doesNotMatch(start,/point\.verse!==original\.journey\.startVerse/);
 assert.doesNotMatch(start,/journey\.endVerse!==rerecordOriginal\.journey\.endVerse/);
 assert.match(start,/const previousAudioId=rerecordOriginal\?\.audioId/);
 assert.match(start,/const archived=saveEntry\(\)/);
 assert.match(start,/if\(!archived&&previousDraft\)/);
 assert.match(start,/scripture:\{\.\.\.draft\.scripture\}/,'restore exact original scripture when archive fails');
 assert.match(start,/draft=previousDraft/);
 assert.match(start,/if\(archived\)\{/);
 const archivedAt=start.indexOf('const archived=saveEntry()');
 const deletedAt=start.indexOf('await deleteAudio(previousAudioId)');
 assert.ok(archivedAt>=0&&deletedAt>archivedAt);
 assert.doesNotMatch(advancing,/point\.verse>rerecordOriginal\.journey\.endVerse/);
 assert.match(finish,/journey\.reference!==rerecordOriginal\.journey\.reference/);
 assert.match(finish,/window\.confirm/);
 assert.match(finish,/更新为本次经文范围及原声/);
});
test('old audio player cannot remount over in-progress rerecord',()=>{
 assert.match(source,/const playDisabled=!hasAudio\|\|!linked\|\|!!rerecordOriginal/);
 assert.match(source,/!archiveOpen&&!rerecordOriginal&&draft\.reading\.audioId/);
 assert.match(source,/draft\?\.reading\?\.audioId!==id\|\|rerecordOriginal/);
});
