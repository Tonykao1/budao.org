const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'yhzd.html'), 'utf8');

function heroMarkup(source) {
  return source.match(/<section\b[^>]*class="yhzd-hero"[^>]*>([\s\S]*?)<\/section>/i)?.[1] || '';
}

test('V7 page uses a fixed editorial structure and correct name', () => {
  assert.match(html, /<title>萤火之地 \| 步道<\/title>/);
  assert.match(html, /class="yhzd-hero"/);
  assert.match(html, /class="editorial-scene editorial-scene--primary"/);
  assert.equal((html.match(/class="editorial-scene/g) || []).length, 5);
  assert.doesNotMatch(html, /memory-world|image-slot-|message-\d|memory-viewport/);
  assert.doesNotMatch(html, /营火之地/);
  assert.match(html, /yhzd-editorial\.css/);
  assert.match(html, /yhzd-editorial\.js/);
});

test('V7 hero is a quiet title-only field', () => {
  const hero = heroMarkup(html);
  assert.match(hero, /路上星火/);
  assert.match(hero, /萤火之地/);
  assert.match(hero, /有些话，<br>只有走过的人才会说出来。/);
  assert.doesNotMatch(hero, /editorial-media|editorial-quote|data-message|data-image/);
});

test('mobile rules do not hide editorial photos', () => {
  const inlineCss = html.match(/<style>([\s\S]*?)<\/style>/i)?.[1] || '';
  assert.doesNotMatch(inlineCss, /\.editorial-media\s*\{[^}]*display\s*:\s*none/s);
});
