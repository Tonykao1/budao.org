const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

function source(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

test('shared cancellation core defines stable codes and reversible state', () => {
  const corePath = path.join(root, 'route-cancellation-core.js');
  assert.equal(fs.existsSync(corePath), true, 'shared cancellation core is missing');
  const core = require(corePath);

  assert.equal(core.publicMessage('WX'), '因天气原因，本次步道取消。');
  assert.equal(core.publicMessage('SAFE'), '因安全考量，本次步道取消。');
  assert.equal(core.publicMessage('NOPE'), '因临时调整，本次步道取消。');

  const cancelled = core.cancelRoute({ routeId: 'budao-leader-tony', calendarType: 'pioneer' }, {
    code: 'WX',
    publicNote: '',
    actor: 'leader:tony',
    at: '2026-10-16T13:00:00.000Z'
  });
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.cancelCode, 'WX');
  assert.equal(cancelled.calendarType, 'pioneer', 'activity nature must remain separate from cancellation state');
  assert.equal(cancelled.statusHistory.length, 1);

  const restored = core.restoreRoute(cancelled, {
    actor: 'leader:tony',
    at: '2026-10-16T13:10:00.000Z'
  });
  assert.equal(restored.status, 'scheduled');
  assert.equal(restored.cancelCode, '');
  assert.equal(restored.statusHistory.length, 2);
});

test('leader-owned route status mutations live inside existing routes endpoint', () => {
  const routes = source('api/routes.js');
  assert.match(routes, /scope\s*===\s*["']mine["'][\s\S]*handleLeaderStatusAction/);
  assert.match(routes, /action\s*!==\s*["']cancel["'][\s\S]*action\s*!==\s*["']restore["']/);
  assert.match(routes, /belongsToPublisher\(route,\s*publisher\)/);
  assert.match(routes, /cancellation\.cancelRoute/);
  assert.match(routes, /cancellation\.restoreRoute/);
  assert.doesNotMatch(routes, /const\s+fixedSlots\s*=/, 'leader cancellation must not revert to fixed-slot ownership');
  assert.equal(fs.existsSync(path.join(root, 'api', 'route-status.js')), false, 'do not spend another Hobby serverless function');
});

test('ordinary publishing preserves server-managed cancellation state', () => {
  const publish = source('api/publish-route-v2.js');
  assert.match(publish, /preserveCancellationState/);
  assert.match(publish, /statusHistory/);
  assert.match(publish, /cancelPublicNote/);
});

test('Tent uses two-step cancel controls against the current leader route', () => {
  const meeting = source('tent-meeting-module.js');
  assert.match(meeting, /route-cancellation-core\.js/);
  assert.match(meeting, /tent-cancellation\.js/);

  const controlsPath = path.join(root, 'tent-cancellation.js');
  assert.equal(fs.existsSync(controlsPath), true, 'Tent cancellation controls are missing');
  const controls = source('tent-cancellation.js');
  assert.match(controls, /\/api\/routes\?scope=mine/);
  assert.match(controls, /为什么取消？/);
  assert.match(controls, /确认取消/);
  assert.match(controls, /恢复本次步道/);
});

test('public route page loads cancelled card and change-notice presentation', () => {
  const action = source('route-invitation-action.js');
  assert.match(action, /route-cancellation-core\.js/);
  assert.match(action, /route-cancellation-public\.js/);
  const publicPath = path.join(root, 'route-cancellation-public.js');
  assert.equal(fs.existsSync(publicPath), true, 'public cancellation presenter is missing');
  const presenter = source('route-cancellation-public.js');
  assert.match(presenter, /本次步道已取消/);
  assert.match(presenter, /route-change-notice/);
  assert.match(presenter, /route\.timezone/);
});

test('calendar can project cancelled route states without changing activity type', () => {
  const calendar = require('../budao-calendar.js');
  assert.equal(typeof calendar.mergeCancellationSchedule, 'function');

  const cancelled = calendar.mergeCancellationSchedule([], [
    { routeId: 'budao-leader-tony', date: '2026-10-17', calendarType: 'pioneer', status: 'cancelled' }
  ]);
  assert.deepEqual(cancelled['2026-10-17'], ['pioneer']);

  const activeWins = calendar.mergeCancellationSchedule([
    { source: 'tent', routeId: 'budao-leader-tony', date: '2026-10-17', type: 'pioneer', status: 'scheduled' }
  ], [
    { routeId: 'budao-leader-tony', date: '2026-10-17', calendarType: 'pioneer', status: 'cancelled' },
    { routeId: 'budao-leader-moses', date: '2026-10-17', calendarType: 'pioneer', status: 'scheduled' }
  ]);
  assert.deepEqual(activeWins['2026-10-17'], [], 'an active same-type route must keep the footprint active');
});

test('calendar ledger preserves cancellation status and reason code', () => {
  const { syncCalendarEvents } = require('../scripts/sync-calendar-events.js');
  const synced = syncCalendarEvents([
    {
      routeId: 'budao-leader-tony',
      date: '2026-10-17',
      calendarType: 'pioneer',
      title: 'Tomorrow',
      status: 'cancelled',
      cancelCode: 'WX'
    }
  ], [], '2026-10-16');

  const event = synced.find((item) => item.routeId === 'budao-leader-tony');
  assert.equal(event.status, 'cancelled');
  assert.equal(event.cancelCode, 'WX');
  assert.equal(event.type, 'pioneer');
});
