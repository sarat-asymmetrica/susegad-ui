// Tests for the gate-tier classifier (docs/requests/2026-10-02-lighter-gate.md, section A).
import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, laneOf, declaredTier, namesSlice, findReviews, enforce } from './gate-tier.core.js';
import { SHARED } from './lib/changed.core.js';

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

// ---- Recalibration (rigour 2c). Each of these was red against the rules before it. ----

test('generated files are neutral: they never raise a tier', () => {
  for (const p of ['registry/registry.json', 'references/components.md', 'references/scenes.md', 'custom-elements.json', 'docs/reference/accessibility.md']) {
    const r = t([p]);
    assert.equal(r.tier, 'light', `${p}: ${r.reasons.join('; ')}`);
    assert.ok(r.reasons.every(s => s.startsWith('neutral: ')), r.reasons.join('; '));
  }
  // they ride along with a real change without moving it: Light stays Light, Standard stays Standard
  assert.equal(t(['tools/x.mjs', 'registry/registry.json', 'references/components.md']).tier, 'light');
  assert.equal(t(['packages/scenes/paus/render.js', 'registry/registry.json']).tier, 'standard');
  // a piece's own hand-written registry.json is not the generated index
  assert.notEqual(classify(['packages/components/chip/registry.json'], R).tier, 'light');
});

test('prose inside a shared prefix is Light: a README in core is not a change to core', () => {
  for (const p of ['packages/core/README.md', 'packages/tokens/docs.md', 'packages/type/README.md', 'packages/components/chip/README.md']) {
    assert.equal(t([p]).tier, 'light', p);
  }
  // code beside it still decides
  assert.equal(t(['packages/core/README.md', 'packages/core/core.js']).tier, 'full');
  // a decision record is prose and stays Full; so does a declared gate: full
  assert.equal(t(['docs/decisions/0030-x.md']).tier, 'full');
  assert.equal(classify(['packages/core/README.md'], R, { gateFullPaths: ['packages/core/README.md'] }).tier, 'full');
});

test('the engine is shared: Standard at least, Light only for its tests and prose', () => {
  assert.equal(t(['packages/engine/rng.js']).tier, 'standard');
  // a test beside it no longer makes the change Light (it used to)
  assert.equal(t(['packages/engine/rng.js', 'packages/engine/rng.test.js']).tier, 'standard');
  assert.equal(t(['packages/engine/rng.test.js']).tier, 'light');
  assert.equal(t(['packages/engine/README.md']).tier, 'light');
  // not Full: every scene imports the engine, but it is not core, tokens or type
  const r = t(['packages/engine/wind.js']);
  assert.ok(r.reasons.some(s => s.includes('engine, which every scene shares')), r.reasons.join('; '));
});

test('gate-tier and --changed agree about every shared package', () => {
  const sharedPackages = SHARED.filter(s => s.startsWith('packages/') && s.endsWith('/'));
  assert.ok(sharedPackages.includes('packages/engine/'), 'changed.core no longer lists the engine: update this test');
  for (const dir of sharedPackages) {
    const r = t([`${dir}new-module.js`]);
    assert.notEqual(r.tier, 'light', `${dir} is shared for --changed but ${r.tier} here: ${r.reasons.join('; ')}`);
  }
});

test('a new package imported only by new pieces in the same diff is Standard; once others import it, Full', () => {
  const W = { items: [
    ...R.items,
    { name: 'palm', type: 'package', dependencies: ['engine'], files: [{ path: 'packages/palm/palm.js' }, { path: 'packages/palm/registry.json' }] },
    { name: 'scene-maad', type: 'scene', dependencies: ['core', 'engine', 'palm'], files: [{ path: 'packages/scenes/maad/model.js' }, { path: 'packages/scenes/maad/registry.json' }] },
  ] };
  const born = ['packages/palm/palm.js', 'packages/palm/registry.json', 'packages/scenes/maad/model.js', 'packages/scenes/maad/registry.json'];
  const r = classify(born, W, { newPaths: born });
  assert.equal(r.tier, 'standard', r.reasons.join('; '));
  assert.ok(r.reasons.some(s => s.includes('new package imported only by new pieces')), r.reasons.join('; '));
  // palm alone, maad already merged earlier: maad is not new in this diff
  const alone = classify(['packages/palm/palm.js', 'packages/palm/registry.json'], W, { newPaths: ['packages/palm/registry.json'] });
  assert.equal(alone.tier, 'full', alone.reasons.join('; '));
  // an established package edited in place that new pieces import: Full
  assert.equal(classify(['packages/palm/palm.js', 'packages/scenes/maad/registry.json'], W, { newPaths: ['packages/scenes/maad/registry.json'] }).tier, 'full');
  // new package, new importer, but an older piece imports it too: Full
  const W2 = { items: [...W.items, { name: 'old', type: 'component', dependencies: ['palm'], files: [{ path: 'packages/components/old/old.js' }] }] };
  assert.equal(classify(born, W2, { newPaths: born }).tier, 'full');
});

