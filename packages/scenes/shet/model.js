// Shet: one year of a paddy field. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/shet.js (read only;
// never edited). The plate already kept a pure core, and it comes across
// unchanged: the ground-plane projection, the year's timeline T, buildField
// (bunds, plots, two-level Voronoi cracks, rice rows), season(t),
// windAt() and gustAt(), and the egrets' little simulation. The port adds the
// registers, the progress param and model(). No DOM in any of it.

import { makeNoise, N, rng, clamp, lerp, TAU, phase, ease, smoothstep, roughen } from '../../engine/index.js';

// ── Projection: a ground plane seen from a rise ───────────────────────────

export const W = 1200, H = 800, HY = 134, F = 668, CX = 600, Z_NEAR = 0.84, Z_FAR = 7.2;
/** Ground (gx across, gz away from the eye) → screen. */
export const proj = (gx, gz) => [CX + (gx * F) / gz, HY + F / gz];
export const unproj = (x, y) => { const gz = F / Math.max(1e-3, y - HY); return [((x - CX) * gz) / F, gz]; };
export const Y_FAR = HY + F / Z_FAR, NEAR_Y = HY + F / 1.75;

/** When everything happens, in seconds of an 80-second year. */
export const T = {
  cycle: 80, clouds: [6, 13], rainIn: [11, 14], spots: [11.5, 22], wetAll: [17, 22], rainOut: [22, 27],
  waterUp: [19, 31], plant: 28, grow: 12, clear: [30, 44], waterDown: [52, 61], ripe: [54, 64],
  cut: [64, 70], dry: [66, 76],
};

// ── Pure core: geometry ───────────────────────────────────────────────────

const crackSp = gz => 0.07 * Math.pow(gz, 0.62);
const clumpSp = gz => 0.056 * Math.pow(gz, 0.6);
const bundHalf = gz => 0.026 * Math.pow(gz, 0.8);
const bundRise = gz => 0.015 * Math.pow(gz, 0.55);

/** Intersect a cross bund (gz = z + t·gx) with a long bund (gx = c + d·gz). */
function meet(h, v) {
  const gx = (v.c + v.d * h.z) / (1 - v.d * h.t);
  return [gx, h.z + h.t * gx];
}

/**
 * Sutherland–Hodgman against one line: keep points with n·p ≤ c. Vertices are
 * [x, z, label], where label names the edge that starts at that vertex, so
 * after all the clipping each edge still knows what cut it.
 */
function clipLine(poly, nx, nz, c, label) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = nx * p[0] + nz * p[1] - c, dq = nx * q[0] + nz * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp <= 0) !== (dq <= 0)) {
      const k = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, dp <= 0 ? label : p[2]]);
    }
  }
  return out;
}
/** The half of poly nearer site a than site b: one step of a Voronoi cell. */
const clipBisector = (poly, a, b, label) => {
  const nx = b[0] - a[0], nz = b[1] - a[1];
  return clipLine(poly, nx, nz, (nx * (a[0] + b[0]) + nz * (a[1] + b[1])) / 2, label);
};
const centroid = poly => { let x = 0, z = 0; for (const p of poly) { x += p[0]; z += p[1]; } return [x / poly.length, z / poly.length]; };
function area(poly) { let s = 0; for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s) / 2; }
function inside(poly, p) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (c !== 0) { if (sign && Math.sign(c) !== sign) return false; sign = Math.sign(c); }
  }
  return true;
}
/** Shrink a convex polygon edge by edge, each by its own width(label, gz). */
function inset(poly, width) {
  const [cx, cz] = centroid(poly);
  let out = poly;
  for (let i = 0; i < poly.length && out.length >= 3; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    let nx = q[1] - p[1], nz = -(q[0] - p[0]);
    const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
    if (nx * (cx - p[0]) + nz * (cz - p[1]) > 0) { nx = -nx; nz = -nz; }
    out = clipLine(out, nx, nz, nx * p[0] + nz * p[1] - width(p[2], (p[1] + q[1]) / 2), p[2]);
  }
  return out.length >= 3 ? out : null;
}
/** Dart throwing: points no closer than k·spacing(z), denser near the eye. */
function scatter(poly, sp, r, k = 0.78, cap = 9000) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const [x, z] of poly) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  const tries = Math.min(cap, Math.ceil((area(poly) / (sp(z0) ** 2)) * 7) + 8), pts = [];
  for (let i = 0; i < tries; i++) {
    const p = [r.range(x0, x1), r.range(z0, z1)];
    if (!inside(poly, p)) continue;
    const s = sp(p[1]) * k, s2 = s * s;
    let ok = true;
    for (const q of pts) if ((q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < s2) { ok = false; break; }
    if (ok) pts.push(p);
  }
  return pts;
}
const B = -1, S0 = -10; // edge labels: B plot edge, ≥0 big-cell neighbour, ≤ S0 fine neighbour

