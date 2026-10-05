from pathlib import Path
import re
import sys

MAIN = Path('tonglu.html')
PORTRAIT = Path('tonglu-pasture-portrait.html')

HELPER = r'''function moonEphemeris(time,latitude,longitude){
  const DEG=Math.PI/180,DAY=86400000;
  const d=(Number(time)-Date.UTC(2000,0,1,12))/DAY;
  const e=23.4397*DEG,phi=Number(latitude||0)*DEG;
  const ra=(l,b)=>Math.atan2(Math.sin(l)*Math.cos(e)-Math.tan(b)*Math.sin(e),Math.cos(l));
  const dec=(l,b)=>Math.asin(Math.sin(b)*Math.cos(e)+Math.cos(b)*Math.sin(e)*Math.sin(l));
  const L=(218.316+13.176396*d)*DEG;
  const Mm=(134.963+13.064993*d)*DEG;
  const F=(93.272+13.229350*d)*DEG;
  const lm=L+6.289*DEG*Math.sin(Mm),bm=5.128*DEG*Math.sin(F);
  const moonRa=ra(lm,bm),moonDec=dec(lm,bm);
  const theta=(280.16+360.9856235*d+Number(longitude||0))*DEG;
  let H=theta-moonRa;
  H=Math.atan2(Math.sin(H),Math.cos(H));
  const altitude=Math.asin(Math.sin(phi)*Math.sin(moonDec)+Math.cos(phi)*Math.cos(moonDec)*Math.cos(H));
  const azimuth=Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(moonDec)*Math.cos(phi))+Math.PI;

  const Ms=(357.5291+0.98560028*d)*DEG;
  const ls=Ms+(1.9148*Math.sin(Ms)+0.02*Math.sin(2*Ms)+0.0003*Math.sin(3*Ms))*DEG+102.9372*DEG+Math.PI;
  const sunRa=ra(ls,0),sunDec=dec(ls,0);
  const v=(r,q)=>[Math.cos(q)*Math.cos(r),Math.cos(q)*Math.sin(r),Math.sin(q)];
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
  const norm=a=>{const n=Math.hypot(a[0],a[1],a[2])||1;return[a[0]/n,a[1]/n,a[2]/n]};
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const subProj=(a,b)=>{const k=dot(a,b);return[a[0]-k*b[0],a[1]-k*b[1],a[2]-k*b[2]]};
  const moonVec=v(moonRa,moonDec),sunVec=v(sunRa,sunDec);
  const zenith=[Math.cos(phi)*Math.cos(theta),Math.cos(phi)*Math.sin(theta),Math.sin(phi)];
  const bright=norm(subProj(sunVec,moonVec)),up=norm(subProj(zenith,moonVec)),right=norm(cross(moonVec,up));
  const lightX=dot(bright,right),lightY=-dot(bright,up);
  return Number.isFinite(altitude)&&Number.isFinite(azimuth)&&Number.isFinite(lightX)&&Number.isFinite(lightY)
    ?{altitude,azimuth,hourAngle:H,lightX,lightY}:null;
}
function moonScreenPosition(p,width,skyBand){
  if(!p||p.altitude<=0)return null;
  const margin=width*.05;
  const x=margin+((p.hourAngle+Math.PI)/(Math.PI*2))*(width-margin*2);
  const horizonY=skyBand*.72,arcHeight=skyBand*.48;
  const y=horizonY-Math.sin(Math.min(Math.PI/2,p.altitude))*arcHeight;
  return{x,y};
}
function moon(cx,cy,phase,p){
  const r=8,a=phase*Math.PI*2,side=Math.abs(Math.sin(a)),lz=-Math.cos(a);
  const lx=side*(p?.lightX||0),ly=side*(p?.lightY||0);
  for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++){
    const nx=x/(r+.2),ny=y/(r+.2),rr=nx*nx+ny*ny;
    if(rr>1)continue;
    const nz=Math.sqrt(Math.max(0,1-rr));
    rect(cx+x,cy+y,1,1,(nx*lx+ny*ly+nz*lz)>0?'#fff1b8':'#52617b');
  }
}'''

