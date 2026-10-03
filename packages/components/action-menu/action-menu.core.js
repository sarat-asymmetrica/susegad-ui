// Menu: the pure core. Runs in Node.
//
// A menu button's items are real <a> and <button> elements: activating one
// (Enter, Space or a click) is the browser's own job. This file holds the
// real logic the ARIA APG menu keyboard model needs (where the roving focus
// goes next, and which item a typed letter jumps to), plus where to place
// the list against its trigger: the same shape as Popover's placement(),
// duplicated rather than imported across component folders, since each
// component here is meant to be copied on its own.

export const STRINGS = {};

/**
 * Below the trigger, left-aligned to it, by default; flips above when there
 * is little room below and more room above. Clamped inside the viewport.
 * @param {{ left: number, top: number, bottom: number, width: number }} trigger
 * @param {{ width: number, height: number }} panel
 * @param {{ width: number, height: number }} viewport
 * @param {{ gap?: number, margin?: number, flipUnder?: number }} [opts]
 * @returns {{ left: number, above: boolean }}
 */
export function placement(trigger, panel, viewport, { gap = 6, margin = 8, flipUnder = 160 } = {}) {
  const below = viewport.height - trigger.bottom;
  const above = trigger.top;
  const flip = below < flipUnder && above > below;
  const left = Math.max(margin, Math.min(trigger.left, viewport.width - panel.width - margin));
  return { left, above: flip };
}

/** One step of a roving index, wrapping at both ends. n must be > 0. */
export function wrap(index, delta, n) {
  return ((index + delta) % n + n) % n;
}

/**
 * The next item whose label starts with `query` (case-insensitive),
 * searching forward from just after `from` and wrapping once around so
 * repeating a letter cycles through every match. Returns -1 for no match
 * or an empty query.
 * @param {string[]} labels @param {string} query @param {number} from
 */
export function typeaheadIndex(labels, query, from) {
  const q = query.toLowerCase();
  if (!q || !labels.length) return -1;
  const n = labels.length;
  for (let i = 1; i <= n; i++) {
    const idx = wrap(from, i, n);
    if (labels[idx].toLowerCase().startsWith(q)) return idx;
  }
  return -1;
}

/**
 * Playful's stamped landing: a soft ink impression behind one item that
 * presses in, blooms a little past its own edge, and fades — the same
 * shape as the Button's ink-spread press (`button.core.js`'s `inkSpread`,
 * itself ported from the Wave 1 Stamp's `landing().spread`), scoped down
 * to a small blot behind a list row instead of a whole block. Timed to the
 * item's own teental beat by the caller (`delay: talaDelay(index)`), so
 * the list reads as a row of small presses landing on the tala, not a
 * simple fade-in. Null under reduced motion (`still`) or quiet-equivalent
 * `state` motion, where the entrance is a plain, instant appearance.
 * @param {'still'|'state'|'ambient'|'full'} motion
 */
export function stampLanding(motion) {
  if (motion === 'still' || motion === 'state') return null;
  return {
    frames: [
      { opacity: 0, transform: 'scale(0.6)', offset: 0 },
      { opacity: 0.42, transform: 'scale(1.08)', offset: 0.5 },
      { opacity: 0, transform: 'scale(1.18)', offset: 1 },
    ],
    timing: { duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  };
}
