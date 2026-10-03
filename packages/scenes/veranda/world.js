// Veranda: the world. The pure half, and the source of truth for both the
// drawing and the depth map.
//
// A Goan veranda is a short list of solids (planes, boxes, cylinders, ellipsoids)
// in metres, seen from a seated eye by the rest camera <sg-depth-photo> uses
// (vertical fov 50 degrees, this scene's aspect). One function, trace(), finds
// the nearest solid along a ray. The depth map is trace() at every pixel, the
// drawing is washed and inked from the same hits and the same edges, so a pillar
// is drawn where the depth map says it is, and the shadows come from the same
// solids. No photograph, no depth model.

export const W = 1200, H = 800;
export const FOV_Y = 50;
export const TAN_Y = Math.tan(FOV_Y * Math.PI / 360);
export const TAN_X = TAN_Y * (W / H);
/** Scene units per metre, and the seated eye's height above the floor in metres. The camera stands at the origin. */
export const S = 0.4, EYE = 1.15;
export const GW = 600, GH = 400; // the depth map's size, and the drawing's G-buffer

// ── the camera ────────────────────────────────────────────────────────────
/** The ray for picture point (u, v): direction (dx, dy, 1), so a ray's parameter is the forward distance Z. */
export const rayAt = (u, v) => [(2 * u - 1) * TAN_X, (1 - 2 * v) * TAN_Y];
/** Scene-unit point (X, Y, Z) (Y up from the eye) to picture (u, v). Inverse of rayAt. */
export const project = (X, Y, Z) => [0.5 + 0.5 * X / (Z * TAN_X), 0.5 - 0.5 * Y / (Z * TAN_Y)];
/** A point in metres (x right, y up from the floor, z forward) to picture (u, v, Z units). */
export const projectM = (x, y, z) => { const Z = z * S; return [...project(x * S, (y - EYE) * S, Z), Z]; };

// ── the depth encoding <sg-depth-photo> reads: white near, sky 0 ────────────
// The two distances are stage3d.core.js's Z_NEAR and Z_FAR. They are repeated here so the scene
// needs nothing from the three.js tier; veranda.test.js fails if the two ever differ.
const Z_NEAR = 1, Z_FAR = 10;
/** Forward distance in scene units to depth 0..1, linear in inverse distance between Z_NEAR and Z_FAR. */
export const zToDepth = Z => Math.min(1, Math.max(0, (1 / Z - 1 / Z_FAR) / (1 / Z_NEAR - 1 / Z_FAR)));
export const depthByte = Z => Math.round(255 * zToDepth(Z));

// ── the solids, in metres ─────────────────────────────────────────────────
const box = (id, mat, x0, x1, y0, y1, z0, z1, o = {}) => ({ k: 'box', id, mat, min: [x0 * S, (y0 - EYE) * S, z0 * S], max: [x1 * S, (y1 - EYE) * S, z1 * S], ...o });
const cyl = (id, mat, cx, cz, r, y0, y1, o = {}) => ({ k: 'cyl', id, mat, c: [cx * S, cz * S], r: r * S, y0: (y0 - EYE) * S, y1: (y1 - EYE) * S, ...o });
const ell = (id, mat, cx, cy, cz, rx, ry, rz, o = {}) => ({ k: 'ell', id, mat, c: [cx * S, (cy - EYE) * S, cz * S], r: [rx * S, ry * S, rz * S], ...o });
/** A bounded plane n . p = c; bounds in metres per axis, holes cut out of it. */
const plane = (id, mat, n, cM, b = {}, o = {}) => ({ k: 'pl', id, mat, n, c: cM * S, b: bounds(b), ...o });
const bounds = b => ({ x: b.x?.map(v => v * S), y: b.y?.map(v => (v - EYE) * S), z: b.z?.map(v => v * S) });
const floorAt = (id, mat, y, b, o) => plane(id, mat, [0, 1, 0], (y - EYE), b, o);
const inB = (b, p) => (!b.x || (p[0] >= b.x[0] && p[0] <= b.x[1])) && (!b.y || (p[1] >= b.y[0] && p[1] <= b.y[1])) && (!b.z || (p[2] >= b.z[0] && p[2] <= b.z[1]));

