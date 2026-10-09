(()=>{
'use strict';
const API='/api/pasture-auth';
const BLEAT_URL='/pasture-assets/baaa01.mp3';
const core=document.getElementById('pastureCore');
const canvas=document.getElementById('residentCanvas');
const ctx=canvas.getContext('2d',{alpha:true});
const layer=document.getElementById('residentLayer');
const card=layer.querySelector('.resident-card');
const title=document.getElementById('residentTitle');
const copy=document.getElementById('residentCopy');
const body=document.getElementById('residentBody');
const error=document.getElementById('residentError');
const skyZone=document.getElementById('residentSkyZone');
const residentName=document.getElementById('residentName');
const residentId=document.getElementById('residentId');
const toast=document.getElementById('residentToast');

const bodies=[['#f4ecdc','米白'],['#f2e3b3','麦穗'],['#bfd8da','浅蓝灰'],['#dec9c8','豆沙'],['#c7d5b5','青草'],['#d8d7ce','银灰'],['#f1d7bf','杏色'],['#eee8dc','云白']];
const heads=[['#8d836e','褐灰'],['#917d62','麦褐'],['#776d66','深灰'],['#866f70','棕红'],['#727a66','青灰'],['#716a64','炭灰'],['#907461','栗色'],['#746d65','石褐']];
const marks=[['NONE','无记号'],['FACE','脸部浅记号'],['BACK','背部浅记号'],['SOCKS','浅色腿']];

let resident=null,emailDraft='',drag=null,hover=false,arrivalStart=0,bleat=null,coreDoc=null;
let pos={x:0,y:0,flip:false};
const hitMask=document.createElement('canvas');
hitMask.width=32;hitMask.height=28;
const hitCtx=hitMask.getContext('2d',{willReadFrequently:true});

// Five-finger shepherd hand: four separated fingers + one thumb.
const PIXEL_HAND_OPEN='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Cpath fill=%22%231f3140%22 d=%22M14 8h5v15h2V4h5v19h2V2h5v21h2V6h5v19h4v13h-4v5H17v-4h-5v-6H8V20h6z%22/%3E%3Cpath fill=%22%23f2d0a2%22 d=%22M15 9h3v16h5V5h2v20h5V3h2v22h5V7h2v20h3v9h-4v4H19v-3h-5v-6h-4v-9h3v7h4V12h-2z%22/%3E%3C/svg%3E") 24 8, grab';
const PIXEL_HAND_CLOSED='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Cpath fill=%22%231f3140%22 d=%22M12 11h26v4h5v19h-4v6h-5v4H17v-4h-5v-5H8V20h4z%22/%3E%3Cpath fill=%22%23f2d0a2%22 d=%22M14 15h22v4h4v13h-4v5h-4v3H19v-4h-4v-4h-3V22h5v8h4V19h15v-4z%22/%3E%3C/svg%3E") 23 12, grabbing';

function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function setCursor(value){try{if(coreDoc)coreDoc.documentElement.style.cursor=value||'default'}catch(_){}}
function showLayer(){layer.hidden=false;error.textContent=''}
function hideLayer(){layer.hidden=true;error.textContent=''}
function setBusy(button,busy){if(button){button.disabled=!!busy;button.dataset.oldText=button.dataset.oldText||button.textContent;button.textContent=busy?'请稍候…':button.dataset.oldText}}
function showError(reason){
  const map={invalid_email:'请输入有效邮箱。',email_rate_limited:'这个邮箱请求过于频繁，请稍后再试。',rate_limited:'操作过于频繁，请稍后再试。',verification_invalid:'验证码不正确，请重新输入。',verification_expired:'验证码已经过期，请重新获取。',verification_locked:'尝试次数过多，请重新获取验证码。',email_unavailable:'验证码邮件暂时无法发送。',auth_not_configured:'牧场登录服务暂时不可用。',database_not_configured:'牧场登录服务暂时不可用。',service_unavailable:'牧场登录服务暂时不可用。'};
  error.textContent=map[reason]||'暂时没有完成，请再试一次。';
}
async function request(payload,method='POST'){
  const opts={method,credentials:'same-origin',headers:{'Content-Type':'application/json'}};
  if(method!=='GET')opts.body=JSON.stringify(payload||{});
  const r=await fetch(API,opts);let data={};try{data=await r.json()}catch(_){ }
  if(!r.ok||data.ok===false){const e=new Error(data.reason||'service_unavailable');e.reason=data.reason||'service_unavailable';throw e}
  return data;
}
function resetCard(){card.classList.remove('maker-card')}
function showEmail(){
  resetCard();showLayer();title.textContent='进入牧场';copy.textContent='留下一个可以找到你的邮箱。确认以后，你会进入羊群，并在牧场里认出自己。';
  body.innerHTML='<div class="resident-fields"><input id="residentEmail" type="email" inputmode="email" autocomplete="email" placeholder="你的邮箱"></div><div class="resident-actions"><button id="sendCode">发送验证码</button></div>';
  const input=document.getElementById('residentEmail');if(emailDraft)input.value=emailDraft;
  document.getElementById('sendCode').onclick=async e=>{const btn=e.currentTarget;emailDraft=input.value.trim();setBusy(btn,true);error.textContent='';try{await request({action:'requestCode',email:emailDraft});showCode()}catch(err){showError(err.reason)}finally{setBusy(btn,false)}};
}
function showCode(){
  resetCard();showLayer();title.textContent='查收邮件';copy.textContent='验证码已经发送到 '+emailDraft+'。输入 6 位数字，就能继续进入牧场。';
  body.innerHTML='<div class="resident-fields"><input id="residentCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位验证码"></div><div class="resident-actions"><button id="verifyCode">进入牧场</button><button id="changeEmail" class="secondary">换邮箱</button></div>';
  document.getElementById('changeEmail').onclick=showEmail;
  document.getElementById('verifyCode').onclick=async e=>{const btn=e.currentTarget,code=document.getElementById('residentCode').value.trim();setBusy(btn,true);error.textContent='';try{const data=await request({action:'verifyCode',email:emailDraft,code});resident=data.user;if(data.needsSheep||!resident?.sheep)showMaker(false);else applyResident(false)}catch(err){showError(err.reason)}finally{setBusy(btn,false)}};
}
function colorButtons(list,kind){return list.map(([v,n],i)=>'<button type="button" class="pasture-visual-choice" data-sheep-'+kind+'="'+esc(v)+'" aria-pressed="'+(i===0?'true':'false')+'" aria-label="'+esc(n)+'"><span class="pasture-sheep-chip" style="--chip:'+esc(v)+'" aria-hidden="true"><i></i></span><span>'+esc(n)+'</span></button>').join('')}
function markButtons(){return marks.map(([v,n],i)=>'<button type="button" class="pasture-mark-choice" data-sheep-mark="'+v+'" aria-pressed="'+(i===0?'true':'false')+'"><span class="pasture-mark-icon mark-'+v.toLowerCase()+'" aria-hidden="true"><i></i></span><span>'+n+'</span></button>').join('')}
function drawMakerPreview(state){
  const c=document.getElementById('pastureSheepPreview');if(!c)return;
  const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1)),cssW=Math.max(280,c.clientWidth||520),cssH=Math.round(cssW*.46);
  c.width=Math.round(cssW*dpr);c.height=Math.round(cssH*dpr);const pc=c.getContext('2d');pc.setTransform(dpr,0,0,dpr,0,0);pc.imageSmoothingEnabled=false;pc.clearRect(0,0,cssW,cssH);
  pc.fillStyle='#bfe7cd';pc.fillRect(0,0,cssW,cssH);pc.fillStyle='#89bd79';pc.fillRect(0,cssH*.72,cssW,cssH*.28);
  const unit=Math.max(4,Math.floor(cssW/92));drawSheep(pc,Math.floor(cssW/2),Math.floor(cssH*.64),unit,state,false);
}
function chooseMaker(selector,key,value,state){
  state[key]=value;
  const attr=key==='bodyColor'?'data-sheep-body':key==='headColor'?'data-sheep-head':'data-sheep-mark';
  document.querySelectorAll(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute(attr)===value)));
  drawMakerPreview(state);
}
function showMaker(review=false){
  const state={bodyColor:bodies[0][0],headColor:heads[0][0],marking:'NONE'};
  card.classList.add('maker-card');showLayer();title.textContent='捏一只羊';copy.textContent=review?'审看模式：可以反复试捏，不会覆盖现在牧场里的你。':'这只羊就是你在数字牧场中的样子。别填表，看着它，一点一点捏成你认得出的样子。完成以后，你会从天空落进羊群。';
  body.innerHTML='<canvas id="pastureSheepPreview" role="img" aria-label="羊的实时预览"></canvas><p class="maker-note">这不是一只宠物，而是你在羊群中的样子。</p><div class="pasture-choice"><strong>羊毛</strong><div class="row">'+colorButtons(bodies,'body')+'</div></div><div class="pasture-choice"><strong>脸</strong><div class="row">'+colorButtons(heads,'head')+'</div></div><div class="pasture-choice"><strong>记号</strong><div class="row pasture-mark-row">'+markButtons()+'</div></div><div class="resident-actions pasture-sheep-finish"><button id="saveSheep" type="button">'+(review?'完成审看 · 回到牧场':'这就是我 · 进入牧场')+'</button></div>';
  document.querySelectorAll('[data-sheep-body]').forEach(b=>b.onclick=()=>chooseMaker('[data-sheep-body]','bodyColor',b.dataset.sheepBody,state));
  document.querySelectorAll('[data-sheep-head]').forEach(b=>b.onclick=()=>chooseMaker('[data-sheep-head]','headColor',b.dataset.sheepHead,state));
  document.querySelectorAll('[data-sheep-mark]').forEach(b=>b.onclick=()=>chooseMaker('[data-sheep-mark]','marking',b.dataset.sheepMark,state));
  drawMakerPreview(state);requestAnimationFrame(()=>drawMakerPreview(state));
  document.getElementById('saveSheep').onclick=async e=>{
    const btn=e.currentTarget;if(review){hideLayer();resetCard();applyResident(false);return}
    setBusy(btn,true);error.textContent='';try{const data=await request({action:'saveSheep',bodyColor:state.bodyColor,headColor:state.headColor,marking:state.marking});resident=data.user;resetCard();applyResident(!!data.created)}catch(err){showError(err.reason);setBusy(btn,false)}
  };
}
function positionKey(){return 'budao-pasture-resident-pos:'+String(resident?.id||'guest')}
function initialPosition(){
  try{const saved=JSON.parse(localStorage.getItem(positionKey())||'null');if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))return{x:saved.x*innerWidth,y:saved.y*innerHeight,flip:!!saved.flip}}catch(_){ }
  let h=0;for(const c of String(resident?.id||''))h=(h*31+c.charCodeAt(0))>>>0;
  return{x:innerWidth*(.22+(h%55)/100),y:innerHeight*(.62+((h>>>7)%22)/100),flip:!!(h&1)};
}
function savePosition(){try{localStorage.setItem(positionKey(),JSON.stringify({x:pos.x/innerWidth,y:pos.y/innerHeight,flip:pos.flip}))}catch(_){ }}
function unitForY(y){const t=Math.max(0,Math.min(1,(y-innerHeight*.48)/(innerHeight*.46)));return Math.max(1.1,Math.min(3.4,1.1+t*2.3))}
function resizeCanvas(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;draw()}
function sheepRects(appearance){
  const rects=[['body',2,7,18,9,appearance.bodyColor],['wool',5,3,13,13,appearance.bodyColor],['top',8,1,8,14,appearance.bodyColor],['head',19,9,7,7,appearance.headColor],['muzzle',25,11,3,3,appearance.headColor],['leg1',6,15,3,8,'#5d5851'],['leg2',15,15,3,8,'#5d5851'],['eye',24,11,1,1,'#342f2c']];
  if(appearance.marking==='FACE')rects.push(['mark',20,9,3,3,'#f7efe1']);
  if(appearance.marking==='BACK')rects.push(['mark',7,4,8,3,'#fff3dd']);
  if(appearance.marking==='SOCKS'){rects.push(['sock',6,20,3,3,'#f4eee4']);rects.push(['sock',15,20,3,3,'#f4eee4'])}
  return rects;
}
function drawSheep(target,x,y,unit,appearance,flip){
  target.save();target.imageSmoothingEnabled=false;target.translate(Math.round(x),Math.round(y));if(flip)target.scale(-1,1);
  for(const [,rx,ry,rw,rh,color] of sheepRects(appearance)){target.fillStyle=color;target.fillRect(Math.round((rx-15)*unit),Math.round((ry-23)*unit),Math.max(1,Math.round(rw*unit)),Math.max(1,Math.round(rh*unit)))}
  target.restore();
}
function rebuildHitMask(){hitCtx.clearRect(0,0,32,28);if(!resident?.sheep)return;hitCtx.fillStyle='#000';for(const [,x,y,w,h] of sheepRects(resident.sheep))hitCtx.fillRect(x,y,w,h)}
function draw(now=performance.now()){
  ctx.clearRect(0,0,innerWidth,innerHeight);if(!resident?.sheep)return;
  let x=pos.x,y=pos.y;if(arrivalStart){const t=Math.min(1,(now-arrivalStart)/1750),ease=1-Math.pow(1-t,3);y=-50+(pos.y+50)*ease;x=pos.x+Math.sin(t*Math.PI*4)*(1-t)*9;if(t<1)requestAnimationFrame(draw);else arrivalStart=0}
  const u=unitForY(pos.y);ctx.fillStyle='rgba(55,91,54,.16)';ctx.fillRect(Math.round(pos.x-17*u),Math.round(pos.y+1),Math.round(28*u),Math.max(2,Math.round(2*u)));drawSheep(ctx,x,y,u,resident.sheep,pos.flip);window.__pastureFlockCount=45;
}
function hitTest(clientX,clientY){
  if(!resident?.sheep||arrivalStart)return false;const u=unitForY(pos.y),left=pos.x-15*u,top=pos.y-23*u;let lx=Math.floor((clientX-left)/u),ly=Math.floor((clientY-top)/u);if(pos.flip)lx=30-lx;if(lx<0||ly<0||lx>=hitMask.width||ly>=hitMask.height)return false;return hitCtx.getImageData(lx,ly,1,1).data[3]>0;
}
function attachCoreInteraction(){
  try{coreDoc=core.contentDocument;if(!coreDoc)return;const path=core.contentWindow.location.pathname;if(path==='/home.html'){location.href='/home.html';return}coreDoc.addEventListener('pointermove',onPointerMove,{passive:false});coreDoc.addEventListener('pointerdown',onPointerDown,{passive:false});coreDoc.addEventListener('pointerup',onPointerUp,{passive:false});coreDoc.addEventListener('pointercancel',onPointerUp,{passive:false});coreDoc.addEventListener('pointerleave',()=>{if(!drag){hover=false;setCursor('default')}})}catch(_){coreDoc=null}
}
function onPointerMove(e){if(drag){pos.x=Math.max(18,Math.min(innerWidth-18,e.clientX-drag.dx));pos.y=Math.max(innerHeight*.48,Math.min(innerHeight*.94,e.clientY-drag.dy));setCursor(PIXEL_HAND_CLOSED);drag.moved=true;draw();e.preventDefault();return}hover=hitTest(e.clientX,e.clientY);setCursor(hover?PIXEL_HAND_OPEN:'default')}
function onPointerDown(e){if(!hitTest(e.clientX,e.clientY))return;drag={id:e.pointerId,dx:e.clientX-pos.x,dy:e.clientY-pos.y,moved:false};try{coreDoc.documentElement.setPointerCapture?.(e.pointerId)}catch(_){ }setCursor(PIXEL_HAND_CLOSED);e.preventDefault()}
function onPointerUp(e){if(!drag||drag.id!==e.pointerId)return;try{coreDoc.documentElement.releasePointerCapture?.(e.pointerId)}catch(_){ }const moved=drag.moved;drag=null;savePosition();hover=hitTest(e.clientX,e.clientY);setCursor(hover?PIXEL_HAND_OPEN:'default');draw();if(moved)playBleat()}
function playBleat(){try{if(!bleat){bleat=new Audio(BLEAT_URL);bleat.preload='auto'}bleat.pause();bleat.currentTime=0;const p=bleat.play();if(p?.catch)p.catch(()=>{})}catch(_){ }}
function showToast(message){toast.textContent=message;toast.hidden=false;setTimeout(()=>toast.hidden=true,2200)}
function updateResidentUi(){
  if(residentName)residentName.textContent='牧场居民';
  if(residentId)residentId.textContent=resident?.emailMasked||resident?.email_masked||'已进入羊群';
  document.querySelectorAll('.pasture-feature-locked').forEach(el=>{el.title='功能正在生长，成熟后开放';el.onclick=e=>{e.preventDefault();showToast('功能正在生长，成熟后开放')}});
}
function applyResident(arrival){hideLayer();skyZone.hidden=false;updateResidentUi();pos=initialPosition();rebuildHitMask();if(arrival){arrivalStart=performance.now();showToast('你已经进入羊群');requestAnimationFrame(draw)}else draw()}
async function boot(){resizeCanvas();core.addEventListener('load',attachCoreInteraction);attachCoreInteraction();try{const data=await request(null,'GET');resident=data.user;if(!resident)return showEmail();if(!resident.sheep)return showMaker(false);applyResident(false)}catch(err){showEmail();showError(err.reason)}}
window.addEventListener('resize',()=>{if(document.getElementById('pastureSheepPreview'))requestAnimationFrame(()=>{const state={bodyColor:bodies[0][0],headColor:heads[0][0],marking:'NONE'};drawMakerPreview(state)});if(resident?.sheep){const saved={x:pos.x/Math.max(1,innerWidth),y:pos.y/Math.max(1,innerHeight)};resizeCanvas();pos.x=Math.max(18,Math.min(innerWidth-18,saved.x*innerWidth));pos.y=Math.max(innerHeight*.48,Math.min(innerHeight*.94,saved.y*innerHeight));draw()}else resizeCanvas()});
window.PastureSheepMaker=Object.freeze({openReview:()=>{if(resident?.sheep)showMaker(true)}});
boot();
})();
