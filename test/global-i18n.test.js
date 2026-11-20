const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../global/i18n-core');
const homepage = require('../global/home-i18n');

test('normalizes supported languages; unknown language stays on Chinese', () => {
  assert.equal(core.normalizeLocale('ZH_tw'), 'zh-Hant');
  assert.equal(core.normalizeLocale('en-GB'), 'en');
  assert.equal(core.normalizeLocale('ja'), 'ja');
  assert.equal(core.normalizeLocale('ja-JP'), 'ja');
  assert.equal(core.normalizeLocale('ko'), 'ko');
  assert.equal(core.normalizeLocale('ko-KR'), 'ko');
  assert.equal(core.normalizeLocale('es'), 'es');
  assert.equal(core.normalizeLocale('es-ES'), 'es');
  assert.equal(core.normalizeLocale('es-MX'), 'es');
  assert.equal(core.normalizeLocale('fr'), null);
  assert.equal(core.requestedLocale('?lang=ja'), 'ja');
  assert.equal(core.requestedLocale('?lang=ko'), 'ko');
  assert.equal(core.requestedLocale('?lang=es'), 'es');
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
  assert.equal(node.nodeValue, '· ONE EMBRACE · ONE ROUTE · ONE STORY · ONE SCRIPTURE PASSAGE · ');
  assert.equal(el.children[0],button);
  assert.equal(button.textContent,'一起祷告');
});

test('only approved selectors are handled; no broad text-node walker', () => {
  assert.ok(homepage.entries.length >= 10);
  assert.ok(homepage.entries.every(e=>e.selector && e.source && e.values.en && e.values['zh-Hant']));
  assert.ok(homepage.entries.every(e=> !e.selector.includes('script') && !e.selector.includes('hero-line')));
});
test('English uses BUDAO; Traditional Chinese keeps the original 步道 brand', () => {
  const brandEntries = homepage.entries.filter(entry => entry.source.includes('步道'));
  assert.ok(brandEntries.length >= 5, 'branded navigation, heading, title and footer are included');
  for (const entry of brandEntries) {
    assert.match(entry.values.en, /BUDAO/, entry.selector);
    assert.doesNotMatch(entry.values.en, /(?:Trails?|Budao)/, entry.selector);
    assert.doesNotMatch(entry.values['zh-Hant'], /BUDAO/, entry.selector);
  }
  const navBrand = homepage.entries.find(entry => entry.selector === 'nav a[href="/test.html"]');
  const heading = homepage.entries.find(entry => entry.selector === 'header > h1');
  const title = homepage.entries.find(entry => entry.selector === 'title');
  for (const entry of [navBrand, heading, title]) {
    assert.equal(entry.values.en, 'BUDAO');
    assert.equal(entry.values['zh-Hant'], '步道');
  }
});

