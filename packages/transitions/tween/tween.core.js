// Bake and reflow for motion: the curve once, then arithmetic per frame.
//
//   bake(easing)             once: the easing curve as a table of samples.
//                            Plain JSON; commit it, ship it, read it in CI.
//   tween(cache, t)          per frame: eased progress for t in 0..1. A table
//                            lookup and one multiply; no Math.pow, no solving.
//   still(cache)             the end state, which is what reduced motion shows.
//
// Nothing here replaces the easings the page and the Kantar curtain use. It
// names the shape they already have (a curve decided up front, evaluated by
// arithmetic) so that any of them can be held as data. Pure: no DOM, no timer,
// no Promise; runs in Node. tween.core.test.js checks every shipped curve
// against the maths it came from.

export const CACHE_KIND = 'sg.motion.cache';
export const CACHE_VERSION = 1;

/**
 * Samples in a baked table. With linear interpolation between samples the
 * error is at most max|y''| / (8 n²). Measured: 3e-5 for the token curves and
 * the Kantar cubics, 3.3e-4 for the playful spring. A spring also carries the
 * residual the tokens' own `springEasing` carries (it settles to within about
 * 0.2% and is snapped to 1 at the end), in its last sample interval only.
 * tween.core.test.js holds these figures.
 *
 * A spring rings faster the lower its damping ratio ζ, and its curvature grows
 * as 1/ζ², so its error would too. A spring bake therefore takes
 * max(256, 120 / ζ) samples unless you pass `samples`, which keeps the error at
 * or under 4e-4 (body of the curve) for ζ down to 0.05: 256 samples for 0.72 and
 * 0.48, 1200 for 0.1, 2400 for 0.05.
 */
export const DEFAULT_SAMPLES = 256;

/** Samples a spring of damping ratio ζ needs to stay within 4e-4: error is about 5.1 / (ζ n)². */
export const springSamples = damping => Math.max(DEFAULT_SAMPLES, Math.ceil(120 / damping));

// A t that is not a number (a dt glitch, a missing value) is the start of the motion, never NaN.
const clamp01 = t => (t >= 1 ? 1 : t > 0 ? t : 0);
const round = v => (Number.isFinite(v) ? +v.toFixed(5) : NaN);

/** `cubic-bezier(x1, y1, x2, y2)` as CSS writes it, to four numbers. */
function parseBezier(str) {
  const m = /^cubic-bezier\(\s*([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([-\d.e]+)[\s,]+([-\d.e]+)\s*\)$/i.exec(str.trim());
  if (!m) return null;
  return m.slice(1, 5).map(Number);
}

/** `linear(0, 0.3, 0.9 60%, 1)` as CSS writes it: points, some with positions. Returns f(t). */
function parseLinear(str) {
  const m = /^linear\((.*)\)$/is.exec(str.trim());
  if (!m) return null;
  // A stop may carry one or two positions (two means a flat run); each position is a point.
  const pts = [];
  for (const p of m[1].split(',')) {
    const [v, ...pos] = p.trim().split(/\s+/);
    if (Number.isNaN(+v)) return null;
    if (!pos.length) pts.push({ y: +v, x: null });
    else for (const q of pos) pts.push({ y: +v, x: parseFloat(q) / 100 });
  }
  // CSS fills in what is missing: the first is 0, the last 1, the rest spread evenly between known ones.
  if (pts[0].x == null) pts[0].x = 0;
  if (pts[pts.length - 1].x == null) pts[pts.length - 1].x = 1;
  let last = 0;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].x == null) continue;
    for (let j = last + 1; j < i; j++) pts[j].x = pts[last].x + ((pts[i].x - pts[last].x) * (j - last)) / (i - last);
    last = i;
  }
  for (let i = 1; i < pts.length; i++) pts[i].x = Math.max(pts[i].x, pts[i - 1].x);
  return t => {
    if (t <= pts[0].x) return pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      if (t <= pts[i].x) {
        const a = pts[i - 1], b = pts[i];
        return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (t - a.x)) / (b.x - a.x);
      }
    }
    return pts[pts.length - 1].y;
  };
}

