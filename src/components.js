/* ============================================================
   AI Hub — content components.

   HONEST STATUS: the six pages in src/pages/ predate these helpers
   and hand-write their markup, so today only trackGrid() is called
   by a shipped page. The rest exist for NEW sections, and for the
   invariants they enforce (a note kind that has no CSS rule throws;
   a table is always inside .tscroll; a checklist counter is derived
   from the item count so it cannot drift). test.js exercises them.
   Prefer them when adding content; do not assume existing pages use
   them.
   ============================================================ */
'use strict';

const cfg = require('../site.config.js');

/* ---- structural ------------------------------------------------ */

/** A page section. `label` is the small uppercase eyebrow above the h2. */
function section({ id, label, h2, lead, body }) {
  const parts = [];
  if (label) parts.push(`    <p class="slabel">${label}</p>`);
  if (h2) parts.push(`    <h2>${h2}</h2>`);
  if (lead) parts.push(`    <p class="lead">\n      ${lead}\n    </p>`);
  /* Do NOT re-indent the body: `.prompt` is white-space: pre-wrap, so adding
     four spaces to every line puts them on screen and in what the copy button
     writes to the clipboard. Indentation is cosmetic; correctness is not. */
  if (body) parts.push(body);
  return `<section${id ? ` id="${id}"` : ''}>
  <div class="wrap">
${parts.join('\n')}
  </div>
</section>`;
}

/** Grid of cards. cols is 2 or 3. */
function grid(cols, cards) {
  return `<div class="grid grid-${cols}">\n${cards.join('\n')}\n</div>`;
}

/** A plain card. `num` renders the small grey counter above the heading. */
function card({ num, title, body }) {
  const n = num ? `\n  <span class="num">${num}</span>` : '';
  const h = title ? `\n  <h4>${title}</h4>` : '';
  return `<div class="card">${n}${h}\n  ${body}\n</div>`;
}

/* ---- callouts --------------------------------------------------- */

const NOTE_KINDS = ['do', 'dont', 'warn', 'info'];

/** kind: do | dont | warn | info */
function note(kind, label, body) {
  if (!NOTE_KINDS.includes(kind)) {
    throw new Error(`note(): unknown kind "${kind}" — expected one of ${NOTE_KINDS.join(', ')}`);
  }
  return `<div class="note note-${kind}">
  <span class="nlabel">${label}</span>
  <p>${body}</p>
</div>`;
}

/* ---- progressive disclosure -------------------------------------- */

/**
 * Accordion list. Items: {n, summary, body, open}.
 * Renders the expand/collapse toolbar automatically — app.js scopes those
 * buttons to the enclosing <section>, so one toolbar per section.
 */
function accordions(items, { tools = true } = {}) {
  const bar = tools
    ? `<div class="acc-tools">
  <button type="button" data-acc="open">Expand all</button>
  <button type="button" data-acc="close">Collapse all</button>
</div>\n`
    : '';
  const body = items.map((it, i) => {
    const sq = it.n || String(i + 1).padStart(2, '0');
    return `<details class="acc"${it.open ? ' open' : ''}>
  <summary><span class="sq">${sq}</span>${it.summary}</summary>
  <div class="acc-body">
    ${it.body}
  </div>
</details>`;
  }).join('\n');
  return bar + body;
}

/* ---- checklist with saved progress -------------------------------- */

/**
 * items: array of label HTML. `idPrefix` must be unique across the WHOLE
 * site — ids are localStorage keys, and verify.js fails on a collision.
 * The counter is generated from items.length so it can never drift.
 */
function checklist(idPrefix, items) {
  if (!/^[a-z][a-z0-9]*$/.test(idPrefix)) {
    throw new Error(`checklist(): idPrefix "${idPrefix}" must be lowercase alphanumeric`);
  }
  const lis = items.map((label, i) =>
    `    <li><input type="checkbox" id="${idPrefix}${i + 1}"><label for="${idPrefix}${i + 1}">${label}</label></li>`
  ).join('\n');
  return `<div class="card">
  <ul class="checklist">
${lis}
  </ul>
  <div class="progress">
    <span data-count>0 of ${items.length}</span>
    <span class="bar"><i></i></span>
    <button type="button" class="reset-btn">reset</button>
  </div>
</div>`;
}

/* ---- numbered steps ------------------------------------------------ */

/** items: {title, body} */
function steps(items) {
  const lis = items.map((s) =>
    `  <li>\n    <h4>${s.title}</h4>\n    ${s.body}\n  </li>`
  ).join('\n');
  return `<ol class="steps">\n${lis}\n</ol>`;
}

/* ---- table (always inside a scroll container) ----------------------- */

/** Wide tables MUST scroll inside their own box or the page overflows. */
function table(headers, rows, { firstColWidth } = {}) {
  if (firstColWidth && !/^\d+(px|%|em|rem)$/.test(firstColWidth)) {
    throw new Error(`table(): firstColWidth "${firstColWidth}" must be a plain CSS length`);
  }
  const th = headers.map((h, i) =>
    `<th${i === 0 && firstColWidth ? ` style="width:${firstColWidth}"` : ''}>${h}</th>`
  ).join('');
  const tr = rows.map((r) =>
    `      <tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`
  ).join('\n');
  return `<div class="tscroll">
  <table>
    <thead>
      <tr>${th}</tr>
    </thead>
    <tbody>
${tr}
    </tbody>
  </table>
</div>`;
}

/* ---- copyable prompt ------------------------------------------------- */

function prompt(text) {
  return `<div class="prompt-wrap">
  <button class="copy-btn" type="button">Copy</button>
  <div class="prompt">${text}</div>
</div>`;
}

/* ---- the front-door track grid, generated from site.config ------------ */

/**
 * The whole point of the config: add a page there and its card appears here,
 * in the nav, in every footer and in the pager. No page file is touched.
 */
function trackGrid() {
  const internal = cfg.pages
    .filter((p) => p.track)
    .map((p, i) => ({
      order: i + 1,
      href: p.file,
      track: p.track,
      cardTitle: p.cardTitle,
      cardBlurb: p.cardBlurb,
    }));
  const external = cfg.externalTracks.map((t) => ({
    order: t.order,
    href: t.href,
    track: t.track,
    cardTitle: t.cardTitle,
    cardBlurb: t.cardBlurb,
  }));

  const cards = internal.concat(external)
    .sort((a, b) => a.order - b.order)
    .map((t) => `  <a class="track" href="${t.href}">
    <span class="tnum">${t.track}</span>
    <h4>${t.cardTitle}</h4>
    <p>${t.cardBlurb}</p>
  </a>`);

  return `<div class="grid grid-2">\n${cards.join('\n')}\n</div>`;
}

module.exports = {
  section, grid, card, note, accordions, checklist, steps, table, prompt, trackGrid,
};
