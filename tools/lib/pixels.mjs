// The pixel module: every comparison of two pictures in the tools, on one rule. Pure and dependency-free,
// so it runs in Node (node:test, print-check) and inside a page (strip and onion import it from the browser
// over the dev server, on canvas ImageData). Tested in pixels.test.mjs; pixeldiff.test.mjs, strip.test.mjs and
// pixelcheck.test.mjs still run against the old paths, which re-export from here.
//
// THE RULE. Two pixels differ by `pixelDistance`: alpha blended over white, then the "redmean" weighted RGB
// distance, scaled to 0 (equal) .. 1 (black against white). It replaces two rules that disagreed (pixeldiff's
// redmean at 0.02, graduation's pixelcheck summing |dR|+|dG|+|dB| above 60 and ignoring alpha). One metric, two
// named thresholds, because the two jobs want different blindness:
//
//   CHANGED_THRESHOLD = 0.02  "did the picture move?" (strip, onion, regression diffs). Blind to a one or two
//                             level wobble (dither, JPEG ringing on a re-encoded still); catches any real
//                             colour step, including a faint ghost of a fading layer.
//   LAYER_THRESHOLD   = 0.08  "which pixels did this layer draw?" (diffMask, print-check). Blind to everything
//                             the 0.02 rule still sees as texture: grain, dithering, a pale antialiasing fringe
//                             (an edge pixel under about 8% coverage of black ink), colour-managed rounding.
//                             Catches ink: any glyph, line or fill a reader would see on the page, down to
//                             pale gold on cream. A grey step of 20 levels is the line (the old "sum above 60",
//                             which is 3 x 20 for a grey), so the numbers graduation measured keep meaning.
//
// Alpha counts in both: a transparent pixel reads as white paper, so a layer drawn on a cleared canvas and the
// same layer composed over white agree. (A white layer on transparent is invisible to it; use `alphaMask` for
// the pixels a layer touched, whatever their colour.)
//
// Thresholds are distances in [0, 1] everywhere (the old diffMask took a sum of channel differences).
//
// Parts: distance and comparison; frame maths for strip and onion (luminance, per-step change, the still median,
// the blends); and print agreement (masks, rasterised shapes, the share of ink inside a prediction, with a
// slid-prediction control that must fall).

// ── distance and comparison ───────────────────────────────────────────────

