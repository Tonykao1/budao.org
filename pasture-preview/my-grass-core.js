/*
 * 我的牧草 V0.1 — pure data/provenance rules.
 * No scripture translation bundle, no cloud sync and no voice training in this module.
 */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.MyGrassCore = core;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SCHEMA_VERSION = 1;
  const MICRO_LIMIT = 80;
  const STORAGE_PREFIX = 'budao.my-grass.v1';
  const PHASES = Object.freeze(['reading', 'reflection', 'sharing']);
  const trim = value => String(value ?? '').trim();
  const count = value => Array.from(trim(value)).length;
  function clip(value, limit) { return Array.from(trim(value)).slice(0, limit).join(''); }
  function validateRef(value) {
    const ref = trim(value);
    if (!ref || count(ref) > 96) throw new Error('请填写准确的经文出处（最多96字）。');
    return ref;
  }
  function validateScripture(passage) {
    const reference = validateRef(passage?.reference);
    const text = trim(passage?.text);
    if (!text) throw new Error('请先录入所选经文的文字。');
    if (count(text) > 10000) throw new Error('单条经文文字请勿超过10000字；可分段保存。');
    return {
      reference,
      text,
      translation: clip(passage?.translation, 64),
      source: clip(passage?.source, 160),
      enteredBy: 'user',
      verifiedAgainstRecording: passage?.verifiedAgainstRecording === true
    };
  }
  function normalizeReflection(value) {
    const text = trim(value);
    if (count(text) > 12000) throw new Error('单篇默想最多12000字，可另开一篇。');
    return text;
  }
  function newEntry(input, timestamp, id) {
    const now = timestamp || new Date().toISOString();
    if (!id || typeof id !== 'string') throw new Error('每份牧草须有独立编号。');
    const scripture = validateScripture(input?.scripture);
    const reflection = normalizeReflection(input?.reflection);
    return {
      version: SCHEMA_VERSION, id,
      createdAt: now, updatedAt: now,
      scripture,
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
    const revised = newEntry(input, timestamp, previous.id);
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
      visibility: 'private', // V0.1 cannot publish remotely.
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
    validateRef,validateScripture,normalizeReflection,newEntry,reviseEntry,
    makeMicro,groupByReference,scopeFromIdentity,voicePermissions
  });
});
