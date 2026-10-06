(()=>{
'use strict';
if(window.top!==window)return;

const PIXEL_HAND_OPEN='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Crect x=%2210%22 y=%228%22 width=%225%22 height=%2216%22 fill=%22%231f3140%22/%3E%3Crect x=%2217%22 y=%224%22 width=%225%22 height=%2220%22 fill=%22%231f3140%22/%3E%3Crect x=%2224%22 y=%222%22 width=%225%22 height=%2222%22 fill=%22%231f3140%22/%3E%3Crect x=%2231%22 y=%225%22 width=%225%22 height=%2219%22 fill=%22%231f3140%22/%3E%3Crect x=%2238%22 y=%2210%22 width=%225%22 height=%2215%22 fill=%22%231f3140%22/%3E%3Crect x=%226%22 y=%2220%22 width=%227%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%2210%22 y=%2222%22 width=%2233%22 height=%2216%22 fill=%22%231f3140%22/%3E%3Crect x=%2215%22 y=%2238%22 width=%2222%22 height=%226%22 fill=%22%231f3140%22/%3E%3Crect x=%2211%22 y=%229%22 width=%223%22 height=%2214%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2218%22 y=%225%22 width=%223%22 height=%2218%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2225%22 y=%223%22 width=%223%22 height=%2220%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2232%22 y=%226%22 width=%223%22 height=%2217%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2239%22 y=%2211%22 width=%223%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%227%22 y=%2221%22 width=%225%22 height=%228%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2212%22 y=%2223%22 width=%2229%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2217%22 y=%2236%22 width=%2218%22 height=%226%22 fill=%22%23f4d4a7%22/%3E%3C/svg%3E") 18 18, auto';
const PIXEL_HAND_CLOSED='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Crect x=%229%22 y=%2212%22 width=%2232%22 height=%2226%22 fill=%22%231f3140%22/%3E%3Crect x=%2214%22 y=%227%22 width=%225%22 height=%2212%22 fill=%22%231f3140%22/%3E%3Crect x=%2221%22 y=%225%22 width=%225%22 height=%2214%22 fill=%22%231f3140%22/%3E%3Crect x=%2228%22 y=%227%22 width=%225%22 height=%2212%22 fill=%22%231f3140%22/%3E%3Crect x=%2235%22 y=%2210%22 width=%225%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%224%22 y=%2221%22 width=%229%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%2211%22 y=%2214%22 width=%2228%22 height=%2222%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2215%22 y=%228%22 width=%223%22 height=%2211%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2222%22 y=%226%22 width=%223%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2229%22 y=%228%22 width=%223%22 height=%2211%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2236%22 y=%2211%22 width=%223%22 height=%229%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%225%22 y=%2222%22 width=%228%22 height=%228%22 fill=%22%23f4d4a7%22/%3E%3C/svg%3E") 18 18, grabbing';

function bindFiveFingerHand(){
  const svg=document.getElementById('pastureResidentHitSvg');
  if(!svg||svg.dataset.finderBound==='1')return false;
  svg.dataset.finderBound='1';
  svg.querySelectorAll('rect').forEach(rect=>{
    rect.style.cursor=PIXEL_HAND_OPEN;
    rect.addEventListener('pointerenter',()=>{rect.style.cursor=PIXEL_HAND_OPEN;});
    rect.addEventListener('pointerleave',()=>{rect.style.cursor=PIXEL_HAND_OPEN;});
    rect.addEventListener('pointerdown',()=>{rect.style.cursor=PIXEL_HAND_CLOSED;},{capture:true});
    rect.addEventListener('pointerup',()=>{rect.style.cursor=PIXEL_HAND_OPEN;},{capture:true});
    rect.addEventListener('pointercancel',()=>{rect.style.cursor=PIXEL_HAND_OPEN;},{capture:true});
  });
  return true;
}

let tries=0;
function boot(){
  if(bindFiveFingerHand())return;
  if(tries++<160)setTimeout(boot,75);
}
new MutationObserver(()=>bindFiveFingerHand()).observe(document.documentElement,{childList:true,subtree:true});
window.PastureResidentHand=Object.freeze({bindFiveFingerHand,PIXEL_HAND_OPEN,PIXEL_HAND_CLOSED});
boot();
})();
