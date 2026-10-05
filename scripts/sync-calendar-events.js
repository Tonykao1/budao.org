const fs = require("node:fs");
const path = require("node:path");

const allowedTypes = new Set(["pioneer", "budao", "march", "camp", "fellowship", "none"]);

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function normalizeSlot(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeType(value) {
  const type = String(value || "budao").trim().toLowerCase();
  return allowedTypes.has(type) ? type : "budao";
}

function routeIdentity(value) {
  return String(value || "").trim();
}

function eventKey(event) {
  if (event.source === "tent") {
    const routeId = routeIdentity(event.routeId);
    if (routeId) return ["tent", "route", routeId, event.date, event.type].join("|");
    return ["tent", "slot", event.slot || "", event.date, event.type].join("|");
  }

  return [event.source || "legacy", event.date, event.type].join("|");
}

function sameTentRoute(event, routeId, slot) {
  if (!event || event.source !== "tent") return false;
  const eventRouteId = routeIdentity(event.routeId);
  if (routeId) return eventRouteId === routeId;
  return !eventRouteId && Boolean(slot) && normalizeSlot(event.slot) === slot;
}

function syncCalendarEvents(routes, events, today) {
  let next = (Array.isArray(events) ? events : [])
    .filter(function (event) {
      return event && validDate(event.date) && allowedTypes.has(event.type);
    })
    .map(function (event) {
      return { ...event };
    });

  (Array.isArray(routes) ? routes : []).forEach(function (route) {
    const slot = normalizeSlot(route && route.slot);
    const routeId = routeIdentity(route && (route.routeId || route.id));
    const date = String(route && route.date || "");
    const type = normalizeType(route && route.calendarType);

    if ((!routeId && !slot) || !validDate(date)) {
      return;
    }

    next = next.filter(function (event) {
      return !(sameTentRoute(event, routeId, slot) && validDate(event.date) && event.date >= today);
    });

    if (type === "none") {
      return;
    }

    next.push({
      date,
      type,
      source: "tent",
      slot,
      routeId,
      title: String(route.title || "")
    });
  });

  const unique = new Map();
  next.forEach(function (event) {
    unique.set(eventKey(event), event);
  });

  return Array.from(unique.values()).sort(function (left, right) {
    return left.date.localeCompare(right.date) ||
      String(left.type).localeCompare(String(right.type)) ||
      String(left.routeId || "").localeCompare(String(right.routeId || "")) ||
      String(left.slot || "").localeCompare(String(right.slot || ""));
  });
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    return fallback;
  }
}

function main() {
  const root = path.join(__dirname, "..");
  const routesPath = path.join(root, "routes.json");
  const eventsPath = path.join(root, "calendar-events.json");
  const routes = readJson(routesPath, []);
  const events = readJson(eventsPath, []);
  const today = process.env.CALENDAR_SYNC_TODAY || new Date().toISOString().slice(0, 10);
  const next = syncCalendarEvents(routes, events, today);
  const output = JSON.stringify(next, null, 2) + "\n";
  const current = fs.existsSync(eventsPath) ? fs.readFileSync(eventsPath, "utf8") : "";

  if (output !== current) {
    fs.writeFileSync(eventsPath, output);
  }
}

if (require.main === module) {
  main();
}

module.exports = { syncCalendarEvents };
