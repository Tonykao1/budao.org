# 《我的牧草》一体化读经 Journey Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把“选择经文 → 完成阅读 → 单独录音 → 链接”的旧流程重构为“点击第一节即开始录音 → 逐节连续推进 → 结束确认 → 自动封存真实阅读范围与经节时间线”的一体化 Reading Journey。

**Architecture:** 新的 `readingJourney` 成为新档案的权威读经对象，连续音频元数据与经节时间线都属于它；`my-grass-v1.js` 作为录音/计时/持久化协调器，`my-grass-reading-v1.js` 只负责经文交互与左页呈现，两者通过明确的 `CustomEvent` 意图/状态接口通信。旧 schema v1 档案继续可读，但不伪造逐节时间点；新 Journey 使用真实时间节点回听，不再用文字长度估算。

**Tech Stack:** Vanilla JavaScript、DOM CustomEvent、MediaRecorder、IndexedDB、Node `node:test`、现有 Vercel Preview 构建链。

**Spec:** `docs/superpowers/specs/2026-10-17-my-grass-integrated-reading-journey-design.md`

## Global Constraints

- 浏览 ≠ 读过；选中 ≠ 读过。
- 点击第一节经文后才请求麦克风并开始 Journey；麦克风未真正开始时不得显示“已在录音”。
- 正常读经只允许同章、连续下一节推进；不能跳节后自动补齐中间经节。
- 音频与经节时间线从 Journey 出生时就是同一个对象，不再有 `🔗 链接录音`。
- 用户点击“结束今日读经”后先出现古卷内「继续读 / 结束」确认；确认期间录音不中断。
- 淡草痕彻底移除；使用页边读痕 + 节号状态 + 当前节指针，不依赖单一字体字重。
- 左页原“完成本次阅读”区域改成持续状态区；不新增古卷中央悬浮控制条。
- 右页复古录音设备保留为 REC/波形/计时的设备反馈，不再是独立开始/链接入口。
- 新 Journey 回听只使用真实 verse timestamps；不使用文字长度估算。
- 不引入语音识别、逐字评分、跳读模式、跨章节 Journey、云端音频上传。
- 不声称系统验证了用户逐字朗读正确性。
- Production 不合并、不部署；只更新现有 feature branch / Draft PR / Preview。

## Review Focus

1. **首次麦克风授权慢或被拒绝**：第一节只能进入“正在开启麦克风”，不能提前算作已读；授权失败后可重新点击开始。
2. **快速连续点击经节**：录音协调器必须串行处理 intent，不能产生重复/倒序/零碎的 segment。
3. **录音中误触导航/档案/换译本**：必须阻止静默离开；不得继续产生“已读”记录。
4. **MediaRecorder/IndexedDB 中途失败**：REC 视觉立即退出或进入 finalizing/error；不得静默把后续经节记为已读，已取得的 blob/timeline 尽可能保留以便重试或结束可恢复部分。
5. **旧档案兼容**：旧 `readingSession + reading.audioId` 仍能打开/播放，但没有真实时间线时不伪造逐节跟随。

---

### Task 1: 建立 Reading Journey 纯数据模型与 schema v2

**Files:**
- Modify: `pasture-preview/my-grass-core.js`
- Create: `test/my-grass-reading-journey.test.js`

**Interfaces:**
- Produces: `normalizeReadingJourney(value)`
- Produces: `startReadingJourney(point, startedAt)`
- Produces: `advanceReadingJourney(journey, point, elapsedMs)`
- Produces: `completeReadingJourney(journey, elapsedMs, completedAt, audioMeta)`
- Produces: `journeyVerseAt(journey, elapsedMs)`
- Produces: `setRuntimeReadingJourney(value)` / `getRuntimeReadingJourney()` / `setReadingJourneyRequired(value)`
- New persisted entry: `version: 2`, canonical `readingJourney`; legacy v1 input remains readable.

- [ ] **Step 1: Write failing tests for the Journey state machine**

Test names/assertions must cover:
- start at arbitrary verse creates exactly one open segment with `startMs:0` and no completed range yet;
- advancing from 1→2 closes verse 1 at the supplied elapsed ms and opens verse 2 at the same ms;
- 3→8 throws and does not fabricate verses 4–7;
- same verse click is idempotent/no advance;
- cross-chapter advance throws;
- completion closes the final segment, derives actual `reference`, `verseIds`, `durationMs`, and requires audio metadata;
- `journeyVerseAt` resolves exact segment boundaries;
- invalid/non-monotonic timestamps throw;
- legacy entries remain normalizable through existing v1 path.

