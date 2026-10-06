# Digital Pasture Login Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable login/session/daily-sheep-position infrastructure to the existing Digital Pasture without replacing or regressing any previously approved pasture UI or behavior.

**Architecture:** Keep `/api/pasture-auth` and the existing `pasture_users` / `pasture_sessions` / `pasture_sheep` model. Add one daily-position table keyed by user + date + orientation mode, expose two authenticated position actions, move the resident runtime to use server state as source of truth, and integrate only identity/state into the already-approved pasture mother UI instead of rebuilding UI in the resident runtime.

**Tech Stack:** Node.js, Vercel Functions, PostgreSQL, Drizzle ORM, browser JavaScript, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-06-pasture-login-foundation-design.md`

## Global Constraints

- **Only additions, no replacements:** approved pasture UI is a frozen mother version.
- Preserve the approved sky seven-button zone, identity/avatar card, shop, private drawer, Budao card, unified `收起 ×`, weather/day-night/moon, 44 base sheep, landscape/portrait layouts, return twig, five-finger hand, drag/drop, and `pasture-preview/assets/baaa01.mp3`.
- Same normalized email must always resolve to one `pasture_user.id`.
- One user can have only one permanent sheep identity/appearance.
- Session maximum age is **365 days**; session expiry never deletes user or sheep data.
- First-time user with no sheep enters the sheep-creation flow; returning user with an existing sheep skips creation.
- Personal sheep identity and appearance are permanent; position is **daily**.
- Same user + same date + same mode has one stable position; next date generates a new position.
- Daily date key uses the pasture environment timezone; fallback is `Asia/Shanghai`.
- `localStorage` may cache daily position but must not be source of truth.
- Position APIs must derive `user_id` from the authenticated session and never trust a client-supplied user id.
- Guest sees the 44 base sheep and no authenticated feature controls; authenticated user sees 44 + self and the already-approved mother UI.

## Review Focus

- A refresh after verification but before sheep creation must resume as authenticated with `needsSheep=true`, not create another account.
- Repeated `saveSheep` requests must update/return the same sheep row and never create a second sheep.
- Same-day access from a second device must return the server-saved position, while next-day access must create/use a different date-key row.
- Invalid or stale session cookies must degrade to guest state without destroying permanent user/sheep records.
- Login/runtime integration must not hide, recreate, restyle, or relocate any approved mother-UI asset.

---

### Task 1: Lock regression protection around the approved pasture mother UI

**Files:**
- Modify: `test/pasture-ui-restore.test.js`
- Create: `test/pasture-login-additive-regression.test.js`
- Read-only reference: approved full-function pasture source(s) already present in the branch/library history

**Interfaces:**
- Consumes: current `tonglu.html`, `pasture-resident-runtime*.js`, approved mother UI identifiers/styles.
- Produces: regression tests that fail whenever login work replaces or removes protected UI assets.

- [ ] **Step 1: Replace the obsolete bottom-toolbar expectation** in `test/pasture-ui-restore.test.js` with assertions for the approved sky function zone: top/sky placement, four columns desktop, two columns mobile, approved cream/deep-blue/green palette, and the seven approved labels.

- [ ] **Step 2: Write additive-regression tests** asserting that login runtime code does not dynamically create replacement versions of the identity card, shop, private drawer, Budao card, or unified close controls.

- [ ] **Step 3: Add protected-asset presence assertions** for the mother UI hooks that the runtime is allowed to populate but not recreate.

- [ ] **Step 4: Run the focused tests**

Run: `node --test test/pasture-ui-restore.test.js test/pasture-login-additive-regression.test.js`
Expected: existing incorrect assumptions fail before implementation; revised protection tests pass against the selected mother UI baseline.

- [ ] **Step 5: Commit**

```bash
git add test/pasture-ui-restore.test.js test/pasture-login-additive-regression.test.js
git commit -m "test(pasture): lock additive login regression rules"
```

### Task 2: Extend session lifetime to 365 days without changing identity semantics

**Files:**
- Modify: `api/_security/pasture-auth-domain.js`
- Modify: `test/pasture-registration-backend.test.js`

**Interfaces:**
- Produces: `SESSION_TTL_SECONDS = 60 * 60 * 24 * 365` and cookie serialization with matching `Max-Age`.

- [ ] **Step 1: Write a failing test** asserting session TTL and `Max-Age` equal 365 days and preserving `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`.

- [ ] **Step 2: Run the focused test**

Run: `node --test test/pasture-registration-backend.test.js`
Expected: FAIL on current 180-day value.

- [ ] **Step 3: Change only `SESSION_TTL_SECONDS`** in `api/_security/pasture-auth-domain.js` to 365 days.

- [ ] **Step 4: Run the focused test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_security/pasture-auth-domain.js test/pasture-registration-backend.test.js
git commit -m "feat(pasture): keep sessions for one year"
```

