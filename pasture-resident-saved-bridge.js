(()=>{
'use strict';
if(window.top!==window)return;
let seen=false;
function check(){
  const toast=document.getElementById('pastureResidentToast');
  const arrived=!!(toast&&toast.classList.contains('show')&&toast.textContent.includes('你已经进入牧场'));
  if(arrived&&!seen){
    seen=true;
    window.dispatchEvent(new CustomEvent('pasture-resident-saved'));
  }
  if(!arrived)seen=false;
}
const observer=new MutationObserver(check);
observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});
check();
})();
