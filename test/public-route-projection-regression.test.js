const test = require('node:test');
const assert = require('node:assert/strict');

const routesApi = require('../api/routes');
const publish = require('../api/publish-route-v2');

test('public projection assigns presentation slots without requiring persisted route slots', () => {
  const routes = [
    { routeId: 'a', date: '2026-10-06', time: '08:00', timezone: 'Asia/Shanghai', slot: '' },
    { routeId: 'b', date: '2026-10-07', time: '08:00', timezone: 'Asia/Shanghai', slot: '' },
    { routeId: 'c', date: '2026-10-08', time: '08:00', timezone: 'Asia/Shanghai', slot: '' }
  ];

  const projected = routesApi.projectPublicRoutes(routes, new Date('2026-10-05T00:00:00Z'));
  assert.deepEqual(projected.map((route) => route.slot), ['IMS', 'BACBC', 'HD']);
  assert.deepEqual(routes.map((route) => route.slot), ['', '', '']);
});

test('leader private route keeps leader ownership and does not impersonate IMS', () => {
  const routes = [
    { routeId: 'budao-leader-tony', leaderId: 'leader-tony', leader: 'tony', owner: 'tony', slot: '' }
  ];

  const mine = routesApi.privateRoutesForLeader(routes, { id: 'leader-tony', username: 'tony' });
  assert.equal(mine.length, 1);
  assert.equal(mine[0].leaderId, 'leader-tony');
  assert.equal(mine[0].leader, 'tony');
  assert.equal(mine[0].owner, 'tony');
  assert.equal(mine[0].slot, '');
});

test('published leader route is stored without transient presentation slot', () => {
  const route = {
    id: 'budao-leader-tony',
    routeId: 'budao-leader-tony',
    leaderId: 'leader-tony',
    leader: 'tony',
    owner: 'tony',
    slot: 'IMS',
    date: '2026-10-10',
    time: '08:30',
    timezone: 'Asia/Shanghai'
  };

  assert.equal(typeof publish.stripPresentationSlot, 'function');
  const stored = publish.stripPresentationSlot(route);
  assert.equal(stored.slot, '');
  assert.equal(stored.owner, 'tony');
  assert.equal(stored.leader, 'tony');
});