export function buildField(seed) {
  const r = rng(`shet:${seed}`), nz = makeNoise(hashNum(seed) + 5);
  // cross bunds (gz = z + t·gx), near to far
  const hs = [Z_NEAR, r.range(1.4, 1.58), r.range(2.3, 2.62), r.range(3.7, 4.25), Z_FAR]
    .map((z, k) => ({ z, t: k === 0 || k === 4 ? 0 : r.range(-0.03, 0.03) }));
  const wedgeL = { c: 0, d: -1.0 }, wedgeR = { c: 0, d: 1.0 };
  const plots = [], longBunds = [];
  for (let k = 0; k < 4; k++) {
    const zm = (hs[k].z + hs[k + 1].z) / 2, n = [1, r.int(1, 2), 2, r.int(2, 3)][k];
    const xs = [];
    for (let guard = 0; xs.length < n && guard < 200; guard++) {
      const x = r.range(170, 1030);
      if (xs.every(q => Math.abs(q - x) > 230)) xs.push(x);
    }
    xs.sort((a, b) => a - b);
    const vs = xs.map(x => { const d = r.range(-0.07, 0.07); return { c: ((x - CX) * zm) / F - d * zm, d }; });
    vs.forEach(v => longBunds.push({ v, a: hs[k], b: hs[k + 1], k }));
    const lines = [wedgeL, ...vs, wedgeR];
    for (let i = 0; i < lines.length - 1; i++) {
      const vL = lines[i], vR = lines[i + 1], a = hs[k], b = hs[k + 1];
      const quad = [meet(a, vL), meet(a, vR), meet(b, vR), meet(b, vL)].map(p => [p[0], p[1], B]);
      plots.push({ k, vL, vR, a, b, quad, idx: plots.length });
    }
  }

  // Two-level Voronoi cracks, per plot
  const cells = [], pEdges = [], sEdges = [], hairs = [];
  const bigSp = z => crackSp(z) * 3.1;
  for (const plot of plots) {
    const sites = scatter(plot.quad, bigSp, r, 0.8, 5000);
    sites.forEach((s, i) => {
      let poly = plot.quad;
      sites.forEach((o, j) => { if (j !== i && poly.length >= 3) poly = clipBisector(poly, s, o, j); });
      if (poly.length < 3) return;
      poly.forEach((p, e) => { if (p[2] > i) pEdges.push([p, poly[(e + 1) % poly.length], plot.k]); });
      const fine = scatter(poly, crackSp, r, 0.8, 2500);
      if (!fine.length) fine.push(centroid(poly));
      fine.forEach((f, fi) => {
        let cell = poly;
        fine.forEach((o, fj) => { if (fj !== fi && cell.length >= 3) cell = clipBisector(cell, f, o, S0 - fj); });
        if (cell.length < 3) return;
        cell.forEach((p, e) => { if (p[2] <= S0 && S0 - p[2] > fi) sEdges.push([p, cell[(e + 1) % cell.length], plot.k]); });
        const [cx, cz] = centroid(cell);
        const plate = inset(cell, (label, z) => Math.sqrt(z) * (label === B ? 0.0042 : label >= 0 ? 0.0036 : 0.0017));
        cells.push({
          plot: plot.idx, k: plot.k, cell, plate, cx, cz,
          depth: 0.5 + 0.5 * nz.fbm(cx * 1.3, cz * 1.3, 3.3, 3) + r.range(-0.08, 0.08),
          tone: r.range(-1, 1), seed: r() * 1000,
        });
        // hairline cracks that never finished: from an edge partway in
        if (cz < 2.6 && plate && r() < 0.55) {
          const e = r.int(0, plate.length - 1), p = plate[e], q = plate[(e + 1) % plate.length], u = r.range(0.3, 0.7);
          const s0 = [lerp(p[0], q[0], u), lerp(p[1], q[1], u)], reach = r.range(0.3, 0.6);
          const mid = [lerp(s0[0], cx, reach / 2) + r.range(-0.01, 0.01) * cz, lerp(s0[1], cz, reach / 2)];
          hairs.push([s0, mid, [lerp(s0[0], cx, reach), lerp(s0[1], cz, reach)]]);
        }
      });
    });
  }
  // depth ranks per plot → 0..1, so every plot floods low cells first
  for (const plot of plots) {
    const mine = cells.filter(c => c.plot === plot.idx).sort((a, b) => a.depth - b.depth);
    mine.forEach((c, i) => { c.depth = mine.length > 1 ? i / (mine.length - 1) : 0; });
  }

  // Rice: rows run away from the eye between each plot's long bunds
  const clumps = [];
  for (const plot of plots) {
    const zm = (plot.a.z + plot.b.z) / 2, sp = clumpSp(zm);
    const width = (plot.vR.c - plot.vL.c) + (plot.vR.d - plot.vL.d) * zm;
    const rows = Math.max(1, Math.floor(width / sp));
    const skew = r.range(-0.4, 0.4);
    for (let i = 0; i < rows; i++) {
      const u = (i + 0.5) / rows;
      const row = { c: lerp(plot.vL.c, plot.vR.c, u), d: lerp(plot.vL.d, plot.vR.d, u) };
      const xAt = row.c + row.d * zm;
      if (Math.abs(xAt) > 0.97 * zm + 0.05) continue; // off screen
      const zA = meet(plot.a, row)[1] + bundHalf(plot.a.z) * 1.6, zB = meet(plot.b, row)[1] - bundHalf(plot.b.z) * 1.6;
      for (let z = zA + r.range(0, 0.3) * sp; z < zB; z += clumpSp(z) * r.range(0.72, 1.12)) {
        // hands, not a machine: gaps where a seedling failed, the odd double
        if (r() < 0.07) continue;
        const twin = r() < 0.07 ? 2 : 1;
        for (let tw = 0; tw < twin; tw++) {
        const gz = z + r.gauss() * clumpSp(z) * 0.1 + tw * clumpSp(z) * 0.3, gx = row.c + row.d * gz + r.gauss() * sp * 0.12 + tw * sp * r.range(-0.35, 0.35);
        const [x, y] = proj(gx, gz);
        if (x < -30 || x > W + 30 || y > H + 30) continue;
        const n = gz < 1.75 ? r.int(4, 6) : gz < 3.3 ? 4 : 2;
        const blades = Array.from({ length: n }, (_, b) => [
          ((b + 0.5) / n - 0.5) * r.range(0.55, 0.8) + r.range(-0.06, 0.06), // lean
          r.range(0.72, 1.05),                                                // length
          r.range(-1, 1) * 1.6 * (F / gz) / 668,                             // offset at the root
        ]);
        clumps.push({
          gx, gz, x, y, sc: F / gz, blades, k: plot.k,
          plant: T.plant + plot.k * 1.3 + ((u + skew) % 1 + 1) % 1 * 2.4 + r.range(0, 0.7),
          tilt: r.range(-0.2, 0.2), hk: r.range(0.7, 1.2), band: gz < 1.75 ? 0 : gz < 3.3 ? 1 : 2,
          shade: r.pick([0, 0, 1, 2]), glint: r() < 0.3 ? r.int(0, n - 1) : -1,
        });
        }
      }
    }
  }
  clumps.sort((a, b) => b.gz - a.gz);
  const near = clumps.filter(c => c.band === 0), far = clumps.filter(c => c.band > 0);

  // Bund ribbons in screen space: a sloping face and a flat top, both raised
  const bunds = [];
  const rib = (pts, hwFn, horiz, sd) => {
    const L = [], R = [], Lt = [], Rt = [];
    for (let i = 0; i < pts.length; i++) {
      const [gx, gz] = pts[i], u = i / pts.length;
      const hw = hwFn(gz) * (1 + 0.35 * nz(u * 9, sd, 2.5)), rise = bundRise(gz) * (1 + 0.3 * nz(u * 5, sd, 7.5)) * F / gz;
      const a = horiz ? proj(gx, gz - hw) : proj(gx - hw, gz), b = horiz ? proj(gx, gz + hw) : proj(gx + hw, gz);
      L.push(a); R.push(b); Lt.push([a[0], a[1] - rise]); Rt.push([b[0], b[1] - rise]);
    }
    return { L, R, Lt, Rt };
  };
  hs.forEach((h, k) => {
    if (k === 0) return;
    const pts = [];
    for (let gx = -1.05 * h.z; gx <= 1.05 * h.z; gx += (5 * h.z) / F) pts.push([gx, h.z + h.t * gx + 0.016 * h.z * nz(gx * 1.1 / Math.sqrt(h.z), k * 7.1, 0.5) + 0.005 * h.z * nz(gx * 6, k, 3)]);
    const g = rib(pts, bundHalf, true, k * 3.3);
    bunds.push({ horiz: true, z: h.z, k, face: [...g.L, ...g.Lt.slice().reverse()], top: [...g.Lt, ...g.Rt.slice().reverse()], edge: g.L, rim: g.Lt, back: g.Rt });
  });
  for (const lb of longBunds) {
    const z0 = meet(lb.a, lb.v)[1], z1 = meet(lb.b, lb.v)[1], pts = [];
    for (let z = z0; z <= z1; z += (4 * z * z) / F) pts.push([lb.v.c + lb.v.d * z + 0.014 * z * nz(z * 1.6, lb.v.c * 9, 1.5), z]);
    const g = rib(pts, bundHalf, false, lb.v.c * 11 + 5);
    const leftVisible = proj(lb.v.c + lb.v.d * z0, z0)[0] > CX;
    const side = leftVisible ? [...g.L, ...g.Lt.slice().reverse()] : [...g.R, ...g.Rt.slice().reverse()];
    bunds.push({ horiz: false, z: (z0 + z1) / 2, k: lb.k, face: side, top: [...g.Lt, ...g.Rt.slice().reverse()], edge: leftVisible ? g.L : g.R, rim: leftVisible ? g.Lt : g.Rt, back: leftVisible ? g.Rt : g.Lt });
  }
  // far to near, so nearer bunds overlap farther ones
  bunds.sort((a, b) => b.z - a.z || (a.horiz ? -1 : 1));

  // the raindrops are drawn from this same stream, lazily, by the turning year (rainOf in year-model.js)
  return { hs, plots, cells, pEdges, sEdges, hairs, clumps, near, far, bunds, rng: r };
}
function hashNum(s) { return typeof s === 'number' ? s : s.length; }

