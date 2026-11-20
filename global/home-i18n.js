/* BUDAO GLOBAL Japanese homepage editorial preview, alongside approved existing locales.
 * Japanese homepage brand approved: 道行（みちゆき）; other draft translations retain their existing review status.
 * Preserves current HTML tree, CSS, hrefs, icons, animation and interactions.
 * These draft translations are not approved canonical international pages.
 */
(function (root) {
  'use strict';
  const entries = [
    { selector:'nav a[href="/home.html"]', source:'首页', values:{en:'Home', 'zh-Hant':'首頁', ja:'ホーム', ko:'홈'} },
    { selector:'nav a[href="/test.html"]', source:'步道', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'道行', ko:'BUDAO'} },
    { selector:'nav a[href="/tongxing.html"]', source:'童行', values:{en:'Young Explorers', 'zh-Hant':'童行', ja:'子どもと歩む', ko:'아이들과 함께'} },
    { selector:'nav a[href="/tongdao.html"]', source:'同道', values:{en:'Companions', 'zh-Hant':'同道', ja:'ともに歩む', ko:'동행'} },
    { selector:'nav a[href="/what.html"]', source:'同工', values:{en:'Fellow Workers', 'zh-Hant':'同工', ja:'ともに仕える人々', ko:'동역자'} },
    { selector:'nav a[href="/tonglu.html"]', source:'牧场', values:{en:'Pasture', 'zh-Hant':'牧場', ja:'牧場', ko:'목장'} },
    { selector:'#dspBtn', mode:'attribute', attribute:'aria-label', source:'同行之声母带处理', values:{en:'Audio master processing', 'zh-Hant':'同行之聲母帶處理', ja:'同行の声：音声マスター処理', ko:'동행의 소리 마스터링'} },
    { selector:'title', source:'步道 budao', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'道行', ko:'BUDAO'} },
    { selector:'header > h1', source:'步道', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'道行', ko:'BUDAO'} },
    { selector:'main section:nth-of-type(1) h2', source:'我们在做什么？', values:{en:'What do we do?', 'zh-Hant':'我們在做什麼？', ja:'私たちは何をしているのでしょうか？', ko:'우리는 무엇을 하나요?'} },
    { selector:'main section:nth-of-type(1) p', source:'健行于天地，相知于彼此，在旷野经历与祂的同在。', values:{en:'We walk the earth beneath the heavens, come to know one another, and encounter His presence in the wilderness.', 'zh-Hant':'健行於天地，相知於彼此，在曠野經歷與祂的同在。', ja:'空と大地の間を歩み、互いを知り、荒野で主の臨在に触れます。', ko:'하늘과 땅 사이를 걸으며 서로를 알아 가고, 광야에서 주님의 임재를 경험합니다.'} },
    { selector:'main section:nth-of-type(2) h2', source:'为什么是“步道”？', values:{en:'Why BUDAO?', 'zh-Hant':'為什麼是「步道」？', ja:'なぜ「道行」なのでしょうか？', ko:'왜 BUDAO(부다오)인가요?'} },
    { selector:'main section:nth-of-type(2) p', source:'祂就是道路、真理、生命。唯有祂亲自感动你同行天路，共步主道。', values:{en:'He is the way, the truth, and the life. He alone can stir our hearts to journey heavenward together, following His way.', 'zh-Hant':'祂就是道路、真理、生命。唯有祂親自感動你同行天路，共步主道。', ja:'イエス・キリストは道であり、真理であり、いのちです。主ご自身が私たちの心を動かしてくださるとき、私たちは天の御国を目指し、主の道をともに歩むのです。', ko:'예수 그리스도는 길이요 진리요 생명이십니다. 오직 주님께서 우리의 마음을 움직이실 때, 우리는 하나님 나라를 향해 함께 걸으며 주님의 길을 따릅니다.'} },
    { selector:'main section:nth-of-type(3) h2', source:'“步道”有什么？', values:{en:'What will you find at BUDAO?', 'zh-Hant':'「步道」有什麼？', ja:'「道行」で何に出会える？', ko:'BUDAO에는 무엇이 있나요?'} },
    { selector:'main section:nth-of-type(3) p', mode:'leading-text', source:'· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 ·', values:{en:'· EMBRACE · TRAIL · STORY · SCRIPTURE · ', 'zh-Hant':'· 一個擁抱 · 一條線路 · 一則故事 · 一段經文 · ', ja:'· 抱擁 · コース · 物語 · 聖句 · ', ko:'· 한 번의 포옹 · 하나의 걷기 코스 · 하나의 이야기 · 한 대목의 성경 말씀 · '} },
    { selector:'#prayerBoxTrigger', source:'一起祷告', values:{en:'PRAYER', 'zh-Hant':'一起禱告', ja:'祈り', ko:'함께 기도해요'} },
    { selector:'.prayer-box-backdrop', mode:'attribute', attribute:'aria-label', source:'关闭一起祷告', values:{en:'Close prayer dialog', 'zh-Hant':'關閉一起禱告', ja:'祈りの画面を閉じる', ko:'함께 기도하기 창 닫기'} },
    { selector:'.prayer-box-close', mode:'attribute', attribute:'aria-label', source:'关闭', values:{en:'Close', 'zh-Hant':'關閉', ja:'閉じる', ko:'닫기'} },
    { selector:'.prayer-box-header h2', source:'一起祷告', values:{en:'Pray Together', 'zh-Hant':'一起禱告', ja:'ともに祈る', ko:'함께 기도해요'} },
    { selector:'.prayer-box-header p', source:'有什么想让我们陪你一起记念？', values:{en:'Is there something you would like us to remember in prayer?', 'zh-Hant':'有什麼想讓我們陪你一起記念？', ja:'私たちと一緒に祈ってほしいことはありますか？', ko:'우리가 함께 기도하기를 바라는 일이 있나요?'} },
    { selector:'.prayer-box-sr-only', source:'代祷事项', values:{en:'Prayer request', 'zh-Hant':'代禱事項', ja:'祈ってほしいこと', ko:'기도 제목'} },
    { selector:'.prayer-box-options legend', source:'关于这份祷告', values:{en:'About your prayer request', 'zh-Hant':'關於這份禱告', ja:'この祈りについて', ko:'이 기도 요청에 관하여'} },
    { selector:'.prayer-box-options label:nth-of-type(1) span', source:'仅由步道带领人阅读和代祷', values:{en:'Only BUDAO leaders may read this and pray for me', 'zh-Hant':'僅由步道帶領人閱讀和代禱', ja:'道行のリーダーだけが内容を読み、あなたのために祈ります', ko:'BUDAO 인도자만 이 내용을 읽고 저를 위해 기도합니다'} },
    { selector:'.prayer-box-options label:nth-of-type(2) span', source:'同意带领人邀请受托同工一起代祷', values:{en:'I agree that the leader may invite trusted fellow workers to pray too', 'zh-Hant':'同意帶領人邀請受託同工一起代禱', ja:'リーダーが信頼できる奉仕者にも祈りを依頼することに同意します', ko:'인도자가 신뢰할 수 있는 동역자에게도 기도를 부탁하는 데 동의합니다'} },
    { selector:'.prayer-box-reply-choice span', source:'希望带领人私下回应我', values:{en:'I would like a private reply from a BUDAO leader', 'zh-Hant':'希望帶領人私下回應我', ja:'リーダーから個別に返信を希望します', ko:'인도자의 비공개 답변을 받고 싶습니다'} },
    { selector:'.prayer-box-contact > span', source:'联系方式', values:{en:'Contact information', 'zh-Hant':'聯絡方式', ja:'連絡先', ko:'연락처'} },
    { selector:'.prayer-box-contact > small', source:'仅在希望获得回应时填写', values:{en:'Only if you would like a reply', 'zh-Hant':'僅在希望獲得回應時填寫', ja:'返信をご希望の場合のみご記入ください', ko:'답변을 원하는 경우에만 입력해 주세요'} },
    { selector:'.prayer-box-privacy', mode:'leading-text', source:'你的内容不会公开。', values:{en:'Your request will not be made public.', 'zh-Hant':'你的內容不會公開。', ja:'あなたの内容が公開されることはありません。', ko:'작성하신 내용은 공개되지 않습니다.'} },
    { selector:'.prayer-box-privacy', mode:'leading-text', source:'我们会谨慎承接，只用于代祷与必要的关怀。', values:{en:'We will treat it with care, using it only for prayer and necessary support.', 'zh-Hant':'我們會謹慎承接，只用於代禱與必要的關懷。', ja:'祈りと必要なケアのためにのみ、慎重に取り扱います。', ko:'기도와 필요한 돌봄을 위해서만 신중하게 다룹니다.'} },
    { selector:'.prayer-box-submit', source:'提交祷告', values:{en:'Send prayer request', 'zh-Hant':'提交禱告', ja:'祈りを送信', ko:'기도 요청 보내기'} },
    { selector:'.prayer-box-success h2', source:'已经收到了。', values:{en:'Received.', 'zh-Hant':'已經收到了。', ja:'受け付けました。', ko:'기도 요청을 받았습니다.'} },
    { selector:'.prayer-box-success p', source:'会有一位步道带领人安静地承接这份祷告。愿你在前面的路上，得着平安与同行。', values:{en:'A BUDAO leader will receive your prayer request with care. May you find peace and companionship on the road ahead.', 'zh-Hant':'會有一位步道帶領人安靜地承接這份禱告。願你在前面的路上，得著平安與同行。', ja:'道行のリーダーが、あなたの祈りを大切に受け止めます。これからの道のりに、平安とともに歩む仲間がありますように。', ko:'BUDAO 인도자가 이 기도 제목을 소중히 받아 기도하겠습니다. 앞으로 걸어갈 길에 평안과 함께할 이들이 있기를 바랍니다.'} },
    { selector:'.prayer-box-return', source:'回到步道', values:{en:'Return to BUDAO', 'zh-Hant':'回到步道', ja:'道行に戻る', ko:'BUDAO로 돌아가기'} },
    { selector:'.footer-sister-links', mode:'attribute', attribute:'aria-label', source:'事工展示', values:{en:'Ministry stories', 'zh-Hant':'事工展示', ja:'活動の紹介', ko:'사역 소개'} },
    { selector:'footer .campfire-link:not(.spark-link)', source:'✦ 营火之地', values:{en:'✦ Campfire', 'zh-Hant':'✦ 營火之地', ja:'✦ キャンプファイヤー', ko:'✦ 모닥불 자리'} },
    { selector:'footer .campfire-link.spark-link', source:'❦ 路上星火', values:{en:'❦ Sparks', 'zh-Hant':'❦ 路上星火', ja:'❦ 道を照らす小さな灯', ko:'❦ 길 위의 불씨'} },
    { selector:'footer > p', mode:'leading-text', source:'© 2026 步道 budao.org', values:{en:'© 2026 BUDAO budao.org', 'zh-Hant':'© 2026 步道 budao.org', ja:'© 2026 道行 budao.org', ko:'© 2026 BUDAO budao.org'} }
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


  // Japanese faith declaration is an editorial DRAFT, not an approved publication.
  // Reuse the original four audio control spans and their listeners exactly.
  const proposedJapaneseCreed = 'これからの人生、主の道を歩み、右にも左にもそれず。';
  function previewJapaneseCreed(documentObject, locale) {
    if (locale !== 'ja' || !documentObject ||
        typeof documentObject.querySelector !== 'function') return false;
    const line = documentObject.querySelector('header .hero-line');
    if (!line || typeof line.textContent !== 'string' ||
        line.textContent.replace(/\s+/g, '') !== '余生行走，不偏左右') return false;
    const dsp = documentObject.getElementById('dspBtn');
    const play = documentObject.getElementById('playBtn');
    const prev = documentObject.getElementById('prevBtn');
    const next = documentObject.getElementById('nextBtn');
    if (![dsp, play, prev, next].every(el => el && el.parentElement === line) ||
        dsp.textContent !== '余' || play.textContent !== '走' ||
        prev.textContent !== '左' || next.textContent !== '右') return false;
    const leading = line.childNodes && line.childNodes[0];
    const beforePlay = dsp.nextSibling;
    const beforePrev = play.nextSibling;
    const afterNext = next.nextSibling;
    if (!leading || leading.nodeType !== 3 || leading.nodeValue.trim() !== '' ||
        !beforePlay || beforePlay.nodeType !== 3 || beforePlay.nodeValue !== '生行' ||
        !beforePrev || beforePrev.nodeType !== 3 ||
        beforePrev.nodeValue.replace(/\s+/g, '') !== '，不偏' ||
        !afterNext || afterNext.nodeType !== 3 || prev.nextSibling !== next ||
        !documentObject.createTextNode || !line.insertBefore || !line.style) return false;

    leading.nodeValue = '';
    dsp.textContent = 'これからの人生';
    beforePlay.nodeValue = '、主の道を';
    play.textContent = '歩み';
    beforePrev.nodeValue = '、\n';
    prev.textContent = '右';
    line.insertBefore(documentObject.createTextNode('にも'), next);
    next.textContent = '左';
    afterNext.nodeValue = 'にもそれず。';
    line.style.fontSize = 'clamp(12px, 1.45vw, 17px)';
    line.style.letterSpacing = '0.01em';
    line.style.whiteSpace = 'pre-line';
    return line.textContent.replace(/\s+/g, '') === proposedJapaneseCreed;
  }

  // Korean editorial draft of the shared faith declaration, using Korean
  // Christian idiom "좌로나 우로나 치우치지". This is authored prose, not a
  // verbatim Bible quotation. All four pre-existing audio controls survive.
  const proposedKoreanCreed =
    '남은 생애, 주님의 길을 걸으며,\n좌로나 우로나 치우치지 않겠습니다.';
  function previewKoreanCreed(documentObject, locale) {
    if (locale !== 'ko' || !documentObject ||
        typeof documentObject.querySelector !== 'function') return false;
    const line = documentObject.querySelector('header .hero-line');
    if (!line || typeof line.textContent !== 'string' ||
        line.textContent.replace(/\s+/g,'') !== '余生行走，不偏左右') return false;
    const dsp = documentObject.getElementById('dspBtn');
    const play = documentObject.getElementById('playBtn');
    const prev = documentObject.getElementById('prevBtn');
    const next = documentObject.getElementById('nextBtn');
    if (![dsp, play, prev, next].every(el => el && el.parentElement === line) ||
        dsp.textContent !== '余' || play.textContent !== '走' ||
        prev.textContent !== '左' || next.textContent !== '右') return false;
    const leading = line.childNodes && line.childNodes[0];
    const beforePlay = dsp.nextSibling;
    const beforePrev = play.nextSibling;
    const afterNext = next.nextSibling;
    if (!leading || leading.nodeType !== 3 || leading.nodeValue.trim() !== '' ||
        !beforePlay || beforePlay.nodeType !== 3 || beforePlay.nodeValue !== '生行' ||
        !beforePrev || beforePrev.nodeType !== 3 ||
        beforePrev.nodeValue.replace(/\s+/g,'') !== '，不偏' ||
        !afterNext || afterNext.nodeType !== 3 || prev.nextSibling !== next ||
        !documentObject.createTextNode || !line.insertBefore || !line.style) return false;
    leading.nodeValue = '';
    dsp.textContent = '남은 생애';
    beforePlay.nodeValue = ', 주님의 길을 ';
    play.textContent = '걸으며';
    beforePrev.nodeValue = ',\n';
    prev.textContent = '좌';
    line.insertBefore(documentObject.createTextNode('로나 '), next);
    next.textContent = '우';
    afterNext.nodeValue = '로나 치우치지 않겠습니다.';
    line.style.fontSize = 'clamp(12px, 1.45vw, 17px)';
    line.style.letterSpacing = '0.01em';
    line.style.whiteSpace = 'pre-line';
    return line.textContent === proposedKoreanCreed;
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
    }),
    ko: Object.freeze({
      '要放下尚未送出的内容吗？': '보내지 않은 기도 제목을 버리시겠습니까?',
      '正在送达…': '보내는 중…',
      '提交祷告': '기도 요청 보내기',
      '暂时没有送达，请稍后再试。': '기도 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
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
  // Homepage-only switch: three alternatives to the currently selected language.
  // Japanese is available in this isolated preview branch only.
  function configureHomeLanguageSwitch(windowObject, locale) {
    if (!windowObject || !windowObject.BudaoGlobal ||
        !windowObject.document || !windowObject.location ||
        windowObject.location.pathname !== '/home.html') return false;
    const wrap = windowObject.document.getElementById('homeLanguageSwitch');
    if (!wrap || wrap.tagName !== 'DIV' ||
        typeof wrap.querySelectorAll !== 'function') return false;
    const links = Array.from(wrap.querySelectorAll('a'));
    if (links.length !== 3 ||
        !links.every(link => typeof link.getAttribute === 'function' &&
          /^\/home\.html(?:\?[^#]*)?(?:#[-\w.%]*)?$/.test(link.getAttribute('href') || ''))) return false;
    const names = Object.freeze({
      'zh-Hans': ['简','切换至简体中文首页'],
      'zh-Hant': ['繁','切換至繁體中文首頁'],
      en: ['EN','Switch homepage to English'],
      ja: ['日','日本語のホームページに切り替える']
    });
    const languages = ['zh-Hans','zh-Hant','en','ja'];
    if (!languages.includes(locale)) return false;
    const prepared = languages.filter(lang => lang !== locale).map(lang => ({
      lang,label:names[lang][0],description:names[lang][1],
      href:windowObject.BudaoGlobal.languageLink('/home.html',
        windowObject.location.search, windowObject.location.hash, lang)
    }));
    if (prepared.some(target => !target.href)) return false;
    prepared.forEach((target,i) => {
      links[i].setAttribute('href', target.href);
      links[i].setAttribute('lang', target.lang);
      links[i].setAttribute('hreflang', target.lang);
      links[i].setAttribute('aria-label', target.description);
      links[i].textContent=target.label;
    });
    wrap.setAttribute('aria-label',
      locale === 'ja' ? 'ホームページの言語切り替え' :
      locale === 'en' ? 'Homepage languages' :
      locale === 'zh-Hant' ? '首頁語言切換' : '首页语言切换');
    return true;
  }
  // Full-width and vehicle/tablet navigation is balanced by the homepage's
  // six-column CSS grid at widths >=700px. Never impose flex-start above it.
  // English labels are longer than the original six Chinese labels. Keep the
  // site's single-row navigation, existing typography and links, but make the
  // English row horizontally scrollable on narrow screens rather than clipping
  // the first and last links. Never affects the original Chinese experience.
  function enableEnglishNarrowNavigation(windowObject, locale) {
    if (!['en','zh-Hant','ja'].includes(locale) || !windowObject || !windowObject.document ||
        typeof windowObject.matchMedia !== 'function') return false;
    const nav = windowObject.document.querySelector('body > nav');
    if (!nav || !nav.style || typeof nav.querySelectorAll !== 'function') return false;
    const expected = ['/home.html','/test.html','/tongxing.html','/tongdao.html','/what.html','/tonglu.html'];
    const anchors = Array.from(nav.querySelectorAll('a'));
    if (anchors.length !== expected.length ||
        !anchors.every((anchor,index) => anchor.getAttribute('href')?.split('?')[0] === expected[index])) return false;
    const mq = windowObject.matchMedia('(max-width: 699px)');
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
  // The Japanese reading is exposed to assistive technologies without
  // changing the BUDAO logo, lettering, event handlers or six navigation links.
  // translate=no discourages browser machine translation of the proper noun.
  function annotateJapaneseBrand(documentObject, locale) {
    if (locale !== 'ja' || !documentObject ||
        typeof documentObject.querySelector !== 'function') return false;
    const heading = documentObject.querySelector('header > h1');
    const navBrand = documentObject.querySelector('nav a[href="/test.html"]');
    if (!heading || !navBrand ||
        heading.textContent.trim() !== '道行' ||
        navBrand.textContent.trim() !== '道行' ||
        typeof heading.setAttribute !== 'function' ||
        typeof navBrand.setAttribute !== 'function') return false;
    for (const element of [heading, navBrand]) {
      element.setAttribute('translate', 'no');
      element.setAttribute('aria-label', '道行（みちゆき）');
    }
    return true;
  }
  // Homepage language hot-swap: reuse the SAME document, media element and DSP graph.
  // Capture authored source nodes before the initial translation; no audio objects change.
  let homeSourceSnapshot = null;
  function captureHomeSource(documentObject) {
    const items = entries.map(entry => {
      const element = documentObject.querySelector(entry.selector);
      if (!element) return null;
      if (entry.mode === 'attribute') {
        return { entry, element, value: element.getAttribute(entry.attribute) };
      }
      if (entry.mode === 'leading-text') {
        const node = Array.from(element.childNodes || [])
          .find(n => n.nodeType === 3 && n.nodeValue.trim() === entry.source);
        return node ? { entry, node, value: node.nodeValue } : null;
      }
      return element.children.length ? null : { entry, element, value: element.textContent };
    });
    const line = documentObject.querySelector('header .hero-line');
    const hero = line ? {
      line,
      originalNodes: Array.from(line.childNodes),
      values: Array.from(line.childNodes).map(node => node.nodeType === 3
        ? node.nodeValue : node.textContent),
      fontSize: line.style.fontSize,
      letterSpacing: line.style.letterSpacing,
      whiteSpace: line.style.whiteSpace
    } : null;
    const heading = documentObject.querySelector('header > h1');
    const brand = documentObject.querySelector('nav a[href="/test.html"]');
    const sourceLinks = Array.from(documentObject.querySelectorAll('a[href]'))
      .filter(a => /^\/home\.html(?:[?#]|$)/.test(a.getAttribute('href') || ''))
      .map(a => ({ element: a, href: a.getAttribute('href') }));
    return { items, hero, heading, brand, sourceLinks };
  }
  function restoreHomeSource(documentObject) {
    const snapshot = homeSourceSnapshot;
    if (!snapshot) return;
    // Restore exact original hero text nodes without replacing interactive spans.
    const hero = snapshot.hero;
    if (hero) {
      Array.from(hero.line.childNodes).forEach(node => {
        if (!hero.originalNodes.includes(node)) hero.line.removeChild(node);
      });
      hero.originalNodes.forEach((node, index) => {
        if (hero.line.childNodes[index] !== node) {
          hero.line.insertBefore(node, hero.line.childNodes[index] || null);
        }
        if (node.nodeType === 3) node.nodeValue = hero.values[index];
        else node.textContent = hero.values[index];
      });
      hero.line.style.fontSize = hero.fontSize;
      hero.line.style.letterSpacing = hero.letterSpacing;
      hero.line.style.whiteSpace = hero.whiteSpace;
    }
    snapshot.items.forEach(item => {
      if (!item) return;
      if (item.entry.mode === 'attribute') item.element.setAttribute(item.entry.attribute, item.value);
      else if (item.node) item.node.nodeValue = item.value;
      else item.element.textContent = item.value;
    });
    [snapshot.heading, snapshot.brand].forEach(element => {
      if (!element) return;
      element.removeAttribute('translate');
      element.removeAttribute('aria-label');
    });
    snapshot.sourceLinks.forEach(({element, href}) => element.setAttribute('href', href));
    if (documentObject.documentElement) documentObject.documentElement.lang = 'zh-Hans';
  }
  function applyHomepageLocale(locale) {
    if (!homeSourceSnapshot) return false;
    const chosen = root.BudaoGlobal.normalizeLocale(locale) || root.BudaoGlobal.SOURCE;
    restoreHomeSource(root.document);
    if (chosen !== root.BudaoGlobal.SOURCE) {
      root.BudaoGlobal.localize(root.document, chosen, entries);
      previewEnglishCreed(root.document, chosen);
      previewTraditionalCreed(root.document, chosen);
      previewJapaneseCreed(root.document, chosen);
      previewKoreanCreed(root.document, chosen);
      annotateJapaneseBrand(root.document, chosen);
      annotateKoreanBrand(root.document, chosen);
      root.BudaoGlobal.carryLocaleOnLinks(root.document, chosen, ['/home.html']);
    }
    enableHomeNavigationForLocale(root, chosen);
    configureHomeLanguageSwitch(root, chosen);
    return true;
  }
  // One media-query listener across any number of language changes.
  let navigationSync = null;
  function enableHomeNavigationForLocale(windowObject, locale) {
    if (!windowObject.matchMedia) return;
    const nav = windowObject.document.querySelector('body > nav');
    if (!nav) return;
    if (!navigationSync) {
      const mq = windowObject.matchMedia('(max-width: 699px)');
      navigationSync = () => {
        if (mq.matches && ['en','zh-Hant','ja'].includes(
          windowObject.BudaoGlobal.requestedLocale(windowObject.location.search))) {
          nav.style.overflowX = 'auto';
          nav.style.justifyContent = 'flex-start';
        } else {
          nav.style.removeProperty('overflow-x');
          nav.style.removeProperty('justify-content');
        }
      };
      if (typeof mq.addEventListener === 'function') mq.addEventListener('change', navigationSync);
    }
    navigationSync();
  }
  function onHomeLocaleClick(event) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey ||
        event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target && event.target.closest && event.target.closest('a');
    if (!anchor || !root.document.getElementById('homeLanguageSwitch').contains(anchor)) return;
    const href = anchor.getAttribute('href');
    if (!href || !/^\/home\.html(?:[?#]|$)/.test(href)) return;
    const next = new URL(href, root.location.href);
    if (next.origin !== root.location.origin || next.pathname !== root.location.pathname) return;
    const locale = root.BudaoGlobal.requestedLocale(next.search);
    event.preventDefault();
    if (next.href !== root.location.href) root.history.pushState(null, '', next.pathname + next.search + next.hash);
    applyHomepageLocale(locale);
  }
  function start() {
    if (!root.BudaoGlobal || !root.document || !root.location ||
        root.location.pathname !== '/home.html') return;
    homeSourceSnapshot = captureHomeSource(root.document);
    applyHomepageLocale(root.BudaoGlobal.requestedLocale(root.location.search));
    const switcher = root.document.getElementById('homeLanguageSwitch');
    if (switcher) switcher.addEventListener('click', onHomeLocaleClick);
    root.addEventListener('popstate', () =>
      applyHomepageLocale(root.BudaoGlobal.requestedLocale(root.location.search)));
  }
  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({ entries, start, runtimeCopy, previewEnglishCreed, approvedEnglishCreed, previewTraditionalCreed, previewJapaneseCreed, previewKoreanCreed, proposedKoreanCreed, annotateJapaneseBrand, annotateKoreanBrand, enableEnglishNarrowNavigation, configureHomeLanguageSwitch });
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, {once:true});
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);