- [ ] **Step 2: Run the Journey test and verify RED**

Run: `node --test test/my-grass-reading-journey.test.js`
Expected: FAIL because Journey APIs/schema v2 do not exist.

- [ ] **Step 3: Implement the minimal Journey model in `my-grass-core.js`**

Use stable verse IDs and an explicit segment shape:
`{verse, verseId, startMs, endMs}`.
The Journey owns `audio:{audioId,mimeType,size,durationSeconds}` only after successful completion.
Do not add speech-content verification.

- [ ] **Step 4: Make `newEntry` / `reviseEntry` prefer completed `readingJourney` for schema v2 while preserving legacy v1 reads**

Also fix the known preservation hazard: revising a saved v2 entry must keep its saved `readingJourney` unless a replacement Journey is explicitly supplied.

- [ ] **Step 5: Run tests GREEN**

Run: `node --test test/my-grass-reading-journey.test.js test/my-grass-reading-session.test.js`
Expected: all pass.

- [ ] **Step 6: Commit**

Commit: `feat(my-grass): add integrated reading journey model`

---

### Task 2: 把录音器改成 Journey 协调器

**Files:**
- Modify: `pasture-preview/my-grass-v1.js`
- Modify: `test/my-grass-recording-v13.test.js`
- Create: `test/my-grass-journey-recorder.test.js`

**Interfaces:**
- Consumes core Journey APIs from Task 1.
- Consumes intent events:
  - `mygrass:journey-start-request` detail `{point}`
  - `mygrass:journey-advance-request` detail `{point}`
  - `mygrass:journey-end-request`
- Produces state events:
  - `mygrass:journey-state` detail `{phase, journey, elapsedMs, error?}` where phase is `idle|arming|recording|finalizing|completed|error`
  - `mygrass:journey-tick` detail `{elapsedMs,currentVerse}` approximately every 250ms while recording.

- [ ] **Step 1: Rewrite recorder contract tests first**

Tests must prove:
- there is no independent “开始录音” prerequisite and no link requirement for new Journey;
- `start-request` enters `arming`, requests mic, and only on recorder `start` establishes elapsed zero + recording state;
- advance intents never stop/restart MediaRecorder;
- elapsed time uses one monotonic clock for all verse boundaries;
- duplicate/invalid advance intents do not mutate Journey;
- end request freezes the final elapsed boundary before `MediaRecorder.stop()`;
- audio blob is written to IndexedDB before Journey becomes `completed`;
- audio-save failure cannot emit a false completed Journey.

- [ ] **Step 2: Run recorder tests and verify RED**

Run: `node --test test/my-grass-journey-recorder.test.js test/my-grass-recording-v13.test.js`
Expected: FAIL on old record/link workflow assumptions.

- [ ] **Step 3: Replace `startOrStopRecording()` / `linkRecording()` orchestration with Journey intent handlers**

Keep the existing local IndexedDB storage and MIME selection policy. Use `performance.now()` (or injected monotonic equivalent in tests) for elapsed ms and ISO wall-clock separately for `startedAt/completedAt`.

- [ ] **Step 4: Remove new-flow dependence on `scripture.verifiedAgainstRecording`**

Legacy values may remain readable, but new Journey save/playback must not require a manual link flag.

- [ ] **Step 5: Add the 250ms tick lifecycle and hard cleanup**

Timer exists only in `recording`; clear it on finalizing/completed/error/close/new page.

- [ ] **Step 6: Run GREEN**

Run: `node --test test/my-grass-journey-recorder.test.js test/my-grass-recording-v13.test.js test/my-grass-reading-journey.test.js`
Expected: all pass.

- [ ] **Step 7: Commit**

Commit: `feat(my-grass): make recorder part of reading journey`

---

### Task 3: 左页经文点击改为“开始 / 连续推进”并重做状态区

**Files:**
- Modify: `pasture-preview/my-grass-reading-v1.js`
- Modify: `test/my-grass-reading-session.test.js`
- Create: `test/my-grass-journey-reading-ui.test.js`

