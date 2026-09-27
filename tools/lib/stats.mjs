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
