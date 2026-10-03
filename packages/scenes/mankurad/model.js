// Mankurad: a short story about a mango. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/mankurad.js (read
// only; never edited). The plate's timeline (beats), its shapes (the mango,
// branch, koel, clouds, leaves, ground) come across unchanged. The plate ran
// its pendulum and the fall on the frame clock; here they are stepped at
// fixed sixtieths from the start of the story and remembered, so the whole
// story is a pure function of its local time: the same moment always looks
// the same, a still is exact, and progress can hold the story at any beat.

import { rng, N, TAU, clamp, lerp, phase, ease, smoothstep, catmull, bbox, hexToRgb } from '../../engine/index.js';

export const W = 1000, H = 1000;

export const T = 46;
export const T_FALL = 28.6;
export const S = 1.35;       // mango scale
export const MANGO_C = 86;   // local centre of the mango (unscaled)
export const PAPER = '#f3ede0';
export const INK = '#2c2a36';

export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], clamp(t))).toString(16).padStart(2, '0')).join('');
}

/** Everything the story needs to know at local time lt, as 0..1 dials. */
export function beats(lt) {
  return {
    fadeIn: phase(lt, 0, 1.2),
    fadeOut: phase(lt, 44.4, 46),
    call: phase(lt, 2, 2.6) * (1 - phase(lt, 5.6, 6.4)),
    fly: phase(lt, 7.6, 11),
    cloudsLeave: ease.inOutSine(phase(lt, 33, 44)),
    mood: ease.inOutSine(phase(lt, 10, 18)) * (1 - 0.7 * phase(lt, 32, 40)),
    sun: 1 - 0.92 * phase(lt, 12.5, 17.5) + 0.55 * phase(lt, 35, 41),
    wind: 0.2 + 0.8 * phase(lt, 11, 19) - 0.65 * phase(lt, 32, 38),
    rain: ease.inOutSine(phase(lt, 18, 21)) * (1 - ease.inOutSine(phase(lt, 31, 37.5))),
    puddle: ease.outCubic(phase(lt, 19, 27)),
    wet: phase(lt, 19, 23),
    grass: ease.outCubic(phase(lt, 33.5, 40)),
    card: phase(lt, 37.5, 39.5),
    ripen: 0.6 + 0.3 * phase(lt, 4, 30),
  };
}

// A Mankurad hangs lopsided: a full shoulder on one side, a soft beak low on the other.
export const MANGO = catmull([
  [0, 0], [23, 3], [41, 16], [51, 40], [54, 72], [49, 108], [38, 138], [25, 158], [12, 171],
  [-4, 172], [-22, 164], [-40, 146], [-53, 116], [-58, 80], [-55, 44], [-43, 17], [-22, 3],
], 8, true);
export const MANGO_B = bbox(MANGO);

export const BRANCH = catmull([[1085, -6], [940, 62], [812, 104], [690, 138], [596, 172], [514, 206], [440, 244], [380, 286], [330, 322]], 10);

export const KOEL = catmull([
  [-36, -50], [-28, -57], [-17, -55], [-9, -48], [2, -41], [16, -33], [27, -25], [48, -9], [68, 6], [64, 15],
  [44, 4], [20, -11], [6, -8], [-8, -8], [-22, -15], [-32, -27], [-38, -39], [-39, -46],
], 5, true);
export const KOEL_WING = catmull([[-14, -41], [4, -39], [22, -29], [38, -13], [14, -22], [-6, -27]], 5, true);

export function cloudPts(w, h, seed) {
  const r = rng(`cloud:${seed}`), bumps = [], k = r.int(4, 5);
  for (let i = 0; i < k; i++) {
    const u = (i + 0.5) / k;
    bumps.push([-w / 2 + w * u + r.range(-12, 12), h * r.range(0.5, 0.95) * (0.7 + 0.5 * Math.sin(Math.PI * u))]);
  }
  const top = [], bottom = [], x0 = -w / 2 - 10, x1 = w / 2 + 10;
  for (let x = x0; x <= x1; x += 6) {
    let y = 0;
    for (const [bx, br] of bumps) { const d = x - bx; if (Math.abs(d) < br) y = Math.max(y, Math.sqrt(br * br - d * d)); }
    top.push([x, -Math.max(y, 10 * Math.min(1, (x - x0) / 24, (x1 - x) / 24))]);
  }
  for (let x = x1; x >= x0; x -= 12) bottom.push([x, 9 * Math.sin(Math.PI * ((x - x0) / (x1 - x0)))]);
  return [...top, ...bottom];
}

export const CLOUDS = [
  { x: 250, y: 205, w: 340, h: 76, seed: 1, delay: 0 },
  { x: 700, y: 118, w: 400, h: 84, seed: 2, delay: 0.9 },
  { x: 470, y: 336, w: 270, h: 58, seed: 3, delay: 1.7 },
  { x: 885, y: 300, w: 240, h: 52, seed: 4, delay: 2.4 },
].map(c => ({ ...c, pts: cloudPts(c.w, c.h, c.seed) }));