### Task 3: Add daily sheep position persistence

**Files:**
- Create: `db/migrations/0007_pasture_sheep_daily_positions.sql`
- Modify: `db/schema.js`
- Modify: `api/_security/pasture-auth-store.js`
- Modify: `test/pasture-registration-backend.test.js`

**Interfaces:**
- Produces: table `pasture_sheep_daily_positions` with unique `(user_id, date_key, mode)`.
- Produces store functions:
  - `dailyPositionForUser(userId, dateKey, mode) -> row|null`
  - `upsertDailyPosition(userId, dateKey, mode, position) -> row`

- [ ] **Step 1: Write failing schema/store tests** asserting one row per user/date/mode and upsert behavior.

- [ ] **Step 2: Run the focused backend tests** and confirm failure because the table/store APIs do not yet exist.

- [ ] **Step 3: Add migration `0007`** with fields `id`, `user_id`, `date_key`, `mode`, `x`, `y`, `flip`, `created_at`, `updated_at`; constrain mode to `landscape|portrait`; add unique index on `(user_id,date_key,mode)`.

- [ ] **Step 4: Add Drizzle schema mapping** for the new table without changing existing pasture tables.

- [ ] **Step 5: Add the two store functions** and export them from `pasture-auth-store.js`; use upsert on the composite unique key.

- [ ] **Step 6: Run focused tests**

Run: `node --test test/pasture-registration-backend.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add db/migrations/0007_pasture_sheep_daily_positions.sql db/schema.js api/_security/pasture-auth-store.js test/pasture-registration-backend.test.js
git commit -m "feat(pasture): persist daily resident sheep positions"
```

### Task 4: Add deterministic daily position domain logic

**Files:**
- Create: `api/_security/pasture-position-domain.js`
- Create: `test/pasture-position-domain.test.js`

**Interfaces:**
- Produces:
  - `normalizeMode(value) -> 'landscape'|'portrait'`
  - `validateDateKey(value) -> string`
  - `validatePosition(mode, input) -> {x,y,flip}`
  - `seedForDailyPosition(userId, dateKey, mode) -> uint32`
  - `generateDailyPosition(userId, dateKey, mode, context?) -> {x,y,flip}`
- The generator must be deterministic for identical inputs and return only visible/non-forbidden candidate positions.

- [ ] **Step 1: Write failing tests** for invalid mode/date/coordinates, deterministic same-day output, different-day output, and visible range guarantees for both orientations.

- [ ] **Step 2: Run the new test**

Run: `node --test test/pasture-position-domain.test.js`
Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement minimal pure domain functions** using a deterministic hash of `userId:dateKey:mode`; encode current river/bridge/visible-area restrictions as pure candidate validation rather than browser-only state.

- [ ] **Step 4: Run the new test**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add api/_security/pasture-position-domain.js test/pasture-position-domain.test.js
git commit -m "feat(pasture): add deterministic daily sheep placement"
```

### Task 5: Expose authenticated daily-position actions through `/api/pasture-auth`

**Files:**
- Modify: `api/_security/pasture-auth-handler.js`
- Modify: `test/pasture-registration-backend.test.js`

**Interfaces:**
- Adds action `getDailySheepPosition` with `{dateKey, mode}`.
- Adds action `saveDailySheepPosition` with `{dateKey, mode, x, y, flip}`.
- Both derive user id from session; neither accepts a client user id.

- [ ] **Step 1: Write failing handler tests** for unauthenticated access, first read creates a row, repeated read returns same row, save updates the same row, invalid mode/date/coordinates reject, and supplied fake `userId` is ignored.

- [ ] **Step 2: Run focused backend tests** and confirm new actions fail as unknown.

- [ ] **Step 3: Add `getDailySheepPosition`**: authenticate, validate date/mode, read row, deterministically generate + persist if absent, return normalized position.

- [ ] **Step 4: Add `saveDailySheepPosition`**: authenticate, validate all inputs server-side, upsert only the authenticated resident's row, return normalized position.

- [ ] **Step 5: Run focused backend tests**

Run: `node --test test/pasture-registration-backend.test.js test/pasture-position-domain.test.js`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/_security/pasture-auth-handler.js test/pasture-registration-backend.test.js
git commit -m "feat(pasture): add daily sheep position api"
```

