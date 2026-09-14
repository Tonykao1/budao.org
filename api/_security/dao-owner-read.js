const { eq } = require("drizzle-orm");

const { getDb } = require("../../db/client");
const { daoRecords } = require("../../db/schema");
const { getAuthenticatedPublisher } = require("./auth");
const { sendJson } = require("./http");

let testAdapter;

async function handleDaoOwnerRead(request, response) {
  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });

  try {
    const rows = await listRowsForPublisher(publisher.id);
    const items = rows
      .map(ownerDao)
      .filter(Boolean)
      .filter((item) => ["PENDING_REVIEW", "RETURNED", "PUBLISHED"].includes(item.status))
      .sort((left, right) => String(right.submittedAt || "").localeCompare(String(left.submittedAt || "")));

    response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    return sendJson(response, 200, {
      ok: true,
      count: items.length,
      items
    });
  } catch (error) {
    if (error && error.code === "42P01") {
      response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
      return sendJson(response, 200, { ok: true, count: 0, items: [] });
    }
    return sendJson(response, 503, { ok: false, reason: "dao_storage_unavailable" });
  }
}

async function listRowsForPublisher(publisherId) {
  if (testAdapter) return testAdapter.listByPublisher(publisherId);
  const db = getDb();
  return db.select().from(daoRecords).where(eq(daoRecords.publisherId, publisherId));
}

function ownerDao(row) {
  if (!row) return null;
  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};
  const review = payload.review && typeof payload.review === "object" ? payload.review : {};
  const scripture = payload.scripture && typeof payload.scripture === "object" ? payload.scripture : {};

  return {
    id: row.id || payload.id || "",
    daoCode: row.daoCode || payload.daoCode || "",
    status: row.status || payload.status || "",
    frozen: Boolean(row.frozen || payload.frozen),
    devotionalDate: row.devotionalDate || payload.devotionalDate || "",
    submittedAt: dateString(row.submittedAt) || payload.submittedAt || "",
    publishedAt: dateString(row.publishedAt) || payload.publishedAt || null,
    publisherName: row.publisherName || payload.publisher && payload.publisher.name || "",
    publicationTimezone: payload.publicationTimezone || "",
    publicationLocale: payload.publicationLocale || "",
    scripture,
    theme: payload.theme || "",
    cardIntro: payload.cardIntro || "",
    questions: Array.isArray(payload.questions) ? payload.questions : [],
    story: payload.story || "",
    highlights: payload.highlights || "",
    response: payload.response || "",
    prayer: payload.prayer || "",
    review: {
      decision: review.decision || "PENDING",
      notes: review.notes || "",
      reviewedAt: review.reviewedAt || null
    },
    tongdao: payload.tongdao || { available: false },
    card: payload.card || { status: "PENDING", url: "" }
  };
}

function dateString(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function setOwnerDaoAdapterForTests(adapter) {
  testAdapter = adapter || undefined;
}

module.exports = {
  handleDaoOwnerRead,
  ownerDao,
  setOwnerDaoAdapterForTests
};
