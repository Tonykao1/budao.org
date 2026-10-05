const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const routesPath = "routes.json";
const presentationSlots = ["IMS", "BACBC", "HD"];
const { getAuthenticatedPublisher, isSteward } = require("./_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson: sendProtectedJson } = require("./_security/http");
const { clientIp, consume } = require("./_security/rate-limit");
const { readAltarState, writeAltarState, applySupervisionAction, routeSupervision } = require("./_altar/store");

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method === "POST") {
    return handleAltarAction(request, response);
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
    return;
  }

  try {
    const routes = await readRoutes();
    const scope = requestScope(request);

    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

    if (scope === "mine") {
      const publisher = getAuthenticatedPublisher(request);
      if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
      return sendJson(response, 200, privateRoutesForLeader(routes, publisher));
    }

    if (scope === "altar") {
      const publisher = getAuthenticatedPublisher(request);
      if (!publisher) return sendProtectedJson(response, 401, { ok: false, reason: "unauthorized" });
      if (!isSteward(publisher)) return sendProtectedJson(response, 403, { ok: false, reason: "forbidden" });
      return handleAltarRead(response, routes);
    }

    let supervisionRoutes = {};
    try {
      const altar = await readAltarState();
      supervisionRoutes = altar.routes || {};
    } catch (error) {
      supervisionRoutes = {};
    }

    sendJson(response, 200, projectPublicRoutes(routes, new Date(), supervisionRoutes));
  } catch (error) {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    sendJson(response, 200, []);
  }
};

async function handleAltarRead(response, routes) {
  let state = { routes: {}, audit: [] };
  let supervisionAvailable = true;
  try {
    state = await readAltarState();
  } catch (error) {
    supervisionAvailable = false;
  }
  const nowMs = Date.now();
  const combined = (Array.isArray(routes) ? routes : []).map(function (route) {
    const supervision = routeSupervision(state, route.routeId || route.id);
    const eventMs = eventTimeMs(route);
    return {
      ...route,
      supervision,
      phase: Number.isFinite(eventMs) && eventMs < nowMs ? "past" : "future"
    };
  });
  return sendProtectedJson(response, 200, { ok: true, supervisionAvailable, routes: combined });
}

async function handleAltarAction(request, response) {
  const scope = requestScope(request);
  if (scope !== "altar") return sendProtectedJson(response, 405, { ok: false, reason: "method_not_allowed" });

  const parsed = requireJsonPost(request);
  if (parsed.error) return sendProtectedJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendProtectedJson(response, 403, { ok: false, reason: "forbidden" });

  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendProtectedJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!isSteward(publisher)) return sendProtectedJson(response, 403, { ok: false, reason: "forbidden" });
  if (!consume("altar:" + publisher.id + ":" + clientIp(request), 30, 60_000)) {
    return sendProtectedJson(response, 429, { ok: false, reason: "rate_limited" });
  }
  if (!token) return sendProtectedJson(response, 503, { ok: false, reason: "supervision_unavailable" });

  const routeId = String(parsed.body.routeId || "").trim();
  const action = String(parsed.body.action || "").trim();
  const reason = String(parsed.body.reason || "").trim().slice(0, 500);
  if (!routeId || !["needs_changes", "pause", "lock", "restore"].includes(action)) {
    return sendProtectedJson(response, 400, { ok: false, reason: "invalid_action" });
  }

  try {
    const routes = await readRoutes();
    if (!routes.some(function (route) { return (route.routeId || route.id) === routeId; })) {
      return sendProtectedJson(response, 404, { ok: false, reason: "route_not_found" });
    }
    const state = await readAltarState();
    const next = applySupervisionAction(state, {
      routeId,
      action,
      actor: publisher.username,
      timestamp: new Date().toISOString(),
      reason
    });
    await writeAltarState(next, "Altar " + action + ": " + routeId, state.sha);
    return sendProtectedJson(response, 200, {
      ok: true,
      routeId,
      supervision: routeSupervision(next, routeId)
    });
  } catch (error) {
    return sendProtectedJson(response, 503, { ok: false, reason: "supervision_unavailable" });
  }
}

