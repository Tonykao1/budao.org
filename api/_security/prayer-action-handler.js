const { getDb } = require("../../db/client");
const { getAuthorizedPrayerLeader } = require("./prayer-auth");
const { requireJsonPost, sendJson } = require("./http");
const { performAuditedPrayerAction } = require("./prayer-admin-store");
const ACTIONS = new Set(["CLAIM", "COMPLETE"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createPrayerActionHandler(dependencies = {}) {
  const applyAction = dependencies.applyAction || ((user, id, action) => performAuditedPrayerAction(getDb(), user, id, action));
  const auditAction = dependencies.auditAction;
  return async function prayerActionHandler(request, response) {
    const user = getAuthorizedPrayerLeader(request);
    if (!user) return sendJson(response, 401, { ok: false, reason: "authentication_required" });
    const parsed = requireJsonPost(request, 2048);
    if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
    const prayerId = String(parsed.body.prayerId || "");
    const action = String(parsed.body.action || "").toUpperCase();
    if (!UUID.test(prayerId) || !ACTIONS.has(action)) return sendJson(response, 400, { ok: false, reason: "invalid_request" });
    try {
      const result = await applyAction(user, prayerId, action);
      if (!result.changed) return sendJson(response, 409, { ok: false, reason: "prayer_unavailable" });
      if (auditAction) await auditAction(user, prayerId, action);
      return sendJson(response, 200, { ok: true });
    } catch (error) { return sendJson(response, 503, { ok: false, reason: "prayer_service_unavailable" }); }
  };
}
const handler = createPrayerActionHandler();
handler.createPrayerActionHandler = createPrayerActionHandler;
module.exports = handler;
