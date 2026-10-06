const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'yhzd.html'), 'utf8');
const cssPath = path.join(root, 'yhzd-editorial.css');
const css = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';

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

test('V7 editorial skeleton keeps media and quotes readable', () => {
  assert.match(html, /<h1>萤火之地<\/h1>/);
  assert.match(html, /有些话，<br>只有走过的人才会说出来。/);
  assert.equal((html.match(/class="editorial-media"/g) || []).length, 5);
  assert.equal((html.match(/class="editorial-quote"/g) || []).length, 5);
  assert.match(html, /data-scene="primary"/);
  assert.match(html, /data-scene="reverse"/);
  assert.match(css, /\.yhzd-hero\s*\{/);
  assert.match(css, /\.editorial-scene\s*\{/);
  assert.match(css, /\.editorial-media img\s*\{[^}]*height:\s*auto/s);
  assert.match(css, /@media\s*\(max-width:\s*980px\)/);
  assert.doesNotMatch(css, /object-fit:\s*cover/);
});

const editorial = require('../yhzd-editorial.js');

test('selectFresh prioritizes unseen items and avoids exclusions', () => {
  const items = ['a','b','c','d'].map(id => ({ id }));
  assert.deepEqual(editorial.selectFresh(items, 3, ['a'], x => x.id).map(x => x.id), ['b','c','d']);
  assert.deepEqual(editorial.selectFresh(items, 2, [], x => x.id, ['a','b']).map(x => x.id), ['c','d']);
});

test('selectImages respects orientation preferences without duplicates', () => {
  const pool = [
    { id:'a', orientation:'landscape' },
    { id:'b', orientation:'landscape' },
    { id:'c', orientation:'landscape' },
    { id:'d', orientation:'portrait' }
  ];
  const picked = editorial.selectImages(pool, ['landscape','portrait','landscape'], []);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked.map(x => x.id)).size, 3);
  assert.equal(picked[1].orientation, 'portrait');
});

test('selectMessages returns complete text that fits scene caps when available', () => {
  const messages = ['短句','这是一个十四字以内的句子','这是一条长度适中的完整同行文字','这是一条明显更长但仍然完整保留不会被截断的同行者原话'];
  const caps = [4,14,44];
  const picked = editorial.selectMessages(messages, caps, []);
  assert.equal(picked.length, 3);
  assert.ok(picked.every((m,i) => m.length <= caps[i]));
  assert.ok(picked.every(m => messages.includes(m)));
});

test('history helpers survive broken storage and keep only the most recent 24 unique items', () => {
  const brokenStorage = { getItem(){ throw new Error('blocked'); }, setItem(){ throw new Error('blocked'); } };
  assert.deepEqual(editorial.safeReadHistory(brokenStorage, 'x'), []);
  assert.doesNotThrow(() => editorial.safeRemember(brokenStorage, 'x', 'a'));

  const store = new Map();
  const storage = {
    getItem(key){ return store.has(key) ? store.get(key) : null; },
    setItem(key,value){ store.set(key,value); }
  };
  for (let i=0;i<26;i++) editorial.safeRemember(storage, 'x', String(i));
  editorial.safeRemember(storage, 'x', '25');
  const history = editorial.safeReadHistory(storage, 'x');
  assert.equal(history.length, 24);
  assert.equal(history.at(-1), '25');
  assert.equal(history.filter(x => x === '25').length, 1);
});
