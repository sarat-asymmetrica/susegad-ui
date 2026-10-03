// Dar: yours to keep. The pure half.
//
// A Goan house front in elevation: a lime-plastered laterite wall, a door in
// two painted leaves inside a lime-white surround, a window of oyster-shell
// panes with its shutters open, a tiled eave above. A key on a ring with a
// wooden tag swings in, catches on the brass hook beside the door, sways and
// comes to rest; then the tower bolt slides home. Pure: plain data out.

import { rng, clamp, smoothstep, TAU } from '../../engine/index.js';

export const W = 1200, H = 800;

export const EAVE = 118, PLINTH = 712, GROUND = 770;
export const DOOR = { x0: 420, x1: 640, top: 238, bottom: PLINTH, frame: 34, lintel: 44 };
export const WINDOW = { x0: 800, x1: 956, top: 300, bottom: 566, shutter: 74 };
/** The hook, on the door's right-hand surround, and how the key hangs from it. */
export const HOOK = { x: DOOR.x1 + DOOR.frame / 2 + 2, y: 410 };
export const KEY = { ring: 13, len: 78, tag: 62, scale: 1.35 };
/** The tower bolt, on the right leaf near the meeting stile, sliding left into a keeper on the left leaf. */
export const BOLT = { x: 548, y: 470, travel: 24 };

/** The key's journey in: it comes from above and to the right, arcs down and catches on the hook. */
export const ARRIVE = { start: 0.8, end: 2.3 };
/** The swing once caught: a damped pendulum. */
export const SWING = { amp: 0.62, omega: 3.1, decay: 0.75 };
/** The bolt slides home once the key has all but settled. */
export const BOLTING = { start: 6.2, end: 6.9 };
/** After this the drawing is at rest and the element stops drawing. */
export const REST = 8.2;

/** Where the key is on its way in, u from 0 to 1: a gentle arc from off the top right to the hook. */
export function arrival(u) {
  const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
  const x0 = HOOK.x + 240, y0 = -80, cx = HOOK.x + 180, cy = HOOK.y - 60;
  const x = (1 - e) * (1 - e) * x0 + 2 * (1 - e) * e * cx + e * e * HOOK.x;
  const y = (1 - e) * (1 - e) * y0 + 2 * (1 - e) * e * cy + e * e * HOOK.y;
  return { x, y, angle: 0.95 - (0.95 - SWING.amp) * e };
}

/**
 * The key's angle from hanging straight down, at time t: the arrival's
 * swing, plus any pushes a person gave it (playful), each a damped
 * oscillation from its own moment. Pure.
 */
export function swingAngle(t, pushes = [], arrivedAt = ARRIVE.end) {
  let a = 0;
  if (t >= arrivedAt) { const s = t - arrivedAt; a += SWING.amp * Math.exp(-SWING.decay * s) * Math.cos(SWING.omega * s); }
  for (const p of pushes) {
    if (t < p.t) continue;
    const s = t - p.t;
    a += (p.dir ?? 1) * 0.5 * Math.exp(-SWING.decay * s) * Math.sin(SWING.omega * s);
  }
  return a;
}

/** The bolt, 0 drawn back to 1 home, given the moments it was toggled (playful) after the scripted bolting. */
export function boltAt(t, toggles = [], scripted = true) {
  let v = scripted ? smoothstep(BOLTING.start, BOLTING.end, t) : 1;
  let home = scripted ? t >= BOLTING.end : true;
  for (const tt of toggles) {
    if (t < tt) break;
    home = !home;
    const u = smoothstep(tt, tt + 0.45, t);
    v = home ? u : 1 - u;
  }
  return clamp(v);
}

/** The wall's weathering for a seed: where the lime plaster has fallen and the laterite shows. Pure, memoised. */
const memo = new Map();
export function weather(seed = 1) {
  if (memo.has(seed)) return memo.get(seed);
  const r = rng(`dar:${seed}`);
  // only on open wall: never across the door, the window or their surrounds
  const spots = [
    { x: r.range(70, 250), y: r.range(170, 300) }, { x: r.range(90, 280), y: r.range(520, 640) },
    { x: r.range(1060, 1150), y: r.range(160, 215) }, { x: r.range(716, 770), y: r.range(620, 670) },
  ];
  const patches = spots.map((s, i) => ({ x: s.x, y: s.y, r: i === 3 ? r.range(26, 36) : i === 2 ? r.range(34, 50) : r.range(40, 70), squash: r.range(0.5, 0.85), rot: r.range(-0.4, 0.4), seed: r.int(1, 1e6) }));
  const flowers = Array.from({ length: 64 }, () => ({ a: r() * TAU, d: r.range(0, 1), s: r.range(0.7, 1.2), tone: r() }));
  const out = { seed, patches, flowers, stain: r.range(0.3, 0.8) };
  if (memo.size > 8) memo.delete(memo.keys().next().value);
  memo.set(seed, out);
  return out;
}

export const LOOKS = {
  quiet: { moves: false },
  warm: { moves: true },
  playful: { moves: true },
};

/**
 * The frame. Before the key arrives it is on its way (or not yet in sight);
 * once caught it hangs from the hook at `angle`. Quiet, and any time after
 * REST, is the finished still: key at rest, bolt home.
 */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const done = register === 'quiet' || time >= REST;
  const t = done ? REST : time;
  let key;
  if (t < ARRIVE.start) key = { onHook: false, visible: false, ...arrival(0) };
  else if (t < ARRIVE.end) key = { onHook: false, visible: true, ...arrival((t - ARRIVE.start) / (ARRIVE.end - ARRIVE.start)) };
  else key = { onHook: true, visible: true, x: HOOK.x, y: HOOK.y, angle: done ? 0 : swingAngle(t) };
  return {
    seed, time: t, register, weather: weather(seed), key,
    bolt: boltAt(t),
    // playful stays awake after the rest, so a push can swing the key again; the renderer skips frames that do not change
    settled: done && register !== 'playful',
  };
}
