// annotations.js: draw the ink annotations `activeAnnotations` (from
// annotations.core.js) says are showing, onto a canvas registered over the
// moving video frame. A circle and an arrow, in the engine's own ink line,
// so they read as our drawings and not a UI library's callouts.

import { ink } from '../engine/index.js';
import { activeAnnotations } from './annotations.core.js';

const TAU = Math.PI * 2;

/** A hand-inked circle outline, in normalised units scaled to w, h. */
function circlePoints(x, y, r, w, h) {
  const pts = [], n = 40, rx = r * w, ry = r * h;
  for (let i = 0; i <= n; i++) { const a = (i / n) * TAU; pts.push([x * w + Math.cos(a) * rx, y * h + Math.sin(a) * ry]); }
  return pts;
}

/** A shaft plus a small open arrowhead, in device units. */
function arrowPoints(x1, y1, x2, y2) {
  const shaft = [[x1, y1], [x2, y2]];
  const ang = Math.atan2(y2 - y1, x2 - x1), head = Math.min(18, Math.hypot(x2 - x1, y2 - y1) * 0.3);
  const left = [x2 - head * Math.cos(ang - 0.5), y2 - head * Math.sin(ang - 0.5)];
  const right = [x2 - head * Math.cos(ang + 0.5), y2 - head * Math.sin(ang + 0.5)];
  return { shaft, wing: [left, [x2, y2], right] };
}

/**
 * Draw every annotation active at `time` onto `g` (a `w` × `h` canvas
 * context, cleared by the caller). Colour is one ink colour for every mark;
 * pass `color` as a CSS colour string the ink module accepts (a resolved
 * hex, from `readColors`/`oklchToHex`).
 * @param {CanvasRenderingContext2D} g @param {import('./annotations.core.js').Annotation[]} list
 * @param {number} time @param {number} w @param {number} h @param {{ color?: string, seed?: number }} [opts]
 */
export function drawAnnotations(g, list, time, w, h, { color = '#1d2742', seed = 1 } = {}) {
  for (const a of activeAnnotations(list, time)) {
    g.save();
    g.globalAlpha = a.opacity;
    if (a.type === 'circle') {
      ink(g, circlePoints(a.x, a.y, a.r, w, h), { width: 2.4, color, alpha: 1, closed: true, seed: seed + a.start, jitter: 0.6 });
    } else {
      const { shaft, wing } = arrowPoints(a.x * w, a.y * h, a.x2 * w, a.y2 * h);
      ink(g, shaft, { width: 2.4, color, alpha: 1, seed: seed + a.start, jitter: 0.5, taper: 6 });
      ink(g, wing, { width: 2.2, color, alpha: 1, seed: seed + a.start + 1, jitter: 0.4, closed: false, taper: 0 });
    }
    if (a.label) {
      g.globalAlpha = a.opacity;
      g.fillStyle = color;
      g.font = '13px var(--sg-font-hand, sans-serif)';
      g.textBaseline = 'bottom';
      const lx = a.type === 'circle' ? a.x * w + (a.r * w) + 6 : a.x2 * w + 6;
      const ly = a.type === 'circle' ? a.y * h : a.y2 * h;
      g.fillText(a.label, lx, ly);
    }
    g.restore();
  }
}
