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

    const candidate = {
      id: crypto.randomUUID(),
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

    if (existing) {
      if (sameSubmission(existing, candidate) && existing.publisher && existing.publisher.id === publisher.id) {
        return sendJson(response, 200, {
          ok: true,
          idempotent: true,
          dao: publicSubmissionReceipt(existing)
        });
      }

      return sendJson(response, 409, { ok: false, reason: "duplicate_dao_code" });
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

    if (query.code) {
      const code = normalize(query.code);
      items = items.filter((item) => normalize(item.daoCode) === code);
    }

    if (query.book) {
      const book = normalize(query.book);
      items = items.filter((item) => {
        const scripture = item.scripture || {};
        return normalize(scripture.bookCode) === book || normalize(scripture.bookName) === book;
      });
    }

    if (query.chapter) {
      const chapter = Number(query.chapter);
      if (Number.isInteger(chapter) && chapter > 0) {
        items = items.filter((item) => {
          const scripture = item.scripture || {};
          const start = Number(scripture.chapterStart || 0);
          const end = Number(scripture.chapterEnd || start);
          return start <= chapter && end >= chapter;
        });
      }
    }

    if (query.q) {
      const needle = normalize(query.q);
      items = items.filter((item) => searchableText(item).includes(needle));
    }

    return sendJson(response, 200, {
      ok: true,
      count: items.length,
      items: items.map(publicDao)
    });
  } catch (error) {
    return sendJson(response, 503, { ok: false, reason: "dao_storage_unavailable" });
  }
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
      await db.insert(daoRecords).values({
        id: item.id,
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
        publishedAt: null,
        updatedAt: new Date(item.submittedAt)
      });
    },

    async list() {
      const db = await readyDatabase();
      const rows = await db.select().from(daoRecords);
      return rows.map(hydrateDaoRow);
    }
  };
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
    devotionalDate: item.devotionalDate,
    submittedAt: item.submittedAt,
    theme: item.theme,
    scripture: item.scripture && item.scripture.referenceDisplay || ""
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
  handleDaoSubmission,
  setDaoAdapterForTests
};
