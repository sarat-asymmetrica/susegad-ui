import test from 'node:test';
import assert from 'node:assert/strict';
import { requiredSamples, samplePhases, validateDeclaration, assertDeclaration, rng32 } from './frame-schedule.mjs';

test('requiredSamples: the textbook numbers', () => {
  // p = 35/60 ≈ 0.5833: one sample misses it 41.7% of the time — the tinto bug
  assert.equal(requiredSamples(35 / 60, 0.1), 3); // 0.4167³ = 0.072 ≤ 0.1; two samples miss 17% of the time
  // p = 0.5, δ = 0.1 → (0.5)^n ≤ 0.1 → n = 4
  assert.equal(requiredSamples(0.5, 0.1), 4);
  // p = 0.1, δ = 0.01 → n = 44
  assert.equal(requiredSamples(0.1, 0.01), 44);
  // p = 1: always visible, one frame catches it (log(1) = 0 would say 0)
  assert.equal(requiredSamples(1, 0.1), 1);
  assert.equal(requiredSamples(1, 0.001), 1);
});

test('requiredSamples: δ limits and monotonicity', () => {
  // δ → 1 needs 1 sample; δ → 0 needs everything
  assert.equal(requiredSamples(0.5, 0.9), 1);
  assert.equal(requiredSamples(0.5, 0), Infinity);
  // monotone: smaller δ or smaller p never needs fewer samples
  for (const p of [0.05, 0.2, 0.5, 0.9]) {
    let prev = 0;
    for (const d of [0.5, 0.2, 0.1, 0.05, 0.01, 0.001]) {
      const n = requiredSamples(p, d);
      assert.ok(n >= prev && Number.isInteger(n), `p=${p} δ=${d} n=${n}`);
      // and the count must actually meet the guarantee
      assert.ok((1 - p) ** n <= d + 1e-12);
      assert.ok((1 - p) ** (n - 1) > d, 'n is minimal');
      prev = n;
    }
  }
});

test('requiredSamples: rounding is up, and bad arguments refuse', () => {
  // exact powers land on the integer; inexact round up
  assert.equal(requiredSamples(0.5, 0.125), 3);
  assert.equal(requiredSamples(0.5, 0.124), 4);
  assert.throws(() => requiredSamples(0, 0.1), RangeError);
  assert.throws(() => requiredSamples(-0.2, 0.1), RangeError);
  assert.throws(() => requiredSamples(1.5, 0.1), RangeError);
  assert.throws(() => requiredSamples(NaN, 0.1), RangeError);
  assert.throws(() => requiredSamples(0.5, 1), RangeError);
  assert.throws(() => requiredSamples(0.5, 2), RangeError);
  assert.throws(() => requiredSamples(0.5, -0.1), RangeError); // δ must be in [0, 1); use the census (0) explicitly
});

test('rng32 and samplePhases are deterministic: same seed → same phases', () => {
  assert.deepEqual(samplePhases(4, 60, { seed: 'tinto' }), samplePhases(4, 60, { seed: 'tinto' }));
  assert.deepEqual(rng32('x')(), rng32('x')());
  assert.notDeepEqual(samplePhases(4, 60, { seed: 'a' }), samplePhases(4, 60, { seed: 'b' }));
  assert.notDeepEqual(samplePhases(4, 60, { seed: 'x' }), samplePhases(4, 60, { seed: 42 }));
});

test('samplePhases: stratified — one phase per equal stratum, all inside [0, period)', () => {
  const phases = samplePhases(6, 60, { seed: 's' });
  assert.equal(phases.length, 6);
  for (const [i, ph] of phases.entries()) {
    assert.ok(ph >= i * 10 && ph < (i + 1) * 10, `stratum ${i}: ${ph}`); // 60/6 = 10 per stratum
    assert.ok(ph >= 0 && ph < 60);
  }
  // ascending, no duplicates: the strata cannot collide
  for (let i = 1; i < phases.length; i++) assert.ok(phases[i] > phases[i - 1]);
  // uneven periods keep every phase inside
  for (const ph of samplePhases(7, 90, { seed: 'u' })) assert.ok(ph >= 0 && ph < 90);
});

test('samplePhases: covers strata for the tinto duty cycle (35/60, δ = 0.1 → 3 samples)', () => {
  const phases = samplePhases(requiredSamples(35 / 60, 0.1), 60, { seed: 'tinto' });
  assert.equal(phases.length, 3);
  assert.ok(phases.some(ph => ph > 0));
});

test('samplePhases: bad arguments refuse', () => {
  assert.throws(() => samplePhases(0, 60), RangeError);
  assert.throws(() => samplePhases(2.5, 60), RangeError);
  assert.throws(() => samplePhases(4, 0), RangeError);
  assert.throws(() => samplePhases(4, -1), RangeError);
  assert.throws(() => samplePhases(4, NaN), RangeError);
});

test('validateDeclaration: met, under-declared, and the assert form throws', () => {
  const met = validateDeclaration({ p: 35 / 60, delta: 0.1, n: 4, label: 'tinto words' });
  assert.equal(met.ok, true);
  assert.match(met.message, /4 samples meet/);
  const short = validateDeclaration({ p: 35 / 60, delta: 0.1, n: 1, label: 'tinto words' });
  assert.equal(short.ok, false);
  assert.equal(short.required, 3);
  assert.match(short.message, /under-declared/);
  assert.match(short.message, /P\(miss\) = 0.41\d+/); // (1 − 35/60)^1 ≈ 0.4167, spelled out
  assert.throws(() => assertDeclaration({ p: 35 / 60, delta: 0.1, n: 2 }), RangeError);
  assert.doesNotThrow(() => assertDeclaration({ p: 35 / 60, delta: 0.1, n: 4 }));
});
