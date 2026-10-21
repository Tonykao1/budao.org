(()=>{
'use strict';
// This opt-in, read-only acceptance overlay contains NO personal identifiers.
// Open /pasture-preview/?checkSheep=1 to locate 44+1 activation failures.
if(new URLSearchParams(location.search).get('checkSheep')!=='1')return;
const live=document.getElementById('liveArea');
const card=document.createElement('aside');card.id='pastureSheepDiagnostic';
card.setAttribute('role','status');
card.style.cssText='position:fixed;z-index:9999;top:12px;right:12px;max-width:min(370px,calc(100vw - 24px));background:#fff9e8;box-shadow:5px 6px 0 #204a4560;border:3px solid #32565a;padding:13px 16px;font:13px/1.8 system-ui,sans-serif;color:#244b4a;max-height:60vh;overflow:auto;pointer-events:auto';
card.innerHTML='<div style="font-size:15px;font-weight:800">第 45 只羊 · 只读链路检查</div>'+
 '<div id="pastureSheepCheckLines">正在读取……</div>'+
 '<button type="button" id="pastureSheepCheckRefresh" style="font:700 13px system-ui,sans-serif;padding:6px 10px;background:#dcecc6;border:2px solid #527467;cursor:pointer;margin-top:8px">重新检查并同步身份</button>'+
 '<div style="font-size:11px;line-height:1.6;margin-top:6px">不会生成、覆盖或删除任何羊。截图请不要包含浏览器中的私人信息。</div>';
document.body.appendChild(card);
const lines=card.querySelector('#pastureSheepCheckLines');
const state={server:'检查中',hasSheep:null,appearance:'',gate:false,core:false,received:false,painted:false,portrait:false};
function text(){
 const row=(label,value)=>'<div style="border-top:1px solid #d4dfcb;padding:3px 0"><b>'+label+'：</b>'+value+'</div>';
 const status=state.server==='已登录且有羊'&&state.painted?'引擎报告已绘制，请观察画面及遮挡':
  state.server==='已登录且有羊'&&!state.gate?'等待功能区加载':
  state.server==='已登录且有羊'&&!state.core?'等待最终牧场引擎加载':
  state.server==='已登录且有羊'&&!state.received?'尚未确认羊已送达引擎':
  state.server==='已登录且有羊'&&!state.painted?'已送达，等待画布绘制':
  state.server==='已登录但无羊记录'?'服务器没有该账号的羊，请暂勿重新捏':
  state.server==='未登录'?'请先在本域名完成邮箱验证':state.server;
 lines.innerHTML=row('服务器账户',state.server)+
  row('羊的外观资料',state.hasSheep?state.appearance:'未取得')+
  row('功能区已就绪',state.gate?'是':'未确认')+
  row('牧场核心已就绪',state.core?'是':'未确认')+
  row('居民羊已送达',state.received?'是':'未确认')+
  row('居民羊已绘制',state.painted?'是':state.portrait?'竖屏独立绘制':'未确认')+
  '<div style="font-size:12px;font-weight:700;color:#7a593d;margin-top:5px">'+status+'</div>';
}
async function refresh(){
 try{
  const res=await fetch('/api/pasture-auth',{credentials:'include',cache:'no-store'});
  const data=await res.json();
  if(!res.ok||!data.ok)throw Error(data.reason||'http_'+res.status);
  const resident=data.user||null;
  state.server=!resident?'未登录':resident.sheep?'已登录且有羊':'已登录但无羊记录';
  state.hasSheep=!!resident?.sheep;
  state.appearance=resident?.sheep?'外观版本 V'+String(resident.sheep.appearanceVersion||1):'';
  // The verified API response is the ONLY authority used to replay a lost
  // identity event. Never trust a localStorage identity or user-entered id.
  const auth=window.PastureResidentAuth;
  if(auth&&typeof auth.setUser==='function'){
   auth.setUser(resident);auth.apply(false);
  }
 }catch(e){state.server='身份查询异常（'+String(e.message||'unknown').slice(0,50)+'）';state.hasSheep=null}
 text();
}
window.addEventListener('message',event=>{
 if(event.origin!==location.origin||event.source!==live?.contentWindow)return;
 switch(event.data?.type){
 case 'pasture-resident-gate-ready-v1':state.gate=true;break;
 case 'pasture-pilot-core-ready-v1':state.core=true;break;
 case 'pasture-pilot-resident-status-v1':
  state.received=!!event.data.received;state.painted=state.painted||!!event.data.painted;
  state.portrait=!!event.data.portrait;break;
 default:return;
 }
 text();
});
card.querySelector('#pastureSheepCheckRefresh').onclick=refresh;
text();refresh();
})();