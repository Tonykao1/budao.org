const crypto = require("node:crypto");
const { getDb } = require("../../db/client");
const { requireJsonPost, sendJson } = require("./http");
const { encryptPrayerPayload } = require("./prayer-crypto");
const { validatePrayerSubmission } = require("./prayer-domain");
const { consumePrayerSubmissionLimit, createPrayerRequest } = require("./prayer-store");
const { clientIp } = require("./rate-limit");

const MAX_PRAYER_REQUEST_BYTES = 8 * 1024;

function validOrigin(request) {
  const origin = String(request.headers && request.headers.origin || "");
  if (!origin) return true;
  const host = String(request.headers && (request.headers["x-forwarded-host"] || request.headers.host) || "");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch (error) {
    return false;
  }
}

function validateIdempotencyKey(value) {
  const key = typeof value === "string" ? value : "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) throw new Error("invalid_idempotency_key");
  return key;
}

function idempotencyHash(value, encodedDataKey) {
  const key = Buffer.from(encodedDataKey, "base64url");
  if (key.length !== 32) throw new Error("prayer_crypto_unavailable");
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

function defaultReceipt() {
  return crypto.randomBytes(18).toString("base64url");
}

function rateKey(request, encodedDataKey) {
  const key = Buffer.from(encodedDataKey || "", "base64url");
  if (key.length !== 32) throw new Error("prayer_crypto_unavailable");
  return crypto.createHmac("sha256", key).update(clientIp(request)).digest("hex");
}

function createPrayerSubmitHandler(dependencies = {}) {
  const dataKey = dependencies.dataKey === undefined ? process.env.BUDAO_PRAYER_DATA_KEY : dependencies.dataKey;
  const randomReceipt = dependencies.randomReceipt || defaultReceipt;
  const consumeRate = dependencies.consumeRate || ((request) => consumePrayerSubmissionLimit(getDb(), rateKey(request, dataKey)));
  const createPrayer = dependencies.createPrayer || (async (record) => {
    return createPrayerRequest(getDb(), record);
  });

  return async function prayerSubmitHandler(request, response) {
    const parsed = requireJsonPost(request, MAX_PRAYER_REQUEST_BYTES);
    if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
    if (!validOrigin(request)) return sendJson(response, 403, { ok: false, reason: "origin_not_allowed" });
    try {
      if (!await consumeRate(request)) return sendJson(response, 429, { ok: false, reason: "rate_limited" });
    } catch (error) { return sendJson(response, 503, { ok: false, reason: "prayer_service_unavailable" }); }

    const receipt = randomReceipt();
    if (typeof parsed.body.website === "string" && parsed.body.website.trim()) {
      return sendJson(response, 201, { ok: true, receipt });
    }

    let prayer;
    let idempotencyKey;
    try {
      prayer = validatePrayerSubmission(parsed.body);
      idempotencyKey = validateIdempotencyKey(parsed.body.idempotencyKey);
    } catch (error) {
      return sendJson(response, 400, { ok: false, reason: error.message || "invalid_request" });
    }

    try {
      const encryptedBody = encryptPrayerPayload({ body: prayer.body }, dataKey);
      const encryptedContact = prayer.wantsReply ?
        encryptPrayerPayload({ contact: prayer.contact }, dataKey) : null;
      await createPrayer({
        bodyCiphertext: encryptedBody.ciphertext,
        bodyNonce: encryptedBody.nonce,
        bodyTag: encryptedBody.tag,
        contactCiphertext: encryptedContact ? encryptedContact.ciphertext : null,
        contactNonce: encryptedContact ? encryptedContact.nonce : null,
        contactTag: encryptedContact ? encryptedContact.tag : null,
        visibility: prayer.visibility,
        wantsReply: prayer.wantsReply,
        status: "NEW",
        idempotencyKeyHash: idempotencyHash(idempotencyKey, dataKey)
      });
      return sendJson(response, 201, { ok: true, receipt });
    } catch (error) {
      return sendJson(response, 503, { ok: false, reason: "prayer_service_unavailable" });
    }
  };
}

const handler = createPrayerSubmitHandler();
handler.createPrayerSubmitHandler = createPrayerSubmitHandler;
handler.validOrigin = validOrigin;

module.exports = handler;
