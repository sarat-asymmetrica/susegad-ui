// Toran: the doorway on the morning of Chovoth. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/toran.js (read only;
// never edited). buildToran, step, brush, stepPetals and makePetal are the
// plate's own Verlet garland, unchanged in what they do. What the port adds:
// the whole garland is a pure function of (seed, register, time, strokes).
// It advances in fixed 1/120 s steps from zero, memoised, so a playing scene
// only pays for new steps; brushes (pointer strokes, keyboard taps) are a
// timestamped list fed in as their moment comes; loose petals shed on a seeded
// clock inside the steps. Same seed and same strokes, the same garland.

import { rng, N, clamp, lerp, TAU, ease } from '../../engine/index.js';

export const W = 1200, H = 900;
export const FRAME = { x0: 352, x1: 848, y0: 150, y1: 790 };
export const OPEN = { x0: 426, x1: 774, y0: 236, y1: 774 };
export const CORNICE = { x0: 326, x1: 874, y0: 124, y1: 150 };
export const STEP = { x0: 316, x1: 884, top: 792, edge: 836, bot: 884 };
export const SEAT = { top: 640, face: 658 };
export const NAILS = [[390, 178], [600, 170], [810, 178]];
export const EAVE_Y = 60;
export const STILL_TIME = 0;

export const GRAV = 980, DAMP = 0.993, ITER = 12, HSTEP = 1 / 120, SEG = 18.5;

/**
 * How each register lives at the doorway. quiet is the garland at rest with
 * the petals already on the step; warm is a gentle breeze and a rare petal;
 * playful is the plate: the full breeze, someone brushing the strands on the
 * way in, the hand's brushes, and a petal now and then.
 */
export const LOOKS = {
  quiet: { wind: 0, shed: 0, opening: false, touch: false },
  warm: { wind: 0.55, shed: [18, 36], opening: false, touch: false },
  playful: { wind: 1, shed: [10, 24], opening: true, touch: true },
};

/** Seeded, eased breeze: slow noise decides the gusts, faster noise the ripples. */
export function breeze(t, x, y) {
  const base = 0.5 + 0.5 * N(t * 0.06, 3.1, 0.5);
  const gust = Math.pow(Math.max(0, N(t * 0.19, 7.7, 1.2) * 1.6), 1.6);
  return (0.25 + 0.45 * base + 1.4 * gust) * (N(x * 0.004 - t * 0.55, y * 0.004, t * 0.09) * 1.4 + 0.3);
}

