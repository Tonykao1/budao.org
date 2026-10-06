const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

function read(path){return fs.readFileSync(path,'utf8');}
const protectedAssets=['identity','shopShade','shopWindow','boxShade','boxWindow','cardShade','topExit'];

test('approved mother UI owns the visible pasture controls before login runtime loads',()=>{
  const loader=read('pasture-resident-runtime.js');
  assert.match(loader,/pasture-approved-ui-shell\.js/);
  assert.ok(loader.indexOf('pasture-approved-ui-shell.js')<loader.indexOf('pasture-resident-runtime-core.js'),'mother UI must load before resident runtime');
  const shell=read('pasture-approved-ui-shell.js');
  assert.match(shell,/(?:className=['"]sky-zone['"]|class=\\?['"]sky-zone\\?['"])/);
  assert.match(shell,/(?:className=['"]sky-ui['"]|class=\\?['"]sky-ui\\?['"])/);
  assert.match(shell,/(?:className=['"]identity pixel['"]|class=\\?['"]identity pixel\\?['"])/);
  assert.match(shell,/(?:className=['"]actions['"]|class=\\?['"]actions\\?['"])/);
  assert.match(shell,/public-screen/);
  for(const label of ['归回自己','我的牧草','风闻有你','同路伙伴','信箱','步道卡','小匣']) assert.match(shell,new RegExp(label));
});

test('resident runtime is a state adapter and does not create replacement mother UI',()=>{
  const core=read('pasture-resident-runtime-core.js');
  assert.doesNotMatch(core,/FEATURE_LABELS/);
  assert.doesNotMatch(core,/pastureResidentControls/);
  assert.doesNotMatch(core,/controls\.innerHTML/);
  assert.doesNotMatch(core,/data-feature/);
  for(const id of ['shopShade','shopWindow','boxShade','boxWindow','cardShade','topExit']) assert.doesNotMatch(core,new RegExp(id));
  assert.match(core,/pasture-auth-state/);
  assert.match(core,/pasture-resident-updated/);
});

test('temporary UI restore no longer reconstructs buttons or identity and keeps only resident hand behavior',()=>{
  const ui=read('pasture-resident-ui-restore.js');
  assert.doesNotMatch(ui,/BUTTONS\s*=/);
  assert.doesNotMatch(ui,/restoreButtons/);
  assert.doesNotMatch(ui,/pastureResidentIdentity/);
  assert.match(ui,/bindFiveFingerHand/);
  assert.match(ui,/PIXEL_HAND_OPEN/);
});

test('login design freezes the approved mother UI as protected assets',()=>{
  const spec=read('docs/superpowers/specs/2026-10-06-pasture-login-foundation-design.md');
  for(const token of ['天空七功能区','正式头像 / 身份卡','小铺','小匣','步道卡','收起 ×','44 只基础羊','返回步道首页树杈']) assert.match(spec,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(spec,/只做加法，不做替换/);
  assert.match(spec,/禁止继续由 `pasture-resident-runtime` 动态重建/);
});

test('protected mother-UI contract remains explicit for integration work',()=>{
  assert.deepEqual(protectedAssets,['identity','shopShade','shopWindow','boxShade','boxWindow','cardShade','topExit']);
});
