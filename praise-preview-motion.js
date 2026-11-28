/* BUDAO / Formation preview V3. Full flock, hourly programs. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const names=['横列 Company Front','方阵 Parade Block','飞翼 Flying Wedge','弧阵 Arc','菱形 Diamond','环阵 Circle','梯次 Echelon','双方阵 Double Block','纵列 Column','十字 Cross','风车 Pinwheel','曲线 Script'];
function program(hour){const h=((hour%24)+24)%24;return {hour:h,kind:h%12,variant:h>=12?1:0,name:names[h%12]+(h>=12?' · 斜转展开':' · 原式')}}
function hourly(hour,minute){return Number.isInteger(hour)&&hour>=0&&hour<24&&minute===0?program(hour):null}
function prepare(score,api,index=0){
 const unit=score.tempo/(score.ticks*1e6),cycle=api.cycleSeconds(score),beat=score.ticks*unit;
 const voices=score.parts.map(p=>api.decodeVoice(p).map(n=>({start:n.tick*unit,end:(n.tick+n.duration)*unit,pitch:n.pitch,velocity:n.velocity/127})));
 const onsets=[...new Set(voices[0].map(n=>n.start))].sort((a,b)=>a-b);
 const sections=Math.max(1,Math.round(cycle/Math.max(8,beat*15)));
 const cues=[0];for(let i=1;i<sections;i++){const ideal=cycle*i/sections;const q=onsets.reduce((a,b)=>Math.abs(b-ideal)<Math.abs(a-ideal)?b:a,ideal+100);if(q-cues[cues.length-1]>=4&&cycle-q>=4)cues.push(q)}cues.push(cycle);
 return {cycle,beat,voices,cues,index};
}
function riverX(t,W){const a=[[0,.75],[.16,.68],[.34,.77],[.53,.55],[.72,.70],[.88,.43],[1,.58]];for(let i=0;i<a.length-1;i++){if(t>=a[i][0]&&t<=a[i+1][0]){let q=smooth((t-a[i][0])/(a[i+1][0]-a[i][0]));return W*(a[i][1]+(a[i+1][1]-a[i][1])*q)}}return W*.58}
function footprint(o,x=o.x,y=o.y){
 return {x:x+(o.lamb?10.5:15)*o.s,y:y+(o.lamb?7:9)*o.s,rx:(o.lamb?10.5:15)*o.s+1.5,ry:(o.lamb?8:11)*o.s+1.1}
}
function clear(a,b){return Math.abs(a.x-b.x)>a.rx+b.rx||Math.abs(a.y-b.y)>a.ry+b.ry}
function safe(o,x,y,g){
 const p=footprint(o,x,y);
 if(p.x-p.rx<3||p.x+p.rx>g.W-3||y<g.minY||p.y+p.ry>g.H-3)return false;
 if(g.mode==='portrait'){
  const t=clamp((y-g.minY+8)/(g.H+8-g.minY+8),0,1),r=riverX(t,g.W),half=5+(g.W*.115-5)*Math.pow(t,1.18);
  return Math.abs(p.x-r)>half+p.rx+5;
 }
 let l=340,r=390;if(y>=190&&y<232){l=336;r=410}else if(y>=232){l=344;r=416}
 if(p.x+p.rx>=l&&p.x-p.rx<=r)return false;
 if(p.x+p.rx>414&&p.x-p.rx<448&&p.y+p.ry>184&&p.y-p.ry<220)return false;
 if(p.x-p.rx<49&&p.y+p.ry>258)return false;
 return true;
}
function zone(o,g){
 let p=footprint(o),r=g.mode==='portrait'?riverX(clamp((o.y-g.minY+8)/(g.H+16-g.minY),0,1),g.W):373;
 return (p.x<r?0:3)+clamp(Math.floor((o.y-g.minY)/((g.H-g.minY)/3)),0,2);
}
function slots(n,kind,cx,cy,spacing,variant=0){
 const out=[];const half=(n-1)/2;
 for(let i=0;i<n;i++){
  const j=i-half,q=j/Math.max(1,half),cols=Math.ceil(Math.sqrt(n)),rows=Math.ceil(n/cols);let x=j*spacing,y=0;
  if(kind===1){x=(i%cols-(cols-1)/2)*spacing;y=(Math.floor(i/cols)-(rows-1)/2)*spacing*.85}
  if(kind===2)y=Math.abs(j)*spacing*.55;
  if(kind===3)y=(q*q-.45)*spacing*1.5;
  if(kind===4){const u=i/n*4,k=Math.floor(u),p=u-k,r=spacing*Math.max(1,n/4),v=[[0,-1],[1,0],[0,1],[-1,0],[0,-1]];x=(v[k][0]+(v[k+1][0]-v[k][0])*p)*r;y=(v[k][1]+(v[k+1][1]-v[k][1])*p)*r*.82}
  if(kind===5){const a=i/n*Math.PI*2,r=Math.max(spacing,n*spacing/(2*Math.PI));x=Math.cos(a)*r;y=Math.sin(a)*r*.82}
  if(kind===6)y=j*spacing*.58;
  if(kind===7){const block=Math.floor(i/Math.ceil(n/2)),k=i%Math.ceil(n/2);x=(block-.5)*spacing*2+(k%2-.5)*spacing;y=(Math.floor(k/2)-.5)*spacing*1.05}
  if(kind===8){x=0;y=j*spacing*.92}
  if(kind===9){if(i===0){x=0;y=0}else{const a=(i-1)%4*Math.PI/2,r=(Math.floor((i-1)/4)+1)*spacing;x=Math.cos(a)*r;y=Math.sin(a)*r}}
  if(kind===10){const a=(i%4)*Math.PI/2+Math.PI/4,r=(Math.floor(i/4)+.65)*spacing*1.2;x=Math.cos(a)*r;y=Math.sin(a)*r}
  if(kind===11){x=j*spacing*.86;y=Math.sin(q*Math.PI)*spacing*1.15}
  if(variant){const a=.34,xx=x*1.12,yy=y*1.12;x=xx*Math.cos(a)-yy*Math.sin(a);y=xx*Math.sin(a)+yy*Math.cos(a)}
  out.push({x:cx+x,y:cy+y});
 }return out;
}
function terrainPenalty(o,x,y,g){
 const p=footprint(o,x,y);let q=Math.max(0,3-(p.x-p.rx),p.x+p.rx-(g.W-3),g.minY-y,p.y+p.ry-(g.H-3));
 if(g.mode==='portrait'){const t=clamp((y-g.minY+8)/(g.H+16-g.minY),0,1),r=riverX(t,g.W),half=5+(g.W*.115-5)*Math.pow(t,1.18);return q+Math.max(0,half+p.rx+5-Math.abs(p.x-r))}
 let l=340,r=390;if(y>=190&&y<232){l=336;r=410}else if(y>=232){l=344;r=416}
 const overlap=(a,b,c,d)=>Math.max(0,Math.min(b,d)-Math.max(a,c));
 q+=overlap(p.x-p.rx,p.x+p.rx,l,r);
 q+=Math.min(overlap(p.x-p.rx,p.x+p.rx,414,448),overlap(p.y-p.ry,p.y+p.ry,184,220));
 q+=Math.min(Math.max(0,49-(p.x-p.rx)),Math.max(0,p.y+p.ry-258));return q;
}
function penetration(a,b){return Math.max(0,Math.min(a.rx+b.rx-Math.abs(a.x-b.x),a.ry+b.ry-Math.abs(a.y-b.y)))}
function candidateOK(m,all,previous,g){
 const base=footprint(m.o),pen=terrainPenalty(m.o,m.o.x,m.o.y,g);
 for(let k=1;k<=24;k++){const t=k/24,x=m.o.x+(m.x-m.o.x)*t,y=m.o.y+(m.y-m.o.y)*t;
  if(terrainPenalty(m.o,x,y,g)>pen+1e-6)return false;const p=footprint(m.o,x,y);
  for(const o of all){if(o.id===m.o.id)continue;const b=previous[o.id],op=footprint(o,b?o.x+(b.x-o.x)*t:o.x,b?o.y+(b.y-o.y)*t:o.y);if(penetration(p,op)>penetration(base,footprint(o))+1e-6)return false}
 }return true;
}
function routeOK(moves,all,g){
 const moved=new Set(moves.map(m=>m.o.id)),stat=all.filter(o=>!moved.has(o.id));
 const baseline=new Map();for(const m of moves)for(const o of stat)baseline.set(m.o.id+':'+o.id,clear(footprint(m.o),footprint(o)));
 for(let k=1;k<=12;k++){
  const t=k/12,boxes=[];
  for(const m of moves){
   const x=m.o.x+(m.x-m.o.x)*t,y=m.o.y+(m.y-m.o.y)*t;
   if(!safe(m.o,x,y,g))return false;
   const p=footprint(m.o,x,y);
   for(const o of stat){if(!clear(p,footprint(o))&&baseline.get(m.o.id+':'+o.id))return false}
   for(const b of boxes){if(!clear(p,b.p)&&clear(footprint(m.o),footprint(b.m.o)))return false}
   boxes.push({p,m});
  }
 }
 // At the held formation, every moving member must be separated from all others.
 for(const m of moves){const p=footprint(m.o,m.x,m.y);if(stat.some(o=>!clear(p,footprint(o))))return false}
 for(let i=0;i<moves.length;i++)for(let j=0;j<i;j++)if(!clear(footprint(moves[i].o,moves[i].x,moves[i].y),footprint(moves[j].o,moves[j].x,moves[j].y)))return false;
 return true;
}
function fitGroup(pool,all,g,kind,variant=0){
 if(pool.length<3)return [];
 let best=[],bestScore=-Infinity;
 const min=Math.min(...pool.map(o=>o.x)),max=Math.max(...pool.map(o=>o.x));
 const avgY=pool.reduce((a,o)=>a+o.y,0)/pool.length,avgX=pool.reduce((a,o)=>a+footprint(o).x,0)/pool.length;
 const centers=[{x:avgX,y:avgY},...pool.map(o=>({x:footprint(o).x,y:o.y}))];
 for(const n of [Math.min(7,pool.length),Math.min(5,pool.length),Math.min(4,pool.length),3].filter((v,i,a)=>a.indexOf(v)===i)){
  if(n<3)continue;
  const ordered=[...pool].sort((a,b)=>a.s-b.s);const avg=ordered.slice(0,Math.min(pool.length,n+2)).reduce((v,o)=>v+(o.lamb?23:33)*o.s,0)/Math.min(pool.length,n+2);
  const spacing=Math.max(11,avg+6);
  for(const c of centers)for(const shift of [0,-spacing*.7,spacing*.7])for(const factor of [1,1.3]){
   const targets=slots(n,kind,c.x,c.y+shift,spacing*factor,variant);
   for(const order of [targets,[...targets].reverse()]){
    let free=pool.slice(),moves=[],cost=0;
    for(const target of order){
     let nearest=null,value=Infinity;
     for(const o of free){
      const p=footprint(o),x=target.x-(o.lamb?10.5:15)*o.s,y=target.y;
      if(Math.abs(y-o.y)>Math.max(20,(g.H-g.minY)*.25)||!safe(o,x,y,g))continue;
      const d=Math.hypot(x-o.x,y-o.y);
      if(d>Math.min(95,g.W*.25)||d<1)continue;
      const v=d+Math.abs(y-o.y)*.35;if(v<value){value=v;nearest={o,x,y,d}}
     }
     if(!nearest)break;moves.push(nearest);free=free.filter(o=>o.id!==nearest.o.id);cost+=nearest.d;
    }
    if(moves.length!==n||cost/n<8)continue;
    let score=n*100+Math.min(34,cost/n)*.65;
    if(score<=bestScore)continue;
    if(routeOK(moves,all,g)){best=moves;bestScore=score}
   }
  }
  if(best.length>=n)break;
 }
 return best;
}
function buildAttempt(layout,g,hour,attempt=0){
 const p=program(hour),all=layout.filter(o=>Number.isFinite(o.x)&&Number.isFinite(o.y)&&o.s>0),squads=[],assigned=Object.create(null),blocked=new Set();
 const regions=[0,1,2,3,4,5];if(p.variant)regions.reverse();for(let i=0;i<attempt%6;i++)regions.push(regions.shift());
 for(const region of regions){let pool=all.filter(o=>zone(o,g)===region);
  while(pool.length>=3){const obstacles=all.concat(squads.flatMap(s=>s.moves.map(m=>({...m.o,id:1000+m.o.id,x:m.x,y:m.y}))));
   const moves=fitGroup(pool,obstacles,g,p.kind,p.variant);const combined=squads.flatMap(s=>s.moves).concat(moves),combinedMap=Object.fromEntries(combined.map(m=>[m.o.id,m]));if(!moves.length||!routeOK(combined,all,g)||!combined.every(m=>candidateOK(m,all,combinedMap,g)))break;
   squads.push({region,kind:p.kind,moves});moves.forEach(m=>{blocked.add(m.o.id);assigned[m.o.id]={...m,region,kind:p.kind}});pool=pool.filter(o=>!blocked.has(o.id));
  }
 }
 for(const o of all.filter(o=>!blocked.has(o.id)).sort((a,b)=>b.s-a.s||a.id-b.id)){
  const region=zone(o,g),dir=p.kind*Math.PI/6+(p.variant?.34:0)+(region%3-1)*.55+attempt*.31;
  let best=null,bestScore=-Infinity;
  for(const len of [Math.min(30,12+o.s*16),22,16,11,7,4,2,1,.5]){for(let j=0;j<16;j++){const a=dir+(j%2===0?1:-1)*Math.ceil(j/2)*Math.PI/8,m={o,x:o.x+Math.cos(a)*len,y:o.y+Math.sin(a)*len*.53,region,kind:p.kind};if(!candidateOK(m,all,assigned,g))continue;const v=len-j*.45;if(v>bestScore){best=m;bestScore=v}}
   if(best&&bestScore>len-4)break;
  }assigned[o.id]=best||{o,x:o.x,y:o.y,region,kind:p.kind};
 }
 return {program:p,squads,moves:assigned,count:all.length,moving:Object.values(assigned).filter(m=>Math.hypot(m.x-m.o.x,m.y-m.o.y)>.1).length,formed:blocked.size};
}
function build(layout,g,hour){let best=buildAttempt(layout,g,hour);for(let attempt=1;best.moving<best.count&&attempt<=5;attempt++){const p=buildAttempt(layout,g,hour,attempt);if(p.moving>best.moving||p.moving===best.moving&&p.formed>best.formed)best=p}return best}
function cue(model,elapsed,duration=model.cycle){
 const t=((elapsed%model.cycle)+model.cycle)%model.cycle;let i=0;while(i+1<model.cues.length-1&&t>=model.cues[i+1])i++;
 const start=model.cues[i],end=model.cues[i+1],p=clamp((t-start)/(end-start),0,1),verse=Math.floor(elapsed/model.cycle),entrance=Math.min(model.cues[1]||8,duration*.27),exit=Math.min(model.cycle-(model.cues.at(-2)||0),duration*.27);
 const alt=(i+verse*(model.cues.length-1))%2,wave=alt?1-.22*smooth(p):.78+.22*smooth(p),blend=smooth((elapsed-entrance)/Math.max(1,model.beat*3))*smooth((duration-exit-elapsed)/Math.max(1,model.beat*3));
 const f=elapsed<entrance?smooth(elapsed/entrance):elapsed>=duration-exit?1-smooth((elapsed-duration+exit)/exit):1+(wave-1)*blend;
 return {i,kind:model.index%12,factor:f,p,verse,start,end,stage:elapsed<entrance?'列阵':elapsed>=duration-exit?'归位':'行进变奏'};
}
function motion(model,elapsed,duration,plan,id,night=false){
 if(!model||!Number.isFinite(elapsed)||elapsed<0||elapsed>=duration||!plan)return null;
 const c=cue(model,elapsed,duration),m=plan.moves[id];if(!m)return null;
 const f=c.factor;
 // Direction follows the march, and reverses on the return leg.
 const dx=(m.x-m.o.x)*f,dy=(m.y-m.o.y)*f;
 return {dx,dy,stand:f>.015,step:Math.sin(elapsed/model.beat*Math.PI*2+(id%2)*Math.PI),flip:Math.abs(m.x-m.o.x)>3&&f>.015?(c.stage==='归位'?m.x>m.o.x:m.x<m.o.x):undefined};
}
root.BudaoPraisePreview=Object.freeze({prepare,build,cue,motion,names,program,hourly,safe,routeOK,footprint,candidateOK});
})(window);