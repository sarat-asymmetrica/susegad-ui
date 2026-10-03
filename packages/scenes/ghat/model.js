// Ghat: a survey of the ghats. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/ghat.js (read only;
// never edited). The plate already kept a pure core, and it comes across
// unchanged: ghatSteps(seed) makes a height field (a coastal plain, a steep
// escarpment cut by gullies, a crest plateau), fills its pits and routes
// water downhill (priority flood, then steepest descent and flow
// accumulation), carves the rivers back into the land, extracts contour
// lines with marching squares, finds a ghat road with a grade-limited A*
// search and places the lettering. It is a generator so a page can build it
// in slices; buildGhat(seed) runs it to the end. No canvas, no DOM.
//
// What the port adds is the reveal as state: the plate read the page's
// scroll itself; here `progress` (0 to 1) is set by the page, or, absent,
// time inks the sheet.

import { makeNoise, N, rng, clamp, lerp, phase, ease, smoothstep, measure } from '../../engine/index.js';

export const W = 1200, H = 900;
export const M = { x0: 44, y0: 44, x1: 1156, y1: 856 };
export const C = 6, GW = Math.ceil((M.x1 - M.x0) / C) + 1, GH = Math.ceil((M.y1 - M.y0) / C) + 1;
export const STEP = 50, INDEX = 250, M_PER_UNIT = 36;
export const SEPIA = '#8a5433', SEPIA_DARK = '#5e3620', BLUE = '#3f6f8a', BLUE_PALE = '#cfe0de', PAPER = '#efe6cf', RED = '#b8432a';
export const FONT = '"Castoro", Georgia, "Times New Roman", serif';

// ── Pure core ─────────────────────────────────────────────────────────────

export const gx = i => M.x0 + i * C, gy = j => M.y0 + j * C;

function* heightField(seed) {
  const nz = makeNoise(7000 + seed * 31), h = new Float32Array(GW * GH);
  const coast = new Float32Array(GH), ecOf = new Float32Array(GH);
  for (let j = 0; j < GH; j++) {
    const y = gy(j);
    coast[j] = M.x0 + 230 + 80 * nz.fbm(y * 0.0032, 1.3, 0, 4) + 22 * nz(y * 0.02, 4.1) + 10 * nz(y * 0.06, 2.2);
    ecOf[j] = 0.56 + 0.08 * nz.fbm(y * 0.004, 9.7, 0, 3);
  }
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const x = gx(i), y = gy(j), cx = coast[j];
    let v;
    if (x < cx) {
      const d = cx - x;
      v = -3 - 70 * smoothstep(0, 280, d) + 5 * nz(x * 0.02, y * 0.02, 7);
    } else {
      const e = (x - cx) / (M.x1 - cx), ec = ecOf[j];
      const u = e + 0.07 * nz.fbm(y * 0.006, x * 0.002 + 7, 2, 4);
      // the plain climbs gently inland, with low laterite hills on it
      const plain = 95 * Math.pow(clamp(u / ec), 1.3) + 55 * Math.max(0, nz.fbm(x * 0.007, y * 0.007, 3.3, 4) + 0.05) * smoothstep(0.05, 0.3, u) + 12 * nz(x * 0.02, y * 0.02, 1.1);
      const scarp = 700 * smoothstep(ec - 0.14, ec + 0.12, u);
      const crest = 260 * Math.max(0, nz.fbm(x * 0.0045, y * 0.0045, 5.5, 5) + 0.15) * smoothstep(ec, ec + 0.3, u);
      const gv = Math.abs(nz.fbm(x * 0.0024, y * 0.0085, 8.8, 4));
      const gully = (1 - smoothstep(0, 0.2, gv)) * Math.exp(-(((u - ec) / 0.17) ** 2));
      v = Math.max(1.5, 1.5 + plain + scarp + crest - 330 * gully) * smoothstep(0, 0.012, e) + 1;
    }
    h[j * GW + i] = v;
    if (i === GW - 1 && j % 30 === 29) yield;
  }
  return { h, coast };
}

