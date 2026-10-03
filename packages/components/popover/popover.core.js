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
 * @param {{ width: number, height: number }} viewport
 * @param {{ gap?: number, margin?: number, flipUnder?: number }} [opts]
 *   flipUnder: flip above only when the room below is under this many px
 * @returns {{ left: number, above: boolean }}
 */
export function placement(trigger, panel, viewport, { gap = 6, margin = 8, flipUnder = 160 } = {}) {
  const below = viewport.height - trigger.bottom;
  const above = trigger.top;
  const flip = below < flipUnder && above > below;
  const left = Math.max(margin, Math.min(trigger.left, viewport.width - panel.width - margin));
  return { left, above: flip };
}