test('only the two generated references are neutral; the hand-written ones are what the shipped skill says', () => {
  for (const p of ['references/tokens.md', 'references/recipes.md', 'references/style-and-gates.md', 'references/av.md', 'references/building.md', 'references/folio.md', 'references/install-shadcn.md']) {
    const r = t([p]);
    assert.ok(!r.reasons.some(x => x.startsWith('neutral')), `${p}: ${r.reasons.join('; ')}`);
    assert.equal(r.tier, 'standard', p);
  }
});

test('markdown under packages/ is Light only when it is documentation; content takes the tier of its item', () => {
  for (const p of ['packages/recipes/storybook-spread/story/spread.md', 'packages/recipes/proposal/examples/sample/proposal.md', 'packages/folio/samples/proposal-sketch.md', 'packages/templates/event/KONKANI-FOR-READER.md']) {
    assert.notEqual(t([p]).tier, 'light', `${p} is words a reader sees`);
  }
  for (const p of ['packages/core/README.md', 'packages/components/chip/chip.docs.md', 'packages/components/chip/chip.prompt.md', 'packages/scenes/paus/PROVENANCE.md']) {
    assert.equal(t([p]).tier, 'light', p);
  }
});

// ---- Binding the tier: --enforce ----

test('declaredTier reads the shapes a ledger line or a review file uses', () => {
  assert.equal(declaredTier('Tier: Full'), 'full');
  assert.equal(declaredTier('slice/x: Full; Rasika pass with notes'), 'full');
  assert.equal(declaredTier('Rasika Standard, pass'), 'standard');
  assert.equal(declaredTier('a Standard review of it'), 'standard');
  assert.equal(declaredTier('Rasika pass at Full'), 'full');
  assert.equal(declaredTier('Rasika pass with notes'), null);
  assert.equal(declaredTier('the full suite passed'), null);
});

test('namesSlice: a branch as a whole token, a hash by prefix of 7 or more', () => {
  assert.ok(namesSlice('merged slice/palm today', ['slice/palm']));
  assert.ok(!namesSlice('merged slice/palm-two today', ['slice/palm']));
  assert.ok(!namesSlice('merged old/slice/palm today', ['slice/palm']));
  assert.ok(namesSlice('at `a9f380b`', ['a9f380b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7']));
  assert.ok(!namesSlice('at a9f38', ['a9f380b']));
  assert.ok(!namesSlice('at a9f380c', ['a9f380b']));
});

const SL = tier => [{ name: 'slice/palm', refs: ['slice/palm', 'abc1234', 'def5678'], tier, reasons: [] }];
// These tests exercise the legacy readings (ledger lines and review files that git held before the cutoff, which
// reviewDocuments marks: legacyLines, legacy); tools/gate-tier.canon.test.mjs holds the canonical line and the cutoff,
// tools/gate-tier.binding.test.mjs the git half.
const ledger = text => {
  const full = `## 2026-10-12 10:00 IST: an old entry\n${text}`;
  return [{ source: 'docs/LEDGER.md', kind: 'ledger', text: full, legacyLines: new Set(full.split('\n').map(l => l.trim())) }];
};

