# Pasture Sky Engine v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pasture's fixed decorative stars and split sun/moon logic with one tested sky engine that renders the real Sun, Moon, and all stars of visual magnitude <= +3.0 inside the pasture's true sky band, centered on the great-circle bearing to Jerusalem.

**Architecture:** Add one browser/Node-compatible pure module for astronomy, projection, visibility, and star-state generation, plus one small local star catalog. `tonglu.html` owns location/weather and computes one shared `skyState`; landscape and portrait renderers consume that same state and differ only in canvas geometry. The existing pasture scenery, sheep, river, waterfall, sea, mountains, location priority, and 10-minute weather refresh remain untouched.

**Tech Stack:** Browser JavaScript, Canvas 2D, CommonJS/UMD-compatible pure modules, Node.js built-in test runner (`node:test`), existing Open-Meteo weather feed.

**Spec:** `docs/superpowers/specs/2026-10-05-pasture-sky-engine-v1-design.md`

## Global Constraints
- Center view on the initial great-circle bearing from the current pasture location to Jerusalem at approximately 31.77 N, 35.21 E.
- Horizontal FOV is 180 degrees; vertical FOV is 90 degrees.
- The dark-blue top band is the only celestial drawing region. The light blue-gray band between sky and mountains is sea and must never contain Sun, Moon, or stars.
- On the 480x300 landscape composition, the confirmed sea-sky boundary is `y = 96`; do not reuse the current approximate `skyBand=103` moon mapping.
- For responsive portrait composition, derive the celestial bottom boundary from the same scene geometry that draws the top sky band; do not infer it from mountain height.
- Altitude 0 degrees maps exactly to the sea-sky boundary; altitude 90 degrees maps to the top edge.
- Only stars with true visual magnitude `<= +3.0` are eligible. Preserve continuous magnitude internally and group visually as 0/1/2/3 magnitude layers.
- No star names, constellation names, constellation lines, astronomy labels, compass labels, astrology, planets, Milky Way, meteors, comets, dragging, or device-compass view control in v1.
- Sun, Moon, and stars must use one altitude/azimuth coordinate system and one Jerusalem-centered projection.
- Landscape and portrait must consume the same computed celestial state for the same location/time.
- Weather refresh stays at 600000 ms; celestial state refresh should be 30-60 seconds, not every 120 ms animation frame.
- Do not change sheep, lamb, river, waterfall, bridge, sea, mountains, pasture scenery, return-twig behavior, location priority, or unrelated UI.
- Do not add a third-party astronomy API or runtime dependency.

## Review Focus
- Longitude wrap and Jerusalem-bearing wrap near 0/360 degrees must not mirror the sky or reject valid objects near the left/right FOV edge.
- Locations at high latitude and invalid/missing coordinates must return finite safe state or fail closed without corrupting rendering.
- A celestial object at altitude exactly 0 or a projected y at/under the sea-sky boundary must not draw into the sea.
- Full Moon near a star must suppress faint stars locally more than equally faint stars far from the Moon, without hiding bright 0-magnitude stars globally.
- Switching landscape/portrait at the same timestamp must preserve celestial identity/visibility even though x/y pixel coordinates change.

---

### Task 1: Pure astronomy core and Jerusalem-centered projection

**Files:**
- Create: `pasture-sky-engine.js`
- Create: `test/pasture-sky-engine.test.js`

**Interfaces:**
- Produces: `initialBearingDegrees(lat1, lon1, lat2, lon2) -> number`
- Produces: `equatorialToHorizontal({ ra, dec, timeMs, latitude, longitude }) -> { altitudeDeg, azimuthDeg }`
- Produces: `sunEphemeris({ timeMs, latitude, longitude }) -> { altitudeDeg, azimuthDeg, ra, dec }`
- Produces: `moonEphemeris({ timeMs, latitude, longitude }) -> { altitudeDeg, azimuthDeg, ra, dec, phase, illumination, lightX, lightY }`
- Produces: `projectHorizontal({ altitudeDeg, azimuthDeg, centerAzimuthDeg, width, skyTop, skyBottom }) -> null | { x, y, relativeAzimuthDeg }`
- Browser global: `window.BudaoPastureSky`; Node export: `module.exports`.

