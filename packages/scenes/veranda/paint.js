// Veranda: the painter. Everything here is drawn from world.js's own hits, so
// the picture and the depth map agree by construction.
//
//   the G-buffer  every pixel's nearest solid, distance and normal (one pass, shared)
//   the wash      each solid's pigment, lit by the sky and the sun, upscaled soft over paper
//   the shadows   the pillars' and the roof's shadows, traced again whenever the sun moves
//   the ink       the solids' visible edges, courses and joints, hatching where the light is away
//   the lamp      swung by the model, drawn apart from the rest
//
// Nothing in here reads the DOM except canvases it makes itself.

import { rng, clamp, lerp, TAU, smoothstep, ink, N, paper } from '../../engine/index.js';
import {
  W, H, GW, GH, S, EYE, TAN_X, SOLIDS, IDX, gbuffer, trace, isDyn, rayAt, projectM, shadowed, ROOF_A, ROOF_S, roofY, PILLARS, PILLAR,
} from './world.js';

// A painting job is a generator that gives the frame back every few milliseconds, so no task is long.
let sliceAt = 0;
const due = () => performance.now() - sliceAt > 5;
const resumed = () => { sliceAt = performance.now(); };

// ── the shared G-buffer, built once a page and sliced into rows ────────────
let G = null, gJob = null;
/** The G-buffer if it is done. */
export const gReady = () => G;
/** Build it a slice at a time; call step(ms) from the frame loop until it returns the buffer. */
export function gStep(ms = 8) {
  if (G) return G;
  gJob ??= gbuffer(GW, GH, true);
  const t0 = performance.now();
  while (gJob.g.y < GH && performance.now() - t0 < ms) { const y = gJob.g.y; gJob.fill(y, Math.min(GH, y + 16)); gJob.g.y = Math.min(GH, y + 16); }
  if (gJob.g.y >= GH) { G = gJob.g; gJob = null; }
  return G;
}

/** The G-buffer as the still sees it: the swinging lamp taken out, what is behind it traced in its place. */
export function withoutLamp(gb) {
  const z = gb.z.slice(), id = gb.id.slice(), n = gb.n.slice();
  for (let k = 0; k < id.length; k++) {
    if (id[k] < 0 || !isDyn(id[k])) continue;
    const r = trace(((k % gb.w) + 0.5) / gb.w, (((k / gb.w) | 0) + 0.5) / gb.h, isDyn);
    z[k] = r.t; id[k] = r.i; n[k * 3] = r.n[0]; n[k * 3 + 1] = r.n[1]; n[k * 3 + 2] = r.n[2];
  }
  return { ...gb, z, id, n };
}

// ── colour ────────────────────────────────────────────────────────────────
const HEX = h => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const PIG = {
  floor: HEX(0xb45a3c), lime: HEX(0xf3e3c2), plaster: HEX(0xf0e2c4), laterite: HEX(0xc76a44), teak: HEX(0x8a5a33), door: HEX(0x6f4428),
  shutter: HEX(0x3f7f88), tile: HEX(0xb8643c), timber: HEX(0x6a442a), foliage: HEX(0x557f3b), trunk: HEX(0x7a634c), brass: HEX(0xcda43c),
  garden: HEX(0x86a95c), paddy: HEX(0x6fa64a), pot: HEX(0xc0603a),
};
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const hash = (a, b = 0, c = 0) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** The pigment of solid `s` at point p (metres), on a face with normal n. Values 0..255 before light. */
function pigment(s, p, n, mood = 'day') {
  const wet = mood === 'monsoon';
  const [x, y, z] = p;
  const along = Math.abs(n[0]) > 0.5 ? z : x; // along the face, for courses
  switch (s.mat) {
    case 'floor': {
      if (wet) { // the monsoon: the tiles are dark and wet, and puddles on them carry the grey sky
        const puddle = smoothstep(0.1, 0.5, N(p[0] * 1.6, p[2] * 1.6, 8));
        return mix(PIG.floor.map(k => k * 0.62), HEX(0x9aa8a8), puddle * 0.55);
      }
      const tx = Math.floor(x / 0.45), tz = Math.floor(z / 0.45), v = 0.86 + 0.28 * hash(tx, tz, 1);
      return mix(PIG.floor, HEX(0xd58a55), 0.3 * hash(tx, tz, 2) + 0.25 * (N(x * 1.4, z * 1.4, 3) * 0.5 + 0.5)).map(c => c * v);
    }
    case 'lime': case 'plaster': {
      const damp = smoothstep(0.75, 0, y) * (0.5 + 0.5 * N(along * 1.7, y * 2.2, 3));
      let c = mix(PIG[s.mat], HEX(0xa4a58a), damp * 0.5);
      if (s.id === 'wall' && y > 0.5 && y < 0.62) c = mix(c, HEX(0x3f5f93), 0.85); // the painted dado above the plinth
      c = mix(c, HEX(0xd8bd92), smoothstep(0.4, 1, N(along * 0.6, y * 0.5, 9) * 0.5 + 0.5) * 0.35);
      return c;
    }
    case 'laterite': {
      const row = Math.floor(y / 0.2), bx = Math.floor((along + (row & 1) * 0.2) / 0.4), v = 0.8 + 0.34 * hash(row, bx, 4);
      let c = mix(PIG.laterite, HEX(0xdc8a5a), 0.34 * hash(row, bx, 5) + 0.2 * (N(along * 3, y * 3, 8) * 0.5 + 0.5)).map(k => k * v);
      const pore = N(along * 22, y * 22, 6) + 0.5 * N(along * 51, y * 51, 7);
      if (pore > 0.42) c = c.map(k => k * (0.86 - 0.3 * smoothstep(0.42, 0.9, pore))); // pores, in blotches rather than squares
      return c;
    }
    case 'teak': case 'timber': case 'door': {
      const g = 0.86 + 0.2 * N(along * 9, y * 0.7, 12);
      let c = PIG[s.mat].map(k => k * g);
      if (s.mat === 'door') { const pz = ((z - 6.45) / 1.1), py = y / 2.2, panel = pz > 0.12 && pz < 0.88 && (py > 0.08 && py < 0.44 || py > 0.52 && py < 0.92); if (panel) c = c.map(k => k * 1.16); }
      return c;
    }
    case 'shutter': return PIG.shutter.map(k => k * (0.82 + 0.3 * Math.abs(Math.sin(y * 46))));
    case 'tile': {
      // the underside of the tiles between the rafters and battens: warm, with the timber dark
      const rx = ((x + 1.35) / 0.7) % 1, bz = (z / 0.36) % 1;
      const timber = rx < 0.07 || rx > 0.93 || bz < 0.08;
      return timber ? PIG.timber.map(k => k * 0.8) : PIG.tile.map(k => k * (0.84 + 0.3 * hash(Math.floor((x + 1.35) / 0.7), Math.floor(z / 0.36), 7)));
    }
    case 'foliage': {
      const d = N(x * 3.1, y * 3.1, z * 2.3) * 0.5 + 0.5;
      return mix(HEX(0x3f6a30), HEX(0x86ad4c), d * d).map(k => k * (0.86 + 0.28 * hash(Math.floor(x * 9), Math.floor(y * 9), 8)));
    }
    case 'pot': return PIG.pot.map(k => k * (0.86 + 0.24 * Math.abs(Math.sin(y * 20)) + 0.1 * N(x * 6, y * 6, 3)));
    case 'trunk': return PIG.trunk.map(k => k * (0.8 + 0.3 * Math.abs(Math.sin(y * 9 + N(x, z) * 3))));
    case 'garden': {
      const patch = smoothstep(0.2, 0.9, N(x * 0.5, z * 0.5, 2) * 0.5 + 0.5);
      return wet ? mix(HEX(0x5f8e4a), HEX(0x477a3c), patch) : mix(mix(PIG.garden, HEX(0xb2b565), patch * 0.6), HEX(0xc9a877), smoothstep(0.62, 0.9, N(x * 1.3, z * 1.3, 5) * 0.5 + 0.5) * 0.45);
    }
    case 'paddy': {
      // plots divided by bunds, some flooded (they carry the sky), some in stalk
      const px = Math.floor(x / 11 + N(z * 0.03, 1) * 0.6), pz = Math.floor(z / 9), r = hash(px, pz, 11);
      let c = mix(mix(PIG.paddy, HEX(0xb9c667), r), HEX(0x4f8d43), hash(px, pz, 12) * 0.5);
      if (r > (wet ? 0.3 : 0.86)) c = mix(c, HEX(0xa9c6d0), wet ? 0.7 : 0.5); // flooded plots carry the sky; in the monsoon most of them are
      const bx = Math.abs(((x / 11 + N(z * 0.03, 1) * 0.6) % 1 + 1) % 1 - 0.5), bz = Math.abs(((z / 9) % 1 + 1) % 1 - 0.5);
      if (bx > 0.46 || bz > 0.47) c = mix(c, HEX(0x9b9058), 0.75);
      return c;
    }
    default: return PIG.lime;
  }
}

