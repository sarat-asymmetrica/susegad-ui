// The sound switch (decision 0015): who may make a sound, and when.
//
//   import { soundOn, setSoundOn, onSoundChange, play, haptic } from './index.js';
//   soundOn();                          // boolean, read from storage (false if storage throws)
//   setSoundOn(true);                   // call only inside a user-gesture handler; persists; fires the event
//   onSoundChange(on => …);             // returns an unsubscribe function
//   play('confirm', { register });      // no-op unless the switch is on and a gesture has happened
//   haptic('confirm');                  // navigator.vibrate pattern paired to the sound; same rules
//
// Nothing plays before a user gesture on the page, even with the remembered
// switch on: the first gesture after load resumes the AudioContext, and only
// then do sounds start. setSoundOn(true) is itself a gesture, so turning the
// switch on and the first sound can be the same tap.

import { patchFor } from './patches.js';
import { render } from './player.js';
import { patternFor } from './haptics.js';

const KEY = 'sg-sound';
const EVENT = 'sg-sound-change';

let cachedOn = null;
let ctx = null;
let gestureSeen = false;

function readStorage() {
  try { return globalThis.localStorage?.getItem(KEY) === '1'; } catch { return false; }
}
function writeStorage(on) {
  try { globalThis.localStorage?.setItem(KEY, on ? '1' : '0'); } catch { /* storage denied: the switch just won't be remembered */ }
}

/** The switch, read from storage. False if storage throws (private browsing, a disabled site setting). */
export function soundOn() {
  if (cachedOn === null) cachedOn = readStorage();
  return cachedOn;
}

function ensureContext() {
  if (ctx) return ctx;
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!AC) return null;
  try { ctx = new AC(); } catch { ctx = null; }
  return ctx;
}

/** The first gesture anywhere on the page resumes the context, once. */
function markGesture() {
  if (gestureSeen) return;
  gestureSeen = true;
  if (!soundOn()) return; // with the switch off, a tap costs nothing: play() makes the context later, if ever
  const c = ensureContext();
  if (c?.state === 'suspended') c.resume().catch(() => {});
}

if (typeof document !== 'undefined') {
  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    document.addEventListener(type, markGesture, { capture: true, passive: true, once: true });
  }
}

/** Turn the switch on or off. Call only inside a user-gesture handler: this counts as the gesture too. */
export function setSoundOn(on) {
  cachedOn = !!on;
  writeStorage(cachedOn);
  markGesture();
  try { document.dispatchEvent(new CustomEvent(EVENT, { detail: { on: cachedOn } })); } catch { /* no document: nothing to tell */ }
}

/** @param {(on: boolean) => void} fn @returns {() => void} an unsubscribe function */
export function onSoundChange(fn) {
  if (typeof document === 'undefined') return () => {};
  const handler = e => fn(e.detail.on);
  document.addEventListener(EVENT, handler);
  return () => document.removeEventListener(EVENT, handler);
}

/**
 * Play a word from the vocabulary. A no-op unless the switch is on, a user
 * gesture has happened, and the register has a patch for this word (decision
 * 0015: quiet plays confirmations only). Never throws.
 * @param {'tick'|'confirm'|'complete'|'error'} name
 * @param {{ register?: 'quiet'|'warm'|'playful', el?: Element }} [opts]
 */
export function play(name, opts = {}) {
  try {
    if (!soundOn() || !gestureSeen) return;
    const patch = patchFor(name, opts.register ?? 'warm');
    if (!patch) return;
    const c = ensureContext();
    if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    render(c, patch);
  } catch { /* play() never throws */ }
}

/**
 * The shared AudioContext, for a soundscape that needs to schedule its own
 * sounds over time rather than one word from play() — Paus's rain, Rampon's
 * koel. Same gate as play(): null unless the switch is on and a gesture has
 * happened, so a soundscape only has to check "do I have a context" every
 * frame and stop scheduling when it doesn't. Added for the soundscapes
 * (karigar-sound, Wave 4): any further change to this file's exports still
 * goes here first, per decision 0015.
 * @returns {AudioContext|null}
 */
export function sceneContext() {
  try {
    if (!soundOn() || !gestureSeen) return null;
    const c = ensureContext();
    if (!c) return null;
    if (c.state === 'suspended') c.resume().catch(() => {});
    return c;
  } catch { return null; }
}

/**
 * A vibration paired to the same word, under the same rules as play().
 * @param {'tick'|'confirm'|'complete'|'error'} name
 */
export function haptic(name) {
  try {
    if (!soundOn() || !gestureSeen) return;
    if (typeof navigator?.vibrate !== 'function') return;
    const pattern = patternFor(name);
    if (pattern) navigator.vibrate(pattern);
  } catch { /* haptic() never throws */ }
}

/** Test-only: forget the cached switch value and the audio context, so tests don't leak state into each other. */
export function _resetForTests() { cachedOn = null; ctx = null; gestureSeen = false; }
