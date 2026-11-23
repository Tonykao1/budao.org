(()=>{
'use strict';
// The real 4-stage, 8-dimension maker from the accepted pasture. Existing
// residents are never invited to create a replacement sheep in this Preview.
const BASE_DIMS=['woolColor','faceColor','woolShape','bodyShape'];
const FEATURE_DIMS=['ears','expression','marking','forelock'];
const auth=window.PastureResidentAuth;
let DNA=null,Renderer=null,I18n=null,makerState=null,busy=false,loaded=false;
const DRAFT_KEY='budao:preview:maker-v2:draft:';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function t(k){return I18n?.t(k)||k}
function draftKey(){return DRAFT_KEY+String(auth?.getUser()?.id||'unauthenticated')}
function readDraft(){
 try{const v=JSON.parse(sessionStorage.getItem(draftKey())||'null');return DNA?.validateV2(v)?v:null}
 catch(e){return null}
}
function writeDraft(d){if(makerState?.review)return;try{sessionStorage.setItem(draftKey(),JSON.stringify(d))}catch(e){}}
function clearDraft(){try{sessionStorage.removeItem(draftKey())}catch(e){}}
function makerInitialDna(review){
 const sheep=auth?.getUser()?.sheep;
 if(review&&sheep){
  if(sheep.appearanceVersion===2&&DNA.validateV2(sheep.appearance))return {...sheep.appearance};
  return DNA.fromLegacy(sheep);
 }
 return readDraft()||DNA.defaultV2();
}
async function ensureModules(){
 if(loaded)return;
 const files=[
  ['/pasture-sheep-dna.js',()=>!!window.PastureSheepDNA],
  ['/pasture-sheep-renderer.js',()=>!!window.PastureSheepRenderer],
  ['/pasture-sheep-i18n.js',()=>!!window.PastureSheepI18n]
 ];
 for(const [src,exists] of files){
  if(exists())continue;
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;
   document.head.appendChild(script)
  });
 }
 DNA=window.PastureSheepDNA;Renderer=window.PastureSheepRenderer;I18n=window.PastureSheepI18n;
 if(!DNA||!Renderer||!I18n)throw Error('sheep_maker_unavailable');
 loaded=true;
}
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

function renderMaker(){
 const card=auth.card;
 card.innerHTML=makerScreenMarkup()+'<div class="pasture-resident-message" id="pastureResidentMessage" role="status" aria-live="polite"></div>';
 wireMaker();drawMakerCanvases();
}
function notify(message){const el=document.getElementById('pastureResidentMessage');if(el)el.textContent=message}
function endMaker(){
 const card=auth.card;
 card.classList.remove('maker-v2-card','pasture-sheep-maker-card');
 makerState=null;busy=false;auth.layer.hidden=true;auth.apply(false);
}
async function confirmMaker(e){
 if(busy||!makerState||!DNA.validateV2(makerState.dna))return;
 if(makerState.review){endMaker();return}
 busy=true;
 const button=e?.currentTarget;if(button)button.disabled=true;
 notify('正在确认你的牧场身份……');
 try{
  // Revalidate that there isn't already a sheep in the account before writing.
  const latest=await auth.call(null,'GET');
  if(latest.user?.sheep){
   auth.setUser(latest.user);notify('你的羊已经存在，不会重新捏造或覆盖。');
   setTimeout(endMaker,250);return;
  }
  const saved=await auth.call({action:'saveSheep',appearanceVersion:2,appearance:makerState.dna});
  auth.setUser(saved.user);
  if(saved.created)clearDraft();
  endMaker();
  if(saved.created)auth.pop('你的羊已进入牧场');
  else auth.pop('找到了你原来捏的羊，没有覆盖');
 }catch(e){
  notify(auth.friendly(e.reason)||'暂时没有完成，请稍后再试。');
  busy=false;if(button)button.disabled=false;
 }
}
async function open(event){
 const user=event?.detail?.user||auth.getUser();
 if(!user?.id)return;
 const review=Boolean(event?.detail?.review);
 if(user.sheep&&!review){auth.setUser(user);auth.apply(false);return}
 if(makerState)return;
 try{
  await ensureModules();
  // While scripts load, the verified account may acquire a sheep in another tab.
  const latest=auth.getUser();
  if(!review&&latest?.sheep)return auth.apply(false);
  makerState={screen:1,dna:makerInitialDna(review),activeDimension:null,review};
  auth.layer.hidden=false;
  auth.card.classList.add('maker-v2-card','pasture-sheep-maker-card');
  renderMaker();
 }catch(e){
  auth.layer.hidden=false;
  auth.card.innerHTML='<p role="alert">暂时无法打开最终捏羊界面，请刷新后重试。不会创建或覆盖任何羊。</p>';
 }
}
window.addEventListener('resize',()=>{if(makerState)requestAnimationFrame(drawMakerCanvases)},{passive:true});
window.addEventListener('pasture-needs-sheep',open);
window.PastureSheepMaker=Object.freeze({open});
})();
