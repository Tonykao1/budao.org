# Editorial Journey Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed V7.1 萤火之地 layout with a reusable, testable Editorial Journey Engine that generates adaptive image/text scenes live, preserves walked scenes, renders scene-by-scene depth return, and ends in quiet natural closure.

**Architecture:** Use small browser-native ES modules (`.mjs`) for fingerprints, rhythm, candidate generation, solving, validation, journey state, and rendering. Keep runtime logic deterministic and numeric; no runtime LLM, no semantic pairing, no WebGL in v1. 萤火之地 becomes a thin adapter/config around the shared engine and retains its existing night/stars visual language.

**Tech Stack:** Vanilla JavaScript ES modules, DOM/CSS transforms, Node 22 built-in test runner, static HTML/CSS, headless Chromium for viewport verification, Vercel preview deployment.

**Spec:** `docs/superpowers/specs/2026-10-07-editorial-journey-engine-design.md`

## Global Constraints

- 萤火之地 uses independent image and text pools; no semantic or emotional pairing.
- Text must never be truncated, excerpted, rewritten, or split across scenes.
- Images default to full-frame; cropping is generated only when `safeCrop.confidence >= 0.85`, otherwise full-frame.
- No manual override UI or author override path in v1.
- Once a scene is viewed, its `SceneSpec` is immutable for the current journey.
- Only unseen frontier scenes may be generated live.
- Hidden natural-closure safety bounds are 8 minimum scenes and 15 maximum scenes.
- Desktop uses strong depth-return motion; mobile keeps the same identity with reduced 3D intensity.
- Focus state must render text as crisp DOM with no blur, perspective, or transform distortion.
- Soft magnetism must never use hard `scroll-snap`; fast user intent always wins.
- No runtime LLM, no sentiment analysis, no WebGL, no audio playback in v1.
- Existing production/main behavior must remain untouched until this branch is explicitly merged.

## Review Focus

- **Pool exhaustion:** when one pool runs out before the other, the engine must continue with legal image-only/text-only scenes rather than duplicate content prematurely. Covered in Task 4.
- **Very long intact text:** a quote near the practical maximum must remain complete, fit the viewport, and force a safer scene type when necessary. Covered in Tasks 2 and 7.
- **Unsafe/unknown crop metadata:** missing, malformed, or low-confidence crop data must always fall back to full-frame. Covered in Task 1.
- **Rapid scrolling:** soft magnetism must not trap a user who is scrolling quickly; focus lock is visual stabilization, not input capture. Covered in Task 6.
- **Backtracking after virtualization:** a stored walked scene reconstructed after scrolling far back must restore the exact frozen `SceneSpec`. Covered in Tasks 4 and 6.

---

## File Structure

Create:

- `editorial-journey/fingerprint.mjs` — structural image/text fingerprints only.
- `editorial-journey/rhythm.mjs` — rolling journey rhythm state and closure metrics.
- `editorial-journey/candidates.mjs` — legal scene candidate generation.
- `editorial-journey/validator.mjs` — hard scene constraints.
- `editorial-journey/solver.mjs` — scoring and near-top selection.
- `editorial-journey/journey.mjs` — live frontier generation, freeze, history, natural closure.
- `editorial-journey/renderer.mjs` — DOM scene construction, depth motion, reading lock, virtualization.
- `editorial-journey/editorial-journey.css` — shared renderer geometry and motion states.
- `yhzd-depth-return.mjs` — 萤火之地 content adapter/config and startup.
- `test/editorial-journey-engine.test.js` — pure engine tests.
- `scripts/yhzd-layout-check.mjs` — headless Chromium viewport/layout verification.

Modify:

- `yhzd.html` — replace five fixed scenes with journey root and module entrypoint.
- `yhzd-editorial.css` — keep only 萤火之地 theme/hero/night-specific styling; remove fixed V7.1 grid rules.
- `test/yhzd-editorial.test.js` — change from fixed five-scene contract to shared-engine integration contract.
- `package.json` — include new tests and layout-check command.