export function buildToran(seed) {
  const r = rng(`toran:${seed}`);
  const P = [], C = [], chains = [], leaves = [], flowers = [];
  const add = (x, y, o = {}) => { P.push({ x, y, px: x, py: y, pin: null, wind: 1, lift: 0, ...o }); return P.length - 1; };
  const link = (a, b, len, min = false) => C.push({ a, b, len, min });

  // one marigold palette per chain, in blocks, the way a flower seller strings them
  const colourRun = (n, main, band, every) => Array.from({ length: n }, (_, i) => (every && i % every === every - 1 ? band : main));

  function chain(pts, len, colours, kind) {
    const idx = pts.map(([x, y], i) => add(x, y, i === 0 ? { pin: [x, y] } : {}));
    for (let i = 1; i < idx.length; i++) link(idx[i - 1], idx[i], len);
    // flowers bump into each other: a chain can bend but not fold flat
    for (let i = 2; i < idx.length; i++) link(idx[i - 2], idx[i], len * 1.55, true);
    chains.push({ idx, kind });
    idx.forEach((pi, i) => { if (i > 0) flowers.push({ p: pi, chain: chains.length - 1, k: i, colour: colours[i], variant: r.int(0, 5), spin: r() * TAU, size: r.range(0.92, 1.08), lost: 0 }); });
    return idx;
  }

  function swag(a, b, sag, colours) {
    const par = u => [lerp(a[0], b[0], u), lerp(a[1], b[1], u) + sag * 4 * u * (1 - u)];
    let L = 0; for (let i = 1; i <= 200; i++) { const p = par(i / 200), q = par((i - 1) / 200); L += Math.hypot(p[0] - q[0], p[1] - q[1]); }
    const n = Math.max(2, Math.round(L / SEG)), len = L / n;
    // start on the curve, evenly by arc length, so nothing is stretched at t = 0
    const pts = [], cum = [0], S = []; for (let i = 0; i <= 400; i++) S.push(par(i / 400));
    for (let i = 1; i < S.length; i++) cum.push(cum[i - 1] + Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]));
    let j = 0;
    for (let k = 0; k <= n; k++) { const d = (k / n) * cum[cum.length - 1]; while (j < cum.length - 2 && cum[j + 1] < d) j++; pts.push(S[j].slice()); }
    const idx = chain(pts, len, colours(n + 1), 'swag');
    P[idx[idx.length - 1]].pin = b.slice();
    return idx;
  }

  function strand(a, len, colours) {
    const n = Math.max(2, Math.round(len / SEG));
    const pts = Array.from({ length: n + 1 }, (_, i) => [a[0], a[1] + i * SEG]);
    return chain(pts, SEG, colours(n + 1), 'strand');
  }

  function leaf(anchor, len, angle, o = {}) {
    const q = P[anchor], tip = add(q.x + Math.cos(angle) * len, q.y + Math.sin(angle) * len, { wind: 3.2, lift: 90 });
    link(anchor, tip, len);
    leaves.push({ a: anchor, b: tip, len, variant: r.int(0, 3), ...o });
    return tip;
  }

  const O = 'orange', Y = 'saffron';
  const swagCols = [r.int(3, 4), r.int(3, 5)];
  const s1 = swag(NAILS[0], NAILS[1], r.range(78, 88), n => colourRun(n, O, Y, swagCols[0]));
  const s2 = swag(NAILS[1], NAILS[2], r.range(78, 88), n => colourRun(n, O, Y, swagCols[1]));
  const sides = r.range(270, 300);
  const t1 = strand(NAILS[0], sides, n => colourRun(n, Y, O, 4));
  const t2 = strand(NAILS[2], sides + r.range(-18, 18), n => colourRun(n, Y, O, 4));
  const t3 = strand(NAILS[1], r.range(84, 96), n => colourRun(n, O, Y, 0));

  // mango leaves tied under the swags, and a knot of leaves at every nail
  for (const s of [s1, s2]) for (let i = 1; i < s.length - 1; i++) leaf(s[i], r.range(46, 58) * (i % 2 ? 1 : 0.9), Math.PI / 2 + (i % 2 ? -0.18 : 0.18) + r.range(-0.12, 0.12));
  for (const [k, n] of [[s1[0], 0], [s2[0], 1], [s2[s2.length - 1], 2]]) {
    for (const a of [-0.55, 0.55]) leaf(k, r.range(50, 58), Math.PI / 2 + a + r.range(-0.1, 0.1), { knot: n });
  }
  for (const t of [t1, t2, t3]) leaf(t[t.length - 1], r.range(40, 48), Math.PI / 2, { end: true });

  return { P, C, chains, leaves, flowers, knots: [s1[0], s2[0], s2[s2.length - 1]], t: 0, acc: 0 };
}

/** One fixed step of Verlet integration, then the constraints. `calmAt(x, y)` in 0..1 turns the wind down near the page's words. */
export function step(sim, h, t, windScale = 1, calmAt = null) {
  const h2 = h * h;
  for (const q of sim.P) {
    if (q.pin) { q.x = q.px = q.pin[0]; q.y = q.py = q.pin[1]; continue; }
    // near the page's words the wind drops and the swing is damped harder, so it settles there first
    const k = calmAt ? calmAt(q.x, q.y) : 0, damp = DAMP * (1 - 0.04 * k);
    const vx = (q.x - q.px) * damp, vy = (q.y - q.py) * damp;
    q.px = q.x; q.py = q.y;
    const w = windScale ? breeze(t, q.x, q.y) * windScale * (1 - k) : 0;
    q.x += vx + w * 120 * q.wind * h2;
    q.y += vy + (GRAV - Math.abs(w) * q.lift) * h2;
  }
  for (let k = 0; k < ITER; k++) {
    for (const c of sim.C) {
      const A = sim.P[c.a], B = sim.P[c.b];
      const dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6;
      if (c.min && d >= c.len) continue;
      const diff = (d - c.len) / d;
      const wa = A.pin ? 0 : B.pin ? 1 : 0.5, wb = B.pin ? 0 : A.pin ? 1 : 0.5;
      A.x += dx * diff * wa; A.y += dy * diff * wa;
      B.x -= dx * diff * wb; B.y -= dy * diff * wb;
    }
  }
}

/** Let the garland find its rest shape (heavily damped, no wind). */
export function settle(sim, steps = 480) {
  for (let i = 0; i < steps; i++) {
    step(sim, HSTEP, 0, 0);
    for (const q of sim.P) { q.px = lerp(q.px, q.x, 0.08); q.py = lerp(q.py, q.y, 0.08); }
  }
}

