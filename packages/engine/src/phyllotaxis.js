// phyllotaxis.js: Vogel's model of a flower head. Pure. Point i sits at angle i × the golden angle and radius
// scale × √i, so the points are evenly dense with no grid and no overlap, and adding a point never moves the
// ones already placed. That makes it honest for a count (37 people, 37 florets) and kind to growth (florets
// arrive one at a time, centre outward, and nothing jumps).
import { TAU } from './math.js';
import { rng, hashSeed } from './rng.js';

/** The golden angle, 137.50776…° in radians, exact. 137.5° leaves faint spokes; this does not. */
export const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** The most a point may be nudged, as a fraction of `scale`. Past about a quarter the no-overlap floor is gone. */
export const JITTER_CAP = 0.2;

/**
 * Points n of Vogel's model, centred on the origin. `i` counts from `start`, so the first k points of
 * vogel(n) are vogel(k) and a head can grow by asking for one more.
 * `jitter` (a fraction of `scale`, capped at JITTER_CAP) nudges each point by a hash of `seed` and its own
 * index, so a point's nudge never depends on how many others there are.
 * @param {number} n
 * @param {{ scale?: number, angle?: number, offset?: number, start?: number, jitter?: number, seed?: number | string }} [o]
 * @returns {{ i: number, x: number, y: number, r: number, theta: number }[]}
 */
export function vogel(n, { scale = 1, angle = GOLDEN, offset = 0, start = 0, jitter = 0, seed = 0 } = {}) {
  const out = [], j = Math.min(Math.max(jitter, 0), JITTER_CAP) * scale, h = hashSeed(seed);
  for (let k = 0; k < n; k++) {
    const i = start + k, theta = i * angle + offset;
    let r = scale * Math.sqrt(i), x = r * Math.cos(theta), y = r * Math.sin(theta);
    if (j > 0 && i > 0) { const g = rng(h + i); x += g.range(-j, j); y += g.range(-j, j); r = Math.hypot(x, y); }
    out.push({ i, x, y, r, theta });
  }
  return out;
}

/** The `scale` that makes `n` points fill a disc of `radius` (the outermost lands just inside it). */
export const fit = (n, radius) => radius / Math.sqrt(Math.max(1, n));

/**
 * How big floret `i` of `n` is, growing from `min` at the centre to `max` at the rim in step with its radius,
 * so the rim florets are the big ones, as on a marigold or a sunflower.
 * @param {number} i @param {number} n @param {{ min?: number, max?: number }} [o]
 */
export function floretSize(i, n, { min = 0.5, max = 1 } = {}) {
  const t = n > 1 ? Math.min(1, Math.max(0, i / (n - 1))) : 1;
  return min + (max - min) * Math.sqrt(t);
}

/**
 * Seeded variation for a head: a small turn of the whole pattern, a jitter within the cap, and (given a
 * range) a count. Never a different angle: an angle off golden is a different, spoked pattern.
 * @param {number | string} seed
 * @param {{ turn?: number, jitter?: number, count?: [number, number] }} [o] turn: the most the head may be turned, in radians
 * @returns {{ offset: number, jitter: number, seed: number | string, count?: number }}
 */
export function variation(seed, { turn = TAU, jitter = 0.1, count } = {}) {
  const g = rng(seed);
  const v = { offset: g.range(0, turn), jitter: Math.min(jitter, JITTER_CAP) * (0.5 + 0.5 * g()), seed };
  if (count) v.count = g.int(count[0], count[1]);
  return v;
}
