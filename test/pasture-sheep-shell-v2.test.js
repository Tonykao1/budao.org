const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

test('formal tonglu shell has no legacy outer resident canvas',()=>{
  const html=fs.readFileSync('tonglu.html','utf8');
  assert.doesNotMatch(html,/id="residentCanvas"/);
});

test('V2 maker canvas explicitly overrides legacy preview ID styling',()=>{
  const css=fs.readFileSync('pasture-sheep-maker-v2.css','utf8');
  assert.match(css,/#pastureSheepPreview\.maker-main-canvas/);
  assert.match(css,/\.resident-card\.maker-v2-card\{position:relative/);
});
