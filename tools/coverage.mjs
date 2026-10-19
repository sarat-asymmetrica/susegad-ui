// Report-only coverage (docs/GOAL-RIGOUR.md, rung 3d): `node --test --experimental-test-coverage` over the same files
// as `npm run test:unit`, then a summary: lines, branches, functions, and the cores with the least line coverage.
// It never fails a gate: the exit code is 0 unless the tests themselves could not run.
//
//   node tools/coverage.mjs           the summary and the 10 least-covered cores
//   node tools/coverage.mjs --top=25  more of them
//   node tools/coverage.mjs --lcov=<file>   keep the lcov file (default: the OS temp folder, deleted after)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** lcov text -> [{ file, lines: [hit, found], branches: [hit, found], funcs: [hit, found] }]. */
export function parseLcov(text) {
  const files = [];
  let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    const [k, v] = [line.slice(0, line.indexOf(':')), line.slice(line.indexOf(':') + 1)];
    if (line.startsWith('SF:')) cur = { file: v.replaceAll('\\', '/'), lines: [0, 0], branches: [0, 0], funcs: [0, 0] };
    else if (!cur) continue;
    else if (line === 'end_of_record') { files.push(cur); cur = null; }
    else if (k === 'LH') cur.lines[0] = +v;
    else if (k === 'LF') cur.lines[1] = +v;
    else if (k === 'BRH') cur.branches[0] = +v;
    else if (k === 'BRF') cur.branches[1] = +v;
    else if (k === 'FNH') cur.funcs[0] = +v;
    else if (k === 'FNF') cur.funcs[1] = +v;
  }
  return files;
}

const pct = ([h, f]) => (f ? (100 * h / f) : 100);
export const isCore = f => /\.core\.js$|\/model\.js$/.test(f) && !/\.test\./.test(f);

/** Totals across files and the n cores with the lowest line coverage (those with some lines to cover). */
export function summarise(files, top = 10) {
  const sum = key => files.reduce((a, f) => [a[0] + f[key][0], a[1] + f[key][1]], [0, 0]);
  const cores = files.filter(f => isCore(f.file) && f.lines[1] > 0).sort((a, b) => pct(a.lines) - pct(b.lines) || b.lines[1] - a.lines[1]);
  return { files: files.length, lines: sum('lines'), branches: sum('branches'), funcs: sum('funcs'), cores: cores.length, least: cores.slice(0, top) };
}

function main() {
  const args = process.argv.slice(2);
  const top = +(args.find(a => a.startsWith('--top='))?.slice(6)) || 10;
  const keep = args.find(a => a.startsWith('--lcov='))?.slice(7);
  const lcov = keep || path.join(os.tmpdir(), `susegad-coverage-${process.pid}.lcov`);
  // the globs are test:unit's own, so a new test folder is covered by editing one place
  const script = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts['test:unit'];
  const globs = script.replace(/^node --test\s*/, '').match(/"[^"]+"|\S+/g).map(g => g.replace(/"/g, ''));
  const r = spawnSync(process.execPath, ['--test', '--experimental-test-coverage',
    '--test-coverage-exclude=**/*.test.*', '--test-coverage-exclude=**/node_modules/**', '--test-coverage-exclude=tools/**',
    '--test-reporter=dot', '--test-reporter-destination=stdout',
    '--test-reporter=lcov', `--test-reporter-destination=${lcov}`, ...globs], { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 << 20 });
  if (!fs.existsSync(lcov)) { console.error(`coverage: no lcov written (exit ${r.status})\n${(r.stderr || '').slice(-1500)}`); process.exit(2); }
  const files = parseLcov(fs.readFileSync(lcov, 'utf8')).map(f => ({ ...f, file: path.relative(ROOT, f.file).replaceAll('\\', '/') }));
  if (!keep) fs.rmSync(lcov, { force: true });
  const s = summarise(files, top);
  const fmt = ([h, f]) => `${pct([h, f]).toFixed(1)}% (${h}/${f})`;
  console.log(`coverage (report only): ${s.files} files, the unit tests ${r.status === 0 ? 'passed' : `FAILED (exit ${r.status}), so the numbers are partial`}`);
  console.log(`  lines     ${fmt(s.lines)}\n  branches  ${fmt(s.branches)}\n  functions ${fmt(s.funcs)}`);
  console.log(`the ${s.least.length} least-covered of ${s.cores} cores (*.core.js and model.js that load in the tests), by line coverage:`);
  for (const f of s.least) console.log(`  ${pct(f.lines).toFixed(1).padStart(5)}% lines  ${pct(f.branches).toFixed(0).padStart(3)}% branches  ${f.file}`);
  process.exit(r.status === null ? 2 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
