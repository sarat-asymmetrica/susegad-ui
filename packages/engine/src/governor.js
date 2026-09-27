// governor.js: the quality governor, grown from Paus. Pure logic, no clock of
// its own: feed it frame times and it answers with a detail level.
//
// It watches the mean frame time over a window. Slow for a whole window, it
// steps down; calm for `patience` windows in a row, it steps back up. Each
// time a step up proves too hopeful, patience doubles, so a borderline
// machine settles instead of see-sawing. A fast machine never leaves `max`.

/** @typedef {{ level: number, mean: number, onchange: ((level: number, prev: number) => void) | null,
 *   sample: (dtMs: number) => number, reset: () => void }} Governor
 *   mean is in ms over the last full window; reset() goes back to max. */

/**
 * @param {{ target?: number, min?: number, max?: number, window?: number, step?: number,
 *   slow?: number, fast?: number, patience?: number,
 *   onchange?: ((level: number, prev: number) => void) | null }} [opts]
 *   target: frame budget in ms. slow / fast: multiples of target that count as
 *   struggling / comfortable. On a display locked at 30 Hz, pass target 1000/30.
 * @returns {Governor}
 */
export function createGovernor({
  target = 1000 / 60, min = 0.25, max = 1, window = 60, step = 0.25,
  slow = 1.5, fast = 1.2, patience = 4, onchange = null,
} = {}) {
  const buf = new Float64Array(window);
  let n = 0, head = 0, sum = 0, calm = 0, wait = window * patience, rose = false;

  const clear = () => { n = head = sum = calm = 0; };
  function set(v) {
    const prev = g.level;
    g.level = Math.min(max, Math.max(min, Math.round(v * 1e4) / 1e4));
    clear();
    if (g.level !== prev) g.onchange?.(g.level, prev);
  }

  /** @type {Governor} */
  const g = {
    level: max,
    mean: target,
    onchange,
    sample(dt) {
      // a hidden tab, a seek or a bad clock tells us nothing about the machine
      if (!(dt > 0) || dt > 250) return g.level;
      sum += dt - (n === window ? buf[head] : 0);
      buf[head] = dt; head = (head + 1) % window;
      if (n < window) { n++; if (n < window) return g.level; }
      const mean = g.mean = sum / window;
      if (mean > target * slow) {
        if (g.level > min) { if (rose) wait *= 2; rose = false; set(g.level - step); }
        else calm = 0;
      } else if (mean < target * fast) {
        if (++calm >= wait && g.level < max) { rose = true; set(g.level + step); }
      } else calm = 0;
      return g.level;
    },
    reset() { wait = window * patience; rose = false; g.mean = target; set(max); },
  };
  return g;
}
