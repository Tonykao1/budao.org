import assert from 'node:assert';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const modeB = require('../invitation-mode-b.js');
const { createInvitationEngine } = require('../invitation-engine.js');

function fakeContext() {
  const calls = [];
  return {
    calls,
    fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: 'left',
    fillRect(...args) { calls.push(['fillRect', ...args]); },
    strokeRect(...args) { calls.push(['strokeRect', ...args]); },
    fillText(...args) { calls.push(['fillText', ...args]); },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
    measureText(value) { return { width: String(value).length * 12 }; },
    drawImage(...args) { calls.push(['drawImage', ...args]); }
  };
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

test('fellowship artifact clears the QR area after base rendering and draws the private-group caption', async () => {
  const ctx = fakeContext();
  let renderState = null;
  let renderAssets = null;
  let selectClosedCalls = 0;
  const canvas = {
    width: 0,
    height: 0,
    getContext() { return ctx; },
    toBlob(callback) { callback({ type: 'image/png' }); }
  };
  const runtime = {
    BudaoInvitationModeB: modeB,
    BudaoInvitationShareModeB: {
      selectClosedVariant() { selectClosedCalls += 1; return '1'; },
      renderModeBShareArtifact(context, viewModel, state, assets) {
        renderState = state;
        renderAssets = assets;
        context.fillText('SCAN TO JOIN', 855, 1387);
        context.fillText('扫码进群，即可报名', 855, 1414);
      }
    },
    document: {
      createElement(tag) { return tag === 'canvas' ? canvas : {}; }
    },
    isQrRegistrationOpen() { return false; }
  };

  const engine = createInvitationEngine(runtime);
  const result = await engine.createArtifact({
    routeId: 'f1',
    title: '小组同行',
    calendarType: 'fellowship',
    qrCode: 'https://images.example/private-group.png'
  });

  assert.strictEqual(result.viewModel.participation.availability, 'internal');
  assert.strictEqual(renderState.registrationOpen, true);
  assert.strictEqual(renderState.closedVariant, null);
  assert.strictEqual(selectClosedCalls, 0);
  assert.strictEqual(renderAssets.qrImage, null);
  assert.strictEqual(renderAssets.closedStampImage, null);

  const oldCopyIndex = ctx.calls.findIndex((call) => call[0] === 'fillText' && call[1] === '扫码进群，即可报名');
  const clearIndex = ctx.calls.findIndex((call) =>
    call[0] === 'fillRect' && call[1] === 748 && call[2] === 1180 && call[3] === 214 && call[4] === 236
  );
  const privateCopyIndex = ctx.calls.findIndex((call) =>
    call[0] === 'fillText' && call[1] === '｜小组同行 · 暂不对外｜'
  );
  assert.ok(oldCopyIndex >= 0);
  assert.ok(clearIndex > oldCopyIndex, 'QR/copy area must be cleared after the base renderer');
  assert.ok(privateCopyIndex > clearIndex, 'private-group caption must be drawn after clearing the area');
});

test('invitation snapshot builder stores fellowship nature and never stores its QR artifact', () => {
  const source = fs.readFileSync(new URL('../api/invitation.js', import.meta.url), 'utf8');
  assert.match(source, /calendarType\s*=\s*typeof route\.calendarType/);
  assert.match(source, /calendarType\s*===\s*'fellowship'/);
  assert.match(source, /\{ type: 'internal', artifact: '' \}/);
});
