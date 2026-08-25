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
  const TEXT_LIMITS = Object.freeze({
    title: 2,
    location: 2,
    meetingPlace: 2,
    narrative: 3,
    primaryFactValue: 2,
    secondaryDetailValue: 2
  });
  const ARTIFACT_LAYOUT = Object.freeze({
    identity: Object.freeze({ x: 118, y: 82, width: 844, height: 52 }),
    destination: Object.freeze({ x: 118, y: 160, width: 844, height: 380 }),
    intent: Object.freeze({ x: 118, y: 606, width: 844, height: 150 }),
    schedule: Object.freeze({ x: 118, y: 786, width: 844, height: 112 }),
    meeting: Object.freeze({ x: 118, y: 920, width: 844, height: 82 }),
    narrative: Object.freeze({ x: 118, y: 1024, width: 844, height: 126 }),
    primaryFacts: Object.freeze({ x: 118, y: 1188, width: 554, height: 126 }),
    secondaryDetails: Object.freeze({ x: 118, y: 1326, width: 554, height: 82 }),
    participation: Object.freeze({ x: 748, y: 1180, width: 214, height: 236 }),
    footer: Object.freeze({ x: 118, y: 1442, width: 844, height: 46 })
  });

  function stableHash(value) {
    const input = String(value == null ? '' : value);
    let hash = 2166136261;

    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
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
      ? String(value).replace(/\s+/g, ' ').trim()
      : '';
  }

  function safeFacts(viewModel) {
    return Array.isArray(viewModel && viewModel.pills)
      ? viewModel.pills.filter(function (fact) {
        return fact && text(fact.key) && text(fact.label) && text(fact.value);
      })
      : [];
  }

  function setFont(ctx, options) {
    const settings = options || {};
    const family = settings.family ||
      '"PingFang SC", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = settings.color || '#17130f';
    ctx.font = (settings.weight || 400) + ' ' + (settings.size || 24) + 'px ' + family;
    ctx.textAlign = settings.align || 'left';
  }

  function measuredWidth(ctx, value, fontSize) {
    if (typeof ctx.measureText === 'function') {
      return ctx.measureText(value).width;
    }
    return Array.from(value).length * (fontSize || 24) * 0.58;
  }

  function fitWithEllipsis(ctx, value, maxWidth, fontSize) {
    let result = text(value);
    if (measuredWidth(ctx, result, fontSize) <= maxWidth) return result;

    while (result.length > 1 && measuredWidth(ctx, result + '…', fontSize) > maxWidth) {
      result = result.slice(0, -1);
    }
    return result + '…';
  }

  function wrappedLines(ctx, value, maxWidth, maxLines, fontSize) {
    const chars = Array.from(text(value));
    const lines = [];
    let line = '';

    chars.forEach(function (character) {
      const candidate = line + character;
      if (line && measuredWidth(ctx, candidate, fontSize) > maxWidth) {
        lines.push(line);
        line = character;
      } else {
        line = candidate;
      }
    });
    if (line) lines.push(line);
    if (!lines.length) lines.push('');

    if (lines.length > maxLines) {
      const bounded = lines.slice(0, maxLines);
      const remaining = lines.slice(maxLines - 1).join('');
      bounded[maxLines - 1] = fitWithEllipsis(ctx, remaining, maxWidth, fontSize);
      return bounded;
    }
    return lines;
  }

  function drawBoundedText(ctx, value, x, y, maxWidth, options) {
    const settings = options || {};
    const fontSize = settings.size || 24;
    const lineHeight = settings.lineHeight || Math.round(fontSize * 1.45);
    const maxLines = settings.maxLines || 1;
    setFont(ctx, settings);
    const lines = wrappedLines(ctx, value, maxWidth, maxLines, fontSize);

    lines.forEach(function (line, index) {
      ctx.fillText(line, x, y + index * lineHeight);
    });
    return lines;
  }

  function drawRule(ctx, x1, y1, x2, y2, color, width) {
    if (typeof ctx.beginPath !== 'function' || typeof ctx.moveTo !== 'function' ||
        typeof ctx.lineTo !== 'function' || typeof ctx.stroke !== 'function') return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawCircle(ctx, x, y, radius, fill, stroke) {
    if (typeof ctx.beginPath !== 'function' || typeof ctx.arc !== 'function') return;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    if (fill && typeof ctx.fill === 'function') {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke && typeof ctx.stroke === 'function') {
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  function drawCoverAsset(ctx, asset, box) {
    if (!asset || typeof ctx.drawImage !== 'function') return false;
    const sourceWidth = Number(asset.naturalWidth || asset.width);
    const sourceHeight = Number(asset.naturalHeight || asset.height);

    if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
      ctx.drawImage(asset, box.x, box.y, box.width, box.height);
      return true;
    }

    const scale = Math.max(box.width / sourceWidth, box.height / sourceHeight);
    const sourceCropWidth = box.width / scale;
    const sourceCropHeight = box.height / scale;
    const sourceX = (sourceWidth - sourceCropWidth) / 2;
    const sourceY = (sourceHeight - sourceCropHeight) / 2;
    ctx.drawImage(
      asset,
      sourceX,
      sourceY,
      sourceCropWidth,
      sourceCropHeight,
      box.x,
      box.y,
      box.width,
      box.height
    );
    return true;
  }

  function drawContainAsset(ctx, asset, box) {
    if (!asset || typeof ctx.drawImage !== 'function') return false;
    const sourceWidth = Number(asset.naturalWidth || asset.width);
    const sourceHeight = Number(asset.naturalHeight || asset.height);

    if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
      ctx.drawImage(asset, box.x, box.y, box.width, box.height);
      return true;
    }

    const scale = Math.min(box.width / sourceWidth, box.height / sourceHeight);
    const width = sourceWidth * scale;
    const height = sourceHeight * scale;
    ctx.drawImage(
      asset,
      box.x + (box.width - width) / 2,
      box.y + (box.height - height) / 2,
      width,
      height
    );
    return true;
  }

  function drawPerforatedFrame(ctx, box) {
    const outer = { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 };
    ctx.fillStyle = '#fff';
    ctx.fillRect(outer.x, outer.y, outer.width, outer.height);
    const paper = '#fbfaf7';

    for (let offset = 8; offset < outer.width; offset += 20) {
      drawCircle(ctx, outer.x + offset, outer.y, 5.5, paper);
      drawCircle(ctx, outer.x + offset, outer.y + outer.height, 5.5, paper);
    }
    for (let offset = 8; offset < outer.height; offset += 20) {
      drawCircle(ctx, outer.x, outer.y + offset, 5.5, paper);
      drawCircle(ctx, outer.x + outer.width, outer.y + offset, 5.5, paper);
    }
  }

  function drawPostmark(ctx, viewModel) {
    const centerX = 858;
    const centerY = 476;
    ctx.lineWidth = 2.5;
    drawCircle(ctx, centerX, centerY, 54, null, 'rgba(43,49,55,0.58)');
    ctx.lineWidth = 1.7;
    drawCircle(ctx, centerX, centerY, 42, null, 'rgba(43,49,55,0.46)');
    drawBoundedText(ctx, 'BUDAO', centerX, centerY - 8, 82, {
      align: 'center',
      color: 'rgba(43,49,55,0.68)',
      family: '"Courier New", monospace',
      size: 15,
      weight: 700,
      maxLines: 1
    });
    drawBoundedText(ctx, text(viewModel.date) || 'POST', centerX, centerY + 15, 82, {
      align: 'center',
      color: 'rgba(43,49,55,0.62)',
      family: '"Courier New", monospace',
      size: 10,
      weight: 700,
      maxLines: 1
    });
    for (let index = 0; index < 4; index += 1) {
      drawRule(
        ctx,
        centerX + 46,
        centerY - 30 + index * 16,
        centerX + 110,
        centerY - 38 + index * 16,
        'rgba(43,49,55,0.38)',
        2
      );
    }
  }

  function factMap(viewModel) {
    return new Map(safeFacts(viewModel).map(function (fact) {
      return [fact.key, fact];
    }));
  }

  function drawFact(ctx, fact, x, y, width, options) {
    if (!fact) return;
    const settings = options || {};
    drawBoundedText(ctx, fact.label, x, y, width, {
      color: settings.labelColor || '#8b7860',
      size: settings.labelSize || 14,
      weight: 700,
      maxLines: 1
    });
    drawBoundedText(ctx, fact.value, x, y + (settings.valueOffset || 28), width, {
      color: settings.valueColor || '#332b24',
      size: settings.valueSize || 21,
      weight: settings.valueWeight || 580,
      lineHeight: settings.lineHeight || 26,
      maxLines: settings.maxLines || 2
    });
  }

  const STAGE_DRAWERS = {
    paper: function (ctx) {
      ctx.fillStyle = '#fbfaf7';
      ctx.fillRect(0, 0, ARTIFACT_WIDTH, ARTIFACT_HEIGHT);
      ctx.strokeStyle = 'rgba(61,48,35,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(42, 42, ARTIFACT_WIDTH - 84, ARTIFACT_HEIGHT - 84);
      drawCircle(ctx, 878, 134, 82, 'rgba(184,156,82,0.07)');
    },

    identity: function (ctx) {
      const box = ARTIFACT_LAYOUT.identity;
      drawBoundedText(ctx, 'INVITATION', box.x + box.width / 2, box.y + 24, box.width, {
        align: 'center',
        color: '#211c17',
        family: '"Times New Roman", "Songti SC", serif',
        size: 28,
        weight: 650,
        maxLines: 1
      });
      drawRule(
        ctx,
        box.x + box.width / 2 - 28,
        box.y + 48,
        box.x + box.width / 2 + 28,
        box.y + 48,
        'rgba(184,156,82,0.58)',
        1
      );
    },

    destination: function (ctx, viewModel, renderState, assets) {
      const box = ARTIFACT_LAYOUT.destination;
      drawPerforatedFrame(ctx, box);
      if (!drawCoverAsset(ctx, assets.destinationImage, box)) {
        ctx.fillStyle = '#eee8dc';
        ctx.fillRect(box.x, box.y, box.width, box.height);
        drawBoundedText(ctx, text(viewModel.title) || '此程影像静候', box.x + box.width / 2,
          box.y + box.height / 2, box.width - 120, {
            align: 'center',
            color: '#756a5d',
            family: '"Kaiti SC", "STKaiti", serif',
            size: 26,
            maxLines: 2,
            lineHeight: 38
          });
      }
      ctx.strokeStyle = 'rgba(24,18,12,0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      drawPostmark(ctx, viewModel);
    },

    intent: function (ctx, viewModel) {
      const box = ARTIFACT_LAYOUT.intent;
      drawBoundedText(ctx, text(viewModel.title) || '步道同行', box.x, box.y + 46, box.width, {
        color: '#111',
        size: 60,
        weight: 650,
        lineHeight: 66,
        maxLines: TEXT_LIMITS.title
      });
      drawBoundedText(ctx, '这是一段被安静预备的路，也是一份邀请。', box.x, box.y + 140,
        box.width, {
          color: '#4b3424',
          size: 24,
          weight: 500,
          maxLines: 1
        });
    },

    schedule: function (ctx, viewModel) {
      const box = ARTIFACT_LAYOUT.schedule;
      const columns = [
        { label: '日期', value: text(viewModel.date) || '待定', x: box.x, width: 190 },
        { label: '时间', value: text(viewModel.time) ? text(viewModel.time) + ' 集合' : '待定', x: box.x + 220, width: 190 },
        { label: '地点', value: text(viewModel.location) || '同行地点待定', x: box.x + 440, width: 404 }
      ];
      drawRule(ctx, box.x, box.y, box.x + box.width, box.y, 'rgba(61,48,35,0.14)', 1);
      drawRule(ctx, box.x, box.y + box.height, box.x + box.width, box.y + box.height,
        'rgba(61,48,35,0.14)', 1);
      columns.forEach(function (column) {
        drawBoundedText(ctx, column.label, column.x, box.y + 31, column.width, {
          color: '#8b7860',
          size: 14,
          weight: 700,
          maxLines: 1
        });
        drawBoundedText(ctx, column.value, column.x, box.y + 67, column.width, {
          color: '#332b24',
          size: 22,
          weight: 580,
          lineHeight: 28,
          maxLines: column.label === '地点' ? TEXT_LIMITS.location : 1
        });
      });
    },

    meeting: function (ctx, viewModel) {
      const box = ARTIFACT_LAYOUT.meeting;
      drawBoundedText(ctx, 'MEETING POINT', box.x, box.y + 22, 200, {
        color: '#8b7860',
        size: 13,
        weight: 700,
        maxLines: 1
      });
      drawBoundedText(ctx, text(viewModel.meetingPlace) || '集合地点待补充', box.x, box.y + 55,
        590, {
          color: '#332b24',
          size: 23,
          weight: 580,
          lineHeight: 25,
          maxLines: TEXT_LIMITS.meetingPlace
        });
      drawRule(ctx, box.x + 628, box.y + 12, box.x + 628, box.y + 70,
        'rgba(184,156,82,0.28)', 1);
      drawBoundedText(ctx, '请预留到达与', box.x + 656, box.y + 32, 188, {
          color: '#8d8378',
          size: 15,
          maxLines: 1
        });
      drawBoundedText(ctx, '彼此等候的时间', box.x + 656, box.y + 55, 188, {
          color: '#8d8378',
          size: 15,
          maxLines: 1
        });
    },

    narrative: function (ctx, viewModel) {
      const box = ARTIFACT_LAYOUT.narrative;
      drawBoundedText(ctx, text(viewModel.description) ||
        '这一程，已经安静预备，等待同行的人一起出发。', box.x, box.y + 34, box.width, {
          color: '#5b5147',
          family: '"Kaiti SC", "STKaiti", "Songti SC", serif',
          size: 22,
          lineHeight: 32,
          maxLines: TEXT_LIMITS.narrative
        });
    },

    primaryFacts: function (ctx, viewModel) {
      const box = ARTIFACT_LAYOUT.primaryFacts;
      const facts = factMap(viewModel);
      const ordered = ['distance', 'duration', 'difficulty', 'suitableFor'];
      const columnWidth = 258;
      ordered.forEach(function (key, index) {
        const column = index % 2;
        const row = Math.floor(index / 2);
        drawFact(ctx, facts.get(key), box.x + column * 296, box.y + row * 66, columnWidth, {
          labelSize: 13,
          valueSize: 16,
          valueWeight: 600,
          valueOffset: 27,
          lineHeight: 24,
          maxLines: TEXT_LIMITS.primaryFactValue
        });
      });
    },

    secondaryDetails: function (ctx, viewModel) {
      const box = ARTIFACT_LAYOUT.secondaryDetails;
      const facts = safeFacts(viewModel).filter(function (fact) {
        return !PRIMARY_FACT_KEYS.has(fact.key);
      }).slice(0, 4);
      const columnWidth = 268;
      facts.forEach(function (fact, index) {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = box.x + column * 286;
        const y = box.y + 16 + row * 34;
        drawBoundedText(ctx, fact.label, x, y, 40, {
          color: '#9b9083',
          size: 11,
          weight: 700,
          maxLines: 1
        });
        drawBoundedText(ctx, fact.value, x + 48, y, columnWidth - 48, {
          color: '#332b24',
          size: 16,
          weight: 600,
          lineHeight: 17,
          maxLines: TEXT_LIMITS.secondaryDetailValue
        });
      });
    },

    participation: function (ctx, viewModel, renderState, assets) {
      const box = ARTIFACT_LAYOUT.participation;
      drawRule(ctx, box.x - 32, box.y, box.x - 32, box.y + box.height,
        'rgba(184,156,82,0.28)', 1);
      if (!renderState.registrationOpen) {
        if (!drawContainAsset(ctx, assets.closedStampImage, {
          x: box.x + 12,
          y: box.y,
          width: box.width - 24,
          height: 164
        })) {
          ctx.fillStyle = '#f8f5ef';
          ctx.fillRect(box.x + 26, box.y + 12, 162, 146);
          drawBoundedText(ctx, '本期报名\n已截止'.replace(/\n/g, ' '), box.x + box.width / 2,
            box.y + 75, 136, {
              align: 'center',
              color: '#6c6258',
              size: 20,
              lineHeight: 30,
              maxLines: 2
            });
        }
        drawBoundedText(ctx, '此程已封缄', box.x + box.width / 2, box.y + 190, box.width, {
          align: 'center',
          color: '#8b7860',
          size: 14,
          weight: 700,
          maxLines: 1
        });
        drawBoundedText(ctx, '本期报名已截止', box.x + box.width / 2, box.y + 218, box.width, {
          align: 'center',
          color: '#15110d',
          size: 20,
          weight: 580,
          maxLines: 1
        });
        return;
      }

      const qrOuter = { x: box.x + 12, y: box.y, width: 190, height: 190 };
      const qrInner = { x: box.x + 30, y: box.y + 18, width: 154, height: 154 };
      ctx.fillStyle = '#fff';
      ctx.fillRect(qrOuter.x, qrOuter.y, qrOuter.width, qrOuter.height);
      ctx.strokeStyle = 'rgba(184,156,82,0.38)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(qrOuter.x, qrOuter.y, qrOuter.width, qrOuter.height);

      if (!drawContainAsset(ctx, assets.qrImage, qrInner)) {
        ctx.fillStyle = '#f8f5ef';
        ctx.fillRect(qrInner.x, qrInner.y, qrInner.width, qrInner.height);
        drawBoundedText(ctx, '报名码暂未放出', box.x + box.width / 2, box.y + 102, 138, {
          align: 'center',
          color: '#6c6258',
          size: 17,
          lineHeight: 26,
          maxLines: 2
        });
      }
      drawBoundedText(ctx, 'SCAN TO JOIN', box.x + box.width / 2, box.y + 207, box.width, {
        align: 'center',
        color: '#8b7860',
        size: 13,
        weight: 700,
        maxLines: 1
      });
      drawBoundedText(ctx, '扫码进群，即可报名', box.x + box.width / 2, box.y + 234, box.width, {
        align: 'center',
        color: '#15110d',
        size: 18,
        weight: 580,
        maxLines: 1
      });
    },

    footer: function (ctx, viewModel, renderState, assets) {
      const box = ARTIFACT_LAYOUT.footer;
      drawRule(ctx, box.x, box.y, box.x + box.width, box.y, 'rgba(20,16,12,0.16)', 1);
      if (!drawContainAsset(ctx, assets.logoImage, {
        x: box.x,
        y: box.y + 5,
        width: 76,
        height: 36
      })) {
        drawBoundedText(ctx, 'BUDAO', box.x, box.y + 33, 76, {
          color: '#15110d',
          size: 18,
          weight: 700,
          maxLines: 1
        });
      }
      drawBoundedText(ctx, '余生行走，不偏左右', box.x + 104, box.y + 32, 330, {
        color: '#6f6458',
        family: '"Songti SC", "Times New Roman", serif',
        size: 20,
        maxLines: 1
      });
      drawBoundedText(ctx, 'budao.org', box.x + box.width, box.y + 34, 250, {
        align: 'right',
        color: '#15110d',
        size: 32,
        weight: 750,
        maxLines: 1
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
      stages: completedStages,
      layout: ARTIFACT_LAYOUT,
      textLimits: TEXT_LIMITS
    };
  }

  return {
    ARTIFACT_WIDTH,
    ARTIFACT_HEIGHT,
    ARTIFACT_LAYOUT,
    TEXT_LIMITS,
    DRAWING_STAGE_ORDER,
    normalizeArtifactRenderState,
    selectClosedVariant,
    renderModeBShareArtifact
  };
}));
