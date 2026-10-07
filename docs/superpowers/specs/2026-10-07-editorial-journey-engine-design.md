# Editorial Journey Engine — Shared Design Specification

Date: 2026-10-07
Status: Design approved in conversation; pending user review of this written spec
Branch: `feat/yhzd-editorial-v7`

## 1. Purpose

Build a shared, project-agnostic editorial journey engine that can power both **萤火之地** now and **见地** later, with audio added as a future third content layer.

The engine must go beyond a conventional digital magazine. It should preserve continuous reading while creating a spatial, cinematic, adaptive journey whose layout is generated from content form and journey rhythm rather than from fixed templates.

For 萤火之地, the defining experience is **Scene-by-Scene Depth Return**: the user scrolls downward normally, while each scene visually moves into and out of depth, expressing return rather than forward conquest. The theological meaning is embodied spatially rather than explained in UI copy.

## 2. Non-negotiable principles

1. **Continuous editorial journey, not slides.**
2. **Scene-by-scene depth return** for 萤火之地.
3. **Adaptive scene length**: scene size is derived from image composition, text length, and recent rhythm.
4. **Dynamic scene types**: image+text, image-only, or text-only may all be generated.
5. **Independent pools for 萤火之地**: images and text remain semantically independent.
6. **Formal intelligence only**: the engine does not infer emotion or meaning for editorial pairing.
7. **Text integrity**: original text is never truncated, excerpted, rewritten, or split across scenes.
8. **Adaptive safe crop**: images default to full-frame; light reversible cropping is allowed only when subject safety is confidently preserved.
9. **Zero manual override** for 萤火之地: the engine must self-solve and self-validate.
10. **Walked scenes remain stable**: once a scene has been viewed, its scene spec is frozen for the current journey.
11. **Unseen scenes are generated live** as the user continues.
12. **Natural closure**: journeys end based on rhythm completion rather than a fixed visible scene count.
13. **Quiet dissolve**: after closure, only night, stars, distant glow, and silence remain. No CTA or end label.
14. **Strong spatial immersion on desktop; simplified depth on mobile.**
15. **Spatial transition + reading lock**: image and text travel together in space; at focus, text locks to a crisp reading plane.
16. **Soft magnetism**: the scene gently stabilizes near the optimal reading focus without stealing scroll control.
17. **Information completeness before atmosphere**: all readable text must remain fully obtainable and within viewport safety.

## 3. Shared engine architecture

The engine is independent of any single page or project.

### 3.1 Visual Analyzer

Pre-computes image form metadata. It must not infer semantic meaning.

Suggested fields:

- aspect ratio
- orientation
- visual density
- subject bounding area / visual center
- negative-space distribution
- luminance distribution
- likely safe crop bounds
- depth structure / foreground-middle-background confidence
- suitability for large-format rendering

### 3.2 Content Fingerprint

Normalizes media and text into lightweight structural metadata used by the runtime solver.

Image fingerprint examples:

- `aspect`
- `orientation`
- `density`
- `subject_x`, `subject_y`
- `negative_space_left/right/top/bottom`
- `safe_crop`

Text fingerprint examples:

- character count
- sentence count
- punctuation count
- estimated line counts at candidate widths
- short / medium / long density class

No emotion, sentiment, theology, or semantic pairing score is used for 萤火之地.

### 3.3 Rhythm State

Tracks what the user has already experienced in the current journey.

Suggested state:

- recent scene types
- recent image orientations
- recent image scale weights
- recent text densities
- recent visual weights
- left/right balance history
- current depth
- count since last text-only scene
- count since last image-only scene
- current closure progress

### 3.4 Scene Candidate Generator

Generates multiple legal scene specifications instead of selecting a hardcoded template.

Candidate dimensions may include:

- scene type: image+text / image-only / text-only
- image scale
- image anchor
- text width
- text anchor
- scene height / length
- scene distance in Z
- crop mode
- focus point
- transition strength

Values should be continuous where possible rather than tied to fixed percentage templates.

### 3.5 Editorial Solver

Scores legal candidates and selects among the highest-quality solutions.

Core soft scores:

- readability
- composition balance
- rhythm quality
- continuity
- variation / anti-repetition
- depth fitness

Risk penalties:

- crop risk
- text crowding
- repeated composition
- weak mobile fallback
- excessive visual weight

