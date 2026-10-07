function clamp(v,min=0,max=1){ return Math.max(min,Math.min(max,v)); }
function mix(a,b,t){ return a+(b-a)*t; }
function easeOutCubic(t){ return 1-Math.pow(1-clamp(t),3); }
function easeInCubic(t){ return Math.pow(clamp(t),3); }

export function depthModeForViewport(width){ return Number(width)<=980?'mobile':'desktop'; }

export function sceneMotionState(progress, mode='desktop'){
  const p=clamp(Number(progress)||0);
  const mobile=mode==='mobile';
  const before=p<=0.5;
  const local=before ? easeOutCubic(p/0.5) : easeInCubic((p-0.5)/0.5);
  const lock=Math.abs(p-0.5)<=0.055;
  if (before){
    return {
      scale:mix(mobile?0.78:0.58,1,local),
      blurPx:mix(mobile?5:12,0,local),
      opacity:mix(0.24,1,local),
      brightness:mix(mobile?0.68:0.54,1,local),
      translateZ:mix(mobile?-180:-720,0,local),
      lateralShift:mix(mobile?8:32,0,local),
      readingLocked:lock,
      textPerspective:0,
    };
  }
  return {
    scale:mix(1,mobile?0.74:0.5,local),
    blurPx:mix(0,mobile?6:14,local),
    opacity:mix(1,0.22,local),
    brightness:mix(1,mobile?0.64:0.48,local),
    translateZ:mix(0,mobile?-220:-900,local),
    lateralShift:mix(0,mobile?-6:-22,local),
    readingLocked:lock,
    textPerspective:0,
  };
}

export function computeSoftMagnetism({ focusDistance=1, velocity=0, delta=0, mode='desktop' } = {}){
  const distance=Math.abs(Number(focusDistance)||0);
  const speed=Math.abs(Number(velocity)||0);
  const intent=Math.abs(Number(delta)||0);
  const zone=mode==='mobile'?0.10:0.14;
  const maxStrength=mode==='mobile'?0.18:0.28;
  if (distance>=zone || speed>=900 || intent>=100) return 0;
  const proximity=1-distance/zone;
  const calm=1-Math.min(1,speed/900);
  const gentleIntent=1-Math.min(1,intent/100);
  return clamp(maxStrength*proximity*calm*gentleIntent,0,maxStrength);
}

export function planMemoryTiers(sceneSpecs=[], activeSceneId=null){
  const activeIndex=Math.max(0,sceneSpecs.findIndex(s=>s.id===activeSceneId));
  return sceneSpecs.map((spec,index)=>{
    const distance=Math.abs(index-activeIndex);
    const tier=distance<=1?'near':distance<=3?'deep':'stored';
    return { sceneId:spec.id, tier, fullDetail:tier==='near', spec };
  });
}

