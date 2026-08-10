#!/usr/bin/env node
/* ============================================================
   AI Hub — adversarial unit tests.

   Clean input was already proven by build.js + verify.js. These
   tests feed the build system the input a careless future edit
   will actually produce: missing fields, reordered pages, a
   duplicate id, an apostrophe in an attribute, a page in the
   config with no content file.

   The point is not coverage. The point is that each of these
   once WOULD have shipped a broken page silently.

       node test.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const { validate } = require('./src/validate-config.js');
const C = require('./src/components.js');
const layout = require('./src/layout.js');
const { labelTables } = require('./src/table-labels.js');
const { wrapSummaryTitles } = require('./src/summary-title.js');
const realCfg = require('./site.config.js');

let pass = 0, fail = 0;

function t(name, fn) {
  try {
    fn();
    pass++;
  } catch (e) {
    fail++;
    console.log(`  \x1b[31mFAIL\x1b[0m  ${name}\n          ${e.message.split('\n')[0]}`);
  }
}

/** Assert fn throws, and that the message mentions `must`. */
function throws(fn, must, label) {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  if (!threw) throw new Error(`${label}: expected a throw, got none`);
  if (must && !threw.message.includes(must)) {
    throw new Error(`${label}: threw, but message did not mention "${must}" — got: ${threw.message.split('\n').slice(0, 3).join(' / ')}`);
  }
}
function eq(a, b, label) {
  if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function ok(c, label) { if (!c) throw new Error(label); }

/* deep-ish clone so a test cannot corrupt the real config for the next one */
const clone = () => JSON.parse(JSON.stringify(realCfg));

console.log('\n\x1b[1mConfig validation — dirty input\x1b[0m');

t('rejects a page missing its title', () => {
  const c = clone(); delete c.pages[2].title;
  throws(() => validate(c), 'missing required field "title"', 'missing title');
});

t('rejects a page missing its front-door card copy', () => {
  const c = clone(); delete c.pages[3].cardBlurb;
  throws(() => validate(c), 'cardBlurb', 'missing cardBlurb');
});

t('rejects two pages sharing a nav label', () => {
  const c = clone(); c.pages[3].nav = c.pages[2].nav;
  throws(() => validate(c), 'duplicate nav label', 'duplicate nav');
});

t('rejects two pages sharing a filename', () => {
  const c = clone(); c.pages[3].file = c.pages[2].file;
  throws(() => validate(c), 'duplicate file', 'duplicate file');
});

t('rejects a description outside 60-260 chars', () => {
  const c = clone(); c.pages[1].description = 'too short';
  throws(() => validate(c), 'want 60-260', 'short description');
});

t('rejects a front door that is not index.html', () => {
  const c = clone(); c.pages.unshift(c.pages.pop());
  throws(() => validate(c), 'must be index.html', 'wrong front door');
});

/* THE generated-claims trap: reordering pages leaves each page asserting a
   track number that no longer matches where it sits. */
t('catches a reorder that makes "Track N" a lie', () => {
  const c = clone();
  const tmp = c.pages[2]; c.pages[2] = c.pages[4]; c.pages[4] = tmp;
  throws(() => validate(c), 'the number and the order disagree', 'reorder');
});

t('catches a malformed track label', () => {
  const c = clone(); c.pages[1].track = 'The Map';
  throws(() => validate(c), 'must look like', 'bad track label');
});

t('rejects an undated site', () => {
  const c = clone(); c.site.written = 'today';
  throws(() => validate(c), 'not in the form', 'bad date');
});

t('rejects an external track on a non-allow-listed host', () => {
  const c = clone(); c.externalTracks[0].href = 'https://example.com/x';
  throws(() => validate(c), 'not in site.allowedExternalHosts', 'bad host');
});

t('rejects an external track whose slot collides with a real page', () => {
  const c = clone(); c.externalTracks[0].order = 2;
  throws(() => validate(c), 'collides', 'order collision');
});

t('accepts the real config', () => { ok(validate(clone()) === true, 'real config should validate'); });

console.log('\n\x1b[1mComponents — dirty input\x1b[0m');

t('checklist() rejects an id prefix that would collide or break', () => {
  throws(() => C.checklist('AU', ['a']), 'lowercase', 'uppercase prefix');
  throws(() => C.checklist('au-1', ['a']), 'lowercase', 'prefix with a dash');
  throws(() => C.checklist('1au', ['a']), 'lowercase', 'prefix starting with a digit');
});

t('checklist() counter can never disagree with the box count', () => {
  for (const n of [1, 5, 16, 40]) {
    const html = C.checklist('zz', Array.from({ length: n }, (_, i) => 'item ' + i));
    const boxes = (html.match(/<input type="checkbox"/g) || []).length;
    const said = /data-count>0 of (\d+)</.exec(html)[1];
    eq(boxes, n, `checklist(${n}) box count`);
    eq(Number(said), n, `checklist(${n}) counter`);
  }
});

t('checklist() with zero items still renders a valid counter', () => {
  const html = C.checklist('zz', []);
  ok(/data-count>0 of 0</.test(html), 'empty checklist counter should read "0 of 0"');
});

t('note() rejects an unknown kind rather than emitting an unstyled box', () => {
  throws(() => C.note('danger', 'X', 'y'), 'unknown kind', 'bad note kind');
  ok(C.note('warn', 'X', 'y').includes('note-warn'), 'valid kind should render');
});

t('accordions() numbering does not break past 9', () => {
  const html = C.accordions(Array.from({ length: 12 }, (_, i) => ({ summary: 's' + i, body: 'b' })));
  ok(html.includes('<span class="sq">09</span>'), 'item 9 should be 09');
  ok(html.includes('<span class="sq">10</span>'), 'item 10 should be 10');
  ok(html.includes('<span class="sq">12</span>'), 'item 12 should be 12');
  eq((html.match(/<details class="acc"/g) || []).length, 12, 'accordion count');
});

t('accordions() always pairs a summary with an acc-body', () => {
  const html = C.accordions([{ summary: 'a', body: 'b' }, { summary: 'c', body: 'd', open: true }]);
  eq((html.match(/<summary>/g) || []).length, 2, 'summaries');
  eq((html.match(/class="acc-body"/g) || []).length, 2, 'bodies');
  eq((html.match(/<details class="acc" open>/g) || []).length, 1, 'open ones');
});

t('table() always wraps in a scroll container', () => {
  const html = C.table(['a', 'b'], [['1', '2']]);
  ok(html.startsWith('<div class="tscroll">'), 'table must be inside .tscroll or a wide table breaks the page');
  eq((html.match(/<td>/g) || []).length, 2, 'cell count');
});

t('trackGrid() emits a card for every track in the config', () => {
  const html = C.trackGrid();
  const want = realCfg.pages.filter((p) => p.track).length + realCfg.externalTracks.length;
  eq((html.match(/class="track"/g) || []).length, want, 'track card count');
});

console.log('\n\x1b[1mLayout — escaping and edges\x1b[0m');

t('a quote in a description cannot break out of the meta attribute', () => {
  const page = Object.assign({}, realCfg.pages[0], {
    description: 'He said "hello" & <b>left</b>',
  });
  const html = layout.render(page, '<section><div class="wrap"><p>x</p></div></section>');
  const m = /<meta name="description" content="([^"]*)">/.exec(html);
  ok(m, 'meta description should still parse as one attribute');
  ok(!m[1].includes('"'), 'raw quote must not survive into the attribute');
  ok(m[1].includes('&quot;') && m[1].includes('&amp;') && m[1].includes('&lt;'), 'should be entity-escaped');
});

