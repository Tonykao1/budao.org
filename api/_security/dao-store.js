const crypto = require("node:crypto");
const { eq } = require("drizzle-orm");

const { getDb } = require("../../db/client");
const { daoRecords } = require("../../db/schema");
const { getAuthenticatedPublisher } = require("./auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("./http");
const { clientIp, consume } = require("./rate-limit");
const { daoCodeFor, validateDaoSubmission } = require("./dao-schema");

let daoTableReady;
let testAdapter;

async function handleDaoSubmission(request, response) {
  const parsed = requireJsonPost(request, 64 * 1024);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });

  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!consume("dao-publish:" + publisher.id + ":" + clientIp(request), 8, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }

  const validated = validateDaoSubmission(parsed.body);
  if (validated.error) return sendJson(response, 400, { ok: false, reason: validated.error });

  try {
    const now = new Date().toISOString();
    const value = validated.value;
    const daoCode = daoCodeFor(value.devotionalDate, value.scripture);
    const publisherProfile = resolvePublisherProfile(publisher);
    const adapter = getDaoAdapter();
    const existing = await adapter.findByCode(daoCode);

    const candidate = buildPendingCandidate({
      id: existing && existing.id ? existing.id : crypto.randomUUID(),
      daoCode,
      now,
      value,
      publisherProfile
    });

    if (existing) {
      if (!existing.publisher || existing.publisher.id !== publisher.id) {
        return sendJson(response, 409, { ok: false, reason: "duplicate_dao_code" });
      }

      if (existing.status === "PUBLISHED" || existing.frozen) {
        if (sameSubmission(existing, candidate)) {
          return sendJson(response, 200, {
            ok: true,
            idempotent: true,
            dao: publicSubmissionReceipt(existing)
          });
        }
        return sendJson(response, 409, { ok: false, reason: "dao_frozen" });
      }

      if (existing.status === "PENDING_REVIEW" && sameSubmission(existing, candidate)) {
        return sendJson(response, 200, {
          ok: true,
          idempotent: true,
          dao: publicSubmissionReceipt(existing)
        });
      }

      if (existing.status !== "RETURNED") {
        return sendJson(response, 409, { ok: false, reason: "duplicate_dao_code" });
      }

      await adapter.replaceReturned(candidate);
      return sendJson(response, 200, {
        ok: true,
        idempotent: false,
        resubmitted: true,
        dao: publicSubmissionReceipt(candidate)
      });
    }

    await adapter.insert(candidate);

    return sendJson(response, 200, {
      ok: true,
      idempotent: false,
      dao: publicSubmissionReceipt(candidate)
    });
  } catch (error) {
    if (isUniqueViolation(error)) return sendJson(response, 409, { ok: false, reason: "duplicate_dao_code" });
    if (error && error.reason) return sendJson(response, error.status || 500, { ok: false, reason: error.reason });
    return sendJson(response, 503, { ok: false, reason: "dao_storage_unavailable" });
  }
}

async function handleDaoReview(request, response) {
  const parsed = requireJsonPost(request, 8 * 1024);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });

  const reviewer = getAuthenticatedPublisher(request);
  if (!reviewer) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!isDaoReviewer(reviewer)) return sendJson(response, 403, { ok: false, reason: "reviewer_required" });
  if (!consume("dao-review:" + reviewer.id + ":" + clientIp(request), 20, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }

  const review = validateReviewRequest(parsed.body);
  if (review.error) return sendJson(response, 400, { ok: false, reason: review.error });

  try {
    const adapter = getDaoAdapter();
    const existing = await adapter.findByCode(review.value.daoCode);
    if (!existing) return sendJson(response, 404, { ok: false, reason: "dao_not_found" });

    const reviewerProfile = resolvePublisherProfile(reviewer);
    const now = new Date().toISOString();

    if (review.value.action === "APPROVE") {
      if (existing.status === "PUBLISHED" && existing.frozen) {
        return sendJson(response, 200, {
          ok: true,
          idempotent: true,
          dao: publicSubmissionReceipt(existing)
        });
      }
      if (existing.status !== "PENDING_REVIEW") {
        return sendJson(response, 409, { ok: false, reason: "dao_not_pending" });
      }

      const published = applyReview(existing, {
        action: "APPROVE",
        notes: review.value.notes,
        reviewer: reviewerProfile,
        now
      });
      await adapter.updateReview(published);
      return sendJson(response, 200, {
        ok: true,
        idempotent: false,
        dao: publicSubmissionReceipt(published)
      });
    }

    if (existing.status === "RETURNED" && !existing.frozen) {
      return sendJson(response, 200, {
        ok: true,
        idempotent: true,
        dao: publicSubmissionReceipt(existing)
      });
    }
    if (existing.status !== "PENDING_REVIEW") {
      return sendJson(response, 409, { ok: false, reason: "dao_not_pending" });
    }

    const returned = applyReview(existing, {
      action: "RETURN",
      notes: review.value.notes,
      reviewer: reviewerProfile,
      now
    });
    await adapter.updateReview(returned);
    return sendJson(response, 200, {
      ok: true,
      idempotent: false,
      dao: publicSubmissionReceipt(returned)
    });
  } catch (error) {
    return sendJson(response, 503, { ok: false, reason: "dao_storage_unavailable" });
  }
}

