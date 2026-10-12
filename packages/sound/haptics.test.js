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

test('haptics: the patterns are keyed by the Web Haptics effect names, and the sound words are aliases', async () => {
  const { EFFECTS, effectFor } = await import('./haptics.js');
  for (const effect of ['tick', 'success', 'error']) assert.ok(Array.isArray(EFFECTS[effect]), `${effect} is an effect`);
  assert.equal(effectFor('confirm'), 'success');
  assert.equal(effectFor('success'), 'success');
  assert.equal(effectFor('bogus'), null);
  assert.deepEqual(patternFor('confirm'), patternFor('success'), 'the old word and the new name give one pattern');
  assert.deepEqual(patternFor('tick'), EFFECTS.tick);
});
