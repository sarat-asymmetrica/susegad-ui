// Signature: pure geometry for the skins. Runs in Node.
// How fresh ink dries, where the ink is, playful's flourish, and the size
// the typed name is set at. The element never needs these; the skins do.

import { smoothstep, lerp } from '../../../engine/src/math.js';
import { rng } from '../../../engine/src/rng.js';
import { PAD } from '../signature.core.js';

/** How long fresh ink takes to dry, in ms. */
export const DRY_MS = 1600;

/** 0 when the ink has just landed, 1 once it is dry. */
export const dryness = (age, motion) => (motion === 'still' || motion === 'state' ? 1 : smoothstep(0, DRY_MS, age));

/** The box around every stroke, or null. @param {number[][][]} strokes */
export function inkBounds(strokes) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return x0 === Infinity ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Playful's flourish: a swash under the signature that ends in a small loop,
 * as samples a stroke would have (so it inks with the same ribbon). Seeded.
 * @param {{ x: number, y: number, w: number, h: number }} b
 * @returns {number[][]}
 */
export function flourish(b, seed = 1) {
  const r = rng(`sig-flourish:${seed}`);
  // a swash that dips under the first letters, sweeps up past the last and
  // turns back on itself in a small loop, as a pen does when it lifts with a flourish
  const y = Math.min(PAD.H - 26, b.y + b.h + r.range(4, 9));
  const x0 = Math.max(14, b.x + b.w * r.range(0.02, 0.12)), x1 = Math.min(PAD.W - 40, b.x + b.w + r.range(14, 30));
  const dip = r.range(7, 11), rise = r.range(10, 16), pts = [], n = 40;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(x0, x1, t), y + Math.sin(t * Math.PI) * dip - smoothstep(0.55, 1, t) * rise, i * 6, 0.5]);
  }
  const lr = r.range(6, 9), cx = x1 - lr * 0.4, cy = y - rise - lr * 0.2;
  for (let i = 1; i <= 18; i++) {
    const a = -0.3 - (i / 18) * Math.PI * 1.9;
    pts.push([cx + Math.cos(a) * lr, cy + Math.sin(a) * lr * 0.85, (n + i) * 12, 0.5]);
  }
  return pts;
}

/** The largest hand-face size (logical px) at which `width(size)` fits the line. */
export function fitSize(width, { max = 64, min = 22, room = PAD.W - 80 } = {}) {
  let s = max;
  while (s > min && width(s) > room) s -= 2;
  return s;
}
