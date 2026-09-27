// OTP: the pure core. Runs in Node.
//
// The code lives in one native input. These functions decide what an edit
// does to it, the way a row of boxes suggests: each box is a slot, so typing
// over a filled box replaces it, backspace empties the box before the caret
// and pulls the rest along, and a paste or an SMS autofill fills every box at
// once from whatever digits are in the text ("Your code is 482 913").

import { rng } from '../../engine/src/rng.js';

/** The component adds no words: the builder's label says what the code is and where it went. */
export const STRINGS = {};

// Zero of each decimal script people may type digits in: ASCII, Arabic-Indic,
// Extended Arabic-Indic, Devanagari, Bengali, Gurmukhi, Gujarati, Odia, Tamil,
// Telugu, Kannada, Malayalam, and full-width.
const ZEROS = [0x30, 0x660, 0x6f0, 0x966, 0x9e6, 0xa66, 0xae6, 0xb66, 0xbe6, 0xc66, 0xce6, 0xd66, 0xff10];

/**
 * `text` with every digit in any of those scripts written as ASCII, everything else kept:
 * '९८२२० १२३४५' becomes '98220 12345'. Shared by the OTP, the booking's phone and the
 * enquiry's contact field, so a number typed in a person's own numerals is ordinary input.
 * @param {unknown} text
 */
export function toAsciiDigits(text) {
  let out = '';
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0), z = ZEROS.find(z => cp >= z && cp <= z + 9);
    out += z === undefined ? ch : String(cp - z);
  }
  return out;
}

/** The digits in `text`, as ASCII, at most `max` of them. @param {unknown} text */
export function digitsOf(text, max = Infinity) {
  let out = '';
  for (const ch of String(text ?? '')) {
    const cp = ch.codePointAt(0), z = ZEROS.find(z => cp >= z && cp <= z + 9);
    if (z !== undefined) out += cp - z;
    if (out.length >= max) break;
  }
  return out;
}

/**
 * How many boxes: the `length` attribute, else the input's maxlength, else a
 * count in its pattern ("[0-9]{6}", "\\d{4}"), else 6. Between 3 and 12.
 * @param {{ length?: string|null, maxlength?: string|number|null, pattern?: string|null }} a
 */
export function lengthOf({ length = null, maxlength = null, pattern = null } = {}) {
  const fromPattern = /\{(\d+)\}\s*\$?$/.exec(pattern ?? '')?.[1];
  for (const v of [length, maxlength > 0 ? maxlength : null, fromPattern]) {
    const n = parseInt(String(v ?? ''), 10);
    if (n > 0) return Math.min(12, Math.max(3, n));
  }
  return 6;
}

/**
 * Put `text` in at the selection, typing over what is there. Only digits go
 * in; a long paste fills from the start of the selection and stops at the end.
 * @returns {{ value: string, caret: number, changed: boolean }}
 */
export function insert(value, start, end, text, length) {
  const d = digitsOf(text, length);
  if (!d) return { value, caret: start, changed: false };
  // a whole code pasted anywhere replaces the whole code
  if (d.length >= length) return { value: d, caret: length, changed: d !== value };
  const next = (value.slice(0, start) + d + value.slice(Math.max(end, start + d.length))).slice(0, length);
  return { value: next, caret: Math.min(start + d.length, length), changed: next !== value };
}

/**
 * Delete: a selection goes; otherwise the digit before the caret (backward)
 * or after it (forward), and the rest move up so the code has no holes.
 * `whole` (a word or line delete) clears everything on that side.
 * @returns {{ value: string, caret: number, changed: boolean }}
 */
export function remove(value, start, end, forward = false, whole = false) {
  let a = start, b = end;
  if (a === b) {
    if (forward) b = whole ? value.length : Math.min(value.length, a + 1);
    else a = whole ? 0 : Math.max(0, a - 1);
  }
  const next = value.slice(0, a) + value.slice(b);
  return { value: next, caret: a, changed: next !== value };
}

/**
 * Which boxes show as current: the selected ones, or the one the caret is in
 * (the last box once the code is full). Empty when the input is not focused.
 * @returns {number[]}
 */
export function activeBoxes(start, end, length, focused) {
  if (!focused) return [];
  if (end > start) return Array.from({ length: Math.min(end, length) - start }, (_, i) => start + i);
  return [Math.min(start, length - 1)];
}

/** Where to break a long code into groups, for reading: 6 → 3 + 3, 8 → 4 + 4, 9 → 3 + 3 + 3. */
export function groupEnds(length) {
  const size = length % 3 === 0 && length > 4 ? 3 : length % 4 === 0 && length > 4 ? 4 : 0;
  return size ? Array.from({ length: length / size - 1 }, (_, i) => (i + 1) * size - 1) : [];
}

/**
 * How each playful stamp sits: a small tilt and nudge, fixed per box, so the
 * row looks stamped by hand. Quiet and warm sit square.
 * @returns {{ rotate: number, x: number, y: number }}
 */
export function boxPose(seed, i, register) {
  if (register !== 'playful') return { rotate: 0, x: 0, y: 0 };
  const r = rng(`otp:${seed}:${i}`);
  return { rotate: +(r.range(-3.5, 3.5)).toFixed(2), x: +(r.range(-1, 1)).toFixed(2), y: +(r.range(-1.5, 1.5)).toFixed(2) };
}

/**
 * A digit landing, as Web Animations keyframes, or null for none. Warm inks
 * it in; playful stamps it down past flat and lets the ink spread.
 * @param {'still'|'state'|'ambient'|'full'} motion
 */
export function landing(motion, rotate = 0) {
  if (motion === 'still' || motion === 'state') return null;
  const t = s => `rotate(${rotate}deg) scale(${s})`;
  if (motion === 'ambient') {
    return { frames: [{ opacity: 0, filter: 'blur(1.5px)', transform: 'scale(1.1)' }, { opacity: 1, filter: 'blur(0)', transform: 'scale(1)' }], timing: { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' } };
  }
  return {
    frames: [
      { opacity: 0, transform: t(1.4), offset: 0 },
      { opacity: 1, transform: t(0.92), offset: 0.55 },
      { opacity: 1, transform: t(1.03), offset: 0.8 },
      { opacity: 1, transform: t(1), offset: 1 },
    ],
    timing: { duration: 320, easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)' },
    spread: { frames: [{ opacity: 0.5, transform: 'scale(0.6)' }, { opacity: 0, transform: 'scale(1.5)' }], timing: { duration: 520, delay: 140, easing: 'ease-out' } },
  };
}
