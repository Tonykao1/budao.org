'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'../pasture-preview');
const src=fs.readFileSync(path.join(base,'my-grass-v1.js'),'utf8');
const css=fs.readFileSync(path.join(base,'my-grass-immersive-v04.css'),'utf8');
function section(start,end){
 const a=src.indexOf(start),b=src.indexOf(end,a);
 assert.ok(a>=0&&b>a,'expected section: '+start);
 return src.slice(a,b);
}
test('EQ has real three-band gain controls and its own bypass',()=>{
 const stage=section('function stageReading(){','const LIGHTS=Object.freeze(');
 assert.match(stage,/data-action="dsp-eq"/);
 assert.match(stage,/data-dsp-eq-band/);
 assert.match(stage,/aria-pressed/);
 assert.match(stage,/['low','mid','high']/);
 assert.match(stage,/min="-12" max="12"/);
 assert.match(css,/\.gs-dsp-eq\[data-enabled="true"\]/);
 assert.match(css,/\.gs-eq-dial/);
 assert.doesNotMatch(stage,/<select[^>]*data-dsp/);
});
test('EQ builds one media-element source with sequential shelving and peaking filters',()=>{
 const effect=section('function releaseDenoiseMonitor(){','function clearPlayer(){');
 assert.match(effect,/low.type='lowshelf';low.frequency.value=180/);
 assert.match(effect,/mid.type='peaking';mid.frequency.value=1800;mid.Q.value=.9/);
 assert.match(effect,/high.type='highshelf';high.frequency.value=6000/);
 assert.match(effect,/source.connect\(cleanFeed\);cleanFeed.connect\(low\);low.connect\(mid\);mid.connect\(high\)/);
 assert.match(effect,/high.connect\(wet\)/);
 assert.match(effect,/wet.connect\(compBypass\);compBypass.connect\(context.destination\)/);
 assert.match(effect,/wet.connect\(compressor\);compressor.connect\(compWet\);compWet.connect\(context.destination\)/);
 assert.match(effect,/noiseFeed.connect\(m.low\)/);
 assert.equal((effect.match(/createMediaElementSource\(player\)/g)||[]).length,1);
 assert.doesNotMatch(effect,/new Blob|putAudio\(|writeJson\(|downloadBlob\(|MediaRecorder\(/);
 assert.match(src,/case 'dsp-eq':await toggleEqPreview\(\);break/);
 assert.match(src,/if\(denoiseEnabled\|\|eqEnabled\|\|compEnabled\|\|reverbEnabled\)await connectDspMonitor\(player\)/);
});
test('EQ routing follows bypass, DENOISE+EQ, and EQ-only listening in real parameter state',()=>{
 const makeParam=()=>{
  const history=[];
  return {history,setTargetAtTime(value,time,constant){history.push({value,time,constant})}};
 };
 const makeGain=()=>({gain:makeParam()});
 const m={
  context:{currentTime:12},source:{},dry:makeGain(),wet:makeGain(),
  cleanFeed:makeGain(),noiseFeed:makeGain(),
  effect:{port:{postMessage(message){m.message=message}}},
  low:makeGain(),mid:makeGain(),high:makeGain()
 };
 const state={
  denoiseMonitor:m,denoiseEnabled:false,eqEnabled:true,compEnabled:false,reverbEnabled:false,
  denoiseStrength:45,eqBands:{low:3,mid:-4,high:2}
 };
 const script=section('function applyDspSettings(){','function applyDenoiseSetting(){')+'; applyDspSettings()';
 const latest=p=>p.history.at(-1).value;
 vm.runInNewContext(script,state);
 assert.equal(latest(m.dry.gain),0);
 assert.equal(latest(m.wet.gain),1);
 assert.equal(latest(m.cleanFeed.gain),1);
 assert.equal(latest(m.noiseFeed.gain),0);
 assert.equal(latest(m.low.gain),3);
 assert.equal(latest(m.mid.gain),-4);
 assert.equal(latest(m.high.gain),2);
 state.denoiseEnabled=true;
 vm.runInNewContext(script,state);
 assert.equal(latest(m.cleanFeed.gain),0);
 assert.equal(latest(m.noiseFeed.gain),1);
 assert.equal(m.message.strength,45);
 state.denoiseEnabled=false;state.eqEnabled=false;
 vm.runInNewContext(script,state);
 assert.equal(latest(m.dry.gain),1);
 assert.equal(latest(m.wet.gain),0);
 assert.equal(latest(m.low.gain),0);
 assert.equal(latest(m.mid.gain),0);
 assert.equal(latest(m.high.gain),0);
});
test('the original audio remains untouched and EQ does not depend on worklet support',()=>{
 const effect=section('function releaseDenoiseMonitor(){','function clearPlayer(){');
 assert.match(effect,/if\(denoiseEnabled\)await loadDenoiseWorklet\(m,request,owner,audioId\)/);
 assert.match(effect,/if\(!denoiseEnabled\|\|!m\|\|m.effect\)/);
 assert.match(effect,/denoiseEnabled=false;updateDenoiseControls\(\);applyDspSettings\(\)/);
 assert.match(effect,/source.connect\(dry\);dry.connect\(context.destination\)/);
 assert.match(src,/eqEnabled=false;eqBands=\{low:0,mid:0,high:0\}/);
});
