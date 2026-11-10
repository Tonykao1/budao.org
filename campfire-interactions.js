/* 营火之地 · 火光与回响。No external trackers, no public reaction counts. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const create=(tag,cls,text)=>{
    const x=document.createElement(tag);
    if(cls)x.className=cls;
    if(text!==undefined)x.textContent=String(text);
    return x;
  };
  const api="/api/campfire";
  let photo=null;
  let liked=new Set();
  let comments=[];
  let lastPending=null;
  let enabled=false;
  let admin=false;
  let available=false;
  const photoLiked=new Set();

  async function get(url) {
    const r=await fetch(url,{credentials:"same-origin",cache:"no-store"});
    const data=await r.json().catch(()=>({ok:false,reason:"service_unavailable"}));
    if(!r.ok||!data.ok)throw Error(data.reason||"service_unavailable");
    return data;
  }
  async function post(body) {
    const r=await fetch(api,{method:"POST",credentials:"same-origin",
      headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await r.json().catch(()=>({ok:false,reason:"service_unavailable"}));
    if(!r.ok||!data.ok)throw Error(data.reason||"service_unavailable");
    return data;
  }
  function reason(e) {
    const reason=String(e.message||e);
    return ({
      guest_reactions_not_enabled:"此功能尚在筹备，暂未开放访客互动。",
      guest_comments_not_enabled:"访客留言暂时关闭，请稍后再试。",
      visitor_session_required:"未找到本设备的匿名会话，无法核对留言归属。",
      comment_unavailable:"这条评论不存在、已被撤回，或不属于当前浏览器。",
      migration_required:"互动数据准备中，暂时无法连接。",
      rate_limited:"操作稍频繁，请稍后再试。",
      consent_required:"请先阅读并同意社区规则。",
      invalid_comment:"留言需至少两个字，请不要包含链接。",
      temporarily_unavailable:"互动服务暂时不可用。",
      photo_unavailable:"这张照片尚未开放互动。"
    })[reason]||"操作尚未完成，请稍后再试。";
  }
  function state(message){if($("camp-comment-state"))$("camp-comment-state").textContent=message;}
  function sparkState(message){if($("camp-spark-state"))$("camp-spark-state").textContent=message;}
  function setSparkButton(button,targetId,isCurrent) {
    if(!button)return;
    const on=isCurrent?liked.has("photo:"+targetId):photoLiked.has(targetId);
    button.textContent=on?"✦ 这一刻已点亮":"✧ 留下一颗火星";
    button.classList.toggle("is-lit",on);
    button.disabled=on||(!enabled&&!admin)||!available;
    button.setAttribute("aria-pressed",String(on));
  }
  async function sparkPhoto(photoId,button) {
    if(!enabled&&!admin) return;
    if(photoLiked.has(photoId))return;
    if(button)button.disabled=true;
    try {
      const data=await post({action:"react",kind:"photo",photoId});
      if(data.reacted) {
        photoLiked.add(photoId);
        if(photo?.image===photoId)liked.add("photo:"+photoId);
        setSparkButton(button,photoId,false);
        setSparkButton($("camp-photo-spark"),photoId,true);
        sparkState("已为这一刻留下一颗火星。");
      }
    }catch(e){sparkState(reason(e));if(button)button.disabled=false;}
  }
  function replyTo(c) {
    $("camp-parent-id").value=c.id;
    $("camp-reply-label").textContent="回复 "+c.name;
    $("camp-reply-cancel").hidden=false;
    $("camp-comment-body").focus();
  }
  function resetReply() {
    $("camp-parent-id").value="";
    $("camp-reply-label").textContent="留下一段同行的话";
    $("camp-reply-cancel").hidden=true;
  }
  function button(text,className,fn){
    const b=create("button",className,text);
    b.type="button";b.addEventListener("click",fn);return b;
  }
  async function reactComment(c,b) {
    b.disabled=true;
    try {
      await post({action:"react",kind:"comment",photoId:photo.image,commentId:c.id});
      liked.add("comment:"+c.id);
      b.textContent="✦ 已点亮";
    }catch(e){b.disabled=false;state(reason(e));}
  }
  async function reportComment(c) {
    if(!window.confirm("确定要向管理员举报这条评论吗？"))return;
    try{await post({action:"report",commentId:c.id});state("感谢提醒，我们会认真核查。");}
    catch(e){state(reason(e));}
  }
  function renderComment(c,depth=0){
    const el=create("article","camp-thread-message"+(depth?" camp-thread-reply":""));
    const head=create("div","camp-thread-meta");
    head.append(create("strong","",c.name));
    if(c.official)head.append(create("span","camp-official","步道回复"));
    const date=new Date(c.createdAt);
    if(Number.isFinite(date.getTime()))head.append(create("time","",date.toLocaleDateString("zh-CN")));
    const body=create("p","camp-thread-body",c.body);
    const tools=create("div","camp-thread-tools");
    const likedAlready=liked.has("comment:"+c.id);
    const spark=button(likedAlready?"✦ 已点亮":"✧ 留火光","camp-thread-tool",()=>reactComment(c,spark));
    spark.disabled=likedAlready||(!enabled&&!admin);
    tools.append(spark);
    if(enabled||admin)tools.append(button("回复","camp-thread-tool",()=>replyTo(c)));
    tools.append(button("举报","camp-thread-tool",()=>reportComment(c)));
    if(c.mine && !c.official) {
      tools.append(button("撤回我的留言","camp-thread-tool",async()=>{
        if(!window.confirm("确定撤回这条留言吗？撤回后无法恢复。"))return;
        try {
          await post({action:"withdraw",commentId:c.id});
          state("留言已撤回，个人关联记录已清除。");
          await refreshThread();
        }catch(e){state(reason(e));}
      }));
    }
    if(admin) {
      tools.append(button("隐藏","camp-thread-tool camp-manage-tool",()=>changeStatus(c.id,"HIDDEN")));
      tools.append(button("删除","camp-thread-tool camp-manage-tool",()=>removeComment(c.id)));
    }
    el.append(head,body,tools);
    return el;
  }
  function renderThread() {
    const root=$("camp-thread");
    if(!root)return;
    const top=comments.filter(c=>!c.parentId);
    const orphan=comments.filter(c=>c.parentId&&!comments.some(p=>p.id===c.parentId));
    root.replaceChildren();
    if(!comments.length){
      root.append(create("p","camp-thread-empty","还没有公开留言。或许你愿意成为第一个留下回响的人。"));
      return;
    }
    for(const c of [...top,...orphan]){
      const group=create("section","camp-thread-group");
      group.append(renderComment(c));
      for(const reply of comments.filter(child=>child.parentId===c.id))
        group.append(renderComment(reply,1));
      root.append(group);
    }
  }
  async function changeStatus(id,status) {
    try {
      await post({action:"moderate",commentId:id,status});
      state("管理员操作已记录。");
      await refreshThread();
      if(!$("camp-moderation").hidden)await loadModeration();
    } catch(e){state(reason(e));}
  }
  function removeComment(id) {
    if(window.confirm("确认永久删除这条留言？正文将被清除，无法恢复。"))changeStatus(id,"DELETED");
  }
  async function refreshThread() {
    if(!photo || photo.kind!=="moment")return;
    const root=$("camp-thread");
    root.replaceChildren(create("p","camp-thread-empty","正在拾起沿途的声音……"));
    try {
      const data=await get(api+"?view=thread&photoId="+encodeURIComponent(photo.image));
      available=true;
      enabled=data.guestWritesEnabled===true;
      comments=data.comments||[];
      liked=new Set(data.reacted||[]);
      if(liked.has("photo:"+photo.image))photoLiked.add(photo.image);
      renderThread();
      setSparkButton($("camp-photo-spark"),photo.image,true);
      $("camp-comment-submit").disabled=!enabled&&!admin;
      $("camp-comment-name").disabled=!enabled&&!admin;
      $("camp-comment-body").disabled=!enabled&&!admin;
      $("camp-comment-consent").disabled=!enabled&&!admin;
      if(!enabled&&!admin)state("访客留言与点赞尚在合规准备中，当前仅供浏览。");
      else state("");
    }catch(e) {
      available=false;
      root.replaceChildren(create("p","camp-thread-empty",reason(e)));
      $("camp-photo-spark").disabled=true;
      $("camp-comment-submit").disabled=true;
      state("互动服务正在准备中；你仍然可以欣赏这些步道影像。");
    }
  }
  async function showPhoto(item) {
    photo=item;
    lastPending=null;
    $("camp-withdraw-pending").hidden=true;
    resetReply();
    sparkState("");
    state("");
    if(!item || item.kind!=="moment"){$("camp-conversation").hidden=true;return;}
    $("camp-conversation").hidden=false;
    await refreshThread();
  }
  async function findAdmin() {
    try{
      const r=await fetch("/api/auth/session",{credentials:"same-origin",cache:"no-store"});
      const d=await r.json();
      admin=!!d.ok && d.capabilities?.steward===true;
    }catch(e){admin=false;}
    $("camp-moderation").hidden=!admin;
  }
  async function loadModeration() {
    const root=$("camp-moderation-list");
    root.replaceChildren(create("p","camp-thread-empty","正在读取审核队列……"));
    try {
      const d=await get(api+"?view=moderation");
      root.replaceChildren();
      if(!d.pending.length&&!d.reports.length)
        root.append(create("p","camp-thread-empty","没有待处理的留言或举报。"));
      for(const c of d.pending){
        const row=create("article","camp-moderation-row");
        row.append(create("small","",c.status+" · "+c.photoId));
        row.append(create("p","",c.name+"： "+c.body));
        const acts=create("div","camp-thread-tools");
        if(c.status==="PENDING"){
          acts.append(button("审核通过","camp-thread-tool",()=>changeStatus(c.id,"APPROVED")));
          acts.append(button("拒绝公开","camp-thread-tool",()=>changeStatus(c.id,"REJECTED")));
        }else {
          acts.append(button("恢复公开","camp-thread-tool",()=>changeStatus(c.id,"APPROVED")));
        }
        acts.append(button("删除","camp-thread-tool",()=>removeComment(c.id)));
        row.append(acts);root.append(row);
      }
      for(const report of d.reports){
        const row=create("article","camp-moderation-row");
        row.append(create("small","", "收到举报 · "+report.photoId));
        row.append(create("p","",report.body));
        row.append(button("隐藏此评论","camp-thread-tool",()=>changeStatus(report.commentId,"HIDDEN")));
        root.append(row);
      }
    }catch(e){root.replaceChildren(create("p","camp-thread-empty",reason(e)));}
  }
  function refreshCardButtons(){
    document.querySelectorAll(".camp-card-spark[data-photo-id]").forEach(button=>{
      setSparkButton(button,button.dataset.photoId,false);
    });
  }
  async function configure(){
    try {
      const config=await get(api+"?view=config");
      available=true;
      enabled=config.guestWritesEnabled===true;
    }catch(e){available=false;enabled=false;}
    refreshCardButtons();
  }
  function mount(){
    document.addEventListener("campfire:photo-open",e=>showPhoto(e.detail.item));
    const form=$("camp-comment-form");
    form?.addEventListener("submit",async e=>{
      e.preventDefault();
      if(!photo)return;
      const submit=$("camp-comment-submit");
      submit.disabled=true;
      try{
        const response=await post({
          action:"comment",photoId:photo.image,parentId:$("camp-parent-id").value||null,
          name:$("camp-comment-name").value,body:$("camp-comment-body").value,
          company_website:$("camp-company-website").value,
          consent:$("camp-comment-consent").checked
        });
        $("camp-comment-body").value="";resetReply();
        lastPending=response.status==="PENDING"?response.id:null;
        $("camp-withdraw-pending").hidden=!lastPending;
        state(response.status==="PENDING"?"感谢留言！审核通过后将在这里公开。你也可以随时撤回刚提交的内容。":"你的回复已发布。");
        if(response.status==="APPROVED")await refreshThread();
      }catch(err){state(reason(err));}
      finally{submit.disabled=!enabled&&!admin;}
    });
    $("camp-reply-cancel")?.addEventListener("click",resetReply);
    $("camp-withdraw-pending")?.addEventListener("click",async()=>{
      if(!lastPending||!window.confirm("确定撤回刚提交的待审留言吗？"))return;
      const id=lastPending;
      try {
        await post({action:"withdraw",commentId:id});
        lastPending=null;
        $("camp-withdraw-pending").hidden=true;
        state("已撤回。留言正文及匿名关联已清除。");
      }catch(e){state(reason(e));}
    });
    $("camp-photo-spark")?.addEventListener("click",()=>photo&&sparkPhoto(photo.image,$("camp-photo-spark")));
    $("camp-load-moderation")?.addEventListener("click",loadModeration);
    Promise.allSettled([findAdmin(),configure()]).then(refreshCardButtons);
  }
  window.CampfireSignals={sparkPhoto,setSparkButton};
  mount();
})();