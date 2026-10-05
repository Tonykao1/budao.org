(()=>{
'use strict';
if(window.top!==window)return;

const SVG_NS='http://www.w3.org/2000/svg';
const hitRects=[
  [0,0,16,8],
  [3,-4,11,13],
  [6,-6,7,15],
  [13,2,7,7],
  [19,4,2,3],
  [12,3,2,2],
  [17,4,1,1],
  [4,8,2,6],
  [11,8,2,6]
];

function makeSvg(){
  const svg=document.createElementNS(SVG_NS,'svg');
  svg.id='pastureResidentHitSvg';
  svg.setAttribute('aria-hidden','true');
  Object.assign(svg.style,{
    position:'fixed',inset:'0',width:'100%',height:'100%',zIndex:'6',
    pointerEvents:'none',overflow:'visible',touchAction:'none'
  });
  const outer=document.createElementNS(SVG_NS,'g');
  const inner=document.createElementNS(SVG_NS,'g');
  outer.appendChild(inner);
  svg.appendChild(outer);
  for(const [x,y,w,h] of hitRects){
    const rect=document.createElementNS(SVG_NS,'rect');
    rect.setAttribute('x',String(x));
    rect.setAttribute('y',String(y));
    rect.setAttribute('width',String(w));
    rect.setAttribute('height',String(h));
    rect.setAttribute('fill','transparent');
    rect.style.pointerEvents='all';
    inner.appendChild(rect);
  }
  document.body.appendChild(svg);
  return{svg,outer,inner};
}

let parts=null;
let disabledUntil=0;
let arrivalToastSeen=false;

function runtimeReady(){
  return window.PastureResidentRuntime&&typeof window.PastureResidentRuntime.getResident==='function';
}

function updateHitLayer(now){
  if(!parts)parts=makeSvg();
  const portraitFrame=document.getElementById('portraitFrame');
  const portrait=innerHeight>innerWidth*1.08;
  parts.svg.setAttribute('viewBox',portrait?'0 0 300 480':'0 0 480 300');
  // The SVG sits above portraitFrame (z-index 3) but only painted sheep rectangles accept pointers.
  if(portraitFrame)parts.svg.dataset.portraitFrame=portraitFrame.id;

  if(!runtimeReady()){
    parts.outer.style.display='none';
    requestAnimationFrame(updateHitLayer);
    return;
  }

  const resident=window.PastureResidentRuntime.getResident();
  const toast=document.getElementById('pastureResidentToast');
  const arrivalToast=!!(toast&&toast.classList.contains('show')&&toast.textContent.includes('你已经进入牧场'));
  if(arrivalToast&&!arrivalToastSeen){disabledUntil=now+1900;arrivalToastSeen=true;}
  if(!resident){arrivalToastSeen=false;disabledUntil=0;}

  const layout=window.__tongluResidentLayout||window.PastureResidentRuntime.getLayout();
  if(!resident?.sheep||!layout||now<disabledUntil){
    parts.outer.style.display='none';
    requestAnimationFrame(updateHitLayer);
    return;
  }

  const x=Number(layout.x)||0;
  const y=Number(layout.y)||0;
  const s=Math.max(.001,Number(layout.s)||1);
  parts.outer.style.display='';
  parts.outer.setAttribute('transform',`translate(${x} ${y}) scale(${s})`);
  parts.inner.setAttribute('transform',layout.flip?'translate(21 0) scale(-1 1)':'');
  requestAnimationFrame(updateHitLayer);
}

function capturePointer(event){
  if(event.target===parts?.svg||event.target===parts?.outer||event.target===parts?.inner)return;
  if(typeof event.target.setPointerCapture==='function'){
    try{event.target.setPointerCapture(event.pointerId);}catch(_){}
  }
}
function releasePointer(event){
  if(typeof event.target.releasePointerCapture==='function'){
    try{
      if(!event.target.hasPointerCapture||event.target.hasPointerCapture(event.pointerId)){
        event.target.releasePointerCapture(event.pointerId);
      }
    }catch(_){}
  }
}

document.addEventListener('pointerdown',capturePointer,true);
document.addEventListener('pointerup',releasePointer,true);
document.addEventListener('pointercancel',releasePointer,true);
requestAnimationFrame(updateHitLayer);
})();
