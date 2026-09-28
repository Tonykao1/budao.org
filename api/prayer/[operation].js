const { sendJson } = require("../_security/http");

const handlers = Object.freeze({
  submit: require("../_security/prayer-submit-handler"),
  list: require("../_security/prayer-list-handler"),
  action: require("../_security/prayer-action-handler"),
  purge: require("../_security/prayer-purge-handler")
});

function operationFromRequest(request) {
  const pathname = new URL(request.url || "/", "https://budao.org").pathname;
  const match = pathname.match(/^\/api\/prayer(?:\/|-)(submit|list|action|purge)\/?$/);
  return match ? match[1] : "";
}

async function handler(request, response) {
  const operation = operationFromRequest(request);
  const selected = handlers[operation];
  if (!selected) return sendJson(response, 404, { ok: false, reason: "not_found" });
  return selected(request, response);
}

handler.operationFromRequest = operationFromRequest;
module.exports = handler;
