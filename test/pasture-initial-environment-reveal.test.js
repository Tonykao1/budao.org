const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const live=fs.readFileSync('pasture-live.js','utf8');
const css=fs.readFileSync('pasture-live.css','utf8');

test('shell masks the default bright pasture until environment readiness',()=>{
  assert.match(css,/body:not\(\.pasture-environment-ready\)::before/);
  assert.match(css,/z-index:27/);
  assert.match(css,/background:#173042/);
});

test('shell only removes the startup mask after real weather reached the inner pasture',()=>{
  assert.match(live,/function coreEnvironmentReady\(\)/);
  assert.match(live,/__tongluWeather/);
  assert.match(live,/landscape\.style\.opacity==='1'/);
  assert.match(live,/function revealCoreWhenEnvironmentReady\(\)/);
  assert.match(live,/document\.body\.classList\.add\('pasture-environment-ready'\)/);
});

test('environment gate is restarted when the core iframe loads',()=>{
  assert.match(live,/core\.addEventListener\('load',[\s\S]*?revealCoreWhenEnvironmentReady\(\)/);
});
