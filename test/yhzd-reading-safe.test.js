const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'yhzd-editorial.css'), 'utf8');

test('desktop editorial layout preserves a generous reading safe zone', () => {
  assert.match(css, /--yhzd-page-width:\s*min\(88vw,1360px\)/);
  assert.match(css, /\.yhzd-hero\s*\{[^}]*min-height:\s*calc\(100svh\s*-\s*56px\)/s);
  assert.match(css, /\.editorial-scene\s*\{[^}]*min-height:\s*calc\(100svh\s*-\s*56px\)/s);
  assert.match(css, /\.editorial-quote\s*\{[^}]*min-width:\s*0[^}]*width:\s*min\(100%,420px\)[^}]*overflow-wrap:\s*anywhere/s);
  assert.match(css, /\.editorial-quote-text\s*\{[^}]*text-wrap:\s*pretty[^}]*line-break:\s*strict/s);
  assert.match(css, /\.editorial-scene--primary \.editorial-quote-text\s*\{[^}]*font-size:\s*clamp\(30px,2\.2vw,38px\)/s);
});