Retire after integration proves green:

- `yhzd-editorial.js` — legacy fixed-scene randomizer, no longer loaded by the page.

---

### Task 1: Structural fingerprints and crop safety

**Files:**
- Create: `editorial-journey/fingerprint.mjs`
- Create: `test/editorial-journey-engine.test.js`

**Interfaces:**
- Produces: `fingerprintImage(item) -> ImageFingerprint`
- Produces: `fingerprintText(text) -> TextFingerprint`
- `ImageFingerprint` fields used later: `id`, `aspect`, `orientation`, `density`, `safeCrop`, `largeFormatScore`.
- `TextFingerprint` fields used later: `id`, `text`, `characters`, `sentences`, `punctuation`, `densityClass`, `estimatedLines(widthClass)`.

- [ ] **Step 1: Write failing tests for image/text fingerprints**

Assert:
- landscape/portrait/square classification is deterministic from width/height.
- text is returned byte-for-byte unchanged.
- short/medium/long classes are deterministic from character count.
- missing crop metadata yields `safeCrop: null`.
- crop metadata below confidence `0.85` yields `safeCrop: null`.
- crop metadata at/above `0.85` is preserved without mutating the source item.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: FAIL because `editorial-journey/fingerprint.mjs` does not exist.

- [ ] **Step 3: Implement the minimal fingerprint module**

Exact exports:

```js
export function fingerprintImage(item) {}
export function fingerprintText(text) {}
```

No semantic, emotion, people-recognition, or theology fields.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: PASS for Task 1 tests.

- [ ] **Step 5: Commit**

```bash
git add editorial-journey/fingerprint.mjs test/editorial-journey-engine.test.js
git commit -m "feat(yhzd): add structural editorial fingerprints"
```

---

### Task 2: Candidate generation and hard validation

**Files:**
- Create: `editorial-journey/candidates.mjs`
- Create: `editorial-journey/validator.mjs`
- Modify: `test/editorial-journey-engine.test.js`

**Interfaces:**
- Consumes: `ImageFingerprint`, `TextFingerprint` from Task 1.
- Produces: `generateSceneCandidates({ image, text, rhythm, viewport }) -> SceneCandidate[]`
- Produces: `validateSceneCandidate(candidate, context) -> { valid, reasons }`
- Candidate `sceneType` values: `'image-text' | 'image-only' | 'text-only'`.

- [ ] **Step 1: Write failing tests for legal scene families and validator rules**

Assert:
- image+text input can produce all legal candidate families when geometry allows.
- text-only remains available when a long intact quote would make image+text unsafe.
- image-only remains available when text pool is empty.
- no candidate contains modified text.
- crop candidates exist only when fingerprint has safe crop confidence >= `0.85`.
- validator rejects horizontal overflow, unreadably small text, subject-unsafe crop, focus blur/perspective, and zero-useful-area media.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: FAIL on missing candidate/validator exports.

- [ ] **Step 3: Implement minimal candidate generation and validation**

Exact exports:

```js
export function generateSceneCandidates({ image, text, rhythm, viewport }) {}
export function validateSceneCandidate(candidate, context) {}
```

Use continuous numeric fields for image scale, text width, scene length, scene depth, and focus point; do not encode fixed template names beyond `sceneType`.

- [ ] **Step 4: Run test and verify GREEN**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: PASS for Task 1–2 tests.

- [ ] **Step 5: Commit**

```bash
git add editorial-journey/candidates.mjs editorial-journey/validator.mjs test/editorial-journey-engine.test.js
git commit -m "feat(yhzd): generate and validate adaptive scenes"
```

---

### Task 3: Rhythm state and editorial solver

**Files:**
- Create: `editorial-journey/rhythm.mjs`
- Create: `editorial-journey/solver.mjs`
- Modify: `test/editorial-journey-engine.test.js`

