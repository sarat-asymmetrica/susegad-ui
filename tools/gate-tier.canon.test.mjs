// The canonical review line is the only way a review counts today (docs/reviews/2026-10-17-rigour-fix-round.md, R1 to R4,
// and the Sutradhar's decision to stop block-listing near-misses). Every leak Rasika listed is a refused case here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalReviewLine, classify, enforce, findReviews, LEGACY_BEFORE, proseLines } from './gate-tier.core.js';

const unit = (tier = 'standard', extra = {}) => ({ name: 'slice/x', refs: ['slice/x', 'abc1234', 'def5678'], tier, reasons: [], ...extra });
const doc = (text, name = '2026-10-17-r.md') => [{ source: `docs/reviews/${name}`, kind: 'review', text }];
const ledger = text => [{ source: 'docs/LEDGER.md', kind: 'ledger', text }];
const ok = (u, docs) => enforce([u], docs)[0].ok;
const LINE = 'Rasika: pass. Tier: Standard. Slice: slice/x (abc1234)';

test('the grammar: what the canonical line accepts, exactly', () => {
  const c = canonicalReviewLine;
  assert.deepEqual(c(LINE), { verdict: 'pass', tier: 'standard', branch: 'slice/x', hash: 'abc1234', commit: false });
  assert.deepEqual(c('- Rasika: pass with notes. Tier: Full. Slice: slice/x (abc1234def)'), { verdict: 'pass', tier: 'full', branch: 'slice/x', hash: 'abc1234def', commit: false });
  assert.deepEqual(c('  Rasika: changes needed. Tier: Light. Slice: run/rigour (abc1234)'), { verdict: 'changes needed', tier: 'light', branch: 'run/rigour', hash: 'abc1234', commit: false });
  assert.deepEqual(c('Rasika: blocked. Tier: Standard. Slice: commit 0479f4f'), { verdict: 'blocked', tier: 'standard', branch: null, hash: '0479f4f', commit: true });
  for (const bad of [
    'Rasika: pass. Tier: Standard',                                           // no slice
    'Rasika: pass. Tier: Standard. Slice: slice/x',                           // no hash
    'Rasika: pass. Tier: Standard. Slice: slice/x (abc12)',                   // hash too short
    'Rasika: pass. Tier: Standard. Slice: 0479f4f',                           // a bare hash is not "commit <hash>"
    'Rasika: unverified pass. Tier: Standard. Slice: slice/x (abc1234)',
    'Rasika: pass?. Tier: Standard. Slice: slice/x (abc1234)',
    'Rasika: <pass | pass with notes | changes needed | blocked>. Tier: <Light | Standard | Full>. Slice: <branch> (<hash>)',
    'Rasika: pass. Tier: Standard. Slice: slice/x (abc1234) once fixed',      // trailing prose
    'The Rasika: pass. Tier: Standard. Slice: slice/x (abc1234)',             // not at the line start
    'Rasika dropped, Sutradhar pass. Tier: Standard. Slice: slice/x (abc1234)',
    'rasika: pass. tier: standard. slice: slice/x (abc1234)',                 // the grammar is exact
    '    Rasika: pass. Tier: Standard. Slice: slice/x (abc1234)',             // an indented code block
    '| Rasika: pass. Tier: Standard. Slice: slice/x (abc1234) |',
  ]) assert.equal(c(bad), null, bad);
});

test('proseLines blanks fenced code, blockquotes, inline code and HTML comments, and keeps the line numbers', () => {
  const text = ['a', '```', LINE, '```', LINE, '~~~~', LINE, '~~~', LINE, '~~~~', '> quoted', LINE, '', LINE, '`' + LINE + '`', '<!--', LINE, '-->', LINE, '<!-- ' + LINE + ' -->'].join('\n');
  const lines = proseLines(text);
  assert.equal(lines.length, text.split('\n').length);
  assert.deepEqual(lines.map((l, i) => (l === LINE ? i + 1 : null)).filter(Boolean), [5, 14, 19], 'the real line, the one after a blank line (not a lazy blockquote continuation), the one after the comment');
});

