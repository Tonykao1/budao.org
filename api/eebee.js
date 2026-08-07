const crypto = require("node:crypto");
const { getAuthenticatedPublisher } = require("./_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("./_security/http");
const { clientIp, consume } = require("./_security/rate-limit");

const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const dataPath = "eebee-data.json";
const USER_COOKIE = "eebee_user_session";
const USER_SESSION_TTL = 60 * 60 * 24 * 180;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const STATUS = ["DRAFT", "OPEN", "MATCHED", "HANDOVER_SCHEDULED", "HANDED_OVER", "CLOSED", "WITHDRAWN"];
const APP_STATUS = ["APPLIED", "SELECTED", "NOT_SELECTED", "REJECTED"];
const HANDOVER_STATUS = ["SCHEDULED", "COMPLETED"];
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

module.exports = async function handler(request, response) {
  try {
    if (request.method === "GET") return await handleGet(request, response);
    if (request.method === "POST") return await handlePost(request, response);
    return sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
  } catch (error) {
    if (error && error.reason) return sendJson(response, error.status || 500, { ok: false, reason: error.reason });
    return sendJson(response, 500, { ok: false, reason: "service_unavailable" });
  }
};

async function handleGet(request, response) {
  const url = new URL(request.url || "/api/eebee", "https://budao.org");
  const view = url.searchParams.get("view") || "public";
  const current = await readDataFile();
  const data = normalizeData(current.data);

  if (view === "me") {
    const user = getEebeeUser(request, data);
    if (!user) return sendJson(response, 200, { ok: true, user: null, applications: [] });
    return sendJson(response, 200, { ok: true, user: publicUser(user), applications: applicationsForUser(data, user.id) });
  }

  if (view === "admin") {
    const publisher = requireFulfiller(request);
    return sendJson(response, 200, { ok: true, admin: { id: publisher.id }, data: adminView(data) });
  }

  return sendJson(response, 200, { ok: true, data: publicView(data) });
}

async function handlePost(request, response) {
  const parsed = requireJsonPost(request);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });
  if (!consume("eebee:" + clientIp(request), 30, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }
  if (!token) return sendJson(response, 503, { ok: false, reason: "storage_unavailable" });

  const action = stringField(parsed.body.action, 40);
  if (!action) return sendJson(response, 400, { ok: false, reason: "missing_action" });

  const current = await readDataFile();
  const data = normalizeData(current.data);
  let result;
  let cookie = "";

  if (action === "requestEmailCode") {
    result = await requestEmailCode(data, parsed.body);
  } else if (action === "verifyEmailCode") {
    const outcome = verifyEmailCode(data, parsed.body);
    result = outcome.result;
    cookie = outcome.cookie;
  } else if (action === "register") {
    throw knownError("email_verification_required", 400);
  } else if (action === "apply") {
    result = applyForOffering(request, data, parsed.body);
  } else {
    const publisher = requireFulfiller(request);
    result = adminAction(publisher, data, parsed.body);
  }

  const content = JSON.stringify(data, null, 2) + "\n";
  const commit = await writeDataFile(content, current.sha, "Update stewardship data");
  if (cookie) response.setHeader("Set-Cookie", cookie);
  return sendJson(response, 200, { ok: true, ...result, commit: commit.commit && commit.commit.sha ? commit.commit.sha : null });
}

async function requestEmailCode(data, body) {
  const email = normalizeEmail(requiredString(body.email, 5, 254, "email"));
  if (!isEmail(email)) throw knownError("invalid_email", 400);
  const displayName = requiredString(body.displayName, 1, 60, "displayName");
  if (body.principlesAccepted !== true) throw knownError("principles_required", 400);

  const now = new Date();
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const emailHash = emailLookupHash(email);
  const verification = {
    id: "ev_" + crypto.randomUUID(),
    emailHash,
    codeHash: hashSecret(code),
    displayName,
    expiresAt: new Date(now.getTime() + EMAIL_CODE_TTL_MS).toISOString(),
    consumedAt: "",
    attempts: 0,
    createdAt: now.toISOString()
  };
  data.emailVerifications = data.emailVerifications.filter((item) => item.emailHash !== emailHash || item.consumedAt || new Date(item.expiresAt).getTime() <= now.getTime());
  data.emailVerifications.push(verification);
  await sendVerificationEmail(email, code);
  return { sent: true };
}

