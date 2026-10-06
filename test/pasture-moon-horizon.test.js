const test = require('node:test');
const assert = require('node:assert/strict');
const sky = require('../pasture-sky-engine.js');

const common={azimuthDeg:180,centerAzimuthDeg:180,width:480,skyTop:0,skyBottom:96,radiusPx:8};

test('stylized moon disc stays fully above the visual horizon while its center is physically above horizon',()=>{
  assert.equal(typeof sky.projectDiscHorizontal,'function');
  const p=sky.projectDiscHorizontal({...common,altitudeDeg:4});
  assert.ok(p);
  assert.ok(p.y+common.radiusPx<=common.skyBottom,'moon lower edge must not sink below horizon');
});

test('disc projection remains continuous, centered at mid-sky, and disappears only after physical set',()=>{
  const mid=sky.projectDiscHorizontal({...common,altitudeDeg:45});
  assert.ok(mid);
  assert.ok(Math.abs(mid.y-48)<1e-9);
  const low=sky.projectDiscHorizontal({...common,altitudeDeg:.1});
  assert.ok(low&&low.y<common.skyBottom-common.radiusPx+0.2);
  assert.equal(sky.projectDiscHorizontal({...common,altitudeDeg:0}),null);
  assert.equal(sky.projectDiscHorizontal({...common,altitudeDeg:-1}),null);
});
