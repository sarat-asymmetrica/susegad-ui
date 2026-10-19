// Type check the pure cores (docs/GOAL-RIGOUR.md, rung 3d): `tsc --noEmit` over jsconfig.json, which reads every
// `*.core.js` and `model.js` under packages/ with checkJs on (and the plain modules they import).
//
//   node tools/typecheck.mjs            run tsc, compare with tools/typecheck.baseline.json, exit 1 on a rise
//   node tools/typecheck.mjs --update   rewrite the baseline from this run (do it after fixing, never to hide a rise)
//   node tools/typecheck.mjs --list     also print every error line
//
// The baseline is the residue recorded in docs/DEBT.md, counted per file and error code (line numbers are left out,
// so editing above an error does not move it). A count that rises, or a pair that was not there, is red. A count that
// falls is green with a note to run --update, so the residue only shrinks.
// tsc is `typescript` from node_modules (this tree's, else the one a parent folder's node_modules resolves, as in the
// worktrees); set SG_TSC to a tsc.js path to use another copy.

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'tools', 'typecheck.baseline.json');
const LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;

/** tsc's text output -> { 'file|TScode': count } plus the parsed errors. */
export function parse(text) {
  const counts = {}, errors = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const m = LINE.exec(raw);
    if (!m) continue;
    const file = m[1].replaceAll('\\', '/'), key = `${file}|${m[4]}`;
    counts[key] = (counts[key] || 0) + 1;
    errors.push({ file, line: +m[2], code: m[4], message: m[5] });
  }
  return { counts, errors };
}

/** { rose: [[key, was, now]], fell: [[key, was, now]] } between a baseline and a run. */
export function compare(baseline, counts) {
  const rose = [], fell = [];
  for (const key of new Set([...Object.keys(baseline), ...Object.keys(counts)])) {
    const was = baseline[key] || 0, now = counts[key] || 0;
    if (now > was) rose.push([key, was, now]);
    else if (now < was) fell.push([key, was, now]);
  }
  return { rose, fell };
}

function findTsc() {
  if (process.env.SG_TSC) return process.env.SG_TSC;
  const tsc = dir => path.join(dir, 'lib', 'tsc.js');
  const local = path.join(ROOT, 'node_modules', 'typescript');
  if (fs.existsSync(tsc(local))) return tsc(local);
  try { return tsc(path.dirname(createRequire(import.meta.url).resolve('typescript/package.json'))); }
  catch { return null; }
}

function main() {
  const args = process.argv.slice(2);
  const tsc = findTsc();
  if (!tsc) { console.error('typecheck: typescript is not installed (npm install, or set SG_TSC to a tsc.js)'); process.exit(2); }
  const r = spawnSync(process.execPath, [tsc, '--noEmit', '-p', path.join(ROOT, 'jsconfig.json')], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  const { counts, errors } = parse(out);
  if (r.status !== 0 && !errors.length) { console.error(`typecheck: tsc failed without a type error\n${out.slice(-2000)}`); process.exit(2); }
  const total = errors.length;
  if (args.includes('--list')) for (const e of errors) console.log(`${e.file}:${e.line} ${e.code} ${e.message}`);
  if (args.includes('--update')) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(BASELINE, JSON.stringify(sorted, null, 1) + '\n');
    console.log(`typecheck: baseline written, ${total} errors in ${Object.keys(sorted).length} file/code pairs`);
    return;
  }
  const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {};
  const was = Object.values(baseline).reduce((a, b) => a + b, 0);
  const { rose, fell } = compare(baseline, counts);
  const byCode = {};
  for (const e of errors) byCode[e.code] = (byCode[e.code] || 0) + 1;
  console.log(`typecheck: ${total} errors (baseline ${was}) in ${new Set(errors.map(e => e.file)).size} files; ` +
    Object.entries(byCode).sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} x${n}`).join(', '));
  for (const [key, a, b] of rose) {
    console.log(`  RED ${key}: ${a} -> ${b}`);
    for (const e of errors.filter(e => `${e.file}|${e.code}` === key)) console.log(`      ${e.file}:${e.line} ${e.message.slice(0, 160)}`);
  }
  if (fell.length) console.log(`  ${fell.length} pair(s) fell below the baseline (${fell.reduce((s, [, a, b]) => s + a - b, 0)} fewer): run \`node tools/typecheck.mjs --update\` to keep the gain`);
  if (rose.length) { console.log(`typecheck: RED, ${rose.length} pair(s) rose above the recorded baseline`); process.exit(1); }
  console.log('typecheck: green on the recorded baseline');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
