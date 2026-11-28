/* BUDAO / Formation preview V2. Musical cue clock, terrain-aware local marching groups. */
(function(root){
'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const names=['横列','楔形','弧列','斜列','双列'];
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
function slots(n,kind,cx,cy,spacing){
 const out=[];for(let i=0;i<n;i++){
  const j=i-(n-1)/2,q=j/Math.max(1,(n-1)/2);let x=j*spacing,y=0;
  if(kind===1)y=Math.abs(j)*spacing*.48;
  if(kind===2)y=(q*q-.45)*spacing*1.15;
  if(kind===3)y=j*spacing*.52;
  if(kind===4){x=(Math.floor(i/2)-(Math.ceil(n/2)-1)/2)*spacing*1.18;y=(i%2-.5)*spacing*1.05}
  out.push({x:cx+x,y:cy+y});
 }return out;
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
function fitGroup(pool,all,g,kind){
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
   const targets=slots(n,kind,c.x,c.y+shift,spacing*factor);
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
function build(layout,g,kind,variant=0){
 const all=layout.filter(o=>Number.isFinite(o.x)&&Number.isFinite(o.y)&&o.s>0);
 const squads=[];const blocked=new Set();
 const z=[0,1,2,3,4,5].sort((a,b)=>(a+variant)%6-(b+variant)%6);
 for(const region of z){
  const pool=all.filter(o=>zone(o,g)===region&&!o.rest&&!blocked.has(o.id));
  // Earlier squads occupy both their original and their held positions while later squads plan.
  const obstacles=all.concat(squads.flatMap(s=>s.moves.map(m=>({...m.o,id:1000+m.o.id,x:m.x,y:m.y}))));
  const k=(kind+(region%2===1?1:0))%names.length;
  const moves=fitGroup(pool,obstacles,g,k);
  if(moves.length){
   // Check simultaneous paths of already admitted squads at matching progress.
   const combined=squads.flatMap(s=>s.moves).concat(moves);
   if(!routeOK(combined,all,g))continue;
   squads.push({region,kind:k,moves});moves.forEach(m=>blocked.add(m.o.id));
  }
 }
 return {squads,moves:Object.fromEntries(squads.flatMap(s=>s.moves.map(m=>[m.o.id,{...m,region:s.region,kind:s.kind}]))),count:blocked.size};
}
function cue(model,elapsed){
 const t=((elapsed%model.cycle)+model.cycle)%model.cycle;
 let i=0;while(i+1<model.cues.length-1&&t>=model.cues[i+1])i++;
 const start=model.cues[i],end=model.cues[i+1],p=clamp((t-start)/(end-start),0,1),verse=Math.floor(elapsed/model.cycle);
 const kind=(model.index+i+verse*2)%names.length;
 // Move, hold, withdraw. Different regions form distinct figures; no synchronized bobbing.
 const factor=p<.42?smooth(p/.42):p<.67?1:1-smooth((p-.67)/.33);
 return {i,kind,factor,p,verse,start,end};
}
function motion(model,elapsed,duration,plan,id,night=false){
 if(!model||!Number.isFinite(elapsed)||elapsed<0||elapsed>=duration||!plan)return null;
 const c=cue(model,elapsed),m=plan.moves[id];if(!m)return {dx:0,dy:0};
 const f=c.factor;
 // Direction follows the march, and reverses on the return leg.
 const dx=(m.x-m.o.x)*f,dy=(m.y-m.o.y)*f;
 return {dx,dy,flip:Math.abs(m.x-m.o.x)>4&&f>0.02?(c.p<.67?m.x<m.o.x:m.x>m.o.x):undefined};
}
root.BudaoPraisePreview=Object.freeze({prepare,build,cue,motion,names,safe,routeOK,footprint});
})(window);