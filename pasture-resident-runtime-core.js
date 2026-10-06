(()=>{
'use strict';
if(window.top!==window||!document.getElementById('environmentLayer'))return;

const API='/api/pasture-auth';
const BODY_COLORS=['#f4ecdc','#f2e3b3','#bfd8da','#dec9c8','#c7d5b5','#d8d7ce','#f1d7bf','#eee8dc'];
const HEAD_COLORS=['#8d836e','#917d62','#776d66','#866f70','#727a66','#716a64','#907461','#746d65'];
const MARKINGS=['NONE','FACE','BACK','SOCKS'];
const PIXEL_HAND_OPEN='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Crect x=%2210%22 y=%228%22 width=%225%22 height=%2216%22 fill=%22%231f3140%22/%3E%3Crect x=%2217%22 y=%224%22 width=%225%22 height=%2220%22 fill=%22%231f3140%22/%3E%3Crect x=%2224%22 y=%222%22 width=%225%22 height=%2222%22 fill=%22%231f3140%22/%3E%3Crect x=%2231%22 y=%225%22 width=%225%22 height=%2219%22 fill=%22%231f3140%22/%3E%3Crect x=%2238%22 y=%2210%22 width=%225%22 height=%2215%22 fill=%22%231f3140%22/%3E%3Crect x=%226%22 y=%2220%22 width=%227%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%2210%22 y=%2222%22 width=%2233%22 height=%2216%22 fill=%22%231f3140%22/%3E%3Crect x=%2215%22 y=%2238%22 width=%2222%22 height=%226%22 fill=%22%231f3140%22/%3E%3Crect x=%2211%22 y=%229%22 width=%223%22 height=%2214%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2218%22 y=%225%22 width=%223%22 height=%2218%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2225%22 y=%223%22 width=%223%22 height=%2220%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2232%22 y=%226%22 width=%223%22 height=%2217%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2239%22 y=%2211%22 width=%223%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%227%22 y=%2221%22 width=%225%22 height=%228%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2212%22 y=%2223%22 width=%2229%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2217%22 y=%2236%22 width=%2218%22 height=%226%22 fill=%22%23f4d4a7%22/%3E%3C/svg%3E") 18 18, auto';
const PIXEL_HAND_CLOSED='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2248%22 height=%2248%22 viewBox=%220 0 48 48%22 shape-rendering=%22crispEdges%22%3E%3Crect x=%229%22 y=%2212%22 width=%2232%22 height=%2226%22 fill=%22%231f3140%22/%3E%3Crect x=%2214%22 y=%227%22 width=%225%22 height=%2212%22 fill=%22%231f3140%22/%3E%3Crect x=%2221%22 y=%225%22 width=%225%22 height=%2214%22 fill=%22%231f3140%22/%3E%3Crect x=%2228%22 y=%227%22 width=%225%22 height=%2212%22 fill=%22%231f3140%22/%3E%3Crect x=%2235%22 y=%2210%22 width=%225%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%224%22 y=%2221%22 width=%229%22 height=%2210%22 fill=%22%231f3140%22/%3E%3Crect x=%2211%22 y=%2214%22 width=%2228%22 height=%2222%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2215%22 y=%228%22 width=%223%22 height=%2211%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2222%22 y=%226%22 width=%223%22 height=%2213%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2229%22 y=%228%22 width=%223%22 height=%2211%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%2236%22 y=%2211%22 width=%223%22 height=%229%22 fill=%22%23f4d4a7%22/%3E%3Crect x=%225%22 y=%2222%22 width=%228%22 height=%228%22 fill=%22%23f4d4a7%22/%3E%3C/svg%3E") 18 18, grabbing';
const baa=new Audio('/pasture-preview/assets/baaa01.mp3');
baa.preload='auto';

let resident=null;
let arrivalStarted=0;
let layout=null;
let layoutKey='';
let drag=null;
let hover=false;
let mode='landscape';
let maker={bodyColor:BODY_COLORS[0],headColor:HEAD_COLORS[0],marking:'NONE'};
let busy=false;
let email='';
let toastTimer=0;

const style=document.createElement('style');
style.textContent=`
#pastureResidentCanvas{position:fixed;inset:0;width:100%;height:100%;z-index:4;pointer-events:none;image-rendering:pixelated;image-rendering:crisp-edges}
#pastureResidentLayer{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(12,32,29,.34);backdrop-filter:blur(2px)}
#pastureResidentLayer[hidden]{display:none!important}.pasture-resident-card{width:min(520px,94vw);max-height:92dvh;overflow:auto;background:#fff7df;border:4px solid #31596a;box-shadow:8px 9px 0 rgba(22,54,56,.28);padding:24px 24px 20px;color:#315366}
.pasture-resident-card h1{font:900 25px/1.2 "PingFang SC","Microsoft YaHei",sans-serif;letter-spacing:.12em;margin:0 0 7px}.pasture-resident-card p{font-size:13px;line-height:1.75;margin:8px 0 16px;color:#526b69}.pasture-resident-card label{display:block;font-size:12px;font-weight:850;margin:12px 0 5px}.pasture-resident-card input{width:100%;min-height:45px;background:#fffdf2;border:2px solid #50738a;border-radius:0;padding:9px 11px;font:700 16px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;color:#244a63;outline:none}.pasture-resident-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-top:16px}.pasture-resident-actions button,.pasture-choice button{min-height:43px;border:3px solid #31596a;background:#d9e7ba;color:#274c5e;padding:8px 14px;font-weight:900;cursor:pointer;border-radius:0;box-shadow:2px 2px 0 rgba(37,72,84,.16)}.pasture-resident-actions button.secondary{background:#f1dfb6;border-color:#7d6748}.pasture-resident-message{min-height:20px;margin-top:10px;font-size:12px;font-weight:800;color:#725b3d}
#pastureSheepPreview{display:block;width:100%;height:auto;aspect-ratio:2.18/1;background:#bfe7cd;border:3px solid #426b60;image-rendering:pixelated;margin:12px 0 14px}.pasture-choice{margin:12px 0}.pasture-choice strong{display:block;font-size:12px;margin-bottom:7px;letter-spacing:.12em}.pasture-choice .row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.pasture-choice button{min-width:0;padding:7px 6px;background:#efe1bb;border-width:2px;font-size:11px;line-height:1.1;box-shadow:none}.pasture-choice button[aria-pressed=true]{outline:3px solid #4d7f62;outline-offset:1px;background:#dce9bd}.pasture-swatch{display:block;width:22px;height:16px;border:2px solid rgba(36,74,99,.45);margin:0 auto 4px}.pasture-mark-row button{min-height:50px}
#pastureResidentToast{position:fixed;z-index:40;left:50%;bottom:max(28px,env(safe-area-inset-bottom));transform:translateX(-50%);background:#fff6dd;border:3px solid #31596a;color:#315366;padding:9px 15px;font-size:12px;font-weight:900;box-shadow:4px 4px 0 rgba(22,54,56,.25);opacity:0;pointer-events:none;transition:opacity .12s steps(2,end)}#pastureResidentToast.show{opacity:1}
@media(max-width:700px){.pasture-resident-card{width:100%;padding:20px 18px}.pasture-choice .row{grid-template-columns:repeat(4,minmax(0,1fr))}.pasture-choice button{font-size:10px;padding:6px 3px}}
`;
document.head.appendChild(style);

const canvas=document.createElement('canvas');
canvas.id='pastureResidentCanvas';
canvas.setAttribute('aria-hidden','true');
document.body.appendChild(canvas);
const ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;

const layer=document.createElement('div');
layer.id='pastureResidentLayer';
layer.hidden=true;
layer.innerHTML='<div class="pasture-resident-card" role="dialog" aria-modal="true" aria-labelledby="pastureResidentTitle"></div>';
document.body.appendChild(layer);
const card=layer.firstElementChild;
const toast=document.createElement('div');
toast.id='pastureResidentToast';toast.setAttribute('role','status');document.body.appendChild(toast);

function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function pop(v){clearTimeout(toastTimer);toast.textContent=v;toast.classList.add('show');toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);}
function msg(v){const n=document.getElementById('pastureResidentMessage');if(n)n.textContent=v||'';}
function friendly(reason){return({invalid_email:'请检查邮箱地址。',verification_invalid:'验证码不正确。',verification_expired:'验证码已过期，请重新发送。',verification_locked:'尝试次数过多，请重新发送验证码。',email_rate_limited:'验证码发送过于频繁，请稍后再试。',rate_limited:'操作过于频繁，请稍后再试。',email_unavailable:'验证码邮件暂时无法送达，请稍后再试。',service_unavailable:'牧场登录暂时不可用。',auth_not_configured:'牧场登录尚未完成服务配置。',database_not_configured:'牧场账户数据库尚未连接。',database_unavailable:'牧场账户数据库暂时不可用。'})[reason]||'暂时没有完成，请再试一次。';}
async function call(body,method='POST'){
  const options={method,credentials:'include',cache:'no-store'};
  if(method==='POST'){options.headers={'Content-Type':'application/json'};options.body=JSON.stringify(body);}
  const response=await fetch(API,options);
  const data=await response.json().catch(()=>({ok:false,reason:'bad_response'}));
  if(!response.ok||!data.ok){const error=new Error(data.reason||'request_failed');error.reason=data.reason;throw error;}
  return data;
}
function currentDailyPosition(){return layout?{x:layout.x,y:layout.y,flip:!!layout.flip,mode:currentMode(),dateKey:flockDateKey()}:null;}
function emitResidentUpdated(){
  const detail={resident,sheep:resident?.sheep||null,dailyPosition:currentDailyPosition()};
  window.dispatchEvent(new CustomEvent('pasture-resident-updated',{detail}));
}
function emitAuthState(){
  const authenticated=!!resident;
  const detail={authenticated,resident,user:resident,needsSheep:!!resident&&!resident?.sheep};
  document.body.classList.toggle('pasture-resident-authenticated',authenticated);
  window.__tongluFlockCount=resident?45:44;
  window.__pastureAuthState=detail;
  window.dispatchEvent(new CustomEvent('pasture-auth-state',{detail}));
  emitResidentUpdated();
}
async function logout(){
  if(busy)return;busy=true;
  try{await call({action:'logout'});resident=null;layout=null;layoutKey='';arrivalStarted=0;emitAuthState();emailView();}
  catch(error){pop(friendly(error.reason));}
  finally{busy=false;}
}
window.addEventListener('pasture-logout-request',logout);

function emailView(){
  layer.hidden=false;
  card.innerHTML='<h1 id="pastureResidentTitle">进入牧场</h1><p>留下一个有效邮箱。验证后，你会以自己捏出的羊进入数字牧场。</p><label for="pastureEmail">邮箱</label><input id="pastureEmail" type="email" autocomplete="email" placeholder="name@example.com" value="'+esc(email)+'"><div class="pasture-resident-actions"><button id="pastureSendCode" type="button">发送验证码</button></div><div class="pasture-resident-message" id="pastureResidentMessage" aria-live="polite"></div>';
  document.getElementById('pastureSendCode').onclick=sendCode;
}
async function sendCode(){
  if(busy)return;email=document.getElementById('pastureEmail').value.trim().toLowerCase();busy=true;msg('正在发送……');
  try{await call({action:'requestCode',email});codeView();}
  catch(error){msg(friendly(error.reason));}
  finally{busy=false;}
}
function codeView(){
  layer.hidden=false;
  card.innerHTML='<h1 id="pastureResidentTitle">查收邮件</h1><p>验证码已发送到 <strong>'+esc(email)+'</strong>。</p><label for="pastureCode">6位验证码</label><input id="pastureCode" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6"><div class="pasture-resident-actions"><button id="pastureVerify" type="button">进入牧场</button><button id="pastureBack" class="secondary" type="button">换邮箱</button></div><div class="pasture-resident-message" id="pastureResidentMessage" aria-live="polite"></div>';
  document.getElementById('pastureVerify').onclick=verifyCode;
  document.getElementById('pastureBack').onclick=emailView;
}
async function verifyCode(){
  if(busy)return;busy=true;msg('正在确认……');
  try{
    const data=await call({action:'verifyCode',email,code:document.getElementById('pastureCode').value.trim()});
    resident=data.user||null;layout=null;layoutKey='';emitAuthState();
    if(data.needsSheep||!resident?.sheep)sheepMaker();else layer.hidden=true;
  }catch(error){msg(friendly(error.reason));}
  finally{busy=false;}
}
function choiceButtons(values,type,current){
  return values.map((value,index)=>'<button type="button" data-sheep-'+type+'="'+esc(value)+'" aria-pressed="'+String(value===current)+'"><span class="pasture-swatch" style="background:'+esc(type==='mark'?'#efe1bb':value)+'"></span>'+(type==='mark'?['无纹','脸纹','背纹','白袜'][index]:'')+'</button>').join('');
}
function sheepMaker(){
  layer.hidden=false;
  maker={bodyColor:BODY_COLORS[0],headColor:HEAD_COLORS[0],marking:'NONE'};
  card.innerHTML='<h1 id="pastureResidentTitle">捏出自己</h1><p>这只羊就是你。慢慢看看颜色与记号，捏好后再进入牧场。</p><canvas id="pastureSheepPreview" width="320" height="146" aria-label="你的牧场形象预览"></canvas><div class="pasture-choice"><strong>身体</strong><div class="row">'+choiceButtons(BODY_COLORS,'body',maker.bodyColor)+'</div></div><div class="pasture-choice"><strong>头部</strong><div class="row">'+choiceButtons(HEAD_COLORS,'head',maker.headColor)+'</div></div><div class="pasture-choice"><strong>记号</strong><div class="row pasture-mark-row">'+choiceButtons(MARKINGS,'mark',maker.marking)+'</div></div><div class="pasture-resident-actions"><button id="pastureSaveSheep" type="button">这就是我 · 进入牧场</button></div><div class="pasture-resident-message" id="pastureResidentMessage" aria-live="polite"></div>';
  card.querySelectorAll('[data-sheep-body]').forEach(button=>button.onclick=()=>{maker.bodyColor=button.dataset.sheepBody;refreshMaker();});
  card.querySelectorAll('[data-sheep-head]').forEach(button=>button.onclick=()=>{maker.headColor=button.dataset.sheepHead;refreshMaker();});
  card.querySelectorAll('[data-sheep-mark]').forEach(button=>button.onclick=()=>{maker.marking=button.dataset.sheepMark;refreshMaker();});
  document.getElementById('pastureSaveSheep').onclick=saveSheep;refreshMaker();
}
function refreshMaker(){
  card.querySelectorAll('[data-sheep-body]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sheepBody===maker.bodyColor)));
  card.querySelectorAll('[data-sheep-head]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sheepHead===maker.headColor)));
  card.querySelectorAll('[data-sheep-mark]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sheepMark===maker.marking)));
  const preview=document.getElementById('pastureSheepPreview');if(!preview)return;
  const pctx=preview.getContext('2d');pctx.imageSmoothingEnabled=false;pctx.clearRect(0,0,preview.width,preview.height);pctx.fillStyle='#bfe7cd';pctx.fillRect(0,0,320,146);pctx.fillStyle='#80cb6b';pctx.fillRect(0,94,320,52);drawSheepOn(pctx,112,72,4.2,{f:maker.bodyColor,h:maker.headColor,marking:maker.marking,flip:false});
}
async function saveSheep(){
  if(busy)return;busy=true;msg('正在进入牧场……');
  try{
    const data=await call({action:'saveSheep',bodyColor:maker.bodyColor,headColor:maker.headColor,marking:maker.marking});
    resident=data.user||resident;layout=null;layoutKey='';if(data.created)arrivalStarted=performance.now();layer.hidden=true;emitAuthState();
    window.dispatchEvent(new CustomEvent('pasture-resident-saved',{detail:{resident,sheep:resident?.sheep||null}}));
    pop('你已经进入牧场');
  }catch(error){msg(friendly(error.reason));}
  finally{busy=false;}
}

function hash(str){let h=2166136261>>>0;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rand(seed){return function(){let t=seed+=0x6D2B79F5;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function flockDateKey(){try{const requested=document.getElementById('pastureFrame')?.contentWindow?.__tongluFlockDateRequested;if(/^\d{4}-\d{2}-\d{2}$/.test(String(requested||'')))return requested;}catch(_){}try{const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const o=Object.fromEntries(p.map(x=>[x.type,x.value]));return o.year+'-'+o.month+'-'+o.day;}catch(_){return new Date().toISOString().slice(0,10);}}
function currentMode(){return innerHeight>innerWidth*1.08?'portrait':'landscape';}
function scaleForY(y,m){return m==='portrait'?.38+Math.max(0,Math.min(1,(y-220)/235))*.82:.27+Math.max(0,Math.min(1,(y-165)/120))*.62;}
function portraitRiverCenter(t,w){const anchors=[[0,.75],[.16,.68],[.34,.77],[.53,.55],[.72,.70],[.88,.43],[1,.58]];for(let i=0;i<anchors.length-1;i++){const a=anchors[i],b=anchors[i+1];if(t>=a[0]&&t<=b[0]){let q=(t-a[0])/(b[0]-a[0]);q=q*q*(3-2*q);return w*(a[1]+(b[1]-a[1])*q);}}return w*.58;}
function safeLayout(o,m){if(m==='landscape'){if(o.y>=145){let l=340,r=390;if(o.y>=190&&o.y<232){l=336;r=410;}else if(o.y>=232){l=344;r=416;}const half=16*o.s;if(o.x+half>l&&o.x-half<r)return false;}if(o.x>408&&o.x<454&&o.y>178&&o.y<226)return false;return true;}const H=480,W=300,sourceY=173,t=Math.max(0,Math.min(1,(o.y-sourceY)/(H+8-sourceY))),rx=portraitRiverCenter(t,W),riverHalf=5+(W*.115-5)*Math.pow(t,1.18),creatureHalf=16*o.s+7;return Math.abs(o.x-rx)>riverHalf+creatureHalf;}
function storageKey(){return resident?.id?'pasture-resident-position-v2:'+resident.id+':'+currentMode()+':'+flockDateKey():'';}
function loadSaved(){try{const raw=localStorage.getItem(storageKey());if(!raw)return null;const data=JSON.parse(raw);if(Number.isFinite(data.x)&&Number.isFinite(data.y))return data;}catch(_){}return null;}
function savePosition(o){if(!resident?.id||!o)return;try{localStorage.setItem(storageKey(),JSON.stringify({x:+o.x.toFixed(2),y:+o.y.toFixed(2),flip:!!o.flip}));}catch(_){}try{window.PastureResidentPositionSync?.persistCurrent?.();}catch(_){}emitResidentUpdated();}
function buildLayout(){
  if(!resident?.sheep)return null;const m=currentMode(),key='pasture-resident-'+resident.id+'-'+flockDateKey()+'-'+m;if(layout&&layoutKey===key)return layout;
  const saved=loadSaved();if(saved){layout={...saved,s:scaleForY(saved.y,m),f:resident.sheep.bodyColor,h:resident.sheep.headColor,marking:resident.sheep.marking};layoutKey=key;return layout;}
  const random=rand(hash(key));let chosen=null;for(let i=0;i<200&&!chosen;i++){const y=m==='portrait'?225+random()*225:170+random()*112,x=m==='portrait'?20+random()*260:18+random()*430,o={x,y,s:scaleForY(y,m),flip:random()<.5,f:resident.sheep.bodyColor,h:resident.sheep.headColor,marking:resident.sheep.marking};if(safeLayout(o,m))chosen=o;}
  layout=chosen||(m==='portrait'?{x:48,y:350,s:.82,flip:false}:{x:110,y:236,s:.62,flip:false});layout.f=resident.sheep.bodyColor;layout.h=resident.sheep.headColor;layout.marking=resident.sheep.marking;layoutKey=key;return layout;
}
function resizeCanvas(){const next=currentMode();if(next===mode&&canvas.width&&canvas.height)return;mode=next;canvas.width=mode==='portrait'?300:480;canvas.height=mode==='portrait'?480:300;ctx.imageSmoothingEnabled=false;layout=null;layoutKey='';}
function rectOn(target,x,y,w,h,color){target.fillStyle=color;target.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));}
function drawSheepOn(target,x,y,s,o){
  const f=o.f||'#f4ecdc',h=o.h||'#8d836e';target.save();if(o.flip){target.translate(x+21*s,0);target.scale(-1,1);x=0;}
  rectOn(target,x,y,16*s,8*s,f);rectOn(target,x+3*s,y-4*s,11*s,13*s,f);rectOn(target,x+6*s,y-6*s,7*s,15*s,f);rectOn(target,x+13*s,y+2*s,7*s,7*s,h);rectOn(target,x+19*s,y+4*s,2*s,3*s,h);rectOn(target,x+12*s,y+3*s,2*s,2*s,h);rectOn(target,x+17*s,y+4*s,1,1,'#564d47');rectOn(target,x+4*s,y+8*s,2*s,6*s,'#5d5851');rectOn(target,x+11*s,y+8*s,2*s,6*s,'#5d5851');
  if(o.marking==='FACE')rectOn(target,x+14*s,y+2*s,3*s,3*s,'#f7efe1');if(o.marking==='BACK')rectOn(target,x+4*s,y-2*s,7*s,3*s,'#fff3dd');if(o.marking==='SOCKS'){rectOn(target,x+4*s,y+11*s,2*s,3*s,'#f4eee4');rectOn(target,x+11*s,y+11*s,2*s,3*s,'#f4eee4');}target.restore();
}
function canvasPoint(clientX,clientY){const r=canvas.getBoundingClientRect();return{x:(clientX-r.left)/r.width*canvas.width,y:(clientY-r.top)/r.height*canvas.height};}
function residentHit(clientX,clientY){const o=buildLayout();if(!o||arrivalStarted)return false;const p=canvasPoint(clientX,clientY),s=Math.max(.0001,o.s),ux=(p.x-o.x)/s,uy=(p.y-o.y)/s,lx=o.flip?21-ux:ux,ly=uy;/* Exact visible pixels only: transparent gaps are deliberately not clickable. */const hitRect=(x,y,w,h)=>lx>=x&&lx<=x+w&&ly>=y&&ly<=y+h;return hitRect(0,0,16,8)||hitRect(3,-4,11,13)||hitRect(6,-6,7,15)||hitRect(13,2,7,7)||hitRect(19,4,2,3)||hitRect(12,3,2,2)||hitRect(17,4,1,1)||hitRect(4,8,2,6)||hitRect(11,8,2,6);}
function setCursor(value){const env=document.getElementById('environmentLayer');document.documentElement.style.setProperty('cursor',value,'important');document.body.style.setProperty('cursor',value,'important');if(env)env.style.setProperty('cursor',value,'important');}
function clearCursor(){const env=document.getElementById('environmentLayer');document.documentElement.style.removeProperty('cursor');document.body.style.removeProperty('cursor');if(env)env.style.removeProperty('cursor');}
function playBaa(){try{baa.currentTime=0;const p=baa.play();if(p&&p.catch)p.catch(()=>{});}catch(_){}}
window.addEventListener('pointerdown',event=>{if(!residentHit(event.clientX,event.clientY))return;const o=buildLayout(),p=canvasPoint(event.clientX,event.clientY);drag={pointerId:event.pointerId,dx:p.x-o.x,dy:p.y-o.y};setCursor(PIXEL_HAND_CLOSED);event.preventDefault();event.stopPropagation();},true);
window.addEventListener('pointermove',event=>{if(drag&&drag.pointerId===event.pointerId){const p=canvasPoint(event.clientX,event.clientY),o=buildLayout();o.x=Math.max(8,Math.min(canvas.width-28,p.x-drag.dx));o.y=Math.max(mode==='portrait'?210:166,Math.min(canvas.height-18,p.y-drag.dy));o.s=scaleForY(o.y,mode);setCursor(PIXEL_HAND_CLOSED);event.preventDefault();event.stopPropagation();return;}const next=residentHit(event.clientX,event.clientY);if(next!==hover){hover=next;if(hover)setCursor(PIXEL_HAND_OPEN);else clearCursor();}},true);
function finishDrag(event){if(!drag||drag.pointerId!==event.pointerId)return;const o=buildLayout();savePosition(o);drag=null;hover=residentHit(event.clientX,event.clientY);if(hover)setCursor(PIXEL_HAND_OPEN);else clearCursor();playBaa();event.preventDefault();event.stopPropagation();}
window.addEventListener('pointerup',finishDrag,true);window.addEventListener('pointercancel',finishDrag,true);window.addEventListener('blur',()=>{drag=null;hover=false;clearCursor();});window.addEventListener('resize',()=>{resizeCanvas();layout=null;layoutKey='';emitResidentUpdated();});

function drawResident(now){resizeCanvas();ctx.clearRect(0,0,canvas.width,canvas.height);window.__tongluFlockCount=resident?45:44;if(!resident?.sheep)return;const o=buildLayout();if(!o)return;let x=o.x,y=o.y,landing=1;if(arrivalStarted){const elapsed=now-arrivalStarted,t=Math.max(0,Math.min(1,elapsed/1750)),eased=1-Math.pow(1-t,3);y=-26+(o.y+26)*eased;x=o.x+Math.sin(t*Math.PI*5)*(1-t)*8;landing=t;if(t>=1){arrivalStarted=0;emitResidentUpdated();}}const shadowAlpha=Math.max(.04,Math.min(.18,landing*.18));rectOn(ctx,o.x-2*o.s,o.y+13*o.s,21*o.s,2*o.s,'rgba(56,93,54,'+shadowAlpha+')');drawSheepOn(ctx,x,y,o.s,o);window.__tongluResidentLayout={x:o.x,y:o.y,s:o.s,flip:o.flip,mode};}
function frame(now){drawResident(now);requestAnimationFrame(frame);}requestAnimationFrame(frame);

async function boot(){
  emitAuthState();
  try{const data=await call(null,'GET');resident=data.user||null;layout=null;layoutKey='';emitAuthState();if(!resident){emailView();return;}if(!resident.sheep){sheepMaker();return;}layer.hidden=true;}
  catch(error){resident=null;layout=null;layoutKey='';emitAuthState();emailView();msg(friendly(error.reason));}
}
window.PastureResidentRuntime=Object.freeze({getResident:()=>resident,getLayout:()=>layout,residentHit,call,openLogin:emailView,logout,emitAuthState,emitResidentUpdated});
boot();
})();
