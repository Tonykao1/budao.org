"use strict";
/* Campfire conversations and one-time sparks.
   Public guest writes are OFF until operator compliance review and DB migration.
   Uses the existing admin cookie and an opt-in anonymous guest token. */
const crypto = require("node:crypto");
const { neon } = require("@neondatabase/serverless");
const { getDatabaseUrl } = require("../../db/client");
const { getAuthenticatedPublisher, isSteward } = require("./auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("./http");
const { clientIp, consume } = require("./rate-limit");
const archive = require("../../data/campfire-archive.json");

const photos = new Map();
for (const album of archive.albums || []) {
  if (!album || album.published !== true) continue;
  for (const p of album.photos || []) {
    if (p && p.approved === true && typeof p.src === "string" && p.src.startsWith("/campfire-photos/"))
      photos.set(p.src, String(album.id || ""));
  }
}
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const COOKIE = "budao_campfire_guest";
const STATES = new Set(["APPROVED","HIDDEN","DELETED","REJECTED"]);
const guestWritesEnabled = () => process.env.CAMPFIRE_GUEST_WRITES_ENABLED === "true";
const adminFor = req => {
  const u = getAuthenticatedPublisher(req);
  return isSteward(u) ? u : null;
};
const validPhoto = p => typeof p === "string" && photos.has(p);
const error = (res, status, reason) => sendJson(res,status,{ok:false,reason});
const clean = (v,max) => {
  if (typeof v !== "string") return "";
  const s = v.trim().replace(/\r\n?/g,"\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,"");
  return s.length <= max ? s : "";
};
let connection;
function query(text,params=[]) {
  if (!connection) connection = neon(getDatabaseUrl());
  return connection.query(text,params);
}
function guestHash(req,res,create) {
  let token = String(req.headers?.cookie || "").split(";").map(x=>x.trim())
    .find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1) || "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) token = "";
  if (!token && create) {
    token = crypto.randomBytes(32).toString("base64url");
    const secure = process.env.NODE_ENV !== "test";
    res.setHeader("Set-Cookie",[
      COOKIE+"="+token,"Path=/","HttpOnly","SameSite=Lax",
      "Max-Age="+180*86400,secure?"Secure":""
    ].filter(Boolean).join("; "));
  }
  if (!token) return null;
  const secret = process.env.BUDAO_SESSION_SECRET;
  if (!secret || secret.length<32) throw new Error("guest_secret_not_configured");
  return crypto.createHmac("sha256",secret).update("campfire:"+token).digest("hex");
}
async function thread(req,res,photoId) {
  if (!validPhoto(photoId)) return error(res,404,"photo_unavailable");
  const visitor = guestHash(req,res,false);
  const comments = await query(
    "SELECT id, parent_id AS \"parentId\",display_name AS name,body,official,created_at AS \"createdAt\" "+
    "FROM campfire_comments WHERE photo_id=$1 AND status='APPROVED' ORDER BY created_at ASC LIMIT 180",
    [photoId]);
  const reacted = visitor ? await query(
    "SELECT target_kind||':'||target_id AS key FROM campfire_reactions "+
    "WHERE visitor_hash=$1 AND ((target_kind='photo' AND target_id=$2) OR "+
    "(target_kind='comment' AND target_id IN (SELECT id::text FROM campfire_comments "+
    "WHERE photo_id=$2 AND status='APPROVED'))) LIMIT 200",
    [visitor,photoId]) : [];
  return sendJson(res,200,{ok:true,photoId,comments,reacted:reacted.map(x=>x.key),guestWritesEnabled:guestWritesEnabled()});
}
async function moderationQueue(req,res) {
  if (!adminFor(req)) return error(res,403,"forbidden");
  const pending = await query(
    "SELECT id,photo_id AS \"photoId\",parent_id AS \"parentId\",display_name AS name,"+
    "body,status,created_at AS \"createdAt\" FROM campfire_comments "+
    "WHERE status IN ('PENDING','HIDDEN') ORDER BY created_at DESC LIMIT 150");
  const reports = await query(
    "SELECT r.id,r.comment_id AS \"commentId\",r.created_at AS \"createdAt\","+
    "c.photo_id AS \"photoId\",c.body,c.status FROM campfire_reports r "+
    "JOIN campfire_comments c ON c.id=r.comment_id WHERE r.resolved_at IS NULL "+
    "ORDER BY r.created_at DESC LIMIT 100");
  return sendJson(res,200,{ok:true,pending,reports});
}
async function react(req,res,data) {
  const photoId = data.photoId;
  if (!validPhoto(photoId) || !["photo","comment"].includes(data.kind))
    return error(res,400,"invalid_target");
  const target = data.kind==="photo" ? photoId : data.commentId;
  if (data.kind==="comment") {
    if (!UUID.test(target||"")) return error(res,400,"invalid_target");
    const c=await query("SELECT id FROM campfire_comments WHERE id=$1::uuid AND photo_id=$2 AND status='APPROVED'",[target,photoId]);
    if (!c.length) return error(res,404,"comment_unavailable");
  }
  const visitor = guestHash(req,res,true);
  const inserted = await query(
    "INSERT INTO campfire_reactions(visitor_hash,target_kind,target_id,album_id) VALUES ($1,$2,$3,$4) "+
    "ON CONFLICT (visitor_hash,target_kind,target_id) DO NOTHING RETURNING id",
    [visitor,data.kind,target,photos.get(photoId)]);
  return sendJson(res,200,{ok:true,reacted:true,fresh:inserted.length===1});
}
async function addComment(req,res,data) {
  const photoId=data.photoId;
  if (!validPhoto(photoId)) return error(res,404,"photo_unavailable");
  const admin=adminFor(req);
  if (!admin && !guestWritesEnabled()) return error(res,403,"guest_comments_not_enabled");
  if (!admin && data.consent!==true) return error(res,400,"consent_required");
  const body=clean(data.body,600);
  const name=admin?"步道 · 主理人":clean(data.name||"",32)||"同行者";
  if (body.length<2 || /https?:\/\/|www\./i.test(body)) return error(res,400,"invalid_comment");
  let parent=null;
  if (data.parentId) {
    if (!UUID.test(data.parentId)) return error(res,400,"invalid_reply");
    const found=await query(
      "SELECT id,parent_id FROM campfire_comments WHERE id=$1::uuid AND photo_id=$2 AND status='APPROVED'",
      [data.parentId,photoId]);
    if (!found.length) return error(res,404,"reply_target_unavailable");
    parent=found[0].parent_id||found[0].id;
  }
  const visitor=admin?null:guestHash(req,res,true);
  const status=admin?"APPROVED":"PENDING";
  const inserted=await query(
    "INSERT INTO campfire_comments(photo_id,album_id,parent_id,visitor_hash,display_name,body,status,official,consent_version) "+
    "VALUES($1,$2,$3::uuid,$4,$5,$6,$7,$8,$9) RETURNING id",
    [photoId,photos.get(photoId),parent,visitor,name,body,status,!!admin,admin?null:"campfire-v1"]);
  return sendJson(res,201,{ok:true,id:inserted[0].id,status});
}
async function moderate(req,res,data) {
  const admin=adminFor(req);
  if (!admin) return error(res,403,"forbidden");
  if (!UUID.test(data.commentId||"")||!STATES.has(data.status)) return error(res,400,"invalid_moderation");
  const found=await query("SELECT id,status FROM campfire_comments WHERE id=$1::uuid",[data.commentId]);
  if (!found.length||found[0].status==="DELETED") return error(res,404,"comment_unavailable");
  const previous=found[0].status;
  if (data.status==="APPROVED"&&!["PENDING","HIDDEN"].includes(previous)) return error(res,400,"invalid_transition");
  if (data.status==="HIDDEN"&&previous!=="APPROVED") return error(res,400,"invalid_transition");
  if (data.status==="REJECTED"&&previous!=="PENDING") return error(res,400,"invalid_transition");
  if (data.status==="DELETED") {
    await query("UPDATE campfire_comments SET status='DELETED',body='此评论已删除',"+
      "display_name='同行者',visitor_hash=NULL,updated_at=NOW(),moderated_at=NOW(),moderated_by=$2 WHERE id=$1::uuid",
      [data.commentId,admin.id]);
  } else {
    await query("UPDATE campfire_comments SET status=$2,updated_at=NOW(),moderated_at=NOW(),"+
      "moderated_by=$3 WHERE id=$1::uuid",[data.commentId,data.status,admin.id]);
  }
  await query("INSERT INTO campfire_moderation_audit(comment_id,action,previous_status,actor_id,reason) "+
    "VALUES($1::uuid,$2,$3,$4,$5)",[data.commentId,data.status,previous,admin.id,clean(data.reason||"",120)]);
  await query("UPDATE campfire_reports SET resolved_at=NOW() WHERE comment_id=$1::uuid AND resolved_at IS NULL",[data.commentId]);
  return sendJson(res,200,{ok:true,status:data.status});
}
async function report(req,res,data) {
  if (!UUID.test(data.commentId||"")) return error(res,400,"invalid_target");
  const found=await query("SELECT id FROM campfire_comments WHERE id=$1::uuid AND status='APPROVED'",[data.commentId]);
  if (!found.length) return error(res,404,"comment_unavailable");
  const visitor=guestHash(req,res,true);
  await query("INSERT INTO campfire_reports(comment_id,visitor_hash) VALUES($1::uuid,$2) "+
    "ON CONFLICT(comment_id,visitor_hash) DO NOTHING",[data.commentId,visitor]);
  return sendJson(res,200,{ok:true});
}
async function handler(req,res) {
  const u=new URL(req.url||"/api/campfire","https://budao.org");
  try {
    if (req.method==="GET") {
      if (u.searchParams.get("view")==="moderation") return await moderationQueue(req,res);
      return await thread(req,res,u.searchParams.get("photoId"));
    }
    const parsed=requireJsonPost(req,12*1024);
    if (parsed.error) return error(res,parsed.status,parsed.error);
    if (!requireSameOrigin(req)) return error(res,403,"forbidden");
    if (!consume("campfire:"+clientIp(req),24,60000)) return error(res,429,"rate_limited");
    const data=parsed.body;
    switch(data.action) {
      case "react":
        if (!guestWritesEnabled()&&!adminFor(req)) return error(res,403,"guest_reactions_not_enabled");
        return await react(req,res,data);
      case "comment":return await addComment(req,res,data);
      case "moderate":return await moderate(req,res,data);
      case "report":return await report(req,res,data);
      default:return error(res,400,"invalid_action");
    }
  } catch(e) {
    if (e.code==="42P01") return error(res,503,"migration_required");
    console.error("Campfire API error:",e.code||e.name||"unknown");
    return error(res,503,"temporarily_unavailable");
  }
}
handler.validPhoto=validPhoto;
handler.clean=clean;
handler.guestWritesEnabled=guestWritesEnabled;
module.exports=handler;
