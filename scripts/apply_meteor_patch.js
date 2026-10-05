const fs=require('node:fs');

function replaceOnce(path,oldText,newText,label){
  let s=fs.readFileSync(path,'utf8');
  if(s.includes(newText))return;
  const parts=s.split(oldText);
  if(parts.length!==2)throw new Error(`${label}: expected one anchor, found ${parts.length-1}`);
  fs.writeFileSync(path,parts[0]+newText+parts[1]);
}

{
  const path='pasture-sky-engine.js';
  let s=fs.readFileSync(path,'utf8');
  const marker='  function computeSkyState({timeMs,latitude,longitude,cloudCover=0,weatherCode=0,stars=[]}){';
  const insert=`  function meteorDelayMs(randomValue){const n=Number(randomValue),r=Number.isFinite(n)?clamp(n,0,1):.5;return(20+30*r)*60000;}\n  function createMeteorEvent({triggerMs,random=Math.random}){const r=()=>clamp(Number(random())||0,0,1);const x0=.15+r()*.7,y0=.10+r()*.45,sign=r()<.5?-1:1,dx=.08+r()*.10,dy=.08+r()*.10,durationMs=400+r()*400;const x1=clamp(x0+sign*dx,.03,.97),y1=clamp(y0+dy,.05,.82);return{triggerMs:Number(triggerMs)||0,durationMs,x0,y0,x1,y1};}\n  function meteorFrame(event,timeMs){if(!event)return null;const duration=Number(event.durationMs),start=Number(event.triggerMs),now=Number(timeMs);if(!(duration>0)||!Number.isFinite(start)||!Number.isFinite(now))return null;const t=(now-start)/duration;if(t<0||t>1)return null;const alpha=Math.sin(Math.PI*t);const x=event.x0+(event.x1-event.x0)*t,y=event.y0+(event.y1-event.y0)*t,tailT=Math.max(0,t-.24),tailX=event.x0+(event.x1-event.x0)*tailT,tailY=event.y0+(event.y1-event.y0)*tailT;return{x,y,tailX,tailY,alpha:clamp(alpha,0,1),progress:t};}\n  function meteorVisibility({sunAltitudeDeg,cloudOpacity,moon}){if(!Number.isFinite(sunAltitudeDeg)||sunAltitudeDeg>-9)return 0;const cloud=1-.92*clamp(Number(cloudOpacity)||0,0,1);const moonHeight=moon&&Number.isFinite(moon.altitudeDeg)?smoothstep(0,25,moon.altitudeDeg):0;const illum=moon&&Number.isFinite(moon.illumination)?clamp(moon.illumination,0,1):0;return clamp(cloud*(1-.25*moonHeight*illum),0,1);}\n`;
  if(!s.includes('function meteorDelayMs(')){
    if(!s.includes(marker))throw new Error('sky engine marker missing');
    s=s.replace(marker,insert+marker);
  }
  const oldExport='return{JERUSALEM,initialBearingDegrees,equatorialToHorizontal,sunEphemeris,moonEphemeris,computeStarHorizontals,computeSkyState,twilightFactor,atmosphericFactor,moonlightFactor,cloudOpacityAt,starVisibility,starTwinkle,projectHorizontal,wrapDeg,normDeg};';
  const newExport='return{JERUSALEM,initialBearingDegrees,equatorialToHorizontal,sunEphemeris,moonEphemeris,computeStarHorizontals,computeSkyState,twilightFactor,atmosphericFactor,moonlightFactor,cloudOpacityAt,starVisibility,starTwinkle,projectHorizontal,meteorDelayMs,createMeteorEvent,meteorFrame,meteorVisibility,wrapDeg,normDeg};';
  if(!s.includes(newExport)){
    if(!s.includes(oldExport))throw new Error('sky export anchor missing');
    s=s.replace(oldExport,newExport);
  }
  fs.writeFileSync(path,s);
}

replaceOnce('tonglu.html',
`let state=null,skyState=null,tick=0;\nconst LANDSCAPE_SKY_BOTTOM=96;`,
`let state=null,skyState=null,tick=0;\nlet meteorNextAt=0,meteorEvent=null;\nconst LANDSCAPE_SKY_BOTTOM=96;`,
'landscape meteor state');

replaceOnce('tonglu.html',
`function refreshSkyState(){`,
`function updateMeteor(now){\n  const sky=window.BudaoPastureSky;\n  if(!sky||!skyState)return;\n  if(!meteorNextAt)meteorNextAt=now+sky.meteorDelayMs(Math.random());\n  if(!meteorEvent&&now>=meteorNextAt){\n    if(Number(skyState.sun?.altitudeDeg)<=-9){\n      meteorEvent=sky.createMeteorEvent({triggerMs:now,random:Math.random});\n      if(state){state.meteorEvent=meteorEvent;sendPortraitEnvironment()}\n    }\n    meteorNextAt=now+sky.meteorDelayMs(Math.random());\n  }\n  if(meteorEvent&&now>meteorEvent.triggerMs+meteorEvent.durationMs){\n    meteorEvent=null;\n    if(state&&state.meteorEvent){delete state.meteorEvent;sendPortraitEnvironment()}\n  }\n}\nfunction refreshSkyState(){`,
'landscape meteor scheduler');

replaceOnce('tonglu.html',
`  const moonXY=project(skyState.moon);`,
`  const mf=sky.meteorFrame(meteorEvent,now);\n  if(mf){\n    const cloudOpacity=sky.cloudOpacityAt({xNorm:mf.x,yNorm:mf.y,cloudCover:cloud,weatherCode:c.weatherCode,timeMs:now});\n    const visibility=sky.meteorVisibility({sunAltitudeDeg:skyState.sun.altitudeDeg,cloudOpacity,moon:skyState.moon});\n    const alpha=mf.alpha*visibility;\n    if(alpha>.02){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#f7fbff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mf.tailX*480,mf.tailY*LANDSCAPE_SKY_BOTTOM);ctx.lineTo(mf.x*480,mf.y*LANDSCAPE_SKY_BOTTOM);ctx.stroke();rect(mf.x*480,mf.y*LANDSCAPE_SKY_BOTTOM,1,1,'#ffffff');ctx.restore()}\n  }\n\n  const moonXY=project(skyState.moon);`,
'landscape meteor draw');

replaceOnce('tonglu.html',
`  const cloud=effectiveCloudCover();\n  drawCelestial(now,cloud,c);`,
`  const cloud=effectiveCloudCover();\n  updateMeteor(now);\n  drawCelestial(now,cloud,c);`,
'landscape meteor tick');

replaceOnce('tonglu-pasture-portrait.html',
` const moonXY=project(shared.moon);if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(shared.moon.phase)||0,shared.moon);`,
` const mf=sky.meteorFrame(state?.meteorEvent,now);\n if(mf){const cloudOpacity=sky.cloudOpacityAt({xNorm:mf.x,yNorm:mf.y,cloudCover:cloud,weatherCode:c.weatherCode,timeMs:now});const visibility=sky.meteorVisibility({sunAltitudeDeg:shared.sun.altitudeDeg,cloudOpacity,moon:shared.moon});const alpha=mf.alpha*visibility;if(alpha>.02){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='#f7fbff';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mf.tailX*W,mf.tailY*skyBottom);ctx.lineTo(mf.x*W,mf.y*skyBottom);ctx.stroke();rect(mf.x*W,mf.y*skyBottom,1,1,'#ffffff');ctx.restore()}}\n const moonXY=project(shared.moon);if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(shared.moon.phase)||0,shared.moon);`,
'portrait meteor draw');
