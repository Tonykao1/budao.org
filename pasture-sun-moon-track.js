(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BudaoPastureTrack=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));

  // Screen-space Sun/Moon movement is a deliberate, scenic convention.
  // Astronomy remains authoritative for stars and for the Moon's illuminated face.
  function segmentAt(now,astronomy){
    if(!Number.isFinite(now)||!astronomy)return null;
    const rise=Number(astronomy.sunriseToday),set=Number(astronomy.sunsetToday);
    if(!(rise>0&&set>rise))return null;
    if(now>=rise&&now<set){
      return{body:'sun',progress:clamp((now-rise)/(set-rise),0,1),startMs:rise,endMs:set};
    }
    const start=now<rise?Number(astronomy.sunsetYesterday):set;
    const end=now<rise?rise:Number(astronomy.sunriseTomorrow);
    if(!(start>0&&end>start&&now>=start&&now<end))return null;
    return{body:'moon',progress:clamp((now-start)/(end-start),0,1),startMs:start,endMs:end};
  }

  // The disc starts at the extreme left, crosses the sky in one arch,
  // and sinks at the extreme right. Canvas clipping supplies the horizon.
  function positionAt({progress,width,skyBottom,radiusPx}){
    if(![progress,width,skyBottom,radiusPx].every(Number.isFinite)||
       width<=0||skyBottom<=0||radiusPx<0)return null;
    const p=clamp(progress,0,1);
    return{
      x:-radiusPx+(width+2*radiusPx)*p,
      y:skyBottom-radiusPx/2-skyBottom*.68*Math.sin(Math.PI*p)
    };
  }

  return{segmentAt,positionAt};
});
