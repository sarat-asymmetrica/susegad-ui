// The doing half of the rigour runner: spawn each step in order, time it, sample the machine's CPU
// while it runs, and decide what runs after a failure. The plans and the result's shape are rigour.core.js.

import os from 'node:os';
import { spawn } from 'node:child_process';
import { classify, enforce, reviewLine, reviewOwed } from '../gate-tier.core.js';
import { cpuPct, judgeSpawn, stepResult } from './rigour.core.js';
import { git, gateFullIn, mergedSlices, registryAt, reviewDocuments, sliceDiff } from './rigour-git.mjs';
import fs from 'node:fs';
import path from 'node:path';

export const cpuTimes = () => os.cpus().reduce((a, c) => {
  const t = c.times;
  a.busy += t.user + t.nice + t.sys + t.irq;
  a.total += t.user + t.nice + t.sys + t.irq + t.idle;
  return a;
}, { busy: 0, total: 0 });

/** The machine's busy percentage over `ms` (smoke.mjs does the same before it starts). */
export async function sampleLoad(ms = 1500) {
  const a = cpuTimes();
  await new Promise(r => setTimeout(r, ms));
  return cpuPct(a, cpuTimes());
}

// The tail of a step's output is kept so its summary lines can be read; the rest still goes straight to the terminal.
const KEEP = 256 * 1024;

function spawnStep(step, root) {
  return new Promise(resolve => {
    // npm is npm.cmd on Windows, which only a shell starts; the arguments were checked by checkArg and are fixed words.
    const child = spawn(step.cmd, step.args, { cwd: root, stdio: ['inherit', 'pipe', 'pipe'], shell: process.platform === 'win32' });
    let output = '';
    const tee = out => d => { out.write(d); output = (output + d.toString()).slice(-KEEP); };
    child.stdout.on('data', tee(process.stdout));
    child.stderr.on('data', tee(process.stderr));
    child.on('error', e => resolve({ code: null, error: e.message, output }));
    child.on('close', code => resolve({ code, output }));
  });
}

/** gate-tier as a step. Returns { status, note, detail } and prints what review the tier owes. */
function tierStep(step, { root, base, log }) {
  if (step.scope === 'slice') {
    const { changed, added, mergeBase } = sliceDiff({ cwd: root, base });
    const read = p => { const f = path.join(root, p); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; };
    const { tier, reasons } = classify(changed, registryAt(root, null), { newPaths: added, gateFullPaths: gateFullIn(changed, read) });
    log(`tier: ${tier} (${changed.length} changed file${changed.length === 1 ? '' : 's'} against ${base} at ${mergeBase.slice(0, 7)})`);
    for (const r of reasons.filter(x => !x.startsWith('light') && !x.startsWith('neutral'))) log(`  ${r}`);
    const detail = { tier, reasons, changed: changed.length };
    if (tier === 'light') return { status: 'passed', note: 'light: no review owed', detail };
    // A passing review at the tier may already be on file (a ledger line or a docs/reviews section naming this branch or commit).
    const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
    const commit = git(root, ['rev-parse', 'HEAD'], { allowFail: true });
    const [judged] = enforce([{ name: branch, refs: [branch, commit].filter(Boolean), tip: commit, tier, reasons }], reviewDocuments(root));
    detail.reviews = judged.reviews;
    log(`owes: ${reviewOwed(tier)}`);
    if (judged.ok) return { status: 'passed', note: `tier ${tier}: a passing review is on file (${judged.reviews.filter(r => r.verdict === 'pass').map(r => r.source).join('; ')})`, detail };
    log('no passing Rasika review on file for this branch yet; the merge is checked later: node tools/gate-tier.mjs --enforce --base <ref>');
    return { status: 'owed', note: `tier ${tier}: Rasika review owed, not yet checked`, detail };
  }
  const slices = mergedSlices({ cwd: root, base });
  const judged = enforce(slices, reviewDocuments(root));
  log(`gate-tier over ${judged.length} unit${judged.length === 1 ? '' : 's'} merged since ${base}:`);
  for (const s of judged) {
    log(`  ${reviewLine(s)}`);
  }
  // A run that judged nothing is not a pass: an empty range is a wrong base (or a run already merged to main).
  if (!judged.length) return { status: 'empty', note: `no units since ${base}: wrong base?`, detail: { slices: [] } };
  const missing = judged.filter(s => !s.ok && !s.deferred);
  const deferred = judged.filter(s => s.deferred);
  const items = [...new Set(deferred.flatMap(s => s.laneItems))].sort();
  log(`  summary: ${judged.length - missing.length - deferred.length} passed, ${missing.length} owed now (red), ${deferred.length} owed at promotion${items.length ? `: ${items.join(', ')}` : ''}`);
  return {
    status: missing.length ? 'failed' : deferred.length ? 'owed' : 'passed',
    note: missing.length ? `${missing.length} of ${judged.length} merged without the review owed${deferred.length ? `; ${deferred.length} more owed at promotion` : ''}`
      : deferred.length ? `${deferred.length} unit(s) on the experimental lane owe a review at promotion (${items.join(', ')}); the rest in order`
      : `${judged.length} unit(s), reviews in order`,
    detail: { slices: judged.map(({ refs, ...s }) => s) },
  };
}

/**
 * Run the plan. Returns step results in plan order. After a failed step the rest are "not run"
 * unless the step was soft or keepGoing is set. A dry run runs nothing and says so.
 */
export async function runPlan({ steps, root, base, dry = false, keepGoing = false, log = console.log }) {
  const results = [];
  let stopped = null;
  for (const step of steps) {
    if (dry) { results.push(stepResult(step, 'not run', { note: 'dry run' })); continue; }
    if (stopped) { results.push(stepResult(step, 'not run', { note: `not run: ${stopped} failed first` })); continue; }
    log(`\n== ${step.id}: ${step.label}`);
    const before = cpuTimes();
    const t0 = Date.now();
    let status, extra = {};
    try {
      if (step.kind === 'spawn') {
        const r = await spawnStep(step, root);
        ({ status, extra } = judgeSpawn(step, r.code, r.output));
        if (r.error) extra = { ...extra, exitCode: r.code, note: r.error };
        if (extra.note && status !== 'failed') log(`  ${step.id}: ${extra.note}`);
      } else {
        const r = tierStep(step, { root, base, log });
        status = r.status;
        extra = { note: r.note, detail: r.detail };
      }
    } catch (e) {
      status = 'failed';
      extra = { note: e.message.split('\n')[0] };
      log(`  ${step.id} could not run: ${extra.note}`);
    }
    results.push(stepResult(step, status, { ...extra, durationMs: Date.now() - t0, cpuBusyPct: cpuPct(before, cpuTimes()) }));
    log(`== ${step.id}: ${status} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    if (status === 'failed' && !step.soft && !keepGoing) stopped = step.id;
  }
  return results;
}

