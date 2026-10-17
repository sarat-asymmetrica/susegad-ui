// Frame and byte statistics for the perf probe. Pure; tested in stats.test.mjs.

/** Nearest-rank percentile of an unsorted array; p in [0, 100]. */
export function percentile(values, p) {
  if (!values.length) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * s.length);
  return s[Math.min(s.length, Math.max(1, rank)) - 1];
}

/**
 * Summarise frame intervals (ms). A frame that took k vsync intervals dropped k-1 frames.
 * @param {number[]} frames
 * @param {number} [vsync] the display interval in ms (60 Hz by default)
 */
export function frameStats(frames, vsync = 1000 / 60) {
  if (!frames.length) return { count: 0, mean: NaN, p95: NaN, worst: NaN, dropped: 0, fps: NaN };
  const total = frames.reduce((s, f) => s + f, 0);
  const mean = total / frames.length;
  let dropped = 0;
  // Rounding absorbs timer jitter: 24 ms is one slightly late frame, 30 ms is one dropped.
  for (const f of frames) dropped += Math.max(0, Math.round(f / vsync) - 1);
  return {
    count: frames.length,
    mean,
    p95: percentile(frames, 95),
    worst: Math.max(...frames),
    dropped,
    fps: 1000 / mean,
  };
}

/**
 * Group script bytes by folder so each piece's own weight is visible.
 * packages/scenes/<n>/... and packages/components/<n>/... group at depth 3,
 * other packages/<x>/... at depth 2, anything else by its first folder.
 * @param {{ path: string, bytes: number }[]} entries URL pathnames and byte counts
 */
export function bytesByFolder(entries) {
  const groups = new Map();
  for (const { path, bytes } of entries) {
    const parts = path.replace(/^\/+/, '').split('/');
    let depth = 1;
    if (parts[0] === 'packages') depth = (parts[1] === 'scenes' || parts[1] === 'components') ? 3 : 2;
    else if (parts[0] === 'tools' || parts[0] === 'apps') depth = 2;
    const key = parts.length > depth ? parts.slice(0, depth).join('/') : (parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)');
    const g = groups.get(key) || { folder: key, bytes: 0, files: 0 };
    g.bytes += bytes; g.files += 1;
    groups.set(key, g);
  }
  return [...groups.values()].sort((a, b) => b.bytes - a.bytes);
}

/** Target mean over baseline mean, and whether it sits within the allowed slack (0.10 = 10%). */
export function baselineRatio(target, baseline, slack = 0.10) {
  const ratio = target / baseline;
  return { ratio, within: Number.isFinite(ratio) && ratio <= 1 + slack };
}

export const fmtMs = v => Number.isFinite(v) ? `${v.toFixed(1)} ms` : 'n/a';
export const fmtKB = b => `${(b / 1024).toFixed(1)} KB`;

/** Seeded generator (mulberry32), so a bootstrap interval is the same on every run of the same rounds. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bootstrap interval of the mean of per-round ratios. The round is the unit that is resampled, not the
 * frame: a burst of machine load lands on a whole round, so frames inside it are not independent.
 * @param {number[]} ratios one target/baseline ratio per round
 * @param {{ level?: number, resamples?: number, seed?: number }} [o]
 * @returns {{ mean: number, lo: number, hi: number }}
 */
export function bootstrapRatio(ratios, { level = 0.95, resamples = 2000, seed = 1 } = {}) {
  const r = ratios.filter(Number.isFinite);
  if (!r.length) return { mean: NaN, lo: NaN, hi: NaN };
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  const next = rng(seed), means = [];
  for (let i = 0; i < resamples; i++) {
    let s = 0;
    for (let j = 0; j < r.length; j++) s += r[Math.floor(next() * r.length)];
    means.push(s / r.length);
  }
  const tail = (1 - level) / 2;
  return { mean, lo: percentile(means, 100 * tail), hi: percentile(means, 100 * (1 - tail)) };
}

/**
 * The perf verdict from the rounds' ratios against a budget (slack 0.10 = 10% over the baseline).
 * within: the interval's upper bound is under the budget. over: its lower bound is over it.
 * Anything else, including too few rounds to say, is inconclusive.
 * @param {number[]} ratios
 */
export function perfVerdict(ratios, slack = 0.10, opts = {}) {
  const budget = 1 + slack;
  const { capped = false, ...boot } = opts;
  const ci = bootstrapRatio(ratios, boot);
  let verdict = 'inconclusive';
  if (Number.isFinite(ci.lo) && Number.isFinite(ci.hi) && ratios.length >= 2) {
    if (ci.hi < budget) verdict = 'within';
    else if (ci.lo > budget) verdict = 'over';
  }
  // Both sides pinned to the display interval: every round's ratio is 1.00 whatever the piece costs, so
  // a zero-width interval is not evidence of headroom. It is not "within" either.
  if (capped && verdict !== 'over') return { verdict: 'capped', budget, rounds: ratios.length, ...ci, note: CAPPED_NOTE };
  return { verdict, budget, rounds: ratios.length, ...ci };
}

export const CAPPED_NOTE = 'capped: both at vsync, no headroom measured (run with --uncapped to compare the cost per frame)';

/**
 * Are both sides sitting at the vsync cap? Each side's frames must average at the display interval (not
 * under it, which would be uncapped, and not over it, which is dropping frames) with little spread.
 * @param {number[]} target frame intervals (ms)
 * @param {number[]} baseline frame intervals (ms)
 */
export function vsyncCapped(target, baseline, vsync = 1000 / 60) {
  const atCap = frames => {
    if (frames.length < 10) return false;
    const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
    const sd = Math.sqrt(frames.reduce((a, f) => a + (f - mean) ** 2, 0) / frames.length);
    return mean >= 0.9 * vsync && mean <= 1.05 * vsync && sd / mean <= 0.2;
  };
  return atCap(target) && atCap(baseline);
}

/**
 * Was the run itself under load? `during` is the CPU busy percent across the whole measurement (the browser's own
 * work is in it): over the limit the result is stamped "under load". It is never refused for this figure. A refusal
 * margin above the limit (50%) was tried and dropped: the browser alone, CPU-rendering WebGL on a 4-core machine,
 * may well read over it on a quiet night, and no quiet-machine figure was measured to set the margin from.
 * OWED: measure the browser alone once on a quiet machine (perf.mjs --force on a lone scene, nothing else running),
 * record the figure and the date here, and only then consider a during-run refusal again. The pre-run gate (loadGate) refuses at 30%.
 */
export function runLoad({ during, limit = BUSY_LIMIT }) {
  return { stamp: during > limit };
}

export const BUSY_LIMIT = 30;

/**
 * The load gate. `sample` is async and returns the CPU busy percent over a short window (injected, so
 * the rule is testable without a machine). Above the limit the run is "not measured" unless forced,
 * and a forced run is stamped "under load".
 * @returns {Promise<{ measure: boolean, busy: number, underLoad: boolean, message: string|null }>}
 */
export async function loadGate({ sample, limit = BUSY_LIMIT, force = false }) {
  const busy = await sample();
  const underLoad = busy > limit;
  if (!underLoad) return { measure: true, busy, underLoad: false, message: null };
  if (force) return { measure: true, busy, underLoad: true, message: `under load: the machine was ${busy}% busy before the run (--force)` };
  return { measure: false, busy, underLoad: true, message: `not measured: the machine is ${busy}% busy (limit ${limit}%); run again when it is quiet, or --force to measure anyway` };
}
