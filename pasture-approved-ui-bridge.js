(()=>{
'use strict';
if(window.top!==window)return;

const SHOP_ICON='<span class="icon" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M2 7h12v7H2z" fill="#f1ddb0" stroke="#234e67" stroke-width="1"/><path d="M1 6l2-4h10l2 4-2 2-2-2-3 2-3-2-2 2z" fill="#b97854" stroke="#234e67" stroke-width="1"/><rect x="4" y="9" width="3" height="5" fill="#799b71"/><rect x="9" y="9" width="3" height="3" fill="#d8f1df"/></svg></span>';

function convertSeventhEntry(){
  const button=document.getElementById('pastureBoxBtn')||document.getElementById('pastureShopBtn');
  if(!button)return false;
  if(button.id!=='pastureShopBtn')button.id='pastureShopBtn';
  if(button.dataset.shopVisual!=='1'){
    button.dataset.shopVisual='1';
    button.innerHTML=SHOP_ICON+'小铺';
    button.setAttribute('aria-label','打开小铺');
  }
  return true;
}

function refreshIdentity(detail){
  const resident=detail?.resident||window.PastureResidentRuntime?.getResident?.()||null;
  if(!resident)return;
  const identity=document.querySelector('.identity');
  if(!identity)return;
  const name=identity.querySelector('.idtext .name');
  const bid=identity.querySelector('.idtext .bid');
  if(name&&resident.emailMasked)name.textContent=resident.emailMasked;
  if(bid&&resident.id){const raw=String(resident.id).replace(/-/g,'').toUpperCase();bid.textContent='Budao ID '+raw.slice(0,4)+' '+raw.slice(4,8);}
}

window.addEventListener('pasture-auth-state',event=>{convertSeventhEntry();refreshIdentity(event.detail);});
window.addEventListener('pasture-resident-updated',event=>{convertSeventhEntry();refreshIdentity(event.detail);});
new MutationObserver(()=>convertSeventhEntry()).observe(document.documentElement,{childList:true,subtree:true});
convertSeventhEntry();
window.PastureApprovedUiBridge=Object.freeze({convertSeventhEntry,refreshIdentity});
})();
