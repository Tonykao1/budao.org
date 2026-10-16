/* 我的牧草 · 经卷领受 V1
 * 浏览章节 ≠ 正式阅读。第一次点击经节才开始；再次点击定下结束节；明确完成后才形成阅读记录。
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
  C.setReadingSessionRequired(true);
  let session=null,activeChapter=null,chapterKey='',loadToken=0,stopped=false,observer=null;
  const cache=new Map();
  let timer=null,lastStageKey='',lastReaderSignature='';

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
#grassWorkspace .gs-verse.is-range{background:linear-gradient(to bottom,transparent 66%,rgba(161,181,112,.23) 66%,rgba(161,181,112,.23) 91%,transparent 91%)}
#grassWorkspace .gs-verse.is-start sup,#grassWorkspace .gs-verse.is-end sup{color:#53683f;font-weight:900}
#grassWorkspace .gs-verse.is-start:before{content:"◆";font-size:7px;color:#718458;margin-right:3px;vertical-align:middle}
#grassWorkspace .gs-verse.is-end:not(.is-start):after{content:"◆";font-size:7px;color:#718458;margin-left:3px;vertical-align:middle}
#grassWorkspace .gs-verse:disabled{cursor:default;opacity:1}
#grassWorkspace .gs-reading-finish{display:flex;align-items:center;gap:9px;flex-wrap:wrap;padding-top:8px;border-top:1px solid rgba(140,105,62,.28)}
#grassWorkspace .gs-reading-finish .gs-action:disabled{opacity:.43}
.gs-nav-reading-note{margin:13px 0 2px;padding:9px 10px;border-left:3px solid #87966a;background:rgba(255,245,214,.45);font-size:12px;line-height:1.65}
@media(max-width:820px){#grassWorkspace .gs-verse-reader{max-height:none;min-height:320px}#grassWorkspace .gs-verse{font-size:18px;line-height:1.9}}
`;
   doc.head.appendChild(style);
  }

  function guideText(){
   if(!session)return '翻阅和滚动本身不会记作读过。点击一节，<strong>从这一节开始</strong>。';
   if(session.status==='reading')return '已从 <strong>'+esc(session.reference.split('–')[0])+'</strong> 开始。继续读，再点击你真正读到的最后一节。';
   return '本次真实阅读已完成：<strong>'+esc(session.reference)+'</strong>。';
  }
  function verseMarkup(v){
   const start=session?.startVerse,end=session?.endVerse;
   const inRange=!!session&&v.verse>=start&&v.verse<=end;
   const cls=['gs-verse',v.verse===start?'is-start':'',v.verse===end?'is-end':'',inRange?'is-range':''].filter(Boolean).join(' ');
   const label=!session?'从这一节开始':session.status==='reading'?(v.verse<start?'起始节之前':v.verse===start?'起始节':'把这里作为结束节'):'已完成的阅读';
   return '<button type="button" class="'+cls+'" data-action="verse-select" data-verse="'+v.verse+'" data-verse-id="'+esc(v.id)+'" '+(session?.status==='completed'?'disabled':'')+' aria-label="第 '+v.verse+' 节，'+label+'"><sup>'+v.verse+'</sup><span>'+esc(v.text)+'</span></button>';
  }
  function renderReader(){
   const ws=workspace(),reader=ws?.querySelector('#gsVerseReader'),guide=ws?.querySelector('#gsReceptionGuide'),finish=ws?.querySelector('[data-action="complete-reading"]'),badge=ws?.querySelector('#gsReadingDoneBadge');
   if(guide)guide.innerHTML=guideText();
   const signature=activeChapter?(chapterKey+'|'+(session?.status||'idle')+'|'+(session?.startVerse||'')+'|'+(session?.endVerse||'')):'none';
   if(reader&&activeChapter&&signature!==lastReaderSignature){reader.innerHTML=activeChapter.verses.map(verseMarkup).join('');lastReaderSignature=signature}
   if(finish)finish.disabled=session?.status!=='reading';
   if(badge){badge.hidden=session?.status!=='completed';badge.textContent=session?.status==='completed'?'已完成 · '+session.reference:''}
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
    const finish=doc.createElement('div');finish.className='gs-reading-finish';finish.innerHTML='<button class="gs-action" type="button" data-action="complete-reading" disabled>完成本次阅读</button><span class="gs-badge" id="gsReadingDoneBadge" hidden></span>';
    anchor.insertAdjacentElement('beforebegin',guide);guide.insertAdjacentElement('afterend',reader);reader.insertAdjacentElement('afterend',finish);
   }
   const p=currentParsed(),key=(translationId())+'|'+(p?.book||'')+'|'+(p?.chapter||'');
   if(key!==lastStageKey){lastStageKey=key;activeChapter=null;chapterKey='';hydrateChapter()}
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

  function pointFromButton(button){
   const p=currentParsed();if(!p)throw Error('请先翻到一个有效章节。');
   const verse=Number(button.dataset.verse),verseId=String(button.dataset.verseId||'');
   return {book:p.book,chapter:p.chapter,verse,verseId,translation:activeChapter?.translation||(translationId()===ESV_ID?ESV_NAME:CUV_NAME)};
  }
  function selectVerse(button){
   if(!activeChapter){status('本章经文仍在载入，请稍候。');return}
   try{
    const point=pointFromButton(button);
    if(!session){session=C.beginReadingSession(point,new Date().toISOString());status('已从 '+session.reference+' 开始。读到哪里，再点击那一节。')}
    else if(session.status==='reading'){session=C.setReadingSessionEnd(session,point);status('本次阅读暂定到 '+session.reference+'。完成时请按「完成本次阅读」。')}
    else{status('这次阅读已经完成；如要开始新的阅读，请「新开一页」。');return}
    C.setRuntimeReadingSession(session);renderReader();
   }catch(error){status(error.message||String(error))}
  }
  function completeReading(){
   if(!activeChapter){status('本章经文仍在载入，请稍候。');return}
   try{
    const done=C.completeReadingSession(session,new Date().toISOString());
    const selected=activeChapter.verses.filter(v=>v.verse>=done.startVerse&&v.verse<=done.endVerse);
    if(selected.length!==done.verseIds.length)throw Error('经节范围尚未完整载入，请稍后再试。');
    session=done;C.setRuntimeReadingSession(session);
    const ws=workspace(),ref=ws?.querySelector('[data-field="reference"]'),textarea=ws?.querySelector('[data-field="scriptureText"]');
    if(ref){ref.value=done.reference;dispatchInput(ref)}
    const display=doc.getElementById('refDisplay');if(display)display.textContent=done.reference;
    if(textarea){textarea.value=activeChapter.storage==='reference-only'?'':selected.map(v=>v.text).join('\n');textarea.dataset.verseIds=done.verseIds.join(',');dispatchInput(textarea)}
    status('已完成本次阅读：'+done.reference+'。现在可以留下领受，或继续默想。');renderReader();
   }catch(error){status(error.message||String(error))}
  }

  function onClick(event){
   const button=event.target.closest?.('button');if(!button)return;
   if(button.matches('[data-nav="apply"]')&&!session){
    const text=workspace()?.querySelector('[data-field="scriptureText"]');
    if(text&&(text.dataset.scriptureSource||text.dataset.scriptureState==='ready')){
     text.value='';delete text.dataset.scriptureSource;delete text.dataset.verseIds;delete text.dataset.scriptureState;dispatchInput(text);
    }
    return;
   }
   if(button.matches('[data-nav="apply"]')&&session){
    event.preventDefault();event.stopImmediatePropagation();
    const warning=doc.querySelector('#gsNavWarning');if(warning)warning.textContent=session.status==='reading'?'请先完成本次阅读，再翻到另一章。':'本次阅读已完成；请先「新开一页」，再翻到另一章。';return;
   }
   const action=button.dataset.action;
   if(action==='verse-select'){event.preventDefault();event.stopImmediatePropagation();selectVerse(button);return}
   if(action==='complete-reading'){event.preventDefault();event.stopImmediatePropagation();completeReading();return}
   if(action==='next-reflection'&&session?.status!=='completed'){
    event.preventDefault();event.stopImmediatePropagation();status('请先完成本次阅读，再进入默想。');return;
   }
   if(action==='new'){
    session=null;activeChapter=null;chapterKey='';lastStageKey='';lastReaderSignature='';C.setRuntimeReadingSession(null);
    root.setTimeout(()=>{normalizeFreshPage();schedule(0)},0);
   }
  }
  function onChange(event){
   if(event.target.id==='gsTranslationPicker'){
    if(session){
     event.preventDefault();event.stopImmediatePropagation();
     event.target.value=session.translation===ESV_NAME?ESV_ID:CUV_ID;
     status('本次阅读已经与当前译本绑定；如要换译本，请新开一页。');return;
    }
    activeChapter=null;chapterKey='';lastStageKey='';loadToken++;root.setTimeout(()=>schedule(20),0);
   }
  }

  injectStyle();
  doc.addEventListener('click',onClick,true);doc.addEventListener('change',onChange,true);
  const Mutation=root.MutationObserver;
  if(Mutation&&doc.documentElement){observer=new Mutation(()=>schedule(0));observer.observe(doc.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden']})}
  normalizeFreshPage();schedule(0);
  const cleanup=()=>{
   stopped=true;if(timer)root.clearTimeout(timer);loadToken++;observer?.disconnect();
   doc.removeEventListener('click',onClick,true);doc.removeEventListener('change',onChange,true);
   C.setRuntimeReadingSession(null);C.setReadingSessionRequired(false);delete root.__myGrassReadingV1Cleanup;
  };
  root.__myGrassReadingV1Cleanup=cleanup;return cleanup;
 }
 function autoInstall(root){
  const run=()=>install(root);
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 }
 return Object.freeze({parseEsvNumberedText,loadReadingChapter,install,autoInstall});
});
