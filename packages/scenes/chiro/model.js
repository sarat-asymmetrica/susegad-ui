// Chiro: the red stone after the rain. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/chiro.js (read only;
// never edited). The plate already kept a pure core, and it comes across
// unchanged: buildWall(seed) lays the courses and cuts the block outlines;
// rasterWall() turns them into a grid mask and a distance field; fieldRows()
// fills the per-cell colours and weather orders; gsStep() advances a
// Gray-Scott reaction-diffusion; mossTimes() says when moss reaches each
// cell; seasons(t) is the timeline; stampHand() writes a damp print. The port
// adds the registers and model(). No DOM in any of it.

import { makeNoise, rng, clamp, lerp, smoothstep, phase, ease, TAU, hexToRgb, resample, blob, roughen } from '../../engine/index.js';

// ── Constants ─────────────────────────────────────────────────────────────

export const W = 1200, H = 800;
export const G = 4, GW = W / G, GH = H / G, NC = GW * GH;
export const GROUND = 712;
export const DU = 0.1, DV = 0.05;                   // diffusion rates (5-point Laplacian, dt = 1)
export const STONE_RATE = 190, STONE_MAX = 1500; // pits: steps per second, and when they are done
export const MOSS_START = 8, MOSS_GROW = 17;      // moss front: starts, and seconds to spread
export const T0 = 14, CYCLE = 52;                // seasons begin at T0 and repeat every CYCLE
export const STILL_T = T0 + 23;                  // the reduced-motion frame: green, still wet

const TINTS = ['#b0502d', '#a4452b', '#b95f36', '#ad5a3a', '#9c4630', '#bb6a3e', '#a84f35', '#b35632'];
const MAROON = hexToRgb('#6b271d'), OCHRE = hexToRgb('#c98f4e');
export const PIT = hexToRgb('#44191c'), CLAY = hexToRgb('#c99450'), CRUST = hexToRgb('#d99462');
const LIME = hexToRgb('#cdc9bd'), GRIME = hexToRgb('#8b8a82');
export const INK = '#3a170e';

// ── Pure core: the wall ───────────────────────────────────────────────────

/** A rounded rectangle traced clockwise (screen coordinates), evenly spaced. */
function roundRect(x, y, w, h, rad, step = 3) {
  const pts = [];
  const arc = (cx, cy, a0) => { for (let k = 0; k <= 6; k++) { const a = a0 + (k / 6) * Math.PI / 2; pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); } };
  arc(x + w - rad, y + rad, -Math.PI / 2); arc(x + w - rad, y + h - rad, 0);
  arc(x + rad, y + h - rad, Math.PI / 2); arc(x + rad, y + rad, Math.PI);
  return resample(pts, step, true);
}

/** Wear a block's outline: push each point inward by smooth erosion plus a few chips. */
function wornOutline(x, y, w, h, id, r, nz) {
  const P = roundRect(x, y, w, h, r.range(5, 14), 3), n = P.length;
  const chips = Array.from({ length: r.int(1, 4) }, () => ({ at: r() * n, depth: r.range(4, 13), width: r.range(3, 8) }));
  return P.map((p, i) => {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    let e = 1 + 4.5 * Math.max(0, nz.fbm(i * 0.045, id * 3.1, 0.5, 3) * 2) + 0.9 * nz(i * 0.6, id * 1.7, 2.5);
    for (const c of chips) { let d = Math.abs(i - c.at); d = Math.min(d, n - d); e += c.depth * Math.exp(-((d / c.width) ** 2)); }
    return [p[0] - ty * e, p[1] + tx * e];
  });
}

/** Where the red earth meets the wall. */
export const groundY = (x, nz) => GROUND + 8 * nz.fbm(x * 0.008, 3.3, 0.2, 3) + 2.5 * nz(x * 0.07, 1.1, 0.4);

