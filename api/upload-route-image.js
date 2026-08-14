const crypto = require("node:crypto");
const { getAuthenticatedPublisher } = require("./_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("./_security/http");
const { clientIp, consume } = require("./_security/rate-limit");
const { managedImagePath, managedImageUrl, validateRouteImageUpload } = require("./_security/route-image");

const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

module.exports = async function handler(request, response) {
  const parsed = requireJsonPost(request, 3 * 1024 * 1024);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });

  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!consume("route-image:" + publisher.id + ":" + clientIp(request), 8, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }
  if (!token) return sendJson(response, 503, { ok: false, reason: "upload_unavailable" });

  const validated = validateRouteImageUpload(parsed.body);
  if (validated.error) return sendJson(response, validated.error === "image_too_large" ? 413 : 400, { ok: false, reason: validated.error });

  const assetPath = managedImagePath(publisher.slot, crypto.randomBytes(16).toString("hex"), validated.value.extension);
  let result;
  try {
    result = await githubFetch(contentsUrl(assetPath), {
      method: "PUT",
      body: JSON.stringify({
        message: "Upload route image for " + publisher.slot,
        content: validated.value.bytes.toString("base64"),
        branch
      })
    });
  } catch (error) {
    return sendJson(response, 502, { ok: false, reason: "upload_failed" });
  }

  if (result.status === 401 || result.status === 403) return sendJson(response, 503, { ok: false, reason: "upload_unavailable" });
  if (result.status === 409 || result.status === 422) return sendJson(response, 409, { ok: false, reason: "upload_conflict" });
  if (!result.ok) return sendJson(response, 502, { ok: false, reason: "upload_failed" });

  return sendJson(response, 200, {
    ok: true,
    url: managedImageUrl({ owner, repo, branch, path: assetPath })
  });
};

function githubFetch(url, options) {
  return fetch(url, {
    ...options,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "Content-Type": "application/json",
      "User-Agent": "budao-route-image-uploader",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
}

function contentsUrl(path) {
  return "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path;
}
