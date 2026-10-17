// Popover: the pure core. Runs in Node.
//
// The native popover API does the opening, closing, focus and light-dismiss.
// This file holds the one piece of real logic: where to place the panel in
// browsers without CSS anchor positioning, given the trigger's box, the
// panel's size and the viewport. Above when there is more room above than
// below and the panel would not fit below; below otherwise. Kept inside the
// viewport horizontally with an 8px margin.

export const STRINGS = {};

/**
 * @param {{ left: number, top: number, bottom: number, width: number }} trigger
 * @param {{ width: number, height: number }} panel
 * @param {{ width: number, height: number, left?: number, top?: number }} viewport  visibleBox(), or a bare size at 0,0
 * @param {{ gap?: number, margin?: number, flipUnder?: number }} [opts]
 *   flipUnder: flip above only when the room below is under this many px
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
