const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const landscape=fs.readFileSync('tonglu-core.html','utf8');
const portrait=fs.readFileSync('tonglu-pasture-portrait.html','utf8');

test('landscape pasture return twig exits the entire pasture shell to home',()=>{
  assert.match(landscape,/returnTwigHit[\s\S]*top\.location\.assign\('\/home\.html'\)/,'landscape twig must navigate the top-level page, not only the inner iframe');
  assert.doesNotMatch(landscape,/returnTwigHit[\s\S]{0,160}[^.]location\.assign\('\/home\.html'\)/,'landscape twig must not leave the outer pasture shell behind');
});

test('portrait pasture return twig follows the same top-level navigation rule',()=>{
  assert.match(portrait,/twigHit[\s\S]*top\.location\.assign\('\/home\.html'\)/,'portrait twig must continue to exit the whole pasture shell');
});
