// Run the browser behaviour checks (*.check.mjs) under packages/ and recipes/, one at a time.
//   node tools/checks.mjs                    (or: npm run check; chromium, the default)
//   node tools/checks.mjs --engine=webkit
//   SG_ENGINE=firefox node tools/checks.mjs  (the flag and the env var do the same thing;
//                                              each check reads SG_ENGINE itself, see lib/engine.mjs)
//   node tools/checks.mjs --changed          only the checks this branch needs (see below)
//   node tools/checks.mjs --changed=<ref>    the same, against the merge-base with <ref> (default: main, or $SG_BASE)
//   node tools/checks.mjs --changed --dry    print what would run, and why, then stop (--dry works on its own too)
// Also run: the checks that live in tools/ and cover the whole library (EXTRA below), and the Node-only checks
// (NODE below: the text gate), which need no browser, take no browser slot and run first.
//   node tools/checks.mjs --shard=2/4        only the second of four shards (combines with --engine, --changed, --dry)
// Each check is a standalone script that exits non-zero on failure. Prints a summary and
// exits non-zero if any check failed that is not a known flake.
//
// Known flakes: a red from a check listed in the "Known flakes" table of docs/BROWSERS.md, for this
// engine, prints `FAIL (known: <cause>)` and is counted apart in the summary. THE EXIT CODE COUNTS
// ONLY NEW REDS: a run whose only reds are known flakes exits 0. A known red is recorded, not re-run;
// any other red is a new red, compared with main before anyone believes it (RUNBOOK §6.2). A listed
// check that passes prints `pass` as usual. (lib/flakes.core.js reads the table.)
//
// --changed takes the files that differ from the merge-base (committed, staged, unstaged and untracked)
// and picks: the checks in a folder the diff touches; the checks of every registry item that depends,
// at any depth, on a changed item; the touch check when a component changed; the checks that import a
// changed tools/lib file, at any depth, or load a changed npm dependency; and EVERYTHING when the diff
// touches a shared primitive (packages/core, engine, tokens, the server and harness, the slots,
// overflow and the runner, or a dependency the harness loads such as playwright and axe-core; see
// lib/changed.core.js and lib/changed-deps.mjs). Each choice is printed with its reason.
// A full run is still the gate before a merge; --changed is for the slice in front of you.
//
// --shard=<i>/<n> (1-based) splits the selected checks, Node-only ones included, into n shards of about
// equal expected time (greedy, longest first, ties by path; lib/shard.core.js) and runs shard i. The
// times are seconds per engine in lib/check-durations.json, from a CI run's log; a check missing there
// counts as 30 s. With --dry it prints every shard's expected total, and the checks of shard i.
//
// Browser slots: each check holds one machine-wide slot while it runs (lib/slots.mjs), so agents
// sharing the machine queue instead of all launching Chromium at once. SG_BROWSER_SLOTS=<n> sets how
// many (default: half the cores); 0 turns the limit off.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENGINE_NAMES, pickEngine } from './lib/engine.mjs';
import { runCheck, defaultTimeoutS } from './lib/run-check.mjs';
import { selectForDiff } from './lib/changed-deps.mjs';
import { NODE_CHECKS } from './lib/changed.core.js';
import { parseShard, shardChecks, durationOf } from './lib/shard.core.js';
import { parseKnownFlakes, knownFlake, verdict } from './lib/flakes.core.js';
import { spawnSync } from 'node:child_process';
import { parseSkips } from './lib/gpu.core.js';
import { drivesChromium } from './lib/chromium-only.core.js';

const engineFlag = process.argv.find(a => a.startsWith('--engine='))?.slice('--engine='.length);
const engineName = (engineFlag ?? process.env.SG_ENGINE ?? 'chromium').trim().toLowerCase();
if (!ENGINE_NAMES.includes(engineName)) {
  console.error(`Unknown engine "${engineName}". Use one of: ${ENGINE_NAMES.join(', ')}.`);
  process.exit(2);
}
pickEngine(engineName); // just validates the name; each check launches its own browser
const shardArg = process.argv.find(a => a.startsWith('--shard='))?.slice('--shard='.length);
let shard = null;
try { if (shardArg !== undefined) shard = parseShard(shardArg); } catch (e) { console.error(e.message); process.exit(2); }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let flakes;
try { flakes = parseKnownFlakes(fs.readFileSync(path.join(root, 'docs', 'BROWSERS.md'), 'utf8')); }
catch (e) { console.error(`Known flakes: ${e.message}`); process.exit(2); } // a broken table must not quietly turn reds known, or new
const found = [];
const walk = dir => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.check.mjs')) found.push(p);
  }
};
for (const d of ['packages', 'recipes']) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
// Library-wide checks that live in tools/ (the rest of tools/*.check.mjs are run by hand, with their own gates).
const NODE = Object.keys(NODE_CHECKS); // Node-only checks: no browser, no slot (tools/lib/changed.core.js says what selects each)
const EXTRA = ['tools/touch.check.mjs']; // the microinteraction check: press, focus and reduced-motion, per interactive component
for (const e of EXTRA) found.push(path.join(root, e));
found.sort();

