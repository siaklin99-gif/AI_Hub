/* ============================================================
   AI Hub — boundary validation for site.config.js.

   site.config.js is the one external input to the build. Everything
   downstream (nav, footers, pagers, track cards, both harnesses)
   trusts it, so it is validated HERE, before any logic runs —
   rather than discovering a missing field as a hole in a rendered
   page nobody looked at.

   Throws on the first structural problem. Fails closed.
   ============================================================ */
'use strict';

const REQUIRED_PAGE_FIELDS = ['file', 'nav', 'title', 'description', 'eyebrow', 'h1', 'sub', 'pagerTitle'];
const REQUIRED_TRACK_FIELDS = ['cardTitle', 'cardBlurb'];

function validate(cfg) {
  const errs = [];
  const push = (m) => errs.push(m);

  /* ---- site ---- */
  if (!cfg.site || typeof cfg.site !== 'object') push('site: missing');
  else {
    if (!cfg.site.name) push('site.name: missing');
    if (!/^\d{1,2} [A-Z][a-z]+ \d{4}$/.test(cfg.site.written || '')) {
      push(`site.written: "${cfg.site.written}" is not in the form "5 August 2026" — every page is stamped with it`);
    }
    if (!Array.isArray(cfg.site.allowedExternalHosts) || !cfg.site.allowedExternalHosts.length) {
      push('site.allowedExternalHosts: must be a non-empty array');
    }
  }

  /* ---- pages ---- */
  if (!Array.isArray(cfg.pages) || cfg.pages.length === 0) {
    push('pages: must be a non-empty array');
    throw new Error('site.config.js is invalid:\n  - ' + errs.join('\n  - '));
  }

  if (cfg.pages[0].file !== 'index.html') {
    push(`pages[0] must be index.html (it is "${cfg.pages[0].file}") — it is the front door and the nav/pager home`);
  }

  const seenFiles = new Set();
  const seenTitles = new Set();
  const seenNav = new Set();

  cfg.pages.forEach((p, i) => {
    const at = `pages[${i}] (${p.file || 'no file'})`;
    for (const f of REQUIRED_PAGE_FIELDS) {
      if (!p[f] || typeof p[f] !== 'string' || !p[f].trim()) push(`${at}: missing required field "${f}"`);
    }
    if (p.file && !/^[a-z0-9-]+\.html$/.test(p.file)) push(`${at}: file must be lowercase-kebab and end in .html`);
    if (p.file && seenFiles.has(p.file)) push(`${at}: duplicate file "${p.file}"`);
    if (p.file) seenFiles.add(p.file);
    if (p.title && seenTitles.has(p.title)) push(`${at}: duplicate <title> "${p.title}"`);
    if (p.title) seenTitles.add(p.title);
    if (p.nav && seenNav.has(p.nav)) push(`${at}: duplicate nav label "${p.nav}" — two identical tabs`);
    if (p.nav) seenNav.add(p.nav);

    if (p.description && (p.description.length < 60 || p.description.length > 260)) {
      push(`${at}: description is ${p.description.length} chars, want 60-260`);
    }

    /* Every page except the front door is a track, and must carry the card
       copy the front door needs. A page with no card would silently vanish
       from the track grid while still being in the nav. */
    if (i > 0) {
      if (!p.track) push(`${at}: not the front door, so it needs a "track" label`);
      for (const f of REQUIRED_TRACK_FIELDS) {
        if (!p[f]) push(`${at}: missing "${f}" — its card on the front door would render empty`);
      }
    }

    /* THE GENERATED-CLAIMS TRAP: "Track 3 · Leverage" is a SENTENCE the page
       asserts about itself. Reorder the pages and the position changes while
       the string does not — producing a page that confidently calls itself
       Track 3 while sitting in slot 5. A correct config, a false sentence.
       So the number must be derived from position, and is checked here. */
    if (p.track) {
      const m = /^Track (\d+) · /.exec(p.track);
      if (!m) push(`${at}: track label "${p.track}" must look like "Track N · Name"`);
      else if (Number(m[1]) !== i) {
        push(`${at}: labelled "${p.track}" but it sits in position ${i} — the number and the order disagree. ` +
             `Renumber it to "Track ${i} · ..." or move the page.`);
      }
    }
  });

  /* ---- external tracks ---- */
  if (!Array.isArray(cfg.externalTracks)) push('externalTracks: must be an array (use [] if none)');
  else {
    cfg.externalTracks.forEach((t, i) => {
      const at = `externalTracks[${i}]`;
      for (const f of ['href', 'track', 'cardTitle', 'cardBlurb', 'footLabel']) {
        if (!t[f]) push(`${at}: missing "${f}"`);
      }
      if (typeof t.order !== 'number') push(`${at}: "order" must be a number (where its card sits in the grid)`);
      if (t.href && !/^https?:\/\//.test(t.href)) push(`${at}: href must be absolute`);
      if (t.href) {
        const host = t.href.replace(/^https?:\/\//, '').split('/')[0];
        if (cfg.site && Array.isArray(cfg.site.allowedExternalHosts) && !cfg.site.allowedExternalHosts.includes(host)) {
          push(`${at}: host "${host}" is not in site.allowedExternalHosts`);
        }
      }
    });

    /* Two cards claiming the same slot renders a non-deterministic order. */
    const orders = cfg.externalTracks.map((t) => t.order);
    const internalOrders = cfg.pages.filter((p) => p.track).map((p, i) => i + 1);
    const clash = orders.filter((o) => internalOrders.includes(o));
    if (clash.length) push(`externalTracks: order ${clash.join(', ')} collides with an internal track's position`);
  }

  if (!cfg.footerNote) push('footerNote: missing — every page footer uses it');

  if (errs.length) {
    throw new Error('site.config.js is invalid:\n  - ' + errs.join('\n  - '));
  }
  return true;
}

module.exports = { validate };
