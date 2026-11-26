(function(){
"use strict";
const entry=document.getElementById("coworkerEntry"), divider=document.getElementById("coworkerDivider"), room=document.getElementById("coworkerRoom");
const records=document.getElementById("coworkerRecords"), message=document.getElementById("coworkerMessage");
const tabs=Array.from(room.querySelectorAll("[data-coworker-view]"));
const API="/api/eebee?service=coworker";
let current="pending", items=[], generation=0, busy=false;
function node(tag, content){const n=document.createElement(tag);n.textContent=content;return n;}
async function request(view,body){
 const res=await fetch(API+(view?"&view="+view:""),{credentials:"same-origin",cache:"no-store",...(body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{})});
 let data;try{data=await res.json()}catch(_){data={}}
 if(!res.ok||!data.ok){const e=new Error(data.reason||"unavailable");e.status=res.status;throw e;}return data;
}
function hide(){generation++;entry.hidden=true;divider.hidden=true;records.replaceChildren();items=[];if(room.open)room.close();}
function failed(e){if(e.status===401||e.status===403){hide();return;}message.textContent=e.status===409?"记录已变化，请刷新后重试。":"暂时无法完成，请重试。";}
function button(label,fn){const b=node("button",label);b.type="button";b.addEventListener("click",fn);return b;}
function action(item,kind){
 if(busy)return;
 const approve=kind==="approve_identity";
 if(!confirm(approve?"确认已完成真实同行、必要沟通与装备，并批准此人的正式同工身份？本操作不会开通帐篷账号。":"确认撤销正式同工身份？本操作不会撤销已有帐篷账号。"))return;
 mutate({action:kind,id:item.id,expectedState:item.reviewState,confirmed:approve});
}
async function mutate(body){
 if(busy)return;busy=true;message.textContent="正在保存…";
 try{await request("",body);await refresh();}catch(e){failed(e);}finally{busy=false;}
}
function render(){
 records.replaceChildren();
 tabs.forEach(t=>t.setAttribute("aria-current",String(t.dataset.coworkerView===current)));
 if(current==="accounts"){records.append(node("p","账号与权限仍由现有服务器配置管理。本阶段未接通账号创建、权限分配及即时撤销；正式同工审批不会改变任何现有账号。"));return;}
 if(current==="history"){
  for(const item of items){const a=node("article","");a.append(node("h2",item.display_name),node("p",(item.state==="APPROVED"?"批准同工身份":"撤销同工身份")+" · "+new Date(item.created_at).toLocaleString()+" · "+item.operator_id));records.append(a);}
 }else{
  for(const item of items.filter(x=>current==="approved"?x.reviewState==="APPROVED":x.reviewState!=="APPROVED")){
   const a=node("article",""), controls=node("div","");controls.className="coworker-actions";
   a.append(node("h2",item.name),node("p",[item.country,item.province,item.city].join(" · ")),node("p",(item.reviewState==="APPROVED"?"正式同工":item.reviewState==="REVOKED"?"身份已撤销":"待审核")+" / "+(item.status==="HIDDEN"?"公开记录已撤下":"公开记录可见")));
   controls.append(button(item.reviewState==="APPROVED"?"撤销同工身份":"批准同工身份",()=>action(item,item.reviewState==="APPROVED"?"revoke_identity":"approve_identity")));
   controls.append(button(item.status==="HIDDEN"?"恢复公开展示":"撤下公开展示",()=>{if(confirm("确认修改公开展示状态？不会影响同工身份。"))mutate({action:item.status==="HIDDEN"?"restore":"withdraw",id:item.id});}));
   controls.append(button("修改回应资料",()=>{const values={};for(const [key,label] of [["country","国家 / 地区"],["province","省 / 州"],["city","城市 / 区域"],["name","姓名"]]){const value=prompt(label,item[key]);if(value===null)return;values[key]=value;}mutate({action:"edit",id:item.id,...values});}));
   a.append(controls);records.append(a);
  }
 }
 if(!records.childElementCount)records.append(node("p","暂无记录。"));
}
async function refresh(){
 const run=++generation, view=current;records.replaceChildren();message.textContent="正在读取…";
 try{const data=await request(view==="history"?"review-history":"admin");if(run!==generation||!room.open)return;items=data.items||[];render();message.textContent="";}catch(e){if(run===generation)failed(e);}
}
window.addEventListener("budao-tent-authenticated",async()=>{
 hide();const run=generation;
 try{await request("admin");if(run!==generation)return;entry.hidden=false;divider.hidden=false;}catch(_){}
});
entry.addEventListener("click",()=>{if(entry.hidden)return;current="pending";room.showModal();refresh();});
document.getElementById("coworkerClose").addEventListener("click",()=>room.close());
room.addEventListener("close",()=>{generation++;records.replaceChildren();items=[];message.textContent="";if(!entry.hidden)entry.focus();});
document.getElementById("coworkerRefresh").addEventListener("click",refresh);
tabs.forEach(t=>t.addEventListener("click",()=>{current=t.dataset.coworkerView;refresh();}));
})();