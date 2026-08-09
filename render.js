#!/usr/bin/env node
/* ============================================================
   AI Hub — RENDERED verification.
   A static CSS read cannot see a layout bug. This drives the real
   pages in real Chromium at 5 viewport/theme combinations, measures
   the DOM, exercises the interactive parts, and saves screenshots.

       node render.js            all pages, all combos
       node render.js trust      one page

   Needs Playwright. The site itself has no dependencies; this
   harness does:
       npm install --no-save playwright
       npx playwright install chromium
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');

const ROOT_DIR = __dirname;

/* Playwright is resolved, never hard-coded. An absolute path here would ship
   the author's home directory — and the name of unrelated projects — to every
   reader of a public repo, while also making this harness unrunnable by
   anyone else. Tried in order: an explicit override, a normal install, then
   the repo's own node_modules. */
let chromium;
const tried = [];
for (const spec of [process.env.AIHUB_PLAYWRIGHT, 'playwright', path.join(ROOT_DIR, 'node_modules', 'playwright')]) {
  if (!spec) continue;
  tried.push(spec);
  try { ({ chromium } = require(spec)); break; } catch (e) { /* try the next one */ }
}
if (!chromium) {
  console.error('Playwright is not installed, so the rendered checks cannot run.');
  console.error('');
  console.error('  npm install --no-save playwright && npx playwright install chromium');
  console.error('');
  console.error('Or point AIHUB_PLAYWRIGHT at an existing install:');
  console.error('  AIHUB_PLAYWRIGHT=/path/to/node_modules/playwright node render.js');
  console.error('');
  console.error('The offline checks need nothing installed:  node verify.js && node test.js');
  process.exit(2);
}

const ROOT = __dirname;
const SHOTS = path.join(ROOT, 'render_shots');
const cfg = require(path.join(ROOT, 'site.config.js'));
const PAGES = cfg.pages.map((p) => p.file.replace(/\.html$/, ''));

/* Ground truth read straight from the SOURCE, with an independent parser.
   The rendered DOM is then compared against it — if the source says a page
   has 16 checkboxes and the browser shows 15, that is a real defect that a
   DOM-only harness would never notice. */
const fsx = require('fs');
function sourceTruth(slug) {
  /* Independence matters: reading the built .html would compare the browser
     against the very artifact it is rendering, so a build bug that dropped
     content from every layer would pass. Count from the SOURCE modules and
     the layout instead, so the build itself is what is under test. */
  const page = cfg.pages.find((pg) => pg.file === slug + '.html');
  const body = fsx.readFileSync(path.join(ROOT, 'src', 'pages', slug + '.js'), 'utf8');
  const layoutSrc = fsx.readFileSync(path.join(ROOT, 'src', 'layout.js'), 'utf8');
  // the front door's track grid is generated, not written in the page module
  const generatedTracks = /trackGrid\(\)/.test(body)
    ? cfg.pages.filter((pg) => pg.track).length + cfg.externalTracks.length : 0;
  // layout.js contributes the hero and the pager section
  const layoutSections = /<section>\n  <div class="wrap">\n    <div class="pager">/.test(layoutSrc) ? 1 : 0;
  const html = body;
  const count = (re) => (html.match(re) || []).length;
  return {
    h1: String(page.h1).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    sections: count(/<section[ >]/g) + layoutSections,
    h2: count(/<h2>/g),
    // each generated track card carries its own <h3>
    h3: count(/<h3[ >]/g) + generatedTracks,
    checkboxes: count(/<input type="checkbox"/g),
    accordions: count(/<details class="acc"/g),
    tables: count(/<table>/g),
    cards: count(/<div class="card">/g),
    tracks: count(/<a class="track"/g) + generatedTracks,
    prompts: count(/<div class="prompt-wrap"/g),
  };
}
/* The mobile combos declare touch. Without hasTouch/isMobile, Chromium still
   reports `hover: hover` and `pointer: fine` at 390px, so any CSS gated on
   `@media (hover: hover)` resolves the DESKTOP way and the harness cannot see
   what a phone sees. That is exactly the class of bug that left 11 copy
   buttons invisible on touch devices. */
const COMBOS = [
  { name: 'desktop-light', width: 1280, height: 900, scheme: 'light' },
  { name: 'desktop-dark', width: 1280, height: 900, scheme: 'dark' },
  { name: 'mobile-light', width: 390, height: 844, scheme: 'light', touch: true },
  { name: 'mobile-dark', width: 390, height: 844, scheme: 'dark', touch: true },
  { name: 'narrow-light', width: 320, height: 568, scheme: 'light', touch: true },
];

const UPDATE = process.argv.includes('--update');
/* --no-refs skips the pixel-reference comparison. The references are rendered
   on macOS; a Linux CI runner draws different font metrics, so comparing them
   there fails for the wrong reason. CI passes this flag; local runs never do. */
const NO_REFS = process.argv.includes('--no-refs');

/* SCREEN BUDGETS — phone screens at 390x844, accordions collapsed, per page.
   The five-persona panel's clearest finding was that content beyond a reader's
   attention span is invisible: only one of five read deeply, and the trust
   page's privacy section sat at 66% of 11.9 screens where a break-length
   reader never reached it. Prose trims kept being given back by additions, so
   the LENGTH itself is now locked: growing a page past its budget fails this
   harness. Like the host repo's page-weight budget, every raise must edit
   this table and say why — growth becomes a decision, not a drift.
   Values are the 2026-08-08 measurement plus ~0.8 screen of headroom. */
const SCREEN_BUDGET = {
  /* Re-tightened 2026-08-08 after the accordion decks and the table restack.
     The previous numbers had gone stale twice over — the grid/step decks and
     the four-week deck both landed without the budget following them down, so
     several screens of headroom were sitting there for the length to drift back
     into. Measured + ~0.4. Prior row, for the size of the move:
       index 9.6  map 11.5  trust 11.8  leverage 11.3  tools 8.8  further 13.3 */
  index: 6.7,     // 6.3 measured
  map: 10.2,      // 9.8 measured — ten accordions are one swipe row, not ten rows
  trust: 11.2,    // 10.8 measured
  leverage: 10.0, // 9.6 measured
  tools: 8.0,     // 7.6 measured
  further: 10.3,  // 9.9 measured — was the longest page; four checklists remain
};
const only = process.argv.slice(2).find((a) => !a.startsWith('--'));
const pages = only ? PAGES.filter((p) => p === only) : PAGES;
if (!pages.length) { console.error('Unknown page: ' + only); process.exit(2); }

