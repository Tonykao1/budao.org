const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const routesPath = "routes.json";
const { getAuthenticatedPublisher } = require("./_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("./_security/http");
const { clientIp, consume } = require("./_security/rate-limit");
const { validateRoute } = require("./_security/route-schema");
const { isManagedRouteImageUrl } = require("./_security/route-image");
const { readAltarState, routeSupervision } = require("./_altar/store");

module.exports = async function handler(request, response) {
  const parsed = requireJsonPost(request);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });

  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!consume("publish:" + publisher.id + ":" + clientIp(request), 10, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }
  if (!token) return sendJson(response, 503, { ok: false, reason: "publishing_unavailable" });

  const validated = validateRoute(parsed.body);
  if (validated.error) return sendJson(response, 400, { ok: false, reason: validated.error });

  try {
    const current = await readRoutesFile();
    const existing = findExistingRoute(current.routes, publisher);

    if (existing) {
      try {
        const altar = await readAltarState();
        const supervision = routeSupervision(altar, existing.routeId || existing.id);
        if (supervision.locked) return sendJson(response, 423, { ok: false, reason: "route_locked" });
      } catch (error) {
        // Fail open for ordinary publication: the altar must never become a single point of failure.
      }
    }

    const routeToSave = normalizeRoute({
      ...validated.value,
      id: existing && (existing.id || existing.routeId) || leaderRouteId(publisher),
      routeId: existing && (existing.routeId || existing.id) || leaderRouteId(publisher),
      leaderId: publisher.id,
      leader: publisher.username,
      owner: publisher.username,
      createdAt: existing && existing.createdAt || undefined,
      image: validated.value.image || existing && (existing.image || existing.imageUrl) || "",
      imageAlt: validated.value.imageAlt || existing && existing.imageAlt || validated.value.title || "",
      qrCode: validated.value.qrCode || existing && existing.qrCode || ""
    });

    if (routeToSave.image && existing && routeToSave.image === (existing.image || existing.imageUrl || "")) {
      // Existing managed image is retained unchanged.
    } else if (routeToSave.image && !isManagedRouteImageUrl(routeToSave.image, publisher.username, { owner, repo, branch })) {
      return sendJson(response, 400, { ok: false, reason: "untrusted_image_url" });
    }

    const share = sharePayload(routeToSave);

    if (existing && sameRoute(normalizeRoute(existing), routeToSave) && !hasPersistedPresentationSlots(current.routes)) {
      return sendJson(response, 200, {
        ok: true,
        idempotent: true,
        route: routeToSave,
        shareImageUrl: share.shareImageUrl,
        emailShare: share.emailShare,
        commit: null
      });
    }

    const routes = current.routes
      .filter(function (item) { return !belongsToLeader(item, publisher); })
      .map(function (item) { return normalizeRoute(item); });
    routes.push(routeToSave);

    const persisted = routes.map(stripPresentationSlot);

    if (!persisted.length) throw knownError("empty_routes_blocked", 409);

    const content = JSON.stringify(persisted, null, 2) + "\n";
    const commit = await writeRoutesFile({
      content,
      message: "Publish Route: " + routeToSave.title,
      sha: current.sha
    });

    return sendJson(response, 200, {
      ok: true,
      idempotent: false,
      route: stripPresentationSlot(routeToSave),
      shareImageUrl: share.shareImageUrl,
      emailShare: share.emailShare,
      commit: commit.commit && commit.commit.sha ? commit.commit.sha : null
    });
  } catch (error) {
    if (error.reason) return sendJson(response, error.status || 500, { ok: false, reason: error.reason });
    return sendJson(response, 500, { ok: false, reason: "network_failed" });
  }
};

async function readRoutesFile() {
  const result = await githubFetch(contentsUrl(), { method: "GET" });
  if (result.status === 404) return { routes: [], sha: null };
  if (result.status === 401 || result.status === 403) throw knownError("token_invalid", 401);
  if (!result.ok) throw knownError("network_failed", result.status);

  const file = await result.json();
  const text = Buffer.from(file.content || "", "base64").toString("utf8");
  try {
    const routes = JSON.parse(text || "[]");
    if (!Array.isArray(routes)) throw new Error("routes_not_array");
    return { routes, sha: file.sha };
  } catch (error) {
    throw knownError("json_conflict", 409);
  }
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
      "User-Agent": "budao-tent-publisher",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
}

