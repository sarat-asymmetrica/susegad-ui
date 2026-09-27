// noise.js: seeded Perlin noise and fBm. Pure.
import { lerp } from './math.js';
import { rng } from './rng.js';

/** @typedef {((x: number, y?: number, z?: number) => number) & { fbm: (x: number, y?: number, z?: number, octaves?: number) => number }} Noise */

/** Seeded 3D Perlin noise, roughly in [-1, 1]. Randomness that flows:
 *  nearby inputs give nearby outputs. Use (x, y, time) for anything that drifts.
 *  @param {number | string} [seed] @returns {Noise} */
export function makeNoise(seed = 1) {
  const r = rng(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y, z) => {
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
  };
  function noise(x, y = 0, z = 0) {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
           lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  }
  /** Fractal (layered) noise: big shapes plus finer detail. */
  noise.fbm = (x, y = 0, z = 0, octaves = 4) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * noise(x * f, y * f, z * f); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  };
  return /** @type {Noise} */ (noise);
}

/** Shared noise field for strokes; pieces offset it with their own seeds. */
export const N = makeNoise(1337);
