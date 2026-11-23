'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const c=require('../api/_security/pasture-commons-domain');
const render=require('../pasture-preview/my-grass-audio-render-v1');
const core=require('../pasture-preview/my-grass-core.js');
const endpoint=require('../api/_security/pasture-commons-handler');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const fixture={
 status:'completed',reference:'约 13:34–35',startVerse:34,endVerse:35,durationMs:22000,
 segments:[{verse:34,startMs:0,endMs:9000},{verse:35,startMs:9000,endMs:22000}],
 audio:{audioId:'resident:a001:voice-01'}
};
function wav(samples=new Float32Array([0,.5,-.5,1,-1])){return render.wavPcm16(samples)}
test('16 kHz DSP WAV publication copy is canonical, and the original sound is not mutated',async()=>{
 const data=wav();
 const bytes=Buffer.from(await data.arrayBuffer());
 assert.equal(data.type,'audio/wav');
 assert.equal(bytes.toString('ascii',0,4),'RIFF');
 assert.equal(bytes.toString('ascii',8,12),'WAVE');
 assert.equal(bytes.readUInt32LE(24),16000);
 assert.equal(bytes.readUInt16LE(22),1);
 const valid=c.validAudio(data.type,bytes.toString('base64'));
 assert.equal(valid.size,bytes.length);
 assert.match(valid.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(c.validPublicAudio(data.type,bytes.toString('base64'),.3125).buffer,bytes);
 assert.throws(()=>c.validPublicAudio(data.type,bytes.toString('base64'),60000),/duration_mismatch/);
 assert.throws(()=>c.validPublicAudio('audio/webm',Buffer.from([0x1a,0x45,0xdf,0xa3]).toString('base64'),1),/invalid_public_audio_format/);
 assert.throws(()=>render.wavPcm16(new Float32Array(c.MAX_AUDIO_BYTES/2)),/2MB/);
});
test('reject invalid payloads, spoofed audio MIME and unsafe scripture',()=>{
 const valid=Buffer.from(awaitableBytes(wav()));
 assert.throws(()=>c.validAudio('text/html',valid.toString('base64')),/unsupported/);
 assert.throws(()=>c.validAudio('audio/wav',Buffer.from('<script>').toString('base64')),/audio_signature/);
 assert.throws(()=>c.validAudio('audio/wav','not*base64'),/invalid/);
 assert.throws(()=>c.reference('<img>'),/invalid/);
 assert.throws(()=>c.reference(''),/invalid/);
});
function awaitableBytes(_blob){
 const samples=new Float32Array([0,.5,-.5,1,-1]);
 const bytes=Buffer.alloc(54);bytes.write('RIFF',0);bytes.writeUInt32LE(46,4);
 bytes.write('WAVE',8);bytes.write('fmt ',12);bytes.writeUInt32LE(16,16);
 bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(1,22);bytes.writeUInt32LE(16000,24);
 bytes.writeUInt32LE(32000,28);bytes.writeUInt16LE(2,32);bytes.writeUInt16LE(16,34);
 bytes.write('data',36);bytes.writeUInt32LE(10,40);return bytes;
}
test('completed journey must have contiguous accurate verse boundaries',()=>{
 assert.equal(c.verifyJourney(fixture).durationMs,22000);
 assert.match(c.journeyDigest(fixture),/^[a-f0-9]{64}$/);
 assert.notEqual(c.journeyDigest({...fixture,segments:[{...fixture.segments[0],endMs:11000},{...fixture.segments[1],startMs:11000}]}),c.journeyDigest(fixture));
 for(const bad of [
  {...fixture,status:'recording'},
  {...fixture,segments:[{...fixture.segments[0],startMs:2},fixture.segments[1]]},
  {...fixture,segments:[fixture.segments[0],{...fixture.segments[1],startMs:9100}]},
  {...fixture,segments:[fixture.segments[0]]},
  {...fixture,durationMs:100},
  {...fixture,audio:{audioId:''}}
 ])assert.throws(()=>c.verifyJourney(bad),/recording|required|invalid/);
});
test('public API never exposes resident identity, receipt hash, recordings or stable author alias',()=>{
 const row={
  id:'08c7e1a9-1db7-4e5c-81b6-fba6f8c0bac9',kind:'insight',status:'PUBLISHED',
  scriptureReference:'雅 1:22',publicText:'我愿意在生活中回应福音',
  audioId:'secret-voice',ownerId:'hidden-resident',email:'secret@example.com',church:'secret',
  userLocation:'location',recordingHash:'secret'
 };
 const view=c.publicView(row);
 assert.deepEqual(Object.keys(view).sort(),['id','identityState','kind','scriptureReference','text']);
 assert.equal(JSON.stringify(view).includes('secret'),false);
 const pubVoice=c.publicView({...row,kind:'reading',voice:'SPOKEN',translation:'圣经和合本（神版）'});
 assert.equal(pubVoice.audioUrl,'/api/pasture-commons?audio='+row.id);
 assert.equal(JSON.stringify(pubVoice).includes('ownerId'),false);
 assert.equal(pubVoice.identityState,'AUTHOR_HIDDEN_VOICE_RECOGNIZABLE');
 assert.equal(c.publicView({...row,kind:'reading',voice:'SILENT'}).identityState,'AUTHOR_HIDDEN');
 assert.equal(c.publicView({...row,status:'WITHDRAWN'}),null);
});
test('production and unprovisioned Preview fail closed, status reports disabled without a database',async()=>{
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'production',PASTURE_COMMONS_ENABLED:'true',DATABASE_URL:'dummy'}),false);
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'preview',PASTURE_COMMONS_ENABLED:'true',DATABASE_URL:'dummy'}),false);
 const identity='postgres://owner@ep-demo-pooler.region.neon.tech/neondb?sslmode=require';
 const isolated='postgres://owner@ep-other.region.neon.tech/public?sslmode=require';
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'preview',PASTURE_COMMONS_ENABLED:'true',DATABASE_URL:identity,PASTURE_COMMONS_DATABASE_URL:isolated}),true);
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'preview',PASTURE_COMMONS_ENABLED:'true',DATABASE_URL:identity,PASTURE_COMMONS_DATABASE_URL:identity}),false);
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'preview',PASTURE_COMMONS_ENABLED:'true',DATABASE_URL:identity,PASTURE_COMMONS_DATABASE_URL:'postgres://other@ep-demo.region.neon.tech/neondb'}),false);
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'preview',PASTURE_COMMONS_ENABLED:'true',DATABASE_URL:'invalid',PASTURE_COMMONS_DATABASE_URL:isolated}),false);
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'preview',DATABASE_URL:'dummy'}),false);
 let status,headers={},json;
 const res={setHeader(k,v){headers[k]=v},status(n){status=n;return this},json(o){json=o}};
 await endpoint({method:'GET',url:'/api/pasture-commons?mode=status',headers:{}},res);
 assert.equal(status,200);
 assert.equal(json.enabled,false);
 assert.equal(json.pilotAudioLimitBytes,2097152);
 assert.equal(headers['Cache-Control'],'no-store');
});
test('original remains separate from DSP publish copy; UI requires two conscious consents',()=>{
 const main=read('pasture-preview/my-grass-v1.js');
 const renderer=read('pasture-preview/my-grass-audio-render-v1.js');
 const zone=read('pasture-preview/function-zone.html');
 const commons=read('pasture-preview/commons.html');
 assert.match(zone,/my-grass-audio-render-v1.js/);
 assert.match(main,/data-action="keep-private"/);
 assert.match(main,/data-action="publish-reading"/);
 assert.match(main,/data-action="publish-reference"/);
 assert.match(main,/data-action="publish-insight"/);
 assert.match(main,/data-action="withdraw-reading"/);
 assert.match(main,/data-action="withdraw-insight"/);
 assert.match(main,/privateAudioVerificationConsent:true/);
 assert.match(main,/publishConsent:true/);
 assert.match(main,/await commonsAvailable\(\)/);
 assert.match(main,/MyGrassAudioRender.render/);
 assert.match(main,/mode:readingMode\(\)/);
 assert.match(main,/publicAudio=await window.MyGrassAudioRender.render/);
 assert.doesNotMatch(main,/publicAudio=dsp\?await/);
 assert.doesNotMatch(main,/publicAudio=voice/);
 assert.match(main,/void reconcilePublication\(\)/);
 assert.match(main,/mode=mine&entry=/);
 assert.match(main,/publicationVerifiedFor/);
 assert.match(main,/status:'WITHDRAWN'/);
 assert.match(main,/!localPublication\('reading'\)&&!localPublication\('insight'\)/);
 assert.match(main,/这份读经已有公开记录，不能改写已发表的原声/);
 assert.match(main,/action:'attest-recording',entryId:s.entryId/);
 assert.match(renderer,/return new Blob\(\[bytes\]/);
 assert.doesNotMatch(renderer,/putAudio|indexedDB|localStorage/);
 assert.doesNotMatch(commons,/innerHTML|document\.write\(/);
 assert.match(commons,/textContent=text/);
 assert.match(commons,/原声可能被认出/);
});
test('no server path auto-unlocks identities from content or public audio',()=>{
 const src=read('api/_security/pasture-commons-handler.js');
 assert.doesNotMatch(src,/identityUnlockDecision\(/);
 assert.doesNotMatch(src,/REVEAL_IDENTITY|VERIFIED_COWALK/);
 assert.match(src,/requireSameOrigin\(req\)/);
 assert.match(src,/residentFor\(req\)/);
 assert.match(src,/owner_id=\$2 AND status='PUBLISHED'/);
 assert.match(src,/privateAudioStored:false/);
 assert.match(src,/status='WITHDRAWN'/);
 assert.match(src,/cross_publication_identity_risk/);
 assert.match(src,/voice='SPOKEN' AND status='PUBLISHED'/);
 assert.match(src,/PASTURE_COMMONS_DATABASE_URL/);
 assert.doesNotMatch(src,/REFERENCES pasture_users/);
 assert.match(src,/UNIQUE\(owner_id,entry_id\)/);
 assert.match(src,/CREATE UNIQUE INDEX IF NOT EXISTS pasture_commons_entry_once_v1/);
 assert.match(src,/e\?\.code==='23505'/);
 assert.match(src,/mode'\)==='mine'/);
 assert.match(src,/owner_id=\$1 AND entry_id=\$2/);
 assert.match(src,/receipt\.entry_id!==entryId/);
 assert.match(src,/journey_digest/);
 assert.match(src,/policy\.validPublicAudio/);
 assert.match(src,/policy\.journeyDigest/);
 assert.match(src,/spoken_recording_mode_required/);
 assert.match(src,/AND entry_id=\$4 AND journey_digest=\$5 LIMIT 1/);
});
test('silent and spoken recording mode survives official journey archiving without fabricating mode for legacy audio',()=>{
 const point={book:'约',chapter:3,verse:16,verseId:'JHN.3.16',translation:'圣经和合本（神版）'};
 const base=core.startReadingJourney(point,'2026-11-23T08:00:00.000Z');
 const spoken=core.completeReadingJourney(base,5000,'2026-11-23T08:00:05.000Z',
  {audioId:'spoken-audio',mimeType:'audio/webm',size:5000,durationSeconds:5,mode:'spoken'});
 const silent=core.completeReadingJourney(base,5000,'2026-11-23T08:00:05.000Z',
  {audioId:'silent-audio',mimeType:'audio/webm',size:5000,durationSeconds:5,mode:'silent'});
 const legacy=core.completeReadingJourney(base,5000,'2026-11-23T08:00:05.000Z',
  {audioId:'old-audio',mimeType:'audio/webm',size:5000,durationSeconds:5});
 assert.equal(spoken.audio.mode,'spoken');
 assert.equal(silent.audio.mode,'silent');
 assert.equal(legacy.audio.mode,undefined);
 assert.notEqual(c.journeyDigest(spoken),c.journeyDigest({...spoken,audio:{...spoken.audio,mode:'silent'}}));
});
