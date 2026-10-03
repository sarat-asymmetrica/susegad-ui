// The veranda's pane: the pure half. Words on a frosted pane that sits INSIDE the drawing at a depth d, where things in
// front of it hide it, and the note anchors, the walk and the postcards that follow from that. No DOM: runs in Node.
//
// Depth is <sg-depth-photo>'s: 0 far (the paddy, the sky), 1 near, linear in inverse distance between 1 and 10 units.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** How far back and forward the pane may go, and where it starts. Behind d 0.10 the paddy's own depth is nothing to hide behind. */
export const DEPTH = { min: 0.1, max: 0.85, home: 0.3, step: 0.03, big: 0.09 };

/** Forward distance in scene units of depth d (the inverse of the encoding in world.js). */
export const zOf = d => 1 / (clamp(d, 0, 1) * 0.9 + 0.1);

/**
 * How big the pane's words are at depth d, as a scale on their base size: a pane far back is smaller, one brought forward is a
 * little larger, and never so small that it cannot be read (the words are real text: this is only how big they are set).
 */
export const paneScale = d => clamp((zOf(DEPTH.home) / zOf(d)) ** 0.55, 0.78, 1.25);

/** A depth as words a person can use: where the pane is in the veranda. */
export function depthWords(d) {
  return d >= 0.7 ? 'close, in front of the near pillar' : d >= 0.52 ? 'near the front of the veranda' : d >= 0.34 ? 'in the middle of the veranda' : d >= 0.2 ? 'well back, toward the garden' : 'far back, beyond the veranda';
}
/** What the status line says after the pane's depth changes. `dir` is 1 when it came forward, -1 when it went back. */
export const depthSaid = (d, dir = 0) => `Words ${dir > 0 ? 'brought forward' : dir < 0 ? 'moved back' : 'set'}: ${depthWords(d)}.`;

/** A key or wheel as a change of depth, or null: PageUp and PageDown (Shift for bigger steps); a wheel turned up comes forward. */
export function stepDepth(d, input, shift = false) {
  const s = shift ? DEPTH.big : DEPTH.step;
  const dir = input === 'PageUp' || input === 'wheelUp' ? 1 : input === 'PageDown' || input === 'wheelDown' ? -1 : 0;
  if (!dir) return null;
  const next = clamp(d + dir * s, DEPTH.min, DEPTH.max);
  return { d: next, dir, moved: Math.abs(next - d) > 1e-9 };
}
/** Parse the `pane-depth` attribute. */
export const parseDepth = v => (Number.isFinite(parseFloat(v)) ? clamp(parseFloat(v), DEPTH.min, DEPTH.max) : DEPTH.home);

// ── occlusion ────────────────────────────────────────────────────────────────

/** A depth byte a little in front of the pane's own: what is nearer than this hides it. One step of slack for the map's edges. */
export const cutByte = d => Math.round(clamp(d, 0, 1) * 255) + 2;

/** The mask alpha (255 shows the pane, 0 hides it) for a map of depth bytes: hidden where something is nearer than the pane. */
export function maskAlpha(bytes, d) {
  const cut = cutByte(d), out = new Uint8ClampedArray(bytes.length);
  for (let k = 0; k < bytes.length; k++) out[k] = bytes[k] > cut ? 0 : 255;
  return out;
}

/** Sample points, every `step` px, over rects [{ x, y, w, h }] (the pane's line boxes, in stage px). */
export function samplePoints(rects, step = 5) {
  const pts = [];
  for (const r of rects) for (let y = r.y + step / 2; y < r.y + r.h; y += step) for (let x = r.x + step / 2; x < r.x + r.w; x += step) pts.push([x, y]);
  return pts;
}
/** The share of `points` that something nearer than depth d hides; depthAt(x, y) gives a byte. */
export function coveredShare(points, depthAt, d) {
  if (!points.length) return 0;
  const cut = cutByte(d);
  let n = 0;
  for (const [x, y] of points) if (depthAt(x, y) > cut) n++;
  return n / points.length;
}

/** The share of the words' area that may be covered when they are dropped (rule 3 of the request). */
export const READABLE = { limit: 0.15, clear: 0.02 };