/** The roof's underside: y = ROOF_A + ROOF_S * x, in metres. It falls toward the eave. */
export const ROOF_A = 2.93, ROOF_S = -0.2;
export const roofY = x => ROOF_A + ROOF_S * x;
/** Pillar centres along the colonnade (z, metres), and their half-width. */
export const PILLARS = [3.4, 5.9, 8.4, 10.9], PILLAR = 0.18;

const pillar = (i, zc) => [
  box(`pillar${i}`, 'laterite', 1.32, 1.68, 0.3, 2.0, zc - PILLAR, zc + PILLAR),
  box(`base${i}`, 'lime', 1.27, 1.73, 0, 0.3, zc - 0.22, zc + 0.22),
  box(`cap${i}`, 'lime', 1.27, 1.73, 2.0, 2.3, zc - 0.22, zc + 0.22),
];
const bay = (i, z0, z1) => [
  box(`back${i}`, 'lime', 1.32, 1.68, 0, 0.92, z0, z1),
  box(`rake${i}`, 'lime', 1.28, 1.72, 0.92, 1.0, z0, z1),
  box(`seat${i}`, 'lime', 0.9, 1.32, 0, 0.4, z0, z1),
  box(`slab${i}`, 'laterite', 0.86, 1.32, 0.4, 0.46, z0, z1),
];

