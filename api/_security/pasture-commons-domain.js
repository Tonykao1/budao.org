'use strict';
/* Public scripture-coordinate domain. No AI exegesis, no spiritual scores. */
const crypto=require('node:crypto');
const MAX_AUDIO_BYTES=2*1024*1024; // small Preview pilot; do not silently truncate longer passages
const MAX_TEXT_CHARS=80;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validId(s){return typeof s==='string'&&UUID.test(s)}
function reference(s){
 if(typeof s!=='string'||!s.trim()||s.length>96||/[\x00-\x1f<>]/.test(s))throw Error('invalid_scripture_reference');
 return s.trim();
}
function validAudio(mime,base64){
 const type=String(mime||'').toLowerCase().split(';')[0];
 if(!['audio/wav','audio/wave','audio/webm','audio/ogg','audio/mp4'].includes(type))throw Error('unsupported_audio');
 if(typeof base64!=='string'||!base64||base64.length>Math.ceil(MAX_AUDIO_BYTES/3)*4+16||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
    throw Error('invalid_audio_payload');
 const buffer=Buffer.from(base64,'base64');
 if(!buffer.length||buffer.length>MAX_AUDIO_BYTES||buffer.toString('base64')!==base64)throw Error('audio_too_large_or_invalid');
 const isWav=(type==='audio/wav'||type==='audio/wave')&&buffer.length>=44&&
   buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WAVE';
 const isWebm=type==='audio/webm'&&buffer.subarray(0,4).toString('hex')==='1a45dfa3';
 const isOgg=type==='audio/ogg'&&buffer.toString('ascii',0,4)==='OggS';
 const isMp4=type==='audio/mp4'&&buffer.toString('ascii',4,8)==='ftyp';
 if(!isWav&&!isWebm&&!isOgg&&!isMp4)throw Error('audio_signature_mismatch');
 return {buffer,mime:type,size:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex')};
}
// Public audio must be a clean, deterministic, mono PCM copy made by
// the publication renderer; never ship the user's raw private MediaRecorder blob.
function validPublicAudio(mime,base64,journeyMs){
 const item=validAudio(mime,base64),b=item.buffer;
 if(item.mime!=='audio/wav'||b.length<44||
    b.readUInt32LE(4)!==b.length-8||b.toString('ascii',12,16)!=='fmt '||
    b.readUInt32LE(16)!==16||b.readUInt16LE(20)!==1||
    b.readUInt16LE(22)!==1||b.readUInt32LE(24)!==16000||
    b.readUInt32LE(28)!==32000||b.readUInt16LE(32)!==2||
    b.readUInt16LE(34)!==16||b.toString('ascii',36,40)!=='data'||
    b.readUInt32LE(40)!==b.length-44||(b.length-44)%2!==0)
   throw Error('invalid_public_audio_format');
 const durationMs=(b.length-44)/32000*1000;
 const expected=Number(journeyMs);
 if(!Number.isFinite(expected)||expected<=0||Math.abs(durationMs-expected)>Math.max(1500,expected*.25))
   throw Error('public_audio_duration_mismatch');
 return item;
}
// The canonical time/verse sequence is bound into the private receipt.
// This does not imply speech recognition or verification of spiritual intent.
function journeyDigest(j){
 const v=verifyJourney(j);
 const segments=j.segments.map(s=>[s.verse,s.startMs,s.endMs]);
 return crypto.createHash('sha256').update(JSON.stringify([
  v.audioId,v.reference,v.durationMs,
  String(j.translation||''),Number(j.chapter),String(j.audio?.mode||'legacy-unknown'),segments
 ])).digest('hex');
}
function verifyJourney(j){
 if(!j||j.status!=='completed'||!j.audio?.audioId||!Array.isArray(j.segments)||!j.segments.length||j.segments.length>200)
  throw Error('completed_recording_required');
 const duration=Number(j.durationMs),start=Number(j.startVerse),end=Number(j.endVerse);
 if(!Number.isFinite(duration)||duration<=0||!Number.isInteger(start)||!Number.isInteger(end)||start<1||end<start||
    end-start+1!==j.segments.length||typeof j.audio.audioId!=='string'||j.audio.audioId.length>200)
  throw Error('invalid_journey');
 let t=0;
 for(let i=0;i<j.segments.length;i++){
  const v=j.segments[i];
  if(v.verse!==start+i||v.startMs!==t||!Number.isFinite(Number(v.endMs))||Number(v.endMs)<=t)
    throw Error('invalid_journey');
  t=v.endMs;
 }
 if(Math.abs(t-duration)>1)throw Error('invalid_journey');
 return {audioId:j.audio.audioId,reference:reference(j.reference),durationMs:duration};
}
function validateKind(kind){if(kind!=='reading'&&kind!=='insight')throw Error('invalid_kind');return kind}
function publicView(row){
 if(!row||row.status!=='PUBLISHED')return null;
 if(row.kind==='reading')return Object.freeze({
   id:row.id,kind:'reading',scriptureReference:row.scriptureReference,
   translation:row.translation,voice:row.voice==='SILENT'?'SILENT':'SPOKEN',
   audioUrl:row.voice==='SPOKEN'?'/api/pasture-commons?audio='+encodeURIComponent(row.id):null,
   identityState:row.voice==='SPOKEN'?'AUTHOR_HIDDEN_VOICE_RECOGNIZABLE':'AUTHOR_HIDDEN'
 });
 if(row.kind==='insight')return Object.freeze({
   id:row.id,kind:'insight',scriptureReference:row.scriptureReference,
   text:row.publicText,identityState:'ANONYMOUS'
 });
 return null;
}
module.exports={MAX_AUDIO_BYTES,MAX_TEXT_CHARS,validId,reference,validAudio,validPublicAudio,verifyJourney,journeyDigest,validateKind,publicView};