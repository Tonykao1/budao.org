(()=>{
'use strict';
const canvas=document.getElementById('environmentLayer');
const DNA=window.PastureSheepDNA;
const Renderer=window.PastureSheepRenderer;
if(!canvas||!DNA||!Renderer)return;
const ctx=canvas.getContext('2d');
const BLEAT_URL='/pasture-preview/assets/baaa01.mp3';
const BLEAT_STOP_MS=900;
const ARRIVAL_DURATION_MS=4200;
const ARRIVAL_IMPACT_AT=.72;
const ARRIVAL_CLOSEUP_UNIT=28;
const ARRIVAL_SPEED_LINE_COUNT=60;
const ARRIVAL_PARTICLE_COUNT=100;
const ARRIVAL_SHAKE_PEAK=21;
const PIXEL_HAND_OPEN='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Cpath fill=%22%231f3140%22 d=%22M9 11h5V5h5v16h2V3h5v18h2V1h5v20h2V6h5v19h4v12h-4v5H17v-4h-5v-6H8V20h5v8h3V13H9z%22/%3E%3Cpath fill=%22%23f2d0a2%22 d=%22M11 12h2V7h3v16h7V5h2v18h5V3h2v20h5V8h2v17h3v10h-4v4H19v-3h-5v-6h-4v-8h3v8h5V14h-7z%22/%3E%3C/svg%3E") 24 8, grab';
const PIXEL_HAND_CLOSED='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Cpath fill=%22%231f3140%22 d=%22M12 11h26v4h5v19h-4v6h-5v4H17v-4h-5v-5H8V20h4z%22/%3E%3Cpath fill=%22%23f2d0a2%22 d=%22M14 15h22v4h4v13h-4v5h-4v3H19v-4h-4v-4h-3V22h5v8h4V19h15v-4z%22/%3E%3C/svg%3E") 23 12, grabbing';
const RIVER_POLYGON=[[355,147],[361,149],[367,152],[372,157],[375,163],[373,170],[369,177],[366,184],[368,192],[374,200],[382,208],[390,216],[396,225],[399,235],[398,247],[394,261],[390,279],[388,300],[354,300],[357,281],[360,264],[363,250],[363,238],[360,228],[354,219],[347,210],[343,202],[343,194],[346,185],[351,177],[354,169],[353,162],[350,156],[351,151]];
const BRIDGE_RECT={left:347,top:217,right:400,bottom:226};
const MASK_OX=8,MASK_OY=12;
let resident=null;
let pos={x:160,y:225,flip:false};
let arrivalStart=0;
let arrivalCanvas=null;
let arrivalCtx=null;
let arrivalRaf=0;
let arrivalImpactPlayed=false;
let impactParticles=[];
let arrivalShake=0;
let drag=null;
let bleat=null;
let bleatStopTimer=0;
let audioCtx=null;
let bleatSource=null;
let bleatGain=null;
let bleatPan=null;
let paintQueued=false;
let scenePassPainted=false;
const mask=document.createElement('canvas');mask.width=48;mask.height=48;
const maskCtx=mask.getContext('2d',{willReadFrequently:true});

function flockHash(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function scaleAtY(y){const t=Math.max(0,Math.min(1,(y-160)/126));return(.32+t*.84)*.56}
function rebuildMask(){maskCtx.clearRect(0,0,mask.width,mask.height);if(!resident?.appearance)return;Renderer.drawMask(maskCtx,resident.appearance,MASK_OX,MASK_OY)}
function key(){return 'budao-pasture-resident-pos:'+String(resident?.id||'guest')}
function pointInPolygon(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];const crosses=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi);if(crosses)inside=!inside}return inside}
function bridgeContains(x,y){return x>=BRIDGE_RECT.left&&x<=BRIDGE_RECT.right&&y>=BRIDGE_RECT.top&&y<=BRIDGE_RECT.bottom}
function walkableFootPoint(x,y){const s=scaleAtY(y),footX=x+10.5*s,footY=y+14*s;if(footX<0||footX>480||footY<145||footY>299)return false;if(bridgeContains(footX,footY))return true;return !pointInPolygon(footX,footY,RIVER_POLYGON)}
function candidatePosition(x,y){x=Math.max(-4,Math.min(466,x));y=Math.max(150,Math.min(286,y));return walkableFootPoint(x,y)?{x,y}:null}
function validSavedPosition(v){
  if(!v||!Number.isFinite(v.x)||!Number.isFinite(v.y))return false;
  if(v.x<-4||v.x>466||v.y<150||v.y>286)return false;
  const checked=candidatePosition(v.x,v.y);
  return !!checked&&Math.abs(checked.x-v.x)<.001&&Math.abs(checked.y-v.y)<.001;
}
function deterministicSafePosition(){
  const h=flockHash(String(resident?.id||'resident'));
  const preferred=[
    {x:54+(h%248),y:205+((h>>>8)%58)},
    {x:70+((h>>>4)%220),y:232+((h>>>12)%38)},
    {x:42+((h>>>7)%260),y:178+((h>>>15)%34)},
    {x:120,y:232},{x:240,y:248},{x:72,y:264}
  ];
  for(const p of preferred){const checked=candidatePosition(p.x,p.y);if(checked)return{x:checked.x,y:checked.y,flip:!!(h&1)}}
  return{x:160,y:225,flip:!!(h&1)};
}
function initialPosition(){
  try{
    const v=JSON.parse(localStorage.getItem(key())||'null');
    if(validSavedPosition(v))return{x:v.x,y:v.y,flip:!!v.flip};
    if(v){pos=deterministicSafePosition();savePosition();return{...pos}}
  }catch(_){ }
  return deterministicSafePosition();
}
function savePosition(){try{localStorage.setItem(key(),JSON.stringify(pos))}catch(_){}}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*480,y:(e.clientY-r.top)/r.height*300}}
function residentSheepHit(clientX,clientY){
  if(!resident?.appearance||arrivalStart)return false;
  const r=canvas.getBoundingClientRect(),px=(clientX-r.left)/r.width*480,py=(clientY-r.top)/r.height*300,s=scaleAtY(pos.y);
  let localX=(px-pos.x)/s,localY=(py-pos.y)/s;
  if(pos.flip)localX=21-localX;
  const lx=Math.floor(localX)+MASK_OX,ly=Math.floor(localY)+MASK_OY;
  if(lx<0||ly<0||lx>=mask.width||ly>=mask.height)return false;
  return maskCtx.getImageData(lx,ly,1,1).data[3]>0;
}
function sheepAudioSpace(){
  const depth=Math.max(0,Math.min(1,(pos.y-160)/126));
  const s=scaleAtY(pos.y);
  const centerX=pos.x+10.5*s;
  const volume=.28+.72*depth;
  const pan=Math.max(-.9,Math.min(.9,(centerX-240)/240));
  return{volume,pan};
}
function ensureBleatGraph(){
  if(!bleat){bleat=new Audio(BLEAT_URL);bleat.preload='auto'}
  if(audioCtx&&bleatSource&&bleatGain&&bleatPan)return true;
  const AudioCtor=window.AudioContext||window.webkitAudioContext;
  if(!AudioCtor)return false;
  audioCtx=new AudioCtor();
  bleatSource=audioCtx.createMediaElementSource(bleat);
  bleatGain=audioCtx.createGain();
  bleatPan=audioCtx.createStereoPanner();
  bleatSource.connect(bleatGain).connect(bleatPan).connect(audioCtx.destination);
  return true;
}
function playBleat(){
  try{
    if(!bleat){bleat=new Audio(BLEAT_URL);bleat.preload='auto'}
    const space=sheepAudioSpace();
    const spatial=ensureBleatGraph();
    if(spatial){
      if(audioCtx.state==='suspended')audioCtx.resume().catch(()=>{});
      bleatGain.gain.value=space.volume;
      bleatPan.pan.value=space.pan;
      bleat.volume=1;
    }else{
      bleat.volume=space.volume;
    }
    clearTimeout(bleatStopTimer);
    bleat.pause();bleat.currentTime=0;
    const p=bleat.play();if(p?.catch)p.catch(()=>{});
    bleatStopTimer=setTimeout(()=>{if(!bleat)return;bleat.pause();bleat.currentTime=0},BLEAT_STOP_MS);
  }catch(_){ }
}

