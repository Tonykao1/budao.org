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

test('resident identity avatar is rendered from the same saved sheep DNA in both shells',()=>{
  const tonglu=fs.readFileSync('tonglu.html','utf8');
  const live=fs.readFileSync('pasture-live.html','utf8');
  const js=fs.readFileSync('pasture-live.js','utf8');
  const css=fs.readFileSync('pasture-live.css','utf8');

  for(const html of [tonglu,live]){
    assert.match(html,/id="residentAvatar"[^>]*canvas|canvas[^>]*id="residentAvatar"/, 'identity card must expose a sheep avatar canvas');
    const avatarBlock=html.match(/<div class="avatar"[\s\S]*?<\/div>/)?.[0]||'';
    assert.doesNotMatch(avatarBlock,/<svg\b/, 'fixed generic SVG sheep avatar must be removed');
  }
  assert.match(js,/function drawResidentAvatar\(/, 'shell must own a resident avatar renderer');
  assert.match(js,/resident\.sheep\.appearanceVersion/, 'avatar must branch from the saved sheep identity version');
  assert.match(js,/Renderer\.draw\([^\n]*residentAvatar/, 'avatar must use the shared sheep renderer');
  assert.match(js,/updateResidentUi\([^)]*\)[\s\S]*drawResidentAvatar\(/, 'resident UI refresh must redraw the exact saved sheep avatar');
  assert.match(css,/\.avatar canvas\{[^}]*image-rendering:pixelated/, 'avatar canvas must preserve pixel rendering');
});
