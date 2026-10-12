// The mutant-rot guard. A check's planted fault (a `--break` row, a patch pair, a `.replace` on a served body) only
// proves the check can fail while its needle still occurs in the file it patches. The math pass found M1 had
// rewritten the line flow.check's mutant pointed at, and nothing noticed. This test reads every *.check.mjs, finds
// each needle, and asserts it still occurs in its target as often as the mutation expects; mutations it can't read
// statically must be on tools/lib/mutants.allow.json with a reason, so that list can't grow silently.
//
//   MUTANTS_ROOT=<a copy of the repo> node --test tools/lib/mutants.test.mjs    the same guard over another tree

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lex, findMutations, countNeedle, resolveTargets, judge, audit, packageRoot } from './mutants.core.js';

const ROOT = process.env.MUTANTS_ROOT ? path.resolve(process.env.MUTANTS_ROOT) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ALLOW = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/lib/mutants.allow.json'), 'utf8'));
const SKIP = new Set(['node_modules', '.git', '.worktrees', '.shots', '.playwright-mcp', 'graphify-out']);

function* walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) yield* walk(path.join(dir, e.name), r);
    else yield r;
  }
}

/** The tree as the guard sees it: the checks, and the files a check may serve (code, not checks or tests). */
function tree(root) {
  const all = [...walk(root)];
  const cache = new Map();
  const read = f => { if (!cache.has(f)) cache.set(f, fs.readFileSync(path.join(root, f), 'utf8')); return cache.get(f); };
  return {
    checks: all.filter(f => f.endsWith('.check.mjs')).sort(),
    files: all.filter(f => /\.(m?js|css|html|svg)$/.test(f) && !/\.check\.mjs$|\.test\.m?js$/.test(f)),
    read,
  };
}

// ── the reader ─────────────────────────────────────────────────────────────

test('lex: strings decode, regex and division are told apart, comments and template expressions are skipped', () => {
  const toks = lex("const a = 'it\\'s', b = x / 2 / y, c = s.replace(/a\\/b[/]c/g, `t${'}'}`); // 'not a string'\n/* 'nor this' */");
  const strs = toks.filter(t => t.t === 'str').map(t => t.v);
  assert.deepEqual(strs, ["it's"]);
  assert.deepEqual(toks.filter(t => t.t === 're').map(t => [t.v, t.flags]), [['a\\/b[/]c', 'g']]);
  assert.equal(toks.filter(t => t.v === '/').length, 2, 'the two divisions stay punctuation');
  assert.equal(toks.find(t => t.t === 'tpl').dyn, true);
});

test('finds each needle shape the checks use: a --break row, a patch pair, a table of arrow patches, a const needle', () => {
  const src = `
const BREAKS = {
  'no-grow': ['field.css', 'field-sizing: content;', 'field-sizing: fixed;'],
  replays: ['js', 'seen(nodes) { mark([...nodes]); },', 'seen() {},'],
};
const ARROWS = {
  ignoresPot: [/matka-view\\.js$/, s => s.replace('(top, bottom) => extentIn(pot, top, bottom)', '() => null')],
  lamp: [/model\\.js$/, s => s.replace(/warm: \\{ swing: [0-9.]+/, 'warm: { swing: 0')],
};
const NO_URL = { 'packages/x/world.html': [["history.replaceState(null, '', u.href);", '']] };
await open({ patch: [['this.#watchPlace();', '']] });
const cond = '(early && data.held)', body = read();
body.replace(cond, 'false');
const words = ['type/index.js', 'type/measure.js', 'type/vendor/pretext.js'];
const label = text.textContent.replace(/\\s+/g, ' ').replace('Total', '');
for (const [from, to] of pairs) body = body.replace(from, to);
`;
  const { mutations, computed } = findMutations(src);
  const got = mutations.map(m => [m.via, m.needle.value, m.spec?.value ?? null, m.expect]);
  assert.deepEqual(got, [
    ['row', 'field-sizing: content;', 'field.css', 'once'],
    ['row', 'seen(nodes) { mark([...nodes]); },', 'js', 'once'],
    ['replace', '(top, bottom) => extentIn(pot, top, bottom)', 'matka-view\\.js$', 'once'],
    ['replace', 'warm: \\{ swing: [0-9.]+', 'model\\.js$', 'once'],
    ['pair', "history.replaceState(null, '', u.href);", 'packages/x/world.html', 'once'],
    ['pair', 'this.#watchPlace();', null, 'once'],
    ['replace-const', '(early && data.held)', null, 'once'],
  ]);
  assert.deepEqual(computed.map(c => c.text), ['.replace(from, to)'], 'the table consumer is computed; text normalising is not a mutation');
});