/**
 * A hand moving from (ax, ay) to (bx, by) at velocity (vx, vy) units/s.
 * Particles near the path take on part of that velocity. Returns the flowers
 * it touched, with how firmly, so the caller can decide about petals.
 */
export function brush(sim, ax, ay, bx, by, vx, vy, R = 42) {
  const touched = [];
  const sx = bx - ax, sy = by - ay, sl = sx * sx + sy * sy || 1;
  const near = q => {
    const u = clamp(((q.x - ax) * sx + (q.y - ay) * sy) / sl);
    return Math.hypot(q.x - (ax + sx * u), q.y - (ay + sy * u));
  };
  const hit = sim.P.map(q => {
    if (q.pin) return 0;
    const d = near(q);
    if (d > R) return 0;
    const f = Math.pow(1 - d / R, 1.5) * 0.4;
    q.px -= vx * HSTEP * f; q.py -= vy * HSTEP * f;
    return f;
  });
  for (const fl of sim.flowers) if (hit[fl.p] > 0.08) touched.push([fl, hit[fl.p]]);
  return touched;
}

/** A tap: a small push outward from the finger, six short strokes (the plate's pointerdown). */
export const tapStrokes = (t, x, y, R = 36) => Array.from({ length: 6 }, (_, k) => {
  const a = (k / 6) * TAU;
  return { t, ax: x, ay: y, bx: x + Math.cos(a) * 20, by: y + Math.sin(a) * 20, vx: Math.cos(a) * 520, vy: Math.sin(a) * 520, R };
});

/** Enter or Space: the keyboard hand sweeps sideways through the garland, firmly but never hard enough to shed. */
export const sweepStrokes = (t, x, y, dir = 1) => Array.from({ length: 4 }, (_, k) => ({
  t: t + k * HSTEP, ax: x + dir * (k * 18 - 36), ay: y, bx: x + dir * (k * 18 - 18), by: y, vx: dir * 700, vy: 0, R: 54,
}));

/** Loose petals: gravity, air drag and a sideways flutter, stepped with Euler. */
export function stepPetals(petals, dt, t) {
  const landed = [];
  for (const p of petals) {
    p.vy += 300 * dt;
    const drag = Math.exp(-2.4 * dt);
    p.vx *= drag; p.vy *= drag;
    const flutter = Math.sin(t * p.fw + p.ph);
    p.x += (p.vx + flutter * 42) * dt;
    p.y += p.vy * dt;
    p.rot += (p.vr + flutter * 3) * dt;
    // over a seat it settles on the seat; below the seats' top it is in the stairwell
    const overSeat = p.x < STEP.x0 || p.x > STEP.x1;
    if (overSeat && p.y >= p.seat && p.y - p.vy * dt <= p.seat + 1) { p.y = p.seat; landed.push(p); continue; }
    if (p.y > SEAT.top) p.x = clamp(p.x, STEP.x0 + 5, STEP.x1 - 5);
    if (p.y >= p.land) { p.y = p.land; landed.push(p); }
  }
  return landed;
}

export function makePetal(r, x, y, vx, vy, colour) {
  return {
    x, y, vx: vx + r.range(-40, 40), vy: vy + r.range(-60, 10), rot: r() * TAU, vr: r.range(-5, 5),
    fw: r.range(3, 6), ph: r() * TAU, s: r.range(5.5, 7.5), colour, shade: r(),
    land: r.range(STEP.top + 5, STEP.edge - 4), seat: r.range(SEAT.top + 3, SEAT.face - 3),
  };
}

const FR = 14.5;
const inRect = (x, y, c, pad) => x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad;

/**
 * One whole doorway for a seed and a register: the garland hung and settled,
 * a few petals already on the step, and a clock that can only move forward in
 * fixed steps. `advanceTo(time, strokes, calm)` feeds each stroke in at its
 * moment. Everything random comes from the seed.
 */
