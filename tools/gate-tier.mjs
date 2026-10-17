// The gate tier of the current branch's diff, printed with its reasons.
//
//   node tools/gate-tier.mjs [--json] [--base main]
//   node tools/gate-tier.mjs --enforce [--base main] [--json]
//
// Without --enforce it reads `git diff --name-only main...HEAD` (new files marked, md headers scanned for
// `gate: full`) and the registry index, and prints the tier and why. Exit 0 either way: it informs.
//
// With --enforce it binds. It lists every slice merged on HEAD's first-parent line since the base, each with the
// tier its own diff gives (a direct commit is a unit of its own), and looks in docs/LEDGER.md and docs/reviews/ for the canonical Rasika line that tier owes
// (how a review is recognised: the comment above `enforce` in gate-tier.core.js, and tools/README.md).
// It exits 1 when a Standard or Full slice has none, 0 otherwise, 2 on bad usage.
//
//   --json       print { tier, reasons } (or { ok, slices } with --enforce) for scripts and agents
//   --base REF   diff against REF instead of main (default main)
//   --enforce    judge the merged slices against the ledger and the reviews
//   --head REF   with --enforce: the end of the range (default HEAD), so a run branch can be judged from anywhere
//   --repo DIR   run in this checkout (default: the one this file is in); the self-test uses a fixture repo
//   --ledger F / --reviews D   where to look, relative to the repo (default docs/LEDGER.md, docs/reviews)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify, enforce, reviewLine, reviewOwed } from './gate-tier.core.js';
import { parseArgs } from './lib/args.mjs';
import { git, gateFullIn, mergedSlices, reviewDocuments } from './lib/rigour-git.mjs';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let opts;
try {
  ({ opts } = parseArgs(process.argv.slice(2), { json: 'bool', base: 'string', enforce: 'bool', head: 'string', repo: 'string', ledger: 'string', reviews: 'string' }));
} catch (e) {
  console.error(`${e.message}\nusage: node tools/gate-tier.mjs [--json] [--base REF] [--enforce] [--head REF] [--repo DIR] [--ledger FILE] [--reviews DIR]`);
  process.exit(2);
}
const REPO = opts.repo ? path.resolve(opts.repo) : HERE;
const base = opts.base ?? 'main';

if (opts.enforce) {
  let slices;
  try { slices = mergedSlices({ cwd: REPO, base, head: opts.head ?? 'HEAD' }); }
  catch (e) { console.error(`gate-tier: could not read the merges since ${base}: ${e.message}`); process.exit(2); }
  const docs = reviewDocuments(REPO, { ledger: opts.ledger, reviews: opts.reviews });
  const judged = enforce(slices, docs);
  const missing = judged.filter(s => !s.ok);
  if (opts.json) {
    console.log(JSON.stringify({ ok: !missing.length, base, slices: judged.map(({ refs, ...s }) => s) }, null, 2));
  } else {
    console.log(`gate-tier --enforce: ${judged.length} unit${judged.length === 1 ? '' : 's'} since ${base}`);
    for (const s of judged) {
      console.log(`  ${reviewLine(s)}`);
      if (!s.ok) console.log(`          owes ${reviewOwed(s.tier)}`);
    }
    console.log(missing.length ? `${missing.length} slice${missing.length === 1 ? '' : 's'} merged without the review the tier owes.` : 'every merged slice has the review its tier owes.');
  }
  process.exit(missing.length ? 1 : 0);
}

let changed, added;
try {
  changed = git(REPO, ['diff', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean);
  added = git(REPO, ['diff', '--diff-filter=A', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean);
} catch (e) {
  console.error(`git could not read the diff against ${base}: ${e.message.split('\n')[0]}`);
  process.exit(2);
}

// A changed request or slice file that declares `gate: full` raises the tier itself.
const gateFullPaths = gateFullIn(changed, p => { const abs = path.join(REPO, p); return fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : null; });

const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'registry', 'registry.json'), 'utf8'));
const { tier, reasons } = classify(changed, registry, { newPaths: added, gateFullPaths });

if (opts.json) {
  console.log(JSON.stringify({ tier, reasons, changed: changed.length }, null, 2));
} else {
  console.log(`tier: ${tier}   (${changed.length} changed file${changed.length === 1 ? '' : 's'}, diff ${base}...HEAD)`);
  for (const r of reasons) console.log(`  ${r}`);
}
