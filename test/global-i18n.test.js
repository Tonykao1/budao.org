const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../global/i18n-core');
const homepage = require('../global/home-i18n');

test('normalizes supported languages; unknown language stays on Chinese', () => {
  assert.equal(core.normalizeLocale('ZH_tw'), 'zh-Hant');
  assert.equal(core.normalizeLocale('en-GB'), 'en');
  assert.equal(core.normalizeLocale('ja'), null);
  assert.equal(core.requestedLocale('?lang=ja'), 'zh-Hans');
  assert.equal(core.requestedLocale(''), 'zh-Hans');
  assert.equal(core.requestedLocale('?lang=en'), 'en');
});

test('does not touch API, immutable invitation or unlisted URLs', () => {
  for (const path of ['/i/a-123', '/api/routes', '/invitation.html', '/contact.html', '//example.com']) {
    assert.equal(core.safePage(path), false);
    assert.equal(core.languageLink(path, '', '', 'en'), null);
  }
  assert.equal(core.languageLink('/home.html', '?x=2', '#top', 'en'), '/home.html?x=2&lang=en#top');
  assert.equal(core.languageLink('/home.html', '?lang=en', '', 'zh-Hans'), '/home.html');
});

test('Chinese default is a no-op and preserves the document exactly', () => {
  const doc = { querySelector() { throw Error('must not be called'); }, documentElement: {lang:'zh'} };
  assert.deepEqual(core.localize(doc, 'zh-Hans', homepage.entries), {changed:0,skipped:0});
  assert.equal(doc.documentElement.lang, 'zh');
});

test('changing an existing plain text node preserves classes and links', () => {
  const el = { children: [], textContent:'首页', href:'/home.html', className:'existing-class' };
  const doc = { querySelector(q) { return q === 'nav a[href="/home.html"]' ? el : null; }, documentElement:{lang:'zh'} };
  const result = core.localize(doc,'en',homepage.entries);
  assert.equal(el.textContent,'Home');
  assert.equal(el.href,'/home.html');
  assert.equal(el.className,'existing-class');
  assert.equal(doc.documentElement.lang,'en');
  assert.equal(result.changed,1);
});

test('never overwrites interactive descendants or drifted original copy', () => {
  const withButton = {children:[{}],textContent:'一起祷告'};
  const stale = {children:[],textContent:'另一个页面'};
  const doc = { querySelector(q) { return q === '#prayerBoxTrigger' ? withButton : stale; },documentElement:{lang:'zh'} };
  const result = core.localize(doc,'en',homepage.entries);
  assert.equal(result.changed,0);
  assert.equal(withButton.textContent,'一起祷告');
  assert.equal(stale.textContent,'另一个页面');
  assert.equal(doc.documentElement.lang,'zh');
});

test('mixed content translation touches only existing leading text node', () => {
  const node = {nodeType:3,nodeValue:'· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 · '};
  const button = {nodeType:1,textContent:'一起祷告',id:'prayerBoxTrigger'};
  const el = {children:[button],childNodes:[node,button],textContent:'dummy'};
  const item = homepage.entries.find(e=>e.mode==='leading-text');
  const doc = {querySelector:q=>q===item.selector?el:null,documentElement:{lang:'zh'}};
  assert.equal(core.localize(doc,'en',[item]).changed,1);
  assert.match(node.nodeValue,/An embrace/);
  assert.equal(el.children[0],button);
  assert.equal(button.textContent,'一起祷告');
});

test('only approved selectors are handled; no broad text-node walker', () => {
  assert.ok(homepage.entries.length >= 10);
  assert.ok(homepage.entries.every(e=>e.selector && e.source && e.values.en && e.values['zh-Hant']));
  assert.ok(homepage.entries.every(e=> !e.selector.includes('script') && !e.selector.includes('footer')));
});