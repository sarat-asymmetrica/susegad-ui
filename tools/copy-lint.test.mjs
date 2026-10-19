// Tests for the copy lint. The lint must fail on a broken fixture before it counts:
// the same fixture run through the CLI goes red, the clean twin goes green.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { lintText, htmlText, lintFiles, lintJsStrings, exportsStrings, isStringsFile, scope } from './copy-lint.mjs';

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

// The strings in code (the 26 per-piece "no em dash in meta" tests were these, one piece at a time).
test('a meta.js with an em dash in a string, and a hedge in a template, fails', () => {
  const findings = lintFiles(['tools/fixtures/copy/broken.meta.js']);
  assert.deepEqual(findings.map(f => [f.line, f.rule.split(' (')[0]]), [[5, 'no em dashes'], [6, 'hedge: announce honesty']]);
});

test('a STRINGS entry that is a function is linted too', () => {
  const findings = lintFiles(['tools/fixtures/copy/broken.strings.js']);
  assert.deepEqual(findings.map(f => [f.line, f.rule]), [[4, 'no em dashes']]);
});

test('comments and regexes in a code file are not copy', () => {
  assert.deepEqual(lintFiles(['tools/fixtures/copy/clean.strings.js']), []);
  assert.deepEqual(lintJsStrings('// a — b\n/* c — d */\nconst re = /—/;\nconst x = "fine";\n'), []);
  assert.deepEqual(lintJsStrings('const a = 1;\nconst b = `two\nlines — here`;').map(h => h.line), [3]);
});

test('exportsStrings finds the files that export STRINGS, in either form', () => {
  assert.ok(exportsStrings('export const STRINGS = {};'));
  assert.ok(exportsStrings('const STRINGS = {};\nexport { x, STRINGS };'));
  assert.ok(!exportsStrings('const STRINGS = {};'));
  assert.ok(!exportsStrings('export const STRINGS_EXTRA = {};'));
});

test('the real scope reaches every scene meta.js and the files that export STRINGS', () => {
  const files = scope();
  const metas = files.filter(f => f.endsWith('/meta.js'));
  const strings = files.filter(f => f.endsWith('.js') && !f.endsWith('/meta.js'));
  assert.ok(metas.length >= 30, `saw ${metas.length} meta.js files`);
  assert.ok(metas.includes('packages/scenes/abri/meta.js'));
  assert.ok(strings.length >= 40, `saw ${strings.length} files that export STRINGS`);
  assert.ok(strings.includes('packages/components/dialog/dialog.core.js'));
});

test('importing the lint runs nothing: the old module scanned the tree and exited on import', () => {
  assert.equal(typeof lintFiles, 'function'); // reaching this line at all is the check; before, no test in this file ever ran
});

test('a BY_LANG table in a *.strings.js is linted, though it exports no STRINGS', () => {
  assert.ok(!exportsStrings(fs.readFileSync(path.join(FIX, 'broken.bylang.strings.js'), 'utf8')), 'the fixture must not rely on a STRINGS export');
  assert.deepEqual(lintFiles(['tools/fixtures/copy/broken.bylang.strings.js']).map(f => [f.line, f.rule]), [[3, 'no em dashes']]);
});

test('the real scope reaches every *.strings.js and core/strings.table.js (agenda and speakers lost their em-dash tests to this)', () => {
  const files = scope();
  for (const f of ['packages/recipes/agenda/recipe.strings.js', 'packages/recipes/speakers/recipe.strings.js', 'packages/core/strings.table.js']) assert.ok(files.includes(f), `${f} is out of scope`);
  assert.equal(files.filter(f => f.endsWith('.strings.js')).length, 6);
});

test('an en dash is not linted: the charter bans the em dash, and a range such as 9–5 is copy', () => {
  assert.deepEqual(lintText('Open 9–5 on weekdays'), []);
  assert.deepEqual(isStringsFile('x.strings.js') && isStringsFile('strings.table.js') && !isStringsFile('xstringsyjs'), true);
});

test('every strings file under packages/ is in scope, whatever its prefix (templates/event/strings.js was missed)', () => {
  const files = scope();
  for (const f of ['packages/templates/event/strings.js', 'packages/core/strings.js']) assert.ok(files.includes(f), `${f} is out of scope`);
  assert.ok(isStringsFile('strings.js') && isStringsFile('x.strings.js') && isStringsFile('strings.table.js'));
  assert.ok(isStringsFile('zz-strings.js'), 'a hyphenated name is a strings file too (the comment says every *strings*.js)');
  assert.ok(!isStringsFile('strings.test.js') && !isStringsFile('xstrings.js'));
  assert.deepEqual(lintFiles(['tools/fixtures/copy/strings.js']).map(f => [f.line, f.rule]), [[2, 'no em dashes']]);
});
