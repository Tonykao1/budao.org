'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-v1.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-immersive-v04.css'),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'section exists: '+start);
 return source.slice(a,b);
}
test('REVERB has ROOM, MIX and ON/OFF controls; four modules share one 2U rack',()=>{
 const stage=section('function stageReading(){','const LIGHTS=Object.freeze(');
 assert.match(stage,/data-action="dsp-reverb"/);
 assert.match(stage,/data-dsp-reverb-control="room"/);
 assert.match(stage,/data-dsp-reverb-control="mix"/);
 assert.match(stage,/min="0" max="40" step="2"/);
 assert.match(stage,/aria-pressed/);
 assert.match(stage,/gs-dsp-denoise/);assert.match(stage,/gs-dsp-eq/);
 assert.match(stage,/gs-dsp-comp/);assert.match(stage,/gs-dsp-reverb/);
 assert.match(style,/\.gs-dsp-reverb\[data-enabled="true"\]/);
 assert.match(style,/\.gs-reverb-dial/);
 assert.doesNotMatch(stage,/<select[^>]*data-dsp/);
});
test('deterministic voice-sized room impulse has stereo tails and bounded amplitude',()=>{
 const generator=section('function makeVoiceRoomImpulse(context,room){','function applyDenoiseSetting(){');
 const sampleRate=48000;
 const ctx={sampleRate,createBuffer(channels,length){
  const arrays=Array.from({length:channels},()=>new Float32Array(length));
  return {length,getChannelData(i){return arrays[i]},channels:arrays};
 }};
 const fn=vm.runInNewContext(generator+';makeVoiceRoomImpulse',{Math,Number});
 const small=fn(ctx,0),large=fn(ctx,100),defaultRoom=fn(ctx,40);
 assert.ok(small.length>=sampleRate*.22);
 assert.ok(large.length>=sampleRate*1.6);
 assert.ok(defaultRoom.length>small.length&&defaultRoom.length<large.length);
 assert.notDeepEqual([...defaultRoom.channels[0].slice(1000,1010)],[...defaultRoom.channels[1].slice(1000,1010)]);
 const amplitude=Math.max(...defaultRoom.channels[0].slice(0,500));
 assert.ok(amplitude<.5&&amplitude>0);
 const again=fn(ctx,40);
 assert.deepEqual(defaultRoom.channels[0].slice(1000,1010),again.channels[0].slice(1000,1010));
});
test('post-compressor convolver is parallel: direct voice always passes without room DSP',()=>{
 const dsp=section('function releaseDenoiseMonitor(){','function clearPlayer(){');
 assert.match(dsp,/context.createConvolver\(\)/);
 assert.match(dsp,/convolver.normalize=false/);
 assert.match(dsp,/convolver.buffer=makeVoiceRoomImpulse\(context,reverbRoom\)/);
 assert.match(dsp,/compOutput.connect\(reverbDry\);reverbDry.connect\(context.destination\)/);
 assert.match(dsp,/compOutput.connect\(convolver\);convolver.connect\(reverbLowpass\)/);
 assert.match(dsp,/reverbLowpass.connect\(reverbWet\);reverbWet.connect\(context.destination\)/);
 assert.match(dsp,/reverbLowpass.frequency.value=4200/);
 assert.equal((dsp.match(/createMediaElementSource\(player\)/g)||[]).length,1);
 assert.doesNotMatch(dsp,/new Blob\(|putAudio\(|deleteAudio\(|downloadBlob\(|writeJson\(|saveEntry\(/);
});
test('reverb-only route, all-four route, and full bypass change real gain parameters',()=>{
 const param=()=>({history:[],setTargetAtTime(value){this.history.push(value)}});
 const gain=()=>({gain:param()});
 const m={
  context:{currentTime:1},source:{},dry:gain(),wet:gain(),cleanFeed:gain(),noiseFeed:gain(),
  low:gain(),mid:gain(),high:gain(),compBypass:gain(),compWet:gain(),
  reverbDry:gain(),reverbWet:gain(),
  compressor:{threshold:param(),ratio:param()},
  effect:{port:{postMessage(value){m.message=value}}}
 };
 const state={
  denoiseMonitor:m,denoiseEnabled:false,eqEnabled:false,compEnabled:false,reverbEnabled:true,
  denoiseStrength:35,eqBands:{low:0,mid:0,high:0},compThreshold:-24,compRatio:2.5,reverbMix:18
 };
 const code=section('function applyDspSettings(){','function makeVoiceRoomImpulse(')+';applyDspSettings()';
 const last=x=>x.history.at(-1);
 vm.runInNewContext(code,state);
 assert.equal(last(m.dry.gain),0);assert.equal(last(m.wet.gain),1);
 assert.equal(last(m.cleanFeed.gain),1);assert.equal(last(m.compBypass.gain),1);
 assert.equal(last(m.reverbDry.gain),1);assert.equal(last(m.reverbWet.gain),.18);
 state.denoiseEnabled=true;state.eqEnabled=true;state.compEnabled=true;
 vm.runInNewContext(code,state);
 assert.equal(last(m.noiseFeed.gain),1);
 assert.equal(last(m.compWet.gain),1);
 assert.equal(last(m.reverbWet.gain),.18);
 state.denoiseEnabled=false;state.eqEnabled=false;state.compEnabled=false;state.reverbEnabled=false;
 vm.runInNewContext(code,state);
 assert.equal(last(m.dry.gain),1);assert.equal(last(m.wet.gain),0);
 assert.equal(last(m.reverbWet.gain),0);
});
test('room input only updates disposable audition buffer, account switch resets settings',()=>{
 const controls=section('  root.addEventListener(\'input\',e=>{\n   const control=e.target?.dataset?.dspReverbControl;','  root.addEventListener(\'click\',async e=>{');
 assert.match(controls,/m.convolver.buffer=makeVoiceRoomImpulse\(m.context,reverbRoom\)/);
 assert.match(controls,/applyDspSettings\(\)/);
 assert.match(source,/case 'dsp-reverb':await toggleReverbPreview\(\);break/);
 assert.match(source,/if\(denoiseEnabled\|\|eqEnabled\|\|compEnabled\|\|reverbEnabled\)await connectDspMonitor\(player\)/);
 assert.match(source,/reverbEnabled=false;reverbRoom=40;reverbMix=16/);
 assert.match(source,/releaseDenoiseMonitor\(\);\s*if\(activePlayer\)/);
});
