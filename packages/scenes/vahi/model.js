// Vahi: the pile becomes a ledger. The pure half.
//
// A teak table seen from above. Loose paper lies in a pile at the left; an
// account book lies open in the middle; one paper at a time lifts, drifts
// over the book while its line is written, and settles squared-up on a neat
// stack. When the last line is written the book closes and its string is
// wound round. Everything here is a function of { time, seed, register,
// params }: plain data out, no canvas, runs in Node.

import { rng, clamp, lerp, phase, ease, smoothstep, TAU } from '../../engine/index.js';

export const W = 1200, H = 800;

/** The kinds of paper, in the order a pile is dealt. Fixed, so a reseed keeps the same papers in new places. */
export const KINDS = ['receipt', 'invoice', 'billbook', 'chit', 'receipt', 'invoice', 'chit', 'invoice'];
export const COUNT = KINDS.length;

/** Paper sizes in logical units, before a seeded wobble. */
const SIZE = {
  receipt: [74, 196],
  invoice: [158, 214],
  billbook: [186, 124],
  chit: [106, 94],
};

/** The book: two pages either side of a spine, and the stack beside it. Fixed per layout, not per seed. */
export const BOOK = { x: 516, y: 404, pw: 226, ph: 316, cloth: 8 };
export const STACK = { x: 902, y: 418 };
export const PEN_REST = { x: 792, y: 640, a: -0.34 };
/** Things that live on the table and never move: a steel tumbler of pens and an old calculator. */
export const TUMBLER = { x: 118, y: 112, r: 46 };
export const CALC = { x: 1052, y: 150, w: 150, h: 196, a: 0.12 };

/**
 * How each register paces the sorting. `per` is the seconds one paper takes,
 * `lead` the pause before the first lifts, `close` how long the book takes to
 * close and the string to wind. Quiet never moves; its still is the end.
 */
export const PACE = {
  quiet: { per: 0, lead: 0, close: 0 },
  warm: { per: 3.1, lead: 1.4, close: 2.6 },
  playful: { per: 1.5, lead: 0.7, close: 1.6 },
};

/** One paper's beats, as fractions of its `per`: lift, drift to the book, the line is written, drift to the stack. */
export const BEATS = { lift: 0.12, over: 0.42, write: 0.7 };

/** A pile, a book and a stack for one seed. Memoised: the same seed returns the same object. */
export function makeDesk(seed = 1) {
  const r = rng(`vahi:${seed}`);
  // the pile: a loose heap at the left, overlapping, turned every which way
  const cx = r.range(176, 192), cy = r.range(420, 446);
  const order = shuffle(KINDS.map((_, i) => i), r);
  const papers = KINDS.map((kind, i) => {
    const [w0, h0] = SIZE[kind], k = r.range(0.94, 1.06);
    const ang = r() * TAU, rad = Math.sqrt(r());
    return {
      i, kind, w: w0 * k, h: h0 * k,
      pile: { x: cx + Math.cos(ang) * rad * 88, y: cy + Math.sin(ang) * rad * 176, a: r.range(-0.75, 0.75) },
      stack: null, jog: [r.range(-2, 2), r.range(-2, 2), r.range(-0.03, 0.03)],
      tint: r.range(0, 1), ink: r.range(0, 1), content: r.int(1, 1e6),
      // the entry this paper becomes: a date, a description, an amount, as scribble lengths
      entry: { date: r.range(0.55, 0.9), words: r.range(0.45, 0.95), amount: r.range(0.35, 0.95) },
      rank: 0,
    };
  });
  order.forEach((idx, n) => {
    const p = papers[idx];
    p.rank = n;
    // squared on the stack, filed by the top left corner, each one a little further in, so the edges below show
    p.stack = { x: STACK.x - 94 + p.w / 2 + p.jog[0] + n * 1.4, y: STACK.y - 108 + p.h / 2 + p.jog[1] + n * 2, a: p.jog[2] };
  });
  // the pile is drawn bottom to top in reverse sorting order: the first to go lies on top
  const drawOrder = [...papers].sort((a, b) => b.rank - a.rank).map(p => p.i);
  return { seed, papers, drawOrder, pile: { x: cx, y: cy } };
}

