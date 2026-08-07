const crypto = require("node:crypto");

const SESSION_TOKEN_BYTES = 48;

function generateSessionToken() {
  return crypto.randomBytes(SESSION_TOKEN_BYTES).toString("base64url");
}

function hashSessionToken(token, secret) {
  if (!token || !secret) {
    const error = new Error("Session token and secret are required.");
    error.code = "SESSION_HASH_INPUT_REQUIRED";
    throw error;
  }
  return crypto.createHmac("sha256", secret).update(token).digest("base64url");
}

function createSessionTokenRecord(secret) {
  const token = generateSessionToken();
  return {
    token,
    tokenHash: hashSessionToken(token, secret)
  };
}

module.exports = {
  SESSION_TOKEN_BYTES,
  createSessionTokenRecord,
  generateSessionToken,
  hashSessionToken
};
