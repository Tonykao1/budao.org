(function(){
  // Minimal, safe module to create server-side Invitations for a route
  const IN_FLIGHT = new WeakMap();

  function findActionContainer(button){
    return button.closest('.route-actions') || button.parentElement || null;
  }

  function createResultNode(){
    const wrap = document.createElement('div');
    wrap.className = 'invitation-create-result';
    wrap.style.marginTop = '6px';
    wrap.style.fontSize = '0.95em';
    return wrap;
  }

  function setProcessing(button, processing){
    button.disabled = processing;
    button.textContent = processing ? '正在生成邀请…' : '生成邀请';
  }

  function showMessageOnCard(button, message, actions){
    const container = findActionContainer(button);
    if(!container) return;
    let result = container.querySelector('.invitation-create-result');
    if(!result){
      result = createResultNode();
      container.appendChild(result);
    }
    // clear children safely
    result.replaceChildren();
    const p = document.createElement('div');
    p.textContent = message;
    result.appendChild(p);
    if(Array.isArray(actions)){
      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '6px';
      actions.forEach(a=> btnRow.appendChild(a));
      result.appendChild(btnRow);
    }
  }

  function buildActionButton(label, onClick){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'invitation-create-action';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  async function handleCreate(button){
    if(IN_FLIGHT.get(button)) return; // already in flight for this button
    const idx = button.dataset.routeIndex;
    const routes = window.BudaoActiveRoutes || [];
    const route = routes[Number(idx)];
    if(!route){
      showMessageOnCard(button, '无法生成邀请。');
      return;
    }
    const routeId = (typeof route.routeId === 'string' && route.routeId.trim()) ? route.routeId : (typeof route.id === 'string' ? route.id : '');
    if(!routeId){
      showMessageOnCard(button, '无法生成邀请。');
      return;
    }

    try{
      IN_FLIGHT.set(button, true);
      setProcessing(button, true);

      const res = await fetch('/api/invitation', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routeId })
      });

      if (res.status === 201 || res.ok) {
        const body = await res.json();
        const id = body && body.id;
        if (!id) {
          showMessageOnCard(button, '生成失败，请稍后再试。');
          return;
        }
        const invitationUrl = new URL('/i/' + encodeURIComponent(id), window.location.origin).href;
        const openBtn = buildActionButton('打开邀请', ()=> window.open(invitationUrl, '_blank', 'noopener'));
        const copyBtn = buildActionButton('复制链接', async ()=>{
          try{
            if(navigator.clipboard && navigator.clipboard.writeText){
              await navigator.clipboard.writeText(invitationUrl);
            } else {
              throw new Error('clipboard_unavailable');
            }
          }catch(e){
            showMessageOnCard(button, '复制失败，请手动打开邀请。');
          }
        });
        showMessageOnCard(button, '邀请已生成', [openBtn, copyBtn]);
      } else if (res.status === 400) {
        showMessageOnCard(button, '无法生成邀请。');
      } else if (res.status === 401) {
        showMessageOnCard(button, '请先登录带领人账户。');
      } else if (res.status === 403) {
        showMessageOnCard(button, '你没有权限为这条路线生成邀请。');
      } else if (res.status === 404) {
        showMessageOnCard(button, '未找到这条路线。');
      } else if (res.status === 429) {
        showMessageOnCard(button, '操作过于频繁，请稍后再试。');
      } else if (res.status === 503) {
        showMessageOnCard(button, '邀请服务暂时不可用。');
      } else {
        showMessageOnCard(button, '生成失败，请稍后再试。');
      }
    }catch(e){
      showMessageOnCard(button, '生成失败，请稍后再试。');
    }finally{
      IN_FLIGHT.set(button, false);
      setProcessing(button, false);
    }
  }

  function onClick(e){
    const button = e.target.closest && e.target.closest('.invitation-create');
    if(!button) return;
    e.preventDefault();
    handleCreate(button);
  }

  // bind once
  if (typeof document !== 'undefined'){
    document.addEventListener('click', onClick, false);
  }

})();
