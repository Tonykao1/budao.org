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
    const routes = current.routes;

    routes.unshift(normalizeRoute(route));

    const content = JSON.stringify(routes, null, 2) + "\n";
    const commit = await writeRoutesFile({
      content,
      message: "Publish Route: " + route.title,
      sha: current.sha
    });

    sendJson(response, 200, {
      ok: true,
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
  return {
    location: route.location || "",
    title: route.title || "",
    description: route.description || "",
    time: route.time || "",
    duration: route.duration || "",
    distance: route.distance || "",
    surface: route.surface || "",
    elevation: route.elevation || "",
    timezone: route.timezone || "Asia/Shanghai",
    date: route.date || "",
    image: route.image || ""
  };
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