function shuffle(a, r) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const memo = new Map();
export function desk(seed = 1) {
  if (!memo.has(seed)) {
    if (memo.size > 8) memo.delete(memo.keys().next().value);
    memo.set(seed, makeDesk(seed));
  }
  return memo.get(seed);
}

/** Where the line for the n-th entry sits on the open book: the right-hand page is ruled for them. */
export function entryLine(n) {
  const top = BOOK.y - BOOK.ph / 2 + 58, gap = 28;
  return { x0: BOOK.x + 30, x1: BOOK.x + BOOK.pw - 18, y: top + n * gap };
}

/** The spot a paper hovers over while its line is written: above the left-hand page, turned a little. */
export function hoverPose(p) {
  return { x: BOOK.x - BOOK.pw / 2 - 6, y: BOOK.y - 18 + (p.rank % 3) * 10, a: -0.08 + (p.rank % 2) * 0.1 };
}

/**
 * A paper's pose at local progress k (0 = in the pile, 1 = on the stack).
 * It lifts, drifts over the book, waits while its line is written, then
 * settles. `lift` is how high it is off the table, for the shadow.
 */
export function paperPose(p, k) {
  const { lift: L, over: O, write: Wr } = BEATS, hover = hoverPose(p);
  if (k <= 0) return { ...p.pile, lift: 0, k };
  if (k >= 1) return { ...p.stack, lift: 0, k };
  let from, to, u, lift;
  if (k < L) { from = p.pile; to = p.pile; u = 0; lift = ease.outCubic(k / L); }
  else if (k < O) { from = p.pile; to = hover; u = ease.inOutSine(phase(k, L, O)); lift = 1; }
  else if (k < Wr) { from = hover; to = hover; u = 0; lift = 1 - 0.25 * Math.sin(Math.PI * phase(k, O, Wr)); }
  else { from = hover; to = p.stack; u = ease.inOutCubic(phase(k, Wr, 1)); lift = 1 - ease.inQuad(phase(k, 0.86, 1)); }
  // an arc: the path bows upward a little, the way a hand carries paper
  const bow = Math.sin(Math.PI * u) * (to === hover ? -34 : -26);
  return {
    x: lerp(from.x, to.x, u), y: lerp(from.y, to.y, u) + bow,
    a: lerp(from.a, to.a, u) + Math.sin(Math.PI * u) * 0.12,
    lift, k,
  };
}

/** How far through writing its line a paper's entry is, 0 to 1. */
export const writtenOf = k => smoothstep(BEATS.over + 0.02, BEATS.write - 0.02, k);

/** The timeline for a register: when sorting ends and when the book is shut. */
export function timeline(register) {
  const P = PACE[register] ?? PACE.warm;
  const sorted = P.lead + P.per * COUNT;
  return { ...P, sorted, end: sorted + P.close + 0.4 };
}

