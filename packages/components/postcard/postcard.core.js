// Postcard: the pure core. Runs in Node.
//
// A card for a piece of work. The card is native HTML (an article whose
// heading link covers it); computed here are the warm register's postmark,
// the playful register's tilt, and whether the playful card may flip.

import { rng } from '../../engine/src/rng.js';

/** The component adds no words of its own. */
export const STRINGS = {};

const f = v => +v.toFixed(2);

/**
 * The postmark: two rings and four wavy cancellation lines running off to the
 * right below the ring's centre (so, sat on the stamp's lower corner, they
 * pass under the stamp and never across its word), at a slight seeded angle,
 * in a 150 × 64 box. The text (a place and a
 * year) is set by the skin along the ring; the drawing is decoration only.
 * @param {string|number} seed
 * @returns {{ rotate: number, cx: number, cy: number, r: number, waves: string[] }}
 */
export function postmark(seed) {
  const R = rng(`postcard-postmark:${seed}`);
  const cx = 32, cy = 32, r = 26;
  const phase = R.range(0, Math.PI * 2), amp = R.range(1.4, 2.2), len = R.range(10, 14);
  const waves = [0, 1, 2, 3].map(i => {
    const y0 = 38 + i * 6;
    const pts = [];
    for (let x = 52; x <= 148; x += 3) pts.push([x, y0 + Math.sin(phase + (x / len) + i * 0.4) * amp]);
    return `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`;
  });
  return { rotate: f(R.range(-6, 4)), cx, cy, r, waves };
}

/**
 * The playful tilt: a card set down a little crooked, never more than 2.2
 * degrees either way, and never flat.
 * @param {string|number} seed
 */
export function tilt(seed) {
  const R = rng(`postcard-tilt:${seed}`);
  return f((R.chance(0.5) ? 1 : -1) * R.range(0.8, 2.2));
}

/**
 * Whether the playful card may flip to its back on hover and focus: only at
 * full motion (so never under reduced motion) and only where the main pointer
 * can hover. A touch screen shows both faces flat instead.
 * @param {{ motion: string, hover: boolean }} s
 */
export const canFlip = ({ motion, hover }) => motion === 'full' && !!hover;

/**
 * How the status is shown: 'badge' (the default: a level badge on the
 * where-line) or 'stamp' (a rubber stamp in the corner, and in warm a
 * postmark on it). Anything else reads as badge.
 * @param {string|null} v
 */
export const statusStyle = v => (v === 'stamp' ? 'stamp' : 'badge');