/** The year as numbers, all derived from one clock. */
export function season(t) {
  const P = (w) => phase(t, w[0], w[1]);
  const rain = ease.inOutSine(P(T.rainIn)) * (1 - ease.inOutSine(P(T.rainOut)));
  const water = t < T.waterDown[0]
    ? lerp(-0.05, 1.3, ease.inOutSine(P(T.waterUp)))
    : lerp(1.3, -0.05, ease.inOutSine(P(T.waterDown)));
  return {
    rain, water,
    wetAll: ease.inOutSine(P(T.wetAll)),
    green: ease.inOutSine(phase(t, T.plant + 2, T.plant + 16)),
    ripe: ease.inOutSine(P(T.ripe)),
    cut: lerp(Z_NEAR - 0.2, Z_FAR + 0.4, ease.inOutSine(P(T.cut))),
    dry: P(T.dry),
  };
}

/**
 * Wind at a ground point: a direction from a slowly drifting noise field
 * around the prevailing angle, and a strength with gust bands travelling
 * across the plane. Returns [dx, dz, strength, gust].
 */
export function windAt(gx, gz, t, dir, amp = 1) {
  const a = dir + N(gx * 0.7 + 40, gz * 0.7, t * 0.06) * 1.2;
  const s = gx * Math.cos(dir) + gz * Math.sin(dir);
  const front = s * 1.9 - t * 1.05 + N(gx * 0.45, gz * 0.45 + 9, t * 0.05) * 2.2;
  const env = 0.55 + 0.45 * N(t * 0.07, 3.3, 0.5);
  const gust = Math.pow(0.5 + 0.5 * Math.sin(front), 5) * env * amp;
  const m = 0.2 + 0.1 * N(gx * 1.8, gz * 1.8, t * 0.35) + 0.8 * gust;
  return [Math.cos(a), Math.sin(a), m, gust];
}

