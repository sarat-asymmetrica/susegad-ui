// Pahat: the desk at dawn. The pure half.
//
// A window at half past four, over a desk with a laptop and a steel tumbler.
// Outside, the sky goes from indigo to first light: the stars fade, the
// morning star holds on longest, the palms and a neighbour's roof come out
// of the dark, and a few birds cross. Inside, the window's light grows on
// the desk while the laptop's glow stays as it was. Then it rests.

import { rng, clamp, lerp, smoothstep, hexToRgb, TAU } from '../../engine/index.js';

export const W = 1200, H = 800;
export const WIN = { x0: 300, x1: 1000, top: 64, sill: 468 };
export const DESK = 592;

/** How long the dawn takes, per register. Quiet shows the still. */
export const DAWN = { quiet: 0, warm: 26, playful: 14 };
/** The still and the quiet frame: first light, the sky still blue above and warm at the horizon. */
export const STILL_U = 0.8;

/** The sky's colours at stops through the dawn: top and horizon. */
export const SKY = [
  { u: 0, top: '#0f1633', hor: '#1d2750' },
  { u: 0.4, top: '#1d2754', hor: '#4a4476' },
  { u: 0.7, top: '#3d5287', hor: '#c98a78' },
  { u: 1, top: '#8fb0d6', hor: '#f4c48a' },
];
const mixHex = (a, b, t) => { const A = hexToRgb(a), B = hexToRgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); };

/** The sky at dawn fraction u: its top and horizon colours. Pure. */
export function skyAt(u) {
  u = clamp(u);
  let i = 0;
  while (i < SKY.length - 2 && u > SKY[i + 1].u) i++;
  const a = SKY[i], b = SKY[i + 1], t = (u - a.u) / (b.u - a.u);
  return { top: mixHex(a.top, b.top, t), hor: mixHex(a.hor, b.hor, t) };
}

/** Stars for a seed: where they sit and how bright. Memoised. */
const memo = new Map();
export function sky(seed = 1) {
  if (memo.has(seed)) return memo.get(seed);
  const r = rng(`pahat:${seed}`);
  const stars = Array.from({ length: 46 }, () => ({ x: r.range(WIN.x0 + 8, WIN.x1 - 8), y: r.range(WIN.top + 8, WIN.sill - 150), b: r.range(0.3, 1), tw: r() * TAU }));
  const palms = Array.from({ length: 3 }, (_, i) => ({ x: lerp(WIN.x0 + 50, WIN.x1 - 40, (i + r.range(0.15, 0.85)) / 3), h: r.range(190, 290) * (i === 1 ? 0.8 : 1), lean: r.range(-0.22, 0.22), ph: r.range(-0.25, 0.25), fr: r.int(10, 12), seed: r.int(1, 1e6) }));
  const birds = Array.from({ length: 3 }, (_, i) => ({ y: r.range(WIN.top + 60, WIN.top + 200), v: r.range(60, 80), x0: WIN.x0 - 30 - i * r.range(50, 110), s: r.range(5, 7), ph: r() * TAU }));
  const out = { seed, stars, palms, birds, venus: { x: r.range(WIN.x0 + 380, WIN.x1 - 60), y: r.range(WIN.sill - 190, WIN.sill - 140) } };
  if (memo.size > 8) memo.delete(memo.keys().next().value);
  memo.set(seed, out);
  return out;
}

/**
 * The frame at dawn fraction u (from time, or the pointer in playful): sky
 * colours, how visible the stars and the morning star are, how much light
 * falls on the desk, and the birds once it is light enough.
 */
export function dawn(u, t, seed, since = 0) {
  const S = sky(seed), k = clamp(u);
  const birdsIn = smoothstep(0.62, 0.8, k);
  return {
    u: k, sky: skyAt(k),
    stars: 1 - smoothstep(0.25, 0.7, k), venus: 1 - smoothstep(0.82, 1, k),
    land: smoothstep(0.3, 0.95, k), deskLight: smoothstep(0.45, 1, k),
    // a few birds cross once, at first light, and are gone
    birds: birdsIn > 0 ? S.birds.map(b => ({ x: b.x0 + since * b.v, y: b.y + Math.sin(t * 0.5 + b.ph) * 4, s: b.s, flap: Math.sin(t * 5 + b.ph), a: birdsIn })).filter(b => b.x < WIN.x1 + 20) : [],
  };
}

export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const len = DAWN[register] ?? DAWN.warm;
  const u = register === 'quiet' || len === 0 ? STILL_U : clamp(time / len);
  const since = Math.max(0, time - 0.62 * len);
  const f = dawn(u, time, seed, since);
  return {
    seed, time, register, night: sky(seed), ...f,
    // warm rests once the birds have gone; playful stays awake so the pointer can move the dawn
    settled: register === 'quiet' || (register === 'warm' && u >= 1 && f.birds.length === 0),
  };
}
