// Vaati: the bowl fills. The pure half.
//
// A bowl seen from directly above. Pieces of fresh pasta fly in from the
// edges along arcs, each with its own spin, and settle, nudging the ones
// already there. Then sauce is poured and spreads in a swirl between them,
// grated cheese falls and catches, basil leaves land, and the bowl rests.
// Everything here is a function of { time, seed, register, params }: plain
// data out, no canvas, runs in Node.

import { rng, clamp, lerp, phase, ease, TAU, ellipse } from '../../engine/index.js';

export const W = 1200, H = 800;

/**
 * The bowl, in logical units. `R` is the outer rim: diameter 344 is 43% of H, so a phone
 * held upright (a crop about 360 units wide of the 800 high scene) still shows all of it, `lip` where the rim turns into the
 * inner wall, `floor` where the wall meets the flat floor, `pack` how far from the
 * centre a piece's outer edge may reach once settled.
 */
export const BOWL = { x: 600, y: 400, R: 172, lip: 150, floor: 116, pack: 137 };
/** Everything drawn is sized against the bowl: 1 is the bowl these shapes were first drawn for (R 246). */
export const K = BOWL.R / 246;

// ── shapes: each a small pure function of a seeded rng ──────────────────
// A shape is { body, layers }: `body` the outline polygon, `layers` painted in order, each
// { k: 'fill', role, pts } or { k: 'line', role, w, paths: [pts, ...], closed? }. Roles are
// colours the renderer owns (body, dome, shade, light, hole, ink, fold), so a new kitchen
// adds `momo` or `modak` here and nothing else.

const rotp = ([x, y], a) => { const c = Math.cos(a), s = Math.sin(a); return [x * c - y * s, x * s + y * c]; };
const shift = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
const scaleBy = (pts, k) => pts.map(([x, y]) => [x * k, y * k]);
const rsq = (h, rad, steps = 5) => {
  const out = [];
  for (const [cx, cy, a0] of [[h - rad, -h + rad, -Math.PI / 2], [h - rad, h - rad, 0], [-h + rad, h - rad, Math.PI / 2], [-h + rad, -h + rad, Math.PI]])
    for (let i = 0; i <= steps; i++) { const a = a0 + (i / steps) * (Math.PI / 2); out.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]); }
  return out;
};
const fill = (role, pts) => ({ k: 'fill', role, pts });
const line = (role, w, paths, closed = false) => ({ k: 'line', role, w, paths, closed });

function ravioli(r) {
  const s = 43 + r.range(-1.5, 1.5), n = 6, bulge = 5.2 + r.range(-0.6, 0.6), body = [];
  for (let e = 0; e < 4; e++) for (let k = 0; k < n; k++) for (let j = 0; j < 7; j++) {
    const f = j / 7, off = bulge * Math.pow(Math.sin(Math.PI * f), 0.7);
    body.push(rotp([-s + (2 * s * (k + f)) / n, -s - off], (e * Math.PI) / 2));
  }
  const h = 28.5 + r.range(-1, 1), dome = rsq(h, 12), ticks = [], m = 13;
  for (let e = 0; e < 4; e++) for (let k = 0; k < m; k++) {
    const x = -(s - 9) + ((k + 0.5) * 2 * (s - 9)) / m;
    ticks.push([rotp([x, -(h + 4)], (e * Math.PI) / 2), rotp([x, -(s - 1.5)], (e * Math.PI) / 2)]);
  }
  return {
    body,
    layers: [
      fill('body', body), fill('shade', shift(dome, 3.6, 4.2)), fill('dome', scaleBy(dome, 0.985)),
      fill('light', ellipse(-10, -12, 9.5, 4.8, { n: 14, rot: -0.65 })),
      line('fold', 1.5, ticks), line('ink', 1.5, [dome], true),
    ],
  };
}

