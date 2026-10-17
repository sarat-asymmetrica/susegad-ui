// Rebuild tools/lib/check-durations.json (the times `node tools/checks.mjs --shard` balances by)
// from a CI run's log:
//   gh run view <run id> -R sarat-asymmetrica/susegad-ui --log > ci.log
//   node tools/lib/check-durations.mjs ci.log <run id> <run date, YYYY-MM-DD>
// The parsing is pure and tested (check-durations.core.js splits a sharded run by job, then
// durationsFromLog in shard.core.js reads each job). Run dates: `gh run view <id> --json createdAt`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { durationsFromShardedLog } from './check-durations.core.js';

const ENGINES = ['chromium', 'webkit', 'firefox'];

const [logPath, runId = 'unknown', runDate = 'date unknown'] = process.argv.slice(2);
if (!logPath) { console.error('usage: node tools/lib/check-durations.mjs <ci.log> [run id] [run date]'); process.exit(2); }
const table = durationsFromShardedLog(fs.readFileSync(logPath, 'utf8'));
if (!Object.keys(table).length) { console.error('no check results found in the log (is it a `gh run view --log` of a CI run?); the table is left alone'); process.exit(1); }
const out = {
  $source: `CI run ${runId} of ${runDate} (gh run view ${runId} -R sarat-asymmetrica/susegad-ui --log), seconds per engine; a check crashed before it ran, or missing, falls back (shard.core.js durationOf)`,
  ...Object.fromEntries(Object.keys(table).sort().map(k => [k, Object.fromEntries(ENGINES.filter(e => e in table[k]).map(e => [e, table[k][e]]))])),
};
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), 'check-durations.json');
fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`);
console.log(`${Object.keys(table).length} checks written to ${path.relative(process.cwd(), file)}`);
