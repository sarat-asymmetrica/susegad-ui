// Rampon: dusk on the Goan shore. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/rampon.js (read
// only; never edited). makeScene(seed) decides everything about one evening
// (palms, sun, boat, birds) and is unchanged from the source: it was already
// pure. render.js owns the canvas, the sea's per-frame boil, and now the koel.
// Trimmed from the plate for the library port: the headland and the sand's
// stipple and tide lines are left out (decoration, not the scene's
// identity); the sea, shore, palms, boat and birds are the same techniques.

import { rng, N, clamp, lerp, TAU } from '../../engine/index.js';

export const W = 1200, H = 800;

/**
 * How each register lives in this evening. quiet is a single still (no
 * boil, no wind, no birds in flight); warm boils gently, at half the frame
 * rate, with the palms swaying and a few birds; playful is the full plate,
 * boiling at 12fps with more birds, and (via `interactive` in index.js) a
 * click reseeds a new evening.
 */
export const LOOKS = {
  quiet: { fps: 0, wind: 0, birds: 0 },
  warm: { fps: 7, wind: 0.7, birds: 0.6 },
  playful: { fps: 12, wind: 1, birds: 1 },
};

/** A named random stream for a seed, matching the plate's own naming. */
const sk = (seed, name) => `${name}:${seed}`;

/** Everything about one evening: palms, sun, boat, birds. Pure, and memoised per seed. */
export function makeScene(seed) {
  const r = rng(sk(seed, 'rampon'));
  const warm = r.pick(['#e2a126', '#d6543a', '#e8872c', '#dc6a32']);
  const horizon = r.range(385, 450);
  const side = r.sign(); // which side the palms stand on
  const sunR = r.range(30, 46);
  const sun = { x: side < 0 ? r.range(600, 920) : r.range(280, 600), r: sunR };
  sun.y = horizon - r.range(-0.35, 1.7) * sunR;
  const shore = r.range(645, 690);

  const palms = [];
  const count = r.int(2, 3), base = side < 0 ? r.range(40, 200) : r.range(1000, 1160);
  for (let i = 0; i < count; i++) {
    const k = i === 0 ? r.range(0.95, 1.1) : r.range(0.6, 0.82);
    let edge = base + side * i * r.range(95, 175) + (i ? r.range(-20, 20) : 0);
    const h = r.range(470, 600) * k;
    const lean = -side * (i ? r.range(0.02, 0.3) : r.range(0.2, 0.42));
    if (edge + lean * h < 70 || edge + lean * h > W - 70) edge = base - side * r.range(120, 200);
    const nF = r.int(10, 13);
    palms.push({
      id: (typeof seed === 'number' ? seed : seed.length) * 10 + i, k, x: edge, y: r.range(815, 850), h,
      lean, bend: r.range(-0.06, 0.06), w: 17 * k,
      fronds: Array.from({ length: nF }, (_, j) => ({
        i: j, a: lerp(-Math.PI - 0.55, 0.55, (j + r.range(-0.3, 0.3)) / (nF - 1)),
        len: r.range(0.72, 1.05) * 150 * k, droop: r.range(0.5, 0.85),
      })),
      nuts: r.int(3, 5),
    });
  }
  palms.sort((a, b) => a.k - b.k);

  const u = r.range(0.3, 0.8);
  const boat = {
    x: side < 0 ? r.range(640, 960) : r.range(240, 560),
    y: lerp(horizon + 14, shore - 18, u), s: lerp(0.6, 1.1, u), dir: r.sign(), phase: r() * TAU,
  };
  const birdsAll = Array.from({ length: r.int(3, 6) }, () => ({
    x0: r() * W, y: r.range(horizon * 0.22, horizon * 0.7), v: r.range(6, 15) * r.sign(),
    s: r.range(5, 9), flap: r.range(4, 6.5), ph: r() * TAU,
  }));
  return {
    seed, warm, horizon, side, sun, shore, palms, boat, birdsAll,
    skyTone: r.range(0.35, 0.85), windDir: -side,
  };
}

const memo = new Map();
/** makeScene, memoised: the same seed always returns the same object. */
export function scene(seed = 1) {
  if (!memo.has(seed)) {
    if (memo.size > 8) memo.delete(memo.keys().next().value);
    memo.set(seed, makeScene(seed));
  }
  return memo.get(seed);
}

/** How far a palm leans into the wind at time t, scaled by the register's wind. Pure. */
export function palmSway(p, t, S, wind) {
  return wind === 0 ? 0 : (0.55 + 0.45 * N(t * 0.22, p.id * 2.3, S.seed)) * 0.06 * wind * S.windDir
    + 0.02 * N(t * 1.1, p.id * 4.1, 3.3) * wind * S.windDir;
}

/** The birds actually on screen this register: a fraction of the seed's full flock. */
export function visibleBirds(S, birdsFactor) {
  return S.birdsAll.slice(0, Math.round(S.birdsAll.length * clamp(birdsFactor)));
}

/**
 * A bird's x position at time t, wrapping smoothly off both edges. Pure and
 * shared: render.js draws from it, and the koel soundscape (which needs no
 * hook into the renderer at all, unlike Paus's rain) calls it to know when a
 * bird is actually crossing the sky.
 */
export function birdX(bird, t) {
  return (((bird.x0 + t * bird.v) % (W + 200)) + W + 200) % (W + 200) - 100;
}

/**
 * The per-frame description: which evening, how the register lives in it,
 * and the wind/bird factors render.js scales its own time-varying drawing by.
 */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const S = scene(seed);
  return { seed, time, register, look, S, birds: visibleBirds(S, look.birds) };
}
