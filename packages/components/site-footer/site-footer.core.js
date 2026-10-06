// Site footer: the pure core, shared by <sg-site-footer>. Runs in Node.
//
// A footer is mostly the author's words, so the core owns only what behaviour
// the element adds: the small print's copyright year, which moves forward to
// the clock's year and never backward or into guesswork, plus the seeded
// drawing the warm and playful skins need (the pencil rule under the sign-off,
// the tilt of each stamped link). Seeded, so a footer is drawn the same way
// every visit.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';

export const STRINGS = { label: 'Site footer' };

// ── the small print's year ───────────────────────────────────────────────

/**
 * The first four-digit year in a piece of text ("© 2026", "2026-03-01"), or
 * null. Anything that is not plainly a year between 1900 and 2999 is not one.
 * @param {string|null} text
 * @returns {number|null}
 */
export function yearIn(text) {
  const m = /\b(?:19|20)\d{2}\b/.exec(String(text ?? ''));
  return m ? Number(m[0]) : null;
}

/**
 * The year the small print should show. The clock's year wins only when it is
 * ahead of the year the author wrote (a footer never rolls back, and a year
 * the author wrote ahead keeps). No written year, no change: the element
 * never invents one.
 * @param {number|null} written the year the markup carries
 * @param {number} now the instant to count from, in ms
 * @returns {{ year: number|null, changed: boolean }}
 */
export function yearTo(written, now) {
  if (!Number.isInteger(written) || written < 1900 || written > 2999) return { year: null, changed: false };
  const nowYear = new Date(now).getUTCFullYear();
  return nowYear > written ? { year: nowYear, changed: true } : { year: written, changed: false };
}

// ── the warm pencil rule ─────────────────────────────────────────────────

/**
 * The pencil rule under the sign-off line: a line `w` px wide, drawn twice
 * (the second pass lighter and a touch below, as a pencil does), each pass
 * wandering with seeded noise. Returns two SVG path strings.
 * @param {number} w
 * @param {string|number} seed
 * @param {number} [wobble]
 * @returns {string[]}
 */
export function rulePath(w, seed, wobble = 0.8) {
  if (!(w > 8)) return [];
  const out = [];
  for (let pass = 0; pass < 2; pass++) {
    const n = makeNoise(`footer-rule:${seed}:${pass}`), r = rng(`footer-rule:${seed}:${pass}`);
    const x0 = r.range(-2, 0), x1 = w + r.range(0, 2), drift = r.range(-0.4, 0.4);
    const pts = [];
    for (let x = x0; x <= x1; x += 5) pts.push([x, 4 + drift + n.fbm(x * 0.012, 1 + pass, 0, 3) * (wobble * 6) + pass * 0.8]);
    out.push(`M${pts.map(([x, y]) => `${+x.toFixed(2)} ${+y.toFixed(2)}`).join('L')}`);
  }
  return out;
}

// ── the playful stamps ───────────────────────────────────────────────────

/**
 * The playful register sets each footer link down at its own small angle, as
 * if stamped by hand. Between 0.6 and 2.2 degrees, signed, seeded.
 * @param {string|number} seed
 * @param {number} i the link's place in the row
 * @returns {number}
 */
export function stampTilt(seed, i) {
  const r = rng(`footer-stamp:${seed}:${i}`);
  return +((r.chance(0.5) ? 1 : -1) * r.range(0.6, 2.2)).toFixed(2);
}