// ── the light ──────────────────────────────────────────────────────────────
export const LIGHT = {
  day: { amb: [1.0, 0.98, 1.02], ambK: 0.84, sun: 0.5, sunCol: [1.0, 0.92, 0.78], haze: HEX(0xdfe3da) },
  dusk: { amb: [0.62, 0.7, 1.05], ambK: 0.5, sun: 0, sunCol: [1, 0.6, 0.4], haze: HEX(0x8a80a8) },
  monsoon: { amb: [0.86, 0.98, 1.0], ambK: 0.74, sun: 0, sunCol: [1, 1, 1], haze: HEX(0x9fb0b0) },
};
const LAMP = [0.25, 2.28, 4.4];

/** How lit a surface with normal n is by the sky alone: the opening's side is brighter, the roof's underside dark. */
const skyLight = n => clamp(0.64 + 0.14 * n[0] + 0.16 * n[1], 0.46, 0.92);

/** A crude screen-space occlusion: nearer surfaces beside a pixel darken it, so seats sit on the floor and the roof meets the wall. */
function ao(g, x, y, k) {
  const z = g.z[k];
  let o = 0;
  for (const [dx, dy] of AO_TAPS) {
    const xx = x + dx, yy = y + dy;
    if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
    const q = yy * g.w + xx, zq = g.id[q] < 0 ? Infinity : g.z[q];
    if (zq < z - 0.05) o += Math.min(1, (z - zq) / 0.5);
  }
  return 1 - 0.34 * o / AO_TAPS.length;
}
const AO_TAPS = [[6, 0], [-6, 0], [0, 6], [0, -6], [4, 4], [-4, -4], [4, -4], [-4, 4], [14, 0], [-14, 0], [0, 14], [0, -14], [10, 10], [-10, -10], [10, -10], [-10, 10]];

/** The wash colour (0..255) at a G-buffer pixel, lit by the sky, the rest sun and (at dusk) the lamp. */
function washAt(g, k, L, look) {
  const i = g.id[k], s = SOLIDS[i];
  const t = g.z[k], u = ((k % g.w) + 0.5) / g.w, v = (((k / g.w) | 0) + 0.5) / g.h, [dx, dy] = rayAt(u, v);
  const n = [g.n[k * 3], g.n[k * 3 + 1], g.n[k * 3 + 2]], p = [dx * t / S, dy * t / S + EYE, t / S];
  let c = pigment(s, p, n, look.mood);
  const lt = LIGHT[look.mood], sl = skyLight(n) * lt.ambK / 0.62 * (0.94 + 0.12 * N(u * 5, v * 5, 4)), ndl = Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
  const f = [0, 1, 2].map(a => lt.amb[a] * sl + lt.sun * ndl * lt.sunCol[a]);
  if (look.mood === 'dusk') {
    const dxl = LAMP[0] - p[0], dyl = LAMP[1] - p[1], dzl = LAMP[2] - p[2], d = Math.hypot(dxl, dyl, dzl) || 1;
    const nl = Math.max(0, (n[0] * dxl + n[1] * dyl + n[2] * dzl) / d) * 1.55 / (1 + (d / 1.5) ** 2);
    f[0] += nl; f[1] += nl * 0.72; f[2] += nl * 0.36;
  }
  // a wash is laid in layers, not as a gradient: the light steps in a few tones, and only softens between them
  const m = (f[0] + f[1] + f[2]) / 3, band = Math.round(m * 5.5) / 5.5, kb = (0.6 * band + 0.4 * m) / (m || 1);
  c = c.map((v, a) => Math.min(255, v * f[a] * kb));
  const fog = 1 - Math.exp(-(t / S) / 48); // distance haze: things far off go pale and blue-grey
  return { c: mix(c, lt.haze, fog * 0.8), tone: (f[0] + f[1] + f[2]) / 3 };
}

