// Scroll sections: the pure core. Runs in Node.
//
// Ported from the Ghat plate's approach (packages/scenes are pure model +
// renderer; Ghat itself reads scroll the same way): how far a section has
// travelled through the viewport is one number, 0 to 1, read from its own
// box and the viewport's height. No DOM: this file only does the
// arithmetic; scroll-section.js reads the real rectangle and calls in.

export const STRINGS = {};

export const clamp01 = v => Math.max(0, Math.min(1, v));

/**
 * How far a section has travelled through the viewport, 0 (about to enter)
 * to 1 (fully passed), from its own box and the viewport height. The same
 * shape as Ghat's scrollProgress(): the section is "half travelled" when
 * its middle crosses the viewport's middle, softened by `ease` so the
 * reveal starts a little before the section's top reaches the bottom edge
 * and finishes a little after its bottom reaches the top.
 * @param {{ top: number, height: number }} rect the section's
 *   getBoundingClientRect(), in viewport pixels (top may be negative)
 * @param {number} viewportHeight
 * @param {{ ease?: number }} [opts] how much of the viewport and the
 *   section's own height count as the transition zone (Ghat uses 0.55)
 */
export function progressFromRect(rect, viewportHeight, { ease = 0.55 } = {}) {
  const vh = Math.max(1, viewportHeight);
  const span = vh * ease + rect.height * ease;
  return clamp01((vh - rect.top) / Math.max(1, span));
}

/**
 * Whether the section is close enough to the viewport to bother tracking
 * scroll for it (used to gate the rAF loop so an off-screen section costs
 * nothing — the engine's own pause-off-screen discipline, A4).
 * @param {{ top: number, bottom: number }} rect
 * @param {number} viewportHeight
 * @param {number} [margin] extra viewport-heights of slack on each side
 */
export function isNearViewport(rect, viewportHeight, margin = 0.5) {
  const slack = Math.max(1, viewportHeight) * margin;
  return rect.bottom > -slack && rect.top < viewportHeight + slack;
}
