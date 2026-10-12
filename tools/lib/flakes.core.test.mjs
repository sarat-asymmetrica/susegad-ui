import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKnownFlakes, knownFlake, verdict } from './flakes.core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const doc = rows => `# Browsers\n\n## Something else\n| Check | Engine |\n|---|---|\n| \`not/this.check.mjs\` | all |\n\n## Known flakes\n\nProse before the table.\n\n| Check | Engine | Cause | Since | Recorded |\n|---|---|---|---|---|\n${rows.join('\n')}\n\nProse after.\n\n## Next section\n| \`nor/this.check.mjs\` | all | x | 2026-01-01 | |\n`;

test('reads only the Known flakes table, with or without backticks, ignoring the extra columns', () => {
  const flakes = parseKnownFlakes(doc([
    '| `packages/a/a.check.mjs` | all | the drift under load | 2026-09-28 | LEDGER |',
    '| packages/b/b.check.mjs | chromium | a view transition aborts (InvalidStateError) | 2026-10-07 | |',
  ]));
  assert.deepEqual(flakes, [
    { check: 'packages/a/a.check.mjs', engine: 'all', cause: 'the drift under load', since: '2026-09-28' },
    { check: 'packages/b/b.check.mjs', engine: 'chromium', cause: 'a view transition aborts (InvalidStateError)', since: '2026-10-07' },
  ]);
});

test('no section, no flakes', () => assert.deepEqual(parseKnownFlakes('# Browsers\n\nnothing here\n'), []));

test('a row it cannot read is an error, never a silent skip', () => {
  assert.throws(() => parseKnownFlakes(doc(['| `a.check.mjs` | safari | x | 2026-10-07 | |'])), /engine "safari"/);
  assert.throws(() => parseKnownFlakes(doc(['| `a.check.mjs` | all | x | last week | |'])), /not a date/);
  assert.throws(() => parseKnownFlakes(doc(['| `a.check` | all | x | 2026-10-07 | |'])), /not a check path/);
  assert.throws(() => parseKnownFlakes(doc(['| `a.check.mjs` | all |  | 2026-10-07 | |'])), /cause is empty/);
});

const flakes = [
  { check: 'a.check.mjs', engine: 'all', cause: 'drift', since: '2026-09-28' },
  { check: 'b.check.mjs', engine: 'chromium', cause: 'aborts', since: '2026-10-07' },
];

test('knownFlake matches the engine named, or all', () => {
  assert.equal(knownFlake(flakes, 'a.check.mjs', 'webkit').cause, 'drift');
  assert.equal(knownFlake(flakes, 'b.check.mjs', 'chromium').cause, 'aborts');
  assert.equal(knownFlake(flakes, 'b.check.mjs', 'firefox'), null);
  assert.equal(knownFlake(flakes, 'c.check.mjs', 'chromium'), null);
});

test('the exit code counts only new reds', () => {
  const onlyKnown = verdict([{ check: 'a.check.mjs', ok: false }, { check: 'c.check.mjs', ok: true }], flakes, 'chromium');
  assert.deepEqual(onlyKnown, { newReds: [], known: [{ check: 'a.check.mjs', cause: 'drift' }], exitCode: 0 });
  const withNew = verdict([{ check: 'a.check.mjs', ok: false }, { check: 'b.check.mjs', ok: false }], flakes, 'firefox');
  assert.deepEqual(withNew.newReds, ['b.check.mjs']); // listed for chromium only, so new in firefox
  assert.equal(withNew.exitCode, 1);
});

test('a listed check that passes is neither known nor new', () => {
  assert.deepEqual(verdict([{ check: 'a.check.mjs', ok: true }], flakes, 'chromium'), { newReds: [], known: [], exitCode: 0 });
});

test('docs/BROWSERS.md: the table parses, every check exists, and the real reds are not in it', () => {
  const real = parseKnownFlakes(fs.readFileSync(path.join(root, 'docs', 'BROWSERS.md'), 'utf8'));
  assert.ok(real.length >= 5, `${real.length} rows`);
  for (const f of real) assert.ok(fs.existsSync(path.join(root, f.check)), f.check);
  assert.ok(!real.some(f => f.check.endsWith('veranda/words.check.mjs')), 'veranda/words is a real red from the M1 merge, not a flake');
});
