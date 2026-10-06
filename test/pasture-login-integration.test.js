const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

process.env.PASTURE_SESSION_SECRET='pasture-integration-test-secret-that-is-longer-than-thirty-two-characters';
const positionDomain=require(path.join(root,'api/_security/pasture-position-domain.js'));

function compact(value){return String(value).replace(/\s+/g,' ');}

test('first login creates one durable identity and only first-time users enter sheep creation',()=>{
  const handler=read('api/_security/pasture-auth-handler.js');
  const store=read('api/_security/pasture-auth-store.js');
  const runtime=read('pasture-resident-runtime-core.js');

  assert.match(handler,/findOrCreateUser\(emailHash/);
  assert.match(handler,/const sheep = await store\.sheepForUser\(user\.id\)/);
  assert.match(handler,/needsSheep:\s*!sheep/);
  assert.match(store,/target:\s*pastureUsers\.emailHash/);
  assert.match(store,/const existing = await sheepForUser\(userId\)/);
  assert.match(store,/created:\s*false/);
  assert.match(store,/created:\s*true/);
  assert.match(runtime,/if\(data\.needsSheep\|\|!resident\?\.sheep\)sheepMaker\(\);else layer\.hidden=true/);
  assert.match(runtime,/if\(!resident\.sheep\)\{sheepMaker\(\);return;\}/);
});

test('returning login restores the same user and sheep instead of creating another sheep',()=>{
  const migration=read('db/migrations/0004_pasture_identity.sql');
  const store=read('api/_security/pasture-auth-store.js');
  const handler=read('api/_security/pasture-auth-handler.js');

  assert.match(migration,/pasture_users_email_hash_uq[\s\S]*pasture_users\(email_hash\)/);
  assert.match(migration,/pasture_sheep_user_id_uq[\s\S]*pasture_sheep\(user_id\)/);
  assert.match(store,/onConflictDoUpdate\([\s\S]*target:\s*pastureUsers\.emailHash/);
  assert.match(handler,/user:\s*domain\.publicUser\(user, sheep\)/);
  assert.match(handler,/needsSheep:\s*!sheep/);
});

test('same user same day and mode has one server-authoritative position across sessions',()=>{
  const migration=read('db/migrations/0007_pasture_sheep_daily_positions.sql');
  const store=read('api/_security/pasture-auth-store.js');
  const handler=read('api/_security/pasture-auth-handler.js');
  const sync=read('pasture-resident-position-sync.js');

  assert.match(migration,/pasture_sheep_daily_positions_user_date_mode_uq[\s\S]*\(user_id, date_key, mode\)/);
  assert.match(store,/dailyPositionForUser\(userId, dateKey, mode\)/);
  assert.match(store,/onConflictDoUpdate\([\s\S]*pastureSheepDailyPositions\.userId[\s\S]*pastureSheepDailyPositions\.dateKey[\s\S]*pastureSheepDailyPositions\.mode/);
  assert.match(handler,/dailyPositionForUser\(resident\.id, dateKey, mode\)/);
  assert.match(handler,/upsertDailyPosition\(resident\.id, dateKey, mode, position\)/);
  assert.doesNotMatch(handler,/dailyPositionForUser\(body\.userId/);
  assert.doesNotMatch(handler,/upsertDailyPosition\(body\.userId/);
  assert.match(sync,/action:'getDailySheepPosition'/);
  assert.match(sync,/cachePosition\(dateKey,mode,normalized\)/);
});

test('daily placement is deterministic within a day and changes on the next day',()=>{
  const user='11111111-2222-3333-4444-555555555555';
  for(const mode of ['landscape','portrait']){
    const today=positionDomain.generateDailyPosition(user,'2026-10-06',mode);
    const same=positionDomain.generateDailyPosition(user,'2026-10-06',mode);
    const tomorrow=positionDomain.generateDailyPosition(user,'2026-10-07',mode);
    assert.deepEqual(today,same);
    assert.notDeepEqual(today,tomorrow);
    assert.deepEqual(positionDomain.validatePosition(mode,today),today);
  }
});

test('logout revokes only the session and returns the view to the 44-sheep guest state',()=>{
  const handler=read('api/_security/pasture-auth-handler.js');
  const runtime=read('pasture-resident-runtime-core.js');
  const logoutBlock=compact(handler.slice(handler.indexOf('async function logout'),handler.indexOf('async function authenticatedResident')));

  assert.match(logoutBlock,/revokeSession\(domain\.tokenHash\(token\)\)/);
  assert.match(logoutBlock,/clearSessionCookie/);
  assert.doesNotMatch(logoutBlock,/delete|remove/i);
  assert.match(runtime,/resident=null;layout=null;layoutKey='';arrivalStarted=0;emitAuthState\(\)/);
  assert.match(runtime,/__tongluFlockCount=resident\?45:44/);
});

test('session expiry or a stale cookie degrades to guest without deleting durable identity data',()=>{
  const store=read('api/_security/pasture-auth-store.js');
  const handler=read('api/_security/pasture-auth-handler.js');
  assert.match(store,/gt\(pastureSessions\.expiresAt, now\)/);
  assert.match(store,/isNull\(pastureSessions\.revokedAt\)/);
  assert.match(handler,/if \(!row\) return null/);
  assert.match(handler,/GET[\s\S]*\{ ok: true, user: resident \}/);
  assert.doesNotMatch(handler,/DELETE FROM pasture_users|DELETE FROM pasture_sheep/i);
});
