// Page transitions: the pure core. Runs in Node.
//
// Whether a navigation or a same-document swap should animate at all is one
// small decision, made the same way everywhere it is asked: only when the
// browser can do it, and only when the visitor has not asked for less
// motion. Everything else (which element is named, when the browser fires
// the swap) is the browser's own View Transitions machinery, not ours.

/**
 * @param {{ supported?: boolean, reducedMotion?: boolean }} [env]
 * @returns {boolean} whether a transition should run at all
 */
export function shouldAnimate({ supported = false, reducedMotion = false } = {}) {
  return !!supported && !reducedMotion;
}