/**
 * Where the pane settles on release. If no more than `limit` of the lines' area is covered it stays. Otherwise it comes
 * forward, in steps of 0.01, to the nearest depth where at most `clear` is covered (or as far forward as it may go).
 * Returns { d, moved, share }: the depth, whether it moved, and the covered share at that depth.
 */
export function settleDepth(points, depthAt, d, { limit = READABLE.limit, clear = READABLE.clear, max = DEPTH.max } = {}) {
  const first = coveredShare(points, depthAt, d);
  if (first <= limit) return { d, moved: false, share: first };
  let best = d, share = first;
  for (let t = d + 0.01; t <= max + 1e-9; t += 0.01) {
    share = coveredShare(points, depthAt, t); best = t;
    if (share <= clear) break;
  }
  return { d: clamp(best, DEPTH.min, DEPTH.max), moved: true, share };
}

// ── the still, from a map, for a place on the picture ─────────────────────────

/** Depth bytes (w x h, row-major) sampled at photo coordinates (u, v) in [0, 1]; outside the picture reads the nearest edge. */
export const byteAt = (bytes, w, h, u, v) => bytes[clamp(Math.floor(v * h), 0, h - 1) * w + clamp(Math.floor(u * w), 0, w - 1)];

/**
 * The map from stage px to photo (u, v), from where two known photo corners land on the stage. `p0` is where (0, 0) lands
 * and `p1` where (1, 1) lands: exact at the rest camera, which is what the mask and the settle use.
 */
export function photoAt(p0, p1) {
  return (x, y) => [(x - p0[0]) / (p1[0] - p0[0]), (y - p0[1]) / (p1[1] - p0[1])];
}

// ── anchors and notes: a note sticks to a place, and follows it ────────────────

/**
 * The anchor a note dropped at photo point (u, v), where the depth map reads `byte`, belongs to: the nearest on the picture,
 * with the depth counted too (a drop on the near pillar is the pillar, not the door that shows behind it). Anchors are
 * { id, u, v, d } (d 0..1, the surface's depth); W and H are the picture's logical size. Returns { anchor, score } or null.
 */
export function nearestAnchor(u, v, byte, anchors, { W = 1200, H = 800, depthWeight = 500 } = {}) {
  let best = null;
  for (const a of anchors) {
    const score = Math.hypot((u - a.u) * W, (v - a.v) * H) + depthWeight * Math.abs(byte / 255 - a.d);
    if (!best || score < best.score) best = { anchor: a, score };
  }
  return best;
}
/** The next (dir 1) or previous (dir -1) anchor in the list after `id`, wrapping: what the grip's arrow keys cycle through. */
export function cycleAnchor(anchors, id, dir = 1) {
  const i = anchors.findIndex(a => a.id === id);
  return anchors[(i + dir + anchors.length * 2) % anchors.length];
}

/**
 * A note is { anchor, text } (a text id in the page's list). The postcard is the URL's hash: \`notes=door.1,lamp.0\`, anchor
 * and text index, no free text, so a link can only ever say what the page already says. Unknown anchors, out-of-range text
 * ids and duplicates are dropped when it is read.
 */
