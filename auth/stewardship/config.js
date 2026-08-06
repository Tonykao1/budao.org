const DEFAULT_ALLOWED_ORIGINS = ["https://budao.org", "https://www.budao.org"];
const DEFAULT_RP_ID = "budao.org";
const DEFAULT_RP_NAME = "易彼益";

function splitOrigins(value) {
  return String(value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getWebAuthnConfig(env = process.env) {
  const rpId = env.WEBAUTHN_RP_ID || DEFAULT_RP_ID;
  const rpName = env.WEBAUTHN_RP_NAME || DEFAULT_RP_NAME;
  const allowedOrigins = splitOrigins(env.WEBAUTHN_ALLOWED_ORIGINS);
  return {
    rpId,
    rpName,
    allowedOrigins: allowedOrigins.length ? allowedOrigins : DEFAULT_ALLOWED_ORIGINS
  };
}

function requireSecret(name, env = process.env) {
  const value = env[name];
  if (!value || String(value).length < 32) {
    const error = new Error("Required secret is not configured.");
    error.code = "SECRET_NOT_CONFIGURED";
    throw error;
  }
  return value;
}

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  DEFAULT_RP_ID,
  DEFAULT_RP_NAME,
  getWebAuthnConfig,
  requireSecret
};
