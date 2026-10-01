const { and, desc, eq, gt, isNull, sql } = require("drizzle-orm");
const { neon } = require("@neondatabase/serverless");
const { getDatabaseUrl, getDb } = require("../../db/client");
const {
  pastureUsers,
  pastureEmailVerifications,
  pastureSessions,
  pastureSheep
} = require("../../db/schema");

let ensured = false;

async function ensurePastureSchema(env = process.env) {
  if (ensured) return;
  const query = neon(getDatabaseUrl(env));
  await query`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await query`CREATE TABLE IF NOT EXISTS pasture_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash text NOT NULL,
    email_masked text NOT NULL,
    status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','DELETED')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await query`CREATE UNIQUE INDEX IF NOT EXISTS pasture_users_email_hash_uq ON pasture_users(email_hash)`;
  await query`CREATE TABLE IF NOT EXISTS pasture_email_verifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash text NOT NULL,
    code_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    attempts integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await query`CREATE INDEX IF NOT EXISTS pasture_email_verifications_lookup_idx ON pasture_email_verifications(email_hash, created_at)`;
  await query`CREATE TABLE IF NOT EXISTS pasture_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE,
    token_hash text NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    revoked_at timestamptz,
    user_agent_summary text
  )`;
  await query`CREATE UNIQUE INDEX IF NOT EXISTS pasture_sessions_token_hash_uq ON pasture_sessions(token_hash)`;
  await query`CREATE TABLE IF NOT EXISTS pasture_sheep (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES pasture_users(id) ON DELETE CASCADE,
    body_color text NOT NULL,
    head_color text NOT NULL,
    marking text NOT NULL DEFAULT 'NONE' CHECK (marking IN ('NONE','FACE','BACK','SOCKS')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`;
  await query`CREATE UNIQUE INDEX IF NOT EXISTS pasture_sheep_user_id_uq ON pasture_sheep(user_id)`;
  ensured = true;
}

async function createVerification(emailHash, codeHash, expiresAt) {
  const db = getDb();
  const now = new Date();
  await db.update(pastureEmailVerifications)
    .set({ consumedAt: now })
    .where(and(eq(pastureEmailVerifications.emailHash, emailHash), isNull(pastureEmailVerifications.consumedAt)));
  const rows = await db.insert(pastureEmailVerifications)
    .values({ emailHash, codeHash, expiresAt }).returning();
  return rows[0];
}

async function latestVerification(emailHash) {
  const db = getDb();
  const rows = await db.select().from(pastureEmailVerifications)
    .where(and(eq(pastureEmailVerifications.emailHash, emailHash), isNull(pastureEmailVerifications.consumedAt)))
    .orderBy(desc(pastureEmailVerifications.createdAt)).limit(1);
  return rows[0] || null;
}

async function incrementVerificationAttempts(id) {
  const db = getDb();
  const rows = await db.update(pastureEmailVerifications)
    .set({ attempts: sql`${pastureEmailVerifications.attempts} + 1` })
    .where(eq(pastureEmailVerifications.id, id)).returning();
  return rows[0] || null;
}

async function consumeVerification(id, when = new Date()) {
  const db = getDb();
  await db.update(pastureEmailVerifications).set({ consumedAt: when })
    .where(eq(pastureEmailVerifications.id, id));
}

async function findOrCreateUser(emailHash, emailMasked) {
  const db = getDb();
  let rows = await db.select().from(pastureUsers)
    .where(eq(pastureUsers.emailHash, emailHash)).limit(1);
  const current = rows[0] || null;
  if (current) {
    rows = await db.update(pastureUsers)
      .set({ emailMasked, updatedAt: new Date() })
      .where(eq(pastureUsers.id, current.id)).returning();
    return rows[0] || current;
  }
  rows = await db.insert(pastureUsers).values({ emailHash, emailMasked }).returning();
  return rows[0];
}

async function createSession(userId, tokenHash, expiresAt, userAgentSummary) {
  const db = getDb();
  const rows = await db.insert(pastureSessions)
    .values({ userId, tokenHash, expiresAt, userAgentSummary: userAgentSummary || null }).returning();
  return rows[0];
}

async function sessionByTokenHash(value) {
  const db = getDb(), now = new Date();
  const rows = await db.select({ session: pastureSessions, user: pastureUsers })
    .from(pastureSessions)
    .innerJoin(pastureUsers, eq(pastureSessions.userId, pastureUsers.id))
    .where(and(
      eq(pastureSessions.tokenHash, value),
      isNull(pastureSessions.revokedAt),
      gt(pastureSessions.expiresAt, now),
      eq(pastureUsers.status, "ACTIVE")
    )).limit(1);
  if (!rows[0]) return null;
  await db.update(pastureSessions).set({ lastSeenAt: now })
    .where(eq(pastureSessions.id, rows[0].session.id));
  return rows[0];
}

async function revokeSession(value) {
  const db = getDb();
  await db.update(pastureSessions).set({ revokedAt: new Date() })
    .where(and(eq(pastureSessions.tokenHash, value), isNull(pastureSessions.revokedAt)));
}

async function sheepForUser(userId) {
  const db = getDb();
  const rows = await db.select().from(pastureSheep)
    .where(eq(pastureSheep.userId, userId)).limit(1);
  return rows[0] || null;
}

async function saveSheep(userId, appearance) {
  const db = getDb();
  const existing = await sheepForUser(userId);
  if (existing) {
    const rows = await db.update(pastureSheep)
      .set({ ...appearance, updatedAt: new Date() })
      .where(eq(pastureSheep.id, existing.id)).returning();
    return { sheep: rows[0] || existing, created: false };
  }
  const rows = await db.insert(pastureSheep)
    .values({ userId, ...appearance }).returning();
  return { sheep: rows[0], created: true };
}

function resetPastureSchemaForTests() { ensured = false; }

module.exports = {
  ensurePastureSchema,
  createVerification,
  latestVerification,
  incrementVerificationAttempts,
  consumeVerification,
  findOrCreateUser,
  createSession,
  sessionByTokenHash,
  revokeSession,
  sheepForUser,
  saveSheep,
  resetPastureSchemaForTests
};
