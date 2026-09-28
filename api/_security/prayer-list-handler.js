const { getDb } = require("../../db/client");
const { getAuthorizedPrayerLeader } = require("./prayer-auth");
const { sendJson } = require("./http");
const { decryptPrayerPayload } = require("./prayer-crypto");
const { listPrayerRequests, recordPrayerAudit } = require("./prayer-admin-store");
const STATUSES = new Set(["NEW", "PRAYING", "COMPLETED"]);
function iso(value) { return value instanceof Date ? value.toISOString() : value || null; }

function createPrayerListHandler(dependencies = {}) {
  const dataKey = dependencies.dataKey === undefined ? process.env.BUDAO_PRAYER_DATA_KEY : dependencies.dataKey;
  const listPrayers = dependencies.listPrayers || ((user, status) => listPrayerRequests(getDb(), user, status));
  const auditViews = dependencies.auditViews || ((user, ids) => recordPrayerAudit(getDb(), user, ids, "VIEW"));
  return async function prayerListHandler(request, response) {
    const user = getAuthorizedPrayerLeader(request);
    if (!user) return sendJson(response, 401, { ok: false, reason: "authentication_required" });
    if (request.method !== "GET") return sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
    const status = String(request.query && request.query.status || "NEW").toUpperCase();
    if (!STATUSES.has(status)) return sendJson(response, 400, { ok: false, reason: "invalid_status" });
    try {
      const rows = await listPrayers(user, status);
      const items = rows.map((row) => ({
        id: row.id, body: decryptPrayerPayload({ ciphertext: row.bodyCiphertext, nonce: row.bodyNonce, tag: row.bodyTag }, dataKey).body,
        visibility: row.visibility, status: row.status, createdAt: iso(row.createdAt), assignedSlot: row.assignedSlot || null,
        claimedAt: iso(row.claimedAt), completedAt: iso(row.completedAt)
      }));
      await auditViews(user, items.map((item) => item.id));
      return sendJson(response, 200, { ok: true, items });
    } catch (error) { return sendJson(response, 503, { ok: false, reason: "prayer_service_unavailable" }); }
  };
}
const handler = createPrayerListHandler();
handler.createPrayerListHandler = createPrayerListHandler;
module.exports = handler;
