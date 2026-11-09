/* BUDAO GLOBAL first integration: homepage editorial copy only.
 * Explicit preview: /home.html?lang=en or ?lang=zh-Hant
 * Preserves current HTML tree, CSS, hrefs, icons, animation and interactions.
 * These draft translations are not approved canonical international pages.
 */
(function (root) {
  'use strict';
  const entries = [
    { selector:'nav a[href="/home.html"]', source:'首页', values:{en:'Home', 'zh-Hant':'首頁'} },
    { selector:'nav a[href="/test.html"]', source:'步道', values:{en:'BUDAO', 'zh-Hant':'BUDAO'} },
    { selector:'nav a[href="/tongxing.html"]', source:'童行', values:{en:'Young Explorers', 'zh-Hant':'童行'} },
    { selector:'nav a[href="/tongdao.html"]', source:'同道', values:{en:'Companions', 'zh-Hant':'同道'} },
    { selector:'nav a[href="/what.html"]', source:'同工', values:{en:'Co-Laborers', 'zh-Hant':'同工'} },
    { selector:'nav a[href="/tonglu.html"]', source:'牧场', values:{en:'Pasture', 'zh-Hant':'牧場'} },
    { selector:'title', source:'步道 budao', values:{en:'BUDAO', 'zh-Hant':'BUDAO'} },
    { selector:'header > h1', source:'步道', values:{en:'BUDAO', 'zh-Hant':'BUDAO'} },
    { selector:'main section:nth-of-type(1) h2', source:'我们在做什么？', values:{en:'What do we do?', 'zh-Hant':'我們在做什麼？'} },
    { selector:'main section:nth-of-type(1) p', source:'健行于天地，相知于彼此，在旷野经历与祂的同在。', values:{en:'We walk the earth beneath the heavens, come to know one another, and encounter His presence in the wilderness.', 'zh-Hant':'健行於天地，相知於彼此，在曠野經歷與祂的同在。'} },
    { selector:'main section:nth-of-type(2) h2', source:'为什么是“步道”？', values:{en:'Why BUDAO?', 'zh-Hant':'為什麼是 BUDAO？'} },
    { selector:'main section:nth-of-type(2) p', source:'祂就是道路、真理、生命。唯有祂亲自感动你同行天路，共步主道。', values:{en:'He is the way, the truth, and the life. He alone can stir our hearts to journey heavenward together, following His way.', 'zh-Hant':'祂就是道路、真理、生命。唯有祂親自感動你同行天路，共步主道。'} },
    { selector:'main section:nth-of-type(3) h2', source:'“步道”有什么？', values:{en:'What will you find at BUDAO?', 'zh-Hant':'BUDAO 有什麼？'} },
    { selector:'main section:nth-of-type(3) p', mode:'leading-text', source:'· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 ·', values:{en:'· An embrace · A trail · A story · A passage of Scripture · ', 'zh-Hant':'· 一個擁抱 · 一條線路 · 一則故事 · 一段經文 · '} },
    { selector:'#prayerBoxTrigger', source:'一起祷告', values:{en:'Pray together', 'zh-Hant':'一起禱告'} },
    { selector:'footer > p', mode:'leading-text', source:'© 2026 步道 budao.org', values:{en:'© 2026 BUDAO budao.org', 'zh-Hant':'© 2026 BUDAO budao.org'} }
  ];
  // The private prayer dialog, animated Chinese slogan and decorative footer
  // remain unchanged pending separate content/theological/accessibility review.
  function start() {
    if (!root.BudaoGlobal || !root.document || !root.location) return;
    if (root.location.pathname !== '/home.html') return;
    const chosen = root.BudaoGlobal.requestedLocale(root.location.search);
    if (chosen === root.BudaoGlobal.SOURCE) return;
    root.BudaoGlobal.localize(root.document, chosen, entries);
  }
  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({ entries, start });
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, {once:true});
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);