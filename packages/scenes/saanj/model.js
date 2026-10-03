// Saanj: dusk over the paddy, and the rosy starlings coming home. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/saanj.js (read only;
// never edited). The colour (OKLab and OKLCH, mixed by hand), the Poisson-disc
// stars, the scene from a seed and the boids flock are the plate's own code,
// brought across line for line. What the port adds: the registers, a calm
// zone the flock steers round, a governor's share of birds, and model(), the
// per-frame description. The flock is plain typed arrays stepped by a pure
// function: same seed, same steps, same birds, in Node or in a browser.

import { rng, makeNoise, clamp, lerp, phase, ease, TAU, poissonDisc } from '../../engine/index.js';

export const W = 1200, H = 800, HZ = 566;
/** One evening, night and dawn, in seconds of the scene's own clock. */
export const CYCLE = 88;
export const T = { roost: 40, roostEnd: 54, dawn: 64, leave: 71, dawnEnd: 78 };
/** The plate's own still: the murmuration mid-sky as the light goes. */
export const STILL_TIME = 20;
export const STILL_DARK = 0.52;
/** Birds in the full flock (the plate's own number). */
export const NB = 620;

/**
 * How each register lives in the evening. `pace` scales the scene's clock
 * (warm is an easier dusk), `birds` is the share of the flock that flies, and
 * `hawk` says whether the pointer (or the keyboard hand) is a hawk.
 */
export const LOOKS = {
  quiet: { pace: 0, birds: 1, hawk: false },
  warm: { pace: 0.8, birds: 0.8, hawk: false },
  playful: { pace: 1, birds: 1, hawk: true },
};

// ── Colour ────────────────────────────────────────────────────────────────

const toLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

/** sRGB (0..1) → OKLab [L, a, b] (Björn Ottosson, 2020). */
export function rgbToOklab([r, g, b]) {
  r = toLin(r); g = toLin(g); b = toLin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  ];
}
/** OKLab → linear-light sRGB, unclamped (may fall outside 0..1). */
function oklabToLinear([L, a, b]) {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}
const inGamut = c => c.every(v => v >= -1e-4 && v <= 1 + 1e-4);
/** OKLCH (h in degrees) → sRGB 0..255. Out-of-gamut colours keep their
 *  lightness and hue and lose chroma until they fit. */
export function oklchToRgb(L, C, h) {
  const hr = (h * Math.PI) / 180, lab = c => [L, c * Math.cos(hr), c * Math.sin(hr)];
  let lin = oklabToLinear(lab(C));
  if (!inGamut(lin)) {
    let lo = 0, hi = C;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (inGamut(oklabToLinear(lab(mid)))) lo = mid; else hi = mid; }
    lin = oklabToLinear(lab(lo));
  }
  return lin.map(v => Math.round(clamp(toGam(clamp(v))) * 255));
}

/** The dusk ramp: s = 0 is the glow at the horizon, s = 1 is deep night at
 *  the zenith. Stops are OKLCH; hue is unwrapped so it travels
 *  apricot → rose → violet → indigo without crossing through grey. */
const RAMP = [
  [0.00, 0.91, 0.070, 78],
  [0.16, 0.82, 0.110, 58],
  [0.34, 0.70, 0.120, 18],
  [0.50, 0.57, 0.105, -18],
  [0.66, 0.44, 0.090, -62],
  [0.82, 0.31, 0.075, -85],
  [1.00, 0.19, 0.048, -92],
];
export function skyLch(s) {
  s = clamp(s);
  let i = 0;
  while (i < RAMP.length - 2 && s > RAMP[i + 1][0]) i++;
  const a = RAMP[i], b = RAMP[i + 1], u = ease.inOutSine(clamp((s - a[0]) / (b[0] - a[0])));
  return [lerp(a[1], b[1], u), lerp(a[2], b[2], u), lerp(a[3], b[3], u)];
}
/** Where on the ramp a height in the sky sits, for a darkness d (0..1). v = 0 at the top, 1 at the horizon. */
export const skyS = (v, d) => clamp(d * 0.8 + Math.pow(1 - v, 1.25) * (0.3 + 0.18 * d));