export function createDoorway(seed, register = 'warm') {
  const look = LOOKS[register] || LOOKS.warm;
  const sim = buildToran(seed);
  settle(sim, 220);
  // hung and let go of: no swing left over from the hanging
  for (const q of sim.P) { q.px = q.x; q.py = q.y; }
  const prng = rng(`petals:${seed}`);
  const petals = [], fallen = [];
  // a few petals came down while it was being hung
  for (let i = 0; i < 6; i++) {
    const fl = prng.pick(sim.flowers);
    const p = makePetal(prng, clamp(sim.P[fl.p].x + prng.range(-30, 30), STEP.x0 + 30, STEP.x1 - 30), 0, 0, 0, fl.colour);
    p.x = clamp(p.x, OPEN.x0 - 20, OPEN.x1 + 20); p.y = p.land; fallen.push(p);
  }
  const d = { seed, register, look, sim, petals, fallen, n: 0, si: 0, strokes: null, nextShed: look.shed ? prng.range(8, 16) : Infinity, opened: false, energy: 0 };

  function shed(fl, count, vx = 0, vy = 0) {
    for (let i = 0; i < count && fl.lost < 7; i++) {
      const q = sim.P[fl.p], a = prng() * TAU, r = prng() * FR * 0.8;
      petals.push(makePetal(prng, q.x + Math.cos(a) * r, q.y + Math.sin(a) * r, clamp((q.x - q.px) / HSTEP * 0.4 + vx * 0.08, -160, 160), (q.y - q.py) / HSTEP * 0.4 + vy * 0.08, fl.colour));
      fl.lost++;
    }
  }

  function applyStroke(s) {
    const touched = brush(sim, s.ax, s.ay, s.bx, s.by, s.vx, s.vy, s.R);
    const speed = Math.hypot(s.vx, s.vy);
    if (speed > 800) for (const [fl, f] of touched) if (prng() < f * 2.2 * Math.min(1, (speed - 800) / 900)) shed(fl, prng.int(1, 3), s.vx, s.vy);
  }

  /** Advance to step floor(time / HSTEP), feeding in strokes as their moment comes. */
  d.advanceTo = (time, strokes = [], calm = []) => {
    d.strokes = strokes;
    const target = Math.floor(time / HSTEP + 1e-9);
    const calmAt = calm.length ? (x, y) => (calm.some(c => inRect(x, y, c, 60)) ? 0.85 : 0) : null;
    while (d.n < target) {
      d.n++;
      const t = d.n * HSTEP;
      // the opening: someone ducks through the doorway and brushes the strands
      if (look.opening && t > 0.25 && t < 0.75 + HSTEP) {
        const k = Math.min(1, (t - 0.25) / 0.5), k0 = Math.max(0, k - HSTEP / 0.5);
        const x = lerp(520, 700, ease.inOutSine(k)), y = 262 + 20 * Math.sin(k * Math.PI), x0 = lerp(520, 700, ease.inOutSine(k0));
        brush(sim, x0, y, x, y, 480, -40, 60);
        if (!d.opened && k > 0.5) {
          d.opened = true;
          const near = sim.flowers.filter(f => sim.chains[f.chain].kind === 'strand' && Math.abs(sim.P[f.p].x - 600) < 30);
          for (const f of near.slice(0, 2)) shed(f, 1, 300, -40);
        }
      }
      while (d.si < strokes.length && strokes[d.si].t <= t) applyStroke(strokes[d.si++]);
      step(sim, HSTEP, t, look.wind, calmAt);
      // now and then a petal lets go on its own (not from under the page's words)
      if (t > d.nextShed) {
        const fl = prng.pick(sim.flowers), q = sim.P[fl.p];
        if (!calmAt || !calmAt(q.x, q.y)) shed(fl, 1);
        d.nextShed = t + prng.range(look.shed[0], look.shed[1]);
      }
      if (petals.length) {
        const landed = stepPetals(petals, HSTEP, t);
        for (const p of landed) { fallen.push(p); petals.splice(petals.indexOf(p), 1); }
      }
    }
    let e = 0;
    for (const q of sim.P) e += (q.x - q.px) ** 2 + (q.y - q.py) ** 2;
    d.energy = e;
    return d;
  };
  return d;
}

// A few doorways stay warm: one per seed and register, rebuilt only when time goes back or the strokes are replaced.
const memo = new Map();
const EMPTY = Object.freeze([]);
export const clearMemo = () => memo.clear();

/**
 * The doorway at `time`: pure in what it returns (the same seed, register,
 * time and strokes always give the same garland), memoised so a playing scene
 * only pays for the steps since its last frame. `strokes` must be sorted by
 * `t`; a list that is not the one the doorway was fed rebuilds it from zero.
 */
export function doorwayAt(seed, register, time, strokes = EMPTY, calm = []) {
  const key = `${seed}|${register}`;
  let d = memo.get(key);
  const n = Math.floor(time / HSTEP + 1e-9);
  if (!d || n < d.n || (d.strokes && d.strokes !== strokes) || d.si > strokes.length) d = createDoorway(seed, register);
  memo.delete(key); memo.set(key, d);
  if (memo.size > 6) memo.delete(memo.keys().next().value);
  return d.advanceTo(time, strokes, calm);
}

/** The per-frame description the element asks for. The garland itself is doorwayAt(), which the renderer calls with its strokes. */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  return { seed, time, register, look };
}
