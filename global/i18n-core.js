/* BUDAO GLOBAL: opt-in, visual-preserving localization primitives.
 * No network calls, cookies, storage, DOM structure changes or CSS mutations.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BudaoGlobal = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const SOURCE = 'zh-Hans';
  const SUPPORTED = Object.freeze(['zh-Hans', 'zh-Hant', 'en']);
  function normalizeLocale(value) {
    const text = String(value || '').trim().replace(/_/g, '-').toLowerCase();
    if (text === 'zh-hant' || /^zh-(tw|hk|mo)(-|$)/.test(text) || text.startsWith('zh-hant-')) return 'zh-Hant';
    if (text === 'zh' || text === 'zh-hans' || /^zh-(cn|sg)(-|$)/.test(text) || text.startsWith('zh-hans-')) return SOURCE;
    if (text === 'en' || text.startsWith('en-')) return 'en';
    return null;
  }
  // This phase is explicit opt-in only. Never automatically redirect by IP or browser language.
  function requestedLocale(search) {
    try { return normalizeLocale(new URLSearchParams(search || '').get('lang')) || SOURCE; }
    catch (_) { return SOURCE; }
  }
  function safePage(pathname) {
    return typeof pathname === 'string' && /^\/(?:home|test|tongxing|tongdao|what|tonglu|yhzd|lsxh)\.html$/.test(pathname);
  }
  function languageLink(pathname, search, hash, target) {
    const locale = normalizeLocale(target);
    if (!safePage(pathname) || !locale) return null;
    let params;
    try { params = new URLSearchParams(search || ''); }
    catch (_) { return null; }
    if (locale === SOURCE) params.delete('lang');
    else params.set('lang', locale);
    const q = params.toString();
    return pathname + (q ? '?' + q : '') + (typeof hash === 'string' && /^#[-\w.%]*$/.test(hash) ? hash : '');
  }
  function localize(document, locale, entries) {
    const chosen = normalizeLocale(locale) || SOURCE;
    if (chosen === SOURCE || !document || !Array.isArray(entries)) return { changed: 0, skipped: 0 };
    let changed = 0;
    let skipped = 0;
    for (const entry of entries) {
      const value = entry && entry.values && entry.values[chosen];
      if (!entry || typeof value !== 'string' || typeof entry.source !== 'string') { skipped++; continue; }
      const el = document.querySelector(entry.selector);
      if (!el) { skipped++; continue; }
      if (entry.mode === 'leading-text') {
        // Changes only an existing text node; preserves interactive child elements.
        const node = Array.from(el.childNodes || []).find(n => n.nodeType === 3 && n.nodeValue.trim() === entry.source);
        if (!node) { skipped++; continue; }
        node.nodeValue = value;
      } else {
        // Never replace markup containing buttons, icons, spans or animations.
        if (el.children.length || el.textContent.trim() !== entry.source) { skipped++; continue; }
        el.textContent = value;
      }
      changed++;
    }
    if (changed && document.documentElement) document.documentElement.lang = chosen;
    return { changed, skipped };
  }
  return Object.freeze({ SOURCE, SUPPORTED, normalizeLocale, requestedLocale, safePage, languageLink, localize });
});