OLD_MAIN = '''  }else{\n    stars(darkness,cloud);\n    const x=24+progress*432,y=74-Math.sin(Math.PI*progress)*48;\n    moon(Math.round(x),Math.round(y),Number(a.moonPhase)||0,state.location.latitude,state.location.longitude,now);\n  }\n  weatherFx(kind(c.weatherCode),cloud);'''
NEW_MAIN = '''  }else{\n    stars(darkness,cloud);\n  }\n  const moonPos=moonEphemeris(now,state.location.latitude,state.location.longitude);\n  const moonXY=moonScreenPosition(moonPos,480,103);\n  if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(a.moonPhase)||0,moonPos);\n  weatherFx(kind(c.weatherCode),cloud);'''

OLD_PORTRAIT = ''' }else{\n  if(darkness>.35&&cloud<=72)for(let i=0;i<Math.max(12,Math.round(W/24));i++)rect((i*97+35)%W,(i*53+23)%Math.max(30,skyBand),1,1,i%3===0?'#fff4be':'#eaf6ff');\n  const x=22+progress*(W-44),y=skyBand*.72-Math.sin(Math.PI*progress)*skyBand*.45;\n  moon(Math.round(x),Math.round(y),Number(a.moonPhase)||0,state.location.latitude);\n }\n const kind=weatherKind(c.weatherCode);'''
NEW_PORTRAIT = ''' }else{\n  if(darkness>.35&&cloud<=72)for(let i=0;i<Math.max(12,Math.round(W/24));i++)rect((i*97+35)%W,(i*53+23)%Math.max(30,skyBand),1,1,i%3===0?'#fff4be':'#eaf6ff');\n }\n const moonPos=moonEphemeris(now,state.location.latitude,state.location.longitude);\n const moonXY=moonScreenPosition(moonPos,W,skyBand);\n if(moonXY)moon(Math.round(moonXY.x),Math.round(moonXY.y),Number(a.moonPhase)||0,moonPos);\n const kind=weatherKind(c.weatherCode);'''


def verify():
    main = MAIN.read_text()
    portrait = PORTRAIT.read_text()
    for s in (main, portrait):
        assert 'function moonEphemeris(time,latitude,longitude){' in s
        assert 'function moonScreenPosition(p,width,skyBand){' in s
        assert 'if(!p||p.altitude<=0)return null;' in s
        assert 'moonXY=moonScreenPosition' in s
    assert 'const x=24+progress*432,y=74-Math.sin(Math.PI*progress)*48;' not in main
    assert 'function moon(cx,cy,phase,lat){' not in portrait
    assert 'moon(Math.round(x),Math.round(y),Number(a.moonPhase)||0,state.location.latitude);' not in portrait


def apply():
    main = MAIN.read_text()
    main, n = re.subn(r'function moonOrientation\(time,latitude,longitude\)\{.*?\n\}\nfunction moon\(cx,cy,phase,latitude,longitude,time\)\{.*?\n\}', HELPER, main, count=1, flags=re.S)
    assert n == 1, f'main helper replacement count={n}'
    assert OLD_MAIN in main
    main = main.replace(OLD_MAIN, NEW_MAIN, 1)
    MAIN.write_text(main)

    portrait = PORTRAIT.read_text()
    portrait, n = re.subn(r'function moon\(cx,cy,phase,lat\)\{.*?\n\}', HELPER, portrait, count=1, flags=re.S)
    assert n == 1, f'portrait helper replacement count={n}'
    assert OLD_PORTRAIT in portrait
    portrait = portrait.replace(OLD_PORTRAIT, NEW_PORTRAIT, 1)
    PORTRAIT.write_text(portrait)


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'verify'
    if mode == 'apply':
        apply()
    elif mode == 'verify':
        verify()
    else:
        raise SystemExit(f'unknown mode: {mode}')
