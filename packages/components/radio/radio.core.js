// Radio group: the pure core. Runs in Node.
//
// The native <fieldset> and its radios do the work: one choice per name,
// arrow keys, required, submitting. This file holds the geometry the warm
// and playful skins draw over each native circle, on a 20 × 20 grid.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';

/** The component adds no words of its own: the legend and labels are the builder's. */
export const STRINGS = {};

const f = v => +v.toFixed(2);

/**
 * A ring drawn by hand: a circle whose radius wavers with seeded noise,
 * started at a seeded angle and carried a little past where it began. The
 * overrun sits `spread` units outside the start, so the overlap shows. With
 * `squash` below 1 and a `tilt` in degrees it is the leaning oval a pen makes
 * round an answer.
 * @returns {{ d: string, length: number, points: number[][] }}
 */
export function handRing(seed, { r = 7.6, wobble = 0.45, overlap = 0.12, cx = 10, cy = 10, spread = 0.25, squash = 1, tilt = 0 } = {}) {
  const R = rng(`radio-ring:${seed}`);
  const noise = makeNoise(`radio-ring:${seed}`);
  const start = R.range(0, Math.PI * 2);
  const turns = 1 + overlap;
  const n = Math.round(48 * turns);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, a = start + t * turns * Math.PI * 2;
    const rr = r + noise(t * 3.2, 1.7) * wobble * 1.6 + spread * Math.max(0, Math.min(1, (t * turns - 0.85) / 0.3));
    const x = Math.cos(a) * rr / Math.sqrt(squash), y = Math.sin(a) * rr * Math.sqrt(squash), k = (tilt * Math.PI) / 180;
    pts.push([cx + x * Math.cos(k) - y * Math.sin(k), cy + x * Math.sin(k) + y * Math.cos(k)]);
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { d: `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`, length: f(len), points: pts };
}

/** An ink dot: a round blot, a little uneven at the edge. */
export function inkDot(seed, r = 3.6) {
  const noise = makeNoise(`radio-dot:${seed}`);
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2, rr = r * (1 + noise(i * 0.4, 5.3) * 0.12);
    pts.push([10 + Math.cos(a) * rr, 10 + Math.sin(a) * rr]);
  }
  return `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}

/**
 * The kolam dot: the pulli at the centre, and four round petal loops drawn
 * round it the way a kolam line loops round a dot. Together they fill the
 * radio's circle as a four-petalled flower, with a notch between each pair of
 * petals, so it reads as a flower at 20 px from arm's length. Each petal
 * starts and ends at the centre; the pulli is left as a hole of paper.
 */
export const KOLAM = {
  dot: { cx: 10, cy: 10, r: 1.7 },
  petals: [0, 90, 180, 270].map(deg => {
    const a = (deg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const at = (u, n) => `${f(10 + ux * u + nx * n)} ${f(10 + uy * u + ny * n)}`;
    return `M10 10C${at(1.1, 5)} ${at(9, 3.9)} ${at(8.4, 0)}C${at(9, -3.9)} ${at(1.1, -5)} 10 10`;
  }),
};

/**
 * How the choice arrives, by component motion. `ring`: the inked ring drawn
 * round the chosen radio (warm); `bloom`: the kolam petals opening (playful).
 */
export function arrival(motion, kind) {
  if (motion === 'still' || motion === 'state') return null;
  if (kind === 'ring') return { timing: { duration: 280, easing: 'cubic-bezier(0.45, 0.05, 0.25, 1)' } };
  return {
    frames: [{ transform: 'scale(0.2) rotate(-45deg)', opacity: 0 }, { transform: 'scale(1.12) rotate(6deg)', opacity: 1, offset: 0.65 }, { transform: 'scale(1) rotate(0deg)', opacity: 1 }],
    timing: { duration: 320, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
  };
}
