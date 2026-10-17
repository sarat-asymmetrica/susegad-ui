// The whole-repo check step: every artifact check and lint that reads the real tree, each run once, with one
// summary table and a non-zero exit when any is red. `npm run gates` is test:unit + test:tools + this
// (docs/GOAL-RIGOUR.md, rung 1d), so a stale generated file, a copy slip in a scene's meta.js, a rotted mutant needle
// or a component without a conformance table is found here and nowhere else needs to look.
//
//   node tools/repo-check.mjs                        all steps
//   node tools/repo-check.mjs --only=cem,copy-lint   just those (names from --list)
//   node tools/repo-check.mjs --list                 the steps and what each runs
//   node tools/repo-check.mjs --tools-tests=if-changed
//                                                    also run `npm run test:tools`, but only when the slice touched
//                                                    tools/ or package.json (the diff against main, plus the working
//                                                    tree); `--tools-tests=always` runs it every time
//   node tools/repo-check.mjs --root=<dir>           run the tools found under <dir> (a throwaway tree, in tests)
//   node tools/repo-check.mjs --jobs=N               steps in flight at once (default 2; none opens a browser)
//
// A step is a plain child process: its exit code is its verdict, and a red step's last lines are printed under the table.
// Each tool keeps its own unit tests on fixtures (they stay in `npm test`); the real-tree run lives only here.

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every whole-repo step. `args` are relative to the root; the first is the script. */
export const STEPS = [
  { name: 'registry', args: ['registry/build.mjs', '--check'], what: 'the registry index and its views are up to date' },
  { name: 'cem', args: ['tools/cem.mjs', '--check'], what: 'custom-elements.json is up to date' },
  { name: 'cem-coverage', args: ['tools/cem-coverage.mjs'], what: 'every sg-* tag defined under packages/ is in the manifest' },
  { name: 'skill-inventory', args: ['tools/skill-inventory.mjs', '--check'], what: 'the skill inventory is up to date' },
  { name: 'copy-lint', args: ['tools/copy-lint.mjs'], what: 'no em dash or announced honesty in docs, prompts, demos, meta.js or STRINGS' },
  { name: 'motif-lint', args: ['tools/motif-lint.mjs'], what: 'the registry\'s motif tiers, leads and glosses, and the home hero' },
  { name: 'canvas-text-lint', args: ['tools/canvas-text-lint.mjs'], what: 'no text drawn in a canvas outside the decided exceptions' },
  { name: 'conformance', args: ['tools/conformance.mjs'], what: 'every component has a valid WCAG conformance table' },
  { name: 'conformance-summary', args: ['tools/conformance.mjs', '--summary', '--check'], what: 'docs/reference/accessibility.md is up to date with those tables' },
  { name: 'mutants', args: ['tools/lib/mutants.guard.mjs'], what: 'every planted fault in every check still has its needle in its target' },
];

/** Does a diff touch what test:tools tests? (the tools themselves, their shared libraries, and the manifest that scripts them) */
export const touchesTools = files => files.some(f => /^(tools\/|package\.json$)/.test(f.replaceAll('\\', '/')));

/** The slice's changed files: the diff against main's merge-base, plus anything modified or untracked. null when git cannot say. */
export function changedFiles(root, { base = 'main' } = {}) {
  const git = args => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  const mb = git(['merge-base', 'HEAD', base]);
  if (mb.status !== 0) return null;
  const diff = git(['diff', '--name-only', mb.stdout.trim()]);
  const status = git(['status', '--porcelain']);
  if (diff.status !== 0 || status.status !== 0) return null;
  const dirty = status.stdout.split('\n').filter(Boolean).map(l => l.slice(3).replace(/^.* -> /, ''));
  return [...new Set([...diff.stdout.split('\n').filter(Boolean), ...dirty])];
}

