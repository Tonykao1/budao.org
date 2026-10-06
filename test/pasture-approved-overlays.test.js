const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>fs.readFileSync(p,'utf8');

test('approved integration converts the former seventh drawer entry into the shop and keeps private drawer on identity',()=>{
  const shell=read('pasture-approved-ui-shell.js');
  assert.match(shell,/id=\\?"pastureBoxBtn\\?"[\s\S]*小匣/);
  const bridge=read('pasture-approved-ui-bridge.js');
  assert.match(bridge,/pastureBoxBtn/);
  assert.match(bridge,/pastureShopBtn/);
  assert.match(bridge,/小铺/);
  const overlays=read('pasture-approved-overlays.js');
  assert.match(overlays,/pasture-private-box-link/);
  assert.match(overlays,/querySelector\(['"]\.identity['"]\)/);
});

test('approved shop drawer and card use the unified close language',()=>{
  const overlays=read('pasture-approved-overlays.js');
  for(const id of ['shopShade','shopWindow','shopClose','boxShade','boxWindow','boxClose','cardShade','topExit']) assert.match(overlays,new RegExp(id));
  assert.match(overlays,/id=\\?"shopClose\\?"[\s\S]*收起 ×/);
  assert.match(overlays,/id=\\?"boxClose\\?"[\s\S]*收起 ×/);
  assert.match(overlays,/id=\\?"topExit\\?"[\s\S]*收起 ×/);
});

test('production overlays contain no review-only floating or offline controls',()=>{
  const overlays=read('pasture-approved-overlays.js');
  for(const token of ['floatingShop','floatingBox','offlineShop','offlineBox','样机重置','审看版']) assert.doesNotMatch(overlays,new RegExp(token));
});

test('approved identity receives real resident state without replacing its avatar structure',()=>{
  const shell=read('pasture-approved-ui-shell.js');
  const bridge=read('pasture-approved-ui-bridge.js');
  assert.match(shell,/class=\\?"avatar\\?"/);
  assert.match(shell,/resident\?\.id/);
  assert.match(shell,/resident\?\.emailMasked/);
  assert.match(bridge,/pasture-resident-updated/);
});
