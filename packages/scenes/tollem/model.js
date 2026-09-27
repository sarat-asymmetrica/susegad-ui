// Tollem's pure core, the pool at noon as plain data; runs in Node. Flowers step in
// fixed 1/60 s steps from zero (memoised), and the part of a step past the last
// boundary is extrapolated, never stored: the same seed and touches, the same pool.

import { rng, N, clamp, lerp, ease, TAU, hexToRgb } from '../../engine/index.js';

export const W = 1200, H = 800, TILE = 56, COPING = 66, RING_C = 150;
export const MAX_TOUCH = 10, MAX_FLOWERS = 4, MAX_CALM = 4;
/** The first flower leaves the tree at FALL[0] and lands at FALL[1]. */
export const FALL = [0.4, 3.4];
/** The reduced-motion frame: the first flower down, its ring a second old. */
export const STILL_TIME = FALL[1] + 1;
const STEP = 1 / 60, RING_LIFE = 7;

export const PALETTES = {
  aqua: { tile: '#a3dcd4', tile2: '#8ed2cc', grout: '#eef4ee', ink: '#2c5a61', deep: '#c9e3e6', petal: '#fbf7ec', mid: '#fbf1d6', heart: '#f1bd35', flink: '#6b5a3e' },
  sky: { tile: '#9fd6e0', tile2: '#87c8d8', grout: '#eef3f0', ink: '#294f66', deep: '#c4dcea', petal: '#f7e1e3', mid: '#f4c9cf', heart: '#f2b73a', flink: '#7a4652' },
  celadon: { tile: '#addfcd', tile2: '#98d4bf', grout: '#f0f3ea', ink: '#2e5a4f', deep: '#cbe4de', petal: '#fdf8ee', mid: '#fcefd0', heart: '#eaa531', flink: '#6b5a3e' },
};
export const PALETTE_NAMES = Object.keys(PALETTES);

/** What each register asks of the water. `every`: seconds between flowers;
 *  `linger`: how long one floats before the current takes it. */
export const REGISTERS = {
  quiet: { swell: 0.35, caustic: 0.6, rate: 0.55, drops: false, linger: Infinity, ring: 0 },
  warm: { swell: 1, caustic: 1, rate: 0.75, drops: true, every: [15, 24], linger: 44, ring: 0.85 },
  playful: { swell: 1.15, caustic: 1.08, rate: 1, drops: true, every: [7, 11], linger: 28, ring: 1 },
};

/** A named palette, or the seed's choice. */
export const paletteFor = (seed, name) => (PALETTES[name] ? name : PALETTE_NAMES[Math.floor(rng(`tollem:${seed}`)() * 3)]);

/** Five petals, each an asymmetric obovate lobe, turned into a pinwheel. */
export function flowerShape(seed) {
  const r = rng(`champa:${seed}`);
  const L = r.range(58, 64), Wd = r.range(36, 40), twist = r.range(0.32, 0.42), petals = [];
  for (let i = 0; i < 5; i++) {
    const len = L * r.range(0.94, 1.05), wid = Wd * r.range(0.92, 1.06), bend = r.range(0.06, 0.12), a0 = (i / 5) * TAU + twist;
    const left = [], right = [];
    for (let k = 0; k <= 22; k++) {
      const u = k / 22;
      let w = Math.pow(Math.sin((Math.PI / 2) * Math.min(1, u / 0.66)), 0.85);
      if (u > 0.66) w *= Math.sqrt(Math.max(0, 1 - ((u - 0.66) / 0.34) ** 2));
      w = Math.max(w, 0.12 * (1 - u)) * wid * 0.5;
      left.push([u * len, bend * len * u * u - w * 1.25]); right.push([u * len, bend * len * u * u + w * 0.75]);
    }
    const c = Math.cos(a0), s = Math.sin(a0), turn = ([x, y]) => [(x + 3) * c - y * s, (x + 3) * s + y * c];
    petals.push({ pts: [...left, ...right.reverse()].map(turn), vein: [0.12, 0.35, 0.6].map(u => turn([u * len, bend * len * u * u])), a0, len });
  }
  return { petals, L, twist };
}