/** Courses of blocks in a running bond, a plaster remnant, tufts at the foot. */
export function buildWall(seed) {
  const r = rng(`chiro:${seed}`), nz = makeNoise(`chiro-edge:${seed}`);
  const J = r.range(11, 15), blocks = [];
  let y = -r.range(60, 125), course = 0;
  const shift = r.range(0.35, 0.65);
  while (y < GROUND + 10) {
    const bh = r.range(158, 176);
    let x = -((course % 2 ? shift : 0) + r.range(0.08, 0.3)) * 370;
    while (x < W) {
      const L = r.range(330, 415), id = blocks.length;
      const bx = x + J / 2 + r.range(-1.5, 1.5), by = y + J / 2 + r.range(-1.5, 1.5), bw = L - J, bhh = bh - J;
      blocks.push({
        id, x: bx, y: by, w: bw, h: bhh,
        tint: hexToRgb(r.pick(TINTS)).map(c => c * r.range(0.93, 1.06)),
        clay: r.chance(0.3), depth: r.range(0.55, 1), pitted: r.range(0.04, 0.3),
        f: r.range(0.036, 0.046), k: r.range(0.0615, 0.0648),
        marks: r.pick(['saw', 'saw', 'saw', 'pick']), markAngle: r.range(-0.5, 0.5),
        outline: wornOutline(bx, by, bw, bhh, id, r, nz),
      });
      x += L;
    }
    y += bh; course++;
  }
  // a patch of old lime plaster still clinging near the top
  const px = r.range(760, 1060), py = r.range(40, 150);
  const plaster = roughen(blob(px, py, r.range(80, 118), { seed: seed * 1.3 + 2, wobble: 0.3, squash: r.range(0.55, 0.75), rot: r.range(-0.3, 0.3), freq: 1.6 }), { amp: 3.5, freq: 0.09, seed: seed + 5, step: 3 });
  const cracks = Array.from({ length: r.int(2, 4) }, () => {
    let cx = px + r.range(-60, 60), cy = py + r.range(-30, 30), a = r() * TAU;
    const pts = [[cx, cy]];
    for (let s = 0; s < r.int(6, 12); s++) { a += r.range(-0.7, 0.7); cx += Math.cos(a) * r.range(5, 12); cy += Math.sin(a) * r.range(5, 12); pts.push([cx, cy]); }
    return pts;
  });
  const ground = [];
  for (let x = -10; x <= W + 10; x += 6) ground.push([x, groundY(x, nz)]);
  const tufts = [];
  for (let k = 0; k < r.int(6, 9); k++) {
    const tx = r.range(20, W - 20), n = r.int(5, 10);
    for (let j = 0; j < n; j++) {
      const x = tx + r.gauss() * 12;
      tufts.push({ x, y: groundY(x, nz) + r.range(1, 5), h: r.range(14, 46), lean: r.range(-0.5, 0.5), bend: r.range(-0.4, 0.4), seed: k * 31 + j, delay: r.range(0, 0.35) });
    }
  }
  return { seed, J, blocks, plaster, cracks, ground, tufts, nz };
}

/** Scanline-fill a polygon into grid cells; calls put(cellIndex) for each. */
function fillPoly(pts, put) {
  let y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  const n = pts.length, xs = [];
  for (let j = Math.max(0, Math.floor(y0 / G)); j <= Math.min(GH - 1, Math.ceil(y1 / G)); j++) {
    const yc = (j + 0.5) * G;
    xs.length = 0;
    for (let k = 0; k < n; k++) {
      const a = pts[k], b = pts[(k + 1) % n];
      if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let i = Math.max(0, Math.ceil(xs[k] / G - 0.5)); i <= Math.min(GW - 1, Math.floor(xs[k + 1] / G - 0.5)); i++) put(j * GW + i);
    }
  }
}

/**
 * The wall as a grid: mask (0 hidden under the ground, 1 mortar, 2 stone,
 * 3 plaster), block id per cell, and a chamfer distance field: how many
 * cells each stone cell is from the nearest joint.
 */
