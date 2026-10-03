// Carepa: the pure model. A surface is like a scene (a model plus a
// renderer) but hosts no slotted reading zone of its own: whatever sits over
// it (a dialog's card, a drawer's panel) brings its own scrim and text.
//
// Panes are seeded once from a 7x7 grid plus the fan light's wedges,
// deterministic per seed. Sheen is a pure function of a pane's angle to the
// light. No DOM here: this file runs in Node (see carepa.test.js).

import { rng, ellipse, TAU } from '../../engine/index.js';

export const W = 1200, H = 820;
export const WIN = { x: 400, y: 300, w: 400, h: 400 };
export const ARCH = { cx: WIN.x + WIN.w / 2, cy: WIN.y, r: WIN.w / 2 };
export const COLS = 7, ROWS = 7;

const cache = new Map();

/** Every pane of the window: the grid, then the fan light's wedges in two rings. Pure, deterministic per seed. */
export function panes(seed = 1) {
  const key = String(seed);
  if (cache.has(key)) return cache.get(key);
  const out = [], pw = WIN.w / COLS, ph = WIN.h / ROWS, r = rng(seed);
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    out.push({
      kind: 'grid', x: WIN.x + i * pw, y: WIN.y + j * ph, w: pw, h: ph,
      cx: WIN.x + (i + 0.5) * pw, cy: WIN.y + (j + 0.5) * ph,
      seed: r() * 1000, tone: r.range(-1, 1), corner: r.int(0, 3),
    });
  }
  const rings = [[0, 0.46], [0.46, 1]];
  rings.forEach(([r0, r1], ri) => {
    const n = ri ? 7 : 3;
    for (let k = 0; k < n; k++) {
      const a0 = Math.PI + (k / n) * Math.PI, a1 = Math.PI + ((k + 1) / n) * Math.PI;
      const am = (a0 + a1) / 2, rm = (ARCH.r * (r0 + r1)) / 2;
      out.push({
        kind: 'fan', r0: ARCH.r * r0, r1: ARCH.r * r1, a0, a1,
        cx: ARCH.cx + Math.cos(am) * rm, cy: ARCH.cy + Math.sin(am) * rm,
        seed: r() * 1000, tone: r.range(-1, 1), corner: r.int(0, 3),
      });
    }
  });
  cache.set(key, out);
  return out;
}

/** The outline of one pane, in logical units. Pure. */
export function paneShape(p) {
  if (p.kind === 'grid') return [[p.x, p.y], [p.x + p.w, p.y], [p.x + p.w, p.y + p.h], [p.x, p.y + p.h]];
  const a = ellipse(ARCH.cx, ARCH.cy, p.r1, p.r1, { start: p.a0, end: p.a1, n: 12 });
  const b = p.r0 > 0 ? ellipse(ARCH.cx, ARCH.cy, p.r0, p.r0, { start: p.a1, end: p.a0, n: 8 }) : [[ARCH.cx, ARCH.cy]];
  return [...a, ...b];
}

/** Nacre hue for a pane (0..360), from the angle between the pane and the light. Pure. */
export function sheenHue(p, sun) {
  const a = Math.atan2(p.cy - sun.y, p.cx - sun.x) + p.tone * 0.9;
  return ((a / TAU) * 360 * 1.6 + 360 * 4) % 360;
}

/** How near the light this pane is (0..1, falls to 0 by 620 logical units). Pure. */
export function sheenNear(p, sun) {
  const d = Math.hypot(p.cx - sun.x, p.cy - sun.y);
  return Math.max(0, Math.min(1, 1 - d / 620));
}

/** Where the sun sits at `time` when nothing is pointing at it: a slow drift across the top of the window. Pure. */
export function driftSun(time) {
  return { x: ARCH.cx + Math.sin(time * 0.12) * 230, y: 250 + Math.cos(time * 0.09) * 80 };
}

/**
 * The pure model: one frame's worth of plain data. Runs in Node.
 * @param {{ time?: number, seed?: number|string, register?: string, params?: { sun?: {x:number,y:number} } }} args
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const sun = params.sun ?? driftSun(time);
  // playful catches more light: every shell brighter, not just the ones nearest the pointer (brief: "the same, brighter and more of them")
  const brighten = register === 'playful' ? 1.35 : 1;
  const P = panes(seed);
  return {
    sun,
    brighten,
    panes: P.map(p => ({ ...p, hue: sheenHue(p, sun), near: sheenNear(p, sun) })),
  };
}
