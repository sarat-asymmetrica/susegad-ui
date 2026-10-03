// The type tier's pure half: Pretext's lines, laid into the shapes a scene draws.
//
// Pretext (vendored, decision 0019) decides where each line breaks; this file
// decides where each line goes. A scene describes a surface as a shape: for a
// band of the page from `top` to `bottom` it answers the room there, { x, w },
// in the scene's logical units. The text is laid one line at a time through
// those bands (one width per line), at the size it will really be seen, and
// the lines come back as boxes in logical units: the renderer keeps them calm,
// the words layer places a span on each, and a check samples the pixels under
// them. No DOM here; the only thing Pretext touches is a canvas to measure
// with, and the tests give it a fake one.

import {
  prepareWithSegments, layoutNextLineRange, materializeLineRange, measureLineStats,
} from './vendor/pretext.js';

export const START = Object.freeze({ segmentIndex: 0, graphemeIndex: 0 });

const cache = new Map();
/** Pretext's prepared text for (text, font), kept: preparing is the expensive half. */
export function prepare(text, font) {
  const key = `${font}\u0000${text}`;
  let p = cache.get(key);
  if (!p) {
    if (cache.size > 256) cache.delete(cache.keys().next().value);
    cache.set(key, (p = prepareWithSegments(text, font)));
  }
  return p;
}

// ── Shapes: the room on a surface for one band of lines ───────────────────

/** A plain board: a rectangle, less `pad` all round. */
export function rect(x, y, w, h, pad = 0) {
  return (top, bottom) => (top < y + pad - 1e-6 || bottom > y + h - pad + 1e-6 ? null : { x: x + pad, w: w - 2 * pad });
}

/**
 * A round-topped board or a window's arch: straight sides, and a half-ellipse
 * `rise` tall across the top. The top lines are narrower; each band gets the
 * width at its own upper edge, where the arch is tightest.
 */
export function arch(x, y, w, h, rise, pad = 0) {
  const cx = x + w / 2, spring = y + rise;
  return (top, bottom) => {
    if (top < y + pad - 1e-6 || bottom > y + h - pad + 1e-6) return null;
    let half = w / 2;
    if (top < spring) { const d = (spring - top) / rise; half = (w / 2) * Math.sqrt(Math.max(0, 1 - d * d)); }
    half -= pad;
    return half > 0 ? { x: cx - half, w: 2 * half } : null;
  };
}

/** A sign leaning over: its edges move `lean` units across for every unit down. */
export function slant(x, y, w, h, lean, pad = 0) {
  return (top, bottom) => {
    if (top < y + pad - 1e-6 || bottom > y + h - pad + 1e-6) return null;
    const l = Math.max(x + lean * (top - y), x + lean * (bottom - y)) + pad;
    const r = Math.min(x + w + lean * (top - y), x + w + lean * (bottom - y)) - pad;
    return r > l ? { x: l, w: r - l } : null;
  };
}

// ── Laying text into a shape ──────────────────────────────────────────────

/**
 * Lay blocks of text (a heading, then paragraphs) into a shape, one line at a
 * time. Each block is { prepared, lineHeight, gap?, align? } with `prepared`
 * made at the size the words will be seen (CSS px); `scale` is CSS px per
 * logical unit, so widths are compared where they are real and the boxes come
 * back in logical units.
 *
 * A band narrower than `minWidth` (logical) is skipped, not squeezed. A line
 * that had to break inside a word (Pretext's overflow-wrap) marks the layout
 * as not fitting: on a drawn surface a broken word is a sign the size is wrong.
 *
 * @returns {{ lines: Array<{ block: number, text: string, x: number, y: number, w: number, h: number }>,
 *   fits: boolean, bottom: number }}
 */
export function layIntoShape(blocks, shape, { top, bottom, scale = 1, minWidth = 0 } = {}) {
  const lines = [];
  let y = top, fits = true;
  blocks.forEach((b, i) => {
    if (!fits) return;
    const lh = b.lineHeight / scale;
    if (i > 0) y += (b.gap ?? 0) / scale;
    let cursor = START;
    for (let guard = 0; guard < 400; guard++) {
      if (y + lh > bottom + 1e-6) { fits = false; return; }
      const band = shape(y, y + lh);
      if (!band || band.w < minWidth) { y += lh / 4; continue; } // no room here yet: step down a little
      const range = layoutNextLineRange(b.prepared, cursor, band.w * scale);
      if (range === null) return;
      if (brokeInsideWord(b.prepared, range)) fits = false;
      const w = range.width / scale;
      const text = materializeLineRange(b.prepared, range).text;
      const x = b.align === 'center' ? band.x + (band.w - w) / 2 : band.x;
      lines.push({ block: i, text, x, y, w, h: lh });
      cursor = range.end;
      y += lh;
    }
    fits = false; // the guard ran out: something is wrong with the shape
  });
  return { lines, fits, bottom: y };
}

