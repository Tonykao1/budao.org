(function(){
  function qs(q){return document.querySelector(q)}
  const loading = qs('#loading');
  const notfound = qs('#notfound');
  const article = qs('#invitation');
  const titleEl = qs('#title');
  const metaEl = qs('#meta');
  const imageWrap = qs('#image-wrap');
  const descEl = qs('#description');
  const meetingPlaceEl = qs('#meeting-place');
  const participationEl = qs('#participation');

  function safeText(el, text){ el.textContent = text || ''; }

  function getIdFromQuery(){
    const params = new URLSearchParams(location.search);
    return params.get('id') || '';
  }

  function isValidId(id){ return /^[A-Za-z0-9]{4,64}$/.test(id); }

  async function fetchInvitation(id){
    const url = '/api/invitation?id=' + encodeURIComponent(id);
    const res = await fetch(url, { method: 'GET' });
    if (res.status === 404) return { status: 404 };
    if (!res.ok) return { status: res.status };
    try{ const body = await res.json(); return { status: res.status, body }; }catch(e){ return { status:500 } }
  }

  function render(inv){
    safeText(titleEl, inv.facts.title || '');
    const metaParts = [inv.facts.location, inv.facts.date, inv.facts.time, inv.facts.timezone, inv.facts.duration, inv.facts.distance, inv.facts.elevation, inv.facts.difficulty].filter(Boolean);
    safeText(metaEl, metaParts.join(' · '));
    // meetingPlace: show quietly if present
    if (meetingPlaceEl) {
      if (inv.facts && typeof inv.facts.meetingPlace === 'string' && inv.facts.meetingPlace.trim()) {
        safeText(meetingPlaceEl, inv.facts.meetingPlace.trim());
        meetingPlaceEl.style.display = '';
      } else {
        meetingPlaceEl.style.display = 'none';
      }
    }
    if (inv.visual && typeof inv.visual.source === 'string' && inv.visual.source.startsWith('https://')){
      const img = document.createElement('img');
      img.src = inv.visual.source;
      img.alt = inv.facts.title || '';
      img.addEventListener('error', ()=>{ imageWrap.style.display='none' });
      imageWrap.appendChild(img);
    }
    safeText(descEl, inv.facts.description || '');

    // participation
    while (participationEl.firstChild) participationEl.removeChild(participationEl.firstChild);
    if (inv.participation && inv.participation.type === 'legacy_qr' && typeof inv.participation.artifact === 'string' && inv.participation.artifact.startsWith('https://')){
      const q = document.createElement('img');
      q.src = inv.participation.artifact;
      q.alt = 'QR';
      q.style.maxWidth = '240px';
      participationEl.appendChild(q);
    }
  }

  async function main(){
    const id = getIdFromQuery();
    if (!isValidId(id)){
      loading.style.display='none'; notfound.style.display='block'; notfound.textContent='无效的邀请标识。';
      return;
    }
    const result = await fetchInvitation(id);
    loading.style.display='none';
    if (result.status === 404){ notfound.style.display='block'; return; }
    if (!result.body || !result.body.ok){ notfound.style.display='block'; notfound.textContent='服务不可用或响应错误'; return; }
    const inv = result.body.invitation;
    render(inv);
    article.style.display='block';
  }

  document.addEventListener('DOMContentLoaded', main);
})();
