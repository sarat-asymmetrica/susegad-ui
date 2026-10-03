// Neel: a block, a table, a length of cotton. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/neel.js (read only;
// never edited). The plate's carving (carve: the buti motif from a seed) and
// its stamping plan (plan: the half-drop repeat, two passes, ink loads, turns,
// off-register) come across unchanged. The port adds the printer's timeline
// as a pure function of time (printerAt), progress as a share of the
// impressions, the calm filter and model(). No DOM in any of it.

import { rng, clamp, lerp, ease, TAU, catmull, roughen, bbox } from '../../engine/index.js';

export const W = 1200, H = 900, SCALE = 1.28, BLOCK = 148 * SCALE, TEMP = Math.ceil(184 * SCALE);
const UP = -Math.PI / 2;

export const PALETTES = [
  { a: '#22335e', b: '#a63a2b', cloth: '#efe8d8' },   // indigo and madder
  { a: '#1f2f58', b: '#c98f1d', cloth: '#f0eadb' },   // indigo and haldi
  { a: '#2b2521', b: '#a8392a', cloth: '#ece2cd' },   // iron black and madder, the Bagru pair
  { a: '#23355f', b: '#6b7a3b', cloth: '#efe9da' },   // indigo and mehendi green
];

// ── Pure core: carving the block ──────────────────────────────────────────

/** A pointed lens (petal or leaf) from base (bx, by) along angle ang. */
function lens(bx, by, ang, len, wid, { bend = 0, point = 0.75, n = 22 } = {}) {
  const ca = Math.cos(ang), sa = Math.sin(ang), side = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    side.push([u * len, bend * len * u * u, (wid / 2) * Math.pow(Math.sin(Math.PI * Math.pow(u, point)), 0.9)]);
  }
  const pts = [...side.map(([x, c, w]) => [x, c + w]), ...side.slice(1, -1).reverse().map(([x, c, w]) => [x, c - w])];
  return pts.map(([x, y]) => [bx + x * ca - y * sa, by + x * sa + y * ca]);
}
/** The centre line of a lens, for veins and midribs. */
function midline(bx, by, ang, len, bend, frac) {
  const ca = Math.cos(ang), sa = Math.sin(ang), out = [];
  for (let i = 1; i <= 10; i++) { const u = (i / 10) * frac; const x = u * len, y = bend * len * u * u; out.push([bx + x * ca - y * sa, by + x * sa + y * ca]); }
  return out;
}
const circle = (cx, cy, r, n = 28) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * TAU) * r, cy + Math.sin((i / n) * TAU) * r]);
const halfEllipse = (cx, cy, rx, ry, n = 16) => Array.from({ length: n + 1 }, (_, i) => [cx + Math.cos((i / n) * Math.PI) * rx, cy + Math.sin((i / n) * Math.PI) * ry]);
const flip = pts => pts.map(([x, y]) => [-x, y]).reverse();

/**
 * Carve a buti. Items are in z-order: later shapes knock out what is under
 * them, the way a carver only cuts the lines you can see.
 * { shape, kind: 'fill'|'tint'|'plain' } | { line, w } | { dot: [x, y, r] }
 */
