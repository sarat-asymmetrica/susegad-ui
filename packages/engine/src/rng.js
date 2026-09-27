// rng.js: seeded randomness. Pure. Same seed, same drawing, every time.
import { TAU } from './math.js';

/** Hash a number or string seed to a uint32. Numbers keep three decimals.
 *  @param {number | string} s @returns {number} */
export function hashSeed(s) {
  if (typeof s === 'number') return Math.imul((s * 1000) | 0, 2654435761) >>> 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/**
 * @typedef {(() => number) & {
 *   range: (lo: number, hi: number) => number, int: (lo: number, hi: number) => number,
 *   pick: <T>(arr: T[]) => T, chance: (p: number) => boolean, sign: () => number, gauss: () => number
 * }} Rng  Call it for a float in [0, 1). `int` is inclusive of both ends.
 */

/** Deterministic PRNG (mulberry32). @param {number | string} [seed] @returns {Rng} */
export function rng(seed = 1) {
  let a = hashSeed(seed);
  const r = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  r.sign = () => (r() < 0.5 ? -1 : 1);
  r.gauss = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r()); };
  return /** @type {Rng} */ (r);
}
