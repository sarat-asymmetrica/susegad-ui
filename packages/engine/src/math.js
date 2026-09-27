// math.js: scalars, easing and time windows. Pure.

/** @typedef {[number, number]} Point  A point is an [x, y] array. */

export const TAU = Math.PI * 2;
/** @type {(v: number, a?: number, b?: number) => number} */
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
/** @type {(a: number, b: number, t: number) => number} */
export const lerp = (a, b, t) => a + (b - a) * t;
/** Where v sits between a and b, clamped to 0..1. @type {(a: number, b: number, v: number) => number} */
export const invLerp = (a, b, v) => clamp((v - a) / (b - a));
/** @type {(a: number, b: number, v: number) => number} */
export const smoothstep = (a, b, v) => { const t = invLerp(a, b, v); return t * t * (3 - 2 * t); };
/** @type {(a: Point, b: Point) => number} */
export const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

/** Progress 0→1 of time t through the window [start, end]. The backbone of every timeline.
 *  @type {(t: number, start: number, end: number) => number} */
export const phase = (t, start, end) => clamp((t - start) / (end - start));

/** Easing curves, each 0→0 and 1→1. @type {Record<string, (t: number) => number>} */
export const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

/** "Boiling" clock: an integer that ticks `fps` times a second. Mix it into a
 *  stroke's seed and the wobble re-rolls at that rate: hand-drawn animation "on twos".
 *  @type {(t: number, fps?: number) => number} */
export const boil = (t, fps = 10) => Math.floor(t * fps);
