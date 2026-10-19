// A component page's accessibility section, made from the conformance table in its docs.
//
// Every component's docs end their Accessibility part with `### Conformance (WCAG 2.2 AA)` and a table
// (tools/conformance.mjs keeps them honest). The page shows that table first and plainly, with each status
// as a labelled mark, a count of what the table says, what the page author still owns, and the prose bullets
// below it. Nothing here judges a row: it only lays out what the table says.
//
// Pure: HTML in (the docs, already rendered by pages.mjs's mdToHtml), HTML and numbers out.

import { W } from './words.core.js';

/** The status words a table uses, as a mark class and a short label. Anything else is shown as written. */
const STATUS = [
  [/^Meets with author['’]s part$/i, 'author', "Meets with author's part"],
  [/^Meets$/i, 'meets', 'Meets'],
  [/^Not applicable$/i, 'na', 'Not applicable'],
  [/^Does not meet$/i, 'gap', 'Does not meet'],
];

const stripTags = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

/**
 * @param {string} tableHtml a rendered conformance table
 * @returns {{ html: string, counts: { meets: number, author: number, na: number, gap: number, other: number }, rows: number }}
 */
export function statusTable(tableHtml) {
  const counts = { meets: 0, author: 0, na: 0, gap: 0, other: 0 };
  let rows = 0;
  const labels = ['Criterion', 'Status', 'How it was checked'];
  const html = tableHtml.replace(/<tr>(<td>[\s\S]*?<\/td>)<\/tr>/g, (all, cells) => {
    const tds = [...cells.matchAll(/<td>([\s\S]*?)<\/td>/g)].map(m => m[1]);
    if (tds.length < 3) return all;
    rows++;
    const text = stripTags(tds[1]);
    const hit = STATUS.find(([re]) => re.test(text));
    counts[hit ? hit[1] : 'other']++;
    const status = hit ? `<span class="status status-${hit[1]}">${hit[2]}</span>` : tds[1];
    return `<tr><td data-label="${labels[0]}">${tds[0]}</td><td data-label="${labels[1]}" class="status-cell">${status}</td><td data-label="${labels[2]}">${tds.slice(2).join('</td><td>')}</td></tr>`;
  });
  return { html, counts, rows };
}

const COUNT_WORDS = [['meets', 'Meets'], ['author', "Meets with author's part"], ['na', 'Not applicable'], ['gap', 'Does not meet']];

/** The counts line over the table: only the words that have a row. */
export const countsHtml = (counts, rows) => `<ul class="a11y-counts" aria-label="${rows} criteria">${COUNT_WORDS.filter(([k]) => counts[k]).map(([k, w]) => `<li><span class="status status-${k}">${w}</span> <b>${counts[k]}</b></li>`).join('')}</ul>`;

/**
 * Lift the conformance table out of a rendered docs page into its own section, first under the Accessibility
 * heading, with the old prose bullets below it. A docs page with no such table comes back unchanged.
 * @param {string} docsHtml
 * @param {{ tables: number, depth?: number }} ctx `tables` is how many components have one (for the link to the whole summary)
 * @returns {{ html: string, found: boolean, counts?: object }}
 */
export function accessibilitySection(docsHtml, { tables, depth = 1 }) {
  const h3 = /<h3 id="doc-conformance[^"]*">[^<]*<\/h3>/.exec(docsHtml);
  if (!h3) return { html: docsHtml, found: false };
  const after = docsHtml.slice(h3.index + h3[0].length);
  const next = after.search(/<h2[\s>]/);
  const block = next < 0 ? after : after.slice(0, next);
  const tail = next < 0 ? '' : after.slice(next);
  const table = /<div class="table-wrap"[^>]*>(<table>[\s\S]*?<\/table>)<\/div>/.exec(block);
  if (!table) return { html: docsHtml, found: false };
  const { html: marked, counts, rows } = statusTable(table[1]);
  const owns = block.slice(table.index + table[0].length);
  // the Accessibility heading this belongs to, and the prose bullets between it and the table
  const h2At = docsHtml.lastIndexOf('<h2 ', h3.index);
  const h2 = h2At < 0 ? null : /^<h2 id="doc-accessibility">[\s\S]*?<\/h2>\n?/.exec(docsHtml.slice(h2At));
  const notes = h2 ? docsHtml.slice(h2At + h2[0].length, h3.index).trim() : '';
  const head = h2 ? docsHtml.slice(0, h2At) : docsHtml.slice(0, h3.index);
  const up = '../'.repeat(depth);
  const section = `<section class="a11y" id="a11y" aria-labelledby="a11y-title">
<h2 id="a11y-title">${W.item.a11yTitle}</h2>
<p class="a11y-intro">${W.item.a11yIntro}</p>
${countsHtml(counts, rows)}
<div class="table-wrap a11y-table" tabindex="0" role="region" aria-label="Conformance table">${marked}</div>
${owns.trim()}${notes ? `\n<h3 id="doc-a11y-notes">${W.item.a11yNotes}</h3>\n${notes}` : ''}
<p class="a11y-more"><a href="${up}accessibility">${W.item.a11yMore(tables)}</a></p>
</section>
`;
  return { html: head + section + tail, found: true, counts };
}

/** The h2 headings of a rendered page, as { id, text }, for an "On this page" list. */
export function headings(html) {
  return [...html.matchAll(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/g)].map(m => ({ id: m[1], text: stripTags(m[2]) }));
}
