// The narrower --changed (changed.core.js with a context): a tools/lib file or a dependency selects
// what loads it; everything runs only for the harness, server, slots, overflow, runner, or a
// dependency the harness loads.
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectChecks, selectNodeChecks } from './changed.core.js';

const checks = ['packages/a/a.check.mjs', 'packages/b/b.check.mjs', 'packages/c/c.check.mjs', 'tools/touch.check.mjs'];
const graph = {
  'packages/a/a.check.mjs': { files: ['tools/lib/component-check.mjs', 'tools/lib/frame-schedule.mjs', 'tools/lib/stats.mjs'], packages: ['playwright', 'axe-core'] },
  'packages/b/b.check.mjs': { files: ['tools/lib/component-check.mjs'], packages: ['playwright', 'axe-core', 'jsqr'] },
  'packages/c/c.check.mjs': { files: ['tools/lib/component-check.mjs', 'tools/lib/stats.mjs'], packages: ['playwright', 'axe-core', 'subset-font', 'harfbuzzjs'] },
  'tools/touch.check.mjs': { files: ['tools/lib/component-check.mjs'], packages: ['playwright', 'axe-core'] },
  'tools/text-gate.mjs': { files: ['tools/lib/hb-canvas.mjs'], packages: ['harfbuzzjs', 'wawoff2'] },
  'tools/bake-gate.mjs': { files: ['tools/lib/hb-canvas.mjs'], packages: ['harfbuzzjs', 'wawoff2'] },
};
// stats.mjs reached through frame-schedule.mjs in a, directly in c
const parents = { 'packages/a/a.check.mjs': { 'tools/lib/stats.mjs': 'tools/lib/frame-schedule.mjs' } };
const loads = check => {
  const g = graph[check];
  return g && {
    files: new Map([[check, null], ...g.files.map(f => [f, parents[check]?.[f] ?? check])]),
    packages: new Set(g.packages),
  };
};
const context = (changedPackages = []) => ({
  loads,
  everyAll: new Map([['tools/lib/component-check.mjs', 'the harness'], ['tools/lib/slots.mjs', 'part of the harness (tools/lib/component-check.mjs imports it)']]),
  everyAllPackages: new Set(['playwright', 'playwright-core', 'axe-core']),
  browserPackages: new Set(Object.entries(graph).filter(([c]) => checks.includes(c)).flatMap(([, g]) => g.packages)),
  changedPackages,
});
const run = (changed, ctx = context()) => selectChecks({ changed, checks, items: [], context: ctx });
const names = r => r.selected.map(s => s.check);
const node = (changed, ctx = context()) => selectNodeChecks({ changed, context: ctx }).map(s => s.check);

test('a tools/lib file selects only the checks that import it, and says through what', () => {
  const r = run(['tools/lib/frame-schedule.mjs']);
  assert.equal(r.all, false);
  assert.deepEqual(names(r), ['packages/a/a.check.mjs']);
  assert.match(r.selected[0].reasons[0], /^imports tools\/lib\/frame-schedule\.mjs, which changed$/);
  const s = run(['tools/lib/stats.mjs']);
  assert.deepEqual(names(s), ['packages/a/a.check.mjs', 'packages/c/c.check.mjs']);
  assert.match(s.selected[0].reasons[0], /through tools\/lib\/frame-schedule\.mjs/);
  assert.deepEqual(node(['tools/lib/frame-schedule.mjs']), []);
});

test('a tools/lib file nothing imports (a test, a note) selects nothing', () => {
  assert.deepEqual(names(run(['tools/lib/stats.test.mjs', 'tools/lib/check-durations.json'])), []);
});

test('the harness and what it imports run everything, with the reason', () => {
  for (const f of ['tools/lib/component-check.mjs', 'tools/lib/slots.mjs']) {
    const r = run([f]);
    assert.equal(r.all, true, f);
    assert.match(r.allReason, new RegExp(`^${f.replaceAll('.', '\\.')} is .*harness.*: everything runs$`));
  }
});

test('a lockfile change in a dependency only Node tools and one check load selects just those', () => {
  const ctx = context(['harfbuzzjs']);
  const r = run(['package-lock.json'], ctx);
  assert.equal(r.all, false);
  assert.deepEqual(names(r), ['packages/c/c.check.mjs']);
  assert.match(r.selected[0].reasons[0], /loads harfbuzzjs, which changed in the lockfile/);
  assert.deepEqual(node(['package-lock.json'], ctx), ['tools/text-gate.mjs', 'tools/bake-gate.mjs']);
  assert.match(r.notes[0], /harfbuzzjs/);
});

test('a dev dependency no check loads selects nothing for the browser suite, and the note says so', () => {
  const ctx = context(['wrangler']);
  const r = run(['package-lock.json', 'package.json'], ctx);
  assert.deepEqual(names(r), []);
  assert.match(r.notes[0], /no browser check loads wrangler/);
  assert.deepEqual(node(['package-lock.json'], ctx), []);
});

test('playwright or axe-core changing runs everything', () => {
  for (const p of ['playwright', 'playwright-core', 'axe-core']) {
    const r = run(['package-lock.json'], context(['harfbuzzjs', p]));
    assert.equal(r.all, true, p);
    assert.match(r.allReason, new RegExp(`${p} changed, and every browser check loads it`));
    assert.equal(node(['package-lock.json'], context([p])).length, 2);
  }
});

test('package.json without a dependency change (a script) selects nothing, and says so', () => {
  const r = run(['package.json'], context([]));
  assert.deepEqual(names(r), []);
  assert.match(r.notes[0], /no dependency did/);
});

test('a dependency diff that could not be read runs everything', () => {
  assert.equal(run(['package-lock.json'], context(null)).all, true);
});

test('packages/core and the server still run everything, context or not', () => {
  for (const f of ['packages/core/index.js', 'tools/serve.mjs', 'tools/harness/demo.js', 'packages/tokens/tokens.css']) {
    assert.equal(run([f]).all, true, f);
  }
});

test('without a context, tools/lib and the lockfile still run everything (the old rule)', () => {
  assert.equal(selectChecks({ changed: ['tools/lib/frame-schedule.mjs'], checks, items: [] }).all, true);
  assert.equal(selectChecks({ changed: ['package-lock.json'], checks, items: [] }).all, true);
});
