import test from 'node:test';
import assert from 'node:assert/strict';
import { rewriteHref, rewriteLinks, GITHUB } from './links.core.js';

const files = new Set(['docs/decisions/0025-languages.md', 'docs/requests/x.md', 'packages/components/dialog/dialog.js', 'packages/components/dialog/demo.html', 'packages/components', 'tools/axe.mjs']);
const ctx = {
  pageOf: t => ({ 'packages/surfaces/carepa/carepa.docs.md': 'foundations/surface-carepa' }[t] ?? null),
  shipped: new Set(['packages/components/dialog/demo.html']),
  exists: p => files.has(p),
  isPrivate: p => p.startsWith('docs/requests/'),
  depth: 1,
};
const from = 'packages/components/dialog/dialog.docs.md';

test('a docs file the site renders is that page, and its anchor follows', () => {
  assert.equal(rewriteHref('../../surfaces/carepa/carepa.docs.md', from, ctx), '../foundations/surface-carepa');
  assert.equal(rewriteHref('../../surfaces/carepa/carepa.docs.md#lineage', from, ctx), '../foundations/surface-carepa#doc-lineage');
  assert.equal(rewriteHref('../../surfaces/carepa/carepa.docs.md#conformance-wcag-22-aa', from, ctx), '../foundations/surface-carepa#a11y');
});
test('the handoff, the browser matrix and the summary stay on the site', () => {
  assert.equal(rewriteHref('../../../docs/HANDOFF.md', from, ctx), '../handoff');
  assert.equal(rewriteHref('../../../docs/BROWSERS.md#the-support-matrix', from, ctx), '../browsers#doc-the-support-matrix');
  assert.equal(rewriteHref('../../../docs/reference/accessibility.md', from, ctx), '../accessibility');
});
test('a shipped demo is a link on the site; another public file is on GitHub; a folder is a tree', () => {
  assert.equal(rewriteHref('./demo.html', from, ctx), '../packages/components/dialog/demo.html');
  assert.equal(rewriteHref('./dialog.js', from, ctx), `${GITHUB}/blob/main/packages/components/dialog/dialog.js`);
  assert.equal(rewriteHref('../', from, ctx), `${GITHUB}/tree/main/packages/components`);
});
test('a private file is no link, a missing one and an outside one are left alone', () => {
  assert.equal(rewriteHref('../../../docs/requests/x.md', from, ctx), false);
  assert.equal(rewriteHref('./nothing.md', from, ctx), null);
  assert.equal(rewriteHref('https://example.in/', from, ctx), null);
  assert.equal(rewriteHref('#usage', from, ctx), null);
});
test('rewriteLinks keeps the words when it drops a link', () => {
  const html = rewriteLinks('<p>see <a href="../../../docs/requests/x.md">the request</a> and <a href="../../../tools/axe.mjs">axe</a></p>', from, ctx);
  assert.equal(html, `<p>see the request and <a href="${GITHUB}/blob/main/tools/axe.mjs">axe</a></p>`);
});