export const SOLIDS = [
  // the ground: paddy below, the garden a step down, the veranda floor
  floorAt('paddy', 'paddy', -0.6, {}),
  floorAt('garden', 'garden', -0.3, { x: [-9, 7.2], z: [0.3, 17] }),
  floorAt('floor', 'floor', 0, { x: [-1.35, 1.68], z: [0.3, 13] }),
  box('stepfront', 'laterite', -1.35, 1.68, -0.3, 0, 13, 13.06),
  // the house wall, its plinth, the door, the window
  plane('wall', 'plaster', [1, 0, 0], -1.35, { y: [0, 3.2], z: [0.3, 13] }),
  box('plinthA', 'laterite', -1.35, -1.27, 0, 0.5, 0.3, 6.3),
  box('plinthB', 'laterite', -1.35, -1.27, 0, 0.5, 7.7, 13),
  box('doorL', 'teak', -1.35, -1.18, 0, 2.35, 6.3, 6.45),
  box('doorR', 'teak', -1.35, -1.18, 0, 2.35, 7.55, 7.7),
  box('doorT', 'teak', -1.35, -1.18, 2.2, 2.35, 6.45, 7.55),
  box('door', 'door', -1.35, -1.24, 0, 2.2, 6.45, 7.55),
  box('winL', 'teak', -1.35, -1.2, 0.85, 2.25, 3.7, 3.85),
  box('winR', 'teak', -1.35, -1.2, 0.85, 2.25, 4.95, 5.1),
  box('winT', 'teak', -1.35, -1.2, 2.15, 2.25, 3.7, 5.1),
  box('winS', 'laterite', -1.35, -1.1, 0.85, 0.95, 3.6, 5.2),
  box('shutter', 'shutter', -1.35, -1.26, 0.95, 2.15, 3.85, 4.95),
  // the roof: rafters run to the vanishing point, the eave overhangs the colonnade
  plane('roof', 'tile', [-ROOF_S, 1, 0], (ROOF_A - EYE), { x: [-1.35, 2.4], z: [0.3, 13.4] }),
  box('beam', 'timber', 1.2, 1.75, 2.28, 2.56, 0.3, 13.4),
  box('fascia', 'timber', 2.33, 2.42, 2.2, 2.46, 0.3, 13.4),
  // a framed picture on the wall, and terracotta pots with ferns: the veranda is lived in
  box('frame', 'timber', -1.35, -1.3, 1.45, 2.15, 8.3, 9.3),
  box('picture', 'door', -1.35, -1.29, 1.5, 2.1, 8.35, 9.25),
  cyl('pot1', 'pot', -0.85, 5.4, 0.22, 0, 0.42),
  ell('fern1', 'foliage', -0.85, 0.68, 5.4, 0.34, 0.28, 0.34),
  cyl('pot2', 'pot', -0.9, 9.6, 0.2, 0, 0.4),
  ell('fern2', 'foliage', -0.9, 0.66, 9.6, 0.32, 0.26, 0.32),
  cyl('pot3', 'pot', 1.1, 9.6, 0.12, 0.46, 0.76),
  ell('fern3', 'foliage', 1.1, 0.92, 9.6, 0.2, 0.16, 0.2),
  // the colonnade, the balcao in two bays, an open bay with a stepping stone
  ...PILLARS.flatMap((z, i) => pillar(i + 1, z)),
  ...bay(1, PILLARS[0] + 0.22, PILLARS[1] - 0.22),
  ...bay(3, PILLARS[2] + 0.22, PILLARS[3] - 0.22),
  box('lip', 'laterite', 1.58, 1.75, -0.3, 0.05, PILLARS[1] + 0.22, PILLARS[2] - 0.22),
  box('stone', 'laterite', 1.75, 2.15, -0.3, -0.12, PILLARS[1] + 0.1, PILLARS[2] - 0.1),
  // the garden: a tulsi platform, a hedge, a mango tree, coconut palms beyond the paddy
  box('tulsi', 'lime', 3.0, 3.8, -0.3, 0.5, 6.7, 7.5),
  ell('tulsiplant', 'foliage', 3.4, 0.85, 7.1, 0.3, 0.35, 0.3),
  box('hedgeR', 'foliage', 7.0, 7.7, -0.3, 0.2, 2, 17.7),
  box('hedgeE', 'foliage', -8, 7.7, -0.3, 0.25, 17, 17.7),
  // a mango in the garden: a slim trunk, a rounded crown low enough to clear the roof's far edge, and two lobes to break its outline
  cyl('mtrunk', 'trunk', 0.8, 15.5, 0.22, -0.3, 1.6),
  ell('mcrown', 'foliage', 0.8, 2.15, 15.5, 2.1, 1.0, 1.9),
  ell('mlobeL', 'foliage', -0.9, 1.95, 15.9, 1.3, 0.8, 1.2),
  ell('mlobeR', 'foliage', 2.5, 2.0, 15.2, 1.3, 0.8, 1.2),
  cyl('palm1', 'trunk', 12, 40, 0.3, -0.6, 8),
  ell('palm1c', 'foliage', 12, 8.3, 40, 2.6, 1.1, 2.6),
  cyl('palm2', 'trunk', 3.5, 44, 0.3, -0.6, 9),
  ell('palm2c', 'foliage', 3.5, 9.3, 44, 2.6, 1.1, 2.6),
  cyl('palm3', 'trunk', -3.5, 38, 0.3, -0.6, 7.5),
  ell('palm3c', 'foliage', -3.5, 7.8, 38, 2.6, 1.1, 2.6),
  // a banana clump and a frangipani in the garden
  ell('banana', 'foliage', 4.6, 1.5, 9.5, 1.0, 1.2, 1.0),
  ell('banana2', 'foliage', 5.3, 1.1, 10.4, 0.7, 0.9, 0.7),
  cyl('fran', 'trunk', 3.4, 12.5, 0.12, -0.3, 1.8),
  ell('franc', 'foliage', 3.4, 2.4, 12.5, 1.0, 0.6, 1.0),
  // the hanging lamp: it swings, so the drawing paints it apart from the rest
  // sized to the lantern drawLamp draws (paint.js): a cap, a body 0.30 m across at the top and 0.20 at the bottom, on a chain 0.32 m long
  cyl('chain', 'brass', 0.25, 4.4, 0.012, 2.56, 2.88, { subject: true, dyn: true }),
  ell('lampcap', 'brass', 0.25, 2.51, 4.4, 0.13, 0.055, 0.13, { subject: true, dyn: true }),
  box('lamp', 'brass', 0.09, 0.41, 2.28, 2.46, 4.26, 4.54, { subject: true, dyn: true }),
  box('lamp2', 'brass', 0.12, 0.38, 2.10, 2.28, 4.28, 4.52, { subject: true, dyn: true }),
];
/**
 * Places a note can stick to, each a point on a real surface (metres). anchorPoint() puts one on the picture: (u, v) and the
 * surface's depth d, which is what <sg-depth-photo>.place(u, v, d) needs to keep it on that surface as the camera moves.
 */
