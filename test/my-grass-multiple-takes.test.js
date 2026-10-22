'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-v1.js'),'utf8');
const reader=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-reading-v1.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-immersive-v04.css'),'utf8');
const take=(start,end)=>{const a=app.indexOf(start),b=app.indexOf(end,a);assert.ok(a>=0&&b>a);return app.slice(a,b)};
const functions=[
 take('function discardCurrentTake(){','function journeyFail(message){'),
 take('function journeyFail(message){','document.addEventListener(\'mygrass:journey-start-request\'')
].join('\n');
const scope='pasture-resident-11111111-2222-3333-4444-555555555555';
function demo({hasPrevious=true,confirm=()=>true,mic=async()=>({getTracks:()=>[{stop(){}}]}),archiveWorks=true}={}){
 let seq=0,clock=0;const written=[],deleted=[],snapshots=[],recorders=[];
 const old={status:'completed',book:'诗',chapter:23,startVerse:1,endVerse:4,
  reference:'诗 23:1–4',translation:'圣经和合本（神版）',durationMs:18000,audio:{audioId:'voice-old',size:220}};
 const initial={id:'entry1',scripture:{reference:'诗 23:1–4',text:'test passage',translation:'圣经和合本（神版）',source:'test'},
  reading:{audioId:hasPrevious?'voice-old':null},readingJourney:hasPrevious?old:null,insightRecord:null};
 class Recorder{
  static isTypeSupported(){return true}
  constructor(stream,opts){this.state='inactive';this.mimeType=opts?.mimeType||'audio/webm';recorders.push(this)}
  start(){this.state='recording';this.onstart?.()}
  pause(){this.state='paused'}
  resume(){this.state='recording'}
  stop(){
   if(this.state==='inactive')throw Error('already stopped');
   this.state='inactive';
   // MediaRecorder callbacks arrive asynchronously, even if a new take starts first.
   queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['true spoken words'],{type:'audio/webm'})});void this.onstop?.()});
  }
 }
 const C={
  startReadingJourney(point){return {status:'recording',book:point.book,chapter:point.chapter,startVerse:point.verse,endVerse:point.verse,
    reference:point.book+' '+point.chapter+':'+point.verse,translation:point.translation,verseIds:[point.verseId],segments:[{verse:point.verse,startMs:0,endMs:null}]}},
  advanceReadingJourney(j,p,ms){return {...j,endVerse:p.verse,reference:j.book+' '+j.chapter+':'+j.startVerse+'–'+p.verse,
    verseIds:[...j.verseIds,p.verseId],segments:[...j.segments.slice(0,-1),{...j.segments.at(-1),endMs:ms},{verse:p.verse,startMs:ms,endMs:null}]}},
  completeReadingJourney(j,ms,_,meta){return {...j,status:'completed',durationMs:ms,audio:meta}},
  setRuntimeReadingJourney(value){snapshots.push(value)}
 };
 const sandbox={
  Blob,MediaRecorder:Recorder,navigator:{mediaDevices:{getUserMedia:mic}},
  window:{MediaRecorder:Recorder,confirm},performance:{now:()=>{clock+=1000;return clock}},
  console,setTimeout:()=>1,clearTimeout(){},setInterval:()=>2,clearInterval(){},
  iso:()=>new Date().toISOString(),randomId:()=>String(++seq),
  initial,initialJourney:old,C,scope,backend: {written,deleted,snapshots},
 };
 const wrapper=`(()=>{
  let draft=structuredClone(initial),entries=[structuredClone(initial)],micros=[],
   rerecordOriginal=initial.reading.audioId?{audioId:'voice-old',scope,draftId:'entry1',journey:initialJourney}:null,
   journey=null,journeyPhase='idle',journeyAttemptToken=0,
   journeyStartedClock=0,journeyPauseTotal=0,journeyPausedClock=null,journeyFinalMs=0,
   journeyTickTimer=null,journeyStopTimer=null,journeyStream=null,journeyRecorder=null,journeyChunks=[],journeyError='',notice='';
  const residentAccess=()=>true,residentScope=()=>scope,tell=s=>{notice=s},
   render=()=>{},persistDraft=()=>{},emitJourneyState=()=>{},emitJourneyTick=()=>{},
   getEntry=()=>entries.find(e=>e.id===draft.id),
   putAudio=async(id,blob)=>{backend.written.push({id,size:blob.size})},
   deleteAudio=async id=>{backend.deleted.push(id)},
   saveEntry=()=>{if(!SAVE_WORKS)return null;entries=[{...draft}];return entries[0]},
   clearPlayer=()=>{},recordingSelectionReady=()=>true,
   journeyElapsedMs=()=>Math.max(0,performance.now()-journeyStartedClock-journeyPauseTotal);
  function releaseJourneyStream(){
   journeyStream?.getTracks().forEach(t=>t.stop());journeyStream=null;
   if(journeyStopTimer){clearTimeout(journeyStopTimer);journeyStopTimer=null}
   if(journeyTickTimer){clearInterval(journeyTickTimer);journeyTickTimer=null}
  }
  FUNCS
  return {start:startJourney,advance:advanceJourney,pause:pauseJourney,resume:resumeJourney,finish:finishJourney,
   discard:discardCurrentTake,restart:restartCurrentTake,
   inspect:()=>({phase:journeyPhase,journey,original:rerecordOriginal,token:journeyAttemptToken,oldEntry:entries[0],notice,recorders:backend.written.length})};
 })()`.replace('FUNCS',functions).replace('SAVE_WORKS',archiveWorks?'true':'false');
 sandbox.structuredClone=structuredClone;
 const run=vm.runInNewContext(wrapper,sandbox,{filename:'multi-take-simulation.js'});
 const point=n=>({book:'诗',chapter:23,verse:n,verseId:'PSA.23.'+n,translation:'圣经和合本（神版）'});
 return {...run,point,written,deleted,recorders};
}
async function flush(){for(let k=0;k<8;k++)await Promise.resolve()}
test('the recorder offers one-tap take-again when actively recording, arming, or paused',()=>{
 assert.match(app,/data-action="restart-current-take"/);
 assert.match(reader,/data-action="restart-current-take"/);
 assert.match(css,/#grassWorkspace \.gs-journey-controls\{[^}]*flex-wrap:wrap/);
 assert.match(css,/\.gs-journey-keys\{grid-template-columns:repeat\(3/);
});
test('user stops a flawed SECOND take halfway: finishing offers discard, then third/fourth tries work',async()=>{
 const h=demo();
 await h.start(h.point(1));h.advance(h.point(2));h.pause();h.finish();await flush();
 assert.equal(h.inspect().phase,'idle','early end prompts discard instead of trapping user paused');
 assert.equal(h.inspect().original.audioId,'voice-old');
 assert.equal(h.inspect().oldEntry.reading.audioId,'voice-old');
 assert.equal(h.written.length,0,'aborted retry never archived');
 await h.start(h.point(1));h.advance(h.point(2));h.restart();await flush();
 assert.equal(h.inspect().phase,'idle','retry works a third time');
 await h.start(h.point(1));h.advance(h.point(2));h.advance(h.point(3));h.advance(h.point(4));h.pause();h.finish();await flush();
 assert.equal(h.inspect().phase,'completed');
 assert.equal(h.written.length,1,'only the accepted full retry stores audio');
 assert.equal(h.inspect().oldEntry.reading.audioId,h.written[0].id);
 assert.equal(h.deleted.length,1);
 assert.equal(h.deleted[0],'voice-old','old audio retired only after new complete archive');
});
test('declining half-finished discard leaves recording paused and continuing remains possible',async()=>{
 let decisions=[false,true];
 const h=demo({confirm:()=>decisions.shift()});
 await h.start(h.point(1));h.advance(h.point(2));h.pause();h.finish();
 assert.equal(h.inspect().phase,'paused');
 assert.equal(h.inspect().oldEntry.reading.audioId,'voice-old');
 h.resume();h.advance(h.point(3));h.advance(h.point(4));h.pause();h.finish();await flush();
 assert.equal(h.inspect().phase,'completed');assert.equal(h.written.length,1);
});
test('rapidly abandoning one recording does not allow its late stop to overwrite the next take',async()=>{
 const h=demo();
 await h.start(h.point(1));const abandoned=h.recorders[0];h.discard();
 await h.start(h.point(1));
 abandoned.onstop?.();await flush();
 assert.equal(h.inspect().phase,'recording');
 assert.equal(h.written.length,0);assert.equal(h.deleted.length,0);
 h.restart();await flush();
 assert.equal(h.inspect().oldEntry.reading.audioId,'voice-old');
});
test('a canceled microphone permission prompt does not resurrect an abandoned take',async()=>{
 let resolveMic,closed=0;
 const delayed=()=>new Promise(resolve=>{resolveMic=resolve});
 const h=demo({mic:delayed});
 const first=h.start(h.point(1));h.discard();
 resolveMic({getTracks:()=>[{stop(){closed++}}]});
 await first;await flush();
 assert.equal(h.inspect().phase,'idle');
 assert.equal(h.recorders.length,0);
 assert.equal(closed,1);
});
test('failed archive after complete attempt never deletes old voice; user may retry',async()=>{
 const h=demo({archiveWorks:false});
 await h.start(h.point(1));h.advance(h.point(2));h.advance(h.point(3));h.advance(h.point(4));h.pause();h.finish();await flush();
 assert.equal(h.inspect().phase,'error');
 assert.equal(h.inspect().journey,null,'failed completed retake must not leave the reader locked');
 assert.equal(h.inspect().oldEntry.reading.audioId,'voice-old');
 assert.equal(h.deleted.length,0);
 assert.ok(h.inspect().original,'protected prior record remains selected');
 await h.start(h.point(1));assert.equal(h.inspect().phase,'recording');
 h.restart();await flush();
});
