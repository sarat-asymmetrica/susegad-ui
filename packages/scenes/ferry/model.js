// Ferry: four stops across the Mandovi. The pure half.
//
// The river from a high bank. A route runs from a small jetty on the far
// side (upper left) past two channel posts to a big jetty on the near side
// (lower right), so the ferry grows as it comes to you. Each stop has a lamp:
// stops passed are lit, the current one glows, stops ahead are dark.
//
// The ferry only moves when `step` changes. With `step` absent it idles at
// stop 1, bobbing; it never works through the stops on a timer.

import { rng, clamp, lerp, smoothstep, TAU, catmull, measure, N } from '../../engine/index.js';

export const W = 1200, H = 800;
export const STOPS = 4;
export const HORIZON = 296; // where the far bank meets the water

/** The four stops, as where the ferry's keel sits when moored there. */
export const STOP_AT = [
  { x: 236, y: 348, kind: 'jetty' },
  { x: 488, y: 424, kind: 'post' },
  { x: 716, y: 520, kind: 'post' },
  { x: 928, y: 648, kind: 'jetty' },
];

/** How big things are at a height on the water: small far away, full size near. */
export const scaleAt = y => lerp(0.5, 1.0, clamp((y - 340) / (648 - 340)));

/** The route as a smooth line through the four stops, with a gentle S between them. Pure and memoised. */
let route = null;
export function getRoute() {
  if (route) return route;
  const [a, b, c, d] = STOP_AT;
  const pts = catmull([[a.x, a.y], [356, 376], [b.x, b.y], [606, 464], [c.x, c.y], [822, 578], [d.x, d.y]], 24);
  const m = measure(pts);
  // arc length at each stop, so a position can be given as a stop number with a fraction
  const at = STOP_AT.map(s => {
    let best = 0, bd = Infinity;
    for (let dd = 0; dd <= m.length; dd += 1) { const [x, y] = m.at(dd); const e = Math.hypot(x - s.x, y - s.y); if (e < bd) { bd = e; best = dd; } }
    return best;
  });
  route = { pts, length: m.length, stopAt: at, at: m.at };
  return route;
}

/**
 * Where the ferry is at a route position u (0 = stop 1, 3 = stop 4,
 * fractions between). Returns x, y, heading and scale.
 */
export function ferryAt(u) {
  const R = getRoute(), k = clamp(u, 0, STOPS - 1), i = Math.min(STOPS - 2, Math.floor(k)), f = k - i;
  const d = lerp(R.stopAt[i], R.stopAt[i + 1], f);
  const [x, y, ang] = R.at(d);
  return { x, y, ang, s: scaleAt(y) };
}

/** Seconds a crossing between two neighbouring stops takes, per register. Quiet jumps. */
export const LEG = { quiet: 0, warm: 3.6, playful: 2.0 };

/** Ease a journey from one route position to another over `dur` seconds: a ferry pulls away and eases in. */
export function journey(from, to, since, dur) {
  if (dur <= 0 || since >= dur) return to;
  const t = clamp(since / dur), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return lerp(from, to, e);
}
/** How long a journey takes: each leg its own length of time, capped so a long jump stays calm. */
export const journeyTime = (from, to, register) => (LEG[register] ?? LEG.warm) * Math.min(2.2, Math.max(0.6, Math.abs(to - from)));

/** The ferry's bob at rest: a slow rise and fall and a little roll, in hand-drawn steps. */
export function bob(t, fps) {
  const tt = fps > 0 ? Math.floor(t * fps) / fps : 0;
  return { dy: Math.sin(tt * 1.3) * 1.6 + Math.sin(tt * 0.47 + 1) * 0.9, roll: Math.sin(tt * 0.9 + 0.4) * 0.012 };
}

/** How each register lives on the river. fps is the boil: the water and the bob redraw on twos. */
export const LOOKS = {
  quiet: { fps: 0, kite: false },
  warm: { fps: 7, kite: false },
  playful: { fps: 12, kite: true },
};

/** What the far bank holds for one seed: palms, roofs and the hills behind. Pure, memoised. */
const memo = new Map();
export function bank(seed = 1) {
  if (memo.has(seed)) return memo.get(seed);
  const r = rng(`ferry:${seed}`);
  const hills = Array.from({ length: 5 }, (_, i) => ({ x: i * 290 + r.range(-80, 80), w: r.range(260, 420), h: r.range(34, 70) }));
  // a far bank you could walk along: a band of mango and cashew canopy, palms above it in clumps, roofs among the trees
  const trees = [];
  for (let x = -30; x < W + 40; x += r.range(26, 54)) trees.push({ x, r: r.range(16, 34), h: r.range(6, 22), tone: r() });
  const roofs = [];
  for (let x = r.range(60, 160); x < W - 60; x += r.range(150, 300)) roofs.push({ x, w: r.range(30, 52), h: r.range(12, 18), white: r() < 0.6, deep: r.range(0, 8) });
  const palms = [];
  for (let x = r.range(0, 30); x < W; x += r.range(34, 120)) {
    const clump = r.int(1, 3);
    for (let i = 0; i < clump; i++) palms.push({ x: x + i * r.range(8, 20), h: r.range(46, 92) * (i ? 0.82 : 1), lean: r.range(-0.3, 0.3), fr: r.int(7, 9), ph: r.range(-0.3, 0.3) });
  }
  const people = Array.from({ length: 5 }, () => ({ at: r.range(0.18, 0.62), h: r.range(0.9, 1.08), col: r.int(0, 4) }));
  const kite = { cx: r.range(560, 820), cy: r.range(80, 130), rx: r.range(90, 140), ry: r.range(26, 40), ph: r() * TAU };
  const out = { seed, hills, trees, roofs, palms, people, kite, windPh: r() * TAU };
  if (memo.size > 8) memo.delete(memo.keys().next().value);
  memo.set(seed, out);
  return out;
}

/**
 * The frame: the stop the ferry is going to (1..4), the boil clock, the kite
 * and the far bank. Where it is between stops is the renderer's to ease: it
 * depends on where it was when the page changed its mind.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] ?? LOOKS.warm;
  const set = params.step !== null && params.step !== undefined;
  const target = set ? clamp(Math.round(params.step), 1, STOPS) : 1;
  const b = bank(seed);
  const kite = look.kite ? kiteAt(b.kite, time) : null;
  return {
    seed, time, register, look, bank: b, target, set,
    boil: look.fps > 0 ? Math.floor(time * look.fps) : 0,
    bob: bob(time, look.fps),
    kite,
    // nothing moves in quiet; elsewhere the water boils, so the scene is never settled
    settled: register === 'quiet',
  };
}

/** The kite's place and bank on its slow circle over the river. */
export function kiteAt(k, t) {
  const a = k.ph + t * 0.22;
  return { x: k.cx + Math.cos(a) * k.rx, y: k.cy + Math.sin(a) * k.ry + N(t * 0.1, 3.3) * 6, dir: -Math.sin(a) >= 0 ? 1 : -1, tilt: Math.cos(a) * 0.25, flap: Math.max(0, Math.sin(t * 2.2)) * smoothstep(0.6, 1, Math.sin(t * 0.37)) };
}
