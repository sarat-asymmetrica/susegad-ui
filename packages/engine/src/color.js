// color.js: hex colour helpers. Pure.
import { lerp } from './math.js';

/** '#rgb' or '#rrggbb' → [r, g, b] in 0..255. @param {string} hex @returns {[number, number, number]} */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
/** @type {(hex: string, a?: number) => string} */
export const rgba = (hex, a = 1) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
/** Mix two hex colours; returns an rgb() string. @param {string} a @param {string} b @param {number} t */
export function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))})`;
}
