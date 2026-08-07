/* ============================================================
   AI Hub — the page shell.
   Everything that is identical on every page lives here exactly
   once: head, nav, hero, pager, footer. Change it here, rebuild,
   and all pages move together. There is no second copy to drift.
   ============================================================ */
'use strict';

const cfg = require('../site.config.js');

/* ---- helpers ------------------------------------------------- */

// Escape for use in an HTML attribute. Hero copy and blurbs are authored
// with apostrophes and quotes; unescaped they would truncate the attribute.
const attr = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* Every value that lands inside quotes goes through attr(). Previously only
   page.description did, leaving title, every href, and the hero button label
   and style raw — a quote in any of them breaks out of the attribute. */
const navPages = () => cfg.pages;

/* Pretty URL, matching the rest of hlur.ai: no ".html", no trailing slash,
   and the front door is the bare base with a slash. */
function canonical(page) {
  const base = cfg.site.baseUrl.replace(/\/+$/, '');
  return page.file === 'index.html' ? base + '/' : base + '/' + page.file.replace(/\.html$/, '');
}

/* ---- nav ------------------------------------------------------ */

function nav() {
  const links = navPages()
    .map((p) => `      <a href="${attr(p.file)}">${p.nav}</a>`)
    .join('\n');
  return `<nav class="nav">
  <div class="nav-inner">
    <a class="brand" href="index.html"><span class="dot"></span>${cfg.site.name}</a>
    <div class="nav-links">
${links}
    </div>
  </div>
</nav>`;
}

/* ---- hero ----------------------------------------------------- */

function hero(page) {
  const buttons = (page.heroButtons || [])
    .map((b) => `      <a class="btn btn-${attr(b.style)}" href="${attr(b.href)}">${b.label}</a>`)
    .join('\n');
  const btnRow = buttons ? `\n    <div class="btn-row">\n${buttons}\n    </div>` : '';
  const foot = page.heroFoot
    ? `\n    <p class="tiny" style="margin-top:18px">\n      ${page.heroFoot}\n    </p>`
    : '';
  return `<header class="hero">
  <div class="wrap">
    <p class="eyebrow">${page.eyebrow}</p>
    <h1>${page.h1}</h1>
    <p class="hero-sub">
      ${page.sub}
    </p>${btnRow}${foot}
  </div>
</header>`;
}

/* ---- pager (prev / next, derived from page order) -------------- */

function pager(page) {
  const list = navPages();
  const i = list.findIndex((p) => p.file === page.file);
  if (i === -1) return '';

  const prev = i > 0 ? list[i - 1] : null;
  const next = i < list.length - 1 ? list[i + 1] : null;
  if (!prev && !next) return '';

  const cell = (p, dir) =>
    `      <a href="${attr(p.file)}"><span class="dir">${dir}</span><span class="ttl">${p.pagerTitle}</span></a>`;

  const parts = [];
  if (prev) parts.push(cell(prev, prev.track ? 'Back · ' + prev.track.split(' · ')[0] : 'Back'));
  if (next) parts.push(cell(next, next.track ? 'Next · ' + next.track.split(' · ')[0] : 'Next'));
  // last page loops back to the front door rather than dead-ending
  if (!next) parts.push(`      <a href="index.html"><span class="dir">Back to</span><span class="ttl">${list[0].pagerTitle}</span></a>`);

  return `<section>
  <div class="wrap">
    <div class="pager">
${parts.join('\n')}
    </div>
  </div>
</section>`;
}

/* ---- footer ---------------------------------------------------- */

function footer(page) {
  const internal = navPages()
    .filter((p) => !(p.file === 'index.html' && page.file === 'index.html'))
    .map((p) => `      <a href="${attr(p.file)}">${p.nav}</a>`);
  const external = cfg.externalTracks
    .map((t) => `      <a href="${attr(t.href)}">${t.footLabel}</a>`);
  const note = page.footNote ? ' ' + page.footNote : '';

  return `<footer class="foot">
  <div class="wrap">
    <div class="foot-links">
${internal.concat(external).join('\n')}
    </div>
    <p class="tiny">
      ${cfg.footerNote} Written ${cfg.site.written}.${note}
    </p>
    <p class="tiny legal">${cfg.legal}</p>
  </div>
</footer>`;
}

/* ---- the whole page -------------------------------------------- */

function render(page, body) {
  const rule = page.rule ? '\n<div class="wrap"><hr style="margin:8px 0 0"></div>\n' : '\n';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${attr(page.title)}</title>
<meta name="description" content="${attr(page.description)}">
<link rel="canonical" href="${attr(canonical(page))}">
<meta name="author" content="${attr(cfg.site.author)}">
<meta name="theme-color" content="#f9f8f6" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1a18" media="(prefers-color-scheme: dark)">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="${attr(cfg.site.name)}">
<meta property="og:title" content="${attr(page.title)}">
<meta property="og:description" content="${attr(page.description)}">
<meta property="og:url" content="${attr(canonical(page))}">
<meta property="og:image" content="${attr(cfg.site.baseUrl + '/' + cfg.site.ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${attr(cfg.site.ogAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${attr(page.title)}">
<meta name="twitter:description" content="${attr(page.description)}">
<meta name="twitter:image" content="${attr(cfg.site.baseUrl + '/' + cfg.site.ogImage)}">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>

<a class="skip" href="#main">Skip to content</a>

${nav()}

<main id="main">

${hero(page)}
${rule}
${body.trim()}

${pager(page)}

</main>

${footer(page)}

<script src="assets/app.js"></script>
</body>
</html>
`;
}

module.exports = { render, nav, hero, pager, footer, attr };
