// Veranda: the pure model. A function of { time, seed, register, params } that
// returns plain data, and runs in Node. The world itself (solids, camera,
// depth) is in world.js; this says what is moving in it and where the light is.

import { rng, clamp, lerp, TAU } from '../../engine/index.js';
import { W, H } from './world.js';

export { W, H };
export const SUN_REST = 0.35;

/** How each register lives here: how far the lamp swings (radians), how many motes drift, whether the hand moves the sun. */
export const LOOKS = {
  quiet: { swing: 0, motes: 0, hand: false },
  warm: { swing: 0.028, motes: 16, hand: false },
  playful: { swing: 0.05, motes: 30, hand: true },
};

/**
 * The sun as a unit vector toward it, for s in 0 (low, out beyond the paddy on the right) to 1 (higher, more ahead). It is a late sun, low enough to slip under the eave.
 * It always shines from the far end of the veranda toward the camera, so the pillars' shadows lie across the floor.
 */
export function sunAt(s) {
  const phi = lerp(14, 46, clamp(s)) * Math.PI / 180, el = lerp(11, 22, clamp(s)) * Math.PI / 180;
  return [Math.cos(phi) * Math.cos(el), Math.sin(el), Math.sin(phi) * Math.cos(el)];
}

/** The lamp's angle from the vertical in radians: two slow beats, so it never quite repeats. Zero at time 0 and in quiet. */
export function lampSwing(time, register) {
  const a = LOOKS[register]?.swing ?? 0;
  return a * (Math.sin(TAU * time / 6.4) * 0.8 + Math.sin(TAU * time / 3.9) * 0.2);
}

/** Dust in the light: a few motes, positions in the picture's logical units, each with its own slow drift. */
export function motes(time, seed, register) {
  const n = LOOKS[register]?.motes ?? 0, r = rng(`veranda:${seed}`), out = [];
  for (let i = 0; i < n; i++) {
    const x0 = r.range(0.52, 1) * W, y0 = r.range(0.12, 0.78) * H, sp = r.range(0.4, 1), ph = r.range(0, TAU), size = r.range(0.7, 1.7);
    out.push({
      x: x0 + Math.sin(TAU * time * 0.05 * sp + ph) * 26,
      y: y0 + Math.cos(TAU * time * 0.04 * sp + ph * 1.3) * 18 + Math.sin(TAU * time * 0.11 + ph) * 4,
      a: 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(TAU * time * 0.09 * sp + ph * 2)),
      size,
    });
  }
  return out;
}

/**
 * @param {{ time: number, seed: number | string, register: string, params: { sun: number, mood: string } }} s
 */
export function model({ time, seed, register, params }) {
  const look = LOOKS[register] ?? LOOKS.warm;
  const sun = params.sun ?? SUN_REST;
  return {
    register, look,
    sun, light: sunAt(sun),
    mood: params.mood,
    swing: lampSwing(look.swing ? time : 0, register),
    motes: motes(time, seed, register),
    settled: register === 'quiet',
  };
}