/** A binary heap of cell indices keyed by a Float32Array. */
export function heap(key) {
  const a = [];
  const up = k => { while (k > 0) { const p = (k - 1) >> 1; if (key[a[p]] <= key[a[k]]) break; [a[p], a[k]] = [a[k], a[p]]; k = p; } };
  const down = k => { for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < a.length && key[a[l]] < key[a[m]]) m = l; if (r < a.length && key[a[r]] < key[a[m]]) m = r; if (m === k) break; [a[m], a[k]] = [a[k], a[m]]; k = m; } };
  return { push(i) { a.push(i); up(a.length - 1); }, pop() { const t = a[0], l = a.pop(); if (a.length) { a[0] = l; down(0); } return t; }, get size() { return a.length; } };
}
export const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Priority flood → steepest descent → flow accumulation. */
function* drainage(h, seed) {
  const jit = rng(`flood:${seed}`), n = GW * GH, fh = new Float32Array(n), done = new Uint8Array(n), q = heap(fh);
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const k = j * GW + i;
    if (h[k] <= 0 || i === 0 || j === 0 || i === GW - 1 || j === GH - 1) { fh[k] = h[k]; done[k] = 1; q.push(k); }
  }
  while (q.size) {
    const k = q.pop(), i = k % GW, j = (k / GW) | 0;
    for (const [di, dj] of NB) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= GW || b >= GH) continue;
      const m = b * GW + a;
      if (done[m]) continue;
      done[m] = 1; fh[m] = Math.max(h[m], fh[k] + 0.01 + jit() * 0.05); q.push(m);
    }
  }
  yield;
  const rec = new Int32Array(n).fill(-1);
  for (let j = 1; j < GH - 1; j++) for (let i = 1; i < GW - 1; i++) {
    const k = j * GW + i;
    if (h[k] <= 0) continue;
    let best = 0;
    for (const [di, dj] of NB) {
      const m = (j + dj) * GW + i + di, s = (fh[k] - fh[m]) / Math.hypot(di, dj);
      if (s > best) { best = s; rec[k] = m; }
    }
  }
  yield;
  const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => fh[b] - fh[a]);
  const acc = new Float32Array(n);
  for (const k of order) { acc[k] += 1; if (rec[k] >= 0) acc[rec[k]] += acc[k]; }
  return { fh, rec, acc };
}

/** Walk upstream from a cell, always taking the tributary that carries most water. */
function traceUp(k, rec, acc, minAcc) {
  const path = [k];
  for (let guard = 0; guard < 5000; guard++) {
    const i = k % GW, j = (k / GW) | 0;
    let best = -1, bestA = minAcc;
    for (const [di, dj] of NB) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= GW || b >= GH) continue;
      const m = b * GW + a;
      if (rec[m] === k && acc[m] > bestA) { bestA = acc[m]; best = m; }
    }
    if (best < 0) break;
    path.push(best); k = best;
  }
  return path; // mouth first
}

export function chaikin(pts, it = 2, closed = false) {
  for (let r = 0; r < it; r++) {
    const out = closed ? [] : [pts[0]];
    const n = pts.length, segs = closed ? n : n - 1;
    for (let s = 0; s < segs; s++) {
      const a = pts[s], b = pts[(s + 1) % n];
      out.push([lerp(a[0], b[0], 0.25), lerp(a[1], b[1], 0.25)], [lerp(a[0], b[0], 0.75), lerp(a[1], b[1], 0.75)]);
    }
    if (!closed) out.push(pts[n - 1]);
    pts = out;
  }
  return pts;
}