test('R1: prose cannot create a pass (every row of Rasika\'s table, a refused case)', () => {
  const head = '## slice/x (abc1234)\n';
  for (const body of [
    'Rasika passed the earlier draft; this one is owed. Tier: Standard',
    'Rasika will pass once fixed. Tier: Standard',
    'Rasika dropped, Sutradhar pass. Tier: Standard',
    'Rasika review skipped, Sutradhar pass. Tier: Standard',
    'Rasika: unverified pass. Tier: Standard',
    'Rasika: pass?. Tier: Standard',
    'Rasika pass withdrawn after the re-run went red. Tier: Standard',
    'Rasika declined to pass. Tier: Standard',
    'Rasika withheld a pass. Tier: Standard',
    'Rasika ran out of budget before a pass. Tier: Standard',
    'Rasika: draft verdict pass, final to follow. Tier: Standard',
    'Rasika, pass. Tier: Standard',                                                        // the old heading shape, in today's file
    'Tier: Standard\nRasika verdict: pass with notes.',
    'Write the verdict as `Rasika: <pass | pass with notes | changes needed | blocked>. Tier: Standard`',
    'The template:\nRasika: <pass | pass with notes | changes needed | blocked>. Tier: <Light | Standard | Full>. Slice: <branch> (<hash>)',
    'The review is still owed. Quoting the form:\n\n```\n' + LINE + '\n```',
    'The review is still owed. Quoting the form:\n\n> ' + LINE,
    'The review is still owed. Quoting the form:\n\n> quoted\n' + LINE,
    'The review is still owed. Quoting the form: `' + LINE + '`',
    'The review is still owed.\n<!--\n' + LINE + '\n-->',
    'The review is still owed.\n<!-- ' + LINE + ' -->',
    'The review is still owed.\n\n    ' + LINE,
  ]) {
    assert.equal(ok(unit(), doc(head + body)), false, body);
  }
  // the ledger forms, including the one that was only refused because LEDGER_OWED saw "owed"
  for (const line of [
    '- slice/x (abc1234): Rasika passed the earlier draft; this one is owed. Tier: Standard',
    '- slice/x (abc1234): Rasika review skipped, Sutradhar pass. Tier: Standard',
    '- slice/x (abc1234): Standard; Rasika pass with notes.',
    '- slice/x: Rasika: pass. Tier: Standard. Slice: slice/x (abc1234)',                    // not on a line of its own
  ]) assert.equal(ok(unit(), ledger('## 2026-10-17 09:00 IST: today\n' + line)), false, line);
  // and the line itself is a pass, in a review file and as a ledger bullet
  assert.equal(ok(unit(), doc('# Review\n\n' + LINE + '\n')), true);
  assert.equal(ok(unit(), ledger('## 2026-10-17 09:00 IST: today\n- ' + LINE)), true);
});

test('the canonical line names its slice: the branch and a hash of it, both', () => {
  const j = line => ok(unit(), doc(line));
  assert.equal(j('Rasika: pass. Tier: Standard. Slice: slice/x (def5678)'), true, 'one of the slice\'s own commits');
  assert.equal(j('Rasika: pass. Tier: Standard. Slice: slice/x (def5678aa)'), true, 'a longer hash by prefix match of the ref');
  assert.equal(j('Rasika: pass. Tier: Standard. Slice: slice/y (abc1234)'), false, 'another branch, the right hash');
  assert.equal(j('Rasika: pass. Tier: Standard. Slice: slice/x (9999999)'), false, 'the right branch, a hash that is not the slice\'s');
  assert.equal(j('Rasika: pass. Tier: Standard. Slice: slice/x-two (abc1234)'), false, 'a branch is a whole token');
  assert.equal(j('Rasika: pass. Tier: Standard. Slice: commit abc1234'), false, 'the commit form is for direct commits');
});

