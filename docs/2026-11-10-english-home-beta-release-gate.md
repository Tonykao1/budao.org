# BUDAO English homepage beta — release gate (2026-11-10)

**Target:** isolated public English homepage on `budao.org`, not a full international site.  
**Status:** HOMEPAGE-ONLY LANGUAGE SWITCH PREVIEW READY; **PRODUCTION NOT DEPLOYED**.  
**Release branch:** `release/budao-english-home-beta-20261110` (based on current `main`, not rebased from the older full-i18n draft).  
**Review preview:** https://budao-qkkvpavhy-tony-kao-s-projects.vercel.app/home.html?lang=en  
**Source Chinese:** same preview URL without `?lang`.

## Scope and implementation

- Existing Chinese `home.html` is authoritative and remains the default page.
- A **homepage-only** minimal language link has been added directly after the existing six-link `nav` (not as a seventh nav entry). It shows **EN** on Chinese home and **中文** on English home. It links to `/home.html?lang=en` or `/home.html` while preserving safe query parameters and fragment identifiers. It is not displayed on any other site page, and there is no IP, cookie or browser-language detection.
- The switch has a 44px minimum target, keyboard-visible focus treatment, `lang` / `hreflang` and an accessible action label. English-only narrow-screen navigation reserves right-hand scroll space so its last item is not hidden behind the separate control.

- `?lang=en` opts into English homepage content. `?lang=zh-Hant` remains experimental. No automatic redirect, language inference, cookies, persistent tracking, external translation API, or UI art redesign.
- `home.html` body is unchanged; only an HTML comment and two deferred script tags in the head.
- `global/i18n-core.js` localizes exact, source-guarded strings. `global/home-i18n.js` translates homepage editorial copy, owner-approved faith declaration, existing prayer UI labels, nav labels and owner-approved Footer names.
- English mobile navigation: original Chinese one-row geometry is preserved; to prevent English labels being **clipped** on narrow screens, *English only* uses native horizontal scrolling when width <=900px. No new navigation elements, menus, stylesheet edits, animation, or global CSS changes. The original Chinese navigation remains completely unaffected.
- On this homepage-only release, the chosen language persists **only** for links back to `/home.html`. Other pages remain Chinese and are not mislabeled as translated by adding `?lang=en`.
- `prayer-box.js` has a source-guarded display-copy helper for submit, error and draft-discard messages. Prayer contents, payload/permissions, encryption, consent, storage and APIs are unchanged.
- Existing `package.json` build/security/coworker checks, including campfire migration gate, are retained, with 32 homepage checks added.
- No `test.html`, `tongdao.html`, `what.html`, `yhzd.html`, `lsxh.html`, or other production modules are modified.

## Automated verification (release preview)

- Latest Vercel build: **READY**, commit `2f8363b67e57526132e45bc61700098fceb21924`.
- **32 i18n tests + 5 coworker tests passed; 0 failed.**
- Static security-build check passed.
- Campfire migration correctly skipped outside production.
- A **local reconstructed navigation-only Chromium probe** using the original nav CSS and English labels confirmed original mobile clipping at 375, 390, 430 and 768px. With the opt-in English horizontal-scroll adaptation, the last item can be reached by scrolling. This was **NOT a full-site browser screenshot nor a live deployment E2E test**.

## Pending QA / go-live blockers

- [ ] Inspect the actual deployed English and Chinese homepage at 375px, 430px and desktop sizes (particularly poem spacing, mobile nav scroll, five uppercase nouns, prayer overlay and Footer).
- [ ] Test real browser music/DSP/previous/next controls, prayer opening, validation, success/error/draft-discard flows, keyboard navigation and screenreader labels; avoid sending real private data during QA.
- [ ] Confirm the three **provisional** English nav names: `Young Explorers`, `Companions`, `Pasture`. Already-owner-approved `BUDAO`, `Fellow Workers`, `Campfire`, `Sparks` and faith creed are locked.
- [ ] Validate true English-first access paths: current `?lang=en` is a beta URL, not an independently indexed, server-rendered `/en/` page; Google may receive the Chinese source HTML until scripts run.
- [ ] Check product/support/policy/legal requirements for English-language privacy communications, particularly prayer submissions.
- [ ] Confirm the PR head remains synchronized to main and regression checks still pass immediately before merge.
- [ ] Owner visually accepts the actual preview **before** production merge.

## Recommended release decision

Publish **only the English homepage beta** after those targeted gates pass. Never merge the old PR #80 wholesale: it is a wider, main-behind internationalization draft. Do not claim video leader formation, the 52-week devotional program or complete international site are live. If real browser QA cannot be performed, leave this release as PREVIEW and explain the limitation clearly.

**Reasoning:** meaningful, honest English entry for potential visitors is useful; breaking the existing Chinese homepage, silently clipping navigation or overstating untranslated ministry services is not acceptable.
