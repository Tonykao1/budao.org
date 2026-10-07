import { createJourneyEngine } from './editorial-journey/journey.mjs';
import { createDepthReturnRenderer } from './editorial-journey/renderer.mjs';

const IMAGE_HISTORY_KEY='budao:yhzd:imageHistory:v3';
const MESSAGE_HISTORY_KEY='budao:yhzd:messageHistory:v3';
const HISTORY_LIMIT=24;

export const YHZD_MESSAGES=Object.freeze([
  '一路上都悬念不断......',
  '如此用心，细致又丰富的预备和带领，我们度过了一个美好又丰盛的徒步之旅！',
  '还有整体节奏，何时走动何时休息都计划得很精准啊。',
  '恩典多多，收获满满',
  '今天和弟兄姊妹们一起，感觉特别美好，感受到有祂的同在。感恩！',
  '7—88岁的徒步团太壮观了！',
  '今天无论是身体还是灵里，都收获满满，感恩弟兄姐妹们的陪伴和分享。',
  '很巧妙的设计',
  '一个老少咸宜，充满喜乐的身心灵快乐之旅！',
  '有幸参加了这次活动，都是意外的惊喜。',
  '感谢弟兄们搭建的信心之道。',
  '经过这一天，傍晚回来走在城市的水泥路上感觉特别轻盈和踏实。',
  '可以看漫山的花，还能直接退回小学生作息九点睡觉，真的太好了！',
  '认识和不认识人的都在认真听故事。',
  '感恩遇见',
  '用心带领，详尽的总结复盘，感恩。',
  '感恩祂。',
  '很棒的经历',
  '今天的安排，很舒适又得着。',
  '感恩弟兄姐妹们彼此敞开的分享和陪伴！',
  '很棒的体验，很有趣的经历',
  '当天去时候怕迟到，超速百分之十被罚。',
  '强度一点都不大，感觉还没缓过来。',
  '113层，2034个台阶，300米......',
  '活动太有意义了，身心被滋养，还结识了更多同路人。',
  '非常被安慰',
  '大家建立了信任而且让这份关系延续。',
  '我期待未来步道同赏京城。',
  '顺利找到包了',
  '我居然是第一个到的',
  '我都期待好久了，哎！祷告我明天生龙活虎！',
  '我相信人与人的每一次相遇都是奇迹。',
  '感恩这段相遇与安排，拆掉心墙，看见光。',
  'Grateful for this.'
]);

function safeStorage(win){ try{return win?.localStorage||null}catch{return null} }
function readHistory(storage,key){try{const value=JSON.parse(storage?.getItem(key)||'[]');return Array.isArray(value)?value.filter(x=>typeof x==='string'):[]}catch{return []}}
function remember(storage,key,value){if(!value)return;try{const next=readHistory(storage,key).filter(x=>x!==value);next.push(value);storage?.setItem(key,JSON.stringify(next.slice(-HISTORY_LIMIT)))}catch{}}
function viewportFor(win){ return {width:win.innerWidth||1200,height:win.innerHeight||800,mode:(win.innerWidth||1200)<=980?'mobile':'desktop'}; }

export async function initYhzdDepthReturn({document,window}){
  const root=document?.querySelector?.('[data-yhzd-journey]');
  if(!root || !window?.fetch) return null;
  let manifest;
  try{const response=await window.fetch('/images/yhzd/manifest.json',{cache:'no-cache'});if(!response?.ok)return null;manifest=await response.json()}catch{return null}
  const images=Array.isArray(manifest?.images)?manifest.images:[];
  if(!images.length) return null;
  const imageMap=new Map(images.map(item=>[String(item.id),item]));
  const storage=safeStorage(window);
  const engine=createJourneyEngine({images,messages:YHZD_MESSAGES,viewport:viewportFor(window),random:Math.random,recentImageIds:readHistory(storage,IMAGE_HISTORY_KEY),recentMessages:readHistory(storage,MESSAGE_HISTORY_KEY),minScenes:8,maxScenes:15});
  const renderer=createDepthReturnRenderer({root,window,lookupImage:id=>imageMap.get(String(id)),config:{}});
  renderer.sync(engine.getScenes());
  let raf=0,destroyed=false;
  function chooseActive(){
    raf=0;if(destroyed)return;
    const nodes=[...root.querySelectorAll('.ej-scene[data-scene-id]')];if(!nodes.length)return;
    const target=(window.innerHeight||800)*0.5;let best=null,bestDistance=Infinity;
    for(const node of nodes){const rect=node.getBoundingClientRect();if(rect.height<=0)continue;const distance=Math.abs(rect.top+rect.height*0.5-target);if(distance<bestDistance){best=node;bestDistance=distance;}}
    if(!best)return;
    const id=best.dataset.sceneId;renderer.setActiveScene(id);engine.markViewed(id);
    const scenes=engine.getScenes();const index=scenes.findIndex(s=>s.id===id);const spec=scenes[index];
    if(spec?.imageId)remember(storage,IMAGE_HISTORY_KEY,spec.imageId);if(spec?.text)remember(storage,MESSAGE_HISTORY_KEY,spec.text);
    if(index>=scenes.length-2&&!engine.isClosed()){engine.ensureAhead(3);renderer.sync(engine.getScenes());}
    root.classList.toggle('is-closed',engine.isClosed());
  }
  function schedule(){if(!raf)raf=window.requestAnimationFrame(chooseActive)}
  window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule,{passive:true});schedule();
  return {engine,renderer,destroy(){destroyed=true;window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);if(raf)window.cancelAnimationFrame(raf);renderer.destroy();}};
}
