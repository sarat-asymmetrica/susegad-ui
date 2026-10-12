// The type tier's pure geometry: an oracle's lines, laid into the shapes a scene draws.
//
// The oracle (decision 0029; see measure.js) decides how wide the segments are
// and where each line breaks; this file decides where each line goes. A scene
// describes a surface as a shape: for a band of the page from `top` to
// `bottom` it answers the room there, { x, w }, in the scene's logical units.
// The text is laid one line at a time through those bands (one width per
// line), at the size it will really be seen, and the lines come back as boxes
// in logical units: the renderer keeps them calm, the words layer places a span
// on each, and a check samples the pixels under them.
//
// This file imports nothing: no DOM, no canvas, no vendor. `createLayout(oracle)`
// binds it to an oracle, which is
//
//   prepare(text, font)           -> prepared   opaque handle; the expensive half
//   nextLine(prepared, cursor, w) -> { text, width, end, brokeWord } | null
//   stats(prepared, w)            -> { lineCount, maxLineWidth }
//   start                         the cursor of the first line (opaque)
//
// `cursor` and `end` are the oracle's own positions; the core only hands them
// back and never looks inside a prepared handle. `brokeWord` is true when the
// line had to end inside a word (an overflow-wrap), which on a drawn surface
// means the size is wrong.

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

/**
 * An ellipse, centre (cx, cy) and radii rx, ry. `pad` is a margin in the box
 * sense, on every side: a line box laid in the room, grown by `pad` all round,
 * stays inside the true ellipse. Half the ellipse's width is concave in y, so
 * the narrowest row of a band is its top or its bottom edge, and the band's
 * room is the width common to both.
 */
export function ellipse(cx, cy, rx, ry, pad = 0) {
  const half = y => { const d = (y - cy) / ry; return Math.abs(d) > 1 + 1e-9 ? -Infinity : rx * Math.sqrt(Math.max(0, 1 - d * d)); };
  return (top, bottom) => {
    const h = Math.min(half(top - pad), half(bottom + pad)) - pad;
    return h > 1e-6 ? { x: cx - h, w: 2 * h } : null;
  };
}

const NUDGE = 1e-7; // how far inside a band edge or a vertex a cross-section is taken

/** The intervals of a polygon's interior along the horizontal line at y, sorted (even-odd, so a polygon with spikes or notches has several). */
function crossing(points, y) {
  const xs = [];
  for (let i = 0, n = points.length; i < n; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % n];
    if ((y0 <= y) !== (y1 <= y)) xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
  }
  xs.sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i += 2) if (xs[i + 1] > xs[i]) out.push([xs[i], xs[i + 1]]);
  return out;
}

/**
 * Any simple polygon, as [[x, y], ...] (a spiky shout, a cloud's valley ring).
 * The room of a band is the stretch of the polygon's interior that is common to
 * every row of the band grown by `pad` (the same box-sense margin as ellipse):
 * the rows at its two edges and at each vertex between them are intersected,
 * which is exact, because between vertices the sides are straight.
 *
 * A non-convex polygon can cut a row into several stretches. The band starts
 * from the one that holds the polygon's centroid x (or, when the centroid falls
 * in a notch, the widest one), then follows whichever stretch of each next row
 * overlaps it most. A band with no stretch common to all its rows has no room.
 */
export function polygon(points, pad = 0) {
  const n = points.length, ys = points.map(p => p[1]);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  let area = 0, sum = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = points[i], [x1, y1] = points[(i + 1) % n], c = x0 * y1 - x1 * y0;
    area += c; sum += (x0 + x1) * c;
  }
  const anchor = Math.abs(area) > 1e-9 ? sum / (3 * area) : points.reduce((s, p) => s + p[0], 0) / n;
  return (top, bottom) => {
    const t = top - pad, b = bottom + pad;
    if (t < lo - 1e-6 || b > hi + 1e-6) return null;
    const rows = [t + NUDGE];
    for (const y of [...new Set(ys)].sort((p, q) => p - q)) if (y > t + 2 * NUDGE && y < b - 2 * NUDGE) rows.push(y - NUDGE, y + NUDGE);
    rows.push(b - NUDGE);
    const first = crossing(points, rows[0]);
    let run = first.find(([l, r]) => l <= anchor && anchor <= r) ?? first.reduce((a, c) => (!a || c[1] - c[0] > a[1] - a[0] ? c : a), null);
    for (let i = 1; run && i < rows.length; i++) {
      let best = null;
      for (const [l, r] of crossing(points, rows[i])) {
        const cut = [Math.max(l, run[0]), Math.min(r, run[1])];
        if (cut[1] > cut[0] && (!best || cut[1] - cut[0] > best[1] - best[0])) best = cut;
      }
      run = best;
    }
    return run && run[1] - run[0] - 2 * pad > 1e-6 ? { x: run[0] + pad, w: run[1] - run[0] - 2 * pad } : null;
  };
}