// --changed[=<ref>] and --dry: choose a subset, say why, maybe stop.
const changedArg = process.argv.find(a => a === '--changed' || a.startsWith('--changed='));
const dry = process.argv.includes('--dry');
const rels = found.map(f => path.relative(root, f).replaceAll('\\', '/'));
let chosen = rels, chosenNode = NODE;
if (changedArg) {
  let pick;
  try { pick = selectForDiff({ root, checks: rels, base: changedArg.includes('=') ? changedArg.slice(changedArg.indexOf('=') + 1) : undefined }); }
  catch (e) { console.error(`--changed: ${e.message}`); process.exit(2); }
  console.log(`Changed since ${pick.mergeBase.slice(0, 7)} (merge-base with ${pick.base}): ${pick.files.length} file${pick.files.length === 1 ? '' : 's'}.`);
  if (pick.all) console.log(`Selecting all ${rels.length} checks: ${pick.allReason}.`);
  else {
    console.log(`Selecting ${pick.selected.length} of ${rels.length} checks:`);
    for (const s of pick.selected) console.log(`  ${s.check}\n      ${s.reasons.join('\n      ')}`);
  }
  chosen = pick.selected.map(s => s.check);
  chosenNode = pick.node.map(s => s.check);
  for (const s of pick.node) console.log(`  ${s.check} (node only)\n      ${s.reasons.join('\n      ')}`);
  for (const n of pick.notes ?? []) console.log(`Note: ${n}`);
  console.log('');
} else if (dry && !shard) {
  console.log(`Would run ${rels.length} checks:\n${rels.map(r => `  ${r}`).join('\n')}\nand ${NODE.length} Node-only: ${NODE.join(', ')}\n`);
}
if (shard) {
  const table = JSON.parse(fs.readFileSync(path.join(root, 'tools', 'lib', 'check-durations.json'), 'utf8'));
  const secs = c => durationOf(table, c, engineName);
  const shards = shardChecks([...chosenNode, ...chosen], { count: shard.count, seconds: secs });
  const mine = shards[shard.index - 1];
  if (dry) {
    shards.forEach((sh, i) => console.log(`Shard ${i + 1}/${shard.count}${i === shard.index - 1 ? ' (this one)' : ''}: ${sh.checks.length} check${sh.checks.length === 1 ? '' : 's'}, expected ${sh.total} s in ${engineName}`));
    console.log(`\nShard ${shard.index}/${shard.count} would run:\n${mine.checks.map(c => `  ${c}  ${secs(c)} s${chosenNode.includes(c) ? ' (node only)' : ''}`).join('\n')}\n`);
  } else console.log(`Shard ${shard.index}/${shard.count}: ${mine.checks.length} of ${chosen.length + chosenNode.length} selected checks, expected ${mine.total} s in ${engineName}.\n`);
  chosen = chosen.filter(c => mine.checks.includes(c));
  chosenNode = chosenNode.filter(c => mine.checks.includes(c));
}
if (dry) process.exit(0);
if (!chosen.length && !chosenNode.length) { console.log('No checks needed for this diff.'); process.exit(0); }
const picked = found.filter((f, i) => chosen.includes(rels[i]));
// A check that launches Chromium itself ignores --engine: under another engine's banner it would print a Chromium result as that engine's pass.
// It is not run there, and it is neither a pass nor a red (docs/BROWSERS.md lists them).
const chromiumOnly = engineName === 'chromium' ? [] : picked.filter(f => drivesChromium(fs.readFileSync(f, 'utf8')));
const toRun = picked.filter(f => !chromiumOnly.includes(f));
for (const f of chromiumOnly) console.log(`skip  ${path.relative(root, f).replaceAll('\\', '/')}  (drives Chromium itself; --engine=${engineName} does not reach it)`);

