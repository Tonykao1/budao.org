(()=>{'use strict';
const button=document.getElementById('budaoCardBtn');
const layer=document.getElementById('pastureApprovedCardLayer');
const frame=document.getElementById('pastureApprovedCardFrame');
if(!button||!layer||!frame)return;
let returnFocus=null;
function openCard(){
 if(!layer.hidden)return;
 returnFocus=document.activeElement;
 layer.hidden=false;
 if(!frame.getAttribute('src'))frame.src='/pasture-card-viewer.html';
 document.body.classList.add('pasture-card-viewer-open');
}
function closeCard(){
 if(layer.hidden)return;
 layer.hidden=true;
 document.body.classList.remove('pasture-card-viewer-open');
 try{returnFocus?.focus?.()}catch(_){}
}
button.addEventListener('click',e=>{e.preventDefault();openCard()});
button.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openCard()}});
window.addEventListener('message',e=>{
 if(e.origin!==location.origin||e.source!==frame.contentWindow)return;
 if(e.data?.type==='pasture-card-close-approved-v1')closeCard();
});
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!layer.hidden){e.preventDefault();closeCard()}});
})();