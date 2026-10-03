import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { componentBlock, sceneBlock, withBlock } from './skill-inventory.mjs';

const SCRIPT = fileURLToPath(new URL('./skill-inventory.mjs', import.meta.url));

const index = {
  items: [
    { name: 'badge', type: 'component', description: 'A word or two of status.' },
    { name: 'scene-kolam', type: 'scene', description: 'A threshold drawing.', useFor: ['loader', 'hero'] },
    { name: 'scene-vel', type: 'scene', description: 'A bougainvillea vine.' },
    { name: 'tokens', type: 'package', description: 'Colour and type.' },
  ],
};

test('componentBlock lists only components, sorted, one line each', () => {
  const block = componentBlock(index);
  assert.equal(block, '- **badge** -- A word or two of status.\n');
});

test('sceneBlock lists only scenes, sorted, with the scene- prefix dropped and useFor tags shown', () => {
  const block = sceneBlock(index);
  assert.equal(block,
    '- **kolam** {loader, hero} -- A threshold drawing.\n' +
    '- **vel** -- A bougainvillea vine.\n');
});

test('withBlock replaces only the text between the markers, keeping them', () => {
  const text = 'before\n<!-- inventory:scene:start -->\nold stuff\n<!-- inventory:scene:end -->\nafter\n';
  const next = withBlock(text, 'scene', '- new line\n');
  assert.equal(next, 'before\n<!-- inventory:scene:start -->\n- new line\n<!-- inventory:scene:end -->\nafter\n');
});

test('withBlock fails loudly when a marker is missing', () => {
  assert.throws(() => withBlock('no markers here', 'scene', 'x'), /missing.*inventory:scene:start/);
});

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'susegad-skill-inv-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, 'registry'), { recursive: true });
  mkdirSync(join(root, 'references'), { recursive: true });
  writeFileSync(join(root, 'registry', 'registry.json'), JSON.stringify(index));
  writeFileSync(join(root, 'references', 'components.md'), '# Components\n\n<!-- inventory:component:start -->\n<!-- inventory:component:end -->\n');
  writeFileSync(join(root, 'references', 'scenes.md'), '# Scenes\n\n<!-- inventory:scene:start -->\n<!-- inventory:scene:end -->\n');
  return root;
}

// This is the check that must fail first: the reshape's own bug (a hand-written,
// three-scene list going stale as 23 more scenes shipped) is exactly a marker
// block never regenerated after the registry moved on.
test('--check fails on a stale block, and passes once regenerated', t => {
  const root = fixture(t);
  // The fixture starts with blank markers, so it is already stale against the
  // real registry -- exactly the shape of the bug this script exists to catch.
  const before = require_result(() => execFileSync(process.execPath, [SCRIPT, '--check', `--root=${root}`], { encoding: 'utf8' }));
  assert.equal(before.status, 1);
  assert.match(before.stderr, /components\.md is out of date/);
  assert.match(before.stderr, /scenes\.md is out of date/);

  execFileSync(process.execPath, [SCRIPT, `--root=${root}`]);
  const clean = execFileSync(process.execPath, [SCRIPT, '--check', `--root=${root}`], { encoding: 'utf8' });
  assert.match(clean, /is up to date/);
  assert.match(readFileSync(join(root, 'references', 'scenes.md'), 'utf8'), /\*\*kolam\*\* \{loader, hero\}/);

  // A scene shipped after that first regeneration is caught too.
  writeFileSync(join(root, 'registry', 'registry.json'), JSON.stringify({ items: [...index.items, { name: 'scene-new', type: 'scene', description: 'Just shipped.' }] }));
  const r1 = require_result(() => execFileSync(process.execPath, [SCRIPT, '--check', `--root=${root}`], { encoding: 'utf8' }));
  assert.equal(r1.status, 1);
  assert.match(r1.stderr, /scenes\.md is out of date/);

  execFileSync(process.execPath, [SCRIPT, `--root=${root}`]);
  assert.match(readFileSync(join(root, 'references', 'scenes.md'), 'utf8'), /\*\*new\*\*/);
});

/** execFileSync throws on a non-zero exit; capture status/stderr instead of letting the test fail on the throw itself. */
function require_result(fn) {
  try { fn(); return { status: 0 }; }
  catch (err) { return { status: err.status, stdout: err.stdout?.toString(), stderr: err.stderr?.toString() }; }
}
