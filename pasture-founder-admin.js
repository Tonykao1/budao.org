(()=>{'use strict';
const box=document.getElementById('claimList'),notice=document.getElementById('notice');
const api='/api/pasture-auth';
const esc=v=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function load(){
 try{
  const res=await fetch(api+'?founderReviews=1',{credentials:'same-origin',cache:'no-store'});
  if(res.status===403){notice.textContent='无管理权限。请先通过步道管理账户登录。';return}
  const data=await res.json();if(!res.ok||!data.ok)throw Error('service_unavailable');
  notice.textContent='待核对 '+data.claims.length+' 项（仅显示已登录居民的脱敏邮箱）。';
  box.innerHTML='';
  for(const claim of data.claims){
   const article=document.createElement('article');
   article.innerHTML='<strong>'+esc(claim.seriesId)+' · '+esc(claim.emailMasked)+'</strong>'+
    '<p><small>申请标识：'+esc(claim.id)+'<br>提交时间：'+esc(claim.createdAt)+'</small></p>'+
    '<label>人工核验凭据的档案编号（不得填写密码）<input aria-label="历史凭据档案编号" maxlength="160" placeholder="例如：founder-review-2026-001"></label>'+
    '<p><button type="button">核实后绑定历史创始卡</button></p>';
   const button=article.querySelector('button'),input=article.querySelector('input');
   button.addEventListener('click',async()=>{
    if(!confirm('已通过独立证据核对原卡归属且确认是第一张创始卡？此操作将在正式账户登记历史激活身份。'))return;
    button.disabled=true;
    try{
     const r=await fetch(api,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'approveFounderCardReview',claimId:claim.id,evidenceReference:input.value.trim()})});
     const d=await r.json();if(!r.ok||!d.ok)throw Error(d.reason||'service_unavailable');
     notice.textContent='历史创始卡绑定记录已创建，刷新队列可再次核验。';
     article.remove();
    }catch(e){alert('审批未完成：'+String(e.message))}
    finally{button.disabled=false}
   });
   box.appendChild(article);
  }
 }catch(_){notice.textContent='暂时无法读取核对队列，未修改任何卡片记录。'}
}
load();
})();