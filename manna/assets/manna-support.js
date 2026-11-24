(() => {
 "use strict";
 const opener=document.getElementById("manna-support-toggle");
 const panel=document.getElementById("manna-support-panel");
 const status=document.getElementById("manna-support-status");
 const connect=document.getElementById("manna-support-connect");
 if(!opener||!panel||!status||!connect)return;
 // Public widget identifiers are deliberately blank until a real seller-operated
 // support account and privacy disclosures have been verified. No fake live agent.
 const property=String(panel.dataset.chatProperty||"").trim();
 const widget=String(panel.dataset.chatWidget||"").trim();
 const configured=/^[a-f0-9]{24}$/i.test(property) && /^[a-z0-9_-]{4,48}$/i.test(widget);
 let loading=false;
 let loaded=false;
 opener.addEventListener("click",()=>{
   panel.hidden=!panel.hidden;
   opener.setAttribute("aria-expanded",String(!panel.hidden));
   if(!panel.hidden){
     connect.hidden=!configured;
     status.textContent=configured
       ?"聊天渠道已配置。点击下方按钮连接第三方客服；请勿提供敏感信息。"
       :"实时客服通道正在接入，暂不能在网页发送消息。";
   }
 });
 if(!configured)return;
 connect.addEventListener("click",()=>{
   if(loaded){
     if(window.Tawk_API && typeof window.Tawk_API.maximize==="function") window.Tawk_API.maximize();
     else status.textContent="客服界面已加载，请在页面右下角打开对话。";
     return;
   }
   if(loading)return;
   loading=true;
   connect.disabled=true;
   status.textContent="正在连接客服服务，如连接失败，请稍后重试。";
   const script=document.createElement("script");
   script.async=true;
   script.referrerPolicy="no-referrer";
   script.src="https://embed.tawk.to/"+property+"/"+widget;
   const timeout=window.setTimeout(()=>{
     if(!loaded){loading=false;connect.disabled=false;status.textContent="暂时无法连接客服。请稍后重试，当前没有发送任何消息。";}
   },14000);
   const previous=window.Tawk_API||{};
   window.Tawk_API=previous;
   window.Tawk_LoadStart=new Date();
   const prevLoad=previous.onLoad;
   previous.onLoad=()=>{
     if(typeof prevLoad==="function")prevLoad();
     window.clearTimeout(timeout);
     loaded=true;loading=false;connect.disabled=false;
     status.textContent="客服已连接。在线与否以聊天窗口显示为准。";
     if(typeof previous.maximize==="function")previous.maximize();
   };
   script.onerror=()=>{
     window.clearTimeout(timeout);
     loading=false;connect.disabled=false;
     status.textContent="客服连接失败。请稍后再试。";
     script.remove();
   };
   document.head.appendChild(script);
 });
})();