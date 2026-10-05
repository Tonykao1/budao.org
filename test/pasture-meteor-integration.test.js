const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const landscape=fs.readFileSync('tonglu.html','utf8');
const portrait=fs.readFileSync('tonglu-pasture-portrait.html','utf8');

test('landscape owns the rare 20-50 minute meteor session schedule',()=>{
  assert.match(landscape,/meteorNextAt/);
  assert.match(landscape,/meteorDelayMs\(Math\.random\(\)\)/);
  assert.match(landscape,/createMeteorEvent/);
  assert.match(landscape,/LANDSCAPE_SKY_BOTTOM/);
});

test('landscape shares the same active meteor event with portrait state',()=>{
  assert.match(landscape,/state\.meteorEvent/);
  assert.match(landscape,/sendPortraitEnvironment\(\)/);
  assert.match(portrait,/state\?\.meteorEvent/);
  assert.match(portrait,/meteorFrame/);
});

test('both renderers derive meteor visibility from sky darkness and local cloud opacity',()=>{
  for(const source of [landscape,portrait]){
    assert.match(source,/meteorVisibility/);
    assert.match(source,/cloudOpacityAt/);
  }
});
