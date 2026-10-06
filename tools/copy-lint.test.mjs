// Tests for the copy lint. The lint must fail on a broken fixture before it counts:
// the same fixture run through the CLI goes red, the clean twin goes green.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lintText, htmlText, lintFiles } from './copy-lint.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures', 'copy');

test('a fixture with an em dash and a hedge fails', () => {
  const findings = lintFiles(['tools/fixtures/copy/broken.docs.md']);
  const rules = findings.map(f => f.rule);
  assert.ok(rules.some(r => r === 'no em dashes'), `expected an em-dash hit, got ${rules}`);
  assert.ok(rules.some(r => r.startsWith('hedge:')), `expected a hedge hit, got ${rules}`);
});

test('the clean twin passes', () => {
  assert.deepEqual(lintFiles(['tools/fixtures/copy/clean.docs.md']), []);
});

test('lintText points at the right line', () => {
  const hits = lintText('line one\nTo be honest, this is fine.\nline three — with a dash');
  assert.deepEqual(hits.map(h => h.line), [2, 3]);
  assert.equal(hits[1].rule, 'no em dashes');
});

test('an HTML page is linted on its text, not its tags', () => {
  const t = htmlText('<p>Prices from Rs 2,000</p><script>const a = "x — y";</script>');
  assert.deepEqual(lintText(t), []);
});

test('the CLI exits non-zero on the fixture, zero on the clean file', () => {
  const red = (() => {
    try {
      execFileSync(process.execPath, ['tools/copy-lint.mjs', 'tools/fixtures/copy/broken.docs.md'], { cwd: path.join(HERE, '..'), encoding: 'utf8' });
      return null;
    } catch (e) { return e; }
  })();
  assert.ok(red, 'the CLI should have failed on the broken fixture');
  assert.ok(red.stdout.includes('no em dashes'));
  const green = execFileSync(process.execPath, ['tools/copy-lint.mjs', 'tools/fixtures/copy/clean.docs.md'], { cwd: path.join(HERE, '..'), encoding: 'utf8' });
  assert.ok(green.includes('0 finding(s)'));
});
