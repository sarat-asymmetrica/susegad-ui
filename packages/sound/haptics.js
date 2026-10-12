// Vibration patterns paired to the sound vocabulary. Pure data: navigator.vibrate
// takes an array of milliseconds, on-off-on-off…
//
// The patterns are keyed by the Web Haptics proposal's effect names (tick,
// success, error), so a future navigator.playHaptics(effect) is a one-line
// change inside haptic() and nothing else moves. `complete` has no proposal
// equivalent yet (a longer success); it keeps its own name until one exists.
// The sound words are aliases: confirm plays the success effect.

import { VOCAB } from './patches.js';

export const EFFECTS = {
  tick: [8],
  success: [12, 30, 12],
  complete: [16, 40, 16, 40, 24],
  error: [30, 60, 30],
};

/** Sound word → haptic effect. Any word already an effect name maps to itself. */
const ALIAS = { tick: 'tick', confirm: 'success', complete: 'complete', error: 'error' };

/** The effect name for a sound word or an effect name, or null. @param {string} name */
export function effectFor(name) {
  return Object.hasOwn(ALIAS, name) ? ALIAS[name] : Object.hasOwn(EFFECTS, name) ? name : null;
}

/** @param {string} name a vocabulary word (tick, confirm, complete, error) or an effect name (success…) @returns {number[]|null} */
export function patternFor(name) {
  if (!VOCAB.includes(name) && !Object.hasOwn(EFFECTS, name)) return null;
  const effect = effectFor(name);
  return effect ? EFFECTS[effect] : null;
}
