// The type tier's named operators: the small solved problems around laid text.
//
//   fit          the largest whole-px size at which words fill a shape
//   clampLines   n lines, the last one ending in an ellipsis that fits its band
//   pack         masonry columns from predicted block heights
//   place        collision-free labels around anchors (greedy)
//   distribute   even spacing along an axis, as near the ideal as it can be
//
// Pure and deterministic, no DOM, no canvas, no oracle: the ones that measure
// take a `layout` (createLayout(oracle) from layout.core.js), so they run in
// Node against the fake oracle and in the browser against Pretext (decision
// 0029). Widths and heights are in the unit the caller uses (CSS px for
// measured text, logical units for shapes: `scale` converts between them).

const EPS = 1e-9;
const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
// Intl.Segmenter keeps a conjunct whole (virama + consonant) only in the scripts its ICU has the rule for
// (Devanagari, not yet Kannada), so we join them ourselves, in every script that has a virama.
const VIRAMAS = '\u094d\u09cd\u0a4d\u0acd\u0b4d\u0bcd\u0c4d\u0ccd\u0d4d'; // Devanagari, Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada, Malayalam
const opensConjunct = g => g.length > 0 && VIRAMAS.includes(g.replace(/\u200d$/, '').slice(-1)); // a virama, or virama + ZWJ (ZWNJ ends the conjunct: a legal break)
/** Cut points of a string: grapheme clusters, with a virama joined to the consonant after it. */
const clusters = s => Array.from(segmenter.segment(s), g => g.segment).reduce((out, g) => {
  if (out.length && opensConjunct(out[out.length - 1]) && /^\p{L}/u.test(g)) out[out.length - 1] += g; else out.push(g);
  return out;
}, []);

// ── fit ────────────────────────────────────────────────────────────────────

/**
 * The largest whole-px size from `maxPx` down to `minPx` (Pretext measures at
 * whole px; `step` widens the grid) at which `text` lays into `shape` with
 * `fits` true, so no word is broken. A binary search over the sizes: it
 * prepares the text O(log n) times, never once per size. Null when even
 * `minPx` does not fit: the words belong in the flat reading. Throws a
 * TypeError when `minPx` or `maxPx` is missing (null would hide a typo).
 *
 * Assumes a larger size never fits where a smaller one does not. That is true
 * of a rect, and nearly always of a gentle arch; on a wild shape a larger size
 * might fit by luck and be missed, never the reverse (the answer always fits).
 *
 * @returns {{ px: number, lines: object[], bottom: number, lineHeight: number, font: string } | null}
 */
export function fit(layout, text, shape, { family, weight = 400, leading = 1.22, minPx, maxPx, top, bottom, scale = 1, minWidth = 0, step = 1, align } = {}) {
  if (!Number.isFinite(minPx) || !Number.isFinite(maxPx)) throw new TypeError('fit needs minPx and maxPx (CSS px, finite)');
  const lo = Math.ceil(minPx), hi = Math.floor(maxPx), by = Math.max(1, Math.round(step)), sizes = [];
  for (let px = hi; px >= lo; px -= by) sizes.push(px);
  const at = px => ({ font: `${weight} ${px}px ${family}`, lineHeight: +(px * leading).toFixed(2) });
  const build = px => [{ prepared: layout.prepare(text, at(px).font), lineHeight: at(px).lineHeight, align }];
  const found = layout.fitSize(sizes, build, shape, { top, bottom, scale, minWidth });
  return found && { px: found.size, lines: found.lines, bottom: found.bottom, ...at(found.size) };
}

// ── clampLines ─────────────────────────────────────────────────────────────

/** A line shortened for an ellipsis keeps its last word whole only if that costs under half of what fits. */
const WORD_KEEP = 0.5;

/**
 * Keep the first `n` of the laid `lines`; if any were cut (or `more` says the
 * layout itself ran out of room), end the last kept line in `ellipsis`, cut
 * at a cluster boundary (never inside a conjunct: a virama is kept with the
 * consonant after it in the nine Indic scripts that have one, so Devanagari,
 * Bengali, Gurmukhi, Gujarati, Oriya, Tamil, Telugu, Kannada and Malayalam stay
 * whole; a ZWNJ is a legal break) and at a word boundary when that loses under half the line. The
 * result is measured through the layout, never a canvas, and fits the line's
 * band (`line.room`, which layIntoShape gives; else its own width) in the same
 * units as the lines: `scale` is CSS px per logical unit, `font` the CSS font
 * the lines were prepared at. `align: 'center'` re-centres the shortened line.
 *
 * `fullText` is every input line joined, for the DOM to keep as the real
 * text. `fits` is false only when not even the ellipsis fits the band.
 * Lines of one block are expected; a block change joins with a newline.
 *
 * @returns {{ lines: object[], clamped: boolean, fullText: string, fits: boolean }}
 */
