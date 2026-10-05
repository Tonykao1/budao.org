(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BudaoPastureSky=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  const DEG=Math.PI/180, RAD=180/Math.PI, DAY=86400000;
  const J2000=Date.UTC(2000,0,1,12);
  const JERUSALEM={latitude:31.77,longitude:35.21};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const normDeg=d=>((d%360)+360)%360;
  const wrapDeg=d=>((d+180)%360+360)%360-180;
  const normRad=r=>Math.atan2(Math.sin(r),Math.cos(r));

  function validLatLon(latitude,longitude){return Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180;}
  function initialBearingDegrees(lat1,lon1,lat2,lon2){if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return NaN;const p1=lat1*DEG,p2=lat2*DEG,dl=(lon2-lon1)*DEG;const y=Math.sin(dl)*Math.cos(p2);const x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);return normDeg(Math.atan2(y,x)*RAD);}
  function daysSinceJ2000(timeMs){return (Number(timeMs)-J2000)/DAY;}
  function obliquity(d){return (23.4397-3.6e-7*d)*DEG;}
  function rightAscension(l,b,e){return Math.atan2(Math.sin(l)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(l));}
  function declination(l,b,e){return Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(l));}
  function siderealTime(d,longitude){return (280.16+360.9856235*d+longitude)*DEG;}

  function equatorialToHorizontal({ra,dec,timeMs,latitude,longitude}){if(!Number.isFinite(ra)||!Number.isFinite(dec)||!Number.isFinite(timeMs)||!validLatLon(latitude,longitude))return{altitudeDeg:NaN,azimuthDeg:NaN};const d=daysSinceJ2000(timeMs),phi=latitude*DEG,theta=siderealTime(d,longitude);const H=normRad(theta-ra);const altitude=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));const azimuth=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi))+Math.PI;return{altitudeDeg:altitude*RAD,azimuthDeg:normDeg(azimuth*RAD),hourAngle:H};}
  function sunEquatorial(timeMs){const d=daysSinceJ2000(timeMs),e=obliquity(d);const M=(357.5291+0.98560028*d)*DEG;const L=M+(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*Ms))*DEG+102.9372*DEG+Math.PI;return{ra:rightAscension(L,0,e),dec:declination(L,0,e),longitude:L};}
  function sunEphemeris({timeMs,latitude,longitude}){const eq=sunEquatorial(timeMs),h=equatorialToHorizontal({ra:eq.ra,dec:eq.dec,timeMs,latitude,longitude});return{...h,ra:eq.ra,dec:eq.dec};}
  function moonEquatorial(timeMs){const d=daysSinceJ2000(timeMs),e=obliquity(d);const L=(218.316+13.176396*d)*DEG;const M=(134.963+13.064993*d)*DEG;const F=(93.272+13.229350*d)*DEG;const lon=L+6.289*DEG*Math.sin(M),lat=5.128*DEG*Math.sin(F);return{ra:rightAscension(lon,lat,e),dec:declination(lon,lat,e),longitude:lon,latitude:lat};}
  function unitVector(ra,dec){return[Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)];}
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function normalize(a){const n=Math.hypot(...a)||1;return a.map(v=>v/n);}
  function subProjection(a,b){const k=dot(a,b);return[a[0]-k*b[0],a[1]-k*b[1],a[2]-k*b[2]];}
  function moonEphemeris({timeMs,latitude,longitude}){if(!Number.isFinite(timeMs)||!validLatLon(latitude,longitude))return{altitudeDeg:NaN,azimuthDeg:NaN,ra:NaN,dec:NaN,phase:NaN,illumination:NaN,lightX:NaN,lightY:NaN};const d=daysSinceJ2000(timeMs),moon=moonEquatorial(timeMs),sun=sunEquatorial(timeMs);const h=equatorialToHorizontal({ra:moon.ra,dec:moon.dec,timeMs,latitude,longitude});const moonVec=unitVector(moon.ra,moon.dec),sunVec=unitVector(sun.ra,sun.dec);const elongation=Math.acos(clamp(dot(moonVec,sunVec),-1,1));const illumination=(1-Math.cos(elongation))/2;const phase=((moon.longitude-sun.longitude)/(Math.PI*2)%1+1)%1;const phi=latitude*DEG,theta=siderealTime(d,longitude);const zenith=[Math.cos(phi)*Math.cos(theta),Math.cos(phi)*Math.sin(theta),Math.sin(phi)];const bright=normalize(subProjection(sunVec,moonVec));const up=normalize(subProjection(zenith,moonVec));const right=normalize(cross(moonVec,up));return{...h,ra:moon.ra,dec:moon.dec,phase,illumination,lightX:dot(bright,right),lightY:-dot(bright,up)};}
  function computeStarHorizontals({timeMs,latitude,longitude,stars}){if(!Array.isArray(stars))return[];return stars.map(star=>Object.assign({},star,equatorialToHorizontal({ra:star.ra,dec:star.dec,timeMs,latitude,longitude})));}
  function smoothstep(a,b,x){if(a===b)return x>=b?1:0;const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}
  function twilightFactor(sunAltitudeDeg,visualMagnitude){if(!Number.isFinite(sunAltitudeDeg)||!Number.isFinite(visualMagnitude))return 0;if(sunAltitudeDeg>-4)return 0;const m=visualMagnitude<=0?0:visualMagnitude<=1?1:visualMagnitude<=2?2:3;const starts=[-4,-6,-9,-12],ends=[-6,-9,-12,-15];if(sunAltitudeDeg<=ends[m])return 1;if(sunAltitudeDeg>=starts[m])return 0;return smoothstep(starts[m],ends[m],sunAltitudeDeg);}
  function atmosphericFactor(altitudeDeg){if(!Number.isFinite(altitudeDeg)||altitudeDeg<=0)return 0;if(altitudeDeg<5)return .12+.23*(altitudeDeg/5);if(altitudeDeg<12)return .35+.30*((altitudeDeg-5)/7);if(altitudeDeg<25)return .65+.35*((altitudeDeg-12)/13);return 1;}
  function angularSeparationDeg(alt1,az1,alt2,az2){const a1=alt1*DEG,a2=alt2*DEG,dz=wrapDeg(az1-az2)*DEG;return Math.acos(clamp(Math.sin(a1)*Math.sin(a2)+Math.cos(a1)*Math.cos(a2)*Math.cos(dz),-1,1))*RAD;}
  function moonlightFactor({visualMagnitude,starAltitudeDeg,starAzimuthDeg,moon}){if(!moon||!Number.isFinite(moon.altitudeDeg)||!Number.isFinite(moon.azimuthDeg)||!Number.isFinite(moon.illumination)||moon.altitudeDeg<=0||moon.illumination<=.02)return 1;const sep=angularSeparationDeg(starAltitudeDeg,starAzimuthDeg,moon.altitudeDeg,moon.azimuthDeg);const proximity=Math.exp(-sep/38);const moonHeight=smoothstep(0,25,moon.altitudeDeg);const faintness=clamp((visualMagnitude+.5)/3.5,.12,1);const suppression=.78*moon.illumination*moonHeight*proximity*faintness;return clamp(1-suppression,.08,1);}
  function effectiveCloudCover(cloudCover,weatherCode){let c=clamp(Number(cloudCover)||0,0,100),code=Number(weatherCode)||0;if(code===45||code===48)c=Math.max(c,92);else if((code>=51&&code<=67)||(code>=80&&code<=82)||(code>=95&&code<=99)||(code>=71&&code<=77)||(code>=85&&code<=86))c=Math.max(c,88);else if(code===3)c=Math.max(c,85);else if(code===2)c=Math.max(c,55);else if(code===1)c=Math.max(c,25);return c;}
  function cloudOpacityAt({xNorm,yNorm,cloudCover,weatherCode,timeMs}){const cover=effectiveCloudCover(cloudCover,weatherCode)/100;if(cover<=0)return 0;const x=Number(xNorm)||0,y=Number(yNorm)||0,t=(Number(timeMs)||0)/60000;const n=(Math.sin((x*7.1+t*.017)*Math.PI*2)+Math.sin((y*5.3-x*1.7+t*.011)*Math.PI*2)*.65+Math.sin(((x+y)*3.2-t*.007)*Math.PI*2)*.45)/2.1;const field=clamp(.5+.5*n,0,1);const shaped=Math.pow(field,1.35);return clamp(cover*(.08+.92*shaped),0,1);}
  function starVisibility({visualMagnitude,altitudeDeg,azimuthDeg,sunAltitudeDeg,moon,cloudOpacity}){if(!Number.isFinite(visualMagnitude)||visualMagnitude>3||altitudeDeg<=0)return 0;const intrinsic=clamp((3.6-visualMagnitude)/4.1,.12,1);const tw=twilightFactor(sunAltitudeDeg,visualMagnitude);const atm=atmosphericFactor(altitudeDeg);const ml=moonlightFactor({visualMagnitude,starAltitudeDeg:altitudeDeg,starAzimuthDeg:azimuthDeg,moon});const cloud=1-clamp(Number(cloudOpacity)||0,0,1);return clamp(intrinsic*tw*atm*ml*cloud,0,1);}
  function starTwinkle({visibility,altitudeDeg,visualMagnitude,timeMs,seed}){if(!(visibility>0))return 1;const nearHorizon=1-clamp((altitudeDeg-5)/55,0,1);const bright=1-clamp((visualMagnitude+1.5)/4.5,0,1);const amp=.008+.07*nearHorizon*(.45+.55*bright);const phase=(Number(seed)||0)*1.618+(Number(timeMs)||0)/530;return 1+Math.sin(phase)*amp;}
  function projectHorizontal({altitudeDeg,azimuthDeg,centerAzimuthDeg,width,skyTop,skyBottom}){if(![altitudeDeg,azimuthDeg,centerAzimuthDeg,width,skyTop,skyBottom].every(Number.isFinite)||width<=0||skyBottom<=skyTop||altitudeDeg<=0||altitudeDeg>90)return null;const rel=wrapDeg(azimuthDeg-centerAzimuthDeg);if(Math.abs(rel)>90)return null;const u=rel/90;const k=.45;const compressed=Math.tanh(k*u)/Math.tanh(k);const x=width*(.5+.5*compressed);const y=skyBottom-(altitudeDeg/90)*(skyBottom-skyTop);if(!Number.isFinite(x)||!Number.isFinite(y)||y>=skyBottom||y<skyTop-1e-9)return null;return{x,y,relativeAzimuthDeg:rel};}
  function meteorDelayMs(randomValue){const n=Number(randomValue),r=Number.isFinite(n)?clamp(n,0,1):.5;return(20+30*r)*60000;}
  function createMeteorEvent({triggerMs,random=Math.random}){const r=()=>clamp(Number(random())||0,0,1);const x0=.15+r()*.7,y0=.10+r()*.45,sign=r()<.5?-1:1,dx=.08+r()*.10,dy=.08+r()*.10,durationMs=400+r()*400;const x1=clamp(x0+sign*dx,.03,.97),y1=clamp(y0+dy,.05,.82);return{triggerMs:Number(triggerMs)||0,durationMs,x0,y0,x1,y1};}
  function meteorFrame(event,timeMs){if(!event)return null;const duration=Number(event.durationMs),start=Number(event.triggerMs),now=Number(timeMs);if(!(duration>0)||!Number.isFinite(start)||!Number.isFinite(now))return null;const t=(now-start)/duration;if(t<0||t>1)return null;const alpha=Math.sin(Math.PI*t);const x=event.x0+(event.x1-event.x0)*t,y=event.y0+(event.y1-event.y0)*t,tailT=Math.max(0,t-.24),tailX=event.x0+(event.x1-event.x0)*tailT,tailY=event.y0+(event.y1-event.y0)*tailT;return{x,y,tailX,tailY,alpha:clamp(alpha,0,1),progress:t};}
  function meteorVisibility({sunAltitudeDeg,cloudOpacity,moon}){if(!Number.isFinite(sunAltitudeDeg)||sunAltitudeDeg>-9)return 0;const cloud=1-.92*clamp(Number(cloudOpacity)||0,0,1);const moonHeight=moon&&Number.isFinite(moon.altitudeDeg)?smoothstep(0,25,moon.altitudeDeg):0;const illum=moon&&Number.isFinite(moon.illumination)?clamp(moon.illumination,0,1):0;return clamp(cloud*(1-.25*moonHeight*illum),0,1);}
  function computeSkyState({timeMs,latitude,longitude,cloudCover=0,weatherCode=0,stars=[]}){
    if(!Number.isFinite(timeMs)||!validLatLon(latitude,longitude))return null;
    const centerAzimuthDeg=initialBearingDegrees(latitude,longitude,JERUSALEM.latitude,JERUSALEM.longitude);
    if(!Number.isFinite(centerAzimuthDeg))return null;
    const sun=sunEphemeris({timeMs,latitude,longitude});
    const moon=moonEphemeris({timeMs,latitude,longitude});
    const starStates=computeStarHorizontals({timeMs,latitude,longitude,stars}).map((star,index)=>{
      const relativeAzimuthDeg=wrapDeg(star.azimuthDeg-centerAzimuthDeg);
      const xNorm=clamp((relativeAzimuthDeg+90)/180,0,1);
      const yNorm=clamp(1-star.altitudeDeg/90,0,1);
      const cloudOpacity=cloudOpacityAt({xNorm,yNorm,cloudCover,weatherCode,timeMs});
      const visibility=starVisibility({visualMagnitude:star.visualMagnitude,altitudeDeg:star.altitudeDeg,azimuthDeg:star.azimuthDeg,sunAltitudeDeg:sun.altitudeDeg,moon,cloudOpacity});
      const magnitudeClass=star.visualMagnitude<=0?0:star.visualMagnitude<=1?1:star.visualMagnitude<=2?2:3;
      return Object.assign({},star,{relativeAzimuthDeg,cloudOpacity,visibility,magnitudeClass,twinkleSeed:index+1});
    });
    return{timeMs,centerAzimuthDeg,sun,moon,stars:starStates};
  }
  return{JERUSALEM,initialBearingDegrees,equatorialToHorizontal,sunEphemeris,moonEphemeris,computeStarHorizontals,computeSkyState,twilightFactor,atmosphericFactor,moonlightFactor,cloudOpacityAt,starVisibility,starTwinkle,projectHorizontal,meteorDelayMs,createMeteorEvent,meteorFrame,meteorVisibility,wrapDeg,normDeg};
});

;(function(){
  if(typeof window==='undefined'||typeof document==='undefined'||window.top!==window)return;
  if(!document.getElementById('environmentLayer'))return;
  if(document.querySelector('script[data-pasture-resident-runtime]'))return;
  const script=document.createElement('script');
  script.src='/pasture-resident-runtime.js?v=20261005reg1';
  script.dataset.pastureResidentRuntime='1';
  script.defer=true;
  document.head.appendChild(script);
})();
