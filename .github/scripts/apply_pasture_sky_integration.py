from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 exact match, found {count}')
    return text.replace(old, new, 1)


def regex_once(text, pattern, replacement, label, flags=re.S):
    out, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 regex match, found {count}')
    return out


main_path = Path('tonglu.html')
main = main_path.read_text()

main = replace_once(
    main,
    '<canvas id="environmentLayer" width="480" height="300" aria-hidden="true"></canvas>\n<script>',
    '<canvas id="environmentLayer" width="480" height="300" aria-hidden="true"></canvas>\n<script src="/pasture-stars.js"></script>\n<script src="/pasture-sky-engine.js"></script>\n<script>',
    'main script tags',
)
main = replace_once(
    main,
    "portraitFrame.contentWindow.postMessage({type:'tonglu-environment-v1',state},location.origin);",
    "portraitFrame.contentWindow.postMessage({type:'tonglu-environment-v1',state:{...state,skyState}},location.origin);",
    'portrait shared state',
)
main = replace_once(
    main,
    'let state=null,tick=0;',
    'let state=null,skyState=null,tick=0;\nconst LANDSCAPE_SKY_BOTTOM=96;',
    'main sky state declaration',
)

main_shared = r'''function moon(cx,cy,phase,p){
  const r=8,a=phase*Math.PI*2,side=Math.abs(Math.sin(a)),lz=-Math.cos(a);
  const lx=side*(p?.lightX||0),ly=side*(p?.lightY||0);
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
    const nx=x/(r+.2),ny=y/(r+.2),rr=nx*nx+ny*ny;
    if(rr>1)continue;
    const nz=Math.sqrt(Math.max(0,1-rr));
    rect(cx+x,cy+y,1,1,(nx*lx+ny*ly+nz*lz)>0?'#fff1b8':'#52617b');
  }
}
function drawCelestial(now,cloud,c){
  const sky=window.BudaoPastureSky;
  if(!skyState||!sky)return;
  const project=o=>sky.projectHorizontal({
    altitudeDeg:o.altitudeDeg,azimuthDeg:o.azimuthDeg,centerAzimuthDeg:skyState.centerAzimuthDeg,
    width:480,skyTop:0,skyBottom:LANDSCAPE_SKY_BOTTOM
  });
  ctx.save();
  ctx.beginPath();ctx.rect(0,0,480,LANDSCAPE_SKY_BOTTOM);ctx.clip();

  const sunXY=project(skyState.sun),sa=sunAlpha(c.weatherCode,cloud);
  if(sunXY&&sa>0){
    ctx.save();ctx.globalAlpha=sa;
    rect(sunXY.x-13,sunXY.y-13,26,26,'rgba(255,248,199,.72)');
    rect(sunXY.x-9,sunXY.y-9,18,18,'#fff1a0');
    ctx.restore();
  }

  for(const star of skyState.stars){
    if(!(star.visibility>0.015))continue;
    const p=project(star);if(!p)continue;
    const twinkle=sky.starTwinkle({visibility:star.visibility,altitudeDeg:star.altitudeDeg,visualMagnitude:star.visualMagnitude,timeMs:now,seed:star.twinkleSeed});
    const alpha=Math.max(0,Math.min(1,star.visibility*twinkle));
    if(alpha<=0.015)continue;
    const warm=Number(star.colorIndex)>0.65,cool=Number(star.colorIndex)<0.05;
    const col=warm?'#fff1c8':cool?'#e7f4ff':'#f5f7f2';
    ctx.save();ctx.globalAlpha=alpha;
    const size=star.magnitudeClass===0?2:1;
    rect(Math.round(p.x)-(size>1?1:0),Math.round(p.y),size,size,col);
    if(star.magnitudeClass===0&&alpha>.55){ctx.globalAlpha=alpha*.18;rect(Math.round(p.x)-2,Math.round(p.y),5,1,col)}
    ctx.restore();
  }

  const moonXY=project(skyState.moon);
  if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(skyState.moon.phase)||0,skyState.moon);
  ctx.restore();
}
function refreshSkyState(){
  const sky=window.BudaoPastureSky,stars=window.BudaoPastureStars;
  if(!state||!sky||!Array.isArray(stars)||!state.location)return;
  skyState=sky.computeSkyState({
    timeMs:Date.now(),latitude:Number(state.location.latitude),longitude:Number(state.location.longitude),
    cloudCover:Number(state.current?.cloudCover)||0,weatherCode:Number(state.current?.weatherCode)||0,stars
  });
  sendPortraitEnvironment();
  draw();
}
'''
main = regex_once(
    main,
    r'function moonEphemeris\(time,latitude,longitude\)\{.*?\n\}\nfunction weatherFx\(type,cloud\)\{',
    main_shared + 'function weatherFx(type,cloud){',
    'replace main legacy astronomy',
)

