# BUDAO GLOBAL — Phase 1: visual preservation lock

Date: 2026-11-09. Status: isolated development / review candidate; NOT production-published.

## Non-negotiable constraint
**Existing site is the sole visual master.** Do not edit CSS, colors, fonts,
layout, artwork, animation, illustration or navigation structure. On a localization
conflict, hold the translation for review; never change the approved composition.

## Initial isolated integration

- `global/i18n-core.js`: pure locale resolution, limited URL generation,
  source-text guards, safe text-node substitutions. No API calls, cookies,
  localStorage, analytics, CSS edits or element insertions.
- `global/home-i18n.js`: draft English and Traditional Chinese editorial translations
  for selected homepage source-text nodes only. Does not rewrite the animated
  slogan, footer visual symbols or the sensitive private prayer dialog.
- `home.html`: two *deferred script references*; existing markup, CSS and
  existing JavaScript preserved. Opening `/home.html` without a supported
  `?lang=` value performs no localization changes. For developer review only:
  `/home.html?lang=en` or `/home.html?lang=zh-Hant`.
- `test/global-i18n.test.js`: unit checks for default no-op, safe targets,
  guarded substitutions, and preservation of interactive child nodes.

## Absolutely out of scope

No language button is added: the approved design would otherwise change.
No automatic locale detection/redirect; no API tokens, no AI translation
charges, no translation of user-provided content, no live translated
SEO routes, no database migrations. This is not a complete international site.

## Follow-on gates before publishing additional languages

1. Translation copy review, especially Christian language and Scriptural phrasing.
2. Full browser visual regression at desktop/mobile against the untouched Chinese
   master, including focus and contrast checks and long-text overflow checks.
3. Full repo `npm run lint`, `npm test`, `npm run build`, plus non-UI and
   localization test suites, under a complete repository working tree.
4. Approval of the language selection UI *only if* it can remain visually
   identical or separately authorized; no automatic visual changes.
5. No modifications to frozen invitation templates or `/i/{id}` routing.

## Principle
Internationalization changes language content, never BUDAO's approved artwork.