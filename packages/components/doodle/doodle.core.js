// Doodle: the pure core. Runs in Node.
//
// Single-line food drawings, as if done with a marker. Every motif is one or two strokes of absolute
// M, L, C and Q path data in a 100 by 100 box, drawn with a pen: no fills. Everything here is data
// or a small pure function: reading the path data back (so tests can hold the drawings to their
// rules), the "boil" a hand-drawn line has from frame to frame, a seeded row of motifs for a band,
// and the timing of a drawing drawing itself. The skins in skins/ turn it into SVG.

import { rng } from '../../engine/src/rng.js';
import { MOTIF_DATA } from './doodle.motifs.js';

export const MOTIFS = Object.keys(MOTIF_DATA);
/** The drawing box. Every motif lives in 0..VIEW on both axes, with a margin for the pen. */
export const VIEW = 100;
/** Keep the pen's own width and the boil inside the box: control points stay this far from the edge. */
export const MARGIN = 2;
/** How far the boil moves a line, in drawing units, and the frames it cycles through. */
export const BOIL_AMOUNT = 0.9;
export const BOIL_FRAMES = 4;
export const BOIL_MS = 220;

/** @returns {string[]} the strokes of a motif, each a single path. */
export function motif(name) {
  const m = MOTIF_DATA[name];
  if (!m) throw new RangeError(`not a doodle motif: ${name}`);
  return m.strokes;
}

/** The name a person would say for a motif: "fork-twirl" → "a fork twirling spaghetti". */
export const describe = name => (MOTIF_DATA[name] ?? { about: '' }).about;

// ── reading path data back ───────────────────────────────────────────────

const ARGS = { M: 2, L: 2, C: 6, Q: 4 };

/**
 * Parse absolute M, L, C and Q path data into commands. Anything else (relative commands, arcs,
 * Z, a stray token) throws: a drawing is made of the four commands and nothing else.
 * @param {string} d
 * @returns {{ c: 'M'|'L'|'C'|'Q', n: number[] }[]}
 */
export function parsePath(d) {
  const out = [];
  const re = /([A-Za-z])([^A-Za-z]*)/g;
  let m, at = 0;
  while ((m = re.exec(d))) {
    if (m.index !== at) throw new SyntaxError(`stray text in path data at ${at}`);
    at = re.lastIndex;
    const c = m[1];
    if (!(c in ARGS)) throw new SyntaxError(`path command ${c} is not allowed (only M, L, C, Q, absolute)`);
    const n = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number);
    if (n.some(v => !Number.isFinite(v))) throw new SyntaxError(`bad number in ${c} command`);
    if (!n.length || n.length % ARGS[c]) throw new SyntaxError(`${c} takes ${ARGS[c]} numbers at a time, got ${n.length}`);
    for (let i = 0; i < n.length; i += ARGS[c]) out.push({ c: /** @type {any} */ (c === 'M' && i ? 'L' : c), n: n.slice(i, i + ARGS[c]) });
  }
  if (!out.length || out[0].c !== 'M') throw new SyntaxError('path data starts with M');
  return out;
}

/** How many separate lines the pen draws: each M lifts and puts it down. */
export const strokesIn = d => parsePath(d).filter(s => s.c === 'M').length;

/** Every number in the path data as a point, control points included. */
export function controlPoints(d) {
  const pts = [];
  for (const { n } of parsePath(d)) for (let i = 0; i < n.length; i += 2) pts.push([n[i], n[i + 1]]);
  return pts;
}

/** Points along the drawn line itself, `per` to a curve. */
export function pathPoints(d, per = 16) {
  const pts = [];
  let cur = [0, 0];
  for (const { c, n } of parsePath(d)) {
    if (c === 'M' || c === 'L') {
      if (c === 'L') for (let i = 1; i <= 4; i++) pts.push([cur[0] + (n[0] - cur[0]) * i / 4, cur[1] + (n[1] - cur[1]) * i / 4]);
      else pts.push([n[0], n[1]]);
      cur = [n[0], n[1]];
    } else if (c === 'Q') {
      for (let i = 1; i <= per; i++) {
        const t = i / per, u = 1 - t;
        pts.push([u * u * cur[0] + 2 * u * t * n[0] + t * t * n[2], u * u * cur[1] + 2 * u * t * n[1] + t * t * n[3]]);
      }
      cur = [n[2], n[3]];
    } else {
      for (let i = 1; i <= per; i++) {
        const t = i / per, u = 1 - t;
        pts.push([
          u * u * u * cur[0] + 3 * u * u * t * n[0] + 3 * u * t * t * n[2] + t * t * t * n[4],
          u * u * u * cur[1] + 3 * u * u * t * n[1] + 3 * u * t * t * n[3] + t * t * t * n[5],
        ]);
      }
      cur = [n[4], n[5]];
    }
  }
  return pts;
}

