const { getAuthenticatedPublisher } = require("./auth");
const { sendJson } = require("./http");
const domain = require("./pasture-auth-domain");
const store = require("./pasture-auth-store");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (publisher.username !== "tony") return sendJson(response, 403, { ok: false, reason: "forbidden" });

  try {
    await store.ensurePastureSchema();
    const rows = await store.listResidentsForAdmin();
    const residents = rows.map((row) => {
      let email = null;
      try {
        email = domain.decryptEmail({
          emailCiphertext: row.email_ciphertext,
          emailNonce: row.email_nonce,
          emailTag: row.email_tag
        });
      } catch (error) {
        email = null;
      }
      return {
        id: row.id,
        email: email || row.email_masked,
        emailAvailable: Boolean(email),
        status: row.status,
        hasSheep: Boolean(row.has_sheep),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        lastSeenAt: row.last_seen_at || null
      };
    });
    return sendJson(response, 200, { ok: true, residents, count: residents.length });
  } catch (error) {
    console.error("pasture-admin", String(error && error.message || error));
    return sendJson(response, 500, { ok: false, reason: "service_unavailable" });
  }
};