function resolveImageSource(item){
  if (!item) return null;
  const large=item['960']?.src || item.large?.src;
  const small=item['480']?.src || item.small?.src;
  return { src:large||small||item.src||null, srcset:small&&large?`${small} 480w, ${large} 960w`:null };
}
function createImage(doc,item,spec){
  const source=resolveImageSource(item);
  if(!source?.src) return null;
  const figure=doc.createElement('figure');
  figure.className='ej-media ej-spatial';
  figure.dataset.imageId=spec.imageId;
  figure.style.setProperty('--ej-image-scale',String(spec.imageScale||0.7));
  const img=doc.createElement('img');
  img.alt='';
  img.decoding='async';
  img.loading=spec.id==='scene-1'?'eager':'lazy';
  img.src=source.src;
  if(source.srcset){ img.srcset=source.srcset; img.sizes='(max-width: 980px) 90vw, 70vw'; }
  if(spec.cropSpec){
    figure.dataset.crop='safe';
    const c=spec.cropSpec;
    img.style.objectFit='cover';
    img.style.objectPosition=`${(c.x+c.width/2)*100}% ${(c.y+c.height/2)*100}%`;
  }
  figure.append(img);
  return figure;
}
function createQuote(doc,spec){
  if(!spec.text) return null;
  const quote=doc.createElement('blockquote');
  quote.className='ej-quote ej-reading';
  quote.dataset.messageId=spec.messageId||'';
  quote.style.setProperty('--ej-text-width',`${Math.round((spec.textWidth||0.4)*100)}vw`);
  const p=doc.createElement('p');
  p.className='ej-quote-text';
  p.textContent=spec.text;
  const footer=doc.createElement('footer');
  footer.textContent='— 一次同行之后';
  quote.append(p,footer);
  return quote;
}
function buildScene(doc,spec,lookupImage){
  const section=doc.createElement('section');
  section.className=`ej-scene ej-scene--${spec.sceneType}`;
  section.dataset.sceneId=spec.id;
  section.dataset.sceneType=spec.sceneType;
  section.dataset.sceneSpecText=spec.text||'';
  section.dataset.memoryTier='near';
  section.dataset.fullDetail='true';
  section.style.setProperty('--ej-scene-length',String(spec.sceneLength||0.8));
  section.style.setProperty('--ej-image-scale',String(spec.imageScale||0.7));
  section.style.setProperty('--ej-text-ratio',String(spec.textWidth||0.4));
  const stage=doc.createElement('div');
  stage.className='ej-stage';
  const media=spec.imageId?createImage(doc,lookupImage?.(spec.imageId),spec):null;
  const quote=createQuote(doc,spec);
  if(media) stage.append(media);
  if(quote) stage.append(quote);
  section.append(stage);
  return section;
}
function applyMotion(node,state){
  node.style.setProperty('--ej-scale',state.scale.toFixed(4));
  node.style.setProperty('--ej-blur',`${state.blurPx.toFixed(2)}px`);
  node.style.setProperty('--ej-opacity',state.opacity.toFixed(4));
  node.style.setProperty('--ej-brightness',state.brightness.toFixed(4));
  node.style.setProperty('--ej-z',`${state.translateZ.toFixed(1)}px`);
  node.style.setProperty('--ej-shift',`${state.lateralShift.toFixed(1)}px`);
  const reading=node.querySelector('.ej-reading');
  if(reading){
    reading.dataset.readingLocked=state.readingLocked?'true':'false';
    reading.classList.toggle('is-reading-locked',state.readingLocked);
  }
}

