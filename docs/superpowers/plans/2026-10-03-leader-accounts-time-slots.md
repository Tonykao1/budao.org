# Leader Accounts + Time-based Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every leader an individual first-name login and make the three public Slots a time-based projection rather than publisher identities.

**Architecture:** Authentication sessions carry leader identity. `routes.json` stores a leader-owned route pool. `/api/routes` projects the public top three by event time and serves a private `scope=mine` compatibility view to Tent. Tent keeps its mature form/review flow and changes only the login field plus fetch bridge.

**Tech Stack:** Node.js Vercel functions, browser JavaScript, GitHub-backed JSON persistence, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-03-leader-accounts-time-slots-design.md`

## Global Constraints
- First-name usernames are case-insensitive.
- No plaintext shared password in committed client/server code or tests representing production credentials.
- Authentication/ownership is leader-based; IMS/BACBC/HD are presentation-only.
- Preserve existing Tent visuals/form/review and coworker location entry behavior.
- Preserve same-origin, signed HttpOnly sessions, rate limits and server-side ownership enforcement.

## Review Focus
- Legacy users configured with email/slot records must fail closed or migrate predictably without opening authorization holes.
- Date/time/timezone parsing failures must not reorder valid routes unpredictably.
- A malicious client cannot claim another leader id, username, owner or Slot.
- Multiple leaders publishing concurrently must remain separate in the route pool.
- Logged-in Tent private route loading must not accidentally change the public route response used by the step page.

---

### Task 1: Leader authentication identity

**Files:**
- Modify: `api/_security/auth.js`
- Modify: `api/auth/login.js`
- Modify: `api/auth/session.js`
- Test: `test/security.test.js`

**Interfaces:**
- Consumes: `BUDAO_ADMIN_USERS_JSON`
- Produces: `getAuthenticatedPublisher(request) -> { id, username, role, compatSlot }`; login JSON `{ ok, leader, slot }`

- [ ] Add failing tests for case-insensitive username login, wrong password, and leader claims.
- [ ] Run focused security tests and confirm failure.
- [ ] Implement username-based configuration/session claims while retaining a compatibility `slot: "IMS"` response for mature Tent code.
- [ ] Run focused tests and confirm pass.
- [ ] Commit.

### Task 2: Leader-owned route pool and public time projection

**Files:**
- Modify: `api/publish-route-v2.js`
- Modify: `api/routes.js`
- Test: `test/security.test.js`
- Test: `test/tent-stability.test.js`

**Interfaces:**
- Consumes: authenticated `{ id, username }`
- Produces: persisted route fields `leaderId`, `leader`; public `projectRoutes(routes, now)` semantics; private `scope=mine` view.

- [ ] Add failing tests proving two leaders do not overwrite each other, republish updates only self, public response is chronological top three, and private scope returns only self.
- [ ] Run focused tests and confirm failure.
- [ ] Replace fixed-slot overwrite logic with leader-keyed upsert and event-time projection.
- [ ] Run focused tests and confirm pass.
- [ ] Commit.

### Task 3: Leader-namespaced route images

**Files:**
- Modify: `api/_security/route-image.js`
- Modify: `api/upload-route-image.js`
- Modify: `api/publish-route-v2.js`
- Test: `test/security.test.js`

**Interfaces:**
- Consumes: authenticated leader id/username
- Produces: `route-assets/leaders/<safe-leader-key>/<random>.<ext>` and trusted URL validation.

- [ ] Add failing tests for own-image acceptance and cross-leader rejection.
- [ ] Run focused tests and confirm failure.
- [ ] Implement safe leader namespace with legacy-slot URL compatibility for existing routes.
- [ ] Run focused tests and confirm pass.
- [ ] Commit.

### Task 4: Tent username entry and private route bridge

**Files:**
- Modify: `tent.html`
- Test: `test/tent-stability.test.js`
- Test: `test/security.test.js`

**Interfaces:**
- Consumes: login response `{ leader, slot }`
- Produces: text username input; Tent route reads rewritten to `/api/routes?scope=mine` while public step page continues `/api/routes`.

- [ ] Add failing source-level regression tests for username input and private-scope fetch bridge.
- [ ] Run focused tests and confirm failure.
- [ ] Change only the login label/input semantics and inline fetch bridge; preserve Tent form/review visuals and behavior.
- [ ] Run focused tests and confirm pass.
- [ ] Commit.

### Task 5: Regression verification

**Files:**
- Verify only unless failures require scoped fixes.

- [ ] Run `npm run lint`.
- [ ] Run focused auth/Tent/security tests.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Confirm no committed file contains the production plaintext shared password.
- [ ] Confirm public route API still returns at most three fixed presentation Slots while persisted ownership is leader-based.