export const LEAVES = [
  { at: 0.3, a: 1.35, len: 160, wid: 30, curl: 0.5, front: false, tone: '#62803a' },
  { at: 0.42, a: 1.95, len: 175, wid: 33, curl: 0.5, front: false, tone: '#587634' },
  { at: 0.5, a: 1.2, len: 190, wid: 34, curl: 0.35, front: false, tone: '#5f7d37' },
  { at: 0.55, a: 2.4, len: 170, wid: 31, curl: 0.45, front: false, tone: '#7a9543' },
  { at: 0.66, a: 1.55, len: 175, wid: 32, curl: -0.3, front: false, tone: '#688640' },
  { at: 0.72, a: 2.05, len: 150, wid: 28, curl: 0.4, front: false, tone: '#526e30' },
  { at: 0.82, a: 2.25, len: 200, wid: 35, curl: 0.4, front: false, tone: '#5c7936' },
  { at: 0.88, a: 1.35, len: 170, wid: 31, curl: 0.5, front: true, tone: '#76913f' },
  { at: 0.94, a: 2.75, len: 155, wid: 29, curl: 0.3, front: true, tone: '#6a883d' },
  { at: 0.97, a: 1.9, len: 185, wid: 33, curl: 0.25, front: false, tone: '#4f6b2e' },
  { at: 1.0, a: 3.3, len: 140, wid: 27, curl: -0.4, front: true, tone: '#7b9a48' },
  { at: 1.0, a: 2.3, len: 165, wid: 30, curl: 0.2, front: true, tone: '#6b8a3f' },
];

