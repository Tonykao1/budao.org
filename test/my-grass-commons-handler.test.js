'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
const handlerPath=require.resolve('../api/_security/pasture-commons-handler');
const policy=require('../api/_security/pasture-commons-domain');
const journey={
 status:'completed',reference:'约 13:34–35',translation:'圣经和合本（神版）',chapter:13,
 startVerse:34,endVerse:35,durationMs:22000,
 segments:[{verse:34,startMs:0,endMs:9000},{verse:35,startMs:9000,endMs:22000}],
 audio:{audioId:'my-local-audio'}
};

const AUTHOR='c2a7d6e4-7515-4dd9-ac09-818de1b37412';
const PEER='fd4b54fe-7aa9-4c10-9853-54f410a873c2';
const ID='ca64d982-7ced-45b9-98b3-1ca82174e518';
const ID2='ad52db83-ce3c-4449-a9d0-b0c1a00f6712';
const DB1='postgres://identity@ep-primary.region.neon.tech/identity';
const DB2='postgres://public@ep-separate.region.neon.tech/commons';
function previewEnv(fn){
 const keys=['VERCEL_ENV','PASTURE_COMMONS_ENABLED','DATABASE_URL','PASTURE_COMMONS_DATABASE_URL'];
 const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 Object.assign(process.env,{VERCEL_ENV:'preview',PASTURE_COMMONS_ENABLED:'true',
  DATABASE_URL:DB1,PASTURE_COMMONS_DATABASE_URL:DB2});
 return Promise.resolve().then(fn).finally(()=>{
  for(const k of keys){if(original[k]===undefined)delete process.env[k];else process.env[k]=original[k]}
 });
}
function fakeData(){
 const state={account:AUTHOR,records:[],receipts:[],schemaStatements:[]};
 const sql={async query(query,args=[]){
  if(/^(CREATE|ALTER)\b/i.test(query)){state.schemaStatements.push(query);return []}
  if(query.includes('FROM pasture_audio_receipts_v1')){
   if(query.startsWith('SELECT'))return state.receipts.filter(r=>
    query.includes('sha256=$3')?
      r.owner_id===args[0]&&r.audio_id===args[1]&&r.sha256===args[2]&&r.entry_id===args[3]&&r.journey_digest===args[4]:
      r.id===args[0]&&r.owner_id===args[1]&&r.audio_id===args[2]
   ); 
  }
  if(query.includes('FROM pasture_commons_v1')||query.startsWith('UPDATE pasture_commons_v1')){
   let items=state.records;
   if(query.includes('WHERE owner_id=$1 AND entry_id=$2')&&query.startsWith('SELECT'))
    items=items.filter(r=>r.owner_id===args[0]&&r.entry_id===args[1]);
   if(query.includes("kind='insight'")&&query.startsWith('SELECT'))items=items.filter(r=>r.kind==='insight');
   if(query.includes("kind='reading'")&&query.startsWith('SELECT'))items=items.filter(r=>r.kind==='reading');
   if(query.includes("voice='SPOKEN'")&&query.startsWith('SELECT'))items=items.filter(r=>r.voice==='SPOKEN');
   if(query.includes("status='PUBLISHED'")&&query.startsWith('SELECT'))items=items.filter(r=>r.status==='PUBLISHED');
   if(query.includes('WHERE id=$1 AND owner_id=$2')&&query.startsWith('UPDATE')){
    const affected=items.filter(r=>r.id===args[0]&&r.owner_id===args[1]&&r.status==='PUBLISHED');
    for(const r of affected){r.status='WITHDRAWN';r.public_text='';r.audio_data=null}
    return affected.map(r=>({id:r.id}));
   }
   if(query.startsWith('SELECT id,kind,status,entry_id,voice'))return items.map(r=>({
    id:r.id,kind:r.kind,status:r.status,entry_id:r.entry_id,voice:r.voice
   }));
   if(query.startsWith('SELECT id,status,kind'))return items.map(r=>({id:r.id,kind:r.kind,status:r.status}));
   if(query.startsWith('SELECT id'))return items.map(r=>({id:r.id}));
  }
  if(query.startsWith('INSERT INTO pasture_commons_v1')){
   let kind=query.includes("'reading'")?'reading':'insight';
   let row=kind==='reading'?{
    id:args[0],owner_id:args[1],entry_id:args[2],audio_id:args[3],
    scripture_reference:args[4],translation:args[5],voice:args[6],kind,status:'PUBLISHED',public_text:''
   }:{
    id:args[0],owner_id:args[1],entry_id:args[2],audio_id:args[3],
    scripture_reference:args[4],translation:args[5],voice:'NONE',kind,status:'PUBLISHED',public_text:args[6]
   };
   if(state.records.some(r=>r.owner_id===row.owner_id&&r.entry_id===row.entry_id)){
    const e=Error('unique violation');e.code='23505';throw e;
   }
   state.records.push(row);return [];
  }
  if(query.startsWith('INSERT INTO pasture_audio_receipts_v1')){
   state.receipts.push({id:args[0],owner_id:args[1],audio_id:args[2],entry_id:args[3],
     reference:args[4],sha256:args[5],journey_digest:args[6],bytes:args[7]});return [];
  }
  throw Error('UNMOCKED QUERY: '+query.slice(0,110));
 }};
 return {state,sql};
}
function mockApi(sql,state){
 const saved=Module._load;
 delete require.cache[handlerPath];
 try{
  Module._load=function(request,parent,isMain){
   if(parent?.filename===handlerPath){
    if(request==='@neondatabase/serverless')return{neon:()=>sql};
    if(request==='./pasture-auth-domain')return{
     readCookie:()=> 'authenticated-cookie',
     tokenHash:()=> 'hash'
    };
    if(request==='./pasture-auth-store')return{
     ensurePastureSchema:async()=>{},
     sessionByTokenHash:async()=>({user:{id:state.account,status:'ACTIVE',cardActivatedAt:new Date()}}),
     sheepForUser:async()=>({id:'sheep'})
    };
    if(request==='./rate-limit')return{consume:()=>true,clientIp:()=> 'test-ip'};
   }
   return saved.apply(this,arguments);
  };
  return require(handlerPath);
 }finally{Module._load=saved;delete require.cache[handlerPath]}
}
async function call(handler,{method='GET',url='/api/pasture-commons',body=null,origin='https://preview.example'}={}){
 const headers={host:'preview.example','content-type':'application/json'};
 if(origin!==null)headers.origin=origin;
 let status,object,ended,returnedHeaders={};
 const response={
  setHeader(k,v){returnedHeaders[k]=v},
  status(value){status=value;return this},
  json(payload){object=payload;return this},
  end(value){ended=value;return this}
 };
 await handler({method,url,headers,body},response);
 return {status,object,ended,headers:returnedHeaders};
}
function seedInsight(state,owner=AUTHOR){
 state.receipts.push({id:ID2,owner_id:owner,audio_id:'my-local-audio',entry_id:'entry01',
  reference:'约 13:34–35',sha256:'a'.repeat(64),journey_digest:policy.journeyDigest(journey),bytes:12345});
 return {insight_id:'insight01',reading_record_id:'my-local-audio',scripture_range:'约 13:34–35',translation:'圣经和合本（神版）'};
}
function insightBody(insight){
 return {action:'publish-insight',publishConsent:true,consentVersion:'v1',receiptId:ID2,
  entryId:'entry01',insight,journey,shareText:'我愿意在真实关系中彼此相爱'};
}
test('authenticated mine shows only own records, and server revocation works across accounts',()=>previewEnv(async()=>{
 const {sql,state}=fakeData();
 state.records.push({id:ID,owner_id:AUTHOR,kind:'insight',status:'PUBLISHED',
  entry_id:'entry01',voice:'NONE',scripture_reference:'约 13:34–35',
  public_text:'只供公开的领受',translation:''});
 const api=mockApi(sql,state);
 let response=await call(api,{url:'/api/pasture-commons?mode=mine&entry=entry01'});
 assert.equal(response.status,200);
 assert.equal(response.object.items.length,1);
 assert.equal(response.object.items[0].id,ID);
 assert.equal(JSON.stringify(response.object).includes('owner_id'),false);
 state.account=PEER;
 response=await call(api,{url:'/api/pasture-commons?mode=mine&entry=entry01'});
 assert.equal(response.status,200);assert.deepEqual(response.object.items,[]);
 response=await call(api,{method:'POST',body:{action:'withdraw',id:ID}});
 assert.equal(response.status,404);
 assert.equal(state.records[0].status,'PUBLISHED');
 state.account=AUTHOR;
 response=await call(api,{method:'POST',body:{action:'withdraw',id:ID}});
 assert.equal(response.status,200);assert.equal(response.object.withdrawn,true);
 assert.equal(state.records[0].status,'WITHDRAWN');
 response=await call(api,{url:'/api/pasture-commons?mode=mine&entry=entry01'});
 assert.equal(response.object.items[0].status,'WITHDRAWN');
 assert.equal(state.schemaStatements.some(q=>q.includes('UNIQUE INDEX')&&q.includes('owner_id,entry_id')),true);
}));
test('an authenticated user cannot publish an anonymous insight using another person’s recording receipt',()=>previewEnv(async()=>{
 const {sql,state}=fakeData(),insight=seedInsight(state,AUTHOR),api=mockApi(sql,state);
 state.account=PEER;
 const result=await call(api,{method:'POST',body:insightBody(insight)});
 assert.equal(result.status,403);assert.equal(result.object.reason,'recording_receipt_required');
 assert.equal(state.records.length,0);
}));
test('recording receipts are bound to the same resident, audio and entry',()=>previewEnv(async()=>{
 const {sql,state}=fakeData(),insight=seedInsight(state,AUTHOR),api=mockApi(sql,state);
 let response=await call(api,{method:'POST',body:{...insightBody(insight),entryId:'other'}});
 assert.equal(response.status,403);
 response=await call(api,{method:'POST',body:insightBody(insight)});
 assert.equal(response.status,200);
 assert.equal(response.object.status,'PUBLISHED');
 assert.equal(state.records.length,1);
}));
test('an already published or withdrawn entry cannot be republished under a different privacy type',()=>previewEnv(async()=>{
 const {sql,state}=fakeData(),insight=seedInsight(state,AUTHOR),api=mockApi(sql,state);
 let response=await call(api,{method:'POST',body:insightBody(insight)});
 assert.equal(response.status,200);
 response=await call(api,{method:'POST',body:insightBody(insight)});
 assert.equal(response.status,200);assert.equal(response.object.duplicate,true);
 response=await call(api,{method:'POST',body:{action:'withdraw',id:response.object.id}});
 assert.equal(response.status,200);
 response=await call(api,{method:'POST',body:insightBody(insight)});
 assert.equal(response.status,409);assert.equal(response.object.reason,'entry_publication_locked');
}));
test('foreign-origin POST is forbidden even with an otherwise valid authenticated session',()=>previewEnv(async()=>{
 const {sql,state}=fakeData(),api=mockApi(sql,state);
 const res=await call(api,{method:'POST',origin:'https://evil.example',body:{action:'withdraw',id:ID}});
 assert.equal(res.status,403);
 assert.equal(res.object.reason,'cross_origin_forbidden');
}));

test('timeline tampering after a recording receipt is issued cannot authorize a new anonymous statement',()=>previewEnv(async()=>{
 const {sql,state}=fakeData(),insight=seedInsight(state,AUTHOR),api=mockApi(sql,state);
 const changed={...journey,durationMs:24000,segments:[journey.segments[0],{verse:35,startMs:9000,endMs:24000}]};
 const response=await call(api,{method:'POST',body:{...insightBody(insight),journey:changed}});
 assert.equal(response.status,403);
 assert.equal(response.object.reason,'recording_receipt_required');
 assert.equal(state.records.length,0);
}));
