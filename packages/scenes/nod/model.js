// Nod: the helper that asks first. The pure half.
//
// A café table seen from the front: a cutting-chai glass steaming at the
// left, a phone on a stand at the right. On the phone a message arrives, the
// helper drafts a reply into a dashed card with an empty tick, and the draft
// waits. Only a person's nod sends it. Everything the phone shows is a pure
// function of time and of the moments someone nodded, so the rule "nothing
// goes out without a nod" can be tested in Node.

import { rng, makeNoise, smoothstep } from '../../engine/index.js';

export const W = 1200, H = 800;

/** Where things stand, in logical units. */
export const GLASS = { cx: 318, top: 392, bottom: 626, rt: 70, rb: 54, level: 440 };
export const PHONE = { x: 690, y: 146, w: 250, h: 470, r: 30 };
export const SCREEN = { x: PHONE.x + 12, y: PHONE.y + 44, w: PHONE.w - 24, h: PHONE.h - 70 };
/** The table: its far edge against the wall, and its near edge, seen a little from above. */
export const BACK = 520, TABLE = 716;

/** An exchange's beats, in seconds from its start: the message, the helper typing, the draft. */
export const BEATS = { typing: 0.9, draft: 2.3, sent: 0.4, next: 1.8 };
/** When the first message arrives, and (warm only) when the scripted nod comes. */
export const FIRST = 1.2;
export const WARM_NOD = FIRST + BEATS.draft + 3.1;
/** The finger's visit: it comes up before a scripted nod and leaves after any nod. */
export const FINGER = { rise: 1.3, leave: 1.1 };

/** One conversation: bubble sizes (lines of scribble) for each exchange, from a seed. Pure, memoised. */
const memo = new Map();
export function talk(seed = 1) {
  if (memo.has(seed)) return memo.get(seed);
  const r = rng(`nod:${seed}`);
  const bubble = (who, lo, hi) => ({ who, lines: r.int(lo, hi), widths: [r.range(0.55, 0.95), r.range(0.45, 0.95), r.range(0.3, 0.7)], seed: r.int(1, 1e6) });
  const out = {
    seed,
    history: [bubble('them', 1, 2), bubble('us', 1, 2)],
    exchanges: Array.from({ length: 6 }, () => ({ ask: bubble('them', 1, 3), reply: bubble('us', 2, 3) })),
  };
  if (memo.size > 8) memo.delete(memo.keys().next().value);
  memo.set(seed, out);
  return out;
}

/**
 * The phone at time t, given the moments someone nodded (sorted seconds).
 * A nod counts only while a draft is waiting; a nod at any other moment
 * does nothing. Returns the bubbles in order (oldest first), the draft if one
 * is showing, whether the helper is typing, and when the last nod landed.
 * `limit` caps how many exchanges happen (warm plays one; playful goes on).
 */
export function thread(t, nods = [], limit = Infinity) {
  const bubbles = [];
  let start = FIRST, k = 0, draft = null, typing = false, lastNod = -Infinity, n = 0;
  while (k < limit && t >= start) {
    bubbles.push({ kind: 'ask', ex: k, age: t - start });
    const draftAt = start + BEATS.draft;
    if (t < draftAt) { typing = t >= start + BEATS.typing; break; }
    // the first nod after the draft appears is the one that sends it
    while (n < nods.length && nods[n] < draftAt) n++;
    const nod = n < nods.length && nods[n] <= t ? nods[n] : null;
    if (nod === null) { draft = { ex: k, age: t - draftAt, ticked: 0 }; break; }
    n++;
    lastNod = nod;
    const since = t - nod;
    if (since < BEATS.sent) { draft = { ex: k, age: t - draftAt, ticked: smoothstep(0, BEATS.sent * 0.6, since) }; break; }
    bubbles.push({ kind: 'reply', ex: k, age: since - BEATS.sent });
    start = nod + BEATS.next;
    k++;
  }
  return { bubbles, draft, typing, lastNod, sentCount: bubbles.filter(b => b.kind === 'reply').length };
}

/** The finger: 0 is out of sight below, 1 is on the tick. It rises before a scripted nod and leaves after any nod. */
export function fingerAt(t, nod, scripted) {
  if (!Number.isFinite(nod)) return 0;
  if (t < nod) return scripted ? smoothstep(nod - FINGER.rise, nod - 0.05, t) : 0;
  return 1 - smoothstep(nod + 0.15, nod + FINGER.leave, t);
}

// ── steam, from the sketchbook's Chai plate ───────────────────────────────

const field = makeNoise(77);
const FS = 0.011;
/** Curl of a scalar noise potential: a swirling flow that never bunches up. */
export function curl(x, y, t, z) {
  const e = 1, psi = (a, b) => field(a * FS, b * FS + t * 0.22, z + t * 0.1);
  return [(psi(x, y + e) - psi(x, y - e)) / (2 * e * FS), -(psi(x + e, y) - psi(x - e, y)) / (2 * e * FS)];
}
/** A rising streamline through the curl field. */
export function streamline(x, y, t, z, steps = 90, step = 2.4, drift = 0.6) {
  const pts = [[x, y]];
  for (let i = 0; i < steps; i++) {
    const [cx, cy] = curl(x, y, t, z), spread = 0.35 + i / steps;
    const vx = cx * drift * spread, vy = -1 + cy * drift * 0.3, l = Math.hypot(vx, vy) || 1;
    x += (vx / l) * step; y += (vy / l) * step;
    pts.push([x, y]);
  }
  return pts;
}
/** The wisps alive at time t: each is born at the tea, rises along its streamline and fades. */
export function wisps(t, { life = 4.8, period = 0.8 } = {}) {
  const out = [], first = Math.max(0, Math.floor((t - life) / period)), last = Math.floor(t / period);
  for (let i = first; i <= last; i++) {
    const age = t - i * period;
    if (age < 0 || age > life) continue;
    const r = rng(`wisp:${i}`);
    out.push({ i, age, life, x: GLASS.cx + r.range(-34, 34), alpha: Math.pow(Math.sin(Math.PI * (age / life)), 1.2) * 0.62 });
  }
  return out;
}

export const LOOKS = {
  quiet: { steam: false, limit: 1 },
  warm: { steam: true, limit: 1 },
  playful: { steam: true, limit: Infinity },
};

/**
 * The frame. Warm plays one exchange with a scripted nod; playful takes its
 * nods from the person, so the renderer passes them to thread() itself and
 * this frame only gives the scripted beats; quiet is the draft, waiting.
 */
export function model({ time = 0, seed = 1, register = 'warm' } = {}) {
  const look = LOOKS[register] ?? LOOKS.warm;
  const C = talk(seed);
  const t = register === 'quiet' ? FIRST + BEATS.draft + 1 : time;
  const nods = register === 'warm' ? [WARM_NOD] : [];
  const th = thread(t, nods, look.limit);
  const nod = register === 'warm' ? WARM_NOD : -Infinity;
  return {
    seed, time: t, register, look, talk: C, nods, ...th,
    finger: register === 'warm' ? fingerAt(t, nod, true) : 0,
    wisps: look.steam ? wisps(t) : [],
    settled: register === 'quiet',
  };
}