function ensureArrivalCanvas(){
  if(arrivalCanvas)return arrivalCanvas;
  arrivalCanvas=document.createElement('canvas');
  arrivalCanvas.width=480;arrivalCanvas.height=300;
  arrivalCanvas.setAttribute('aria-hidden','true');
  arrivalCanvas.style.position='fixed';
  arrivalCanvas.style.inset='0';
  arrivalCanvas.style.width='100vw';
  arrivalCanvas.style.height='100vh';
  arrivalCanvas.style.zIndex='9999';
  arrivalCanvas.style.pointerEvents='none';
  arrivalCanvas.style.imageRendering='pixelated';
  document.body.appendChild(arrivalCanvas);
  arrivalCtx=arrivalCanvas.getContext('2d');
  arrivalCtx.imageSmoothingEnabled=false;
  return arrivalCanvas;
}
function destroyArrivalCanvas(){
  cancelAnimationFrame(arrivalRaf);
  arrivalRaf=0;
  if(arrivalCanvas?.parentNode)arrivalCanvas.parentNode.removeChild(arrivalCanvas);
  arrivalCanvas=null;arrivalCtx=null;impactParticles=[];arrivalShake=0;
}
function seedImpactParticles(){
  const h=flockHash(String(resident?.id||'resident'));
  impactParticles=Array.from({length:ARRIVAL_PARTICLE_COUNT},(_,i)=>{
    const side=i%2?-1:1;
    const spread=((h>>>(i%16))&7)/7;
    const fan=.35+(i%13)/12;
    return{x:240+(i%9-4)*4,y:224,vx:side*(42+spread*110)*fan,vy:-(34+(i%11)*8),size:1+(i%4===0?2:i%3===0?1:0),tone:i%3};
  });
}
function drawArrivalBackdrop(progress){
  const c=arrivalCtx;
  const dark=progress<ARRIVAL_IMPACT_AT?.72:.54*(1-Math.min(1,(progress-ARRIVAL_IMPACT_AT)/.28));
  c.fillStyle=`rgba(3,7,12,${Math.max(0,dark)})`;c.fillRect(0,0,480,300);
  c.fillStyle='rgba(255,248,214,.14)';
  for(let i=0;i<13;i++)c.fillRect(6+i*39,0,i%3===0?3:2,300);
}
function drawSpeedLines(progress){
  if(progress<.18||progress>=ARRIVAL_IMPACT_AT)return;
  const c=arrivalCtx,intensity=Math.min(1,(progress-.18)/.18);
  c.fillStyle=`rgba(236,248,255,${.24+.58*intensity})`;
  for(let i=0;i<ARRIVAL_SPEED_LINE_COUNT;i++){
    const x=(i*29+Math.floor(progress*2600))%480;
    const y=(i*47+Math.floor(progress*6200))%270;
    const h=18+(i%7)*12+Math.floor(70*intensity);
    c.fillRect(x,y,1+(i%4===0?2:i%3===0?1:0),h);
  }
}
function drawImpact(progress){
  if(progress<ARRIVAL_IMPACT_AT)return;
  const c=arrivalCtx;
  const after=Math.min(1,(progress-ARRIVAL_IMPACT_AT)/.28);
  const centerX=pos.x+10.5*scaleAtY(pos.y),groundY=pos.y+14*scaleAtY(pos.y);
  const ring=12+after*190;
  c.fillStyle=`rgba(255,244,196,${.86*(1-after)})`;
  c.fillRect(Math.round(centerX-ring),Math.round(groundY-2),Math.round(ring*2),4);
  const elapsed=after*1.65;
  for(const p of impactParticles){
    const px=centerX+(p.x-240)+p.vx*elapsed;
    const py=groundY+(p.y-224)+p.vy*elapsed+58*elapsed*elapsed;
    c.fillStyle=p.tone===0?'#d7e6a8':p.tone===1?'#9dbb78':'#f1dfaa';
    c.fillRect(Math.round(px),Math.round(py),p.size,p.size);
  }
}
function drawImpactFlash(progress){
  if(progress<ARRIVAL_IMPACT_AT||progress>ARRIVAL_IMPACT_AT+.12)return;
  const t=(progress-ARRIVAL_IMPACT_AT)/.12;
  const alpha=Math.max(0,.94*(1-t));
  const c=arrivalCtx;
  c.fillStyle=`rgba(255,252,230,${alpha})`;c.fillRect(0,0,480,300);
  if(t<.42){
    c.fillStyle=`rgba(255,255,255,${.9*(1-t/.42)})`;
    c.fillRect(0,143,480,14);c.fillRect(232,0,16,300);
  }
}
function drawArrivalSheep(progress){
  const c=arrivalCtx;
  const finalUnit=scaleAtY(pos.y);
  let unit,x,y,squash=0,bounce=0;
  if(progress<.22){
    const t=progress/.22;
    const hold=Math.min(1,t/.48);
    const exit=Math.max(0,(t-.48)/.52);
    unit=ARRIVAL_CLOSEUP_UNIT*(.92+.08*Math.sin(hold*Math.PI));
    x=240-10.5*unit+Math.sin(t*Math.PI*2)*3;
    y=128-4*unit-exit*360;
  }else if(progress<ARRIVAL_IMPACT_AT){
    const t=(progress-.22)/(ARRIVAL_IMPACT_AT-.22);
    const fall=Math.pow(t,5.2);
    unit=13.5-(13.5-5.9)*Math.pow(t,.72);
    x=240-10.5*unit+Math.sin(t*Math.PI*12)*(1-t)*8;
    y=-150+(224+150)*fall;
  }else{
    const t=Math.min(1,(progress-ARRIVAL_IMPACT_AT)/.28);
    const settle=1-Math.pow(1-t,4);
    squash=t<.18?1-t/.18:0;
    bounce=Math.sin(Math.min(1,t/.72)*Math.PI*4)*(1-t)*22;
    unit=5.9+(finalUnit-5.9)*settle;
    x=(240-10.5*5.9)+(pos.x-(240-10.5*5.9))*settle;
    y=224+(pos.y-224)*settle-bounce;
  }
  c.save();
  if(squash){
    const cx=x+10.5*unit,cy=y+7*unit;
    c.translate(cx,cy);c.scale(1+.34*squash,1-.34*squash);c.translate(-cx,-cy);
  }
  Renderer.draw(c,x,y,unit,pos.flip,resident.appearance);
  c.restore();
}
function arrivalShakeAmount(progress){
  const d=progress-ARRIVAL_IMPACT_AT;
  if(d<0||d>.24)return 0;
  if(d<.055)return ARRIVAL_SHAKE_PEAK*(1-d/.055);
  if(d<.13)return 12*(1-(d-.055)/.075);
  return 6*(1-(d-.13)/.11);
}
function arrivalFrame(now){
  if(!arrivalStart||!arrivalCtx||!resident?.appearance)return;
  const progress=Math.min(1,(now-arrivalStart)/ARRIVAL_DURATION_MS);
  if(!arrivalImpactPlayed&&progress>=ARRIVAL_IMPACT_AT){arrivalImpactPlayed=true;seedImpactParticles();playBleat()}
  arrivalShake=arrivalShakeAmount(progress)*Math.sin((progress-ARRIVAL_IMPACT_AT)*520);
  const c=arrivalCtx;
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,480,300);
  if(arrivalShake)c.translate(Math.round(arrivalShake),Math.round(Math.sin(progress*430)*arrivalShake*.68));
  drawArrivalBackdrop(progress);drawSpeedLines(progress);drawArrivalSheep(progress);drawImpact(progress);drawImpactFlash(progress);
  if(progress<1){arrivalRaf=requestAnimationFrame(arrivalFrame);return}
  arrivalStart=0;window.__tongluFlockCount=45;destroyArrivalCanvas();queueResidentPaint();
}
function startArrivalCinematic(){
  if(!resident?.appearance)return;
  destroyArrivalCanvas();ensureArrivalCanvas();
  arrivalStart=performance.now();arrivalImpactPlayed=false;impactParticles=[];arrivalShake=0;
  window.__tongluFlockCount=44;
  arrivalRaf=requestAnimationFrame(arrivalFrame);
}

