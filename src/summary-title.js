/* ============================================================
   Give every accordion summary a single title element.

   WHY THIS EXISTS
   `.acc > summary` is `display:flex; gap:12px` — the gap is there to separate
   the number badge from the title, and for a plain title that is exactly right.

   But a flex container makes a separate item out of EVERY child run, and the
   whitespace between flex items is dropped and replaced by the gap. So the
   moment a title contains any inline markup, the sentence is torn into pieces
   and 12px is inserted at each tear:

       <summary><span class="sq">04</span>Check one thing you <em>can</em> check</summary>
                                          └── item ──┘└─item─┘└─ item ─┘

   renders as "Check one thing you⎵⎵⎵can⎵⎵⎵check" — a 12px gap where a 4px word
   space belongs, three times the width, in bold 16px type. Found by a cold
   reader looking at a picture; no geometry check could see it, because nothing
   overflowed, clipped or moved.

   Removing the gap is NOT the fix: with no gap the dropped whitespace leaves
   "youcancheck". The title has to be ONE flex item, so inline layout applies
   inside it normally.

   Done at build time rather than in the page sources because the trap is
   invisible at the point of authoring — writing <em> in a heading is a
   perfectly ordinary thing to do, and it should not silently break.
   ============================================================ */

'use strict';

function wrapSummaryTitles(html) {
  return html.replace(/<summary>([\s\S]*?)<\/summary>/g, (whole, inner) => {
    if (/class="acc-t"/.test(inner)) return whole;                 // already wrapped

    /* The badge stays its own flex item — the 12px gap between it and the
       title is the spacing this layout was designed around. */
    const badge = /^(\s*<span class="sq">[\s\S]*?<\/span>)([\s\S]*)$/.exec(inner);
    const lead = badge ? badge[1] : '';
    const title = badge ? badge[2] : inner;

    if (!title.trim()) return whole;
    return `<summary>${lead}<span class="acc-t">${title}</span></summary>`;
  });
}

module.exports = { wrapSummaryTitles };
