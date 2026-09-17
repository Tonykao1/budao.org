const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');

test('calendar module spans previous final week, full current month, and next first week', () => {
  const calendar = require('../budao-calendar.js');
  const model = calendar.buildCalendarModel(new Date('2026-09-17T12:00:00+08:00'));

  assert.equal(model.previous.days.length, 7);
  assert.equal(model.current.days.length, 30);
  assert.equal(model.next.days.length, 7);
  assert.equal(model.previous.days.at(-1).monthIndex, 7); // August
  assert.equal(model.current.monthIndex, 8); // September
  assert.equal(model.current.days[0].day, 1);
  assert.equal(model.current.days.at(-1).day, 30);
  assert.equal(model.next.days[0].monthIndex, 9); // October
  assert.equal(model.current.days.find((day) => day.day === 17).isToday, true);
});

test('test page places an empty calendar between hero copy and route slots', () => {
  const html = fs.readFileSync(path.join(root, 'test.html'), 'utf8');
  const heroEnd = html.indexOf('</div>', html.indexOf('class="super-hero"'));
  const calendar = html.indexOf('id="budaoCalendar"');
  const routeGrid = html.indexOf('id="routeGrid"');

  assert.ok(calendar > heroEnd, 'calendar must appear after hero');
  assert.ok(routeGrid > calendar, 'calendar must appear before route slots');
  assert.match(html, /budao-calendar\.css/);
  assert.match(html, /budao-calendar\.js/);
});

test('calendar presentation contains no footprint marks or activity legend yet', () => {
  const css = fs.readFileSync(path.join(root, 'budao-calendar.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'budao-calendar.js'), 'utf8');
  const combined = css + '\n' + js;

  assert.doesNotMatch(combined, /footprint|foot-mark|探路|正式步道|灵修行军|营会|同道/);
});

test('calendar mounts synchronously during parsing instead of after DOMContentLoaded', () => {
  const js = fs.readFileSync(path.join(root, 'budao-calendar.js'), 'utf8');

  assert.doesNotMatch(js, /DOMContentLoaded/, 'calendar must not wait until after first layout to mount');
  assert.match(js, /getElementById\("budaoCalendar"\)/);
  assert.match(js, /api\.mount\(host, new Date\(\)\)/);
});

test('today is centered for desktop and mobile viewport widths', () => {
  const calendar = require('../budao-calendar.js');

  assert.equal(typeof calendar.centeredScrollPosition, 'function');
  assert.equal(calendar.centeredScrollPosition(1200, 40, 1440), 500);
  assert.equal(calendar.centeredScrollPosition(1200, 40, 390), 1025);

  const js = fs.readFileSync(path.join(root, 'budao-calendar.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'budao-calendar.css'), 'utf8');

  assert.match(js, /centerToday\(host\)/, 'calendar must center today immediately after mount');
  assert.match(js, /addEventListener\("resize"/, 'calendar must recenter when terminal width changes');
  assert.match(css, /\.budao-calendar-spacer[\s\S]*flex:\s*0\s+0\s+50%/, 'calendar needs side scroll space so today can center even on wide screens');
});
