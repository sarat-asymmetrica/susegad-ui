// Khazan: fireflies over the khazan. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/khazan.js (read
// only; never edited). The plate kept its swarm pure (neighbours, the
// Kuramoto step, the order parameters, the flash curve) and its landscape
// geometry pure (buildScene); both come across unchanged. The port adds the
// swarm's seeded set-up, the still's travelling wave, the hold for progress,
// the registers and model(). No DOM in any of it.

import { rng, blob, roughen, bbox, N, TAU, clamp, lerp } from '../../engine/index.js';

export const W = 1200, H = 800;

// ── Pure core: the swarm (the plate's own) ──────────────────────────────────

/** Build neighbour lists once from resting positions (bucketed spatial grid). */
export function neighbours(xs, ys, radius) {
  const cell = radius, grid = new Map(), n = xs.length, out = [];
  const key = (cx, cy) => cx * 4096 + cy;
  for (let i = 0; i < n; i++) {
    const k = key(Math.floor(xs[i] / cell), Math.floor(ys[i] / cell));
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k).push(i);
  }
  const r2 = radius * radius;
  for (let i = 0; i < n; i++) {
    const cx = Math.floor(xs[i] / cell), cy = Math.floor(ys[i] / cell), list = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      for (const j of grid.get(key(cx + dx, cy + dy)) || []) {
        if (j !== i && (xs[j] - xs[i]) ** 2 + (ys[j] - ys[i]) ** 2 < r2) list.push(j);
      }
    }
    out.push(Int32Array.from(list));
  }
  return out;
}

/** One Kuramoto step: dθi = ωi + K · mean_j sin(θj − θi). Mutates phase. */
export function kuramoto(phase, omega, nbrs, K, dt) {
  const n = phase.length, d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const list = nbrs[i];
    let s = 0;
    for (let k = 0; k < list.length; k++) s += Math.sin(phase[list[k]] - phase[i]);
    d[i] = omega[i] + (list.length ? (K * s) / list.length : 0);
  }
  for (let i = 0; i < n; i++) phase[i] = (phase[i] + d[i] * dt + TAU) % TAU;
}

/** Local order: how in step each firefly is with its own neighbourhood, averaged.
 *  Separate trees can each be perfectly synchronised while disagreeing with
 *  each other, so this is the honest measure of what the eye sees. */
export function localOrder(phase, nbrs) {
  let sum = 0, count = 0;
  for (let i = 0; i < phase.length; i++) {
    const list = nbrs[i];
    if (!list.length) continue;
    count++;
    let c = Math.cos(phase[i]), s = Math.sin(phase[i]);
    for (let k = 0; k < list.length; k++) { c += Math.cos(phase[list[k]]); s += Math.sin(phase[list[k]]); }
    sum += Math.hypot(c, s) / (list.length + 1);
  }
  return count ? sum / count : 0;
}

/** Order parameter r ∈ [0, 1]: 0 = all out of step, 1 = perfectly together. */
export function order(phase) {
  let c = 0, s = 0;
  for (let i = 0; i < phase.length; i++) { c += Math.cos(phase[i]); s += Math.sin(phase[i]); }
  return Math.hypot(c, s) / phase.length;
}

/** A firefly flash: a quick rise as the phase passes zero, then a slow afterglow. */
export function flash(phase) {
  const rise = 0.14, decay = 0.8;
  const a = phase < TAU - rise ? phase : phase - TAU;
  return (a < 0 ? Math.pow(1 + a / rise, 2) : Math.exp(-a / decay)) * 0.97 + 0.03;
}


// ── Landscape geometry (the plate's own) ────────────────────────────────────

export const WATER_Y = 488;
export const INK_FAR = '#0f1734', INK_MID = '#060915', INK_NEAR = '#03040a', RIM = '#33447e';

export function pointIn(poly, x, y) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}


const bez = (a, b, c, d, u) => {
  const v = 1 - u;
  return [0, 1].map(k => v * v * v * a[k] + 3 * v * v * u * b[k] + 3 * v * u * u * c[k] + u * u * u * d[k]);
};

export function buildScene() {
  const r = rng('khazan-scene');
  // mangroves: low, dense domes of many small leafy blobs hanging almost to
  // the water; the prop roots show only in the gap beneath
  const clumps = [
    { x: 165, w: 320, h: 165 }, { x: 470, w: 220, h: 118 }, { x: 775, w: 400, h: 205 }, { x: 1088, w: 260, h: 146 },
  ].map((c, ci) => {
    const blobs = [];
    const count = Math.round((c.w * c.h) / 480);
    for (let k = 0; k < count; k++) {
      const u = r.range(-1, 1), top = WATER_Y - 20 - c.h * Math.sqrt(Math.max(0, 1 - u * u * 0.92));
      const bx = c.x + u * c.w * 0.5;
      const y = lerp(top + 12, WATER_Y - 32, Math.pow(r(), 1.5));
      const rad = r.range(12, 32) * (1 - Math.abs(u) * 0.35);
      blobs.push(roughen(blob(bx, y, rad, { seed: ci * 100 + k, wobble: 0.14, squash: 0.8 }), { amp: 2.2, freq: 0.16, seed: ci * 31 + k, step: 3 }));
    }
    // leafy fringe: small tufts scattered along the top of the dome
    for (let k = 0; k < Math.round(c.w / 3.2); k++) {
      const u = r.range(-1, 1), top = WATER_Y - 20 - c.h * Math.sqrt(Math.max(0, 1 - u * u * 0.92));
      const y = top + 14 + r.range(-10, 12), rad = r.range(3, 9);
      blobs.push(blob(c.x + u * c.w * 0.5 + r.range(-6, 6), y, rad, { seed: ci * 1000 + k, wobble: 0.3, squash: 0.75, n: 18 }));
    }
    return { ...c, blobs };
  });
  // the bund: an earthen embankment curving from the near left into the water
  const A = [-40, 830], B = [210, 650], C = [380, 520], D = [560, WATER_Y + 12];
  const top = [], face = [];
  for (let i = 0; i <= 60; i++) {
    const u = i / 60, [x, y] = bez(A, B, C, D, u), thick = lerp(76, 6, Math.pow(u, 0.8));
    top.push([x - thick * 0.9, y + 2.2 * N(u * 9, 3.3)]);
    face.push([x + thick * 0.55, y + thick * 0.3 + 1.8 * N(u * 9, 8.1)]);
  }
  return { clumps, bund: [...top, ...[...face].reverse()], bundTop: top };
}