function tortellini(r) {
  const base = 34 + r.range(-1.5, 1.5), ph = r() * TAU, body = [];
  for (let i = 0; i < 56; i++) {
    const th = (i / 56) * TAU, d = Math.atan2(Math.sin(th), Math.cos(th));
    body.push([Math.cos(th) * (base * (1 + 0.04 * Math.sin(3 * th + ph)) + 20 * Math.exp(-Math.pow(d / 0.3, 2))), Math.sin(th) * base * (1 + 0.04 * Math.sin(3 * th + ph))]);
  }
  const ring = ellipse(-4, 1, 17, 17, { n: 20 }), hole = ellipse(-4, 1, 8.5, 8.5, { n: 16 });
  return {
    body,
    layers: [
      fill('body', body), fill('shade', shift(ring, 3, 3.6)), fill('dome', ring), fill('hole', hole),
      fill('light', ellipse(-17, -16, 9, 4.2, { n: 12, rot: -0.75 })),
      line('fold', 1.6, [[[base + 12, 1], [base * 0.7, -9], [base * 0.35, -15], [4, -19]], [[base + 4, 7], [base * 0.7, 12], [base * 0.4, 14]]]),
      line('ink', 1.4, [ring], true),
    ],
  };
}

function gnocchi(r) {
  const a = 44 + r.range(-3, 3), b = 27 + r.range(-2, 2), bend = r.range(-5, 5), body = [];
  for (let i = 0; i < 48; i++) {
    const th = (i / 48) * TAU, c = Math.cos(th), s = Math.sin(th), x = a * Math.sign(c) * Math.pow(Math.abs(c), 0.8);
    body.push([x, b * Math.sign(s) * Math.pow(Math.abs(s), 0.8) + (bend * x * x) / (a * a)]);
  }
  const ridges = [];
  for (let i = 0; i < 7; i++) {
    const x = -a * 0.72 + (i / 6) * a * 1.44, yy = b * 0.8 * Math.pow(1 - Math.pow(x / a, 2), 0.4), bw = (bend * x * x) / (a * a);
    ridges.push([[x - 2.5, -yy + bw], [x + 0.5, bw], [x - 2.5, yy + bw]]);
  }
  return {
    body,
    layers: [
      fill('body', body), fill('shade', shift(scaleBy(body, 0.9), 2, 4)), fill('dome', scaleBy(body, 0.9)),
      fill('light', ellipse(-6, -b * 0.42 + bend * 0.02, a * 0.45, 3.4, { n: 14, rot: -0.04 })),
      line('fold', 1.7, ridges),
    ],
  };
}

function farfalle(r) {
  const wing = (sign) => {
    const w = [], tip = 3.4;
    w.push([sign * 6, -9]);
    w.push([sign * 28, -22 + r.range(-1, 1)]);
    w.push([sign * 47, -33]);
    for (let i = 0; i <= 8; i++) w.push([sign * (47 + (i % 2 ? tip : -tip * 0.4)), -33 + (i / 8) * 66]);
    w.push([sign * 28, 22 + r.range(-1, 1)]);
    w.push([sign * 6, 9]);
    return sign < 0 ? w.reverse() : w;
  };
  const right = wing(1), left = wing(-1), body = [...right, ...left];
  const rays = [], gather = [];
  for (const sg of [1, -1]) for (let i = -2; i <= 2; i++) rays.push([[sg * 9, i * 3.5], [sg * 22, i * 9], [sg * 38, i * 12.5]]);
  for (let i = -2; i <= 2; i++) gather.push([[-6 + i * 0.4, i * 4.6], [0, i * 4.2], [6 - i * 0.4, i * 4.6]]);
  const mid = rsq(9, 6, 3).map(([x, y]) => [x, y * 1.35]);
  return {
    body,
    layers: [
      fill('body', body), fill('shade', shift(right, 2, 3)), fill('shade', shift(left, 2, 3)), fill('body', body),
      fill('dome', mid), fill('light', ellipse(-26, -15, 11, 3.6, { n: 12, rot: 0.5 })),
      line('fold', 1.5, rays), line('ink', 1.4, gather),
    ],
  };
}

