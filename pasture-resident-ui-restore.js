(()=>{
'use strict';
if(window.top!==window)return;

const PIXEL_HAND_OPEN='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Crect x=%2210%22 y=%228%22 width=%225%22 height=%2216%22 fill=%22%231f3140%22/%3E%3Crect x=%2217%22 y=%224%22 width=%225%22 height=%2220%22 fill=%22%231f3140%22/%3E%3Crect x=%2224%22 y=%222%22 width=%225%22 height=%2222%22 fill=%22%231f3140%22/%3E%3Crect x=%2231%22 y=%225%22 width=%225%22 height=%2219%22 fill=%22%231f3140%22/%3E%3Crect x=%2238%22 y=%2210%22 width=%225%22 height=%2215%22 fill=%22%231f3140%22/%3E%3Crect x=%226%22 y=%2220%22 width=%227%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%2210%22 y=%2222%22 width=%2233%22 height=%2216%22 fill=%22%231f3140%22/%3E%3Crect x=%2215%22 y=%2238%22 width=%2222%22 height=%226%22 fill=%22%231f3140%22/%3E%3Crect x=%2211%22 y=%229%22 width=%223%22 height=%2214%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2218%22 y=%225%22 width=%223%22 height=%2218%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2225%22 y=%223%22 width=%223%22 height=%2220%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2232%22 y=%226%22 width=%223%22 height=%2217%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2239%22 y=%2211%22 width=%223%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%227%22 y=%2221%22 width=%225%22 height=%228%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2212%22 y=%2223%22 width=%2229%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2217%22 y=%2236%22 width=%2218%22 height=%226%22 fill=%22%23f4d4a7%22/%3E%3C/svg%3E") 18 18, auto';
const PIXEL_HAND_CLOSED='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Crect x=%229%22 y=%2212%22 width=%2232%22 height=%2226%22 fill=%22%231f3140%22/%3E%3Crect x=%2214%22 y=%227%22 width=%225%22 height=%2212%22 fill=%22%231f3140%22/%3E%3Crect x=%2221%22 y=%225%22 width=%225%22 height=%2214%22 fill=%22%231f3140%22/%3E%3Crect x=%2228%22 y=%227%22 width=%225%22 height=%2212%22 fill=%22%231f3140%22/%3E%3Crect x=%2235%22 y=%2210%22 width=%225%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%224%22 y=%2221%22 width=%229%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%2211%22 y=%2214%22 width=%2228%22 height=%2222%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2215%22 y=%228%22 width=%223%22 height=%2211%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2222%22 y=%226%22 width=%223%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2229%22 y=%228%22 width=%223%22 height=%2211%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2236%22 y=%2211%22 width=%223%22 height=%229%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%225%22 y=%2222%22 width=%228%22 height=%228%22 fill=%22%23f4d4a7%22/%3E%3C/svg%3E") 18 18, grabbing';

const approvedIcons={
'归回自己':'<svg viewBox="0 0 16 16"><rect x="3" y="5" width="8" height="6" fill="#f3eee0"/><rect x="5" y="3" width="5" height="9" fill="#f3eee0"/><rect x="10" y="6" width="4" height="4" fill="#776c61"/><rect x="12" y="7" width="2" height="1" fill="#37322e"/><rect x="4" y="11" width="2" height="3" fill="#655d55"/><rect x="8" y="11" width="2" height="3" fill="#655d55"/></svg>',
'我的牧草':'<svg viewBox="0 0 16 16"><path d="M2 3h5c1 0 2 .6 2 1.5V14c0-1-.8-1.5-2-1.5H2z" fill="#fff1d5" stroke="#234e7a" stroke-width="1.2"/><path d="M14 3H9c-1 0-2 .6-2 1.5V14c0-1 .8-1.5 2-1.5h5z" fill="#fff6e3" stroke="#234e7a" stroke-width="1.2"/></svg>',
'风闻有你':'<svg viewBox="0 0 16 16"><rect x="3" y="2" width="10" height="12" fill="#fff6df" stroke="#1f4f7d" stroke-width="1.5"/><rect x="5" y="5" width="6" height="1" fill="#7da4c6"/><rect x="5" y="8" width="6" height="1" fill="#7da4c6"/><rect x="5" y="11" width="4" height="1" fill="#7da4c6"/></svg>',
'同路伙伴':'<svg viewBox="0 0 16 16"><rect x="2" y="7" width="5" height="4" fill="#e9eee5"/><rect x="3" y="5" width="3" height="3" fill="#e9eee5"/><rect x="9" y="7" width="5" height="4" fill="#cbd9c7"/><rect x="10" y="5" width="3" height="3" fill="#cbd9c7"/><rect x="6" y="9" width="4" height="3" fill="#7a766c"/></svg>',
'信箱':'<svg viewBox="0 0 16 16"><rect x="2" y="4" width="12" height="9" fill="#dceafb" stroke="#214d7b" stroke-width="1.3"/><path d="M3 5l5 4 5-4" fill="none" stroke="#214d7b" stroke-width="1.3"/></svg>',
'步道卡':'<svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" fill="#d9ebb4" stroke="#315a83" stroke-width="1.3"/><path d="M5 4v8M10 4v8" stroke="#6d9258" stroke-width="1.2"/><path d="M2 9l4-3 4 2 4-3" fill="none" stroke="#4879a6" stroke-width="1.2"/></svg>',
'小匣':'<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4" fill="#a9bed0" stroke="#224f7a" stroke-width="1.2"/><circle cx="8" cy="8" r="1.5" fill="#fff8e8"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2" stroke="#224f7a" stroke-width="1.3"/></svg>'
};

function installStyle(){
  if(document.getElementById('pastureApprovedControlsStyle'))return;
  const style=document.createElement('style');
  style.id='pastureApprovedControlsStyle';
  style.textContent=`
#pastureResidentControls{--ink:#173f73;--cream:#fffaf0;--green:#c8f09a;--green2:#aee77c;position:fixed!important;z-index:20!important;top:30px!important;left:50%!important;right:auto!important;bottom:auto!important;transform:translateX(-50%)!important;width:min(760px,calc(100vw - 92px))!important;max-width:none!important;display:grid!important;grid-template-columns:repeat(4,minmax(132px,1fr))!important;gap:14px 16px!important;align-items:start!important;justify-content:stretch!important;overflow:visible!important;padding:0!important;filter:none!important;background:transparent!important;pointer-events:none!important}
#pastureResidentControls[hidden]{display:none!important}
#pastureResidentControls button[data-feature]{position:relative!important;height:60px!important;min-height:60px!important;width:auto!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:11px!important;padding:0 12px!important;background:var(--cream)!important;border:3px solid var(--ink)!important;border-radius:0!important;box-shadow:0 3px 0 rgba(14,42,81,.14)!important;color:var(--ink)!important;font:900 17px/1.15 -apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif!important;letter-spacing:.02em!important;text-shadow:none!important;cursor:not-allowed!important;opacity:1!important;pointer-events:auto!important;user-select:none!important;transition:transform .08s steps(2,end)!important;image-rendering:pixelated}
#pastureResidentControls button[data-feature]:hover{transform:translate(-1px,-1px)!important}
#pastureResidentControls button[data-feature]::before,#pastureResidentControls button[data-feature]::after{content:""!important;position:absolute!important;width:8px!important;height:8px!important;background:inherit!important;border-color:var(--ink)!important;border-style:solid!important;box-shadow:none!important}
#pastureResidentControls button[data-feature]::before{left:-7px!important;top:-7px!important;border-width:3px 0 0 3px!important}#pastureResidentControls button[data-feature]::after{right:-7px!important;bottom:-7px!important;border-width:0 3px 3px 0!important}
#pastureResidentControls button[data-feature="归回自己"]{background:linear-gradient(180deg,var(--green) 0%,var(--green2) 100%)!important;height:62px!important;width:calc(100% + 2px)!important;margin:-1px!important}
#pastureResidentControls button[data-feature="归回自己"]::before,#pastureResidentControls button[data-feature="归回自己"]::after{background:var(--green2)!important}
#pastureResidentControls .pasture-approved-icon{width:31px!important;height:31px!important;display:block!important;flex:0 0 31px!important;image-rendering:pixelated!important}.pasture-approved-icon svg{width:100%!important;height:100%!important;display:block!important;shape-rendering:crispEdges!important}
#pastureResidentControls .pasture-approved-label{white-space:nowrap!important}
#pastureResidentControls button[data-feature="信箱"] .pasture-approved-badge{position:absolute!important;right:5px!important;top:-10px!important;min-width:22px!important;height:22px!important;padding:0 5px!important;border:2px solid #9e2b26!important;background:#f05249!important;color:white!important;font:900 12px/18px ui-monospace,SFMono-Regular,Menlo,monospace!important;text-align:center!important}
#pastureResidentIdentity{position:fixed!important;left:16px!important;top:16px!important;right:auto!important;bottom:auto!important;padding:7px 9px!important;background:rgba(255,250,240,.86)!important;border:2px solid rgba(49,89,106,.6)!important;color:#315366!important;font:800 11px/1.2 "PingFang SC","Microsoft YaHei",sans-serif!important;white-space:nowrap!important;pointer-events:none!important}
#pastureResidentLogout{position:fixed!important;right:16px!important;top:16px!important;left:auto!important;bottom:auto!important;min-height:32px!important;padding:7px 10px!important;border:2px solid #173f73!important;border-radius:0!important;background:rgba(255,250,240,.92)!important;color:#173f73!important;box-shadow:0 3px 0 rgba(14,42,81,.14)!important;font-weight:900!important;cursor:pointer!important;pointer-events:auto!important}
@media(max-width:820px){#pastureResidentControls{top:140px!important;left:16px!important;right:16px!important;transform:none!important;width:auto!important;grid-template-columns:1fr 1fr!important;gap:10px!important}#pastureResidentControls button[data-feature]{height:54px!important;min-height:54px!important;font-size:15px!important}#pastureResidentControls button[data-feature="归回自己"]{height:56px!important}.pasture-approved-icon{width:27px!important;height:27px!important;flex-basis:27px!important}}
`;
  document.head.appendChild(style);
}

function restoreButtons(){
  installStyle();
  const controls=document.getElementById('pastureResidentControls');
  if(!controls)return false;
  controls.querySelectorAll('button[data-feature]').forEach(button=>{
    const label=button.dataset.feature||'';
    const icon=approvedIcons[label];
    if(!icon)return;
    if(button.dataset.approvedSkyUi==='1')return;
    button.dataset.approvedSkyUi='1';
    const badge=label==='信箱'?'<span class="pasture-approved-badge" aria-hidden="true">3</span>':'';
    button.innerHTML='<span class="pasture-approved-icon" aria-hidden="true">'+icon+'</span><span class="pasture-approved-label">'+label+'</span>'+badge;
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