function verifyEmailCode(data, body) {
  const email = normalizeEmail(requiredString(body.email, 5, 254, "email"));
  if (!isEmail(email)) throw knownError("invalid_email", 400);
  const code = requiredString(body.code, 4, 12, "code").replace(/\s+/g, "");
  const displayName = requiredString(body.displayName, 1, 60, "displayName");
  if (body.principlesAccepted !== true) throw knownError("principles_required", 400);
  const now = new Date();
  const emailHash = emailLookupHash(email);
  const verification = data.emailVerifications
    .filter((item) => item.emailHash === emailHash && !item.consumedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
  if (!verification || new Date(verification.expiresAt).getTime() <= now.getTime()) throw knownError("verification_expired", 400);
  if (verification.attempts >= 5) throw knownError("verification_locked", 429);
  verification.attempts += 1;
  if (!safeEqual(verification.codeHash, hashSecret(code))) throw knownError("verification_invalid", 400);
  verification.consumedAt = now.toISOString();

  let user = data.users.find((item) => item.emailHash === emailHash);
  if (!user) {
    user = {
      id: "user_" + crypto.randomUUID(),
      eebeeCode: uniqueEebeeCode(data),
      emailHash,
      emailMasked: maskEmail(email),
      displayName,
      contactNote: "",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    data.users.push(user);
  } else {
    user.displayName = displayName || user.displayName;
    user.emailMasked = user.emailMasked || maskEmail(email);
    user.updatedAt = now.toISOString();
  }
  const session = createUserSession(data, user.id, now);
  return {
    result: { user: publicUser(user) },
    cookie: createUserCookie(session.token, process.env.NODE_ENV !== "test")
  };
}

function applyForOffering(request, data, body) {
  const user = getEebeeUser(request, data);
  if (!user) throw knownError("registration_required", 401);
  const offering = data.offerings.find((item) => item.id === requiredString(body.offeringId, 1, 120, "offeringId"));
  if (!offering || offering.status !== "OPEN") throw knownError("offering_not_open", 409);

  const existing = data.applications.find((item) => item.offeringId === offering.id && item.applicantUserId === user.id && item.status !== "REJECTED");
  if (existing) return { application: applicantView(data, existing), duplicate: true, user: publicUser(user) };

  if (body.offlineHandoverAccepted !== true) throw knownError("handover_commitment_required", 400);
  const now = new Date().toISOString();
  const application = {
    id: "app_" + crypto.randomUUID(),
    offeringId: offering.id,
    applicantUserId: user.id,
    applicantEebeeCode: user.eebeeCode,
    reason: requiredString(body.reason, 6, 800, "reason"),
    intendedUse: requiredString(body.intendedUse, 6, 800, "intendedUse"),
    additionalNote: stringField(body.additionalNote, 800),
    offlineHandoverAccepted: true,
    status: "APPLIED",
    createdAt: now,
    updatedAt: now
  };
  data.applications.push(application);
  return { application: applicantView(data, application), duplicate: false, user: publicUser(user) };
}

function adminAction(publisher, data, body) {
  const action = body.action;
  if (action === "saveOffering") return saveOffering(publisher, data, body);
  if (action === "setOfferingStatus") return setOfferingStatus(data, body);
  if (action === "selectApplication") return selectApplication(publisher, data, body);
  if (action === "rejectApplication") return updateApplicationStatus(data, body, "REJECTED");
  if (action === "reopenApplication") return updateApplicationStatus(data, body, "APPLIED");
  if (action === "revokeSelection") return revokeSelection(data, body);
  if (action === "scheduleHandover") return scheduleHandover(publisher, data, body);
  if (action === "confirmHandover") return confirmHandover(publisher, data, body);
  if (action === "saveImpact") return saveImpact(data, body);
  throw knownError("unknown_action", 400);
}

function saveOffering(publisher, data, body) {
  const now = new Date().toISOString();
  const offeringId = stringField(body.offeringId, 120);
  let offering = offeringId ? data.offerings.find((item) => item.id === offeringId) : null;
  let resource = offering ? data.resources.find((item) => item.id === offering.resourceId) : null;
  if (!offering) {
    resource = {
      id: "res_" + crypto.randomUUID(),
      title: "",
      description: "",
      condition: "",
      category: "",
      images: [],
      createdByUserId: publisher.id,
      currentStewardUserId: publisher.id,
      createdAt: now,
      updatedAt: now
    };
    offering = {
      id: "off_" + crypto.randomUUID(),
      resourceId: resource.id,
      publisherUserId: publisher.id,
      reasonForOffering: "",
      recipientExpectation: "",
      status: "DRAFT",
      publishedAt: "",
      closedAt: "",
      createdAt: now,
      updatedAt: now
    };
    data.resources.push(resource);
    data.offerings.push(offering);
  }

  resource.title = requiredString(body.title, 1, 120, "title");
  resource.description = requiredString(body.description, 1, 1400, "description");
  resource.condition = stringField(body.condition, 120);
  resource.category = stringField(body.category, 80);
  resource.images = imageList(body.images);
  resource.updatedAt = now;
  offering.reasonForOffering = requiredString(body.reasonForOffering, 1, 1000, "reasonForOffering");
  offering.recipientExpectation = requiredString(body.recipientExpectation, 1, 1000, "recipientExpectation");
  const nextStatus = stringField(body.status, 40) || offering.status;
  if (!STATUS.includes(nextStatus)) throw knownError("invalid_status", 400);
  if (offering.status !== "OPEN" && nextStatus === "OPEN") offering.publishedAt = now;
  if (["CLOSED", "WITHDRAWN"].includes(nextStatus)) offering.closedAt = now;
  offering.status = nextStatus;
  offering.updatedAt = now;
  return { offering: adminOffering(data, offering) };
}

function setOfferingStatus(data, body) {
  const offering = mustOffering(data, body.offeringId);
  const status = requiredString(body.status, 1, 40, "status");
  if (!STATUS.includes(status)) throw knownError("invalid_status", 400);
  if (["MATCHED", "HANDOVER_SCHEDULED", "HANDED_OVER"].includes(status)) throw knownError("status_requires_flow", 409);
  offering.status = status;
  offering.updatedAt = new Date().toISOString();
  if (["CLOSED", "WITHDRAWN"].includes(status)) offering.closedAt = offering.updatedAt;
  return { offering: adminOffering(data, offering) };
}

function selectApplication(publisher, data, body) {
  const application = mustApplication(data, body.applicationId);
  const offering = mustOffering(data, application.offeringId);
  if (!["OPEN", "MATCHED"].includes(offering.status)) throw knownError("offering_not_selectable", 409);
  data.applications.filter((item) => item.offeringId === offering.id).forEach((item) => {
    item.status = item.id === application.id ? "SELECTED" : (item.status === "REJECTED" ? "REJECTED" : "NOT_SELECTED");
    item.updatedAt = new Date().toISOString();
  });
  offering.status = "MATCHED";
  offering.decidedByUserId = publisher.id;
  offering.decidedAt = new Date().toISOString();
  offering.updatedAt = offering.decidedAt;
  return { offering: adminOffering(data, offering) };
}

function updateApplicationStatus(data, body, status) {
  if (!APP_STATUS.includes(status)) throw knownError("invalid_application_status", 400);
  const application = mustApplication(data, body.applicationId);
  if (application.status === "SELECTED") throw knownError("selected_application_locked", 409);
  application.status = status;
  application.updatedAt = new Date().toISOString();
  return { application: adminApplication(data, application) };
}

function revokeSelection(data, body) {
  const offering = mustOffering(data, body.offeringId);
  const handover = data.handovers.find((item) => item.offeringId === offering.id && item.status === "COMPLETED");
  if (handover) throw knownError("handover_already_completed", 409);
  data.applications.filter((item) => item.offeringId === offering.id && item.status !== "REJECTED").forEach((item) => {
    item.status = "APPLIED";
    item.updatedAt = new Date().toISOString();
  });
  data.handovers = data.handovers.filter((item) => item.offeringId !== offering.id);
  offering.status = "OPEN";
  offering.updatedAt = new Date().toISOString();
  return { offering: adminOffering(data, offering) };
}

function scheduleHandover(publisher, data, body) {
  const offering = mustOffering(data, body.offeringId);
  const selected = data.applications.find((item) => item.offeringId === offering.id && item.status === "SELECTED");
  if (!selected) throw knownError("selected_application_required", 409);
  if (!["MATCHED", "HANDOVER_SCHEDULED"].includes(offering.status)) throw knownError("offering_not_matched", 409);
  const now = new Date().toISOString();
  let handover = data.handovers.find((item) => item.offeringId === offering.id && item.status !== "COMPLETED");
  if (!handover) {
    handover = {
      id: "han_" + crypto.randomUUID(),
      offeringId: offering.id,
      selectedApplicationId: selected.id,
      eventId: "",
      eventTitle: "",
      fromUserId: offering.publisherUserId,
      toUserId: selected.applicantUserId,
      confirmedByUserId: "",
      scheduledAt: "",
      completedAt: "",
      note: "",
      status: "SCHEDULED",
      createdAt: now,
      updatedAt: now
    };
    data.handovers.push(handover);
  }
  handover.eventId = requiredString(body.eventId, 1, 120, "eventId");
  handover.eventTitle = requiredString(body.eventTitle, 1, 160, "eventTitle");
  handover.scheduledAt = stringField(body.scheduledAt, 80);
  handover.note = stringField(body.note, 800);
  handover.confirmedByUserId = publisher.id;
  handover.updatedAt = now;
  offering.status = "HANDOVER_SCHEDULED";
  offering.updatedAt = now;
  return { handover: adminHandover(data, handover), offering: adminOffering(data, offering) };
}

function confirmHandover(publisher, data, body) {
  const offering = mustOffering(data, body.offeringId);
  if (offering.status !== "HANDOVER_SCHEDULED") throw knownError("handover_schedule_required", 409);
  const handover = data.handovers.find((item) => item.offeringId === offering.id && item.status === "SCHEDULED");
  if (!handover) throw knownError("handover_schedule_required", 409);
  const now = new Date().toISOString();
  handover.status = "COMPLETED";
  handover.completedAt = now;
  handover.confirmedByUserId = publisher.id;
  handover.note = stringField(body.note, 800) || handover.note;
  handover.updatedAt = now;
  offering.status = "HANDED_OVER";
  offering.updatedAt = now;
  return { handover: adminHandover(data, handover), offering: adminOffering(data, offering) };
}

function saveImpact(data, body) {
  const handover = mustHandover(data, body.handoverId);
  if (handover.status !== "COMPLETED") throw knownError("handover_completion_required", 409);
  const now = new Date().toISOString();
  let impact = data.impacts.find((item) => item.handoverId === handover.id);
  if (!impact) {
    impact = { id: "imp_" + crypto.randomUUID(), handoverId: handover.id, recipientReflection: "", publisherConfirmation: "", handoverCompleted: true, completedAt: handover.completedAt || now, createdAt: now, updatedAt: now };
    data.impacts.push(impact);
  }
  impact.recipientReflection = stringField(body.recipientReflection, 800);
  impact.publisherConfirmation = stringField(body.publisherConfirmation, 800);
  impact.handoverCompleted = true;
  impact.updatedAt = now;
  return { impact };
}

async function readDataFile() {
  const result = await githubFetch(contentsUrl(), { method: "GET" });
  if (result.status === 404) return { data: emptyData(), sha: null };
  if (result.status === 401 || result.status === 403) throw knownError("token_invalid", 401);
  if (!result.ok) throw knownError("storage_read_failed", result.status);
  const file = await result.json();
  try {
    return { data: JSON.parse(Buffer.from(file.content || "", "base64").toString("utf8") || "{}"), sha: file.sha };
  } catch (error) {
    throw knownError("data_conflict", 409);
  }
}

async function writeDataFile(content, sha, message) {
  const body = { message, content: Buffer.from(content, "utf8").toString("base64"), branch };
  if (sha) body.sha = sha;
  const result = await githubFetch(contentsUrl(), { method: "PUT", body: JSON.stringify(body) });
  if (result.status === 401 || result.status === 403) throw knownError("token_invalid", 401);
  if (result.status === 409 || result.status === 422) throw knownError("commit_conflict", 409);
  if (!result.ok) throw knownError("storage_write_failed", result.status);
  return result.json();
}

function githubFetch(url, options) {
  return fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "User-Agent": "budao-eebee",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
}

function contentsUrl() {
  return "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + dataPath + "?ref=" + branch;
}

function requireFulfiller(request) {
  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) throw knownError("unauthorized", 401);
  const allowed = process.env.STEWARDSHIP_OPERATOR_USER_ID;
  if (!allowed || publisher.id !== allowed) throw knownError("forbidden", 403);
  return publisher;
}

function normalizeData(data) {
  const base = data && typeof data === "object" ? data : {};
  return {
    users: Array.isArray(base.users) ? base.users : [],
    sessions: Array.isArray(base.sessions) ? base.sessions : [],
    emailVerifications: Array.isArray(base.emailVerifications) ? base.emailVerifications : [],
    resources: Array.isArray(base.resources) ? base.resources : [],
    offerings: Array.isArray(base.offerings) ? base.offerings : [],
    applications: Array.isArray(base.applications) ? base.applications : [],
    handovers: Array.isArray(base.handovers) ? base.handovers : [],
    impacts: Array.isArray(base.impacts) ? base.impacts : []
  };
}

function emptyData() {
  return { users: [], sessions: [], emailVerifications: [], resources: [], offerings: [], applications: [], handovers: [], impacts: [] };
}

function publicView(data) {
  return {
    offerings: data.offerings.map((offering) => publicOffering(data, offering)).filter(Boolean)
      .filter((offering) => !["DRAFT", "WITHDRAWN"].includes(offering.status))
  };
}

function publicOffering(data, offering) {
  const resource = data.resources.find((item) => item.id === offering.resourceId);
  if (!resource) return null;
  const handover = data.handovers.find((item) => item.offeringId === offering.id);
  const impact = handover ? data.impacts.find((item) => item.handoverId === handover.id) : null;
  return {
    id: offering.id,
    status: offering.status,
    canApply: offering.status === "OPEN",
    title: resource.title,
    description: resource.description,
    condition: resource.condition,
    category: resource.category,
    images: resource.images || [],
    reasonForOffering: offering.reasonForOffering,
    recipientExpectation: offering.recipientExpectation,
    publishedAt: offering.publishedAt,
    handover: handover ? { eventId: handover.eventId, eventTitle: handover.eventTitle, scheduledAt: handover.scheduledAt, status: handover.status } : null,
    impact: impact ? { recipientReflection: impact.recipientReflection, publisherConfirmation: impact.publisherConfirmation, completedAt: impact.completedAt } : null
  };
}

function adminView(data) {
  return {
    users: data.users.map(publicUser),
    offerings: data.offerings.map((offering) => adminOffering(data, offering)),
    applications: data.applications.map((application) => adminApplication(data, application)),
    handovers: data.handovers.map((handover) => adminHandover(data, handover)),
    impacts: data.impacts
  };
}

function adminOffering(data, offering) {
  const resource = data.resources.find((item) => item.id === offering.resourceId) || {};
  return { ...offering, resource };
}

function adminApplication(data, application) {
  const user = data.users.find((item) => item.id === application.applicantUserId);
  const { applicantEebeeCode, ...safeApplication } = application;
  return {
    ...safeApplication,
    applicantEntrustedCode: displayEntrustedCode(applicantEebeeCode),
    applicant: user ? publicUser(user) : null
  };
}

function adminHandover(data, handover) {
  return { ...handover, application: data.applications.find((item) => item.id === handover.selectedApplicationId) || null };
}

function publicUser(user) {
  return { entrustedCode: displayEntrustedCode(user.eebeeCode), displayName: user.displayName || "", emailMasked: user.emailMasked || "" };
}

function applicationsForUser(data, userId) {
  return data.applications.filter((item) => item.applicantUserId === userId).map((application) => applicantView(data, application));
}

function applicantView(data, application) {
  const offering = data.offerings.find((item) => item.id === application.offeringId);
  const handover = offering ? data.handovers.find((item) => item.offeringId === offering.id) : null;
  return {
    id: application.id,
    offeringId: application.offeringId,
    applicantEntrustedCode: displayEntrustedCode(application.applicantEebeeCode),
    reason: application.reason,
    intendedUse: application.intendedUse,
    additionalNote: application.additionalNote,
    status: application.status,
    createdAt: application.createdAt,
    handover: handover ? { eventId: handover.eventId, eventTitle: handover.eventTitle, scheduledAt: handover.scheduledAt, status: handover.status } : null
  };
}

function getEebeeUser(request, data) {
  const token = readCookie(request, USER_COOKIE);
  if (!token) return null;
  const tokenHash = hashSecret(token);
  const now = Date.now();
  const session = data.sessions.find((item) => item.tokenHash === tokenHash && !item.revokedAt && new Date(item.expiresAt).getTime() > now);
  if (!session) return null;
  session.lastSeenAt = new Date().toISOString();
  return data.users.find((user) => user.id === session.userId) || null;
}

function createUserSession(data, userId, now = new Date()) {
  const token = crypto.randomBytes(48).toString("base64url");
  const session = {
    id: "ses_" + crypto.randomUUID(),
    userId,
    tokenHash: hashSecret(token),
    expiresAt: new Date(now.getTime() + USER_SESSION_TTL * 1000).toISOString(),
    createdAt: now.toISOString(),
    lastSeenAt: now.toISOString(),
    revokedAt: ""
  };
  data.sessions = data.sessions.filter((item) => item.userId !== userId || new Date(item.expiresAt).getTime() > now.getTime());
  data.sessions.push(session);
  return { token };
}

function createUserCookie(token, secure = true) {
  return [
    USER_COOKIE + "=" + token,
    "Path=/",
    "HttpOnly",
    secure ? "Secure" : "",
    "SameSite=Lax",
    "Max-Age=" + USER_SESSION_TTL
  ].filter(Boolean).join("; ");
}

function readCookie(request, name) {
  const header = request.headers && request.headers.cookie;
  if (typeof header !== "string") return "";
  const match = header.split(";").map((part) => part.trim()).find((part) => part.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : "";
}

function uniqueEebeeCode(data) {
  const existing = new Set(data.users.flatMap((user) => [user.eebeeCode, displayEntrustedCode(user.eebeeCode)]));
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = formatEntrustedCode(randomBase32(12));
    if (!existing.has(code)) return code;
  }
  throw knownError("code_generation_failed", 500);
}

function displayEntrustedCode(value) {
  const cleaned = String(value || "").replace(/^EB-/, "").replace(/-/g, "");
  return cleaned.length === 12 ? formatEntrustedCode(cleaned) : cleaned;
}

function formatEntrustedCode(value) {
  return String(value || "").replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
}

function randomBase32(length) {
  const bytes = crypto.randomBytes(length);
  let code = "";
  for (let index = 0; index < length; index += 1) {
    code += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return code;
}

function mustOffering(data, id) {
  const offering = data.offerings.find((item) => item.id === requiredString(id, 1, 120, "offeringId"));
  if (!offering) throw knownError("offering_not_found", 404);
  return offering;
}

function mustApplication(data, id) {
  const application = data.applications.find((item) => item.id === requiredString(id, 1, 120, "applicationId"));
  if (!application) throw knownError("application_not_found", 404);
  return application;
}

function mustHandover(data, id) {
  const handover = data.handovers.find((item) => item.id === requiredString(id, 1, 120, "handoverId"));
  if (!handover) throw knownError("handover_not_found", 404);
  return handover;
}

function imageList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => stringField(item, 1200)).filter((item) => item && (item.startsWith("https://") || item.startsWith("/")));
}

