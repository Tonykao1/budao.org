(()=>{
'use strict';
if(window.top!==window)return;

const MIN_SCALE={landscape:.58,portrait:.68};
const LOGICAL={landscape:[480,300],portrait:[300,480]};
const SHEEP_COLORS=[
  '#f4ecdc','#f2e3b3','#bfd8da','#dec9c8','#c7d5b5','#d8d7ce','#f1d7bf','#eee8dc',
  '#8d836e','#917d62','#776d66','#866f70','#727a66','#716a64','#907461','#746d65',
  '#f3ead7','#d5c7a8','#987b68','#806f67','#78806d','#81745d','#756d66','#887e6e',
  '#947966','#747c68','#806a6c','#897f70','#80725c','#756d68','#8b785f','#816b6d',
  '#857b6c','#b98f79','#302d2a','#4a4642','#eeeae2','#5d5851'
].map(hex=>[
  parseInt(hex.slice(1,3),16),
  parseInt(hex.slice(3,5),16),
  parseInt(hex.slice(5,7),16)
]);

let settledKey='';
let attempts=0;

function mode(){return innerHeight>innerWidth*1.08?'portrait':'landscape';}
function dateKey(){
  try{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
    return o.year+'-'+o.month+'-'+o.day;
  }catch(_){return new Date().toISOString().slice(0,10);}
}
function scaleFor(y,m){
  const natural=m==='portrait'
    ?.38+Math.max(0,Math.min(1,(y-220)/235))*.82
    :.27+Math.max(0,Math.min(1,(y-165)/120))*.62;
  return Math.max(MIN_SCALE[m],natural);
}
function blockedPixel(r,g,b,a){
  if(a<180)return false;
  for(const c of SHEEP_COLORS){
    const d=Math.abs(r-c[0])+Math.abs(g-c[1])+Math.abs(b-c[2]);
    if(d<=12)return true;
  }
  return false;
}
function sourceCanvases(m){
  const result=[];
  if(m==='landscape'){
    const env=document.getElementById('environmentLayer');
    if(env?.getContext)result.push(env);
    try{
      const c=document.getElementById('pastureFrame')?.contentDocument?.getElementById('pasture');
      if(c?.getContext)result.push(c);
    }catch(_){}
  }else{
    try{
      const c=document.getElementById('portraitFrame')?.contentDocument?.getElementById('pasture');
      if(c?.getContext)result.push(c);
    }catch(_){}
  }
  return result;
}
function scoreCandidate(o,m){
  const [lw,lh]=LOGICAL[m];
  const left=Math.max(0,o.x-8*o.s),top=Math.max(0,o.y-10*o.s);
  const right=Math.min(lw,o.x+30*o.s),bottom=Math.min(lh,o.y+24*o.s);
  let blocked=0;
  for(const canvas of sourceCanvases(m)){
    try{
      const sx=canvas.width/lw,sy=canvas.height/lh;
      const x=Math.max(0,Math.floor(left*sx)),y=Math.max(0,Math.floor(top*sy));
      const w=Math.max(1,Math.min(canvas.width-x,Math.ceil((right-left)*sx)));
      const h=Math.max(1,Math.min(canvas.height-y,Math.ceil((bottom-top)*sy)));
      const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(x,y,w,h).data;
      for(let i=0;i<data.length;i+=4)if(blockedPixel(data[i],data[i+1],data[i+2],data[i+3]))blocked++;
    }catch(_){}
  }
  return blocked;
}
function candidates(m){
  const pts=m==='portrait'
    ?[[42,278],[52,338],[46,408],[92,438],[242,252],[250,316],[255,386],[218,438]]
    :[[52,212],[112,246],[175,214],[235,252],[298,218],[78,274],[205,276],[286,268]];
  return pts.map(([x,y],i)=>({x,y,s:scaleFor(y,m),flip:i%2===1}));
}
function findClearCandidate(m){
  let best=null,bestScore=Infinity;
  for(const candidate of candidates(m)){
    const score=scoreCandidate(candidate,m);
    if(score<bestScore){bestScore=score;best=candidate;}
    if(score===0)break;
  }
  return best;
}
function persist(resident,layout,m){
  try{
    const key='pasture-resident-position-v2:'+resident.id+':'+m+':'+dateKey();
    localStorage.setItem(key,JSON.stringify({x:+layout.x.toFixed(2),y:+layout.y.toFixed(2),flip:!!layout.flip}));
  }catch(_){}
}
function ensureFindable(){
  const runtime=window.PastureResidentRuntime;
  if(!runtime||typeof runtime.getResident!=='function'||typeof runtime.getLayout!=='function'){
    if(attempts++<80)setTimeout(ensureFindable,100);
    return;
  }
  const resident=runtime.getResident();
  const layout=runtime.getLayout();
  if(!resident?.sheep||!layout){if(attempts++<80)setTimeout(ensureFindable,100);return;}
  const m=mode(),key=resident.id+':'+m+':'+dateKey();
  if(settledKey===key)return;
  const sources=sourceCanvases(m);
  if(!sources.length&&attempts++<80){setTimeout(ensureFindable,100);return;}

  const currentScore=scoreCandidate(layout,m);
  if(Number(layout.s)>=MIN_SCALE[m]&&currentScore===0){settledKey=key;return;}

  const target=findClearCandidate(m);
  if(target){
    layout.x=target.x;
    layout.y=target.y;
    layout.s=target.s;
    layout.flip=target.flip;
    persist(resident,layout,m);
    window.__tongluResidentLayout={x:layout.x,y:layout.y,s:layout.s,flip:layout.flip,mode:m};
  }
  settledKey=key;
}

window.addEventListener('resize',()=>{settledKey='';attempts=0;setTimeout(ensureFindable,120);},{passive:true});
window.addEventListener('pasture-resident-saved',()=>{settledKey='';attempts=0;setTimeout(ensureFindable,60);});
setTimeout(ensureFindable,120);
window.PastureResidentFindability=Object.freeze({blockedPixel,findClearCandidate,ensureFindable});
})();
