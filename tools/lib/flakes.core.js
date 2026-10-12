// The known-flake table: the "## Known flakes" section of docs/BROWSERS.md, read by
// `node tools/checks.mjs`. A red from a check listed there for the engine in hand is printed
// `FAIL (known: <cause>)` and kept out of the exit code; only new reds fail the run.
//
// The table's columns, in order: check (repo-relative path, in backticks or not), engine
// (chromium | webkit | firefox | all), cause, since (YYYY-MM-DD). Columns after those four
// (where the flake is recorded) are for people and are ignored here.

export const FLAKE_ENGINES = ['chromium', 'webkit', 'firefox', 'all'];

const cell = s => s.trim().replace(/^`(.*)`$/, '$1').trim();

/**
 * @param {string} markdown the whole of docs/BROWSERS.md
 * @returns {{ check: string, engine: string, cause: string, since: string }[]}
 * Throws on a row it cannot read, so a typo in the table never silently drops a flake (or adds one).
 */
export function parseKnownFlakes(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const start = lines.findIndex(l => /^## Known flakes\s*$/.test(l));
  if (start < 0) return [];
  const out = [];
  let header = true;
  for (let i = start + 1; i < lines.length && !/^#{1,2} /.test(lines[i]); i++) {
    const l = lines[i].trim();
    if (!l.startsWith('|')) continue; // prose around the table
    const cols = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell);
    if (header) {
      if (cols[0].toLowerCase() !== 'check') fail(i, 'the first row must be the header (Check | Engine | Cause | Since …)');
      header = false;
      continue;
    }
    if (cols.every(c => /^:?-+:?$/.test(c))) continue; // the |---| row
    const [check, engine, cause, since] = cols;
    if (!check || !/\.m?js$/.test(check)) fail(i, `"${check}" is not a check path`);
    if (!FLAKE_ENGINES.includes(engine)) fail(i, `engine "${engine}" is not one of ${FLAKE_ENGINES.join(', ')}`);
    if (!cause) fail(i, 'the cause is empty');
    if (!/^\d{4}-\d\d-\d\d$/.test(since ?? '')) fail(i, `since "${since}" is not a date (YYYY-MM-DD)`);
    out.push({ check, engine, cause, since });
  }
  return out;

  function fail(i, why) { throw new Error(`docs/BROWSERS.md line ${i + 1}, known flakes: ${why}`); }
}

/** The table's entry for this check in this engine, or null. */
export function knownFlake(flakes, check, engine) {
  return flakes.find(f => f.check === check && (f.engine === engine || f.engine === 'all')) ?? null;
}

/**
 * The run's verdict. results: { check, ok }[] in run order.
 * @returns {{ newReds: string[], known: { check: string, cause: string }[], exitCode: 0|1 }}
 */
export function verdict(results, flakes, engine) {
  const newReds = [], known = [];
  for (const { check, ok } of results) {
    if (ok) continue;
    const f = knownFlake(flakes, check, engine);
    if (f) known.push({ check, cause: f.cause });
    else newReds.push(check);
  }
  return { newReds, known, exitCode: newReds.length ? 1 : 0 };
}