test('English typography uses English punctuation and questions', () => {
  const forbiddenCjkPunctuation = /[，。！？「」『』（）【】]/;
  for (const entry of homepage.entries) {
    assert.doesNotMatch(entry.values.en, forbiddenCjkPunctuation, entry.selector);
    if (entry.source.trim().endsWith('？')) assert.ok(entry.values.en.endsWith('?'), entry.selector);
  }
  const why = homepage.entries.find(entry => entry.source.startsWith('为什么是'));
  assert.equal(why.values.en, 'Why BUDAO?');
  assert.equal(why.values['zh-Hant'], '為什麼是「步道」？');
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
  assert.equal(homepage.runtimeCopy('提交祷告','ja'),'祈りを送信');
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


test('the six-language five ones preserve four concrete gifts plus praying together', () => {
  const leading=homepage.entries.find(e=>e.selector==='main section:nth-of-type(3) p');
  const prayer=homepage.entries.find(e=>e.selector==='#prayerBoxTrigger');
  const expected={
    en:['ONE EMBRACE','ONE ROUTE','ONE STORY','ONE SCRIPTURE PASSAGE','PRAY TOGETHER'],
    'zh-Hant':['一個擁抱','一條線路','一則故事','一段經文','一起禱告'],
    ja:['ひとつの抱擁','ひとつのコース','ひとつの物語','聖書の一箇所','ともに祈る'],
    es:['UN ABRAZO','UNA RUTA','UNA HISTORIA','UN PASAJE BÍBLICO','OREMOS JUNTOS'],
    ko:['한 번의 포옹','하나의 걷기 코스','하나의 이야기','한 대목의 성경 말씀','함께 기도해요']
  };
  assert.equal(leading.source,'· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 ·');
  assert.equal(prayer.source,'一起祷告');
  for(const [language,items] of Object.entries(expected)){
    const words=leading.values[language].split('·').map(v=>v.trim()).filter(Boolean);
    words.push(prayer.values[language]);
    assert.deepEqual(words,items,language);
    assert.equal(words.length,5,language);
  }
  assert.doesNotMatch(leading.values.en,/TRAIL/);
  assert.doesNotMatch(leading.values.es,/SENDERO|ESCRITURA/);
  assert.ok(prayer.values.en.includes('TOGETHER'));
  assert.ok(prayer.values.es.includes('JUNTOS'));
  assert.ok(prayer.values.ko.includes('함께'));
});

test('five elements still use existing source text and existing prayer button', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'home.html'), 'utf8');
  assert.match(html, /· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 · <button id="prayerBoxTrigger"/);
  assert.match(html, /class="prayer-box-trigger" type="button" aria-controls="prayerBox"/);
  const cta = homepage.entries.find(e=>e.selector==='#prayerBoxTrigger');
  assert.equal(cta.values.en,'PRAY TOGETHER');
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


test('English mobile navigation uses scroll, not clipping or changed navbar geometry', () => {
  const styles={};
  const css={
    get overflowX(){return styles.overflowX || '';},set overflowX(v){styles.overflowX=v;},
    get justifyContent(){return styles.justifyContent || '';},set justifyContent(v){styles.justifyContent=v;},
    get paddingRight(){return styles.paddingRight || '';},set paddingRight(v){styles.paddingRight=v;},
    removeProperty(prop){delete styles[{'overflow-x':'overflowX','justify-content':'justifyContent','padding-right':'paddingRight'}[prop]];}
  };
  const paths=['/home.html','/test.html','/tongxing.html','/tongdao.html','/what.html','/tonglu.html'];
  const elements=paths.map(p=>({getAttribute:key=>key==='href'?p:null}));
  const nav={style:css,querySelectorAll:selector=>selector==='a'?elements:[]};
  let matches=true,callback;
  const mock={
    document:{querySelector:selector=>selector==='body > nav'?nav:null},
    matchMedia:media=>{
      assert.equal(media,'(max-width: 699px)');
      return {get matches(){return matches;},addEventListener:(event,fn)=>{
        assert.equal(event,'change');callback=fn;
      }};
    }
  };
  assert.equal(homepage.enableEnglishNarrowNavigation(mock,'zh-Hans'),false);
  assert.deepEqual(styles,{});
  assert.equal(homepage.enableEnglishNarrowNavigation(mock,'en'),true);
  assert.deepEqual(styles,{overflowX:'auto',justifyContent:'flex-start'});
  matches=false;
  callback();
  assert.deepEqual(styles,{});
  matches=true;
  callback();
  assert.deepEqual(styles,{overflowX:'auto',justifyContent:'flex-start'});
  assert.deepEqual(paths, elements.map(x=>x.getAttribute('href')));
});

test('English nav guard refuses unexpected markup or other locales', () => {
  const nav={style:{},querySelectorAll:()=>[{getAttribute:()=>'/home.html'}]};
  const fake={
    document:{querySelector:()=>nav},
    matchMedia:()=>({matches:true})
  };
  assert.equal(homepage.enableEnglishNarrowNavigation(fake,'en'),false);
  assert.equal(homepage.enableEnglishNarrowNavigation(fake,'zh-Hant'),false);
  assert.deepEqual(nav.style,{});
});



test('homepage is the only page with three-language controls and six original nav links', () => {
  const fs=require('node:fs'),path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../home.html'),'utf8');
  const nav=html.match(/<nav>([\s\S]*?)<\/nav>/);
  assert.ok(nav);
  assert.equal((nav[1].match(/<a href=/g)||[]).length,6);
  assert.doesNotMatch(nav[1],/homeLanguageSwitch/);
  assert.match(html, /<\/nav>\s*<header>\s*<div id="homeLanguageSwitch" role="navigation"/);
  assert.match(html, /href="\/home\.html\?lang=zh-Hant"/);
  assert.match(html, /href="\/home\.html\?lang=en"/);
  assert.match(html, /href="\/home\.html\?lang=ja"/);
  assert.match(html, /href="\/home\.html\?lang=ko"/);
  assert.match(html, /href="\/home\.html\?lang=es"/);
  assert.equal((html.match(/id="homeLanguageSwitch"/g)||[]).length,1);
  assert.equal((html.match(/target="_top"/g)||[]).length,5);
  assert.match(html, /#homeLanguageSwitch a:focus-visible/);
  assert.match(html, /min-height: 44px/);
});

test('six-language homepage selector displays five alternatives without altering current language', () => {
  const locales=['zh-Hans','zh-Hant','en','ja','es','ko'];
  const labels={'zh-Hans':'简','zh-Hant':'繁',en:'EN',ja:'日',es:'ES',ko:'한'};
  const names={en:'Homepage languages',ja:'ホームページの言語切り替え',
    es:'Idiomas de la página de inicio',ko:'홈페이지 언어 변경',
    'zh-Hant':'首頁語言切換','zh-Hans':'首页语言切换'};
  const attrs=[
    {href:'/home.html?lang=zh-Hant'},{href:'/home.html?lang=en'},
    {href:'/home.html?lang=ja'},{href:'/home.html?lang=es'},
    {href:'/home.html?lang=ko'}
  ];
  const links=attrs.map(a=>({getAttribute:key=>a[key]??null,
    setAttribute:(key,val)=>{a[key]=val;},textContent:''}));
  const wraps={};
  const wrap={tagName:'DIV',querySelectorAll:sel=>sel==='a'?links:[],
    setAttribute:(key,val)=>{wraps[key]=val;}};
  const mk=(search,hash)=>({BudaoGlobal:core,
    location:{pathname:'/home.html',search,hash},
    document:{getElementById:id=>id==='homeLanguageSwitch'?wrap:null}});
  for(const lang of locales){
    const search=lang==='zh-Hans'?'?from=trail':'?lang='+lang+'&from=trail';
    assert.equal(homepage.configureHomeLanguageSwitch(mk(search,'#top'),lang),true,lang);
    const others=locales.filter(l=>l!==lang);
    assert.deepEqual(links.map(l=>l.textContent),others.map(l=>labels[l]),lang);
    assert.deepEqual(attrs.map(l=>l.href),others.map(l=>
      core.languageLink('/home.html',search,'#top',l)),lang);
    assert.deepEqual(attrs.map(l=>l.hreflang),others,lang);
    assert.equal(wraps['aria-label'],names[lang]);
  }
  assert.equal(homepage.configureHomeLanguageSwitch(mk('',''),'zh-Hans'),true);
  assert.deepEqual(links.map(l=>l.textContent),['繁','EN','日','ES','한']);
});

test('selector refuses non-homepage routes and unexpected markup', () => {
  const good={getAttribute:()=>'/home.html?lang=en',setAttribute:()=>{}};
  const mk=(pathname,wrap)=>({
    BudaoGlobal:core,
    location:{pathname,search:'',hash:''},
    document:{getElementById:()=>wrap}
  });
  const wrap={tagName:'DIV',querySelectorAll:()=>[good,good,good,good,good],setAttribute(){}};
  assert.equal(homepage.configureHomeLanguageSwitch(mk('/test.html',wrap),'en'),false);
  assert.equal(homepage.configureHomeLanguageSwitch(mk('/tongdao.html',wrap),'zh-Hant'),false);
  assert.equal(homepage.configureHomeLanguageSwitch(mk('/home.html',{...wrap,tagName:'A'}),'en'),false);
  assert.equal(homepage.configureHomeLanguageSwitch(mk('/home.html',{...wrap,querySelectorAll:()=>[good]}),'en'),false);
});

test('traditional Chinese hero uses 餘 and original four music controls', () => {
  const {doc,line,controls}=buildMockOriginalCreed();
  const oldControls=Object.values(controls);
  const oldCount=line.childNodes.length;
  assert.equal(homepage.previewTraditionalCreed(doc,'zh-Hant'),true);
  assert.equal(line.textContent.replace(/\s+/g,''),'餘生行走，不偏左右');
  assert.deepEqual(line.childNodes.filter(n=>n.nodeType===1),oldControls);
  assert.equal(line.childNodes.length,oldCount);
  assert.equal(controls.dspBtn.textContent,'餘');
  assert.equal(controls.playBtn.textContent,'走');
  assert.equal(homepage.previewTraditionalCreed(doc,'zh-Hant'),false);
  assert.equal(homepage.previewTraditionalCreed(buildMockOriginalCreed().doc,'en'),false);
});

test('traditional localization remains opt-in and source-guarded on homepage', () => {
  const entry=homepage.entries.find(e=>e.selector==='main section:nth-of-type(1) h2');
  assert.equal(entry.values['zh-Hant'],'我們在做什麼？');
  const aria=homepage.entries.find(e=>e.selector==='#dspBtn');
  assert.equal(aria.values['zh-Hant'],'同行之聲母帶處理');
  assert.equal(core.requestedLocale('?lang=zh-Hant'),'zh-Hant');
  assert.equal(core.requestedLocale(''),'zh-Hans');
  assert.equal(core.languageLink('/home.html','','','zh-Hant'),'/home.html?lang=zh-Hant');
  assert.equal(core.languageLink('/home.html','?lang=zh-Hant','','zh-Hans'),'/home.html');
});

test('Traditional Chinese homepage consistently names 步道 in mission, prayer and footer', () => {
  const selections = {
    'main section:nth-of-type(3) h2':'「步道」有什麼？',
    '.prayer-box-options label:nth-of-type(1) span':'僅由步道帶領人閱讀和代禱',
    '.prayer-box-return':'回到步道',
    'footer > p':'© 2026 步道 budao.org'
  };
  for (const [selector, expected] of Object.entries(selections)) {
    const entry = homepage.entries.find(e=>e.selector===selector);
    assert.ok(entry, selector);
    assert.equal(entry.values['zh-Hant'], expected, selector);
  }
  const completed = homepage.entries.find(e=>e.selector==='.prayer-box-success p');
  assert.match(completed.values['zh-Hant'], /步道帶領人/);
  assert.doesNotMatch(completed.values['zh-Hant'], /BUDAO/);
});


test('Japanese preview translates all 37 homepage fields and preserves other locales', () => {
  assert.equal(homepage.entries.length,37);
  for (const entry of homepage.entries) {
    assert.ok(typeof entry.values.ja==='string' && entry.values.ja.trim(),entry.selector);
    assert.ok(typeof entry.values.en==='string' && entry.values.en.trim(),entry.selector);
    assert.ok(typeof entry.values['zh-Hant']==='string' && entry.values['zh-Hant'].trim(),entry.selector);
  }
  const heading=homepage.entries.find(e=>e.selector==='header > h1');
  assert.deepEqual({en:heading.values.en,trad:heading.values['zh-Hant'],ja:heading.values.ja},
    {en:'BUDAO',trad:'步道',ja:'道行'});
  assert.equal(homepage.entries.find(e=>e.selector==='main section:nth-of-type(1) h2').values.ja,
    '私たちは何をしているのでしょうか？');
  assert.match(homepage.entries.find(e=>e.selector==='main section:nth-of-type(2) p').values.ja,
    /イエス・キリストは道であり、真理であり、いのちです/);
  assert.equal(core.languageLink('/home.html','','','ja'),'/home.html?lang=ja');
  assert.equal(core.languageLink('/home.html','?lang=ja','','zh-Hans'),'/home.html');
});

test('Japanese brand consistently uses approved 道行（みちゆき）', () => {
  const bySelector = (selector) => {
    const entry = homepage.entries.find(e=>e.selector===selector);
    assert.ok(entry,selector);
    return entry.values.ja;
  };
  assert.equal(bySelector('nav a[href="/test.html"]'),'道行');
  assert.equal(bySelector('header > h1'),'道行');
  assert.equal(bySelector('title'),'道行');
  assert.equal(bySelector('main section:nth-of-type(2) h2'),'なぜ「道行」なのでしょうか？');
  assert.equal(bySelector('main section:nth-of-type(3) h2'),'「道行」で何に出会える？');
  assert.equal(bySelector('.prayer-box-return'),'道行に戻る');
  assert.match(bySelector('.prayer-box-options label:nth-of-type(1) span'),/道行のリーダー/);
  assert.match(bySelector('.prayer-box-success p'),/道行のリーダー/);
  assert.equal(bySelector('footer > p'),'© 2026 道行 budao.org');
  const japaneseValues = homepage.entries.map(e=>e.values.ja);
  assert.ok(japaneseValues.some(x=>x.includes('道行')));
  assert.ok(!japaneseValues.some(x=>x.includes('歩道')), 'never translate BUDAO to the Japanese word for sidewalk');
});

test('Japanese proper-name annotation adds a pronunciation and discourages auto translation', () => {
  const makeElement = (value) => ({
    textContent: value,
    attributes: {},
    setAttribute(name,value) { this.attributes[name]=value; }
  });
  const hero = makeElement('道行');
  const nav = makeElement('道行');
  const doc = {querySelector(selector) {
    if(selector==='header > h1') return hero;
    if(selector==='nav a[href="/test.html"]') return nav;
    return null;
  }};
  assert.equal(homepage.annotateJapaneseBrand(doc,'zh-Hans'),false);
  assert.equal(homepage.annotateJapaneseBrand(doc,'en'),false);
  assert.deepEqual(hero.attributes,{});
  assert.equal(homepage.annotateJapaneseBrand(doc,'ja'),true);
  for (const el of [hero,nav]) {
    assert.equal(el.textContent,'道行');
    assert.deepEqual(el.attributes,{'translate':'no','aria-label':'道行（みちゆき）'});
  }
  const drift=makeElement('歩道');
  assert.equal(homepage.annotateJapaneseBrand({
    querySelector(selector) {return selector==='header > h1'?drift:nav;}
  },'ja'),false);
  assert.deepEqual(drift.attributes,{});
});

test('Japanese prayer feedback remains local while payload and privacy rules remain unchanged', () => {
  assert.equal(homepage.runtimeCopy('正在送达…','ja'),'送信中…');
  assert.equal(homepage.runtimeCopy('提交祷告','ja'),'祈りを送信');
  assert.match(homepage.runtimeCopy('要放下尚未送出的内容吗？','ja'),/破棄しますか/);
  const fields=homepage.entries.filter(e=>e.selector.includes('prayer-box'));
  assert.ok(fields.length>=17);
  assert.ok(fields.every(e=>typeof e.values.ja==='string' && e.values.ja.trim()));
});

test('Japanese declaration is a draft and retains all four original audio controls', () => {
  const {doc,line,controls}=buildMockOriginalCreed();
  const existing=Object.values(controls);
  const count=line.childNodes.filter(n=>n.nodeType===1).length;
  assert.equal(homepage.previewJapaneseCreed(doc,'ja'),true);
  assert.equal(line.textContent.replace(/\s+/g,''),'これからの人生、主の道を歩み、右にも左にもそれず。');
  assert.equal(line.childNodes.filter(n=>n.nodeType===1).length,count);
  assert.deepEqual(line.childNodes.filter(n=>n.nodeType===1),existing);
  assert.equal(controls.dspBtn.textContent,'これからの人生');
  assert.equal(controls.playBtn.textContent,'歩み');
  assert.equal(controls.prevBtn.textContent,'右');
  assert.equal(controls.nextBtn.textContent,'左');
  assert.equal(homepage.previewJapaneseCreed(doc,'ja'),false);
  assert.equal(homepage.previewJapaneseCreed(buildMockOriginalCreed().doc,'en'),false);
});

test('Japanese homepage is opt-in; no other site pages acquire Japanese labels', () => {
  const files=require('node:fs'),path=require('node:path');
  const html=files.readFileSync(path.join(__dirname,'../home.html'),'utf8');
  assert.equal((html.match(/href="\/home\.html\?lang=ja"/g)||[]).length,1);
  assert.match(html, /href="\/test\.html">步道<\/a>/);
  assert.doesNotMatch(html, /<nav>[\s\S]*?href="\/home\.html\?lang=ja"[\s\S]*?<\/nav>/);
  const a={href:'/tongdao.html',getAttribute(){return this.href;},setAttribute(){throw Error('must not set')}}
  const document={querySelectorAll:()=>[a]};
  assert.deepEqual(core.carryLocaleOnLinks(document,'ja',['/home.html']),{changed:0});
});


test('Tesla and tablet widths get six equal centered homepage nav cells', () => {
  const fs=require('node:fs'),path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../home.html'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'../style.css'),'utf8');
  assert.match(html, /@media \(min-width: 700px\) and \(max-width: 1400px\)/);
  assert.match(html, /body > nav\s*\{[\s\S]*?display: grid;[\s\S]*?grid-template-columns: repeat\(6, minmax\(0, 1fr\)\)/);
  assert.match(html, /body > nav > a\s*\{[\s\S]*?text-align: center;[\s\S]*?white-space: normal;/);
  assert.match(html, /@media \(min-width: 700px\) and \(max-width: 1200px\)/);
  assert.match(html, /@media \(max-width: 699px\)/);
  assert.match(html, /overflow-x: auto;/);
  assert.match(html, /body > nav > a:first-child \{ margin-inline-start: auto; \}/);
  assert.match(html, /body > nav > a:last-child \{ margin-inline-end: auto; \}/);
  assert.match(css,/nav \{[\s\S]*?display: flex;[\s\S]*?justify-content: center;/);
  // The global site CSS and all other pages remain unchanged.
  assert.equal((html.match(/<nav>([\s\S]*?)<\/nav>/g)||[]).length,1);
  const nav=html.match(/<nav>([\s\S]*?)<\/nav>/)[1];
  assert.equal((nav.match(/<a href=/g)||[]).length,6);
  assert.doesNotMatch(nav,/homeLanguageSwitch/);
});

test('localized navigation does not force left alignment in Tesla grid widths', () => {
  const styles={};
  const nav={
    style: {
      set overflowX(value){styles.overflowX=value;},
      set justifyContent(value){styles.justifyContent=value;},
      removeProperty(property){delete styles[property==='overflow-x'?'overflowX':'justifyContent'];}
    },
    querySelectorAll:()=>['/home.html','/test.html','/tongxing.html','/tongdao.html','/what.html','/tonglu.html']
      .map(href=>({getAttribute:()=>href}))
  };
  let query;
  const root={document:{querySelector:()=>nav},matchMedia:condition=>{
    query=condition;return {matches:false,addEventListener(){}};
  }};
  assert.equal(homepage.enableEnglishNarrowNavigation(root,'ja'),true);
  assert.equal(query,'(max-width: 699px)');
  assert.deepEqual(styles,{});
  assert.equal(homepage.enableEnglishNarrowNavigation(root,'en'),true);
  assert.deepEqual(styles,{});
  assert.equal(homepage.enableEnglishNarrowNavigation(root,'zh-Hant'),true);
  assert.deepEqual(styles,{});
  assert.equal(homepage.enableEnglishNarrowNavigation(root,'zh-Hans'),false);
});


test('Korean opt-in homepage translates all 37 source-guarded strings without altering other languages', () => {
  assert.equal(homepage.entries.length,37);
  assert.ok(homepage.entries.every(entry =>
    typeof entry.values.ko==='string' && entry.values.ko.trim()), 'no missing Korean values');
  const get=(selector)=>homepage.entries.find(e=>e.selector===selector).values.ko;
  assert.equal(get('header > h1'),'BUDAO');
  assert.equal(get('nav a[href="/test.html"]'),'BUDAO');
  assert.equal(get('nav a[href="/what.html"]'),'동역자');
  assert.equal(get('main section:nth-of-type(1) h2'),'우리는 무엇을 하나요?');
  assert.match(get('main section:nth-of-type(1) p'),/주님의 임재/);
  assert.match(get('main section:nth-of-type(2) p'),/예수 그리스도는 길이요 진리요 생명이십니다/);
  assert.equal(get('main section:nth-of-type(2) h2'),'왜 BUDAO(부다오)인가요?');
  assert.equal(get('footer > p'),'© 2026 BUDAO budao.org');
  assert.equal(core.requestedLocale('?lang=ko-KR'),'ko');
  assert.equal(core.languageLink('/home.html','','','ko'),'/home.html?lang=ko');
  assert.equal(core.languageLink('/home.html','?lang=ko','','zh-Hans'),'/home.html');
});

test('Korean five ones express a specific route, a Bible passage and praying together', () => {
  const lead=homepage.entries.find(e=>e.selector==='main section:nth-of-type(3) p');
  const prayer=homepage.entries.find(e=>e.selector==='#prayerBoxTrigger');
  assert.equal(lead.source,'· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 ·');
  assert.equal(prayer.source,'一起祷告');
  const parts=lead.values.ko.split('·').map(x=>x.trim()).filter(Boolean);
  parts.push(prayer.values.ko);
  assert.deepEqual(parts,[
    '한 번의 포옹','하나의 걷기 코스','하나의 이야기','한 대목의 성경 말씀','함께 기도해요'
  ]);
  const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'../home.html'),'utf8');
  assert.match(html,/· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 · <button id="prayerBoxTrigger"/);
  assert.match(html,/aria-controls="prayerBox" aria-expanded="false"/);
});

test('Korean prayer copy keeps original consent scope, privacy and response choices', () => {
  const get=(selector)=>homepage.entries.find(e=>e.selector===selector).values.ko;
  assert.match(get('.prayer-box-options label:nth-of-type(1) span'),/인도자만/);
  assert.match(get('.prayer-box-options label:nth-of-type(2) span'),/동의합니다/);
  assert.match(get('.prayer-box-reply-choice span'),/비공개 답변/);
  assert.match(get('.prayer-box-privacy'),/공개되지 않습니다/);
  assert.equal(get('.prayer-box-submit'),'기도 요청 보내기');
  assert.equal(homepage.runtimeCopy('正在送达…','ko'),'보내는 중…');
  assert.equal(homepage.runtimeCopy('提交祷告','ko'),'기도 요청 보내기');
  assert.match(homepage.runtimeCopy('暂时没有送达，请稍后再试。','ko'),/다시 시도해 주세요/);
  assert.equal(homepage.runtimeCopy('正在送达…','en'),'Sending…');
  assert.equal(homepage.runtimeCopy('正在送达…','zh-Hans'),'正在送达…');
});

test('Korean declaration keeps all four interactive audio spans and the original Chinese guard', () => {
  const first=buildMockOriginalCreed();
  const elements=Object.values(first.controls);
  const handlers=elements.map(el=>el.onClick);
  assert.equal(homepage.previewKoreanCreed(first.doc,'en'),false);
  assert.equal(homepage.previewKoreanCreed(first.doc,'ko'),true);
  assert.equal(first.line.textContent,homepage.proposedKoreanCreed);
  assert.deepEqual(first.line.childNodes.filter(el=>el.nodeType===1),elements);
  assert.deepEqual(elements.map(el=>el.onClick),handlers);
  assert.deepEqual(elements.map(el=>el.textContent),['남은 생애','걸으며','좌','우']);
  assert.equal(first.line.style.whiteSpace,'pre-line');
  assert.equal(homepage.previewKoreanCreed(first.doc,'ko'),false);
  const untouched=buildMockOriginalCreed();
  assert.equal(homepage.previewKoreanCreed(untouched.doc,'zh-Hans'),false);
  assert.match(untouched.line.textContent,/余生行走/);
});

test('Korean BUDAO metadata provides readable Hangul without changing brand visuals', () => {
  const mk=value=>({textContent:value,attributes:{},setAttribute(k,v){this.attributes[k]=v}});
  const h=mk('BUDAO'),n=mk('BUDAO');
  const doc={querySelector:key=>key==='header > h1'?h:key==='nav a[href="/test.html"]'?n:null};
  assert.equal(homepage.annotateKoreanBrand(doc,'en'),false);
  assert.equal(homepage.annotateKoreanBrand(doc,'ko'),true);
  assert.deepEqual(h.attributes,{'translate':'no','aria-label':'BUDAO(부다오)'});
  assert.deepEqual(n.attributes,h.attributes);
  assert.equal(homepage.annotateKoreanBrand({querySelector:()=>mk('步道')},'ko'),false);
});

test('Korean is homepage-only and Tesla six-item primary navigation remains unchanged', () => {
  const fs=require('node:fs'),path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../home.html'),'utf8');
  const nav=html.match(/<nav>([\s\S]*?)<\/nav>/);
  assert.ok(nav);
  assert.equal((nav[1].match(/<a href=/g)||[]).length,6);
  assert.doesNotMatch(nav[1],/lang=ko/);
  assert.match(html,/href="\/home\.html\?lang=ko"/);
  assert.match(html,/@media \(min-width: 1201px\) and \(max-width: 1400px\)/);
  assert.equal((html.match(/target="_top"/g)||[]).length,5);
  assert.equal(core.languageLink('/tongxing.html','','','ko'),'/tongxing.html?lang=ko');
  assert.deepEqual(core.carryLocaleOnLinks({querySelectorAll:()=>[]},'ko',['/home.html']),{changed:0});
});

test('Spanish draft covers all 37 homepage fields with brand and scripture meaning intact', () => {
  assert.equal(homepage.entries.length,37);
  assert.ok(homepage.entries.every(entry=>typeof entry.values.es === 'string' && entry.values.es.trim()),
    'No missing Spanish translation keys');
  const get=(selector)=>homepage.entries.find(entry=>entry.selector===selector).values.es;
  assert.equal(get('nav a[href="/home.html"]'),'Inicio');
  assert.equal(get('nav a[href="/test.html"]'),'BUDAO');
  assert.equal(get('header > h1'),'BUDAO');
  assert.equal(get('main section:nth-of-type(1) h2'),'¿Qué hacemos?');
  assert.equal(get('main section:nth-of-type(2) h2'),'¿Por qué BUDAO?');
  assert.match(get('main section:nth-of-type(2) p'),/Él es el camino, la verdad y la vida/);
  assert.equal(get('main section:nth-of-type(3) h2'),'¿Qué encontrarás en BUDAO?');
  assert.equal(get('main section:nth-of-type(3) p'),
    '· UN ABRAZO · UNA RUTA · UNA HISTORIA · UN PASAJE BÍBLICO · ');
  assert.equal(get('#prayerBoxTrigger'),'OREMOS JUNTOS');
  assert.equal(get('footer .campfire-link:not(.spark-link)'),'✦ La hoguera');
  assert.equal(get('footer .campfire-link.spark-link'),'❦ Chispas del camino');
  assert.equal(get('footer > p'),'© 2026 BUDAO budao.org');
  assert.equal(core.requestedLocale('?lang=es-AR'),'es');
  assert.equal(core.languageLink('/home.html','','','es'),'/home.html?lang=es');
});

test('Spanish prayer and permission copy are local, source-guarded and independent of payload', () => {
  const get=(selector)=>homepage.entries.find(entry=>entry.selector===selector).values.es;
  assert.equal(get('.prayer-box-privacy'),'Tu petición no se hará pública.');
  assert.match(get('.prayer-box-options label:nth-of-type(2) span'),/Autorizo al líder/);
  assert.equal(homepage.runtimeCopy('正在送达…','es'),'Enviando…');
  assert.equal(homepage.runtimeCopy('提交祷告','es'),'Enviar petición');
  assert.match(homepage.runtimeCopy('暂时没有送达，请稍后再试。','es'),/No se pudo enviar/);
  assert.equal(core.carryLocaleOnLinks({querySelectorAll:()=>[]},'es',['/home.html']).changed,0);
});

test('Spanish declaration preserves audio-control identity and never leaks to existing locales', () => {
  const {doc,line,controls}=buildMockOriginalCreed();
  const preserved=Object.values(controls);
  const handlers=preserved.map(el=>el.onClick);
  assert.equal(homepage.previewSpanishCreed(doc,'en'),false);
  assert.equal(homepage.previewSpanishCreed(doc,'es'),true);
  assert.equal(line.textContent.replace(/\s+/g,' ').trim(),
    'Hasta el último día, andaremos por su camino; sin desviarnos ni a la izquierda ni a la derecha.');
  assert.deepEqual(line.childNodes.filter(node=>node.nodeType===1),preserved);
  assert.deepEqual(preserved.map(el=>el.onClick),handlers);
  assert.deepEqual(preserved.map(el=>el.textContent),['Hasta','andaremos','izquierda','derecha']);
  assert.equal(line.style.whiteSpace,'pre-line');
  assert.equal(homepage.previewSpanishCreed(doc,'es'),false);
  const original=buildMockOriginalCreed();
  assert.equal(homepage.previewSpanishCreed(original.doc,'zh-Hans'),false);
  assert.match(original.line.textContent,/余生行走/);
});

test('Spanish BUDAO is excluded from machine translation only in Spanish', () => {
  const mk=(text)=>({textContent:text,attrs:{},setAttribute(k,v){this.attrs[k]=v}});
  const heading=mk('BUDAO'),nav=mk('BUDAO');
  const doc={querySelector:sel=>
    sel==='header > h1'?heading:sel==='nav a[href="/test.html"]'?nav:null};
  assert.equal(homepage.annotateSpanishBrand(doc,'en'),false);
  assert.deepEqual(heading.attrs,{});
  assert.equal(homepage.annotateSpanishBrand(doc,'es'),true);
  assert.equal(heading.attrs.translate,'no');
  assert.equal(nav.attrs.translate,'no');
  assert.equal(heading.textContent,'BUDAO');
  assert.equal(nav.textContent,'BUDAO');
  const modified={querySelector:sel=>
    sel==='header > h1'?mk('Mudado'):nav};
  assert.equal(homepage.annotateSpanishBrand(modified,'es'),false);
});

test('Spanish is homepage-only; the expanded language control remains outside six-link nav', () => {
  const fs=require('node:fs'),path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../home.html'),'utf8');
  const nav=html.match(/<nav>([\s\S]*?)<\/nav>/);
  assert.ok(nav);
  assert.equal((nav[1].match(/<a href=/g)||[]).length,6);
  assert.doesNotMatch(nav[1],/lang=es/);
  assert.match(html, /href="\/home\.html\?lang=es"/);
  assert.match(html, /@media \(min-width: 1201px\) and \(max-width: 1400px\)/);
  assert.equal((html.match(/target="_top"/g)||[]).length,5);
  assert.equal(core.safePage('/contact.html'),false);
  assert.equal(core.languageLink('/contact.html','','','es'),null);
});
