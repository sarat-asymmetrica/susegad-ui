import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drivesChromium } from './chromium-only.core.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

function checksUnder(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) checksUnder(p, out);
    else if (e.name.endsWith('.check.mjs')) out.push(p);
  }
  return out;
}
/** The check files under `dir` that launch Chromium themselves, as paths relative to `dir`. */
const offenders = dir => checksUnder(dir).filter(f => drivesChromium(fs.readFileSync(f, 'utf8'))).map(f => path.relative(dir, f).replaceAll(path.sep, '/')).sort();

test('drivesChromium reads a direct launch, and not the harness, pickEngine or a comment', () => {
  assert.equal(drivesChromium("const b = await chromium.launch({ args: [] });"), true);
  assert.equal(drivesChromium("const b = await chromium .launch();"), true);
  assert.equal(drivesChromium("const b = await chromium.launchPersistentContext('x');"), true);
  assert.equal(drivesChromium("const h = await harness();"), false);
  assert.equal(drivesChromium("const b = await pickEngine().launch();"), false);
  assert.equal(drivesChromium("// it used to call chromium.launch() itself\nconst h = await harness();"), false);
});

test('red first: a check file that launches Chromium itself is found', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-chromium-only-'));
  try {
    fs.mkdirSync(path.join(dir, 'a'));
    fs.writeFileSync(path.join(dir, 'a', 'bad.check.mjs'), "import { chromium } from 'playwright';\nconst browser = await chromium.launch();\n");
    fs.writeFileSync(path.join(dir, 'a', 'good.check.mjs'), "import { harness } from 'x';\nconst h = await harness();\n");
    assert.deepEqual(offenders(dir), ['a/bad.check.mjs']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// What is left. These four serve the built docs site from their own roots (startServer({ root: out/docs })), are outside rung 2a's
// twenty, and tools/checks.mjs still skips them under another engine. Shrinking this list is the point (rung 2b); growing it is a decision.
const STILL_CHROMIUM = ['apps/docs/embed.check.mjs', 'apps/docs/header.check.mjs', 'apps/docs/hero.check.mjs', 'apps/docs/site.check.mjs'];

test('no check file launches Chromium itself but the docs-site four: every other one runs in the engine the run asked for', () => {
  const found = ['packages', 'tools', 'apps'].flatMap(d => offenders(path.join(root, d)).map(f => `${d}/${f}`));
  assert.deepEqual(found, STILL_CHROMIUM, 'open the browser with harness() from tools/lib/component-check.mjs (docs/BROWSERS.md, "Adding a new engine-aware check")');
});

// The twenty that drove Chromium whatever --engine said (12 October 2026) and rung 2a moved onto the harness.
const MOVED = [
  'packages/components/button/button.check.mjs', 'packages/components/link/link.check.mjs', 'packages/components/scroll-section/scroll-section.check.mjs',
  'packages/components/tabs/tabs.check.mjs', 'packages/recipes/site-shell/recipe.check.mjs', 'packages/scenes/dar/dar.check.mjs', 'packages/scenes/ferry/ferry.check.mjs',
  'packages/scenes/nod/nod.check.mjs', 'packages/scenes/pahat/pahat.check.mjs', 'packages/scenes/vaati/vaati.check.mjs', 'packages/scenes/vahi/vahi.check.mjs',
  'packages/scenes/veranda/arrange.check.mjs', 'packages/scenes/veranda/flow.check.mjs', 'packages/scenes/veranda/notes.check.mjs', 'packages/scenes/veranda/quads.check.mjs',
  'packages/scenes/veranda/stage.check.mjs', 'packages/scenes/veranda/veranda.check.mjs', 'packages/scenes/veranda/words.check.mjs',
  'packages/transitions/kantar/kantar.check.mjs', 'packages/transitions/page.check.mjs',
];

test('the twenty checks rung 2a moved open their browser through harness()', () => {
  assert.equal(MOVED.length, 20);
  for (const f of MOVED) assert.match(fs.readFileSync(path.join(root, f), 'utf8'), /await harness\(/, `${f} should open its browser through harness()`);
});

// Rung 2b: no check file opens a browser by hand without the harness, whatever engine it picks. (The docs-site four are the same list as above.)
import { launchesWithoutHarness } from './chromium-only.core.js';

test('launchesWithoutHarness reads pickEngine and the engines\' own launch, and not the harness, h.launch or a comment', () => {
  assert.equal(launchesWithoutHarness("const browser = await pickEngine().launch();"), true);
  assert.equal(launchesWithoutHarness("const browser = await pickEngine(engine).launch({ env: localeEnv() });"), true);
  assert.equal(launchesWithoutHarness("const b = await webkit.launch();"), true);
  assert.equal(launchesWithoutHarness("const b = await chromium.launch();"), true);
  assert.equal(launchesWithoutHarness("const h = await harness();\nconst { browser } = h;"), false);
  assert.equal(launchesWithoutHarness("const h = await harness();\nconst b2 = await h.launch({ args: [] });"), false);
  assert.equal(launchesWithoutHarness("// the old glue was pickEngine().launch()\nconst h = await harness();"), false);
  assert.equal(launchesWithoutHarness("const z = (await import('./lib/component-check.mjs')).harness({ axe: 'x' });"), false);
});

test('red first: a check file that launches through pickEngine() without the harness is found', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-no-harness-'));
  try {
    fs.mkdirSync(path.join(dir, 'a'));
    fs.writeFileSync(path.join(dir, 'a', 'raw.check.mjs'), "import { pickEngine } from 'x';\nconst browser = await pickEngine().launch();\n");
    fs.writeFileSync(path.join(dir, 'a', 'good.check.mjs'), "import { harness } from 'x';\nconst h = await harness();\n");
    const bad = checksUnder(dir).filter(f => launchesWithoutHarness(fs.readFileSync(f, 'utf8'))).map(f => path.relative(dir, f).replaceAll(path.sep, '/'));
    assert.deepEqual(bad, ['a/raw.check.mjs']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('every check file that opens a browser does it through harness(), but the docs-site four', () => {
  const found = ['packages', 'tools', 'apps'].flatMap(d => checksUnder(path.join(root, d))
    .filter(f => launchesWithoutHarness(fs.readFileSync(f, 'utf8'))).map(f => `${d}/${path.relative(path.join(root, d), f).replaceAll(path.sep, '/')}`)).sort();
  assert.deepEqual(found, STILL_CHROMIUM, 'open the browser with harness() from tools/lib/component-check.mjs; the raw pickEngine() glue is gone (docs/BROWSERS.md)');
});
