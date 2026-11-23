'use strict';
/* Preview-only, fail-closed. No cloud publishing when isolated DB is not configured. */
const crypto=require('node:crypto');
const {neon}=require('@neondatabase/serverless');
const {getDatabaseUrl}=require('../db/client');
const auth=require('./_security/pasture-auth-domain');
const residents=require('./_security/pasture-auth-store');
const policy=require('./_security/pasture-commons-domain');
const fellowship=require('./_security/pasture-fellowship-domain');
const {requireSameOrigin,sendJson}=require('./_security/http');
const {consume,clientIp}=require('./_security/rate-limit');
const MAX_REQUEST_BYTES=3*1024*1024;
let prepared=false;
function enabled(env=process.env){
 return env.VERCEL_ENV==='preview'&&env.PASTURE_COMMONS_ENABLED==='true'&&!!env.DATABASE_URL;
}
function fail(res,status,reason){return sendJson(res,status,{ok:false,reason})}
async function residentFor(req){
 const token=auth.readCookie(req);
 if(!token)return null;
 const row=await residents.sessionByTokenHash(auth.tokenHash(token));
 if(!row?.user?.cardActivatedAt||row.user.status!=='ACTIVE')return null;
 const sheep=await residents.sheepForUser(row.user.id);
 return sheep?row.user:null;
}
async function prepare(sql){
 if(prepared)return;
 await residents.ensurePastureSchema();
 await sql.query("CREATE TABLE IF NOT EXISTS pasture_audio_receipts_v1 (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE, audio_id text NOT NULL, reference text NOT NULL, sha256 text NOT NULL, bytes integer NOT NULL CHECK (bytes>0 AND bytes<=2097152), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(owner_id,audio_id,sha256))");
 await sql.query("CREATE TABLE IF NOT EXISTS pasture_commons_v1 (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE, kind text NOT NULL CHECK (kind IN ('reading','insight')), entry_id text NOT NULL, audio_id text NOT NULL, scripture_reference text NOT NULL, translation text NOT NULL DEFAULT '', voice text NOT NULL CHECK (voice IN ('SPOKEN','SILENT','NONE')), public_text text NOT NULL DEFAULT '', audio_data bytea, audio_mime text, audio_size integer, consent_version text NOT NULL, status text NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('PUBLISHED','WITHDRAWN')), created_at timestamptz NOT NULL DEFAULT now(), withdrawn_at timestamptz, UNIQUE(owner_id,kind,entry_id))");
 await sql.query("CREATE INDEX IF NOT EXISTS pasture_commons_public_ref_v1 ON pasture_commons_v1 (scripture_reference,kind,created_at DESC) WHERE status='PUBLISHED'");
 prepared=true;
}
function bodyOf(req){
 if(!String(req.headers?.['content-type']||'').toLowerCase().startsWith('application/json'))throw Error('unsupported_media_type');
 let body=req.body;
 if(typeof body==='string')body=JSON.parse(body);
 if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid_request');
 if(Buffer.byteLength(JSON.stringify(body),'utf8')>MAX_REQUEST_BYTES)throw Error('payload_too_large');
 return body;
}
function kindRow(r){return {id:r.id,kind:r.kind,status:r.status,scriptureReference:r.scripture_reference,translation:r.translation,voice:r.voice,publicText:r.public_text}}
async function receiptFor(sql,owner,id,audioId){
 if(!policy.validId(id)||typeof audioId!=='string')return null;
 const rows=await sql.query("SELECT id,owner_id,audio_id,reference,sha256,bytes FROM pasture_audio_receipts_v1 WHERE id=$1 AND owner_id=$2 AND audio_id=$3 LIMIT 1",[id,owner,audioId]);
 return rows[0]||null;
}
async function handle(req,res){
 if(req.method!=='GET'&&req.method!=='POST')return fail(res,405,'method_not_allowed');
 if(req.method==='GET'&&new URL(req.url,'https://budao.org').searchParams.get('mode')==='status')
  return sendJson(res,200,{ok:true,enabled:enabled(),pilotAudioLimitBytes:policy.MAX_AUDIO_BYTES});
 if(!enabled())return fail(res,503,'commons_not_configured');
 const sql=neon(getDatabaseUrl());
 try{
  await prepare(sql);
  if(req.method==='GET'){
   const u=new URL(req.url,'https://budao.org'),audio=u.searchParams.get('audio');
   if(audio){
    if(!policy.validId(audio))return fail(res,400,'invalid_publication');
    const rows=await sql.query("SELECT encode(audio_data,'base64') AS audio_b64,audio_mime FROM pasture_commons_v1 WHERE id=$1 AND kind='reading' AND voice='SPOKEN' AND status='PUBLISHED' LIMIT 1",[audio]);
    if(!rows[0]?.audio_b64)return fail(res,404,'not_found');
    const data=Buffer.from(rows[0].audio_b64,'base64');
    res.setHeader('Content-Type',rows[0].audio_mime||'application/octet-stream');
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Content-Length',String(data.length));
    return res.status(200).end(data);
   }
   const kind=policy.validateKind(u.searchParams.get('kind')||'reading');
   const ref=u.searchParams.get('ref');
   const query=ref?
    "SELECT id,kind,status,scripture_reference,translation,voice,public_text FROM pasture_commons_v1 WHERE kind=$1 AND scripture_reference=$2 AND status='PUBLISHED' ORDER BY created_at DESC LIMIT 30":
    "SELECT id,kind,status,scripture_reference,translation,voice,public_text FROM pasture_commons_v1 WHERE kind=$1 AND status='PUBLISHED' ORDER BY created_at DESC LIMIT 30";
   const rows=await sql.query(query,ref?[kind,policy.reference(ref)]:[kind]);
   return sendJson(res,200,{ok:true,items:rows.map(r=>policy.publicView(kindRow(r))).filter(Boolean)});
  }
  if(!requireSameOrigin(req))return fail(res,403,'cross_origin_forbidden');
  if(!consume('commons:'+clientIp(req),15,60_000))return fail(res,429,'rate_limited');
  const owner=await residentFor(req);
  if(!owner)return fail(res,401,'resident_login_required');
  const body=bodyOf(req),action=String(body.action||'');
  if(action==='attest-recording'){
   if(body.privateAudioVerificationConsent!==true)return fail(res,400,'audio_verification_consent_required');
   const journey=policy.verifyJourney(body.journey),audio=policy.validAudio(body.mime,body.audioBase64);
   const existing=await sql.query("SELECT id FROM pasture_audio_receipts_v1 WHERE owner_id=$1 AND audio_id=$2 AND sha256=$3 LIMIT 1",[owner.id,journey.audioId,audio.sha256]);
   if(existing.length)return sendJson(res,200,{ok:true,receiptId:existing[0].id,privateAudioStored:false});
   const id=crypto.randomUUID();
   await sql.query("INSERT INTO pasture_audio_receipts_v1 (id,owner_id,audio_id,reference,sha256,bytes) VALUES ($1,$2,$3,$4,$5,$6)",[id,owner.id,journey.audioId,journey.reference,audio.sha256,audio.size]);
   // The original private recording is not written to the database.
   return sendJson(res,200,{ok:true,receiptId:id,privateAudioStored:false});
  }
  if(action==='publish-reading'){
   if(body.publishConsent!==true||body.consentVersion!=='v1')return fail(res,400,'publish_consent_required');
   if(body.rightsConfirmed!==true)return fail(res,400,'audio_scripture_rights_confirmation_required');
   const journey=policy.verifyJourney(body.journey);
   const receipt=await receiptFor(sql,owner.id,body.receiptId,journey.audioId);
   if(!receipt||receipt.reference!==journey.reference)return fail(res,403,'recording_receipt_required');
   const entryId=String(body.entryId||'');
   if(!entryId||entryId.length>120)return fail(res,400,'invalid_entry');
   const translation=String(body.translation||'').trim();
   if(translation!=='圣经和合本（神版）')return fail(res,403,'translation_rights_pending');
   const mode=body.mode==='silent'?'SILENT':body.mode==='spoken'?'SPOKEN':null;
   if(!mode)return fail(res,400,'invalid_mode');
   const encoded=mode==='SPOKEN'?policy.validAudio(body.audioMime,body.publicAudioBase64):null;
   if(mode==='SILENT'&&body.publicAudioBase64)return fail(res,400,'silent_public_audio_forbidden');
   const found=await sql.query("SELECT id,status FROM pasture_commons_v1 WHERE owner_id=$1 AND kind='reading' AND entry_id=$2 LIMIT 1",[owner.id,entryId]);
   if(found.length)return sendJson(res,200,{ok:true,id:found[0].id,status:found[0].status,duplicate:true});
   const id=crypto.randomUUID();
   await sql.query("INSERT INTO pasture_commons_v1 (id,owner_id,kind,entry_id,audio_id,scripture_reference,translation,voice,public_text,audio_data,audio_mime,audio_size,consent_version) VALUES ($1,$2,'reading',$3,$4,$5,$6,$7,'',decode($8,'base64'),$9,$10,'v1')",[id,owner.id,entryId,journey.audioId,journey.reference,translation,mode,encoded?encoded.buffer.toString('base64'):'',encoded?encoded.mime:null,encoded?encoded.size:null]);
   return sendJson(res,200,{ok:true,id,status:'PUBLISHED',kind:'reading'});
  }
  if(action==='publish-insight'){
   if(body.publishConsent!==true||body.consentVersion!=='v1')return fail(res,400,'publish_consent_required');
   const insight=body.insight||{},audioId=String(insight.reading_record_id||'');
   const receipt=await receiptFor(sql,owner.id,body.receiptId,audioId);
   if(!receipt||receipt.reference!==insight.scripture_range)return fail(res,403,'recording_receipt_required');
   const entryId=String(body.entryId||'');
   if(!entryId||entryId.length>120)return fail(res,400,'invalid_entry');
   const share=fellowship.buildAnonymousShare({ownerId:owner.id,insight,recordingReceipt:{ownerId:owner.id,audioId,status:'completed',size:receipt.bytes},shareText:body.shareText,explicitConsent:true,consentVersion:'v1'});
   const found=await sql.query("SELECT id,status FROM pasture_commons_v1 WHERE owner_id=$1 AND kind='insight' AND entry_id=$2 LIMIT 1",[owner.id,entryId]);
   if(found.length)return sendJson(res,200,{ok:true,id:found[0].id,status:found[0].status,duplicate:true});
   const id=crypto.randomUUID();
   await sql.query("INSERT INTO pasture_commons_v1 (id,owner_id,kind,entry_id,audio_id,scripture_reference,translation,voice,public_text,consent_version) VALUES ($1,$2,'insight',$3,$4,$5,$6,'NONE',$7,'v1')",[id,owner.id,entryId,audioId,share.scriptureReference,String(insight.translation||'').slice(0,64),share.publicText]);
   return sendJson(res,200,{ok:true,id,status:'PUBLISHED',kind:'insight'});
  }
  if(action==='withdraw'){
   if(!policy.validId(body.id))return fail(res,400,'invalid_publication');
   const rows=await sql.query("UPDATE pasture_commons_v1 SET status='WITHDRAWN',withdrawn_at=now(),audio_data=NULL,public_text='' WHERE id=$1 AND owner_id=$2 AND status='PUBLISHED' RETURNING id",[body.id,owner.id]);
   return rows.length?sendJson(res,200,{ok:true,withdrawn:true}):fail(res,404,'not_found_or_withdrawn');
  }
  return fail(res,400,'unknown_action');
 }catch(e){
  if(/^(?:invalid_|unsupported_|completed_|audio_|public_|approved_|explicit_|saved_|possible_|scripture_|recording_)/.test(String(e.message||'')))return fail(res,400,String(e.message));
  console.error('pasture-commons',String(e.code||'service_error'));
  return fail(res,503,'commons_unavailable');
 }
}
module.exports=handle;
module.exports._test={enabled,bodyOf,kindRow};