/** The two thresholds of the rule above, as distances in [0, 1]. */
export const CHANGED_THRESHOLD = 0.02;
export const LAYER_THRESHOLD = 0.08;

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
export function comparePixels(a, b, width, height, { threshold = CHANGED_THRESHOLD, maxRatio = 0.001 } = {}) {
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

// ── frame maths (strip and onion) ─────────────────────────────────────────

/** Mean luminance of an RGBA buffer, 0 (black) to 1 (white); Rec. 709 weights on the sRGB values. */
export function meanLuminance(data) {
  let sum = 0;
  const px = data.length / 4;
  for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  return px ? sum / px / 255 : 0;
}

/**
 * Per cell: mean luminance, and how much of the picture changed against the cell before
 * (share of pixels, their count, and the box round them).
 * @param {{ data: ArrayLike<number> }[]} frames RGBA frames of one size
 */
export function analyseFrames(frames, width, height, { threshold = 0.02 } = {}) {
  return frames.map((f, i) => {
    const luminance = meanLuminance(f.data);
    if (i === 0) return { luminance, changed: null, changedPixels: null, bbox: null };
    const r = comparePixels(frames[i - 1].data, f.data, width, height, { threshold });
    return { luminance, changed: r.ratio, changedPixels: r.changed, bbox: r.bbox };
  });
}

/** The still background: the per-pixel, per-channel median of the frames. */
export function medianFrame(frames, width, height) {
  const n = frames.length, out = new Uint8ClampedArray(width * height * 4), v = new Array(n);
  if (!n) return out;
  for (let i = 0; i < out.length; i++) {
    if ((i & 3) === 3) { out[i] = 255; continue; }
    for (let k = 0; k < n; k++) {
      const x = frames[k].data[i];
      let j = k;
      while (j > 0 && v[j - 1] > x) { v[j] = v[j - 1]; j--; }
      v[j] = x;
    }
    out[i] = n & 1 ? v[n >> 1] : Math.round((v[n / 2 - 1] + v[n / 2]) / 2);
  }
  return out;
}

/** Opacity of each frame, oldest faintest, newest solid. */
export function onionAlphas(n, floor = 0.2) {
  return Array.from({ length: n }, (_, i) => (n === 1 ? 1 : floor + ((1 - floor) * i) / (n - 1)));
}

/**
 * The onion: the still background, then each frame's moving pixels laid over it, oldest first, at
 * rising opacity. Where a frame agrees with the background nothing is drawn, so a still scene
 * stays exact and a moving thing leaves a trail whose spacing shows its path and easing.
 * @returns {Uint8ClampedArray} RGBA
 */
export function onionBlend(frames, background, width, height, alphas = onionAlphas(frames.length), threshold = 0.02) {
  const out = new Uint8ClampedArray(background);
  const px = width * height;
  frames.forEach((f, k) => {
    const a = alphas[k], d = f.data;
    for (let p = 0, i = 0; p < px; p++, i += 4) {
      if (pixelDistance(d[i], d[i + 1], d[i + 2], 255, background[i], background[i + 1], background[i + 2], 255) <= threshold) continue;
      out[i] = out[i] * (1 - a) + d[i] * a;
      out[i + 1] = out[i + 1] * (1 - a) + d[i + 1] * a;
      out[i + 2] = out[i + 2] * (1 - a) + d[i + 2] * a;
    }
  });
  return out;
}

/**
 * The onion's `--diff` form: only what changes. A faded copy of the last frame, and over it
 * every step's changed pixels in vermilion, older steps fainter (the step into frame k is drawn at
 * alpha[k]). Uses pixeldiff's distance and threshold, so a pixel counts as changed exactly when
 * `comparePixels` would count it.
 */
export function onionDiff(frames, width, height, alphas = onionAlphas(frames.length), threshold = 0.02) {
  const last = frames[frames.length - 1].data, px = width * height, out = new Uint8ClampedArray(px * 4);
  for (let p = 0, i = 0; p < px; p++, i += 4) {
    const l = 0.299 * last[i] + 0.587 * last[i + 1] + 0.114 * last[i + 2];
    out[i] = out[i + 1] = out[i + 2] = 255 - (255 - l) * 0.25;
    out[i + 3] = 255;
  }
  for (let k = 1; k < frames.length; k++) {
    const a = alphas[k], A = frames[k - 1].data, B = frames[k].data;
    for (let p = 0, i = 0; p < px; p++, i += 4) {
      if (pixelDistance(A[i], A[i + 1], A[i + 2], A[i + 3], B[i], B[i + 1], B[i + 2], B[i + 3]) <= threshold) continue;
      out[i] = out[i] * (1 - a) + 227 * a;
      out[i + 1] = out[i + 1] * (1 - a) + 66 * a;
      out[i + 2] = out[i + 2] * (1 - a) + 52 * a;
    }
  }
  return out;
}

// ── print agreement (print-check, graduation's pixelcheck) ────────────────
// Do the pixels a scene drew agree with where its own model says they are? No browser, no canvas: the caller grabs
// RGBA buffers (getImageData, a screenshot decode) and hands this the predicted shapes.
//
// The lab's recipe: repaint a frame with and without a layer, `diffMask` the two to get that layer's pixels,
// `rasterize` the predicted boxes or outline, and compare with `share`. A control slides the prediction
// (`shiftShapes`) and must fall. Shapes are polygons ([[x, y], ...]) or boxes ({ x, y, w, h }), in the same pixel units as the buffer.

/**
 * Pixels where two RGBA buffers differ by more than `threshold`, a `pixelDistance` (default LAYER_THRESHOLD): a layer's
 * ink, from the frame with it and the same frame without. A Uint8Array of 0/1.
 */
export function diffMask(a, b, threshold = LAYER_THRESHOLD) {
  if (a.length !== b.length) throw new RangeError(`buffers differ in length (${a.length} vs ${b.length})`);
  const out = new Uint8Array(a.length >> 2);
  for (let k = 0, p = 0; k < a.length; k += 4, p++) {
    out[p] = pixelDistance(a[k], a[k + 1], a[k + 2], a[k + 3], b[k], b[k + 1], b[k + 2], b[k + 3]) > threshold ? 1 : 0;
  }
  return out;
}

/** Pixels whose alpha is non-zero (a layer drawn on a cleared canvas). */
export function alphaMask(rgba) {
  const out = new Uint8Array(rgba.length >> 2);
  for (let k = 3, p = 0; k < rgba.length; k += 4, p++) out[p] = rgba[k] ? 1 : 0;
  return out;
}

const toPoly = s => (Array.isArray(s) ? s : [[s.x, s.y], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]]);

