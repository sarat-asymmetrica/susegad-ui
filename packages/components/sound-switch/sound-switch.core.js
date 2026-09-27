// Sound switch: the pure core. Runs in Node.
//
// The native <input type="checkbox" role="switch"> is the switch itself; this
// file holds the drawing (a small speaker with two arcs of sound, and a
// struck-through line when it is off) as plain data, and the arcs' gentle
// pulse in playful as a pure function of time.

import { makeNoise } from '../../engine/src/noise.js';

/** The component adds no words of its own: the label is the builder's. */
export const STRINGS = {};

/** A speaker on a 28 x 24 grid: the body (cone), two arcs of sound, and the off-state slash. */
export const SPEAKER = {
  body: 'M2 9H7L13 4V20L7 15H2Z',
  arcs: ['M16.4 8.3C17.9 9.7 17.9 14.3 16.4 15.7', 'M19.6 5.4C22.9 8.6 22.9 15.4 19.6 18.6'],
  slash: 'M15.5 6.5L24 17.5',
};

/**
 * The arcs' loudness at time t (seconds): a small pulse from seeded noise, so
 * two switches on a page never breathe in step. Pure.
 */
export function pulse(t, seed = 'sound-switch') {
  const n = makeNoise(`sound-switch:${seed}`);
  return +(0.72 + n(t * 1.5, 2.1) * 0.28).toFixed(3);
}

/**
 * Web Animations keyframes for the arcs' pulse, or null when they should hold
 * still: off, quiet, reduced motion (motion 'still' or 'state').
 * @param {'still'|'state'|'ambient'|'full'} motion
 */
export function waveAnimation(motion, on, seed) {
  if (!on || motion === 'still' || motion === 'state') return null;
  const frames = [];
  for (let i = 0; i <= 12; i++) frames.push({ opacity: pulse(i * 0.25, seed) });
  frames[12] = frames[0]; // loop without a jump
  return { frames, timing: { duration: 2600, iterations: Infinity, easing: 'ease-in-out' } };
}
