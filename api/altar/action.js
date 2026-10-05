const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const { getAuthenticatedPublisher, isSteward } = require("../_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("../_security/http");
const { clientIp, consume } = require("../_security/rate-limit");
const { readAltarState, writeAltarState, applySupervisionAction, routeSupervision } = require("../_altar/store");

module.exports = async function handler(request, response) {
  const parsed = requireJsonPost(request);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });

  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!isSteward(publisher)) return sendJson(response, 403, { ok: false, reason: "forbidden" });
  if (!consume("altar:" + publisher.id + ":" + clientIp(request), 30, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }

  const routeId = String(parsed.body && parsed.body.routeId || "").trim();
  const action = String(parsed.body && parsed.body.action || "").trim();
  const reason = String(parsed.body && parsed.body.reason || "").trim().slice(0, 500);
  if (!routeId || !["needs_changes", "pause", "lock", "restore"].includes(action)) {
    return sendJson(response, 400, { ok: false, reason: "invalid_action" });
  }
  if (!token) return sendJson(response, 503, { ok: false, reason: "supervision_unavailable" });

  try {
    const routes = await readCanonicalRoutes();
    if (!routes.some((route) => (route.routeId || route.id) === routeId)) {
      return sendJson(response, 404, { ok: false, reason: "route_not_found" });
    }
    const state = await readAltarState();
    const next = applySupervisionAction(state, {
      routeId,
      action,
      actor: publisher.username,
      timestamp: new Date().toISOString(),
      reason
    });
    await writeAltarState(next, `Altar ${action}: ${routeId}`, state.sha);
    return sendJson(response, 200, { ok: true, routeId, supervision: routeSupervision(next, routeId) });
  } catch (error) {
    return sendJson(response, 503, { ok: false, reason: "supervision_unavailable" });
  }
};

async function readCanonicalRoutes() {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: "Bearer " + token,
    "User-Agent": "budao-altar-action",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/routes.json?ref=${branch}`, { headers });
  if (!result.ok) throw new Error("routes_unavailable");
  const file = await result.json();
  const parsed = JSON.parse(Buffer.from(file.content || "", "base64").toString("utf8") || "[]");
  return Array.isArray(parsed) ? parsed : [];
}
