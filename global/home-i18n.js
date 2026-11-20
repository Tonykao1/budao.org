/* BUDAO GLOBAL Japanese homepage editorial preview, alongside approved existing locales.
 * Japanese homepage brand approved: 道行（みちゆき）; other draft translations retain their existing review status.
 * Preserves current HTML tree, CSS, hrefs, icons, animation and interactions.
 * These draft translations are not approved canonical international pages.
 */
(function (root) {
  'use strict';
  const entries = [
    { selector:'nav a[href="/home.html"]', source:'首页', values:{en:'Home', 'zh-Hant':'首頁', ja:'ホーム', es:'Inicio'} },
    { selector:'nav a[href="/test.html"]', source:'步道', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'道行', es:'BUDAO'} },
    { selector:'nav a[href="/tongxing.html"]', source:'童行', values:{en:'Young Explorers', 'zh-Hant':'童行', ja:'子どもと歩む', es:'Niños en camino'} },
    { selector:'nav a[href="/tongdao.html"]', source:'同道', values:{en:'Companions', 'zh-Hant':'同道', ja:'ともに歩む', es:'Compañeros de camino'} },
    { selector:'nav a[href="/what.html"]', source:'同工', values:{en:'Fellow Workers', 'zh-Hant':'同工', ja:'ともに仕える人々', es:'Colaboradores'} },
    { selector:'nav a[href="/tonglu.html"]', source:'牧场', values:{en:'Pasture', 'zh-Hant':'牧場', ja:'牧場', es:'Pradera'} },
    { selector:'#dspBtn', mode:'attribute', attribute:'aria-label', source:'同行之声母带处理', values:{en:'Audio master processing', 'zh-Hant':'同行之聲母帶處理', ja:'同行の声：音声マスター処理', es:'Procesamiento de audio de las voces del camino'} },
    { selector:'title', source:'步道 budao', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'道行', es:'BUDAO'} },
    { selector:'header > h1', source:'步道', values:{en:'BUDAO', 'zh-Hant':'步道', ja:'道行', es:'BUDAO'} },
    { selector:'main section:nth-of-type(1) h2', source:'我们在做什么？', values:{en:'What do we do?', 'zh-Hant':'我們在做什麼？', ja:'私たちは何をしているのでしょうか？', es:'¿Qué hacemos?'} },
    { selector:'main section:nth-of-type(1) p', source:'健行于天地，相知于彼此，在旷野经历与祂的同在。', values:{en:'We walk the earth beneath the heavens, come to know one another, and encounter His presence in the wilderness.', 'zh-Hant':'健行於天地，相知於彼此，在曠野經歷與祂的同在。', ja:'空と大地の間を歩み、互いを知り、荒野で主の臨在に触れます。', es:'Caminamos entre el cielo y la tierra; nos conocemos unos a otros y experimentamos la presencia del Señor en el desierto.'} },
    { selector:'main section:nth-of-type(2) h2', source:'为什么是“步道”？', values:{en:'Why BUDAO?', 'zh-Hant':'為什麼是「步道」？', ja:'なぜ「道行」なのでしょうか？', es:'¿Por qué BUDAO?'} },
    { selector:'main section:nth-of-type(2) p', source:'祂就是道路、真理、生命。唯有祂亲自感动你同行天路，共步主道。', values:{en:'He is the way, the truth, and the life. He alone can stir our hearts to journey heavenward together, following His way.', 'zh-Hant':'祂就是道路、真理、生命。唯有祂親自感動你同行天路，共步主道。', ja:'イエス・キリストは道であり、真理であり、いのちです。主ご自身が私たちの心を動かしてくださるとき、私たちは天の御国を目指し、主の道をともに歩むのです。', es:'Él es el camino, la verdad y la vida. Solo Él puede conmover nuestros corazones para que caminemos juntos hacia su Reino, siguiendo su camino.'} },
    { selector:'main section:nth-of-type(3) h2', source:'“步道”有什么？', values:{en:'What will you find at BUDAO?', 'zh-Hant':'「步道」有什麼？', ja:'「道行」で何に出会える？', es:'¿Qué encontrarás en BUDAO?'} },
    { selector:'main section:nth-of-type(3) p', mode:'leading-text', source:'· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 ·', values:{en:'· EMBRACE · TRAIL · STORY · SCRIPTURE · ', 'zh-Hant':'· 一個擁抱 · 一條線路 · 一則故事 · 一段經文 · ', ja:'· 抱擁 · コース · 物語 · 聖句 · ', es:'· ABRAZO · SENDERO · HISTORIA · ESCRITURA · '} },
    { selector:'#prayerBoxTrigger', source:'一起祷告', values:{en:'PRAYER', 'zh-Hant':'一起禱告', ja:'祈り', es:'ORACIÓN'} },
    { selector:'.prayer-box-backdrop', mode:'attribute', attribute:'aria-label', source:'关闭一起祷告', values:{en:'Close prayer dialog', 'zh-Hant':'關閉一起禱告', ja:'祈りの画面を閉じる', es:'Cerrar la ventana de oración'} },
    { selector:'.prayer-box-close', mode:'attribute', attribute:'aria-label', source:'关闭', values:{en:'Close', 'zh-Hant':'關閉', ja:'閉じる', es:'Cerrar'} },
    { selector:'.prayer-box-header h2', source:'一起祷告', values:{en:'Pray Together', 'zh-Hant':'一起禱告', ja:'ともに祈る', es:'Oremos juntos'} },
    { selector:'.prayer-box-header p', source:'有什么想让我们陪你一起记念？', values:{en:'Is there something you would like us to remember in prayer?', 'zh-Hant':'有什麼想讓我們陪你一起記念？', ja:'私たちと一緒に祈ってほしいことはありますか？', es:'¿Hay algo por lo que quisieras que oráramos contigo?'} },
    { selector:'.prayer-box-sr-only', source:'代祷事项', values:{en:'Prayer request', 'zh-Hant':'代禱事項', ja:'祈ってほしいこと', es:'Petición de oración'} },
    { selector:'.prayer-box-options legend', source:'关于这份祷告', values:{en:'About your prayer request', 'zh-Hant':'關於這份禱告', ja:'この祈りについて', es:'Sobre esta petición'} },
    { selector:'.prayer-box-options label:nth-of-type(1) span', source:'仅由步道带领人阅读和代祷', values:{en:'Only BUDAO leaders may read this and pray for me', 'zh-Hant':'僅由步道帶領人閱讀和代禱', ja:'道行のリーダーだけが内容を読み、あなたのために祈ります', es:'Solo los líderes de BUDAO leerán esta petición y orarán por mí'} },
    { selector:'.prayer-box-options label:nth-of-type(2) span', source:'同意带领人邀请受托同工一起代祷', values:{en:'I agree that the leader may invite trusted fellow workers to pray too', 'zh-Hant':'同意帶領人邀請受託同工一起代禱', ja:'リーダーが信頼できる奉仕者にも祈りを依頼することに同意します', es:'Autorizo al líder a invitar a colaboradores de confianza a orar también por esta petición'} },
    { selector:'.prayer-box-reply-choice span', source:'希望带领人私下回应我', values:{en:'I would like a private reply from a BUDAO leader', 'zh-Hant':'希望帶領人私下回應我', ja:'リーダーから個別に返信を希望します', es:'Quiero recibir una respuesta privada de un líder'} },
    { selector:'.prayer-box-contact > span', source:'联系方式', values:{en:'Contact information', 'zh-Hant':'聯絡方式', ja:'連絡先', es:'Datos de contacto'} },
    { selector:'.prayer-box-contact > small', source:'仅在希望获得回应时填写', values:{en:'Only if you would like a reply', 'zh-Hant':'僅在希望獲得回應時填寫', ja:'返信をご希望の場合のみご記入ください', es:'Solo si deseas recibir una respuesta'} },
    { selector:'.prayer-box-privacy', mode:'leading-text', source:'你的内容不会公开。', values:{en:'Your request will not be made public.', 'zh-Hant':'你的內容不會公開。', ja:'あなたの内容が公開されることはありません。', es:'Tu petición no se hará pública.'} },
    { selector:'.prayer-box-privacy', mode:'leading-text', source:'我们会谨慎承接，只用于代祷与必要的关怀。', values:{en:'We will treat it with care, using it only for prayer and necessary support.', 'zh-Hant':'我們會謹慎承接，只用於代禱與必要的關懷。', ja:'祈りと必要なケアのためにのみ、慎重に取り扱います。', es:'La trataremos con cuidado y solo la usaremos para orar y ofrecer el acompañamiento necesario.'} },
    { selector:'.prayer-box-submit', source:'提交祷告', values:{en:'Send prayer request', 'zh-Hant':'提交禱告', ja:'祈りを送信', es:'Enviar petición'} },
    { selector:'.prayer-box-success h2', source:'已经收到了。', values:{en:'Received.', 'zh-Hant':'已經收到了。', ja:'受け付けました。', es:'La hemos recibido.'} },
    { selector:'.prayer-box-success p', source:'会有一位步道带领人安静地承接这份祷告。愿你在前面的路上，得着平安与同行。', values:{en:'A BUDAO leader will receive your prayer request with care. May you find peace and companionship on the road ahead.', 'zh-Hant':'會有一位步道帶領人安靜地承接這份禱告。願你在前面的路上，得著平安與同行。', ja:'道行のリーダーが、あなたの祈りを大切に受け止めます。これからの道のりに、平安とともに歩む仲間がありますように。', es:'Un líder de BUDAO acogerá esta petición en oración con discreción. Que encuentres paz y compañía en el camino que tienes por delante.'} },
    { selector:'.prayer-box-return', source:'回到步道', values:{en:'Return to BUDAO', 'zh-Hant':'回到步道', ja:'道行に戻る', es:'Volver a BUDAO'} },
    { selector:'.footer-sister-links', mode:'attribute', attribute:'aria-label', source:'事工展示', values:{en:'Ministry stories', 'zh-Hant':'事工展示', ja:'活動の紹介', es:'Nuestros ministerios'} },
    { selector:'footer .campfire-link:not(.spark-link)', source:'✦ 营火之地', values:{en:'✦ Campfire', 'zh-Hant':'✦ 營火之地', ja:'✦ キャンプファイヤー', es:'✦ La hoguera'} },
    { selector:'footer .campfire-link.spark-link', source:'❦ 路上星火', values:{en:'❦ Sparks', 'zh-Hant':'❦ 路上星火', ja:'❦ 道を照らす小さな灯', es:'❦ Chispas del camino'} },
    { selector:'footer > p', mode:'leading-text', source:'© 2026 步道 budao.org', values:{en:'© 2026 BUDAO budao.org', 'zh-Hant':'© 2026 步道 budao.org', ja:'© 2026 道行 budao.org', es:'© 2026 BUDAO budao.org'} }
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


  // Spanish homepage declaration is an editorial draft. It preserves all four
  // original music-control spans and never changes their handlers.
  const proposedSpanishCreed =
    'Hasta el último día, andaremos por su camino; sin desviarnos ni a la izquierda ni a la derecha.';
  function previewSpanishCreed(documentObject, locale) {
    if (locale !== 'es' || !documentObject ||
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
    dsp.textContent = 'Hasta';
    beforePlay.nodeValue = ' el último día, ';
    play.textContent = 'andaremos';
    beforePrev.nodeValue = ' por su camino;\nsin desviarnos ni a la ';
    prev.textContent = 'izquierda';
    line.insertBefore(documentObject.createTextNode(' ni a la '), next);
    next.textContent = 'derecha';
    afterNext.nodeValue = '.';
    line.style.fontSize = 'clamp(12px, 1.35vw, 16px)';
    line.style.letterSpacing = '0.01em';
    line.style.whiteSpace = 'pre-line';
    return line.textContent.replace(/\s+/g, ' ').trim() === proposedSpanishCreed;
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
    es: Object.freeze({
      '要放下尚未送出的内容吗？': '¿Deseas descartar tu petición de oración sin enviar?',
      '正在送达…': 'Enviando…',
      '提交祷告': 'Enviar petición',
      '暂时没有送达，请稍后再试。': 'No se pudo enviar tu petición. Inténtalo de nuevo más tarde.'
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
    if (links.length !== 4 ||
        !links.every(link => typeof link.getAttribute === 'function' &&
          /^\/home\.html(?:\?[^#]*)?(?:#[-\w.%]*)?$/.test(link.getAttribute('href') || ''))) return false;
    const names = Object.freeze({
      'zh-Hans': ['简','切换至简体中文首页'],
      'zh-Hant': ['繁','切換至繁體中文首頁'],
      en: ['EN','Switch homepage to English'],
      ja: ['日','日本語のホームページに切り替える'],
      es: ['ES','Cambiar a la página de inicio en español']
    });
    const languages = ['zh-Hans','zh-Hant','en','ja','es'];
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
      locale === 'es' ? 'Idiomas de la página de inicio' :
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
    if (!['en','zh-Hant','ja','es'].includes(locale) || !windowObject || !windowObject.document ||
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
  // BUDAO is an international proper name, never a machine-translated word.
  // Source guard keeps existing Chinese, Traditional, English, Japanese untouched.
  function annotateSpanishBrand(documentObject, locale) {
    if (locale !== 'es' || !documentObject ||
        typeof documentObject.querySelector !== 'function') return false;
    const heading = documentObject.querySelector('header > h1');
    const navBrand = documentObject.querySelector('nav a[href="/test.html"]');
    if (!heading || !navBrand || heading.textContent.trim() !== 'BUDAO' ||
        navBrand.textContent.trim() !== 'BUDAO' ||
        typeof heading.setAttribute !== 'function' ||
        typeof navBrand.setAttribute !== 'function') return false;
    for (const element of [heading, navBrand]) {
      element.setAttribute('translate','no');
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
      previewSpanishCreed(root.document, chosen);
      annotateJapaneseBrand(root.document, chosen);
      annotateSpanishBrand(root.document, chosen);
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
        if (mq.matches && ['en','zh-Hant','ja','es'].includes(
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
  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({ entries, start, runtimeCopy, previewEnglishCreed, approvedEnglishCreed, previewTraditionalCreed, previewJapaneseCreed, previewSpanishCreed, proposedSpanishCreed, annotateJapaneseBrand, annotateSpanishBrand, enableEnglishNarrowNavigation, configureHomeLanguageSwitch });
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, {once:true});
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);