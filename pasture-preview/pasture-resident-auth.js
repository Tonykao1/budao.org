(()=>{
'use strict';
const API='/api/pasture-auth';
const live=document.getElementById('liveArea');
const layer=document.createElement('div');
layer.id='pastureResidentLayer';
layer.innerHTML='<div class="pasture-resident-card" role="dialog" aria-modal="true" aria-labelledby="pastureResidentTitle"></div>';
document.body.appendChild(layer);
const card=layer.firstElementChild;
const toast=document.createElement('div');
toast.id='pastureResidentToast';toast.setAttribute('role','status');document.body.appendChild(toast);
let user=null,email='',busy=false,timer=0;
const sheepMakerReview=new URLSearchParams(location.search).get('sheepmaker')==='review';
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function msg(v){const n=document.getElementById('pastureResidentMessage');if(n)n.textContent=v||''}
function pop(v){clearTimeout(timer);toast.textContent=v;toast.classList.add('show');timer=setTimeout(()=>toast.classList.remove('show'),2200)}
async function call(body,method='POST'){
 const r=await fetch(API,{method,credentials:'include',headers:method==='POST'?{'Content-Type':'application/json'}:undefined,body:method==='POST'?JSON.stringify(body):undefined,cache:'no-store'});
 const d=await r.json().catch(()=>({ok:false,reason:'bad_response'}));
 if(!r.ok||!d.ok){const e=new Error(d.reason||'request_failed');e.reason=d.reason;throw e}
 return d;
}
function friendly(reason){return({invalid_email:'请检查邮箱地址。',verification_invalid:'验证码不正确。',verification_expired:'验证码已过期，请重新发送。',verification_locked:'尝试次数过多，请重新发送验证码。',email_rate_limited:'验证码发送过于频繁，请稍后再试。',rate_limited:'操作过于频繁，请稍后再试。',service_unavailable:'牧场登录暂时不可用。',auth_not_configured:'牧场登录尚未完成服务配置。',database_not_configured:'牧场账户数据库尚未连接。'})[reason]||'暂时没有完成，请再试一次。'}
function apply(arrival=false){
 try{live?.contentWindow?.PastureResidentGate?.setResident(user,{arrival})}catch(e){}
}
live?.addEventListener('load',()=>{if(user)setTimeout(()=>apply(false),50)});
window.addEventListener('message',e=>{if(e.origin!==location.origin)return;if(e.data?.type==='pasture-feature-locked')pop((e.data.label||'这个功能')+' · 正在生长');if(e.data?.type==='pasture-resident-required'){pop('请先验证邮箱，成为牧场居民');layer.hidden=false}});
function emailView(){
 layer.hidden=false;
 card.innerHTML='<h1 id="pastureResidentTitle">进入牧场</h1><p>留下一个有效邮箱。验证之后，你会成为牧场居民。</p><label for="pastureEmail">邮箱</label><input id="pastureEmail" type="email" autocomplete="email" placeholder="name@example.com" value="'+esc(email)+'"><div class="pasture-resident-actions"><button id="pastureSendCode" type="button">发送验证码</button></div><div class="pasture-resident-message" id="pastureResidentMessage" aria-live="polite"></div>';
 document.getElementById('pastureSendCode').onclick=sendCode;
}
async function sendCode(){
 if(busy)return;email=document.getElementById('pastureEmail').value.trim().toLowerCase();busy=true;msg('正在发送……');
 try{await call({action:'requestCode',email});codeView()}catch(e){msg(friendly(e.reason))}finally{busy=false}
}
function codeView(){
 layer.hidden=false;
 card.innerHTML='<h1 id="pastureResidentTitle">查收邮件</h1><p>验证码已发送到 <strong>'+esc(email)+'</strong>。</p><label for="pastureCode">6位验证码</label><input id="pastureCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"><div class="pasture-resident-actions"><button id="pastureVerify" type="button">进入牧场</button><button id="pastureBack" class="secondary" type="button">换邮箱</button></div><div class="pasture-resident-message" id="pastureResidentMessage" aria-live="polite"></div>';
 document.getElementById('pastureVerify').onclick=verify;document.getElementById('pastureBack').onclick=emailView;
}
async function verify(){
 if(busy)return;busy=true;msg('正在确认……');
 try{const d=await call({action:'verifyCode',email,code:document.getElementById('pastureCode').value.trim()});user=d.user;if(d.needsSheep||!user?.sheep){window.dispatchEvent(new CustomEvent('pasture-needs-sheep',{detail:{user}}));}else{layer.hidden=true;apply(false)}}catch(e){msg(friendly(e.reason))}finally{busy=false}
}
function openReviewMaker(){
 setTimeout(()=>window.dispatchEvent(new CustomEvent('pasture-needs-sheep',{detail:{user,review:true}})),0);
}
async function boot(){
 try{
  const d=await call(null,'GET');user=d.user||null;
  if(sheepMakerReview){openReviewMaker();return}
  if(!user){emailView();return}
  if(!user.sheep){window.dispatchEvent(new CustomEvent('pasture-needs-sheep',{detail:{user}}));return}
  layer.hidden=true;apply(false)
 }catch(e){
  if(sheepMakerReview){openReviewMaker();return}
  emailView();msg(friendly(e.reason))
 }
}
window.PastureResidentAuth={getUser:()=>user,setUser:v=>{user=v},apply,layer,card,call,pop,friendly};
boot();
})();