// ── strokes ───────────────────────────────────────────────────────────────
const SEPIA = '#2a1c12';

/** Sample a 3D line (metres) into runs of picture points that the G-buffer says are visible. */
function visibleRuns(g, a, b, step = 3) {
  // clip to the front of the camera
  const z0 = a[2] * S, z1 = b[2] * S, zmin = 0.06;
  let t0 = 0, t1 = 1;
  if (z0 < zmin && z1 < zmin) return [];
  if (z0 < zmin) t0 = (zmin - z0) / (z1 - z0); else if (z1 < zmin) t1 = (zmin - z0) / (z1 - z0);
  const P = q => [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q, a[2] + (b[2] - a[2]) * q];
  const A = projectM(...P(t0)), B = projectM(...P(t1)), len = Math.hypot((B[0] - A[0]) * W, (B[1] - A[1]) * H);
  if (len > 6000) return [];
  const n = Math.max(2, Math.ceil(len / step)), runs = [];
  let cur = null;
  for (let i = 0; i <= n; i++) {
    const q = lerp(t0, t1, i / n), [u, v, Z] = projectM(...P(q));
    let vis = u >= 0 && u <= 1 && v >= 0 && v <= 1;
    if (vis) {
      const cx = Math.min(g.w - 1, Math.max(0, Math.floor(u * g.w))), cy = Math.min(g.h - 1, Math.max(0, Math.floor(v * g.h)));
      let zm = Infinity;
      for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
        const x = Math.min(g.w - 1, Math.max(0, cx + k)), y = Math.min(g.h - 1, Math.max(0, cy + j)), gi = y * g.w + x;
        if (g.id[gi] >= 0 && g.z[gi] < zm) zm = g.z[gi];
      }
      vis = Z <= zm * 1.05 + 0.03;
    }
    if (vis) (cur ??= []).push([u * W, v * H, Z]); else if (cur) { runs.push(cur); cur = null; }
  }
  if (cur) runs.push(cur);
  return runs.filter(r => r.length > 1);
}

/** A box's twelve edges, in metres. */
function boxEdges(s) {
  const [x0, y0, z0] = [s.min[0] / S, s.min[1] / S + EYE, s.min[2] / S], [x1, y1, z1] = [s.max[0] / S, s.max[1] / S + EYE, s.max[2] / S];
  const e = [];
  for (const y of [y0, y1]) for (const z of [z0, z1]) e.push([[x0, y, z], [x1, y, z]]);
  for (const x of [x0, x1]) for (const z of [z0, z1]) e.push([[x, y0, z], [x, y1, z]]);
  for (const x of [x0, x1]) for (const y of [y0, y1]) e.push([[x, y, z0], [x, y, z1]]);
  return e;
}
/** Where a vertical cylinder's or an ellipsoid's outline runs, as short 3D segments (metres). */
function roundEdges(s) {
  const out = [];
  if (s.k === 'cyl') {
    const cx = s.c[0] / S, cz = s.c[1] / S, r = s.r / S, y0 = s.y0 / S + EYE, y1 = s.y1 / S + EYE, ang = Math.atan2(cx, cz);
    for (const sg of [-1, 1]) { const x = cx + sg * r * Math.cos(ang), z = cz - sg * r * Math.sin(ang); out.push([[x, y0, z], [x, y1, z]]); }
    return out;
  }
  // an ellipsoid: a ring perpendicular to the view direction, scaled by its radii
  const c = [s.c[0] / S, s.c[1] / S + EYE, s.c[2] / S], r = s.r.map(v => v / S), vx = c[0], vy = c[1] - EYE, vz = c[2], vl = Math.hypot(vx, vy, vz);
  const d = [vx / vl, vy / vl, vz / vl], up = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const a = norm(cross(d, up)), b = cross(a, d);
  const ring = [];
  for (let i = 0; i <= 28; i++) { const t = i / 28 * TAU; ring.push([c[0] + (Math.cos(t) * a[0] + Math.sin(t) * b[0]) * r[0], c[1] + (Math.cos(t) * a[1] + Math.sin(t) * b[1]) * r[1], c[2] + (Math.cos(t) * a[2] + Math.sin(t) * b[2]) * r[2]]); }
  for (let i = 0; i < 28; i++) out.push([ring[i], ring[i + 1]]);
  return out;
}
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(...a) || 1; return a.map(v => v / l); };

