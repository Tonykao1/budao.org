const crypto = require("node:crypto");

const CHALLENGE_BYTES = 32;
const CHALLENGE_TTL_SECONDS = 300;

function generateChallenge() {
  return crypto.randomBytes(CHALLENGE_BYTES).toString("base64url");
}

function hashChallenge(challenge, secret) {
  if (!challenge || !secret) {
    const error = new Error("Challenge and secret are required.");
    error.code = "CHALLENGE_HASH_INPUT_REQUIRED";
    throw error;
  }
  return crypto.createHmac("sha256", secret).update(challenge).digest("base64url");
}

function challengeExpiry(now = new Date(), ttlSeconds = CHALLENGE_TTL_SECONDS) {
  return new Date(now.getTime() + ttlSeconds * 1000);
}

function canConsumeChallenge(record, now = new Date()) {
  if (!record || record.consumedAt) return false;
  return new Date(record.expiresAt).getTime() > now.getTime();
}

module.exports = {
  CHALLENGE_BYTES,
  CHALLENGE_TTL_SECONDS,
  canConsumeChallenge,
  challengeExpiry,
  generateChallenge,
  hashChallenge
};
