"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const Module = require("node:module");
const archive = require("../data/campfire-archive.json");
const photoId = archive.albums.find(a=>a.published && a.photos.some(p=>p.approved))
  .photos.find(p=>p.approved).src;
const secret = "only-for-automated-tests--not-a-real-production-secret-2026";
process.env.BUDAO_SESSION_SECRET = secret;
process.env.CAMPFIRE_GUEST_WRITES_ENABLED = "true";

const store = { comments:new Map(), reactions:new Set(), quotas:new Map(), audits:[], reports:[] };
const get = id => store.comments.get(id);
async function fakeQuery(statement,params=[]) {
  if (statement.startsWith("INSERT INTO campfire_write_limits")) {
    const [scope,key,start,max] = params;
    const id=[scope,key,start].join(":");
    const n=(store.quotas.get(id)||0)+1;
    if(n>max)return [];
    store.quotas.set(id,n);
    return [{request_count:n}];
  }
  if (statement.startsWith("DELETE FROM campfire_write_limits")) return [];
  if (statement.startsWith("INSERT INTO campfire_reactions")) {
    const key=params.slice(0,3).join(":");
    if(store.reactions.has(key)) return [];
    store.reactions.add(key);return [{id:crypto.randomUUID()}];
  }
  if (statement.startsWith("SELECT target_kind||")) {
    return [...store.reactions].filter(key=>key.startsWith(params[0]+":"))
      .map(key=>({key:key.slice(params[0].length+1)}));
  }
  if (statement.startsWith("INSERT INTO campfire_comments")) {
    const [src,album,parent,visitor,name,body,status,official,consentVersion]=params;
    const id=crypto.randomUUID();
    store.comments.set(id,{id,photoId:src,albumId:album,parentId:parent,visitorHash:visitor,
      name,body,status,official,consentVersion,createdAt:new Date().toISOString()});
    return [{id}];
  }
  if (statement.startsWith("SELECT id, parent_id AS")) {
    return [...store.comments.values()].filter(c=>c.photoId===params[0]&&c.status==="APPROVED")
      .map(c=>({id:c.id,parentId:c.parentId,name:c.name,body:c.body,official:c.official,
        createdAt:c.createdAt,mine:!!c.visitorHash&&c.visitorHash===params[1]}));
  }
  if (statement.startsWith("SELECT id,parent_id FROM")) {
    const c=get(params[0]);
    return c&&c.photoId===params[1]&&c.status==="APPROVED"?[{id:c.id,parent_id:c.parentId}]:[];
  }
  if (statement.startsWith("SELECT id,status FROM campfire_comments")) {
    const c=get(params[0]);return c?[{id:c.id,status:c.status}]:[];
  }
  if (statement.startsWith("SELECT id FROM campfire_comments")) {
    const c=get(params[0]);return c&&c.status==="APPROVED"&&(!params[1]||c.photoId===params[1])
      ?[{id:c.id}]:[];
  }
  if (statement.startsWith("UPDATE campfire_comments SET status='DELETED'")) {
    const c=get(params[0]);
    if(!c)return [];
    if(statement.includes("visitor_hash=$2")&&c.visitorHash!==params[1])return [];
    c.status="DELETED";c.body="此评论已由作者撤回";c.name="同行者";c.visitorHash=null;
    return [{id:c.id}];
  }
  if (statement.startsWith("UPDATE campfire_comments SET status=$2")) {
    const c=get(params[0]);if(c)c.status=params[1];return [];
  }
  if (statement.startsWith("INSERT INTO campfire_moderation_audit")) {
    store.audits.push(params);return [];
  }
  if (statement.startsWith("UPDATE campfire_reports"))return [];
  if (statement.startsWith("SELECT id,photo_id AS")&&statement.includes("WHERE status IN")) {
    return [...store.comments.values()].filter(c=>["PENDING","HIDDEN"].includes(c.status));
  }
  if (statement.startsWith("SELECT r.id,r.comment_id AS"))return [];
  if (statement.startsWith("SELECT id,photo_id AS")&&statement.includes("WHERE album_id")) {
    return [...store.comments.values()].filter(c=>c.albumId===params[0]&&c.status==="APPROVED");
  }
  if (statement.startsWith("INSERT INTO campfire_reports"))return [];
  throw new Error("unmocked database query: "+statement.slice(0,95));
}
// Stub only external persistence, leaving the real handler validation, HMAC,
// same-origin protection and allowed status transitions intact.
const prior = Module._load;
Module._load = function(request,parent,isMain) {
  if(request==="@neondatabase/serverless")return {neon:()=>fakeQuery};
  if(request==="../../db/client")return {getDatabaseUrl:()=>"postgres://test.invalid/db"};
  if(request==="./auth")return {
    getAuthenticatedPublisher:req=>req.isAdmin?{id:"test-steward",username:"tony",role:"publisher"}:null,
    isSteward:u=>Boolean(u)
  };
  return prior.apply(this,arguments);
};
let handler;
try { handler=require("../api/_security/campfire-handler"); }
finally { Module._load=prior; }