/** Where the progress flower sits for p in [0, 1]: a slow arc across the pool. */
export function progressPose(p, seed = 1) {
  const u = clamp(p);
  return { x: lerp(150, W - 150, u), y: 520 - Math.sin(u * Math.PI) * 110 + (u - 0.5) * 40, rot: rng(`tollem-progress:${seed}`)() * TAU + u * 2.2 };
}

/** One ring's height at (x, y) and time t: the damped travelling packet the
 *  shader adds to the surface. `env` is how strong the ring is there at all. */
export function ringImpulse(ring, x, y, t) {
  const age = t - ring.t;
  if (age < 0 || age > RING_LIFE || !(ring.amp > 0)) return { height: 0, env: 0 };
  const r = Math.hypot(x - ring.x, y - ring.y) + 0.001, u = r - RING_C * age, sig = 26 + 30 * age;
  const env = ring.amp * 2.8 * Math.exp(-age * 0.62 - (u * u) / (sig * sig)) / Math.sqrt(1 + r / 50);
  return { height: env * Math.sin((TAU / (46 + 16 * age)) * u), env };
}

/** Distance from a point to a rect's edge; negative inside. */
export function rectDistance(x, y, c) {
  const dx = Math.max(c.x - x, 0, x - c.x - c.w), dy = Math.max(c.y - y, 0, y - c.y - c.h);
  return dx > 0 || dy > 0 ? Math.hypot(dx, dy) : -Math.min(x - c.x, c.x + c.w - x, y - c.y, c.y + c.h - y);
}

const cleanCalm = calm => (Array.isArray(calm) ? calm : [])
  .filter(c => c && [c.x, c.y, c.w, c.h].every(Number.isFinite) && c.w > 0 && c.h > 0).slice(0, MAX_CALM);

