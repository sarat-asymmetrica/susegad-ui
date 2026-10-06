// Tests for the canvas-text lint. The lint must fail on a broken fixture before it counts:
// the same fixture run through the CLI goes red, the clean twin goes green.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintText, lintFiles, scope } from './canvas-text-lint.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = p => `tools/fixtures/canvas-text/${p}`;

test('the broken fixture fails; the clean one passes; the allowed one passes under its exception', () => {
  const allowed = new Map([[FIX('allowed-render.js'), 'decided with the owner for this test']]);
  const findings = lintFiles([FIX('broken-render.js'), FIX('clean-render.js'), FIX('allowed-render.js')], allowed);
  assert.deepEqual(findings, [{ file: FIX('broken-render.js'), line: 3, what: 'fillText' }]);
});

test('lintText points at the right line and names the call', () => {
  assert.deepEqual(lintText('a\nb\ng.strokeText("x", 1, 2);\nc'), [{ line: 3, what: 'strokeText' }]);
});

test('the scope reaches render.js files and skins folders', () => {
  const s = scope();
  assert.ok(s.includes('packages/scenes/paus/render.js'), JSON.stringify(s.slice(0, 5)));
  assert.ok(s.some(p => p.includes('/skins/')), 'skins files are in scope');
});

test('the CLI exits non-zero on the broken fixture, zero on the clean one', () => {
  const red = (() => {
    try {
      execFileSync(process.execPath, ['tools/canvas-text-lint.mjs', FIX('broken-render.js')], { cwd: path.join(HERE, '..'), encoding: 'utf8' });
      return null;
    } catch (e) { return e; }
  })();
  assert.ok(red, 'the CLI should have failed on the broken fixture');
  assert.ok(red.stdout.includes('fillText on a canvas'));
  const green = execFileSync(process.execPath, ['tools/canvas-text-lint.mjs', FIX('clean-render.js')], { cwd: path.join(HERE, '..'), encoding: 'utf8' });
  assert.ok(green.includes('0 finding(s)'));
});

test('the whole tree passes: the decided exceptions cover every canvas text in scope', () => {
  const findings = lintFiles(scope());
  assert.deepEqual(findings, []);
});
