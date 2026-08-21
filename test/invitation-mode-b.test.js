import assert from 'node:assert';
import { createRequire } from 'node:module';
import { describe, it } from 'node:test';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const modeB = require('../invitation-mode-b.js');

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.className = '';
    this.children = [];
    this.attributes = {};
    this.textContent = '';
  }

  get firstChild() { return this.children[0] || null; }
  appendChild(child) { this.children.push(child); return child; }
  insertBefore(child, before) {
    const index = this.children.indexOf(before);
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener() {}
  remove() {}
}

function fakeDocument() {
  const documentRef = {};
  documentRef.createElement = (tagName) => new FakeElement(tagName, documentRef);
  return documentRef;
}

function hasClass(element, className) {
  if (String(element.className).split(' ').includes(className)) return true;
  return element.children.some((child) => hasClass(child, className));
}

function snapshot(overrides = {}) {
  return {
    id: 'IAUWtpB2Z',
    sourceRoute: { routeId: 'route-1' },
    facts: {
      title: '百望山',
      location: '中国 · 北京 · 海淀',
      date: '2026-08-22',
      time: '09:00',
      timezone: 'Asia/Shanghai',
      duration: '3小时',
      distance: '5.6千米',
      elevation: '250米',
      surface: '铺装路、石阶、土路',
      difficulty: '简单',
      suitableFor: '亲子、长者友好',
      equipmentMinimum: '运动鞋、防晒、雨具',
      meetingPlace: '百望山森林公园东门',
      description: '沿着熟悉的山路，一起安静同行。'
    },
    visual: { mode: 'original', source: 'https://images.example/baiwang.jpg' },
    participation: { type: 'legacy_qr', artifact: 'https://images.example/qr.png' },
    presentation: { collection: 'daily', template: 'journey' },
    revision: 1,
    createdAt: '2026-08-21T00:00:00.000Z',
    createdBy: 'publisher-1',
    ...overrides
  };
}

function route() {
  return {
    routeId: 'route-1',
    title: '百望山',
    country: '中国',
    city: '北京',
    region: '海淀',
    date: '2026-08-22',
    time: '09:00',
    timezone: 'Asia/Shanghai',
    duration: '3小时',
    distance: '5.6千米',
    elevation: '250米',
    surface: '铺装路、石阶、土路',
    difficulty: '简单',
    suitableFor: '亲子、长者友好',
    equipmentMinimum: '运动鞋、防晒、雨具',
    meetingPlace: '百望山森林公园东门',
    description: '沿着熟悉的山路，一起安静同行。',
    image: 'https://images.example/baiwang.jpg',
    qrCode: 'https://images.example/qr.png'
  };
}

describe('Invitation Mode B Phase 2B', () => {
  it('maps immutable Snapshot facts into the Mode B ViewModel', () => {
    const value = modeB.snapshotToModeBViewModel(snapshot());
    assert.strictEqual(value.key, 'IAUWtpB2Z');
    assert.strictEqual(value.title, '百望山');
    assert.strictEqual(value.location, '中国 · 北京 · 海淀');
    assert.strictEqual(value.meetingPlace, '百望山森林公园东门');
    assert.strictEqual(value.visual.source, 'https://images.example/baiwang.jpg');
    assert.strictEqual(value.participation.availability, 'qr');
  });

  it('Route and Snapshot adapters produce equivalent expression data', () => {
    const fromSnapshot = modeB.snapshotToModeBViewModel(snapshot());
    const fromRoute = modeB.routeToModeBViewModel(route());
    assert.deepStrictEqual({ ...fromRoute, key: fromSnapshot.key }, fromSnapshot);
  });

  it('does not mutate Snapshot input', () => {
    const input = snapshot();
    const before = JSON.stringify(input);
    modeB.snapshotToModeBViewModel(input);
    assert.strictEqual(JSON.stringify(input), before);
  });

  it('does not mutate Route input', () => {
    const input = route();
    const before = JSON.stringify(input);
    modeB.routeToModeBViewModel(input);
    assert.strictEqual(JSON.stringify(input), before);
  });

  it('contains no BudaoActiveRoutes access', () => {
    const source = fs.readFileSync(new URL('../invitation-mode-b.js', import.meta.url), 'utf8');
    assert.ok(!source.includes('BudaoActiveRoutes'));
  });

  it('contains no routes API dependency', () => {
    const source = fs.readFileSync(new URL('../invitation-mode-b.js', import.meta.url), 'utf8');
    assert.ok(!source.includes('/api/routes'));
  });

  it('missing optional fields produce a stable ViewModel', () => {
    const value = modeB.snapshotToModeBViewModel({ id: 'EMPTY1', facts: {}, visual: {}, participation: {} });
    assert.strictEqual(value.title, '步道同行');
    assert.strictEqual(value.location, '');
    assert.deepStrictEqual(value.pills, []);
    assert.deepStrictEqual(value.visual, { mode: 'original', source: '' });
  });

  it('participation none produces a static no-participation state', () => {
    const value = modeB.snapshotToModeBViewModel(snapshot({ participation: { type: 'none', artifact: '' } }));
    assert.deepStrictEqual(value.participation, { type: 'none', artifact: '', availability: 'none' });
  });

  it('only permits HTTPS visual and participation artifacts', () => {
    const value = modeB.snapshotToModeBViewModel(snapshot({
      visual: { mode: 'original', source: 'http://unsafe.example/image.jpg' },
      participation: { type: 'legacy_qr', artifact: 'data:image/png;base64,unsafe' }
    }));
    assert.strictEqual(value.visual.source, '');
    assert.deepStrictEqual(value.participation, { type: 'none', artifact: '', availability: 'none' });
    assert.strictEqual(modeB.safeHttpsUrl('https://safe.example/image.jpg'), 'https://safe.example/image.jpg');
  });

  it('repeated Snapshot conversion is deterministic', () => {
    const input = snapshot();
    assert.deepStrictEqual(
      modeB.snapshotToModeBViewModel(input),
      modeB.snapshotToModeBViewModel(input)
    );
  });

  it('renders the semantic Mode B postcard regions without Canvas', () => {
    const documentRef = fakeDocument();
    const container = new FakeElement('div', documentRef);
    const viewModel = modeB.snapshotToModeBViewModel(snapshot());
    modeB.renderModeB(container, viewModel);
    const card = container.firstChild;

    assert.ok(card);
    ['mode-b-heading', 'mode-b-stamp', 'mode-b-letter', 'mode-b-meeting',
      'mode-b-pills', 'mode-b-participation', 'mode-b-footer']
      .forEach((className) => assert.ok(hasClass(card, className), className));
    assert.ok(!fs.readFileSync(new URL('../invitation-mode-b.js', import.meta.url), 'utf8').includes('canvas'));
  });
});
