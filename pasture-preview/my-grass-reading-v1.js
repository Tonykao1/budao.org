/* 我的牧草 · 经卷领受 V1
 * 浏览章节 ≠ 正式阅读。点击经节开启连续原声 Journey，逐节推进留下真实时间轨迹。
 */
(function(root,factory){
  if(typeof module==='object'&&module.exports){
    module.exports=factory(require('./my-grass-core.js'),require('./my-grass-bible-v04.js'),null);
  }else{
    const api=factory(root.MyGrassCore,root.MyGrassBible,root);
    root.MyGrassReading=api;
    if(root&&root.document)api.autoInstall(root);
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(C,B,host){
 'use strict';
 const CUV_ID='cuv1919-shen-s',ESV_ID='esv';
 const ESV_NAME='English Standard Version (ESV)';
 const CUV_NAME='圣经和合本（神版）';

 function verseForAudioProgress(verses,currentTime,duration){
  const list=Array.isArray(verses)?verses.filter(v=>Number.isFinite(Number(v?.verse))):[];
  const totalDuration=Number(duration),time=Number(currentTime);
  if(!list.length||!Number.isFinite(totalDuration)||totalDuration<=0||!Number.isFinite(time))return null;
  const weights=list.map(v=>Math.max(1,String(v.text||'').replace(/\s+/g,'').length));
  const totalWeight=weights.reduce((sum,value)=>sum+value,0);
  const clamped=Math.max(0,Math.min(time,totalDuration));
  if(clamped>=totalDuration)return Number(list[list.length-1].verse);
  const target=(clamped/totalDuration)*totalWeight;
  let cursor=0;
  for(let i=0;i<list.length;i++){cursor+=weights[i];if(target<cursor)return Number(list[i].verse)}
  return Number(list[list.length-1].verse);
 }

 function parseEsvNumberedText(value){
  const text=String(value||'').replace(/\s*\(ESV\)\s*$/,'').trim();
  const marker=/\[(\d+)\]\s*/g,matches=[];let match;
  while((match=marker.exec(text)))matches.push({verse:Number(match[1]),start:match.index,end:marker.lastIndex});
  if(!matches.length)return [];
  return matches.map((item,index)=>({
   verse:item.verse,
   text:text.slice(item.end,index+1<matches.length?matches[index+1].start:text.length).replace(/\s+/g,' ').trim()
  })).filter(v=>Number.isFinite(v.verse)&&v.verse>0&&v.text);
 }

 async function loadReadingChapter(book,chapter,translationId,fetchImpl) {
  if(!B)throw Error('圣经经卷引擎尚未载入。');
 const meta=B.bookMeta(book),ch=B.clampChapter(meta.abbr,chapter);
  const id=translationId===ESV_ID||translationId===ESV_NAME?ESV_ID:CUV_ID;
  if(id===ESV_ID){
   const passage=await B.loadTranslationPassage(meta.abbr+' '+ch,ESV_ID,fetchImpl);
   const verses=parseEsvNumberedText(passage.text);
   if(!verses.length)throw Error('ESV 本章没有返回可定位的节号。');
   return {
    reference:meta.abbr+' '+ch,translation:ESV_NAME,source:ESV_ID,storage:'reference-only',copyright:passage.copyright||'ESV',
    verses:verses.map(v=>({...v,id:B.verseId(meta.abbr,ch,v.verse)}))
   };
  }
  const data=await B.loadChapter(meta.abbr,ch,fetchImpl);
  return {
   reference:meta.abbr+' '+ch,translation:CUV_NAME,source:CUV_ID,storage:'local-text',
   verses:data.verses.map(v=>({...v,id:B.verseId(meta.abbr,ch,v.verse)}))
  };
 }

 function install(root){
  const doc=root&&root.document;if(!doc||!C||!B)return ()=>{};
  if(root.__myGrassReadingV1Cleanup)return root.__myGrassReadingV1Cleanup;
  C.setReadingSessionRequired(false);C.setReadingJourneyRequired(true);
  let session=null,journey=null,journeyPhase='idle',journeyElapsed=0,journeyConfirm=false,journeyError='',activeChapter=null,chapterKey='',loadToken=0,stopped=false,observer=null;
  const cache=new Map();
  let timer=null,lastStageKey='',lastReaderSignature='',lastReaderNode=null;

  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function workspace(){return doc.getElementById('grassWorkspace')}
  function status(message){const node=workspace()?.querySelector('#gsStatus');if(node)node.textContent=message}
  function dispatchInput(node){if(node)node.dispatchEvent(new root.Event('input',{bubbles:true}))}
  function translationId(){
   const ws=workspace(),picker=ws?.querySelector('#gsTranslationPicker'),hidden=ws?.querySelector('[data-field="translation"]');
   const value=picker?.value||ws?.dataset.scriptureTranslation||hidden?.value||'';
   return value===ESV_ID||value===ESV_NAME?ESV_ID:CUV_ID;
  }
  function currentParsed(){const ref=workspace()?.querySelector('[data-field="reference"]')?.value||'';return B.parse(ref)}
  function wholeChapterReference(reference){const p=B.parse(reference);return p?B.format(p.book,p.chapter,1,1,true):reference}

  function injectStyle(){
   if(doc.getElementById('myGrassReadingV1Style'))return;
   const style=doc.createElement('style');style.id='myGrassReadingV1Style';
   style.textContent=`
#grassWorkspace .gs-reading-panel{overflow:hidden;display:flex;flex-direction:column}
#grassWorkspace .gs-reception-guide{margin:4px 2px 10px;padding:7px 9px;border-left:3px solid rgba(111,129,79,.62);font:500 12px/1.65 "PingFang SC",sans-serif;color:#70543a;background:rgba(230,209,162,.17)}
#grassWorkspace .gs-verse-reader{min-height:220px;max-height:clamp(300px,48dvh,520px);overflow:auto;padding:8px 6px 18px 2px;scrollbar-width:thin;scrollbar-color:#ae9368 transparent}
#grassWorkspace .gs-verse{display:inline;text-align:left;border:0;background:transparent;color:#4b3422;padding:1px 3px 2px 1px;margin:0;box-shadow:none;font:500 clamp(17px,1.25vw,20px)/1.95 STKaiti,KaiTi,"Songti SC",serif;cursor:pointer;border-radius:0}
#grassWorkspace .gs-verse sup{font:700 9px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:#9b7e58;margin-right:3px;vertical-align:super}
#grassWorkspace .gs-verse:hover:not(:disabled){background:rgba(204,175,119,.16)}
#grassWorkspace .gs-verse:focus-visible{outline:1px dashed #776346;outline-offset:2px}




#grassWorkspace .gs-verse:disabled{cursor:default;opacity:1}
#grassWorkspace .gs-reading-finish{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(140,105,62,.28)}
#grassWorkspace .gs-reading-finish .gs-action:disabled{opacity:.43}
.gs-nav-reading-note{margin:13px 0 2px;padding:9px 10px;border-left:3px solid #87966a;background:rgba(255,245,214,.45);font-size:12px;line-height:1.65}
@media(max-width:820px){#grassWorkspace .gs-verse-reader{max-height:none;min-height:320px}#grassWorkspace .gs-verse{font-size:18px;line-height:1.9}}
`;
   doc.head.appendChild(style);
  }


  function guideText(){
   if(journeyPhase==='recording'||journeyPhase==='finalizing')return '读完这一节，请轻点下一节。声音与经节一起前行。';
   if(journeyPhase==='completed')return '今日读经已留下真实的经节时间轨迹。';
   if(journeyPhase==='arming')return '正在开启麦克风，授权成功后才正式开始读经。';
   return '翻阅不等于读过。点一节经文，就开始今日读经与原声记录。';
  }
  function verseMarkup(v){
   const current=journey?.status==='recording'&&journeyPhase==='recording'&&v.verse===journey.endVerse;
   const read=!!journey&&journey.segments.some(x=>x.verse===v.verse&&x.endMs!==null);
   const cls=['gs-verse',current?'is-current':'',read?'is-read':''].filter(Boolean).join(' ');
   return '<button type="button" class="'+cls+'" data-action="verse-select" data-verse="'+v.verse+'" data-verse-id="'+esc(v.id)+'" '+(journeyPhase==='completed'?'disabled':'')+' aria-label="第 '+v.verse+' 节"><sup>'+v.verse+'</sup><span>'+esc(v.text)+'</span></button>';
  }
  function renderReadingStatus(){
   const node=workspace()?.querySelector('#gsReadingJourneyStatus');if(!node)return;
   const fmt=ms=>{const seconds=Math.floor(Math.max(0,ms)/1000);return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0')};
   const reference=journey?.reference||'';
   if(journeyConfirm&&journeyPhase==='recording'){
    node.innerHTML='<span class="gs-journey-status-copy">结束今日读经？ '+esc(reference)+' · '+ '<time id="gsJourneyTimer" aria-live="off">'+fmt(journeyElapsed)+'</time>' +'</span><div class="gs-journey-controls"><button type="button" data-action="continue-journey">继续读</button><button type="button" data-action="end-journey-confirm">结束</button></div>';
   }else if(journeyPhase==='recording'){
    node.innerHTML='<span class="gs-journey-status-copy"><b class="gs-journey-rec-dot" aria-hidden="true"></b>正在读经 · '+esc(journey.book+' '+journey.chapter+':'+journey.endVerse)+' · <time id="gsJourneyTimer" aria-live="off">'+fmt(journeyElapsed)+'</time></span><button type="button" data-action="end-journey-ask">■ 结束今日读经</button>';
   }else if(journeyPhase==='arming')node.textContent='正在开启麦克风…';
   else if(journeyPhase==='finalizing')node.textContent='正在保存本次读经…';
   else if(journeyPhase==='completed')node.textContent='今日读经完成 · '+reference+' · '+fmt(journeyElapsed);
   else if(journeyPhase==='error')node.textContent=journeyError||'麦克风未成功录音，请重试。';
   else node.textContent='点一节经文，开始今日读经';
   node.dataset.phase=journeyPhase;
  }
  function renderReader(){
   const ws=workspace(),reader=ws?.querySelector('#gsVerseReader'),guide=ws?.querySelector('#gsReceptionGuide');
   if(guide)guide.innerHTML=guideText();
   const signature=activeChapter?(chapterKey+'|'+(journeyPhase||'idle')+'|'+(journey?.reference||'')+'|'+(journey?.segments?.length||0)):'none';
   if(reader&&activeChapter&&(reader!==lastReaderNode||signature!==lastReaderSignature)){
    reader.innerHTML=activeChapter.verses.map(verseMarkup).join('');lastReaderSignature=signature;lastReaderNode=reader;
   }
   renderReadingStatus();
  }

  async function hydrateChapter(){
   const ws=workspace(),reader=ws?.querySelector('#gsVerseReader');if(!reader)return;
   const p=currentParsed();if(!p){reader.textContent='请先选择书卷和章节。';return}
   const tid=translationId(),key=tid+'|'+p.book+'|'+p.chapter,token=++loadToken;
   reader.innerHTML='<span class="gs-small">正在展开本章经文……</span>';
   try{
    let chapter=cache.get(key)||null;
    if(!chapter)chapter=await loadReadingChapter(p.book,p.chapter,tid);
    if(stopped||token!==loadToken||!workspace()?.querySelector('#gsVerseReader'))return;
    activeChapter=chapter;chapterKey=key;
    cache.set(key,chapter);
    renderReader();
   }catch(error){
    if(stopped||token!==loadToken)return;activeChapter=null;chapterKey='';
    const current=workspace()?.querySelector('#gsVerseReader');if(current)current.innerHTML='<span class="gs-small">'+esc(error.message||String(error))+'</span>';
   }
  }

  function enhanceNavigation(){
   const nav=doc.getElementById('gsBibleNav');if(!nav||nav.hidden)return;
   const verses=nav.querySelector('.gs-nav-verses');if(verses){verses.hidden=true;verses.style.display='none'}
   const title=nav.querySelector('#gsNavTitle');if(title)title.textContent='经卷定位';
   const warning=nav.querySelector('#gsNavWarning');if(warning)warning.textContent='定位章节不会记作读过。';
   const apply=nav.querySelector('[data-nav="apply"]');if(apply)apply.textContent='翻到这里';
   if(!nav.querySelector('.gs-nav-reading-note')){
    const note=doc.createElement('p');note.className='gs-nav-reading-note';note.textContent='先翻到这一章。真正的阅读，从你亲自点击第一节开始。';
    const fields=nav.querySelector('.gs-nav-fields');fields?.insertAdjacentElement('afterend',note);
   }
  }

  function normalizeFreshPage(){
   const ws=workspace(),ref=ws?.querySelector('[data-field="reference"]');if(!ref)return;
   const whole=wholeChapterReference(ref.value);if(!whole||whole===ref.value)return;
   ref.value=whole;dispatchInput(ref);const display=doc.getElementById('refDisplay');if(display)display.textContent=whole;
  }

  function enhanceReadingStage(){
   const ws=workspace();if(!ws)return;
   enhanceNavigation();
   const ref=ws.querySelector('[data-field="reference"]'),textarea=ws.querySelector('[data-field="scriptureText"]');
   if(!ref||!textarea)return;
   ref.readOnly=true;ref.setAttribute('aria-readonly','true');
   const label=textarea.closest('label');if(label)label.style.display='none';
   let panel=ref.closest('.gs-panel');if(panel)panel.classList.add('gs-reading-panel');
   if(!ws.querySelector('#gsReceptionGuide')){
    const anchor=label||textarea;
    const guide=doc.createElement('div');guide.id='gsReceptionGuide';guide.className='gs-reception-guide';guide.innerHTML=guideText();
    const reader=doc.createElement('div');reader.id='gsVerseReader';reader.className='gs-verse-reader';reader.setAttribute('aria-live','polite');
    const finish=doc.createElement('div');finish.className='gs-reading-finish';finish.innerHTML='<div id="gsReadingJourneyStatus" class="gs-journey-status" role="status" aria-live="polite">点一节经文，开始今日读经</div>';
    anchor.insertAdjacentElement('beforebegin',guide);guide.insertAdjacentElement('afterend',reader);reader.insertAdjacentElement('afterend',finish);
   }
   const p=currentParsed(),key=(translationId())+'|'+(p?.book||'')+'|'+(p?.chapter||'');
   if(key!==lastStageKey){lastStageKey=key;activeChapter=null;chapterKey='';hydrateChapter()}
   if(activeChapter)renderReader();
  }

  function syncAttribution(){
   const ws=workspace(),attribution=ws?.querySelector('#gsEsvAttribution');if(!attribution)return;
   const show=translationId()===ESV_ID;attribution.hidden=!show;attribution.style.display=show?'block':'none';
  }
  function syncUi(){
   if(stopped)return;enhanceNavigation();
   const ws=workspace();if(!ws)return;syncAttribution();
   if(ws.querySelector('[data-field="scriptureText"]'))enhanceReadingStage();
  }
  function schedule(delay=0){
   if(stopped)return;if(timer)root.clearTimeout(timer);timer=root.setTimeout(()=>{timer=null;syncUi()},delay);
  }

  function clearAudioFollow(){
   const ws=workspace(),reader=ws?.querySelector('#gsVerseReader');
   ws?.querySelectorAll('.gs-verse.is-following').forEach(node=>node.classList.remove('is-following'));
   reader?.classList.remove('is-audio-following');
  }
  function keepFollowVisible(button){
   const reader=workspace()?.querySelector('#gsVerseReader');if(!reader||!button)return;
   const outer=reader.getBoundingClientRect?.(),inner=button.getBoundingClientRect?.();
   if(!outer||!inner)return;
   if(inner.top<outer.top||inner.bottom>outer.bottom)button.scrollIntoView?.({block:'nearest',inline:'nearest'});
  }
  function onAudioProgress(event){
   const detail=event?.detail||{};clearAudioFollow();
   if(detail.state==='ended'||detail.state==='cleared')return;
   if(journey?.status!=='completed'||!activeChapter)return;
   const verse=C.journeyVerseAt(journey,Math.round((detail.currentTime||0)*1000));
   if(verse==null)return;
   workspace()?.querySelector('#gsVerseReader')?.classList.add('is-audio-following');
   const button=workspace()?.querySelector('.gs-verse[data-verse="'+verse+'"]');if(!button)return;
   button.classList.add('is-following');
   if(detail.state==='playing')keepFollowVisible(button);
  }

  function pointFromButton(button){
   const p=currentParsed();if(!p)throw Error('请先翻到一个有效章节。');
   const verse=Number(button.dataset.verse),verseId=String(button.dataset.verseId||'');
   return {book:p.book,chapter:p.chapter,verse,verseId,translation:activeChapter?.translation||(translationId()===ESV_ID?ESV_NAME:CUV_NAME)};
  }

  function selectVerse(button){
   if(!activeChapter){status('本章经文仍在载入，请稍候。');return}
   const point=pointFromButton(button);
   if(journeyPhase==='idle'||journeyPhase==='error'){
    if(journey?.status==='completed'){status('本次已完成，请新开一页开始下一次读经。');return}
    journeyPhase='arming';journeyConfirm=false;renderReader();
    doc.dispatchEvent(new root.CustomEvent('mygrass:journey-start-request',{detail:{point}}));
    return;
   }
   if(journeyPhase!=='recording'||journeyConfirm||!journey)return;
   if(point.verse===journey.endVerse)return;
   if(point.verse!==journey.endVerse+1){status('当前正在读第'+journey.endVerse+'节，请从下一节继续。');return}
   doc.dispatchEvent(new root.CustomEvent('mygrass:journey-advance-request',{detail:{point}}));
  }
  function onJourneyState(event){
   const d=event.detail||{};journeyPhase=d.phase||'idle';journey=d.journey||null;journeyElapsed=d.elapsedMs||0;journeyError=d.error||'';
   if(journeyPhase!=='recording')journeyConfirm=false;
   if(journey?.status==='completed'){
    C.setRuntimeReadingJourney(journey);
    const matchingChapter=chapterKey===(journey.translation===ESV_NAME?ESV_ID:CUV_ID)+'|'+journey.book+'|'+journey.chapter;
    if(matchingChapter){
     const ws=workspace(),ref=ws?.querySelector('[data-field="reference"]'),textarea=ws?.querySelector('[data-field="scriptureText"]');
     const chosen=activeChapter.verses.filter(v=>v.verse>=journey.startVerse&&v.verse<=journey.endVerse);
     if(ref){ref.value=journey.reference;dispatchInput(ref)}
     const display=doc.getElementById('refDisplay');if(display)display.textContent=journey.reference;
     if(textarea&&chosen.length===journey.verseIds.length){
      textarea.value=activeChapter.storage==='reference-only'?'':chosen.map(v=>v.text).join('\n');
      textarea.dataset.verseIds=journey.verseIds.join(',');
      dispatchInput(textarea);
     }
    }
   }
   renderReader();
  }
  function onJourneyTick(event){
   if(journeyPhase!=='recording')return;journeyElapsed=event.detail?.elapsedMs||0;
   const time=workspace()?.querySelector('#gsJourneyTimer');
   if(time&&!journeyConfirm){const n=Math.floor(journeyElapsed/1000);time.textContent=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}

  }

  function onClick(event){
   const button=event.target.closest?.('button');if(!button)return;
   if(button.matches('[data-nav="apply"]')&&!journey){
    const text=workspace()?.querySelector('[data-field="scriptureText"]');
    if(text&&(text.dataset.scriptureSource||text.dataset.scriptureState==='ready')){
     text.value='';delete text.dataset.scriptureSource;delete text.dataset.verseIds;delete text.dataset.scriptureState;dispatchInput(text);
    }
    return;
   }
   if(button.matches('[data-nav="apply"]')&&journey){
    event.preventDefault();event.stopImmediatePropagation();
    const warning=doc.querySelector('#gsNavWarning');if(warning)warning.textContent=['arming','recording','finalizing'].includes(journeyPhase)?'请先结束今日读经，再翻到另一章。':'本次读经已完成；请先「新开一页」，再翻到另一章。';return;
   }
   const action=button.dataset.action;
   if(action==='verse-select'){event.preventDefault();event.stopImmediatePropagation();selectVerse(button);return}
   if(action==='end-journey-ask'){event.preventDefault();event.stopImmediatePropagation();journeyConfirm=true;renderReadingStatus();return}
   if(action==='continue-journey'){event.preventDefault();event.stopImmediatePropagation();journeyConfirm=false;renderReadingStatus();return}
   if(action==='end-journey-confirm'){event.preventDefault();event.stopImmediatePropagation();if(!journeyConfirm)return;journeyConfirm=false;doc.dispatchEvent(new root.CustomEvent('mygrass:journey-end-request'));return}
   if(action==='next-reflection'&&journeyPhase!=='completed'){
    event.preventDefault();event.stopImmediatePropagation();status('请先完成本次阅读，再进入默想。');return;
   }
   if(action==='new'){
    session=null;journey=null;journeyPhase='idle';journeyConfirm=false;activeChapter=null;chapterKey='';lastStageKey='';lastReaderSignature='';lastReaderNode=null;C.setRuntimeReadingJourney(null);C.setRuntimeReadingSession(null);
    root.setTimeout(()=>{normalizeFreshPage();schedule(0)},0);
   }
  }
  function onChange(event){
   if(event.target.id==='gsTranslationPicker'){
    if(journey){
     event.preventDefault();event.stopImmediatePropagation();
     event.target.value=journey.translation===ESV_NAME?ESV_ID:CUV_ID;
     status('本次阅读已经与当前译本绑定；如要换译本，请新开一页。');return;
    }
    activeChapter=null;chapterKey='';lastStageKey='';loadToken++;root.setTimeout(()=>schedule(20),0);
   }
  }

  injectStyle();
  doc.addEventListener('click',onClick,true);doc.addEventListener('change',onChange,true);
  doc.addEventListener('mygrass:reading-audio-progress',onAudioProgress);
  doc.addEventListener('mygrass:journey-state',onJourneyState);
  doc.addEventListener('mygrass:journey-tick',onJourneyTick);
  const Mutation=root.MutationObserver;
  if(Mutation&&doc.documentElement){observer=new Mutation(()=>schedule(0));observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']})}
  if(root.__myGrassJourneySnapshot)onJourneyState({detail:root.__myGrassJourneySnapshot});
  normalizeFreshPage();schedule(0);
  const cleanup=()=>{
   stopped=true;if(timer)root.clearTimeout(timer);loadToken++;observer?.disconnect();
   doc.removeEventListener('click',onClick,true);doc.removeEventListener('change',onChange,true);
   doc.removeEventListener('mygrass:reading-audio-progress',onAudioProgress);
   doc.removeEventListener('mygrass:journey-state',onJourneyState);
   doc.removeEventListener('mygrass:journey-tick',onJourneyTick);clearAudioFollow();
   C.setRuntimeReadingSession(null);C.setReadingSessionRequired(false);C.setReadingJourneyRequired(false);delete root.__myGrassReadingV1Cleanup;
  };
  root.__myGrassReadingV1Cleanup=cleanup;return cleanup;
 }
 function autoInstall(root){
  const run=()=>install(root);
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 }
 return Object.freeze({parseEsvNumberedText,verseForAudioProgress,loadReadingChapter,install,autoInstall});
});
