import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseKnownFlakes, knownFlake, verdict, addDays, isExpired, clauseMatches, redBlocks, expiredLine, liveRows } from './flakes.core.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const doc = rows => `# Browsers\n\n## Something else\n| Check | Engine |\n|---|---|\n| \`not/this.check.mjs\` | all |\n\n## Known flakes\n\nProse before the table.\n\n| Check | Engine | Clause | Cause | Added | Until | Recorded |\n|---|---|---|---|---|---|---|\n${rows.join('\n')}\n\nProse after.\n\n## Next section\n| \`nor/this.check.mjs\` | all | * | x | 2026-01-01 | | |\n`;

test('reads only the Known flakes table, with or without backticks, ignoring the extra columns; until defaults to 14 days after added', () => {
  const flakes = parseKnownFlakes(doc([
    '| `packages/a/a.check.mjs` | all | `*` | the drift under load | 2026-09-28 | | LEDGER |',
    '| packages/b/b.check.mjs | chromium | /InvalidStateError/ | a view transition aborts | 2026-10-07 | 2026-12-01 | |',
  ]));
  assert.deepEqual(flakes, [
    { check: 'packages/a/a.check.mjs', engine: 'all', clause: '*', cause: 'the drift under load', added: '2026-09-28', until: '2026-10-12' },
    { check: 'packages/b/b.check.mjs', engine: 'chromium', clause: '/InvalidStateError/', cause: 'a view transition aborts', added: '2026-10-07', until: '2026-12-01' },
  ]);
});

test('no section, no flakes', () => assert.deepEqual(parseKnownFlakes('# Browsers\n\nnothing here\n'), []));

test('a row it cannot read is an error, never a silent skip', () => {
  const row = (o = {}) => `| \`${o.check ?? 'a.check.mjs'}\` | ${o.engine ?? 'all'} | ${o.clause ?? '*'} | ${o.cause ?? 'x'} | ${o.added ?? '2026-10-07'} | ${o.until ?? ''} | |`;
  assert.throws(() => parseKnownFlakes(doc([row({ engine: 'safari' })])), /engine "safari"/);
  assert.throws(() => parseKnownFlakes(doc([row({ added: 'last week' })])), /added "last week" is not a date/);
  assert.throws(() => parseKnownFlakes(doc([row({ until: 'soon' })])), /until "soon" is not a date/);
  assert.throws(() => parseKnownFlakes(doc([row({ check: 'a.check' })])), /not a check path/);
  assert.throws(() => parseKnownFlakes(doc([row({ cause: '' })])), /cause is empty/);
  assert.throws(() => parseKnownFlakes(doc([row({ clause: '' })])), /clause is empty/);
  assert.throws(() => parseKnownFlakes(doc([row({ clause: '/(unclosed/' })])), /not a regular expression/);
  assert.throws(() => parseKnownFlakes(doc([row({ added: '2026-13-45' })])), /not a date/);
  assert.throws(() => parseKnownFlakes(doc([row()]).replace('| Clause |', '|')), /first row must be the header/);
});

test('dates: 14 days after, across a month end; expired only the day after', () => {
  assert.equal(addDays('2026-10-25', 14), '2026-11-08');
  assert.equal(addDays('2026-12-25', 14), '2027-01-08');
  const f = { until: '2026-10-21' };
  assert.equal(isExpired(f, '2026-10-21'), false, 'the last day still excuses');
  assert.equal(isExpired(f, '2026-10-22'), true);
});

test('clauses: * is the file, /re/ a regex, plain text a case-insensitive substring', () => {
  assert.equal(clauseMatches('*', 'FAIL  anything'), true);
  assert.equal(clauseMatches('/hard brush .* much further/', 'FAIL  playful: a hard brush swings the left strand much further'), true);
  assert.equal(clauseMatches('No Page Errors', 'FAIL  recipe.js alone: no page errors  (TypeError)'), true);
  assert.equal(clauseMatches('no page errors', 'FAIL  the crowns have no pale dotted rim'), false);
});

test('redBlocks: a FAIL line with the indented lines under it; pass lines and prose are not reds', () => {
  const out = 'pass  one\nFAIL  two  (detail)\n        problem a\n        problem b\npass  three\nFAIL  four\n\n1 check(s) failed';
  assert.deepEqual(redBlocks(out), ['FAIL  two  (detail)\n        problem a\n        problem b', 'FAIL  four']);
  assert.deepEqual(redBlocks('all pass'), []);
});

const T = '2026-10-17';
const flakes = [
  { check: 'a.check.mjs', engine: 'all', clause: '*', cause: 'drift', added: '2026-10-10', until: '2026-10-24' },
  { check: 'b.check.mjs', engine: 'chromium', clause: '/aborted/', cause: 'aborts', added: '2026-10-07', until: '2026-10-21' },
  { check: 'old.check.mjs', engine: 'all', clause: '*', cause: 'old', added: '2026-09-01', until: '2026-09-15' },
];

test('knownFlake matches the engine named, or all', () => {
  assert.equal(knownFlake(flakes, 'a.check.mjs', 'webkit', [], { now: T }).cause, 'drift');
  assert.equal(knownFlake(flakes, 'b.check.mjs', 'chromium', ['FAIL  x (aborted)'], { now: T }).cause, 'aborts');
  assert.equal(knownFlake(flakes, 'b.check.mjs', 'firefox', ['FAIL  x (aborted)'], { now: T }), null);
  assert.equal(knownFlake(flakes, 'c.check.mjs', 'chromium', [], { now: T }), null);
});