export function carve(seed) {
  const r = rng(`block:${seed}`), items = [];
  const shape = (pts, kind, mirror = false) => { items.push({ shape: pts, kind }); if (mirror) items.push({ shape: flip(pts), kind }); };
  const line = (pts, w = 1.8, mirror = false) => { items.push({ line: pts, w }); if (mirror) items.push({ line: flip(pts), w }); };
  const dot = (x, y, rad) => items.push({ dot: [x, y, rad] });
  const type = r.pick(['bud', 'rosette', 'sprig']);

  if (type === 'bud') {
    const top = r.range(-12, -4), plen = r.range(34, 42), pw = r.range(17, 23);
    line([[0, 64], [0, 30], [0, top + 6]], 2);
    const pairs = r.int(1, 2);
    for (let k = 0; k < pairs; k++) {
      const y = 50 - k * 22, len = r.range(26, 34) * (1 - k * 0.18), wid = r.range(10, 13) * (1 - k * 0.12), a = UP + r.range(0.85, 1.15);
      shape(lens(1, y, a, len, wid, { bend: -0.2, point: 0.6 }), 'tint', true);
      line(midline(1, y, a, len, -0.2, 0.78), 1.2, true);
    }
    const sa = r.range(0.45, 0.68);
    shape(lens(2, top + 3, UP + sa, plen * 0.82, pw * 0.78, { point: 0.8 }), 'fill', true);
    shape(lens(0, top, UP, plen, pw, { point: 0.85 }), 'fill');
    line(midline(0, top, UP, plen, 0, 0.62), 1.3);
    shape(halfEllipse(0, top + 1, 11, 8), 'tint');
    const nd = r.int(3, 5);
    for (let i = 0; i < nd; i++) { const a = UP + (i - (nd - 1) / 2) * 0.33; dot(Math.cos(a) * (plen + 11), top + Math.sin(a) * (plen + 11), 2.4); }
  } else if (type === 'rosette') {
    const n = r.pick([5, 6, 8]), len = r.range(30, 38), wid = r.range(16, 22) * (n === 8 ? 0.8 : 1), cr = r.range(6, 9);
    for (let i = 0; i < n; i++) {
      const a = UP + ((i + 0.5) / n) * TAU;
      shape(lens(Math.cos(a) * cr, Math.sin(a) * cr, a, len * 0.82, wid * 0.8, { point: 0.7 }), 'tint');
    }
    for (let i = 0; i < n; i++) {
      const a = UP + (i / n) * TAU, bx = Math.cos(a) * cr, by = Math.sin(a) * cr;
      shape(lens(bx, by, a, len, wid, { point: 0.82 }), 'fill');
      line(midline(bx, by, a, len, 0, 0.55), 1.2);
    }
    shape(circle(0, 0, cr + 1.5), 'plain');
    dot(0, 0, cr * 0.5);
    for (let i = 0; i < n; i++) { const a = UP + (i / n) * TAU, R = cr + len + 9; dot(Math.cos(a) * R, Math.sin(a) * R, 2.2); }
  } else {
    line([[0, 64], [0, 22], [0, -34]], 2);
    const branch = catmull([[0, 20], [15, 8], [27, -6], [31, -20]], 6);
    line(branch, 1.6, true);
    shape(lens(1, 48, UP + r.range(0.9, 1.1), r.range(24, 30), r.range(9, 12), { bend: -0.22, point: 0.6 }), 'tint', true);
    const bl = r.range(15, 19);
    shape(lens(31, -19, UP + 0.15 + 0.55, bl * 0.8, 8, { point: 0.8 }), 'fill', true);
    shape(lens(31, -19, UP + 0.15 - 0.55, bl * 0.8, 8, { point: 0.8 }), 'fill', true);
    shape(lens(31, -20, UP + 0.15, bl, 10, { point: 0.85 }), 'fill', true);
    const tn = 5, tl = r.range(15, 18);
    for (let i = 0; i < tn; i++) { const a = UP + (i / tn) * TAU; shape(lens(Math.cos(a) * 4, -44 + Math.sin(a) * 4, a, tl, 10, { point: 0.8 }), 'fill'); }
    shape(circle(0, -44, 5), 'plain');
    dot(0, -44, 2.4);
    dot(0, -72, 2.3); dot(13, -68, 2); dot(-13, -68, 2);
  }
  // The carver's hand: every outline wobbles a little, identically on every impression.
  const sc = pts => pts.map(([x, y]) => [x * SCALE, y * SCALE]);
  items.forEach((it, i) => {
    if (it.shape) it.shape = roughen(sc(it.shape), { amp: 0.6, freq: 0.08, seed: seed * 13 + i, step: 1.8 });
    if (it.line) it.line = sc(it.line);
    if (it.dot) it.dot = [it.dot[0] * SCALE, it.dot[1] * SCALE, it.dot[2] * 1.2];
  });
  const all = items.flatMap(it => it.shape || it.line || (it.dot ? [[it.dot[0] - it.dot[2], it.dot[1] - it.dot[2]], [it.dot[0] + it.dot[2], it.dot[1] + it.dot[2]]] : []));
  return { type, items, bounds: bbox(all) };
}

