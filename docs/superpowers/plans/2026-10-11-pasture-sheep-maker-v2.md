# Digital Pasture Sheep Maker V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 3-choice sheep configurator with a minimal-text, internationalized, eight-dimension sheep identity engine whose preview and in-pasture resident sheep are rendered from the same V2 DNA.

**Architecture:** Keep the current resident auth/session flow and the existing 44+1 core interaction engine. Add a versioned sheep DNA model (`appearance_version`, `appearance_v2`), a shared browser-safe DNA module and shared pixel renderer, then make both the maker preview and `pasture-resident-core.js` consume those shared modules. V1 residents remain readable; V2 saves also backfill the legacy color/marking fields so rollback remains safe.

**Tech Stack:** Node.js 22, vanilla browser JavaScript, Canvas 2D, Neon Postgres, existing Vercel/GitHub Actions release gate.

**Spec:** `docs/superpowers/specs/2026-10-11-pasture-sheep-maker-v2-design.md`

## Global Constraints

- Sheep = resident/user; never present the sheep as a pet, possession, adoption, or reward.
- Visible first screen copy is only `你`; primary forward action is `→`.
- Final confirmation primary action is only `✓`.
- No `<select>` controls in the V2 maker.
- V2 has exactly eight dimensions: `woolColor`, `faceColor`, `woolShape`, `bodyShape`, `ears`, `expression`, `marking`, `forelock`.
- V2 first-release enum counts are fixed by the approved spec; implementation must not invent extra variants.
- Main interaction must remain understandable without visible explanatory text; locale strings primarily serve `aria-label`, auth/error copy, and assistive UI.
- At least `zh-CN` and `en` locale keys must exist.
- Existing V1 residents must continue to render and must not be deleted or reset.
- Maker preview, resident rendering, and pixel hit mask must derive from the same shared geometry renderer.
- Existing resident interaction behavior remains locked: same core canvas, exact-pixel hit, five-finger hand, feet-point placement, night tint behavior, approved `baaa01.mp3`, 0.90 s stop, distance volume, left/right stereo pan.
- Do not add a new top-level Vercel serverless function; keep `/api/pasture-auth` routed through the existing publish compatibility function.
- Save only on final `✓`; draft changes remain client-side/sessionStorage until confirmation.

## Review Focus

1. **Malformed or partial V2 DNA from client/sessionStorage** — reject/repair to defaults without corrupting a saved resident; test in Tasks 1 and 6.
2. **Old V1 resident after schema migration** — still returns legacy appearance and renders successfully; test in Tasks 2 and 5.
3. **Reload midway through maker** — restore only a valid draft; never treat a draft as a saved sheep; test in Task 6.
4. **V2 save succeeds but arrival message is duplicated/replayed** — arrival occurs only for the first confirmed save; test in Tasks 3 and 7.
5. **Very small/far sheep variants lose identifiable geometry or hit mask diverges** — renderer and hit mask must use identical rect geometry; test in Tasks 4 and 5.

---

### Task 1: Shared V2 DNA schema, defaults, validation, and randomization

**Files:**
- Create: `pasture-sheep-dna.js`
- Create: `test/pasture-sheep-dna-v2.test.js`

**Interfaces:**
- Produces: `window.PastureSheepDNA` in browser and CommonJS export in tests.
- Produces functions: `defaultV2()`, `validateV2(input)`, `normalizeV2(input)`, `randomV2(randomFn = Math.random)`, `toLegacy(v2)`.
- Produces enum maps used by UI and renderer for all eight approved dimensions.

- [ ] **Step 1: Write failing tests for the exact eight keys and fixed enum membership**

Assert that `defaultV2()` returns `{version:2,...}` with exactly the eight approved dimensions, and that every value belongs to its approved enum.

- [ ] **Step 2: Write failing tests for malformed and partial DNA**

Assert `validateV2()` rejects unknown enum values/extra version values, while `normalizeV2()` repairs missing keys to approved defaults and never emits a ninth identity dimension.

- [ ] **Step 3: Write failing randomized-property test**

Call `randomV2()` repeatedly with deterministic random functions and assert every result passes `validateV2()`, including combinations where dark wool requires a sufficiently distinct face color according to the spec compatibility rule.

- [ ] **Step 4: Run the DNA tests and verify RED**

Run: `node --test test/pasture-sheep-dna-v2.test.js`
Expected: FAIL because `pasture-sheep-dna.js` does not exist.

- [ ] **Step 5: Implement the minimal shared DNA module**

Implement the interfaces above as a dependency-free UMD-style/browser-safe module. `toLegacy(v2)` must return `{bodyColor, headColor, marking}` using the V2 palette's exact hex colors and existing legacy marking names where compatible.

- [ ] **Step 6: Run the DNA tests and verify GREEN**