test('R2: the tier is the canonical line\'s, and prose cannot raise it', () => {
  const text = LINE + '\n\nA Full review is not needed here. Escalate to a Full pass if the shared primitive changes.\nThe Full Rasika pass is owed for the dialog page edits.\nTier: Full\n';
  assert.equal(ok(unit('standard'), doc(text)), true);
  assert.equal(ok(unit('full'), doc(text)), false, 'a Standard review does not satisfy Full');
  assert.deepEqual(findReviews(doc(text), unit().refs).map(r => r.tier), ['standard']);
  assert.equal(ok(unit('full'), doc('Rasika: pass. Tier: Full. Slice: slice/x (abc1234)')), true);
});

test('R3: a verdict about another slice is not credited to this one by a later mention', () => {
  const text = '# Review\n\nRasika: pass. Tier: Full. Slice: slice/other (1111111)\n\nLater note: slice/x was merged after this was written (abc1234).\n';
  assert.equal(ok(unit('full'), doc(text)), false);
  assert.equal(ok(unit('standard'), doc(text)), false);
  assert.equal(findReviews(doc(text), unit().refs).length, 0);
});

test('R4: a direct commit is reviewed by the line that names that commit; a review of one is not a review of the others', () => {
  const commits = ['0479f4f', '9826360', 'b23a000'].map(h => ({ name: `commit ${h}`, refs: [h], tier: 'full', reasons: [], direct: true }));
  const one = enforce(commits, doc('Rasika: pass. Tier: Full. Slice: commit 9826360\n'));
  assert.deepEqual(one.map(s => s.ok), [false, true, false]);
  const all = enforce(commits, doc(commits.map(c => `Rasika: pass. Tier: Full. Slice: commit ${c.refs[0]}`).join('\n')));
  assert.deepEqual(all.map(s => s.ok), [true, true, true]);
  assert.equal(enforce(commits, doc('Rasika: pass. Tier: Full. Slice: direct/commits (9826360)\n')).some(s => s.ok), false, 'the branch form does not credit a commit');
  assert.equal(enforce(commits, doc('## Direct commits 9826360 and b23a000: Rasika, pass. Tier: Full\n'))[1].ok, false, 'prose naming two of them credits none, in today\'s files');
});

test('legacy: reviews dated before the cutoff keep the old pattern recognition, and only those', () => {
  assert.equal(LEGACY_BEFORE, '2026-10-17');
  const old = '## slice/x (abc1234): Rasika, pass with notes. Tier: Standard\n\nFine.\n';
  assert.equal(ok(unit(), doc(old, '2026-10-16-x.md')), true, 'dated the day before');
  assert.equal(ok(unit(), doc(old, '2026-10-17-x.md')), false, 'dated the cutoff day: canonical only');
  assert.equal(ok(unit(), doc(old, '2026-10-18-x.md')), false, 'later');
  assert.equal(ok(unit(), doc(old, 'wave-3.md')), true, 'the wave files are history');
  assert.equal(ok(unit(), doc(old, 'notes.md')), false, 'a file with no date is not history');
  // a ledger entry takes the date of the heading above it
  const entry = d => ledger(`## ${d} 10:00 IST: an entry\n- **2a** \`abc1234\` (slice/x): Standard; Rasika pass with notes.\n`);
  assert.equal(ok(unit(), entry('2026-10-12')), true);
  assert.equal(ok(unit(), entry('2026-10-16')), true);
  assert.equal(ok(unit(), entry('2026-10-17')), false);
  assert.equal(ok(unit(), ledger('- **2a** `abc1234` (slice/x): Standard; Rasika pass with notes.\n')), false, 'before any dated heading: no date, no legacy');
  // the old vetoes still hold in the old files
  assert.equal(ok(unit(), ledger('## 2026-10-12 10:00 IST: e\n- slice/x: Standard; Rasika pass, review still owed.\n')), false);
  // and the legacy path is a legacy of the same slice-naming rules
  assert.equal(ok(unit(), doc('## slice/y (abc9999): Rasika, pass. Tier: Standard\n', '2026-10-12-y.md')), false);
});

