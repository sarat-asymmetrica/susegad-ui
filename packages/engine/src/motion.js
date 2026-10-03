// motion.js: things that lag, trail and overshoot. Pure.
//
// Every moving thing in a drawn scene is a signal that does not quite keep up
// with its cause: a hem swinging behind a hip, a lamp trailing a hand, a
// shadow softening as its caster moves away. Writing those as
// `Math.sin(t - 0.7)` happens to look right at one speed and wrong at every
// other, because a fixed phase offset is a lag in *angle*, and a real lag is
// a lag in *time*. The two agree only while the drive is a pure sine.
//
// These are the three forms that cover almost all of it: an exponential
// follow (first-order, no overshoot), a damped oscillator (second-order, it
// rings and settles), and a lead/lag pair written as a delayed copy of the
// drive.

import { clamp, lerp } from './math.js';

/** Move `a` toward `b` with time constant `tau`, over `dt` seconds.
 *
 * Frame-rate independent by construction: halving the frame rate and doubling
 * `dt` lands in the same place, which the naive `a += (b - a) * 0.1` does not.
 * `tau` is the time to close 63% of the gap, so a lamp in a hand wants a
 * small one and a camera on a dolly a large one.
 *
 * @param {number} a current value
 * @param {number} b the value it is heading for
 * @param {number} dt seconds since the last step
 * @param {number} tau time constant in seconds; <= 0 snaps
 * @returns {number}
 */
export function follow(a, b, dt, tau) {
  if (!(tau > 0)) return b;
  return b + (a - b) * Math.exp(-Math.max(0, dt) / tau);
}

/** Follow a whole list or a {x, y}, so a rig does not need its own loop.
 *  @param {number[] | {x: number, y: number, [k: string]: number}} a
 *  @param {number[] | {x: number, y: number, [k: string]: number}} b
 *  @param {number} dt @param {number} tau */
export function followAll(a, b, dt, tau) {
  if (Array.isArray(a)) return a.map((v, i) => follow(v, b[i], dt, tau));
  const out = {};
  for (const k in a) out[k] = follow(a[k], b[k], dt, tau);
  return out;
}

/** @typedef {{ x: number, v: number }} SpringState  position and velocity */

/**
 * One step of a damped harmonic oscillator.
 *
 * The physical form: `m·x'' = -k·x - c·x'`, which for a unit mass is an
 * acceleration proportional to the displacement and opposed to the velocity.
 * Integrated semi-implicitly (velocity first, then position from the new
 * velocity), which is stable well past the frame rates a browser runs at.
 *
 * A long frame is subdivided rather than taken in one step. That is not
 * fussiness: a single step of a quarter of a second against a 1 Hz spring is
 * unstable and diverges to infinity within a few hundred frames, and a scene
 * that stalls on a background tab would then resume with its rig at 1e70.
 * Sub-stepping costs a few extra multiplies and makes the answer depend only
 * on how much time passed, not on how it was chopped up.
 *
 * `frequency` is the undamped frequency in Hz, the rate the mass would
 * oscillate at with no friction. `damping` is the damping *ratio*, not a raw
 * coefficient: below 1 it rings and settles, 1 is the fastest approach that
 * does not overshoot at all, and above 1 it crawls in. Naming the ratio rather
 * than the coefficient is what makes a rig tunable by ear.
 *
 * @param {SpringState} s state, mutated and returned
 * @param {number} target the rest position
 * @param {number} dt seconds since the last step
 * @param {{ frequency?: number, damping?: number }} [opts]
 * @returns {SpringState} the same object
 */
export function spring(s, target, dt, { frequency = 1, damping = 0.4 } = {}) {
  const total = Math.max(0, dt);
  if (total === 0) return s;
  const w = clamp(frequency, 0, 1e4) * Math.PI * 2;
  // Critical damping is 2·w for the velocity term at unit mass.
  const c = clamp(damping, 0, 20) * 2 * w;
  // Sub-step so a long frame cannot diverge. The step only needs to be short
  // against the fastest thing in the system, so a sixteenth of the fastest
  // period is ample; a 60 fps frame against a 2 Hz spring takes one step, and
  // a quarter-second stall takes about a hundred.
  const fastest = Math.max(w, c);
  const h = fastest > 0 ? Math.min(total, 0.0625 / fastest) : total;
  const steps = Math.max(1, Math.min(512, Math.ceil(total / h)));
  const step = total / steps;
  for (let i = 0; i < steps; i++) {
    const a = -w * w * (s.x - target) - c * s.v;
    s.v += a * step;
    s.x += s.v * step;
  }
  return s;
}

/** A fresh oscillator at rest at `x`.
 *  @param {number} [x] @returns {SpringState} */
export function makeSpring(x = 0) {
  return { x, v: 0 };
}

/**
 * A lagged copy of a drive, in seconds rather than radians.
 *
 * `lag` is how far behind the drive this runs. A hem swinging half a beat
 * behind a body is this with the beat given in seconds; a shadow softening
 * behind a lamp is this too. Because the lag is in time, it stays correct
 * when the tempo changes, which a fixed subtraction inside `sin()` does not.
 *
 * `drive` is called with a time, so any periodic function will do.
 *
 * @param {number} t the time to read the drive at
 * @param {(t: number) => number} drive
 * @param {number} lag seconds behind
 * @param {{ amplitude?: number, centre?: number }} [opts]
 * @returns {number}
 */
