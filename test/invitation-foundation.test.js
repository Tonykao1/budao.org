import assert from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import { resetForTests as resetRateLimit } from '../api/_security/rate-limit.js';

function makeResponse() {
  let last = { statusCode: 200, body: null };
  return {
    setHeader: () => {},
    status: (code) => ({ json: (body) => { last.statusCode = code; last.body = body; return body; } }),
    _last: () => last
  };
}

function base64(s) { return Buffer.from(s, 'utf8').toString('base64'); }

describe('Invitation Foundation Phase 1A (18 cases)', () => {
  beforeEach(() => {
    resetRateLimit();
    global.fetch = undefined;
    process.env.BUDAO_SESSION_SECRET = '0'.repeat(40);
  });

  // helper to load handler with mocked GitHub behavior
  async function setupHandler({ routes = [], token = 'tok', simulate = {} } = {}) {
    const stored = new Map();
    const calls = [];
    if (token === undefined) { delete process.env.GITHUB_TOKEN; delete process.env.GH_TOKEN; } else { process.env.GITHUB_TOKEN = token; }

    global.fetch = async (url, opts = {}) => {
      calls.push({ url, opts });
      const method = String((opts && opts.method) || 'GET').toUpperCase();
      if (url.includes('/contents/routes.json')) {
        if (method === 'GET') {
          return { status: 200, ok: true, json: async () => ({ content: base64(JSON.stringify(routes)) }) };
        }
      }
      if (url.includes('/contents/invitations/')) {
        const path = url.split('/repos/').pop();
        // method PUT: create file
        if (method === 'PUT') {
          const body = typeof opts.body === 'string' ? JSON.parse(opts.body) : opts.body;
          const filePath = url.split('/contents/')[1];
          // simulate collisions if requested
          const already = stored.has(filePath);
          if (simulate.firstPutConflict && !simulate._conflictedOnce) {
            simulate._conflictedOnce = true;
            return { status: 409, ok: false, json: async () => ({ message: 'conflict' }) };
          }
          if (simulate.alwaysConflict) return { status: 409, ok: false, json: async () => ({ message: 'conflict' }) };
          stored.set(filePath, body);
          return { status: 201, ok: true, json: async () => ({ content: body }) };
        }
        // method GET used for existence sometimes
        if (method === 'GET') {
          const filePath = url.split('/contents/')[1];
          if (stored.has(filePath)) return { status: 200, ok: true, json: async () => ({ content: stored.get(filePath).content }) };
          return { status: 404, ok: false, json: async () => ({ message: 'not found' }) };
        }
      }
      return { status: 404, ok: false, json: async () => ({}) };
    };

    // dynamic import to pick up env changes
    const modUrl = new URL('../api/invitation.js', import.meta.url).href + '?cb=' + Date.now();
    const mod = await import(modUrl);
    const handler = mod.default || mod;
    return { handler, stored, calls };
  }

  function makeReq(cookieValue, body = { routeId: 'r1' }) {
    return { method: 'POST', headers: { cookie: cookieValue, host: 'example.org', origin: 'https://example.org', 'content-type': 'application/json' }, body };
  }

  async function makePublisherCookie(user) {
    const authMod = await import('../api/_security/auth.js');
    const auth = authMod.default || authMod;
    return auth.createSessionCookie(user, false).split(';')[0];
  }

  it('18. successful creation returns 201 and valid id (case 18)', async () => {
    const routes = [{ routeId: 'r1', title: 'T', slot: 'IMS', image: 'https://x', qrCode: 'https://q' }];
    const { handler, stored } = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'pub1', slot: 'IMS' });
    const req = makeReq(cookie, { routeId: 'r1' });
    const res = makeResponse();
    await handler(req, res);
    const out = res._last();
    assert.strictEqual(out.statusCode, 201);
    assert.strictEqual(out.body.ok, true);
    assert.ok(typeof out.body.id === 'string' && out.body.id.length > 0);
    // verify stored invitation file content
    const key = Array.from(stored.keys())[0];
    const put = stored.get(key);
    const decoded = JSON.parse(Buffer.from(put.content, 'base64').toString('utf8'));
    assert.strictEqual(decoded.sourceRoute.routeId, 'r1');
    assert.strictEqual(decoded.participation.type, 'legacy_qr');
    assert.strictEqual(decoded.visual.source, 'https://x');
    // forbidden fields absent
    assert.strictEqual(decoded.owner, undefined);
    assert.strictEqual(decoded.slot, undefined);
    assert.strictEqual(decoded.updatedAt, undefined);
    assert.strictEqual(decoded.imageAlt, undefined);
  });

  it('6. qrCode missing -> participation.type = none', async () => {
    const routes = [{ routeId: 'r2', title: 'T2', slot: 'BACBC', image: '/i' }];
    const { handler, stored } = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'pub2', slot: 'BACBC' });
    const req = makeReq(cookie, { routeId: 'r2' });
    const res = makeResponse();
    await handler(req, res);
    const decoded = JSON.parse(Buffer.from(stored.get(Array.from(stored.keys())[0]).content, 'base64').toString('utf8'));
    assert.strictEqual(decoded.participation.type, 'none');
  });

  it('7. consecutive creates produce distinct ids and files', async () => {
    const routes = [{ routeId: 'r3', title: 'T3', slot: 'IMS', image: 'https://img' }];
    const { handler, stored } = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'pub3', slot: 'IMS' });
    const res1 = makeResponse();
    await handler(makeReq(cookie, { routeId: 'r3' }), res1);
    const id1 = res1._last().body.id;
    const res2 = makeResponse();
    await handler(makeReq(cookie, { routeId: 'r3' }), res2);
    const id2 = res2._last().body.id;
    assert.notStrictEqual(id1, id2);
    // two stored files
    assert.strictEqual(stored.size, 2);
  });

  it('8. snapshot remains unchanged after route modification', async () => {
    const routes = [{ routeId: 'r4', title: 'Original', slot: 'IMS', image: 'https://a' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const handler = s.handler; const stored = s.stored;
    const cookie = await makePublisherCookie({ id: 'pub4', slot: 'IMS' });
    const res1 = makeResponse();
    await handler(makeReq(cookie, { routeId: 'r4' }), res1);
    const key1 = Array.from(stored.keys())[0];
    const snap1 = JSON.parse(Buffer.from(stored.get(key1).content, 'base64').toString('utf8'));
    // mutate routes source
    routes[0].title = 'Changed';
    const res2 = makeResponse();
    await handler(makeReq(cookie, { routeId: 'r4' }), res2);
    const key2 = Array.from(stored.keys()).find((k) => k !== key1);
    const snap2 = JSON.parse(Buffer.from(stored.get(key2).content, 'base64').toString('utf8'));
    assert.strictEqual(snap1.facts.title, 'Original');
    assert.strictEqual(snap2.facts.title, 'Changed');
  });

  it('9. collision on first PUT triggers retry and succeeds', async () => {
    const routes = [{ routeId: 'r5', title: 'T5', slot: 'IMS' }];
    const s = await setupHandler({ routes, token: 'tk', simulate: { firstPutConflict: true } });
    const cookie = await makePublisherCookie({ id: 'pub5', slot: 'IMS' });
    const res = makeResponse();
    await s.handler(makeReq(cookie, { routeId: 'r5' }), res);
    assert.strictEqual(res._last().statusCode, 201);
    assert.strictEqual(s.stored.size, 1);
  });

  it('10. IMS/BACBC cross-ownership tests (both directions)', async () => {
    const routes = [ { routeId: 'r6', slot: 'IMS', title: 'A' }, { routeId: 'r7', slot: 'BACBC', title: 'B' } ];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookieIMS = await makePublisherCookie({ id: 'pIMS', slot: 'IMS' });
    const cookieBAC = await makePublisherCookie({ id: 'pBAC', slot: 'BACBC' });
    const res1 = makeResponse(); await s.handler(makeReq(cookieIMS, { routeId: 'r6' }), res1); assert.strictEqual(res1._last().statusCode, 201);
    const res2 = makeResponse(); await s.handler(makeReq(cookieBAC, { routeId: 'r7' }), res2); assert.strictEqual(res2._last().statusCode, 201);
    // cross attempts should fail
    const res3 = makeResponse(); await s.handler(makeReq(cookieIMS, { routeId: 'r7' }), res3); assert.strictEqual(res3._last().statusCode, 403);
    const res4 = makeResponse(); await s.handler(makeReq(cookieBAC, { routeId: 'r6' }), res4); assert.strictEqual(res4._last().statusCode, 403);
  });

  it('11. unknown fields in body -> 400', async () => {
    const routes = [{ routeId: 'r8', slot: 'IMS', title: 'X' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u1', slot: 'IMS' });
    const res = makeResponse();
    await s.handler({ method: 'POST', headers: { cookie, host: 'example.org', origin: 'https://example.org', 'content-type': 'application/json' }, body: { routeId: 'r8', extra: 1 } }, res);
    assert.strictEqual(res._last().statusCode, 400);
  });

  it('12. missing routeId -> 400', async () => {
    const routes = [{ routeId: 'r9', slot: 'IMS', title: 'X' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u2', slot: 'IMS' });
    const res = makeResponse();
    await s.handler({ method: 'POST', headers: { cookie, host: 'example.org', origin: 'https://example.org', 'content-type': 'application/json' }, body: { } }, res);
    assert.strictEqual(res._last().statusCode, 400);
  });

  it('13. route not found -> 404', async () => {
    const routes = [{ routeId: 'r10', slot: 'IMS', title: 'X' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u3', slot: 'IMS' });
    const res = makeResponse();
    await s.handler(makeReq(cookie, { routeId: 'nope' }), res);
    assert.strictEqual(res._last().statusCode, 404);
  });

  it('14. no publisher -> 401', async () => {
    const routes = [{ routeId: 'r11', slot: 'IMS', title: 'X' }];
    const s = await setupHandler({ routes, token: 'tk' });
    // missing cookie
    const res = makeResponse();
    await s.handler({ method: 'POST', headers: { host: 'example.org', origin: 'https://example.org', 'content-type': 'application/json' }, body: { routeId: 'r11' } }, res);
    assert.strictEqual(res._last().statusCode, 401);
  });

  it('15. missing GitHub token -> fails closed (503)', async () => {
    const routes = [{ routeId: 'r12', slot: 'IMS', title: 'X' }];
    const s = await setupHandler({ routes, token: undefined });
    // ensure env is falsy at call-time
    delete process.env.GITHUB_TOKEN; delete process.env.GH_TOKEN; process.env.GITHUB_TOKEN = '';
    const cookie = await makePublisherCookie({ id: 'u4', slot: 'IMS' });
    const res = makeResponse();
    await s.handler(makeReq(cookie, { routeId: 'r12' }), res);
    assert.strictEqual(res._last().statusCode, 503);
  });

  it('16. GitHub 409/422 should return stable reason', async () => {
    const routes = [{ routeId: 'r13', slot: 'IMS', title: 'X' }];
    // simulate always conflict
    const s = await setupHandler({ routes, token: 'tk', simulate: { alwaysConflict: true } });
    const cookie = await makePublisherCookie({ id: 'u5', slot: 'IMS' });
    const res = makeResponse();
    await s.handler(makeReq(cookie, { routeId: 'r13' }), res);
    const out = res._last();
    assert.ok(out.statusCode === 500 || out.statusCode === 409 || out.statusCode === 422);
    assert.ok(out.body && typeof out.body.reason === 'string');
  });

  it('17. invitation id URL-safe and not equal to routeId', async () => {
    const routes = [{ routeId: 'you', slot: 'IMS', title: 'X' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u6', slot: 'IMS' });
    const res = makeResponse();
    await s.handler(makeReq(cookie, { routeId: 'you' }), res);
    const id = res._last().body.id;
    assert.ok(/^[A-Za-z0-9_-]+$/.test(id));
    assert.notStrictEqual(id, 'you');
  });

  it('1. writes well-formed invitation JSON with required keys', async () => {
    const routes = [{ routeId: 'r14', slot: 'IMS', title: 'T', image: 'https://img' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u7', slot: 'IMS' });
    const res = makeResponse(); await s.handler(makeReq(cookie, { routeId: 'r14' }), res);
    assert.strictEqual(res._last().statusCode, 201);
    const stored = s.stored; const put = stored.get(Array.from(stored.keys())[0]);
    const decoded = JSON.parse(Buffer.from(put.content, 'base64').toString('utf8'));
    assert.ok(decoded.id && decoded.sourceRoute && decoded.facts && decoded.visual && decoded.participation);
  });

  it('2. handler can be invoked directly and returns 201', async () => {
    const routes = [{ routeId: 'r15', slot: 'IMS', title: 'T' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u8', slot: 'IMS' });
    const res = makeResponse(); await s.handler(makeReq(cookie, { routeId: 'r15' }), res);
    assert.strictEqual(res._last().statusCode, 201);
  });

  it('3. fetch was used to read routes and write invitations', async () => {
    const routes = [{ routeId: 'r16', slot: 'IMS', title: 'T' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u9', slot: 'IMS' });
    const res = makeResponse(); await s.handler(makeReq(cookie, { routeId: 'r16' }), res);
    // first call should include routes.json GET and at least one PUT
    const urls = s.calls.map(c => c.url).join(' ');
    assert.ok(urls.includes('/contents/routes.json'));
    assert.ok(urls.includes('/contents/invitations/'));
  });

  it('4. final stored snapshot maps image->visual.source and qrCode->participation', async () => {
    const routes = [{ routeId: 'r17', slot: 'IMS', title: 'T', image: 'https://ok', qrCode: 'https://q' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u10', slot: 'IMS' });
    const res = makeResponse(); await s.handler(makeReq(cookie, { routeId: 'r17' }), res);
    const decoded = JSON.parse(Buffer.from(s.stored.get(Array.from(s.stored.keys())[0]).content, 'base64').toString('utf8'));
    assert.strictEqual(decoded.visual.source, 'https://ok');
    assert.strictEqual(decoded.participation.type, 'legacy_qr');
  });

  it('5. snapshot does not include forbidden fields', async () => {
    const routes = [{ routeId: 'r18', slot: 'IMS', owner: 'someone', title: 'T', imageAlt: 'alt' }];
    const s = await setupHandler({ routes, token: 'tk' });
    const cookie = await makePublisherCookie({ id: 'u11', slot: 'IMS' });
    const res = makeResponse(); await s.handler(makeReq(cookie, { routeId: 'r18' }), res);
    const decoded = JSON.parse(Buffer.from(s.stored.get(Array.from(s.stored.keys())[0]).content, 'base64').toString('utf8'));
    assert.strictEqual(decoded.owner, undefined);
    assert.strictEqual(decoded.slot, undefined);
    assert.strictEqual(decoded.updatedAt, undefined);
    assert.strictEqual(decoded.createdAt === undefined || typeof decoded.createdAt === 'string', true);
    assert.strictEqual(decoded.imageAlt, undefined);
  });

});
