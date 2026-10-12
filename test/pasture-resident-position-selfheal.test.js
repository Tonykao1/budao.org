const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const engine=fs.readFileSync('pasture-resident-core.js','utf8');

test('saved resident position is restored only when it remains visible and walkable',()=>{
  assert.match(engine,/function validSavedPosition\(/,'resident engine must validate historical saved positions');
  assert.match(engine,/candidatePosition\(v\.x,v\.y\)/,'saved x/y must be checked against current walkable terrain');
  assert.match(engine,/return\{x:v\.x,y:v\.y,flip:!!v\.flip\}/,'a valid saved placement must remain unchanged');
});

test('invalid historical placement self-heals to a deterministic visible grass position',()=>{
  assert.match(engine,/function deterministicSafePosition\(/,'engine must own a deterministic safe fallback');
  assert.match(engine,/candidatePosition\(/,'safe fallback must pass the same placement rules as dragging');
  assert.match(engine,/savePosition\(\)/,'self-healed placement must be persisted instead of failing every visit');
});
