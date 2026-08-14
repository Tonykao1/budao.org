const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
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
const { validateRoute } = require("./_security/route-schema");
const { isManagedRouteImageUrl } = require("./_security/route-image");

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
  const route = { ...validated.value, owner: slotOwners[publisher.slot], slot: publisher.slot };

  try {
    const current = await readRoutesFile();
    const routeToSave = normalizeRoute(route);

    if (!allowedOwner(routeToSave.owner) || !routeToSave.slot) {
      sendJson(response, 403, { ok: false, error: "owner_not_allowed" });
      return;
    }

    const existing = findExistingRoute(current.routes, routeToSave);
    const share = sharePayload(routeToSave);
    const existingImage = existing ? existing.image || existing.imageUrl || "" : "";

    if (routeToSave.image && routeToSave.image !== existingImage &&
        !isManagedRouteImageUrl(routeToSave.image, publisher.slot, { owner, repo, branch })) {
      return sendJson(response, 400, { ok: false, reason: "untrusted_image_url" });
    }

    const existingSlot = existing ? normalizeSlot(existing.slot || slotForOwner(existing.owner)) : "";
    if (existing && existingSlot !== routeToSave.slot) {
      sendJson(response, 403, { ok: false, error: "owner_mismatch" });
      return;
    }

    if (existing) {
      routeToSave.id = existing.id || existing.routeId || routeToSave.id;
      routeToSave.routeId = existing.routeId || existing.id || routeToSave.routeId;
      routeToSave.createdAt = existing.createdAt || routeToSave.createdAt;
      routeToSave.image = routeToSave.image || existingImage;
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

    const routesBySlot = {};

    current.routes.forEach(function (item) {
      const itemSlot = normalizeSlot(item.slot || slotForOwner(item.owner));

      if (fixedSlots.indexOf(itemSlot) >= 0 && !routesBySlot[itemSlot]) {
        routesBySlot[itemSlot] = normalizeRoute({
          ...item,
          slot: itemSlot,
          owner: slotOwners[itemSlot]
        });
      }
    });

    routesBySlot[routeToSave.slot] = routeToSave;

    const routes = fixedSlots
      .map(function (slot) {
        return routesBySlot[slot];
      })
      .filter(Boolean);

    if (!routes.length) {
      throw knownError("empty_routes_blocked", 409);
    }

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
  const slot = normalizeSlot(route.slot) || slotForOwner(route.owner) || slotForRouteId(route.routeId || route.id);
  const owner = slotOwners[slot] || canonicalOwner(route.owner);

  const normalized = {
    id: route.id || route.routeId || "",
    routeId: route.routeId || route.id || "",
    owner,
    slot,
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
    qrCode: resolveQrImage(route.qrCode),
    imageAlt: route.imageAlt || route.title || "",
    createdAt: route.createdAt || now,
    updatedAt: now
  };

  normalized.slot = normalizeSlot(normalized.slot) || slotForOwner(normalized.owner) || slotForRouteId(normalized.routeId || normalized.id);
  normalized.owner = slotOwners[normalized.slot] || normalized.owner;
  if (normalized.slot) {
    normalized.routeId = "budao-" + normalized.slot.toLowerCase();
    normalized.id = normalized.routeId;
  }
  normalized.location = normalized.location || route.locationName || "";
  return normalized;
}

function resolveImage(image) {
  const value = String(image || "");

  if (value.indexOf("data:image/") === 0 && value.length > 240000) {
    return "";
  }

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

function resolveQrImage(image) {
  const value = String(image || "");

  if (value.indexOf("data:image/") === 0 && value.length > 700000) {
    return "";
  }

  return resolveImageWithoutSizeLimit(value);
}

function resolveImageWithoutSizeLimit(image) {
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
  return Boolean(slotForOwner(owner));
}

function normalizeOwner(owner) {
  return String(owner || "").trim().toLowerCase();
}

function canonicalOwner(owner) {
  const slot = slotForOwner(owner);

  return slot ? slotOwners[slot] : String(owner || "").trim();
}

function slotForOwner(owner) {
  const normalizedOwner = normalizeOwner(owner);

  if (normalizedOwner === "ims@budao.org") {
    return "IMS";
  }

  if (normalizedOwner === "bacbc@budao.org") {
    return "BACBC";
  }

  return "";
}

function slotForRouteId(routeId) {
  const normalized = String(routeId || "").trim().toLowerCase();

  if (normalized === "budao-ims" || normalized === "ims") {
    return "IMS";
  }

  if (normalized === "budao-bacbc" || normalized === "bacbc") {
    return "BACBC";
  }

  return "";
}

function normalizeSlot(slot) {
  const normalized = String(slot || "").trim().toUpperCase();

  return fixedSlots.indexOf(normalized) >= 0 ? normalized : "";
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

    return candidate.slot === route.slot;
  }) || null;
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