/** Did this line end partway through a word (not at a space, a hyphen or the text's end)? */
function brokeInsideWord(prepared, range) {
  const { end } = range;
  if (end.graphemeIndex === 0) return false;
  const seg = prepared.segments[end.segmentIndex];
  return !!seg && !/^\s/u.test(seg);
}

/**
 * The largest size that lays every block into the shape. `sizes` are tried in
 * order (largest first); `build(size)` returns the blocks at that size. Sizes
 * below the minimum should not be in the list: null means the surface can't
 * hold the words legibly, and they belong in the flat reading.
 */
export function fitSize(sizes, build, shape, opts) {
  // a size that fits leaves every smaller one fitting, so search by halves: each try prepares the text anew
  let lo = 0, hi = sizes.length - 1, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, laid = layIntoShape(build(sizes[mid]), shape, opts);
    if (laid.fits) { best = { size: sizes[mid], ...laid }; hi = mid - 1; } else lo = mid + 1;
  }
  return best;
}

/**
 * Set a heading and paragraphs on a surface: the largest base size from
 * `sizes` (CSS px, largest first) at which every block fits `shape`, each
 * block at `ratio` times the base, centred across, and (valign 'middle')
 * centred down the room that is left. `specs` are [{ tag, text, ratio? }].
 * Returns { size, lines, blocks: [{ tag, px, lineHeight }] } or null.
 */
export function setBlocks(specs, shape, { sizes, family, weight = 400, leading = 1.22, gap = 0.5, top, bottom, scale = 1, minWidth = 0, valign = 'middle', align = 'center' }) {
  const build = size => specs.map((s, i) => {
    const px = +(size * (s.ratio ?? 1)).toFixed(2);
    return { tag: s.tag, px, prepared: prepare(s.text, `${weight} ${px}px ${family}`), lineHeight: +(px * leading).toFixed(2), gap: i ? size * gap : 0, align };
  });
  const fit = fitSize(sizes, build, shape, { top, bottom, scale, minWidth });
  if (!fit) return null;
  const blocks = build(fit.size);
  // centre down the room: moving down a shape that widens re-wraps the text, so settle the gap above against the gap below
  let best = fit, dy = 0;
  for (let k = 0; valign === 'middle' && k < 6; k++) {
    const next = (dy + Math.max(0, bottom - best.bottom)) / 2;
    if (Math.abs(next - dy) < 0.5) break;
    const moved = layIntoShape(blocks, shape, { top: top + next, bottom, scale, minWidth });
    if (!moved.fits) break;
    best = moved; dy = next;
  }
  return { size: fit.size, lines: best.lines, blocks: blocks.map(({ tag, px, lineHeight }) => ({ tag, px, lineHeight })) };
}

/** A label's box on a drawn plaque, in CSS px: its words plus padding, never under the 24 px target. */
export function labelBox(text, font, px, { pad = 0.7, tall = 1.7, target = 24 } = {}) {
  const { width } = shrinkWrap(prepare(text, font), 1e5);
  return { w: Math.max(target, width + px * pad * 2), h: Math.max(target, px * tall) };
}

// ── Cards: shrink-wrapped and balanced ─────────────────────────────────────

/** The tightest width that keeps the lines at `maxWidth` (the widest line there). */
export function shrinkWrap(prepared, maxWidth) {
  const { lineCount, maxLineWidth } = measureLineStats(prepared, maxWidth);
  return { width: maxLineWidth, lines: lineCount };
}

/**
 * The narrowest width that keeps the same number of lines as `maxWidth`: the
 * lines come out as even as they can, with no short last line hanging alone.
 */
export function balance(prepared, maxWidth) {
  const want = measureLineStats(prepared, maxWidth).lineCount;
  let lo = 0, hi = maxWidth;
  for (let k = 0; k < 20 && hi - lo > 0.5; k++) {
    const mid = (lo + hi) / 2;
    if (measureLineStats(prepared, mid).lineCount <= want) hi = mid; else lo = mid;
  }
  return shrinkWrap(prepared, hi);
}

/** Line boxes as calm rects for a renderer, padded a little. */
export const calmOf = (lines, pad = 2) => lines.map(l => ({ x: l.x - pad, y: l.y - pad, w: l.w + 2 * pad, h: l.h + 2 * pad }));
