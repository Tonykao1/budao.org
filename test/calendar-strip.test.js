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

test('approved historical September step markers render while Aug 29 remains unmarked', () => {
  const calendar = require('../budao-calendar.js');
  const model = calendar.buildCalendarModel(new Date('2026-09-17T12:00:00+08:00'));
  const css = fs.readFileSync(path.join(root, 'budao-calendar.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'budao-calendar.js'), 'utf8');
  const september = Object.fromEntries(model.current.days.map((day) => [day.day, day.steps]));
  const august29 = model.previous.days.find((day) => day.day === 29);
  const markedDays = model.current.days.filter((day) => day.steps && day.steps.length);

  assert.deepEqual(august29.steps, [], 'Aug 29 must remain unmarked for now');
  assert.deepEqual(september[4], ['fellowship']);
  assert.deepEqual(september[5], ['budao', 'pioneer']);
  assert.deepEqual(september[11], ['pioneer']);
  assert.deepEqual(september[12], ['budao']);
  assert.deepEqual(september[13], ['budao']);
  assert.deepEqual(september[19], ['budao']);
  assert.equal(markedDays.length, 6, 'only the six approved September dates should be marked');
  assert.match(js, /2026-09-04/);
  assert.match(js, /2026-09-05/);
  assert.match(js, /2026-09-11/);
  assert.match(js, /2026-09-12/);
  assert.match(js, /2026-09-13/);
  assert.match(js, /2026-09-19/);
  assert.match(js, /data-count=\\\"/);
  assert.match(css, /\.budao-calendar-step-stack\[data-count="2"\]/, 'Sep 5 must use the reserved two-mark layout');
  assert.match(css, /\.budao-calendar-step-stack\[data-count="3"\]/, 'three-mark layout must remain reserved');
  assert.match(css, /\.budao-calendar-step-stack[\s\S]*position:\s*absolute/, 'marks must use existing calendar whitespace without changing flow');
  assert.match(css, /\.budao-calendar-step-mark--budao[\s\S]*var\(--budao-step-shape\)/, 'Budao must keep the approved step shape');
  assert.match(css, /\.budao-calendar-step-mark--pioneer[\s\S]*#D89A08/i, '先锋 must use approved amber gold');
  assert.match(css, /\.budao-calendar-step-mark--fellowship[\s\S]*#8B56C7/i, '同道 must use approved purple');
  assert.match(css, /--budao-step-shape:\s*url\("data:image\/png;base64/i, 'all step types must derive from the exact approved footprint geometry');
});

test('all step marks share the date centerline and multi-step stacks run vertically', () => {
  const css = fs.readFileSync(path.join(root, 'budao-calendar.css'), 'utf8');

  assert.match(css, /\.budao-calendar-step-stack\{[\s\S]*left:\s*50%[\s\S]*transform:\s*translateX\(-50%\)/, 'stack center must lock to the date centerline');
  assert.match(css, /\.budao-calendar-step-mark\{[\s\S]*left:\s*50%/, 'every mark must start from the same date centerline');
  assert.match(css, /\.budao-calendar-step-mark\{[\s\S]*margin-left:\s*7px/, 'footprint artwork needs a 7px optical right correction while the date grid stays fixed');
  assert.match(css, /data-count="1"[\s\S]*translateX\(-50%\)/, 'single mark must remain centered');
  assert.match(css, /data-count="2"[\s\S]*nth-child\(1\)[\s\S]*top:\s*0[\s\S]*translateX\(-50%\)[\s\S]*data-count="2"[\s\S]*nth-child\(2\)[\s\S]*top:\s*46px[\s\S]*translateX\(-50%\)/, 'two 40px marks must stack vertically with a 6px clear gap');
  assert.match(css, /data-count="3"[\s\S]*nth-child\(1\)[\s\S]*top:\s*0[\s\S]*translateX\(-50%\)[\s\S]*data-count="3"[\s\S]*nth-child\(2\)[\s\S]*top:\s*8px[\s\S]*translateX\(-50%\)[\s\S]*data-count="3"[\s\S]*nth-child\(3\)[\s\S]*top:\s*16px[\s\S]*translateX\(-50%\)/, 'three marks must use a shallow vertical stagger on one centerline');
  assert.doesNotMatch(css, /data-count="2"[\s\S]*translateX\(calc\(-50%\s*[+-]/, 'two-mark layout must not fan sideways');
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

test('all month captions are blank so previous current and next dates share one baseline', () => {
  const calendar = require('../budao-calendar.js');
  const model = calendar.buildCalendarModel(new Date('2026-09-17T12:00:00+08:00'));
  const css = fs.readFileSync(path.join(root, 'budao-calendar.css'), 'utf8');

  assert.equal(model.previous.label, '');
  assert.equal(model.current.label, '');
  assert.equal(model.next.label, '');
  assert.match(css, /\.budao-calendar-period[\s\S]*min-height:/, 'empty caption row must keep identical vertical space across all month sections');
});

test('today uses a small iridescent downward triangle instead of the word 今', () => {
  const js = fs.readFileSync(path.join(root, 'budao-calendar.js'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'budao-calendar.css'), 'utf8');

  assert.doesNotMatch(js, /budao-calendar-today-word|>今</, 'today must not render the old 今 word marker');
  assert.match(js, /budao-calendar-today-marker/, 'today must render the prism triangle marker');
  assert.match(css, /\.budao-calendar-today-marker[\s\S]*clip-path:\s*polygon\(50%\s+100%,\s*0\s+0,\s*100%\s+0\)/, 'triangle must point downward');
  assert.match(css, /\.budao-calendar-today-marker[\s\S]*linear-gradient/, 'triangle must use an iridescent gradient');
});
