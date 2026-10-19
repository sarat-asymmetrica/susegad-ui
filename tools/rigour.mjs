// The rigour runner: one command for "what does this scope owe, and did it pass".
//
//   node tools/rigour.mjs --scope=slice            before reporting a slice
//   node tools/rigour.mjs --scope=rung             at a rung's exit gate
//   node tools/rigour.mjs --scope=debt             the debt register, grouped
//
//   --scope slice|rung|debt   required
//   --base REF                slice: diff against REF (default $SG_BASE, else main); rung: merges since REF (default main)
//   --engines a,b             browsers for check and smoke: chromium, webkit, firefox
//                             (default chromium in both scopes; the laptop never runs three engines, decision 0031)
//   --full                    rung: the whole check and smoke suites, in the engines given (default: only what the rung
//                             changed since --base, in Chromium)
//   --json FILE               write the machine-readable result here (default out/rigour/<scope>-<time>.json;
//                             a --dry run writes nothing unless you name a file)
//   --dry                     print the plan and run nothing
//   --keep-going              run the steps after a failed one too (default: they are "not run")
//   --strict                  debt: exit 1 when the register is over its cap
//   --debt FILE               debt: the register (default docs/DEBT.md)
//
// slice  npm run gates:slice, npm run check -- --changed, npm run smoke -- --changed, then gate-tier over the diff
// rung   npm run gates, gate-tier over the merges since the base (red when a merged Standard or Full slice on shared
//        ground has no review; a unit inside experimental items owes it at promotion and is reported "owed"), then
//        npm run smoke -- --changed and npm run check -- --changed=<base> in each engine. With --full: the whole smoke
//        and check suites instead. The plan and the JSON say which mode ran.
// debt   parses docs/DEBT.md; prints the open rows by Where and Kind, oldest first, counts, and the cap verdict
//
// Every step ends passed, failed, not run, owed or empty, with its duration and the machine's CPU busy while it ran. A
// step that did not run, owes a review, or ran nothing is never reported as passed. Exit 0 when nothing failed or was left
// unrun (the summary's `complete` says whether every step passed outright), 1 otherwise, 2 on bad usage.
// Steps run one after another; browsers go through the existing runners, which hold the machine's slots.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './lib/args.mjs';
import {
  checkArg, DEBT_CAP, formatDebt, formatPlan, formatSummary, loadNote, parseDebt, parseEngines, planRung, planSlice,
  stepResult, summariseDebt, summarise,
} from './lib/rigour.core.js';
import { runPlan, sampleLoad } from './lib/rigour-run.mjs';
import { git } from './lib/rigour-git.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node tools/rigour.mjs --scope=slice|rung|debt [--base REF] [--engines chromium,webkit] [--full] [--json FILE] [--dry] [--keep-going] [--strict] [--debt FILE]';

let opts;
try {
  ({ opts } = parseArgs(process.argv.slice(2), { scope: 'string', base: 'string', engines: 'string', full: 'bool', json: 'string', dry: 'bool', 'keep-going': 'bool', strict: 'bool', debt: 'string' }));
  if (!['slice', 'rung', 'debt'].includes(opts.scope)) throw new Error('--scope must be slice, rung or debt');
  if (opts.base) checkArg('base', opts.base);
  if (opts.full && opts.scope !== 'rung') throw new Error('--full belongs to --scope=rung');
} catch (e) { console.error(`${e.message}\n${USAGE}`); process.exit(2); }

const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
function writeJson(result) {
  if (opts.dry && !opts.json) return;
  const file = path.resolve(opts.json ?? path.join(ROOT, 'out', 'rigour', `${opts.scope}-${stamp()}.json`));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
  console.log(`result written to ${path.relative(process.cwd(), file) || file}`);
}
const head = () => { try { return { commit: git(ROOT, ['rev-parse', '--short=7', 'HEAD']), branch: git(ROOT, ['rev-parse', '--abbrev-ref', 'HEAD']) }; } catch { return { commit: null, branch: null }; } };

if (opts.scope === 'debt') {
  const file = path.resolve(ROOT, opts.debt ?? 'docs/DEBT.md');
  let rows;
  try { rows = parseDebt(fs.readFileSync(file, 'utf8')); } catch (e) { console.error(`rigour: cannot read ${file}: ${e.message}`); process.exit(2); }
  if (!rows.length) { console.error(`rigour: no table rows found in ${file}`); process.exit(1); }
  const s = summariseDebt(rows, { cap: DEBT_CAP });
  console.log(formatDebt(s, rel(file)));
  const step = stepResult({ id: 'debt', label: 'parse the register', kind: 'tier' }, 'passed', { note: `${s.open} open of ${s.total}` });
  writeJson({
    scope: 'debt', ...head(), file: rel(file), finishedAt: new Date().toISOString(),
    total: s.total, open: s.open, closed: s.closed, cap: s.cap, overCap: s.overCap, byKind: s.byKind,
    byWhere: s.groups.map(g => ({ where: g.where, open: g.open, rows: g.kinds.flatMap(k => k.rows.map(r => r.n)) })),
    rows: rows.map(r => ({ n: r.n, where: r.where, kind: r.kind, since: r.since, open: r.open, item: r.item })),
    steps: [step], ok: !(opts.strict && s.overCap),
  });
  process.exit(opts.strict && s.overCap ? 1 : 0);
}

let engines, base, plan;
try {
  engines = parseEngines(opts.engines, ['chromium']);
  base = opts.base ?? (opts.scope === 'slice' ? process.env.SG_BASE : null) ?? 'main';
  checkArg('base', base);
  plan = opts.scope === 'slice' ? planSlice({ base: opts.base ?? process.env.SG_BASE, engines }) : planRung({ base, engines, full: Boolean(opts.full) });
} catch (e) { console.error(`${e.message}\n${USAGE}`); process.exit(2); }

const modeField = opts.scope === 'rung' ? { mode: opts.full ? 'full' : 'changed' } : {};
console.log(formatPlan(opts.scope, plan, { base, engines, ...(opts.scope === 'rung' ? { mode: opts.full ? 'full suite' : 'changed since base' } : {}) }));
if (opts.dry) {
  const results = await runPlan({ steps: plan, root: ROOT, base, dry: true });
  console.log('\ndry run: nothing was run; every step is "not run".');
  writeJson({ scope: opts.scope, dry: true, ...head(), base, engines, ...modeField, steps: results, ok: false });
  process.exit(0);
}

const startedAt = new Date().toISOString();
const loadBefore = await sampleLoad();
console.log(`\nmachine before the run: ${loadNote(loadBefore)}, ${os.cpus().length} cores`);
const results = await runPlan({ steps: plan, root: ROOT, base, keepGoing: opts['keep-going'] });
const sum = summarise(results);
console.log(formatSummary(results, loadNote(loadBefore)));
writeJson({
  scope: opts.scope, ...head(), base, engines, ...modeField, startedAt, finishedAt: new Date().toISOString(),
  machine: { cores: os.cpus().length, cpuBusyBeforePct: loadBefore, note: loadNote(loadBefore) },
  steps: results, summary: sum, ok: sum.ok,
});
process.exit(sum.ok ? 0 : 1);
