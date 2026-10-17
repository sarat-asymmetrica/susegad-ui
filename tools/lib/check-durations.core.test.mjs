import test from 'node:test';
import assert from 'node:assert/strict';
import { durationsFromShardedLog } from './check-durations.core.js';
import { durationsFromLog } from './shard.core.js';

const line = (job, iso, msg) => `${job}\tUNKNOWN STEP\t2026-10-12T${iso}Z ${msg}`;
const A = 'check (chromium 1/4)', B = 'check (chromium 2/4)', W = 'check (webkit 1/4)';

// Two chromium shards and a webkit shard running side by side: their lines interleave in time.
const LOG = [
  `test\tSet up job\t﻿2026-10-12T19:39:00.0Z Current runner version`, // the BOM GitHub puts on a log's first line
  line(A, '19:39:00.0', 'Running 2 checks in chromium.'),
  line(B, '19:39:01.0', 'Running 1 check in chromium.'),
  line(W, '19:39:02.0', 'Running 1 check in webkit.'),
  line(B, '19:39:11.0', 'pass  packages/b/b.check.mjs  all pass'),
  line(A, '19:39:20.0', 'pass  packages/a/a.check.mjs  all pass'),
  line(W, '19:39:22.0', 'pass  packages/a/a.check.mjs  all pass'),
  line(A, '19:39:50.0', 'pass  packages/c/c.check.mjs  all pass'),
  'test\tnpm test\t2026-10-12T19:40:00.0Z pass  packages/ignored/x.check.mjs  not a check job',
].join('\n');

test('durationsFromShardedLog: each job is timed on its own, merged across the shards of an engine', () => {
  assert.deepEqual(durationsFromShardedLog(LOG), {
    'packages/b/b.check.mjs': { chromium: 10 },
    'packages/a/a.check.mjs': { chromium: 20, webkit: 20 },
    'packages/c/c.check.mjs': { chromium: 30 },
  });
});

test('durationsFromShardedLog: a control that can fail, reading the interleaved log as one stream gets other numbers', () => {
  // durationsFromLog keeps one clock per engine, and the "(chromium 1/4)" job names are not engines
  // to it at all; flattened to "(chromium)", the two shards would share a clock.
  const flat = LOG.replaceAll(' 1/4)', ')').replaceAll(' 2/4)', ')');
  assert.notDeepEqual(durationsFromLog(flat)['packages/a/a.check.mjs'], { chromium: 20, webkit: 20 });
  assert.deepEqual(durationsFromLog(LOG), {}, 'the sharded job names are not read by the unsplit parser');
});

test('durationsFromShardedLog: a log with no check jobs gives an empty table (the CLI refuses to write it)', () => {
  assert.deepEqual(durationsFromShardedLog('test\tstep\t2026-10-12T19:39:00.0Z hello\n'), {});
  assert.deepEqual(durationsFromShardedLog(''), {});
});