- [ ] **Step 1: Write failing astronomy/projection tests** for finite Jerusalem bearings from representative east/west locations, azimuth wrap across north, altitude `<= 0` rejection, relative azimuth outside `[-90,+90]` rejection, altitude `0 -> skyBottom`, altitude `90 -> skyTop`, and all returned coordinates remaining finite.
- [ ] **Step 2: Run focused test**: `node --test test/pasture-sky-engine.test.js`; expected FAIL because `pasture-sky-engine.js` does not exist.
- [ ] **Step 3: Implement the pure UMD/CommonJS astronomy core** using UTC time and deterministic trigonometric calculations. Port the already-approved lunar ephemeris/bright-limb math out of `tonglu.html`, and add the Sun to the same coordinate system.
- [ ] **Step 4: Implement Jerusalem-centered 180 x 90 projection** with a monotonic, symmetric, gently compressed horizontal mapping; central ~60 degrees should remain closest to linear and edges must not become fisheye-like. Keep the projection pure and canvas-independent.
- [ ] **Step 5: Run focused test** and confirm PASS.
- [ ] **Step 6: Commit** `pasture-sky-engine.js` and its test.

### Task 2: Local 0-3 magnitude star catalog and real star positions

**Files:**
- Create: `pasture-stars.js`
- Modify: `pasture-sky-engine.js`
- Modify: `test/pasture-sky-engine.test.js`

**Interfaces:**
- `pasture-stars.js` produces a read-only array of `{ id, ra, dec, visualMagnitude, colorIndex }` for every catalog entry with `visualMagnitude <= 3.0`.
- `pasture-sky-engine.js` produces: `computeStarHorizontals({ timeMs, latitude, longitude, stars }) -> Array<star & { altitudeDeg, azimuthDeg }>`.

- [ ] **Step 1: Add failing catalog tests** asserting the catalog is non-empty, every entry has finite RA/Dec/magnitude, no entry exceeds `+3.0`, negative/zero magnitudes are preserved rather than rounded to a class, and no UI-facing `name`/`constellation` property is required.
- [ ] **Step 2: Add failing positional tests** proving a fixed catalog star changes horizontal position as time changes and is deterministic for the same time/location.
- [ ] **Step 3: Run focused test** and confirm FAIL.
- [ ] **Step 4: Add the compact local star catalog** from a reputable static astronomical catalog, storing only the fields needed by v1 and documenting the source/provenance in comments without surfacing names in the UI.
- [ ] **Step 5: Implement star RA/Dec -> local altitude/azimuth** through the same `equatorialToHorizontal` function used by the shared engine.
- [ ] **Step 6: Run focused test** and confirm PASS.
- [ ] **Step 7: Commit** catalog + star-position support.

### Task 3: Continuous visibility, local moonlight, atmosphere, and deterministic cloud field

**Files:**
- Modify: `pasture-sky-engine.js`
- Modify: `test/pasture-sky-engine.test.js`

**Interfaces:**
- Produces: `twilightFactor(sunAltitudeDeg, visualMagnitude) -> 0..1`
- Produces: `atmosphericFactor(altitudeDeg) -> 0..1`
- Produces: `moonlightFactor({ visualMagnitude, starAltitudeDeg, starAzimuthDeg, moon }) -> 0..1`
- Produces: `cloudOpacityAt({ xNorm, yNorm, cloudCover, weatherCode, timeMs }) -> 0..1`
- Produces: `starVisibility({...}) -> 0..1`
- Produces: `starTwinkle({ visibility, altitudeDeg, visualMagnitude, timeMs, seed }) -> brightnessMultiplier` without changing x/y.