Run: `node --test test/pasture-sheep-dna-v2.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pasture-sheep-dna.js test/pasture-sheep-dna-v2.test.js
git commit -m "feat(pasture): add versioned sheep DNA V2"
```

### Task 2: Backward-compatible database storage and reads

**Files:**
- Modify: `api/_security/pasture-auth-store.js`
- Modify: `api/_security/pasture-auth-domain.js`
- Create: `test/pasture-sheep-store-v2.test.js`

**Interfaces:**
- Consumes: `PastureSheepDNA` schema semantics from Task 1, mirrored server-side without importing browser globals.
- Produces: sheep rows/public sheep objects with `appearanceVersion` and `appearanceV2` in addition to legacy `bodyColor`, `headColor`, `marking`.
- `saveSheep(userId, appearance)` accepts validated V2 data and writes both V2 + legacy fallback fields.

- [ ] **Step 1: Write failing schema contract tests**

Assert `ensurePastureSchema()` contains additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS appearance_version integer NOT NULL DEFAULT 1` and `appearance_v2 jsonb`, without dropping/replacing `pasture_sheep`.

- [ ] **Step 2: Write failing V1 compatibility test**

Assert a row with null `appearance_v2` is exposed as version 1 with its current `bodyColor/headColor/marking` intact.

- [ ] **Step 3: Write failing V2 round-trip contract test**

Assert store SELECT/RETURNING aliases include `appearanceVersion` and `appearanceV2`, and V2 save backfills all three legacy fields.

- [ ] **Step 4: Run and verify RED**

Run: `node --test test/pasture-sheep-store-v2.test.js`
Expected: FAIL on missing V2 columns/aliases.

- [ ] **Step 5: Implement additive schema migration, V2 persistence, and public-user shape**

Do not mutate/delete existing rows. Server validation must whitelist the exact V2 keys/enums and throw `INVALID_SHEEP` for unknown values or wrong version.

- [ ] **Step 6: Run tests and verify GREEN**

Run: `node --test test/pasture-sheep-store-v2.test.js`
Expected: PASS.

- [ ] **Step 7: Run existing auth tests**

Run the repository's current pasture auth/release tests.
Expected: PASS; V1 behavior unchanged.

- [ ] **Step 8: Commit**

```bash
git add api/_security/pasture-auth-store.js api/_security/pasture-auth-domain.js test/pasture-sheep-store-v2.test.js
git commit -m "feat(pasture): persist sheep appearance V2 compatibly"
```

### Task 3: API accepts V2 identity and preserves first-arrival semantics

**Files:**
- Modify: `api/_security/pasture-auth-handler.js`
- Modify: `test/pasture-live-release.test.js`
- Create: `test/pasture-sheep-api-v2.test.js`

**Interfaces:**
- Consumes: `domain.validateSheep(...)` returning a normalized V1-or-V2 server appearance.
- Produces: `saveSheep` response user with both legacy fields and `appearanceVersion/appearanceV2` when V2.
- `created` remains the sole signal that the client may trigger the first arrival animation.

- [ ] **Step 1: Write failing API test for V2 save payload**

POST `action:'saveSheep'` with the eight-dimension V2 payload and assert the handler passes the normalized V2 appearance to store and returns it on `user.sheep`.

- [ ] **Step 2: Write failing test for invalid V2 payload**

Unknown enum/key/version must return HTTP 400 `invalid_sheep` and never call store save.

- [ ] **Step 3: Write first-arrival regression test**

Assert `created:true` is returned only when the store says no prior sheep existed; updating/re-saving a sheep returns `created:false` so arrival cannot replay.

- [ ] **Step 4: Run and verify RED**

Run: `node --test test/pasture-sheep-api-v2.test.js`
Expected: FAIL because API response is V1-only.

- [ ] **Step 5: Implement minimal handler/public response changes**

Keep the existing route and serverless-function count unchanged.

- [ ] **Step 6: Run API + release tests and verify GREEN**

Run: `node --test test/pasture-sheep-api-v2.test.js test/pasture-live-release.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add api/_security/pasture-auth-handler.js test/pasture-sheep-api-v2.test.js test/pasture-live-release.test.js
git commit -m "feat(pasture): accept sheep identity V2 in auth API"
```

### Task 4: One shared pixel renderer for preview, pasture, and hit geometry

**Files:**
- Create: `pasture-sheep-renderer.js`
- Create: `test/pasture-sheep-renderer-v2.test.js`

**Interfaces:**
- Consumes: normalized V2 DNA from `PastureSheepDNA.normalizeV2()`.
- Produces: `window.PastureSheepRenderer` / CommonJS export.
- Produces functions: `rectsFor(dna)`, `draw(ctx, x, y, unit, flip, dna)`, `drawMask(ctx, dna, offsetX, offsetY)`.
- `rectsFor()` is the single source of sheep geometry for preview, resident canvas, and exact-pixel mask.

- [ ] **Step 1: Write failing renderer tests for each visual dimension**

For each of the eight dimensions, vary only that dimension and assert `rectsFor()` changes the intended geometry/color pixels while preserving valid rect bounds.

- [ ] **Step 2: Write failing same-geometry mask test**

Assert `draw()` and `drawMask()` both iterate geometry returned from `rectsFor()`; no separate resident-only shape definition is allowed.

- [ ] **Step 3: Write failing far-scale recognizability test**

For every silhouette variant (`woolShape`, `bodyShape`, `ears`, `forelock`), assert at least one identifying rect remains non-zero at the existing minimum resident scale.

- [ ] **Step 4: Run and verify RED**

Run: `node --test test/pasture-sheep-renderer-v2.test.js`
Expected: FAIL because renderer does not exist.

- [ ] **Step 5: Implement shared pixel renderer**

Keep it dependency-free and deterministic. Expressions may change only a few eye/mouth pixels; no humanoid face geometry.

- [ ] **Step 6: Run and verify GREEN**

Run: `node --test test/pasture-sheep-renderer-v2.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pasture-sheep-renderer.js test/pasture-sheep-renderer-v2.test.js
git commit -m "feat(pasture): add shared sheep pixel renderer"
```

### Task 5: Migrate the resident core engine to the shared renderer without breaking interaction

**Files:**
- Modify: `tonglu-core.html`
- Modify: `pasture-resident-core.js`
- Modify: `test/pasture-resident-engine-v1.test.js`
- Create: `test/pasture-resident-renderer-v2.test.js`

**Interfaces:**
- Consumes: `PastureSheepDNA` and `PastureSheepRenderer` globals loaded before resident engine.
- Produces: existing `tonglu-resident-v1` postMessage contract expanded to accept V1 or V2 sheep data without changing message type.

- [ ] **Step 1: Write failing test that core loads the two shared modules before resident engine**

Assert script order in the injected/core flow guarantees DNA + renderer exist before resident drawing.

- [ ] **Step 2: Write failing V1 resident rendering compatibility test**

V1 input (`bodyColor/headColor/marking`, no V2) must normalize to compatible geometry and remain draggable/hittable.

- [ ] **Step 3: Write failing V2 geometry/hit-mask test**

Assert the engine calls the shared renderer for both canvas draw and mask generation and no longer contains its own `residentRects` geometry table.

- [ ] **Step 4: Run and verify RED**

Run: `node --test test/pasture-resident-renderer-v2.test.js test/pasture-resident-engine-v1.test.js`
Expected: FAIL on duplicate local geometry/shared-module absence.

- [ ] **Step 5: Implement resident-core migration**

Preserve all approved interaction constants/behavior: exact hit, five-finger cursors, feet-point placement, bridge validity, night-tint hook, 900 ms MP3 cutoff, volume depth mapping, stereo pan mapping, persistence.

- [ ] **Step 6: Run resident and release regressions**

Run: `node --test test/pasture-resident-renderer-v2.test.js test/pasture-resident-engine-v1.test.js test/pasture-live-release.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add tonglu-core.html pasture-resident-core.js test/pasture-resident-renderer-v2.test.js test/pasture-resident-engine-v1.test.js
git commit -m "refactor(pasture): render resident sheep from shared DNA"
```

### Task 6: Build the four-screen minimal-text visual maker

**Files:**
- Modify: `pasture-live.html`
- Modify: `tonglu.html`
- Modify: `pasture-live.css`
- Modify: `pasture-live.js`
- Create: `pasture-sheep-i18n.js`
- Create: `test/pasture-sheep-maker-v2-ui.test.js`

**Interfaces:**
- Consumes: `PastureSheepDNA`, `PastureSheepRenderer`.
- Produces maker state `{screen:1|2|3|4, dna:V2DNA, activeDimension:string|null}`.
- Draft key: `budao-pasture-sheep-v2-draft`; draft is sessionStorage-only and is cleared after successful save.
- Locale helper: `PastureSheepI18n.t(key, locale)` with at least `zh-CN` and `en`.

- [ ] **Step 1: Write failing visible-copy contract test**

Assert screen 1 visible maker copy contains `你` and does not contain old phrases (`捏一只羊`, `这只羊就是你`, explanatory paragraph, `开始`); primary action exposes visible `→`. Assert screen 4 primary action visible text is exactly `✓`.

- [ ] **Step 2: Write failing eight-dimension visual-control test**

Assert no `<select>` exists; eight dimension controls use buttons with icon/sample markup, `aria-label`, and `aria-pressed/aria-selected`; option selection updates one DNA key and redraws through shared renderer.

- [ ] **Step 3: Write failing randomize test**

Random icon calls `PastureSheepDNA.randomV2()` and leaves the result editable; no rarity/reward copy exists.

- [ ] **Step 4: Write failing draft-restore tests**

Valid sessionStorage draft restores screen/DNA. Invalid/malformed draft is discarded and replaced by defaults. Draft alone never calls `saveSheep` and never marks resident as having a sheep.

- [ ] **Step 5: Write failing accessibility/mobile contract test**

Assert controls have locale-backed aria labels and CSS provides >=44px interactive targets; visual selected state must include non-color styling.

- [ ] **Step 6: Run and verify RED**

Run: `node --test test/pasture-sheep-maker-v2-ui.test.js`
Expected: FAIL against current 3-dimension maker.

- [ ] **Step 7: Implement the four-screen maker and locale module**

Use one persistent preview canvas and shared renderer. Screen 2 exposes wool/face/wool-shape/body-shape; screen 3 exposes ears/expression/marking/forelock + random icon. Keep visible text minimal per spec.

- [ ] **Step 8: Run UI tests and verify GREEN**

Run: `node --test test/pasture-sheep-maker-v2-ui.test.js`
Expected: PASS.

- [ ] **Step 9: Run release regressions**

Run: `node --test test/pasture-live-release.test.js test/pasture-resident-engine-v1.test.js`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add pasture-live.html tonglu.html pasture-live.css pasture-live.js pasture-sheep-i18n.js test/pasture-sheep-maker-v2-ui.test.js
git commit -m "feat(pasture): build minimal visual sheep maker V2"
```

