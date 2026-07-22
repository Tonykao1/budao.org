const MAX_BODY_BYTES = 48 * 1024;

function requireJsonPost(request) {
  if (request.method !== "POST") return { error: "method_not_allowed", status: 405 };
  const contentType = String(request.headers && request.headers["content-type"] || "").toLowerCase();
  if (!contentType.startsWith("application/json")) return { error: "unsupported_media_type", status: 415 };

  const raw = typeof request.body === "string" ? request.body : JSON.stringify(request.body || null);
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return { error: "payload_too_large", status: 413 };

  try {
    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body;
    if (!body || typeof body !== "object" || Array.isArray(body) || depth(body) > 3) {
      return { error: "invalid_request", status: 400 };
    }
    return { body };
  } catch (error) {
    return { error: "bad_json", status: 400 };
  }
}

function depth(value, level = 0) {
  if (!value || typeof value !== "object") return level;
  return Object.values(value).reduce((max, child) => Math.max(max, depth(child, level + 1)), level);
}

function requireSameOrigin(request) {
  const origin = String(request.headers && request.headers.origin || "");
  const host = String(request.headers && (request.headers["x-forwarded-host"] || request.headers.host) || "");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch (error) {
    return false;
  }
}

function sendJson(response, status, body) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.status(status).json(body);
}

module.exports = { MAX_BODY_BYTES, requireJsonPost, requireSameOrigin, sendJson };