**Interfaces:**
- Produces: `createRhythmState() -> RhythmState`
- Produces: `advanceRhythm(state, sceneSpec) -> RhythmState`
- Produces: `scoreSceneCandidate(candidate, context) -> number`
- Produces: `chooseSceneCandidate(candidates, context, random=Math.random) -> SceneSpec`
- `SceneSpec` fields: `id`, `sceneType`, `imageId?`, `messageId?`, `imageScale?`, `imageAnchor?`, `cropSpec?`, `textWidth?`, `textAnchor?`, `sceneLength`, `sceneDepth`, `focusPoint`, `transitionStrength`, `mobileFallback`, `visualWeight`.

- [ ] **Step 1: Write failing rhythm/solver tests**

Assert:
- three repeated heavy image-text scenes create an anti-repetition penalty.
- a light scene scores higher after a heavy run when both are valid.
- a candidate with better readability beats a prettier but crowded candidate.
- `chooseSceneCandidate` only randomizes within a near-top band of `<= 3%` score difference.
- a candidate more than `3%` below the top score is never chosen for variety.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: FAIL on missing rhythm/solver exports.

- [ ] **Step 3: Implement rhythm updates and weighted scoring**

Use explicit score components: readability, composition, rhythm, continuity, variation, depth fitness, minus risk penalties. Keep weights exported as `DEFAULT_SOLVER_WEIGHTS` so later tuning does not change public interfaces.

- [ ] **Step 4: Run test and verify GREEN**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: PASS for Task 1–3 tests.

- [ ] **Step 5: Commit**

```bash
git add editorial-journey/rhythm.mjs editorial-journey/solver.mjs test/editorial-journey-engine.test.js
git commit -m "feat(yhzd): add rhythm-aware editorial solver"
```

---

### Task 4: Live journey state, freeze, pool exhaustion, natural closure

**Files:**
- Create: `editorial-journey/journey.mjs`
- Modify: `test/editorial-journey-engine.test.js`

**Interfaces:**
- Consumes: fingerprint/candidate/validator/solver/rhythm modules.
- Produces: `createJourneyEngine(options) -> JourneyEngine`.
- `JourneyEngine` methods:
  - `ensureAhead(count = 2) -> SceneSpec[]`
  - `markViewed(sceneId) -> void`
  - `getScenes() -> SceneSpec[]`
  - `getState() -> JourneyState`
  - `isClosed() -> boolean`
- Options include: `images`, `messages`, `viewport`, `random`, `recentImageIds`, `recentMessages`, `minScenes=8`, `maxScenes=15`.

- [ ] **Step 1: Write failing journey tests**

Assert:
- initial generation creates only a small frontier buffer, not the full journey.
- `markViewed` freezes a scene and later calls never mutate it.
- scrolling/backtracking simulation returns the exact same SceneSpec object values.
- unseen frontier generation appends without rewriting earlier scenes.
- image and text pools are selected independently.
- same-journey duplicates are suppressed until a relevant pool is exhausted.
- if images exhaust first, text-only scenes remain legal; if text exhausts first, image-only remains legal.
- natural closure cannot occur before 8 scenes and must occur by 15 scenes.
- closure requires rhythm completion signals before the maximum safety bound.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: FAIL on missing `createJourneyEngine`.

- [ ] **Step 3: Implement the journey state machine**

`JourneyState` must persist ordered frozen specs, frontier index, used content ids/messages, rhythm state, and closure state. No DOM dependencies.

- [ ] **Step 4: Run test and verify GREEN**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: PASS for Task 1–4 tests.

- [ ] **Step 5: Commit**

```bash
git add editorial-journey/journey.mjs test/editorial-journey-engine.test.js
git commit -m "feat(yhzd): add live frozen journey generation"
```

---

### Task 5: Depth-return DOM renderer and reading lock

**Files:**
- Create: `editorial-journey/renderer.mjs`
- Create: `editorial-journey/editorial-journey.css`
- Modify: `test/editorial-journey-engine.test.js`

