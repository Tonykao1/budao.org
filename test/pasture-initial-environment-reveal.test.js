const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const core=fs.readFileSync('tonglu-core.html','utf8');

test('pasture stays concealed until the first real environment frame is ready',()=>{
  assert.match(core,/function revealEnvironmentIfReady\(\)/);
  assert.match(core,/if\(!pastureReady\|\|!state\|\|!skyState\)return false/);
  assert.match(core,/environmentLayer\.style\.opacity='1'/);
  assert.match(core,/frame\.style\.opacity='1'/);
  assert.match(core,/refreshSkyState\(\)[\s\S]*?revealEnvironmentIfReady\(\)/);
});

test('pasture readiness no longer reveals the default daytime frame before environment state',()=>{
  const readiness=core.match(/function revealPastureWhenReady\(\)[\s\S]*?frame\.addEventListener\('load',revealPastureWhenReady\)/)?.[0]||'';
  assert.doesNotMatch(readiness,/frame\.style\.opacity='1'/);
  assert.match(readiness,/pastureReady=true;[\s\S]*?revealEnvironmentIfReady\(\)/);
});

test('a recent saved location can paint the first environment before waiting for live geolocation',()=>{
  const refresh=core.match(/async function refresh\(\)[\s\S]*?\n\}/)?.[0]||'';
  assert.match(refresh,/const devicePromise=getDeviceLocation\(\)/);
  assert.match(refresh,/const saved=readSavedLocation\(\)/);
  assert.match(refresh,/if\(!state&&validLocation\(saved\)\)/);
  assert.ok(refresh.indexOf("weatherAt(saved.latitude,saved.longitude,'saved')")<refresh.indexOf('await devicePromise'));
});
