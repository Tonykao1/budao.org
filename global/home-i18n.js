/* BUDAO GLOBAL Japanese homepage editorial preview, alongside approved existing locales.
 * Opt-in Japanese preview: /home.html?lang=ja (NOT production approved)
 * Preserves current HTML tree, CSS, hrefs, icons, animation and interactions.
 * These draft translations are not approved canonical international pages.
 */
(function (root) {
  'use strict';
  const entries = [
    { selector:'nav a[href="/home.html"]', source:'首页', values:{en:'Home', 'zh-Hant':'首頁', ja:'ホーム'} },
    { selector:'nav a[href="/test.html"]', source:'步道', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'BUDAO'} },
    { selector:'nav a[href="/tongxing.html"]', source:'童行', values:{en:'Young Explorers', 'zh-Hant':'童行', ja:'子どもと歩む'} },
    { selector:'nav a[href="/tongdao.html"]', source:'同道', values:{en:'Companions', 'zh-Hant':'同道', ja:'ともに歩む'} },
    { selector:'nav a[href="/what.html"]', source:'同工', values:{en:'Fellow Workers', 'zh-Hant':'同工', ja:'ともに仕える人々'} },
    { selector:'nav a[href="/tonglu.html"]', source:'牧场', values:{en:'Pasture', 'zh-Hant':'牧場', ja:'牧場'} },
    { selector:'#dspBtn', mode:'attribute', attribute:'aria-label', source:'同行之声母带处理', values:{en:'Audio master processing', 'zh-Hant':'同行之聲母帶處理', ja:'同行の声：音声マスター処理'} },
    { selector:'title', source:'步道 budao', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'BUDAO'} },
    { selector:'header > h1', source:'步道', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'BUDAO'} },
    { selector:'main section:nth-of-type(1) h2', source:'我们在做什么？', values:{en:'What do we do?', 'zh-Hant':'我們在做什麼？', ja:'私たちは何をしているのでしょうか？'} },
    { selector:'main section:nth-of-type(1) p', source:'健行于天地，相知于彼此，在旷野经历与祂的同在。', values:{en:'We walk the earth beneath the heavens, come to know one another, and encounter His presence in the wilderness.', 'zh-Hant':'健行於天地，相知於彼此，在曠野經歷與祂的同在。', ja:'天地の中を歩き、互いを知り、荒野で主の臨在を経験します。'} },
    { selector:'main section:nth-of-type(2) h2', source:'为什么是“步道”？', values:{en:'Why BUDAO?', 'zh-Hant':'為什麼是「步道」？', ja:'なぜ「BUDAO」なのでしょうか？'} },
    { selector:'main section:nth-of-type(2) p', source:'祂就是道路、真理、生命。唯有祂亲自感动你同行天路，共步主道。', values:{en:'He is the way, the truth, and the life. He alone can stir our hearts to journey heavenward together, following His way.', 'zh-Hant':'祂就是道路、真理、生命。唯有祂親自感動你同行天路，共步主道。', ja:'主こそ道であり、真理であり、いのちです。主ご自身が心を動かしてくださるとき、私たちは天の御国を目指し、主の道をともに歩むのです。'} },
    { selector:'main section:nth-of-type(3) h2', source:'“步道”有什么？', values:{en:'What will you find at BUDAO?', 'zh-Hant':'「步道」有什麼？', ja:'BUDAOには何があるのでしょうか？'} },
    { selector:'main section:nth-of-type(3) p', mode:'leading-text', source:'· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 ·', values:{en:'· EMBRACE · TRAIL · STORY · SCRIPTURE · ', 'zh-Hant':'· 一個擁抱 · 一條線路 · 一則故事 · 一段經文 · ', ja:'· ひとつのハグ · 一本の道 · ひとつの物語 · 聖書の一節 · '} },
    { selector:'#prayerBoxTrigger', source:'一起祷告', values:{en:'PRAYER', 'zh-Hant':'一起禱告', ja:'ともに祈る'} },
    { selector:'.prayer-box-backdrop', mode:'attribute', attribute:'aria-label', source:'关闭一起祷告', values:{en:'Close prayer dialog', 'zh-Hant':'關閉一起禱告', ja:'祈りの画面を閉じる'} },
    { selector:'.prayer-box-close', mode:'attribute', attribute:'aria-label', source:'关闭', values:{en:'Close', 'zh-Hant':'關閉', ja:'閉じる'} },
    { selector:'.prayer-box-header h2', source:'一起祷告', values:{en:'Pray Together', 'zh-Hant':'一起禱告', ja:'ともに祈る'} },
    { selector:'.prayer-box-header p', source:'有什么想让我们陪你一起记念？', values:{en:'Is there something you would like us to remember in prayer?', 'zh-Hant':'有什麼想讓我們陪你一起記念？', ja:'私たちと一緒に祈ってほしいことはありますか？'} },
    { selector:'.prayer-box-sr-only', source:'代祷事项', values:{en:'Prayer request', 'zh-Hant':'代禱事項', ja:'祈ってほしいこと'} },
    { selector:'.prayer-box-options legend', source:'关于这份祷告', values:{en:'About your prayer request', 'zh-Hant':'關於這份禱告', ja:'この祈りについて'} },
    { selector:'.prayer-box-options label:nth-of-type(1) span', source:'仅由步道带领人阅读和代祷', values:{en:'Only BUDAO leaders may read this and pray for me', 'zh-Hant':'僅由步道帶領人閱讀和代禱', ja:'BUDAOのリーダーだけが内容を読み、あなたのために祈ります'} },
    { selector:'.prayer-box-options label:nth-of-type(2) span', source:'同意带领人邀请受托同工一起代祷', values:{en:'I agree that the leader may invite trusted fellow workers to pray too', 'zh-Hant':'同意帶領人邀請受託同工一起代禱', ja:'リーダーが信頼できる奉仕者にも祈りを依頼することに同意します'} },
    { selector:'.prayer-box-reply-choice span', source:'希望带领人私下回应我', values:{en:'I would like a private reply from a BUDAO leader', 'zh-Hant':'希望帶領人私下回應我', ja:'リーダーから個別に返信を希望します'} },
    { selector:'.prayer-box-contact > span', source:'联系方式', values:{en:'Contact information', 'zh-Hant':'聯絡方式', ja:'連絡先'} },
    { selector:'.prayer-box-contact > small', source:'仅在希望获得回应时填写', values:{en:'Only if you would like a reply', 'zh-Hant':'僅在希望獲得回應時填寫', ja:'返信をご希望の場合のみご記入ください'} },
    { selector:'.prayer-box-privacy', mode:'leading-text', source:'你的内容不会公开。', values:{en:'Your request will not be made public.', 'zh-Hant':'你的內容不會公開。', ja:'あなたの内容が公開されることはありません。'} },
    { selector:'.prayer-box-privacy', mode:'leading-text', source:'我们会谨慎承接，只用于代祷与必要的关怀。', values:{en:'We will treat it with care, using it only for prayer and necessary support.', 'zh-Hant':'我們會謹慎承接，只用於代禱與必要的關懷。', ja:'祈りと必要なケアのためにのみ、慎重に取り扱います。'} },
    { selector:'.prayer-box-submit', source:'提交祷告', values:{en:'Send prayer request', 'zh-Hant':'提交禱告', ja:'祈りを送信'} },
    { selector:'.prayer-box-success h2', source:'已经收到了。', values:{en:'Received.', 'zh-Hant':'已經收到了。', ja:'受け付けました。'} },
    { selector:'.prayer-box-success p', source:'会有一位步道带领人安静地承接这份祷告。愿你在前面的路上，得着平安与同行。', values:{en:'A BUDAO leader will receive your prayer request with care. May you find peace and companionship on the road ahead.', 'zh-Hant':'會有一位步道帶領人安靜地承接這份禱告。願你在前面的路上，得著平安與同行。', ja:'BUDAOのリーダーが、あなたの祈りを大切に受け止めます。これからの道のりに、平安とともに歩む仲間がありますように。'} },
    { selector:'.prayer-box-return', source:'回到步道', values:{en:'Return to BUDAO', 'zh-Hant':'回到步道', ja:'BUDAOに戻る'} },
    { selector:'.footer-sister-links', mode:'attribute', attribute:'aria-label', source:'事工展示', values:{en:'Ministry stories', 'zh-Hant':'事工展示', ja:'活動の紹介'} },
    { selector:'footer .campfire-link:not(.spark-link)', source:'✦ 营火之地', values:{en:'✦ Campfire', 'zh-Hant':'✦ 營火之地', ja:'✦ キャンプファイヤー'} },
    { selector:'footer .campfire-link.spark-link', source:'❦ 路上星火', values:{en:'❦ Sparks', 'zh-Hant':'❦ 路上星火', ja:'❦ 道を照らす小さな灯'} },
    { selector:'footer > p', mode:'leading-text', source:'© 2026 步道 budao.org', values:{en:'© 2026 BUDAO budao.org', 'zh-Hant':'© 2026 步道 budao.org', ja:'© 2026 BUDAO budao.org'} }
  ];
  // The Chinese source and all original musical/art elements remain unchanged.
  // English creed is a preview-only content substitution using the EXISTING
  // audio controls. No style, attribute, element or event handler is changed.
  // The middle conjunction is inserted as a text node (not an element).
  const approvedEnglishCreed =
    'Till our final day, we shall walk in His way; Neither left nor right shall we stray.';

  function previewEnglishCreed(documentObject, locale) {
    if (locale !== 'en' || !documentObject ||
        typeof documentObject.querySelector !== 'function') return false;
    const line = documentObject.querySelector('header .hero-line');
    if (!line || typeof line.textContent !== 'string' ||
        line.textContent.replace(/\s+/g, '') !== '余生行走，不偏左右') return false;

    const dsp = documentObject.getElementById('dspBtn');
    const play = documentObject.getElementById('playBtn');
    const prev = documentObject.getElementById('prevBtn');
    const next = documentObject.getElementById('nextBtn');
    if (![dsp, play, prev, next].every(el => el && el.parentElement === line)) return false;
    if (dsp.textContent !== '余' || play.textContent !== '走' ||
        prev.textContent !== '左' || next.textContent !== '右') return false;

    const leading = line.childNodes && line.childNodes[0];
    const beforePlay = dsp.nextSibling;
    const beforePrev = play.nextSibling;
    const afterNext = next.nextSibling;
    if (!leading || leading.nodeType !== 3 || leading.nodeValue.trim() !== '' ||
        !line.style ||
        !beforePlay || beforePlay.nodeType !== 3 ||
        !beforePrev || beforePrev.nodeType !== 3 ||
        !afterNext || afterNext.nodeType !== 3 ||
        prev.nextSibling !== next ||
        beforePlay.nodeValue !== '生行' ||
        beforePrev.nodeValue.replace(/\s+/g, '') !== '，不偏' ||
        !documentObject.createTextNode ||
        !line.insertBefore) return false;

    // The English version uses compact editorial typography only in this preview.
    // Keep the four original audio-control spans, color, animation and site CSS.
    // A plain newline allows a deliberate two-line couplet without adding elements.
    const conjunction = documentObject.createTextNode(' nor ');
    leading.nodeValue = '';
    dsp.textContent = 'Till';
    beforePlay.nodeValue = ' our final day, we shall ';
    play.textContent = 'walk';
    beforePrev.nodeValue = ' in His way;\nNeither ';
    prev.textContent = 'left';
    line.insertBefore(conjunction, next);
    next.textContent = 'right';
    afterNext.nodeValue = ' shall we stray.';
    line.style.fontSize = 'clamp(12px, 1.35vw, 16px)';
    line.style.letterSpacing = '0.01em';
    line.style.whiteSpace = 'pre-line';

    return line.textContent.replace(/\s+/g, ' ').trim() === approvedEnglishCreed;
  }
  function previewTraditionalCreed(documentObject, locale) {
    if (locale !== 'zh-Hant' || !documentObject ||
        typeof documentObject.querySelector !== 'function' ||
        typeof documentObject.getElementById !== 'function') return false;
    const line = documentObject.querySelector('header .hero-line');
    const dsp = documentObject.getElementById('dspBtn');
    if (!line || !dsp || dsp.parentElement !== line ||
        line.textContent.replace(/\s+/g, '') !== '余生行走，不偏左右' ||
        dsp.textContent !== '余') return false;
    // Traditional glyph only: preserve the original four audio elements,
    // animations, event listeners, timing and Chinese text layout.
    dsp.textContent = '餘';
    return line.textContent.replace(/\s+/g, '') === '餘生行走，不偏左右';
  }

  // Private prayer UI strings are local only: never sent to an external translation service.

  // Source-keyed UI strings for post-click changes made by prayer-box.js.
  // Never touch prayer request contents, permission enums or API payloads.
  const runtimeMessages = Object.freeze({
    en: Object.freeze({
      '要放下尚未送出的内容吗？': 'Discard your unsent prayer request?',
      '正在送达…': 'Sending…',
      '提交祷告': 'Send prayer request',
      '暂时没有送达，请稍后再试。': 'Your request could not be sent. Please try again later.'
    }),
    'zh-Hant': Object.freeze({
      '要放下尚未送出的内容吗？': '要放下尚未送出的內容嗎？',
      '正在送达…': '正在送達…',
      '提交祷告': '提交禱告',
      '暂时没有送达，请稍后再试。': '暫時沒有送達，請稍後再試。'
    }),
    ja: Object.freeze({
      '要放下尚未送出的内容吗？': 'まだ送信していない祈りの内容を破棄しますか？',
      '正在送达…': '送信中…',
      '提交祷告': '祈りを送信',
      '暂时没有送达，请稍后再试。': '送信できませんでした。時間をおいて再度お試しください。'
    })
  });
  function runtimeCopy(source, localeOverride) {
    if (!root.BudaoGlobal) return source;
    if (!localeOverride && (!root.location || root.location.pathname !== '/home.html')) return source;
    const language = localeOverride
      ? root.BudaoGlobal.normalizeLocale(localeOverride)
      : root.BudaoGlobal.requestedLocale(root.location.search);
    const dictionary = runtimeMessages[language];
    return dictionary && Object.prototype.hasOwnProperty.call(dictionary, source) ? dictionary[source] : source;
  }
  root.BudaoHomeI18n = Object.freeze({ runtimeCopy });

  // This control is a sibling of the original six-link nav, and appears
  // only on /home.html. Explicit link navigation, never auto locale selection.
  // Homepage-only two links, presenting the OTHER two languages.
  // 简体: 繁 + EN; English: 简 + 繁; 繁體: 简 + EN.
  // No browser/IP inference, cookies, global navigation or new pages.
  function configureHomeLanguageSwitch(windowObject, locale) {
    if (!windowObject || !windowObject.BudaoGlobal ||
        !windowObject.document || !windowObject.location ||
        windowObject.location.pathname !== '/home.html') return false;
    const wrap = windowObject.document.getElementById('homeLanguageSwitch');
    if (!wrap || wrap.tagName !== 'DIV' ||
        typeof wrap.querySelectorAll !== 'function') return false;
    const links = Array.from(wrap.querySelectorAll('a'));
    if (links.length !== 2 ||
        !links.every(link => typeof link.getAttribute === 'function' &&
          /^\/home\.html(?:\?[^#]*)?(?:#[-\w.%]*)?$/.test(link.getAttribute('href') || ''))) return false;
    const choices = Object.freeze({
      'zh-Hans': [['zh-Hant','繁','切換至繁體中文首頁'], ['en','EN','Switch homepage to English']],
      'zh-Hant': [['zh-Hans','简','切换至简体中文首页'], ['en','EN','Switch homepage to English']],
      en: [['zh-Hans','简','切换至简体中文首页'], ['zh-Hant','繁','切換至繁體中文首頁']]
    });
    const targets = choices[locale];
    if (!targets) return false;
    const prepared = targets.map(([lang,label,description]) => ({
      lang,label,description,
      href:windowObject.BudaoGlobal.languageLink('/home.html',
        windowObject.location.search, windowObject.location.hash, lang)
    }));
    if (prepared.some(target => !target.href)) return false;
    prepared.forEach((target,i) => {
      links[i].setAttribute('href',target.href);
      links[i].setAttribute('lang',target.lang);
      links[i].setAttribute('hreflang',target.lang);
      links[i].setAttribute('aria-label',target.description);
      links[i].textContent=target.label;
    });
    wrap.setAttribute('aria-label',
      locale === 'en' ? 'Homepage languages' :
      locale === 'zh-Hant' ? '首頁語言切換' : '首页语言切换');
    return true;
  }
  // English labels are longer than the original six Chinese labels. Keep the
  // site's single-row navigation, existing typography and links, but make the
  // English row horizontally scrollable on narrow screens rather than clipping
  // the first and last links. Never affects the original Chinese experience.
  function enableEnglishNarrowNavigation(windowObject, locale) {
    if (!['en','zh-Hant'].includes(locale) || !windowObject || !windowObject.document ||
        typeof windowObject.matchMedia !== 'function') return false;
    const nav = windowObject.document.querySelector('body > nav');
    if (!nav || !nav.style || typeof nav.querySelectorAll !== 'function') return false;
    const expected = ['/home.html','/test.html','/tongxing.html','/tongdao.html','/what.html','/tonglu.html'];
    const anchors = Array.from(nav.querySelectorAll('a'));
    if (anchors.length !== expected.length ||
        !anchors.every((anchor,index) => anchor.getAttribute('href')?.split('?')[0] === expected[index])) return false;
    const mq = windowObject.matchMedia('(max-width: 1200px)');
    const sync = () => {
      if (mq.matches) {
        nav.style.overflowX = 'auto';
        nav.style.justifyContent = 'flex-start';
      } else {
        nav.style.removeProperty('overflow-x');
        nav.style.removeProperty('justify-content');
      }
    };
    sync();
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change',sync);
    return true;
  }
  function start() {
    if (!root.BudaoGlobal || !root.document || !root.location) return;
    if (root.location.pathname !== '/home.html') return;
    const chosen = root.BudaoGlobal.requestedLocale(root.location.search);
    if (chosen !== root.BudaoGlobal.SOURCE) {
      root.BudaoGlobal.localize(root.document, chosen, entries);
      previewEnglishCreed(root.document, chosen);
      previewTraditionalCreed(root.document, chosen);
      root.BudaoGlobal.carryLocaleOnLinks(root.document, chosen, ['/home.html']);
      enableEnglishNarrowNavigation(root, chosen);
    }
    // Configure last so localization of self-links cannot undo the toggle target.
    configureHomeLanguageSwitch(root, chosen);
  }
  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({ entries, start, runtimeCopy, previewEnglishCreed, approvedEnglishCreed, previewTraditionalCreed, enableEnglishNarrowNavigation, configureHomeLanguageSwitch });
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, {once:true});
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);