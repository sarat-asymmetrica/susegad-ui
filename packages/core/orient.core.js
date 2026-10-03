// Orientation policy for the words-in-world primitive: the pure part. No DOM,
// and no library: the one import is its sibling, quat.core.js, so a quaternion
// is derived in one place (the way the slices share engine/src/math.js). How far
// may words turn? The register sets a cone of tilt around the viewer's axis, the
// reader's wish is slerped back onto it, and the cone never opens past
// READABLE.limitDeg.

import { IDENTITY, qNorm, qConj, qMul, qAngle, fromEuler, slerp, damp } from './quat.core.js';

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
/** The angle between two orientations, in degrees (quat.core.js counts radians). */
const angleDeg = (a, b) => qAngle(a, b) / DEG;
/** A seed as a number in [0, 1), the same in every process. */
const seedOf = seed => {
  const s = String(seed ?? '');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
};

/** Degrees of tilt from the viewer's axis that a register allows. */
export const TURN = { quiet: 0, warm: 6, playful: 16 };
/** The settling shape: time constant, resting deadband, sway period. */
export const SETTLE = { tau: 0.9, deadbandDeg: 0.25, swayTau: 2.4 };
/** Past this a turned plane reads as a picture, not as text. */
export const READABLE = { limitDeg: 35 };

const REGISTER = {
  quiet: { swayDeg: 0, tau: SETTLE.tau, followsPointer: false, swayOn: false },
  warm: { swayDeg: 1.2, tau: 0.9, followsPointer: true, swayOn: true },
  playful: { swayDeg: 3.5, tau: 0.45, followsPointer: true, swayOn: true },
};
const DOWN = { playful: 'warm', warm: 'quiet', quiet: 'quiet' };

/** The register as the model's own numbers: quiet and reduced motion are the finished still, lite or Save-Data steps one register down, and a touch screen has no hovering pointer to follow. */
export function params(register = 'warm', { reduced = false, lite = false, saveData = false, touch = false } = {}) {
  const down = DOWN[REGISTER[register] ? register : 'warm'];
  const name = reduced ? 'quiet' : lite || saveData ? down : REGISTER[register] ? register : 'warm';
  return { maxTiltDeg: TURN[name], swayDeg: REGISTER[name].swayDeg, tau: REGISTER[name].tau, followsPointer: REGISTER[name].followsPointer && !touch, swayOn: REGISTER[name].swayOn };
}

/** The target the reader asked for: pointer in [-1, 1] each way, `turn` in 0..1 of the register's tilt. */
export function aim({ pointer = [0, 0], turn = 1, params: p } = {}) {
  const k = clamp(turn, 0, 1) * Math.max(0, p?.maxTiltDeg ?? 0);
  const px = clamp(pointer[0] ?? 0, -1, 1), py = clamp(pointer[1] ?? 0, -1, 1);
  return fromEuler(-py * k, px * k, 0);
}

/** Hold a target inside the cone: slerped back onto the boundary rather than clamped axis by axis, so the direction asked for survives and only the turn shortens. */
export function softConstrain(qTarget, qView = IDENTITY, maxTiltDeg = 0) {
  const v = qNorm(qView ?? IDENTITY), q = qNorm(qTarget ?? IDENTITY);
  const limit = Math.max(0, maxTiltDeg), deg = angleDeg(q, v);
  return deg <= limit ? { q, overDeg: 0, clamped: false } : { q: slerp(v, q, limit / deg), overDeg: deg - limit, clamped: true };
}

/** One frame of settling: a damped shortest-path slerp with a deadband, landing on the target exactly at rest. */
export function settle(qNow, qTarget, dt, { tau = SETTLE.tau, deadbandDeg = SETTLE.deadbandDeg } = {}) {
  const b = qNorm(qTarget ?? qNow ?? IDENTITY), a = qNorm(qNow ?? b);
  if (angleDeg(a, b) <= deadbandDeg) return { q: b, settled: true };
  const q = damp(a, b, dt, tau);
  return angleDeg(q, b) <= deadbandDeg ? { q: b, settled: true } : { q, settled: false };
}

/** The idle sway: a slow turn on three axes, seeded so a seed and a time give the same orientation in every process. */
export function sway(tSec, seed, { swayDeg = 0, maxTiltDeg = READABLE.limitDeg, qView = IDENTITY } = {}) {
  const v = qNorm(qView ?? IDENTITY);
  if (!(swayDeg > 0)) return v;
  const h = seedOf(seed), t = Number.isFinite(tSec) ? tSec : 0, w = 2 * Math.PI / SETTLE.swayTau;
  return softConstrain(fromEuler(
    swayDeg * 0.6 * Math.sin(w * 1.37 * t + h * 2.39996),
    swayDeg * Math.sin(w * t + h * 6.28319),
    swayDeg * 0.35 * Math.sin(w * 0.83 * t + h * 4.71239),
  ), v, maxTiltDeg).q;
}

/** Is this the untouched orientation? A tolerance in degrees, because a matrix round trip is not exact. */
export function isIdentity(q, epsDeg = 0.05) {
  return !q || angleDeg(qNorm(q), IDENTITY) <= epsDeg;
}

/** Where the words are turned, in plain words for a polite status line. */
export function tiltWords(q, qView = IDENTITY) {
  const v = qNorm(qView ?? IDENTITY), a = qNorm(q ?? v), deg = angleDeg(a, v);
  if (deg <= 0.5) return 'The words face you.';
  const r = qMul(qConj(v), a), ax = Math.abs(r[0]), ay = Math.abs(r[1]), az = Math.abs(r[2]);
  const dir = ay >= ax && ay >= az ? (r[1] >= 0 ? 'to the right' : 'to the left')
    : ax >= az ? (r[0] >= 0 ? 'away from you' : 'toward you') : 'at a slant';
  if (deg > READABLE.limitDeg) return `The words are turned too far ${dir} to read comfortably.`;
  return `The words are turned ${deg < 2 ? 'a little' : deg < 8 ? 'slightly' : 'quite a way'} ${dir}.`;
}