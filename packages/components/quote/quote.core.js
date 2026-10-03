// Quote: the pure core. Runs in Node.
//
// A pull-quote or testimonial is native HTML (figure, blockquote,
// figcaption); what is computed here is the ornament: the warm register's
// pencil bracket and the playful register's hand-drawn quotation mark, and
// how that mark inks in.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';
import { catmull } from '../../engine/src/geom.js';

/** The component adds no words of its own. */
export const STRINGS = {};

const f = v => +v.toFixed(2);
const path = pts => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;

/**
 * A pencil bracket "[" beside the words, `h` tall: a stroke down with short
 * serifs at each end, its line wandering by seeded noise, drawn twice like a
 * pencil going over it. Coordinates in a box 12 wide.
 * @param {number} h
 * @param {string|number} seed
 * @param {number} [wobble]
 * @returns {string[]} two path d strings
 */
export function bracket(h, seed, wobble = 0.6) {
  h = Math.max(24, h);
  const out = [];
  for (let pass = 0; pass < 2; pass++) {
    const n = makeNoise(`quote-bracket:${seed}:${pass}`), r = rng(`quote-bracket:${seed}:${pass}`);
    const pts = [[10 + r.range(-0.6, 0.6), 1.5]];
    const steps = Math.ceil(h / 6);
    for (let i = 0; i <= steps; i++) {
      const y = 3 + ((h - 6) * i) / steps;
      pts.push([3.2 + n(i * 0.21, pass * 3.1) * wobble * 2 + pass * 0.5, y]);
    }
    pts.push([10 + r.range(-0.6, 0.6), h - 1.5]);
    out.push(path(pts));
  }
  return out;
}

/**
 * The playful mark: an opening quotation mark as two hand-drawn "6" shapes,
 * each a closed blob (a round head with a tail sweeping up and right), their
 * outlines nudged by seeded noise so no two quotes match. Box: 64 × 52.
 * @param {string|number} seed
 * @returns {string[]} two closed path d strings
 */
export function quoteMark(seed) {
  const anchors = [[0.95, 0.2], [0.6, 0.85], [0, 1], [-0.7, 0.72], [-1, 0], [-0.82, -0.8], [-0.25, -1.55], [0.55, -2.25], [1.35, -2.7], [0.9, -1.95], [0.45, -1.3], [0.62, -0.78], [0.95, -0.35]];
  return [0, 1].map(k => {
    const n = makeNoise(`quote-mark:${seed}:${k}`), r = rng(`quote-mark:${seed}:${k}`);
    const size = 11 + r.range(-0.8, 0.8), cx = 14 + k * 30 + r.range(-1, 1), cy = 38 + r.range(-1, 1);
    const pts = catmull(anchors.map(([x, y], i) => [cx + (x + n(i * 0.7, 1) * 0.08) * size, cy + (y + n(i * 0.7, 5) * 0.08) * size]), 6, true);
    return `${path(pts)}Z`;
  });
}

/**
 * How the mark inks in when it first comes into view: each blot fades in and
 * settles from a little larger, the second one beat after the first. Opacity
 * and transform only; null unless motion is full.
 * @param {'still'|'state'|'ambient'|'full'} motion
 * @param {number} i which blot, 0 or 1
 */
export function inkIn(motion, i) {
  if (motion !== 'full') return null;
  return {
    frames: [{ opacity: 0, transform: 'scale(1.35)' }, { opacity: 1, transform: 'scale(0.96)', offset: 0.7 }, { opacity: 1, transform: 'scale(1)' }],
    timing: { duration: 420, delay: 120 + i * 160, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)', fill: 'backwards' },
  };
}