async function handleDaoRead(request, response) {
  try {
    const publisher = getAuthenticatedPublisher(request);
    const query = request.query || {};
    const includeMine = String(query.mine || "") === "1" && publisher;
    let items = await getDaoAdapter().list();

    items = items.filter((item) => item && (
      item.status === "PUBLISHED" ||
      (includeMine && item.publisher && item.publisher.id === publisher.id)
    ));

    items = applyDaoFilters(items, query);

    return sendJson(response, 200, {
      ok: true,
      count: items.length,
      items: items.map(publicDao)
    });
  } catch (error) {
    return sendJson(response, 503, { ok: false, reason: "dao_storage_unavailable" });
  }
}

async function handleDaoReviewRead(request, response) {
  const reviewer = getAuthenticatedPublisher(request);
  if (!reviewer) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!isDaoReviewer(reviewer)) return sendJson(response, 403, { ok: false, reason: "reviewer_required" });

  try {
    const query = request.query || {};
    let items = await getDaoAdapter().list();
    const status = String(query.status || "PENDING_REVIEW").trim().toUpperCase();

    if (status === "ALL") {
      items = items.filter((item) => item && ["PENDING_REVIEW", "RETURNED", "PUBLISHED"].includes(item.status));
    } else if (["PENDING_REVIEW", "RETURNED", "PUBLISHED"].includes(status)) {
      items = items.filter((item) => item && item.status === status);
    } else {
      return sendJson(response, 400, { ok: false, reason: "invalid_review_status" });
    }

    items = applyDaoFilters(items, query);
    items.sort((left, right) => String(right.submittedAt || "").localeCompare(String(left.submittedAt || "")));

    return sendJson(response, 200, {
      ok: true,
      count: items.length,
      items: items.map(reviewDao)
    });
  } catch (error) {
    return sendJson(response, 503, { ok: false, reason: "dao_storage_unavailable" });
  }
}

function buildPendingCandidate({ id, daoCode, now, value, publisherProfile }) {
  return {
    id,
    daoCode,
    status: "PENDING_REVIEW",
    frozen: false,
    devotionalDate: value.devotionalDate,
    submittedAt: now,
    publishedAt: null,
    publicationTimezone: value.publicationTimezone,
    publicationLocale: value.publicationLocale,
    publisher: publisherProfile,
    scripture: value.scripture,
    theme: value.theme,
    cardIntro: value.cardIntro,
    questions: value.questions,
    story: value.story,
    highlights: value.highlights,
    response: value.response,
    prayer: value.prayer,
    tags: {
      themes: [],
      seasons: [],
      terrains: []
    },
    preflight: {
      passed: true,
      checkedAt: now,
      checks: [
        "authenticated_publisher",
        "same_origin",
        "known_bible_reference",
        "scripture_bounds_valid",
        "scripture_text_present",
        "theme_present",
        "card_intro_present",
        "seven_questions_present",
        "question_roles_attached",
        "devotional_date_valid",
        "publication_timezone_valid",
        "unique_dao_code"
      ]
    },
    review: {
      reviewerId: "",
      reviewerName: "",
      reviewedAt: null,
      decision: "PENDING",
      notes: ""
    },
    tongdao: {
      available: false
    },
    card: {
      status: "PENDING",
      url: ""
    },
    media: []
  };
}

function applyReview(existing, { action, notes, reviewer, now }) {
  const approved = action === "APPROVE";
  return {
    ...existing,
    status: approved ? "PUBLISHED" : "RETURNED",
    frozen: approved,
    publishedAt: approved ? now : null,
    review: {
      reviewerId: reviewer.id,
      reviewerName: reviewer.name || "",
      reviewedAt: now,
      decision: approved ? "APPROVED" : "RETURNED",
      notes
    },
    tongdao: {
      ...(existing.tongdao || {}),
      available: approved
    }
  };
}

function validateReviewRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "invalid_review" };
  const allowed = ["daoCode", "action", "notes"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) return { error: "unknown_field" };

  const daoCode = String(input.daoCode || "").trim().toUpperCase();
  const action = String(input.action || "").trim().toUpperCase();
  const notes = String(input.notes || "").trim().replace(/\r\n/g, "\n");

  if (!/^BD\d{8}[A-Z0-9]{3}\d{3}(?:\d{3}){0,3}$/.test(daoCode)) return { error: "invalid_dao_code" };
  if (!["APPROVE", "RETURN"].includes(action)) return { error: "invalid_review_action" };
  if (notes.length > 2000) return { error: "field_too_long" };
  if (action === "RETURN" && !notes) return { error: "return_notes_required" };

  return { value: { daoCode, action, notes } };
}

function isDaoReviewer(publisher) {
  if (!publisher || !publisher.id) return false;
  if (String(publisher.slot || "").trim().toUpperCase() === "IMS") return true;

  const allowed = new Set();
  const operator = String(process.env.STEWARDSHIP_OPERATOR_USER_ID || "").trim();
  if (operator) allowed.add(operator);

  String(process.env.BUDAO_DAO_REVIEWER_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => allowed.add(value));

  return allowed.has(publisher.id);
}

function applyDaoFilters(items, query) {
  let filtered = items;

  if (query.code) {
    const code = normalize(query.code);
    filtered = filtered.filter((item) => normalize(item.daoCode) === code);
  }

  if (query.book) {
    const book = normalize(query.book);
    filtered = filtered.filter((item) => {
      const scripture = item.scripture || {};
      return normalize(scripture.bookCode) === book || normalize(scripture.bookName) === book;
    });
  }

  if (query.chapter) {
    const chapter = Number(query.chapter);
    if (Number.isInteger(chapter) && chapter > 0) {
      filtered = filtered.filter((item) => {
        const scripture = item.scripture || {};
        const start = Number(scripture.chapterStart || 0);
        const end = Number(scripture.chapterEnd || start);
        return start <= chapter && end >= chapter;
      });
    }
  }

  if (query.q) {
    const needle = normalize(query.q);
    filtered = filtered.filter((item) => searchableText(item).includes(needle));
  }

  return filtered;
}

function getDaoAdapter() {
  if (testAdapter) return testAdapter;

  return {
    async findByCode(daoCode) {
      const db = await readyDatabase();
      const rows = await db.select().from(daoRecords).where(eq(daoRecords.daoCode, daoCode)).limit(1);
      return rows.length ? hydrateDaoRow(rows[0]) : null;
    },

    async insert(item) {
      const db = await readyDatabase();
      await db.insert(daoRecords).values(rowValues(item));
    },

    async replaceReturned(item) {
      const db = await readyDatabase();
      await db.update(daoRecords)
        .set(rowValues(item, { includeId: false }))
        .where(eq(daoRecords.daoCode, item.daoCode));
    },

    async updateReview(item) {
      const db = await readyDatabase();
      await db.update(daoRecords)
        .set({
          status: item.status,
          frozen: item.frozen,
          payload: item,
          publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
          updatedAt: new Date()
        })
        .where(eq(daoRecords.daoCode, item.daoCode));
    },

    async list() {
      const db = await readyDatabase();
      const rows = await db.select().from(daoRecords);
      return rows.map(hydrateDaoRow);
    }
  };
}

function rowValues(item, options = {}) {
  const values = {
    daoCode: item.daoCode,
    status: item.status,
    frozen: item.frozen,
    publisherId: item.publisher.id,
    publisherSlot: item.publisher.slot,
    publisherName: item.publisher.name || "",
    devotionalDate: item.devotionalDate,
    bookCode: item.scripture.bookCode,
    chapterStart: item.scripture.chapterStart,
    chapterEnd: item.scripture.chapterEnd,
    payload: item,
    submittedAt: new Date(item.submittedAt),
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
    updatedAt: new Date()
  };
  if (options.includeId !== false) values.id = item.id;
  return values;
}

async function readyDatabase() {
  const db = getDb();
  if (!daoTableReady) {
    daoTableReady = ensureDaoTable(db).catch((error) => {
      daoTableReady = undefined;
      throw error;
    });
  }
  await daoTableReady;
  return db;
}

