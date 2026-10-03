(()=>{
'use strict';
const READY_DELAY=135;
const handSvg=(body)=>'url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" shape-rendering="crispEdges">'+body+'</svg>')+'")';
// Five fingers are anatomically present, but the relaxed state deliberately overlaps the four fingers
// instead of drawing five parallel prongs. This keeps the pixel hand readable at cursor scale.
const PIXEL_HAND_RELAXED=handSvg(
 '<path fill="#1f3140" d="M15 12h19v3h5v4h4v15h-4v6h-5v4H17v-4h-5v-7H8V22h5v-7h2z"/>'+
 '<path fill="#f4d4a7" d="M17 15h15v3h5v4h3v10h-4v6h-5v3H19v-4h-4v-6h-3v-7h5v7h4V19h3v11h3V17h3v13h3V19h3v12h3v-7h-2v-4h-4v-3H17z"/>'
)+' 18 11, grab';
const PIXEL_HAND_READY=handSvg(
 '<path fill="#1f3140" d="M12 9h6v10h3V6h6v13h3V8h6v13h3v-7h5v19h-4v7h-5v4H17v-4h-5v-6H8V20h4z"/>'+
 '<path fill="#f4d4a7" d="M14 11h3v13h5V8h3v16h5V10h3v15h5v-9h3v15h-4v7h-4v3H19v-4h-4v-5h-4V22h3v8h4V18h-4z"/>'
)+' 18 9, grab';
const PIXEL_HAND_CLOSED=handSvg(
 '<path fill="#1f3140" d="M14 10h26v4h4v20h-4v6h-4v4H16v-4h-4v-6H8V18h6z"/>'+
 '<path fill="#f4d4a7" d="M16 14h20v4h4v14h-4v6h-4v2H18v-4h-4v-4h-2V22h6v8h4V18h14v-4H16z"/>'
)+' 18 10, grabbing';
let attachedCanvas=null,hoverStarted=0,residentHandState='default',readyTimer=0;
function expose(win,state){residentHandState=state;try{win.__pastureResidentHandState=state}catch(e){}}
function apply(canvas,win,state){
 clearTimeout(readyTimer);
 expose(win,state);
 if(state==='relaxed')canvas.style.cursor=PIXEL_HAND_RELAXED;
 else if(state==='ready')canvas.style.cursor=PIXEL_HAND_READY;
 else if(state==='grabbing')canvas.style.cursor=PIXEL_HAND_CLOSED;
}
function existingState(canvas){
 const c=String(canvas.style.cursor||'');
 if(c.includes('grabbing'))return 'grabbing';
 if(c.includes('grab'))return 'hit';
 return 'none';
}
function attachCanvas(canvas,sceneWin){
 if(!canvas||canvas===attachedCanvas)return;
 attachedCanvas=canvas;hoverStarted=0;expose(sceneWin,'default');
 canvas.addEventListener('pointermove',e=>{
   const state=existingState(canvas);
   if(state==='grabbing'){
     hoverStarted=0;apply(canvas,sceneWin,'grabbing');return;
   }
   if(state==='hit'){
     const now=performance.now();
     if(!hoverStarted)hoverStarted=now;
     if(now-hoverStarted>=READY_DELAY){apply(canvas,sceneWin,'ready');}
     else{
       apply(canvas,sceneWin,'relaxed');
       const left=Math.max(0,READY_DELAY-(now-hoverStarted));
       readyTimer=setTimeout(()=>{
         if(existingState(canvas)==='hit'||residentHandState==='relaxed')apply(canvas,sceneWin,'ready');
       },left);
     }
     return;
   }
   hoverStarted=0;clearTimeout(readyTimer);expose(sceneWin,'default');
 },false);
 canvas.addEventListener('pointerdown',()=>{
   if(existingState(canvas)==='grabbing')apply(canvas,sceneWin,'grabbing');
 },false);
 canvas.addEventListener('pointerup',()=>{
   const state=existingState(canvas);hoverStarted=0;
   if(state==='hit'){apply(canvas,sceneWin,'relaxed');readyTimer=setTimeout(()=>apply(canvas,sceneWin,'ready'),READY_DELAY)}
   else expose(sceneWin,'default');
 },false);
 canvas.addEventListener('pointercancel',()=>{hoverStarted=0;clearTimeout(readyTimer);expose(sceneWin,'default')},false);
 canvas.addEventListener('pointerleave',()=>{hoverStarted=0;clearTimeout(readyTimer);expose(sceneWin,'default')},false);
}
function bindScene(){
 const live=document.getElementById('liveArea');if(!live)return false;
 let zone;try{zone=live.contentDocument}catch(e){return false}
 const scene=zone?.querySelector('.scene');if(!scene)return false;
 const attempt=()=>{try{const doc=scene.contentDocument,canvas=doc?.getElementById('environmentLayer');if(canvas)attachCanvas(canvas,scene.contentWindow)}catch(e){}};
 scene.addEventListener('load',attempt);attempt();return true;
}
function boot(){
 if(bindScene())return;
 let tries=0;const timer=setInterval(()=>{tries++;if(bindScene()||tries>240)clearInterval(timer)},100);
}
boot();
window.PastureHandCursor=Object.freeze({getState:()=>residentHandState});
})();
