const { getAuthenticatedPublisher } = require("./auth");

function getAuthorizedPrayerLeader(request, configuredIds = process.env.BUDAO_PRAYER_LEADER_IDS) {
  const publisher = getAuthenticatedPublisher(request);
  if (!publisher || typeof configuredIds !== "string") return null;
  const allowed = new Set(configuredIds.split(",").map((value) => value.trim()).filter(Boolean));
  return allowed.has(publisher.id) ? publisher : null;
}

module.exports = { getAuthorizedPrayerLeader };
