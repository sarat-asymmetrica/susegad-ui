// geom.js: polylines and shapes. Pure. Points are [x, y] arrays.
import { TAU, clamp, lerp, dist } from './math.js';
import { N } from './noise.js';

/** @typedef {import('./math.js').Point} Point */

/** Evenly re-space a polyline every `step` units (so jitter is uniform).
 *  @param {Point[]} pts @param {number} [step] @param {boolean} [closed] @returns {Point[]} */
export function resample(pts, step = 2, closed = false) {
  const src = closed ? [...pts, pts[0]] : pts;
  const out = [src[0].slice()];
  let carry = 0;
  for (let i = 1; i < src.length; i++) {
    const a = src[i - 1], b = src[i];
    const len = dist(a, b);
    let d = step - carry;
    while (d <= len) { const t = d / len; out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); d += step; }
    carry = len - (d - step);
  }
  if (!closed && dist(out[out.length - 1], src[src.length - 1]) > step * 0.25) out.push(src[src.length - 1].slice());
  return out;
}

/** Catmull-Rom spline through points: smooth curves from a handful of anchors.
 *  Passes through every anchor; `samples` points per segment.
 *  @param {Point[]} pts @param {number} [samples] @param {boolean} [closed] @returns {Point[]} */
export function catmull(pts, samples = 10, closed = false) {
  const n = pts.length, out = [];
  if (n < 3) return pts.map(p => p.slice());
  const get = i => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    for (let s = 0; s < samples; s++) {
      const t = s / samples, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(k => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t +
        (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  if (!closed) out.push(pts[n - 1].slice());
  return out;
}

/** Chaikin corner cutting: each pass rounds every corner a little more.
 *  @param {Point[]} pts @param {number} [iterations] @param {boolean} [closed] @returns {Point[]} */
export function chaikin(pts, iterations = 2, closed = false) {
  for (let r = 0; r < iterations && pts.length > 2; r++) {
    const out = closed ? [] : [pts[0]];
    const n = pts.length, segs = closed ? n : n - 1;
    for (let s = 0; s < segs; s++) {
      const a = pts[s], b = pts[(s + 1) % n];
      out.push([lerp(a[0], b[0], 0.25), lerp(a[1], b[1], 0.25)], [lerp(a[0], b[0], 0.75), lerp(a[1], b[1], 0.75)]);
    }
    if (!closed) out.push(pts[n - 1]);
    pts = out;
  }
  return pts;
}

/** Arc-length lookup: measure(pts).at(d) → [x, y, angle] at distance d along the line.
 *  @param {Point[]} pts @param {boolean} [closed]
 *  @returns {{ length: number, at: (d: number) => [number, number, number], points: Point[] }} */
export function measure(pts, closed = false) {
  const P = closed ? [...pts, pts[0]] : pts;
  const cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + dist(P[i - 1], P[i]));
  const length = cum[cum.length - 1];
  const at = d => {
    d = closed ? ((d % length) + length) % length : clamp(d, 0, length);
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
    const a = P[lo], b = P[hi], seg = cum[hi] - cum[lo] || 1, t = (d - cum[lo]) / seg;
    return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  return { length, at, points: P };
}

/** Points on an ellipse or arc. A full turn gives n points (closed, no repeat); an arc gives n + 1.
 *  @returns {Point[]} */
export function ellipse(cx, cy, rx, ry = rx, { n = 64, rot = 0, start = 0, end = TAU } = {}) {
  const out = [], c = Math.cos(rot), s = Math.sin(rot), full = Math.abs(end - start) >= TAU - 1e-6;
  const count = full ? n : n + 1;
  for (let i = 0; i < count; i++) {
    const a = start + (end - start) * (i / n);
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/** An organic closed shape: a circle whose radius breathes with noise. @returns {Point[]} */
export function blob(cx, cy, r, { seed = 0, wobble = 0.12, n = 72, freq = 1.3, squash = 1, rot = 0 } = {}) {
  const out = [], c = Math.cos(rot), s = Math.sin(rot);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const k = 1 + wobble * N(Math.cos(a) * freq + seed * 3.7, Math.sin(a) * freq + seed * 1.9, seed * 0.37) * 2;
    const x = Math.cos(a) * r * k, y = Math.sin(a) * r * k * squash;
    out.push([cx + x * c - y * s, cy + x * s + y * c]);
  }
  return out;
}

/** Push each point along its normal by noise: wobbly outlines, torn paper edges.
 *  @param {Point[]} pts @returns {Point[]} */
export function roughen(pts, { amp = 2, freq = 0.05, seed = 0, step = 3, closed = true } = {}) {
  const P = resample(pts, step, closed), n = P.length;
  return P.map((p, i) => {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const o = (N.fbm(i * step * freq, seed * 5.13, seed * 0.71, 3) * 2) * amp;
    return [p[0] - ty * o, p[1] + tx * o];
  });
}

/** @param {Point[]} pts @returns {{ x: number, y: number, w: number, h: number }} */
export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