/** Basil: a pointed leaf along x with a darker half, a midrib and a few veins. */
function basil(r) {
  const L = (52 + r.range(-4, 6)) * K * 1.05, Wd = (27 + r.range(-2, 3)) * K * 1.05, top = [], bot = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14, x = lerp(-L, L, t), w = Wd * Math.pow(Math.sin(Math.PI * Math.pow(t, 0.78)), 0.85);
    top.push([x, -w]); bot.push([x, w * 0.92]);
  }
  const botR = [...bot].reverse(), body = [...top, ...botR], mid = top.map(([x]) => [x, 0]), veins = [];
  for (let i = 2; i < 12; i += 2) { const [x, y] = top[i]; veins.push([[x - 8, 0], [x + 2, y * 0.55], [x + 5, y * 0.85]], [[x - 8, 0], [x + 2, -y * 0.5], [x + 5, -y * 0.78]]); }
  return {
    body,
    layers: [
      fill('body', body), fill('shade', [...mid, ...botR]),
      fill('light', ellipse(-6, -Wd * 0.42, L * 0.38, 3.2, { n: 12, rot: -0.12 })),
      line('fold', 1.3, veins), line('ink', 1.8, [mid]), line('fold', 2, [[[-L * 1.18, 3], [-L, 0]]]),
    ],
  };
}

/** A flake of grated cheese: a sliver, a shard, or a curl. */
function flake(r, v) {
  const L = (11 + r.range(0, 6)) * K * 1.05, t = (2.4 + r.range(0, 1.6)) * K * 1.1;
  const body = v === 0 ? ellipse(0, 0, L, t, { n: 10 })
    : v === 1 ? [[-L, -t], [L * 0.7, -t * 1.9], [L, t * 0.4], [-L * 0.2, t * 1.7]]
      : ellipse(0, 0, L * 0.8, t * 1.5, { n: 12, rot: 0.4 }).map(([x, y]) => [x, y + 0.045 * x * x]);
  return { body, layers: [fill('body', body), fill('light', shift(scaleBy(body, 0.55), -0.6, -0.8))] };
}

/** How many of each piece fill a bowl, and how much room each takes (fit × its radius). */
export const SHAPES = {
  ravioli: { count: 7, fit: 0.8, size: 1.18 * K, make: ravioli },
  tortellini: { count: 9, fit: 0.84, size: 1.12 * K, make: tortellini },
  gnocchi: { count: 11, fit: 0.72, size: 1.15 * K, make: gnocchi },
  farfalle: { count: 7, fit: 0.78, size: 1.28 * K, make: farfalle },
};
export const KINDS = Object.keys(SHAPES);
export const SAUCES = ['tomato', 'pesto', 'cream', 'none'];

const memoShape = new Map();
/** A shape with its bounding radius `r`; memoised by key. Pure. */
export function shapeOf(kind, key) {
  const id = `${kind}|${key}`;
  if (!memoShape.has(id)) {
    if (memoShape.size > 400) memoShape.clear();
    const make = kind === 'basil' ? basil : kind === 'flake' ? (r => flake(r, +key.split(':').at(-1) % 3)) : (SHAPES[kind] ?? SHAPES.ravioli).make;
    const s = make(rng(`vaati:${id}`)), k = SHAPES[kind]?.size ?? 1;
    if (k !== 1) { s.body = scaleBy(s.body, k); for (const L of s.layers) { if (L.pts) L.pts = scaleBy(L.pts, k); else L.paths = L.paths.map(p => scaleBy(p, k)); } }
    s.r = Math.max(...s.body.map(([x, y]) => Math.hypot(x, y)));
    memoShape.set(id, s);
  }
  return memoShape.get(id);
}

/**
 * Pack circles of radius `rho[i]` into a disc of radius `bound` around (0,0): a seeded
 * spiral, then repulsion, then a hard clamp so nothing can end up outside. Pure.
 */