/** How dark it is at local cycle time t. */
export function darkness(t) {
  if (t < T.roost) return lerp(0, 0.46, ease.inOutSine(phase(t, 2, T.roost)));
  if (t < T.dawn) return lerp(0.46, 1, ease.inOutSine(phase(t, T.roost, T.roost + 18)));
  return lerp(1, 0, ease.inOutSine(phase(t, T.dawn, T.dawnEnd)));
}
/** A dark page gets the same evening later on: dusk deepening into night, never an inverted picture. */
export const nightFor = d => lerp(0.5, 0.9, d);

// ── The scene ─────────────────────────────────────────────────────────────

/** Palms, their crowns (the roost) and the stars, from a seed. Pure. */
export function buildScene(seed) {
  const r = rng(`saanj:${seed}`);
  // a loose line of palms, thicker on one side, with a gap or two
  const side = r.sign();
  const spots = [];
  let x = side > 0 ? r.range(480, 560) : r.range(60, 120);
  const end = side > 0 ? W - 20 : r.range(640, 720);
  // palms grow in clumps of one to three, leaning away from each other
  while (x < end) {
    const clump = r.pick([1, 2, 2, 3]);
    for (let c = 0; c < clump; c++) spots.push({ x: x + (c - (clump - 1) / 2) * r.range(10, 22), lean: (c - (clump - 1) / 2) * r.range(0.08, 0.2), tall: c === 0 ? 1 : r.range(0.6, 0.9) });
    x += r.range(110, 210);
  }
  spots.push({ x: side > 0 ? r.range(110, 200) : r.range(1000, 1110), lean: 0, tall: 0.85 });
  const palms = spots.map((s, i) => {
    const h = r.range(135, 225) * s.tall;
    return {
      id: i, x: s.x, y: HZ + r.range(8, 20), h, lean: s.lean + r.range(-0.1, 0.1),
      bend: r.range(-0.07, 0.07), n: r.int(11, 14), frond: Math.max(38, h * r.range(0.28, 0.33)), w: r.range(4.2, 6), seed: r() * 100,
    };
  });
  palms.forEach(p => { p.crown = [p.x + p.lean * p.h + p.bend * p.h, p.y - p.h]; });
  // stars in the upper sky; the brightest few come out first
  const stars = poissonDisc(W, HZ - 70, 34, `stars:${seed}`).map(([sx, sy]) => {
    const bright = Math.pow(r(), 5);
    return { x: sx, y: sy, b: bright, th: r.range(0.02, 0.2) - bright * 0.12, tw: r.range(0.6, 2.2), ph: r() * TAU };
  });
  const planet = { x: side > 0 ? r.range(160, 340) : r.range(860, 1040), y: HZ - r.range(110, 170) };
  return { palms, stars, planet, sunX: side > 0 ? r.range(760, 900) : r.range(300, 440) };
}

const memo = new Map();
/** buildScene, memoised: the same seed always returns the same object. */
export function scene(seed = 1) {
  if (!memo.has(seed)) {
    if (memo.size > 8) memo.delete(memo.keys().next().value);
    memo.set(seed, buildScene(seed));
  }
  return memo.get(seed);
}

// ── The flock ─────────────────────────────────────────────────────────────

const PERCEIVE = 24, SEP = 7, MIN_V = 78, MAX_V = 150;

/** A hawk in its own frame (facing +x): capsules [ax, ay, bx, by, radius]. */
export const HAWK = [
  [-20, 0, 22, 0, 8],        // body
  [4, 0, -12, -58, 7], [4, 0, -12, 58, 7],     // inner wings, swept back
  [-12, -58, -30, -80, 4], [-12, 58, -30, 80, 4], // primaries
  [-20, 0, -44, 0, 11],      // fanned tail
];
/** Signed distance from (x, y) to the hawk at (hx, hy) heading ang, and the
 *  direction away from its nearest part (unit vector). */
export function hawkField(x, y, hx, hy, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const lx = (x - hx) * c + (y - hy) * s, ly = -(x - hx) * s + (y - hy) * c;
  let best = Infinity, nx = 0, ny = 0;
  for (const [ax, ay, bx, by, rad] of HAWK) {
    const dx = bx - ax, dy = by - ay, u = clamp(((lx - ax) * dx + (ly - ay) * dy) / (dx * dx + dy * dy));
    const qx = lx - (ax + dx * u), qy = ly - (ay + dy * u), d = Math.hypot(qx, qy);
    if (d - rad < best) { best = d - rad; nx = qx / (d || 1); ny = qy / (d || 1); }
  }
  return { d: best, ux: nx * c - ny * s, uy: nx * s + ny * c };
}

