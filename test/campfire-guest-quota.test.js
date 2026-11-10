"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { RULES, networkKey, consumeGuestQuota } = require("../api/_security/campfire-guest-quota");

process.env.BUDAO_SESSION_SECRET = "test-only-32-chars-long-secret-not-a-production-credential";

function databaseFake() {
  const buckets = new Map();
  let deletions = 0;
  return {
    buckets,
    get deletions() {return deletions},
    async query(sql, params) {
      if (sql.startsWith("DELETE FROM")) { deletions++; return []; }
      assert.match(sql, /^INSERT INTO campfire_write_limits/);
      assert.match(sql,/ON CONFLICT\(scope,key_hash,bucket_start\)/);
      const [scope, key, start, max] = params;
      assert.ok(scope.length<=24);
      assert.match(key,/^[a-f0-9]{64}$/);
      const id=[scope,key,start].join(":");
      const n=(buckets.get(id)||0)+1;
      if(n>max)return [];
      buckets.set(id,n);
      return [{request_count:n}];
    }
  };
}
const visitor = (n) => crypto.createHash("sha256").update("visitor"+n).digest("hex");

test("network quota identifier is short-lived and never includes raw IP", () => {
  const req = {headers:{"x-forwarded-for":"203.0.113.42"}};
  const a=networkKey(req,1800000,process.env.BUDAO_SESSION_SECRET);
  const b=networkKey(req,1800000,process.env.BUDAO_SESSION_SECRET);
  const c=networkKey(req,5400000,process.env.BUDAO_SESSION_SECRET);
  assert.equal(a,b);
  assert.notEqual(a,c);
  assert.match(a,/^[a-f0-9]{64}$/);
  assert.ok(!a.includes("203.0.113.42"));
  assert.equal(networkKey({headers:{}},1800000,process.env.BUDAO_SESSION_SECRET),null);
});

test("one guest receives a limited number of accepted comments per hour", async () => {
  const db=databaseFake();
  const req={headers:{"x-forwarded-for":"203.0.113.50"}};
  for(let i=0;i<RULES.comment.browser;i++)
    assert.equal(await consumeGuestQuota(db.query,req,visitor("solo"),"comment"),true);
  assert.equal(await consumeGuestQuota(db.query,req,visitor("solo"),"comment"),false);
  assert.ok(db.deletions<=1);
});

test("IP-pseudonym quotas stop cookie rotation abuse without retaining raw IP", async () => {
  const db=databaseFake();
  const req={headers:{"x-forwarded-for":"198.51.100.15"}};
  for(let i=0;i<RULES.comment.network;i++) {
    assert.equal(await consumeGuestQuota(db.query,req,visitor("rotated"+i),"comment"),true);
  }
  assert.equal(await consumeGuestQuota(db.query,req,visitor("rotated-extra"),"comment"),false);
  const differentNetwork={headers:{"x-forwarded-for":"198.51.100.16"}};
  assert.equal(await consumeGuestQuota(db.query,differentNetwork,visitor("rotated-extra"),"comment"),true);
});

test("reports, reactions and withdrawals have distinct limits", async () => {
  const db=databaseFake();
  const req={headers:{}};
  for(let i=0;i<RULES.report.browser;i++)
    assert.equal(await consumeGuestQuota(db.query,req,visitor("reporter"),"report"),true);
  assert.equal(await consumeGuestQuota(db.query,req,visitor("reporter"),"report"),false);
  assert.equal(await consumeGuestQuota(db.query,req,visitor("reporter"),"react"),true);
  assert.equal(await consumeGuestQuota(db.query,req,visitor("reporter"),"withdraw"),true);
  await assert.rejects(consumeGuestQuota(db.query,req,visitor("reporter"),"unknown"),/invalid_guest_quota/);
});
