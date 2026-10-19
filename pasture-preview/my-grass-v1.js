/* 我的牧草 V0.1 — three stages inside the approved pixel scroll. */
(function () {
  'use strict';
  const C=window.MyGrassCore, B=window.MyGrassBible;
  const book=document.querySelector('#bookLayer .book-object');
  const entryButton=document.getElementById('grassBookBtn');
  if(!C||!B||!book||!entryButton)return;

  const root=document.createElement('section');
  root.id='grassWorkspace';
  root.setAttribute('aria-label','我的牧草：领受、沉淀与牧养');
  root.innerHTML='<span class="gs-sr-only">我的牧草正在开启</span>';
  book.appendChild(root);
  const bibleNav=document.createElement('section');
  bibleNav.id='gsBibleNav';bibleNav.hidden=true;bibleNav.setAttribute('aria-label','圣经经文导航');
  book.appendChild(bibleNav);
  const $=s=>root.querySelector(s);
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const randomId=()=>window.crypto?.randomUUID?.()||('grass-'+Date.now()+'-'+Math.floor(Math.random()*1e9));
  const iso=()=>new Date().toISOString();
  const datetime=s=>{try{return new Date(s).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}catch(e){return String(s||'')}};
  const PREFIX=C.STORAGE_PREFIX;
  // The function-zone keeps a legacy in-memory shim; devotional records must instead
  // persist through the same-origin, card-scoped bridge hosted by the parent preview.
  // Direct standalone opening falls back to this document's own browser storage.
  function getStored(k){
    try{
      if(window.parent!==window&&window.parent.MyGrassBridge){
        const result=window.parent.MyGrassBridge.read(k);
        if(result!==null)return result;
      }
    }catch(e){}
    try{return window.localStorage.getItem(k)}catch(e){return null}
  }
  function setStored(k,v){
    if(window.parent!==window){
      try{
        if(window.parent.MyGrassBridge)return window.parent.MyGrassBridge.write(k,v);
      }catch(e){throw Error('本机档案尚未成功保存：'+String(e.message||e))}
    }
    return window.localStorage.setItem(k,v);
  }
  function getJson(k,fallback){try{const v=JSON.parse(getStored(k)||'null');return v==null?fallback:v}catch(e){return fallback}}
  function writeJson(k,v){setStored(k,JSON.stringify(v))}
  function cardIdentity(){return getJson('budao_pixel_card_activation_prototype_v1',{phase:'guest'})}
  function emptyDraft(ref){return {
   id:randomId(),
   scripture:{reference:ref||'',text:'',translation:'',source:'',verifiedAgainstRecording:false},
   reading:{audioId:null,mimeType:null,size:0,durationSeconds:0},
   reflection:'',readingJourney:null
  }}
  let scope='',key='',draft,entries=[],micros=[],tab='reading',archiveOpen=false,editingSavedId=null;
  let recorder=null,recordStream=null,recordChunks=[],recordStart=0,recordLimit=null,activeAudioURL=null,activePlayer=null;
  let audioPending=false,notice='';
  let journey=null,journeyPhase='idle',journeyStartedClock=0,journeyFinalMs=0,journeyTickTimer=null,journeyStopTimer=null,journeyStream=null,journeyRecorder=null,journeyChunks=[],journeyError='';

  // Full canonical navigation restores the previous testament/book/chapter/verse picker.
  // Passage text is still entered by the user; no unauthorized translation is bundled.
  let navState={testament:'new',book:'路',chapter:6,start:1,end:11,whole:false};
  function paintBibleNav(){
    const group=B.groups[navState.testament];
    if(!B.resolve(navState.book)||B.groupOf(navState.book)!==navState.testament)
      navState.book=group[0][0];
    const selected=B.resolve(navState.book);
    navState.chapter=B.clampChapter(navState.book,navState.chapter);
    const books=group.map(([abbr,name])=>'<option value="'+escape(abbr)+'" '+(navState.book===abbr?'selected':'')+'>'+
      escape(name)+'</option>').join('');
    const chapters=Array.from({length:selected[2]},(_,i)=>i+1)
      .map(n=>'<option value="'+n+'" '+(navState.chapter===n?'selected':'')+'>'+n+'</option>').join('');
    bibleNav.innerHTML='<div class="gs-nav-card" role="dialog" aria-modal="true" aria-labelledby="gsNavTitle">'+
      '<div class="gs-nav-top"><h2 id="gsNavTitle">经文定位</h2><button type="button" data-nav="close" aria-label="关闭导航">×</button></div>'+
      '<div class="gs-nav-testament" role="group" aria-label="旧约或新约">'+
      '<button type="button" data-nav="testament" data-value="old" aria-pressed="'+(navState.testament==='old')+'">旧约</button>'+
      '<button type="button" data-nav="testament" data-value="new" aria-pressed="'+(navState.testament==='new')+'">新约</button></div>'+
      '<div class="gs-nav-fields"><label>书卷<select id="gsNavBook" aria-label="圣经书卷">'+books+'</select></label>'+
      '<label>章<select id="gsNavChapter" aria-label="章节">'+chapters+'</select></label></div>'+
      '<div class="gs-nav-verses"><label>起始节<input type="number" min="1" max="176" id="gsNavFrom" value="'+navState.start+'" '+(navState.whole?'disabled':'')+'></label>'+
      '<label>结束节<input type="number" min="1" max="176" id="gsNavTo" value="'+navState.end+'" '+(navState.whole?'disabled':'')+'></label>'+
      '<label class="gs-nav-whole"><input type="checkbox" id="gsNavWhole" '+(navState.whole?'checked':'')+'>整章</label></div>'+
      '<div class="gs-nav-bottom"><span id="gsNavWarning" role="status">请选择经文范围</span>'+
      '<button class="gs-nav-apply" type="button" data-nav="apply">定下</button></div></div>';
  }
  function showBibleNav(){if(['arming','recording','finalizing'].includes(journeyPhase)){tell('正在读经，请先结束本次录音。');return}
    if(recorder?.state==='recording'){tell('请先结束朗读录音，再切换经文。');return}
    navState=B.parse(draft.scripture.reference)||{testament:'new',book:'路',chapter:6,start:1,end:11,whole:false};
    paintBibleNav();bibleNav.hidden=false;
    bibleNav.querySelector('#gsNavBook')?.focus();
  }
  function closeBibleNav(){bibleNav.hidden=true}
  function setNavWarning(v){const target=bibleNav.querySelector('#gsNavWarning');if(target)target.textContent=v}
  function readNavNumbers(){
    navState.book=bibleNav.querySelector('#gsNavBook').value;
    navState.chapter=Number(bibleNav.querySelector('#gsNavChapter').value);
    navState.whole=bibleNav.querySelector('#gsNavWhole').checked;
    navState.start=Number(bibleNav.querySelector('#gsNavFrom').value);
    navState.end=Number(bibleNav.querySelector('#gsNavTo').value);
  }
  function commitBibleNav(){if(['arming','recording','finalizing'].includes(journeyPhase)){tell('正在读经，不能更换章节。');return}
    readNavNumbers();
    let reference;
    try{reference=B.format(navState.book,navState.chapter,navState.start,navState.end,navState.whole)}
    catch(e){setNavWarning(String(e.message||e));return}
    if(reference!==C.trim(draft.scripture.reference)){
      const saved=getEntry();
      const hasContent=!!(C.trim(draft.scripture.text)||C.trim(draft.reflection)||draft.reading.audioId);
      const changed=saved&&(saved.scripture.text!==C.trim(draft.scripture.text)||
        saved.reflection?.text!==C.trim(draft.reflection)||
        saved.scripture.reference!==C.trim(draft.scripture.reference)||
        saved.reading?.audioId!==draft.reading.audioId);
      if(hasContent&&(!saved||changed)){
        setNavWarning('先保存当前文字及录音，再切换经文。');return;
      }
      if(saved){
        clearPlayer();draft=emptyDraft(reference);editingSavedId=null;microDraft='';
      }else{
        draft.scripture.reference=reference;
        draft.scripture.verifiedAgainstRecording=false;
      }
    }
    const original=document.getElementById('refDisplay');
    if(original)original.textContent=reference;
    persistDraft();closeBibleNav();render();tell('已定位 '+reference);
  }
  bibleNav.addEventListener('click',e=>{
    const action=e.target.closest('button[data-nav]');if(!action)return;
    switch(action.dataset.nav){
     case 'close':closeBibleNav();break;
     case 'testament':
      navState.testament=action.dataset.value;
      navState.book=B.groups[navState.testament][0][0];
      navState.chapter=1;navState.start=1;navState.end=1;
      paintBibleNav();break;
     case 'apply':commitBibleNav();break;
    }
  });
  bibleNav.addEventListener('change',e=>{
    if(e.target.id==='gsNavBook'){navState.book=e.target.value;navState.chapter=1;paintBibleNav()}
    else if(e.target.id==='gsNavChapter')navState.chapter=Number(e.target.value);
    else if(e.target.id==='gsNavWhole'){
      navState.whole=e.target.checked;
      bibleNav.querySelector('#gsNavFrom').disabled=navState.whole;
      bibleNav.querySelector('#gsNavTo').disabled=navState.whole;
    }
  });
  bibleNav.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.stopPropagation();closeBibleNav()}
  });

  function tell(v){notice=v;const node=$('#gsStatus');if(node)node.textContent=v}
  function persistentKeys(){
   return {entries:key+'.entries',micros:key+'.micros',draft:key+'.draft',legacy:key+'.legacyImported'};
  }
  function refFromOriginal(){return (document.getElementById('refDisplay')?.textContent||'').trim();}
  function persistDraft(){try{writeJson(persistentKeys().draft,draft)}catch(e){tell('本机存储不可用。请先复制重要内容到安全位置。')}}
  function loadForIdentity(){
   const current=C.scopeFromIdentity(cardIdentity());
   if(current===scope&&draft)return;
   if(recorder&&recorder.state==='recording'){try{recorder.stop()}catch(_){}}
   scope=current;key=PREFIX+'.'+scope;
   const names=persistentKeys();
   entries=getJson(names.entries,[]);if(!Array.isArray(entries))entries=[];
   micros=getJson(names.micros,[]);if(!Array.isArray(micros))micros=[];
   draft=getJson(names.draft,null)||emptyDraft(refFromOriginal());
   editingSavedId=entries.some(e=>e.id===draft.id)?draft.id:null;
   // One-time import of a previously saved 48-character parchment note.
   // Its Scripture text/audio are unknown and are NOT fabricated.
   if(!getStored(names.legacy)&&scope!=='unassigned-preview'){
    const old=getJson('budao-grass-preview',null);
    if(old?.note&&old?.ref&&!entries.some(e=>e.reflection?.text===old.note&&e.scripture?.reference===old.ref)){
     const now=old.date?(String(old.date).slice(0,10)+'T12:00:00.000Z'):iso();
     entries.push({version:1,id:randomId(),createdAt:now,updatedAt:now,
      scripture:{reference:old.ref,text:'',translation:'',source:'legacy-preview',enteredBy:'user',verifiedAgainstRecording:false},
      reading:{kind:'original-human-voice',audioId:null,mimeType:null,size:0,durationSeconds:0,trainingConsent:false,syntheticVoiceConsent:false,publicationConsent:false},
      reflection:{source:'user-authored',text:old.note},shareIds:[],legacy:true});
     writeJson(names.entries,entries);
    }
    setStored(names.legacy,'1');
   }
  }
  function saveAll(){writeJson(persistentKeys().entries,entries);writeJson(persistentKeys().micros,micros)}
  function getEntry(){return entries.find(e=>e.id===draft.id)||null;}
  function saveEntry(){
   if(audioPending||recorder?.state==='recording'||['arming','recording','finalizing'].includes(journeyPhase)){tell('请先结束今日读经，再保存领受。');return null}
   if(!draft.readingJourney&&draft.reading.audioId&&!draft.scripture.verifiedAgainstRecording){tell('这次旧版原声还没有与经文建立绑定。');return null}
   const previous=getEntry(),input={scripture:draft.scripture,reflection:draft.reflection,reading:draft.reading,readingJourney:draft.readingJourney||null};
   try{
    const next=previous?C.reviseEntry(previous,input,iso()):C.newEntry(input,iso(),draft.id);
    if(previous)entries=entries.map(e=>e.id===next.id?next:e);
    else entries.unshift(next);
    editingSavedId=next.id;
    saveAll();persistDraft();tell('已保存到本机个人古卷。经文文字、原声和笔记已建立关联。');
    return next;
   }catch(e){tell(e.message||String(e));return null}
  }
  function setTab(next){if(!C.PHASES.includes(next))return;if(['arming','recording','finalizing'].includes(journeyPhase)){tell('请先结束今日读经。');return}closeBibleNav();tab=next;archiveOpen=false;render();}
  function insertArchiveText(){
   const groups=C.groupByReference(entries);
   if(!groups.length)return '<p class="gs-empty">还没有正式保存的记录。每一次真实阅读，都可以从这里开始。</p>';
   return '<div class="gs-archive">'+groups.map(g=>'<div><h4>'+escape(g.reference)+'</h4>'+
    g.entries.map(e=>'<button type="button" data-action="open-entry" data-id="'+escape(e.id)+'" aria-current="'+(draft.id===e.id)+'">'+
    '<strong>'+escape((e.reflection?.text||e.scripture.text||'尚待补录').slice(0,42))+'</strong>'+
    '<span class="gs-archive-date">'+escape(datetime(e.createdAt))+(e.legacy?' · 旧版笔记已保留':'')+'</span></button>').join('')+'</div>').join('')+'</div>';
  }
  function recordingSelectionReady(){
 const badge=$('#gsReadingDoneBadge');
 return !!(C.trim(draft.scripture.reference)&&badge&&!badge.hidden);
}
function recorderUiState(){
 if(journeyPhase==='recording')return 'recording';
 if(journeyPhase==='arming')return 'arming';
 if(journeyPhase==='finalizing')return 'finalizing';
 if(draft.readingJourney?.status==='completed')return activePlayer&&!activePlayer.paused&&!activePlayer.ended?'playing':'linked';
 if(draft.reading.audioId&&draft.scripture.verifiedAgainstRecording)return activePlayer&&!activePlayer.paused&&!activePlayer.ended?'playing':'linked';
 if(draft.reading.audioId)return 'recorded';
 return 'idle';
}
function recorderStatusText(){
 const state=recorderUiState();
 if(state==='recording')return '● REC · '+String(Math.floor(journeyElapsedMs()/60000)).padStart(2,'0')+':'+String(Math.floor(journeyElapsedMs()/1000)%60).padStart(2,'0')+' · 正在读经';
 if(state==='arming')return 'MIC · 正在开启麦克风';
 if(state==='finalizing')return 'SAVE · 正在保存本次读经';
 if(state==='playing')return 'PLAY · 正在回听';
 if(state==='linked')return 'LINKED · 已与 '+escape(draft.scripture.reference)+' 绑定';
 if(state==='recorded')return 'RECORDED · 请按右侧链接键';
 return 'READY · 先完成左侧经文阅读';
}
function stageReading(){
 const barHeights=Array.from({length:22},(_,i)=>10+Math.round(Math.abs(Math.sin(i*1.41)*Math.cos(i*.53))*46));
 const state=recorderUiState(),hasAudio=!!draft.reading.audioId,linked=!!draft.scripture.verifiedAgainstRecording||draft.readingJourney?.status==='completed';
 const recordDisabled=audioPending||hasAudio;
 const playDisabled=!hasAudio||!linked;
 const rerecordDisabled=!hasAudio;
 const linkDisabled=!hasAudio||linked;
 return '<div class="gs-grid"><section class="gs-panel" aria-label="圣经文字">'+
  '<div class="gs-scripture-heading"><div class="gs-scripture-titlecluster"><h3>今日经文</h3>'+
  '<input class="gs-scripture-reference" data-field="reference" maxlength="96" aria-label="经文出处" value="'+escape(draft.scripture.reference)+'"></div>'+
  '<div class="gs-scripture-controls"><button class="gs-action secondary gs-scripture-nav-button" type="button" data-action="scripture-nav" aria-label="旧约新约、书卷和章节导航">选经文</button>'+
  '<input data-field="translation" maxlength="64" value="'+escape(draft.scripture.translation)+'" hidden></div></div>'+
  '<textarea data-field="scriptureText" maxlength="10000" hidden>'+escape(draft.scripture.text)+'</textarea></section>'+
  '<section class="gs-panel gs-recording-panel" aria-label="今日读经原声"><h3>今日读经</h3>'+
  '<div class="gs-recorder-console" data-state="'+state+'">'+
    '<div class="gs-recorder-deck"><div class="gs-recorder-brand"><strong>ORIGINAL VOICE</strong><span>LOCAL RECORDER</span></div>'+
     '<div class="gs-recorder-keys gs-journey-keys"><span class="gs-recorder-key gs-journey-rec-indicator" aria-live="off"><span class="gs-recorder-key-icon">●</span><span>REC</span></span>'+
      '<button class="gs-recorder-key" type="button" data-action="play" '+(playDisabled?'disabled':'')+' aria-label="回听本人今日读经"><span class="gs-recorder-key-icon">▶Ⅱ</span><span>回听/暂停</span></button>'+
     '</div></div>'+
    '<div class="gs-recorder-display"><div class="gs-recorder-screen" id="gsRecorderScreen" data-state="'+state+'">'+
      '<div class="gs-recorder-wave" aria-hidden="true">'+barHeights.map((v,i)=>'<span style="--h:'+v+'%;--i:'+i+'"></span>').join('')+'</div>'+
      '<div class="gs-recorder-status" id="gsRecorderStatus">'+recorderStatusText()+'</div></div>'+
    '</div>'+
  '</div>'+
  '<div id="gsAudioHost" class="gs-audio-host" aria-live="polite"></div>'+
  '<p class="gs-recorder-note">'+(state==='recording'?'正在连续录音。读完一节，请直接点击下一节经文。':state==='arming'?'正在取得麦克风权限…':state==='finalizing'?'正在封存本人原声与经节时间线…':linked?'已保存真实读经轨迹，可以回听。':'请点击左侧一节经文，开始今日读经。')+'</p>'+
  '<div class="gs-rule"></div><div class="gs-actions">'+
  '<button class="gs-action" type="button" data-action="save">留下领受</button>'+
  '<button class="gs-action secondary" type="button" data-action="next-reflection">继续默想 →</button></div></section></div>';
}
function stageReflection(){
   return '<div class="gs-grid">'+
    '<section class="gs-panel" aria-label="默想对应经文"><h3>经文 · '+escape(draft.scripture.reference||'尚未定位')+'</h3>'+
    '<div class="gs-scripture-read">'+escape(draft.scripture.text||'请先在「领受」中选择经文，并录入今日阅读的文字。')+'</div>'+
    '<button class="gs-smallbutton" type="button" data-action="tab" data-tab="reading">返回经文</button></section>'+
    '<section class="gs-panel" aria-label="个人默想笔记"><h3>我的默想</h3>'+
    '<label class="gs-field">留给自己的一页<textarea class="gs-large gs-reflection" rows="9" maxlength="12000" data-field="reflection" placeholder="今天，这段经文让我想到……">'+escape(draft.reflection)+'</textarea></label>'+
    '<span class="gs-small">原始笔记 · 默认私密</span>'+
    '<div class="gs-actions"><button class="gs-action" type="button" data-action="save">保存默想</button>'+
    '<button class="gs-action secondary" type="button" data-action="next-sharing">一粒牧草 →</button></div>'+
    '<div class="gs-rule"></div><span class="gs-badge">专属声音 · 待单独授权后接入</span></section></div>';
  }
  function stageSharing(){
   const saved=getEntry(),associated=micros.filter(m=>m.entryId===draft.id);
   return '<div class="gs-grid">'+
    '<section class="gs-panel" aria-label="原始默想母本"><h3>默想母本</h3>'+
    '<div class="gs-small">'+escape(draft.scripture.reference||'尚未定位')+'</div>'+
    '<div class="gs-note-source">'+escape(draft.reflection||'还没有写下默想。')+'</div>'+
    '<div class="gs-actions"><button class="gs-smallbutton" type="button" data-action="tab" data-tab="reflection">回到默想</button>'+
    '<span class="gs-badge">'+(saved?'母本已保存':'先保存母本')+'</span></div></section>'+
    '<section class="gs-panel" aria-label="微分享私藏"><h3>一粒牧草</h3>'+
    '<label class="gs-field">一句真实的领受<textarea id="gsMicroText" class="gs-micro" maxlength="120" placeholder="一句话，也可以成为他人的祝福。">'+escape(microDraft)+'</textarea></label>'+
    '<div class="gs-meter" id="gsMicroCount">'+C.count(microDraft)+' / 80字</div>'+
    '<div class="gs-actions"><button class="gs-action secondary" type="button" data-action="suggest-micro">摘取一句</button>'+
    '<button class="gs-action" type="button" data-action="save-micro" '+(!saved?'disabled':'')+'>私人收藏</button></div>'+
    '<div class="gs-rule"></div><h4>已留下</h4>'+
    (associated.length?'<div class="gs-archive">'+associated.map(m=>
      '<button type="button" data-action="copy-micro" data-id="'+escape(m.id)+'">'+escape(m.text)+
      '<span class="gs-archive-date">'+escape(datetime(m.createdAt))+' · 私密 · 点击复制</span></button>').join('')+'</div>':
      '<div class="gs-empty">还没有留下微分享。</div>')+'</section></div>';
  }
  let microDraft='';
  function render(){
   if(!document.body.classList.contains('grassbook-open'))return;
   const tabs=[['reading','领受'],['reflection','沉淀'],['sharing','牧养']];
   root.innerHTML=
    '<header class="gs-head"><div class="gs-head-title">我的牧草</div>'+
    '<nav class="gs-steps" aria-label="我的牧草三个阶段">'+tabs.map(([id,name])=>
      '<button type="button" data-action="tab" data-tab="'+id+'" aria-selected="'+(tab===id)+'">'+name+'</button>').join('')+'</nav></header>'+
    '<main class="gs-stage">'+(archiveOpen?
      '<div class="gs-grid"><section class="gs-panel"><h3>个人古卷</h3>'+insertArchiveText()+'</section>'+
      '<section class="gs-panel"><h3>经文重逢</h3><div class="gs-empty">每一次真实的领受，都有自己的时间与声音。</div></section></div>':
      tab==='reading'?stageReading():tab==='reflection'?stageReflection():stageSharing())+'</main>'+
    '<footer class="gs-foot"><span>本机私密 · 原声与文字可导出</span>'+
    '<div class="gs-actions"><button class="gs-smallbutton" type="button" data-action="export">导出档案</button>'+
    '<button class="gs-smallbutton" type="button" data-action="'+(archiveOpen?'return-stage':'archive')+'">'+(archiveOpen?'返回':'翻阅档案')+'</button></div></footer>'+
    '<div class="gs-status" id="gsStatus" role="status" aria-live="polite">'+escape(notice)+'</div>';
   if(tab==='reading'&&!archiveOpen&&draft.reading.audioId&&(draft.scripture.verifiedAgainstRecording||draft.readingJourney?.status==='completed'))restoreAudio(draft.reading.audioId);
  }
  // The sound blob is a separate original asset; it is NEVER treated as voice-model consent.
  function audioDatabase(){
   return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(Error('当前浏览器无法保存原始音频。'));
    const open=indexedDB.open(PREFIX+'.audio',1);
    open.onupgradeneeded=()=>{if(!open.result.objectStoreNames.contains('recordings'))open.result.createObjectStore('recordings',{keyPath:'id'})};
    open.onerror=()=>reject(open.error||Error('音频库开启失败'));
    open.onsuccess=()=>resolve(open.result);
   });
  }
  async function putAudio(id,blob){
   const db=await audioDatabase();
   try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('recordings','readwrite');
    tx.objectStore('recordings').put({id,owner:scope,blob,createdAt:iso(),mimeType:blob.type});
    tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
   })}finally{db.close()}
  }
  async function getAudio(id){
   const db=await audioDatabase();
   try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction('recordings','readonly');
    const request=tx.objectStore('recordings').get(id);
    request.onsuccess=()=>resolve(request.result?.owner===scope?request.result.blob:null);
    request.onerror=()=>reject(request.error);
   })}finally{db.close()}
  }
  function broadcastReadingAudioProgress(state,player){
   const duration=Number(player?.duration),currentTime=Number(player?.currentTime);
   document.dispatchEvent(new CustomEvent('mygrass:reading-audio-progress',{detail:{state,currentTime:Number.isFinite(currentTime)?currentTime:0,duration:Number.isFinite(duration)?duration:0,audioId:draft.reading.audioId||null}}));
  }
  function clearPlayer(){
   if(activePlayer)broadcastReadingAudioProgress('cleared',activePlayer);
   try{activePlayer?.pause?.()}catch(_){}
   activePlayer=null;
   if(activeAudioURL){URL.revokeObjectURL(activeAudioURL);activeAudioURL=null}
  }
  async function restoreAudio(id){
 const host=$('#gsAudioHost');if(!host||!id)return null;
 try{
  const blob=await getAudio(id);
  if(!$('#gsAudioHost'))return null;
  if(!blob){host.textContent='本机没有找到对应原声。请重新录制。';return null}
  clearPlayer();activeAudioURL=URL.createObjectURL(blob);
  const player=document.createElement('audio');player.preload='metadata';player.src=activeAudioURL;player.hidden=true;player.dataset.audioId=id;
  activePlayer=player;host.replaceChildren(player);
  const sync=()=>{
   const state=player.ended||player.paused?'linked':'playing';
   const consoleNode=$('.gs-recorder-console'),screen=$('#gsRecorderScreen'),status=$('#gsRecorderStatus');
   if(consoleNode)consoleNode.dataset.state=state;if(screen)screen.dataset.state=state;
   if(status)status.textContent=state==='playing'?'PLAY · 正在回听':'LINKED · 已与 '+draft.scripture.reference+' 绑定';
  };
  player.addEventListener('play',()=>{sync();broadcastReadingAudioProgress('playing',player)});
  player.addEventListener('timeupdate',()=>broadcastReadingAudioProgress(player.ended?'ended':player.paused?'paused':'playing',player));
  player.addEventListener('pause',()=>{sync();if(!player.ended)broadcastReadingAudioProgress('paused',player)});
  player.addEventListener('ended',()=>{sync();broadcastReadingAudioProgress('ended',player)});
  return player;
 }catch(e){host.textContent='无法读取本机原声：'+String(e.message||e);return null}
}
async function deleteAudio(id){
 if(!id)return;
 const db=await audioDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').delete(id);
  tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 })}finally{db.close()}
}
async function togglePlayback(){
 if(!draft.reading.audioId){tell('还没有可回听的本人原声。');return}
 if(!draft.scripture.verifiedAgainstRecording&&draft.readingJourney?.status!=='completed'){tell('这份旧版原声尚未与经文绑定。');return}
 let player=activePlayer;
 if(!player||player.dataset.audioId!==draft.reading.audioId)player=await restoreAudio(draft.reading.audioId);
 if(!player)return;
 if(player.paused||player.ended){if(player.ended)player.currentTime=0;await player.play().catch(()=>{})}
 else player.pause();
}
function linkRecording(){
 if(!draft.reading.audioId){tell('请先完成一次本人原声录音。');return}
 const reference=C.trim(draft.scripture.reference);
 if(!reference){tell('请先选择左侧经文。');return}
 if(!window.confirm('确认将这次本人原声与「'+reference+'」建立绑定吗？绑定后才能回听。'))return;
 draft.scripture.verifiedAgainstRecording=true;persistDraft();render();tell('已建立经文与本人原声的绑定，可以回听。');
}
async function rerecordAudio(){
 if(!draft.reading.audioId){await startOrStopRecording();return}
 if(!window.confirm('确定放弃这次录音并重新录制吗？当前这份原声会从本机删除。'))return;
 const oldId=draft.reading.audioId;clearPlayer();
 try{await deleteAudio(oldId)}catch(e){tell('旧录音清理失败，请稍后再试。');return}
 draft.reading={audioId:null,mimeType:null,size:0,durationSeconds:0};
 draft.scripture.verifiedAgainstRecording=false;persistDraft();
 tell('旧录音已放弃，准备重新录制。');await startOrStopRecording();
}
  async function startOrStopRecording(){
   if(recorder?.state==='recording'){recorder.stop();return}
   if(audioPending)return;
   if(draft.reading.audioId){tell('已经有一份录音；如要替换，请使用「↻ 重录」。');return}
   if(!recordingSelectionReady()){tell('请先完成左侧经文的阅读选择，再开始录音。');return}
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){tell('当前浏览器不支持麦克风录音。仍可保存文字；建议换用支持录音的浏览器。');return}
   audioPending=true;
   try{
    const stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported?.(t));
    recordStream=stream;recordChunks=[];
    recorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
    recorder.ondataavailable=e=>{if(e.data&&e.data.size>0)recordChunks.push(e.data)};
    recorder.onerror=e=>tell('录音出现错误：'+String(e.error?.message||e.error||'未知原因'));
    recorder.onstop=async()=>{
      if(recordLimit)clearTimeout(recordLimit);
      stream.getTracks().forEach(t=>t.stop());recordStream=null;
      const elapsed=Math.max(1,Math.round((Date.now()-recordStart)/1000));
      const blob=new Blob(recordChunks,{type:recorder.mimeType||recordChunks[0]?.type||'audio/webm'});
      if(!blob.size){audioPending=false;tell('没有取得有效录音，请重新尝试。');render();return}
      if(blob.size>20*1024*1024){audioPending=false;tell('这段录音超过20MB，请分段朗读并保存。');render();return}
      const audioId=scope+':'+draft.id+':'+randomId();
      try{
       await putAudio(audioId,blob);
       draft.reading={audioId,mimeType:blob.type,size:blob.size,durationSeconds:elapsed};
       draft.scripture.verifiedAgainstRecording=false;persistDraft();
       tell('录音完成并保存在本机。请按右侧链接键，与当前经文建立绑定后再回听。');
      }catch(e){tell('音频保存失败：'+String(e.message||e)+'。请检查存储权限或剩余空间。')}
      finally{audioPending=false;render()}
    };
    recordStart=Date.now();recorder.start(250);
    recordLimit=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop()},15*60*1000);
    tell('正在录制本人朗读（最长15分钟）。结束后音频只保存在此浏览器。');
   }catch(e){
    recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;
    tell(e.name==='NotAllowedError'?'没有取得麦克风许可；你仍可继续纯文字灵修。':'麦克风开启失败：'+String(e.message||e));
   }finally{audioPending=false;render()}
  }
  function openSavedEntry(id){
   const found=entries.find(e=>e.id===id);if(!found)return;
   if(recorder?.state==='recording'||['arming','recording','finalizing'].includes(journeyPhase)){tell('请先结束今日读经，再翻阅档案。');return}
   draft={id:found.id,scripture:{...found.scripture},reading:{...found.reading},readingJourney:found.readingJourney||null,
    reflection:found.reflection?.text||''};
   journey=draft.readingJourney;journeyPhase=journey?.status==='completed'?'completed':'idle';C.setRuntimeReadingJourney(journey);emitJourneyState();
   editingSavedId=found.id;microDraft='';persistDraft();archiveOpen=false;tab='reading';
   tell('已翻开 '+found.scripture.reference+' 的灵修档案。');render();
  }
  function openNewEntry(){
   if(recorder?.state==='recording'||['arming','recording','finalizing'].includes(journeyPhase)){tell('请先结束今日读经。');return}
   clearPlayer();draft=emptyDraft(refFromOriginal());journey=null;journeyPhase='idle';journeyFinalMs=0;C.setRuntimeReadingJourney(null);emitJourneyState();editingSavedId=null;microDraft='';
   archiveOpen=false;tab='reading';persistDraft();tell('已开启新的一份牧草；既有档案不会被覆盖。');render();
  }
  async function saveMicro(){
   const origin=getEntry();
   if(!origin){tell('请先保存原始经文和默想，再留下微分享。');return}
   if(origin.reflection.text!==C.normalizeReflection(draft.reflection)||origin.scripture.text!==C.trim(draft.scripture.text)||origin.scripture.reference!==C.trim(draft.scripture.reference)){
    tell('母本内容已修改。请先保存最新经文和默想，再从这份准确的母本制作微分享。');return;
   }
   try{
    const m=C.makeMicro(origin,microDraft,randomId(),iso());
    micros.unshift(m);
    entries=entries.map(e=>e.id===origin.id?{...e,shareIds:[...(e.shareIds||[]),m.id]}:e);
    saveAll();tell('一粒牧草已加入个人私人收藏；没有公开发布。');microDraft='';render();
   }catch(e){tell(e.message||String(e))}
  }
  function downloadBlob(blob,name){
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download=name;
   a.style.display='none';document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function exportTextArchive(){
   const payload={format:'budao-my-grass',version:1,exportedAt:iso(),identityScope:scope,
    notice:'此处保存了经文出处、用户录入的文字、本人笔记及私人微分享；音频属于独立二进制资产，请分别使用导出原声。',
    entries,micros};
   const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
   downloadBlob(blob,'我的牧草-文字档案-'+new Date().toISOString().slice(0,10)+'.json');
   tell('文字档案已导出。原始朗读请通过对应记录的「导出原声」单独保存。');
  }
  async function exportAudio(){
   if(!draft.reading.audioId){tell('当前记录还没有本机朗读音频。');return}
   try{
    const blob=await getAudio(draft.reading.audioId);
    if(!blob){tell('本机未找到这份朗读音频。');return}
    const ext=blob.type.includes('mp4')?'m4a':blob.type.includes('ogg')?'ogg':'webm';
    downloadBlob(blob,'我的牧草-本人原声-'+draft.id+'.'+ext);
    tell('原始朗读已单独导出，不会上传，也不代表授权训练语音模型。');
   }catch(e){tell('音频导出失败：'+String(e.message||e))}
  }
  async function copyMicro(id){
   const item=micros.find(m=>m.id===id);if(!item)return;
   const message=item.reference+'\n'+item.text+'\n（本人确认的私人微分享草稿）';
   try{await navigator.clipboard.writeText(message);tell('已复制这粒牧草。是否发送给任何人，由你自己决定。')}
   catch(e){tell('复制不可用。内容仍安全保留在当前个人档案中。')}
  }

  // The current verse and continuous microphone recording are ONE Reading Journey.
  function journeyElapsedMs(){return Math.max(0,Math.round(performance.now()-journeyStartedClock))}
  function emitJourneyState(){
   const detail={phase:journeyPhase,journey,elapsedMs:journeyPhase==='recording'?journeyElapsedMs():journeyFinalMs,error:journeyError};
   window.__myGrassJourneySnapshot=detail;
   document.dispatchEvent(new CustomEvent('mygrass:journey-state',{detail}));
  }
  function emitJourneyTick(){
   if(journeyPhase!=='recording'||!journey)return;
   document.dispatchEvent(new CustomEvent('mygrass:journey-tick',{detail:{
    elapsedMs:journeyElapsedMs(),currentVerse:journey.endVerse
   }}));
   const status=$('#gsRecorderStatus');
   if(status)status.textContent=recorderStatusText();
  }
  function releaseJourneyStream(){
   journeyStream?.getTracks().forEach(t=>t.stop());journeyStream=null;
   if(journeyStopTimer){clearTimeout(journeyStopTimer);journeyStopTimer=null}
   if(journeyTickTimer){clearInterval(journeyTickTimer);journeyTickTimer=null}
  }
  function journeyFail(message){
   releaseJourneyStream();journeyPhase='error';journeyError=message;
   tell(message);emitJourneyState();render();
  }
  async function startJourney(point){
   if(['arming','recording','finalizing'].includes(journeyPhase))return;
   if(draft.readingJourney?.status==='completed'||draft.reading.audioId){tell('这次读经已有原声，请新开一页开始新的读经。');return}
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){journeyFail('当前浏览器无法录音；请使用支持麦克风录音的浏览器。');return}
   try{C.startReadingJourney(point,iso())}catch(e){tell(e.message);return}
   journeyPhase='arming';journeyError='';emitJourneyState();render();
   let stream;
   try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    if(journeyPhase!=='arming'){stream.getTracks().forEach(t=>t.stop());return}
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported?.(t));
    journeyStream=stream;journeyChunks=[];
    journeyRecorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
    journeyRecorder.ondataavailable=e=>{if(e.data?.size>0)journeyChunks.push(e.data)};
    journeyRecorder.onerror=e=>journeyFail('读经录音已中断：'+String(e.error?.message||'设备错误'));
    journeyRecorder.onstart=()=>{
     if(journeyPhase!=='arming')return;
     journeyStartedClock=performance.now();
     journey=C.startReadingJourney(point,iso());
     journeyPhase='recording';C.setRuntimeReadingJourney(journey);
     journeyTickTimer=setInterval(emitJourneyTick,250);
     journeyStopTimer=setTimeout(()=>finishJourney(),15*60*1000);
     emitJourneyState();render();emitJourneyTick();
    };
    journeyRecorder.onstop=async()=>{
     releaseJourneyStream();
     if(journeyPhase!=='finalizing'){journeyFail('录音意外中断，未将尚未完成的读经记为已读。');return}
     const blob=new Blob(journeyChunks,{type:journeyRecorder.mimeType||journeyChunks[0]?.type||'audio/webm'});
     if(!blob.size||blob.size>20*1024*1024){journeyFail(!blob.size?'没有取得有效原声，读经尚未保存。':'录音超过20MB，请重新分段读经。');return}
     const audioId=scope+':'+draft.id+':'+randomId();
     try{
      await putAudio(audioId,blob);
      const metadata={audioId,mimeType:blob.type,size:blob.size,durationSeconds:journeyFinalMs/1000};
      journey=C.completeReadingJourney(journey,journeyFinalMs,iso(),metadata);
      C.setRuntimeReadingJourney(journey);
      draft.readingJourney=journey;
      draft.reading={audioId,mimeType:blob.type,size:blob.size,durationSeconds:journeyFinalMs/1000};
      draft.scripture.reference=journey.reference;draft.scripture.translation=journey.translation;
      draft.scripture.verifiedAgainstRecording=false;
      persistDraft();journeyPhase='completed';journeyError='';
      emitJourneyState();const archived=saveEntry();render();tell(archived?'今日读经已封存到个人古卷：'+journey.reference+'。可以回听，或继续默想。':'原声已保存，但档案未能自动归档。请点击「留下领受」重试。');
     }catch(e){journeyFail('保存本次读经失败：'+String(e.message||e))}
    };
    journeyRecorder.start(250);
   }catch(e){
    stream?.getTracks().forEach(t=>t.stop());
    journeyFail(e.name==='NotAllowedError'?'没有取得麦克风许可，尚未开始记录读经。':'无法开始读经录音：'+String(e.message||e));
   }
  }
  function advanceJourney(point){
   if(journeyPhase!=='recording'||!journey)return;
   try{journey=C.advanceReadingJourney(journey,point,journeyElapsedMs());C.setRuntimeReadingJourney(journey);emitJourneyState();emitJourneyTick()}
   catch(e){tell(e.message||String(e))}
  }
  function finishJourney(){
   if(journeyPhase!=='recording'||!journey||journeyRecorder?.state!=='recording')return;
   journeyFinalMs=journeyElapsedMs();journeyPhase='finalizing';emitJourneyState();render();
   try{journeyRecorder.stop()}catch(e){journeyFail('录音停止失败：'+String(e.message||e))}
  }
  document.addEventListener('mygrass:journey-start-request',e=>{void startJourney(e.detail?.point)});
  document.addEventListener('mygrass:journey-advance-request',e=>advanceJourney(e.detail?.point));
  document.addEventListener('mygrass:journey-end-request',()=>finishJourney());
  window.addEventListener('beforeunload',e=>{if(['arming','recording','finalizing'].includes(journeyPhase)){e.preventDefault();e.returnValue=''}});

  root.addEventListener('input',e=>{
   const field=e.target.dataset.field;
   const v=e.target.value;
   if(field==='reference'||field==='translation'||field==='scriptureText'){
    draft.scripture[field==='scriptureText'?'text':field]=v;persistDraft();
   }else if(field==='reflection'){draft.reflection=v;persistDraft()}
   else if(e.target.id==='gsMicroText'){
    microDraft=v;const node=$('#gsMicroCount');if(node)node.textContent=C.count(v)+' / 80字';
   }
  });
  root.addEventListener('click',async e=>{
   const b=e.target.closest('button[data-action]');if(!b)return;
   switch(b.dataset.action){
    case 'tab': setTab(b.dataset.tab);break;
    case 'scripture-nav': showBibleNav();break;
    case 'record':await startOrStopRecording();break;
    case 'play':await togglePlayback();break;
    case 'rerecord':await rerecordAudio();break;
    case 'link-audio':linkRecording();break;
    case 'download-audio':await exportAudio();break;
    case 'export':exportTextArchive();break;
    case 'save':saveEntry();break;
    case 'next-reflection':if(journeyPhase!=='completed'){tell('请先完成今日读经。');break}setTab('reflection');break;
    case 'next-sharing':setTab('sharing');break;
    case 'archive':if(['arming','recording','finalizing'].includes(journeyPhase)){tell('请先结束今日读经。');break}archiveOpen=true;render();break;
    case 'return-stage':archiveOpen=false;render();break;
    case 'open-entry':openSavedEntry(b.dataset.id);break;
    case 'new':openNewEntry();break;
    case 'suggest-micro':
      microDraft=C.clip(draft.reflection,80);
      if(!microDraft){tell('请先写下自己的默想。');return}
      if($('#gsMicroText')){$('#gsMicroText').value=microDraft;$('#gsMicroCount').textContent=C.count(microDraft)+' / 80字'}
      tell('已从原始笔记摘出开头一段；请亲自审阅并修改，不会自动发布。');break;
    case 'save-micro':await saveMicro();break;
    case 'copy-micro':await copyMicro(b.dataset.id);break;
   }
  });
  // Do not introduce a fourth main module: history/new entry are utilities in the footer.
  function addNewEntryControl(){
   const foot=root.querySelector('.gs-foot');
   if(!foot||foot.querySelector('[data-action="new"]'))return;
   const button=document.createElement('button');button.type='button';button.className='gs-smallbutton';
   button.dataset.action='new';button.textContent='新开一页';
   foot.prepend(button);
  }
  const originalRender=render;
  render=function(){originalRender();addNewEntryControl()};
  entryButton.addEventListener('click',()=>{
   loadForIdentity();render();
  });
  window.addEventListener('pagehide',()=>{
   if(recorder?.state==='recording')recorder.stop();
   clearPlayer();
   recordStream?.getTracks().forEach(t=>t.stop());
  });
  // Init lazily: the main pasture iframe may be present before its six-axis identity is assigned.
  root.hidden=false;
  loadForIdentity();journey=draft.readingJourney||null;journeyPhase=journey?.status==='completed'?'completed':'idle';journeyFinalMs=journey?.durationMs||0;C.setRuntimeReadingJourney(journey);emitJourneyState();
  render();
})();
