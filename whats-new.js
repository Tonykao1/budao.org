/* BUDAO What's New — homepage only; dismiss by release ID, not by timer. */
(() => {
  'use strict';
  const STORAGE_KEY = 'budao:whats-new:seen:v1';
  const feedUrl = '/whats-new.json';
  const routeFeedUrl = '/api/routes?scope=calendar';
  const root = document.createElement('aside');
  root.className = 'budao-news';
  root.setAttribute('aria-label', '步道新事');
  document.body.appendChild(root);
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readSeen() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function markSeen(ids) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...readSeen(),...ids])])); } catch {} }
  let items = [], open = false, archive = false, seen = readSeen();

  function routeTimestamp(route) {
    if (!route || !/^\d{4}-\d{2}-\d{2}$/.test(String(route.date || '')) ||
        !/^([01]?\d|2[0-3]):[0-5]\d$/.test(String(route.time || ''))) return NaN;
    const timeZone = String(route.timezone || 'Asia/Shanghai');
    const parts = route.date.split('-').map(Number);
    const clock = route.time.split(':').map(Number);
    const nominal = Date.UTC(parts[0], parts[1] - 1, parts[2], clock[0], clock[1]);
    if (new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toISOString().slice(0, 10) !== route.date) return NaN;
    try {
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      });
      let result = nominal;
      for (let pass = 0; pass < 3; pass++) {
        const values = Object.fromEntries(formatter.formatToParts(new Date(result))
          .filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
        const represented = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute);
        result += nominal - represented;
      }
      return result;
    } catch { return NaN; }
  }

  function routeDurationMs(route) {
    const duration = String(route.duration || '').trim();
    const hours = duration.match(/(\d+(?:\.\d+)?)\s*(?:小时|小時|hours?|hrs?)/i);
    const minutes = duration.match(/(\d+(?:\.\d+)?)\s*(?:分钟|分鐘|minutes?|mins?)/i);
    if (!hours && !minutes) return 0;
    return ((hours ? Number(hours[1]) * 60 : 0) + (minutes ? Number(minutes[1]) : 0)) * 60000;
  }

  function routeNews(routes) {
    if (!Array.isArray(routes)) return [];
    const now = Date.now();
    const endOfWindow = now + 7 * 86400000;
    return routes.filter(route => route && route.status !== 'cancelled' &&
      route.status !== 'canceled' && !route.pending && typeof route.title === 'string' &&
      typeof (route.routeId || route.id) === 'string')
      .map(route => ({ route, startsAt: routeTimestamp(route) }))
      .filter(x => Number.isFinite(x.startsAt) && x.startsAt + routeDurationMs(x.route) > now && x.startsAt <= endOfWindow)
      .sort((a, b) => a.startsAt - b.startsAt)
      .slice(0, 2)
      .map(({ route }) => ({
        id: 'route:' + (route.routeId || route.id) + ':' + route.date,
        type: 'route',
        title: '即将同行 · ' + route.title,
        description: route.date.slice(5).replace('-', '月') + '日 ' + route.time + (route.city ? ' · ' + route.city : ''),
        url: '/test.html?route=' + encodeURIComponent(route.routeId || route.id),
        icon: '♧'
      }));
  }

  function applyNews(feed, routes) {
    const safeUrl = u => typeof u === 'string' && /^\/(?!\/)[a-zA-Z0-9/_#?&=.%~-]*$/.test(u);
    const staticItems = (Array.isArray(feed.items) ? feed.items : [])
      .filter(x => x && typeof x.id === 'string' && typeof x.title === 'string' &&
        typeof x.description === 'string' && safeUrl(x.url) &&
        (x.type !== 'music' || (typeof x.track === 'string' && x.track.startsWith('music/') &&
          x.track.endsWith('.mp3'))) && x.published === true);
    items = [...routeNews(routes), ...staticItems].slice(0, 50);
    if (!items.length) { root.remove(); return; }
    open = items.some(item => !seen.includes(item.id));
    render();
  }
  function render() {
    const unread = items.filter(item => !seen.includes(item.id));
    if (!open) {
      root.innerHTML = '<button class="budao-news__tab" type="button" aria-label="打开步道新事"><span class="budao-news__tab-icon" aria-hidden="true">❧</span><span>步道新事</span>' + (unread.length ? '<span class="budao-news__dot" aria-label="有新内容"></span>' : '') + '</button>';
      root.querySelector('button').addEventListener('click', () => { open = true; archive = false; root.classList.remove('is-hidden-on-scroll'); render(); });
      return;
    }
    const shown = archive ? items : (unread.length ? unread.slice(0,3) : items.slice(0,3));
    root.innerHTML = '<section class="budao-news__card" aria-label="步道新事"><div class="budao-news__top"><div><div class="budao-news__eyebrow">BUDAO / FIELD NOTES</div><h2 class="budao-news__heading">步道新事 <small>What\'s New</small></h2></div><button class="budao-news__close" type="button" aria-label="关闭便签">×</button></div><div class="budao-news__rule"></div><div class="budao-news__entries">' + shown.map(item => '<a class="budao-news__entry" href="' + escapeHtml(item.url) + '"><span class="budao-news__entry-icon" aria-hidden="true">' + escapeHtml(item.icon || '✧') + '</span><span><strong>' + escapeHtml(item.title) + '</strong><span>' + escapeHtml(item.description) + '</span></span></a>').join('') + '</div><div class="budao-news__rule"></div><div class="budao-news__foot"><button class="budao-news__archive" type="button">' + (archive ? '← 返回新事' : '翻看往期记录 →') + '</button><span class="budao-news__mark" aria-hidden="true">♧</span></div></section>';
    root.querySelector('.budao-news__close').addEventListener('click', () => { markSeen(shown.map(x=>x.id)); seen = readSeen(); open = false; render(); });
    root.querySelector('.budao-news__archive').addEventListener('click', () => { archive = !archive; render(); });
    root.querySelectorAll('.budao-news__entry').forEach((a, index) => a.addEventListener('click', (event) => {
      const entry = shown[index];
      markSeen([entry.id]);
      seen = readSeen();
      if (entry.type === 'music' && typeof entry.track === 'string' && typeof window.budaoPlayNewsTrack === 'function') {
        event.preventDefault();
        /* Keep the playback call within the user's direct click activation. */
        const playback = window.budaoPlayNewsTrack(entry.track);
        Promise.resolve(playback).then(found => {
          if (!found) window.location.assign(a.href);
        }).catch(() => window.location.assign(a.href));
        open = false;
        render();
      }
    }));
  }
  let lastScroll = window.scrollY;
  window.addEventListener('scroll', () => {
    if (open) return;
    const current = window.scrollY;
    root.classList.toggle('is-hidden-on-scroll', current > 180 && current > lastScroll + 3);
    lastScroll = current;
  }, {passive:true});
  Promise.all([
    fetch(feedUrl, {cache:'no-store'}).then(r => {
      if (!r.ok) throw new Error('news_unavailable');
      return r.json();
    }).catch(() => ({items: []})),
    fetch(routeFeedUrl, {cache:'no-store'}).then(r => {
      if (!r.ok) throw new Error('routes_unavailable');
      return r.json();
    }).catch(() => [])
  ]).then(([feed, routes]) => applyNews(feed, routes)).catch(() => root.remove());
})();