/** Marching squares for one level, joined into polylines. */
export function contours(h, level) {
  const segs = [];
  const E = {
    T: (i, j) => (j * GW + i) * 2, B: (i, j) => ((j + 1) * GW + i) * 2,
    L: (i, j) => (j * GW + i) * 2 + 1, R: (i, j) => (j * GW + i + 1) * 2 + 1,
  };
  for (let j = 0; j < GH - 1; j++) for (let i = 0; i < GW - 1; i++) {
    const a = h[j * GW + i], b = h[j * GW + i + 1], c = h[(j + 1) * GW + i + 1], d = h[(j + 1) * GW + i];
    const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = E.T(i, j), R = E.R(i, j), Bo = E.B(i, j), L = E.L(i, j);
    const mid = (a + b + c + d) / 4 > level;
    switch (idx) {
      case 1: case 14: segs.push([L, Bo]); break;
      case 2: case 13: segs.push([Bo, R]); break;
      case 3: case 12: segs.push([L, R]); break;
      case 4: case 11: segs.push([T, R]); break;
      case 6: case 9: segs.push([T, Bo]); break;
      case 7: case 8: segs.push([L, T]); break;
      case 5: if (mid) segs.push([L, T], [Bo, R]); else segs.push([T, R], [L, Bo]); break;
      case 10: if (mid) segs.push([T, R], [L, Bo]); else segs.push([L, T], [Bo, R]); break;
    }
  }
  const at = e => {
    const k = e >> 1, i = k % GW, j = (k / GW) | 0, horiz = (e & 1) === 0;
    const i2 = horiz ? i + 1 : i, j2 = horiz ? j : j + 1;
    const v0 = h[j * GW + i], v1 = h[j2 * GW + i2], t = clamp((level - v0) / (v1 - v0 || 1e-6));
    return [lerp(gx(i), gx(i2), t), lerp(gy(j), gy(j2), t)];
  };
  const byEdge = new Map();
  segs.forEach((s, n) => { for (const e of s) { const l = byEdge.get(e); if (l) l.push(n); else byEdge.set(e, [n]); } });
  const used = new Uint8Array(segs.length), lines = [];
  for (let n0 = 0; n0 < segs.length; n0++) {
    if (used[n0]) continue;
    used[n0] = 1;
    const chain = [segs[n0][0], segs[n0][1]];
    for (const dir of [1, 0]) {
      for (;;) {
        const end = dir ? chain[chain.length - 1] : chain[0];
        const next = (byEdge.get(end) || []).find(m => !used[m]);
        if (next === undefined) break;
        used[next] = 1;
        const [e1, e2] = segs[next], other = e1 === end ? e2 : e1;
        if (dir) chain.push(other); else chain.unshift(other);
      }
    }
    const closed = chain.length > 3 && chain[0] === chain[chain.length - 1];
    let pts = chain.map(at);
    if (closed) pts.pop();
    if (pts.length < 4) continue;
    pts = chaikin(pts, 2, closed);
    lines.push({ pts, closed, length: measure(pts, closed).length });
  }
  return lines.filter(l => l.length > 24);
}

/** A* over the grid; steep stretches cost so much that the road learns to zigzag. */
function* findRoad(h, isRiver, from, to) {
  const n = GW * GH, g = new Float32Array(n).fill(Infinity), f = new Float32Array(n).fill(Infinity), came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n), q = heap(f);
  const MOVES = [...NB, [2, 1], [1, 2], [-1, 2], [-2, 1], [-2, -1], [-1, -2], [1, -2], [2, -1]];
  const hx = k => Math.hypot((k % GW) - (to % GW), ((k / GW) | 0) - ((to / GW) | 0)) * C;
  g[from] = 0; f[from] = hx(from); q.push(from);
  let pops = 0;
  while (q.size) {
    const k = q.pop();
    if (k === to) break;
    if (++pops % 4000 === 0) yield;
    if (closed[k]) continue;
    closed[k] = 1;
    const i = k % GW, j = (k / GW) | 0;
    for (const [di, dj] of MOVES) {
      const a = i + di, b = j + dj;
      if (a < 1 || b < 1 || a >= GW - 1 || b >= GH - 1) continue;
      const m = b * GW + a;
      if (closed[m] || h[m] <= 2) continue;
      const len = Math.hypot(di, dj) * C, grade = Math.abs(h[m] - h[k]) / (len * M_PER_UNIT);
      if (grade > 0.11) continue; // no road climbs that steeply
      let cost = len * (1 + Math.pow(grade / 0.07, 4));
      if (isRiver[m]) cost += 60;
      const ng = g[k] + cost;
      if (ng < g[m]) { g[m] = ng; f[m] = ng + hx(m); came[m] = k; q.push(m); }
    }
  }
  const path = [];
  for (let k = to; k >= 0; k = came[k]) path.push([gx(k % GW), gy((k / GW) | 0)]);
  return path.reverse();
}

