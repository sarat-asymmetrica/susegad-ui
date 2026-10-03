// Tabs: the pure core. Runs in Node.
//
// The ARIA APG tabs model, and the travelling underline's geometry, as plain
// functions over indices and rectangles. No DOM: <tabs.js> is the only file
// here that touches the page.

/** The component adds no words of its own: the tab labels are the builder's. */
export const STRINGS = {};

/**
 * The APG keyboard model, automatic activation: the arrow keys (Left/Right,
 * or Up/Down in a vertical list) move focus AND select, wrapping at the
 * ends; Home and End jump to the first and last tab. Any other key is
 * ignored (Tab itself leaves the tablist, as usual).
 * @param {number} current the focused tab's index
 * @param {string} key a KeyboardEvent.key
 * @param {number} count how many tabs there are
 * @param {{ orientation?: 'horizontal' | 'vertical' }} [opts]
 * @returns {number} the index to select and focus; `current` if the key does nothing
 */
export function moveIndex(current, key, count, { orientation = 'horizontal' } = {}) {
  if (count <= 0) return current;
  const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  if (key === prevKey) return (((current - 1) % count) + count) % count;
  if (key === nextKey) return (current + 1) % count;
  if (key === 'Home') return 0;
  if (key === 'End') return count - 1;
  return current;
}

/** Which keys the tablist itself handles (and so must preventDefault on). */
export function isTabsKey(key, orientation = 'horizontal') {
  const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';
  const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
  return key === prevKey || key === nextKey || key === 'Home' || key === 'End';
}

/**
 * The ink underline's box, in the tablist's own coordinate space, from the
 * active tab's rectangle. `null` when there is no active tab (nothing to
 * draw; a skin should shrink the underline to width 0 rather than error).
 * @param {{ left: number, width: number }[]} rects each tab's box, left and
 *   width measured from the tablist's own left edge
 * @param {number} index
 */
export function underlineRect(rects, index) {
  const r = rects[index];
  return r ? { left: r.left, width: r.width } : null;
}

/**
 * Where the bead sits on a travelling underline: centred on the box.
 * @param {{ left: number, width: number } | null} box
 */
export function beadAt(box) {
  return box ? box.left + box.width / 2 : null;
}
