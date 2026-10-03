// Link: the pure core. Runs in Node.
//
// The native <a href> is the whole control. This file holds the drawings
// only: warm's ink underline (a straight-ish hand line, harvested from the
// engine's ink() stroke idiom) and playful's kolam line, a continuous wave
// with a small knotted loop, in the spirit of the Kolam scene's unbroken
// line without reusing its grid geometry.

import { rng } from '../../engine/src/rng.js';

/** The component adds no words of its own: the link's own text is the link. */
export const STRINGS = {};

/**
 * A single hand-drawn stroke under the text, nudged off a straight line by a
 * small seeded jitter so it reads as ink, not a ruler. Warm's underline.
 * @param {number} w @param {string|number} seed
 * @returns {string} an SVG path `d`, y around `amp`
 */
export function inkUnderline(w, seed, { amp = 1.6 } = {}) {
  const r = rng(`link-ink:${seed}`);
  const segs = Math.max(2, Math.round(w / 22));
  let d = `M0 ${(amp + r.range(-amp, amp) * 0.3).toFixed(2)}`;
  for (let i = 1; i <= segs; i++) {
    const x = (w / segs) * i;
    const y = amp + r.range(-amp, amp) * 0.5;
    d += ` L${x.toFixed(1)} ${y.toFixed(2)}`;
  }
  return d;
}

/**
 * The underline as a kolam line: one continuous wave the width of the link,
 * with a small knotted loop near its middle, the way a kolam's line crosses
 * itself. Deterministic for a seed.
 * @param {number} w @param {string|number} seed
 * @param {{ amp?: number, period?: number }} [opts]
 * @returns {string} an SVG path `d`, y spanning roughly [0, 2 * amp + loop]
 */
export function kolamUnderline(w, seed, { amp = 3.2, period = 16 } = {}) {
  const r = rng(`link-kolam:${seed}`);
  const phase = r.range(0, Math.PI * 2);
  const segs = Math.max(3, Math.round(w / period));
  const y = i => amp + Math.sin(phase + i * 1.65) * amp;
  const mid = Math.round(segs / 2);
  let d = `M0 ${y(0).toFixed(2)}`;
  for (let i = 1; i <= segs; i++) {
    const x = (w / segs) * i, py = y(i);
    if (i === mid) {
      // a small knotted loop, the kolam's line crossing itself
      const cx = (w / segs) * (i - 0.5);
      d += ` C${(cx - 3).toFixed(1)} ${(py - amp * 1.6).toFixed(2)}, ${(cx + 3).toFixed(1)} ${(py + amp * 1.6).toFixed(2)}, ${x.toFixed(1)} ${py.toFixed(2)}`;
    } else {
      const px = (w / segs) * (i - 1);
      const c1x = px + (x - px) / 3, c2x = px + (x - px) * 2 / 3;
      d += ` C${c1x.toFixed(1)} ${y(i - 1).toFixed(2)}, ${c2x.toFixed(1)} ${py.toFixed(2)}, ${x.toFixed(1)} ${py.toFixed(2)}`;
    }
  }
  return d;
}
