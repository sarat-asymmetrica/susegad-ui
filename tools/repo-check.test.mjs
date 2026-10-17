// repo-check: the table, the exit code, the step list, and a stale artifact turning it red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STEPS, runSteps, report, touchesTools } from './repo-check.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const CLI = path.join(HERE, 'repo-check.mjs');
const node = process.execPath;

test('the step list holds every whole-repo check the goal names, each once', () => {
  const names = STEPS.map(s => s.name);
  assert.equal(new Set(names).size, names.length, 'a step is listed twice');
  for (const want of ['registry', 'cem', 'skill-inventory', 'copy-lint', 'motif-lint', 'canvas-text-lint', 'conformance', 'mutants']) assert.ok(names.includes(want), `${want} is missing`);
  for (const s of STEPS) assert.ok(fs.existsSync(path.join(REPO, s.args[0])), `${s.name}: ${s.args[0]} does not exist`);
});

test('steps run, results keep their order, a red step is named in the report and the exit code', async () => {
  const fake = (name, code, say) => ({ name, cmd: [node, '-e', `console.log(${JSON.stringify(say)}); process.exit(${code})`] });
  const results = await runSteps([fake('slow-green', 0, 'all fine'), fake('red', 3, 'the thing is stale'), fake('fast-green', 0, 'also fine')], { jobs: 2 });
  assert.deepEqual(results.map(r => [r.name, r.ok, r.code]), [['slow-green', true, 0], ['red', false, 3], ['fast-green', true, 0]]);
  const text = report(results, [{ name: 'test:tools', why: 'tools/ unchanged' }]);
  assert.match(text, /^pass  slow-green/m);
  assert.match(text, /^FAIL  red .*the thing is stale/m);
  assert.match(text, /^skip  test:tools .*tools\/ unchanged/m);
  assert.match(text, /--- red \(exit 3\) ---\nthe thing is stale/);
  assert.match(text, /1 of 3 whole-repo steps red: red/);
});

test('a step that cannot start is red, not a crash', async () => {
  const [r] = await runSteps([{ name: 'nope', cmd: ['definitely-not-a-program-sg'] }]);
  assert.equal(r.ok, false);
});

test('touchesTools: tools/ and package.json count, nothing else does', () => {
  assert.equal(touchesTools(['packages/scenes/abri/abri.js', 'docs/LEDGER.md']), false);
  assert.equal(touchesTools(['packages/scenes/abri/abri.js', 'tools/copy-lint.mjs']), true);
  assert.equal(touchesTools(['package.json']), true);
  assert.equal(touchesTools(['tools\\lib\\slots.mjs']), true);
  assert.equal(touchesTools([]), false);
});

// Red first: a stale generated artifact in a throwaway tree turns the real CLI red; regenerating it turns it green.
test('a planted stale custom-elements.json turns repo-check red, and regenerating it turns it green', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-check-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'tools'), { recursive: true });
  fs.mkdirSync(path.join(root, 'registry'), { recursive: true });
  fs.copyFileSync(path.join(HERE, 'cem.mjs'), path.join(root, 'tools/cem.mjs'));
  fs.writeFileSync(path.join(root, 'registry/registry.json'), JSON.stringify({ name: 'fixture', format: 1, base: '..', items: [] }));
  fs.writeFileSync(path.join(root, 'custom-elements.json'), '{ "stale": true }\n');
  const run = () => spawnSync(node, [CLI, `--root=${root}`, '--only=cem'], { encoding: 'utf8' });
  const red = run();
  assert.equal(red.status, 1, red.stdout + red.stderr);
  assert.match(red.stdout, /^FAIL  cem /m);
  assert.match(red.stdout, /custom-elements\.json is out of date/);
  execFileSync(node, [path.join(root, 'tools/cem.mjs')], { cwd: root });
  const green = run();
  assert.equal(green.status, 0, green.stdout + green.stderr);
  assert.match(green.stdout, /^pass  cem /m);
  assert.match(green.stdout, /1 of 1 whole-repo steps green/);
});

test('unknown flags and unknown step names are refused', () => {
  assert.equal(spawnSync(node, [CLI, '--nope'], { encoding: 'utf8' }).status, 2);
  assert.equal(spawnSync(node, [CLI, '--only=cem,not-a-step'], { encoding: 'utf8' }).status, 2);
  const list = spawnSync(node, [CLI, '--list'], { encoding: 'utf8' });
  assert.equal(list.status, 0);
  assert.match(list.stdout, /copy-lint/);
});
