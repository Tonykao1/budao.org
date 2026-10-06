from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch point: {label}')
    return text.replace(old, new, 1)


engine = Path('pasture-sky-engine.js')
s = engine.read_text()
s = replace_once(
    s,
    "  function smoothstep(a,b,x){if(a===b)return x>=b?1:0;const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}\n  function twilightFactor",
    "  function smoothstep(a,b,x){if(a===b)return x>=b?1:0;const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);}\n  function moonVisualProfile(sunAltitudeDeg){if(!Number.isFinite(sunAltitudeDeg))return{brightAlpha:1,darkAlpha:1};if(sunAltitudeDeg>=0)return{brightAlpha:.45,darkAlpha:0};if(sunAltitudeDeg<=-12)return{brightAlpha:1,darkAlpha:1};if(sunAltitudeDeg>-6){const t=smoothstep(0,-6,sunAltitudeDeg);return{brightAlpha:.45+.30*t,darkAlpha:.18*t};}const t=smoothstep(-6,-12,sunAltitudeDeg);return{brightAlpha:.75+.25*t,darkAlpha:.18+.82*t};}\n  function twilightFactor",
    'engine profile insertion',
)
s = replace_once(
    s,
    'computeSkyState,twilightFactor,atmosphericFactor',
    'computeSkyState,moonVisualProfile,twilightFactor,atmosphericFactor',
    'engine profile export',
)
engine.write_text(s)

moon_old = """function moon(cx,cy,phase,p){
  const r=8,a=phase*Math.PI*2,side=Math.abs(Math.sin(a)),lz=-Math.cos(a);
  const lx=side*(p?.lightX||0),ly=side*(p?.lightY||0);
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
    const nx=x/(r+.2),ny=y/(r+.2),rr=nx*nx+ny*ny;
    if(rr>1)continue;
    const nz=Math.sqrt(Math.max(0,1-rr));
    rect(cx+x,cy+y,1,1,(nx*lx+ny*ly+nz*lz)>0?'#fff1b8':'#52617b');
  }
}"""

moon_new = """function moon(cx,cy,phase,p,visual){
  const r=8,a=phase*Math.PI*2,side=Math.abs(Math.sin(a)),lz=-Math.cos(a);
  const lx=side*(p?.lightX||0),ly=side*(p?.lightY||0);
  const brightAlpha=Math.max(0,Math.min(1,Number.isFinite(Number(visual?.brightAlpha))?Number(visual.brightAlpha):1));
  const darkAlpha=Math.max(0,Math.min(1,Number.isFinite(Number(visual?.darkAlpha))?Number(visual.darkAlpha):1));
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
    const nx=x/(r+.2),ny=y/(r+.2),rr=nx*nx+ny*ny;
    if(rr>1)continue;
    const nz=Math.sqrt(Math.max(0,1-rr));
    const lit=(nx*lx+ny*ly+nz*lz)>0,alpha=lit?brightAlpha:darkAlpha;
    if(alpha<=0)continue;
    rect(cx+x,cy+y,1,1,lit?'rgba(255,241,184,'+alpha+')':'rgba(82,97,123,'+alpha+')');
  }
}"""

landscape = Path('tonglu.html')
s = landscape.read_text()
s = replace_once(s, moon_old, moon_new, 'landscape moon renderer')
s = replace_once(
    s,
    "  const moonXY=project(skyState.moon);\n  if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(skyState.moon.phase)||0,skyState.moon);",
    "  const moonXY=project(skyState.moon);\n  if(moonXY){const mv=sky.moonVisualProfile(skyState.sun.altitudeDeg);moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(skyState.moon.phase)||0,skyState.moon,mv)}",
    'landscape moon call',
)
landscape.write_text(s)

portrait = Path('tonglu-pasture-portrait.html')
s = portrait.read_text()
s = replace_once(s, moon_old, moon_new, 'portrait moon renderer')
s = replace_once(
    s,
    " const moonXY=project(shared.moon);if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(shared.moon.phase)||0,shared.moon);",
    " const moonXY=project(shared.moon);if(moonXY){const mv=sky.moonVisualProfile(shared.sun.altitudeDeg);moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(shared.moon.phase)||0,shared.moon,mv)}",
    'portrait moon call',
)
portrait.write_text(s)
