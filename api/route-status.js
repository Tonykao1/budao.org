const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH ||
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF) || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const routesPath = "routes.json";
const fixedSlots = ["IMS", "BACBC"];
const slotOwners = {
  IMS: "IMS@budao.org",
  BACBC: "BACBC@budao.org"
};
const { getAuthenticatedPublisher } = require("./_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("./_security/http");
const { clientIp, consume } = require("./_security/rate-limit");
const cancellation = require("../route-cancellation-core");

module.exports = async function handler(request, response) {
  const parsed = requireJsonPost(request);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });

  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!consume("route-status:" + publisher.id + ":" + clientIp(request), 12, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }
  if (!token) return sendJson(response, 503, { ok: false, reason: "publishing_unavailable" });

  const action = String(parsed.body && parsed.body.action || "").trim().toLowerCase();
  if (action !== "cancel" && action !== "restore") {
    return sendJson(response, 400, { ok: false, reason: "invalid_action" });
  }

  try {
    const current = await readRoutesFile();
    const routeIndex = current.routes.findIndex(function (route) {
      return normalizeSlot(route.slot) === publisher.slot;
    });

    if (routeIndex < 0) {
      return sendJson(response, 404, { ok: false, reason: "route_not_found" });
    }

    const route = current.routes[routeIndex];
    const actor = "leader:" + publisher.slot;
    let next;

    if (action === "cancel") {
      next = cancellation.cancelRoute(route, {
        code: parsed.body.cancelCode,
        publicNote: parsed.body.publicNote,
        actor,
        at: new Date().toISOString()
      });
    } else {
      next = cancellation.restoreRoute(route, {
        actor,
        at: new Date().toISOString()
      });
    }

    next.slot = publisher.slot;
    next.owner = slotOwners[publisher.slot];
    next.updatedAt = new Date().toISOString();

    const routes = current.routes.slice();
    routes[routeIndex] = next;
    const content = JSON.stringify(routes, null, 2) + "\n";
    const commit = await writeRoutesFile({
      content,
      sha: current.sha,
      message: action === "cancel" ?
        "Cancel Route: " + (next.title || publisher.slot) :
        "Restore Route: " + (next.title || publisher.slot)
    });

    return sendJson(response, 200, {
      ok: true,
      route: next,
      branch,
      commit: commit.commit && commit.commit.sha ? commit.commit.sha : null
    });
  } catch (error) {
    return sendJson(response, error.status || 500, {
      ok: false,
      reason: error.reason || "network_failed"
    });
  }
};

async function readRoutesFile() {
  const result = await githubFetch(contentsUrl(), { method: "GET" });
  if (result.status === 404) throw knownError("route_not_found", 404);
  if (result.status === 401 || result.status === 403) throw knownError("token_invalid", 401);
  if (!result.ok) throw knownError("network_failed", result.status);

  const file = await result.json();
  let routes;
  try {
    routes = JSON.parse(Buffer.from(file.content || "", "base64").toString("utf8") || "[]");
  } catch (error) {
    throw knownError("json_conflict", 409);
  }
  if (!Array.isArray(routes)) throw knownError("json_conflict", 409);
  return { routes, sha: file.sha };
}

async function writeRoutesFile({ content, message, sha }) {
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch
  };
  if (sha) body.sha = sha;

  const result = await githubFetch(contentsUrl(), {
    method: "PUT",
    body: JSON.stringify(body)
  });
  if (result.status === 401 || result.status === 403) throw knownError("token_invalid", 401);
  if (result.status === 409 || result.status === 422) throw knownError("commit_conflict", 409);
  if (!result.ok) throw knownError("network_failed", result.status);
  return result.json();
}

function githubFetch(url, options) {
  return fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "User-Agent": "budao-route-status",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
}

function contentsUrl() {
  return "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + routesPath + "?ref=" + branch;
}

function normalizeSlot(value) {
  const slot = String(value || "").trim().toUpperCase();
  return fixedSlots.indexOf(slot) >= 0 ? slot : "";
}

function knownError(reason, status) {
  const error = new Error(reason);
  error.reason = reason;
  error.status = status;
  return error;
}
