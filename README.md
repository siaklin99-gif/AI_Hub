# AI Hub

A six-page static site for anyone — young or old, technical or not — who has been told to
"embrace AI" and given no idea where to start. No framework, no server, no account, no
runtime dependencies: open `index.html`.

Built from a page of notes about what actually makes AI confusing right now. Each of the
six problems named on the front door maps to a track that closes it.

## The pages

| Page | Track | What it does |
|------|-------|--------------|
| `index.html` | — | Names the six problems from the notes, gives the 60-second version, routes to the tracks. |
| `map.html` | 1 · The Map | "We don't know what we don't know." Ten things AI is good at, eight it is bad at on its own, the jagged frontier, five habits for finding your own blind spots, a 16-item self-audit. |
| `trust.html` | 2 · Trust | The flagship. Triage by cost-of-being-wrong, six verification moves, four things that *feel* like checking but aren't, eight failure modes, privacy, a 10-item one-page check. |
| `leverage.html` | 3 · Leverage | The mental model, the five parts of a request that works, iteration, ten copyable patterns, seven beginner mistakes, three tool levels. |
| `tools.html` | 4 · Tools | Six categories instead of a leaderboard, a four-question decision flow, why free tiers end, and how to build your own five-prompt benchmark. |
| `further.html` | 5 · Go Further | Three ladders, a four-week / 20-min-a-day plan, finding AI-shaped work, an honest read on careers, and seven awkward truths about starting an AI company. |

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

Three harnesses, all re-runnable and all yours. The exact check count is whatever
`./selfcheck --full` prints when you run it — a number printed by the harness cannot go
stale in prose, which is why none is written here.

**`test.js` — adversarial unit tests.** Not happy paths. A page missing its title, two
pages sharing a nav label, a reorder that leaves a page calling itself "Track 3" from slot 5,
an `idPrefix` that would collide in localStorage, an unknown `note()` kind, accordion
numbering past 9, a quote in a description trying to break out of `content="…"`.

**`verify.js` — static checks, offline, zero dependencies.** Config validation; every
`.html` byte-identical to what the source renders; every link *and anchor* resolving; the nav
byte-identical across pages; every checklist counter matching its real box count; tag balance
including `div`; every table actually inside a `.tscroll`; every CSS class used in HTML having
a rule **and** every rule matching something; every `localStorage` access brace-matched inside
a real try block; the mobile media query genuinely last; the one-source-of-truth site date;
borrowed terms keeping their attribution; no price or model version; a repo-wide leak sweep.

**`render.js` — rendered checks in real Chromium**, 6 pages × 5 combos: desktop and mobile in
both themes, plus 320px narrow in light. The two mobile combos and the narrow one declare
`hasTouch`/`isMobile`, so hover-gated CSS resolves the way a phone resolves it rather than the
way a desktop browser pretending to be small does.

- **Source ⇄ DOM parity.** Counts are read from `src/pages/*.js` + `site.config.js` +
  `src/layout.js` — never from the built HTML — so a build bug that drops content from every
  layer still fails. The nav is compared to the config label-for-label, in order.
- **Desktop ⇄ mobile ⇄ 320px ⇄ dark parity.** Visible text must be character-identical across
  all of them. A media query may re-arrange; it may never drop content.
- **Layout invariants.** No horizontal overflow, one shared left edge, nav aligned to content,
  no collapsed cards (measured with everything expanded), no text clipped by a box that hides
  overflow, no console errors.
- **WCAG AA contrast**, with alpha composited down the ancestor chain and cumulative
  `opacity` folded in, so semi-transparent and invisible text fail instead of passing.
- **Control usability.** Every button, link-button and checkbox must be at least 14px, above
  0.6 effective opacity, and — via `elementFromPoint` — not painted over by anything.
- **The interactive parts exercised.** *Every* checklist on a page (not just the first): tick
  it, confirm its own counter and bar update, reload, confirm it persisted.

Screenshots are taken **immediately after load**, before any harness mutation, so the PNGs are
the page a visitor actually gets.

`test.js` and `verify.js` need **nothing installed** — just Node. Only the rendered pass needs
Playwright:

```bash
npm install --no-save playwright && npx playwright install chromium
```

