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
  assert.equal(node.nodeValue, '· EMBRACE · TRAIL · STORY · SCRIPTURE · ');
  assert.equal(el.children[0],button);
  assert.equal(button.textContent,'一起祷告');
});

test('only approved selectors are handled; no broad text-node walker', () => {
  assert.ok(homepage.entries.length >= 10);
  assert.ok(homepage.entries.every(e=>e.selector && e.source && e.values.en && e.values['zh-Hant']));
  assert.ok(homepage.entries.every(e=> !e.selector.includes('script') && !e.selector.includes('hero-line')));
});
test('translated brand entries must use uppercase BUDAO in every target language', () => {
  const brandEntries = homepage.entries.filter(entry => entry.source.includes('步道'));
  assert.ok(brandEntries.length >= 5, 'branded navigation, heading, title and footer are included');
  for (const entry of brandEntries) {
    assert.match(entry.values.en, /BUDAO/, entry.selector);
    assert.match(entry.values['zh-Hant'], /BUDAO/, entry.selector);
    assert.doesNotMatch(entry.values.en, /(?:Trails?|Budao)/, entry.selector);
  }
  const navBrand = homepage.entries.find(entry => entry.selector === 'nav a[href="/test.html"]');
  assert.equal(navBrand.values.en, 'BUDAO');
  assert.equal(navBrand.values['zh-Hant'], 'BUDAO');
});

test('English typography uses English punctuation and questions', () => {
  const forbiddenCjkPunctuation = /[，。！？「」『』（）【】]/;
  for (const entry of homepage.entries) {
    assert.doesNotMatch(entry.values.en, forbiddenCjkPunctuation, entry.selector);
    if (entry.source.trim().endsWith('？')) assert.ok(entry.values.en.endsWith('?'), entry.selector);
  }
  const why = homepage.entries.find(entry => entry.source.startsWith('为什么是'));
  assert.equal(why.values.en, 'Why BUDAO?');
  assert.equal(why.values['zh-Hant'], '為什麼是 BUDAO？');
});

test('all six navigation choices have explicit, distinct provisional translations', () => {
  const nav = homepage.entries.filter(entry => entry.selector.startsWith('nav a[href='));
  assert.equal(nav.length, 6);
  const labels = nav.map(entry => entry.values.en);
  assert.equal(new Set(labels).size, 6);
  assert.deepEqual(labels, ['Home','BUDAO','Young Explorers','Companions','Fellow Workers','Pasture']);
});

test('faith declaration is editorial-only until its interactive layout is reviewed', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const charter = fs.readFileSync(path.join(__dirname,'../docs/2026-11-09-global-translation-charter.md'),'utf8');
  assert.match(charter,/Till our final day, we shall walk in His way;/);
  assert.match(charter,/Neither left nor right shall we stray/);
  assert.match(charter,/Owner-approved English wording/);
  assert.match(charter,/COPY APPROVED — RELEASE PENDING VISUAL QA/);
  assert.equal(homepage.entries.find(entry => entry.source === '同工').values.en, 'Fellow Workers');
  assert.match(charter,/BLOCKED FOR VISUAL\/INTERACTION REVIEW/);
  assert.ok(homepage.entries.every(entry => !entry.selector.includes('hero-line')));
});


test('localized accessibility attributes are source-guarded and leave all visual attributes untouched', () => {
  const attributes = { 'aria-label': '关闭', class: 'prayer-box-close', style: 'color:inherit' };
  const el = {
    getAttribute: key => attributes[key],
    setAttribute: (key,value) => { attributes[key] = value; },
    children: [],
    textContent: '×'
  };
  const doc = {
    querySelector: selector => selector === '.prayer-box-close' ? el : null,
    documentElement: { lang: 'zh' }
  };
  const entry = homepage.entries.find(x => x.selector === '.prayer-box-close');
  assert.equal(core.localize(doc,'en',[entry]).changed,1);
  assert.equal(attributes['aria-label'],'Close');
  assert.equal(attributes.class,'prayer-box-close');
  assert.equal(attributes.style,'color:inherit');
  const unsafe = { selector:'.prayer-box-close',mode:'attribute',attribute:'style',source:'color:inherit',values:{en:'display:none'} };
  assert.equal(core.localize(doc,'en',[unsafe]).changed,0);
  assert.equal(attributes.style,'color:inherit');
});

