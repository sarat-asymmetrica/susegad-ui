// Abri: cloud paper. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/abri.js (read only;
// never edited). The plate kept a pure core and it comes across line for line:
// plan(seed) is the whole making (palette, drops, stylus strokes); cloudRows()
// builds a divergence-free drift from domain-warped noise; makeBath() and
// stepBath() move every colour boundary (a drop pushes all the boundaries
// outward exactly, the area-preserving marbling map, and the stylus or a hand
// writes velocity into a field every boundary point is carried through).
// Two small additions for the library: stepBath() leaves alone the points
// under the page's words (B.hold) and the drops the renderer has marked as
// landing there (d.skip); and times(), sheetSeed() and model() below.
// No DOM in any of it.

import { makeNoise, rng, clamp, smoothstep, ease, TAU, measure } from '../../engine/index.js';

/** Is (x, y) inside (or within 30 units of) any rect? */
export const held = (rects, x, y, pad = 30) => rects.some(r => x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad);

// ── Layout ────────────────────────────────────────────────────────────────

export const W = 1200, H = 860;
export const BATH = { x0: 74, y0: 70, x1: 1126, y1: 790 };
export const SHEET = { x0: 116, y0: 110, x1: 1084, y1: 750 };
export const FC = 14, FX0 = BATH.x0 - 28, FY0 = BATH.y0 - 28;
export const FW = Math.ceil((BATH.x1 - BATH.x0 + 56) / FC) + 1, FH = Math.ceil((BATH.y1 - BATH.y0 + 56) / FC) + 1;
export const SIZE = '#e3d7bb';
export const SPEED = 520; // stylus, units per second

export const PALETTES = [
  ['#2f4068', '#c39a4c', '#f2ebd8', '#8a9884'],   // indigo and ochre
  ['#ad6a67', '#7b8b73', '#f2ebd8', '#35476d'],   // madder and grey-green
  ['#c69a4c', '#3d3c3a', '#f2ebd8', '#8a9580'],   // ochre and lamp black
  ['#34466e', '#b3716c', '#f2ebd8', '#c9a55c'],   // indigo and madder
];

// ── Pure core: the making ─────────────────────────────────────────────────

/** Everything that will happen to one sheet, as data. */
export function plan(seed) {
  const r = rng(`abri:${seed}`);
  const cols = PALETTES[Math.floor(r() * PALETTES.length)];
  const inside = m => [r.range(BATH.x0 + m, BATH.x1 - m), r.range(BATH.y0 + m, BATH.y1 - m)];
  const drops = [];
  let t = 1.2;
  // a field of scattered stones first
  for (let i = 0, n = r.int(30, 40); i < n; i++) {
    const [x, y] = inside(30);
    drops.push({ t, x, y, r: r.range(44, 88), col: cols[r.int(0, cols.length - 1)], spread: r.range(1, 1.5) });
    t += r.range(0.08, 0.2);
  }
  // then rings: several drops into the same spot, colours taking turns
  for (let i = 0, n = r.int(3, 5); i < n; i++) {
    const [x, y] = inside(90), k0 = r.int(0, cols.length - 1);
    for (let k = 0, m = r.int(4, 6); k < m; k++) {
      drops.push({ t, x: x + r.gauss() * 2, y: y + r.gauss() * 2, r: r.range(26, 48), col: cols[(k0 + k) % cols.length], spread: r.range(0.8, 1.1) });
      t += r.range(0.2, 0.34);
    }
    t += 0.2;
  }
  const dropsEnd = t + 1.3;
  // the stylus
  const style = r.pick(['gelgit', 'gelgit', 'wave', 'swirl']);
  const paths = [];
  const bw = BATH.x1 - BATH.x0, bh = BATH.y1 - BATH.y0;
  if (style === 'swirl') {
    const cx = BATH.x0 + bw * r.range(0.4, 0.6), cy = BATH.y0 + bh * r.range(0.4, 0.6), turns = r.range(2.6, 3.4), dir = r.sign();
    const pts = [];
    for (let a = 0; a <= turns * TAU; a += 0.08) { const rad = 30 + (a / (turns * TAU)) * 380; pts.push([cx + Math.cos(a * dir) * rad * 1.2, cy + Math.sin(a * dir) * rad * 0.85]); }
    paths.push(pts);
  } else {
    const n = r.int(5, 7), amp = style === 'wave' ? r.range(28, 48) : r.range(5, 12), freq = r.range(0.006, 0.011), ph = r() * TAU;
    for (let k = 0; k < n; k++) {
      const y = BATH.y0 + ((k + 0.5) / n) * bh, pts = [];
      for (let x = BATH.x0 - 40; x <= BATH.x1 + 40; x += 12) pts.push([x, y + amp * Math.sin(x * freq + ph + k * 1.3)]);
      if (k % 2) pts.reverse();
      paths.push(pts);
    }
  }
  const strokes = [];
  t = dropsEnd;
  for (const pts of paths) {
    const m = measure(pts);
    strokes.push({ t0: t, t1: t + m.length / SPEED, m });
    t += m.length / SPEED + 0.45;
  }
  const combEnd = t;
  return { seed, cols, drops, strokes, style, dropsEnd, combEnd, cloud: [combEnd - 1, combEnd + 5.5], lay: combEnd + 6 };
}