**Interfaces:**
- Produces: `sceneMotionState(progress, mode='desktop') -> MotionState`
- Produces: `createDepthReturnRenderer({ root, window, lookupImage, config }) -> Renderer`
- `Renderer` methods: `sync(sceneSpecs)`, `setActiveScene(sceneId)`, `destroy()`.
- `MotionState` includes numeric `scale`, `blurPx`, `opacity`, `brightness`, `translateZ`, `lateralShift`, `readingLocked`.

- [ ] **Step 1: Write failing pure-motion tests**

Assert:
- distant scene is smaller/dimmer/more blurred than focus.
- focus state has `blurPx === 0`, `readingLocked === true`, and no text perspective.
- receding state moves deeper rather than simply setting opacity to zero.
- mobile mode keeps depth identity but has lower absolute perspective/lateral values than desktop.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: FAIL on missing renderer exports.

- [ ] **Step 3: Implement DOM renderer and shared CSS**

Use real DOM `<blockquote>/<p>` for text. Apply spatial transforms to scene/media layers; when `readingLocked`, switch the text element into the flat reading layer state with transform/blur cleared.

- [ ] **Step 4: Run test and verify GREEN**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: PASS for Task 1–5 tests.

- [ ] **Step 5: Commit**

```bash
git add editorial-journey/renderer.mjs editorial-journey/editorial-journey.css test/editorial-journey-engine.test.js
git commit -m "feat(yhzd): render depth-return scenes with reading lock"
```

---

### Task 6: Soft magnetism and scene virtualization

**Files:**
- Modify: `editorial-journey/renderer.mjs`
- Modify: `test/editorial-journey-engine.test.js`

**Interfaces:**
- Produces: `computeSoftMagnetism({ focusDistance, velocity, delta, mode }) -> number` where the result is an interpolation factor only, never an input-capture command.
- Extends renderer with near/deep/stored memory tiers.

- [ ] **Step 1: Write failing magnetism/virtualization tests**

Assert:
- low-velocity movement near focus receives gentle stabilization.
- high velocity returns `0` magnetism and never blocks progression.
- far-from-focus returns `0` magnetism.
- only near-memory scenes retain full DOM detail.
- virtualized walked scenes retain their immutable SceneSpec and reconstruct identically when requested again.

- [ ] **Step 2: Run test and verify RED**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: FAIL on missing soft-magnetism/virtualization behavior.

- [ ] **Step 3: Implement soft magnetism and three memory tiers**

Do not use CSS `scroll-snap-*`. Keep current/adjacent scenes full, older nearby scenes lightweight, and distant walked scenes represented only by SceneSpec until remounted.

- [ ] **Step 4: Run test and verify GREEN**

Run: `node --test test/editorial-journey-engine.test.js`
Expected: PASS for Task 1–6 tests.

- [ ] **Step 5: Commit**

```bash
git add editorial-journey/renderer.mjs test/editorial-journey-engine.test.js
git commit -m "feat(yhzd): add soft focus magnetism and journey virtualization"
```

---

### Task 7: Integrate 萤火之地 with the shared engine

**Files:**
- Create: `yhzd-depth-return.mjs`
- Modify: `yhzd.html`
- Modify: `yhzd-editorial.css`
- Modify: `test/yhzd-editorial.test.js`
- Modify: `package.json`
- Retire from page load: `yhzd-editorial.js`

**Interfaces:**
- `yhzd-depth-return.mjs` exports `initYhzdDepthReturn({ document, window })` for integration testing and starts it from `yhzd.html` via `<script type="module">`.
- Adapter fetches `/images/yhzd/manifest.json`, fingerprints image items/messages, creates a journey engine, creates a depth-return renderer, and grows the frontier as the user approaches it.

- [ ] **Step 1: Rewrite integration contract tests to fail against V7.1**

Assert:
- `yhzd.html` has exactly one journey root and no five hard-coded `.editorial-scene` sections.
- page loads `editorial-journey/editorial-journey.css` and `yhzd-depth-return.mjs`.
- legacy `/yhzd-editorial.js` is no longer loaded.
- hero/title/night/stars/glow remain present.
- there is no CTA/end copy in the journey ending state.
- long message fixture remains intact in generated DOM text.