export function encodeNotes(notes) { return notes.length ? `notes=${notes.map(n => `${n.anchor}.${n.text}`).join(',')}` : ''; }
export function decodeNotes(hash, anchorIds, textCount, max = 12) {
  const m = /(?:^|[#&])notes=([^&]*)/.exec(String(hash ?? ''));
  if (!m) return [];
  const out = [], seen = new Set();
  for (const part of m[1].split(',')) {
    const [anchor, t] = part.split('.'), text = Number(t);
    const key = `${anchor}.${text}`;
    if (!anchorIds.includes(anchor) || !Number.isInteger(text) || text < 0 || text >= textCount || seen.has(key)) continue;
    seen.add(key); out.push({ anchor, text });
    if (out.length >= max) break;
  }
  return out;
}

// ── the walk: scrolling dollies the camera along the veranda and stops at each note ───────

/**
 * The stops of a walk, one per anchored note, nearest first: where the camera is (dolly 0..1 along the path) and what is in
 * focus (the anchor's depth). \`anchors\` are the notes' anchors { id, d }.
 */
export function walkPlan(anchors) {
  const sorted = [...anchors].sort((a, b) => b.d - a.d), n = sorted.length;
  return sorted.map((a, k) => ({ id: a.id, d: a.d, dolly: n === 1 ? 0.6 : 0.12 + 0.88 * k / (n - 1) }));
}
/**
 * Where the walk is at scroll progress p in [0, 1]: each stop owns an equal share of the scroll, the first 45% of it moving
 * the camera from the last stop (or the start) to this one, the rest holding still while its note is read.
 * Returns { dolly, focus, index, holding }.
 */
export function walkAt(p, plan) {
  if (!plan.length) return { dolly: 0, focus: DEPTH.home, index: -1, holding: false };
  const n = plan.length, x = clamp(p, 0, 0.999999) * n, i = Math.floor(x), f = x - i, move = 0.45;
  const from = i === 0 ? { dolly: 0, d: plan[0].d } : plan[i - 1], to = plan[i];
  const e = f >= move ? 1 : (t => t * t * (3 - 2 * t))(f / move);
  return { dolly: from.dolly + (to.dolly - from.dolly) * e, focus: from.d + (to.d - from.d) * e, index: i, holding: f >= move };
}

// ── words never over words, and never hidden while the camera moves ───────────────────────────────

/** Do two rects { x, y, w, h } touch, with `pad` px of air required between them? */
export const rectsHit = (a, b, pad = 0) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;

/**
 * Where each photo pixel nearer than the pane lands on a stage, for the camera as it is now: a forward splat of the depth map.
 * `bytes` is w x h; `corners(b)` gives where photo (0, 0) and (1, 1) land on the stage at depth byte b, as [[x0, y0], [x1, y1]] (the
 * picture's own place(), so a walking camera moves the near things more than the far ones, as it does on screen). The grid is
 * cw x ch cells over a sw x sh stage; a cell is 1 where something nearer than `cut` shows in it. A pixel spreads over as many
 * cells as it covers, so a near thing that the camera stretches leaves no holes. `step` reads every step-th pixel each way (each then
 * covers step times as many cells): a coarser map for the price of a fraction of the work.
 */
export function hiddenGrid({ bytes, w, h, cut, corners, cw, ch, sw, sh, step = 1 }) {
  const grid = new Uint8Array(cw * ch), kx = cw / sw, ky = ch / sh, tab = new Array(256);
  for (let b = cut + 1; b < 256; b++) { const [[x0, y0], [x1, y1]] = corners(b); tab[b] = [x0 * kx, y0 * ky, (x1 - x0) * kx / w, (y1 - y0) * ky / h]; }
  for (let j = 0; j < h; j += step) {
    const row = j * w;
    for (let i = 0; i < w; i += step) {
      const b = bytes[row + i];
      if (b <= cut) continue;
      const [ax, ay, sx, sy] = tab[b], fx = Math.max(1, Math.ceil(Math.abs(sx) * step)), fy = Math.max(1, Math.ceil(Math.abs(sy) * step));
      const cx = Math.floor(ax + (i + step / 2) * sx - fx / 2 + 0.5), cy = Math.floor(ay + (j + step / 2) * sy - fy / 2 + 0.5);
      for (let y = Math.max(0, cy); y < Math.min(ch, cy + fy); y++) for (let x = Math.max(0, cx); x < Math.min(cw, cx + fx); x++) grid[y * cw + x] = 1;
    }
  }
  return grid;
}
/**
 * The cells of a hidden grid that SHOW, as SVG path data in cell units: one rect per run of shown cells in a row. Used as the mask:
 * a vector image has nothing to decode or upload, and swapping a decoded PNG under a backdrop-filter while the picture moved made the
 * GPU raster stall for a second on this machine's integrated GPU.
 */
export function shownPath(grid, cw, ch) {
  let d = '';
  for (let y = 0; y < ch; y++) {
    let x = 0;
    while (x < cw) {
      while (x < cw && grid[y * cw + x]) x++;
      const s = x;
      while (x < cw && !grid[y * cw + x]) x++;
      if (x > s) d += 'M' + s + ' ' + y + 'h' + (x - s) + 'v1h' + (s - x) + 'z';
    }
  }
  return d;
}
/** A grid as a predicate on stage px: is something nearer than the pane at (x, y)? Outside the stage nothing hides. */
export const hiddenIn = (grid, cw, ch, sw, sh) => (x, y) => x >= 0 && y >= 0 && x < sw && y < sh && grid[Math.floor(y * ch / sh) * cw + Math.floor(x * cw / sw)] === 1;

/** The hidden share of each line box: [0..1] per rect, sampled every `step` px. */
export function lineShares(lines, hidden, step = 4) {
  return lines.map(r => { const pts = samplePoints([r], step); let n = 0; for (const [x, y] of pts) if (hidden(x, y)) n++; return pts.length ? n / pts.length : 0; });
}
/** The most hidden line: rule 3 holds per line, so a short heading cannot lose its first letters to a doorpost. */
export const worstShare = (lines, hidden, step = 4) => Math.max(0, ...lineShares(lines, hidden, step));

/**
 * Where the pane comes to rest. The least change that leaves every line box clear of every obstacle (`pad` px of air) and no
 * line more than `limit` hidden: it stays if it can, comes forward if that is enough, and moves only when it must. It looks for a place where
 * at most `clear` is hidden first, then 6%, and only then `limit`: a place where the words are not clipped at all beats a nearer one where a letter is.
 *
 *   lines, panel   the pane's line boxes and its box now, in stage px
 *   stage          { w, h }; the pane stays `margin` px inside it
 *   obstacles      rects of the other words (notes, the pot's paragraph): the pane keeps clear of them (a rect may carry its own `pad`)
 *   hiddenAt(d)    a predicate (x, y) => hidden, for the pane at depth d (the caller memoises: it can be dear)
 *
 * Candidates are the places on a `grid` px lattice, nearest first; the cost of one is its distance and how far forward it must
 * come. Returns { dx, dy, d, worst, moved, free }: free is false only when nowhere is clear (then the least bad place is taken).
 */
export function settleSpot({ lines, panel, stage, obstacles = [], hiddenAt, d, limit = READABLE.limit, clear = READABLE.clear, max = DEPTH.max, margin = 14, pad = 6, grid = 16 }) {
  const shift = (dx, dy) => lines.map(r => ({ ...r, x: r.x + dx, y: r.y + dy }));
  // the pane's whole box keeps clear, not only its lines: glass over another note's words hides them as surely as words over them do
  // (an obstacle may carry `pad` for the lines and `panelPad` for the pane's box: a note's own padding may lie under the glass, the pot's pane must stay out of its blur)
  const at = { x: 0, y: 0, w: 0, h: 0 }; // one scratch rect: this is asked tens of thousands of times
  const freeAt = (dx, dy) => {
    for (const o of obstacles) {
      const p = o.pad ?? pad;
      for (const r of lines) { at.x = r.x + dx; at.y = r.y + dy; at.w = r.w; at.h = r.h; if (rectsHit(at, o, p)) return false; }
      at.x = panel.x + dx; at.y = panel.y + dy; at.w = panel.w; at.h = panel.h;
      if (rectsHit(at, o, o.panelPad ?? p)) return false;
    }
    return true;
  };
  // coverage is read a little wider than the words (6 px each side, 2 above and below): a letter at the edge of an occluder is lost at 5% covered,
  // and the mask's edge is a grid of 3 px cells
  const wide = (dx, dy) => lines.map(r => ({ x: r.x + dx - 6, y: r.y + dy - 2, w: r.w + 12, h: r.h + 4 }));
  const worstAt = (dx, dy, depth) => worstShare(wide(dx, dy), hiddenAt(Math.min(max, Math.round(depth * 100) / 100)));
  // the least depth at or above d where the worst line is at most `to` (the share only falls as the pane comes forward)
  const need = (dx, dy, to) => {
    if (worstAt(dx, dy, d) <= to) return d;
    if (worstAt(dx, dy, max) > to) return null;
    let lo = d, hi = max;
    while (hi - lo > 0.0101) { const m = (lo + hi) / 2; if (worstAt(dx, dy, m) <= to) hi = m; else lo = m; }
    return Math.min(max, Math.ceil(hi * 100 - 1e-9) / 100);
  };
  const inX = [margin - panel.x, stage.w - margin - panel.w - panel.x], inY = [margin - panel.y, stage.h - margin - panel.h - panel.y];
  // where the person put the words counts for more than how near they are, and a letter clipped counts for more than either
  const cost = (dx, dy, dd) => Math.hypot(dx, dy) / stage.w * 12 + (dd - d) * 2 + worstAt(dx, dy, dd) * 15;
  // staying is free: an unobstructed pane with no line more than `limit` hidden does not move at all
  if (freeAt(0, 0) && worstAt(0, 0, d) <= limit) return { dx: 0, dy: 0, d, worst: worstAt(0, 0, d), moved: false, free: true };
  const cand = [];
  const search = g => {
    let best = null;
    cand.length = 0; cand.push([0, 0]);
    for (let dy = Math.ceil(inY[0] / g) * g; dy <= inY[1]; dy += g) for (let dx = Math.ceil(inX[0] / g) * g; dx <= inX[1]; dx += g) if (dx || dy) cand.push([dx, dy]);
    cand.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]));
    const consider = (dx, dy, to) => {
      const dd = need(dx, dy, to); if (dd === null) return;
      const c = cost(dx, dy, dd); if (!best || c < best.c) best = { dx, dy, d: dd, c };
    };
    for (const to of [clear, 0.06, limit]) {
      for (const [dx, dy] of cand) {
        if (best && Math.hypot(dx, dy) / stage.w * 12 >= best.c) break;
        if (freeAt(dx, dy)) consider(dx, dy, to);
      }
      if (best) break;
    }
    return best;
  };
  // the lattice first; if the room is that tight (a gap a few pixels narrower than the pane), a finer one
  const best = search(grid) ?? search(6);
  if (!best) { // nowhere is clear of the other words: the least bad place, so the words at least come forward
    let low = null;
    for (const [dx, dy] of cand) { const s = [...shift(dx, dy), { ...panel, x: panel.x + dx, y: panel.y + dy }], hits = obstacles.reduce((n, o) => n + s.filter((r, i) => rectsHit(r, o, i < s.length - 1 ? (o.pad ?? pad) : (o.panelPad ?? o.pad ?? pad))).length, 0); if (!low || hits < low.hits) low = { dx, dy, hits }; }
    const dd = need(low.dx, low.dy, clear) ?? max;
    return { dx: low.dx, dy: low.dy, d: dd, worst: worstAt(low.dx, low.dy, dd), moved: !!(low.dx || low.dy || dd !== d), free: false };
  }
  return { dx: best.dx, dy: best.dy, d: best.d, worst: worstAt(best.dx, best.dy, best.d), moved: !!(best.dx || best.dy || best.d !== d), free: true };
}

