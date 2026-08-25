const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { describe, it } = require('node:test');

const { createInvitationEngine } = require('../invitation-engine.js');
const realModeB = require('../invitation-mode-b.js');
const frozenArtifact = require('../invitation-share-mode-b.js');
const engineSource = fs.readFileSync(require.resolve('../invitation-engine.js'), 'utf8');
const htmlSource = fs.readFileSync(path.join(__dirname, '..', 'test.html'), 'utf8');

function classList() {
  const values = new Set();
  return {
    add(value) { values.add(value); },
    remove(value) { values.delete(value); },
    contains(value) { return values.has(value); }
  };
}

function element(tag, documentRef) {
  const node = {
    tagName: tag.toUpperCase(),
    id: '', className: '', dataset: {}, attributes: {}, children: [],
    classList: classList(), hidden: false, disabled: false, textContent: '',
    setAttribute(name, value) { this.attributes[name] = String(value); },
    addEventListener(name, handler) { this.listeners[name] = handler; },
    listeners: {},
    appendChild(child) { this.children.push(child); if (child.id) documentRef.nodes.set(child.id, child); },
    replaceChildren(...children) { this.children = children; },
    focus() { documentRef.activeElement = this; this.focused = true; },
    click() { this.clicked = true; },
    closest(selector) {
      if (selector.includes('invitation-close') && this.attributes['data-invitation-close'] != null) return this;
      if (selector.includes('invitation-share') && this.attributes['data-invitation-share'] != null) return this;
      if (selector.includes('invitation-download') && this.attributes['data-invitation-download'] != null) return this;
      return null;
    }
  };
  let markup = '';
  Object.defineProperty(node, 'innerHTML', {
    get() { return markup; },
    set(value) {
      markup = value;
      if (value.includes('invitation-shell')) {
        const frame = element('div', documentRef);
        const status = element('p', documentRef);
        const close = element('button', documentRef);
        const download = element('button', documentRef);
        const share = element('button', documentRef);
        close.attributes['data-invitation-close'] = '';
        download.attributes['data-invitation-download'] = '';
        share.attributes['data-invitation-share'] = '';
        node.parts = { frame, status, close, download, share };
      } else if (value.includes('invitation-preparing')) {
        node.preparing = element('div', documentRef);
      }
    }
  });
  node.querySelector = function (selector) {
    if (selector === '.invitation-frame') return this.parts && this.parts.frame;
    if (selector === '.invitation-status') return this.parts && this.parts.status;
    if (selector.includes('data-invitation-close')) return this.parts && this.parts.close;
    if (selector.includes('data-invitation-download')) return this.parts && this.parts.download;
    if (selector.includes('data-invitation-share')) return this.parts && this.parts.share;
    if (selector === '.invitation-preparing') return this.preparing || null;
    return null;
  };
  node.querySelectorAll = function () {
    return this.parts ? [this.parts.close, this.parts.download, this.parts.share]
      .filter((item) => !item.disabled && !item.hidden) : [];
  };
  return node;
}

function contextMock() {
  return {
    fillRect() {}, fillText() {}, strokeRect() {}, drawImage() {},
    measureText(value) { return { width: String(value).length * 10 }; },
    beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {}
  };
}

