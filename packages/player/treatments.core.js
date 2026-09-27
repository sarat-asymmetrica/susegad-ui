// treatments.core.js: the pure maths behind the video treatments (ink,
// halftone, duotone, riso). Colour comes from the tokens in OKLCH; canvas
// and WebGL both want plain sRGB numbers, so this is the one place that
// converts. No DOM; tested in Node.

/** OKLCH to linear sRGB, 0 to 1 per channel (may go outside 0..1 for an out-of-gamut colour; callers clamp). */
export function oklchToLinearSrgb(L, C, H) {
  const hr = (H * Math.PI) / 180;
  const a = Math.cos(hr) * C, b = Math.sin(hr) * C;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

const toGamma = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.abs(c) ** (1 / 2.4) - 0.055);

/** OKLCH to displayable sRGB, 0 to 255 per channel, clamped. */
export function oklchToRgb(L, C, H) {
  return oklchToLinearSrgb(L, C, H).map(c => Math.round(Math.min(1, Math.max(0, toGamma(c))) * 255));
}

/** OKLCH to a `#rrggbb` hex string, for canvas fillStyle and CSS. */
export function oklchToHex(L, C, H) {
  return '#' + oklchToRgb(L, C, H).map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Relative luminance (Rec. 601, cheap and fine for a duotone map) from linear-light RGB in 0..1. */
export const luma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Which halftone cell a pixel falls in, and its offset from the cell's
 * centre, on a grid rotated by `angle` (radians). Pure geometry: rotate into
 * the grid's frame, find the cell, rotate the offset back.
 * @param {number} x @param {number} y @param {number} cell cell size in the same units as x, y
 * @param {number} angle @returns {{ cx: number, cy: number, dx: number, dy: number, dist: number }}
 */
export function halftoneCell(x, y, cell, angle = Math.PI / 4) {
  const ca = Math.cos(angle), sa = Math.sin(angle);
  const rx = x * ca + y * sa, ry = -x * sa + y * ca;
  const gx = Math.floor(rx / cell) * cell + cell / 2, gy = Math.floor(ry / cell) * cell + cell / 2;
  const drx = rx - gx, dry = ry - gy;
  // centre back to world space
  const cx = gx * ca - gy * sa, cy = gx * sa + gy * ca;
  const dx = drx * ca - dry * sa, dy = drx * sa + dry * ca;
  return { cx, cy, dx, dy, dist: Math.hypot(drx, dry) };
}

/**
 * A halftone dot's radius for a tone (0 black, 1 white) at a cell of the given size:
 * the classic area-proportional dot, capped so cells never fully touch.
 * @param {number} tone 0 (fully covered) to 1 (empty) @param {number} cell
 */
export function halftoneRadius(tone, cell) {
  return Math.min(cell * 0.5 * 0.98, (cell * 0.5) * Math.sqrt(Math.max(0, 1 - tone)));
}

/** Mix two colours (each `[r,g,b]`, 0..255) by a luminance-derived tone, 0 (colorA) to 1 (colorB). */
export function duotoneMix(tone, colorA, colorB) {
  const t = Math.min(1, Math.max(0, tone));
  return [0, 1, 2].map(i => Math.round(colorA[i] + (colorB[i] - colorA[i]) * t));
}

/** The channel offsets (in pixels) for a riso-style misregistration, seeded so it repeats. */
export function risoOffsets(seed = 0) {
  const s = (n) => { const v = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453; return v - Math.floor(v); };
  const a = (i) => (s(i) - 0.5) * 3.2;
  return { cyan: [a(1), a(2)], magenta: [a(3), a(4)], yellow: [a(5), a(6)] };
}

export const TREATMENTS = ['ink', 'halftone', 'duotone', 'riso'];

/** Is `name` a treatment this module knows how to render? */
export const isTreatment = name => TREATMENTS.includes(name);