/** The shapes slid by (dx, dy): the red control for any agreement claim. */
export const shiftShapes = (shapes, dx, dy) => shapes.map(s => toPoly(s).map(([x, y]) => [x + dx, y + dy]));

/** Fill the shapes (union, even-odd per shape, sampled at pixel centres) into a w x h mask of 0/1. */
export function rasterize(shapes, w, h) {
  const m = new Uint8Array(w * h);
  for (const s of shapes) {
    const poly = toPoly(s), n = poly.length;
    for (let y = 0; y < h; y++) {
      const yc = y + 0.5, xs = [];
      for (let i = 0; i < n; i++) {
        const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n];
        if ((y0 <= yc) !== (y1 <= yc)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const from = Math.max(0, Math.ceil(xs[i] - 0.5)), to = Math.min(w - 1, Math.ceil(xs[i + 1] - 0.5) - 1);
        for (let x = from; x <= to; x++) m[y * w + x] = 1;
      }
    }
  }
  return m;
}

/** Grow a mask by r pixels (square neighbourhood); a negative r erodes it. */
export function grow(mask, w, h, r) {
  if (!r) return mask;
  const want = r > 0 ? 1 : 0, rr = Math.abs(r), pass = (src, horizontal) => {
    const out = new Uint8Array(src.length), len = horizontal ? w : h, lines = horizontal ? h : w;
    for (let l = 0; l < lines; l++) for (let i = 0; i < len; i++) {
      let hit = want ? 0 : 1;
      for (let d = -rr; d <= rr; d++) {
        const j = i + d, v = j < 0 || j >= len ? (want ? 0 : 1) : src[horizontal ? l * w + j : j * w + l]; // the frame edge is neither ink nor hole
        if (want ? v : !v) { hit = want ? 1 : 0; break; }
      }
      out[horizontal ? l * w + i : i * w + l] = hit;
    }
    return out;
  };
  return pass(pass(mask, true), false);
}

/** Pixels set in both masks. */
export function both(a, b) {
  const out = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] & b[i];
  return out;
}

export const count = m => { let n = 0; for (let i = 0; i < m.length; i++) n += m[i]; return n; };

/** The share of `mask`'s pixels that fall inside `region` (0 when `mask` is empty). */
export function share(mask, region) {
  const n = count(mask);
  return n ? count(both(mask, region)) / n : 0;
}

/**
 * How well drawn pixels agree with a predicted region.
 *   inside:  share of the drawn pixels that lie in the prediction (the drawing is where the model says)
 *   covered: share of the predicted pixels that were drawn (the model's region is really filled)
 *   spill:   share of the drawn pixels outside the prediction grown by `tolerance` px
 */
export function agreement(drawn, predicted, w, h, { tolerance = 0 } = {}) {
  return {
    drawnPixels: count(drawn),
    predictedPixels: count(predicted),
    inside: share(drawn, predicted),
    covered: share(predicted, drawn),
    spill: count(drawn) ? 1 - share(drawn, grow(predicted, w, h, tolerance)) : 0,
  };
}
