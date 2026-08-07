const { getDb, sanitizeDatabaseError } = require("../../db/client");

module.exports = async function stewardshipHealth(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }
  try {
    const db = getDb();
    await db.execute("select 1");
    return res.status(200).json({ ok: true, database: "reachable" });
  } catch (error) {
    const body = sanitizeDatabaseError(error);
    return res.status(body.error === "database_not_configured" ? 503 : 502).json(body);
  }
};
