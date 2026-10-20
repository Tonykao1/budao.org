const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const page = fs.readFileSync(path.join(__dirname, '..', 'test.html'), 'utf8');
const source = page.match(/function sortRoutesByStart\(routes\)\{[\s\S]*?\n\}/);
assert.ok(source, 'sortRoutesByStart is absent');
const sortRoutes = vm.runInNewContext('(' + source[0] + ')', {
  routeStartTimestamp: route => route.pending ? Infinity :
    Date.parse(route.date + 'T' + route.time + ':00+08:00')
});

test('desktop shows 17th, 18th, 24th left to right regardless of input slots', () => {
  const input = [
    { title: 'upcoming', date: '2026-10-24', time: '09:00' },
    { title: 'completed', date: '2026-10-18', time: '09:00' },
    { title: 'cancelled', date: '2026-10-17', time: '09:00' }
  ];
  assert.deepEqual(Array.from(sortRoutes(input), route => route.title),
    ['cancelled', 'completed', 'upcoming']);
});

test('undated pending card follows dated routes in desktop timeline', () => {
  const input = [
    { title: 'pending', pending: true },
    { title: 'upcoming', date: '2026-10-24', time: '09:00' },
    { title: 'past', date: '2026-10-17', time: '09:00' }
  ];
  assert.deepEqual(Array.from(sortRoutes(input), route => route.title),
    ['past', 'upcoming', 'pending']);
});
