// The npm dependencies an added item brings (decision 0017): which pins it
// needs, and how they merge into the consumer's package.json. Pure cases here;
// the end-to-end run against a scratch project is in cli.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collectNpmDeps, mergeNpmDeps, writePackageJson } from './src/npmdeps.js';

const item = (name, npmDependencies) => ({ name, ...(npmDependencies && { npmDependencies }) });

test('collectNpmDeps: every item’s pins, transitive ones included, with who asked', () => {
  const wanted = collectNpmDeps([item('stage3d', { three: '0.186.1' }), item('core'), item('depth-photo', { three: '0.186.1' }), item('export', { mediabunny: '1.60.0' })]);
  assert.deepEqual(wanted, { mediabunny: { version: '1.60.0', by: ['export'] }, three: { version: '0.186.1', by: ['stage3d', 'depth-photo'] } });
  assert.deepEqual(collectNpmDeps([item('core')]), {});
});

test('collectNpmDeps: two items pinning one package differently is a broken registry, said in words', () => {
  assert.throws(() => collectNpmDeps([item('a', { three: '0.186.1' }), item('b', { three: '0.170.0' })]),
    /three is pinned at 0\.186\.1 by a and 0\.170\.0 by b/);
});

test('mergeNpmDeps: a missing one is added to dependencies', () => {
  const r = mergeNpmDeps({ name: 'site', dependencies: { lit: '3.2.0' } }, { three: { version: '0.186.1', by: ['stage3d'] } });
  assert.deepEqual(r.pkg.dependencies, { lit: '3.2.0', three: '0.186.1' });
  assert.deepEqual(r.added, [{ name: 'three', version: '0.186.1', by: ['stage3d'] }]);
  assert.deepEqual(r.kept, []);
  assert.equal(r.changed, true);
});

test('mergeNpmDeps: no dependencies block yet: one is made', () => {
  const r = mergeNpmDeps({ name: 'site' }, { three: { version: '0.186.1', by: ['stage3d'] } });
  assert.deepEqual(r.pkg.dependencies, { three: '0.186.1' });
});

test('mergeNpmDeps: an equal pin is left as it is, wherever it sits', () => {
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
    const pkg = { name: 'site', [field]: { three: '0.186.1' } };
    const r = mergeNpmDeps(pkg, { three: { version: '0.186.1', by: ['stage3d'] } });
    assert.equal(r.changed, false, field);
    assert.deepEqual(r.same, [{ name: 'three', version: '0.186.1', field }]);
    assert.deepEqual(r.pkg, pkg);
  }
});

test('mergeNpmDeps: a different version of theirs is kept, never overwritten, and reported', () => {
  const pkg = { name: 'site', dependencies: { three: '^0.170.0' }, devDependencies: { mediabunny: '1.59.0' } };
  const r = mergeNpmDeps(pkg, { three: { version: '0.186.1', by: ['stage3d'] }, mediabunny: { version: '1.60.0', by: ['export'] } });
  assert.equal(r.pkg.dependencies.three, '^0.170.0');
  assert.equal(r.pkg.devDependencies.mediabunny, '1.59.0');
  assert.equal(r.changed, false);
  assert.deepEqual(r.kept, [
    { name: 'mediabunny', theirs: '1.59.0', field: 'devDependencies', ours: '1.60.0', by: ['export'] },
    { name: 'three', theirs: '^0.170.0', field: 'dependencies', ours: '0.186.1', by: ['stage3d'] },
  ]);
});

test('mergeNpmDeps: the input object is not mutated, and dependencies come out sorted, as npm writes them', () => {
  const pkg = { name: 'site', dependencies: { zod: '3.0.0', lit: '3.2.0' } };
  const r = mergeNpmDeps(pkg, { three: { version: '0.186.1', by: ['x'] } });
  assert.deepEqual(Object.keys(r.pkg.dependencies), ['lit', 'three', 'zod']);
  assert.deepEqual(pkg.dependencies, { zod: '3.0.0', lit: '3.2.0' });
});

test('writePackageJson: keeps the file’s own indent and line endings', () => {
  assert.equal(writePackageJson('{\n    "a": 1\n}\n', { a: 1, b: 2 }), '{\n    "a": 1,\n    "b": 2\n}\n');
  assert.equal(writePackageJson('{\r\n\t"a": 1\r\n}\r\n', { a: 1 }), '{\r\n\t"a": 1\r\n}\r\n');
  assert.equal(writePackageJson('{"a":1}', { a: 1 }), '{\n  "a": 1\n}\n');
});