/** A pool stepped forward in fixed steps. model() is the way in; this is for tests. */
export function createPool(seed, opts = {}) {
  const reg = REGISTERS[opts.register] || REGISTERS.warm, calm = cleanCalm(opts.calm);
  const r = rng(`tollem-drops:${seed}`), flowers = [], rings = [], pushes = [];
  let k = 0, lastTouchT = -Infinity, dropIndex = 0, nextDrop = opts.drops ?? reg.drops ? FALL[0] : Infinity;

  function addRing(x, y, t, amp) {
    rings.push({ x, y, t, amp });
    while (rings.length > MAX_TOUCH || t - rings[0].t > RING_LIFE) rings.shift();
    // each floating flower gets a push when the ring reaches it
    for (const f of flowers) {
      const d = Math.hypot(f.x - x, f.y - y);
      if (f.landed && d > 2) pushes.push({ f, at: t + d / RING_C, dx: (f.x - x) / d, dy: (f.y - y) / d, k: (amp * 46) / (1 + d / 170) });
    }
  }

  function drop(t) {
    const i = dropIndex++;
    // the best of several tries: furthest from text, clear of other flowers. With text
    // on the water, try the whole open pool, so no flower lands under the words.
    let land, best = -1e9;
    for (let n = 0; n < (calm.length ? 30 : 10); n++) {
      const c = calm.length ? [r.range(140, W - 140), r.range(COPING + 120, H - 110)] : i ? [r.range(360, 900), r.range(280, 600)] : [r.range(470, 720), r.range(360, 520)];
      // keeping off the text matters most; keeping apart from other flowers next
      const score = 4 * Math.min(90, ...calm.map(z => rectDistance(c[0], c[1], z))) + 100 * flowers.every(f => Math.hypot(f.x - c[0], f.y - c[1]) > 150);
      if (score > best) best = score, land = c;
    }
    // it leaves the tree just past the top-right edge, whole, so it never appears in mid-air
    const from = [W + r.range(125, 175), r.range(-90, 30)];
    flowers.push({ id: i, t0: t, from, land, spin: r.sign() * r.range(1.2, 2.2), rot0: r() * TAU, current: r() * 100, x: from[0], y: from[1], rot: 0, h: 1, vx: 0, vy: 0, w: 0, landed: false, landT: 0, bob: 0, leaving: false });
  }

  // falling is closed-form: drifting down and across from the tree, swaying and spinning
  function fallPose(f, t) {
    const u = clamp((t - f.t0) / (FALL[1] - FALL[0])), e = ease.inQuad(u);
    return { u, x: lerp(f.from[0], f.land[0], u) + Math.sin(u * 6.5) * 34 * (1 - u), y: lerp(f.from[1], f.land[1], e), h: 1 - e, rot: f.rot0 + f.spin * u * 1.7 };
  }

  function stepFlower(f, t, dt) {
    if (!f.landed) {
      const p = fallPose(f, t);
      Object.assign(f, { x: p.x, y: p.y, h: p.h, rot: p.rot });
      if (p.u >= 1) {
        Object.assign(f, { landed: true, landT: t, h: 0, bob: 1, vx: (f.land[0] - f.from[0]) * 0.02, vy: 10, w: f.spin * 0.05 });
        if (reg.ring) addRing(f.x, f.y, t, reg.ring);
      }
      return;
    }
    // a slow noise current, steered softly off the edges; when it is time, out of view by the nearest open edge
    let tx = N(t * 0.035, f.current, 1.3) * 14, ty = N(t * 0.035, f.current + 9, 4.1) * 11;
    if (!f.leaving) {
      tx += (f.x < 160 ? 12 : f.x > W - 160 ? -12 : 0);
      ty += (f.y < COPING + 120 ? 12 : f.y > H - 110 ? -12 : 0);
    } else {
      const m = Math.min(f.x, W - f.x, H - f.y);
      if (m === f.x) tx -= 34; else if (m === W - f.x) tx += 34; else ty += 34;
    }
    // and away from calm zones, so flowers do not sit under text
    for (const c of calm) {
      if (rectDistance(f.x, f.y, c) >= 70) continue;
      const dx = f.x - c.x - c.w / 2, dy = f.y - c.y - c.h / 2, l = Math.hypot(dx, dy) || 1;
      tx += (dx / l) * 16; ty += (dy / l) * 16;
    }
    for (let i = pushes.length - 1; i >= 0; i--) {
      const p = pushes[i];
      if (p.f !== f || t < p.at) continue;
      f.vx += p.dx * p.k; f.vy += p.dy * p.k;
      f.w += Math.sin(p.at * 91.7 + p.k) * p.k * 0.005;
      f.bob = Math.min(1.4, f.bob + p.k / 40);
      pushes.splice(i, 1);
    }
    const damp = Math.exp(-dt * 0.9);
    f.vx = f.vx * damp + tx * (1 - damp);
    f.vy = f.vy * damp + ty * (1 - damp);
    f.x += f.vx * dt; f.y += f.vy * dt;
    if (!f.leaving) f.x = clamp(f.x, 70, W - 70);
    f.y = f.leaving ? Math.max(f.y, COPING + 60) : clamp(f.y, COPING + 60, H - 60);
    f.w *= Math.exp(-dt * 0.5);
    f.rot += (f.w + 0.012) * dt;
    f.bob *= Math.exp(-dt * 2.2);
  }

  /** Advance to step n (time n / 60), feeding touches in as their moment comes. */
  function advance(n, touches) {
    while (k < n) {
      const t = ++k * STEP;
      for (const tc of touches) if (tc.t > lastTouchT && tc.t <= t) { addRing(tc.x, tc.y, tc.t, tc.amp); lastTouchT = tc.t; }
      if (t >= nextDrop) {
        if (flowers.length < MAX_FLOWERS) drop(nextDrop);
        nextDrop += r.range(...reg.every);
      }
      for (const f of flowers) stepFlower(f, t, STEP);
      // two settled at most: the oldest of any more, or any that has lingered, goes with the current
      const settled = flowers.filter(f => f.landed && !f.leaving);
      for (const f of settled) if (t - f.landT > reg.linger) f.leaving = true;
      if (settled.length > 2) settled[0].leaving = true;
      for (let i = flowers.length - 1; i >= 0; i--) {
        const f = flowers[i];
        if (f.leaving && (f.x < -110 || f.x > W + 110 || f.y > H + 110)) { flowers.splice(i, 1); for (let j = pushes.length - 1; j >= 0; j--) if (pushes[j].f === f) pushes.splice(j, 1); }
      }
    }
  }

  /** The flowers at exact time t, extrapolated past the last step. */
  const snapshot = t => flowers.map(f => {
    if (!f.landed) { const p = fallPose(f, t); return { id: f.id, x: p.x, y: p.y, rot: p.rot, h: p.h, bob: 0, alpha: 1 }; }
    const dt = t - k * STEP;
    return { id: f.id, x: f.x + f.vx * dt, y: f.y + f.vy * dt, rot: f.rot + (f.w + 0.012) * dt, h: 0, bob: f.bob, alpha: 1 };
  });

  return { get step() { return k; }, get lastTouchT() { return lastTouchT; }, advance, snapshot, rings, flowers };
}