function requiredString(value, min, max, field) {
  const text = stringField(value, max);
  if (text.length < min) throw knownError("invalid_" + field, 400);
  return text;
}

function stringField(value, max) {
  return String(value || "").trim().slice(0, max);
}

function knownError(reason, status) {
  const error = new Error(reason);
  error.reason = reason;
  error.status = status;
  return error;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function emailLookupHash(email) {
  const secret = process.env.STEWARDSHIP_LOOKUP_HMAC_KEY || process.env.BUDAO_SESSION_SECRET || "test-only-eebee-email-key";
  return crypto.createHmac("sha256", secret).update(normalizeEmail(email)).digest("base64url");
}

function hashSecret(value) {
  const secret = process.env.STEWARDSHIP_SESSION_SECRET || process.env.BUDAO_SESSION_SECRET || "test-only-eebee-session-key";
  return crypto.createHmac("sha256", secret).update(String(value)).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function maskEmail(email) {
  const [name, domain] = normalizeEmail(email).split("@");
  const prefix = name.length <= 2 ? name[0] || "*" : name.slice(0, 2);
  return prefix + "***@" + domain;
}

async function sendVerificationEmail(email, code) {
  if (process.env.NODE_ENV === "test") {
    global.__lastEebeeEmail = { email, code };
    return;
  }
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.EEBEE_EMAIL_FROM || process.env.STEWARDSHIP_EMAIL_FROM || process.env.EMAIL_FROM;
  if (!resendKey || !from) throw knownError("email_unavailable", 503);
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + resendKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "你的易彼益验证码",
      text: "你的易彼益验证码是：" + code + "\n\n10 分钟内有效。若不是你本人操作，可以忽略这封邮件。"
    })
  });
  if (!result.ok) throw knownError("email_unavailable", 503);
}