/** The stamping sequence: a half-drop repeat sized to the motif, printed row
 *  by row (serpentine), with the ragged edge rows left for last. */
export function plan(seed, bounds) {
  const r = rng(`plan:${seed}`);
  const sx = clamp(bounds.w + 44, 120, 220), sy = clamp(bounds.h + 22, 160, 230);
  const cols = Math.ceil(W / sx) + 1, x0 = (W - (cols - 1) * sx) / 2, cy = -(bounds.y + bounds.h / 2);
  const cells = [];
  for (let i = 0; i < cols; i++) {
    const x = x0 + i * sx, off = i % 2 ? sy / 2 : 0;
    for (let y = 104 + off - sy; y < H + sy; y += sy) if (y > -sy * 0.4 && y < H + sy * 0.4) cells.push([x, y + cy]);
  }
  const rows = [...new Set(cells.map(c => c[1]))].sort((a, b) => a - b);
  const main = rows.filter(y => y >= 40), edge = rows.filter(y => y < 40);
  const ordered = [...main, ...edge].flatMap((y, k) => { const row = cells.filter(c => c[1] === y).sort((a, b) => a[0] - b[0]); return k % 2 ? row.reverse() : row; });
  const reg = [r.sign() * r.range(2.5, 5), r.sign() * r.range(2, 4.5)];
  const rp = rng(`pause:${seed}`);
  const seq = [];
  for (const pass of [0, 1]) {
    let sinceDip = 0, dipEvery = r.int(5, 7);
    ordered.forEach(([x, y], k) => {
      if (sinceDip >= dipEvery) { sinceDip = 0; dipEvery = r.int(5, 7); }
      const load = Math.pow(0.9, sinceDip++);
      const dur = pass === 0
        ? lerp(1.35, 0.62, ease.outCubic(Math.min(1, k / 10)))
        : k === 0 ? 1.6 : lerp(0.9, 0.6, ease.outCubic(Math.min(1, k / 8)));
      seq.push({
        x: x + (pass ? reg[0] : 0) + r.range(-1.5, 1.5), y: y + (pass ? reg[1] : 0) + r.range(-1.5, 1.5),
        rot: r.range(-0.035, 0.035), pass, load, dur, variant: r.int(0, 3), mo: [r(), r()],
        pause: rp.range(0.1, 0.28),
      });
    });
  }
  return { seq, palette: PALETTES[Math.floor(r() * PALETTES.length)] };
}


// ── The printer's timeline (the port's; the plate stepped it by dt) ──────────

/** Where the block waits before the first impression, and where it goes home to. */
export const REST_IN = [-140, 170], REST_OUT = [W + 170, H * 0.72];
/** Seconds the block takes to carry itself home after the last impression. */
export const HOME = 1.6;
/** Share of an impression's time spent travelling, and the moment the ink goes down. */
export const TRAVEL = 0.4, PRESS = 0.62;

/**
 * How each register prints: `pace` scales the printer's clock (quiet prints
 * nothing live: it is the finished length), and `hand` lets a press land
 * where the pointer or the keyboard hand is.
 */
export const LOOKS = {
  quiet: { pace: 0, hand: false },
  warm: { pace: 1, hand: false },
  playful: { pace: 1.5, hand: true },
};

const memo = new Map();
/** The motif and its stamping plan for a seed, built once. */
export function planOf(seed) {
  if (!memo.has(seed)) {
    if (memo.size > 8) memo.delete(memo.keys().next().value);
    const motif = carve(seed), p = plan(seed, motif.bounds);
    memo.set(seed, { motif, seq: p.seq, palette: p.palette });
  }
  return memo.get(seed);
}

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
/** An impression's footprint on the cloth: the motif's own box, a little wider. */
export const footprint = (s, bounds, pad = 10) => ({ x: s.x + bounds.x - pad, y: s.y + bounds.y - pad, w: bounds.w + 2 * pad, h: bounds.h + 2 * pad });

