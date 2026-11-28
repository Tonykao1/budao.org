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

function scaleAt(o,y,g){const q=clamp((y-(g.mode==='portrait'?g.H*.445:160))/(g.mode==='portrait'?g.H*.45:126),0,1);return (g.mode==='portrait'?(.33+.81*q):(.32+.84*q))*(o.lamb?.56:1)}
function localScale(o,y,g){return o.s*scaleAt(o,y,g)/scaleAt(o,o.y,g)}
function ground(o,x=o.x,y=o.y,g){const s=localScale(o,y,g);return {x:x+(o.lamb?10.5:15)*s,y:y+(o.lamb?(o.rest?11:14):(o.rest?15:20))*s,s}}
function bankAt(x,y,g){if(g.mode==='portrait'){const t=clamp((y-g.H*.405)/(g.H+8-g.H*.405),0,1);return x<riverX(t,g.W)?0:1}return x<373?0:1}
function bounds(y,g,bank){
 if(g.mode==='portrait'){const t=clamp((y-g.H*.405)/(g.H+8-g.H*.405),0,1),r=riverX(t,g.W),hw=5+(g.W*.115-5)*Math.pow(t,1.18);return bank===0?[9,r-hw-13]:[r+hw+13,g.W-10]}
 let l=340,r=390;if(y>=190&&y<232){l=336;r=410}else if(y>=232){l=344;r=416}
 return bank===0?[12,l-16]:[r+13,g.W-14]
}
function toGround(o,g){return {...ground(o,o.x,o.y,g),id:o.id}}
function topFromFoot(o,p,g){const h=o.lamb?(o.rest?11:14):(o.rest?15:20);let y=p.y-h*o.s;for(let j=0;j<6;j++)y=p.y-h*localScale(o,y,g);const s=localScale(o,y,g);return {x:p.x-(o.lamb?10.5:15)*s,y,s}}
function footPenalty(p,o,g,bank){const z=topFromFoot(o,p,g),b=bounds(p.y,g,bank),half=(o.lamb?10.5:15)*z.s;
 let q=Math.max(0,g.minY+7-p.y,p.y-(g.H-3),b[0]+half*.35-p.x,p.x-(b[1]-half*.35));
 if(g.mode==='landscape'&&bank===1&&p.y>184&&p.y<232&&p.x<448+half*.5)q+=Math.min(p.y-184,232-p.y,448+half*.5-p.x);
 if(g.mode==='landscape'&&p.y>263&&p.x<50)q+=Math.min(p.y-263,50-p.x);return q}
