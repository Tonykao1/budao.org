(() => {
"use strict";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const STATES={draft:"草稿",review:"待审核",changes:"退回修改",approved:"待发布",published:"已发布"};
const STAGES=["draft","review","approved","published"];
const CURRENCY=new Intl.NumberFormat("zh-CN",{style:"currency",currency:"CNY",minimumFractionDigits:2});
const blobUrls=new Set();
let products=fixtures(),activeId=products[0].id,activeTab="basics",role="editor",filter="all",search="",dirty=false,nextCode=4,toastTimer=null;

function demoImage(label,bg,accent){
 const safe=label.replace(/[<>&"']/g,"");
 const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><defs><radialGradient id="g"><stop stop-color="#f8f7ee"/><stop offset="1" stop-color="'+bg+'"/></radialGradient></defs><rect width="600" height="600" fill="url(#g)"/><circle cx="300" cy="278" r="185" fill="none" stroke="'+accent+'" stroke-width="1" opacity=".6"/><circle cx="300" cy="278" r="145" fill="none" stroke="'+accent+'" stroke-width="1" stroke-dasharray="3 8" opacity=".65"/><rect x="230" y="199" width="140" height="174" rx="5" fill="'+accent+'" opacity=".72" transform="rotate(-8 300 280)"/><text x="300" y="472" text-anchor="middle" fill="#56715b" font-size="17" font-family="sans-serif">演示示意图 · '+safe+'</text></svg>';
 return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
}
function fixtures(){
 return [
  {id:"DEMO-001",code:"DEMO-001",name:"收纳织物（示例）",summary:"收纳与随行。",category:"织物与收纳",price:"128",stock:"12",specs:"织物示例规格（未核验）",availability:"in_stock",description:"织物商品资料示范，不代表实际材质、来源或库存。",origin:"示意发货地",regions:"示意配送范围",shippingFee:"0",merchant:"演示经营主体（未核验）",contact:"演示售后渠道",source:"演示来源资料（未核验）",shipping:"演示交付规则",returns:"演示售后规则",notes:"",material:"54",labor:"24",fulfillment:"18",aftersales:"8",status:"draft",images:[{id:"fixture-01",url:demoImage("织物","#e3e9df","#9baa85"),name:"系统示意图",kind:"demo"}],events:[{title:"建立演示商品",kind:"系统",note:"非真实商品"}]},
  {id:"DEMO-002",code:"DEMO-002",name:"日用器皿（示例）",summary:"日常使用。",category:"生活器物",price:"",stock:"",specs:"",availability:"",description:"",origin:"",regions:"",shippingFee:"",merchant:"",contact:"",source:"",shipping:"",returns:"",notes:"",material:"",labor:"",fulfillment:"",aftersales:"",status:"draft",images:[],events:[{title:"建立演示商品",kind:"系统",note:"待补充商品资料"}]},
  {id:"DEMO-003",code:"DEMO-003",name:"书写纸品（示例）",summary:"记录与书写。",category:"纸品与书写",price:"",stock:"",specs:"",availability:"",description:"",origin:"",regions:"",shippingFee:"",merchant:"",contact:"",source:"",shipping:"",returns:"",notes:"",material:"",labor:"",fulfillment:"",aftersales:"",status:"draft",images:[],events:[{title:"建立演示商品",kind:"系统",note:"待补充商品资料"}]}
 ];
}
function current(){return products.find(x=>x.id===activeId)||products[0]}
function currency(n){return CURRENCY.format(Number.isFinite(n)?n:0)}
function numeric(v){if(v===""||v===null||v===undefined)return NaN;const n=Number(v);return Number.isFinite(n)?n:NaN}
function value(p,key){const n=numeric(p[key]);return Number.isFinite(n)&&n>=0?n:0}
function canEdit(p=current()){return role==="editor"&&["draft","changes"].includes(p.status)}
function stamp(){return new Intl.DateTimeFormat("zh-CN",{month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(new Date())}
function record(p,title,kind="演示",note=""){p.events.unshift({title,kind,note,time:stamp()})}
function toast(message){const box=$("#toast");if(toastTimer)clearTimeout(toastTimer);box.textContent=message;box.hidden=false;toastTimer=setTimeout(()=>{box.hidden=true},3600)}
function elem(tag,attrs={},text){
 const e=document.createElement(tag);
 for(const [k,v] of Object.entries(attrs)){
  if(k==="class")e.className=v;
  else if(k==="type")e.type=v;
  else e.setAttribute(k,v);
 }
 if(text!==undefined)e.textContent=String(text);
 return e;
}
function check(p){
 const price=numeric(p.price),stock=numeric(p.stock);
 const validPrice=Number.isFinite(price)&&price>0&&price<=99999999;
 const basics=Boolean(p.name.trim()&&p.summary.trim()&&p.summary.trim().length<=40&&p.category&&p.specs.trim()&&["in_stock","preorder","sold_out"].includes(p.availability)&&validPrice&&Number.isInteger(stock)&&stock>=0&&stock<=999999&&(p.availability!=="in_stock"||stock>0));
 const images=p.images.length>0;
 const costs=["material","labor","fulfillment","aftersales"].map(k=>numeric(p[k]));
 const costValid=costs.every(n=>Number.isFinite(n)&&n>=0&&n<=99999999);
 const total=costs.reduce((a,n)=>a+(Number.isFinite(n)?n:0),0);
 const fairness=costValid&&validPrice&&Math.round(total*100)<=Math.round(price*100);
 const shippingFee=numeric(p.shippingFee);
 const delivery=Boolean(p.source.trim()&&p.origin.trim()&&p.regions.trim()&&p.merchant.trim()&&p.contact.trim()&&p.shipping.trim()&&p.returns.trim()&&Number.isFinite(shippingFee)&&shippingFee>=0);
 const sections={basics,images,fairness,delivery};
 return {sections,score:Object.values(sections).filter(Boolean).length,ready:Object.values(sections).every(Boolean),total,price:validPrice?price:0,remainder:validPrice?price-total:0};
}
function stateForFilter(s){return s==="changes"?"draft":s}
function renderCounts(){
 const all=products.length,draft=products.filter(p=>["draft","changes"].includes(p.status)).length,pending=products.filter(p=>p.status==="review").length;
 const box=$("#status-counts");box.replaceChildren();
 for(const [n,label] of [[all,"全部"],[draft,"草稿"],[pending,"待审核"]]){
  const div=elem("div",{class:"count-box"});div.append(elem("strong",{},n),elem("small",{},label));box.append(div);
 }
}
function renderList(){
 renderCounts();
 $$(".filter-btn").forEach(btn=>{const on=btn.dataset.filter===filter;btn.classList.toggle("active",on);btn.setAttribute("aria-pressed",String(on))});
 const list=$("#inventory-list");list.replaceChildren();
 const shown=products.filter(p=>(filter==="all"||stateForFilter(p.status)===filter)&&
   (p.name.toLocaleLowerCase().includes(search)||p.code.toLocaleLowerCase().includes(search)));
 if(!shown.length){list.append(elem("p",{class:"inventory-empty"},"暂无符合条件的商品"));return}
 for(const p of shown){
  const button=elem("button",{type:"button",class:"record-button"+(p.id===activeId?" active":""),"data-id":p.id,"aria-current":p.id===activeId?"true":"false"});
  const info=elem("span",{class:"record-label"});
  info.append(elem("strong",{},p.name.trim()||"未命名商品"),elem("small",{},p.code));
  button.append(info,elem("span",{class:"record-state "+p.status},STATES[p.status]||p.status));list.append(button);
 }
}
function renderTitle(){
 const p=current(),c=check(p);
 $("#breadcrumb-product").textContent=p.name.trim()||"未命名商品";$("#record-code").textContent=p.code;
 $("#record-title").textContent=p.name.trim()||"未命名商品";
 const badge=$("#record-status");badge.textContent=STATES[p.status];badge.className="state-tag state-"+p.status;
 $("#progress-text").textContent="完成度 "+c.score+" / 4";$("#progress-bar").style.width=(c.score*25)+"%";
 const bar=$("#editor-context"),msg=$("#context-message");
 const textByState={draft:"草稿可修改。",changes:"请根据审核意见修改并重新提交。",review:"等待审核。",approved:"审核已通过，可以模拟发布。",published:"模拟发布完成，不会出现在真实商店。"};
 msg.textContent=textByState[p.status];bar.className="context-bar "+(p.status==="review"?"review":p.status==="published"?"published":"");
 const change=$("#change-indicator");change.textContent=dirty?"本页有未确认改动":"模拟数据 · 非持久保存";change.classList.toggle("unsaved",dirty);
}
function bindFields(){
 const p=current(),enabled=canEdit(p);
 $$("[data-field]").forEach(input=>{const f=input.dataset.field;input.value=p[f]??"";input.disabled=(!enabled||f==="code")});
 $("#image-upload").disabled=!enabled;
 $("#review-note").disabled=role!=="reviewer"||!["review","approved","published"].includes(p.status);
 $("#save-draft").disabled=!enabled;$("#submit-review").disabled=!enabled;
 $("#save-draft").title=enabled?"演示保存，仅当前页面":"仅录入角色在草稿阶段可使用";
 $("#submit-review").title=enabled?"提交至模拟审核":"仅录入角色在草稿阶段可使用";
}
function switchTab(name){
 activeTab=name;
 $$(".editor-tab").forEach(b=>{const on=b.dataset.tab===name;b.classList.toggle("active",on);b.setAttribute("aria-selected",String(on));b.tabIndex=on?0:-1});
 $$(".editor-panel").forEach(p=>{const on=p.id==="editor-"+name;p.hidden=!on;p.classList.toggle("active",on)});
 if(name==="history")renderHistory();if(name==="fairness")renderFairness();
}
function renderImages(){
 const p=current(),wrap=$("#photo-collection");wrap.replaceChildren();
 if(!p.images.length){wrap.append(elem("p",{class:"photo-placeholder"},"尚未添加照片"));return}
 p.images.forEach((photo,index)=>{
  const box=elem("div",{class:"photo-entry"});
  box.append(elem("img",{src:photo.url,alt:photo.kind==="demo"?"系统生成的演示示意图":photo.name,loading:"lazy"}));
  if(index===0)box.append(elem("span",{class:"photo-first"},photo.kind==="demo"?"首图 · 模拟示意":"首图"));
  if(canEdit(p))box.append(elem("button",{class:"photo-remove",type:"button","data-remove-image":photo.id,"aria-label":"移除 "+photo.name},"×"));
  wrap.append(box);
 });
}
function renderFairness(){
 const p=current(),c=check(p),sum=c.total;
 $("#fair-price").textContent=p.price===""?"待填写":currency(c.price);
 $("#fair-cost").textContent=currency(sum);
 const remain=$("#fair-remainder");remain.textContent=currency(c.remainder);remain.classList.toggle("negative",c.remainder<0);
 const chart=$("#fairness-track");chart.replaceChildren();
 const bar=["material","labor","fulfillment","aftersales"].map(k=>({amount:value(p,k),cls:k}));
 bar.push({amount:Math.max(0,c.remainder),cls:"surplus"});
 const denom=Math.max(sum,c.price,.01);
 for(const item of bar){const span=elem("span",{class:"fair-segment "+item.cls});span.style.width=(100*item.amount/denom)+"%";span.title=item.cls+"："+currency(item.amount);chart.append(span)}
 const warning=$("#fair-warning");warning.classList.toggle("error",c.remainder<0);
 warning.textContent=c.remainder<0?"成本与报酬合计超过售价，请调整数字。":!Number.isFinite(numeric(p.price))?"请先填写参考售价。":"当前价格构成可继续核对。";
}
function renderProductPreview(){
 const p=current();$("#preview-category").textContent=p.category||"商品类别";$("#preview-name").textContent=p.name.trim()||"尚未命名";
 $("#preview-summary").textContent=p.summary.trim()||"商品的一句话介绍将显示在这里。";
 $("#preview-specs").textContent=p.specs.trim()||"规格信息待补充。";
 const price=numeric(p.price);$("#preview-price").textContent=Number.isFinite(price)&&price>0?currency(price):"价格待定";
 $("#preview-public-state").textContent=p.status==="published"?"模拟发布":"未公开";
 const frame=$("#preview-image");frame.replaceChildren();
 if(p.images.length){const photo=p.images[0];frame.append(elem("img",{src:photo.url,alt:photo.kind==="demo"?"演示示意图":photo.name}))}
 else frame.append(elem("span",{class:"preview-image-mark","aria-hidden":"true"},"M"),elem("small",{},"尚无实物照片"));
 const c=check(p),list=$("#checklist");list.replaceChildren();
 for(const [key,label] of [["basics","商品与价格"],["images","商品图片"],["fairness","价格核算"],["delivery","交付与售后"]]){
  list.append(elem("li",{class:c.sections[key]?"ok":""},label+(c.sections[key]?" · 完成":" · 待补充")));
 }
}
function actionButton(label,action,primary){
 return elem("button",{type:"button",class:primary?"button-primary":"button-secondary","data-action":action},label);
}
function renderHistory(){
 const p=current(),index=STAGES.indexOf(p.status==="changes"?"draft":p.status);
 $$(".flow-step").forEach((el,i)=>{el.classList.toggle("done",i<index);el.classList.toggle("current",i===index)});
 const wrap=$("#review-actions");wrap.replaceChildren();
 if(role==="reviewer"&&p.status==="review"){wrap.append(actionButton("退回修改","request-changes",false),actionButton("批准通过","approve",true))}
 else if(role==="reviewer"&&p.status==="approved")wrap.append(actionButton("模拟发布","publish",true));
 else if(role==="reviewer"&&p.status==="published")wrap.append(actionButton("模拟下架","unpublish",false));
 else wrap.append(elem("p",{class:"inline-note"},role==="editor"?"录入角色可提交审核；审核角色负责批准。":"当前状态无需审核操作。"));
 const list=$("#activity-list");list.replaceChildren();
 for(const e of p.events){
  const li=elem("li");li.append(elem("div",{class:"activity-title"},e.title),elem("div",{class:"activity-meta"},(e.time||"演示开始")+" · "+e.kind));
  if(e.note)li.append(elem("div",{class:"activity-note"},e.note));list.append(li);
 }
}
function render(){
 const p=current();renderTitle();renderList();bindFields();renderImages();renderFairness();renderProductPreview();renderHistory();switchTab(activeTab);
 $("#editor-bottom-hint").textContent=role==="editor"?"本页仅模拟保存；刷新会重置。":"审核结果仅在当前页面显示。";
 $("#switch-editor").classList.toggle("active",role==="editor");$("#switch-editor").setAttribute("aria-pressed",String(role==="editor"));
 $("#switch-reviewer").classList.toggle("active",role==="reviewer");$("#switch-reviewer").setAttribute("aria-pressed",String(role==="reviewer"));
}
function editableAction(fn){if(!canEdit()){toast("请使用录入角色，并选择草稿或退回修改商品。");return false}return fn()}
function addProduct(){
 role="editor";filter="all";search="";$("#search-products").value="";
 const id="DEMO-"+String(nextCode++).padStart(3,"0");
 const p={id,code:id,name:"",summary:"",category:"",price:"",stock:"",specs:"",availability:"",description:"",origin:"",regions:"",shippingFee:"",merchant:"",contact:"",source:"",shipping:"",returns:"",notes:"",material:"",labor:"",fulfillment:"",aftersales:"",status:"draft",images:[],events:[]};
 record(p,"建立新商品草稿","录入");products.unshift(p);activeId=id;activeTab="basics";dirty=true;render();
 toast("已创建空白草稿。请填写资料（仅本页有效）。");
 if(window.matchMedia("(max-width: 800px)").matches)$("#record-title").scrollIntoView({block:"start",behavior:"smooth"});
}
function imageUpload(input){
 if(!canEdit())return;
 const p=current(),selected=Array.from(input.files||[]);if(!selected.length)return;
 const remaining=5-p.images.length;let kept=0,ignored=0;
 for(const file of selected){
  if(kept>=remaining||!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>8*1024*1024||file.size===0){ignored++;continue}
  const url=URL.createObjectURL(file);blobUrls.add(url);
  p.images.push({id:"img-"+Date.now()+"-"+Math.random().toString(36).slice(2),url,name:file.name,kind:"local"});kept++;
 }
 input.value="";if(kept)dirty=true;
 renderImages();renderProductPreview();renderTitle();renderList();
 toast(kept?"已在本机预览 "+kept+" 张图片"+(ignored?"，跳过 "+ignored+" 张":"")+"；不会上传。":"未添加图片：请检查格式、大小和数量限制。");
}
function removeImage(id){
 if(!canEdit())return;
 const p=current(),photo=p.images.find(x=>x.id===id);if(!photo)return;
 if(photo.kind==="local"){URL.revokeObjectURL(photo.url);blobUrls.delete(photo.url)}
 p.images=p.images.filter(x=>x.id!==id);dirty=true;renderImages();renderProductPreview();renderTitle();renderList();toast("图片已从本页移除。");
}
function submitReview(){
 editableAction(()=>{
  const p=current(),c=check(p);
  if(!c.ready){const first=Object.entries(c.sections).find(([k,v])=>!v)?.[0]||"basics";switchTab(first);toast("请完成右侧发布前检查中的全部项目，再提交审核。");return}
  p.status="review";dirty=false;record(p,"提交审核","录入");activeTab="history";render();toast("已提交模拟审核。切换审核角色体验批准流程。");
 });
}
function review(action){
 if(role!=="reviewer"){toast("请切换到审核角色。");return}
 const p=current(),note=$("#review-note").value.trim(),c=check(p);
 if(action==="approve"&&p.status==="review"){
  if(!c.ready){toast("商品资料不完整，无法批准。");return}
  p.status="approved";record(p,"审核通过","审核",note);
 } else if(action==="request-changes"&&p.status==="review"){
  if(!note){toast("退回时请填写修改意见。");$("#review-note").focus();return}
  p.status="changes";record(p,"退回修改","审核",note);
 } else if(action==="publish"&&p.status==="approved"){
  if(!c.ready){toast("资料不完整，无法模拟发布。");return}
  p.status="published";record(p,"模拟发布","审核","仅演示，不会同步到商店");
 } else if(action==="unpublish"&&p.status==="published"){
  p.status="approved";record(p,"模拟下架","审核",note);
 } else{toast("当前商品不支持此操作。");return}
 dirty=false;$("#review-note").value="";render();toast("已完成模拟操作，不会影响真实商品。");
}
function resetAll(){
 for(const url of blobUrls)URL.revokeObjectURL(url);
 blobUrls.clear();products=fixtures();activeId=products[0].id;role="editor";filter="all";search="";dirty=false;nextCode=4;activeTab="basics";
 $("#search-products").value="";$("#review-note").value="";render();toast("演示数据已重置。");
}
$$("[data-field]").forEach(input=>{
 const change=()=>{
  if(!canEdit())return;
  const p=current(),field=input.dataset.field;if(field==="code")return;
  p[field]=input.value;dirty=true;renderTitle();renderList();renderProductPreview();if(activeTab==="fairness")renderFairness();
 };
 input.addEventListener("input",change);input.addEventListener("change",change);
});
$$(".editor-tab").forEach(btn=>{
 btn.addEventListener("click",()=>switchTab(btn.dataset.tab));
 btn.addEventListener("keydown",event=>{
  if(event.key!=="ArrowRight"&&event.key!=="ArrowLeft")return;
  event.preventDefault();const tabs=$$(".editor-tab");const i=(tabs.indexOf(btn)+(event.key==="ArrowRight"?1:-1)+tabs.length)%tabs.length;
  tabs[i].focus();switchTab(tabs[i].dataset.tab);
 });
});
$("#inventory-list").addEventListener("click",e=>{const b=e.target.closest("[data-id]");if(!b)return;activeId=b.dataset.id;activeTab="basics";dirty=false;render()});
$("#create-product").addEventListener("click",addProduct);
$$(".filter-btn").forEach(b=>b.addEventListener("click",()=>{filter=b.dataset.filter;renderList()}));
$("#search-products").addEventListener("input",e=>{search=e.target.value.toLocaleLowerCase().trim();renderList()});
$("#image-upload").addEventListener("change",e=>imageUpload(e.target));
$("#photo-collection").addEventListener("click",e=>{const b=e.target.closest("[data-remove-image]");if(b)removeImage(b.dataset.removeImage)});
$("#switch-editor").addEventListener("click",()=>{role="editor";render();toast("当前为录入角色演示，无实际权限变更。")});
$("#switch-reviewer").addEventListener("click",()=>{role="reviewer";activeTab="history";render();toast("当前为审核角色演示，无实际权限变更。")});
$("#save-draft").addEventListener("click",()=>editableAction(()=>{record(current(),"保存演示草稿","录入");dirty=false;render();toast("草稿已在本页保存，刷新后仍会重置。")}));
$("#submit-review").addEventListener("click",submitReview);
$("#review-actions").addEventListener("click",e=>{const b=e.target.closest("[data-action]");if(b)review(b.dataset.action)});
const dialog=$("#reset-dialog");
$("#reset-demo").addEventListener("click",()=>{if(dialog.showModal)dialog.showModal();else if(window.confirm("重置本次演示？"))resetAll()});
$("#reset-cancel").addEventListener("click",()=>dialog.close());
$("#reset-confirm").addEventListener("click",()=>{resetAll();dialog.close()});
dialog.addEventListener("click",e=>{if(e.target===dialog)dialog.close()});
window.addEventListener("pagehide",()=>{for(const url of blobUrls)URL.revokeObjectURL(url);blobUrls.clear()});
render();
})();