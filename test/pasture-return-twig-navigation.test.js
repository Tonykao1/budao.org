const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const landscape=fs.readFileSync('tonglu-core.html','utf8');
const portrait=fs.readFileSync('tonglu-pasture-portrait.html','utf8');
const shell=fs.readFileSync('tonglu.html','utf8');

test('pasture shell self-recovers if the inner core navigates to home',()=>{
  assert.match(shell,/pastureCore[\s\S]*addEventListener\(['"]load['"][\s\S]*pathname\s*===\s*['"]\/home\.html['"][\s\S]*location\.replace\(['"]\/home\.html['"]\)/,'outer pasture shell must follow an inner /home.html navigation and remove pasture UI');
});

test('portrait pasture return twig already exits the entire shell directly',()=>{
  assert.match(portrait,/twigHit[\s\S]*top\.location\.assign\('\/home\.html'\)/,'portrait twig must continue to exit the whole pasture shell');
});

test('landscape return still points only to the canonical home destination',()=>{
  assert.match(landscape,/returnTwigHit[\s\S]*location\.assign\('\/home\.html'\)/,'landscape twig must keep returning to canonical home');
});
