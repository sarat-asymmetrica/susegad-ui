// Chai: three small things. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/chai.js (read only;
// never edited). The steam's curl field and streamlines, the wisp windows,
// the tulsi creeper's geometry and its leaf shape are the plate's own pure
// code, unchanged. The port adds the steam's schedule, the vine's growth, the
// registers and model(). No DOM in any of it.

import { rng, makeNoise, N, clamp, phase, ease, TAU, measure } from '../../engine/index.js';

export const W = 1200, H = 520;
export const INK = '#1d2742';
export const GROUND = 388;
export const GLASS = { cx: 200, top: 240, bottom: GROUND - 2, rt: 52, rb: 40, level: 272 };
export const DIYA = { cx: 574, rim: 342, rx: 76, ry: 36 };
export const SPOUT = [DIYA.cx + DIYA.rx + 20, DIYA.rim - 22];
export const FLAME = { x: SPOUT[0] - 8, y: SPOUT[1] - 4 };
export const VINE = { x0: 830, x1: 1150, y: 356 };


// ── Pure core (the plate's own) ─────────────────────────────────────────────

const field = makeNoise(77);
const FS = 0.011;
/** Curl of a scalar noise potential: a swirling, divergence-free flow. */
export function curl(x, y, t, z) {
  const e = 1, psi = (a, b) => field(a * FS, b * FS + t * 0.22, z + t * 0.1);
  return [(psi(x, y + e) - psi(x, y - e)) / (2 * e * FS), -(psi(x + e, y) - psi(x - e, y)) / (2 * e * FS)];
}
/** Trace a rising streamline through the curl field. */
export function streamline(x, y, t, z, steps = 90, step = 2.2, drift = 0.55) {
  const pts = [[x, y]];
  for (let i = 0; i < steps; i++) {
    const [cx, cy] = curl(x, y, t, z), spread = 0.35 + i / steps;
    let vx = cx * drift * spread, vy = -1 + cy * drift * 0.3;
    const l = Math.hypot(vx, vy) || 1;
    x += (vx / l) * step; y += (vy / l) * step;
    pts.push([x, y]);
  }
  return pts;
}

/** The visible slice of a wisp at `age`: a window sliding up its streamline. */
export function wispWindow(pts, age, life, rate = 38, len = 70) {
  const step = 2.2, head = Math.min(pts.length - 1, Math.floor((age * rate) / step));
  const tail = Math.max(0, head - Math.floor((len * (0.7 + 0.5 * (age / life))) / step));
  return pts.slice(tail, head + 1);
}

export function vineGeometry() {
  const pts = [];
  for (let x = VINE.x0; x <= VINE.x1; x += 4) {
    const u = (x - VINE.x0) / (VINE.x1 - VINE.x0);
    pts.push([x, VINE.y - 6 * Math.sin(u * TAU * 1.6 + 0.4) * (0.4 + 0.6 * u) - 3 * N(u * 3, 5.5)]);
  }
  const stem = measure(pts);
  const r = rng('tulsi'), leaves = [], curls = [];
  let d = 26, side = 1;
  while (d < stem.length - 34) {
    leaves.push({ d, side, len: r.range(22, 28), wid: r.range(12, 15), open: r.range(0.75, 1.15) });
    if (r.chance(0.35)) leaves.push({ d: d + 3, side: -side, len: r.range(15, 19), wid: r.range(9, 11), open: r.range(0.8, 1.2) });
    if (r.chance(0.22)) curls.push({ d: d + 12, side: -side, r: r.range(6, 9) });
    d += r.range(28, 38); side = -side;
  }
  return { stem, leaves, curls };
}
export const VINE_GEO = vineGeometry();

/** Tulsi leaf: ovate, soft point, in local coords along +x. */
export function leafShape(len, wid) {
  const out = [];
  for (let i = 0; i <= 16; i++) { const u = i / 16; out.push([u * len, (wid / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.85)]); }
  for (let i = 15; i > 0; i--) { const u = i / 16; out.push([u * len, -(wid / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 0.85)]); }
  return out;
}
export const place = (pts, x, y, a, s = 1) => pts.map(([px, py]) => [x + (px * Math.cos(a) - py * Math.sin(a)) * s, y + (px * Math.sin(a) + py * Math.cos(a)) * s]);


// ── What the port adds ───────────────────────────────────────────────────────

/** The steam: a wisp born every 0.85 s, each living 4.6 s. Which are alive at t, and how old. */
export const STEAM = { life: 4.6, period: 0.85 };
export function wispsAt(t) {
  const { life, period } = STEAM, out = [];
  const first = Math.max(0, Math.floor((t - life) / period)), last = Math.floor(t / period);
  for (let i = first; i <= last; i++) { const age = t - i * period; if (age >= 0 && age <= life) out.push({ i, age, alpha: Math.pow(Math.sin(Math.PI * (age / life)), 1.2) * 0.62 }); }
  return out;
}

/** How far the creeper has grown along its rule, 0 to 1, a time since it began: 3.4 s, eased. */
export const VINE_DUR = 3.4;
export const vineGrowth = local => ease.inOutSine(phase(local, 0, VINE_DUR));

/** How each register lives: steam and flicker pace, and whether a hand may touch the lamp and the vine. */
export const LOOKS = {
  quiet: { pace: 0, hand: false },
  warm: { pace: 0.8, hand: false },
  playful: { pace: 1, hand: true },
};

/** The plate's still: the steam rising, the lamp lit, the creeper grown and in flower. */
export const STILL_TIME = 6.2;

export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const t = STILL_TIME + (time - STILL_TIME) * (look.pace || 1);
  return { time, t, seed, register, look, lit: params.lit !== false };
}
