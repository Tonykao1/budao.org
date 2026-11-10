/* BUDAO GLOBAL: fixed editorial copy on the core BUDAO overview page.
 * Opt-in preview only: /test.html?lang=en or ?lang=zh-Hant.
 * Dynamic activity cards, live schedules, sign-up notices, invitations
 * and user-generated content remain in their original language until reviewed.
 * No changes to visual composition, CSS, animation or data handling.
 */
(function (root) {
  'use strict';
  const entries = [
    { selector:'title', source:'步道', values:{en:'BUDAO','zh-Hant':'BUDAO'} },
    { selector:'nav a[href="/home.html"]', source:'首页', values:{en:'Home','zh-Hant':'首頁'} },
    { selector:'nav a[href="/test.html"]', source:'步道', values:{en:'BUDAO','zh-Hant':'BUDAO'} },
    { selector:'nav a[href="/tongxing.html"]', source:'童行', values:{en:'Young Explorers','zh-Hant':'童行'} },
    { selector:'nav a[href="/tongdao.html"]', source:'同道', values:{en:'Companions','zh-Hant':'同道'} },
    { selector:'nav a[href="/what.html"]', source:'同工', values:{en:'Fellow Workers','zh-Hant':'同工'} },
    { selector:'nav a[href="/tonglu.html"]', source:'牧场', values:{en:'Pasture','zh-Hant':'牧場'} },
    { selector:'.super-hero h1', source:'本周同行', values:{en:'Walking Together This Week','zh-Hant':'本週同行'} },
    { selector:'.super-hero p', mode:'leading-text', source:'有人仍在城市边缘继续向前走。', values:{en:'Some keep walking on the edges of the city.','zh-Hant':'有人仍在城市邊緣繼續向前走。'} },
    { selector:'.super-hero p', mode:'leading-text', source:'也有人，在不同国家与时区里，彼此同行。', values:{en:'Others walk together across countries and time zones.','zh-Hant':'也有人，在不同國家與時區裡，彼此同行。'} },
    { selector:'#budaoCalendar', mode:'attribute', attribute:'aria-label', source:'步道日历', values:{en:'BUDAO calendar','zh-Hant':'BUDAO 日曆'} },
    { selector:'.super-footer', mode:'leading-text', source:'世界仍有微光。', values:{en:'A glimmer of light remains in the world.','zh-Hant':'世界仍有微光。'} },
    { selector:'.super-footer', mode:'leading-text', source:'而有人，仍在路上。', values:{en:'And still, there are those who walk on.','zh-Hant':'而有人，仍在路上。'} },
    { selector:'.footer-sister-links', mode:'attribute', attribute:'aria-label', source:'事工展示', values:{en:'Ministry stories','zh-Hant':'事工展示'} },
    { selector:'footer .campfire-link:not(.spark-link)', source:'✦ 营火之地', values:{en:'✦ Campfire','zh-Hant':'✦ 營火之地'} },
    { selector:'footer .campfire-link.spark-link', source:'❦ 路上星火', values:{en:'❦ Sparks','zh-Hant':'❦ 路上星火'} },
    { selector:'footer > p', mode:'leading-text', source:'© 2026 步道 budao.org', values:{en:'© 2026 BUDAO budao.org','zh-Hant':'© 2026 BUDAO budao.org'} },
    { selector:'.qr-dialog', mode:'attribute', attribute:'aria-label', source:'报名码', values:{en:'Registration QR code','zh-Hant':'報名碼'} },
    { selector:'.qr-close', mode:'attribute', attribute:'aria-label', source:'关闭报名码', values:{en:'Close registration code','zh-Hant':'關閉報名碼'} },
    { selector:'#qrCaption', source:'扫码进群 · 即刻报名', values:{en:'Scan to join the group · Register now','zh-Hant':'掃碼進群 · 即刻報名'} }
  ];
  function start() {
    if (!root.document || !root.location || !root.BudaoGlobal ||
        root.location.pathname !== '/test.html') return;
    const chosen = root.BudaoGlobal.requestedLocale(root.location.search);
    if (chosen === root.BudaoGlobal.SOURCE) return;
    root.BudaoGlobal.localize(root.document, chosen, entries);
    root.BudaoGlobal.carryLocaleOnLinks(root.document, chosen, ['/home.html','/test.html']);
  }
  if (typeof module === 'object' && module.exports) module.exports = Object.freeze({entries,start});
  if (root.document) {
    if (root.document.readyState === 'loading')
      root.document.addEventListener('DOMContentLoaded',start,{once:true});
    else start();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
