/* 营火之地 · 星火同行第二阶段：回响、双向同意和站内交流 */
(()=>{
  "use strict";
  const $=id=>document.getElementById(id);
  const api="/api/campfire";
  const el=(tag,cls,value)=>{
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(value!==undefined)n.textContent=String(value);
    return n;
  };
  const btn=(title,handler,cls="camp-peer-action")=>{
    const b=el("button",cls,title);b.type="button";b.addEventListener("click",handler);return b;
  };
  let inviteTarget=null, roomId=null, inboxSnapshot=null, loaded=false;
  async function request(query,body) {
    const r=await fetch(api+(query||""),body===undefined?
      {credentials:"same-origin",cache:"no-store"}:
      {credentials:"same-origin",method:"POST",
        headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const v=await r.json().catch(()=>({ok:false,reason:"temporarily_unavailable"}));
    if(!r.ok||!v.ok)throw Error(v.reason||"temporarily_unavailable");
    return v;
  }
  const humanError=e=>({
    leave_a_comment_first:"请先在这张照片下留下一条评论，等待审核通过后，才能向另一位评论者发出邀请。",
    invitation_exists:"这段邀请已存在；为尊重对方，不能反复发送。",
    cannot_invite_self:"不能邀请自己。",
    no_contact_details:"请不要发送电话号码、邮箱或外部链接。保持站内交流即可。",
    invalid_message:"请输入 2—300 字的站内留言，不要包含联系方式或链接。",
    invitation_unavailable:"邀请不存在、已关闭，或不属于当前浏览器。",
    visitor_session_required:"当前浏览器没有可识别的匿名会话。",
    rate_limited:"操作次数稍多，请稍后再试。",
    consent_required:"请先确认这是你自愿发起的邀请。",
    temporarily_unavailable:"服务暂时不可用，请稍后重试。"
  })[String(e.message||e)]||"操作未能完成，请稍后重试。";

  function inviteTo(comment,photo) {
    if(!comment||!photo?.image||comment.mine||comment.official)return;
    inviteTarget={commentId:comment.id,photoId:photo.image,name:comment.name};
    $("camp-invite-form").hidden=false;
    $("camp-peer-invite-label").textContent="向「"+comment.name+"」发起一段自愿的同行交流";
    $("camp-peer-invite-note").value="";
    $("camp-peer-invite-consent").checked=false;
    $("camp-peer-invite-status").textContent="";
    $("camp-peer-invite-note").focus();
  }
  async function submitInvite() {
    if(!inviteTarget)return;
    const b=$("camp-peer-invite-submit");b.disabled=true;
    try{
      const data=await request("",{
        action:"invite",photoId:inviteTarget.photoId,
        targetCommentId:inviteTarget.commentId,
        note:$("camp-peer-invite-note").value,
        consent:$("camp-peer-invite-consent").checked
      });
      if(data.status==="PENDING"){
        $("camp-peer-invite-status").textContent="邀请已经送达对方的「我的回响」。只有对方主动接受后，才可以开始站内对话。";
        await refreshInbox(false);
      }
    }catch(e){$("camp-peer-invite-status").textContent=humanError(e);}
    finally{b.disabled=false;}
  }
  function hasNew(snapshot){
    if(!snapshot?.hasIdentity)return false;
    const seen=snapshot.lastReadAt?new Date(snapshot.lastReadAt).getTime():0;
    const entries=[
      ...snapshot.replies.map(x=>({time:x.createdAt})),
      ...snapshot.invites.map(x=>({time:x.updatedAt||x.createdAt}))
    ];
    return entries.some(x=>new Date(x.time).getTime()>seen);
  }
  function indicator(snapshot) {
    const newItems=hasNew(snapshot);
    $("camp-inbox-dot").hidden=!newItems;
    $("camp-inbox-badge").hidden=!newItems;
  }
  const photoUrl=photoId=>"/yhzd.html?photo="+encodeURIComponent(photoId);
  function textBlock(value,cls=""){
    return el("p",cls,value);
  }
  async function decide(id,action) {
    try{
      await request("",{action:"invite-"+action,inviteId:id});
      await refreshInbox(true);
    }catch(e){state(humanError(e));}
  }
  function state(message){const node=$("camp-room-state");if(node)node.textContent=message;}
  function replyCard(reply){
    const row=el("article","camp-inbox-item");
    const head=el("div","camp-inbox-item-head");
    head.append(el("strong","",reply.official?"步道官方回应":reply.name+" 回应了你的记忆"));
    const d=new Date(reply.createdAt);
    if(Number.isFinite(d.getTime()))head.append(el("time","",d.toLocaleDateString("zh-CN")));
    row.append(head,textBlock(reply.snippet));
    const link=el("a","camp-peer-action","回到那张照片 ↗");
    link.href=photoUrl(reply.photoId);row.append(link);
    return row;
  }
  function inviteCard(item){
    const row=el("article","camp-inbox-item");
    const outgoing=item.mine;
    const title=outgoing?"我邀请了 "+item.recipientName:item.senderName+" 想与你建立站内联系";
    const head=el("div","camp-inbox-item-head");
    head.append(el("strong","",title));
    const labels={PENDING:"等待回应",ACCEPTED:"双方已同意",DECLINED:"已婉拒",CANCELLED:"已取消",BLOCKED:"已屏蔽"};
    head.append(el("small","",labels[item.status]||item.status));
    row.append(head);
    if(item.note)row.append(textBlock("邀请留言："+item.note));
    const actions=el("div","camp-inbox-buttons");
    if(item.status==="PENDING"&&!outgoing){
      actions.append(btn("我愿意回应",()=>decide(item.id,"accept")),
        btn("暂不同行",()=>decide(item.id,"decline")));
    }
    if(item.status==="PENDING"&&outgoing)
      actions.append(btn("撤回邀请",()=>decide(item.id,"cancel")));
    if(item.status==="ACCEPTED"){
      actions.append(btn("打开私密对话",()=>openRoom(item.id)));
      actions.append(btn("停止联系",()=>{
        if(window.confirm("停止后双方都无法继续发送消息，确定吗？"))
          decide(item.id,"cancel");
      }));
    }
    if(!outgoing&&["PENDING","ACCEPTED"].includes(item.status))
      actions.append(btn("屏蔽此联系",()=>{
        if(window.confirm("屏蔽后双方将无法继续联系。确定吗？"))decide(item.id,"block");
      }));
    const link=el("a","camp-peer-action","这段相遇 ↗");
    link.href=photoUrl(item.photoId);actions.append(link);
    row.append(actions);
    return row;
  }
  function drawInbox(v) {
    const root=$("camp-inbox-list");root.replaceChildren();
    if(!v.hasIdentity){
      root.append(textBlock("这台设备尚未建立营火互动标记。你可以先为一张照片留下火光或评论，再回到这里查看属于你的回响。","camp-thread-empty"));
      return;
    }
    $("camp-inbox-read").hidden=false;
    if(!v.replies.length&&!v.invites.length){
      root.append(textBlock("暂时没有新的回响。你可以先分享一段真实的步道记忆。","camp-thread-empty"));
      return;
    }
    if(v.replies.length){
      root.append(el("h3","camp-inbox-section-title","来自评论的回应"));
      for(const note of v.replies)root.append(replyCard(note));
    }
    if(v.invites.length){
      root.append(el("h3","camp-inbox-section-title","同行邀请"));
      for(const item of v.invites)root.append(inviteCard(item));
    }
  }
  async function refreshInbox(show) {
    if(show){$("camp-inbox-panel").hidden=false;$("camp-inbox-open").setAttribute("aria-expanded","true");}
    try{
      const v=await request("?view=inbox");
      inboxSnapshot=v;loaded=true;
      indicator(v);
      if(!$("camp-inbox-panel").hidden)drawInbox(v);
    }catch(e){
      if(!$("camp-inbox-panel").hidden)
        $("camp-inbox-list").replaceChildren(textBlock(humanError(e),"camp-thread-empty"));
    }
  }
  function roomMessage(message) {
    const div=el("article","camp-room-message"+(message.mine?" is-mine":""));
    div.append(el("small","",message.mine?"我":"同行者"),
      textBlock(message.body));
    if(!message.mine&&!message.redacted)
      div.append(btn("举报此消息并屏蔽",()=>{
        if(window.confirm("举报后将立即屏蔽双方的联系，管理员会收到消息内容。是否继续？"))
          reportRoom(message.id);
      }));
    return div;
  }
  async function openRoom(id) {
    roomId=id;
    const room=$("camp-conversation-room");room.hidden=false;
    $("camp-room-state").textContent="";
    $("camp-room-messages").replaceChildren(textBlock("正在打开经双方同意的对话……"));
    try{
      const v=await request("?view=conversation&inviteId="+encodeURIComponent(id));
      if(roomId!==id)return;
      const active=v.invitation.status==="ACCEPTED";
      $("camp-room-form").hidden=!active;
      $("camp-room-walk-intent").disabled=!active;
      $("camp-room-title").textContent="和 "+(v.invitation.mine?v.invitation.recipientName:v.invitation.senderName)+" 的同行回响";
      const root=$("camp-room-messages");root.replaceChildren();
      if(!active)root.append(textBlock("此邀请尚未被双方同意，或联系已结束。"));
      else if(!v.messages.length)root.append(textBlock("还没有私密消息。愿意从一句感谢开始吗？"));
      else for(const message of v.messages)root.append(roomMessage(message));
      const myInterest=v.invitation.mine?v.invitation.senderWantsWalk:v.invitation.recipientWantsWalk;
      $("camp-room-walk-intent").setAttribute("aria-pressed",String(!!myInterest));
      $("camp-room-walk-intent").textContent=myInterest?"✓ 我仍愿意再次同行 · 点此撤回":"我愿意寻找下一次同行";
      $("camp-room-walk-status").textContent=v.invitation.senderWantsWalk&&v.invitation.recipientWantsWalk?
        "你们双方都表达了再次同行的意愿。请从公开步道日历选择合适的线路；这不是报名或实际同行的证明。":
        (myInterest?"你的意愿已记录。只有对方也主动选择，才会显示双方共同意愿。":"你的意愿不会被自动发送或公开。");
      room.scrollIntoView({block:"nearest",behavior:"smooth"});
    }catch(e){state(humanError(e));}
  }
  async function sendRoom(event) {
    event.preventDefault();
    if(!roomId)return;
    const body=$("camp-room-body").value;
    try{
      await request("",{action:"private-message",inviteId:roomId,body});
      $("camp-room-body").value="";
      await openRoom(roomId);
      await refreshInbox(false);
    }catch(e){state(humanError(e));}
  }
  async function walkIntent() {
    if(!roomId||!inboxSnapshot)return;
    const id=roomId;
    const item=inboxSnapshot.invites.find(x=>x.id===id);
    if(!item)return;
    const selected=item.mine?item.senderWantsWalk:item.recipientWantsWalk;
    try{
      await request("",{action:"walk-intent",inviteId:id,interested:!selected});
      await refreshInbox(false);await openRoom(id);
    }catch(e){state(humanError(e));}
  }
  async function reportRoom(messageId) {
    if(!roomId)return;
    try{
      await request("",{action:"private-report",inviteId:roomId,messageId});
      state("举报已送达管理员，联系已屏蔽。");
      await refreshInbox(false);
      await openRoom(roomId);
    }catch(e){state(humanError(e));}
  }
  async function adminReports() {
    const root=$("camp-private-report-list");
    root.replaceChildren(textBlock("正在读取私密消息举报……"));
    try{
      const v=await request("?view=private-reports");
      root.replaceChildren();
      if(!v.reports.length)root.append(textBlock("暂无私密对话举报。"));
      for(const report of v.reports){
        const row=el("article","camp-inbox-item");
        row.append(textBlock("举报原因："+report.reason),textBlock(report.body));
        const actions=el("div","camp-inbox-buttons");
        actions.append(btn("移除消息",()=>moderateReport(report.id,"REDACT")),
          btn("结束核查",()=>moderateReport(report.id,"DISMISS")));
        row.append(actions);root.append(row);
      }
    }catch(e){root.replaceChildren(textBlock(humanError(e)));}
  }
  async function moderateReport(id,decision) {
    try{
      await request("",{action:"private-moderate",reportId:id,decision});
      await adminReports();
    }catch(e){state(humanError(e));}
  }
  async function exposeAdminReports() {
    try{
      const r=await fetch("/api/auth/session",{credentials:"same-origin"});
      const j=await r.json();
      if(!j.ok||!j.capabilities?.steward)return;
      const section=$("camp-moderation");
      if(!section||$("camp-private-report-list"))return;
      const wrap=el("section","camp-private-report");
      wrap.append(el("h4","","私密消息举报"));
      wrap.append(btn("查看私密消息举报",adminReports));
      const root=el("div");root.id="camp-private-report-list";
      wrap.append(root);
      section.append(wrap);
    }catch{}
  }
  function mount() {
    $("camp-peer-invite-submit")?.addEventListener("click",submitInvite);
    $("camp-peer-invite-cancel")?.addEventListener("click",()=>{
      inviteTarget=null;$("camp-invite-form").hidden=true;
    });
    document.addEventListener("campfire:photo-open",()=>{
      inviteTarget=null;$("camp-invite-form").hidden=true;
    });
    $("camp-inbox-open")?.addEventListener("click",()=>{
      const panel=$("camp-inbox-panel");
      panel.hidden=!panel.hidden;
      $("camp-inbox-open").setAttribute("aria-expanded",String(!panel.hidden));
      if(!panel.hidden)refreshInbox(false);
    });
    $("camp-inbox-refresh")?.addEventListener("click",()=>refreshInbox(false));
    $("camp-inbox-read")?.addEventListener("click",async()=>{
      try{await request("",{action:"inbox-read"});await refreshInbox(false);}
      catch(e){$("camp-inbox-list").append(textBlock(humanError(e)));}
    });
    $("camp-room-close")?.addEventListener("click",()=>{
      roomId=null;$("camp-conversation-room").hidden=true;
    });
    $("camp-room-form")?.addEventListener("submit",sendRoom);
    $("camp-room-walk-intent")?.addEventListener("click",walkIntent);
    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible"&&loaded)refreshInbox(false);
    });
    refreshInbox(false);
    exposeAdminReports();
  }
  window.CampfireStage2={inviteTo,refreshInbox};
  mount();
})();
