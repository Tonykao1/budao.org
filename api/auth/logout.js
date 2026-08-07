const { clearSessionCookie } = require("../_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("../_security/http");

module.exports = async function handler(request, response) {
  const parsed = requireJsonPost(request);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });
  if (Object.keys(parsed.body).length) return sendJson(response, 400, { ok: false, reason: "invalid_request" });
  response.setHeader("Set-Cookie", clearSessionCookie(process.env.NODE_ENV !== "test"));
  return sendJson(response, 200, { ok: true });
};
