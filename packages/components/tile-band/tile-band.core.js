// Tile band: the pure core. Runs in Node.
//
// A band of hand-painted tiles for a border or a divider, in the tradition of
// Goa's azulejo (the blue-and-white tiles of its Portuguese-era houses) and its
// majolica cousin (cobalt, lemon yellow and leaf green). Four motifs, geometric
// and floral only: a rosette, a quatrefoil, quarter-circle corners and a vine.
// Everything here is data: path strings in a 100 by 100 box, a seeded layout, a
// turn's easing. The painter in skins/ turns it into pixels.

import { rng } from '../../engine/src/rng.js';

export const MOTIFS = ['rosette', 'quatrefoil', 'corner', 'vine'];
export const TONES = ['azulejo', 'majolica'];
/** How long a tile takes to turn a quarter, and the pause before the same tile may turn again. */
export const TURN_MS = 520;
export const TURN_COOLDOWN_MS = 160;

const r2 = n => +n.toFixed(2);
const rad = deg => (deg * Math.PI) / 180;

/** A circle as a closed path. */
const circle = (cx, cy, r) => `M${r2(cx + r)} ${r2(cy)}A${r} ${r} 0 1 0 ${r2(cx - r)} ${r2(cy)}A${r} ${r} 0 1 0 ${r2(cx + r)} ${r2(cy)}Z`;

/** A petal or leaf: a lens from (cx, cy) `from` away along `deg` to `to` away, `w` wide at its belly. */
function petal(cx, cy, deg, from, to, w) {
  const a = rad(deg), ux = Math.cos(a), uy = Math.sin(a), px = -uy, py = ux;
  const p = d => [cx + ux * d, cy + uy * d];
  const [bx, by] = p(from), [tx, ty] = p(to), [mx, my] = p((from + to) / 2);
  return `M${r2(bx)} ${r2(by)}Q${r2(mx + px * w * 2)} ${r2(my + py * w * 2)} ${r2(tx)} ${r2(ty)}Q${r2(mx - px * w * 2)} ${r2(my - py * w * 2)} ${r2(bx)} ${r2(by)}Z`;
}
const range = (n, f) => Array.from({ length: n }, (_, i) => f(i));
/** A quarter disc of radius r in a corner of the tile. */
const fan = (corner, r) => ({
  tl: `M0 0H${r}A${r} ${r} 0 0 1 0 ${r}Z`, tr: `M100 0V${r}A${r} ${r} 0 0 1 ${100 - r} 0Z`,
  br: `M100 100H${100 - r}A${r} ${r} 0 0 1 100 ${100 - r}Z`, bl: `M0 100V${100 - r}A${r} ${r} 0 0 1 ${r} 100Z`,
})[corner];

/**
 * A layer is one thing the brush does: `d` is a path in the 100 by 100 tile, `mode` is 'fill'
 * (filled, then outlined in ink) or 'stroke' (a line of `w` units), and `role` says which
 * pigment: 'blue' (cobalt), 'wash' (a pale cobalt wash), 'lemon' and 'leaf' (the majolica
 * pigments, which a blue-and-white tile paints as wash and blue), 'ground' (the glaze) or
 * 'ink' (cobalt line).
 * @typedef {{ d: string, mode: 'fill'|'stroke', role: string, w?: number }} Layer
 */

