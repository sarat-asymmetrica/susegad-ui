// Run a check until it fails, and keep the full output of the first failure
// (docs/requests/2026-10-02-lighter-gate.md, C row 6: A12, catch the flake failing).
//
//   node tools/until-fail.mjs tools/whatever.check.mjs --max 20
//   node tools/until-fail.mjs -- npm run check --max 20
//
// Runs the command again and again (a fresh process each time) until it exits non-zero.
// The first failure's complete stdout and stderr are kept in
// .shots/until-fail/<stamp>/first-failure.log, and its last lines are printed.
//   exit 0  a failure was captured (or --max runs passed with none; the last line says which)
//   exit 2  bad usage
// The command runs from the repo root. A command that is a .mjs/.js file runs under node;
// anything else runs through the shell.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);

const maxI = argv.indexOf('--max');
const max = maxI >= 0 ? Number(argv[maxI + 1]) : 20;
let cmd = argv.filter((a, i) => !(a === '--max' || (maxI >= 0 && i === maxI + 1)));
if (cmd[0] === '--') cmd = cmd.slice(1);
if (!cmd.length) {
  console.error('usage: node tools/until-fail.mjs <command...> --max 20   (put "--" first to run a shell line)');
  process.exit(2);
}

const isFile = /\.(mjs|cjs|js)$/.test(cmd[0]);
const run = () => isFile
  ? spawnSync(process.execPath, cmd, { cwd: REPO, encoding: 'utf8', timeout: 900000 })
  : spawnSync(cmd[0], cmd.slice(1), { cwd: REPO, encoding: 'utf8', shell: true, timeout: 900000 });

let runs = 0;
let first = null;
for (runs = 1; runs <= max; runs++) {
  console.log(`run ${runs} of ${max}: ${cmd.join(' ')}`);
  const r = run();
  if (r.status !== 0 || r.error) {
    first = { r, runs };
    break;
  }
}

if (first) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(REPO, '.shots', 'until-fail', stamp);
  fs.mkdirSync(dir, { recursive: true });
  const log = path.join(dir, 'first-failure.log');
  const body = [
    `command: ${cmd.join(' ')}`,
    `failed on run ${first.runs} of ${max}`,
    `exit code: ${first.r.status ?? 'signal'}`,
    '--- stdout + stderr (complete) ---',
    (first.r.stdout || '') + (first.r.stderr || ''),
  ].join('\n');
  fs.writeFileSync(log, body);
  console.log(`\nfailed on run ${first.runs}. Full output: ${path.relative(REPO, log).replaceAll('\\', '/')}`);
  console.log((first.r.stdout || '').trim().split('\n').slice(-5).join('\n'));
  process.exit(0);
}
console.log(`\ndid not fail in ${max} runs: ${cmd.join(' ')} stayed green.`);
