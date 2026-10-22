'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const C=require('../api/_security/pasture-card-domain');
const load=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const firstEnv={PASTURE_CARD_PEPPER:'first-independent-secret-32+characters-and-only-for-card-verification'};
const anotherEnv={PASTURE_CARD_PEPPER:'another-independent-secret-32+characters-for-verification'};
test('each real card receives a 20-character cryptographically random secret, 100-bit space',()=>{
 const set=new Set(),serials=new Set();
 for(let i=0;i<250;i++){
  const card=C.createIssuedCard(firstEnv);
  assert.match(card.password,/^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$/);
  assert.match(card.serial,/^BD-[0-9A-HJKMNP-TV-Z]{10}$/);
  assert.match(card.secretDigest,/^[a-f0-9]{64}$/);
  assert.equal(card.secretDigest,C.hashCode(card.password,firstEnv));
  assert.ok(!set.has(card.password),'same code not reused');
  assert.ok(!serials.has(card.serial),'same serial not reused');
  set.add(card.password);serials.add(card.serial);
 }
 assert.equal(C.ALPHABET.length,32);
 assert.equal(C.CODE_LENGTH,20);
});
test('typographic separators and ambiguous inputs normalize only in the verifier',()=>{
 const card=C.createIssuedCard(firstEnv);
 const raw=card.password.replaceAll('-','');
 assert.equal(C.normalizeCode(card.password),raw);
 assert.equal(C.normalizeCode(card.password.toLowerCase()),raw);
 assert.equal(C.normalizeCode(raw.slice(0,5)+' '+raw.slice(5)),raw);
 assert.equal(C.hashCode(card.password,firstEnv),C.hashCode(raw,firstEnv));
 assert.equal(C.hashCode(card.password,anotherEnv)===card.secretDigest,false);
 assert.equal(C.normalizeCode('BUDAO-2026'),null);
 assert.equal(C.normalizeCode('x'.repeat(200)),null);
});
test('issuance and verification require a dedicated secret; no fallback to session secret',()=>{
 assert.throws(()=>C.createIssuedCard({PASTURE_SESSION_SECRET:'x'.repeat(60)}),/not_configured/);
 assert.throws(()=>C.hashCode('11111-11111-11111-11111',{}),/not_configured/);
 assert.equal(C.hashCode('wrong',{}),null);
 const source=load('api/_security/pasture-card-domain.js');
 assert.match(source,/crypto\.randomBytes\(CODE_LENGTH\)/);
 assert.match(source,/createHmac\('sha256',verifierSecret/);
 assert.doesNotMatch(source,/PASTURE_SESSION_SECRET/);
});
test('database enforces unique cards, one active owner, permanent claims, atomic redemption',()=>{
 const migration=load('db/migrations/0005_pasture_card_secrets.sql');
 const store=load('api/_security/pasture-card-store.js');
 assert.match(migration,/UNIQUE INDEX IF NOT EXISTS pasture_cards_active_resident_uq/);
 assert.match(migration,/status='ACTIVATED'/);
 assert.match(migration,/secret_digest text NOT NULL UNIQUE/);
 assert.match(migration,/CHECK \(status IN \('ISSUED','ACTIVATED','REVOKED'\)\)/);
 assert.match(store,/WITH claimed AS \(/);
 assert.match(store,/UPDATE pasture_cards SET status='ACTIVATED'/);
 assert.match(store,/AND status='ISSUED'/);
 assert.match(store,/UPDATE pasture_users/);
 assert.match(store,/card_activated_at=now\(\)/);
 assert.match(store,/WITH revoked AS \(/);
 assert.match(store,/status='REVOKED'/);
 assert.match(store,/SET card_activated_at=NULL/);
});
test('brute force cap uses a DB UPSERT per authenticated user instead of in-memory counters',()=>{
 const store=load('api/_security/pasture-card-store.js');
 const handler=load('api/_security/pasture-auth-handler.js');
 assert.match(store,/INSERT INTO pasture_card_attempts/);
 assert.match(store,/ON CONFLICT\(user_id\) DO UPDATE/);
 assert.match(store,/interval '15 minutes'/);
 assert.match(store,/<=5/);
 assert.match(handler,/consumeActivationAttempt\(resident\.id\)/);
 assert.match(handler,/card-ip:/);
 assert.match(handler,/card_rate_limited/);
 assert.match(handler,/activation_failed/);
 assert.doesNotMatch(handler,/password[:=].+console/);
});
test('offline-only operator CLI never exposes issuance as API or emits plaintext stdout',()=>{
 const cli=load('scripts/pasture-card-admin.js');
 const handler=load('api/_security/pasture-auth-handler.js');
 const cardPage=load('pasture-preview/card-activation.html');
 assert.match(cli,/--confirm-issue/);
 assert.match(cli,/--confirm-revoke/);
 assert.match(cli,/fs\.openSync\(outfile,'wx',0o600\)/);
 assert.match(cli,/outfile\.startsWith\(repoRoot\+path\.sep\)/);
 assert.match(cli,/fs\.writeFileSync\(fd,JSON\.stringify/);
 assert.doesNotMatch(handler,/createIssuedCard|issueCardRecord|revokeCard/);
 assert.doesNotMatch(cardPage,/PASTURE_CARD_PEPPER|secretDigest|localStorage/);
});
