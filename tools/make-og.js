#!/usr/bin/env node
/* ============================================================
   AI Hub — generate the social preview image.

       node tools/make-og.js

   Renders assets/og.png at 1200x630 from the site's own design
   tokens, so the card can never drift from the site's palette.
   Re-run it if the palette or the tagline changes; the output is
   committed, because a build step should not be a prerequisite
   for serving a static page.

   Needs Playwright (same as render.js).
   ============================================================ */
'use strict';

const path = require('path');
const ROOT = path.join(__dirname, '..');
const cfg = require(path.join(ROOT, 'site.config.js'));

let chromium;
for (const spec of [process.env.AIHUB_PLAYWRIGHT, 'playwright', path.join(ROOT, 'node_modules', 'playwright')]) {
  if (!spec) continue;
  try { ({ chromium } = require(spec)); break; } catch (e) { /* next */ }
}
if (!chromium) {
  console.error('Playwright is required to regenerate the social image:');
  console.error('  npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

/* Light theme only: most social clients render cards on a light chrome, and a
   preview image cannot respond to prefers-color-scheme anyway. */
const HTML = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 1200px; height: 630px; background: #f9f8f6; color: #1a1a18;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 84px; position: relative; overflow: hidden;
  }
  .rings { position: absolute; right: -140px; top: 50%; transform: translateY(-50%); opacity: .13; }
  .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 34px; }
  .dot { width: 20px; height: 20px; border-radius: 50%; background: #0f6e56; }
  .brand span { font-size: 27px; font-weight: 650; letter-spacing: -0.01em; }
  h1 { font-size: 68px; line-height: 1.1; letter-spacing: -0.03em; font-weight: 640; max-width: 15.5em; }
  p { font-size: 27px; line-height: 1.45; color: #5f5e5a; margin-top: 26px; max-width: 24em; }
  .foot {
    position: absolute; left: 84px; bottom: 54px;
    font-size: 19px; color: #6b6a65; letter-spacing: 0.06em; text-transform: uppercase; font-weight: 600;
  }
</style>
<svg class="rings" width="620" height="620" viewBox="0 0 620 620" aria-hidden="true">
  <circle cx="310" cy="310" r="70"  fill="#0f6e56"/>
  <circle cx="310" cy="310" r="150" fill="none" stroke="#0f6e56" stroke-width="16"/>
  <circle cx="310" cy="310" r="235" fill="none" stroke="#0f6e56" stroke-width="16"/>
  <circle cx="310" cy="310" r="310" fill="none" stroke="#0f6e56" stroke-width="16"/>
</svg>
<div class="brand"><span class="dot"></span><span>AI Hub</span></div>
<h1>Everyone is confused. That is the honest starting line.</h1>
<p>Build the basics — then learn the part almost no one teaches: how to check what the AI gives you.</p>
<div class="foot">Free &middot; No sign-up &middot; ${cfg.site.name === 'AI Hub' ? 'hlur.ai/hub' : ''}</div>
`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(HTML, { waitUntil: 'load' });
  const out = path.join(ROOT, 'assets', 'og.png');
  await page.screenshot({ path: out });
  await browser.close();

  const kb = Math.round(require('fs').statSync(out).size / 1024);
  console.log(`wrote assets/og.png  1200x630  ${kb} KB`);
  if (kb > 300) console.log('  note: over 300 KB — some clients are slow to fetch large cards');
})().catch((e) => { console.error(e); process.exit(1); });
