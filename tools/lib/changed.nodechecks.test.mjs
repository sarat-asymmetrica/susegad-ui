// Which diffs select the Node-only text gate (NODE_CHECKS in changed.core.js), and that its own tooling does not
// make every browser check run.

import test from 'node:test';
import assert from 'node:assert/strict';
import { selectChecks, selectNodeChecks, NODE_CHECKS } from './changed.core.js';

const GATE = 'tools/text-gate.mjs';
const BAKE = 'tools/bake-gate.mjs';
const sel = changed => selectNodeChecks({ changed }).map(s => s.check);

test('the gate is selected by the type tier, the fonts, the token stacks, the gate copy and the pure models it reads', () => {
  for (const f of [
    'packages/type/layout.core.js', 'packages/type/fixtures/gate-copy.js', 'packages/type/fixtures/calibration.json',
    'packages/tokens/fonts.css', 'packages/tokens/fonts/kalam/kalam-400-latin.woff2', 'packages/tokens/tokens.css',
    'packages/scenes/tinto/model.js', 'packages/scenes/vad/model.js', 'packages/scenes/veranda/matka.core.js',
    'packages/scenes/tinto/words.js', 'packages/scenes/vad/render.js', 'packages/scenes/veranda/matka-view.js',
    'tools/text-gate.mjs', 'tools/text-gate.calibrate.mjs', 'tools/lib/text-gate.manifest.js', 'tools/lib/hb-canvas.mjs',
  ]) assert.deepEqual(sel([f]), [GATE, BAKE], f); // the bake gate runs the text gate, so it shares these inputs
});

test('it carries the reason, naming the file and the input', () => {
  const [s] = selectNodeChecks({ changed: ['packages/scenes/vad/model.js'] });
  assert.match(s.reasons[0], /packages\/scenes\/vad\/model\.js is an input of tools\/text-gate\.mjs/);
});

test('an unrelated change does not select it, and neither does a scene file it does not read', () => {
  assert.deepEqual(sel(['packages/components/button/button.js', 'packages/scenes/tinto/render.js', 'docs/RUNBOOK.md']), []);
});

test('a shared primitive selects it with everything else', () => {
  assert.deepEqual(sel(['packages/core/index.js']), [GATE, BAKE]);
  assert.match(selectNodeChecks({ changed: ['package.json'] })[0].reasons[0], /shared primitive/);
});

test('the gate\'s own tooling in tools/lib/ is not a shared primitive: the browser checks do not all run', () => {
  const checks = ['packages/components/button/button.check.mjs'];
  const r = selectChecks({ changed: ['tools/lib/text-gate.core.js', 'tools/lib/hb-canvas.mjs', 'tools/lib/text-gate.test.mjs', 'tools/lib/bake-gate.core.js', 'tools/lib/bake-gate.test.mjs'], checks, items: [] });
  assert.equal(r.all, false);
  assert.deepEqual(r.selected, []);
  // but any other file in tools/lib still is
  assert.equal(selectChecks({ changed: ['tools/lib/browser.mjs'], checks, items: [] }).all, true);
  assert.equal(selectChecks({ changed: ['tools/lib/text-gate.core.js', 'tools/lib/browser.mjs'], checks, items: [] }).all, true);
});

test('NODE_CHECKS names a file that exists', async () => {
  const fs = await import('node:fs'), path = await import('node:path'), { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  for (const f of Object.keys(NODE_CHECKS)) assert.ok(fs.existsSync(path.join(root, f)), f);
});

test('the bake gate is selected by the colour, motion, sound and image sources and its own tooling, and the text gate is not', () => {
  for (const f of ['packages/transitions/tween/tween.core.js', 'packages/sound/bake/bake.core.js', 'packages/image/layout.core.js', 'tools/bake-gate.mjs', 'tools/lib/bake-gate.core.js']) {
    assert.deepEqual(sel([f]), [BAKE], f);
  }
  const [s] = selectNodeChecks({ changed: ['packages/sound/bake/bake.core.js'] });
  assert.match(s.reasons[0], /packages\/sound\/bake\/bake\.core\.js is an input of tools\/bake-gate\.mjs/);
});