function contentsUrl() {
  return "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + routesPath + "?ref=" + branch;
}

function leaderRouteId(publisher) {
  return "budao-leader-" + safeKey(publisher.username || publisher.id);
}

function safeKey(value) {
  return String(value || "leader").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "leader";
}

function belongsToLeader(route, publisher) {
  if (!route || !publisher) return false;
  if (route.leaderId && route.leaderId === publisher.id) return true;
  if (route.leader && String(route.leader).trim().toLowerCase() === String(publisher.username || "").trim().toLowerCase()) return true;
  return false;
}

function findExistingRoute(routes, publisher) {
  return (Array.isArray(routes) ? routes : []).find((route) => belongsToLeader(route, publisher)) || null;
}

function normalizeRoute(route) {
  const now = new Date().toISOString();
  return {
    id: route.id || route.routeId || "",
    routeId: route.routeId || route.id || "",
    leaderId: route.leaderId || "",
    leader: route.leader || "",
    owner: route.owner || route.leader || "",
    slot: route.slot || "",
    country: route.country || "",
    city: route.city || "",
    region: route.region || "",
    location: route.location || route.locationName || "",
    title: route.title || "",
    description: route.description || "",
    time: route.time || "",
    duration: route.duration || "",
    distance: route.distance || "",
    surface: route.surface || "",
    elevation: route.elevation || "",
    difficulty: route.difficulty || "",
    suitableFor: route.suitableFor || "",
    equipmentMinimum: route.equipmentMinimum || "",
    timezone: route.timezone || "Asia/Shanghai",
    date: normalizeDate(route.date || ""),
    meetingPlace: route.meetingPlace || "",
    participantRequirements: route.participantRequirements || "",
    image: resolveImage(route.image),
    qrCode: resolveQrImage(route.qrCode),
    imageAlt: route.imageAlt || route.title || "",
    createdAt: route.createdAt || now,
    updatedAt: route.updatedAt || now
  };
}

function stripPresentationSlot(route) {
  return { ...route, slot: "" };
}

function hasPersistedPresentationSlots(routes) {
  return (Array.isArray(routes) ? routes : []).some(function (route) {
    return Boolean(route && route.slot);
  });
}

function resolveImage(image) {
  const value = String(image || "");
  if (value.indexOf("data:image/") === 0 && value.length > 240000) return "";
  return resolveImageWithoutSizeLimit(value);
}

function resolveQrImage(image) {
  const value = String(image || "");
  if (value.indexOf("data:image/") === 0 && value.length > 700000) return "";
  return resolveImageWithoutSizeLimit(value);
}

function resolveImageWithoutSizeLimit(image) {
  const value = String(image || "");
  if (value === "" || value.indexOf("data:image/") === 0 || value.indexOf("blob:") === 0 ||
      value.indexOf("http://") === 0 || value.indexOf("https://") === 0 || value.indexOf("/") === 0 ||
      !/^[a-z]+:/i.test(value)) return value;
  return "";
}

function sameRoute(left, right) {
  const a = { ...left, updatedAt: "", slot: "" };
  const b = { ...right, updatedAt: "", slot: "" };
  return JSON.stringify(a) === JSON.stringify(b);
}

function sharePayload(route) {
  const encodedRouteId = encodeURIComponent(route.routeId);
  const baseUrl = process.env.BUDAO_PUBLIC_URL || "https://budao.org";
  const shareImageUrl = baseUrl.replace(/\/$/, "") + "/api/share-route?routeId=" + encodedRouteId;
  return {
    shareImageUrl,
    emailShare: {
      enabled: false,
      to: [],
      subject: "Budao 同行 · " + route.title,
      routeId: route.routeId,
      shareImageUrl
    }
  };
}

function normalizeDate(date) {
  const value = String(date || "");
  const match = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  if (!match) return value;
  return [match[1], match[2].padStart(2, "0"), match[3].padStart(2, "0")].join("-");
}

function knownError(reason, status) {
  const error = new Error(reason);
  error.reason = reason;
  error.status = status;
  return error;
}

module.exports.belongsToLeader = belongsToLeader;
module.exports.leaderRouteId = leaderRouteId;
module.exports.stripPresentationSlot = stripPresentationSlot;
module.exports.hasPersistedPresentationSlots = hasPersistedPresentationSlots;
