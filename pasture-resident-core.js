(()=>{
'use strict';
const canvas=document.getElementById('environmentLayer');
if(!canvas)return;
const ctx=canvas.getContext('2d');
const BLEAT_URL='/pasture-assets/baaa01.mp3';
const BLEAT_STOP_MS=900;
const PIXEL_HAND_OPEN='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Cpath fill=%22%231f3140%22 d=%22M9 11h5V5h5v16h2V3h5v18h2V1h5v20h2V6h5v19h4v12h-4v5H17v-4h-5v-6H8V20h5v8h3V13H9z%22/%3E%3Cpath fill=%22%23f2d0a2%22 d=%22M11 12h2V7h3v16h7V5h2v18h5V3h2v20h5V8h2v17h3v10h-4v4H19v-3h-5v-6h-4v-8h3v8h5V14h-7z%22/%3E%3C/svg%3E") 24 8, grab';
const PIXEL_HAND_CLOSED='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Cpath fill=%22%231f3140%22 d=%22M12 11h26v4h5v19h-4v6h-5v4H17v-4h-5v-5H8V20h4z%22/%3E%3Cpath fill=%22%23f2d0a2%22 d=%22M14 15h22v4h4v13h-4v5h-4v3H19v-4h-4v-4h-3V22h5v8h4V19h15v-4z%22/%3E%3C/svg%3E") 23 12, grabbing';
const RIVER_POLYGON=[[355,147],[361,149],[367,152],[372,157],[375,163],[373,170],[369,177],[366,184],[368,192],[374,200],[382,208],[390,216],[396,225],[399,235],[398,247],[394,261],[390,279],[388,300],[354,300],[357,281],[360,264],[363,250],[363,238],[360,228],[354,219],[347,210],[343,202],[343,194],[346,185],[351,177],[354,169],[353,162],[350,156],[351,151]];
const BRIDGE_RECT={left:347,top:217,right:400,bottom:226};
let resident=null;
let pos={x:160,y:225,flip:false};
let arrivalStart=0;
let drag=null;
let bleat=null;
let bleatStopTimer=0;
let audioCtx=null;
let bleatSource=null;
let bleatGain=null;
let bleatPan=null;
let paintQueued=false;
let scenePassPainted=false;
const mask=document.createElement('canvas');mask.width=32;mask.height=28;
const maskCtx=mask.getContext('2d',{willReadFrequently:true});

function flockHash(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function scaleAtY(y){const t=Math.max(0,Math.min(1,(y-160)/126));return(.32+t*.84)*.56}
function residentRects(a){const r=[[0,0,16,8,a.bodyColor],[3,-4,11,13,a.bodyColor],[6,-6,7,15,a.bodyColor],[13,2,7,7,a.headColor],[19,4,2,3,a.headColor],[12,3,2,2,a.headColor],[17,4,1,1,'#342f2c'],[4,8,2,6,'#5d5851'],[11,8,2,6,'#5d5851']];if(a.marking==='FACE')r.push([14,3,3,3,'#fff7df']);if(a.marking==='BACK')r.push([5,-3,7,3,'#fff7df']);if(a.marking==='SOCKS'){r.push([4,12,2,2,'#fff7df']);r.push([11,12,2,2,'#fff7df'])}return r}
function drawResidentSheep(target,x,y,s,flip,appearance){target.save();if(flip){target.translate(x+21*s,0);target.scale(-1,1);x=0}for(const [rx,ry,rw,rh,color] of residentRects(appearance)){target.fillStyle=color;target.fillRect(Math.round(x+rx*s),Math.round(y+ry*s),Math.max(1,Math.round(rw*s)),Math.max(1,Math.round(rh*s)))}target.restore()}
function rebuildMask(){maskCtx.clearRect(0,0,32,28);if(!resident?.sheep)return;maskCtx.fillStyle='#000';for(const [x,y,w,h] of residentRects(resident.sheep))maskCtx.fillRect(x+2,y+8,w,h)}
function key(){return 'budao-pasture-resident-pos:'+String(resident?.id||'guest')}
function initialPosition(){try{const v=JSON.parse(localStorage.getItem(key())||'null');if(v&&Number.isFinite(v.x)&&Number.isFinite(v.y))return{x:v.x,y:v.y,flip:!!v.flip}}catch(_){ }const h=flockHash(String(resident?.id||'resident'));return{x:35+(h%285),y:165+((h>>>8)%105),flip:!!(h&1)}}
function savePosition(){try{localStorage.setItem(key(),JSON.stringify(pos))}catch(_){}}
function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*480,y:(e.clientY-r.top)/r.height*300}}
function residentSheepHit(clientX,clientY){if(!resident?.sheep||arrivalStart)return false;const r=canvas.getBoundingClientRect(),px=(clientX-r.left)/r.width*480,py=(clientY-r.top)/r.height*300,s=scaleAtY(pos.y);let lx=Math.floor((px-pos.x)/s)+2,ly=Math.floor((py-pos.y)/s)+8;if(pos.flip)lx=23-lx;if(lx<0||ly<0||lx>=32||ly>=28)return false;return maskCtx.getImageData(lx,ly,1,1).data[3]>0}
function pointInPolygon(x,y,poly){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i][0],yi=poly[i][1],xj=poly[j][0],yj=poly[j][1];const crosses=((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-9)+xi);if(crosses)inside=!inside}return inside}
function bridgeContains(x,y){return x>=BRIDGE_RECT.left&&x<=BRIDGE_RECT.right&&y>=BRIDGE_RECT.top&&y<=BRIDGE_RECT.bottom}
function walkableFootPoint(x,y){const s=scaleAtY(y),footX=x+10.5*s,footY=y+14*s;if(footX<0||footX>480||footY<145||footY>299)return false;if(bridgeContains(footX,footY))return true;return !pointInPolygon(footX,footY,RIVER_POLYGON)}
function candidatePosition(x,y){x=Math.max(-4,Math.min(466,x));y=Math.max(150,Math.min(286,y));return walkableFootPoint(x,y)?{x,y}:null}
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
function paintResident(now=performance.now()){
  if(!resident?.sheep||canvas.style.display==='none')return;
  let x=pos.x,y=pos.y;
  if(arrivalStart){const t=Math.min(1,(now-arrivalStart)/1750),ease=1-Math.pow(1-t,3);y=-26+(pos.y+26)*ease;x=pos.x+Math.sin(t*Math.PI*4)*(1-t)*4;if(t>=1)arrivalStart=0}
  const s=scaleAtY(pos.y);
  ctx.fillStyle='rgba(56,93,54,.15)';ctx.fillRect(Math.round(x-1.5*s),Math.round(y+13*s),Math.round(21*s),Math.max(1,Math.round(2*s)));
  drawResidentSheep(ctx,x,y,s,pos.flip,resident.sheep);
  window.__tongluFlockCount=45;
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
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.data?.type!=='tonglu-resident-v1')return;const incoming=e.data.resident;if(!incoming?.id||!incoming?.sheep)return;resident={id:incoming.id,sheep:{bodyColor:incoming.sheep.bodyColor,headColor:incoming.sheep.headColor,marking:incoming.sheep.marking||'NONE'}};pos=initialPosition();rebuildMask();if(e.data.arrival)arrivalStart=performance.now();window.__tongluFlockCount=45;queueResidentPaint()});
window.__tongluResidentEngineV1=true;
window.parent?.postMessage({type:'tonglu-resident-ready-v1'},location.origin);
})();