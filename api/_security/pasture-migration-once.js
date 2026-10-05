const { sql } = require("drizzle-orm");
const { getDb } = require("../../db/client");

const EXPECTED_BRANCH = "integration/pasture-registration-20261005";

const statements = [
  `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
  `CREATE TABLE IF NOT EXISTS pasture_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash text NOT NULL,
    email_masked text NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pasture_users_email_hash_uq ON pasture_users(email_hash)`,
  `CREATE INDEX IF NOT EXISTS pasture_users_status_idx ON pasture_users(status)`,
  `CREATE TABLE IF NOT EXISTS pasture_email_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS pasture_email_verifications_lookup_idx ON pasture_email_verifications(email_hash, created_at)`,
  `CREATE INDEX IF NOT EXISTS pasture_email_verifications_expiry_idx ON pasture_email_verifications(expires_at, consumed_at)`,
  `CREATE TABLE IF NOT EXISTS pasture_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    user_agent_summary text
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pasture_sessions_token_hash_uq ON pasture_sessions(token_hash)`,
  `CREATE INDEX IF NOT EXISTS pasture_sessions_user_id_idx ON pasture_sessions(user_id)`,
  `CREATE INDEX IF NOT EXISTS pasture_sessions_active_idx ON pasture_sessions(expires_at, revoked_at)`,
  `CREATE TABLE IF NOT EXISTS pasture_sheep (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE,
    body_color text NOT NULL,
    head_color text NOT NULL,
    marking text NOT NULL DEFAULT 'NONE' CHECK (marking IN ('NONE','FACE','BACK','SOCKS')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS pasture_sheep_user_id_uq ON pasture_sheep(user_id)`,
  `ALTER TABLE pasture_users ADD COLUMN IF NOT EXISTS email_ciphertext text`,
  `ALTER TABLE pasture_users ADD COLUMN IF NOT EXISTS email_nonce text`,
  `ALTER TABLE pasture_users ADD COLUMN IF NOT EXISTS email_tag text`,
  `CREATE TABLE IF NOT EXISTS pasture_rate_limits (
    key_hash text PRIMARY KEY,
    window_started_at timestamptz NOT NULL,
    count integer NOT NULL DEFAULT 1
  )`
];

async function verify(db) {
  const tableResult = await db.execute(sql.raw(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('pasture_users','pasture_email_verifications','pasture_sessions','pasture_sheep','pasture_rate_limits')
    ORDER BY table_name
  `));
  const columnResult = await db.execute(sql.raw(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'pasture_users'
      AND column_name IN ('email_hash','email_masked','email_ciphertext','email_nonce','email_tag')
    ORDER BY column_name
  `));
  const indexResult = await db.execute(sql.raw(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname IN ('pasture_users_email_hash_uq','pasture_sessions_token_hash_uq','pasture_sheep_user_id_uq')
    ORDER BY indexname
  `));
  const rows = (value) => Array.isArray(value) ? value : (value && value.rows) || [];
  return {
    tables: rows(tableResult).map((r) => r.table_name),
    columns: rows(columnResult).map((r) => r.column_name),
    indexes: rows(indexResult).map((r) => r.indexname)
  };
}

module.exports = async function pastureMigrationOnce(request, response) {
  if (request.method !== "GET") return response.status(405).json({ ok: false, reason: "method_not_allowed" });
  if (process.env.VERCEL_ENV !== "preview" || process.env.VERCEL_GIT_COMMIT_REF !== EXPECTED_BRANCH) {
    return response.status(404).json({ ok: false, reason: "not_found" });
  }

  try {
    const db = getDb();
    for (const statement of statements) await db.execute(sql.raw(statement));
    const verified = await verify(db);
    const ok = verified.tables.length === 5 && verified.columns.length === 5 && verified.indexes.length === 3;
    response.setHeader("Cache-Control", "no-store");
    return response.status(ok ? 200 : 500).json({ ok, verified });
  } catch (error) {
    console.error("pasture-migration-once", String(error && error.message || error));
    return response.status(500).json({ ok: false, reason: "migration_failed" });
  }
};
