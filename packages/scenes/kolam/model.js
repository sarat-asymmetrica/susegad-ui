// Kolam: the pure model. No DOM, no canvas; runs in Node.
//
// buildKolam(seed, grid) finds one unbroken line around a grid of dots with
// the mirror-curve method (Gerdes). geometry() lays it out in logical units
// and memoises it. model() is the per-frame part: a pure function of time,
// seed, register and params.

// Only the pure engine modules this needs, not engine/index.js: the kolam's geometry is
// reused as a small icon by components, which should not pay for the whole engine.
import { rng } from '../../engine/src/rng.js';
import { catmull } from '../../engine/src/geom.js';
import { clamp, phase, TAU } from '../../engine/src/math.js';

/**
 * Doubled coordinates: dot (i, j) sits at (2i+1, 2j+1). The ray visits edge
 * midpoints (X+Y odd). At X even the edge is vertical, so a mirror flips dx;
 * at Y even it is horizontal, so a mirror flips dy. The outer boundary is
 * always a mirror, so every ray closes into a loop.
 * `grid` (optional) fixes the number of dots across, rounded up to odd so the
 * design keeps a centre and its symmetry; otherwise the seed picks.
 */
export function buildKolam(seed, grid = null) {
  if (grid) grid = Math.round(grid) | 1;
  const r = rng(`kolam:${seed}`);
  const shape = r.pick(['diamond', 'diamond', 'square', 'diamond']);
  const cells = new Set();
  let size;
  if (shape === 'square') {
    size = r.pick([5, 5, 7]);
    if (grid) size = grid;
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) cells.add(`${i},${j}`);
  } else {
    let rad = r.int(2, 4);
    if (grid) rad = Math.max(1, Math.floor(grid / 2));
    size = rad * 2 + 1;
    for (let i = 0; i < size; i++) for (let j = 0; j < size; j++) if (Math.abs(i - rad) + Math.abs(j - rad) <= rad) cells.add(`${i},${j}`);
  }
  const has = (i, j) => cells.has(`${i},${j}`);
  const M = size * 2, S = M + 1;
  const id = (X, Y) => X * S + Y;

  // what kind of site is each edge midpoint (X, Y)? 0 none, 1 border, 2 inner
  const kind = new Int8Array(S * S);
  for (let X = 0; X <= M; X++) for (let Y = 0; Y <= M; Y++) {
    if ((X + Y) % 2 === 0) continue;
    let a, b;
    if (X % 2 === 0) { a = has(X / 2 - 1, (Y - 1) / 2); b = has(X / 2, (Y - 1) / 2); }
    else { a = has((X - 1) / 2, Y / 2 - 1); b = has((X - 1) / 2, Y / 2); }
    kind[id(X, Y)] = a && b ? 2 : a || b ? 1 : 0;
  }
  // does the diagonal segment leaving (X, Y) in direction (dx, dy) exist?
  const segCell = (X, Y, dx, dy) => (X % 2 === 0 ? has((X + dx - 1) / 2, (Y - 1) / 2) : has((X - 1) / 2, (Y + dy - 1) / 2));
  const K = 2 * M + 3;
  const segKey = (X, Y, dx, dy) => (2 * X + dx + 1) * K + (2 * Y + dy + 1);

  const inner = [], segs = [];
  for (let X = 0; X <= M; X++) for (let Y = 0; Y <= M; Y++) {
    const k = kind[id(X, Y)];
    if (!k) continue;
    if (k === 2) inner.push(id(X, Y));
    for (const [dx, dy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) if (segCell(X, Y, dx, dy)) segs.push([X, Y, dx, dy]);
  }
  const innerSet = new Set(inner);

  function traceAll(mirror) {
    const label = new Int32Array(K * K).fill(-1), loops = [];
    for (const [sx, sy, sdx, sdy] of segs) {
      if (label[segKey(sx, sy, sdx, sdy)] >= 0) continue;
      const n = loops.length, pts = [];
      let X = sx, Y = sy, dx = sdx, dy = sdy, guard = 0;
      do {
        label[segKey(X, Y, dx, dy)] = n;
        X += dx; Y += dy;
        pts.push([X, Y]);
        const k = kind[id(X, Y)];
        if (k === 1 || mirror[id(X, Y)]) { if (X % 2 === 0) dx = -dx; else dy = -dy; }
      } while (!(X === sx && Y === sy && dx === sdx && dy === sdy) && ++guard < 100000);
      loops.push(pts);
    }
    return { loops, label };
  }

  // Symmetry orbits of inner sites. Kolam are symmetric, so mirrors are chosen
  // per orbit: full square symmetry first, then 4-fold rotation, then 2-fold.
  // Single loops get easier to find as the symmetry relaxes.
  const groups = {
    d4: (X, Y) => [[X, Y], [M - X, Y], [X, M - Y], [M - X, M - Y], [Y, X], [M - Y, X], [Y, M - X], [M - Y, M - X]],
    c4: (X, Y) => [[X, Y], [M - Y, X], [M - X, M - Y], [Y, M - X]],
    c2: (X, Y) => [[X, Y], [M - X, M - Y]],
  };
  const orbitsFor = g => {
    const orbits = [], seen = new Set();
    for (const key of inner) {
      if (seen.has(key)) continue;
      const orbit = [...new Set(g(Math.floor(key / S), key % S).map(([a, b]) => id(a, b)))].filter(k => innerSet.has(k));
      orbit.forEach(k => seen.add(k));
      orbits.push(orbit);
    }
    return orbits;
  };

  // Prefer a healthy share of mirrors: zero mirrors is one loop, and the plainest.
  const want = r.range(0.25, 0.5);
  let best = null, bestSingle = null, symmetry = null;
  for (const [name, g] of Object.entries(groups)) {
    const orbits = orbitsFor(g);
    for (let attempt = 0; attempt < 700; attempt++) {
      const p = r.range(0.15, 0.65), mirror = new Uint8Array(S * S);
      let count = 0;
      for (const orbit of orbits) if (r() < p) orbit.forEach(k => { mirror[k] = 1; count++; });
      const res = traceAll(mirror);
      const cand = { mirror, res, ratio: count / Math.max(1, inner.length), name };
      if (!best || res.loops.length < best.res.loops.length) best = cand;
      if (res.loops.length === 1 && cand.ratio >= 0.12) {
        if (!bestSingle || Math.abs(cand.ratio - want) < Math.abs(bestSingle.ratio - want)) bestSingle = cand;
        if (Math.abs(cand.ratio - want) < 0.07) break;
      }
    }
    if (bestSingle) { symmetry = bestSingle.name; break; }
  }
  // fallback: merge loops by toggling a mirror where two different loops meet
  let { mirror, res } = bestSingle || best, guard = 0;
  while (res.loops.length > 1 && guard++ < 400) {
    const candidates = inner.filter(k => {
      const X = Math.floor(k / S), Y = k % S;
      const ids = new Set([[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([dx, dy]) => res.label[segKey(X, Y, dx, dy)]).filter(v => v >= 0));
      return ids.size > 1;
    });
    if (!candidates.length) break;
    const k = r.pick(candidates);
    mirror[k] = mirror[k] ? 0 : 1;
    res = traceAll(mirror);
  }

  const dots = [...cells].map(k => { const [i, j] = k.split(',').map(Number); return [2 * i + 1, 2 * j + 1]; });
  // rotate each loop to start at its top-left point so drawing begins at the edge
  const loops = res.loops.map(pts => {
    let k = 0; pts.forEach((p, i) => { if (p[1] < pts[k][1] || (p[1] === pts[k][1] && p[0] < pts[k][0])) k = i; });
    return [...pts.slice(k), ...pts.slice(0, k)];
  });
  return { shape, size, M, dots, loops, symmetry: symmetry || 'none' };
}

// ── Layout, memoised ──────────────────────────────────────────────────────

const memo = new Map();
export const FILL = 0.74;

/**
 * The kolam in logical units: dots (with their ring from the centre, for
 * colour), each loop as a smooth closed polyline with cumulative lengths,
 * the total length and the line width. Built once per seed, grid and size.
 */
export function geometry(seed, grid, W, H) {
  const key = `${seed}|${grid ?? ''}|${W}|${H}`;
  if (memo.has(key)) return memo.get(key);
  const k = buildKolam(seed, grid);
  const side = Math.min(W, H) * FILL, cell = side / k.size;
  const ox = (W - side) / 2, oy = (H - side) / 2;
  const toXY = ([X, Y]) => [ox + (X * cell) / 2, oy + (Y * cell) / 2];
  const c = k.M / 2;
  const loops = k.loops.map(l => {
    const pts = catmull(l.map(toXY), 12, true);
    pts.push(pts[0]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    return { pts, cum, length: cum[cum.length - 1] };
  });
  const geo = {
    key, seed, grid, W, H, cell, shape: k.shape, size: k.size, symmetry: k.symmetry,
    dots: k.dots.map(toXY),
    rings: k.dots.map(([X, Y]) => (Math.abs(X - c) + Math.abs(Y - c)) / 2),
    loops,
    length: loops.reduce((s, l) => s + l.length, 0),
    lineW: cell * 0.085,
  };
  if (memo.size > 12) memo.delete(memo.keys().next().value);
  memo.set(key, geo);
  return geo;
}

/** [x, y, angle] at arc distance d along the whole line (loops end to end). */
export function pointAt(geo, d) {
  d = clamp(d, 0, geo.length);
  for (const l of geo.loops) {
    if (d <= l.length) {
      const { pts, cum } = l;
      let lo = 0, hi = cum.length - 1;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (cum[mid] <= d) lo = mid; else hi = mid; }
      const a = pts[lo], b = pts[hi], t = (d - cum[lo]) / (cum[hi] - cum[lo] || 1);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
    }
    d -= l.length;
  }
  const l = geo.loops[geo.loops.length - 1], p = l.pts[l.pts.length - 1];
  return [p[0], p[1], 0];
}

// ── Time ──────────────────────────────────────────────────────────────────

/** Pace in logical units per second, at W = 1000. Warm is a hand at dawn; playful hurries. */
export const PACE = {
  warm: { dots: 1.8, gap: 0.4, pace: 820, min: 9, max: 24 },
  playful: { dots: 1.0, gap: 0.3, pace: 1500, min: 5, max: 12 },
};

export function timeline(geo, register) {
  const T = PACE[register] ?? PACE.warm;
  const draw = clamp((geo.length * 1000) / geo.W / T.pace, T.min, T.max);
  const lineStart = T.dots + T.gap;
  return { dotsEnd: T.dots, lineStart, lineEnd: lineStart + draw, draw, speed: geo.length / draw };
}

/** A hand hurries on straights and slows into turns: a small wave on top of steady progress. Monotonic. */
export const handPace = u => clamp(u + 0.011 * Math.sin(u * TAU * 9));

/** The ants that come for the flour once the line is closed (playful only). */
export function ants(geo, since) {
  const r = rng(`ants:${geo.seed}`), out = [];
  for (let i = 0; i < 3; i++) {
    const a = { s0: r() * geo.length, dir: r.sign(), speed: r.range(16, 26), delay: 1.2 + i * r.range(1.5, 3), from: r() * TAU, carrying: r.chance(0.6) };
    const lt = since - a.delay;
    if (lt < 0) continue;
    const [px, py, pang] = pointAt(geo, (((a.s0 + a.dir * a.speed * lt) % geo.length) + geo.length) % geo.length);
    const walk = 1 - Math.pow(1 - phase(lt, 0, 3.5), 3);
    const ex = px + Math.cos(a.from) * 520, ey = py + Math.sin(a.from) * 520;
    out.push({
      x: ex + (px - ex) * walk, y: ey + (py - ey) * walk,
      heading: walk < 1 ? Math.atan2(py - ey, px - ex) : pang + (a.dir < 0 ? Math.PI : 0),
      t: lt + a.s0, carrying: a.carrying,
    });
  }
  return out;
}

/**
 * The frame, as plain data. With `progress` set (0..1), the line is drawn
 * exactly that far and time does not move it: the scene shows state, so it
 * only moves when the work moves. Quiet is always the finished still.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {}, W = 1000, H = 1000 }) {
  const geo = geometry(seed, params.grid ?? null, W, H);
  const palette = params.palette && params.palette !== 'auto' ? params.palette : register === 'playful' ? 'rangoli' : 'flour';
  const set = params.progress !== null && params.progress !== undefined;
  const tl = timeline(geo, register);
  let dots, drawn;
  if (set) { dots = geo.dots.length; drawn = clamp(params.progress); }
  else if (register === 'quiet') { dots = geo.dots.length; drawn = 1; }
  else {
    dots = Math.min(geo.dots.length, Math.floor(phase(time, 0, tl.dotsEnd) * geo.dots.length + (time >= tl.dotsEnd ? 1 : 0)));
    drawn = handPace(phase(time, tl.lineStart, tl.lineEnd));
  }
  const finished = drawn >= 1;
  const since = finished && !set && register !== 'quiet' ? time - tl.lineEnd : -1;
  return {
    geo, register, palette, dots, drawn,
    drawnLength: drawn * geo.length,
    tip: drawn > 0 && drawn < 1 ? pointAt(geo, drawn * geo.length) : null,
    since,
    ants: register === 'playful' && since >= 0 ? ants(geo, since) : [],
    speed: tl.speed,
    settled: set || register === 'quiet',
  };
}
