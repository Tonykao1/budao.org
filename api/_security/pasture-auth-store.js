const { neon } = require('@neondatabase/serverless');
const { getDatabaseUrl } = require('../../db/client');

let sqlClient;
let ensurePromise;
function sql(){ if(!sqlClient) sqlClient=neon(getDatabaseUrl()); return sqlClient; }

async function ensurePastureSchema(){
  if(!ensurePromise){
    ensurePromise=(async()=>{
      const q=sql();
      await q`CREATE TABLE IF NOT EXISTS pasture_users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email_hash text NOT NULL UNIQUE,
        email_masked text NOT NULL,
        email_ciphertext text NOT NULL,
        email_nonce text NOT NULL,
        email_tag text NOT NULL,
        status text NOT NULL DEFAULT 'ACTIVE',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await q`CREATE TABLE IF NOT EXISTS pasture_email_verifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email_hash text NOT NULL,
        code_hash text NOT NULL,
        attempts integer NOT NULL DEFAULT 0,
        expires_at timestamptz NOT NULL,
        consumed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await q`CREATE INDEX IF NOT EXISTS pasture_email_verifications_lookup_idx ON pasture_email_verifications(email_hash, created_at DESC)`;
      await q`CREATE TABLE IF NOT EXISTS pasture_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        user_agent_summary text,
        created_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now()
      )`;
      await q`CREATE INDEX IF NOT EXISTS pasture_sessions_user_idx ON pasture_sessions(user_id)`;
      await q`CREATE TABLE IF NOT EXISTS pasture_sheep (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL UNIQUE REFERENCES pasture_users(id) ON DELETE CASCADE,
        body_color text NOT NULL,
        head_color text NOT NULL,
        marking text NOT NULL DEFAULT 'NONE',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
    })().catch(e=>{ensurePromise=null;throw e});
  }
  return ensurePromise;
}

async function createVerification(emailHash,codeHash,expiresAt){
  const q=sql();
  const rows=await q`INSERT INTO pasture_email_verifications(email_hash,code_hash,expires_at) VALUES(${emailHash},${codeHash},${expiresAt}) RETURNING id`;
  return rows[0];
}
async function latestVerification(emailHash){
  const rows=await sql()`SELECT id,email_hash AS "emailHash",code_hash AS "codeHash",attempts,expires_at AS "expiresAt",consumed_at AS "consumedAt" FROM pasture_email_verifications WHERE email_hash=${emailHash} ORDER BY created_at DESC LIMIT 1`;
  return rows[0]||null;
}
async function incrementVerificationAttempts(id){await sql()`UPDATE pasture_email_verifications SET attempts=attempts+1 WHERE id=${id}`}
async function consumeVerification(id){await sql()`UPDATE pasture_email_verifications SET consumed_at=now() WHERE id=${id}`}
async function findOrCreateUser(emailHash,emailMasked,encrypted){
  const rows=await sql()`INSERT INTO pasture_users(email_hash,email_masked,email_ciphertext,email_nonce,email_tag)
    VALUES(${emailHash},${emailMasked},${encrypted.emailCiphertext},${encrypted.emailNonce},${encrypted.emailTag})
    ON CONFLICT(email_hash) DO UPDATE SET email_masked=EXCLUDED.email_masked,email_ciphertext=EXCLUDED.email_ciphertext,email_nonce=EXCLUDED.email_nonce,email_tag=EXCLUDED.email_tag,updated_at=now()
    RETURNING id,email_masked AS "emailMasked",status,created_at AS "createdAt"`;
  return rows[0]||null;
}
async function createSession(userId,tokenHash,expiresAt,ua){
  const rows=await sql()`INSERT INTO pasture_sessions(user_id,token_hash,expires_at,user_agent_summary) VALUES(${userId},${tokenHash},${expiresAt},${ua}) RETURNING id`;
  return rows[0];
}
async function sessionByTokenHash(tokenHash){
  const q=sql();
  const rows=await q`SELECT s.id AS "sessionId",u.id AS "userId",u.email_masked AS "emailMasked",u.status,u.created_at AS "createdAt"
    FROM pasture_sessions s JOIN pasture_users u ON u.id=s.user_id
    WHERE s.token_hash=${tokenHash} AND s.revoked_at IS NULL AND s.expires_at>now() LIMIT 1`;
  if(!rows[0])return null;
  await q`UPDATE pasture_sessions SET last_seen_at=now() WHERE id=${rows[0].sessionId}`;
  return {session:{id:rows[0].sessionId},user:{id:rows[0].userId,emailMasked:rows[0].emailMasked,status:rows[0].status,createdAt:rows[0].createdAt}};
}
async function revokeSession(tokenHash){await sql()`UPDATE pasture_sessions SET revoked_at=now() WHERE token_hash=${tokenHash}`}
async function sheepForUser(userId){
  const rows=await sql()`SELECT id,user_id AS "userId",body_color AS "bodyColor",head_color AS "headColor",marking,created_at AS "createdAt" FROM pasture_sheep WHERE user_id=${userId} LIMIT 1`;
  return rows[0]||null;
}
async function saveSheep(userId,appearance){
  const before=await sheepForUser(userId);
  const rows=await sql()`INSERT INTO pasture_sheep(user_id,body_color,head_color,marking) VALUES(${userId},${appearance.bodyColor},${appearance.headColor},${appearance.marking})
    ON CONFLICT(user_id) DO UPDATE SET body_color=EXCLUDED.body_color,head_color=EXCLUDED.head_color,marking=EXCLUDED.marking,updated_at=now()
    RETURNING id,user_id AS "userId",body_color AS "bodyColor",head_color AS "headColor",marking,created_at AS "createdAt"`;
  return {created:!before,sheep:rows[0]};
}
module.exports={ensurePastureSchema,createVerification,latestVerification,incrementVerificationAttempts,consumeVerification,findOrCreateUser,createSession,sessionByTokenHash,revokeSession,sheepForUser,saveSheep};
