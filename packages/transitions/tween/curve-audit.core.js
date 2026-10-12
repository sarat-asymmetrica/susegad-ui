// Rung M5: continuity and frequency audit of a baked tween curve, as a signal.
//
//   continuityAudit(cache, o)  position, velocity, acceleration over the curve's domain, by
//                              finite differences; C0 / C1 / C2 violations over declared
//                              tolerances (a jump in the value, in the velocity, and a break
//                              out of the acceleration's own smooth envelope).
//   frequencyAudit(cache, o)   a small DFT over the path's oscillatory residual: the in-band
//                              (3-60 Hz) energy as a share of the whole path's energy, at a
//                              declared duration, flagged above a declared threshold.
//
// Pure: no DOM, no timer, no Promise. Zero dependencies. Both audits read a baked cache
// ({ samples: number[] }) and do arithmetic over it; the tolerances and the threshold are
// declared here, so a curve is judged against numbers written outside itself.
//
// ── The math, and why the tolerances look the way they do ──────────────────
//
// A baked table is progress 0..1 at t = i / n, uniform in t. Derivatives come by central
// differences (one-sided at the ends), so a discontinuity in the k-th derivative shows as a
// jump in the (k-1)-th sampled derivative between neighbouring samples. But a steep smooth
// curve has a large FIRST derivative, and its per-sample step is large too, so each
// tolerance is two-part: an absolute floor OR a share of the curve's own scale. Measured
// over the shipped curves (held in curve-audit.core.test.js):
//
//   C0  a smooth curve steps at most 0.029 between two of its 256 samples (the playful
//       spring's linear() bake); the tolerance sits at 0.06, where the gate's own MAX_STEP
//       already sits. A real C0 break steps a large fraction of the path.
//   C1  the one-sided velocities across an interior sample of a smooth curve agree to
//       within 0.09 of max |v| (the playful spring's linear() bake, the worst); a linear()
//       knot moves the velocity by about 2x max |v|, a step far more. Tolerance: 0.5 of
//       max |v|, floor 0.05.
//   C2  the sampled acceleration of a smooth curve is jagged by the interpolation, so the
//       audit compares it at each point against its own moving average over a declared
//       window: the shipped curves stay within 0.50 of max |a| of that local mean (the warm
//       spring's closed form, whose acceleration oscillates full-swing); a genuine break —
//       a ripple, the spring's linear() bake at its first sample interval — pokes out past
//       0.87. Tolerance: 0.6 of max |a|, floor 0.5. A mild jerk (an acceleration that merely
//       doubles across a join while value and velocity stay smooth) reads 0.42 and is NOT
//       flagged at any tolerance that keeps the shipped curves green: that is a written
//       finding (docs/reports/karigar-m5.md), not a caught defect.
//
// For the frequency audit the raw spectrum of a one-shot gesture is no use: a single smooth
// rise from 0 to 1 carries all of its (mean-removed) energy at 1-4 Hz however calm it is,
// and a short analysis window cannot even resolve 3 Hz (a 140 ms window's first bin sits at
// 7.1 Hz, so a 10 Hz wobble there blurs into the same bins as the gesture itself). What
// photosensitivity prudence cares about is OSCILLATION: the path minus its own slow moving
// average (the gesture), DFT'd. A calm ease's residual is near zero; a wobble's residual is
// the wobble. The report is the residual's energy inside [bandLow, bandHigh] Hz as a share
// of the whole mean-removed path's energy (`oscRatio`, the number the gate flags on), at
// `durationMs` of curve time (the same cycles are more Hz in a shorter motion, so the
// duration is declared, not assumed). A Hann window tames the finite run's leakage; the
// resample count is a power of two. Measured: the shipped curves' residual carries under
// 17% of the path's energy (the token in-out, whose S-curve the gesture-window smears);
// a 10 Hz wobble at 20% of the path, over a window that resolves it, carries 1000x. A
// window too short to resolve the band (fewer than one cycle of bandLow) reports
// `resolvable: false` and the gate skips the flag rather than misread it.

const maxAbs = xs => xs.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

/**
 * Derivatives by finite differences over a uniform table (values at t = i / n).
 * @param {number[]} samples
 * @returns {{ t: number[], p: number[], v: number[], a: number[] }} position (a copy),
 *   velocity and acceleration in progress per unit t and per unit t squared
 */
