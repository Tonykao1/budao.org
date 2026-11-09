# BUDAO GLOBAL — Official translation governance and English copy review

**Date:** 2026-11-09  
**Status:** Governing translation constraints approved. **Fellow Workers** and the two-line English faith declaration have received owner approval as copy decisions. Other English labels remain drafts. No production release is authorized by this document.  
**Visual:** Absolute Visual Preservation Lock applies. Original site is the only artwork/layout master.

## 1. Non-negotiable rules from the owner

1. Whenever the **brand name** 步道 occurs in translated site copy, translate it as **BUDAO**, in **all capital letters**, in every supported target language. Do not replace it with “Trails”, “Trail”, “Path”, “Budao” or another descriptive substitute. This is not a ban on translating the ordinary *non-brand* Chinese word for a trail in route descriptions.
2. Homepage text and **every navigation item** require 信、达、雅: fidelity to meaning, idiomatic writing, and expressive grace. These are separate checks, not just a single machine translation score.
3. The ministry name and previously approved standard English ministry translation **must be preserved exactly**. Do not infer that “BUDAO Church System”, “BUDAO Ministry”, or “TRUIL MINISTERIUM INTERNATIONAL” is necessarily that standard English name. Its precise wording was not independently verified in accessible records during this revision; **leave the ministry-name field blocked for publication** rather than invent it.
4. Punctuation and spacing follow the target language. English prose uses English punctuation and question marks, not Chinese ，。！？「」. Traditional Chinese uses appropriate full-width marks and Chinese quotation marks. Chinese–Latin mixed text needs deliberate spacing review.
5. “余生行走，不偏左右” is a faith declaration, **not a travel slogan**. Every approved target-language rendering needs theological depth, humanistic substance, literary quality, and meaningful sound/rhyme. Do not render by a simple word-for-word substitution.

## 2. Approved brand versus draft labels

| Source | Draft English | Status | Intended meaning |
| --- | --- | --- | --- |
| 首页 | Home | DRAFT | Entry into the site |
| 步道 | **BUDAO** | **BRAND LOCKED** | The proper name, never Trails |
| 童行 | Young Explorers | DRAFT | Picture books, education and journeys for young people |
| 同道 | Companions | DRAFT | Walking in the same way, sharing ministry practice and equipping leaders |
| 同工 | **Fellow Workers** | **COPY APPROVED — RELEASE PENDING VISUAL QA** | Persons serving together in the ministry; rooted in established Christian usage |
| 牧场 | Pasture | DRAFT | Pastoral/pixel-sheep image of the digital Christian community |

The original Chinese labels are not revised. Draft English labels must be reviewed for layout fit **without changing CSS, fonts, spacing, artwork, or animation**. The six-item navigation structure and existing href paths remain identical.

## 3. Homepage editorial copy in development preview

- “我们在做什么？” → “What do we do?” (DRAFT)
- “健行于天地，相知于彼此，在旷野经历与祂的同在。” → “We walk the earth beneath the heavens, come to know one another, and encounter His presence in the wilderness.” (DRAFT)
- “为什么是‘步道’？” → “Why BUDAO?” (DRAFT)
- “祂就是道路、真理、生命。唯有祂亲自感动你同行天路，共步主道。” → “He is the way, the truth, and the life. He alone can stir our hearts to journey heavenward together, following His way.” (DRAFT)
- “步道有什么？” → “What will you find at BUDAO?” (DRAFT)

The approved Chinese source text and punctuation remain as they were in the HTML files. The English may be revised after theological and literary review; preview is not publication.

## 4. Faith declaration — wording approved, NOT visually integrated

**Chinese authority:** 余生行走，不偏左右。

**Owner-approved English wording (COPY APPROVED; NOT PUBLISHED):**

> Till our final day, we shall walk in His way;  
> Neither left nor right shall we stray.

Rationale: `final day` evokes a lifetime to the end; `walk` retains action; `His way` grounds the line in following Christ; `left nor right` echoes the scriptural imperative not to turn aside (Deuteronomy 5:32; Joshua 1:7; Proverbs 4:27); the line ends `day / way / stray` supply audible rhyme. This is an authored *poetic interpretation*, not a Bible quotation. The collective `we` and the full grammatical wording are owner-approved. The capital **Neither** is line-initial poetic capitalization after a semicolon; never present this as a literal Scripture quotation.

**Integration status: BLOCKED FOR VISUAL/INTERACTION REVIEW (despite copy approval).** The existing Chinese slogan uses four embedded interactive controls (`dspBtn`, `playBtn`, `prevBtn`, `nextBtn`). Replacing their text with long English fragments would change the control hit areas and could break the approved artwork. Do **not** insert the English slogan into those controls or change CSS/markup. The existing Chinese headline remains until a fully faithful, zero-visual-change language treatment is explicitly accepted and verified.

## 5. Quality controls and release gates

- Catalog entries carry `DRAFT` → `REVIEWED` → `APPROVED` states, with `OUTDATED` and `REJECTED` terminal workflow markers. Drafts are never mistaken for official names.
- Enforce brand capitalization and punctuation with automated tests. Prohibit ambiguous translation of the ministry's approved name pending independent verification.
- On changes to Chinese source, mark translations stale and withhold official publication until reviewed.
- Compare screen layouts on 375px, 430px, tablet and desktop against original composition; correct text or hold release rather than editing artwork.
- Faith texts need Scripture references and a theology-aware human reviewer; Scripture versions must be used in line with their licenses.
- Existing routes, original HTML/CSS, invitation snapshots and permanent /i/{id} are not to be altered by localization.
