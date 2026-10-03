// Themb: rain on a taro leaf. The pure half.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/themb.js (read only;
// never edited). The plate already kept a pure core, and it comes across
// nearly line for line: the leaf's outline and surface (leafR, leafSd,
// leafHeight) and createLeaf(seed), the bead physics (rolling, pinning,
// merging that keeps the total area, showers, the dip that pours the cup off
// the tip). The port adds the registers' pace and rain, the calm zone (drops
// never land under the page's words and beads are pushed out from under
// them), a pour and a dropped bead as inputs, and leafAt(): the water at any
// moment, stepped from zero at fixed 1/120 s and memoised, so a playing scene
// only pays for new steps and the same seed and inputs always give the same
// water. No DOM in any of it.

import { rng, N, clamp, ease, TAU } from '../../engine/index.js';

export const W = 1200, H = 800, MAXB = 32;
// The leaf: where the stalk joins, the direction of the tip, its length.
export const LC = [560, 380], TIPA = 0.42, LL = 470;
// The surface: a cup round the join, a droop toward the tip.
export const CUP = 34, SIG = 150, TIPD = 70, G = 520;
/** The plate's still: just after a shower, the water gathering in the cup. */
export const STILL_TIME = 15;
export const STEP = 1 / 120;

/**
 * How each register lives in the rain: `pace` is how fast the leaf's clock
 * runs, `rain` scales the showers, `touch` lets a hand tilt the leaf. Quiet is
 * the still.
 */
export const LOOKS = {
  quiet: { pace: 0, rain: 1, touch: false },
  warm: { pace: 0.7, rain: 0.75, touch: false },
  playful: { pace: 1, rain: 1, touch: true },
};

// ── The leaf (the plate's own) ──────────────────────────────────────────────

const wrap = a => { a = (a + Math.PI) % TAU; if (a < 0) a += TAU; return a - Math.PI; };

/** Radius of the leaf's edge at angle a (radians from the tip direction). */
export function leafR(a) {
  const b = Math.abs(a), c = Math.cos(a / 2);
  const notch = 1 - 0.8 * Math.exp(-Math.pow((Math.PI - b) / 0.2, 2));
  return LL * (0.58 + 0.18 * c * c * c * c + 0.26 * Math.exp(-b / 0.2)) * notch * (1 + 0.012 * Math.sin(a * 9 + 1.3));
}
/** Roughly the distance outside the leaf (negative inside). */
export function leafSd(x, y) {
  const qx = x - LC[0], qy = y - LC[1];
  return (Math.hypot(qx, qy) - leafR(wrap(Math.atan2(qy, qx) - TIPA))) * 0.9;
}
/** Height of the leaf's surface; tilt is the downhill direction times its slope. */
export function leafHeight(x, y, tilt) {
  const qx = x - LC[0], qy = y - LC[1], d2 = qx * qx + qy * qy, d = Math.sqrt(d2);
  const a = wrap(Math.atan2(qy, qx) - TIPA), rho = d / leafR(a);
  const toward = Math.max(0, Math.cos(a));
  const s = clamp((rho - 0.35) / 0.65);
  return -CUP * Math.exp(-d2 / (2 * SIG * SIG)) - TIPD * toward * toward * toward * s * s - (tilt[0] * qx + tilt[1] * qy);
}

/** How far a point is inside a calm rect grown by `pad` (positive inside), and the way out. */
function calmPush(x, y, calm, pad) {
  let best = null;
  for (const r of calm) {
    const x0 = r.x - pad, y0 = r.y - pad, x1 = r.x + r.w + pad, y1 = r.y + r.h + pad;
    if (x <= x0 || x >= x1 || y <= y0 || y >= y1) continue;
    const outs = [[x - x0, -1, 0], [x1 - x, 1, 0], [y - y0, 0, -1], [y1 - y, 0, 1]].sort((a, b) => a[0] - b[0]);
    if (!best || outs[0][0] > best[0]) best = outs[0];
  }
  return best;
}
export const inCalm = (x, y, calm = [], pad = 0) => !!calmPush(x, y, calm, pad);

