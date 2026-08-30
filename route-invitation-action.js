(function(){
  // Minimal, safe module to create server-side Invitations for a route
  const IN_FLIGHT = new WeakMap();

  function findActionContainer(button){
    return button.closest('.route-actions') || button.parentElement || null;
  }

  function createResultNode(){
    const wrap = document.createElement('div');
    wrap.className = 'invitation-create-result';
    wrap.setAttribute('aria-live', 'polite');
    wrap.setAttribute('aria-atomic', 'true');
    return wrap;
  }

  function setProcessing(button, processing){
    button.disabled = processing;
    button.textContent = processing ? '正在封存步道…' : '封存步道';
  }

  function resultNodeFor(button){
    const container = findActionContainer(button);
    if(!container) return null;
    let result = container.querySelector('.invitation-create-result');
    if(!result){
      result = createResultNode();
      container.appendChild(result);
    }
    return result;
  }

  function showMessageOnCard(button, message){
    const result = resultNodeFor(button);
    if(!result) return;
    result.replaceChildren();
    const p = document.createElement('div');
    p.className = 'invitation-create-message';
    p.textContent = message;
    result.appendChild(p);
  }

  function buildActionButton(label, onClick){
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'invitation-create-action';
    b.textContent = label;
    b.addEventListener('click', onClick);
    return b;
  }

  function showSuccessOnCard(button, invitationUrl){
    const result = resultNodeFor(button);
    if(!result) return;
    result.replaceChildren();

    const message = document.createElement('div');
    message.className = 'invitation-create-message';
    message.textContent = '邀请页已创建';

    const actions = document.createElement('div');
    actions.className = 'invitation-create-result-actions';
    const feedback = document.createElement('div');
    feedback.className = 'invitation-create-feedback';
    feedback.setAttribute('aria-live', 'polite');

    const openBtn = buildActionButton('打开', ()=> window.open(invitationUrl, '_blank', 'noopener'));
    const copyBtn = buildActionButton('复制链接', async ()=>{
      try{
        if(navigator.clipboard && navigator.clipboard.writeText){
          await navigator.clipboard.writeText(invitationUrl);
          feedback.textContent = '链接已复制';
        } else {
          throw new Error('clipboard_unavailable');
        }
      }catch(e){
        feedback.textContent = '复制失败，请重试或使用“打开”。';
      }
    });

    actions.appendChild(openBtn);
    actions.appendChild(copyBtn);
    result.appendChild(message);
    result.appendChild(actions);
    result.appendChild(feedback);
  }

  async function handleCreate(button){
    if(IN_FLIGHT.get(button)) return; // already in flight for this button
    const idx = button.dataset.routeIndex;
    const routes = window.BudaoActiveRoutes || [];
    const route = routes[Number(idx)];
    if(!route){
      showMessageOnCard(button, '无法封存步道。');
      return;
    }
    const routeId = (typeof route.routeId === 'string' && route.routeId.trim()) ? route.routeId : (typeof route.id === 'string' ? route.id : '');
    if(!routeId){
      showMessageOnCard(button, '无法封存步道。');
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
          showMessageOnCard(button, '创建失败，请稍后再试。');
          return;
        }
        const invitationUrl = new URL('/i/' + encodeURIComponent(id), window.location.origin).href;
        showSuccessOnCard(button, invitationUrl);
      } else if (res.status === 400) {
        showMessageOnCard(button, '无法封存步道。');
      } else if (res.status === 401) {
        showMessageOnCard(button, '请先登录带领人账户。');
      } else if (res.status === 403) {
        showMessageOnCard(button, '你没有权限封存这条步道。');
      } else if (res.status === 404) {
        showMessageOnCard(button, '未找到这条路线。');
      } else if (res.status === 429) {
        showMessageOnCard(button, '操作过于频繁，请稍后再试。');
      } else if (res.status === 503) {
        showMessageOnCard(button, '邀请服务暂时不可用。');
      } else {
        showMessageOnCard(button, '创建失败，请稍后再试。');
      }
    }catch(e){
      showMessageOnCard(button, '创建失败，请稍后再试。');
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
