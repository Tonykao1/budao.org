"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const phase2=require("../api/_security/campfire-phase2");
process.env.BUDAO_SESSION_SECRET="only-for-phase2-unit-tests-very-long-secret-2026";
process.env.CAMPFIRE_GUEST_WRITES_ENABLED="true";
process.env.CAMPFIRE_PHASE2_ENABLED="true";
const H=s=>crypto.createHash("sha256").update(s).digest("hex");
const anna=H("anna"),ben=H("ben"),eve=H("eve");
const album="261031",photo="/campfire-photos/261031/261031-01.jpg";
const idA=crypto.randomUUID(),idB=crypto.randomUUID(),idE=crypto.randomUUID();
const approval=[
 {id:idA,visitor_hash:anna,album_id:album,photo_id:photo,status:"APPROVED",name:"小山"},
 {id:idB,visitor_hash:ben,album_id:album,photo_id:photo,status:"APPROVED",name:"小河"}
];
const store={comments:approval,connections:[],letters:[],notices:[],quota:new Map()};
function rowsFor(sql,args) {
  if(sql.startsWith("INSERT INTO campfire_write_limits")){
    const [scope,key,bucket,max]=args;const k=[scope,key,bucket].join(":");
    const count=(store.quota.get(k)||0)+1;if(count>max)return [];
    store.quota.set(k,count);return [{request_count:count}];
  }
  if(sql.startsWith("DELETE FROM campfire_write_limits"))return [];
  if(sql.startsWith("INSERT INTO campfire_notifications")){
    const [recipient,id]=args;
    if(!store.notices.some(n=>n.recipient_hash===recipient&&n.comment_id===id))
      store.notices.push({id:crypto.randomUUID(),recipient_hash:recipient,comment_id:id,read_at:null});
    return [];
  }
  if(sql.startsWith('SELECT n.id,n.comment_id')){
    return store.notices.filter(n=>n.recipient_hash===args[0]).flatMap(n=>{
      const c=store.comments.find(c=>c.id===n.comment_id);
      if(!c||c.status!=="APPROVED")return [];
      return [{id:n.id,commentId:c.id,photoId:c.photo_id,name:c.name,body:"谢谢你愿意同行。",
        official:false,createdAt:new Date().toISOString(),readAt:n.read_at}];
    });
  }
  if(sql.startsWith('SELECT id,photo_id AS "photoId",album_id AS "albumId"')){
    return store.connections.filter(c=>c.sender_hash===args[0]||c.recipient_hash===args[0])
      .map(c=>({id:c.id,photoId:c.photo_id,albumId:c.album_id,intro:c.intro,
        status:c.status,createdAt:c.requested_at,expiresAt:c.expires_at,
        sentByMe:c.sender_hash===args[0],receivedByMe:c.recipient_hash===args[0]}));
  }
  if(sql.startsWith("SELECT id,visitor_hash,photo_id,album_id")){
    const x=store.comments.find(c=>c.id===args[0]&&c.status==="APPROVED"&&c.visitor_hash);
    return x?[x]:[];
  }
  if(sql.startsWith("SELECT id FROM campfire_comments")){
    const c=store.comments.find(c=>c.album_id===args[0]&&c.visitor_hash===args[1]&&c.status==="APPROVED");
    return c?[{id:c.id}]:[];
  }
  if(sql.startsWith("SELECT id FROM campfire_connections")){
    return store.connections.filter(c=>c.sender_hash===args[0]&&c.recipient_hash===args[1]&&c.album_id===args[2]&&["PENDING","ACCEPTED"].includes(c.status));
  }
  if(sql.startsWith("INSERT INTO campfire_connections")){
    const [sender,recipient,source,albumId,src,intro]=args;
    if(store.connections.some(c=>c.sender_hash===sender&&c.recipient_hash===recipient&&c.album_id===albumId))return [];
    const id=crypto.randomUUID();
    store.connections.push({id,sender_hash:sender,recipient_hash:recipient,
      source_comment_id:source,album_id:albumId,photo_id:src,intro,status:"PENDING",
      requested_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString()});
    return [{id}];
  }
  if(sql.startsWith("UPDATE campfire_connections SET status=$3")){
    const c=store.connections.find(c=>c.id===args[0]&&c.recipient_hash===args[1]&&c.status==="PENDING");
    if(!c)return [];
    c.status=args[2];c.expires_at=new Date(Date.now()+(c.status==="ACCEPTED"?900000000:0)).toISOString();
    return [{id:c.id}];
  }
  if(sql.startsWith('SELECT id,photo_id AS "photoId",intro,status')){
    const c=store.connections.find(c=>c.id===args[0]&&(c.sender_hash===args[1]||c.recipient_hash===args[1]));
    return c?[{id:c.id,photoId:c.photo_id,intro:c.intro,status:c.status,expiresAt:c.expires_at}]:[];
  }
  if(sql.startsWith("INSERT INTO campfire_letters")){
    const id=crypto.randomUUID();store.letters.push({id,connection_id:args[0],sender_hash:args[1],
      body:args[2],created_at:new Date().toISOString()});return [{id}];
  }
  if(sql.startsWith('SELECT id,sender_hash=$2 AS mine')){
    return store.letters.filter(l=>l.connection_id===args[0]).map(l=>({id:l.id,
      mine:l.sender_hash===args[1],body:l.body,createdAt:l.created_at}));
  }
  if(sql.startsWith("UPDATE campfire_connections SET status='REVOKED'")){
    const c=store.connections.find(c=>c.id===args[0]&&(c.sender_hash===args[1]||c.recipient_hash===args[1])&&
      ["PENDING","ACCEPTED"].includes(c.status));
    if(!c)return [];
    c.status="REVOKED";c.intro="已由参与者结束";return [{id:c.id}];
  }
  if(sql.startsWith("DELETE FROM campfire_letters")){
    store.letters=store.letters.filter(l=>l.connection_id!==args[0]);return [];
  }
  if(sql.startsWith("UPDATE campfire_notifications SET read_at")){
    const n=store.notices.find(n=>n.id===args[0]&&n.recipient_hash===args[1]&&!n.read_at);
    if(!n)return [];n.read_at=new Date().toISOString();return [{id:n.id}];
  }
  throw new Error("unmocked SQL: "+sql.slice(0,100));
}
const ctx={
  query:async(sql,args=[])=>rowsFor(sql,args),
  guestHash:req=>req.visitor||null,
  validPhoto:s=>s===photo,
  photos:new Map([[photo,album]]),
  sendJson:(res,status,body)=>res.status(status).json(body),
  guestWritesEnabled:()=>true
};
function response(){
  return {statusCode:null,payload:null,
    status(n){this.statusCode=n;return this},
    json(body){this.payload=body;return this}
  };
}
async function post(visitor,action,payload,ip="203.0.113.33"){
  const res=response();await phase2.handlePost({visitor,headers:{"x-forwarded-for":ip}},res,{action,...payload},ctx);
  return res;
}
async function get(visitor,view,id){
  const res=response();await phase2.handleGet({visitor},res,view,
    new URL("https://budao.org/api/campfire?view="+view+(id?"&id="+id:"")),ctx);
  return res;
}

