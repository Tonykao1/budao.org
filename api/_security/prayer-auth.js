const { getAuthenticatedPublisher, isSteward } = require("./auth");

function getAuthorizedPrayerLeader(request, configuredIds = process.env.BUDAO_PRAYER_LEADER_IDS) {
  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return null;
  // The existing signed site steward can always receive prayer requests.
  // Other publishers require an explicit server-side ID allowlist.
  if (isSteward(publisher)) return publisher;
  if (typeof configuredIds !== "string") return null;
  const allowed = new Set(configuredIds.split(",").map((value) => value.trim()).filter(Boolean));
  return allowed.has(publisher.id) ? publisher : null;
}

module.exports = { getAuthorizedPrayerLeader };