t('the pager never points a page at itself', () => {
  for (const p of realCfg.pages) {
    const html = layout.pager(p);
    const hrefs = (html.match(/href="([^"]+)"/g) || []).map((h) => h.slice(6, -1));
    ok(!hrefs.includes(p.file), `${p.file}: pager links to itself`);
  }
});

t('the last page still offers a way onward', () => {
  const last = realCfg.pages[realCfg.pages.length - 1];
  ok(layout.pager(last).includes('index.html'), 'last page must loop back to the front door');
});

t('every page renders exactly one h1 and one nav', () => {
  for (const p of realCfg.pages) {
    const html = layout.render(p, '<section><div class="wrap"><p>x</p></div></section>');
    eq((html.match(/<h1>/g) || []).length, 1, `${p.file}: h1 count`);
    eq((html.match(/<nav class="nav">/g) || []).length, 1, `${p.file}: nav count`);
    eq((html.match(/<footer class="foot">/g) || []).length, 1, `${p.file}: footer count`);
  }
});

t('the nav is identical on every page', () => {
  const navs = new Set(realCfg.pages.map((p) => layout.nav()));
  eq(navs.size, 1, 'nav should have exactly one form');
});

t('adding a page to the config reaches nav, footer and track grid with no page edit', () => {
  const c = clone();
  c.pages.push({
    file: 'newpage.html', nav: 'New', track: 'Track 6 · New',
    cardTitle: 'A new track', cardBlurb: 'blurb',
    pagerTitle: 'New — a new track',
    title: 'New page title for testing purposes',
    description: 'A description that is comfortably longer than sixty characters so that it passes the length check.',
    eyebrow: 'Track 6 · New', h1: 'New', sub: 'sub',
  });
  ok(validate(c) === true, 'a well-formed new page should validate');
  // and it must be numbered for its position, or validation must object
  const bad = clone();
  bad.pages.push(Object.assign({}, c.pages[c.pages.length - 1], { track: 'Track 9 · New', eyebrow: 'Track 9 · New' }));
  throws(() => validate(bad), 'disagree', 'wrongly numbered new page');
});