**Interfaces:**
- Produces the Journey intent events defined in Task 2.
- Consumes `mygrass:journey-state` and `mygrass:journey-tick`.
- UI states: `idle`, `arming`, `recording`, `confirm-end`, `finalizing`, `completed`, `error`.

- [ ] **Step 1: Write failing DOM/contract tests for the new left-page flow**

Tests must prove:
- first verse click dispatches `start-request` and does not mark verse read before recording state arrives;
- next verse click dispatches `advance-request` only when it is exactly current+1;
- clicking current verse again does nothing;
- clicking a later skipped verse shows “当前正在读第X节，请从下一节继续。” and emits no advance;
- old “完成本次阅读” button and range-selection semantics are absent;
- the repurposed status area renders REC/current verse/timer/end control while recording;
- end control first enters inline confirm state and does not stop recording;
- “继续读” returns to recording unchanged;
- “结束” dispatches exactly one `end-request`;
- finalizing blocks further verse advances.

- [ ] **Step 2: Run UI tests and verify RED**

Run: `node --test test/my-grass-journey-reading-ui.test.js test/my-grass-reading-session.test.js`
Expected: FAIL against current click-to-select / complete-reading UI.

- [ ] **Step 3: Refactor `selectVerse` into start/advance intent logic**

Do not let the reading layer own MediaRecorder or the authoritative timeline; it only emits intent and renders coordinator state.

- [ ] **Step 4: Replace `#gsReadingDoneBadge` / complete button region with `#gsReadingJourneyStatus`**

Exact live copy:
- idle: `点一节经文，开始今日读经`
- arming: `正在开启麦克风…`
- recording: `● 正在读经 · {reference} · {mm:ss}` + `■ 结束今日读经`
- confirm: `结束今日读经？ {rangeSoFar} · {mm:ss}` + `继续读` / `结束`
- finalizing: `正在保存本次读经…`
- completed: `今日读经完成 · {reference} · {mm:ss}`

- [ ] **Step 5: Run GREEN**

Run: `node --test test/my-grass-journey-reading-ui.test.js test/my-grass-reading-session.test.js`
Expected: all pass.

- [ ] **Step 6: Commit**

Commit: `feat(my-grass): drive reading journey from verse clicks`

---

### Task 4: 一次性替换淡草痕为“页边读痕 + 当前指针”

**Files:**
- Modify: `pasture-preview/my-grass-immersive-v04.css`
- Modify: `pasture-preview/my-grass-reading-v1.js`
- Modify: `test/my-grass-reading-session.test.js`
- Modify: `test/my-grass-journey-reading-ui.test.js`

**Interfaces:**
- Verse classes:
  - `.is-read` = 已封存的过去经节
  - `.is-current` = 当前录音经节
  - no state class = 未读
- Remove new-flow use of `.is-range`, `.is-start`, `.is-end` grass-trace/sprout styling.

- [ ] **Step 1: Write failing visual contract tests**

Assertions must prove:
- CSS no longer contains the translucent grass underline or terminal sprout for Journey state;
- `.is-read` uses a short page-margin/verse-start vertical read mark and explicit verse-number state;
- `.is-current` has a stronger pointer plus a clearly distinguishable text treatment that does not rely solely on `font-weight:900`;
- unvisited verses remain ordinary scripture typography;
- no highlight background, no karaoke color wash, no flashing.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/my-grass-reading-session.test.js test/my-grass-journey-reading-ui.test.js`
Expected: FAIL because old grass trace remains.

- [ ] **Step 3: Implement the new read-mark classes without changing the approved scripture header/navigation layout**

Preserve paragraph-like scripture flow; use a compact start-of-verse margin mark/pseudo-element rather than converting every verse into a large card/block.

- [ ] **Step 4: Add reduced-motion handling for the REC indicator**

REC may breathe subtly in normal mode, but `prefers-reduced-motion: reduce` must disable the pulse while leaving an unmistakable static recording state.

- [ ] **Step 5: Run GREEN and visual CSS checks**

Run: `node --test test/my-grass-reading-session.test.js test/my-grass-journey-reading-ui.test.js`
Expected: all pass.

- [ ] **Step 6: Commit**

Commit: `feat(my-grass): replace grass trace with scripture read marks`

---

### Task 5: 右页复古录音机退回“设备反馈”，完成后才承担回听

**Files:**
- Modify: `pasture-preview/my-grass-v1.js`
- Modify: `pasture-preview/my-grass-immersive-v04.css`
- Modify: `test/my-grass-recording-v13.test.js`
- Modify: `test/my-grass-journey-recorder.test.js`

**Interfaces:**
- Consumes current Journey state/tick owned by the coordinator.
- During recording: display-only REC/wave/timer; no start/link buttons.
- Completed: play/pause is enabled from `readingJourney.audio`.

- [ ] **Step 1: Write failing recorder-console tests**

Tests must prove:
- title remains `今日读经`;
- idle console tells the user to click a verse, instead of exposing a separate record action;
- recording console shows persistent REC + animated waveform + current elapsed time;
- `🔗` link control is absent from new flow;
- completed Journey enables play/pause using the Journey-owned audio ID;
- legacy entries can still play their old `reading.audioId` without pretending they have a timeline.

- [ ] **Step 2: Run and verify RED**

Run: `node --test test/my-grass-recording-v13.test.js test/my-grass-journey-recorder.test.js`
Expected: FAIL on old physical control layout/semantics.

- [ ] **Step 3: Rebuild the right console state mapping while preserving the approved retro hardware aesthetic**

Do not redesign the left page or the folio shell. The right console is secondary feedback during recording, not the main start/stop controller.

- [ ] **Step 4: Run GREEN**

Run: `node --test test/my-grass-recording-v13.test.js test/my-grass-journey-recorder.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

