const { getAuthenticatedPublisher } = require("../_security/auth");
const { sendJson } = require("../_security/http");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
  const user = getAuthenticatedPublisher(request);
  if (!user) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  return sendJson(response, 200, { ok: true, slot: user.slot });
};
