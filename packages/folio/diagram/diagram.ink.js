// Diagram ink: the engine's hand-inked line, as SVG path data. Pure, runs in
// Node, so a warm diagram can be drawn at build time and sealed into a Folio
// document. Same recipe as engine/src/ink.js (resample, a sideways wobble from
// smooth noise, a width that breathes like pen pressure, tapered ends), but it
// returns the ribbon's outline instead of painting it on a canvas.

import { smoothstep } from '../../engine/src/math.js';
import { rng } from '../../engine/src/rng.js';
import { N } from '../../engine/src/noise.js';
import { resample } from '../../engine/src/geom.js';

const r1 = v => Math.round(v * 10) / 10;

/**
 * A hand-inked open stroke along `pts` as filled path data.
 * @param {number[][]} pts
 * @returns {string}
 */
export function inkPath(pts, { width = 1.8, jitter = 0.7, freq = 0.03, pressure = 0.35, taper = 10, seed = 0, step = 3 } = {}) {
  if (pts.length < 2) return '';
  const P = resample(pts, step), n = P.length;
  if (n < 2) return '';
  const total = (n - 1) * step, L = [], R = [];
  for (let i = 0; i < n; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1];
    const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const d = i * step;
    const off = N(d * freq, seed * 7.31, 0.5) * jitter * 1.6;
    let w = width * (1 + pressure * N(d * freq * 0.6, seed * 3.1 + 11, 2.5) * 1.6);
    if (taper > 0) w *= 0.25 + 0.75 * Math.min(smoothstep(0, taper, d), smoothstep(0, taper, total - d));
    w = Math.max(width * 0.15, w) / 2;
    const x = P[i][0] - ty * off, y = P[i][1] + tx * off;
    L.push(`${r1(x - ty * w)} ${r1(y + tx * w)}`); R.push(`${r1(x + ty * w)} ${r1(y - tx * w)}`);
  }
  return `M${L.join('L')}L${R.reverse().join('L')}Z`;
}

/**
 * A box drawn the way a hand draws one: four strokes, each a little off
 * square, running a few units past the corners so they cross there.
 */
export function inkBox(x, y, w, h, { seed = 0, width = 1.5 } = {}) {
  const r = rng(`box:${seed}`), j = (s = 1.4) => r.range(-s, s), over = () => r.range(2, 5);
  const c = [[x + j(), y + j()], [x + w + j(), y + j()], [x + w + j(), y + h + j()], [x + j(), y + h + j()]];
  return c.map((a, k) => {
    const b = c[(k + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
    const ux = dx / len, uy = dy / len, o0 = over(), o1 = over();
    // a slight bow in the middle, as a stroke drawn without a ruler has
    const bow = j(0.9), mx = (a[0] + b[0]) / 2 - uy * bow, my = (a[1] + b[1]) / 2 + ux * bow;
    return inkPath([[a[0] - ux * o0, a[1] - uy * o0], [mx, my], [b[0] + ux * o1, b[1] + uy * o1]], { width, seed: r.range(0, 100), jitter: 0.5, taper: 5, pressure: 0.35, step: 2 });
  }).join('');
}

/** An arrowhead as two short inked strokes meeting at the tip. */
export function inkHead([x, y], angle, { size = 9, spread = 0.46, seed = 0, width = 1.6 } = {}) {
  return [-1, 1].map((s, k) => {
    const a = angle + Math.PI + s * spread;
    return inkPath([[x + Math.cos(a) * size, y + Math.sin(a) * size], [x, y]], { width, seed: seed + k * 13, jitter: 0.25, taper: 3, step: 1.5 });
  }).join('');
}

/** A plain arrowhead as a polyline, for the quiet register. */
export function head([x, y], angle, { size = 8, spread = 0.42 } = {}) {
  const p = s => { const a = angle + Math.PI + s * spread; return `${r1(x + Math.cos(a) * size)} ${r1(y + Math.sin(a) * size)}`; };
  return `M${p(-1)}L${r1(x)} ${r1(y)}L${p(1)}`;
}