Commit: `feat(my-grass): simplify recorder to journey feedback`

---

### Task 6: 完成 Journey 后写回真实经文范围并安全保存档案

**Files:**
- Modify: `pasture-preview/my-grass-v1.js`
- Modify: `pasture-preview/my-grass-reading-v1.js`
- Modify: `pasture-preview/my-grass-core.js`
- Modify: `test/my-grass-reading-journey.test.js`
- Modify: `test/my-grass-journey-reading-ui.test.js`

**Interfaces:**
- On completion, coordinator emits the completed Journey only after audio persistence succeeds.
- Reading layer writes actual `reference`/verse IDs/text (CUV local text; ESV remains reference-only) from the Journey’s true start/end.
- `saveEntry()` requires a completed Journey for new schema-v2 entries.

- [ ] **Step 1: Write failing persistence tests**

Cover:
- starting at verse 1 and ending at 7 saves `1–7`, regardless of what chapter/range was browsed before start;
- ESV completed Journey persists only reference/verse IDs/timeline/audio metadata, never passage body;
- CUV may persist selected text according to existing local-text policy;
- saving before Journey completion is blocked;
- no manual `verifiedAgainstRecording` flag is required for v2;
- revising a saved v2 entry preserves its Journey by default.

- [ ] **Step 2: Run RED**

Run: `node --test test/my-grass-reading-journey.test.js test/my-grass-journey-reading-ui.test.js test/my-grass-esv.test.js`
Expected: FAIL on old readingSession/audio split.

- [ ] **Step 3: Implement actual-range writeback and v2 save path**

Keep legacy v1 entries intact. Do not mutate old entries into fake v2 timelines on open.

- [ ] **Step 4: Run GREEN**

Run: `node --test test/my-grass-reading-journey.test.js test/my-grass-journey-reading-ui.test.js test/my-grass-esv.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

Commit: `feat(my-grass): persist completed reading journeys`

---

### Task 7: 回听按真实 verse timestamps 跟随，彻底删除文字长度估算的新流程

**Files:**
- Modify: `pasture-preview/my-grass-reading-v1.js`
- Modify: `pasture-preview/my-grass-v1.js`
- Modify: `test/my-grass-reading-session.test.js`
- Modify: `test/my-grass-reading-journey.test.js`

**Interfaces:**
- Playback event detail carries `audioId`, `currentTimeMs`, `state`.
- Reading layer calls `C.journeyVerseAt(completedJourney,currentTimeMs)`.
- Legacy entry with no Journey timeline: audio may play, but no fabricated verse-follow state.

- [ ] **Step 1: Write failing playback tests**

Cover exact segment boundaries, pause retention, resume, seek, ended cleanup, and legacy no-timeline behavior.

- [ ] **Step 2: Run RED**

Run: `node --test test/my-grass-reading-session.test.js test/my-grass-reading-journey.test.js`
Expected: FAIL while `verseForAudioProgress` text-length mapping still drives new playback.

- [ ] **Step 3: Replace new-flow playback mapping with Journey timeline lookup**

Remove `verseForAudioProgress` from the new Journey path. It may be deleted entirely if no legacy code needs it; do not keep it as a silent fallback that could imply false accuracy.

- [ ] **Step 4: Run GREEN**

Run: `node --test test/my-grass-reading-session.test.js test/my-grass-reading-journey.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

