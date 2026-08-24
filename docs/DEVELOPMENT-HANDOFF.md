# Budao Development Handoff (Baseline)

Purpose: provide a single baseline for any AI coding agent or human developer taking over Invitation Foundation work.

1. Current branch
- `feat/invitation-foundation-v1`

2. Invitation Foundation commits (key)
- `a33bace` — immutable snapshot creation
- `c3912a5` — public snapshot reader + permanent /i/{id}
- `b8a7d75` — route to invitation creation flow

3. Current Invitation architecture principles
- Invitation is an independent numeric/object entity
- Permanent URL for each Invitation
- Immutable snapshot stored as JSON
- Route : Invitation = 1:N (routes may have many invitations)
- Tent owns route facts; Invitation owns expression/representation
- Public read endpoint for snapshots; authenticated create endpoint
- QR codes will be decoupled from Participation in future
- Template / Collection / AI are out of scope for Foundation (record only)

4. Files frozen (Phase1A / Phase1B)
The following files were delivered as Phase1A / Phase1B and are considered frozen unless a clear, approved bugfix is required. Do not change these files without explicit coordination.
- `api/create-invitation.js` (Phase1A)
- `api/_security/invitation-schema.js` (Phase1A)
- `test/invitation-foundation.test.js` (Phase1A)
- `api/invitation.js` (Phase1B)
- `invitation.html`, `invitation.js`, `invitation.css` (Phase1B)
- `test/invitation-read.test.js` (Phase1B)
- `vercel.json` rewrite for `/i/:id` (Phase1B)

5. Current tests
- Phase1A: 18 cases
- Phase1B: 17 cases
- Phase1C: 5 behavior tests (client create flow)
- Current `npm test` total: 81
- Standard local verification flow: `npm run lint` → `npm test` → `npm run build` → `git diff --check`

6. Development acceptance checklist (must run before code changes)
- `npm run lint`
- `npm test`
- `npm run build`
- `git diff --check`

Before committing, run and inspect these staging checks:
- `git diff --cached --name-only`
- `git diff --cached --stat`
- `git diff --cached --check`

Rules: do NOT use `git add .` or `git add -A`.

7. Git operation rules (enforced)
- No automatic `git push` by agents
- No automatic `git merge`
- No automatic deploy
- No automatic `git restore` or `git clean`
- Staged files must be explicitly listed in the operation

8. Known isolation issues (do not touch)
- `music/` contains a Unicode-filename deletion in the working tree; do NOT restore or clean it here.
- `worktrees/` is present and untracked; do NOT stage or clean it.

9. Test image resilience
- Image resilience concerns are noted in tests; these are recorded but deferred. Do not attempt side-effect fixes in this handoff baseline.

10. Tent principle
- Tent (route owner) provides facts only. Do not move Invitation expression/creation logic into Tent code.

11. Invitation next-stage roadmap (Phase 2 — recorded, do NOT implement here)
- Collection (grouping of invitations)
- Template (presentation templates)
- Participation Open (broader participation models)
- Presentation customization
- Mode B AI Reconstruction (offline assisted reconstruction)
- Portrait export

12. Invitation frozen product principles
- Page-first experience
- Image is an export/share format, not canonical truth
- Collections inform identity, not definitive truth
- Templates inform hierarchy, not disclosure
- Description tone: calm, restrained (not marketing)
- Participation describes relational entry; QR is a transport mechanism
- AI failures must never cause Invitation failures
- Reconstruct once, adapt many
- Preserve Original ⇄ AI reconstructed mapping
- AI shall not generate brand-sensitive artifacts (text/logo/seal/QR)

13. New-tool handoff checklist (required before code edits)
Run and verify:
- `git branch --show-current`
- `git status --short`
- `git rev-parse HEAD`
- `npm run lint`
- `npm test`
- `npm run build`

Then read this file `docs/DEVELOPMENT-HANDOFF.md` before editing code.

14. Special rule
If any tool determines a change is required to frozen architecture, it MUST stop and report; do NOT apply changes that alter frozen principles without human approval.

After creating or reviewing change candidates, run only:
- `git diff --check`

Do NOT run: `git add`, `git commit`, `git push`, `git deploy`, `git restore`, `git clean` on frozen items.

# Phase 2C Desktop Mode B — FROZEN

Frozen baseline:
`689cacdb905a694e0c69e35a45cb818e3554334f`

## Architecture frozen

- Route : Invitation = 1:N
- Invitation Snapshot is immutable
- Permanent invitation URL remains `/i/{id}`
- Permanent invitation reads Snapshot only
- No `/api/routes` dependency
- No `BudaoActiveRoutes` dependency on permanent invitation
- No Route write-back
- Invitation creation remains authenticated
- Public Snapshot read remains public
- Permanent invitation does not use Canvas
- Legacy Canvas sharing remains separate and preserved

