import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bake, tween, still, mix, overshoot, spring, springSamples, CACHE_KIND, DEFAULT_SAMPLES } from './tween.core.js';
import { easeOutCubic, easeInCubic, curtainAt } from '../kantar/kantar.core.js';
import { motion, registers, springEasing, springOvershoot } from '../../tokens/tokens.js';

const N = 20001;
const ts = Array.from({ length: N }, (_, i) => i / (N - 1));
const maxErr = (cache, f) => ts.reduce((m, t) => Math.max(m, Math.abs(tween(cache, t) - f(t))), 0);

/** An independent reference for a CSS cubic-bezier: sample the parametric curve densely and interpolate y at x. */
function bezierRef([x1, y1, x2, y2]) {
  const M = 400000, xs = new Float64Array(M + 1), ys = new Float64Array(M + 1);
  for (let k = 0; k <= M; k++) {
    const s = k / M, u = 1 - s;
    xs[k] = 3 * u * u * s * x1 + 3 * u * s * s * x2 + s ** 3;
    ys[k] = 3 * u * u * s * y1 + 3 * u * s * s * y2 + s ** 3;
  }
  return t => {
    let lo = 0, hi = M;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (xs[mid] < t) lo = mid; else hi = mid; }
    const d = xs[hi] - xs[lo];
    return d === 0 ? ys[hi] : ys[lo] + ((ys[hi] - ys[lo]) * (t - xs[lo])) / d;
  };
}
const bezierNums = css => css.match(/-?[\d.]+/g).map(Number);

// ── the cache is data ───────────────────────────────────────────────────────

test('a baked easing is plain JSON with n + 1 samples from 0 to 1', () => {
  for (const e of [easeOutCubic, motion.easings.out, motion.easings.spring, { spring: 0.5 }, { bezier: [0.2, 0, 0, 1] }]) {
    const c = bake(e);
    assert.equal(c.kind, CACHE_KIND);
    assert.equal(c.samples.length, DEFAULT_SAMPLES + 1);
    assert.equal(c.n, DEFAULT_SAMPLES);
    assert.equal(c.samples[0], 0);
    assert.equal(c.samples[c.n], 1);
    assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
  }
});

test('bake refuses what it cannot read', () => {
  assert.throws(() => bake('ease-in-out'), TypeError);
  assert.throws(() => bake('cubic-bezier(1,2)'), TypeError);
  assert.throws(() => bake({ spring: 1.2 }), RangeError);
  assert.throws(() => bake({ spring: 0 }), RangeError);
  assert.throws(() => bake(42), TypeError);
  assert.throws(() => bake(easeOutCubic, { samples: 1 }), RangeError);
  assert.throws(() => bake('linear(0, nope, 1)'), TypeError);
});

// ── it agrees with the maths the page and the curtain use ───────────────────

test('the Kantar curtain easings bake to within 1e-4 of the closed form, at 20001 values of t', () => {
  const out = bake(easeOutCubic), inn = bake(easeInCubic);
  const eo = maxErr(out, easeOutCubic), ei = maxErr(inn, easeInCubic);
  console.log(`kantar easeOutCubic max error ${eo.toExponential(2)}, easeInCubic ${ei.toExponential(2)} (256 samples)`);
  assert.ok(eo <= 1e-4, `easeOutCubic ${eo}`);
  assert.ok(ei <= 1e-4, `easeInCubic ${ei}`);
});

test('the curtain falls and rises on baked tables exactly as curtainAt moves it', () => {
  const down = bake(easeOutCubic), up = bake(easeInCubic);
  let worst = 0;
  for (const p of ts) {
    worst = Math.max(worst, Math.abs(tween(down, p) - curtainAt('down', p)), Math.abs(1 - tween(up, p) - curtainAt('up', p)));
  }
  console.log(`curtainAt vs baked tween: max error ${worst.toExponential(2)}`);
  assert.ok(worst <= 1e-4, `curtain error ${worst}`);
});

test('the token cubic-béziers (out, in-out, ink) agree with a dense parametric reference within 1e-4', () => {
  for (const key of ['out', 'in-out', 'ink']) {
    const css = motion.easings[key];
    const c = bake(css);
    const e = maxErr(c, bezierRef(bezierNums(css)));
    console.log(`token easing ${key}: max error ${e.toExponential(2)}`);
    assert.ok(e <= 1e-4, `${key}: ${e}`);
  }
  assert.ok(Math.abs(tween(bake(motion.easings['in-out']), 0.5) - 0.5) < 1e-4, 'in-out is symmetric');
});