export function createFlock(seed, n, sc = scene(seed)) {
  const r = rng(`flock:${seed}`);
  const F = {
    n, x: new Float32Array(n), y: new Float32Array(n), vx: new Float32Array(n), vy: new Float32Array(n),
    head: new Float32Array(n), roll: new Float32Array(n), alarm: new Float32Array(n), size: new Float32Array(n),
    lag: new Float32Array(n), flap: new Float32Array(n), state: new Uint8Array(n), rx: new Float32Array(n), ry: new Float32Array(n),
    go: new Float32Array(n), wake: new Float32Array(n),
    noise: makeNoise(seed * 7 + 3), path: rng(`path:${seed}`)(),
    cell: 0, cols: 0, rows: 0, heads: null, next: new Int32Array(n), nextAlarm: 0,
  };
  const crowns = sc.palms.map(p => ({ c: p.crown, w: p.h }));
  const totalW = crowns.reduce((s, c) => s + c.w, 0);
  for (let i = 0; i < n; i++) {
    F.size[i] = r.range(0.6, 1);
    F.lag[i] = Math.pow(r(), 1.2) * 5.5;
    F.flap[i] = r() * TAU;
    // the front of the ribbon peels off first, so the flock pours in as a stream
    F.go[i] = T.roost + 2 + (F.lag[i] / 5.5) * 9 + r() * 1.5;
    F.wake[i] = T.leave + Math.pow(r(), 1.5) * 4;
    let pick = r() * totalW, k = 0;
    while (k < crowns.length - 1 && pick > crowns[k].w) { pick -= crowns[k].w; k++; }
    const [cx, cy] = crowns[k].c, a = r() * TAU, d = Math.sqrt(r()) * 20;
    F.rx[i] = cx + Math.cos(a) * d * 1.4; F.ry[i] = cy + Math.sin(a) * d * 0.6 + 6;
  }
  let sx = 0, sy = 0;
  for (const c of crowns) { sx += c.c[0] * c.w; sy += c.c[1] * c.w; }
  F.roost = [sx / totalW, sy / totalW];
  resetFlock(F, seed);
  return F;
}

/** Birds start off to the right, arriving in a loose stream. */
export function resetFlock(F, seed) {
  const r = rng(`arrive:${seed}`);
  for (let i = 0; i < F.n; i++) {
    const back = Math.pow(r(), 1.3);
    F.x[i] = W + 10 + back * 420 + r.range(-20, 20);
    F.y[i] = lerp(150, 330, r()) + back * 90 - 40 + r.gauss() * 18;
    const sp = r.range(100, 130), a = Math.PI + r.range(-0.18, 0.1);
    F.vx[i] = Math.cos(a) * sp; F.vy[i] = Math.sin(a) * sp;
    F.head[i] = a; F.roll[i] = 0; F.alarm[i] = 0; F.state[i] = 0;
  }
  F.nextAlarm = 9;
}

/** The murmuration's wandering centre: a slow Lissajous with noise folded in. */
export function flockPath(F, t) {
  const p = F.path * 40;
  const x = W * 0.5 + 300 * Math.sin(t * 0.27 + p) + 120 * F.noise(t * 0.08, p, 0.5);
  const y = 250 + 105 * Math.sin(t * 0.41 + p * 1.7) + 50 * F.noise(t * 0.09, p + 9, 1.5);
  // towards roosting time the whole show drifts over the palms and lower
  const k = ease.inOutSine(phase(t, T.roost - 12, T.roost + 2));
  if (!k) return [x, y];
  const [rx, ry] = F.roost;
  return [lerp(x, rx + 170 * Math.sin(t * 0.5 + p), k), lerp(y, ry - 150 + 50 * Math.sin(t * 0.8 + p), k)];
}

/** Push out of any calm rect (grown by `pad`) toward its nearest edge: [ax, ay], or null when clear. */
export function calmPush(x, y, calm, pad = 28) {
  for (const r of calm) {
    const x0 = r.x - pad, x1 = r.x + r.w + pad, y0 = r.y - pad, y1 = r.y + r.h + pad;
    if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue;
    const dl = x - x0, dr = x1 - x, du = y - y0, dd = y1 - y, m = Math.min(dl, dr, du, dd);
    const k = 900 + 30 * m;
    return m === dl ? [-k, 0] : m === dr ? [k, 0] : m === du ? [0, -k] : [0, k];
  }
  return null;
}

