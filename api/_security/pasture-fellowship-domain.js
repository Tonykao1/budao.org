'use strict';

/*
 * Pasture Fellowship policy, server-side foundation only.
 * No route is wired to this module; it must NEVER be used with client-supplied
 * identity, recording receipts, attendance, or consent evidence.
 * No public endpoint or automated identity reveal exists in this phase.
 */
const crypto=require('node:crypto');
const MAX_PUBLIC_CHARS=80;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(x){return typeof x==='string'&&UUID.test(x)}
function hasPrivateIdentifiers(text){
  return /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\d\s().-]{7,}\d)|https?:\/\//i.test(text);
}
function buildAnonymousShare({
  ownerId,insight,recordingReceipt,shareText,explicitConsent,consentVersion
},options={}){
  // The caller must already have fetched and authorized this server-owned data.
  if(!isUuid(ownerId))throw Error('verified_resident_required');
  if(!insight?.insight_id||!insight?.reading_record_id)throw Error('saved_insight_required');
  if(recordingReceipt?.ownerId!==ownerId||recordingReceipt?.audioId!==insight.reading_record_id||
    recordingReceipt?.status!=='completed'||!Number.isFinite(Number(recordingReceipt?.size))||
    Number(recordingReceipt.size)<=0)throw Error('completed_recording_required');
  // Silence is valid. A waveform is never used as a measure of faith or reading.
  if(explicitConsent!==true||consentVersion!=='v1')throw Error('explicit_publication_consent_required');
  if(typeof shareText!=='string')throw Error('approved_text_required');
  const text=shareText.trim();
  if(!text||Array.from(text).length>MAX_PUBLIC_CHARS)throw Error('public_text_out_of_bounds');
  if(hasPrivateIdentifiers(text))throw Error('possible_identity_disclosure');
  const reference=String(insight.scripture_range||'').trim();
  if(!reference||reference.length>96)throw Error('scripture_reference_required');
  const id=(options.id||crypto.randomUUID());
  if(!isUuid(id))throw Error('invalid_share_id');
  const createdAt=options.createdAt||new Date().toISOString();
  return Object.freeze({
    id,ownerId,insightId:String(insight.insight_id),
    readingRecordId:String(insight.reading_record_id),
    status:'PUBLISHED_ANONYMOUS',explicitConsentAt:createdAt,
    consentVersion:'v1',createdAt,publicText:text,scriptureReference:reference
  });
}
function anonymousView(share){
  if(share?.status!=='PUBLISHED_ANONYMOUS')return null;
  // Deliberately exclude author ID, voice, location, account, church,
  // event ID, join dates, and any stable public author identifier.
  return Object.freeze({
    id:share.id,
    scriptureReference:share.scriptureReference,
    text:share.publicText,
    identityState:'ANONYMOUS'
  });
}
function identityUnlockDecision({share,viewerId,walkEvidence,consents,blocks}={}){
  // All inputs except viewerId MUST be authoritative server DB records.
  if(share?.status!=='PUBLISHED_ANONYMOUS')return {allowed:false,reason:'share_unavailable'};
  const ownerId=share.ownerId;
  if(!isUuid(ownerId)||!isUuid(viewerId)||ownerId===viewerId)
    return {allowed:false,reason:'invalid_pair'};
  const blocked=Array.isArray(blocks)&&blocks.some(b=>
    (b?.from===ownerId&&b.to===viewerId)||(b?.from===viewerId&&b.to===ownerId));
  if(blocked)return {allowed:false,reason:'blocked'};
  if(walkEvidence?.state!=='COMPLETED'||walkEvidence?.proof!=='VERIFIED_COWALK'||
    !walkEvidence?.eventId||!walkEvidence?.verifiedAt)
    return {allowed:false,reason:'walk_not_verified'};
  const attendances=walkEvidence.attendances;
  if(!Array.isArray(attendances)||![ownerId,viewerId].every(id=>
    attendances.some(a=>a?.residentId===id&&a.eventId===walkEvidence.eventId&&
      a.status==='VERIFIED'&&a.verifiedAt)))
    return {allowed:false,reason:'joint_attendance_unverified'};
  if(!Array.isArray(consents)||![ownerId,viewerId].every(id=>
    consents.some(c=>c?.residentId===id&&c.peerId===(id===ownerId?viewerId:ownerId)&&
      c.shareId===share.id&&c.eventId===walkEvidence.eventId&&c.action==='REVEAL_IDENTITY'&&
      c.decision==='APPROVED'&&!c.revokedAt&&c.approvedAt&&
      Date.parse(c.approvedAt)>=Date.parse(walkEvidence.verifiedAt))))
    return {allowed:false,reason:'mutual_postwalk_consent_missing'};
  return {allowed:true,reason:'mutual_verified_cowalk'};
}
module.exports={MAX_PUBLIC_CHARS,buildAnonymousShare,anonymousView,identityUnlockDecision};
