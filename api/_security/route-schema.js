const ALLOWED_FIELDS = new Set([
  "id", "routeId", "country", "city", "region", "location", "title", "description",
  "time", "duration", "distance", "surface", "elevation", "difficulty", "suitableFor",
  "equipmentMinimum", "timezone", "date", "meetingPlace", "participantRequirements",
  "image", "qrCode", "imageAlt"
]);
const LIMITS = {
  id: 80, routeId: 80, country: 80, city: 80, region: 120, location: 240, title: 160,
  description: 4000, time: 20, duration: 60, distance: 60, surface: 240, elevation: 80,
  difficulty: 80, suitableFor: 500, equipmentMinimum: 500, timezone: 80, date: 32,
  meetingPlace: 500, participantRequirements: 1000, image: 24_000, qrCode: 24_000, imageAlt: 240
};
const FORBIDDEN_FIELDS = new Set([
  "role", "isAdmin", "userId", "owner", "ownerId", "createdBy", "approvalState",
  "repository", "repo", "branch", "path", "filePath", "githubToken", "token", "commitTarget",
  "createdAt", "updatedAt", "slot"
]);

function validateRoute(input) {
  const keys = Object.keys(input);
  if (keys.length > 30 || keys.some((key) => FORBIDDEN_FIELDS.has(key) || !ALLOWED_FIELDS.has(key))) {
    return { error: "unknown_or_forbidden_field" };
  }
  if (typeof input.title !== "string" || !input.title.trim()) return { error: "missing_route" };

  const output = {};
  for (const key of keys) {
    if (typeof input[key] !== "string" || input[key].length > LIMITS[key]) return { error: "invalid_field" };
    output[key] = input[key].trim();
  }
  if (output.image && !safeImage(output.image)) return { error: "invalid_image" };
  if (output.qrCode && !safeImage(output.qrCode)) return { error: "invalid_image" };
  return { value: output };
}

function safeImage(value) {
  return value.startsWith("https://") || value.startsWith("/") || /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(value);
}

module.exports = { validateRoute };
