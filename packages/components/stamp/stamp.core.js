// Stamp: the pure core. Runs in Node.
//
// Harvested from a villa booking page's "held" stamp (carveBlock and
// drawStamp): a double-ruled block, a slight tilt, an
// off-register ghost, and ink starvation from speckle plus soft noise patches.
// Here the words stay real DOM text, set by the browser (so Devanagari and
// Kannada shape correctly and assistive tech reads them); only the texture is
// computed, as an alpha mask the skins lay over the frame and the big word.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';

/** The component adds no words of its own: the builder's text is the stamp. */
export const STRINGS = {};

export const TONES = ['accent', 'success', 'warning', 'danger', 'info', 'neutral'];
export const toneOf = v => (TONES.includes(v) ? v : 'accent');

/**
 * The script a run of text is mostly written in. Letter tracking and capitals
 * suit Latin only; spacing out Devanagari or Kannada breaks the headline and
 * the conjuncts, so the CSS keys off this.
 * @param {string} text
 * @returns {'latin'|'devanagari'|'kannada'|'other'}
 */
export function scriptOf(text) {
  const count = { latin: 0, devanagari: 0, kannada: 0, other: 0 };
  for (const ch of text) {
    if (/\p{Script=Latin}/u.test(ch)) count.latin++;
    else if (/\p{Script=Devanagari}/u.test(ch)) count.devanagari++;
    else if (/\p{Script=Kannada}/u.test(ch)) count.kannada++;
    else if (/\p{L}/u.test(ch)) count.other++;
  }
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return best[1] === 0 ? 'latin' : /** @type {any} */ (best[0]);
}

/**
 * How the stamp sits: tilt in degrees and the ghost's offset in px. Quiet sits
 * square; warm tilts a little, as a hand does; playful tilts more.
 * @param {string|number} seed
 * @param {'quiet'|'warm'|'playful'} register
 */
export function stampPose(seed, register) {
  if (register === 'quiet') return { rotate: 0, ghost: { x: 0, y: 0 } };
  const r = rng(`stamp-pose:${seed}`);
  const [lo, hi] = register === 'playful' ? [3, 7] : [1.5, 4];
  const rotate = +(-r.range(lo, hi) * (r.chance(0.8) ? 1 : -1)).toFixed(2);
  const k = register === 'playful' ? 1.4 : 1;
  return { rotate, ghost: { x: +(r.range(1.4, 2.6) * k).toFixed(2), y: +(r.range(0.8, 1.8) * k).toFixed(2) } };
}

/**
 * Ink starvation as an alpha mask: 255 where the block printed, less where it
 * missed. The Casa recipe per unit area: fine speckle, then soft patches
 * from noise in 3px cells. Deterministic for a seed and size.
 * @param {string|number} seed
 * @param {number} w mask width in pixels
 * @param {number} h mask height in pixels
 * @param {{ scale?: number, amount?: number }} [opts] scale: pixels per CSS px;
 *   amount: 1 is the Casa stamp, playful uses a little more
 * @returns {Uint8ClampedArray} w * h alpha values
 */
export function inkMask(seed, w, h, { scale = 1, amount = 1 } = {}) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const a = new Float32Array(w * h).fill(1);
  const r = rng(`stamp-ink:${seed}`);
  const noise = makeNoise(`stamp-ink:${seed}`);
  // speckle: 950 flecks on a 236 × 118 block, so about 0.034 per square CSS px
  const cssArea = (w / scale) * (h / scale);
  const flecks = Math.round(cssArea * 0.034 * amount);
  for (let i = 0; i < flecks; i++) {
    const s = Math.max(1, Math.round(r.range(0.4, 1.5) * scale));
    const x0 = Math.floor(r() * w), y0 = Math.floor(r() * h), keep = 1 - r.range(0.4, 1);
    for (let y = y0; y < Math.min(h, y0 + s); y++) for (let x = x0; x < Math.min(w, x0 + s); x++) a[y * w + x] *= keep;
  }
  // soft patches where the block did not meet the paper
  const cell = Math.max(1, Math.round(3 * scale));
  for (let cy = 0; cy < h; cy += cell) for (let cx = 0; cx < w; cx += cell) {
    const v = noise(cx / scale * 0.035 + 11, cy / scale * 0.05, 4.2);
    const cut = 0.12 / amount;
    if (v <= cut) continue;
    const keep = 1 - Math.min(0.85, (v - cut) * 2.2 * amount);
    for (let y = cy; y < Math.min(h, cy + cell); y++) for (let x = cx; x < Math.min(w, cx + cell); x++) a[y * w + x] *= keep;
  }
  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(a[i] * 255);
  return out;
}

/** The share of the mask that printed, 0..1: a check that the texture never eats the word. */
export function coverage(mask) {
  let s = 0;
  for (const v of mask) s += v;
  return s / (mask.length * 255);
}

/**
 * The landing, as Web Animations keyframes and timing, or null for none.
 * Motion values come from core: 'still' (reduced motion), 'state' (quiet),
 * 'ambient' (warm), 'full' (playful). The rotation is part of every frame so
 * the stamp never snaps square.
 * @param {'still'|'state'|'ambient'|'full'} motion
 * @param {number} rotate degrees
 */
export function landing(motion, rotate = 0) {
  const t = s => `rotate(${rotate}deg) scale(${s})`;
  if (motion === 'still') return null;
  if (motion === 'state') return { frames: [{ opacity: 0 }, { opacity: 1 }], timing: { duration: 120, easing: 'ease-out' } };
  if (motion === 'ambient') {
    return { frames: [{ opacity: 0, transform: t(1.08) }, { opacity: 1, transform: t(1) }], timing: { duration: 220, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' } };
  }
  // full: the block comes down, presses past flat, and settles
  return {
    frames: [
      { opacity: 0, transform: t(1.28), offset: 0 },
      { opacity: 1, transform: t(0.95), offset: 0.55 },
      { opacity: 1, transform: t(1.02), offset: 0.8 },
      { opacity: 1, transform: t(1), offset: 1 },
    ],
    timing: { duration: 380, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
    spread: { frames: [{ opacity: 0.55, transform: 'scale(0.7)' }, { opacity: 0, transform: 'scale(1.35)' }], timing: { duration: 620, delay: 180, easing: 'ease-out' } },
  };
}
