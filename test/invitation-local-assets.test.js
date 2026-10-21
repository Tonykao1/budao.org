const assert = require('node:assert/strict');
const test = require('node:test');
const modeB = require('../invitation-mode-b.js');

const photo = '/route-assets/tony/0ad1e3c4d4bd60e798e28522b7393983.jpg';
const qr = '/route-assets/tony/97254cf700c556ab39f375a2582880fc.png';
const raw = 'https://raw.githubusercontent.com/Tonykao1/budao.org/main';

test('Share Invitation keeps local route photo and QR from the public page', () => {
  const view = modeB.routeToModeBViewModel({
    id: 'budao-leader-tony',
    title: '舞彩浅山·枫叶季',
    image: photo,
    qrCode: qr
  });
  assert.equal(view.visual.source, photo);
  assert.equal(view.participation.artifact, qr);
  assert.equal(view.participation.availability, 'qr');
});

test('saved invitation replaces older GitHub Raw route assets with same-origin static assets', () => {
  const view = modeB.snapshotToModeBViewModel({
    id: 'ABCD1234',
    facts: { title: '步道同行' },
    visual: { mode: 'original', source: raw + photo },
    participation: { type: 'legacy_qr', artifact: raw + qr }
  });
  assert.equal(view.visual.source, photo);
  assert.equal(view.participation.artifact, qr);
  assert.equal(view.participation.availability, 'qr');
});

test('share invitation only accepts HTTPS or exact local route asset files', () => {
  for (const bad of [
    'http://example.com/image.jpg',
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    '/api/invitation',
    '//other.example/file.png',
    '/route-assets/tony/../secret.png',
    '/route-assets/tony/f.jpg?evil=1'
  ]) {
    assert.equal(modeB.safeHttpsUrl(bad), '', bad);
  }
  assert.equal(modeB.safeHttpsUrl('https://safe.example/f.jpg'), 'https://safe.example/f.jpg');
  assert.equal(modeB.safeHttpsUrl('route-assets/tony/a.jpg'), '/route-assets/tony/a.jpg');
});
