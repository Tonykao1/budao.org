const assert = require('node:assert/strict');
const test = require('node:test');
const core = require('../route-cancellation-core');

test('cancel codes map to stable public copy', () => {
  assert.equal(core.publicMessage('WX'), '因天气原因，本次步道取消。');
  assert.equal(core.publicMessage('SAFE'), '因安全考量，本次步道取消。');
  assert.equal(core.publicMessage('OTHER'), '因临时调整，本次步道取消。');
  assert.equal(core.publicMessage('NOPE'), '因临时调整，本次步道取消。');
});

test('cancelRoute preserves route identity and appends audit history', () => {
  const route = { routeId: 'budao-ims', slot: 'IMS', title: 'Test', statusHistory: [] };
  const next = core.cancelRoute(route, {
    code: 'WX', publicNote: '', actor: 'leader:IMS', at: '2026-10-16T13:00:00.000Z'
  });
  assert.equal(next.routeId, 'budao-ims');
  assert.equal(next.status, 'cancelled');
  assert.equal(next.cancelCode, 'WX');
  assert.equal(next.cancelPublicNote, '');
  assert.equal(next.cancelledAt, '2026-10-16T13:00:00.000Z');
  assert.equal(next.cancelledBy, 'leader:IMS');
  assert.equal(next.statusHistory.length, 1);
  assert.deepEqual(next.statusHistory[0], {
    status: 'cancelled', code: 'WX', at: '2026-10-16T13:00:00.000Z', by: 'leader:IMS'
  });
});

test('restoreRoute keeps cancellation audit and returns to scheduled', () => {
  const route = {
    routeId: 'budao-ims', status: 'cancelled', cancelCode: 'WX',
    cancelledAt: '2026-10-16T13:00:00.000Z', cancelledBy: 'leader:IMS',
    statusHistory: [{ status: 'cancelled', code: 'WX', at: '2026-10-16T13:00:00.000Z', by: 'leader:IMS' }]
  };
  const next = core.restoreRoute(route, {
    actor: 'leader:IMS', at: '2026-10-16T13:10:00.000Z'
  });
  assert.equal(next.status, 'scheduled');
  assert.equal(next.cancelCode, '');
  assert.equal(next.cancelPublicNote, '');
  assert.equal(next.cancelledAt, '');
  assert.equal(next.cancelledBy, '');
  assert.equal(next.restoredAt, '2026-10-16T13:10:00.000Z');
  assert.equal(next.statusHistory.length, 2);
  assert.deepEqual(next.statusHistory[1], {
    status: 'scheduled', code: '', at: '2026-10-16T13:10:00.000Z', by: 'leader:IMS'
  });
});

test('public note is capped and invalid code becomes OTHER', () => {
  const next = core.cancelRoute({ routeId: 'x' }, {
    code: 'INVALID', publicNote: 'x'.repeat(600), actor: 'leader', at: '2026-10-16T13:00:00.000Z'
  });
  assert.equal(next.cancelCode, 'OTHER');
  assert.equal(next.cancelPublicNote.length, 280);
});