export function rasterWall(wall) {
  const mask = new Uint8Array(NC).fill(1), bid = new Int16Array(NC).fill(-1), edge = new Float32Array(NC);
  for (const b of wall.blocks) fillPoly(b.outline, c => { mask[c] = 2; bid[c] = b.id; });
  fillPoly(wall.plaster, c => { mask[c] = 3; bid[c] = -1; });
  for (let i = 0; i < GW; i++) {
    const gy = groundY((i + 0.5) * G, wall.nz);
    for (let j = Math.max(0, Math.floor((gy + 8) / G)); j < GH; j++) { mask[j * GW + i] = 0; bid[j * GW + i] = -1; }
  }
  for (let i = 0; i < GW; i++) { mask[i] = mask[i] && 1; mask[NC - GW + i] = 0; }
  for (let j = 0; j < GH; j++) { if (mask[j * GW] === 2) mask[j * GW] = 1; if (mask[j * GW + GW - 1] === 2) mask[j * GW + GW - 1] = 1; }
  for (let c = 0; c < NC; c++) edge[c] = mask[c] === 2 ? 1e6 : 0;
  const D = Math.SQRT2;
  for (let j = 1; j < GH; j++) for (let i = 1; i < GW - 1; i++) {
    const c = j * GW + i; if (!edge[c]) continue;
    edge[c] = Math.min(edge[c], edge[c - 1] + 1, edge[c - GW] + 1, edge[c - GW - 1] + D, edge[c - GW + 1] + D);
  }
  for (let j = GH - 2; j >= 0; j--) for (let i = GW - 2; i >= 1; i--) {
    const c = j * GW + i; if (!edge[c]) continue;
    edge[c] = Math.min(edge[c], edge[c + 1] + 1, edge[c + GW] + 1, edge[c + GW + 1] + D, edge[c + GW - 1] + D);
  }
  const spans = (want) => {
    const s = [];
    for (let j = 1; j < GH - 1; j++) {
      let a = -1;
      for (let i = 1; i < GW; i++) {
        const on = i < GW - 1 && want(mask[j * GW + i]);
        if (on && a < 0) a = i;
        if (!on && a >= 0) { s.push(j * GW + a, j * GW + i); a = -1; }
      }
    }
    return Int32Array.from(s);
  };
  const onStone = new Float32Array(NC);
  for (let c = 0; c < NC; c++) onStone[c] = mask[c] === 2 ? 1 : 0;
  return { mask, bid, edge, onStone, stoneSpans: spans(m => m === 2) };
}

export function allocFields() {
  const f = () => new Float32Array(NC);
  return { R: f(), G: f(), B: f(), wetO: f(), dryO: f(), aff: f(), mossN: f(), pitN: f(), F: f(), K: f(), D: f(), thr: f(), dith: f(), hash: f(), mossT: f(), mossT0: f(), clay: new Uint8Array(NC) };
}

