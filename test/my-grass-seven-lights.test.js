'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../pasture-preview/my-grass-core.js');
const main=fs.readFileSync(path.join(__dirname,'..','pasture-preview/my-grass-v1.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','pasture-preview/my-grass-immersive-v04.css'),'utf8');
const reading=fs.readFileSync(path.join(__dirname,'..','pasture-preview/my-grass-reading-v1.js'),'utf8');
const when='2026-10-19T10:00:00.000Z';
function completedJourney(translation='圣经和合本（神版）'){
 const point={book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation};
 const started=C.startReadingJourney(point,when);
 return C.completeReadingJourney(started,12000,'2026-10-19T10:00:12.000Z',{
  audioId:'local-audio-1',mimeType:'audio/webm',size:65000,durationSeconds:12
 });
}
test('a real completed audio reading is the only source of a stable center insight',()=>{
 const completed=completedJourney();
 assert.throws(()=>C.createInsightRecord(null,{heardText:'yes'},'i1',when),/本人原声/);
 assert.throws(()=>C.createInsightRecord(C.startReadingJourney({book:'约',chapter:3,verse:16,verseId:'JHN.3.16'},when),{heardText:'yes'},'i1',when),/本人原声/);
 assert.throws(()=>C.createInsightRecord(completed,{heardText:'  ',todayText:'\n\t'},'i1',when),/写下今天/);
 const insight=C.createInsightRecord(completed,{heardText:'我听见了爱',todayText:'我要爱人'},'i1',when);
 assert.equal(insight.reading_record_id,'local-audio-1');
 assert.equal(insight.scripture_range,'约 3:16');
 assert.deepEqual(insight.verse_ids,['JHN.3.16']);
 assert.equal(insight.status,'active');
 assert.equal(insight.insight_id,'i1');
 assert.ok(Object.isFrozen(insight));
});
test('a durable relation and event preserve the original insight and six fixed types',()=>{
 const insight=C.createInsightRecord(completedJourney(),{heardText:'恩典',todayText:'回应'},'i1',when);
 assert.deepEqual([...C.LIGHT_TYPES],['OUT','TIMELINE','SCRIPTURE','PRAYER','ACTION','GOSPEL']);
 for(const type of C.LIGHT_TYPES){
  const relation=C.createLightRelation(insight,type,'一次真实的连接',type,when);
  const event=C.createLightEvent(relation,type+'-event','one-real-event','internal',{},when);
  assert.equal(relation.insight_id,'i1');
  assert.equal(relation.light_type,type);
  assert.equal(event.relation_id,relation.relation_id);
  assert.equal(event.event_group_id,'one-real-event');
 }
 assert.equal(insight.heard_text,'恩典');
 assert.throws(()=>C.createLightRelation(insight,'OTHER','bad','x',when),/未知/);
 assert.throws(()=>C.createLightRelation(insight,'OUT','   ','x',when),/写下/);
});
test('inbound is anchored to an existing relationship and never edits source text',()=>{
 const insight=C.createInsightRecord(completedJourney(),{heardText:'起初',todayText:'今天'},'i1',when);
 const relation=C.createLightRelation(insight,'PRAYER','为同伴祷告','r1',when);
 assert.throws(()=>C.createInboundEvent(null,relation,'回复','e','g',when),/已存在/);
 assert.throws(()=>C.createInboundEvent({...insight,insight_id:'other'},relation,'回复','e','g',when),/已存在/);
 const event=C.createInboundEvent(insight,relation,'对方回应','e','g',when);
 assert.equal(event.direction,'inbound');
 assert.equal(event.payload.source,'对方回应');
 assert.equal(insight.today_text,'今天');
});
test('ESV journey, center and archived entry are reference-only, never licensed text',()=>{
 const j=completedJourney('English Standard Version (ESV)');
 const insight=C.createInsightRecord(j,{heardText:'Faith',todayText:'Hope'},'esv-i',when);
 const entry=C.newEntry({scripture:{reference:'约 3:16',translation:'English Standard Version (ESV)',source:'esv',text:'DO NOT PERSIST LICENSED TEXT'},readingJourney:j,reflection:'Faith\nHope',reading:j.audio},when,'e1');
 assert.equal(entry.scripture.text,'');
 assert.equal(entry.scripture.storage,'reference-only');
 assert.equal(insight.translation,'English Standard Version (ESV)');
});
test('actual main UI has two independently autosaved fields, one center, and six in-place nodes',()=>{
 assert.match(main,/data-field="heardText"/);
 assert.match(main,/data-field="todayText"/);
 assert.match(main,/draft\.insightDraft\[field\]=v;persistDraft\(\)/);
 assert.match(main,/C\.createInsightRecord\(draft\.readingJourney/);
 assert.match(main,/if\(!saveEntry\(\)\)\{draft\.insightRecord=null/);
 assert.match(main,/const LIGHTS=Object\.freeze\(\[/);
 for(const label of ['传','忆','连','求','行','去'])assert.ok(main.includes("'"+label+"'"));
 assert.match(main,/data-action="light-focus"/);
 assert.match(main,/focusLight=b\.dataset\.light;render\(\)/);
 assert.match(main,/writeJson\(persistentKeys\(\)\.graph,updated\)/);
 assert.match(main,/entries,micros,lightGraph/);
 assert.match(css,/\.gs-light-center\.is-lit/);
 assert.match(css,/\.gs-light-node\.is-dim/);
 assert.match(css,/\.gs-light-node\.is-linked/);
 assert.doesNotMatch(main,/1\/7|2\/7|七光完成率/);
});
test('the completed voice and reading session are archived before insight; future stages are gated',()=>{
 const onstop=main.slice(main.indexOf('journeyRecorder.onstop=async()=>'),main.indexOf('journeyRecorder.start(250)'));
 assert.match(onstop,/await putAudio\(audioId,blob\)/);
 assert.match(onstop,/C\.completeReadingJourney/);
 assert.match(onstop,/draft\.readingJourney=journey/);
 assert.match(onstop,/persistDraft\(\);journeyPhase='completed'/);
 assert.match(onstop,/const archived=saveEntry\(\)/);
 const setter=main.slice(main.indexOf('function setTab(next)'),main.indexOf('function insertArchiveText()',main.indexOf('function setTab(next)')));
 assert.match(setter,/next==='reflection'&&journeyPhase!=='completed'&&!legacy/);
 assert.match(setter,/next==='sharing'&&!draft\.insightRecord&&!legacy/);
 assert.match(reading,/mygrass:journey-pause-request/);
 assert.match(reading,/mygrass:journey-resume-request/);
});
test('source finalization reuses one entry and only lights after archive persistence',()=>{
 const from=main.indexOf('function finalizeInsight(){'),to=main.indexOf('function addLightRelation(){',from);
 assert.ok(from>=0&&to>from);
 const handler=main.slice(from,to);
 let saved=0,rendered=0,notices=[],counter=0;
 const ctx={
  C,iso:()=>when,randomId:()=>('id-'+(++counter)),
  draft:{insightDraft:{heardText:'听见',todayText:'于我'},readingJourney:completedJourney(),reflection:''},
  journeyPhase:'completed',focusLight:null,
  insightText(){return ctx.draft.insightDraft},
  saveEntry(){saved++;return {id:'archive'}},
  render(){rendered++},tell(msg){notices.push(msg)}
 };
 vm.runInNewContext(handler+';globalThis.finalize=finalizeInsight;',ctx);
 ctx.finalize();
 assert.equal(saved,1);
 assert.equal(rendered,1);
 assert.equal(ctx.draft.insightRecord.insight_id,'id-1');
 assert.equal(ctx.draft.reflection,'听见\n于我');
 ctx.finalize();
 assert.equal(saved,1,'a second center click must not duplicate the original record');
});


test('an actual archive write restores one same-ID insight and its voice binding on page reload',()=>{
 const start=main.indexOf('function persistentKeys(){');
 const end=main.indexOf('function setTab(next)',start);
 assert.ok(start>=0&&end>start,'the real storage implementation exists');
 const storageSource=main.slice(start,end);
 const journey=completedJourney();
 const memory=new Map();
 const ctx={
  C,scope:'unassigned-preview',key:C.STORAGE_PREFIX+'.unassigned-preview',
  draft:{
   id:'entry-voice-1',
   scripture:{reference:'约 3:16',text:'神爱世人',translation:'圣经和合本（神版）',source:'cuv1919-shen-s'},
   readingJourney:journey,reading:journey.audio,reflection:'',
   insightDraft:{heardText:'恩典',todayText:'我要爱人'},insightRecord:null,lightDraft:{}
  },
  entries:[],micros:[],lightGraph:{relations:[],events:[]},
  randomId:()=>'id',iso:()=>when,tell:()=>{},
  getStored:key=>memory.get(key)||null,setStored:(key,value)=>memory.set(key,value),
  getJson:(key,fallback)=>memory.has(key)?JSON.parse(memory.get(key)):fallback,
  writeJson:(key,value)=>memory.set(key,JSON.stringify(value)),
  cardIdentity:()=>({phase:'guest'}),
  emptyDraft:()=>({id:'fresh',scripture:{reference:'',text:''},reading:{},reflection:''}),
  document:{getElementById:()=>({textContent:''})}
 };
 const body=[
  "let scope=ctx.scope,key=ctx.key,draft=ctx.draft,entries=ctx.entries,micros=ctx.micros,editingSavedId=null,recorder=null,audioPending=false,journeyPhase='completed',lightGraph=ctx.lightGraph,focusLight=null;",
  "const C=ctx.C,PREFIX=C.STORAGE_PREFIX,randomId=ctx.randomId,iso=ctx.iso,tell=ctx.tell,getStored=ctx.getStored,setStored=ctx.setStored,getJson=ctx.getJson,writeJson=ctx.writeJson,cardIdentity=ctx.cardIdentity,emptyDraft=ctx.emptyDraft,document=ctx.document;",
  storageSource,
  "const first=saveEntry();",
  "draft.insightRecord=C.createInsightRecord(journey,draft.insightDraft,'stable-insight',iso());",
  "draft.reflection='恩典\\n我要爱人';",
  "const finalized=saveEntry();",
  "scope='';draft=null;entries=[];micros=[];loadForIdentity();",
  "return {first,finalized,entries,draft};"
 ].join('\n');
 const reloaded=new Function('ctx','journey',body)(ctx,journey);
 assert.ok(reloaded.first&&reloaded.finalized);
 assert.equal(reloaded.entries.length,1);
 assert.equal(reloaded.entries[0].id,'entry-voice-1');
 assert.equal(reloaded.entries[0].insightRecord.insight_id,'stable-insight');
 assert.equal(reloaded.draft.insightRecord.reading_record_id,'local-audio-1');
 assert.equal(reloaded.draft.insightDraft.heardText,'恩典');
});
test('inbound echoes are rendered from stored events and light flashes are transient',()=>{
 assert.match(main,/lightGraph\.events\.filter\(ev=>ev\.relation_id===r\.relation_id&&ev\.direction==='inbound'\)/);
 assert.match(main,/escape\(ev\.payload\?\.source\|\|''\)/);
 assert.match(main,/node\.classList\.add\('is-pulsing'\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
