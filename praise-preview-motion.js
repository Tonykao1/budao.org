/* Score-clock motion; bounded pixel displacement. No changes to flock data. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function prepare(score,api){
 const secondsPerTick=score.tempo/(score.ticks*1e6);
 const cycle=api.cycleSeconds(score);
 if(!(cycle>0)||![2,4].includes(score.parts.length))throw Error('Invalid score');
 const voices=score.parts.map(p=>api.decodeVoice(p).map(n=>({start:n.tick*secondsPerTick,end:(n.tick+n.duration)*secondsPerTick,velocity:n.velocity/127,pitch:n.pitch})));
 return {cycle,voices,beat:score.ticks*secondsPerTick};
}
function noteAt(notes,t){
 let lo=0,hi=notes.length;
 while(lo<hi){let m=(lo+hi)>>1;if(notes[m].start<=t)lo=m+1;else hi=m;}
 return lo?notes[lo-1]:null;
}
function motion(model,elapsed,duration,x,y,id,rest,scale,night=false){
 if(!model||!Number.isFinite(elapsed)||elapsed<0||elapsed>=duration)return null;
 let t=elapsed%model.cycle;
 const zone=(x<.5?0:1)+(y<.73?0:2);
 const part=model.voices.length===2?zone%2:zone;
 const n=noteAt(model.voices[part],t);
 if(!n||t>=n.end)return {dx:0,dy:0};
 const age=t-n.start,span=n.end-n.start;
 const width=Math.min(span,Math.max(.16,Math.min(.55,model.beat*.8)));
 const p=clamp(age/width,0,1);
 const wave=Math.sin(Math.PI*p)*Math.min(1,span/.16);
 const phrase=Math.min(1,elapsed/.55,(duration-elapsed)/.55);
 const amp=wave*phrase*(night?.55:1)*(.7+n.velocity*.4);
 const sign=id%2===0?1:-1;
 const a=clamp(scale,0,2);
 const dx=rest?0:zone===0?0:zone===1?sign*amp*Math.min(1.6,a*2.2):zone===2?sign*amp*Math.min(2,a*2.7):0;
 const dy=-amp*(rest?Math.min(.65,a*.9):Math.min(1.7,a*2.6))*(zone===3?.75:1);
 return {dx,dy};
}
root.BudaoPraisePreview=Object.freeze({prepare,motion,noteAt});
})(window);