// The slips the October rigour audit found in `--changed`, each as a case: change X, and check Y must run.
// They read the real registry/registry.json, so a demo that comes to load another item's files without the
// build noticing (registry/edges.mjs) turns one of these red, and so does a selection rule that stops following it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectChecks, dependentsOf } from './changed.core.js';

const items = JSON.parse(readFileSync(fileURLToPath(new URL('../../registry/registry.json', import.meta.url)), 'utf8')).items;
const checks = [
  'apps/docs/site.check.mjs', 'packages/components/form/form.check.mjs', 'packages/components/overlays.check.mjs',
  'packages/components/postcard/postcard.check.mjs', 'packages/components/site-nav/site-nav.check.mjs',
  'packages/components/tooltip/tooltip.check.mjs', 'packages/recipes/proposal/proposal.check.mjs',
  'packages/components/button/button.check.mjs', 'packages/components/dialog/dialog.check.mjs',
];
const picked = changed => selectChecks({ changed, checks, items }).selected.map(s => s.check);

const SLIPS = [
  ['packages/components/field/field.js', 'packages/components/form/form.check.mjs', "form's demo loads field"],
  ['packages/components/stamp/stamp.js', 'packages/components/postcard/postcard.check.mjs', 'postcard loads stamp'],
  ['packages/components/stamp/stamp.js', 'packages/components/site-nav/site-nav.check.mjs', 'site-nav loads stamp'],
  ['packages/components/button/button.css', 'packages/components/tooltip/tooltip.check.mjs', 'the tooltip demo loads button'],
  ['packages/components/button/button.css', 'packages/components/overlays.check.mjs', 'overlays covers popover, tooltip and action-menu, which load button'],
  ['packages/folio/md/index.js', 'packages/recipes/proposal/proposal.check.mjs', "the proposal page renders with folio's Markdown"],
];
for (const [changed, expected, why] of SLIPS) {
  test(`${changed} selects ${expected.split('/').pop()} (${why})`, () => {
    assert.ok(picked([changed]).includes(expected), `${expected} was not selected for ${changed}`);
  });
}

test('an edge only a demo loads is a reason of its own, not a claim that the item installs it', () => {
  const r = selectChecks({ changed: ['packages/components/field/field.js'], checks, items });
  const form = r.selected.find(s => s.check.endsWith('form.check.mjs'));
  assert.match(form.reasons.join(' '), /form's demo or page loads field/);
  const field = items.find(i => i.name === 'field');
  assert.ok(!items.find(i => i.name === 'form').dependencies.includes(field.name), 'form still does not install field');
});

test('dependentsOf follows checkDeps, tells them apart, and ignores one already declared', () => {
  const its = [
    { name: 'a', dependencies: [] }, { name: 'b', dependencies: ['a'], checkDeps: [] },
    { name: 'c', dependencies: [], checkDeps: ['a'] }, { name: 'd', dependencies: ['c'] },
    { name: 'e', dependencies: ['a'], checkDeps: ['a'] },
  ];
  const d = dependentsOf(its, ['a']);
  assert.deepEqual([...d.keys()].sort(), ['b', 'c', 'd', 'e']);
  assert.equal(d.get('c').loads, true);
  assert.equal(d.get('b').loads, false);
  assert.equal(d.get('e').loads, false, 'declared and loaded: it is a dependency');
  assert.deepEqual(d.get('d'), { root: 'a', via: 'c', loads: false });
});