/** The courses of laterite, the joints of the floor, the roof's rafters and battens, the louvres and the door's panels, as 3D segments (metres). */
function detailLines() {
  const L = { course: [], joint: [], roof: [], louvre: [], panel: [], edge: [] };
  // laterite courses on a pillar's two faces that face the veranda
  for (const zc of PILLARS) for (let y = 0.5; y < 2.0; y += 0.2) {
    L.course.push([[1.32, y, zc - PILLAR], [1.32, y, zc + PILLAR]], [[1.32, y, zc - PILLAR], [1.68, y, zc - PILLAR]]);
    const row = Math.round((y - 0.5) / 0.2) & 1;
    L.course.push([[1.32, y, zc - PILLAR + (row ? 0.09 : 0.24)], [1.32, y + 0.2, zc - PILLAR + (row ? 0.09 : 0.24)]]);
    L.course.push([[1.32 + (row ? 0.12 : 0.26), y, zc - PILLAR], [1.32 + (row ? 0.12 : 0.26), y + 0.2, zc - PILLAR]]);
  }
  // the floor: joints every 0.45 m
  for (let x = -1.35; x <= 1.7; x += 0.45) L.joint.push([[x, 0, 0.3], [x, 0, 13]]);
  for (let z = 0.3; z <= 13; z += 0.45) L.joint.push([[-1.35, 0, z], [1.68, 0, z]]);
  // the roof: rafters run along z, battens across
  for (let x = -1.35; x <= 2.4; x += 0.7) L.roof.push([[x, roofY(x) - 0.02, 0.3], [x, roofY(x) - 0.02, 13.4]]);
  for (let z = 0.3; z <= 13.4; z += 0.36) L.roof.push([[-1.35, roofY(-1.35) - 0.02, z], [2.4, roofY(2.4) - 0.02, z]]);
  // the shutter's louvres, the door's panels
  for (let y = 1.0; y < 2.13; y += 0.075) L.louvre.push([[-1.26, y, 3.9], [-1.26, y, 4.9]]);
  for (const [p0, p1, q0, q1] of [[0.08, 0.44, 0.12, 0.88], [0.52, 0.92, 0.12, 0.88]]) {
    const yy0 = p0 * 2.2, yy1 = p1 * 2.2, zz0 = 6.45 + q0 * 1.1, zz1 = 6.45 + q1 * 1.1;
    L.panel.push([[-1.24, yy0, zz0], [-1.24, yy0, zz1]], [[-1.24, yy1, zz0], [-1.24, yy1, zz1]], [[-1.24, yy0, zz0], [-1.24, yy1, zz0]], [[-1.24, yy0, zz1], [-1.24, yy1, zz1]]);
  }
  // the wall meeting the floor and the roof, and the roof's far edge
  L.edge.push([[-1.35, 0, 0.3], [-1.35, 0, 13]], [[-1.35, ROOF_A + ROOF_S * -1.35, 0.3], [-1.35, ROOF_A + ROOF_S * -1.35, 13]], [[-1.35, roofY(-1.35), 13.4], [2.4, roofY(2.4), 13.4]]);
  // the eave: Mangalore tile ends along it, drawn as small scallops
  return L;
}

// ── the painter ───────────────────────────────────────────────────────────
/**
 * @param {{ mode: 'ink'|'hair', mood: 'day'|'dusk', px: number, paperInk: string, paper: string, seed?: number }} o
 */
