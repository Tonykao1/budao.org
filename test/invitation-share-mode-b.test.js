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
    fillText() { calls.push(['fillText', ...arguments]); },
    drawImage() { calls.push(['drawImage', ...arguments]); }
  };
}

describe('Mode B Share Artifact Phase 2D.1', () => {
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
});
