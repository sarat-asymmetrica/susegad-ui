import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpecifiers, packageName, resolveRelative, importClosure, lockChanges, manifestChanges, packageClosure } from './deps.core.js';

test('parseSpecifiers finds every way a file loads another, and sorts relative from packages', () => {
  const src = `
    import fs from 'node:fs';
    import path from 'path';
    import { chromium,
      webkit } from 'playwright';
    import './side-effect.js';
    export { a } from '../lib/a.mjs';
    export * from "./b.js";
    const m = await import('./lazy.mjs');
    const t = await import(\`./\${name}.mjs\`); // a template: not a literal
    const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
    const w = require('wawoff2');
    const s = require.resolve('@img/sharp-win32-x64/package.json');
    spawnSync(process.execPath, ['tools/lib/strip.mjs', '--x']);
    const url = '/packages/core/index.js'; // a served path, not an import
  `;
  const r = parseSpecifiers(src);
  assert.deepEqual(r.relative.sort(), ['../lib/a.mjs', './b.js', './lazy.mjs', './side-effect.js']);
  assert.deepEqual(r.bare.sort(), ['@img/sharp-win32-x64', 'axe-core', 'playwright', 'wawoff2']);
  assert.deepEqual(r.repoPaths, ['tools/lib/strip.mjs']);
});

test('packageName: scopes, subpaths, builtins and templates', () => {
  assert.equal(packageName('axe-core/axe.min.js'), 'axe-core');
  assert.equal(packageName('@a/b/c.js'), '@a/b');
  assert.equal(packageName('fs'), null);
  assert.equal(packageName('${p}'), null);
});

test('resolveRelative walks up and down from the importing file', () => {
  assert.equal(resolveRelative('tools/lib/a.mjs', '../serve.mjs'), 'tools/serve.mjs');
  assert.equal(resolveRelative('packages/x/x.check.mjs', '../../tools/lib/b.mjs?v=1'), 'tools/lib/b.mjs');
  assert.equal(resolveRelative('a/b.js', './c/d.js'), 'a/c/d.js');
});

test('importClosure follows files transitively, remembers who reached each, survives a cycle', () => {
  const g = {
    'c.check.mjs': { files: ['lib/a.mjs'], packages: ['playwright'] },
    'lib/a.mjs': { files: ['lib/b.mjs', 'c.check.mjs'], packages: [] },
    'lib/b.mjs': { files: ['lib/a.mjs'], packages: ['jsqr'] },
  };
  const r = importClosure('c.check.mjs', f => g[f] ?? null);
  assert.deepEqual([...r.files], [['c.check.mjs', null], ['lib/a.mjs', 'c.check.mjs'], ['lib/b.mjs', 'lib/a.mjs']]);
  assert.deepEqual([...r.packages].sort(), ['jsqr', 'playwright']);
});

const lock = (pkgs, root = {}) => ({ lockfileVersion: 3, packages: { '': root, ...pkgs } });
const oldLock = lock({
  'node_modules/playwright': { version: '1.63.0', integrity: 'x1', dependencies: { 'playwright-core': '1.63.0' } },
  'node_modules/playwright-core': { version: '1.63.0', integrity: 'x2' },
  'node_modules/subset-font': { version: '2.9.0', integrity: 'x3', dependencies: { harfbuzzjs: '^1' } },
  'node_modules/harfbuzzjs': { version: '1.6.2', integrity: 'x4' },
  'node_modules/a/node_modules/@s/deep': { version: '1.0.0', integrity: 'x5' },
}, { devDependencies: { playwright: '^1.63.0', harfbuzzjs: '1.6.2' } });

test('lockChanges names what changed: a version, an addition, a removal, a nested scoped package', () => {
  const next = structuredClone(oldLock);
  next.packages['node_modules/harfbuzzjs'] = { version: '1.6.3', integrity: 'y4' };
  assert.deepEqual(lockChanges(oldLock, next), ['harfbuzzjs']);
  delete next.packages['node_modules/a/node_modules/@s/deep'];
  next.packages['node_modules/new-thing'] = { version: '0.1.0', integrity: 'z' };
  assert.deepEqual(lockChanges(oldLock, next), ['@s/deep', 'harfbuzzjs', 'new-thing']);
  assert.deepEqual(lockChanges(oldLock, structuredClone(oldLock)), []);
  assert.deepEqual(lockChanges(null, oldLock).length, 5);
});

test('lockChanges reads the root entry too: a spec changed in package.json, before npm install', () => {
  const next = structuredClone(oldLock);
  next.packages[''].devDependencies.harfbuzzjs = '1.6.3';
  assert.deepEqual(lockChanges(oldLock, next), ['harfbuzzjs']);
});

test('manifestChanges compares every dependency field, and ignores scripts', () => {
  const a = { scripts: { test: 'x' }, devDependencies: { playwright: '^1.63.0', sharp: '1' } };
  assert.deepEqual(manifestChanges(a, { ...a, scripts: { test: 'y' } }), []);
  assert.deepEqual(manifestChanges(a, { ...a, devDependencies: { playwright: '^1.64.0' } }), ['playwright', 'sharp']);
});

test('packageClosure follows dependencies by name across both locks', () => {
  assert.deepEqual([...packageClosure([oldLock], ['playwright'])].sort(), ['playwright', 'playwright-core']);
  assert.deepEqual([...packageClosure([oldLock], ['subset-font'])].sort(), ['harfbuzzjs', 'subset-font']);
  assert.deepEqual([...packageClosure([oldLock, null], ['unknown'])], ['unknown']);
});
