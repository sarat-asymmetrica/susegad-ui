// Paus: the monsoon, seen through a Goan window. The pure half.
//
// Layout, field and palm geometry, wind, the fog field, the progress cover and
// the drop simulation. Nothing here touches the DOM, so all of it runs and is
// tested in Node. render.js owns the canvases and draws what this describes.

import { rng, clamp, lerp, smoothstep, N, makeNoise, catmull, measure } from '../../engine/index.js';

// ── Layout (logical units) ────────────────────────────────────────────────

export const W = 1200, H = 800;
export const OUT = { x0: 64, y0: 34, x1: 1136, y1: 708 };
export const T = 30;
export const IN = { x0: OUT.x0 + T, y0: OUT.y0 + T, x1: OUT.x1 - T, y1: OUT.y1 - T };
export const CAP = (() => {
  const cols = 16, rows = 2, gap = 6;
  const cell = (IN.x1 - IN.x0 - gap * (cols + 1)) / cols;
  return { cols, rows, gap, cell, y1: IN.y0 + rows * cell + (rows + 1) * gap };
})();
export const RAIL = 24;
export const GLASS_Y0 = CAP.y1 + RAIL;
export const MULL = { x0: 587, x1: 613 };
export const PANES = [
  { x0: IN.x0, x1: MULL.x0, y0: GLASS_Y0, y1: IN.y1 },
  { x0: MULL.x1, x1: IN.x1, y0: GLASS_Y0, y1: IN.y1 },
];
export const R = { x: IN.x0, y: GLASS_Y0, w: IN.x1 - IN.x0, h: IN.y1 - GLASS_Y0 };
/** The fog mask's fixed resolution, independent of screen size. */
export const MW = 330, MH = Math.round((MW * R.h) / R.w);
export const HORIZON = 452;
export const CUP = { x: 236, base: 719, h: 72, tw: 27, bw: 20 };

/** A named random stream for a seed. Seed 1 (the default) reproduces the sketchbook plate exactly. */
export const sk = (seed, name) => (seed == null || seed === 1 ? name : `${name}:${seed}`);

/**
 * How each register reads the same window. quiet is a still, warm is a slow
 * ambient rain, playful is the full storm with wiping, the ghost hand and steam.
 */
export const LOOKS = {
  quiet:   { beads: 0.22, streaks: 0, rings: 0, fog: 0.62, wind: 0.5, steam: 0, ghost: 0, keys: 0, wipe: 0 },
  warm:    { beads: 0.42, streaks: 0.45, rings: 0.55, fog: 0.9, wind: 0.6, steam: 0, ghost: 0, keys: 0, wipe: 1 },
  playful: { beads: 1, streaks: 1, rings: 1, fog: 1, wind: 1, steam: 1, ghost: 1, keys: 1, wipe: 1 },
};

// ── Static geometry, memoised per seed ────────────────────────────────────

export function fieldGeometry(seed = 1) {
  const r = rng(sk(seed, 'paus-fields'));
  const top = HORIZON + 6, bot = IN.y1 + 2, n = 8, VP = [600, HORIZON - 8];
  const ys = Array.from({ length: n + 1 }, (_, k) => top + (bot - top) * Math.pow(k / n, 1.5));
  const plots = [], splits = [];
  for (let k = 0; k < n; k++) {
    const y0 = ys[k], y1 = ys[k + 1], ym = (y0 + y1) / 2;
    const count = Math.round(lerp(8, 3, k / (n - 1)));
    const lines = [IN.x0 - 400];
    for (let j = 1; j < count; j++) lines.push(lerp(IN.x0 - 60, IN.x1 + 60, (j + r.range(-0.32, 0.32)) / count));
    lines.push(IN.x1 + 400);
    const xAt = (xm, y) => xm + clamp((xm - VP[0]) / (ym - VP[1]), -2.4, 2.4) * (y - ym);
    for (let j = 0; j < lines.length - 1; j++) {
      const a = lines[j], b = lines[j + 1];
      const quad = [[xAt(a, y0), y0], [xAt(b, y0), y0], [xAt(b, y1), y1], [xAt(a, y1), y1]];
      const flooded = r.chance(0.36);
      plots.push({ quad, k, flooded, tone: r.pick(['#7a9a5c', '#6c8d52', '#88a567', '#96ae6e', '#5f8349']), seed: k * 31 + j });
      if (j > 0 && j < lines.length - 1) splits.push({ a: quad[0], b: quad[3], k });
    }
  }
  return { ys, n, plots, splits, top, bot };
}

export function makePalms(seed = 1) {
  const r = rng(sk(seed, 'paus-palms'));
  const far = [150, 232, 318, 452, 700, 781, 925, 1012, 1080].map((x, i) => ({
    id: i, x: x + r.range(-14, 14), y: HORIZON + r.range(10, 22), h: r.range(120, 200), lean: r.range(-0.08, 0.2),
    w: 2.6, color: '#4f6658', frond: r.range(26, 36), n: r.int(9, 11), flex: r.range(0.7, 1.2), near: false,
  }));
  const near = [
    { id: 20, x: 300, y: 560, h: 290, lean: 0.14, w: 5, color: '#3d5144', frond: 58, n: 12, flex: 1, near: true },
    { id: 21, x: 880, y: 612, h: 350, lean: 0.2, w: 6.5, color: '#33463a', frond: 70, n: 13, flex: 1.1, near: true },
  ];
  return { far, near, all: [...far, ...near] };
}