export const ANCHORS = [
  { id: 'window', label: 'the shuttered window', at: [-1.26, 1.5, 4.4] },
  { id: 'door', label: 'the teak door', at: [-1.24, 1.5, 7.0] },
  { id: 'pillar', label: 'the near pillar', at: [1.32, 1.3, 3.4] },
  { id: 'balcao', label: 'the balcão seat', at: [1.1, 0.46, 4.5] },
  { id: 'lamp', label: 'the brass lamp', at: [0.25, 2.36, 4.26] },
  { id: 'mango', label: 'the mango tree', at: [0.8, 1.0, 15.28] },
];
export const anchorPoint = a => { const [u, v, Z] = projectM(...a.at); return { id: a.id, label: a.label, u, v, d: zToDepth(Z) }; };

export const IDX = Object.fromEntries(SOLIDS.map((s, i) => [s.id, i]));
const lampIdx = SOLIDS.map((s, i) => (s.dyn ? i : -1)).filter(i => i >= 0);
export const isDyn = i => !!SOLIDS[i]?.dyn;

// ── the ray caster ────────────────────────────────────────────────────────
const EPS = 1e-9;
const inv = v => 1 / (Math.abs(v) < EPS ? (v < 0 ? -EPS : EPS) : v);

/** Distance t (= forward Z, scene units) where ray p + t*d meets solid s, or Infinity. Fills `n` with the normal when given. */
function hit(s, ox, oy, oz, dx, dy, n) {
  switch (s.k) {
    case 'box': {
      // the slab test, one axis at a time and without allocating: this runs hundreds of millions of times a page
      const mn = s.min, mx = s.max;
      let t0 = 0, t1 = Infinity, ax = -1, sg = 1, i = inv(dx), ta = (mn[0] - ox) * i, tb = (mx[0] - ox) * i;
      if (ta < tb) { if (ta > t0) { t0 = ta; ax = 0; sg = -1; } if (tb < t1) t1 = tb; } else { if (tb > t0) { t0 = tb; ax = 0; sg = 1; } if (ta < t1) t1 = ta; }
      if (t0 > t1) return Infinity;
      i = inv(dy); ta = (mn[1] - oy) * i; tb = (mx[1] - oy) * i;
      if (ta < tb) { if (ta > t0) { t0 = ta; ax = 1; sg = -1; } if (tb < t1) t1 = tb; } else { if (tb > t0) { t0 = tb; ax = 1; sg = 1; } if (ta < t1) t1 = ta; }
      if (t0 > t1) return Infinity;
      ta = mn[2] - oz; tb = mx[2] - oz; // dz is 1
      if (ta < tb) { if (ta > t0) { t0 = ta; ax = 2; sg = -1; } if (tb < t1) t1 = tb; } else { if (tb > t0) { t0 = tb; ax = 2; sg = 1; } if (ta < t1) t1 = ta; }
      if (t0 > t1 || ax < 0 || t0 <= 1e-7) return Infinity;
      if (n) { n[0] = n[1] = n[2] = 0; n[ax] = sg; }
      return t0;
    }
    case 'ell': {
      const px = (ox - s.c[0]) / s.r[0], py = (oy - s.c[1]) / s.r[1], pz = (oz - s.c[2]) / s.r[2];
      const qx = dx / s.r[0], qy = dy / s.r[1], qz = 1 / s.r[2];
      const a = qx * qx + qy * qy + qz * qz, b = px * qx + py * qy + pz * qz, c = px * px + py * py + pz * pz - 1, disc = b * b - a * c;
      if (disc < 0) return Infinity;
      const t = (-b - Math.sqrt(disc)) / a;
      if (t <= 1e-7) return Infinity;
      if (n) { n[0] = (px + qx * t) / s.r[0]; n[1] = (py + qy * t) / s.r[1]; n[2] = (pz + qz * t) / s.r[2]; const l = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= l; n[1] /= l; n[2] /= l; }
      return t;
    }
    case 'cyl': {
      const px = ox - s.c[0], pz = oz - s.c[1], a = dx * dx + 1, b = px * dx + pz, c = px * px + pz * pz - s.r * s.r, disc = b * b - a * c;
      if (disc < 0) return Infinity;
      const t = (-b - Math.sqrt(disc)) / a, y = oy + dy * t;
      if (t <= 1e-7 || y < s.y0 || y > s.y1) return Infinity;
      if (n) { const x = px + dx * t, z = pz + t, l = Math.hypot(x, z) || 1; n[0] = x / l; n[1] = 0; n[2] = z / l; }
      return t;
    }
    default: { // plane
      const nd = s.n[0] * dx + s.n[1] * dy + s.n[2], t = (s.c - (s.n[0] * ox + s.n[1] * oy + s.n[2] * oz)) / (Math.abs(nd) < EPS ? EPS : nd);
      if (t <= 1e-7) return Infinity;
      const p = [ox + dx * t, oy + dy * t, oz + t];
      if (!inB(s.b, p)) return Infinity;
      if (n) { const l = Math.hypot(...s.n), k = nd > 0 ? -1 : 1; n[0] = k * s.n[0] / l; n[1] = k * s.n[1] / l; n[2] = k * s.n[2] / l; }
      return t;
    }
  }
}

