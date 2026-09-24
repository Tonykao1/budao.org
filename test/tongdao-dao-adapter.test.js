const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const adapter = require("../tongdao-dao-adapter");

function dao(overrides = {}) {
  return {
    id: "dao-test",
    daoCode: "BD20260907MAT007013014",
    status: "PUBLISHED",
    frozen: true,
    devotionalDate: "2026-09-07",
    publishedAt: "2026-09-07T10:00:00.000Z",
    publisherName: "Tony",
    theme: "窄门",
    cardIntro: "有些路不是因为容易，才值得走。",
    scripture: {
      referenceDisplay: "马太福音 7:13-14",
      text: "你们要进窄门。",
      translation: "和合本"
    },
    questions: adapter.QUESTION_ROLES.map((role, index) => ({
      order: index + 1,
      role,
      text: "问题" + (index + 1)
    })),
    story: "一个人在路口停下，重新看见自己正在选择的路。",
    highlights: "不要把容易误认为正确。",
    response: "这一周，在一个具体选择上走窄路。",
    prayer: "主啊，求你使我不偏左右。",
    tongdao: { available: true },
    ...overrides
  };
}

test("only published, frozen, Tongdao-available Dao with the seven constitutional roles is eligible", () => {
  assert.equal(adapter.isEligibleDao(dao()), true);
  assert.equal(adapter.isEligibleDao(dao({ status: "PENDING_REVIEW" })), false);
  assert.equal(adapter.isEligibleDao(dao({ frozen: false })), false);
  assert.equal(adapter.isEligibleDao(dao({ tongdao: { available: false } })), false);
  assert.equal(adapter.isEligibleDao(dao({ story: "" })), false);

  const wrongRoles = dao();
  wrongRoles.questions = wrongRoles.questions.slice();
  wrongRoles.questions[4] = { order: 5, role: "CONFRONTATION", text: "错位" };
  assert.equal(adapter.isEligibleDao(wrongRoles), false);
});

test("adapter maps Q1-Q7 exactly onto the existing Tongdao topic slots", () => {
  const pack = adapter.toTongdaoPack(dao());
  assert.ok(pack);
  adapter.QUESTION_ROLES.forEach((role, index) => {
    assert.equal(pack.topics["topic" + (index + 1)], "问题" + (index + 1));
    assert.equal(pack.questionRoles[index], role);
  });
  assert.equal(pack.storyText.includes("路口"), true);
  assert.equal(pack.scriptureReference, "马太福音 7:13-14");
  assert.equal(pack.scriptureTranslation, "和合本");
  assert.equal(pack.growthChallenge, "这一周，在一个具体选择上走窄路。");
  assert.equal(pack.prayer, "主啊，求你使我不偏左右。");
});

test("API adapter drops every item that has not crossed the frozen review boundary", () => {
  const packs = adapter.fromApiPayload({
    items: [
      dao(),
      dao({ daoCode: "BD2", frozen: false }),
      dao({ daoCode: "BD3", status: "RETURNED" }),
      dao({ daoCode: "BD4", tongdao: { available: false } })
    ]
  });
  assert.equal(packs.length, 1);
  assert.equal(packs[0].daoCode, "BD20260907MAT007013014");
});

test("Tongdao chooser preserves delayed scripture disclosure and never falls back to legacy packs", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "tongdao-dao-bridge.js"), "utf8");
  const chooser = source.slice(source.indexOf("function renderDaoChooser"), source.indexOf("function chooseDaoPack"));

  assert.ok(source.includes('/api/routes?kind=dao'));
  assert.ok(source.includes("经文会在故事之后才被揭示"));
  assert.equal(chooser.includes("scriptureReference"), false);
  assert.equal(chooser.includes("daoCode"), false);
  assert.equal(source.includes("tongdaoPacks"), false);
  assert.ok(source.includes("不会自动退回到未经查验的旧内容"));
});
