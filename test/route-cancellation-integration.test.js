const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function source(file) {
  return fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
}

test('routes resource follows preview or publish branch before falling back to main', () => {
  const src = source('api/routes.js');
  assert.match(src, /GITHUB_PUBLISH_BRANCH/);
  assert.match(src, /VERCEL_ENV\s*===\s*["']preview["']/);
  assert.match(src, /VERCEL_GIT_COMMIT_REF/);
});

test('normal route publishing preserves server-managed cancellation state', () => {
  const src = source('api/publish-route-v2.js');
  assert.match(src, /status:\s*route\.status\s*===\s*["']cancelled["']/);
  assert.match(src, /cancelCode:\s*route\.status\s*===\s*["']cancelled["']/);
  assert.match(src, /statusHistory:\s*Array\.isArray\(route\.statusHistory\)/);
  assert.match(src, /routeToSave\.status\s*=\s*existing\.status\s*===\s*["']cancelled["']/);
  assert.match(src, /routeToSave\.statusHistory\s*=\s*Array\.isArray\(existing\.statusHistory\)/);
});

test('Tent and public route page both load the shared cancellation core', () => {
  const tent = source('tent-meeting-module.js');
  const publicAction = source('route-invitation-action.js');
  assert.match(tent, /route-cancellation-core\.js/);
  assert.match(tent, /tent-cancellation\.js/);
  assert.match(publicAction, /route-cancellation-core\.js/);
  assert.match(publicAction, /route-cancellation-public\.js/);
});

test('existing routes function owns authenticated cancel and restore mutations', () => {
  const routes = source('api/routes.js');
  const tent = source('tent-cancellation.js');
  assert.match(routes, /getAuthenticatedPublisher/);
  assert.match(routes, /requireSameOrigin/);
  assert.match(routes, /action\s*!==\s*["']cancel["']/);
  assert.match(routes, /action\s*!==\s*["']restore["']/);
  assert.match(routes, /route\.slot\)\s*===\s*publisher\.slot/);
  assert.match(routes, /cancellation\.cancelRoute/);
  assert.match(routes, /cancellation\.restoreRoute/);
  assert.match(tent, /fetch\(["']\/api\/routes["']/);
  assert.equal(fs.existsSync(path.join(__dirname, '..', 'api', 'route-status.js')), false);
});
