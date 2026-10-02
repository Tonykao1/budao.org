const test = require('node:test');
const assert = require('node:assert/strict');

const calendar = require('../budao-calendar.js');

test('mobile portrait moves completed routes below unfinished routes', () => {
  const order = calendar.prioritizeRouteStatesForMobile([
    'ended',
    'countdown',
    'pending'
  ]);

  assert.deepEqual(order, [1, 2, 0]);
});

test('mobile portrait keeps relative order inside unfinished and completed groups', () => {
  const order = calendar.prioritizeRouteStatesForMobile([
    'ended',
    'started',
    'countdown',
    'ended'
  ]);

  assert.deepEqual(order, [1, 2, 0, 3]);
});
