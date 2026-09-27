// ink.js: hand-inked and coloured-pencil lines. Canvas edge.
import { smoothstep } from './math.js';
import { N } from './noise.js';
import { resample } from './geom.js';
import { grainPattern } from './paper.js';

/**
 * A hand-inked line. The polyline is resampled, nudged sideways by smooth
 * noise (wobble), and filled as a ribbon whose width breathes like pen
 * pressure and tapers at the ends. Change `seed` (e.g. with boil(t)) to re-roll.
 * @param {CanvasRenderingContext2D} g @param {import('./math.js').Point[]} pts
 */
export function ink(g, pts, {
  width = 2, color = '#1d2742', alpha = 1, jitter = 0.9, freq = 0.03, pressure = 0.35,
  taper = 14, seed = 0, closed = false, step = 2, grain = false,
} = {}) {
  if (pts.length < 2) return;
  const P = resample(pts, step, closed), n = P.length;
  if (n < 2) return;
  const total = (n - 1) * step, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = P[closed ? (i - 1 + n) % n : Math.max(0, i - 1)], b = P[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const d = i * step;
    const off = N(d * freq, seed * 7.31, 0.5) * jitter * 1.6;
    let w = width * (1 + pressure * N(d * freq * 0.6, seed * 3.1 + 11, 2.5) * 1.6);
    if (!closed && taper > 0) w *= 0.2 + 0.8 * Math.min(smoothstep(0, taper, d), smoothstep(0, taper, total - d));
    w = Math.max(width * 0.12, w) / 2;
    const x = P[i][0] - ty * off, y = P[i][1] + tx * off;
    L.push([x - ty * w, y + tx * w]); R.push([x + ty * w, y - tx * w]);
  }
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = grain ? grainPattern(g, color) : color;
  g.beginPath();
  L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
  if (closed) { g.closePath(); g.moveTo(R[n - 1][0], R[n - 1][1]); }
  for (let i = n - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]);
  g.closePath();
  g.fill(closed ? 'evenodd' : 'nonzero');
  g.restore();
}

/** Coloured-pencil line: a few thin, grainy, slightly offset passes of ink().
 *  @param {CanvasRenderingContext2D} g @param {import('./math.js').Point[]} pts */
export function pencil(g, pts, { width = 1.6, color = '#1d2742', alpha = 0.85, passes = 2, seed = 0, jitter = 0.7, closed = false } = {}) {
  for (let k = 0; k < passes; k++) {
    ink(g, pts, { width: width * (k ? 0.7 : 1), color, alpha: alpha * (k ? 0.6 : 1), jitter: jitter * (1 + k * 0.6), seed: seed + k * 17.3, pressure: 0.5, closed, grain: true });
  }
}
