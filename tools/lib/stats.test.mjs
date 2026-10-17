import test from 'node:test';
import assert from 'node:assert/strict';
import { percentile, frameStats, bytesByFolder, baselineRatio } from './stats.mjs';

test('nearest-rank percentile', () => {
  const v = [5, 1, 4, 2, 3, 6, 7, 8, 9, 10];
  assert.equal(percentile(v, 50), 5);
  assert.equal(percentile(v, 95), 10);
  assert.equal(percentile(v, 0), 1);
  assert.equal(percentile([7], 95), 7);
  assert.ok(Number.isNaN(percentile([], 95)));
});

test('frame stats count whole missed intervals as dropped frames', () => {
  const vs = 1000 / 60;
  const st = frameStats([vs, vs, 24, 2 * vs, 3 * vs + 1]);
  assert.equal(st.count, 5);
  assert.equal(st.dropped, 0 + 0 + 0 + 1 + 2);
  assert.equal(st.worst, 3 * vs + 1);
  assert.ok(Math.abs(st.mean - (4 * vs + 24 + 3 * vs + 1) / 5) < 1e-9);
  assert.equal(frameStats([]).count, 0);
});

test('bytes group by piece folder', () => {
  const g = bytesByFolder([
    { path: '/packages/engine/src/rng.js', bytes: 100 },
    { path: '/packages/engine/index.js', bytes: 10 },
    { path: '/packages/scenes/kolam/model.js', bytes: 300 },
    { path: '/packages/scenes/kolam/render.js', bytes: 200 },
    { path: '/packages/core/index.js', bytes: 50 },
    { path: '/tools/fixtures/fixture-scene/index.js', bytes: 7 },
    { path: '/app.js', bytes: 1 },
  ]);
  const by = Object.fromEntries(g.map(x => [x.folder, x]));
  assert.equal(by['packages/scenes/kolam'].bytes, 500);
  assert.equal(by['packages/scenes/kolam'].files, 2);
  assert.equal(by['packages/engine'].bytes, 110);
  assert.equal(by['packages/core'].bytes, 50);
  assert.equal(by['tools/fixtures'].bytes, 7);
  assert.equal(by['(root)'].bytes, 1);
  assert.equal(g[0].folder, 'packages/scenes/kolam');
});

test('baseline ratio and the 10% slack', () => {
  assert.deepEqual(baselineRatio(11, 10), { ratio: 1.1, within: true });
  assert.equal(baselineRatio(11.2, 10).within, false);
  assert.equal(baselineRatio(5, 10).within, true);
  assert.equal(baselineRatio(5, 0).within, false);
});

// ---- the verdict rule and the load gate (rung 2d) ----

test('verdict: a clear over, a clear within, and a straddle that is inconclusive', async () => {
  const { perfVerdict } = await import('./stats.mjs');
  assert.equal(perfVerdict([1.40, 1.35, 1.45, 1.38]).verdict, 'over');
  assert.equal(perfVerdict([1.01, 0.98, 1.03, 1.00]).verdict, 'within');
  const straddle = perfVerdict([0.95, 1.30, 1.02, 1.25]);
  assert.equal(straddle.verdict, 'inconclusive');
  assert.ok(straddle.lo < 1.1 && straddle.hi > 1.1, `interval ${straddle.lo}..${straddle.hi} should straddle 1.10`);
});

test('verdict: a mean under budget with a wide interval is not "within"; one round never decides', async () => {
  const { perfVerdict } = await import('./stats.mjs');
  const wide = perfVerdict([0.8, 1.35, 0.9, 1.3]); // mean 1.09, under 1.10
  assert.ok(wide.mean < 1.1);
  assert.equal(wide.verdict, 'inconclusive');
  assert.equal(perfVerdict([1.0]).verdict, 'inconclusive');
  assert.equal(perfVerdict([]).verdict, 'inconclusive');
});

