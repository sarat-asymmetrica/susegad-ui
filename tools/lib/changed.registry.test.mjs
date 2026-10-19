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

const names = items.map(i => i.name);

test('an edit to an existing piece does not select the site loop, though the index (a hash per file) is in the diff as real diffs have it', () => {
  const r = selectChecks({ changed: ['packages/recipes/agenda/recipe.js', 'registry/registry.json'], checks, items, baseItemNames: names });
  assert.ok(!r.selected.some(s => s.check === 'apps/docs/site.check.mjs'), JSON.stringify(r.selected));
});

test('a new item in the index selects it, naming the item; so does a removed one', () => {
  const added = selectChecks({ changed: ['registry/registry.json'], checks, items, baseItemNames: names.filter(n => n !== 'agenda') });
  assert.match(added.selected.find(s => s.check === 'apps/docs/site.check.mjs')?.reasons.join(' ') ?? '', /gained or lost \+agenda/);
  const removed = selectChecks({ changed: ['registry/registry.json'], checks, items, baseItemNames: [...names, 'zzz-gone'] });
  assert.match(removed.selected.find(s => s.check === 'apps/docs/site.check.mjs')?.reasons.join(' ') ?? '', /-zzz-gone/);
});

test('when the base index cannot be read, any change to the index selects the site loop and says why', () => {
  const r = selectChecks({ changed: ['packages/recipes/agenda/recipe.js', 'registry/registry.json'], checks, items });
  assert.match(r.selected.find(s => s.check === 'apps/docs/site.check.mjs')?.reasons.join(' ') ?? '', /base's index is unknown/);
});