test('an expired row stops excusing, and the verdict lists it', () => {
  const r = [{ check: 'old.check.mjs', ok: false, blocks: ['FAIL  x'] }];
  assert.equal(knownFlake(flakes, 'old.check.mjs', 'chromium', ['FAIL  x'], { now: T }), null);
  const v = verdict(r, flakes, 'chromium', { now: T });
  assert.deepEqual(v.newReds, ['old.check.mjs']);
  assert.equal(v.exitCode, 1);
  assert.deepEqual(v.expired.map(f => f.check), ['old.check.mjs']);
  assert.equal(expiredLine(v.expired[0]), 'expired flake row: old.check.mjs (all) "*" (added 2026-09-01, expired 2026-09-15)');
  // the same red, on the last day it was still live
  assert.equal(verdict(r, flakes, 'chromium', { now: '2026-09-15' }).exitCode, 0);
});

test('an expired row is listed even when its check passed (so the table gets cleaned)', () => {
  const v = verdict([{ check: 'old.check.mjs', ok: true }], flakes, 'chromium', { now: T });
  assert.equal(v.exitCode, 0);
  assert.equal(v.expired.length, 1);
});

test('a red in a quarantined file whose clause does not match is a new red', () => {
  const named = verdict([{ check: 'b.check.mjs', ok: false, blocks: ['FAIL  the view transition aborted'] }], flakes, 'chromium', { now: T });
  assert.deepEqual(named.known, [{ check: 'b.check.mjs', cause: 'aborts' }]);
  assert.equal(named.exitCode, 0);
  const other = verdict([{ check: 'b.check.mjs', ok: false, blocks: ['FAIL  a different clause broke'] }], flakes, 'chromium', { now: T });
  assert.deepEqual(other.newReds, ['b.check.mjs']);
  assert.equal(other.exitCode, 1);
  // one named, one not: the file is red for something the row does not excuse
  const both = verdict([{ check: 'b.check.mjs', ok: false, blocks: ['FAIL  aborted', 'FAIL  something else'] }], flakes, 'chromium', { now: T });
  assert.deepEqual(both.newReds, ['b.check.mjs']);
});

test('a red with no printed FAIL line (a crash) is excused only by a file-wide row', () => {
  assert.deepEqual(verdict([{ check: 'b.check.mjs', ok: false, blocks: [] }], flakes, 'chromium', { now: T }).newReds, ['b.check.mjs']);
  assert.deepEqual(verdict([{ check: 'a.check.mjs', ok: false }], flakes, 'chromium', { now: T }).newReds, []);
});

test('rows are per engine: each failing line needs a live row for the engine in hand', () => {
  const rows = [
    { check: 'e.check.mjs', engine: 'firefox', clause: 'one', cause: 'c1', added: '2026-10-10', until: '2026-10-24' },
    { check: 'e.check.mjs', engine: 'webkit', clause: 'two', cause: 'c2', added: '2026-10-10', until: '2026-10-24' },
  ];
  assert.deepEqual(liveRows(rows, 'e.check.mjs', 'webkit', { now: T }).map(r => r.cause), ['c2']);
  assert.equal(verdict([{ check: 'e.check.mjs', ok: false, blocks: ['FAIL  one'] }], rows, 'firefox', { now: T }).exitCode, 0);
  assert.equal(verdict([{ check: 'e.check.mjs', ok: false, blocks: ['FAIL  two'] }], rows, 'firefox', { now: T }).exitCode, 1);
});

test('a listed check that passes is neither known nor new', () => {
  assert.deepEqual(verdict([{ check: 'b.check.mjs', ok: true }], flakes, 'chromium', { now: T }).known, []);
});

test('docs/BROWSERS.md: the table parses, every check exists, and the real reds are not in it', () => {
  const real = parseKnownFlakes(fs.readFileSync(path.join(root, 'docs', 'BROWSERS.md'), 'utf8'));
  assert.ok(real.length >= 5, `${real.length} rows`);
  for (const f of real) {
    assert.ok(fs.existsSync(path.join(root, f.check)), f.check);
    assert.ok(f.until > f.added, `${f.check}: until ${f.until} is not after added ${f.added}`);
  }
  assert.ok(!real.some(f => f.check.endsWith('veranda/words.check.mjs')), 'veranda/words is a real red from the M1 merge, not a flake');
});

test('a flake row excuses the line it names, not the whole block (Rasika: a real focus-ring regression beside the Firefox press flake)', () => {
  const rows = [{ check: 'tools/touch.check.mjs', engine: 'firefox', clause: '/changes nothing in .* within a frame/', cause: 'press flake', added: '2026-10-10', until: '2026-10-24' }];
  const block = 'FAIL  sg-card\n    sg-card: pressing it changes nothing in sg-card within a frame (no computed style moves)\n    sg-card: the focus ring is missing in the quiet register';
  assert.equal(knownFlake(rows, 'tools/touch.check.mjs', 'firefox', [block], { now: T }), null);
  const only = 'FAIL  sg-card\n    sg-card: pressing it changes nothing in sg-card within a frame (no computed style moves)';
  assert.equal(knownFlake(rows, 'tools/touch.check.mjs', 'firefox', [only], { now: T }).cause, 'press flake');
  assert.equal(verdict([{ check: 'tools/touch.check.mjs', ok: false, blocks: [block] }], rows, 'firefox', { now: T }).exitCode, 1);
  // a * row still excuses every line
  const star = [{ ...rows[0], clause: '*' }];
  assert.equal(knownFlake(star, 'tools/touch.check.mjs', 'firefox', [block], { now: T }).cause, 'press flake');
});
