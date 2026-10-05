const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const { getAuthenticatedPublisher, isSteward } = require("../_security/auth");
const { sendJson } = require("../_security/http");
const { readAltarState, routeSupervision } = require("../_altar/store");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!isSteward(publisher)) return sendJson(response, 403, { ok: false, reason: "forbidden" });

  try {
    const routes = await readCanonicalRoutes();
    let state = { routes: {}, audit: [] };
    let supervisionAvailable = true;
    try {
      state = await readAltarState();
    } catch (error) {
      supervisionAvailable = false;
    }
    const now = Date.now();
    const combined = routes.map((route) => {
      const supervision = routeSupervision(state, route.routeId || route.id);
      const when = eventTime(route);
      return {
        ...route,
        supervision,
        phase: Number.isFinite(when) && when < now ? "past" : "future"
      };
    });
    response.setHeader("Cache-Control", "no-store");
    return sendJson(response, 200, { ok: true, supervisionAvailable, routes: combined });
  } catch (error) {
    return sendJson(response, 503, { ok: false, reason: "routes_unavailable" });
  }
};

async function readCanonicalRoutes() {
  const result = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/routes.json?ref=${branch}`, {
    headers: requestHeaders()
  });
  if (!result.ok) throw new Error("routes_unavailable");
  const file = await result.json();
  const parsed = JSON.parse(Buffer.from(file.content || "", "base64").toString("utf8") || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

function requestHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "budao-altar-routes",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

function eventTime(route) {
  const date = String(route && route.date || "");
  const time = String(route && route.time || "00:00");
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const tm = time.match(/^(\d{1,2}):(\d{2})/);
  if (!match || !tm) return NaN;
  return Date.parse(`${match[1]}-${match[2]}-${match[3]}T${tm[1].padStart(2, "0")}:${tm[2]}:00+08:00`);
}

module.exports.readCanonicalRoutes = readCanonicalRoutes;