- [ ] **Step 2: Run focused integration tests and verify RED**

Run: `node --test test/yhzd-editorial.test.js test/editorial-journey-engine.test.js`
Expected: FAIL because page still contains fixed V7.1 scenes.

- [ ] **Step 3: Implement the thin 萤火之地 adapter and HTML/CSS migration**

Keep project-specific values in `yhzd-depth-return.mjs` and `yhzd-editorial.css`; do not put 萤火之地 copy or pool rules into the shared engine modules.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `node --test test/yhzd-editorial.test.js test/editorial-journey-engine.test.js`
Expected: PASS.

- [ ] **Step 5: Run full repository test suite**

Run: `npm test`
Expected: all tests PASS with zero failures.

- [ ] **Step 6: Commit**

```bash
git add yhzd.html yhzd-depth-return.mjs yhzd-editorial.css package.json test/yhzd-editorial.test.js editorial-journey

git commit -m "feat(yhzd): migrate to live depth-return journey engine"
```

---

### Task 8: Multi-viewport safety verification and preview acceptance

**Files:**
- Create: `scripts/yhzd-layout-check.mjs`
- Modify: `package.json`
- Modify as needed after evidence: `editorial-journey/editorial-journey.css`, `yhzd-editorial.css`, `editorial-journey/renderer.mjs`

**Interfaces:**
- Script starts a local static server, launches `/usr/bin/chromium` headless, evaluates the real page at widths `1536, 1440, 1280, 1024, 981, 980, 768, 430, 390, 320`, and exits non-zero on any safety failure.
- Browser-side acceptance checks every mounted scene for text/image geometry and reading-lock state.

- [ ] **Step 1: Add the failing browser-layout checker**

Checks per viewport:
- no horizontal document overflow.
- every visible quote rect stays inside viewport safe bounds.
- quote DOM text equals its immutable SceneSpec text exactly.
- focus-locked text has computed `filter: none`/zero blur and no perspective transform.
- every mounted image has a positive useful rendered area.
- mobile widths use reduced-depth mode.

- [ ] **Step 2: Run browser verification and collect evidence**

Run: `npm run test:yhzd-layout`
Expected before final tuning: any real violations produce explicit viewport/scene failures.

- [ ] **Step 3: Fix only evidence-backed layout/motion violations**

Do not hide overflow as a substitute for correcting geometry. Preserve all spec constraints while tuning safe widths, scene lengths, and mobile depth intensity.

- [ ] **Step 4: Re-run all verification**

Run:

```bash
npm test
npm run test:yhzd-layout
npm run build
```

Expected: all commands exit `0`.

- [ ] **Step 5: Deploy branch preview and inspect the real hosted page**

Confirm Vercel preview is `READY`, then inspect the deployed HTML/CSS/JS and verify the branch SHA matches the latest commit.

- [ ] **Step 6: Final whole-branch review**

Review against `docs/superpowers/specs/2026-10-07-editorial-journey-engine-design.md`, with special attention to text integrity, independent pools, zero manual override, frozen walked scenes, natural closure, and mobile fallback.

- [ ] **Step 7: Commit final evidence-backed fixes**

```bash
git add scripts/yhzd-layout-check.mjs package.json editorial-journey yhzd-editorial.css

git commit -m "test(yhzd): verify depth-return journey across viewports"
```

---

## Plan Self-Review Result

- **Spec coverage:** all v1 spec boundaries are mapped to Tasks 1–8; audio, WebGL, semantic analysis, and manual overrides remain explicitly excluded.
- **Type consistency:** `ImageFingerprint`, `TextFingerprint`, `RhythmState`, `SceneCandidate`, `SceneSpec`, and `JourneyState` are introduced once and consumed consistently downstream.
- **Failure coverage:** pool exhaustion, very long intact text, unsafe crop metadata, rapid scrolling, and virtualized backtracking are pinned to explicit tests.
- **Proportion:** implementation details are limited to exact module boundaries, public signatures, acceptance values, and tests; algorithm bodies remain for implementation.
