// The greeting card: the pure core. Runs in Node.
//
// What a card is (its size, its colours, where each thing goes), how a line of text is broken to fit, which image
// type a set of bytes really is, and what the file should be called. Decision 0023 settles the formats: PNG to
// save, JPG to share, and an export reports the type it actually produced, because a browser that cannot encode
// the type asked for hands back PNG, and the file name must follow the bytes.

/** Portrait 4:5, the shape a phone shows a shared picture in without cropping it. */
export const CARD = Object.freeze({ width: 1080, height: 1350 });

/** The purposes an export serves, and the type each one asks for (0023). */
export const PURPOSES = Object.freeze({ save: 'image/png', share: 'image/jpeg' });
export const JPEG_QUALITY = 0.92;

/** A card is paper and ink, the same on a light page and a dark one: it is a thing to keep, not a part of the page. */
export const PALETTE = Object.freeze({ paper: '#f3ebdc', ink: '#2b2118', soft: '#6b5a48', rule: '#c9b79a', dots: '#2b2118' });

const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };

/** The image type a run of bytes really is, by its first bytes. null when it is none we know. @param {Uint8Array} b */
export function sniff(b) {
  const at = (i, ...v) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return 'image/png';
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg';
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp';
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return 'image/gif';
  if (at(4, 0x66, 0x74, 0x79, 0x70) && (at(8, 0x61, 0x76, 0x69, 0x66) || at(8, 0x61, 0x76, 0x69, 0x73))) return 'image/avif';
  return null;
}

/** A name as a file-name word: lower case, letters and digits kept in any script, the rest as single hyphens. */
export function slug(name) {
  const s = String(name ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  return s.slice(0, 40) || 'guest';
}

/** The file name for a card, its extension taken from the type the bytes really are. */
export const fileName = (name, type) => `greeting-card-${slug(name)}.${EXT[type] ?? 'bin'}`;

/**
 * Break a line of text into lines no wider than `maxWidth`, at spaces, using the caller's `measure` (canvas
 * measureText in the browser, a stub in Node). A word wider than the line stays whole on its own line.
 * @param {string} text @param {(s: string) => number} measure @param {number} maxWidth @param {number} [maxLines]
 */
export function wrap(text, measure, maxWidth, maxLines = 4) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean), lines = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (!line || measure(next) <= maxWidth) line = next;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] += '…'; return keep; }
  return lines;
}

/** The largest font size, from `max` down to `min`, at which `text` fits on one line of `maxWidth`. */
export function fitSize(text, measureAt, maxWidth, { max = 96, min = 44 } = {}) {
  for (let s = max; s > min; s -= 2) if (measureAt(text, s) <= maxWidth) return s;
  return min;
}

/** The seed a card's bloom is grown from: the name as written, trimmed. Case matters, as it does for the bloom. */
export const seedFor = name => String(name ?? '').trim() || 'guest';

/** Where each part of the card goes, in pixels. */
export function layout({ width, height } = CARD) {
  const bloom = Math.round(width * 0.66);
  return {
    bloom: { size: bloom, x: Math.round((width - bloom) / 2), y: Math.round(height * 0.09) },
    name: { x: width / 2, y: Math.round(height * 0.7), maxWidth: width * 0.78 },
    rule: { y: Math.round(height * 0.735), half: width * 0.07 },
    line: { x: width / 2, y: Math.round(height * 0.78), maxWidth: width * 0.7, size: 50, leading: 70 },
  };
}