// A few pools stay warm: the element's plain call and the renderer's call with touches and calm zones.
const memo = new Map();
function poolAt(key, seed, opts, time, touches) {
  let pool = memo.get(key);
  const n = Math.floor(time / STEP + 1e-6);
  if (!pool || n < pool.step || touches.some(tc => tc.t > pool.lastTouchT && tc.t <= pool.step * STEP)) pool = createPool(seed, opts);
  memo.delete(key); memo.set(key, pool);
  if (memo.size > 6) memo.delete(memo.keys().next().value);
  pool.advance(n, touches);
  return pool;
}
export const clearMemo = () => memo.clear();

const rgb01 = hex => hexToRgb(hex).map(v => v / 255);
const flat = (list, n, fill, fn) => Array.from({ length: n }, (_, i) => (list[i] ? fn(list[i]) : fill)).flat();

/** @param {{ time: number, seed?: number|string, register?: string, params?: object, touches?: object[], calm?: object[] }} input */
export function model(input) {
  const time = Math.max(0, Number(input.time) || 0), seed = input.seed ?? 1, params = input.params || {};
  const register = REGISTERS[input.register] ? input.register : 'warm', reg = REGISTERS[register];
  const swell = clamp(params.swell ?? 0.5);
  const progress = params.progress == null || !Number.isFinite(+params.progress) ? null : clamp(+params.progress);
  const drops = params.flowers !== false && reg.drops && progress == null;
  const calm = cleanCalm(input.calm);
  const touches = (input.touches || []).filter(tc => tc && tc.t <= time).sort((a, b) => a.t - b.t);
  const palette = paletteFor(seed, params.palette), pal = PALETTES[palette];

  let flowers, rings;
  if (progress != null) {
    // state, not theatre: the flower sits where the work has got to, and time never moves it
    flowers = [{ id: 'progress', ...progressPose(progress, seed), h: 0, bob: 0, alpha: 1 }];
    rings = touches;
  } else {
    const key = `${seed}|${register}|${drops}|${touches.length ? 't' : ''}|${calm.map(c => [c.x, c.y, c.w, c.h].map(Math.round)).join(';')}`;
    const pool = poolAt(key, seed, { register, drops, calm }, time, touches);
    flowers = pool.snapshot(time);
    // rings the pool has taken in, plus touches newer than its last step
    rings = [...pool.rings, ...touches.filter(tc => tc.t > pool.lastTouchT)];
  }
  rings = rings.filter(rg => time - rg.t <= RING_LIFE).slice(-MAX_TOUCH).map(({ x, y, t, amp }) => ({ x, y, t, amp }));
  const sr = rng(`tollem-u:${seed}`);

  return {
    W, H, time, seed, register, progress, palette, swell, flowers, rings,
    params: JSON.parse(JSON.stringify(params)), colors: { ...pal }, calm: calm.map(c => ({ ...c })),
    uniforms: {
      uT: time,
      uWaveT: time * (0.7 + 0.3 * reg.rate),
      uCausticT: time * 0.34 * reg.rate + 23 + sr() * 50,
      uSwell: 2 * swell * reg.swell,
      uCaustic: reg.caustic,
      uSeed: sr() * 97,
      uTouch: flat(rings, MAX_TOUCH, [0, 0, 0, 0], rg => [rg.x, rg.y, rg.t, rg.amp]),
      uFlower: flat(flowers, MAX_FLOWERS, [0, 0, 0, -1], f => [f.x, f.y, f.rot, f.alpha > 0 ? f.h : -1]),
      uCalm: flat(calm, MAX_CALM, [0, 0, 0, 0], c => [c.x, c.y, c.w, c.h]),
      uTile: rgb01(pal.tile), uTile2: rgb01(pal.tile2), uGrout: rgb01(pal.grout), uInk: rgb01(pal.ink), uDeep: rgb01(pal.deep),
    },
  };
}
