import assert from 'node:assert';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const modeB = require('../invitation-mode-b.js');
const share = require('../invitation-share-mode-b.js');

function fakeContext() {
  const calls = [];
  const ctx = {
    calls,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left',
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    strokeRect(...args) { calls.push(['strokeRect', ...args]); },
    fillText(...args) { calls.push(['fillText', ...args]); },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
    measureText(value) { return { width: String(value).length * 12 }; },
    drawImage(...args) { calls.push(['drawImage', ...args]); }
  };
  return ctx;
}

test('fellowship route is adapted as internal participation even when it has a QR code', () => {
  const value = modeB.routeToModeBViewModel({
    routeId: 'f1',
    title: '小组同行',
    calendarType: 'fellowship',
    qrCode: 'https://images.example/private-group.png'
  });

  assert.strictEqual(value.calendarType, 'fellowship');
  assert.deepStrictEqual(value.participation, {
    type: 'internal',
    artifact: '',
    availability: 'internal'
  });
});

test('fellowship snapshot remains internal after permanent invitation serialization', () => {
  const value = modeB.snapshotToModeBViewModel({
    id: 'FELLOW1',
    sourceRoute: { routeId: 'f1', calendarType: 'fellowship' },
    facts: { title: '小组同行' },
    visual: {},
    participation: { type: 'internal', artifact: '' }
  });

  assert.strictEqual(value.calendarType, 'fellowship');
  assert.deepStrictEqual(value.participation, {
    type: 'internal',
    artifact: '',
    availability: 'internal'
  });
});

test('fellowship share artifact leaves QR area blank and renders only the private-group caption', () => {
  const ctx = fakeContext();
  const qrSentinel = { id: 'private-qr' };
  const model = modeB.routeToModeBViewModel({
    routeId: 'f1',
    title: '小组同行',
    calendarType: 'fellowship',
    qrCode: 'https://images.example/private-group.png'
  });

  share.renderModeBShareArtifact(ctx, model, { registrationOpen: true }, {
    qrImage: qrSentinel
  });

  const textCalls = ctx.calls.filter((call) => call[0] === 'fillText').map((call) => call[1]);
  assert.ok(textCalls.includes('｜小组同行 · 暂不对外｜'));
  assert.ok(!textCalls.includes('SCAN TO JOIN'));
  assert.ok(!textCalls.includes('扫码进群，即可报名'));
  assert.ok(!ctx.calls.some((call) => call[0] === 'drawImage' && call[1] === qrSentinel));
});
