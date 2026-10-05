const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const statePath = "altar-state.json";

function defaultAltarState() {
  return { routes: {}, audit: [] };
}

function normalizeState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaultAltarState();
  return {
    routes: value.routes && typeof value.routes === "object" && !Array.isArray(value.routes) ? value.routes : {},
    audit: Array.isArray(value.audit) ? value.audit : []
  };
}

function routeSupervision(state, routeId) {
  const normalized = normalizeState(state);
  const saved = normalized.routes[String(routeId || "")] || {};
  return {
    status: ["active", "needs_changes", "paused"].includes(saved.status) ? saved.status : "active",
    locked: saved.locked === true,
    reviewedBy: saved.reviewedBy || "",
    reviewedAt: saved.reviewedAt || "",
    reason: saved.reason || "",
    updatedAt: saved.updatedAt || ""
  };
}

function applySupervisionAction(state, input) {
  const current = normalizeState(state);
  const next = { routes: { ...current.routes }, audit: current.audit.slice() };
  const routeId = String(input && input.routeId || "").trim();
  const action = String(input && input.action || "").trim();
  const actor = String(input && input.actor || "").trim();
  const timestamp = input && input.timestamp || new Date().toISOString();
  const reason = String(input && input.reason || "").trim();
  if (!routeId || !["pause", "needs_changes", "lock", "restore"].includes(action)) throw new Error("invalid_supervision_action");

  const before = routeSupervision(next, routeId);
  const after = { ...before, reviewedBy: actor, reviewedAt: timestamp, reason, updatedAt: timestamp };
  if (action === "pause") after.status = "paused";
  if (action === "needs_changes") after.status = "needs_changes";
  if (action === "lock") after.locked = true;
  if (action === "restore") { after.status = "active"; after.locked = false; }
  next.routes[routeId] = after;
  next.audit.push({ action, routeId, actor, timestamp, reason });
  return next;
}

async function readAltarState() {
  const result = await githubFetch(contentsUrl(), { method: "GET" });
  if (result.status === 404) return { ...defaultAltarState(), sha: null };
  if (!result.ok) throw new Error("altar_state_unavailable");
  const file = await result.json();
  const text = Buffer.from(file.content || "", "base64").toString("utf8");
  const parsed = normalizeState(JSON.parse(text || "{}"));
  return { ...parsed, sha: file.sha || null };
}

async function writeAltarState(next, message, sha) {
  if (!token) throw new Error("altar_state_unavailable");
  const body = {
    message: message || "Update altar supervision",
    content: Buffer.from(JSON.stringify(normalizeState(next), null, 2) + "\n", "utf8").toString("base64"),
    branch
  };
  if (sha) body.sha = sha;
  const result = await githubFetch(contentsUrl(), { method: "PUT", body: JSON.stringify(body) });
  if (!result.ok) throw new Error("altar_state_write_failed");
  return result.json();
}

function contentsUrl() {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${statePath}?ref=${branch}`;
}

function githubFetch(url, options) {
  const headers = {
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "budao-altar",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = "Bearer " + token;
  return fetch(url, { ...options, headers });
}

module.exports = { defaultAltarState, normalizeState, routeSupervision, applySupervisionAction, readAltarState, writeAltarState };