export function pack(rho, bound, seed) {
  const r = rng(`pack:${seed}`), n = rho.length;
  const p = rho.map((q, i) => { const a = i * 2.39996 + r() * 0.5, d = Math.sqrt((i + 0.5) / n) * Math.max(0, bound - q) * 0.92; return [Math.cos(a) * d, Math.sin(a) * d]; });
  const clampIn = i => { const d = Math.hypot(p[i][0], p[i][1]), lim = Math.max(0, bound - rho[i]); if (d > lim) { p[i][0] *= lim / d; p[i][1] *= lim / d; } };
  for (let it = 0; it < 140; it++) {
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = p[j][0] - p[i][0], dy = p[j][1] - p[i][1], d = Math.hypot(dx, dy) || 0.01, min = (rho[i] + rho[j]) * 0.97;
      if (d < min) { const k = ((min - d) / d) * 0.5; p[i][0] -= dx * k; p[i][1] -= dy * k; p[j][0] += dx * k; p[j][1] += dy * k; }
    }
    for (let i = 0; i < n; i++) { p[i][0] *= 0.995; p[i][1] *= 0.995; clampIn(i); }
  }
  for (let i = 0; i < n; i++) clampIn(i);
  return p;
}

/** Where pieces come in from, in turn: top and bottom twice as often as the sides, since a phone held upright crops the sides away. */
const EDGES = [[0.5, -1], [0.5, 2], [-1, 0.5], [0.5, -1], [0.5, 2], [2, 0.5]];

/**
 * The bowl dealt for one seed and kind of pasta: where each piece rests, where it comes in from,
 * how it spins, which later pieces nudge it, plus the flakes and leaves. Memoised.
 */
export function makeBowl(seed = 1, pieces = 'ravioli', opts = {}) {
  const S = SHAPES[pieces] ?? SHAPES.ravioli, kind = SHAPES[pieces] ? pieces : 'ravioli', r = rng(`vaati:${kind}:${seed}`);
  const shapes = Array.from({ length: S.count }, (_, i) => shapeOf(kind, `${seed}:${i}`));
  const rho = shapes.map(s => s.r * S.fit), at = pack(rho, opts.bound ?? BOWL.pack - 4, `${kind}:${seed}`);
  const edge0 = r.int(0, EDGES.length - 1);
  const items = shapes.map((shape, i) => {
    const e = EDGES[(edge0 + i) % EDGES.length], sx = e[0] < 0 || e[0] > 1 ? (e[0] < 0 ? -140 : W + 140) : W * (0.3 + r() * 0.4), sy = e[1] < 0 || e[1] > 1 ? (e[1] < 0 ? -140 : H + 140) : H * (0.25 + r() * 0.5);
    const rest = { x: BOWL.x + at[i][0], y: BOWL.y + at[i][1], a: r() * TAU };
    const mx = (sx + rest.x) / 2, my = (sy + rest.y) / 2, dd = Math.hypot(rest.x - sx, rest.y - sy), bow = r.sign() * dd * r.range(0.18, 0.34);
    return {
      i, shape, rho: rho[i], rest, tint: r(),
      fly: { sx, sy, cx: mx - ((rest.y - sy) / dd) * bow, cy: my + ((rest.x - sx) / dd) * bow, spin: r.sign() * r.range(2.6, 5.4) },
      nudges: [],
    };
  });
  // the pieces that land later shove the earlier ones a little: a piece rests at `rest`, and is
  // sitting that far back (the sum of its nudges) until each later piece has landed
  for (let i = 1; i < items.length; i++) for (let j = 0; j < i; j++) {
    const a = items[i], b = items[j], dx = b.rest.x - a.rest.x, dy = b.rest.y - a.rest.y, d = Math.hypot(dx, dy) || 1, reach = (a.rho + b.rho) * 1.3;
    if (d < reach) { const m = (1 - d / reach) * 18 * K; b.nudges.push({ by: i, dx: (dx / d) * m, dy: (dy / d) * m, da: ((dx * dy > 0 ? 1 : -1) * m) / 90 }); }
  }
  const flakes = Array.from({ length: 54 }, (_, i) => {
    let x, y;
    if (r() < 0.72) { const q = items[r.int(0, items.length - 1)], a = r() * TAU, d = Math.abs(r.gauss()) * q.rho * 0.55; x = q.rest.x + Math.cos(a) * d; y = q.rest.y + Math.sin(a) * d; }
    else { const a = r() * TAU, d = Math.sqrt(r()) * (BOWL.floor + 10); x = BOWL.x + Math.cos(a) * d; y = BOWL.y + Math.sin(a) * d; }
    const lim = BOWL.pack - 12, dd = Math.hypot(x - BOWL.x, y - BOWL.y);
    if (dd > lim) { x = BOWL.x + ((x - BOWL.x) * lim) / dd; y = BOWL.y + ((y - BOWL.y) * lim) / dd; }
    return { i, v: i % 3, shape: shapeOf('flake', `${seed}:${i}`), rest: { x, y, a: r() * TAU }, at: r(), drift: [r.range(-26, 26), r.range(-34, -8)], spin: r.sign() * r.range(1.5, 4.5) };
  });
  const lr = r() * TAU;
  const leaves = [0, 1, 2].map(i => {
    const a = lr + (i * TAU) / 3 + r.range(-0.3, 0.3), d = r.range(52, 104) * K;
    return { i, shape: shapeOf('basil', `${seed}:${i}`), rest: { x: BOWL.x + Math.cos(a) * d, y: BOWL.y + Math.sin(a) * d, a: a + r.range(-0.6, 0.6) }, spin: r.sign() * r.range(0.7, 1.5) };
  });
  return { seed, kind, items, flakes, leaves, swirl: r() * TAU, wobble: [r() * TAU, r() * TAU] };
}

