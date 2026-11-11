'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../pasture-preview/my-grass-core.js');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const scope='pasture-resident-11111111-2222-3333-4444-555555555555';
const snapshot=options=>C.buildTextArchive({
 scope,draft:{id:'current-1',scripture:{reference:'诗 23:1',text:'正在编辑的本地经文',translation:'本地译文'},reflection:'刚写下的领受尚未正式归档',reading:{audioId:'voice-current'}},
 entries:[{id:'entry-1',scripture:{reference:'约 15:1',text:'已保存的经文',translation:'本地译文'},reflection:{text:'往日领受'},reading:{audioId:'voice-saved'}}],
 micros:[{id:'micro-1',text:'一粒牧草',visibility:'private'}],
 lightGraph:{relations:[{relation_id:'r1'}],events:[{event_id:'e1'}]},
 exportedAt:'2026-10-22T12:00:00.000Z',
 ...options
});
test('text archive v2 includes BOTH saved entries and the current unsaved private draft',()=>{
 const out=snapshot();
 assert.equal(out.format,'budao-my-grass');assert.equal(out.version,2);
 assert.equal(out.identityScope,scope);
 assert.equal(out.entries.length,1);
 assert.equal(out.entries[0].reflection.text,'往日领受');
 assert.equal(out.currentDraft.reflection,'刚写下的领受尚未正式归档');
 assert.equal(out.currentDraft.id,'current-1');
 assert.equal(out.micros.length,1);
 assert.equal(out.lightGraph.relations.length,1);
 assert.deepEqual(out.audioManifest.requiredAudioIds,['voice-saved','voice-current']);
 assert.equal(out.audioManifest.included,false);
 assert.match(out.notice,/非云端备份/);assert.match(out.notice,/音频未包含/);
});
test('export strips licensed ESV text from saved and draft copy, preserving reference and original local state',()=>{
 const draft={id:'draft',scripture:{reference:'约 3:16',text:'test ESV licensed text in old draft',source:'esv',translation:'English Standard Version (ESV)'},reading:{audioId:null}};
 const entries=[{id:'e',scripture:{reference:'约 3:17',text:'other old ESV text',translation:'English Standard Version (ESV)'}}];
 const out=snapshot({draft,entries});
 assert.equal(out.currentDraft.scripture.text,'');
 assert.equal(out.currentDraft.scripture.reference,'约 3:16');
 assert.equal(out.currentDraft.scripture.storage,'reference-only');
 assert.equal(out.entries[0].scripture.text,'');
 assert.equal(draft.scripture.text,'test ESV licensed text in old draft','never mutate resident original');
 assert.equal(entries[0].scripture.text,'other old ESV text','never mutate saved original');
});
test('no export without an authenticated resident scope and initialized draft',()=>{
 assert.throws(()=>snapshot({scope:''}),/登录/);
 assert.throws(()=>snapshot({scope:'unassigned-preview'}),/登录/);
 assert.throws(()=>snapshot({draft:null}),/尚未初始化/);
});
test('actual My Grass UI exports stable completed reading only and labels limitations accurately',()=>{
 const ui=read('pasture-preview/my-grass-v1.js');
 assert.match(ui,/C\.buildTextArchive\(\{scope,draft,entries,micros,lightGraph,exportedAt:iso\(\)\}\)/);
 assert.match(ui,/\['arming','recording','paused','finalizing'\]\.includes\(journeyPhase\)/);
 assert.match(ui,/原声音频仍须单独导出/);
 assert.match(ui,/本机私密 · 文字与当前稿可导出 · 原声另存/);
 assert.doesNotMatch(ui,/fetch\s*\(\s*['"]\/api\/my-grass/);
});