export function lagged(t, drive, lag, { amplitude = 1, centre = 0 } = {}) {
  return centre + drive(t - Math.max(0, lag)) * amplitude;
}

/**
 * A drive's value, its lag and the tension between them.
 *
 * The one thing a scene usually wants and cannot get from two calls to `sin`:
 * how far the lagging part is from the thing it follows, signed. Dress on a
 * body stretches on the way one way and slackens on the other, and that
 * difference is the whole reason the hem reads as cloth. Signed by the
 * direction of travel, so it is 0 at the two extremes and strongest mid-stroke.
 *
 * @param {number} t
 * @param {(t: number) => number} drive
 * @param {number} lag seconds
 * @param {{ amplitude?: number, centre?: number }} [opts]
 * @returns {{ value: number, tension: number, stretch: number }}
 */
export function lagAndTension(t, drive, lag, { amplitude = 1, centre = 0 } = {}) {
  const h = 1e-4;
  const now = drive(t);
  const before = drive(t - Math.max(0, lag));
  const velocity = (drive(t + h) - drive(t - h)) / (2 * h);
  const value = centre + before * amplitude;
  return {
    value,
    // Positive when the lagged copy is being left behind, negative when it
    // has overshot, and 0 where the two cross.
    tension: (now - before) * amplitude,
    stretch: Math.abs(now - before) * amplitude,
    velocity: velocity * amplitude,
  };
}

/**
 * A pendulum, for a lantern on a hand or a beam on a chain.
 *
 * A point mass on a rigid rod of length `length` under gravity, so the
 * restoring term is `g/L·sin(θ)` rather than `k·θ`. That nonlinearity is the
 * whole reason a pendulum's period grows with its amplitude, and the reason a
 * small swing and a large one do not stay in step. Integrated with the same
 * semi-implicit step as `spring`.
 *
 * @param {{ angle: number, v: number }} s state, mutated and returned
 * @param {number} dt seconds
 * @param {{ length?: number, gravity?: number, damping?: number, drive?: number }} [opts]
 *   `drive` is a constant acceleration applied at the bob (wind, a hand
 *   moving off it, the deck under it), in radians per second squared.
 * @returns {{ angle: number, v: number }}
 */
export function pendulum(s, dt, { length = 1, gravity = 9.81, damping = 0.6, drive = 0 } = {}) {
  const total = Math.max(0, dt);
  if (total === 0) return s;
  const L = Math.max(1e-3, length);
  const g = Math.max(0, gravity) / L;
  const d = clamp(damping, 0, 20);
  // Sub-step for the same reason `spring` does. A pendulum on a short rope is
  // the stiffest thing in the set, and one long step against it will not come
  // back.
  const fastest = Math.sqrt(g) + d;
  const h = fastest > 0 ? Math.min(total, 0.0625 / fastest) : total;
  const steps = Math.max(1, Math.min(512, Math.ceil(total / h)));
  const step = total / steps;
  for (let i = 0; i < steps; i++) {
    const a = -g * Math.sin(s.angle) - d * s.v + drive;
    s.v += a * step;
    s.angle += s.v * step;
  }
  return s;
}

/** A fresh pendulum hanging straight down. @returns {{ angle: number, v: number }} */
export function makePendulum() {
  return { angle: 0, v: 0 };
}

/**
 * Where something is in a repeating cycle, and how much of the cycle is left.
 *
 * Every scene that has somebody walk past does this arithmetic, and getting
 * the wrap wrong is what makes a figure stand still for one frame at the
 * seam. `period` seconds, wrapping both ways so a negative time is legal.
 *
 * @param {number} t
 * @param {number} period seconds; <= 0 is treated as no cycle
 * @returns {{ u: number, cycle: number, left: number }}
 *   `u` is 0..1 through this cycle, `cycle` which one it is, `left` seconds
 *   until the next one starts.
 */
export function cycle(t, period) {
  if (!(period > 0)) return { u: 0, cycle: 0, left: Infinity };
  const time = ((t % period) + period) % period;
  return { u: time / period, cycle: Math.floor(t / period), left: period - time };
}

/**
 * A presence that is fully here, holds, and is gone, with soft ends.
 *
 * A person who arrives and leaves on a hard edge is a cut-out, not a person.
 * The ramp lengths are fractions of the visit, and the hold in the middle is
 * whatever the two ramps leave.
 *
 * @param {number} t
 * @param {{ period: number, visit: number, arrive?: number, leave?: number, phase?: number }} opts
 *   `visit` is seconds spent at the counter; the ramps are fractions of it.
 *   `phase` offsets the cycle, so two things can arrive out of step.
 * @returns {{ present: boolean, presence: number, u: number, left: number }}
 */
export function visit(t, { period, visit: stay, arrive = 0.2, leave = 0.24, phase: offset = 0 }) {
  const { u, cycle: n, left } = cycle(t + Math.max(0, offset), period);
  const span = clamp(stay / Math.max(1e-6, period), 0, 1);
  const inSpan = u < span;
  const v = inSpan ? u / span : 0;
  const a = clamp(arrive, 0, 1);
  const l = clamp(leave, 0, 1 - a);
  const ramp = Math.min(smooth((v - 0) / a), 1 - smooth((v - (1 - l)) / l));
  return { present: inSpan, presence: inSpan ? ramp : 0, u: v, left, cycle: n };
}

const smooth = (x) => { const t = clamp(x); return t * t * (3 - 2 * t); };
