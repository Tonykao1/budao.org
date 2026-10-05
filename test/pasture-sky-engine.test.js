const test = require('node:test');
const assert = require('node:assert/strict');
const sky = require('../pasture-sky-engine.js');

const JERUSALEM = { lat: 31.77, lon: 35.21 };

function finiteObject(o, keys) {
  for (const k of keys) assert.ok(Number.isFinite(o[k]), `${k} must be finite`);
}

test('Jerusalem bearings are finite and normalized from east and west locations', () => {
  for (const [lat, lon] of [[39.9042,116.4074],[34.0522,-118.2437],[41.9028,12.4964]]) {
    const b = sky.initialBearingDegrees(lat, lon, JERUSALEM.lat, JERUSALEM.lon);
    assert.ok(Number.isFinite(b));
    assert.ok(b >= 0 && b < 360);
  }
});

test('projection wraps azimuth across north and keeps edge symmetry', () => {
  const a = sky.projectHorizontal({altitudeDeg:45,azimuthDeg:359,centerAzimuthDeg:1,width:480,skyTop:0,skyBottom:96});
  const b = sky.projectHorizontal({altitudeDeg:45,azimuthDeg:3,centerAzimuthDeg:1,width:480,skyTop:0,skyBottom:96});
  assert.ok(a && b);
  assert.ok(a.x < 240 && b.x > 240);
  assert.ok(Math.abs((240-a.x)-(b.x-240)) < 1e-6);
});

test('projection rejects non-positive altitude and objects outside 180 degree FOV', () => {
  assert.equal(sky.projectHorizontal({altitudeDeg:0,azimuthDeg:0,centerAzimuthDeg:0,width:480,skyTop:0,skyBottom:96}), null);
  assert.equal(sky.projectHorizontal({altitudeDeg:-1,azimuthDeg:0,centerAzimuthDeg:0,width:480,skyTop:0,skyBottom:96}), null);
  assert.equal(sky.projectHorizontal({altitudeDeg:20,azimuthDeg:100,centerAzimuthDeg:0,width:480,skyTop:0,skyBottom:96}), null);
});

test('projection maps altitude just above horizon near skyBottom and zenith to skyTop', () => {
  const low = sky.projectHorizontal({altitudeDeg:0.0001,azimuthDeg:0,centerAzimuthDeg:0,width:480,skyTop:0,skyBottom:96});
  const zenith = sky.projectHorizontal({altitudeDeg:90,azimuthDeg:0,centerAzimuthDeg:0,width:480,skyTop:0,skyBottom:96});
  assert.ok(low && zenith);
  assert.ok(low.y < 96 && low.y > 95.99);
  assert.equal(zenith.y, 0);
});

test('sun moon and equatorial conversion return finite shared horizontal coordinates', () => {
  const args={timeMs:Date.UTC(2026,9,5,12,0,0),latitude:39.9042,longitude:116.4074};
  const sun=sky.sunEphemeris(args);
  const moon=sky.moonEphemeris(args);
  const star=sky.equatorialToHorizontal({ra:1.7678,dec:-0.29175,...args});
  finiteObject(sun,['altitudeDeg','azimuthDeg','ra','dec']);
  finiteObject(moon,['altitudeDeg','azimuthDeg','ra','dec','phase','illumination','lightX','lightY']);
  finiteObject(star,['altitudeDeg','azimuthDeg']);
});
