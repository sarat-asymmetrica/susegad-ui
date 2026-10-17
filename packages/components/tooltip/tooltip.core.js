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
 * @param {{ width: number, height: number, left?: number, top?: number }} viewport  visibleBox(), or a bare size at 0,0
 * @param {{ gap?: number, margin?: number }} [opts]
 * @returns {{ left: number, above: boolean }}
 */
export function placement(trigger, panel, viewport, { gap = 8, margin = 8 } = {}) {
  const vl = viewport.left || 0, vt = viewport.top || 0;
  const above = trigger.top - vt;
  const below = vt + viewport.height - trigger.bottom;
  const needed = panel.height + gap;
  const wantAbove = above >= needed || above >= below;
  const center = trigger.left + trigger.width / 2;
  const left = Math.max(vl + margin, Math.min(center - panel.width / 2, vl + viewport.width - panel.width - margin));
  return { left, above: wantAbove };
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

/**
 * The gap between trigger and panel, in px, from the --sg-tooltip-gap custom property's text (tooltip.css owns the
 * number; the fallback placement reads it instead of repeating it). Takes px, rem and em; anything else, or nothing,
 * is the stylesheet's own default.
 * @param {string} value  e.g. getComputedStyle(el).getPropertyValue('--sg-tooltip-gap')
 * @param {number} [rem]  the root font size in px, for rem and em
 */
export function parseGap(value, rem = 16, fallback = 8) {
  const m = /^\s*(-?\d*\.?\d+)(px|rem|em)\s*$/.exec(String(value ?? ''));
  if (!m) return fallback;
  const n = parseFloat(m[1]);
  return m[2] === 'px' ? n : n * rem;
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
