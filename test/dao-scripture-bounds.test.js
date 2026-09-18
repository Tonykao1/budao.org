const assert = require("node:assert/strict");
const test = require("node:test");

const { VERSE_COUNTS, verseCountFor } = require("../api/_security/bible-verse-counts");
const { BOOK_CHAPTER_COUNTS, validateDaoSubmission } = require("../api/_security/dao-schema");

function validBody(scripture) {
  return {
    devotionalDate: "2026-09-07",
    scripture,
    scriptureText: "测试经文正文。",
    translation: "和合本",
    theme: "测试",
    cardIntro: "测试引言。",
    questions: ["一", "二", "三", "四", "五", "六", "七"],
    story: "",
    highlights: "",
    response: "",
    prayer: "",
    publicationTimezone: "Asia/Shanghai",
    publicationLocale: "zh-CN"
  };
}

test("verse-count table covers all 66 books and agrees with chapter counts", () => {
  assert.equal(Object.keys(VERSE_COUNTS).length, 66);
  Object.entries(BOOK_CHAPTER_COUNTS).forEach(([bookCode, chapterCount]) => {
    assert.ok(Array.isArray(VERSE_COUNTS[bookCode]), bookCode + " is missing verse counts");
    assert.equal(VERSE_COUNTS[bookCode].length, chapterCount, bookCode + " chapter count mismatch");
  });
});

test("ordinary chapter verse overflow is rejected exactly", () => {
  assert.ok(validateDaoSubmission(validBody("马太福音 7:29")).value);
  assert.equal(validateDaoSubmission(validBody("马太福音 7:30")).error, "invalid_scripture_reference");
  assert.equal(verseCountFor("MAT", 7), 29);
});

test("cross-chapter ranges validate the ending chapter verse exactly", () => {
  assert.ok(validateDaoSubmission(validBody("马太福音 7:29-8:34")).value);
  assert.equal(validateDaoSubmission(validBody("马太福音 7:29-8:35")).error, "invalid_scripture_reference");
});

test("Psalm 119 preserves the Bible-wide maximum of 176 verses", () => {
  assert.ok(validateDaoSubmission(validBody("诗篇 119:176")).value);
  assert.equal(validateDaoSubmission(validBody("诗篇 119:177")).error, "invalid_scripture_reference");
});

test("Chinese Union Version convention accepts 3 John 1:15", () => {
  assert.equal(verseCountFor("3JN", 1), 15);
  assert.ok(validateDaoSubmission(validBody("约翰三书 1:15")).value);
  assert.equal(validateDaoSubmission(validBody("约翰三书 1:16")).error, "invalid_scripture_reference");
});
