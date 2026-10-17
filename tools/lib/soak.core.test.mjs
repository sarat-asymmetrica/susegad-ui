// The soak verdict maths on synthetic samples: a steady run passes, and each kind of drift fails on its own budget.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, growth, theilSen, median, formatReport, BUDGETS, MODES } from './soak.core.js';

/** 40 samples, 5 s apart; override any series with a function of the index. */
const run = (over = {}, n = 40) => Array.from({ length: n }, (_, i) => ({
  t: (i + 1) * 5, heapMB: 12, nodes: 800, docs: 1, listeners: 120, canvasMpx: 2,
  frames: { count: 300, mean: 16.7, p95: 17 }, longTasks: 0, cpuBusy: 20,
  ...Object.fromEntries(Object.entries(over).map(([k, fn]) => [k, fn(i)])),
}));
const noise = (i, a) => a * (((i * 7919) % 13) / 13 - 0.5); // deterministic jitter in [-a/2, a/2)

test('a steady run with noise passes', () => {
  const v = evaluate(run({ heapMB: i => 12 + noise(i, 0.4), nodes: i => 800 + (i % 3), p95: i => 17 }), { warmup: 20 });
  assert.equal(v.overall, 'pass', JSON.stringify(v.failed));
  assert.deepEqual(v.failed, []);
});

test('a heap that climbs 0.1 MB a sample fails on heap only', () => {
  const v = evaluate(run({ heapMB: i => 12 + i * 0.1 }), { warmup: 20 });
  assert.equal(v.overall, 'fail');
  assert.deepEqual(v.failed, ['heap']);
  assert.ok(v.heap.slopeMBPerHour > 60, `slope ${v.heap.slopeMBPerHour}`);
});

test('a heap that grows by percentage but less than the floor is noise, not a leak', () => {
  // 0.4 -> 0.8 MB is +100% but 0.4 MB
  const v = evaluate(run({ heapMB: i => (i < 25 ? 0.4 : 0.8) }), { warmup: 20 });
  assert.ok(v.heap.pct > 50 && v.heap.abs < BUDGETS.heap.abs);
  assert.ok(v.heap.ok);
});

test('detached nodes, listeners, documents and canvases each fail their own budget', () => {
  assert.deepEqual(evaluate(run({ nodes: i => 800 + i * 20 }), { warmup: 20 }).failed, ['nodes']);
  assert.deepEqual(evaluate(run({ listeners: i => 120 + i * 10 }), { warmup: 20 }).failed, ['listeners']);
  assert.deepEqual(evaluate(run({ docs: i => 1 + Math.floor(i / 4) }), { warmup: 20 }).failed, ['documents']);
  assert.deepEqual(evaluate(run({ canvasMpx: i => 2 + i * 0.2 }), { warmup: 20 }).failed, ['canvasMpx']);
});

test('frame p95 drift fails, a one-vsync wobble does not, and a busy machine makes it inconclusive', () => {
  const slow = run({ frames: i => ({ count: 300, mean: 16.7, p95: i < 20 ? 17 : 24 }) });
  const v = evaluate(slow, { warmup: 20 });
  assert.deepEqual(v.failed, ['p95']);
  assert.equal(v.p95.status, 'drift');
  const wobble = run({ frames: i => ({ count: 300, mean: 16.7, p95: i < 20 ? 16.7 : 18.4 }) });
  assert.equal(evaluate(wobble, { warmup: 20 }).overall, 'pass'); // +10%, +1.7 ms: under both
  const busy = run({ frames: i => ({ count: 300, mean: 16.7, p95: i < 20 ? 17 : 24 }), cpuBusy: () => 85 });
  const vb = evaluate(busy, { warmup: 20 });
  assert.equal(vb.overall, 'pass');
  assert.match(vb.p95.status, /inconclusive/);
  assert.ok(vb.load.loaded);
});

test('a busy machine does not excuse a leak', () => {
  const v = evaluate(run({ heapMB: i => 12 + i * 0.1, cpuBusy: () => 90 }), { warmup: 20 });
  assert.deepEqual(v.failed, ['heap']);
});

test('any error fails, even before enough samples to judge growth', () => {
  const v = evaluate(run({}, 6), { warmup: 20, errors: ['pageerror: boom'] });
  assert.equal(v.overall, 'fail');
  assert.deepEqual(v.failed, ['errors']);
});

test('too few samples after warm-up is not judged, not passed', () => {
  const v = evaluate(run({ heapMB: i => 12 + i }, 10), { warmup: 20 }); // 6 after warm-up
  assert.equal(v.overall, 'not-judged');
  assert.equal(v.judged, false);
});

test('long tasks that double and then some fail', () => {
  const v = evaluate(run({ longTasks: i => (i < 20 ? 1 : 6) }), { warmup: 20 });
  assert.deepEqual(v.failed, ['longTasks']);
});

test('median, theil-sen and growth', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.ok(Number.isNaN(median([])));
  // one wild point does not tilt the slope
  assert.equal(theilSen([1, 2, 3, 4, 5], [10, 20, 30, 400, 50]), 10);
  const g = growth([10, 10, 10], [11.5, 11.5, 11.5], { pct: 10, abs: 1 });
  assert.equal(g.ok, false);
  assert.equal(growth([0, 0, 0], [0, 0, 0], { pct: 10, abs: 1 }).ok, true);
});

test('the modes and the report', () => {
  assert.deepEqual(Object.keys(MODES), ['quick', 'rung', 'release']);
  assert.equal(MODES.quick.seconds, 120);
  assert.equal(MODES.rung.seconds, 1800);
  assert.equal(MODES.release.seconds, 7200);
  for (const m of Object.values(MODES)) assert.ok(m.warmup < m.seconds / 3 && m.seconds / m.interval - m.warmup / m.interval >= BUDGETS.minSamples);
  const text = formatReport(evaluate(run({ heapMB: i => 12 + i * 0.1 }), { warmup: 20 }), { target: 'x', profile: '1080p', mode: 'quick', seconds: 200, cores: 8 });
  assert.match(text, /Verdict: FAIL \(heap\)/);
  assert.match(text, /FAIL heap/);
  assert.match(text, /CPU busy/);
});
