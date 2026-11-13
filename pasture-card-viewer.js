/* BUDAO approved card visual: art only, server-only entitlement, no card issuance. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const frame=$('approvedCardFrame'),load=$('cardLoadStatus'),dock=$('approvedCardDock');
const toggle=$('cardReceiptToggle'),hint=$('approvedCardHint'),receipt=$('cardReceipt');
const claimButton=$('founderCardClaim');
let ready=false;
const showStatus=s=>{load.textContent=s};
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.getPastureHolderName=()=> '同行者';
async function loadApprovedCard(){
 if(!window.PastureApprovedSixCard?.upgradeApprovedCard)throw Error('六维卡片引擎未载入');
 const responses=await Promise.all(Array.from({length:20},(_,i)=>{
  const name='part-'+String(i).padStart(2,'0')+'.txt';
  return fetch('/pasture-card-art/parts/'+name,{cache:'force-cache'});
 }));
 if(responses.some(r=>!r.ok))throw Error('原版卡片素材不完整');
 const pieces=await Promise.all(responses.map(r=>r.text()));
 const source=pieces.join('');
 if(source.length!==4786904)throw Error('原始美术源文件校验失败');
 const match=source.match(/const ORIGINAL=\x60([A-Za-z0-9+/=]+)\x60;/);
 if(!match)throw Error('没有找到已批准的原卡片');
 const base64=match[1],raw=atob(base64),bytes=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)bytes[i]=raw.charCodeAt(i);
 if(typeof DecompressionStream!=='function')throw Error('当前浏览器不支持原卡片解压，请使用最新 Chrome 或 Safari');
 const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
 const original=await new Response(stream).text();
 if(!original.includes('id="flipBtn"')||!original.includes('id="fixedFront"'))throw Error('原卡片视觉结构校验失败');
 let approved=window.PastureApprovedSixCard.upgradeApprovedCard(original);
 approved=approved.replace('/pasture-preview/six-dim-core.js','/pasture-card-art/six-dim-core.js');
 // Exactly the reviewed card-only presentation. No changes to DATA artwork.
 const cardOnlyStyle='<style>.pasture,.mast,.farm-shell,#resetDemo{display:none!important}.overlay{visibility:visible!important;opacity:1!important;pointer-events:auto!important;background:transparent!important;padding:3px!important}.window{max-height:calc(100dvh - 14px)!important;box-shadow:7px 8px #0005!important}.window-body{padding-top:18px!important}#exit{display:none!important}body{background:transparent!important}</style>';
 // Legacy sample states are explicitly non-persistent and cannot unlock anything.
 const shim='<script>(()=>{const values=Object.create(null);const temp={getItem:k=>values[k]??null,setItem:(k,v)=>{values[k]=String(v)},removeItem:k=>{delete values[k]},clear:()=>{for(const k in values)delete values[k]}};try{Object.defineProperty(window,"localStorage",{configurable:true,value:temp})}catch(_){}})();</'+'script>';
 frame.addEventListener('load',()=>{
  try{
   const doc=frame.contentDocument;
   if(!doc)return;
   doc.addEventListener('click',e=>{if(!e.target.closest?.('#flipBtn')){e.preventDefault();e.stopImmediatePropagation()}},true);
   doc.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation()},true);
   doc.querySelectorAll('button,input,select,textarea').forEach(el=>{if(el.id==='flipBtn')return;el.disabled=true;el.setAttribute('aria-disabled','true')});
  }catch(_){}
 },{once:true});
 frame.srcdoc=approved.replace('</head>',cardOnlyStyle+shim+'</head>');
 ready=true;load.hidden=true;dock.hidden=false;
}
async function readReceipt(){
 claimButton.hidden=true;
 receipt.hidden=false;
 receipt.textContent='正在读取正式站的真实居民身份与卡片信息……';
 try{
  const res=await fetch('/api/pasture-auth',{method:'GET',credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(!res.ok)throw Error('身份服务暂时不可用');
  const data=await res.json();
  if(!data?.ok)throw Error('服务器未完成身份验证');
  if(!data.user?.id){receipt.textContent='请先在正式牧场完成邮箱登录，再查看个人卡片状态。';return}
  const user=data.user;
  if(data.cardStatusUnavailable){
   receipt.textContent='卡片记录暂时无法核验，请勿重新激活或重复申请。';
  }else if(user.cardActivated===true&&data.card?.status==='ACTIVATED'){
   receipt.textContent='正式站已核实绑定：'+String(data.card.seriesId||'创始卡')+
    ' · 历史创始卡已激活。'+(data.card.serial?'原编号 '+String(data.card.serial):'原卡号与个人六维配卡尚待历史资料同步。')+
    ' 当前仅开放已完成的牧场功能。';
  }else if(data.founderClaim?.status==='PENDING'){
   receipt.textContent='历史创始卡核对申请已登记，等待管理端核验旧卡凭据。此状态尚未激活任何权限。';
  }else{
   receipt.textContent='正式站尚无可验证的旧卡发行记录。曾在样机显示“已激活”的持卡人可申请人工核对；不要重新抽卡或输入旧演示密码。';
   claimButton.hidden=false;
  }
 }catch(_){receipt.textContent='当前无法核实发行与核销状态；请勿重复激活。'}
}
claimButton.addEventListener('click',async()=>{
 if(claimButton.disabled)return;
 claimButton.disabled=true;
 receipt.textContent='正在登记历史创始卡核对申请……';
 try{
  const res=await fetch('/api/pasture-auth',{method:'POST',credentials:'same-origin',
   headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({action:'requestFounderCardReview'})});
  const data=await res.json();
  if(res.status===202&&data.ok){
   claimButton.hidden=true;
   receipt.textContent='核对申请已登记。等待步道管理端核验；此操作没有发行新卡或开放功能。';
  }else if(data.reason==='already_bound'){
   claimButton.hidden=true;receipt.textContent='服务器已存在本账号绑定记录，请重新读取状态。';
  }else{
   receipt.textContent='申请未完成：'+(data.reason==='unauthorized'?'请先登录正式牧场。':'服务器暂时无法登记。');
  }
 }catch(_){receipt.textContent='网络异常，申请状态未确认。请重新读取状态，勿反复提交。'}
 finally{claimButton.disabled=false}
});
toggle.addEventListener('click',()=>{
 if(!receipt.hidden){receipt.hidden=true;claimButton.hidden=true;toggle.textContent='查看真实发行与激活状态';hint.textContent='定稿卡面展示 · 六维图案为视觉样张，不代表个人实际配卡';return}
 toggle.textContent='返回定稿卡面';hint.textContent='发行、核销状态以服务器记录为准；卡面视觉样张不具备发卡效力';readReceipt();
});
loadApprovedCard().catch(err=>{load.textContent='步道卡暂时无法展示：'+String(err?.message||'原稿读取失败')});
})();