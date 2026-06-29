const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const routesPath = "routes.json";

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

  try {
    const routes = await readRoutes();

    response.setHeader("Cache-Control", "s-maxage=0, stale-while-revalidate=30");
    sendJson(response, 200, routes);
  } catch (error) {
    sendJson(response, 200, []);
  }
};

async function readRoutes() {
  const result = await fetch(contentsUrl(), {
    method: "GET",
    headers: requestHeaders()
  });

  if (result.status === 404) {
    return [];
  }

  if (!result.ok) {
    throw new Error("routes_unavailable");
  }

  const file = await result.json();
  const text = Buffer.from(file.content || "", "base64").toString("utf8");
  const routes = JSON.parse(text || "[]");

  return Array.isArray(routes) ? routes : [];
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

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

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
