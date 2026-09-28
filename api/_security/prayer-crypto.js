const crypto = require("node:crypto");

function decodeKey(encodedKey) {
  if (typeof encodedKey !== "string" || encodedKey.length === 0) {
    throw new Error("prayer_crypto_unavailable");
  }

  let key;
  try {
    key = Buffer.from(encodedKey, "base64url");
  } catch (error) {
    throw new Error("prayer_crypto_unavailable");
  }
  if (key.length !== 32) throw new Error("prayer_crypto_unavailable");
  return key;
}

function encryptPrayerPayload(payload, encodedKey) {
  const key = decodeKey(encodedKey);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    ciphertext: ciphertext.toString("base64url"),
    nonce: nonce.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url")
  };
}

function decryptPrayerPayload(record, encodedKey) {
  const key = decodeKey(encodedKey);
  try {
    const nonce = Buffer.from(String(record.nonce || ""), "base64url");
    const tag = Buffer.from(String(record.tag || ""), "base64url");
    const ciphertext = Buffer.from(String(record.ciphertext || ""), "base64url");
    if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error("invalid_envelope");
    }
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch (error) {
    if (error && error.message === "prayer_crypto_unavailable") throw error;
    throw new Error("prayer_decryption_failed");
  }
}

module.exports = { encryptPrayerPayload, decryptPrayerPayload };
