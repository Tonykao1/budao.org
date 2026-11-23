const { clientIp, consume } = require('./_security/rate-limit');

const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const routesPath = "routes.json";
const fixedSlots = ["IMS", "BACBC", "HD"];
const ESV_ENDPOINT = "https://api.esv.org/v3/passage/text/";
const ESV_REFERENCE_RE = /^(?:[1-3]\s)?[A-Za-z]+(?:\s(?:of\s)?[A-Za-z]+)*\s\d{1,3}(?::\d{1,3}(?:-\d{1,3})?)?$/;

module.exports = async function handler(request, response) {
  setCorsHeaders(response);

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, reason: "method_not_allowed" });
    return;
  }

  if (String(request.query && request.query.service || "") === "bible-esv") {
    await handleEsv(request, response);
    return;
  }

  try {
    const routes = await readRoutes();
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    sendJson(response, 200, fixedRoutesOnly(routes));
  } catch (error) {
    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    sendJson(response, 200, []);
  }
};

async function handleEsv(request, response) {
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");

  const reference = normalizeEsvReference(request.query && request.query.reference);
  if (!reference) {
    sendJson(response, 400, { ok: false, reason: "invalid_reference" });
    return;
  }

  const apiKey = String(process.env.ESV_API_KEY || "").trim();
  if (!apiKey) {
    sendJson(response, 503, { ok: false, reason: "esv_not_configured" });
    return;
  }

  const ip = clientIp(request);
  if (!consume("bible-esv:ip:" + ip, 30, 60_000) || !consume("bible-esv:global", 55, 60_000)) {
    sendJson(response, 429, { ok: false, reason: "rate_limited" });
    return;
  }

  try {
    const upstream = await fetch(buildEsvUrl(reference), {
      method: "GET",
      headers: {
        "Authorization": "Token " + apiKey,
        "Accept": "application/json"
      }
    });

    if (!upstream.ok) {
      const limited = upstream.status === 429;
      sendJson(response, limited ? 429 : 502, { ok: false, reason: limited ? "rate_limited" : "esv_unavailable" });
      return;
    }

    const data = await upstream.json();
    const text = Array.isArray(data.passages) ? String(data.passages[0] || "").trim() : "";
    if (!text) {
      sendJson(response, 404, { ok: false, reason: "passage_not_found" });
      return;
    }

    sendJson(response, 200, {
      ok: true,
      canonical: String(data.canonical || reference),
      text,
      copyright: "ESV"
    });
  } catch (error) {
    sendJson(response, 502, { ok: false, reason: "esv_unavailable" });
  }
}

function normalizeEsvReference(value) {
  const reference = String(value || "").trim().replace(/\s+/g, " ");
  if (!reference || reference.length > 96 || !ESV_REFERENCE_RE.test(reference)) return null;
  return reference;
}

function buildEsvUrl(reference) {
  const url = new URL(ESV_ENDPOINT);
  url.searchParams.set("q", reference);
  url.searchParams.set("include-passage-references", "false");
  url.searchParams.set("include-verse-numbers", "true");
  url.searchParams.set("include-first-verse-numbers", "true");
  url.searchParams.set("include-footnotes", "false");
  url.searchParams.set("include-footnote-body", "false");
  url.searchParams.set("include-headings", "false");
  url.searchParams.set("include-short-copyright", "true");
  url.searchParams.set("include-passage-horizontal-lines", "false");
  url.searchParams.set("include-heading-horizontal-lines", "false");
  url.searchParams.set("line-length", "0");
  return url;
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

function fixedRoutesOnly(routes) {
  return fixedSlots.map(function (slot) {
    return routes.find(function (route) { return route.slot === slot; });
  }).filter(Boolean);
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

module.exports._private = { normalizeEsvReference, buildEsvUrl, handleEsv };