const { and, asc, eq, gt, isNull, lte, or, sql } = require("drizzle-orm");
const { prayerAuditEvents, prayerRateLimits, prayerRequests } = require("../../db/schema");

const LIST_FIELDS = {
  id: prayerRequests.id, bodyCiphertext: prayerRequests.bodyCiphertext,
  bodyNonce: prayerRequests.bodyNonce, bodyTag: prayerRequests.bodyTag,
  visibility: prayerRequests.visibility, status: prayerRequests.status,
  createdAt: prayerRequests.createdAt, assignedSlot: prayerRequests.assignedSlot,
  claimedAt: prayerRequests.claimedAt, completedAt: prayerRequests.completedAt
};

async function listPrayerRequests(db, user, status, now = new Date()) {
  await purgeExpiredPrayers(db, now);
  const scope = status === "NEW" ? isNull(prayerRequests.assignedSlot) : eq(prayerRequests.assignedSlot, user.slot);
  const retained = status === "COMPLETED" ? gt(prayerRequests.deleteAfter, now) : undefined;
  return db.select(LIST_FIELDS).from(prayerRequests).where(and(eq(prayerRequests.status, status), scope, retained))
    .orderBy(asc(prayerRequests.createdAt)).limit(200);
}

async function purgeExpiredPrayers(db, now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 86400000);
  const expired = await db.delete(prayerRequests).where(and(eq(prayerRequests.status, "COMPLETED"), or(
    lte(prayerRequests.deleteAfter, now),
    and(isNull(prayerRequests.deleteAfter), lte(prayerRequests.completedAt, cutoff))
  ))).returning({ id: prayerRequests.id });
  await db.delete(prayerRateLimits).where(lte(prayerRateLimits.windowStartedAt, new Date(now.getTime() - 10 * 60_000)));
  return expired;
}

async function performAuditedPrayerAction(db, user, prayerId, action, now = new Date()) {
  const isClaim = action === "CLAIM";
  const deleteAfter = new Date(now.getTime() + 30 * 86400000);
  const result = await db.execute(isClaim ? sql`
    WITH changed AS (
      UPDATE prayer_requests SET status = 'PRAYING', assigned_slot = ${user.slot}, claimed_by = ${user.id}, claimed_at = ${now}
      WHERE id = ${prayerId} AND status = 'NEW' AND assigned_slot IS NULL RETURNING id
    )
    INSERT INTO prayer_audit_events (prayer_id, event_type, actor_id, actor_slot)
      SELECT id, 'CLAIM', ${user.id}, ${user.slot} FROM changed RETURNING prayer_id
  ` : sql`
    WITH changed AS (
      UPDATE prayer_requests SET status = 'COMPLETED', completed_at = ${now}, delete_after = ${deleteAfter}
      WHERE id = ${prayerId} AND status = 'PRAYING' AND assigned_slot = ${user.slot} RETURNING id
    )
    INSERT INTO prayer_audit_events (prayer_id, event_type, actor_id, actor_slot)
      SELECT id, 'COMPLETE', ${user.id}, ${user.slot} FROM changed RETURNING prayer_id
  `);
  const rows = Array.isArray(result) ? result : result.rows || [];
  return { changed: rows.length === 1 };
}

async function recordPrayerAudit(db, user, prayerIds, eventType) {
  if (!prayerIds.length) return;
  await db.insert(prayerAuditEvents).values(prayerIds.map((prayerId) => ({
    prayerId, eventType, actorId: user.id, actorSlot: user.slot, metadata: {}
  })));
}

module.exports = { listPrayerRequests, performAuditedPrayerAction, purgeExpiredPrayers, recordPrayerAudit };
