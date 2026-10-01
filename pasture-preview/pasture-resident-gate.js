(()=>{
'use strict';
const scene=document.querySelector('.scene');
const actions=document.querySelector('.actions');
const identity=document.querySelector('.identity');
const nameNode=identity?.querySelector('.name');
const idNode=identity?.querySelector('.bid');
const stateNode=identity?.querySelector('.state');
const daysNode=identity?.querySelector('.days');
let resident=null,pendingArrival=false;

function allFeatureButtons(){
  return [...document.querySelectorAll('.pbtn')];
}
function paint(){
  const authenticated=!!resident;
  document.body.classList.toggle('pasture-resident-authenticated',authenticated);
  allFeatureButtons().forEach(button=>{
    button.classList.toggle('pasture-feature-locked',authenticated);
    if(authenticated){
      button.setAttribute('aria-disabled','true');
      button.title='功能正在生长，成熟后开放';
    }else{
      button.removeAttribute('aria-disabled');
      button.removeAttribute('title');
    }
  });
  if(nameNode)nameNode.textContent=authenticated?'牧场居民':'同行者';
  if(idNode)idNode.textContent=authenticated?(resident.emailMasked||'已验证邮箱'):'尚未登录';
  if(stateNode)stateNode.innerHTML='<span class="state-dot"></span>'+(authenticated?'已进入牧场':'');
  if(daysNode)daysNode.textContent=authenticated&&resident.sheep?'▣  我的羊已进入牧场':'';
}
function sendToPasture(arrival=false){
  if(arrival)pendingArrival=true;
  let ready=false;
  try{ready=!!scene?.contentWindow&&scene.contentDocument?.readyState==='complete'}catch(e){}
  if(!ready)return;
  try{
    scene.contentWindow.postMessage({
      type:'pasture-resident-session-v1',
      resident:resident?{id:resident.id,emailMasked:resident.emailMasked,sheep:resident.sheep}:null,
      arrival:!!pendingArrival
    },location.origin);
    pendingArrival=false;
  }catch(e){}
}
function setResident(next,options={}){
  resident=next||null;
  paint();
  sendToPasture(!!options.arrival);
}
function clearResident(){
  resident=null;
  paint();
  sendToPasture(false);
}
function lockEvent(event){
  if(location.hostname==='127.0.0.1'&&window.__PASTURE_TEST_UNLOCK===true)return;
  const button=event.target.closest('.pbtn');
  if(!button||!actions?.contains(button))return;
  event.preventDefault();
  event.stopPropagation();
  if(typeof event.stopImmediatePropagation==='function')event.stopImmediatePropagation();
  try{
    window.parent.postMessage({
      type:resident?'pasture-feature-locked':'pasture-resident-required',
      label:String(button.textContent||'').replace(/\s+/g,' ').trim().slice(0,24)
    },location.origin);
  }catch(e){}
}
document.addEventListener('click',lockEvent,true);
document.addEventListener('keydown',event=>{
  if((event.key==='Enter'||event.key===' ')&&event.target.closest?.('.pbtn'))lockEvent(event);
},true);
scene?.addEventListener('load',()=>sendToPasture(pendingArrival));
paint();
window.PastureResidentGate=Object.freeze({setResident,clearResident,getResident:()=>resident});
})();