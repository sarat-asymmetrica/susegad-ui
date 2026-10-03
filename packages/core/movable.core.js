// Movable words, the pure part (decision 0021): where the panel may go, how a
// key moves it, how a place is put in plain words, and the words-at coordinates.
// No DOM: runs in Node, and movable.core.test.js holds it to that.
//
// Rects are { left, top, right, bottom } (the stage) and { left, top, width,
// height } (the panel at home, that is without its transform), in client px.
// An "offset" is how far the panel has been moved from home, in px. A "place"
// is a fraction of the free room the panel has to move in: 0 is flush to the
// top or left, 1 is flush to the bottom or right. Places, not offsets, are what
// the page remembers, so a link opened at another width puts the words in the
// same part of the picture.

export const MARGIN = 14;  // px kept between the panel and the stage's edge (the grip hangs 13 px over the corner)
export const MIN_ROOM = 48; // px of room below which there is nothing worth dragging
export const STEP = 0.03;  // a key press, as a share of the stage's width
export const BIG_STEP = 0.09; // the same with Shift

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const span = (lo, hi, at, size, margin) => {
  const min = lo + margin - at, max = hi - margin - size - at;
  return max >= min ? [min, max] : [(min + max) / 2, (min + max) / 2]; // a panel wider than the stage has no room, and sits centred
};

/** The offsets the panel may take: { minX, maxX, minY, maxY }. */
export function room(stage, home, margin = MARGIN) {
  const [minX, maxX] = span(stage.left, stage.right, home.left, home.width, margin);
  const [minY, maxY] = span(stage.top, stage.bottom, home.top, home.height, margin);
  return { minX, maxX, minY, maxY };
}

/**
 * Keep the panel off an obstacle (the scene's pause button, which must stay reachable): if the panel at (dx, dy) would
 * touch it, take the smaller of two moves, down below it or left of it, that still fits the room. `home` is the panel
 * at home, `obstacle` a rect in the same client px.
 */
export function avoid(r, home, dx, dy, obstacle, gap = 8) {
  const p = { left: home.left + dx, top: home.top + dy, right: home.left + dx + home.width, bottom: home.top + dy + home.height };
  const o = { left: obstacle.left - gap, top: obstacle.top - gap, right: obstacle.right + gap, bottom: obstacle.bottom + gap };
  if (p.right <= o.left || p.left >= o.right || p.bottom <= o.top || p.top >= o.bottom) return { dx, dy };
  const down = o.bottom - p.top, left = p.right - o.left, opts = [];
  if (dy + down <= r.maxY + 0.5) opts.push({ dx, dy: dy + down, d: down });
  if (dx - left >= r.minX - 0.5) opts.push({ dx: dx - left, dy, d: left });
  opts.sort((a, b) => a.d - b.d);
  return opts.length ? { dx: opts[0].dx, dy: opts[0].dy } : { dx, dy };
}

/** Is there anywhere worth moving to? */
export const canMove = (r, min = MIN_ROOM) => r.maxX - r.minX >= min || r.maxY - r.minY >= min;

/** An offset held inside the room. */
export const clampTo = (r, dx, dy) => ({ dx: clamp(dx, r.minX, r.maxX), dy: clamp(dy, r.minY, r.maxY) });

/** An offset as a place in [0, 1]; an axis with no room is 0. */
const at = (v, lo, hi) => (hi - lo < 0.5 ? 0 : clamp((v - lo) / (hi - lo), 0, 1));
export const placeOf = (r, dx, dy) => ({ x: at(dx, r.minX, r.maxX), y: at(dy, r.minY, r.maxY) });
/** A place as an offset. */
export const offsetOf = (r, x, y) => ({ dx: r.minX + clamp(x, 0, 1) * (r.maxX - r.minX), dy: r.minY + clamp(y, 0, 1) * (r.maxY - r.minY) });

const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
/** An arrow key as [dx, dy] (unit), or null. */
export const dirOf = key => DIRS[key] ?? null;

/** One key press from an offset: the new offset, held inside the room, and whether it moved at all. */
export function nudge(r, dx, dy, key, big, stageWidth) {
  const d = dirOf(key);
  if (!d) return { dx, dy, moved: false };
  const step = stageWidth * (big ? BIG_STEP : STEP), to = clampTo(r, dx + d[0] * step, dy + d[1] * step);
  return { ...to, moved: Math.abs(to.dx - dx) > 0.01 || Math.abs(to.dy - dy) > 0.01 };
}

/** A place in plain words: thirds of the room each way, and an axis with no room is left out. */
export function nameOf(x, y, r) {
  const third = v => (v < 1 / 3 ? 0 : v > 2 / 3 ? 2 : 1);
  const cols = r.maxX - r.minX >= 0.5 ? ['left', '', 'right'][third(x)] : '';
  const rows = r.maxY - r.minY >= 0.5 ? ['top', '', 'bottom'][third(y)] : '';
  const words = [rows, cols].filter(Boolean).join(' ');
  return `the ${words || 'middle'}`;
}
export const movedSaid = (x, y, r) => `Words moved to ${nameOf(x, y, r)}`;
export const homeSaid = () => 'Words are back where they started';
/** What to say when a key press has nowhere to go. */
export const limitSaid = key => `The words are as far ${{ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[key]} as they go`;

/** "0.25 0.8" or "0.25,0.8" as { x, y } in [0, 1], or null when it isn't two numbers. */
export function parseWordsAt(text) {
  const m = /^\s*(-?\d*\.?\d+)[\s,]+(-?\d*\.?\d+)\s*$/.exec(text ?? '');
  return m ? { x: clamp(+m[1], 0, 1), y: clamp(+m[2], 0, 1) } : null;
}
/** The other way: three decimals, no trailing zeros. */
export const formatWordsAt = (x, y) => `${+x.toFixed(3)} ${+y.toFixed(3)}`;
