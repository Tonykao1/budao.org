const test = require('node:test');
const assert = require('node:assert/strict');
const sky = require('../pasture-sky-engine.js');

const MIN = 60 * 1000;

test('meteor delay is always between 20 and 50 minutes', () => {
  assert.equal(sky.meteorDelayMs(0), 20 * MIN);
  assert.equal(sky.meteorDelayMs(1), 50 * MIN);
  assert.equal(sky.meteorDelayMs(.5), 35 * MIN);
});

test('meteor event stays inside normalized sky and lasts 0.4 to 0.8 seconds', () => {
  const values = [.4, .3, .8, .5, .6, .25];
  let i = 0;
  const event = sky.createMeteorEvent({triggerMs: 100000, random: () => values[i++]});
  assert.ok(event.durationMs >= 400 && event.durationMs <= 800);
  for (const k of ['x0','y0','x1','y1']) assert.ok(event[k] >= 0 && event[k] <= 1, `${k} outside sky`);
  assert.ok(event.y0 < .85 && event.y1 < .85, 'meteor must stay clear of the sea horizon');
  assert.notEqual(event.x0, event.x1);
  assert.notEqual(event.y0, event.y1);
});

test('meteor frame exists only during its short event and fades in and out', () => {
  const event = {triggerMs:1000,durationMs:600,x0:.2,y0:.2,x1:.35,y1:.33};
  assert.equal(sky.meteorFrame(event, 999), null);
  assert.equal(sky.meteorFrame(event, 1601), null);
  const early = sky.meteorFrame(event, 1060);
  const middle = sky.meteorFrame(event, 1300);
  const late = sky.meteorFrame(event, 1540);
  assert.ok(early && middle && late);
  assert.ok(middle.alpha > early.alpha);
  assert.ok(middle.alpha > late.alpha);
  assert.ok(middle.x >= event.x0 && middle.x <= event.x1);
});

test('meteor visibility requires dark sky and respects cloud and moon suppression', () => {
  const moonDown={altitudeDeg:-1,illumination:1};
  assert.equal(sky.meteorVisibility({sunAltitudeDeg:-8,cloudOpacity:0,moon:moonDown}),0);
  const clear=sky.meteorVisibility({sunAltitudeDeg:-15,cloudOpacity:0,moon:moonDown});
  const cloudy=sky.meteorVisibility({sunAltitudeDeg:-15,cloudOpacity:.85,moon:moonDown});
  const fullMoon=sky.meteorVisibility({sunAltitudeDeg:-15,cloudOpacity:0,moon:{altitudeDeg:55,illumination:1}});
  assert.ok(clear > cloudy);
  assert.ok(clear > fullMoon);
  assert.ok(clear > .9);
});
