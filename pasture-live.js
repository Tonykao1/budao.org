(()=>{
'use strict';
const API='/api/pasture-auth';
const DRAFT_KEY='budao-pasture-sheep-v2-draft';
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
let resident=null,emailDraft='',pendingArrival=false,coreEngineReady=false,makerState=null;
let DNA=null,Renderer=null,I18n=null;
const BASE_DIMS=['woolColor','faceColor','woolShape','bodyShape'];
const FEATURE_DIMS=['ears','expression','marking','forelock'];

function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function showLayer(){layer.hidden=false;error.textContent=''}
function hideLayer(){layer.hidden=true;error.textContent=''}
function setBusy(button,busy){if(button){button.disabled=!!busy;button.dataset.oldText=button.dataset.oldText||button.textContent;button.textContent=busy?'请稍候…':button.dataset.oldText}}
function showError(reason){const map={invalid_email:'请输入有效邮箱。',email_rate_limited:'这个邮箱请求过于频繁，请稍后再试。',rate_limited:'操作过于频繁，请稍后再试。',verification_invalid:'验证码不正确，请重新输入。',verification_expired:'验证码已经过期，请重新获取。',verification_locked:'尝试次数过多，请重新获取验证码。',email_unavailable:'验证码邮件暂时无法发送。',auth_not_configured:'牧场登录服务暂时不可用。',database_not_configured:'牧场登录服务暂时不可用。',invalid_sheep:'暂时没有完成，请再试一次。',service_unavailable:'牧场登录服务暂时不可用。'};error.textContent=map[reason]||'暂时没有完成，请再试一次。'}
async function request(payload,method='POST'){const opts={method,credentials:'same-origin',headers:{'Content-Type':'application/json'}};if(method!=='GET')opts.body=JSON.stringify(payload||{});const r=await fetch(API,opts);let data={};try{data=await r.json()}catch(_){ }if(!r.ok||data.ok===false){const e=new Error(data.reason||'service_unavailable');e.reason=data.reason||'service_unavailable';throw e}return data}
function resetCard(){card.classList.remove('maker-card','maker-v2-card')}
function showToast(message){toast.textContent=message;toast.hidden=false;setTimeout(()=>toast.hidden=true,2200)}
function updateResidentUi(){if(residentName)residentName.textContent='牧场居民';if(residentId)residentId.textContent=resident?.emailMasked||resident?.email_masked||'已进入羊群';document.querySelectorAll('.pasture-feature-locked').forEach(el=>{el.title='功能正在生长，成熟后开放';el.onclick=e=>{e.preventDefault();showToast('功能正在生长，成熟后开放')}})}
function sendResidentToCore(arrival=false){if(!coreEngineReady||!resident?.sheep||!core.contentWindow)return;core.contentWindow.postMessage({type:'tonglu-resident-v1',resident:{id:resident.id,sheep:resident.sheep},arrival:!!arrival},location.origin);pendingArrival=false}

function loadScriptIn(doc,id,src,ready){return new Promise((resolve,reject)=>{if(ready()){resolve();return}const existing=doc.getElementById(id);if(existing){existing.addEventListener('load',()=>resolve(),{once:true});existing.addEventListener('error',reject,{once:true});return}const s=doc.createElement('script');s.id=id;s.src=src;s.onload=()=>resolve();s.onerror=reject;doc.body.appendChild(s)})}
async function ensureMakerModules(){
  if(!document.getElementById('pastureSheepMakerV2Css')){const l=document.createElement('link');l.id='pastureSheepMakerV2Css';l.rel='stylesheet';l.href='/pasture-sheep-maker-v2.css';document.head.appendChild(l)}
  await loadScriptIn(document,'pastureSheepDnaOuter','/pasture-sheep-dna.js',()=>!!window.PastureSheepDNA);
  await loadScriptIn(document,'pastureSheepRendererOuter','/pasture-sheep-renderer.js',()=>!!window.PastureSheepRenderer);
  await loadScriptIn(document,'pastureSheepI18nOuter','/pasture-sheep-i18n.js',()=>!!window.PastureSheepI18n);
  DNA=window.PastureSheepDNA;Renderer=window.PastureSheepRenderer;I18n=window.PastureSheepI18n;
}
function loadCoreScript(d,id,src,ready,next){if(ready()){next();return}const existing=d.getElementById(id);if(existing){existing.addEventListener('load',next,{once:true});return}const s=d.createElement('script');s.id=id;s.src=src;s.onload=next;d.body.appendChild(s)}
function ensureCoreEngine(){try{const d=core.contentDocument;if(!d)return;coreEngineReady=!!core.contentWindow.__tongluResidentEngineV1;if(coreEngineReady){sendResidentToCore(pendingArrival);return}loadCoreScript(d,'pastureSheepDnaScript','/pasture-sheep-dna.js',()=>!!core.contentWindow.PastureSheepDNA,()=>{loadCoreScript(d,'pastureSheepRendererScript','/pasture-sheep-renderer.js',()=>!!core.contentWindow.PastureSheepRenderer,()=>{loadCoreScript(d,'pastureResidentCoreScript','/pasture-resident-core.js',()=>!!core.contentWindow.__tongluResidentEngineV1,()=>{coreEngineReady=true;sendResidentToCore(pendingArrival)})})})}catch(_){}}
function applyResident(arrival=false){hideLayer();skyZone.hidden=false;updateResidentUi();pendingArrival=!!arrival;ensureCoreEngine();sendResidentToCore(arrival);if(arrival)showToast('你已经进入羊群')}

function showEmail(){resetCard();showLayer();title.textContent='进入牧场';copy.textContent='留下一个可以找到你的邮箱。确认以后，你会进入羊群，并在牧场里认出自己。';body.innerHTML='<div class="resident-fields"><input id="residentEmail" type="email" inputmode="email" autocomplete="email" placeholder="你的邮箱"></div><div class="resident-actions"><button id="sendCode">发送验证码</button></div>';const input=document.getElementById('residentEmail');if(emailDraft)input.value=emailDraft;document.getElementById('sendCode').onclick=async e=>{const btn=e.currentTarget;emailDraft=input.value.trim();setBusy(btn,true);error.textContent='';try{await request({action:'requestCode',email:emailDraft});showCode()}catch(err){showError(err.reason)}finally{setBusy(btn,false)}}}
function showCode(){resetCard();showLayer();title.textContent='查收邮件';copy.textContent='验证码已经发送到 '+emailDraft+'。输入 6 位数字，就能继续进入牧场。';body.innerHTML='<div class="resident-fields"><input id="residentCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 位验证码"></div><div class="resident-actions"><button id="verifyCode">进入牧场</button><button id="changeEmail" class="secondary">换邮箱</button></div>';document.getElementById('changeEmail').onclick=showEmail;document.getElementById('verifyCode').onclick=async e=>{const btn=e.currentTarget,code=document.getElementById('residentCode').value.trim();setBusy(btn,true);error.textContent='';try{const data=await request({action:'verifyCode',email:emailDraft,code});resident=data.user;if(data.needsSheep||!resident?.sheep)showMaker(false);else applyResident(false)}catch(err){showError(err.reason)}finally{setBusy(btn,false)}}}

function t(key){return I18n?.t(key)||key}
function readDraft(){try{const value=JSON.parse(sessionStorage.getItem(DRAFT_KEY)||'null');if(DNA.validateV2(value))return value;sessionStorage.removeItem(DRAFT_KEY)}catch(_){try{sessionStorage.removeItem(DRAFT_KEY)}catch(__){}}return null}
function writeDraft(dna){if(makerState?.review)return;try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(dna))}catch(_){}}
function clearDraft(){try{sessionStorage.removeItem(DRAFT_KEY)}catch(_){}}
function makerInitialDna(review){if(review&&resident?.sheep){if(Number(resident.sheep.appearanceVersion)===2&&DNA.validateV2(resident.sheep.appearance))return {...resident.sheep.appearance};return DNA.fromLegacy(resident.sheep)}return readDraft()||DNA.defaultV2()}
function dimensionButtons(keys){return keys.map(key=>'<button type="button" class="maker-dimension" data-maker-dimension="'+key+'" data-kind="'+key+'" aria-label="'+esc(t(key))+'" aria-pressed="'+String(makerState.activeDimension===key)+'"><span class="maker-dimension-glyph" aria-hidden="true"></span></button>').join('')}
function optionButtons(key){return DNA.enums[key].map(value=>'<button type="button" class="maker-option" data-maker-option="'+esc(value)+'" aria-label="'+esc(t(key)+': '+t(value))+'" aria-pressed="'+String(makerState.dna[key]===value)+'"><canvas class="maker-option-canvas" width="68" height="58" aria-hidden="true"></canvas></button>').join('')}
function previewCanvas(){return '<div class="maker-preview-wrap"><canvas id="pastureSheepPreview" class="maker-main-canvas" width="540" height="314" role="img" aria-label="'+esc(t('preview'))+'"></canvas></div>'}
function navButton(cls,symbol,label){return '<button type="button" class="maker-nav '+cls+'" aria-label="'+esc(t(label))+'">'+symbol+'</button>'}
function makerScreenMarkup(){
  if(makerState.screen===1)return '<div class="maker-v2 maker-screen-one"><div class="maker-you">你</div>'+previewCanvas()+'<div class="maker-controls">'+navButton('primary maker-next','→','next')+'</div></div>';
  if(makerState.screen===2)return '<div class="maker-v2 maker-screen-two">'+previewCanvas()+'<div class="maker-dimensions">'+dimensionButtons(BASE_DIMS)+'</div><div class="maker-options-panel">'+optionButtons(makerState.activeDimension)+'</div><div class="maker-controls">'+navButton('maker-back','←','back')+navButton('primary maker-next','→','next')+'</div></div>';
  if(makerState.screen===3)return '<div class="maker-v2 maker-screen-three">'+previewCanvas()+'<div class="maker-dimensions">'+dimensionButtons(FEATURE_DIMS)+'</div><div class="maker-options-panel">'+optionButtons(makerState.activeDimension)+'</div><div class="maker-controls">'+navButton('maker-back','←','back')+'<button type="button" class="maker-random" aria-label="'+esc(t('random'))+'">↻</button>'+navButton('primary maker-next','→','next')+'</div></div>';
  return '<div class="maker-v2 maker-screen-four">'+previewCanvas()+'<div class="maker-controls">'+navButton('maker-back','←','back')+navButton('confirm maker-confirm','✓','confirm')+'</div></div>';
}
function drawDnaToCanvas(canvas,dna,small=false,dim=false){if(!canvas||!Renderer)return;const ctx=canvas.getContext('2d');const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;if(!small){ctx.fillStyle='rgba(191,231,205,.30)';ctx.fillRect(0,0,w,h);ctx.fillStyle='rgba(137,189,121,.22)';ctx.fillRect(0,Math.floor(h*.72),w,Math.ceil(h*.28))}const unit=small?2.15:Math.max(5,Math.floor(w/78));const x=small?9:Math.floor(w*.43);const y=small?30:Math.floor(h*.60);if(dim)ctx.globalAlpha=.64;Renderer.draw(ctx,x,y,unit,false,dna);ctx.globalAlpha=1}
function drawMakerCanvases(){const main=document.getElementById('pastureSheepPreview');if(main)drawDnaToCanvas(main,makerState.dna,false,makerState.screen===1);if(makerState.activeDimension)document.querySelectorAll('.maker-option').forEach(button=>{const value=button.dataset.makerOption;drawDnaToCanvas(button.querySelector('.maker-option-canvas'),{...makerState.dna,[makerState.activeDimension]:value},true,false)})}
function wireMaker(){
  document.querySelectorAll('[data-maker-dimension]').forEach(button=>button.onclick=()=>{makerState.activeDimension=button.dataset.makerDimension;renderMaker()});
  document.querySelectorAll('[data-maker-option]').forEach(button=>button.onclick=()=>{makerState.dna={...makerState.dna,[makerState.activeDimension]:button.dataset.makerOption};writeDraft(makerState.dna);renderMaker()});
  document.querySelector('.maker-back')?.addEventListener('click',()=>{makerState.screen=Math.max(1,makerState.screen-1);makerState.activeDimension=makerState.screen===2?BASE_DIMS[0]:makerState.screen===3?FEATURE_DIMS[0]:null;renderMaker()});
  document.querySelector('.maker-next')?.addEventListener('click',()=>{makerState.screen=Math.min(4,makerState.screen+1);makerState.activeDimension=makerState.screen===2?BASE_DIMS[0]:makerState.screen===3?FEATURE_DIMS[0]:null;renderMaker()});
  document.querySelector('.maker-random')?.addEventListener('click',()=>{makerState.dna=DNA.randomV2();writeDraft(makerState.dna);renderMaker()});
  document.querySelector('.maker-confirm')?.addEventListener('click',confirmMaker);
}
function renderMaker(){title.textContent='';copy.textContent='';error.textContent='';body.innerHTML=makerScreenMarkup();wireMaker();drawMakerCanvases()}
async function confirmMaker(e){const btn=e?.currentTarget;if(!makerState||!DNA.validateV2(makerState.dna))return;if(makerState.review){resetCard();hideLayer();makerState=null;applyResident(false);return}if(btn)btn.disabled=true;error.textContent='';try{const data=await request({action:'saveSheep',appearanceVersion:2,appearance:makerState.dna});resident=data.user;clearDraft();makerState=null;resetCard();applyResident(!!data.created)}catch(err){showError(err.reason);if(btn)btn.disabled=false}}
function showMaker(review=false){makerState={screen:1,dna:makerInitialDna(review),activeDimension:null,review:!!review};card.classList.add('maker-card','maker-v2-card');showLayer();renderMaker()}

core.addEventListener('load',()=>{coreEngineReady=false;ensureCoreEngine()});
window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.type==='tonglu-resident-ready-v1'){coreEngineReady=true;sendResidentToCore(pendingArrival)}});
window.addEventListener('resize',()=>{if(makerState)requestAnimationFrame(drawMakerCanvases)});
window.PastureSheepMaker=Object.freeze({openReview:()=>{if(resident?.sheep)showMaker(true)}});
async function boot(){try{await ensureMakerModules();const data=await request(null,'GET');resident=data.user;ensureCoreEngine();if(!resident)return showEmail();if(!resident.sheep)return showMaker(false);applyResident(false)}catch(err){showEmail();showError(err.reason)}}
boot();
})();
