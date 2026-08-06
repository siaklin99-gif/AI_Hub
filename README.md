# AI Hub

A six-page static site for anyone — young or old, technical or not — who has been told to
"embrace AI" and given no idea where to start. No framework, no server, no account, no
runtime dependencies: open `index.html`.

Built from the pain points in `thoughts.rtf`. Each of the six problems named on the front
door maps to a track that closes it.

## The pages

| Page | Track | What it does |
|------|-------|--------------|
| `index.html` | — | Names the six problems from the notes, gives the 60-second version, routes to the tracks. |
| `map.html` | 1 · The Map | "We don't know what we don't know." Ten things AI is good at, eight it is structurally bad at, the jagged frontier, five habits for finding your own blind spots, a 16-item self-audit. |
| `trust.html` | 2 · Trust | The flagship. Triage by cost-of-being-wrong, six verification moves, four things that *feel* like checking but aren't, eight failure modes, privacy, a 10-item one-page check. |
| `leverage.html` | 3 · Leverage | The mental model, the five parts of a request that works, iteration, ten copyable patterns, seven beginner mistakes, three tool levels. |
| `tools.html` | 4 · Tools | Six categories instead of a leaderboard, a four-question decision flow, why free tiers end, and how to build your own five-prompt benchmark. |
| `further.html` | 5 · Go Further | Three ladders, a 30-day / 20-min-a-day plan, finding AI-shaped work, an honest read on careers, and seven awkward truths about starting an AI company. |

Track 0 (foundations — what AI *is*) deliberately links out to the existing **Baseline**
page at `hlur.ai/baseline` rather than being rewritten here. One source of truth per
concern; a second foundations page would drift from the first.

## Adding a page

Two steps. Nothing else is touched.

1. Add an entry to `site.config.js`.
2. Create `src/pages/<name>.js` exporting the body HTML.

```bash
node build.js
```

The nav, every footer, the prev/next pagers, the front-door track grid **and both
harnesses' page lists** all update themselves, because they all read the same config.
`node test.js` proves this: one of the adversarial tests adds a page to a cloned config and
asserts it reaches every one of those places with no page file edited.

### Layout of the source

| File | Role |
|------|------|
| `site.config.js` | **The only file you edit to add, remove or reorder a page.** Page registry, nav labels, hero copy, track cards, allow-listed external hosts, the site date. |
| `src/validate-config.js` | Boundary validation for the above. Runs before any build logic. |
| `src/layout.js` | The page shell — head, nav, hero, pager, footer. Exactly one copy. |
| `src/components.js` | Authoring helpers: `section` `card` `note` `accordions` `checklist` `steps` `table` `prompt` `trackGrid`. |
| `src/pages/*.js` | Per-page body content only. |
| `build.js` | Renders source → the flat `*.html` at the root. `--check` diffs instead of writing. |
| `assets/style.css`, `assets/app.js` | The design system, and progressive enhancement only — every page works with JS off. |

The root `*.html` files are **generated**. Each carries a banner saying so, and
`build.js --check` (wired into the static harness and the pre-commit hook) fails if one was
hand-edited. That is what makes the committed HTML trustworthy rather than merely present.

## Verify it yourself

Don't take any of the above on trust — that would be a strange way to run this site.

```bash
./selfcheck --full
```

Three harnesses, **1,580 checks**, all re-runnable and all yours:

**`test.js` — 26 adversarial unit tests.** Not happy paths. A page missing its title, two
pages sharing a nav label, a description outside 60–260 chars, a reorder that leaves a page
calling itself "Track 3" from slot 5, an `idPrefix` that would collide in localStorage, an
unknown `note()` kind, accordion numbering past 9, a quote in a description trying to break
out of the `content="…"` attribute, a pager pointing a page at itself.

**`verify.js` — 734 static checks, offline, zero dependencies.** Config validation; every
`.html` byte-identical to what the source renders; every link *and anchor* resolving; the
nav byte-identical across pages; every checklist counter matching its real box count; every
CSS class used in HTML having a rule; `app.js` referencing every hook the HTML depends on;
the mobile media query genuinely last in the stylesheet; every colour token having a dark
value; the one borrowed term attributed; no price or model version anywhere; and a
repo-wide leak sweep across all 23 text files.

**`render.js` — 820 rendered checks.** Real Chromium, 6 pages × {desktop, mobile} ×
{light, dark}. Measures the DOM rather than reading the CSS:

- **Source ⇄ DOM parity.** An independent parser counts sections, headings, checkboxes,
  accordions, tables, cards, track cards and prompts in the *source*, then asserts the
  browser renders exactly that many. If the code says 16 checkboxes and the page shows 15,
  this fails. The nav is compared against `site.config.js` label-for-label, in order.
- **Desktop ⇄ mobile parity.** The visible text at 390px must be *character-identical* to
  the text at 1280px. A media query may re-arrange the page; it may never drop content.
  Light and dark are compared the same way.