/** Total water on the leaf: the sum of squared radii of the beads still on it. */
export const areaOf = beads => beads.filter(b => b.fall < 0).reduce((s, b) => s + b.r * b.r, 0);

/**
 * The water on the leaf. step(dt, input) moves it on; input is a tilt the
 * viewer asks for, or null. Beads: { x, y, r, vx, vy, wob, wph, wax, fall }.
 * `look.rain` scales the showers; `st.calm` (rects in the scene's units) keeps
 * new drops away from the page's words and pushes beads out from under them.
 */
export function createLeaf(seed = 1, look = LOOKS.playful) {
  const r = rng(`themb:${seed}`);
  const beads = [], splashes = [], incoming = [];
  const st = { t: 0, phase: 'shower', since: 0, dip: 0, tilt: [0, 0], rain: 0, beads, splashes, incoming, calm: [], merged: 0 };
  const wind = r.range(-0.35, -0.15);
  const TIPV = [Math.cos(TIPA), Math.sin(TIPA)];

  const grad = (x, y) => {
    const e = 1.5;
    return [(leafHeight(x + e, y, st.tilt) - leafHeight(x - e, y, st.tilt)) / (2 * e), (leafHeight(x, y + e, st.tilt) - leafHeight(x, y - e, st.tilt)) / (2 * e)];
  };

  function spot() {
    for (let k = 0; k < 30; k++) {
      const a = r.range(-Math.PI, Math.PI), rho = Math.sqrt(r()) * 0.9;
      const d = rho * leafR(a);
      const x = LC[0] + Math.cos(a + TIPA) * d, y = LC[1] + Math.sin(a + TIPA) * d;
      if (x > 20 && x < W - 20 && y > 20 && y < H - 20 && !inCalm(x, y, st.calm, 30)) return [x, y];
    }
    return null;
  }

  function drop(big = 1) {
    const at = spot(), rad = (4 + Math.pow(r(), 2) * 10) * big;
    if (at) incoming.push({ x: at[0], y: at[1], r: rad, at: st.t + 0.14, t0: st.t, wind });
  }

  function land(d) {
    splashes.push({ x: d.x, y: d.y, t: st.t, r: d.r, seed: r() * 1000 });
    if (splashes.length > 24) splashes.shift();
    const live = beads.filter(b => b.fall < 0);
    if (live.length >= MAXB - 2) {
      // the leaf is crowded: the drop joins whichever bead is nearest
      let best = live[0], bd = Infinity;
      for (const b of live) { const dd = Math.hypot(b.x - d.x, b.y - d.y) - b.r; if (dd < bd) { bd = dd; best = b; } }
      if (best) { best.r = Math.sqrt(best.r * best.r + d.r * d.r); best.wob = Math.min(0.3, best.wob + 0.12); }
      return;
    }
    beads.push({ x: d.x, y: d.y, r: d.r, vx: 0, vy: 0, wob: 0.22, wph: r() * TAU, wax: r() * TAU, fall: -1 });
  }

  function merge(a, b) {
    const ma = a.r * a.r, mb = b.r * b.r, m = ma + mb;
    const ax = Math.atan2(b.y - a.y, b.x - a.x);
    a.x = (a.x * ma + b.x * mb) / m; a.y = (a.y * ma + b.y * mb) / m;
    a.vx = (a.vx * ma + b.vx * mb) / m; a.vy = (a.vy * ma + b.vy * mb) / m;
    a.r = Math.sqrt(m);
    a.wob = Math.min(0.34, a.wob + 0.28 * Math.min(ma, mb) / m + 0.08); a.wax = ax; a.wph = 0;
    st.merged++;
  }

  function step(dt, input = null) {
    st.t += dt; st.since += dt;
    const live = beads.filter(b => b.fall < 0);
    const area = live.reduce((s, b) => s + b.r * b.r, 0);
    const biggest = live.reduce((m, b) => Math.max(m, b.r), 0);

    // the weather and the leaf's patience
    if (st.phase === 'shower') {
      st.rain = Math.min(1, st.since / 1.2) * (1 - clamp((st.since - 8) / 3));
      if (st.since > 11) { st.phase = 'gather'; st.since = 0; }
    } else if (st.phase === 'gather') {
      st.rain = 0.04;
      if ((st.since > 7 && area > 3200) || st.since > 16) { st.phase = 'dip'; st.since = 0; }
    } else if (st.phase === 'dip') {
      st.rain = 0.04;
      if ((st.since > 3 && biggest < 16) || st.since > 10) { st.phase = 'rest'; st.since = 0; }
    } else if (st.phase === 'rest') {
      st.rain = 0;
      if (st.since > 3) { st.phase = 'shower'; st.since = 0; }
    }
    st.rain *= look.rain;
    const dipTo = st.phase === 'dip' ? 1 : 0;
    st.dip += (dipTo - st.dip) * (1 - Math.exp(-dt * (dipTo ? 0.9 : 1.6)));
    const expect = st.rain * 9 * dt;
    if (r() < expect) drop(st.phase === 'shower' ? 1 : 0.8);
    for (let i = incoming.length - 1; i >= 0; i--) if (st.t >= incoming[i].at) { land(incoming[i]); incoming.splice(i, 1); }

    // tilt: a slow sway, the dip, and whatever the viewer asks for
    const sway = [N(st.t * 0.07, seed * 3.1, 0.5) * 0.03, N(st.t * 0.07, seed * 3.1 + 7, 0.5) * 0.03];
    const dipS = ease.inOutSine(clamp(st.dip)) * 0.3;
    const target = [sway[0] + TIPV[0] * dipS + (input ? input[0] : 0), sway[1] + TIPV[1] * dipS + (input ? input[1] : 0)];
    const k = 1 - Math.exp(-dt * 2.4);
    st.tilt[0] += (target[0] - st.tilt[0]) * k; st.tilt[1] += (target[1] - st.tilt[1]) * k;

    // roll
    for (const b of beads) {
      b.wob *= Math.exp(-dt * 4.5); b.wph += dt * (34 - Math.min(20, b.r * 0.5));
      const [gx, gy] = grad(b.x, b.y);
      if (b.fall >= 0) {
        b.fall += dt / 0.55;
        b.vx -= gx * G * dt * 1.5; b.vy -= gy * G * dt * 1.5;
        b.x += b.vx * dt; b.y += b.vy * dt;
        continue;
      }
      // under the page's words: an edge of the text pushes the bead out, like a fold in the leaf
      const out = st.calm.length ? calmPush(b.x, b.y, st.calm, b.r + 6) : null;
      if (out) { b.vx += out[1] * 260 * dt; b.vy += out[2] * 260 * dt; }
      const slope = Math.hypot(gx, gy), speed = Math.hypot(b.vx, b.vy);
      if (!out && speed < 4 && slope < 0.55 / b.r) { b.vx = b.vy = 0; continue; }
      b.vx -= gx * G * dt; b.vy -= gy * G * dt;
      const damp = Math.exp(-dt * (1.2 + 6 / b.r));
      b.vx *= damp; b.vy *= damp;
      b.x += b.vx * dt; b.y += b.vy * dt;
      // over the edge: it goes
      if (leafSd(b.x, b.y) > -b.r * 0.3) {
        b.fall = 0;
        const qx = b.x - LC[0], qy = b.y - LC[1], ql = Math.hypot(qx, qy) || 1;
        b.vx += (qx / ql) * 40; b.vy += (qy / ql) * 40;
      }
    }
    // touch, pull together, merge
    for (let i = 0; i < beads.length; i++) {
      const a = beads[i];
      if (a.fall >= 0) continue;
      for (let j = i + 1; j < beads.length; j++) {
        const b = beads[j];
        if (b.fall >= 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), reach = a.r + b.r;
        if (d >= reach * 1.02) continue;
        if (d < Math.max(a.r, b.r) * 0.75 + Math.min(a.r, b.r) * 0.4) {
          const [big, small] = a.r >= b.r ? [a, b] : [b, a];
          merge(big, small);
          beads.splice(beads.indexOf(small), 1);
          if (small === a) { i--; break; }
          j--;
          continue;
        }
        // surface tension draws the neck in
        const pull = 70 * dt * (1 - d / reach + 0.3);
        const ma = a.r * a.r, mb = b.r * b.r, m = ma + mb, ux = dx / (d || 1), uy = dy / (d || 1);
        a.x += ux * pull * mb / m; a.y += uy * pull * mb / m;
        b.x -= ux * pull * ma / m; b.y -= uy * pull * ma / m;
      }
    }
    for (let i = beads.length - 1; i >= 0; i--) if (beads[i].fall >= 1) beads.splice(i, 1);
    for (let i = splashes.length - 1; i >= 0; i--) if (st.t - splashes[i].t > 0.6) splashes.splice(i, 1);
  }

  /** Enter or Space: the leaf dips now and pours the cup off its tip. */
  function pour() { if (st.phase !== 'dip') { st.phase = 'dip'; st.since = 0; } }
  /** A bead set down by hand, landing with a splash like any other drop. */
  function dropAt(x, y, rad = 9) {
    if (leafSd(x, y) > -rad) return false;
    incoming.push({ x, y, r: rad, at: st.t + 0.14, t0: st.t, wind });
    return true;
  }

  st.step = step; st.pour = pour; st.dropAt = dropAt;
  return st;
}