export function clampLines(layout, lines, n, { font, ellipsis = '…', scale = 1, align = 'start', more = false } = {}) {
  const fullText = lines.reduce((s, l, i) => s + (i && l.block !== lines[i - 1].block ? '\n' : '') + l.text, '').trimEnd();
  const kept = lines.slice(0, Math.max(0, n)), clamped = lines.length > kept.length || more;
  if (!clamped || !kept.length) return { lines: kept, clamped, fullText, fits: true };
  const last = kept[kept.length - 1], room = last.room ?? last.w;
  const width = s => layout.measure(s, font) / scale; // a direct oracle call: probing prefixes must not evict the scene's cached text from the layout's FIFO
  const fitsRoom = s => width(s + ellipsis) <= room + EPS;
  const gs = clusters(last.text.trimEnd());
  const head = k => gs.slice(0, k).join('').trimEnd();
  let k = gs.length;
  if (!fitsRoom(head(k))) {
    let a = 0, b = gs.length - 1, best = -1; // the longest prefix that fits, by halves
    while (a <= b) { const m = (a + b) >> 1; if (fitsRoom(head(m))) { best = m; a = m + 1; } else b = m - 1; }
    k = Math.max(best, 0);
    for (let j = k; j >= Math.ceil(k * WORD_KEEP) && j > 0; j--) { // back to a word's end, if it costs little
      if (j < gs.length && /^\s/u.test(gs[j]) && head(j) && fitsRoom(head(j))) { k = j; break; }
    }
  }
  const text = head(k) + ellipsis;
  const w = width(text), shift = align === 'center' ? (room - w) / 2 - (room - last.w) / 2 : 0;
  const tail = { ...last, text, w, x: last.x + shift, ellipsized: true };
  return { lines: [...kept.slice(0, -1), tail], clamped, fullText, fits: w <= room + EPS };
}

// ── pack ───────────────────────────────────────────────────────────────────

/** The height a text will take at `width`: its line count at that width, times the line height. */
export function predictHeight(layout, text, font, width, lineHeight) {
  return layout.shrinkWrap(layout.prepare(text, font), width).lines * lineHeight;
}

/**
 * Masonry from predicted heights. `blocks` are { id, height }; each goes, in
 * order, into the column that is shortest so far (ties to the leftmost), so
 * the same blocks always land the same way and nothing moves when text loads
 * (heights come from predictHeight). `columns` share `width` less the gaps.
 *
 * @returns {{ items: Array<{ id, x: number, y: number, w: number, h: number, column: number }>, height: number }}
 */
export function pack(blocks, { columns = 1, gap = 0, width }) {
  const cols = Math.max(1, Math.floor(columns)), w = Math.max(0, (width - gap * (cols - 1)) / cols);
  const tops = new Array(cols).fill(0), used = new Array(cols).fill(false);
  const items = blocks.map(({ id, height }) => {
    let c = 0;
    for (let i = 1; i < cols; i++) if (tops[i] < tops[c] - EPS) c = i;
    const item = { id, x: c * (w + gap), y: tops[c], w, h: height, column: c };
    tops[c] += height + gap; used[c] = true;
    return item;
  });
  return { items, height: Math.max(0, ...tops.map((t, i) => (used[i] ? t - gap : 0))) };
}

// ── place ──────────────────────────────────────────────────────────────────

const overlap = (a, b) => a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS;

/** The boxes to try for one label at distance `g` from its anchor: four sides, then four diagonals. */
function candidates({ anchor: a, w, h }, g) {
  return [
    ['right', a.x + g, a.y - h / 2], ['left', a.x - g - w, a.y - h / 2], ['above', a.x - w / 2, a.y - g - h], ['below', a.x - w / 2, a.y + g],
    ['above-right', a.x + g, a.y - g - h], ['above-left', a.x - g - w, a.y - g - h], ['below-right', a.x + g, a.y + g], ['below-left', a.x - g - w, a.y + g],
  ].map(([side, x, y]) => ({ side, x, y, w, h }));
}

