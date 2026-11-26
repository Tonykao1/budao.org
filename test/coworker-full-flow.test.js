"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

process.env.BUDAO_SESSION_SECRET = "isolated-coworker-integration-secret-thirty-two-characters";
process.env.DATABASE_URL = "postgres://mocked-private-test-only";
const { createSessionCookie } = require("../api/_security/auth");

const rows = [];
const limits = new Map();
const reviews = new Map(), reviewEvents = [];
let counter = 0;

function fakeSql(strings, ...values) {
  const q = strings.join("?").replace(/\s+/g," ").trim();
  if (/^(CREATE TABLE|CREATE INDEX)/i.test(q)) return [];
  if (/^INSERT INTO coworker_calling_limits /i.test(q)) {
    const key=values[0];
    const current=limits.get(key)||0;
    limits.set(key,current+1);
    return [{count:current+1}];
  }
  if (/^INSERT INTO coworker_calling_responses /i.test(q)) {
    const nonce=values[4];
    if(rows.some(r=>r.captcha_nonce===nonce)) return [];
    const record={
      id:"00000000-0000-0000-0000-"+String(++counter).padStart(12,"0"),
      country:values[0],province:values[1],city:values[2],
      display_name:values[3],captcha_nonce:nonce,status:"VISIBLE",
      created_at:new Date(Date.now()+counter*1000).toISOString()
    };
    rows.push(record);
    return [record];
  }
  if (/^WITH changed AS/i.test(q)) {
    const insert=q.includes("INSERT INTO coworker_identity_reviews");
    const state=values[0], operator=values[1], id=values[2];
    if (!rows.some(r=>r.id===id)) return [];
    if (insert ? reviews.has(id) : reviews.get(id)?.state!==values[3]) return [];
    reviews.set(id,{state,updated_at:new Date().toISOString()});
    reviewEvents.unshift({id:"event-"+(reviewEvents.length+1),response_id:id,state,operator_id:operator,created_at:new Date().toISOString(),display_name:rows.find(r=>r.id===id).display_name});
    return [{id:reviewEvents[0].id}];
  }
  if (/^SELECT /i.test(q)) {
    if(q.includes("FROM coworker_identity_review_events")) return reviewEvents.slice(0,250);
    if(q.includes("LEFT JOIN coworker_identity_reviews")) return rows.slice().reverse().slice(0,250).map(r=>({...r,review_state:reviews.get(r.id)?.state,reviewed_at:reviews.get(r.id)?.updated_at}));
    if (q.includes("WHERE status='VISIBLE'")) {
      return rows.filter(r=>r.status==="VISIBLE").slice().reverse().slice(0,80).map(r=>({
        id:r.id,country:r.country,province:r.province,city:r.city,
        display_name:r.display_name,created_at:r.created_at
      }));
    }
    return rows.slice().reverse().slice(0,250);
  }
  if (/^UPDATE coworker_calling_responses SET /i.test(q)) {
    const id=String(values.at(-1));
    const record=rows.find(r=>r.id===id);
    if(!record) return [];
    if(q.includes("country=")) {
      record.country=values[0];record.province=values[1];
      record.city=values[2];record.display_name=values[3];
    } else {
      record.status=values[0];
    }
    return [{id:record.id}];
  }
  throw new Error("Unexpected SQL in coworker test: "+q);
}

const original=Module._load;
Module._load=function(request,parent,isMain){
  if(request==="@neondatabase/serverless") return {neon:()=>fakeSql};
  return original.apply(this,arguments);
};
let handler;
try {handler=require("../api/_coworker/calling");}
finally {Module._load=original;}
let ipSequence=0;
async function invoke(method,url,body,extraHeaders={}) {
  const headers={
    host:"www.budao.org",
    origin:"https://www.budao.org",
    "content-type":"application/json",
    "x-forwarded-for":"test-ip-"+(++ipSequence),
    ...extraHeaders
  };
  const req={method,url,body,headers};
  const res={
    headers:{},statusCode:200,
    setHeader(key,value){this.headers[key.toLowerCase()]=value;return this;},
    status(value){this.statusCode=value;return this;},
    json(value){this.body=value;return this;}
  };
  await handler(req,res);
  return res;
}
const ENDPOINT="/api/eebee?service=coworker";
function responsePayload(challenge, country="中国", name="Sam") {
  const p=JSON.parse(Buffer.from(challenge.token.split(".")[0],"base64url"));
  return {action:"respond",country,province:"北京",city:"顺义",name,
    consent:true,website:"",
    captchaToken:challenge.token,captchaCode:handler._test.digitsFor(p.nonce)};
}
function session(username) {
  return createSessionCookie({id:"test-"+username,username,slot:"IMS"}).split(";")[0];
}

