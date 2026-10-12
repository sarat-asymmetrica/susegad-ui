// Tests for the gate-tier classifier (docs/requests/2026-10-02-lighter-gate.md, section A).
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify } from './gate-tier.core.js';

const R = {
  items: [
    { name: 'core', type: 'package', dependencies: [], files: [{ path: 'packages/core/core.js' }] },
    { name: 'tokens', type: 'package', dependencies: [], files: [{ path: 'packages/tokens/tokens.css' }, { path: 'packages/tokens/tokens.js' }] },
    { name: 'engine', type: 'package', dependencies: [], files: [{ path: 'packages/engine/index.js' }, { path: 'packages/engine/rng.js' }] },
    { name: 'button', type: 'component', dependencies: ['core', 'tokens', 'chip'],
      files: [{ path: 'packages/components/button/button.js' }, { path: 'packages/components/button/button.css' }, { path: 'packages/components/button/demo.html' }, { path: 'packages/components/button/button.docs.md' }] },
    { name: 'chip', type: 'component', dependencies: ['core'],
      files: [{ path: 'packages/components/chip/chip.js' }, { path: 'packages/components/chip/chip.css' }] },
    { name: 'dialog', type: 'component', dependencies: ['core'],
      files: [{ path: 'packages/components/dialog/dialog.js' }, { path: 'packages/components/dialog/dialog.css' }, { path: 'packages/components/dialog/skins/warm.js' }] },
    { name: 'scene-kolam', type: 'scene', dependencies: ['core', 'engine'], motif: { origin: 'tamil nadu', tier: 'regional', gloss: 'gloss' },
      files: [{ path: 'packages/scenes/kolam/render.js' }, { path: 'packages/scenes/kolam/model.js' }] },
    { name: 'scene-paus', type: 'scene', dependencies: ['core', 'engine'],
      files: [{ path: 'packages/scenes/paus/render.js' }, { path: 'packages/scenes/paus/model.js' }] },
  ],
};

const t = paths => classify(paths, R);

test('light: tools, docs, prompts, tests only', () => {
  const r = t(['tools/new-thing.mjs', 'docs/CHARTER.md', 'packages/components/button/button.prompt.md', 'packages/engine/rng.test.js']);
  assert.equal(r.tier, 'light');
  assert.ok(r.reasons.every(s => s.startsWith('light: ')), r.reasons.join('; '));
});

test('light: engine files count as light only when a test ships beside them', () => {
  assert.equal(t(['packages/engine/rng.js', 'packages/engine/rng.test.js']).tier, 'light');
  assert.equal(t(['packages/engine/rng.js']).tier, 'standard');
});

test('standard: a rendering file of an existing piece', () => {
  const r = t(['packages/scenes/paus/render.js']);
  assert.equal(r.tier, 'standard');
  assert.ok(r.reasons.some(s => s.includes('rendering file of scene-paus')));
});

test('standard: skins and css and demo pages of a component', () => {
  assert.equal(t(['packages/components/button/button.css']).tier, 'standard');
  assert.equal(t(['packages/components/button/demo.html']).tier, 'standard');
  assert.equal(t(['packages/components/dialog/skins/warm.js']).tier, 'full'); // dialog is a focus-managing overlay first
});

test('standard: a new piece in an existing family (when the diff says the files are new)', () => {
  const r = classify(['packages/components/badge/skins/quiet.js'], R, { newPaths: ['packages/components/badge/skins/quiet.js'] });
  // badge has no index entry: unknown piece. A known new piece:
  const r2 = classify(['packages/scenes/paus/model.js'], R, { newPaths: ['packages/scenes/paus/model.js'] });
  assert.equal(r.tier, 'standard');
  assert.equal(r2.tier, 'standard');
});

test('full: shared primitives, by folder and by being imported', () => {
  assert.equal(t(['packages/tokens/tokens.js']).tier, 'full');
  assert.equal(t(['packages/core/core.js']).tier, 'full');
  // chip is imported by button, so its behaviour file is a shared primitive even outside the core folders
  const r = t(['packages/components/chip/chip.js']);
  assert.equal(r.tier, 'full');
  assert.ok(r.reasons.some(s => s.includes('other pieces import')), r.reasons.join('; '));
  // button is imported by no one: standard
  assert.equal(t(['packages/components/button/button.js']).tier, 'standard');
});

test('full: a decision file', () => {
  const r = t(['docs/decisions/0011-new-decision.md']);
  assert.equal(r.tier, 'full');
});

test('full: focus-managing overlays and forms, only when a rendering file changes', () => {
  assert.equal(t(['packages/components/dialog/dialog.js']).tier, 'full');
  // a docs-only change to the same piece stays light
  const r = classify(['packages/components/dialog/dialog.docs.md'], R);
  assert.equal(r.tier, 'light');
});

test('full: a regional motif only in a new piece', () => {
  const added = { newPaths: ['packages/scenes/kolam/registry.json'] };
  assert.equal(classify(['packages/scenes/kolam/render.js', 'packages/scenes/kolam/registry.json'], R, added).tier, 'full');
  assert.equal(classify(['packages/scenes/kolam/model.js'], R, added).tier, 'standard'); // not a rendering file
  // an established regional piece: a render change is Standard
  const r = t(['packages/scenes/kolam/render.js']);
  assert.equal(r.tier, 'standard');
  assert.ok(!r.reasons.some(x => x.includes('motif')), r.reasons.join('; '));
});

test('full: a sacred motif, new or not', () => {
  const S = { items: R.items.map(i => i.name === 'scene-kolam' ? { ...i, motif: { ...i.motif, tier: 'sacred' } } : i) };
  assert.equal(classify(['packages/scenes/kolam/render.js'], S).tier, 'full');
});

test('full: the home page / front door', () => {
  assert.equal(t(['apps/docs/index.html']).tier, 'full');
});

test('full: gate: full declared on the changed file itself', () => {
  const r = classify(['docs/requests/some-request.md'], R, { gateFullPaths: ['docs/requests/some-request.md'] });
  assert.equal(r.tier, 'full');
});

test('the tier only climbs, and every firing rule is reported', () => {
  const r = t(['packages/tokens/tokens.js', 'tools/x.mjs', 'packages/scenes/paus/render.js']);
  assert.equal(r.tier, 'full');
  assert.equal(r.reasons.length, 3);
});

test('an unknown path defaults to standard', () => {
  const r = t(['apps/docs/llms.core.js']);
  assert.equal(r.tier, 'standard');
  assert.ok(r.reasons.some(s => s.includes('default is Standard')));
});
