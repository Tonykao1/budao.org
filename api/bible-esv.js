const { clientIp, consume } = require('./_security/rate-limit');

const ESV_ENDPOINT = 'https://api.esv.org/v3/passage/text/';
const MAX_REFERENCE_LENGTH = 96;
const REFERENCE_RE = /^(?:[1-3]\s)?[A-Za-z]+(?:\s(?:of\s)?[A-Za-z]+)*\s\d{1,3}(?::\d{1,3}(?:-\d{1,3})?)?$/;

function sendJson(response, status, body) {
  response.setHeader('Cache-Control', 'private, no-store, max-age=0');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.status(status).json(body);
}

function normalizeReference(value) {
  const reference = String(value || '').trim().replace(/\s+/g, ' ');
  if (!reference || reference.length > MAX_REFERENCE_LENGTH || !REFERENCE_RE.test(reference)) return null;
  return reference;
}

function buildEsvUrl(reference) {
  const url = new URL(ESV_ENDPOINT);
  url.searchParams.set('q', reference);
  url.searchParams.set('include-passage-references', 'false');
  url.searchParams.set('include-verse-numbers', 'false');
  url.searchParams.set('include-first-verse-numbers', 'false');
  url.searchParams.set('include-footnotes', 'false');
  url.searchParams.set('include-footnote-body', 'false');
  url.searchParams.set('include-headings', 'false');
  url.searchParams.set('include-short-copyright', 'true');
  url.searchParams.set('include-passage-horizontal-lines', 'false');
  url.searchParams.set('include-heading-horizontal-lines', 'false');
  url.searchParams.set('line-length', '0');
  return url;
}

module.exports = async function handler(request, response) {
  if (request.method !== 'GET') return sendJson(response, 405, { ok: false, reason: 'method_not_allowed' });

  const reference = normalizeReference(request.query && request.query.reference);
  if (!reference) return sendJson(response, 400, { ok: false, reason: 'invalid_reference' });

  const apiKey = String(process.env.ESV_API_KEY || '').trim();
  if (!apiKey) return sendJson(response, 503, { ok: false, reason: 'esv_not_configured' });

  const ip = clientIp(request);
  if (!consume(`bible-esv:ip:${ip}`, 30, 60_000) || !consume('bible-esv:global', 55, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: 'rate_limited' });
  }

  try {
    const upstream = await fetch(buildEsvUrl(reference), {
      method: 'GET',
      headers: {
        Authorization: `Token ${apiKey}`,
        Accept: 'application/json'
      }
    });

    if (!upstream.ok) {
      const status = upstream.status === 429 ? 429 : 502;
      return sendJson(response, status, { ok: false, reason: upstream.status === 429 ? 'rate_limited' : 'esv_unavailable' });
    }

    const data = await upstream.json();
    const text = Array.isArray(data.passages) ? String(data.passages[0] || '').trim() : '';
    if (!text) return sendJson(response, 404, { ok: false, reason: 'passage_not_found' });

    return sendJson(response, 200, {
      ok: true,
      canonical: String(data.canonical || reference),
      text,
      copyright: 'ESV'
    });
  } catch (error) {
    return sendJson(response, 502, { ok: false, reason: 'esv_unavailable' });
  }
};

module.exports._private = { normalizeReference, buildEsvUrl };
