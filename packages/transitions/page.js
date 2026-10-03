// Page transitions: cross-document navigation (page.css's `@view-transition
// { navigation: auto; }`, with named persistent elements) and a tiny helper
// for a same-document swap, shared by Tabs and the Kantar interlude so they
// don't each reinvent the same guard.
//
//   import { sameDocumentTransition, nextTransitionName } from
//     '…/transitions/page.js';
//
// Cross-document transitions need no JavaScript at all: link page.css, and
// give the elements that should persist across the navigation (the header,
// the scene) `data-vt="header"` or `data-vt="scene"` — the browser matches
// them by that shared view-transition-name and cross-fades or persists them
// on its own. This file is only for a swap within one page.

import { shouldAnimate } from './page.core.js';

let seq = 0;
/** A view-transition-name that is unique for this page load: `sg-vt-1`, `sg-vt-2`, … */
export const nextTransitionName = (prefix = 'sg-vt') => `${prefix}-${++seq}`;

const hasReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

/**
 * Run `update` (a synchronous DOM mutation) inside a same-document View
 * Transition when the browser has one and the visitor has not asked for
 * reduced motion; otherwise run it directly, so the swap is always correct,
 * animated or not.
 *
 * Pass `pending` with a ViewTransition you are already tracking (from an
 * earlier call that has not settled) to skip starting a second one: the
 * browser would only abort the first, and stacking transitions produces an
 * unhandled rejection for no visible benefit, so this runs `update`
 * directly instead and leaves the first transition to finish on its own.
 *
 * @param {() => void} update
 * @param {{ pending?: ViewTransition | null, reducedMotion?: boolean }} [opts]
 * @returns {ViewTransition | null} the new transition, or null when the
 *   update ran directly (call `.finished` on the result, if any, to know
 *   when to clear your own `pending` reference)
 */
export function sameDocumentTransition(update, { pending = null, reducedMotion = hasReducedMotion() } = {}) {
  const supported = typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
  if (pending || !shouldAnimate({ supported, reducedMotion })) {
    update();
    return null;
  }
  return document.startViewTransition(update);
}
