'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildAnonymousShare,anonymousView,identityUnlockDecision}=require('../api/_security/pasture-fellowship-domain');
const author='c2a7d6e4-7515-4dd9-ac09-818de1b37412';
const peer='fd4b54fe-7aa9-4c10-9853-54f410a873c2';
const stranger='fb31d4f4-17b6-4b3d-b8e6-84b563e1d191';
const shareId='ca64d982-7ced-45b9-98b3-1ca82174e518';
const audioId='audio-local-original';
const insight={insight_id:'insight-real',reading_record_id:audioId,scripture_range:'约 13:34–35'};
const recordingReceipt={ownerId:author,audioId,status:'completed',size:81234};
const params={ownerId:author,insight,recordingReceipt,shareText:'我愿意学习彼此相爱',explicitConsent:true,consentVersion:'v1'};
const published=buildAnonymousShare(params,{id:shareId,createdAt:'2026-10-28T12:00:00.000Z'});
const walk={
  eventId:'walk-2026-10-28',state:'COMPLETED',proof:'VERIFIED_COWALK',
  verifiedAt:'2026-10-28T14:00:00.000Z',
  attendances:[
    {eventId:'walk-2026-10-28',residentId:author,status:'VERIFIED',verifiedAt:'2026-10-28T14:00:00.000Z'},
    {eventId:'walk-2026-10-28',residentId:peer,status:'VERIFIED',verifiedAt:'2026-10-28T14:00:00.000Z'}
  ]
};
function approval(a,b,date='2026-10-28T14:01:00.000Z'){
  return {residentId:a,peerId:b,shareId,eventId:walk.eventId,action:'REVEAL_IDENTITY',decision:'APPROVED',approvedAt:date};
}
const both=[approval(author,peer),approval(peer,author)];
function evaluate(options={}){
 return identityUnlockDecision({share:published,viewerId:peer,walkEvidence:walk,consents:both,blocks:[],...options});
}
test('cross-regional anonymous sharing requires a real saved insight and completed recording',()=>{
 assert.equal(published.status,'PUBLISHED_ANONYMOUS');
 assert.equal(published.readingRecordId,audioId);
 for(const bad of [
  {recordingReceipt:{...recordingReceipt,status:'recording'}},
  {recordingReceipt:{...recordingReceipt,size:0}},
  {recordingReceipt:{...recordingReceipt,audioId:'other'}},
  {recordingReceipt:{...recordingReceipt,ownerId:peer}},
  {insight:{...insight,reading_record_id:'another'}},
  {explicitConsent:false},
  {consentVersion:'old'}
 ]) assert.throws(()=>buildAnonymousShare({...params,...bad}),/required/);
});
test('silent recording is valid; do not infer faith, cognition or prayer from waveform',()=>{
 const s=buildAnonymousShare({...params,recordingReceipt:{...recordingReceipt,containsSpeech:false,silence:true}},{id:shareId});
 assert.equal(s.status,'PUBLISHED_ANONYMOUS');
});
test('public anonymous projection never contains identity, voice or private author state',()=>{
 const projection=anonymousView({...published,email:'secret@example.com',church:'private church',audioBlob:'secret voice',walkEventId:walk.eventId,location:'secret'});
 assert.deepEqual(Object.keys(projection).sort(),['id','identityState','scriptureReference','text']);
 assert.equal(projection.identityState,'ANONYMOUS');
 assert.equal(JSON.stringify(projection).includes(author),false);
 assert.equal(JSON.stringify(projection).includes(audioId),false);
 assert.equal(anonymousView({...published,status:'WITHDRAWN'}),null);
});
test('share needs explicit user-approved short text and rejects obvious contact metadata',()=>{
 for(const text of ['', 'x'.repeat(81),'contact me test@example.com','call +1 (415) 555-1212','https://mysite.example']){
  assert.throws(()=>buildAnonymousShare({...params,shareText:text}),/out_of_bounds|disclosure/);
 }
});
test('identity stays closed without a completed, server-verified co-walk',()=>{
 for(const evidence of [
  null,
  {...walk,state:'SCHEDULED'},
  {...walk,proof:'GPS_CHECKIN'},
  {...walk,attendances:[walk.attendances[0]]},
  {...walk,attendances:[walk.attendances[0],{...walk.attendances[1],status:'SELF_REPORTED'}]}
 ])assert.equal(evaluate({walkEvidence:evidence}).allowed,false);
 assert.equal(evaluate({viewerId:stranger}).allowed,false);
});
test('verified walk alone does not reveal: mutual post-walk consent is mandatory',()=>{
 assert.deepEqual(evaluate({consents:[]}),{allowed:false,reason:'mutual_postwalk_consent_missing'});
 assert.deepEqual(evaluate({consents:[approval(author,peer)]}),{allowed:false,reason:'mutual_postwalk_consent_missing'});
 assert.equal(evaluate({consents:[approval(author,peer,'2026-10-28T13:00:00.000Z'),approval(peer,author)]}).allowed,false);
 assert.equal(evaluate({consents:[approval(author,stranger),approval(peer,author)]}).allowed,false);
 assert.equal(evaluate({consents:[{...both[0],shareId:'another'},both[1]]}).allowed,false);
 assert.equal(evaluate({consents:[{...both[0],revokedAt:'2026-10-28T15:00:00.000Z'},both[1]]}).allowed,false);
});
test('only mutually consenting, co-walk-verified pair can unlock identity; block overrides',()=>{
 assert.deepEqual(evaluate(),{allowed:true,reason:'mutual_verified_cowalk'});
 assert.deepEqual(evaluate({blocks:[{from:peer,to:author}]}),{allowed:false,reason:'blocked'});
 assert.deepEqual(evaluate({share:{...published,status:'WITHDRAWN'}}),{allowed:false,reason:'share_unavailable'});
});
test('identity unlock cannot be inferred from the resource-giving 易彼益 system or a steps score',()=>{
 const decision=evaluate({walkEvidence:{...walk,proof:'EEBEE_HANDOVER',steps:88888}});
 assert.equal(decision.allowed,false);
});
