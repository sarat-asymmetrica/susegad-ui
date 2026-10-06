// gallery.core.js: the gallery's logic as pure functions, testable in Node.
// Nothing here touches the DOM; the element and the skins call these.

/** The consent states a slot can be read as, and what each shows. */
export const CONSENT = {
  pending: 'pending',   // the person has not said yes: a drawn frame, the caption, the count, never the image
  granted: 'granted',   // they said yes: the image shows, and it opens in a dialog
  author: 'author',     // no consent attribute at all: the author's decision, the image shows
};

/**
 * What a slot's `consent` attribute means. Only the written word "pending"
 * hides a photograph: the element never guesses. Anything else (a missing
 * attribute, "granted", a value the code does not know) shows the image,
 * because that is what the author wrote.
 * @param {string|null} raw
 * @returns {'pending' | 'granted' | 'author'}
 */
export function consentOf(raw) {
  if (raw == null) return CONSENT.author;
  const v = String(raw).trim().toLowerCase();
  if (v === 'pending') return CONSENT.pending;
  if (v === 'granted') return CONSENT.granted;
  return CONSENT.author;
}

/**
 * The count line for n photographs waiting for consent. Kind, exact, short.
 * @param {number} n whole number of pending photographs
 * @returns {string} "1 photo, coming soon" / "2 photos, coming soon"; "" for none
 */
export function pendingLine(n) {
  if (!Number.isFinite(n) || n < 1) return '';
  return `${Math.round(n)} ${n === 1 ? 'photo' : 'photos'}, coming soon`;
}

/**
 * How many columns a grid of `count` photographs wants at `width` px wide,
 * so a slot never drops under about 9rem: the smallest photograph still reads.
 * @param {number} width the gallery's own width in px
 * @param {number} count how many slots it holds
 * @returns {number} 1 to 4
 */
export function columnsFor(width, count) {
  if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(count) || count < 1) return 1;
  const byWidth = width < 26 * 16 ? 1 : width < 40 * 16 ? 2 : width < 60 * 16 ? 3 : 4;
  return Math.max(1, Math.min(byWidth, Math.round(count)));
}

/**
 * Seeded hash: the same seed always gives the same number, which is what
 * makes the frames and the tilts deterministic (axiom A5).
 * @param {string} seed
 * @returns {number} 0 to 1
 */
export function hash(seed) {
  let h = 2166136261;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}

/**
 * The playful tilt of a photograph laid on a table: a seeded half-degree,
 * signed. Under reduced motion the CSS never applies it.
 * @param {string} seed
 * @returns {number} -0.55 to +0.55 degrees
 */
export function tilt(seed) {
  const r = hash(seed);
  const sign = r < 0.5 ? -1 : 1;
  const lean = 0.2 + hash(`${seed}~`) * 0.35; // 0.2 to 0.55 degrees, never flat by accident
  return sign * lean;
}

/**
 * One hand-drawn photo corner for a frame w x h, corner a ("tl" | "tr" | "br" | "bl"),
 * wobbled a little by the seed so no two frames are stamped identically.
 * Returns an SVG path (in the frame's own coordinates) the warm and playful
 * skins can draw inside an aria-hidden SVG.
 * @param {{ w: number, h: number, corner: string, seed?: string, pad?: number }}
 * @returns {string} a path string, "M…"
 */
export function photoCorner({ w, h, corner, seed = 'frame', pad = 10 }) {
  const r = hash(`${seed}:${corner}`);
  const wobble = (i, k = 2.2) => Math.sin(r * 40 + i * 2.7) * k;
  const L = Math.min(w, h) * 0.22 + 10 + wobble(0, 3);
  const x = corner.includes('l') ? pad : w - pad;
  const y = corner.startsWith('t') ? pad : h - pad;
  const sx = corner.includes('l') ? 1 : -1;
  const sy = corner.startsWith('t') ? 1 : -1;
  const longX = { x: x + sx * L, y: y + sy * (1.5 + wobble(1)) };
  const longY = { x: x + sx * (1.5 + wobble(2)), y: y + sy * L };
  const mid = { x: x + sx * (L * 0.34), y: y + sy * (L * 0.34) };
  // two strokes out of the corner with a soft elbow between them
  return `M ${longX.x.toFixed(2)} ${longX.y.toFixed(2)} Q ${mid.x.toFixed(2)} ${mid.y.toFixed(2)} ${(x + sx * 2).toFixed(2)} ${(y + sy * 2).toFixed(2)} Q ${mid.x.toFixed(2)} ${mid.y.toFixed(2)} ${longY.x.toFixed(2)} ${longY.y.toFixed(2)}`;
}
