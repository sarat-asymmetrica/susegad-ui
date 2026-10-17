// `--changed` and the files a check reads without importing them: tools/fixtures/*, and the docs-site checks
// that were outside both the suite's walk and the selection (the DOCS_SITE rule could not fire on a list that
// never held them).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSpecifiers } from './deps.core.js';
import { buildContext } from './changed-deps.mjs';
import { selectChecks } from './changed.core.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FIXTURES = ['touch', 'images', 'fixture-scene', 'slot-child', 'copy'];

test('parseSpecifiers finds a fixture named as a path or as the pieces of a joined path', () => {
  const src = "const a = new URL('../../../tools/fixtures/touch/page.html', import.meta.url); const b = path.join(HERE, 'fixtures', 'images', f.dir); const c = '/tools/fixtures/fixture-scene/index.js';";
  assert.deepEqual(parseSpecifiers(src, { fixtures: FIXTURES }).repoPaths.sort(), ['tools/fixtures/fixture-scene', 'tools/fixtures/images', 'tools/fixtures/touch']);
});

test('a fixture name is not found inside a longer name, or where nothing says fixtures', () => {
  const src = "// fixtures/touch-more is not touch\nconst touch = 1; const x = 'fixtures/copyright';";
  assert.deepEqual(parseSpecifiers(src, { fixtures: FIXTURES }).repoPaths, []);
  assert.deepEqual(parseSpecifiers("import 'fixtures/touch'", {}).repoPaths, [], 'with no list, none is looked for');
});

// These two read the real tree: which checks read which fixtures is a fact about the files.
const walked = spawnSync(process.execPath, [join(root, 'tools', 'checks.mjs'), '--dry'], { cwd: root, encoding: 'utf8' });
const checks = walked.stdout.split('\n').map(l => l.trim()).filter(l => l.endsWith('.check.mjs'));
const pick = changed => {
  const context = buildContext({ root, checks, mergeBase: 'HEAD', files: changed });
  return selectChecks({ changed, checks, items: [], context });
};

test('a change under tools/fixtures/touch selects the touch check, with the reason', () => {
  const touch = pick(['tools/fixtures/touch/page.html']).selected.map(s => s.check);
  assert.deepEqual(touch, ['tools/touch.check.mjs']);
  assert.match(pick(['tools/fixtures/touch/page.html']).selected[0].reasons.join(' '), /reads tools\/fixtures\/touch\/, which changed/);
});

test('a change to the tinto-glass fixture selects the glass check that reads it', () => {
  assert.ok(pick(['tools/fixtures/tinto-glass/scene-element.main-654935d.js']).selected.map(s => s.check).includes('packages/scenes/tinto/glass.check.mjs'));
});

test('the suite walks the seven docs-site checks, so prose selects them', () => {
  const docs = ['door', 'embed', 'header', 'hero', 'npx', 'pointers', 'site'].map(n => `apps/docs/${n}.check.mjs`);
  assert.deepEqual(docs.filter(d => !checks.includes(d)), [], 'every one is in the list the runner selects from');
  const r = selectChecks({ changed: ['docs/CHARTER.md'], checks, items: [] });
  assert.deepEqual(docs.filter(d => !r.selected.some(s => s.check === d)), [], 'prose the site renders selects each of them');
});