function legalFoot(p,o,g,bank){return footPenalty(p,o,g,bank)<1e-6}
function metric(a,b){return Math.hypot(a.x-b.x,(a.y-b.y)*1.45)}
function segmentDistance(a,b,c,d){const x=a.x-c.x,y=(a.y-c.y)*1.45,dx=b.x-d.x-x,dy=(b.y-d.y)*1.45-y,t=clamp(-(x*dx+y*dy)/Math.max(1e-9,dx*dx+dy*dy),0,1);return Math.hypot(x+t*dx,y+t*dy)}
function routeAround(a,state,g,sep){
 const start={...a.p},goal=a.g,grid=3,bank=a.bank;
 const others=state.filter(b=>b!==a),clearance=others.map(b=>Math.min(sep(a,b),metric(start,b.p)));
 function valid(p,prev=start){if(footPenalty(p,a.o,g,bank)>footPenalty(prev,a.o,g,bank)+1e-6)return false;
  return others.every((b,i)=>segmentDistance(prev,p,b.p,b.p)+1e-6>=Math.min(clearance[i],metric(prev,b.p)))}
 const key=(x,y)=>x+','+y,open=[],cost=new Map(),prev=new Map(),pts=new Map(),sk=key(0,0);
 function push(v){open.push(v);let i=open.length-1;while(i){let p=(i-1)>>1;if(open[p].f<=v.f)break;open[i]=open[p];i=p}open[i]=v}
 function pop(){let r=open[0],v=open.pop();if(open.length){let i=0;while(i*2+1<open.length){let c=i*2+1;if(c+1<open.length&&open[c+1].f<open[c].f)c++;if(open[c].f>=v.f)break;open[i]=open[c];i=c}open[i]=v}return r}
 cost.set(sk,0);pts.set(sk,start);push({ix:0,iy:0,k:sk,c:0,f:metric(start,goal)});
 let end=null,near=metric(start,goal),best=sk;
 for(let count=0;open.length&&count<18000;count++){const n=pop();if(n.c!==cost.get(n.k))continue;const p=pts.get(n.k),d=metric(p,goal);
 if(d<near){near=d;best=n.k}
 if(d<grid*1.8&&valid(goal,p)){end=n.k;break}
 for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){if(!dx&&!dy)continue;const ix=n.ix+dx,iy=n.iy+dy,k=key(ix,iy),q={x:start.x+ix*grid,y:start.y+iy*grid/1.45},c=n.c+grid*Math.hypot(dx,dy);
 if(c>=(cost.get(k)??Infinity)||!valid(q,p))continue;cost.set(k,c);prev.set(k,n.k);pts.set(k,q);push({ix,iy,k,c,f:c+metric(q,goal)})}
 }
 if(end===null&&near>metric(start,goal)-2)return [];
 let k=end??best,path=[];while(k!==sk&&prev.has(k)){path.unshift(pts.get(k));k=prev.get(k)}
 if(end!==null)path.push({...goal});
 return path;
}
function line(a,b,n=22){return Array.from({length:n},(_,i)=>{let t=i/(n-1);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]})}
function polyline(vertices,n=20){return vertices.slice(1).flatMap((p,i)=>line(vertices[i],p,n))}
function strokes(kind){
 const L=(a,b)=>line(a,b),P=v=>polyline(v), C=(r,cx=.5,cy=.5)=>Array.from({length:85},(_,i)=>[cx+r*Math.cos(i*Math.PI*2/84),cy+r*Math.sin(i*Math.PI*2/84)]);
 switch(kind){
 case 0:return [.23,.50,.77].map(y=>L([.08,y],[.92,y]));
 case 1:return [.13,.32,.50,.68,.87].map(y=>L([.12,y],[.88,y]));
 case 2:return [.0,.19,.36].map(d=>P([[.07+d*.35,.84-d],[.5,.10+d],[.93-d*.35,.84-d]]));
 case 3:return [.36,.46].map(r=>Array.from({length:65},(_,i)=>[.5+r*Math.cos(Math.PI+i*Math.PI/64),.83+r*1.48*Math.sin(Math.PI+i*Math.PI/64)]));
 case 4:return [.43,.25].map(r=>P([[.5,.5-r],[.5+r,.5],[.5,.5+r],[.5-r,.5],[.5,.5-r]]));
 case 5:return [C(.43),C(.25)];
 case 6:return [-.2,0,.2].map(d=>L([.09,.80+d*.65],[.91,.20+d*.65]));
 case 7:return [.19,.38,.62,.81].flatMap(y=>[L([.08,y],[.39,y]),L([.61,y],[.92,y])]);
 case 8:return [.23,.41,.59,.77].map(x=>L([x,.09],[x,.91]));
 case 9:return [L([.08,.47],[.92,.47]),L([.08,.55],[.92,.55]),L([.46,.09],[.46,.91]),L([.54,.09],[.54,.91])];
 case 10:return Array.from({length:4},(_,i)=>{let a=i*Math.PI/2;return Array.from({length:38},(_,j)=>{let r=.05+j/37*.41,b=a+j/37*.72;return [.5+r*Math.cos(b),.5+r*Math.sin(b)]})});
 default:return [.0,.18].map(d=>Array.from({length:100},(_,i)=>[.07+i/99*.86,.41+d+.27*Math.sin(i/99*Math.PI*2)]));
 }
}
function shapeSlots(n,g,bank,kind,variant){
 if(!n)return [];
 const yr=[g.minY+17,g.H-12],span=yr[1]-yr[0];
 const map=([u,v])=>{if(variant){const a=.20,xx=u-.5,yy=v-.5;u=.5+xx*Math.cos(a)-yy*Math.sin(a);v=.5+xx*Math.sin(a)+yy*Math.cos(a)}v=clamp(v,.03,.97);u=clamp(u,.03,.97);const y=yr[0]+v*span,b=bounds(y,g,bank);return {x:b[0]+u*Math.max(1,b[1]-b[0]),y}};
 // Narrow bank contributes a disciplined column, not a distorted copy of the main silhouette.
 const paths=(bank===1&&g.mode==='landscape'?[[[.73,.05],[.73,.95]],[[.22,.05],[.22,.95]]].map(v=>line(v[0],v[1],45)):strokes(kind));
 const src=paths.flatMap(p=>p.map(map)).filter(p=>!(g.mode==='landscape'&&bank===1&&p.y>184&&p.y<232&&p.x<452)&&!(g.mode==='landscape'&&p.y>263&&p.x<50));
 if(src.length<n)return [];
 let chosen=[src[0]];const used=new Set([0]);
 while(chosen.length<n){let at=-1,best=-1;for(let i=0;i<src.length;i++){if(used.has(i))continue;const p=src[i],d=Math.min(...chosen.map(q=>metric(p,q)));if(d>best){best=d;at=i}}if(at<0)break;used.add(at);chosen.push(src[at])}
 return chosen;
}
function assignment(animals,slots,g){
 const n=animals.length,u=Array(n+1).fill(0),v=Array(n+1).fill(0),p=Array(n+1).fill(0),way=Array(n+1).fill(0);
 const cost=animals.map(o=>{const a=toGround(o,g);return slots.map(b=>{const d=metric(a,b);return d*d+Math.pow((b.y-a.y)*1.1,2)+(!legalFoot(b,o,g,bankAt(a.x,a.y,g))?1e7:0)})});
 for(let i=1;i<=n;i++){p[0]=i;let j0=0,minv=Array(n+1).fill(Infinity),used=Array(n+1).fill(false);do{used[j0]=true;const i0=p[j0];let delta=Infinity,j1=0;for(let j=1;j<=n;j++)if(!used[j]){const cur=cost[i0-1][j-1]-u[i0]-v[j];if(cur<minv[j]){minv[j]=cur;way[j]=j0}if(minv[j]<delta){delta=minv[j];j1=j}}for(let j=0;j<=n;j++)if(used[j]){u[p[j]]+=delta;v[j]-=delta}else minv[j]-=delta;j0=j1}while(p[j0]);do{const j1=way[j0];p[j0]=p[j1];j0=j1}while(j0)}
 const result=[];for(let j=1;j<=n;j++)result[p[j]-1]=slots[j-1];return result;
}
function buildShape(layout,g,hour){
 const pr=program(hour), all=layout.map(o=>({...o,home:toGround(o,g)})),targets={};
 for(let b=0;b<2;b++){const a=all.filter(o=>bankAt(o.home.x,o.home.y,g)===b),slots=shapeSlots(a.length,g,b,pr.kind,pr.variant);if(slots.length!==a.length)return null;assignment(a,slots,g).forEach((p,i)=>targets[a[i].id]=p)}
 // Continuous ground-plane steering, with stable identities and an explicit path for each sheep.
 const state=all.map(o=>({o,p:{...o.home},g:targets[o.id],bank:bankAt(o.home.x,o.home.y,g),path:[{...o.home}]}));
 const baseline=new Map();for(let i=0;i<state.length;i++)for(let j=0;j<i;j++)baseline.set(i+':'+j,metric(state[i].p,state[j].p));
 function sep(a,b){return Math.max(3.8,Math.min(12,(a.o.s+b.o.s)*5.5))}
 function valid(a,p){return footPenalty(p,a.o,g,a.bank)<=footPenalty(a.p,a.o,g,a.bank)+1e-6}
 let stable=0,bestError=Infinity,stale=0;
 for(let step=0;step<160;step++){
  let changes=0;const beforeStep=state.map(a=>({...a.p}));
  const order=state.map((a,i)=>i).sort((i,j)=>metric(state[j].p,state[j].g)-metric(state[i].p,state[i].g)||((i+step)%state.length)-((j+step)%state.length));
  for(const i of order){const a=state[i],d=metric(a.p,a.g);if(d<.65)continue;
   const angle=Math.atan2((a.g.y-a.p.y)*1.45,a.g.x-a.p.x);
   let best=null,bscore=-Infinity;
   for(const speed of [Math.min(2.8,d),Math.min(1.3,d),Math.min(.5,d)])for(const rot of [0,.35,-.35,.7,-.7,1.05,-1.05,1.45,-1.45,1.9,-1.9,2.6,-2.6]){
    const p={x:a.p.x+speed*Math.cos(angle+rot),y:a.p.y+speed*Math.sin(angle+rot)/1.45};if(!valid(a,p))continue;
    let ok=true,near=0;for(let j=0;j<state.length;j++){if(j===i)continue;const b=state[j],before=metric(a.p,b.p),after=metric(p,b.p),limit=Math.min(sep(a,b),baseline.get(Math.max(i,j)+':'+Math.min(i,j)));if(after+1e-6<Math.min(before,limit)||segmentDistance(beforeStep[i],p,beforeStep[j],b.p)+1e-6<Math.min(metric(beforeStep[i],beforeStep[j]),limit)){ok=false;break}if(after<limit+5)near+=(limit+5-after)*.04}
    if(!ok)continue;const score=d-metric(p,a.g)-near+.08*Math.cos(rot);if(score>bscore){bscore=score;best=p}
   }
   if(best&&bscore>-.85){a.p=best;changes++}
  }
  for(const a of state)a.path.push({...a.p});
  if(state.every(a=>metric(a.p,a.g)<1.5))break;
  stable=changes===0?stable+1:0;const err=state.reduce((v,a)=>v+metric(a.p,a.g),0);if(err<bestError-.5){bestError=err;stale=0}else stale++;if(stable>3||stale>18)break;
 }
 // Detour through free ground for sheep blocked by a bank or a stationary member.
 for(let pass=0;pass<2;pass++){
  const pending=state.filter(a=>metric(a.p,a.g)>1.5).sort((a,b)=>metric(b.p,b.g)-metric(a.p,a.g));
  for(const a of pending){const path=routeAround(a,state,g,sep);for(const p of path){a.p={...p};for(const b of state)b.path.push({...b.p})}}
 }
 // A sheep already on its target still takes a short physical step and returns.
 for(const a of state.filter(a=>a.path.every(p=>metric(p,a.o.home)<=.5))){
  const old={...a.p};let found=null;
  for(let j=0;j<32&&!found;j++){const q={x:old.x+1.2*Math.cos(j*Math.PI/16),y:old.y+1.2*Math.sin(j*Math.PI/16)/1.45};
   if(valid(a,q)&&state.every(b=>b===a||segmentDistance(old,q,b.p,b.p)+1e-6>=Math.min(metric(old,b.p),sep(a,b))))found=q}
  if(found){a.p=found;for(const b of state)b.path.push({...b.p});a.p=old;for(const b of state)b.path.push({...b.p})}
 }
 const error=state.map(a=>metric(a.p,a.g));const reached=error.filter(v=>v<=5).length;
 const moves=Object.fromEntries(state.map(a=>[a.o.id,{o:a.o,path:a.path,target:a.g,x:a.p.x,y:a.p.y}]));
 return {program:pr,kind:'shape',moves,count:all.length,moving:state.filter(a=>a.path.some(p=>metric(p,a.o.home)>.5)).length,formed:reached,maxError:Math.max(...error),averageError:error.reduce((a,b)=>a+b,0)/all.length,steps:state[0]?.path.length||1,g}
}

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
function timing(model,duration){
 const edge=Math.min(duration*.40,Math.max(11,model.cycle*.46));return {edge,tail:Math.min(.65,duration*.05)};
}
function formationFactor(model,t,duration){
 const {edge,tail}=timing(model,duration);const travel=Math.max(.5,edge-tail);
 if(t<tail)return 0;
 if(t<edge)return smooth((t-tail)/travel);
 if(t>duration-edge)return smooth((duration-tail-t)/travel);
 return 1;
}
function pathPose(plan,id,f,pose=1,t=0,beat=.6){
 const m=plan?.moves[id];if(!m)return null;const path=m.path;let z=clamp(f,0,1)*(path.length-1),i=Math.floor(z),q=z-i,a=path[i],b=path[Math.min(i+1,path.length-1)],p={x:a.x+(b.x-a.x)*q,y:a.y+(b.y-a.y)*q};
 const s=topFromFoot(m.o,p,plan.g).s, moving=Math.hypot(b.x-a.x,b.y-a.y)>.05&&f>.001&&f<.999;
 return {gx:p.x,gy:p.y,s,stand:m.o.rest?pose:1,step:moving?Math.sin(t/beat*Math.PI*2+id*.9):0,head:0,sway:0,flip:m.o.flip};
}
function formationPose(model,t,duration,plan,id){
 if(!plan||t<0||t>=duration)return null;
 const {tail}=timing(model,duration),f=formationFactor(model,t,duration),pose=smooth(t/Math.max(.15,tail))*smooth((duration-t)/Math.max(.15,tail));
 return pathPose(plan,id,f,pose,t,model.beat);
}
function noteAt(notes,t){let lo=0,hi=notes.length;while(lo<hi){let m=(lo+hi)>>1;if(notes[m].start<=t)lo=m+1;else hi=m}return lo?notes[lo-1]:null}
function halfPose(model,t,duration,o,g,night=false){
 if(t<0||t>=duration)return null;
 const p=toGround(o,g),zone=(p.x<g.W*.5?0:1)+(p.y<g.minY+(g.H-g.minY)*.60?0:2),part=zone%model.voices.length,phase=(t%model.cycle),n=noteAt(model.voices[part],phase);
 let a=0;if(n&&phase<n.end){const width=Math.min(n.end-n.start,Math.max(.15,model.beat*.76));a=Math.sin(Math.PI*clamp((phase-n.start)/width,0,1))*(.75+n.velocity*.25)}
 const fade=smooth(t/.4)*smooth((duration-t)/.5),amp=a*fade*(night?.6:1);
 return {gx:p.x,gy:p.y,s:o.s,stand:o.rest?0:1,step:o.rest?0:(zone===2?amp:amp*.35)*(o.id%2?1:-1),head:amp*(zone===0?1.8:zone===3?1.2:.65),sway:amp*(zone===1?1.3:zone===3?.6:.15)*(o.id%2?1:-1),flip:o.flip};
}
root.BudaoPraisePreview=Object.freeze({prepare,build,buildShape,shapeSlots,ground,localScale,topFromFoot,cue,motion,names,program,hourly,safe,routeOK,footprint,candidateOK,formationFactor,pathPose,formationPose,halfPose,timing,toGround});
})(window);