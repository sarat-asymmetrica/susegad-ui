// Vibration patterns paired to the sound vocabulary. Pure data: navigator.vibrate
// takes an array of milliseconds, on-off-on-off…

import { VOCAB } from './patches.js';

const PATTERNS = {
  tick: [8],
  confirm: [12, 30, 12],
  complete: [16, 40, 16, 40, 24],
  error: [30, 60, 30],
};

/** @param {string} name @returns {number[]|null} */
export function patternFor(name) {
  return VOCAB.includes(name) ? (PATTERNS[name] ?? null) : null;
}