/**
 * The slow drift of the size: the curl of domain-warped noise, sampled on the
 * field grid for rows [j0, j1). Curl flow is divergence-free, so colour areas
 * are preserved while they billow.
 */
export function cloudRows(seed, cx, cy, j0, j1) {
  const nz = makeNoise(`abri-cloud:${seed}`), s = 0.0028, e = FC * 0.5;
  const psi = (x, y) => {
    const wx = nz.fbm(x * s, y * s, 1.7, 3), wy = nz.fbm(x * s + 5.2, y * s + 1.3, 4.1, 3);
    return nz.fbm(x * s + 2.2 * wx, y * s + 2.2 * wy, 0.5, 3);
  };
  for (let j = j0; j < Math.min(j1, FH); j++) for (let i = 0; i < FW; i++) {
    const x = FX0 + i * FC, y = FY0 + j * FC, k = j * FW + i;
    cx[k] = (psi(x, y + e) - psi(x, y - e)) / (2 * e) * 400;
    cy[k] = -(psi(x + e, y) - psi(x - e, y)) / (2 * e) * 400;
  }
}

function circle(x, y, rad, n = 32) {
  const pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pts.push(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  return pts;
}

/** A tray of size with nothing on it yet. */
export function makeBath(pl, cloud) {
  return {
    pl, t: 0, steps: 0, polys: [],
    drops: pl.drops.map(d => ({ ...d, poly: null, r2: 0, done: false })),
    vx: new Float32Array(FW * FH), vy: new Float32Array(FW * FH), cx: cloud.cx, cy: cloud.cy,
    inject: [], points: 0,
  };
}

/** Push every boundary outward from (cx, cy) as if a drop of area π·D had landed there. */
export function pushDrop(polys, cx, cy, D) {
  for (const p of polys) {
    const P = p.pts;
    for (let i = 0; i < P.length; i += 2) {
      const dx = P[i] - cx, dy = P[i + 1] - cy, d2 = dx * dx + dy * dy;
      const f = Math.sqrt(1 + D / (d2 > 1e-6 ? d2 : 1e-6));
      P[i] = cx + dx * f; P[i + 1] = cy + dy * f;
    }
  }
}

/** Blend a velocity into the field around (x, y): the fluid near a stylus moves with it. */
export function splat(B, x, y, vx, vy, sigma = 26, k = 0.55) {
  const i0 = Math.max(0, Math.floor((x - 3 * sigma - FX0) / FC)), i1 = Math.min(FW - 1, Math.ceil((x + 3 * sigma - FX0) / FC));
  const j0 = Math.max(0, Math.floor((y - 3 * sigma - FY0) / FC)), j1 = Math.min(FH - 1, Math.ceil((y + 3 * sigma - FY0) / FC));
  const s2 = 2 * sigma * sigma;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const dx = FX0 + i * FC - x, dy = FY0 + j * FC - y, w = Math.exp(-(dx * dx + dy * dy) / s2) * k, c = j * FW + i;
    B.vx[c] += (vx - B.vx[c]) * w; B.vy[c] += (vy - B.vy[c]) * w;
  }
}

/** Where the stylus is at time t, or null. */
export function stylusAt(pl, t) {
  for (const s of pl.strokes) if (t >= s.t0 && t <= s.t1) return s.m.at((t - s.t0) * SPEED);
  return null;
}

/** Keep boundaries smooth: add points where they stretch inside the tray, drop crowded ones. */
export function refine(polys, maxSeg) {
  let total = 0;
  const x0 = BATH.x0 - 20, x1 = BATH.x1 + 20, y0 = BATH.y0 - 20, y1 = BATH.y1 + 20;
  const inB = (x, y) => x > x0 && x < x1 && y > y0 && y < y1;
  for (const p of polys) {
    const P = p.pts, n = P.length / 2, out = [];
    let lx = P[0], ly = P[1];
    out.push(lx, ly);
    for (let i = 1; i <= n; i++) {
      const k = (i % n) * 2, x = P[k], y = P[k + 1];
      const dx = x - lx, dy = y - ly, d = Math.hypot(dx, dy), inside = inB(x, y) || inB(lx, ly);
      const lim = inside ? maxSeg : maxSeg * 5;
      if (d > lim) {
        const m = Math.min(12, Math.ceil(d / lim));
        for (let s = 1; s < m; s++) out.push(lx + (dx * s) / m, ly + (dy * s) / m);
      } else if (d < (inside ? 0.7 : 6) && i < n) continue;
      if (i < n) { out.push(x, y); lx = x; ly = y; }
    }
    p.pts = out;
    total += out.length / 2;
  }
  return total;
}

