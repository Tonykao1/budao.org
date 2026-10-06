const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const protectedAssets=['identity','shopShade','shopWindow','boxShade','boxWindow','cardShade','topExit'];

test('login additions stay separate from protected mother-UI modules',()=>{
  const ui=fs.readFileSync('pasture-resident-ui-restore.js','utf8');
  for(const id of ['shopShade','shopWindow','boxShade','boxWindow','cardShade','topExit']){
    assert.doesNotMatch(ui,new RegExp(`id=["']${id}["']`),`resident UI restore must not recreate protected mother UI: ${id}`);
  }
  assert.match(ui,/restoreButtons/);
  assert.match(ui,/bindFiveFingerHand/);
});

test('login design freezes the approved mother UI as protected assets',()=>{
  const spec=fs.readFileSync('docs/superpowers/specs/2026-10-06-pasture-login-foundation-design.md','utf8');
  for(const token of ['天空七功能区','正式头像 / 身份卡','小铺','小匣','步道卡','收起 ×','44 只基础羊','返回步道首页树杈']){
    assert.match(spec,new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  }
  assert.match(spec,/只做加法，不做替换/);
  assert.match(spec,/禁止继续由 `pasture-resident-runtime` 动态重建/);
});

test('protected mother-UI contract remains explicit for integration work',()=>{
  assert.deepEqual(protectedAssets,['identity','shopShade','shopWindow','boxShade','boxWindow','cardShade','topExit']);
});
