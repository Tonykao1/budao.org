const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const css = fs.readFileSync(path.join(__dirname, '..', 'budao-calendar.css'), 'utf8');

test('calendar step mark is doubled without changing calendar spacing', () => {
  assert.match(css, /\.budao-calendar-step-mark\{[\s\S]*?width:\s*36px;[\s\S]*?height:\s*40px;/);
  assert.match(css, /\.budao-calendar-step-stack\{[\s\S]*?position:\s*absolute;/);
  assert.match(css, /\.budao-calendar\{[\s\S]*?margin:\s*-28px 0 88px;/);
});

test('reserved two and three mark layouts preserve the approved vertical stack', () => {
  assert.match(css, /data-count="2"[\s\S]*?nth-child\(1\)[\s\S]*?top:\s*0;/);
  assert.match(css, /data-count="2"[\s\S]*?nth-child\(2\)[\s\S]*?top:\s*46px;/);
  assert.match(css, /data-count="3"[\s\S]*?nth-child\(1\)[\s\S]*?top:\s*0;/);
  assert.match(css, /data-count="3"[\s\S]*?nth-child\(2\)[\s\S]*?top:\s*8px;/);
  assert.match(css, /data-count="3"[\s\S]*?nth-child\(3\)[\s\S]*?top:\s*16px;/);
  assert.doesNotMatch(css, /translateX\(calc\(-50%\s*[+-]/);
});
