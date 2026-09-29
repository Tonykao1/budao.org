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
   reflection:''
  }}
  let scope='',key='',draft,entries=[],micros=[],tab='reading',archiveOpen=false,editingSavedId=null;
  let recorder=null,recordStream=null,recordChunks=[],recordStart=0,recordLimit=null,activeAudioURL=null;
  let audioPending=false,notice='';

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
  function showBibleNav(){
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
  function commitBibleNav(){
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
   if(audioPending||recorder?.state==='recording'){tell('请先结束录音，再保存对应的经文与声音。');return null}
   const previous=getEntry(),input={scripture:draft.scripture,reflection:draft.reflection,reading:draft.reading};
   try{
    const next=previous?C.reviseEntry(previous,input,iso()):C.newEntry(input,iso(),draft.id);
    if(previous)entries=entries.map(e=>e.id===next.id?next:e);
    else entries.unshift(next);
    editingSavedId=next.id;
    saveAll();persistDraft();tell('已保存到本机个人古卷。经文文字、原声和笔记已建立关联。');
    return next;
   }catch(e){tell(e.message||String(e));return null}
  }
  function setTab(next){if(!C.PHASES.includes(next))return;closeBibleNav();tab=next;archiveOpen=false;render();}
  function insertArchiveText(){
   const groups=C.groupByReference(entries);
   if(!groups.length)return '<p class="gs-empty">还没有正式保存的记录。每一次真实阅读，都可以从这里开始。</p>';
   return '<div class="gs-archive">'+groups.map(g=>'<div><h4>'+escape(g.reference)+'</h4>'+
    g.entries.map(e=>'<button type="button" data-action="open-entry" data-id="'+escape(e.id)+'" aria-current="'+(draft.id===e.id)+'">'+
    '<strong>'+escape((e.reflection?.text||e.scripture.text||'尚待补录').slice(0,42))+'</strong>'+
    '<span class="gs-archive-date">'+escape(datetime(e.createdAt))+(e.legacy?' · 旧版笔记已保留':'')+'</span></button>').join('')+'</div>').join('')+'</div>';
  }
  function stageReading(){
   return '<p class="gs-intro">从一段经文开始。文字与本人原声一一关联；未接入授权译本前，由你自行录入或粘贴经文，系统不擅自代写。</p>'+
    '<div class="gs-grid"><div class="gs-panel"><h3>经文文字</h3>'+
    '<label class="gs-field">经文出处<input data-field="reference" maxlength="96" placeholder="例如：诗篇 23:1" value="'+escape(draft.scripture.reference)+'"></label>'+
    '<label class="gs-field">译本及来源标注<input data-field="translation" maxlength="64" placeholder="填写实际使用的译本" value="'+escape(draft.scripture.translation)+'"></label>'+
    '<label class="gs-field">今日阅读的经文<textarea class="gs-large" data-field="scriptureText" maxlength="10000" placeholder="请粘贴你实际阅读、有权使用的经文文字。">'+escape(draft.scripture.text)+'</textarea></label>'+
    '<p class="gs-small">经文原文与个人领受独立保存。请确认出处和译本；预览版尚未接入全文圣经授权服务。</p>'+
    '</div><div class="gs-panel"><h3>我亲自朗读的声音</h3>'+
    '<span class="gs-badge">真人原声</span><p class="gs-small">只有点击录音后，浏览器才会申请麦克风许可；朗读不会被自动上传或用于训练模型。</p>'+
    '<div class="gs-actions"><button class="gs-action" type="button" data-action="record" '+(audioPending?'disabled':'')+'>'+(recorder?.state==='recording'?'结束朗读':'开始朗读')+'</button>'+
    '<button class="gs-action secondary" type="button" data-action="play" '+(!draft.reading.audioId?'disabled':'')+'>回听录音</button>'+'<button class="gs-action secondary" type="button" data-action="download-audio" '+(!draft.reading.audioId?'disabled':'')+'>导出原声</button></div>'+
    '<div id="gsAudioHost" aria-live="polite"></div>'+
    '<label class="gs-checkbox"><input type="checkbox" data-field="audioVerified" '+(draft.scripture.verifiedAgainstRecording?'checked':'')+'>'+
    '<span>我已确认：经文出处、录入文字与本人朗读相对应。</span></label>'+
    '<p class="gs-voice-note">未来可在单独授权下，以朗读文字与原声建立专属声音模型。目前仅保留训练所需的原始资产，不提供或默认同意语音克隆。</p>'+
    '<div class="gs-actions"><button class="gs-action" type="button" data-action="save">保存本次领受</button>'+
    '<button class="gs-action secondary" type="button" data-action="next-reflection">继续默想 →</button></div></div></div>';
  }
  function stageReflection(){
   return '<p class="gs-intro">原始笔记是母本。这里可以只有一句话，也可以写下完整默想；不要求重新录制心得。</p>'+
    '<div class="gs-grid"><div class="gs-panel"><h3>今日默想</h3>'+
    '<div class="gs-small">对应经文：<strong>'+escape(draft.scripture.reference||'尚未选择')+'</strong></div>'+
    '<label class="gs-field">我读到、想到、疑惑或愿意回应的事<textarea class="gs-large" rows="7" maxlength="12000" data-field="reflection" placeholder="写下真实的领受。无需迎合任何评分或格式。">'+escape(draft.reflection)+'</textarea></label>'+
    '<p class="gs-small">原始文字由你亲自书写，不会自动被 AI 改写；私密保存，不自动分享到任何人。</p>'+
    '<div class="gs-actions"><button class="gs-action" type="button" data-action="save">保存灵修笔记</button>'+
    '<button class="gs-action secondary" type="button" data-action="next-sharing">去看看微分享 →</button></div></div>'+
    '<div class="gs-panel"><h3>默想的声音</h3>'+
    '<span class="gs-badge">专属声音模型 · 尚未接入</span>'+
    '<p class="gs-small">我们将来希望在你单独授权之后，让既有文字笔记以你的专属声音呈现，不要求你重复录制每篇心得。</p>'+
    '<div class="gs-voice-note"><strong>三项分别授权：</strong><br>① 是否训练个人声音<br>② 是否生成仅供本人听取的合成心得<br>③ 是否允许对外分享合成音频<br>当前三项均为关闭状态。</div>'+
    '<div class="gs-rule"></div><h4>自己的时间轴</h4><p class="gs-small">当同一节经文再次出现，你可以主动翻开过去的默想，不由算法替你作出属灵判断。</p>'+
    '<button class="gs-smallbutton" type="button" data-action="archive">翻阅个人古卷</button></div></div>';
  }
  function stageSharing(){
   const saved=getEntry();
   const associated=micros.filter(m=>m.entryId===draft.id);
   return '<p class="gs-intro">微分享不是自动生产的讲道。只从你已保存、亲自确认的默想中留下一句话。默认私人收藏，不会自动上传互联网。</p>'+
    '<div class="gs-grid"><div class="gs-panel"><h3>一粒牧草 · 不超过80字</h3>'+
    '<div class="gs-small">经文出处：<strong>'+escape(draft.scripture.reference||'尚未选择')+'</strong>　'+(saved?'<span class="gs-badge">母本已保存</span>':'<span class="gs-badge">请先保存母本</span>')+'</div>'+
    '<div class="gs-note-source">'+escape(draft.reflection||'你的个人默想仍是空白。在「默想｜沉淀」留下真实的领受后，再挑选值得分享的一句话。')+'</div>'+
    '<label class="gs-field">从母本选择、修改并亲自审核的微分享<textarea id="gsMicroText" class="gs-micro" maxlength="120" placeholder="例如：一个真实的领受，可能只有一句话。">'+escape(microDraft)+'</textarea></label>'+
    '<div class="gs-meter" id="gsMicroCount">'+C.count(microDraft)+' / 80字</div>'+
    '<div class="gs-actions"><button class="gs-action secondary" type="button" data-action="suggest-micro">从原文摘出一句</button>'+
    '<button class="gs-action" type="button" data-action="save-micro" '+(!saved?'disabled':'')+'>保存为私人微分享</button></div>'+
    '<p class="gs-small">这里只生成文字作品草稿。未来的声音版本须待个人模型接入后由本人审核，且要另外授权公开。</p></div>'+
    '<div class="gs-panel"><h3>逐渐长成的个人牧养档案</h3>'+
    '<p class="gs-small">同一节经文的历次阅读和心得，会在时间里自然相连。不以点赞、发布量或阅读天数给人评分。</p>'+
    '<span class="gs-badge">此条记录的微分享</span>'+
    (associated.length?'<div class="gs-archive">'+associated.map(m=>
       '<button type="button" data-action="copy-micro" data-id="'+escape(m.id)+'">'+escape(m.text)+
       '<span class="gs-archive-date">本人审核 · 私人保存 · '+escape(datetime(m.createdAt))+' · 点击复制</span></button>').join('')+'</div>':
       '<div class="gs-empty">从一粒真实的牧草开始。它首先属于你。</div>')+
    '<div class="gs-rule"></div><button class="gs-smallbutton" type="button" data-action="archive">按经文翻阅自己的积累</button></div></div>';
  }
  let microDraft='';
  function render(){
   if(!document.body.classList.contains('grassbook-open'))return;
   let tabs=[['reading','读经｜领受'],['reflection','默想｜沉淀'],['sharing','分享｜牧养']];
   root.innerHTML=
    '<div class="gs-head"><div><div class="gs-head-title">我的牧草</div><div class="gs-head-sub">一生的灵修与牧养成长档案</div></div>'+
    '<nav class="gs-steps" aria-label="我的牧草三个阶段">'+tabs.map(([id,name])=>'<button type="button" data-action="tab" data-tab="'+id+'" aria-selected="'+(tab===id)+'">'+name+'</button>').join('')+'</nav></div>'+
    '<div class="gs-stage">'+(archiveOpen?'<p class="gs-intro">同一节经文在不同日子留下的文字与声音，由你自己决定何时回看。</p>'+insertArchiveText():
      tab==='reading'?stageReading():tab==='reflection'?stageReflection():stageSharing())+'</div>'+
    '<footer class="gs-foot"><span><strong>本机私密预览</strong> · 文字保存在此浏览器，音频保存在本机音频库；尚无云同步或公开发布。</span>'+
    '<div class="gs-actions"><button class="gs-smallbutton" type="button" data-action="export">导出我的文字档案</button>'+'<button class="gs-smallbutton" type="button" data-action="'+(archiveOpen?'return-stage':'archive')+'">'+(archiveOpen?'返回本次灵修':'翻阅档案')+'</button></div></footer>'+
    '<div class="gs-status" id="gsStatus" aria-live="polite">'+escape(notice)+'</div>';
   if(tab==='reading'&&!archiveOpen&&draft.reading.audioId)restoreAudio(draft.reading.audioId);
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
  function clearPlayer(){if(activeAudioURL){URL.revokeObjectURL(activeAudioURL);activeAudioURL=null}}
  async function restoreAudio(id){
   const host=$('#gsAudioHost');if(!host)return;
   try{
    const blob=await getAudio(id);
    if(!$('#gsAudioHost'))return;
    if(!blob){host.textContent='本机没有找到对应原声。请重新录制，避免把不存在的音频标记为已保存。';return}
    clearPlayer();activeAudioURL=URL.createObjectURL(blob);
    const player=document.createElement('audio');player.controls=true;player.preload='metadata';player.src=activeAudioURL;
    host.replaceChildren(player);
    const label=document.createElement('span');label.className='gs-small';label.textContent='原始朗读 · '+Math.max(1,Math.round(blob.size/1024))+' KB · 仅当前浏览器';host.appendChild(label);
   }catch(e){host.textContent='无法读取本机原声：'+String(e.message||e)}
  }
  async function startOrStopRecording(){
   if(recorder?.state==='recording'){recorder.stop();return}
   if(audioPending)return;
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
       tell('原声已保存在本机，请回听并核对经文文字，再保存本次领受。');
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
   if(recorder?.state==='recording'){tell('请先结束当前录音，再翻阅其他记录。');return}
   draft={id:found.id,scripture:{...found.scripture},reading:{...found.reading},
    reflection:found.reflection?.text||''};
   editingSavedId=found.id;microDraft='';persistDraft();archiveOpen=false;tab='reading';
   tell('已翻开 '+found.scripture.reference+' 的灵修档案。');render();
  }
  function openNewEntry(){
   if(recorder?.state==='recording'){tell('请先结束当前录音。');return}
   clearPlayer();draft=emptyDraft(refFromOriginal());editingSavedId=null;microDraft='';
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
  root.addEventListener('change',e=>{
   if(e.target.dataset.field==='audioVerified'){
    draft.scripture.verifiedAgainstRecording=!!e.target.checked&&!!draft.reading.audioId;persistDraft();
   }
  });
  root.addEventListener('click',async e=>{
   const b=e.target.closest('button[data-action]');if(!b)return;
   switch(b.dataset.action){
    case 'tab': setTab(b.dataset.tab);break;
    case 'scripture-nav': showBibleNav();break;
    case 'record':await startOrStopRecording();break;
    case 'play':await restoreAudio(draft.reading.audioId);$('#gsAudioHost audio')?.play?.().catch(()=>{});break;
    case 'download-audio':await exportAudio();break;
    case 'export':exportTextArchive();break;
    case 'save':saveEntry();break;
    case 'next-reflection':setTab('reflection');break;
    case 'next-sharing':setTab('sharing');break;
    case 'archive':archiveOpen=true;render();break;
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
  loadForIdentity();
  render();
})();
