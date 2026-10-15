/*
 * 我的牧草 V0.1 — pure data/provenance rules.
 * No scripture translation bundle, no cloud sync and no voice training in this module.
 */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else {
    root.MyGrassCore = core;
    if(root&&root.document){
      const loadReadingLayer=()=>{
        if(root.document.querySelector('script[data-my-grass-reading-v1]'))return;
        const script=root.document.createElement('script');
        script.src='/pasture-preview/my-grass-reading-v1.js';
        script.defer=true;
        script.dataset.myGrassReadingV1='1';
        root.document.head.appendChild(script);
      };
      if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout(loadReadingLayer,0),{once:true});
      else root.setTimeout(loadReadingLayer,0);
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA_VERSION = 1;
  const MICRO_LIMIT = 80;
  const STORAGE_PREFIX = 'budao.my-grass.v1';
  const PHASES = Object.freeze(['reading', 'reflection', 'sharing']);
  const ESV_NAME = 'English Standard Version (ESV)';
  let runtimeReadingSession=null;
  let runtimeReadingRequired=false;
  const BIBLE_OSIS = Object.freeze({
    '创':'GEN','创世记':'GEN','出':'EXO','出埃及记':'EXO','利':'LEV','利未记':'LEV','民':'NUM','民数记':'NUM','申':'DEU','申命记':'DEU',
    '书':'JOS','约书亚记':'JOS','士':'JDG','士师记':'JDG','得':'RUT','路得记':'RUT','撒上':'1SA','撒母耳记上':'1SA','撒下':'2SA','撒母耳记下':'2SA',
    '王上':'1KI','列王纪上':'1KI','王下':'2KI','列王纪下':'2KI','代上':'1CH','历代志上':'1CH','代下':'2CH','历代志下':'2CH','拉':'EZR','以斯拉记':'EZR',
    '尼':'NEH','尼希米记':'NEH','斯':'EST','以斯帖记':'EST','伯':'JOB','约伯记':'JOB','诗':'PSA','诗篇':'PSA','箴':'PRO','箴言':'PRO','传':'ECC','传道书':'ECC',
    '歌':'SNG','雅歌':'SNG','赛':'ISA','以赛亚书':'ISA','耶':'JER','耶利米书':'JER','哀':'LAM','耶利米哀歌':'LAM','结':'EZK','以西结书':'EZK','但':'DAN','但以理书':'DAN',
    '何':'HOS','何西阿书':'HOS','珥':'JOL','约珥书':'JOL','摩':'AMO','阿摩司书':'AMO','俄':'OBA','俄巴底亚书':'OBA','拿':'JON','约拿书':'JON','弥':'MIC','弥迦书':'MIC',
    '鸿':'NAM','那鸿书':'NAM','哈':'HAB','哈巴谷书':'HAB','番':'ZEP','西番雅书':'ZEP','该':'HAG','哈该书':'HAG','亚':'ZEC','撒迦利亚书':'ZEC','玛':'MAL','玛拉基书':'MAL',
    '太':'MAT','马太福音':'MAT','可':'MRK','马可福音':'MRK','路':'LUK','路加福音':'LUK','约':'JHN','约翰福音':'JHN','徒':'ACT','使徒行传':'ACT','罗':'ROM','罗马书':'ROM',
    '林前':'1CO','哥林多前书':'1CO','林后':'2CO','哥林多后书':'2CO','加':'GAL','加拉太书':'GAL','弗':'EPH','以弗所书':'EPH','腓':'PHP','腓立比书':'PHP','西':'COL','歌罗西书':'COL',
    '帖前':'1TH','帖撒罗尼迦前书':'1TH','帖后':'2TH','帖撒罗尼迦后书':'2TH','提前':'1TI','提摩太前书':'1TI','提后':'2TI','提摩太后书':'2TI','多':'TIT','提多书':'TIT','门':'PHM','腓利门书':'PHM',
    '来':'HEB','希伯来书':'HEB','雅':'JAS','雅各书':'JAS','彼前':'1PE','彼得前书':'1PE','彼后':'2PE','彼得后书':'2PE','约壹':'1JN','约翰一书':'1JN','约贰':'2JN','约翰二书':'2JN',
    '约叁':'3JN','约翰三书':'3JN','犹':'JUD','犹大书':'JUD','启':'REV','启示录':'REV'
  });
  const trim = value => String(value ?? '').trim();
  const count = value => Array.from(trim(value)).length;
  function clip(value, limit) { return Array.from(trim(value)).slice(0, limit).join(''); }
  function validateRef(value) {
    const ref = trim(value);
    if (!ref || count(ref) > 96) throw new Error('请填写准确的经文出处（最多96字）。');
    return ref;
  }
  function normalizeVerseIds(value) {
    if (!Array.isArray(value)) return [];
    return value.map(v => trim(v)).filter(v => /^[1-3A-Z]{3}\.\d{1,3}\.\d{1,3}$/.test(v)).slice(0, 500);
  }
  function deriveVerseIds(reference) {
    const match = trim(reference).match(/^(.+?)\s*(\d+)(?::(\d+)(?:\s*[–—\-~至]\s*(\d+))?)?$/);
    if (!match || !match[3]) return [];
    const osis = BIBLE_OSIS[trim(match[1])];
    const chapter = Math.trunc(Number(match[2]));
    let start = Math.trunc(Number(match[3]));
    let end = Math.trunc(Number(match[4] || match[3]));
    if (!osis || !Number.isFinite(chapter) || chapter < 1 || !Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < 1) return [];
    if (start > end) [start, end] = [end, start];
    if (end - start >= 500) return [];
    return Array.from({length:end-start+1},(_,i)=>osis+'.'+chapter+'.'+(start+i));
  }
  function readingRef(book,chapter,start,end) {
    return start===end?book+' '+chapter+':'+start:book+' '+chapter+':'+start+'–'+end;
  }
  function validateReadingPoint(point) {
    const book=trim(point?.book),osis=BIBLE_OSIS[book],chapter=Math.trunc(Number(point?.chapter)),verse=Math.trunc(Number(point?.verse));
    const verseId=trim(point?.verseId);
    if(!book||!osis||!Number.isFinite(chapter)||chapter<1||!Number.isFinite(verse)||verse<1)throw new Error('阅读位置无效。');
    if(verseId!==osis+'.'+chapter+'.'+verse)throw new Error('阅读经节编号与书卷位置不一致。');
    return {book,osis,chapter,verse,verseId};
  }
  function normalizeReadingSession(value) {
    if(value==null)return null;
    const book=trim(value.book),osis=BIBLE_OSIS[book],chapter=Math.trunc(Number(value.chapter));
    const startVerse=Math.trunc(Number(value.startVerse)),endVerse=Math.trunc(Number(value.endVerse));
    const status=value.status==='completed'?'completed':'reading';
    if(!book||!osis||!Number.isFinite(chapter)||chapter<1||!Number.isFinite(startVerse)||startVerse<1||!Number.isFinite(endVerse)||endVerse<startVerse)throw new Error('阅读记录无效。');
    const startVerseId=osis+'.'+chapter+'.'+startVerse,endVerseId=osis+'.'+chapter+'.'+endVerse;
    const verseIds=Array.from({length:endVerse-startVerse+1},(_,i)=>osis+'.'+chapter+'.'+(startVerse+i));
    return {
      status,book,chapter,startVerse,endVerse,startVerseId,endVerseId,
      reference:readingRef(book,chapter,startVerse,endVerse),translation:clip(value.translation,64),
      verseIds,startedAt:trim(value.startedAt)||null,completedAt:status==='completed'?(trim(value.completedAt)||null):null
    };
  }
  function beginReadingSession(point,timestamp) {
    const p=validateReadingPoint(point);
    return normalizeReadingSession({status:'reading',book:p.book,chapter:p.chapter,startVerse:p.verse,endVerse:p.verse,translation:point.translation,startedAt:timestamp||new Date().toISOString()});
  }
  function setReadingSessionEnd(session,point) {
    const current=normalizeReadingSession(session),p=validateReadingPoint(point);
    if(!current||current.status!=='reading')throw new Error('请先从一节经文开始阅读。');
    if(p.book!==current.book||p.chapter!==current.chapter)throw new Error('一次阅读只能在同一章内完成。');
    if(p.verse<current.startVerse)throw new Error('结束节不能早于起始节。');
    return normalizeReadingSession({...current,status:'reading',endVerse:p.verse,endVerseId:p.verseId,completedAt:null});
  }
  function completeReadingSession(session,timestamp) {
    const current=normalizeReadingSession(session);
    if(!current)throw new Error('请先点击一节经文，从这一节开始。');
    return normalizeReadingSession({...current,status:'completed',completedAt:timestamp||new Date().toISOString()});
  }
  function setRuntimeReadingSession(value){
    runtimeReadingSession=normalizeReadingSession(value);
    return runtimeReadingSession;
  }
  function setReadingSessionRequired(value){runtimeReadingRequired=value===true;}
  function validateScripture(passage) {
    const reference = validateRef(passage?.reference);
    const translation = clip(passage?.translation, 64);
    const source = clip(passage?.source, 160);
    const incomingText = trim(passage?.text);
    const isLicensedEsv = translation === ESV_NAME || source === 'esv';

    if (!incomingText && !isLicensedEsv) throw new Error('请先录入所选经文的文字。');
    if (count(incomingText) > 10000) throw new Error('单条经文文字请勿超过10000字；可分段保存。');

    if (isLicensedEsv) {
      const suppliedVerseIds = normalizeVerseIds(passage?.verseIds);
      return {
        reference,
        text: '',
        translation: ESV_NAME,
        source: 'esv',
        storage: 'reference-only',
        verseIds: suppliedVerseIds.length ? suppliedVerseIds : deriveVerseIds(reference),
        enteredBy: 'licensed-live-source',
        verifiedAgainstRecording: passage?.verifiedAgainstRecording === true
      };
    }

    return {
      reference,
      text: incomingText,
      translation,
      source,
      enteredBy: 'user',
      verifiedAgainstRecording: passage?.verifiedAgainstRecording === true
    };
  }
  function normalizeReflection(value) {
    const text = trim(value);
    if (count(text) > 12000) throw new Error('单篇默想最多12000字，可另开一篇。');
    return text;
  }
  function newEntry(input, timestamp, id, allowMissingReading=false) {
    const now = timestamp || new Date().toISOString();
    if (!id || typeof id !== 'string') throw new Error('每份牧草须有独立编号。');
    const scripture = validateScripture(input?.scripture);
    const reflection = normalizeReflection(input?.reflection);
    const candidate=input&&Object.prototype.hasOwnProperty.call(input,'readingSession')?input.readingSession:runtimeReadingSession;
    const readingSession=normalizeReadingSession(candidate);
    if(runtimeReadingRequired&&!readingSession&&!allowMissingReading)throw new Error('请先完成本次阅读，再把领受收入个人古卷。');
    if(readingSession&&readingSession.status!=='completed')throw new Error('请先完成本次阅读。');
    return {
      version: SCHEMA_VERSION, id,
      createdAt: now, updatedAt: now,
      scripture,
      readingSession,
      reading: {
        kind: 'original-human-voice',
        audioId: input?.reading?.audioId || null,
        mimeType: input?.reading?.mimeType || null,
        size: Number(input?.reading?.size || 0),
        durationSeconds: Number(input?.reading?.durationSeconds || 0),
        trainingConsent: false,
        syntheticVoiceConsent: false,
        publicationConsent: false
      },
      reflection: { source: 'user-authored', text: reflection },
      shareIds: []
    };
  }
  function reviseEntry(previous, input, timestamp) {
    if (!previous || !previous.id) throw new Error('找不到对应牧草。');
    const allowLegacyMissing=!previous.readingSession;
    const revised = newEntry(input, timestamp, previous.id,allowLegacyMissing);
    return {...revised, createdAt: previous.createdAt, shareIds: [...(previous.shareIds || [])]};
  }
  function makeMicro(entry, quote, id, timestamp) {
    if (!entry || !entry.id) throw new Error('请先保存原始经文和默想。');
    const text = trim(quote);
    if (!text) throw new Error('请写下一句话。');
    if (count(text) > MICRO_LIMIT) throw new Error('一粒牧草最多80字；更长的内容请留在完整灵修笔记中。');
    if (!trim(entry.reflection?.text)) throw new Error('微分享需要关联一份真实的个人默想。');
    if (!id || typeof id !== 'string') throw new Error('微分享须有独立编号。');
    const now = timestamp || new Date().toISOString();
    return {
      version: SCHEMA_VERSION, id, entryId: entry.id,
      reference: entry.scripture.reference,
      text,
      source: 'user-reviewed-and-edited',
      origin: 'reflection',
      originalReflectionId: entry.id,
      visibility: 'private',
      status: 'private-draft',
      syntheticAudioId: null,
      approvedForPublicDistribution: false,
      createdAt: now, updatedAt: now
    };
  }
  function groupByReference(entries) {
    const result = new Map();
    for (const entry of entries || []) {
      const ref = trim(entry?.scripture?.reference);
      if (!ref) continue;
      const key = ref.replace(/\s+/g, '').replace(/[－—–]/g,'-');
      if (!result.has(key)) result.set(key,{reference:ref,entries:[]});
      result.get(key).entries.push(entry);
    }
    return [...result.values()].map(group=>({
      ...group,entries:[...group.entries].sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))
    }));
  }
  function scopeFromIdentity(state) {
    const v = state?.final;
    if (state?.phase !== 'active' || !v?.numberColor || !(v?.side || v?.color)) return 'unassigned-preview';
    const clean = (s)=>String(s||'').replace(/[^a-zA-Z0-9-]/g,'').slice(0,32);
    return [clean(state.seriesId||'CSCZ-001'),clean(v.suit),clean(v.rank),
            clean(v.numberColor),clean(v.dice),clean(v.side||v.color),clean(v.piece)].join('.');
  }
  function voicePermissions() { return Object.freeze({
    trainVoiceModel:false,
    synthesizePrivateReflection:false,
    distributeVoicePublicly:false
  }); }
  return Object.freeze({
    SCHEMA_VERSION,MICRO_LIMIT,STORAGE_PREFIX,PHASES,trim,count,clip,
    validateRef,validateScripture,normalizeReadingSession,beginReadingSession,setReadingSessionEnd,completeReadingSession,
    setRuntimeReadingSession,setReadingSessionRequired,normalizeReflection,newEntry,reviseEntry,
    makeMicro,groupByReference,scopeFromIdentity,voicePermissions
  });
});
