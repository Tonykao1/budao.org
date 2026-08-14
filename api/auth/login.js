const { authConfigurationStatus, authenticateCredentials, createSessionCookie } = require("../_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("../_security/http");
const { clientIp, consume } = require("../_security/rate-limit");

module.exports = async function handler(request, response) {
  const parsed = requireJsonPost(request);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });
  if (!consume("login:" + clientIp(request), 5, 15 * 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }

  const configuration = authConfigurationStatus();
  if (!configuration.usersValid) {
    return sendJson(response, 503, { ok: false, reason: "user_configuration_unavailable" });
  }
  if (!configuration.sessionSecretValid) {
    return sendJson(response, 503, { ok: false, reason: "session_configuration_unavailable" });
  }

  const keys = Object.keys(parsed.body);
  if (keys.length !== 2 || !keys.includes("email") || !keys.includes("password") ||
      typeof parsed.body.email !== "string" || parsed.body.email.length > 254 ||
      typeof parsed.body.password !== "string" || parsed.body.password.length > 256) {
    return sendJson(response, 400, { ok: false, reason: "invalid_request" });
  }

  const user = authenticateCredentials(parsed.body.email, parsed.body.password);
  if (!user) return sendJson(response, 401, { ok: false, reason: "invalid_credentials" });

  try {
    response.setHeader("Set-Cookie", createSessionCookie(user, process.env.NODE_ENV !== "test"));
  } catch (error) {
    return sendJson(response, 503, { ok: false, reason: "auth_unavailable" });
  }
  return sendJson(response, 200, { ok: true, slot: user.slot });
};
