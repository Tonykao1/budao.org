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
  // An email-authenticated resident receives a new, isolated local storage namespace.
  // No prototype card state or shared guest scope can unlock a private folio.
  function residentAccess(){return window.PastureResidentGate?.canUseGrass?.()===true}
  function residentScope(){
   if(!residentAccess())return null;
   const id=String(window.PastureResidentGate?.getResident?.()?.id||'');
   return /^[a-f0-9-]{36}$/i.test(id)?'pasture-resident-'+id.toLowerCase():null;
  }
  function emptyDraft(ref){return {
   id:randomId(),
   scripture:{reference:ref||'',text:'',translation:'',source:'',verifiedAgainstRecording:false},
   reading:{audioId:null,mimeType:null,size:0,durationSeconds:0},
   reflection:'',readingJourney:null,insightDraft:{heardText:'',todayText:''},insightRecord:null,lightDraft:{}
  }}
  let scope='',key='',draft,entries=[],micros=[],tab='reading',archiveOpen=false,editingSavedId=null;
  let recorder=null,recordStream=null,recordChunks=[],recordStart=0,recordLimit=null,activeAudioURL=null,activePlayer=null;
  let audioPending=false,notice='',lightGraph={relations:[],events:[]},focusLight=null;
  // DSP controls are transient audition settings, never archive mutations.
  let denoiseEnabled=false,denoiseStrength=35,denoiseMonitor=null,denoiseRequest=0;
  let denoisePending=null;
  let audioRestoreToken=0,audioRestorePending=null; // single active private recording load
  // EQ is a temporary listening preference, never stored with the voice master.
  let eqEnabled=false,eqBands={low:0,mid:0,high:0};
  let compEnabled=false,compThreshold=-24,compRatio=2.5; // transient monitoring only
  let reverbEnabled=false,reverbRoom=40,reverbMix=16; // speech-sized room, % wet
  let rerecordOriginal=null; // Keep original audio until replacement is fully saved.
  let journeyAttemptToken=0; // A discarded take cannot revive itself through late recorder events.
  let journey=null,journeyPhase='idle',journeyStartedClock=0,journeyPauseTotal=0,journeyPausedClock=null,journeyFinalMs=0,journeyTickTimer=null,journeyStopTimer=null,journeyStream=null,journeyRecorder=null,journeyChunks=[],journeyError='';

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
  function showBibleNav(){if(['arming','recording','paused','finalizing'].includes(journeyPhase)){tell('正在读经，请先结束本次录音。');return}
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
  function commitBibleNav(){if(['arming','recording','paused','finalizing'].includes(journeyPhase)){tell('正在读经，不能更换章节。');return}
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
   return {entries:key+'.entries',micros:key+'.micros',draft:key+'.draft',graph:key+'.lightGraph',legacy:key+'.legacyImported'};
  }
  function refFromOriginal(){return (document.getElementById('refDisplay')?.textContent||'').trim();}
  function persistDraft(){try{writeJson(persistentKeys().draft,draft)}catch(e){tell('本机存储不可用。请先复制重要内容到安全位置。')}}
  function loadForIdentity(){
   const current=residentScope();
   if(!current)return false;
   if(current===scope&&draft)return true;
   if(recorder&&recorder.state==='recording'){try{recorder.stop()}catch(_){}}
   if(scope&&scope!==current){clearPlayer();denoiseEnabled=false;denoiseStrength=35;eqEnabled=false;eqBands={low:0,mid:0,high:0};compEnabled=false;compThreshold=-24;compRatio=2.5;reverbEnabled=false;reverbRoom=40;reverbMix=16;}
   scope=current;key=PREFIX+'.'+scope;
   const names=persistentKeys();
   entries=getJson(names.entries,[]);if(!Array.isArray(entries))entries=[];
   micros=getJson(names.micros,[]);if(!Array.isArray(micros))micros=[];
   draft=getJson(names.draft,null)||emptyDraft(refFromOriginal());
   editingSavedId=entries.some(e=>e.id===draft.id)?draft.id:null;
   const savedEntry=entries.find(e=>e.id===draft.id);
   draft.insightRecord=savedEntry?.insightRecord||draft.insightRecord||null;
   draft.insightDraft=draft.insightRecord?{heardText:draft.insightRecord.heard_text,todayText:draft.insightRecord.today_text}:(draft.insightDraft||{heardText:'',todayText:''});
   draft.lightDraft=draft.lightDraft||{};
   const storedGraph=getJson(names.graph,null);
   lightGraph={relations:Array.isArray(storedGraph?.relations)?storedGraph.relations:[],events:Array.isArray(storedGraph?.events)?storedGraph.events:[]};
   focusLight=null;
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
   return true;
  }
  function saveAll(){writeJson(persistentKeys().entries,entries);writeJson(persistentKeys().micros,micros)}
  function getEntry(){return entries.find(e=>e.id===draft.id)||null;}
  function saveEntry(){
   if(!residentAccess()||!residentScope()){tell('请先使用本人步道卡激活牧草。');return null}
   if(audioPending||recorder?.state==='recording'||['arming','recording','paused','finalizing'].includes(journeyPhase)){tell('请先结束今日读经，再保存领受。');return null}
   if(!draft.readingJourney&&draft.reading.audioId&&!draft.scripture.verifiedAgainstRecording){tell('这次旧版原声还没有与经文建立绑定。');return null}
   const previous=getEntry(),input={scripture:draft.scripture,reflection:draft.reflection,reading:draft.reading,readingJourney:draft.readingJourney||null};
   try{
    const next=previous?C.reviseEntry(previous,input,iso()):C.newEntry(input,iso(),draft.id);
    if(previous)entries=entries.map(e=>e.id===next.id?next:e);
    else entries.unshift(next);
    editingSavedId=next.id;
    if(draft.insightRecord)next.insightRecord=draft.insightRecord;
    entries=entries.map(e=>e.id===next.id?next:e);
    saveAll();persistDraft();tell(draft.insightRecord?'领受已与本次原声读经一同收入个人古卷。':'今日读经和原声已收入个人古卷；领受可以随后形成。');
    return next;
   }catch(e){tell(e.message||String(e));return null}
  }
  function setTab(next){
   if(!C.PHASES.includes(next))return;
   if(['arming','recording','paused','finalizing'].includes(journeyPhase)){tell('请先结束今日读经。');return}
   const legacy=!!getEntry()&&!draft.readingJourney;
   if(next==='reflection'&&journeyPhase!=='completed'&&!legacy){tell('请先完成本人原声读经。');return}
   if(next==='sharing'&&!draft.insightRecord&&!legacy){tell('请先写下领受，并点亮中心「领」。');return}
   focusLight=null;closeBibleNav();tab=next;archiveOpen=false;render();
  }
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
 if(journeyPhase==='paused')return 'paused';
 if(journeyPhase==='arming')return 'arming';
 if(journeyPhase==='finalizing')return 'finalizing';
 if(rerecordOriginal)return 'ready';
 if(draft.readingJourney?.status==='completed')return activePlayer&&!activePlayer.paused&&!activePlayer.ended?'playing':'linked';
 if(draft.reading.audioId&&draft.scripture.verifiedAgainstRecording)return activePlayer&&!activePlayer.paused&&!activePlayer.ended?'playing':'linked';
 if(draft.reading.audioId)return 'recorded';
 return 'idle';
}
function recorderStatusText(){
 const state=recorderUiState();
 if(state==='recording')return '● REC · '+String(Math.floor(journeyElapsedMs()/60000)).padStart(2,'0')+':'+String(Math.floor(journeyElapsedMs()/1000)%60).padStart(2,'0')+' · 正在读经';
 if(state==='paused')return 'Ⅱ PAUSED · '+String(Math.floor(journeyFinalMs/60000)).padStart(2,'0')+':'+String(Math.floor(journeyFinalMs/1000)%60).padStart(2,'0')+' · 已暂停';
 if(state==='arming')return 'MIC · 正在开启麦克风';
 if(state==='finalizing')return 'SAVE · 正在保存本次读经';
 if(state==='playing')return 'PLAY · 正在回听';
 if(state==='linked')return 'LINKED · 已与 '+escape(draft.scripture.reference)+' 绑定';
 if(state==='recorded')return 'RECORDED · 请按右侧链接键';
 return 'READY · 先完成左侧经文阅读';
}

  // Sound path renders only recorded verse boundaries. Never infer them from text length.
  function soundPathModel(value){
   if(value?.status!=='completed'||!Array.isArray(value.segments)||!value.segments.length)return null;
   const total=Number(value.durationMs ?? value.segments.at(-1)?.endMs);
   if(!Number.isFinite(total)||total<=0)return null;
   const segments=value.segments.map(s=>({
    verse:Number(s.verse),start:Number(s.startMs),end:Number(s.endMs),
    verseId:String(s.verseId||'')
   }));
   if(segments[0].start!==0||Math.abs(segments.at(-1).end-total)>1||
      segments.some((s,i)=>!Number.isInteger(s.verse)||s.verse<1||!Number.isFinite(s.start)||!Number.isFinite(s.end)||
       s.start<0||s.end<=s.start||s.end>total||(i>0&&(s.start!==segments[i-1].end||s.verse!==segments[i-1].verse+1))))return null;
   return {total,segments:segments.map(s=>({...s,left:s.start/total*100,width:(s.end-s.start)/total*100}))};
  }
  function voiceReunionEntries(){
   const current=draft.readingJourney;
   if(!current?.book||!current?.chapter)return [];
   const first=current.startVerse,last=current.endVerse;
   return entries.filter(e=>{
    const j=e.readingJourney;
    return e.id!==draft.id&&j?.status==='completed'&&!!e.reading?.audioId&&
      j.book===current.book&&j.chapter===current.chapter&&j.translation===current.translation&&
      Number(j.startVerse)<=last&&Number(j.endVerse)>=first;
   }).sort((a,b)=>String(b.readingJourney?.completedAt||b.createdAt||'').localeCompare(String(a.readingJourney?.completedAt||a.createdAt||'')));
  }
  function voiceYearRingView(){
   const saved=!!draft.reading.audioId&&draft.readingJourney?.status==='completed';
   const prior=saved?voiceReunionEntries():[];
   const archivedAt=draft.readingJourney?.completedAt||getEntry()?.createdAt||null;
   return '<section class="gs-voice-yearring" aria-label="生命年轮 · 私人原声档案">'+
    '<div class="gs-yearring-head"><h4>生命年轮</h4><small>年月里的重逢</small></div>'+
    '<div class="gs-yearring-content"><div class="gs-yearring-seal" aria-hidden="true"><span>声</span></div>'+
     '<div class="gs-yearring-summary"><strong>'+(saved?'此刻已留声':'静候第一道声迹')+'</strong>'+
      '<span>'+(saved?escape(draft.scripture.reference)+' · '+escape(archivedAt?datetime(archivedAt):'本次读经'):'完成本次原声读经，开始你的生命年轮')+'</span>'+
      '<small>原声仅存于当前浏览器，尚无云端备份</small></div></div>'+
    (prior.length?'<div class="gs-yearring-reunions"><span>这段经文与 '+prior.length+' 份往昔记录相遇</span>'+
      prior.slice(0,2).map(e=>'<span class="gs-yearring-memory">'+escape(datetime(e.readingJourney?.completedAt||e.createdAt))+' · '+escape(e.scripture.reference||e.readingJourney.reference)+'</span>').join('')+'</div>':
     '<p class="gs-yearring-poem">今日留声，来日重逢。历史尚未自动跨设备保存。</p>')+
    '<div class="gs-yearring-actions"><button type="button" data-action="download-audio" '+(!saved?'disabled':'')+'>单独保存原声</button>'+
     '<button type="button" data-action="archive">翻阅生命古卷</button></div></section>';
  }

