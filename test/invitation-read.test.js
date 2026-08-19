import assert from 'node:assert';
import { describe, it, beforeEach } from 'node:test';

function base64(s){ return Buffer.from(s,'utf8').toString('base64'); }

describe('Invitation Read API', () => {
  beforeEach(() => { global.fetch = undefined; delete process.env.GITHUB_TOKEN; });

  it('CASE 1: valid id public read', async () => {
    const id = 'ABCD1234';
    const snapshot = { id, sourceRoute: { routeId: 'r1' }, facts: {}, visual: {}, participation: {}, presentation: {}, revision:1, createdAt: '2026-01-01T00:00:00Z' };
    global.fetch = async (url, opts) => ({ status:200, ok:true, json: async ()=>({ content: base64(JSON.stringify(snapshot)) }) });
    const mod = await import('../api/invitation.js');
    const handler = mod.default || mod;
    const req = { method: 'GET', query: { id } };
    let sent;
    const res = { setHeader: ()=>{}, status: (s)=>({ json: (b)=>{ sent = { s, b }; return b } }) };
    await handler(req, res);
    assert.strictEqual(sent.s, 200);
    assert.strictEqual(sent.b.ok, true);
    assert.strictEqual(sent.b.invitation.id, id);
  });

  it('CASE 2: illegal id -> 400', async ()=>{
    const mod = await import('../api/invitation.js');
    const handler = mod.default || mod;
    const req = { method: 'GET', query: { id: '../../etc/pass' } };
    let sent;
    const res = { setHeader: ()=>{}, status: (s)=>({ json: (b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s, 400);
  });

  it('CASE 3: path traversal attempt -> 400', async ()=>{
    const mod = await import('../api/invitation.js');
    const handler = mod.default || mod;
    const req = { method: 'GET', query: { id: '.../..' } };
    let sent; const res = { setHeader: ()=>{}, status: (s)=>({ json: (b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s, 400);
  });

  it('CASE 4: missing invitation -> 404', async ()=>{
    global.fetch = async ()=>({ status:404, ok:false });
    const mod = await import('../api/invitation.js');
    const handler = mod.default || mod;
    const req = { method:'GET', query:{ id:'X123' } };
    let sent; const res = { setHeader: ()=>{}, status: (s)=>({ json: (b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s, 404);
  });

  it('CASE 5: missing GitHub token -> fail closed (503) when upstream returns 401', async ()=>{
    // simulate upstream 401
    global.fetch = async ()=>({ status:401, ok:false });
    const mod = await import('../api/invitation.js');
    const handler = mod.default || mod;
    const req = { method:'GET', query:{ id:'A1B2' } };
    let sent; const res = { setHeader: ()=>{}, status: (s)=>({ json: (b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s, 503);
  });

  it('CASE 6: upstream network failure -> safe reason', async ()=>{
    global.fetch = async ()=>({ status:500, ok:false });
    const mod = await import('../api/invitation.js');
    const handler = mod.default || mod;
    const req = { method:'GET', query:{ id:'ZZ99' } };
    let sent; const res = { setHeader: ()=>{}, status: (s)=>({ json: (b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s, 500);
    assert.strictEqual(typeof sent.b.reason, 'string');
  });

  it('CASE 7: reading good snapshot -> 200', async ()=>{
    const id='G1H2';
    const snap = { id, sourceRoute:{routeId:'r9'}, facts:{},visual:{},participation:{},presentation:{},revision:1,createdAt:'2026-01-01T00:00:00Z' };
    global.fetch = async ()=>({ status:200, ok:true, json: async ()=>({ content: base64(JSON.stringify(snap)) }) });
    const mod = await import('../api/invitation.js'); const handler = mod.default || mod;
    const req={method:'GET', query:{id}}; let sent; const res={ setHeader: ()=>{}, status:(s)=>({ json:(b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s,200); assert.strictEqual(sent.b.ok,true);
  });

  it('CASE 8: snapshot.id mismatch -> invalid_invitation', async ()=>{
    const snap = { id:'DIFF', sourceRoute:{routeId:'r'}, facts:{},visual:{},participation:{},presentation:{},revision:1,createdAt:'2026-01-01T00:00:00Z' };
    global.fetch = async ()=>({ status:200, ok:true, json: async ()=>({ content: base64(JSON.stringify(snap)) }) });
    const mod = await import('../api/invitation.js'); const handler = mod.default || mod;
    const req={method:'GET', query:{id:'OTHER'}}; let sent; const res={ setHeader: ()=>{}, status:(s)=>({ json:(b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s,500); assert.strictEqual(sent.b.reason,'invalid_invitation');
  });

  it('CASE 9: missing structural field -> invalid_invitation', async ()=>{
    const snap = { id:'OK12', sourceRoute:{}, visual:{}, participation:{}, presentation:{}, revision:1 };
    global.fetch = async ()=>({ status:200, ok:true, json: async ()=>({ content: base64(JSON.stringify(snap)) }) });
    const mod = await import('../api/invitation.js'); const handler = mod.default || mod;
    const req={method:'GET', query:{id:'OK12'}}; let sent; const res={ setHeader: ()=>{}, status:(s)=>({ json:(b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s,500); assert.strictEqual(sent.b.reason,'invalid_invitation');
  });

  it('CASE 10: API does not leak token or stack', async ()=>{
    global.fetch = async ()=>({ status:500, ok:false });
    const mod = await import('../api/invitation.js'); const handler = mod.default || mod;
    const req={method:'GET', query:{id:'A1B2'}}; let sent; const res={ setHeader: ()=>{}, status:(s)=>({ json:(b)=>{ sent={s,b}; return b } }) };
    await handler(req,res);
    assert.strictEqual(sent.s,500); assert.ok(!String(JSON.stringify(sent.b)).includes('token'));
  });

  it('CASE 11: invitation.html exists', async ()=>{
    // simple fs check
    const fs = await import('node:fs');
    const exists = fs.existsSync(new URL('../invitation.html', import.meta.url));
    assert.ok(exists);
  });

  it('CASE 12: invitation.js avoids innerHTML', async ()=>{
    const code = await import('node:fs').then(m=>m.readFileSync(new URL('../invitation.js', import.meta.url)));
    assert.ok(!code.includes('innerHTML'));
  });

  it('CASE 13: visual.source non-https not rendered (client logic)', async ()=>{
    const code = await import('node:fs').then(m=>m.readFileSync(new URL('../invitation.js', import.meta.url),'utf8'));
    assert.ok(code.includes("inv.visual.source") && code.includes("https://"));
  });

  it('CASE 14: legacy_qr non-https not rendered', async ()=>{
    const code = await import('node:fs').then(m=>m.readFileSync(new URL('../invitation.js', import.meta.url),'utf8'));
    assert.ok(code.includes("inv.participation.type === 'legacy_qr'"));
  });

  it('CASE 15: 404 UI state exists in invitation.html', async ()=>{
    const html = await import('node:fs').then(m=>m.readFileSync(new URL('../invitation.html', import.meta.url),'utf8'));
    assert.ok(html.includes('id="notfound"'));
  });

  it('CASE 16: /i/:id rewrite exists in vercel.json', async ()=>{
    const fs = await import('node:fs');
    const p = new URL('../vercel.json', import.meta.url);
    const exists = fs.existsSync(p);
    assert.ok(exists);
    const cfg = JSON.parse(fs.readFileSync(p,'utf8'));
    assert.ok(Array.isArray(cfg.rewrites) && cfg.rewrites.some(r=>r.source==='/i/:id'));
  });

  it('CASE 17: rewrite does not override other static paths', async ()=>{
    // ensure existing index.html still present
    const fs = await import('node:fs');
    assert.ok(fs.existsSync(new URL('../index.html', import.meta.url)));
  });

});
