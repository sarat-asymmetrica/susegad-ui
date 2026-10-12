import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseShard, durationOf, shardChecks, durationsFromLog, DEFAULT_SECONDS } from './shard.core.js';

test('parseShard reads i/n, 1-based, and refuses the rest', () => {
  assert.deepEqual(parseShard('2/4'), { index: 2, count: 4 });
  assert.deepEqual(parseShard('1/1'), { index: 1, count: 1 });
  for (const bad of ['0/4', '5/4', '1/0', '2', '2/4/1', 'a/b', '', undefined]) assert.throws(() => parseShard(bad), /shard/, String(bad));
});

test('durationOf: a number for every engine, a per-engine entry, the slowest engine it has, else 30 s', () => {
  const table = { $source: 'note', a: 12, b: { chromium: 5, webkit: 9 }, c: {} };
  assert.equal(durationOf(table, 'a', 'firefox'), 12);
  assert.equal(durationOf(table, 'b', 'chromium'), 5);
  assert.equal(durationOf(table, 'b', 'firefox'), 9);
  assert.equal(durationOf(table, 'c', 'chromium'), DEFAULT_SECONDS);
  assert.equal(durationOf(table, 'missing', 'chromium'), 30);
  assert.equal(durationOf(table, '$source', 'chromium'), 30);
});

const secs = { a: 10, b: 9, c: 8, d: 7, e: 1, f: 1 };
const run = (checks, count) => shardChecks(checks, { count, seconds: c => secs[c] ?? 30 });

test('greedy longest first into the lightest shard', () => {
  // 10 -> s1; 9 -> s2; 8 -> s2 (9 < 10); 7 -> s1 (17 < 17? no: s1 10 < s2 17); 1 -> s1 (17 = 17, lower wins); 1 -> s2
  assert.deepEqual(run(Object.keys(secs), 2), [
    { checks: ['a', 'd', 'e'], total: 18 },
    { checks: ['b', 'c', 'f'], total: 18 },
  ]);
});

test('ties are broken by path, so the split never depends on the input order', () => {
  const a = shardChecks(['z', 'y', 'x', 'w'], { count: 2, seconds: () => 5 });
  const b = shardChecks(['w', 'x', 'y', 'z'], { count: 2, seconds: () => 5 });
  assert.deepEqual(a, b);
  assert.deepEqual(a.map(s => s.checks), [['w', 'y'], ['x', 'z']]);
});

test('every check lands in exactly one shard, for every n', () => {
  const checks = Array.from({ length: 41 }, (_, i) => `c${i}`);
  const seconds = c => (Number(c.slice(1)) * 7919) % 97 + 1;
  for (const n of [1, 2, 3, 4, 7, 50]) {
    const shards = shardChecks(checks, { count: n, seconds });
    assert.equal(shards.length, n);
    const all = shards.flatMap(s => s.checks).sort();
    assert.deepEqual(all, [...checks].sort(), `n=${n}`);
    if (n <= 4) { // balanced: no shard more than the slowest check above the lightest
      const totals = shards.map(s => s.total);
      assert.ok(Math.max(...totals) - Math.min(...totals) <= 97, `n=${n}: ${totals}`);
    }
  }
});

test('more shards than checks leaves the extra shards empty, never fails', () => {
  assert.deepEqual(run(['a'], 3).map(s => s.checks), [['a'], [], []]);
});

const LOG = [
  'check (chromium)\tUNKNOWN STEP\t2026-10-06T03:55:08.0000000Z ##[group]Run npx playwright install',
  'check (chromium)\tUNKNOWN STEP\t2026-10-06T03:55:20.0000000Z pass  tools/text-gate.mjs  all 5 checks pass (node only, 12.3 s)',
  'check (chromium)\tUNKNOWN STEP\t2026-10-06T03:55:29.0000000Z Running 3 checks in chromium.',
  'check (chromium)\tUNKNOWN STEP\t2026-10-06T03:55:49.0000000Z pass  packages/a/a.check.mjs  all 42 checks pass',
  'check (chromium)\tUNKNOWN STEP\t2026-10-06T03:55:49.5000000Z   detail line that is not a result',
  'check (chromium)\tUNKNOWN STEP\t2026-10-06T03:55:54.5000000Z FAIL  packages/b/b.check.mjs  1 check(s) failed',
  'check (chromium)\tUNKNOWN STEP\t2026-10-06T03:56:04.5000000Z FAIL (known: the view transition aborts (InvalidStateError))  packages/c/c.check.mjs  1 check(s) failed',
  'check (webkit)\tUNKNOWN STEP\t2026-10-06T03:55:30.0000000Z Running 3 checks in webkit.',
  'check (webkit)\tUNKNOWN STEP\t2026-10-06T03:55:40.0000000Z pass  packages/a/a.check.mjs  all 42 checks pass',
  'check (webkit)\tUNKNOWN STEP\t2026-10-06T03:55:40.3000000Z FAIL  packages/b/b.check.mjs  Node.js v22.23.3',
  'check (webkit)\tUNKNOWN STEP\t2026-10-06T03:55:47.3000000Z pass  packages/c/c.check.mjs  all 3 checks pass',
  'test\tUNKNOWN STEP\t2026-10-06T03:59:00.0000000Z pass  packages/x/x.check.mjs  nonsense from another job',
].join('\n');

test('durationsFromLog: the gap to the previous result per engine; Node-only checks carry their own time', () => {
  assert.deepEqual(durationsFromLog(LOG), {
    'tools/text-gate.mjs': { chromium: 12.3 },
    'packages/a/a.check.mjs': { chromium: 20, webkit: 10 },
    'packages/b/b.check.mjs': { chromium: 5.5 }, // the WebKit crash (last line "Node.js v…") is left out
    'packages/c/c.check.mjs': { chromium: 10, webkit: 7 }, // a known flake's red still counts; the gap runs from the crash
  });
});

test('the committed table is well formed: every value a positive number of seconds', () => {
  const table = JSON.parse(fs.readFileSync(new URL('./check-durations.json', import.meta.url), 'utf8'));
  assert.match(table.$source, /CI run \d+/);
  const entries = Object.entries(table).filter(([k]) => !k.startsWith('$'));
  assert.ok(entries.length >= 80, `${entries.length} checks`);
  for (const [k, v] of entries) {
    assert.match(k, /\.m?js$/, k);
    for (const [engine, s] of Object.entries(v)) {
      assert.ok(['chromium', 'webkit', 'firefox'].includes(engine), `${k}: ${engine}`);
      assert.ok(Number.isFinite(s) && s > 0, `${k} ${engine}: ${s}`);
    }
  }
});
