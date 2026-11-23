/* My Grass: produce an opt-in 16 kHz mono 16-bit WAV publication copy.
 * Recording master remains unchanged in IndexedDB.
 * Short-clip pilot; large passages require future dedicated object storage/codec.
 */
(function(root,factory){
 'use strict';
 if(typeof module==='object'&&module.exports)module.exports=factory();
 else root.MyGrassAudioRender=factory();
})(typeof window!=='undefined'?window:this,function(){
 'use strict';
 const RATE=16000,MAX_BYTES=2*1024*1024;
 const range=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(n))?Number(n):min));
 function wavPcm16(samples,sampleRate=RATE){
  if(!(samples instanceof Float32Array)||samples.length*2+44>MAX_BYTES)throw Error('处理后音频超过试验站2MB限制，请缩短读经段落；原声未受影响。');
  const bytes=new ArrayBuffer(44+samples.length*2),v=new DataView(bytes);
  function tag(pos,text){for(let i=0;i<text.length;i++)v.setUint8(pos+i,text.charCodeAt(i))}
  tag(0,'RIFF');v.setUint32(4,36+samples.length*2,true);tag(8,'WAVE');tag(12,'fmt ');
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
  v.setUint32(24,sampleRate,true);v.setUint32(28,sampleRate*2,true);
  v.setUint16(32,2,true);v.setUint16(34,16,true);tag(36,'data');v.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const s=range(samples[i],-1,1);v.setInt16(44+i*2,s<0?s*32768:s*32767,true)}
  return new Blob([bytes],{type:'audio/wav'});
 }
 function makeDenoised(audio,ctx,strength){
  const length=audio.length,chan=audio.numberOfChannels;
  const buffer=ctx.createBuffer(1,length,audio.sampleRate),out=buffer.getChannelData(0);
  const channels=Array.from({length:chan},(_,i)=>audio.getChannelData(i));
  let level=0,gate=1;
  const threshold=.001+range(strength,0,100)*.000055;
  for(let i=0;i<length;i++){
   let sum=0;for(const data of channels)sum+=data[i]||0;const sample=sum/chan;
   const abs=Math.abs(sample);
   level+=(abs-level)*(abs>level?.075:.008);
   const aim=level<threshold?(0.12+.5*(1-strength/100)):1;
   gate+=(aim-gate)*(aim>gate?.1:.002);
   out[i]=sample*gate;
  }
  return buffer;
 }
 function reverbImpulse(ctx,room){
  const seconds=.14+range(room,0,100)*.017;
  const length=Math.max(1,Math.floor(ctx.sampleRate*seconds));
  const buffer=ctx.createBuffer(1,length,ctx.sampleRate),values=buffer.getChannelData(0);
  let seed=19473;
  for(let i=0;i<length;i++){
   seed=(Math.imul(seed,1664525)+1013904223)|0;
   const noise=((seed>>>8)/16777216)*2-1;
   values[i]=noise*Math.pow(1-i/length,2.7)*.42;
  }
  return buffer;
 }
 async function render(blob,settings={},context=root){
  if(!(blob instanceof Blob)||!blob.size)throw Error('缺少本人原声');
  const AudioCtor=context.AudioContext||context.webkitAudioContext;
  const OfflineCtor=context.OfflineAudioContext||context.webkitOfflineAudioContext;
  if(!AudioCtor||!OfflineCtor)throw Error('此浏览器不支持离线音频处理；请保留原声，勿发表未生成的成品。');
  let decoder;
  try{
   decoder=new AudioCtor();
   const decoded=await decoder.decodeAudioData(await blob.arrayBuffer());
   if(decoded.duration<=0||Math.ceil(decoded.duration*RATE)*2+44>MAX_BYTES)
    throw Error('处理后音频超过试验站2MB限制；请缩短经文段落，不会上传原声。');
   const ctx=new OfflineCtor(1,Math.ceil(decoded.duration*RATE),RATE);
   const src=ctx.createBufferSource();
   src.buffer=settings.denoise?makeDenoised(decoded,ctx,settings.denoiseStrength):decoded;
   const eq=settings.eq||{},comp=settings.comp||{},rev=settings.reverb||{};
   let tail=src;
   for(const [type,frequency,gain] of [
     ['lowshelf',180,range(eq.low,-12,12)],
     ['peaking',1800,range(eq.mid,-12,12)],
     ['highshelf',6000,range(eq.high,-12,12)]
   ]){
    const node=ctx.createBiquadFilter();node.type=type;node.frequency.value=frequency;
    node.gain.value=settings.eqEnabled?gain:0;
    if(type==='peaking')node.Q.value=1;
    tail.connect(node);tail=node;
   }
   const compressor=ctx.createDynamicsCompressor();
   compressor.threshold.value=settings.compEnabled?range(comp.threshold,-48,0):0;
   compressor.ratio.value=settings.compEnabled?range(comp.ratio,1,8):1;
   compressor.knee.value=12;compressor.attack.value=.012;compressor.release.value=.2;
   tail.connect(compressor);tail=compressor;
   if(settings.reverbEnabled&&range(rev.mix,0,40)>0){
    const dry=ctx.createGain(),wet=ctx.createGain(),convolver=ctx.createConvolver();
    convolver.buffer=reverbImpulse(ctx,rev.room);
    const amount=range(rev.mix,0,40)/100;
    dry.gain.value=1-amount;wet.gain.value=amount;
    tail.connect(dry);tail.connect(convolver);convolver.connect(wet);
    dry.connect(ctx.destination);wet.connect(ctx.destination);
   }else tail.connect(ctx.destination);
   src.start(0);
   const pcm=await ctx.startRendering();
   return wavPcm16(pcm.getChannelData(0),RATE);
  }finally{
   if(decoder&&decoder.state!=='closed')await decoder.close().catch(()=>{});
  }
 }
 async function base64(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  let text='';
  for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode.apply(null,bytes.subarray(i,i+8192));
  return btoa(text);
 }
 return {MAX_BYTES,RATE,wavPcm16,render,base64};
});