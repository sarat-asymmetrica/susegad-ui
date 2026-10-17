import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { statusTable, accessibilitySection, headings } from './a11y.core.js';
import { parseSummary, accessibilityPage, newestItems, newestHtml, longDate, gapsPhrase, templatesExtras } from './door.core.js';
import { firstAdded } from './joined.mjs';

const TABLE = `<div class="table-wrap" tabindex="0" role="region" aria-label="Table 1"><table>
<thead><tr><th>Criterion</th><th>Status</th><th>How it was checked</th></tr></thead>
<tbody>
<tr><td>1.1.1 Non-text content</td><td>Meets</td><td>Checked by <code>x.check.mjs</code>.</td></tr>
<tr><td>2.4.11 Focus not obscured</td><td>Meets with author's part</td><td>The page owns its sticky header.</td></tr>
<tr><td>1.4.13 Content on hover</td><td>Not applicable</td><td>Opens on a press.</td></tr>
</tbody>
</table></div>`;
const DOCS = `<h2 id="doc-usage">Usage</h2>\n<p>Use it.</p>\n<h2 id="doc-accessibility">Accessibility</h2>\n<ul>\n<li>Focus is trapped natively.</li>\n</ul>\n<h3 id="doc-conformance-wcag-2-2-aa">Conformance (WCAG 2.2 AA)</h3>\n${TABLE}\n<p><strong>The page author owns:</strong></p>\n<ul>\n<li>The title.</li>\n</ul>\n<h2 id="doc-lineage">Lineage</h2>\n<p>After.</p>`;

test('a conformance table: each status is a labelled mark, each cell knows its column, the counts are the table\'s', () => {
  const { html, counts, rows } = statusTable(TABLE);
  assert.equal(rows, 3);
  assert.deepEqual(counts, { meets: 1, author: 1, na: 1, gap: 0, other: 0 });
  assert.match(html, /<span class="status status-meets">Meets<\/span>/);
  assert.match(html, /<span class="status status-author">Meets with author's part<\/span>/);
  assert.match(html, /<td data-label="How it was checked">Checked by <code>x\.check\.mjs<\/code>\.<\/td>/);
});

test('the accessibility section comes first under its heading: table, who owns what, then the old bullets', () => {
  const { html, found } = accessibilitySection(DOCS, { tables: 53 });
  assert.ok(found);
  const at = s => html.indexOf(s);
  assert.ok(at('id="a11y"') > at('Usage') && at('id="a11y"') < at('id="doc-lineage"'), 'the section stays where Accessibility was');
  assert.ok(at('a11y-counts') < at('<table') && at('<table') < at('The page author owns') && at('The page author owns') < at('How it behaves') && at('How it behaves') < at('Focus is trapped natively'));
  assert.match(html, /<a href="\.\.\/accessibility">All 53 tables, and how the library tests<\/a>/);
  assert.equal((html.match(/<h2 id="doc-accessibility"/g) || []).length, 0, 'the old heading is replaced, not repeated');
  assert.deepEqual(headings(html).map(h => h.text), ['Usage', 'Accessibility', 'Lineage']);
});

test('a docs page with no table comes back as it was', () => {
  const plain = '<h2 id="doc-usage">Usage</h2><p>x</p>';
  assert.deepEqual(accessibilitySection(plain, { tables: 53 }), { html: plain, found: false });
});

const SUMMARY = `# Accessibility conformance

53 of 53 components have their conformance table written.

## Components

| Component | Traits | Meets | Meets with author's part | Not applicable | Does not meet |
|---|---|---|---|---|---|
| [accordion](../../packages/components/accordion/accordion.docs.md#conformance-wcag-22-aa) | interactive | 1.1.1, 1.3.1 | 2.4.11 | none | none |
| [tooltip](../../packages/components/tooltip/tooltip.docs.md#conformance-wcag-22-aa) | overlay | 1.1.1 | none | none | 1.4.13 |

## Known gaps

| Component | Criterion | What fails |
|---|---|---|
| tooltip | 1.4.13 Content on hover or focus | Escape does nothing with JavaScript off. |

## What the page author owns, by component
`;

test('the summary is read as data: the number, the gaps and each component\'s counts', () => {
  const s = parseSummary(SUMMARY);
  assert.equal(s.tables, 53);
  assert.deepEqual(s.gaps.map(g => [g.component, g.criterion.split(' ')[0]]), [['tooltip', '1.4.13']]);
  assert.deepEqual(s.components.map(c => [c.name, c.meets.length, c.author.length, c.na.length, c.gap.length]), [['accordion', 2, 1, 0, 0], ['tooltip', 1, 0, 0, 1]]);
  assert.equal(gapsPhrase(s.gaps), '1, tooltip (1.4.13)');
});

test('the real summary parses, and the page it makes names a gap when the summary has one', () => {
  const real = parseSummary(fs.readFileSync(new URL('../../docs/reference/accessibility.md', import.meta.url), 'utf8'));
  assert.ok(real.tables >= 53 && real.components.length === real.tables, `${real.tables} tables, ${real.components.length} rows`);
  const html = accessibilityPage(parseSummary(SUMMARY), new Set(['accordion', 'tooltip']));
  assert.match(html, /Known gaps today: 1, tooltip \(1\.4\.13\)\. Each is listed with what fails\./);
  assert.match(html, /href="components\/accordion#a11y">accordion</);
  assert.match(html, /<title>Accessibility and browsers · Susegad UI<\/title>/);
  const none = accessibilityPage({ ...parseSummary(SUMMARY), gaps: [] }, new Set());
  assert.match(none, /Known gaps today: none\./);
});

test('Newest: the newest by the date they joined, the oldest left out, an undated one never listed', () => {
  const items = ['a', 'b', 'c', 'd'].map(n => ({ name: n, type: 'component', title: n.toUpperCase(), description: `The ${n}. It does a thing.` }));
  const joined = { a: '2026-09-24T10:00:00+05:30', b: '2026-10-07T08:00:00+05:30', c: '2026-10-07T09:00:00+05:30' };
  assert.deepEqual(newestItems(items, joined, 2).map(i => i.name), ['c', 'b']);
  const html = newestHtml(newestItems(items, joined, 3));
  assert.match(html, /href="components\/c">C</);
  assert.match(html, /Component, added 7 October 2026/);
  assert.doesNotMatch(html, />D</);
  assert.match(newestHtml([]), /will show here as they join the library/);
  assert.equal(longDate('2026-09-04T01:00:00+05:30'), '4 September 2026');
});

test('git log to join dates: the oldest add wins', () => {
  const log = '\u00012026-10-07T09:00:00+05:30\npackages/a/registry.json\n\u00012026-09-24T10:00:00+05:30\npackages/a/registry.json\npackages/b/registry.json\n';
  assert.deepEqual(firstAdded(log), { 'packages/a/registry.json': '2026-09-24T10:00:00+05:30', 'packages/b/registry.json': '2026-09-24T10:00:00+05:30' });
});

test('the templates page: the event frame starts quiet, the toy has a labelled field and a status, and the npm note shows while create is not on npm', () => {
  const html = templatesExtras({ eventSrc: 'templates/event/site/', konkani: [] });
  assert.match(html, /<iframe id="live-frame" title="The event template, live" src="templates\/event\/site\/\?register=quiet"/);
  assert.match(html, /<label for="name">A name<\/label>/);
  assert.match(html, /id="status" class="toy-status" role="status"/);
  assert.match(html, /class="npm-note"/);
  assert.doesNotMatch(templatesExtras({ eventSrc: 'x/', createOnNpm: true }), /class="npm-note"/);
});
