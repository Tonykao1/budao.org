/* BUDAO What's New — homepage only; dismiss by release ID, not by timer. */
(() => {
  'use strict';
  const STORAGE_KEY = 'budao:whats-new:seen:v1';
  const feedUrl = '/whats-new.json';
  const root = document.createElement('aside');
  root.className = 'budao-news';
  root.setAttribute('aria-label', '步道新事');
  document.body.appendChild(root);
  const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function readSeen() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function markSeen(ids) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set([...readSeen(),...ids])])); } catch {} }
  let items = [], open = false, archive = false, seen = readSeen();
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
  fetch(feedUrl, {cache:'no-store'}).then(r=>{if(!r.ok) throw new Error('News feed unavailable');return r.json();}).then(feed=>{
    const safeUrl = u => typeof u === 'string' && /^\/(?!\/)[a-zA-Z0-9/_#?&=.%~-]*$/.test(u);
    items = (Array.isArray(feed.items) ? feed.items : []).filter(x=>x && typeof x.id==='string' && typeof x.title==='string' && typeof x.description==='string' && safeUrl(x.url) && (x.type !== 'music' || (typeof x.track === 'string' && x.track.startsWith('music/') && x.track.endsWith('.mp3'))) && x.published===true).slice(0,50);
    if (!items.length) {root.remove();return;}
    open = items.some(item=>!seen.includes(item.id));
    render();
  }).catch(()=>{root.remove();});
})();