/* ---- table column labels ------------------------------------------------
   The clean case is already covered by render.js reading the rendered page.
   These are the dirty ones: a table the transform must leave alone, markup
   and quotes inside a header, and a malformed row that must be refused rather
   than silently shipped as an unlabelled card. */
t('table-labels: stamps each cell with its own column', () => {
  const out = labelTables('<table><thead><tr><th>Mistake</th><th>Fix</th></tr></thead>' +
    '<tbody><tr><td>Vague ask</td><td>Say who it is for</td></tr></tbody></table>');
  ok(out.includes('data-label="Mistake">Vague ask'), 'first cell labelled Mistake');
  ok(out.includes('data-label="Fix">Say who it is for'), 'second cell labelled Fix');
  ok(out.includes('role="table"') && out.includes('role="row"'),
    'ARIA roles restored — display:block strips native table semantics');
});

t('table-labels: a header with markup and a quote survives as an attribute', () => {
  const out = labelTables('<table><thead><tr><th>Say <em>"no"</em></th></tr></thead>' +
    '<tbody><tr><td>x</td></tr></tbody></table>');
  ok(out.includes('data-label="Say &quot;no&quot;"'),
    'tags stripped and quotes escaped so the attribute cannot be terminated early');
});

t('table-labels: leaves a table with no header row untouched', () => {
  const src = '<table><tbody><tr><td>a</td></tr></tbody></table>';
  eq(labelTables(src), src, 'nothing to derive a label from, so nothing is changed');
});

t('table-labels: refuses a row with more cells than columns', () => {
  throws(() => labelTables('<table><thead><tr><th>One</th></tr></thead>' +
    '<tbody><tr><td>a</td><td>b</td></tr></tbody></table>'),
    'cells', 'a cell with no column cannot be labelled — shipping it unlabelled is the bug');
});

t('table-labels: every table in the real pages ends up fully labelled', () => {
  for (const f of fs.readdirSync(path.join(__dirname, 'src', 'pages'))) {
    const out = labelTables(require(path.join(__dirname, 'src', 'pages', f)));
    const tds = out.match(/<td[^>]*>/g) || [];
    const unlabelled = tds.filter((td) => !td.includes('data-label='));
    eq(unlabelled.length, 0, `${f}: ${unlabelled.length} cells would render with no column name`);
  }
});

