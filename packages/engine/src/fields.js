// fields.js: the reusable fields behind the plates (Shet, Abri, Ghat, Saanj, Chiro). Pure.
import { TAU } from './math.js';
import { rng } from './rng.js';

/** @typedef {import('./math.js').Point} Point */
/** @typedef {import('./noise.js').Noise} Noise */

/** Unit direction of a noise flow field at (x, y, z): `angle` bent by up to about ±`spread`.
 *  @param {Noise} noise @returns {Point} */
export function flow(noise, x, y, z = 0, { scale = 1, angle = 0, spread = Math.PI } = {}) {
  const a = angle + noise(x * scale, y * scale, z) * spread;
  return [Math.cos(a), Math.sin(a)];
}

/** Curl of a scalar potential psi(x, y): a flow that never piles up or thins out,
 *  so whatever it carries keeps its area. Pass noise (z = 0) or a closure over time.
 *  @param {(x: number, y: number) => number} psi @returns {Point} */
export function curl(psi, x, y, eps = 1e-3) {
  return [(psi(x, y + eps) - psi(x, y - eps)) / (2 * eps), -(psi(x + eps, y) - psi(x - eps, y)) / (2 * eps)];
}

/** Domain warp: fBm sampled at coordinates bent by fBm. Veins and billows, roughly -1..1.
 *  @param {Noise} noise */
export function domainWarp(noise, x, y, { amount = 2.2, octaves = 3, z = 0 } = {}) {
  const wx = noise.fbm(x, y, z + 1.7, octaves), wy = noise.fbm(x + 5.2, y + 1.3, z + 4.1, octaves);
  return noise.fbm(x + amount * wx, y + amount * wy, z + 0.5, octaves);
}

/** fn(i, j) for every cell of a gw × gh grid, row-major. @returns {Float32Array} */
export function sampleGrid(gw, gh, fn) {
  const out = new Float32Array(gw * gh);
  for (let j = 0, k = 0; j < gh; j++) for (let i = 0; i < gw; i++, k++) out[k] = fn(i, j);
  return out;
}

/**
 * Marching squares for one level over a row-major gw × gh grid, joined into
 * polylines. Grid point (i, j) sits at (x0 + i·cell, y0 + j·cell). Closed
 * loops come back without a repeated end point. Saddles split by the cell mean.
 * @param {ArrayLike<number>} h
 * @returns {{ pts: Point[], closed: boolean }[]}
 */
export function contours(h, gw, gh, level, { x0 = 0, y0 = 0, cell = 1 } = {}) {
  const segs = [];
  // edge ids: 2k is the edge right of grid point k, 2k + 1 the edge below it
  for (let j = 0; j < gh - 1; j++) for (let i = 0; i < gw - 1; i++) {
    const k = j * gw + i, a = h[k], b = h[k + 1], c = h[k + gw + 1], d = h[k + gw];
    const idx = (a > level ? 8 : 0) | (b > level ? 4 : 0) | (c > level ? 2 : 0) | (d > level ? 1 : 0);
    if (idx === 0 || idx === 15) continue;
    const T = k * 2, Bo = (k + gw) * 2, L = k * 2 + 1, R = (k + 1) * 2 + 1;
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
    const k = e >> 1, i = k % gw, j = (k / gw) | 0, horiz = (e & 1) === 0;
    const i2 = horiz ? i + 1 : i, j2 = horiz ? j : j + 1;
    const v0 = h[k], v1 = h[j2 * gw + i2], t = Math.min(1, Math.max(0, (level - v0) / (v1 - v0 || 1e-6)));
    return [x0 + (i + (i2 - i) * t) * cell, y0 + (j + (j2 - j) * t) * cell];
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
    if (closed) chain.pop();
    lines.push({ pts: chain.map(at), closed });
  }
  return lines;
}

/**
 * Bridson's Poisson-disc sampling: every point at least r from every other,
 * filling the w × h box. Deterministic for a seed (or pass an rng()).
 * @param {number | string | (() => number)} [seed] @returns {Point[]}
 */
