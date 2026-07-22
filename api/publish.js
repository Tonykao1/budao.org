const { sendJson } = require("./_security/http");

// Retained as a safe compatibility tombstone. This former development endpoint
// logged and echoed arbitrary request bodies and must never publish content.
module.exports = async function handler(request, response) {
  return sendJson(response, 410, { ok: false, reason: "endpoint_disabled" });
};