/** The box the drawn line fills. */
export function pathBounds(d) {
  const pts = pathPoints(d);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** Length of the drawn line, in drawing units. */
export function pathLength(d) {
  const pts = pathPoints(d);
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return len;
}

// ── the boil ──────────────────────────────────────────────────────────────

const f = v => +v.toFixed(2);

/**
 * The same drawing, one frame of its boil. A hand-drawn line never sits quite still: it is drawn
 * again for every frame and lands a little elsewhere. Here every number in the path moves by a
 * smooth field (a slow sine of its own position, a different phase each frame), so the whole line
 * wobbles together instead of fizzing. Frame 0 is the drawing itself.
 */
export function boilPath(d, frame, amount = BOIL_AMOUNT) {
  if (!frame) return d;
  const p1 = frame * 1.7, p2 = frame * 2.3 + 1;
  return parsePath(d).map(({ c, n }) => {
    const moved = [];
    for (let i = 0; i < n.length; i += 2) {
      moved.push(f(n[i] + amount * Math.sin(0.11 * n[i + 1] + p1)), f(n[i + 1] + amount * Math.sin(0.13 * n[i] + p2)));
    }
    return c + moved.join(' ');
  }).join('');
}

/** All the frames of a path's boil, once, in order. */
export const boilFrames = (d, amount) => Array.from({ length: BOIL_FRAMES }, (_, i) => boilPath(d, i, amount));
/** The order the frames play in: out and back, so the line never jumps from the last frame to the first. */
export const BOIL_ORDER = [0, 1, 2, 3, 2, 1];

// ── drawing itself ─────────────────────────────────────────────────────────

/**
 * When each stroke of a motif starts drawing and how long it takes, in milliseconds. The strokes
 * follow one another, each taking time in proportion to its length, so a long outline is a slow
 * sweep and a short highlight is a flick.
 * @param {string[]} strokes @param {'warm'|'playful'} register @param {number} [cell] position in a band, for the stagger
 */
export function revealPlan(strokes, register = 'warm', cell = 0) {
  const total = register === 'playful' ? 750 : 1150;
  const lens = strokes.map(pathLength), sum = lens.reduce((a, b) => a + b, 0) || 1;
  const stagger = Math.min(cell * (register === 'playful' ? 70 : 110), 1400);
  let t = stagger;
  return lens.map(len => {
    const duration = Math.max(180, Math.round(total * len / sum));
    const step = { delay: Math.round(t), duration };
    t += duration * 0.9;
    return step;
  });
}

/** Where a stroke's dash starts: a little more than one whole length (pathLength is 1), so a hidden line leaves no round-cap dot. */
export const HIDDEN = 1.1;
/** The dash pattern that makes `stroke-dashoffset` a reveal: one length of line, then a gap longer than the hidden offset. */
export const DASH = '1 1.2';

/** The wiggle a playful doodle does when touched: a small turn and squash, there and back. */
export function wiggleFrames(seed = 1) {
  const s = seed % 2 ? 1 : -1;
  return [
    { transform: 'rotate(0deg) scale(1)', offset: 0 },
    { transform: `rotate(${6 * s}deg) scale(1.06, 0.95)`, offset: 0.25 },
    { transform: `rotate(${-5 * s}deg) scale(0.97, 1.05)`, offset: 0.55 },
    { transform: `rotate(${2.5 * s}deg) scale(1.01)`, offset: 0.8 },
    { transform: 'rotate(0deg) scale(1)', offset: 1 },
  ];
}
export const WIGGLE_MS = 520;

// ── a band ─────────────────────────────────────────────────────────────────

/**
 * Whole square cells along a length: as many as fit at the size asked for, stretched a little so
 * none is cut.
 * @returns {{ count: number, size: number }}
 */
export function fitCells(length, wanted) {
  if (!(length > 0) || !(wanted > 0)) return { count: 0, size: 0 };
  const count = Math.max(1, Math.round(length / wanted));
  return { count, size: length / count };
}

/**
 * A seeded row of motifs: no motif twice in a row, and none again within the last three cells while
 * the set is big enough to allow it (a set of three keeps two apart, a set of two alternates). Each is a little off true, as a hand places it: turned a few
 * degrees, nudged, a touch larger or smaller, and some drawn the other way round. A longer band
 * keeps the start of a shorter one.
 * @param {string|number} seed @param {number} count @param {string[]} [only] motifs to draw from
 * @returns {{ motif: string, rotate: number, dx: number, dy: number, scale: number, flip: boolean }[]}
 */
export function layBand(seed, count, only = MOTIFS) {
  const pool = only.filter(m => MOTIF_DATA[m]);
  const set = pool.length ? pool : MOTIFS;
  const r = rng(`doodle|${seed}`);
  const cells = [];
  for (let i = 0; i < count; i++) {
    let options = [];
    for (let back = 3; back >= 1 && !options.length; back--) {
      const recent = cells.slice(-back).map(c => c.motif);
      options = set.filter(m => !recent.includes(m));
    }
    if (!options.length) options = set;
    cells.push({
      motif: r.pick(options),
      rotate: +r.range(-7, 7).toFixed(1),
      dx: +r.range(-3, 3).toFixed(1),
      dy: +r.range(-3, 3).toFixed(1),
      scale: +r.range(0.84, 0.98).toFixed(2),
      flip: r.chance(0.3),
    });
  }
  return cells;
}

/** The transform that places a motif in a band cell: a SVG transform attribute for a 100 by 100 cell at (x, 0). */
export function cellTransform(cell, index) {
  const cx = index * VIEW + VIEW / 2, cy = VIEW / 2;
  const flip = cell.flip ? -1 : 1;
  return `translate(${f(cx + cell.dx)} ${f(cy + cell.dy)}) rotate(${cell.rotate}) scale(${f(cell.scale * flip)} ${cell.scale}) translate(${-VIEW / 2} ${-VIEW / 2})`;
}

/** The label a person gets: a motif name, spoken. */
export const speak = name => name.replace(/-/g, ' ');