test('bootstrap interval: deterministic, brackets the mean, and keeps to the rounds seen', async () => {
  const { bootstrapRatio } = await import('./stats.mjs');
  const r = [1.0, 1.1, 1.2, 1.3];
  const a = bootstrapRatio(r), b = bootstrapRatio(r);
  assert.deepEqual(a, b);
  assert.ok(a.lo <= a.mean && a.mean <= a.hi);
  assert.ok(a.lo >= 1.0 && a.hi <= 1.3);
  const same = bootstrapRatio([1.2, 1.2, 1.2, 1.2]);
  assert.equal(same.lo, same.hi);
});

test('load gate: quiet measures; busy refuses; --force measures and says it was under load', async () => {
  const { loadGate } = await import('./stats.mjs');
  const quiet = await loadGate({ sample: async () => 8 });
  assert.deepEqual([quiet.measure, quiet.underLoad, quiet.message], [true, false, null]);
  const busy = await loadGate({ sample: async () => 55 });
  assert.equal(busy.measure, false);
  assert.match(busy.message, /^not measured: the machine is 55% busy/);
  const forced = await loadGate({ sample: async () => 55, force: true });
  assert.equal(forced.measure, true);
  assert.equal(forced.underLoad, true);
  assert.match(forced.message, /under load/);
  assert.equal((await loadGate({ sample: async () => 30 })).measure, true, 'the limit itself is allowed');
});

// ---- Rasika r-trust 2: the vsync cap and the load during the run ----

const VS = 1000 / 60;
const cappedFrames = (n = 200, jitter = 0.3) => Array.from({ length: n }, (_, i) => VS + (i % 2 ? jitter : -jitter));

test('capped: both sides at the display interval with little variance is "capped", never "within" (the 1.00 to 1.00 interval)', async () => {
  const { perfVerdict, vsyncCapped } = await import('./stats.mjs');
  const rounds = [1, 1, 1, 1];
  assert.equal(perfVerdict(rounds).verdict, 'within', 'the bare rule alone cannot tell; that is the blindness');
  const capped = vsyncCapped(cappedFrames(), cappedFrames(200, 0.5));
  assert.equal(capped, true);
  const v = perfVerdict(rounds, 0.10, { capped });
  assert.equal(v.verdict, 'capped');
  assert.match(v.note, /both at vsync, no headroom measured/);
});

test('capped: only when both sides sit at the cap; a slow piece, a fast baseline, or a noisy one is measured as before', async () => {
  const { vsyncCapped, perfVerdict } = await import('./stats.mjs');
  const slow = Array.from({ length: 200 }, () => 24); // a piece that drops frames
  assert.equal(vsyncCapped(slow, cappedFrames()), false);
  assert.equal(vsyncCapped(cappedFrames(), slow), false);
  const noisy = Array.from({ length: 200 }, (_, i) => (i % 2 ? 8 : 25)); // mean 16.5 but jumping about
  assert.equal(vsyncCapped(noisy, cappedFrames()), false);
  const fast = Array.from({ length: 200 }, () => 4); // uncapped: frame time is a cost
  assert.equal(vsyncCapped(fast, fast), false);
  assert.equal(vsyncCapped([], []), false);
  assert.equal(perfVerdict([1.4, 1.35, 1.45, 1.38], 0.10, { capped: false }).verdict, 'over');
});

test('run load: the during-run figure stamps "under load" and never refuses (the 50% margin was a guess; no quiet-machine calibration exists yet)', async () => {
  const { runLoad } = await import('./stats.mjs');
  assert.deepEqual(runLoad({ during: 12 }), { stamp: false });
  assert.equal(runLoad({ during: 40 }).stamp, true);
  const hot = runLoad({ during: 52 });
  assert.equal(hot.stamp, true, "Rasika's run: 52% busy during, sample before read quiet");
  assert.equal(hot.refuse, undefined, 'a run is stamped, not refused, whatever its busy figure');
  assert.equal(hot.message, undefined);
  assert.equal(runLoad({ during: 91 }).refuse, undefined);
  assert.equal(runLoad({ during: 30 }).stamp, false, 'the limit itself is allowed');
});
