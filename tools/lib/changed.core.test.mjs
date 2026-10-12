import test from 'node:test';
import assert from 'node:assert/strict';
import { selectChecks, itemDir, dependentsOf } from './changed.core.js';

const item = (name, type, dir, dependencies = [], files = []) => ({
  name, type, manifest: `${dir}/registry.json`, dependencies, files: files.map(path => ({ path: `${dir}/${path}` })),
});
const items = [
  item('core', 'package', 'packages/core'),
  item('tokens', 'package', 'packages/tokens'),
  item('field', 'component', 'packages/components/field', ['core', 'tokens']),
  item('form', 'component', 'packages/components/form', ['core', 'field']),
  item('dialog', 'component', 'packages/components/dialog', ['core']),
  item('button', 'component', 'packages/components/button', ['core']),
  item('booking', 'recipe', 'packages/recipes/booking', ['form']),
  item('scene-dar', 'scene', 'packages/scenes/dar', ['core']),
  item('kernels-booking', 'package', 'packages/kernels/booking', []),
];
const checks = [
  'packages/cli/create.check.mjs',
  'packages/components/button/button.check.mjs',
  'packages/components/dialog/dialog.check.mjs',
  'packages/components/field/field.check.mjs',
  'packages/components/form/form.check.mjs',
  'packages/components/overlays.check.mjs',
  'packages/recipes/booking/booking.check.mjs',
  'packages/scenes/dar/dar.check.mjs',
  'tools/touch.check.mjs',
];
const run = changed => selectChecks({ changed, checks, items });
const names = r => r.selected.map(s => s.check);

test('a fixture diff touching packages/core selects everything', () => {
  const r = run(['packages/core/index.js']);
  assert.equal(r.all, true);
  assert.match(r.allReason, /packages\/core\//);
  assert.deepEqual(names(r), checks);
});

test('every shared primitive selects everything', () => {
  for (const p of ['packages/engine/x.js', 'packages/tokens/tokens.css', 'tools/lib/browser.mjs', 'tools/lib/slots.core.js', 'package.json']) {
    assert.equal(run([p]).all, true, p);
  }
});

test('a prefix is a folder, not a string: packages/core-extra/ is not packages/core/', () => {
  assert.equal(run(['packages/core-extra/x.js']).all, false);
  assert.equal(run(['package.jsonx']).all, false);
});

test('a component change selects its own check, its dependents, and the touch check', () => {
  const r = run(['packages/components/field/field.css']);
  assert.equal(r.all, false);
  assert.deepEqual(names(r), [
    'packages/components/field/field.check.mjs',
    'packages/components/form/form.check.mjs',
    'packages/recipes/booking/booking.check.mjs',
    'tools/touch.check.mjs',
  ]);
});

test('dependents are transitive: field to form to the booking recipe', () => {
  const r = run(['packages/components/field/field.core.js']);
  const booking = r.selected.find(s => s.check.includes('booking'));
  assert.ok(booking);
  assert.match(booking.reasons.join(' '), /depends on field/);
});

test('reasons say why each check was chosen', () => {
  const r = run(['packages/components/field/field.css']);
  const field = r.selected.find(s => s.check.includes('field.check'));
  assert.match(field.reasons[0], /packages\/components\/field\//);
  const touch = r.selected.find(s => s.check === 'tools/touch.check.mjs');
  assert.match(touch.reasons[0], /component/);
});

test('an unrelated component and a scene are left out', () => {
  const r = run(['packages/components/field/field.css']);
  assert.ok(!names(r).some(n => n.includes('button') || n.includes('dar') || n.includes('dialog')));
});

test('a scene change selects its check but not the touch check', () => {
  const r = run(['packages/scenes/dar/dar.core.js']);
  assert.deepEqual(names(r), ['packages/scenes/dar/dar.check.mjs']);
});

test('a file in a subfolder of an item selects the item check', () => {
  assert.deepEqual(names(run(['packages/scenes/dar/assets/x.svg'])), ['packages/scenes/dar/dar.check.mjs']);
});

test('a check that lives in a shared folder runs for the pieces it covers, and not for the rest', () => {
  assert.ok(names(run(['packages/components/dialog/dialog.css'])).includes('packages/components/overlays.check.mjs'));
  assert.ok(!names(run(['packages/components/button/button.css'])).includes('packages/components/overlays.check.mjs'));
});

test('editing a check that lives in a shared folder selects that check', () => {
  assert.deepEqual(names(run(['packages/components/overlays.check.mjs'])), ['packages/components/overlays.check.mjs']);
});

test('a check outside the registry runs when its own folder changes', () => {
  assert.deepEqual(names(run(['packages/cli/create.mjs'])), ['packages/cli/create.check.mjs']);
});

test('the touch check runs when its own files change, and docs alone select nothing', () => {
  assert.deepEqual(names(run(['tools/touch.core.js'])), ['tools/touch.check.mjs']);
  const docs = run(['docs/LEDGER.md', 'tools/checks.mjs', 'tools/README.md']);
  assert.equal(docs.all, false);
  assert.deepEqual(docs.selected, []);
});

test('an item listed through its files, not just its folder, is touched', () => {
  const odd = [...items, item('shared-bit', 'package', 'packages/odd', [], ['a.js'])];
  const r = selectChecks({ changed: ['packages/odd/a.js'], checks: [...checks, 'packages/odd/odd.check.mjs'], items: odd });
  assert.deepEqual(r.selected.map(s => s.check), ['packages/odd/odd.check.mjs']);
});

test('dependentsOf follows chains, ignores unknown names and survives a cycle', () => {
  const loop = [item('a', 'component', 'p/a', ['b']), item('b', 'component', 'p/b', ['a', 'ghost'])];
  assert.deepEqual([...dependentsOf(loop, ['a']).keys()].sort(), ['b']);
  assert.deepEqual([...dependentsOf(items, ['field']).keys()].sort(), ['booking', 'form']);
});

test('itemDir is the manifest folder', () => assert.equal(itemDir(items[2]), 'packages/components/field'));

test('windows separators in the diff are tolerated', () => {
  assert.equal(run(['packages\\core\\index.js']).all, true);
});