function harness(options = {}) {
  const events = {};
  const documentRef = {
    nodes: new Map(), activeElement: null,
    body: element('body', null),
    createElement(tag) {
      if (tag === 'canvas') {
        return {
          width: 0, height: 0,
          getContext() { return options.nullContext ? null : contextMock(); },
          toBlob(callback) { callback(options.nullBlob ? null : new Blob(['png'], { type: 'image/png' })); }
        };
      }
      const created = element(tag, documentRef);
      if (tag === 'a') documentRef.lastLink = created;
      return created;
    },
    getElementById(id) { return this.nodes.get(id) || null; },
    querySelectorAll() { return []; },
    addEventListener(name, handler) { events[name] = handler; }
  };
  documentRef.body = element('body', documentRef);
  documentRef.body.appendChild = function (child) {
    this.children.push(child);
    if (child.id) documentRef.nodes.set(child.id, child);
  };

  const calls = { adapter: [], renderer: [], registration: 0, selected: [], loaded: [], revoked: [], shared: [] };
  class MockImage {
    set src(value) {
      this._src = value;
      calls.loaded.push(value);
      queueMicrotask(() => options.failAssets && options.failAssets.some((part) => value.includes(part))
        ? this.onerror() : this.onload());
    }
    get src() { return this._src; }
  }
  class MockFile extends Blob {
    constructor(parts, name, settings) { super(parts, settings); this.name = name; }
  }
  const runtime = {
    document: documentRef,
    Image: MockImage,
    Blob,
    File: MockFile,
    URL: {
      createObjectURL() { return 'blob:preview-' + (calls.revoked.length + 1); },
      revokeObjectURL(url) { calls.revoked.push(url); }
    },
    navigator: {
      canShare() { return options.canShare !== false; },
      async share(payload) {
        calls.shared.push(payload);
        if (options.shareError) throw options.shareError;
      }
    },
    BudaoInvitationModeB: {
      routeToModeBViewModel(route) {
        calls.adapter.push(route);
        return realModeB.routeToModeBViewModel(route);
      }
    },
    BudaoInvitationShareModeB: {
      selectClosedVariant(key) { calls.selected.push(key); return options.variant || '3'; },
      renderModeBShareArtifact(ctx, viewModel, state, assets) {
        calls.renderer.push({ ctx, viewModel, state, assets });
        return frozenArtifact.renderModeBShareArtifact(ctx, viewModel, state, assets);
      }
    },
    isQrRegistrationOpen() { calls.registration += 1; return options.open !== false; },
    resolveImage(value) { return value; },
    setTimeout() {}
  };
  const engine = createInvitationEngine(runtime);
  const route = {
    id: 'route-1', title: '宽沟环线', country: '中国', city: '北京', region: '怀柔',
    image: 'https://images.example/destination.jpg', qrCode: 'https://images.example/qr.png',
    distance: '5.5千米', duration: '3小时', difficulty: '中等', suitableFor: '亲子',
    surface: '石阶', elevation: '327米', equipmentMinimum: '徒步鞋'
  };
  return { runtime, engine, route, calls, events, documentRef };
}

