const { and, desc, eq, gt, isNull, sql } = require("drizzle-orm");
const { getDb } = require("../../db/client");
const {
  pastureUsers,
  pastureEmailVerifications,
  pastureSessions,
  pastureSheep
} = require("../../db/schema");

async function consumePastureRateLimit(keyHash, limit, windowMs, now = new Date()) {
  const db = getDb();
  const resetBefore = new Date(now.getTime() - windowMs);
  const result = await db.execute(sql`
    INSERT INTO pasture_rate_limits (key_hash, window_started_at, count)
    VALUES (${keyHash}, ${now}, 1)
    ON CONFLICT (key_hash) DO UPDATE SET
      count = CASE WHEN pasture_rate_limits.window_started_at <= ${resetBefore} THEN 1 ELSE pasture_rate_limits.count + 1 END,
      window_started_at = CASE WHEN pasture_rate_limits.window_started_at <= ${resetBefore} THEN ${now} ELSE pasture_rate_limits.window_started_at END
    RETURNING count <= ${limit} AS allowed
  `);
  const rows = Array.isArray(result) ? result : result.rows || [];
  return rows.length === 1 && rows[0].allowed === true;
}

async function createVerification(emailHash, codeHash, expiresAt) {
  const db = getDb();
  const now = new Date();
  await db.update(pastureEmailVerifications)
    .set({ consumedAt: now })
    .where(and(eq(pastureEmailVerifications.emailHash, emailHash), isNull(pastureEmailVerifications.consumedAt)));
  const rows = await db.insert(pastureEmailVerifications)
    .values({ emailHash, codeHash, expiresAt })
    .returning();
  return rows[0];
}

async function latestVerification(emailHash) {
  const db = getDb();
  const rows = await db.select().from(pastureEmailVerifications)
    .where(and(eq(pastureEmailVerifications.emailHash, emailHash), isNull(pastureEmailVerifications.consumedAt)))
    .orderBy(desc(pastureEmailVerifications.createdAt))
    .limit(1);
  return rows[0] || null;
}

async function incrementVerificationAttempts(id) {
  const db = getDb();
  const rows = await db.update(pastureEmailVerifications)
    .set({ attempts: sql`${pastureEmailVerifications.attempts} + 1` })
    .where(eq(pastureEmailVerifications.id, id))
    .returning();
  return rows[0] || null;
}

async function consumeVerification(id, when = new Date()) {
  const db = getDb();
  await db.update(pastureEmailVerifications)
    .set({ consumedAt: when })
    .where(eq(pastureEmailVerifications.id, id));
}

async function findOrCreateUser(emailHash, emailMasked, sealedEmail = {}) {
  const db = getDb();
  const now = new Date();
  const values = {
    emailHash,
    emailMasked,
    emailCiphertext: sealedEmail.emailCiphertext || null,
    emailNonce: sealedEmail.emailNonce || null,
    emailTag: sealedEmail.emailTag || null,
    updatedAt: now
  };
  const rows = await db.insert(pastureUsers)
    .values(values)
    .onConflictDoUpdate({
      target: pastureUsers.emailHash,
      set: {
        emailMasked,
        emailCiphertext: values.emailCiphertext,
        emailNonce: values.emailNonce,
        emailTag: values.emailTag,
        updatedAt: now
      }
    })
    .returning();
  return rows[0] || null;
}

async function createSession(userId, tokenHash, expiresAt, userAgentSummary) {
  const db = getDb();
  const rows = await db.insert(pastureSessions)
    .values({ userId, tokenHash, expiresAt, userAgentSummary: userAgentSummary || null })
    .returning();
  return rows[0];
}

async function sessionByTokenHash(value) {
  const db = getDb();
  const now = new Date();
  const rows = await db.select({ session: pastureSessions, user: pastureUsers })
    .from(pastureSessions)
    .innerJoin(pastureUsers, eq(pastureSessions.userId, pastureUsers.id))
    .where(and(
      eq(pastureSessions.tokenHash, value),
      isNull(pastureSessions.revokedAt),
      gt(pastureSessions.expiresAt, now),
      eq(pastureUsers.status, "ACTIVE")
    ))
    .limit(1);
  if (!rows[0]) return null;
  await db.update(pastureSessions)
    .set({ lastSeenAt: now })
    .where(eq(pastureSessions.id, rows[0].session.id));
  return rows[0];
}

async function revokeSession(value) {
  const db = getDb();
  await db.update(pastureSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(pastureSessions.tokenHash, value), isNull(pastureSessions.revokedAt)));
}

async function sheepForUser(userId) {
  const db = getDb();
  const rows = await db.select().from(pastureSheep)
    .where(eq(pastureSheep.userId, userId))
    .limit(1);
  return rows[0] || null;
}

async function saveSheep(userId, appearance) {
  const db = getDb();
  const existing = await sheepForUser(userId);
  if (existing) {
    const rows = await db.update(pastureSheep)
      .set({ ...appearance, updatedAt: new Date() })
      .where(eq(pastureSheep.id, existing.id))
      .returning();
    return { sheep: rows[0] || existing, created: false };
  }
  const rows = await db.insert(pastureSheep)
    .values({ userId, ...appearance })
    .returning();
  return { sheep: rows[0], created: true };
}

module.exports = {
  consumePastureRateLimit,
  createVerification,
  latestVerification,
  incrementVerificationAttempts,
  consumeVerification,
  findOrCreateUser,
  createSession,
  sessionByTokenHash,
  revokeSession,
  sheepForUser,
  saveSheep
};
