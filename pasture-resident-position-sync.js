(()=>{
'use strict';
if(window.top!==window)return;

const CACHE_PREFIX='pasture-resident-position-v3:';
let syncKey='';
let syncing=false;
let dragPointer=null;
let bootAttempts=0;

function runtime(){return window.PastureResidentRuntime||null;}
function currentMode(){return innerHeight>innerWidth*1.08?'portrait':'landscape';}
function scaleForY(y,mode){return mode==='portrait'?.38+Math.max(0,Math.min(1,(y-220)/235))*.82:.27+Math.max(0,Math.min(1,(y-165)/120))*.62;}
function dateKey(){
  try{
    const requested=document.getElementById('pastureFrame')?.contentWindow?.__tongluFlockDateRequested;
    if(/^\d{4}-\d{2}-\d{2}$/.test(String(requested||'')))return requested;
  }catch(_){}
  try{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const o=Object.fromEntries(p.map(x=>[x.type,x.value]));
    return o.year+'-'+o.month+'-'+o.day;
  }catch(_){return new Date().toISOString().slice(0,10);}
}
function cacheKey(resident,date,mode){return CACHE_PREFIX+resident.id+':'+mode+':'+date;}
function validPosition(value){return !!value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y));}
function loadCachedPosition(date,mode){
  const resident=runtime()?.getResident?.();
  if(!resident?.id)return null;
  try{
    const raw=localStorage.getItem(cacheKey(resident,date,mode));
    const value=raw?JSON.parse(raw):null;
    return validPosition(value)?{x:Number(value.x),y:Number(value.y),flip:!!value.flip}:null;
  }catch(_){return null;}
}
function cachePosition(date,mode,position){
  const resident=runtime()?.getResident?.();
  if(!resident?.id||!validPosition(position))return;
  try{localStorage.setItem(cacheKey(resident,date,mode),JSON.stringify({x:+Number(position.x).toFixed(2),y:+Number(position.y).toFixed(2),flip:!!position.flip}));}catch(_){}
}
function transient(error){
  const reason=String(error?.reason||error?.message||'');
  return !reason||['request_failed','service_unavailable','database_unavailable','database_not_configured','bad_response','Failed to fetch','Load failed'].some(x=>reason.includes(x));
}
async function loadDailyResidentPosition(dateKey,mode){
  const rt=runtime();
  const resident=rt?.getResident?.();
  if(!resident?.sheep)return null;
  try{
    const data=await rt.call({action:'getDailySheepPosition',dateKey,mode});
    const position=data?.position;
    if(!validPosition(position))throw Object.assign(new Error('bad_response'),{reason:'bad_response'});
    const normalized={x:Number(position.x),y:Number(position.y),flip:!!position.flip};
    cachePosition(dateKey,mode,normalized);
    return normalized;
  }catch(error){
    if(transient(error))return loadCachedPosition(dateKey,mode);
    throw error;
  }
}
async function saveDailyResidentPosition(dateKey,mode,layout){
  const rt=runtime();
  const resident=rt?.getResident?.();
  if(!resident?.sheep||!validPosition(layout))return null;
  const position={x:+Number(layout.x).toFixed(2),y:+Number(layout.y).toFixed(2),flip:!!layout.flip};
  try{
    const data=await rt.call({action:'saveDailySheepPosition',dateKey,mode,...position});
    const saved=validPosition(data?.position)?{x:Number(data.position.x),y:Number(data.position.y),flip:!!data.position.flip}:position;
    cachePosition(dateKey,mode,saved);
    return saved;
  }catch(error){
    if(transient(error))cachePosition(dateKey,mode,position);
    return null;
  }
}
function applyPosition(layout,position,mode){
  if(!layout||!validPosition(position))return false;
  layout.x=Number(position.x);
  layout.y=Number(position.y);
  layout.flip=!!position.flip;
  layout.s=scaleForY(layout.y,mode);
  window.__tongluResidentLayout={x:layout.x,y:layout.y,s:layout.s,flip:layout.flip,mode};
  return true;
}
async function sync(){
  const rt=runtime();
  const resident=rt?.getResident?.();
  const layout=rt?.getLayout?.();
  if(!resident?.sheep||!layout)return false;
  const mode=currentMode(),date=dateKey(),key=resident.id+':'+date+':'+mode;
  if(syncing||syncKey===key)return true;
  syncing=true;
  try{
    const position=await loadDailyResidentPosition(date,mode);
    if(position)applyPosition(layout,position,mode);
    syncKey=key;
    return true;
  }catch(_){return false;}
  finally{syncing=false;}
}
async function persistCurrent(){
  const rt=runtime(),layout=rt?.getLayout?.(),resident=rt?.getResident?.();
  if(!resident?.sheep||!layout)return null;
  return saveDailyResidentPosition(dateKey(),currentMode(),layout);
}
function boot(){
  if(sync()){bootAttempts=0;return;}
  if(bootAttempts++<120)setTimeout(boot,100);
}
window.addEventListener('pasture-resident-saved',()=>{syncKey='';bootAttempts=0;setTimeout(boot,40);});
window.addEventListener('resize',()=>{syncKey='';bootAttempts=0;setTimeout(boot,100);},{passive:true});
window.addEventListener('pointerdown',event=>{
  try{if(runtime()?.residentHit?.(event.clientX,event.clientY))dragPointer=event.pointerId;}catch(_){}
},true);
window.addEventListener('pointerup',event=>{
  if(dragPointer!==event.pointerId)return;
  dragPointer=null;
  setTimeout(()=>{persistCurrent();},0);
},false);
window.addEventListener('pointercancel',event=>{if(dragPointer===event.pointerId)dragPointer=null;},false);

window.PastureResidentPositionSync=Object.freeze({
  loadDailyResidentPosition,
  saveDailyResidentPosition,
  persistCurrent,
  sync,
  dateKey,
  currentMode
});
setTimeout(boot,80);
})();
