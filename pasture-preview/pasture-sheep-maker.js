(()=>{
'use strict';
const bodies=[['#f4ecdc','米白'],['#f2e3b3','麦穗'],['#bfd8da','浅蓝灰'],['#dec9c8','豆沙'],['#c7d5b5','青草'],['#d8d7ce','银灰'],['#f1d7bf','杏色'],['#eee8dc','云白']];
const heads=[['#8d836e','褐灰'],['#917d62','麦褐'],['#776d66','深灰'],['#866f70','棕红'],['#727a66','青灰'],['#716a64','炭灰'],['#907461','栗色'],['#746d65','石褐']];
const marks=[['NONE','无记号'],['FACE','脸部浅记号'],['BACK','背部浅记号'],['SOCKS','浅色腿']];
const state={bodyColor:bodies[0][0],headColor:heads[0][0],marking:'NONE'};
function esc(v){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function colorButtons(list,kind){return list.map(([v,n],i)=>'<button type="button" class="pasture-visual-choice" data-sheep-'+kind+'="'+esc(v)+'" aria-pressed="'+(i===0?'true':'false')+'" aria-label="'+esc(n)+'"><span class="pasture-sheep-chip" style="--chip:'+esc(v)+'" aria-hidden="true"><i></i></span><span>'+esc(n)+'</span></button>').join('')}
function markButtons(){return marks.map(([v,n],i)=>'<button type="button" class="pasture-mark-choice" data-sheep-mark="'+v+'" aria-pressed="'+(i===0?'true':'false')+'"><span class="pasture-mark-icon mark-'+v.toLowerCase()+'" aria-hidden="true"><i></i></span><span>'+n+'</span></button>').join('')}
function px(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h))}
function draw(){
 const c=document.getElementById('pastureSheepPreview');if(!c)return;
 const dpr=Math.max(1,Math.min(2,window.devicePixelRatio||1)),cssW=Math.max(280,c.clientWidth||360),cssH=Math.round(cssW*.46);
 c.width=Math.round(cssW*dpr);c.height=Math.round(cssH*dpr);const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.imageSmoothingEnabled=false;
 ctx.clearRect(0,0,cssW,cssH);
 const sky='#bfe7cd',grass='#89bd79',dark='#315366',light='#fff7df';
 px(ctx,0,0,cssW,cssH,sky);px(ctx,0,cssH*.72,cssW,cssH*.28,grass);
 const s=Math.max(4,Math.floor(cssW/92)),cx=Math.floor(cssW/2),cy=Math.floor(cssH*.54);
 // shadow
 ctx.fillStyle='rgba(49,83,102,.16)';ctx.fillRect(cx-24*s,cy+15*s,48*s,3*s);
 // wool cloud — deliberately blocky/pixelated
 [[-20,-8,18,17],[-10,-13,18,23],[2,-14,18,24],[14,-9,15,19],[-17,3,36,12]].forEach(r=>px(ctx,cx+r[0]*s,cy+r[1]*s,r[2]*s,r[3]*s,state.bodyColor));
 // head + ears
 px(ctx,cx+19*s,cy-4*s,13*s,15*s,state.headColor);px(ctx,cx+29*s,cy-1*s,6*s,5*s,state.headColor);px(ctx,cx+17*s,cy-5*s,5*s,4*s,state.headColor);
 // legs
 const leg=state.marking==='SOCKS'?light:dark;px(ctx,cx-12*s,cy+11*s,4*s,10*s,leg);px(ctx,cx+9*s,cy+11*s,4*s,10*s,leg);
 // markings
 if(state.marking==='FACE')px(ctx,cx+23*s,cy-1*s,5*s,5*s,light);
 if(state.marking==='BACK')px(ctx,cx-7*s,cy-11*s,13*s,5*s,light);
 // eye
 px(ctx,cx+27*s,cy+1*s,2*s,2*s,'#263a42');
 // tiny grass pixels
 for(let i=-4;i<=4;i++)px(ctx,cx+i*12*s,cy+24*s+(Math.abs(i)%2)*s,2*s,4*s,'#5c925e');
}
function choose(selector,key,value){
 state[key]=value;
 document.querySelectorAll(selector).forEach(b=>b.setAttribute('aria-pressed',String(b.getAttribute(selector.includes('body')?'data-sheep-body':selector.includes('head')?'data-sheep-head':'data-sheep-mark')===value)));
 draw();
}
function bindChoices(){
 document.querySelectorAll('[data-sheep-body]').forEach(b=>b.addEventListener('click',()=>choose('[data-sheep-body]','bodyColor',b.dataset.sheepBody)));
 document.querySelectorAll('[data-sheep-head]').forEach(b=>b.addEventListener('click',()=>choose('[data-sheep-head]','headColor',b.dataset.sheepHead)));
 document.querySelectorAll('[data-sheep-mark]').forEach(b=>b.addEventListener('click',()=>choose('[data-sheep-mark]','marking',b.dataset.sheepMark)));
}
async function open(){
 const auth=window.PastureResidentAuth;if(!auth)return;
 state.bodyColor=bodies[0][0];state.headColor=heads[0][0];state.marking='NONE';
 const card=auth.card;auth.layer.hidden=false;
 card.classList.add('pasture-sheep-maker-card');
 card.innerHTML='<h1 id="pastureResidentTitle">捏一只羊</h1><p>别填表。看着它，一点一点捏成你喜欢的样子。完成后，它会从天上落进羊群。</p>'+
 '<canvas id="pastureSheepPreview" role="img" aria-label="你的羊实时预览"></canvas>'+
 '<div class="pasture-choice"><strong>羊毛</strong><div class="row">'+colorButtons(bodies,'body')+'</div></div>'+
 '<div class="pasture-choice"><strong>脸</strong><div class="row">'+colorButtons(heads,'head')+'</div></div>'+
 '<div class="pasture-choice"><strong>记号</strong><div class="row pasture-mark-row">'+markButtons()+'</div></div>'+
 '<div class="pasture-resident-actions pasture-sheep-finish"><button id="pastureSaveSheep" type="button">这就是我 · 进入牧场</button></div><div class="pasture-resident-message" id="pastureResidentMessage" aria-live="polite"></div>';
 bindChoices();draw();requestAnimationFrame(draw);
 document.getElementById('pastureSaveSheep').onclick=async()=>{
  const button=document.getElementById('pastureSaveSheep');button.disabled=true;
  const message=document.getElementById('pastureResidentMessage');message.textContent='正在进入牧场……';
  try{
   const result=await auth.call({action:'saveSheep',bodyColor:state.bodyColor,headColor:state.headColor,marking:state.marking});
   auth.setUser(result.user);auth.layer.hidden=true;auth.apply(!!result.created);auth.pop('你的羊已经进入牧场');
  }catch(e){message.textContent=auth.friendly(e.reason);button.disabled=false}
 };
}
window.addEventListener('resize',()=>{if(!document.getElementById('pastureResidentLayer')?.hidden&&document.getElementById('pastureSheepPreview'))draw()},{passive:true});
window.addEventListener('pasture-needs-sheep',open);
window.PastureSheepMaker=Object.freeze({open});
})();
