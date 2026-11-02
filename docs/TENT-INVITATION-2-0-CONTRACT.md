# Tent Invitation 2.0 — Content Contract & Three Compositions

Status: approved implementation blueprint; production remains untouched.

## 1. Shared invitation content contract

All three PNG templates must use the **same normalized view model**. Templates may rearrange data, but may not silently omit applicable content.

| Data | Source | Rendering requirement |
|---|---|---|
| Title | title | Required, largest title |
| Date and departure time | date / time | Required, always visible |
| Area and meeting point | location / meetingPlace | Required, distinguish region from exact assembly |
| Distance, ascent, difficulty, duration | pills distance/elevation/difficulty/duration | Display all populated values, never assume missing values |
| Suitable participants, surface, equipment, weather | pills suitableFor/surface/equipmentMinimum/weather | Display all populated values in legible participation section |
| Description | description | Present a bounded common excerpt in all 3; complete text on route page |
| Participation | participation and computed registrationOpen | Identical QR or closed-state outcome for all 3 |
| Visual | visual.source | Use the uploaded route image; no invented geography |
| Leader credit | not currently supported in normalized schema | Future opt-in; do not invent names |

Treat an absent value as **not supplied**, never silently invent it. If required safety details are absent, prompt publisher upstream in a later publishing-flow iteration rather than hallucinating them in a poster.

### Layout constraints

- Output 1080 × 1530; don't upscale or stretch QR.
- Preserve readable hierarchy at phone preview size: title → when/where → physical requirements → registration.
- No fact may be absent in one theme but present in another when sourced from the same route.
- QR code is the same asset (or all three show the same unavailable/closed state).
- Text may be shortened only by the **same** explicit rule across templates; don't independently omit safety information.
- Test must compare rendered content by key, not just canvas size or CSS class.

## 2. Independent art direction

### Classic — archival travel invitation
1. Header: BUDAO mark, formal invitation line, dated postal seal.
2. Photo: framed authentic landscape photograph and restrained calligraphic caption.
3. Title: editorial serif/songti hierarchy.
4. Logistics: balanced event/date/location triplet.
5. Hiking data: a refined metrics strip; safety detail in a reserved legible region.
6. Closing: description excerpt, participation/QR, small brand footer.

### Outdoor — immersive expedition poster
1. Header: slim brand mark against full-bleed scenic photograph.
2. Hero: oversized, bold title on an image-safe gradient.
3. Route facts: four prominent expedition tiles: distance, ascent, difficulty, duration.
4. Logistics: departure/date and meeting point in high-contrast blocks.
5. Safety strip: suitable people, terrain, equipment, weather if provided.
6. Participation: large QR and direct action cue; brand sign-off.

### Natural — illustrated field journal
1. Illustrated header: playful editorial title and sunshine/foliage motifs.
2. Main scene: artwork surrounding the real route image; static reusable illustration assets, no generated text.
3. Route facts: four hand-drawn-style framed cards.
4. Event logistics: distinct time and meeting-place markers.
5. Safety: friendly but legible list; excerpt.
6. Participation: clear QR on quiet, high-contrast paper region.

## 3. Acceptance gates

- Information parity: shared fixture with all populated fields produces equivalent field presence in all styles.
- Contrasting composition: render snapshots clearly distinct even in grayscale.
- Long title/location tests, closed enrollment, missing QR, portrait photo.
- Actual mobile-size legibility and QR scanning, no overlapping labels.
- Compare real PNGs against the approved Lupiguan triptych as the aesthetic gold standard.
- CI lint/test/build all green; independent review before merge.