const memoBowl = new Map();
export function bowl(seed = 1, pieces = 'ravioli') {
  const k = `${pieces}|${seed}`;
  if (!memoBowl.has(k)) { if (memoBowl.size > 8) memoBowl.delete(memoBowl.keys().next().value); memoBowl.set(k, makeBowl(seed, pieces)); }
  return memoBowl.get(k);
}

// ── time ─────────────────────────────────────────────────────────────────

/** Seconds: `lead` before the first piece, `stagger` between pieces, and how long each beat takes. Quiet never moves. */
export const PACE = {
  warm: { lead: 0.6, stagger: 1.05, flight: 1.6, gap: 0.3, pour: 3.4, cheese: 2.8, fall: 0.85, leaf: 1.1, leafStagger: 0.55, rest: 0.7 },
  playful: { lead: 0.15, stagger: 0.3, flight: 0.82, gap: 0.12, pour: 1.5, cheese: 1.3, fall: 0.46, leaf: 0.58, leafStagger: 0.22, rest: 0.7 },
};
PACE.quiet = PACE.warm;

/** Every beat's start and end for a register and what the bowl holds. `done` is when the garnish has landed, `end` when all is still. */
export function timeline(register, { n = 7, sauce = 'tomato', topping = 'cheese', garnish = 'basil' } = {}) {
  const P = PACE[register] ?? PACE.warm;
  const pieces = Array.from({ length: n }, (_, i) => { const start = P.lead + i * P.stagger; return { start, land: start + P.flight }; });
  let t = pieces[n - 1].land, done = t;
  const pour = sauce !== 'none' ? { start: t + P.gap, end: t + P.gap + P.pour } : null;
  if (pour) { t = pour.end; done = Math.max(done, t); }
  const cheese = topping !== 'none' ? { start: pour ? pour.start + P.pour * 0.62 : t + P.gap } : null;
  if (cheese) { cheese.end = cheese.start + P.cheese; t = Math.max(t, cheese.end); done = Math.max(done, cheese.end); }
  const leaves = garnish !== 'none' ? [0, 1, 2].map(i => { const start = (cheese ? cheese.end - P.fall * 0.5 : t + P.gap) + i * P.leafStagger; return { start, land: start + P.leaf }; }) : [];
  if (leaves.length) done = Math.max(done, leaves[2].land);
  return { ...P, pieces, pour, cheese, leaves, done, end: done + P.rest };
}

/** A small damped wobble that is 0 at τ = 0: the squash of something that has just landed. */
export const bounce = (tau, k = 7, w = 15) => (tau <= 0 ? 0 : Math.exp(-k * tau) * Math.sin(w * tau));
/** 0 → 1 with a little overshoot: a thing nudged into place. */
export const settleCurve = tau => (tau <= 0 ? 0 : tau > 2 ? 1 : 1 - Math.exp(-8 * tau) * Math.cos(10 * tau));
const quad = (a, b, c, u) => { const v = 1 - u; return v * v * a + 2 * v * u * b + u * u * c; };