async function readRoutes() {
  const result = await fetch(contentsUrl(), {
    method: "GET",
    headers: requestHeaders()
  });

  if (result.status === 404) return [];
  if (!result.ok) throw new Error("routes_unavailable");

  const file = await result.json();
  const text = Buffer.from(file.content || "", "base64").toString("utf8");
  const routes = JSON.parse(text || "[]");
  return Array.isArray(routes) ? routes : [];
}

function projectPublicRoutes(routes, now = new Date(), supervisionRoutes = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const candidates = (Array.isArray(routes) ? routes : []).map(function (route, index) {
    return { route, index, eventMs: eventTimeMs(route) };
  }).filter(function (item) {
    const supervision = routeSupervision({ routes: supervisionRoutes, audit: [] }, item.route && (item.route.routeId || item.route.id));
    return Number.isFinite(item.eventMs) && supervision.status === "active";
  });

  const upcoming = candidates.filter((item) => item.eventMs >= nowMs)
    .sort(compareAscending);
  const past = candidates.filter((item) => item.eventMs < nowMs)
    .sort(compareDescending);
  const selected = upcoming.slice(0, 3);

  if (selected.length < 3) {
    selected.push(...past.slice(0, 3 - selected.length));
  }

  return selected.map(function (item, index) {
    return { ...item.route, slot: presentationSlots[index] };
  });
}

function privateRoutesForLeader(routes, publisher) {
  const owned = (Array.isArray(routes) ? routes : []).filter(function (route) {
    return route && (route.leaderId === publisher.id || normalizeLeader(route.leader) === normalizeLeader(publisher.username));
  }).sort(function (left, right) {
    return String(right.updatedAt || right.createdAt || "").localeCompare(String(left.updatedAt || left.createdAt || ""));
  });

  if (!owned.length) return [];
  return [{ ...owned[0], slot: "" }];
}

function compareAscending(left, right) {
  return left.eventMs - right.eventMs || left.index - right.index;
}

function compareDescending(left, right) {
  return right.eventMs - left.eventMs || left.index - right.index;
}

function eventTimeMs(route) {
  if (!route || typeof route !== "object") return NaN;
  const dateMatch = String(route.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = String(route.time || "00:00").match(/^(\d{1,2}):(\d{2})/);
  if (!dateMatch || !timeMatch) return NaN;

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return NaN;

  const timezone = validTimezone(route.timezone) ? route.timezone : "Asia/Shanghai";
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let candidate = localAsUtc;

  for (let pass = 0; pass < 2; pass += 1) {
    const parts = zonedParts(candidate, timezone);
    if (!parts) return NaN;
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
    candidate = localAsUtc - (represented - candidate);
  }

  return candidate;
}

function zonedParts(ms, timezone) {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(ms));
    const values = {};
    parts.forEach((part) => {
      if (part.type !== "literal") values[part.type] = Number(part.value);
    });
    return values;
  } catch (error) {
    return null;
  }
}

function validTimezone(timezone) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: String(timezone || "") });
    return Boolean(timezone);
  } catch (error) {
    return false;
  }
}

function normalizeLeader(value) {
  return String(value || "").trim().toLowerCase();
}

function requestScope(request) {
  try {
    const url = new URL(request.url || "/api/routes", "https://budao.org");
    return url.searchParams.get("scope") || "";
  } catch (error) {
    return "";
  }
}

function contentsUrl() {
  return "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + routesPath + "?ref=" + branch;
}

function requestHeaders() {
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "budao-routes-reader",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = "Bearer " + token;
  return headers;
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, status, body) {
  response.status(status).json(body);
}

module.exports.projectPublicRoutes = projectPublicRoutes;
module.exports.eventTimeMs = eventTimeMs;
module.exports.privateRoutesForLeader = privateRoutesForLeader;
module.exports.handleAltarRead = handleAltarRead;
module.exports.handleAltarAction = handleAltarAction;
