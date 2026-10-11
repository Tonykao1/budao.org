const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const app=fs.readFileSync('pasture-live.js','utf8');

test('only final confirmation sends the complete V2 identity to saveSheep',()=>{
  assert.match(app,/function confirmMaker\(/);
  assert.match(app,/request\(\{action:'saveSheep',appearanceVersion:2,appearance:makerState\.dna\}\)/);
  assert.equal((app.match(/action:'saveSheep'/g)||[]).length,1);
});

test('successful save clears draft then uses created as the only arrival signal',()=>{
  const start=app.indexOf('async function confirmMaker');
  const end=app.indexOf('function showMaker',start);
  const confirm=app.slice(start,end);
  const requestIndex=confirm.indexOf("request({action:'saveSheep'");
  const clearIndex=confirm.indexOf('clearDraft()');
  const arrivalIndex=confirm.indexOf('applyResident(!!data.created)');
  assert.ok(requestIndex>=0&&clearIndex>requestIndex&&arrivalIndex>clearIndex);
  assert.match(confirm,/catch\(err\)\{showError\(err\.reason\)/);
});

test('review mode returns to pasture without saving or replacing identity',()=>{
  const start=app.indexOf('async function confirmMaker');
  const end=app.indexOf('function showMaker',start);
  const confirm=app.slice(start,end);
  assert.match(confirm,/if\(makerState\.review\)[\s\S]*applyResident\(false\);return/);
  const reviewBlock=confirm.slice(confirm.indexOf('if(makerState.review)'),confirm.indexOf('if(btn)'));
  assert.doesNotMatch(reviewBlock,/saveSheep|request\(/);
});

test('existing resident can open non-destructive maker review from the preview query flag',()=>{
  assert.match(app,/function wantsMakerReview\(/);
  assert.match(app,/sheepMakerReview/);
  assert.match(app,/URLSearchParams/);
  assert.match(app,/showMaker\(true\)/);
});

test('review intent survives email verification on a fresh preview hostname',()=>{
  const start=app.indexOf('function showCode');
  const end=app.indexOf('function t(',start);
  const codeFlow=app.slice(start,end);
  assert.match(codeFlow,/resident=data\.user/);
  assert.match(codeFlow,/if\(data\.needsSheep\|\|!resident\?\.sheep\)showMaker\(false\)/);
  assert.match(codeFlow,/else if\(wantsMakerReview\(\)\)showMaker\(true\)/);
  assert.match(codeFlow,/else applyResident\(false\)/);
});

test('normal existing resident still enters the pasture without replaying maker or arrival',()=>{
  const boot=app.slice(app.indexOf('async function boot'));
  assert.match(boot,/if\(!resident\.sheep\)return showMaker\(false\)/);
  assert.match(boot,/if\(wantsMakerReview\(\)\)return showMaker\(true\)/);
  assert.match(boot,/applyResident\(false\)/);
});