const memo = new Map();
/** Everything static about a seed's window, built once. */
export function geometry(seed = 1) {
  if (!memo.has(seed)) {
    if (memo.size > 8) memo.delete(memo.keys().next().value);
    const fields = fieldGeometry(seed);
    memo.set(seed, { seed, fields, flooded: fields.plots.filter(p => p.flooded && p.k >= 2), palms: makePalms(seed) });
  }
  return memo.get(seed);
}

// ── Time-varying, still pure ──────────────────────────────────────────────

/** How far a palm leans into the wind at time t. Perlin noise, so it never loops. */
export function palmSway(p, t) {
  const gust = 0.5 + 0.5 * N(t * 0.16, p.id * 3.1, 1.7);
  return (0.04 + 0.13 * gust) * p.flex + 0.025 * N(t * 0.85, p.id * 5.3, 2.2);
}

/** Three wisps of chai steam: polylines in logical units. */
export function steam(t) {
  const out = [];
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const s = i / 24, y = CUP.base - CUP.h - 4 - s * 150;
      pts.push([CUP.x + (k - 1) * 7 + N(s * 2.1 - t * 0.42, k * 3.7, 1.1) * 30 * (0.2 + s) + s * s * 16, y]);
    }
    out.push({ pts, breathe: 0.75 + 0.25 * Math.sin(t * 0.6 + k * 2) });
  }
  return out;
}

/** The height of the clearing line for a progress value: the glass clears from the sill up. */
export const progressEdge = p => lerp(R.y + R.h + 50, R.y - 50, clamp(p));

/**
 * How much fog is allowed at (x, y) for a progress value: 1 is full fog, 0 is
 * clear glass. Never depends on time, so the glass only clears when work does.
 */
export function cover(progress, x, y) {
  if (progress == null) return 1;
  const e = progressEdge(progress) + N(x * 0.012, 7.7, 0.3) * 18;
  return 1 - smoothstep(e - 26, e + 26, y);
}

/** The starting condensation, as mask alpha (0..255), row by row so it can be time-sliced. */
export function* fogField(seed, out = new Uint8ClampedArray(MW * MH)) {
  const nz = makeNoise(seed == null || seed === 1 ? 77 : sk(seed, 'fog'));
  for (let y = 0; y < MH; y++) {
    for (let x = 0; x < MW; x++) out[y * MW + x] = clamp(0.78 + 0.3 * (y / MH) + nz.fbm(x * 0.02, y * 0.035, 0, 3) * 0.35, 0.45, 1) * 255;
    if (y % 30 === 29) yield out;
  }
  return out;
}

/** A path a hand might wipe across one pane, as an arc-length lookup. */
export function ghostPath(r) {
  const p = r.chance(0.6) ? PANES[1] : PANES[0];
  const y = r.range(300, 420), x0 = p.x0 + r.range(30, 70), x1 = p.x1 - r.range(30, 70);
  return measure(catmull([[x0, y], [lerp(x0, x1, 0.5), y - r.range(10, 30)], [x1, y - r.range(-20, 20)], [lerp(x0, x1, 0.55), y + 48], [x0 + 20, y + 58]], 10));
}

// ── The drops ─────────────────────────────────────────────────────────────

const PAD = 14;
const hit = (c, x, y) => x > c.x - PAD && x < c.x + c.w + PAD && y > c.y - PAD && y < c.y + c.h + PAD;

/**
 * The rain on the glass. Every drop is a position and a radius, and each step
 * applies three rules: grow, merge on contact, run once heavy. Deterministic
 * for a seed and a sequence of dt values.
 *
 * step(dt, wipes?) returns the trails runners cleared this step, as
 * { x0, y0, x1, y1, w } in logical units, for the renderer to erase from the fog.
 */