test('resolves a target by path (relative, repo, or route suffix), by served-path regex, or by the nearest folder holding it', () => {
  const files = ['packages/components/field/field.css', 'packages/components/form/form.css', 'packages/scenes/veranda/matka-view.js', 'packages/core/scene-element.js', 'packages/scenes/veranda/paint.js', 'packages/components/signature/skins/paint.js'];
  const body = { 'packages/components/field/field.css': 'a { field-sizing: content; }', 'packages/components/form/form.css': 'sg-form :active { x }', 'packages/scenes/veranda/matka-view.js': 'f(top, bottom) && g(top, bottom)', 'packages/core/scene-element.js': 'this.#watchPlace();', 'packages/scenes/veranda/paint.js': 'sun()', 'packages/components/signature/skins/paint.js': 'sun()' };
  const read = f => body[f];
  const at = (needle, spec, check = 'packages/components/field/grow-press.check.mjs') => resolveTargets({ needle: { kind: 'str', value: needle }, spec }, check, files, read).targets.map(t => `${t.file}×${t.count}`);
  assert.deepEqual(at('field-sizing: content;', { kind: 'path', value: 'field.css' }), ['packages/components/field/field.css×1']);
  assert.deepEqual(at('sg-form :active', { kind: 'path', value: 'form.css' }), ['packages/components/form/form.css×1'], 'a route on **/form.css');
  assert.deepEqual(at('(top, bottom)', { kind: 're', value: 'matka-view\\.js$', flags: '' }, 'packages/scenes/veranda/flow.check.mjs'), ['packages/scenes/veranda/matka-view.js×2']);
  assert.deepEqual(at('sun()', { kind: 're', value: 'paint\\.js$', flags: '' }, 'packages/scenes/veranda/veranda.check.mjs'), ['packages/scenes/veranda/paint.js×1'], 'the check\'s own folder wins over a namesake elsewhere');
  assert.deepEqual(at('this.#watchPlace();', null, 'packages/core/calm.check.mjs'), ['packages/core/scene-element.js×1']);
  assert.equal(packageRoot('packages/scenes/veranda'), 'packages/scenes/veranda');
  assert.equal(packageRoot('packages/core'), 'packages/core');
});

test('judge: a needle gone from its target fails, a needle that occurs twice where replace() takes only the first fails, one occurrence passes', () => {
  const m = { needle: { kind: 'str', value: 'x' }, expect: 'once' };
  assert.equal(judge(m, { targets: [], how: 'no file holds it' }).ok, false);
  assert.equal(judge(m, { targets: [{ file: 'a.js', count: 2 }], how: '' }).ok, false);
  assert.equal(judge(m, { targets: [{ file: 'a.js', count: 1 }], how: '' }).ok, true);
  assert.equal(judge({ ...m, expect: 'some' }, { targets: [{ file: 'a.js', count: 3 }], how: '' }).ok, true);
  assert.equal(countNeedle('aXa aXa', { kind: 're', value: 'a.a', flags: '' }), 2, 'a regex needle counts every match');
});

// ── it bites (A10): the M1 case, replayed on a small tree ──────────────────

test('it bites: the line a flow.check mutant points at is rewritten, and the guard goes red; restored, it is green again', () => {
  const check = 'packages/scenes/veranda/flow.check.mjs';
  const src = "const BREAKS = {\n  everyFrame: [/matka-view\\.js$/, s => s.replace('if (step !== laidStep || key !== laidKey) {', 'if (true) {')],\n};\n";
  const view = 'packages/scenes/veranda/matka-view.js';
  const run = viewSrc => audit({ checks: [check], files: [view], read: f => (f === check ? src : viewSrc), allow: {} });
  const healthy = run('function frame() {\n  if (step !== laidStep || key !== laidKey) {\n    lay();\n  }\n}');
  assert.deepEqual(healthy.problems, []);
  assert.equal(healthy.covered.length, 1);
  const rewritten = run('function frame() {\n  if (step !== laidStep || key !== laidKey || resized) {\n    lay();\n  }\n}');
  assert.equal(rewritten.problems.length, 1, 'a rewritten line is caught');
  assert.match(rewritten.problems[0], /flow\.check\.mjs:2 replace .*no target/);
});

test('it bites: an unlisted computed mutation, a stale allowlist entry, and a rotted needle that bites again each fail', () => {
  const check = 'packages/x/x.check.mjs';
  const src = "const BREAKS = { a: ['x.js', 'alpha', 'beta'] };\nfor (const [f, from, to] of rows) body = body.replace(from, to);\n";
  const read = f => (f === check ? src : 'alpha');
  const base = { checks: [check], files: ['packages/x/x.js'], read };
  assert.match(audit({ ...base, allow: {} }).problems.join('\n'), /can't read statically, not on the allowlist/);
  const listed = { computed: [{ check, call: '.replace(from, to)', reason: 'rows' }] };
  assert.deepEqual(audit({ ...base, allow: listed }).problems, []);
  assert.match(audit({ ...base, allow: { ...listed, exempt: [{ check, needle: 'gone', reason: '' }] } }).problems.join('\n'), /matches nothing any more/);
  assert.match(audit({ ...base, allow: { ...listed, rotted: [{ check, needle: 'alpha', reason: '' }] } }).problems.join('\n'), /bites again/);
});

// ── the real tree ──────────────────────────────────────────────────────────

test('every planted fault in every check still has its needle in its target', () => {
  const t = tree(ROOT);
  const r = audit({ ...t, allow: ALLOW });
  const files = new Set(r.covered.map(m => m.check));
  console.log(`mutant guard over ${t.checks.length} checks in ${ROOT}: ${r.covered.length} needles checked in ${files.size} checks; ${r.computed.length} computed and ${r.exempt.length} exempt on the allowlist; ${r.rotted.length} known rotted`);
  for (const m of r.rotted) console.log(`  rotted: ${m.check}:${m.line} ${JSON.stringify(m.needle.value).slice(0, 80)}`);
  assert.deepEqual(r.problems, []);
  assert.ok(r.covered.length >= 100, `the guard should see the repo's needles, saw ${r.covered.length}`);
});