/** Per-cell base colour, reaction rates and weather order for rows [j0, j1). */
export function fieldRows(wall, grid, fl, j0, j1) {
  const nz = wall.nz, { mask, bid, edge } = grid;
  for (let j = j0; j < Math.min(j1, GH); j++) for (let i = 0; i < GW; i++) {
    const c = j * GW + i, x = (i + 0.5) * G, y = (j + 0.5) * G, m = mask[c];
    let r, g, b;
    if (m === 2) {
      const bk = wall.blocks[bid[c]];
      [r, g, b] = bk.tint;
      const n1 = nz.fbm(x * 0.011, y * 0.011, bk.id * 0.7, 3), n2 = nz.fbm(x * 0.03 + 40, y * 0.03, 2.2, 2);
      const tm = clamp((n1 - 0.05) * 2.4) * 0.55, to = clamp((n2 - 0.12) * 2.6) * 0.45;
      r += (MAROON[0] - r) * tm; g += (MAROON[1] - g) * tm; b += (MAROON[2] - b) * tm;
      r += (OCHRE[0] - r) * to; g += (OCHRE[1] - g) * to; b += (OCHRE[2] - b) * to;
      const shade = (1 + 0.07 * nz(x * 0.09, y * 0.09, 7.7)) * lerp(0.78, 1, smoothstep(0, 3.2, edge[c]));
      // fine pores everywhere on the cut face
      const hp = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453, pore = hp - Math.floor(hp);
      const pk = pore < 0.07 ? 0.8 : pore > 0.95 ? 1.06 : 1;
      r *= shade * pk; g *= shade * pk; b *= shade * pk;
      // pits come in clusters: where this low-frequency field is low the
      // reaction starves and the cut face stays flat
      const q = smoothstep(0.05, 0.16, nz.fbm(x * 0.0075, y * 0.0105, 3.3 + bk.id * 1.37, 2) + bk.pitted);
      fl.F[c] = lerp(0.026, bk.f + 0.006 * nz(x * 0.02, y * 0.02, 4.4), q);
      fl.K[c] = lerp(0.068, bk.k + 0.0015 * nz(x * 0.017, y * 0.017, 8.8), q);
      // and at several scales: diffusion sets the size of a hollow
      fl.D[c] = lerp(0.7, 1.45, clamp(0.5 + nz.fbm(x * 0.012, y * 0.012, 17.1 + bk.id, 2) * 1.6));
      // the threshold wanders, so tubes break into hollows of different sizes
      fl.thr[c] = 0.12 + 0.075 * nz.fbm(x * 0.05, y * 0.05, 61.1, 2) * 2;
      fl.clay[c] = nz(x * 0.028, y * 0.028, 44.4) > (bk.clay ? -0.05 : 0.3) ? 1 : 0;
    } else {
      const gr = clamp(0.25 + nz.fbm(x * 0.02, y * 0.02, 5.5, 3) * 1.3 + (y / H) * 0.35) * 0.6;
      [r, g, b] = LIME.map((v, k) => v + (GRIME[k] - v) * gr);
      // the block above overhangs the recessed joint
      const above = (k) => j - k >= 0 && mask[c - k * GW] === 2;
      const below = j + 1 < GH && mask[c + GW] === 2;
      const left = mask[c - 1] === 2;
      let sh = above(1) ? 0.62 : above(2) ? 0.84 : 1;
      if (left) sh *= 0.8;
      if (below && !above(1)) sh *= 1.07;
      sh *= 0.94 + 0.12 * (Math.sin(i * 91.7 + j * 47.3) * 0.5 + 0.5);
      r *= sh; g *= sh; b *= sh;
    }
    fl.R[c] = r; fl.G[c] = g; fl.B[c] = b;
    // when this cell gets wet (the front runs down in streaks) and when it dries
    const streak = Math.max(0, nz(x * 0.045, 7.7, 0.5)) * 0.16 + Math.max(0, nz(x * 0.12, 2.1, 1.5)) * 0.06;
    fl.wetO[c] = (y / H) * 0.95 + 0.14 * nz.fbm(x * 0.004, y * 0.004, 9.1, 2) - streak + 0.05;
    const low = m === 2 ? smoothstep(3, 0, edge[c]) * 0.12 : 0.16;
    fl.dryO[c] = (y / H) * 0.75 + 0.22 * nz.fbm(x * 0.006 + 20, y * 0.006, 3.3, 2) + low + 0.08;
    // where moss would like to live: low on the wall, in joints, near block edges
    let a = smoothstep(0.5, 0.92, y / H) * 0.72 + 0.42 * nz.fbm(x * 0.006, y * 0.01, 13, 2);
    if (m === 1) a += 0.28 + 0.25 * smoothstep(0.3, 0.8, y / H); else if (m === 2) a += 0.42 * smoothstep(4, 0, edge[c]); else a = 0;
    fl.aff[c] = clamp(a, 0, 1.2);
    fl.mossT0[c] = 1.62 - 1.1 * fl.aff[c] + 0.3 * nz.fbm(i * 0.05, j * 0.05, 51.3, 2) + 0.12 * nz(i * 0.33, j * 0.33, 7.9);
    fl.mossN[c] = nz(x * 0.035, y * 0.035, 21.5);
    const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453, hh = Math.sin(i * 269.5 + j * 183.3) * 12345.678;
    fl.hash[c] = h - Math.floor(h); fl.dith[c] = (hh - Math.floor(hh)) * 2 - 1;
    fl.pitN[c] = clamp(0.8 + 0.4 * nz.fbm(x * 0.025, y * 0.025, 31.7, 3), 0.55, 1) * (m === 2 ? lerp(0.75, 1, wall.blocks[bid[c]].depth) : 1);
  }
}

