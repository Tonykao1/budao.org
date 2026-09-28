const { getDb } = require("../db/client");
const { sendJson } = require("./_security/http");
const { purgeExpiredPrayers } = require("./_security/prayer-admin-store");

module.exports = async function prayerPurgeHandler(request, response) {
  const secret = process.env.CRON_SECRET;
  const authorization = String(request.headers && request.headers.authorization || "");
  if (!secret || authorization !== "Bearer " + secret) return sendJson(response, 401, { ok: false });
  try {
    const rows = await purgeExpiredPrayers(getDb());
    return sendJson(response, 200, { ok: true, deleted: rows.length });
  } catch (error) {
    return sendJson(response, 503, { ok: false, reason: "prayer_service_unavailable" });
  }
};
