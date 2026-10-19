// The soak instrument's decisions: modes, profiles, budgets and the drift verdict. Pure; tested in soak.core.test.js.
//
// A soak is a long, quiet run of one page (or a playlist of scenes) the way a kiosk or a lobby TV runs it: nobody touches it,
// nobody reloads it, and a leak that costs 2 MB an hour is a crash on the second day. Sampled over time, the questions are
// "did anything grow" and "did frames get slower", and the answer is a verdict against the budgets below, not a feeling.

/** seconds: the run; interval: seconds between samples; warmup: seconds ignored while caches and JIT settle. */
export const MODES = {
  quick: { seconds: 120, interval: 5, warmup: 20 },     // tests and slices: catches a leak that is loud (MB a minute)
  rung: { seconds: 1800, interval: 30, warmup: 180 },    // the rigour rung: catches a leak of a few hundred KB a minute
  release: { seconds: 7200, interval: 60, warmup: 600 }, // before a release: two hours, the length of an evening event
};

/** Kiosk-like viewports: the whole screen, no devtools, one device pixel per CSS pixel. */
export const PROFILES = {
  '1080p': { width: 1920, height: 1080, dpr: 1 },
  '4k': { width: 3840, height: 2160, dpr: 1 },
};

/**
 * Every budget with its reason. A growth budget fails only when BOTH its percentage and its absolute floor are exceeded:
 * the percentage alone fails a 3 MB page that gained 0.4 MB of noise, the floor alone ignores a big page that doubled.
 */
export const BUDGETS = {
  // Median of the last window against the median of the first window after warm-up.
  heap: { pct: 10, abs: 1, unit: 'MB', why: 'JS heap after a forced collection; the lab reel held 10% over two hours, and 1 MB is below one retained texture or array' },
  nodes: { pct: 5, abs: 50, unit: 'nodes', why: 'DOM nodes including detached ones (Memory.getDOMCounters counts them), so a node removed but still referenced shows; 50 allows a toast or a caption' },
  documents: { pct: 0, abs: 2, unit: 'docs', why: 'documents the browser holds; an unmounted scene iframe that is never freed adds one each time; 2 allows one in transition' },
  listeners: { pct: 10, abs: 50, unit: 'listeners', why: 'JS event listeners; a mount that adds one and an unmount that never removes it is the commonest slow leak' },
  canvasMpx: { pct: 5, abs: 0.5, unit: 'Mpx', why: 'megapixels of live canvases; a scene that makes a layer per mount and forgets it; 0.5 Mpx is a small offscreen buffer' },
  // Frame time: median of per-window p95, last window over first window.
  p95: { ratio: 1.15, diffMs: 2, loadedRatio: 2, why: 'a steady scene keeps its p95; 15% slower, and more than 2 ms (frames land on 16.7 ms vsync steps, so 16.7 vs 17.2 is noise). On a busy machine (loadedCpuPct) contention can drift frames too, so a drift is not judged unless it is also over loadedRatio, which no contention explains' },
  longTasks: { factor: 2, plus: 3, why: 'tasks over 50 ms in the last window against twice the first window plus 3' },
  errors: { max: 0, why: 'a console error, page error, failed request or crash in hours is a screen that went wrong in front of guests' },
  // Above this the machine itself is the main thing being measured.
  loadedCpuPct: 60,
  // Fewer post-warm-up samples than this and a window is a handful of points: say "not judged" rather than guess.
  minSamples: 8,
};

export const median = xs => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Theil-Sen slope: the median of all pairwise slopes. One spike (a GC the collector missed) cannot tilt it, as it would a least-squares line. */
export function theilSen(xs, ys) {
  const slopes = [];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
    if (xs[j] !== xs[i] && Number.isFinite(ys[i]) && Number.isFinite(ys[j])) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
  }
  return median(slopes);
}

/** First against last window of a series; ok unless both the percentage and the absolute budget are exceeded. */
export function growth(first, last, budget) {
  const base = median(first), end = median(last);
  const abs = end - base;
  const pct = base ? (end / base - 1) * 100 : (abs > 0 ? Infinity : 0);
  return { base, end, abs, pct, ok: !(pct > budget.pct && abs > budget.abs) };
}

/**
 * @typedef {{ t: number, heapMB: number, nodes: number, docs: number, listeners: number, canvasMpx: number,
 *   frames: { count: number, mean: number, p95: number }, longTasks: number, cpuBusy: number }} Sample  t in seconds since the run began
 * @param {Sample[]} samples
 * @param {{ warmup: number, errors?: string[], budgets?: typeof BUDGETS }} o
 */
