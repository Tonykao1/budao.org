const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const home = fs.readFileSync(path.join(root, "home.html"), "utf8");
const prayerBox = require("../prayer-box");

test("homepage keeps its existing sentence while prayer becomes an accessible trigger", () => {
  const section = home.match(/<h2 class="title-adjust">“步道”有什么？<\/h2>\s*<p>([\s\S]*?)<\/p>/)?.[1] || "";
  const visibleText = section.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  assert.equal(visibleText, "· 一个拥抱 · 一条线路 · 一则故事 · 一段经文 · 一起祷告 ·");
  assert.match(section, /<button[^>]+id="prayerBoxTrigger"[^>]+type="button"[^>]+aria-controls="prayerBox"/);
  assert.match(home, /<link rel="stylesheet" href="prayer-box\.css">/);
  assert.match(home, /<script src="prayer-box\.js"><\/script>/);
});

test("submission payload defaults to leaders only and omits contact without reply consent", () => {
  assert.deepEqual(prayerBox.buildPrayerPayload({
    body: " 请陪我记念 ",
    visibility: "",
    wantsReply: false,
    contact: "must-not-leave-browser@example.test",
    website: ""
  }, "1234567890abcdef"), {
    body: "请陪我记念",
    visibility: "LEADERS_ONLY",
    wantsReply: false,
    contact: "",
    website: "",
    idempotencyKey: "1234567890abcdef"
  });
});

test("trusted-team and reply permissions require explicit choices", () => {
  assert.deepEqual(prayerBox.buildPrayerPayload({
    body: "愿有人同行",
    visibility: "TRUSTED_TEAM",
    wantsReply: true,
    contact: "quiet@example.test"
  }, "abcdef1234567890"), {
    body: "愿有人同行",
    visibility: "TRUSTED_TEAM",
    wantsReply: true,
    contact: "quiet@example.test",
    website: "",
    idempotencyKey: "abcdef1234567890"
  });
});

test("submit controller prevents rapid duplicates and exposes the quiet success state", async () => {
  let resolveRequest;
  let calls = 0;
  const states = [];
  const controller = prayerBox.createSubmitController({
    fetchImpl: async () => {
      calls += 1;
      return new Promise((resolve) => { resolveRequest = resolve; });
    },
    setBusy: (busy) => states.push(["busy", busy]),
    showError: (message) => states.push(["error", message]),
    showSuccess: () => states.push(["success"])
  });

  const first = controller.submit({ body: "请记念" }, "1234567890abcdef");
  const second = await controller.submit({ body: "请记念" }, "1234567890abcdef");
  assert.deepEqual(second, { ignored: true });
  assert.equal(calls, 1);

  resolveRequest({ ok: true, json: async () => ({ ok: true, receipt: "quiet" }) });
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(states, [["busy", true], ["success"], ["busy", false]]);
});

test("failed submission preserves caller values and reports a gentle retry message", async () => {
  const values = { body: "不要清空这段话", visibility: "LEADERS_ONLY", wantsReply: false };
  const states = [];
  const controller = prayerBox.createSubmitController({
    fetchImpl: async () => ({ ok: false, json: async () => ({ ok: false }) }),
    setBusy: (busy) => states.push(["busy", busy]),
    showError: (message) => states.push(["error", message]),
    showSuccess: () => states.push(["success"])
  });

  assert.deepEqual(await controller.submit(values, "1234567890abcdef"), { ok: false });
  assert.equal(values.body, "不要清空这段话");
  assert.deepEqual(states, [
    ["busy", true],
    ["error", "暂时没有送达，请稍后再试。"],
    ["busy", false]
  ]);
});

test("homepage includes the approved restrained completion copy", () => {
  assert.match(home, /已经收到了。/);
  assert.match(home, /会有一位步道带领人安静地承接这份祷告。愿你在前面的路上，得着平安与同行。/);
  assert.doesNotMatch(home, /分享到|公开见证|庆祝/);
});
