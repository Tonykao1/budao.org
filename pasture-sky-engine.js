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

  function validLatLon(latitude,longitude){
    return Number.isFinite(latitude)&&Number.isFinite(longitude)&&latitude>=-90&&latitude<=90&&longitude>=-180&&longitude<=180;
  }

  function initialBearingDegrees(lat1,lon1,lat2,lon2){
    if(![lat1,lon1,lat2,lon2].every(Number.isFinite))return NaN;
    const p1=lat1*DEG,p2=lat2*DEG,dl=(lon2-lon1)*DEG;
    const y=Math.sin(dl)*Math.cos(p2);
    const x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
    return normDeg(Math.atan2(y,x)*RAD);
  }

  function daysSinceJ2000(timeMs){return (Number(timeMs)-J2000)/DAY;}
  function obliquity(d){return (23.4397-3.6e-7*d)*DEG;}
  function rightAscension(l,b,e){return Math.atan2(Math.sin(l)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(l));}
  function declination(l,b,e){return Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(l));}
  function siderealTime(d,longitude){return (280.16+360.9856235*d+longitude)*DEG;}

  function equatorialToHorizontal({ra,dec,timeMs,latitude,longitude}){
    if(!Number.isFinite(ra)||!Number.isFinite(dec)||!Number.isFinite(timeMs)||!validLatLon(latitude,longitude))return{altitudeDeg:NaN,azimuthDeg:NaN};
    const d=daysSinceJ2000(timeMs),phi=latitude*DEG,theta=siderealTime(d,longitude);
    const H=normRad(theta-ra);
    const altitude=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));
    const azimuth=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi))+Math.PI;
    return{altitudeDeg:altitude*RAD,azimuthDeg:normDeg(azimuth*RAD),hourAngle:H};
  }

  function sunEquatorial(timeMs){
    const d=daysSinceJ2000(timeMs),e=obliquity(d);
    const M=(357.5291+0.98560028*d)*DEG;
    const L=M+(1.9148*Math.sin(M)+0.02*Math.sin(2*M)+0.0003*Math.sin(3*M))*DEG+102.9372*DEG+Math.PI;
    return{ra:rightAscension(L,0,e),dec:declination(L,0,e),longitude:L};
  }

  function sunEphemeris({timeMs,latitude,longitude}){
    const eq=sunEquatorial(timeMs),h=equatorialToHorizontal({ra:eq.ra,dec:eq.dec,timeMs,latitude,longitude});
    return{...h,ra:eq.ra,dec:eq.dec};
  }

  function moonEquatorial(timeMs){
    const d=daysSinceJ2000(timeMs),e=obliquity(d);
    const L=(218.316+13.176396*d)*DEG;
    const M=(134.963+13.064993*d)*DEG;
    const F=(93.272+13.229350*d)*DEG;
    const lon=L+6.289*DEG*Math.sin(M),lat=5.128*DEG*Math.sin(F);
    return{ra:rightAscension(lon,lat,e),dec:declination(lon,lat,e),longitude:lon,latitude:lat};
  }

  function unitVector(ra,dec){return[Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)];}
  function dot(a,b){return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];}
  function cross(a,b){return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
  function normalize(a){const n=Math.hypot(...a)||1;return a.map(v=>v/n);}
  function subProjection(a,b){const k=dot(a,b);return[a[0]-k*b[0],a[1]-k*b[1],a[2]-k*b[2]];}

  function moonEphemeris({timeMs,latitude,longitude}){
    if(!Number.isFinite(timeMs)||!validLatLon(latitude,longitude))return{altitudeDeg:NaN,azimuthDeg:NaN,ra:NaN,dec:NaN,phase:NaN,illumination:NaN,lightX:NaN,lightY:NaN};
    const d=daysSinceJ2000(timeMs),moon=moonEquatorial(timeMs),sun=sunEquatorial(timeMs);
    const h=equatorialToHorizontal({ra:moon.ra,dec:moon.dec,timeMs,latitude,longitude});
    const moonVec=unitVector(moon.ra,moon.dec),sunVec=unitVector(sun.ra,sun.dec);
    const elongation=Math.acos(clamp(dot(moonVec,sunVec),-1,1));
    const illumination=(1-Math.cos(elongation))/2;
    const phase=((moon.longitude-sun.longitude)/(Math.PI*2)%1+1)%1;
    const phi=latitude*DEG,theta=siderealTime(d,longitude);
    const zenith=[Math.cos(phi)*Math.cos(theta),Math.cos(phi)*Math.sin(theta),Math.sin(phi)];
    const bright=normalize(subProjection(sunVec,moonVec));
    const up=normalize(subProjection(zenith,moonVec));
    const right=normalize(cross(moonVec,up));
    return{...h,ra:moon.ra,dec:moon.dec,phase,illumination,lightX:dot(bright,right),lightY:-dot(bright,up)};
  }

  function computeStarHorizontals({timeMs,latitude,longitude,stars}){
    if(!Array.isArray(stars))return[];
    return stars.map(star=>Object.assign({},star,equatorialToHorizontal({ra:star.ra,dec:star.dec,timeMs,latitude,longitude})));
  }

  function projectHorizontal({altitudeDeg,azimuthDeg,centerAzimuthDeg,width,skyTop,skyBottom}){
    if(![altitudeDeg,azimuthDeg,centerAzimuthDeg,width,skyTop,skyBottom].every(Number.isFinite)||width<=0||skyBottom<=skyTop||altitudeDeg<=0||altitudeDeg>90)return null;
    const rel=wrapDeg(azimuthDeg-centerAzimuthDeg);
    if(Math.abs(rel)>90)return null;
    const u=rel/90;
    const k=.45;
    const compressed=Math.tanh(k*u)/Math.tanh(k);
    const x=width*(.5+.5*compressed);
    const y=skyBottom-(altitudeDeg/90)*(skyBottom-skyTop);
    if(!Number.isFinite(x)||!Number.isFinite(y)||y>=skyBottom||y<skyTop-1e-9)return null;
    return{x,y,relativeAzimuthDeg:rel};
  }

  return{JERUSALEM,initialBearingDegrees,equatorialToHorizontal,sunEphemeris,moonEphemeris,computeStarHorizontals,projectHorizontal,wrapDeg,normDeg};
});