/** Run one step to completion: { name, ok, code, seconds, out }. */
export function runStep(step, { root = REPO, node = process.execPath } = {}) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const cmd = step.cmd ?? [node, ...step.args.map((a, i) => (i === 0 ? path.join(root, a) : a))];
    const child = spawn(cmd[0], cmd.slice(1), { cwd: root, shell: step.shell ?? false, windowsHide: true });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('error', e => resolve({ name: step.name, ok: false, code: -1, seconds: (Date.now() - t0) / 1000, out: `${out}${e.message}\n` }));
    child.on('close', code => resolve({ name: step.name, ok: code === 0, code, seconds: (Date.now() - t0) / 1000, out }));
  });
}

/** Run steps with at most `jobs` in flight; results come back in step order. */
export async function runSteps(steps, { root = REPO, jobs = 2, node } = {}) {
  const results = new Array(steps.length);
  let next = 0;
  const worker = async () => { while (next < steps.length) { const i = next++; results[i] = await runStep(steps[i], { root, node }); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, steps.length)) }, worker));
  return results;
}

const tail = (out, n = 12) => out.trim().split('\n').slice(-n).join('\n');
const lastLine = out => out.trim().split('\n').slice(-1)[0] ?? '';

/** The summary table, and the tails of the red steps under it. */
export function report(results, skipped = []) {
  const w = Math.max(...results.map(r => r.name.length), ...skipped.map(s => s.name.length), 4);
  const rows = results.map(r => `${r.ok ? 'pass' : 'FAIL'}  ${r.name.padEnd(w)}  ${r.seconds.toFixed(1).padStart(5)} s  ${lastLine(r.out).slice(0, 110)}`);
  for (const s of skipped) rows.push(`skip  ${s.name.padEnd(w)}  ${'-'.padStart(5)}    ${s.why}`);
  const red = results.filter(r => !r.ok);
  const lines = [...rows, ''];
  for (const r of red) lines.push(`--- ${r.name} (exit ${r.code}) ---`, tail(r.out), '');
  lines.push(red.length ? `${red.length} of ${results.length} whole-repo steps red: ${red.map(r => r.name).join(', ')}` : `${results.length} of ${results.length} whole-repo steps green`);
  return lines.join('\n');
}

async function main(argv) {
  const flag = (name, dflt) => argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? dflt;
  const known = /^--(only=.+|list|tools-tests=(if-changed|always)|root=.+|jobs=\d+)$/;
  const unknown = argv.filter(a => !known.test(a));
  if (unknown.length) { console.error(`unknown argument${unknown.length === 1 ? '' : 's'}: ${unknown.join(' ')}\n(see the header of tools/repo-check.mjs)`); return 2; }
  if (argv.includes('--list')) { for (const s of STEPS) console.log(`${s.name.padEnd(20)} ${s.args.join(' ')}\n${' '.repeat(21)}${s.what}`); return 0; }
  const root = flag('root') ? path.resolve(flag('root')) : REPO;
  let steps = STEPS;
  const only = flag('only');
  if (only) {
    const names = only.split(',');
    const bad = names.filter(n => !STEPS.some(s => s.name === n));
    if (bad.length) { console.error(`no such step: ${bad.join(', ')} (see --list)`); return 2; }
    steps = STEPS.filter(s => names.includes(s.name));
  }
  const skipped = [];
  const tt = flag('tools-tests');
  if (tt) {
    const files = tt === 'always' ? [] : changedFiles(root);
    if (tt === 'always' || files === null || touchesTools(files)) {
      steps = [...steps, { name: 'test:tools', cmd: ['npm', 'run', 'test:tools', '--silent'], shell: true, what: 'the tools\' own unit tests' }];
      if (files === null) console.log('tools-tests: git could not say what changed, so the tools tests run');
    } else skipped.push({ name: 'test:tools', why: `tools/ and package.json unchanged since main (${files.length} file${files.length === 1 ? '' : 's'} changed)` });
  }
  const t0 = Date.now();
  const results = await runSteps(steps, { root, jobs: Number(flag('jobs', 2)) });
  console.log(report(results, skipped));
  console.log(`repo-check took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return results.every(r => r.ok) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  process.exitCode = await main(process.argv.slice(2));
}
