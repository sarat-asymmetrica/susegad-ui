import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  parseDebt, sinceDate, summariseDebt, formatDebt, planSlice, planRung, judgeSpawn, parseEngines, checkArg, summarise, stepResult, cpuPct, loadNote, readRunSummary, formatSummary,
} from './rigour.core.js';
import { runPlan } from './rigour-run.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, '..', 'fixtures', 'rigour');
const NOW = new Date(Date.UTC(2026, 9, 17));
const debt = fs.readFileSync(path.join(FIX, 'debt.md'), 'utf8');

test('parseDebt: rows, an escaped pipe, and open versus struck-through', () => {
  const rows = parseDebt(debt);
  assert.equal(rows.length, 6);
  assert.equal(rows[1].item, 'A review with a | pipe in it');
  assert.deepEqual(rows.filter(r => !r.open).map(r => r.n), [5]);
});

test('parseDebt reads the real register: every row has a number, a place and a kind', () => {
  const rows = parseDebt(fs.readFileSync(path.join(HERE, '..', '..', 'docs', 'DEBT.md'), 'utf8'));
  assert.ok(rows.length >= 40, `only ${rows.length} rows parsed`);
  for (const r of rows) assert.ok(r.n > 0 && r.where && r.kind && r.since && r.status, JSON.stringify(r));
  assert.equal(new Set(rows.map(r => r.n)).size, rows.length, 'row numbers repeat');
});

test('sinceDate: a day and month, a month alone, and never in the future', () => {
  assert.equal(sinceDate('16 Oct', NOW).toISOString().slice(0, 10), '2026-10-16');
  assert.equal(sinceDate('Oct', NOW).toISOString().slice(0, 10), '2026-10-01');
  assert.equal(sinceDate('20 Dec', NOW).toISOString().slice(0, 10), '2025-12-20');
  assert.equal(sinceDate('soon', NOW).getTime(), 0);
});

test('summariseDebt: grouped by Where then Kind, oldest first, counted, cap checked', () => {
  const s = summariseDebt(parseDebt(debt), { cap: 3, now: NOW });
  assert.equal(s.open, 5);
  assert.equal(s.closed, 1);
  assert.equal(s.overCap, true);
  assert.deepEqual(s.groups.map(g => g.where), ['main', 'run/a'], 'the Where holding the oldest row first');
  assert.deepEqual(s.groups[0].kinds.map(k => [k.kind, k.rows.map(r => r.n)]), [['bug', [3]], ['review', [4]]]);
  assert.deepEqual(s.groups[1].kinds.map(k => [k.kind, k.rows.map(r => r.n)]), [['review', [2]], ['suite', [6, 1]]], 'within a kind, 12 Oct before 16 Oct');
  assert.deepEqual(s.byKind, { suite: 2, review: 2, bug: 1 });
  assert.deepEqual(s.oldest.map(r => r.n), [3, 2, 4, 6, 1]);
  assert.equal(summariseDebt(parseDebt(debt), { cap: 5, now: NOW }).overCap, false, 'at the cap is not over it');
  assert.match(formatDebt(s), /5 open is over the cap of 3 \(by 2\)/);
});

test('plans: the slice runs gates:slice, check, smoke then the tier; the rung runs gates first', () => {
  assert.deepEqual(planSlice({}).map(s => s.id), ['gates:slice', 'check:changed:chromium', 'smoke:changed:chromium', 'tier']);
  const two = planSlice({ base: 'run/x', engines: ['chromium', 'webkit'] });
  assert.deepEqual(two.map(s => s.id), ['gates:slice', 'check:changed:chromium', 'check:changed:webkit', 'smoke:changed:chromium', 'smoke:changed:webkit', 'tier']);
  assert.deepEqual(two[1].args, ['run', 'check', '--', '--changed=run/x', '--engine=chromium']);
  // the rung runs what it changed since the base, in Chromium; --full restores the whole suite in the engines given
  const rung = planRung({ base: '60722e7' });
  assert.deepEqual(rung.map(s => s.id), ['gates', 'tier', 'smoke:changed:chromium', 'check:changed:chromium']);
  assert.deepEqual(rung[2].args, ['run', 'smoke', '--', '--changed', '--base', '60722e7', '--engine=chromium']);
  assert.deepEqual(rung[3].args, ['run', 'check', '--', '--changed=60722e7', '--engine=chromium']);
  const full = planRung({ engines: ['chromium', 'webkit'], full: true });
  assert.deepEqual(full.map(s => s.id), ['gates', 'tier', 'smoke:chromium', 'smoke:webkit', 'check:chromium', 'check:webkit']);
  assert.deepEqual(full.find(s => s.id === 'check:webkit').args, ['run', 'check', '--', '--engine=webkit']);
});