export function derivatives(samples) {
  const n = samples.length - 1;
  if (n < 2) throw new RangeError('a curve of at least 3 samples is auditable');
  const dt = 1 / n;
  const p = samples.slice();
  const v = new Array(n + 1), a = new Array(n + 1);
  for (let i = 0; i <= n; i++) {
    v[i] = i === 0 ? (p[1] - p[0]) / dt : i === n ? (p[n] - p[n - 1]) / dt : (p[i + 1] - p[i - 1]) / (2 * dt);
  }
  for (let i = 0; i <= n; i++) {
    a[i] = i === 0 ? (v[1] - v[0]) / dt : i === n ? (v[n] - v[n - 1]) / dt : (v[i + 1] - v[i - 1]) / (2 * dt);
  }
  return { t: p.map((_, i) => i / n), p, v, a };
}

/**
 * A jump in the value itself is never meant. A smooth curve of 256 samples steps at most
 * 0.029 (the playful spring's linear() bake); this sits at twice that, where the gate's
 * MAX_STEP already sits.
 */
export const C0_TOLERANCE = 0.06;
/**
 * A jump in the one-sided velocity across an interior sample, as a share of the curve's max
 * |v|. Measured: a smooth curve agrees to within 0.09 (the playful spring's linear() bake);
 * a linear() knot moves the velocity by about 2x max |v|. The absolute floor below keeps a
 * short curve's rounding noise from reading as a kink.
 */
export const C1_SHARE = 0.5;
/** The absolute C1 floor, in velocity: above any shipped curve's rounding-scale wobble. */
export const C1_FLOOR = 0.05;
/**
 * How far the sampled acceleration may sit from its own moving average, as a share of the
 * curve's max |a|. Measured: the shipped curves stay within 0.50 (the warm spring's closed
 * form, whose acceleration oscillates full-swing); the spring's linear() bake pokes to 0.87
 * at its first sample interval (its own written finding), a triangle wave to 0.88.
 */
export const C2_SHARE = 0.6;
/** The absolute C2 floor, in acceleration, for a curve whose acceleration is near zero. */
export const C2_FLOOR = 0.5;
/** The moving-average window for the C2 audit, as a share of the sample count: about 6% of the curve. */
export const C2_WINDOW_SHARE = 1 / 16;

/**
 * The continuity audit: counts of C0 / C1 / C2 violations and the worst of them.
 * @param {{ samples: number[] }} cache a baked tween cache (samples at t = i / n)
 * @param {{ c0?: number, c1Share?: number, c1Floor?: number, c2Share?: number, c2Floor?: number,
 *   windowShare?: number }} [o] declared tolerances (defaults are the exported constants)
 * @returns {{ c0: number, c1: number, c2: number, clean: boolean,
 *   worst: { order: 'C0'|'C1'|'C2', at: number, severity: number } | null,
 *   maxV: number, maxA: number }}
 */
export function continuityAudit(cache, o = {}) {
  const c0Tol = o.c0 ?? C0_TOLERANCE;
  const c1Share = o.c1Share ?? C1_SHARE, c1Floor = o.c1Floor ?? C1_FLOOR;
  const c2Share = o.c2Share ?? C2_SHARE, c2Floor = o.c2Floor ?? C2_FLOOR;
  const s = cache.samples;
  const n = s.length - 1;
  const { t, v, a } = derivatives(s);
  const maxV = maxAbs(v), maxA = maxAbs(a);
  const c1Tol = Math.max(c1Floor, c1Share * maxV);
  const c2Tol = Math.max(c2Floor, c2Share * maxA);
  const w = Math.max(1, Math.round(n * (o.windowShare ?? C2_WINDOW_SHARE)));
  let c0 = 0, c1 = 0, c2 = 0, worst = null;
  const note = (order, i, severity) => { if (!worst || severity > worst.severity) worst = { order, at: t[i], severity }; };
  for (let i = 1; i <= n; i++) {
    const dp = Math.abs(s[i] - s[i - 1]);
    if (dp > c0Tol) { c0++; note('C0', i, dp); }
  }
  for (let i = 2; i <= n - 2; i++) {
    const vL = (s[i] - s[i - 1]) * n, vR = (s[i + 1] - s[i]) * n;
    const dv = Math.abs(vR - vL);
    if (dv > c1Tol) { c1++; note('C1', i, dv / (maxV || 1)); }
  }
  for (let i = 0; i <= n; i++) {
    let sum = 0, cnt = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n, i + w); j++) { sum += a[j]; cnt++; }
    const dev = Math.abs(a[i] - sum / cnt);
    if (dev > c2Tol) { c2++; note('C2', i, dev / (maxA || 1)); }
  }
  return { c0, c1, c2, clean: !(c0 || c1 || c2), worst, maxV, maxA };
}

/** The band the frequency audit watches: the photosensitivity prudence band. */
export const BAND_LOW_HZ = 3, BAND_HIGH_HZ = 60;
/**
 * The in-band residual energy, as a share of the whole mean-removed path's energy, over
 * which the audit flags (not fails). Measured: the shipped curves' residual carries under
 * 0.17 of the path's energy; a 10 Hz wobble at 20% of the path, over a window that resolves
 * it, carries over 1000.
 */
