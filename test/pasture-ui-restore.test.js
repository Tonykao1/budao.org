const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('pasture registration keeps the approved seven-button sky pixel zone in the mother UI',()=>{
  const loader=fs.readFileSync('pasture-resident-runtime.js','utf8');
  assert.match(loader,/pasture-approved-ui-shell\.js/);
  const ui=fs.readFileSync('pasture-approved-ui-shell.js','utf8');
  for(const label of ['归回自己','我的牧草','风闻有你','同路伙伴','信箱','步道卡','小匣']) assert.match(ui,new RegExp(label));
  assert.match(ui,/\.sky-zone\{position:fixed;z-index:20;left:0;right:0;top:0/);
  assert.match(ui,/grid-template-columns:repeat\(4,minmax\(132px,1fr\)\)/);
  assert.match(ui,/@media\(max-width:820px\)[\s\S]*grid-template-columns:1fr 1fr/);
  for(const color of ['#173f73','#fffaf0','#c8f09a','#aee77c']) assert.match(ui,new RegExp(color.replace('#','\\#'),'i'));
});

test('only the resident sheep exact hit pixels reveal the approved five-finger hand',()=>{
  const ui=fs.readFileSync('pasture-resident-ui-restore.js','utf8');
  assert.match(ui,/pastureResidentHitSvg/);
  assert.match(ui,/PIXEL_HAND_OPEN/);
  for(const x of ['10','17','24','31','38']) assert.match(ui,new RegExp(`x=%22${x}%22`));
  assert.match(ui,/pointerenter/);
  assert.match(ui,/pointerdown/);
});