// ── notes among the other words ───────────────────────────────────────────────────────────────────

/** The four ways a note can stand on its anchor: above or below it, running right or left of the pointer. */
export const NOTE_SIDES = ['tr', 'tl', 'br', 'bl'];
/**
 * Where a note's box goes so its pointer touches the anchor (ax, ay) and it clears every other set of words: the usual place
 * (above, running right) first, then the other sides, then higher up (a longer pointer). `size` is { w, h }; `others` are the
 * rects it must not touch (the pot's paragraph, the notes already placed). Returns { x, y, side, tail, hits }, the box's top left.
 */
export function placeNote(ax, ay, size, { others = [], stage, pad = 5, tail = 7 } = {}) {
  let best = null;
  for (const stalk of [0, 1, 2, 3]) for (const side of NOTE_SIDES) {
    const t = tail + stalk * (size.h * 0.9 + 6), above = side[0] === 't', right = side[1] === 'r';
    let x = right ? ax : ax - size.w, y = above ? ay - t - size.h : ay + t;
    // never clamped: a note whose anchor has walked off the stage goes with it; near an edge it takes the side that stays on the stage
    const box = { x, y, w: size.w, h: size.h }, hits = others.filter(o => rectsHit(box, o, pad)).length;
    const inX = Math.max(0, Math.min(x + size.w, stage.w - 4) - Math.max(x, 4)), inY = Math.max(0, Math.min(y + size.h, stage.h - 4) - Math.max(y, 4)), out = size.w * size.h - inX * inY;
    const score = hits * 1e6 + out;
    if (!best || score < best.score) best = { x, y, side, tail: t, hits, score };
    if (!score) return best;
  }
  return best;
}