/** The toss (playful): each piece hops up, turns, and lands in a slightly different place. */
export const TOSS = { air: 0.85, stagger: 0.07 };
export const tossSpan = n => TOSS.air + (n - 1) * TOSS.stagger + 0.7;
/** The little rearrangement a piece lands in after the k-th toss; k = 0 is as dealt. Pure. */
export function arrangement(it, k) {
  if (k <= 0) return { dx: 0, dy: 0, da: 0 };
  const r = rng(`toss:${it.i}:${k}`);
  return { dx: r.range(-9, 9) * K, dy: r.range(-9, 9) * K, da: r.range(-0.9, 0.9) };
}

/** A piece's pose at `time`: where, how turned, how big (it is nearer the camera while it is in the air), how squashed. */
export function piecePose(it, tl, time, toss = null) {
  const T = tl.pieces[it.i], n = toss ? toss.n : 0, A = arrangement(it, n - 1), B = arrangement(it, n);
  const tossing = !!toss && time >= toss.at, hops = tossing && T.land <= toss.at;
  const tau = tossing ? time - toss.at - it.i * TOSS.stagger : 0, v = hops ? phase(tau, 0, TOSS.air) : 0, e = ease.inOutSine(v);
  const off = !tossing ? A : hops ? { dx: lerp(A.dx, B.dx, e), dy: lerp(A.dy, B.dy, e), da: lerp(A.da, B.da, e) } : B;
  let x = it.rest.x + off.dx, y = it.rest.y + off.dy, a = it.rest.a + off.da, s = 1, z = 0, sq = 0;
  if (time < T.start) return { i: it.i, vis: false, x, y, a, s, z, sq };
  // nudges: sitting back by the sum of the later pieces' shoves until each has landed
  for (const nd of it.nudges) { const kk = settleCurve(time - tl.pieces[nd.by].land) - 1; x += nd.dx * kk; y += nd.dy * kk; a += nd.da * kk; }
  const u = phase(time, T.start, T.land);
  if (u < 1) {
    const q = ease.outCubic(u), f = it.fly;
    x = quad(f.sx, f.cx, x, q); y = quad(f.sy, f.cy, y, q); a += f.spin * (1 - q); z = 1 - q; s = 1 + 0.55 * z;
  } else sq = bounce(time - T.land);
  if (hops && v > 0 && v < 1) { z = Math.pow(Math.sin(Math.PI * v), 0.8); s = 1 + 0.6 * z; sq = 0; a += (it.i % 2 ? 1 : -1) * TAU * e; }
  else if (hops && v >= 1) sq = bounce(tau - TOSS.air);
  return { i: it.i, vis: true, x, y, a, s, z, sq };
}

/** One flake (or leaf) falling onto the bowl: nearer and turning while it falls, a little hop when it lands. */
function fallPose(c, T, time, toss, salt) {
  const i = c.i;
  let x = c.rest.x, y = c.rest.y, a = c.rest.a, s = 1, z = 0, alpha = 1;
  const u = phase(time, T.start, T.land), vis = time >= T.start;
  if (!vis) return { i, vis, x, y, a, s, z, alpha: 0 };
  if (u < 1) {
    const e = ease.inQuad(u), g = 1 - e;
    if (c.drift) { x += c.drift[0] * g; y += c.drift[1] * g; }
    a += c.spin * g; z = g; s = 1 + 0.85 * g; alpha = clamp(u * 7);
  } else if (!toss || time < toss.at) s = 1 + 0.12 * bounce(time - T.land, 8, 20);
  if (toss && time >= toss.at) {
    const tau = time - toss.at - ((salt * 0.031) % 0.3), v = phase(tau, 0, 0.6);
    if (v > 0 && v < 1) { z = Math.pow(Math.sin(Math.PI * v), 0.8) * 0.6; s = 1 + z; a += c.spin * 0.4 * ease.inOutSine(v); } else if (v >= 1) s = 1 + 0.12 * bounce(tau - 0.6, 8, 20);
  }
  return { i, vis, x, y, a, s, z, alpha };
}

