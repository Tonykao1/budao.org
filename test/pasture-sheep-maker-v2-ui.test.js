const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=()=>fs.readFileSync('pasture-live.js','utf8');
const css=()=>fs.readFileSync('pasture-live.css','utf8');
const html=()=>fs.readFileSync('tonglu.html','utf8');

const dimensions=['woolColor','faceColor','woolShape','bodyShape','ears','expression','marking','forelock'];

test('maker shell loads shared DNA, renderer and i18n before pasture-live',()=>{
  const h=html();
  const dna=h.indexOf('/pasture-sheep-dna.js');
  const renderer=h.indexOf('/pasture-sheep-renderer.js');
  const i18n=h.indexOf('/pasture-sheep-i18n.js');
  const live=h.indexOf('/pasture-live.js');
  assert.ok(dna>=0&&renderer>dna&&i18n>renderer&&live>i18n);
});

test('screen one visible maker copy is only 你 with an arrow action',()=>{
  const s=app();
  assert.match(s,/maker-screen-one/);
  assert.match(s,/>你</);
  assert.match(s,/>→</);
  assert.doesNotMatch(s,/捏一只羊|这只羊就是你在数字牧场中的样子|这不是一只宠物|开始认识自己|>开始</);
});

test('screen four uses only a checkmark as primary confirmation',()=>{
  const s=app();
  assert.match(s,/maker-screen-four/);
  assert.match(s,/>✓</);
  assert.doesNotMatch(s,/这就是我 · 进入牧场|进入牧场<\/button>/);
});

test('maker exposes exactly the approved eight visual dimensions without selects',()=>{
  const s=app();
  for(const d of dimensions)assert.match(s,new RegExp(`data-maker-dimension=["']${d}["']`),`${d} visual entry missing`);
  assert.doesNotMatch(s,/<select\b/i);
  assert.match(s,/aria-label=/);
  assert.match(s,/aria-pressed=/);
});

test('option previews and main preview use the shared renderer',()=>{
  const s=app();
  assert.match(s,/PastureSheepRenderer/);
  assert.match(s,/Renderer\.draw\(/);
  assert.doesNotMatch(s,/function makerRects\(/);
  assert.doesNotMatch(s,/function drawMakerSheep\(/);
  assert.match(s,/maker-option-canvas/);
});

test('maker randomization uses sheep DNA randomV2 and remains editable',()=>{
  const s=app();
  assert.match(s,/randomV2\(/);
  assert.match(s,/maker-random/);
  assert.doesNotMatch(s,/稀有|抽卡|奖励|rare|reward/i);
});

test('maker draft is session-only and invalid drafts cannot become identity',()=>{
  const s=app();
  assert.match(s,/budao-pasture-sheep-v2-draft/);
  assert.match(s,/sessionStorage/);
  assert.match(s,/validateV2/);
  assert.doesNotMatch(s,/localStorage[^\n]*sheep-v2-draft/);
});

test('maker visual controls have mobile-friendly targets and a bottom visual panel',()=>{
  const c=css();
  assert.match(c,/\.maker-dimension[^}]*min-(?:width|height):44px/);
  assert.match(c,/\.maker-option[^}]*min-(?:width|height):44px/);
  assert.match(c,/\.maker-options-panel/);
});
