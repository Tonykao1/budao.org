const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root,'maina.html'),'utf8');
const code = fs.readFileSync(path.join(root,'maina/maina.js'),'utf8');
const catalog = JSON.parse(fs.readFileSync(path.join(root,'maina/catalog.json'),'utf8'));
test('买拿是独立页面，不改变主导航', () => {
  assert.match(page, /<title>买拿/);
  assert.match(page, /href="\/home.html"/);
  assert.doesNotMatch(page, /<nav[^>]*>\s*<a[^>]*>商城/);
});
test('预备期无虚构商品、无可用结算或支付', () => {
  assert.equal(catalog.schema_version, 1);
  assert.equal(catalog.status, 'prelaunch');
  assert.deepEqual(catalog.products, []);
  assert.match(page, /尚未开放在线交易/);
  assert.doesNotMatch(page, /paypal\.com\/checkout|checkout\.stripe\.com|立即支付/);
  assert.match(code, /status === 'published'/);
  assert.doesNotMatch(code, /innerHTML/);
});
test('页面不会收集消费者信息', () => {
  assert.doesNotMatch(page, /<form\b|type="email"|type="password"/i);
  assert.match(page, /name="robots" content="noindex, nofollow"/);
});