test('a closed-form spring agrees with the tokens spring: the linear() string at every one of its points', () => {
  for (const zeta of [0.72, 0.48]) {
    const css = springEasing(zeta);
    const pts = css.slice(7, -1).split(',').map(Number);
    const c = bake({ spring: zeta });
    let worst = 0;
    pts.forEach((v, i) => { worst = Math.max(worst, Math.abs(tween(c, i / (pts.length - 1)) - v)); });
    console.log(`spring ${zeta} vs springEasing() knots: max error ${worst.toExponential(2)} (the string is written to 3 places)`);
    assert.ok(worst <= 1e-3, `spring ${zeta}: ${worst}`);
  }
});

test('the closed-form spring stays within 4e-4 of its own function, bar the last sample interval where it lands on 1', () => {
  for (const zeta of [0.72, 0.48]) {
    const c = bake({ spring: zeta }), f = spring(zeta);
    const body = ts.filter(t => t <= 1 - 1 / c.n);
    const e = body.reduce((m, t) => Math.max(m, Math.abs(tween(c, t) - f(t))), 0);
    // The law settles to within about 0.2% at t = 1, and springEasing() snaps that to exactly 1; so does bake.
    const snap = Math.abs(1 - f(1));
    const last = ts.filter(t => t > 1 - 1 / c.n).reduce((m, t) => Math.max(m, Math.abs(tween(c, t) - f(t))), 0);
    console.log(`spring ${zeta}: table vs closed form max error ${e.toExponential(2)}; last interval ${last.toExponential(2)} (the spring's own residual at t=1 is ${snap.toExponential(2)})`);
    assert.ok(e <= 4e-4, `spring ${zeta}: ${e}`);
    assert.ok(last <= snap + 4e-4, `spring ${zeta} last interval: ${last}`);
  }
});

test('a linear() string bakes as the browser draws it: straight lines between its points', () => {
  const css = registers.playful.easeSpring;
  const pts = css.slice(7, -1).split(',').map(Number);
  const c = bake(css);
  const ref = t => { const x = t * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(x)); return pts[i] + (pts[i + 1] - pts[i]) * (x - i); };
  const e = maxErr(c, ref);
  console.log(`linear() spring: table vs the browser's straight lines, max error ${e.toExponential(2)}`);
  assert.ok(e <= 2e-3, `${e}`);
  const hand = bake('linear(0, 0.5 25% 75%, 1)');
  assert.ok(Math.abs(tween(hand, 0.5) - 0.5) < 1e-4, 'a flat run holds its value');
  assert.ok(Math.abs(tween(hand, 0.125) - 0.25) < 1e-3);
  assert.ok(Math.abs(tween(hand, 0.9) - 0.8) < 1e-3);
});

test('springs overshoot as the register says; the curves that should not, do not', () => {
  assert.ok(Math.abs(overshoot(bake({ spring: 0.72 })) - springOvershoot(0.72)) < 1e-3);
  assert.ok(Math.abs(overshoot(bake({ spring: 0.48 })) - registers.playful.overshoot) < 1e-3);
  assert.ok(Math.abs(overshoot(bake({ spring: 0.72 })) - registers.warm.overshoot) < 1e-3);
  for (const e of [motion.easings.out, motion.easings['in-out'], motion.easings.ink, easeOutCubic, easeInCubic]) assert.equal(overshoot(bake(e)), 0);
});

test('the ease-outs and ease-ins are monotone, so a baked table never runs backwards', () => {
  for (const e of [motion.easings.out, motion.easings['in-out'], motion.easings.ink, easeOutCubic, easeInCubic]) {
    const { samples } = bake(e);
    for (let i = 1; i < samples.length; i++) assert.ok(samples[i] >= samples[i - 1] - 1e-9, `${String(e).slice(0, 30)} step ${i}`);
  }
});

// ── per frame: arithmetic over the table ────────────────────────────────────

test('tween clamps t, hits both ends, and is deterministic', () => {
  const c = bake(easeOutCubic);
  assert.equal(tween(c, -3), 0);
  assert.equal(tween(c, 0), 0);
  assert.equal(tween(c, 1), 1);
  assert.equal(tween(c, 7), 1);
  assert.equal(tween(c, 0.37), tween(c, 0.37));
  assert.ok(tween(c, 0.5) > tween(c, 0.25));
});

