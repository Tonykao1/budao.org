const crypto = require('node:crypto');
const owner = process.env.GITHUB_OWNER || 'Tonykao1';
const repo = process.env.GITHUB_REPO || 'budao.org';
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || 'main';

const { getAuthenticatedPublisher } = require('./_security/auth');
const { requireJsonPost, requireSameOrigin, sendJson } = require('./_security/http');
const { clientIp, consume } = require('./_security/rate-limit');
const { validateCreateInvitation } = require('./_security/invitation-schema');

const slotOwners = { IMS: 'IMS@budao.org', BACBC: 'BACBC@budao.org' };
const fixedSlots = ['IMS', 'BACBC'];

module.exports = async function handler(request, response) {
  const parsed = requireJsonPost(request);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: 'forbidden' });
  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: 'unauthorized' });
  if (!consume('invite:' + publisher.id + ':' + clientIp(request), 10, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: 'rate_limited' });
  }

  const validated = validateCreateInvitation(parsed.body);
  if (validated.error) return sendJson(response, 400, { ok: false, reason: validated.error });
  const tokenNow = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!tokenNow) return sendJson(response, 503, { ok: false, reason: 'publishing_unavailable' });

  try {
    const routes = await readRoutesFile();
    const route = (routes || []).find((r) => (r.routeId || r.id) === validated.value.routeId);
    if (!route) return sendJson(response, 404, { ok: false, reason: 'route_not_found' });

    const routeSlot = normalizeSlot(route.slot) || slotForOwner(route.owner);
    if (routeSlot !== publisher.slot) return sendJson(response, 403, { ok: false, reason: 'forbidden' });

    // Build snapshot from allowed fields
    const snapshot = buildSnapshot(route, publisher);

    // Generate unique invitationId and write file
    const invitationId = await createInvitationFile(snapshot);
    if (!invitationId) return sendJson(response, 500, { ok: false, reason: 'network_failed' });

    return sendJson(response, 201, { ok: true, id: invitationId, snapshot });
  } catch (error) {
    if (error && error.reason) return sendJson(response, error.status || 500, { ok: false, reason: error.reason });
    return sendJson(response, 500, { ok: false, reason: 'network_failed' });
  }
};

function normalizeSlot(value) {
  if (!value || typeof value !== 'string') return '';
  return String(value).trim().toUpperCase();
}

function slotForOwner(owner) {
  if (!owner || typeof owner !== 'string') return '';
  const trimmed = owner.trim();
  for (const s of fixedSlots) {
    if (slotOwners[s] === trimmed) return s;
  }
  return '';
}

function buildSnapshot(route, publisher) {
  const now = new Date().toISOString();
  const id = null; // will be filled after file created
  const sourceRoute = { routeId: route.routeId || route.id || '' };
  const facts = {
    title: route.title || '',
    location: route.location || '',
    date: route.date || '',
    time: route.time || '',
    timezone: route.timezone || '',
    duration: route.duration || '',
    distance: route.distance || '',
    elevation: route.elevation || '',
    surface: route.surface || '',
    difficulty: route.difficulty || '',
    suitableFor: route.suitableFor || '',
    equipmentMinimum: route.equipmentMinimum || '',
    participantRequirements: route.participantRequirements || '',
    meetingPlace: route.meetingPlace || '',
    description: route.description || ''
  };

  const visual = { mode: 'original', source: route.image || route.imageUrl || '' };
  const participation = route.qrCode ? { type: 'legacy_qr', artifact: route.qrCode } : { type: 'none', artifact: '' };
  const presentation = { collection: 'daily', template: 'journey' };

  return {
    id: '',
    sourceRoute,
    facts,
    visual,
    participation,
    presentation,
    revision: 1,
    createdAt: now,
    createdBy: publisher.id
  };
}

async function readRoutesFile() {
  const url = 'https://api.github.com/repos/' + owner + '/' + repo + '/contents/routes.json?ref=' + branch;
  const res = await githubFetch(url, { method: 'GET' });
  if (res.status === 404) return [];
  if (res.status === 401 || res.status === 403) throw { reason: 'token_invalid', status: 401 };
  if (!res.ok) throw { reason: 'network_failed', status: res.status };
  const file = await res.json();
  const text = Buffer.from(file.content || '', 'base64').toString('utf8');
  try {
    const routes = JSON.parse(text || '[]');
    return routes;
  } catch (e) {
    throw { reason: 'json_conflict', status: 409 };
  }
}

function githubFetch(url, options) {
  const tokenNow = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  return fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: tokenNow ? 'Bearer ' + tokenNow : '',
      'Content-Type': 'application/json',
      'User-Agent': 'budao-invitation-service',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  });
}

async function createInvitationFile(snapshot) {
  const maxAttempts = 6;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const id = generateId(8);
    const path = 'invitations/' + id + '.json';
    const body = {
      message: 'Create Invitation: ' + id,
      content: Buffer.from(JSON.stringify({ ...snapshot, id }, null, 2) + '\n', 'utf8').toString('base64'),
      branch
    };

    try {
      const res = await githubFetch('https://api.github.com/repos/' + owner + '/' + repo + '/contents/' + path, {
        method: 'PUT',
        body: JSON.stringify(body)
      });

      if (res.status === 401 || res.status === 403) throw { reason: 'token_invalid', status: 401 };
      if (res.status === 409 || res.status === 422) {
        // conflict - try another id
        continue;
      }
      if (!res.ok) throw { reason: 'network_failed', status: res.status };

      // success
      snapshot.id = id;
      return id;
    } catch (err) {
      if (err && err.reason === 'token_invalid') throw err;
      if (attempt === maxAttempts - 1) throw { reason: 'invitation_conflict' };
      // otherwise retry
    }
  }
  return null;
}

function generateId(length) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}
