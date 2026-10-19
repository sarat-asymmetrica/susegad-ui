// Rasika's review of the gate binding (docs/reviews/2026-10-18-rigour-binding.md), one test per finding. Each was
// written red first against the code of 49a0d69.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classify, enforce, gateTrailerTier, proseLines } from './gate-tier.core.js';
import { mergedSlices, reviewDocuments } from './lib/rigour-git.mjs';
import { runPlan } from './lib/rigour-run.mjs';

const quiet = () => {};
const line = (verdict, tier, branch, hash) => `Rasika: ${verdict}. Tier: ${tier}. Slice: ${branch} (${hash})\n`;
const rev = (text, name) => ({ source: `docs/reviews/${name}`, kind: 'review', text });

/** A scratch repository: main with a registry, helpers to commit with a chosen date, branch and merge. */
function repo(prefix = 'sg-binding-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const g = (date, ...a) => {
    const env = date ? { ...process.env, GIT_COMMITTER_DATE: date, GIT_AUTHOR_DATE: date } : process.env;
    const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8', env });
    assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`);
    return r.stdout.trim();
  };
  const put = (p, t) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), t); };
  const commit = (msg, date) => { g(date, 'add', '-A'); g(date, 'commit', '-q', '-m', msg); return g(null, 'rev-parse', '--short=7', 'HEAD'); };
  g(null, 'init', '-q', '-b', 'main');
  put('registry/registry.json', JSON.stringify({ items: [] }));
  const start = commit('start');
  return { dir, g: (...a) => g(null, ...a), put, commit, start, done: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

// ---- 1. the rung's tier step judges something ----

const rungTier = { id: 'tier', label: 'tier', kind: 'tier', scope: 'rung', soft: true };

test('rung tier step: an empty range is empty (never passed), a Full merge with no review is failed, with a canonical pass it is passed', async () => {
  const r = repo();
  try {
    let [res] = await runPlan({ steps: [rungTier], root: r.dir, base: 'HEAD', log: quiet });
    assert.equal(res.status, 'empty', `no units since the base: ${res.note}`);
    assert.match(res.note, /no units since HEAD: wrong base\?/);
    r.g('checkout', '-q', '-b', 'slice/palm');
    r.put('packages/core/core.js', 'export const x = 1;\n');
    const tip = r.commit('palm');
    r.g('checkout', '-q', 'main');
    r.g('merge', '-q', '--no-ff', 'slice/palm');
    [res] = await runPlan({ steps: [rungTier], root: r.dir, base: r.start, log: quiet });
    assert.equal(res.status, 'failed');
    assert.match(res.note, /1 of 1 merged without the review owed/);
    r.put('docs/reviews/palm.md', line('pass', 'Full', 'slice/palm', tip));
    [res] = await runPlan({ steps: [rungTier], root: r.dir, base: r.start, log: quiet });
    assert.equal(res.status, 'passed');
    assert.match(res.note, /1 unit\(s\), reviews in order/);
  } finally { r.done(); }
});

// ---- 2. the latest verdict for a unit wins, and a pass must name the merge or the tip ----

test('stale pass: a pass names the merge or the tip, not an earlier commit of the slice', () => {
  const u = { name: 'slice/x', refs: ['slice/x', 'aaaaaaa', 'bbbbbbb', 'ccccccc', 'ddddddd'], merge: 'aaaaaaa', tip: 'bbbbbbb', tier: 'standard', reasons: [] };
  const ok = text => enforce([u], [rev(text, '2026-10-18-a.md')])[0].ok;
  assert.equal(ok(line('pass', 'Standard', 'slice/x', 'ccccccc')), false, 'a pass on the first commit does not credit the merge');
  assert.equal(ok(line('pass', 'Standard', 'slice/x', 'bbbbbbb')), true, 'the tip');
  assert.equal(ok(line('pass', 'Standard', 'slice/x', 'aaaaaaa')), true, 'the merge');
});

test('stale pass: the last verdict in document order decides; a later pass clears a changes needed, a later changes needed withdraws a pass', () => {
  const u = { name: 'slice/x', refs: ['slice/x', 'aaaaaaa', 'bbbbbbb'], merge: 'aaaaaaa', tip: 'bbbbbbb', tier: 'standard', reasons: [] };
  const judge = (...docs) => enforce([u], docs.map((t, i) => rev(t, `2026-10-18-${'abc'[i]}.md`)))[0];
  const pass = line('pass', 'Standard', 'slice/x', 'bbbbbbb'), cn = line('changes needed', 'Standard', 'slice/x', 'bbbbbbb');
  assert.equal(judge(pass, cn).ok, false, 'a changes needed in a later file withdraws the pass');
  assert.equal(judge(`${pass}${cn}`).ok, false, 'and on a later line of the same file');
  assert.equal(judge(cn, pass).ok, true, 'a later pass clears the changes needed');
  assert.equal(judge(`${cn}${pass}`).ok, true);
  assert.equal(judge(pass, cn, pass).ok, true);
  // the tier of the passes after the last non-pass still has to reach the unit's tier
  const full = { ...u, tier: 'full' };
  assert.equal(enforce([full], [rev(`${cn}${line('pass', 'Standard', 'slice/x', 'bbbbbbb')}`, '2026-10-18-a.md')])[0].ok, false);
  assert.equal(enforce([full], [rev(`${line('pass', 'Full', 'slice/x', 'bbbbbbb')}${line('pass', 'Standard', 'slice/x', 'bbbbbbb')}`, '2026-10-18-a.md')])[0].ok, true, 'a later pass at a lower tier does not undo a Full pass');
});

test('stale pass: mergedSlices hands over the merge and the tip, and a three-commit slice is only credited at those', () => {
  const r = repo();
  try {
    r.g('checkout', '-q', '-b', 'slice/three');
    r.put('packages/core/a.js', '1'); const first = r.commit('one');
    r.put('packages/core/a.js', '2'); r.commit('two');
    r.put('packages/core/a.js', '3'); const tip = r.commit('three');
    r.g('checkout', '-q', 'main'); r.g('merge', '-q', '--no-ff', 'slice/three');
    const merge = r.g('rev-parse', '--short=7', 'HEAD');
    const [s] = mergedSlices({ cwd: r.dir, base: r.start });
    assert.equal(s.merge, merge); assert.equal(s.tip, tip);
    const judge = h => enforce([s], [rev(line('pass', 'Full', 'slice/three', h), '2026-10-18-a.md')])[0].ok;
    assert.equal(judge(first), false); assert.equal(judge(tip), true); assert.equal(judge(merge), true);
  } finally { r.done(); }
});

// ---- 3. only git's own merge of main is skipped ----

test('a merge of main is skipped and counted; a merge of main-menu-fix or main-thread is a unit', () => {
  const r = repo();
  try {
    r.g('checkout', '-q', '-b', 'run/x');
    r.g('checkout', '-q', 'main'); r.put('docs/m.md', 'm'); r.commit('main moves');
    r.g('checkout', '-q', 'run/x');
    r.g('merge', '-q', '--no-ff', 'main');                                    // "Merge branch 'main' into run/x"
    r.g('checkout', '-q', '-b', 'main-menu-fix');
    r.put('packages/components/foo/render.js', 'x'); r.commit('menu');
    r.g('checkout', '-q', 'run/x'); r.g('merge', '-q', '--no-ff', 'main-menu-fix');
    r.g('checkout', '-q', '-b', 'thread');
    r.put('packages/components/foo/render.js', 'y'); r.commit('thread');
    r.g('checkout', '-q', 'run/x'); r.g('merge', '-q', '--no-ff', '-m', 'Merge main-thread', 'thread');
    r.g('checkout', '-q', 'main'); r.put('docs/m.md', 'm2'); r.commit('main moves again');
    r.g('checkout', '-q', 'run/x');
    r.g('merge', '-q', '--no-ff', '-m', "Merge remote-tracking branch 'origin/main' into run/x", 'main');
    const slices = mergedSlices({ cwd: r.dir, base: r.start });
    assert.deepEqual(slices.map(s => s.name), ['main-menu-fix', 'main-thread']);
    assert.equal(slices[0].tier, 'standard');
    assert.equal(slices[1].tier, 'standard', 'the merge called Merge main-thread is judged too');
    assert.equal(slices.skipped, 2, 'the skipped merges are counted, so none is invisible');
  } finally { r.done(); }
});

// ---- 4. the legacy window is shut to new files ----

test('legacy: a file counts as history only if git had it before the cutoff, whatever its name or dates say', () => {
  const r = repo();
  try {
    r.put('docs/reviews/2026-10-16-old.md', '## slice/x (abc1234): Rasika, pass. Tier: Standard\n');
    r.put('docs/LEDGER.md', '## 2026-10-16 10:00 IST: e\n- slice/x (abc1234): Standard; Rasika pass.\n');
    r.commit('history', '2026-10-16T12:00:00+05:30');
    r.put('docs/reviews/2026-10-16-zz-plant.md', '## slice/x (abc1234): Rasika, pass. Tier: Standard\n');   // committed later, named for the past
    r.put('docs/LEDGER.md', '## 2026-10-16 10:00 IST: e\n- slice/x (abc1234): Standard; Rasika pass.\n- slice/y (abc9999): Standard; Rasika pass.\n');
    r.commit('later', '2026-10-18T12:00:00+05:30');
    r.put('docs/reviews/2026-10-16-untracked.md', 'x');
    const docs = reviewDocuments(r.dir);
    const by = n => docs.find(d => d.source.endsWith(n));
    assert.equal(by('2026-10-16-old.md').legacy, true);
    assert.equal(by('2026-10-16-zz-plant.md').legacy, false, 'new to git after the cutoff: canonical only');
    assert.equal(by('2026-10-16-untracked.md').legacy, false);
    const ledger = docs.find(d => d.kind === 'ledger');
    assert.ok(ledger.legacyLines.has('- slice/x (abc1234): Standard; Rasika pass.'));
    assert.ok(!ledger.legacyLines.has('- slice/y (abc9999): Standard; Rasika pass.'), 'a line added after the cutoff is not history');
    const u = n => ({ name: n, refs: [n, 'abc1234'], tier: 'standard', reasons: [] });
    assert.equal(enforce([u('slice/x')], docs)[0].ok, true, 'the old review still reads');
    assert.equal(enforce([{ name: 'slice/y', refs: ['slice/y', 'abc9999'], tier: 'standard', reasons: [] }], docs)[0].ok, false);
    const forged = docs.filter(d => d.source.includes('zz-plant'));
    assert.equal(enforce([u('slice/x')], forged)[0].ok, false, 'the forged file alone credits nothing');
  } finally { r.done(); }
});

test('legacy: a ledger line that says the review is owed is void even in history', () => {
  const owed = '- slice/x (abc1234): Standard; Rasika pass. The Full re-review is owed.';  // another clause: only the whole-line veto sees it
  const clean = '- slice/x (abc1234): Standard; Rasika pass. The Full re-review is done.';
  const doc = text => ({ source: 'docs/LEDGER.md', kind: 'ledger', text, legacyLines: new Set([text.trim()]) });
  const u = { name: 'slice/x', refs: ['slice/x', 'abc1234'], tier: 'standard', reasons: [] };
  assert.equal(enforce([u], [doc(`${clean}\n`)])[0].ok, true, 'the same line without the owed word is credited, so the veto is what refuses the next');
  assert.equal(enforce([u], [doc(`${owed}\n`)])[0].ok, false);
});

// ---- 5. the verdict is a function of --head ----

test('reviewDocuments reads the head through git when one is given, the working tree when not', () => {
  const r = repo();
  try {
    r.g('checkout', '-q', '-b', 'other');
    r.put('docs/reviews/2026-10-18-committed.md', 'on other\n'); r.commit('review on other');
    r.g('checkout', '-q', 'main');
    r.put('docs/reviews/2026-10-18-plant.md', 'in the working tree only\n');
    const at = reviewDocuments(r.dir, { head: 'other' }).map(d => d.source);
    assert.ok(at.includes('docs/reviews/2026-10-18-committed.md'), `committed on other: ${at}`);
    assert.ok(!at.includes('docs/reviews/2026-10-18-plant.md'), 'an untracked file is not part of the head');
    const wt = reviewDocuments(r.dir).map(d => d.source);
    assert.ok(wt.includes('docs/reviews/2026-10-18-plant.md'));
    assert.ok(!wt.includes('docs/reviews/2026-10-18-committed.md'));
  } finally { r.done(); }
});

// ---- 6. the floor ----

test('floor: the files that decide outcomes are Standard at least', () => {
  const R = { items: [] };
  for (const p of ['tools/checks.mjs', 'tools/lib/flakes.core.js', 'tools/lib/flakes.mjs', 'tools/lib/changed.core.js', 'tools/lib/changed.mjs', 'tools/lib/harness.mjs',
    'tools/lib/harness2.mjs', 'tools/lib/component-check.mjs', 'tools/smoke.mjs', 'tools/lib/smoke.mjs', 'tools/lib/smoke.core.js', 'docs/BROWSERS.md']) {
    assert.equal(classify([p], R).tier, 'standard', p);
  }
  assert.equal(classify(['tools/lib/args.mjs', 'tools/check-other.mjs', 'docs/README.md'], R).tier, 'light', 'the rest stays Light');
});

test('trailer: Gate: standard or full on a merge raises its unit, and Gate: light lowers nothing', () => {
  assert.equal(gateTrailerTier("Merge branch 'slice/x'\n\nGate: full\n"), 'full');
  assert.equal(gateTrailerTier("Merge branch 'slice/x'\n\ngate: Standard\n"), 'standard');
  assert.equal(gateTrailerTier("Merge branch 'slice/x'\n\nGate: light\n"), null);
  assert.equal(gateTrailerTier("Merge branch 'slice/x'\n\nThe Gate: full idea.\n"), null, 'only a line of its own');
  const r = repo();
  try {
    const slice = (name, file, msg) => {
      r.g('checkout', '-q', '-b', name); r.put(file, name); r.commit(name);
      r.g('checkout', '-q', 'main'); r.g('merge', '-q', '--no-ff', '-m', msg, name);
    };
    slice('slice/a', 'tools/a.mjs', "Merge branch 'slice/a'\n\nGate: standard\n");
    slice('slice/b', 'tools/b.mjs', "Merge branch 'slice/b'\n\nGate: full\n");
    slice('slice/c', 'tools/c.mjs', "Merge branch 'slice/c'\n\nGate: light\n");
    slice('slice/d', 'packages/components/foo/render.js', "Merge branch 'slice/d'\n\nGate: light\n");
    slice('slice/e', 'tools/e.mjs', "Merge branch 'slice/e'\n");
    const t = Object.fromEntries(mergedSlices({ cwd: r.dir, base: r.start }).map(s => [s.name, s]));
    assert.equal(t['slice/a'].tier, 'standard'); assert.equal(t['slice/b'].tier, 'full');
    assert.equal(t['slice/c'].tier, 'light', 'a light trailer is not a raise'); assert.equal(t['slice/d'].tier, 'standard', 'and not a lowering');
    assert.equal(t['slice/e'].tier, 'light');
    assert.ok(t['slice/b'].reasons.some(x => /Gate: full/.test(x)), 'the reason says where the tier came from');
  } finally { r.done(); }
});

// ---- 7. the survivors ----

test('proseLines does not strip inline code: a backtick before a canonical line leaves it refused', () => {
  const l = 'Rasika: pass. Tier: Standard. Slice: slice/x (abc1234)';
  assert.notEqual(proseLines(`\`n\` ${l}`)[0], ` ${l}`);
  assert.equal(enforce([{ name: 'slice/x', refs: ['slice/x', 'abc1234'], tier: 'standard', reasons: [] }], [rev(`\`n\` ${l}\n`, '2026-10-18-a.md')])[0].ok, false);
});