/* ---- accordion summary titles ------------------------------------------ */
t('summary-title: the badge stays separate, the title becomes one item', () => {
  const out = wrapSummaryTitles('<summary><span class="sq">04</span>Check one thing you <em>can</em> check</summary>');
  ok(out.includes('<span class="sq">04</span><span class="acc-t">Check one thing you <em>can</em> check</span>'),
    'the 12px gap must separate badge from title, never words from each other');
});

t('summary-title: a summary with no badge still gets a title element', () => {
  ok(wrapSummaryTitles('<summary>Plain title</summary>').includes('<span class="acc-t">Plain title</span>'),
    'plain summary wrapped');
});

t('summary-title: wrapping is idempotent', () => {
  const once = wrapSummaryTitles('<summary><span class="sq">01</span>Title</summary>');
  eq(wrapSummaryTitles(once), once, 'a second build pass must not nest another wrapper');
});

t('summary-title: every real accordion title ends up as one element', () => {
  for (const f of fs.readdirSync(path.join(__dirname, 'src', 'pages'))) {
    const out = wrapSummaryTitles(labelTables(require(path.join(__dirname, 'src', 'pages', f))));
    (out.match(/<summary>[\s\S]*?<\/summary>/g) || []).forEach((s) => {
      const stripped = s.replace(/<span class="sq">[\s\S]*?<\/span>/, '').replace(/<span class="acc-t">[\s\S]*?<\/span>\s*<\/summary>/, '');
      eq(/[A-Za-z]/.test(stripped.replace(/<\/?summary>/g, '')), false,
        `${f}: loose text left in a summary: ${s.slice(0, 60)}`);
    });
  }
});

/* ---- the two transform bugs a cold reviewer found shipped untested -------- */
t('table-labels: a cell containing $& does not splice the tbody into itself', () => {
  const out = labelTables('<table><thead><tr><th>A</th></tr></thead>' +
    '<tbody><tr><td>costs $& more</td></tr></tbody></table>');
  eq((out.match(/<tbody/g) || []).length, 1, 'exactly one <tbody> survives');
  ok(out.includes('costs $& more'), 'the cell text is intact');
  ok(!out.includes('<tbody><tr><td>costs'), 'the original tbody was not re-injected');
});

t('table-labels: $` and $\' are also inert', () => {
  for (const bad of ['a $` b', "a $' b", 'a $$ b']) {
    const out = labelTables('<table><thead><tr><th>A</th></tr></thead>' +
      `<tbody><tr><td>${bad}</td></tr></tbody></table>`);
    eq((out.match(/<tbody/g) || []).length, 1, `one tbody for ${bad}`);
    ok(out.includes(bad), `cell text intact for ${bad}`);
  }
});

t('table-labels: a spanning cell is refused, however it is spaced', () => {
  for (const attr of ['colspan="2"', 'colspan = "2"', 'ROWSPAN="2"', "colspan='2'"]) {
    throws(() => labelTables('<table><thead><tr><th>A</th><th>B</th></tr></thead>' +
      `<tbody><tr><td ${attr}>x</td></tr></tbody></table>`),
      'span', `refused: ${attr}`);
  }
});

t('table-labels: a spanning HEADER is refused too', () => {
  throws(() => labelTables('<table><thead><tr><th colspan="2">A</th><th>B</th></tr></thead>' +
    '<tbody><tr><td>x</td><td>y</td></tr></tbody></table>'),
    'span', 'a spanning <th> shifts every column index');
});

console.log('\n' + '='.repeat(58));
if (fail === 0) {
  console.log(`\x1b[32mPASS\x1b[0m  ${pass} adversarial tests, 0 failures.`);
  process.exit(0);
} else {
  console.log(`\x1b[31mFAIL\x1b[0m  ${fail} of ${pass + fail} adversarial tests failed.`);
  process.exit(1);
}
