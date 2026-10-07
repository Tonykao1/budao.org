import { fingerprintImage, fingerprintText } from './fingerprint.mjs';
import { generateSceneCandidates } from './candidates.mjs';
import { validateSceneCandidate } from './validator.mjs';
import { createRhythmState, advanceRhythm } from './rhythm.mjs';
import { chooseSceneCandidate } from './solver.mjs';

function deepFreeze(value){
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return value;
}
function pick(list, random){
  if (!list.length) return null;
  const r=Math.max(0,Math.min(0.999999999,Number(random())||0));
  return list[Math.floor(r*list.length)] || list[0];
}
function average(values){ return values.length?values.reduce((a,b)=>a+b,0)/values.length:0; }

export function createJourneyEngine(options={}){
  const random=typeof options.random==='function'?options.random:Math.random;
  const viewport=options.viewport||{width:1200,height:800,mode:'desktop'};
  const minScenes=Math.max(1,Number(options.minScenes)||8);
  const maxScenes=Math.max(minScenes,Number(options.maxScenes)||15);
  const images=(options.images||[]).map(item=>item?.orientation && item?.largeFormatScore != null ? item : fingerprintImage(item));
  const messages=(options.messages||[]).map(text=>typeof text==='object' && text?.densityClass ? text : fingerprintText(text));
  const recentImageIds=new Set(options.recentImageIds||[]);
  const recentMessages=new Set(options.recentMessages||[]);
  const state={
    scenes:[],
    viewedIds:new Set(),
    currentSceneIndex:-1,
    frontierIndex:-1,
    usedImageIds:[],
    usedMessageIds:[],
    rhythm:createRhythmState(),
    closed:false,
  };

  function unusedImages(){
    const used=new Set(state.usedImageIds);
    const fresh=images.filter(x=>!used.has(x.id) && !recentImageIds.has(x.id));
    return fresh.length?fresh:images.filter(x=>!used.has(x.id));
  }
  function unusedMessages(){
    const used=new Set(state.usedMessageIds);
    const fresh=messages.filter(x=>!used.has(x.id) && !recentMessages.has(x.text) && !recentMessages.has(x.id));
    return fresh.length?fresh:messages.filter(x=>!used.has(x.id));
  }
  function rhythmComplete(){
    const types=new Set(state.rhythm.recentSceneTypes||[]);
    const weights=state.rhythm.recentVisualWeights||[];
    return state.rhythm.variationCount>=2 && types.size>=2 && average(weights)<=0.76;
  }
  function shouldClose(){
    const count=state.scenes.length;
    if (count < minScenes) return false;
    if (count >= maxScenes) return true;
    if (!rhythmComplete()) return false;
    const progress=(count-minScenes+1)/(maxScenes-minScenes+1);
    return random() < Math.min(0.58,0.16+progress*0.42);
  }
  function selectInputs(){
    let imagePool=unusedImages();
    let textPool=unusedMessages();
    let image=pick(imagePool,random);
    let text=pick(textPool,random);
    if (!imagePool.length && textPool.length) image=null;
    if (!textPool.length && imagePool.length) text=null;
    if (!imagePool.length && !textPool.length && state.scenes.length < minScenes){
      state.usedImageIds=[];
      state.usedMessageIds=[];
      image=pick(images,random);
      text=pick(messages,random);
    }
    return {image,text};
  }
  function generateOne(){
    if (state.closed) return null;
    if (shouldClose()){ state.closed=true; return null; }
    const {image,text}=selectInputs();
    if (!image && !text){ state.closed=true; return null; }
    const candidates=generateSceneCandidates({image,text,rhythm:state.rhythm,viewport});
    const context={viewport,safeInset:Math.max(24,Number(viewport.width||1200)*0.04),minTextPx:18,rhythm:state.rhythm};
    const legal=candidates.filter(c=>validateSceneCandidate(c,context).valid);
    if (!legal.length){ state.closed=true; return null; }
    const picked=chooseSceneCandidate(legal,{rhythm:state.rhythm},random) || legal[0];
    const scene=deepFreeze({...picked,id:`scene-${state.scenes.length+1}`,generatedAt:state.scenes.length+1});
    state.scenes.push(scene);
    state.frontierIndex=state.scenes.length-1;
    if (scene.imageId) state.usedImageIds.push(scene.imageId);
    if (scene.messageId) state.usedMessageIds.push(scene.messageId);
    state.rhythm=advanceRhythm(state.rhythm,scene);
    if (state.scenes.length>=maxScenes) state.closed=true;
    return scene;
  }
  function ensureAhead(count=2){
    const desired=Math.max(0,Number(count)||0);
    const target=Math.min(maxScenes,Math.max(state.scenes.length,state.currentSceneIndex+1+desired));
    while(!state.closed && state.scenes.length<target) generateOne();
    return getScenes();
  }
  function markViewed(sceneId){
    const index=state.scenes.findIndex(s=>s.id===sceneId);
    if (index<0) return;
    state.viewedIds.add(sceneId);
    state.currentSceneIndex=Math.max(state.currentSceneIndex,index);
  }
  function getScenes(){ return state.scenes.slice(); }
  function getState(){
    return {scenes:getScenes(),viewedIds:[...state.viewedIds],currentSceneIndex:state.currentSceneIndex,frontierIndex:state.frontierIndex,usedImageIds:state.usedImageIds.slice(),usedMessageIds:state.usedMessageIds.slice(),rhythm:{...state.rhythm,recentSceneTypes:[...(state.rhythm.recentSceneTypes||[])],recentVisualWeights:[...(state.rhythm.recentVisualWeights||[])]},closed:state.closed,minScenes,maxScenes};
  }
  function isClosed(){ return state.closed; }
  ensureAhead(2);
  return { ensureAhead, markViewed, getScenes, getState, isClosed };
}