/** Just the gust part of windAt: cheaper, for painting wind over wide areas. */
export function gustAt(gx, gz, t, dir) {
  const s = gx * Math.cos(dir) + gz * Math.sin(dir);
  const front = s * 1.9 - t * 1.05 + N(gx * 0.45, gz * 0.45 + 9, t * 0.05) * 2.2;
  return Math.pow(0.5 + 0.5 * Math.sin(front), 5) * (0.55 + 0.45 * N(t * 0.07, 3.3, 0.5));
}

/**
 * The egrets' seeded plan: where each of the two means to stand first, and
 * the rng and the picker their simulation (egrets.js, part of the turning
 * year) goes on drawing from. The still needs only this.
 */
export function egretPlan(seed) {
  const r = rng(`egrets:${seed}`);
  const pick = (near, avoid) => {
    for (let k = 0; k < 20; k++) {
      const gz = near ? clamp(near[1] + r.range(-0.2, 0.2), 1.1, 2.2) : r.range(1.15, 2);
      const gx = near ? near[0] + r.range(-0.3, 0.3) : r.range(-0.75, 0.75) * gz;
      if (Math.abs(gx) > 0.85 * gz) continue;
      if (avoid) { const [ax, ay] = proj(gx, gz); if (Math.hypot(ax - avoid[0], ay - avoid[1]) < 260) continue; }
      return [gx, gz];
    }
    return [r.range(-0.5, 0.5), 1.8];
  };
  const first = pick();
  const birds = [first, pick(first)].map((target, i) => ({ i, g: null, target, state: 'away', dir: 1, walk: 0, peck: 0, wait: r.range(0.5, 2), fly: null, flap: r() * TAU }));
  return { r, pick, birds };
}