/**
 * The frame, as plain data.
 * - `progress` absent: time drives the sorting, and once the book is shut the
 *   scene is settled (the element stops drawing).
 * - `progress` set (0..1): exactly that much is sorted, time stands still,
 *   and the book is shut only at 1.
 * - quiet: the end, still.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const D = desk(seed), tl = timeline(register);
  const set = params.progress !== null && params.progress !== undefined;
  let done, close;
  if (set) { done = clamp(params.progress) * COUNT; close = params.progress >= 1 ? 1 : 0; }
  else if (register === 'quiet') { done = COUNT; close = 1; }
  else {
    done = tl.per > 0 ? clamp((time - tl.lead) / tl.per, 0, COUNT) : COUNT;
    close = phase(time, tl.sorted + 0.2, tl.sorted + 0.2 + tl.close * 0.62);
  }
  const wind = set ? close : (register === 'quiet' ? 1 : phase(time, tl.sorted + 0.2 + tl.close * 0.62, tl.sorted + 0.2 + tl.close));
  const papers = D.papers.map(p => {
    const k = clamp(done - p.rank);
    return { ...paperPose(p, k), i: p.i, rank: p.rank, written: k >= 1 ? 1 : writtenOf(k) };
  });
  const moving = papers.find(p => p.k > 0 && p.k < 1) ?? null;
  const entries = papers.filter(p => p.written > 0).map(p => ({ rank: p.rank, i: p.i, written: p.written }));
  // the pen writes while a line is being written, and rests otherwise
  let pen = { ...PEN_REST, writing: false };
  const writing = moving && moving.written > 0 && moving.written < 1 ? moving : null;
  if (writing && close === 0) {
    const L = entryLine(writing.rank), u = writing.written;
    pen = { x: lerp(L.x0, L.x1, u), y: L.y + Math.sin(u * TAU * 7) * 1.6, a: 0.78, writing: true };
  }
  const finished = !set && register !== 'quiet' && time >= tl.end;
  return {
    seed, register, desk: D, papers, entries, pen, moving: moving?.i ?? -1,
    sorted: Math.min(COUNT, Math.floor(done + 1e-9)), done, close: ease.inOutCubic(close), wind,
    settled: set || register === 'quiet' || finished,
  };
}

/** The bounds everything that moves stays inside, for fitting around slotted text. */
export function actionBox(seed = 1) {
  const D = desk(seed);
  let x0 = Math.min(BOOK.x - BOOK.pw - 20, TUMBLER.x - TUMBLER.r - 10), y0 = Math.min(BOOK.y - BOOK.ph / 2 - 60, TUMBLER.y - TUMBLER.r - 10, CALC.y - CALC.h / 2 - 20);
  let x1 = Math.max(STACK.x + 110, CALC.x + CALC.w / 2 + 20), y1 = Math.max(BOOK.y + BOOK.ph / 2 + 30, PEN_REST.y + 60);
  for (const p of D.papers) {
    const rr = Math.hypot(p.w, p.h) / 2;
    x0 = Math.min(x0, p.pile.x - rr); x1 = Math.max(x1, p.pile.x + rr);
    y0 = Math.min(y0, p.pile.y - rr); y1 = Math.max(y1, p.pile.y + rr);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * Where the action sits: as drawn, unless slotted text (the calm rects)
 * would cover it. Then it moves into the largest clear band beside the text
 * and shrinks only as much as it must. Returns { s, tx, ty }. Pure.
 */
export function fitAround(calm, box, w = W, h = H) {
  const id = { s: 1, tx: 0, ty: 0 };
  if (!calm?.length) return id;
  const pad = 18;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of calm) { x0 = Math.min(x0, r.x - pad); y0 = Math.min(y0, r.y - pad); x1 = Math.max(x1, r.x + r.w + pad); y1 = Math.max(y1, r.y + r.h + pad); }
  if (x1 < box.x || x0 > box.x + box.w || y1 < box.y || y0 > box.y + box.h) return id;
  const bands = [
    { x: 0, y: 0, w, h: y0 }, { x: 0, y: y1, w, h: h - y1 },
    { x: 0, y: 0, w: x0, h }, { x: x1, y: 0, w: w - x1, h },
  ].filter(b => b.w > 0 && b.h > 0);
  let best = null;
  for (const b of bands) {
    const s = Math.min(1, (b.w - 12) / box.w, (b.h - 12) / box.h);
    if (!best || s > best.s) best = { s, b };
  }
  if (!best || best.s < 0.42) return id; // too tight to move: stay put and let the scrim do its work
  const { s, b } = best;
  return { s, tx: b.x + b.w / 2 - (box.x + box.w / 2) * s, ty: b.y + b.h / 2 - (box.y + box.h / 2) * s };
}

/** Scatter: where papers fly from when the pile is thrown again (playful). A paper is pushed away from `from`. Pure. */
export function scatterOffset(pose, from, u) {
  const dx = pose.x - from.x, dy = pose.y - from.y, d = Math.hypot(dx, dy) || 1;
  const push = Math.sin(Math.PI * clamp(u)) * 60 * Math.min(1, 220 / d);
  return { x: (dx / d) * push, y: (dy / d) * push };
}
