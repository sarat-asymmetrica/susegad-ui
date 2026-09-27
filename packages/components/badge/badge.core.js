// Badge: the pure core. Runs in Node.
//
// A badge is a word or two of status ("Paid", "Draft", "Saving"). The word
// carries the meaning; a shape per tone backs it up for anyone who cannot
// tell the colours apart; colour comes last.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';

/** The component adds no words of its own: the builder's text is the badge. */
export const STRINGS = {};

export const TONES = ['neutral', 'accent', 'success', 'warning', 'danger', 'info'];
export const toneOf = v => (TONES.includes(v) ? v : 'neutral');

/**
 * One shape per tone, as SVG path data on a 12 × 12 grid, filled with the
 * even-odd rule. Every shape differs in outline, not only in colour.
 */
export const ICONS = {
  neutral: 'M6 1.6a4.4 4.4 0 1 0 0 8.8a4.4 4.4 0 1 0 0-8.8zM6 3.2a2.8 2.8 0 1 1 0 5.6a2.8 2.8 0 1 1 0-5.6z', // a ring
  accent: 'M6 1.2L10.8 6L6 10.8L1.2 6z', // a diamond
  success: 'M1.6 6.3L2.9 5L4.9 7L9.1 2.8L10.4 4.1L4.9 9.6z', // a tick
  warning: 'M6 .9L11.4 10.7H.6zM5.3 4.3v3.3h1.4V4.3zM5.3 8.3v1.3h1.4V8.3z', // a triangle with a bar
  danger: 'M3 1.6L6 4.6L9 1.6L10.4 3L7.4 6L10.4 9L9 10.4L6 7.4L3 10.4L1.6 9L4.6 6L1.6 3z', // a cross
  info: 'M6 .8a5.2 5.2 0 1 0 0 10.4a5.2 5.2 0 1 0 0-10.4zM5.3 5v4.1h1.4V5zM5.3 2.7V4h1.4V2.7z', // a circled i
};

/** The icon as a data URL, for a CSS mask. */
export const iconUrl = tone =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'><path fill-rule='evenodd' d='${ICONS[toneOf(tone)]}'/></svg>`)}")`;

/** Mostly Latin, Devanagari or Kannada (see Stamp for why this matters). */
export function scriptOf(text) {
  const count = { latin: 0, devanagari: 0, kannada: 0, other: 0 };
  for (const ch of text) {
    if (/\p{Script=Latin}/u.test(ch)) count.latin++;
    else if (/\p{Script=Devanagari}/u.test(ch)) count.devanagari++;
    else if (/\p{Script=Kannada}/u.test(ch)) count.kannada++;
    else if (/\p{L}/u.test(ch)) count.other++;
  }
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return best[1] === 0 ? 'latin' : best[0];
}

/**
 * A hand-inked rounded rectangle: the outline resampled every few pixels and
 * nudged along its normal by seeded noise, and closed with a small overlap,
 * the way a pen comes back past where it started. Two passes, the second
 * finer and offset, like a nib going round twice.
 * @param {number} w
 * @param {number} h
 * @param {string|number} seed
 * @param {{ radius?: number, wobble?: number, inset?: number }} [opts]
 * @returns {{ d: string[], points: number[][][] }}
 */
export function inkOutline(w, h, seed, { radius = 5, wobble = 0.8, inset = 1.5 } = {}) {
  const x0 = inset, y0 = inset, x1 = w - inset, y1 = h - inset;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  // the ideal outline, clockwise from the top-left corner's end
  const ideal = [];
  const arc = (cx, cy, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (i / 6) * (Math.PI / 2); ideal.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
  const edge = (ax, ay, bx, by) => {
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 4));
    for (let i = 1; i < n; i++) ideal.push([ax + ((bx - ax) * i) / n, ay + ((by - ay) * i) / n]);
  };
  ideal.push([x0 + r, y0]); edge(x0 + r, y0, x1 - r, y0);
  arc(x1 - r, y0 + r, -Math.PI / 2); edge(x1, y0 + r, x1, y1 - r);
  arc(x1 - r, y1 - r, 0); edge(x1 - r, y1, x0 + r, y1);
  arc(x0 + r, y1 - r, Math.PI / 2); edge(x0, y1 - r, x0, y0 + r);
  arc(x0 + r, y0 + r, Math.PI);
  const cx = w / 2, cy = h / 2;
  const passes = [];
  for (let pass = 0; pass < 2; pass++) {
    const noise = makeNoise(`badge-ink:${seed}:${pass}`);
    const R = rng(`badge-ink:${seed}:${pass}`);
    const amp = wobble * (pass ? 0.7 : 1);
    const pts = ideal.map(([x, y], i) => {
      // push outward from the centre, so the wobble reads as the pen, not a dent
      const dx = x - cx, dy = y - cy, len = Math.hypot(dx, dy) || 1;
      const k = noise(i * 0.18, pass * 7.3) * amp + (pass ? 0.35 : 0);
      return [x + (dx / len) * k, y + (dy / len) * k];
    });
    // overlap: run a few points past the start
    const over = 2 + R.int(0, 2);
    for (let i = 1; i <= over; i++) pts.push(pts[i]);
    passes.push(pts);
  }
  const f = v => +v.toFixed(2);
  return { d: passes.map(p => `M${p.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}`), points: passes };
}

/**
 * The playful motif: a tiny kolam flower, four petal loops drawn round a
 * centre dot, on a 12 × 12 grid. It sits on the chip's corner like a sticker,
 * so it reads as ornament and never as a button.
 */
export const MOTIF = {
  centre: [6, 6],
  petals: [[6, 3.2], [8.8, 6], [6, 8.8], [3.2, 6]].map(([x, y]) => {
    // a teardrop from the centre out to (x, y) and back
    const dx = x - 6, dy = y - 6, nx = -dy * 0.62, ny = dx * 0.62;
    const f = v => +v.toFixed(2);
    return `M6 6C${f(6 + dx * 0.3 + nx)} ${f(6 + dy * 0.3 + ny)} ${f(x + dx * 0.9 + nx * 0.8)} ${f(y + dy * 0.9 + ny * 0.8)} ${f(x + dx * 0.55)} ${f(y + dy * 0.55)}C${f(x + dx * 0.9 - nx * 0.8)} ${f(y + dy * 0.9 - ny * 0.8)} ${f(6 + dx * 0.3 - nx)} ${f(6 + dy * 0.3 - ny)} 6 6z`;
  }),
};

/** Busy motion by component motion value, as WAAPI keyframes and timing, or null. */
export function busyMotion(motion) {
  if (motion === 'still' || motion === 'state') return null; // quiet and reduced motion: a still mark, the word says it
  if (motion === 'ambient') return { frames: [{ opacity: 1 }, { opacity: 0.4 }], timing: { duration: 1400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' } };
  return { frames: [{ transform: 'rotate(0turn)' }, { transform: 'rotate(1turn)' }], timing: { duration: 2400, iterations: Infinity, easing: 'linear' } };
}
