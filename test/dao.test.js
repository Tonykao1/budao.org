const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "test-only-session-secret-at-least-32-bytes";
process.env.GITHUB_TOKEN = "test-token-never-logged";
process.env.GITHUB_DAO_BRANCH = "main";

const { QUESTION_ROLES, daoCodeFor, validateDaoSubmission } = require("../api/_security/dao-schema");
const publishDao = require("../api/publish-dao");
const { resetForTests } = require("../api/_security/rate-limit");

function signedPublisherCookie(sub = "publisher-ims", slot = "IMS") {
  const payload = Buffer.from(JSON.stringify({
    iss: "budao.org",
    aud: "budao-admin",
    sub,
    role: "publisher",
    slot,
    exp: Math.floor(Date.now() / 1000) + 600
  })).toString("base64url");
  const signature = crypto.createHmac("sha256", process.env.BUDAO_SESSION_SECRET).update(payload).digest("base64url");
  return "budao_admin_session=" + payload + "." + signature;
}

function request(body, cookie = signedPublisherCookie()) {
  return {
    method: "POST",
    body,
    headers: {
      "content-type": "application/json",
      origin: "https://budao.test",
      host: "budao.test",
      cookie,
      "x-forwarded-for": "192.0.2.42"
    }
  };
}

function response() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function validBody(overrides = {}) {
  return {
    devotionalDate: "2026-09-07",
    scripture: "马太福音 7:13-14",
    scriptureText: "你们要进窄门。",
    translation: "和合本",
    theme: "窄门",
    cardIntro: "有些路不是因为容易，才值得走。",
    questions: [
      "最近哪条路让你印象最深？",
      "你通常怎样选择一条路？",
      "你曾和陌生人因为一次同行而熟悉起来吗？",
      "你生命里有没有明知不容易却仍想选择的事？",
      "如果一条正确的路比另一条更窄，你会怎样判断？",
      "这段经文今天在哪里挑战你原来的选择？",
      "因着基督已经为你成就的救恩，你今天愿意怎样回应？"
    ],
    story: "",
    highlights: "",
    response: "",
    prayer: "",
    publicationTimezone: "Asia/Shanghai",
    publicationLocale: "zh-CN",
    ...overrides
  };
}

test.beforeEach(() => resetForTests());

test("Dao validator attaches the seven constitutional question roles", () => {
  const result = validateDaoSubmission(validBody());
  assert.ok(result.value);
  assert.deepEqual(result.value.questions.map((question) => question.role), QUESTION_ROLES);
  assert.equal(result.value.scripture.bookCode, "MAT");
  assert.equal(result.value.scripture.chapterStart, 7);
  assert.equal(result.value.scripture.verseStart, 13);
  assert.equal(result.value.scripture.verseEnd, 14);
});

test("Dao code contains BD, devotional date and scripture identity without dots", () => {
  const result = validateDaoSubmission(validBody());
  const code = daoCodeFor(result.value.devotionalDate, result.value.scripture);
  assert.equal(code, "BD20260907MAT007013014");
  assert.equal(code.includes("."), false);
});

test("all seven questions and a known scripture reference are required", () => {
  let result = validateDaoSubmission(validBody({ questions: ["only one"] }));
  assert.equal(result.error, "seven_questions_required");
  result = validateDaoSubmission(validBody({ scripture: "未知书卷 1:1" }));
  assert.equal(result.error, "invalid_scripture_reference");
});

test("anonymous Dao submissions are rejected", async () => {
  const res = response();
  await publishDao(request(validBody(), ""), res);
  assert.equal(res.statusCode, 401);
});

test("valid Dao submission enters the pool as PENDING_REVIEW and is idempotent", async () => {
  let stored = { schemaVersion: 1, items: [] };
  let putCount = 0;

  global.fetch = async (_url, options) => {
    if (!options || options.method === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ sha: "abc", content: Buffer.from(JSON.stringify(stored)).toString("base64") })
      };
    }

    putCount += 1;
    const body = JSON.parse(options.body);
    stored = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
    return { ok: true, status: 200, json: async () => ({ commit: { sha: "def" } }) };
  };

  const first = response();
  await publishDao(request(validBody()), first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.dao.status, "PENDING_REVIEW");
  assert.equal(stored.items.length, 1);
  assert.equal(stored.items[0].frozen, false);
  assert.equal(stored.items[0].tongdao.available, false);
  assert.equal(stored.items[0].questions[6].role, "GOSPEL_RESPONSE");

  const second = response();
  await publishDao(request(validBody()), second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(putCount, 1);
});

test("same Dao code cannot silently overwrite different content", async () => {
  let stored = { schemaVersion: 1, items: [] };

  global.fetch = async (_url, options) => {
    if (!options || options.method === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ sha: "abc", content: Buffer.from(JSON.stringify(stored)).toString("base64") })
      };
    }

    const body = JSON.parse(options.body);
    stored = JSON.parse(Buffer.from(body.content, "base64").toString("utf8"));
    return { ok: true, status: 200, json: async () => ({ commit: { sha: "def" } }) };
  };

  const first = response();
  await publishDao(request(validBody()), first);
  assert.equal(first.statusCode, 200);

  const changed = response();
  await publishDao(request(validBody({ theme: "另一个主题" })), changed);
  assert.equal(changed.statusCode, 409);
  assert.equal(changed.body.reason, "duplicate_dao_code");
  assert.equal(stored.items.length, 1);
});
