const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'tonglu.html'), 'utf8');

assert.ok(html.includes('function drawDesktopRestingLamb('), 'small-lamb resting pose renderer must exist');
assert.ok(html.includes("flockHash('budao-lamb-rest-'+key)"), 'resting lamb selection must be date-seeded');
assert.ok(html.includes('restTarget=1+(restRand()<.5?0:1)'), 'each day must choose exactly 1–2 resting lambs');
assert.ok(html.includes('o.rest?drawDesktopRestingLamb'), 'resting lambs must use the resting renderer');

console.log('pasture-lamb-rest integration test passed');