export function evaluate(samples, { warmup, errors = [], budgets = BUDGETS }) {
  const after = samples.filter(s => s.t > warmup);
  const judged = after.length >= budgets.minSamples;
  const win = Math.max(3, Math.floor(after.length / 3));
  const first = after.slice(0, win), last = after.slice(-win);
  const col = (rs, k) => rs.map(r => r[k]);
  const series = (k, name) => growth(col(first, k), col(last, k), budgets[name]);
  const heap = series('heapMB', 'heap'), nodes = series('nodes', 'nodes'), documents = series('docs', 'documents');
  const listeners = series('listeners', 'listeners'), canvasMpx = series('canvasMpx', 'canvasMpx');
  heap.slopeMBPerHour = theilSen(col(after, 't'), col(after, 'heapMB')) * 3600;
  nodes.slopePerHour = theilSen(col(after, 't'), col(after, 'nodes')) * 3600;

  const solid = rs => rs.filter(r => r.frames && r.frames.count >= 30);
  const p95 = {
    first: median(solid(first).map(r => r.frames.p95)), last: median(solid(last).map(r => r.frames.p95)),
    meanFirst: median(solid(first).map(r => r.frames.mean)), meanLast: median(solid(last).map(r => r.frames.mean)),
  };
  p95.ratio = p95.last / p95.first;
  p95.diffMs = p95.last - p95.first;
  const busy = col(after.length ? after : samples, 'cpuBusy'); // after warm-up: a hot start must not colour the whole run
  const load = { median: median(busy), max: Math.max(...busy.filter(Number.isFinite), 0) };
  load.loaded = load.median > budgets.loadedCpuPct;
  const noFrames = !Number.isFinite(p95.ratio);
  const drift = p95.ratio > budgets.p95.ratio && p95.diffMs > budgets.p95.diffMs;
  // Under load the machine's own contention drifts frame times, so a drift is "not judged", never a pass; the leaks above are
  // counts of things and are still judged. A drift past loadedRatio (x2) fails even so: contention does not double a steady scene.
  const muted = drift && load.loaded && !(p95.ratio > budgets.p95.loadedRatio);
  p95.judged = !muted && !noFrames;
  p95.status = noFrames ? 'no frames' : muted ? 'not judged (machine busy)' : load.loaded ? (drift ? 'drift (machine busy, over x' + budgets.p95.loadedRatio + ')' : 'steady (machine busy)') : drift ? 'drift' : 'steady';
  p95.ok = !drift || muted;

  const sum = rs => col(rs, 'longTasks').reduce((a, b) => a + (b || 0), 0);
  const longTasks = { first: sum(first), last: sum(last) };
  longTasks.ok = longTasks.last <= budgets.longTasks.factor * longTasks.first + budgets.longTasks.plus;

  const err = { count: errors.length, first: errors.slice(0, 8), ok: errors.length <= budgets.errors.max };
  const checks = { heap, nodes, documents, listeners, canvasMpx, p95, longTasks, errors: err };
  const failed = Object.entries(checks).filter(([k, v]) => !v.ok && (judged || k === 'errors')).map(([k]) => k);
  const overall = failed.length ? 'fail' : judged && p95.judged !== false ? 'pass' : 'not-judged';
  return {
    judged, overall, failed, samples: samples.length, afterWarmup: after.length, window: win,
    windows: { first: [first[0]?.t, first.at(-1)?.t], last: [last[0]?.t, last.at(-1)?.t] },
    ...checks, load,
  };
}

const f = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');
const mark = (ok, judged = true) => (!judged ? 'n/j ' : ok ? 'ok  ' : 'FAIL');
const sign = x => (x >= 0 ? '+' : '');

/** The plain-text verdict. */
export function formatReport(v, { target, profile, mode, seconds, cores = 0 } = {}) {
  const lines = [];
  lines.push(`Soak ${target ?? ''} ${profile ?? ''} ${mode ?? ''}: ${f(seconds ?? 0, 0)} s, ${v.samples} samples (${v.afterWarmup} after warm-up; windows of ${v.window})`);
  lines.push(`Verdict: ${v.overall.toUpperCase()}${v.failed.length ? ` (${v.failed.join(', ')})` : ''}${v.overall === 'not-judged' ? ' (too few samples after warm-up to judge growth)' : ''}${v.overall === 'not-judged' && v.judged ? ' (frame time drift under a busy machine: rerun when it is quiet)' : ''}`);
  const g = (name, x, unit, b) => `  ${mark(x.ok, v.judged)} ${name.padEnd(11)} ${f(x.base)} -> ${f(x.end)} ${unit} (${Number.isFinite(x.pct) ? `${sign(x.pct)}${f(x.pct)}%` : 'from 0'}, ${sign(x.abs)}${f(x.abs)})   budget: ${b.pct}% and ${b.abs} ${b.unit} together`;
  lines.push(g('heap', v.heap, 'MB', BUDGETS.heap) + (v.judged ? `;  slope ${f(v.heap.slopeMBPerHour, 2)} MB/h` : ''));
  lines.push(g('DOM nodes', v.nodes, '', BUDGETS.nodes) + (v.judged ? `;  slope ${f(v.nodes.slopePerHour, 0)}/h` : ''));
  lines.push(g('documents', v.documents, '', BUDGETS.documents));
  lines.push(g('listeners', v.listeners, '', BUDGETS.listeners));
  lines.push(g('canvas Mpx', v.canvasMpx, 'Mpx', BUDGETS.canvasMpx));
  lines.push(`  ${mark(v.p95.ok, v.judged && v.p95.judged !== false)} frame p95   ${f(v.p95.first)} -> ${f(v.p95.last)} ms (x${f(v.p95.ratio, 2)}, ${sign(v.p95.diffMs)}${f(v.p95.diffMs)} ms; mean ${f(v.p95.meanFirst)} -> ${f(v.p95.meanLast)})  ${v.p95.status}   budget: x${BUDGETS.p95.ratio} and ${BUDGETS.p95.diffMs} ms together`);
  lines.push(`  ${mark(v.longTasks.ok, v.judged)} long tasks  ${v.longTasks.first} -> ${v.longTasks.last} per window   budget: x${BUDGETS.longTasks.factor} + ${BUDGETS.longTasks.plus}`);
  lines.push(`  ${mark(v.errors.ok)} errors      ${v.errors.count}${v.errors.count ? '\n    ' + v.errors.first.join('\n    ') : ''}`);
  lines.push(`Machine CPU busy during the run: median ${f(v.load.median, 0)}%, max ${f(v.load.max, 0)}%${cores ? ` on ${cores} cores` : ''}${v.load.loaded ? `  -- ABOVE ${BUDGETS.loadedCpuPct}%: a frame drift under x${BUDGETS.p95.loadedRatio} is not judged` : ''}`);
  return lines.join('\n');
}
