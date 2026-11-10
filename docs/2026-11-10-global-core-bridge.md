# BUDAO GLOBAL — Home ↔ BUDAO core bridge (2026-11-10)

**Status:** Isolated opt-in preview, awaiting editorial and visual sign-off. **NOT production.**

## Why this increment exists

A visitor should be able to understand BUDAO's mission, then proceed from the English homepage into BUDAO's core practice without immediately losing the chosen language. This is an incremental ministry pathway, not a claim that the website is fully internationalized.

## Exactly what was implemented

- `global/core-page-i18n.js` adds English and Traditional Chinese **draft translations of fixed public editorial copy** on the existing `/test.html` core page: title, six navigation labels, weekly-walk heading, two-line introduction, quiet closing lines, calendar accessibility label, Footer, and *static* QR registration labels.
- `test.html` adds only two defer-loaded script references and an explanatory HTML comment in the **head**. The original body, inline route/calendar logic, markup, animations, images, styles and invitations are unchanged.
- `global/i18n-core.js` gains `carryLocaleOnLinks(document, locale, ['/home.html','/test.html'])`. It changes only the `href` attributes of exact root-relative links to **two pages actually integrated with i18n**. Nothing is added for unlocalized `/tongxing.html`, `/tongdao.html`, `/what.html`, `/tonglu.html`, `/yhzd.html` or `/lsxh.html`; external links, mailto, API paths and immutable invitations are never touched.
- `global/home-i18n.js` uses the same scoped link continuity.
- The canonical brand remains `BUDAO`; owner-approved `Fellow Workers`, `Campfire`, `Sparks`, and the faith declaration are unchanged.
- The translated labels in the existing home navigation that have *not* been approved (e.g. `Young Explorers`, `Companions`, `Pasture`) remain explicitly DRAFT.

## What is emphatically NOT localized

- Live event cards, route descriptions, participant submissions, organizer-generated content and QR destinations.
- Form and registration business logic; the invitation and calendar engines.
- Other five core pages; navigation on those pages continues in Chinese.
- New UI language picker, search indexing, `hreflang`, official `/en/` URL, database migration or translation API.
- No commitment that browser and mobile layout have been visually certified.

## User-visible preview

- `/home.html?lang=en` → click BUDAO → `/test.html?lang=en` → click Home → `/home.html?lang=en`.
- Default `/home.html` and `/test.html` remain unchanged Chinese.
- `?lang=zh-Hant` works for the same two editorial introductions.
- Clicking into any not-yet-integrated page uses its original URL, exposing the honest untranslated destination.

## Release gates

1. Pass the Vercel build test suite, including new language-continuity and source-guard tests.
2. Compare English versus source Chinese at 375px, 430px and desktop, especially the long weekly-walk headline and existing animations; correct language copy or hold rather than altering artwork.
3. Verify the actual calendar, route signup, QR, and interaction flows. **Static tests do not certify runtime behavior.**
4. Get owner approval for all remaining draft nav labels and the ministry's previously approved exact English official name.
5. Resolve the development branch being behind `main` before merging; inspect conflicts and rerun the full test suite.
6. Keep PR #80 as draft and **do not production-deploy** until all relevant pages and language UX are ready.

**Core principle:** Cross-language comprehension should enable real companionship and ministry learning, not be confused with translation completeness.
