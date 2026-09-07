const owner = process.env.GITHUB_OWNER || "Tonykao1";
const repo = process.env.GITHUB_REPO || "budao.org";
const branch = process.env.GITHUB_DAO_BRANCH || process.env.GITHUB_PUBLISH_BRANCH || process.env.GITHUB_BRANCH || "main";
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
const daoPath = "data/dao.json";

const { getAuthenticatedPublisher } = require("./_security/auth");
const { sendJson } = require("./_security/http");

module.exports = async function handler(request, response) {
  if (request.method !== "GET") return sendJson(response, 405, { ok: false, reason: "method_not_allowed" });

  try {
    const data = await readDaoFile();
    const publisher = getAuthenticatedPublisher(request);
    const query = request.query || {};
    const includeMine = String(query.mine || "") === "1" && publisher;

    let items = data.items.filter((item) => item && (
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
    return sendJson(response, error.status || 500, { ok: false, reason: error.reason || "network_failed" });
  }
};

async function readDaoFile() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "budao-dao-reader",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (token) headers.Authorization = "Bearer " + token;

  const result = await fetch(contentsUrl(), { headers });
  if (result.status === 404) return { schemaVersion: 1, items: [] };
  if (!result.ok) throw knownError("network_failed", result.status);

  const file = await result.json();
  try {
    const data = JSON.parse(Buffer.from(file.content || "", "base64").toString("utf8") || "{}");
    if (!data || !Array.isArray(data.items)) throw new Error("invalid_dao_pool");
    return data;
  } catch (error) {
    throw knownError("json_conflict", 409);
  }
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

function normalize(value) {
  return String(value || "").trim().toLowerCase();
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
