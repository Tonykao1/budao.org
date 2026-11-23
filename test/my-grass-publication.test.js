'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const c=require('../api/_security/pasture-commons-domain');
const render=require('../pasture-preview/my-grass-audio-render-v1');
const endpoint=require('../api/pasture-commons');
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
 assert.equal(c.publicView({...row,status:'WITHDRAWN'}),null);
});
test('production and unprovisioned Preview fail closed, status reports disabled without a database',async()=>{
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'production',PASTURE_COMMONS_ENABLED:'true',DATABASE_URL:'dummy'}),false);
 assert.equal(endpoint._test.enabled({VERCEL_ENV:'preview',PASTURE_COMMONS_ENABLED:'true',DATABASE_URL:'dummy'}),true);
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
 assert.match(renderer,/return new Blob\(\[bytes\]/);
 assert.doesNotMatch(renderer,/putAudio|indexedDB|localStorage/);
 assert.doesNotMatch(commons,/innerHTML|document\.write\(/);
 assert.match(commons,/textContent=text/);
});
test('no server path auto-unlocks identities from content or public audio',()=>{
 const src=read('api/pasture-commons.js');
 assert.doesNotMatch(src,/identityUnlockDecision\(/);
 assert.doesNotMatch(src,/REVEAL_IDENTITY|VERIFIED_COWALK/);
 assert.match(src,/requireSameOrigin\(req\)/);
 assert.match(src,/residentFor\(req\)/);
 assert.match(src,/owner_id=\$2 AND status='PUBLISHED'/);
 assert.match(src,/privateAudioStored:false/);
 assert.match(src,/status='WITHDRAWN'/);
});