test('a --changed rung run that reaches nothing is empty, a whole-suite run of 0 is failed', () => {
  const out = 'No checks needed for this diff';
  const changed = planRung({ base: 'x' }).find(s => s.id === 'check:changed:chromium');
  const whole = planRung({ full: true }).find(s => s.id === 'check:chromium');
  assert.equal(judgeSpawn(changed, 0, out).status, 'empty');
  assert.equal(judgeSpawn(whole, 0, out).status, 'failed');
});

test('arguments that go to a shell are checked', () => {
  assert.equal(checkArg('base', 'run/graduation'), 'run/graduation');
  assert.equal(checkArg('base', 'HEAD~3'), 'HEAD~3');
  assert.throws(() => checkArg('base', 'main; rm -rf /'));
  assert.throws(() => checkArg('base', '$(x)'));
  assert.deepEqual(parseEngines('chromium, webkit'), ['chromium', 'webkit']);
  assert.throws(() => parseEngines('chrome'));
});

test('summarise: a step that did not run is never a pass', () => {
  const s = id => ({ id, kind: 'tier' });
  assert.equal(summarise([stepResult(s('a'), 'passed'), stepResult(s('b'), 'not run')]).ok, false);
  assert.equal(summarise([stepResult(s('a'), 'passed')]).ok, true);
  assert.equal(summarise([]).ok, false, 'no steps is not a pass');
  assert.throws(() => stepResult(s('a'), 'ok'));
});

test('cpuPct and loadNote', () => {
  assert.equal(cpuPct({ busy: 0, total: 0 }, { busy: 50, total: 200 }), 25);
  assert.match(loadNote(80), /guess/);
  assert.doesNotMatch(loadNote(10), /guess/);
});

const spawnStep = (id, file, extra = {}) => ({ id, label: id, kind: 'spawn', cmd: 'node', args: [file], ...extra });
const quiet = () => {};

test('runPlan: a failure stops the rest ("not run"), unless the failing step is soft or keepGoing is set', async () => {
  const steps = [spawnStep('one', 'exit0.mjs'), spawnStep('two', 'exit3.mjs'), spawnStep('three', 'exit0.mjs')];
  let r = await runPlan({ steps, root: FIX, log: quiet });
  assert.deepEqual(r.map(x => x.status), ['passed', 'failed', 'not run']);
  assert.equal(r[1].exitCode, 3);
  assert.ok(r[0].durationMs >= 0 && typeof r[0].cpuBusyPct === 'number');
  assert.match(r[2].note, /two failed first/);
  r = await runPlan({ steps, root: FIX, keepGoing: true, log: quiet });
  assert.deepEqual(r.map(x => x.status), ['passed', 'failed', 'passed']);
  r = await runPlan({ steps: [spawnStep('two', 'exit3.mjs', { soft: true }), spawnStep('three', 'exit0.mjs')], root: FIX, log: quiet });
  assert.deepEqual(r.map(x => x.status), ['failed', 'passed']);
});

test('runPlan: a dry run runs nothing, and says so', async () => {
  const r = await runPlan({ steps: [spawnStep('two', 'exit3.mjs')], root: FIX, dry: true, log: quiet });
  assert.deepEqual(r.map(x => [x.status, x.durationMs, x.exitCode]), [['not run', 0, null]]);
});

const RIGOUR = path.join(HERE, '..', 'rigour.mjs');
const cli = (...a) => spawnSync(process.execPath, [RIGOUR, ...a], { encoding: 'utf8' });

