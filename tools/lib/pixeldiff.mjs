// Pixel comparison maths. Pure and dependency-free, so diff.mjs runs it inside
// the browser on canvas ImageData, and node:test runs it on plain arrays.

/**
 * Perceptual-ish distance between two RGBA pixels in [0, 1]:
 * a weighted RGB distance (the "redmean" approximation), alpha blended over white.
 */
export function pixelDistance(r1, g1, b1, a1, r2, g2, b2, a2) {
  const blend = (c, a) => 255 + (c - 255) * (a / 255);
  r1 = blend(r1, a1); g1 = blend(g1, a1); b1 = blend(b1, a1);
  r2 = blend(r2, a2); g2 = blend(g2, a2); b2 = blend(b2, a2);
  const rm = (r1 + r2) / 2;
  const dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
  const d = Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  return d / 764.8339663572415; // the distance between black and white
}

/**
 * Compare two RGBA buffers of the same size.
 * @param {ArrayLike<number>} a
 * @param {ArrayLike<number>} b
 * @param {number} width
 * @param {number} height
 * @param {{ threshold?: number, maxRatio?: number }} [opts]
 *   threshold: per-pixel distance above which a pixel counts as changed (default 0.02)
 *   maxRatio:  share of changed pixels allowed before the diff fails (default 0.001)
 * @returns {{ changed: number, total: number, ratio: number, maxDistance: number, pass: boolean,
 *   bbox: null | { x: number, y: number, w: number, h: number }, diff: Uint8ClampedArray }}
 *   diff is an RGBA image: a faded copy of b with changed pixels in vermilion.
 */
export function comparePixels(a, b, width, height, { threshold = 0.02, maxRatio = 0.001 } = {}) {
  const total = width * height;
  if (a.length !== total * 4 || b.length !== total * 4) throw new Error('buffer size does not match width x height');
  const diff = new Uint8ClampedArray(total * 4);
  let changed = 0, maxDistance = 0;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let i = 0, p = 0; p < total; p++, i += 4) {
    const d = pixelDistance(a[i], a[i + 1], a[i + 2], a[i + 3], b[i], b[i + 1], b[i + 2], b[i + 3]);
    if (d > maxDistance) maxDistance = d;
    if (d > threshold) {
      changed++;
      diff[i] = 227; diff[i + 1] = 66; diff[i + 2] = 52; diff[i + 3] = 255;
      const x = p % width, y = (p / width) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    } else {
      // Faded greyscale of the new frame, so the changed pixels read in context.
      const l = 0.299 * b[i] + 0.587 * b[i + 1] + 0.114 * b[i + 2];
      const v = 255 - (255 - l) * 0.25;
      diff[i] = diff[i + 1] = diff[i + 2] = v; diff[i + 3] = 255;
    }
  }
  const ratio = changed / total;
  return {
    changed, total, ratio, maxDistance,
    pass: ratio <= maxRatio,
    bbox: x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
    diff,
  };
}