function paintResident(now=performance.now()){
  if(!resident?.appearance||canvas.style.display==='none'||arrivalStart)return;
  const x=pos.x,y=pos.y,s=scaleAtY(pos.y);
  ctx.fillStyle='rgba(56,93,54,.15)';ctx.fillRect(Math.round(x-1.5*s),Math.round(y+13*s),Math.round(21*s),Math.max(1,Math.round(2*s)));
  Renderer.draw(ctx,x,y,s,pos.flip,resident.appearance);
  window.__tongluFlockCount=45;
  window.__tongluResidentPaintCount=(window.__tongluResidentPaintCount||0)+1;
  if(window.__tongluResidentPaintCount===1)window.parent?.postMessage({type:'tonglu-resident-painted-v1'},location.origin);
}
function queueResidentPaint(){if(paintQueued)return;paintQueued=true;queueMicrotask(()=>{paintQueued=false;if(!scenePassPainted)paintResident(performance.now())})}
function isSceneTintFill(x,y,w,h){if(x!==0||y!==0||w!==480||h!==300)return false;const fill=String(ctx.fillStyle||'');return fill.startsWith('rgba(18, 34, 70')||fill.startsWith('rgba(18,34,70')||fill.startsWith('rgba(244, 177, 112')||fill.startsWith('rgba(244,177,112')}
const originalClearRect=ctx.clearRect.bind(ctx);
const originalFillRect=ctx.fillRect.bind(ctx);
ctx.clearRect=function(...args){scenePassPainted=false;originalClearRect(...args);queueResidentPaint()};
ctx.fillRect=function(x,y,w,h){if(!scenePassPainted&&isSceneTintFill(x,y,w,h)){const sceneTint=ctx.fillStyle;paintResident(performance.now());scenePassPainted=true;ctx.fillStyle=sceneTint}return originalFillRect(x,y,w,h)};

