const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function requireExisting(relativePath) {
  const absolute = path.join(root, relativePath);
  assert.equal(fs.existsSync(absolute), true, `${relativePath} is missing`);
  delete require.cache[require.resolve(absolute)];
  return require(absolute);
}

test('pasture auth domain protects email identity and validates the resident appearance', () => {
  process.env.PASTURE_SESSION_SECRET = 'pasture-test-secret-which-is-definitely-longer-than-thirty-two-characters';
  const domain = requireExisting('api/_security/pasture-auth-domain.js');

  assert.equal(domain.validEmail('walker@example.com'), true);
  assert.equal(domain.validEmail('bad email'), false);
  assert.equal(domain.normalizeEmail('  WALKER@EXAMPLE.COM '), 'walker@example.com');
  assert.equal(domain.maskEmail('walker@example.com'), 'wa***@example.com');
  assert.equal(domain.emailHash('WALKER@example.com'), domain.emailHash('walker@example.com'));
  assert.notEqual(domain.emailHash('walker@example.com'), domain.emailHash('other@example.com'));

  const encrypted = domain.encryptEmail('walker@example.com');
  assert.notEqual(encrypted, 'walker@example.com');
  assert.equal(domain.decryptEmail(encrypted), 'walker@example.com');

  const cookie = domain.serializeSessionCookie('token', false);
  assert.match(cookie, /budao_pasture_session=token/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /Max-Age=15552000/);

  const sheep = domain.validateSheep({
    bodyColor: domain.BODY_COLORS[0],
    headColor: domain.HEAD_COLORS[1],
    marking: 'FACE'
  });
  assert.deepEqual(sheep, {
    bodyColor: domain.BODY_COLORS[0],
    headColor: domain.HEAD_COLORS[1],
    marking: 'FACE'
  });
  assert.equal(domain.BODY_COLORS.length, 8);
  assert.equal(domain.HEAD_COLORS.length, 8);
  assert.throws(
    () => domain.validateSheep({ bodyColor: '#000000', headColor: domain.HEAD_COLORS[0], marking: 'NONE' }),
    /invalid_sheep/
  );
});

test('pasture identity migrations are additive, private, one-resident-one-sheep, and include durable rate limits', () => {
  const schema = read('db/schema.js');
  for (const name of ['pastureUsers', 'pastureEmailVerifications', 'pastureSessions', 'pastureSheep', 'pastureRateLimits']) {
    assert.match(schema, new RegExp(`const ${name} = pgTable`));
  }
  assert.match(schema, /const stewardshipUsers = pgTable/);

  for (const migration of [
    'db/migrations/0004_pasture_identity.sql',
    'db/migrations/0005_pasture_encrypted_email.sql',
    'db/migrations/0006_pasture_rate_limits.sql'
  ]) {
    assert.equal(fs.existsSync(path.join(root, migration)), true, `${migration} is missing`);
  }

  const identity = read('db/migrations/0004_pasture_identity.sql');
  assert.match(identity, /CREATE TABLE IF NOT EXISTS pasture_users/);
  assert.match(identity, /email_masked text NOT NULL/);
  assert.match(identity, /CREATE TABLE IF NOT EXISTS pasture_email_verifications/);
  assert.match(identity, /CREATE TABLE IF NOT EXISTS pasture_sessions/);
  assert.match(identity, /CREATE TABLE IF NOT EXISTS pasture_sheep/);
  assert.match(identity, /CREATE UNIQUE INDEX IF NOT EXISTS pasture_sheep_user_id_uq[\s\S]*pasture_sheep\(user_id\)/);
  assert.match(identity, /REFERENCES pasture_users\(id\) ON DELETE CASCADE/);

  const encryptedEmail = read('db/migrations/0005_pasture_encrypted_email.sql');
  assert.match(encryptedEmail, /email_ciphertext/);
  assert.match(encryptedEmail, /email_nonce/);
  assert.match(encryptedEmail, /email_tag/);

  const rateLimit = read('db/migrations/0006_pasture_rate_limits.sql');
  assert.match(rateLimit, /CREATE TABLE IF NOT EXISTS pasture_rate_limits/);
  assert.match(rateLimit, /key_hash TEXT PRIMARY KEY/);
  assert.match(rateLimit, /window_started_at/);
  assert.match(rateLimit, /count INTEGER/);
});

test('pasture rate limiting uses the database as the durable authority', () => {
  const store = read('api/_security/pasture-auth-store.js');
  assert.match(store, /async function consumePastureRateLimit/);
  assert.match(store, /INSERT INTO pasture_rate_limits/);
  assert.match(store, /ON CONFLICT \(key_hash\) DO UPDATE/);
  assert.match(store, /RETURNING count <=/);

  const handler = read('api/_security/pasture-auth-handler.js');
  assert.match(handler, /consumePastureRateLimit/);
  assert.match(handler, /30\s*,\s*60_000/);
  assert.match(handler, /4\s*,\s*15\s*\*\s*60_000/);
});

test('public pasture auth route reuses the small publish-route dispatcher without adding a function', () => {
  const config = JSON.parse(read('vercel.json'));
  const rewrites = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));
  assert.equal(rewrites.get('/api/pasture-auth'), '/api/publish-route');

  const router = read('api/publish-route.js');
  assert.match(router, /pasture-auth-handler/);
  assert.match(router, /\/api\/pasture-auth/);
});

test('registration email describes the resident as the sheep, never as property', () => {
  const handler = read('api/_security/pasture-auth-handler.js');
  assert.doesNotMatch(handler, /拥有一只属于自己的羊|我的羊|你的羊/);
  assert.match(handler, /你将以自己捏出的羊进入数字牧场/);
});
