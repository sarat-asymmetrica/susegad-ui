// The gate tier of the current branch's diff, printed with its reasons.
//
//   node tools/gate-tier.mjs [--json] [--base main]
//
// Reads `git diff --name-only main...HEAD` (new files marked, md headers scanned for
// `gate: full`) and the registry index, and prints the tier and why. Exit 0 either way:
// this tool informs, it does not gate.
//
//   --json       print { tier, reasons } for scripts and agents
//   --base REF   diff against REF instead of main (default main)

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from './gate-tier.core.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const asJson = process.argv.includes('--json');
const flag = process.argv.indexOf('--base');
const base = flag > 0 ? process.argv[flag + 1] : 'main';

const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();
let changed, added;
try {
  changed = git('diff', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
  added = git('diff', '--diff-filter=A', '--name-only', `${base}...HEAD`).split('\n').filter(Boolean);
} catch (e) {
  console.error(`git could not read the diff against ${base}: ${e.message.split('\n')[0]}`);
  process.exit(2);
}

// A changed request or slice file that declares `gate: full` raises the tier itself.
const gateFullPaths = [];
for (const p of changed) {
  if (!/\.(md|html)$/.test(p)) continue;
  const abs = path.join(REPO, p);
  if (!fs.existsSync(abs)) continue;
  if (fs.readFileSync(abs, 'utf8').slice(0, 4000).includes('gate: full')) gateFullPaths.push(p);
}

const registry = JSON.parse(fs.readFileSync(path.join(REPO, 'registry', 'registry.json'), 'utf8'));
const { tier, reasons } = classify(changed, registry, { newPaths: added, gateFullPaths });

if (asJson) {
  console.log(JSON.stringify({ tier, reasons, changed: changed.length }, null, 2));
} else {
  console.log(`tier: ${tier}   (${changed.length} changed file${changed.length === 1 ? '' : 's'}, diff ${base}...HEAD)`);
  for (const r of reasons) console.log(`  ${r}`);
}