function stageReading(){
 const barHeights=Array.from({length:22},(_,i)=>10+Math.round(Math.abs(Math.sin(i*1.41)*Math.cos(i*.53))*46));
 const state=recorderUiState(),hasAudio=!!draft.reading.audioId,linked=!!draft.scripture.verifiedAgainstRecording||draft.readingJourney?.status==='completed';
 const recordDisabled=audioPending||hasAudio;
 const playDisabled=!hasAudio||!linked||!!rerecordOriginal||['arming','recording','paused','finalizing'].includes(journeyPhase);
 const canRerecord=!!draft.readingJourney&&draft.readingJourney.status==='completed'&&hasAudio&&!draft.insightRecord&&!getEntry()?.insightRecord;
 const rerecordDisabled=audioPending||!canRerecord||['arming','recording','paused','finalizing'].includes(journeyPhase);
 const linkDisabled=!hasAudio||linked;
 return '<div class="gs-grid"><section class="gs-panel" aria-label="圣经文字">'+
  '<div class="gs-scripture-heading"><div class="gs-scripture-titlecluster"><h3>今日经文</h3>'+
  '<input class="gs-scripture-reference" data-field="reference" maxlength="96" aria-label="经文出处" value="'+escape(draft.scripture.reference)+'"></div>'+
  '<div class="gs-scripture-controls"><button class="gs-action secondary gs-scripture-nav-button" type="button" data-action="scripture-nav" aria-label="旧约新约、书卷和章节导航">选经文</button>'+
  '<input data-field="translation" maxlength="64" value="'+escape(draft.scripture.translation)+'" hidden></div></div>'+
  '<textarea data-field="scriptureText" maxlength="10000" hidden>'+escape(draft.scripture.text)+'</textarea></section>'+
  '<section class="gs-panel gs-recording-panel gs-voice-station" aria-label="今日读经原声"><h3>今日读经</h3><span class="gs-voice-hidden-brand" aria-hidden="true">ORIGINAL VOICE</span>'+

  '<div class="gs-voice-scripture">'+escape(draft.scripture.reference||'请选择经文')+'</div>'+
  '<div class="gs-recorder-console gs-voice-tape-deck" data-state="'+state+'">'+

    '<div class="gs-recorder-deck">'+
     '<div class="gs-recorder-keys gs-journey-keys"><span class="gs-recorder-key gs-journey-rec-indicator" aria-live="off"><span class="gs-recorder-key-icon">●</span><span>REC</span></span>'+
      '<button class="gs-recorder-key" type="button" data-action="play" '+(playDisabled?'disabled':'')+' aria-label="回听本人今日读经"><span class="gs-recorder-key-icon">▶Ⅱ</span><span>回听/暂停</span></button>'+
      (['arming','recording','paused'].includes(journeyPhase)?
       '<button class="gs-recorder-key gs-recorder-rerecord" type="button" data-action="restart-current-take" aria-label="放弃这遍，从第一节重新开始"><span class="gs-recorder-key-icon">↻</span><span>这遍重来</span></button>':
       rerecordOriginal&&['idle','error'].includes(journeyPhase)?
       '<button class="gs-recorder-key gs-recorder-rerecord" type="button" data-action="cancel-rerecord" aria-label="取消重新录音并恢复原声"><span class="gs-recorder-key-icon">↶</span><span>保留原声</span></button>':
       '<button class="gs-recorder-key gs-recorder-rerecord" type="button" data-action="rerecord" '+(rerecordDisabled?'disabled':'')+' aria-label="重新录制本次读经"><span class="gs-recorder-key-icon">↻</span><span>重新录音</span></button>')+
     '</div></div>'+
    '<div class="gs-recorder-display"><div class="gs-recorder-screen" id="gsRecorderScreen" data-state="'+state+'">'+
      '<div class="gs-recorder-wave" aria-hidden="true">'+barHeights.map((v,i)=>'<span style="--h:'+v+'%;--i:'+i+'"></span>').join('')+'</div>'+
      '<div class="gs-recorder-status" id="gsRecorderStatus">'+recorderStatusText()+'</div></div>'+
    '</div>'+
  '</div>'+
  '<div class="gs-voice-dsp" aria-label="四合一音频机架">'+
    '<div class="gs-voice-dsp-heading"><strong>VOICE DSP / 4-IN-1</strong><small>仅试听 · 分享时生成</small></div>'+
    '<div class="gs-voice-dsp-channels">'+
      '<div class="gs-voice-dsp-channel gs-dsp-denoise" data-enabled="'+(denoiseEnabled?'true':'false')+'"><b>DENOISE</b>'+
        '<div class="gs-dsp-knob-wrap" style="--knob-angle:'+(-135+denoiseStrength*2.7)+'deg"><span class="gs-dsp-knob-face" aria-hidden="true"></span>'+
          '<input data-dsp-denoise-strength type="range" min="0" max="100" step="5" value="'+denoiseStrength+'" aria-label="降噪强度，0至100" '+(!hasAudio?'disabled':'')+'></div>'+
        '<button type="button" data-action="dsp-denoise" aria-pressed="'+denoiseEnabled+'" '+(!hasAudio?'disabled':'')+'>'+(denoiseEnabled?'ON':'OFF')+'</button>'+
        '<small class="gs-dsp-denoise-value">基础降噪 · '+denoiseStrength+'%</small></div>'+
      '<div class="gs-voice-dsp-channel gs-dsp-eq" data-enabled="'+(eqEnabled?'true':'false')+'"><b>EQ</b>'+
        '<div class="gs-eq-three">'+['low','mid','high'].map((band,i)=>
          '<label class="gs-eq-control" style="--knob-angle:'+(-135+(eqBands[band]+12)*11.25)+'deg" title="'+['低频 180 Hz','中频 1.8 kHz','高频 6 kHz'][i]+'">'+
           '<span class="gs-eq-dial" aria-hidden="true"></span>'+
           '<input type="range" data-dsp-eq-band="'+band+'" min="-12" max="12" step="1" value="'+eqBands[band]+'" aria-label="'+['低频','中频','高频'][i]+'均衡增益（分贝）" '+(!hasAudio?'disabled':'')+'>'+
           '<span class="gs-eq-band-label">'+['LOW','MID','HIGH'][i]+'</span></label>').join('')+'</div>'+
        '<button type="button" data-action="dsp-eq" aria-pressed="'+eqEnabled+'" '+(!hasAudio?'disabled':'')+'>'+(eqEnabled?'ON':'OFF')+'</button>'+
        '<small class="gs-eq-values">低 '+(eqBands.low>0?'+':'')+eqBands.low+' / 中 '+(eqBands.mid>0?'+':'')+eqBands.mid+' / 高 '+(eqBands.high>0?'+':'')+eqBands.high+' dB</small></div>'+
      '<div class="gs-voice-dsp-channel gs-dsp-comp" data-enabled="'+(compEnabled?'true':'false')+'"><b>COMP</b>'+
        '<div class="gs-comp-pair">'+
          '<label class="gs-comp-control" style="--knob-angle:'+(-135+(compThreshold+48)*5.625)+'deg" title="Threshold · 压缩阈值">'+
            '<span class="gs-comp-dial" aria-hidden="true"></span><input type="range" data-dsp-comp-control="threshold" min="-48" max="0" step="1" value="'+compThreshold+'" aria-label="压缩阈值，负48至0分贝" '+(!hasAudio?'disabled':'')+'>'+
            '<span>THR</span></label>'+
          '<label class="gs-comp-control" style="--knob-angle:'+(-135+(compRatio-1)*38.5714)+'deg" title="Ratio · 压缩比">'+
            '<span class="gs-comp-dial" aria-hidden="true"></span><input type="range" data-dsp-comp-control="ratio" min="1" max="8" step="0.5" value="'+compRatio+'" aria-label="压缩比，1比1至8比1" '+(!hasAudio?'disabled':'')+'>'+
            '<span>RATIO</span></label></div>'+
        '<button type="button" data-action="dsp-comp" aria-pressed="'+compEnabled+'" '+(!hasAudio?'disabled':'')+'>'+(compEnabled?'ON':'OFF')+'</button>'+
        '<small class="gs-comp-values">'+compThreshold+' dB · '+compRatio+':1</small>'+
        '<span class="gs-comp-reduction" aria-label="实时增益压缩量"><i class="gs-comp-reduction-bar" aria-hidden="true"></i><output id="gsCompReduction">— dB</output></span></div>'+
      '<div class="gs-voice-dsp-channel gs-dsp-reverb" data-enabled="'+(reverbEnabled?'true':'false')+'"><b>REVERB</b>'+
        '<div class="gs-reverb-pair">'+
          '<label class="gs-reverb-control" style="--knob-angle:'+(-135+reverbRoom*2.7)+'deg" title="ROOM · 房间大小">'+
            '<span class="gs-reverb-dial" aria-hidden="true"></span>'+
            '<input type="range" data-dsp-reverb-control="room" min="0" max="100" step="5" value="'+reverbRoom+'" aria-label="混响空间大小，0至100" '+(!hasAudio?'disabled':'')+'><span>ROOM</span></label>'+
          '<label class="gs-reverb-control" style="--knob-angle:'+(-135+reverbMix*6.75)+'deg" title="MIX · 湿声比例">'+
            '<span class="gs-reverb-dial" aria-hidden="true"></span>'+
            '<input type="range" data-dsp-reverb-control="mix" min="0" max="40" step="2" value="'+reverbMix+'" aria-label="混响比例，0至40%" '+(!hasAudio?'disabled':'')+'><span>MIX</span></label></div>'+
        '<button type="button" data-action="dsp-reverb" aria-pressed="'+reverbEnabled+'" '+(!hasAudio?'disabled':'')+'>'+(reverbEnabled?'ON':'OFF')+'</button>'+
        '<small class="gs-reverb-values">ROOM '+reverbRoom+' · MIX '+reverbMix+'%</small></div>'+
    '</div><p id="gsDspStatus" role="status">'+((denoiseEnabled||eqEnabled||compEnabled||reverbEnabled)?[denoiseEnabled?'降噪':null,eqEnabled?'三段均衡':null,compEnabled?'压缩':null,reverbEnabled?'空间混响':null].filter(Boolean).join(' + ')+' · 仅试听，原声母本不变':'四模块可独立试听 · 全旁路即原声')+'</p></div>'+
  voiceYearRingView()+
  '<div id="gsAudioHost" class="gs-audio-host" aria-live="polite"></div>'+
  '<p class="gs-recorder-note">'+(state==='recording'?'正在连续录音。读完一节，请直接点击下一节经文。':state==='arming'?'正在取得麦克风权限…':state==='paused'?'已暂停记录；选择「继续读」恢复，或「结束」封存。':state==='finalizing'?'正在封存本人原声与经节时间线…':rerecordOriginal?(journeyPhase==='error'?'重录未成功。旧原声及经节时间线仍然保留；可重试或选择「保留原声」。':'从左页原段落第一节重新开始。旧原声保留到新录音成功归档。'):linked?'已保存真实读经轨迹，可以回听。':'请点击左侧一节经文，开始今日读经。')+'</p>'+
  '<div class="gs-rule"></div><div class="gs-actions">'+
  '<span class="gs-small">原声完成后自动归档；领受在下一页形成。</span>'+
  '<button class="gs-action secondary" type="button" data-action="next-reflection">读经结束 · 进入领受 →</button></div></section></div>';
}

  // All six directions remain relationships surrounding one durable center;
  // nothing here is an automatic public message or an engagement score.
  const LIGHTS=Object.freeze([
   ['OUT','传','出去','这一颗领受想递给谁？（这里仅记下，不会自动发送）','top'],
   ['TIMELINE','忆','关联','这颗领受连接了我生命中的哪一天或哪段经历？','upper-right'],
   ['SCRIPTURE','连','串珠','写下另一处经文出处及经过上下文核实的联系。','lower-right'],
   ['PRAYER','求','祷告','这一颗领受带出怎样的祷告？','bottom'],
   ['ACTION','行','给予','这颗领受催促我采取什么具体行动？','lower-left'],
   ['GOSPEL','去','福音','这颗领受怎样指向基督，成为对人的福音见证？','upper-left']
  ]);
  const insightText=()=>draft.insightDraft||{heardText:'',todayText:''};
  const graphRelations=()=>lightGraph.relations.filter(r=>r.insight_id===draft.insightRecord?.insight_id);
  function finalizeInsight(){
   if(draft.insightRecord){focusLight=null;render();return}
   if(journeyPhase!=='completed'||draft.readingJourney?.status!=='completed'){tell('请先完成本人原声读经。');return}
   try{
    const insight=C.createInsightRecord(draft.readingJourney,insightText(),randomId(),iso());
    const oldReflection=draft.reflection;
    draft.insightRecord=insight;
    draft.reflection=[insight.heard_text,insight.today_text].filter(Boolean).join('\n');
    if(!saveEntry()){draft.insightRecord=null;draft.reflection=oldReflection;return}
    focusLight=null;render();tell('领受已形成，六个关系方向如今可以生长。');
   }catch(e){tell(e.message||String(e))}
  }
  function pulseLight(type){
   const node=root.querySelector('.gs-light-node[data-light="'+type+'"]');if(!node)return;
   node.classList.add('is-pulsing');setTimeout(()=>node.classList.remove('is-pulsing'),1250);
  }
  function addLightRelation(){
   if(!draft.insightRecord||!focusLight)return;
   try{
    const rel=C.createLightRelation(draft.insightRecord,focusLight,draft.lightDraft?.[focusLight],randomId(),iso());
    const ev=C.createLightEvent(rel,randomId(),randomId(),'internal',{visibility:'private'},iso());
    const updated={relations:[...lightGraph.relations,rel],events:[...lightGraph.events,ev]};
    writeJson(persistentKeys().graph,updated);
    lightGraph=updated;draft.lightDraft[focusLight]='';persistDraft();render();pulseLight(focusLight);
    tell('已将这一次连接记入个人古卷；不会自动发送给任何人。');
   }catch(e){tell(e.message||String(e))}
  }
  function addInboundEvent(relationId){
   const relation=graphRelations().find(r=>r.relation_id===relationId);
   if(!relation)return;
   try{
    const reply=String(draft.lightDraft?.[focusLight]||'').trim();
    const ev=C.createInboundEvent(draft.insightRecord,relation,reply,randomId(),randomId(),iso());
    const updated={relations:lightGraph.relations,events:[...lightGraph.events,ev]};
    writeJson(persistentKeys().graph,updated);
    lightGraph=updated;draft.lightDraft[focusLight]='';persistDraft();render();pulseLight(focusLight);
    tell('收到的回应已记录，原来的领受文字不被改写。');
   }catch(e){tell(e.message||String(e))}
  }
  function lightField(){
   const insight=draft.insightRecord,selected=LIGHTS.find(l=>l[0]===focusLight);
   const relations=graphRelations();
   return '<section class="gs-light-panel" aria-label="七光关系场">'+
    '<div class="gs-light-orbit" data-focus="'+escape(focusLight||'')+'">'+
     '<button type="button" class="gs-light-center '+(insight?'is-lit':'')+'" data-action="'+(insight?'light-reset':'finalize-insight')+'" aria-label="'+(insight?'返回七光全景':'点亮领受')+'">领</button>'+
     (insight?LIGHTS.map(([type,word,name,prompt,position])=>
      '<button type="button" class="gs-light-node'+(focusLight&&focusLight!==type?' is-dim':'')+
      (relations.some(r=>r.light_type===type)?' is-linked':'')+(focusLight===type?' is-focused':'')+
      '" data-action="light-focus" data-light="'+type+'" data-position="'+position+
      '" title="'+escape(name)+'" aria-label="'+escape(name)+'" aria-pressed="'+(focusLight===type)+'">'+word+'</button>').join(''):'')+
     '</div>'+
     (!insight?'<p class="gs-light-copy">听见 · 于我。准备好时，轻触中心的「领」。</p>':
      !selected?'<p class="gs-light-copy">中心不失 · 原地展开。触碰其中一光，关系便能生长。</p>':
      '<div class="gs-light-detail"><p>'+escape(selected[3])+'</p>'+
       '<label class="gs-field">一次真实的连接<textarea rows="3" maxlength="1200" data-field="lightNote" placeholder="记录真实的人、经文、祷告或行动……">'+escape(draft.lightDraft?.[focusLight]||'')+'</textarea></label>'+
       '<button class="gs-smallbutton" type="button" data-action="light-add">记下连接</button>'+
       (relations.some(r=>r.light_type===focusLight)?'<div class="gs-light-history">'+
       relations.filter(r=>r.light_type===focusLight).map(r=>'<div class="gs-light-history-item"><p>'+escape(r.to_ref)+'</p><small>'+escape(datetime(r.created_at))+'</small>'+
       lightGraph.events.filter(ev=>ev.relation_id===r.relation_id&&ev.direction==='inbound').map(ev=>'<p class="gs-light-echo">↳ '+escape(ev.payload?.source||'')+'</p>').join('')+
       '<button class="gs-smallbutton" type="button" data-action="light-reply" data-relation-id="'+escape(r.relation_id)+'">将上方文字记为收到的回应</button></div>').join('')+
       '</div>':'')+
      '</div>')+
    '</section>';
  }
  function stageReflection(){
   const insight=draft.insightRecord,words=insightText();
   return '<div class="gs-grid gs-insight-layout">'+
     '<section class="gs-panel" aria-label="听见和于我"><h3>经文 · '+escape(draft.scripture.reference||'尚未定位')+'</h3>'+
     '<div class="gs-scripture-read">'+(draft.scripture.translation==='English Standard Version (ESV)'?
       'ESV · 本地只留经文位置和本人领受；版权正文请返回读经页即时阅读。':
       escape(draft.scripture.text||'请先完成本人原声读经。'))+'</div>'+
     '<div class="gs-insight-writing">'+
      '<label class="gs-field">这段经文里，我听见了什么？<textarea rows="3" data-field="heardText" '+(insight?'disabled':'')+' placeholder="听见……">'+escape(words.heardText||'')+'</textarea></label>'+
      '<label class="gs-field">这与今天的我有什么关系？<textarea rows="4" data-field="todayText" '+(insight?'disabled':'')+' placeholder="今天……">'+escape(words.todayText||'')+'</textarea></label>'+
      (insight?'<p class="gs-small">领受已经形成；原文保持不变，新的回应从七光继续生长。</p>':(!draft.readingJourney&&draft.reflection?'<p class="gs-small">旧版默想原文（保持不变）</p><div class="gs-note-source">'+escape(draft.reflection)+'</div>':''))+
     '</div></section>'+
     '<section class="gs-panel gs-light-stage" aria-label="领受与七光">'+lightField()+
      (insight?'<div class="gs-actions"><button type="button" class="gs-smallbutton" data-action="next-sharing">一粒牧草 →</button></div>':'')+
     '</section></div>';
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
   if(!residentAccess()||!draft||!document.body.classList.contains('grassbook-open'))return;
   const tabs=[['reading','读经'],['reflection','领受'],['sharing','牧养']];
   root.innerHTML=
    '<header class="gs-head"><div class="gs-head-title">我的牧草</div>'+
    '<nav class="gs-steps" aria-label="我的牧草三个阶段">'+tabs.map(([id,name])=>
      '<button type="button" data-action="tab" data-tab="'+id+'" aria-selected="'+(tab===id)+'">'+name+'</button>').join('')+'</nav></header>'+
    '<main class="gs-stage">'+(archiveOpen?
      '<div class="gs-grid"><section class="gs-panel"><h3>个人古卷</h3>'+insertArchiveText()+'</section>'+
      '<section class="gs-panel"><h3>经文重逢</h3><div class="gs-empty">每一次真实的领受，都有自己的时间与声音。</div></section></div>':
      tab==='reading'?stageReading():tab==='reflection'?stageReflection():stageSharing())+'</main>'+
    '<footer class="gs-foot"><span>本机私密 · 文字与当前稿可导出 · 原声另存</span>'+
    '<div class="gs-actions"><button class="gs-smallbutton" type="button" data-action="export">导出档案</button>'+
    '<button class="gs-smallbutton" type="button" data-action="'+(archiveOpen?'return-stage':'archive')+'">'+(archiveOpen?'返回':'翻阅档案')+'</button></div></footer>'+
    '<div class="gs-status" id="gsStatus" role="status" aria-live="polite">'+escape(notice)+'</div>';
   if(tab==='reading'&&!archiveOpen&&!rerecordOriginal&&draft.reading.audioId&&(draft.scripture.verifiedAgainstRecording||draft.readingJourney?.status==='completed')){
    const host=$('#gsAudioHost');
    if(host&&activePlayer&&activePlayer.dataset.audioId===draft.reading.audioId&&
       activePlayer.dataset.entryId===draft.id&&activePlayer.dataset.ownerScope===scope){
     host.replaceChildren(activePlayer); // Preserve ongoing playback across right-page redraws.
    }else void restoreAudio(draft.reading.audioId);
   }else if(activePlayer)clearPlayer();
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
   // Keep the existing left-page reader unchanged: broadcast calibrated journey time.
   const calibrated=soundMediaToJourneyMs(Number.isFinite(currentTime)?currentTime*1000:0,player);
   document.dispatchEvent(new CustomEvent('mygrass:reading-audio-progress',{detail:{
    state,currentTime:calibrated==null?(Number.isFinite(currentTime)?currentTime:0):calibrated/1000,
    duration:Number.isFinite(duration)?duration:0,audioId:draft.reading.audioId||null
   }}));
  }

  // Both audition effects share a single media element and a single Web Audio graph.
  // The original audio blob is never altered, rendered or uploaded here.
  function releaseDenoiseMonitor(){
   denoiseRequest++;
   const m=denoiseMonitor;denoiseMonitor=null;denoisePending=null;
   if(!m)return;
   for(const node of [m.source,m.dry,m.wet,m.cleanFeed,m.noiseFeed,m.highpass,m.effect,m.low,m.mid,m.high,m.compressor,m.compBypass,m.compWet,m.compOutput,m.reverbDry,m.reverbWet,m.reverbLowpass,m.convolver]){
    try{node?.disconnect()}catch(_){}
   }
   if(m.context?.state!=='closed')m.context?.close?.().catch(()=>{});
  }
  function updateDenoiseControls(){
   const button=root.querySelector('[data-action="dsp-denoise"]');
   if(button){button.textContent=denoiseEnabled?'ON':'OFF';button.setAttribute('aria-pressed',String(denoiseEnabled))}
   const box=root.querySelector('.gs-dsp-denoise');if(box)box.dataset.enabled=String(denoiseEnabled);
   const eqButton=root.querySelector('[data-action="dsp-eq"]');
   if(eqButton){eqButton.textContent=eqEnabled?'ON':'OFF';eqButton.setAttribute('aria-pressed',String(eqEnabled))}
   const eqBox=root.querySelector('.gs-dsp-eq');if(eqBox)eqBox.dataset.enabled=String(eqEnabled);
   const compButton=root.querySelector('[data-action="dsp-comp"]');
   if(compButton){compButton.textContent=compEnabled?'ON':'OFF';compButton.setAttribute('aria-pressed',String(compEnabled))}
   const compBox=root.querySelector('.gs-dsp-comp');if(compBox)compBox.dataset.enabled=String(compEnabled);
   const reverbButton=root.querySelector('[data-action="dsp-reverb"]');
   if(reverbButton){reverbButton.textContent=reverbEnabled?'ON':'OFF';reverbButton.setAttribute('aria-pressed',String(reverbEnabled))}
   const reverbBox=root.querySelector('.gs-dsp-reverb');if(reverbBox)reverbBox.dataset.enabled=String(reverbEnabled);
   const status=root.querySelector('#gsDspStatus');
   if(status){
    const active=[denoiseEnabled?'降噪':null,eqEnabled?'三段均衡':null,compEnabled?'压缩':null,reverbEnabled?'空间混响':null].filter(Boolean);
    status.textContent=active.length?active.join(' + ')+' · 仅试听，原声母本不变':'DSP 已旁路 · 正在聆听原声';
   }
  }
  function applyDspSettings(){
   const m=denoiseMonitor;if(!m?.source)return;
   const now=m.context.currentTime;
   const useDenoise=denoiseEnabled&&!!m.effect;
   const processed=useDenoise||eqEnabled||compEnabled||reverbEnabled;
   m.dry.gain.setTargetAtTime(processed?0:1,now,.012);
   m.wet.gain.setTargetAtTime(processed?1:0,now,.012);
   m.cleanFeed.gain.setTargetAtTime(processed&&!useDenoise?1:0,now,.012);
   if(m.noiseFeed)m.noiseFeed.gain.setTargetAtTime(useDenoise?1:0,now,.012);
   if(m.effect)m.effect.port.postMessage({type:'strength',strength:denoiseStrength});
   for(const band of ['low','mid','high']){
    m[band].gain.setTargetAtTime(eqEnabled?eqBands[band]:0,now,.012);
   }
   if(m.compressor){
    m.compressor.threshold.setTargetAtTime(compThreshold,now,.012);
    m.compressor.ratio.setTargetAtTime(compRatio,now,.012);
    m.compBypass.gain.setTargetAtTime(compEnabled?0:1,now,.012);
    m.compWet.gain.setTargetAtTime(compEnabled?1:0,now,.012);
   }
   if(m.reverbWet&&m.reverbDry){
    m.reverbDry.gain.setTargetAtTime(1,now,.018);
    m.reverbWet.gain.setTargetAtTime(reverbEnabled?reverbMix/100:0,now,.025);
   }
  }
  // Deterministically generated room impulse: no uploads, files, random meter or presets.
  function makeVoiceRoomImpulse(context,room){
   const scale=Math.max(0,Math.min(100,Number(room)||0))/100;
   const seconds=.22+scale*1.38;
   const sampleCount=Math.max(1,Math.ceil(context.sampleRate*seconds));
   const buffer=context.createBuffer(2,sampleCount,context.sampleRate);
   const amplitude=.6/Math.sqrt(context.sampleRate*.14);
   for(let channel=0;channel<2;channel++){
    let seed=(channel?71237:15937)+Math.round(scale*1000);
    const values=buffer.getChannelData(channel);
    for(let i=0;i<sampleCount;i++){
     seed=(Math.imul(seed,1664525)+1013904223)>>>0;
     const noise=(seed/2147483648)-1;
     const progress=i/sampleCount;
     const fade=Math.pow(1-progress,2)*Math.exp(-3*progress);
     values[i]=noise*fade*amplitude;
    }
    // Small early reflections make a room feel present without producing an echo.
    for(const [delay,gain] of [[.018,.095],[.033,.065],[.058,.035]]){
     const position=Math.floor((delay+channel*.0015)*context.sampleRate);
     if(position<sampleCount)values[position]+=gain;
    }
   }
   return buffer;
  }
  function applyDenoiseSetting(){applyDspSettings()}
  async function loadDenoiseWorklet(m,request,owner,audioId){
   if(!denoiseEnabled||!m||m.effect)return !!m?.effect;
   if(m.workletPending)return m.workletPending;
   const task=(async()=>{
    try{
     if(!m.context.audioWorklet?.addModule||!window.AudioWorkletNode)throw Error('AudioWorklet 不可用');
     await m.context.audioWorklet.addModule('/pasture-preview/my-grass-denoise-worklet-v1.js');
     if(request!==denoiseRequest||m!==denoiseMonitor||m.player!==activePlayer||
       owner!==scope||audioId!==draft?.reading?.audioId||!residentAccess())return false;
     const highpass=m.context.createBiquadFilter();
     highpass.type='highpass';highpass.frequency.value=75;highpass.Q.value=.707;
     const effect=new AudioWorkletNode(m.context,'my-grass-denoise-v1');
     const noiseFeed=m.context.createGain();noiseFeed.gain.value=0;
     m.source.connect(highpass);
     highpass.connect(effect);effect.connect(noiseFeed);noiseFeed.connect(m.low);
     m.highpass=highpass;m.effect=effect;m.noiseFeed=noiseFeed;
     applyDspSettings();return true;
    }catch(e){
     // EQ remains usable if only the optional denoiser fails to load.
     if(request===denoiseRequest&&m===denoiseMonitor){
      denoiseEnabled=false;updateDenoiseControls();applyDspSettings();
      tell('降噪不可用，已保留原声与均衡试听：'+String(e?.message||e));
     }
     return false;
    }
   })();
   m.workletPending=task;
   try{return await task}finally{if(m.workletPending===task)m.workletPending=null}
  }
  async function connectDspMonitor(player){
   if(!(denoiseEnabled||eqEnabled||compEnabled||reverbEnabled)||!player||player!==activePlayer)return false;
   if(denoiseMonitor?.player===player&&denoiseMonitor.source){
    await denoiseMonitor.context.resume();
    const m=denoiseMonitor;
    if(denoiseEnabled&&!m.effect)await loadDenoiseWorklet(m,denoiseRequest,scope,player.dataset.audioId);
    applyDspSettings();return !!(denoiseEnabled||eqEnabled||compEnabled||reverbEnabled);
   }
   if(denoisePending)return denoisePending;
   const AudioCtor=window.AudioContext||window.webkitAudioContext;
   if(!AudioCtor){denoiseEnabled=false;eqEnabled=false;compEnabled=false;reverbEnabled=false;updateDenoiseControls();tell('当前浏览器不支持 Web Audio，已保留原声回听。');return false}
   const request=++denoiseRequest,owner=scope,audioId=player.dataset.audioId;
   const task=(async()=>{
    let context=null,source=null,m=null;
    try{
     context=new AudioCtor();
     await context.resume();
     if(request!==denoiseRequest||player!==activePlayer||owner!==scope||
       audioId!==draft?.reading?.audioId||!residentAccess()){await context.close();return false}
     const dry=context.createGain(),wet=context.createGain(),cleanFeed=context.createGain();
     const low=context.createBiquadFilter(),mid=context.createBiquadFilter(),high=context.createBiquadFilter();
     const compressor=context.createDynamicsCompressor();
     compressor.threshold.value=-24;compressor.ratio.value=2.5;
     compressor.knee.value=12;compressor.attack.value=.012;compressor.release.value=.20;
     const compBypass=context.createGain(),compWet=context.createGain();
     compBypass.gain.value=1;compWet.gain.value=0;
     const compOutput=context.createGain(),reverbDry=context.createGain(),reverbWet=context.createGain();
     const convolver=context.createConvolver(),reverbLowpass=context.createBiquadFilter();
     convolver.normalize=false;
     convolver.buffer=makeVoiceRoomImpulse(context,reverbRoom);
     reverbLowpass.type='lowpass';reverbLowpass.frequency.value=4200;reverbLowpass.Q.value=.707;
     reverbDry.gain.value=1;reverbWet.gain.value=0;
     low.type='lowshelf';low.frequency.value=180;
     mid.type='peaking';mid.frequency.value=1800;mid.Q.value=.9;
     high.type='highshelf';high.frequency.value=6000;
     dry.gain.value=1;wet.gain.value=0;cleanFeed.gain.value=0;
     for(const node of [low,mid,high])node.gain.value=0;
     source=context.createMediaElementSource(player);
     // Dry route is wired first. Processing failures cannot erase the original file.
     source.connect(dry);dry.connect(context.destination);
     source.connect(cleanFeed);cleanFeed.connect(low);low.connect(mid);mid.connect(high);
     high.connect(wet);
     wet.connect(compBypass);compBypass.connect(compOutput);
     wet.connect(compressor);compressor.connect(compWet);compWet.connect(compOutput);
     // Post-COMP room: intact speech goes direct; only a filtered room tail is mixed back.
     compOutput.connect(reverbDry);reverbDry.connect(context.destination);
     compOutput.connect(convolver);convolver.connect(reverbLowpass);
     reverbLowpass.connect(reverbWet);reverbWet.connect(context.destination);
     m={context,player,source,dry,wet,cleanFeed,low,mid,high,compressor,compBypass,compWet,compOutput,reverbDry,reverbWet,convolver,reverbLowpass,effect:null,noiseFeed:null,highpass:null};
     denoiseMonitor=m;
     applyDspSettings();
     if(denoiseEnabled)await loadDenoiseWorklet(m,request,owner,audioId);
     if(request!==denoiseRequest||m!==denoiseMonitor)return false;
     applyDspSettings();return true;
    }catch(e){
     // If MediaElementSourceNode exists, keep its dry audio route alive.
     if(m&&m===denoiseMonitor){
      denoiseEnabled=false;eqEnabled=false;compEnabled=false;reverbEnabled=false;updateDenoiseControls();applyDspSettings();
     }else if(source&&context){
      try{source.connect(context.destination)}catch(_){}
      denoiseMonitor={context,player,source};
     }else if(context){context.close().catch(()=>{})}
     tell('DSP 试听失败，已切回原声：'+String(e?.message||e));
     return false;
    }
   })();
   denoisePending=task;
   try{return await task}finally{if(denoisePending===task)denoisePending=null}
  }
  function updateCompReduction(player){
   const output=root.querySelector('#gsCompReduction');if(!output)return;
   const m=denoiseMonitor;
   const reduction=m?.compressor?.reduction;
   const valid=compEnabled&&player===activePlayer&&!player.paused&&!player.ended&&typeof reduction==='number'&&Number.isFinite(reduction);
   const db=valid?Math.max(0,Math.min(24,-reduction)):null;
   output.textContent=db==null?'— dB':db.toFixed(1)+' dB';
   const bar=root.querySelector('.gs-comp-reduction-bar');
   if(bar)bar.style.width=(db==null?0:(db/24)*100)+'%';
  }
  async function connectDenoiseMonitor(player){return connectDspMonitor(player)}
  async function toggleDenoisePreview(){
   if(!draft.reading.audioId||rerecordOriginal||['arming','recording','paused','finalizing'].includes(journeyPhase)){
    tell('请先完成这次原声朗读，才可以试听降噪。');return;
   }
   denoiseEnabled=!denoiseEnabled;updateDenoiseControls();
   if(!denoiseEnabled){applyDspSettings();return}
   let player=activePlayer;
   if(!player||player.dataset.audioId!==draft.reading.audioId)player=await restoreAudio(draft.reading.audioId);
   if(!player){denoiseEnabled=false;updateDenoiseControls();return}
   if(await connectDspMonitor(player)){
    try{if(player.paused)await player.play()}catch(e){tell('降噪已就绪，请点击回听试听。')}
   }
  }
  async function toggleEqPreview(){
   if(!draft.reading.audioId||rerecordOriginal||['arming','recording','paused','finalizing'].includes(journeyPhase)){
    tell('请先完成本次读经，才可以试听 EQ。');return;
   }
   eqEnabled=!eqEnabled;updateDenoiseControls();
   if(!eqEnabled){applyDspSettings();return}
   let player=activePlayer;
   if(!player||player.dataset.audioId!==draft.reading.audioId)player=await restoreAudio(draft.reading.audioId);
   if(!player){eqEnabled=false;updateDenoiseControls();return}
   if(await connectDspMonitor(player)){
    try{if(player.paused)await player.play()}catch(e){tell('EQ 已就绪，请点击回听试听。')}
   }
  }

  async function toggleCompPreview(){
   if(!draft.reading.audioId||rerecordOriginal||['arming','recording','paused','finalizing'].includes(journeyPhase)){
    tell('请先完成读经，才可以试听动态压缩。');return;
   }
   compEnabled=!compEnabled;updateDenoiseControls();
   if(!compEnabled){applyDspSettings();updateCompReduction(activePlayer);return}
   let player=activePlayer;
   if(!player||player.dataset.audioId!==draft.reading.audioId)player=await restoreAudio(draft.reading.audioId);
   if(!player){compEnabled=false;updateDenoiseControls();return}
   if(await connectDspMonitor(player)){
    try{if(player.paused)await player.play()}catch(e){tell('压缩器已就绪，请点击回听开始试听。')}
   }
  }

  async function toggleReverbPreview(){
   if(!draft.reading.audioId||rerecordOriginal||['arming','recording','paused','finalizing'].includes(journeyPhase)){
    tell('请先完成原声朗读，才能试听空间混响。');return;
   }
   reverbEnabled=!reverbEnabled;updateDenoiseControls();
   if(!reverbEnabled){applyDspSettings();return}
   let player=activePlayer;
   if(!player||player.dataset.audioId!==draft.reading.audioId)player=await restoreAudio(draft.reading.audioId);
   if(!player){reverbEnabled=false;updateDenoiseControls();return}
   if(await connectDspMonitor(player)){
    try{if(player.paused)await player.play()}catch(_){tell('混响已就绪，请点击回听试听。')}
   }
  }

  function clearPlayer(){
   // Cancel late IndexedDB reads before changing accounts, drafts or recording takes.
   audioRestoreToken++;audioRestorePending=null;
   releaseDenoiseMonitor();
   if(activePlayer)broadcastReadingAudioProgress('cleared',activePlayer);
   try{activePlayer?.pause?.()}catch(_){}
   activePlayer=null;
   if(activeAudioURL){URL.revokeObjectURL(activeAudioURL);activeAudioURL=null}
  }
  async function restoreAudio(id){
   const host=$('#gsAudioHost'),entryId=draft?.id,owner=scope;
   if(!host||!id||!residentAccess())return null;
   if(activePlayer?.dataset.audioId===id&&activePlayer.dataset.entryId===entryId&&
      activePlayer.dataset.ownerScope===owner&&activePlayer.isConnected)return activePlayer;
   if(audioRestorePending?.id===id&&audioRestorePending.host===host&&
      audioRestorePending.owner===owner&&audioRestorePending.entryId===entryId)return audioRestorePending.promise;
   const token=++audioRestoreToken;
   const pending={id,host,owner,entryId,promise:null};
   pending.promise=(async()=>{
    try{
     const blob=await getAudio(id);
     if(token!==audioRestoreToken||!residentAccess()||scope!==owner||draft?.id!==entryId||
        draft?.reading?.audioId!==id||rerecordOriginal||host!==$('#gsAudioHost'))return null;
     if(!blob){host.textContent='本机没有找到对应原声。请重新录制。';return null}
     clearPlayer();
     activeAudioURL=URL.createObjectURL(blob);
     const player=document.createElement('audio');
     player.preload='metadata';player.src=activeAudioURL;player.hidden=true;
     player.dataset.audioId=id;player.dataset.entryId=entryId;player.dataset.ownerScope=owner;
     activePlayer=player;host.replaceChildren(player);
     const sync=()=>{
      if(player!==activePlayer)return;
      const state=player.ended||player.paused?'linked':'playing';
      const consoleNode=$('.gs-recorder-console'),screen=$('#gsRecorderScreen'),status=$('#gsRecorderStatus');
      if(consoleNode)consoleNode.dataset.state=state;if(screen)screen.dataset.state=state;
      if(status)status.textContent=state==='playing'?'PLAY · 正在回听':'LINKED · 已与 '+draft.scripture.reference+' 绑定';
     };
     player.addEventListener('play',()=>{
      if(player!==activePlayer)return;
      sync();broadcastReadingAudioProgress('playing',player);
     });
     player.addEventListener('timeupdate',()=>{
      if(player!==activePlayer)return;
      broadcastReadingAudioProgress(player.ended?'ended':player.paused?'paused':'playing',player);
      updateCompReduction(player);
     });
     player.addEventListener('pause',()=>{if(player!==activePlayer)return;sync();if(!player.ended)broadcastReadingAudioProgress('paused',player)});
     player.addEventListener('ended',()=>{if(player!==activePlayer)return;sync();broadcastReadingAudioProgress('ended',player)});
     return player;
    }catch(e){
     if(host===$('#gsAudioHost')&&scope===owner&&draft?.id===entryId)
      host.textContent='无法读取本机原声：'+String(e.message||e);
     return null;
    }
   })();
   audioRestorePending=pending;
   try{return await pending.promise}finally{
    if(audioRestorePending===pending)audioRestorePending=null;
   }
  }
