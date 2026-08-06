#!/usr/bin/env node
/* ============================================================
   AI Hub — RENDERED verification.
   A static CSS read cannot see a layout bug. This drives the real
   pages in real Chromium at 4 viewport/theme combinations, measures
   the DOM, exercises the interactive parts, and saves screenshots.

       node render.js            all pages, all combos
       node render.js trust      one page

   Playwright is borrowed from a sibling project rather than
   installed again here — this repo stays dependency-free.
   ============================================================ */
'use strict';

const path = require('path');
const fs = require('fs');

const SIBLING = '<resolved at runtime>';
module.paths.unshift(SIBLING);
let chromium;
try {
  ({ chromium } = require(path.join(SIBLING, 'playwright')));
} catch (e) {
  console.error('Could not load Playwright from ' + SIBLING);
  console.error('Run the static harness instead:  node verify.js');
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
  const html = fsx.readFileSync(path.join(ROOT, slug + '.html'), 'utf8');
  const count = (re) => (html.match(re) || []).length;
  return {
    h1: (html.match(/<h1>([\s\S]*?)<\/h1>/) || [, ''])[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    sections: count(/<section[ >]/g),
    h2: count(/<h2>/g),
    h3: count(/<h3[ >]/g),
    checkboxes: count(/<input type="checkbox"/g),
    accordions: count(/<details class="acc"/g),
    tables: count(/<table>/g),
    cards: count(/<div class="card">/g),
    tracks: count(/<a class="track"/g),
    prompts: count(/<div class="prompt-wrap"/g),
    navLabels: (html.match(/<div class="nav-links">([\s\S]*?)<\/div>/) || [, ''])[1]
      .match(/>([^<]+)<\/a>/g) ? (html.match(/<div class="nav-links">([\s\S]*?)<\/div>/)[1]
      .match(/>([^<]+)<\/a>/g).map((s) => s.slice(1, -4))) : [],
  };
}
const COMBOS = [
  { name: 'desktop-light', width: 1280, height: 900, scheme: 'light' },
  { name: 'desktop-dark', width: 1280, height: 900, scheme: 'dark' },
  { name: 'mobile-light', width: 390, height: 844, scheme: 'light' },
  { name: 'mobile-dark', width: 390, height: 844, scheme: 'dark' },
];

const only = process.argv[2];
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
    });

    for (const name of pages) {
      const page = await ctx.newPage();
      const consoleErrors = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + e.message));

      await page.goto('file://' + path.join(ROOT, name + '.html'));
      await page.waitForLoadState('networkidle');

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
          if (e.closest('.tscroll') || e.closest('.nav-links')) return false;
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1);
        }).map((e) => e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : ''));

        // text that is clipped by its own box
        const clipped = els('p, h1, h2, h3, h4, li, td, th, summary').filter((e) => {
          const st = getComputedStyle(e);
          if (st.overflow === 'visible') return false;
          return e.scrollHeight > e.clientHeight + 2;
        }).length;

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
          if (e.closest('.tscroll') || e.closest('.nav-links')) return false;
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > vw + 1 || r.left < -1);
        }).map((e) => e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]);

        const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
        wasClosed.forEach((d) => { d.open = false; });
        return { clipped, dead, escapes: [...new Set(escapes)], overflow, opened: wasClosed.length };
      });

      check(m.clipped === 0, `${name}: ${m.clipped} elements clip their own text (as shipped)`);
      check(open.clipped.length === 0, `${name}: text clipped once expanded: ${open.clipped.slice(0, 3).join(' | ')}`);
      check(m.deadCards === 0 || open.dead.length === 0,
        `${name}: cards collapsed to zero height with everything expanded: ${open.dead.slice(0, 3).join(' | ')}`);
      check(open.escapes.length === 0, `${name}: elements escape the viewport once expanded: ${open.escapes.slice(0, 5).join(', ')}`);
      check(open.overflow <= 1, `${name}: page scrolls horizontally by ${open.overflow}px once expanded`);
      check(m.h1H > 20, `${name}: h1 has no height`);
      check(m.pageH > 800, `${name}: page is suspiciously short (${m.pageH}px)`);
      check(m.currentNav.length === 1 && m.currentNav[0] === name + '.html',
        `${name}: nav highlight is ${JSON.stringify(m.currentNav)}, expected ["${name}.html"]`);
      check(consoleErrors.length === 0, `${name}: console errors: ${consoleErrors.slice(0, 2).join(' | ')}`);

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
        const parse = (s) => {
          if (!s) return null;
          if (s.startsWith('color(')) {
            const n = s.match(/[\d.]+/g).map(Number).slice(0, 3);
            return n.map((v) => v * 255);
          }
          const n = (s.match(/[\d.]+/g) || []).map(Number);
          if (n.length < 3) return null;
          if (n.length >= 4 && n[3] === 0) return null; // transparent
          return n.slice(0, 3);
        };
        const lum = (c) => {
          const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const bgOf = (e) => {
          let n = e;
          while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c) return c; n = n.parentElement; }
          return [255, 255, 255];
        };
        const bad = [];
        document.querySelectorAll('p,li,h1,h2,h3,h4,span,td,th,a,label,summary,button,strong,em').forEach((e) => {
          if (!e.innerText || !e.innerText.trim()) return;
          if (e.querySelector('p,li,div,td,h2,h3,h4')) return;      // measure leaves only
          if (e.getBoundingClientRect().height === 0) return;        // hidden
          const st = getComputedStyle(e);
          const fg = parse(st.color); if (!fg) return;
          const L1 = lum(fg), L2 = lum(bgOf(e));
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

      const hasList = await page.$('.checklist input[type=checkbox]');
      if (hasList) {
        const before = await page.textContent('.progress [data-count]');
        await page.click('.checklist input[type=checkbox]');
        const after = await page.textContent('.progress [data-count]');
        const barW = await page.evaluate(() => document.querySelector('.progress .bar > i').style.width);
        check(before !== after, `${name}: ticking a box did not update the counter ("${before}" -> "${after}")`);
        check(/^1 of \d+$/.test(after), `${name}: counter reads "${after}" after one tick, expected "1 of N"`);
        check(barW && barW !== '0%', `${name}: progress bar did not fill (width=${barW})`);

        // and it must survive a reload
        await page.reload();
        await page.waitForLoadState('networkidle');
        const persisted = await page.textContent('.progress [data-count]');
        check(persisted === after, `${name}: tick did not persist across reload ("${persisted}" != "${after}")`);
        // leave no residue for the next combo
        await page.evaluate(() => {
          Object.keys(localStorage).filter((k) => k.startsWith('aihub:')).forEach((k) => localStorage.removeItem(k));
        });
      }

      if (combo.name === 'desktop-light' || combo.name === 'mobile-dark') {
        await page.screenshot({ path: path.join(SHOTS, `${name}_${combo.name}.png`), fullPage: true });
      }
      await page.close();
    }
    await ctx.close();
  }

  await browser.close();

  /* ---- desktop vs mobile: same content, different layout -------------
     A media query is allowed to RE-ARRANGE the page. It is never allowed
     to REMOVE content: that is how a mobile reader silently loses a
     section nobody notices is missing. */
  console.log('\n\x1b[1mdesktop vs mobile parity\x1b[0m');
  const dl = TEXT['desktop-light'] || {}, ml = TEXT['mobile-light'] || {};
  const dd = TEXT['desktop-dark'] || {};
  for (const name of pages) {
    if (dl[name] && ml[name]) {
      const same = dl[name] === ml[name];
      check(same, `${name}: mobile shows different text from desktop (${dl[name].length} vs ${ml[name].length} chars) — a media query is hiding content`);
      if (same) console.log(`  ${name.padEnd(9)} desktop == mobile  (${dl[name].length} chars of visible text)`);
    }
    if (dl[name] && dd[name]) {
      check(dl[name] === dd[name], `${name}: dark mode shows different text from light mode`);
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
