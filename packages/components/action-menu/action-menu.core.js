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
 * @param {{ width: number, height: number, left?: number, top?: number }} viewport  visibleBox(), or a bare size at 0,0
 * @param {{ gap?: number, margin?: number, flipUnder?: number }} [opts]
 * @returns {{ left: number, above: boolean }}
 */
export function placement(trigger, panel, viewport, { gap = 6, margin = 8, flipUnder = 160 } = {}) {
  const vl = viewport.left || 0, vt = viewport.top || 0;
  const below = vt + viewport.height - trigger.bottom;
  const above = trigger.top - vt;
  const flip = below < flipUnder && above > below;
  const left = Math.max(vl + margin, Math.min(trigger.left, vl + viewport.width - panel.width - margin));
  return { left, above: flip };
}

/**
 * The part of the page a person can see, in layout-viewport coordinates (the ones getBoundingClientRect and
 * position: fixed use). Not window.innerWidth: mobile Chromium widens it to fit overflowing content, and a panel
 * placed against that spills past the phone. The visual viewport is the honest box (it also follows pinch zoom);
 * without one, the document's own clientWidth stands in.
 * @param {{ visualViewport?: { offsetLeft: number, offsetTop: number, width: number, height: number } | null,
 *   innerWidth: number, innerHeight: number, document?: { documentElement?: { clientWidth: number } } }} win
 * @returns {{ left: number, top: number, width: number, height: number }}
 */
export function visibleBox(win) {
  const vv = win.visualViewport;
  if (vv && vv.width > 0) return { left: vv.offsetLeft, top: vv.offsetTop, width: vv.width, height: vv.height };
  const cw = win.document?.documentElement?.clientWidth;
  return { left: 0, top: 0, width: cw > 0 ? Math.min(cw, win.innerWidth) : win.innerWidth, height: win.innerHeight };
}

/**
 * How far to slide a placed panel sideways so it sits inside the visible box with a margin. 0 when it already does;
 * a panel wider than the room starts at the left margin.
 * @param {{ left: number, right: number, width: number }} rect  the panel as measured
 * @param {{ left: number, width: number }} box  visibleBox()
 */
export function fitShift(rect, box, margin = 8) {
  const min = box.left + margin, max = box.left + box.width - margin;
  if (rect.width > max - min || rect.left < min) return min - rect.left;
  if (rect.right > max) return max - rect.right;
  return 0;
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
