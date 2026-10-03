// Maun: silence, in layers. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/maun.js (read only;
// never edited). A painting is a seeded list of passes (roll or scrape, where,
// what colour, how thin), planned up front, so the same seed always makes the
// same painting; time only says how many passes are down yet. render.js
// applies them to its two canvases, one at a time.

import { rng } from '../../engine/index.js';

export const W = 1200, H = 800;
/** Passes laid per second while the painting makes itself (the plate's pace). */
export const RATE = 3.2;
/** Well past the last pass: the finished painting, for the still. */
export const STILL_TIME = 30;

export const PALETTES = [
  { name: 'turmeric', glow: '#ffe07a', mid: '#f0b73a', paints: ['#d69a24', '#b8741f', '#8c6a2e', '#e3b440'], dark: '#5b3d1a' },
  { name: 'monsoon', glow: '#d6efc9', mid: '#7fb39a', paints: ['#5f8f7a', '#3d5a66', '#6f8a52', '#87b09c'], dark: '#1f3338' },
  { name: 'kokum', glow: '#ffc9a6', mid: '#e0705a', paints: ['#a3324a', '#7a2442', '#c5603c', '#b8465a'], dark: '#3c1024' },
  { name: 'indigo', glow: '#f6f0dc', mid: '#9fb0d6', paints: ['#2d3e6e', '#4f6fa3', '#7b8cb8', '#3a4f86'], dark: '#141c38' },
];
export const PALETTE_NAMES = PALETTES.map(p => p.name);

/**
 * Plan a painting: about thirty passes over a denser zone where the colour
 * gathers, then darker edges and two last scrapes that open the light. Pure.
 * `palette` is a name, or 'seed' to let the seed choose (as the plate did).
 */
export function plan(seed, palette = 'seed') {
  const r = rng(`maun:${seed}`); r();
  const picked = PALETTES[Math.floor(r() * PALETTES.length)];
  const pal = PALETTES.find(p => p.name === palette) ?? picked;
  const passes = [];
  const zone = { y: r.range(0.35, 0.65) * H, h: r.range(140, 260) };
  const n = 30;
  for (let i = 0; i < n; i++) {
    const late = i / n, scrape = i > 6 && r.chance(0.22 + late * 0.12);
    const inZone = r.chance(0.55);
    const h = inZone ? r.range(40, zone.h) : r.range(80, 360);
    const y = inZone ? zone.y + r.gauss() * zone.h * 0.35 : r.range(-60, H + 60);
    const w = r.range(0.7, 1.4) * W, x = r.range(-0.3 * W, W - w * 0.6);
    passes.push({
      kind: scrape ? 'scrape' : 'roll',
      x, y, w, h,
      angle: r.range(-0.045, 0.045),
      color: i < 4 ? pal.mid : r.chance(0.12) ? pal.dark : r.pick(pal.paints),
      alpha: scrape ? r.range(0.25, 0.65) : r.range(0.1, 0.26) * (i < 4 ? 1.6 : 1),
      streak: r.range(0.3, 1),
      seed: r() * 1000,
    });
  }
  // to finish: darken the edges a little, then open the light in the dense zone
  for (const y of [r.range(-40, 40), H + r.range(-40, 40)]) passes.push({ kind: 'roll', x: -0.2 * W, y, w: 1.4 * W, h: r.range(220, 320), angle: r.range(-0.02, 0.02), color: pal.dark, alpha: r.range(0.14, 0.22), streak: 0.5, seed: r() * 1000 });
  for (let k = 0; k < 2; k++) passes.push({ kind: 'scrape', x: r.range(0, 0.3) * W, y: zone.y + r.gauss() * zone.h * 0.2, w: r.range(0.45, 0.75) * W, h: r.range(24, 70), angle: r.range(-0.02, 0.02), color: '#000000', alpha: r.range(0.35, 0.55), streak: 1, seed: r() * 1000 });
  return { pal, passes, zone };
}

const memo = new Map();
/** plan(), memoised per seed and palette. */
export function planOf(seed, palette) {
  const key = `${seed}|${palette}`;
  if (!memo.has(key)) { if (memo.size > 8) memo.delete(memo.keys().next().value); memo.set(key, plan(seed, palette)); }
  return memo.get(key);
}

/** How many passes are down at time t: one at once, then RATE a second. */
export const passesAt = (t, n) => Math.max(0, Math.min(n, Math.floor(t * RATE) + 1));

/** A scrape where a hand touched the painting (playful): a thin band, like the plate's last two. */
export function scrapeAt(x, y, k = 0) {
  return { kind: 'scrape', x: x - 0.28 * W, y, w: 0.56 * W, h: 46, angle: 0.01 * Math.sin(k * 1.7), color: '#000000', alpha: 0.45, streak: 1, seed: 500 + k * 37.1 };
}

/** The breath of light: where it drifts at time t, and how strong once the painting is done. */
export function breathAt(t) {
  return { x: W * (0.5 + 0.28 * Math.sin(t * 0.05)), y: H * (0.45 + 0.12 * Math.cos(t * 0.037)) };
}

/**
 * The per-frame description: the plan, how many passes are down, and where
 * the breath is. Quiet is only ever the finished still.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const p = planOf(seed, params.palette ?? 'seed');
  const done = passesAt(time, p.passes.length);
  const finished = done >= p.passes.length;
  return { time, seed, register, plan: p, done, finished, breath: breathAt(time), settled: register === 'quiet' && finished };
}
