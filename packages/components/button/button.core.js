// Button: the pure core. Runs in Node.
//
// The native <button> or <a> is the whole control: it takes the keyboard,
// submits forms, and follows links, with or without JavaScript. This file
// holds only the drawings: warm's hand-drawn double outline (a seeded
// jitter, so two buttons on a page never draw the same wobble) and
// playful's ink-spread press, ported from the stamp's landing().spread.

import { rng } from '../../engine/src/rng.js';

/** The component adds no words of its own: the builder's label is the button. */
export const STRINGS = {};

/**
 * A hand-drawn rounded-rect outline as an SVG path, jittered from a seed.
 * Walks the perimeter of a w × h box with rounded corners of radius r,
 * nudging `points` samples per straight edge off the true line by up to
 * `jitter` units, so the ink looks drawn rather than plotted. Deterministic
 * for a seed; two calls with the same seed give the same path.
 * @param {number} w @param {number} h @param {string|number} seed
 * @param {{ points?: number, jitter?: number, radius?: number }} [opts]
 * @returns {string} an SVG path `d`
 */
export function boilOutline(w, h, seed, { points = 5, jitter = 1.4, radius = 8 } = {}) {
  const r = rng(`button-boil:${seed}`);
  const rad = Math.min(radius, w / 2, h / 2);
  const wobble = () => +(r.range(-jitter, jitter)).toFixed(2);
  // corners, each nudged a little, then straight edges sampled between them
  const c = [
    { x: rad + wobble(), y: wobble() }, // top-left, after the corner
    { x: w - rad + wobble(), y: wobble() }, // top-right, before the corner
    { x: w + wobble(), y: rad + wobble() },
    { x: w + wobble(), y: h - rad + wobble() },
    { x: w - rad + wobble(), y: h + wobble() },
    { x: rad + wobble(), y: h + wobble() },
    { x: wobble(), y: h - rad + wobble() },
    { x: wobble(), y: rad + wobble() },
  ];
  const edge = (a, b) => {
    const out = [];
    for (let i = 1; i <= points; i++) {
      const t = i / (points + 1);
      out.push(`L${(a.x + (b.x - a.x) * t + wobble()).toFixed(2)} ${(a.y + (b.y - a.y) * t + wobble()).toFixed(2)}`);
    }
    return out.join(' ');
  };
  return [
    `M${c[0].x} ${c[0].y}`,
    edge(c[0], c[1]), `L${c[1].x} ${c[1].y}`,
    `Q${w} ${wobble()} ${c[2].x} ${c[2].y}`,
    edge(c[2], c[3]), `L${c[3].x} ${c[3].y}`,
    `Q${w + wobble()} ${h} ${c[4].x} ${c[4].y}`,
    edge(c[4], c[5]), `L${c[5].x} ${c[5].y}`,
    `Q${wobble()} ${h + wobble()} ${c[6].x} ${c[6].y}`,
    edge(c[6], c[7]), `L${c[7].x} ${c[7].y}`,
    `Q${wobble()} ${wobble()} ${c[0].x} ${c[0].y}`,
    'Z',
  ].join(' ');
}

/**
 * The ink-spread keyframes and timing for a playful press, ported from
 * `stamp.core.js`'s `landing().spread`: a soft ring that blooms out from the
 * point of contact and fades. Plays once per press; null under reduced
 * motion or quiet's `state` motion, where the press is a plain CSS transition.
 * @param {'still'|'state'|'ambient'|'full'} motion
 */
export function inkSpread(motion) {
  if (motion === 'still' || motion === 'state') return null;
  return {
    frames: [{ opacity: 0.5, transform: 'scale(0.35)' }, { opacity: 0, transform: 'scale(1.5)' }],
    timing: { duration: motion === 'full' ? 480 : 360, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  };
}