old_draw_segment = r'''  const cloud=effectiveCloudCover();
  if(day){
    const x=22+progress*436,y=78-Math.sin(Math.PI*progress)*56;
    const sa=sunAlpha(c.weatherCode,cloud);
    if(sa>0){
      ctx.save();ctx.globalAlpha=sa;
      rect(x-13,y-13,26,26,'rgba(255,248,199,.72)');
      rect(x-9,y-9,18,18,'#fff1a0');
      ctx.restore();
    }
  }else{
    stars(darkness,cloud);
  }
  const moonPos=moonEphemeris(now,state.location.latitude,state.location.longitude);
  const moonXY=moonScreenPosition(moonPos,480,103);
  if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(a.moonPhase)||0,moonPos);
  weatherFx(kind(c.weatherCode),cloud);'''
main = replace_once(
    main,
    old_draw_segment,
    "  const cloud=effectiveCloudCover();\n  drawCelestial(now,cloud,c);\n  weatherFx(kind(c.weatherCode),cloud);",
    'main draw celestial',
)
main = replace_once(
    main,
    '  state=build(await r.json(),lat,lon,source);\n  sendLandscapeEnvironment();\n  sendPortraitEnvironment();\n  draw();',
    '  state=build(await r.json(),lat,lon,source);\n  sendLandscapeEnvironment();\n  refreshSkyState();',
    'main weather sky refresh',
)
main = replace_once(
    main,
    'refresh();\nsetInterval(refresh,600000);\ntickLoop();',
    'refresh();\nsetInterval(refresh,600000);\nsetInterval(refreshSkyState,45000);\ntickLoop();',
    'main sky timer',
)

main_path.write_text(main)