test('tween interpolates between samples: a 4-sample line is the line', () => {
  const c = bake(t => t, { samples: 4 });
  for (const t of [0, 0.1, 0.33, 0.5, 0.77, 1]) assert.ok(Math.abs(tween(c, t) - t) < 1e-9);
});

test('reduced motion shows the still: the end state, whatever t is, for every curve', () => {
  for (const e of [easeOutCubic, motion.easings.ink, motion.easings.spring, { spring: 0.48 }]) {
    const c = bake(e);
    assert.equal(still(c), 1);
    for (const t of [0, 0.01, 0.3, 0.99, 1]) assert.equal(tween(c, t, { reducedMotion: true }), 1);
    assert.equal(still(c), tween(c, 1));
  }
});

test('tween does not touch the table', () => {
  const c = bake(motion.easings.ink);
  const copy = structuredClone(c);
  Object.freeze(c.samples); Object.freeze(c);
  for (const t of ts.slice(0, 500)) tween(c, t);
  assert.deepEqual(c, copy);
});

test('mix blends two numbers by eased progress, overshoot included', () => {
  assert.equal(mix(10, 20, 0), 10);
  assert.equal(mix(10, 20, 1), 20);
  assert.equal(mix(10, 20, 0.5), 15);
  const c = bake({ spring: 0.48 });
  const peak = Math.max(...c.samples);
  assert.ok(mix(0, 100, peak) > 100, 'a playful spring carries a value past its end');
});

test('a linear() stop placed before the one ahead of it is held there, as CSS does', () => {
  const c = bake('linear(0, 0.5 60%, 0.4 40%, 1)');
  assert.ok(Math.abs(tween(c, 0.8) - 0.7) < 1e-3, `${tween(c, 0.8)}`);
  assert.ok(Math.abs(tween(c, 0.3) - 0.25) < 1e-3);
});

// ── round 2: the gaps Rasika found ──────────────────────────────────────────

test('a t that is not a number is the start of the motion, never NaN', () => {
  const c = bake(motion.easings.out);
  for (const t of [NaN, undefined, null, 'x']) assert.equal(tween(c, t), 0, String(t));
  assert.equal(tween(c, Infinity), 1);
  assert.equal(tween(c, -Infinity), 0);
  assert.equal(tween(c, NaN, { reducedMotion: true }), 1, 'the still is still the end');
});

test('bake rejects an easing that gives a value that is not a number', () => {
  assert.throws(() => bake(() => NaN), RangeError);
  assert.throws(() => bake(t => (t > 0.5 ? Infinity : t)), RangeError);
  assert.throws(() => bake(t => (t > 0.5 ? undefined : t)), RangeError);
});

test('a spring needs a damping ratio strictly between 0 and 1', () => {
  for (const z of [1, 0, -0.5, NaN, 1.5]) assert.throws(() => bake({ spring: z }), RangeError, String(z));
  assert.throws(() => spring(1), RangeError);
  assert.doesNotThrow(() => bake({ spring: 0.99 }));
});

test('overshoot reports a dip below 0 as well as a rise above 1', () => {
  const backIn = bake(t => t * t * (2.7 * t - 1.7)); // pulls back before it goes
  assert.ok(Math.min(...backIn.samples) < -0.05);
  assert.ok(overshoot(backIn) > 0.05, `${overshoot(backIn)}`);
  assert.equal(overshoot(bake(t => t)), 0);
});

test('a spring takes more samples the lower its damping, and stays within 4e-4 down to 0.05', () => {
  for (const zeta of [0.72, 0.48, 0.1, 0.05]) {
    const c = bake({ spring: zeta }), f = spring(zeta);
    assert.equal(c.n, springSamples(zeta));
    const body = ts.filter(t => t <= 1 - 1 / c.n);
    const e = body.reduce((m, t) => Math.max(m, Math.abs(tween(c, t) - f(t))), 0);
    console.log(`spring ${zeta}: ${c.n} samples, body error ${e.toExponential(2)}`);
    assert.ok(e <= 4e-4, `spring ${zeta}: ${e}`);
  }
  assert.equal(springSamples(0.72), 256);
  assert.equal(springSamples(0.1), 1200);
  assert.equal(springSamples(0.05), 2400);
  // asking for 256 samples of a 0.05 spring is allowed, and is visibly worse: why the default scales
  const coarse = bake({ spring: 0.05 }, { samples: 256 });
  const bad = ts.filter(t => t <= 0.99).reduce((m, t) => Math.max(m, Math.abs(tween(coarse, t) - spring(0.05)(t))), 0);
  assert.ok(bad > 4e-3, `${bad}`);
});
