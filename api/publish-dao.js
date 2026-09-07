const crypto = require("node:crypto");

const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_DAO_BRANCH || process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const daoPath = "data/dao.json";

const { getAuthenticatedPublisher } = require("./_security/auth");
const { requireJsonPost, requireSameOrigin, sendJson } = require("./_security/http");
const { clientIp, consume } = require("./_security/rate-limit");
const { daoCodeFor, validateDaoSubmission } = require("./_security/dao-schema");

module.exports = async function handler(request, response) {
  const parsed = requireJsonPost(request, 64 * 1024);
  if (parsed.error) return sendJson(response, parsed.status, { ok: false, reason: parsed.error });
  if (!requireSameOrigin(request)) return sendJson(response, 403, { ok: false, reason: "forbidden" });

  const publisher = getAuthenticatedPublisher(request);
  if (!publisher) return sendJson(response, 401, { ok: false, reason: "unauthorized" });
  if (!consume("dao-publish:" + publisher.id + ":" + clientIp(request), 8, 60_000)) {
    return sendJson(response, 429, { ok: false, reason: "rate_limited" });
  }
  if (!token) return sendJson(response, 503, { ok: false, reason: "publishing_unavailable" });

  const validated = validateDaoSubmission(parsed.body);
  if (validated.error) return sendJson(response, 400, { ok: false, reason: validated.error });

  try {
    const current = await readDaoFile();
    const now = new Date().toISOString();
    const value = validated.value;
    const daoCode = daoCodeFor(value.devotionalDate, value.scripture);
    const publisherProfile = resolvePublisherProfile(publisher);
    const existing = current.data.items.find((item) => item && item.daoCode === daoCode);

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
          dao: publicSubmissionReceipt(existing),
          commit: null
        });
      }

      return sendJson(response, 409, { ok: false, reason: "duplicate_dao_code" });
    }

    const next = {
      schemaVersion: 1,
      items: [candidate].concat(current.data.items)
    };
    const commit = await writeDaoFile({
      content: JSON.stringify(next, null, 2) + "\n",
      message: "Submit Dao: " + daoCode,
      sha: current.sha
    });

    return sendJson(response, 200, {
      ok: true,
      idempotent: false,
      dao: publicSubmissionReceipt(candidate),
      commit: commit.commit && commit.commit.sha ? commit.commit.sha : null
    });
  } catch (error) {
    if (error.reason) return sendJson(response, error.status || 500, { ok: false, reason: error.reason });
    return sendJson(response, 500, { ok: false, reason: "network_failed" });
  }
};

async function readDaoFile() {
  const result = await githubFetch(contentsUrl(), { method: "GET" });

  if (result.status === 404) {
    return { data: { schemaVersion: 1, items: [] }, sha: null };
  }
  if (result.status === 401 || result.status === 403) throw knownError("token_invalid", 401);
  if (!result.ok) throw knownError("network_failed", result.status);

  const file = await result.json();
  const text = Buffer.from(file.content || "", "base64").toString("utf8");

  try {
    const data = JSON.parse(text || "{}");
    if (!data || !Array.isArray(data.items)) throw new Error("dao_items_not_array");
    return { data, sha: file.sha };
  } catch (error) {
    throw knownError("json_conflict", 409);
  }
}

async function writeDaoFile({ content, message, sha }) {
  const body = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch
  };
  if (sha) body.sha = sha;

  const result = await githubFetch(contentsUrl(), {
    method: "PUT",
    body: JSON.stringify(body)
  });

  if (result.status === 401 || result.status === 403) throw knownError("token_invalid", 401);
  if (result.status === 409 || result.status === 422) throw knownError("commit_conflict", 409);
  if (!result.ok) throw knownError("network_failed", result.status);
  return result.json();
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

function githubFetch(url, options) {
  return fetch(url, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "User-Agent": "budao-dao-publisher",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
}

function contentsUrl() {
  return "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + daoPath + "?ref=" + branch;
}

function knownError(reason, status) {
  const error = new Error(reason);
  error.reason = reason;
  error.status = status;
  return error;
}
