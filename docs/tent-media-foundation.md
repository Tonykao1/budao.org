# 帐篷媒体管理系统 · Phase 1 foundation
Status: development only. No production migration or public release.
## Architecture
Reuse getAuthenticatedPublisher and isSteward, same-origin checks and server-side ownership, not client flags. Desktop Tent and mobile Tent share one API. Preserve existing campfire archive IDs, quotes, hero selection and watermark paths. Route covers are not documentary images.
## Storage boundary
The repository is public: never upload draft bytes or originals to it. Existing upload-route-image is unsuitable for unpublished media. Configure a private object store with short-lived authenticated upload/download, server-side image decoding and re-encoding, metadata stripping, hash verification, quota and retention. No public URL until approved. Do not reuse the public GitHub route image upload. 
## Lifecycle
Draft → submitted → approved → publishing → published. Steward may return submitted albums or withdraw. Album and asset approval are separate; explicit consent required, especially for minors. Owner and reviewer identity are derived from session. All mutations use transactional revision checks and audit entries. Published edits require a new reviewed revision; preserve stable photo IDs. 
## Release adapter
Generate watermarked display copy per existing campfire editorial guide; retain authorized master only in private storage. Atomically publish sanitized approved assets and archive metadata (including publishedOn), preserve legacy quotes and IDs; update whats-new via existing archive feed. Verify public assets and deployment before marking published. Withdrawal must remove public references and copies, check CDN and public Git history implications; disclose that already downloaded copies cannot be recalled. Prefer revocable public storage rather than Git history for new personal imagery.
## Acceptance gates
Unauthenticated 401; other owner denied; non-steward review denied; origin checks; no draft public access; upload size/type/decode limits; dedup; revision conflicts; audit; 12-function Vercel budget; desktop/mobile actual account; old archive and hero/lightscreen regressions; release and withdrawal recovery. No production migration until storage and release adapters are implemented and validated.
## Current scope
Additive SQL and isolated policy module only. No endpoint, UI, storage credentials, migration invocation or deployment in this phase. 