export const OSC_RATIO_THRESHOLD = 0.3;
/** The resample count for the DFT: a power of two. */
export const DFT_POINTS = 2048;
/** The moving-average window that separates the gesture from its wobble: 1/16 of the path. */
export const RESIDUAL_WINDOW_SHARE = 1 / 16;

/**
 * The frequency audit. The path is resampled to `points` uniform values, its slow moving
 * average (the gesture) is subtracted, and the residual is Hann-windowed and DFT'd. The
 * report: the residual's energy inside [bandLow, bandHigh] Hz as a share of the whole
 * mean-removed path's energy (`oscRatio`), the wobble's own shape (`bandShare` of the
 * residual's energy), and where the band peak sits, at `durationMs` of curve time.
 * `resolvable` says whether the analysis window can resolve the band at all: fewer than one
 * cycle of `bandLow` in the window, and the flag is not a reading.
 * @param {{ samples: number[] }} cache
 * @param {{ durationMs: number, points?: number, bandLow?: number, bandHigh?: number }} o
 * @returns {{ oscRatio: number, bandShare: number, bandPeakHz: number, resolvable: boolean,
 *   cyclesInBand: number, cyclesInWindow: number, rateHz: number }}
 */
export function frequencyAudit(cache, { durationMs, points = DFT_POINTS, bandLow = BAND_LOW_HZ, bandHigh = BAND_HIGH_HZ } = {}) {
  if (!(durationMs > 0)) throw new RangeError('durationMs is a positive number of milliseconds');
  if (points < 16 || (points & (points - 1)) !== 0) throw new RangeError('points is a power of two, 16 or more');
  const s = cache.samples, n = s.length - 1;
  const xs = Array.from({ length: points }, (_, i) => {
    const x = (i / (points - 1)) * n, j = Math.min(n - 1, Math.floor(x)), f = x - j;
    return s[j] + (s[j + 1] - s[j]) * f;
  });
  const rateHz = (points - 1) / (durationMs / 1000); // samples per second the path is read at
  const binHz = rateHz / points;
  // the oscillatory residual: the path minus its own slow moving average (the gesture)
  const w = Math.max(1, Math.round(points * RESIDUAL_WINDOW_SHARE));
  const residual = new Float64Array(points);
  for (let i = 0; i < points; i++) {
    const lo = Math.max(0, i - w), hi = Math.min(points - 1, i + w);
    let sum = 0;
    for (let j = lo; j <= hi; j++) sum += xs[j];
    residual[i] = xs[i] - sum / (hi - lo + 1);
  }
  // the denominator: the energy of the mean-removed path (in time domain)
  const mean = xs.reduce((sum, x) => sum + x, 0) / points;
  let pathEnergy = 0;
  for (let i = 0; i < points; i++) { const d = xs[i] - mean; pathEnergy += d * d; }
  // the residual's spectrum: Hann window, DFT over half the bands
  const half = points / 2;
  const re = new Float64Array(half + 1), im = new Float64Array(half + 1);
  for (let k = 0; k <= half; k++) {
    let sr = 0, si = 0;
    for (let i = 0; i < points; i++) {
      const win = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (points - 1)));
      const ang = (-2 * Math.PI * k * i) / points;
      sr += residual[i] * win * Math.cos(ang);
      si += residual[i] * win * Math.sin(ang);
    }
    re[k] = sr; im[k] = si;
  }
  const energy = k => re[k] * re[k] + im[k] * im[k];
  const es = [];
  let residualEnergy = 0;
  for (let k = 0; k <= half; k++) {
    const e = energy(k) * (k === 0 || k === half ? 1 : 2); // one-sided: double the interior bands
    es.push(e);
    residualEnergy += e;
  }
  let band = 0, bandPeakK = -1, cycles = 0;
  for (let k = 1; k <= half; k++) {
    const hz = k * binHz;
    if (hz >= bandLow && hz <= bandHigh) {
      band += es[k]; cycles++;
      if (bandPeakK < 0 || es[k] > es[bandPeakK]) bandPeakK = k;
    }
  }
  const cyclesInWindow = durationMs / 1000 * bandLow; // whole cycles of the band's low edge the window holds
  return {
    oscRatio: pathEnergy > 0 && residualEnergy > 0 ? band / pathEnergy : 0,
    bandShare: residualEnergy > 0 ? band / residualEnergy : 0,
    bandPeakHz: bandPeakK < 0 ? 0 : bandPeakK * binHz,
    resolvable: cyclesInWindow >= 1 && cycles > 0,
    cyclesInBand: cycles,
    cyclesInWindow,
    rateHz,
  };
}