test('enforce: a Full slice with no review is red, with a Full review green (red first)', () => {
  assert.equal(enforce(SL('full'), ledger('- slice/palm merged. Tests green.'))[0].ok, false);
  const ok = enforce(SL('full'), ledger('- **2a** `abc1234` (slice/palm): Full; Rasika pass with notes.'));
  assert.equal(ok[0].ok, true);
  assert.deepEqual(ok[0].reviews.map(r => r.tier), ['full']);
  assert.equal(ok[0].reviews[0].source, 'docs/LEDGER.md:2');
});

test('enforce: the review must be at the tier, by Rasika, with a verdict, and about this slice', () => {
  const j = (tier, text) => enforce(SL(tier), ledger(text))[0].ok;
  assert.equal(j('full', '- slice/palm: Standard; Rasika pass'), false, 'Standard does not satisfy Full');
  assert.equal(j('standard', '- slice/palm: Full; Rasika pass'), true, 'Full satisfies Standard');
  assert.equal(j('full', '- slice/palm: Full; Kathakar pass'), false, 'not Rasika');
  assert.equal(j('full', '- slice/palm: Full; Rasika asked for nothing yet'), false, 'no verdict');
  assert.equal(j('full', '- slice/bunting: Full; Rasika pass'), false, 'another slice');
  assert.equal(j('full', '- slice/bunting: Full; Rasika pass\n- slice/palm merged'), false, 'a unit is one line');
  assert.equal(j('light', ''), true, 'Light owes nothing');
});

test('enforce: a docs/reviews file is a unit of its own', () => {
  const docs = [{ source: 'docs/reviews/2026-10-12-palm.md', kind: 'review', legacy: true, text: '# Palm\nBranch slice/palm at def5678.\nTier: Full\nRasika verdict: pass with notes.\n' }];
  const r = enforce(SL('full'), docs)[0];
  assert.equal(r.ok, true);
  assert.equal(r.reviews[0].source, 'docs/reviews/2026-10-12-palm.md');
  assert.equal(enforce(SL('full'), [{ ...docs[0], text: docs[0].text.replace('def5678', 'zzz').replace('slice/palm', 'slice/other') }])[0].ok, false);
  assert.equal(findReviews(docs, ['nothing']).length, 0);
});

// ---- The verdict must be a verdict about a review that was done (Rasika on r-rigour-runner, blocker 1). ----

test('enforce: a line that says the review is still owed is not a review (the planted line from the audit)', () => {
  const j = text => enforce(SL('standard'), ledger(text))[0].ok;
  for (const line of [
    '- slice/palm (abc1234): Rasika review still owed, nothing passed yet; Standard review to be booked.',
    '- slice/palm: Standard; Rasika has not passed it.',
    '- slice/palm: Standard; no Rasika pass yet.',
    '- slice/palm: Standard; Rasika pass pending.',
    '- slice/palm: Standard; Rasika pass to be booked.',
    '- slice/palm: Standard; Rasika pass not run.',
    '- slice/palm: Standard; Rasika will pass it once the strings land.',
    '- slice/palm: Standard; awaiting Rasika, pass expected.',
    '- slice/palm: Standard; Rasika pass still owed.',
    '- slice/palm: Standard; pass (the Sutradhar), Rasika owed.',
    '- slice/palm: Standard review. Rasika: nothing yet.',
  ]) assert.equal(j(line), false, line);
  // and what a done review looks like stays accepted, in the canonical form and the older ones
  for (const line of [
    '- Rasika: pass with notes. Tier: Standard. Slice: slice/palm (abc1234)',
    '- Rasika: pass. Tier: Full. Slice: slice/palm',
    '- slice/palm: Standard; Rasika pass, no notes.',
    '- **2a** `abc1234` (slice/palm): Full; Rasika pass with notes.',
    '- slice/palm: Rasika Standard, pass.',
  ]) assert.equal(j(line), true, line);
});

test('enforce: a changes-needed review is a review but not a pass', () => {
  const r = enforce(SL('standard'), ledger('- Rasika: changes needed. Tier: Standard. Slice: slice/palm'))[0];
  assert.equal(r.ok, false);
  assert.deepEqual(r.reviews.map(x => x.verdict), ['changes needed']);
  const both = enforce(SL('standard'), [
    ...ledger('- Rasika: changes needed. Tier: Standard. Slice: slice/palm'),
    { source: 'docs/reviews/2026-10-12-again.md', kind: 'review', legacy: true, text: '# Re-review\nslice/palm.\nRasika: pass. Tier: Standard.\n' }])[0];
  assert.equal(both.ok, true, 'the re-review that passes is what satisfies it');
});