/** y at x for the CSS cubic Bézier through (0,0), (x1,y1), (x2,y2), (1,1): solve x(s) = t, then read y(s). */
function bezier([x1, y1, x2, y2]) {
  const bx = s => 3 * x1 * s * (1 - s) ** 2 + 3 * x2 * s * s * (1 - s) + s ** 3;
  const by = s => 3 * y1 * s * (1 - s) ** 2 + 3 * y2 * s * s * (1 - s) + s ** 3;
  return t => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (bx(mid) < t) lo = mid; else hi = mid;
    }
    return by((lo + hi) / 2);
  };
}

/**
 * A damped spring from 0 to 1 that has settled by t = 1, damping ratio ζ below
 * 1 (it overshoots). The same law as `springEasing` in tokens.js, in closed form.
 */
export function spring(damping) {
  if (!(damping > 0 && damping < 1)) throw new RangeError('A spring wants a damping ratio between 0 and 1');
  const w = 6.4 / damping;
  const wd = w * Math.sqrt(1 - damping * damping);
  return t => 1 - Math.exp(-damping * w * t) * (Math.cos(wd * t) + ((damping * w) / wd) * Math.sin(wd * t));
}

/**
 * Evaluate an easing once into a table.
 * @param {((t: number) => number) | string | { spring: number } | { bezier: number[] }} easing
 *   a function of t in 0..1 (the Kantar curtain's `easeOutCubic`); a CSS
 *   `cubic-bezier(...)` or `linear(...)` string, as the tokens write them
 *   (`motion.easings.out`, `registers.playful.easeSpring`); `{ spring: ζ }`;
 *   or `{ bezier: [x1, y1, x2, y2] }`
 * @param {{ samples?: number }} [opts]
 * @returns {{ kind: string, version: number, n: number, source: string, samples: number[] }}
 *   `samples[i]` is the eased value at t = i / n; first is 0, last is 1
 */
export function bake(easing, { samples } = {}) {
  if (samples !== undefined && (!Number.isInteger(samples) || samples < 2)) throw new RangeError('samples is a whole number, 2 or more');
  let f, source;
  if (typeof easing === 'function') { f = easing; source = easing.name || 'function'; }
  else if (typeof easing === 'string') {
    const b = parseBezier(easing);
    f = b ? bezier(b) : parseLinear(easing);
    if (!f) throw new TypeError(`Not a cubic-bezier() or linear() easing: ${easing}`);
    source = easing.trim();
  } else if (easing && typeof easing === 'object' && 'spring' in easing) { f = spring(easing.spring); source = `spring(${easing.spring})`; samples ??= springSamples(easing.spring); }
  else if (easing && typeof easing === 'object' && Array.isArray(easing.bezier) && easing.bezier.length === 4) { f = bezier(easing.bezier); source = `cubic-bezier(${easing.bezier.join(', ')})`; }
  else throw new TypeError('bake wants a function, a CSS easing string, { spring } or { bezier }');
  samples ??= DEFAULT_SAMPLES;
  const table = Array.from({ length: samples + 1 }, (_, i) => round(f(i / samples)));
  if (table.some(v => !Number.isFinite(v))) throw new RangeError('That easing gives a value that is not a number');
  table[0] = 0;
  table[samples] = 1;
  return { kind: CACHE_KIND, version: CACHE_VERSION, n: samples, source, samples: table };
}

/**
 * Eased progress at t, by arithmetic over the table. Linear between samples.
 * Springs may return a little over 1 or under 0 on the way, as they should.
 * @param {ReturnType<typeof bake>} cache
 * @param {number} t progress in 0..1 (clamped; NaN or undefined count as 0)
 * @param {{ reducedMotion?: boolean }} [opts] reduced motion shows the end state
 */
export function tween(cache, t, { reducedMotion = false } = {}) {
  if (reducedMotion) return still(cache);
  const { samples, n } = cache;
  const x = clamp01(t) * n;
  const i = Math.min(n - 1, Math.floor(x));
  const f = x - i;
  return samples[i] + (samples[i + 1] - samples[i]) * f;
}

/** The still: where the motion ends, which is all that reduced motion paints. */
export const still = cache => cache.samples[cache.n];

/** Blend two numbers by eased progress `p`. */
export const mix = (a, b, p) => a + (b - a) * p;

/**
 * The most the curve leaves 0..1 by, as a fraction: 0 for a curve that stays
 * inside, 0.038 for the warm spring. Lets a caller leave room for overshoot.
 */
export function overshoot(cache) {
  let o = 0;
  for (const v of cache.samples) o = Math.max(o, v - 1, -v);
  return +o.toFixed(5);
}
