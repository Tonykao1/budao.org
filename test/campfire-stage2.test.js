"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {make,safeText,unsafe}=require("../api/_security/campfire-stage2");
const HASH_A="a".repeat(64),HASH_B="b".repeat(64),HASH_C="c".repeat(64);
const ID_A="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INVITE="11111111-1111-4111-8111-111111111111";
const MESSAGE="22222222-2222-4222-8222-222222222222";
const PHOTO="/campfire-photos/261031/261031-01.jpg";
process.env.BUDAO_SESSION_SECRET="stage-two-test-secret-over-32-chars-not-real";
function response(){
  return {code:200,body:null,headers:{},
    setHeader(k,v){this.headers[k]=v;return this;},
    status(status){this.code=status;return this;},
    json(data){this.body=data;return this;}
  };
}
function req(visitor,headers={}){
  return {visitor,headers:{"x-forwarded-for":"203.0.113.81",...headers}};
}
function fixture() {
  const invitations=new Map(),messages=new Map(),read=new Map(),quotas=new Map();
  const users={
    [ID_A]:{id:ID_A,visitorHash:HASH_A,name:"远山",photoId:PHOTO,status:"APPROVED"},
    [ID_B]:{id:ID_B,visitorHash:HASH_B,name:"林间",photoId:PHOTO,status:"APPROVED"}
  };
  async function query(q,p=[]){
    if(q.startsWith("INSERT INTO campfire_write_limits")){
      const k=p.slice(0,3).join(":");
      const count=(quotas.get(k)||0)+1;
      if(count>p[3])return [];
      quotas.set(k,count);return [{request_count:count}];
    }
    if(q.startsWith("DELETE FROM campfire_write_limits"))return [];
    if(q.startsWith("SELECT id,visitor_hash AS")){
      const c=users[p[0]];
      return c&&c.photoId===p[1]?[{id:c.id,visitorHash:c.visitorHash,name:c.name}]:[];
    }
    if(q.startsWith("SELECT display_name AS name")){
      return Object.values(users).filter(c=>c.photoId===p[0]&&c.visitorHash===p[1])
        .map(c=>({name:c.name})).slice(0,1);
    }
    if(q.startsWith("INSERT INTO campfire_peer_invites")){
      const duplicate=[...invitations.values()].some(i=>i.senderHash===p[1]&&i.targetCommentId===p[5]);
      if(duplicate)return [];
      invitations.set(INVITE,{id:INVITE,photoId:p[0],senderHash:p[1],recipientHash:p[2],
        senderName:p[3],recipientName:p[4],targetCommentId:p[5],note:p[6],
        status:"PENDING",senderWantsWalk:false,recipientWantsWalk:false});
      return [{id:INVITE}];
    }
    if(q.startsWith("SELECT r.id,r.photo_id AS"))return [];
    if(q.startsWith("SELECT id,photo_id AS")&&q.includes("FROM campfire_peer_invites")){
      return [...invitations.values()].filter(i=>i.senderHash===p[0]||i.recipientHash===p[0])
        .map(i=>({id:i.id,photoId:i.photoId,senderName:i.senderName,
          recipientName:i.recipientName,note:i.note,status:i.status,
          createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
          respondedAt:null,lastOtherMessageAt:null,senderWantsWalk:i.senderWantsWalk,
          recipientWantsWalk:i.recipientWantsWalk,mine:i.senderHash===p[0]}));
    }
    if(q.startsWith("SELECT last_read_at"))return read.has(p[0])?[{lastReadAt:read.get(p[0])}]:[];
    if(q.startsWith("INSERT INTO campfire_inbox_state")){read.set(p[0],new Date().toISOString());return [];}
    if(q.startsWith("UPDATE campfire_peer_invites SET status=$3")){
      const i=invitations.get(p[0]);if(!i)return [];
      if(q.includes("recipient_hash=$2 AND status='PENDING'")){
        if(i.recipientHash!==p[1]||i.status!=="PENDING")return [];
      }else if(!(i.senderHash===p[1]||i.recipientHash===p[1])||
        !["PENDING","ACCEPTED"].includes(i.status))return [];
      i.status=p[2];return [{id:i.id}];
    }
    if(q.startsWith("SELECT id FROM campfire_peer_invites")){
      const i=invitations.get(p[0]);return i&&i.status==="ACCEPTED"&&
        (i.senderHash===p[1]||i.recipientHash===p[1])?[{id:i.id}]:[];
    }
    if(q.startsWith("INSERT INTO campfire_private_messages")){
      const i=invitations.get(p[0]);
      if(!i||i.status!=="ACCEPTED"||!(i.senderHash===p[1]||i.recipientHash===p[1]))return [];
      messages.set(MESSAGE,{id:MESSAGE,inviteId:i.id,senderHash:p[1],body:p[2],status:"ACTIVE"});
      return [{id:MESSAGE}];
    }
    if(q.startsWith("UPDATE campfire_peer_invites SET updated_at"))return [];
    if(q.startsWith("SELECT id,status,sender_name")){
      const i=invitations.get(p[0]);
      return i&&(i.senderHash===p[1]||i.recipientHash===p[1])?
        [{id:i.id,status:i.status,senderName:i.senderName,recipientName:i.recipientName,
          senderWantsWalk:i.senderWantsWalk,recipientWantsWalk:i.recipientWantsWalk,
          mine:i.senderHash===p[1]}]:[];
    }
    if(q.startsWith("SELECT id,body,status")){
      return [...messages.values()].filter(m=>m.inviteId===p[0])
        .map(m=>({...m,mine:m.senderHash===p[1],createdAt:new Date().toISOString()}));
    }
    if(q.startsWith("UPDATE campfire_peer_invites SET sender_wants_walk")){
      const i=invitations.get(p[0]);
      if(!i||i.status!=="ACCEPTED"||!(i.senderHash===p[1]||i.recipientHash===p[1]))return [];
      if(i.senderHash===p[1])i.senderWantsWalk=p[2];
      else i.recipientWantsWalk=p[2];
      return [{senderWantsWalk:i.senderWantsWalk,recipientWantsWalk:i.recipientWantsWalk}];
    }
    if(q.startsWith("UPDATE campfire_private_messages SET status='REDACTED'")){
      const m=messages.get(p[0]);
      if(!m||m.inviteId!==p[1]||m.senderHash!==p[2]||m.status!=="ACTIVE")return [];
      m.status="REDACTED";m.body="此内容已由作者撤回";return [{id:m.id}];
    }
    if(q.startsWith("SELECT m.id FROM campfire_private_messages")){
      const m=messages.get(p[0]),i=invitations.get(p[1]);
      return m&&i&&m.inviteId===p[1]&&m.senderHash!==p[2]&&
        (i.senderHash===p[2]||i.recipientHash===p[2])&&m.status==="ACTIVE"?[{id:m.id}]:[];
    }
    if(q.startsWith("INSERT INTO campfire_private_reports"))return [];
    if(q.startsWith("UPDATE campfire_peer_invites SET status='BLOCKED'")){
      const i=invitations.get(p[0]);if(i&&i.status==="ACCEPTED")i.status="BLOCKED";return [];
    }
    if(q.startsWith("SELECT r.id,r.message_id AS"))return [];
    throw new Error("Unexpected SQL "+q.slice(0,120));
  }
  const api=make({query,guestHash:r=>r.visitor,validPhoto:p=>p===PHOTO,
    photos:new Map([[PHOTO,"261031"]]),guestWritesEnabled:()=>true,
    adminFor:r=>r.admin?{id:"steward"}:null});
  return {api,invitations,messages,query};
}
test("stage two refuses unverified, self, unrelated and unsolicited invitations",async()=>{
  const {api}=fixture();let r=response();
  await api.invite(req(null),r,{photoId:PHOTO,targetCommentId:ID_B,consent:true});
  assert.equal(r.code,403);
  r=response();
  await api.invite(req(HASH_A),r,{photoId:PHOTO,targetCommentId:ID_A,consent:true});
  assert.equal(r.code,400);
  r=response();
  await api.invite(req(HASH_C),r,{photoId:PHOTO,targetCommentId:ID_B,consent:true});
  assert.equal(r.code,403);
  r=response();
  await api.invite(req(HASH_A),r,{photoId:PHOTO,targetCommentId:ID_B,consent:false});
  assert.equal(r.code,400);
  r=response();
  await api.invite(req(HASH_A),r,{photoId:PHOTO,targetCommentId:ID_B,note:"email me@example.com",consent:true});
  assert.equal(r.code,400);
});
test("only recipient can accept; only mutually accepted peers can write",async()=>{
  const {api}=fixture();let r=response();
  await api.invite(req(HASH_A),r,{photoId:PHOTO,targetCommentId:ID_B,note:"想再次同行",consent:true});
  assert.equal(r.code,201);assert.equal(r.body.status,"PENDING");
  r=response();await api.invite(req(HASH_A),r,{photoId:PHOTO,targetCommentId:ID_B,consent:true});
  assert.equal(r.code,409);
  r=response();await api.privateMessage(req(HASH_A),r,{inviteId:INVITE,body:"你好，同行者"});
  assert.equal(r.code,404);
  r=response();await api.invitation(req(HASH_A),r,{inviteId:INVITE},"accept");
  assert.equal(r.code,404);
  r=response();await api.invitation(req(HASH_B),r,{inviteId:INVITE},"accept");
  assert.equal(r.code,200);assert.equal(r.body.status,"ACCEPTED");
  r=response();await api.privateMessage(req(HASH_C),r,{inviteId:INVITE,body:"冒名消息"});
  assert.equal(r.code,404);
  r=response();await api.privateMessage(req(HASH_A),r,{inviteId:INVITE,body:"感谢你上次的分享"});
  assert.equal(r.code,201);
  r=response();await api.conversation(req(HASH_C),r,INVITE);
  assert.equal(r.code,404);
  r=response();await api.conversation(req(HASH_B),r,INVITE);
  assert.equal(r.code,200);assert.equal(r.body.messages.length,1);
  assert.equal(r.body.messages[0].mine,false);
  r=response();await api.withdrawPrivate(req(HASH_B),r,{inviteId:INVITE,messageId:MESSAGE});
  assert.equal(r.code,404);
  r=response();await api.withdrawPrivate(req(HASH_A),r,{inviteId:INVITE,messageId:MESSAGE});
  assert.equal(r.code,200);
});
test("both must independently declare intent before mutual next-walk state",async()=>{
  const {api}=fixture();let r=response();
  await api.invite(req(HASH_A),r,{photoId:PHOTO,targetCommentId:ID_B,consent:true});
  r=response();await api.invitation(req(HASH_B),r,{inviteId:INVITE},"accept");
  r=response();await api.toggleWalk(req(HASH_A),r,{inviteId:INVITE,interested:true});
  assert.equal(r.body.mutual,false);
  r=response();await api.toggleWalk(req(HASH_B),r,{inviteId:INVITE,interested:true});
  assert.equal(r.body.mutual,true);
  r=response();await api.invitation(req(HASH_B),r,{inviteId:INVITE},"block");
  assert.equal(r.code,200);
  r=response();await api.privateMessage(req(HASH_A),r,{inviteId:INVITE,body:"你还能收到吗？"});
  assert.equal(r.code,404);
});
test("inbox is scoped to same-browser pseudonym; moderation is protected",async()=>{
  const {api}=fixture();let r=response();
  await api.inbox(req(null),r);assert.equal(r.code,200);assert.equal(r.body.hasIdentity,false);
  r=response();await api.privateReports(req(HASH_A),r);assert.equal(r.code,403);
  r=response();await api.inbox(req(HASH_A),r);assert.equal(r.code,200);assert.equal(r.body.hasIdentity,true);
  r=response();await api.markRead(req(HASH_A),r);assert.equal(r.code,200);
});
test("sanitization rejects outside contact details and oversized messages",()=>{
  assert.equal(safeText(" a\nb ",300),"ab");
  assert.equal(safeText("x".repeat(301),300),"");
  assert.equal(unsafe("https://spam.example"),true);
  assert.equal(unsafe("visitor@example.org"),true);
  assert.equal(unsafe("下次见"),false);
});
