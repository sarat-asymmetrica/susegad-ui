// Folio build: fonts, subset to the characters the document uses. One face per
// script already (the tokens split them with unicode-range); each face keeps only
// the characters of its range that the document shows, and a face the document
// never uses is left out entirely.

import subsetFont from 'subset-font';
import { charsIn } from './assets.mjs';

/** Always kept in a face that covers Latin: every printable ASCII character and common marks, for typed input and for the seal. */
export const LATIN_BASE = String.fromCharCode(...Array.from({ length: 95 }, (_, i) => 32 + i)) + ' ‘’“”–…₹·×→←✓';

/**
 * @param {Buffer} font  the face's WOFF2
 * @param {[number, number][]} ranges  its unicode-range
 * @param {string} chars  the characters this face draws in the document
 * @returns {Promise<{ buf: Buffer | null, chars: string }>} null when the face draws nothing
 */
export async function subsetFace(font, ranges, chars) {
  if (!chars.replace(/\s/g, '')) return { buf: null, chars: '' };
  // A Latin face that is used at all also keeps printable ASCII and common marks:
  // for typed input, printed link addresses and the seal.
  const latin = ranges.some(([a, b]) => a <= 0x41 && b >= 0x7a);
  const all = charsIn(chars + (latin ? LATIN_BASE : ''), ranges);
  return { buf: await subsetFont(font, all, { targetFormat: 'woff2' }), chars: all };
}
