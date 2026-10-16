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
const { requireJsonPost, requireSameOrigin } = require("./_security/http");
const { clientIp, consume } = require("./_security/rate-limit");
const cancellation = require("../route-cancellation-core");

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "GET") {
    await handleGet(response);
    return;
  }

  if (request.method === "POST") {
    await handleStatusPost(request, response);
    return;
  }

  sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
};

async function handleGet(response) {
  try {
    const current = await readRoutesFile();
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    sendJson(response, 200, fixedRoutesOnly(current.routes));
  } catch (error) {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    sendJson(response, 200, []);
  }
}

async function handleStatusPost(request, response) {
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
    const commit = await writeRoutesFile({
      content: JSON.stringify(routes, null, 2) + "\n",
      sha: current.sha,
      message: action === "cancel" ?
        "Cancel Route: " + (next.title || publisher.slot) :
        "Restore Route: " + (next.title || publisher.slot)
    });

    sendJson(response, 200, {
      ok: true,
      route: next,
      branch,
      commit: commit.commit && commit.commit.sha ? commit.commit.sha : null
    });
  } catch (error) {
    sendJson(response, error.status || 500, {
      ok: false,
      reason: error.reason || "network_failed"
    });
  }
}

async function readRoutesFile() {
  const result = await fetch(contentsUrl(), {
    method: "GET",
    headers: requestHeaders()
  });

  if (result.status === 404) {
    return { routes: [], sha: null };
  }

  if (!result.ok) {
    throw knownError("routes_unavailable", result.status);
  }

  const file = await result.json();
  let routes;

  try {
    const text = Buffer.from(file.content || "", "base64").toString("utf8");
    routes = JSON.parse(text || "[]");
  } catch (error) {
    throw knownError("json_conflict", 409);
  }

  if (!Array.isArray(routes)) {
    throw knownError("json_conflict", 409);
  }

  return { routes, sha: file.sha || null };
}

async function writeRoutesFile({ content, message, sha }) {
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch
  };

  if (sha) body.sha = sha;

  const result = await fetch(contentsUrl(), {
    method: "PUT",
    headers: requestHeaders(true),
    body: JSON.stringify(body)
  });

  if (result.status === 401 || result.status === 403) {
    throw knownError("token_invalid", 401);
  }
  if (result.status === 409 || result.status === 422) {
    throw knownError("commit_conflict", 409);
  }
  if (!result.ok) {
    throw knownError("network_failed", result.status);
  }

  return result.json();
}

function fixedRoutesOnly(routes) {
  return fixedSlots
    .map(function (slot) {
      return routes.find(function (route) {
        return route.slot === slot;
      });
    })
    .filter(Boolean);
}

function contentsUrl() {
  return "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + routesPath + "?ref=" + branch;
}

function requestHeaders(json) {
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "budao-routes-resource",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

function normalizeSlot(value) {
  const slot = String(value || "").trim().toUpperCase();
  return fixedSlots.indexOf(slot) >= 0 ? slot : "";
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, status, body) {
  response.status(status).json(body);
}

function knownError(reason, status) {
  const error = new Error(reason);
  error.reason = reason;
  error.status = status;
  return error;
}
