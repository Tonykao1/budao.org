"use strict";
/*
 * Privacy-minimal, durable anti-spam quotas for anonymous Campfire actions.
 * A browser token and a short-lived HMAC of the network address provide two
 * independent quotas. Never persist raw IPs, device fingerprints or location.
 *
 * Records stop being used after their hourly bucket and are deleted after
 * 48h in bounded batches when new requests arrive; the network
 * HMAC includes the time bucket, preventing long-term linkage across windows.
 */
const crypto = require("node:crypto");
const { clientIp } = require("./rate-limit");

const WINDOW_MS = 60 * 60 * 1000;
const RULES = Object.freeze({
  react: Object.freeze({ browser: 100, network: 400 }),
  comment: Object.freeze({ browser: 6, network: 50 }),
  report: Object.freeze({ browser: 8, network: 70 }),
  withdraw: Object.freeze({ browser: 12, network: 50 })
});
let lastPrune = 0;

function networkKey(request, bucketMs, secret) {
  const ip = clientIp(request);
  if (!ip || ip === "unknown" || ip.length > 64) return null;
  return crypto.createHmac("sha256", secret)
    .update("campfire-network-limiter-v1:" + bucketMs + ":" + ip)
    .digest("hex");
}

async function consumeGuestQuota(query, request, visitorHash, action) {
  const rule = RULES[action];
  if (!rule || !/^[a-f0-9]{64}$/.test(visitorHash || "")) {
    throw new Error("invalid_guest_quota");
  }
  const secret = process.env.BUDAO_SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("guest_secret_not_configured");
  const now = Date.now();
  const bucketMs = Math.floor(now / WINDOW_MS) * WINDOW_MS;
  const bucketSeconds = bucketMs / 1000;
  const network = networkKey(request, bucketMs, secret);
  const items = [
    { scope: action + "-guest", key: visitorHash, max: rule.browser },
    ...(network ? [{ scope: action + "-network", key: network, max: rule.network }] : [])
  ];
  for (const item of items) {
    const rows = await query(
      "INSERT INTO campfire_write_limits(scope,key_hash,bucket_start,request_count) " +
      "VALUES($1,$2,to_timestamp($3::double precision),1) " +
      "ON CONFLICT(scope,key_hash,bucket_start) " +
      "DO UPDATE SET request_count=campfire_write_limits.request_count+1 " +
      "WHERE campfire_write_limits.request_count < $4 RETURNING request_count",
      [item.scope, item.key, bucketSeconds, item.max]
    );
    if (!rows.length) return false;
  }
  // Bounded best-effort cleanup, with no async work after the response.
  if (now - lastPrune >= 10 * 60 * 1000) {
    lastPrune = now;
    try {
      await query("DELETE FROM campfire_write_limits WHERE ctid IN " +
        "(SELECT ctid FROM campfire_write_limits " +
        "WHERE bucket_start < NOW()-INTERVAL '48 hours' LIMIT 400)");
    } catch {
      // Cleanup errors never turn a valid interaction into a false failure.
    }
  }
  return true;
}

module.exports = { consumeGuestQuota, networkKey, RULES, WINDOW_MS };