test('private-prayer dialog has source-guarded English and traditional Chinese for visible copy', () => {
  const entries = homepage.entries;
  for (const source of [
    '有什么想让我们陪你一起记念？',
    '代祷事项',
    '仅由步道带领人阅读和代祷',
    '同意带领人邀请受托同工一起代祷',
    '希望带领人私下回应我',
    '你的内容不会公开。',
    '我们会谨慎承接，只用于代祷与必要的关怀。',
    '提交祷告',
    '已经收到了。',
    '会有一位步道带领人安静地承接这份祷告。愿你在前面的路上，得着平安与同行。'
  ]) {
    const item = entries.find(e => e.source === source);
    assert.ok(item, 'missing '+source);
    assert.ok(item.values.en && item.values['zh-Hant']);
  }
  assert.equal(entries.filter(e => e.selector === '.prayer-box-privacy').length,2);
  assert.ok(entries.every(e => !e.selector.includes('.prayer-box-honeypot')));
});

test('dynamic prayer feedback uses the same locale; Chinese is the default', () => {
  assert.equal(homepage.runtimeCopy('正在送达…','en'),'Sending…');
  assert.equal(homepage.runtimeCopy('暂时没有送达，请稍后再试。','en'),
    'Your request could not be sent. Please try again later.');
  assert.equal(homepage.runtimeCopy('要放下尚未送出的内容吗？','zh-Hant'),
    '要放下尚未送出的內容嗎？');
  assert.equal(homepage.runtimeCopy('提交祷告','zh-Hans'),'提交祷告');
  assert.equal(homepage.runtimeCopy('提交祷告','ja'),'提交祷告');
});

test('localization cannot change private prayer consent or API body', () => {
  const prayer = require('../prayer-box.js');
  const payload = prayer.buildPrayerPayload({
    body: '请为我代祷',
    visibility: 'TRUSTED_TEAM',
    wantsReply: false,
    contact: 'do-not-share@example.test',
    website: ''
  },'source-key');
  assert.equal(payload.body,'请为我代祷');
  assert.equal(payload.visibility,'TRUSTED_TEAM');
  assert.equal(payload.wantsReply,false);
  assert.equal(payload.contact,'');
  assert.equal(payload.idempotencyKey,'source-key');
});

test('prayer submission failures are translated only for an opted-in homepage locale', async () => {
  const prayer = require('../prayer-box.js');
  const previous = globalThis.location;
  globalThis.location = { pathname:'/home.html',search:'?lang=en' };
  let errorText = '';
  try {
    const controller = prayer.createSubmitController({
      fetchImpl: async () => ({ok:false,json:async () => ({ok:false})}),
      setBusy() {},
      showSuccess() { throw Error('unexpected success'); },
      showError(text) { errorText = text; }
    });
    assert.deepEqual(await controller.submit({body:'test'},'test-id'),{ok:false});
    assert.equal(errorText,'Your request could not be sent. Please try again later.');
  } finally {
    if (previous === undefined) delete globalThis.location;
    else globalThis.location = previous;
  }
});


test('homepage five elements are parallel uppercase nouns without articles', () => {
  const leading = homepage.entries.find(e => e.selector === 'main section:nth-of-type(3) p');
  const prayer = homepage.entries.find(e => e.selector === '#prayerBoxTrigger');
  assert.ok(leading && prayer);
  const words = leading.values.en.split('·').map(v => v.trim()).filter(Boolean);
  words.push(prayer.values.en);
  assert.deepEqual(words, ['EMBRACE', 'TRAIL', 'STORY', 'SCRIPTURE', 'PRAYER']);
  assert.equal(words.length, 5);
  assert.ok(words.every(word => /^[A-Z]+$/.test(word)));
  assert.equal(leading.values['zh-Hant'], '· 一個擁抱 · 一條線路 · 一則故事 · 一段經文 · ');
  assert.equal(prayer.values['zh-Hant'], '一起禱告');
});

test('five elements still use existing source text and existing prayer button', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'home.html'), 'utf8');
  assert.match(html, /· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 · <button id="prayerBoxTrigger"/);
  assert.match(html, /class="prayer-box-trigger" type="button" aria-controls="prayerBox"/);
  const cta = homepage.entries.find(e=>e.selector==='#prayerBoxTrigger');
  assert.equal(cta.values.en,'PRAYER');
});

