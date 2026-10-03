// Tooltip: the pure core. Runs in Node.
//
// A tooltip's text lives in the trigger's accessible description
// (aria-describedby) always, whether or not it is visually shown: a
// screen reader must never depend on hover to learn it, and neither
// should anyone reading without JavaScript (the CSS shows it on :hover
// and :focus-visible with no script at all). This file holds the one
// piece of real logic: where to place the panel above or below the
// trigger, centred on it, given the trigger's box, the panel's size and
// the viewport.

export const STRINGS = {};

/**
 * Prefers above the trigger, the common tooltip position; flips below when
 * there is not enough room above and more room below. Centred horizontally
 * on the trigger, clamped inside the viewport.
 * @param {{ left: number, top: number, bottom: number, width: number }} trigger
 * @param {{ width: number, height: number }} panel
 * @param {{ width: number, height: number }} viewport
 * @param {{ gap?: number, margin?: number }} [opts]
 * @returns {{ left: number, above: boolean }}
 */
export function placement(trigger, panel, viewport, { gap = 8, margin = 8 } = {}) {
  const above = trigger.top;
  const below = viewport.height - trigger.bottom;
  const needed = panel.height + gap;
  const wantAbove = above >= needed || above >= below;
  const center = trigger.left + trigger.width / 2;
  const left = Math.max(margin, Math.min(center - panel.width / 2, viewport.width - panel.width - margin));
  return { left, above: wantAbove };
}

/**
 * Whether the platform's own `popover="hint"` is understood (as opposed to
 * falling back silently to "manual" or the invalid-value default of
 * "auto"), checked once by reading the attribute back. Pure, but needs a
 * document; returns false in Node.
 */
export function hintSupported(doc = typeof document !== 'undefined' ? document : null) {
  if (!doc) return false;
  try {
    const el = doc.createElement('div');
    el.popover = 'hint';
    return el.popover === 'hint';
  } catch { return false; }
}