Already have it elsewhere? `AIHUB_PLAYWRIGHT=/path/to/node_modules/playwright node render.js`.
If Playwright can't be found, `selfcheck --full` **blocks** rather than quietly passing, and an
unrecognised argument is rejected with exit 2 rather than degrading to static-only.

### The pre-commit hook

`git config core.hooksPath hooks` is already set. `hooks/pre-commit` runs `test.js` and
`verify.js` (fast, offline) and **blocks the commit** on any failure. The rendered harness
stays behind `--full`, because blocking a commit on a browser launch would be worse than
useless. The hook detects and blocks; it never edits code.

## What the cold audits found

Two zero-context auditors read the repo with no knowledge of how it was built. Both found real
defects, and the code audit found them **in the harnesses themselves** — the dangerous kind,
because a false negative manufactures confidence.

Every finding below was reproduced locally before being fixed, and every fix was then proven by
re-injecting the original defect and watching the repaired guard fail.

| The guard said | What was actually true |
|---|---|
| clipped-text scan, 6 pages green | It skipped `overflow: visible` first — the default for every tag it looked at. **0 of 123 elements examined, every run.** |
| contrast scan, all AA | Alpha was discarded and transparent text was *skipped, not failed*. `color: transparent` and `rgba(…,0.1)` both passed. |
| no collapsed cards | `m.deadCards === 0 \|\| open.dead.length === 0` short-circuited on 4 of 6 pages, discarding the only scan that sees inside accordions. |
| every footer links everywhere | `… \|\| (dest === 'index.html')` made it vacuous. Removing every index link from every footer passed. |
| tags balanced | `div` was not in the list — the only tag this site nests. Deleting a `</div>` passed. |
| localStorage is guarded | The regex had an unbounded lazy gap; one unrelated `try {` satisfied it. Stripping all four real guards passed. |
| source ⇄ DOM parity | It read the *built* HTML, i.e. the same artifact the browser was rendering. Not independent at all. |
| screenshots reviewed by eye | They were the post-test state: every accordion forced closed, and a checkbox already ticked. tools.html saved at 4585px against a shipped 4707px. |

And one bug the harnesses missed entirely, which the audit surfaced: **11 copy buttons were
`opacity: 0` behind a `:hover`** — dead on every phone, on a site whose hero says "Works on a
phone." Fixing it took three passes, each caught by a new check rather than by luck: `opacity:
0.45` was still unreadable (so contrast now folds in cumulative opacity), and then the fully
opaque button was **painted over by `.prompt`**, which is `position: relative` and later in the
DOM (so controls are now occlusion-tested with `elementFromPoint`).

Also fixed: nav highlighting died on pretty URLs (`/trust` lit nothing, `/hub/trust/` lit
"Start"); `attr()` escaped 1 of ~10 attribute interpolations; a throw in one `init()` step
killed every later one; `.tag-blue` and `.tag-row` matched nothing; the class-coverage set was
harvested from CSS comments, so `class="ai"` would have passed; `undefined` and `NaN` were
banned as substrings of `.js` source; `./selfcheck --fulll` printed PASS and exited 0.

Three findings were judged and **not** treated as bugs: the mobile media query really is last,
320px really has zero overflow, and accordion numbering past 9 is correct.

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

## Licence

Dual, because the site tells readers to steal its prompts and re-run its harnesses, so the
licence has to actually permit that:

- **Code** (`build.js`, `src/`, `assets/`, the harnesses) — MIT.
- **Writing** (the pages, the checklists, the prompt templates, this README) — CC BY 4.0.

See [LICENSE](LICENSE). Third-party ideas quoted in the text stay with their authors and are
credited on the page that uses them.

## Not yet done

- Live at [hlur.ai/hub](https://hlur.ai/hub/), synced there by `sync_hlur.sh` and served
  by the host repo's deploy gate. It also runs from the filesystem as-is.
- Nine of the ten helpers in `src/components.js` are used by no shipped page: the six pages
  predate them and hand-write their markup. They are correct and tested, and new sections
  should use them, but the file's original claim that a CSS rename is "one edit instead of six
  page-wide finds" is not true today. The docstring now says so.