### Task 6: Make server position the resident runtime source of truth

**Files:**
- Modify: `pasture-resident-runtime-core.js`
- Modify: `pasture-resident-findability-guard.js`
- Modify: `pasture-resident-saved-bridge.js`
- Modify: `test/pasture-registration-frontend.test.js`
- Modify: `test/pasture-resident-findability.test.js`

**Interfaces:**
- Consumes the two new pasture-auth actions.
- Produces client helpers:
  - `loadDailyResidentPosition(dateKey, mode)`
  - `saveDailyResidentPosition(dateKey, mode, layout)`
- `localStorage` remains cache only; API response wins whenever available.

- [ ] **Step 1: Write failing frontend tests** asserting server-first load, cache fallback only on transient fetch failure, and save-on-drop behavior.

- [ ] **Step 2: Write refresh-resume tests** for authenticated `needsSheep=true` and authenticated existing-sheep flows.

- [ ] **Step 3: Run focused frontend tests** and confirm failure on current local-only position behavior.

- [ ] **Step 4: Implement server-first daily position loading** using the same pasture timezone/date key already used by the environment; do not derive a separate VPN/browser-local day.

- [ ] **Step 5: Persist drag/drop position** after successful placement; keep local cache synchronized only after server success or as explicitly-marked temporary fallback.

- [ ] **Step 6: Keep findability guard as a safety validator, not the authoritative position store**; if it must relocate an invalid server candidate, immediately persist the corrected location.

- [ ] **Step 7: Run focused frontend tests**

