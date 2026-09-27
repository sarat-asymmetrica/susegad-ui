// hatch.js: Path2D, hatching and pigment wash. Canvas edge.
import { rng } from './rng.js';
import { bbox } from './geom.js';
import { grainPattern } from './paper.js';

/** Points → Path2D. @param {import('./math.js').Point[]} pts @param {boolean} [closed] */
export function toPath(pts, closed = true) {
  const path = new Path2D();
  pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
  if (closed) path.closePath();
  return path;
}

/**
 * Hatching: fill a shape with short parallel strokes instead of flat colour.
 * shape is a Path2D (pass `bounds`) or an array of points.
 * `density(x, y)` → 0..1 lets tone vary: 1 draws every stroke, 0.2 draws a few.
 * @param {CanvasRenderingContext2D} g @param {Path2D | import('./math.js').Point[]} shape
 */
export function hatch(g, shape, {
  angle = -Math.PI / 4, spacing = 5, width = 0.9, color = '#1d2742', alpha = 0.75, seed = 0,
  jitter = 0.35, seg = [8, 22], gap = 0.3, wobble = 0.9, density = null, bounds = null,
} = {}) {
  const isPath = shape instanceof Path2D;
  const path = isPath ? shape : toPath(shape, true);
  let b = bounds || (!isPath && bbox(shape));
  if (!b) { const m = g.getTransform(); b = { x: 0, y: 0, w: g.canvas.width / m.a, h: g.canvas.height / m.d }; }
  const r = rng(seed + 0.5), ca = Math.cos(angle), sa = Math.sin(angle);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, D = Math.hypot(b.w, b.h) / 2 + 4;
  g.save();
  g.clip(path);
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.globalAlpha *= alpha;
  g.beginPath();
  for (let o = -D; o <= D; o += spacing * (1 + (r() - 0.5) * jitter)) {
    let u = -D + r() * seg[0];
    while (u < D) {
      const len = seg[0] + r() * (seg[1] - seg[0]);
      const u2 = Math.min(D, u + len);
      const o1 = o + (r() - 0.5) * spacing * 0.3, o2 = o1 + (r() - 0.5) * wobble;
      const x1 = cx + ca * u - sa * o1, y1 = cy + sa * u + ca * o1;
      const x2 = cx + ca * u2 - sa * o2, y2 = cy + sa * u2 + ca * o2;
      const bend = (r() - 0.5) * wobble * 1.5;
      const keep = !density || r() < density((x1 + x2) / 2, (y1 + y2) / 2);
      if (keep) { g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2 - sa * bend, (y1 + y2) / 2 + ca * bend, x2, y2); }
      u = u2 + len * gap * r();
    }
  }
  g.stroke();
  g.restore();
}

/** Flat pigment fill with pencil texture, for colour under hatching.
 *  @param {CanvasRenderingContext2D} g @param {Path2D | import('./math.js').Point[]} shape */
export function wash(g, shape, { color = '#d9a21b', alpha = 0.6, bounds = null, grainy = true } = {}) {
  const path = shape instanceof Path2D ? shape : toPath(shape, true);
  g.save();
  g.globalAlpha *= alpha;
  g.fillStyle = grainy ? grainPattern(g, color, { lo: 0.55, hi: 1 }) : color;
  g.fill(path);
  g.restore();
}