/**
 * Collision-free labels. `labels` are { id, anchor: { x, y }, w, h, priority? };
 * `bounds` and each of `obstacles` are { x, y, w, h }. Labels are taken in
 * priority order (higher first; ties in input order) and each takes the first
 * candidate box that stays inside `bounds`, clear of the obstacles and of the
 * labels already placed, and off every other label's anchor (a dot of
 * `anchorRadius`, default 3; a label's own anchor is where it starts). Candidates run nearest first: the four sides, then
 * the diagonals, at `gap` from the anchor, then again at `gap + each nudge`.
 * Touching edges do not overlap. A label with no candidate is dropped.
 *
 * Greedy, not optimal: an early label can crowd out a later one that a
 * cleverer arrangement would have kept, and there are no leader lines.
 *
 * @returns {{ placed: Array<{ id, x, y, w, h, side: string }>, dropped: Array }}
 */
export function place(labels, { bounds, obstacles = [], nudges = [6, 12, 24], gap = 0, anchorRadius = 3 } = {}) {
  const inside = b => !bounds || (b.x >= bounds.x - EPS && b.y >= bounds.y - EPS && b.x + b.w <= bounds.x + bounds.w + EPS && b.y + b.h <= bounds.y + bounds.h + EPS);
  const taken = [...obstacles], won = new Map();
  const dots = labels.map(l => ({ x: l.anchor.x - anchorRadius, y: l.anchor.y - anchorRadius, w: 2 * anchorRadius, h: 2 * anchorRadius }));
  const order = labels.map((l, i) => i).sort((a, b) => (labels[b].priority ?? 0) - (labels[a].priority ?? 0) || a - b);
  for (const i of order) {
    const l = labels[i];
    const box = [0, ...nudges].flatMap(d => candidates(l, gap + d)).find(c => inside(c) && !taken.some(t => overlap(c, t)) && !dots.some((t, j) => j !== i && overlap(c, t)));
    if (box) { won.set(i, { id: l.id, ...box }); taken.push(box); }
  }
  return { placed: labels.flatMap((l, i) => (won.has(i) ? [won.get(i)] : [])), dropped: labels.filter((l, i) => !won.has(i)).map(l => l.id) };
}

// ── distribute ─────────────────────────────────────────────────────────────

/**
 * Even spacing along an axis for labels whose sizes are known. `items` are
 * { id, at, size }: `at` is the ideal centre, `size` the extent along the
 * axis. They keep the order of `at` (ties in input order), stay at least
 * `minGap` apart, inside [start, end], and sit as near their `at` as that
 * allows: the least-squares answer, exactly.
 *
 * How: with d(i) the least distance between centres i-1 and i
 * (size/2 + size/2 + minGap) and o(i) their running sum, the shifted centres
 * y(i) = c(i) - o(i) must merely not decrease, which is isotonic regression
 * of at(i) - o(i), solved exactly by pool-adjacent-violators (merge a block
 * into the one before while its mean is lower). Then the bounds are one
 * clamp on y: the first box must clear `start`, the last must clear `end`.
 * When even tight packing is longer than the room, `overflow` is true and the
 * items are packed from `start` with `minGap` kept (order and gaps win over `end`).
 *
 * Items come back in order, as { id, at, center, shift, x, w } on the x axis
 * or { …, y, h } on the y axis, so they drop into other boxes.
 *
 * @returns {{ items: object[], overflow: boolean }}
 */
export function distribute(items, { axis = 'x', start = 0, end = Infinity, minGap = 0 } = {}) {
  const it = items.map((v, i) => [v, i]).sort((a, b) => a[0].at - b[0].at || a[1] - b[1]).map(p => p[0]);
  const off = it.map(() => 0);
  for (let i = 1; i < it.length; i++) off[i] = off[i - 1] + (it[i - 1].size + it[i].size) / 2 + minGap;
  const n = it.length, lo = n ? start + it[0].size / 2 : 0, hi = n ? end - it[n - 1].size / 2 - off[n - 1] : 0;
  const overflow = hi < lo - EPS;
  const pools = []; // pool-adjacent-violators on the targets at(i) - o(i)
  it.forEach((v, i) => {
    pools.push({ sum: v.at - off[i], n: 1 });
    while (pools.length > 1) {
      const b = pools[pools.length - 1], a = pools[pools.length - 2];
      if (a.sum / a.n <= b.sum / b.n) break;
      pools.splice(-2, 2, { sum: a.sum + b.sum, n: a.n + b.n });
    }
  });
  const ys = pools.flatMap(p => new Array(p.n).fill(p.sum / p.n));
  const [pos, ext] = axis === 'y' ? ['y', 'h'] : ['x', 'w'];
  return {
    overflow,
    items: it.map((v, i) => {
      const center = (overflow ? lo : Math.min(hi, Math.max(lo, ys[i]))) + off[i];
      return { id: v.id, at: v.at, center, shift: center - v.at, [pos]: center - v.size / 2, [ext]: v.size };
    }),
  };
}
