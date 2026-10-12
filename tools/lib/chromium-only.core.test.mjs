import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drivesChromium } from './chromium-only.core.js';

const root = fileURLToPath(new URL('../../', import.meta.url));

function checksUnder(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) checksUnder(p, out);
    else if (e.name.endsWith('.check.mjs')) out.push(path.relative(root, p).replaceAll('\\', '/'));
  }
  return out;
}

test('drivesChromium reads a direct launch and a scene-probe import, and not pickEngine', () => {
  assert.equal(drivesChromium("const b = await chromium.launch({ args: [] });"), true);
  assert.equal(drivesChromium("import { session } from '../../../tools/lib/scene-probe.mjs';"), true);
  assert.equal(drivesChromium("const b = await pickEngine().launch();"), false);
});

// Shrinking this list is the point: move a check to pickEngine(engineName()) and take it off. Growing it should be a decision.
const EXPECTED = [
  'packages/components/button/button.check.mjs',
  'packages/components/link/link.check.mjs',
  'packages/components/scroll-section/scroll-section.check.mjs',
  'packages/components/tabs/tabs.check.mjs',
  'packages/recipes/site-shell/recipe.check.mjs',
  'packages/scenes/dar/dar.check.mjs',
  'packages/scenes/ferry/ferry.check.mjs',
  'packages/scenes/nod/nod.check.mjs',
  'packages/scenes/pahat/pahat.check.mjs',
  'packages/scenes/vaati/vaati.check.mjs',
  'packages/scenes/vahi/vahi.check.mjs',
  'packages/scenes/veranda/arrange.check.mjs',
  'packages/scenes/veranda/flow.check.mjs',
  'packages/scenes/veranda/notes.check.mjs',
  'packages/scenes/veranda/quads.check.mjs',
  'packages/scenes/veranda/stage.check.mjs',
  'packages/scenes/veranda/veranda.check.mjs',
  'packages/scenes/veranda/words.check.mjs',
  'packages/transitions/kantar/kantar.check.mjs',
  'packages/transitions/page.check.mjs',
];

test('the checks that drive Chromium themselves are the ones BROWSERS.md lists', () => {
  const found = checksUnder(path.join(root, 'packages')).concat(checksUnder(path.join(root, 'tools')).filter(f => f !== 'tools/rest.check.mjs'))
    .filter(f => drivesChromium(fs.readFileSync(path.join(root, f), 'utf8'))).sort();
  assert.deepEqual(found, EXPECTED);
  const doc = fs.readFileSync(path.join(root, 'docs/BROWSERS.md'), 'utf8');
  // the page names them short: components/link, scenes/veranda/arrange, transitions/page
  const names = f => { const parts = f.replace(/^packages\//, '').replace(/\.check\.mjs$/, '').split('/'); return [parts.join('/'), parts.slice(0, -1).join('/')]; };
  for (const f of EXPECTED) assert.ok(names(f).some(n => doc.includes('`' + n + '`')), `${f} is not listed in docs/BROWSERS.md`);
});
