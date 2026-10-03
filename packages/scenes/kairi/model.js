// Kairi: a border for a sari. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/kairi.js (read
// only; never edited). Paisley outlines from seeded control points
// (Catmull-Rom, resampled to 256 evenly spaced points), their discrete
// Fourier transform, the epicycle chain that redraws them, and the timeline
// of the machine are plain functions here. buildBorder(seed) runs in Node.

import { rng, clamp, TAU, catmull, measure } from '../../engine/index.js';

export const W = 1200, H = 760;
export const BAND = { y0: 236, y1: 540 };
export const SLOTS = 5, N = 256;
export const PIGMENTS = { madder: '#a63a2b', indigo: '#26386a', turmeric: '#d39b22', leaf: '#6b7a3b' };
const PAIRS = [['madder', 'turmeric'], ['indigo', 'madder'], ['turmeric', 'indigo'], ['madder', 'indigo'], ['indigo', 'turmeric']];

// the timeline, in seconds on the machine's own clock (the plate's)
export const INTRO = 1.6, BUILD = 2.6, TRACE = 5.6, ECHO = 3, FILL = 2.4, MOVE = 0.7;
export const SLOT_T = BUILD + TRACE + ECHO + FILL + MOVE;
export const DONE = INTRO + SLOTS * SLOT_T, HOLD = 9, FADE = 2.2, CYCLE = DONE + HOLD + FADE;
/** The still: a second after the last paisley is finished, the machine resting on it. */
export const STILL_TIME = DONE + 1;

/**
 * How each register lives with the machine. quiet is the finished border;
 * warm draws it once and rests; playful draws a border, holds it, fades it
 * and starts the next seed's border, as the plate did, and the pointer or the
 * keyboard hand slows the machine down.
 */
export const LOOKS = {
  quiet: { cycle: false, slow: false },
  warm: { cycle: false, slow: false },
  playful: { cycle: true, slow: true },
};

/** Control points for a boteh, about 120 units tall, belly at the bottom, the tip curling over to the left. */
const BOTEH = [
  [0, 50], [28, 45], [45, 28], [50, 5], [44, -20], [30, -40], [12, -54], [-8, -62], [-26, -61], [-39, -53],
  [-45, -42], [-42, -33], [-33, -32], [-24, -39], [-16, -38],
  [-17, -24], [-30, -8], [-41, 13], [-38, 34], [-22, 47],
];
/** The echo: a smaller boteh that sits inside the first, clear of its neck. */
const ECHO_PTS = [
  [4, 38], [22, 34], [34, 20], [37, 2], [32, -16], [20, -30], [6, -39], [-4, -41], [-9, -36], [-5, -30],
  [-7, -18], [-19, -4], [-26, 14], [-21, 30], [-9, 37],
];

/** One seeded paisley: its outline and its echo (closed, local units centred near 0,0). */
export function paisley(seed, slot) {
  const r = rng(`boteh:${seed}:${slot}`);
  const fat = r.range(0.92, 1.08), curl = r.range(0.85, 1.2), tall = r.range(0.96, 1.06);
  const lean = r.range(-0.1, 0.12), c = Math.cos(lean), s = Math.sin(lean);
  const place = pts => catmull(pts.map(([x, y]) => [(x * c - y * s) * 2.05, (x * s + y * c) * 2.05]), 14, true);
  const outline = BOTEH.map(([x, y], i) => {
    const tipness = clamp((-y - 25) / 35); // 0 in the belly, 1 at the tip
    const cx = x * fat + (x < -20 && y < -30 ? (x + 20) * (curl - 1) : 0);
    return [cx + r.range(-1.4, 1.4) * (1 - tipness * 0.7), y * tall + r.range(-1.4, 1.4) * (1 - tipness * 0.7) + (i >= 10 && i <= 13 ? (curl - 1) * 10 : 0)];
  });
  const echo = ECHO_PTS.map(([x, y]) => [x * fat + r.range(-0.8, 0.8), y * tall + r.range(-0.8, 0.8)]);
  return { outline: place(outline), echo: place(echo) };
}

/** A row of dots just inside a closed outline, never crowding each other. */
export function dotRow(pts, inset = 8, gap = 9.5) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const sgn = area > 0 ? 1 : -1, n = pts.length, out = [];
  for (let i = 0; i < n; i += 2) {
    const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const q = [pts[i][0] - ty * inset * sgn, pts[i][1] + tx * inset * sgn];
    if (out.every(o => Math.hypot(o[0] - q[0], o[1] - q[1]) > gap)) out.push(q);
  }
  return out;
}

/** n points evenly spaced by arc length around a closed curve. */
export function resampleN(pts, n = N) {
  const m = measure(pts, true);
  return Array.from({ length: n }, (_, i) => { const [x, y] = m.at((i / n) * m.length); return [x, y]; });
}

/** Discrete Fourier transform of a closed path of complex points: terms sorted by amplitude, the constant term (the centre) first. */
export function dft(pts) {
  const n = pts.length, out = [];
  // e^(-2πi·m/n) repeats every n steps, so one table of n angles serves every term
  const cos = Float64Array.from({ length: n }, (_, m) => Math.cos((-TAU * m) / n));
  const sin = Float64Array.from({ length: n }, (_, m) => Math.sin((-TAU * m) / n));
  for (let k = 0; k < n; k++) {
    const f = k <= n / 2 ? k : k - n; // frequencies -n/2 .. n/2
    let re = 0, im = 0;
    for (let j = 0; j < n; j++) {
      const m = (k * j) % n, c = cos[m], s = sin[m];
      re += pts[j][0] * c - pts[j][1] * s;
      im += pts[j][0] * s + pts[j][1] * c;
    }
    re /= n; im /= n;
    out.push({ f, re, im, amp: Math.hypot(re, im), phase: Math.atan2(im, re) });
  }
  const dc = out.find(t => t.f === 0);
  return [dc, ...out.filter(t => t.f !== 0).sort((a, b) => b.amp - a.amp)];
}