## Desktop Mode B visual baseline frozen

The following desktop visual decisions are approved and must not be casually changed:

- Full digital invitation-space composition
- INVITATION editorial identity
- Destination image scale and position
- Postal perforation treatment
- Postmark treatment
- Route-title scale and hierarchy
- Invitation-intent hierarchy
- Date / time / location presentation
- Meeting Point treatment
- Narrative typography and reading width
- Primary facts treatment
- Secondary details treatment
- QR size and participation treatment
- Budao footer treatment
- Current desktop vertical rhythm

## Change policy

Do not modify the frozen Desktop Mode B baseline merely for subjective visual preference.

Future changes require one of:

1. confirmed functional bug
2. confirmed accessibility/responsive defect
3. explicit new design phase/version
4. deliberate product requirement approved before implementation

Do not silently alter the frozen visual baseline while implementing unrelated features.

## Validation baseline at freeze

- tests: 100 / 100 passed
- lint: PASS
- build: PASS
- git diff --check: PASS
- architecture regression: none found

## Next step

Desktop Mode B is closed for visual iteration.

Next validation target:
Mobile Mode B at 375px and 430px.

Mobile validation must not reopen the frozen desktop design unless a genuine shared responsive defect is discovered.

# Phase 2C Mobile Mode B — FROZEN

## Validation

- 375 × 812: PASS
- 430 × 932: PASS
- no horizontal overflow
- destination image responsive behavior approved
- title hierarchy approved
- schedule/location responsive behavior approved
- Meeting Point responsive behavior approved
- narrative readability approved
- primary facts responsive layout approved
- secondary details responsive layout approved
- participation / QR responsive behavior approved
- footer responsive behavior approved

## Vercel Preview Toolbar note

During Preview validation, a black circular floating control was observed.

It was confirmed to be Vercel Toolbar / Preview Feedback UI injected by the Vercel Preview platform.

It is NOT part of Budao Invitation UI.

Do not add repository CSS or application logic that depends on Vercel private iframe/shadow-DOM selectors merely to hide this Preview-only control.

For visual validation, use Vercel Toolbar's own Hide Toolbar / Disable for Session option where needed.

This is not a production Invitation defect.

## Change policy

Mobile Mode B is now frozen together with Desktop Mode B.

Do not casually modify:
- destination image behavior
- mobile title scale
- schedule/location layout
- Meeting Point
- narrative typography
- facts layout
- QR sizing
- footer
- mobile spacing

Future changes require:
1. confirmed responsive bug
2. confirmed accessibility defect
3. explicit new design phase
4. approved product requirement

## Phase 2C final status

Desktop Mode B: FROZEN
Mobile Mode B: FROZEN

Phase 2C: COMPLETE

## Next phase

Phase 2D — Canvas / Share Artifact Unification

Goal:
make permanent Invitation and generated share artifact use the same Mode B expression language without changing the frozen Snapshot/API architecture.

# Phase 2D.2 Mode B Share Artifact Visual Contract — COMPLETE / FROZEN

Frozen commit:
`f18a183a537052b171b4459bac51039af3b0d8b9`

## Frozen artifact dimensions

- Canvas: 1080 × 1530
- Aspect ratio: 12:17

## Frozen composition

- Warm editorial paper
- Restrained INVITATION identity
- Dominant destination image
- Postal / perforation / postmark language
- Route-title hierarchy
- Invitation intent
- Date / time / location
- Meeting Point
- Bounded narrative
- Route facts
- Participation / QR or closed state
- Budao publication footer

## Frozen typography principle

All actual route data values use the same visual weight: `16px / 600 / #332b24`.

This includes both previously classified primary and secondary data:

- distance
- duration
- difficulty
- suitableFor
- surface
- elevation
- equipment
- weather when available

Labels remain smaller, gray, and subordinate.

## Frozen participation contract

- QR frame: 190 × 190
- QR image: 154 × 154
- QR quiet zone is preserved
- OPEN renders the QR artifact
- CLOSED renders a deterministic closed artifact or stable fallback
- No `Math.random()`
- The renderer does not calculate live registration time

## Frozen renderer architecture

The renderer consumes only:

- Mode B ViewModel
- Explicit `renderState`
- Explicit assets

The renderer must not:

- Read Route directly
- Access `/api/routes`
- Access `BudaoActiveRoutes`
- Access DOM
- Fetch network resources
- Invoke Web Share
- Create or revoke Object URLs
- Use `Date.now()`
- Use `Math.random()`

## Deterministic closed variant

