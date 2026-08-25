import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';

function makeDOM(){
  class Elem {
    constructor(tag){
      this.tag = tag;
      this.className = '';
      this.dataset = {};
      this.children = [];
      this.parentElement = null;
      this.style = {};
      this.disabled = false;
      this.textContent = '';
      this._listeners = {};
    }
    appendChild(c){ c.parentElement = this; this.children.push(c); }
    replaceChildren(...nodes){ this.children = []; for(const n of nodes){ this.appendChild(n); } }
    querySelector(sel){
      const cls = sel && sel.startsWith('.') ? sel.slice(1) : null;
        for(const c of this.children){
          if(cls && c.className && c.className.split(' ').includes(cls)) return c;
          // recursive search
          if(c.querySelector){ const nested = c.querySelector(sel); if(nested) return nested; }
        }
      return null;
    }
    setAttribute(k,v){ this[k]=v }
    closest(selector){
      if(!selector) return null;
      const cls = selector.startsWith('.') ? selector.slice(1) : selector;
      let cur = this;
      while(cur){ if(cur.className && cur.className.split(' ').includes(cls)) return cur; cur = cur.parentElement; }
      return null;
    }
    addEventListener(ev, fn){ this._listeners[ev] = this._listeners[ev] || []; this._listeners[ev].push(fn); }
    click(){ const handlers = this._listeners.click || []; for(const h of handlers){ h.call(this, { target: this, preventDefault: ()=>{} }); } }
  }

  const listeners = {};
  const document = {
    createElement: (tag)=> new Elem(tag),
    addEventListener: (ev,fn)=> { listeners[ev]=fn; },
    _dispatchClick: (event)=> { if(listeners.click) listeners.click(event); }
  };
  return { document, Elem, dispatchClick: (evt)=> document._dispatchClick(evt) };
}

