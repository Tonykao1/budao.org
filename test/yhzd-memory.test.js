const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const page = fs.readFileSync(path.join(__dirname, '..', 'yhzd.html'), 'utf8');

test('yhzd keeps image and message memory independent', () => {
  assert.match(page, /budao:yhzd:imageHistory:v1/);
  assert.match(page, /budao:yhzd:messageHistory:v1/);
});

test('yhzd is a wandering field, not a gallery', () => {
  assert.match(page, /memory-viewport/);
  assert.match(page, /width:max\(168vw,1800px\)/);
  assert.doesNotMatch(page, /object-fit\s*:\s*cover/i);
  assert.doesNotMatch(page, /caption|carousel|pagination/i);
});
