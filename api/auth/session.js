const { getAuthenticatedPublisher } = require("../_security/auth");
const { sendJson } = require("../_security/http");
const pastureAdminHandler = require("../_security/pasture-admin-handler");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
  const url = new URL(request.url || "/api/auth/session", "https://budao.org");
  if (url.searchParams.get("view") === "pasture-residents") {
    return pastureAdminHandler(request, response);
  }
  const user = getAuthenticatedPublisher(request);
  if (!user) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  return sendJson(response, 200, { ok: true, slot: user.slot });
};
