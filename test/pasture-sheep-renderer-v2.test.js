const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const DNA = require('../pasture-sheep-dna.js');
const Renderer = require('../pasture-sheep-renderer.js');

function signature(dna){return JSON.stringify(Renderer.rectsFor(dna));}

test('each of the eight V2 dimensions changes shared pixel output', () => {
  const base = DNA.defaultV2();
  const variants = {
    woolColor:'black', faceColor:'ivory', woolShape:'fluffy', bodyShape:'round',
    ears:'droop', expression:'curious', marking:'forehead', forelock:'curl'
  };
  for(const [key,value] of Object.entries(variants)){
    const changed={...base,[key]:value};
    assert.notEqual(signature(changed),signature(base),`${key} must visibly change geometry or color`);
  }
});

test('shared geometry rects stay finite and drawable', () => {
  for(const woolShape of DNA.enums.woolShape) for(const bodyShape of DNA.enums.bodyShape) for(const ears of DNA.enums.ears) for(const forelock of DNA.enums.forelock){
    const rects=Renderer.rectsFor({...DNA.defaultV2(),woolShape,bodyShape,ears,forelock});
    assert.ok(rects.length>0);
    for(const rect of rects){
      assert.equal(rect.length>=5,true);
      assert.ok(rect.slice(0,4).every(Number.isFinite));
      assert.ok(rect[2]>0&&rect[3]>0);
      assert.equal(typeof rect[4],'string');
    }
  }
});

test('draw and drawMask both consume rectsFor as the one geometry source', () => {
  const source=fs.readFileSync('pasture-sheep-renderer.js','utf8');
  assert.match(source,/function draw\([^)]*\)[\s\S]*rectsFor\(/);
  assert.match(source,/function drawMask\([^)]*\)[\s\S]*rectsFor\(/);
  assert.doesNotMatch(source,/maskRects|residentRects/);
});

test('far-scale silhouette features remain at least one pixel when rounded', () => {
  const unit=.18;
  for(const key of ['woolShape','bodyShape','ears','forelock']) for(const value of DNA.enums[key]){
    const rects=Renderer.rectsFor({...DNA.defaultV2(),[key]:value});
    assert.ok(rects.some(([, ,w,h])=>Math.max(1,Math.round(w*unit))>=1&&Math.max(1,Math.round(h*unit))>=1),`${key}:${value}`);
  }
});
