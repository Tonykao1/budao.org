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

test('0-3 magnitude local catalog is finite and keeps true magnitude', () => {
  const stars=require('../pasture-stars.js');
  assert.ok(Array.isArray(stars)&&stars.length>80,'catalog should contain the bright naked-eye layer');
  for(const s of stars){
    assert.ok(typeof s.id==='string'&&s.id.length>0);
    assert.ok(Number.isFinite(s.ra)&&Number.isFinite(s.dec));
    assert.ok(Number.isFinite(s.visualMagnitude)&&s.visualMagnitude<=3.0);
    assert.ok(Number.isFinite(s.colorIndex));
    assert.equal(Object.prototype.hasOwnProperty.call(s,'name'),false);
    assert.equal(Object.prototype.hasOwnProperty.call(s,'constellation'),false);
  }
  assert.ok(stars.some(s=>s.visualMagnitude<0),'negative magnitudes must remain continuous');
  assert.ok(stars.some(s=>s.visualMagnitude===3.0),'3.00 boundary must be retained');
});

test('catalog star horizontal position is deterministic and changes with time', () => {
  const stars=require('../pasture-stars.js');
  const a=sky.computeStarHorizontals({timeMs:Date.UTC(2026,9,5,12),latitude:39.9042,longitude:116.4074,stars})[0];
  const b=sky.computeStarHorizontals({timeMs:Date.UTC(2026,9,5,13),latitude:39.9042,longitude:116.4074,stars})[0];
  const a2=sky.computeStarHorizontals({timeMs:Date.UTC(2026,9,5,12),latitude:39.9042,longitude:116.4074,stars})[0];
  assert.deepEqual(a,a2);
  assert.ok(Math.abs(a.azimuthDeg-b.azimuthDeg)>0.01||Math.abs(a.altitudeDeg-b.altitudeDeg)>0.01);
});

test('twilight reveals magnitude layers progressively', () => {
  assert.equal(sky.twilightFactor(-3.9,0),0);
  assert.ok(sky.twilightFactor(-5,0)>0 && sky.twilightFactor(-5,0)<1);
  assert.equal(sky.twilightFactor(-5,1.5),0);
  assert.ok(sky.twilightFactor(-7.5,1)>0);
  assert.equal(sky.twilightFactor(-8,2.5),0);
  assert.ok(sky.twilightFactor(-10.5,2)>0);
  assert.equal(sky.twilightFactor(-11.5,3),0);
  assert.ok(sky.twilightFactor(-13.5,3)>0);
  assert.equal(sky.twilightFactor(-15.1,3),1);
});

test('atmospheric extinction strongly dims the horizon but not high sky', () => {
  assert.equal(sky.atmosphericFactor(0),0);
  const low=sky.atmosphericFactor(3),mid=sky.atmosphericFactor(15),high=sky.atmosphericFactor(30);
  assert.ok(low<mid && mid<high);
  assert.ok(low<0.4);
  assert.equal(high,1);
});

test('full high moon suppresses faint nearby stars locally but preserves bright stars', () => {
  const moon={altitudeDeg:55,azimuthDeg:180,illumination:.98};
  const faintNear=sky.moonlightFactor({visualMagnitude:3,starAltitudeDeg:52,starAzimuthDeg:182,moon});
  const faintFar=sky.moonlightFactor({visualMagnitude:3,starAltitudeDeg:52,starAzimuthDeg:20,moon});
  const brightNear=sky.moonlightFactor({visualMagnitude:0,starAltitudeDeg:52,starAzimuthDeg:182,moon});
  assert.ok(faintNear<faintFar);
  assert.ok(brightNear>faintNear);
  assert.ok(brightNear>0.6);
  assert.ok(sky.moonlightFactor({visualMagnitude:3,starAltitudeDeg:40,starAzimuthDeg:180,moon:{...moon,altitudeDeg:-2}})>.98);
  assert.ok(sky.moonlightFactor({visualMagnitude:3,starAltitudeDeg:40,starAzimuthDeg:180,moon:{...moon,illumination:.01}})>.98);
});

test('cloud opacity is local deterministic mobile and grows with cloud cover', () => {
  const args={weatherCode:0,timeMs:Date.UTC(2026,9,5,12)};
  const a=sky.cloudOpacityAt({xNorm:.1,yNorm:.2,cloudCover:55,...args});
  const a2=sky.cloudOpacityAt({xNorm:.1,yNorm:.2,cloudCover:55,...args});
  const b=sky.cloudOpacityAt({xNorm:.8,yNorm:.7,cloudCover:55,...args});
  const moved=sky.cloudOpacityAt({xNorm:.1,yNorm:.2,cloudCover:55,...args,timeMs:args.timeMs+60000});
  assert.equal(a,a2);
  assert.notEqual(a,b);
  assert.notEqual(a,moved);
  function avg(cover,weatherCode=0){let s=0,n=0;for(let y=0;y<=8;y++)for(let x=0;x<=16;x++){s+=sky.cloudOpacityAt({xNorm:x/16,yNorm:y/8,cloudCover:cover,weatherCode,timeMs:args.timeMs});n++;}return s/n;}
  assert.ok(avg(80)>avg(20));
  assert.ok(avg(10,61)>avg(10,0));
  assert.ok(avg(10,71)>avg(10,0));
  assert.ok(avg(10,45)>avg(10,0));
});

test('star visibility stays continuous and twinkle changes brightness only', () => {
  const common={visualMagnitude:2,altitudeDeg:35,azimuthDeg:120,sunAltitudeDeg:-18,moon:{altitudeDeg:-5,azimuthDeg:0,illumination:0},cloudOpacity:0};
  const clear=sky.starVisibility(common);
  const cloudy=sky.starVisibility({...common,cloudOpacity:.7});
  assert.ok(clear>cloudy && cloudy>=0);
  const t1=sky.starTwinkle({visibility:clear,altitudeDeg:5,visualMagnitude:1,timeMs:100000,seed:7});
  const t2=sky.starTwinkle({visibility:clear,altitudeDeg:60,visualMagnitude:1,timeMs:100000,seed:7});
  assert.ok(Number.isFinite(t1)&&Number.isFinite(t2));
  assert.ok(Math.abs(t1-1)>Math.abs(t2-1));
});
