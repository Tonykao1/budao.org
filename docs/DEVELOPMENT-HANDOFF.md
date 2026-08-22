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

Contact: the codebase owner (refer to repo maintainers) for approvals and branch policies.

-- End of DEVELOPMENT-HANDOFF baseline --
