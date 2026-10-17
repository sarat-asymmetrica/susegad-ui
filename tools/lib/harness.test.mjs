// The check harness (component-check.mjs harness()) run as a check file would run it: a child process, a real browser, a
// verdict and an exit code. Each case has a control that can fail: a red clause must exit 1, a skip must be counted and
// must not be a pass, a run that never asked axe must say so, and the engine the run names must be the engine launched.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const HARNESS = pathToFileURL(path.resolve(import.meta.dirname, 'component-check.mjs')).href;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-harness-'));
test.after(() => fs.rmSync(dir, { recursive: true, force: true }));

/** Write and run a tiny check file; returns { status, out }. */
function run(body, { env = {}, harnessArgs = '' } = {}) {
  const file = path.join(dir, `c${Math.random().toString(36).slice(2)}.check.mjs`);
  fs.writeFileSync(file, `import { harness } from ${JSON.stringify(HARNESS)};\nconst h = await harness(${harnessArgs});\n${body}\nawait h.done();\n`);
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8', env: { ...process.env, ...env }, timeout: 120000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('a clean run exits 0, names its engine, and says axe never ran when it did not opt out', () => {
  const r = run("h.check('engine is ' + h.engine, h.engine === 'chromium');");
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /^pass {2}engine is chromium/m);
  assert.match(r.out, /all 1 checks pass/);
  assert.match(r.out, /^note {2}axe never ran/m);
});

test('control: a red clause exits 1 and the verdict says so', () => {
  const r = run("h.check('good', true);\nh.check('bad', false, 'on purpose');", { harnessArgs: "{ axe: 'x' }" });
  assert.equal(r.status, 1);
  assert.match(r.out, /^FAIL {2}bad {2}\(on purpose\)/m);
  assert.match(r.out, /1 of 2 checks failed/);
});

test('a skip is printed and counted, and is neither a pass nor a red', () => {
  const r = run("h.check('good', true);\nif (h.skip('a WebGL readback', 'needs a GPU')) {}", { harnessArgs: "{ axe: 'x' }" });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /^skip {2}a WebGL readback is not measurable in chromium {2}\(needs a GPU\)/m);
  assert.match(r.out, /all 1 checks pass, 1 skipped/);
  assert.doesNotMatch(r.out, /axe never ran/, 'an opt-out with a reason prints no axe note');
});

test('expectRed: a fail-first run with reds exits 0', () => {
  const file = path.join(dir, 'breakrun.check.mjs');
  fs.writeFileSync(file, `import { harness } from ${JSON.stringify(HARNESS)};\nconst h = await harness({ axe: 'x' });\nh.check('bad', false);\nawait h.done({ expectRed: true });\n`);
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 120000 });
  assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
  assert.match(r.stdout, /^FAIL {2}bad/m);
});

test('the engine the run names is the engine launched (SG_ENGINE), and a GPU gate in another engine skips with its reason', { skip: !process.env.SG_TEST_WEBKIT && 'set SG_TEST_WEBKIT=1 where WebKit is installed' }, () => {
  const r = run("h.check('engine ' + h.engine + ' really launched', h.browser.browserType().name() === 'webkit');\nconst gate = await h.gpu();\ngate.skip('the live tier');", { env: { SG_ENGINE: 'webkit' }, harnessArgs: "{ args: ['--use-angle=d3d11'], axe: 'x' }" });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /pass {2}engine webkit really launched/);
  assert.match(r.out, /^skip {2}the live tier {2}\(no GPU: webkit/m);
});