portrait_path = Path('tonglu-pasture-portrait.html')
portrait = portrait_path.read_text()
portrait = replace_once(
    portrait,
    '<canvas id="pasture" aria-label="牧场"></canvas>\n<script>',
    '<canvas id="pasture" aria-label="牧场"></canvas>\n<script src="/pasture-sky-engine.js"></script>\n<script>',
    'portrait engine script',
)
portrait = replace_once(
    portrait,
    'function drawPortraitMountains(sourceY){\n const farY=H*.255,midY=H*.315,nearY=H*.365;',
    'function portraitSkyBottom(){return H*.255}\nfunction drawPortraitMountains(sourceY){\n const farY=portraitSkyBottom(),midY=H*.315,nearY=H*.365;',
    'portrait sky boundary',
)
portrait_shared = r'''function moon(cx,cy,phase,p){
  const r=8,a=phase*Math.PI*2,side=Math.abs(Math.sin(a)),lz=-Math.cos(a);
  const lx=side*(p?.lightX||0),ly=side*(p?.lightY||0);
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
    const nx=x/(r+.2),ny=y/(r+.2),rr=nx*nx+ny*ny;
    if(rr>1)continue;
    const nz=Math.sqrt(Math.max(0,1-rr));
    rect(cx+x,cy+y,1,1,(nx*lx+ny*ly+nz*lz)>0?'#fff1b8':'#52617b');
  }
}
function drawSharedCelestial(now,cloud,c){
 const sky=window.BudaoPastureSky,shared=state?.skyState;
 if(!sky||!shared)return;
 const skyBottom=portraitSkyBottom();
 const project=o=>sky.projectHorizontal({altitudeDeg:o.altitudeDeg,azimuthDeg:o.azimuthDeg,centerAzimuthDeg:shared.centerAzimuthDeg,width:W,skyTop:0,skyBottom});
 ctx.save();ctx.beginPath();ctx.rect(0,0,W,skyBottom);ctx.clip();
 const sunXY=project(shared.sun),sa=sunAlpha(c.weatherCode,cloud);
 if(sunXY&&sa>0){ctx.save();ctx.globalAlpha=sa;rect(sunXY.x-13,sunXY.y-13,26,26,'rgba(255,248,199,.72)');rect(sunXY.x-9,sunXY.y-9,18,18,C.sun);ctx.restore()}
 for(const star of shared.stars||[]){
  if(!(star.visibility>0.015))continue;
  const p=project(star);if(!p)continue;
  const alpha=Math.max(0,Math.min(1,star.visibility*sky.starTwinkle({visibility:star.visibility,altitudeDeg:star.altitudeDeg,visualMagnitude:star.visualMagnitude,timeMs:now,seed:star.twinkleSeed})));
  if(alpha<=0.015)continue;
  const warm=Number(star.colorIndex)>0.65,cool=Number(star.colorIndex)<0.05,col=warm?'#fff1c8':cool?'#e7f4ff':'#f5f7f2';
  ctx.save();ctx.globalAlpha=alpha;const size=star.magnitudeClass===0?2:1;rect(Math.round(p.x)-(size>1?1:0),Math.round(p.y),size,size,col);if(star.magnitudeClass===0&&alpha>.55){ctx.globalAlpha=alpha*.18;rect(Math.round(p.x)-2,Math.round(p.y),5,1,col)}ctx.restore();
 }
 const moonXY=project(shared.moon);if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(shared.moon.phase)||0,shared.moon);
 ctx.restore();
}
'''
portrait = regex_once(
    portrait,
    r'function moonEphemeris\(time,latitude,longitude\)\{.*?\n\}\nfunction weatherOverlay\(\)\{',
    portrait_shared + 'function weatherOverlay(){',
    'replace portrait legacy astronomy',
)
old_portrait_celestial = r''' const cloud=effectiveCloudCover(),skyBand=portrait?H*.28:100;
 if(day){
  const x=20+progress*(W-40),y=skyBand*.72-Math.sin(Math.PI*progress)*skyBand*.5;
  const sa=sunAlpha(c.weatherCode,cloud);
  if(sa>0){
   ctx.save();ctx.globalAlpha=sa;
   rect(x-13,y-13,26,26,'rgba(255,248,199,.72)');rect(x-9,y-9,18,18,C.sun);
   ctx.restore();
  }
 }else{
  if(darkness>.35&&cloud<=72)for(let i=0;i<Math.max(12,Math.round(W/24));i++)rect((i*97+35)%W,(i*53+23)%Math.max(30,skyBand),1,1,i%3===0?'#fff4be':'#eaf6ff');
 }
 const moonPos=moonEphemeris(now,state.location.latitude,state.location.longitude);
 const moonXY=moonScreenPosition(moonPos,W,skyBand);
 if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(a.moonPhase)||0,moonPos);'''
portrait = replace_once(
    portrait,
    old_portrait_celestial,
    ' const cloud=effectiveCloudCover();\n const skyBottom=portraitSkyBottom();\n drawSharedCelestial(now,cloud,c);',
    'portrait draw shared celestial',
)
portrait_path.write_text(portrait)

print('pasture sky integration patched successfully')
