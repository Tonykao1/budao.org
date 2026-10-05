const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const calendar = require("../budao-calendar.js");
const { syncCalendarEvents } = require("../scripts/sync-calendar-events.js");

test("live Tent routes project into the calendar as standard Budao steps", () => {
  const merged = calendar.mergeStepSchedule({}, [], [
    { date: "2026-09-21", slot: "HD", routeId: "budao-hd", title: "Future route" },
    { date: "2026-09-21", slot: "IMS", routeId: "budao-ims", title: "Same day" }
  ]);

  assert.deepEqual(merged["2026-09-21"], ["budao"]);
});

test("calendar ledger keeps past Tent events and replaces future plans for the same slot", () => {
  const existing = [
    { date: "2026-09-10", type: "budao", source: "tent", slot: "HD", routeId: "budao-hd", title: "Past" },
    { date: "2026-09-25", type: "budao", source: "tent", slot: "HD", routeId: "budao-hd", title: "Old future" },
    { date: "2026-09-05", type: "pioneer", source: "legacy" }
  ];
  const routes = [
    { date: "2026-09-27", slot: "HD", routeId: "budao-hd", title: "Rescheduled" }
  ];

  const synced = syncCalendarEvents(routes, existing, "2026-09-18");

  assert.ok(synced.some((event) => event.date === "2026-09-10" && event.slot === "HD"));
  assert.equal(synced.some((event) => event.date === "2026-09-25" && event.slot === "HD"), false);
  assert.ok(synced.some((event) => event.date === "2026-09-27" && event.slot === "HD"));
  assert.ok(synced.some((event) => event.date === "2026-09-05" && event.type === "pioneer"));
});

test("leader routes without persisted presentation slots still sync into calendar by route identity", () => {
  const existing = [
    { date: "2026-10-10", type: "budao", source: "tent", slot: "IMS", routeId: "budao-leader-tony", title: "Old title" }
  ];
  const routes = [
    { date: "2026-10-11", slot: "", routeId: "budao-leader-tony", leader: "tony", title: "Leader route" },
    { date: "2026-10-12", slot: "", routeId: "budao-leader-moses", leader: "moses", title: "Second leader route" }
  ];

  const synced = syncCalendarEvents(routes, existing, "2026-10-05");

  assert.equal(synced.some((event) => event.date === "2026-10-10" && event.routeId === "budao-leader-tony"), false);
  assert.ok(synced.some((event) => event.date === "2026-10-11" && event.routeId === "budao-leader-tony" && event.slot === ""));
  assert.ok(synced.some((event) => event.date === "2026-10-12" && event.routeId === "budao-leader-moses" && event.slot === ""));
});

test("calendar integration stays outside the stable Tent publishing path", () => {
  const root = path.join(__dirname, "..");
  const tent = fs.readFileSync(path.join(root, "tent-app.js"), "utf8");
  const publish = fs.readFileSync(path.join(root, "api", "publish-route-v2.js"), "utf8");

  assert.doesNotMatch(tent, /calendar-events\.json|sync-calendar-events/);
  assert.doesNotMatch(publish, /calendar-events\.json|sync-calendar-events/);
});
