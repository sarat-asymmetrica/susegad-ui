// Rampon koel: the pure half. The bout pattern (a real koel's calls speed
// up, then it goes quiet for a while) and which birds count as "on screen".
// Runs in Node; rampon-koel.js is the thin side-effecting half that plays it.

/** True while at least one bird is inside the visible band (not out in the wrap-around margin). */
export function anyVisible(xs, W) {
  return xs.some(x => x > -20 && x < W + 20);
}

/**
 * The gaps, in seconds, between the calls in one bout of `n` calls, each one
 * a little faster than the last (real koel bouts speed up, not slow down).
 * @returns {number[]} n - 1 gaps
 */
export function bout(n = 3, first = 1.1, shrink = 0.72) {
  const gaps = [];
  let g = first;
  for (let i = 0; i < n - 1; i++) { gaps.push(+g.toFixed(3)); g *= shrink; }
  return gaps;
}

/** The two rising notes of one "ku-oo" call, in Hz. */
export const CALL_NOTES = [520, 780];
