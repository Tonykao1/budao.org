const buckets = new Map();

function consume(key, limit = 10, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

function clientIp(request) {
  const forwarded = String(request.headers && request.headers["x-forwarded-for"] || "");
  return forwarded.split(",")[0].trim().slice(0, 64) || "unknown";
}

function resetForTests() {
  buckets.clear();
}

module.exports = { clientIp, consume, resetForTests };