canvas.addEventListener('pointermove',e=>{if(drag){const p=point(e),next=candidatePosition(p.x-drag.dx,p.y-drag.dy);if(next){pos.x=next.x;pos.y=next.y}canvas.style.cursor=PIXEL_HAND_CLOSED;paintResident(performance.now());e.preventDefault();return}canvas.style.cursor=residentSheepHit(e.clientX,e.clientY)?PIXEL_HAND_OPEN:'default'});
canvas.addEventListener('pointerdown',e=>{if(!residentSheepHit(e.clientX,e.clientY))return;const p=point(e);drag={id:e.pointerId,dx:p.x-pos.x,dy:p.y-pos.y,moved:false};canvas.setPointerCapture?.(e.pointerId);canvas.style.cursor=PIXEL_HAND_CLOSED;e.preventDefault()});
canvas.addEventListener('pointermove',e=>{if(drag&&drag.id===e.pointerId)drag.moved=true},{passive:true});
function release(e){if(!drag||drag.id!==e.pointerId)return;const moved=drag.moved;drag=null;try{canvas.releasePointerCapture?.(e.pointerId)}catch(_){ }savePosition();canvas.style.cursor=residentSheepHit(e.clientX,e.clientY)?PIXEL_HAND_OPEN:'default';queueResidentPaint();if(moved)playBleat()}
canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('pointerleave',()=>{if(!drag)canvas.style.cursor='default'});
window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==window.parent)return;
  if(e.data?.type==='tonglu-resident-clear-v1'){
    resident=null;drag=null;arrivalStart=0;destroyArrivalCanvas();
    clearTimeout(bleatStopTimer);
    try{bleat?.pause()}catch(_){}
    rebuildMask();window.__tongluFlockCount=44;window.__tongluResidentPaintCount=0;
    window.parent?.postMessage({type:'tonglu-resident-applied-v1',hasSheep:false},location.origin);
    window.__tongluCoreRedrawV1?.();
    return;
  }
  if(e.data?.type!=='tonglu-resident-v1')return;
  const incoming=e.data.resident;if(!incoming?.id||!incoming?.sheep)return;
  const appearance=Number(incoming.sheep.appearanceVersion)===2&&DNA.validateV2(incoming.sheep.appearance)
    ?incoming.sheep.appearance
    :{bodyColor:incoming.sheep.bodyColor,headColor:incoming.sheep.headColor,marking:incoming.sheep.marking||'NONE'};
  resident={id:incoming.id,sheep:incoming.sheep,appearance};
  pos=initialPosition();rebuildMask();window.__tongluFlockCount=45;window.__tongluResidentPaintCount=0;
  window.parent?.postMessage({type:'tonglu-resident-applied-v1',hasSheep:true},location.origin);
  if(e.data.arrival)startArrivalCinematic();else queueResidentPaint();
});
window.__tongluResidentEngineV1=true;
window.parent?.postMessage({type:'tonglu-resident-ready-v1'},location.origin);
})();