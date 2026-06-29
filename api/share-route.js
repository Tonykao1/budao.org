const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const routesPath = "routes.json";

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.status(405).send("method_not_allowed");
    return;
  }

  const routeId = request.query && request.query.routeId ? String(request.query.routeId) : "";

  try {
    const routes = await readRoutes();
    const route = routes.find((item) => item.routeId === routeId) || routes[0] || {};
    const svg = renderShareSvg(route);

    response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    response.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
    response.status(200).send(svg);
  } catch (error) {
    response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    response.status(200).send(renderShareSvg({}));
  }
};

async function readRoutes() {
  const result = await fetch(contentsUrl(), {
    method: "GET",
    headers: requestHeaders()
  });

  if (!result.ok) {
    throw new Error("routes_unavailable");
  }

  const file = await result.json();
  const text = Buffer.from(file.content || "", "base64").toString("utf8");
  const routes = JSON.parse(text || "[]");

  return Array.isArray(routes) ? routes : [];
}

function renderShareSvg(route) {
  const title = escapeXml(route.title || "Budao 同行");
  const location = escapeXml(route.location || "旷野中的一段路");
  const description = escapeXml(shorten(route.description || "有人正在路上，也有人预备同行。", 84));
  const meta = escapeXml([
    route.date,
    route.time,
    route.duration,
    route.distance,
    route.elevation
  ].filter(Boolean).join(" · "));
  const timezone = escapeXml(route.timezone || "Asia/Shanghai");

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">',
    '<defs>',
    '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#f5f2eb"/>',
    '<stop offset="1" stop-color="#ded6c8"/>',
    '</linearGradient>',
    '<radialGradient id="light" cx="50%" cy="38%" r="55%">',
    '<stop offset="0" stop-color="#fff7df" stop-opacity="0.8"/>',
    '<stop offset="1" stop-color="#fff7df" stop-opacity="0"/>',
    '</radialGradient>',
    '</defs>',
    '<rect width="1200" height="630" fill="url(#bg)"/>',
    '<rect width="1200" height="630" fill="url(#light)"/>',
    '<rect x="104" y="78" width="992" height="474" rx="28" fill="#ffffff" opacity="0.88"/>',
    '<text x="150" y="160" fill="#a49b90" font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="26" letter-spacing="7">',
    location,
    '</text>',
    '<text x="150" y="238" fill="#2e2b27" font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="62" font-weight="300">',
    title,
    '</text>',
    '<text x="150" y="314" fill="#5f5b55" font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="30">',
    description,
    '</text>',
    '<text x="150" y="412" fill="#6b665f" font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="28">',
    meta,
    '</text>',
    '<text x="150" y="482" fill="#9a9287" font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="24" letter-spacing="2">',
    timezone,
    '</text>',
    '<text x="928" y="482" fill="#2e2b27" font-family="system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif" font-size="26" letter-spacing="5">',
    'BUDAO',
    '</text>',
    '</svg>'
  ].join("");
}

function shorten(value, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();

  return text.length > max ? text.slice(0, max - 1) + "..." : text;
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function contentsUrl() {
  return "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + routesPath + "?ref=" + branch;
}

function requestHeaders() {
  const headers = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "budao-share-image",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (token) {
    headers.Authorization = "Bearer " + token;
  }

  return headers;
}