export const hAt = (h, x, y) => {
  const fi = clamp((x - M.x0) / C, 0, GW - 1.001), fj = clamp((y - M.y0) / C, 0, GH - 1.001);
  const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
  return lerp(lerp(h[j * GW + i], h[j * GW + i + 1], u), lerp(h[(j + 1) * GW + i], h[(j + 1) * GW + i + 1], u), v);
};

/** The whole survey from a seed, as a generator so a page can build it in slices. */
export function* ghatSteps(seed) {
  const r = rng(`ghat:${seed}`);
  const { h, coast } = yield* heightField(seed);
  yield;
  const { rec, acc } = yield* drainage(h, seed);
  yield;
  const cellXY = k => [gx(k % GW), gy((k / GW) | 0)];

  // the rivers: the biggest west-flowing one, its tributaries, and a few others
  const outlets = [];
  for (let k = 0; k < GW * GH; k++) if (h[k] > 0 && rec[k] >= 0 && h[rec[k]] <= 0) outlets.push(k);
  outlets.sort((a, b) => acc[b] - acc[a]);
  const rivers = [];
  const add = (cells, kind) => {
    const src = cells.slice().reverse(); // source first
    rivers.push({ kind, cells: src, acc: src.map(k => acc[k]) });
  };
  const main = traceUp(outlets[0], rec, acc, 14);
  add(main, 'main');
  const onMain = new Set(main);
  const tribs = [];
  main.forEach((k, idx) => {
    if (idx < 6) return;
    const i = k % GW, j = (k / GW) | 0;
    for (const [di, dj] of NB) {
      const m = (j + dj) * GW + i + di;
      if (m >= 0 && m < GW * GH && rec[m] === k && !onMain.has(m) && acc[m] > 45) tribs.push([m, k]);
    }
  });
  tribs.sort((a, b) => acc[b[0]] - acc[a[0]]).slice(0, 6).forEach(([m, k]) => add([k, ...traceUp(m, rec, acc, 12)], 'trib'));
  for (const o of outlets.slice(1)) {
    if (rivers.filter(rv => rv.kind === 'other').length >= 3 || acc[o] < 120) break;
    const [ox, oy] = cellXY(o), [mx, my] = cellXY(outlets[0]);
    if (Math.hypot(ox - mx, oy - my) < 90) continue;
    add(traceUp(o, rec, acc, 14), 'other');
  }

  // carve each river into the land, so the contours bend into Vs upstream
  const isRiver = new Uint8Array(GW * GH);
  for (const rv of rivers) {
    const n = rv.cells.length;
    let bed = Infinity;
    rv.cells.forEach((k, idx) => {
      isRiver[k] = 1;
      const toMouth = n - 1 - idx, hk = h[k];
      const depth = Math.min(clamp(3.2 * Math.sqrt(rv.acc[idx]), 4, 60), hk * 0.3);
      bed = Math.min(bed, Math.max(hk - depth, 0.8));
      const mouth = rv.kind === 'main' && toMouth < 16;
      if (mouth) bed = Math.min(bed, -2 - (16 - toMouth) * 0.5);
      const R = mouth ? 2 + (16 - toMouth) / 3.5 : rv.kind === 'main' ? 2.5 : 2, slope = mouth ? 0.8 : 3 + hk / 90;
      const i0 = k % GW, j0 = (k / GW) | 0, Ri = Math.ceil(R);
      for (let dj = -Ri; dj <= Ri; dj++) for (let di = -Ri; di <= Ri; di++) {
        const a = i0 + di, b = j0 + dj;
        if (a < 0 || b < 0 || a >= GW || b >= GH) continue;
        const d = Math.hypot(di, dj);
        if (d > R) continue;
        const m = b * GW + a;
        h[m] = Math.min(h[m], bed + slope * d * C);
      }
    });
  }
  let hmax = 0;
  for (let k = 0; k < GW * GH; k++) hmax = Math.max(hmax, h[k]);
  yield;

  // river lines, smoothed, with a little meander; the main one runs on into the estuary
  for (const rv of rivers) {
    let pts = rv.cells.map(cellXY);
    if (rv.kind === 'main') {
      const [lx, ly] = pts[pts.length - 1];
      for (let s = 1; s <= 5; s++) pts.push([lx - s * 7, ly + N(s * 0.5, seed) * 3]);
    }
    pts = chaikin(pts, 3).map(([x, y], i) => [x + N(i * 0.08, seed * 3.1, 1.3) * 1.6, y + N(i * 0.08, seed * 1.7, 4.2) * 1.6]);
    rv.pts = pts;
    rv.m = measure(pts);
    rv.width = rv.acc.map(a => clamp(Math.sqrt(a) * 0.12, 0.7, 3.2));
  }

  // contours: sea depths as water-lines, then every 50 m on land
  const levels = [];
  for (const L of [-40, -22, -12, -5]) levels.push({ level: L, lines: contours(h, L), sea: true });
  yield;
  levels.push({ level: 0, lines: contours(h, 0), coast: true });
  yield;
  for (let L = STEP; L < hmax; L += STEP) { levels.push({ level: L, lines: contours(h, L), index: L % INDEX === 0 }); if (L % 100 === 0) yield; }

  yield;
  // hachures: short strokes straight downhill wherever the ground is steep
  const hachures = [];
  for (let y = M.y0 + 4; y < M.y1 - 4; y += 7) for (let x = M.x0 + 4; x < M.x1 - 4; x += 7) {
    const px = x + r.range(-2.5, 2.5), py = y + r.range(-2.5, 2.5), v = hAt(h, px, py);
    if (v < 60) continue;
    const dx = (hAt(h, px + 3, py) - hAt(h, px - 3, py)) / 6, dy = (hAt(h, px, py + 3) - hAt(h, px, py - 3)) / 6;
    const s = Math.hypot(dx, dy);
    if (s < 4.2 || r() > smoothstep(4.2, 9, s) * 0.9 + 0.1) continue;
    const len = clamp(2 + s * 0.45, 3, 7);
    hachures.push([px, py, px - (dx / s) * len, py - (dy / s) * len, v, clamp((s - 4) / 8, 0.2, 1)]);
  }

  yield;
  // the ghat road: from the plain near the river mouth up to a low point on the crest
  let from = -1, to = -1;
  {
    const jm = Math.round(GH * r.range(0.35, 0.65));
    const [mx, my] = cellXY(outlets[0]);
    let best = Infinity;
    for (let j = 4; j < GH - 4; j += 2) for (let i = 4; i < GW - 4; i += 2) {
      const k = j * GW + i, x = gx(i), y = gy(j);
      if (h[k] < 8 || h[k] > 45 || isRiver[k]) continue;
      const d = Math.abs(x - (mx + 120)) + Math.abs(y - (my + (j - jm) * 0)) * 0.6 + Math.abs(y - gy(jm)) * 0.5;
      if (d < best) { best = d; from = k; }
    }
    let lowest = Infinity;
    for (let j = Math.round(GH * 0.25); j < GH * 0.75; j++) {
      // along each row, the crest is the highest point; the pass is the lowest crest
      let top = -1;
      for (let i = Math.round(GW * 0.55); i < GW - 3; i++) { const k = j * GW + i; if (top < 0 || h[k] > h[top]) top = k; }
      const k = top - 6;
      if (h[k] < lowest && h[k] > 500 && !isRiver[k]) { lowest = h[k]; to = k; }
    }
  }
  let road = from >= 0 && to >= 0 ? yield* findRoad(h, isRiver, from, to) : [];
  road = road.length > 3 ? chaikin(road, 3) : [];
  yield;

  // spot heights: the highest ground, not too close together
  const peaks = [];
  const cand = [];
  for (let j = 3; j < GH - 3; j += 2) for (let i = 3; i < GW - 3; i += 2) {
    const k = j * GW + i;
    let top = true;
    for (let dj = -3; dj <= 3 && top; dj++) for (let di = -3; di <= 3; di++) if (h[(j + dj) * GW + i + di] > h[k]) { top = false; break; }
    if (top && h[k] > 300) cand.push(k);
  }
  cand.sort((a, b) => h[b] - h[a]);
  for (const k of cand) { const p = cellXY(k); if (peaks.every(q => Math.hypot(q[0] - p[0], q[1] - p[1]) > 140)) peaks.push([...p, Math.round(h[k])]); if (peaks.length >= 4) break; }

  // a smoothed crest line to letter SAHYADRI along
  const crest = [];
  for (let j = Math.round(GH * 0.12); j < GH * 0.9; j += 6) {
    let top = -1;
    for (let i = Math.round(GW * 0.6); i < GW - 3; i++) { const k = j * GW + i; if (top < 0 || h[k] > h[top]) top = k; }
    crest.push(cellXY(top));
  }
  const crestLine = chaikin(crest.map(([x, y], i, a) => [a.slice(Math.max(0, i - 2), i + 3).reduce((s, p) => s + p[0], 0) / a.slice(Math.max(0, i - 2), i + 3).length + 36, y]), 2);

  return { seed, h, hmax, coast, levels, rivers, hachures, road, peaks, crestLine, isRiver };
}
export function buildGhat(seed) {
  const it = ghatSteps(seed);
  for (;;) { const s = it.next(); if (s.done) return s.value; }
}