### Task 7: Wire final confirmation to V2 save, arrival, and the 44+1 core

**Files:**
- Modify: `pasture-live.js`
- Modify: `test/pasture-sheep-maker-v2-ui.test.js`
- Modify: `test/pasture-live-release.test.js`

**Interfaces:**
- Consumes: API response from Task 3 and shared renderer/DNA modules.
- Produces: final `✓` behavior: save V2 once, clear draft, apply returned resident, send to core with `arrival: created === true`.

- [ ] **Step 1: Write failing success-flow test**

Assert clicking `✓` sends one `saveSheep` request containing version 2 + all eight dimensions, waits for successful response, clears draft, and calls `applyResident(true)` only when `created:true`.

- [ ] **Step 2: Write failing save-failure test**

On API failure, remain on screen 4, preserve DNA/draft, do not send arrival, and expose only the existing localized error channel.

- [ ] **Step 3: Write failing existing-resident test**

A resident with saved V2 identity skips maker and enters pasture without arrival replay. A V1 resident continues to skip maker under the current migration policy.

- [ ] **Step 4: Run and verify RED**

Run: `node --test test/pasture-sheep-maker-v2-ui.test.js test/pasture-live-release.test.js`
Expected: FAIL until V2 save wiring is complete.

- [ ] **Step 5: Implement final-save wiring**

