/* ============================================================
   Stamp every table cell with the column it belongs to.

   WHY THIS EXISTS
   On a phone a table's rows restack into cards, one line per cell (see the
   mobile block in style.css). Restacking alone loses the thing the columns
   were carrying: which cell is which. Three of the seven tables are unreadable
   without it —

     leverage#model   "Because it's… | You would naturally…"   reads as ONE
                      sentence across the row; stacked bare it becomes a
                      heading and an unrelated paragraph.
     trust#moves      "Instead of | Ask for"                   a contrast pair;
                      stacked bare you cannot tell which side you are reading.
     map#bad          "It is bad at | Because | What to do instead"  two
                      identical grey paragraphs with nothing to tell them apart.

   A single legend above the cards does not fix it: by row four the reader has
   scrolled past it and would have to count cells to map them back.

   THE LABEL IS DERIVED, NEVER TYPED
   data-label is copied out of the table's OWN <th> at build time, so a label
   cannot drift from the column it names — the failure mode you get the moment
   someone hand-writes 100 data-label attributes and later edits a header.
   verify.js re-derives them and asserts the match.

   The rendered label is CSS ::before content, i.e. presentational: the real
   semantic link is still the native <th>/<td> relationship, which the explicit
   ARIA roles below keep intact once display:block would otherwise strip the
   table semantics out of the accessibility tree.
   ============================================================ */

'use strict';

/* Text of a <th>, flattened for use in an attribute: tags out, entities left
   exactly as they are (they are already attribute-safe), quotes escaped so a
   header containing one cannot terminate the attribute. */
function labelOf(thInner) {
  return thInner
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/"/g, '&quot;');
}

function labelTables(html) {
  return html.replace(/<table(\s[^>]*)?>[\s\S]*?<\/table>/g, (table) => {
    const head = /<thead>([\s\S]*?)<\/thead>/.exec(table);
    if (!head) return table;                       // no header row: nothing to derive from

    const headers = [...head[1].matchAll(/<th(?:\s[^>]*)?>([\s\S]*?)<\/th>/g)].map((m) => labelOf(m[1]));
    if (!headers.length) return table;

    const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(table);
    if (!body) return table;

    const stamped = body[1].replace(/<tr(?:\s[^>]*)?>[\s\S]*?<\/tr>/g, (row) => {
      let col = 0;
      return row
        .replace(/<tr(\s[^>]*)?>/, (m, a) => `<tr${a || ''} role="row">`)
        .replace(/<td(\s[^>]*)?>/g, (td, attrs) => {
          const label = headers[col];
          col += 1;
          /* More cells than headers is a malformed table, not something to
             paper over — a cell with no column cannot be labelled, and a
             silent skip here would ship an unlabelled card. */
          if (label === undefined) {
            throw new Error(`table-labels: row has ${col} cells but the header has ${headers.length}`);
          }
          return `<td${attrs || ''} role="cell" data-label="${label}">`;
        });
    });

    return table
      .replace(/<table(\s[^>]*)?>/, (m, a) => `<table${a || ''} role="table">`)
      .replace(/<tbody>[\s\S]*?<\/tbody>/, `<tbody role="rowgroup">${stamped}</tbody>`);
  });
}

module.exports = { labelTables, labelOf };