export function createDrops(seed = 1, { quality = 1, rate = 85, calm = [] } = {}) {
  const r = rng(sk(seed, 'drops'));
  const beads = [], runners = [], trails = [];
  let nextId = 1;
  const o = { quality, rate, calm };
  const cap = () => Math.round(540 * (0.5 + 0.5 * clamp(o.quality, 0.25, 1)));
  const paneOf = x => (x < 600 ? PANES[0] : PANES[1]);
  const calmAt = (x, y) => o.calm.find(c => hit(c, x, y));

  function add(x, y, rad) {
    for (const b of beads) {
      if (Math.abs(b.x - x) < b.r + rad && Math.hypot(b.x - x, b.y - y) < b.r + rad) {
        b.r = Math.sqrt(b.r * b.r + rad * rad); // area (mass) is conserved
        if (b.r > 4.7 && !calmAt(b.x, b.y)) { beads.splice(beads.indexOf(b), 1); runners.push({ x: b.x, y: b.y, r: b.r, vy: 0, id: nextId++, travel: 0, side: 0 }); }
        return;
      }
    }
    beads.push({ x, y, r: rad });
    if (beads.length > cap()) beads.splice(0, beads.length - cap());
  }

  /** Wiping takes the water with it. */
  function wipe(x0, y0, x1, y1, rad) {
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
    const near = d => { const u = clamp(((d.x - x0) * dx + (d.y - y0) * dy) / L2); return Math.hypot(d.x - (x0 + u * dx), d.y - (y0 + u * dy)) < rad * 0.8; };
    for (let i = beads.length - 1; i >= 0; i--) if (near(beads[i])) beads.splice(i, 1);
    for (let i = runners.length - 1; i >= 0; i--) if (near(runners[i])) runners.splice(i, 1);
  }

  function step(dt, wipes) {
    trails.length = 0;
    if (wipes) for (const w of wipes) wipe(w.x0, w.y0, w.x1, w.y1, w.rad);
    const expect = o.rate * dt;
    let k = Math.floor(expect) + (r() < expect % 1 ? 1 : 0);
    while (k--) {
      const p = r() < 0.5 ? PANES[0] : PANES[1];
      const x = lerp(p.x0 + 4, p.x1 - 4, r()), y = lerp(p.y0 + 4, p.y1 - 4, r()), rad = 0.7 + Math.pow(r(), 2.3) * 3.8;
      // fewer beads where people are reading
      if (o.calm.length && calmAt(x, y) && r() < 0.85) continue;
      add(x, y, rad);
    }
    for (let i = runners.length - 1; i >= 0; i--) {
      const d = runners[i], p = paneOf(d.x);
      d.vy = Math.min(26 + d.r * 20, d.vy + (36 + d.r * 12) * dt);
      const dy = d.vy * dt, ox = d.x, oy = d.y;
      const c = o.calm.length && calmAt(d.x, d.y + dy + d.r);
      if (c) {
        // a runner never crosses text: it slides along the top of the calm zone and round it
        d.side ||= d.x - c.x < c.x + c.w - d.x ? -1 : 1;
        d.x += d.side * Math.max(dy, 30 * dt);
        if (d.x - d.r < p.x0 || d.x + d.r > p.x1) { runners.splice(i, 1); continue; }
      } else {
        d.y += dy;
        d.x = clamp(d.x + N(d.y * 0.03, d.id * 1.37, 4.2) * dy * 0.5, p.x0 + d.r, p.x1 - d.r);
      }
      d.travel += dy;
      for (let j = beads.length - 1; j >= 0; j--) {
        const b = beads[j];
        if (Math.abs(b.y - d.y) < d.r + b.r && Math.hypot(b.x - d.x, b.y - d.y) < d.r + b.r * 0.9) {
          d.r = Math.min(9, Math.sqrt(d.r * d.r + b.r * b.r)); beads.splice(j, 1);
        }
      }
      while (d.travel > 7) {
        d.travel -= 7;
        if (r() < 0.55) {
          const br = 0.5 + r() * 1.1;
          beads.push({ x: d.x + (r() - 0.5) * d.r * 0.5, y: d.y - d.r - r() * 5, r: br });
          d.r = Math.sqrt(Math.max(1, d.r * d.r - br * br * 0.8));
        }
      }
      trails.push({ x0: ox, y0: oy, x1: d.x, y1: d.y, w: d.r * 1.35 });
      if (d.r < 3.3 && r() < dt * 0.9) { beads.push({ x: d.x, y: d.y, r: d.r }); runners.splice(i, 1); continue; }
      if (d.y - d.r > p.y1) runners.splice(i, 1);
    }
    return trails;
  }

  return {
    beads, runners, trails, step, wipe, add,
    /** Change rate, calm rects or quality without losing the water on the glass. */
    set(opts) { Object.assign(o, opts); return this; },
    /** Total water, as the sum of r squared (proportional to area). */
    mass: () => beads.reduce((s, b) => s + b.r * b.r, 0) + runners.reduce((s, d) => s + d.r * d.r, 0),
  };
}

// ── The model ─────────────────────────────────────────────────────────────

/**
 * The per-frame description of the window. Pure: the same inputs always give
 * the same data. The drops are a stepper (see createDrops) that the renderer
 * owns, because a simulation carries state from one frame to the next.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const geo = geometry(seed);
  const rainK = clamp(params.intensity ?? 0.8) / 0.8, fogK = clamp(params.fog ?? 0.8) / 0.8;
  const p = params.progress;
  const t = time * look.wind;
  return {
    seed, time, register, look, geo,
    beadRate: 85 * look.beads * rainK,
    streaks: Math.round(230 * look.streaks * rainK),
    rings: Math.round(34 * look.rings * Math.min(1.25, rainK)),
    fogAlpha: clamp(look.fog * fogK),
    regrow: 0.075 * look.fog * fogK,
    progress: p == null || p === '' || Number.isNaN(+p) ? null : clamp(+p),
    wipe: params.wipe !== false && !!look.wipe,
    sway: geo.palms.all.map(q => palmSway(q, t)),
    steam: look.steam ? steam(time) : null,
  };
}
