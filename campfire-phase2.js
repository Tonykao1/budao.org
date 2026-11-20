/* BUDAO · 营火之地 Phase 2 / 回响信箱。All displayed UGC uses textContent. */
(() => {
  "use strict";
  const $=id=>document.getElementById(id);
  const make=(tag,cls,text)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(text!==undefined)node.textContent=String(text);
    return node;
  };
  const api="/api/campfire";
  let enabled=false;
  let inviteTarget=null;
  let currentPhoto=null;
  let inboxLoaded=false;
  let activeConversation=null;

  const REASONS={
    visitor_session_required:"未找到本设备的匿名会话。请使用最初留言的浏览器。",
    consent_required:"请先确认你愿意主动发起这次邀请。",
    invitation_target_unavailable:"这位留言者暂时不能接收邀请。",
    own_approved_memory_required:"请先在同一场活动下留下自己的回忆，并等待审核通过，再发出同行邀请。",
    cannot_invite_self:"无法邀请自己。",
    already_invited:"这位同行者已经收到过你的邀请，不能重复发送。",
    reverse_invitation_exists:"对方已向你发出过邀请，请在回响信箱中回应。",
    invitation_unavailable:"邀请已结束、过期，或不属于当前浏览器。",
    conversation_unavailable:"对话不存在、未获双方同意，或已经结束。",
    invalid_invitation:"邀请至少需要十个字，请勿包含网址、邮箱或联系方式。",
    invalid_letter:"信件需要至少两个字，请勿包含网址或邮箱。",
    feature_disabled:"回响信箱正在准备中，请稍后查看。",
    rate_limited:"操作稍频繁，请稍后再试。",
    temporarily_unavailable:"信箱暂时无法读取，请稍后再试。"
  };
  const reason=e=>REASONS[String(e?.message||e)]||"操作未完成，请稍后再试。";
  const announce=(text)=>{const n=$("camp-inbox-status");if(n)n.textContent=text||"";};
  const date=value=>{
    const d=new Date(value);return Number.isFinite(d.getTime())?d.toLocaleDateString("zh-CN"):"";
  };
  async function request(method,params={},payload=null){
    const url=new URL(api,location.origin);
    if(method==="GET")for(const [k,v] of Object.entries(params))url.searchParams.set(k,v);
    const opts={method,credentials:"same-origin",cache:"no-store"};
    if(method==="POST"){opts.headers={"Content-Type":"application/json"};opts.body=JSON.stringify(payload);}
    const r=await fetch(url.toString(),opts);
    const result=await r.json().catch(()=>({ok:false,reason:"temporarily_unavailable"}));
    if(!r.ok||!result.ok)throw Error(result.reason||"temporarily_unavailable");
    return result;
  }
  function btn(label,action,cls="camp-p2-button"){
    const b=make("button",cls,label);b.type="button";b.addEventListener("click",action);return b;
  }
  function photoLink(src,text){
    const a=make("a","camp-p2-link",text||"回到这张照片 ↗");
    const url=new URL("/yhzd.html",location.origin);url.searchParams.set("photo",src);a.href=url.toString();return a;
  }
  async function reload(){
    if(!enabled){announce("回响信箱暂未开放。");return;}
    const notices=$("camp-inbox-notices"),connections=$("camp-inbox-connections");
    notices.replaceChildren(make("p","camp-thread-empty","正在查找你的回响……"));
    connections.replaceChildren();
    try{
      const data=await request("GET",{view:"inbox"});
      inboxLoaded=true;
      notices.replaceChildren();
      connections.replaceChildren();
      const title=make("h4","camp-p2-heading","给你的回应");
      notices.append(title);
      if(!data.hasSession){
        notices.append(make("p","camp-thread-empty","还没有与你的浏览器关联的互动记录。发表一条经过审核的留言后，此设备就可以接收后续回应。"));
      }else if(!data.notices.length){
        notices.append(make("p","camp-thread-empty","暂时没有新的公开回复。"));
      }else{
        for(const notice of data.notices){
          const card=make("article","camp-p2-notice"+(!notice.read?" camp-p2-unread":""));
          const heading=make("div","camp-thread-meta");
          heading.append(make("strong","",notice.official?"步道的回应":notice.name+" 的回应"));
          heading.append(make("time","",date(notice.createdAt)));
          card.append(heading,make("p","",notice.excerpt));
          const actions=make("div","camp-thread-tools");
          actions.append(photoLink(notice.photoId,"查看原照片 ↗"));
          if(!notice.read)actions.append(btn("标记已读",async()=>{
            try{await request("POST",{}, {action:"readNotice",noticeId:notice.id});await reload();}
            catch(e){announce(reason(e));}
          },"camp-thread-tool"));
          card.append(actions);notices.append(card);
        }
      }
      connections.append(make("h4","camp-p2-heading","同行邀请与私密对话"));
      if(!data.connections.length){
        connections.append(make("p","camp-thread-empty","还没有同行邀请。只有双方都愿意，才会开启私密交谈。"));
      }
      for(const c of data.connections)connections.append(renderConnection(c));
      announce("回响已更新。");
    }catch(e){
      notices.replaceChildren(make("p","camp-thread-empty",reason(e)));
      announce(reason(e));
    }
  }
  function renderConnection(c){
    const card=make("article","camp-p2-connection");
    const head=make("div","camp-p2-connection-heading");
    const status={
      PENDING:c.receivedByMe?"等待你的决定":"等待对方回应",
      ACCEPTED:c.hasNewLetters?"✉ 有新回响":"双方已同意 · 可私密交流",
      DECLINED:"对方已婉拒",
      REVOKED:"同行联系已结束",
      EXPIRED:"邀请或联系已到期"
    }[c.status]||"";
    head.append(make("strong","",c.sentByMe?"我发出的同行邀请":"收到的同行邀请"));
    head.append(make("span","camp-p2-state",status));
    card.append(head);
    if(c.intro&&c.status!=="REVOKED")card.append(make("p","camp-p2-intro",c.intro));
    card.append(photoLink(c.photoId,"看看我们谈起的照片 ↗"));
    const actions=make("div","camp-thread-tools");
    if(c.status==="PENDING"&&c.receivedByMe){
      actions.append(btn("愿意继续同行",()=>decide(c.id,"ACCEPTED")));
      actions.append(btn("婉拒邀请",()=>decide(c.id,"DECLINED"),"camp-thread-tool"));
    }
    if(c.status==="ACCEPTED"){
      actions.append(btn(activeConversation===c.id?"收起私信":"打开私密对话",()=>openConversation(c.id)));
    }
    if(["PENDING","ACCEPTED"].includes(c.status)){
      actions.append(btn("结束联系",()=>closeConnection(c.id),"camp-thread-tool"));
    }
    if(actions.childNodes.length)card.append(actions);
    if(activeConversation===c.id&&c.status==="ACCEPTED"){
      const panel=make("div","camp-p2-chat");
      panel.id="camp-chat-"+c.id;
      card.append(panel);
      populateConversation(c.id,panel);
    }
    return card;
  }
  async function decide(id,choice){
    if(!window.confirm(choice==="ACCEPTED"?
      "只有双方自愿同意才会开启私密信箱。确定接受这份同行邀请吗？":
      "确定婉拒这次同行邀请吗？"))return;
    try{
      await request("POST",{}, {action:"respond",connectionId:id,choice});
      await reload();
    }catch(e){announce(reason(e));}
  }
  async function closeConnection(id){
    if(!window.confirm("确定结束联系吗？私密信件将从服务器清除，无法恢复。"))return;
    try{
      await request("POST",{}, {action:"closeConnection",connectionId:id});
      if(activeConversation===id)activeConversation=null;
      await reload();
    }catch(e){announce(reason(e));}
  }
  function openConversation(id){
    activeConversation=activeConversation===id?null:id;
    reload();
  }
  async function populateConversation(id,panel){
    panel.replaceChildren(make("p","camp-thread-empty","正在打开这段私密通信……"));
    try{
      const data=await request("GET",{view:"letters",id});
      if(activeConversation!==id||!panel.isConnected)return;
      panel.replaceChildren();
      panel.append(make("p","camp-p2-note","只有双方可以从各自的原浏览器阅读这些信件。请勿分享联系电话、家庭住址或其他敏感信息。"));
      const list=make("div","camp-p2-letter-list");
      if(!data.letters.length)list.append(make("p","camp-thread-empty","这是一段新的对话。愿每一句话都真诚、节制。"));
      for(const letter of data.letters){
        const bubble=make("article","camp-p2-letter"+(letter.mine?" camp-p2-letter-mine":""));
        bubble.append(make("small","",letter.mine?"我 · "+date(letter.createdAt):"对方 · "+date(letter.createdAt)));
        bubble.append(make("p","",letter.body));
        if(!letter.mine)bubble.append(btn("举报此信",async()=>{
          const explanation=window.prompt("请简要说明举报原因（可留空；取消将不提交）：","");
          if(explanation===null)return;
          try{
            await request("POST",{},{
              action:"reportLetter",connectionId:id,letterId:letter.id,
              reason:explanation.slice(0,120)
            });
            announce("举报已提交给高级管理员。你也可以主动结束这段联系。");
          }catch(e){announce(reason(e));}
        },"camp-thread-tool"));
        list.append(bubble);
      }
      panel.append(list);
      const form=make("form","camp-p2-letter-form");
      const field=make("textarea");
      field.maxLength=500;field.rows=3;field.required=true;
      field.placeholder="写一段只给这位同行者的话……";
      const submit=make("button","camp-button camp-button-gold","发送私信");
      submit.type="submit";
      form.append(field,submit);
      form.addEventListener("submit",async ev=>{
        ev.preventDefault();submit.disabled=true;
        try{
          await request("POST",{}, {action:"letter",connectionId:id,body:field.value});
          field.value="";await populateConversation(id,panel);
        }catch(e){announce(reason(e));}
        finally{submit.disabled=false;}
      });
      panel.append(form);
      const intent=make("div","camp-p2-mutual-walk");
      const flag=btn(data.myInterest?"✓ 我愿意再次同行（点此撤回）":"表达我愿意再次同行",async()=>{
        flag.disabled=true;
        try{
          await request("POST",{}, {action:"walkIntent",connectionId:id,interested:!data.myInterest});
          await populateConversation(id,panel);
        }catch(e){announce(reason(e));flag.disabled=false;}
      },"camp-p2-walk-choice");
      flag.setAttribute("aria-pressed",String(!!data.myInterest));
      intent.append(flag);
      const mutual=make("p","camp-p2-mutual-status",data.mutualInterest?
        "双方都自愿表达了再次同行的意愿。可以一起查看下一次公开步道；这不等于报名成功或实际到场。":
        data.myInterest?"你的心意已记录。只有对方也自愿选择，才会显示双方共同意愿。":
        "这是完全自愿的选择，不会被公开展示，也不会自动联系对方。");
      intent.append(mutual);
      const next=make("a","camp-p2-next","查看下一次步道 ↗");
      next.href="/test.html";
      intent.append(next);
      panel.append(intent);
      try{
        await request("POST",{}, {action:"markLettersRead",connectionId:id});
        const label=panel.closest(".camp-p2-connection")?.querySelector(".camp-p2-state");
        if(label)label.textContent="双方已同意 · 可私密交流";
      }catch{
        announce("信件已经载入，已读状态暂时无法更新。");
      }
    }catch(e){panel.replaceChildren(make("p","camp-thread-empty",reason(e)));}
  }
  async function openInvite(comment,photo){
    if(!enabled){announce("回响信箱暂未开放。");return;}
    if(!comment||!photo||photo.kind!=="moment")return;
    inviteTarget={commentId:comment.id,photoId:photo.image};
    $("camp-invite-target").textContent="回应 "+comment.name+" 在这段步道记忆中留下的话。";
    $("camp-invite-status").textContent="";
    $("camp-invite-body").value="";
    $("camp-invite-consent").checked=false;
    $("camp-invite-dialog").showModal();
  }
  function mount(){
    document.addEventListener("campfire:photo-open",event=>{
      currentPhoto=event.detail.item;
    });
    $("camp-inbox-open")?.addEventListener("click",async()=>{
      const section=$("camp-inbox-body");
      section.hidden=!section.hidden;
      $("camp-inbox-open").setAttribute("aria-expanded",String(!section.hidden));
      $("camp-inbox-open").textContent=section.hidden?"翻开信箱":"收起信箱";
      if(!section.hidden)await reload();
    });
    $("camp-inbox-refresh")?.addEventListener("click",reload);
    $("camp-invite-cancel")?.addEventListener("click",()=>$("camp-invite-dialog").close());
    $("camp-invite-form")?.addEventListener("submit",async ev=>{
      ev.preventDefault();
      if(!inviteTarget)return;
      const send=$("camp-invite-send");
      send.disabled=true;
      try{
        await request("POST",{}, {
          action:"invite",commentId:inviteTarget.commentId,
          body:$("camp-invite-body").value,consent:$("camp-invite-consent").checked
        });
        $("camp-invite-dialog").close();
        inviteTarget=null;
        announce("邀请已送出。只有对方主动同意后，才会开放私密交流。");
        // Show the inbox to make the pending request easy to find.
        $("camp-inbox-body").hidden=false;
        $("camp-inbox-open").setAttribute("aria-expanded","true");
        $("camp-inbox-open").textContent="收起信箱";
        await reload();
      }catch(e){$("camp-invite-status").textContent=reason(e);}
      finally{send.disabled=false;}
    });
    request("GET",{view:"config"}).then(data=>{
      enabled=data.phase2Enabled===true;
      if(!enabled){
        $("camp-inbox-open").disabled=true;
        $("camp-inbox-open").textContent="信箱准备中";
      }
    }).catch(()=>{
      enabled=false;$("camp-inbox-open").disabled=true;
    });
  }
  window.CampfirePhase2={openInvite,refresh:reload,getEnabled:()=>enabled};
  mount();
})();