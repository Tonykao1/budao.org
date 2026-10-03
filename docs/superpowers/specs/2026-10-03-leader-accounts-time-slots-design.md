# Leader Accounts + Time-based Slots Design

## Goal
Replace the fixed IMS/BACBC/HD publisher identity model with individual leader accounts while preserving the existing Tent route form, location-entry flow, and three-card public Slot presentation.

## Confirmed product rules
- Each leader logs in with their English first name. Usernames are case-insensitive; `tony`, `Tony`, and `TONY` are the same identity.
- The common initial password is configured server-side only as a scrypt hash. No plaintext shared password may appear in client assets or committed credential configuration.
- Clicking a leader's location on the coworker page continues to enter `/tent.html`; the visual coworker/location interaction is unchanged.
- A leader enters Tent, fills the existing route form, and publishes through the existing review/publish flow.
- Publisher identity is the leader, not IMS/BACBC/HD.
- Public IMS/BACBC/HD values become presentation slots only. They are assigned to routes by event time and never define authentication identity.
- Existing route image, QR, invitation, calendar-footprint and mobile ordering behavior should remain compatible.

## Architecture
### Authentication
`BUDAO_ADMIN_USERS_JSON` stores leader records with `id`, `username`, `passwordHash` and optional compatibility metadata. Authentication normalizes usernames to lowercase. The signed session contains the stable leader id and username. A compatibility slot value may remain in the session temporarily for legacy Tent/image code, but authorization and ownership must use leader id/username.

### Tent compatibility bridge
The existing Tent UI is intentionally preserved. Tent login accepts a username rather than an email. The inline Tent fetch bridge requests the leader's own route using `GET /api/routes?scope=mine`, allowing legacy form-loading code to receive that route through a compatibility display slot without changing the mature form/review code.

### Route ownership
Published route records carry stable `leaderId` and `leader` fields supplied by the authenticated server session. Client-supplied owner/slot values remain rejected/ignored. A leader update matches that leader's existing route rather than matching a fixed slot.

### Public Slot projection
`GET /api/routes` reads the full route pool, calculates event instants from `date + time + timezone`, and projects up to three routes into presentation slots `IMS`, `BACBC`, `HD` in chronological order. Upcoming routes are selected first, soonest first. If fewer than three upcoming routes exist, the most recent past routes fill remaining cards. The projection changes at read time, so Slot ordering does not become stale when time passes.

### Route persistence
`routes.json` becomes the route pool rather than a fixed three-element slot array. Publishing one leader's route must not overwrite another leader's route. Existing legacy slot-owned records remain readable during migration.

### Images
Managed route images are namespaced by authenticated leader id/username rather than public presentation slot. Existing legacy slot image URLs remain accepted for routes that already contain them.

## Compatibility and migration
- Existing IMS/BACBC/HD routes are preserved and migrated lazily; no destructive bulk rewrite is required before launch.
- Public consumers continue receiving three objects with `slot` values IMS/BACBC/HD.
- Tent's local drafts remain browser-local and non-authoritative.
- Existing security behavior (HttpOnly signed sessions, same-origin POST, rate limits, no client-side secret) remains mandatory.

## Tests
- Case-insensitive first-name login succeeds and wrong password fails.
- Session identity exposes leader id/username and cannot be forged by a client.
- Two different leaders can publish without overwriting each other.
- A leader republishes/updates their own route without creating a duplicate.
- Public route projection returns at most three routes in event-time order with fixed presentation Slot labels.
- `scope=mine` returns only the authenticated leader's route and rejects/returns empty for unauthenticated callers.
- Managed image paths are leader-namespaced and reject another leader's managed URL.
- Client assets contain no plaintext shared password.