function buildMockOriginalCreed(overrides = {}) {
  const line = { childNodes: [], style: {}, insertBefore(node, target) {
    const index = this.childNodes.indexOf(target);
    if (index < 0) throw Error('invalid insertion target');
    node.parentElement = this;
    this.childNodes.splice(index, 0, node);
  }};
  Object.defineProperty(line, 'textContent', {
    get() { return this.childNodes.map(node => node.nodeType === 3 ? node.nodeValue : node.textContent).join(''); }
  });
  function span(id, text) {
    const item = { nodeType:1, id, parentElement:line, textContent:text, className:'original-control', style:{}, onClick:() => id };
    Object.defineProperty(item,'nextSibling',{get(){return line.childNodes[line.childNodes.indexOf(item) + 1] || null;}});
    return item;
  }
  const text = value => ({nodeType:3, nodeValue:value, parentElement:line});
  const dsp = span('dspBtn', overrides.dsp || '余');
  const play = span('playBtn', '走');
  const prev = span('prevBtn', '左');
  const next = span('nextBtn', '右');
  line.childNodes.push(
    text('\n    '), dsp, text('生行'), play, text('，\n    不偏'), prev, next, text('\n  ')
  );
  const byId = {dspBtn:dsp,playBtn:play,prevBtn:prev,nextBtn:next};
  return {
    doc: {
      querySelector: key => key === 'header .hero-line' ? line : null,
      getElementById: key => byId[key],
      createTextNode: value => text(value)
    },
    line, controls:byId
  };
}

test('approved English creed appears using original four audio controls, no CSS or element changes', () => {
  const {doc,line,controls} = buildMockOriginalCreed();
  const originalControls = Object.values(controls);
  const handlerRefs = originalControls.map(c=>c.onClick);
  const childCount = line.childNodes.length;
  assert.equal(homepage.previewEnglishCreed(doc,'en'),true);
  assert.equal(line.textContent.replace(/\s+/g,' ').trim(),
    'Till our final day, we shall walk in His way; Neither left nor right shall we stray.');
  assert.equal(line.childNodes.length, childCount+1); // the single textual " nor " separator
  assert.deepEqual(line.childNodes.filter(n=>n.nodeType===1),originalControls);
  assert.deepEqual(originalControls.map(c=>c.onClick),handlerRefs);
  assert.ok(originalControls.every(c=>c.className==='original-control' && Object.keys(c.style).length===0));
  assert.deepEqual(originalControls.map(c=>c.textContent),['Till','walk','left','right']);
  assert.equal(line.style.fontSize,'clamp(12px, 1.35vw, 16px)');
  assert.equal(line.style.letterSpacing,'0.01em');
  assert.equal(line.style.whiteSpace,'pre-line');
  assert.match(line.textContent,/His way;\nNeither left nor right/);
  assert.equal(line.childNodes[0].nodeValue,'');
  assert.equal(homepage.previewEnglishCreed(doc,'en'),false); // never apply twice
});

test('English creed translation is opt-in and guarded by the unchanged approved Chinese source', () => {
  const source = buildMockOriginalCreed();
  assert.equal(homepage.previewEnglishCreed(source.doc,'zh-Hans'),false);
  assert.equal(homepage.previewEnglishCreed(source.doc,'zh-Hant'),false);
  assert.match(source.line.textContent,/余生行走/);
  assert.deepEqual(source.line.style,{});
  assert.equal(source.line.childNodes[0].nodeValue,'\n    ');
  const drifted = buildMockOriginalCreed({dsp:'另'});
  const original = drifted.line.textContent;
  assert.equal(homepage.previewEnglishCreed(drifted.doc,'en'),false);
  assert.equal(drifted.line.textContent,original);
});

test('creed follows owner-approved punctuation and all original music IDs remain in original html', () => {
  assert.equal(homepage.approvedEnglishCreed,
    'Till our final day, we shall walk in His way; Neither left nor right shall we stray.');
  const fs = require('node:fs');
  const path = require('node:path');
  const original = fs.readFileSync(path.join(__dirname,'../home.html'),'utf8');
  assert.match(original,/<span id="dspBtn"[^>]+>余<\/span>生行<span id="playBtn">走<\/span>/);
  assert.match(original,/不偏<span id="prevBtn">左<\/span><span id="nextBtn">右<\/span>/);
});

test('English creed compact typography never changes global style.css or Chinese markup', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname,'../home.html'),'utf8');
  assert.doesNotMatch(source, /global-english-creed|font-size:clamp\(12px/);
  assert.match(source, /<p class="hero-line">/);
  const original = buildMockOriginalCreed();
  assert.equal(homepage.previewEnglishCreed(original.doc,'zh-Hans'),false);
  assert.deepEqual(original.line.style,{});
});