async function ensureDaoTable(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS dao_records (
      id uuid PRIMARY KEY NOT NULL,
      dao_code text NOT NULL UNIQUE,
      status text DEFAULT 'PENDING_REVIEW' NOT NULL,
      frozen boolean DEFAULT false NOT NULL,
      publisher_id text NOT NULL,
      publisher_slot text NOT NULL,
      publisher_name text DEFAULT '' NOT NULL,
      devotional_date text NOT NULL,
      book_code text NOT NULL,
      chapter_start integer NOT NULL,
      chapter_end integer NOT NULL,
      payload jsonb NOT NULL,
      submitted_at timestamp with time zone DEFAULT now() NOT NULL,
      published_at timestamp with time zone,
      updated_at timestamp with time zone DEFAULT now() NOT NULL
    )
  `);
  await db.execute("CREATE UNIQUE INDEX IF NOT EXISTS dao_records_dao_code_uq ON dao_records (dao_code)");
  await db.execute("CREATE INDEX IF NOT EXISTS dao_records_status_idx ON dao_records (status)");
  await db.execute("CREATE INDEX IF NOT EXISTS dao_records_publisher_id_idx ON dao_records (publisher_id)");
  await db.execute("CREATE INDEX IF NOT EXISTS dao_records_scripture_idx ON dao_records (book_code, chapter_start, chapter_end)");
}

function hydrateDaoRow(row) {
  const payload = row && row.payload && typeof row.payload === "object" ? row.payload : {};
  return {
    ...payload,
    id: row.id || payload.id,
    daoCode: row.daoCode || payload.daoCode,
    status: row.status || payload.status,
    frozen: Boolean(row.frozen),
    devotionalDate: row.devotionalDate || payload.devotionalDate,
    submittedAt: dateString(row.submittedAt) || payload.submittedAt,
    publishedAt: dateString(row.publishedAt) || payload.publishedAt || null,
    publisher: {
      ...(payload.publisher || {}),
      id: row.publisherId || payload.publisher && payload.publisher.id || "",
      slot: row.publisherSlot || payload.publisher && payload.publisher.slot || "",
      name: row.publisherName || payload.publisher && payload.publisher.name || ""
    }
  };
}

function resolvePublisherProfile(publisher) {
  let configured = [];
  try {
    configured = JSON.parse(process.env.BUDAO_ADMIN_USERS_JSON || "[]");
  } catch (error) {
    configured = [];
  }

  const match = Array.isArray(configured) ? configured.find((user) => user && user.id === publisher.id) : null;
  let name = match && (match.displayName || match.name) ? String(match.displayName || match.name).trim() : "";

  if (!name) {
    try {
      const names = JSON.parse(process.env.BUDAO_PUBLISHER_NAMES_JSON || "{}");
      name = String(names[publisher.id] || names[publisher.slot] || "").trim();
    } catch (error) {
      name = "";
    }
  }

  return {
    id: publisher.id,
    slot: publisher.slot,
    name
  };
}

function sameSubmission(left, right) {
  const fields = [
    "devotionalDate", "publicationTimezone", "publicationLocale", "scripture",
    "theme", "cardIntro", "questions", "story", "highlights", "response", "prayer"
  ];

  return fields.every((field) => JSON.stringify(left[field]) === JSON.stringify(right[field]));
}

function publicSubmissionReceipt(item) {
  return {
    id: item.id,
    daoCode: item.daoCode,
    status: item.status,
    frozen: Boolean(item.frozen),
    devotionalDate: item.devotionalDate,
    submittedAt: item.submittedAt,
    publishedAt: item.publishedAt || null,
    theme: item.theme,
    scripture: item.scripture && item.scripture.referenceDisplay || "",
    reviewDecision: item.review && item.review.decision || "PENDING"
  };
}

function publicDao(item) {
  return {
    id: item.id,
    daoCode: item.daoCode,
    status: item.status,
    frozen: Boolean(item.frozen),
    devotionalDate: item.devotionalDate,
    submittedAt: item.submittedAt,
    publishedAt: item.publishedAt,
    publicationTimezone: item.publicationTimezone,
    publicationLocale: item.publicationLocale,
    publisherName: item.publisher && item.publisher.name || "",
    scripture: item.scripture,
    theme: item.theme,
    cardIntro: item.cardIntro,
    questions: item.questions,
    story: item.story,
    highlights: item.highlights,
    response: item.response,
    prayer: item.prayer,
    tags: item.tags,
    tongdao: item.tongdao,
    card: item.card,
    media: item.media
  };
}

function reviewDao(item) {
  return {
    ...publicDao(item),
    publisher: item.publisher,
    preflight: item.preflight,
    review: item.review
  };
}

function searchableText(item) {
  const scripture = item.scripture || {};
  return normalize([
    item.daoCode,
    item.theme,
    item.cardIntro,
    scripture.bookCode,
    scripture.bookName,
    scripture.referenceDisplay,
    scripture.text,
    (item.questions || []).map((question) => question.text).join(" ")
  ].join(" "));
}

function dateString(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isUniqueViolation(error) {
  return Boolean(error && (error.code === "23505" || String(error.message || "").includes("dao_records_dao_code")));
}

function setDaoAdapterForTests(adapter) {
  testAdapter = adapter || undefined;
}

module.exports = {
  handleDaoRead,
  handleDaoReview,
  handleDaoReviewRead,
  handleDaoSubmission,
  isDaoReviewer,
  setDaoAdapterForTests
};