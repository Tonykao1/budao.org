"use strict";
const { compose, validPart } = require("../../mobile-tent-location");

function validateMobileRoutePublish(value) {
  if (!value || typeof value !== "object") return "invalid_request";
  const required = ["title", "date", "time", "country", "city", "region", "surface", "meetingPlace"];
  if (required.some((name) => typeof value[name] !== "string" || !value[name].trim())) {
    return "missing_required_field";
  }
  if (!validPart(value.country, 80) || !validPart(value.city, 80) ||
      !validPart(value.region, 120)) return "invalid_location";
  const expectedLocation = compose(value);
  if (!expectedLocation || expectedLocation.length > 240 || value.location !== expectedLocation) {
    return "invalid_location";
  }
  const date = value.date;
  const parsedDate = Date.parse(date + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(parsedDate) ||
      new Date(parsedDate).toISOString().slice(0, 10) !== date) return "invalid_date";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)) return "invalid_time";
  return "";
}

module.exports = { validateMobileRoutePublish };