test("full declaration lifecycle: captcha, consent, insert, list, edit, withdraw, restore, no login", async () => {
  let out=await invoke("GET",ENDPOINT+"&view=public");
  assert.equal(out.statusCode,200);
  assert.deepEqual(out.body.items,[]);

  const captcha=await invoke("GET",ENDPOINT+"&view=captcha");
  assert.equal(captcha.statusCode,200);
  const payload=responsePayload(captcha.body.captcha);
  const notConsented=await invoke("POST",ENDPOINT,{...payload,consent:false});
  assert.equal(notConsented.statusCode,400);
  assert.equal(rows.length,0);

  const wrong=await invoke("POST",ENDPOINT,{...payload,captchaCode:"888888"});
  assert.equal(wrong.statusCode,400);
  assert.equal(wrong.body.reason,"invalid_captcha");
  assert.equal(rows.length,0);

  const created=await invoke("POST",ENDPOINT,payload);
  assert.equal(created.statusCode,201);
  assert.equal(created.body.item.name,"Sam");
  assert.equal(created.headers["set-cookie"],undefined);
  assert.equal(rows.length,1);

  const replay=await invoke("POST",ENDPOINT,payload);
  assert.equal(replay.statusCode,409);
  assert.equal(replay.body.reason,"captcha_used");
  assert.equal(rows.length,1);

  out=await invoke("GET",ENDPOINT+"&view=public");
  assert.equal(out.body.items.length,1);
  assert.equal(out.body.items[0].name,"Sam");

  const anotherCaptcha=await invoke("GET",ENDPOINT+"&view=captcha");
  const another=await invoke("POST",ENDPOINT,responsePayload(anotherCaptcha.body.captcha,"美国","Alex"));
  assert.equal(another.statusCode,201);
  out=await invoke("GET",ENDPOINT+"&view=public");
  assert.deepEqual(out.body.items.map(i=>i.name),["Alex","Sam"]);

  const forbidden=await invoke("POST",ENDPOINT,{action:"withdraw",id:created.body.item.id});
  assert.equal(forbidden.statusCode,401);
  const leaderSession=await invoke("POST",ENDPOINT,{action:"withdraw",id:created.body.item.id},{cookie:session("andre")});
  assert.equal(leaderSession.statusCode,401);
  const notVisibleAdmin=await invoke("GET",ENDPOINT+"&view=admin");
  assert.equal(notVisibleAdmin.statusCode,401);

  const cookie=session("tony");
  const adminList=await invoke("GET",ENDPOINT+"&view=admin",undefined,{cookie});
  assert.equal(adminList.statusCode,200);
  assert.equal(adminList.body.items.length,2);

  const modified=await invoke("POST",ENDPOINT,{action:"edit",id:created.body.item.id,
    country:"中国",province:"上海",city:"浦东",name:"Sam（更正）"},{cookie});
  assert.equal(modified.statusCode,200);
  out=await invoke("GET",ENDPOINT+"&view=public");
  assert.equal(out.body.items.find(i=>i.id===created.body.item.id).name,"Sam（更正）");

  const hidden=await invoke("POST",ENDPOINT,{action:"withdraw",id:created.body.item.id},{cookie});
  assert.equal(hidden.statusCode,200);
  out=await invoke("GET",ENDPOINT+"&view=public");
  assert.equal(out.body.items.some(i=>i.id===created.body.item.id),false);

  const restored=await invoke("POST",ENDPOINT,{action:"restore",id:created.body.item.id},{cookie});
  assert.equal(restored.statusCode,200);
  out=await invoke("GET",ENDPOINT+"&view=public");
  assert.equal(out.body.items.some(i=>i.id===created.body.item.id),true);
});

test("same-origin enforcement and rate limits protect public submissions", async () => {
  const captcha=await invoke("GET",ENDPOINT+"&view=captcha");
  const payload=responsePayload(captcha.body.captcha);
  const crossOrigin=await invoke("POST",ENDPOINT,payload,{origin:"https://evil.example"});
  assert.equal(crossOrigin.statusCode,403);
  const bad={...payload,consent:false};
  const fixed="shared-rate-limited-ip";
  for(let i=0;i<5;i++){
    const r=await invoke("POST",ENDPOINT,bad,{"x-forwarded-for":fixed});
    assert.equal(r.statusCode,400);
  }
  const sixth=await invoke("POST",ENDPOINT,bad,{"x-forwarded-for":fixed});
  assert.equal(sixth.statusCode,429);
});

test("steward identity approvals are separate from public visibility and account creation", async()=>{
 const c=await invoke("GET",ENDPOINT+"&view=captcha");
 const created=await invoke("POST",ENDPOINT,responsePayload(c.body.captcha,"中国","Review Test"));
 const id=created.body.item.id, cookie=session("tony"), leader=session("andre");
 const approve={action:"approve_identity",id,expectedState:"PENDING",confirmed:true};
 assert.equal((await invoke("POST",ENDPOINT,approve,{cookie:leader})).statusCode,401);
 assert.equal((await invoke("POST",ENDPOINT,approve,{cookie,origin:"https://evil.example"})).statusCode,403);
 assert.equal((await invoke("POST",ENDPOINT,{...approve,confirmed:false},{cookie})).statusCode,400);
 const accepted=await invoke("POST",ENDPOINT,approve,{cookie});
 assert.equal(accepted.statusCode,200);
 assert.equal(accepted.headers["set-cookie"],undefined);
 assert.equal((await invoke("POST",ENDPOINT,approve,{cookie})).statusCode,409);
 const listing=await invoke("GET",ENDPOINT+"&view=admin",undefined,{cookie});
 assert.equal(listing.body.items.find(x=>x.id===id).reviewState,"APPROVED");
 const publicList=await invoke("GET",ENDPOINT+"&view=public");
 assert.equal(publicList.body.items.find(x=>x.id===id).reviewState,undefined);
 assert.equal((await invoke("POST",ENDPOINT,{action:"withdraw",id},{cookie})).statusCode,200);
 const hidden=await invoke("GET",ENDPOINT+"&view=admin",undefined,{cookie});
 assert.equal(hidden.body.items.find(x=>x.id===id).reviewState,"APPROVED");
 assert.equal((await invoke("POST",ENDPOINT,{action:"revoke_identity",id,expectedState:"APPROVED"},{cookie})).statusCode,200);
 assert.equal((await invoke("GET",ENDPOINT+"&view=review-history",undefined,{cookie:leader})).statusCode,401);
 const history=await invoke("GET",ENDPOINT+"&view=review-history",undefined,{cookie});
 assert.deepEqual(history.body.items.filter(x=>x.response_id===id).map(x=>x.state),["REVOKED","APPROVED"]);
});