/** Advance the tray by dt seconds: drops, stylus, pointer, drift. Pure state change. */
export function stepBath(B, dt) {
  const t = B.t + dt, pl = B.pl;
  for (const d of B.drops) {
    if (d.done || d.skip || t < d.t) continue;
    if (!d.poly) { d.poly = { col: d.col, pts: circle(d.x, d.y, 1.5, 36) }; B.polys.push(d.poly); d.r2 = 2.25; }
    const u = clamp((t - d.t) / d.spread), rr = d.r * ease.outCubic(u), r2 = Math.max(2.25, rr * rr);
    if (r2 > d.r2) { pushDrop(B.polys, d.x, d.y, r2 - d.r2); d.r2 = r2; }
    if (u >= 1) d.done = true;
  }
  // the stylus drags the size along with it
  const s1 = stylusAt(pl, t), s0 = stylusAt(pl, B.t);
  if (s1 && s0) splat(B, s1[0], s1[1], (s1[0] - s0[0]) / dt, (s1[1] - s0[1]) / dt, 26, 0.6);
  for (const q of B.inject) splat(B, q.x, q.y, q.vx, q.vy, 30, 0.5);
  B.inject.length = 0;
  // the size is thick: motion dies away within a second or so
  const decay = Math.exp(-dt * 4.2), vx = B.vx, vy = B.vy;
  for (let c = 0; c < vx.length; c++) { vx[c] *= decay; vy[c] *= decay; }
  const cloud = smoothstep(pl.cloud[0], pl.cloud[0] + 2, t) * (1 - smoothstep(pl.cloud[1] - 1.5, pl.cloud[1], t)) * 17;
  const cxA = B.cx, cyA = B.cy, hold = B.hold || [];
  for (const p of B.polys) {
    const P = p.pts;
    for (let i = 0; i < P.length; i += 2) {
      if (hold.length && held(hold, P[i], P[i + 1])) continue;
      let gx = (P[i] - FX0) / FC, gy = (P[i + 1] - FY0) / FC;
      if (gx < 0 || gy < 0 || gx >= FW - 1 || gy >= FH - 1) continue;
      const ix = gx | 0, iy = gy | 0, fx = gx - ix, fy = gy - iy, c = iy * FW + ix;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      let ux = vx[c] * w00 + vx[c + 1] * w10 + vx[c + FW] * w01 + vx[c + FW + 1] * w11;
      let uy = vy[c] * w00 + vy[c + 1] * w10 + vy[c + FW] * w01 + vy[c + FW + 1] * w11;
      if (cloud) {
        ux += cloud * (cxA[c] * w00 + cxA[c + 1] * w10 + cxA[c + FW] * w01 + cxA[c + FW + 1] * w11);
        uy += cloud * (cyA[c] * w00 + cyA[c + 1] * w10 + cyA[c + FW] * w01 + cyA[c + FW + 1] * w11);
      }
      if (ux * ux + uy * uy < 1e-4) continue;
      P[i] += ux * dt; P[i + 1] += uy * dt;
    }
  }
  B.t = t;
  if (++B.steps % 3 === 0) B.points = refine(B.polys, B.points > 50000 ? 9 : B.points > 28000 ? 6.5 : 4.5);
}


// ── The library's additions ───────────────────────────────────────────────

/** When the sheet is laid, rests, lifts, shows its face, leaves and the next begins (the plate's T()). */
export function times(layAt) {
  const lay = layAt, rest = lay + 2.4, lift = rest + 1.1, face = lift + 1.9, out = face + 7.5, end = out + 1.6;
  return { lay, rest, lift, face, out, end };
}

/** The k-th sheet of a sitting: seed 3 makes sheets 3, 4, 5... as the plate did; a word seed counts on too. */
export const sheetSeed = (seed, k) => (typeof seed === 'number' ? seed + k : k ? `${seed}+${k}` : seed);

/**
 * How each register works the tray. `pace` is the tray's clock against the
 * page's (quiet is the finished print as a still); `hand` lets the pointer
 * and the keyboard hand marble the size.
 */
export const LOOKS = {
  quiet: { pace: 0, hand: false },
  warm: { pace: 0.75, hand: false },
  playful: { pace: 1, hand: true },
};

/** The still: the first sheet lifted and turned face up, three seconds into its rest. */
export const stillAt = pl => times(pl.lay).face + 3;

/** The per-frame description; the tray itself is stepped by the renderer, which also answers the hand. */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  return { time, seed, register, look };
}
