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
    this.classList = {
      add: (...classNames) => {
        const names = new Set(String(this.className).split(' ').filter(Boolean));
        classNames.forEach((className) => names.add(className));
        this.className = Array.from(names).join(' ');
      }
    };
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

function findByClass(element, className) {
  if (String(element.className).split(' ').includes(className)) return element;
  for (const child of element.children) {
    const match = findByClass(child, className);
    if (match) return match;
  }
  return null;
}

function findAll(element, predicate) {
  const matches = predicate(element) ? [element] : [];
  return element.children.reduce((items, child) => items.concat(findAll(child, predicate)), matches);
}

function directClassIndex(element, className) {
  return element.children.findIndex((child) => String(child.className).split(' ').includes(className));
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

  it('does not mutate the ViewModel while rendering', () => {
    const documentRef = fakeDocument();
    const container = new FakeElement('div', documentRef);
    const viewModel = modeB.snapshotToModeBViewModel(snapshot());
    const before = JSON.stringify(viewModel);
    modeB.renderModeB(container, viewModel);
    assert.strictEqual(JSON.stringify(viewModel), before);
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

  it('renders the full invitation regions in semantic reading order without Canvas', () => {
    const documentRef = fakeDocument();
    const container = new FakeElement('div', documentRef);
    const viewModel = modeB.snapshotToModeBViewModel(snapshot());
    modeB.renderModeB(container, viewModel);
    const card = container.firstChild;

    assert.ok(card);
    ['mode-b-heading', 'mode-b-destination', 'mode-b-intent', 'mode-b-meeting',
      'mode-b-letter', 'mode-b-facts', 'mode-b-primary-facts',
      'mode-b-secondary-details', 'mode-b-participation', 'mode-b-footer']
      .forEach((className) => assert.ok(hasClass(card, className), className));

    const destinationIndex = directClassIndex(card, 'mode-b-destination');
    const intentIndex = directClassIndex(card, 'mode-b-intent');
    const meetingIndex = directClassIndex(card, 'mode-b-meeting');
    const letterIndex = directClassIndex(card, 'mode-b-letter');
    const factsIndex = directClassIndex(card, 'mode-b-facts');
    const participationIndex = directClassIndex(card, 'mode-b-participation');
    assert.ok(destinationIndex < intentIndex);
    assert.ok(intentIndex < meetingIndex);
    assert.ok(meetingIndex < letterIndex);
    assert.ok(letterIndex < factsIndex);
    assert.ok(factsIndex < participationIndex);
    assert.ok(!fs.readFileSync(new URL('../invitation-mode-b.js', import.meta.url), 'utf8').includes('canvas'));
  });

  it('renders one meaningful primary destination image', () => {
    const documentRef = fakeDocument();
    const container = new FakeElement('div', documentRef);
    modeB.renderModeB(container, modeB.snapshotToModeBViewModel(snapshot()));
    const destination = findByClass(container.firstChild, 'mode-b-destination');
    const images = findAll(destination, (element) => element.tagName === 'img');

    assert.strictEqual(images.length, 1);
    assert.strictEqual(images[0].alt, '百望山 目的地影像');
    assert.strictEqual(images[0].src, 'https://images.example/baiwang.jpg');
  });

  it('uses semantic definition lists for primary and secondary facts', () => {
    const documentRef = fakeDocument();
    const container = new FakeElement('div', documentRef);
    modeB.renderModeB(container, modeB.snapshotToModeBViewModel(snapshot()));
    const card = container.firstChild;
    const primary = findByClass(card, 'mode-b-primary-facts');
    const secondary = findByClass(card, 'mode-b-secondary-details');

    assert.strictEqual(primary.tagName, 'dl');
    assert.strictEqual(secondary.tagName, 'dl');
    assert.strictEqual(findAll(primary, (element) => element.tagName === 'dt').length, 4);
    assert.strictEqual(findAll(primary, (element) => element.tagName === 'dd').length, 4);
    assert.ok(findAll(secondary, (element) => element.tagName === 'dt').length > 0);
    assert.ok(!hasClass(card, 'mode-b-pills'));
  });

  it('keeps QR and no-participation states structurally composed', () => {
    const documentRef = fakeDocument();
    const qrContainer = new FakeElement('div', documentRef);
    const noneContainer = new FakeElement('div', documentRef);
    modeB.renderModeB(qrContainer, modeB.snapshotToModeBViewModel(snapshot()));
    modeB.renderModeB(noneContainer, modeB.snapshotToModeBViewModel(snapshot({
      participation: { type: 'none', artifact: '' }
    })));

    const qrParticipation = findByClass(qrContainer.firstChild, 'mode-b-participation');
    const noneParticipation = findByClass(noneContainer.firstChild, 'mode-b-participation');
    const qrSeal = findByClass(qrParticipation, 'mode-b-qr');
    const noneSeal = findByClass(noneParticipation, 'mode-b-qr');
    assert.ok(qrSeal);
    assert.ok(noneSeal);
    assert.strictEqual(findAll(qrSeal, (element) => element.tagName === 'img').length, 1);
    assert.strictEqual(findAll(noneSeal, (element) => element.tagName === 'img').length, 0);
    assert.ok(String(noneSeal.className).includes('is-empty'));
  });
});