/** The chain at time s (0..1 = one turn of the slowest circle), using the first k terms: every circle's centre, then the pen. */
export function chain(terms, k, s, ox = 0, oy = 0) {
  let x = ox + terms[0].re, y = oy + terms[0].im;
  const joints = [[x, y]];
  for (let i = 1; i < k; i++) {
    const t = terms[i], a = TAU * t.f * s + t.phase;
    x += t.amp * Math.cos(a); y += t.amp * Math.sin(a);
    joints.push([x, y]);
  }
  return joints;
}

/** The curve drawn by the first k terms, sampled m times. */
export function curve(terms, k, m = 360, ox = 0, oy = 0) {
  const out = [];
  for (let i = 0; i < m; i++) {
    const s = i / m;
    let x = ox + terms[0].re, y = oy + terms[0].im;
    for (let j = 1; j < k; j++) { const t = terms[j], a = TAU * t.f * s + t.phase; x += t.amp * Math.cos(a); y += t.amp * Math.sin(a); }
    out.push([x, y]);
  }
  return out;
}

/** The whole border: slots, outlines, echoes, their transforms and colours. */
export function buildBorder(seed) {
  const r = rng(`border:${seed}`), span = W / SLOTS, pairs = PAIRS.slice();
  for (let i = pairs.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pairs[i], pairs[j]] = [pairs[j], pairs[i]]; }
  const ym = (BAND.y0 + BAND.y1) / 2;
  const slots = Array.from({ length: SLOTS }, (_, i) => {
    const cx = span * (i + 0.5) + r.range(-6, 6), cy = ym + r.range(-4, 4);
    const shape = paisley(seed, i), shift = pts => pts.map(([x, y]) => [x + cx, y + cy + 6]);
    const outline = resampleN(shift(shape.outline)), echo = resampleN(shift(shape.echo));
    const bx = cx + 6, by = cy + 30;
    const mid = dotRow(outline), halo = dotRow(outline, -8, 6.5);
    const terms = dft(outline), eterms = dft(echo);
    const K = r.pick([37, 45, 51, 61]), KE = r.pick([19, 23, 27]);
    const [a, b] = pairs[i % pairs.length];
    return {
      i, cx, cy, belly: [bx, by], outline, echo, mid, halo, terms, eterms, K, KE,
      full: curve(terms, K, 480), efull: curve(eterms, KE, 360), colorA: PIGMENTS[a], colorB: PIGMENTS[b], seed: (typeof seed === 'number' ? seed : seed.length) * 31 + i,
    };
  });
  // little flowers between the paisleys, alternately high and low
  const buti = Array.from({ length: SLOTS - 1 }, (_, i) => ({ x: span * (i + 1), y: i % 2 ? BAND.y1 - 44 : BAND.y0 + 44, color: slots[i].colorB }));
  return { seed, slots, buti };
}

const memo = new Map();
/** buildBorder, memoised: the transforms cost a few million multiplications per seed. */
export function border(seed) {
  if (!memo.has(seed)) { if (memo.size > 6) memo.delete(memo.keys().next().value); memo.set(seed, buildBorder(seed)); }
  return memo.get(seed);
}

/** Where the machine is at clock c. */
export function stageAt(c) {
  if (c < INTRO) return { slot: -1, stage: 'intro', u: c / INTRO };
  if (c >= DONE) return { slot: SLOTS, stage: c < DONE + HOLD ? 'hold' : 'fade', u: c < DONE + HOLD ? (c - DONE) / HOLD : (c - DONE - HOLD) / FADE };
  const k = c - INTRO, slot = Math.floor(k / SLOT_T);
  let l = k - slot * SLOT_T;
  for (const [name, d] of [['build', BUILD], ['trace', TRACE], ['echo', ECHO], ['fill', FILL], ['move', MOVE]]) {
    if (l < d) return { slot, stage: name, u: l / d };
    l -= d;
  }
  return { slot, stage: 'move', u: 1 };
}

/** How many paisleys are finished (committed to the page) at stage S. */
export const doneSlots = S => (S.slot >= SLOTS ? SLOTS : Math.max(0, S.slot + (S.stage === 'move' ? 1 : 0)));

/** progress 0..1 as a clock: 0 is the bare border, 1 the last paisley finished. Monotonic. */
export const clockOfProgress = p => INTRO + clamp(p) * (DONE - INTRO);
/** The start of the next paisley after clock c (Enter in playful). */
export const nextSlotClock = c => (c < INTRO ? INTRO : c >= DONE ? null : INTRO + (Math.floor((c - INTRO) / SLOT_T) + 1) * SLOT_T);

/** The n-th border after `seed`, for the playful cycle: 1, 2, 3 or 'goa', 'goa+1'. */
export const seedAfter = (seed, n) => (n === 0 ? seed : typeof seed === 'number' ? seed + n : `${seed}+${n}`);

/**
 * The per-frame description. With `progress` set, only the number moves the
 * border and the scene settles; warm settles once the border is finished.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const held = params.progress != null;
  let clock, cycle = 0;
  if (held) clock = clockOfProgress(params.progress);
  else if (look.cycle) { cycle = Math.floor(Math.max(0, time) / CYCLE); clock = Math.max(0, time) - cycle * CYCLE; }
  else clock = Math.min(Math.max(0, time), STILL_TIME);
  const s = seedAfter(seed, cycle), S = stageAt(clock);
  return { time, seed: s, register, look, held, clock, S, done: doneSlots(S), border: border(s), settled: held || (!look.cycle && clock >= STILL_TIME) };
}
