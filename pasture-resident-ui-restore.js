(()=>{
'use strict';
if(window.top!==window)return;

const PIXEL_HAND_OPEN='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Crect x=%2210%22 y=%228%22 width=%225%22 height=%2216%22 fill=%22%231f3140%22/%3E%3Crect x=%2217%22 y=%224%22 width=%225%22 height=%2220%22 fill=%22%231f3140%22/%3E%3Crect x=%2224%22 y=%222%22 width=%225%22 height=%2222%22 fill=%22%231f3140%22/%3E%3Crect x=%2231%22 y=%225%22 width=%225%22 height=%2219%22 fill=%22%231f3140%22/%3E%3Crect x=%2238%22 y=%2210%22 width=%225%22 height=%2215%22 fill=%22%231f3140%22/%3E%3Crect x=%226%22 y=%2220%22 width=%227%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%2210%22 y=%2222%22 width=%2233%22 height=%2216%22 fill=%22%231f3140%22/%3E%3Crect x=%2215%22 y=%2238%22 width=%2222%22 height=%226%22 fill=%22%231f3140%22/%3E%3Crect x=%2211%22 y=%229%22 width=%223%22 height=%2214%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2218%22 y=%225%22 width=%223%22 height=%2218%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2225%22 y=%223%22 width=%223%22 height=%2220%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2232%22 y=%226%22 width=%223%22 height=%2217%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2239%22 y=%2211%22 width=%223%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%227%22 y=%2221%22 width=%225%22 height=%228%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2212%22 y=%2223%22 width=%2229%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2217%22 y=%2236%22 width=%2218%22 height=%226%22 fill=%22%23f4d4a7%22/%3E%3C/svg%3E") 18 18, auto';
const PIXEL_HAND_CLOSED='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Crect x=%229%22 y=%2212%22 width=%2232%22 height=%2226%22 fill=%22%231f3140%22/%3E%3Crect x=%2214%22 y=%227%22 width=%225%22 height=%2212%22 fill=%22%231f3140%22/%3E%3Crect x=%2221%22 y=%225%22 width=%225%22 height=%2214%22 fill=%22%231f3140%22/%3E%3Crect x=%2228%22 y=%227%22 width=%225%22 height=%2212%22 fill=%22%231f3140%22/%3E%3Crect x=%2235%22 y=%2210%22 width=%225%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%224%22 y=%2221%22 width=%229%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%2211%22 y=%2214%22 width=%2228%22 height=%2222%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2215%22 y=%228%22 width=%223%22 height=%2211%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2222%22 y=%226%22 width=%223%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2229%22 y=%228%22 width=%223%22 height=%2211%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2236%22 y=%2211%22 width=%223%22 height=%229%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%225%22 y=%2222%22 width=%228%22 height=%228%22 fill=%22%23f4d4a7%22/%3E%3C/svg%3E") 18 18, grabbing';

const featureIcons={
  '归回自己':'🐑','我的牧草':'🌿','风闻有你':'🔔','同路伙伴':'🍇','信箱':'✉','步道卡':'▤','小匣':'▣'
};

function installStyle(){
  if(document.getElementById('pastureApprovedControlsStyle'))return;
  const style=document.createElement('style');
  style.id='pastureApprovedControlsStyle';
  style.textContent=`
#pastureResidentControls{top:auto!important;left:50%!important;right:auto!important;bottom:max(12px,env(safe-area-inset-bottom))!important;transform:translateX(-50%)!important;width:auto!important;max-width:calc(100vw - 18px)!important;display:flex!important;gap:8px!important;align-items:flex-end!important;justify-content:center!important;overflow-x:auto!important;overflow-y:visible!important;padding:2px 4px 4px!important;scrollbar-width:none!important;filter:drop-shadow(0 3px 2px rgba(31,20,12,.24))}
#pastureResidentControls[hidden]{display:none!important}
#pastureResidentControls::-webkit-scrollbar{display:none}
#pastureResidentControls button[data-feature]{position:relative!important;flex:0 0 104px!important;width:104px!important;height:78px!important;min-height:78px!important;padding:8px 5px 7px!important;border:3px solid #3b2416!important;border-radius:1px!important;background:#6b472b!important;color:#f7e8c9!important;box-shadow:inset 0 0 0 3px #7a5232,inset 0 -5px 0 #51331f,3px 3px 0 rgba(38,24,15,.35)!important;font:900 14px/1.15 "PingFang SC","Microsoft YaHei",sans-serif!important;text-shadow:1px 1px 0 #402817!important;cursor:not-allowed!important;opacity:1!important;image-rendering:pixelated}
#pastureResidentControls button[data-feature]::before,#pastureResidentControls button[data-feature]::after{content:"";position:absolute;width:5px;height:5px;background:#9b7049;box-shadow:0 0 0 1px #3b2416}
#pastureResidentControls button[data-feature]::before{left:4px;top:4px}#pastureResidentControls button[data-feature]::after{right:4px;bottom:4px}
#pastureResidentControls button[data-feature] .pasture-btn-icon{display:block;height:34px;font:900 25px/34px ui-monospace,SFMono-Regular,Menlo,monospace;filter:saturate(.68) contrast(1.05);text-shadow:1px 2px 0 #3f2818;margin-bottom:2px}
#pastureResidentControls button[data-feature] .pasture-btn-label{display:block;white-space:nowrap}
#pastureResidentControls button[data-feature="信箱"] .pasture-btn-icon::after{content:"";display:inline-block;width:7px;height:7px;background:#c73b2e;border:2px solid #f2d5ac;margin-left:-4px;vertical-align:top;box-shadow:1px 1px 0 #3b2416}
#pastureResidentIdentity{position:absolute!important;right:72px!important;bottom:calc(100% + 8px)!important;background:rgba(92,61,37,.92)!important;color:#f6e5c7!important;border:2px solid #3b2416!important;box-shadow:2px 2px 0 rgba(38,24,15,.3)!important;padding:5px 8px!important;font-size:10px!important}
#pastureResidentLogout{position:absolute!important;right:4px!important;bottom:calc(100% + 8px)!important;min-height:29px!important;padding:5px 8px!important;border:2px solid #3b2416!important;background:#7a5232!important;color:#f6e5c7!important;box-shadow:2px 2px 0 rgba(38,24,15,.3)!important;font-weight:900!important;cursor:pointer!important}
@media(max-width:760px){#pastureResidentControls{left:8px!important;right:8px!important;transform:none!important;justify-content:flex-start!important;max-width:none!important;width:auto!important;gap:6px!important}#pastureResidentControls button[data-feature]{flex-basis:84px!important;width:84px!important;height:66px!important;min-height:66px!important;font-size:11px!important;padding:6px 3px!important}#pastureResidentControls button[data-feature] .pasture-btn-icon{height:28px!important;font-size:20px!important;line-height:28px!important}#pastureResidentIdentity{left:2px!important;right:auto!important}#pastureResidentLogout{right:2px!important}}
`;
  document.head.appendChild(style);
}

function restoreButtons(){
  installStyle();
  const controls=document.getElementById('pastureResidentControls');
  if(!controls)return false;
  controls.querySelectorAll('button[data-feature]').forEach(button=>{
    const label=button.dataset.feature||'';
    if(!featureIcons[label])return;
    if(button.dataset.approvedUi==='1')return;
    button.dataset.approvedUi='1';
    button.innerHTML='<span class="pasture-btn-icon" aria-hidden="true">'+featureIcons[label]+'</span><span class="pasture-btn-label">'+label+'</span>';
  });
  return true;
}

function bindFiveFingerHand(){
  const svg=document.getElementById('pastureResidentHitSvg');
  if(!svg||svg.dataset.finderBound==='1')return false;
  svg.dataset.finderBound='1';
  svg.querySelectorAll('rect').forEach(rect=>{
    rect.style.cursor=PIXEL_HAND_OPEN;
    rect.addEventListener('pointerenter',()=>{rect.style.cursor=PIXEL_HAND_OPEN;});
    rect.addEventListener('pointerdown',()=>{rect.style.cursor=PIXEL_HAND_CLOSED;},{capture:true});
    rect.addEventListener('pointerup',()=>{rect.style.cursor=PIXEL_HAND_OPEN;},{capture:true});
    rect.addEventListener('pointercancel',()=>{rect.style.cursor=PIXEL_HAND_OPEN;},{capture:true});
  });
  return true;
}

let tries=0;
function boot(){
  const a=restoreButtons(),b=bindFiveFingerHand();
  if((!a||!b)&&tries++<120)setTimeout(boot,80);
}
boot();

const observer=new MutationObserver(()=>{restoreButtons();bindFiveFingerHand();});
observer.observe(document.documentElement,{childList:true,subtree:true});
})();