export function createDepthReturnRenderer({ root, window, lookupImage, config={} }){
  if(!root || !window) throw new TypeError('root and window are required');
  const doc=root.ownerDocument || window.document;
  const mode=()=>config.mode || depthModeForViewport(window.innerWidth);
  const specs=new Map();
  const nodes=new Map();
  let activeSceneId=null;
  let frame=0;
  let lastScrollY=Number(window.scrollY)||0;
  let lastScrollAt=typeof performance!=='undefined'?performance.now():Date.now();
  let velocity=0;
  let lastWheelDelta=0;

  function makeVirtualNode(spec,tier){
    const node=doc.createElement('section');
    node.className=`ej-scene ej-scene--virtual ej-scene--${tier}`;
    node.dataset.sceneId=spec.id;
    node.dataset.sceneType=spec.sceneType;
    node.dataset.memoryTier=tier;
    node.dataset.fullDetail='false';
    node.style.setProperty('--ej-scene-length',String(spec.sceneLength||0.8));
    if(tier==='deep'){
      const ghost=doc.createElement('div');
      ghost.className='ej-memory-glow';
      node.append(ghost);
    }
    return node;
  }
  function mount(spec,tier){
    const existing=nodes.get(spec.id);
    const needsFull=tier==='near';
    const already=existing && existing.dataset.memoryTier===tier && (existing.dataset.fullDetail==='true')===needsFull;
    if(already) return existing;
    const node=needsFull?buildScene(doc,spec,lookupImage):makeVirtualNode(spec,tier);
    node.dataset.memoryTier=tier;
    node.dataset.fullDetail=needsFull?'true':'false';
    if(existing?.isConnected) existing.replaceWith(node);
    else {
      const index=[...specs.keys()].indexOf(spec.id);
      const nextId=[...specs.keys()][index+1];
      const nextNode=nextId?nodes.get(nextId):null;
      if(nextNode?.isConnected) root.insertBefore(node,nextNode); else root.append(node);
    }
    nodes.set(spec.id,node);
    return node;
  }
  function reconcileMemory(){
    const list=[...specs.values()];
    if(!list.length) return;
    const active=activeSceneId && specs.has(activeSceneId)?activeSceneId:list[0].id;
    for(const item of planMemoryTiers(list,active)) mount(item.spec,item.tier);
  }
  function updateMotion(){
    frame=0;
    const vh=Math.max(1,window.innerHeight||800);
    const center=vh*0.5;
    for(const [id,node] of nodes){
      if(node.dataset.memoryTier==='stored') continue;
      const rect=node.getBoundingClientRect();
      const sceneCenter=rect.top+rect.height*0.5;
      let progress=clamp(0.5-(sceneCenter-center)/(vh*1.35),0,1);
      const magnet=computeSoftMagnetism({focusDistance:Math.abs(progress-0.5),velocity,delta:lastWheelDelta,mode:mode()});
      progress=0.5+(progress-0.5)*(1-magnet);
      const state=sceneMotionState(progress,mode());
      applyMotion(node,state);
      if(state.readingLocked && node.dataset.fullDetail==='true') activeSceneId=id;
    }
    lastWheelDelta*=0.45;
  }
  function requestUpdate(){ root.dataset.depthMode=mode(); if(!frame) frame=window.requestAnimationFrame(updateMotion); }
  function handleScroll(){
    const now=typeof performance!=='undefined'?performance.now():Date.now();
    const y=Number(window.scrollY)||0;
    const dt=Math.max(8,now-lastScrollAt);
    velocity=Math.abs(y-lastScrollY)/dt*1000;
    lastScrollY=y; lastScrollAt=now;
    requestUpdate();
  }
  function handleWheel(event){ lastWheelDelta=Number(event?.deltaY)||0; }
  function sync(sceneSpecs=[]){
    root.dataset.depthMode=mode();
    for(const spec of sceneSpecs) specs.set(spec.id,spec);
    if(!activeSceneId && sceneSpecs[0]) activeSceneId=sceneSpecs[0].id;
    reconcileMemory();
    requestUpdate();
  }
  function setActiveScene(sceneId){
    if(!specs.has(sceneId)) return;
    activeSceneId=sceneId;
    reconcileMemory();
    for(const [id,node] of nodes){
      const active=id===sceneId;
      node.classList.toggle('is-active',active);
      const reading=node.querySelector?.('.ej-reading');
      if(reading){ reading.classList.toggle('is-reading-locked',active); reading.dataset.readingLocked=active?'true':'false'; }
    }
    requestUpdate();
  }
  function destroy(){
    window.removeEventListener('scroll',handleScroll);
    window.removeEventListener('resize',requestUpdate);
    window.removeEventListener('wheel',handleWheel);
    if(frame) window.cancelAnimationFrame(frame);
    nodes.clear(); specs.clear();
  }
  window.addEventListener('scroll',handleScroll,{passive:true});
  window.addEventListener('resize',requestUpdate,{passive:true});
  window.addEventListener('wheel',handleWheel,{passive:true});
  return {
    sync,setActiveScene,destroy,
    getActiveSceneId:()=>activeSceneId,
    getSceneSpec:id=>specs.get(id)||null,
    getMemoryTier:id=>nodes.get(id)?.dataset.memoryTier||null,
  };
}
