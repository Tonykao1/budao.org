/* 我的牧草 · 圣经经文引擎 V0.5
 * 默认译本：1919《圣经和合本（神版）》简体。
 * 第二译本：English Standard Version (ESV)，正文经服务器代理从 Crossway ESV API 即时读取。
 * CUV 可按公版规则保存正文；ESV 只保存经文位置/译本标识，正文不写入本地古卷。
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else{
  root.MyGrassBible=api;
  if(root&&root.document)api.autoInstall(root);
 }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';

 const SOURCE_COMMIT='0bf4ed97ed6f115a37d9254d75f94bf97d0eab92';
 const cuvTranslation=Object.freeze({
  id:'cuv1919-shen-s',
  name:'圣经和合本（神版）',
  language:'zh-CN',
  year:1919,
  license:'Public Domain',
  storage:'local-text',
  source:'sangchy1972/pd-text-corpus · zh-Hans · CUV 1919',
  sourceCommit:SOURCE_COMMIT,
  stats:Object.freeze({books:66,chapters:1189,verses:31103})
 });
 const esvTranslation=Object.freeze({
  id:'esv',
  name:'English Standard Version (ESV)',
  language:'en',
  edition:2025,
  license:'Crossway ESV API terms',
  storage:'reference-only',
  endpoint:'/api/bible-esv',
  source:'Crossway ESV API'
 });
 const translations=Object.freeze({cuv:cuvTranslation,esv:esvTranslation});
 // Compatibility: existing code and saved tests expect `translation` to be the default CUV edition.
 const translation=cuvTranslation;

 // [简称, 中文书名, 章数, 稳定OSIS, 公版语料slug, ESV英文书卷名]
 const old=[
  ['创','创世记',50,'GEN','genesis','Genesis'],['出','出埃及记',40,'EXO','exodus','Exodus'],
  ['利','利未记',27,'LEV','leviticus','Leviticus'],['民','民数记',36,'NUM','numbers','Numbers'],
  ['申','申命记',34,'DEU','deuteronomy','Deuteronomy'],['书','约书亚记',24,'JOS','joshua','Joshua'],
  ['士','士师记',21,'JDG','judges','Judges'],['得','路得记',4,'RUT','ruth','Ruth'],
  ['撒上','撒母耳记上',31,'1SA','i-samuel','1 Samuel'],['撒下','撒母耳记下',24,'2SA','ii-samuel','2 Samuel'],
  ['王上','列王纪上',22,'1KI','i-kings','1 Kings'],['王下','列王纪下',25,'2KI','ii-kings','2 Kings'],
  ['代上','历代志上',29,'1CH','i-chronicles','1 Chronicles'],['代下','历代志下',36,'2CH','ii-chronicles','2 Chronicles'],
  ['拉','以斯拉记',10,'EZR','ezra','Ezra'],['尼','尼希米记',13,'NEH','nehemiah','Nehemiah'],
  ['斯','以斯帖记',10,'EST','esther','Esther'],['伯','约伯记',42,'JOB','job','Job'],
  ['诗','诗篇',150,'PSA','psalms','Psalms'],['箴','箴言',31,'PRO','proverbs','Proverbs'],
  ['传','传道书',12,'ECC','ecclesiastes','Ecclesiastes'],['歌','雅歌',8,'SNG','song-of-solomon','Song of Solomon'],
  ['赛','以赛亚书',66,'ISA','isaiah','Isaiah'],['耶','耶利米书',52,'JER','jeremiah','Jeremiah'],
  ['哀','耶利米哀歌',5,'LAM','lamentations','Lamentations'],['结','以西结书',48,'EZK','ezekiel','Ezekiel'],
  ['但','但以理书',12,'DAN','daniel','Daniel'],['何','何西阿书',14,'HOS','hosea','Hosea'],
  ['珥','约珥书',3,'JOL','joel','Joel'],['摩','阿摩司书',9,'AMO','amos','Amos'],
  ['俄','俄巴底亚书',1,'OBA','obadiah','Obadiah'],['拿','约拿书',4,'JON','jonah','Jonah'],
  ['弥','弥迦书',7,'MIC','micah','Micah'],['鸿','那鸿书',3,'NAM','nahum','Nahum'],
  ['哈','哈巴谷书',3,'HAB','habakkuk','Habakkuk'],['番','西番雅书',3,'ZEP','zephaniah','Zephaniah'],
  ['该','哈该书',2,'HAG','haggai','Haggai'],['亚','撒迦利亚书',14,'ZEC','zechariah','Zechariah'],
  ['玛','玛拉基书',4,'MAL','malachi','Malachi']
 ];
 const newTestament=[
  ['太','马太福音',28,'MAT','matthew','Matthew'],['可','马可福音',16,'MRK','mark','Mark'],
  ['路','路加福音',24,'LUK','luke','Luke'],['约','约翰福音',21,'JHN','john','John'],
  ['徒','使徒行传',28,'ACT','acts','Acts'],['罗','罗马书',16,'ROM','romans','Romans'],
  ['林前','哥林多前书',16,'1CO','i-corinthians','1 Corinthians'],['林后','哥林多后书',13,'2CO','ii-corinthians','2 Corinthians'],
  ['加','加拉太书',6,'GAL','galatians','Galatians'],['弗','以弗所书',6,'EPH','ephesians','Ephesians'],
  ['腓','腓立比书',4,'PHP','philippians','Philippians'],['西','歌罗西书',4,'COL','colossians','Colossians'],
  ['帖前','帖撒罗尼迦前书',5,'1TH','i-thessalonians','1 Thessalonians'],['帖后','帖撒罗尼迦后书',3,'2TH','ii-thessalonians','2 Thessalonians'],
  ['提前','提摩太前书',6,'1TI','i-timothy','1 Timothy'],['提后','提摩太后书',4,'2TI','ii-timothy','2 Timothy'],
  ['多','提多书',3,'TIT','titus','Titus'],['门','腓利门书',1,'PHM','philemon','Philemon'],
  ['来','希伯来书',13,'HEB','hebrews','Hebrews'],['雅','雅各书',5,'JAS','james','James'],
  ['彼前','彼得前书',5,'1PE','i-peter','1 Peter'],['彼后','彼得后书',3,'2PE','ii-peter','2 Peter'],
  ['约壹','约翰一书',5,'1JN','i-john','1 John'],['约贰','约翰二书',1,'2JN','ii-john','2 John'],
  ['约叁','约翰三书',1,'3JN','iii-john','3 John'],['犹','犹大书',1,'JUD','jude','Jude'],
  ['启','启示录',22,'REV','revelation-of-john','Revelation']
 ];
 const freezeEntry=v=>Object.freeze(v.slice());
 const groups=Object.freeze({old:Object.freeze(old.map(freezeEntry)),new:Object.freeze(newTestament.map(freezeEntry))});
 const all=Object.freeze([...groups.old,...groups.new]);
 const chapterCache=new Map();

 function resolve(abbrOrName){
  const s=String(abbrOrName||'').trim();
  return all.find(([short,name])=>short===s||name===s)||null;
 }
 function groupOf(abbr){return groups.old.some(([s,name])=>abbr===s||abbr===name)?'old':'new'}
 function bookMeta(book){
  const entry=resolve(book);if(!entry)throw Error('未识别圣经书卷。');
  return Object.freeze({abbr:entry[0],name:entry[1],chapters:entry[2],osis:entry[3],slug:entry[4],english:entry[5],testament:groupOf(entry[0])});
 }
 function clampChapter(book,value){
  const entry=resolve(book);if(!entry)throw Error('未识别圣经书卷。');
  const n=Math.trunc(Number(value));if(!Number.isFinite(n))return 1;
  return Math.min(entry[2],Math.max(1,n));
 }
 function format(book,chapter,start=1,end=1,whole=false){
  const entry=resolve(book);if(!entry)throw Error('未识别圣经书卷。');
  const ch=clampChapter(entry[0],chapter);
  if(whole)return entry[0]+' '+ch;
  const a=Math.trunc(Number(start)),b=Math.trunc(Number(end));
  if(!Number.isFinite(a)||!Number.isFinite(b)||a<1||b<1||a>176||b>176)throw Error('节数需要在1—176之间，并请按所用译本核对。');
  return a===b?entry[0]+' '+ch+':'+a:entry[0]+' '+ch+':'+Math.min(a,b)+'–'+Math.max(a,b);
 }
 function parse(reference){
  const s=String(reference||'').trim();
  const match=s.match(/^(.+?)\s*(\d+)(?::(\d+)(?:\s*[–—\-~至]\s*(\d+))?)?$/);
  if(!match)return null;
  const entry=resolve(match[1].trim());if(!entry)return null;
  const chapter=Number(match[2]);if(chapter<1||chapter>entry[2])return null;
  const whole=!match[3],start=whole?1:Number(match[3]),end=whole?1:Number(match[4]||match[3]);
  if(start<1||end<1||start>176||end>176)return null;
  return {testament:groupOf(entry[0]),book:entry[0],chapter,start,end,whole};
 }
 function normalizeState(referenceOrState){
  const state=typeof referenceOrState==='string'?parse(referenceOrState):referenceOrState;
  if(!state||!resolve(state.book))throw Error('请先选择有效的经文范围。');
  return state;
 }
 function normalizeReference(state){return format(state.book,state.chapter,state.start,state.end,state.whole)}
 function verseId(book,chapter,verse){
  const meta=bookMeta(book),ch=Math.trunc(Number(chapter)),v=Math.trunc(Number(verse));
  if(!Number.isFinite(ch)||ch<1||ch>meta.chapters)throw Error('章节超出书卷范围。');
  if(!Number.isFinite(v)||v<1)throw Error('节数必须从1开始。');
  return meta.osis+'.'+ch+'.'+v;
 }
 function verseIdsForState(state){
  if(state.whole)return [];
  const a=Math.min(state.start,state.end),b=Math.max(state.start,state.end),ids=[];
  for(let v=a;v<=b;v++)ids.push(verseId(state.book,state.chapter,v));
  return ids;
 }
 function toEnglishReference(referenceOrState){
  const state=normalizeState(referenceOrState),meta=bookMeta(state.book),ch=state.chapter;
  if(state.whole)return meta.english+' '+ch;
  const a=Math.min(state.start,state.end),b=Math.max(state.start,state.end);
  return a===b?meta.english+' '+ch+':'+a:meta.english+' '+ch+':'+a+'-'+b;
 }
 function chapterUrl(book,chapter){
  const meta=bookMeta(book),ch=Math.trunc(Number(chapter));
  if(!Number.isFinite(ch)||ch<1||ch>meta.chapters)throw Error('章节超出书卷范围。');
  return 'https://cdn.jsdelivr.net/gh/sangchy1972/pd-text-corpus@'+SOURCE_COMMIT+'/bibles/zh-Hans/books/'+meta.slug+'/chapters/'+ch+'.json';
 }
 function normalizeChapter(data){
  if(!data||!Array.isArray(data.verses)||!data.verses.length)throw Error('经文数据格式不完整。');
  const verses=data.verses.map(item=>({verse:Math.trunc(Number(item.verse)),text:String(item.text||'').trim()}));
  if(verses.some(v=>!Number.isFinite(v.verse)||v.verse<1||!v.text))throw Error('经文数据存在无效节。');
  return {verses};
 }
 async function loadChapter(book,chapter,fetchImpl){
  const meta=bookMeta(book),ch=clampChapter(meta.abbr,chapter),cacheKey=meta.osis+'.'+ch;
  if(chapterCache.has(cacheKey))return chapterCache.get(cacheKey);
  const fetcher=fetchImpl||(typeof fetch==='function'?fetch:null);if(!fetcher)throw Error('当前环境无法载入经文。');
  const pending=(async()=>{
   const response=await fetcher(chapterUrl(meta.abbr,ch),{cache:'force-cache'});
   if(!response||!response.ok)throw Error('经文载入失败'+(response&&response.status?'（HTTP '+response.status+'）':'')+'。');
   return normalizeChapter(await response.json());
  })();
  chapterCache.set(cacheKey,pending);
  try{const result=await pending;chapterCache.set(cacheKey,Promise.resolve(result));return result}
  catch(error){chapterCache.delete(cacheKey);throw error}
 }
 function extractPassage(book,chapter,chapterData,start=1,end=1,whole=false){
  const meta=bookMeta(book),ch=Math.trunc(Number(chapter));
  if(!Number.isFinite(ch)||ch<1||ch>meta.chapters)throw Error('章节超出书卷范围。');
  const verses=normalizeChapter(chapterData).verses,maxVerse=Math.max(...verses.map(v=>v.verse));
  let selected,reference;
  if(whole){selected=verses.slice();reference=meta.abbr+' '+ch}
  else{
   let a=Math.trunc(Number(start)),b=Math.trunc(Number(end));
   if(!Number.isFinite(a)||!Number.isFinite(b)||a<1||b<1||a>maxVerse||b>maxVerse)throw Error('本章只有 '+maxVerse+' 节，请重新选择。');
   if(a>b)[a,b]=[b,a];
   selected=verses.filter(v=>v.verse>=a&&v.verse<=b);
   if(!selected.length||selected[0].verse!==a||selected[selected.length-1].verse!==b)throw Error('所选经节在此译本中不存在。');
   reference=a===b?meta.abbr+' '+ch+':'+a:meta.abbr+' '+ch+':'+a+'–'+b;
  }
  return {reference,translation:translation.name,source:translation.id,verseIds:selected.map(v=>verseId(meta.abbr,ch,v.verse)),verses:selected,text:selected.map(v=>v.text).join('\n')};
 }
 async function loadPassage(referenceOrState,fetchImpl){
  const state=normalizeState(referenceOrState),chapter=await loadChapter(state.book,state.chapter,fetchImpl);
  return extractPassage(state.book,state.chapter,chapter,state.start,state.end,state.whole);
 }
 async function loadEsvPassage(referenceOrState,fetchImpl){
  const state=normalizeState(referenceOrState),reference=normalizeReference(state),canonicalRequest=toEnglishReference(state);
  const fetcher=fetchImpl||(typeof fetch==='function'?fetch:null);if(!fetcher)throw Error('当前环境无法载入 ESV 经文。');
  const response=await fetcher(esvTranslation.endpoint+'?reference='+encodeURIComponent(canonicalRequest),{cache:'no-store',headers:{Accept:'application/json'}});
  let data={};try{data=await response.json()}catch(e){}
  if(!response.ok){
   if(response.status===503&&data.reason==='esv_not_configured')throw Error('ESV API 尚未配置。请先在 Vercel 设置 ESV_API_KEY。');
   if(response.status===429)throw Error('ESV 经文请求暂时较多，请稍后再试。');
   throw Error('ESV 经文暂时无法载入。');
  }
  const text=String(data.text||'').trim();if(!text)throw Error('ESV 经文返回为空。');
  return {reference,canonical:String(data.canonical||canonicalRequest),translation:esvTranslation.name,source:esvTranslation.id,storage:esvTranslation.storage,verseIds:verseIdsForState(state),text,copyright:String(data.copyright||'ESV')};
 }
 function resolveTranslationId(value){
  const s=String(value||'').trim();
  if(s===esvTranslation.id||s===esvTranslation.name)return esvTranslation.id;
  return cuvTranslation.id;
 }
 async function loadTranslationPassage(referenceOrState,translationId,fetchImpl){
  return resolveTranslationId(translationId)===esvTranslation.id?loadEsvPassage(referenceOrState,fetchImpl):loadPassage(referenceOrState,fetchImpl);
 }
 function dispatchInput(node,doc){
  if(!node)return;const view=doc&&doc.defaultView,EventCtor=(view&&view.Event)||(typeof Event==='function'?Event:null);
  if(EventCtor)node.dispatchEvent(new EventCtor('input',{bubbles:true}));
 }
 function ensureTranslationPicker(doc,workspace,hiddenInput,onChange){
  let picker=workspace.querySelector('#gsTranslationPicker');
  if(!picker){
   picker=doc.createElement('select');picker.id='gsTranslationPicker';picker.className='gs-translation-picker';picker.setAttribute('aria-label','圣经译本');
   picker.innerHTML='<option value="'+cuvTranslation.id+'">'+cuvTranslation.name+'</option><option value="'+esvTranslation.id+'">'+esvTranslation.name+'</option>';
   hiddenInput.parentNode.insertBefore(picker,hiddenInput.nextSibling);
   picker.addEventListener('change',onChange);
  }
  return picker;
 }
 function installMyGrassIntegration(doc,options){
  if(!doc||typeof doc.querySelector!=='function')return ()=>{};
  const opts=options||{},translationLoader=opts.loadTranslationPassage||loadTranslationPassage;
  let stopped=false,lastKey='',requestToken=0,timer=null;
  const schedule=(delay=0)=>{
   if(stopped)return;if(timer!=null){const clear=(doc.defaultView&&doc.defaultView.clearTimeout)||clearTimeout;clear(timer)}
   const set=(doc.defaultView&&doc.defaultView.setTimeout)||setTimeout;timer=set(hydrate,delay);
  };
  async function hydrate(){
   timer=null;if(stopped)return;
   const workspace=doc.getElementById('grassWorkspace');if(!workspace)return;
   const ref=workspace.querySelector('[data-field="reference"]'),version=workspace.querySelector('[data-field="translation"]'),text=workspace.querySelector('[data-field="scriptureText"]');
   const reflection=workspace.querySelector('.gs-scripture-read');

   if(ref&&version&&text){
    let translationId=resolveTranslationId(version.value||workspace.dataset.scriptureTranslation);
    workspace.dataset.scriptureTranslation=translationId;
    version.value=translationId===esvTranslation.id?esvTranslation.name:cuvTranslation.name;
    version.readOnly=true;version.setAttribute('aria-readonly','true');version.style.display='none';version.tabIndex=-1;
    const picker=ensureTranslationPicker(doc,workspace,version,()=>{
     const nextId=resolveTranslationId(picker.value);workspace.dataset.scriptureTranslation=nextId;
     version.value=nextId===esvTranslation.id?esvTranslation.name:cuvTranslation.name;dispatchInput(version,doc);
     text.value='';delete text.dataset.scriptureSource;dispatchInput(text,doc);
     lastKey='';requestToken++;schedule(0);
    });
    picker.value=translationId;
    text.readOnly=true;text.setAttribute('aria-readonly','true');
    const reference=String(ref.value||'').trim();if(!parse(reference))return;
    workspace.dataset.scriptureReference=reference;

    if(translationId===esvTranslation.id&&text.value.trim()&&text.dataset.scriptureSource!=='esv'){
     text.value='';dispatchInput(text,doc);
    }
    const key=translationId+'|'+reference;
    if(key===lastKey&&text.value.trim())return;
    const token=++requestToken;lastKey=key;text.dataset.scriptureState='loading';
    text.placeholder='正在载入 '+(translationId===esvTranslation.id?esvTranslation.name:cuvTranslation.name)+'……';
    try{
     const passage=await translationLoader(reference,translationId);
     if(stopped||token!==requestToken||String(ref.value||'').trim()!==reference)return;
     version.value=passage.translation;dispatchInput(version,doc);
     text.value=passage.text;text.dataset.scriptureState='ready';text.dataset.scriptureSource=passage.source;text.dataset.verseIds=passage.verseIds.join(',');
     text.placeholder='已载入 '+passage.translation;
     if(passage.storage!=='reference-only')dispatchInput(text,doc);
    }catch(error){
     if(stopped||token!==requestToken)return;text.dataset.scriptureState='error';text.value='';
     text.placeholder=String(error&&error.message||error||'经文载入失败');
    }
    return;
   }

   if(reflection&&workspace.dataset.scriptureTranslation===esvTranslation.id&&workspace.dataset.scriptureReference){
    const reference=workspace.dataset.scriptureReference,key='reflection|esv|'+reference;
    if(key===lastKey&&reflection.dataset.scriptureSource==='esv')return;
    const token=++requestToken;lastKey=key;
    try{
     const passage=await translationLoader(reference,esvTranslation.id);
     if(stopped||token!==requestToken)return;
     reflection.textContent=passage.text;reflection.dataset.scriptureSource='esv';
    }catch(error){
     if(stopped||token!==requestToken)return;reflection.textContent=String(error&&error.message||'ESV 经文暂时无法载入。');
    }
   }
  }
  const clickHandler=e=>{if(e.target&&e.target.closest&&e.target.closest('button[data-nav="apply"]')){lastKey='';schedule(0)}};
  const inputHandler=e=>{if(e.target&&e.target.matches&&e.target.matches('[data-field="reference"]')){lastKey='';schedule(180)}};
  doc.addEventListener('click',clickHandler,true);doc.addEventListener('input',inputHandler,true);
  const ViewMutationObserver=doc.defaultView&&doc.defaultView.MutationObserver;
  const observer=ViewMutationObserver?new ViewMutationObserver(()=>schedule(0)):null;
  if(observer&&doc.documentElement)observer.observe(doc.documentElement,{childList:true,subtree:true});
  schedule(0);
  return ()=>{
   stopped=true;requestToken++;if(timer!=null){const clear=(doc.defaultView&&doc.defaultView.clearTimeout)||clearTimeout;clear(timer)}
   doc.removeEventListener('click',clickHandler,true);doc.removeEventListener('input',inputHandler,true);if(observer)observer.disconnect();
  };
 }
 function autoInstall(root){
  const run=()=>{if(root.__myGrassBibleInstalled)return;root.__myGrassBibleInstalled=true;root.__myGrassBibleCleanup=installMyGrassIntegration(root.document)};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',run,{once:true});else run();
 }
 function clearCache(){chapterCache.clear()}

 return Object.freeze({translation,translations,groups,resolve,groupOf,bookMeta,clampChapter,format,parse,verseId,toEnglishReference,chapterUrl,loadChapter,extractPassage,loadPassage,loadEsvPassage,loadTranslationPassage,installMyGrassIntegration,autoInstall,clearCache});
});
