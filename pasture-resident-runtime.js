(()=>{
'use strict';
if(window.top!==window||!document.getElementById('environmentLayer'))return;
if(window.__pastureResidentRuntimeLoader)return;
window.__pastureResidentRuntimeLoader=true;

function load(src,marker,onload){
  if(document.querySelector(`script[data-${marker}]`)){
    if(typeof onload==='function')onload();
    return;
  }
  const script=document.createElement('script');
  script.src=src;
  script.dataset[marker]='1';
  if(typeof onload==='function')script.addEventListener('load',onload,{once:true});
  document.head.appendChild(script);
}

load('/pasture-resident-runtime-core.js?v=20261006reg6','pastureResidentCore',()=>{
  load('/pasture-resident-position-sync.js?v=20261006reg6','pastureResidentPositionSync',()=>{
    load('/pasture-resident-findability-guard.js?v=20261006reg6','pastureResidentFindability',()=>{
      load('/pasture-resident-saved-bridge.js?v=20261006reg6','pastureResidentSavedBridge',()=>{
        load('/pasture-resident-hit-layer.js?v=20261006reg6','pastureResidentHitLayer',()=>{
          load('/pasture-resident-ui-restore.js?v=20261006reg6','pastureResidentUiRestore');
        });
      });
    });
  });
});
})();