- **Layout invariants.** No horizontal overflow, every `.wrap` sharing one left edge, the
  nav aligned to the content, no collapsed cards, no clipped text, no console errors.
- **WCAG AA contrast** on every piece of rendered text, in both themes.
- **The interactive parts actually exercised** — an accordion really opens, a tick really
  updates the counter and really survives a reload.

Because closed accordions are legitimately zero-height, `render.js` measures twice: once as
shipped, once with every accordion forced open. Skipping the closed ones would have left a
blind spot over most of the content.

Playwright is borrowed from `a local install` so this repo stays dependency-free.
If it can't load, `selfcheck --full` **blocks** — it does not pass quietly.

### The pre-commit hook

`git config core.hooksPath hooks` is already set. `hooks/pre-commit` runs `test.js` and
`verify.js` (fast, offline) and **blocks the commit** on any failure. The rendered harness
stays behind `--full`, because blocking a commit on a browser launch would be worse than
useless. The hook detects and blocks; it never edits code.

## Both harnesses were proven by falsification

A guard only ever run against working code is unproven. Each of these was injected into a
copy and confirmed to fail for the right reason:

| Injected defect | Caught by |
|---|---|
| A real price (`$20 per month`) added to `tools.html` | `verify.js` |
| A checkbox deleted, counter left saying "16" | `verify.js` |
| `#moves` anchor repointed to a non-existent id | `verify.js` |
| One nav link removed from a single page | `verify.js` |
| A CSS rule appended *after* the mobile media query | `verify.js` |
| `--text-ter` reverted to the low-contrast `#888780` | `render.js` |
| Every dirty-config and dirty-component case listed above | `test.js` |

Three failures during construction were the harnesses' or the port's own bugs, not the
site's, and were fixed rather than worked around:

1. A price pattern that flagged "per month" as a duration.
2. A contrast probe that misread Chrome's `color(srgb 0…1)` output for `color-mix()`
   backgrounds as 0–255 values.
3. A text-parity comparison run against a backup directory that had no `assets/`, so the
   "before" pages rendered unstyled and every page looked changed.

## The modular port was proven lossless

Moving from six standalone HTML files to the config + layout + content split was verified,
not assumed: every page was rendered before and after with all accordions forced open, and
the **body** text compared character by character.

```
BODY IDENTICAL  index    4 sections, 5683 chars
BODY IDENTICAL  map      6 sections, 11587 chars
BODY IDENTICAL  trust    7 sections, 12065 chars
BODY IDENTICAL  leverage 7 sections, 9160 chars
BODY IDENTICAL  tools    5 sections, 7798 chars
BODY IDENTICAL  further  6 sections, 11271 chars
```

Only the shell changed, deliberately: the front door gained a pager, and every page now
carries the full footer link set instead of index alone.

## Deliberate choices worth knowing about

- **Width matched to `hlur.ai/baseline`, measured not guessed.** That site was loaded in a
  real browser at 1280 and 1440px: `.wrap` is `max-width: 940px` with 22px padding, 16px
  body text, 52px `h1`. Those are the values here. One thing is deliberately *not* copied:
  baseline uses a wider 1200px nav shell, so its logo sits left of its content. Here the nav
  padding equals the content padding, and `render.js` fails if the two edges ever diverge.
- **`--text-ter` deviates from the house palette.** `#888780` measures 3.4:1 on the page
  background and fails WCAG AA for small text. Darkened to `#6b6a65` (light) and lightened
  to `#9a9992` (dark). On a site aimed partly at older readers, with real content in small
  type, AA is not optional. Every other token in the palette already passes and is unchanged.
- **The `h1` has no `max-width`.** It is left-aligned, so capping it would waste page width
  exactly like a misalignment.
- **"Track N" is validated against position.** The label is a sentence the page asserts
  about itself. Reorder the config and a page would confidently call itself Track 3 from
  slot 5 — a correct config producing a false claim. `validate-config.js` blocks it and
  `test.js` proves the block works.
- **No product names, prices, model versions or external reading list.** They rot within
  months, and a stale list is worse than none because it still looks authoritative. The
  pages teach how to check the current state instead. `verify.js` enforces this.
- **Only one external host is allowed** (`hlur.ai`), declared in the config. Any other
  outbound link fails the static harness.
- **Every page is dated** and `verify.js` fails if a page loses its date. The site tells
  readers to distrust undated AI claims; it holds itself to that.
- **Attribution.** The only borrowed idea is the "jagged technological frontier", credited
  to Dell'Acqua et al. (HBS/BCG working paper, 2023) on the page that uses it and in that
  page's footer. Everything else is original wording. `verify.js` fails if the term appears
  without the credit.

## Not yet done

- Not deployed anywhere. It runs from the filesystem as-is.
- `render.js` hard-codes the path to the borrowed Playwright install.