/**
 * The impressions that are printed at all: none whose motif would land under
 * the page's words, so the words sit on plain cloth. Pure.
 */
export function visibleSeq(seq, bounds, calm = []) {
  if (!calm.length) return seq;
  return seq.filter(s => !calm.some(r => overlaps(footprint(s, bounds), r)));
}

const starts = new WeakMap();
/** When each impression begins, in printer seconds: each takes its dur and a breath (pause). */
function startsOf(seq) {
  if (!starts.has(seq)) {
    const out = new Float64Array(seq.length + 1);
    for (let i = 0; i < seq.length; i++) out[i + 1] = out[i] + seq[i].dur + (seq[i].pause || 0);
    starts.set(seq, out);
  }
  return starts.get(seq);
}
/** How long the whole length takes to print, and to carry the block home. */
export const printLength = seq => startsOf(seq)[seq.length] + HOME;

/** The block's lift through one impression (1 is lifted, 0 is pressed): the plate's own curve. */
export function lift(u) {
  if (u < TRAVEL) return 1;
  if (u < PRESS) return 1 - ease.inQuad((u - TRAVEL) / (PRESS - TRAVEL));
  if (u < 0.7) return 0;
  return ease.outCubic(Math.min(1, (u - 0.7) / 0.3));
}

/**
 * The printer at printer-time t, as plain numbers: how many impressions are
 * down, and where the block is (x, y, how lifted, turned, which pass's ink),
 * or null once it has gone home. Pure, and the same for the same seq and t.
 */
export function printerAt(seq, t) {
  const S = startsOf(seq), n = seq.length;
  if (!(t > 0)) return { applied: 0, block: { x: REST_IN[0], y: REST_IN[1], h: 1, rot: 0, pass: 0 }, done: false };
  if (t >= S[n]) {
    const u = Math.min(1, (t - S[n]) / HOME), last = n ? seq[n - 1] : { x: REST_IN[0], y: REST_IN[1], pass: 0 }, mv = ease.inOutCubic(u);
    const block = u >= 1 ? null : { x: lerp(last.x, REST_OUT[0], mv), y: lerp(last.y, REST_OUT[1], mv), h: 1, rot: 0, pass: last.pass };
    return { applied: n, block, done: u >= 1 };
  }
  let lo = 0, hi = n - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (S[mid] <= t) lo = mid; else hi = mid - 1; }
  const s = seq[lo], u = Math.min(1, (t - S[lo]) / s.dur);
  const from = lo ? seq[lo - 1] : { x: REST_IN[0], y: REST_IN[1] }, mv = ease.inOutCubic(Math.min(1, u / TRAVEL));
  return {
    applied: lo + (u >= PRESS ? 1 : 0),
    block: { x: lerp(from.x, s.x, mv), y: lerp(from.y, s.y, mv), h: lift(u), rot: s.rot, pass: s.pass },
    done: false,
  };
}

/** A press under the hand (playful): both blocks, outline then fill, a little off each other. The plate's click. */
export function pressAt(seed, count, x, y) {
  const r = rng(`click:${seed}:${count}`);
  const base = { x, y, rot: r.range(-0.04, 0.04), variant: r.int(0, 3), mo: [r(), r()], click: true };
  return [
    { ...base, pass: 0, load: r.range(0.8, 1), dur: 0.75 },
    { ...base, x: x + r.range(-4, 4), y: y + r.range(-4, 4), mo: [r(), r()], pass: 1, load: r.range(0.75, 1), dur: 0.55 },
  ];
}

/**
 * The per-frame description: the plan, and the printer's own clock (scene
 * time scaled by the register's pace). With progress set, exactly that share
 * of the impressions is down, the block is home, and the scene rests.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const p = planOf(seed), held = params.progress != null;
  const pt = look.pace ? time * look.pace : Infinity;
  return { time, seed, register, look, ...p, held, progress: held ? clamp(params.progress) : null, printerTime: pt, settled: held || (look.pace > 0 && pt >= printLength(p.seq)) };
}