Randomness is allowed only among near-top solutions. Poor layouts must never be chosen merely for variety.

### 3.6 Safety Validator

Every scene must pass hard constraints before rendering.

Required checks:

- 100% text integrity
- no horizontal text overflow
- minimum readable type size
- no subject-destructive crop
- no uncertain crop when confidence is low
- no image rendered below useful size
- no image/text collision
- no unreadable transform at focus
- valid mobile fallback
- no accidental duplicate content within a journey unless pool exhaustion requires it

If validation fails, the engine must solve again.

### 3.7 Renderer

The renderer is split into independent layers.

#### Spatial Layer

Responsible for:

- image depth
- perspective
- scale
- blur
- brightness
- parallax
- scene approach and recession
- night/stars/glow environment

The first implementation should prefer CSS/GPU transforms. The layer must remain replaceable by WebGL later without changing the upper engine.

#### Reading Layer

Responsible for crisp DOM text. During transition, text may visually travel with the spatial scene; at focus, it must lock onto a flat, stable reading plane.

#### Sound Layer (future)

Not part of v1 implementation, but architecture must reserve it. Audio should become a native scene dimension rather than a bolted-on player.

## 4. 萤火之地 narrative mode

Configuration name: `depth-return`

### 4.1 Direction

Primary direction is **into depth**, not leftward. Slight lateral drift may be used as a secondary motion cue, but must never dominate.

### 4.2 Scene lifecycle

Each scene passes through five phases:

1. **Distant appearance**
   - small scale
   - low contrast
   - blur
   - low luminance
   - spatial text and image move together

2. **Approach**
   - scale rises
   - blur falls
   - contrast returns
   - parallax becomes legible
   - movement decelerates near focus

3. **Reading lock**
   - text becomes perfectly crisp DOM content
   - text has no perspective distortion
   - image may retain subtle spatial presence
   - scene is fully readable

4. **Release**
   - additional user scroll releases focus
   - text rejoins spatial transition

5. **Recede**
   - scale falls
   - blur rises
   - brightness/contrast lower
   - scene moves deeper into space rather than simply fading out

### 4.3 Soft magnetism

Do not use hard scroll snapping.

Near the scene focus zone, the system may gently reduce apparent scene velocity and stabilize the composition. Fast user intent must always win. The user must never feel that scroll control has been taken away.

### 4.4 Memory tiers

To preserve spatial continuity without retaining every scene in the DOM forever:

- **Near Memory**: current scene and adjacent scenes remain fully renderable.
- **Deep Memory**: older nearby scenes may reduce to faint spatial representations.
- **Stored Journey**: distant scenes retain only their immutable `SceneSpec` and can be reconstructed when the user scrolls back.

### 4.5 Adaptive distance

Scene-to-scene Z distance is generated by rhythm state. Heavy scenes may require more travel before the next focus. Light scenes may sit closer together.

## 5. Live journey behavior

### 5.1 Generation model

The journey is not fully precomputed on page load.

- Generate only the initial small buffer.
- As the user approaches the frontier, generate the next scene(s).
- Freeze each scene once it becomes viewed.
- Never recompute a viewed scene during that journey.

Rule: **走过的路保留；没走到的地方继续现场生成。**

### 5.2 Independent content pools

For 萤火之地:

- image selection and text selection are independent
- no semantic pairing
- no captions implying that the quote belongs to the pictured people/place
- same-load duplicates should be avoided while fresh content remains
- recent-history avoidance may be used across journeys

### 5.3 Natural closure

The engine evaluates closure based on rhythm completion, not a visible fixed scene count.

Possible inputs:

- enough variation has occurred
- recent rhythm has begun to lighten
- image-only and/or text-only breathing moments have occurred
- recent visual weight has resolved
- minimum hidden safety count has been exceeded
- maximum hidden safety count has not been exceeded

The safety min/max are implementation guards only; users never see them.

### 5.4 Quiet ending

At closure:

- no CTA
- no restart control
- no “end” text
- no share prompt
- only background night, stars, distant glow, and negative space remain

## 6. Editorial intelligence examples

### 6.1 Very short text + large landscape image

Possible output:

- image-only scene followed by text-only scene, or
- large image with a small, spacious text treatment

Short text should receive space, not artificially large advertising typography.

### 6.2 Long text + portrait image