export function poissonDisc(w, h, r, seed = 1, k = 24) {
  const R = typeof seed === 'function' ? seed : rng(seed), cell = r / Math.SQRT2;
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell), grid = new Int32Array(gw * gh).fill(-1);
  const pts = [], active = [];
  const add = p => { pts.push(p); active.push(pts.length - 1); grid[Math.floor(p[1] / cell) * gw + Math.floor(p[0] / cell)] = pts.length - 1; };
  add([R() * w, R() * h]);
  while (active.length) {
    const ai = Math.floor(R() * active.length), [px, py] = pts[active[ai]];
    let found = false;
    for (let j = 0; j < k && !found; j++) {
      const a = R() * TAU, d = r * (1 + R());
      const x = px + Math.cos(a) * d, y = py + Math.sin(a) * d;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
      let ok = true;
      for (let yy = Math.max(0, gy - 2); yy <= Math.min(gh - 1, gy + 2) && ok; yy++) {
        for (let xx = Math.max(0, gx - 2); xx <= Math.min(gw - 1, gx + 2); xx++) {
          const q = grid[yy * gw + xx];
          if (q >= 0 && (pts[q][0] - x) ** 2 + (pts[q][1] - y) ** 2 < r * r) { ok = false; break; }
        }
      }
      if (ok) { add([x, y]); found = true; }
    }
    if (!found) active.splice(ai, 1);
  }
  return pts;
}

/**
 * @typedef {{ w: number, h: number, U: Float32Array, V: Float32Array, U2: Float32Array, V2: Float32Array }} GrayScott
 */

/** A Gray–Scott dish: u = 1 and v = 0 everywhere. @returns {GrayScott} */
export function grayScott(w, h) {
  const n = w * h;
  return { w, h, U: new Float32Array(n).fill(1), V: new Float32Array(n), U2: new Float32Array(n).fill(1), V2: new Float32Array(n) };
}

/** Drop a disc of v (and 1 − v of u) at cell (ci, cj). The border row stays untouched. @param {GrayScott} s */
export function gsSpot(s, ci, cj, rad, v = 1) {
  const { w, h } = s;
  for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
    if (di * di + dj * dj > rad * rad + 0.5) continue;
    const i = ci + di, j = cj + dj; if (i < 1 || j < 1 || i >= w - 1 || j >= h - 1) continue;
    const k = j * w + i; s.V[k] = s.V2[k] = v; s.U[k] = s.U2[k] = 1 - v;
  }
}

/**
 * Advance a Gray–Scott reaction–diffusion `steps` times (5-point Laplacian,
 * dt = 1; du = 0.2, dv = 0.1 match the usual 1.0 / 0.5 of the 9-point form).
 * `feed` and `kill` are numbers or per-cell arrays. `mask` (1 on, 0 off) makes
 * each masked region its own dish: nothing flows across the edge. The outer
 * border is held fixed.
 * @param {GrayScott} s
 * @param {{ feed?: number | ArrayLike<number>, kill?: number | ArrayLike<number>, du?: number, dv?: number,
 *   mask?: ArrayLike<number> | null, steps?: number }} [opts]
 */
export function gsStep(s, { feed = 0.037, kill = 0.06, du = 0.2, dv = 0.1, mask = null, steps = 1 } = {}) {
  const { w, h } = s, fA = typeof feed !== 'number', kA = typeof kill !== 'number';
  for (let n = 0; n < steps; n++) {
    const { U, V, U2, V2 } = s;
    for (let j = 1; j < h - 1; j++) for (let i = 1, k = j * w + 1; i < w - 1; i++, k++) {
      const u = U[k], v = V[k];
      let lu, lv;
      if (mask) {
        if (!mask[k]) { U2[k] = u; V2[k] = v; continue; }
        const a0 = mask[k - 1], a1 = mask[k + 1], a2 = mask[k - w], a3 = mask[k + w];
        lu = a0 * (U[k - 1] - u) + a1 * (U[k + 1] - u) + a2 * (U[k - w] - u) + a3 * (U[k + w] - u);
        lv = a0 * (V[k - 1] - v) + a1 * (V[k + 1] - v) + a2 * (V[k - w] - v) + a3 * (V[k + w] - v);
      } else {
        lu = U[k - 1] + U[k + 1] + U[k - w] + U[k + w] - 4 * u;
        lv = V[k - 1] + V[k + 1] + V[k - w] + V[k + w] - 4 * v;
      }
      const f = fA ? feed[k] : feed, kk = kA ? kill[k] : kill, uvv = u * v * v;
      U2[k] = u + du * lu - uvv + f * (1 - u);
      V2[k] = v + dv * lv + uvv - (f + kk) * v;
    }
    s.U = U2; s.U2 = U; s.V = V2; s.V2 = V;
  }
  return s;
}
