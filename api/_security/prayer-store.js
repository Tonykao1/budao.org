const { prayerRequests } = require("../../db/schema");
const { sql } = require("drizzle-orm");

async function createPrayerRequest(db, record) {
  const rows = await db.insert(prayerRequests)
    .values(record)
    .onConflictDoNothing({ target: prayerRequests.idempotencyKeyHash })
    .returning({ id: prayerRequests.id });
  return { created: rows.length > 0 };
}

async function consumePrayerSubmissionLimit(db, keyHash, now = new Date()) {
  const resetBefore = new Date(now.getTime() - 10 * 60_000);
  const result = await db.execute(sql`
    INSERT INTO prayer_rate_limits (key_hash, window_started_at, count)
    VALUES (${keyHash}, ${now}, 1)
    ON CONFLICT (key_hash) DO UPDATE SET
      count = CASE WHEN prayer_rate_limits.window_started_at <= ${resetBefore} THEN 1 ELSE prayer_rate_limits.count + 1 END,
      window_started_at = CASE WHEN prayer_rate_limits.window_started_at <= ${resetBefore} THEN ${now} ELSE prayer_rate_limits.window_started_at END
    RETURNING count <= 5 AS allowed
  `);
  const rows = Array.isArray(result) ? result : result.rows || [];
  return rows.length === 1 && rows[0].allowed === true;
}

module.exports = { consumePrayerSubmissionLimit, createPrayerRequest };
