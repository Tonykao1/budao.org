(function (root, factory) {
  const api = factory();

  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BudaoInvitationShareModeB = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const ARTIFACT_WIDTH = 1080;
  const ARTIFACT_HEIGHT = 1530;
  const CLOSED_VARIANTS = Object.freeze(['1', '3', '5']);
  const DRAWING_STAGE_ORDER = Object.freeze([
    'paper',
    'identity',
    'destination',
    'intent',
    'schedule',
    'meeting',
    'narrative',
    'primaryFacts',
    'secondaryDetails',
    'participation',
    'footer'
  ]);
  const PRIMARY_FACT_KEYS = new Set(['distance', 'duration', 'difficulty', 'suitableFor']);

  function stableHash(value) {
    const text = String(value == null ? '' : value);
    let hash = 2166136261;

    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }

  function selectClosedVariant(stableKey) {
    const bucket = stableHash(stableKey) % 9;
    if (bucket === 0) return '1';
    if (bucket <= 3) return '3';
    return '5';
  }

  function normalizeArtifactRenderState(value, stableKey) {
    const input = value && typeof value === 'object' ? value : {};
    const registrationOpen = input.registrationOpen !== false;

    if (registrationOpen) {
      return { registrationOpen: true, closedVariant: null };
    }

    const requested = CLOSED_VARIANTS.includes(input.closedVariant)
      ? input.closedVariant
      : null;

    return {
      registrationOpen: false,
      closedVariant: requested || selectClosedVariant(stableKey)
    };
  }

  function text(value) {
    return typeof value === 'string' || typeof value === 'number'
      ? String(value).trim()
      : '';
  }

  function safeFacts(viewModel) {
    return Array.isArray(viewModel && viewModel.pills)
      ? viewModel.pills.filter(function (fact) {
        return fact && text(fact.key) && text(fact.label) && text(fact.value);
      })
      : [];
  }

  function write(ctx, value, x, y, options) {
    const settings = options || {};
    ctx.fillStyle = settings.color || '#17130f';
    ctx.font = (settings.weight || 400) + ' ' + (settings.size || 24) +
      'px "PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = settings.align || 'left';
    ctx.fillText(text(value), x, y);
  }

  function drawAsset(ctx, asset, x, y, width, height) {
    if (!asset || typeof ctx.drawImage !== 'function') return false;
    ctx.drawImage(asset, x, y, width, height);
    return true;
  }

  const STAGE_DRAWERS = {
    paper: function (ctx) {
      ctx.fillStyle = '#fbfaf7';
      ctx.fillRect(0, 0, ARTIFACT_WIDTH, ARTIFACT_HEIGHT);
      ctx.strokeStyle = 'rgba(61,48,35,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(42, 42, ARTIFACT_WIDTH - 84, ARTIFACT_HEIGHT - 84);
    },

    identity: function (ctx) {
      write(ctx, 'INVITATION', ARTIFACT_WIDTH / 2, 112, {
        align: 'center',
        color: '#12100d',
        size: 42,
        weight: 700
      });
    },

    destination: function (ctx, viewModel, renderState, assets) {
      if (!drawAsset(ctx, assets.destinationImage, 118, 172, 844, 402)) {
        ctx.fillStyle = '#eee8dc';
        ctx.fillRect(118, 172, 844, 402);
        write(ctx, text(viewModel.title) || '此程影像静候', 540, 382, {
          align: 'center',
          color: '#756a5d',
          size: 26
        });
      }
    },

    intent: function (ctx, viewModel) {
      write(ctx, text(viewModel.title) || '步道同行', 118, 652, {
        color: '#111',
        size: 64,
        weight: 650
      });
      write(ctx, '这是一段被安静预备的路，也是一份邀请。', 118, 706, {
        color: '#4b3424',
        size: 26,
        weight: 500
      });
    },

    schedule: function (ctx, viewModel) {
      const schedule = [text(viewModel.date), text(viewModel.time), text(viewModel.location)]
        .filter(Boolean)
        .join('  ·  ');
      write(ctx, schedule, 118, 770, { color: '#332b24', size: 24, weight: 580 });
    },

    meeting: function (ctx, viewModel) {
      write(ctx, 'MEETING POINT', 118, 832, { color: '#8b7860', size: 15, weight: 700 });
      write(ctx, text(viewModel.meetingPlace) || '集合地点待补充', 118, 868, {
        color: '#332b24',
        size: 26,
        weight: 580
      });
    },

    narrative: function (ctx, viewModel) {
      write(ctx, text(viewModel.description) || '这一程，等待同行的人一起出发。', 118, 934, {
        color: '#5b5147',
        size: 24
      });
    },

    primaryFacts: function (ctx, viewModel) {
      const facts = safeFacts(viewModel).filter(function (fact) {
        return PRIMARY_FACT_KEYS.has(fact.key);
      });
      write(ctx, facts.map(function (fact) {
        return fact.label + ' ' + fact.value;
      }).join('   '), 118, 1010, { color: '#332b24', size: 21, weight: 580 });
    },

    secondaryDetails: function (ctx, viewModel) {
      const facts = safeFacts(viewModel).filter(function (fact) {
        return !PRIMARY_FACT_KEYS.has(fact.key);
      });
      write(ctx, facts.map(function (fact) {
        return fact.label + ' ' + fact.value;
      }).join('   '), 118, 1062, { color: '#62584d', size: 18 });
    },

    participation: function (ctx, viewModel, renderState, assets) {
      if (!renderState.registrationOpen) {
        if (!drawAsset(ctx, assets.closedStampImage, 770, 1110, 176, 214)) {
          ctx.fillStyle = '#f8f5ef';
          ctx.fillRect(782, 1124, 152, 152);
          write(ctx, '本期报名已截止', 858, 1210, {
            align: 'center',
            color: '#6c6258',
            size: 20
          });
        }
        write(ctx, 'CLOSED · ' + renderState.closedVariant, 858, 1320, {
          align: 'center',
          color: '#8b7860',
          size: 16,
          weight: 700
        });
        return;
      }

      if (!drawAsset(ctx, assets.qrImage, 782, 1124, 152, 152)) {
        ctx.fillStyle = '#f8f5ef';
        ctx.fillRect(782, 1124, 152, 152);
        write(ctx, '报名码暂未放出', 858, 1210, {
          align: 'center',
          color: '#6c6258',
          size: 18
        });
      }
      write(ctx, 'SCAN TO JOIN', 858, 1320, {
        align: 'center',
        color: '#8b7860',
        size: 16,
        weight: 700
      });
    },

    footer: function (ctx, viewModel, renderState, assets) {
      if (!drawAsset(ctx, assets.logoImage, 118, 1392, 104, 52)) {
        write(ctx, 'BUDAO', 118, 1430, { color: '#15110d', size: 24, weight: 700 });
      }
      write(ctx, '余生行走，不偏左右', 248, 1430, { color: '#6f6458', size: 22 });
      write(ctx, 'budao.org', 962, 1434, {
        align: 'right',
        color: '#15110d',
        size: 36,
        weight: 750
      });
    }
  };

  function renderModeBShareArtifact(ctx, viewModel, renderState, assets) {
    if (!ctx || typeof ctx.fillRect !== 'function' || typeof ctx.fillText !== 'function' ||
        typeof ctx.strokeRect !== 'function') {
      throw new Error('mode_b_share_context_required');
    }

    const model = viewModel && typeof viewModel === 'object' ? viewModel : {};
    const normalizedState = normalizeArtifactRenderState(renderState, model.key);
    const suppliedAssets = assets && typeof assets === 'object' ? assets : {};
    const completedStages = [];

    DRAWING_STAGE_ORDER.forEach(function (stageName) {
      STAGE_DRAWERS[stageName](ctx, model, normalizedState, suppliedAssets);
      completedStages.push(stageName);
    });

    return {
      width: ARTIFACT_WIDTH,
      height: ARTIFACT_HEIGHT,
      renderState: normalizedState,
      stages: completedStages
    };
  }

  return {
    ARTIFACT_WIDTH,
    ARTIFACT_HEIGHT,
    DRAWING_STAGE_ORDER,
    normalizeArtifactRenderState,
    selectClosedVariant,
    renderModeBShareArtifact
  };
}));
