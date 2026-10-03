// wave.js: fronts, arrival and spread. Pure.
//
// Some things take a place over time rather than fading: salt creeping across
// a pan, water filling a basin, frost taking a window, a tide coming in. The
// progress of the whole is a single number the viewer drags, and the
// interesting question is what that number means *at each point on the
// ground*.
//
// The answer is a wavefront. Everything here is one of two ways to ask where
// the front is: as a distance from where it started, so the shape comes from
// the geometry, or as a rate at which it spreads, so the shape comes from the
// medium. The failure mode of both is the same, and it is the one worth
// naming: a front driven by a hand-weighted index instead of a distance dries
// the ground in whatever order the coefficients happen to imply, which is
// not an aesthetic choice and does not survive anyone moving the source.

import { clamp, smoothstep } from './math.js';
import { lagged } from './motion.js';

/**
 * How far a front has reached a point, 0 to 1.
 *
 * The front arrives when the elapsed progress passes the distance to the
 * point, scaled by the speed. Distance is real distance, so a front from one
 * corner is round and a front from an edge is straight, without either being
 * special-cased.
 *
 * `dist` is measured in the scene's own units, so the caller decides the
 * scale by choosing them; `speed` is how many units the front covers per unit
 * of progress. A negative speed is a front going the other way, which is a
 * receding tide rather than a rising one.
 *
 * @param {number} progress 0..1, the whole
 * @param {number} dist distance from the source to this point
 * @param {{ speed?: number, softness?: number, reach?: number }} [opts]
 *   `softness` is the width of the leading edge in the same units, so 0 is a
 *   hard line and a large value is a gradual wash.
 *   `reach` is the distance at which the front is complete; past it, 1.
 * @returns {number} 0 not yet arrived, 1 fully arrived
 */
export function front(progress, dist, { speed = 1, softness = 0, reach = Infinity } = {}) {
  const p = clamp(progress);
  const travelled = p * speed;
  if (!Number.isFinite(travelled) || !Number.isFinite(dist)) return 0;
  // A hard front is complete the moment it arrives, unless a reach says the
  // ground is finite and there is more to fill. (Ramping from arrival to
  // `reach` with no reach in hand means dividing by infinity, which returns a
  // number just above zero forever instead of 1.)
  if (softness <= 0) {
    if (travelled < dist) return 0;
    if (!Number.isFinite(reach)) return 1;
    return clamp((travelled - dist) / Math.max(1e-6, reach - dist));
  }
  // A soft edge is a smoothstep across the leading edge, centred on arrival.
  // The reach only ever completes the front early, once the soft edge has
  // already run its course: a point past the reach is not "arrived" for free,
  // it is done, and the arrival itself still has to happen.
  if (dist < reach) return smoothstep(dist - softness, dist + softness, travelled);
  if (travelled < dist - softness) return 0;
  return 1;
}

/**
 * A front spreading from a point, measured as real distance.
 *
 * @param {number} progress 0..1
 * @param {number} x this point's x
 * @param {number} y this point's y
 * @param {{ originX?: number, originY?: number, speed?: number, softness?: number, reach?: number }} [opts]
 * @returns {number} 0..1
 */
export function radialFront(progress, x, y, { originX = 0, originY = 0, speed = 1, softness = 0, reach = Infinity } = {}) {
  return front(progress, Math.hypot(x - originX, y - originY), { speed, softness, reach });
}

/**
 * A front advancing along one axis, which is what a row of pans or a raked
 * surface needs: the same arrival time for every point at the same depth, and
 * independent of the coordinate across it.
 *
 * @param {number} progress 0..1
 * @param {number} depth how far along the axis this point sits
 * @param {{ speed?: number, softness?: number, reverse?: boolean, reach?: number }} [opts]
 *   `reach` is how deep the ground is, so a pan is complete once the front
 *   has crossed it rather than still climbing at the far bund.
 * @returns {number} 0..1
 */
export function linearFront(progress, depth, { speed = 1, softness = 0, reverse = false, reach = Infinity } = {}) {
  // A receding front is a front measured from the far end and read at `1 - p`,
  // not a negative distance: negating would push the point inside the reach
  // test and the arrival test at once, and neither means what it looks like.
  // The reach is the same either way: the ground does not change size because
  // the water is going out instead of coming in.
  return reverse
    ? front(1 - progress, depth, { speed, softness, reach })
    : front(progress, depth, { speed, softness, reach });
}