async function call(method,path,data=null,cookie="",isAdmin=false) {
  const headers={"host":"budao.org","origin":"https://budao.org",
    "x-forwarded-for":isAdmin?"198.51.100.66":"203.0.113.60",
    "content-type":"application/json"};
  if(cookie)headers.cookie=cookie;
  const req={method,url:path,body:data,headers,isAdmin};
  const res={
    code:200,headers:{},payload:null,
    setHeader(name,value){this.headers[name.toLowerCase()]=value;},
    status(code){this.code=code;return this;},
    json(payload){this.payload=payload;return this;}
  };
  await handler(req,res);
  return res;
}
const api="/api/campfire";
const cookieFrom=(response)=>String(response.headers["set-cookie"]||"").split(";")[0];

test("no-account sparks are idempotent and store no public counts",async()=>{
  const first=await call("POST",api,{action:"react",kind:"photo",photoId});
  assert.equal(first.code,200);
  assert.equal(first.payload.fresh,true);
  assert.equal(first.payload.reacted,true);
  assert.ok(!("count" in first.payload));
  assert.match(first.headers["set-cookie"],/HttpOnly/);
  assert.match(first.headers["set-cookie"],/SameSite=Lax/);
  const second=await call("POST",api,{action:"react",kind:"photo",photoId},cookieFrom(first));
  assert.equal(second.code,200);
  assert.equal(second.payload.fresh,false);
  assert.ok(!("count" in second.payload));
});

test("unregistered visitor submits pending replies; steward publishes and visitor can withdraw",async()=>{
  const noConsent=await call("POST",api,{action:"comment",photoId,body:"感谢同行"});
  assert.equal(noConsent.code,400);
  assert.equal(noConsent.payload.reason,"consent_required");

  const bot=await call("POST",api,{action:"comment",photoId,body:"垃圾广告",company_website:"a",consent:true});
  assert.equal(bot.code,400);
  assert.equal(bot.payload.reason,"invalid_request");

  const posted=await call("POST",api,{action:"comment",photoId,name:"山间旅人",body:"山路上的分享仍然温暖。",consent:true});
  assert.equal(posted.code,201);
  assert.equal(posted.payload.status,"PENDING");
  const cookie=cookieFrom(posted);
  const commentId=posted.payload.id;
  assert.match(commentId,/^[a-f0-9-]{36}$/);
  const before=await call("GET",api+"?view=thread&photoId="+encodeURIComponent(photoId));
  assert.equal(before.code,200);
  assert.deepEqual(before.payload.comments,[]);
  assert.equal(before.payload.guestWritesEnabled,true);

  const guestModeration=await call("POST",api,{action:"moderate",commentId,status:"APPROVED"},cookie);
  assert.equal(guestModeration.code,403);

  const approved=await call("POST",api,{action:"moderate",commentId,status:"APPROVED"},"",true);
  assert.equal(approved.code,200);
  const visible=await call("GET",api+"?view=thread&photoId="+encodeURIComponent(photoId),null,cookie);
  assert.equal(visible.payload.comments.length,1);
  assert.equal(visible.payload.comments[0].mine,true);
  assert.equal(visible.payload.comments[0].name,"山间旅人");

  const reply=await call("POST",api,{action:"comment",photoId,parentId:commentId,
    name:"另一个旅人",body:"期待我们再次同行！",consent:true},"");
  assert.equal(reply.code,201);
  assert.equal(reply.payload.status,"PENDING");
  const official=await call("POST",api,{action:"comment",photoId,parentId:commentId,
    body:"感谢你留下的宝贵记忆。"},"",true);
  assert.equal(official.code,201);
  assert.equal(official.payload.status,"APPROVED");
  const now=await call("GET",api+"?view=thread&photoId="+encodeURIComponent(photoId));
  assert.equal(now.payload.comments.length,2);
  assert.equal(now.payload.comments[1].official,true);
  assert.equal(now.payload.comments[1].parentId,commentId);

  const withdrawn=await call("POST",api,{action:"withdraw",commentId},cookie);
  assert.equal(withdrawn.code,200);
  assert.equal(withdrawn.payload.withdrawn,true);
  assert.equal(get(commentId).status,"DELETED");
  assert.equal(get(commentId).visitorHash,null);
  const after=await call("GET",api+"?view=thread&photoId="+encodeURIComponent(photoId));
  assert.ok(!after.payload.comments.some(c=>c.id===commentId));
});
