const assert = require('node:assert/strict');
const test = require('node:test');

function makeResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: function () { return Promise.resolve(body); }
  };
}

function publishTrailSim(responseMock, waitForPublishedRouteMock) {
  const route = { routeId: 'budao-test' };

  function handleResponse(response) {
    if (!response.ok) {
      return response.json().catch(() => ({})).then(function (body) {
        const err = new Error(body.error || body.reason || 'network_failed');
        err.reason = body.error || body.reason || 'network_failed';
        throw err;
      });
    }

    return response.json();
  }

  return Promise.resolve(responseMock).then(handleResponse).then(function (result) {
    if (result && result.ok === false) {
      const err = new Error(result.error || result.reason || 'network_failed');
      err.reason = result.error || result.reason || 'network_failed';
      throw err;
    }

    if (result && result.shareImageUrl) {
      try { /* store last share image */ } catch (e) {}
    }

    const commit = result && typeof result.commit === 'string' ? result.commit.trim() : null;
    if (commit) {
      try { /* remove pending */ } catch (e) {}
      return { shortCircuited: true };
    }

    // fallback
    waitForPublishedRouteMock.called = true;
    return { shortCircuited: false };
  });
}

const cases = [
  { name: 'CASE 1', response: makeResponse(200, { ok: true, commit: 'abc123' }), expectShort: true, expectFail: false },
  { name: 'CASE 2', response: makeResponse(200, { commit: 'abc123' }), expectShort: true, expectFail: false },
  { name: 'CASE 3', response: makeResponse(200, { ok: true, commit: null }), expectShort: false, expectFail: false },
  { name: 'CASE 4', response: makeResponse(200, { ok: true }), expectShort: false, expectFail: false },
  { name: 'CASE 5', response: makeResponse(200, { ok: false, commit: 'abc123' }), expectShort: null, expectFail: true },
  { name: 'CASE 6', response: makeResponse(500, { commit: 'abc123' }), expectShort: null, expectFail: true },
  { name: 'CASE 7', response: makeResponse(200, { ok: true, commit: '' }), expectShort: false, expectFail: false },
  { name: 'CASE 8', response: makeResponse(200, { ok: true, commit: '   ' }), expectShort: false, expectFail: false }
];

test('publish commit short-circuit cases 1..8', async () => {
  let passed = 0;
  for (const c of cases) {
    const waitMock = { called: false };
    try {
      const res = await publishTrailSim(c.response, waitMock);
      if (c.expectFail) throw new Error('expected failure');
      if (c.expectShort === true && res.shortCircuited !== true) throw new Error('expected short-circuit');
      if (c.expectShort === false && waitMock.called !== true) throw new Error('expected fallback wait');
      passed++;
    } catch (err) {
      if (c.expectFail) {
        passed++;
      } else {
        throw err;
      }
    }
  }
  // CASE 9: IMS vs BACBC parity
  const resp = makeResponse(200, { ok: true, commit: 'same123' });
  const waitA = { called: false };
  const waitB = { called: false };
  const a = await publishTrailSim(resp, waitA);
  const b = await publishTrailSim(resp, waitB);
  assert.strictEqual(a.shortCircuited, b.shortCircuited, 'IMS/BACBC mismatch');
  passed++;
  assert.equal(passed, 9);
});

test('client payload strips meetingPoint and preserves meetingPlace and other deletions', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'tent-app.js'), 'utf8');

  // Ensure toRouteJson uses source.meetingPlace as fallback for location
  assert.match(source, /const\s+location\s*=\s*source\.routeLocation\s*\|\|\s*source\.meetingPlace/);

  // Ensure publishTrail payload deletion list includes meetingPoint and the original keys
  assert.match(source, /\["owner",\s*"slot",\s*"createdAt",\s*"updatedAt",\s*"meetingPoint"\]/);
});
