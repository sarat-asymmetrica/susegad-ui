// Stepper: the pure half. The words, and the map the warm and playful skins
// draw: a small noise terrain, stations in its valleys, and a road between
// them found with A* (after the ghat road in the Susegad sketchbook), where
// steep ground costs so much that the road bends round the hills. Runs in Node.

import { rng } from '../../engine/src/rng.js';
import { makeNoise } from '../../engine/src/noise.js';
import { chaikin, measure } from '../../engine/src/geom.js';
import { contours } from '../../engine/src/fields.js';

/** Every word a person reads or hears. Kathakar owns these. */
export const STRINGS = {
  // the step's own title is its legend, read when focus lands there; this line says where you are
  progress: (i, n) => `Step ${i} of ${n}`,
  next: title => (title ? `Next: ${title}` : 'Next'),
  back: 'Back',
};

/** The step to show: always a real one. */
export const clampStep = (i, n) => Math.max(0, Math.min(n - 1, i | 0));

/** The map's box, in SVG units; the skin scales it to the width. */
export const MAP = { W: 640, H: 96, cell: 8, pad: 28 };
const GH = MAP.H / MAP.cell + 1;
/** Grid columns for a map width (snapped to whole cells, 320 to 640 units). */
export const gridW = (W = MAP.W) => Math.round(Math.max(320, Math.min(640, W)) / MAP.cell) + 1;

/** Heights in [-1, 1] on a GW × GH grid: rolling hills, a little higher at the edges. */
export function terrain(seed = 1, GW = gridW()) {
  const nz = makeNoise(`stepper:${seed}`), h = new Float32Array(GW * GH);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const edge = Math.abs(j / (GH - 1) - 0.5) * 0.9;
    h[j * GW + i] = Math.max(-1, Math.min(1, nz.fbm(i * 0.075, j * 0.16, 0.5, 3) * 1.6 + edge));
  }
  return h;
}

/** Stations spread along the map, each dropped into the lowest ground of its band, alternating high and low. */
export function stations(n, h, seed = 1, GW = gridW()) {
  const r = rng(`stations:${seed}`), out = [], W = (GW - 1) * MAP.cell;
  for (let k = 0; k < n; k++) {
    const x = n === 1 ? W / 2 : MAP.pad + (k * (W - 2 * MAP.pad)) / (n - 1);
    const i = Math.round(x / MAP.cell);
    // alternate high and low on the sheet, so each leg has to find its way across
    let best = null;
    const [j0, j1] = k % 2 ? [Math.ceil(GH / 2), GH - 4] : [3, Math.floor(GH / 2) - 1];
    for (let j = j0; j <= j1; j++) {
      const v = h[j * GW + i] + r() * 0.08;
      if (!best || v < best.v) best = { j, v };
    }
    out.push({ i, j: best.j, x: i * MAP.cell, y: best.j * MAP.cell });
  }
  return out;
}

const MOVES = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [1, 2], [1, -2], [-2, 1], [-2, -1], [-1, 2], [-1, -2]];

/** A* from cell a to cell b; climbing costs, steeply more so. Returns grid points. */
export function astar(h, a, b, GW = gridW()) {
  const n = GW * GH, g = new Float32Array(n).fill(Infinity), came = new Int32Array(n).fill(-1), closed = new Uint8Array(n);
  const from = a.j * GW + a.i, to = b.j * GW + b.i, open = [from];
  const f = new Float32Array(n).fill(Infinity);
  const hx = k => Math.hypot((k % GW) - b.i, ((k / GW) | 0) - b.j);
  g[from] = 0; f[from] = hx(from);
  while (open.length) {
    // a small open list: a linear scan is fine at this size and keeps the code short
    let m = 0;
    for (let q = 1; q < open.length; q++) if (f[open[q]] < f[open[m]]) m = q;
    const k = open.splice(m, 1)[0];
    if (k === to) break;
    if (closed[k]) continue;
    closed[k] = 1;
    const i = k % GW, j = (k / GW) | 0;
    for (const [di, dj] of MOVES) {
      const x = i + di, y = j + dj;
      if (x < 0 || y < 1 || x >= GW || y >= GH - 1) continue;
      const q = y * GW + x;
      if (closed[q]) continue;
      const len = Math.hypot(di, dj), grade = Math.abs(h[q] - h[k]) / len;
      const cost = len * (1 + Math.pow(grade * 14, 2)) + (h[q] + 1) * len * 1.8;
      if (g[k] + cost < g[q]) { g[q] = g[k] + cost; f[q] = g[q] + hx(q); came[q] = k; open.push(q); }
    }
  }
  const pts = [];
  for (let k = to; k >= 0; k = came[k]) { pts.push([(k % GW) * MAP.cell, ((k / GW) | 0) * MAP.cell]); if (k === from) break; }
  return pts.reverse();
}

/**
 * The whole map for n steps: contour lines for the hills, the stations, and
 * one smoothed road per leg with its length, so a skin can ink a leg exactly.
 */
export function map(n, seed = 1, { width = MAP.W } = {}) {
  const GW = gridW(width), W = (GW - 1) * MAP.cell, h = terrain(seed, GW), st = stations(n, h, seed, GW);
  const legs = [];
  for (let k = 0; k < n - 1; k++) {
    const pts = chaikin(astar(h, st[k], st[k + 1], GW), 3);
    legs.push({ pts, length: measure(pts).length });
  }
  const lines = [0.05, 0.3, 0.55].flatMap((level, li) =>
    contours(h, GW, GH, level, { cell: MAP.cell }).filter(c => c.pts.length > 4).map(c => ({ level: li, closed: c.closed, pts: chaikin(c.pts, 2, c.closed) })));
  return { W, H: MAP.H, stations: st, legs, contours: lines };
}

/** Footprints along a road: alternate left and right feet, pointing along it. */
export function footprints(pts, { spacing = 11, offset = 2.6 } = {}) {
  const m = measure(pts), out = [];
  for (let d = spacing * 0.6, k = 0; d < m.length - spacing * 0.4; d += spacing, k++) {
    const [x, y, a] = m.at(d), side = k % 2 ? 1 : -1;
    out.push({ x: x - Math.sin(a) * offset * side, y: y + Math.cos(a) * offset * side, angle: (a * 180) / Math.PI, side });
  }
  return out;
}

const r1 = v => Math.round(v * 10) / 10;
/** SVG path data for a polyline. */
export const toD = (pts, closed = false) => `M${pts.map(p => `${r1(p[0])},${r1(p[1])}`).join('L')}${closed ? 'Z' : ''}`;
