const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "test-only-session-secret-at-least-32-bytes";

const { QUESTION_ROLES, daoCodeFor, validateDaoSubmission } = require("../api/_security/dao-schema");
const { setDaoAdapterForTests } = require("../api/_security/dao-store");
const publish = require("../api/publish-route-v2");
const read = require("../api/routes");
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

function postRequest(body, cookie = signedPublisherCookie()) {
  return {
    method: "POST",
    body,
    query: { kind: "dao" },
    headers: {
      "content-type": "application/json",
      origin: "https://budao.test",
      host: "budao.test",
      cookie,
      "x-forwarded-for": "192.0.2.42"
    }
  };
}

function getRequest(query = {}, cookie = "") {
  return {
    method: "GET",
    query: { kind: "dao", ...query },
    headers: cookie ? { cookie } : {}
  };
}

function response() {
  return {
    headers: {},
    statusCode: 0,
    body: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    end() { return this; }
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

function memoryAdapter(initialItems = []) {
  const items = initialItems.slice();
  return {
    items,
    async findByCode(code) {
      return items.find((item) => item.daoCode === code) || null;
    },
    async insert(item) {
      items.push(item);
    },
    async list() {
      return items.slice();
    }
  };
}

test.beforeEach(() => {
  resetForTests();
  setDaoAdapterForTests(undefined);
});

test.afterEach(() => setDaoAdapterForTests(undefined));

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

test("cross-chapter Dao codes include the ending verse and cannot collide", () => {
  const left = validateDaoSubmission(validBody({ scripture: "马太福音 7:13-8:1" })).value;
  const right = validateDaoSubmission(validBody({ scripture: "马太福音 7:13-8:2" })).value;
  assert.equal(daoCodeFor(left.devotionalDate, left.scripture), "BD20260907MAT007013008001");
  assert.equal(daoCodeFor(right.devotionalDate, right.scripture), "BD20260907MAT007013008002");
  assert.notEqual(daoCodeFor(left.devotionalDate, left.scripture), daoCodeFor(right.devotionalDate, right.scripture));
});

test("unknown books, impossible chapters, and bad one-chapter verses are rejected", () => {
  assert.equal(validateDaoSubmission(validBody({ scripture: "未知书卷 1:1" })).error, "invalid_scripture_reference");
  assert.equal(validateDaoSubmission(validBody({ scripture: "马太福音 29:1" })).error, "invalid_scripture_reference");
  assert.equal(validateDaoSubmission(validBody({ scripture: "犹大书 1:26" })).error, "invalid_scripture_reference");
});

test("all seven questions are required and oversized text is rejected rather than truncated", () => {
  assert.equal(validateDaoSubmission(validBody({ questions: ["only one"] })).error, "seven_questions_required");
  assert.equal(validateDaoSubmission(validBody({ cardIntro: "x".repeat(801) })).error, "field_too_long");
});

test("anonymous Dao submissions are rejected through the shared publish endpoint", async () => {
  const res = response();
  await publish(postRequest(validBody(), ""), res);
  assert.equal(res.statusCode, 401);
});

test("valid Dao submission enters the private pool as PENDING_REVIEW and is idempotent", async () => {
  const store = memoryAdapter();
  setDaoAdapterForTests(store);

  const first = response();
  await publish(postRequest(validBody()), first);
  assert.equal(first.statusCode, 200);
  assert.equal(first.body.dao.status, "PENDING_REVIEW");
  assert.equal(store.items.length, 1);
  assert.equal(store.items[0].frozen, false);
  assert.equal(store.items[0].tongdao.available, false);
  assert.equal(store.items[0].questions[6].role, "GOSPEL_RESPONSE");

  const second = response();
  await publish(postRequest(validBody()), second);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(store.items.length, 1);
});

test("same Dao code cannot silently overwrite different content", async () => {
  const store = memoryAdapter();
  setDaoAdapterForTests(store);

  const first = response();
  await publish(postRequest(validBody()), first);
  assert.equal(first.statusCode, 200);

  const changed = response();
  await publish(postRequest(validBody({ theme: "另一个主题" })), changed);
  assert.equal(changed.statusCode, 409);
  assert.equal(changed.body.reason, "duplicate_dao_code");
  assert.equal(store.items.length, 1);
});

test("public Dao reads hide pending items, while the owner can inspect their own pending pool", async () => {
  const pending = {
    id: "dao-test",
    daoCode: "BD20260907MAT007013014",
    status: "PENDING_REVIEW",
    frozen: false,
    publisher: { id: "publisher-ims", slot: "IMS", name: "Tony" },
    scripture: { bookCode: "MAT", bookName: "马太福音", chapterStart: 7, chapterEnd: 7, referenceDisplay: "马太福音 7:13-14", text: "text" },
    theme: "窄门",
    cardIntro: "intro",
    questions: [],
    story: "",
    highlights: "",
    response: "",
    prayer: "",
    tags: { themes: [], seasons: [], terrains: [] },
    tongdao: { available: false },
    card: { status: "PENDING", url: "" },
    media: []
  };
  setDaoAdapterForTests(memoryAdapter([pending]));

  let res = response();
  await read(getRequest(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 0);

  res = response();
  await read(getRequest({ mine: "1" }, signedPublisherCookie()), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.items[0].daoCode, pending.daoCode);
});
