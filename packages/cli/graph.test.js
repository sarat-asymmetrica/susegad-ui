import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveOrder, checkGraph, GraphError } from './src/graph.js';

const graph = obj => new Map(Object.entries(obj).map(([k, deps]) => [k, { dependencies: deps }]));

test('dependencies come before the things that use them', () => {
  const g = graph({ 'scene-kolam': ['core', 'engine', 'tokens'], core: ['engine', 'tokens'], engine: [], tokens: [] });
  assert.deepEqual(resolveOrder(g, ['scene-kolam']), ['engine', 'tokens', 'core', 'scene-kolam']);
});

test('order is alphabetical among equals, whatever order the manifest lists them in', () => {
  const a = graph({ top: ['zeta', 'alpha', 'mid'], zeta: [], alpha: [], mid: [] });
  assert.deepEqual(resolveOrder(a, ['top']), ['alpha', 'mid', 'zeta', 'top']);
});

test('a diamond is resolved once', () => {
  const g = graph({ a: ['b', 'c'], b: ['d'], c: ['d'], d: [] });
  assert.deepEqual(resolveOrder(g, ['a']), ['d', 'b', 'c', 'a']);
});

test('several requested items share their dependencies', () => {
  const g = graph({ 'scene-paus': ['core'], 'scene-kolam': ['core'], core: [] });
  assert.deepEqual(resolveOrder(g, ['scene-paus', 'scene-kolam']), ['core', 'scene-paus', 'scene-kolam']);
});

test('a cycle is refused and named', () => {
  const g = graph({ a: ['b'], b: ['c'], c: ['a'] });
  assert.throws(() => resolveOrder(g, ['a']), err => {
    assert.ok(err instanceof GraphError);
    assert.equal(err.kind, 'cycle');
    assert.deepEqual(err.chain, ['a', 'b', 'c', 'a']);
    assert.match(err.message, /a -> b -> c -> a/);
    return true;
  });
});

test('an item that depends on itself is a cycle', () => {
  assert.throws(() => resolveOrder(graph({ a: ['a'] }), ['a']), { kind: 'cycle' });
});

test('an unknown dependency names who asked for it', () => {
  assert.throws(() => resolveOrder(graph({ a: ['ghost'] }), ['a']), err => {
    assert.equal(err.kind, 'missing');
    assert.deepEqual(err.chain, ['a', 'ghost']);
    return true;
  });
  assert.throws(() => resolveOrder(graph({}), ['nope']), { kind: 'missing', message: /no item called nope/ });
});

test('checkGraph finds every missing dependency and each cycle once', () => {
  const g = graph({ a: ['b'], b: ['a'], c: ['d'], d: ['e'], e: ['c'], f: ['ghost'], s: ['s'] });
  const { missing, cycles } = checkGraph(g);
  assert.deepEqual(missing, [['f', 'ghost']]);
  assert.deepEqual(cycles.map(c => c.join('>')).sort(), ['a>b>a', 'c>d>e>c', 's>s']);
});

test('checkGraph is quiet on a healthy graph', () => {
  assert.deepEqual(checkGraph(graph({ a: ['b', 'c'], b: ['c'], c: [] })), { missing: [], cycles: [] });
});
