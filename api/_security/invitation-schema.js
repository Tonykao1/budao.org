const MAX_ROUTE_ID = 80;

function validateCreateInvitation(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'invalid_request' };
  const keys = Object.keys(input);
  if (keys.length !== 1 || keys[0] !== 'routeId') return { error: 'invalid_request' };
  const routeId = input.routeId;
  if (typeof routeId !== 'string' || !routeId.trim() || routeId.length > MAX_ROUTE_ID) return { error: 'invalid_request' };
  return { value: { routeId: routeId.trim() } };
}

module.exports = { validateCreateInvitation };
