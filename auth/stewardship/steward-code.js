const crypto = require("node:crypto");

const STEWARD_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const STEWARD_CODE_LENGTH = 12;
const STEWARD_CODE_PATTERN = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

function generateStewardCode() {
  const bytes = crypto.randomBytes(STEWARD_CODE_LENGTH);
  let raw = "";
  for (const byte of bytes) {
    raw += STEWARD_CODE_ALPHABET[byte % STEWARD_CODE_ALPHABET.length];
  }
  return formatStewardCode(raw);
}

function formatStewardCode(raw) {
  const normalized = String(raw || "")
    .toUpperCase()
    .replace(/^EB-/, "")
    .replace(/[^23456789ABCDEFGHJKMNPQRSTUVWXYZ]/g, "");
  if (normalized.length !== STEWARD_CODE_LENGTH) {
    const error = new Error("Invalid steward code length.");
    error.code = "INVALID_STEWARD_CODE";
    throw error;
  }
  return normalized.replace(/(.{4})(.{4})(.{4})/, "$1-$2-$3");
}

function isStewardCode(value) {
  return STEWARD_CODE_PATTERN.test(String(value || ""));
}

function isUniqueViolation(error) {
  return Boolean(error && (error.code === "23505" || /unique/i.test(String(error.message || ""))));
}

async function createUniqueStewardCode(insertAttempt, options = {}) {
  const maxAttempts = options.maxAttempts || 8;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const stewardCode = generateStewardCode();
    try {
      await insertAttempt(stewardCode);
      return stewardCode;
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === maxAttempts - 1) throw error;
    }
  }
  const error = new Error("Unable to generate unique steward code.");
  error.code = "STEWARD_CODE_COLLISION";
  throw error;
}

module.exports = {
  STEWARD_CODE_ALPHABET,
  STEWARD_CODE_LENGTH,
  STEWARD_CODE_PATTERN,
  createUniqueStewardCode,
  formatStewardCode,
  generateStewardCode,
  isStewardCode
};