/** When each part of the drawing inks, as fractions of the reveal. */
export const TL = { sea: [0, 0.08], land: [0.05, 0.62], rivers: [0.58, 0.78], road: [0.7, 0.86], labels: [0.8, 1], clouds: [0.3, 0.62] };
/** The reveal front for the land, and a height's place in it. */
export const front = p => lerp(-0.03, 1.04, ease.inOutSine(phase(p, TL.land[0], TL.land[1])));
export const revealAt = (hNorm, yNorm) => 0.86 * hNorm + 0.14 * yNorm;


/**
 * How each register lives on the sheet. `ink` is the seconds time takes to
 * ink the whole sheet when the page sets no progress (the plate finished on a
 * 22 s clock once the reader stopped scrolling); `clouds` is whether the
 * monsoon drifts once it is inked; `read` is whether the pointer reads the
 * height of the ground. quiet is the finished sheet as a still.
 */
export const LOOKS = {
  quiet: { ink: 0, clouds: false, read: false },
  warm: { ink: 22, clouds: true, read: true },
  playful: { ink: 14, clouds: true, read: true },
};
/** Seconds before time starts inking, as the plate waited for a reader to settle. */
export const INK_DELAY = 0.8;
/** Well after the sheet is inked: the still. */
export const STILL_TIME = 60;

