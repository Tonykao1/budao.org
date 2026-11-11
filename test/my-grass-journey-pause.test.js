'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const main=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-v1.js'),'utf8');
const reading=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
const code=main.slice(main.indexOf('  // The current verse and continuous microphone recording'),main.indexOf("  document.addEventListener('mygrass:journey-start-request'"));
function harness(){
 let now=0;const events=[],timers=[],rec={state:'recording',paused:0,resumed:0,stopped:0,pause(){this.paused++;this.state='paused'},resume(){this.resumed++;this.state='recording'},stop(){this.stopped++;this.state='inactive'}};
 const env={performance:{now:()=>now},setInterval:()=>3,clearInterval:()=>{},setTimeout:(fn,delay)=>{timers.push(delay);return 4},clearTimeout:()=>{},document:{dispatchEvent:e=>events.push(e)},window:{},CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}},rec};
 vm.runInNewContext(["let journeyPhase='recording',journeyStartedClock=0,journeyPauseTotal=0,journeyPausedClock=null,journeyFinalMs=0,journeyTickTimer=3,journeyStopTimer=4,journey={endVerse:1},journeyRecorder=rec,journeyStream=null,journeyError='';","const $=()=>null; const render=()=>{};const tell=()=>{};const C={setRuntimeReadingJourney(){}};",code,"globalThis.api={journeyElapsedMs,pauseJourney,resumeJourney,finishJourney,phase:()=>journeyPhase,finalMs:()=>journeyFinalMs};"].join('\n'),env);
 return {api:env.api,rec,events,timers,setNow:n=>{now=n}};
}
test('end intent pauses original MediaRecorder and freezes effective elapsed time',()=>{
 const h=harness();h.setNow(2000);h.api.pauseJourney();
 assert.equal(h.rec.state,'paused');assert.equal(h.api.phase(),'paused');assert.equal(h.api.journeyElapsedMs(),2000);
 h.setNow(32000);assert.equal(h.api.journeyElapsedMs(),2000);
 assert.equal(h.events.at(-1).detail.elapsedMs,2000);
});
test('continue resumes the same recorder, excludes pause gap and preserves verse timestamps',()=>{
 const h=harness();h.setNow(2000);h.api.pauseJourney();h.setNow(32000);h.api.resumeJourney();
 assert.equal(h.rec.resumed,1);assert.equal(h.api.phase(),'recording');
 assert.equal(h.api.journeyElapsedMs(),2000);h.setNow(38000);assert.equal(h.api.journeyElapsedMs(),8000);
 assert.ok(h.timers.includes(15*60*1000-2000),'fifteen-minute limit applies to recorded rather than paused time');
});
test('ending directly from paused recorder closes audio at the frozen position',()=>{
 const h=harness();h.setNow(5000);h.api.pauseJourney();h.setNow(45000);h.api.finishJourney();
 assert.equal(h.rec.stopped,1);assert.equal(h.api.finalMs(),5000);assert.equal(h.api.phase(),'finalizing');
});
test('reading controls request pause and resume instead of merely showing a local confirmation',()=>{
 const handlers=reading.slice(reading.indexOf("if(action==='end-journey-ask')"),reading.indexOf("if(action==='next-reflection'"));
 assert.match(handlers,/mygrass:journey-pause-request/);
 assert.match(handlers,/mygrass:journey-resume-request/);
 assert.match(reading,/journeyPhase==='paused'/);
 assert.doesNotMatch(handlers,/journeyConfirm=true/);
});
