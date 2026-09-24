const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

process.env.NODE_ENV = "test";
process.env.BUDAO_SESSION_SECRET = "test-only-session-secret-at-least-32-bytes";

const { setOwnerDaoAdapterForTests } = require("../api/_security/dao-owner-read");
const routes = require("../api/routes");

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

function request(cookie = signedPublisherCookie()) {
  return {
    method: "GET",
    query: { kind: "dao-mine" },
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

function returnedRow(overrides = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    daoCode: "BD20260907MAT007013014",
    status: "RETURNED",
    frozen: false,
    publisherId: "publisher-ims",
    publisherSlot: "IMS",
    publisherName: "Tony",
    devotionalDate: "2026-09-07",
    submittedAt: new Date("2026-09-07T10:00:00Z"),
    publishedAt: null,
    payload: {
      id: "11111111-1111-4111-8111-111111111111",
      daoCode: "BD20260907MAT007013014",
      status: "RETURNED",
      frozen: false,
      devotionalDate: "2026-09-07",
      submittedAt: "2026-09-07T10:00:00Z",
      publicationTimezone: "Asia/Shanghai",
      publicationLocale: "zh-CN",
      scripture: {
        bookCode: "MAT",
        bookName: "马太福音",
        chapterStart: 7,
        verseStart: 13,
        chapterEnd: 7,
        verseEnd: 14,
        referenceDisplay: "马太福音 7:13-14",
        text: "你们要进窄门。",
        translation: "和合本"
      },
      theme: "窄门",
      cardIntro: "有些路不是因为容易，才值得走。",
      questions: Array.from({ length: 7 }, (_, index) => ({ order: index + 1, role: "ROLE_" + (index + 1), text: "问题" + (index + 1) })),
      story: "故事",
      highlights: "高光",
      response: "回应",
      prayer: "祷告",
      review: {
        reviewerId: "publisher-reviewer",
        reviewerName: "Reviewer Secret Name",
        reviewedAt: "2026-09-07T11:00:00Z",
        decision: "RETURNED",
        notes: "请调整第四问。"
      },
      tongdao: { available: false },
      card: { status: "PENDING", url: "" }
    },
    ...overrides
  };
}

test.beforeEach(() => setOwnerDaoAdapterForTests(undefined));
test.afterEach(() => setOwnerDaoAdapterForTests(undefined));

test("My Dao library requires an authenticated publisher", async () => {
  setOwnerDaoAdapterForTests({ async listByPublisher() { return []; } });
  const res = response();
  await routes(request(""), res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.reason, "unauthorized");
});

test("My Dao library returns only rows belonging to the signed-in publisher", async () => {
  const rows = [
    returnedRow(),
    returnedRow({
      id: "22222222-2222-4222-8222-222222222222",
      daoCode: "BD20260908PSA121001008",
      publisherId: "publisher-bacbc",
      publisherSlot: "BACBC",
      payload: { ...returnedRow().payload, daoCode: "BD20260908PSA121001008" }
    })
  ];

  setOwnerDaoAdapterForTests({
    async listByPublisher(publisherId) {
      return rows.filter((row) => row.publisherId === publisherId);
    }
  });

  const res = response();
  await routes(request(), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.count, 1);
  assert.equal(res.body.items[0].daoCode, "BD20260907MAT007013014");
});

test("returned owner record includes safe review notes and full editable content without reviewer identity", async () => {
  setOwnerDaoAdapterForTests({ async listByPublisher() { return [returnedRow()]; } });
  const res = response();
  await routes(request(), res);
  const item = res.body.items[0];

  assert.equal(item.status, "RETURNED");
  assert.equal(item.review.decision, "RETURNED");
  assert.equal(item.review.notes, "请调整第四问。");
  assert.equal(item.review.reviewedAt, "2026-09-07T11:00:00Z");
  assert.equal(item.review.reviewerId, undefined);
  assert.equal(item.review.reviewerName, undefined);
  assert.equal(item.scripture.referenceDisplay, "马太福音 7:13-14");
  assert.equal(item.questions.length, 7);
  assert.equal(item.prayer, "祷告");
});

test("Tent My Dao client uses the private owner route and returned edit flow", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "tent-word.js"), "utf8");
  assert.match(source, /kind=dao-mine/);
  assert.match(source, /beginReturnedRevision/);
  assert.match(source, /灵修日期与经文出处已锁定/);
  assert.match(source, /继续修改/);
  assert.doesNotMatch(source, /reviewerId/);
});
