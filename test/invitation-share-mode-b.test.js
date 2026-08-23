const assert = require('node:assert');
const fs = require('node:fs');
const { describe, it } = require('node:test');

const artifact = require('../invitation-share-mode-b.js');
const modeB = require('../invitation-mode-b.js');
const source = fs.readFileSync(require.resolve('../invitation-share-mode-b.js'), 'utf8');

function viewModel() {
  return modeB.routeToModeBViewModel({
    routeId: 'route-a',
    title: '宽沟环线',
    country: '中国',
    city: '北京',
    region: '门头沟',
    date: '2026-08-29',
    time: '08:30',
    timezone: 'Asia/Shanghai',
    description: '沿山谷与林间缓缓同行。',
    meetingPlace: '东门集合',
    distance: '8 千米',
    duration: '4 小时',
    difficulty: '适中',
    suitableFor: '有步行经验者',
    surface: '山径',
    elevation: '420 米',
    equipmentMinimum: '饮水',
    weather: '晴',
    image: 'https://images.example/destination.jpg',
    qrCode: 'https://images.example/qr.png'
  });
}

function contextMock() {
  const calls = [];
  return {
    calls,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    font: '',
    textAlign: '',
    fillRect() { calls.push(['fillRect', ...arguments]); },
    strokeRect() { calls.push(['strokeRect', ...arguments]); },
    fillText() { calls.push(['fillText', ...arguments, this.font, this.fillStyle, this.textAlign]); },
    drawImage() { calls.push(['drawImage', ...arguments]); },
    measureText(value) {
      const match = String(this.font || '').match(/(\d+(?:\.\d+)?)px/);
      const size = match ? Number(match[1]) : 24;
      return { width: Array.from(String(value)).length * size * 0.56 };
    },
    beginPath() { calls.push(['beginPath']); },
    moveTo() { calls.push(['moveTo', ...arguments]); },
    lineTo() { calls.push(['lineTo', ...arguments]); },
    stroke() { calls.push(['stroke']); },
    arc() { calls.push(['arc', ...arguments]); },
    fill() { calls.push(['fill']); }
  };
}

function rendered(options) {
  const input = options && options.viewModel ? options.viewModel : viewModel();
  const state = options && options.renderState
    ? options.renderState
    : { registrationOpen: true };
  const assets = options && options.assets ? options.assets : {};
  const ctx = contextMock();
  const result = artifact.renderModeBShareArtifact(ctx, input, state, assets);
  return { ctx, result, input, state };
}

function textCallsWithin(ctx, box) {
  return ctx.calls.filter((call) => {
    return call[0] === 'fillText' && call[2] >= box.x && call[2] <= box.x + box.width &&
      call[3] >= box.y && call[3] <= box.y + box.height;
  });
}