test('rigour.mjs: usage errors exit 2; --scope=debt writes JSON', () => {
  assert.equal(cli().status, 2);
  assert.equal(cli('--scope=nope').status, 2);
  assert.equal(cli('--scope=slice', '--base', 'a;b').status, 2);
  assert.equal(cli('--scope=slice', '--engines=chrome').status, 2);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-rigour-'));
  const out = path.join(dir, 'debt.json');
  try {
    const r = cli('--scope=debt', '--debt', path.join(FIX, 'debt.md'), '--json', out);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /debt: 5 open of 6 rows/);
    const j = JSON.parse(fs.readFileSync(out, 'utf8'));
    assert.equal(j.open, 5);
    assert.equal(j.steps[0].status, 'passed');
    assert.equal(cli('--scope=debt', '--debt', path.join(FIX, 'debt.md'), '--strict', '--json', out).status, 0, '5 open is under the real cap of 20');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rigour.mjs --strict: 21 open rows is over the cap and exits 1; 20 is not', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-rigour-'));
  try {
    const table = n => ['| # | Where | Item | Kind | Since | Source | Status |', '|---|---|---|---|---|---|---|', ...Array.from({ length: n }, (_, i) => '| ' + (i + 1) + ' | main | thing | suite | 9 Oct | x | open |')].join('\n');
    const run = n => { const d = path.join(dir, 'd' + n + '.md'); fs.writeFileSync(d, table(n)); return cli('--scope=debt', '--debt', d, '--strict', '--json', path.join(dir, 'o' + n + '.json')); };
    assert.equal(run(20).status, 0);
    const r = run(21);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /WARN\s+21 open is over the cap of 20/);
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'o21.json'), 'utf8')).overCap, true);
    assert.equal(cli('--scope=debt', '--debt', path.join(dir, 'd21.md'), '--json', path.join(dir, 'x.json')).status, 0, 'without --strict it only warns');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('rigour.mjs --dry prints the plan, runs nothing and writes no file unless asked', () => {
  const r = cli('--scope=rung', '--dry', '--engines=chromium');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /1\. gates\s+npm run gates/);
  assert.match(r.stdout, /dry run: nothing was run/);
  assert.doesNotMatch(r.stdout, /result written/);
});

// ---- What a step's output says it did (Rasika on r-rigour-runner, items 4 and 5). Each was red before. ----

test('readRunSummary: checks and smoke say how many ran, how many were known flakes, how many were skipped', () => {
  const none = readRunSummary('check:changed:chromium', 'No checks needed for this diff.\n');
  assert.equal(none.empty, true);
  assert.match(none.note, /no checks ran/);
  const flaky = readRunSummary('check:chromium', '130 of 132 checks pass (chromium)\nSkipped, no GPU: 4 clauses in 2 checks\nNew reds: 0\nKnown flakes that went red: 2\n');
  assert.deepEqual([flaky.empty, flaky.ran, flaky.knownFlakes, flaky.skipped], [false, 132, 2, 4]);
  assert.match(flaky.note, /130 of 132 checks pass; 2 known flakes red, recorded not counted; 4 clauses skipped/);
  const sm = readRunSummary('smoke:changed:chromium', 'skipped a: x\nskipped b: y\nsmoke: 114/114 pages clean in 40 s on chromium\n');
  assert.deepEqual([sm.empty, sm.ran, sm.skipped], [false, 114, 2]);
  assert.match(sm.note, /114 of 114 pages clean; 2 pages skipped/);
  assert.equal(readRunSummary('smoke:chromium', 'smoke: nothing to run (0 of 116 pages)\n').empty, true);
  assert.equal(readRunSummary('smoke:chromium', 'smoke: 0/0 pages clean in 0 s\n').empty, true);
  assert.equal(readRunSummary('check:chromium', 'done\n').unread, true, 'no summary line: nothing is confirmed');
  assert.equal(readRunSummary('gates', 'anything'), null, 'only check and smoke are read');
});

const fixStep = (id, file) => ({ id, label: id, kind: 'spawn', cmd: 'node', args: [file] });

test('runPlan: an exit-0 check or smoke that ran nothing is not a pass, and known flakes and skips are recorded', async () => {
  const plan = scope => [fixStep('check:changed:chromium', 'check-none.mjs'), fixStep('check:chromium', 'check-flaky.mjs'),
    fixStep('smoke:changed:chromium', 'smoke-none.mjs'), fixStep('smoke:chromium', 'smoke-ok.mjs'), fixStep('check:webkit', 'check-mute.mjs')].map(s => ({ ...s, scope }));
  const slice = await runPlan({ steps: plan('slice'), root: FIX, keepGoing: true, log: quiet });
  assert.deepEqual(slice.map(x => x.status), ['empty', 'passed', 'empty', 'passed', 'failed'], 'a genuinely empty run is empty; a summary that cannot be read is failed (R6)');
  assert.match(slice[4].note, /nothing confirmed/);
  assert.equal(summarise(slice).ok, false, 'an unreadable summary makes the run red in a slice too');
  assert.equal(summarise(slice.slice(0, 4)).ok, true, 'without it, empty steps alone keep ok (and complete false)');
  assert.equal(slice[1].counts.knownFlakes, 2);
  assert.equal(slice[1].counts.skipped, 4);
  assert.match(slice[1].note, /2 known flakes red/);
  assert.equal(slice[3].counts.skipped, 2);
  assert.equal(slice[0].exitCode, 0, 'the exit code is still recorded');
  const rung = await runPlan({ steps: plan('rung'), root: FIX, keepGoing: true, log: quiet });
  assert.deepEqual(rung.map(x => x.status), ['failed', 'passed', 'failed', 'passed', 'failed'], 'a whole-suite run that ran 0 checks is a failure');
});

