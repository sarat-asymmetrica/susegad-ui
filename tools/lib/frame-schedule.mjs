// Sampling schedules for frame checks (rung M2 of docs/GOAL-MATH-PASS.md).
//
// A frame check that samples ONE frame can miss a defect that is only visible
// in some frames. Model the animation phase as uniform over the period: a
// defect with duty cycle p (the fraction of frames where it shows) is missed
// by n independent samples with probability (1 − p)^n. To miss with
// probability at most δ, take
//
//     n ≥ ceil( log(δ) / log(1 − p) ).
//
// samplePhases turns that n into a deterministic stratified schedule over the
// animation period: the period is cut into n equal strata and one sample is
// placed in each, at an offset derived from a seeded PRNG (mulberry32). Same
// seed, period and n ⇒ the same phases, so a schedule is reproducible and a
// red check can be re-run frame for frame.
//
// validateDeclaration is the harness's guard: a check that declares a duty
// cycle p and miss probability δ but samples fewer than requiredSamples(p, δ)
// is under-declared — it refuses (throws), it does not silently pass.
//
// Pure: no dependencies, no I/O, no clock. Tests: frame-schedule.test.mjs.

/** A tiny deterministic PRNG (mulberry32) from a string or number seed. */
export function rng32(seed) {
  let h = typeof seed === 'number' ? seed >>> 0 : 2166136261;
  if (typeof seed === 'string') {
    for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  }
  return () => {
    h = (h + 0x6D2B79F5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The smallest sample count n with P(a duty-cycle-p defect is missed) ≤ δ.
 * @param {number} p duty cycle in (0, 1]: the fraction of frames where the defect is visible
 * @param {number} δ miss probability, 0 < δ < 1
 * @returns {number} n ≥ 1; Infinity when δ ≤ 0 (only a full census will do)
 */
export function requiredSamples(p, delta) {
  if (!(p > 0) || p > 1 || Number.isNaN(p)) throw new RangeError(`duty cycle p must be in (0, 1], got ${p}`);
  if (!(delta < 1) || Number.isNaN(delta)) throw new RangeError(`miss probability δ must be < 1, got ${delta}`);
  if (delta < 0) throw new RangeError(`miss probability δ must be ≥ 0, got ${delta}`);
  if (delta <= 0) return Infinity; // δ = 0: the defect must never be missed; sample everything
  if (p === 1) return 1; // always visible: one frame catches it (log(1) = 0 would say 0)
  return Math.ceil(Math.log(delta) / Math.log(1 - p));
}

/**
 * A deterministic stratified schedule of n phases over one animation period.
 * Stratum i gets one phase at (i + off(i)) · period / n, where off(i) comes
 * from a seeded PRNG so the same seed, period and n always give the same
 * phases, and any single stratum's sub-window is reachable.
 * @param {number} n sample count (≥ 1)
 * @param {number} period animation period (seconds, frames — any unit), > 0
 * @param {{ seed?: string | number }} opts
 * @returns {number[]} n phases in [0, period), in stratum order (ascending)
 */
export function samplePhases(n, period, { seed = 'frame-schedule' } = {}) {
  if (!(n >= 1) || !Number.isInteger(n)) throw new RangeError(`n must be a positive integer, got ${n}`);
  if (!(period > 0) || Number.isNaN(period)) throw new RangeError(`period must be > 0, got ${period}`);
  const r = rng32(seed);
  const phases = [];
  for (let i = 0; i < n; i++) {
    const step = period / n;
    phases.push(((i + r()) * step) % period);
  }
  return phases;
}

/**
 * Does a check's actual sample count meet its own declaration?
 * @param {{ p: number, delta: number, n: number, label?: string }} d
 * @returns {{ ok: boolean, required: number, message: string }}
 */
export function validateDeclaration({ p, delta, n, label = '' }) {
  const required = requiredSamples(p, delta);
  const ok = n >= required;
  const what = label ? `${label}: ` : '';
  const message = ok
    ? `${what}${n} samples meet the declaration p=${p}, δ=${delta} (needs ${required})`
    : `${what}under-declared: ${n} samples cannot meet p=${p}, δ=${delta} (needs ${required}); P(miss) = ${(1 - p) ** n} > δ`;
  return { ok, required, message };
}

/** validateDeclaration that throws instead of returning a verdict. */
export function assertDeclaration(d) {
  const v = validateDeclaration(d);
  if (!v.ok) throw new RangeError(v.message);
  return v;
}
