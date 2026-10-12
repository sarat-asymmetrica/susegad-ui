// A run's agent cost, from Claude Code's transcripts: per role, the agents, agent-hours, turns and tokens; the share
// of cache writes that followed a gap; polling calls; foreground browser checks; peak context; images read. It
// prints numbers only, as a block to paste into a rung's ledger entry (docs/RUNBOOK.md §8).
//
//   node tools/loopcost.mjs [--since <ISO>] [--until <ISO>] [--project <dir>] [--json]
//
//   --since, --until   the window, by each line's timestamp (an ISO date or time; until is exclusive)
//   --project DIR      the transcripts folder; default ~/.claude/projects/<the main checkout's path, slugged>
//   --json             the summary as JSON instead of the block
//
// The pure core is tools/lib/loopcost.core.js; the review it grew from is docs/runs/2026-10-12-harness-review/.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import { createAgent, roleOf, summarise, format, projectSlug } from './lib/loopcost.core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let opts;
try { ({ opts } = parseArgs(process.argv.slice(2), { since: 'string', until: 'string', project: 'string', json: 'bool' })); } catch (e) { console.error(e.message); process.exit(2); }
const ms = (v, name) => { if (v === undefined) return undefined; const t = Date.parse(v); if (!Number.isFinite(t)) { console.error(`--${name} is not a date: ${v}`); process.exit(2); } return t; };
const since = ms(opts.since, 'since'), until = ms(opts.until, 'until');

/** Sessions run from the main checkout, so a worktree's own path is not the project: take the common git dir's parent. */
function defaultProject() {
  let root = process.cwd();
  try { root = path.dirname(path.resolve(HERE, execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd: HERE, encoding: 'utf8' }).trim())); } catch {}
  const base = path.join(os.homedir(), '.claude', 'projects'), slug = projectSlug(root);
  if (fs.existsSync(path.join(base, slug))) return path.join(base, slug);
  const near = fs.existsSync(base) && fs.readdirSync(base).find(d => d.toLowerCase() === slug.toLowerCase()); // c: or C:
  return path.join(base, near || slug);
}
const dir = opts.project ? path.resolve(opts.project) : defaultProject();
if (!fs.existsSync(dir)) { console.error(`no transcripts at ${dir} (pass --project)`); process.exit(2); }

function* walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) yield* walk(p);
    else if (e.name.endsWith('.jsonl')) yield p;
  }
}

const results = [];
let files = 0;
for (const f of walk(dir)) {
  if (since !== undefined && fs.statSync(f).mtimeMs < since) continue; // appended in time order: nothing in the window
  const rel = path.relative(dir, f).split(path.sep).join('/');
  let meta = null;
  try { meta = JSON.parse(fs.readFileSync(f.replace(/\.jsonl$/, '.meta.json'), 'utf8')); } catch {}
  const agent = createAgent({ role: roleOf(rel, meta), since, until });
  const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
  for await (const line of rl) { let j; try { j = JSON.parse(line); } catch { continue; } agent.line(j); }
  const r = agent.result();
  if (r.turns) { results.push(r); files++; }
}

const summary = summarise(results);
if (opts.json) console.log(JSON.stringify({ since: opts.since ?? null, until: opts.until ?? null, transcripts: files, ...summary }, null, 2));
else console.log(format(summary, { since: opts.since, until: opts.until, files }));
