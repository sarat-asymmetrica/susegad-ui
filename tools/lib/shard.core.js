// Split the selected checks into n shards of about equal expected time. The pure half of
// `node tools/checks.mjs --shard=<i>/<n>`; tools/lib/check-durations.json holds the times.
//
// Balancing is greedy, longest first: take the checks from slowest to fastest (ties by path) and
// put each in the shard with the least expected time so far (ties to the lower shard). The same
// selection, table and n always give the same shards, so n CI jobs that each run one shard run
// every check exactly once.

/** Seconds a check counts for when the table has no entry for it. */
export const DEFAULT_SECONDS = 30;

/** "2/4" -> { index: 2, count: 4 } (1-based). Throws on anything else. */
export function parseShard(text) {
  const m = /^(\d+)\/(\d+)$/.exec(String(text ?? '').trim());
  if (!m) throw new Error(`--shard takes <i>/<n>, like 1/4; got "${text}"`);
  const index = Number(m[1]), count = Number(m[2]);
  if (count < 1 || index < 1 || index > count) throw new Error(`--shard=${text}: i must be between 1 and n, and n at least 1`);
  return { index, count };
}

/**
 * Expected seconds for one check in one engine. An entry is a number (every engine) or
 * { chromium, webkit, firefox }; an engine missing from an entry takes the slowest engine it does
 * have, and a check missing from the table takes DEFAULT_SECONDS. Keys starting with "$" are notes.
 */
export function durationOf(table, check, engine) {
  const e = table?.[check];
  if (typeof e === 'number' && Number.isFinite(e)) return e;
  if (e && typeof e === 'object') {
    if (Number.isFinite(e[engine])) return e[engine];
    const known = Object.values(e).filter(Number.isFinite);
    if (known.length) return Math.max(...known);
  }
  return DEFAULT_SECONDS;
}

/**
 * @param {string[]} checks repo-relative paths
 * @param {{ count: number, seconds: (check: string) => number }} opts
 * @returns {{ checks: string[], total: number }[]} count shards; each shard's checks in path order
 */
export function shardChecks(checks, { count, seconds }) {
  const shards = Array.from({ length: count }, () => ({ checks: [], total: 0 }));
  const order = [...new Set(checks)]
    .map(check => ({ check, s: seconds(check) }))
    .sort((a, b) => b.s - a.s || (a.check < b.check ? -1 : a.check > b.check ? 1 : 0));
  for (const { check, s } of order) {
    let lightest = shards[0];
    for (const sh of shards) if (sh.total < lightest.total) lightest = sh; // strict <: ties stay with the lower shard
    lightest.checks.push(check);
    lightest.total += s;
  }
  for (const sh of shards) {
    sh.checks.sort();
    sh.total = Math.round(sh.total * 10) / 10;
  }
  return shards;
}

/**
 * Per-check durations from a GitHub Actions log of `node tools/checks.mjs` (the text of
 * `gh run view <id> --log`). Lines are "<job>\t<step>\t<ISO time> <message>"; the job name holds
 * the engine, "check (webkit)". A browser check's time is the gap from the line before it (the
 * "Running N checks" line, or the previous check's result) to its own "pass  <path>" or
 * "FAIL  <path>" line. A Node-only check prints its own time ("(node only, 12.3 s)").
 * A FAIL whose last line is "Node.js v…" crashed before it ran anything, so its gap says nothing
 * about how long the check takes: it is left out, and the engines that did run it stand in.
 * @returns {Record<string, Record<string, number>>} check -> engine -> seconds (one decimal)
 */
export function durationsFromLog(text) {
  const out = {};
  const last = {}; // engine -> ms of the previous mark
  for (const line of String(text).split(/\r?\n/)) {
    const cols = line.split('\t');
    if (cols.length < 3) continue;
    const engine = /\((chromium|webkit|firefox)\)/.exec(cols[0])?.[1];
    if (!engine) continue;
    const m = /^(\d{4}-\d\d-\d\dT[\d:.]+Z) (.*)$/.exec(cols.slice(2).join('\t'));
    if (!m) continue;
    const t = Date.parse(m[1]), msg = m[2];
    if (/^Running \d+ checks? in /.test(msg)) { last[engine] = t; continue; }
    const node = /^(pass|FAIL)(?: \(known: .*?\))? {2}(\S+\.m?js) .*\(node only, ([\d.]+) s\)\s*$/.exec(msg);
    if (node) { (out[node[2]] ??= {})[engine] = Number(node[3]); continue; }
    const r = /^(pass|FAIL)(?: \(known: .*?\))? {2}(\S+\.m?js)(?: {2}(.*))?$/.exec(msg); // "FAIL (known: …)" is a known flake's red
    if (!r || last[engine] === undefined) continue;
    const crashed = r[1] === 'FAIL' && /^Node\.js v\d/.test(r[3] ?? '');
    if (!crashed) (out[r[2]] ??= {})[engine] = Math.round((t - last[engine]) / 100) / 10;
    last[engine] = t;
  }
  return out;
}