/** Each solid's box on the picture, [u0, u1, v0, v1], so a ray only tests what it could hit. Unbounded planes cover it all. */
const bbox = s => {
  const P = [];
  if (s.k === 'box') for (const x of [s.min[0], s.max[0]]) for (const y of [s.min[1], s.max[1]]) for (const z of [s.min[2], s.max[2]]) P.push([x, y, z]);
  else if (s.k === 'ell') for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) P.push([s.c[0] + a * s.r[0], s.c[1] + b * s.r[1], s.c[2] + c * s.r[2]]);
  else if (s.k === 'cyl') for (const a of [-1, 1]) for (const y of [s.y0, s.y1]) for (const c of [-1, 1]) P.push([s.c[0] + a * s.r, y, s.c[1] + c * s.r]);
  else {
    const { x, y, z } = s.b, up = Math.abs(s.n[1]) > 0.5;
    if (!(z && (x || y))) return [0, 1, 0, 1];
    const nx = s.n[0], ny = s.n[1];
    for (const zz of z) for (const a of (up ? x : y)) {
      // a point on the plane: n . p = c, so solve the axis the bounds leave free
      P.push(up ? [a, (s.c - nx * a - s.n[2] * zz) / (ny || 1), zz] : [(s.c - ny * a - s.n[2] * zz) / (nx || 1), a, zz]);
    }
  }
  if (P.some(p => p[2] <= 0.02)) return [0, 1, 0, 1];
  let u0 = 9, u1 = -9, v0 = 9, v1 = -9;
  for (const [X, Y, Z] of P) { const [u, v] = project(X, Y, Z); u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
  return [u0 - 0.004, u1 + 0.004, v0 - 0.004, v1 + 0.004];
};
const BB = SOLIDS.map(bbox);