test('summarise: owed and empty steps are counted and never passes; the run is complete only when all passed', () => {
  const s = id => ({ id, kind: 'tier' });
  const sum = summarise([stepResult(s('a'), 'passed'), stepResult(s('b'), 'owed'), stepResult(s('c'), 'empty')]);
  assert.deepEqual([sum.passed, sum.owed, sum.empty, sum.failed, sum.ok, sum.complete], [1, 1, 1, 0, true, false]);
  assert.equal(summarise([stepResult(s('a'), 'passed')]).complete, true);
  assert.equal(summarise([stepResult(s('a'), 'owed'), stepResult(s('b'), 'failed')]).ok, false);
  const text = formatSummary([stepResult(s('b'), 'owed', { note: 'tier full: review owed' }), stepResult(s('c'), 'empty')], 'quiet');
  assert.match(text, /1 owed, 1 empty/);
  assert.match(text, /not complete/i);
});

function tierRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-rigour-tier-'));
  const g = (...a) => { const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
  const put = (p, t) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), t); };
  g('init', '-q', '-b', 'main');
  put('registry/registry.json', JSON.stringify({ items: [] }));
  g('add', '-A'); g('commit', '-q', '-m', 'start');
  g('checkout', '-q', '-b', 'slice/palm');
  return { dir, g, put };
}
const tierStep = { id: 'tier', label: 'tier', kind: 'tier', scope: 'slice', soft: true };

test('runPlan: the slice-scope tier step does not say passed for a Full slice that has no review', async () => {
  const r = tierRepo();
  try {
    r.put('packages/core/core.js', 'export const x = 1;\n');
    r.g('add', '-A'); r.g('commit', '-q', '-m', 'palm');
    let [res] = await runPlan({ steps: [tierStep], root: r.dir, base: 'main', log: quiet });
    assert.equal(res.status, 'owed');
    assert.match(res.note, /tier full: Rasika review owed/);
    assert.equal(res.detail.tier, 'full');
    // a review that says changes needed does not clear it; a passing one at the tier does
    const tip = r.g('rev-parse', '--short=7', 'HEAD');
    r.put('docs/reviews/palm.md', `# Palm\n\nRasika: changes needed. Tier: Full. Slice: slice/palm (${tip})\n`);
    [res] = await runPlan({ steps: [tierStep], root: r.dir, base: 'main', log: quiet });
    assert.equal(res.status, 'owed');
    r.put('docs/reviews/palm.md', '# Palm\nslice/palm.\nRasika: pass. Tier: Full.\n');
    [res] = await runPlan({ steps: [tierStep], root: r.dir, base: 'main', log: quiet });
    assert.equal(res.status, 'owed', 'prose is not the canonical line');
    r.put('docs/reviews/palm.md', `# Palm\n\nRasika: pass. Tier: Full. Slice: slice/palm (${tip})\n`);
    [res] = await runPlan({ steps: [tierStep], root: r.dir, base: 'main', log: quiet });
    assert.equal(res.status, 'passed');
  } finally { fs.rmSync(r.dir, { recursive: true, force: true }); }
});

test('runPlan: a Light slice owes no review, and its tier step passes', async () => {
  const r = tierRepo();
  try {
    r.put('tools/notes.mjs', 'export {};\n');
    r.g('add', '-A'); r.g('commit', '-q', '-m', 'notes');
    const [res] = await runPlan({ steps: [tierStep], root: r.dir, base: 'main', log: quiet });
    assert.equal(res.status, 'passed');
    assert.match(res.note, /light/);
  } finally { fs.rmSync(r.dir, { recursive: true, force: true }); }
});
