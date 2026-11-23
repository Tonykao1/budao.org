'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','pasture-preview','my-grass-reading-v1.js'),'utf8');
const start=source.indexOf('function renderReadingStatus(){');
const end=source.indexOf('function renderReader(){',start);
assert.ok(start>=0&&end>start,'reading status renderer is present');
const renderer=source.slice(start,end);
function harness(){
 const state={phase:'recording',confirm:false,elapsed:1200,journey:{book:'创',chapter:1,endVerse:2,reference:'创 1:1–2'}};
 const node={dataset:{},writes:0,_html:'',set innerHTML(s){this._html=s;this.writes++},get innerHTML(){return this._html},textContent:''};
 const ctx={node,state};
 vm.runInNewContext(
  'let journey=state.journey,journeyPhase=state.phase,journeyElapsed=state.elapsed,journeyConfirm=state.confirm,journeyError="";'+
  'const workspace=()=>({querySelector:()=>node}); const esc=value=>String(value);'+
  renderer+
  'globalThis.render=()=>{journeyConfirm=state.confirm;journeyPhase=state.phase;journeyElapsed=state.elapsed;journey=state.journey;renderReadingStatus()};'
 ,ctx);
 return {node,state,render:ctx.render};
}
test('REC status preserves the physical end button across repeated reader syncs',()=>{
 const h=harness();h.render();h.state.elapsed=1450;h.render();h.state.elapsed=1700;h.render();
 assert.equal(h.node.writes,1,'the stop button must not be detached/recreated on 250ms ticks');
 assert.match(h.node.innerHTML,/end-journey-ask/);
});
test('continue/end confirmation buttons remain mounted while recording ticks run',()=>{
 const h=harness();h.render();h.state.phase='paused';h.render();h.state.elapsed=1700;h.render();
 assert.equal(h.node.writes,2,'confirm UI must replace the status once, not every tick');
 assert.match(h.node.innerHTML,/end-journey-confirm/);
});

test('new page is blocked in capture phase while an active journey is recording or paused',()=>{
 const begin=source.indexOf('function onClick(event){'),end=source.indexOf('function onChange(event){',begin);
 assert.ok(begin>=0&&end>begin,'reading click handler exists');
 const handler=source.slice(begin,end);
 for(const phase of ['arming','recording','paused','finalizing']){
  const calls={prevented:0,stopped:0,notices:[],resets:0},ctx={phase,calls};
  vm.runInNewContext([
   "let journeyPhase=phase,journey={reference:'创 1:1'},journeyConfirm=true,session={id:'keep'},activeChapter={},chapterKey='current',lastStageKey='current',lastReaderSignature='current',lastReaderNode={};",
   "const status=msg=>calls.notices.push(msg);",
   "const C={setRuntimeReadingJourney:()=>calls.resets++,setRuntimeReadingSession:()=>calls.resets++};",
   "const root={setTimeout:()=>calls.resets++};",
   "const doc={querySelector:()=>null};",
   "const normalizeFreshPage=()=>calls.resets++;const schedule=()=>calls.resets++;",
   handler,
   "globalThis.click=onClick;globalThis.state=()=>({journeyPhase,journey,session});"
  ].join('\n'),ctx);
  ctx.click({
   target:{closest:()=>({matches:()=>false,dataset:{action:'new'}})},
   preventDefault:()=>calls.prevented++,
   stopImmediatePropagation:()=>calls.stopped++
  });
  assert.equal(calls.prevented,1,phase+' must prevent navigation');
  assert.equal(calls.stopped,1,phase+' must stop the workspace new-page handler');
  assert.equal(calls.resets,0,phase+' must not reset reader or recording');
  assert.equal(ctx.state().journeyPhase,phase);
  assert.equal(ctx.state().journey.reference,'创 1:1');
  assert.match(calls.notices.join(' '),/结束今日读经/);
 }
});

test('chapter navigation correctly treats paused confirmation as a live journey',()=>{
 assert.match(source,/\['arming','recording','paused','finalizing'\]\.includes\(journeyPhase\)\?'请先结束今日读经，再翻到另一章。'/);
});
