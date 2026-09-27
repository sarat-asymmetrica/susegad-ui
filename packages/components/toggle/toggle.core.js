// Toggle: the pure core. Runs in Node.
//
// The native <input type="checkbox" role="switch"> is the switch: it submits,
// takes Space, and a screen reader says "switch, on" or "off". This file holds
// the drawings: the brass latch (warm) and the lamp (playful), as plain data,
// and the lamp's flicker as a pure function of time.

import { makeNoise } from '../../engine/src/noise.js';

/** The component adds no words of its own: the label is the builder's. */
export const STRINGS = {};

/**
 * The warm latch: a tower bolt from a Goan door, on a 44 × 24 grid. A brass
 * plate with two screws, a keeper on the right, and the bolt that slides into
 * it with its handle turned down when the switch is on.
 */
export const LATCH = {
  plate: { x: 2, y: 6.5, w: 27, h: 11, r: 2 },
  screws: [{ cx: 6, cy: 12 }, { cx: 25, cy: 12 }],
  keeper: 'M33 6.5H40.5V17.5H33V14.6H37.6V9.4H33Z',
  shaft: { x: 8, y: 10.2, w: 21, h: 3.6, r: 1.2 },
  handle: { off: 'M13 10.2V4.6', on: 'M13 13.8V19.4' },
  knob: { off: { cx: 13, cy: 4.2 }, on: { cx: 13, cy: 19.8 } },
  /** How far the bolt slides to reach the keeper. */
  slide: 8.5,
};

/** Where the bolt's far end sits: short of the keeper when off, inside it when on. */
export const boltEnd = on => LATCH.shaft.x + LATCH.shaft.w + (on ? LATCH.slide : 0);

/**
 * The playful lamp: a clay diya on a 32 × 32 grid, its wick at the spout, and
 * the flame that stands on the wick when the switch is on.
 */
export const LAMP = {
  // one outline: the bowl, and the spout drawn out of it to the right
  bowl: 'M1.5 17.5C3 24.8 8 28.5 13.5 28.5C18.6 28.5 22 25.8 24 21.8C25.4 20.8 26.8 19 27.6 16.8C24.8 18.8 21.8 19.8 19.2 20.3C17.4 20.7 15.5 20.9 13.5 20.9C8.8 20.9 4.8 19.6 1.5 17.5Z',
  rim: 'M1.5 17.5C4.8 19.8 8.8 21.2 13.5 21.2C15.8 21.2 17.9 20.9 19.8 20.5',
  wick: { x1: 26.4, y1: 17.4, x2: 27.2, y2: 14.8 },
  flame: 'M27.1 14.6C23.7 12.8 23.4 8.2 26.6 2.8C27.4 6.6 30.8 8.8 29.8 12C29.3 13.6 28.4 14.4 27.1 14.6Z',
  flameCore: 'M27.1 13.4C25.8 12.4 25.9 10.4 26.9 8.6C27.4 10.2 28.6 11 28.2 12.4C28 13 27.6 13.3 27.1 13.4Z',
  glow: { cx: 26.8, cy: 9, r: 8 },
};

/**
 * The flame's flicker at time t (seconds): scale and lean, always small, from
 * seeded noise so two lamps on a page never flicker in step. Pure.
 */
export function flicker(t, seed = 'lamp') {
  const n = makeNoise(`toggle-flame:${seed}`);
  return {
    sy: +(1 + n(t * 2.2, 0.3) * 0.12).toFixed(3),
    sx: +(1 + n(t * 1.7, 4.1) * 0.06).toFixed(3),
    lean: +(n(t * 1.3, 9.2) * 6).toFixed(2),
  };
}

/**
 * Flicker keyframes for Web Animations, sampled from `flicker`, or null when
 * the flame should be still: quiet, reduced motion, or the lamp is out.
 * @param {'still'|'state'|'ambient'|'full'} motion
 */
export function flameAnimation(motion, on, seed) {
  if (!on || motion === 'still' || motion === 'state') return null;
  const frames = [];
  for (let i = 0; i <= 12; i++) {
    const { sx, sy, lean } = flicker(i * 0.25, seed);
    frames.push({ transform: `rotate(${lean}deg) scale(${sx}, ${sy})` });
  }
  frames[12] = frames[0]; // loop without a jump
  return { frames, timing: { duration: 3000, iterations: Infinity, easing: 'ease-in-out' } };
}
