'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const base=path.join(__dirname,'../pasture-preview');
const source=fs.readFileSync(path.join(base,'my-grass-v1.js'),'utf8');
const worklet=fs.readFileSync(path.join(base,'my-grass-denoise-worklet-v1.js'),'utf8');
const css=fs.readFileSync(path.join(base,'my-grass-immersive-v04.css'),'utf8');
function section(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.ok(a>=0&&b>a,'section found: '+start);
 return source.slice(a,b);
}
test('DENOISE is real adjustable monitoring control, while other modules remain inactive',()=>{
 const stage=section('function stageReading(){','const LIGHTS=Object.freeze(');
 assert.match(stage,/data-action="dsp-denoise"/);
 assert.match(stage,/data-dsp-denoise-strength/);
 assert.match(stage,/aria-pressed/);
 assert.match(stage,/gs-dsp-eq/);
 assert.match(stage,/data-action="dsp-reverb"/);
 assert.match(css,/gs-dsp-knob-face/);
 assert.match(css,/gs-dsp-denoise\[data-enabled="true"\]/);
});
test('processed monitoring does not render, export, store, or overwrite any processed blob',()=>{
 const effect=section('function releaseDenoiseMonitor(){','function clearPlayer(){');
 assert.match(effect,/createMediaElementSource\(player\)/);
 assert.match(effect,/audioWorklet\.addModule/);
 assert.match(effect,/createBiquadFilter/);
 assert.match(effect,/type='highpass'/);
 assert.match(effect,/dry\.gain\.setTargetAtTime/);
 assert.match(effect,/wet\.gain\.setTargetAtTime/);
 assert.doesNotMatch(effect,/putAudio\(|deleteAudio\(|saveEntry\(|downloadBlob\(|writeJson\(|fetch\(/);
 assert.match(source,/releaseDenoiseMonitor\(\);\s*if\(activePlayer\)/);
 assert.match(source,/case 'dsp-denoise':await toggleDenoisePreview\(\)/);
});
test('on browser capability error, denoise automatically fails open to original listening',()=>{
 const effect=section('function releaseDenoiseMonitor(){','function clearPlayer(){');
 assert.match(effect,/!m\.context\.audioWorklet\?\.addModule\|\|!window\.AudioWorkletNode/);
 assert.match(effect,/denoiseEnabled=false;updateDenoiseControls\(\)/);
 assert.match(effect,/source\.connect\(dry\);dry\.connect\(context\.destination\)/);
 assert.match(effect,/m\.source\.connect\(highpass\)/);
 assert.match(effect,/effect\.connect\(noiseFeed\);noiseFeed\.connect\(m\.low\)/);
});
test('worklet attenuates quiet noise yet passes speech in a real sample stream',()=>{
 let Klass=null,processorName='';
 const context={sampleRate:48000,AudioWorkletProcessor:class{constructor(){this.port={onmessage:null}}},registerProcessor(name,cls){processorName=name;Klass=cls},Math,Number,Float32Array};
 vm.runInNewContext(worklet,context);
 assert.equal(processorName,'my-grass-denoise-v1');
 const node=new Klass();
 node.port.onmessage({data:{type:'strength',strength:70}});
 function processValue(v,frames=160){
  let out;for(let i=0;i<frames;i++){
   const input=[new Float32Array(128).fill(v)];
   out=[new Float32Array(128)];
   assert.equal(node.process([input],[out]),true);
   assert.ok(Math.abs(input[0][0]-v)<1e-7,'input audio remains unchanged');
  }return out[0][63];
 }
 const quiet=processValue(.0005);
 const spoken=processValue(.12);
 assert.ok(Math.abs(quiet)<.0003,'low-level background reduced');
 assert.ok(spoken>.09,'speech largely preserved');
 assert.equal(processValue(0,50),0);
 node.port.onmessage({data:{type:'strength',strength:800}});
 assert.equal(node.strength,100);
});