test('declaredTier: the highest tier declared wins, not the first', () => {
  assert.equal(declaredTier('Tier: Standard\n...\nTier: Full'), 'full');
  assert.equal(declaredTier('Tier: Full\nTier: Standard'), 'full');
  assert.equal(declaredTier('Standard review of the page, then a Full Rasika pass'), 'full');
});

// ---- A review file is judged section by section ----

const MULTI = `# Review of two slices

## slice/palm (abc1234): Rasika, pass. Tier: Standard

Looked fine. The shipped copy is Full-looking but it is Standard.

## slice/bunting (def5678): Rasika, pass with notes. Tier: Full

### Notes

Polish.

## slice/curtain (1234567): Rasika, changes needed. Tier: Standard

## Evidence

verdicts: slice/palm pass; slice/bunting pass with notes; slice/curtain pass. Tier: Full
`;
const multiDocs = [{ source: 'docs/reviews/2026-10-12-multi.md', kind: 'review', legacy: true, text: MULTI }];
const SLN = (name, tier, refs = [name]) => [{ name, refs, tier, reasons: [] }];

test('a review file credits each slice with the tier and the verdict of its own section', () => {
  const j = (name, tier) => enforce(SLN(name, tier), multiDocs)[0];
  assert.equal(j('slice/palm', 'standard').ok, true);
  assert.equal(j('slice/palm', 'full').ok, false, 'palm was reviewed at Standard, whatever Full the file says elsewhere');
  assert.equal(j('slice/bunting', 'full').ok, true);
  assert.equal(j('slice/curtain', 'standard').ok, false, 'its section says changes needed; the evidence line does not rescue it');
  assert.equal(j('slice/curtain', 'standard').reviews.length, 1);
  assert.match(j('slice/palm', 'standard').reviews[0].source, /multi\.md:3$/);
});

const RUNGS_REVIEW = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'reviews', '2026-10-17-rigour-rungs-1-2.md');
test('the real review of rungs 1 and 2: each slice is credited with its own section', { skip: !fs.existsSync(RUNGS_REVIEW) && 'docs/reviews is private and absent from the public tree' }, () => {
  const text = fs.readFileSync(RUNGS_REVIEW, 'utf8');
  const docs = [{ source: 'docs/reviews/2026-10-17-rigour-rungs-1-2.md', kind: 'review', text, legacy: true }];
  // Git did not hold the file before the cutoff, so it is canonical-only; read as history (flagged here) it shows the section shapes
  // the legacy path still understands. Its own headings are not canonical lines: as a file of today they credit nothing (asserted last).
  const ok = (name, tier, refs) => enforce(SLN(name, tier, refs ?? [name]), docs)[0].ok;
  for (const n of ['r-smoke', 'r-changed', 'r-fixes', 'r-trust']) {
    assert.equal(ok(`slice/${n}`, 'standard'), true, `${n} passed at Standard`);
    assert.equal(ok(`slice/${n}`, 'full'), false, `${n} was not reviewed at Full`);
  }
  assert.equal(ok('slice/r-repo', 'standard'), false, 'changes needed is not a pass');
  assert.equal(ok('slice/r-rigour-runner', 'standard'), false, 'changes needed is not a pass');
  assert.equal(ok('direct commits', 'full', ['9826360', 'b23a000']), true, 'the direct commits had a Full pass');
  assert.equal(ok('slice/r-ci', 'light'), true);
  assert.equal(enforce(SLN('slice/r-smoke', 'standard'), [{ ...docs[0], legacy: false }])[0].ok, false, 'read as a file of today, its legacy headings are not canonical lines');
});

// ---- --enforce end to end, on a fixture repository with a real git history ----

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TOOL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gate-tier.mjs');

function fixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-tier-'));
  const g = (...a) => { const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const put = (p, text) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), text); };
  g('init', '-q', '-b', 'main');
  put('registry/registry.json', JSON.stringify({ items: [] }));
  put('docs/LEDGER.md', '# Ledger\n');
  g('add', '-A'); g('commit', '-q', '-m', 'start'); g('tag', 'start');
  return { dir, g, put, enforce: (...a) => spawnSync(process.execPath, [TOOL, '--enforce', '--repo', dir, '--base', 'start', ...a], { encoding: 'utf8' }) };
}

test('gate-tier --enforce: a merged Full slice with no review exits 1, with the review exits 0', () => {
  const f = fixtureRepo();
  try {
    f.g('checkout', '-q', '-b', 'run/x');
    f.g('checkout', '-q', '-b', 'slice/palm');
    f.put('packages/core/core.js', 'export const x = 1;\n');      // a shared primitive: Full
    f.g('add', '-A'); f.g('commit', '-q', '-m', 'palm');
    f.g('checkout', '-q', 'run/x');
    f.g('merge', '--no-ff', '-q', '-m', 'Merge slice/palm: a shared change', 'slice/palm');

    const red = f.enforce();
    assert.equal(red.status, 1, red.stdout + red.stderr);
    assert.match(red.stdout, /MISSING full\s+slice\/palm/);
    assert.deepEqual(JSON.parse(f.enforce('--json').stdout).slices.map(s => [s.name, s.tier, s.ok]), [['slice/palm', 'full', false]]);

    // an old-style ledger line (the legacy reading) is history only if git held it before the cutoff: written now, it is not a review
    f.put('docs/LEDGER.md', '# Ledger\n## 2026-10-12 10:00 IST: old\n- slice/palm: Full; Rasika pass with notes.\n');
    assert.equal(f.enforce().status, 1);

    // the canonical line at Standard does not satisfy a Full slice
    const tip = f.g('rev-parse', '--short=7', 'slice/palm');
    f.put('docs/LEDGER.md', `# Ledger\n\nRasika: pass. Tier: Standard. Slice: slice/palm (${tip})\n`);
    assert.equal(f.enforce().status, 1);

    // a canonical line in a review file, naming the merge commit's hash, does
    f.put('docs/LEDGER.md', '# Ledger\n');
    const merge = f.g('rev-parse', '--short=7', 'HEAD');
    f.put('docs/reviews/palm.md', `# Palm\n\nRasika: pass. Tier: Full. Slice: slice/palm (${merge})\n`);
    assert.equal(f.enforce().status, 0);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('gate-tier --enforce: a Light slice owes no review, and a merge of main is not a slice', () => {
  const f = fixtureRepo();
  try {
    f.g('checkout', '-q', '-b', 'run/x');
    f.g('checkout', '-q', '-b', 'slice/notes');
    f.put('tools/notes.mjs', 'export {};\n');
    f.g('add', '-A'); f.g('commit', '-q', '-m', 'notes');
    f.g('checkout', '-q', 'run/x');
    f.g('merge', '--no-ff', '-q', '-m', 'Merge slice/notes: a tool', 'slice/notes');
    const r = f.enforce();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /ok\s+light\s+slice\/notes/);

    // a run branch that merges main back in: that merge is skipped, not judged as a Full slice
    f.g('checkout', '-q', 'main');
    f.put('packages/core/core.js', 'export const x = 1;\n');
    f.g('add', '-A'); f.g('commit', '-q', '-m', 'main moves');
    f.g('checkout', '-q', 'run/x');
    f.g('merge', '--no-ff', '-q', '-m', "Merge branch 'main' into run/x", 'main');
    const r2 = spawnSync(process.execPath, [TOOL, '--enforce', '--repo', f.dir, '--base', 'start'], { encoding: 'utf8' });
    assert.equal(r2.status, 0, r2.stdout + r2.stderr);
    assert.doesNotMatch(r2.stdout, /MISSING/);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

// ---- Lanes: an experimental unit owes its review at promotion; shared ground binds (decision 0031) ----

const itemReg = (name, stability, extra = {}) => ({ name, stability, type: 'component', manifest: `packages/components/${name}/registry.json`, files: [{ path: `packages/components/${name}/${name}.js` }], ...extra });

test('laneOf: inside experimental items is the lane; anything else is shared ground', () => {
  const reg = { items: [itemReg('alpha', 'experimental'), itemReg('beta1', 'beta'), itemReg('engine', 'experimental', { manifest: 'packages/engine/registry.json', files: [{ path: 'packages/engine/engine.js' }] }), itemReg('hub', 'experimental'), itemReg('user', 'experimental', { dependencies: ['hub'] })] };
  const lane = ps => laneOf(ps, reg);
  assert.equal(lane(['packages/components/alpha/alpha.js', 'packages/components/alpha/demo.html', 'registry/registry.json']).lane, 'experimental');
  assert.deepEqual(lane(['packages/components/alpha/alpha.js']).items, ['alpha']);
  assert.equal(lane(['tools/a11y-baseline/packages__components__alpha__demo.html.aria.yml']).lane, 'experimental', "a demo's recorded tree is the item's");
  assert.equal(lane(['packages/components/alpha/alpha.js', 'packages/core/core.js']).lane, 'shared');
  assert.equal(lane(['packages/components/alpha/alpha.js', 'docs/LEDGER.md']).lane, 'shared', 'a path that belongs to nobody');
  assert.equal(lane(['packages/components/beta1/beta1.js']).lane, 'shared', 'above experimental');
  assert.equal(lane(['packages/engine/engine.js']).lane, 'shared', 'the engine is shared ground though registered experimental');
  assert.equal(lane(['packages/components/hub/hub.js']).lane, 'shared', 'imported by another piece');
  assert.equal(lane(['registry/registry.json']).lane, 'shared', 'generated files alone are no item');
});

function laneRepo(stability) {
  const f = fixtureRepo();
  f.g('checkout', '-q', '-b', 'run/x');
  return {
    ...f,
    merge(name, files) {
      f.g('checkout', '-q', '-b', name);
      f.put('registry/registry.json', JSON.stringify({ items: [itemReg('alpha', stability)] }));
      for (const p of files) f.put(p, `export const x = '${name}';\n`);
      f.g('add', '-A'); f.g('commit', '-q', '-m', name);
      f.g('checkout', '-q', 'run/x');
      f.g('merge', '--no-ff', '-q', '-m', `Merge ${name}: a change`, name);
    },
  };
}

test('gate-tier --enforce: a unit entirely in an experimental item is owed at promotion and exits 0', () => {
  const f = laneRepo('experimental');
  try {
    f.merge('slice/alpha', ['packages/components/alpha/alpha.js', 'packages/components/alpha/skins/quiet.js']); // rendering: Standard
    const r = f.enforce();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /PROMOTE standard\s+slice\/alpha.*owed at promotion \(alpha\)/);
    assert.match(r.stdout, /summary: 0 passed, 0 owed now \(red\), 1 owed at promotion: alpha/);
    assert.deepEqual(JSON.parse(f.enforce('--json').stdout).owedAtPromotion, ['alpha']);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});

test('gate-tier --enforce: an experimental item plus packages/core binds, and a Gate trailer does not leave the lane', () => {
  const f = laneRepo('experimental');
  try {
    f.merge('slice/mixed', ['packages/components/alpha/alpha.js', 'packages/core/core.js']);
    const red = f.enforce();
    assert.equal(red.status, 1, red.stdout + red.stderr);
    assert.match(red.stdout, /MISSING full\s+slice\/mixed/);
    assert.match(red.stdout, /summary: 0 passed, 1 owed now \(red\), 0 owed at promotion/);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
  const g = laneRepo('experimental');
  try {
    g.merge('slice/quiet', ['packages/components/alpha/alpha.js']);
    g.g('commit', '-q', '--amend', '-m', 'Merge slice/quiet: a change\n\nGate: full');
    const r = g.enforce();
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /PROMOTE full\s+slice\/quiet/, 'the trailer raised the tier and the unit stayed on the lane');
  } finally { fs.rmSync(g.dir, { recursive: true, force: true }); }
});

test('gate-tier --enforce: a unit in a beta item binds', () => {
  const f = laneRepo('beta');
  try {
    f.merge('slice/alpha', ['packages/components/alpha/alpha.js', 'packages/components/alpha/skins/quiet.js']);
    const r = f.enforce();
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /MISSING standard\s+slice\/alpha/);
  } finally { fs.rmSync(f.dir, { recursive: true, force: true }); }
});
