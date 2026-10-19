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

test('expectRed with allRed: a clause that passes under the plants is a missed plant, exit 1 and named; all red exits 0', () => {
  for (const [ok, status] of [[true, 1], [false, 0]]) {
    const file = path.join(dir, `allred-${ok}.check.mjs`);
    fs.writeFileSync(file, `import { harness } from ${JSON.stringify(HARNESS)};
const h = await harness({ axe: 'x' });
h.check('plant one', false);
h.check('plant two', ${ok});
await h.done({ expectRed: true, allRed: true });
`);
    const r = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, status, `${r.stdout}${r.stderr}`);
    if (ok) assert.match(r.stdout, /plant two/);
  }
});

test('the engine the run names is the engine launched (SG_ENGINE), and a GPU gate in another engine skips with its reason', { skip: !process.env.SG_TEST_WEBKIT && 'set SG_TEST_WEBKIT=1 where WebKit is installed' }, () => {
  const r = run("h.check('engine ' + h.engine + ' really launched', h.browser.browserType().name() === 'webkit');\nconst gate = await h.gpu();\ngate.skip('the live tier');", { env: { SG_ENGINE: 'webkit' }, harnessArgs: "{ args: ['--use-angle=d3d11'], axe: 'x' }" });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /pass {2}engine webkit really launched/);
  assert.match(r.out, /^skip {2}the live tier {2}\(no GPU: webkit/m);
});

// Rung 2b: `serve` reaches the dev server and `launch` reaches the browser launch. Each has a control that reads the other way.
test('serve: { root, notFoundHtml } changes what the dev server serves', () => {
  const root = path.join(dir, 'site');
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>served from the chosen root</title><p>hello');
  fs.writeFileSync(path.join(root, '404.html'), '<!doctype html><title>the chosen not-found page</title>');
  const body = [
    "const p = await (await h.context()).newPage();",
    "await p.goto(h.server.url + '/');",
    "h.check('serve.root: the page is the chosen root',(await p.title()) === 'served from the chosen root', await p.title());",
    "await p.goto(h.server.url + '/nothing-here');",
    "h.check('serve.notFoundHtml: a missing path gets the chosen 404 page', (await p.title()) === 'the chosen not-found page', await p.title());",
  ].join('\n');
  const r = run(body, { harnessArgs: `{ axe: 'x', serve: { root: ${JSON.stringify(root)}, notFoundHtml: '404.html' } }` });
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /all 2 checks pass/);
  // control: without serve, the same page is the repo's own root and the first clause is red
  const c = run(body, { harnessArgs: "{ axe: 'x' }" });
  assert.equal(c.status, 1, c.out);
  assert.match(c.out, /^FAIL {2}serve\.root/m);
});

test('launch: the options are passed to the browser launch, and a launch the engine refuses is an error, not a silent default', () => {
  // a wrong executable path must reach playwright's launch: if `launch` were dropped the browser would start and this would pass
  const r = run("h.check('unreachable', true);", { harnessArgs: "{ axe: 'x', launch: { executablePath: " + JSON.stringify(path.join(dir, 'no-such-browser')) + " } }" });
  assert.notEqual(r.status, 0, r.out);
  assert.doesNotMatch(r.out, /^pass {2}unreachable/m);
});

test('exit: done({ exit: 2 }) wins over the verdict, green or red (a --break that was never served)', () => {
  for (const [label, ok] of [['green', true], ['red', false]]) {
    const file = path.join(dir, `exit-${label}.check.mjs`);
    fs.writeFileSync(file, `import { harness } from ${JSON.stringify(HARNESS)};\nconst h = await harness({ axe: 'x' });\nh.check('c', ${ok});\nawait h.done({ exit: 2 });\n`);
    const r = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 2, `${label}: ${r.stdout}${r.stderr}`);
  }
  // control: without it the same green file exits 0
  assert.equal(run("h.check('c', true);", { harnessArgs: "{ axe: 'x' }" }).status, 0);
});

// session() in tools/lib/browser.mjs is the older glue five checks still use (orient, image, stage3d, depth-photo, strip). Its done()
// had no close timeout, so a browser close that never returned hung the check (Rasika, S2). The control: a close that never returns.
test('session().done() gives up on a browser close that never returns, and gives the slot back', () => {
  const file = path.join(dir, 'session-hang.mjs');
  const BROWSER = pathToFileURL(path.resolve(import.meta.dirname, 'browser.mjs')).href;
  fs.writeFileSync(file, `import { session } from ${JSON.stringify(BROWSER)};\nconst s = await session();\nconst real = s.browser.close.bind(s.browser);\ns.browser.close = () => new Promise(() => {});\nawait s.done({ closeMs: 500 });\nconsole.log('done returned');\nreal().catch(() => {});\nsetTimeout(() => process.exit(0), 1500);\n`);
  const r = spawnSync(process.execPath, [file], { encoding: 'utf8', timeout: 90000 });
  const out = `${r.stdout}${r.stderr}`;
  assert.equal(r.status, 0, out);
  assert.match(out, /closing took over 0\.5 s/);
  assert.match(out, /done returned/);
});