// ── Shapes as data ─────────────────────────────────────────────────────────
// A scene model returns plain data and a text gate reads it in Node, so a
// shape also has a descriptor: { kind, ...numbers }. shapeOf turns it into the
// function layIntoShape wants; boundsOf says where it stands.

const KEYS = {
  rect: ['x', 'y', 'w', 'h'],
  arch: ['x', 'y', 'w', 'h', 'rise'],
  slant: ['x', 'y', 'w', 'h', 'lean'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  polygon: [],
};

function checked(d) {
  const keys = KEYS[d?.kind];
  if (!keys) throw new TypeError(`shapeOf: unknown shape kind "${d?.kind}" (rect, arch, slant, ellipse, polygon)`);
  for (const k of keys) if (!Number.isFinite(d[k])) throw new TypeError(`shapeOf: a ${d.kind} needs a finite "${k}"`);
  if (d.pad !== undefined && !Number.isFinite(d.pad)) throw new TypeError(`shapeOf: "pad" must be a number`);
  if (d.kind === 'polygon' && !(Array.isArray(d.points) && d.points.length >= 3 && d.points.every(p => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])))) {
    throw new TypeError('shapeOf: a polygon needs "points", at least three [x, y] pairs');
  }
  return d;
}

/** The shape function for a descriptor: { kind: 'rect' | 'arch' | 'slant' | 'ellipse' | 'polygon', ...numbers, pad? }. Throws on an unknown kind or a missing number. */
export function shapeOf(descriptor) {
  const d = checked(descriptor), pad = d.pad ?? 0;
  switch (d.kind) {
    case 'rect': return rect(d.x, d.y, d.w, d.h, pad);
    case 'arch': return arch(d.x, d.y, d.w, d.h, d.rise, pad);
    case 'slant': return slant(d.x, d.y, d.w, d.h, d.lean, pad);
    case 'ellipse': return ellipse(d.cx, d.cy, d.rx, d.ry, pad);
    default: return polygon(d.points, pad);
  }
}

/** The box a descriptor's shape stands in, { x, y, w, h }, before any pad. */
export function boundsOf(descriptor) {
  const d = checked(descriptor);
  switch (d.kind) {
    case 'ellipse': return { x: d.cx - d.rx, y: d.cy - d.ry, w: 2 * d.rx, h: 2 * d.ry };
    case 'polygon': {
      const xs = d.points.map(p => p[0]), ys = d.points.map(p => p[1]);
      return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    }
    case 'slant': {
      const reach = d.lean * d.h;
      return { x: d.x + Math.min(0, reach), y: d.y, w: d.w + Math.abs(reach), h: d.h };
    }
    default: return { x: d.x, y: d.y, w: d.w, h: d.h };
  }
}

/** Line boxes as calm rects for a renderer, padded a little. */
export const calmOf = (lines, pad = 2) => lines.map(l => ({ x: l.x - pad, y: l.y - pad, w: l.w + 2 * pad, h: l.h + 2 * pad }));

// ── Laying text into a shape ──────────────────────────────────────────────

/**
 * Bind the geometry to an oracle. Each instance keeps its own prepared-text
 * cache (256 entries, oldest out), so a text is prepared once and reflowed
 * many times.
 */