test("two-sided consent is enforced; no anonymous identity inference or public invitations",async()=>{
  const empty=await get(null,"inbox");
  assert.equal(empty.statusCode,200);assert.equal(empty.payload.hasSession,false);
  const stranger=await post(eve,"invite",{commentId:idB,body:"希望下一次仍然有机会同行。",consent:true});
  assert.equal(stranger.statusCode,403);
  assert.equal(stranger.payload.reason,"own_approved_memory_required");
  const self=await post(anna,"invite",{commentId:idA,body:"希望能够再次同行。",consent:true});
  assert.equal(self.statusCode,400);
  const bad=await post(anna,"invite",{commentId:idB,body:"联系我的 email@example.com 我们同行",consent:true});
  assert.equal(bad.statusCode,400);
  const invited=await post(anna,"invite",{commentId:idB,body:"非常感谢你留下的故事，希望有一天还能再次同行。",consent:true});
  assert.equal(invited.statusCode,201);assert.equal(invited.payload.status,"PENDING");
  const id=invited.payload.id;
  const duplicate=await post(anna,"invite",{commentId:idB,body:"非常感谢你留下的故事，希望有一天还能再次同行。",consent:true});
  assert.equal(duplicate.statusCode,409);
  const wrong=await post(eve,"respond",{connectionId:id,choice:"ACCEPTED"});
  assert.equal(wrong.statusCode,404);
  const before=await post(anna,"letter",{connectionId:id,body:"我们再聊聊步道吧！"});
  assert.equal(before.statusCode,404);
  const found=await get(ben,"inbox");
  assert.equal(found.payload.connections.length,1);
  assert.equal(found.payload.connections[0].receivedByMe,true);
  const outsider=await get(eve,"inbox");
  assert.equal(outsider.payload.connections.length,0);
  const accepted=await post(ben,"respond",{connectionId:id,choice:"ACCEPTED"});
  assert.equal(accepted.statusCode,200);
  const sent=await post(anna,"letter",{connectionId:id,body:"谢谢愿意同行，我们可以从下一次步道日历开始。"});
  assert.equal(sent.statusCode,201);
  const privateLetters=await get(ben,"letters",id);
  assert.equal(privateLetters.statusCode,200);
  assert.equal(privateLetters.payload.letters.length,1);
  assert.equal(privateLetters.payload.letters[0].mine,false);
  assert.equal((await get(eve,"letters",id)).statusCode,404);
  const closed=await post(ben,"closeConnection",{connectionId:id});
  assert.equal(closed.statusCode,200);assert.equal(store.letters.length,0);
  assert.equal((await get(anna,"letters",id)).statusCode,404);
});
test("reply notice becomes visible only after approval, then can be marked read by recipient",async()=>{
  const replyId=crypto.randomUUID();
  store.comments.push({id:replyId,visitor_hash:ben,photo_id:photo,album_id:album,
    status:"PENDING",name:"小河"});
  await phase2.notifyReply(ctx.query,anna,replyId,ben);
  let pending=await get(anna,"inbox");
  assert.equal(pending.payload.notices.length,0);
  store.comments.find(c=>c.id===replyId).status="APPROVED";
  const inbox=await get(anna,"inbox");
  assert.equal(inbox.payload.notices.length,1);
  assert.equal(inbox.payload.notices[0].read,false);
  assert.equal((await post(eve,"readNotice",{noticeId:inbox.payload.notices[0].id})).payload.read,false);
  assert.equal((await post(anna,"readNotice",{noticeId:inbox.payload.notices[0].id})).payload.read,true);
  assert.equal((await get(anna,"inbox")).payload.notices[0].read,true);
});
