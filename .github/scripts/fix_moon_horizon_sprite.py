from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'missing patch target: {label}')
    return text.replace(old, new, 1)

engine = Path('pasture-sky-engine.js')
s = engine.read_text()
old = "  function projectHorizontal({altitudeDeg,azimuthDeg,centerAzimuthDeg,width,skyTop,skyBottom}){if(![altitudeDeg,azimuthDeg,centerAzimuthDeg,width,skyTop,skyBottom].every(Number.isFinite)||width<=0||skyBottom<=skyTop||altitudeDeg<=0||altitudeDeg>90)return null;const rel=wrapDeg(azimuthDeg-centerAzimuthDeg);if(Math.abs(rel)>90)return null;const u=rel/90;const k=.45;const compressed=Math.tanh(k*u)/Math.tanh(k);const x=width*(.5+.5*compressed);const y=skyBottom-(altitudeDeg/90)*(skyBottom-skyTop);if(!Number.isFinite(x)||!Number.isFinite(y)||y>=skyBottom||y<skyTop-1e-9)return null;return{x,y,relativeAzimuthDeg:rel};}\n"
new = old + "  function projectDiscHorizontal({altitudeDeg,azimuthDeg,centerAzimuthDeg,width,skyTop,skyBottom,radiusPx=0}){const p=projectHorizontal({altitudeDeg,azimuthDeg,centerAzimuthDeg,width,skyTop,skyBottom});if(!p)return null;const radius=clamp(Number(radiusPx)||0,0,(skyBottom-skyTop)/2);const usable=Math.max(0,(skyBottom-skyTop)-2*radius);const y=skyBottom-radius-(altitudeDeg/90)*usable;return{x:p.x,y,relativeAzimuthDeg:p.relativeAzimuthDeg};}\n"
s = replace_once(s, old, new, 'disc projection helper')
s = replace_once(s, 'projectHorizontal,meteorDelayMs', 'projectHorizontal,projectDiscHorizontal,meteorDelayMs', 'disc export')
engine.write_text(s)

landscape = Path('tonglu.html')
s = landscape.read_text()
old = "  const moonXY=project(skyState.moon);\n  if(moonXY){const mv=sky.moonVisualProfile(skyState.sun.altitudeDeg);moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(skyState.moon.phase)||0,skyState.moon,mv)}"
new = "  const moonXY=sky.projectDiscHorizontal({altitudeDeg:skyState.moon.altitudeDeg,azimuthDeg:skyState.moon.azimuthDeg,centerAzimuthDeg:skyState.centerAzimuthDeg,width:480,skyTop:0,skyBottom:LANDSCAPE_SKY_BOTTOM,radiusPx:8});\n  if(moonXY){const mv=sky.moonVisualProfile(skyState.sun.altitudeDeg);moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(skyState.moon.phase)||0,skyState.moon,mv)}"
s = replace_once(s, old, new, 'landscape moon projection')
landscape.write_text(s)

portrait = Path('tonglu-pasture-portrait.html')
s = portrait.read_text()
old = " const moonXY=project(shared.moon);if(moonXY){const mv=sky.moonVisualProfile(shared.sun.altitudeDeg);moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(shared.moon.phase)||0,shared.moon,mv)}"
new = " const moonXY=sky.projectDiscHorizontal({altitudeDeg:shared.moon.altitudeDeg,azimuthDeg:shared.moon.azimuthDeg,centerAzimuthDeg:shared.centerAzimuthDeg,width:W,skyTop:0,skyBottom,radiusPx:8});if(moonXY){const mv=sky.moonVisualProfile(shared.sun.altitudeDeg);moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(shared.moon.phase)||0,shared.moon,mv)}"
s = replace_once(s, old, new, 'portrait moon projection')
portrait.write_text(s)