- [ ] **Step 1: Add failing twilight tests** pinning the approved transitions: no stars above Sun altitude -4 degrees; 0-mag can emerge from -4 to -6; 1-mag after that; 2-mag by -9 to -12; 3-mag only beginning -12 to -15; full night at <= -15.
- [ ] **Step 2: Add failing atmospheric tests** proving 2-3 degree altitude is strongly dimmer than >25 degrees and altitude <=0 is invisible.
- [ ] **Step 3: Add failing moonlight tests** proving faint stars near a high, bright/full Moon are suppressed more than equally faint far-away stars, while a new/below-horizon Moon has negligible effect and 0-mag stars remain substantially more robust.
- [ ] **Step 4: Add failing cloud-field tests** proving opacity is spatially local, deterministic for the same time bucket, moves smoothly with time, increases statistically with cloud cover, and rain/snow/fog force high effective cover without using a whole-screen star-off threshold.
- [ ] **Step 5: Run focused test** and confirm FAIL.
- [ ] **Step 6: Implement the visibility functions** as continuous multipliers. Keep cloud field low-resolution/deterministic so the same state can be sampled by both renderers.
- [ ] **Step 7: Implement twinkle as brightness-only modulation** with stronger amplitude near the horizon; never modify projected x/y and never randomly toggle star existence.
- [ ] **Step 8: Run focused test** and confirm PASS.
- [ ] **Step 9: Commit** visibility and cloud model.

### Task 4: Shared `skyState` generation and landscape integration

**Files:**
- Modify: `pasture-sky-engine.js`
- Modify: `tonglu.html`
- Create: `test/pasture-sky-integration.test.js`

**Interfaces:**
- `pasture-sky-engine.js` produces: `computeSkyState({ timeMs, latitude, longitude, cloudCover, weatherCode, stars }) -> { computedAt, centerAzimuthDeg, sun, moon, stars }`.
- `tonglu.html` stores one `skyState` refreshed every 30-60 seconds and renders it into landscape using `{ width:480, skyTop:0, skyBottom:96 }`.
- Existing `state` remains the source of location/weather and retains the 10-minute weather refresh.

- [ ] **Step 1: Add failing source/integration tests** asserting `tonglu.html` loads `pasture-stars.js` and `pasture-sky-engine.js`, no longer contains the fixed coordinate `stars(darkness,cloud)` list, and does not use the old `moonScreenPosition(... skyBand=103 ...)` path.
- [ ] **Step 2: Add failing geometry tests** asserting all celestial render calls in landscape are clipped/mapped to y `< 96`, and y `>= 96` is treated as sea/non-celestial space.
- [ ] **Step 3: Add failing cadence tests** asserting celestial ephemerides are cached/refreshed on a 30-60 second timer rather than recalculated in the 120 ms animation loop; the existing `setInterval(refresh,600000)` weather cadence remains present.
- [ ] **Step 4: Run** `node --test test/pasture-sky-engine.test.js test/pasture-sky-integration.test.js`; expected FAIL.
- [ ] **Step 5: Load the new modules before the current inline pasture environment script** and compute one Jerusalem-centered `skyState` after location/weather state becomes available.
- [ ] **Step 6: Replace landscape fixed stars and independent Sun/Moon trajectories** with renderers consuming projected Sun, Moon, and star data from `skyState`. Preserve current pixel language: 0-mag brightest with only subtle halo; 1/2/3 progressively smaller/dimmer; B-V reduced to subtle cool/neutral/warm whites.
- [ ] **Step 7: Keep clouds/weather FX visually unchanged outside the minimum hooks needed for star occlusion.** Do not edit pasture iframe files or animal/scenery code in this task.
- [ ] **Step 8: Run focused tests** and confirm PASS.
- [ ] **Step 9: Commit** landscape integration.

### Task 5: Portrait consumes the identical celestial state

**Files:**
- Modify: `tonglu.html`
- Modify: `tonglu-pasture-portrait.html`
- Modify: `test/pasture-sky-integration.test.js`

**Interfaces:**
- Parent message `tonglu-environment-v1` adds `skyState` generated once by the parent.
- Portrait renderer consumes parent `skyState`; it does not independently recompute Sun/Moon/star ephemerides.
- Portrait projection calls the same `BudaoPastureSky.projectHorizontal(...)` with portrait canvas width and the portrait scene's exact top-sky boundary.

