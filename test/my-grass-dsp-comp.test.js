'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-v1.js'),'utf8');
const style=fs.readFileSync(path.join(__dirname,'../pasture-preview/my-grass-immersive-v04.css'),'utf8');
function section(a,b){
 const start=source.indexOf(a),end=source.indexOf(b,start);
 assert.ok(start>=0&&end>start,'required section '+a);
 return source.slice(start,end);
}
test('COMP has tactile threshold and ratio sliders plus functional bypass',()=>{
 const stage=section('function stageReading(){','const LIGHTS=Object.freeze(');
 assert.match(stage,/gs-dsp-comp/);
 assert.match(stage,/data-dsp-comp-control="threshold"/);
 assert.match(stage,/data-dsp-comp-control="ratio"/);
 assert.match(stage,/min="-48" max="0"/);
 assert.match(stage,/min="1" max="8" step="0.5"/);
 assert.match(stage,/data-action="dsp-comp"/);
 assert.match(stage,/gsCompReduction/);
 assert.match(style,/\.gs-dsp-comp\[data-enabled="true"\]/);
 assert.match(style,/\.gs-comp-reduction-bar/);
 assert.doesNotMatch(stage,/data-action="dsp-reverb"/);
});
test('COMP uses real DynamicsCompressor with quiet speech-oriented time constants',()=>{
 const dsp=section('function releaseDenoiseMonitor(){','function clearPlayer(){');
 assert.match(dsp,/context\.createDynamicsCompressor\(\)/);
 assert.match(dsp,/compressor\.knee\.value=12/);
 assert.match(dsp,/compressor\.attack\.value=\.012/);
 assert.match(dsp,/compressor\.release\.value=\.20/);
 assert.match(dsp,/wet\.connect\(compBypass\);compBypass\.connect\(context\.destination\)/);
 assert.match(dsp,/wet\.connect\(compressor\);compressor\.connect\(compWet\);compWet\.connect\(context\.destination\)/);
 assert.match(dsp,/m\.compressor\.threshold\.setTargetAtTime\(compThreshold,now,\.012\)/);
 assert.match(dsp,/m\.compressor\.ratio\.setTargetAtTime\(compRatio,now,\.012\)/);
 assert.equal((dsp.match(/createMediaElementSource\(player\)/g)||[]).length,1);
 assert.doesNotMatch(dsp,/putAudio\(|new Blob\(|writeJson\(|MediaRecorder\(/);
});
test('COMP-only, EQ+COMP, DENOISE+EQ+COMP, and complete bypass route correctly',()=>{
 const param=()=>({history:[],setTargetAtTime(v,t,tc){this.history.push({v,t,tc})}});
 const gain=()=>({gain:param()});
 const m={
  context:{currentTime:17},source:{},
  dry:gain(),wet:gain(),cleanFeed:gain(),noiseFeed:gain(),
  low:gain(),mid:gain(),high:gain(),compBypass:gain(),compWet:gain(),
  compressor:{threshold:param(),ratio:param()},
  effect:{port:{postMessage(value){m.message=value}}}
 };
 const ctx={denoiseMonitor:m,denoiseEnabled:false,eqEnabled:false,compEnabled:true,
  denoiseStrength:35,eqBands:{low:5,mid:-3,high:2},compThreshold:-29,compRatio:3.5};
 const script=section('function applyDspSettings(){','function applyDenoiseSetting(){')+';applyDspSettings()';
 const val=p=>p.history.at(-1).v;
 vm.runInNewContext(script,ctx);
 assert.equal(val(m.dry.gain),0);
 assert.equal(val(m.wet.gain),1);
 assert.equal(val(m.cleanFeed.gain),1);
 assert.equal(val(m.noiseFeed.gain),0);
 assert.equal(val(m.low.gain),0);
 assert.equal(val(m.compBypass.gain),0);
 assert.equal(val(m.compWet.gain),1);
 assert.equal(val(m.compressor.threshold),-29);
 assert.equal(val(m.compressor.ratio),3.5);
 ctx.eqEnabled=true;vm.runInNewContext(script,ctx);
 assert.equal(val(m.low.gain),5);
 assert.equal(val(m.mid.gain),-3);
 assert.equal(val(m.high.gain),2);
 ctx.denoiseEnabled=true;vm.runInNewContext(script,ctx);
 assert.equal(val(m.cleanFeed.gain),0);
 assert.equal(val(m.noiseFeed.gain),1);
 ctx.denoiseEnabled=false;ctx.eqEnabled=false;ctx.compEnabled=false;
 vm.runInNewContext(script,ctx);
 assert.equal(val(m.dry.gain),1);
 assert.equal(val(m.wet.gain),0);
 assert.equal(val(m.compBypass.gain),1);
 assert.equal(val(m.compWet.gain),0);
});
test('COMP reduction uses actual browser processor reading rather than fabricated meters',()=>{
 const s=section('function updateCompReduction(player){','async function connectDenoiseMonitor(player)');
 assert.match(s,/m\?\.compressor\?\.reduction/);
 assert.match(s,/typeof reduction==='number'&&Number\.isFinite\(reduction\)/);
 assert.match(s,/player===activePlayer&&!player\.paused&&!player\.ended/);
 assert.doesNotMatch(s,/Math\.random|setInterval|fake|mock/);
 const output={textContent:''},bar={style:{width:''}};
 const player={paused:false,ended:false};
 const root={querySelector(q){return q==='#gsCompReduction'?output:bar}};
 const state={root,activePlayer:player,denoiseMonitor:{compressor:{reduction:-5.7}},compEnabled:true};
 vm.runInNewContext(s+';updateCompReduction(activePlayer)',state);
 assert.equal(output.textContent,'5.7 dB');
 assert.ok(Number.parseFloat(bar.style.width)>0);
 state.compEnabled=false;vm.runInNewContext(s+';updateCompReduction(activePlayer)',state);
 assert.equal(output.textContent,'— dB');
});
test('COMP playback, seeking and account switch keep original voice isolated',()=>{
 assert.match(source,/case 'dsp-comp':await toggleCompPreview\(\);break/);
 assert.match(source,/if\(denoiseEnabled\|\|eqEnabled\|\|compEnabled\)await connectDspMonitor\(player\)/);
 assert.match(source,/compEnabled=false;compThreshold=-24;compRatio=2\.5/);
 const graph=section('function releaseDenoiseMonitor(){','function clearPlayer(){');
 assert.doesNotMatch(graph,/downloadBlob|putAudio\(|deleteAudio\(|writeJson\(|saveEntry\(/);
});
