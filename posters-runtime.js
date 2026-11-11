(function(root){
  "use strict";
  const maxRouteId=160;
  const text=(value)=>typeof value==="string"||typeof value==="number"?String(value).trim():"";
  function asset(value){
    const v=text(value);
    if(!v)return "";
    const local=/^\/?route-assets\/[a-z0-9_-]+\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif)$/i;
    if(local.test(v))return "/"+v.replace(/^\//,"");
    try{
      const u=new URL(v,root.location.origin);
      const m=u.pathname.match(/^\/(?:Tonykao1\/budao\.org\/(?:main|[^/]+)\/)?(route-assets\/[a-z0-9_-]+\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif))$/i);
      if(u.origin===root.location.origin&&local.test(u.pathname))return u.pathname;
      if((u.hostname==="raw.githubusercontent.com"||u.hostname==="github.com")&&m){
        return "/"+m[1];
      }
      if(u.hostname==="raw.githubusercontent.com"){
        const match=u.pathname.match(/^\/Tonykao1\/budao\.org\/[^/]+\/(route-assets\/[a-z0-9_-]+\/[a-z0-9_-]+\.(?:jpe?g|png|webp|gif))$/i);
        if(match)return "/"+match[1];
      }
    }catch(error){}
    return "";
  }
  const pad=n=>String(n).padStart(2,"0");
  function normalized(route){
    const r=route||{};
    const day=text(r.date).slice(0,10);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error("路线日期格式无效");
    const [year,month,date]=day.split("-").map(Number);
    const dayObject=new Date(Date.UTC(year,month-1,date));
    if(dayObject.getUTCFullYear()!==year||dayObject.getUTCMonth()!==month-1||dayObject.getUTCDate()!==date){
      throw Error("路线日期不是有效日期");
    }
    const weekdays=["周日","周一","周二","周三","周四","周五","周六"];
    const weekday=weekdays[dayObject.getUTCDay()];
    const time=text(r.time);
    const region=[r.country,r.city,r.region].map(text).filter(Boolean).join(" · ")||text(r.location);
    const source=asset(r.image||r.imageUrl),qr=asset(r.qrCode||r.registrationQrCode||r.qr);
    const title=text(r.title),meeting=text(r.meetingPlace||r.meetingPoint||r.gatheringPlace);
    if(!title||!time||!meeting||!region)throw Error("此活动缺少标题、时间、地区或集合地点，无法生成完整海报");
    if(!source)throw Error("此活动没有可验证的步道原始照片");
    if(!qr)throw Error("此活动没有对应的原始报名二维码，禁止套用其他活动的二维码");
    if(String(r.status||"").toLowerCase()==="cancelled"||r.cancelledAt)throw Error("此活动已取消，不提供报名海报");
    const clean= value=>text(value).replace(/\s+/g," ");
    const description=clean(r.description);
    const subtitle=description.split(/[。！？\n]/)[0].slice(0,24)||"";
    const object={
      id:text(r.routeId||r.id),title,
      date:day,time,year,month:pad(month),day:pad(date),weekday,
      weekdayLong:weekday.replace("周","星期"),mmdd:pad(month)+" / "+pad(date),
      dateCN:year+"年"+month+"月"+date+"日",
      dateDots:year+"."+pad(month)+"."+pad(date),
      region,meeting,description,subtitle,
      distance:clean(r.distance),elevation:clean(r.elevation),
      difficulty:clean(r.difficulty),duration:clean(r.duration),
      surface:clean(r.surface),suitable:clean(r.suitableFor),
      equipment:clean(r.equipmentMinimum),weather:clean(r.weather),
      photo:source,qr,logo:"/budao-logo-mark.png",
      brush:"/posters/assets/walk-red-brush.svg",
      footprint:"/assets/budao-footprint-watermark.svg",
      // Hash is meaningful only when supplied by the same route record.
      qrSha:clean(r.qrSha||r.qrCodeSha||r.registrationQrSha),
      photoSha:clean(r.imageSha||r.photoSha),
      isPast:day < new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Shanghai"})
    };
    if(object.title.length>120||object.meeting.length>260)throw Error("活动文本超过支持的安全长度");
    return Object.freeze(object);
  }
  async function routes(){
    const c=new AbortController();
    const timer=setTimeout(()=>c.abort(),20000);
    try{
      const response=await fetch("/api/routes?source=poster-studio",{cache:"no-store",credentials:"same-origin",signal:c.signal});
      if(!response.ok)throw Error("无法读取当前公开活动（HTTP "+response.status+"）");
      const json=await response.json();
      const list=Array.isArray(json)?json:Array.isArray(json.routes)?json.routes:Array.isArray(json.items)?json.items:null;
      if(!list)throw Error("活动接口返回的数据格式不正确");
      return list;
    }finally{clearTimeout(timer)}
  }
  async function load(){
    const p=new URLSearchParams(root.location.search);
    const routeId=text(p.get("route"));
    if(!routeId||routeId.length>maxRouteId||!/^[\w.-]+$/.test(routeId)){
      throw Error("没有指定有效的活动。请先在四套海报选择页选择一条步道。");
    }
    const all=await routes();
    const selected=all.find(r=>text(r.routeId||r.id)===routeId);
    if(!selected)throw Error("无法从公开活动记录找到这条步道");
    const record=normalized(selected);
    const heading=document.querySelector("header h1");
    if(heading)heading.textContent=record.title+" · 海报预览";
    return record;
  }
  function error(err){
    const message=String(err?.message||err||"无法生成海报");
    let element=document.getElementById("status");
    if(!element){element=document.createElement("p");element.id="status";document.body.prepend(element)}
    element.textContent="✕ "+message;
    document.querySelectorAll('button[id="download"], button[id="export"]').forEach(b=>b.disabled=true);
    document.querySelectorAll('canvas').forEach(c=>c.setAttribute("aria-label","海报暂不可用："+message));
  }
  root.BudaoPosterRuntime=Object.freeze({asset,normalized,routes,load,error});
})(typeof window!=="undefined"?window:globalThis);