/** A mango leaf in its own frame: base at the origin, pointing along +x. */
export function leafGeom(len, wid, curl) {
  const n = 24, mid = [];
  let px = 0, py = 0;
  for (let i = 0; i <= n; i++) {
    mid.push([px, py]);
    const a = curl * (i / n) * (i / n);
    px += (Math.cos(a) * len) / n; py += (Math.sin(a) * len) / n;
  }
  const L = [], R = [];
  mid.forEach((p, i) => {
    const s = i / n, q = mid[Math.min(n, i + 1)], o = mid[Math.max(0, i - 1)];
    let tx = q[0] - o[0], ty = q[1] - o[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    const w = s < 0.06 ? wid * 0.07 : wid * Math.pow(Math.sin(Math.PI * Math.min(1, (s - 0.06) / 0.94)), 0.7) * (1 - 0.25 * s);
    L.push([p[0] - ty * w * 0.46, p[1] + tx * w * 0.46]);
    R.push([p[0] + ty * w * 0.54, p[1] - tx * w * 0.54]);
  });
  return { mid, L, R, poly: [...L, ...R.slice().reverse()], half: [...mid, ...R.slice().reverse()] };
}


export const GROUND = (() => {
  const top = catmull([[178, 846], [196, 814], [252, 792], [330, 780], [420, 773], [500, 776], [585, 768], [680, 771], [770, 782], [830, 800], [858, 826], [862, 846]], 8);
  const bottom = catmull([[862, 846], [846, 868], [770, 886], [640, 897], [500, 900], [360, 895], [250, 884], [196, 868], [178, 846]], 8).slice(1);
  const rough = bottom.map(([x, y], i) => [x, y + 7 * N(i * 0.35, 8.8) + 5 * N(i * 1.7, 3.1)]);
  return { top, poly: [...top, ...rough] };
})();
export const GROUND_TOP = GROUND.top;


// ── The story as a pure function of its local time (new in the port) ─────────

/** The plate's still: 5.2 s in, the koel calling on the branch over a hanging mango. */
export const STILL_LT = 5.2;
/** Where the fruit lands, the puddle, the branch's anchor and the koel's perch (the plate's own numbers). */
export const LAND = 784;
export const PUDDLE = { x: 560, y: 842, rx: 230, ry: 34 };
export const ANCHOR = [1085, -6];
export const PIVOT_I = BRANCH.findIndex(p => p[0] <= 520);
export const PERCH_I = Math.floor(0.3 * (BRANCH.length - 1));
export const STEM = 24;

/** The wind at local time lt: smooth noise gusts, stronger as the weather turns (the plate's). */
export function windAt(lt, B = beats(lt)) {
  const gust = N(lt * 0.42, 7.7, 1.3) * 1.5 + N(lt * 1.3, 2.1, 4.4) * 0.35;
  return B.wind * (gust + 0.55 * B.rain);
}

/** Rotate a point about the branch's anchor. */
export const rotAbout = (p, beta) => {
  const c = Math.cos(beta), s = Math.sin(beta), dx = p[0] - ANCHOR[0], dy = p[1] - ANCHOR[1];
  return [ANCHOR[0] + dx * c - dy * s, ANCHOR[1] + dx * s + dy * c];
};

const DT = 1 / 60;
let swing = null;
/** The pendulum, θ'' = -ω²·sin θ - c·θ' + push, stepped at fixed sixtieths through one story and remembered. */
export function swingAt(lt) {
  if (!swing) {
    const n = Math.ceil(T / DT) + 2, th = new Float64Array(n);
    let theta = 0.02, omega = 0;
    th[0] = theta;
    for (let k = 1; k < n; k++) {
      const wind = windAt((k - 1) * DT), h = DT / 4;
      for (let i = 0; i < 4; i++) { omega += (-6.5 * Math.sin(theta) - 0.9 * omega + wind * 1.1) * h; theta += omega * h; }
      th[k] = theta;
    }
    swing = th;
  }
  const u = clamp(lt, 0, T) / DT, k = Math.floor(u), f = u - k;
  return lerp(swing[Math.min(k, swing.length - 1)], swing[Math.min(k + 1, swing.length - 1)], f);
}

/** How far the branch bends at lt: the wind, and a spring-back kick once the fruit lets go. */
export function branchBend(lt) {
  const kick = lt >= T_FALL ? -0.014 * Math.exp(-(lt - T_FALL) * 2.2) * Math.sin((lt - T_FALL) * 11) : 0;
  return 0.009 * windAt(lt) + kick;
}

/**
 * Where the mango is at lt, and how it lies: hanging on its stem, falling
 * (a parabola from where it hung when it let go), or bouncing once and
 * settling on its side in the puddle.
 */
export function mangoAt(lt) {
  const hang = STEM + MANGO_C * S;
  const knotAt = t => rotAbout(BRANCH[PIVOT_I], branchBend(t));
  if (lt < T_FALL) {
    const knot = knotAt(lt), pivot = [knot[0], knot[1] + 14], theta = swingAt(lt);
    return { phase: 'hang', knot, pivot, theta, x: pivot[0] - Math.sin(theta) * hang, y: pivot[1] + Math.cos(theta) * hang, r: theta };
  }
  const k0 = knotAt(T_FALL), p0 = [k0[0], k0[1] + 14], th0 = swingAt(T_FALL);
  const c0 = [p0[0] - Math.sin(th0) * hang, p0[1] + Math.cos(th0) * hang], gAcc = 1150;
  const tFall = Math.sqrt((2 * (LAND - c0[1])) / gAcc), k = lt - T_FALL;
  const knot = knotAt(lt), pivot = [knot[0], knot[1] + 14];
  if (k < tFall) {
    const u = k / tFall;
    return { phase: 'fall', knot, pivot, x: lerp(c0[0], 560, ease.inOutSine(u)), y: c0[1] + 0.5 * gAcc * k * k, r: lerp(th0, -0.6, ease.inQuad(u)), tFall };
  }
  const k2 = k - tFall, hop = 0.42;
  return { phase: 'down', knot, pivot, x: 560, y: LAND - (k2 < hop ? Math.sin((k2 / hop) * Math.PI) * 16 : 0), r: lerp(-0.6, -1.42, ease.outBack(clamp(k2 / 0.9))), tFall, landed: T_FALL + tFall };
}

/** The splash when it lands: eighteen drops from one seeded burst (the plate's). */
export const SPLASH = (() => { const sr = rng('splash'); return Array.from({ length: 18 }, () => ({ x: 560 + sr.range(-80, 80), vx: sr.range(-180, 180), vy: sr.range(-340, -160), s: sr.range(1.5, 3.2) })); })();

/** The rain: 320 drops, each a start and a speed (the plate's). */
export const RAIN = (() => { const r = rng('rain'); return Array.from({ length: 320 }, () => ({ x: r.range(-150, W + 260), phase: r.range(0, H + 220), speed: r.range(880, 1150), len: r.range(22, 40), a: r.range(0.25, 0.55) })); })();

/**
 * How each register tells the story: its pace, and whether it loops. quiet is
 * the plate's still. warm tells it at an easier pace and loops through paper,
 * as the plate did; playful at the plate's own pace, and a click or Enter
 * starts it again.
 */
export const LOOKS = {
  quiet: { pace: 0, again: false },
  warm: { pace: 0.8, again: false },
  playful: { pace: 1, again: true },
};

/** progress 0..1 to a beat of the story: from the ripening mango to the card after the rain. */
export const P0 = 1.3, P1 = 40.5;
export const beatOf = progress => lerp(P0, P1, clamp(progress));

/**
 * The per-frame description. The story's local time is the scene's clock at
 * the register's pace, looping every 46 s; with progress set, it is that beat,
 * and time stands still.
 */
const wrapT = x => { const r = x % T; return r < 0 ? r + T : r; };

export function model({ time = 0, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const held = params.progress != null;
  const lt = held ? beatOf(params.progress) : register === 'quiet' ? STILL_LT : wrapT(STILL_LT + (time - STILL_LT) * (look.pace || 1));
  const B = beats(lt);
  return { time, register, look, held, lt, B, wind: windAt(lt, B), v: held ? 0 : Math.floor(lt * 10) % 3, settled: held || register === 'quiet' };
}
