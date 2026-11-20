"use strict";
/*
 * BUDAO · Sparks to Steps / Phase 2.
 * A no-account inbox, reply notices, bilateral invitations, private letters.
 *
 * A hidden visitor HMAC is only a device-local pseudonym. No public profiles,
 * identity inference, GPS, direct contacts, automatic friendships or mailers.
 * Every private request verifies both server-side identities and current state.
 */
const { consumeGuestQuota } = require("./campfire-guest-quota");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTACT = /(?:https?:\/\/|www\.|(?:[\w.+-]+)@(?:[\w.-]+)\.[a-z]{2,})/i;

function clean(raw, limit) {
  if (typeof raw !== "string") return "";
  const s=raw.trim().replace(/\r\n?/g,"\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"");
  return s.length <= limit ? s : "";
}
function isUuid(value) { return typeof value==="string" && UUID.test(value); }
function error(res,status,reason) { return res.status(status).json({ok:false,reason}); }
function active(ctx) { return ctx.guestWritesEnabled() && process.env.CAMPFIRE_PHASE2_ENABLED==="true"; }
function visitorFor(req,res,ctx) { return ctx.guestHash(req,res,false); }
async function quota(ctx,req,visitor,scope) {
  return consumeGuestQuota(ctx.query,req,visitor,scope);
}
async function notifyReply(query, recipient, commentId, sender) {
  if (!recipient || recipient===sender || !isUuid(commentId)) return;
  try {
    await query(
      "INSERT INTO campfire_notifications(recipient_hash,comment_id,kind) "+
      "VALUES($1,$2::uuid,'REPLY') ON CONFLICT(recipient_hash,kind,comment_id) DO NOTHING",
      [recipient,commentId]);
  } catch (err) {
    // The public comment has already been committed; a notification failure
    // must not cause the client to retry and create a duplicate comment.
    console.error("Campfire reply notice:",err.code || err.name || "unknown");
  }
}
async function inbox(req,res,ctx) {
  if (!active(ctx)) return ctx.sendJson(res,200,{ok:true,enabled:false,hasSession:false,notices:[],connections:[]});
  const visitor=visitorFor(req,res,ctx);
  if (!visitor) return ctx.sendJson(res,200,{ok:true,enabled:true,hasSession:false,notices:[],connections:[]});
  const notices=await ctx.query(
    'SELECT n.id,n.comment_id AS "commentId",c.photo_id AS "photoId",'+
    'c.display_name AS name,c.body,c.official,c.created_at AS "createdAt",'+
    'n.read_at AS "readAt" '+
    "FROM campfire_notifications n JOIN campfire_comments c ON c.id=n.comment_id "+
    "WHERE n.recipient_hash=$1 AND c.status='APPROVED' "+
    "ORDER BY n.created_at DESC LIMIT 80",[visitor]);
  const connections=await ctx.query(
    'SELECT id,photo_id AS "photoId",album_id AS "albumId",intro,status,'+
    'requested_at AS "createdAt",expires_at AS "expiresAt",'+
    'sender_hash=$1 AS "sentByMe",recipient_hash=$1 AS "receivedByMe" '+
    "FROM campfire_connections WHERE sender_hash=$1 OR recipient_hash=$1 "+
    "ORDER BY requested_at DESC LIMIT 70",[visitor]);
  // Only currently approved public photos are ever linked in the inbox.
  return ctx.sendJson(res,200,{ok:true,enabled:true,hasSession:true,
    notices:notices.filter(n=>ctx.validPhoto(n.photoId)).map(n=>({
      id:n.id,commentId:n.commentId,photoId:n.photoId,name:n.name,
      excerpt:String(n.body||"").slice(0,130),official:!!n.official,
      createdAt:n.createdAt,read:!!n.readAt
    })),
    connections:connections.filter(c=>ctx.validPhoto(c.photoId)).map(c=>({
      id:c.id,photoId:c.photoId,albumId:c.albumId,intro:c.intro,
      status:new Date(c.expiresAt)<new Date() && ["PENDING","ACCEPTED"].includes(c.status)?"EXPIRED":c.status,
      sentByMe:!!c.sentByMe,receivedByMe:!!c.receivedByMe,
      createdAt:c.createdAt,expiresAt:c.expiresAt
    }))
  });
}
async function invite(req,res,data,ctx) {
  const sender=visitorFor(req,res,ctx);
  if (!sender) return error(res,403,"visitor_session_required");
  if (!isUuid(data.commentId) || data.consent!==true) return error(res,400,"consent_required");
  const intro=clean(data.body,240);
  if(intro.length<10 || CONTACT.test(intro))return error(res,400,"invalid_invitation");
  const [target]=await ctx.query(
    "SELECT id,visitor_hash,photo_id,album_id FROM campfire_comments "+
    "WHERE id=$1::uuid AND status='APPROVED' AND visitor_hash IS NOT NULL LIMIT 1",
    [data.commentId]);
  if(!target || !ctx.validPhoto(target.photo_id) ||
      ctx.photos.get(target.photo_id)!==target.album_id)
    return error(res,404,"invitation_target_unavailable");
  if(target.visitor_hash===sender) return error(res,400,"cannot_invite_self");
  const mine=await ctx.query(
    "SELECT id FROM campfire_comments WHERE album_id=$1 AND visitor_hash=$2 "+
    "AND status='APPROVED' LIMIT 1",[target.album_id,sender]);
  if(!mine.length)return error(res,403,"own_approved_memory_required");
  const reversed=await ctx.query(
    "SELECT id FROM campfire_connections WHERE sender_hash=$1 AND recipient_hash=$2 "+
    "AND album_id=$3 AND status IN ('PENDING','ACCEPTED') LIMIT 1",
    [target.visitor_hash,sender,target.album_id]);
  if(reversed.length)return error(res,409,"reverse_invitation_exists");
  if(!await quota(ctx,req,sender,"invite"))return error(res,429,"rate_limited");
  const saved=await ctx.query(
    "INSERT INTO campfire_connections "+
    "(sender_hash,recipient_hash,source_comment_id,album_id,photo_id,intro) "+
    "VALUES($1,$2,$3::uuid,$4,$5,$6) "+
    "ON CONFLICT(sender_hash,recipient_hash,album_id) DO NOTHING RETURNING id",
    [sender,target.visitor_hash,target.id,target.album_id,target.photo_id,intro]);
  if(!saved.length)return error(res,409,"already_invited");
  return ctx.sendJson(res,201,{ok:true,id:saved[0].id,status:"PENDING"});
}
async function respond(req,res,data,ctx) {
  const visitor=visitorFor(req,res,ctx);
  if(!visitor)return error(res,403,"visitor_session_required");
  if(!isUuid(data.connectionId) || !["ACCEPTED","DECLINED"].includes(data.choice))
    return error(res,400,"invalid_decision");
  if(!await quota(ctx,req,visitor,"connection"))return error(res,429,"rate_limited");
  const rows=await ctx.query(
    "UPDATE campfire_connections SET status=$3,updated_at=NOW(),"+
    "expires_at=CASE WHEN $3='ACCEPTED' THEN NOW()+INTERVAL '180 days' ELSE NOW() END "+
    "WHERE id=$1::uuid AND recipient_hash=$2 AND status='PENDING' AND expires_at>NOW() "+
    "RETURNING id",[data.connectionId,visitor,data.choice]);
  if(!rows.length)return error(res,404,"invitation_unavailable");
  return ctx.sendJson(res,200,{ok:true,id:data.connectionId,status:data.choice});
}
async function connectionFor(ctx,id,visitor) {
  if(!isUuid(id))return null;
  const rows=await ctx.query(
    'SELECT id,photo_id AS "photoId",intro,status,expires_at AS "expiresAt" '+
    "FROM campfire_connections WHERE id=$1::uuid "+
    "AND (sender_hash=$2 OR recipient_hash=$2) LIMIT 1",[id,visitor]);
  return rows[0]||null;
}
async function letters(req,res,id,ctx) {
  if(!active(ctx))return error(res,403,"feature_disabled");
  const visitor=visitorFor(req,res,ctx);
  if(!visitor)return error(res,403,"visitor_session_required");
  const c=await connectionFor(ctx,id,visitor);
  if(!c||c.status!=="ACCEPTED"||new Date(c.expiresAt)<=new Date()||
      !ctx.validPhoto(c.photoId))return error(res,404,"conversation_unavailable");
  const rows=await ctx.query(
    'SELECT id,sender_hash=$2 AS mine,body,created_at AS "createdAt" '+
    "FROM campfire_letters WHERE connection_id=$1::uuid ORDER BY created_at ASC LIMIT 150",
    [id,visitor]);
  return ctx.sendJson(res,200,{ok:true,connectionId:id,photoId:c.photoId,
    letters:rows.map(row=>({id:row.id,mine:!!row.mine,body:row.body,createdAt:row.createdAt}))});
}
async function sendLetter(req,res,data,ctx) {
  const visitor=visitorFor(req,res,ctx);
  if(!visitor)return error(res,403,"visitor_session_required");
  const body=clean(data.body,500);
  if(body.length<2||CONTACT.test(body))return error(res,400,"invalid_letter");
  const c=await connectionFor(ctx,data.connectionId,visitor);
  if(!c||c.status!=="ACCEPTED"||new Date(c.expiresAt)<=new Date()||
      !ctx.validPhoto(c.photoId))return error(res,404,"conversation_unavailable");
  if(!await quota(ctx,req,visitor,"letter"))return error(res,429,"rate_limited");
  const rows=await ctx.query(
    "INSERT INTO campfire_letters(connection_id,sender_hash,body) "+
    "VALUES($1::uuid,$2,$3) RETURNING id",
    [data.connectionId,visitor,body]);
  return ctx.sendJson(res,201,{ok:true,id:rows[0].id});
}
async function close(req,res,data,ctx) {
  const visitor=visitorFor(req,res,ctx);
  if(!visitor)return error(res,403,"visitor_session_required");
  if(!isUuid(data.connectionId))return error(res,400,"invalid_target");
  if(!await quota(ctx,req,visitor,"connection"))return error(res,429,"rate_limited");
  const rows=await ctx.query(
    "UPDATE campfire_connections SET status='REVOKED',intro='已由参与者结束',"+
    "updated_at=NOW(),expires_at=NOW() WHERE id=$1::uuid "+
    "AND (sender_hash=$2 OR recipient_hash=$2) "+
    "AND status IN ('PENDING','ACCEPTED') RETURNING id",
    [data.connectionId,visitor]);
  if(!rows.length)return error(res,404,"conversation_unavailable");
  await ctx.query("DELETE FROM campfire_letters WHERE connection_id=$1::uuid",[data.connectionId]);
  return ctx.sendJson(res,200,{ok:true,closed:true});
}

async function reportLetter(req,res,data,ctx) {
  const visitor=visitorFor(req,res,ctx);
  if(!visitor)return error(res,403,"visitor_session_required");
  if(!isUuid(data.connectionId)||!isUuid(data.letterId))
    return error(res,400,"invalid_target");
  const reason=clean(data.reason||"",120);
  const matches=await ctx.query(
    "SELECT l.id FROM campfire_letters l JOIN campfire_connections c ON c.id=l.connection_id "+
    "WHERE l.id=$1::uuid AND l.connection_id=$2::uuid AND c.status='ACCEPTED' "+
    "AND c.expires_at>NOW() AND (c.sender_hash=$3 OR c.recipient_hash=$3) "+
    "AND l.sender_hash<>$3 LIMIT 1",
    [data.letterId,data.connectionId,visitor]);
  if(!matches.length)return error(res,404,"letter_unavailable");
  if(!await quota(ctx,req,visitor,"report"))return error(res,429,"rate_limited");
  await ctx.query(
    "INSERT INTO campfire_letter_reports(letter_id,connection_id,reporter_hash,reason) "+
    "VALUES($1::uuid,$2::uuid,$3,$4) "+
    "ON CONFLICT(letter_id,reporter_hash) DO NOTHING",
    [data.letterId,data.connectionId,visitor,reason]);
  return ctx.sendJson(res,200,{ok:true,reported:true});
}
async function listReports(query) {
  const rows=await query(
    'SELECT r.id,r.connection_id AS "connectionId",l.body,r.reason,'+
    'r.created_at AS "createdAt" '+
    "FROM campfire_letter_reports r JOIN campfire_letters l ON l.id=r.letter_id "+
    "WHERE r.resolved_at IS NULL ORDER BY r.created_at DESC LIMIT 100");
  return rows.map(row=>({id:row.id,connectionId:row.connectionId,
    body:row.body,reason:row.reason,createdAt:row.createdAt}));
}
async function moderateReport(req,res,data,ctx) {
  if(!ctx.adminFor(req))return error(res,403,"forbidden");
  if(!isUuid(data.reportId)||!["DISMISS","CLOSE"].includes(data.decision))
    return error(res,400,"invalid_moderation");
  const reports=await ctx.query(
    "SELECT connection_id FROM campfire_letter_reports "+
    "WHERE id=$1::uuid AND resolved_at IS NULL LIMIT 1",[data.reportId]);
  if(!reports.length)return error(res,404,"report_unavailable");
  const connectionId=reports[0].connection_id;
  if(data.decision==="CLOSE"){
    await ctx.query(
      "UPDATE campfire_connections SET status='REVOKED',"+
      "intro='已由管理员终止',expires_at=NOW(),updated_at=NOW() "+
      "WHERE id=$1::uuid AND status IN ('PENDING','ACCEPTED')",[connectionId]);
    // The letter FK cascades report rows. Admin can only inspect flagged letters.
    await ctx.query("DELETE FROM campfire_letters WHERE connection_id=$1::uuid",[connectionId]);
  }else{
    await ctx.query("UPDATE campfire_letter_reports SET resolved_at=NOW() WHERE id=$1::uuid",[data.reportId]);
  }
  return ctx.sendJson(res,200,{ok:true,decision:data.decision});
}

async function readNotice(req,res,data,ctx) {
  const visitor=visitorFor(req,res,ctx);
  if(!visitor)return error(res,403,"visitor_session_required");
  if(!isUuid(data.noticeId))return error(res,400,"invalid_target");
  const rows=await ctx.query(
    "UPDATE campfire_notifications SET read_at=NOW() "+
    "WHERE id=$1::uuid AND recipient_hash=$2 AND read_at IS NULL RETURNING id",
    [data.noticeId,visitor]);
  return ctx.sendJson(res,200,{ok:true,read:rows.length>0});
}
async function handleGet(req,res,view,url,ctx) {
  if(view==="inbox")return inbox(req,res,ctx);
  if(view==="letters")return letters(req,res,url.searchParams.get("id"),ctx);
  return error(res,404,"not_found");
}
async function handlePost(req,res,data,ctx) {
  if(!active(ctx))return error(res,403,"feature_disabled");
  switch(data.action) {
    case "invite":return invite(req,res,data,ctx);
    case "respond":return respond(req,res,data,ctx);
    case "letter":return sendLetter(req,res,data,ctx);
    case "closeConnection":return close(req,res,data,ctx);
    case "readNotice":return readNotice(req,res,data,ctx);
    case "reportLetter":return reportLetter(req,res,data,ctx);
    default:return error(res,400,"invalid_action");
  }
}
module.exports={handleGet,handlePost,notifyReply,listReports,moderateReport,clean};
