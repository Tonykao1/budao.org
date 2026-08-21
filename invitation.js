(function(){
  function qs(q){return document.querySelector(q)}
  const loading = qs('#loading');
  const notfound = qs('#notfound');
  const invitationRoot = qs('#invitation-root');

  function getIdFromLocation(){
    const params = new URLSearchParams(location.search);
    const queryId = params.get('id') || '';
    if (isValidId(queryId)) return queryId;

    const pathMatch = String(location.pathname || '').match(/^\/i\/([^/]+)$/);
    if (!pathMatch) return queryId;

    try { return decodeURIComponent(pathMatch[1]); } catch (error) { return ''; }
  }

  function isValidId(id){ return /^[A-Za-z0-9]{4,64}$/.test(id); }

  async function fetchInvitation(id){
    const url = '/api/invitation?id=' + encodeURIComponent(id);
    const res = await fetch(url, { method: 'GET' });
    if (res.status === 404) return { status: 404 };
    if (!res.ok) return { status: res.status };
    try{ const body = await res.json(); return { status: res.status, body }; }catch(e){ return { status:500 } }
  }

  function showError(message){
    loading.hidden = true;
    notfound.hidden = false;
    notfound.textContent = message;
  }

  async function main(){
    const id = getIdFromLocation();
    if (!isValidId(id)){
      showError('无效的邀请标识。');
      return;
    }
    const result = await fetchInvitation(id);
    loading.hidden = true;
    if (result.status === 404){ showError('邀请未找到。'); return; }
    if (!result.body || !result.body.ok){ showError('服务暂时不可用，请稍后再试。'); return; }
    const inv = result.body.invitation;
    const modeB = window.BudaoInvitationModeB;
    if (!modeB || typeof modeB.snapshotToModeBViewModel !== 'function' || typeof modeB.renderModeB !== 'function'){
      showError('邀请暂时无法展开，请稍后再试。');
      return;
    }
    const viewModel = modeB.snapshotToModeBViewModel(inv);
    modeB.renderModeB(invitationRoot, viewModel);
    invitationRoot.hidden = false;
  }

  document.addEventListener('DOMContentLoaded', main);
})();
