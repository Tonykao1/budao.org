const pastureAuthHandler = require("./_security/pasture-auth-handler");

module.exports = async function handler(request, response) {
  const pathname = new URL(request.url || "/api/publish-route", "https://budao.org").pathname;
  if (pathname === "/api/pasture-auth") {
    return pastureAuthHandler(request, response);
  }
  if (pathname === "/api/publish") {
    response.status(410).json({ ok: false, reason: "endpoint_disabled" });
    return;
  }
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (request.method === "OPTIONS") {
    response.status(204).end();
    return;
  }

  response.status(409).json({
    ok: false,
    reason: "publisher_moved",
    next: "/api/publish-route-v2"
  });
};