test('the canonical-line parser is what the green depends on (neuter it and the pass goes away)', () => {
  // a mutation guard: a unit whose only evidence is the canonical line, today
  const r = enforce([unit()], doc(LINE))[0];
  assert.equal(r.ok, true);
  assert.equal(r.reviews.length, 1);
  assert.equal(r.reviews[0].source, 'docs/reviews/2026-10-17-r.md:1');
  assert.equal(r.reviews[0].canonical, true);
});

test('R5: changes to the binding itself are at least Standard, never Light', () => {
  const R = { items: [] };
  for (const p of ['tools/gate-tier.core.js', 'tools/gate-tier.mjs', 'tools/gate-tier.test.mjs', 'tools/gate-tier.canon.test.mjs', 'tools/rigour.mjs',
    'tools/lib/rigour.core.js', 'tools/lib/rigour-git.mjs', 'tools/lib/rigour-run.mjs', 'tools/lib/rigour.core.test.mjs', 'tools/fixtures/rigour/check-mute.mjs']) {
    const r = classify([p], R);
    assert.equal(r.tier, 'standard', `${p}: ${r.reasons.join('; ')}`);
  }
  assert.equal(classify(['tools/README.md', 'tools/new-thing.mjs', 'tools/lib/args.mjs'], R).tier, 'light', 'the rest of tools/ is still Light');
});

// ---- end to end: a fixture repository with direct commits ----

const TOOL = path.join(path.dirname(fileURLToPath(import.meta.url)), 'gate-tier.mjs');
test('gate-tier --enforce: direct commits are units of their own, each at its own tier', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-canon-'));
  const g = (...a) => { const r = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8' }); assert.equal(r.status, 0, `git ${a.join(' ')}: ${r.stderr}`); return r.stdout.trim(); };
  const put = (p, text) => { fs.mkdirSync(path.dirname(path.join(dir, p)), { recursive: true }); fs.writeFileSync(path.join(dir, p), text); };
  const run = (...a) => spawnSync(process.execPath, [TOOL, '--enforce', '--repo', dir, '--base', 'start', ...a], { encoding: 'utf8' });
  try {
    g('init', '-q', '-b', 'main');
    put('registry/registry.json', JSON.stringify({ items: [] }));
    put('docs/LEDGER.md', '# Ledger\n');
    g('add', '-A'); g('commit', '-q', '-m', 'start'); g('tag', 'start');
    put('packages/core/core.js', 'export const a = 1;\n'); g('add', '-A'); g('commit', '-q', '-m', 'core one');
    const h1 = g('rev-parse', '--short=7', 'HEAD');
    put('packages/core/core.js', 'export const a = 2;\n'); g('add', '-A'); g('commit', '-q', '-m', 'core two');
    const h2 = g('rev-parse', '--short=7', 'HEAD');
    put('tools/note.mjs', 'export {};\n'); g('add', '-A'); g('commit', '-q', '-m', 'a tool');
    const red = run();
    assert.equal(red.status, 1, red.stdout);
    assert.match(red.stdout, new RegExp(`MISSING full\\s+commit ${h1}`));
    assert.match(red.stdout, new RegExp(`MISSING full\\s+commit ${h2}`));
    assert.match(red.stdout, /ok\s+light\s+commit/, 'a Light commit owes nothing');

    put('docs/reviews/2026-10-17-direct.md', `# Direct\n\nRasika: pass. Tier: Full. Slice: commit ${h1}\n`);
    const half = run();
    assert.equal(half.status, 1, half.stdout);
    assert.match(half.stdout, new RegExp(`ok\\s+full\\s+commit ${h1}`));
    assert.match(half.stdout, new RegExp(`MISSING full\\s+commit ${h2}`));

    put('docs/reviews/2026-10-17-direct.md', `# Direct\n\nRasika: pass. Tier: Full. Slice: commit ${h1}\nRasika: pass. Tier: Full. Slice: commit ${h2}\n`);
    const green = run();
    assert.equal(green.status, 0, green.stdout);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