export function createPainter(o) {
  const { mode, mood } = o, px = o.px, look = { mood };
  const cw = Math.round(W * px), ch = Math.round(H * px);
  const mk = (w = cw, h = ch) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const L = [0.6, 0.66, 0.46];
  let wash = null, inkLayer = null, base = null, wbuf = null;
  let shadowKey = '', shadow = null;
  const lightBuf = new Float32Array(GW * GH);
  const c2 = c => { const g = c.getContext('2d'); g.setTransform(px, 0, 0, px, 0, 0); return g; };
  const inkCol = () => (mood === 'dusk' && mode !== 'hair' ? '#0e0b14' : o.paperInk ?? SEPIA);

  function paintSky(g) {
    const dusk = mood === 'dusk', rainy = mood === 'monsoon', hy = H * 0.5;
    const gr = g.createLinearGradient(0, 0, 0, hy + 10);
    if (rainy) { gr.addColorStop(0, '#6f8083'); gr.addColorStop(0.55, '#9aa9a8'); gr.addColorStop(1, '#c9d2ce'); }
    else if (dusk) { gr.addColorStop(0, '#2b3066'); gr.addColorStop(0.55, '#7a5f92'); gr.addColorStop(0.9, '#e79a62'); gr.addColorStop(1, '#f4c58a'); }
    else { gr.addColorStop(0, '#79a6c8'); gr.addColorStop(0.6, '#b9d0dc'); gr.addColorStop(1, '#f1e6cb'); }
    g.fillStyle = gr; g.fillRect(0, 0, W, hy + 12);
    // a few soft clouds, and two ranges of hills at the horizon
    const r = rng('veranda:sky');
    g.save();
    for (let i = 0; i < 7; i++) {
      const x = r.range(0, W), y = r.range(hy * 0.25, hy * 0.85), w = r.range(120, 320);
      g.globalAlpha = rainy ? 0.5 : dusk ? 0.18 : 0.45; g.fillStyle = rainy ? '#56666b' : dusk ? '#f0b090' : '#ffffff';
      g.beginPath(); g.ellipse(x, y, w, w * 0.12, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(x + w * 0.3, y - w * 0.06, w * 0.55, w * 0.1, 0, 0, TAU); g.fill();
    }
    g.restore();
    for (const [amp, base, col, seed, al] of [[46, 22, dusk ? '#4a4574' : '#97b0b5', 3, 0.85], [24, 8, dusk ? '#38345e' : '#7fa0a0', 8, 0.95]]) {
      g.fillStyle = col; g.globalAlpha = al; g.beginPath(); g.moveTo(0, hy + 12);
      for (let x = 0; x <= W; x += 10) g.lineTo(x, hy - base - (N(x * 0.006, seed) * 0.5 + 0.5) * amp);
      g.lineTo(W, hy + 12); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    // the far line of trees along the horizon
    const t = rng('veranda:trees');
    for (let x = -10; x < W + 10; x += t.range(8, 20)) {
      const h = t.range(4, 15), rr = t.range(6, 13);
      g.fillStyle = dusk ? '#2a3a3f' : (t() > 0.5 ? '#5f8a58' : '#6f9a5e'); g.globalAlpha = 0.9;
      g.beginPath(); g.ellipse(x, hy - h * 0.3, rr, h, 0, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
  }

  /** The wash: per-pixel pigment from the G-buffer, on a small canvas, upscaled soft. */
  function* paintWash(g, gb) {
    const small = mk(GW, GH), sg = small.getContext('2d'), raw = new Uint8ClampedArray(GW * GH * 4);
    resumed();
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const k = y * GW + x, j = k * 4, i = gb.id[k];
        if (i < 0) continue;
        const { c, tone } = washAt(gb, k, L, look);
        // pigment pools where two solids meet, the way a wet edge darkens as it dries
        const pool = ((x + 1 < GW && gb.id[k + 1] !== i) || (y + 1 < GH && gb.id[k + GW] !== i) ? 0.9 : 1) * ao(gb, x, y, k);
        lightBuf[k] = tone * pool;
        raw[j] = c[0] * pool; raw[j + 1] = c[1] * pool; raw[j + 2] = c[2] * pool; raw[j + 3] = 255;
      }
      if (due()) { yield; resumed(); }
    }
    // the colour drifts a pixel or two from the line, as a hand-laid wash does: warp the wash by a slow noise
    const img = sg.createImageData(GW, GH);
    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        const sx = clamp(Math.round(x + N(x * 0.045, y * 0.045, 1) * 3.2), 0, GW - 1), sy = clamp(Math.round(y + N(x * 0.045 + 9, y * 0.045, 2) * 3.2), 0, GH - 1), a = (sy * GW + sx) * 4, j = (y * GW + x) * 4;
        img.data[j] = raw[a]; img.data[j + 1] = raw[a + 1]; img.data[j + 2] = raw[a + 2]; img.data[j + 3] = raw[a + 3];
      }
      if (due()) { yield; resumed(); }
    }
    sg.putImageData(img, 0, 0);
    g.save(); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
    g.drawImage(small, 0, 0, W, H);
    g.restore();
  }

  /** The ink: edges, courses, joints, hatching, foliage. */
  function* paintInk(g, gb) {
    const col = inkCol(), hair = mode === 'hair', line = (runs, w, alpha, seed, jit = 0.5, twice = false) => {
      for (const r of runs) {
        const z = r[Math.floor(r.length / 2)][2], k = hair ? 1 : clamp(1.7 / z, 0.55, 1.5);
        let pts = r.map(p => [p[0], p[1]]);
        if (twice && pts.length > 3) { // the pen runs a little past each corner
          const a = pts[0], b = pts[1], c = pts.at(-1), d = pts.at(-2), la = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, lc = Math.hypot(c[0] - d[0], c[1] - d[1]) || 1;
          pts = [[a[0] + (a[0] - b[0]) / la * 3.5, a[1] + (a[1] - b[1]) / la * 3.5], ...pts, [c[0] + (c[0] - d[0]) / lc * 3.5, c[1] + (c[1] - d[1]) / lc * 3.5]];
        }
        ink(g, pts, { width: w * k, color: col, alpha, jitter: jit, seed, taper: 6, step: 2.5 });
        if (twice && !hair) ink(g, pts, { width: w * k * 0.5, color: col, alpha: alpha * 0.4, jitter: jit * 1.6, seed: seed + 50, taper: 10, step: 3 });
      }
    };
    let seed = 1;
    // 1 outlines
    for (let i = 0; i < SOLIDS.length; i++) {
      const s = SOLIDS[i];
      if (s.dyn || s.k === 'pl') continue;
      const edges = s.k === 'box' ? boxEdges(s) : roundEdges(s);
      for (const [a, b] of edges) line(visibleRuns(gb, a, b), s.k === 'box' ? 1.7 : 1.5, 0.9, seed++, 0.5, s.k === 'box');
      if (due()) { yield; resumed(); }
    }
    const D = detailLines();
    for (const [a, b] of D.edge) line(visibleRuns(gb, a, b), 2, 0.9, seed++);
    yield;
    // 2 detail lines: lighter than the outlines
    for (const [set, w, al] of [[D.course, 0.8, 0.5], [D.joint, 0.9, 0.42], [D.roof, 0.9, 0.5], [D.louvre, 0.7, 0.55], [D.panel, 0.9, 0.55]]) {
      if (hair && set === D.course) continue;
      for (const [a, b] of set) { line(visibleRuns(gb, a, b, 4), w, al, seed++, 0.3); if (due()) { yield; resumed(); } }
    }
    if (hair) return;
    // 3 hatching where the light is away: strokes follow the surface (upright on walls, slanting on the floor)
    const r = rng('veranda:hatch'), paths = new Map();
    let drawn = 0;
    const stroke = (x, y, a, len, alpha, w) => {
      const key = `${alpha.toFixed(2)}|${w}|${Math.floor(drawn++ / 2000)}`; // small paths, so each stroke() is a short task
      let p = paths.get(key); if (!p) paths.set(key, p = new Path2D());
      p.moveTo(x, y); p.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len + (r() - 0.5) * 1.5);
    };
    for (let k = 0; k < 60000; k++) {
      if (k % 1000 === 999 && due()) { yield; resumed(); }
      const x = r() * W, y = r() * H, gi = Math.min(GH - 1, (y / H * GH) | 0) * GW + Math.min(GW - 1, (x / W * GW) | 0), i = gb.id[gi];
      if (i < 0) continue;
      const s = SOLIDS[i], dark = (1 - smoothstep(...(mood === 'dusk' ? [0.1, 0.5] : [0.32, 0.86]), lightBuf[gi])) * (mood === 'dusk' ? 0.6 : 1);
      if (r() > dark * 1.1) continue;
      const m = s.mat, nx = gb.n[gi * 3], ny = gb.n[gi * 3 + 1];
      if (m === 'foliage' || m === 'paddy' || m === 'garden') continue;
      const a = m === 'floor' ? -0.35 + (r() - 0.5) * 0.2 : Math.abs(ny) > 0.6 ? -0.5 : Math.PI / 2 + (r() - 0.5) * 0.18 + nx * 0.06;
      stroke(x, y, a, r.range(6, 16), 0.2 + dark * 0.28, 0.85);
    }
    g.save(); g.lineCap = 'round'; g.strokeStyle = col;
    for (const [key, p] of paths) { const [al, w] = key.split('|'); g.globalAlpha = +al; g.lineWidth = +w; g.stroke(p); yield; }
    g.restore();
    yield;
    // 4 foliage: leaf dabs over the crowns and hedges, in two greens and a light
    const f = rng('veranda:leaf'), dabs = [[], [], []];
    for (let k = 0; k < 16000; k++) {
      if (k % 1000 === 999 && due()) { yield; resumed(); }
      const x = f() * W, y = f() * H, gi = Math.min(GH - 1, (y / H * GH) | 0) * GW + Math.min(GW - 1, (x / W * GW) | 0), i = gb.id[gi];
      if (i < 0 || SOLIDS[i].mat !== 'foliage') continue;
      const z = gb.z[gi], sz = clamp(4.5 / z, 2, 8), tone = lightBuf[gi];
      // the light dabs stay inside the crown: on its rim, where the sun catches every edge, they made a pale dotted contour against the sky
      const rim = [-5, 5].some(d => gb.id[gi + d] !== i || gb.id[gi + d * GW] !== i);
      (dabs[tone > 1 && !rim ? 2 : f() > 0.5 ? 0 : 1]).push([x, y, sz * (0.6 + f() * 0.9), f() * TAU]);
    }
    g.save();
    for (const [n, c] of [[0, mood === 'dusk' ? '#1c2a28' : '#2f5a2e'], [1, mood === 'dusk' ? '#26382f' : '#3f7137'], [2, mood === 'dusk' ? '#4d5a42' : '#c7d67a']]) {
      g.fillStyle = c; g.globalAlpha = n === 2 ? 0.55 : 0.6;
      for (let i = 0; i < dabs[n].length; i += 1500) {
        g.beginPath();
        for (const [x, y, s, a] of dabs[n].slice(i, i + 1500)) { g.moveTo(x + s, y); g.ellipse(x, y, s, s * 0.5, a, 0, TAU); }
        g.fill(); yield;
      }
    }
    g.restore();
    // the trees and palms: drooping fronds over the palm crowns, an inked scalloped outline for the mango
    palmFronds(g, gb, col);
    yield;
    tileEnds(g, gb, col);
    if (mood === 'monsoon') yield* rain(g, gb);
  }

  /** Where solid `i` shows in the G-buffer, as a small canvas (alpha 255 there, grown by a pixel), or null when it does not show. */
  function maskOf(gb, i) {
    const img = new ImageData(gb.w, gb.h);
    let n = 0;
    for (let y = 0; y < gb.h; y++) for (let x = 0; x < gb.w; x++) {
      const k = y * gb.w + x;
      if (gb.id[k] === i || (x + 1 < gb.w && gb.id[k + 1] === i) || (y + 1 < gb.h && gb.id[k + gb.w] === i)) { img.data[k * 4 + 3] = 255; n++; }
    }
    if (n < 30) return null;
    const c = mk(gb.w, gb.h); c.getContext('2d').putImageData(img, 0, 0);
    return c;
  }
  /** Draw with `draw(g)` on a scratch layer, keep only what the solid's own pixels show (so a leaf never crosses a pillar), and lay it on `g`. */
  function masked(g, gb, id, draw) {
    const m = maskOf(gb, IDX[id]);
    if (!m) return;
    const t = mk(), tg = c2(t);
    draw(tg);
    tg.save(); tg.setTransform(1, 0, 0, 1, 0, 0); tg.globalCompositeOperation = 'destination-in'; tg.imageSmoothingEnabled = true; tg.drawImage(m, 0, 0, t.width, t.height); tg.restore();
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(t, 0, 0); g.restore();
  }

  /** The monsoon's rain, inked: slanted streaks over the open air, and rings where it lands on the tiles. Seeded, so it is the same rain. */
  function* rain(g, gb) {
    const r = rng('veranda:rain'), open = new Set(['garden', 'paddy', 'foliage', 'trunk']), light = new Path2D(), slate = new Path2D(), rings = new Path2D();
    for (let k = 0; k < 5200; k++) {
      if (k % 900 === 899 && due()) { yield; resumed(); }
      const x = r() * W, y = r() * H, gi = Math.min(GH - 1, (y / H * GH) | 0) * GW + Math.min(GW - 1, (x / W * GW) | 0), i = gb.id[gi];
      const mat = i < 0 ? 'sky' : SOLIDS[i].mat;
      if (mat === 'floor') { if (r() < 0.10) { const rr = 2 + r() * 5; rings.moveTo(x + rr * 2, y); rings.ellipse(x, y, rr * 2, rr * 0.6, 0, 0, TAU); } continue; }
      if (mat !== 'sky' && !open.has(mat)) continue;
      const len = 16 + r() * 22, dx = len * 0.22;
      (mat === 'sky' ? slate : light).moveTo(x, y); (mat === 'sky' ? slate : light).lineTo(x - dx, y + len);
    }
    g.save(); g.lineCap = 'round';
    g.lineWidth = 1; g.globalAlpha = 0.42; g.strokeStyle = '#eef4f4'; g.stroke(light); yield;
    g.globalAlpha = 0.3; g.strokeStyle = '#4f6068'; g.stroke(slate); yield;
    g.lineWidth = 0.9; g.globalAlpha = 0.5; g.strokeStyle = '#e6eeee'; g.stroke(rings);
    g.restore();
  }

  function palmFronds(g, gb, col) {
    for (const id of ['banana', 'banana2', 'fern1', 'fern2', 'fern3']) {
      const s = SOLIDS[IDX[id]], [u, v, Z] = projectM(s.c[0] / S, s.c[1] / S + EYE, s.c[2] / S);
      const X = u * W, Y = v * H, rad = 0.5 * W * s.r[0] / (Z * TAN_X) * 1.1, r = rng(`veranda:${id}`), n = id.startsWith('fern') ? 11 : 9;
      masked(g, gb, id, h => {
        for (let k = 0; k < n; k++) {
          const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 3.1 + r.range(-0.15, 0.15), len = rad * r.range(0.8, 1.1), pts = [], w = 11 * (rad / 90);
          for (let t = 0; t <= 1.001; t += 0.1) pts.push([X + Math.cos(a) * len * t, Y + rad * 0.3 + Math.sin(a) * len * t + t * t * len * 0.6]);
          h.beginPath(); pts.forEach((p, i) => (i ? h.lineTo(p[0], p[1]) : h.moveTo(p[0], p[1])));
          for (let i = pts.length - 1; i >= 0; i--) h.lineTo(pts[i][0] + Math.sin(Math.PI * i / 10) * w * 0.6, pts[i][1] + Math.sin(Math.PI * i / 10) * w);
          h.closePath(); h.globalAlpha = 0.85; h.fillStyle = mood === 'dusk' ? '#233a2a' : k % 2 ? '#5f9540' : '#4f8636'; h.fill();
          h.globalAlpha = 0.9; h.strokeStyle = col; h.lineWidth = 1; h.stroke();
        }
      });
    }
    for (const id of ['palm1c', 'palm2c', 'palm3c']) {
      const s = SOLIDS[IDX[id]], cx = s.c[0] / S, cy = s.c[1] / S + EYE, cz = s.c[2] / S;
      const [u, v, Z] = projectM(cx, cy, cz), X = u * W, Y = v * H, rad = 0.5 * W * s.r[0] / (Z * TAN_X), r = rng(`veranda:${id}`);
      masked(g, gb, id, h => {
        for (let k = 0; k < 15; k++) {
          const a = k / 15 * TAU + r.range(-0.2, 0.2), len = rad * r.range(0.8, 1.1), pts = [];
          for (let t = 0; t <= 1.001; t += 0.125) pts.push([X + Math.cos(a) * len * t, Y + Math.sin(a) * len * t * 0.55 + t * t * len * 0.55]);
          ink(h, pts, { width: 2.1, color: mood === 'dusk' ? '#151d1c' : '#2c5a30', alpha: 0.85, jitter: 0.5, seed: k + 3, taper: 10 });
          for (let t = 0.2; t < 0.98; t += 0.09) {
            const p = pts[Math.min(pts.length - 1, Math.floor(t * 8))];
            h.strokeStyle = mood === 'dusk' ? '#151d1c' : '#3a6a34'; h.globalAlpha = 0.6; h.lineWidth = 0.8; h.beginPath(); h.moveTo(p[0], p[1]); h.lineTo(p[0] + Math.cos(a + 1.5) * 8, p[1] + 7); h.moveTo(p[0], p[1]); h.lineTo(p[0] + Math.cos(a - 1.5) * 8, p[1] + 7); h.stroke();
          }
          h.globalAlpha = 1;
        }
      });
    }
  }

  /** Mangalore tile ends along the eave: small scallops in red, drawn on the fascia's underside. */
  function tileEnds(g, gb, col) {
    const a = [2.4, roofY(2.4), 0.3], b = [2.4, roofY(2.4), 13.4];
    for (const run of visibleRuns(gb, [a[0], a[1] + 0.06, a[2]], [b[0], b[1] + 0.06, b[2]], 5)) {
      for (let i = 0; i + 1 < run.length; i += 2) {
        const p = run[i], q = run[i + 1], w = Math.hypot(q[0] - p[0], q[1] - p[1]);
        g.fillStyle = mood === 'dusk' ? '#5a2a26' : '#b45638'; g.globalAlpha = 0.9;
        g.beginPath(); g.moveTo(p[0], p[1]); g.quadraticCurveTo((p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + w * 0.7, q[0], q[1]); g.closePath(); g.fill();
        g.strokeStyle = col; g.globalAlpha = 0.7; g.lineWidth = 0.9; g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  return {
    mode, mood,
    /** A paint job: yields between steps. Needs the G-buffer. */
    *build(gbFull, Ls = null) {
      const gb = wbuf = withoutLamp(gbFull);
      yield;
      base = mk(); const bg = c2(base);
      if (mode === 'hair') { bg.fillStyle = o.paper; bg.fillRect(0, 0, W, H); }
      else paper(bg, W, H, { base: '#f2ecdc', seed: 5, mottle: 0.1, grain: 0.11, fibers: 110, vignette: 0.12 });
      yield;
      if (mode !== 'hair') {
        wash = mk(); const wg = c2(wash);
        paintSky(wg); yield;
        yield* paintWash(wg, gb);
      }
      inkLayer = mk();
      yield* paintInk(c2(inkLayer), gb);
      if (Ls) yield* this.shadowJob(Ls, 1); // the first sun's shadows, a few rows a frame like the rest
    },
    get built() { return !!inkLayer; },
    /**
     * Cast shadows for sun direction Ls, on a small canvas (null in the dark and in hairline): each pixel of the grid traces the
     * solids toward the sun. A generator, so the first sun can be traced a few rows a frame inside the build.
     */
    *shadowJob(Ls, q = 1) {
      const gb = wbuf;
      if (!gb || mode === 'hair' || mood !== 'day') return null;
      const key = Ls.map(v => v.toFixed(3)).join() + (q > 0.5);
      if (key === shadowKey && shadow) return shadow;
      const sw = q > 0.5 ? 300 : 150, sh = sw * 2 / 3, c = shadow && shadow.width === sw ? shadow : mk(sw, sh), g = c.getContext('2d'), img = g.createImageData(sw, sh), lt = LIGHT[mood];
      resumed();
      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const gx = Math.min(GW - 1, Math.floor((x + 0.5) / sw * GW)), gy = Math.min(GH - 1, Math.floor((y + 0.5) / sh * GH)), gi = gy * GW + gx, i = gb.id[gi], j = (y * sw + x) * 4;
          let ratio = 1;
          if (i >= 0) {
            const nx = gb.n[gi * 3], ny = gb.n[gi * 3 + 1], nz = gb.n[gi * 3 + 2], ndl = nx * Ls[0] + ny * Ls[1] + nz * Ls[2];
            if (ndl > 0.02) {
              const t = gb.z[gi], [dx, dy] = rayAt((gx + 0.5) / GW, (gy + 0.5) / GH);
              const p = [dx * t + nx * 4e-4, dy * t + ny * 4e-4, t + nz * 4e-4];
              if (shadowed(p, Ls, i)) { const sl = skyLight([nx, ny, nz]) * lt.ambK / 0.62, sun = lt.sun * ndl; ratio = sl / (sl + sun); }
            }
          }
          img.data[j] = 255 * Math.min(1, ratio * 1.04); img.data[j + 1] = 255 * Math.min(1, ratio * 0.97); img.data[j + 2] = 255 * Math.min(1, ratio * 1.0); img.data[j + 3] = 255;
        }
        if (due()) { yield; resumed(); }
      }
      g.putImageData(img, 0, 0);
      shadowKey = key; shadow = c;
      return c;
    },
    /** The same, all at once: for a sun that has just moved, at a coarse grid, or when the job has not run yet. */
    shadows(Ls, q = 1) {
      const it = this.shadowJob(Ls, q);
      for (let r = it.next(); ; r = it.next()) if (r.done) return r.value;
    },
    /** Draw the still parts: paper, wash, shadows, ink. `Ls` is the sun; the lamp and dust are the renderer's. */
    compose(g, Ls, q = 1) {
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(base, 0, 0);
      if (mode !== 'hair') {
        g.globalCompositeOperation = 'multiply'; g.drawImage(wash, 0, 0); g.globalCompositeOperation = 'source-over';
        const sh = this.shadows(Ls, q);
        if (sh) { g.globalCompositeOperation = 'multiply'; g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; if (q > 0.5 && 'filter' in g) g.filter = `blur(${(3.4 * px).toFixed(1)}px)`; g.drawImage(sh, 0, 0, cw, ch); g.filter = 'none'; g.globalCompositeOperation = 'source-over'; }
      }
      g.drawImage(inkLayer, 0, 0);
      g.restore();
    },
    /** Make the rasteriser finish what has been drawn so far (a 1 x 1 read), so a slice's cost lands inside the slice. */
    flush() { for (const c of [wash, inkLayer]) c?.getContext('2d').getImageData(0, 0, 1, 1); },
    dispose() { base = wash = inkLayer = shadow = null; },
  };
}

// ── the lamp: brass, on its chain, swung by the model ──────────────────────
const LAMP_TOP = [0.25, roofY(0.25), 4.4];
/** Draw the hanging lamp swung by `swing` radians, in logical units. `lit` glows (dusk); `ink` is the line colour. */
export function drawLamp(g, swing, { mood = 'day', ink: col = SEPIA, hair = false } = {}) {
  const [u, v, Z] = projectM(...LAMP_TOP), ppm = 0.5 * W / ((Z / S) * TAN_X), X = u * W, Y = v * H;
  const chain = 0.32 * ppm, top = chain, capH = 0.1 * ppm, bodyH = 0.36 * ppm, wT = 0.15 * ppm, wB = 0.1 * ppm, lit = mood === 'dusk';
  g.save(); g.translate(X, Y); g.rotate(swing);
  if (lit) { // the glow first, so the lantern sits in it
    const cy = top + capH + bodyH * 0.5, gl = g.createRadialGradient(0, cy, 4, 0, cy, ppm * 1.2);
    gl.addColorStop(0, 'rgba(255,214,140,0.85)'); gl.addColorStop(0.35, 'rgba(255,190,100,0.32)'); gl.addColorStop(1, 'rgba(255,170,80,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gl; g.fillRect(-ppm * 1.3, cy - ppm * 1.3, ppm * 2.6, ppm * 2.6); g.globalCompositeOperation = 'source-over';
  }
  g.strokeStyle = col; g.lineCap = 'round';
  // the chain: small links
  g.lineWidth = hair ? 1 : 1.5; g.globalAlpha = 0.9;
  for (let y = 0; y < chain; y += 6) { g.beginPath(); g.ellipse(0, y + 3, 1.6, 3.2, 0, 0, TAU); g.stroke(); }
  g.globalAlpha = 1;
  // cap, body, glass, finial
  const cap = [[0, top - 2], [-wT * 0.9, top + capH], [wT * 0.9, top + capH]], y0 = top + capH, y1 = y0 + bodyH;
  const body = [[-wT, y0], [wT, y0], [wB, y1], [-wB, y1]];
  const poly = pts => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
  if (!hair) {
    g.fillStyle = lit ? '#a87a24' : '#c39a3c'; poly(cap); g.fill();
    g.fillStyle = lit ? '#ffe2a0' : '#efe1b0'; poly(body); g.fill();
    g.fillStyle = lit ? '#b98626' : '#b58a34'; g.fillRect(-wT * 1.06, y0 - 2, wT * 2.12, 4); g.fillRect(-wB * 1.1, y1 - 2, wB * 2.2, 4);
    g.beginPath(); g.arc(0, y1 + 4, 3.4, 0, TAU); g.fill();
  }
  g.lineWidth = hair ? 1 : 1.6; poly(cap); g.stroke(); poly(body); g.stroke();
  g.lineWidth = hair ? 0.8 : 1.2; g.globalAlpha = 0.8;
  for (const f of [-0.5, 0.5]) { g.beginPath(); g.moveTo(wT * f, y0); g.lineTo(wB * f, y1); g.stroke(); }
  g.beginPath(); g.moveTo(0, y0 + bodyH * 0.35); g.lineTo(0, y0 + bodyH * 0.7); g.stroke(); // the wick
  g.restore();
}
