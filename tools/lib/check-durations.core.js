// The log side of tools/lib/check-durations.mjs, pure so it is tested. A sharded CI run names its
// jobs "check (chromium 2/4)", and the shards of an engine run side by side, so their lines
// interleave in time. durationsFromLog (shard.core.js) reads the gap from one line to the one
// before it, which only means something inside one job: split the log by job first, then merge.
import { durationsFromLog } from './shard.core.js';

/** @returns {Record<string, Record<string, number>>} check -> engine -> seconds, over every job in the log */
export function durationsFromShardedLog(text) {
  const byJob = new Map();
  for (const line of String(text).replace(/^﻿/, '').split(/\r?\n/)) {
    const job = line.split('\t')[0];
    const engine = /\((chromium|webkit|firefox)(?: \d+\/\d+)?\)$/.exec(job)?.[1];
    if (!engine) continue;
    if (!byJob.has(job)) byJob.set(job, []);
    byJob.get(job).push(`check (${engine})${line.slice(job.length)}`);
  }
  const out = {};
  for (const lines of byJob.values())
    for (const [check, engines] of Object.entries(durationsFromLog(lines.join('\n'))))
      Object.assign((out[check] ??= {}), engines);
  return out;
}