/** The pouring spiral, u from 0 (the middle) to 1 (out near the wall). Pure. */
export function swirlPoint(u, a0 = 0, wob = [0, 0]) {
  const th = a0 + u * TAU * 1.65, d = (20 + 142 * Math.pow(u, 0.9) + 4 * Math.sin(u * 17 + wob[0])) * K;
  return [BOWL.x + Math.cos(th) * d, BOWL.y + Math.sin(th) * d];
}

/** A hand-held draw toward the end of a run: the settle event fires once per run, never under `progress`. Pure. */
export function settleGate() {
  let epoch = null, fired = false;
  return ({ done, progressSet, epoch: e }) => {
    if (e !== epoch) { epoch = e; fired = false; }
    if (progressSet || !done || fired) return false;
    return (fired = true);
  };
}

/**
 * The frame, as plain data.
 * - `progress` absent: time drives the bowl; once it is still the scene is settled (the element stops drawing).
 * - `progress` set (0..1): time stands still at that fill; 1 is the finished bowl.
 * - quiet: the finished bowl, still.
 * - `tossAt` and `tossN` are set by the playful renderer when the bowl is tossed: the model time the toss began, and how many tosses so far.
 * @param {{ time?: number, seed?: number, register?: string, params?: Record<string, any>, W?: number, H?: number }} [args]
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const pieces = SHAPES[params.pieces] ? params.pieces : 'ravioli', sauce = SAUCES.includes(params.sauce) ? params.sauce : 'tomato';
  const topping = params.topping === 'none' ? 'none' : 'cheese', garnish = params.garnish === 'none' ? 'none' : 'basil';
  const D = bowl(seed, pieces), tl = timeline(register, { n: D.items.length, sauce, topping, garnish });
  const set = params.progress !== null && params.progress !== undefined;
  const t = set ? (params.progress >= 1 ? tl.end + 5 : clamp(params.progress) * tl.done) : register === 'quiet' ? tl.end + 5 : time;
  const toss = !set && register === 'playful' && params.tossAt !== null && params.tossAt !== undefined && params.tossN > 0 ? { at: params.tossAt, n: params.tossN } : null;
  const tossEnd = toss ? toss.at + tossSpan(D.items.length) : 0;
  const tossing = !!toss && t >= toss.at && t < tossEnd;
  const ps = D.items.map(it => piecePose(it, tl, t, toss));
  let sauceOut = null;
  if (tl.pour) {
    const u = phase(t, tl.pour.start, tl.pour.end);
    sauceOut = { kind: sauce, fade: 0.4 / (0.85 * (tl.pour.end - tl.pour.start)), pool: ease.outCubic(phase(t, tl.pour.start, tl.pour.end - 0.4)), ribbon: ease.inOutSine(phase(t, tl.pour.start, tl.pour.start + (tl.pour.end - tl.pour.start) * 0.85)), stream: t >= tl.pour.start && t < tl.pour.end ? 1 : 0, sink: ease.inOutSine(phase(t, tl.pour.end - 0.6, tl.pour.end + 0.8)), u };
  }
  const flakes = topping === 'none' ? [] : D.flakes.map(f => {
    const span = tl.cheese.end - tl.cheese.start - tl.fall, start = tl.cheese.start + f.at * span;
    return fallPose(f, { start, land: start + tl.fall }, t, toss, f.i);
  });
  const leaves = garnish === 'none' ? [] : D.leaves.map(l => fallPose(l, tl.leaves[l.i], t, toss, l.i + 3));
  const done = t >= tl.done;
  return {
    seed, register, deal: D, pieces: ps, sauce: sauceOut, flakes, leaves, params: { pieces, sauce, topping, garnish },
    done: done && !tossing, tossing, progressSet: set, fill: set ? clamp(params.progress) : clamp(t / tl.done),
    settled: set || register === 'quiet' || (t >= tl.end && !tossing),
  };
}