async function deleteAudio(id){
 if(!id)return;
 const db=await audioDatabase();
 try{return await new Promise((resolve,reject)=>{
  const tx=db.transaction('recordings','readwrite');tx.objectStore('recordings').delete(id);
  tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 })}finally{db.close()}
}

  // Audio encoders can pad or trim durations. Map saved verse clock to real media clock
  // only for audition, leaving saved original boundaries and recordings unchanged.
  function soundMediaDurationMs(player){
   const seconds=Number(player?.duration);
   return Number.isFinite(seconds)&&seconds>0?seconds*1000:null;
  }
  function soundMediaToJourneyMs(mediaMs,player,model=soundPathModel(draft?.readingJourney)){
   const duration=soundMediaDurationMs(player);
   if(!model||!duration||!Number.isFinite(mediaMs))return null;
   return Math.max(0,Math.min(model.total,mediaMs/duration*model.total));
  }
async function togglePlayback(){
 if(!draft.reading.audioId){tell('还没有可回听的本人原声。');return}
 if(!draft.scripture.verifiedAgainstRecording&&draft.readingJourney?.status!=='completed'){tell('这份旧版原声尚未与经文绑定。');return}
 let player=activePlayer;
 if(!player||player.dataset.audioId!==draft.reading.audioId)player=await restoreAudio(draft.reading.audioId);
 if(!player)return;
 if(player.paused||player.ended){
  if(player.ended)player.currentTime=0;
  if(denoiseEnabled||eqEnabled||compEnabled||reverbEnabled)await connectDspMonitor(player);
  await player.play().catch(()=>{tell('原声暂无法播放，请检查浏览器音频权限。')});
 }
 else player.pause();
}
function linkRecording(){
 if(!draft.reading.audioId){tell('请先完成一次本人原声录音。');return}
 const reference=C.trim(draft.scripture.reference);
 if(!reference){tell('请先选择左侧经文。');return}
 if(!window.confirm('确认将这次本人原声与「'+reference+'」建立绑定吗？绑定后才能回听。'))return;
 draft.scripture.verifiedAgainstRecording=true;persistDraft();render();tell('已建立经文与本人原声的绑定，可以回听。');
}
function cancelRerecord(){
 if(!rerecordOriginal||!['idle','error'].includes(journeyPhase))return;
 rerecordOriginal=null;journey=draft.readingJourney||null;
 journeyPhase=journey?.status==='completed'?'completed':'idle';
 journeyFinalMs=journey?.durationMs||0;journeyError='';
 C.setRuntimeReadingJourney(journey);emitJourneyState();render();
 tell('已取消重录，原声及经节记录保持不变。');
}
function rerecordAudio(){
 if(rerecordOriginal){tell('请从左页第一节开始重录，或点击「保留原声」取消。');return}
 if(['arming','recording','paused','finalizing'].includes(journeyPhase))return;
 const archived=getEntry();
 if(!draft.reading.audioId||draft.readingJourney?.status!=='completed'){
  tell('请先完成一次逐节读经，才能重新录音。');return;
 }
 if(draft.insightRecord||archived?.insightRecord){
  tell('这次读经已形成正式领受，不能直接改写原声与经节出处；请新开一页，留下新的读经见证。');return;
 }
 if(archived?.shareIds?.length||micros.some(m=>m.entryId===draft.id)){
  tell('这份读经已有关联牧草，请新开一页，避免修改既有来源。');return;
 }
 if(!window.confirm('重新录制本次读经吗？可在本章重新选择起始节，并按这次实际读到的经节结束。若与原范围不同，保存前会再次确认。旧原声保留到新录音成功归档。'))return;
 rerecordOriginal={audioId:draft.reading.audioId,scope,draftId:draft.id,journey:draft.readingJourney};
 clearPlayer();journey=null;journeyPhase='idle';journeyFinalMs=0;journeyError='';
 C.setRuntimeReadingJourney(null);emitJourneyState();render();
 tell('进入重录准备：请点击左页本章想开始的一节；实际读到哪里就可以在哪里结束，原声在新录音保存前不会改变。');
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
      if(!draft||!residentAccess()||scope!==residentScope()){audioPending=false;return}
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
   if(recorder?.state==='recording'||['arming','recording','paused','finalizing'].includes(journeyPhase)){tell('请先结束今日读经，再翻阅档案。');return}
   clearPlayer();rerecordOriginal=null;draft={id:found.id,scripture:{...found.scripture},reading:{...found.reading},readingJourney:found.readingJourney||null,
    reflection:found.reflection?.text||'',insightRecord:found.insightRecord||null,
    insightDraft:found.insightRecord?{heardText:found.insightRecord.heard_text,todayText:found.insightRecord.today_text}:{heardText:'',todayText:''},lightDraft:{}};
   focusLight=null;
   journey=draft.readingJourney;journeyPhase=journey?.status==='completed'?'completed':'idle';C.setRuntimeReadingJourney(journey);emitJourneyState();
   editingSavedId=found.id;microDraft='';persistDraft();archiveOpen=false;tab='reading';
   tell('已翻开 '+found.scripture.reference+' 的灵修档案。');render();
  }
  function openNewEntry(){
   if(recorder?.state==='recording'||['arming','recording','paused','finalizing'].includes(journeyPhase)){tell('请先结束今日读经。');return}
   clearPlayer();rerecordOriginal=null;draft=emptyDraft(refFromOriginal());journey=null;journeyPhase='idle';journeyFinalMs=0;C.setRuntimeReadingJourney(null);emitJourneyState();editingSavedId=null;microDraft='';
   focusLight=null;archiveOpen=false;tab='reading';persistDraft();tell('已开启新的一份牧草；既有档案不会被覆盖。');render();
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
   // A running audio journey must finish before a stable snapshot is exported.
   if(audioPending||['arming','recording','paused','finalizing'].includes(journeyPhase)){
    tell('请先结束本人原声读经，再导出完整文字记录。');return;
   }
   try{
    const payload=C.buildTextArchive({scope,draft,entries,micros,lightGraph,exportedAt:iso()});
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
    downloadBlob(blob,'我的牧草-私人文字备份-'+new Date().toISOString().slice(0,10)+'.json');
    tell('已导出正式档案、七光与当前编辑稿。此文件只在本机，含私人信息；原声音频仍须单独导出。');
   }catch(e){tell('文字导出失败：'+String(e.message||e))}
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
  function journeyElapsedMs(){const now=journeyPausedClock==null?performance.now():journeyPausedClock;return Math.max(0,Math.round(now-journeyStartedClock-journeyPauseTotal))}
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
  function discardCurrentTake(){
    // Discard can occur while waiting for mic permission, actively recording,
    // or paused. Invalidate ALL callbacks before stopping the MediaRecorder:
    // its onstop event may arrive after a new attempt has already begun.
    ++journeyAttemptToken;
    const abandoned=journeyRecorder;journeyRecorder=null;
    try{if(abandoned&&abandoned.state!=='inactive')abandoned.stop()}catch(_){}
    releaseJourneyStream();journeyChunks=[];
    journey=null;journeyPhase='idle';journeyError='';
    journeyFinalMs=0;journeyPausedClock=null;journeyPauseTotal=0;
    C.setRuntimeReadingJourney(null);
    emitJourneyState();render();
    tell(rerecordOriginal
      ?'本遍已放弃，旧原声与古卷记录保持不变。请从原段落第一节重新读。'
      :'本遍已放弃，没有形成读经记录。请从第一节重新开始。');
  }
  function restartCurrentTake(){
    if(!['arming','recording','paused'].includes(journeyPhase))return;
    if(!window.confirm('放弃这一遍正在录制的读经，从第一节重新开始吗？这遍不保存，已归档的原声与古卷不会改变。'))return;
    discardCurrentTake();
  }
  function journeyFail(message){
   releaseJourneyStream();
   if(rerecordOriginal){journey=null;C.setRuntimeReadingJourney(null)}
   journeyPhase='error';journeyError=message;
   tell(message);emitJourneyState();render();
  }
  async function startJourney(point){
   if(['arming','recording','paused','finalizing'].includes(journeyPhase))return;
   if((draft.readingJourney?.status==='completed'||draft.reading.audioId)&&!rerecordOriginal){
    tell('这次读经已有原声；如需纠正读错的内容，请使用「重新录音」。');return;
   }
   if(rerecordOriginal){
    const original=rerecordOriginal;
    if(original.scope!==scope||original.draftId!==draft.id){
     tell('居民或编辑稿已经改变；请重新进入牧草。');return;
    }
    if(!original.journey||point.book!==original.journey.book||
       point.chapter!==original.journey.chapter||
       point.translation!==original.journey.translation){
     tell('请在原书卷与章节内选择新的起始经节。若要换章或换译本，请新开一页；原录音不会改变。');return;
    }
   }
   if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){journeyFail('当前浏览器无法录音；请使用支持麦克风录音的浏览器。');return}
   try{C.startReadingJourney(point,iso())}catch(e){tell(e.message);return}
   const attemptId=++journeyAttemptToken;
   journeyPhase='arming';journeyError='';emitJourneyState();render();
   let stream;
   try{
    stream=await navigator.mediaDevices.getUserMedia({audio:true,video:false});
    if(journeyPhase!=='arming'||attemptId!==journeyAttemptToken){
     stream.getTracks().forEach(t=>t.stop());return;
    }
    const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported?.(t));
    journeyStream=stream;journeyChunks=[];
    journeyRecorder=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
    journeyRecorder.ondataavailable=e=>{
     if(attemptId===journeyAttemptToken&&e.data?.size>0)journeyChunks.push(e.data);
    };
    journeyRecorder.onerror=e=>{
     if(attemptId===journeyAttemptToken)journeyFail('读经录音已中断：'+String(e.error?.message||'设备错误'));
    };
    journeyRecorder.onstart=()=>{
     if(attemptId!==journeyAttemptToken||journeyPhase!=='arming')return;
     journeyStartedClock=performance.now();journeyPauseTotal=0;journeyPausedClock=null;journeyFinalMs=0;
     journey=C.startReadingJourney(point,iso());
     journeyPhase='recording';C.setRuntimeReadingJourney(journey);
     journeyTickTimer=setInterval(emitJourneyTick,250);
     journeyStopTimer=setTimeout(()=>finishJourney(),Math.max(0,15*60*1000-journeyElapsedMs()));
     emitJourneyState();render();emitJourneyTick();
    };
    journeyRecorder.onstop=async()=>{
     if(attemptId!==journeyAttemptToken)return; // An intentionally abandoned take.
     releaseJourneyStream();
     if(journeyPhase!=='finalizing'){journeyFail('录音意外中断，未将尚未完成的读经记为已读。');return}
     const blob=new Blob(journeyChunks,{type:journeyRecorder.mimeType||journeyChunks[0]?.type||'audio/webm'});
     if(!blob.size||blob.size>20*1024*1024){journeyFail(!blob.size?'没有取得有效原声，读经尚未保存。':'录音超过20MB，请重新分段读经。');return}
     if(rerecordOriginal&&(journey.book!==rerecordOriginal.journey.book||
        journey.chapter!==rerecordOriginal.journey.chapter||
        journey.translation!==rerecordOriginal.journey.translation)){
      journeyFail('经文书卷、章节或译本与当前档案不一致；原始录音没有改变。');return;
     }
     const audioId=scope+':'+draft.id+':'+randomId();
     try{
      await putAudio(audioId,blob);
      // Account switch, cancellation or navigation during async persistence
      // must never attach this audio to another resident's private diary.
      if(attemptId!==journeyAttemptToken||!residentAccess()||scope!==residentScope()||
         (rerecordOriginal&&(rerecordOriginal.scope!==scope||rerecordOriginal.draftId!==draft?.id)))return;
      const metadata={audioId,mimeType:blob.type,size:blob.size,durationSeconds:journeyFinalMs/1000};
      journey=C.completeReadingJourney(journey,journeyFinalMs,iso(),metadata);
      C.setRuntimeReadingJourney(journey);
      const previousDraft=rerecordOriginal?{
       ...draft,scripture:{...draft.scripture},reading:{...draft.reading},readingJourney:draft.readingJourney
      }:null;
      const previousAudioId=rerecordOriginal?.audioId||null;
      // Save the new audio AND timeline before retiring the original one.
      if(!residentAccess()||scope!==residentScope()||!draft||
         (rerecordOriginal&&(rerecordOriginal.scope!==scope||rerecordOriginal.draftId!==draft.id))){
       journeyFail('居民身份已经变化；此录音不会写入其他人的档案。');return;
      }
      draft.readingJourney=journey;
      draft.reading={audioId,mimeType:blob.type,size:blob.size,durationSeconds:journeyFinalMs/1000};
      draft.scripture.reference=journey.reference;draft.scripture.translation=journey.translation;
      draft.scripture.verifiedAgainstRecording=false;
      journeyPhase='completed';journeyError='';C.setRuntimeReadingJourney(journey);
      // Synchronously update the actual selected scripture text and verse IDs
      // before saveEntry snapshots the full reading into the personal archive.
      emitJourneyState();
      const archived=saveEntry();
      if(!archived&&previousDraft){
       // Keep old draft but clear rejected completed take, so the first verse
       // becomes selectable again on another retry.
       draft=previousDraft;journey=null;
       journeyPhase='error';C.setRuntimeReadingJourney(null);
       persistDraft();emitJourneyState();render();
       tell('重录归档未成功，原始录音和古卷记录保持不变。可再试或保留原声。');
       return;
      }
      if(archived){
       rerecordOriginal=null;
       if(previousAudioId&&previousAudioId!==audioId&&
          !entries.some(item=>item.reading?.audioId===previousAudioId)){
        try{await deleteAudio(previousAudioId)}catch(_){}
       }
      }
      emitJourneyState();render();
      tell(archived?'今日读经已封存到个人古卷：'+journey.reference+'。可以回听，或继续默想。':'原声已存于本机，但尚未完成古卷归档。请稍后重试。');
     }catch(e){journeyFail('保存本次读经失败：'+String(e.message||e))}
    };
    journeyRecorder.start(250);
   }catch(e){
    stream?.getTracks().forEach(t=>t.stop());
    if(attemptId!==journeyAttemptToken)return;
    journeyFail(e.name==='NotAllowedError'?'没有取得麦克风许可，尚未开始记录读经。':'无法开始读经录音：'+String(e.message||e));
   }
  }
  function advanceJourney(point){
   if(journeyPhase!=='recording'||!journey)return;
   try{journey=C.advanceReadingJourney(journey,point,journeyElapsedMs());C.setRuntimeReadingJourney(journey);emitJourneyState();emitJourneyTick()}
   catch(e){tell(e.message||String(e))}
  }
  function pauseJourney(){
   if(journeyPhase!=='recording'||journeyRecorder?.state!=='recording')return;
   try{
    journeyRecorder.pause();
    journeyPausedClock=performance.now();journeyFinalMs=journeyElapsedMs();
    journeyPhase='paused';
    if(journeyTickTimer){clearInterval(journeyTickTimer);journeyTickTimer=null}
    if(journeyStopTimer){clearTimeout(journeyStopTimer);journeyStopTimer=null}
    emitJourneyState();render();
   }catch(e){tell('暂时无法暂停录音：'+String(e.message||e))}
  }
  function resumeJourney(){
   if(journeyPhase!=='paused'||journeyRecorder?.state!=='paused')return;
   try{
    journeyRecorder.resume();
    journeyPauseTotal+=Math.max(0,performance.now()-journeyPausedClock);
    journeyPausedClock=null;journeyPhase='recording';
    journeyTickTimer=setInterval(emitJourneyTick,250);
    journeyStopTimer=setTimeout(()=>finishJourney(),Math.max(0,15*60*1000-journeyElapsedMs()));
    emitJourneyState();render();emitJourneyTick();
   }catch(e){tell('暂时无法继续录音：'+String(e.message||e))}
  }
  function finishJourney(){
   if(!['recording','paused'].includes(journeyPhase)||!journey||!['recording','paused'].includes(journeyRecorder?.state))return;
   if(rerecordOriginal&&journey.reference!==rerecordOriginal.journey.reference){
    if(!window.confirm('本次实际朗读的是「'+journey.reference+'」，与上次的「'+rerecordOriginal.journey.reference+'」不同。确定将当前这份未形成正式领受的读经档案更新为本次经文范围及原声吗？取消可继续朗读或放弃本遍，旧原声仍保留。')){
     tell('尚未替换原录音。可以继续读，或点击「这遍重来」。');return;
    }
   }
   journeyFinalMs=journeyElapsedMs();journeyPhase='finalizing';emitJourneyState();render();
   try{journeyRecorder.stop()}catch(e){journeyFail('录音停止失败：'+String(e.message||e))}
  }
  document.addEventListener('mygrass:journey-start-request',e=>{void startJourney(e.detail?.point)});
  document.addEventListener('mygrass:journey-advance-request',e=>advanceJourney(e.detail?.point));
  document.addEventListener('mygrass:journey-pause-request',()=>pauseJourney());
  document.addEventListener('mygrass:journey-resume-request',()=>resumeJourney());
  document.addEventListener('mygrass:journey-end-request',()=>finishJourney());
  window.addEventListener('beforeunload',e=>{if(['arming','recording','paused','finalizing'].includes(journeyPhase)){e.preventDefault();e.returnValue=''}});

  root.addEventListener('input',e=>{
   const field=e.target.dataset.field;
   const v=e.target.value;
   if(field==='reference'||field==='translation'||field==='scriptureText'){
    draft.scripture[field==='scriptureText'?'text':field]=v;persistDraft();
   }else if(field==='reflection'){draft.reflection=v;persistDraft()}
   else if((field==='heardText'||field==='todayText')&&!draft.insightRecord){draft.insightDraft=draft.insightDraft||{heardText:'',todayText:''};draft.insightDraft[field]=v;persistDraft()}
   else if(field==='lightNote'&&focusLight){draft.lightDraft=draft.lightDraft||{};draft.lightDraft[focusLight]=v;persistDraft()}
   else if(e.target.id==='gsMicroText'){
    microDraft=v;const node=$('#gsMicroCount');if(node)node.textContent=C.count(v)+' / 80字';
   }
  });
  root.addEventListener('input',e=>{
   if(!e.target?.matches?.('[data-dsp-denoise-strength]'))return;
   const value=Number(e.target.value);
   if(!Number.isFinite(value))return;
   denoiseStrength=Math.max(0,Math.min(100,value));
   const wrap=e.target.closest('.gs-dsp-knob-wrap');
   if(wrap)wrap.style.setProperty('--knob-angle',(-135+denoiseStrength*2.7)+'deg');
   const label=root.querySelector('.gs-dsp-denoise-value');
   if(label)label.textContent='基础降噪 · '+denoiseStrength+'%';
   applyDenoiseSetting();
  });
  root.addEventListener('input',e=>{
   const band=e.target?.dataset?.dspEqBand;
   if(!['low','mid','high'].includes(band))return;
   const value=Number(e.target.value);
   if(!Number.isFinite(value))return;
   eqBands[band]=Math.max(-12,Math.min(12,value));
   const control=e.target.closest('.gs-eq-control');
   if(control)control.style.setProperty('--knob-angle',(-135+(eqBands[band]+12)*11.25)+'deg');
   const label=root.querySelector('.gs-eq-values');
   if(label)label.textContent='低 '+(eqBands.low>0?'+':'')+eqBands.low+' / 中 '+(eqBands.mid>0?'+':'')+eqBands.mid+' / 高 '+(eqBands.high>0?'+':'')+eqBands.high+' dB';
   applyDspSettings();
  });
  root.addEventListener('input',e=>{
   const knob=e.target?.dataset?.dspCompControl;
   if(knob!=='threshold'&&knob!=='ratio')return;
   const number=Number(e.target.value);
   if(!Number.isFinite(number))return;
   if(knob==='threshold')compThreshold=Math.max(-48,Math.min(0,Math.round(number)));
   else compRatio=Math.max(1,Math.min(8,Math.round(number*2)/2));
   const container=e.target.closest('.gs-comp-control');
   if(container)container.style.setProperty('--knob-angle',(knob==='threshold'?-135+(compThreshold+48)*5.625:-135+(compRatio-1)*38.5714)+'deg');
   const label=root.querySelector('.gs-comp-values');
   if(label)label.textContent=compThreshold+' dB · '+compRatio+':1';
   applyDspSettings();
  });
  root.addEventListener('input',e=>{
   const control=e.target?.dataset?.dspReverbControl;
   if(control!=='room'&&control!=='mix')return;
   const value=Number(e.target.value);
   if(!Number.isFinite(value))return;
   if(control==='room')reverbRoom=Math.max(0,Math.min(100,Math.round(value/5)*5));
   else reverbMix=Math.max(0,Math.min(40,Math.round(value/2)*2));
   const wrapper=e.target.closest('.gs-reverb-control');
   if(wrapper)wrapper.style.setProperty('--knob-angle',(control==='room'?-135+reverbRoom*2.7:-135+reverbMix*6.75)+'deg');
   const label=root.querySelector('.gs-reverb-values');
   if(label)label.textContent='ROOM '+reverbRoom+' · MIX '+reverbMix+'%';
   const m=denoiseMonitor;
   if(control==='room'&&m?.convolver&&m.context?.state!=='closed'){
    try{m.convolver.buffer=makeVoiceRoomImpulse(m.context,reverbRoom)}
    catch(e){tell('混响空间更新失败，原声未受影响：'+String(e?.message||e))}
   }
   applyDspSettings();
  });
  root.addEventListener('click',async e=>{
   const b=e.target.closest('button[data-action]');
   if(!b){if(e.target?.classList?.contains('gs-light-orbit')&&focusLight){focusLight=null;render()}return}
   switch(b.dataset.action){
    case 'tab': setTab(b.dataset.tab);break;
    case 'scripture-nav': showBibleNav();break;
    case 'record':await startOrStopRecording();break;
    case 'play':await togglePlayback();break;
    case 'dsp-denoise':await toggleDenoisePreview();break;
    case 'dsp-eq':await toggleEqPreview();break;
    case 'dsp-comp':await toggleCompPreview();break;
    case 'dsp-reverb':await toggleReverbPreview();break;
    case 'rerecord':rerecordAudio();break;
    case 'cancel-rerecord':cancelRerecord();break;
    case 'restart-current-take':restartCurrentTake();break;
    case 'link-audio':linkRecording();break;
    case 'download-audio':await exportAudio();break;
    case 'export':exportTextArchive();break;
    case 'save':saveEntry();break;
    case 'finalize-insight':finalizeInsight();break;
    case 'light-focus':if(draft.insightRecord){focusLight=b.dataset.light;render()}break;
    case 'light-reset':focusLight=null;render();break;
    case 'light-add':addLightRelation();break;
    case 'light-reply':addInboundEvent(b.dataset.relationId);break;
    case 'next-reflection':if(journeyPhase!=='completed'){tell('请先完成今日读经。');break}setTab('reflection');break;
    case 'next-sharing':if(!draft.insightRecord){tell('先写下领受，点亮「领」。');break}setTab('sharing');break;
    case 'archive':if(['arming','recording','paused','finalizing'].includes(journeyPhase)){tell('请先结束今日读经。');break}archiveOpen=true;render();break;
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
  function openResidentWorkspace(){
   // The outer shell intercepts clicks for a fresh server entitlement read,
   // then opens the original folio through a verified custom event. A native
   // grassBookBtn click is no longer guaranteed to reach this script.
   if(!residentAccess()||!residentScope()){
    tell('请先通过步道卡激活「我的牧草」。');return;
   }
   root.hidden=false;
   if(loadForIdentity()){
    if(rerecordOriginal){render();return}
    journey=draft.readingJourney||null;
    journeyPhase=journey?.status==='completed'?'completed':'idle';
    journeyFinalMs=journey?.durationMs||0;
    C.setRuntimeReadingJourney(journey);
    emitJourneyState();
    render(); // AFTER openBook has made the original V0.4 folio visible.
   }
  }
  entryButton.addEventListener('click',openResidentWorkspace);
  window.addEventListener('pasture-open-grass-after-check-v1',openResidentWorkspace);
  document.addEventListener('pasture-resident-access-changed',()=>{
   const nextScope=residentScope();
   if(nextScope&&scope===nextScope&&draft)return;
   // A logout, account switch or loss of entitlement must revoke access even
   // if a recording is in progress. In-flight onstop must never save to a new user.
   ++journeyAttemptToken;
   journeyPhase='error';
   try{if(journeyRecorder?.state!=='inactive')journeyRecorder?.stop()}catch(e){}
   releaseJourneyStream();
   try{if(recorder?.state==='recording')recorder.stop()}catch(e){}
   clearPlayer();
   scope='';key='';draft=null;entries=[];micros=[];lightGraph={relations:[],events:[]};
   rerecordOriginal=null;journey=null;C.setRuntimeReadingJourney(null);focusLight=null;tab='reading';archiveOpen=false;
   document.body.classList.remove('grassbook-open');
   document.getElementById('skyZone')?.classList.remove('book-open');
   entryButton.classList.remove('grass-active');
   root.innerHTML='';root.hidden=true;
   if(nextScope){
    root.hidden=false;
    if(loadForIdentity()){
     journey=draft.readingJourney||null;journeyPhase=journey?.status==='completed'?'completed':'idle';
     journeyFinalMs=journey?.durationMs||0;C.setRuntimeReadingJourney(journey);emitJourneyState();
    }
   }
  });
  window.addEventListener('pagehide',()=>{
   ++journeyAttemptToken;
   if(journeyRecorder?.state&&journeyRecorder.state!=='inactive'){
    try{journeyRecorder.stop()}catch(_){}
   }
   releaseJourneyStream();
   if(recorder?.state==='recording')recorder.stop();
   clearPlayer();
   recordStream?.getTracks().forEach(t=>t.stop());
  });
  // Init lazily: the main pasture iframe may be present before its six-axis identity is assigned.
  root.hidden=true;
  // Private data is loaded only after the parent email session AND server-side
  // step-card entitlement are present. Registration alone never opens the folio.
  if(residentScope()){
   root.hidden=false;loadForIdentity();journey=draft.readingJourney||null;
   journeyPhase=journey?.status==='completed'?'completed':'idle';
   journeyFinalMs=journey?.durationMs||0;C.setRuntimeReadingJourney(journey);emitJourneyState();render();
  }
})();