/** One Gray–Scott step over the active spans. A[] is 1 on the domain and 0
 *  off it, so nothing flows across a joint: each block is its own dish. */
export function gsStep(U, V, U2, V2, F, K, A, D, spans) {
  for (let q = 0; q < spans.length; q += 2) {
    for (let i = spans[q], e = spans[q + 1]; i < e; i++) {
      const u = U[i], v = V[i], f = F[i], d = D[i];
      const a0 = A[i - 1], a1 = A[i + 1], a2 = A[i - GW], a3 = A[i + GW];
      const lu = a0 * (U[i - 1] - u) + a1 * (U[i + 1] - u) + a2 * (U[i - GW] - u) + a3 * (U[i + GW] - u);
      const lv = a0 * (V[i - 1] - v) + a1 * (V[i + 1] - v) + a2 * (V[i - GW] - v) + a3 * (V[i + GW] - v);
      const uvv = u * v * v;
      U2[i] = u + DU * d * lu - uvv + f * (1 - u);
      V2[i] = v + DV * d * lv + uvv - (f + K[i]) * v;
    }
  }
}

/** A reaction pair: two buffers of u and v, swapped each step. */
export function reaction() {
  const a = { U: new Float32Array(NC).fill(1), V: new Float32Array(NC), U2: new Float32Array(NC).fill(1), V2: new Float32Array(NC) };
  a.swap = () => { [a.U, a.U2] = [a.U2, a.U]; [a.V, a.V2] = [a.V2, a.V]; };
  a.clear = () => { a.U.fill(1); a.U2.fill(1); a.V.fill(0); a.V2.fill(0); };
  a.spot = (c, rad, v) => {
    const ci = c % GW, cj = (c / GW) | 0;
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      if (di * di + dj * dj > rad * rad + 0.5) continue;
      const i = ci + di, j = cj + dj; if (i < 1 || j < 1 || i >= GW - 1 || j >= GH - 1) continue;
      const k = j * GW + i; a.V[k] = a.V2[k] = v; a.U[k] = a.U2[k] = 1 - v;
    }
  };
  return a;
}

/** Scatter seed spots inside each block for the pits to grow from. */
export function seedStone(st, wall, grid, F = null) {
  st.clear();
  for (const b of wall.blocks) {
    const r = rng(`pits:${wall.seed}:${b.id}`), n = Math.round((b.w * b.h) / r.range(200, 320));
    for (let s = 0; s < n; s++) {
      const x = b.x + r.range(0.03, 0.97) * b.w, y = b.y + r.range(0.05, 0.95) * b.h;
      const i = Math.floor(x / G), j = Math.floor(y / G);
      if (i < 1 || j < 1 || i >= GW - 1 || j >= GH - 1) continue;
      const c = j * GW + i;
      if (grid.mask[c] === 2 && (!F || F[c] > 0.031)) st.spot(c, r.chance(0.35) ? 2 : 1, r.range(0.4, 0.5));
    }
  }
  for (let c = 0; c < NC; c++) if (grid.mask[c] !== 2) { st.U[c] = st.U2[c] = 1; st.V[c] = st.V2[c] = 0; }
}

/**
 * When moss reaches each cell, as a fraction of its growing season: early in
 * joints, pits and the damp base, late on open faces, never on plaster. Two
 * scales of noise make the front clump and fray instead of marching evenly.
 */
