const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=()=>fs.readFileSync('pasture-live.js','utf8');
const css=()=>fs.readFileSync('pasture-sheep-maker-v2.css','utf8');
const dimensions=['woolColor','faceColor','woolShape','bodyShape','ears','expression','marking','forelock'];

test('maker loads shared DNA, renderer and i18n in order before boot',()=>{
  const s=app();
  const dna=s.indexOf("'/pasture-sheep-dna.js'");
  const renderer=s.indexOf("'/pasture-sheep-renderer.js'");
  const i18n=s.indexOf("'/pasture-sheep-i18n.js'");
  const boot=s.lastIndexOf('boot();');
  assert.ok(dna>=0&&renderer>dna&&i18n>renderer&&boot>i18n);
  assert.match(s,/pasture-sheep-maker-v2\.css/);
});

test('screen one visible maker copy is only 你 with an arrow action',()=>{
  const s=app();
  assert.match(s,/maker-screen-one/);
  assert.match(s,/maker-you">你<\/div>/);
  assert.match(s,/navButton\('primary maker-next','→','next'\)/);
  assert.doesNotMatch(s,/捏一只羊|这只羊就是你在数字牧场中的样子|这不是一只宠物|开始认识自己/);
});

test('screen four uses only a checkmark as primary confirmation',()=>{
  const s=app();
  assert.match(s,/maker-screen-four/);
  assert.match(s,/navButton\('confirm maker-confirm','✓','confirm'\)/);
  assert.doesNotMatch(s,/这就是我 · 进入牧场/);
});

test('maker exposes exactly the approved eight visual dimensions without selects',()=>{
  const s=app();
  assert.match(s,/const BASE_DIMS=\['woolColor','faceColor','woolShape','bodyShape'\]/);
  assert.match(s,/const FEATURE_DIMS=\['ears','expression','marking','forelock'\]/);
  for(const d of dimensions)assert.match(s,new RegExp(`['"]${d}['"]`),`${d} missing`);
  assert.match(s,/data-maker-dimension=/);
  assert.match(s,/aria-label=/);
  assert.match(s,/aria-pressed=/);
  assert.doesNotMatch(s,/<select\b/i);
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
  assert.match(s,/DNA\.randomV2\(/);
  assert.match(s,/maker-random/);
  assert.match(s,/data-maker-option/);
  assert.doesNotMatch(s,/稀有|抽卡|奖励|rare|reward/i);
});

test('maker draft is session-only and invalid drafts cannot become identity',()=>{
  const s=app();
  assert.match(s,/budao-pasture-sheep-v2-draft/);
  assert.match(s,/sessionStorage/);
  assert.match(s,/DNA\.validateV2/);
  assert.doesNotMatch(s,/localStorage[^\n]*sheep-v2-draft/);
});

test('maker visual controls have mobile-friendly targets and a bottom visual panel',()=>{
  const c=css();
  assert.match(c,/\.maker-dimension\{[^}]*min-width:44px[^}]*min-height:52px/);
  assert.match(c,/\.maker-option\{[^}]*min-width:44px[^}]*min-height:70px/);
  assert.match(c,/\.maker-options-panel\{/);
  assert.match(c,/@media\(max-width:850px\)/);
});