/** How far the sheet is inked at time t in a register, 0 to 1. */
export function inkAt(time, register = 'warm') {
  const look = LOOKS[register] || LOOKS.warm;
  return look.ink ? clamp((time - INK_DELAY) / look.ink) : 1;
}

/** The height under a point, in metres (negative out at sea), or null off the sheet. */
export function heightAt(geo, x, y) {
  if (x <= M.x0 || x >= M.x1 || y <= M.y0 || y >= M.y1) return null;
  return hAt(geo.h, x, y);
}
/** A height as the pencilled note says it: "350 m", or "12 m deep" at sea. */
export const heightText = v => (v > 0 ? `${Math.round(v / 5) * 5} m` : `${Math.max(1, Math.round(-v))} m deep`);

const memo = new Map();
/** buildGhat, memoised per seed (the renderer builds in slices and hands its result here). */
export function geoOf(seed) {
  if (!memo.has(seed)) keepGeo(seed, buildGhat(seed));
  return memo.get(seed);
}
/** A survey already built for this seed (by any scene on the page), or null. */
export const builtGeo = seed => memo.get(seed) ?? null;
/** Keep a survey a renderer built in slices, so the next scene with this seed skips the work. */
export function keepGeo(seed, geo) { if (memo.size > 4) memo.delete(memo.keys().next().value); memo.set(seed, geo); }

/**
 * The per-frame description: how far the sheet is inked. With `progress`
 * set the page drives it: time stands still and the scene rests until the
 * attribute changes.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const held = params.progress != null;
  const P = held ? clamp(params.progress) : inkAt(time, register);
  return { time, seed, register, look, held, P, settled: held || (register === 'quiet' && P >= 1) };
}
