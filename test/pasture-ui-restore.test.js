const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('pasture registration keeps the approved seven-button bottom pixel bar',()=>{
  const loader=fs.readFileSync('pasture-resident-runtime.js','utf8');
  assert.match(loader,/pasture-resident-ui-restore\.js/);
  const ui=fs.readFileSync('pasture-resident-ui-restore.js','utf8');
  for(const label of ['归回自己','我的牧草','风闻有你','同路伙伴','信箱','步道卡','小匣']) assert.match(ui,new RegExp(label));
  assert.match(ui,/bottom:/);
  assert.match(ui,/wood|木质|#6b472b|#7a5232/i);
});

test('only the resident sheep exact hit pixels reveal the approved five-finger hand',()=>{
  const ui=fs.readFileSync('pasture-resident-ui-restore.js','utf8');
  assert.match(ui,/pastureResidentHitSvg/);
  assert.match(ui,/PIXEL_HAND_OPEN/);
  for(const x of ['10','17','24','31','38']) assert.match(ui,new RegExp(`x=%22${x}%22`));
  assert.match(ui,/pointerenter/);
  assert.match(ui,/pointerdown/);
});
