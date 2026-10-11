(()=>{
'use strict';
const API='/api/pasture-auth';
const core=document.getElementById('pastureCore');
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
let resident=null,emailDraft='';

function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showLayer(){layer.hidden=false;error.textContent=''}
function hideLayer(){layer.hidden=true;error.textContent=''}
function setBusy(button,busy){if(button){button.disabled=!!busy;button.dataset.oldText=button.dataset.oldText||button.textContent;button.textContent=busy?'请稍候…':button.dataset.oldText}}
function showError(reason){const map={invalid_email:'请输入有效邮箱。',email_rate_limited:'这个邮箱请求过于频繁，请稍后再试。',rate_limited:'操作过于频繁，请稍后再试。',verification_invalid:'验证码不正确，请重新输入。',verification_expired:'验证码已经过期，请重新获取。',verification_locked:'尝试次数过多，请重新获取验证码。',email_unavailable:'验证码邮件暂时无法发送。',auth_not_configured:'牧场登录服务暂时不可用。',database_not_configured:'牧场登录服务暂时不可用。',service_unavailable:'牧场登录服务暂时不可用。'};error.textContent=map[reason]||'暂时没有完成，请再试一次。'}
async function request(payload,method='POST'){const opts={method,credentials:'same-origin',headers:{'Content-Type':'application/json'}};if(method!=='GET')opts.body=JSON.stringify(payload||{});const r=await fetch(API,opts);let data={};try{data=await r.json()}catch(_){ }if(!r.ok||data.ok===false){const e=new Error(data.reason||'service_unavailable');e.reason=data.reason||'service_unavailable';throw e}return data}
function resetCard(){card.classList.remove('maker-card')}
function showToast(message){toast.textContent=message;toast.hidden=false;setTimeout(()=>toast.hidden=true,2200)}
function updateResidentUi(){if(residentName)residentName.textContent='牧场居民';if(residentId)residentId.textContent=resident?.emailMasked||resident?.email_masked||'已进入羊群';document.querySelectorAll('.pasture-feature-locked').forEach(el=>{el.title='功能正在生长，成熟后开放';el.onclick=e=>{e.preventDefault();showToast('功能正在生长，成熟后开放')}})}
function sendResidentToCore(arrival=false){if(!resident?.sheep||!core.contentWindow)return;core.contentWindow.postMessage({type:'tonglu-resident-v1',resident:{id:resident.id,sheep:resident.sheep},arrival:!!arrival},location.origin)}
function applyResident(arrival=false){hideLayer();skyZone.hidden=false;updateResidentUi();sendResidentToCore(arrival);if(arrival)showToast('你已经进入羊群')}

function showEmail(){resetCard();showLayer();title.textContent='进入牧场';copy.textContent='留下一个可以找到你的邮箱。确认以后，你会进入羊群，并在牧场里认出自己。';body.innerHTML='<div class="resident-fields"><input id="residentEmail" type="email" inputmode="email" autocomplete="email" placeholder="你的邮箱"></div><div class="resident-actions"><button id="sendCode">发送验证码</button></div>';const input=document.getElementById('residentEmail');if(emailDraft)input.value=emailDraft;document.getElementById('sendCode').onclick=async e=>{const btn=e.currentTarget;emailDraft=input.value.trim();setBusy(btn,true);error.textContent='';try{await request({action:'requestCode',email:emailDraft});showCode()}catch(err){showError(err.reason)}finally{setBusy(btn,false)}}}
function showCode(){resetCard();showLayer();title.textContent='查收邮件';copy.textContent='验证码已经发送到 '+emailDraft+'。输入 6 位数字，就能继续进入牧场。';body.innerHTML='<div class="resident-fields"><input id="residentCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位验证码"></div><div class="resident-actions"><button id="verifyCode">进入牧场</button><button id="changeEmail" class="secondary">换邮箱</button></div>';document.getElementById('changeEmail').onclick=showEmail;document.getElementById('verifyCode').onclick=async e=>{const btn=e.currentTarget,code=document.getElementById('residentCode').value.trim();setBusy(btn,true);error.textContent='';try{const data=await request({action:'verifyCode',email:emailDraft,code});resident=data.user;if(data.needsSheep||!resident?.sheep)showMaker(false);else applyResident(false)}catch(err){showError(err.reason)}finally{setBusy(btn,false)}}}

function colorButtons(list,kind){return list.map(([v,n],i)=>'<button type="button" class="pasture-visual-choice" data-sheep-'+kind+'="'+esc(v)+'" aria-pressed="'+(i===0?'true':'false')+'" aria-label="'+esc(n)+'"><span class="pasture-sheep-chip" style="--chip:'+esc(v)+'" aria-hidden="true"><i></i></span><span>'+esc(n)+'</span></button>').join('')}
function markButtons(){return marks.map(([v,n],i)=>'<button type="button" class="pasture-mark-choice" data-sheep-mark="'+v+'" aria-pressed="'+(i===0?'true':'false')+'"><span class="pasture-mark-icon mark-'+v.toLowerCase()+'" aria-hidden="true"><i></i></span><span>'+n+'</span></button>').join('')}
function makerRects(appearance){const rects=[[2,7,18,9,appearance.bodyColor],[5,3,13,13,appearance.bodyColor],[8,1,8,14,appearance.bodyColor],[19,9,7,7,appearance.headColor],[25,11,3,3,appearance.headColor],[6,15,3,8,'#5d5851'],[15,15,3,8,'#5d5851'],[24,11,1,1,'#342f2c']];if(appearance.marking==='FACE')rects.push([20,9,3,3,'#f7efe1']);if(appearance.marking==='BACK')rects.push([7,4,8,3,'#fff3dd']);if(appearance.marking==='SOCKS'){rects.push([6,20,3,3,'#f4eee4']);rects.push([15,20,3,3,'#f4eee4'])}return rects}
function drawMakerSheep(target,x,y,unit,appearance){target.save();target.imageSmoothingEnabled=false;target.translate(Math.round(x),Math.round(y));for(const [rx,ry,rw,rh,color] of makerRects(appearance)){target.fillStyle=color;target.fillRect(Math.round((rx-15)*unit),Math.round((ry-23)*unit),Math.max(1,Math.round(rw*unit)),Math.max(1,Math.round(rh*unit)))}target.restore()}
function drawMakerPreview(state){const c=document.getElementById('pastureSheepPreview');if(!c)return;const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1)),cssW=Math.max(280,c.clientWidth||520),cssH=Math.round(cssW*.46);c.width=Math.round(cssW*dpr);c.height=Math.round(cssH*dpr);const pc=c.getContext('2d');pc.setTransform(dpr,0,0,dpr,0,0);pc.imageSmoothingEnabled=false;pc.clearRect(0,0,cssW,cssH);pc.fillStyle='#bfe7cd';pc.fillRect(0,0,cssW,cssH);pc.fillStyle='#89bd79';pc.fillRect(0,cssH*.72,cssW,cssH*.28);const unit=Math.max(4,Math.floor(cssW/92));drawMakerSheep(pc,Math.floor(cssW/2),Math.floor(cssH*.64),unit,state)}
function chooseMaker(selector,key,value,state){state[key]=value;const attr=key==='bodyColor'?'data-sheep-body':key==='headColor'?'data-sheep-head':'data-sheep-mark';document.querySelectorAll(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute(attr)===value)));drawMakerPreview(state)}
function showMaker(review=false){const state={bodyColor:bodies[0][0],headColor:heads[0][0],marking:'NONE'};card.classList.add('maker-card');showLayer();title.textContent='捏一只羊';copy.textContent=review?'审看模式：可以反复试捏，不会覆盖现在牧场里的你。':'这只羊就是你在数字牧场中的样子。看着它，一点一点捏成你认得出的样子。完成以后，你会从天空落进羊群。';body.innerHTML='<canvas id="pastureSheepPreview" role="img" aria-label="羊的实时预览"></canvas><p class="maker-note">这不是一只宠物，而是你在羊群中的样子。</p><div class="pasture-choice"><strong>羊毛</strong><div class="row">'+colorButtons(bodies,'body')+'</div></div><div class="pasture-choice"><strong>脸</strong><div class="row">'+colorButtons(heads,'head')+'</div></div><div class="pasture-choice"><strong>记号</strong><div class="row pasture-mark-row">'+markButtons()+'</div></div><div class="resident-actions pasture-sheep-finish"><button id="saveSheep" type="button">'+(review?'完成审看 · 回到牧场':'这就是我 · 进入牧场')+'</button></div>';document.querySelectorAll('[data-sheep-body]').forEach(b=>b.onclick=()=>chooseMaker('[data-sheep-body]','bodyColor',b.dataset.sheepBody,state));document.querySelectorAll('[data-sheep-head]').forEach(b=>b.onclick=()=>chooseMaker('[data-sheep-head]','headColor',b.dataset.sheepHead,state));document.querySelectorAll('[data-sheep-mark]').forEach(b=>b.onclick=()=>chooseMaker('[data-sheep-mark]','marking',b.dataset.sheepMark,state));drawMakerPreview(state);requestAnimationFrame(()=>drawMakerPreview(state));document.getElementById('saveSheep').onclick=async e=>{const btn=e.currentTarget;if(review){hideLayer();resetCard();applyResident(false);return}setBusy(btn,true);error.textContent='';try{const data=await request({action:'saveSheep',bodyColor:state.bodyColor,headColor:state.headColor,marking:state.marking});resident=data.user;resetCard();applyResident(!!data.created)}catch(err){showError(err.reason);setBusy(btn,false)}}}

core.addEventListener('load',()=>sendResidentToCore(false));
window.addEventListener('resize',()=>{if(document.getElementById('pastureSheepPreview'))requestAnimationFrame(()=>drawMakerPreview({bodyColor:bodies[0][0],headColor:heads[0][0],marking:'NONE'}))});
window.PastureSheepMaker=Object.freeze({openReview:()=>{if(resident?.sheep)showMaker(true)}});
async function boot(){try{const data=await request(null,'GET');resident=data.user;if(!resident)return showEmail();if(!resident.sheep)return showMaker(false);applyResident(false)}catch(err){showEmail();showError(err.reason)}}
boot();
})();