- [ ] **Step 1: Add failing tests** asserting the parent payload contains `skyState`, portrait no longer owns a separate moon/sun/star astronomy implementation, and both orientations use the same engine module.
- [ ] **Step 2: Add a same-state projection test** proving landscape and portrait receive the same star IDs, visibility values, Sun/Moon altitude/azimuth, and Jerusalem center bearing; only screen x/y geometry may differ.
- [ ] **Step 3: Add sea-boundary tests** for portrait: the bottom of the top dark-blue sky region, not the mountain line and not `H*.28` by assumption, is passed as `skyBottom`; celestial y must stay above it.
- [ ] **Step 4: Run focused integration tests** and confirm FAIL.
- [ ] **Step 5: Extend the parent environment message with `skyState`** and load the shared engine in portrait.
- [ ] **Step 6: Replace portrait's duplicate astronomy/render positioning logic** with the shared state and common projection/visibility outputs, preserving portrait pasture/scenery/animals exactly.
- [ ] **Step 7: Run focused tests** and confirm PASS.
- [ ] **Step 8: Commit** portrait unification.

### Task 6: Visual regression, full tests, and production verification

**Files:**
- Modify only if a scoped regression fix is required: `tonglu.html`, `tonglu-pasture-portrait.html`, `pasture-sky-engine.js`, `pasture-stars.js`, tests.
- Optionally modify: `package.json` to include new pure modules in `lint` and sky tests in the normal test command if that is consistent with the existing suite.

**Interfaces:**
- No new public interface; this task verifies the shipped behavior.

- [ ] **Step 1: Run syntax checks**: `node --check pasture-sky-engine.js` and `node --check pasture-stars.js`.
- [ ] **Step 2: Run sky tests**: `node --test test/pasture-sky-engine.test.js test/pasture-sky-integration.test.js`; expected all PASS.
- [ ] **Step 3: Run existing regression suite**: `npm test`; expected PASS.
- [ ] **Step 4: Run** `npm run lint` and `npm run build`; expected PASS.
- [ ] **Step 5: Diff review** must confirm no unintended changes to sheep/lamb placement, river/waterfall/bridge code, sea color/geometry, mountains, return twig, login/buttons, location fallback priority, or weather refresh cadence.
- [ ] **Step 6: Browser visual QA in landscape** at controlled time/location states: verify sky objects remain entirely above the dark-blue/light-sea boundary; verify no stars render in sea/mountains/pasture; verify twilight progression, clear dark sky, full Moon local suppression, heavy clouds, and Moon/Sun placement.
- [ ] **Step 7: Browser visual QA in portrait using the same controlled state** and verify the same celestial objects/visibility are present as landscape, with only projection geometry changed.
- [ ] **Step 8: Verify current-location failure modes**: device geolocation available, saved location fallback, IP fallback, Beijing fallback; Sky Engine must accept the resulting valid location without changing that priority chain.
- [ ] **Step 9: Deploy only after all checks pass**, then verify the production deployment is `READY` and serves the exact tested commit.
- [ ] **Step 10: Final production smoke check** on desktop and mobile/portrait: no console errors, sky works, existing pasture visuals and interactions remain intact.

## Self-review notes
- Spec coverage: astronomy core, Jerusalem bearing, 180x90 FOV, exact sea-sky boundary, 0-3 magnitude catalog, twilight, Moon, cloud locality, atmospheric extinction, twinkle, shared orientation state, cadence, and exclusions are each owned by a task.
- Type/interface consistency: all renderers consume `computeSkyState` output and use `projectHorizontal`; portrait does not create a second ephemeris path.
- Stability: scenery code is explicitly out of scope and final diff review checks it.
- Key correction captured from the approved screenshot: **the top dark-blue band is sky; the light blue-gray band below it is sea.** The landscape sky bottom is therefore the existing top-band boundary `y=96`, not mountains and not the current approximate moon `skyBand=103`.
