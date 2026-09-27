// Skeleton: the pure half. Placeholder layout, pencil outlines as SVG path
// data, and the busy → arriving → done phases. Runs in Node.

import { rng, hashSeed } from '../../engine/src/rng.js';
import { roughen, ellipse } from '../../engine/src/geom.js';
import { dist } from '../../engine/src/math.js';

/** Every word a person can hear or read. Kathakar owns these. */
export const STRINGS = {
  loading: label => (label ? `Loading ${label}` : 'Loading'),
  loaded: label => (label ? `${cap(label)} loaded` : 'Loaded'),
};
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

export const SHAPES = ['text', 'card', 'list', 'media'];
const BAR = 12, GAP = 12;

/**
 * Placeholder blocks for a shape, in px for a given width.
 * @returns {{ blocks: { x: number, y: number, w: number, h: number, r: number, kind: string }[], height: number }}
 */
export function layout(shape = 'text', { lines = 3, width = 320, seed = 1 } = {}) {
  const r = rng(`skeleton:${seed}`), blocks = [], n = Math.max(1, Math.min(12, lines | 0 || 3));
  const push = (x, y, w, h, rad, kind) => blocks.push({ x, y, w: Math.max(8, Math.round(w)), h, r: rad, kind });
  let y = 0;
  const text = (count, x = 0, w = width) => {
    for (let i = 0; i < count; i++) {
      const last = count > 1 && i === count - 1;
      push(x, y, w * (last ? r.range(0.42, 0.68) : r.range(0.84, 1)), BAR, BAR / 2, 'line');
      y += BAR + GAP;
    }
    y -= GAP;
  };
  if (!SHAPES.includes(shape)) shape = 'text';
  if (shape === 'media' || shape === 'card') {
    const h = Math.round(shape === 'media' ? (width * 9) / 16 : Math.min(width * 0.5, 200));
    push(0, 0, width, h, 6, 'media');
    y = h;
  }
  if (shape === 'card') {
    y += 16; push(0, y, width * r.range(0.45, 0.62), 18, 9, 'title'); y += 18 + 14;
    text(n);
  } else if (shape === 'list') {
    for (let i = 0; i < n; i++) {
      push(0, y, 40, 40, 20, 'circle');
      const w = width - 56;
      push(56, y + 6, w * r.range(0.62, 0.92), BAR, BAR / 2, 'line');
      push(56, y + 24, w * r.range(0.36, 0.62), 10, 5, 'line');
      y += 40 + 16;
    }
    y -= 16;
  } else if (shape === 'text') text(n);
  return { blocks, height: Math.max(0, y) };
}

/** A rounded rectangle as a closed polyline. */
export function rrect(x, y, w, h, rad) {
  rad = Math.min(rad, w / 2, h / 2);
  const out = [], corner = (cx, cy, a0) => {
    for (let i = 0; i <= 5; i++) { const a = a0 + (i / 5) * (Math.PI / 2); out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
  };
  corner(x + w - rad, y + rad, -Math.PI / 2);
  corner(x + w - rad, y + h - rad, 0);
  corner(x + rad, y + h - rad, Math.PI / 2);
  corner(x + rad, y + rad, Math.PI);
  return out;
}

const toD = pts => `M${pts.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L')}Z`;

/**
 * A hand-drawn outline for a block: the shape resampled and nudged by smooth
 * noise, so it wobbles like a pencil line. `pass` gives a second, different line.
 * @returns {{ d: string, length: number }}
 */
export function outline(b, { seed = 1, wobble = 0.6, pass = 0 } = {}) {
  const base = b.kind === 'circle' ? ellipse(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, b.h / 2, { n: 40 }) : rrect(b.x, b.y, b.w, b.h, b.r);
  // numbers (and numeric text) as they are; any other text seed hashed to a number
  const n = Number.isFinite(+seed) ? +seed : hashSeed(String(seed)) % 997;
  const s = n * 7.31 + b.x * 0.013 + b.y * 0.029 + pass * 3.7;
  const pts = wobble > 0 ? roughen(base, { amp: 0.9 * wobble, freq: 0.045, seed: s, step: 4, closed: true }) : base;
  let length = 0;
  for (let i = 0; i < pts.length; i++) length += dist(pts[i], pts[(i + 1) % pts.length]);
  return { d: toD(pts), length };
}

/** Pencil shading across a media block: short diagonal strokes, as path data. */
export function shading(b, { seed = 1, spacing = 7 } = {}) {
  const r = rng(`shade:${seed}:${b.x}:${b.y}`), parts = [];
  for (let o = spacing; o < b.w + b.h; o += spacing * r.range(0.8, 1.25)) {
    const x0 = b.x + Math.max(0, o - b.h), y0 = b.y + Math.min(o, b.h), x1 = b.x + Math.min(o, b.w), y1 = b.y + Math.max(0, o - b.w);
    const k0 = r.range(0.08, 0.2), k1 = r.range(0.08, 0.2);
    parts.push(`M${(x0 + (x1 - x0) * k0).toFixed(1)},${(y0 + (y1 - y0) * k0).toFixed(1)}L${(x1 - (x1 - x0) * k1).toFixed(1)},${(y1 - (y1 - y0) * k1).toFixed(1)}`);
  }
  return parts.join('');
}

/**
 * The phase after a change of `busy`. Content only arrives once, and the
 * ink-in plays only when it really arrives and motion is allowed.
 * @param {'busy'|'arriving'|'done'|null} prev
 */
export function nextPhase(prev, busy, motion = 'ambient') {
  if (busy) return 'busy';
  if (prev === 'busy' && motion !== 'still') return 'arriving';
  return 'done';
}
