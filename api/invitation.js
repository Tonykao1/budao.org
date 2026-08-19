const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') {
    response.status(405).json({ ok: false, reason: 'method_not_allowed' });
    return;
  }

  const id = request.query && typeof request.query.id === 'string' ? String(request.query.id) : '';

  if (!isValidId(id)) {
    response.status(400).json({ ok: false, reason: 'invalid_id' });
    return;
  }

  const filePath = `invitations/${id}.json`;

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`;

  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'budao-invitation-reader',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  if (token) headers.Authorization = 'Bearer ' + token;

  try {
    const res = await fetch(url, { method: 'GET', headers });

    if (res.status === 404) {
      response.status(404).json({ ok: false, reason: 'invitation_not_found' });
      return;
    }

    if (res.status === 401 || res.status === 403) {
      response.status(503).json({ ok: false, reason: 'publishing_unavailable' });
      return;
    }

    if (!res.ok) {
      response.status(500).json({ ok: false, reason: 'network_failed' });
      return;
    }

    const file = await res.json();
    const text = Buffer.from(file.content || '', 'base64').toString('utf8');
    let invitation;
    try {
      invitation = JSON.parse(text || '{}');
    } catch (e) {
      response.status(500).json({ ok: false, reason: 'invalid_invitation' });
      return;
    }

    // minimal structural validation
    if (!invitation || typeof invitation !== 'object' || invitation.id !== id ||
        !invitation.sourceRoute || !invitation.sourceRoute.routeId || !invitation.facts || !invitation.visual || !invitation.participation || !invitation.presentation || typeof invitation.revision === 'undefined' || !invitation.createdAt) {
      response.status(500).json({ ok: false, reason: 'invalid_invitation' });
      return;
    }

    // return immutable snapshot
    response.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=600');
    response.status(200).json({ ok: true, invitation });
  } catch (error) {
    response.status(500).json({ ok: false, reason: 'network_failed' });
  }
};

function isValidId(value) {
  if (!value || typeof value !== 'string') return false;
  // only allow URL-safe alphanumeric ids as used in Phase1A generator
  return /^[A-Za-z0-9]{4,64}$/.test(value);
}