const TEXT = {};   // combo -> page -> visible text, compared across viewports below
let fails = 0, checks = 0;
const check = (cond, msg) => { if (cond) checks++; else { fails++; console.log('    \x1b[31mFAIL\x1b[0m ' + msg); } };

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch();

  for (const combo of COMBOS) {
    console.log(`\n\x1b[1m${combo.name}\x1b[0m  (${combo.width}x${combo.height}, ${combo.scheme})`);
    const ctx = await browser.newContext({
      viewport: { width: combo.width, height: combo.height },
      colorScheme: combo.scheme,
      deviceScaleFactor: 1,
      hasTouch: !!combo.touch,
      isMobile: !!combo.touch,
    });

    for (const name of pages) {
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

      await page.goto('file://' + path.join(ROOT, name + '.html'));
      await page.waitForLoadState('networkidle');

      /* Screenshot FIRST, before anything below mutates the page. Taking it at
         the end captured the post-test state: every accordion forced closed
         (the old restore looked for a data-was-open attribute that is set
         nowhere), and on checklist pages a box already ticked and reloaded.
         The saved PNG was 4585px of all-closed tools.html against a shipped
         4707px. These images are what the eye-verification step reviews, so
         they have to be the page a visitor actually gets. */
      if (combo.name === 'desktop-light' || combo.name === 'mobile-dark') {
        await page.screenshot({ path: path.join(SHOTS, `${name}_${combo.name}.png`), fullPage: true });
      }

      /* ---- FEATURE TESTS (one combo — the logic is viewport-independent) ----
         These drive the real assets/app.js. Until now the copy buttons — the
         feature that already shipped broken once — were tested for visibility
         and occlusion but never CLICKED; expand/collapse-all and the reset
         button were presence-checked; and init()'s isolation claim ("one broken
         step cannot kill the rest") was a comment, not a test. */
      if (combo.name === 'desktop-light') {
        try {
          // copy button, clipboard path: stub the browser API deterministically
          // (headless file:// clipboard permissions are flaky); the stub records
          // what app.js hands it, so the wiring itself is what is under test.
          const copyPage = await ctx.newPage();
          await copyPage.addInitScript(() => {
            window.__copied = null;
            Object.defineProperty(navigator, 'clipboard', {
              value: { writeText: (t) => { window.__copied = t; return Promise.resolve(); } },
            });
          });
          await copyPage.goto('file://' + path.join(ROOT, name + '.html'));
          await copyPage.waitForLoadState('networkidle');
          const nPrompts = await copyPage.evaluate(() => document.querySelectorAll('.prompt-wrap').length);
          if (nPrompts > 0) {
            const r = await copyPage.evaluate(async () => {
              const w = document.querySelector('.prompt-wrap');
              const d = w.closest('details'); if (d) d.open = true;
              w.querySelector('.copy-btn').click();
              // the "Copied" label lands in writeText's .then() — a microtask
              // after the click returns; reading synchronously sees "Copy"
              await new Promise((res) => setTimeout(res, 30));
              return {
                copied: window.__copied,
                label: w.querySelector('.copy-btn').textContent,
                expected: w.querySelector('.prompt').textContent,
              };
            });
            check(r.copied === r.expected && r.copied.length > 10,
              `${name}: copy button copied ${r.copied === null ? 'NOTHING' : 'the wrong text'}`);
            check(r.label === 'Copied', `${name}: copy button label is "${r.label}", expected "Copied"`);

            // no-clipboard fallback: the API is gone entirely; app.js must
            // select the text and say so rather than dying.
            const fbPage = await ctx.newPage();
            await fbPage.addInitScript(() => {
              Object.defineProperty(navigator, 'clipboard', { value: undefined });
            });
            await fbPage.goto('file://' + path.join(ROOT, name + '.html'));
            await fbPage.waitForLoadState('networkidle');
            const fb = await fbPage.evaluate(() => {
              const w = document.querySelector('.prompt-wrap');
              const d = w.closest('details'); if (d) d.open = true;
              w.querySelector('.copy-btn').click();
              const sel = String(window.getSelection());
              return { label: w.querySelector('.copy-btn').textContent, selLen: sel.length,
                       matches: sel === w.querySelector('.prompt').textContent };
            });
            check(fb.label === 'Selected' && fb.matches,
              `${name}: no-clipboard fallback — label "${fb.label}", selection ${fb.matches ? 'ok' : 'wrong (' + fb.selLen + ' chars)'}`);
            await fbPage.close();
          }
          await copyPage.close();

          // expand/collapse-all must be SCOPED to its own section: "expand all"
          // in section A opening section B's accordions would pass every
          // presence check we have.
          const scoping = await page.evaluate(() => {
            const sections = [...document.querySelectorAll('section')].filter((sec) => sec.querySelector('.acc-tools'));
            if (sections.length === 0) return null;
            const target = sections[0];
            const others = sections.slice(1);
            const openIn = (root) => root.querySelectorAll('details.acc[open]').length;
            const accIn = (root) => root.querySelectorAll('details.acc').length;
            const othersBefore = others.map(openIn);
            target.querySelector('[data-acc="open"]').click();
            const allOpened = openIn(target) === accIn(target);
            const othersUntouched = others.every((sec, i) => openIn(sec) === othersBefore[i]);
            target.querySelector('[data-acc="close"]').click();
            const allClosed = openIn(target) === 0;
            return { allOpened, othersUntouched, allClosed, otherSections: others.length };
          });
          if (scoping) {
            check(scoping.allOpened, `${name}: "Expand all" did not open every accordion in its own section`);
            check(scoping.allClosed, `${name}: "Collapse all" did not close them`);
            if (scoping.otherSections > 0) {
              check(scoping.othersUntouched,
                `${name}: expand-all LEAKED into ${scoping.otherSections} other section(s) — the closest('section') scoping is broken`);
            }
          }

          // init() isolation: the comment in app.js claims a throwing
          // wireChecklists cannot kill the later steps. Prove it — break
          // localStorage before load, then the copy button must still work.
          const isoPage = await ctx.newPage();
          await isoPage.addInitScript(() => {
            Object.defineProperty(navigator, 'clipboard', {
              value: { writeText: () => Promise.resolve() },
            });
            const boom = () => { throw new Error('storage dead (injected)'); };
            Object.defineProperty(window, 'localStorage', {
              get() { return { getItem: boom, setItem: boom, removeItem: boom, key: boom, clear: boom, length: 0 }; },
            });
          });
          await isoPage.goto('file://' + path.join(ROOT, name + '.html'));
          await isoPage.waitForLoadState('networkidle');
          const iso = await isoPage.evaluate(async () => {
            const out = { nav: !!document.querySelector('.nav-links a[aria-current="page"]'), copy: null };
            const w = document.querySelector('.prompt-wrap');
            if (w) {
              const d = w.closest('details'); if (d) d.open = true;
              w.querySelector('.copy-btn').click();
              await new Promise((res) => setTimeout(res, 30));
              out.copy = w.querySelector('.copy-btn').textContent;
            }
            return out;
          });
          check(iso.nav, `${name}: with storage dead, the nav highlight died too — init() isolation failed`);
          if (iso.copy !== null) {
            check(iso.copy === 'Copied',
              `${name}: with storage dead, the copy button died (label "${iso.copy}") — a broken wireChecklists killed wireCopy`);
          }
          await isoPage.close();

          /* The storage-dead probe above cannot actually reach init()'s outer
             isolation: every localStorage call sits inside its own try/catch,
             so the fault is swallowed a level deeper and the probe passes even
             with the isolation deleted (falsification proved it). This one
             throws from the ONE unguarded call in wireChecklists —
             addEventListener on a checkbox — so the step genuinely dies, and
             only the outer isolation can keep the later steps alive. */
          const escPage = await ctx.newPage();
          await escPage.addInitScript(() => {
            Object.defineProperty(navigator, 'clipboard', {
              value: { writeText: () => Promise.resolve() },
            });
            const orig = EventTarget.prototype.addEventListener;
            EventTarget.prototype.addEventListener = function (t, f, o) {
              if (this && this.tagName === 'INPUT') throw new Error('injected: checklist wiring dies');
              return orig.call(this, t, f, o);
            };
          });
          await escPage.goto('file://' + path.join(ROOT, name + '.html'));
          await escPage.waitForLoadState('networkidle');
          const esc2 = await escPage.evaluate(async () => {
            const w = document.querySelector('.prompt-wrap');
            if (!w) return { copy: null, hasInputs: document.querySelectorAll('.checklist input').length > 0 };
            const d = w.closest('details'); if (d) d.open = true;
            w.querySelector('.copy-btn').click();
            await new Promise((res) => setTimeout(res, 30));
            return { copy: w.querySelector('.copy-btn').textContent,
                     hasInputs: document.querySelectorAll('.checklist input').length > 0 };
          });
          if (esc2.copy !== null && esc2.hasInputs) {
            check(esc2.copy === 'Copied',
              `${name}: a throw ESCAPING wireChecklists killed the copy buttons (label "${esc2.copy}") — init() steps are not isolated`);
          }
          await escPage.close();
        } catch (e) {
          check(false, `${name}: feature tests crashed — ${String(e.message).split('\n')[0]}`);
        }
      }

      const m = await page.evaluate(() => {
        const el = (s) => document.querySelector(s);
        const els = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
        const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.x, w: r.width, h: r.height, top: r.top + window.scrollY }; };

        // container alignment: every .wrap plus .nav-inner must share one left edge
        const wraps = els('.wrap').map(box);
        const nav = el('.nav-inner') ? box(el('.nav-inner')) : null;

        // sections that render tall but empty
        const emptySections = els('section').filter((s) => {
          const r = s.getBoundingClientRect();
          return r.height > 0 && s.innerText.trim().length < 20;
        }).map((s) => s.id || '(unnamed)');

        // any element whose right edge escapes the viewport
        const vw = document.documentElement.clientWidth;
        const escapes = els('body *').filter((e) => {
          const st = getComputedStyle(e);
          if (st.position === 'absolute' || st.position === 'fixed') return false;
          if (st.overflowX === 'auto' || st.overflowX === 'scroll') return false;
          /* An element inside a horizontally scrollable ancestor cannot push the
             PAGE sideways — the ancestor scrolls instead. This used to be a list of
             known scroller classes (.tscroll, .nav-links), which meant every new
             scrolling region had to be added by hand or it produced a false red;
             the mobile swipe decks did exactly that on all six pages while
             document.scrollWidth stayed equal to clientWidth at both 390px and
             320px. Ask the DOM whether an ancestor scrolls instead of naming them,
             and the exemption list stops growing. The authoritative page-level
             signal is still docOverflow above, which is unaffected by this. */
          for (var a = e.parentElement; a && a !== document.body; a = a.parentElement) {
            var as = getComputedStyle(a);
            if (as.overflowX === 'auto' || as.overflowX === 'scroll') return false;
          }
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1);
        }).map((e) => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));

        /* Text clipped by a box that hides its overflow.
           The previous version skipped anything with `overflow: visible` —
           which is the default for every tag it looked at, so it examined
           0 of 123 candidates and could never fail. Scan the CLIPPING boxes
           instead: any element that hides overflow and whose content does
           not fit, plus any text whose rect escapes such an ancestor. */
        const isScroller = (e) => e.closest('.tscroll') || e.closest('.nav-links');
        const clippers = els('body *').filter((e) => {
          const st = getComputedStyle(e);
          const hides = (v) => v === 'hidden' || v === 'clip';
          return (hides(st.overflowY) || hides(st.overflowX)) && !isScroller(e) && !e.closest('details:not([open])');
        });
        const clipped = clippers.filter((e) =>
          e.scrollHeight > e.clientHeight + 2 || e.scrollWidth > e.clientWidth + 2
        ).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]);
        const clippedText = els('p, h1, h2, h3, h4, li, td, th, summary').filter((e) => {
          const box = e.parentElement && clippers.find((c) => c.contains(e));
          if (!box || box === e) return false;
          const r = e.getBoundingClientRect(), br = box.getBoundingClientRect();
          return r.height > 0 && (r.bottom > br.bottom + 2 || r.right > br.right + 2);
        }).map((e) => e.tagName.toLowerCase() + ':' + e.innerText.slice(0, 25));

        // cards that collapsed to nothing
        const deadCards = els('.card, .track, .note, .acc').filter((e) => {
          const r = e.getBoundingClientRect();
          return r.height < 8;
        }).length;

        return {
          docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          wrapLefts: [...new Set(wraps.map((w) => Math.round(w.x)))],
          wrapWidths: [...new Set(wraps.map((w) => Math.round(w.w)))],
          navLeft: nav ? Math.round(nav.x) : null,
          navH: nav ? Math.round(nav.h) : null,
          emptySections,
          escapes: [...new Set(escapes)],
          clipped,
          clippedText,
          clippers: clippers.length,
          deadCards,
          h1: el('h1') ? el('h1').innerText.trim() : '',
          h1H: el('h1') ? Math.round(box(el('h1')).h) : 0,
          currentNav: els('.nav-links a[aria-current="page"]').map((a) => a.getAttribute('href')),
          pageH: Math.round(document.body.scrollHeight),
          accClosed: els('details.acc:not([open])').length,
          accOpen: els('details.acc[open]').length,
        };
      });

      const label = `${name}`.padEnd(9);
      console.log(`  ${label} h=${String(m.pageH).padStart(5)}px  wrap x=${m.wrapLefts.join('/')} w=${m.wrapWidths.join('/')}`);

      /* --- layout invariants --- */
      check(m.docOverflow <= 1, `${name}: page scrolls horizontally by ${m.docOverflow}px`);
      check(m.wrapLefts.length === 1, `${name}: .wrap containers do not share one left edge (${m.wrapLefts.join(', ')})`);
      check(m.wrapWidths.length === 1, `${name}: .wrap containers have different widths (${m.wrapWidths.join(', ')})`);
      check(m.navLeft === m.wrapLefts[0], `${name}: nav left edge ${m.navLeft} != content left edge ${m.wrapLefts[0]} (logo would misalign with content)`);

      /* THE NAV MUST NOT NEED A SIDEWAYS SWIPE.
         .nav-links is exempt from the escape scan above because it is a legitimate
         scroll container — which is exactly why 157px of navigation could hide at
         390px and every check stayed green. A reader reported it; the harness
         could not. Being *able* to scroll is fine; needing to is not. */
      const navFit = await page.evaluate(() => {
        const n = document.querySelector('.nav-links');
        if (!n) return null;
        const links = [...n.querySelectorAll('a')];
        return {
          hidden: n.scrollWidth - n.clientWidth,
          offscreen: links.filter((a) => a.getBoundingClientRect().right > innerWidth + 0.5)
            .map((a) => a.textContent.trim()),
        };
      });
      if (navFit) {
        check(navFit.hidden <= 1,
          `${name}: ${navFit.hidden}px of the nav is only reachable by scrolling it sideways`);
        check(navFit.offscreen.length === 0,
          `${name}: nav links off the right edge of the screen: ${navFit.offscreen.join(', ')}`);
      }
      /* SAME FAILURE, SECOND PLACE: every table carried min-width:460px, so on a
         390px phone six sections each hid 106px of a comparison behind a sideways
         scroll on a table with no visible affordance. .tscroll is exempt from the
         clipped-text scan for the same reason .nav-links was, so nothing failed.
         Rows stack into cards on a phone now; this is the guard that keeps them
         stacked. A deck the reader can SEE is swipeable is fine — a table is not. */
      const tblFit = await page.evaluate(() =>
        [...document.querySelectorAll('.tscroll')]
          .filter((d) => d.clientWidth > 0)
          .map((d) => ({
            hidden: Math.round(d.scrollWidth - d.clientWidth),
            what: (d.closest('section') || {}).id || '?',
          }))
          .filter((x) => x.hidden > 1)
      );
      check(tblFit.length === 0,
        `${name}: table content only reachable by scrolling sideways: ` +
        tblFit.map((x) => `#${x.what} hides ${x.hidden}px`).join(', '));

      check(m.navH > 20, `${name}: nav collapsed (height ${m.navH})`);
      check(m.emptySections.length === 0, `${name}: sections render tall but empty: ${m.emptySections.join(', ')}`);
      check(m.escapes.length === 0, `${name}: elements escape the viewport: ${m.escapes.slice(0, 5).join(', ')}`);

      /* Content inside a CLOSED accordion is legitimately zero-height, so the
         as-shipped scan cannot judge it — and skipping it would leave a blind
         spot exactly where most of the content lives. Open everything and
         re-measure instead. */
      const open = await page.evaluate(() => {
        const els = (s) => Array.prototype.slice.call(document.querySelectorAll(s));
        const wasClosed = els('details.acc:not([open])');
        wasClosed.forEach((d) => { d.open = true; });

        const vw = document.documentElement.clientWidth;
        const clipped = els('p, h1, h2, h3, h4, li, td, th, summary').filter((e) => {
          const st = getComputedStyle(e);
          if (st.overflow === 'visible') return false;
          return e.scrollHeight > e.clientHeight + 2;
        }).map((e) => e.tagName.toLowerCase() + ':' + e.innerText.slice(0, 30));

        const dead = els('.card, .track, .note, .acc, .acc-body').filter((e) => {
          return e.getBoundingClientRect().height < 8;
        }).map((e) => String(e.className) + ':' + e.innerText.slice(0, 30));

        const escapes = els('body *').filter((e) => {
          const st = getComputedStyle(e);
          if (st.position === 'absolute' || st.position === 'fixed') return false;
          if (st.overflowX === 'auto' || st.overflowX === 'scroll') return false;
          /* An element inside a horizontally scrollable ancestor cannot push the
             PAGE sideways — the ancestor scrolls instead. This used to be a list of
             known scroller classes (.tscroll, .nav-links), which meant every new
             scrolling region had to be added by hand or it produced a false red;
             the mobile swipe decks did exactly that on all six pages while
             document.scrollWidth stayed equal to clientWidth at both 390px and
             320px. Ask the DOM whether an ancestor scrolls instead of naming them,
             and the exemption list stops growing. The authoritative page-level
             signal is still docOverflow above, which is unaffected by this. */
          for (var a = e.parentElement; a && a !== document.body; a = a.parentElement) {
            var as = getComputedStyle(a);
            if (as.overflowX === 'auto' || as.overflowX === 'scroll') return false;
          }
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1);
        }).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]);

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        wasClosed.forEach((d) => { d.open = false; });
        return { clipped, dead, escapes: [...new Set(escapes)], overflow, opened: wasClosed.length };
      });

      check(m.clipped.length === 0, `${name}: content overflows a box that hides it: ${m.clipped.slice(0, 3).join(', ')}`);
      check(m.clippedText.length === 0, `${name}: text escapes a clipping ancestor: ${m.clippedText.slice(0, 3).join(' | ')}`);
      check(open.clipped.length === 0, `${name}: text clipped once expanded: ${open.clipped.slice(0, 3).join(' | ')}`);
      /* Was `m.deadCards === 0 || open.dead.length === 0`. m.deadCards is 0 on
         four of six pages, so the left operand short-circuited and the expanded
         scan — the only one that sees inside accordions — was computed and
         thrown away. Assert on the expanded scan alone; the as-shipped count is
         reported but cannot be used to skip it. */
      check(open.dead.length === 0,
        `${name}: cards collapsed to zero height with everything expanded: ${open.dead.slice(0, 3).join(' | ')}`);
      check(open.escapes.length === 0, `${name}: elements escape the viewport once expanded: ${open.escapes.slice(0, 5).join(', ')}`);
      check(open.overflow <= 1, `${name}: page scrolls horizontally by ${open.overflow}px once expanded`);
      check(m.h1H > 20, `${name}: h1 has no height`);
      check(m.pageH > 800, `${name}: page is suspiciously short (${m.pageH}px)`);
      if (combo.name === 'mobile-light') {
        const screens = m.pageH / combo.height;
        check(screens <= SCREEN_BUDGET[name],
          `${name}: ${screens.toFixed(1)} phone screens exceeds its budget of ${SCREEN_BUDGET[name]} — ` +
          `cut something, or raise the budget in render.js WITH a written reason`);
      }
      check(m.currentNav.length === 1 && m.currentNav[0] === name + '.html',
        `${name}: nav highlight is ${JSON.stringify(m.currentNav)}, expected ["${name}.html"]`);


      check(consoleErrors.length === 0, `${name}: console errors: ${consoleErrors.slice(0, 2).join(' | ')}`);

      /* --- every interactive control must be usable at this viewport ---
         The copy buttons were opacity:0 behind a :hover that a phone cannot
         produce: 11 dead buttons on leverage.html at 390px, on a site whose
         hero says "Works on a phone". Nothing measured visibility, and the
         contrast scan happily graded the invisible button's colour. */
      const controls = await page.evaluate(() => {
        return [...document.querySelectorAll('button, a.btn, input[type=checkbox], .copy-btn')]
          .map((e) => {
            const st = getComputedStyle(e);
            const r = e.getBoundingClientRect();
            /* OCCLUSION. Opacity and size were not enough: the copy button was
               fully opaque and correctly sized while `.prompt` — position:
               relative and later in the DOM — painted straight over it. Ask
               the browser what is actually on top at the control's centre. */
            let covered = null;
            if (r.width > 0 && r.height > 0) {
              e.scrollIntoView({ block: 'center' });
              const rr = e.getBoundingClientRect();
              const cx = rr.left + rr.width / 2, cy = rr.top + rr.height / 2;
              if (cx >= 0 && cy >= 0 && cx <= innerWidth && cy <= innerHeight) {
                const hit = document.elementFromPoint(cx, cy);
                if (hit && hit !== e && !e.contains(hit) && !hit.contains(e)) {
                  covered = hit.tagName.toLowerCase() + '.' + String(hit.className).split(' ')[0];
                }
              }
            }
            let cum = 1;
            for (let n = e; n; n = n.parentElement) cum *= Number(getComputedStyle(n).opacity);
            return {
              what: e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0],
              opacity: cum,
              w: Math.round(r.width), h: Math.round(r.height),
              covered,
              hidden: st.display === 'none' || st.visibility === 'hidden',
              inClosed: !!e.closest('details:not([open])'),
            };
          })
          .filter((c) => !c.inClosed && !c.hidden);
      });
      /* Navigation links are controls too. The general prose-link case is
         deliberately excluded — flagging every inline link would be noise —
         but anything in the nav or the footer is something a reader is meant
         to tap, and on a phone a 16px target is a miss waiting to happen. */
      const navTargets = await page.evaluate(() => {
        return [...document.querySelectorAll('.nav-links a, .foot a')]
          .map((a) => { const r = a.getBoundingClientRect();
            return { text: a.textContent.trim().slice(0, 20), h: Math.round(r.height), w: Math.round(r.width) }; })
          .filter((t) => t.h > 0 && t.h < 20);
      });
      check(navTargets.length === 0,
        `${name}: ${navTargets.length} nav/footer tap targets under 20px tall (${navTargets.map((t) => t.text + ' ' + t.h + 'px').join(', ')})`);

      const buried = controls.filter((c) => c.covered);
      check(buried.length === 0,
        `${name}: ${buried.length} controls are painted over and cannot be clicked (${[...new Set(buried.map((c) => c.what + ' under ' + c.covered))].join(', ')})`);
      const invisible = controls.filter((c) => c.opacity < 0.6);
      const tiny = controls.filter((c) => c.w < 14 || c.h < 14);
      check(invisible.length === 0,
        `${name}: ${invisible.length} interactive controls render below opacity 0.6 (${[...new Set(invisible.map((c) => c.what + ' @' + c.opacity))].join(', ')})`);
      check(tiny.length === 0,
        `${name}: ${tiny.length} controls are under 14px (${[...new Set(tiny.map((c) => c.what + ' ' + c.w + 'x' + c.h))].join(', ')})`);

      /* --- SOURCE -> DOM parity: what the code says must be what renders --- */
      const truth = sourceTruth(name);
      const dom = await page.evaluate(() => {
        const n = (s) => document.querySelectorAll(s).length;
        return {
          h1: (document.querySelector('h1') || {}).textContent.replace(/\s+/g, ' ').trim(),
          sections: n('section'),
          h2: n('h2'),
          h3: n('h3'),
          checkboxes: n('input[type=checkbox]'),
          accordions: n('details.acc'),
          tables: n('table'),
          cards: n('.card'),
          tracks: n('a.track'),
          prompts: n('.prompt-wrap'),
          navLabels: [...document.querySelectorAll('.nav-links a')].map((a) => a.textContent.trim()),
          // text of every checklist label, to prove none is silently empty
          emptyLabels: [...document.querySelectorAll('.checklist label')].filter((l) => !l.textContent.trim()).length,
          // any accordion whose summary renders no words
          emptySummaries: [...document.querySelectorAll('.acc > summary')].filter((s) => s.textContent.replace(/^\d+/, '').trim().length < 3).length,
        };
      });
      for (const k of ['sections', 'h2', 'h3', 'checkboxes', 'accordions', 'tables', 'cards', 'tracks', 'prompts']) {
        check(dom[k] === truth[k], `${name}: source declares ${truth[k]} ${k} but the DOM renders ${dom[k]}`);
      }
      check(dom.h1 === truth.h1, `${name}: h1 mismatch — source "${truth.h1}" vs DOM "${dom.h1}"`);
      check(dom.emptyLabels === 0, `${name}: ${dom.emptyLabels} checklist labels render with no text`);
      check(dom.emptySummaries === 0, `${name}: ${dom.emptySummaries} accordion summaries render with no text`);

      /* the nav must match site.config.js exactly, in order */
      const wantNav = cfg.pages.map((p) => p.nav);
      check(JSON.stringify(dom.navLabels) === JSON.stringify(wantNav),
        `${name}: nav is ${JSON.stringify(dom.navLabels)}, site.config.js says ${JSON.stringify(wantNav)}`);

      /* the visible text is recorded per combo so desktop and mobile can be
         compared afterwards — a media query must never DROP content */
      TEXT[combo.name] = TEXT[combo.name] || {};
      TEXT[combo.name][name] = await page.evaluate(() => {
        document.querySelectorAll('details').forEach((d) => { d.open = true; });
        const t = document.body.innerText.replace(/\s+/g, ' ').trim();
        document.querySelectorAll('details.acc').forEach((d) => { d.open = d.hasAttribute('data-was-open'); });
        return t;
      });

      /* --- WCAG AA contrast on every piece of rendered text --- */
      const contrast = await page.evaluate(() => {
        // Chrome reports color-mix() backgrounds as "color(srgb 0..1 ...)".
        // Parsing those as 0-255 produced false failures on the first run —
        // both notations must be handled or the check lies.
        /* Returns [r,g,b,a]. The previous version threw the alpha away and
           returned null for fully transparent text — which the caller treated
           as "skip", so `color: transparent` and `rgba(...,0.1)` both PASSED.
           Alpha is now kept and composited, and invisible text is a failure. */
        const parse = (s) => {
          if (!s) return null;
          if (s.startsWith('color(')) {
            const n = s.match(/[\d.]+/g).map(Number);
            return [n[0] * 255, n[1] * 255, n[2] * 255, n.length > 3 ? n[3] : 1];
          }
          const n = (s.match(/[\d.]+/g) || []).map(Number);
          if (n.length < 3) return null;
          return [n[0], n[1], n[2], n.length >= 4 ? n[3] : 1];
        };
        // src over dst
        const over = (fg, bg) => {
          const a = fg[3];
          return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a)).concat([1]);
        };
        const lum = (c) => {
          const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        /* Composite every semi-transparent background down the ancestor chain
           instead of stopping at the first one and pretending it is opaque. */
        const bgOf = (e) => {
          const stack = [];
          let n = e;
          while (n) {
            const c = parse(getComputedStyle(n).backgroundColor);
            if (c && c[3] > 0) { stack.push(c); if (c[3] === 1) break; }
            n = n.parentElement;
          }
          let out = [255, 255, 255, 1];
          for (let i = stack.length - 1; i >= 0; i--) out = over(stack[i], out);
          return out;
        };
        const bad = [];
        document.querySelectorAll('p,li,h1,h2,h3,h4,span,td,th,a,label,summary,button,strong,em').forEach((e) => {
          if (!e.innerText || !e.innerText.trim()) return;
          if (e.querySelector('p,li,div,td,h2,h3,h4')) return;      // measure leaves only
          if (e.getBoundingClientRect().height === 0) return;        // hidden
          const st = getComputedStyle(e);
          const fgRaw = parse(st.color); if (!fgRaw) return;
          /* Fold in the cumulative `opacity` of this element and its ancestors.
             Without it a button at opacity 0.45 was graded on its raw colour
             and passed while being unreadable on screen — the exact bug that
             shipped once already. */
          let cum = 1;
          for (let n = e; n; n = n.parentElement) cum *= Number(getComputedStyle(n).opacity);
          fgRaw[3] *= cum;
          if (fgRaw[3] < 0.02) { bad.push(`${st.fontSize} INVISIBLE (effective alpha ${fgRaw[3].toFixed(2)}) "${e.innerText.slice(0, 28)}"`); return; }
          const bg = bgOf(e);
          const L1 = lum(over(fgRaw, bg)), L2 = lum(bg);
          const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
          const size = parseFloat(st.fontSize), bold = parseInt(st.fontWeight, 10) >= 700;
          const min = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
          if (ratio < min) bad.push(`${st.fontSize} ${st.color} ${ratio.toFixed(2)}:1 <${min} "${e.innerText.slice(0, 28)}"`);
        });
        return [...new Set(bad)];
      });
      check(contrast.length === 0, `${name}: text below WCAG AA contrast: ${contrast.slice(0, 3).join(' | ')}`);

      /* --- the interactive parts must actually work --- */
      if (m.accClosed > 0) {
        const accWorks = await page.evaluate(() => {
          const d = document.querySelector('details.acc:not([open])');
          const body = d.querySelector('.acc-body');
          const before = body.getBoundingClientRect().height;
          d.open = true;
          const after = body.getBoundingClientRect().height;
          d.open = false;
          return { before, after };
        });
        check(accWorks.before === 0, `${name}: a closed accordion still shows its body (${accWorks.before}px) — the display:none override failed`);
        check(accWorks.after > 10, `${name}: opening an accordion revealed nothing`);
      }

      /* EVERY checklist, not just the first — further.html has four, and only
         one was ever exercised. Wrapped so one flaky click reports as a normal
         failure instead of a raw stack that kills all remaining pages. */
      const listCount = await page.evaluate(() => document.querySelectorAll('.checklist').length);
      for (let li = 0; li < listCount; li++) {
        try {
          const read = () => page.evaluate((i) => {
            const list = document.querySelectorAll('.checklist')[i];
            const prog = list.parentElement.querySelector('.progress');
            return {
              count: prog.querySelector('[data-count]').textContent,
              bar: prog.querySelector('.bar > i').style.width,
              boxes: list.querySelectorAll('input[type=checkbox]').length,
            };
          }, li);

          const before = await read();
          await page.evaluate((i) => {
            const box = document.querySelectorAll('.checklist')[i].querySelector('input[type=checkbox]');
            box.click();
          }, li);
          const after = await read();

          check(before.count !== after.count,
            `${name}: checklist ${li + 1}: ticking a box did not update its own counter ("${before.count}")`);
          check(after.count === '1 of ' + after.boxes,
            `${name}: checklist ${li + 1}: counter reads "${after.count}", expected "1 of ${after.boxes}"`);
          check(after.bar && after.bar !== '0%', `${name}: checklist ${li + 1}: progress bar did not fill`);

          await page.reload();
          await page.waitForLoadState('networkidle');
          const persisted = await read();
          check(persisted.count === after.count,
            `${name}: checklist ${li + 1}: tick did not persist across reload ("${persisted.count}")`);

          /* Clean up by clicking the REAL reset button instead of wiping
             localStorage by hand — the wipe tested nothing, the button was
             presence-checked only. It must zero its own counter and bar AND
             remove the stored keys. */
          const afterReset = await page.evaluate((i) => {
            const list = document.querySelectorAll('.checklist')[i];
            const prog = list.parentElement.querySelector('.progress');
            prog.querySelector('.reset-btn').click();
            return {
              count: prog.querySelector('[data-count]').textContent,
              bar: prog.querySelector('.bar > i').style.width,
              keys: Object.keys(localStorage).filter((k) => k.startsWith('aihub:check:')).length,
            };
          }, li);
          check(afterReset.count === '0 of ' + before.boxes,
            `${name}: checklist ${li + 1}: reset left the counter at "${afterReset.count}"`);
          check(afterReset.bar === '0%', `${name}: checklist ${li + 1}: reset left the bar at ${afterReset.bar}`);
          check(afterReset.keys === 0, `${name}: checklist ${li + 1}: reset left ${afterReset.keys} stored keys behind`);
          await page.reload();
          await page.waitForLoadState('networkidle');
        } catch (e) {
          check(false, `${name}: checklist ${li + 1}: interaction failed — ${String(e.message).split('\n')[0]}`);
        }
      }

      await page.close();
    }
    await ctx.close();
  }

  /* ---- PIXEL REFERENCES --------------------------------------------
     Ported from AI_Technology's visual.js, at 1/4 its corpus: full-page only,
     the 12 shots already taken (6 pages x desktop-light + mobile-dark), no
     per-section grid, no 4-theme matrix. What it buys: a colour-token change,
     a spacing collapse, or a dark-mode-only vanish now FAILS with a named
     region instead of shipping while a human forgets to look at the PNGs.
     A's hard-won rules kept: a missing ref is a failure, not a self-approval;
     --update is REFUSED while anything else is red (an injected bug once got
     blessed into all of A's references); failures write the pair plus a diff
     image to render_diff/ so the change can be reviewed by eye.
     The diff runs inside Chromium itself (canvas), so no new dependency. */
  if (!only && !NO_REFS) {
    const REF = path.join(ROOT, 'render_ref');
    const DIFF = path.join(ROOT, 'render_diff');
    const shots = fs.readdirSync(SHOTS).filter((f) => f.endsWith('.png')).sort();
    console.log('\n\x1b[1mpixel references\x1b[0m  (' + (UPDATE ? 'updating' : 'comparing') + ' ' + shots.length + ' full-page images)');

    if (UPDATE) {
      if (fails > 0) {
        console.log('    \x1b[31mREFUSED\x1b[0m --update while ' + fails + ' other check(s) are red — fix them first, then re-approve.');
      } else {
        fs.mkdirSync(REF, { recursive: true });
        for (const f of shots) fs.copyFileSync(path.join(SHOTS, f), path.join(REF, f));
        console.log('    wrote ' + shots.length + ' reference image(s) — commit render_ref/');
      }
    } else if (!fs.existsSync(REF)) {
      console.log('    no render_ref/ yet — run node render.js --update once (all-green) to create it');
    } else {
      fs.mkdirSync(DIFF, { recursive: true });
      const diffPage = await browser.newPage();
      for (const f of shots) {
        const refPath = path.join(REF, f);
        if (!fs.existsSync(refPath)) {
          check(false, `pixel ref missing for ${f} — a new page/combo needs a deliberate --update`);
          continue;
        }
        const r = await diffPage.evaluate(async ([a, b]) => {
          const load = (src) => new Promise((res, rej) => {
            const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = src;
          });
          const [ia, ib] = await Promise.all([load(a), load(b)]);
          if (ia.width !== ib.width || ia.height !== ib.height) {
            return { size: `${ia.width}x${ia.height} -> ${ib.width}x${ib.height}` };
          }
          const w = ia.width, h = ia.height;
          const cv = (im) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
            const x = c.getContext('2d'); x.drawImage(im, 0, 0); return x.getImageData(0, 0, w, h).data; };
          const da = cv(ia), db = cv(ib);
          let n = 0, minX = w, minY = h, maxX = 0, maxY = 0;
          for (let i = 0; i < da.length; i += 4) {
            if (Math.abs(da[i] - db[i]) > 24 || Math.abs(da[i + 1] - db[i + 1]) > 24 || Math.abs(da[i + 2] - db[i + 2]) > 24) {
              n++;
              const px = (i / 4) % w, py = Math.floor((i / 4) / w);
              if (px < minX) minX = px; if (px > maxX) maxX = px;
              if (py < minY) minY = py; if (py > maxY) maxY = py;
            }
          }
          return { n, region: n ? `${maxX - minX + 1}x${maxY - minY + 1} at (${minX},${minY})` : null };
        }, [
          // data: URIs — Chromium refuses file:// image loads from about:blank
          'data:image/png;base64,' + fs.readFileSync(refPath).toString('base64'),
          'data:image/png;base64,' + fs.readFileSync(path.join(SHOTS, f)).toString('base64'),
        ]);

        if (r.size) {
          check(false, `${f}: page size changed ${r.size} — review, then --update if intended`);
          fs.copyFileSync(refPath, path.join(DIFF, f.replace('.png', '_ref.png')));
          fs.copyFileSync(path.join(SHOTS, f), path.join(DIFF, f.replace('.png', '_now.png')));
        } else if (r.n > 120) {   // absolute pixels, A's lesson: a % hides small-page damage
          check(false, `${f}: ${r.n} pixels changed, region ${r.region} — review render_diff/, then --update if intended`);
          fs.copyFileSync(refPath, path.join(DIFF, f.replace('.png', '_ref.png')));
          fs.copyFileSync(path.join(SHOTS, f), path.join(DIFF, f.replace('.png', '_now.png')));
        } else {
          checks++;
        }
      }
      await diffPage.close();
      console.log('    ' + shots.length + ' image(s) compared against committed references');
    }
  }

  /* ---- THE DEPLOYED SHAPE ------------------------------------------
     Everything above loads file://.../trust.html, so it only ever sees the
     hrefs we authored. The host does not serve those. Netlify's pretty URLs
     rewrote href="map.html" into href="/hub/map", and the nav highlight died
     on every live page while this harness stayed green — the bug shipped.

     So: serve the built pages over HTTP under /hub/ exactly as the host does
     — pretty URLs, and hrefs rewritten the same way — and run the REAL
     assets/app.js against them. No logic is duplicated here; if app.js is
     wrong, this fails. */
  {
    const http = require('http');
    const rewrite = (html) => html.replace(/href="([a-z0-9-]+)\.html(#[^"]*)?"/g,
      (m, f, frag) => `href="${f === 'index' ? '/hub/' : '/hub/' + f}${frag || ''}"`);

    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (!p.startsWith('/hub')) { res.writeHead(404); return res.end(); }
      let rel = p.replace(/^\/hub\/?/, '') || 'index';
      if (rel.startsWith('assets/')) {
        const f = path.join(ROOT, rel);
        if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
        const type = rel.endsWith('.css') ? 'text/css' : rel.endsWith('.js') ? 'text/javascript'
          : rel.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
        res.writeHead(200, { 'content-type': type });
        return res.end(fs.readFileSync(f));
      }
      const file = path.join(ROOT, rel.replace(/\/$/, '') + '.html');
      if (!fs.existsSync(file)) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(rewrite(fs.readFileSync(file, 'utf8')));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;

    console.log('\n\x1b[1mdeployed shape\x1b[0m  (served under /hub/ with host-style pretty URLs)');
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    for (const name of pages) {
      const url = `http://127.0.0.1:${port}/hub/` + (name === 'index' ? '' : name);
      const pg = await ctx.newPage();
      const errs = [];
      pg.on('pageerror', (e) => errs.push(e.message));
      await pg.goto(url, { waitUntil: 'networkidle' });
      const r = await pg.evaluate(() => ({
        current: [...document.querySelectorAll('.nav-links a[aria-current="page"]')].map((a) => a.textContent.trim()),
        styled: getComputedStyle(document.body).backgroundColor,
        navHrefs: [...document.querySelectorAll('.nav-links a')].map((a) => a.getAttribute('href')),
      }));
      const want = cfg.pages.find((q) => q.file === name + '.html').nav;
      check(r.current.length === 1 && r.current[0] === want,
        `${name}: served at /hub/, the nav highlight is ${JSON.stringify(r.current)} — expected exactly ["${want}"]`);
      check(r.styled !== 'rgba(0, 0, 0, 0)', `${name}: stylesheet did not load when served under /hub/`);
      check(errs.length === 0, `${name}: page errors under /hub/: ${errs.join(' | ')}`);
      check(r.navHrefs.every((h) => h.startsWith('/hub/')), `${name}: rewrite did not apply — ${JSON.stringify(r.navHrefs)}`);
      await pg.close();
    }
    await ctx.close();
    await new Promise((r) => server.close(r));
    console.log(`  ${pages.length} pages served and checked as the host serves them`);
  }

  await browser.close();

  /* ---- desktop vs mobile: same content, different layout -------------
     A media query is allowed to RE-ARRANGE the page. It is never allowed
     to REMOVE content: that is how a mobile reader silently loses a
     section nobody notices is missing. */
  console.log('\n\x1b[1mdesktop vs mobile parity\x1b[0m');
  const dl = TEXT['desktop-light'] || {}, ml = TEXT['mobile-light'] || {};
  const dd = TEXT['desktop-dark'] || {}, nl = TEXT['narrow-light'] || {};
  for (const name of pages) {
    if (dl[name] && ml[name]) {
      const same = dl[name] === ml[name];
      check(same, `${name}: mobile shows different text from desktop (${dl[name].length} vs ${ml[name].length} chars) — a media query is hiding content`);
      if (same) console.log(`  ${name.padEnd(9)} desktop == mobile  (${dl[name].length} chars of visible text)`);
    }
    if (dl[name] && dd[name]) {
      check(dl[name] === dd[name], `${name}: dark mode shows different text from light mode`);
    }
    if (dl[name] && nl[name]) {
      check(dl[name] === nl[name], `${name}: 320px shows different text from desktop`);
    }
  }

  console.log('\n' + '='.repeat(58));
  if (fails === 0) {
    console.log(`\x1b[32mPASS\x1b[0m  ${checks} rendered checks across ${pages.length} pages x ${COMBOS.length} combos.`);
    console.log(`      screenshots: render_shots/`);
    process.exit(0);
  } else {
    console.log(`\x1b[31mFAIL\x1b[0m  ${fails} failure(s) out of ${checks + fails} rendered checks.`);
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