/**
 * One step of the flock. env: { t (cycle time), hawk: {x, y, ang} | null,
 * calm: rects the flock steers round, active: how many birds fly (the
 * governor's share) }. States: 0 flying, 1 roosting (in the palms), 2 flown away.
 * Mutates F and nothing else; the same F, dt and env always give the same result.
 */
export function stepFlock(F, dt, env) {
  const { t, hawk = null, calm = [] } = env, n = Math.min(F.n, env.active ?? F.n);
  if (!F.heads) {
    F.cell = PERCEIVE; F.cols = Math.ceil((W + 600) / F.cell); F.rows = Math.ceil((H + 400) / F.cell);
    F.heads = new Int32Array(F.cols * F.rows);
  }
  const { cell, cols, rows, heads, next } = F;
  heads.fill(-1);
  const cx = x => clamp(Math.floor((x + 300) / cell), 0, cols - 1), cy = y => clamp(Math.floor((y + 200) / cell), 0, rows - 1);
  for (let i = 0; i < n; i++) {
    if (F.state[i]) continue;
    const k = cy(F.y[i]) * cols + cx(F.x[i]);
    next[i] = heads[k]; heads[k] = i;
  }

  // now and then a bird near the edge startles on its own, and the wave spreads
  if (t > F.nextAlarm && t < T.roost) {
    F.nextAlarm = t + 7 + 6 * (0.5 + 0.5 * F.noise(t, 3.3, 7.7));
    const i = Math.floor((0.5 + 0.5 * F.noise(t * 3.1, 1.1, 2.2)) * n) % n;
    if (!F.state[i]) F.alarm[i] = 1;
  }

  const roosting = t >= T.roost && t < T.dawn, leaving = t >= T.leave;
  const nz = F.noise;
  for (let i = 0; i < n; i++) {
    const st = F.state[i];
    if (st === 2) continue;
    if (st === 1) {
      if (leaving && t >= F.wake[i]) { // dawn: out of the palms and away
        F.state[i] = 0; F.x[i] = F.rx[i]; F.y[i] = F.ry[i];
        const a = -Math.PI / 2 - 0.9 + (i % 7) * 0.05;
        F.vx[i] = Math.cos(a) * 110; F.vy[i] = Math.sin(a) * 110;
      }
      continue;
    }
    const x = F.x[i], y = F.y[i], vx = F.vx[i], vy = F.vy[i];
    let ax = 0, ay = 0, sx = 0, sy = 0, avx = 0, avy = 0, px = 0, py = 0, cnt = 0, maxAlarm = 0;
    const gx = cx(x), gy = cy(y);
    for (let yy = Math.max(0, gy - 1); yy <= Math.min(rows - 1, gy + 1); yy++) {
      for (let xx = Math.max(0, gx - 1); xx <= Math.min(cols - 1, gx + 1); xx++) {
        for (let j = heads[yy * cols + xx]; j >= 0; j = next[j]) {
          if (j === i) continue;
          const dx = F.x[j] - x, dy = F.y[j] - y, d2 = dx * dx + dy * dy;
          if (d2 > PERCEIVE * PERCEIVE) continue;
          const d = Math.sqrt(d2) || 0.01;
          if (d < SEP) { const f = (1 - d / SEP); sx -= (dx / d) * f; sy -= (dy / d) * f; }
          if (cnt < 16) { avx += F.vx[j]; avy += F.vy[j]; px += dx; py += dy; cnt++; }
          if (F.alarm[j] > maxAlarm) maxAlarm = F.alarm[j];
        }
      }
    }
    const homing = roosting && t >= F.go[i] ? 1 : 0, leave = leaving ? 1 : 0;
    const social = homing ? 0.35 : 1;
    if (cnt) {
      ax += (avx / cnt - vx) * 1.9 * social; ay += (avy / cnt - vy) * 1.9 * social;
      ax += (px / cnt) * 0.7 * social; ay += (py / cnt) * 0.7 * social;
    }
    ax += sx * 520; ay += sy * 520;

    if (homing) {
      // pour down to its own spot in the palms, slowing as it arrives
      const dx = F.rx[i] - x, dy = F.ry[i] - y, d = Math.hypot(dx, dy) || 1;
      const want = Math.min(MAX_V * 1.1, d * 2.2 + 30);
      ax += ((dx / d) * want - vx) * 3.2; ay += ((dy / d) * want - vy) * 3.2;
      if (d < 9) { F.state[i] = 1; continue; }
    } else if (leave) {
      ax += -90; ay += -55;
    } else {
      const [tx, ty] = flockPath(F, t - F.lag[i]);
      const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1, pull = 70 + Math.min(1, d / 220) * 140;
      ax += (dx / d) * pull; ay += (dy / d) * pull;
      // keep off the fields and inside the frame
      if (y > HZ - 110) ay -= (y - (HZ - 110)) * 4;
      if (y < 40) ay += (40 - y) * 4;
    }
    // the page's words: the flock goes round them (homing birds keep their line to the palms)
    if (calm.length && !homing) {
      const push = calmPush(x, y, calm);
      if (push) { ax += push[0]; ay += push[1]; }
    }
    // no bird is perfectly obedient
    const wa = nz(x * 0.006, y * 0.006, t * 0.35 + i * 0.013) * 2.2;
    ax += Math.cos(wa) * 36; ay += Math.sin(wa) * 36;

    // the hawk
    if (hawk && !homing) {
      const f = hawkField(x, y, hawk.x, hawk.y, hawk.ang);
      if (f.d < 60) {
        const k = Math.pow(1 - f.d / 60, 2);
        ax += f.ux * 1500 * k; ay += f.uy * 1500 * k;
        if (f.d < 34) F.alarm[i] = 1;
      }
    }
    // alarm travels from bird to bird, a little weaker each hop
    const target = maxAlarm * 0.9;
    F.alarm[i] = target > F.alarm[i] ? F.alarm[i] + (target - F.alarm[i]) * Math.min(1, dt * 7) : F.alarm[i] * Math.exp(-dt * 1.7);
    const al = F.alarm[i];
    if (al > 0.05) { // dodge sideways, all the same way, which reads as a ripple
      ax += -vy * al * 1.6; ay += vx * al * 1.6;
    }

    let nvx = vx + ax * dt, nvy = vy + ay * dt;
    const sp = Math.hypot(nvx, nvy) || 1, lo = homing ? 20 : MIN_V, hi = MAX_V * (1 + al * 0.35);
    const cs = clamp(sp, lo, hi);
    nvx = (nvx / sp) * cs; nvy = (nvy / sp) * cs;
    F.vx[i] = nvx; F.vy[i] = nvy;
    F.x[i] = x + nvx * dt; F.y[i] = y + nvy * dt;
    const h = Math.atan2(nvy, nvx);
    let dh = h - F.head[i]; dh -= Math.round(dh / TAU) * TAU;
    F.head[i] = h;
    F.roll[i] += (clamp(dh / Math.max(dt, 1e-3) * 0.4, -1.4, 1.4) - F.roll[i]) * Math.min(1, dt * 5);
    F.flap[i] += dt * (9 + al * 8);
    if (leave && (F.x[i] < -60 || F.y[i] < -60)) F.state[i] = 2;
  }
}

/** Startle every flying bird within `r` of (x, y): the dark wave, on purpose (Enter in playful). */
export function startle(F, x, y, r = 60) {
  let k = 0;
  for (let i = 0; i < F.n; i++) if (!F.state[i] && Math.hypot(F.x[i] - x, F.y[i] - y) < r) { F.alarm[i] = 1; k++; }
  return k;
}

/** Step a flock from `from` to `to` (cycle seconds) in fixed steps. Pure apart from F. */
export function simulate(F, from, to, env = {}, step = 1 / 60) {
  let t = from;
  while (t + step <= to + 1e-9) { t += step; stepFlock(F, step, { ...env, t }); }
  return t;
}

/**
 * The per-frame description: which evening, where in it we are, how dark it
 * is. The flock itself is stepped by the renderer (it answers the hawk), from
 * the functions above.
 */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  // pace bends the clock around the still, so every register's still is the plate's own moment
  const clock = STILL_TIME + (time - STILL_TIME) * (look.pace || 1);
  const cycle = Math.floor(clock / CYCLE), local = clock - cycle * CYCLE;
  return { seed, time, register, look, cycle, local, dark: darkness(local), S: scene(seed) };
}
