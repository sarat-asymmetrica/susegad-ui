// Rasika, T3: a NEW piece reaches the registry index, and the docs site's all-pages loop (apps/docs/site.check.mjs) must run for it.
// An edit to an existing piece does not change which pages exist, so it does not select that check on this account.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { selectChecks } from './changed.core.js';

const items = JSON.parse(readFileSync(fileURLToPath(new URL('../../registry/registry.json', import.meta.url)), 'utf8')).items;
const checks = ['apps/docs/site.check.mjs', 'apps/docs/embed.check.mjs', 'packages/recipes/agenda/agenda.check.mjs', 'packages/components/button/button.check.mjs'];
const picked = changed => selectChecks({ changed, checks, items });

test('a change to registry/registry.json (the index) selects the docs site check, which walks every item', () => {
  const r = picked(['registry/registry.json']);
  const site = r.selected.find(s => s.check === 'apps/docs/site.check.mjs');
  assert.ok(site, 'site.check.mjs was not selected');
  assert.match(site.reasons.join(' '), /registry index/);
});

test('a new piece (its folder, its demo and the registry entry) selects the docs site check', () => {
  const r = picked(['packages/recipes/zzz/recipe.js', 'packages/recipes/zzz/demo.html', 'registry/registry.json']);
  assert.ok(r.selected.some(s => s.check === 'apps/docs/site.check.mjs'));
});

test('an edit to an existing piece does not select the site loop (reachability did not change)', () => {
  const r = picked(['packages/recipes/agenda/recipe.js']);
  assert.ok(!r.selected.some(s => s.check === 'apps/docs/site.check.mjs'));
});