/**
 * A front that spreads fastest where the ground is easiest.
 *
 * Salt does not creep across a pan at one speed. It runs into the low corner
 * first, and the rim along the bund dries before the middle, because that is
 * where the clay is and the brine is shallow. Weighting the distance by a
 * per-point difficulty gives that for free: a `weight` above 1 makes that
 * point later than the geometry alone would say.
 *
 * @param {number} progress 0..1
 * @param {number} dist real distance from the source
 * @param {number} weight 1 is ordinary, above 1 is harder and later
 * @param {{ speed?: number, softness?: number, reach?: number }} [opts]
 * @returns {number} 0..1
 */
export function weightedFront(progress, dist, weight = 1, { speed = 1, softness = 0, reach = Infinity } = {}) {
  // The weight scales the distance and nothing else, so the front keeps the
  // caller's speed and reach: a harder point arrives later, it does not travel
  // at a different pace or over a different amount of ground.
  return front(progress, dist * Math.max(0, weight), { speed, softness, reach });
}

/**
 * Time for a front to arrive at a point, in progress units.
 *
 * The inverse of `front`: what value of the slider will have brought the front
 * this far. Useful for scheduling one thing off another (a heap is raked once
 * its pan is dry) and for tests, which can then assert an ordering rather
 * than a pair of magic numbers.
 *
 * @param {number} dist
 * @param {{ speed?: number, softness?: number }} [opts]
 * @returns {number} 0..1
 */
export function arrivalTime(dist, { speed = 1, softness = 0 } = {}) {
  // The midpoint of a soft edge is the same place the hard edge arrives, since
  // the smoothstep is centred on it. So the arrival is the distance over the
  // speed either way, and the softness only decides how long afterwards it
  // looks finished.
  return clamp(dist / Math.max(1e-6, speed));
}

/**
 * A travelling wave along a list of things, each at its own point in the cycle.
 *
 * The stage lights, the pit, the front row, the singer's gown: one beat, and
 * everything on it, each arriving at its own moment. `offset` is a fraction of
 * the period, so an offset of 0.5 is half a beat behind, and the delay is a
 * *time*, which is why it stays right when the tempo changes.
 *
 * @param {number} t
 * @param {(t: number) => number} drive the shared beat
 * @param {{ period?: number, offset?: number, lag?: number, amplitude?: number, centre?: number }} [opts]
 * @returns {number}
 */
export function phaseShifted(t, drive, { period = 0, offset = 0, lag = 0, amplitude = 1, centre = 0 } = {}) {
  if (period > 0) return centre + drive((t / period - offset) * period) * amplitude;
  return lagged(t, drive, offset + lag, { amplitude, centre });
}

/**
 * How complete a spreading edge is at one point, given a list of neighbours.
 *
 * The discrete counterpart of `front`: a cellular step where each point
 * advances toward its neighbours' state. Nothing about the shape is
 * prescribed, so a front that runs down a bund and pools in a low corner
 * comes out of the ground rather than out of a formula. Two passes are enough
 * to make a field look continuous at these sizes.
 *
 * @param {number[]} state 0..1 per point, mutated in place
 * @param {{ rate?: number, neighbours?: number[][], passes?: number, wrap?: boolean }} [opts]
 *   `neighbours[i]` is the list of indices point i watches. Default: the
 *   four orthogonal neighbours of a row-major grid.
 * @returns {number[]} the same array
 */
export function spread(state, { rate = 0.2, neighbours, passes = 2, wrap = false } = {}) {
  const n = state.length;
  if (!n) return state;
  const adj = neighbours ?? (() => {
    // A square-ish row-major grid is the common case; fall back to a line if
    // the shape does not factor.
    const w = Math.round(Math.sqrt(n));
    if (w * w !== n) return null;
    const out = [];
    for (let i = 0; i < n; i++) {
      const list = [];
      const x = i % w, y = (i / w) | 0;
      if (x > 0) list.push(i - 1);
      if (x < w - 1) list.push(i + 1);
      if (y > 0) list.push(i - w);
      if (y < w - 1) list.push(i + w);
      out.push(list);
    }
    return out;
  })();
  // A line, when the shape does not factor into a square grid. Each point
  // watches its immediate neighbours on both sides, not just the next one
  // along, or the value can only ever travel forwards.
  const links = adj ?? Array.from({ length: n }, (_, i) => {
    const out = [];
    if (i > 0) out.push(i - 1);
    if (i < n - 1) out.push(i + 1);
    return out;
  });
  for (let p = 0; p < passes; p++) {
    const next = state.slice();
    for (let i = 0; i < n; i++) {
      const list = links[i];
      if (!list || !list.length) continue;
      let sum = 0;
      for (const j of list) sum += wrap ? state[(j + n) % n] : (j >= 0 && j < n ? state[j] : 0);
      const avg = sum / list.length;
      next[i] = clamp(state[i] + (avg - state[i]) * rate);
    }
    for (let i = 0; i < n; i++) state[i] = next[i];
  }
  return state;
}