describe('Phase 2D.3 existing share flow integration', () => {
  it('1. preserves the existing 分享邀请 trigger', () => assert.match(htmlSource, /class="invitation-trigger"[^>]*>分享邀请</));
  it('2. loads Mode B adapter and frozen renderer before the engine', () => {
    assert.ok(htmlSource.indexOf('/invitation-mode-b.js') < htmlSource.indexOf('/invitation-share-mode-b.js'));
    assert.ok(htmlSource.indexOf('/invitation-share-mode-b.js') < htmlSource.indexOf('invitation-engine.js'));
  });
  it('3. normalizes the selected Route and invokes the frozen renderer', async () => {
    const h = harness(); await h.engine.createArtifact(h.route);
    assert.strictEqual(h.calls.adapter.length, 1); assert.strictEqual(h.calls.renderer.length, 1);
  });
  it('4. never passes the raw Route into the renderer', async () => {
    const h = harness(); await h.engine.createArtifact(h.route);
    assert.notStrictEqual(h.calls.renderer[0].viewModel, h.route);
    assert.deepStrictEqual(Object.keys(h.calls.renderer[0].viewModel).sort(),
      ['date','description','key','location','meetingPlace','participation','pills','time','timezone','title','visual']);
  });
  it('5. creates a 1080 × 1530 Canvas', async () => {
    const h = harness(); const result = await h.engine.createArtifact(h.route);
    assert.strictEqual(h.calls.renderer[0].ctx != null, true); assert.strictEqual(result.blob.type, 'image/png');
    assert.match(engineSource, /const cardWidth = 1080/); assert.match(engineSource, /const cardHeight = 1530/);
  });
  it('6. calculates live registration exactly once per generation', async () => {
    const h = harness(); await h.engine.createArtifact(h.route); assert.strictEqual(h.calls.registration, 1);
  });
  it('7. OPEN freezes closedVariant to null', async () => {
    const h = harness(); const result = await h.engine.createArtifact(h.route);
    assert.deepStrictEqual(result.renderState, { registrationOpen: true, closedVariant: null });
  });
  it('8. CLOSED uses the deterministic selector and stable key', async () => {
    const h = harness({ open: false, variant: '5' }); const result = await h.engine.createArtifact(h.route);
    assert.deepStrictEqual(result.renderState, { registrationOpen: false, closedVariant: '5' });
    assert.deepStrictEqual(h.calls.selected, ['route-1']);
  });
  it('9. contains no Math.random in the integrated engine', () => assert.ok(!engineSource.includes('Math.random')));
  it('10. loads the correct deterministic closed stamp', async () => {
    const h = harness({ open: false, variant: '3' }); await h.engine.createArtifact(h.route);
    assert.ok(h.calls.loaded.some((src) => src.includes('budao-dalong-3.png')));
  });
  it('11. loads QR only for OPEN', async () => {
    const open = harness(); await open.engine.createArtifact(open.route);
    const closed = harness({ open: false }); await closed.engine.createArtifact(closed.route);
    assert.ok(open.calls.loaded.includes(open.route.qrCode)); assert.ok(!closed.calls.loaded.includes(closed.route.qrCode));
  });
  it('12. passes null assets to renderer fallbacks without crashing', async () => {
    const h = harness({ failAssets: ['destination', 'qr', 'logo'] });
    await assert.doesNotReject(() => h.engine.createArtifact(h.route));
    assert.strictEqual(h.calls.renderer[0].assets.destinationImage, null);
  });
  it('13. rejects null Canvas context', async () => {
    const h = harness({ nullContext: true }); await assert.rejects(() => h.engine.createArtifact(h.route), /canvas_context_unavailable/);
  });
  it('14. rejects null Blob explicitly', async () => {
    const h = harness({ nullBlob: true }); await assert.rejects(() => h.engine.createArtifact(h.route), /canvas_blob_empty/);
  });
  it('15. replaces and closes preview Object URLs with revocation', async () => {
    const h = harness(); const trigger = { focus() { this.focused = true; } };
    await h.engine.open(h.route, trigger); await h.engine.open(h.route, trigger);
    assert.ok(h.calls.revoked.includes('blob:preview-1'));
    h.engine.close(); assert.ok(h.calls.revoked.length >= 2);
  });
  it('16. ready preview uses the generated Mode B PNG', async () => {
    const h = harness(); await h.engine.open(h.route, { focus() {} });
    const preview = h.documentRef.getElementById('budaoInvitationPreview');
    assert.strictEqual(preview.dataset.state, 'ready');
    assert.strictEqual(preview.parts.frame.children[0].src, 'blob:preview-1');
  });
  it('17. controls are disabled while generating', () => {
    assert.match(engineSource, /setPreviewState\(preview, "generating"[\s\S]*?true\)/);
  });
  it('18. Web Share Files sends a PNG File', async () => {
    const h = harness(); await h.engine.open(h.route, { focus() {} }); await h.engine.share();
    assert.strictEqual(h.calls.shared.length, 1); assert.strictEqual(h.calls.shared[0].files[0].type, 'image/png');
  });
  it('19. share cancellation is handled quietly', async () => {
    const error = new Error('cancel'); error.name = 'AbortError';
    const h = harness({ shareError: error }); await h.engine.open(h.route, { focus() {} }); await h.engine.share();
    assert.match(h.documentRef.getElementById('budaoInvitationPreview').parts.status.textContent, /已取消分享/);
  });
  it('20. unsupported Web Share exposes a real download fallback', async () => {
    const h = harness({ canShare: false }); await h.engine.open(h.route, { focus() {} });
    const preview = h.documentRef.getElementById('budaoInvitationPreview');
    assert.strictEqual(preview.parts.share.hidden, true); assert.strictEqual(preview.parts.download.disabled, false);
    h.engine.download(); assert.strictEqual(h.documentRef.lastLink.clicked, true);
  });
  it('21. Escape closes the dialog', async () => {
    const h = harness(); h.engine.install(); await h.engine.open(h.route, { focus() {} });
    h.events.keydown({ key: 'Escape', preventDefault() {} });
    assert.strictEqual(h.documentRef.getElementById('budaoInvitationPreview').classList.contains('open'), false);
  });
  it('22. focus enters preview and returns to the trigger', async () => {
    const h = harness(); const trigger = { focus() { this.focused = true; } };
    await h.engine.open(h.route, trigger);
    assert.strictEqual(h.documentRef.getElementById('budaoInvitationPreview').parts.close.focused, true);
    h.engine.close(); assert.strictEqual(trigger.focused, true);
  });
  it('23. dialog has modal naming and live status contracts', () => {
    assert.match(engineSource, /role=\"dialog\" aria-modal=\"true\" aria-labelledby=/);
    assert.match(engineSource, /aria-live=\"polite\" aria-atomic=\"true\"/);
  });
  it('24. requires no permanent invitation files', () => {
    assert.ok(!engineSource.includes('invitation.html')); assert.ok(!engineSource.includes('/api/invitation'));
  });
  it('25. frozen renderer remains byte-identical', () => {
    const bytes = fs.readFileSync(require.resolve('../invitation-share-mode-b.js'));
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex'),
      '44fda8cbff84bfaa310c908e7ae8e34b17880a176f1dc34b2e15b5147ef474cf');
  });
  it('26. integrated engine has no Snapshot/API dependency', () => {
    assert.ok(!engineSource.includes('/api/routes')); assert.ok(!engineSource.includes('snapshot'));
  });
});