/** The still's egrets: both standing where they meant to go, as makeEgrets(seed).settle() places them. */
export function settledEgrets(seed) {
  return egretPlan(seed).birds.map(b => {
    const [gx, gz] = b.target, [x, y] = proj(gx, gz);
    return { b: { ...b, g: b.target, state: 'walk', wait: 1, peck: b.i ? 0.25 : 0, dir: b.i ? -1 : 1 }, gz, x, y, s: 5.2 / gz, fly: false };
  });
}

/** The reduced-motion still: ripening gold in low light, egrets in the rice (the plate's own). */
export const STILL_AT = 61;

/**
 * How each register lives through the year: its pace (the plate's year is 80
 * seconds; warm takes 133), and whether the hand moves the wind.
 */
export const LOOKS = {
  quiet: { pace: 0, touch: false },
  warm: { pace: 0.6, touch: false },
  playful: { pace: 1, touch: true },
};

/** progress 0..1 as a moment of the year, from the dry April field to the dry field again. */
export const localOf = progress => clamp(progress) * (T.cycle - 0.01);

/**
 * The per-frame description. With progress set the year holds at that
 * moment: time stands still and the scene rests until the attribute changes.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const held = params.progress != null;
  const local = held ? localOf(params.progress) : null;
  return { time, seed, register, look, held, local, settled: held };
}