Do not add reset/re-pinch behavior for the two existing test residents in this task.

- [ ] **Step 6: Run and verify GREEN**

Run: `node --test test/pasture-sheep-maker-v2-ui.test.js test/pasture-live-release.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pasture-live.js test/pasture-sheep-maker-v2-ui.test.js test/pasture-live-release.test.js
git commit -m "feat(pasture): connect sheep maker V2 to 44 plus 1 arrival"
```

### Task 8: Full release gate, preview deployment, and human acceptance

**Files:**
- Modify only if needed for release-contract assertions: `test/pasture-live-release.test.js`
- No production merge in this task until user acceptance.

**Interfaces:**
- Produces: a Vercel preview from the V2 feature branch for manual acceptance.

- [ ] **Step 1: Run the complete pasture test suite**

Run all pasture/auth/resident/V2 tests plus the existing production release gate command.
Expected: all PASS.

- [ ] **Step 2: Verify locked regressions explicitly**

Confirm tests still pin: night scene tint, exact pixel hit, five-finger hand, feet-point placement including bridge/grass edge, river rejection, approved MP3 only, 900 ms cutoff, distance volume, stereo pan.

- [ ] **Step 3: Push feature branch and wait for Vercel preview READY**

Do not promote/merge to production.

- [ ] **Step 4: Manual acceptance checklist**

User verifies: screen 1 feels sufficiently minimal; 8 dimensions are visually understandable without explanatory text; random feels playful but not game-like; sheep remains recognizable at near/far pasture scales; final `✓` saves once; arrival joins 44+1; find/grab/place/night/audio still behave exactly as accepted.

- [ ] **Step 5: Only after explicit user approval, prepare/merge release PR**

Production deployment and final smoke verification are a separate approved release action.
