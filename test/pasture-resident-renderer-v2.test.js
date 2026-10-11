const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const DNA = require('../pasture-sheep-dna.js');
const Renderer = require('../pasture-sheep-renderer.js');

const coreHtml=fs.readFileSync('tonglu-core.html','utf8');
const engine=fs.readFileSync('pasture-resident-core.js','utf8');

test('core loads DNA and renderer before resident engine can run', () => {
  const dnaIndex=coreHtml.indexOf('/pasture-sheep-dna.js');
  const rendererIndex=coreHtml.indexOf('/pasture-sheep-renderer.js');
  assert.ok(dnaIndex>=0);
  assert.ok(rendererIndex>dnaIndex);
});

test('legacy sheep can be rendered through the shared renderer without losing its exact colors', () => {
  const legacy={bodyColor:'#dec9c8',headColor:'#866f70',marking:'FACE'};
  const rects=Renderer.rectsFor(legacy);
  assert.ok(rects.some(r=>r[4]===legacy.bodyColor));
  assert.ok(rects.some(r=>r[4]===legacy.headColor));
  assert.ok(rects.some(r=>r[5]==='mark'));
});

test('resident core uses shared renderer for draw and exact-pixel mask', () => {
  assert.match(engine,/PastureSheepRenderer/);
  assert.match(engine,/Renderer\.draw\(/);
  assert.match(engine,/Renderer\.drawMask\(/);
  assert.doesNotMatch(engine,/function residentRects/);
  assert.doesNotMatch(engine,/function drawResidentSheep/);
});

test('V2 incoming resident keeps the full eight-dimension appearance', () => {
  assert.match(engine,/appearanceVersion/);
  assert.match(engine,/incoming\.sheep\.appearance/);
  assert.match(engine,/appearanceVersion\s*===?\s*2|Number\([^)]*appearanceVersion/);
});

test('legacy geometry adapter produces valid shared V2-compatible geometry', () => {
  const legacy={bodyColor:'#f4ecdc',headColor:'#8d836e',marking:'NONE'};
  assert.ok(Renderer.rectsFor(legacy).length>0);
  assert.equal(DNA.validateV2(DNA.fromLegacy(legacy)),true);
});