test('approved footer English names preserve the original decorative symbols', () => {
  const campfire = homepage.entries.find(e => e.selector === 'footer .campfire-link:not(.spark-link)');
  const sparks = homepage.entries.find(e => e.selector === 'footer .campfire-link.spark-link');
  assert.ok(campfire && sparks);
  assert.equal(campfire.source, '✦ 营火之地');
  assert.equal(campfire.values.en, '✦ Campfire');
  assert.equal(campfire.values['zh-Hant'], '✦ 營火之地');
  assert.equal(sparks.source, '❦ 路上星火');
  assert.equal(sparks.values.en, '❦ Sparks');
  assert.equal(sparks.values['zh-Hant'], '❦ 路上星火');
});

test('footer translation changes text only, never URLs, CSS classes or animation hooks', () => {
  function node(text, href, className) {
    return {textContent:text, href, className, children:[]};
  }
  const campfire = node('✦ 营火之地','/yhzd.html','campfire-link');
  const sparks = node('❦ 路上星火','/lsxh.html','campfire-link spark-link');
  const targets = {
    'footer .campfire-link:not(.spark-link)':campfire,
    'footer .campfire-link.spark-link':sparks
  };
  const doc = {
    querySelector:selector=>targets[selector] || null,
    documentElement:{lang:'zh'}
  };
  const entries = homepage.entries.filter(e=>Object.hasOwn(targets,e.selector));
  const result = core.localize(doc,'en',entries);
  assert.equal(result.changed,2);
  assert.deepEqual([campfire.textContent,sparks.textContent],['✦ Campfire','❦ Sparks']);
  assert.deepEqual([campfire.href,sparks.href],['/yhzd.html','/lsxh.html']);
  assert.deepEqual([campfire.className,sparks.className],['campfire-link','campfire-link spark-link']);
  const source = require('node:fs').readFileSync(require('node:path').join(__dirname,'../home.html'),'utf8');
  assert.match(source,/<a class="campfire-link" href="\/yhzd.html">✦ 营火之地<\/a>/);
  assert.match(source,/<a class="campfire-link spark-link" href="\/lsxh.html">❦ 路上星火<\/a>/);
});



test('beta carries language only on English homepage, never on unlocalized pages', () => {
  const links = ['/home.html','/test.html','/tongdao.html','/yhzd.html',
    '/home.html?ref=campfire#top','https://example.org/home.html','mailto:hello@budao.org']
    .map(href=>({href,
      getAttribute(name){return name==='href'?this.href:null;},
      setAttribute(name,value){assert.equal(name,'href');this.href=value;}
    }));
  const document={querySelectorAll:selector=>selector==='a[href]'?links:[]};
  assert.deepEqual(core.carryLocaleOnLinks(document,'en',['/home.html']),{changed:2});
  assert.deepEqual(links.map(x=>x.href),[
    '/home.html?lang=en','/test.html','/tongdao.html','/yhzd.html',
    '/home.html?ref=campfire&lang=en#top','https://example.org/home.html','mailto:hello@budao.org'
  ]);
  assert.deepEqual(core.carryLocaleOnLinks(document,'en',['/home.html']),{changed:0});
  assert.deepEqual(core.carryLocaleOnLinks(document,'zh-Hans',['/home.html']),{changed:0});
});

test('English homepage beta loads only optional scripts on main HTML body unchanged', () => {
  const fs=require('node:fs'),path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../home.html'),'utf8');
  assert.match(html,/<script src="\/global\/i18n-core\.js" defer><\/script>/);
  assert.match(html,/<script src="\/global\/home-i18n\.js" defer><\/script>/);
  assert.match(html,/href="\/test\.html">步道<\/a>/);
  assert.match(html,/<span id="dspBtn"[^>]+>余<\/span>生行<span id="playBtn">走<\/span>/);
  assert.doesNotMatch(html,/global\/core-page-i18n\.js/);
});

test('English homepage beta preserves protected prayer payload and permissions', () => {
  const fs=require('node:fs'),path=require('node:path');
  const code=fs.readFileSync(path.join(__dirname,'../prayer-box.js'),'utf8');
  assert.match(code,/function buildPrayerPayload/);
  assert.match(code,/visibility: values\.visibility === "TRUSTED_TEAM" \? "TRUSTED_TEAM" : "LEADERS_ONLY"/);
  assert.match(code,/function localizedCopy/);
  assert.doesNotMatch(code,/fetch\([^)]*translate/i);
});