export function mossTimes(wall, grid, fl, stoneV) {
  for (let c = 0; c < NC; c++) {
    const m = grid.mask[c];
    if (m !== 1 && m !== 2) { fl.mossT[c] = 9; continue; }
    fl.mossT[c] = fl.mossT0[c] - (m === 2 ? smoothstep(0.08, 0.25, stoneV[c]) * 0.24 : 0);
  }
}

/** The year, as numbers. t is seconds since the wall was built. */
export function seasons(t) {
  if (t < T0) return { cycle: -1, s: -1, mossG: 0, rain: 0, wf: 0, df: 0, mossVis: 0, brown: 0, bleach: 0, sun: 1, grass: 0, grassBrown: 0, grassFade: 0 };
  const s = (t - T0) % CYCLE, cycle = Math.floor((t - T0) / CYCLE);
  return {
    cycle, s,
    rain: smoothstep(0, 2.5, s) * (1 - smoothstep(13, 17, s)),
    wf: 1.45 * ease.inOutSine(phase(s, 0.8, 10)),
    df: 1.45 * ease.inOutSine(phase(s, 28, 40)),
    mossVis: smoothstep(MOSS_START, MOSS_START + 2, s) * (1 - smoothstep(40, 49, s)),
    mossG: 1.12 * ease.inOutSine(phase(s, MOSS_START, MOSS_START + MOSS_GROW)),
    brown: smoothstep(32, 42, s),
    bleach: Math.max(cycle > 0 ? 1 - smoothstep(1, 8, s) : 0, smoothstep(36, 50, s)),
    sun: clamp(1 - smoothstep(0, 3, s) + smoothstep(29, 37, s)),
    grass: ease.outCubic(phase(s, 11, 26)),
    grassBrown: smoothstep(34, 44, s),
    grassFade: 1 - smoothstep(44, 50, s),
  };
}

/** A damp palm and five fingers, written into a grid (max, so prints overlap softly). */
export function stampHand(damp, x, y, rot, nz, amt = 1) {
  const parts = [[0, 20, 29, 33, 0]];
  const fingers = [[-27, -26, 7.5, 21, -0.28], [-10, -40, 8, 25, -0.08], [8, -42, 8, 26, 0.06], [24, -32, 7.5, 22, 0.22], [-38, 14, 8, 20, -1.05]];
  for (const f of fingers) parts.push(f);
  const ca = Math.cos(rot), sa = Math.sin(rot);
  const i0 = Math.max(1, Math.floor((x - 100) / G)), i1 = Math.min(GW - 2, Math.ceil((x + 100) / G));
  const j0 = Math.max(1, Math.floor((y - 115) / G)), j1 = Math.min(GH - 2, Math.ceil((y + 100) / G));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const px = (i + 0.5) * G - x, py = (j + 0.5) * G - y;
    const lx = (px * ca + py * sa) / 1.25, ly = (-px * sa + py * ca) / 1.25;
    let best = 0;
    for (const [cx, cy, rx, ry, a] of parts) {
      const c2 = Math.cos(a), s2 = Math.sin(a), dx = lx - cx, dy = ly - cy;
      const u = (dx * c2 + dy * s2) / rx, v = (-dx * s2 + dy * c2) / ry;
      const d = u * u + v * v;
      if (d < 1.3) best = Math.max(best, smoothstep(1.3, 0.75, d));
    }
    if (!best) continue;
    const k = j * GW + i, v = best * amt * (0.72 + 0.28 * nz(i * 0.5, j * 0.5, 3.1) * 2);
    if (v > damp[k]) damp[k] = Math.min(1, v);
  }
}


/** How each register lives through the year: its pace, and whether a hand can touch the wall. */
export const LOOKS = {
  quiet: { pace: 0, touch: false },
  warm: { pace: 0.75, touch: false },
  playful: { pace: 1, touch: true },
};

/**
 * The per-frame description: the register's look and, for a local clock
 * (seconds since the wall was built, which the renderer keeps because the
 * wall takes a few frames to build), the season. The still is the plate's:
 * the monsoon green and still wet.
 */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  return { time, seed, register, look };
}