describe('Mode B Share Artifact Phase 2D.1 / 2D.2', () => {
  it('1. freezes artifact dimensions at 1080 × 1530', () => {
    assert.strictEqual(artifact.ARTIFACT_WIDTH, 1080);
    assert.strictEqual(artifact.ARTIFACT_HEIGHT, 1530);
  });

  it('2. accepts a normalized Mode B ViewModel', () => {
    const result = artifact.renderModeBShareArtifact(contextMock(), viewModel(), {
      registrationOpen: true
    }, {});
    assert.strictEqual(result.width, 1080);
  });

  it('3. does not mutate ViewModel', () => {
    const input = viewModel();
    const before = structuredClone(input);
    artifact.renderModeBShareArtifact(contextMock(), input, { registrationOpen: true }, {});
    assert.deepStrictEqual(input, before);
  });

  it('4. does not mutate renderState', () => {
    const state = { registrationOpen: false, closedVariant: null };
    const before = structuredClone(state);
    artifact.renderModeBShareArtifact(contextMock(), viewModel(), state, {});
    assert.deepStrictEqual(state, before);
  });

  it('5. selects the same closed variant for the same key', () => {
    assert.strictEqual(artifact.selectClosedVariant('route-a'), artifact.selectClosedVariant('route-a'));
  });

  it('6. representative keys reach variants 1, 3 and 5', () => {
    const variants = new Set(Array.from({ length: 200 }, (_, index) => {
      return artifact.selectClosedVariant('route-' + index);
    }));
    assert.deepStrictEqual([...variants].sort(), ['1', '3', '5']);
  });

  it('7. contains no Math.random dependency', () => {
    assert.ok(!source.includes('Math.random'));
  });

  it('8. contains no Date.now dependency', () => {
    assert.ok(!source.includes('Date.now'));
  });

  it('9. contains no BudaoActiveRoutes dependency', () => {
    assert.ok(!source.includes('BudaoActiveRoutes'));
  });

  it('10. contains no routes API dependency', () => {
    assert.ok(!source.includes('/api/routes'));
  });

  it('11. performs no fetch or network operation', () => {
    assert.ok(!/\bfetch\s*\(/.test(source));
    assert.ok(!/XMLHttpRequest/.test(source));
  });

  it('12. does not access DOM or document', () => {
    assert.ok(!/\bdocument\b/.test(source));
    assert.ok(!/querySelector/.test(source));
  });

  it('13. does not invoke navigator.share', () => {
    assert.ok(!source.includes('navigator.share'));
  });

  it('14. does not create Object URLs', () => {
    assert.ok(!source.includes('createObjectURL'));
    assert.ok(!source.includes('revokeObjectURL'));
  });

  it('15. draws stages in deterministic semantic order', () => {
    const result = artifact.renderModeBShareArtifact(contextMock(), viewModel(), {
      registrationOpen: true
    }, {});
    assert.deepStrictEqual(result.stages, artifact.DRAWING_STAGE_ORDER);
    assert.deepStrictEqual(result.stages, [
      'paper', 'identity', 'destination', 'intent', 'schedule', 'meeting',
      'narrative', 'primaryFacts', 'secondaryDetails', 'participation', 'footer'
    ]);
  });

  it('16. open registration normalizes closedVariant to null', () => {
    assert.deepStrictEqual(
      artifact.normalizeArtifactRenderState({ registrationOpen: true, closedVariant: '5' }, 'route-a'),
      { registrationOpen: true, closedVariant: null }
    );
  });

  it('17. closed registration resolves a valid deterministic variant', () => {
    const state = artifact.normalizeArtifactRenderState({ registrationOpen: false }, 'route-a');
    assert.strictEqual(state.registrationOpen, false);
    assert.ok(['1', '3', '5'].includes(state.closedVariant));
    assert.deepStrictEqual(state, artifact.normalizeArtifactRenderState({ registrationOpen: false }, 'route-a'));
  });

  it('18. tolerates missing optional image assets', () => {
    assert.doesNotThrow(() => {
      artifact.renderModeBShareArtifact(contextMock(), viewModel(), {
        registrationOpen: false
      }, {});
    });
  });

  it('19. repeated render preparation is deterministic', () => {
    const first = artifact.renderModeBShareArtifact(contextMock(), viewModel(), {
      registrationOpen: false
    }, {});
    const second = artifact.renderModeBShareArtifact(contextMock(), viewModel(), {
      registrationOpen: false
    }, {});
    assert.deepStrictEqual(first, second);
  });

  it('20. leaves the existing Mode B ViewModel schema unchanged', () => {
    const keys = Object.keys(viewModel()).sort();
    assert.deepStrictEqual(keys, [
      'date', 'description', 'key', 'location', 'meetingPlace', 'participation',
      'pills', 'time', 'timezone', 'title', 'visual'
    ]);
    assert.ok(!keys.includes('registrationOpen'));
    assert.ok(!keys.includes('closedVariant'));
  });

  it('21. preserves explicit valid closed variants and rejects invalid ones', () => {
    assert.strictEqual(
      artifact.normalizeArtifactRenderState({ registrationOpen: false, closedVariant: '3' }, 'route-a').closedVariant,
      '3'
    );
    assert.ok(['1', '3', '5'].includes(
      artifact.normalizeArtifactRenderState({ registrationOpen: false, closedVariant: '9' }, 'route-a').closedVariant
    ));
  });

  it('22. uses only explicitly supplied image assets', () => {
    const ctx = contextMock();
    const assets = {
      destinationImage: { id: 'destination' },
      qrImage: { id: 'qr' },
      logoImage: { id: 'logo' }
    };
    artifact.renderModeBShareArtifact(ctx, viewModel(), { registrationOpen: true }, assets);
    const drawnAssets = ctx.calls.filter((call) => call[0] === 'drawImage').map((call) => call[1]);
    assert.deepStrictEqual(drawnAssets, [assets.destinationImage, assets.qrImage, assets.logoImage]);
  });

  it('23. makes the destination image the dominant visual region', () => {
    const destination = artifact.ARTIFACT_LAYOUT.destination;
    const otherRegions = Object.entries(artifact.ARTIFACT_LAYOUT)
      .filter(([name]) => name !== 'destination')
      .map(([, box]) => box.width * box.height);
    assert.strictEqual(destination.width, 844);
    assert.strictEqual(destination.height, 380);
    assert.ok(destination.width * destination.height > Math.max(...otherRegions));
    assert.ok(destination.width > artifact.ARTIFACT_WIDTH * 0.75);
  });

  it('24. retains postal perforation and postmark drawing', () => {
    const { ctx } = rendered({});
    assert.ok(ctx.calls.filter((call) => call[0] === 'arc').length > 20);
    assert.ok(ctx.calls.some((call) => call[0] === 'fillText' && call[1] === 'BUDAO'));
  });

  it('25. has no legacy rounded-pill drawing contract', () => {
    assert.ok(!source.includes('drawPill'));
    assert.ok(!source.includes('roundRect'));
    assert.ok(!source.includes('borderRadius'));
  });

  it('26. gives primary facts a distinct bounded region', () => {
    const box = artifact.ARTIFACT_LAYOUT.primaryFacts;
    const { ctx } = rendered({});
    const calls = textCallsWithin(ctx, box);
    assert.ok(calls.some((call) => call[1] === '距离'));
    assert.ok(calls.some((call) => call[1] === '预计'));
    assert.ok(calls.some((call) => call[1] === '难度'));
    assert.ok(calls.some((call) => call[1] === '适合'));
  });

  it('27. keeps secondary details visually subordinate by contract', () => {
    const { ctx } = rendered({});
    const primary = textCallsWithin(ctx, artifact.ARTIFACT_LAYOUT.primaryFacts);
    const secondary = textCallsWithin(ctx, artifact.ARTIFACT_LAYOUT.secondaryDetails);
    const primaryFonts = primary.map((call) => call[4]).join(' ');
    const secondaryFonts = secondary.map((call) => call[4]).join(' ');
    assert.match(primaryFonts, /20px/);
    assert.match(secondaryFonts, /15px/);
    assert.ok(artifact.ARTIFACT_LAYOUT.secondaryDetails.height < artifact.ARTIFACT_LAYOUT.primaryFacts.height);
  });

  it('28. includes a distinct Meeting Point region', () => {
    const { ctx } = rendered({});
    const calls = textCallsWithin(ctx, artifact.ARTIFACT_LAYOUT.meeting);
    assert.ok(calls.some((call) => call[1] === 'MEETING POINT'));
    assert.ok(calls.some((call) => call[1] === '东门集合'));
  });

  it('29. caps narrative deterministically at three lines', () => {
    const input = viewModel();
    input.description = '这是一段很长的同行叙述。'.repeat(80);
    const { ctx, result } = rendered({ viewModel: input });
    const narrative = textCallsWithin(ctx, artifact.ARTIFACT_LAYOUT.narrative)
      .filter((call) => call[1] !== '同行邀请');
    assert.strictEqual(result.textLimits.narrative, 3);
    assert.strictEqual(narrative.length, 3);
    assert.ok(narrative[2][1].endsWith('…'));
  });

  it('30. bounds a long Chinese title to two lines', () => {
    const input = viewModel();
    input.title = '北京西山宽沟森林山谷春日同行环线'.repeat(8);
    const { ctx, result } = rendered({ viewModel: input });
    const titleCalls = textCallsWithin(ctx, artifact.ARTIFACT_LAYOUT.intent)
      .filter((call) => /60px/.test(call[4]));
    assert.strictEqual(result.textLimits.title, 2);
    assert.strictEqual(titleCalls.length, 2);
    assert.ok(titleCalls[1][1].endsWith('…'));
  });

  it('31. bounds long location and meeting-place values', () => {
    const input = viewModel();
    input.location = '中国北京市门头沟区宽沟森林公园东侧入口'.repeat(8);
    input.meetingPlace = '宽沟森林公园东门公共交通站旁集合点'.repeat(8);
    const { ctx, result } = rendered({ viewModel: input });
    const locationCalls = textCallsWithin(ctx, artifact.ARTIFACT_LAYOUT.schedule)
      .filter((call) => call[2] === artifact.ARTIFACT_LAYOUT.schedule.x + 440 && /22px/.test(call[4]));
    const meetingCalls = textCallsWithin(ctx, artifact.ARTIFACT_LAYOUT.meeting)
      .filter((call) => call[2] === artifact.ARTIFACT_LAYOUT.meeting.x && /23px/.test(call[4]));
    assert.ok(locationCalls.length <= result.textLimits.location);
    assert.ok(meetingCalls.length <= result.textLimits.meetingPlace);
    assert.ok(locationCalls.at(-1)[1].endsWith('…'));
    assert.ok(meetingCalls.at(-1)[1].endsWith('…'));
  });

  it('32. uses the QR asset with a preserved white quiet zone when open', () => {
    const qr = { id: 'qr', width: 300, height: 300 };
    const { ctx } = rendered({ assets: { qrImage: qr } });
    const imageCall = ctx.calls.find((call) => call[0] === 'drawImage' && call[1] === qr);
    const whiteFrame = ctx.calls.find((call) => call[0] === 'fillRect' &&
      call[1] === artifact.ARTIFACT_LAYOUT.participation.x + 12 &&
      call[3] === 190 && call[4] === 190);
    assert.ok(imageCall);
    assert.ok(whiteFrame);
    assert.ok(ctx.calls.some((call) => call[0] === 'fillText' &&
      call[1] === '扫码进群，即可报名'));
  });

  it('33. renders a stable open missing-QR state', () => {
    const first = rendered({});
    const second = rendered({});
    assert.deepStrictEqual(first.ctx.calls, second.ctx.calls);
    assert.ok(first.ctx.calls.some((call) => call[0] === 'fillText' &&
      call[1].includes('报名码暂未放出')));
  });

  it('34. uses the supplied closed stamp asset for closed state', () => {
    const stamp = { id: 'closed', width: 240, height: 280 };
    const { ctx } = rendered({
      renderState: { registrationOpen: false, closedVariant: '3' },
      assets: { closedStampImage: stamp }
    });
    assert.ok(ctx.calls.some((call) => call[0] === 'drawImage' && call[1] === stamp));
    assert.ok(!ctx.calls.some((call) => call[0] === 'fillText' && call[1] === 'SCAN TO JOIN'));
  });

  it('35. renders a stable closed missing-stamp fallback', () => {
    const options = { renderState: { registrationOpen: false } };
    const first = rendered(options);
    const second = rendered(options);
    assert.deepStrictEqual(first.ctx.calls, second.ctx.calls);
    assert.ok(first.ctx.calls.some((call) => call[0] === 'fillText' &&
      call[1].includes('本期报名')));
  });

  it('36. produces the same draw-command sequence for identical inputs', () => {
    const first = rendered({});
    const second = rendered({});
    assert.deepStrictEqual(first.ctx.calls, second.ctx.calls);
    assert.deepStrictEqual(first.result, second.result);
  });

  it('37. retains the Budao publication footer', () => {
    const { ctx, result } = rendered({});
    const footer = textCallsWithin(ctx, artifact.ARTIFACT_LAYOUT.footer);
    assert.ok(footer.some((call) => call[1] === '余生行走，不偏左右'));
    assert.ok(footer.some((call) => call[1] === 'budao.org'));
    assert.strictEqual(result.stages.at(-1), 'footer');
  });

  it('38. keeps the renderer usable with a lightweight Canvas mock', () => {
    const ctx = {
      fillRect() {},
      fillText() {},
      strokeRect() {}
    };
    assert.doesNotThrow(() => artifact.renderModeBShareArtifact(
      ctx,
      viewModel(),
      { registrationOpen: true },
      {}
    ));
  });
});
