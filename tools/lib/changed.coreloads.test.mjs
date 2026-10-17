// Rasika (rigour rungs 1 and 2, r-changed 1): the checks that live in packages/core load other items by path
// (an import('/packages/scenes/kolam/index.js'), a demo's <sg-lazy src>), and a change to what they load must select
// them. Read from the real tree: which core check loads which item is a fact about the files.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContext } from './changed-deps.mjs';
import { selectChecks } from './changed.core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const walked = spawnSync(process.execPath, [join(root, 'tools', 'checks.mjs'), '--dry'], { cwd: root, encoding: 'utf8' });
const checks = walked.stdout.split('\n').map(l => l.trim()).filter(l => l.endsWith('.check.mjs'));
const items = JSON.parse(fs.readFileSync(join(root, 'registry', 'registry.json'), 'utf8')).items;
const pick = changed => {
  const context = buildContext({ root, checks, mergeBase: 'HEAD', files: changed });
  return selectChecks({ changed, checks, items, context }).selected.map(s => s.check);
};
const core = list => list.filter(c => c.startsWith('packages/core/')).sort();

test('kolam: the lazy check (its page and its sg-lazy src) and the scene-element check load it', () => {
  const got = core(pick(['packages/scenes/kolam/index.js']));
  assert.ok(got.includes('packages/core/lazy.check.mjs'), got.join(' '));
  assert.ok(got.includes('packages/core/scene-element.check.mjs'), got.join(' '));
});

test('badge: the csp check loads it; loader and progress: the component check', () => {
  assert.ok(core(pick(['packages/components/badge/badge.js'])).includes('packages/core/csp.check.mjs'));
  assert.ok(core(pick(['packages/components/loader/loader.js'])).includes('packages/core/component.check.mjs'));
  assert.ok(core(pick(['packages/components/progress/progress.css'])).includes('packages/core/component.check.mjs'));
});

test('paus: the scene-element check loads it', () => {
  assert.ok(core(pick(['packages/scenes/paus/index.js'])).includes('packages/core/scene-element.check.mjs'));
});

test('a core check is not selected by an item it does not load', () => {
  const got = core(pick(['packages/scenes/kolam/index.js']));
  assert.ok(!got.includes('packages/core/csp.check.mjs'), 'csp loads vaati and badge, not kolam');
  assert.ok(!got.includes('packages/core/announce.check.mjs'));
});

// r-changed 2: the docs site's checks follow the pieces they open or name (decision: by the quoted names and
// /scenes|components|recipes/<name> routes in the check, not "every item", which the site's own "all item pages
// answer 200" check would imply and which would run seven site checks for every piece).
const docs = list => list.filter(c => c.startsWith('apps/docs/')).sort();

test('a piece a docs check opens selects that docs check', () => {
  assert.ok(docs(pick(['packages/scenes/paus/index.js'])).includes('apps/docs/site.check.mjs'));
  assert.ok(docs(pick(['packages/scenes/kantar/index.js'])).includes('apps/docs/hero.check.mjs'), 'hero.check names kantar');
  assert.ok(docs(pick(['packages/scenes/kantar/index.js'])).includes('apps/docs/door.check.mjs'), "door.check opens /scenes/kantar");
  assert.ok(docs(pick(['packages/components/badge/badge.js'])).includes('apps/docs/site.check.mjs'));
  assert.ok(docs(pick(['packages/components/dialog/dialog.js'])).includes('apps/docs/header.check.mjs'));
  assert.ok(docs(pick(['packages/recipes/booking/recipe.js'])).includes('apps/docs/site.check.mjs'));
});

test('a piece no docs check opens selects none of them', () => {
  assert.deepEqual(docs(pick(['packages/scenes/chiro/index.js'])), []);
});