const failed = [];
const results = []; // { check, ok } in run order, for the verdict
const ran = new Set();
const mark = rel => { const f = knownFlake(flakes, rel, engineName); return f ? `FAIL (known: ${f.cause})` : 'FAIL'; };
const skipped = []; // { check, clauses } for each check that skipped clauses for want of a GPU (lib/gpu.core.js)
// Node-only checks first: plain child processes, no browser, no slot.
for (const rel of chosenNode) {
  const t0 = Date.now();
  // the bake gate lays out the text gate's copy itself; when the text gate just passed in this run, it need not do it again
  const textPassed = ran.has('tools/text-gate.mjs') && !failed.includes('tools/text-gate.mjs');
  const r = spawnSync(process.execPath, [path.join(root, rel)], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...(rel === 'tools/bake-gate.mjs' && textPassed ? { SG_TEXT_GATE_RAN: '1' } : {}) } });
  ran.add(rel);
  const ok = r.status === 0, out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim();
  if (!ok) failed.push(rel);
  results.push({ check: rel, ok });
  console.log(`${ok ? 'pass' : mark(rel)}  ${rel}  ${out.split('\n').slice(-1)[0] || ''} (node only, ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (!ok) console.log(out.split('\n').slice(-40).join('\n'));
}
console.log(`Running ${toRun.length} check${toRun.length === 1 ? '' : 's'} in ${engineName}.\n`);
const timeoutS = defaultTimeoutS();
const LONG = { 'tools/touch.check.mjs': 4 }; // whole-library checks get a multiple of the limit (the probe presses every demo in three registers) // SG_CHECK_TIMEOUT_S to change; a hung check is killed and reported, never waited on
for (const f of toRun) {
  const rel = path.relative(root, f).replaceAll('\\', '/');
  const r = await runCheck(f, { cwd: root, env: { ...process.env, SG_ENGINE: engineName }, timeoutS: timeoutS * (LONG[rel] ?? 1) });
  const ok = r.status === 0;
  if (!ok) failed.push(rel);
  results.push({ check: rel, ok });
  const noGpu = parseSkips(r.out);
  if (noGpu.length) skipped.push({ check: rel, clauses: noGpu });
  const tail = r.out.trim().split('\n').slice(-1)[0] || '';
  console.log(`${ok ? 'pass' : mark(rel)}  ${rel}  ${r.timedOut ? `(timed out after ${timeoutS * (LONG[rel] ?? 1)} s)` : tail}`);
  if (!ok) console.log(r.out.trim().split('\n').slice(-15).join('\n'));
}
// Konkani strings no native reader has checked yet: a warning, never a failure (decision 0025; --strict on the tool fails).
const { report, format } = await import('./strings-review.mjs');
console.log(`\nKonkani strings awaiting a native reader (warn only)\n${format(report())}`);
const total = toRun.length + chosenNode.length;
const v = verdict(results, flakes, engineName);
console.log(`\n${total - failed.length} of ${total} checks pass (${engineName}${chosenNode.length ? `; ${chosenNode.length} Node-only` : ''}${shard ? `; shard ${shard.index}/${shard.count}` : ''})`);
// A skip is a clause that did not run (no GPU: the live tier is not there to test). It is not a pass of that clause and not a red.
const nSkipped = skipped.reduce((n, k) => n + k.clauses.length, 0);
console.log(`Skipped, no GPU: ${nSkipped} clause${nSkipped === 1 ? '' : 's'} in ${skipped.length} check${skipped.length === 1 ? '' : 's'}${skipped.map(k => `\n  ${k.check}${failed.includes(k.check) ? ' (FAILED)' : ''}${k.clauses.map(c => `\n    ${c}`).join('')}`).join('')}`);
console.log(`New reds: ${v.newReds.length}${v.newReds.map(c => `\n  ${c}`).join('')}`);
console.log(`Known flakes that went red: ${v.known.length}${v.known.map(k => `\n  ${k.check} (${k.cause})`).join('')}`);
console.log(v.exitCode ? 'Exit 1: new reds.' : `Exit 0: no new reds${v.known.length ? '; the known flakes are recorded, not counted' : ''}.`);
process.exit(v.exitCode);