/** @returns {Layer[]} */
const LAYERS = {
  rosette: () => [
    ...['tl', 'tr', 'br', 'bl'].map(c => ({ d: fan(c, 17), mode: 'fill', role: 'wash' })),
    { d: circle(50, 50, 44), mode: 'stroke', role: 'ink', w: 1.1 },
    ...range(8, k => ({ d: petal(50, 50, k * 45 + 22.5, 9, 40, 7), mode: 'fill', role: 'blue' })),
    ...range(8, k => ({ d: petal(50, 50, k * 45, 8, 26, 4.2), mode: 'fill', role: 'wash' })),
    { d: circle(50, 50, 8), mode: 'fill', role: 'lemon' },
    { d: circle(50, 50, 2.6), mode: 'fill', role: 'blue' },
    ...[[9, 9], [91, 9], [91, 91], [9, 91]].map(([x, y]) => ({ d: circle(x, y, 2.4), mode: 'fill', role: 'blue' })),
  ],
  quatrefoil: () => [
    ...[[18, 18], [82, 18], [82, 82], [18, 82]].map(([x, y]) => ({ d: `M${x} ${y}L${x + (x < 50 ? 14 : -14)} ${y + (y < 50 ? 14 : -14)}`, mode: 'stroke', role: 'ink', w: 1.4 })),
    ...[[50, 33], [67, 50], [50, 67], [33, 50]].map(([x, y]) => ({ d: circle(x, y, 17), mode: 'fill', role: 'blue' })),
    ...[[50, 33], [67, 50], [50, 67], [33, 50]].map(([x, y]) => ({ d: circle(x, y, 8.5), mode: 'fill', role: 'wash' })),
    { d: 'M50 38L62 50L50 62L38 50Z', mode: 'fill', role: 'lemon' },
    ...[[11, 11], [89, 11], [89, 89], [11, 89]].map(([x, y]) => ({ d: circle(x, y, 5), mode: 'fill', role: 'lemon' })),
    ...[[11, 11], [89, 11], [89, 89], [11, 89]].map(([x, y]) => ({ d: circle(x, y, 1.8), mode: 'fill', role: 'blue' })),
  ],
  corner: () => [
    { d: fan('tl', 47), mode: 'fill', role: 'blue' },
    { d: fan('tl', 37), mode: 'fill', role: 'ground' },
    { d: fan('tl', 27), mode: 'fill', role: 'wash' },
    { d: fan('tl', 17), mode: 'fill', role: 'blue' },
    { d: fan('tl', 8), mode: 'fill', role: 'lemon' },
    { d: fan('br', 27), mode: 'fill', role: 'blue' },
    { d: fan('br', 19), mode: 'fill', role: 'wash' },
    { d: fan('br', 10), mode: 'fill', role: 'lemon' },
    { d: circle(50, 50, 4.5), mode: 'fill', role: 'lemon' },
    { d: circle(76, 24, 3), mode: 'fill', role: 'blue' },
    { d: circle(24, 76, 3), mode: 'fill', role: 'blue' },
  ],
  vine: () => [
    { d: 'M0 50C22 20 38 20 50 50S78 80 100 50', mode: 'stroke', role: 'ink', w: 3.4 },
    ...[[24, 36, -75, 20], [41, 27, -25, 17], [59, 73, 105, 20], [76, 64, 155, 17]].map(([x, y, a, l]) => ({ d: petal(x, y, a, 0, l, 4.6), mode: 'fill', role: 'leaf' })),
    ...range(6, k => ({ d: petal(50, 50, k * 60 + 15, 4, 13, 3.4), mode: 'fill', role: 'wash' })),
    { d: circle(50, 50, 4), mode: 'fill', role: 'lemon' },
    { d: 'M14 64Q4 70 10 78T18 76', mode: 'stroke', role: 'ink', w: 1.7 },
    { d: 'M86 36Q96 30 90 22T82 24', mode: 'stroke', role: 'ink', w: 1.7 },
  ],
};

/** The layers of one motif. Throws for a name that is not one of the four. */
export function motif(name) {
  if (!LAYERS[name]) throw new Error(`tile-band: "${name}" is not a motif (${MOTIFS.join(', ')}).`);
  return LAYERS[name]();
}

/**
 * Which pigment a role is painted in, for a tone. A blue-and-white tile has no lemon and no
 * leaf: lemon becomes the pale wash and leaf becomes cobalt. Majolica keeps them.
 * @param {'azulejo'|'majolica'} tones
 */
export const pigmentOf = (role, tones = 'azulejo') => (tones === 'majolica' ? role : role === 'lemon' ? 'wash' : role === 'leaf' ? 'blue' : role);

// ── fitting and laying ───────────────────────────────────────────────────

/**
 * Whole tiles along a band: `wanted` is the tile size you would like, `length` the room along the band.
 * The tiles are stretched or squeezed a little so none is cut, and they stay square.
 * @returns {{ count: number, size: number }}
 */
export function fitTiles(length, wanted) {
  if (!(length > 0) || !(wanted > 0)) return { count: 0, size: 0 };
  const count = Math.max(1, Math.round(length / wanted));
  return { count, size: length / count };
}

/**
 * The tiles of a band, from a seed. A hand laying a border alternates two designs and now
 * and then sets a third; so does this: two motifs chosen from the four alternate along the
 * band, an accent tile of another motif turns up every six to nine, and no two neighbours are
 * ever the same motif at the same turn. Each tile also carries what makes it hand-painted: a
 * small misregistration, a brush weight, a pooling of pigment, its own crackle seed.
 * A vine joins its neighbours across the tile edge, so it only ever turns half-turns.
 * @returns {{ i: number, motif: string, turn: number, dx: number, dy: number, rot: number, scale: number, weight: number, pool: number, tint: number, crackle: string }[]}
 */
