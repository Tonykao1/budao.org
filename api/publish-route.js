const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const routesPath = "routes.json";
const routeLimitPerOwner = 2;
const allowedOwners = ["ims@budao.org", "bacbc@budao.org"];

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
    return;
  }

  if (!token) {
    sendJson(response, 401, { ok: false, reason: "token_invalid" });
    return;
  }

  let route;

  try {
    route = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
  } catch (error) {
    sendJson(response, 400, { ok: false, reason: "bad_json" });
    return;
  }

  if (!route || !route.title) {
    sendJson(response, 400, { ok: false, reason: "missing_route" });
    return;
  }

  try {
    const current = await readRoutesFile();
    const routeToSave = normalizeRoute(route);

    if (!allowedOwner(routeToSave.owner)) {
      sendJson(response, 403, { ok: false, error: "owner_not_allowed" });
      return;
    }

    const existing = findExistingRoute(current.routes, routeToSave);
    const share = sharePayload(routeToSave);

    if (existing && normalizeOwner(existing.owner) !== routeToSave.owner) {
      sendJson(response, 403, { ok: false, error: "owner_mismatch" });
      return;
    }

    if (existing) {
      routeToSave.id = existing.id || existing.routeId || routeToSave.id;
      routeToSave.routeId = existing.routeId || existing.id || routeToSave.routeId;
      routeToSave.createdAt = existing.createdAt || routeToSave.createdAt;
      routeToSave.image = routeToSave.image || existing.image || existing.imageUrl || "";
      routeToSave.qrCode = routeToSave.qrCode || existing.qrCode || "";
      routeToSave.imageAlt = routeToSave.imageAlt || existing.imageAlt || routeToSave.title || "";
    }

    if (existing && sameRoute(normalizeRoute(existing), routeToSave)) {
      sendJson(response, 200, {
        ok: true,
        idempotent: true,
        route: routeToSave,
        shareImageUrl: share.shareImageUrl,
        emailShare: share.emailShare,
        commit: null
      });
      return;
    }

    if (!existing && ownerRouteCount(current.routes, routeToSave.owner) >= routeLimitPerOwner) {
      sendJson(response, 403, { ok: false, error: "route_limit_reached" });
      return;
    }

    const routes = current.routes.filter((item) => item !== existing);

    routes.unshift(routeToSave);

    const content = JSON.stringify(routes, null, 2) + "\n";
    const commit = await writeRoutesFile({
      content,
      message: "Publish Route: " + route.title,
      sha: current.sha
    });

    sendJson(response, 200, {
      ok: true,
      idempotent: false,
      route: routeToSave,
      shareImageUrl: share.shareImageUrl,
      emailShare: share.emailShare,
      commit: commit.commit && commit.commit.sha ? commit.commit.sha : null
    });
  } catch (error) {
    if (error.reason) {
      sendJson(response, error.status || 500, { ok: false, reason: error.reason });
      return;
    }

    sendJson(response, 500, { ok: false, reason: "network_failed" });
  }
};

async function readRoutesFile() {
  const result = await githubFetch(contentsUrl(), {
    method: "GET"
  });

  if (result.status === 404) {
    return {
      routes: [],
      sha: null
    };
  }

  if (result.status === 401 || result.status === 403) {
    throw knownError("token_invalid", 401);
  }

  if (!result.ok) {
    throw knownError("network_failed", result.status);
  }

  const file = await result.json();
  const text = Buffer.from(file.content || "", "base64").toString("utf8");

  try {
    const routes = JSON.parse(text || "[]");

    if (!Array.isArray(routes)) {
      throw new Error("routes_not_array");
    }

    return {
      routes,
      sha: file.sha
    };
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

  if (sha) {
    body.sha = sha;
  }

  const result = await githubFetch(contentsUrl(), {
    method: "PUT",
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

function normalizeRoute(route) {
  const now = new Date().toISOString();

  const normalized = {
    id: route.id || route.routeId || "",
    routeId: route.routeId || route.id || "",
    owner: normalizeOwner(route.owner),
    country: route.country || "",
    city: route.city || "",
    region: route.region || "",
    location: route.location || "",
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
    qrCode: resolveImage(route.qrCode),
    imageAlt: route.imageAlt || route.title || "",
    createdAt: route.createdAt || now,
    updatedAt: now
  };

  normalized.routeId = normalized.routeId || routeIdentity(normalized);
  normalized.id = normalized.id || normalized.routeId;
  normalized.location = normalized.location || route.locationName || "";
  return normalized;
}

function resolveImage(image) {
  const value = String(image || "");

  if (value === "" ||
    value.indexOf("data:image/") === 0 ||
    value.indexOf("blob:") === 0 ||
    value.indexOf("http://") === 0 ||
    value.indexOf("https://") === 0 ||
    value.indexOf("/") === 0 ||
    !/^[a-z]+:/i.test(value)) {
    return value;
  }

  return "";
}

function allowedOwner(owner) {
  return allowedOwners.indexOf(normalizeOwner(owner)) >= 0;
}

function normalizeOwner(owner) {
  return String(owner || "").trim().toLowerCase();
}

function ownerRouteCount(routes, owner) {
  const normalizedOwner = normalizeOwner(owner);

  return routes.filter(function (route) {
    return normalizeOwner(route.owner) === normalizedOwner;
  }).length;
}

function sameRoute(left, right) {
  const normalizedLeft = {
    ...left,
    updatedAt: ""
  };
  const normalizedRight = {
    ...right,
    updatedAt: ""
  };

  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
}

function findExistingRoute(routes, route) {
  return routes.find(function (item) {
    const candidate = normalizeRoute(item);

    if (normalizeOwner(candidate.owner) !== route.owner) {
      return false;
    }

    if (candidate.routeId && route.routeId && candidate.routeId === route.routeId) {
      return true;
    }

    return sameRouteCore(candidate, route);
  }) || null;
}

function sameRouteCore(left, right) {
  return normalizeText(left.title) === normalizeText(right.title) &&
    normalizeDate(left.date) === normalizeDate(right.date) &&
    normalizeText(left.time) === normalizeText(right.time) &&
    normalizeText(left.location) === normalizeText(right.location);
}

function normalizeText(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
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

function routeIdentity(route) {
  const source = [
    route.routeId,
    normalizeDate(route.date),
    route.time,
    route.title,
    route.location
  ].filter(Boolean).join("-");

  return slugify(source || route.title || "route");
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "") || "route";
}

function normalizeDate(date) {
  const value = String(date || "");
  const match = value.match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);

  if (match) {
    return [
      match[1],
      match[2].padStart(2, "0"),
      match[3].padStart(2, "0")
    ].join("-");
  }

  return value;
}

function knownError(reason, status) {
  const error = new Error(reason);
  error.reason = reason;
  error.status = status;
  return error;
}

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, status, body) {
  response.status(status).json(body);
}
