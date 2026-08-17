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
    <a class="wordmark" href="https://hlur.ai/" aria-label="Hlur \u2014 home"><svg class="nav-mark" viewBox="0 0 64 64" aria-hidden="true"><path d="M17.5 32h29" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" class="nm-bar"/><g fill="currentColor"><rect x="10" y="9" width="15" height="15" rx="2"/><rect x="10" y="40" width="15" height="15" rx="2"/><rect x="39" y="9" width="15" height="15" rx="2"/><rect x="39" y="40" width="15" height="15" rx="2"/></g><g class="nm-acc"><rect x="10" y="24.5" width="15" height="15" rx="2"/><rect x="39" y="24.5" width="15" height="15" rx="2"/></g></svg>Hlur<span>.</span></a>
    <a class="nav-sect" href="index.html">${cfg.site.name.replace(/ /g, '&nbsp;')}</a>
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

  /* Lur peeking over the rule — the same sign-off hlur.ai and /baseline use.
     /hub carried none of the site chrome and read as a separate property. */
  const peek = `  <div class="peek-wrap" aria-hidden="true">
    <svg viewBox="0 20 200 108" xmlns="http://www.w3.org/2000/svg">
      <path d="M84 36 Q94 24 106 30 Q114 34 120 28" fill="none" stroke="#2D8E7E" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="127" cy="25" r="2.5" fill="#2D8E7E"/>
      <path d="M100 52 C136 52 158 82 158 116 C158 140 152 158 141 165 C136 169 130 161 123 167 C116 173 110 164 100 171 C90 164 84 173 77 167 C70 161 64 169 59 165 C48 157 42 140 42 116 C42 82 64 52 100 52 Z" fill="#9AD3C6"/>
      <circle cx="79" cy="104" r="9.5" fill="#1D1D1F"/><circle cx="121" cy="104" r="9.5" fill="#1D1D1F"/>
      <circle cx="81" cy="100" r="3.1" fill="#fff"/><circle cx="123" cy="100" r="3.1" fill="#fff"/>
      <ellipse cx="63" cy="118" rx="9" ry="5.5" fill="#F2B8A4"/><ellipse cx="137" cy="118" rx="9" ry="5.5" fill="#F2B8A4"/>
      <ellipse cx="70" cy="126" rx="8.5" ry="5.5" fill="#9AD3C6"/>
      <ellipse cx="130" cy="126" rx="8.5" ry="5.5" fill="#9AD3C6"/>
    </svg>
  </div>
`;
  /* Deliberately no mailto here. hlur.ai's own footer carries the address, but this
     repo's leak sweep forbids a published email in shipped HTML, and weakening
     another project's guard to fit a cosmetic change is the wrong trade. */
  const site = `    <div class="foot-site">
      <div class="foot-site-links">
        <a href="https://hlur.ai/">Home</a>
        <a href="https://hlur.ai/baseline/">AI literacy</a>
        <a href="https://hlur.ai/lur">Meet Lur</a>
        <a href="https://hlur.ai/mindfulness">Mindfulness</a>
      </div>
      <p class="foot-copy"><b>Still here.</b> &mdash; Lur &middot; Hlur, a one-person lab</p>
    </div>
`;

  return `<footer class="foot">
${peek}  <div class="wrap">
    <div class="foot-links">
${internal.concat(external).join('\n')}
    </div>
    <p class="tiny">
      ${cfg.footerNote} Written ${cfg.site.written}.${note}
    </p>
    <p class="tiny legal">${cfg.legal}</p>
${site}  </div>
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
