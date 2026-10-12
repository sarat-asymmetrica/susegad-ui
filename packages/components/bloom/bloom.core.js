// Bloom: the pure core. Runs in Node.
//
// A flower head laid out by Vogel's model (engine/phyllotaxis.js): floret i at i × the golden angle and radius
// scale × √i. Because adding a floret never moves the ones already placed, a count can be drawn honestly, a head
// can grow one floret at a time, and nothing jumps. Everything here is data: where each floret goes, how it is
// turned and tinted, and the words that go with the picture. The skins turn it into SVG.
//
// Zendu (the marigold) is the first kind. Its palette and petal reading are toran's drawMarigold: ruffled
// petals in rings from the rim inward, darker and redder at the rim, lighter and yellower at the heart, each
// laid over a dark crevice so the head reads as a crumpled pompom, lit from the upper left.

import { vogel, floretSize, variation, rng, lerp, clamp } from '../../engine/index.js';

/** The most florets a bloom draws. A count bigger than this is a number, not a flower. */
export const CAP = 400;
/** A full head: the count drawn when none is given, and the size the head is laid out for. A Fibonacci number. */
export const FULL = 144;
/** The head's half-width in user units; the SVG's viewBox is -R -R 2R 2R. */
export const R = 100;
export const KINDS = ['zendu'];
/** How long the whole growth may take, first floret to last start, in ms; and the longest gap between florets. */
export const GROW_TOTAL_MS = 1100;
export const GROW_STEP_MS = 22;

/** The gap between florets for a head of n, so a big head grows in the same time as a small one. */
export const growStep = n => Math.min(GROW_STEP_MS, GROW_TOTAL_MS / Math.max(1, n));