A stable Mode B ViewModel key deterministically selects closed variant `1`, `3`, or `5`, preserving the approved 1:3:5 weighting.

## Validation baseline at freeze

- tests: 141 / 141 / 0
- lint: PASS
- build: PASS
- git diff --check: PASS
- human visual review: APPROVED
- final Kuangou artifact: APPROVED

## Freeze policy

Phase 2D.3 is INTEGRATION ONLY.

Phase 2D.3 may connect the frozen renderer to the existing “分享邀请” workflow, but MUST NOT redesign or visually tune the Phase 2D.2 artifact.

Any future visual modification to the frozen Share Artifact requires an explicit freeze exception.

## Next phase

Phase 2D.3 — Existing Share Flow Integration

Primary objective:
connect the frozen Mode B Share Artifact renderer to the real route-card “分享邀请” flow.

Expected concerns:

- Route selection
- `routeToModeBViewModel()`
- Registration `renderState` calculation
- Asset loading
- Renderer invocation
- Preview lifecycle
- Web Share
- Download fallback
- Object URL cleanup
- Accessibility / focus management

Permanent `/i/{id}` Mode B remains frozen and must not change.

# Phase 2D.3 Existing Share Flow Integration — COMPLETE / FROZEN

Integration commit:
`fd77aea66072726f2defac37b0aafe884eec0f98`

## Frozen architecture and integration contract

- The existing route-card “分享邀请” entry remains the integration entry point.
- The selected Route is converted through `routeToModeBViewModel()` before rendering.
- Live registration state is calculated by the integration layer and passed to the renderer as explicit `renderState`.
- The frozen Mode B Share Artifact renderer consumes only the Mode B ViewModel, explicit `renderState`, and explicit assets.
- OPEN renders the route QR; CLOSED replaces it with the deterministic closed artifact or stable fallback.
- The generated artifact remains a 1080 × 1530 PNG.
- The integration supports Web Share where available and an explicit “下载图片” fallback.
- Phase 2D.3 does not redesign or visually tune the frozen Phase 2D.2 renderer.

Frozen renderer SHA-256:
`44fda8cbff84bfaa310c908e7ae8e34b17880a176f1dc34b2e15b5147ef474cf`

## Object URL lifecycle contract

- At most one active preview Object URL is retained.
- A previous preview Object URL is revoked before replacement.
- The active Object URL is revoked when the preview closes.
- Failed or superseded generation paths clean up any Object URL they created.
- Object URL lifecycle remains the responsibility of the integration layer, not the frozen renderer.

## Accessibility and focus contract

- The preview is exposed as a labelled modal dialog.
- Generation and action states are announced through the existing accessible status treatment.
- Share and download controls reflect unavailable or generating states.
- Focus moves into the preview when it opens and remains contained while the modal is active.
- Escape and the close control dismiss the preview.
- Focus returns to the originating “分享邀请” control after dismissal.

## Automated validation baseline at freeze

- tests: 167 / 167 / 0
- Phase 2D.3 integration tests: 26 / 26 passed
- frozen Mode B renderer tests: 41 / 41 passed
- lint: PASS
- build: PASS
- git diff --check: PASS

## Real-browser validation

Human validation on the Vercel Preview deployment: PASS.

- The real Kuangou Route successfully generated the frozen Mode B Share Artifact.
- The complete `Route → routeToModeBViewModel() → explicit live renderState → frozen renderer` path worked correctly.
- CLOSED registration correctly replaced the QR with a deterministic Dalong stamp.
- Repeated generation of the same Route produced the same `5` Dalong stamp, confirming deterministic closed-variant behavior in real-browser use.
- “下载图片” successfully downloaded the generated PNG.
- The downloaded artifact visually matched the approved and frozen Mode B Share Artifact.
- Artifact dimensions remained 1080 × 1530.

## Architecture unchanged

- Permanent `/i/{id}` Mode B remains unchanged and frozen.
- The frozen Phase 2D.2 renderer and its visual contract remain unchanged.
- Snapshot schema, Snapshot read behavior, API contracts, and Route persistence remain unchanged.
- No Route write-back, `/api/routes` dependency, or `BudaoActiveRoutes` dependency was added to the permanent invitation page.

## Freeze policy

Phase 2D.3 is COMPLETE / FROZEN.

Future changes to the frozen integration contract require an explicit freeze exception. Phase 2D.4 is final regression and release validation, not a reopening of the Phase 2C permanent Mode B design or Phase 2D.2 Share Artifact visual contract.

## Next phase

Phase 2D.4 — Final Regression / Release Validation

Contact: the codebase owner (refer to repo maintainers) for approvals and branch policies.

-- End of DEVELOPMENT-HANDOFF baseline --