If a combined scene would make either item too small, the engine may generate:

- text-only scene
- followed by portrait image-only scene

Text remains intact.

### 6.3 Repeated heavy scenes

If recent scenes are visually heavy, the next scene should reduce weight even if the next available image is suitable for a large treatment.

The engine should optimize the journey, not each scene in isolation.

## 7. Mobile behavior

Mobile keeps the same narrative identity but simplifies motion.

Keep:

- scene-by-scene depth return
- scale
- blur
- brightness
- opacity
- light positional shift
- reading lock
- soft magnetism where safe

Reduce or remove:

- aggressive perspective
- strong parallax
- large lateral drift
- complex 3D transforms

The mobile experience must remain calm, readable, and performant.

## 8. Performance model

- No runtime LLM dependency for scrolling.
- Visual/content fingerprints should be precomputed or cached.
- Runtime work should primarily be numeric candidate generation, scoring, validation, and transform interpolation.
- Use DOM text for accessibility and crisp rendering.
- Start with CSS/GPU transforms for spatial media.
- Keep WebGL optional and isolated behind the Spatial Layer interface.
- Virtualize distant scenes using Stored Journey reconstruction.

## 9. Data model

### 9.1 `ContentFingerprint`

A normalized structural description of a content item.

### 9.2 `RhythmState`

A rolling state of recent journey composition and current depth.

### 9.3 `SceneSpec`

Immutable after first view.

Suggested fields:

- `id`
- `sceneType`
- `imageId?`
- `messageId?`
- `imageScale?`
- `imageAnchor?`
- `cropSpec?`
- `textWidth?`
- `textAnchor?`
- `sceneLength`
- `sceneDepth`
- `focusPoint`
- `transitionStrength`
- `mobileFallback`
- `generatedAt`
- `viewedAt?`

### 9.4 `JourneyState`

Contains:

- ordered frozen SceneSpecs
- current scene index
- generated frontier
- rhythm state
- content history
- closure state

## 10. First implementation boundary

V1 should prove the engine with 萤火之地 only while keeping interfaces generic enough for future 见地 reuse.

V1 includes:

- generic engine core
- structural fingerprints for current image manifest and messages
- rhythm state
- candidate generation
- deterministic scoring/validation
- three scene types
- live frontier generation
- frozen walked scenes
- natural closure
- desktop strong depth-return renderer
- mobile reduced-motion depth-return renderer
- soft magnetism
- reading lock
- existing star/night visual language

V1 explicitly excludes:

- audio playback
- semantic analysis
- emotion analysis
- WebGL unless CSS/GPU proves insufficient during implementation
- author manual overrides
- admin editor UI
- semantic image-text pairing

## 11. Testing and acceptance

### Unit tests

- fingerprints are deterministic
- text is never mutated
- duplicate suppression works
- candidate generator produces legal options for landscape/portrait/short/long combinations
- solver ranks valid candidates above invalid/repetitive ones
- validator rejects overflow and unsafe crop
- frozen scenes never change after view
- closure obeys hidden min/max guards and rhythm rules

### Layout tests

Required viewport coverage:

- 1536
- 1440
- 1280
- 1024
- 981
- 980
- 768
- 430
- 390
- 320

For every rendered scene:

- text rect remains within viewport safe area
- full text content is present
- image has non-zero useful display area
- focus state has no text blur/perspective
- no horizontal overflow

### Journey tests

- scrolling forward generates new scenes at the frontier
- scrolling backward restores the exact previous SceneSpec
- forward again returns the same already-walked scenes
- only unvisited frontier scenes are newly generated
- journey eventually closes naturally
- final state contains no CTA or end copy

## 12. Architectural interfaces

The following boundaries must remain independent:

- `analyzer` — content form analysis
- `fingerprint` — normalized metadata
- `rhythm` — journey state updates
- `candidates` — possible scene specs
- `solver` — scoring and selection
- `validator` — hard safety constraints
- `journey` — frontier generation/freeze/closure
- `renderer` — spatial and reading presentation

A consumer such as 萤火之地 should configure the engine rather than embed project-specific layout logic in the core.

## 13. Success criterion

A successful first version should make users feel that they are not scrolling through alternating image/text sections. They should feel that they are **walking scene by scene into depth**, with each scene composed specifically for its content, fully readable at focus, stable when revisited, and naturally resolving into silence.
