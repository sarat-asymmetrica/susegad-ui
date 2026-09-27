import test from 'node:test';
import assert from 'node:assert/strict';
import { VOCAB } from './patches.js';
import { patternFor } from './haptics.js';

test('haptics: every vocabulary word has a pattern of positive milliseconds', () => {
  for (const name of VOCAB) {
    const p = patternFor(name);
    assert.ok(Array.isArray(p) && p.length > 0, `${name} has a pattern`);
    assert.ok(p.every(n => Number.isFinite(n) && n > 0), `${name}: every entry is a positive number`);
  }
});

test('haptics: an unknown word has no pattern', () => {
  assert.equal(patternFor('bogus'), null);
});

test('haptics: complete is the longest pattern (the biggest news) and tick the shortest (the smallest)', () => {
  const sum = a => a.reduce((s, n) => s + n, 0);
  assert.ok(sum(patternFor('complete')) > sum(patternFor('confirm')));
  assert.ok(sum(patternFor('tick')) < sum(patternFor('confirm')));
});