Run: `node --test test/pasture-registration-frontend.test.js test/pasture-resident-findability.test.js`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add pasture-resident-runtime-core.js pasture-resident-findability-guard.js pasture-resident-saved-bridge.js test/pasture-registration-frontend.test.js test/pasture-resident-findability.test.js
git commit -m "feat(pasture): sync resident sheep position across devices"
```

### Task 7: Convert resident runtime from replacement UI to additive identity/state adapter

**Files:**
- Modify: `pasture-resident-runtime-core.js`
- Modify or remove replacement behavior from: `pasture-resident-ui-restore.js`
- Modify: `tonglu.html`
- Modify: `test/pasture-login-additive-regression.test.js`
- Modify: `test/pasture-registration-frontend.test.js`

**Interfaces:**
- Produces a small integration contract on the mother UI, preferably CustomEvents/state such as:
  - `pasture-auth-state` detail `{user, authenticated, needsSheep}`
  - `pasture-resident-updated` detail `{sheep, dailyPosition}`
- Runtime may populate approved identity slots and toggle approved authenticated regions; it must not create replacement UI components.

- [ ] **Step 1: Write failing tests** proving the runtime no longer creates seven action buttons, replacement identity card, shop, private drawer, Budao card, or close controls.

- [ ] **Step 2: Write mother-UI integration tests** proving guest hides only authenticated controls and login reveals the existing approved controls without altering their DOM/style identity.

- [ ] **Step 3: Run focused tests** and confirm current replacement-runtime behavior fails them.

- [ ] **Step 4: Refactor resident runtime to state/identity adapter only**; dispatch auth/resident state into the existing mother UI.

- [ ] **Step 5: Remove the temporary UI-reconstruction responsibilities from `pasture-resident-ui-restore.js`** while preserving the five-finger cursor behavior if that code still owns it; split cursor-only behavior to a focused file if needed rather than keeping UI replacement code alive.

- [ ] **Step 6: Run focused additive-regression and frontend tests**

Run: `node --test test/pasture-login-additive-regression.test.js test/pasture-ui-restore.test.js test/pasture-registration-frontend.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add pasture-resident-runtime-core.js pasture-resident-ui-restore.js tonglu.html test/pasture-login-additive-regression.test.js test/pasture-ui-restore.test.js test/pasture-registration-frontend.test.js
git commit -m "refactor(pasture): make login runtime additive"
```

### Task 8: Wire approved identity/avatar state without redesign

**Files:**
- Modify only the existing mother UI file(s) that already own the approved identity/avatar card.
- Modify: `test/pasture-login-additive-regression.test.js`

**Interfaces:**
- Consumes `pasture-auth-state` / resident data.
- Populates existing approved avatar/identity content from `resident_id`, sheep appearance, and existing display fields only.
- Preserves the existing formal entry relation for `小匣`.

- [ ] **Step 1: Write failing tests** asserting the existing identity card receives authenticated resident data and its existing `小匣` entry still works.

- [ ] **Step 2: Implement data binding only**; do not change layout, labels, palette, icons, or close behavior.

- [ ] **Step 3: Run additive-regression tests**

Run: `node --test test/pasture-login-additive-regression.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add <mother-ui-files> test/pasture-login-additive-regression.test.js
git commit -m "feat(pasture): bind resident identity to approved avatar card"
```

### Task 9: Verify first-login, returning-login, logout, and cross-device semantics

**Files:**
- Modify: `test/pasture-registration-backend.test.js`
- Modify: `test/pasture-registration-frontend.test.js`
- Create: `test/pasture-login-integration.test.js`

**Interfaces:**
- End-to-end contract over existing auth handler/runtime without requiring production secrets in tests.

- [ ] **Step 1: Add first-user integration test**: verify code -> `needsSheep:true` -> save sheep -> one permanent sheep row -> daily position created.

- [ ] **Step 2: Add returning-user integration test**: same email -> same user id -> `needsSheep:false` -> same sheep appearance -> no creation UI.

- [ ] **Step 3: Add same-day second-device test** using a separate session token for the same user and asserting same saved daily position.

- [ ] **Step 4: Add next-day test** asserting a distinct date-key row and a newly generated daily position.

- [ ] **Step 5: Add logout test** asserting session revocation, guest UI state, removal of only the 45th sheep from view, and persistence of user/sheep/daily records.

- [ ] **Step 6: Run integration tests**

Run: `node --test test/pasture-login-integration.test.js test/pasture-registration-backend.test.js test/pasture-registration-frontend.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add test/pasture-login-integration.test.js test/pasture-registration-backend.test.js test/pasture-registration-frontend.test.js
git commit -m "test(pasture): cover durable login and daily sheep flow"
```

### Task 10: Full regression, CI, and preview verification

**Files:**
- Modify only if required: `.github/workflows/pasture-registration-integration.yml`
- No product behavior changes in this task unless a failing regression exposes a defect.

**Interfaces:**
- Produces verified branch suitable for Tony's live-device review.

- [ ] **Step 1: Run all pasture tests**

Run: `node --test test/pasture-*.test.js tests/pasture-*.test.js`
Expected: PASS, zero failures.

- [ ] **Step 2: Run the project security/build checks already defined in `package.json` / CI** and record exact outputs.

- [ ] **Step 3: Confirm database migration ordering** from `0001` through `0007` and verify `0007` is additive only.

- [ ] **Step 4: Deploy/obtain the branch Preview** and verify HTTP 200 for `tonglu.html`, auth runtime assets, and `/api/pasture-auth` GET.

- [ ] **Step 5: Perform manual preview regression checklist** on desktop and portrait/mobile: approved sky controls, approved avatar/identity, shop, private drawer, Budao card, unified `收起 ×`, weather/day-night/moon, 44 guest sheep, 45 authenticated sheep, five-finger exact-pixel hand, drag/drop sound, return twig.

- [ ] **Step 6: Verify auth flows in Preview**: guest -> request code -> verify -> first-user creation; returning-user direct entry; refresh persistence; logout; same-day position consistency.

- [ ] **Step 7: Only after all checks pass, present the Preview for acceptance**. Do not claim G1 complete until Tony confirms actual-device behavior.

- [ ] **Step 8: Commit any CI-only adjustment if needed**

```bash
git add .github/workflows/pasture-registration-integration.yml
git commit -m "ci(pasture): enforce login foundation regressions"
```
