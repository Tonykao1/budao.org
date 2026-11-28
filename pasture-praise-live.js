/* Production-only audio-clock bridge for approved V4.1. No music or resident writes. */
(function(root){
'use strict';
const M=root.BudaoPraisePreview,api=root.BudaoHourlyHymns;if(!M||!api)return;
const scenes=new Map();let session=null,returning=null,ignoredId=null;
const now=()=>root.performance.now(),smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
function planFor(s,h){if(!s.plans.has(h))s.plans.set(h,M.buildShape(s.layout,s.g,h));return s.plans.get(h)}
function prepare(s,h){try{planFor(s,h)}catch(e){console.warn('[BUDAO] praise planning:',e.message)}}
function queueWarm(s){const u=root.__budaoPastureHourlyHymns?.upcoming;if(u?.kind==='hour'&&!s.plans.has(u.hour))root.setTimeout(()=>{if(!session&&scenes.get(s.mode)===s)prepare(s,u.hour)},0)}
function register(mode,W,H,layout){
 const sig=W+'|'+H+'|'+layout.map(o=>o.id+':'+o.x.toFixed(2)+','+o.y.toFixed(2)+','+o.s.toFixed(3)+','+!!o.rest).join(';');
 let s=scenes.get(mode);if(s?.sig===sig)return s;
 s={mode,sig,layout:layout.map(o=>({...o})),g:{mode,W,H,minY:mode==='portrait'?Math.round(H*.405)+8:155},plans:new Map()};
 scenes.set(mode,s);if(layout.length===44)queueWarm(s);return s;
}
function makeSession(p,s){
 const score=(p.kind==='half'?root.BudaoPastureHalfHourScores:root.BudaoPastureHymnScores)?.[p.index];if(!score)return null;
 const model=M.prepare(score,api,p.hour),plan=p.kind==='hour'?planFor(s,p.hour):null;
 if(p.kind==='hour'&&(!plan||plan.count!==44||plan.moving!==44||plan.formed!==44)){console.warn('[BUDAO] praise formation constrained; leave natural flock');return null}
 return {id:p.id,mode:s.mode,scene:s,model,plan,duration:p.duration,lastT:0,lastPoses:null};
}
function sample(s,t){
 const poses={};for(const o of s.scene.layout){const p=s.plan?M.formationPose(s.model,t,s.duration,s.plan,o.id):M.halfPose(s.model,t,s.duration,o,s.scene.g);
 if(p)poses[o.id]=p}
 return {layout:s.scene.layout,poses};
}
function beginReturn(s){
 if(!s.lastPoses)return;
 if(s.lastT>=s.duration-.65)return;
 const f=s.plan?M.formationFactor(s.model,s.lastT,s.duration):0;
 returning={...s,start:now(),ms:s.plan?Math.max(650,M.timing(s.model,s.duration).edge*1000*f):500,f};
}
function returnFrame(r){
 const q=smooth((now()-r.start)/r.ms);if(q>=1){returning=null;return null}
 const poses={};for(const o of r.scene.layout){const old=r.lastPoses[o.id];if(!old)continue;
 if(r.plan){const p=M.pathPose(r.plan,o.id,r.f*(1-q),1,0,r.model.beat);if(!p)continue;p.stand=o.rest?old.stand*(1-q):1;p.step=old.step*(1-q);poses[o.id]=p}
 else poses[o.id]={...old,step:old.step*(1-q),head:old.head*(1-q),sway:old.sway*(1-q)};
 }return {layout:r.scene.layout,poses}
}
function frame(mode,W,H,layout){
 const s=register(mode,W,H,layout),p=root.__budaoPastureHourlyHymns?.playback||null;
 if(returning){if(returning.mode!==mode)return null;if(p)ignoredId=p.id;return returnFrame(returning)}
 if(session&&(!p||p.id!==session.id)){const old=session;session=null;if(old.lastT<old.duration-.65)beginReturn(old);if(returning){if(p)ignoredId=p.id;return returning.mode===mode?returnFrame(returning):null}}
 if(!p)return null;if(p.id===ignoredId)return null;
 if(session&&session.mode!==mode)return null;
 if(!session){
  // Do not teleport an already-running choreography into a newly opened or resized scene.
  if(p.elapsed>1.2||layout.length!==44){ignoredId=p.id;return null}
  try{session=makeSession(p,s)}catch(e){console.warn('[BUDAO] praise bridge:',e.message)}
  if(!session){ignoredId=p.id;return null}
 }
 if(session.scene.g.W!==W||session.scene.g.H!==H){ignoredId=p.id;session=null;return null}
 session.lastT=Math.max(0,Math.min(p.duration-.000001,p.elapsed));
 const result=sample(session,session.lastT);session.lastPoses=result.poses;return result;
}
root.addEventListener('budao:hourly-hymn:queued',e=>{const d=e.detail;if(d?.kind!=='hour')return;const h=new Date(d.slot||d.hour).getHours();root.setTimeout(()=>{if(!session)for(const s of scenes.values())if(s.layout.length===44)prepare(s,h)},0)});
root.BudaoPasturePraise=Object.freeze({frame,get state(){return {active:!!session,returning:!!returning,mode:session?.mode||null,kind:session?.plan?'hour':session?'half':null}}});
})(window);