/** The nearest solid along the ray for picture point (u, v): { t (scene units, forward), i (solid index or -1), n [nx, ny, nz] }. */
export function trace(u, v, skip = null) {
  const [dx, dy] = rayAt(u, v);
  let best = Infinity, bi = -1;
  for (let i = 0; i < SOLIDS.length; i++) {
    const b = BB[i];
    if (u < b[0] || u > b[1] || v < b[2] || v > b[3] || skip?.(i)) continue;
    const t = hit(SOLIDS[i], 0, 0, 0, dx, dy, null);
    if (t < best) { best = t; bi = i; }
  }
  const n = [0, 0, 0];
  if (bi >= 0) hit(SOLIDS[bi], 0, 0, 0, dx, dy, n);
  return { t: best, i: bi, n };
}
/** True when the point (scene units) is shadowed from a light in unit direction L (toward the light). Ground planes never shade. */
export function shadowed(p, L, from = -1) {
  // hit() takes a ray whose z step is 1, so the light is rescaled by its z: only lights that shine from beyond the camera's far end (L.z > 0) are handled
  const dx = L[0] / L[2], dy = L[1] / L[2];
  for (let i = 0; i < OCCLUDERS.length; i++) {
    const k = OCCLUDERS[i];
    if (k !== from && hit(SOLIDS[k], p[0], p[1], p[2], dx, dy, null) < Infinity) return true;
  }
  return false;
}
/** What can throw a shadow: everything but the ground, and the swinging lamp. */
const OCCLUDERS = SOLIDS.map((s, i) => (s.dyn || s.mat === 'paddy' || s.mat === 'garden' || s.mat === 'floor' ? -1 : i)).filter(i => i >= 0);

// ── the G-buffer: every pixel's nearest solid ─────────────────────────────
/**
 * Trace a w x h grid. Row y is at v = (y + 0.5) / h, column x at u = (x + 0.5) / w.
 * @returns {{ w, h, z: Float32Array, id: Int16Array, n: Float32Array }}
 */
export function gbuffer(w = GW, h = GH, rows = null) {
  const z = new Float32Array(w * h), id = new Int16Array(w * h), n = new Float32Array(w * h * 3);
  const g = { w, h, z, id, n, y: 0 };
  const fill = (y0, y1) => {
    for (let y = y0; y < y1; y++) {
      for (let x = 0; x < w; x++) {
        const r = trace((x + 0.5) / w, (y + 0.5) / h), k = y * w + x;
        z[k] = r.t; id[k] = r.i; n[k * 3] = r.n[0]; n[k * 3 + 1] = r.n[1]; n[k * 3 + 2] = r.n[2];
      }
    }
  };
  if (rows) return { g, fill };
  fill(0, h);
  return g;
}

/** The depth map's bytes (white near, sky and anything past Z_FAR 0): one byte a pixel. */
export function depthMap(g) {
  const out = new Uint8ClampedArray(g.w * g.h);
  for (let k = 0; k < out.length; k++) out[k] = g.id[k] < 0 ? 0 : depthByte(g.z[k]);
  return out;
}
/**
 * The layers map's bytes, RGBA: R the water (none here), G the sky, B the subject (the lamp). <sg-depth-photo> erodes its far layer
 * around the subject and inpaints from the far side, which is right only where the far side is sky. The pillars stood against the
 * roof and the garden and drew a sky-coloured rim across their edge (pixel (1086, 180): 152 against a background of 51), so they are not the subject.
 */
export function layersMap(g) {
  const out = new Uint8ClampedArray(g.w * g.h * 4);
  for (let k = 0; k < g.w * g.h; k++) {
    const i = g.id[k];
    out[k * 4 + 1] = i < 0 ? 255 : 0;
    out[k * 4 + 2] = i >= 0 && SOLIDS[i].subject ? 255 : 0;
    out[k * 4 + 3] = 255;
  }
  return out;
}
export { lampIdx };