// ── The water at a moment, memoised ────────────────────────────────────────

/** The leaf's own clock for a register: it bends round the still, so every register's still is the plate's. */
export const leafTime = (time, register) => { const look = LOOKS[register] || LOOKS.warm; return STILL_TIME + (time - STILL_TIME) * (look.pace || 1); };

const memo = new Map();
/**
 * The leaf at scene time `time`. `inputs` is the list of what hands did, in
 * leaf time: { t, tilt: [x, y] | null } for a tilt from then on, and
 * { t, act: 'pour' } or { t, act: 'drop', x, y }. A cached run is reused when
 * it has not passed the moment and its inputs are the start of these; else
 * the leaf is stepped again from zero. Pure: same arguments, same water.
 */
export function leafAt({ seed = 1, register = 'warm', time = 0, inputs = [], calm = [] } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  const t = Math.max(0, leafTime(time, register));
  const key = `${seed}|${register}|${calm.map(r => `${r.x | 0},${r.y | 0},${r.w | 0},${r.h | 0}`).join(';')}`;
  let m = memo.get(key);
  const same = m && m.used <= inputs.length && inputs.slice(0, m.used).every((e, i) => e === m.inputs[i] || (e.t === m.inputs[i].t && e.act === m.inputs[i].act && String(e.tilt) === String(m.inputs[i].tilt)));
  if (!m || m.sim.t > t + 1e-9 || !same) {
    const sim = createLeaf(seed, look);
    sim.calm = calm.map(r => ({ ...r }));
    m = { sim, used: 0, inputs: [], tilt: null };
    if (memo.size > 6) memo.delete(memo.keys().next().value);
    memo.set(key, m);
  }
  const sim = m.sim;
  while (sim.t + STEP <= t + 1e-9) {
    while (m.used < inputs.length && inputs[m.used].t <= sim.t + 1e-9) {
      const e = inputs[m.used++];
      m.inputs.push(e);
      if (e.act === 'pour') sim.pour();
      else if (e.act === 'drop') sim.dropAt(e.x, e.y, e.r);
      else m.tilt = e.tilt;
    }
    sim.step(STEP, m.tilt);
  }
  return sim;
}
export const clearMemo = () => memo.clear();

/**
 * The per-frame description. The renderer asks leafAt() for the water, since
 * the water depends on what hands did; the model only says which register and
 * which moment.
 */
export function model({ time = 0, seed = 1, register = 'warm', params = {} } = {}) {
  const look = LOOKS[register] || LOOKS.warm;
  return { time, seed, register, look, params, leafT: leafTime(time, register) };
}
