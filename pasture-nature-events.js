(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BudaoPastureNature=api;
})(typeof window!=='undefined'?window:null,function(){
  'use strict';
  // Nature events are an optional overlay, not part of the flock or weather engines.
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const KINDS=Object.freeze(['butterfly','dragonfly','fish','migration','firefly','leaf']);
  const palette=['#ffe08b','#f9d4eb','#e9f1a6','#ffecb4'];

  function seasonAt(timeMs,latitude,timezone){
    let month;
    try{month=Number(new Intl.DateTimeFormat('en-US',{timeZone:timezone||'UTC',month:'numeric'}).format(new Date(timeMs)));}
    catch(_){month=new Date(timeMs).getUTCMonth()+1;}
    const lat=Number(latitude);
    if(Number.isFinite(lat)&&Math.abs(lat)<23.5)return'tropical';
    if(Number.isFinite(lat)&&lat<0)month=(month+5)%12+1;
    if(month>=3&&month<=5)return'spring';
    if(month>=6&&month<=8)return'summer';
    if(month>=9&&month<=11)return'autumn';
    return'winter';
  }
  function weatherKind(code){
    code=Number(code)||0;
    if(code===45||code===48)return'fog';
    if((code>=51&&code<=67)||(code>=80&&code<=82)||(code>=95&&code<=99))return'rain';
    if((code>=71&&code<=77)||(code>=85&&code<=86))return'snow';
    return'clear';
  }
  function isDay(state,skyState,timeMs){
    if(Number.isFinite(Number(skyState?.sun?.altitudeDeg)))return Number(skyState.sun.altitudeDeg)>-1;
    const a=state?.astronomy||{};
    if(Number.isFinite(+a.sunriseToday)&&Number.isFinite(+a.sunsetToday)&&+a.sunriseToday>0&&+a.sunsetToday>0)
      return timeMs>=+a.sunriseToday&&timeMs<=+a.sunsetToday;
    return null; // Unknown is never treated as daytime or nighttime.
  }
  function eligibleKinds(state,skyState,timeMs){
    if(!state?.location)return[];
    const s=seasonAt(timeMs,state.location.latitude,state.location.timezone);
    const code=state.current?.weatherCode;
    if(weatherKind(code)!=='clear')return[];
    const wind=Number(state.current?.windKmh)||0;
    if(wind>27)return[];
    const day=isDay(state,skyState,timeMs);
    if(day===null)return[];
    const cloud=Number(state.current?.cloudCover)||0;
    if(day){
      const kinds=[];
      if(s==='spring'||s==='summer'||s==='tropical'){
        if(wind<=20&&cloud<85)kinds.push('butterfly','dragonfly');
      }
      if(s!=='winter'&&wind<=24)kinds.push('fish');
      if((s==='spring'||s==='autumn')&&wind<=23&&cloud<80)kinds.push('migration');
      if(s==='autumn'&&wind<=17)kinds.push('leaf');
      return kinds;
    }
    return(s==='summer'||s==='tropical')&&wind<=17&&cloud<75?['firefly']:[];
  }
  function portraitRiverCenter(t,w){
    const anchors=[[0,.75],[.16,.68],[.34,.77],[.53,.55],[.72,.70],[.88,.43],[1,.58]];
    for(let i=0;i<anchors.length-1;i++){
      const a=anchors[i],b=anchors[i+1];
      if(t>=a[0]&&t<=b[0]){
        let q=(t-a[0])/(b[0]-a[0]);q=q*q*(3-2*q);
        return w*mix(a[1],b[1],q);
      }
    }
    return w*.58;
  }
  function riverAt(t,scene,width,height){
    t=clamp(t,0,1);
    if(scene==='portrait')return{x:portraitRiverCenter(t,width),y:mix(height*.405,height+8,t)};
    // The landscape river is a meandering foreground river, not the sea.
    const a=[[0,355],[.18,356],[.34,353],[.50,386],[.68,393],[.80,385],[1,375]];
    let x=a[a.length-1][1];
    for(let i=0;i<a.length-1;i++){
      if(t<=a[i+1][0]){x=mix(a[i][1],a[i+1][1],(t-a[i][0])/(a[i+1][0]-a[i][0]));break;}
    }
    return{x:x*width/480,y:mix(height*154/300,height+8,t)};
  }
  function zone(kind,scene,w,h,r){
    const portrait=scene==='portrait';
    if(kind==='fish'||kind==='dragonfly'){
      const p=riverAt(.43+r()*.29,scene,w,h);
      return{x:p.x,y:p.y};
    }
    if(kind==='migration')return{x:0,y:(portrait?h*.255:96)*(.24+r()*.35)};
    if(kind==='leaf')return portrait?{x:w*.11,y:h*.56}:{x:w*430/480,y:h*191/300};
    return portrait?{x:w*(.13+r()*.66),y:h*(.63+r()*.23)}:
      {x:w*(.09+r()*.55),y:h*(.73+r()*.17)};
  }
  function rect(ctx,x,y,w,h,color){
    ctx.fillStyle=color;
    ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));
  }
  function paint(ctx,e,p,scene,w,h){
    const x=e.x,y=e.y,dir=e.dir,wind=e.wind;
    ctx.save();
    ctx.beginPath();
    if(e.kind==='migration')ctx.rect(0,0,w,scene==='portrait'?h*.255-2:95);
    else if(e.kind==='fish'||e.kind==='dragonfly')ctx.rect(0,scene==='portrait'?h*.39:145*h/300,w,h);
    else ctx.rect(0,scene==='portrait'?h*.49:h*.6,w,h);
    ctx.clip();
    if(e.kind==='butterfly'){
      const bx=x+dir*p*(scene==='portrait'?w*.07:w*.09);
      const by=y-Math.sin(p*Math.PI*2)*3-3;
      const wing=Math.sin(p*35)>0?2:1;
      rect(ctx,bx-3,by-wing,2,wing+1,e.color);
      rect(ctx,bx+2,by-wing,2,wing+1,e.color);
      rect(ctx,bx,by,2,3,'#77644f');
    }else if(e.kind==='dragonfly'){
      const bx=x+dir*(p-.5)*Math.min(w*.07,26),by=y-5-Math.sin(p*Math.PI*3)*2;
      rect(ctx,bx,by,1,5,'#368f83');
      rect(ctx,bx,by-1,1,1,'#47736c');
      const wing=Math.sin(p*40)>.15?3:2;
      rect(ctx,bx-wing,by+1,wing,1,'#d5f8f5');
      rect(ctx,bx+1,by+1,wing,1,'#d5f8f5');
    }else if(e.kind==='fish'){
      const lift=Math.sin(p*Math.PI)*8;
      if(p>.15&&p<.85){
        const fx=x+dir*(p-.5)*5,fy=y-lift;
        rect(ctx,fx,fy,3,2,'#d8e9f0');
        rect(ctx,fx-dir*2,fy+1,2,2,'#83bed2');
        rect(ctx,fx+dir*2,fy,1,1,'#667b85');
      }
      if(p>.65){
        const ripple=(p-.65)/.35;
        ctx.globalAlpha=1-ripple;
        rect(ctx,x-2-ripple*3,y+1,3+ripple*6,1,'#e0faff');
      }
    }else if(e.kind==='migration'){
      const span=w+50,lead=dir>0?mix(-24,span,p):mix(w+24,-span+w,p);
      for(let i=0;i<7;i++){
        const arm=Math.floor((i+1)/2),side=i===0?0:(i%2?1:-1);
        const bx=lead-dir*arm*6,by=y+side*arm*3+Math.sin(p*23+i)*.4;
        rect(ctx,bx-1,by,2,1,'#5a7281');
        rect(ctx,bx-2,by-(Math.sin(p*26+i)>.1?1:0),1,1,'#718b92');
        rect(ctx,bx+1,by-(Math.sin(p*26+i)>.1?1:0),1,1,'#718b92');
      }
    }else if(e.kind==='firefly'){
      for(let i=0;i<3;i++){
        const phase=p*15+i*2.8;
        const bx=x+(i-1)*11+Math.sin(phase)*4;
        const by=y+(i%2)*7+Math.cos(phase*.7)*3;
        const a=Math.pow(Math.max(0,Math.sin(phase)),2)*.8;
        ctx.globalAlpha=a;
        rect(ctx,bx-1,by-1,3,3,'#d9ed77');
        ctx.globalAlpha=Math.min(1,a+.1);
        rect(ctx,bx,by,1,1,'#fff7b2');
      }
    }else if(e.kind==='leaf'){
      for(let i=0;i<2;i++){
        const t=clamp(p-i*.17,0,1);
        if(t===0)continue;
        const bx=x+dir*t*(15+wind*5)+i*6+Math.sin(t*10+i)*3;
        const by=y+t*(scene==='portrait'?h*.13:25)+i*3;
        rect(ctx,bx,by,2,2,i?'#e2b15b':'#d79048');
        rect(ctx,bx+2,by+1,1,1,'#eac47c');
      }
    }
    ctx.restore();
  }
  function createController(options={}){
    const random=typeof options.random==='function'?options.random:Math.random;
    const r=()=>clamp(Number(random())||0,0,.999999);
    let active=null,nextAt=0;
    const enabled=options.enabled!==false;
    function draw(ctx,{now=Date.now(),width,height,scene='landscape',state,skyState}={}){
      if(!enabled||!ctx||!state||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
      if(!nextAt)nextAt=now+(22+r()*55)*1000;
      if(active&&now>=active.start+active.duration){active=null;nextAt=now+(80+r()*145)*1000;}
      if(!active&&now>=nextAt){
        const choices=eligibleKinds(state,skyState,now);
        if(!choices.length){nextAt=now+45000;return null;}
        const kind=choices[Math.floor(r()*choices.length)];
        const duration={butterfly:4100,dragonfly:3100,fish:1800,migration:7000,firefly:5200,leaf:3900}[kind];
        active={kind,start:now,duration,dir:r()<.5?-1:1,wind:r(),
          color:palette[Math.floor(r()*palette.length)],...zone(kind,scene,width,height,r)};
      }
      if(!active)return null;
      const p=clamp((now-active.start)/active.duration,0,1);
      paint(ctx,active,p,scene,width,height);
      return{kind:active.kind,progress:p};
    }
    return{draw,reset(){active=null;nextAt=0;},status(){return{active:active&&active.kind,nextAt};}};
  }
  return Object.freeze({KINDS,seasonAt,weatherKind,isDay,eligibleKinds,riverAt,createController});
});