export function layBand(seed, count) {
  const r = rng(`tile-band:${seed}`);
  const first = r.int(0, 3), a = MOTIFS[first], b = MOTIFS[(first + r.int(1, 3)) % 4];
  const others = MOTIFS.filter(m => m !== a && m !== b);
  let nextAccent = r.int(4, 6);
  const tiles = [];
  for (let i = 0; i < count; i++) {
    let name = i % 2 ? b : a;
    if (i === nextAccent) { name = r.pick(others); nextAccent += r.int(6, 9); }
    let turn = name === 'vine' ? r.pick([0, 2]) : r.int(0, 3);
    const prev = tiles[i - 1];
    if (prev && prev.motif === name && prev.turn === turn) turn = name === 'vine' ? (turn + 2) % 4 : (turn + 1) % 4;
    tiles.push({
      i, motif: name, turn,
      dx: r2(r.range(-1.2, 1.2)), dy: r2(r.range(-1.2, 1.2)), rot: r2(r.range(-1.1, 1.1)), scale: r2(r.range(0.985, 1.015)),
      weight: r2(r.range(0.88, 1.14)), pool: r2(r.range(0, 1)), tint: r2(r.range(-1, 1)), crackle: `${seed}:${i}`,
    });
  }
  return tiles;
}

/** The turn a painter should apply: the tile's own quarter-turns, plus one if the band runs down the page. */
export const turnOf = (tile, vertical = false) => (tile.turn + (vertical ? 1 : 0)) % 4;

/** Turn a tile a quarter. A vine, which must keep joining its neighbours, turns a half. */
export const turned = tile => ({ ...tile, turn: (tile.turn + (tile.motif === 'vine' ? 2 : 1)) % 4 });

// ── hand-painted ─────────────────────────────────────────────────────────

/**
 * Crackle: a few fine cracks of the glaze, each a short wandering line from the edge of the tile
 * that now and then forks. Polylines in the 100 by 100 tile.
 * @returns {number[][][]} cracks, each a list of [x, y]
 */
export function crackle(seed, { cracks = 3 } = {}) {
  const r = rng(`crackle:${seed}`), out = [];
  const walk = (x, y, a, steps, depth) => {
    const pts = [[r2(x), r2(y)]];
    for (let s = 0; s < steps; s++) {
      a += r.range(-0.7, 0.7);
      x += Math.cos(a) * r.range(5, 9); y += Math.sin(a) * r.range(5, 9);
      pts.push([r2(x), r2(y)]);
      if (depth < 1 && s > 1 && r.chance(0.22)) out.push(walk(x, y, a + (r.chance(0.5) ? 1 : -1) * r.range(0.8, 1.3), Math.max(2, steps - s - 1), depth + 1));
      if (x < -2 || x > 102 || y < -2 || y > 102) break;
    }
    return pts;
  };
  for (let k = 0; k < cracks; k++) {
    const edge = r.int(0, 3), t = r.range(12, 88);
    const [x, y] = [[t, 0], [100, t], [t, 100], [0, t]][edge];
    out.unshift(walk(x, y, rad(edge * 90 + 90 + r.range(-35, 35)), r.int(4, 8), 0));
  }
  return out;
}

// ── pointing and turning ─────────────────────────────────────────────────

/**
 * The tile under a point on a band, or -1: `x` and `y` are CSS pixels inside the band, `size` the
 * tile size, `count` how many tiles there are.
 */
export function tileAt(x, y, size, count, vertical = false) {
  if (!(size > 0)) return -1;
  const along = vertical ? y : x, across = vertical ? x : y;
  if (along < 0 || across < 0 || across >= size) return -1;
  const i = Math.floor(along / size);
  return i >= 0 && i < count ? i : -1;
}

/**
 * The angle, in degrees, of a tile `p` (0 to 1) of the way through its quarter-turn. It sets off
 * slowly, swings a little past the quarter and settles back onto exactly 90, like a tile set down
 * on wet mortar: the overshoot is about 8 percent, and the last value is 90 and not a fraction under.
 */
export function turnAngle(p) {
  if (!(p > 0)) return 0;
  if (p >= 1) return 90;
  const c1 = 1.9, c3 = c1 + 1, q = p - 1;
  return 90 * (1 + c3 * q * q * q + c1 * q * q);
}

/** How far a turning tile is lifted: 0 at rest, up to 1 in the middle of the turn, 0 again at the end. */
export const lift = p => (p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0);
