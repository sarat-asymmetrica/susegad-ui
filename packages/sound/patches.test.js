import test from 'node:test';
import assert from 'node:assert/strict';
import { VOCAB, patchFor } from './patches.js';

test('patches: quiet plays confirmations only (decision 0015)', () => {
  assert.equal(patchFor('tick', 'quiet'), null);
  assert.equal(patchFor('complete', 'quiet'), null);
  assert.equal(patchFor('error', 'quiet'), null);
  const confirm = patchFor('confirm', 'quiet');
  assert.ok(confirm);
  assert.ok(confirm.gain > 0 && confirm.gain < patchFor('confirm', 'playful').gain, 'quiet is softer than playful');
});

test('patches: warm plays the whole vocabulary, softer than playful', () => {
  for (const name of VOCAB) {
    const warm = patchFor(name, 'warm'), playful = patchFor(name, 'playful');
    assert.ok(warm && playful);
    assert.ok(warm.gain < playful.gain, `${name}: warm quieter than playful`);
    assert.deepEqual(warm.notes, playful.notes, `${name}: same notes, different loudness`);
  }
});

test('patches: playful plays every word, each with at least one note and a positive duration', () => {
  for (const name of VOCAB) {
    const p = patchFor(name, 'playful');
    assert.ok(p.notes.length >= 1);
    assert.ok(p.dur > 0);
    assert.ok(p.gain > 0 && p.gain <= 1);
  }
});

test('patches: an unknown word is always null, in every register', () => {
  for (const register of ['quiet', 'warm', 'playful']) assert.equal(patchFor('bogus', register), null);
});

test('patches: an unknown register falls back to the full vocabulary (never silently drops a real word)', () => {
  assert.deepEqual(patchFor('tick', 'nonsense'), patchFor('tick', 'playful'));
});