/** An attribute value to a whole number of 0 or more, or null when there is no usable number. The number is said as written; plan() draws at most CAP florets. */
export function countOf(v) {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

/** The seed a bloom hashes: seed-from (a name, say), then seed, then a plain default. */
export const seedOf = (seedFrom, seed) => [seedFrom, seed].map(s => (s ?? '').trim()).find(Boolean) ?? 'bloom';

/** `size` as a CSS length: a number is pixels, the words sm, md and lg are rems, anything else a length as written. */
export function sizeOf(v) {
  const s = (v ?? '').trim().toLowerCase();
  if (s === 'sm') return '4rem';
  if (s === 'md' || s === '') return '8rem';
  if (s === 'lg') return '14rem';
  if (/^\d+(\.\d+)?$/.test(s)) return `${s}px`;
  return /^\d+(\.\d+)?(px|rem|em|ch|vw|vh|%)$/.test(s) ? s : '8rem';
}

/**
 * What the picture is to assistive technology, decided in one place. The words come first: text the author wrote
 * inside the element, or the number (and label) the element writes itself when `count` is set. A picture of
 * those words is hidden. A picture that stands for something with no number gets its label. A picture with
 * neither is decoration.
 * @param {{ count: number | null, label: string, hasText: boolean }} s
 * @returns {{ text: string, role: 'none' | 'img', name: string }} text: what the element writes beside the picture ('' when none)
 */
export function describe({ count, label, hasText }) {
  const l = (label ?? '').trim();
  if (hasText) return { text: '', role: 'none', name: '' };
  if (count !== null) return { text: l ? `${count} ${l}` : String(count), role: 'none', name: '' };
  return l ? { text: '', role: 'img', name: l } : { text: '', role: 'none', name: '' };
}

// ── zendu ─────────────────────────────────────────────────────────────────

// toran's two marigold families (packages/scenes/toran/render.js). h, s and l are ranges in degrees and percent.
const HUES = {
  orange: { h: [18, 28], s: [82, 92], l: [40, 57], rim: '#7a2a06' },
  saffron: { h: [34, 42], s: [85, 95], l: [46, 62], rim: '#8a4a05' },
};
const r2 = v => Math.round(v * 100) / 100;
const hsl = (h, s, l) => `hsl(${r2(h)} ${r2(s)}% ${r2(l)}%)`;

/**
 * One ruffled petal pointing up (-y) from its base at the origin, length 1: a narrow claw opening into a fan
 * whose rim is a row of rounded frills. toran's petalShape, as an SVG path. `k`, `dx`, `dy` shift and swell it
 * for the crevice drawn beneath.
 */
export function petalPath(frill, spread, k = 1, dx = 0, dy = 0) {
  const rim = [], at = (x, y) => `${r2(x * k + dx)} ${r2(y * k + dy)}`;
  for (let j = 0; j <= frill; j++) {
    const a = lerp(-spread, spread, j / frill) - Math.PI / 2;
    rim.push([Math.cos(a) * 0.8, 0.12 + Math.sin(a)]);
  }
  let d = `M${at(-0.1, 0)}L${at(rim[0][0], rim[0][1] + 0.18)}L${at(...rim[0])}`;
  for (let j = 1; j <= frill; j++) {
    const [x0, y0] = rim[j - 1], [x1, y1] = rim[j], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, l = Math.hypot(mx, my - 0.12) || 1;
    d += `Q${at(mx + (mx / l) * 0.22, my + ((my - 0.12) / l) * 0.22)} ${at(x1, y1)}`;
  }
  return `${d}L${at(rim[frill][0], rim[frill][1] + 0.18)}L${at(0.1, 0)}Z`;
}

const petalCache = new Map();
/** The petal and its crevice for a frill count (3 to 5) and a spread step (0 to 2). Cached: a head reuses a handful. */
export function petalOf(frill, step) {
  const key = frill * 10 + step;
  if (!petalCache.has(key)) {
    const spread = 0.6 + step * 0.15;
    petalCache.set(key, { d: petalPath(frill, spread), crevice: petalPath(frill, spread, 1.08, 0.02, 0.03) });
  }
  return petalCache.get(key);
}

const L_STEP = 3, H_STEP = 3;
/** Florets from the centre that lean inward. */
const HEART = 5;
/** A tone quantised to a handful of buckets, so a head of 400 petals shares a few dozen gradients. */
const bucket = (h, l, H0) => {
  const hq = Math.round(h / H_STEP) * H_STEP, lq = Math.round(l / L_STEP) * L_STEP;
  return { id: `${hq}-${lq}`, h: hq, l: lq, s: (H0.s[0] + H0.s[1]) / 2 };
};

/** The three stops of a petal's gradient, base to tip, for a bucket: darker at the claw, lighter at the frill. */
export const gradientStops = g => [
  [0, hsl(g.h - 3, g.s, g.l - 12)], [0.7, hsl(g.h, g.s, g.l)], [1, hsl(g.h + 3, g.s, Math.min(78, g.l + 8))],
];

/**
 * Lay out a head.
 * @param {{ kind?: string, count?: number, seed?: string | number, mode?: 'zendu' | 'dots' }} [o]
 * @returns {{ n: number, kind: string, mode: string, scale: number, reach: number, family: string, rim: string, ground: string, heart: string,
 *   florets: { i: number, x: number, y: number, rot: number, len: number, size: number, ring: boolean, ph: number, d?: string, crevice?: string, grad?: { id: string, h: number, s: number, l: number } }[],
 *   grads: Map<string, { id: string, h: number, s: number, l: number }> }}
 */
export function plan({ kind = 'zendu', count = FULL, seed = 'bloom', mode = 'zendu' } = {}) {
  const n = clamp(Math.round(count), 0, CAP);
  const k = KINDS.includes(kind) ? kind : 'zendu';
  const s = String(seed);
  const big = Math.max(n, FULL);
  // one scale for every head up to a full one, so a head of 37 is a smaller head, not the same head with huge florets;
  // past a full head the florets get finer and the head stays the same size
  const scale = (R * 0.97) / (Math.sqrt(big - 1) + 4.1);
  const v = variation(`bloom:${k}:${s}`, { jitter: 0.08 });
  const rnd = rng(`bloom:${k}:${s}:florets`);
  const family = rnd.chance(0.5) ? 'orange' : 'saffron', H0 = HUES[family];
  const pts = vogel(n, { scale, offset: v.offset, jitter: v.jitter, seed: `bloom:${k}:${s}` });
  const grads = new Map(), florets = [];
  const ringFrom = Math.floor(n * 0.7);
  for (const p of pts) {
    const size = floretSize(p.i, FULL, { min: 0.85, max: 1.15 });
    const f = { i: p.i, x: r2(p.x), y: r2(p.y), rot: 0, len: 0, size, ring: p.i >= ringFrom && n >= 8, ph: p.i % 6 };
    if (mode === 'dots') { f.len = r2(scale * 0.42 * size); florets.push(f); continue; }
    // the heart folds in: the first few petals lean toward the centre and close it, the rest open outward
    const a = p.theta + (p.i < HEART ? Math.PI : 0) + rnd.range(-0.35, 0.35);
    const frill = rnd.int(3, 5), step = rnd.int(0, 2), petal = petalOf(frill, step);
    // depth: 0 at the rim, 1 at the heart, as toran's rings; the lighter the nearer the heart
    const depth = 1 - Math.min(1, p.i / (FULL - 1));
    const l = lerp(H0.l[0], H0.l[1], Math.min(1, depth * 0.75 + rnd() * 0.35)) + (rnd() - 0.5) * 2;
    const g = bucket(rnd.range(H0.h[0], H0.h[1]), l, H0);
    grads.set(g.id, g);
    Object.assign(f, { rot: r2((a * 180) / Math.PI + 90), len: r2(scale * 3 * size * rnd.range(0.85, 1.15) * (p.i < HEART ? 1.3 : 1)), d: petal.d, crevice: petal.crevice, grad: g });
    florets.push(f);
  }
  const reach = n ? Math.max(scale * 1.2, ...florets.map(f => (mode === 'dots' ? Math.hypot(f.x, f.y) + f.len : Math.hypot(f.x, f.y) + f.len * 0.9))) : scale * 1.2;
  return { n, kind: k, mode, scale: r2(scale), reach: r2(Math.min(R, reach)), family, rim: H0.rim, ground: hsl(H0.h[0] - 4, 75, 22), heart: hsl(H0.h[1] + 2, 80, 40), florets, grads };
}
