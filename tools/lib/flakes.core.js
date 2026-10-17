// The known-flake table: the "## Known flakes" section of docs/BROWSERS.md, read by
// `node tools/checks.mjs`. A red from a check listed there, in the engine named, whose failing
// line matches the row's clause, is printed `FAIL (known: <cause>)` and kept out of the exit code.
// Everything else is a new red: a red in a listed file whose failing line the clause does not name,
// a red after the row has expired, a red in another engine.
//
// The table's columns, in order: check (repo-relative path, in backticks or not), engine
// (chromium | webkit | firefox | all), clause, cause, added (YYYY-MM-DD), until (YYYY-MM-DD, or empty
// for 14 days after `added`). Columns after those (where the flake is recorded) are for people and
// are ignored here.
//
// The clause says which failing check line the row excuses. It is matched against the printed red:
// the `FAIL  <name>  (<detail>)` line and the indented lines under it. It is `*` (the whole file; the
// escape hatch, and it still expires), `/regex/` (flags after the closing slash), or plain text (a
// case-insensitive substring). Keep `|` out of the cells: it ends the cell.

export const FLAKE_ENGINES = ['chromium', 'webkit', 'firefox', 'all'];
export const FLAKE_DAYS = 14;

const cell = s => s.trim().replace(/^`(.*)`$/, '$1').trim();
const isDate = s => /^\d{4}-\d\d-\d\d$/.test(s ?? '') && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** YYYY-MM-DD plus n days (UTC, so a daylight-saving change never moves it). */
export function addDays(date, n) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Today as YYYY-MM-DD in UTC. */
export const today = () => new Date().toISOString().slice(0, 10);

/**
 * @param {string} markdown the whole of docs/BROWSERS.md
 * @returns {{ check: string, engine: string, clause: string, cause: string, added: string, until: string }[]}
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
      const want = ['check', 'engine', 'clause', 'cause', 'added', 'until'];
      if (!want.every((w, k) => (cols[k] ?? '').toLowerCase() === w)) fail(i, `the first row must be the header (${want.join(' | ')} …)`);
      header = false;
      continue;
    }
    if (cols.every(c => /^:?-+:?$/.test(c))) continue; // the |---| row
    const [check, engine, clause, cause, added, until = ''] = cols;
    if (!check || !/\.m?js$/.test(check)) fail(i, `"${check}" is not a check path`);
    if (!FLAKE_ENGINES.includes(engine)) fail(i, `engine "${engine}" is not one of ${FLAKE_ENGINES.join(', ')}`);
    if (!clause) fail(i, 'the clause is empty (name the failing line, or * for the whole file)');
    if (/^\/.*\/[a-z]*$/.test(clause)) { try { toRegExp(clause); } catch (e) { fail(i, `clause ${clause} is not a regular expression (${e.message})`); } }
    if (!cause) fail(i, 'the cause is empty');
    if (!isDate(added)) fail(i, `added "${added}" is not a date (YYYY-MM-DD)`);
    if (until && !isDate(until)) fail(i, `until "${until}" is not a date (YYYY-MM-DD, or empty for ${FLAKE_DAYS} days after added)`);
    out.push({ check, engine, clause, cause, added, until: until || addDays(added, FLAKE_DAYS) });
  }
  return out;

  function fail(i, why) { throw new Error(`docs/BROWSERS.md line ${i + 1}, known flakes: ${why}`); }
}

function toRegExp(clause) {
  const m = /^\/(.*)\/([a-z]*)$/.exec(clause);
  return new RegExp(m[1], m[2]);
}

/** Does the row's clause name this printed red? */
export function clauseMatches(clause, text) {
  if (clause === '*') return true;
  if (/^\/.*\/[a-z]*$/.test(clause)) return toRegExp(clause).test(text);
  return text.toLowerCase().includes(clause.toLowerCase());
}

/** A row stops excusing the day after its `until` date. */
export const isExpired = (flake, now = today()) => now > flake.until;

/** `expired flake row: <check> (<engine>) "<clause>" (added <date>, until <date>)` */
export const expiredLine = f => `expired flake row: ${f.check} (${f.engine}) "${f.clause}" (added ${f.added}, expired ${f.until})`;

/**
 * The reds a check printed, one block each: its `FAIL  <name>` line with the indented lines under it.
 * @param {string} out the check's whole output
 * @returns {string[]}
 */
export function redBlocks(out) {
  const blocks = [];
  let cur = null;
  for (const line of String(out).split(/\r?\n/)) {
    if (/^FAIL\b/.test(line)) { cur = [line]; blocks.push(cur); }
    else if (cur && /^\s+\S/.test(line)) cur.push(line);
    else cur = null;
  }
  return blocks.map(b => b.join('\n'));
}

/**
 * The live rows for this check and engine, in the table's order.
 * @param {{ now?: string }} [o]
 */
export function liveRows(flakes, check, engine, { now = today() } = {}) {
  return flakes.filter(f => f.check === check && (f.engine === engine || f.engine === 'all') && !isExpired(f, now));
}

/**
 * The table's excuse for a red in this check, or null. Every failing line (each indented detail line of a block,
 * or its header when it has none) must be named by a live row (one row may name them all, or several rows may
 * share them); a line no row names makes the red new.
 * With no blocks (the check crashed before printing a FAIL line), only a `*` row excuses it.
 * @returns {{ cause: string } | null}
 */
export function knownFlake(flakes, check, engine, blocks = [], { now = today() } = {}) {
  const rows = liveRows(flakes, check, engine, { now });
  if (!rows.length) return null;
  if (!blocks.length) { const all = rows.find(r => r.clause === '*'); return all ? { cause: all.cause } : null; }
  const causes = [];
  for (const b of blocks) {
    // a block is its header and its indented detail lines; each line the check printed must be named by a
    // live row (the header alone only when there are no detail lines), so a real regression sharing a
    // block with a known flake is a new red
    const [header, ...details] = String(b).split(/\r?\n/);
    for (const line of details.length ? details : [header]) {
      const row = rows.find(r => clauseMatches(r.clause, line));
      if (!row) return null;
      if (!causes.includes(row.cause)) causes.push(row.cause);
    }
  }
  return { cause: causes.join('; ') };
}

/**
 * The run's verdict. results: { check, ok, blocks? }[] in run order (blocks from redBlocks()).
 * @returns {{ newReds: string[], known: { check: string, cause: string }[], expired: object[], exitCode: 0|1 }}
 * `expired` is every row past its date for this engine, whether or not its check went red, so the table is cleaned.
 */
export function verdict(results, flakes, engine, { now = today() } = {}) {
  const newReds = [], known = [];
  for (const { check, ok, blocks } of results) {
    if (ok) continue;
    const f = knownFlake(flakes, check, engine, blocks ?? [], { now });
    if (f) known.push({ check, cause: f.cause });
    else newReds.push(check);
  }
  const expired = flakes.filter(f => (f.engine === engine || f.engine === 'all') && isExpired(f, now));
  return { newReds, known, expired, exitCode: newReds.length ? 1 : 0 };
}