Commit: `feat(my-grass): follow recorded verse timestamps on playback`

---

### Task 8: 异常、中断、离开保护与可恢复状态

**Files:**
- Modify: `pasture-preview/my-grass-v1.js`
- Modify: `pasture-preview/my-grass-reading-v1.js`
- Create: `test/my-grass-journey-interruption.test.js`

**Interfaces:**
- Coordinator emits `phase:error` with an explicit reason and freezes advancement.
- Active recording blocks tab/module/archive/new-entry/translation/chapter navigation until user continues or explicitly ends/restarts.
- `beforeunload` warns only while `arming|recording|finalizing`.

- [ ] **Step 1: Write failing interruption tests**

Cover the five Review Focus classes at the top of this plan, especially mic denial, rapid clicks, MediaRecorder error, IndexedDB save failure, and navigation attempts during active recording.

- [ ] **Step 2: Run RED**

Run: `node --test test/my-grass-journey-interruption.test.js`
Expected: FAIL because the old flow does not have Journey-aware guards.

- [ ] **Step 3: Implement minimal explicit recovery UI/state**

Never continue marking verses read while recorder state is broken. Preserve already collected timeline/audio blob in memory where possible until user retries or discards.

- [ ] **Step 4: Run GREEN**

Run: `node --test test/my-grass-journey-interruption.test.js test/my-grass-journey-recorder.test.js test/my-grass-journey-reading-ui.test.js`
Expected: all pass.

- [ ] **Step 5: Commit**

Commit: `fix(my-grass): guard interrupted reading journeys`

---

### Task 9: 全面回归、线上 Preview 验证与 Draft PR 更新

**Files:**
- Modify tests only if verification exposes a real missing contract; no opportunistic redesign.
- No Production files/branch merge.

**Interfaces:**
- Verifies all outputs from Tasks 1–8 as one end-to-end feature branch.

- [ ] **Step 1: Run focused Journey suite**

Run:
`node --test test/my-grass-reading-journey.test.js test/my-grass-journey-recorder.test.js test/my-grass-journey-reading-ui.test.js test/my-grass-journey-interruption.test.js test/my-grass-reading-session.test.js test/my-grass-recording-v13.test.js test/my-grass-esv.test.js test/my-grass-scripture-rootfix.test.js`
Expected: all pass.

- [ ] **Step 2: Run project verification**

Run:
- `npm run build`
- `npm run lint`
- Hobby Function budget test
- `git diff --check`
- `npm test`

Expected: build/lint/budget/diff-check pass. If the full suite still has unrelated baseline failures, record exact counts/categories and confirm there are no new My Grass failures; never describe the full suite as green unless it is actually green.

- [ ] **Step 3: Browser-level manual flow on Preview**

Use a real browser environment if available; otherwise explicitly state the limitation. Verify:
1. open a chapter;
2. click verse 1;
3. grant mic;
4. observe left REC/current/timer and right REC/wave;
5. click verse 2 then verse 3 without recorder interruption;
6. attempt to skip to verse 6 and confirm it is refused;
7. press end, choose “继续读”, verify recording continues;
8. press end again, choose “结束”;
9. verify saved range is exactly 1–3;
10. play back and verify current verse follows the recorded timestamp boundaries.

- [ ] **Step 4: Deploy only Preview from `feat/my-grass-cuv-shen-bible-v1`**

Confirm Vercel deployment metadata points to the exact final feature-branch SHA and `target=null/preview`; Production remains untouched.

- [ ] **Step 5: Fetch deployed JS/CSS and verify the actual online artifacts**

Confirm online code contains Journey event interfaces, real timestamp playback, read-mark classes, and no new-flow link action/grass-trace dependency.

- [ ] **Step 6: Update PR #33 body/status evidence without merging it**

Keep PR Draft/open/unmerged until the user explicitly authorizes Production integration.

- [ ] **Step 7: Final commit only if verification documentation/tests changed**

Use a focused verification/test commit; do not create unrelated cleanup commits.