// ── The swarm's set-up (from the plate's mount, made pure) ──────────────────

/**
 * Where every firefly rests (inside the canopies, plus a few wanderers over
 * the water), who its neighbours are, and which are free. Built once: it does
 * not depend on the seed, exactly as in the plate.
 */
export function buildSwarm(scene = buildScene()) {
  const xs = [], ys = [], free = [];
  const pr = rng('fireflies');
  for (const c of scene.clumps) {
    const want = Math.round(c.w * 0.34), boxes = c.blobs.map(bbox);
    const inBlob = (x, y) => c.blobs.some((b, k) => {
      const q = boxes[k];
      return x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h && pointIn(b, x, y);
    });
    let placed = 0, guard = 0;
    while (placed < want && guard++ < 20000) {
      const x = c.x + pr.range(-0.55, 0.55) * c.w, y = WATER_Y - pr.range(14, c.h + 30);
      if (inBlob(x, y)) { xs.push(x); ys.push(y); free.push(0); placed++; }
    }
  }
  for (let i = 0; i < 34; i++) { xs.push(pr.range(60, W - 60)); ys.push(WATER_Y - pr.range(-60, 190)); free.push(1); }
  // canopy fireflies couple to canopy neighbours; the wanderers over the
  // water stay free, so a few lone lights always keep their own time
  const nbrs = neighbours(xs, ys, 70).map((list, i) => (free[i] ? new Int32Array(0) : list.filter(j => !free[j])));
  return { scene, xs, ys, free, nbrs, n: xs.length };
}

let cached = null;
/** buildSwarm(), once. */
export const swarm = () => (cached ??= buildSwarm());

/** The coupling strength, as in the plate. */
export const K = 0.95;

/** Scattered phases and natural frequencies for a seed: the plate's scatterPhases. */
export function scatter(seed, n) {
  const r = rng(`phases${seed}`), phase = new Float32Array(n), omega = new Float32Array(n);
  for (let i = 0; i < n; i++) { phase[i] = r() * TAU; omega[i] = TAU * (0.62 + r.gauss() * 0.05); }
  return { phase, omega };
}

/** The still: a wave passing through, phase varying smoothly across the bank (the plate's stillPhases). */
export function wavePhases(xs, ys) {
  const out = new Float32Array(xs.length);
  for (let i = 0; i < xs.length; i++) out[i] = ((-(xs[i] - 640) * 0.006 + (ys[i] - 380) * 0.002 + N(xs[i] * 0.01, ys[i] * 0.01) * 0.3) % TAU + TAU) % TAU;
  return out;
}

const wrap = a => ((a + Math.PI) % TAU + TAU) % TAU - Math.PI;
/**
 * Progress as synchrony: each firefly's phase lies that far from its own
 * scattered phase toward the travelling wave, so the bank falls into step
 * exactly as far as the work has gone. Everyone then blinks at one shared
 * rate, so the pattern (and the number) never drifts while the work stands.
 */
export function heldPhases(seed, progress, time, sw = swarm()) {
  const { phase } = scatter(seed, sw.n), wave = wavePhases(sw.xs, sw.ys), out = new Float32Array(sw.n), p = clamp(progress);
  const beat = TAU * 0.62 * time;
  for (let i = 0; i < sw.n; i++) out[i] = ((wave[i] + (1 - p) * wrap(phase[i] - wave[i]) + beat) % TAU + TAU) % TAU;
  return out;
}

/** Run the swarm for `steps` sixtieths of a second from a seed's scattered start. Pure (it copies). */
export function runSwarm(seed, steps, sw = swarm()) {
  const { phase, omega } = scatter(seed, sw.n);
  for (let s = 0; s < steps; s++) kuramoto(phase, omega, sw.nbrs, K, 1 / 60);
  return phase;
}

/** How each register lives: the swarm's pace, and whether the hand may scatter it. */
export const LOOKS = {
  quiet: { pace: 0, hand: false },
  warm: { pace: 0.8, hand: false },
  playful: { pace: 1, hand: true },
};

/** The per-frame description. With progress set, the swarm is held at that synchrony. */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const held = params.progress != null;
  return { time, seed, register, look, held, progress: held ? clamp(params.progress) : null };
}
