"use strict";
/*
 * BUDAO Campfire Stage 2: consent-based in-site relationships.
 * No guest directory, no automatic contact disclosure, no email/phone, no
 * inference from likes. A verified owner of an APPROVED public comment may
 * invite another approved commenter; only the intended recipient can accept.
 * Accepted pairs can exchange short private notes and express walk interest.
 */
const {sendJson} = require("./http");
const {consumeGuestQuota} = require("./campfire-guest-quota");
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH=/^[0-9a-f]{64}$/;
const bad=(res,status,reason)=>sendJson(res,status,{ok:false,reason});
const validId=id=>typeof id==="string"&&UUID.test(id);
const safeText=(v,max)=>{
  if(typeof v!=="string")return "";
  const text=v.trim().replace(/\r\n?/g,"\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g,"").replace(/\n{3,}/g,"\n\n");
  return text.length<=max?text:"";
};
const unsafe=text=>/(https?:\/\/|www\.|(?:\+?\d[\d\s-]{9,}\d)|[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,})/i.test(text);
function make({query,guestHash,validPhoto,photos,guestWritesEnabled,adminFor}) {
  async function inbox(req,res) {
    const visitor=guestHash(req,res,false);
    if(!visitor) return sendJson(res,200,{ok:true,hasIdentity:false,replies:[],invites:[],lastReadAt:null});
    const replies=await query(
      "SELECT r.id,r.photo_id AS \"photoId\",r.display_name AS name,"+
      "r.official,r.created_at AS \"createdAt\",LEFT(r.body,180) AS snippet "+
      "FROM campfire_comments r "+
      "LEFT JOIN campfire_reply_targets t ON t.comment_id=r.id "+
      "JOIN campfire_comments p ON p.id=COALESCE(t.replied_to_id,r.parent_id) "+
      "WHERE p.visitor_hash=$1 AND p.status='APPROVED' "+
      "AND r.status='APPROVED' AND (r.visitor_hash IS NULL OR r.visitor_hash<>$1) "+
      "ORDER BY r.created_at DESC LIMIT 45",[visitor]);
    const invites=await query(
      "SELECT id,photo_id AS \"photoId\",sender_name AS \"senderName\","+
      "recipient_name AS \"recipientName\",note,status,created_at AS \"createdAt\","+
      "updated_at AS \"updatedAt\",responded_at AS \"respondedAt\","+
      "sender_wants_walk AS \"senderWantsWalk\","+
      "recipient_wants_walk AS \"recipientWantsWalk\", "+
      "(SELECT MAX(m.created_at) FROM campfire_private_messages m "+
      "WHERE m.invite_id=campfire_peer_invites.id "+
      "AND m.sender_hash<>$1 AND m.status='ACTIVE') AS \"lastOtherMessageAt\", "+
      "(sender_hash=$1) AS mine "+
      "FROM campfire_peer_invites "+
      "WHERE sender_hash=$1 OR recipient_hash=$1 "+
      "ORDER BY updated_at DESC LIMIT 50",[visitor]);
    const last=await query(
      "SELECT last_read_at AS \"lastReadAt\" FROM campfire_inbox_state WHERE visitor_hash=$1",
      [visitor]);
    const lastReadAt=last[0]?.lastReadAt||null;
    const visible=replies.filter(x=>validPhoto(x.photoId)).map(x=>({...x,kind:"reply"}));
    const safeInvites=invites.filter(x=>validPhoto(x.photoId));
    return sendJson(res,200,{ok:true,hasIdentity:true,replies:visible,invites:safeInvites,
      lastReadAt});
  }

  async function markRead(req,res) {
    const visitor=guestHash(req,res,false);
    if(!visitor)return bad(res,403,"visitor_session_required");
    await query(
      "INSERT INTO campfire_inbox_state(visitor_hash,last_read_at) VALUES($1,NOW()) "+
      "ON CONFLICT(visitor_hash) DO UPDATE SET last_read_at=NOW()",
      [visitor]);
    return sendJson(res,200,{ok:true});
  }

  async function invite(req,res,data) {
    if(!guestWritesEnabled())return bad(res,403,"guest_comments_not_enabled");
    if(data.consent!==true)return bad(res,400,"consent_required");
    if(!validPhoto(data.photoId)||!validId(data.targetCommentId))
      return bad(res,400,"invalid_target");
    const note=safeText(data.note||"",200);
    if(unsafe(note))return bad(res,400,"no_contact_details");
    const sender=guestHash(req,res,false);
    if(!sender)return bad(res,403,"leave_a_comment_first");
    // Target's pseudonymous author must be real, currently approved and not
    // an official administrator. No member directory or profile lookup.
    const target=await query(
      "SELECT id,visitor_hash AS \"visitorHash\",display_name AS name "+
      "FROM campfire_comments WHERE id=$1::uuid AND photo_id=$2 "+
      "AND status='APPROVED' AND official=FALSE AND visitor_hash IS NOT NULL",
      [data.targetCommentId,data.photoId]);
    if(!target.length||!HASH.test(target[0].visitorHash))
      return bad(res,404,"comment_unavailable");
    if(target[0].visitorHash===sender)return bad(res,400,"cannot_invite_self");
    const mine=await query(
      "SELECT display_name AS name FROM campfire_comments "+
      "WHERE photo_id=$1 AND visitor_hash=$2 AND status='APPROVED' "+
      "ORDER BY created_at DESC LIMIT 1",[data.photoId,sender]);
    if(!mine.length)return bad(res,403,"leave_a_comment_first");
    if(!await consumeGuestQuota(query,req,sender,"invite"))
      return bad(res,429,"rate_limited");
    const inserted=await query(
      "INSERT INTO campfire_peer_invites(photo_id,sender_hash,recipient_hash,"+
      "sender_name,recipient_name,target_comment_id,note) "+
      "VALUES($1,$2,$3,$4,$5,$6::uuid,$7) "+
      "ON CONFLICT(sender_hash,target_comment_id) DO NOTHING RETURNING id",
      [data.photoId,sender,target[0].visitorHash,mine[0].name,target[0].name,
        data.targetCommentId,note]);
    if(!inserted.length)return bad(res,409,"invitation_exists");
    return sendJson(res,201,{ok:true,id:inserted[0].id,status:"PENDING"});
  }

  async function invitation(req,res,data,operation) {
    if(!validId(data.inviteId))return bad(res,400,"invalid_target");
    const visitor=guestHash(req,res,false);
    if(!visitor)return bad(res,403,"visitor_session_required");
    const eligible=operation==="accept"||operation==="decline"
      ? "recipient_hash=$2 AND status='PENDING'"
      : "((sender_hash=$2 OR recipient_hash=$2) AND status IN ('PENDING','ACCEPTED'))";
    const next=operation==="accept"?"ACCEPTED":operation==="decline"?"DECLINED":
      operation==="block"?"BLOCKED":"CANCELLED";
    const responseTime=(operation==="accept"||operation==="decline")?"responded_at=NOW(),":"";
    const result=await query(
      "UPDATE campfire_peer_invites SET status=$3,"+responseTime+"updated_at=NOW() "+
      "WHERE id=$1::uuid AND "+eligible+" RETURNING id",
      [data.inviteId,visitor,next]);
    if(!result.length)return bad(res,404,"invitation_unavailable");
    return sendJson(res,200,{ok:true,status:next});
  }

  async function toggleWalk(req,res,data) {
    if(!validId(data.inviteId)||typeof data.interested!=="boolean")
      return bad(res,400,"invalid_request");
    const visitor=guestHash(req,res,false);
    if(!visitor)return bad(res,403,"visitor_session_required");
    const rows=await query(
      "UPDATE campfire_peer_invites SET "+
      "sender_wants_walk=CASE WHEN sender_hash=$2 THEN $3 ELSE sender_wants_walk END,"+
      "recipient_wants_walk=CASE WHEN recipient_hash=$2 THEN $3 ELSE recipient_wants_walk END,"+
      "updated_at=NOW() "+
      "WHERE id=$1::uuid AND status='ACCEPTED' "+
      "AND (sender_hash=$2 OR recipient_hash=$2) "+
      "RETURNING sender_wants_walk AS \"senderWantsWalk\","+
      "recipient_wants_walk AS \"recipientWantsWalk\"",
      [data.inviteId,visitor,data.interested]);
    if(!rows.length)return bad(res,404,"invitation_unavailable");
    return sendJson(res,200,{ok:true,mutual:!!(rows[0].senderWantsWalk&&rows[0].recipientWantsWalk)});
  }

  async function conversation(req,res,inviteId) {
    if(!validId(inviteId))return bad(res,400,"invalid_target");
    const visitor=guestHash(req,res,false);
    if(!visitor)return bad(res,403,"visitor_session_required");
    const access=await query(
      "SELECT id,status,sender_name AS \"senderName\",recipient_name AS \"recipientName\","+
      "sender_wants_walk AS \"senderWantsWalk\",recipient_wants_walk AS \"recipientWantsWalk\","+
      "(sender_hash=$2) AS mine FROM campfire_peer_invites "+
      "WHERE id=$1::uuid AND (sender_hash=$2 OR recipient_hash=$2)",
      [inviteId,visitor]);
    if(!access.length)return bad(res,404,"invitation_unavailable");
    if(access[0].status!=="ACCEPTED")
      return sendJson(res,200,{ok:true,invitation:access[0],messages:[]});
    const messages=await query(
      "SELECT id,body,status,created_at AS \"createdAt\",(sender_hash=$2) AS mine "+
      "FROM campfire_private_messages WHERE invite_id=$1::uuid "+
      "ORDER BY created_at ASC LIMIT 100",[inviteId,visitor]);
    return sendJson(res,200,{ok:true,invitation:access[0],messages:messages.map(x=>({
      id:x.id,body:x.status==="ACTIVE"?x.body:"此内容已由管理员移除",
      createdAt:x.createdAt,mine:!!x.mine,redacted:x.status!=="ACTIVE"
    }))});
  }

  async function privateMessage(req,res,data) {
    if(!guestWritesEnabled())return bad(res,403,"guest_comments_not_enabled");
    if(!validId(data.inviteId))return bad(res,400,"invalid_target");
    const body=safeText(data.body,300);
    if(body.length<2||unsafe(body))return bad(res,400,"invalid_message");
    const sender=guestHash(req,res,false);
    if(!sender)return bad(res,403,"visitor_session_required");
    const authorized=await query(
      "SELECT id FROM campfire_peer_invites WHERE id=$1::uuid "+
      "AND status='ACCEPTED' AND (sender_hash=$2 OR recipient_hash=$2)",
      [data.inviteId,sender]);
    if(!authorized.length)return bad(res,404,"invitation_unavailable");
    if(!await consumeGuestQuota(query,req,sender,"message"))
      return bad(res,429,"rate_limited");
    // Bound insert to the current permission state in case an invitation is
    // cancelled or blocked between authorization and submission.
    const written=await query(
      "INSERT INTO campfire_private_messages(invite_id,sender_hash,body) "+
      "SELECT id,$2,$3 FROM campfire_peer_invites "+
      "WHERE id=$1::uuid AND status='ACCEPTED' "+
      "AND (sender_hash=$2 OR recipient_hash=$2) RETURNING id",
      [data.inviteId,sender,body]);
    if(!written.length)return bad(res,409,"invitation_closed");
    await query("UPDATE campfire_peer_invites SET updated_at=NOW() WHERE id=$1::uuid",
      [data.inviteId]);
    return sendJson(res,201,{ok:true,id:written[0].id});
  }

  async function withdrawPrivate(req,res,data) {
    if(!validId(data.inviteId)||!validId(data.messageId))
      return bad(res,400,"invalid_target");
    const visitor=guestHash(req,res,false);
    if(!visitor)return bad(res,403,"visitor_session_required");
    const removed=await query(
      "UPDATE campfire_private_messages SET status='REDACTED',body='此内容已由作者撤回' "+
      "WHERE id=$1::uuid AND invite_id=$2::uuid AND sender_hash=$3 "+
      "AND status='ACTIVE' RETURNING id",
      [data.messageId,data.inviteId,visitor]);
    if(!removed.length)return bad(res,404,"message_unavailable");
    return sendJson(res,200,{ok:true,withdrawn:true});
  }

  async function reportPrivate(req,res,data) {
    if(!validId(data.inviteId)||!validId(data.messageId))
      return bad(res,400,"invalid_target");
    const visitor=guestHash(req,res,false);
    if(!visitor)return bad(res,403,"visitor_session_required");
    const message=await query(
      "SELECT m.id FROM campfire_private_messages m JOIN campfire_peer_invites i "+
      "ON i.id=m.invite_id WHERE m.id=$1::uuid AND m.invite_id=$2::uuid "+
      "AND m.status='ACTIVE' AND m.sender_hash<>$3 "+
      "AND (i.sender_hash=$3 OR i.recipient_hash=$3)",
      [data.messageId,data.inviteId,visitor]);
    if(!message.length)return bad(res,404,"message_unavailable");
    if(!await consumeGuestQuota(query,req,visitor,"report"))
      return bad(res,429,"rate_limited");
    const reason=safeText(data.reason||"不适当内容",120)||"不适当内容";
    await query(
      "INSERT INTO campfire_private_reports(invite_id,message_id,reporter_hash,reason) "+
      "VALUES($1::uuid,$2::uuid,$3,$4) "+
      "ON CONFLICT(message_id,reporter_hash) DO NOTHING",
      [data.inviteId,data.messageId,visitor,reason]);
    await query("UPDATE campfire_peer_invites SET status='BLOCKED',updated_at=NOW() "+
      "WHERE id=$1::uuid AND status='ACCEPTED'",[data.inviteId]);
    return sendJson(res,200,{ok:true,blocked:true});
  }

  async function privateReports(req,res) {
    if(!adminFor(req))return bad(res,403,"forbidden");
    const reports=await query(
      "SELECT r.id,r.message_id AS \"messageId\",r.invite_id AS \"inviteId\","+
      "r.reason,r.created_at AS \"createdAt\",m.body,m.status "+
      "FROM campfire_private_reports r "+
      "JOIN campfire_private_messages m ON m.id=r.message_id "+
      "WHERE r.resolved_at IS NULL ORDER BY r.created_at DESC LIMIT 100");
    return sendJson(res,200,{ok:true,reports});
  }

  async function moderatePrivate(req,res,data) {
    const admin=adminFor(req);
    if(!admin)return bad(res,403,"forbidden");
    if(!validId(data.reportId)||!["REDACT","DISMISS"].includes(data.decision))
      return bad(res,400,"invalid_request");
    const reports=await query(
      "SELECT message_id AS \"messageId\" FROM campfire_private_reports "+
      "WHERE id=$1::uuid AND resolved_at IS NULL",[data.reportId]);
    if(!reports.length)return bad(res,404,"report_unavailable");
    if(data.decision==="REDACT")await query(
      "UPDATE campfire_private_messages SET status='REDACTED',body='此内容已由管理员移除' "+
      "WHERE id=$1::uuid",[reports[0].messageId]);
    await query("UPDATE campfire_private_reports SET resolved_at=NOW() "+
      "WHERE id=$1::uuid",[data.reportId]);
    return sendJson(res,200,{ok:true,decision:data.decision});
  }

  return {inbox,markRead,invite,invitation,toggleWalk,conversation,
    privateMessage,withdrawPrivate,reportPrivate,privateReports,moderatePrivate};
}
module.exports={make,safeText,unsafe};
