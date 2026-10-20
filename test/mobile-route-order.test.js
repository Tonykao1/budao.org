const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const calendar = require('../budao-calendar.js');

test('mobile portrait shows upcoming route first, recent completed second and cancelled last', () => {
  const order = calendar.prioritizeRouteStatesForMobile([
    'ended',   // Oct 17 cancelled: oldest
    'ended',   // Oct 18 completed
    'countdown' // Oct 24 upcoming
  ]);
  assert.deepEqual(order, [2, 1, 0]);
});

test('mobile prioritizes active and upcoming, then pending, then completed', () => {
  const order = calendar.prioritizeRouteStatesForMobile([
    'ended',
    'started',
    'countdown',
    'pending',
    'ended'
  ]);
  assert.deepEqual(order, [1, 2, 3, 4, 0]);
});

test('mobile derives layout from stable canonical desktop order on every mutation', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'budao-calendar.js'), 'utf8');
  assert.match(source, /const canonicalCards = cards\.slice\(\)\.sort/);
  assert.match(source, /const states = canonicalCards\.map\(routeStateFromCard\)/);
  assert.match(source, /return canonicalCards\[position\]/);
});
