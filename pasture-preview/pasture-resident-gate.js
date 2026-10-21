(()=>{
'use strict';
// This gate is for navigation. Entitlement comes ONLY from the server session.
// Historical budao.card.activated.v1 (demo localStorage) is never an authority.
const scene=document.querySelector('.scene');
const HOST_ORIGIN=(()=>{try{return window.parent.location.origin}catch(e){return '*'}})();
const actions=document.querySelector('.actions');
const identity=document.querySelector('.identity');
const nameNode=identity?.querySelector('.name');
const idNode=identity?.querySelector('.bid');
const stateNode=identity?.querySelector('.state');
const daysNode=identity?.querySelector('.days');
let resident=null,pendingArrival=false;
const RESIDENT_OPEN_FEATURES=new Set(['budaoCardBtn']);
function canUseGrass(){
  return !!(resident?.id&&resident?.sheep&&resident?.cardActivated===true);
}
function allowed(button){
  if(!resident?.id)return false;
  return RESIDENT_OPEN_FEATURES.has(button.id)||
    (button.id==='grassBookBtn'&&canUseGrass());
}
function allFeatureButtons(){return [...document.querySelectorAll('.pbtn')]}
function paint(){
  const authenticated=!!resident?.id;
  document.body.classList.toggle('pasture-resident-authenticated',authenticated);
  document.body.classList.toggle('pasture-card-activated',canUseGrass());
  allFeatureButtons().forEach(button=>{
    const locked=!allowed(button);
    button.classList.toggle('pasture-feature-locked',locked);
    if(locked){
      button.setAttribute('aria-disabled','true');
      button.title=button.id==='grassBookBtn'?'请先激活步道卡':'正在建设，暂未开放';
    }else{
      button.removeAttribute('aria-disabled');
      button.removeAttribute('title');
    }
  });
  if(nameNode)nameNode.textContent=authenticated?'牧场居民':'同行者';
  if(idNode)idNode.textContent=authenticated?(resident.emailMasked||'已验证邮箱'):'尚未登录';
  if(stateNode)stateNode.innerHTML='<span class="state-dot"></span>'+(authenticated?(canUseGrass()?'步道卡已激活':'已进入牧场'):'');
  if(daysNode)daysNode.textContent=authenticated&&resident.sheep?'▣  我的羊已进入牧场':'';
}
function sendToPasture(arrival=false,forceReady=false){
  if(arrival)pendingArrival=true;
  let ready=false;
  try{ready=!!scene?.contentWindow&&scene.contentDocument?.readyState==='complete'}catch(e){}
  if(!ready&&!forceReady)return;
  try{
    scene.contentWindow.postMessage({
      type:'pasture-resident-session-v1',
      resident:resident?{id:resident.id,emailMasked:resident.emailMasked,sheep:resident.sheep}:null,
      arrival:!!pendingArrival
    },HOST_ORIGIN);
    pendingArrival=false;
  }catch(e){}
}
function setResident(next,options={}){
  const priorId=resident?.id||null;
  const priorAccess=canUseGrass();
  resident=next?.id?next:null;
  paint();sendToPasture(!!options.arrival);
  if(priorId!==(resident?.id||null)||priorAccess!==canUseGrass()){
    document.dispatchEvent(new CustomEvent('pasture-resident-access-changed',{
      detail:{residentId:resident?.id||null,cardActivated:canUseGrass()}
    }));
  }
}
function clearResident(){setResident(null)}
function lockEvent(event){
  // No test-only override: gating must match the real preview and production.
  const button=event.target.closest?.('.pbtn');
  if(!button||!actions?.contains(button))return;
  if(allowed(button))return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();
  const type=!resident?.id?'pasture-resident-required':
    button.id==='grassBookBtn'?'pasture-card-required':'pasture-feature-locked';
  try{window.parent.postMessage({
    type,label:String(button.textContent||'').replace(/\s+/g,' ').trim().slice(0,24)
  },HOST_ORIGIN)}catch(e){}
}
document.addEventListener('click',lockEvent,true);
document.addEventListener('keydown',event=>{
  if((event.key==='Enter'||event.key===' ')&&event.target.closest?.('.pbtn'))lockEvent(event);
},true);
// The pasture is a nested document. Frame "load" alone is not proof that the
// final resident engine has installed its message listener. Resend when the
// final core acknowledges readiness, and relay its acknowledgement for diagnostics.
window.addEventListener('message',event=>{
  if(event.origin!==HOST_ORIGIN||event.source!==scene?.contentWindow)return;
  if(event.data?.type==='pasture-final-core-ready-v1'){
    sendToPasture(pendingArrival,true);
    window.parent?.postMessage({type:'pasture-pilot-core-ready-v1'},HOST_ORIGIN);
  }
  if(event.data?.type==='pasture-final-resident-status-v1'){
    window.parent?.postMessage({
      type:'pasture-pilot-resident-status-v1',
      received:!!event.data.received,
      painted:!!event.data.painted,
      portrait:!!event.data.portrait
    },HOST_ORIGIN);
  }
},false);
scene?.addEventListener('load',()=>sendToPasture(pendingArrival));
paint();
window.PastureResidentGate=Object.freeze({
  setResident,clearResident,getResident:()=>resident,canUseGrass
});
window.parent?.postMessage({type:'pasture-resident-gate-ready-v1'},HOST_ORIGIN);
})();