export function createLayout(oracle) {
  const cache = new Map();
  /** The oracle's prepared text for (text, font), kept: preparing is the expensive half. */
  function prepare(text, font) {
    const key = `${font}\u0000${text}`;
    let p = cache.get(key);
    if (!p) {
      if (cache.size > 256) cache.delete(cache.keys().next().value);
      cache.set(key, (p = oracle.prepare(text, font)));
    }
    return p;
  }

  /**
   * Lay blocks of text (a heading, then paragraphs) into a shape, one line at a
   * time. Each block is { prepared, lineHeight, gap?, align? } with `prepared`
   * made at the size the words will be seen (CSS px); `scale` is CSS px per
   * logical unit, so widths are compared where they are real and the boxes come
   * back in logical units.
   *
   * A band narrower than `minWidth` (logical) is skipped, not squeezed. A line
   * that had to break inside a word marks the layout as not fitting: on a drawn
   * surface a broken word is a sign the size is wrong.
   *
   * Each line also carries `room`, the band's width where it sits (logical): the
   * most a clamped last line may grow to (layout.operators.js).
   *
   * @returns {{ lines: Array<{ block: number, text: string, x: number, y: number, w: number, h: number, room: number }>,
   *   fits: boolean, bottom: number }}
   */
  function layIntoShape(blocks, shape, { top, bottom, scale = 1, minWidth = 0 } = {}) {
    const lines = [];
    let y = top, fits = true;
    blocks.forEach((b, i) => {
      if (!fits) return;
      const lh = b.lineHeight / scale;
      if (i > 0) y += (b.gap ?? 0) / scale;
      let cursor = oracle.start;
      for (let guard = 0; guard < 400; guard++) {
        // out of room: that is only a failure if there is text left to place (ask the oracle first, so an exact fit fits)
        if (y + lh > bottom + 1e-6) { if (oracle.nextLine(b.prepared, cursor, 1e6) !== null) fits = false; return; }
        const band = shape(y, y + lh);
        if (!band || band.w < minWidth) { y += lh / 4; continue; } // no room here yet: step down a little
        const line = oracle.nextLine(b.prepared, cursor, band.w * scale);
        if (line === null) return;
        if (line.brokeWord) fits = false;
        const w = line.width / scale;
        const x = b.align === 'center' ? band.x + (band.w - w) / 2 : band.x;
        lines.push({ block: i, text: line.text, x, y, w, h: lh, room: band.w });
        cursor = line.end;
        y += lh;
      }
      fits = false; // the guard ran out: something is wrong with the shape
    });
    return { lines, fits, bottom: y };
  }

  /**
   * The largest size that lays every block into the shape. `sizes` are tried in
   * order (largest first); `build(size)` returns the blocks at that size. Sizes
   * below the minimum should not be in the list: null means the surface can't
   * hold the words legibly, and they belong in the flat reading.
   */
  function fitSize(sizes, build, shape, opts) {
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
  function setBlocks(specs, shape, { sizes, family, weight = 400, leading = 1.22, gap = 0.5, top, bottom, scale = 1, minWidth = 0, valign = 'middle', align = 'center' }) {
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

  // ── Cards: shrink-wrapped and balanced ───────────────────────────────────

  /** The tightest width that keeps the lines at `maxWidth` (the widest line there). */
  function shrinkWrap(prepared, maxWidth) {
    const { lineCount, maxLineWidth } = oracle.stats(prepared, maxWidth);
    return { width: maxLineWidth, lines: lineCount };
  }

  /**
   * The narrowest width that keeps the same number of lines as `maxWidth`: the
   * lines come out as even as they can, with no short last line hanging alone.
   */
  function balance(prepared, maxWidth) {
    const want = oracle.stats(prepared, maxWidth).lineCount;
    let lo = 0, hi = maxWidth;
    for (let k = 0; k < 20 && hi - lo > 0.5; k++) {
      const mid = (lo + hi) / 2;
      if (oracle.stats(prepared, mid).lineCount <= want) hi = mid; else lo = mid;
    }
    return shrinkWrap(prepared, hi);
  }

  /** A label's box on a drawn plaque, in CSS px: its words plus padding, never under the 24 px target. */
  function labelBox(text, font, px, { pad = 0.7, tall = 1.7, target = 24 } = {}) {
    const { width } = shrinkWrap(prepare(text, font), 1e5);
    return { w: Math.max(target, width + px * pad * 2), h: Math.max(target, px * tall) };
  }

  /** The widest line of `text` unwrapped, straight from the oracle: no cache, so probing many strings never evicts `prepare`'s. */
  const measure = (text, font) => oracle.stats(oracle.prepare(text, font), 1e6).maxLineWidth;

  /** Drop what was prepared (and what the oracle measured): widths taken in a fallback face must not outlive the face that arrives later. */
  function forget() { cache.clear(); oracle.clear?.(); }

  return { prepare, layIntoShape, fitSize, setBlocks, labelBox, shrinkWrap, balance, measure, forget };
}
