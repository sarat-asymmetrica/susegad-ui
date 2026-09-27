// Checkbox: the pure core. Runs in Node.
//
// The native <input type="checkbox"> is the checkbox: it submits, validates,
// takes Space and speaks for itself. This file holds what is left: the
// tri-state rule for a "select all" box, and the geometry the warm and
// playful skins draw over the native box, on a 20 × 20 grid.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';

/** The component adds no words of its own: the label is the builder's. */
export const STRINGS = {};

/**
 * What a "select all" box shows for its children.
 * @param {boolean[]} states
 * @returns {'checked'|'mixed'|'unchecked'}
 */
export function triState(states) {
  const on = states.filter(Boolean).length;
  if (states.length && on === states.length) return 'checked';
  return on === 0 ? 'unchecked' : 'mixed';
}

const f = v => +v.toFixed(2);
const toPath = pts => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;

/** Resample a polyline every `step` units. */
export function resample(pts, step = 1) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  return out;
}

export const length = pts => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

/**
 * A line drawn by hand: resampled and nudged along its normal by seeded
 * noise, so it wavers like a pencil rather than a ruler.
 * @param {number[][]} pts
 * @param {string|number} seed
 * @param {number} wobble in grid units
 */
export function handLine(pts, seed, wobble = 0.5) {
  const noise = makeNoise(`check-hand:${seed}`);
  const res = resample(pts, 0.8);
  return res.map(([x, y], i) => {
    const a = res[Math.max(0, i - 1)], b = res[Math.min(res.length - 1, i + 1)];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const k = noise(i * 0.3, 3.1) * wobble;
    return [x - (dy / len) * k, y + (dx / len) * k];
  });
}

/**
 * The pencil tick: a short stroke down and a long one up, with the flick a
 * hand gives at the end. Returns the path and its length for drawing it in.
 */
export function pencilTick(seed, wobble = 0.5) {
  const r = rng(`check-tick:${seed}`);
  const a = [4.2 + r.range(-0.4, 0.4), 10.4 + r.range(-0.4, 0.4)];
  const b = [8.3 + r.range(-0.3, 0.3), 14.4 + r.range(-0.3, 0.3)];
  const c = [16.2 + r.range(-0.4, 0.4), 4.6 + r.range(-0.6, 0.4)];
  const flick = [c[0] + (c[0] - b[0]) * 0.08, c[1] + (c[1] - b[1]) * 0.08];
  const pts = handLine([a, b, c, flick], seed, wobble);
  return { d: toPath(pts), length: +length(pts).toFixed(2), points: pts };
}

/** The pencil dash for "some of these": a short level stroke. */
export function pencilDash(seed, wobble = 0.5) {
  const pts = handLine([[5, 10.2], [15, 9.8]], `${seed}:dash`, wobble);
  return { d: toPath(pts), length: +length(pts).toFixed(2) };
}

/** A hand-drawn box around the native one, closed with a small overlap. */
export function pencilBox(seed, wobble = 0.5) {
  const lo = 2.2, hi = 17.8;
  const corners = [[lo + 0.6, lo], [hi, lo + 0.3], [hi - 0.2, hi], [lo, hi - 0.2], [lo + 0.1, lo + 0.4], [lo + 2.2, lo]];
  const pts = handLine(corners, `${seed}:box`, wobble * 0.7);
  return { d: toPath(pts), length: +length(pts).toFixed(2) };
}

/**
 * A box sketched in four strokes, the way a hand draws one: each side a
 * separate pencil line that starts and ends a little past its corners, so the
 * corners cross. Seeded, so the same label always gets the same box.
 * @returns {{ d: string, sides: number[][][] }}
 */
export function sketchBox(seed, { wobble = 0.5, overshoot = 1.8, lo = 2.2, hi = 17.8 } = {}) {
  const r = rng(`check-sketch:${seed}`);
  const j = () => r.range(-0.45, 0.45);
  const c = [[lo + j(), lo + j()], [hi + j(), lo + j()], [hi + j(), hi + j()], [lo + j(), hi + j()]];
  const sides = c.map((a, i) => {
    const b = c[(i + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    const o1 = overshoot * r.range(0.35, 1), o2 = overshoot * r.range(0.35, 1);
    const from = [a[0] - (dx / len) * o1, a[1] - (dy / len) * o1], to = [b[0] + (dx / len) * o2, b[1] + (dy / len) * o2];
    return handLine([from, to], `${seed}:side${i}`, wobble);
  });
  return { d: sides.map(toPath).join(''), sides };
}

/**
 * The stamped tick: a bold filled tick cut like a rubber stamp, a seeded tilt,
 * and a few ink spots flung from the press.
 */
export const STAMP_TICK = 'M2.8 10.6L5.3 8.1L8.4 11.2L15.2 3.4L17.6 5.7L8.5 16.4Z';
export const STAMP_DASH = 'M3.6 8.4H16.4V11.8H3.6Z';

export function stampPose(seed) {
  const r = rng(`check-stamp:${seed}`);
  const spots = Array.from({ length: 3 }, () => {
    const a = r.range(-2.4, 0.4), d = r.range(8.5, 10.5);
    return { cx: f(10 + Math.cos(a) * d), cy: f(10 + Math.sin(a) * d), r: f(r.range(0.35, 0.8)) };
  });
  return { rotate: f(r.range(-9, 5)), spots };
}

/**
 * How a mark arrives, by component motion ('still' | 'state' | 'ambient' | 'full').
 * `draw`: the pencil stroke drawn in (warm); `press`: the stamp coming down (playful).
 */
export function arrival(motion, kind) {
  if (motion === 'still' || motion === 'state') return null;
  // about a quarter of a second, starting slow the way a pen sets down, so a hand is visible
  if (kind === 'draw') return { timing: { duration: 280, easing: 'cubic-bezier(0.55, 0.05, 0.3, 1)' } };
  return {
    frames: [
      { transform: 'scale(1.45)', opacity: 0 },
      { transform: 'scale(0.92)', opacity: 1, offset: 0.6 },
      { transform: 'scale(1)', opacity: 1 },
    ],
    timing: { duration: 260, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
  };
}