describe('Invitation Flow behavior tests', ()=>{
  let dom;
  let routeActionCode;
  beforeEach(()=>{
    // prepare a fresh minimal DOM and globals
    dom = makeDOM();
    global.document = dom.document;
    global.window = { location: { origin: 'https://example.test' }, open: ()=>{} };
    try{
      Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async ()=>{} } }, configurable: true, writable: true });
    }catch(e){
      global.navigator = global.navigator || { clipboard: { writeText: async ()=>{} } };
    }
    // load script into this context
    routeActionCode = fs.readFileSync(new URL('../route-invitation-action.js', import.meta.url),'utf8');
    // run in current global context so script binds to our document
    vm.runInThisContext(routeActionCode, { filename: 'route-invitation-action.js' });
  });

  it('builds routeId from BudaoActiveRoutes and posts correct request', async ()=>{
    let fetchCalled = 0;
    let lastRequest = null;
    // mock fetch that resolves after a tick
    global.fetch = async (url, opts)=>{
      fetchCalled++;
      lastRequest = { url, opts, body: opts && opts.body };
      return { status:201, ok:true, json: async ()=>({ ok:true, id: 'ABCD1234' }) };
    };

    // prepare route and button
    const route = { routeId: 'route-xyz', id: 'legacy' };
    global.window.BudaoActiveRoutes = [route];
    const actions = document.createElement('div'); actions.className='route-actions';
    const button = document.createElement('button'); button.className='invitation-create'; button.dataset.routeIndex='0'; button.textContent='创建邀请页';
    actions.appendChild(button);

    // dispatch click
    dom.dispatchClick({ target: button, preventDefault: ()=>{} });

    // allow microtasks
    await new Promise(r=>setTimeout(r,0));

    assert.strictEqual(fetchCalled, 1, 'fetch should be called once');
    assert.ok(lastRequest.url.includes('/api/invitation'));
    assert.strictEqual(lastRequest.opts.method, 'POST');
    assert.strictEqual(lastRequest.opts.credentials, 'same-origin');
    const parsed = JSON.parse(lastRequest.body);
    assert.deepStrictEqual(parsed, { routeId: 'route-xyz' });
    assert.deepStrictEqual(Object.keys(parsed).sort(), ['routeId']);
  });

  it('disables button while request in-flight and prevents double submit', async ()=>{
    let resolveFetch;
    let fetchCalls = 0;
    global.fetch = (url, opts)=>{
      fetchCalls++;
      return new Promise((res)=>{ resolveFetch = ()=> res({ status:201, ok:true, json: async ()=>({ ok:true, id:'ID1' }) }); });
    };
    const route = { routeId: 'r1' };
    global.window.BudaoActiveRoutes = [route];
    const actions = document.createElement('div'); actions.className='route-actions';
    const button = document.createElement('button'); button.className='invitation-create'; button.dataset.routeIndex='0'; button.textContent='创建邀请页';
    actions.appendChild(button);

    dom.dispatchClick({ target: button, preventDefault: ()=>{} });
    // immediately dispatch again
    dom.dispatchClick({ target: button, preventDefault: ()=>{} });
    // during flight, button should be disabled
    assert.strictEqual(button.disabled, true);
    assert.strictEqual(button.textContent, '正在创建邀请页…');
    // resolve fetch
    resolveFetch();
    await new Promise(r=>setTimeout(r,0));
    // now fetchCalls should be 1 and button restored
    assert.strictEqual(fetchCalls, 1);
    assert.strictEqual(button.disabled, false);
    assert.strictEqual(button.textContent, '创建邀请页');
  });

  it('maps error status codes to messages and shows copy/open UI on success', async ()=>{
    const route = { routeId: 'r2' };
    global.window.BudaoActiveRoutes = [route];
    const actions = document.createElement('div'); actions.className='route-actions';
    const button = document.createElement('button'); button.className='invitation-create'; button.dataset.routeIndex='0'; button.textContent='创建邀请页';
    actions.appendChild(button);

    // helper to run mock response and return displayed text
    async function runWithResponse(response){
      global.fetch = async ()=> response;
      dom.dispatchClick({ target: button, preventDefault: ()=>{} });
      await new Promise(r=>setTimeout(r,0));
      const result = actions.querySelector('.invitation-create-result');
      return result && result.children[0] && result.children[0].textContent;
    }

    let txt;
    txt = await runWithResponse({ status:400, ok:false });
    assert.strictEqual(txt, '无法创建邀请页。');
    txt = await runWithResponse({ status:401, ok:false });
    assert.strictEqual(txt, '请先登录带领人账户。');
    txt = await runWithResponse({ status:403, ok:false });
    assert.strictEqual(txt, '你没有权限为这条路线创建邀请页。');
    txt = await runWithResponse({ status:404, ok:false });
    assert.strictEqual(txt, '未找到这条路线。');
    txt = await runWithResponse({ status:429, ok:false });
    assert.strictEqual(txt, '操作过于频繁，请稍后再试。');
    txt = await runWithResponse({ status:503, ok:false });
    assert.strictEqual(txt, '邀请服务暂时不可用。');
    txt = await runWithResponse({ status:500, ok:false });
    assert.strictEqual(txt, '创建失败，请稍后再试。');

    // success case: use a fresh container/button to avoid previous state
    global.fetch = async ()=>({ status:201, ok:true, json: async ()=>({ ok:true, id: 'ID 123' }) });
    let opened = null; global.window.open = (url, target, features)=>{ opened = { url, target, features }; };
    let copied = null; global.navigator.clipboard = { writeText: async (t)=>{ copied = t; } };
    const actions2 = document.createElement('div'); actions2.className='route-actions';
    const button2 = document.createElement('button'); button2.className='invitation-create'; button2.dataset.routeIndex='0'; button2.textContent='创建邀请页';
    actions2.appendChild(button2);
    dom.dispatchClick({ target: button2, preventDefault: ()=>{} });
    await new Promise(r=>setTimeout(r,0));
    const res = actions2.querySelector('.invitation-create-result');
    assert.strictEqual(res && res.children[0] && res.children[0].textContent, '邀请页已创建');
    assert.strictEqual(res.children[1].children[0].textContent, '打开');
    assert.strictEqual(res.children[1].children[1].textContent, '复制链接');
    // find open and copy buttons
    const openBtn = res.querySelector && res.querySelector('.invitation-create-action');
    // trigger open via click on first action
    if(opened === null){
      // click first button node
      const btn = res.children[1] && res.children[1].children[0];
      if(btn) btn.click && btn.click();
    }
    assert.ok(opened, 'window.open should have been called');
    assert.strictEqual(opened.target, '_blank');
    assert.strictEqual(typeof opened.features, 'string');
    assert.strictEqual(opened.features.includes('noopener'), true);
    // click copy
    const copyBtn = res.children[1] && res.children[1].children[1];
    if(copyBtn && copyBtn.click){ copyBtn.click(); }
    await new Promise(r=>setTimeout(r,0));
    assert.ok(copied && copied.startsWith(global.window.location.origin));
    assert.strictEqual(res.children[2].textContent, '链接已复制');

    // clipboard reject case: ensure UI shows stable failure message
    // use a fresh create to isolate
    global.fetch = async ()=>({ status:201, ok:true, json: async ()=>({ ok:true, id: 'ID_FAILCOPY' }) });
    let copiedArg = null; let clipboardCalled = false;
    global.navigator.clipboard = { writeText: async (t)=>{ clipboardCalled = true; copiedArg = t; return Promise.reject(new Error('boom')); } };
    const actions3 = document.createElement('div'); actions3.className='route-actions';
    const button3 = document.createElement('button'); button3.className='invitation-create'; button3.dataset.routeIndex='0'; button3.textContent='创建邀请页';
    actions3.appendChild(button3);
    dom.dispatchClick({ target: button3, preventDefault: ()=>{} });
    await new Promise(r=>setTimeout(r,0));
    const res3 = actions3.querySelector('.invitation-create-result');
    assert.strictEqual(res3 && res3.children[0] && res3.children[0].textContent, '邀请页已创建');
    const copyBtn3 = res3.children[1] && res3.children[1].children[1];
    if(copyBtn3 && copyBtn3.click){ copyBtn3.click(); }
    await new Promise(r=>setTimeout(r,0));
    assert.strictEqual(clipboardCalled, true);
    assert.ok(copiedArg && copiedArg.startsWith(global.window.location.origin));
    // Clipboard failure must preserve the permanent URL actions and success state.
    const failState = actions3.querySelector('.invitation-create-result');
    assert.strictEqual(failState.children[0].textContent, '邀请页已创建');
    assert.strictEqual(failState.children[1].children[0].textContent, '打开');
    assert.strictEqual(failState.children[1].children[1].textContent, '复制链接');
    assert.strictEqual(failState.children[2].textContent, '复制失败，请重试或使用“打开”。');
  });

  it('does not call fetch when routeId missing', async ()=>{
    let calls = 0; global.fetch = async ()=>{ calls++; return { status:500, ok:false }; };
    global.window.BudaoActiveRoutes = [{}];
    const button = document.createElement('button'); button.className='invitation-create'; button.dataset.routeIndex='0';
    dom.dispatchClick({ target: button, preventDefault: ()=>{} });
    await new Promise(r=>setTimeout(r,0));
    assert.strictEqual(calls, 0);
    const actions = document.createElement('div'); actions.className='route-actions'; actions.appendChild(button);
    const res = actions.querySelector('.invitation-create-result');
    // result should be present in actual container; since we didn't attach, just ensure no fetch
  });

  it('allows generating a second invitation for the same route (1:N)', async ()=>{
    // prepare sequential fetch: first pending then resolved, second resolved immediately
    let calls = 0;
    const records = [];
    let resolveFirst;
    global.fetch = (url, opts)=>{
      calls++;
      records.push({ url, opts, body: opts && opts.body });
      if(calls === 1){
        return new Promise((res)=>{ resolveFirst = ()=> res({ status:201, ok:true, json: async ()=>({ ok:true, id: 'FIRST123' }) }); });
      }
      return Promise.resolve({ status:201, ok:true, json: async ()=>({ ok:true, id: 'SECOND456' }) });
    };

    const route = { routeId: 'same-route', id: 'legacy' };
    global.window.BudaoActiveRoutes = [route];
    const actions = document.createElement('div'); actions.className='route-actions';
    const button = document.createElement('button'); button.className='invitation-create'; button.dataset.routeIndex='0'; button.textContent='创建邀请页';
    actions.appendChild(button);

    // first click -> pending
    dom.dispatchClick({ target: button, preventDefault: ()=>{} });
    // ensure pending state
    assert.strictEqual(button.disabled, true);

    // resolve first
    resolveFirst();
    await new Promise(r=>setTimeout(r,0));
    // after first completes
    assert.strictEqual(button.disabled, false);
    assert.strictEqual(button.textContent, '创建邀请页');

    // second click -> immediate second fetch
    // prepare clipboard capture to verify second invitation URL later
    let copiedArg = null; global.navigator.clipboard = { writeText: async (t)=>{ copiedArg = t; return Promise.resolve(); } };
    dom.dispatchClick({ target: button, preventDefault: ()=>{} });
    await new Promise(r=>setTimeout(r,0));

    assert.strictEqual(calls, 2);
    // both bodies strict equal { routeId }
    const b1 = JSON.parse(records[0].body);
    const b2 = JSON.parse(records[1].body);
    assert.deepStrictEqual(b1, { routeId: 'same-route' });
    assert.deepStrictEqual(b2, { routeId: 'same-route' });
    assert.deepStrictEqual(Object.keys(b1).sort(), ['routeId']);

    // verify latest UI copies SECOND456 when clicking its copy button
    const res = actions.querySelector('.invitation-create-result');
    assert.strictEqual(res && res.children[0] && res.children[0].textContent, '邀请页已创建');
    const copyBtn = res.children[1] && res.children[1].children[1];
    if(copyBtn && copyBtn.click){ copyBtn.click(); }
    await new Promise(r=>setTimeout(r,0));
    assert.ok(copiedArg && copiedArg.endsWith('SECOND456'));

    // ensure route object unchanged (no added invitation fields)
    assert.ok(route.routeId === 'same-route' && route.id === 'legacy');
  });

  it('keeps Share Artifact and permanent Invitation actions semantically independent', ()=>{
    const html = fs.readFileSync(new URL('../test.html', import.meta.url), 'utf8');
    assert.match(html, /class="invitation-trigger"[^>]*>分享邀请<\/button>/);
    assert.match(html, /class="invitation-create"[^>]*>创建邀请页<\/button>/);
    assert.ok(!/class="[^"]*invitation-create[^"]*invitation-trigger/.test(html));
    assert.ok(!routeActionCode.includes('BudaoInvitationShareModeB'));
    assert.ok(!routeActionCode.includes('BudaoInvitationEngine'));
  });

  it('keeps desktop and 375/430 action layouts within the shared pill contract', ()=>{
    const css = fs.readFileSync(new URL('../invitation-engine.css', import.meta.url), 'utf8');
    assert.match(css, /\.invitation-trigger,\s*\.invitation-create\s*\{/);
    assert.match(css, /\.route-actions\s*\{[^}]*flex-wrap:wrap/s);
    assert.match(css, /\.invitation-create-result\s*\{[^}]*flex:0 0 100%[^}]*min-width:0/s);
    assert.match(css, /@media\(max-width:620px\)[\s\S]*\.invitation-trigger,[\s\S]*\.invitation-create\s*\{[^}]*min-height:44px/);
    assert.match(css, /\.invitation-create-result\s*\{[^}]*max-width:100%/s);
  });
});
